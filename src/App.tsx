import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ModelSelector } from './components/ModelSelector';
import { LanguageSelector } from './components/LanguageSelector';
import { PromptInput } from './components/PromptInput';
import { PromptOutput } from './components/PromptOutput';
import { SettingsModal } from './components/SettingsModal';
import { PresetsModal } from './components/PresetsModal';
import { RulesExplainerModal } from './components/RulesExplainerModal';
import { StructuredPromptResult, TargetLanguage, TargetModel } from './types';
import { buildMetaPrompt } from './services/metaPromptBuilder';
import { generateLocalStructuredPrompt } from './services/smartRewriter';

const THEODOR_RAW_PROMPT = `Помоги составить режим сна для ребенка Теодора 10 месяцев. У него сейчас утреннее пробуждение сдвигается все раньше и раньше, получается 23 часа в сутках вместо 24: спит ночью 10-10.5 часов, бодрствует 10 часов, и два дневных сна на 2.5-3 часа. Нужно мягко растянуть сутки до 24 часов без стресса и слез. Напиши конкретно что делать.`;

export const App: React.FC = () => {
  const [rawPrompt, setRawPrompt] = useState<string>(THEODOR_RAW_PROMPT);
  const [targetModel, setTargetModel] = useState<TargetModel>('gpt');
  const [targetLanguage, setTargetLanguage] = useState<TargetLanguage>('ru');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [result, setResult] = useState<StructuredPromptResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [executionSource, setExecutionSource] = useState<'llm' | 'smart_optimizer'>('smart_optimizer');
  const [executionNote, setExecutionNote] = useState<string | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // API Keys in LocalStorage
  const [apiKeys, setApiKeys] = useState<{ gemini?: string; openai?: string; mistral?: string }>(() => {
    try {
      const saved = localStorage.getItem('prompt_architect_api_keys');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSaveKeys = (keys: { gemini?: string; openai?: string; mistral?: string }) => {
    setApiKeys(keys);
    localStorage.setItem('prompt_architect_api_keys', JSON.stringify(keys));
  };

  const handleRewrite = async () => {
    if (!rawPrompt.trim()) return;

    setIsLoading(true);
    setExecutionNote(null);

    try {
      const response = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawPrompt,
          targetModel,
          targetLanguage,
          additionalInstructions,
          apiKeys,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          setResult(data.result);
          setExecutionSource(data.source || 'smart_optimizer');
          setExecutionNote(data.executionNote || null);
          setIsLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('API fetch failed, falling back to client-side smart optimizer:', err);
    }

    // Если бэкенд не ответил или вернул ошибку, бесшовно используем клиентский генератор
    const metaPrompt = buildMetaPrompt(rawPrompt, targetModel, targetLanguage, additionalInstructions);
    const localResult = generateLocalStructuredPrompt(rawPrompt, targetModel, targetLanguage, metaPrompt);

    setResult(localResult);
    setExecutionSource('smart_optimizer');
    setIsLoading(false);
  };

  // Автоматический рерайт при первом запуске с примером Теодора
  useEffect(() => {
    handleRewrite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      {/* Top Header */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onOpenRules={() => setIsRulesOpen(true)}
        hasCustomKeys={Boolean(apiKeys.gemini || apiKeys.openai || apiKeys.mistral)}
      />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls Bar: Model & Language */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 mb-6 backdrop-blur-sm shadow-xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Параметры трансформации
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Выберите целевую языковую модель и язык вывода. Архитектура промпта и мета-запрос адаптируются автоматически.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <ModelSelector
                selectedModel={targetModel}
                onSelectModel={(model) => {
                  setTargetModel(model);
                }}
              />
            </div>
            <div className="lg:col-span-1">
              <LanguageSelector
                selectedLanguage={targetLanguage}
                onSelectLanguage={(lang) => {
                  setTargetLanguage(lang);
                }}
              />
            </div>
          </div>
        </section>

        {/* Two Columns: Input and Output */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Input */}
          <section className="space-y-4">
            <PromptInput
              value={rawPrompt}
              onChange={setRawPrompt}
              onSubmit={handleRewrite}
              isLoading={isLoading}
              onLoadExample={() => {
                setRawPrompt(THEODOR_RAW_PROMPT);
                setTargetModel('gpt');
                setTargetLanguage('ru');
              }}
              additionalInstructions={additionalInstructions}
              onChangeAdditionalInstructions={setAdditionalInstructions}
            />
          </section>

          {/* Right: Output */}
          <section className="space-y-4">
            <PromptOutput
              result={result}
              isLoading={isLoading}
              source={executionSource}
              executionNote={executionNote}
            />
          </section>
        </div>
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKeys={apiKeys}
        onSaveKeys={handleSaveKeys}
      />

      <PresetsModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelectPreset={(preset) => {
          setRawPrompt(preset.rawPrompt);
          setTargetModel(preset.targetModel);
          setTargetLanguage(preset.targetLanguage);
        }}
      />

      <RulesExplainerModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
};
