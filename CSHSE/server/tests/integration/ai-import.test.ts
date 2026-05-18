/**
 * AI Import Wizard — server integration tests (sub-sprint 1.a).
 *
 * Covers what the wizard's HTTP surface needs to guarantee:
 *   - GET /ai-status returns the persisted snapshot
 *   - POST /apply-ai is the stub described in §11.5 + sub-sprint 1.a
 *   - POST /ai-event + /ai-callback webhooks REQUIRE a valid HMAC signature
 *     (the cshse-ai service signs outgoing webhooks; the server verifies)
 *   - /ai-callback persists buckets / tags / placeholders the AI service sent
 *   - /ai-event persists incremental queue + stage updates
 *
 * Does NOT cover:
 *   - The actual cshse-ai dispatch (POST /start-ai hits an external service —
 *     covered separately by ai-service tests)
 *   - SSE streaming (vitest doesn't have a great EventSource client; the
 *     E2E test in e2e/ai-import.spec.ts covers the live SSE path)
 */
import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

const TEST_HMAC_SECRET = 'test-hmac-secret-must-be-non-empty';

function signRequest(body: object): { ts: string; signature: string } {
  const ts = Math.floor(Date.now() / 1000).toString();
  const raw = JSON.stringify(body);
  const digest = crypto
    .createHmac('sha256', TEST_HMAC_SECRET)
    .update(`${ts}.${raw}`)
    .digest('hex');
  return { ts, signature: `t=${ts},v1=${digest}` };
}

async function createSubmissionForUser(userId: any) {
  const submission = await Submission.create({
    submissionId: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    institutionName: 'Test University',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'draft',
    narratives: new Map()
  } as any);
  return submission;
}

async function createImport(submissionId: any, userId: any) {
  return await SelfStudyImport.create({
    submissionId,
    originalFilename: 'sample.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: 'processing',
    aiStatus: 'parsed',
    aiS3Key: `imports/${submissionId}/source.docx`,
    aiProgramLevel: 'bachelors',
    extractedContent: {
      rawText: '',
      pageCount: 0,
      metadata: {},
      sections: []
    },
    mappedSections: [],
    unmappedContent: []
  } as any);
}

