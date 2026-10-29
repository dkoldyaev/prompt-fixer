import React from 'react';
import { TargetLanguage } from '../types';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  selectedLanguage: TargetLanguage;
  onSelectLanguage: (lang: TargetLanguage) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selectedLanguage,
  onSelectLanguage,
}) => {
  const languages: { id: TargetLanguage; label: string; native: string; flag: string }[] = [
    { id: 'ru', label: 'Русский', native: 'Русский', flag: '🇷🇺' },
    { id: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
    { id: 'es', label: 'Español', native: 'Español', flag: '🇪🇸' },
    { id: 'de', label: 'Deutsch', native: 'Deutsch', flag: '🇩🇪' },
    { id: 'fr', label: 'Français', native: 'Français', flag: '🇫🇷' },
    { id: 'zh', label: 'Chinese', native: '中文', flag: '🇨🇳' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <Globe className="w-3.5 h-3.5 text-brand-400" />
          Язык выдачи промпта
        </label>
        <span className="text-[11px] text-slate-500">
          Будут переведены и роли, и правила, и примеры
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => {
          const isSelected = selectedLanguage === lang.id;
          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => onSelectLanguage(lang.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-150 ${
                isSelected
                  ? 'bg-brand-500/20 border-brand-500 text-white shadow-sm ring-1 ring-brand-500'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.native}</span>
              {isSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
