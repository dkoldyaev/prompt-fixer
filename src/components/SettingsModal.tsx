import React, { useState } from 'react';
import { X, Key, Shield, Check, Info } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKeys: {
    gemini?: string;
    openai?: string;
    mistral?: string;
  };
  onSaveKeys: (keys: { gemini?: string; openai?: string; mistral?: string }) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKeys,
  onSaveKeys,
}) => {
  const [gemini, setGemini] = useState(apiKeys.gemini || '');
  const [openai, setOpenai] = useState(apiKeys.openai || '');
  const [mistral, setMistral] = useState(apiKeys.mistral || '');
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKeys({ gemini: gemini.trim(), openai: openai.trim(), mistral: mistral.trim() });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Настройки API ключей</h3>
              <p className="text-xs text-slate-400">Прямое подключение к нейросетям</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-brand-500/10 border border-brand-500/20 text-xs text-brand-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Ключи сохраняются исключительно в вашем браузере (LocalStorage). Приложение уже содержит встроенный оптимизатор архитектуры промптов, поэтому указание ключей является опциональным.
            </p>
          </div>

          {/* OpenAI Key */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              OpenAI API Key (для GPT-4o / o1)
            </label>
            <input
              type="password"
              value={openai}
              onChange={(e) => setOpenai(e.target.value)}
              placeholder="sk-proj-..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          {/* Gemini Key */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={gemini}
              onChange={(e) => setGemini(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Mistral Key */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Mistral AI API Key
            </label>
            <input
              type="password"
              value={mistral}
              onChange={(e) => setMistral(e.target.value)}
              placeholder="..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Шифрование на клиенте</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition flex items-center gap-1.5 shadow-md shadow-brand-500/20"
              >
                {saved ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Сохранено!</span>
                  </>
                ) : (
                  <span>Сохранить настройки</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
