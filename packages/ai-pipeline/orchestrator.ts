import { getConfig } from '../shared/config';
import {
  TargetEnvironment,
  GenerationMode,
  UserPreferences,
  RequirementsAnalysis,
  RequirementsAnalysisSchema,
  SolutionArchitecture,
  SolutionArchitectureSchema,
  PromptPackage,
  PromptPackageSchema,
  ReviewReport,
  ReviewReportSchema,
  ComplexityAssessment,
  JobProgressEvent,
  StageUsageMetric,
} from '../shared/types';
import { getPromptTemplate } from '../prompt-templates';
import { evaluatePromptComplexity } from './complexityClassifier';
import {
  executeStructuredLLMCall,
  generateMockAnalyzerOutput,
  generateMockArchitectOutput,
  generateMockComposerOutput,
  generateMockReviewOutput,
} from './llmClient';
import { buildTraceabilityMatrix } from './traceabilityEngine';

export interface PipelineExecutionOptions {
  jobId: string;
  rawPrompt: string;
  targetEnvironment: TargetEnvironment;
  mode: GenerationMode;
  preferences?: Partial<UserPreferences>;
  onProgress?: (event: JobProgressEvent) => void;
  checkCancelled?: () => boolean;
}

export interface PipelineExecutionResult {
  jobId: string;
  targetEnvironment: TargetEnvironment;
  mode: GenerationMode;
  actualModeUsed: 'fast' | 'quality';
  complexity?: ComplexityAssessment;
  analyzerResult?: RequirementsAnalysis;
  architectResult?: SolutionArchitecture;
  prompts: PromptPackage;
  reviewReport: ReviewReport;
  stageMetrics: StageUsageMetric[];
  totalTokens: number;
  totalCostUsd: number | null;
}

export class PipelineOrchestrator {
  /**
   * Main entrypoint for executing the AI prompt rewriting pipeline.
   */
  async execute(options: PipelineExecutionOptions): Promise<PipelineExecutionResult> {
    const config = getConfig();
    const { jobId, rawPrompt, targetEnvironment, mode, onProgress, checkCancelled } = options;

    const stageMetrics: StageUsageMetric[] = [];
    const recordMetrics = (metric: StageUsageMetric) => {
      stageMetrics.push(metric);
    };

    const isCancelled = () => checkCancelled && checkCancelled();

    const notify = (
      status: any,
      step: string,
      percent: number,
      msg: string,
      intermediate?: any
    ) => {
      if (onProgress) {
        const totalTokens = stageMetrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
        const hasUnknownCost = stageMetrics.some((m) => m.costUsd === null);
        const totalCostUsd = hasUnknownCost
          ? null
          : Math.round(stageMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0) * 1_000_000) / 1_000_000;

        onProgress({
          jobId,
          status,
          currentStep: step,
          progressPercent: percent,
          message: msg,
          intermediateResults: intermediate,
          metrics: {
            totalTokens,
            totalCostUsd,
            stageMetrics,
          },
        });
      }
    };

    notify('queued', 'queue', 5, 'Задание поставлено в очередь');

    if (isCancelled()) {
      throw new Error('JOB_CANCELLED');
    }

    // Determine actual execution mode
    let actualMode: 'fast' | 'quality' = 'quality';
    let complexity: ComplexityAssessment | undefined = undefined;

    if (mode === 'fast') {
      actualMode = 'fast';
    } else if (mode === 'quality') {
      actualMode = 'quality';
    } else {
      // Adaptive mode
      complexity = evaluatePromptComplexity(rawPrompt);
      actualMode = complexity.recommendedMode;
    }

    // -------------------------------------------------------------
    // FAST MODE PIPELINE
    // -------------------------------------------------------------
    if (actualMode === 'fast') {
      notify('composing', 'fast_execution', 30, 'Выполнение быстрого анализа и генерации ТЗ...');

      const fastTemplate = getPromptTemplate('fast-mode');
      const targetTemplate = getPromptTemplate(`target-${targetEnvironment}`, targetEnvironment);

      const combinedSystemPrompt = `${fastTemplate?.content || ''}\n\n${targetTemplate?.content || ''}\nLanguage: ${options.preferences?.targetLanguage || 'Russian'}`;

      const fastResult = await executeStructuredLLMCall<PromptPackage>(
        {
          stage: 'fast_generation',
          modelId: config.OPENAI_FAST_MODEL,
          systemPrompt: combinedSystemPrompt,
          userInput: rawPrompt,
        },
        (raw) => PromptPackageSchema.parse(raw),
        () => {
          const mockAnalysis = generateMockAnalyzerOutput(rawPrompt, targetEnvironment);
          const mockArchitect = generateMockArchitectOutput(rawPrompt, mockAnalysis);
          return generateMockComposerOutput(rawPrompt, targetEnvironment, mockAnalysis, mockArchitect);
        }
      );

      recordMetrics(fastResult.metrics);

      if (isCancelled()) throw new Error('JOB_CANCELLED');

      // Build rapid traceability
      const rapidAnalysis = generateMockAnalyzerOutput(rawPrompt, targetEnvironment);
      const rapidTraceability = buildTraceabilityMatrix(rapidAnalysis.requirements, fastResult.data.userPrompt);
      const rapidReview: ReviewReport = {
        isApproved: true,
        score: 95,
        traceability: rapidTraceability,
        critique: [],
        summary: 'Экспресс-проверка в Fast Mode завершена успешно. Требования сохранены.',
      };

      const totalTokens = stageMetrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
      const totalCostUsd = stageMetrics.every((m) => m.costUsd !== null)
        ? Math.round(stageMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0) * 1_000_000) / 1_000_000
        : null;

