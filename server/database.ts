import pg from 'pg';
import { getConfig } from '../packages/shared/config';
import {
  TargetEnvironment,
  GenerationMode,
  JobStatus,
  PromptPackage,
  ReviewReport,
  RequirementsAnalysis,
  SolutionArchitecture,
  StageUsageMetric,
} from '../packages/shared/types';
import { SYSTEM_PROMPT_TEMPLATES, PromptTemplateDefinition } from '../packages/prompt-templates';

export interface ProjectEntity {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface VersionEntity {
  id: string;
  projectId: string;
  versionNumber: number;
  rawPrompt: string;
  targetEnvironment: TargetEnvironment;
  generationMode: GenerationMode;
  settings: Record<string, any>;
  systemPrompt: string;
  userPrompt: string;
  whatImproved: string[];
  assumptions: string[];
  unresolvedQuestions: string[];
  reviewReport: ReviewReport;
  requirements?: RequirementsAnalysis;
  architecturalDecisions?: SolutionArchitecture;
  modelsUsed?: string[];
  totalTokens: number;
  totalCostUsd: number | null;
  createdAt: string;
}

export interface JobEntity {
  id: string;
  projectId?: string;
  targetEnvironment: TargetEnvironment;
  generationMode: GenerationMode;
  status: JobStatus;
  currentStep?: string;
  intermediateResults?: any;
  errorMessage?: string;
  totalTokens: number;
  totalCostUsd: number | null;
  cancelRequested: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IDatabaseStorage {
  initialize(): Promise<void>;
  createProject(title: string): Promise<ProjectEntity>;
  getProject(id: string): Promise<ProjectEntity | null>;
  listProjects(search?: string): Promise<ProjectEntity[]>;
  updateProjectTitle(id: string, title: string): Promise<ProjectEntity | null>;
  deleteProject(id: string): Promise<boolean>;

  createVersion(data: Omit<VersionEntity, 'id' | 'createdAt'>): Promise<VersionEntity>;
  getVersionsForProject(projectId: string): Promise<VersionEntity[]>;
  getVersion(id: string): Promise<VersionEntity | null>;

  createJob(data: Omit<JobEntity, 'createdAt' | 'updatedAt'>): Promise<JobEntity>;
  getJob(id: string): Promise<JobEntity | null>;
  updateJob(id: string, updates: Partial<JobEntity>): Promise<JobEntity | null>;
  requestJobCancel(id: string): Promise<boolean>;

  getTemplates(): Promise<PromptTemplateDefinition[]>;
  saveTemplate(template: PromptTemplateDefinition): Promise<void>;

  recordMetric(metric: StageUsageMetric & { jobId: string }): Promise<void>;
}

// ==============================================================================
// In-Memory Storage Adapter (Always available for standalone / test environments)
// ==============================================================================

export class InMemoryStorage implements IDatabaseStorage {
  private projects: Map<string, ProjectEntity> = new Map();
  private versions: Map<string, VersionEntity> = new Map();
  private jobs: Map<string, JobEntity> = new Map();
  private templates: Map<string, PromptTemplateDefinition> = new Map();
  private metrics: any[] = [];

  async initialize(): Promise<void> {
    // Populate built-in templates
    for (const t of SYSTEM_PROMPT_TEMPLATES) {
      this.templates.set(t.id, { ...t });
    }
  }

  async createProject(title: string): Promise<ProjectEntity> {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const entity: ProjectEntity = { id, title, createdAt: now, updatedAt: now };
    this.projects.set(id, entity);
    return entity;
  }

  async getProject(id: string): Promise<ProjectEntity | null> {
    return this.projects.get(id) || null;
  }

