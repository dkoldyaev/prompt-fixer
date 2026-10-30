import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Layers,
  Coins,
  Cpu,
  Trash2,
  Edit2,
  FolderOpen,
  ArrowRight,
  GitBranch,
  Link2,
  Check,
} from 'lucide-react';
import { ProjectEntity, VersionEntity } from '../../server/database';

interface HistoryViewProps {
  projects: Array<
    ProjectEntity & {
      versionCount: number;
      latestVersion: {
        versionNumber: number;
        targetEnvironment: string;
        generationMode: string;
        totalTokens: number;
        totalCostUsd: number | null;
        createdAt: string;
      } | null;
    }
  >;
  onSelectProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newTitle: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  projects,
  onSelectProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null);

  const handleCopyProjectLink = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/projects/${projectId}`;
    navigator.clipboard.writeText(url);
    setCopiedProjectId(projectId);
    setTimeout(() => setCopiedProjectId(null), 2000);
  };

  const filteredProjects = projects.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const startRename = (id: string, currentTitle: string) => {
    setEditingProjectId(id);
    setEditTitle(currentTitle);
  };

  const submitRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameProject(id, editTitle.trim());
    }
    setEditingProjectId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">История проектов и версий</h2>
          <p className="text-xs text-slate-400">
            Каждая генерация и ревизия сохраняются как неизменяемые версии с полным аудитом
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по проектам..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
          <GitBranch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-400">
            {searchQuery ? 'Ничего не найдено по запросу' : 'История проектов пока пуста'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Создайте новый промпт на главной странице, и он автоматически сохранится в истории
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  {editingProjectId === p.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="bg-slate-800 border border-indigo-500 rounded px-2 py-1 text-xs text-white w-full"
                        autoFocus
                      />
                      <button
                        onClick={() => submitRename(p.id)}
                        className="px-2 py-1 bg-indigo-600 text-white rounded text-xs"
                      >
                        Сохранить
                      </button>
                    </div>
                  ) : (
                    <h3 className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                      {p.title}
                    </h3>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startRename(p.id, p.title)}
                      className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors"
                      title="Переименовать"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteProject(p.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {p.latestVersion && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] mb-3">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-medium">
                      {p.latestVersion.targetEnvironment}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      Режим: {p.latestVersion.generationMode}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-bold">
                      {p.versionCount} {p.versionCount === 1 ? 'версия' : 'версии'}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {new Date(p.updatedAt).toLocaleDateString('ru-RU')}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleCopyProjectLink(p.id, e)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700/80 transition-all"
                    title="Скопировать постоянную ссылку на проект"
                  >
                    {copiedProjectId === p.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Ссылка</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onSelectProject(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white font-medium transition-all"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Открыть</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
