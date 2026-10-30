import { describe, it, expect } from 'vitest';
import { PipelineOrchestrator } from '../../packages/ai-pipeline/orchestrator';

describe('AI Pipeline Orchestrator Integration Tests', () => {
  const orchestrator = new PipelineOrchestrator();

  it('successfully executes Quality mode across all 4 stages', async () => {
    const rawPrompt =
      'Создай PWA для публикации фотографий. Я загружаю несколько фотографий, приложение распределяет их по одной в день и присылает уведомления. Если пропустил публикацию, график должен сместиться. Используй PostgreSQL, TypeScript, Docker. Все настройки только через .env, без fallback.';

    const stepsRecorded: string[] = [];

    const result = await orchestrator.execute({
      jobId: 'test_job_quality',
      rawPrompt,
      targetEnvironment: 'google-antigravity',
      mode: 'quality',
      onProgress: (evt) => {
        if (evt.currentStep) stepsRecorded.push(evt.currentStep);
      },
    });

    expect(result.actualModeUsed).toBe('quality');
    expect(result.analyzerResult).toBeDefined();
    expect(result.analyzerResult?.requirements.length).toBeGreaterThanOrEqual(5);

    // Verify all requirements have stable IDs
    const ids = result.analyzerResult?.requirements.map((r) => r.id);
    expect(ids).toContain('REQ-001');

    expect(result.architectResult).toBeDefined();
    expect(result.architectResult?.decisions.length).toBeGreaterThanOrEqual(1);

    expect(result.prompts.systemPrompt).toContain('Google Antigravity');
    expect(result.prompts.userPrompt).toContain('Техническое задание');
    expect(result.prompts.userPrompt).toContain('Final Action');

    expect(result.reviewReport).toBeDefined();
    expect(result.reviewReport.isApproved).toBe(true);

    expect(result.totalTokens).toBeGreaterThan(0);
    expect(stepsRecorded).toContain('requirements_analysis');
    expect(stepsRecorded).toContain('solution_architecture');
    expect(stepsRecorded).toContain('prompt_composer');
    expect(stepsRecorded).toContain('quality_reviewer');
  });

  it('successfully executes Fast mode in a single pass', async () => {
    const rawPrompt = 'Исправь CSS отступы у навигационной панели';

    const result = await orchestrator.execute({
      jobId: 'test_job_fast',
      rawPrompt,
      targetEnvironment: 'cursor',
      mode: 'fast',
    });

    expect(result.actualModeUsed).toBe('fast');
    expect(result.prompts.systemPrompt).toBeDefined();
    expect(result.prompts.userPrompt).toBeDefined();
    expect(result.reviewReport.isApproved).toBe(true);
  });

  it('supports surgical revisions without re-generating from scratch', async () => {
    const initialSystem = 'Initial System Prompt';
    const initialUser = 'Initial User Prompt with auth specifications and login screens';

    const revision = await orchestrator.executeRevision({
      currentSystemPrompt: initialSystem,
      currentUserPrompt: initialUser,
      amendmentInstruction: 'Убери авторизацию. Это приложение только для одного пользователя.',
      targetEnvironment: 'google-antigravity',
    });

    expect(revision.updatedUserPrompt).toBeDefined();
    expect(revision.changelog.length).toBeGreaterThan(0);
    expect(revision.traceabilitySummary).toBeDefined();
  });

  it('aborts cleanly when cancellation is requested', async () => {
    let cancelled = true;

    await expect(
      orchestrator.execute({
        jobId: 'test_job_cancelled',
        rawPrompt: 'Something',
        targetEnvironment: 'google-antigravity',
        mode: 'quality',
        checkCancelled: () => cancelled,
      })
    ).rejects.toThrow('JOB_CANCELLED');
  });
});