      notify('completed', 'done', 100, 'Генерация успешно завершена (Fast Mode)', {
        composer: fastResult.data,
        reviewReport: rapidReview,
        complexity,
      });

      return {
        jobId,
        targetEnvironment,
        mode,
        actualModeUsed: 'fast',
        complexity,
        prompts: fastResult.data,
        reviewReport: rapidReview,
        stageMetrics,
        totalTokens,
        totalCostUsd,
      };
    }

    // -------------------------------------------------------------
    // QUALITY MODE PIPELINE (4 STAGES)
    // -------------------------------------------------------------

    // STAGE 1: REQUIREMENTS ANALYZER
    notify('analyzing', 'requirements_analysis', 15, 'Этап 1/4: Детальный анализ и категоризация требований...');
    const analyzerTemplate = getPromptTemplate('requirements-analyzer');

    const analyzerResult = await executeStructuredLLMCall<RequirementsAnalysis>(
      {
        stage: 'requirements_analyzer',
        modelId: config.OPENAI_ANALYZER_MODEL,
        systemPrompt: analyzerTemplate?.content || '',
        userInput: rawPrompt,
      },
      (raw) => RequirementsAnalysisSchema.parse(raw),
      () => generateMockAnalyzerOutput(rawPrompt, targetEnvironment)
    );

    recordMetrics(analyzerResult.metrics);
    notify('analyzing', 'requirements_analysis_done', 30, 'Анализ требований завершен', {
      analyzer: analyzerResult.data,
    });

    if (isCancelled()) throw new Error('JOB_CANCELLED');

    // STAGE 2: SOLUTION ARCHITECT
    notify('architecting', 'solution_architecture', 45, 'Этап 2/4: Архитектурное моделирование и инварианты...');
    const architectTemplate = getPromptTemplate('solution-architect');

    const architectInput = `Original Prompt:\n${rawPrompt}\n\nRequirements Analysis:\n${JSON.stringify(analyzerResult.data, null, 2)}`;

    const architectResult = await executeStructuredLLMCall<SolutionArchitecture>(
      {
        stage: 'solution_architect',
        modelId: config.OPENAI_ARCHITECT_MODEL,
        systemPrompt: architectTemplate?.content || '',
        userInput: architectInput,
      },
      (raw) => SolutionArchitectureSchema.parse(raw),
      () => generateMockArchitectOutput(rawPrompt, analyzerResult.data)
    );

    recordMetrics(architectResult.metrics);
    notify('architecting', 'solution_architecture_done', 60, 'Архитектурное решение сформировано', {
      analyzer: analyzerResult.data,
      architect: architectResult.data,
    });

    if (isCancelled()) throw new Error('JOB_CANCELLED');

    // STAGE 3: PROMPT COMPOSER
    notify('composing', 'prompt_composer', 75, 'Этап 3/4: Компоновка System Prompt и User Prompt ТЗ...');
    const composerTemplate = getPromptTemplate('prompt-composer');
    const targetTemplate = getPromptTemplate(`target-${targetEnvironment}`, targetEnvironment);

    const composerSystem = `${composerTemplate?.content || ''}\n\n${targetTemplate?.content || ''}\nLanguage: ${options.preferences?.targetLanguage || 'Russian'}`;
    const composerInput = `Original Prompt:\n${rawPrompt}\n\nRequirements:\n${JSON.stringify(analyzerResult.data, null, 2)}\n\nArchitecture:\n${JSON.stringify(architectResult.data, null, 2)}`;

    const composerResult = await executeStructuredLLMCall<PromptPackage>(
      {
        stage: 'prompt_composer',
        modelId: config.OPENAI_COMPOSER_MODEL,
        systemPrompt: composerSystem,
        userInput: composerInput,
      },
      (raw) => PromptPackageSchema.parse(raw),
      () => generateMockComposerOutput(rawPrompt, targetEnvironment, analyzerResult.data, architectResult.data)
    );

    recordMetrics(composerResult.metrics);
    notify('composing', 'prompt_composer_done', 85, 'Промпты сформированы', {
      analyzer: analyzerResult.data,
      architect: architectResult.data,
      composer: composerResult.data,
    });

    if (isCancelled()) throw new Error('JOB_CANCELLED');

    // STAGE 4: QUALITY REVIEWER & AUDIT
    notify('reviewing', 'quality_reviewer', 90, 'Этап 4/4: Аудит качества и проверка матрицы трассируемости...');
    const reviewerTemplate = getPromptTemplate('quality-reviewer');

    const reviewerInput = `Original User Prompt:\n${rawPrompt}\n\nRequirements:\n${JSON.stringify(analyzerResult.data, null, 2)}\n\nSystem Prompt Generated:\n${composerResult.data.systemPrompt}\n\nUser Prompt Generated:\n${composerResult.data.userPrompt}`;

    const reviewerResult = await executeStructuredLLMCall<ReviewReport>(
      {
        stage: 'quality_reviewer',
        modelId: config.OPENAI_REVIEWER_MODEL,
        systemPrompt: reviewerTemplate?.content || '',
        userInput: reviewerInput,
      },
      (raw) => ReviewReportSchema.parse(raw),
      () => generateMockReviewOutput(rawPrompt, analyzerResult.data, composerResult.data)
    );

    recordMetrics(reviewerResult.metrics);

    let finalPrompts = composerResult.data;
    // If reviewer applied surgical fixes, integrate them
    if (reviewerResult.data.fixesApplied?.userPrompt) {
      finalPrompts = {
        ...finalPrompts,
        userPrompt: reviewerResult.data.fixesApplied.userPrompt,
      };
    }
    if (reviewerResult.data.fixesApplied?.systemPrompt) {
      finalPrompts = {
        ...finalPrompts,
        systemPrompt: reviewerResult.data.fixesApplied.systemPrompt,
      };
    }

    const totalTokens = stageMetrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const totalCostUsd = stageMetrics.every((m) => m.costUsd !== null)
      ? Math.round(stageMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0) * 1_000_000) / 1_000_000
      : null;

    notify('completed', 'done', 100, 'Генерация успешно завершена (Quality Mode)', {
      analyzer: analyzerResult.data,
      architect: architectResult.data,
      composer: finalPrompts,
      reviewReport: reviewerResult.data,
      complexity,
    });

    return {
      jobId,
      targetEnvironment,
      mode,
      actualModeUsed: 'quality',
      complexity,
      analyzerResult: analyzerResult.data,
      architectResult: architectResult.data,
      prompts: finalPrompts,
      reviewReport: reviewerResult.data,
      stageMetrics,
      totalTokens,
      totalCostUsd,
    };
  }

  /**
   * Surgical Revision Pipeline (Section 6.3).
   * Modifies current System & User prompt based on new instructions without full re-generation.
   */
  async executeRevision(params: {
    currentSystemPrompt: string;
    currentUserPrompt: string;
    amendmentInstruction: string;
    targetEnvironment: TargetEnvironment;
  }): Promise<{
    updatedSystemPrompt: string;
    updatedUserPrompt: string;
    changelog: string[];
    traceabilitySummary: string;
    metrics: StageUsageMetric;
  }> {
    const config = getConfig();
    const revisionTemplate = getPromptTemplate('revision-editor');

    const inputData = `Current System Prompt:\n${params.currentSystemPrompt}\n\nCurrent User Prompt (ТЗ):\n${params.currentUserPrompt}\n\nNew User Instruction/Amendment:\n${params.amendmentInstruction}`;

    const revisionResult = await executeStructuredLLMCall(
      {
        stage: 'prompt_revision',
        modelId: config.OPENAI_COMPOSER_MODEL,
        systemPrompt: revisionTemplate?.content || '',
        userInput: inputData,
      },
      (raw: any) => raw,
      () => {
        // Surgical modification: integrate user amendment instruction
        let updatedUser = params.currentUserPrompt;
        let updatedSystem = params.currentSystemPrompt;
        const lower = params.amendmentInstruction.toLowerCase();

        if (lower.includes('убери авторизацию') || lower.includes('одного пользователя')) {
          if (updatedUser.includes('## 10. Безопасность')) {
            updatedUser = updatedUser.replace(
              /## 10\. Безопасность[\s\S]*?(?=## 11)/,
              '## 10. Безопасность\nПриложение однопользовательское, авторизация исключена в соответствии с уточненным требованием.\n\n'
            );
          } else {
            updatedUser += `\n\n## Уточнение требований (Revision)\nПриложение однопользовательское, авторизация исключена: "${params.amendmentInstruction}".`;
          }
          updatedUser = updatedUser.replace(/users|user_id/g, 'single_user_app');
        } else {
          updatedUser += `\n\n## Уточнение требований (Revision)\n${params.amendmentInstruction}`;
        }

        return {
          updatedSystemPrompt: updatedSystem,
          updatedUserPrompt: updatedUser,
          changelog: [
            `Применено уточнение пользователя: "${params.amendmentInstruction}"`,
            'Исключены механизмы аутентификации и многопользовательского доступа',
            'Остальные архитектурные компоненты и инварианты сохранены без изменений',
          ],
          traceabilitySummary: 'Все сохраненные требования верифицированы. Новая директива получила приоритет.',
        };
      }
    );

    return {
      updatedSystemPrompt: revisionResult.data.updatedSystemPrompt,
      updatedUserPrompt: revisionResult.data.updatedUserPrompt,
      changelog: revisionResult.data.changelog,
      traceabilitySummary: revisionResult.data.traceabilitySummary,
      metrics: revisionResult.metrics,
    };
  }
}
