import { describe, it, expect } from 'vitest';
import { PipelineOrchestrator } from '../../packages/ai-pipeline/orchestrator';

describe('AI Benchmark & Reference Test Cases (Section 17.4)', () => {
  const orchestrator = new PipelineOrchestrator();

  const referenceCases = [
    {
      name: '1. Небольшой рефакторинг React-компонента',
      prompt: 'Сделай рефакторинг компонента UserProfile: вынеси аватар и контакты в подкомпоненты, добавь useMemo для форматирования даты.',
      target: 'cursor' as const,
      expectedMode: 'fast' as const,
      mandatoryKeywords: ['UserProfile', 'компонент', 'React'],
    },
    {
      name: '2. Создание PWA для публикации фотографий',
      prompt:
        'Создай PWA для публикации фотографий. Я загружаю несколько фотографий, приложение распределяет их по одной в день и присылает уведомления. Если пропустил публикацию, график должен сместиться. Используй PostgreSQL, TypeScript, Docker. Все настройки только через .env, без fallback.',
      target: 'google-antigravity' as const,
      expectedMode: 'quality' as const,
      mandatoryKeywords: ['PWA', 'PostgreSQL', 'Docker', 'TypeScript', 'IndexedDB', 'смещени'],
    },
    {
      name: '3. Разработка backend API',
      prompt: 'Разработай REST API для системы бронирования переговорных комнат с JWT авторизацией, ролями и PostgreSQL.',
      target: 'claude-code' as const,
      expectedMode: 'quality' as const,
      mandatoryKeywords: ['REST API', 'PostgreSQL', 'JWT'],
    },
    {
      name: '4. Полноценное приложение с БД и Docker',
      prompt: 'Создай сервис мониторинга цен на криптовалюты: сборщик данных, PostgreSQL, Redis, Express API и docker-compose.',
      target: 'google-antigravity' as const,
      expectedMode: 'quality' as const,
      mandatoryKeywords: ['PostgreSQL', 'Redis', 'Docker'],
    },
    {
      name: '5. Улучшение существующего технического задания',
      prompt: 'Улучши ТЗ: "Сайт интернет-магазина обуви. Корзина, оплата картой, каталог с фильтрами, админка для добавления товаров".',
      target: 'universal-agent' as const,
      expectedMode: 'quality' as const,
      mandatoryKeywords: ['каталог', 'корзина', 'оплата'],
    },
    {
      name: '6. Противоречивый запрос',
      prompt: 'Сделай приложение полностью офлайн в браузере, но все данные должны храниться строго на удаленном сервере без локальных кэшей.',
      target: 'google-antigravity' as const,
      expectedMode: 'quality' as const,
      mandatoryKeywords: ['офлайн', 'храни'],
    },
    {
      name: '7. Неполный запрос',
      prompt: 'Сделай бота для уведомлений',
      target: 'generic-llm' as const,
      expectedMode: 'fast' as const,
      mandatoryKeywords: ['уведомлен'],
    },
    {
      name: '8. Запрос со строгими техническими ограничениями',
      prompt: 'Напиши микросервис на Go с gRPC и Prometheus метриками. Никаких сторонних ORM, чистый database/sql и PostgreSQL.',
      target: 'google-antigravity' as const,
      expectedMode: 'quality' as const,
      mandatoryKeywords: ['PostgreSQL', 'gRPC', 'Go'],
    },
  ];

  for (const tc of referenceCases) {
    it(`evaluates case: ${tc.name}`, async () => {
      const result = await orchestrator.execute({
        jobId: `bench_${Date.now()}`,
        rawPrompt: tc.prompt,
        targetEnvironment: tc.target,
        mode: tc.expectedMode,
      });

      expect(result.prompts.userPrompt).toBeDefined();
      expect(result.prompts.systemPrompt).toBeDefined();

      const userPromptLower = result.prompts.userPrompt.toLowerCase();
      // Verify mandatory keywords preserved
      for (const kw of tc.mandatoryKeywords) {
        expect(userPromptLower).toContain(kw.toLowerCase());
      }

      // Review report check
      expect(result.reviewReport.isApproved).toBe(true);
      expect(result.reviewReport.traceability.length).toBeGreaterThan(0);
    });
  }
});
