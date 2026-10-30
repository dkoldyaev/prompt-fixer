import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Link2, Copy, Check, Sparkles } from 'lucide-react';
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
  const [copiedFloatingLink, setCopiedFloatingLink] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);

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

  // Re-attach or start listening to SSE events for a specific job
  const attachToJobEvents = useCallback((jobId: string, projectId?: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource(`/api/jobs/${jobId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (e) => {
      try {
        const progress: JobProgressEvent = JSON.parse(e.data);
        setExecutionEvent(progress);

        if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
          eventSource.close();
          eventSourceRef.current = null;

          if (progress.status === 'completed') {
            const targetProjId = projectId || currentProject?.id;
            if (targetProjId) {
              const pRes = await fetch(`/api/projects/${targetProjId}`);
              if (pRes.ok) {
                const pData = await pRes.json();
                setCurrentProject(pData.project);
                setProjectVersions(pData.versions);
                setActiveVersionIndex(Math.max(0, pData.versions.length - 1));
              }
            }
            loadProjects();
            setIsExecuting(false);
          }
        }
      } catch (parseErr) {
        console.warn('Failed to parse SSE event:', parseErr);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [currentProject?.id]);

  // Load a job by unique ID (allows resuming from URL or bookmark)
  const loadJobById = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        console.warn(`Job ${jobId} not found`);
        window.history.replaceState(null, '', '/');
        return;
      }

      const job = await res.json();
      setActiveJobId(job.id);

      // If job is already completed
      if (job.status === 'completed') {
        if (job.projectId) {
          const pRes = await fetch(`/api/projects/${job.projectId}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            setCurrentProject(pData.project);
            setProjectVersions(pData.versions);
            setActiveVersionIndex(Math.max(0, pData.versions.length - 1));
            setActiveTab('create');
            setIsExecuting(false);
            return;
          }
        }
      }

      // If job is in progress
      if (['queued', 'analyzing', 'architecting', 'composing', 'reviewing'].includes(job.status)) {
        if (job.projectId) {
          const pRes = await fetch(`/api/projects/${job.projectId}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            setCurrentProject(pData.project);
            setProjectVersions(pData.versions);
          }
        }

        const percentMap: Record<string, number> = {
          queued: 5,
          analyzing: 25,
          architecting: 50,
          composing: 75,
          reviewing: 90,
        };

        setExecutionEvent({
          jobId: job.id,
          status: job.status,
          currentStep: job.currentStep,
          progressPercent: percentMap[job.status] || 50,
          message: `Возобновлено отслеживание генерации (${job.status})...`,
          intermediateResults: job.intermediateResults,
          metrics: {
            totalTokens: job.totalTokens,
            totalCostUsd: job.totalCostUsd,
          },
        });

        setIsExecuting(true);
        setActiveTab('create');
        attachToJobEvents(job.id, job.projectId);
        return;
      }

      // If job failed or cancelled
      if (job.status === 'failed' || job.status === 'cancelled') {
        if (job.projectId) {
          const pRes = await fetch(`/api/projects/${job.projectId}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            setCurrentProject(pData.project);
            setProjectVersions(pData.versions);
          }
        }

        setExecutionEvent({
          jobId: job.id,
          status: job.status,
          currentStep: job.currentStep,
          progressPercent: 100,
          message: job.errorMessage || `Статус задания: ${job.status}`,
          error: job.errorMessage,
        });
        setIsExecuting(true);
        setActiveTab('create');
      }
    } catch (err) {
      console.error('Failed to load job by ID:', err);
    }
  }, [attachToJobEvents]);

  // Load a project by ID
  const handleSelectProject = useCallback(async (projectId: string, updateUrl = true) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentProject(data.project);
        setProjectVersions(data.versions);
        setActiveVersionIndex(Math.max(0, data.versions.length - 1));
        setActiveTab('create');
        if (updateUrl) {
          window.history.pushState(null, '', `/projects/${projectId}`);
        }
      }
    } catch (err) {
      console.warn('Failed to load project:', err);
    }
  }, []);

  // Handle URL routes (/jobs/:id, /projects/:id, /history, /templates, /settings)
  const handleUrlRouting = useCallback(async () => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const jobParam = searchParams.get('job') || searchParams.get('jobId');
    const projectParam = searchParams.get('project') || searchParams.get('projectId');

    const jobMatch = path.match(/^\/jobs\/([a-zA-Z0-9_-]+)/);
    const targetJobId = jobMatch ? jobMatch[1] : jobParam;

    const projectMatch = path.match(/^\/projects\/([a-zA-Z0-9_-]+)/);
    const targetProjectId = projectMatch ? projectMatch[1] : projectParam;

    if (targetJobId) {
      await loadJobById(targetJobId);
      return;
    }

    if (targetProjectId) {
      await handleSelectProject(targetProjectId, false);
      return;
    }

    if (path === '/history') {
      setActiveTab('history');
      return;
    }
    if (path === '/templates') {
      setActiveTab('templates');
      return;
    }
    if (path === '/settings') {
      setActiveTab('settings');
      return;
    }

    // Default: root path
    if (path === '/') {
      setActiveTab('create');
    }
  }, [loadJobById, handleSelectProject]);

  useEffect(() => {
    loadProjects();
    loadTemplates();
    handleUrlRouting();

    const handlePopState = () => {
      handleUrlRouting();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [handleUrlRouting]);

  // Tab navigation with URL updates
  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'create') {
      if (activeJobId && isBackgroundRunning) {
        window.history.pushState(null, '', `/jobs/${activeJobId}`);
      } else if (currentProject) {
        window.history.pushState(null, '', `/projects/${currentProject.id}`);
      } else {
        window.history.pushState(null, '', '/');
      }
    } else {
      window.history.pushState(null, '', `/${tab}`);
    }
  };

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

      // Immediately set unique URL for this generation
      window.history.pushState(null, '', `/jobs/${jobId}`);

      // 3. Connect to SSE Stream
      attachToJobEvents(jobId, projectId);
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
          setActiveVersionIndex(Math.max(0, pData.versions.length - 1));
        }
        loadProjects();
      }
    } finally {
      setIsRevising(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (confirm('Вы уверены, что хотите удалить этот проект и все его версии?')) {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        setProjectVersions([]);
        window.history.pushState(null, '', '/');
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

  const handleNewPrompt = () => {
    setCurrentProject(null);
    setProjectVersions([]);
    setActiveJobId(null);
    window.history.pushState(null, '', '/');
  };

  const isBackgroundRunning =
    executionEvent !== null &&
    executionEvent.status !== 'completed' &&
    executionEvent.status !== 'failed' &&
    executionEvent.status !== 'cancelled';

  const activeVersion = projectVersions[activeVersionIndex];
  const previousVersion = activeVersionIndex > 0 ? projectVersions[activeVersionIndex - 1] : undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
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
                    onClick={handleNewPrompt}
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

      {/* Floating Widget When Generation Runs In Background (Modal closed by user) */}
      {activeJobId && isBackgroundRunning && !isExecuting && (
        <div className="fixed bottom-6 right-6 z-40 bg-slate-900/95 border border-indigo-500/50 backdrop-blur-md shadow-2xl rounded-2xl p-4 flex items-center gap-4 animate-fade-in max-w-md">
          <div className="relative">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-ping" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-white truncate">Генерация выполняется в фоне</p>
              <span className="text-[11px] text-indigo-400 font-bold">{executionEvent?.progressPercent || 0}%</span>
            </div>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">{executionEvent?.message || 'Поэтапная оркестрация...'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExecuting(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              Открыть
            </button>
            <button
              onClick={() => {
                const url = `${window.location.origin}/jobs/${activeJobId}`;
                navigator.clipboard.writeText(url);
                setCopiedFloatingLink(true);
                setTimeout(() => setCopiedFloatingLink(false), 2000);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs border border-slate-700 transition-colors"
              title="Скопировать ссылку на генерацию"
            >
              {copiedFloatingLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>
        </div>
      )}

      {/* Execution Progress Modal */}
      <ExecutionModal
        isOpen={isExecuting}
        event={executionEvent}
        jobId={activeJobId}
        onCancel={handleCancelJob}
        onClose={() => setIsExecuting(false)}
      />
    </div>
  );
};
