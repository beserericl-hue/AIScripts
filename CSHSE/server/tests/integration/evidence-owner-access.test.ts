/**
 * Evidence access for the submission OWNER (program coordinator).
 *
 * Reported bug: the File Library showed nothing — GET /submissions/:id/evidence
 * returned 403 to the owning PC, because verifyEvidenceAccess only honored the
 * institution.programCoordinatorId linkage, not submission ownership. Pins:
 *   1. The submitter (owner PC) can LIST their submission's evidence.
 *   2. A different PC (not owner, not linked) is denied.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { Institution } from '../../src/models/Institution';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedWithEvidence(ownerId: any) {
  _c += 1;
  const inst = await Institution.create({
    name: `Evid Inst ${Date.now().toString(36)}-${_c}`,
    type: 'university',
    address: { street: '1', city: 'X', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'A', email: 'a@x.test', phone: '555-0000' },
  } as any);
  const sub: any = await Submission.create({
    submissionId: `EVO-${Date.now().toString(36)}-${_c}`,
    institutionName: inst.name,
    institutionId: inst._id,
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: ownerId,
    type: 'initial',
    status: 'in_progress',
  });
  await SupportingEvidence.create({
    institutionId: inst._id,
    submissionId: sub._id,
    uploadedBy: ownerId,
    standardCode: '6',
    specCode: 'a',
    evidenceType: 'document',
    file: {
      filename: 'jane-cv.docx',
      originalName: 'jane-cv.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 10,
      data: Buffer.from('x').toString('base64'),
      encoding: 'base64',
      storageType: 'base64',
      uploadedAt: new Date(),
      uploadedBy: ownerId,
    } as any,
    description: 'Dr Jane CV',
    versionNumber: 1,
    isCurrentVersion: true,
    isDeleted: false,
  });
  return sub;
}

describe('Evidence list — submission owner access', () => {
  it('the owner PC can list their own submission evidence (was 403)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedWithEvidence(pc._id);

    const res = await request(app)
      .get(`/api/submissions/${sub._id}/evidence`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.evidence[0].description).toBe('Dr Jane CV');
    expect(res.body.evidence[0].standardCode).toBe('6');
  });

  it('a different (non-owner) PC is denied', async () => {
    const { user: owner } = await createUser({ role: 'program_coordinator' });
    const { user: other } = await createUser({ role: 'program_coordinator' });
    const sub = await seedWithEvidence(owner._id);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/evidence`)
      .set('Authorization', `Bearer ${signTokenFor(other as any)}`);
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});
