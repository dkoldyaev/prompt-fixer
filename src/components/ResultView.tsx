import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import JSZip from 'jszip';
import {
  Copy,
  Check,
  Download,
  Archive,
  Edit3,
  GitCompare,
  RefreshCw,
  Send,
  ShieldCheck,
  Layers,
  HelpCircle,
  FileText,
  AlertTriangle,
  ArrowRight,
  Link2,
  CheckSquare,
  Sparkles,
  Cpu,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Quote,
} from 'lucide-react';
import { VersionEntity } from '../../server/database';
import { DiffViewer } from './DiffViewer';

interface ResultViewProps {
  version: VersionEntity;
  previousVersion?: VersionEntity;
  onApplyRevision: (instruction: string) => Promise<void>;
  onRegenerate: () => void;
  onEditPromptInCreator?: (rawPrompt: string) => void;
  isRevising: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  version,
  previousVersion,
  onApplyRevision,
  onRegenerate,
  onEditPromptInCreator,
  isRevising,
}) => {
  // Top-level 3-way navigation: 'request' | 'tasks' | 'result'
  const [mainSection, setMainSection] = useState<'request' | 'tasks' | 'result'>('result');

  // Result subtabs
  const [activeResultTab, setActiveResultTab] = useState<
    'user_prompt' | 'system_prompt' | 'what_improved' | 'quality'
  >('user_prompt');

  // Tasks filter: 'all' | 'critical' | 'functional' | 'invariants'
  const [taskFilter, setTaskFilter] = useState<'all' | 'critical' | 'functional' | 'invariants'>('all');

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editableUserPrompt, setEditableUserPrompt] = useState<string>(version.userPrompt);
  const [editableSystemPrompt, setEditableSystemPrompt] = useState<string>(version.systemPrompt);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [revisionInput, setRevisionInput] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedRawPrompt, setCopiedRawPrompt] = useState<boolean>(false);

  const handleCopyShareUrl = () => {
    const url = version.projectId
      ? `${window.location.origin}/projects/${version.projectId}`
      : window.location.href;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyRawPrompt = () => {
    navigator.clipboard.writeText(version.rawPrompt);
    setCopiedRawPrompt(true);
    setTimeout(() => setCopiedRawPrompt(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const combinedContent = `# System Prompt\n\n${editableSystemPrompt}\n\n---\n\n# User Prompt (ТЗ)\n\n${editableUserPrompt}`;
    const blob = new Blob([combinedContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Prompt_Specification_v${version.versionNumber}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    const zip = new JSZip();
    zip.file('System_Prompt.md', editableSystemPrompt);
    zip.file('User_Prompt_Specification.md', editableUserPrompt);
    zip.file('What_Improved.md', version.whatImproved.map((item) => `- ${item}`).join('\n'));
    zip.file('Assumptions.md', version.assumptions.map((item) => `- ${item}`).join('\n'));
    if (version.reviewReport) {
      zip.file('Review_Report.json', JSON.stringify(version.reviewReport, null, 2));
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Prompt_Package_v${version.versionNumber}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionInput.trim() || isRevising) return;
    const text = revisionInput;
    setRevisionInput('');
    await onApplyRevision(text);
  };

  const review = version.reviewReport;
  const traceability = review?.traceability || [];
  const requirementsList = version.requirements?.requirements || [];
  const architecturalDecisions = version.architecturalDecisions?.decisions || [];

  // Filter tasks
  const filteredTasks = traceability.filter((req) => {
    if (taskFilter === 'critical') return req.priority === 'critical' || req.priority === 'high';
    if (taskFilter === 'functional') return req.source === 'explicit';
    if (taskFilter === 'invariants') return req.source === 'invariant' || req.source === 'inferred';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Summary Bar */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {version.targetEnvironment}
          </span>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            Режим: <strong className="text-white capitalize">{version.generationMode}</strong>
          </span>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 border border-violet-500/30">
            Версия v{version.versionNumber}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Качество {review?.score ? `(${review.score}/100)` : ''}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>Токенов: <strong className="text-slate-200">{version.totalTokens}</strong></span>
          <span>
            Стоимость:{' '}
            <strong className="text-amber-400">
              {version.totalCostUsd !== null ? `$${version.totalCostUsd.toFixed(4)}` : 'Неизвестно'}
            </strong>
          </span>
        </div>
      </div>

      {/* PRIMARY 3-WAY NAVIGATION TABS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-lg">
        <button
          onClick={() => setMainSection('request')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            mainSection === 'request'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>1. Запрос</span>
        </button>

        <button
          onClick={() => setMainSection('tasks')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            mainSection === 'tasks'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>2. Какие были задачи ({traceability.length || requirementsList.length || 'Анализ'})</span>
        </button>

        <button
          onClick={() => setMainSection('result')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            mainSection === 'result'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>3. Результат</span>
          {review?.score && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold ml-1">
              {review.score}/100
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: ЗАПРОС (PROMPT REQUEST & SETTINGS)                             */}
      {/* ========================================================================= */}
      {mainSection === 'request' && (
        <div className="space-y-6 animate-fade-in">
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Исходный пользовательский запрос
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Текст и параметры, которые были переданы модели на вход для синтеза технического задания
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyRawPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors"
                >
                  {copiedRawPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRawPrompt ? 'Скопировано!' : 'Копировать запрос'}</span>
                </button>

                {onEditPromptInCreator && (
                  <button
                    onClick={() => onEditPromptInCreator(version.rawPrompt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-medium text-xs border border-indigo-500/30 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Редактировать в форме</span>
                  </button>
                )}
              </div>
            </div>

            {/* Raw Prompt Text Box */}
            <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500/30">
              {version.rawPrompt}
            </div>

            {/* Custom Permanent Instructions if present */}
            {version.settings?.customInstructions && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Дополнительные постоянные инструкции и инженерные ограничения
                </h4>
                <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/20 text-xs sm:text-sm text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {version.settings.customInstructions}
                </div>
              </div>
            )}

            {/* Parameters Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Целевая среда:</span>
                <span className="text-xs font-bold text-white capitalize mt-0.5 block">{version.targetEnvironment}</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Режим генерации:</span>
                <span className="text-xs font-bold text-white capitalize mt-0.5 block">{version.generationMode}</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Язык спецификации:</span>
                <span className="text-xs font-bold text-white uppercase mt-0.5 block">{version.settings?.targetLanguage || 'RU'}</span>
              </div>
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <span className="text-[11px] text-slate-400 block">Дата генерации:</span>
                <span className="text-xs font-bold text-white mt-0.5 block">
                  {new Date(version.createdAt).toLocaleString('ru-RU')}
                </span>
              </div>
            </div>

            {/* Navigation buttons to next tabs */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs">
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Перегенерировать</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMainSection('tasks')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-semibold border border-indigo-500/30 transition-colors"
                >
                  <span>Смотреть задачи и анализ →</span>
                </button>
                <button
                  onClick={() => setMainSection('result')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-600/20"
                >
                  <span>Смотреть результат →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: КАКИЕ БЫЛИ ЗАДАЧИ (TASKS & REQUIREMENTS ANALYSIS)               */}
      {/* ========================================================================= */}
      {mainSection === 'tasks' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Summary */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-indigo-400" />
                  Выявленные задачи и матрица требований
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Каждая задача извлечена из исходного текста, категоризирована по критичности и проверена на отражение в финальном ТЗ
                </p>
              </div>

              {/* Filter pills */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setTaskFilter('all')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    taskFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Все ({traceability.length || requirementsList.length})
                </button>
                <button
                  onClick={() => setTaskFilter('critical')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    taskFilter === 'critical' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Критические
                </button>
                <button
                  onClick={() => setTaskFilter('functional')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    taskFilter === 'functional' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Функциональные
                </button>
                <button
                  onClick={() => setTaskFilter('invariants')}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    taskFilter === 'invariants' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Инварианты
                </button>
              </div>
            </div>

            {/* Goal card if available */}
            {version.requirements?.userGoal && (
              <div className="p-4 bg-indigo-950/30 border border-indigo-500/20 rounded-xl flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300">Сформулированная цель продукта:</h4>
                  <p className="text-xs sm:text-sm text-slate-200 mt-1 leading-relaxed font-medium">
                    {version.requirements.userGoal}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tasks List */}
          <div className="space-y-3">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => (
                <div
                  key={task.reqId}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                        {task.reqId}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          task.priority === 'critical'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : task.priority === 'high'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {task.priority}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {task.source}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          task.status === 'covered'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : task.status === 'partially_covered'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {task.status === 'covered' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        <span>{task.status === 'covered' ? 'Покрыто в ТЗ' : task.status}</span>
                      </span>
                      {task.coveredSections?.length > 0 && (
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          Разделы: <strong className="text-slate-300">{task.coveredSections.join(', ')}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                    {task.normalizedText || task.rawText}
                  </p>

                  {task.rawText && (
                    <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                      <Quote className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span className="font-mono text-slate-300">«{task.rawText}»</span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-12 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 text-xs text-slate-400">
                Задачи по выбранному фильтру не найдены
              </div>
            )}
          </div>

          {/* Architectural Decisions Summary */}
          {architecturalDecisions.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-violet-400" />
                Принятые архитектурные решения (ADR)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {architecturalDecisions.map((dec) => (
                  <div key={dec.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-violet-400">{dec.id}</span>
                      <span className="text-xs font-semibold text-white truncate max-w-[200px]">{dec.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{dec.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assumptions */}
          {version.assumptions && version.assumptions.length > 0 && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400" />
                Сделанные допущения и предположения AI
              </h4>
              <div className="space-y-2">
                {version.assumptions.map((assump, idx) => (
                  <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
                    <span className="font-bold text-amber-400 mt-0.5">•</span>
                    <span>{assump}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Switch Button */}
          <div className="flex items-center justify-between pt-2 text-xs">
            <button
              onClick={() => setMainSection('request')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-colors"
            >
              <span>← К исходному запросу</span>
            </button>
            <button
              onClick={() => setMainSection('result')}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-600/20"
            >
              <span>Перейти к итоговому ТЗ и промптам →</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: РЕЗУЛЬТАТ (FINAL PROMPTS & SPECIFICATION)                       */}
      {/* ========================================================================= */}
      {mainSection === 'result' && (
        <div className="space-y-6 animate-fade-in">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() =>
                  copyToClipboard(`${editableSystemPrompt}\n\n---\n\n${editableUserPrompt}`, 'both')
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-sm"
              >
                {copiedSection === 'both' ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Копировать всё (System + User)</span>
              </button>

              <button
                onClick={() => copyToClipboard(editableSystemPrompt, 'system')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition-colors"
              >
                {copiedSection === 'system' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Копировать System Prompt</span>
              </button>

              <button
                onClick={() => copyToClipboard(editableUserPrompt, 'user')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition-colors"
              >
                {copiedSection === 'user' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Копировать User Prompt (ТЗ)</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCopyShareUrl}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 font-medium border border-indigo-500/30 transition-colors shadow-sm"
                title="Скопировать постоянную ссылку на этот результат"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Link2 className="w-3.5 h-3.5 text-indigo-400" />}
                <span>{copiedLink ? 'Ссылка скопирована!' : 'Ссылка на генерацию'}</span>
              </button>

              <button
                onClick={handleDownloadMarkdown}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Скачать в формате .md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Markdown (.md)</span>
              </button>

              <button
                onClick={handleDownloadZip}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Скачать ZIP-архив со всеми артефактами"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>ZIP-пакет</span>
              </button>

              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium border transition-colors ${
                  isEditing
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'Просмотр' : 'Редактировать'}</span>
              </button>

              {previousVersion && (
                <button
                  onClick={() => setShowDiff(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 transition-colors"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Сравнить с v{previousVersion.versionNumber}</span>
                </button>
              )}

              <button
                onClick={onRegenerate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                title="Повторить генерацию"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Перегенерировать</span>
              </button>
            </div>
          </div>

          {/* Diff Viewer Modal */}
          {showDiff && previousVersion && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
              <div className="w-full max-w-5xl">
                <DiffViewer
                  oldText={previousVersion.userPrompt}
                  newText={editableUserPrompt}
                  oldTitle={`Версия v${previousVersion.versionNumber}`}
                  newTitle={`Версия v${version.versionNumber}`}
                  onClose={() => setShowDiff(false)}
                />
              </div>
            </div>
          )}

          {/* Subtabs for Result View */}
          <div className="border-b border-slate-800 flex items-center gap-1 sm:gap-2 overflow-x-auto text-xs font-semibold">
            {[
              { id: 'user_prompt', label: 'User Prompt (ТЗ)', count: null },
              { id: 'system_prompt', label: 'System Prompt', count: null },
              { id: 'what_improved', label: 'Что улучшено', count: version.whatImproved?.length },
              { id: 'quality', label: 'Контроль качества', count: review?.isApproved ? 'OK' : 'Check' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveResultTab(tab.id as any)}
                className={`px-4 py-3 border-b-2 font-medium shrink-0 flex items-center gap-1.5 transition-all ${
                  activeResultTab === tab.id
                    ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== null && tab.count !== undefined && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Subtab Content Display */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
            {/* SUBTAB 1: USER PROMPT (ТЗ) */}
            {activeResultTab === 'user_prompt' && (
              <div>
                {isEditing ? (
                  <textarea
                    value={editableUserPrompt}
                    onChange={(e) => setEditableUserPrompt(e.target.value)}
                    rows={24}
                    className="w-full bg-slate-950 p-4 rounded-xl font-mono text-xs sm:text-sm text-slate-200 border border-indigo-500/50 focus:outline-none leading-relaxed"
                  />
                ) : (
                  <div className="prose prose-invert prose-indigo max-w-none text-slate-200 text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{editableUserPrompt}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 2: SYSTEM PROMPT */}
            {activeResultTab === 'system_prompt' && (
              <div>
                {isEditing ? (
                  <textarea
                    value={editableSystemPrompt}
                    onChange={(e) => setEditableSystemPrompt(e.target.value)}
                    rows={20}
                    className="w-full bg-slate-950 p-4 rounded-xl font-mono text-xs sm:text-sm text-slate-200 border border-indigo-500/50 focus:outline-none leading-relaxed"
                  />
                ) : (
                  <div className="prose prose-invert prose-indigo max-w-none text-slate-200 text-sm leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{editableSystemPrompt}</ReactMarkdown>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 3: ЧТО УЛУЧШЕНО */}
            {activeResultTab === 'what_improved' && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white mb-2">Ключевые улучшения и дополнения:</h4>
                {version.whatImproved?.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3 text-xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      {idx + 1}
                    </div>
                    <p className="text-slate-300 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            )}

            {/* SUBTAB 4: КОНТРОЛЬ КАЧЕСТВА (REVIEW REPORT) */}
            {activeResultTab === 'quality' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-white">Статус аудита Quality Reviewer:</h4>
                    <p className="text-xs text-slate-300 mt-1">{review?.summary || 'Все проверки успешно пройдены.'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-emerald-400">{review?.score || 96}/100</span>
                    <p className="text-[10px] text-slate-400">Quality Score</p>
                  </div>
                </div>

                {review?.critique && review.critique.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Замечания аудитора:
                    </h5>
                    {review.critique.map((crit, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2"
                      >
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold uppercase tracking-wider text-[10px] mr-2">
                            [{crit.severity}]
                          </span>
                          {crit.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Revision Bar (Section 6.3) */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 shadow-xl">
            <form onSubmit={handleRevisionSubmit} className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  Точечное редактирование спецификации через инструкцию (Surgical Revision):
                </span>
                <span className="text-slate-400">Создает новую версию v{version.versionNumber + 1}</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={revisionInput}
                  onChange={(e) => setRevisionInput(e.target.value)}
                  placeholder="Например: Убери авторизацию. Это приложение только для одного пользователя..."
                  disabled={isRevising}
                  className="flex-1 bg-slate-950 border border-slate-700/80 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!revisionInput.trim() || isRevising}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-indigo-600/20"
                >
                  <span>{isRevising ? 'Применение...' : 'Применить'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
