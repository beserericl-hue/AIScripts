/**
 * CV spec-assignment packaging at Apply time.
 *
 * When the coordinator assigns a Standard/Substandard to a faculty CV in the
 * Review wizard (CV rail dropdowns → updateCvRouting → resolvedStd/Spec), the
 * apply path packages that CV as a SupportingEvidence record routed to the
 * chosen spec — the same reader-facing linkage evidenceDocs already get. This
 * is what makes the assignment actually reach readers (SupportingEvidence
 * .standardCode/.specCode), not just sit on the import record.
 *
 * Pins:
 *   1. An ASSIGNED CV (resolvedStd + resolvedSpec) becomes one
 *      SupportingEvidence with the right standardCode/specCode + a .docx file.
 *   2. An UNASSIGNED CV is NOT packaged (no spec to route it to yet).
 *   3. Re-apply with the same idempotency key doesn't double-package.
 *   4. routing.std/spec is honored as a fallback source of the assignment.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { Institution } from '../../src/models/Institution';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedSubmission(userId: any) {
  const inst = await Institution.create({
    name: `CVAssign Inst ${Date.now().toString(36)}`,
    type: 'university',
    address: { street: '1', city: 'X', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'A', email: 'a@x.test', phone: '555-0000' },
  } as any);
  return Submission.create({
    submissionId: `CVA-${Date.now().toString(36)}`,
    institutionName: inst.name,
    institutionId: inst._id,
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'in_progress',
  });
}

async function seedImport(submission: any, userId: any, cvs: any[]) {
  return SelfStudyImport.create({
    submissionId: submission._id,
    originalFilename: 'test.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: 'completed',
    aiStatus: 'parsed',
    aiJobId: `job-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    aiProgramLevel: 'bachelors',
    aiBuckets: {},
    aiTags: [],
    aiPlaceholderSections: [],
    aiMatrices: [],
    aiCVs: cvs,
  } as any);
}

describe('CV spec-assignment packaging at Apply', () => {
  it('packages an ASSIGNED CV into a routed SupportingEvidence, skips an UNASSIGNED one', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const cvs = [
      {
        sectionId: 'cv-assigned',
        facultyName: 'Dr. Alice Assigned',
        snippet: 'PhD in Human Services, 20 years teaching.',
        confidence: 0.9,
        routing: { source: 'matcher' },
        resolvedStd: '1',
        resolvedSpec: 'a',
      },
      {
        sectionId: 'cv-unassigned',
        facultyName: 'Dr. Bob Unrouted',
        snippet: 'MSW, field placement supervisor.',
        confidence: 0.8,
        routing: { source: 'matcher' },
        // no resolvedStd/resolvedSpec — coordinator hasn't assigned it
      },
    ];
    const imp = await seedImport(submission, user._id, cvs);

    const res = await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cvs });
    expect(res.status).toBe(200);

    const created = await SupportingEvidence.find({ submissionId: submission._id });
    expect(created.length).toBe(1);
    const rec = created[0];
    expect(rec.standardCode).toBe('1');
    expect(rec.specCode).toBe('a');
    expect(rec.evidenceType).toBe('document');
    expect(rec.file?.filename).toMatch(/\.docx$/);
    expect(rec.institutionId.toString()).toBe(submission.institutionId.toString());

    // The assigned CV got a fileId; the unassigned one did not.
    const reloaded = await SelfStudyImport.findById(imp._id);
    const reCvs = (reloaded!.aiCVs as any[]) || [];
    const assigned = reCvs.find((c) => c.sectionId === 'cv-assigned');
    const unassigned = reCvs.find((c) => c.sectionId === 'cv-unassigned');
    expect(assigned.fileId).toBeTruthy();
    expect(String(rec._id)).toBe(String(assigned.fileId));
    expect(unassigned.fileId).toBeFalsy();
  });

  it('honors routing.std/spec as the assignment source when resolved* is absent', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const cvs = [
      {
        sectionId: 'cv-routing',
        facultyName: 'Dr. Carol Routing',
        snippet: 'EdD, program director.',
        confidence: 0.95,
        routing: { source: 'coordinator', std: '2', spec: 'a' },
      },
    ];
    const imp = await seedImport(submission, user._id, cvs);

    await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cvs })
      .expect(200);

    const rec = await SupportingEvidence.findOne({ submissionId: submission._id });
    expect(rec).toBeTruthy();
    expect(rec!.standardCode).toBe('2');
    expect(rec!.specCode).toBe('a');
  });

  it('re-apply with the same idempotency key does not double-package', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const cvs = [
      {
        sectionId: 'cv-idem',
        facultyName: 'Dr. Idempotent',
        snippet: 'body',
        confidence: 0.9,
        routing: { source: 'matcher' },
        resolvedStd: '1',
        resolvedSpec: 'b',
      },
    ];
    const imp = await seedImport(submission, user._id, cvs);
    const key = `idem-cv-${Date.now()}`;

    await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cvs, idempotencyKey: key })
      .expect(200);
    expect(
      await SupportingEvidence.countDocuments({ submissionId: submission._id })
    ).toBe(1);

    // Re-send with the SAME stamped CVs (now carrying fileId) — idempotent.
    const reloaded = await SelfStudyImport.findById(imp._id);
    await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ cvs: reloaded!.aiCVs as any[], idempotencyKey: key })
      .expect(200);
    expect(
      await SupportingEvidence.countDocuments({ submissionId: submission._id })
    ).toBe(1);
  });
});
