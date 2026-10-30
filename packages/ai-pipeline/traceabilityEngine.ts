import {
  RequirementItem,
  TraceabilityItem,
  CoverageStatus,
} from '../shared/types';

/**
 * Deterministic and semantic verification of requirements coverage.
 */
export function buildTraceabilityMatrix(
  requirements: RequirementItem[],
  promptText: string,
  existingTraceability?: TraceabilityItem[]
): TraceabilityItem[] {
  const normalizedDoc = promptText.toLowerCase();

  return requirements.map((req) => {
    // If we already have AI-audited traceability for this req, preserve and calibrate it
    const existing = existingTraceability?.find((t) => t.reqId === req.id);

    // Identify sections in user prompt that mention or relate to the requirement
    const detectedSections: string[] = [];
    const sectionKeywords: Record<string, string[]> = {
      'Функциональные требования': ['функци', 'функционал', 'пользовател', 'публикац', 'загруз'],
      'Архитектурные требования': ['архитектур', 'компонент', 'клиент', 'сервер', 'модул'],
      'Модели данных и хранение': ['postgresql', 'postgres', 'indexeddb', 'бд', 'таблиц', 'модел', 'хранени'],
      'Бизнес-правила и инварианты': ['правил', 'инвариант', 'график', 'смещен', 'день', 'уведомлен'],
      'Конфигурация и окружение': ['.env', 'конфигурац', 'переменн', 'fallback'],
      'Развертывание и Docker': ['docker', 'compose', 'контейнер', 'deploy'],
      'Тестирование и приемка': ['тест', 'acceptance', 'unit', 'e2e', 'проверк'],
    };

    const reqDescLower = req.description.toLowerCase();
    for (const [section, keywords] of Object.entries(sectionKeywords)) {
      if (keywords.some((kw) => reqDescLower.includes(kw))) {
        if (normalizedDoc.includes(section.toLowerCase())) {
          detectedSections.push(section);
        }
      }
    }

    if (detectedSections.length === 0) {
      detectedSections.push('Общие спецификации и требования');
    }

    // Determine deterministic coverage
    let status: CoverageStatus = 'covered';
    let reason: string | null | undefined = undefined;

    // Check if key phrases or explicit tokens from description or originalQuote are present
    const phrases = [
      req.description,
      req.originalQuote || '',
      ...(req.originalQuote ? req.originalQuote.split(/[.,;\n]/) : []),
    ]
      .map((s) => s.toLowerCase().trim())
      .filter((s) => s.length >= 4);

    const hasExactPhrase = phrases.some((phrase) => normalizedDoc.includes(phrase));

    const words = req.description
      .toLowerCase()
      .replace(/[.,:;()]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const matchHits = words.filter((w) => normalizedDoc.includes(w)).length;
    const matchRatio = words.length > 0 ? matchHits / words.length : 1;

    if (existing?.status && existing.status === 'covered') {
      status = 'covered';
      reason = existing.reason || null;
    } else if (hasExactPhrase || matchRatio >= 0.35 || normalizedDoc.includes(req.description.toLowerCase().slice(0, 20))) {
      status = 'covered';
    } else if (matchRatio >= 0.18 || existing?.status === 'partially_covered') {
      status = 'partially_covered';
      reason = existing?.reason || 'Требование упомянуто частично, рекомендуется добавить детализацию в спецификацию';
    } else {
      status = existing?.status || 'missing';
      reason = existing?.reason || 'Не обнаружено явного отражения требования в сформированном ТЗ';
    }

    return {
      reqId: req.id,
      rawText: req.originalQuote || req.description,
      normalizedText: req.description,
      source: req.source,
      priority: req.criticality,
      coveredSections: existing?.coveredSections && existing.coveredSections.length > 0 ? existing.coveredSections : detectedSections,
      status,
      reason,
    };
  });
}

/**
 * Validates whether all critical requirements are 100% covered.
 */
export function verifyCriticalCoverage(traceability: TraceabilityItem[]): {
  isFullyCovered: boolean;
  uncoveredCritical: TraceabilityItem[];
  missingCount: number;
} {
  const uncoveredCritical = traceability.filter(
    (t) => t.priority === 'critical' && t.status !== 'covered'
  );
  const missingCount = traceability.filter((t) => t.status === 'missing').length;

  return {
    isFullyCovered: uncoveredCritical.length === 0 && missingCount === 0,
    uncoveredCritical,
    missingCount,
  };
}

/**
 * Calculates deterministic quality/traceability score (0-100) based on weighted requirements coverage.
 */
export function calculateTraceabilityScore(traceability: TraceabilityItem[]): number {
  if (!traceability || traceability.length === 0) return 100;

  const weights: Record<string, number> = {
    critical: 3.0,
    high: 2.0,
    medium: 1.0,
    low: 0.5,
  };

  const statusScores: Record<string, number> = {
    covered: 1.0,
    partially_covered: 0.6,
    missing: 0.0,
    conflicting: 0.0,
  };

  let totalWeight = 0;
  let earnedScore = 0;
  let missingCritical = 0;

  for (const item of traceability) {
    const w = weights[item.priority] || 1.0;
    const s = statusScores[item.status] ?? 0.0;
    totalWeight += w;
    earnedScore += w * s;

    if (item.priority === 'critical' && item.status !== 'covered') {
      missingCritical++;
    }
  }

  if (totalWeight === 0) return 100;

  let finalScore = Math.round((earnedScore / totalWeight) * 100);

  // If critical requirements are missing, apply penalty
  if (missingCritical > 0) {
    finalScore = Math.min(finalScore, Math.max(10, finalScore - missingCritical * 15));
  }

  return Math.max(0, Math.min(100, finalScore));
}
