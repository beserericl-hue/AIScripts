/**
 * CR-018 / Sprint 4.1 finish — evidence-recommendations endpoint.
 *
 * GET /api/submissions/:id/specs/:std/:spec/evidence-recommendations
 *
 * Pins:
 *   - reader / lead_reader / admin → 200; PC → 403
 *   - 404 on unknown submission
 *   - 400 when submission has no institutionId (cross-institution audit boundary)
 *   - 502 when ai-service throws (fail-soft from the controller)
 *   - the call to recommendEvidence threads institutionId + submissionId +
 *     programLevel + topK (default 5, capped at 20)
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import * as ai from '../../src/services/cshseAiClient';
import { createUser, signTokenFor } from '../helpers/factories';

let recommendSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // recommendEvidence resolves to the structured { ready, data } envelope
  // (ready:false on the 501 "not shipped" stub; ready:true + data otherwise).
  recommendSpy = vi.spyOn(ai, 'recommendEvidence').mockResolvedValue({
    ready: true,
    data: {
      chunks: [
        { chunkId: 'c1', score: 0.91, payload: { text: 'org chart', filename: 'a.pdf' } } as any,
        { chunkId: 'c2', score: 0.84, payload: { text: 'mission', filename: 'b.pdf' } } as any
      ]
    }
  } as any);
});

afterEach(() => vi.restoreAllMocks());

async function seed(opts: { withInstitution?: boolean } = {}) {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const { user: reader } = await createUser({ role: 'reader' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  const submissionDoc: any = {
    submissionId: `EV-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Evidence U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'under_review'
  };
  if (opts.withInstitution !== false) {
    submissionDoc.institutionId = new mongoose.Types.ObjectId();
  }
  const sub: any = await Submission.create(submissionDoc);
  return {
    sid: String(sub._id),
    instId: submissionDoc.institutionId ? String(submissionDoc.institutionId) : null,
    adminTok: signTokenFor(admin as any),
    leadTok: signTokenFor(lead as any),
    readerTok: signTokenFor(reader as any),
    pcTok: signTokenFor(pc as any)
  };
}

describe('CR-018 — evidence-recommendations endpoint', () => {
  it('reader gets 200 + chunks; ai-service called with the right scope', async () => {
    const { sid, instId, readerTok } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/specs/1/a/evidence-recommendations`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.chunks.length).toBe(2);
    expect(res.body.standardCode).toBe('1');
    expect(res.body.specCode).toBe('a');
    expect(res.body.topK).toBe(5);

    expect(recommendSpy).toHaveBeenCalledTimes(1);
    const arg = recommendSpy.mock.calls[0][0] as any;
    expect(arg.institutionId).toBe(instId);
    expect(arg.submissionId).toBe(sid);
    expect(arg.standardCode).toBe('1');
    expect(arg.specCode).toBe('a');
    expect(arg.programLevel).toBe('bachelors');
    expect(arg.topK).toBe(5);
  });

  it('lead_reader 200; admin 200', async () => {
    const { sid, leadTok, adminTok } = await seed();
    const lead = await request(app)
      .get(`/api/submissions/${sid}/specs/2/b/evidence-recommendations`)
      .set('Authorization', `Bearer ${leadTok}`);
    expect(lead.status).toBe(200);

    const admin = await request(app)
      .get(`/api/submissions/${sid}/specs/2/b/evidence-recommendations`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(admin.status).toBe(200);
  });

  it('PC → 403; ai-service NOT called', async () => {
    const { sid, pcTok } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/specs/1/a/evidence-recommendations`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(res.status).toBe(403);
    expect(recommendSpy).not.toHaveBeenCalled();
  });

  it('topK query param is parsed + clamped to [1, 20]', async () => {
    const { sid, readerTok } = await seed();
    const r1 = await request(app)
      .get(`/api/submissions/${sid}/specs/1/a/evidence-recommendations?topK=3`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(r1.status).toBe(200);
    expect((recommendSpy.mock.calls[0][0] as any).topK).toBe(3);

    vi.clearAllMocks();
    recommendSpy.mockResolvedValue({ ready: true, data: { chunks: [] } } as any);
    const r2 = await request(app)
      .get(`/api/submissions/${sid}/specs/1/a/evidence-recommendations?topK=99`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(r2.status).toBe(200);
    expect((recommendSpy.mock.calls[0][0] as any).topK).toBe(20);
  });

  it('404 on unknown submission', async () => {
    await seed();
    const { user: reader } = await createUser({ role: 'reader' });
    const bogus = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/submissions/${bogus}/specs/1/a/evidence-recommendations`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(404);
  });

  it('400 when submission has no institutionId (audit boundary)', async () => {
    const { sid, readerTok } = await seed({ withInstitution: false });
    const res = await request(app)
      .get(`/api/submissions/${sid}/specs/1/a/evidence-recommendations`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(400);
    expect(recommendSpy).not.toHaveBeenCalled();
  });

  it('502 when ai-service throws; controller fail-softs cleanly', async () => {
    const { sid, readerTok } = await seed();
    recommendSpy.mockRejectedValueOnce(new Error('Qdrant down'));
    const res = await request(app)
      .get(`/api/submissions/${sid}/specs/1/a/evidence-recommendations`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unreachable/i);
  });
});
