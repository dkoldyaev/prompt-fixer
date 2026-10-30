import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { getConfig } from '../packages/shared/config';
import { getStorage } from './database';
import { PipelineOrchestrator } from '../packages/ai-pipeline/orchestrator';
import { evaluatePromptComplexity } from '../packages/ai-pipeline/complexityClassifier';
import { JobProgressEvent, TargetEnvironment, GenerationMode } from '../packages/shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Strict Configuration Verification before startup (Section 13)
const config = getConfig();

export const app = express();

app.use(
  cors({
    origin: config.PUBLIC_APP_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '10mb' }));

// Active SSE subscribers map: jobId -> Set of response streams
const jobSubscribers: Map<string, Set<Response>> = new Map();
const activeJobCancellations: Set<string> = new Set();

function broadcastJobEvent(jobId: string, event: JobProgressEvent) {
  const subscribers = jobSubscribers.get(jobId);
  if (subscribers) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of subscribers) {
      try {
        res.write(data);
      } catch (err) {
        subscribers.delete(res);
      }
    }
  }
}

// -------------------------------------------------------------
// Health Check
// -------------------------------------------------------------
app.get('/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    config: {
      port: config.API_PORT,
      publicOrigin: config.PUBLIC_APP_ORIGIN,
      analyzerModel: config.OPENAI_ANALYZER_MODEL,
      architectModel: config.OPENAI_ARCHITECT_MODEL,
      composerModel: config.OPENAI_COMPOSER_MODEL,
      reviewerModel: config.OPENAI_REVIEWER_MODEL,
      fastModel: config.OPENAI_FAST_MODEL,
    },
  });
});

