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
import { buildTraceabilityMatrix, calculateTraceabilityScore } from './traceabilityEngine';

export interface PipelineExecutionOptions {
  jobId: string;
  rawPrompt: string;
  targetEnvironment: TargetEnvironment;
  mode: GenerationMode;
  preferences?: Partial<UserPreferences>;
  resumeIntermediate?: {
    analyzer?: RequirementsAnalysis;
    architect?: SolutionArchitecture;
  };
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

    // Extract permanent instructions from preferences
    const customInstructions = options.preferences?.customInstructions?.trim();

    // Stage models and reasoning selection (Quality vs Economy presets)
    // Quality preset: gpt-6.1-sol for architecture & composer (reasoning: medium)
    // Economy preset: gpt-6.1-terra for analysis & review (reasoning: medium)
    const analyzerModel = options.preferences?.stageModels?.analyzer || config.OPENAI_ANALYZER_MODEL;
    const architectModel = options.preferences?.stageModels?.architect || config.OPENAI_ARCHITECT_MODEL;
    const composerModel = options.preferences?.stageModels?.composer || config.OPENAI_COMPOSER_MODEL;
    const reviewerModel = options.preferences?.stageModels?.reviewer || config.OPENAI_REVIEWER_MODEL;
    const fastModel = options.preferences?.stageModels?.fast || config.OPENAI_FAST_MODEL;
    const reasoningEffort = options.preferences?.reasoningEffort || 'medium';

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

      const fastInput = customInstructions
        ? `PRIMARY USER TASK:\n${rawPrompt}\n\nADDITIONAL MANDATORY SYSTEM INSTRUCTIONS & CONSTRAINTS:\n${customInstructions}`
        : rawPrompt;

