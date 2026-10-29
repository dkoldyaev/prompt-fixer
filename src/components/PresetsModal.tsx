import React from 'react';
import { X, Layers, Baby, Code, Mail, Scale, ArrowRight } from 'lucide-react';
import { TargetLanguage, TargetModel } from '../types';

interface Preset {
  id: string;
  title: string;
  category: string;
  description: string;
  rawPrompt: string;
  targetModel: TargetModel;
  targetLanguage: TargetLanguage;
}

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (preset: Preset) => void;
}

export const PRESETS_LIST: Preset[] = [
  {
    id: 'theodor-sleep',
    title: 'Режим сна Теодора (Пример из задания)',
    category: 'Медицина и Сон',
    description: 'Оптимизация режима сна Теодора: выход из 23-часового цикла с мягкими методиками.',
    rawPrompt: `Помоги составить режим сна для ребенка Теодора 10 месяцев. У него сейчас утреннее пробуждение сдвигается все раньше и раньше, получается 23 часа в сутках вместо 24: спит ночью 10-10.5 часов, бодрствует 10 часов, и два дневных сна на 2.5-3 часа. Нужно мягко растянуть сутки до 24 часов без стресса и слез. Напиши конкретно что делать.`,
    targetModel: 'gpt',
    targetLanguage: 'ru',
  },
  {
    id: 'code-architecture',
    title: 'Аудит и рефакторинг очередей Node.js',
    category: 'Разработка ПО',
    description: 'Устранение утечки памяти и зависания Event Loop при highload.',
    rawPrompt: `У меня на бэкенде микросервис очередей на Node.js и TypeScript падает с Out Of Memory при нагрузке свыше 2000 RPS. Напиши архитектуру с backpressure, типами и обработкой ошибок.`,
    targetModel: 'gemini',
    targetLanguage: 'ru',
  },
  {
    id: 'b2b-sales',
    title: 'B2B Enterprise Outreach (English)',
    category: 'Маркетинг и Продажи',
    description: 'Холодное письмо для технических директоров (CTO) с акцентом на ROI.',
    rawPrompt: `Write an effective cold outreach email to CTOs of fintech startups offering our automated API security scanner. Make it sound non-pushy and highlight tangible ROI.`,
    targetModel: 'mistral',
    targetLanguage: 'en',
  },
  {
    id: 'legal-audit',
    title: 'Юридический анализ договора подряда',
    category: 'Юриспруденция',
    description: 'Поиск скрытых штрафов, кабальных условий и рисков передачи прав.',
    rawPrompt: `Проверь договор подряда на разработку ПО. Нужно найти все кабальные условия для исполнителя, скрытые неустойки и риски с передачей исключительных прав.`,
    targetModel: 'gpt',
    targetLanguage: 'ru',
  },
];

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
}) => {
  if (!isOpen) return null;

  const getIcon = (cat: string) => {
    if (cat.includes('Сон')) return Baby;
    if (cat.includes('Разработка')) return Code;
    if (cat.includes('Продажи')) return Mail;
    return Scale;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Библиотека пресетов</h3>
              <p className="text-xs text-slate-400">Выберите готовый сырой запрос для демонстрации</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="p-6 space-y-3 overflow-y-auto">
          {PRESETS_LIST.map((preset) => {
            const Icon = getIcon(preset.category);
            return (
              <div
                key={preset.id}
                onClick={() => {
                  onSelectPreset(preset);
                  onClose();
                }}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/50 hover:border-brand-500/50 transition cursor-pointer group flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-brand-500/30 text-brand-400 transition shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        {preset.category}
                      </span>
                      <span className="text-[11px] text-slate-500 uppercase font-mono">
                        {preset.targetModel} • {preset.targetLanguage}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-white group-hover:text-brand-300 transition">
                      {preset.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-1 text-slate-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all">
                  <ArrowRight className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
