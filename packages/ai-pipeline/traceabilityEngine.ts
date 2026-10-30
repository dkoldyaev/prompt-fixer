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
    let reason: string | undefined = undefined;

    // Check if key phrases or explicit tokens from description are present
    const words = req.description
      .toLowerCase()
      .replace(/[.,:;()]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const matchHits = words.filter((w) => normalizedDoc.includes(w)).length;
    const matchRatio = words.length > 0 ? matchHits / words.length : 1;

    if (existing?.status) {
      status = existing.status;
      reason = existing.reason;
    } else {
      if (matchRatio >= 0.4 || normalizedDoc.includes(req.description.toLowerCase().slice(0, 20))) {
        status = 'covered';
      } else if (matchRatio >= 0.2) {
        status = 'partially_covered';
        reason = 'Требование упомянуто частично, рекомендуется добавить детализацию в спецификацию';
      } else {
        status = 'missing';
        reason = 'Не обнаружено явного отражения требования в сформированном ТЗ';
      }
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
