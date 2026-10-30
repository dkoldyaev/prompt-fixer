import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { getConfig } from '../shared/config';
import {
  RequirementsAnalysis,
  RequirementsAnalysisSchema,
  SolutionArchitecture,
  SolutionArchitectureSchema,
  PromptPackage,
  PromptPackageSchema,
  ReviewReport,
  ReviewReportSchema,
  TargetEnvironment,
  StageUsageMetric,
} from '../shared/types';
import { calculateTokenCost } from '../shared/pricing';
import { buildTraceabilityMatrix } from './traceabilityEngine';

export interface LLMCallParams {
  stage: string;
  modelId: string;
  systemPrompt: string;
  userInput: string;
  zodSchema?: z.ZodTypeAny;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

/**
 * Checks whether a given model supports reasoning effort parameter.
 */
export function isReasoningModel(modelId: string): boolean {
  return /^(gpt-6|gpt-5\.6|o1|o3)/i.test(modelId);
}

export interface LLMCallResult<T> {
  data: T;
  metrics: StageUsageMetric;
}

/**
 * Normalizes snake_case keys to camelCase in JSON objects to ensure smooth schema validation.
 */
function normalizeKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  } else if (obj !== null && typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      res[camelKey] = normalizeKeys(val);
    }
    return res;
  }
  return obj;
}

/**
 * Executes a structured LLM call with retry policy, timeout, and token/cost measurement.
 */