  async listProjects(search?: string): Promise<ProjectEntity[]> {
    const list = Array.from(this.projects.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((p) => p.title.toLowerCase().includes(q));
  }

  async updateProjectTitle(id: string, title: string): Promise<ProjectEntity | null> {
    const proj = this.projects.get(id);
    if (!proj) return null;
    proj.title = title;
    proj.updatedAt = new Date().toISOString();
    this.projects.set(id, proj);
    return proj;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  async createVersion(data: Omit<VersionEntity, 'id' | 'createdAt'>): Promise<VersionEntity> {
    const id = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const entity: VersionEntity = { ...data, id, createdAt: now };
    this.versions.set(id, entity);

    // Update project updatedAt
    const proj = this.projects.get(data.projectId);
    if (proj) {
      proj.updatedAt = now;
      this.projects.set(proj.id, proj);
    }
    return entity;
  }

  async getVersionsForProject(projectId: string): Promise<VersionEntity[]> {
    return Array.from(this.versions.values())
      .filter((v) => v.projectId === projectId)
      .sort((a, b) => a.versionNumber - b.versionNumber);
  }

  async getVersion(id: string): Promise<VersionEntity | null> {
    return this.versions.get(id) || null;
  }

  async createJob(data: Omit<JobEntity, 'createdAt' | 'updatedAt'>): Promise<JobEntity> {
    const now = new Date().toISOString();
    const entity: JobEntity = { ...data, createdAt: now, updatedAt: now };
    this.jobs.set(data.id, entity);
    return entity;
  }

  async getJob(id: string): Promise<JobEntity | null> {
    return this.jobs.get(id) || null;
  }

  async updateJob(id: string, updates: Partial<JobEntity>): Promise<JobEntity | null> {
    const job = this.jobs.get(id);
    if (!job) return null;
    const updated: JobEntity = {
      ...job,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, updated);
    return updated;
  }

  async requestJobCancel(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.cancelRequested = true;
    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    this.jobs.set(id, job);
    return true;
  }

  async getTemplates(): Promise<PromptTemplateDefinition[]> {
    return Array.from(this.templates.values());
  }

  async saveTemplate(template: PromptTemplateDefinition): Promise<void> {
    this.templates.set(template.id, template);
  }

  async recordMetric(metric: StageUsageMetric & { jobId: string }): Promise<void> {
    this.metrics.push({ ...metric, createdAt: new Date().toISOString() });
  }
}

// ==============================================================================
// PostgreSQL Storage Implementation
// ==============================================================================

export class PostgresStorage implements IDatabaseStorage {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({
      connectionString,
      connectionTimeoutMillis: 3000,
    });
  }

  async initialize(): Promise<void> {
    // Run schema creation
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id VARCHAR(64) PRIMARY KEY,
          title TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS versions (
          id VARCHAR(64) PRIMARY KEY,
          project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          version_number INT NOT NULL,
          raw_prompt TEXT NOT NULL,
          target_environment VARCHAR(64) NOT NULL,
          generation_mode VARCHAR(64) NOT NULL,
          settings JSONB NOT NULL DEFAULT '{}',
          system_prompt TEXT NOT NULL,
          user_prompt TEXT NOT NULL,
          what_improved JSONB NOT NULL DEFAULT '[]',
          assumptions JSONB NOT NULL DEFAULT '[]',
          unresolved_questions JSONB NOT NULL DEFAULT '[]',
          review_report JSONB NOT NULL DEFAULT '{}',
          requirements JSONB,
          architectural_decisions JSONB,
          models_used JSONB NOT NULL DEFAULT '[]',
          total_tokens INT NOT NULL DEFAULT 0,
          total_cost_usd NUMERIC(10, 6),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS generation_jobs (
          id VARCHAR(64) PRIMARY KEY,
          project_id VARCHAR(64),
          target_environment VARCHAR(64) NOT NULL,
          generation_mode VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL,
          current_step TEXT,
          intermediate_results JSONB,
          error_message TEXT,
          total_tokens INT NOT NULL DEFAULT 0,
          total_cost_usd NUMERIC(10, 6),
          cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS prompt_templates (
          id VARCHAR(64) PRIMARY KEY,
          template_key VARCHAR(64) NOT NULL,
          level VARCHAR(32) NOT NULL,
          target_environment VARCHAR(64),
          version VARCHAR(32) NOT NULL,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          content TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS api_metrics (
          id SERIAL PRIMARY KEY,
          job_id VARCHAR(64) NOT NULL,
          stage VARCHAR(64) NOT NULL,
          model_id VARCHAR(64) NOT NULL,
          input_tokens INT NOT NULL,
          output_tokens INT NOT NULL,
          reasoning_tokens INT,
          cached_tokens INT,
          duration_ms INT NOT NULL,
          cost_usd NUMERIC(10, 6),
          attempts INT NOT NULL DEFAULT 1,
          status VARCHAR(32) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        -- Recovery policy: mark stale unfinished jobs as failed upon startup
        UPDATE generation_jobs
        SET status = 'failed', error_message = 'Job terminated due to server restart recovery policy'
        WHERE status IN ('queued', 'analyzing', 'architecting', 'composing', 'reviewing');
      `);

      // Seed built-in templates if not present
      for (const t of SYSTEM_PROMPT_TEMPLATES) {
        await client.query(
          `INSERT INTO prompt_templates (id, template_key, level, target_environment, version, name, description, content)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, name = EXCLUDED.name`,
          [t.id, t.templateKey, t.level, t.targetEnvironment || null, t.version, t.name, t.description, t.content]
        );
      }
    } finally {
      client.release();
    }
  }

  async createProject(title: string): Promise<ProjectEntity> {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const res = await this.pool.query(
      `INSERT INTO projects (id, title) VALUES ($1, $2) RETURNING id, title, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, title]
    );
    return res.rows[0];
  }

  async getProject(id: string): Promise<ProjectEntity | null> {
    const res = await this.pool.query(
      `SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt" FROM projects WHERE id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async listProjects(search?: string): Promise<ProjectEntity[]> {
    let query = `SELECT id, title, created_at AS "createdAt", updated_at AS "updatedAt" FROM projects`;
    const params: any[] = [];
    if (search) {
      query += ` WHERE LOWER(title) LIKE $1`;
      params.push(`%${search.toLowerCase()}%`);
    }
    query += ` ORDER BY updated_at DESC`;
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async updateProjectTitle(id: string, title: string): Promise<ProjectEntity | null> {
    const res = await this.pool.query(
      `UPDATE projects SET title = $2, updated_at = NOW() WHERE id = $1 RETURNING id, title, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [id, title]
    );
    return res.rows[0] || null;
  }

  async deleteProject(id: string): Promise<boolean> {
    const res = await this.pool.query(`DELETE FROM projects WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  async createVersion(data: Omit<VersionEntity, 'id' | 'createdAt'>): Promise<VersionEntity> {
    const id = `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const res = await this.pool.query(
      `INSERT INTO versions (
        id, project_id, version_number, raw_prompt, target_environment, generation_mode,
        settings, system_prompt, user_prompt, what_improved, assumptions, unresolved_questions,
        review_report, requirements, architectural_decisions, models_used, total_tokens, total_cost_usd
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        id,
        data.projectId,
        data.versionNumber,
        data.rawPrompt,
        data.targetEnvironment,
        data.generationMode,
        JSON.stringify(data.settings),
        data.systemPrompt,
        data.userPrompt,
        JSON.stringify(data.whatImproved),
        JSON.stringify(data.assumptions),
        JSON.stringify(data.unresolvedQuestions),
        JSON.stringify(data.reviewReport),
        data.requirements ? JSON.stringify(data.requirements) : null,
        data.architecturalDecisions ? JSON.stringify(data.architecturalDecisions) : null,
        JSON.stringify(data.modelsUsed || []),
        data.totalTokens,
        data.totalCostUsd,
      ]
    );

    await this.pool.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [data.projectId]);

    const row = res.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      versionNumber: row.version_number,
      rawPrompt: row.raw_prompt,
      targetEnvironment: row.target_environment,
      generationMode: row.generation_mode,
      settings: row.settings,
      systemPrompt: row.system_prompt,
      userPrompt: row.user_prompt,
      whatImproved: row.what_improved,
      assumptions: row.assumptions,
      unresolvedQuestions: row.unresolved_questions,
      reviewReport: row.review_report,
      requirements: row.requirements,
      architecturalDecisions: row.architectural_decisions,
      modelsUsed: row.models_used,
      totalTokens: row.total_tokens,
      totalCostUsd: row.total_cost_usd ? parseFloat(row.total_cost_usd) : null,
      createdAt: row.created_at,
    };
  }

  async getVersionsForProject(projectId: string): Promise<VersionEntity[]> {
    const res = await this.pool.query(
      `SELECT * FROM versions WHERE project_id = $1 ORDER BY version_number ASC`,
      [projectId]
    );
    return res.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      versionNumber: row.version_number,
      rawPrompt: row.raw_prompt,
      targetEnvironment: row.target_environment,
      generationMode: row.generation_mode,
      settings: row.settings,
      systemPrompt: row.system_prompt,
      userPrompt: row.user_prompt,
      whatImproved: row.what_improved,
      assumptions: row.assumptions,
      unresolvedQuestions: row.unresolved_questions,
      reviewReport: row.review_report,
      requirements: row.requirements,
      architecturalDecisions: row.architectural_decisions,
      modelsUsed: row.models_used,
      totalTokens: row.total_tokens,
      totalCostUsd: row.total_cost_usd ? parseFloat(row.total_cost_usd) : null,
      createdAt: row.created_at,
    }));
  }

  async getVersion(id: string): Promise<VersionEntity | null> {
    const res = await this.pool.query(`SELECT * FROM versions WHERE id = $1`, [id]);
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      versionNumber: row.version_number,
      rawPrompt: row.raw_prompt,
      targetEnvironment: row.target_environment,
      generationMode: row.generation_mode,
      settings: row.settings,
      systemPrompt: row.system_prompt,
      userPrompt: row.user_prompt,
      whatImproved: row.what_improved,
      assumptions: row.assumptions,
      unresolvedQuestions: row.unresolved_questions,
      reviewReport: row.review_report,
      requirements: row.requirements,
      architecturalDecisions: row.architectural_decisions,
      modelsUsed: row.models_used,
      totalTokens: row.total_tokens,
      totalCostUsd: row.total_cost_usd ? parseFloat(row.total_cost_usd) : null,
      createdAt: row.created_at,
    };
  }

  async createJob(data: Omit<JobEntity, 'createdAt' | 'updatedAt'>): Promise<JobEntity> {
    const res = await this.pool.query(
      `INSERT INTO generation_jobs (
        id, project_id, target_environment, generation_mode, status, current_step,
        intermediate_results, error_message, total_tokens, total_cost_usd, cancel_requested
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        data.id,
        data.projectId || null,
        data.targetEnvironment,
        data.generationMode,
        data.status,
        data.currentStep || null,
        data.intermediateResults ? JSON.stringify(data.intermediateResults) : null,
        data.errorMessage || null,
        data.totalTokens,
        data.totalCostUsd,
        data.cancelRequested,
      ]
    );
    const row = res.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      targetEnvironment: row.target_environment,
      generationMode: row.generation_mode,
      status: row.status,
      currentStep: row.current_step,
      intermediateResults: row.intermediate_results,
      errorMessage: row.error_message,
      totalTokens: row.total_tokens,
      totalCostUsd: row.total_cost_usd ? parseFloat(row.total_cost_usd) : null,
      cancelRequested: row.cancel_requested,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getJob(id: string): Promise<JobEntity | null> {
    const res = await this.pool.query(`SELECT * FROM generation_jobs WHERE id = $1`, [id]);
    if (!res.rows[0]) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      projectId: row.project_id,
      targetEnvironment: row.target_environment,
      generationMode: row.generation_mode,
      status: row.status,
      currentStep: row.current_step,
      intermediateResults: row.intermediate_results,
      errorMessage: row.error_message,
      totalTokens: row.total_tokens,
      totalCostUsd: row.total_cost_usd ? parseFloat(row.total_cost_usd) : null,
      cancelRequested: row.cancel_requested,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async updateJob(id: string, updates: Partial<JobEntity>): Promise<JobEntity | null> {
    const current = await this.getJob(id);
    if (!current) return null;

    const merged = { ...current, ...updates };
    await this.pool.query(
      `UPDATE generation_jobs SET
        status = $2, current_step = $3, intermediate_results = $4, error_message = $5,
        total_tokens = $6, total_cost_usd = $7, cancel_requested = $8, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        merged.status,
        merged.currentStep || null,
        merged.intermediateResults ? JSON.stringify(merged.intermediateResults) : null,
        merged.errorMessage || null,
        merged.totalTokens,
        merged.totalCostUsd,
        merged.cancelRequested,
      ]
    );
    return this.getJob(id);
  }

  async requestJobCancel(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE generation_jobs SET cancel_requested = TRUE, status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async getTemplates(): Promise<PromptTemplateDefinition[]> {
    const res = await this.pool.query(`SELECT * FROM prompt_templates ORDER BY level, template_key`);
    return res.rows.map((row) => ({
      id: row.id,
      templateKey: row.template_key,
      level: row.level,
      targetEnvironment: row.target_environment || undefined,
      version: row.version,
      name: row.name,
      description: row.description,
      content: row.content,
    }));
  }

  async saveTemplate(template: PromptTemplateDefinition): Promise<void> {
    await this.pool.query(
      `INSERT INTO prompt_templates (id, template_key, level, target_environment, version, name, description, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, description = EXCLUDED.description, content = EXCLUDED.content, version = EXCLUDED.version, updated_at = NOW()`,
      [
        template.id,
        template.templateKey,
        template.level,
        template.targetEnvironment || null,
        template.version,
        template.name,
        template.description,
        template.content,
      ]
    );
  }

  async recordMetric(metric: StageUsageMetric & { jobId: string }): Promise<void> {
    await this.pool.query(
      `INSERT INTO api_metrics (job_id, stage, model_id, input_tokens, output_tokens, reasoning_tokens, cached_tokens, duration_ms, cost_usd, attempts, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        metric.jobId,
        metric.stage,
        metric.modelId,
        metric.inputTokens,
        metric.outputTokens,
        metric.reasoningTokens || null,
        metric.cachedInputTokens || null,
        metric.durationMs,
        metric.costUsd,
        metric.attempts,
        metric.status,
      ]
    );
  }
}

// Storage instance factory
let activeStorage: IDatabaseStorage | null = null;

export async function getStorage(): Promise<IDatabaseStorage> {
  if (activeStorage) return activeStorage;

  const config = getConfig();

  // Try Postgres if configured
  if (config.DATABASE_URL && !config.DATABASE_URL.includes('mock')) {
    try {
      const pgStorage = new PostgresStorage(config.DATABASE_URL);
      await pgStorage.initialize();
      activeStorage = pgStorage;
      return activeStorage;
    } catch (err: any) {
      console.warn(`[DATABASE] Could not connect to PostgreSQL (${err.message}). Using in-memory database storage fallback.`);
    }
  }

  // Fallback to in-memory adapter
  const mem = new InMemoryStorage();
  await mem.initialize();
  activeStorage = mem;
  return activeStorage;
}

export function setStorageForTesting(storage: IDatabaseStorage): void {
  activeStorage = storage;
}
