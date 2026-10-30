# 🚀 AI Prompt Rewriter (Google Antigravity Edition)

Полнофункциональное веб-приложение профессионального уровня для преобразования коротких, неструктурированных и неполных запросов в качественные, подробные и технически точные технические задания (System Prompt + User Prompt) для автономных AI coding agents (**Google Antigravity**, **Claude Code**, **Cursor**, **Universal Agent**, **Generic LLM**).

Сервис выполняет глубокий семантический анализ требований, выявляет архитектурные и логические пробелы, формулирует бизнес-инварианты, синтезирует архитектурные решения (AD), формирует исчерпывающее ТЗ с финальным действием и верифицирует матрицу покрытия требований.

---

## 🏗 Архитектура системы

```text
/
├── packages/
│   ├── shared/                # Строгая конфигурация Zod, типы данных, каталог тарифов
│   │   ├── config.ts          # Centralized Strict Configuration Loader (No Fallbacks)
│   │   ├── types.ts           # Схемы Zod: Requirements, Architecture, Prompts, Review
│   │   └── pricing.ts         # Версионируемый каталог тарифов OpenAI
│   ├── prompt-templates/      # Версионируемые системные шаблоны (Global + Target)
│   │   └── index.ts
│   └── ai-pipeline/           # Оркестрация вызовов AI, классификатор сложности, трассировка
│       ├── complexityClassifier.ts # Детерминированная оценка сложности для Adaptive mode
│       ├── traceabilityEngine.ts   # Матрица трассируемости требований REQ-001..REQ-xxx
│       ├── llmClient.ts            # OpenAI Responses API клиент и офлайн-симулятор
│       └── orchestrator.ts         # Поэтапная оркестрация и Surgical Revision engine
├── server/
│   ├── index.ts               # Express 5 API сервер с поддержкой SSE потока событий
│   └── database.ts            # PostgreSQL Storage + In-Memory Fallback Adapter
├── src/                       # React 19 Frontend (Tailwind CSS v4, Lucide)
│   ├── components/
│   │   ├── Navbar.tsx         # Навигация (Создать, История, Шаблоны, Настройки)
│   │   ├── PromptCreator.tsx  # Редактор запроса, оценка сложности, выбор сред и пресеты
│   │   ├── ExecutionModal.tsx # Живой SSE модальный экран с 4-этапным степпером
│   │   ├── ResultView.tsx     # Просмотр ТЗ, System Prompt, Diff, экспорт MD/ZIP
│   │   ├── DiffViewer.tsx     # Построчное сравнение версий (line-by-line diff)
│   │   ├── HistoryView.tsx    # История проектов, версионирование, переименование
│   │   ├── TemplatesView.tsx  # Управление и редактирование промпт-шаблонов
│   │   └── SettingsView.tsx   # Статус конфигурации, модели по этапам, тарифы
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── unit/                  # Юнит-тесты (config, complexity, traceability, pricing)
│   ├── integration/           # Интеграционные тесты пайплайна и API
│   │   ├── api.test.ts
│   │   ├── pipeline.test.ts
│   │   └── benchmark.test.ts  # 8 эталонных кейсов (PWA, React, Docker, Go gRPC и др.)
│   └── e2e/
│       └── scenarios.test.ts  # 15 обязательных пользовательских E2E-сценариев
├── docker-compose.yml         # Базовый Compose (без PostgreSQL, подключение к внешней БД)
├── docker-compose.override.yml# Локальный Override Compose (с PostgreSQL и healthcheck)
├── Dockerfile                 # Multi-stage production build
├── .env.example               # Полная спецификация обязательных переменных среды
└── README.md
```

---

## ⚡ Режимы генерации

1. **Fast Mode**:
   - 1 комбинированный вызов к LLM со структурированным JSON Schema выводом.
   - Подходит для локальных, простых задач (небольшой рефакторинг, добавление утилиты).
2. **Quality Mode**:
   - 4 последовательных изолированных этапа:
     1. **Requirements Analyzer**: извлечение явных (`explicit`), логически необходимых (`inferred`) и предложенных (`proposed`) требований с уникальными ID (`REQ-001`, `REQ-002`...), инвариантов, противоречий, edge cases и рисков.
     2. **Solution Architect**: синтез сущностей, границ компонентов, стека, стратегии хранения (IndexedDB + PostgreSQL), обработки ошибок и архитектурных решений (`AD-001`, `AD-002`...).
     3. **Prompt Composer**: синтез System Prompt (роль, принципы, обоснованные правила, few-shot примеры) и User Prompt (подробное ТЗ из 16 разделов с Final Action в конце).
     4. **Quality Reviewer**: аудит матрицы трассируемости требований, проверка покрытия критических сценариев и хирургическое устранение дефектов.
