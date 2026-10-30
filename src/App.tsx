import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Link2, Copy, Check, Sparkles, CheckSquare, FileText, AlertCircle, RefreshCw } from 'lucide-react';
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

  // 3-way top-level workspace section: 'request' | 'tasks' | 'result'
  const [workspaceSection, setWorkspaceSection] = useState<'request' | 'tasks' | 'result'>('result');

  // Route loading state and error handling
  const [isRouteLoading, setIsRouteLoading] = useState<boolean>(() => {
    const path = window.location.pathname;
    return path.startsWith('/jobs/') || path.startsWith('/projects/');
  });
  const [routeError, setRouteError] = useState<{ title: string; message: string; id: string } | null>(null);

  // History & Templates Data
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [templatesList, setTemplatesList] = useState<PromptTemplateDefinition[]>([]);
  const [isRevising, setIsRevising] = useState<boolean>(false);
  const [copiedFloatingLink, setCopiedFloatingLink] = useState(false);
  const [editorDraftPrompt, setEditorDraftPrompt] = useState<string | undefined>(undefined);
  const [editorDraftTarget, setEditorDraftTarget] = useState<TargetEnvironment | undefined>(undefined);

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
            setWorkspaceSection('result');
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
    setIsRouteLoading(true);
    setRouteError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        setRouteError({
          title: 'Задание не найдено',
          message: `Задание "${jobId}" не найдено в текущей базе данных. Если вы перешли по ссылке из другого окружения (ветка или продакшен), проверьте адрес хоста.`,
          id: jobId,
        });
        setIsRouteLoading(false);
        return;
      }

      const job = await res.json();
      setActiveJobId(job.id);

      const promptText =
        job.rawPrompt ||
        job.intermediateResults?.rawPrompt ||
        job.intermediateResults?.analyzer?.userGoal ||
        '';
      if (promptText) {
        setEditorDraftPrompt(promptText);
      }
      if (job.targetEnvironment) {
        setEditorDraftTarget(job.targetEnvironment);
      }

      // If job is already completed
      if (job.status === 'completed') {
        let loadedProject = job.project || null;
        let loadedVersions: VersionEntity[] = job.versions || [];

        if (job.projectId && (!loadedVersions || loadedVersions.length === 0)) {
          const pRes = await fetch(`/api/projects/${job.projectId}`);
          if (pRes.ok) {
            const pData = await pRes.json();
            loadedProject = pData.project;
            loadedVersions = pData.versions;
          }
        }

        // If still no versions, synthesize one from intermediateResults
        if (!loadedVersions || loadedVersions.length === 0) {
          const composer = job.intermediateResults?.composer;
          const analyzer = job.intermediateResults?.analyzer;
          const architect = job.intermediateResults?.architect;
          const reviewReport = job.intermediateResults?.reviewReport;

          const rawPrompt =
            job.rawPrompt ||
            job.intermediateResults?.rawPrompt ||
            (analyzer?.requirements?.map((r: any) => r.originalQuote).filter(Boolean).join('\n') ||
              analyzer?.userGoal ||
              'Генерация ' + job.id);

          const synthVersion: VersionEntity = {
            id: `v_${job.id}`,
            projectId: job.projectId || `proj_${job.id}`,
            versionNumber: 1,
            rawPrompt,
            targetEnvironment: job.targetEnvironment,
            generationMode: job.generationMode,
            settings: job.intermediateResults?.preferences || {},
            systemPrompt: composer?.systemPrompt || '',
            userPrompt: composer?.userPrompt || '',
            whatImproved: composer?.whatImproved || [],
            assumptions: composer?.assumptions || [],
            unresolvedQuestions: composer?.unresolvedQuestions || [],
            reviewReport: reviewReport || {
              isApproved: true,
              score: 95,
              traceability: [],
              critique: [],
              fixesApplied: null,
              summary: 'Синтезировано из результатов генерации',
            },
            requirements: analyzer,
            architecturalDecisions: architect,
            totalTokens: job.totalTokens,
            totalCostUsd: job.totalCostUsd,
            createdAt: job.createdAt,
          };

          loadedVersions = [synthVersion];
          if (!loadedProject) {
            loadedProject = {
              id: synthVersion.projectId,
              title: analyzer?.userGoal || 'Проект ' + job.id,
              createdAt: job.createdAt,
              updatedAt: job.updatedAt,
            };
          }
        }

        setCurrentProject(loadedProject);
        setProjectVersions(loadedVersions);
        setActiveVersionIndex(Math.max(0, loadedVersions.length - 1));
        setActiveTab('create');
        setWorkspaceSection('result');
        setIsExecuting(false);
        setIsRouteLoading(false);
        return;
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
        setIsRouteLoading(false);
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
        setIsRouteLoading(false);
      }
    } catch (err: any) {
      setRouteError({
        title: 'Ошибка соединения',
        message: err.message || 'Не удалось связаться с сервером',
        id: jobId,
      });
      setIsRouteLoading(false);
    }
  }, [attachToJobEvents]);

  // Load a project by ID
  const handleSelectProject = useCallback(async (projectId: string, updateUrl = true) => {
    setIsRouteLoading(true);
    setRouteError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        setRouteError({
          title: 'Проект не найден',
          message: `Проект с ID "${projectId}" не найден. Возможно, он был удален или создан в другом окружении.`,
          id: projectId,
        });
        setIsRouteLoading(false);
        return;
      }
      const data = await res.json();
      setCurrentProject(data.project);
      setProjectVersions(data.versions || []);
      const verCount = data.versions ? data.versions.length : 0;
      setActiveVersionIndex(Math.max(0, verCount - 1));

      const latestVer = verCount > 0 ? data.versions[verCount - 1] : null;
      if (latestVer?.rawPrompt) {
        setEditorDraftPrompt(latestVer.rawPrompt);
        setEditorDraftTarget(latestVer.targetEnvironment);
      } else if (data.project?.title) {
        setEditorDraftPrompt(data.project.title);
      }

      setActiveTab('create');
      setWorkspaceSection('result');
      if (updateUrl) {
        window.history.pushState(null, '', `/projects/${projectId}`);
      }
    } catch (err: any) {
      setRouteError({
        title: 'Ошибка соединения',
        message: err.message || 'Не удалось связаться с сервером',
        id: projectId,
      });
    } finally {
      setIsRouteLoading(false);
    }
  }, []);

  // Handle URL routes (/jobs/:id, /projects/:id, /history, /templates, /settings)
  const handleUrlRouting = useCallback(async () => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const jobParam = searchParams.get('job') || searchParams.get('jobId');
    const projectParam = searchParams.get('project') || searchParams.get('projectId');
    const tabParam = searchParams.get('tab') || searchParams.get('section');

    if (tabParam === 'request' || tabParam === 'tasks' || tabParam === 'result') {
      setWorkspaceSection(tabParam);
    }

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
      setIsRouteLoading(false);
    }
  }, [loadJobById, handleSelectProject]);

  const handleUrlRoutingRef = useRef(handleUrlRouting);
  handleUrlRoutingRef.current = handleUrlRouting;

  useEffect(() => {
    loadProjects();
    loadTemplates();
    handleUrlRoutingRef.current();

    const handlePopState = () => {
      handleUrlRoutingRef.current();
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

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

  const handleRetryJob = async () => {
    if (!activeJobId) return;
    setIsExecuting(true);
    setExecutionEvent({
      jobId: activeJobId,
      status: 'queued',
      progressPercent: 10,
      message: 'Перезапуск выполнения задания...',
    });
    try {
      const res = await fetch(`/api/jobs/${activeJobId}/retry`, { method: 'POST' });
      if (res.ok) {
        attachToJobEvents(activeJobId, currentProject?.id);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to retry job');
      }
    } catch (err: any) {
      setExecutionEvent({
        jobId: activeJobId,
        status: 'failed',
        progressPercent: 100,
        message: err.message,
        error: err.message,
      });
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
    setEditorDraftPrompt('');
    setEditorDraftTarget(undefined);
    setCurrentProject(null);
    setProjectVersions([]);
    setActiveJobId(null);
    setRouteError(null);
    setWorkspaceSection('request');
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
            {/* 1. Loading spinner when opening link */}
            {isRouteLoading && (
              <div className="py-24 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-sm font-semibold text-slate-300">
                  Загрузка проекта и результатов генерации...
                </p>
              </div>
            )}

            {/* 2. Error banner if job/project link not found */}
            {!isRouteLoading && routeError && (
              <div className="max-w-2xl mx-auto my-8 p-6 rounded-2xl bg-slate-900 border border-rose-500/30 text-center space-y-4 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold text-white">{routeError.title}</h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-lg mx-auto">
                  {routeError.message}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setRouteError(null);
                      handleNewPrompt();
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20"
                  >
                    Создать новый промпт
                  </button>
                  <button
                    onClick={() => {
                      setRouteError(null);
                      setActiveTab('history');
                      window.history.pushState(null, '', '/history');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Перейти в историю
                  </button>
                </div>
              </div>
            )}

            {/* 3. Main Workspace when not loading and no error */}
            {!isRouteLoading && !routeError && (
              <>
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

                      <div className="flex items-center gap-3">
                        {projectVersions.length > 1 && (
                          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                            <span className="text-[11px] text-slate-400 px-2 font-medium">Версия:</span>
                            {projectVersions.map((v, idx) => (
                              <button
                                key={v.id}
                                onClick={() => setActiveVersionIndex(idx)}
                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                  activeVersionIndex === idx
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                v{v.versionNumber}
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          onClick={handleNewPrompt}
                          className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-semibold transition-colors"
                        >
                          + Новый промпт
                        </button>
                      </div>
                    </div>

                    <ResultView
                      version={activeVersion}
                      previousVersion={previousVersion}
                      onApplyRevision={handleApplyRevision}
                      onRegenerate={(customPrompt, customTarget) => {
                        handleGenerate({
                          rawPrompt: customPrompt || activeVersion.rawPrompt,
                          targetEnvironment: customTarget || activeVersion.targetEnvironment,
                          generationMode: activeVersion.generationMode,
                          preferences: {
                            targetLanguage: activeVersion.settings?.targetLanguage || 'ru',
                            detailLevel: activeVersion.settings?.detailLevel || 'detailed',
                            includeArchitecturalAdditions: true,
                            includeExplanations: true,
                            customInstructions: activeVersion.settings?.customInstructions,
                          },
                        });
                      }}
                      activeSection={workspaceSection}
                      onSectionChange={setWorkspaceSection}
                      isRevising={isRevising}
                    />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Top 3-way navigation even before generation */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 flex items-center gap-1.5 shadow-lg max-w-4xl mx-auto">
                      <button
                        onClick={() => setWorkspaceSection('request')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                          workspaceSection === 'request'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        <span>1. Запрос</span>
                      </button>

                      <button
                        onClick={() => setWorkspaceSection('tasks')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                          workspaceSection === 'tasks'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <CheckSquare className="w-4 h-4" />
                        <span>2. Какие были задачи</span>
                      </button>

                      <button
                        onClick={() => setWorkspaceSection('result')}
                        className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                          workspaceSection === 'result'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>3. Результат</span>
                      </button>
                    </div>

                    {workspaceSection === 'request' ? (
                      <div className="max-w-4xl mx-auto space-y-6">
                        <div className="text-center space-y-2 mb-4">
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

                        <PromptCreator
                          onGenerate={handleGenerate}
                          isLoading={isExecuting}
                          initialPrompt={editorDraftPrompt}
                          initialTarget={editorDraftTarget}
                        />
                      </div>
                    ) : (
                      <div className="max-w-2xl mx-auto py-16 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-8 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                          {workspaceSection === 'tasks' ? <CheckSquare className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                        </div>
                        <h3 className="text-base font-bold text-white">
                          {workspaceSection === 'tasks' ? 'Задачи еще не извлечены' : 'Результат еще не сгенерирован'}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                          Перейдите во вкладку «1. Запрос», заполните требования и нажмите кнопку «Сгенерировать ТЗ и System Prompt».
                        </p>
                        <button
                          onClick={() => setWorkspaceSection('request')}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20"
                        >
                          ← Перейти к запросу
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
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
        onRetry={handleRetryJob}
      />
    </div>
  );
};
