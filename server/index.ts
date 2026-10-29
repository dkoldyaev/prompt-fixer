import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildMetaPrompt } from '../src/services/metaPromptBuilder';
import { generateStructuredTextFallback } from '../src/services/smartRewriter';

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
    geminiKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    mistralKey: Boolean(process.env.MISTRAL_API_KEY),
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

/**
 * Возвращает список доступных моделей (только тех, для которых есть ключи в .env)
 */
app.get('/api/models', (_req, res) => {
  const models = [];

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    models.push({ id: 'gemini', name: 'Gemini' });
  }
  if (process.env.MISTRAL_API_KEY) {
    models.push({ id: 'mistral', name: 'Mistral' });
  }
  if (process.env.OPENAI_API_KEY) {
    models.push({ id: 'gpt', name: 'GPT' });
  }

  // Если вдруг ни одного ключа не задано, хотя бы Gemini предлагаем
  if (models.length === 0) {
    models.push({ id: 'gemini', name: 'Gemini' });
  }

  res.json({ models });
});

/**
 * Рерайтинг промпта с единым мета-промптом для всех моделей
 */
app.post('/api/rewrite', async (req, res) => {
  try {
    const { rawPrompt, targetModel = 'gemini', targetLanguage = 'ru' } = req.body;

    if (!rawPrompt || typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
      return res.status(400).json({ error: 'Поле rawPrompt обязательно для заполнения' });
    }

    // Единый мета-промпт для всех моделей
    const metaPrompt = buildMetaPrompt(rawPrompt, targetLanguage);
    let outputText: string | null = null;

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const mistralKey = process.env.MISTRAL_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (targetModel === 'mistral' && mistralKey) {
      try {
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${mistralKey}`,
          },
          body: JSON.stringify({
            model: 'mistral-small-latest',
            messages: [
              { role: 'system', content: metaPrompt.systemPrompt },
              { role: 'user', content: metaPrompt.userPrompt },
            ],
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data = await response.json();
          outputText = data.choices?.[0]?.message?.content || null;
        } else {
          console.warn(`[MISTRAL] Error status ${response.status}`);
        }
      } catch (err: any) {
        console.warn(`[MISTRAL] Fetch error: ${err.message}`);
      }
    } else if (targetModel === 'gpt' && openaiKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: metaPrompt.systemPrompt },
              { role: 'user', content: metaPrompt.userPrompt },
            ],
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data = await response.json();
          outputText = data.choices?.[0]?.message?.content || null;
        } else {
          console.warn(`[OPENAI] Error status ${response.status}`);
        }
      } catch (err: any) {
        console.warn(`[OPENAI] Fetch error: ${err.message}`);
      }
    } else if (geminiKey) {
      // Gemini
      const candidateModels = ['gemini-3.8-flash', 'gemini-2.5-pro', 'gemini-flash-latest'];
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
                  parts: [{ text: `${metaPrompt.systemPrompt}\n\n---\n\n${metaPrompt.userPrompt}` }],
                },
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
            outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
            if (outputText) break;
          }
        } catch (err: any) {
          console.warn(`[GEMINI] Model ${mName} error: ${err.message}`);
        }
      }
    }

    // Если внешнее API временно недоступно (например, rate-limit), возвращаем структурированный fallback
    if (!outputText || !outputText.trim()) {
      outputText = generateStructuredTextFallback(rawPrompt, targetLanguage);
    }

    res.json({
      success: true,
      rewrittenPrompt: outputText.trim(),
    });
  } catch (error: any) {
    console.error('Rewrite error:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Раздача клиентской сборки
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.use((_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('API Server is running.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Prompt Fixer server running on port ${PORT}`);
});
