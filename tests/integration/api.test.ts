import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';

describe('Express Backend API Integration Tests', () => {
  it('GET /health returns 200 with configuration metadata', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.config).toBeDefined();
    expect(res.body.config.analyzerModel).toBeDefined();
  });

  it('POST /api/analyze-complexity evaluates raw prompt', async () => {
    const res = await request(app)
      .post('/api/analyze-complexity')
      .send({ rawPrompt: 'Создай PWA для фото на PostgreSQL и Docker' });

    expect(res.status).toBe(200);
    expect(res.body.score).toBeDefined();
    expect(res.body.recommendedMode).toBe('quality');
  });

  it('POST /api/jobs creates a job and executes it asynchronously', async () => {
    const res = await request(app)
      .post('/api/jobs')
      .send({
        rawPrompt: 'Сделай Docker контейнер для Node.js сервиса с PostgreSQL',
        targetEnvironment: 'google-antigravity',
        generationMode: 'fast',
      });

    expect(res.status).toBe(201);
    expect(res.body.jobId).toBeDefined();

    // Poll job status
    const jobRes = await request(app).get(`/api/jobs/${res.body.jobId}`);
    expect(jobRes.status).toBe(200);
    expect(jobRes.body.targetEnvironment).toBe('google-antigravity');
  });

  it('Project CRUD and surgical revision workflow', async () => {
    // 1. Create project
    const projRes = await request(app)
      .post('/api/projects')
      .send({ title: 'Тестовый проект PWA' });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.id;

    // 2. Save version
    const verRes = await request(app)
      .post(`/api/projects/${projectId}/versions`)
      .send({
        rawPrompt: 'Исходный промпт',
        targetEnvironment: 'google-antigravity',
        generationMode: 'quality',
        systemPrompt: 'System Prompt Content v1',
        userPrompt: 'User Prompt Content v1 with authentication',
      });
    expect(verRes.status).toBe(201);
    expect(verRes.body.versionNumber).toBe(1);

    // 3. Surgical revision
    const revRes = await request(app)
      .post(`/api/projects/${projectId}/revision`)
      .send({
        instruction: 'Убери авторизацию. Это приложение только для одного пользователя.',
      });
    expect(revRes.status).toBe(201);
    expect(revRes.body.version.versionNumber).toBe(2);
    expect(revRes.body.changelog.length).toBeGreaterThan(0);

    // 4. Retrieve project with versions
    const getRes = await request(app).get(`/api/projects/${projectId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.versions.length).toBe(2);

    // 5. Delete project
    const delRes = await request(app).delete(`/api/projects/${projectId}`);
    expect(delRes.status).toBe(200);
  });

  it('GET /api/templates returns system prompt templates', async () => {
    const res = await request(app).get('/api/templates');
    expect(res.status).toBe(200);
    expect(res.body.templates.length).toBeGreaterThan(0);
    const keys = res.body.templates.map((t: any) => t.templateKey);
    expect(keys).toContain('requirements-analyzer');
    expect(keys).toContain('solution-architect');
  });
});
