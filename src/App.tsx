import React, { useState, useEffect } from 'react';
import { Copy, Check, ArrowRight, Loader2, Sparkles } from 'lucide-react';

interface ModelItem {
  id: string;
  name: string;
}

const LANGUAGES = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'de', name: 'Deutsch' },
  { id: 'fr', name: 'Français' },
  { id: 'zh', name: '中文' },
];

export const App: React.FC = () => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [outputPrompt, setOutputPrompt] = useState('');
  const [availableModels, setAvailableModels] = useState<ModelItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ru');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Загрузка доступных моделей с сервера (только те, для которых есть ключи)
  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          setSelectedModel(data.models[0].id);
        }
      })
      .catch((err) => console.warn('Failed to load models:', err));
  }, []);

  const handleRewrite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawPrompt: inputPrompt,
          targetModel: selectedModel,
          targetLanguage: selectedLanguage,
        }),
      });

      const data = await res.json();
      if (data.rewrittenPrompt) {
        setOutputPrompt(data.rewrittenPrompt);
      }
    } catch (err) {
      console.error('Rewrite failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!outputPrompt) return;
    try {
      await navigator.clipboard.writeText(outputPrompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 sm:p-8 font-sans selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-3xl space-y-6 my-auto py-6">
        {/* Заголовок */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-600/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">Prompt Fixer</h1>
          </div>
          <span className="text-xs text-slate-400 font-mono">2-Tier Architecture</span>
        </div>

        {/* Форма */}
        <form onSubmit={handleRewrite} className="space-y-4">
          {/* Панель настроек: Модель и Язык */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Селектор модели (только те, для которых есть ключи) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Модель
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                {availableModels.length > 0 ? (
                  availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                ) : (
                  <option value="gemini">Gemini</option>
                )}
              </select>
            </div>

            {/* Выбор языка */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Язык вывода
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Поле ввода */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Исходный промпт
            </label>
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Введите сюда ваш черновой промпт..."
              rows={6}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition leading-relaxed resize-y"
            />
          </div>

          {/* Кнопка отправки */}
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className={`w-full py-3 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition duration-150 shadow-md ${
              !inputPrompt.trim() || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Переписываю по правилам...</span>
              </>
            ) : (
              <>
                <span>Переписать</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Результат */}
        {outputPrompt && (
          <div className="space-y-2 pt-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Отредактированный промпт
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition py-1 px-2.5 rounded-lg hover:bg-blue-500/10"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Скопировано!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Скопировать</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 font-sans text-sm text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[550px] overflow-y-auto">
              {outputPrompt}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
