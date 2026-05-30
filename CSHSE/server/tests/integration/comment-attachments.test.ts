/**
 * CR-021 / Sprint 5.3 — reader file attachments on comments.
 *
 * Tests stub the s3Service module-level functions (uploadFile, downloadFile,
 * deleteFile) so the tests don't need real S3 creds. We pin:
 *
 * - reader (assigned) can attach a file → 201 + attachment row persists
 * - PC cannot upload → 403
 * - file with disallowed MIME → 400
 * - download follows the parent-comment ACL:
 *     - reader / lead_reader / admin can always read
 *     - PC can read only when the parent comment is relayed
 *     - PC reading an attachment on an unrelayed parent → 403
 * - uploader can delete; non-uploader reader (not lead/admin) cannot
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { Readable } from 'stream';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Comment } from '../../src/models/Comment';
import * as s3 from '../../src/services/s3Service';
import { createUser, signTokenFor } from '../helpers/factories';

let uploadSpy: ReturnType<typeof vi.spyOn>;
let downloadSpy: ReturnType<typeof vi.spyOn>;
let deleteSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // Avoid real S3 calls.
  uploadSpy = vi.spyOn(s3, 'uploadFile').mockResolvedValue({
    key: 'reader-attachments/stub/key.pdf',
    bucket: 'test'
  });
  downloadSpy = vi.spyOn(s3, 'downloadFile').mockImplementation(async (_key: string) => {
    const stream = Readable.from(['Hello, attached world.']);
    return {
      stream,
      contentType: 'application/pdf',
      contentLength: 22
    };
  });
  deleteSpy = vi.spyOn(s3, 'deleteFile').mockResolvedValue();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function seed() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const { user: reader } = await createUser({ role: 'reader', firstName: 'Jane', lastName: 'Reader' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  const sub: any = await Submission.create({
    submissionId: `ATT-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Att U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'under_review',
    assignedReaders: [reader._id],
    leadReader: lead._id
  });

  const unrelayedComment: any = await Comment.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'a',
    selectedText: 'governance',
    selectionStart: 0,
    selectionEnd: 10,
    authorId: reader._id,
    authorName: 'Jane Reader',
    authorRole: 'reader',
    content: 'Org chart unclear.',
    relayed: false,
    boardEscalated: false
  });

  const relayedComment: any = await Comment.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'b',
    selectedText: 'syllabus',
    selectionStart: 0,
    selectionEnd: 8,
    authorId: reader._id,
    authorName: 'Jane Reader',
    authorRole: 'reader',
    content: 'Please add the 2023 syllabus revision.',
    relayed: true,
    relayedText: 'Please add the 2023 syllabus revision.',
    pcLabel: 'Reader A',
    boardEscalated: false
  });

  return {
    sid: String(sub._id),
    unrelayedId: String(unrelayedComment._id),
    relayedId: String(relayedComment._id),
    readerTok: signTokenFor(reader as any),
    leadTok: signTokenFor(lead as any),
    adminTok: signTokenFor(admin as any),
    pcTok: signTokenFor(pc as any),
    readerId: String(reader._id)
  };
}

describe('CR-021 — POST /api/comments/:id/attachments', () => {
  it('assigned reader uploads a PDF; attachment row persists', async () => {
    const { unrelayedId, readerTok } = await seed();
    const res = await request(app)
      .post(`/api/comments/${unrelayedId}/attachments`)
      .set('Authorization', `Bearer ${readerTok}`)
      .attach('file', Buffer.from('%PDF-1.4 stub'), {
        filename: 'rubric.pdf',
        contentType: 'application/pdf'
      });

    expect(res.status).toBe(201);
    expect(res.body.attachment.filename).toBe('rubric.pdf');
    expect(uploadSpy).toHaveBeenCalledTimes(1);

    const comment = await Comment.findById(unrelayedId);
    expect(comment?.attachments.length).toBe(1);
    expect(comment?.attachments[0].mimeType).toBe('application/pdf');
  });

  it('rejects PC (403)', async () => {
    const { unrelayedId, pcTok } = await seed();
    const res = await request(app)
      .post(`/api/comments/${unrelayedId}/attachments`)
      .set('Authorization', `Bearer ${pcTok}`)
      .attach('file', Buffer.from('x'), { filename: 'foo.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(403);
  });

  it('rejects unsupported MIME (400)', async () => {
    const { unrelayedId, readerTok } = await seed();
    const res = await request(app)
      .post(`/api/comments/${unrelayedId}/attachments`)
      .set('Authorization', `Bearer ${readerTok}`)
      .attach('file', Buffer.from('exec'), { filename: 'evil.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('rejects when no file field present (400)', async () => {
    const { unrelayedId, readerTok } = await seed();
    const res = await request(app)
      .post(`/api/comments/${unrelayedId}/attachments`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(400);
  });
});

describe('CR-021 — GET /api/comments/:id/attachments/:attId — ACL', () => {
  async function seedWithAttachments() {
    const seeded = await seed();
    // Upload an attachment on each comment (under reader auth).
    for (const id of [seeded.unrelayedId, seeded.relayedId]) {
      const r = await request(app)
        .post(`/api/comments/${id}/attachments`)
        .set('Authorization', `Bearer ${seeded.readerTok}`)
        .attach('file', Buffer.from('pdf'), {
          filename: 'memo.pdf',
          contentType: 'application/pdf'
        });
      expect(r.status).toBe(201);
    }
    const unrelayed = await Comment.findById(seeded.unrelayedId);
    const relayed = await Comment.findById(seeded.relayedId);
    return {
      ...seeded,
      unrelayedAttId: String(unrelayed!.attachments[0]._id),
      relayedAttId: String(relayed!.attachments[0]._id)
    };
  }

  it('reader can download from an unrelayed comment', async () => {
    const { unrelayedId, unrelayedAttId, readerTok } = await seedWithAttachments();
    const res = await request(app)
      .get(`/api/comments/${unrelayedId}/attachments/${unrelayedAttId}`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
  });

  it('PC CANNOT download from an unrelayed comment (403)', async () => {
    const { unrelayedId, unrelayedAttId, pcTok } = await seedWithAttachments();
    const res = await request(app)
      .get(`/api/comments/${unrelayedId}/attachments/${unrelayedAttId}`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(res.status).toBe(403);
    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('PC CAN download from a relayed comment', async () => {
    const { relayedId, relayedAttId, pcTok } = await seedWithAttachments();
    const res = await request(app)
      .get(`/api/comments/${relayedId}/attachments/${relayedAttId}`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(res.status).toBe(200);
  });

  it('admin can download from any comment', async () => {
    const { unrelayedId, unrelayedAttId, adminTok } = await seedWithAttachments();
    const res = await request(app)
      .get(`/api/comments/${unrelayedId}/attachments/${unrelayedAttId}`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
  });
});

describe('CR-021 — DELETE /api/comments/:id/attachments/:attId', () => {
  it('uploader can delete their attachment', async () => {
    const { unrelayedId, readerTok } = await seed();
    const r = await request(app)
      .post(`/api/comments/${unrelayedId}/attachments`)
      .set('Authorization', `Bearer ${readerTok}`)
      .attach('file', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' });
    const attId = r.body.attachment._id;

    const del = await request(app)
      .delete(`/api/comments/${unrelayedId}/attachments/${attId}`)
      .set('Authorization', `Bearer ${readerTok}`);
    expect(del.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalled();

    const comment = await Comment.findById(unrelayedId);
    expect(comment?.attachments.length).toBe(0);
  });

  it('non-uploader reader cannot delete', async () => {
    const { unrelayedId, readerTok } = await seed();
    // uploader = reader; create an attachment.
    const r = await request(app)
      .post(`/api/comments/${unrelayedId}/attachments`)
      .set('Authorization', `Bearer ${readerTok}`)
      .attach('file', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' });
    const attId = r.body.attachment._id;

    // Create a different reader.
    const { user: other } = await createUser({ role: 'reader' });
    const otherTok = signTokenFor(other as any);

    const del = await request(app)
      .delete(`/api/comments/${unrelayedId}/attachments/${attId}`)
      .set('Authorization', `Bearer ${otherTok}`);
    expect(del.status).toBe(403);
  });

  it('lead_reader can delete any attachment on a submission they oversee', async () => {
    const { unrelayedId, readerTok, leadTok } = await seed();
    const r = await request(app)
      .post(`/api/comments/${unrelayedId}/attachments`)
      .set('Authorization', `Bearer ${readerTok}`)
      .attach('file', Buffer.from('x'), { filename: 'a.pdf', contentType: 'application/pdf' });
    const attId = r.body.attachment._id;

    const del = await request(app)
      .delete(`/api/comments/${unrelayedId}/attachments/${attId}`)
      .set('Authorization', `Bearer ${leadTok}`);
    expect(del.status).toBe(200);
  });
});
