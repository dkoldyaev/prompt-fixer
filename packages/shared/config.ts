import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env if present
dotenv.config();

export const ConfigSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required and cannot be empty'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required and cannot be empty'),
  API_PORT: z
    .string()
    .min(1, 'API_PORT is required')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0 || num > 65535) {
        throw new Error(`API_PORT must be a valid port number (1-65535), received: "${val}"`);
      }
      return num;
    }),
  PUBLIC_APP_ORIGIN: z.string().url('PUBLIC_APP_ORIGIN must be a valid URL'),
  OPENAI_ANALYZER_MODEL: z.string().min(1, 'OPENAI_ANALYZER_MODEL is required'),
  OPENAI_ARCHITECT_MODEL: z.string().min(1, 'OPENAI_ARCHITECT_MODEL is required'),
  OPENAI_COMPOSER_MODEL: z.string().min(1, 'OPENAI_COMPOSER_MODEL is required'),
  OPENAI_REVIEWER_MODEL: z.string().min(1, 'OPENAI_REVIEWER_MODEL is required'),
  OPENAI_FAST_MODEL: z.string().min(1, 'OPENAI_FAST_MODEL is required'),
  AI_REASONING_MODELS: z.string().min(1, 'AI_REASONING_MODELS is required'),
  AI_MAX_OUTPUT_TOKENS: z
    .string()
    .min(1, 'AI_MAX_OUTPUT_TOKENS is required')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        throw new Error(`AI_MAX_OUTPUT_TOKENS must be a positive integer, received: "${val}"`);
      }
      return num;
    }),
  AI_RETRY_LIMIT: z
    .string()
    .min(1, 'AI_RETRY_LIMIT is required')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`AI_RETRY_LIMIT must be a non-negative integer, received: "${val}"`);
      }
      return num;
    }),
  AI_REQUEST_TIMEOUT_MS: z
    .string()
    .min(1, 'AI_REQUEST_TIMEOUT_MS is required')
    .transform((val) => {
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        throw new Error(`AI_REQUEST_TIMEOUT_MS must be a positive integer, received: "${val}"`);
      }
      return num;
    }),
  AI_MAX_JOB_COST: z
    .string()
    .min(1, 'AI_MAX_JOB_COST is required')
    .transform((val) => {
      const num = parseFloat(val);
      if (isNaN(num) || num <= 0) {
        throw new Error(`AI_MAX_JOB_COST must be a positive number, received: "${val}"`);
      }
      return num;
    }),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error'] as const),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Validates and returns strictly typed application configuration.
 * Throws a detailed ConfigurationError if any variable is missing, empty, or invalid.
 * Strictly avoids default/fallback values (Section 13 of Technical Specification).
 */
export function loadConfig(customEnv?: Record<string, string | undefined>): AppConfig {
  const envSource = customEnv || process.env;

  const result = ConfigSchema.safeParse(envSource);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `  - [${issue.path.join('.')}]: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Strict Configuration Error: Application failed to start due to invalid or missing environment variables:\n${errorDetails}\nCheck your .env or .env.example file.`
    );
  }

  return result.data;
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function resetConfigForTesting(): void {
  cachedConfig = null;
}
