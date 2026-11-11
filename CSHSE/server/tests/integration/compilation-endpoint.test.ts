/**
 * CR-009 / Sprint 5.1 — lead-reader compilation endpoint.
 *
 * Lauri CR (Nov 2026): the 0-3 score is removed. The compilation shows each
 * reader's Compliant / Non-compliant MARK from their own Reader Report
 * (ReaderReport.rows[].mark), and the lead reader sets a Final MARK per spec.
 *
 * GET /api/submissions/:id/compilation
 *   - lead_reader / admin / superuser → 200 with rows + readers
 *   - PC / reader → 403
 *   - per-row flags: hasNonCompliant, hasDisagreement, allAgree
 *   - excluded-spec passthrough (CR-050)
 *   - legacy 0-3 Final documents (no finalMark) are ignored
 *
 * PUT /api/submissions/:id/compilation/final-mark
 *   - lead_reader → 200, upserts, audit-logged (compilation.final_set)
 *   - numeric score / unknown mark → 400; PC / reader → 403
 *
 * DELETE /api/submissions/:id/compilation/final-mark
 *   - lead_reader → 200, clears, audit-logged (compilation.final_cleared)
 *
 * The retired routes (/scores, /compilation/final-score, /final-scores) 404.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { ReaderReport } from '../../src/models/ReaderReport';
import { LeadFinalMark } from '../../src/models/LeadFinalMark';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function waitForAudit(query: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await AuditLogEntry.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

type M = 'compliant' | 'noncompliant' | '';
function row(standardCode: string, specCode: string, mark: M) {
  return { standardCode, specCode, mark, comment: '' };
}

async function seed(opts: { excluded?: boolean; assignLead?: boolean } = {}) {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const { user: r1 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Alpha' });
  const { user: r2 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Bravo' });
  const { user: r3 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Charlie' });
  const { user: r4 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Delta' });
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

  if (opts.assignLead !== false) {
    await assignToSubmission(sub, lead, 'lead_reader');
  }

  // Reader Report marks:
  //   1.a: Alpha C, Bravo C, Charlie NC → disagreement + hasNonCompliant
  //   1.b: Alpha C, Bravo C             → all agree
  //   2.a: Alpha NC only                → hasNonCompliant, no disagreement
  // Introduction rows and unmarked rows are ignored; Delta marked nothing.
  await ReaderReport.create({
    submissionId: sub._id,
    reviewerId: r1._id,
    rows: [row('1', 'a', 'compliant'), row('1', 'b', 'compliant'), row('2', 'a', 'noncompliant'), row('introduction', 'a', 'noncompliant')],
    completedAt: new Date()
  });
  await ReaderReport.create({
    submissionId: sub._id,
    reviewerId: r2._id,
    rows: [row('1', 'a', 'compliant'), row('1', 'b', 'compliant'), row('2', 'a', '')]
  });
  await ReaderReport.create({
    submissionId: sub._id,
    reviewerId: r3._id,
    rows: [row('1', 'a', 'noncompliant')]
  });
  await ReaderReport.create({
    submissionId: sub._id,
    reviewerId: r4._id,
    rows: [row('1', 'a', ''), row('1', 'b', '')]
  });

  return {
    sid: String(sub._id),
    admin: signTokenFor(admin as any),
    lead: signTokenFor(lead as any),
    reader: signTokenFor(r1 as any),
    readerId: String(r1._id),
    r3Id: String(r3._id),
    pc: signTokenFor(pc as any),
    leadId: String(lead._id)
  };
}

describe('CR-009 — GET /api/submissions/:id/compilation (readers\' Compliant / Non-compliant marks)', () => {
  it('returns each reader\'s mark side by side with hasNonCompliant + hasDisagreement + allAgree flags', async () => {
    const { sid, lead, r3Id } = await seed();

    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${lead}`);

    expect(res.status).toBe(200);
    // Delta marked nothing → not a column.
    expect(res.body.readers.map((r: any) => r.name)).toEqual(['Reader Alpha', 'Reader Bravo', 'Reader Charlie']);
    expect(res.body.readers.find((r: any) => r.name === 'Reader Alpha').completed).toBe(true);
    // Only numbered-standard specs (no introduction row).
    expect(res.body.rows.map((r: any) => `${r.standardCode}.${r.specCode}`)).toEqual(['1.a', '1.b', '2.a']);

    const row1a = res.body.rows.find((r: any) => r.standardCode === '1' && r.specCode === 'a');
    expect(row1a.hasNonCompliant).toBe(true);
    expect(row1a.hasDisagreement).toBe(true);
    expect(row1a.allAgree).toBe(false);
    expect(row1a.marks.length).toBe(3);
    expect(row1a.marks.find((m: any) => m.reviewerId === r3Id)).toMatchObject({ reviewerName: 'Reader Charlie', mark: 'noncompliant' });
    expect(row1a.finalMark).toBeNull();
    // No numeric score anywhere in the payload.
    expect(row1a.scores).toBeUndefined();
    expect(row1a.finalScore).toBeUndefined();
    expect(row1a.hasZero).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/"score"/);

    const row1b = res.body.rows.find((r: any) => r.standardCode === '1' && r.specCode === 'b');
    expect(row1b.hasNonCompliant).toBe(false);
    expect(row1b.hasDisagreement).toBe(false);
    expect(row1b.allAgree).toBe(true);
    expect(row1b.marks.every((m: any) => m.mark === 'compliant')).toBe(true);

    const row2a = res.body.rows.find((r: any) => r.standardCode === '2' && r.specCode === 'a');
    expect(row2a.hasNonCompliant).toBe(true);
    expect(row2a.hasDisagreement).toBe(false);
    // Only one marker → allAgree false (needs at least 2 to "agree").
    expect(row2a.allAgree).toBe(false);
    expect(row2a.marks.length).toBe(1);
  });

  it('shows the lead reader\'s Final mark on the row once set', async () => {
    const { sid, lead } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'noncompliant' });

    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${lead}`);
    const row1a = res.body.rows.find((r: any) => r.standardCode === '1' && r.specCode === 'a');
    expect(row1a.finalMark).toBe('noncompliant');
    expect(row1a.finalSetByName).toBeTruthy();
  });

  it('ignores a legacy 0-3 Final document (numeric score, no finalMark)', async () => {
    const { sid, lead, leadId } = await seed();
    await LeadFinalMark.collection.insertOne({
      submissionId: new mongoose.Types.ObjectId(sid),
      standardCode: '1',
      specCode: 'b',
      score: 2,
      setById: new mongoose.Types.ObjectId(leadId),
      setByName: 'Old Lead',
      setByRole: 'lead_reader',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${lead}`);
    expect(res.status).toBe(200);
    const row1b = res.body.rows.find((r: any) => r.standardCode === '1' && r.specCode === 'b');
    expect(row1b.finalMark).toBeNull();

    // Re-setting it overwrites the legacy doc and drops the numeric field.
    const put = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'b', mark: 'compliant' });
    expect(put.status).toBe(200);
    const raw: any = await LeadFinalMark.collection.findOne({ submissionId: new mongoose.Types.ObjectId(sid), standardCode: '1', specCode: 'b' });
    expect(raw.finalMark).toBe('compliant');
    expect(raw.score).toBeUndefined();
    expect(await LeadFinalMark.countDocuments({ submissionId: sid })).toBe(1);
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

  it('rejects a PC viewer (403) — they must never see raw reader marks', async () => {
    const { sid, pc } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/compilation`)
      .set('Authorization', `Bearer ${pc}`);
    expect(res.status).toBe(403);
  });

  it('rejects a reader (403)', async () => {
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

describe('CR-009 — PUT /api/submissions/:id/compilation/final-mark', () => {
  it('lead_reader sets a Final mark; audit entry compilation.final_set fires', async () => {
    const { sid, lead, leadId } = await seed();

    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'compliant', note: 'consensus call' });

    expect(res.status).toBe(200);
    expect(res.body.finalMark.finalMark).toBe('compliant');

    const stored = await LeadFinalMark.findOne({ submissionId: sid, standardCode: '1', specCode: 'a' });
    expect(stored?.finalMark).toBe('compliant');
    expect(String(stored?.setById)).toBe(leadId);

    const audit = await waitForAudit({ action: 'compilation.final_set', targetId: sid });
    expect(audit).not.toBeNull();
    expect(audit.payload?.finalMark).toBe('compliant');
    expect(audit.payload?.standardCode).toBe('1');
    expect(audit.payload?.specCode).toBe('a');
    expect(audit.payload?.priorFinalMark).toBeNull();
  });

  it('accepts the non_compliant spelling and records priorFinalMark on change', async () => {
    const { sid, lead } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'compliant' });

    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'non_compliant' });
    expect(res.status).toBe(200);
    expect(res.body.finalMark.finalMark).toBe('noncompliant');

    let list: any[] = [];
    for (let i = 0; i < 60 && list.length < 2; i++) {
      list = await AuditLogEntry.find({ action: 'compilation.final_set', targetId: sid }).sort({ timestamp: 1 });
      if (list.length < 2) await new Promise((r) => setTimeout(r, 50));
    }
    expect(list.length).toBeGreaterThanOrEqual(2);
    const latest = list.find((e) => e.payload?.finalMark === 'noncompliant');
    expect(latest?.payload?.priorFinalMark).toBe('compliant');
  });

  it('rejects a numeric 0-3 score (400) — the score scale is gone', async () => {
    const { sid, lead } = await seed();
    const asScore = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', score: 2 });
    expect(asScore.status).toBe(400);
    const asMark = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', mark: 2 });
    expect(asMark.status).toBe(400);
    const bogus = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'partial' });
    expect(bogus.status).toBe(400);
    expect(await LeadFinalMark.countDocuments({ submissionId: sid })).toBe(0);
  });

  it('rejects a PC (403)', async () => {
    const { sid, pc } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${pc}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'compliant' });
    expect(res.status).toBe(403);
  });

  it('rejects a reader (403)', async () => {
    const { sid, reader } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${reader}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'compliant' });
    expect(res.status).toBe(403);
  });
});

describe('CR-009 — DELETE /api/submissions/:id/compilation/final-mark', () => {
  it('clears the Final mark and audit-logs compilation.final_cleared', async () => {
    const { sid, lead } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a', mark: 'noncompliant' });

    const res = await request(app)
      .delete(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${lead}`)
      .send({ standardCode: '1', specCode: 'a' });

    expect(res.status).toBe(200);
    expect(res.body.cleared).toBe(true);
    expect(await LeadFinalMark.findOne({ submissionId: sid, standardCode: '1', specCode: 'a' })).toBeNull();

    const audit = await waitForAudit({ action: 'compilation.final_cleared', targetId: sid });
    expect(audit).not.toBeNull();
    expect(audit.payload?.priorFinalMark).toBe('noncompliant');
  });

  it('rejects a PC (403)', async () => {
    const { sid, pc } = await seed();
    const res = await request(app)
      .delete(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${pc}`)
      .send({ standardCode: '1', specCode: 'a' });
    expect(res.status).toBe(403);
  });
});

describe('Lauri CR — the 0-3 score endpoints are gone', () => {
  it('/scores, /scores/summary, /compilation/final-score and /final-scores all 404', async () => {
    const { sid, lead, admin } = await seed();
    const auth = { Authorization: `Bearer ${admin}` };
    const probes = [
      request(app).get(`/api/submissions/${sid}/scores`).set(auth),
      request(app).get(`/api/submissions/${sid}/scores/summary`).set(auth),
      request(app).put(`/api/submissions/${sid}/scores`).set(auth).send({ standardCode: '1', specCode: 'a', score: 2 }),
      request(app).delete(`/api/submissions/${sid}/scores`).set(auth).send({ standardCode: '1', specCode: 'a' }),
      request(app).put(`/api/submissions/${sid}/compilation/final-score`).set({ Authorization: `Bearer ${lead}` }).send({ standardCode: '1', specCode: 'a', score: 2 }),
      request(app).delete(`/api/submissions/${sid}/compilation/final-score`).set({ Authorization: `Bearer ${lead}` }).send({ standardCode: '1', specCode: 'a' }),
      request(app).get(`/api/submissions/${sid}/final-scores`).set({ Authorization: `Bearer ${lead}` })
    ];
    const results = await Promise.all(probes);
    for (const r of results) {
      expect(r.status).toBe(404);
    }
    expect(await LeadFinalMark.countDocuments({ submissionId: sid })).toBe(0);
  });
});