3. **Adaptive Mode** (по умолчанию):
   - Детерминированная оценка сложности входящего запроса (объем, ключевые слова инфраструктуры, баз данных, PWA, очередей, противоречия).
   - Автоматический выбор Fast или Quality с прозрачным обоснованием для пользователя.

---

## 🎯 Поддерживаемые целевые среды

- **Google Antigravity**: инструкции для автономной работы в терминале, файловой системе, выполнения верификационных тестов, кликабельных ссылок и работы в песочнице.
- **Claude Code**: инструменты CLI (Bash, View, Edit, Glob, Grep) и git-ветвление.
- **Cursor**: правила `.cursorrules`, директивы Composer и ссылки `@file`.
- **Universal Agent**: стандартный цикл Plan -> Act -> Inspect -> Test -> Verify.
- **Generic LLM**: автономный структурированный Markdown для выполнения человеком.

---

## 🔍 Хирургическое редактирование (Surgical Revision)

Пользователь может в один клик отправить дополнительную инструкцию к готовому результату:
> *«Убери авторизацию. Это приложение только для одного пользователя.»*

Revision Pipeline:
1. Анализирует текущую версию и указанную инструкцию.
2. Хирургически обновляет затронутые разделы и инварианты без полной перегенерации всего документа.
3. Присваивает приоритет новой инструкции пользователя.
4. Создает новую неизменяемую версию (`v2`, `v3`...) и формирует список изменений (changelog).
5. Позволяет мгновенно сравнить версии во встроенном Diff Viewer.

---

## 🔒 Строгая политика конфигурации (No-Fallback Policy)

Все конфигурируемые значения окружения задаются строго через environment variables.
Конструкции наподобие `process.env.PORT || '3000'` или `??` **полностью исключены**.

При отсутствии или некорректности любой обязательной переменной приложение завершается с понятной ошибкой до начала обслуживания запросов:

| Переменная | Описание | Пример |
|---|---|---|
| `DATABASE_URL` | URL подключения к PostgreSQL | `postgresql://postgres:postgres@localhost:5432/prompt_rewriter` |
| `OPENAI_API_KEY` | Ключ OpenAI API (или `mock-key` для офлайн-симуляции) | `sk-...` / `mock-key` |
| `API_PORT` | Порт HTTP API сервера (число) | `3000` |
| `PUBLIC_APP_ORIGIN` | URL веб-приложения для CORS | `http://localhost:3000` |
| `OPENAI_ANALYZER_MODEL` | Модель этапа анализа требований | `gpt-4o` |
| `OPENAI_ARCHITECT_MODEL` | Модель этапа проектирования архитектуры | `gpt-4o` |
| `OPENAI_COMPOSER_MODEL` | Модель этапа компоновки промптов | `gpt-4o` |
| `OPENAI_REVIEWER_MODEL` | Модель этапа аудита качества | `gpt-4o` |
| `OPENAI_FAST_MODEL` | Модель экспресс-режима (Fast mode) | `gpt-4o-mini` |
| `AI_MAX_OUTPUT_TOKENS` | Максимальный лимит токенов ответа | `4096` |
| `AI_RETRY_LIMIT` | Количество повторов при сетевых сбоях | `3` |
| `AI_REQUEST_TIMEOUT_MS` | Таймаут вызова к API (мс) | `60000` |
| `AI_MAX_JOB_COST` | Максимальный бюджет генерации в USD | `3.00` |
| `LOG_LEVEL` | Уровень логирования (`debug`/`info`/`warn`/`error`) | `info` |

---

## 🐳 Docker & Docker Compose

### 1. Запуск с внешней базой данных PostgreSQL
Основной файл `docker-compose.yml` **не содержит** PostgreSQL. Подключение идет через внешнюю БД:
```bash
docker compose -f docker-compose.yml up -d
```

### 2. Запуск с локальной базой данных PostgreSQL
Файл `docker-compose.override.yml` добавляет изолированный контейнер PostgreSQL 16 с healthcheck и томом данных:
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```
*(При стандартном `docker compose up -d` файл override подключается автоматически).*

---

## 🧪 Тестирование

Проект содержит 100% покрытие автоматизированными тестами (Unit, Integration, AI Benchmark, E2E):

```bash
# Проверка типов (TypeScript Strict Mode)
npm run lint

# Запуск полного набора тестов (Vitest)
npm test

# Сборка production-дистрибутива
npm run build
```

Набор тестов верифицирует:
1. Валидацию строгой конфигурации при старте процесса.
2. Детерминированный классификатор сложности.
3. Матрицу трассируемости требований (Traceability Engine).
4. Расчет токенов и стоимости по каталогу тарифов.
5. Интеграцию всех 4 этапов Quality режима, Fast режима и SSE-стриминга.
6. Хирургическое редактирование через ревизии.
7. 8 эталонных бенчмарк-кейсов (PWA, React, Go gRPC, Docker fullstack, противоречивые запросы и др.).
8. 15 обязательных пользовательских E2E-сценариев.
