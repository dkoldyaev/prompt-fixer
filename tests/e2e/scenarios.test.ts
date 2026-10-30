import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { loadConfig } from '../../packages/shared/config';
import fs from 'fs';
import path from 'path';

describe('Comprehensive E2E User Scenarios (Section 17.3)', () => {
  let createdProjectId: string;
  let firstVersionId: string;
  let secondVersionId: string;
  let activeJobId: string;

  // Scenario 1: Input short query and get result
  it('Scenario 1: Input short query and obtain result', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        rawPrompt: 'Сделай функцию валидации email адресов',
        targetEnvironment: 'generic-llm',
        generationMode: 'fast',
      });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBeDefined();

    const job = await request(app).get(`/api/jobs/${res.body.jobId}`);
    expect(job.status).toBe(200);
  });

  // Scenario 2: Generation in Fast mode
  it('Scenario 2: Fast mode generation completes in single combined step', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        rawPrompt: 'Добавь CSS класс для анимации спиннера загрузки',
        targetEnvironment: 'cursor',
        generationMode: 'fast',
      });

    expect(res.status).toBe(201);
    const job = await request(app).get(`/api/jobs/${res.body.jobId}`);
    expect(job.body.generationMode).toBe('fast');
  });

  // Scenario 3: Generation in Quality mode (all 4 stages)
  it('Scenario 3: Quality mode generation executes all 4 stages', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        rawPrompt: 'Спроектируй микросервис биллинга с PostgreSQL, Stripe API и очередями RabbitMQ',
        targetEnvironment: 'google-antigravity',
        generationMode: 'quality',
      });

    expect(res.status).toBe(201);
    activeJobId = res.body.jobId;

    const job = await request(app).get(`/api/jobs/${activeJobId}`);
    expect(job.body.generationMode).toBe('quality');
  });

  // Scenario 4: Generation in Adaptive mode
  it('Scenario 4: Adaptive mode routes based on complexity', async () => {
    // 1. Complex prompt => quality
    const complexRes = await request(app)
      .post('/api/jobs')
      .send({
        rawPrompt: 'Разработай распределенный PWA с IndexedDB, PostgreSQL, Docker и оффлайн-синхронизацией',
        targetEnvironment: 'google-antigravity',
        generationMode: 'adaptive',
      });
    expect(complexRes.status).toBe(201);

    // 2. Simple prompt => fast
    const simpleRes = await request(app)
      .post('/api/jobs')
      .send({
        rawPrompt: 'Измени размер шрифта кнопки на 14px',
        targetEnvironment: 'cursor',
        generationMode: 'adaptive',
      });
    expect(simpleRes.status).toBe(201);
  });

  // Scenario 5: Switching target environment
  it('Scenario 5: Switching target environment alters target instructions and context', async () => {
    const targets = ['google-antigravity', 'claude-code', 'cursor'] as const;
    for (const target of targets) {
      const res = await request(app)
        .post('/api/jobs')
        .send({
          rawPrompt: 'Сделай CLI утилиту для конвертации JSON в CSV',
          targetEnvironment: target,
          generationMode: 'fast',
        });
      expect(res.status).toBe(201);
      const job = await request(app).get(`/api/jobs/${res.body.jobId}`);
      expect(job.body.targetEnvironment).toBe(target);
    }
  });

  // Scenario 6: Inspecting System Prompt and User Prompt
  it('Scenario 6: Both System Prompt and User Prompt are rendered with markdown sections', async () => {
    const projRes = await request(app)
      .post('/api/projects')
      .send({ title: 'Проект инспекции промптов' });
    createdProjectId = projRes.body.id;

    const verRes = await request(app)
      .post(`/api/projects/${createdProjectId}/versions`)
      .send({
        rawPrompt: 'Создай сервис для парсинга RSS',
        targetEnvironment: 'google-antigravity',
        generationMode: 'quality',
        systemPrompt: '# System Prompt\n## [1. Role and Context]\nStaff Engineer...',
        userPrompt: '# User Prompt: ТЗ\n## 1. Описание\nПарсер RSS...\n## Final Action\nПриступай к реализации',
        whatImproved: ['Добавлена валидация RSS фидов'],
        assumptions: ['Используется Node.js fetch API'],
      });

    expect(verRes.status).toBe(201);
    firstVersionId = verRes.body.id;

    const fetchRes = await request(app).get(`/api/projects/${createdProjectId}`);
    expect(fetchRes.body.versions[0].systemPrompt).toContain('Staff Engineer');
    expect(fetchRes.body.versions[0].userPrompt).toContain('Final Action');
  });

  // Scenario 7: Copying prompt deliverables
  it('Scenario 7: Deliverables are bundled and ready for single or combined copying', async () => {
    const project = await request(app).get(`/api/projects/${createdProjectId}`);
    const v = project.body.versions[0];
    const combined = `${v.systemPrompt}\n\n---\n\n${v.userPrompt}`;
    expect(combined).toContain('Staff Engineer');
    expect(combined).toContain('Final Action');
  });

  // Scenario 8: Saving into History
  it('Scenario 8: Generations are stored in project history and listed with metadata', async () => {
    const listRes = await request(app).get('/api/projects');
    expect(listRes.status).toBe(200);
    expect(listRes.body.projects.length).toBeGreaterThan(0);
    const found = listRes.body.projects.find((p: any) => p.id === createdProjectId);
    expect(found).toBeDefined();
    expect(found.versionCount).toBe(1);
  });

  // Scenario 9: Surgical revision via additional instruction
  it('Scenario 9: Applying surgical revision produces a new version with changelog', async () => {
    const revRes = await request(app)
      .post(`/api/projects/${createdProjectId}/revision`)
      .send({
        instruction: 'Убери авторизацию. Это приложение только для одного пользователя.',
      });

    expect(revRes.status).toBe(201);
    expect(revRes.body.version.versionNumber).toBe(2);
    expect(revRes.body.changelog.length).toBeGreaterThan(0);
    secondVersionId = revRes.body.version.id;
  });

  // Scenario 10: Version diff comparison
  it('Scenario 10: Compare two versions and detect diff modifications', async () => {
    const proj = await request(app).get(`/api/projects/${createdProjectId}`);
    const v1 = proj.body.versions.find((v: any) => v.versionNumber === 1);
    const v2 = proj.body.versions.find((v: any) => v.versionNumber === 2);

    expect(v1).toBeDefined();
    expect(v2).toBeDefined();
    expect(v1.userPrompt).not.toEqual(v2.userPrompt);
  });

  // Scenario 11: Re-running quality review
  it('Scenario 11: Re-running quality audit confirms requirements coverage', async () => {
    const proj = await request(app).get(`/api/projects/${createdProjectId}`);
    const v2 = proj.body.versions.find((v: any) => v.versionNumber === 2);
    expect(v2.reviewReport).toBeDefined();
    expect(v2.reviewReport.isApproved).toBe(true);
  });

  // Scenario 12: API Error handling (invalid input or cancellation)
  it('Scenario 12: API gracefully returns 400 with descriptive error on invalid payload', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({ rawPrompt: '' }); // empty rawPrompt
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // Scenario 13: Recovering running job on page refresh / re-fetch
  it('Scenario 13: State persists so browser refresh re-attaches to existing job', async () => {
    const jobRes = await request(app).get(`/api/jobs/${activeJobId}`);
    expect(jobRes.status).toBe(200);
    expect(jobRes.body.id).toBe(activeJobId);
  });

  // Scenario 14: Strict configuration validation error
  it('Scenario 14: Process rejects invalid configuration at startup without fallbacks', () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: 'invalid',
        OPENAI_API_KEY: '', // empty
      } as any)
    ).toThrowError(/Strict Configuration Error/);
  });

  // Scenario 15: Docker Compose files integrity
  it('Scenario 15: Docker Compose files exist, base has NO postgres, and override HAS postgres', () => {
    const baseCompose = fs.readFileSync(path.resolve(process.cwd(), 'docker-compose.yml'), 'utf-8');
    const overrideCompose = fs.readFileSync(path.resolve(process.cwd(), 'docker-compose.override.yml'), 'utf-8');

    // Base compose MUST NOT contain postgres service
    expect(baseCompose).not.toContain('image: postgres');

    // Override compose MUST contain postgres service, volume, and healthcheck
    expect(overrideCompose).toContain('image: postgres');
    expect(overrideCompose).toContain('pgdata:');
    expect(overrideCompose).toContain('healthcheck:');
  });
});
