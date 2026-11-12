/**
 * Site visits: a scheduled visit belongs to the program's institution (so the
 * coordinator's list shows it), and a visit happening today still counts as
 * upcoming (dates are stored as UTC midnight of the visit day).
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SiteVisit } from '../../src/models/SiteVisit';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';
import { upcomingCutoff } from '../../src/controllers/siteVisitController';

async function seed() {
  const instId = new mongoose.Types.ObjectId();
  const otherInst = new mongoose.Types.ObjectId();
  const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: instId as any });
  const { user: otherPc } = await createUser({ role: 'program_coordinator', institutionId: otherInst as any });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const sub: any = await Submission.create({
    submissionId: `SV-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionId: instId,
    institutionName: 'Visit U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'review_complete',
  });
  await assignToSubmission(sub, lead, 'lead_reader');
  return { instId, pc, otherPc, lead, sub };
}

const utcMidnight = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

describe('site visits — institution + upcoming window', () => {
  it('POSITIVE: a visit the lead schedules is stored on the program institution and the coordinator sees it', async () => {
    const s = await seed();
    const res = await request(app)
      .post('/api/site-visits')
      .set('Authorization', `Bearer ${signTokenFor(s.lead as any)}`)
      .send({ submissionId: String(s.sub._id), scheduledDate: '2027-03-10', scheduledTime: '09:00', duration: 1 });
    expect(res.status).toBeLessThan(300);
    const saved: any = await SiteVisit.findOne({ submissionId: s.sub._id }).lean();
    expect(String(saved.institutionId)).toBe(String(s.instId));
    expect(String(saved.institutionId)).not.toBe(String(s.pc._id));

    const list = await request(app).get('/api/site-visits?upcoming=true').set('Authorization', `Bearer ${signTokenFor(s.pc as any)}`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain(String(saved._id));
  });

  it('NEGATIVE: another institution’s coordinator does not see it', async () => {
    const s = await seed();
    await request(app)
      .post('/api/site-visits')
      .set('Authorization', `Bearer ${signTokenFor(s.lead as any)}`)
      .send({ submissionId: String(s.sub._id), scheduledDate: '2027-03-10', scheduledTime: '09:00', duration: 1 });
    const saved: any = await SiteVisit.findOne({ submissionId: s.sub._id }).lean();
    const list = await request(app).get('/api/site-visits?upcoming=true').set('Authorization', `Bearer ${signTokenFor(s.otherPc as any)}`);
    expect(JSON.stringify(list.body)).not.toContain(String(saved._id));
  });

  it('a visit dated today (UTC midnight) is upcoming in every US time zone; one two days ago is not', () => {
    // 23:00 Eastern on Nov 12 = 04:00 UTC Nov 13; the visit is stored as Nov 12 00:00 UTC.
    const lateEvening = new Date('2026-11-13T04:00:00Z');
    expect(utcMidnight(new Date('2026-11-12T12:00:00Z')).getTime()).toBeGreaterThanOrEqual(upcomingCutoff(lateEvening).getTime());
    // 09:00 Hawaii (UTC-10) on Nov 12 = 19:00 UTC.
    const hawaiiMorning = new Date('2026-11-12T19:00:00Z');
    expect(new Date('2026-11-12T00:00:00Z').getTime()).toBeGreaterThanOrEqual(upcomingCutoff(hawaiiMorning).getTime());
    // two days ago is out
    expect(new Date('2026-11-10T00:00:00Z').getTime()).toBeLessThan(upcomingCutoff(lateEvening).getTime());
  });
});
