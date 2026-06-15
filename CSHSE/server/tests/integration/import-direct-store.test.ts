/**
 * Direct-store upload — coordinators can mark an upload as a CV / Syllabus /
 * Project on the import screen. The server then skips AI section-parsing and
 * files the ORIGINAL document straight into the Supporting File Library under
 * the matching `kind:` marker. Verifies the bypass, the marker, and that an
 * un-marked upload still takes the normal parse path.
 */
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedSubmission(userId: any, institutionId: any) {
  return Submission.create({
    submissionId: `DS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    institutionName: 'Test U',
    institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'draft',
  });
}

describe('import upload — direct-store CV / Syllabus / Project', () => {
  it.each([
    ['cv', 'jane-cv.pdf'],
    ['syllabus', 'hsv101-syllabus.pdf'],
    ['project', 'capstone-project.docx'],
  ])('files a %s straight into the library under kind:%s (no parsing)', async (kind, filename) => {
    const inst = new mongoose.Types.ObjectId();
    const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: inst.toString() });
    const token = signTokenFor(pc as any);
    const sub = await seedSubmission(pc._id, inst);

    const res = await request(app)
      .post('/api/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('submissionId', String(sub._id))
      .field('documentKind', kind)
      .attach('file', Buffer.from('%PDF-1.4 stub bytes'), { filename, contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.directStored).toBe(true);
    expect(res.body.kind).toBe(kind);

    // Stored as supporting evidence under the right marker — with the ORIGINAL file.
    const ev = await SupportingEvidence.findById(res.body.evidenceId).lean();
    expect(ev).toBeTruthy();
    expect(ev!.evidenceType).toBe('document');
    expect(ev!.tags).toContain(`kind:${kind}`);
    expect(String(ev!.submissionId)).toBe(String(sub._id));
    expect((ev as any).file?.originalName).toBe(filename);

    // No standard section/spec assignment, no parsing leakage.
    expect((ev as any).standardCode).toBeFalsy();
    const imp = await SelfStudyImport.findById(res.body.importId).lean();
    expect(imp!.status).toBe('completed');
  });

  it('an un-marked upload still takes the normal parse path (no direct-store)', async () => {
    const inst = new mongoose.Types.ObjectId();
    const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: inst.toString() });
    const token = signTokenFor(pc as any);
    const sub = await seedSubmission(pc._id, inst);

    const res = await request(app)
      .post('/api/imports/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('submissionId', String(sub._id))
      .attach('file', Buffer.from('%PDF-1.4 stub bytes'), { filename: 'self-study.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(202);
    expect(res.body.directStored).toBeUndefined();
    const count = await SupportingEvidence.countDocuments({ submissionId: sub._id });
    expect(count).toBe(0);
  });
});
