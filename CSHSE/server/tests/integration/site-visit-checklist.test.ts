/**
 * CR-012 / Sprint 6.1 — site-visit checklist.
 *
 * Lauri CR (Nov 2026): the lead reader's Final is a Compliant / Non-compliant
 * MARK (the 0-3 score is gone). Pins:
 *  - Auto-population on PUT /compilation/final-mark:
 *      * Non-compliant → row with inclusionReason='non_compliant'
 *      * Compliant     → no row (and an existing auto row is removed unless verified)
 *  - Verified rows survive Non-compliant → Compliant (visit-team note is sticky).
 *  - clearFinalMark removes auto rows (unverified) but not verified ones.
 *  - Legacy 'partial' rows (old 0-3 era) still load and count.
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

  // Reviewer access requires an ACTIVE Assignment (the cross-tenant guard).
  await assignToSubmission(sub, lead, 'lead_reader');
  await assignToSubmission(sub, reader, 'reader');

  return {
    sid: String(sub._id),
    adminTok: signTokenFor(admin as any),
    leadTok: signTokenFor(lead as any),
    readerTok: signTokenFor(reader as any),
    pcTok: signTokenFor(pc as any)
  };
}

function putMark(sid: string, tok: string, standardCode: string, specCode: string, mark: string) {
  return request(app)
    .put(`/api/submissions/${sid}/compilation/final-mark`)
    .set('Authorization', `Bearer ${tok}`)
    .send({ standardCode, specCode, mark });
}

describe('CR-012 — auto-population from the lead Final mark', () => {
  it('Non-compliant → checklist row with inclusionReason non_compliant (available as soon as the PUT returns)', async () => {
    const { sid, leadTok } = await seed();
    const res = await putMark(sid, leadTok, '1', 'a', 'noncompliant');
    expect(res.status).toBe(200);

    const item = await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '1', specCode: 'a' }).lean();
    expect(item?.inclusionReason).toBe('non_compliant');
    expect(item?.finalMarkAtInclusion).toBe('noncompliant');
    expect(item?.source).toBe('auto');
    expect(item?.verified).toBe(false);
    // The retired numeric field is never written.
    expect((item as any)?.finalScoreAtInclusion).toBeUndefined();
  });

  it('Compliant → no checklist row (negative)', async () => {
    const { sid, leadTok } = await seed();
    expect((await putMark(sid, leadTok, '2', 'a', 'compliant')).status).toBe(200);
    expect((await putMark(sid, leadTok, '2', 'b', 'compliant')).status).toBe(200);
    const all = await SiteVisitChecklistItem.find({ submissionId: sid });
    expect(all.length).toBe(0);
  });

  it('Non-compliant → Compliant removes the auto row (when unverified)', async () => {
    const { sid, leadTok } = await seed();
    await putMark(sid, leadTok, '3', 'a', 'noncompliant');
    expect(await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '3', specCode: 'a' })).not.toBeNull();

    await putMark(sid, leadTok, '3', 'a', 'compliant');
    expect(await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '3', specCode: 'a' })).toBeNull();
  });

  it('Non-compliant → Compliant after verify PRESERVES the row (visit-team note is sticky)', async () => {
    const { sid, leadTok } = await seed();
    await putMark(sid, leadTok, '4', 'a', 'noncompliant');
    const row = await waitForChecklist({ submissionId: sid, standardCode: '4', specCode: 'a' });

    await request(app)
      .patch(`/api/submissions/${sid}/checklist/${row._id}/verify`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ verified: true, note: 'Confirmed on visit, classroom 3.' });

    await putMark(sid, leadTok, '4', 'a', 'compliant');

    const stillThere = await SiteVisitChecklistItem.findOne({
      submissionId: sid,
      standardCode: '4',
      specCode: 'a'
    });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.verified).toBe(true);
    expect(stillThere?.verificationNote).toMatch(/classroom 3/);
  });

  it('a manual row is not converted to auto (and not removed) by a Final mark', async () => {
    const { sid, leadTok } = await seed();
    const add = await request(app)
      .post(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '6', specCode: 'a', inclusionReason: 'follow_up' });
    expect(add.status).toBe(201);

    await putMark(sid, leadTok, '6', 'a', 'noncompliant');
    let item = await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '6', specCode: 'a' }).lean();
    expect(item?.source).toBe('manual');
    expect(item?.inclusionReason).toBe('follow_up');

    await putMark(sid, leadTok, '6', 'a', 'compliant');
    item = await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '6', specCode: 'a' }).lean();
    expect(item).not.toBeNull();
  });

  it('clearFinalMark removes the auto row (unverified)', async () => {
    const { sid, leadTok } = await seed();
    await putMark(sid, leadTok, '5', 'a', 'noncompliant');
    await waitForChecklist({ submissionId: sid, standardCode: '5', specCode: 'a' });

    const del = await request(app)
      .delete(`/api/submissions/${sid}/compilation/final-mark`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ standardCode: '5', specCode: 'a' });
    expect(del.status).toBe(200);
    expect(await SiteVisitChecklistItem.findOne({ submissionId: sid, standardCode: '5', specCode: 'a' })).toBeNull();
  });

  it('a legacy 0-3 era row (partial + numeric finalScoreAtInclusion) still lists and is upgraded on Non-compliant', async () => {
    const { sid, leadTok } = await seed();
    await SiteVisitChecklistItem.collection.insertOne({
      submissionId: new mongoose.Types.ObjectId(sid),
      standardCode: '12',
      specCode: 'a',
      inclusionReason: 'partial',
      finalScoreAtInclusion: 1,
      verified: false,
      source: 'auto',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any);

    const list = await request(app)
      .get(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${leadTok}`);
    expect(list.status).toBe(200);
    expect(list.body.counts.partial).toBe(1);

    await putMark(sid, leadTok, '12', 'a', 'noncompliant');
    const raw: any = await SiteVisitChecklistItem.collection.findOne({ submissionId: new mongoose.Types.ObjectId(sid), standardCode: '12' });
    expect(raw.inclusionReason).toBe('non_compliant');
    expect(raw.finalMarkAtInclusion).toBe('noncompliant');
    expect(raw.finalScoreAtInclusion).toBeUndefined();
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
    await putMark(sid, leadTok, '8', 'a', 'noncompliant');
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
    expect(audit.payload?.inclusionReason).toBe('non_compliant');
    expect(audit.payload?.priorVerified).toBe(false);
    expect(audit.reason).toMatch(/In-person evidence/);
  });

  it('un-verify writes checklist.item_unverified and clears verifier fields', async () => {
    const { sid, leadTok } = await seed();
    await putMark(sid, leadTok, '9', 'a', 'noncompliant');
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
    await putMark(sid, leadTok, '10', 'a', 'noncompliant');
    await putMark(sid, leadTok, '10', 'b', 'noncompliant');
    await waitForChecklist({ submissionId: sid, standardCode: '10', specCode: 'b' });

    const res = await request(app)
      .get(`/api/submissions/${sid}/checklist`)
      .set('Authorization', `Bearer ${leadTok}`);
    expect(res.status).toBe(200);
    expect(res.body.counts.total).toBe(2);
    expect(res.body.counts.partial).toBe(0);
    expect(res.body.counts.non_compliant).toBe(2);
    expect(res.body.counts.verified).toBe(0);
  });
});

describe('CR-012 — DOCX export', () => {
  it('returns a real .docx with the institution + per-row inclusion reason text', async () => {
    const { sid, leadTok } = await seed();
    await putMark(sid, leadTok, '11', 'a', 'noncompliant');
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
    expect(text).toContain('Non-compliant');
    // The retired 0-3 vocabulary is gone from the export.
    expect(text).not.toMatch(/final = \d/);
    expect(text).not.toContain('Partial');
  });
});
