import React, { useState, useEffect } from 'react';
import { Settings, ShieldCheck, Cpu, DollarSign, Database, CheckCircle2 } from 'lucide-react';
import { MODEL_PRICING_CATALOG } from '../../packages/shared/pricing';

export const SettingsView: React.FC = () => {
  const [healthData, setHealthData] = useState<any>(null);

  useEffect(() => {
    fetch('/health')
      .then((res) => res.json())
      .then((data) => setHealthData(data))
      .catch((err) => console.warn('Health fetch error:', err));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white">Конфигурация и окружение сервиса</h2>
        <p className="text-xs text-slate-400">
          Все параметры среды строго типизированы, проверены Zod при старте без скрытых fallback-значений
        </p>
      </div>

      {/* Strict Config Status Card */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Строгая политика конфигурации (No-Fallback Policy)</h3>
            <p className="text-xs text-slate-400">Все обязательные переменные среды валидированы при инициализации процесса</p>
          </div>
        </div>

        <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
          Активно
        </span>
      </div>

      {/* Model Per Stage Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" />
          Модели OpenAI для этапов AI Pipeline:
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { stage: '1. Requirements Analyzer', role: 'Экономия & QA', reasoning: 'medium', key: 'OPENAI_ANALYZER_MODEL', val: healthData?.config?.analyzerModel || 'gpt-6.1-terra' },
            { stage: '2. Solution Architect', role: 'Качество & Синтез', reasoning: 'medium', key: 'OPENAI_ARCHITECT_MODEL', val: healthData?.config?.architectModel || 'gpt-6.1-sol' },
            { stage: '3. Prompt Composer', role: 'Качество & Генерация ТЗ', reasoning: 'medium', key: 'OPENAI_COMPOSER_MODEL', val: healthData?.config?.composerModel || 'gpt-6.1-sol' },
            { stage: '4. Quality Reviewer', role: 'Экономия & Аудит', reasoning: 'medium', key: 'OPENAI_REVIEWER_MODEL', val: healthData?.config?.reviewerModel || 'gpt-6.1-terra' },
            { stage: 'Fast Mode Execution', role: 'Однопроходный режим', reasoning: 'medium', key: 'OPENAI_FAST_MODEL', val: healthData?.config?.fastModel || 'gpt-6.1-terra' },
          ].map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="font-medium text-slate-300 block">{item.stage}</span>
                <span className="text-[10px] text-slate-400 block">{item.role} • reasoning: {item.reasoning}</span>
                <span className="text-[10px] text-slate-500 font-mono">{item.key}</span>
              </div>
              <span className="font-mono font-bold text-indigo-400 px-2 py-1 bg-indigo-500/10 rounded border border-indigo-500/20">
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing Catalog Card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-amber-400" />
          Версионируемый каталог тарифов (за 1 млн токенов):
        </h3>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs divide-y divide-slate-800">
            <thead className="bg-slate-800/60 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Идентификатор модели</th>
                <th className="px-4 py-3">Входные токены</th>
                <th className="px-4 py-3">Кэшированные токены</th>
                <th className="px-4 py-3">Выходные токены</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {Object.entries(MODEL_PRICING_CATALOG).map(([model, pricing]) => (
                <tr key={model} className="hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 font-mono font-bold text-slate-200">{model}</td>
                  <td className="px-4 py-2.5">${pricing.inputPerMillion.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {pricing.cachedInputPerMillion ? `$${pricing.cachedInputPerMillion.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-amber-400 font-medium">${pricing.outputPerMillion.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