export async function executeStructuredLLMCall<T>(
  params: LLMCallParams,
  validator: (raw: any) => T,
  mockGenerator?: () => T
): Promise<LLMCallResult<T>> {
  const config = getConfig();
  const startTime = Date.now();
  let attempts = 0;

  // If using mock key or offline testing mode, return simulated structured output
  if (config.OPENAI_API_KEY === 'mock-key' || config.OPENAI_API_KEY.startsWith('mock-')) {
    if (mockGenerator) {
      const simulatedData = mockGenerator();
      const durationMs = Date.now() - startTime + 50;
      const inputTokens = Math.floor(params.systemPrompt.length / 4 + params.userInput.length / 4);
      const outputTokens = Math.floor(JSON.stringify(simulatedData).length / 4);
      const costUsd = calculateTokenCost(params.modelId, inputTokens, outputTokens);

      return {
        data: simulatedData,
        metrics: {
          stage: params.stage,
          modelId: params.modelId,
          inputTokens,
          outputTokens,
          durationMs,
          costUsd,
          attempts: 1,
          status: 'success',
        },
      };
    }
  }

  // Real OpenAI invocation with retry and backoff
  const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });

  const maxRetries = config.AI_RETRY_LIMIT;
  let lastError: any = null;

  while (attempts <= maxRetries) {
    attempts++;
    try {
      const responseFormat = params.zodSchema
        ? zodResponseFormat(params.zodSchema, params.stage.replace(/[^a-zA-Z0-9_]/g, '_'))
        : { type: 'json_object' as const };

      const isReasoning = isReasoningModel(params.modelId);
      const requestPayload: any = {
        model: params.modelId,
        messages: [
          {
            role: 'system',
            content: `${params.systemPrompt}\n\nIMPORTANT: You MUST respond strictly in valid JSON format matching the schema specification.`,
          },
          {
            role: 'user',
            content: `<user_untrusted_input>\n${params.userInput}\n</user_untrusted_input>`,
          },
        ],
        response_format: responseFormat,
        max_completion_tokens: config.AI_MAX_OUTPUT_TOKENS,
      };

      if (isReasoning) {
        requestPayload.reasoning_effort = params.reasoningEffort || 'medium';
      }

      console.log(`[AI LLM] Invoking stage "${params.stage}" with model "${params.modelId}" (attempt ${attempts}/${maxRetries + 1})...`);

      const response = await client.chat.completions.create(
        requestPayload,
        {
          timeout: config.AI_REQUEST_TIMEOUT_MS,
        }
      );

      const choice = response.choices[0];
      const rawContent = choice?.message?.content;
      console.log(`[AI LLM] Stage "${params.stage}" received response. Finish reason: ${choice?.finish_reason}, Refusal: ${choice?.message?.refusal || 'none'}, Content length: ${rawContent?.length || 0}`);

      if (!rawContent) {
        const errorDetail = choice?.message?.refusal 
          ? `Model refused with message: ${choice.message.refusal}` 
          : `Finish reason: ${choice?.finish_reason || 'unknown'}, choices: ${response.choices.length}`;
        throw new Error(`OpenAI returned empty response for stage "${params.stage}". (${errorDetail})`);
      }

      const parsedJson = JSON.parse(rawContent);
      const normalizedJson = normalizeKeys(parsedJson);

      // Handle fallback field mapping if needed
      if (!normalizedJson.whatImproved && normalizedJson.improvements) {
        normalizedJson.whatImproved = normalizedJson.improvements;
      }
      if (!normalizedJson.systemPrompt && normalizedJson.system) {
        normalizedJson.systemPrompt = normalizedJson.system;
      }
      if (!normalizedJson.userPrompt && normalizedJson.user) {
        normalizedJson.userPrompt = normalizedJson.user;
      }
      if (!normalizedJson.unresolvedQuestions) {
        normalizedJson.unresolvedQuestions = [];
      }
      if (!normalizedJson.assumptions) {
        normalizedJson.assumptions = [];
      }

      const validatedData = validator(normalizedJson);
      console.log(`[AI LLM] Stage "${params.stage}" data successfully validated against Zod schema.`);

      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens ?? Math.floor(params.userInput.length / 4);
      const outputTokens = usage?.completion_tokens ?? Math.floor(rawContent.length / 4);
      const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
      const durationMs = Date.now() - startTime;
      const costUsd = calculateTokenCost(params.modelId, inputTokens, outputTokens, cachedTokens);

      return {
        data: validatedData,
        metrics: {
          stage: params.stage,
          modelId: params.modelId,
          inputTokens,
          outputTokens,
          cachedInputTokens: cachedTokens,
          reasoningTokens: (usage as any)?.completion_tokens_details?.reasoning_tokens ?? 0,
          durationMs,
          costUsd,
          attempts,
          status: 'success',
        },
      };
    } catch (err: any) {
      lastError = err;
      console.error(`[AI LLM ERROR] Stage "${params.stage}" attempt ${attempts} failed:`, err?.message || err);
      // If client abort or non-retryable 401/403, don't retry
      if (err?.status === 401 || err?.status === 403) {
        throw new Error(`OpenAI Authentication Error (${err.status}): ${err.message}`);
      }

      if (attempts <= maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempts), 8000);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }
  }

  throw new Error(
    `Failed to execute stage "${params.stage}" after ${attempts} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

// ==============================================================================
// Mock Generator Helpers for Offline Development & Rigorous Testing
// ==============================================================================

export function generateMockAnalyzerOutput(rawPrompt: string, target: TargetEnvironment): RequirementsAnalysis {
  const lower = rawPrompt.toLowerCase();
  const isPwa = lower.includes('pwa') || lower.includes('фото');
  const isPostgres = lower.includes('postgres');
  const isDocker = lower.includes('docker');

  const reqs = [
    {
      id: 'REQ-001',
      source: 'explicit' as const,
      category: 'functional' as const,
      criticality: 'critical' as const,
      description: isPwa
        ? 'Пользователь загружает несколько фотографий, система распределяет их для публикации по одной в день'
        : 'Реализация базовой функциональности в соответствии с пользовательским запросом',
      originalQuote: rawPrompt.slice(0, 80),
    },
    {
      id: 'REQ-002',
      source: 'explicit' as const,
      category: 'functional' as const,
      criticality: 'high' as const,
      description: 'Отправка ежедневных уведомлений пользователю о запланированной публикации',
      originalQuote: 'присылает уведомления',
    },
    {
      id: 'REQ-003',
      source: 'explicit' as const,
      category: 'invariant' as const,
      criticality: 'critical' as const,
      description: 'Если публикация пропущена, календарный график автоматически смещается на следующий доступный день',
      originalQuote: 'Если пропустил публикацию, график должен сместиться',
    },
    {
      id: 'REQ-004',
      source: 'explicit' as const,
      category: 'technical_constraint' as const,
      criticality: 'critical' as const,
      description: `Технологический стек: ${isPostgres ? 'PostgreSQL' : 'Реляционная БД'}, TypeScript, ${isDocker ? 'Docker' : 'Контейнеризация'}`,
      originalQuote: 'Используй PostgreSQL, TypeScript, Docker',
    },
    {
      id: 'REQ-005',
      source: 'explicit' as const,
      category: 'prohibition' as const,
      criticality: 'critical' as const,
      description: 'Все настройки окружения задаются строго через .env без скрытых значений по умолчанию (no fallback policy)',
      originalQuote: 'Все настройки только через .env, без fallback',
    },
    {
      id: 'REQ-006',
      source: 'inferred' as const,
      category: 'infrastructure' as const,
      criticality: 'high' as const,
      description: 'Использование IndexedDB и Service Worker в PWA для локального буферизованного хранения фото и работы в офлайн-режиме',
    },
    {
      id: 'REQ-007',
      source: 'inferred' as const,
      category: 'non_functional' as const,
      criticality: 'high' as const,
      description: 'Идемпотентность операций синхронизации и смещения очереди публикаций',
    },
    {
      id: 'REQ-008',
      source: 'proposed' as const,
      category: 'security' as const,
      criticality: 'medium' as const,
      description: 'Валидация MIME-типов, лимиты на размер изображений и защита от вредоносных бинарных данных',
    },
  ];

  return {
    userGoal: isPwa ? 'Создание автономного PWA-сервиса с отложенной авто-публикацией фотографий' : 'Реализация программной системы',
    targetEnvironment: target,
    requirements: reqs,
    ambiguities: [
      'Способ доставки уведомлений: Web Push API или нативные локальные уведомления PWA',
      'Формат хранения изображений на сервере: S3-совместимое объектное хранилище или локальная файловая система контейнера',
    ],
    contradictions: [],
    edgeCases: [
      'Пользователь пропустил 3 дня подряд: каскадный пересчет дат для всей очереди',
      'Загрузка 50+ тяжелых фотографий при нестабильном 3G/Edge соединении',
      'Завершение свободного дискового пространства в IndexedDB',
    ],
    potentialRisks: [
      'Блокировка Service Worker фоновых таймеров энергосбережением мобильных ОС',
      'Случайная рассинхронизация очереди при одновременном открытии PWA на двух устройствах',
    ],
    blockingQuestions: [],
  };
}

export function generateMockArchitectOutput(
  rawPrompt: string,
  analysis: RequirementsAnalysis
): SolutionArchitecture {
  return {
    keyEntities: [
      'PhotoItem (id, user_id, file_path, status, scheduled_date, published_at, checksum)',
      'PublishQueue (id, photo_id, queue_order, shift_count, last_evaluated_at)',
      'NotificationLog (id, photo_id, channel, status, sent_at)',
      'UserSettings (id, publish_hour_utc, timezone, notifications_enabled)',
    ],
    businessLogicSummary:
      'Идемпотентный планировщик задач проверяет очередь. Если статус вчерашнего PhotoItem остался "pending", срабатывает триггер каскадного сдвига: scheduled_date инкрементируется на 1 день для всей цепочки. Локальный Service Worker кэширует медиа в IndexedDB.',
    invariants: [
      'В один календарный день публикуется строго не более одной фотографии (One Photo Per Day Rule)',
      'Никакие параметры конфигурации окружения не имеют встроенных дефолтов в рантайме (Zero Fallback Invariant)',
      'Очередь строго упорядочена: дата каждого следующего элемента > даты предыдущего',
    ],
    disambiguations: [
      'Уведомления реализуются через Web Push API с подпиской VAPID ключами',
      'Изображения сохраняются на постоянном Docker Volume с записью метаданных в PostgreSQL',
    ],
    architectureOverview:
      'PWA Single Page Application (React + Vite + Workbox) с локальным слоем IndexedDB, Express/TypeScript API Gateway, PostgreSQL в качестве источника истины и Background Scheduler Worker.',
    componentBoundaries: [
      'Client PWA UI (React, Lucide, Tailwind)',
      'Client Storage Engine (IndexedDB wrapper с фоновой синхронизацией через Background Sync API)',
      'Backend REST API (Express + Zod validation)',
      'PostgreSQL Storage Layer (Миграции, строгие внешние ключи, транзакции)',
      'Docker Compose оркестрация с изолированной сетью и персистентными томами',
    ],
    techStack: [
      'TypeScript 5.x (Strict mode)',
      'React 19 + Vite + Tailwind CSS',
      'Workbox / Service Worker (PWA)',
      'IndexedDB (Dexie or idb)',
      'Node.js + Express',
      'PostgreSQL 16',
      'Docker & Docker Compose',
      'Vitest + Playwright',
    ],
    dataStorageStrategy:
      'Двухуровневое хранение: локальный офлайн-кэш в IndexedDB на клиенте и персистентный PostgreSQL на сервере с транзакционной фиксацией очереди.',
    errorRecoveryStrategy:
      'Экспоненциальный backoff при повторе сетевых запросов, dead-letter очередь для сбойных публикаций, восстановление несохраненных черновиков из IndexedDB.',
    securityRequirements: [
      'Валидация MIME-типов и заголовков изображений (magic bytes)',
      'Rate-limiting API эндпоинтов загрузки',
      'Безопасное хранение VAPID ключей в .env',
      'Strict Content Security Policy (CSP)',
    ],
    definitionOfDone: [
      'PWA корректно устанавливается на мобильных и десктопных устройствах',
      'Офлайн-режим позволяет просматривать запланированные фото и добавлять новые в очередь',
      'Тест на пропуск дня подтверждает автоматический сдвиг всей последующей очереди',
      'Контейнеры запускаются через docker compose без ошибок конфигурации',
      'Все тесты (unit + e2e) проходят успешно',
    ],
    testScenarios: [
      'Unit-тест алгоритма пересчета дат при пропуске 1, 2 и 5 дней',
      'E2E-тест загрузки 5 фото и проверка назначенного графика 1 фото в день',
      'Интеграционный тест падения сервера при отсутствии хотя бы одной переменной в .env',
      'Офлайн-тест Service Worker в браузере при эмуляции отключения сети',
    ],
    decisions: [
      {
        id: 'AD-001',
        title: 'Локальное офлайн-хранилище на IndexedDB',
        description: 'Использование IndexedDB для кэширования фотографий и метаданных очереди на стороне клиента',
        rationale: 'PWA требует полноценной работы без доступа к сети для соответствия ожиданиям пользователя',
        linkedReqIds: ['REQ-001', 'REQ-006'],
        constraints: ['Квота хранилища браузера', 'Асинхронный доступ'],
        alternatives: ['LocalStorage (не подходит из-за лимита 5MB и синхронного API)'],
        verificationCriteria: 'Фотографии доступны для просмотра при отключенном интернете',
      },
      {
        id: 'AD-002',
        title: 'Каскадный алгоритм сдвига дат очереди (Date Cascade Shifter)',
        description: 'Транзакционная процедура смещения дат запланированных публикаций при выявлении пропуска',
        rationale: 'Прямое требование пользователя: график не должен терять пропущенные дни',
        linkedReqIds: ['REQ-003', 'REQ-007'],
        constraints: ['Идемпотентность запуска cron-задачи'],
        alternatives: ['Ручной перенос пользователем (нарушает требование автоматизации)'],
        verificationCriteria: 'Тест со сдвигом системного времени подтверждает корректность смещения',
      },
      {
        id: 'AD-003',
        title: 'Строгая конфигурация окружения через Zod',
        description: 'Валидация всех .env переменных при старте процесса без применения fallback-значений',
        rationale: 'Прямое требование пользователя: все настройки только через .env, без fallback',
        linkedReqIds: ['REQ-005'],
        constraints: ['Блокировка старта при любой отсутствующей переменной'],
        alternatives: ['Значения по умолчанию (прямо запрещены требованиями)'],
        verificationCriteria: 'Процесс завершается с ненулевым кодом выхода, если переменная не задана',
      },
    ],
  };
}

export function generateMockComposerOutput(
  rawPrompt: string,
  target: TargetEnvironment,
  analysis: RequirementsAnalysis,
  architecture: SolutionArchitecture
): PromptPackage {
  const targetName =
    target === 'google-antigravity'
      ? 'Google Antigravity'
      : target === 'claude-code'
      ? 'Claude Code'
      : target === 'cursor'
      ? 'Cursor'
      : target === 'universal-agent'
      ? 'Universal Autonomous Coding Agent'
      : 'Generic LLM';

  const systemPrompt = `# System Prompt: ${targetName} - Principal Software Engineer & Autonomous Agent

## [1. Role and Context]
You are a Staff Full-Stack Engineer, Systems Architect, and Autonomous Coding Agent operating in the ${targetName} environment.
You specialize in mission-critical applications, modern software engineering, TypeScript, and robust database architectures.
You write production-ready code with complete type safety, automated tests, and exhaustive edge-case handling. You never leave TODOs or stub functions.

## [2. Global Objective]
Build, verify, and deliver a fully functional, self-contained application according to the comprehensive Technical Specification provided in the User Prompt.

## [3. Permanent Instructions & Engineering Principles]
- **Documentation Integrity**: Preserve existing comments and docstrings.
- **Strict Environment Configuration**: Every single configuration value must be strictly loaded from environment variables (.env). NEVER introduce fallback defaults like \`process.env.X || 'default'\` or \`??\`. The process MUST fail immediately at startup with an informative message if any variable is missing.
- **Zero Mock Policy in Production Code**: Implement real database migrations, persistent storage, and actual business logic.
- **Test-Driven Rigor**: Implement unit tests, integration tests, and acceptance verifications. Run and verify all tests before completing the assignment.
- **Clickable File Links**: Reference code symbols and file paths using markdown links with \`file://\` protocol.

## [4. Rules and Rationale]
1. **Rule**: All mutations of critical entity state must run in atomic database transactions.
   *Rationale*: Prevents partial state updates and race conditions during parallel execution.
2. **Rule**: Configuration parameters must be checked at process startup.
   *Rationale*: Fail-fast prevents silent runtime crashes deep inside production execution.
3. **Rule**: Autonomous agents must run unit and integration tests to verify deliverables.
   *Rationale*: Ensures functional correctness before marking tasks complete.

## [5. Reference Examples (Few-Shot Calibration)]
- *Bad implementation*:
  \`\`\`typescript
  const port = process.env.PORT || 3000; // FORBIDDEN: Fallback bypasses strict config
  \`\`\`
- *Good implementation*:
  \`\`\`typescript
  const port = parseStrictPort(process.env.PORT); // Correct: Throws error if PORT is missing or invalid
  \`\`\`

## [6. Deliverables & Definition of Done]
- Clean, structured repository matching modern full-stack standards.
- Dockerfile and Docker Compose configurations where applicable.
- Fully Passing automated test suite.
- Verified functionality and error handling.`;

  // Dynamically tailor the User Prompt specification to the actual prompt requirements
  const reqList = analysis.requirements
    .map((r) => `- [${r.id}] (${r.category}) ${r.description}`)
    .join('\n');

  const entitiesList = architecture.keyEntities.map((e) => `- ${e}`).join('\n');
  const invariantsList = architecture.invariants.map((inv) => `- ${inv}`).join('\n');
  const techStackList = architecture.techStack.map((t) => `- ${t}`).join('\n');

  const userPrompt = `# User Prompt: Техническое задание на реализацию

## 1. Общее описание продукта
${rawPrompt}

## 2. Пользовательские сценарии (User Journeys)
- **Основной сценарий**: Пользователь инициирует выполнение ключевой задачи системы. Система проводит валидацию входных параметров, обращается к слою хранения и возвращает предсказуемый результат.
- **Сценарий обработки граничных условий**: При возникновении сбоев сети или некорректных данных система активирует протокол восстановления и возвращает информативное сообщение.

## 3. Функциональные требования
${reqList}

## 4. Архитектурные требования и технологический стек
${techStackList}

## 5. Модели данных и ключевые сущности
${entitiesList}

## 6. Бизнес-правила и инварианты
${invariantsList}

## 7. Конфигурация и строгая политика окружения (.env)
Все параметры окружения проверяются при старте через строго типизированные схемы. Наличие любых fallback-конструкций в коде строго запрещено.
Обязательные переменные:
- \`DATABASE_URL\` (PostgreSQL connection string)
- \`API_PORT\` (порт сервера)
- \`LOG_LEVEL\` (уровень логирования)

## 8. Развертывание и Docker
- \`docker-compose.yml\` описывает контейнеры приложения и подключение к внешней БД.
- \`docker-compose.override.yml\` добавляет сервис PostgreSQL с томом данных и healthcheck для локальной разработки.

## 9. Тестирование и критерии приемки
- Unit-тесты для ключевой бизнес-логики и валидации.
- Интеграционные тесты API с тестовым окружением.
- E2E-тесты на полный жизненный цикл сценариев.

## 10. Требования к автономной работе ${targetName}
- Самостоятельно инициализируй проект, создай файлы миграций, реализуй клиентский и серверный код.
- Запусти тесты в bash-терминале и убедись в их 100% успешном прохождении.

## 11. Final Action
Приступай к поэтапной реализации проекта в соответствии с данным ТЗ: сформируй структуру модулей, реализуй бизнес-логику и запусти верификационные тесты.`;

  return {
    systemPrompt,
    userPrompt,
    whatImproved: [
      'Детализирована архитектура системы и границы компонентов',
      'Сформирован перечень бизнес-инвариантов и протоколов обработки ошибок',
      'Внедрена строгая политика конфигурации без неявных fallback-значений',
      'Разработана комплексная программа тестирования (Unit, Integration, E2E)',
    ],
    assumptions: [
      'Система ориентирована на производственное развертывание с использованием контейнеризации',
      'Для хранения данных и очередей применяются надежные реляционные механизмы',
    ],
    unresolvedQuestions: [],
  };
}

export function generateMockReviewOutput(
  rawPrompt: string,
  analysis: RequirementsAnalysis,
  prompts: PromptPackage
): ReviewReport {
  const traceability = buildTraceabilityMatrix(analysis.requirements, prompts.userPrompt);

  return {
    isApproved: true,
    score: 98,
    traceability,
    critique: [],
    fixesApplied: {
      explanation: 'Все 8 обязательных требований (включая критические REQ-001..REQ-005) полностью покрыты в спецификации ТЗ.',
    },
    summary:
      'Аудит подтверждает 100% сохранение всех явных требований пользователя, отсутствие противоречий, строгую реализацию No-Fallback политики и готовность ТЗ к автономному выполнению целевым AI-агентом.',
  };
}
