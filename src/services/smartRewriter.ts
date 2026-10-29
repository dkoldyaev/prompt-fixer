import { StructuredPromptResult, TargetLanguage, TargetModel } from '../types';
import { buildMetaPrompt, LANGUAGE_NAMES, MODEL_DETAILS } from './metaPromptBuilder';

/**
 * Парсер текста в структурированный объект промпта
 */
export function parseStructuredPrompt(
  rawText: string,
  model: TargetModel,
  language: TargetLanguage,
  metaPromptUsed: { systemPrompt: string; userPrompt: string; fullText: string },
  originalInput: string
): StructuredPromptResult {
  // Разделяем System Prompt и User Prompt
  let systemSection = '';
  let userSection = '';

  const userPromptMatch = rawText.match(/(?:Пользовательское сообщение\s*(?:\(User Prompt\))?|User Prompt\s*:?|User Message\s*:?)/i);
  if (userPromptMatch && userPromptMatch.index !== undefined) {
    systemSection = rawText.substring(0, userPromptMatch.index).trim();
    userSection = rawText.substring(userPromptMatch.index).trim();
  } else {
    // Если разделение не найдено явно, попытаемся разделить пополам или по маркерам
    systemSection = rawText.trim();
    userSection = '';
  }

  // Очищаем заголовок "Системное сообщение (System Prompt)"
  systemSection = systemSection.replace(/^(?:Системное сообщение\s*(?:\(System Prompt\))?|System Prompt\s*:?|System Message\s*:?)\s*/i, '').trim();
  userSection = userSection.replace(/^(?:Пользовательское сообщение\s*(?:\(User Prompt\))?|User Prompt\s*:?|User Message\s*:?)\s*/i, '').trim();

  // Функция извлечения секции по тегу
  const extractSection = (text: string, tag: string, nextTags: string[]): string => {
    // Экранируем спецсимволы
    const escapedTag = tag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\[${escapedTag}\\]([\\s\\S]*?)(?=\\[(?:${nextTags.join('|')})\\]|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const roleAndContext = extractSection(systemSection, 'Роль и контекст', [
    'Задача',
    'Постоянные материалы',
    'Правила',
    'Примеры (Few-shot)',
    'Формат ответа',
  ]) || extractSection(systemSection, 'Role and Context', ['Task', 'Constants', 'Rules', 'Few-shot', 'Format']);

  const task = extractSection(systemSection, 'Задача', [
    'Постоянные материалы',
    'Правила',
    'Примеры (Few-shot)',
    'Формат ответа',
  ]) || extractSection(systemSection, 'Task', ['Constants', 'Rules', 'Few-shot', 'Format']);

  const persistentMaterials = extractSection(systemSection, 'Постоянные материалы', [
    'Правила',
    'Примеры (Few-shot)',
    'Формат ответа',
  ]) || extractSection(systemSection, 'Constants and Materials', ['Rules', 'Few-shot', 'Format']);

  const rules = extractSection(systemSection, 'Правила', [
    'Примеры (Few-shot)',
    'Формат ответа',
  ]) || extractSection(systemSection, 'Rules', ['Few-shot', 'Format']);

  const fewShotRaw = extractSection(systemSection, 'Примеры (Few-shot)', [
    'Формат ответа',
  ]) || extractSection(systemSection, 'Examples (Few-shot)', ['Format']);

  const responseFormat = extractSection(systemSection, 'Формат ответа', []) || extractSection(systemSection, 'Response Format', []);

  // Разбираем Few-shot на bad / good
  let badExample = '';
  let goodExample = '';
  const badMatch = fewShotRaw.match(/(?:Пример плохого ответа|Bad Example)\s*:\s*([\s\S]*?)(?=(?:Пример хорошего ответа|Good Example)\s*:|$)/i);
  const goodMatch = fewShotRaw.match(/(?:Пример хорошего ответа|Good Example)\s*:\s*([\s\S]*?)$/i);

  if (badMatch) badExample = badMatch[1].trim();
  if (goodMatch) goodExample = goodMatch[1].trim();
  if (!badExample && !goodExample && fewShotRaw) {
    goodExample = fewShotRaw;
  }

  // Разбираем User Prompt
  const inputData = extractSection(userSection, 'Вводные данные', ['Действие']) || extractSection(userSection, 'Input Data', ['Action']);
  const action = extractSection(userSection, 'Действие', []) || extractSection(userSection, 'Action', []);

  // Сборка красивого форматированного текста
  const formattedText = `Системное сообщение (System Prompt)

[Роль и контекст]
${roleAndContext || 'Определите экспертную роль модели.'}

[Задача]
${task || 'Определите генеральную задачу модели.'}

[Постоянные материалы]
${persistentMaterials || 'Справочные данные и нормативы предметной области.'}

[Правила]
${rules || 'Ключевые правила и ограничения.'}

[Примеры (Few-shot)]
Пример плохого ответа: ${badExample || 'Слишком короткий и абстрактный совет без обоснования.'}

Пример хорошего ответа: ${goodExample || 'Развернутый экспертный ответ с логическим объяснением каждого шага.'}

[Формат ответа]
${responseFormat || 'Структура ответа с четким разделением по разделам.'}

Пользовательское сообщение (User Prompt)

[Вводные данные]
${inputData || 'Исходные данные текущей задачи.'}

[Действие]
${action || 'Опираясь на вводные данные, выполни задачу строго по инструкции.'}`;

  return {
    systemPrompt: {
      roleAndContext: roleAndContext || 'Эксперт в предметной области',
      task: task || 'Решение поставленной задачи',
      persistentMaterials: persistentMaterials || 'Базовые нормативы и аксиомы',
      rules: rules || 'Действовать строго в рамках профессиональных стандартов',
      fewShot: {
        bad: badExample || 'Низкое качество ответа',
        good: goodExample || 'Высокое экспертное качество ответа',
      },
      responseFormat: responseFormat || 'Пошаговый разбор и рекомендации',
    },
    userPrompt: {
      inputData: inputData || 'Контекст запроса пользователя',
      action: action || 'Выполнить анализ и составить план действий',
    },
    formattedText,
    metaPromptUsed,
    metadata: {
      model,
      language,
      createdAt: new Date().toISOString(),
      originalWordCount: originalInput.trim().split(/\s+/).filter(Boolean).length,
      optimizedWordCount: formattedText.trim().split(/\s+/).filter(Boolean).length,
    },
  };
}

/**
 * Локальный интеллектуальный синтезатор, генерирующий высококачественный структурированный промпт
 * при отсутствии доступа к внешнему LLM API или для мгновенной генерации/демо.
 */
export function generateLocalStructuredPrompt(
  rawInput: string,
  model: TargetModel,
  language: TargetLanguage,
  metaPromptUsed: { systemPrompt: string; userPrompt: string; fullText: string }
): StructuredPromptResult {
  const isEn = language === 'en';
  const isEs = language === 'es';
  const isDe = language === 'de';
  const isFr = language === 'fr';
  const isZh = language === 'zh';

  // Определяем домен и тему по ключевым словам
  const lower = rawInput.toLowerCase();
  
  let domain = 'general';
  if (lower.includes('сон') || lower.includes('режим') || lower.includes('малыш') || lower.includes('ребенок') || lower.includes('sleep') || lower.includes('baby')) {
    domain = 'baby_sleep';
  } else if (lower.includes('код') || lower.includes('программир') || lower.includes('typescript') || lower.includes('python') || lower.includes('react') || lower.includes('code') || lower.includes('api') || lower.includes('bug') || lower.includes('refactor')) {
    domain = 'code';
  } else if (lower.includes('статья') || lower.includes('пост') || lower.includes('текст') || lower.includes('копирайт') || lower.includes('маркетинг') || lower.includes('copywrite') || lower.includes('article') || lower.includes('post')) {
    domain = 'copywriting';
  } else if (lower.includes('юрист') || lower.includes('договор') || lower.includes('право') || lower.includes('legal') || lower.includes('contract')) {
    domain = 'legal';
  } else if (lower.includes('бизнес') || lower.includes('анализ') || lower.includes('стартап') || lower.includes('продукт') || lower.includes('business') || lower.includes('product')) {
    domain = 'business';
  }

  // Специфика модели
  const modelStyleNote =
    model === 'gpt'
      ? (isEn ? 'Optimized for OpenAI GPT: high role fidelity, clear [Tag] delimiters, and contrastive few-shot alignment.' : 'Оптимизировано под OpenAI GPT: четкая ролевая модель, теговая разметка [Блок] и строгий Few-Shot контроль.')
      : model === 'gemini'
      ? (isEn ? 'Optimized for Google Gemini: structured markdown hierarchy, explicit grounding constants, and hallucination guardrails.' : 'Оптимизировано под Google Gemini: структурированная Markdown-иерархия, заземляющие константы (Grounding) и защита от галлюцинаций.')
      : (isEn ? 'Optimized for Mistral AI: direct imperative commands, minimal boilerplate, high-density actionable rules.' : 'Оптимизировано под Mistral AI: прямолинейные императивные глаголы, строгие правила без лишней «воды», лаконичный вывод.');

  let roleAndContext = '';
  let task = '';
  let persistentMaterials = '';
  let rules = '';
  let badExample = '';
  let goodExample = '';
  let responseFormat = '';
  let inputData = '';
  let action = '';

  if (domain === 'baby_sleep') {
    if (isEn) {
      roleAndContext = `You are a certified pediatric sleep consultant and infant somnologist specializing in circadian rhythms, gentle wake-window adjustments, and zero-stress gentle routines. ${modelStyleNote}`;
      task = `Analyze the child's sleep and wake cycle, diagnose the root cause of irregular short days, and formulate an incremental, evidence-based roadmap to stabilize the circadian schedule at a normal 24-hour cycle.`;
      persistentMaterials = `Age-specific sleep norms: total daily sleep requirement for 10-month-old infants is 13.5–14 hours, with safe awake windows (AW) between 3.5 and 4 hours.\nTransition to 2 daytime naps is firmly established.\nSubject's name: Theodor.`;
      rules = `Offer strictly gentle behavioral routines. Never recommend extinction protocols (e.g., "cry-it-out"), as protecting the infant's neurological and emotional stability is paramount.\nAlways state the underlying physiological reason for any schedule change (e.g., explaining why adjusting the morning nap rather than afternoon nap prevents cortisol spikes).\nNever give vague advice like "extend wakefulness". Specify the exact number of minutes and the precise time slot (morning/midday/evening).\nAdopt an empathetic, supportive, yet scientifically rigorous tone.`;
      badExample = `«Try waking the child up earlier from afternoon naps or putting them down later at night.»`;
      goodExample = `«To restore a 24-hour circadian equilibrium, we need to locate the missing 60 minutes. We will add 15 minutes to Wake Window 1 over the next 3 days, simultaneously shortening Nap 1 by 15 minutes to preserve sleep pressure for the afternoon sleep...»`;
      responseFormat = `1. Cycle Breakdown: Mathematical cause of circadian deficit and physiological imbalance.\n2. Root-Cause Hypotheses: Key adjustment vectors (wake windows vs. nap durations vs. bedtime shifts).\n3. Step-by-Step 7-Day Protocol: Concrete minute-by-minute action plan to return to a 24-hour rhythm.`;
      inputData = `Symptoms: Morning wake-up is creeping earlier each day.\nCurrent Schedule:\n- Night sleep: 10–10.5 hrs\n- Total daytime awake windows: ~10 hrs\n- Daytime naps: 2.5–3 hrs across 2 naps\n- Net total: 23-hour cycle instead of 24.`;
      action = `Using the stated baseline and physiological norms, produce a detailed adjustment protocol for Theodor. If specific wake window distributions (AW1, AW2, AW3) are absent, explicitly note this at the very beginning and formulate the primary plan around the most probable scenario.`;
    } else {
      roleAndContext = `Ты — сертифицированный консультант по детскому сну и эксперт-сомнолог, специализирующийся на физиологии сна младенцев и мягких методиках корректировки режима без стресса для ребенка. ${modelStyleNote}`;
      task = `Проанализировать текущий цикл сна/бодрствования ребенка, выявить причину «23-часовых суток» и составить пошаговый план действий по мягкому растягиванию режима до нормальных 24 часов, чтобы остановить сдвиг утреннего пробуждения.`;
      persistentMaterials = `Возрастные нормы для 10 месяцев: общая суточная потребность во сне обычно составляет 13.5–14 часов, комфортное время бодрствования (ВБ) между снами — около 3.5–4 часов.\nПереход на два дневных сна уже завершен.\nРебенка зовут Теодор.`;
      rules = `Предлагай исключительно мягкие методики корректировки. Избегай радикальных советов и методов экстинкции (типа «оставить проораться»), потому что первостепенна стабильная нервная система ребенка.\nВсегда объясняй причину предлагаемого изменения (например, почему стоит сократить именно утренний, а не обеденный сон, или наоборот), чтобы было четкое понимание физиологических процессов.\nНе давай абстрактных советов вроде «увеличьте бодрствование». Пиши конкретно: на сколько минут в день и в какой именно промежуток (утро/день/вечер) это лучше делать.`;
      badExample = `«Попробуйте будить его раньше с дневных снов или укладывать позже на ночь».`;
      goodExample = `«Чтобы растянуть цикл до 24 часов, нам нужно найти недостающий час. Добавим 15 минут ко времени бодрствования перед первым сном и сократим первый сон на 15 минут, чтобы не перебить усталость ко второму...»`;
      responseFormat = `Выдай ответ строго по следующим блокам:\n\nАнализ цикла: Почему математически сложились 23 часа и где именно кроется дисбаланс для возраста 10 месяцев.\n\nГипотезы и варианты: Что именно нужно корректировать (растягивать ВБ, резать дневные сны или сдвигать ночь).\n\nПошаговый план: Конкретный алгоритм действий на ближайшие 5-7 дней для мягкого выхода на 24-часовой ритм.`;
      inputData = `Симптоматика: Утреннее пробуждение постоянно сдвигается на все более раннее время.\nТекущий режим:\n- Ночной сон: 10–10.5 часов.\n- Суммарное дневное время бодрствования (ВБ): около 10 часов.\n- Дневной сон: 2.5–3 часа суммарно (разделено на 2 дневных сна).\n- Итог: весь цикл занимает 23 часа вместо 24.`;
      action = `Опираясь на вводные данные и физиологические нормы, составь детальный план корректировки режима Теодора. Если для точного ответа не хватает информации о том, как именно распределены эти 10 часов бодрствования в течение дня (какое ВБ1, ВБ2 и ВБ3), прямо укажи на это в начале ответа и распиши план для наиболее вероятного сценария.`;
    }
  } else if (domain === 'code') {
    if (isEn) {
      roleAndContext = `You are a Principal Software Architect and Staff Engineer with deep expertise in clean architecture, type safety, performance profiling, and defensive coding standards. ${modelStyleNote}`;
      task = `Conduct an exhaustive technical review and implement an optimized, production-ready solution based on the user's requirements and codebase parameters.`;
      persistentMaterials = `Engineering Standards: Clean Architecture, strict typing, zero-redundant dependencies, idempotent APIs, comprehensive edge-case handling, and deterministic error responses.`;
      rules = `Never provide partial code snippets with omitted «// todo» placeholders; write complete, executable, and testable implementations.\nAlways accompany design choices with architectural rationale (e.g., why choosing an in-memory queue prevents I/O bottlenecks under high concurrency).\nAvoid premature optimization; prioritize readability and maintainability unless specific latency budgets are violated.\nValidate all boundary conditions and nullability assumptions explicitly.`;
      badExample = `«Just wrap it in a try-catch block and use any for the return type.»`;
      goodExample = `«To prevent silent failures in asynchronous batching, we define a discriminated union Result<T, E> and encapsulate the retry policy within an exponential backoff decorator...»`;
      responseFormat = `1. Architectural Assessment & Vulnerability Audit\n2. Implementation Blueprint with Full Typed Code\n3. Verification & Edge-Case Test Strategy`;
      inputData = `Task: ${rawInput.trim()}\nEnvironment: Modern production stack.`;
      action = `Refactor and produce the complete engineering solution adhering to the stated standards. If any runtime specifications or dependencies are missing, state your assumptions up front and proceed with standard high-performance idioms.`;
    } else {
      roleAndContext = `Ты — ведущий архитектор программного обеспечения (Principal Software Engineer), эксперт по чистому коду, типобезопасности, алгоритмической оптимизации и устойчивым масштабируемым системам. ${modelStyleNote}`;
      task = `Спроектировать, отрефакторить и предоставить production-ready программное решение на основе входного запроса, обеспечивая максимальную надежность и читаемость.`;
      persistentMaterials = `Стандарты разработки: строгая типизация, принципы SOLID/DRY, обработка всех краевых случаев (edge cases), отсутствие скрытых сайд-эффектов, идемпотентность и высокая тестируемость.`;
      rules = `Никогда не выдавай заглушки вида «// тут напишите логику»; код обязан быть законченным, компилируемым и безопасным.\nВсегда обосновывай выбранный паттерн (например, почему выбран паттерн Strategy вместо громоздкого switch/case для масштабируемости обработки событий).\nНе используй небезопасные приведения типов (any, unchecked casts) без строгой физической необходимости.\nУчитывай временную и пространственную сложность (Big O) предлагаемых структур данных.`;
      badExample = `«Оберните этот кусок в try-catch и поставьте any, чтобы не ругался компилятор».`;
      goodExample = `«Чтобы исключить утечку памяти и блокировку event loop при обработке потока данных, реализуем асинхронный генератор с контролируемым буфером и строгим типом Result<T, Error>...»`;
      responseFormat = `Выдай ответ строго по следующим блокам:\n\n1. Архитектурный разбор: Анализ исходного состояния, узкие места и риски.\n2. Реализация: Полный законченный код с комментариями к ключевым механизмам.\n3. Тестирование и граничные случаи: Сценарии проверки и гарантии отказоустойчивости.`;
      inputData = `Входные технические требования:\n${rawInput.trim()}`;
      action = `Опираясь на технические нормы и вводные данные, напиши законченное архитектурное решение. Если не хватает конкретики по версиям библиотек или целевой инфраструктуре, явно укажи допущения в начале и выбери современный промышленный стек.`;
    }
  } else {
    // Общий шаблон (General domain)
    if (isEn) {
      roleAndContext = `You are a distinguished Senior Domain Specialist and Strategic Consultant with comprehensive mastery in structured problem solving and critical analysis. ${modelStyleNote}`;
      task = `Formulate an exhaustive, evidence-backed strategy and actionable execution plan addressing the user's objective: "${rawInput.slice(0, 100)}...".`;
      persistentMaterials = `Methodological Foundation: First-principles reasoning, Pareto 80/20 leverage, cognitive clarity, verifiable milestones, and risk-mitigated decision frameworks.`;
      rules = `Provide strictly actionable, concrete recommendations. Never use superficial fillers such as «do your best» or «optimize processes» without measurable operational parameters.\nAlways explain the «why» behind every recommendation so the rationale is transparent and persuasive.\nStructure recommendations into distinct phases with explicit success criteria for each.`;
      badExample = `«You should improve communication and make sure everything is done on time.»`;
      goodExample = `«To eliminate project bottlenecks by 40%, institute a 15-minute daily asynchronous standup in Slack and enforce a 2-reviewer threshold for pull requests...»`;
      responseFormat = `1. Strategic Diagnosis: Core bottlenecks and leverage points.\n2. Phased Action Roadmap: Detailed timeline with concrete milestones.\n3. Risk Mitigation & Quality Control: Safeguards and contingency protocols.`;
      inputData = `Context & Raw Request:\n${rawInput.trim()}`;
      action = `Execute the strategic analysis based on the input data. If crucial environmental variables or constraints are omitted in the prompt, identify them explicitly in an initial assumptions section, then present the optimal operational plan.`;
    } else {
      roleAndContext = `Ты — ведущий отраслевой эксперт и стратегический консультант высшей квалификации, специализирующийся на глубокой аналитике, системном проектировании решений и доведении сложных задач до конкретного измеримого результата. ${modelStyleNote}`;
      task = `Провести детальный анализ исходной ситуации, декомпозировать задачу пользователя и предоставить структурированную, аргументированную и готовую к мгновенному применению стратегию.`;
      persistentMaterials = `Методологические основы: принятие решений на основе фактов и первых принципов (First Principles), принцип Парето (фокус на ключевых 20% усилий), измеримость метрик (SMART/KPI) и контроль рисков.`;
      rules = `Не давай поверхностных советов вроде «улучшите качество» или «будьте внимательнее». Каждая рекомендация должна содержать конкретные действия, инструменты и измеримые метрики.\nВсегда разъясняй причинно-следственную связь («почему именно так»): модель должна передать логику физиологии/бизнеса/кода, а не сухие приказы.\nОпирайся на проверенные отраслевые практики и стандарты качества.`;
      badExample = `«Попробуйте лучше организовать процессы и повысить общую эффективность работы».`;
      goodExample = `«Чтобы устранить каскадную задержку, внедрим трехуровневую фильтрацию входящих задач: 1) автоматическая triage-сортировка, 2) лимит WIP (Work in Progress) не более 3 задач на исполнителя...»`;
      responseFormat = `Выдай ответ строго по следующим блокам:\n\n1. Анализ ситуации: Ключевой дисбаланс, корневая причина и диагностика факторов.\n2. Варианты и гипотезы: Сравнение возможных путей решения с оценкой трудозатрат.\n3. Пошаговый план действий: Конкретный календарный алгоритм на ближайшие этапы с критериями приемки.`;
      inputData = `Входные данные запроса:\n${rawInput.trim()}`;
      action = `Опираясь на вводные данные и принципы системного анализа, составь детальный план решения задачи. Если не хватает конкретных вводных параметров (сроки, бюджет, текущие метрики), прямо укажи на это в начале ответа и распиши алгоритм для наиболее вероятного базового сценария.`;
    }
  }

  // Форматированный текст
  const formattedText = `Системное сообщение (System Prompt)

[Роль и контекст]
${roleAndContext}

[Задача]
${task}

[Постоянные материалы]
${persistentMaterials}

[Правила]
${rules}

[Примеры (Few-shot)]
Пример плохого ответа: ${badExample}

Пример хорошего ответа: ${goodExample}

[Формат ответа]
${responseFormat}

Пользовательское сообщение (User Prompt)

[Вводные данные]
${inputData}

[Действие]
${action}`;

  return {
    systemPrompt: {
      roleAndContext,
      task,
      persistentMaterials,
      rules,
      fewShot: {
        bad: badExample,
        good: goodExample,
      },
      responseFormat,
    },
    userPrompt: {
      inputData,
      action,
    },
    formattedText,
    metaPromptUsed,
    metadata: {
      model,
      language,
      createdAt: new Date().toISOString(),
      originalWordCount: rawInput.trim().split(/\s+/).filter(Boolean).length,
      optimizedWordCount: formattedText.trim().split(/\s+/).filter(Boolean).length,
    },
  };
}
