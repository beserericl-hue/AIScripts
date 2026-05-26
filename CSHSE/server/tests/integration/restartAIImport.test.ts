/**
 * P1 follow-on — coverage for POST /api/imports/:importId/restart-ai.
 *
 * The wizard's "Restart with different format" flow lives here. It:
 *   - Validates forceFormat ∈ {null, 'template', 'self_study'}
 *   - 404s on missing imports
 *   - Cancels the prior ai-service job (best-effort)
 *   - Resets aiStatus/buckets/tags/stages/errors
 *   - POSTs a new /ai/import/start to cshse-ai
 *
 * Without a live ai-service we can deterministically cover the
 * validation branches (400 + 404). The happy path is end-to-end-
 * covered by the Stevenson @slow specs (which exercise the
 * /start-ai → callback round trip).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedSubmission(userId: any) {
  return Submission.create({
    submissionId: `RESTART-${Date.now().toString(36)}`,
    institutionName: 'Test U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'draft',
  });
}

async function seedImport(submissionId: any, userId: any) {
  return SelfStudyImport.create({
    submissionId,
    originalFilename: 'restart-test.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: 'completed',
    aiStatus: 'failed',
    aiS3Key: `imports/${submissionId}/source.docx`,
    aiProgramLevel: 'bachelors',
    aiJobId: 'prior-job-id',
    aiBuckets: { '1.a': { standardCode: '1', specCode: 'a' } } as any,
    aiTags: [],
    aiErrors: ['previous failure'],
    extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
    mappedSections: [],
    unmappedContent: [],
  } as any);
}

describe('POST /api/imports/:importId/restart-ai', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns 400 for an invalid forceFormat', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/restart-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ forceFormat: 'garbage' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid forceformat/i);
  });

  it('accepts null forceFormat (auto-detect)', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    const token = signTokenFor(user as any);

    // Stub fetch so the ai-service POSTs return a successful snapshot.
    global.fetch = vi.fn(async (url: any, _init: any) => {
      const u = String(url);
      if (u.endsWith('/cancel')) {
        return new Response('ok', { status: 200 });
      }
      if (u.endsWith('/ai/import/start')) {
        return new Response(JSON.stringify({
          jobId: 'new-job-id',
          status: 'queued',
          queuePosition: 1,
          queueDepth: 1,
          etaSeconds: 30,
        }), { status: 200, headers: { 'content-type': 'application/json' } });
      }
      return new Response('not found', { status: 404 });
    }) as any;

    const res = await request(app)
      .post(`/api/imports/${imp._id}/restart-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ forceFormat: null });
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe('new-job-id');
    expect(res.body.status).toBe('queued');
    // Side effects on the import record.
    const reloaded = await SelfStudyImport.findById(imp._id).lean();
    expect(reloaded?.aiForceFormat).toBeNull();
    expect((reloaded?.aiErrors || []).length).toBe(0);
    expect((reloaded?.aiTags || []).length).toBe(0);
    expect((reloaded?.aiStages || []).length).toBe(0);
    expect(reloaded?.aiJobId).toBe('new-job-id');
  });

  it('accepts forceFormat="template"', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    const token = signTokenFor(user as any);
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith('/cancel')) return new Response('ok', { status: 200 });
      return new Response(JSON.stringify({
        jobId: 'template-job', status: 'queued', queuePosition: 1, queueDepth: 1, etaSeconds: 30,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;
    const res = await request(app)
      .post(`/api/imports/${imp._id}/restart-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ forceFormat: 'template' });
    expect(res.status).toBe(202);
    const reloaded = await SelfStudyImport.findById(imp._id).lean();
    expect(reloaded?.aiForceFormat).toBe('template');
  });

  it('accepts forceFormat="self_study"', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    const token = signTokenFor(user as any);
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith('/cancel')) return new Response('ok', { status: 200 });
      return new Response(JSON.stringify({
        jobId: 'self-study-job', status: 'queued', queuePosition: 1, queueDepth: 1, etaSeconds: 30,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;
    const res = await request(app)
      .post(`/api/imports/${imp._id}/restart-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ forceFormat: 'self_study' });
    expect(res.status).toBe(202);
    const reloaded = await SelfStudyImport.findById(imp._id).lean();
    expect(reloaded?.aiForceFormat).toBe('self_study');
  });

  it('returns 404 when the import does not exist', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/imports/${ghostId}/restart-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('best-effort cancel — ai-service cancel failure does NOT block the restart', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    const token = signTokenFor(user as any);

    // ai-service /cancel rejects; /start succeeds. Restart must still succeed.
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith('/cancel')) {
        return new Response('boom', { status: 500 });
      }
      return new Response(JSON.stringify({
        jobId: 'recovered-job', status: 'queued', queuePosition: 1, queueDepth: 1, etaSeconds: 30,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;
    const res = await request(app)
      .post(`/api/imports/${imp._id}/restart-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(202);
    expect(res.body.jobId).toBe('recovered-job');
  });

  it('resets aiBuckets/tags/stages/errors on a successful restart', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id);
    // Seed some prior parse output to verify it gets wiped.
    imp.aiTags = [{ tagId: 't-1', sectionId: 's', summary: 'old', fullText: 'old', confidence: 0.5 } as any];
    imp.aiPlaceholderSections = [{ paragraphIndex: 0, heading: 'old', standardHint: null, specHint: null } as any];
    imp.aiStages = [{ name: 'mammoth', state: 'done' } as any];
    imp.aiErrors = ['prior error'];
    await imp.save();
    const token = signTokenFor(user as any);
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      if (u.endsWith('/cancel')) return new Response('ok', { status: 200 });
      return new Response(JSON.stringify({
        jobId: 'reset-job', status: 'queued', queuePosition: 1, queueDepth: 1, etaSeconds: 30,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as any;
    const res = await request(app)
      .post(`/api/imports/${imp._id}/restart-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(202);
    const reloaded = await SelfStudyImport.findById(imp._id).lean();
    expect((reloaded?.aiTags || []).length).toBe(0);
    expect((reloaded?.aiPlaceholderSections || []).length).toBe(0);
    expect((reloaded?.aiStages || []).length).toBe(0);
    expect((reloaded?.aiErrors || []).length).toBe(0);
  });
});
