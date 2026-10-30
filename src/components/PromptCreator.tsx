import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Sliders,
  Trash2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Zap,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { TargetEnvironment, GenerationMode, DetailLevel, ComplexityAssessment } from '../../packages/shared/types';
import { evaluatePromptComplexity } from '../../packages/ai-pipeline/complexityClassifier';

interface PromptCreatorProps {
  onGenerate: (data: {
    rawPrompt: string;
    targetEnvironment: TargetEnvironment;
    generationMode: GenerationMode;
    preferences: {
      targetLanguage: string;
      detailLevel: DetailLevel;
      includeArchitecturalAdditions: boolean;
      includeExplanations: boolean;
      customInstructions?: string;
    };
  }) => void;
  isLoading: boolean;
  initialPrompt?: string;
  initialTarget?: TargetEnvironment;
}

const PRESETS = [
  {
    title: 'PWA для публикации фото',
    text: 'Создай PWA для публикации фотографий. Я загружаю несколько фотографий, приложение распределяет их по одной в день и присылает уведомления. Если пропустил публикацию, график должен сместиться. Используй PostgreSQL, TypeScript, Docker. Все настройки только через .env, без fallback.',
    target: 'google-antigravity' as TargetEnvironment,
  },
  {
    title: 'Рефакторинг React-компонента',
    text: 'Сделай рефакторинг компонента UserProfile: вынеси аватар и контакты в подкомпоненты, добавь useMemo для форматирования даты, напиши юнит-тесты на Vitest.',
    target: 'cursor' as TargetEnvironment,
  },
  {
    title: 'REST API микросервис',
    text: 'Разработай REST API для бронирования переговорных комнат с JWT авторизацией, ролями (admin/user), миграциями PostgreSQL и интеграцией с Google Calendar.',
    target: 'claude-code' as TargetEnvironment,
  },
  {
    title: 'Docker Fullstack сервис',
    text: 'Создай сервис мониторинга цен на криптовалюты: сборщик данных, PostgreSQL, Redis для кэша, Express API и docker-compose с healthcheck.',
    target: 'universal-agent' as TargetEnvironment,
  },
];

