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
} from 'lucide-react';
import { VersionEntity } from '../../server/database';
import { DiffViewer } from './DiffViewer';

interface ResultViewProps {
  version: VersionEntity;
  previousVersion?: VersionEntity;
  onApplyRevision: (instruction: string) => Promise<void>;
  onRegenerate: () => void;
  isRevising: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  version,
  previousVersion,
  onApplyRevision,
  onRegenerate,
  isRevising,
}) => {
  const [activeTab, setActiveTab] = useState<
    'user_prompt' | 'system_prompt' | 'what_improved' | 'assumptions' | 'traceability' | 'quality'
  >('user_prompt');

  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editableUserPrompt, setEditableUserPrompt] = useState<string>(version.userPrompt);
  const [editableSystemPrompt, setEditableSystemPrompt] = useState<string>(version.systemPrompt);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [revisionInput, setRevisionInput] = useState<string>('');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
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
            Проверено {review?.score ? `(${review.score}/100)` : ''}
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

      {/* Main Tabs Navigation */}
      <div className="border-b border-slate-800 flex items-center gap-1 sm:gap-2 overflow-x-auto text-xs font-semibold">
        {[
          { id: 'user_prompt', label: 'User Prompt (ТЗ)', count: null },
          { id: 'system_prompt', label: 'System Prompt', count: null },
          { id: 'what_improved', label: 'Что улучшено', count: version.whatImproved.length },
          { id: 'assumptions', label: 'Предположения', count: version.assumptions.length },
          { id: 'traceability', label: 'Трассировка требований', count: traceability.length },
          { id: 'quality', label: 'Контроль качества', count: review?.isApproved ? 'OK' : 'Check' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-3 border-b-2 font-medium shrink-0 flex items-center gap-1.5 transition-all ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== null && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Tab Content Display */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
        {/* TAB 1: USER PROMPT (ТЗ) */}
        {activeTab === 'user_prompt' && (
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

        {/* TAB 2: SYSTEM PROMPT */}
        {activeTab === 'system_prompt' && (
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

        {/* TAB 3: ЧТО УЛУЧШЕНО */}
        {activeTab === 'what_improved' && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-white mb-2">Ключевые улучшения и дополнения:</h4>
            {version.whatImproved.map((item, idx) => (
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

        {/* TAB 4: ПРЕДПОЛОЖЕНИЯ */}
        {activeTab === 'assumptions' && (
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Ниже перечислены архитектурные решения, которые AI принял самостоятельно, так как в исходном запросе отсутствовали прямые указания.
              </span>
            </div>
            {version.assumptions.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3 text-xs"
              >
                <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  {idx + 1}
                </div>
                <p className="text-slate-300 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 5: ТРАССИРОВКА ТРЕБОВАНИЙ */}
        {activeTab === 'traceability' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Матрица отслеживания требований (Traceability Matrix) связывает каждое явное и неявное требование с соответствующими разделами сформированного ТЗ:
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-xs divide-y divide-slate-800">
                <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Источник</th>
                    <th className="px-4 py-3">Приоритет</th>
                    <th className="px-4 py-3">Формулировка требования</th>
                    <th className="px-4 py-3">Покрывающие разделы</th>
                    <th className="px-4 py-3">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {traceability.map((req) => (
                    <tr key={req.reqId} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-400">{req.reqId}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            req.source === 'explicit'
                              ? 'bg-sky-500/10 text-sky-300 border border-sky-500/30'
                              : req.source === 'inferred'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              : 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                          }`}
                        >
                          {req.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            req.priority === 'critical'
                              ? 'text-rose-400'
                              : req.priority === 'high'
                              ? 'text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {req.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{req.normalizedText}</td>
                      <td className="px-4 py-3 text-slate-400">{req.coveredSections.join(', ')}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            req.status === 'covered'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : req.status === 'partially_covered'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: КОНТРОЛЬ КАЧЕСТВА (REVIEW REPORT) */}
        {activeTab === 'quality' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">Статус аудита Quality Reviewer:</h4>
                <p className="text-xs text-slate-300 mt-1">{review?.summary || 'Все проверки пройдены.'}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400">{review?.score || 100}/100</span>
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
  );
};
