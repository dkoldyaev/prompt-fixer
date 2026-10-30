import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, resetConfigForTesting } from '../../packages/shared/config';

describe('Strict Configuration Module (No-Fallback Policy)', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/prompt_rewriter',
    OPENAI_API_KEY: 'sk-test-valid-key',
    API_PORT: '3000',
    PUBLIC_APP_ORIGIN: 'http://localhost:3000',
    OPENAI_ANALYZER_MODEL: 'gpt-4o',
    OPENAI_ARCHITECT_MODEL: 'gpt-4o',
    OPENAI_COMPOSER_MODEL: 'gpt-4o',
    OPENAI_REVIEWER_MODEL: 'gpt-4o',
    OPENAI_FAST_MODEL: 'gpt-4o-mini',
    AI_MAX_OUTPUT_TOKENS: '4096',
    AI_RETRY_LIMIT: '3',
    AI_REQUEST_TIMEOUT_MS: '60000',
    AI_MAX_JOB_COST: '3.00',
    LOG_LEVEL: 'info',
  };

  beforeEach(() => {
    resetConfigForTesting();
  });

  it('successfully loads and parses completely specified configuration', () => {
    const config = loadConfig(validEnv);
    expect(config.API_PORT).toBe(3000);
    expect(config.DATABASE_URL).toBe('postgresql://postgres:postgres@localhost:5432/prompt_rewriter');
    expect(config.AI_MAX_OUTPUT_TOKENS).toBe(4096);
    expect(config.AI_RETRY_LIMIT).toBe(3);
    expect(config.AI_REQUEST_TIMEOUT_MS).toBe(60000);
    expect(config.AI_MAX_JOB_COST).toBe(3.0);
    expect(config.LOG_LEVEL).toBe('info');
  });

  it('fails immediately with descriptive error when DATABASE_URL is missing', () => {
    const env = { ...validEnv, DATABASE_URL: undefined };
    expect(() => loadConfig(env)).toThrowError(/DATABASE_URL/);
  });

  it('fails immediately when OPENAI_API_KEY is empty string', () => {
    const env = { ...validEnv, OPENAI_API_KEY: '' };
    expect(() => loadConfig(env)).toThrowError(/OPENAI_API_KEY is required/);
  });

  it('fails when API_PORT is invalid string or out of range', () => {
    const env = { ...validEnv, API_PORT: 'not-a-port' };
    expect(() => loadConfig(env)).toThrowError(/API_PORT must be a valid port number/);
  });

  it('fails when PUBLIC_APP_ORIGIN is not a valid URL', () => {
    const env = { ...validEnv, PUBLIC_APP_ORIGIN: 'invalid-url' };
    expect(() => loadConfig(env)).toThrowError(/PUBLIC_APP_ORIGIN must be a valid URL/);
  });

  it('fails when LOG_LEVEL has an unrecognized value', () => {
    const env = { ...validEnv, LOG_LEVEL: 'verbose' };
    expect(() => loadConfig(env)).toThrowError();
  });

  it('fails when numeric parameters are negative or zero where forbidden', () => {
    const env = { ...validEnv, AI_MAX_OUTPUT_TOKENS: '0' };
    expect(() => loadConfig(env)).toThrowError(/AI_MAX_OUTPUT_TOKENS must be a positive integer/);
  });
});
