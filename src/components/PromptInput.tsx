import React, { useState } from 'react';
import { Sparkles, Trash2, Baby, SlidersHorizontal, ArrowRight, CornerDownLeft } from 'lucide-react';

interface PromptInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onLoadExample: () => void;
  additionalInstructions: string;
  onChangeAdditionalInstructions: (val: string) => void;
}

export const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading,
  onLoadExample,
  additionalInstructions,
  onChangeAdditionalInstructions,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSubmit();
      }
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        {/* Header inside Input card */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-500 ring-4 ring-brand-500/20" />
            <h2 className="text-sm font-semibold text-white">Исходный сырой промпт</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLoadExample}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition"
              title="Загрузить пример про консультанта по сну для Теодора"
            >
              <Baby className="w-3.5 h-3.5" />
              <span>Пример задания (Теодор)</span>
            </button>

            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
                title="Очистить поле"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={9}
            placeholder="Вставьте сюда любой черновой, неструктурированный запрос или задачу. Например: «Помоги составить режим сна для ребенка 10 месяцев...» или «Напиши функцию проверки токенов с обработкой ошибок...»"
            className="w-full bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-sans leading-relaxed resize-none transition"
          />

          <div className="absolute bottom-3 right-3 flex items-center gap-2 text-[11px] text-slate-500 pointer-events-none bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800">
            <span>{wordCount} слов</span>
            <span>•</span>
            <span>{charCount} симв.</span>
          </div>
        </div>

        {/* Advanced Instructions Toggle */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition font-medium"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-brand-400" />
            <span>Дополнительные параметры и акценты</span>
            <span className="text-[10px] text-slate-500">
              {showAdvanced ? '(свернуть)' : '(развернуть)'}
            </span>
          </button>

          {showAdvanced && (
            <div className="mt-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
              <label className="block text-slate-400 font-medium">
                Специфические требования к тону, методологии или формату:
              </label>
              <input
                type="text"
                value={additionalInstructions}
                onChange={(e) => onChangeAdditionalInstructions(e.target.value)}
                placeholder="Например: 'Строго научный тон', 'Сделать упор на физиологию кортизола', 'Без вводных слов'"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500">
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">Ctrl</kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400">Enter</kbd>
          <span>для быстрой отправки</span>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim() || isLoading}
          className={`w-full sm:w-auto px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-lg ${
            !value.trim() || isLoading
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : 'bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-brand-500/25 hover:shadow-brand-500/40 transform hover:-translate-y-0.5'
          }`}
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Трансформация промпта...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-white" />
              <span>Переписать по правилам</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
