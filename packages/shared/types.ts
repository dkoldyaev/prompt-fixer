import { z } from 'zod';

export type TargetEnvironment =
  | 'google-antigravity'
  | 'claude-code'
  | 'cursor'
  | 'universal-agent'
  | 'generic-llm';

export type GenerationMode = 'fast' | 'quality' | 'adaptive';

export type DetailLevel = 'concise' | 'standard' | 'detailed';

export type JobStatus =
  | 'queued'
  | 'analyzing'
  | 'architecting'
  | 'composing'
  | 'reviewing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RequirementSource = 'explicit' | 'inferred' | 'proposed';
export type Criticality = 'critical' | 'high' | 'medium' | 'low';
export type RequirementCategory =
  | 'functional'
  | 'non_functional'
  | 'technical_constraint'
  | 'ux'
  | 'security'
  | 'infrastructure'
  | 'prohibition'
  | 'invariant';

export type CoverageStatus = 'covered' | 'partially_covered' | 'missing' | 'conflicting';

// -------------------------------------------------------------
// Requirements Schema
// -------------------------------------------------------------
export const RequirementItemSchema = z.object({
  id: z.string(), // e.g. "REQ-001"
  source: z.enum(['explicit', 'inferred', 'proposed']),
  category: z.enum([
    'functional',
    'non_functional',
    'technical_constraint',
    'ux',
    'security',
    'infrastructure',
    'prohibition',
    'invariant',
  ]),
  criticality: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string(),
  originalQuote: z.string().nullable().optional(),
});
export type RequirementItem = z.infer<typeof RequirementItemSchema>;

export const RequirementsAnalysisSchema = z.object({
  userGoal: z.string(),
  targetEnvironment: z.string(),
  requirements: z.array(RequirementItemSchema),
  ambiguities: z.array(z.string()),
  contradictions: z.array(z.string()),
  edgeCases: z.array(z.string()),
  potentialRisks: z.array(z.string()),
  blockingQuestions: z.array(z.string()),
});
export type RequirementsAnalysis = z.infer<typeof RequirementsAnalysisSchema>;

// -------------------------------------------------------------
// Architectural Decisions Schema
// -------------------------------------------------------------
export const ArchitecturalDecisionSchema = z.object({
  id: z.string(), // e.g. "AD-001"
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  linkedReqIds: z.array(z.string()),
  constraints: z.array(z.string()),
  alternatives: z.array(z.string()),
  verificationCriteria: z.string(),
});
export type ArchitecturalDecision = z.infer<typeof ArchitecturalDecisionSchema>;

export const SolutionArchitectureSchema = z.object({
  keyEntities: z.array(z.string()),
  businessLogicSummary: z.string(),
  invariants: z.array(z.string()),
  disambiguations: z.array(z.string()),
  architectureOverview: z.string(),
  componentBoundaries: z.array(z.string()),
  techStack: z.array(z.string()),
  dataStorageStrategy: z.string(),
  errorRecoveryStrategy: z.string(),
  securityRequirements: z.array(z.string()),
  definitionOfDone: z.array(z.string()),
  testScenarios: z.array(z.string()),
  decisions: z.array(ArchitecturalDecisionSchema),
});
export type SolutionArchitecture = z.infer<typeof SolutionArchitectureSchema>;

// -------------------------------------------------------------
// Traceability Schema
// -------------------------------------------------------------
export const TraceabilityItemSchema = z.object({
  reqId: z.string(),
  rawText: z.string(),
  normalizedText: z.string(),
  source: z.enum(['explicit', 'inferred', 'proposed']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  coveredSections: z.array(z.string()),
  status: z.enum(['covered', 'partially_covered', 'missing', 'conflicting']),
  reason: z.string().nullable().optional(),
});
export type TraceabilityItem = z.infer<typeof TraceabilityItemSchema>;

// -------------------------------------------------------------
// Quality Review Schema
// -------------------------------------------------------------
export const ReviewReportSchema = z.object({
  isApproved: z.boolean(),
  score: z.number().min(0).max(100),
  traceability: z.array(TraceabilityItemSchema),
  critique: z.array(
    z.object({
      severity: z.enum(['critical', 'high', 'medium', 'low']),
      message: z.string(),
      section: z.string().nullable().optional(),
    })
  ),
  fixesApplied: z
    .object({
      systemPrompt: z.string().nullable().optional(),
      userPrompt: z.string().nullable().optional(),
      explanation: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  summary: z.string(),
});
export type ReviewReport = z.infer<typeof ReviewReportSchema>;

// -------------------------------------------------------------
// Composed Prompts & Deliverables Schema
// -------------------------------------------------------------
export const PromptPackageSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  whatImproved: z.array(z.string()),
  assumptions: z.array(z.string()),
  unresolvedQuestions: z.array(z.string()),
});
export type PromptPackage = z.infer<typeof PromptPackageSchema>;

// -------------------------------------------------------------
// Complexity Assessment Schema (Adaptive mode)
// -------------------------------------------------------------
export const ComplexityAssessmentSchema = z.object({
  score: z.number().min(0).max(100),
  recommendedMode: z.enum(['fast', 'quality']),
  factors: z.object({
    length: z.number(),
    detectedRequirementsCount: z.number(),
    technicalKeywordCount: z.number(),
    hasArchitecturalConstraints: z.boolean(),
    hasContradictions: z.boolean(),
    integrationCount: z.number(),
    requiresStrictVerification: z.boolean(),
  }),
  explanation: z.string(),
});
export type ComplexityAssessment = z.infer<typeof ComplexityAssessmentSchema>;

// -------------------------------------------------------------
// API Metrics & Costs
// -------------------------------------------------------------
export interface StageUsageMetric {
  stage: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
  durationMs: number;
  costUsd: number | null; // null if model pricing is unknown
  attempts: number;
  status: 'success' | 'failed' | 'retried';
}

// -------------------------------------------------------------
// Job Execution State
// -------------------------------------------------------------
export interface JobProgressEvent {
  jobId: string;
  status: JobStatus;
  currentStep?: string;
  stepIndex?: number;
  totalSteps?: number;
  progressPercent: number;
  message: string;
  intermediateResults?: {
    analyzer?: RequirementsAnalysis;
    architect?: SolutionArchitecture;
    composer?: PromptPackage;
    reviewReport?: ReviewReport;
    complexity?: ComplexityAssessment;
  };
  metrics?: {
    totalTokens: number;
    totalCostUsd: number | null;
    stageMetrics: StageUsageMetric[];
  };
  error?: string;
}

// -------------------------------------------------------------
// User Settings
// -------------------------------------------------------------
export interface UserPreferences {
  targetLanguage: string;
  detailLevel: DetailLevel;
  includeArchitecturalAdditions: boolean;
  includeExplanations: boolean;
  customInstructions?: string;
  defaultMode: GenerationMode;
  defaultTarget: TargetEnvironment;
}
