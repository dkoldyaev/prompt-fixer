import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMetaPrompt } from '../src/services/metaPromptBuilder';
import { parseStructuredPrompt, generateLocalStructuredPrompt } from '../src/services/smartRewriter';
import { TargetLanguage, TargetModel } from '../src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    timestamp: new Date().toISOString()
  });
});

// Предустановленные примеры для удобства пользователя
const PRESETS = [
  {
    id: 'theodor-sleep',
    title: 'Консультант по сну (Пример из задания)',
    category: 'Медицина и родительство',
    description: 'Оптимизация режима сна Теодора: выход из 23-часового цикла с мягкими методиками.',
    rawPrompt: `Помоги составить режим сна для ребенка Теодора 10 месяцев. У него сейчас утреннее пробуждение сдвигается все раньше и раньше, получается 23 часа в сутках вместо 24: спит ночью 10-10.5 часов, бодрствует 10 часов, и два дневных сна на 2.5-3 часа. Нужно мягко растянуть сутки до 24 часов без стресса и слез. Напиши конкретно что делать.`,
    targetModel: 'gpt' as TargetModel,
    targetLanguage: 'ru' as TargetLanguage,
  },
  {
    id: 'code-refactor',
    title: 'Архитектор кода / Refactoring',
    category: 'Разработка',
    description: 'Глубокий рефакторинг спагетти-кода в Clean Architecture с типами и тестами.',
    rawPrompt: `Сделай код нормальным. У меня на Node.js асинхронная очередь задач постоянно падает с Out of Memory, когда приходит больше 1000 запросов. Напиши как исправить и перепиши нормально.`,
    targetModel: 'gemini' as TargetModel,
    targetLanguage: 'ru' as TargetLanguage,
  },
  {
    id: 'b2b-sales-copy',
    title: 'B2B Маркетолог и Копирайтер',
    category: 'Маркетинг и продажи',
    description: 'Холодное коммерческое предложение для enterprise-клиентов по фреймворку AIDA/PAS.',
    rawPrompt: `Write an effective cold outreach email to CTOs of fintech startups offering our automated API security scanner. Make it sound non-pushy and highlight tangible ROI.`,
    targetModel: 'mistral' as TargetModel,
    targetLanguage: 'en' as TargetLanguage,
  },
  {
    id: 'legal-contract-review',
    title: 'Юрист по коммерческому праву',
    category: 'Юриспруденция',
    description: 'Аудит договора на скрытые риски, штрафы и односторонний отказ.',
    rawPrompt: `Проверь договор подряда на разработку ПО. Нужно найти все кабальные условия для исполнителя, скрытые неустойки и риски с передачей исключительных прав.`,
    targetModel: 'gpt' as TargetModel,
    targetLanguage: 'ru' as TargetLanguage,
  },
];

app.get('/api/presets', (_req, res) => {
  res.json({ presets: PRESETS });
});

/**
 * Эндпоинт рерайтинга промпта
 */
app.post('/api/rewrite', async (req, res) => {
  try {
    const {
      rawPrompt,
      targetModel = 'gpt',
      targetLanguage = 'ru',
      additionalInstructions = '',
      apiKeys = {},
    } = req.body;

    if (!rawPrompt || typeof rawPrompt !== 'string') {
      return res.status(400).json({ error: 'Параметр rawPrompt обязателен' });
    }

    // 1. Формируем мета-промпт, строго следующий заданным правилам
    const metaPrompt = buildMetaPrompt(
      rawPrompt,
      targetModel as TargetModel,
      targetLanguage as TargetLanguage,
      additionalInstructions
    );

    let llmResponseText: string | null = null;
    let executionSource: 'llm' | 'smart_optimizer' = 'smart_optimizer';
    let executionError: string | null = null;

    // 2. Пытаемся вызвать внешнюю модель, если есть ключи
    const geminiKey = apiKeys.gemini || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const openaiKey = apiKeys.openai || process.env.OPENAI_API_KEY;
    const mistralKey = apiKeys.mistral || process.env.MISTRAL_API_KEY;

    if (targetModel === 'gpt' && openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: metaPrompt.systemPrompt },
              { role: 'user', content: metaPrompt.userPrompt },
            ],
            temperature: 0.3,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          llmResponseText = data.choices?.[0]?.message?.content || null;
          if (llmResponseText) executionSource = 'llm';
        } else {
          executionError = `OpenAI API returned status ${response.status}`;
        }
      } catch (err: any) {
        executionError = `OpenAI request failed: ${err.message}`;
      }
    } else if (targetModel === 'mistral' && mistralKey) {
      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mistralKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-large-latest',
            messages: [
              { role: 'system', content: metaPrompt.systemPrompt },
              { role: 'user', content: metaPrompt.userPrompt },
            ],
            temperature: 0.3,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          llmResponseText = data.choices?.[0]?.message?.content || null;
          if (llmResponseText) executionSource = 'llm';
        } else {
          executionError = `Mistral API returned status ${response.status}`;
        }
      } catch (err: any) {
        executionError = `Mistral request failed: ${err.message}`;
      }
    } else if (geminiKey) {
      // Вызов Google Gemini API
      const candidateModels = [
        'gemini-3.8-flash',
        'gemini-2.5-pro',
        'gemini-flash-latest',
        'gemini-2.5-flash'
      ];
      
      console.log(`[REWRITE] Calling Gemini API for model=${targetModel}, lang=${targetLanguage}...`);
      
      for (const mName of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${geminiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `${metaPrompt.systemPrompt}\n\n---\n\n${metaPrompt.userPrompt}`
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 3500,
              },
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (response.ok) {
            const data = await response.json();
            llmResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (llmResponseText) {
              executionSource = 'llm';
              console.log(`[REWRITE] Successfully generated via Gemini (${mName})!`);
              break;
            }
          } else {
            const errBody = await response.text();
            console.warn(`[REWRITE] Gemini ${mName} returned status ${response.status}: ${errBody.slice(0, 150)}`);
          }
        } catch (err: any) {
          executionError = `Gemini model ${mName} note: ${err.message}`;
        }
      }
    }

    // 3. Формируем результат
    let result;
    if (llmResponseText) {
      result = parseStructuredPrompt(
        llmResponseText,
        targetModel as TargetModel,
        targetLanguage as TargetLanguage,
        metaPrompt,
        rawPrompt
      );
    } else {
      // Используем умный локальный генератор
      result = generateLocalStructuredPrompt(
        rawPrompt,
        targetModel as TargetModel,
        targetLanguage as TargetLanguage,
        metaPrompt
      );
    }

    res.json({
      success: true,
      result,
      source: executionSource,
      metaPrompt,
      executionNote: executionError,
    });
  } catch (error: any) {
    console.error('Rewrite error:', error);
    res.status(500).json({ error: error.message || 'Внутренняя ошибка сервера' });
  }
});

// Если запущено в продакшене, раздаем собранные статические файлы
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.use((_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('API Server is running. Start Vite dev server for frontend.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Prompt Fixer backend is running on http://localhost:${PORT}`);
});
