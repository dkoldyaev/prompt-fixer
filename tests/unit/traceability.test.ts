import { describe, it, expect } from 'vitest';
import { buildTraceabilityMatrix, verifyCriticalCoverage } from '../../packages/ai-pipeline/traceabilityEngine';
import { RequirementItem } from '../../packages/shared/types';

describe('Requirements Traceability Engine', () => {
  const mockRequirements: RequirementItem[] = [
    {
      id: 'REQ-001',
      source: 'explicit',
      category: 'functional',
      criticality: 'critical',
      description: 'Загрузка нескольких фотографий и распределение по одной в день',
    },
    {
      id: 'REQ-002',
      source: 'explicit',
      category: 'technical_constraint',
      criticality: 'critical',
      description: 'Использование PostgreSQL и Docker',
    },
    {
      id: 'REQ-003',
      source: 'explicit',
      category: 'prohibition',
      criticality: 'critical',
      description: 'Все настройки только через .env без fallback',
    },
  ];

  it('detects covered sections and maps requirement statuses', () => {
    const promptText = `
      # User Prompt
      ## Функциональные требования
      Реализована загрузка нескольких фотографий и распределение по дням.
      ## Архитектурные требования
      Используется PostgreSQL и Docker.
      ## Конфигурация и окружение
      Все параметры через .env без fallback.
    `;

    const matrix = buildTraceabilityMatrix(mockRequirements, promptText);
    expect(matrix.length).toBe(3);
    expect(matrix[0].status).toBe('covered');
    expect(matrix[1].status).toBe('covered');
    expect(matrix[2].status).toBe('covered');

    const coverage = verifyCriticalCoverage(matrix);
    expect(coverage.isFullyCovered).toBe(true);
    expect(coverage.uncoveredCritical.length).toBe(0);
  });

  it('flags missing requirements when text does not contain key requirements', () => {
    const poorPromptText = `Простое приложение на Node.js без базы данных и без docker`;
    const matrix = buildTraceabilityMatrix(mockRequirements, poorPromptText);

    const coverage = verifyCriticalCoverage(matrix);
    expect(coverage.isFullyCovered).toBe(false);
  });
});
