/**
 * SECURITY regression — cross-tenant isolation on the endpoints that shipped
 * WITHOUT the submissionAccessGuard. A July-2026 audit centralized the guard,
 * but four handlers still gated on the raw global role only, so a lead_reader
 * (or reader) from ANOTHER institution could act on a submission they don't
 * oversee. The worst was `assignReaders`: an unrelated lead could self-assign,
 * creating an active Assignment for themselves — which every other guarded
 * endpoint then treats as full access, defeating the whole tenant model.
 *
 * These tests lock the holes shut: an unrelated reviewer is 403, while the
 * legitimate actors (admin, the institution's designated lead, an already-
 * assigned lead) still work.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { ChangeRequest } from '../../src/models/ChangeRequest';
import { Assignment } from '../../src/models/Assignment';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';

async function makeInstitution(name: string) {
  return Institution.create({
    name,
    type: 'university',
    address: { street: '1 St', city: 'C', state: 'ST', zip: '00000', country: 'US' },
    primaryContact: { name: 'C', email: `${name}@example.com`, title: 'Dir', phone: '555-0100' },
  } as any);
}

async function makeSubmission(institution: any, submitter: any, status = 'draft') {
  return Submission.create({
    submissionId: `sub-${Math.random().toString(36).slice(2)}`,
    institutionId: institution._id,
    institutionName: institution.name,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: submitter._id,
    type: 'initial',
    status,
    narratives: new Map(),
  } as any);
}

describe('SECURITY — cross-tenant guards on assignment / change-request / DM endpoints', () => {
  let institutionA: any, pcA: any, submissionA: any, readerToAssign: any;

  beforeEach(async () => {
    institutionA = await makeInstitution('Inst A');
    ({ user: pcA } = await createUser({ role: 'program_coordinator', institutionId: institutionA._id }));
    submissionA = await makeSubmission(institutionA, pcA, 'draft');
    ({ user: readerToAssign } = await createUser({ role: 'reader' }));
  });

  describe('POST /api/reviews/submissions/:id/assign (assignReaders)', () => {
    it('BLOCKS a lead_reader from ANOTHER institution (no assignment) — was a full-access self-assign', async () => {
      const { user: foreignLead } = await createUser({ role: 'lead_reader', institutionId: (await makeInstitution('Inst B'))._id });
      const res = await request(app)
        .post(`/api/reviews/submissions/${submissionA._id}/assign`)
        .set('Authorization', `Bearer ${signTokenFor(foreignLead as any)}`)
        .send({ readerIds: [String(foreignLead._id)], reason: 'x' });
      expect(res.status).toBe(403);
      // The breach was that this created an active Assignment for the attacker.
      const leaked = await Assignment.exists({ submissionId: submissionA._id, userId: foreignLead._id });
      expect(leaked).toBeFalsy();
    });

    it('ALLOWS the institution’s designated lead reader', async () => {
      const { user: leadA } = await createUser({ role: 'lead_reader' });
      await Institution.updateOne({ _id: institutionA._id }, { $set: { assignedLeadReaderId: leadA._id } });
      const res = await request(app)
        .post(`/api/reviews/submissions/${submissionA._id}/assign`)
        .set('Authorization', `Bearer ${signTokenFor(leadA as any)}`)
        .send({ readerIds: [String(readerToAssign._id)] });
      expect(res.status).not.toBe(403);
    });

    it('ALLOWS a lead_reader already actively assigned to the submission', async () => {
      const { user: assignedLead } = await createUser({ role: 'lead_reader' });
      await assignToSubmission(submissionA, assignedLead, 'lead_reader');
      const res = await request(app)
        .post(`/api/reviews/submissions/${submissionA._id}/assign`)
        .set('Authorization', `Bearer ${signTokenFor(assignedLead as any)}`)
        .send({ readerIds: [String(readerToAssign._id)] });
      expect(res.status).not.toBe(403);
    });

    it('ALLOWS a global admin', async () => {
      const { user: admin } = await createUser({ role: 'admin' });
      const res = await request(app)
        .post(`/api/reviews/submissions/${submissionA._id}/assign`)
        .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
        .send({ readerIds: [String(readerToAssign._id)] });
      expect(res.status).not.toBe(403);
    });
  });

  describe('change-request approve/deny + request-assignment-change', () => {
    async function makeChangeRequest() {
      return ChangeRequest.create({
        role: 'lead_reader',
        userId: pcA._id,
        submissionId: submissionA._id,
        institutionId: institutionA._id,
        institutionName: institutionA.name,
        type: 'deadline',
        currentValue: '2026-01-01',
        requestedValue: '2026-02-01',
        reason: 'more time',
        requestedBy: pcA._id,
        requestedByName: 'PC A',
        requestedByRole: 'program_coordinator',
        status: 'pending',
      } as any);
    }

    it('BLOCKS an unrelated lead_reader from approving another institution’s change request', async () => {
      const cr = await makeChangeRequest();
      const { user: foreignLead } = await createUser({ role: 'lead_reader' });
      const res = await request(app)
        .post(`/api/change-requests/${cr._id}/approve`)
        .set('Authorization', `Bearer ${signTokenFor(foreignLead as any)}`)
        .send({ comments: 'ok' });
      expect(res.status).toBe(403);
    });

    it('BLOCKS an unrelated lead_reader from denying another institution’s change request', async () => {
      const cr = await makeChangeRequest();
      const { user: foreignLead } = await createUser({ role: 'lead_reader' });
      const res = await request(app)
        .post(`/api/change-requests/${cr._id}/deny`)
        .set('Authorization', `Bearer ${signTokenFor(foreignLead as any)}`)
        .send({ reason: 'no' });
      expect(res.status).toBe(403);
    });

    it('BLOCKS an unrelated lead_reader from requesting an assignment change', async () => {
      const { user: foreignLead } = await createUser({ role: 'lead_reader' });
      const res = await request(app)
        .post(`/api/reviews/submissions/${submissionA._id}/request-assignment-change`)
        .set('Authorization', `Bearer ${signTokenFor(foreignLead as any)}`)
        .send({ reason: 'change it' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/change-requests (list scope)', () => {
    async function crFor(institution: any, submission: any) {
      return ChangeRequest.create({
        role: 'lead_reader', userId: pcA._id,
        submissionId: submission._id, institutionId: institution._id, institutionName: institution.name,
        type: 'deadline', currentValue: 'a', requestedValue: 'b', reason: 'r',
        requestedBy: pcA._id, requestedByName: 'PC', requestedByRole: 'program_coordinator', status: 'pending',
      } as any);
    }

    it('a lead_reader sees only change requests for submissions they oversee — not another institution’s', async () => {
      const crA = await crFor(institutionA, submissionA);
      // A totally separate institution B with its own submission + change request.
      const institutionB = await makeInstitution('Inst B2');
      const { user: pcB } = await createUser({ role: 'program_coordinator', institutionId: institutionB._id });
      const submissionB = await makeSubmission(institutionB, pcB, 'draft');
      await ChangeRequest.create({
        role: 'lead_reader', userId: pcB._id,
        submissionId: submissionB._id, institutionId: institutionB._id, institutionName: institutionB.name,
        type: 'deadline', currentValue: 'a', requestedValue: 'b', reason: 'r',
        requestedBy: pcB._id, requestedByName: 'PC B', requestedByRole: 'program_coordinator', status: 'pending',
      } as any);

      // A lead assigned to A only.
      const { user: leadA } = await createUser({ role: 'lead_reader' });
      await assignToSubmission(submissionA, leadA, 'lead_reader');

      const res = await request(app)
        .get('/api/change-requests')
        .set('Authorization', `Bearer ${signTokenFor(leadA as any)}`);
      expect(res.status).toBe(200);
      const ids = (res.body.changeRequests || []).map((c: any) => String(c._id));
      expect(ids).toContain(String(crA._id));
      // Must NOT see institution B's change request.
      expect(res.body.changeRequests.every((c: any) => String(c.institutionName) !== institutionB.name)).toBe(true);
    });

    it('an admin still sees all institutions’ change requests', async () => {
      await crFor(institutionA, submissionA);
      const { user: admin } = await createUser({ role: 'admin' });
      const res = await request(app)
        .get('/api/change-requests')
        .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
      expect(res.status).toBe(200);
      expect((res.body.changeRequests || []).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/submissions/:id/messages (createThread)', () => {
    it('BLOCKS an unrelated reader from starting a DM thread on another institution’s submission', async () => {
      const { user: foreignReader } = await createUser({ role: 'reader' });
      const res = await request(app)
        .post(`/api/submissions/${submissionA._id}/messages`)
        .set('Authorization', `Bearer ${signTokenFor(foreignReader as any)}`)
        .send({ subject: 'hi', message: 'hello' });
      expect(res.status).toBe(403);
    });

    it('ALLOWS a reader assigned to the submission to start a thread', async () => {
      const { user: assignedReader } = await createUser({ role: 'reader' });
      await assignToSubmission(submissionA, assignedReader, 'reader');
      const res = await request(app)
        .post(`/api/submissions/${submissionA._id}/messages`)
        .set('Authorization', `Bearer ${signTokenFor(assignedReader as any)}`)
        .send({ subject: 'hi', message: 'hello' });
      expect(res.status).not.toBe(403);
    });
  });
});
