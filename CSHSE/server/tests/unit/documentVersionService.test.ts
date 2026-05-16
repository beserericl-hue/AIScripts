import mongoose from 'mongoose';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/s3Service', () => ({
  uploadFile: vi.fn(async (key: string, buffer: Buffer) => ({
    key,
    bucket: 'mock-bucket',
  })),
}));

import {
  DocumentVersion,
  IDocumentVersion,
} from '../../src/models/DocumentVersion';
import {
  findLatestVersion,
  listVersions,
  recordVersion,
  sha256,
  softDeleteVersion,
} from '../../src/services/documentVersionService';
import { uploadFile } from '../../src/services/s3Service';

const fakeSubmissionId = () => new mongoose.Types.ObjectId();
const fakeUserId = () => new mongoose.Types.ObjectId();

describe('documentVersionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sha256', () => {
    it('produces deterministic 64-char hex digest', () => {
      const a = sha256(Buffer.from('hello'));
      const b = sha256(Buffer.from('hello'));
      expect(a).toBe(b);
      expect(a).toHaveLength(64);
      expect(a).toMatch(/^[a-f0-9]{64}$/);
    });

    it('differs for different bytes', () => {
      expect(sha256(Buffer.from('hello'))).not.toBe(sha256(Buffer.from('world')));
    });
  });

  describe('recordVersion — first upload', () => {
    it('creates v1, calls S3 with versioned key, returns DocumentVersion', async () => {
      const submissionId = fakeSubmissionId();
      const userId = fakeUserId();
      const v = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionId,
        kind: 'original_import',
        buffer: Buffer.from('stub docx bytes'),
        fileName: 'stevenson.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadedBy: userId,
        uploadedByName: 'Eric Beser',
      });

      expect(v.version).toBe(1);
      expect(v.ownerType).toBe('submission');
      expect(v.kind).toBe('original_import');
      expect(v.fileName).toBe('stevenson.docx');
      expect(v.sha256).toHaveLength(64);
      expect(v.supersedes).toBeUndefined();
      expect(v.s3Key).toMatch(
        new RegExp(`^versioned/submission/${submissionId}/original_import/v1/stevenson\\.docx$`)
      );
      expect(uploadFile).toHaveBeenCalledTimes(1);
    });

    it('writes documentId so the version line is identifiable', async () => {
      const v = await recordVersion({
        ownerType: 'institution',
        ownerId: fakeSubmissionId(),
        kind: 'spec_document',
        buffer: Buffer.from('spec bytes'),
        fileName: 'spec.pdf',
        mimeType: 'application/pdf',
        uploadedBy: fakeUserId(),
        uploadedByName: 'Admin',
      });

      expect(v.documentId).toBeDefined();
      expect(v.documentId.toString()).toMatch(/^[a-f0-9]{24}$/);
    });
  });

  describe('recordVersion — successive uploads', () => {
    it('increments to v2, links supersedes, updates v1.supersededBy', async () => {
      const submissionId = fakeSubmissionId();
      const userId = fakeUserId();

      const v1 = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionId,
        kind: 'original_import',
        buffer: Buffer.from('first content'),
        fileName: 'file.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
      });

      const v2 = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionId,
        kind: 'original_import',
        buffer: Buffer.from('second content'),
        fileName: 'file.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
      });

      expect(v2.version).toBe(2);
      expect(v2.documentId.toString()).toBe(v1.documentId.toString());
      expect(v2.supersedes?.toString()).toBe((v1._id as mongoose.Types.ObjectId).toString());

      const v1Reloaded = (await DocumentVersion.findById(v1._id))!;
      expect(v1Reloaded.supersededBy?.toString()).toBe(
        (v2._id as mongoose.Types.ObjectId).toString()
      );

      expect(uploadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('recordVersion — sha256 dedup', () => {
    it('returns existing version when bytes are identical (no new S3 upload)', async () => {
      const submissionId = fakeSubmissionId();
      const userId = fakeUserId();
      const buffer = Buffer.from('identical bytes');

      const v1 = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionId,
        kind: 'original_import',
        buffer,
        fileName: 'file.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
      });

      const same = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionId,
        kind: 'original_import',
        buffer,
        fileName: 'file.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
      });

      expect(same._id.toString()).toBe((v1._id as mongoose.Types.ObjectId).toString());
      expect(same.version).toBe(1);
      expect(uploadFile).toHaveBeenCalledTimes(1); // ONLY the first upload
    });

    it('does NOT dedup across different (owner, kind) tuples', async () => {
      const submissionA = fakeSubmissionId();
      const submissionB = fakeSubmissionId();
      const userId = fakeUserId();
      const buffer = Buffer.from('identical bytes');

      const a = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionA,
        kind: 'original_import',
        buffer,
        fileName: 'f.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
      });
      const b = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionB,
        kind: 'original_import',
        buffer,
        fileName: 'f.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
      });

      expect(a._id.toString()).not.toBe((b._id as mongoose.Types.ObjectId).toString());
      expect(uploadFile).toHaveBeenCalledTimes(2);
    });

    it('honors dedupBySha=false (forces a new version even if bytes match)', async () => {
      const submissionId = fakeSubmissionId();
      const userId = fakeUserId();
      const buffer = Buffer.from('same bytes');

      await recordVersion({
        ownerType: 'submission',
        ownerId: submissionId,
        kind: 'original_import',
        buffer,
        fileName: 'f.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
      });

      const v2 = await recordVersion({
        ownerType: 'submission',
        ownerId: submissionId,
        kind: 'original_import',
        buffer,
        fileName: 'f.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: userId,
        uploadedByName: 'Eric',
        dedupBySha: false,
      });

      expect(v2.version).toBe(2);
      expect(uploadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('listVersions', () => {
    it('returns newest first', async () => {
      const id = fakeSubmissionId();
      const uid = fakeUserId();
      for (let i = 0; i < 3; i++) {
        await recordVersion({
          ownerType: 'submission',
          ownerId: id,
          kind: 'original_import',
          buffer: Buffer.from(`v${i}`),
          fileName: 'f.docx',
          mimeType: 'application/octet-stream',
          uploadedBy: uid,
          uploadedByName: 'Eric',
        });
      }
      const list = await listVersions('submission', id);
      expect(list.map((v) => v.version)).toEqual([3, 2, 1]);
    });

    it('excludes soft-deleted versions', async () => {
      const id = fakeSubmissionId();
      const uid = fakeUserId();
      const v1 = await recordVersion({
        ownerType: 'submission',
        ownerId: id,
        kind: 'original_import',
        buffer: Buffer.from('hello'),
        fileName: 'f.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: uid,
        uploadedByName: 'Eric',
      });
      await softDeleteVersion(v1._id as mongoose.Types.ObjectId, uid);
      const list = await listVersions('submission', id);
      expect(list).toHaveLength(0);
    });

    it('filters by kind when provided', async () => {
      const id = fakeSubmissionId();
      const uid = fakeUserId();
      await recordVersion({
        ownerType: 'submission',
        ownerId: id,
        kind: 'original_import',
        buffer: Buffer.from('a'),
        fileName: 'a.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: uid,
        uploadedByName: 'Eric',
      });
      await recordVersion({
        ownerType: 'submission',
        ownerId: id,
        kind: 'reader_report',
        buffer: Buffer.from('b'),
        fileName: 'b.docx',
        mimeType: 'application/octet-stream',
        uploadedBy: uid,
        uploadedByName: 'Eric',
      });

      const onlyImports = await listVersions('submission', id, 'original_import');
      expect(onlyImports).toHaveLength(1);
      expect(onlyImports[0].kind).toBe('original_import');
    });
  });

  describe('findLatestVersion', () => {
    it('returns the highest-version row', async () => {
      const id = fakeSubmissionId();
      const uid = fakeUserId();
      for (let i = 0; i < 4; i++) {
        await recordVersion({
          ownerType: 'submission',
          ownerId: id,
          kind: 'original_import',
          buffer: Buffer.from(`v${i}`),
          fileName: 'f.docx',
          mimeType: 'application/octet-stream',
          uploadedBy: uid,
          uploadedByName: 'Eric',
        });
      }
      const latest = await findLatestVersion('submission', id, 'original_import');
      expect(latest?.version).toBe(4);
    });

    it('returns null when no versions exist', async () => {
      const id = fakeSubmissionId();
      const latest = await findLatestVersion('submission', id, 'original_import');
      expect(latest).toBeNull();
    });
  });
});
