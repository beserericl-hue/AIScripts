/**
 * CR-012 / Sprint 6.1 — site-visit partial-compliance checklist.
 *
 * Pins:
 *  - Auto-population on setFinalScore:
 *      * score 0 → row with inclusionReason='non_compliant'
 *      * score 1 → row with inclusionReason='partial'
 *      * score 2/3 → no row (and an existing auto row is removed unless verified)
 *  - Verified rows survive a score-up (we never silently lose a visit-team note).
 *  - clearFinalScore removes auto rows (unverified) but not verified ones.
 *  - listChecklist groups counts; PC 403; reader can read but cannot write;
 *    lead/admin can write (manual add + delete).
 *  - verifyChecklistItem writes a checklist.item_verified audit entry.
 *  - DOCX export returns a real .docx buffer (jszip-validated).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import JSZip from 'jszip';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SiteVisitChecklistItem } from '../../src/models/SiteVisitChecklistItem';
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

async function waitForChecklist(filter: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await SiteVisitChecklistItem.findOne(filter);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function seed() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const { user: reader } = await createUser({ role: 'reader' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  const sub: any = await Submission.create({
    submissionId: `CHK-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Checklist U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'review_complete'
  });

  return {
    sid: String(sub._id),
    adminTok: signTokenFor(admin as any),
    leadTok: signTokenFor(lead as any),
    readerTok: signTokenFor(reader as any),
    pcTok: signTokenFor(pc as any)
  };
}

describe('CR-012 — auto-population from setFinalScore', () => {
  it('score 0 → checklist row with non_compliant; score 1 → partial', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '1', specCode: 'a', score: 0 });

    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '1', specCode: 'b', score: 1 });

    const itemA = await waitForChecklist({ submissionId: sid, standardCode: '1', specCode: 'a' });
    expect(itemA?.inclusionReason).toBe('non_compliant');
    expect(itemA?.finalScoreAtInclusion).toBe(0);
    expect(itemA?.source).toBe('auto');

    const itemB = await waitForChecklist({ submissionId: sid, standardCode: '1', specCode: 'b' });
    expect(itemB?.inclusionReason).toBe('partial');
    expect(itemB?.finalScoreAtInclusion).toBe(1);
  });

  it('score 2 → no checklist row; score 3 → no row', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '2', specCode: 'a', score: 2 });
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '2', specCode: 'b', score: 3 });

    // brief settle for the detached upsert (none should happen)
    await new Promise((r) => setTimeout(r, 250));

    const all = await SiteVisitChecklistItem.find({ submissionId: sid });
    expect(all.length).toBe(0);
  });

  it('score-up from 1 → 2 removes the auto row (when unverified)', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '3', specCode: 'a', score: 1 });
    await waitForChecklist({ submissionId: sid, standardCode: '3', specCode: 'a' });

    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '3', specCode: 'a', score: 2 });

    // The detached delete runs after the response. Poll for absence.
    let tries = 0;
    let item: any = null;
    while (tries < 60) {
      item = await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '3', specCode: 'a' });
      if (!item) break;
      await new Promise((r) => setTimeout(r, 50));
      tries++;
    }
    expect(item).toBeNull();
  });

  it('score-up after verify PRESERVES the row (visit-team note is sticky)', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '4', specCode: 'a', score: 1 });
    const row = await waitForChecklist({ submissionId: sid, standardCode: '4', specCode: 'a' });

    // Verify the row.
    await request(app)
      .patch(`/api/submissions/${sid}/checklist/${row._id}/verify`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ verified: true, note: 'Confirmed on visit, classroom 3.' });

    // Bump score to 2.
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '4', specCode: 'a', score: 2 });

    // Settle.
    await new Promise((r) => setTimeout(r, 250));
    const stillThere = await SiteVisitChecklistItem.findOne({
      submissionId: sid,
      standardCode: '4',
      specCode: 'a'
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.verified).toBe(true);
    expect(stillThere?.verificationNote).toMatch(/classroom 3/);
  });

  it('clearFinalScore removes the auto row (unverified)', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '5', specCode: 'a', score: 0 });
    await waitForChecklist({ submissionId: sid, standardCode: '5', specCode: 'a' });

    await request(app)
      .delete(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '5', specCode: 'a' });

    let tries = 0;
    let item: any = null;
    while (tries < 60) {
      item = await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '5', specCode: 'a' });
      if (!item) break;
      await new Promise((r) => setTimeout(r, 50));
      tries++;
    }
    expect(item).toBeNull();
  });
});

describe('CR-012 — list / role gates / verify audit', () => {
  it('PC is 403 everywhere', async () => {
    const { sid, pcTok } = await seed();
    const list = await request(app)
      .get(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(list.status).toBe(403);

    const exp = await request(app)
      .get(`/api/submissions/${sid}/checklist/export.docx`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(exp.status).toBe(403);
  });

  it('reader can read but cannot manual-add or delete', async () => {
    const { sid, readerTok, leadTok } = await seed();
    const list = await request(app)
      .get(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(list.status).toBe(200);

    const add = await request(app)
      .post(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${readerTok}`)
      .send({ standardCode: '7', specCode: 'a' });
    expect(add.status).toBe(403);

    // Lead adds one to delete.
    const leadAdd = await request(app)
      .post(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '7', specCode: 'a' });
    expect(leadAdd.status).toBe(201);
    const itemId = leadAdd.body.item._id;

    const del = await request(app)
      .delete(`/api/submissions/${sid}/checklist/${itemId}`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(del.status).toBe(403);
  });

  it('verifyChecklistItem fires audit checklist.item_verified', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '8', specCode: 'a', score: 1 });
    const row = await waitForChecklist({ submissionId: sid, standardCode: '8', specCode: 'a' });

    const res = await request(app)
      .patch(`/api/submissions/${sid}/checklist/${row._id}/verify`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ verified: true, note: 'In-person evidence confirmed.' });
    expect(res.status).toBe(200);
    expect(res.body.item.verified).toBe(true);
    expect(res.body.item.verifiedByName).toBeTruthy();

    const audit = await waitForAudit({
      action: 'checklist.item_verified',
      targetId: sid,
      'payload.itemId': String(row._id)
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.inclusionReason).toBe('partial');
    expect(audit.payload?.priorVerified).toBe(false);
    expect(audit.reason).toMatch(/In-person evidence/);
  });

  it('un-verify writes checklist.item_unverified and clears verifier fields', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '9', specCode: 'a', score: 1 });
    const row = await waitForChecklist({ submissionId: sid, standardCode: '9', specCode: 'a' });
    await request(app)
      .patch(`/api/submissions/${sid}/checklist/${row._id}/verify`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ verified: true });

    const un = await request(app)
      .patch(`/api/submissions/${sid}/checklist/${row._id}/verify`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ verified: false });
    expect(un.status).toBe(200);
    expect(un.body.item.verified).toBe(false);
    expect(un.body.item.verifiedBy).toBeUndefined();
  });

  it('counts are correct in listChecklist', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '10', specCode: 'a', score: 0 });
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '10', specCode: 'b', score: 1 });
    await waitForChecklist({ submissionId: sid, standardCode: '10', specCode: 'b' });

    const res = await request(app)
      .get(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${leadTok}`);
    expect(res.status).toBe(200);
    expect(res.body.counts.total).toBe(2);
    expect(res.body.counts.partial).toBe(1);
    expect(res.body.counts.non_compliant).toBe(1);
    expect(res.body.counts.verified).toBe(0);
  });
});

describe('CR-012 — DOCX export', () => {
  it('returns a real .docx with the institution + per-row inclusion reason text', async () => {
    const { sid, leadTok } = await seed();
    await request(app)
      .put(`/api/submissions/${sid}/compilation/final-score`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '11', specCode: 'a', score: 1 });
    await waitForChecklist({ submissionId: sid, standardCode: '11', specCode: 'a' });

    const res = await request(app)
      .get(`/api/submissions/${sid}/checklist/export.docx`)
      .set('Authorization', `Bearer ${leadTok}`)
      .buffer(true)
      .parse((response, callback) => {
        const data: Buffer[] = [];
        response.on('data', (c: Buffer) => data.push(c));
        response.on('end', () => callback(null, Buffer.concat(data)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/wordprocessingml/);
    expect(res.body.slice(0, 2).toString()).toBe('PK');

    const zip = await JSZip.loadAsync(res.body as Buffer);
    const text = await zip.file('word/document.xml')!.async('string');
    expect(text).toContain('Checklist U');
    expect(text).toContain('Site-Visit Checklist');
    expect(text).toContain('Partial');
  });
});
