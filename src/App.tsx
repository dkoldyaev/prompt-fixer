import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { PromptCreator } from './components/PromptCreator';
import { ExecutionModal } from './components/ExecutionModal';
import { ResultView } from './components/ResultView';
import { HistoryView } from './components/HistoryView';
import { TemplatesView } from './components/TemplatesView';
import { SettingsView } from './components/SettingsView';
import { TargetEnvironment, GenerationMode, DetailLevel, JobProgressEvent } from '../packages/shared/types';
import { ProjectEntity, VersionEntity } from '../server/database';
import { PromptTemplateDefinition } from '../packages/prompt-templates';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('create');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionEvent, setExecutionEvent] = useState<JobProgressEvent | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Active Project & Versions
  const [currentProject, setCurrentProject] = useState<ProjectEntity | null>(null);
  const [projectVersions, setProjectVersions] = useState<VersionEntity[]>([]);
  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(0);

  // History & Templates Data
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [templatesList, setTemplatesList] = useState<PromptTemplateDefinition[]>([]);
  const [isRevising, setIsRevising] = useState<boolean>(false);

  // Load projects and templates on mount
  const loadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjectsList(data.projects || []);
      }
    } catch (err) {
      console.warn('Failed to fetch projects:', err);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplatesList(data.templates || []);
      }
    } catch (err) {
      console.warn('Failed to fetch templates:', err);
    }
  };

  useEffect(() => {
    loadProjects();
    loadTemplates();
  }, []);

  // Handle Prompt Generation Trigger
  const handleGenerate = async (params: {
    rawPrompt: string;
    targetEnvironment: TargetEnvironment;
    generationMode: GenerationMode;
    preferences: {
      targetLanguage: string;
      detailLevel: DetailLevel;
      includeArchitecturalAdditions: boolean;
      includeExplanations: boolean;
      customInstructions?: string;
    };
  }) => {
    setIsExecuting(true);
    setExecutionEvent({
      jobId: 'init',
      status: 'queued',
      progressPercent: 5,
      message: 'Инициализация задания...',
    });

    try {
      // 1. Create or determine project
      let projectId = currentProject?.id;
      if (!projectId) {
        const titleSnippet =
          params.rawPrompt.slice(0, 45).replace(/\n/g, ' ') + (params.rawPrompt.length > 45 ? '...' : '');
        const projRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: titleSnippet }),
        });
        if (projRes.ok) {
          const newProj = await projRes.json();
          setCurrentProject(newProj);
          projectId = newProj.id;
        }
      }

      // 2. Launch Job
      const jobRes = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawPrompt: params.rawPrompt,
          targetEnvironment: params.targetEnvironment,
          generationMode: params.generationMode,
          projectId,
          preferences: params.preferences,
        }),
      });

      if (!jobRes.ok) {
        const err = await jobRes.json();
        throw new Error(err.error || 'Failed to start job');
      }

      const { jobId } = await jobRes.json();
      setActiveJobId(jobId);

      // 3. Connect to SSE Stream
      const eventSource = new EventSource(`/api/jobs/${jobId}/events`);

      eventSource.onmessage = async (e) => {
        try {
          const progress: JobProgressEvent = JSON.parse(e.data);
          setExecutionEvent(progress);

          if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
            eventSource.close();

            if (progress.status === 'completed' && projectId) {
              // Reload project versions
              const pRes = await fetch(`/api/projects/${projectId}`);
              if (pRes.ok) {
                const pData = await pRes.json();
                setCurrentProject(pData.project);
                setProjectVersions(pData.versions);
                setActiveVersionIndex(pData.versions.length - 1);
              }
              loadProjects();
            }
          }
        } catch (parseErr) {
          console.warn('Failed to parse SSE event:', parseErr);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
      };
    } catch (err: any) {
      setExecutionEvent({
        jobId: 'error',
        status: 'failed',
        progressPercent: 100,
        message: err.message,
        error: err.message,
      });
    }
  };

  const handleCancelJob = async () => {
    if (activeJobId) {
      await fetch(`/api/jobs/${activeJobId}/cancel`, { method: 'POST' });
    }
  };

  const handleApplyRevision = async (instruction: string) => {
    if (!currentProject) return;
    setIsRevising(true);
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction }),
      });
      if (res.ok) {
        // Refresh project versions
        const pRes = await fetch(`/api/projects/${currentProject.id}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          setProjectVersions(pData.versions);
          setActiveVersionIndex(pData.versions.length - 1);
        }
        loadProjects();
      }
    } finally {
      setIsRevising(false);
    }
  };

  const handleSelectProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentProject(data.project);
        setProjectVersions(data.versions);
        setActiveVersionIndex(data.versions.length - 1);
        setActiveTab('create');
      }
    } catch (err) {
      console.warn('Failed to load project:', err);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Вы уверены, что хотите удалить этот проект и все его версии?')) {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        setProjectVersions([]);
      }
      loadProjects();
    }
  };

  const handleRenameProject = async (projectId: string, newTitle: string) => {
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    loadProjects();
  };

  const handleSaveTemplate = async (template: PromptTemplateDefinition) => {
    await fetch(`/api/templates/${template.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });
    loadTemplates();
  };

  const activeVersion = projectVersions[activeVersionIndex];
  const previousVersion = activeVersionIndex > 0 ? projectVersions[activeVersionIndex - 1] : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeProjectTitle={currentProject?.title}
        versionNumber={activeVersion?.versionNumber}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'create' && (
          <div className="space-y-8 animate-fade-in">
            {activeVersion ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {currentProject?.title}
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      Спецификация и System Prompt для целевого AI-агента
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentProject(null);
                      setProjectVersions([]);
                    }}
                    className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-colors"
                  >
                    + Новый промпт
                  </button>
                </div>

                <ResultView
                  version={activeVersion}
                  previousVersion={previousVersion}
                  onApplyRevision={handleApplyRevision}
                  onRegenerate={() => {
                    handleGenerate({
                      rawPrompt: activeVersion.rawPrompt,
                      targetEnvironment: activeVersion.targetEnvironment,
                      generationMode: activeVersion.generationMode,
                      preferences: {
                        targetLanguage: activeVersion.settings?.targetLanguage || 'ru',
                        detailLevel: activeVersion.settings?.detailLevel || 'detailed',
                        includeArchitecturalAdditions: true,
                        includeExplanations: true,
                      },
                    });
                  }}
                  isRevising={isRevising}
                />
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                    Превратите идею в{' '}
                    <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-amber-300 bg-clip-text text-transparent">
                      безупречное ТЗ
                    </span>
                  </h1>
                  <p className="text-sm text-slate-400 max-w-xl mx-auto">
                    Глубокий анализ требований, выявление архитектурных пробелов, синтез инвариантов и подготовка System & User промптов для AI-агентов.
                  </p>
                </div>

                <PromptCreator onGenerate={handleGenerate} isLoading={isExecuting} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <HistoryView
            projects={projectsList}
            onSelectProject={handleSelectProject}
            onDeleteProject={handleDeleteProject}
            onRenameProject={handleRenameProject}
          />
        )}

        {activeTab === 'templates' && (
          <TemplatesView templates={templatesList} onSaveTemplate={handleSaveTemplate} />
        )}

        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Execution Progress Modal */}
      <ExecutionModal
        isOpen={isExecuting}
        event={executionEvent}
        onCancel={handleCancelJob}
        onClose={() => setIsExecuting(false)}
      />
    </div>
  );
};