describe('AI Import Wizard — server routes (sub-sprint 1.a)', () => {
  beforeEach(() => {
    process.env.NODE_SERVICE_HMAC_SECRET = TEST_HMAC_SECRET;
  });

  // ------------------------------------------------ GET /ai-status

  describe('GET /api/imports/:importId/ai-status', () => {
    it('returns persisted snapshot fields', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);
      imp.aiQueuePosition = 2;
      imp.aiQueueDepth = 3;
      imp.aiStages = [{ name: 'mammoth', state: 'done', detail: '1 MB' } as any];
      await imp.save();
      const token = signTokenFor(user as any);

      const res = await request(app)
        .get(`/api/imports/${imp._id}/ai-status`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('parsed');
      expect(res.body.queuePosition).toBe(2);
      expect(res.body.queueDepth).toBe(3);
      expect(res.body.stages).toHaveLength(1);
      expect(res.body.stages[0].name).toBe('mammoth');
    });

    it('returns 404 when import not found', async () => {
      const { user } = await createUser();
      const token = signTokenFor(user as any);
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/imports/${fakeId}/ai-status`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('requires authentication', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);

      const res = await request(app).get(`/api/imports/${imp._id}/ai-status`);
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------ POST /apply-ai (real)

  describe('POST /api/imports/:importId/apply-ai (real, sub-sprint 1.c)', () => {
    it('writes narratives onto Submission.narratives and returns counts', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);
      const token = signTokenFor(user as any);

      const payload = {
        narratives: {
          '1': {
            a: { content: '<p>fresh narrative for 1.a</p>', mode: 'merge' }
          }
        },
        supportingEvidenceText: {},
        supportingEvidenceFiles: [
          { std: '1', spec: 'a', title: 'Evidence file 1' }
        ],
        matrixCells: [],
        importTags: [{ tagId: 'tag-1', sectionId: 'sec-1' }],
        placeholderSections: [],
        globalMergeMode: 'merge',
        idempotencyKey: 'idem-test-1'
      };

      const res = await request(app)
        .post(`/api/imports/${imp._id}/apply-ai`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.appliedCounts.narratives).toBe(1);
      expect(res.body.appliedCounts.evidenceFiles).toBe(1);
      expect(res.body.appliedCounts.tags).toBe(1);

      // Submission.narratives was actually written.
      const reloadedSubmission = await Submission.findById(submission._id);
      const std1: any = (reloadedSubmission?.narratives as any).get('1');
      const spec1a: any = std1?.get?.('a') || std1?.a;
      expect(spec1a?.content || '').toContain('fresh narrative for 1.a');
      expect(spec1a?.linkedDocuments).toContain('Evidence file 1');

      // SelfStudyImport.aiStatus flipped.
      const reloadedImport = await SelfStudyImport.findById(imp._id);
      expect(reloadedImport?.aiStatus).toBe('applied');
    });

    it('idempotency: same key returns cached counts without re-writing', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);
      const token = signTokenFor(user as any);

      const payload = {
        narratives: { '1': { a: { content: 'first', mode: 'merge' } } },
        importTags: [],
        placeholderSections: [],
        globalMergeMode: 'merge',
        idempotencyKey: 'idem-replay'
      };

      const first = await request(app)
        .post(`/api/imports/${imp._id}/apply-ai`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(first.body.ok).toBe(true);

      // Second call: same key, different content — should NOT re-apply.
      const second = await request(app)
        .post(`/api/imports/${imp._id}/apply-ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...payload,
          narratives: { '1': { a: { content: 'SECOND CONTENT THAT SHOULD NOT LAND', mode: 'replace' } } }
        });
      expect(second.body.ok).toBe(true);
      expect(second.body.idempotentReplay).toBe(true);

      // Submission still contains the FIRST content.
      const reloadedSubmission = await Submission.findById(submission._id);
      const std1: any = (reloadedSubmission?.narratives as any).get('1');
      const spec1a: any = std1?.get?.('a') || std1?.a;
      expect(spec1a?.content || '').toContain('first');
      expect(spec1a?.content || '').not.toContain('SECOND CONTENT');
    });

    it('merge mode appends to existing narrative content', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      // Seed Submission.narratives with pre-existing content for 1.a
      (submission.narratives as any).set(
        '1',
        new Map([
          [
            'a',
            { content: 'existing prose', lastModified: new Date(), isComplete: false, linkedDocuments: [] }
          ]
        ])
      );
      (submission as any).markModified('narratives');
      await submission.save();

      const imp = await createImport(submission._id, user._id);
      const token = signTokenFor(user as any);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/apply-ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          narratives: { '1': { a: { content: 'NEW prose', mode: 'merge' } } },
          importTags: [],
          placeholderSections: [],
          globalMergeMode: 'merge',
          idempotencyKey: 'idem-merge-test'
        });
      expect(res.status).toBe(200);

      const reloadedSubmission = await Submission.findById(submission._id);
      const std1: any = (reloadedSubmission?.narratives as any).get('1');
      const spec1a: any = std1?.get?.('a') || std1?.a;
      // Merge prepends existing, separates with <hr>, appends new.
      expect(spec1a?.content).toContain('existing prose');
      expect(spec1a?.content).toContain('NEW prose');
      expect(spec1a?.content).toContain('<hr');
    });

    it('replace mode overwrites existing narrative content', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      (submission.narratives as any).set(
        '1',
        new Map([
          [
            'a',
            { content: 'OLD prose', lastModified: new Date(), isComplete: false, linkedDocuments: [] }
          ]
        ])
      );
      (submission as any).markModified('narratives');
      await submission.save();

      const imp = await createImport(submission._id, user._id);
      const token = signTokenFor(user as any);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/apply-ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          narratives: { '1': { a: { content: 'FRESH prose', mode: 'replace' } } },
          importTags: [],
          placeholderSections: [],
          globalMergeMode: 'replace',
          idempotencyKey: 'idem-replace-test'
        });
      expect(res.status).toBe(200);

      const reloadedSubmission = await Submission.findById(submission._id);
      const std1: any = (reloadedSubmission?.narratives as any).get('1');
      const spec1a: any = std1?.get?.('a') || std1?.a;
      expect(spec1a?.content).toBe('FRESH prose');
      expect(spec1a?.content).not.toContain('OLD prose');
    });

    it('returns 409 when status is not parsed', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);
      imp.aiStatus = 'parsing';
      await imp.save();
      const token = signTokenFor(user as any);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/apply-ai`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Cannot apply/);
    });
  });

  // ------------------------------------------------ POST /ai-event (HMAC-signed webhook)

  describe('POST /api/imports/:importId/ai-event (webhook)', () => {
    it('rejects requests without HMAC signature with 401', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/ai-event`)
        .send({ status: 'parsing' });

      expect(res.status).toBe(401);
    });

    it('rejects requests with malformed signature', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/ai-event`)
        .set('X-Service-Signature', 'garbage')
        .send({ status: 'parsing' });

      expect(res.status).toBe(401);
    });

    it('accepts a properly-signed event and persists status + stages', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);

      const body = {
        status: 'parsing',
        queuePosition: null,
        queueDepth: null,
        stages: [
          { name: 'mammoth', state: 'done', detail: '0.50 MB' },
          { name: 'template_walker', state: 'running', detail: '...' }
        ],
        errors: []
      };
      const { signature } = signRequest(body);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/ai-event`)
        .set('X-Service-Signature', signature)
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const reloaded = await SelfStudyImport.findById(imp._id);
      expect(reloaded?.aiStatus).toBe('parsing');
      expect(reloaded?.aiStages).toHaveLength(2);
      expect(reloaded?.aiStages?.[1].state).toBe('running');
    });

    it('rejects a signature that is older than the 5-minute skew', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);

      const body = { status: 'parsing' };
      const oldTs = (Math.floor(Date.now() / 1000) - 400).toString(); // 6m30s ago
      const raw = JSON.stringify(body);
      const digest = crypto
        .createHmac('sha256', TEST_HMAC_SECRET)
        .update(`${oldTs}.${raw}`)
        .digest('hex');
      const signature = `t=${oldTs},v1=${digest}`;

      const res = await request(app)
        .post(`/api/imports/${imp._id}/ai-event`)
        .set('X-Service-Signature', signature)
        .send(body);

      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------ POST /ai-callback (terminal)

  describe('POST /api/imports/:importId/ai-callback (terminal webhook)', () => {
    it('persists buckets / tags / placeholders on terminal parsed event', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);

      const body = {
        status: 'parsed',
        buckets: {
          '1.a': {
            standardCode: '1',
            specCode: 'a',
            standardTitle: 'Test',
            specPrompt: 'test',
            narratives: [
              {
                sectionId: 'sec-1',
                heading: 'h',
                snippet: 's',
                wordCount: 10,
                confidence: 0.9,
                acceptState: 'auto_accept',
                rationale: 'r'
              }
            ],
            evidenceText: [],
            evidenceFiles: [],
            matrixCells: [],
            coverageScore: 0.8,
            coverageCovered: false,
            coverageGaps: ['gap-1'],
            coverageStrengths: []
          }
        },
        tags: [
          {
            tagId: 'tag-1',
            sectionId: 'sec-2',
            summary: 'sum',
            fullText: 'full',
            suggestedStd: '1',
            suggestedSpec: 'b',
            confidence: 0.4,
            sourceHeading: 'src',
            acceptState: 'review_low_confidence',
            rationale: 'r2'
          }
        ],
        placeholderSections: [
          { paragraphIndex: 12, heading: 'unwritten', standardHint: '5', specHint: null }
        ],
        matrices: [],
        format: { format: 'template', confidence: 0.95, signals: {}, reasoning: 'detected' },
        stages: [{ name: 'done', state: 'done', detail: '' }],
        errors: []
      };
      const { signature } = signRequest(body);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/ai-callback`)
        .set('X-Service-Signature', signature)
        .send(body);

      expect(res.status).toBe(200);

      const reloaded = await SelfStudyImport.findById(imp._id);
      expect(reloaded?.aiStatus).toBe('parsed');
      expect(reloaded?.aiTags).toHaveLength(1);
      expect(reloaded?.aiTags?.[0].tagId).toBe('tag-1');
      expect(reloaded?.aiPlaceholderSections).toHaveLength(1);
      expect(reloaded?.aiFormat?.format).toBe('template');

      // Record<string, IAIBucket>: read via property access
      const bucket = reloaded?.aiBuckets?.['1.a'];
      expect(bucket).toBeDefined();
      expect(bucket?.narratives).toHaveLength(1);
      expect(bucket?.coverageGaps).toContain('gap-1');
    });

    it('rejects unsigned callbacks with 401', async () => {
      const { user } = await createUser();
      const submission = await createSubmissionForUser(user._id);
      const imp = await createImport(submission._id, user._id);

      const res = await request(app)
        .post(`/api/imports/${imp._id}/ai-callback`)
        .send({ status: 'parsed' });

      expect(res.status).toBe(401);
    });
  });
});
