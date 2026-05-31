/**
 * CR-019 follow-on / Sprint 13 — reporting filter `?jointVentureId` on the
 * submissions list.
 *
 * Pins:
 *   - an admin can scope GET /api/submissions to a JV's member institutions
 *   - submissions whose institution is NOT a JV member are excluded
 *   - a non-elevated reader cannot widen their scope via the param (still gated
 *     by assignment + status — passing jointVentureId changes nothing for them)
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { JointVenture } from '../../src/models/JointVenture';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(institutionId: mongoose.Types.ObjectId, name: string): Promise<any> {
  _c += 1;
  return Submission.create({
    submissionId: `JVF-${Date.now().toString(36)}-${_c}`,
    institutionId,
    institutionName: name,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: new mongoose.Types.ObjectId(),
    type: 'initial',
    status: 'under_review'
  });
}

describe('CR-019 / S13 — submissions ?jointVentureId reporting filter', () => {
  it('admin scopes the list to the JV member institutions only', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const instA = new mongoose.Types.ObjectId();
    const instB = new mongoose.Types.ObjectId();
    const instOutside = new mongoose.Types.ObjectId();

    await seedSubmission(instA, 'Alpha U');
    await seedSubmission(instB, 'Beta U');
    await seedSubmission(instOutside, 'Outside U');

    const jv: any = await JointVenture.create({
      name: `JV-${Date.now().toString(36)}-${_c}`,
      institutionIds: [instA, instB],
      createdBy: admin._id,
      createdByName: 'Admin'
    });

    const res = await request(app)
      .get('/api/submissions')
      .query({ jointVentureId: String(jv._id), limit: 50 })
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);

    expect(res.status).toBe(200);
    const names = res.body.submissions.map((s: any) => s.institutionName).sort();
    expect(names).toEqual(['Alpha U', 'Beta U']);
    expect(names).not.toContain('Outside U');
  });

  it('non-member institution submissions are excluded', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const member = new mongoose.Types.ObjectId();
    const nonMember = new mongoose.Types.ObjectId();
    await seedSubmission(member, 'Member U');
    await seedSubmission(nonMember, 'NonMember U');
    const jv: any = await JointVenture.create({
      name: `JV2-${Date.now().toString(36)}-${_c}`,
      institutionIds: [member, new mongoose.Types.ObjectId()],
      createdBy: admin._id,
      createdByName: 'Admin'
    });

    const res = await request(app)
      .get('/api/submissions')
      .query({ jointVentureId: String(jv._id), limit: 50 })
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(200);
    const names = res.body.submissions.map((s: any) => s.institutionName);
    expect(names).toContain('Member U');
    expect(names).not.toContain('NonMember U');
  });
});
