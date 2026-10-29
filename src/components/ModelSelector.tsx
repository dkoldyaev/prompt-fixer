import React from 'react';
import { TargetModel } from '../types';
import { Cpu, Zap, Flame } from 'lucide-react';

interface ModelSelectorProps {
  selectedModel: TargetModel;
  onSelectModel: (model: TargetModel) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  selectedModel,
  onSelectModel,
}) => {
  const models = [
    {
      id: 'gpt' as TargetModel,
      name: 'GPT (OpenAI)',
      subtext: 'GPT-4o / o1 / GPT-4',
      badge: 'Системный контекст',
      icon: Cpu,
      accent: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-400',
      activeRing: 'ring-2 ring-emerald-500 bg-emerald-950/30 border-emerald-500',
      desc: 'Строгое разграничение системного и пользовательского контекста, [Теги] и контрастный Few-Shot.',
    },
    {
      id: 'gemini' as TargetModel,
      name: 'Gemini (Google)',
      subtext: 'Gemini 2.5 / 3.8 Flash & Pro',
      badge: 'Grounding & Иерархия',
      icon: Zap,
      accent: 'from-blue-500/20 to-cyan-500/10 border-blue-500/40 text-blue-400',
      activeRing: 'ring-2 ring-blue-500 bg-blue-950/30 border-blue-500',
      desc: 'Фиксация констант (Grounding), многостраничная иерархия и защита от галлюцинаций.',
    },
    {
      id: 'mistral' as TargetModel,
      name: 'Mistral (Mistral AI)',
      subtext: 'Mistral Large / Pixtral',
      badge: 'Лаконичный императив',
      icon: Flame,
      accent: 'from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-400',
      activeRing: 'ring-2 ring-amber-500 bg-amber-950/30 border-amber-500',
      desc: 'Краткие директивные правила, повелительное наклонение, минимализм без «воды».',
    },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
        Целевая архитектура модели
      </label>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {models.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedModel === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectModel(m.id)}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? m.activeRing
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg border bg-slate-950/60 ${m.accent}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-white block leading-tight">{m.name}</span>
                      <span className="text-[11px] text-slate-400 block">{m.subtext}</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${m.accent}`}>
                    {m.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                  {m.desc}
                </p>
              </div>

              {isSelected && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-brand-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping" />
                  Выбрано для оптимизации
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