export const PromptCreator: React.FC<PromptCreatorProps> = ({
  onGenerate,
  isLoading,
  initialPrompt,
  initialTarget,
}) => {
  const [rawPrompt, setRawPrompt] = useState<string>(() => {
    return initialPrompt || localStorage.getItem('ai_prompt_rewriter_draft') || '';
  });

  const [targetEnvironment, setTargetEnvironment] = useState<TargetEnvironment>(
    initialTarget || 'google-antigravity'
  );

  useEffect(() => {
    if (initialPrompt !== undefined) {
      setRawPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (initialTarget !== undefined) {
      setTargetEnvironment(initialTarget);
    }
  }, [initialTarget]);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('adaptive');
  const [targetLanguage, setTargetLanguage] = useState<string>('ru');
  const [detailLevel, setDetailLevel] = useState<DetailLevel>('detailed');
  const [includeArchitecturalAdditions, setIncludeArchitecturalAdditions] = useState<boolean>(true);
  const [includeExplanations, setIncludeExplanations] = useState<boolean>(true);
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [complexity, setComplexity] = useState<ComplexityAssessment | null>(null);

  // Auto-save draft to localStorage
  useEffect(() => {
    localStorage.setItem('ai_prompt_rewriter_draft', rawPrompt);
    if (rawPrompt.trim().length > 5) {
      const assessment = evaluatePromptComplexity(rawPrompt);
      setComplexity(assessment);
    } else {
      setComplexity(null);
    }
  }, [rawPrompt]);

  const tokenEstimate = Math.ceil(rawPrompt.length / 3.8);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPrompt.trim() || isLoading) return;

    onGenerate({
      rawPrompt,
      targetEnvironment,
      generationMode,
      preferences: {
        targetLanguage,
        detailLevel,
        includeArchitecturalAdditions,
        includeExplanations,
        customInstructions: customInstructions.trim() || undefined,
      },
    });
  };

  const handleClear = () => {
    setRawPrompt('');
    localStorage.removeItem('ai_prompt_rewriter_draft');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preset pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Примеры:
        </span>
        {PRESETS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              setRawPrompt(p.text);
              setTargetEnvironment(p.target);
            }}
            className="px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 shrink-0 transition-colors"
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Main Input Editor */}
      <div className="relative rounded-2xl bg-slate-900 border border-slate-800 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-xl">
        <textarea
          value={rawPrompt}
          onChange={(e) => setRawPrompt(e.target.value)}
          placeholder="Опишите вашу идею или требования свободным языком... (например: Создай PWA для публикации фотографий. Я загружаю несколько фотографий, приложение распределяет их по одной в день и присылает уведомления. Если пропустил публикацию, график должен сместиться. Используй PostgreSQL, TypeScript, Docker. Все настройки только через .env, без fallback.)"
          rows={7}
          className="w-full bg-transparent p-5 text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none resize-y min-h-[160px] leading-relaxed font-sans"
        />

        {/* Textarea Bottom Toolbar */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/60 rounded-b-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-slate-400">
            <span>Символов: <strong className="text-slate-200">{rawPrompt.length}</strong></span>
            <span>Токенов (прим.): <strong className="text-indigo-400">~{tokenEstimate}</strong></span>
            {complexity && (
              <span
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full font-medium ${
                  complexity.recommendedMode === 'quality'
                    ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                }`}
                title={complexity.explanation}
              >
                <Cpu className="w-3 h-3" />
                Сложность: {complexity.score}/100 ({complexity.recommendedMode.toUpperCase()})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {rawPrompt && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 text-slate-400 hover:text-rose-400 px-2 py-1 rounded transition-colors"
                title="Очистить черновик"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Очистить</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Configuration Row: Target Environment & Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Target Environment */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Целевая среда агента:</span>
            <span className="text-[11px] text-indigo-400 lowercase">Target context</span>
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { id: 'google-antigravity', label: 'Google Antigravity' },
              { id: 'claude-code', label: 'Claude Code' },
              { id: 'cursor', label: 'Cursor' },
              { id: 'universal-agent', label: 'Universal Agent' },
              { id: 'generic-llm', label: 'Generic LLM' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTargetEnvironment(t.id as TargetEnvironment)}
                className={`px-3 py-2 rounded-lg font-medium text-left transition-all ${
                  targetEnvironment === t.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Generation Mode */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Режим генерации:</span>
            <span className="text-[11px] text-amber-400 lowercase">Pipeline depth</span>
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { id: 'adaptive', label: 'Adaptive', icon: Cpu, desc: 'Авто-выбор' },
              { id: 'fast', label: 'Fast', icon: Zap, desc: '1 быстрый этап' },
              { id: 'quality', label: 'Quality', icon: Sparkles, desc: '4 этапа (ТЗ + QA)' },
            ].map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGenerationMode(m.id as GenerationMode)}
                  className={`p-2.5 rounded-lg font-medium text-center flex flex-col items-center justify-center gap-1 transition-all ${
                    generationMode === m.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-semibold">{m.label}</span>
                  <span className="text-[10px] opacity-75">{m.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Settings Drawer */}
      <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-900/40">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-5 py-3 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-800/40 transition-colors"
        >
          <span className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            Дополнительные настройки (язык, детализация, архитектурные дополнения)
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="p-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-slate-900/80">
            <div>
              <label className="block text-slate-400 font-medium mb-1.5">Язык итогового ТЗ:</label>
              <select
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="ru">Русский 🇷🇺</option>
                <option value="en">English 🇬🇧</option>
                <option value="de">Deutsch 🇩🇪</option>
                <option value="es">Español 🇪🇸</option>
                <option value="fr">Français 🇫🇷</option>
                <option value="zh">中文 🇨🇳</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1.5">Уровень детализации:</label>
              <select
                value={detailLevel}
                onChange={(e) => setDetailLevel(e.target.value as DetailLevel)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
              >
                <option value="concise">Краткий (ключевые контракты и стек)</option>
                <option value="standard">Стандартный (архитектура, сущности, тесты)</option>
                <option value="detailed">Подробный (исчерпывающее ТЗ, инварианты, edge cases)</option>
              </select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeArchitecturalAdditions}
                  onChange={(e) => setIncludeArchitecturalAdditions(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Включать логические архитектурные дополнения (AD-решения, очереди, инварианты)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={includeExplanations}
                  onChange={(e) => setIncludeExplanations(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Формировать пояснения к принятым решениям и список предположений (Assumptions)</span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-300 font-medium mb-1.5">
                Дополнительные постоянные инструкции (системные требования, линтер, .env, docker):
              </label>
              <textarea
                rows={3}
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Например: Typescript, строгий линтер, полный запрет fallback значений. Все переменные среды только в .env файлах без fallback, docker-compose.override.yml для БД и Redis..."
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 placeholder-slate-500 font-sans"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Эти инструкции будут переданы на все 4 этапа и гарантированно зафиксированы в системном промпте и секциях ТЗ.
              </p>
            </div>

            <div className="sm:col-span-2 mt-2 p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl">
              <div className="text-[11px] font-semibold text-indigo-300 mb-1.5 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                Распределение моделей по этапам (Quality / Economy Presets):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                  <span className="text-slate-400 block">Analysis:</span>
                  <span className="font-mono text-emerald-400 font-bold">gpt-6.1-terra</span>
                  <span className="text-slate-500 block">reasoning: medium</span>
                </div>
                <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                  <span className="text-slate-400 block">Architecture:</span>
                  <span className="font-mono text-indigo-400 font-bold">gpt-6.1-sol</span>
                  <span className="text-slate-500 block">reasoning: medium</span>
                </div>
                <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                  <span className="text-slate-400 block">Composer:</span>
                  <span className="font-mono text-indigo-400 font-bold">gpt-6.1-sol</span>
                  <span className="text-slate-500 block">reasoning: medium</span>
                </div>
                <div className="p-1.5 bg-slate-900/60 rounded border border-slate-800">
                  <span className="text-slate-400 block">Reviewer:</span>
                  <span className="font-mono text-emerald-400 font-bold">gpt-6.1-terra</span>
                  <span className="text-slate-500 block">reasoning: medium</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Submit Action */}
      <div className="flex items-center justify-end gap-4">
        <button
          type="submit"
          disabled={!rawPrompt.trim() || isLoading}
          className="w-full sm:w-auto px-8 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all text-base"
        >
          <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          <span>Улучшить промпт</span>
        </button>
      </div>
    </form>
  );
};
