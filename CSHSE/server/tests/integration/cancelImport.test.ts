/**
 * P1 follow-on — coverage for POST /api/imports/:importId/cancel.
 *
 * The legacy `cancelImport` handler in importController.ts is what the
 * wizard's mid-parse Cancel button calls (the client posts to
 * /api/imports/:id/cancel via aiImportStore.cancelImport). It deletes
 * the SelfStudyImport record entirely once the status is in a
 * cancellable set; non-cancellable statuses return 400, missing
 * imports return 404.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { SelfStudyImport } from '../../src/models/SelfStudyImport';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedSubmission(userId: any) {
  return Submission.create({
    submissionId: `CANCEL-${Date.now().toString(36)}`,
    institutionName: 'Test U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: userId,
    type: 'initial',
    status: 'draft',
  });
}

async function seedImport(submissionId: any, userId: any, status: string) {
  return SelfStudyImport.create({
    submissionId,
    originalFilename: 'cancel-test.docx',
    fileType: 'docx',
    uploadedBy: userId,
    status,
    extractedContent: { rawText: '', pageCount: 0, metadata: {}, sections: [] },
    mappedSections: [],
    unmappedContent: [],
  } as any);
}

describe('POST /api/imports/:importId/cancel', () => {
  it('returns 404 when the import does not exist', async () => {
    const { user } = await createUser();
    const token = signTokenFor(user as any);
    const ghostId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/imports/${ghostId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when the import is in a non-cancellable state', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id, 'completed');
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be cancelled/i);
  });

  it('cancels and deletes the import when status is processing', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id, 'processing');
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.importId).toBe(String(imp._id));
    // The record is fully removed — the wizard's localStorage will
    // start 404'ing on /ai-status, which is the existing legacy
    // contract.
    const reloaded = await SelfStudyImport.findById(imp._id);
    expect(reloaded).toBeNull();
  });

  it('cancels when status is pending', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id, 'pending');
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await SelfStudyImport.findById(imp._id)).toBeNull();
  });

  it('cancels when status is awaiting_selection', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id, 'awaiting_selection');
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 400 for status=failed (not in the cancellable set)', async () => {
    const { user } = await createUser();
    const sub = await seedSubmission(user._id);
    const imp = await seedImport(sub._id, user._id, 'failed');
    const token = signTokenFor(user as any);
    const res = await request(app)
      .post(`/api/imports/${imp._id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });
});