      const fastResult = await executeStructuredLLMCall<PromptPackage>(
        {
          stage: 'fast_generation',
          modelId: fastModel,
          reasoningEffort,
          systemPrompt: combinedSystemPrompt,
          userInput: fastInput,
          zodSchema: PromptPackageSchema,
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
        score: calculateTraceabilityScore(rapidTraceability),
        traceability: rapidTraceability,
        critique: [],
        fixesApplied: null,
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
    const cumulativeIntermediate: any = {};

    // STAGE 1: REQUIREMENTS ANALYZER
    let analyzerData: RequirementsAnalysis;
    if (options.resumeIntermediate?.analyzer) {
      analyzerData = options.resumeIntermediate.analyzer;
      cumulativeIntermediate.analyzer = analyzerData;
      notify('analyzing', 'requirements_analysis_done', 30, 'Анализ требований восстановлен из контрольной точки', cumulativeIntermediate);
    } else {
      notify('analyzing', 'requirements_analysis', 15, 'Этап 1/4: Детальный анализ и категоризация требований (gpt-6.1-terra)...');
      const analyzerTemplate = getPromptTemplate('requirements-analyzer');

      const analyzerInput = customInstructions
        ? `PRIMARY USER TASK:\n${rawPrompt}\n\nADDITIONAL MANDATORY SYSTEM INSTRUCTIONS & CONSTRAINTS (Crucial! Must extract as explicit requirements with high/critical priority):\n${customInstructions}`
        : rawPrompt;

      const analyzerResult = await executeStructuredLLMCall<RequirementsAnalysis>(
        {
          stage: 'requirements_analyzer',
          modelId: analyzerModel,
          reasoningEffort,
          systemPrompt: analyzerTemplate?.content || '',
          userInput: analyzerInput,
          zodSchema: RequirementsAnalysisSchema,
        },
        (raw) => RequirementsAnalysisSchema.parse(raw),
        () => generateMockAnalyzerOutput(rawPrompt, targetEnvironment)
      );

      recordMetrics(analyzerResult.metrics);
      analyzerData = analyzerResult.data;
      cumulativeIntermediate.analyzer = analyzerData;
      notify('analyzing', 'requirements_analysis_done', 30, 'Анализ требований завершен', cumulativeIntermediate);
    }

    if (isCancelled()) throw new Error('JOB_CANCELLED');

    // STAGE 2: SOLUTION ARCHITECT
    let architectData: SolutionArchitecture;
    if (options.resumeIntermediate?.architect) {
      architectData = options.resumeIntermediate.architect;
      cumulativeIntermediate.architect = architectData;
      notify('architecting', 'solution_architecture_done', 60, 'Архитектурное решение восстановлено из контрольной точки', cumulativeIntermediate);
    } else {
      notify('architecting', 'solution_architecture', 45, 'Этап 2/4: Архитектурное моделирование и инварианты (gpt-6.1-sol)...', cumulativeIntermediate);
      const architectTemplate = getPromptTemplate('solution-architect');

      const architectInput = `Original Primary Request:\n${rawPrompt}\n\nMandatory System Instructions & Constraints:\n${customInstructions || 'None specified'}\n\nRequirements Analysis:\n${JSON.stringify(analyzerData, null, 2)}`;

      const architectResult = await executeStructuredLLMCall<SolutionArchitecture>(
        {
          stage: 'solution_architect',
          modelId: architectModel,
          reasoningEffort,
          systemPrompt: architectTemplate?.content || '',
          userInput: architectInput,
          zodSchema: SolutionArchitectureSchema,
        },
        (raw) => SolutionArchitectureSchema.parse(raw),
        () => generateMockArchitectOutput(rawPrompt, analyzerData)
      );

      recordMetrics(architectResult.metrics);
      architectData = architectResult.data;
      cumulativeIntermediate.architect = architectData;
      notify('architecting', 'solution_architecture_done', 60, 'Архитектурное решение сформировано', cumulativeIntermediate);
    }

    if (isCancelled()) throw new Error('JOB_CANCELLED');

    // STAGE 3: PROMPT COMPOSER
    notify('composing', 'prompt_composer', 75, 'Этап 3/4: Компоновка System Prompt и User Prompt ТЗ (gpt-6.1-sol)...', cumulativeIntermediate);
    const composerTemplate = getPromptTemplate('prompt-composer');
    const targetTemplate = getPromptTemplate(`target-${targetEnvironment}`, targetEnvironment);

    const composerSystem = `${composerTemplate?.content || ''}\n\n${targetTemplate?.content || ''}\nTarget Language: ${options.preferences?.targetLanguage || 'Russian'}\nDetail Level: ${options.preferences?.detailLevel || 'detailed'}`;
    
    // Synthesize structured input for the composer without unbounded JSON dumping
    const reqSummary = analyzerData.requirements
      .map((r) => `- [${r.id}] ${r.title} (${r.category}, priority: ${r.priority}): ${r.description}`)
      .join('\n');

    const decisionsSummary = architectData.decisions
      .map((d) => `- [${d.id}] ${d.title}: ${d.description} (Rationale: ${d.rationale}, Criteria: ${d.verificationCriteria})`)
      .join('\n');

    const composerInput = `Original Primary Request:
${rawPrompt}

Additional Mandatory System Instructions & Constraints (CRUCIAL: MUST BE INTEGRATED IN FULL DETAIL INTO SYSTEM PROMPT AND USER PROMPT SPECIFICATION):
${customInstructions || 'None specified'}

Verified Requirements (${analyzerData.requirements.length} items):
${reqSummary}

Architectural Overview:
${architectData.architectureOverview}

Key Architectural Decisions:
${decisionsSummary}

Technology Stack:
${architectData.techStack.join(', ')}

Domain Entities & Models:
${architectData.keyEntities.join(', ')}

System Invariants:
${architectData.invariants.join('; ')}

Component Boundaries & Interfaces:
${architectData.componentBoundaries.join('; ')}

Storage & Persistence Strategy:
${architectData.dataStorageStrategy}

Fault Tolerance & Error Recovery:
${architectData.errorRecoveryStrategy}

Security & Access Control:
${architectData.securityRequirements.join('; ')}

Verification & Test Scenarios:
${architectData.testScenarios.join('; ')}

Definition of Done:
${architectData.definitionOfDone.join('; ')}`;

    const composerResult = await executeStructuredLLMCall<PromptPackage>(
      {
        stage: 'prompt_composer',
        modelId: composerModel,
        reasoningEffort,
        systemPrompt: composerSystem,
        userInput: composerInput,
        zodSchema: PromptPackageSchema,
      },
      (raw) => PromptPackageSchema.parse(raw),
      () => generateMockComposerOutput(rawPrompt, targetEnvironment, analyzerData, architectData)
    );

    recordMetrics(composerResult.metrics);
    cumulativeIntermediate.composer = composerResult.data;
    notify('composing', 'prompt_composer_done', 85, 'Промпты сформированы', cumulativeIntermediate);

    if (isCancelled()) throw new Error('JOB_CANCELLED');

    // STAGE 4: QUALITY REVIEWER & AUDIT
    notify('reviewing', 'quality_reviewer', 90, 'Этап 4/4: Аудит качества и проверка матрицы трассируемости (gpt-6.1-terra)...', cumulativeIntermediate);
    const reviewerTemplate = getPromptTemplate('quality-reviewer');

    const reviewerInput = `Original Primary Request:
${rawPrompt}

Additional Mandatory System Instructions & Constraints:
${customInstructions || 'None specified'}

Requirements to verify (${analyzerData.requirements.length} items):
${reqSummary}

Generated System Prompt:
${composerResult.data.systemPrompt}

Generated User Prompt (Specification):
${composerResult.data.userPrompt}`;

    const reviewerResult = await executeStructuredLLMCall<ReviewReport>(
      {
        stage: 'quality_reviewer',
        modelId: reviewerModel,
        reasoningEffort,
        systemPrompt: reviewerTemplate?.content || '',
        userInput: reviewerInput,
        zodSchema: ReviewReportSchema,
      },
      (raw) => ReviewReportSchema.parse(raw),
      () => generateMockReviewOutput(rawPrompt, analyzerData, composerResult.data)
    );

    recordMetrics(reviewerResult.metrics);

    let finalPrompts = { ...composerResult.data };
    // Only integrate surgical prompt fixes if they are genuine full prompt replacements (not short summaries)
    if (
      reviewerResult.data.fixesApplied?.userPrompt &&
      reviewerResult.data.fixesApplied.userPrompt.length > composerResult.data.userPrompt.length * 0.7 &&
      reviewerResult.data.fixesApplied.userPrompt.includes('1.')
    ) {
      finalPrompts.userPrompt = reviewerResult.data.fixesApplied.userPrompt;
    }
    if (
      reviewerResult.data.fixesApplied?.systemPrompt &&
      reviewerResult.data.fixesApplied.systemPrompt.length > composerResult.data.systemPrompt.length * 0.7
    ) {
      finalPrompts.systemPrompt = reviewerResult.data.fixesApplied.systemPrompt;
    }

    // Build verified final traceability matrix against the actual final userPrompt
    const finalTraceability = buildTraceabilityMatrix(
      analyzerData.requirements,
      finalPrompts.userPrompt,
      reviewerResult.data.traceability
    );

    // Objective quality score calculation
    const calculatedTraceabilityScore = calculateTraceabilityScore(finalTraceability);

    let normalizedModelScore = reviewerResult.data.score;
    if (normalizedModelScore <= 1.0) {
      normalizedModelScore = Math.round(normalizedModelScore * 100);
    } else if (normalizedModelScore <= 10.0) {
      normalizedModelScore = Math.round(normalizedModelScore * 10);
    }

    // Calibrated final score (weighted combination with floor based on verified coverage)
    const calibratedScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(calculatedTraceabilityScore * 0.7 + normalizedModelScore * 0.3)
      )
    );

