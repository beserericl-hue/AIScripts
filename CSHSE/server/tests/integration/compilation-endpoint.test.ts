/**
 * CR-009 / Sprint 5.1 — lead-reader compilation endpoint.
 *
 * GET /api/submissions/:id/compilation
 *   - lead_reader / admin / superuser → 200 with rows + readers
 *   - PC / reader → 403
 *   - per-row flags: hasZero, hasDisagreement, allAgree
 *   - excluded-spec passthrough (CR-050)
 *
 * PUT /api/submissions/:id/compilation/final-score
 *   - lead_reader → 200, upserts, audit-logged
 *   - PC / reader → 403
 *   - invalid score → 400
 *   - audit entry `compilation.final_set` with priorScore + new score
 *
 * DELETE /api/submissions/:id/compilation/final-score
 *   - lead_reader → 200, clears, audit-logged (`compilation.final_cleared`)
 *
 * Each test seeds + asserts within itself to survive the per-test
 * collection wipe in tests/setup.ts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Score } from '../../src/models/Score';
import { LeadFinalScore } from '../../src/models/LeadFinalScore';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function waitForAudit(query: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await AuditLogEntry.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function seed(opts: { excluded?: boolean } = {}) {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const { user: r1 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Alpha' });
  const { user: r2 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Bravo' });
  const { user: r3 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Charlie' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  const standardsStatus: Record<string, any> = {
    '1_a': { status: 'in_progress' },
    '1_b': { status: 'in_progress' },
    '2_a': { status: 'in_progress' }
  };
  if (opts.excluded) {
    standardsStatus['2_a'] = { excluded: true, excludedReason: 'Not applicable to bachelors' };
  }

  const sub: any = await Submission.create({
    submissionId: `COMP-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Compilation U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'review_complete',
    standardsStatus
  });

  // Three readers vote on spec 1.a:
  //   r1=3, r2=2, r3=0 → disagreement + zero
  // Spec 1.b: all agree (2/2/2)
  // Spec 2.a: only r1 votes (no disagreement, no zero unless excluded)
  await Score.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'a',
    reviewerId: r1._id,
    reviewerName: 'Reader Alpha',
    reviewerRole: 'reader',
    score: 3
  });
  await Score.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'a',
    reviewerId: r2._id,
    reviewerName: 'Reader Bravo',
    reviewerRole: 'reader',
    score: 2
  });
  await Score.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'a',
    reviewerId: r3._id,
    reviewerName: 'Reader Charlie',
    reviewerRole: 'reader',
    score: 0
  });

  await Score.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'b',
    reviewerId: r1._id,
    reviewerName: 'Reader Alpha',
    reviewerRole: 'reader',
    score: 2
  });
  await Score.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'b',
    reviewerId: r2._id,
    reviewerName: 'Reader Bravo',
    reviewerRole: 'reader',
    score: 2
  });

  await Score.create({
    submissionId: sub._id,
    standardCode: '2',
    specCode: 'a',
    reviewerId: r1._id,
    reviewerName: 'Reader Alpha',
    reviewerRole: 'reader',
    score: 1
  });

  return {
    sid: String(sub._id),
    admin: signTokenFor(admin as any),
    lead: signTokenFor(lead as any),
    reader: signTokenFor(r1 as any),
    pc: signTokenFor(pc as any),
    leadId: String(lead._id)
  };
}

describe('CR-009 — GET /api/submissions/:id/compilation', () => {
  it('returns side-by-side rows with hasZero + hasDisagreement + allAgree flags (lead_reader)', async () => {
    const { sid, lead } = await seed();

    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${lead}`);

    expect(res.status).toBe(200);
    expect(res.body.readers.length).toBe(3);
    expect(res.body.rows.length).toBe(3);

    const row1a = res.body.rows.find((r: any) => r.standardCode === '1' && r.specCode === 'a');
    expect(row1a).toBeDefined();
    expect(row1a.hasZero).toBe(true);
    expect(row1a.hasDisagreement).toBe(true);
    expect(row1a.allAgree).toBe(false);
    expect(row1a.scores.length).toBe(3);

    const row1b = res.body.rows.find((r: any) => r.standardCode === '1' && r.specCode === 'b');
    expect(row1b.hasZero).toBe(false);
    expect(row1b.hasDisagreement).toBe(false);
    expect(row1b.allAgree).toBe(true);

    const row2a = res.body.rows.find((r: any) => r.standardCode === '2' && r.specCode === 'a');
    expect(row2a.hasZero).toBe(false);
    expect(row2a.hasDisagreement).toBe(false);
    // Only one voter → allAgree false (needs at least 2 to "agree").
    expect(row2a.allAgree).toBe(false);
  });

  it('passes through excluded (CR-050) on the row', async () => {
    const { sid, lead } = await seed({ excluded: true });
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${lead}`);
    expect(res.status).toBe(200);
    const row2a = res.body.rows.find((r: any) => r.standardCode === '2' && r.specCode === 'a');
    expect(row2a.excluded).toBe(true);
    expect(row2a.excludedReason).toBe('Not applicable to bachelors');
  });

  it('rejects a PC viewer (403) — they must never see raw reader votes', async () => {
    const { sid, pc } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${pc}`);
    expect(res.status).toBe(403);
  });

  it('rejects a reader (403) — readers only see their own scores', async () => {
    const { sid, reader } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${reader}`);
    expect(res.status).toBe(403);
  });

  it('admin can view compilation', async () => {
    const { sid, admin } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${admin}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBeGreaterThan(0);
  });

  it('404 for an unknown submission', async () => {
    const { lead } = await seed();
    const bogus = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/submissions/${bogus}/compilation`)
      .set('Authorization', `Bearer ${lead}`);
    expect(res.status).toBe(404);
  });
});

describe('CR-009 — PUT /api/submissions/:id/compilation/final-score', () => {
  it('lead_reader upserts a final score; audit entry compilation.final_set fires', async () => {
    const { sid, lead, leadId } = await seed();

    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', score: 2, note: 'consensus call' });

    expect(res.status).toBe(200);
    expect(res.body.finalScore.score).toBe(2);

    const stored = await LeadFinalScore.findOne({ submissionId: sid, standardCode: '1', specCode: 'a' });
    expect(stored?.score).toBe(2);
    expect(String(stored?.setById)).toBe(leadId);

    const audit = await waitForAudit({
      action: 'compilation.final_set',
      targetId: sid
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.score).toBe(2);
    expect(audit.payload?.standardCode).toBe('1');
    expect(audit.payload?.specCode).toBe('a');
    expect(audit.payload?.priorScore).toBeNull();
  });

  it('subsequent update records priorScore in the audit payload', async () => {
    const { sid, lead } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', score: 2 });

    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', score: 3 });

    expect(res.status).toBe(200);
    expect(res.body.finalScore.score).toBe(3);

    const entries = await AuditLogEntry.find({
      action: 'compilation.final_set',
      targetId: sid
    }).sort({ timestamp: 1 });
    // poll for both
    let tries = 0;
    let list = entries;
    while (list.length < 2 && tries < 60) {
      await new Promise((r) => setTimeout(r, 50));
      list = await AuditLogEntry.find({
        action: 'compilation.final_set',
        targetId: sid
      }).sort({ timestamp: 1 });
      tries++;
    }
    expect(list.length).toBeGreaterThanOrEqual(2);
    const latest = list[list.length - 1];
    expect(latest.payload?.score).toBe(3);
    expect(latest.payload?.priorScore).toBe(2);
  });

  it('rejects an invalid score (400)', async () => {
    const { sid, lead } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', score: 7 });
    expect(res.status).toBe(400);
  });

  it('rejects a PC (403)', async () => {
    const { sid, pc } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${pc}`)
      .send({ standardCode: '1', specCode: 'a', score: 2 });
    expect(res.status).toBe(403);
  });

  it('rejects a reader (403)', async () => {
    const { sid, reader } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${reader}`)
      .send({ standardCode: '1', specCode: 'a', score: 2 });
    expect(res.status).toBe(403);
  });
});

describe('CR-009 — DELETE /api/submissions/:id/compilation/final-score', () => {
  it('clears the final score and audit-logs compilation.final_cleared', async () => {
    const { sid, lead } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', score: 2 });

    const res = await request(app)
      .delete(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a' });

    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(true);

    const remaining = await LeadFinalScore.findOne({ submissionId: sid, standardCode: '1', specCode: 'a' });
    expect(remaining).toBeNull();

    const audit = await waitForAudit({
      action: 'compilation.final_cleared',
      targetId: sid
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.priorScore).toBe(2);
  });

  it('rejects a PC (403)', async () => {
    const { sid, pc } = await seed();
    const res = await request(app)
      .delete(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${pc}`)
      .send({ standardCode: '1', specCode: 'a' });
    expect(res.status).toBe(403);
  });
});