// -------------------------------------------------------------
// Complexity Analysis Endpoint
// -------------------------------------------------------------
app.post('/api/analyze-complexity', (req: Request, res: Response) => {
  const schema = z.object({
    rawPrompt: z.string().min(1, 'rawPrompt cannot be empty'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const assessment = evaluatePromptComplexity(parsed.data.rawPrompt);
  res.json(assessment);
});

// -------------------------------------------------------------
// Jobs Management & SSE Endpoints
// -------------------------------------------------------------
const CreateJobSchema = z.object({
  rawPrompt: z.string().min(1, 'rawPrompt is required'),
  targetEnvironment: z.enum([
    'google-antigravity',
    'claude-code',
    'cursor',
    'universal-agent',
    'generic-llm',
  ]),
  generationMode: z.enum(['fast', 'quality', 'adaptive']),
  projectId: z.string().optional(),
  preferences: z
    .object({
      targetLanguage: z.string().optional(),
      detailLevel: z.enum(['concise', 'standard', 'detailed']).optional(),
      includeArchitecturalAdditions: z.boolean().optional(),
      includeExplanations: z.boolean().optional(),
      customInstructions: z.string().optional(),
      stageModels: z
        .object({
          analyzer: z.string().optional(),
          architect: z.string().optional(),
          composer: z.string().optional(),
          reviewer: z.string().optional(),
          fast: z.string().optional(),
        })
        .optional(),
      reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
});

app.post('/api/jobs', async (req: Request, res: Response) => {
  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const storage = await getStorage();
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const job = await storage.createJob({
    id: jobId,
    projectId: parsed.data.projectId,
    targetEnvironment: parsed.data.targetEnvironment,
    generationMode: parsed.data.generationMode,
    status: 'queued',
    currentStep: 'queued',
    totalTokens: 0,
    totalCostUsd: 0,
    cancelRequested: false,
  });

  // Launch background job asynchronously (Section 11)
  const orchestrator = new PipelineOrchestrator();

  (async () => {
    try {
      const result = await orchestrator.execute({
        jobId,
        rawPrompt: parsed.data.rawPrompt,
        targetEnvironment: parsed.data.targetEnvironment,
        mode: parsed.data.generationMode,
        preferences: parsed.data.preferences,
        checkCancelled: () => activeJobCancellations.has(jobId),
        onProgress: async (event: JobProgressEvent) => {
          await storage.updateJob(jobId, {
            status: event.status,
            currentStep: event.currentStep,
            intermediateResults: event.intermediateResults,
            totalTokens: event.metrics?.totalTokens || 0,
            totalCostUsd: event.metrics?.totalCostUsd ?? null,
          });
          broadcastJobEvent(jobId, event);
        },
      });

      // Automatically create or update project version if projectId provided
      if (parsed.data.projectId) {
        const existingVersions = await storage.getVersionsForProject(parsed.data.projectId);
        const versionNumber = existingVersions.length + 1;

        await storage.createVersion({
          projectId: parsed.data.projectId,
          versionNumber,
          rawPrompt: parsed.data.rawPrompt,
          targetEnvironment: parsed.data.targetEnvironment,
          generationMode: parsed.data.generationMode,
          settings: parsed.data.preferences || {},
          systemPrompt: result.prompts.systemPrompt,
          userPrompt: result.prompts.userPrompt,
          whatImproved: result.prompts.whatImproved,
          assumptions: result.prompts.assumptions,
          unresolvedQuestions: result.prompts.unresolvedQuestions,
          reviewReport: result.reviewReport,
          requirements: result.analyzerResult,
          architecturalDecisions: result.architectResult,
          modelsUsed: result.stageMetrics.map((m) => m.modelId),
          totalTokens: result.totalTokens,
          totalCostUsd: result.totalCostUsd,
        });
      }

      await storage.updateJob(jobId, {
        status: 'completed',
        currentStep: 'done',
        intermediateResults: {
          analyzer: result.analyzerResult,
          architect: result.architectResult,
          composer: result.prompts,
          reviewReport: result.reviewReport,
          complexity: result.complexity,
        },
        totalTokens: result.totalTokens,
        totalCostUsd: result.totalCostUsd,
      });

      // Record stage metrics
      for (const m of result.stageMetrics) {
        await storage.recordMetric({ ...m, jobId });
      }
    } catch (err: any) {
      if (err.message === 'JOB_CANCELLED' || activeJobCancellations.has(jobId)) {
        await storage.updateJob(jobId, { status: 'cancelled' });
        broadcastJobEvent(jobId, {
          jobId,
          status: 'cancelled',
          progressPercent: 100,
          message: 'Генерация отменена пользователем',
        });
      } else {
        await storage.updateJob(jobId, {
          status: 'failed',
          errorMessage: err.message || 'Unknown generation error',
        });
        broadcastJobEvent(jobId, {
          jobId,
          status: 'failed',
          progressPercent: 100,
          message: `Ошибка выполнения: ${err.message}`,
          error: err.message,
        });
      }
    } finally {
      activeJobCancellations.delete(jobId);
    }
  })();

  res.status(201).json({ jobId, status: job.status });
});

app.get('/api/jobs/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const storage = await getStorage();
  const job = await storage.getJob(id);
  if (!job) {
    return res.status(404).json({ error: 'Задание не найдено' });
  }
  res.json(job);
});

app.get('/api/jobs/:id/events', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const storage = await getStorage();
  const job = await storage.getJob(id);
  if (!job) {
    return res.status(404).json({ error: 'Задание не найдено' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!jobSubscribers.has(id)) {
    jobSubscribers.set(id, new Set());
  }
  jobSubscribers.get(id)!.add(res);

  // Send current state immediately
  res.write(
    `data: ${JSON.stringify({
      jobId: job.id,
      status: job.status,
      currentStep: job.currentStep,
      progressPercent: job.status === 'completed' ? 100 : job.status === 'failed' ? 100 : 50,
      message: `Текущий статус: ${job.status}`,
      intermediateResults: job.intermediateResults,
      metrics: {
        totalTokens: job.totalTokens,
        totalCostUsd: job.totalCostUsd,
      },
    })}\n\n`
  );

  req.on('close', () => {
    jobSubscribers.get(id)?.delete(res);
  });
});

app.post('/api/jobs/:id/cancel', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const storage = await getStorage();
  activeJobCancellations.add(id);
  const ok = await storage.requestJobCancel(id);
  if (!ok) {
    return res.status(404).json({ error: 'Задание не найдено' });
  }
  res.json({ success: true, message: 'Отмена запрошена' });
});

// -------------------------------------------------------------
// Projects & Versions Endpoints
// -------------------------------------------------------------
app.get('/api/projects', async (req: Request, res: Response) => {
  const storage = await getStorage();
  const search = req.query.search as string | undefined;
  const projects = await storage.listProjects(search);

  // Attach latest version summary to each project
  const enriched = await Promise.all(
    projects.map(async (p) => {
      const versions = await storage.getVersionsForProject(p.id);
      const latest = versions[versions.length - 1];
      return {
        ...p,
        versionCount: versions.length,
        latestVersion: latest
          ? {
              versionNumber: latest.versionNumber,
              targetEnvironment: latest.targetEnvironment,
              generationMode: latest.generationMode,
              totalTokens: latest.totalTokens,
              totalCostUsd: latest.totalCostUsd,
              createdAt: latest.createdAt,
            }
          : null,
      };
    })
  );

  res.json({ projects: enriched });
});

app.post('/api/projects', async (req: Request, res: Response) => {
  const schema = z.object({
    title: z.string().min(1, 'Title is required'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const storage = await getStorage();
  const proj = await storage.createProject(parsed.data.title);
  res.status(201).json(proj);
});

app.get('/api/projects/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const storage = await getStorage();
  const project = await storage.getProject(id);
  if (!project) {
    return res.status(404).json({ error: 'Проект не найден' });
  }
  const versions = await storage.getVersionsForProject(project.id);
  res.json({ project, versions });
});

app.put('/api/projects/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const schema = z.object({
    title: z.string().min(1, 'Title is required'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const storage = await getStorage();
  const updated = await storage.updateProjectTitle(id, parsed.data.title);
  if (!updated) {
    return res.status(404).json({ error: 'Проект не найден' });
  }
  res.json(updated);
});

app.delete('/api/projects/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const storage = await getStorage();
  const ok = await storage.deleteProject(id);
  if (!ok) {
    return res.status(404).json({ error: 'Проект не найден' });
  }
  res.json({ success: true });
});

app.post('/api/projects/:id/versions', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const storage = await getStorage();
  const project = await storage.getProject(id);
  if (!project) {
    return res.status(404).json({ error: 'Проект не найден' });
  }

  const existingVersions = await storage.getVersionsForProject(project.id);
  const versionNumber = existingVersions.length + 1;

  const version = await storage.createVersion({
    projectId: project.id,
    versionNumber,
    rawPrompt: req.body.rawPrompt,
    targetEnvironment: req.body.targetEnvironment,
    generationMode: req.body.generationMode,
    settings: req.body.settings || {},
    systemPrompt: req.body.systemPrompt,
    userPrompt: req.body.userPrompt,
    whatImproved: req.body.whatImproved || [],
    assumptions: req.body.assumptions || [],
    unresolvedQuestions: req.body.unresolvedQuestions || [],
    reviewReport: req.body.reviewReport || { isApproved: true, score: 100, traceability: [], critique: [], summary: '' },
    requirements: req.body.requirements,
    architecturalDecisions: req.body.architecturalDecisions,
    modelsUsed: req.body.modelsUsed || [],
    totalTokens: req.body.totalTokens || 0,
    totalCostUsd: req.body.totalCostUsd ?? null,
  });

  res.status(201).json(version);
});

// -------------------------------------------------------------
// Surgical Revision Endpoint (Section 6.3)
// -------------------------------------------------------------
app.post('/api/projects/:id/revision', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const schema = z.object({
    instruction: z.string().min(1, 'instruction is required'),
    sourceVersionId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const storage = await getStorage();
  const project = await storage.getProject(id);
  if (!project) {
    return res.status(404).json({ error: 'Проект не найден' });
  }

  const versions = await storage.getVersionsForProject(project.id);
  let baseVersion = versions[versions.length - 1];
  if (parsed.data.sourceVersionId) {
    const found = versions.find((v) => v.id === parsed.data.sourceVersionId);
    if (found) baseVersion = found;
  }

  if (!baseVersion) {
    return res.status(400).json({ error: 'Нет исходной версии для редактирования' });
  }

  const orchestrator = new PipelineOrchestrator();
  const revisionResult = await orchestrator.executeRevision({
    currentSystemPrompt: baseVersion.systemPrompt,
    currentUserPrompt: baseVersion.userPrompt,
    amendmentInstruction: parsed.data.instruction,
    targetEnvironment: baseVersion.targetEnvironment,
  });

  const nextVersionNumber = versions.length + 1;
  const newVersion = await storage.createVersion({
    projectId: project.id,
    versionNumber: nextVersionNumber,
    rawPrompt: `${baseVersion.rawPrompt}\n\n[Уточнение v${nextVersionNumber}]: ${parsed.data.instruction}`,
    targetEnvironment: baseVersion.targetEnvironment,
    generationMode: baseVersion.generationMode,
    settings: baseVersion.settings,
    systemPrompt: revisionResult.updatedSystemPrompt,
    userPrompt: revisionResult.updatedUserPrompt,
    whatImproved: revisionResult.changelog,
    assumptions: baseVersion.assumptions,
    unresolvedQuestions: baseVersion.unresolvedQuestions,
    reviewReport: {
      isApproved: true,
      score: 100,
      traceability: baseVersion.reviewReport?.traceability || [],
      critique: [],
      summary: revisionResult.traceabilitySummary,
    },
    requirements: baseVersion.requirements,
    architecturalDecisions: baseVersion.architecturalDecisions,
    modelsUsed: [config.OPENAI_COMPOSER_MODEL],
    totalTokens: (baseVersion.totalTokens || 0) + revisionResult.metrics.inputTokens + revisionResult.metrics.outputTokens,
    totalCostUsd: (baseVersion.totalCostUsd || 0) + (revisionResult.metrics.costUsd || 0),
  });

  res.status(201).json({
    version: newVersion,
    changelog: revisionResult.changelog,
  });
});

// -------------------------------------------------------------
// Template Management Endpoints (Section 8)
// -------------------------------------------------------------
app.get('/api/templates', async (_req: Request, res: Response) => {
  const storage = await getStorage();
  const templates = await storage.getTemplates();
  res.json({ templates });
});

app.put('/api/templates/:id', async (req: Request, res: Response) => {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().min(1),
    content: z.string().min(1),
    version: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const storage = await getStorage();
  const templates = await storage.getTemplates();
  const current = templates.find((t) => t.id === req.params.id);
  if (!current) {
    return res.status(404).json({ error: 'Шаблон не найден' });
  }

  const updated = {
    ...current,
    ...parsed.data,
  };
  await storage.saveTemplate(updated);
  res.json({ template: updated });
});

// -------------------------------------------------------------
// Production Static Serving
// -------------------------------------------------------------
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// Catch-all route for SPA
app.use((_req: Request, res: Response) => {
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // In dev mode when dist is not built yet
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>AI Prompt Rewriter</title></head>
        <body style="font-family: sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc;">
          <h1>AI Prompt Rewriter Server Running</h1>
          <p>API Server is listening on port ${config.API_PORT}.</p>
          <p>Run <code>npm run dev</code> for Vite frontend dev server or <code>npm run build</code> to produce production assets.</p>
        </body>
        </html>
      `);
    }
  });
});

// Start listening if run directly
if (process.env.NODE_ENV !== 'test') {
  const port = config.API_PORT;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[AI Prompt Rewriter] Server running on http://0.0.0.0:${port}`);
    console.log(`[AI Prompt Rewriter] Strict Configuration: VALIDATED`);
    console.log(`[AI Prompt Rewriter] Public App Origin: ${config.PUBLIC_APP_ORIGIN}`);
  });
}
