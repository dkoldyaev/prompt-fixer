import React, { useState } from 'react';
import { PromptTemplateDefinition } from '../../packages/prompt-templates';
import { FileCode, Save, Check, Edit2, ShieldAlert } from 'lucide-react';

interface TemplatesViewProps {
  templates: PromptTemplateDefinition[];
  onSaveTemplate: (template: PromptTemplateDefinition) => Promise<void>;
}

export const TemplatesView: React.FC<TemplatesViewProps> = ({ templates, onSaveTemplate }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id || '');
  const [editedContent, setEditedContent] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  React.useEffect(() => {
    if (selectedTemplate) {
      setEditedContent(selectedTemplate.content);
      setIsSaved(false);
    }
  }, [selectedTemplateId, selectedTemplate]);

  const handleSave = async () => {
    if (!selectedTemplate) return;
    const parts = selectedTemplate.version.split('.');
    const patch = parseInt(parts[2] || '0', 10) + 1;
    const newVersion = `${parts[0]}.${parts[1]}.${patch}`;

    await onSaveTemplate({
      ...selectedTemplate,
      content: editedContent,
      version: newVersion,
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const globalTemplates = templates.filter((t) => t.level === 'global');
  const targetTemplates = templates.filter((t) => t.level === 'target');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Управление системными промпт-шаблонами</h2>
        <p className="text-xs text-slate-400">
          Все системные инструкции оркестрации версионируются и изолированы по уровням (Global / Target)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template List Column */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Глобальные шаблоны (Global):
            </h4>
            <div className="space-y-1.5">
              {globalTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all ${
                    selectedTemplateId === t.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-[10px] opacity-75">v{t.version}</span>
                  </div>
                  <p className="text-[11px] opacity-75 truncate mt-1">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Целевые среды (Target):
            </h4>
            <div className="space-y-1.5">
              {targetTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplateId(t.id)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-medium transition-all ${
                    selectedTemplateId === t.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-[10px] opacity-75">v{t.version}</span>
                  </div>
                  <p className="text-[11px] opacity-75 truncate mt-1">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template Editor Column */}
        <div className="md:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
          {selectedTemplate ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedTemplate.name}</h3>
                  <p className="text-xs text-slate-400">
                    Ключ: <code className="text-indigo-400 font-mono">{selectedTemplate.templateKey}</code> · Версия: v{selectedTemplate.version}
                  </p>
                </div>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/20"
                >
                  {isSaved ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4" />}
                  <span>{isSaved ? 'Сохранено!' : 'Сохранить версию'}</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Текст системного промпта:
                </label>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={18}
                  className="w-full bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-200 border border-slate-700/80 focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-500 text-sm">
              Выберите шаблон для редактирования
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
