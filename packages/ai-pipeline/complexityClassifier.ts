import { ComplexityAssessment } from '../shared/types';

/**
 * Deterministic Complexity Classifier for Adaptive Mode.
 * Analyzes raw prompt text against architectural, infrastructural, and logic complexity indicators.
 */
export function evaluatePromptComplexity(rawPrompt: string): ComplexityAssessment {
  const text = rawPrompt.trim();
  const lower = text.toLowerCase();

  // 1. Length factor
  const charLength = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // 2. Technical keyword detection
  const techKeywords = [
    // Architecture & Database
    'postgresql', 'postgres', 'mysql', 'sqlite', 'mongodb', 'redis', 'database', 'бд', 'база данных',
    'docker', 'docker-compose', 'kubernetes', 'k8s', 'microservice', 'микросервис',
    'orm', 'prisma', 'typeorm', 'drizzle', 'migration', 'миграции',
    // Sync, offline, async
    'indexeddb', 'offline', 'офлайн', 'sync', 'синхронизация', 'queue', 'очередь', 'rabbitmq', 'kafka',
    'idempotent', 'идемпотент', 'pwa', 'service worker', 'push notification', 'уведомления',
    // Security & Auth
    'jwt', 'oauth', 'auth', 'авторизация', 'аутентификация', 'rbac', 'security', 'безопасность', 'шифрование',
    // Scheduling & Time
    'cron', 'schedule', 'график', 'календарь', 'смещение', 'напоминания',
    // Rigor & Environment
    '.env', 'fallback', 'strict', 'production', 'ci/cd', 'тесты', 'e2e', 'unit test',
  ];

  let detectedTechKeywords: string[] = [];
  for (const kw of techKeywords) {
    if (lower.includes(kw) && !detectedTechKeywords.includes(kw)) {
      detectedTechKeywords.push(kw);
    }
  }

  // 3. Sentence & requirement estimation (count lines or punctuation splits)
  const clauses = text.split(/[\n.;!?]+/).map((s) => s.trim()).filter((s) => s.length > 5);
  const detectedRequirementsCount = clauses.length;

  // 4. Architectural constraints detection
  const hasArchitecturalConstraints =
    lower.includes('docker') ||
    lower.includes('postgres') ||
    lower.includes('postgresql') ||
    lower.includes('.env') ||
    lower.includes('без fallback') ||
    lower.includes('no fallback') ||
    lower.includes('indexeddb') ||
    lower.includes('микросервис');

  // 5. Contradiction / Edge case indicators
  const contradictionWords = [
    'если', 'но если', 'иначе', 'в случае', 'пропустил', 'однако', 'но не', 'сместиться', 'исключение',
    'if', 'unless', 'however', 'otherwise', 'except',
  ];
  let contradictionHits = 0;
  for (const w of contradictionWords) {
    if (lower.includes(w)) contradictionHits++;
  }
  const hasContradictions = contradictionHits >= 2;

  // 6. Integrations count
  const integrationWords = ['api', 'webhook', 'rest', 'sdk', 's3', 'telegram', 'bot', 'интеграция', 'email'];
  let integrationCount = 0;
  for (const w of integrationWords) {
    if (lower.includes(w)) integrationCount++;
  }

  // 7. Strict verification need
  const requiresStrictVerification =
    hasArchitecturalConstraints ||
    lower.includes('критично') ||
    lower.includes('строго') ||
    lower.includes('production') ||
    lower.includes('тесты');

  // Calculate composite score (0-100)
  let score = 15; // base score

  // Length weight (up to 20 pts)
  score += Math.min(20, Math.floor(charLength / 25));

  // Technical keywords (up to 30 pts)
  score += Math.min(30, detectedTechKeywords.length * 6);

  // Requirements clauses (up to 20 pts)
  score += Math.min(20, detectedRequirementsCount * 3);

  // Architectural constraints (15 pts)
  if (hasArchitecturalConstraints) score += 15;

  // Contradictions / Edge cases (10 pts)
  if (hasContradictions) score += 10;

  // Normalize score
  score = Math.min(100, Math.max(0, score));

  // Threshold: >= 45 => Quality Mode, < 45 => Fast Mode
  const recommendedMode = score >= 45 ? 'quality' : 'fast';

  const reasons: string[] = [];
  if (detectedTechKeywords.length > 0) {
    reasons.push(`Обнаружены технические термины (${detectedTechKeywords.slice(0, 5).join(', ')})`);
  }
  if (hasArchitecturalConstraints) {
    reasons.push('Заданы явные архитектурные и конфигурационные ограничения');
  }
  if (hasContradictions) {
    reasons.push('Выявлены условные ветвления и сценарии обработки сдвигов/ошибок');
  }
  if (wordCount < 20 && score < 45) {
    reasons.push('Короткий локальный запрос без сложных системных зависимостей');
  }

  const explanation =
    recommendedMode === 'quality'
      ? `Выбран режим Quality (Сложность: ${score}/100). Причина: ${reasons.join('; ')}. Требуется поэтапный анализ требований, архитектурное моделирование и верификация.`
      : `Выбран режим Fast (Сложность: ${score}/100). Причина: ${reasons.length > 0 ? reasons.join('; ') : 'Простой изолированный запрос'}. Достаточно быстрого прямого синтеза ТЗ.`;

  return {
    score,
    recommendedMode,
    factors: {
      length: charLength,
      detectedRequirementsCount,
      technicalKeywordCount: detectedTechKeywords.length,
      hasArchitecturalConstraints,
      hasContradictions,
      integrationCount,
      requiresStrictVerification,
    },
    explanation,
  };
}