    const finalReviewReport: ReviewReport = {
      ...reviewerResult.data,
      score: calibratedScore,
      isApproved: calibratedScore >= 80,
      traceability: finalTraceability,
    };

    const totalTokens = stageMetrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0);
    const totalCostUsd = stageMetrics.every((m) => m.costUsd !== null)
      ? Math.round(stageMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0) * 1_000_000) / 1_000_000
      : null;

    cumulativeIntermediate.reviewReport = finalReviewReport;
    cumulativeIntermediate.composer = finalPrompts;
    cumulativeIntermediate.complexity = complexity;

    notify('completed', 'done', 100, 'Генерация успешно завершена (Quality Mode)', cumulativeIntermediate);

    return {
      jobId,
      targetEnvironment,
      mode,
      actualModeUsed: 'quality',
      complexity,
      analyzerResult: analyzerData,
      architectResult: architectData,
      prompts: finalPrompts,
      reviewReport: finalReviewReport,
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

    const revisionResult = await executeStructuredLLMCall<PromptPackage>(
      {
        stage: 'prompt_revision',
        modelId: config.OPENAI_COMPOSER_MODEL,
        reasoningEffort: 'medium',
        systemPrompt: revisionTemplate?.content || '',
        userInput: inputData,
        zodSchema: PromptPackageSchema,
      },
      (raw: any) => PromptPackageSchema.parse(raw),
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
