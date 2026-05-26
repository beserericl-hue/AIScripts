/**
 * CR-040 Phase 2c — server-side evidenceDoc packaging at Apply time.
 *
 * Each detected evidenceDoc (appendix paper / syllabus) becomes a
 * SupportingEvidence record at Apply time so the coordinator can open
 * it via the existing /api/submissions/:id/evidence/:eid/download
 * endpoint. The aiEvidenceDocs array on the SelfStudyImport is
 * re-stamped with fileId/fileName pointing at the new SupportingEvidence
 * doc.
 *
 * Pins:
 *   1. Apply creates one SupportingEvidence per evidenceDoc.
 *   2. fileId on each evidenceDoc points at the SupportingEvidence._id.
 *   3. Re-apply with the same idempotency key doesn't double-package
 *      (fileId stays the original).
 *   4. SupportingEvidence carries the right institutionId + submissionId
 *      so the CR-017 isolation guard works on download.
 *   5. The generated file is HTML with the doc title + body snippet.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { Institution } from '../../src/models/Institution';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedSubmission(userId: any) {
  const inst = await Institution.create({
    name: `CR-040 Inst ${Date.now().toString(36)}`,
    type: 'university',
    address: { street: '1', city: 'X', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'A', email: 'a@x.test', phone: '555-0000' },
  } as any);
  return Submission.create({
    submissionId: `EDOC-${Date.now().toString(36)}`,
    institutionName: inst.name,
    institutionId: inst._id,
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'in_progress',
  });
}

async function seedImport(submission: any, userId: any, evidenceDocs: any[]) {
  return SelfStudyImport.create({
    submissionId: submission._id,
    originalFilename: 'test.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status: 'completed',
    aiStatus: 'parsed',
    aiJobId: `job-${Date.now()}`,
    aiProgramLevel: 'bachelors',
    aiBuckets: {},
    aiTags: [],
    aiPlaceholderSections: [],
    aiMatrices: [],
    aiEvidenceDocs: evidenceDocs,
  } as any);
}

describe('CR-040 Phase 2c — evidenceDoc packaging at Apply', () => {
  it('creates one SupportingEvidence per evidenceDoc and stamps fileId', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission, user._id, [
      {
        sectionId: 'ed-1',
        docSubKind: 'paper',
        title: 'A Country Report on Refugee Resettlement',
        author: 'Dr. Alice',
        date: '2025-04-12',
        pageCountEstimate: 8,
        imageCount: 0,
        snippet: 'This appendix paper details ...',
        summary: 'Summary of the paper.',
      },
      {
        sectionId: 'ed-2',
        docSubKind: 'syllabus',
        title: 'CHS 105 — Introduction to Human Services',
        courseCode: 'CHS 105',
        pageCountEstimate: 4,
        imageCount: 0,
        snippet: 'Course syllabus body ...',
        summary: 'Course summary.',
      },
    ]);

    const res = await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        evidenceDocs: (imp.aiEvidenceDocs as any[]),
      });
    expect(res.status).toBe(200);

    // Two SupportingEvidence records created.
    const created = await SupportingEvidence.find({ submissionId: submission._id });
    expect(created.length).toBe(2);

    // Both records carry institutionId so CR-017 isolation works.
    for (const rec of created) {
      expect(rec.institutionId.toString()).toBe(submission.institutionId.toString());
      expect(rec.submissionId.toString()).toBe((submission._id as any).toString());
      expect(rec.evidenceType).toBe('document');
      expect(rec.file?.mimeType).toBe('text/html');
    }

    // The aiEvidenceDocs array on the import got re-stamped with fileId.
    const reloaded = await SelfStudyImport.findById(imp._id);
    const docs = (reloaded!.aiEvidenceDocs as any[]) || [];
    expect(docs.length).toBe(2);
    expect(docs[0].fileId).toBeTruthy();
    expect(docs[1].fileId).toBeTruthy();
    // fileId points at one of the SupportingEvidence records.
    const evidenceIds = new Set(created.map((r) => String(r._id)));
    expect(evidenceIds.has(String(docs[0].fileId))).toBe(true);
    expect(evidenceIds.has(String(docs[1].fileId))).toBe(true);
  });

  it('generated file is HTML containing the title + snippet body', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission, user._id, [
      {
        sectionId: 'ed-1',
        docSubKind: 'paper',
        title: 'Unique Title Marker For Test',
        pageCountEstimate: 1,
        imageCount: 0,
        snippet: 'Body content stamped into the HTML wrapper.',
        summary: '',
      },
    ]);
    await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ evidenceDocs: (imp.aiEvidenceDocs as any[]) });

    const evidence = await SupportingEvidence.findOne({ submissionId: submission._id });
    expect(evidence).toBeTruthy();
    // base64 → utf-8 string
    const html = Buffer.from(evidence!.file!.data!, 'base64').toString('utf-8');
    expect(html).toContain('Unique Title Marker For Test');
    expect(html).toContain('Body content stamped into the HTML wrapper.');
    expect(html.toLowerCase()).toContain('<!doctype html>');
  });

  it('re-apply with the same idempotency key does not double-package', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission, user._id, [
      {
        sectionId: 'ed-1',
        docSubKind: 'paper',
        title: 'Idempotent Doc',
        pageCountEstimate: 1,
        imageCount: 0,
        snippet: 'body',
        summary: '',
      },
    ]);

    const key = `idem-${Date.now()}`;
    await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        evidenceDocs: (imp.aiEvidenceDocs as any[]),
        idempotencyKey: key,
      });
    const afterFirst = await SupportingEvidence.countDocuments({
      submissionId: submission._id,
    });
    expect(afterFirst).toBe(1);

    // Re-apply with same key.
    await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        evidenceDocs: (imp.aiEvidenceDocs as any[]),
        idempotencyKey: key,
      });
    const afterSecond = await SupportingEvidence.countDocuments({
      submissionId: submission._id,
    });
    expect(afterSecond).toBe(1); // not doubled
  });

  it('HTML body escapes user-supplied strings (no script injection via title)', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const submission = await seedSubmission(user._id);
    const imp = await seedImport(submission, user._id, [
      {
        sectionId: 'ed-1',
        docSubKind: 'paper',
        title: '<script>alert(1)</script>',
        pageCountEstimate: 1,
        imageCount: 0,
        snippet: 'body & content with <tags>',
        summary: '',
      },
    ]);
    await request(app)
      .post(`/api/imports/${imp._id}/apply-ai`)
      .set('Authorization', `Bearer ${token}`)
      .send({ evidenceDocs: (imp.aiEvidenceDocs as any[]) });
    const evidence = await SupportingEvidence.findOne({ submissionId: submission._id });
    const html = Buffer.from(evidence!.file!.data!, 'base64').toString('utf-8');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&amp;');
  });
});
