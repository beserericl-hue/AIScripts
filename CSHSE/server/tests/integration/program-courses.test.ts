/**
 * ProgramCourses — server integration tests (sub-sprint 1.d).
 *
 * Covers the per-institution course catalog used by the Matrix step's
 * course-column dropdowns:
 *   - list returns catalog scoped to the submission's institution
 *   - create upserts by (institution, courseCode, submissionId)
 *   - duplicate-create updates instead of inserting
 *   - validation rejects missing fields
 *   - auth gating
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { ProgramCourse } from '../../src/models/ProgramCourse';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedSubmission() {
  const institution = await Institution.create({
    name: 'Test Univ',
    type: 'university',
    address: { street: '1 Test St', city: 'Test', state: 'TS', zip: '00000', country: 'US' },
    primaryContact: { name: 'Test Contact', email: 'tc@example.com', title: 'Director', phone: '555-0100' }
  } as any);
  const { user } = await createUser();
  const submission = await Submission.create({
    submissionId: `sub-${Date.now()}`,
    institutionId: institution._id,
    institutionName: 'Test Univ',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: user._id,
    type: 'initial',
    status: 'draft',
    narratives: new Map()
  } as any);
  return { user, submission, institution };
}

describe('ProgramCourses — server routes (sub-sprint 1.d)', () => {
  it('list returns courses scoped to the submission institution', async () => {
    const { user, submission, institution } = await seedSubmission();
    await ProgramCourse.create({
      institutionId: institution._id,
      submissionId: submission._id,
      courseCode: 'FMST 240',
      courseName: 'Family Systems Theory',
      source: 'manual'
    } as any);
    // Course tied to a DIFFERENT institution — must NOT appear.
    const otherInstitution = await Institution.create({
      name: 'Other',
      type: 'university',
      address: { street: '2', city: 'X', state: 'XS', zip: '11111', country: 'US' },
      primaryContact: { name: 'Other', email: 'o@example.com', title: 'X', phone: '555-0200' }
    } as any);
    await ProgramCourse.create({
      institutionId: otherInstitution._id,
      courseCode: 'XYZ 100',
      courseName: 'Other',
      source: 'manual'
    } as any);

    const token = signTokenFor(user as any);
    const res = await request(app)
      .get(`/api/program-courses/${submission._id}/courses`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
    expect(res.body.courses[0].courseCode).toBe('FMST 240');
  });

  it('create upserts a new course', async () => {
    const { user, submission } = await seedSubmission();
    const token = signTokenFor(user as any);

    const res = await request(app)
      .post(`/api/program-courses/${submission._id}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ courseCode: 'fmst 240', courseName: 'Family Systems Theory' });

    expect(res.status).toBe(201);
    expect(res.body.course.courseCode).toBe('FMST 240');
    expect(res.body.course.courseName).toBe('Family Systems Theory');
  });

  it('create with the same code updates the existing row instead of duplicating', async () => {
    const { user, submission } = await seedSubmission();
    const token = signTokenFor(user as any);

    await request(app)
      .post(`/api/program-courses/${submission._id}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ courseCode: 'FMST 240', courseName: 'OLD NAME' });
    const res = await request(app)
      .post(`/api/program-courses/${submission._id}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ courseCode: 'FMST 240', courseName: 'NEW NAME' });

    expect(res.body.course.courseName).toBe('NEW NAME');
    const count = await ProgramCourse.countDocuments({ submissionId: submission._id });
    expect(count).toBe(1);
  });

  it('rejects missing courseCode / courseName with 400', async () => {
    const { user, submission } = await seedSubmission();
    const token = signTokenFor(user as any);

    const noCode = await request(app)
      .post(`/api/program-courses/${submission._id}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ courseName: 'Missing code' });
    expect(noCode.status).toBe(400);

    const noName = await request(app)
      .post(`/api/program-courses/${submission._id}/courses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ courseCode: 'XYZ 100' });
    expect(noName.status).toBe(400);
  });

  it('requires authentication', async () => {
    const { submission } = await seedSubmission();
    const res = await request(app).get(`/api/program-courses/${submission._id}/courses`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when submission has no institutionId', async () => {
    const { user } = await createUser();
    const submission = await Submission.create({
      submissionId: `sub-${Date.now()}`,
      institutionName: 'No-institution submission',
      programName: 'X',
      programLevel: 'bachelors',
      submitterId: user._id,
      type: 'initial',
      status: 'draft',
      narratives: new Map()
    } as any);
    const token = signTokenFor(user as any);

    const res = await request(app)
      .get(`/api/program-courses/${submission._id}/courses`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid submissionId', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const res = await request(app)
      .get('/api/program-courses/not-an-objectid/courses')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
