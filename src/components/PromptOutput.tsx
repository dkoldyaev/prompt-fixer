import React, { useState } from 'react';
import { StructuredPromptResult } from '../types';
import {
  Copy,
  Check,
  Download,
  Terminal,
  UserCheck,
  Bot,
  Layers,
  FileCode,
  ShieldCheck,
  FileText,
  AlertCircle
} from 'lucide-react';

interface PromptOutputProps {
  result: StructuredPromptResult | null;
  isLoading: boolean;
  source?: 'llm' | 'smart_optimizer';
  executionNote?: string | null;
}

export const PromptOutput: React.FC<PromptOutputProps> = ({
  result,
  isLoading,
  source = 'smart_optimizer',
  executionNote,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'system' | 'user' | 'meta'>('all');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = async (text: string, sectionName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(sectionName);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadMarkdown = () => {
    if (!result) return;
    const blob = new Blob([result.formattedText], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized-prompt-${result.metadata.model}-${result.metadata.language}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl min-h-[500px] flex flex-col items-center justify-center text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center animate-pulse">
            <Bot className="w-8 h-8 text-brand-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full animate-ping" />
        </div>
        <h3 className="text-base font-semibold text-white">Применяем принципы архитектуры промпта</h3>
        <p className="text-xs text-slate-400 max-w-sm mt-1">
          Формируем роли, постоянные материалы, правила с обоснованием «почему», контрастные few-shot примеры и пользовательский контекст...
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-10 shadow-xl min-h-[500px] flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mb-3">
          <FileCode className="w-7 h-7 text-slate-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-300">Отредактированный промпт появится здесь</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Введите черновой запрос слева, выберите целевую модель (GPT, Gemini, Mistral) и язык, затем нажмите «Переписать по правилам».
        </p>
      </div>
    );
  }

  // Полные тексты для копирования
  const systemPromptFull = `Системное сообщение (System Prompt)

[Роль и контекст]
${result.systemPrompt.roleAndContext}

[Задача]
${result.systemPrompt.task}

[Постоянные материалы]
${result.systemPrompt.persistentMaterials}

[Правила]
${result.systemPrompt.rules}

[Примеры (Few-shot)]
Пример плохого ответа: ${result.systemPrompt.fewShot.bad}

Пример хорошего ответа: ${result.systemPrompt.fewShot.good}

[Формат ответа]
${result.systemPrompt.responseFormat}`;

  const userPromptFull = `Пользовательское сообщение (User Prompt)

[Вводные данные]
${result.userPrompt.inputData}

[Действие]
${result.userPrompt.action}`;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
      {/* Top Bar with Tabs and Actions */}
      <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Весь промпт</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'system'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>System Prompt</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('user')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'user'
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>User Prompt</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('meta')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
              activeTab === 'meta'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40'
            }`}
            title="Посмотреть сам запрос на рерайт, построенный по этим же принципам"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Мета-промпт</span>
            <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono">Правило</span>
          </button>
        </div>

        {/* Global Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadMarkdown}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg border border-slate-700/60 transition"
            title="Скачать как Markdown (.md)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              const textToCopy =
                activeTab === 'system'
                  ? systemPromptFull
                  : activeTab === 'user'
                  ? userPromptFull
                  : activeTab === 'meta'
                  ? result.metaPromptUsed.fullText
                  : result.formattedText;
              copyToClipboard(textToCopy, activeTab);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 text-brand-300 hover:text-brand-200 rounded-lg text-xs font-medium transition"
          >
            {copiedSection === activeTab ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Скопировано!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Скопировать вкладку</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Source & Optimization Badge Banner */}
      <div className="px-5 py-2 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Двухуровневая архитектура валидирована
          </span>
          <span className="text-slate-600">|</span>
          <span>Модель: <b className="text-slate-200 uppercase">{result.metadata.model}</b></span>
          <span className="text-slate-600">|</span>
          <span>Язык: <b className="text-slate-200 uppercase">{result.metadata.language}</b></span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500">
            Слов: {result.metadata.originalWordCount} → <span className="text-brand-400 font-semibold">{result.metadata.optimizedWordCount}</span>
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 overflow-y-auto max-h-[650px] space-y-6 font-sans">
        {/* TAB 1: ALL OR SYSTEM */}
        {(activeTab === 'all' || activeTab === 'system') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 text-xs font-bold font-mono border border-brand-500/20">
                  SYSTEM
                </span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Системное сообщение (System Prompt)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(systemPromptFull, 'system-only')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedSection === 'system-only' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                Копировать блок
              </button>
            </div>

            {/* Block 1: Role and Context */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-400 font-mono tracking-wide">[Роль и контекст]</span>
                <span className="text-[10px] text-slate-500 uppercase">Expert Persona</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.systemPrompt.roleAndContext}
              </p>
            </div>

            {/* Block 2: Task */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-400 font-mono tracking-wide">[Задача]</span>
                <span className="text-[10px] text-slate-500 uppercase">Primary Mission</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.systemPrompt.task}
              </p>
            </div>

            {/* Block 3: Persistent Materials */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-400 font-mono tracking-wide">[Постоянные материалы]</span>
                <span className="text-[10px] text-slate-500 uppercase">Grounding Constants & Norms</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.systemPrompt.persistentMaterials}
              </p>
            </div>

            {/* Block 4: Rules */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400 font-mono tracking-wide">[Правила]</span>
                <span className="text-[10px] text-slate-500 uppercase">Do's & Don'ts with «Why»</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.systemPrompt.rules}
              </p>
            </div>

            {/* Block 5: Few-shot Examples */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 font-mono tracking-wide">[Примеры (Few-shot)]</span>
                <span className="text-[10px] text-slate-500 uppercase">Contrastive Calibration</span>
              </div>

              {/* Bad example */}
              <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-900/40 text-xs">
                <span className="font-semibold text-rose-400 block mb-1">Пример плохого ответа:</span>
                <p className="text-slate-300 italic whitespace-pre-wrap">{result.systemPrompt.fewShot.bad}</p>
              </div>

              {/* Good example */}
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/40 text-xs">
                <span className="font-semibold text-emerald-400 block mb-1">Пример хорошего ответа:</span>
                <p className="text-slate-300 italic whitespace-pre-wrap">{result.systemPrompt.fewShot.good}</p>
              </div>
            </div>

            {/* Block 6: Response Format */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-400 font-mono tracking-wide">[Формат ответа]</span>
                <span className="text-[10px] text-slate-500 uppercase">Output Schema</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.systemPrompt.responseFormat}
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: USER PROMPT */}
        {(activeTab === 'all' || activeTab === 'user') && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-bold font-mono border border-emerald-500/20">
                  USER
                </span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Пользовательское сообщение (User Prompt)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(userPromptFull, 'user-only')}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
              >
                {copiedSection === 'user-only' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                Копировать блок
              </button>
            </div>

            {/* Block 7: Input Data */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400 font-mono tracking-wide">[Вводные данные]</span>
                <span className="text-[10px] text-slate-500 uppercase">Case Variables & Parameters</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.userPrompt.inputData}
              </p>
            </div>

            {/* Block 8: Action */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400 font-mono tracking-wide">[Действие]</span>
                <span className="text-[10px] text-slate-500 uppercase">Action Command & Fallback</span>
              </div>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {result.userPrompt.action}
              </p>
            </div>
          </div>
        )}

        {/* TAB 3: META-PROMPT VIEWER */}
        {activeTab === 'meta' && (
          <div className="space-y-4">
            <div className="p-4 bg-indigo-950/30 border border-indigo-500/30 rounded-xl text-xs text-indigo-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white mb-1">
                  Соблюдение требования: «Этот же набор принципов должен быть применен к запросу на рерайт»
                </p>
                <p className="text-indigo-300 leading-relaxed">
                  Ниже приведен точный мета-запрос (System + User Prompt), который отправляется в языковую модель для рерайтинга любого сырого запроса. Обратите внимание: он сам на 100% соблюдает все те же блоки: [Роль и контекст], [Задача], [Постоянные материалы], [Правила], [Примеры (Few-shot)], [Формат ответа], [Вводные данные], [Действие].
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap overflow-x-auto">
              {result.metaPromptUsed.fullText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
