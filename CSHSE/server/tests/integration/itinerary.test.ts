/**
 * CR-013 / Sprint 6.2 — site-visit itinerary co-edit + DOCX export.
 *
 * Pins:
 *   - GET 404 when no submission; 200 with siteVisit=null when no visit yet
 *   - PUT requires an existing SiteVisit
 *   - co-edit gate: lead reader assigned to the visit OR submission PC; admin bypass
 *   - validation: agenda array; per-slot time/activity required; checklistItemIds must be valid ObjectIds
 *   - audit `itinerary.updated` fires with priorAgendaLen + newAgendaLen
 *   - DOCX export returns a real .docx with the institution + agenda items
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import JSZip from 'jszip';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SiteVisit } from '../../src/models/SiteVisit';
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

async function seed(opts: { withVisit?: boolean } = {}) {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader', firstName: 'Lead', lastName: 'Linda' });
  const { user: reader } = await createUser({ role: 'reader' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  const { user: otherPc } = await createUser({ role: 'program_coordinator' });

  const sub: any = await Submission.create({
    submissionId: `IT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Itin U',
    institutionId: new mongoose.Types.ObjectId(),
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'review_complete'
  });

  let visit: any = null;
  if (opts.withVisit !== false) {
    visit = await SiteVisit.create({
      submissionId: sub._id,
      institutionId: sub.institutionId,
      institutionName: sub.institutionName,
      scheduledDate: new Date(),
      leadReaderId: lead._id,
      leadReaderName: 'Lead Linda',
      readerIds: [reader._id],
      readers: [{ id: reader._id, name: 'Reader' }],
      status: 'scheduled',
      scheduledBy: admin._id,
      scheduledByName: 'Admin'
    });
  }

  return {
    sid: String(sub._id),
    visitId: visit ? String(visit._id) : null,
    adminTok: signTokenFor(admin as any),
    leadTok: signTokenFor(lead as any),
    readerTok: signTokenFor(reader as any),
    pcTok: signTokenFor(pc as any),
    otherPcTok: signTokenFor(otherPc as any)
  };
}

describe('CR-013 — GET /api/submissions/:id/itinerary', () => {
  it('returns 200 + siteVisit + canCoEdit for the assigned lead reader', async () => {
    const { sid, leadTok } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${leadTok}`);
    expect(res.status).toBe(200);
    expect(res.body.siteVisit).not.toBeNull();
    expect(res.body.canCoEdit).toBe(true);
  });

  it('PC of the submission can read + co-edit', async () => {
    const { sid, pcTok } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(res.status).toBe(200);
    expect(res.body.canCoEdit).toBe(true);
  });

  it('a different PC (not the submitter) gets 403', async () => {
    const { sid, otherPcTok } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${otherPcTok}`);
    expect(res.status).toBe(403);
  });

  it('a reader on the visit can read but not co-edit', async () => {
    const { sid, readerTok } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.canCoEdit).toBe(false);
  });

  it('returns 200 with siteVisit=null when no visit is scheduled', async () => {
    const { sid, adminTok } = await seed({ withVisit: false });
    const res = await request(app)
      .get(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    expect(res.body.siteVisit).toBeNull();
  });

  it('404 on unknown submission', async () => {
    const { adminTok } = await seed();
    const bogus = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/submissions/${bogus}/itinerary`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(404);
  });
});

describe('CR-013 — PUT /api/submissions/:id/itinerary', () => {
  it('lead reader replaces the agenda; audit fires; new + checklistItemIds persist', async () => {
    const { sid, leadTok, visitId } = await seed();
    // Seed a checklist item to link.
    const item: any = await SiteVisitChecklistItem.create({
      submissionId: new mongoose.Types.ObjectId(sid),
      standardCode: '1',
      specCode: 'a',
      inclusionReason: 'partial',
      finalScoreAtInclusion: 1,
      source: 'auto'
    });

    const agenda = [
      { time: '09:00', activity: 'Welcome', location: 'Lobby', attendees: ['Linda', 'PC Pat'] },
      {
        time: '10:00',
        activity: 'Verify partial-compliance items',
        specCodes: ['1.a'],
        checklistItemIds: [String(item._id)],
        notes: 'Walk classroom 3.'
      }
    ];
    const res = await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ agenda });
    expect(res.status).toBe(200);
    expect(res.body.siteVisit.agenda.length).toBe(2);
    expect(res.body.siteVisit.agenda[0].location).toBe('Lobby');
    expect(res.body.siteVisit.agenda[1].checklistItemIds.length).toBe(1);

    const audit = await waitForAudit({
      action: 'itinerary.updated',
      targetId: sid
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.siteVisitId).toBe(visitId);
    expect(audit.payload?.priorAgendaLen).toBe(0);
    expect(audit.payload?.newAgendaLen).toBe(2);
  });

  it('PC of the submission can also replace the agenda', async () => {
    const { sid, pcTok } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ agenda: [{ time: '09:00', activity: 'Welcome' }] });
    expect(res.status).toBe(200);
  });

  it('a reader (not lead, not PC) is rejected (403)', async () => {
    const { sid, readerTok } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${readerTok}`)
      .send({ agenda: [{ time: '09:00', activity: 'X' }] });
    expect(res.status).toBe(403);
  });

  it('400 when agenda is missing or slot is malformed', async () => {
    const { sid, leadTok } = await seed();
    const r1 = await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({});
    expect(r1.status).toBe(400);

    const r2 = await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ agenda: [{ time: '', activity: 'X' }] });
    expect(r2.status).toBe(400);
  });

  it('400 when checklistItemIds contains an invalid id', async () => {
    const { sid, leadTok } = await seed();
    const res = await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({
        agenda: [{ time: '09:00', activity: 'X', checklistItemIds: ['not-a-valid-id'] }]
      });
    expect(res.status).toBe(400);
  });

  it('404 when no SiteVisit exists for the submission', async () => {
    const { sid, leadTok } = await seed({ withVisit: false });
    const res = await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ agenda: [] });
    expect(res.status).toBe(404);
  });
});

describe('CR-013 — DOCX export', () => {
  it('returns a real .docx with institution + agenda items + linked checklist items', async () => {
    const { sid, leadTok } = await seed();
    const item: any = await SiteVisitChecklistItem.create({
      submissionId: new mongoose.Types.ObjectId(sid),
      standardCode: '3',
      specCode: 'c',
      inclusionReason: 'partial',
      finalScoreAtInclusion: 1,
      source: 'auto'
    });
    await request(app)
      .put(`/api/submissions/${sid}/itinerary`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({
        agenda: [
          {
            time: '14:00',
            activity: 'Tour classroom 3',
            location: 'Building A',
            checklistItemIds: [String(item._id)]
          }
        ]
      });

    const res = await request(app)
      .get(`/api/submissions/${sid}/itinerary/export.docx`)
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
    expect(text).toContain('Itin U');
    expect(text).toContain('Site-Visit Itinerary');
    expect(text).toContain('Tour classroom 3');
    expect(text).toContain('Building A');
    expect(text).toContain('Standard 3.c');
  });
});
