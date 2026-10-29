import React from 'react';
import { X, BookOpen, CheckCircle2, AlertTriangle, Layers, Cpu, Compass } from 'lucide-react';

interface RulesExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesExplainerModal: React.FC<RulesExplainerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Архитектура двухуровневого промпта</h3>
              <p className="text-xs text-slate-400">Система правил проектирования System & User Prompts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs text-slate-300 leading-relaxed">
          {/* Principle 1 */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-2">
            <div className="flex items-center gap-2 text-brand-400 font-semibold text-sm">
              <Layers className="w-4 h-4" />
              <span>1. Разделение уровней (System Prompt vs User Prompt)</span>
            </div>
            <p>
              В <b>Системное сообщение</b> выносится неизменяемый мета-контекст: экспертная роль, методологические правила, постоянные справочные материалы, формат вывода и контрастные Few-Shot примеры. В <b>Пользовательское сообщение</b> помещаются только разовые входные переменные конкретного кейса и призыв к действию.
            </p>
          </div>

          {/* Principle 2 */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              <span>2. Обоснование «Почему» в каждом правиле</span>
            </div>
            <p>
              Модели плохо исполняют «сухие запреты» (Don'ts) без объяснения причин. Например, вместо абстрактного «Не давай радикальных советов» правило формулируется как: «<i>Избегай методов экстинкции, потому что первостепенна стабильная нервная система ребенка</i>». Это дает модели глубокую смысловую опору.
            </p>
          </div>

          {/* Principle 3 */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Compass className="w-4 h-4" />
              <span>3. Контрастный Few-Shot («Плохой ответ» vs «Хороший ответ»)</span>
            </div>
            <p>
              Контрастная пара калибрует модель вдвое точнее, чем просто один пример: «Пример плохого ответа» демонстрирует поверхностность и типичные галлюцинации, а «Пример хорошего ответа» показывает эталонный тон, глубину и структуру аргументации.
            </p>
          </div>

          {/* Principle 4 */}
          <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <Cpu className="w-4 h-4" />
              <span>4. Адаптация под целевую модель (GPT / Gemini / Mistral)</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li><b>GPT (OpenAI):</b> теговая разметка [Блок], явное разграничение ролей и калибровка тональности.</li>
              <li><b>Gemini (Google):</b> четкие заземляющие константы (Grounding), многостраничная иерархия, защита от галлюцинаций.</li>
              <li><b>Mistral (Mistral AI):</b> сжатый императивный стиль, прямые повелительные глаголы, максимальная плотность инструкций без «воды».</li>
            </ul>
          </div>

          {/* Principle 5 */}
          <div className="border border-indigo-900/40 rounded-xl p-4 bg-indigo-950/20 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              <span>5. Рекурсивное применение принципов к запросу на рерайт</span>
            </div>
            <p>
              Сам мета-запрос, который инструмент отправляет языковой модели для переписывания исходного промпта, спроектирован по ровно тем же правилам: он имеет роль, задачу, правила с обоснованием «почему», контрастные примеры рерайтинга и четкий формат ответа.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
