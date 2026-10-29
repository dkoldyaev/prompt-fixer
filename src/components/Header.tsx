import React from 'react';
import { Sparkles, Key, BookOpen, Layers } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenPresets: () => void;
  onOpenRules: () => void;
  hasCustomKeys: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenPresets,
  onOpenRules,
  hasCustomKeys,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 ring-1 ring-white/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Prompt<span className="text-brand-400">Architect</span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full uppercase tracking-wider">
                PRO 2-Tier
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Интеллектуальный рерайтер системных и пользовательских промптов
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenPresets}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition shadow-sm"
            title="Библиотека готовых пресетов"
          >
            <Layers className="w-3.5 h-3.5 text-brand-400" />
            <span className="hidden md:inline">Готовые примеры</span>
          </button>

          <button
            onClick={onOpenRules}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/80 transition shadow-sm"
            title="Принципы архитектуры промпта"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Архитектура правил</span>
          </button>

          <button
            onClick={onOpenSettings}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition shadow-sm relative ${
              hasCustomKeys
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Настройки API ключей"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">API Ключи</span>
            {hasCustomKeys && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-slate-900" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
