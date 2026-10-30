import { describe, it, expect } from 'vitest';
import { evaluatePromptComplexity } from '../../packages/ai-pipeline/complexityClassifier';

describe('Deterministic Complexity Classifier (Adaptive Mode)', () => {
  it('correctly classifies a complex architectural prompt as Quality mode', () => {
    const raw =
      'Создай PWA для публикации фотографий. Я загружаю несколько фотографий, приложение распределяет их по одной в день и присылает уведомления. Если пропустил публикацию, график должен сместиться. Используй PostgreSQL, TypeScript, Docker. Все настройки только через .env, без fallback.';
    const result = evaluatePromptComplexity(raw);

    expect(result.recommendedMode).toBe('quality');
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.factors.hasArchitecturalConstraints).toBe(true);
    expect(result.factors.technicalKeywordCount).toBeGreaterThan(0);
    expect(result.explanation).toContain('Quality');
  });

  it('correctly classifies a trivial isolated prompt as Fast mode', () => {
    const raw = 'Поменяй цвет кнопки на синий и добавь отступ снизу';
    const result = evaluatePromptComplexity(raw);

    expect(result.recommendedMode).toBe('fast');
    expect(result.score).toBeLessThan(45);
    expect(result.explanation).toContain('Fast');
  });

  it('detects conditional logic and edge cases in the prompt', () => {
    const raw = 'Если пользователь не оплатил, заблокируй доступ, но если он админ, оставь доступ; иначе пришли предупреждение';
    const result = evaluatePromptComplexity(raw);

    expect(result.factors.hasContradictions).toBe(true);
  });
});
