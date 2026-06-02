/**
 * CR-053 / Sprint 7.1 — Board decisions + cycle scheduler.
 *
 * Pins:
 *   - admin posts each outcome (accept/table/deny/suspend/revoke) → 200 + persists
 *   - accept stamps effectiveAt + expiresAt (effectiveAt + 7y if absent) + status=compliant
 *   - deny / suspend / revoke set status=non_compliant
 *   - table requires reconsiderAt (400 if missing); status untouched
 *   - non-admin / superuser-false → 403
 *   - bad outcome → 400; missing comments → 400
 *   - audit board.decision_recorded fires with priorOutcome on re-decide
 *   - /board/queue: review_complete + no decision; admin only
 *   - /board/upcoming-reaccreditations: window includes expiring AND tabled
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
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

async function seedSubmission(status = 'review_complete'): Promise<{ sub: any; adminTok: string; pcTok: string; readerTok: string }> {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  const { user: reader } = await createUser({ role: 'reader' });
  const sub: any = await Submission.create({
    submissionId: `BD-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Board U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status
  });
  return {
    sub,
    adminTok: signTokenFor(admin as any),
    pcTok: signTokenFor(pc as any),
    readerTok: signTokenFor(reader as any)
  };
}

describe('CR-053 — POST board decision', () => {
  it('admin posts accept → status=compliant + expiresAt defaults to +7y', async () => {
    const { sub, adminTok } = await seedSubmission();
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ outcome: 'accept', comments: 'All criteria met.' });
    expect(res.status).toBe(200);
    expect(res.body.decision.outcome).toBe('accept');
    expect(res.body.status).toBe('compliant');
    const eff = new Date(res.body.decision.effectiveAt);
    const exp = new Date(res.body.decision.expiresAt);
    const years = (exp.getTime() - eff.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    expect(years).toBeGreaterThan(6.9);
    expect(years).toBeLessThan(7.1);

    const audit = await waitForAudit({ action: 'board.decision_recorded', targetId: String(sub._id) });
    expect(audit).not.toBeNull();
    expect(audit.payload?.outcome).toBe('accept');
    expect(audit.payload?.priorOutcome).toBeNull();
    expect(audit.payload?.statusAfter).toBe('compliant');
  });

  it('deny / suspend / revoke → status=non_compliant', async () => {
    for (const outcome of ['deny', 'suspend', 'revoke'] as const) {
      const { sub, adminTok } = await seedSubmission();
      const res = await request(app)
        .post(`/api/submissions/${sub._id}/decision`)
        .set('Authorization', `Bearer ${adminTok}`)
        .send({ outcome, comments: `Decision: ${outcome}.` });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('non_compliant');
    }
  });

  it('table requires reconsiderAt; 400 if missing', async () => {
    const { sub, adminTok } = await seedSubmission();
    const missing = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ outcome: 'table', comments: 'Tabled for clarification.' });
    expect(missing.status).toBe(400);

    const future = new Date();
    future.setDate(future.getDate() + 60);
    const ok = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ outcome: 'table', reconsiderAt: future.toISOString(), comments: 'Tabled.' });
    expect(ok.status).toBe(200);
    expect(ok.body.decision.outcome).toBe('table');
    // table leaves status untouched
    expect(ok.body.status).toBe('review_complete');
  });

  it('non-admin → 403', async () => {
    const { sub, pcTok, readerTok } = await seedSubmission();
    const pc = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ outcome: 'accept', comments: 'x' });
    expect(pc.status).toBe(403);
    const reader = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${readerTok}`)
      .send({ outcome: 'accept', comments: 'x' });
    expect(reader.status).toBe(403);
  });

  it('bad outcome → 400; missing comments → 400', async () => {
    const { sub, adminTok } = await seedSubmission();
    const badOutcome = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ outcome: 'maybe', comments: 'x' });
    expect(badOutcome.status).toBe(400);
    const missingComments = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ outcome: 'accept' });
    expect(missingComments.status).toBe(400);
  });

  it('re-decide carries priorOutcome in the audit payload', async () => {
    const { sub, adminTok } = await seedSubmission();
    await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ outcome: 'accept', comments: 'first' });
    await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ outcome: 'deny', comments: 'second' });
    // The decision controller records the audit row via `void
    // recordAuditEvent(...)` (fire-and-forget — it intentionally doesn't
    // block the HTTP response on audit logging). So the second (deny) row
    // can still be flushing when the response returns; poll for it rather
    // than reading once. Without this the read races the write under
    // full-suite load and `latest[0]` is occasionally undefined.
    let latestDeny: any = null;
    for (let i = 0; i < 60; i++) {
      const rows = await AuditLogEntry.find({
        action: 'board.decision_recorded',
        targetId: String(sub._id)
      })
        .sort({ timestamp: -1 })
        .limit(1);
      if (rows[0]?.payload?.outcome === 'deny') {
        latestDeny = rows[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(latestDeny, 'deny audit row never appeared').toBeTruthy();
    expect(latestDeny.payload?.outcome).toBe('deny');
    expect(latestDeny.payload?.priorOutcome).toBe('accept');
  });
});

describe('CR-053 — /board/queue + /board/upcoming-reaccreditations', () => {
  it('queue returns review_complete + no decision; admin only', async () => {
    const { sub: a, adminTok, pcTok } = await seedSubmission('review_complete');
    await seedSubmission('under_review'); // not in queue
    const decided = await Submission.create({
      submissionId: `BD-decided-${Date.now().toString(36)}`,
      institutionName: 'Decided U',
      programName: 'HS',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
      status: 'review_complete',
      decision: {
        outcome: 'accept',
        decidedBy: new mongoose.Types.ObjectId(),
        decidedAt: new Date(),
        comments: 'x'
      }
    });
    expect(decided).toBeTruthy();

    const pcRes = await request(app)
      .get('/api/board/queue')
      .set('Authorization', `Bearer ${pcTok}`);
    expect(pcRes.status).toBe(403);

    const res = await request(app)
      .get('/api/board/queue')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    const ids = res.body.submissions.map((s: any) => String(s._id));
    expect(ids).toContain(String(a._id));
    expect(ids).not.toContain(String(decided._id));
  });

  it('upcoming-reaccreditations lists expiring + tabled within the window', async () => {
    const { adminTok } = await seedSubmission();

    const expiringSoon = new Date();
    expiringSoon.setDate(expiringSoon.getDate() + 30);
    const expiringLater = new Date();
    expiringLater.setDate(expiringLater.getDate() + 700);
    const reconsiderSoon = new Date();
    reconsiderSoon.setDate(reconsiderSoon.getDate() + 60);

    await Submission.create({
      submissionId: `BD-exp-${Date.now().toString(36)}`,
      institutionName: 'Expires Soon',
      programName: 'HS', programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(), type: 'initial', status: 'compliant',
      decision: { outcome: 'accept', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'x', effectiveAt: new Date(), expiresAt: expiringSoon }
    });
    await Submission.create({
      submissionId: `BD-far-${Date.now().toString(36)}`,
      institutionName: 'Expires Far',
      programName: 'HS', programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(), type: 'initial', status: 'compliant',
      decision: { outcome: 'accept', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'x', effectiveAt: new Date(), expiresAt: expiringLater }
    });
    await Submission.create({
      submissionId: `BD-tabled-${Date.now().toString(36)}`,
      institutionName: 'Tabled',
      programName: 'HS', programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(), type: 'initial', status: 'review_complete',
      decision: { outcome: 'table', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'x', reconsiderAt: reconsiderSoon }
    });

    const res = await request(app)
      .get('/api/board/upcoming-reaccreditations?withinDays=180')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    const expNames = res.body.expiring.map((s: any) => s.institutionName);
    const tabledNames = res.body.tabled.map((s: any) => s.institutionName);
    expect(expNames).toContain('Expires Soon');
    expect(expNames).not.toContain('Expires Far');
    expect(tabledNames).toContain('Tabled');
  });
});
