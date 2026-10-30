import React, { useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Zap,
  ShieldCheck,
  Cpu,
  Layers,
  Coins,
} from 'lucide-react';
import { JobProgressEvent, JobStatus } from '../../packages/shared/types';

interface ExecutionModalProps {
  isOpen: boolean;
  event: JobProgressEvent | null;
  onCancel: () => void;
  onClose?: () => void;
}

export const ExecutionModal: React.FC<ExecutionModalProps> = ({
  isOpen,
  event,
  onCancel,
  onClose,
}) => {
  const [activePreviewTab, setActivePreviewTab] = useState<'analyzer' | 'architect' | 'prompts'>('analyzer');

  if (!isOpen || !event) return null;

  const isFast = event.intermediateResults?.complexity?.recommendedMode === 'fast';

  const stages = isFast
    ? [
        { key: 'fast_execution', label: 'Fast Prompt Generation', icon: Zap },
        { key: 'done', label: 'Верификация и завершение', icon: CheckCircle2 },
      ]
    : [
        { key: 'requirements_analysis', label: '1. Анализ требований', icon: Layers },
        { key: 'solution_architecture', label: '2. Архитектура решения', icon: Cpu },
        { key: 'prompt_composer', label: '3. Компоновка промптов', icon: Zap },
        { key: 'quality_reviewer', label: '4. Контроль качества', icon: ShieldCheck },
      ];

  const getStageStatus = (stageIndex: number) => {
    const currentPercent = event.progressPercent || 0;
    const stageThreshold = ((stageIndex + 1) / stages.length) * 100;
    const prevThreshold = (stageIndex / stages.length) * 100;

    if (event.status === 'failed') return 'failed';
    if (event.status === 'cancelled') return 'cancelled';
    if (currentPercent >= stageThreshold || event.status === 'completed') return 'completed';
    if (currentPercent > prevThreshold) return 'active';
    return 'pending';
  };

  const intermediate = event.intermediateResults;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {event.status === 'completed' ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            ) : event.status === 'failed' ? (
              <AlertCircle className="w-6 h-6 text-rose-400" />
            ) : event.status === 'cancelled' ? (
              <XCircle className="w-6 h-6 text-amber-400" />
            ) : (
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            )}
            <div>
              <h3 className="text-base font-semibold text-white">
                {event.status === 'completed'
                  ? 'Генерация успешно завершена'
                  : event.status === 'failed'
                  ? 'Ошибка выполнения задания'
                  : event.status === 'cancelled'
                  ? 'Генерация отменена'
                  : 'AI Pipeline: Поэтапная оркестрация'}
              </h3>
              <p className="text-xs text-slate-400">{event.message}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {event.metrics?.totalCostUsd !== null && event.metrics?.totalCostUsd !== undefined
                    ? `$${event.metrics.totalCostUsd.toFixed(4)}`
                    : 'Расчет...'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{event.metrics?.totalTokens || 0} токенов</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5">
          <div
            className={`h-full transition-all duration-500 ${
              event.status === 'failed'
                ? 'bg-rose-500'
                : event.status === 'cancelled'
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400'
            }`}
            style={{ width: `${Math.max(5, event.progressPercent || 0)}%` }}
          />
        </div>

        {/* Stepper */}
        <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/40 border-b border-slate-800">
          {stages.map((stage, idx) => {
            const status = getStageStatus(idx);
            const Icon = stage.icon;

            return (
              <div
                key={stage.key}
                className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium transition-all ${
                  status === 'completed'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : status === 'active'
                    ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                    : 'bg-slate-800/40 text-slate-500 border border-slate-800'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                    status === 'completed'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : status === 'active'
                      ? 'bg-indigo-500 text-white animate-pulse'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {status === 'completed' ? '✓' : idx + 1}
                </div>
                <span className="truncate">{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Intermediate Live Results Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Промежуточные артефакты:
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActivePreviewTab('analyzer')}
                disabled={!intermediate?.analyzer}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activePreviewTab === 'analyzer'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40'
                }`}
              >
                Требования ({intermediate?.analyzer?.requirements?.length || 0})
              </button>
              <button
                onClick={() => setActivePreviewTab('architect')}
                disabled={!intermediate?.architect}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activePreviewTab === 'architect'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40'
                }`}
              >
                Решения AD ({intermediate?.architect?.decisions?.length || 0})
              </button>
            </div>
          </div>

          {activePreviewTab === 'analyzer' && intermediate?.analyzer && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-300">
                Цель пользователя: <span className="text-white">{intermediate.analyzer.userGoal}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                {intermediate.analyzer.requirements.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-lg bg-slate-800/70 border border-slate-700/60 text-xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono font-bold text-indigo-400">{req.id}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          req.source === 'explicit'
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : req.source === 'inferred'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        }`}
                      >
                        {req.source}
                      </span>
                    </div>
                    <p className="text-slate-300 leading-snug">{req.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePreviewTab === 'architect' && intermediate?.architect && (
            <div className="space-y-3">
              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700 text-xs">
                <span className="font-semibold text-slate-200">Архитектурный обзор:</span>
                <p className="text-slate-300 mt-1">{intermediate.architect.architectureOverview}</p>
              </div>

              <div className="space-y-2">
                {intermediate.architect.decisions.map((ad) => (
                  <div key={ad.id} className="p-3 bg-slate-800/70 rounded-xl border border-slate-700/60 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono font-bold text-emerald-400">{ad.id}: {ad.title}</span>
                      <span className="text-[10px] text-slate-400">Связано с: {ad.linkedReqIds.join(', ')}</span>
                    </div>
                    <p className="text-slate-300 mb-1">{ad.description}</p>
                    <p className="text-[11px] text-slate-400 italic">Обоснование: {ad.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!intermediate?.analyzer && !intermediate?.architect && (
            <div className="py-12 text-center text-slate-500 text-sm">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500 opacity-60" />
              Подготовка и валидация первого этапа AI-пайплайна...
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/60 border-t border-slate-700 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            {event.status === 'completed'
              ? 'Все проверки успешно пройдены'
              : 'Фоновый процесс выполняется независимо от соединения браузера'}
          </span>

          <div className="flex items-center gap-2">
            {event.status !== 'completed' && event.status !== 'failed' && event.status !== 'cancelled' && (
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold transition-colors"
              >
                Отменить генерацию
              </button>
            )}

            {(event.status === 'completed' || event.status === 'failed' || event.status === 'cancelled') && (
              <button
                onClick={onClose}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/20"
              >
                Перейти к результату
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
