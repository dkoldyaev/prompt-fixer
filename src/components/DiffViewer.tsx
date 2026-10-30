import React from 'react';
import * as Diff from 'diff';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldTitle?: string;
  newTitle?: string;
  onClose?: () => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  oldText,
  newText,
  oldTitle = 'Предыдущая версия',
  newTitle = 'Текущая версия',
  onClose,
}) => {
  const diff = Diff.diffLines(oldText, newText);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-rose-400">🔴 {oldTitle}</span>
          <span className="text-slate-500">→</span>
          <span className="text-sm font-semibold text-emerald-400">🟢 {newTitle}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm bg-slate-700/60 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Закрыть
          </button>
        )}
      </div>

      <div className="p-4 overflow-y-auto font-mono text-xs leading-relaxed divide-y divide-slate-800">
        {diff.map((part, index) => {
          const colorClass = part.added
            ? 'bg-emerald-950/60 text-emerald-300 border-l-4 border-emerald-500 pl-3 py-1'
            : part.removed
            ? 'bg-rose-950/60 text-rose-300 border-l-4 border-rose-500 pl-3 py-1 line-through opacity-80'
            : 'text-slate-300 pl-4 py-0.5';

          return (
            <pre key={index} className={`whitespace-pre-wrap ${colorClass}`}>
              {part.added ? '+ ' : part.removed ? '- ' : '  '}
              {part.value}
            </pre>
          );
        })}
      </div>
    </div>
  );
};
