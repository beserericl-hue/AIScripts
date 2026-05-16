import crypto from 'crypto';
import mongoose from 'mongoose';

import {
  DocumentKind,
  DocumentOwnerType,
  DocumentVersion,
  IDocumentVersion,
} from '../models/DocumentVersion';
import { uploadFile } from './s3Service';

/**
 * Compute SHA-256 of a buffer as a 64-char hex digest. Used to dedup
 * identical uploads — same bytes for the same (owner, kind) tuple should
 * not create a new version.
 */
export function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
}

function versionedS3Key(
  ownerType: DocumentOwnerType,
  ownerId: string,
  kind: DocumentKind,
  version: number,
  fileName: string
): string {
  return `versioned/${ownerType}/${ownerId}/${kind}/v${version}/${sanitizeFilename(fileName)}`;
}

/**
 * Find the most recent (highest-version) document for a given owner + kind.
 * Returns null if none exists yet.
 */
export async function findLatestVersion(
  ownerType: DocumentOwnerType,
  ownerId: mongoose.Types.ObjectId,
  kind: DocumentKind
): Promise<IDocumentVersion | null> {
  return DocumentVersion.findOne({
    ownerType,
    ownerId,
    kind,
    isDeleted: false,
  })
    .sort({ version: -1 })
    .exec();
}

/**
 * List every version for an owner + kind, newest first.
 */
export async function listVersions(
  ownerType: DocumentOwnerType,
  ownerId: mongoose.Types.ObjectId,
  kind?: DocumentKind
): Promise<IDocumentVersion[]> {
  const filter: Record<string, unknown> = {
    ownerType,
    ownerId,
    isDeleted: false,
  };
  if (kind) filter.kind = kind;
  return DocumentVersion.find(filter).sort({ version: -1 }).exec();
}

export interface RecordVersionArgs {
  ownerType: DocumentOwnerType;
  ownerId: mongoose.Types.ObjectId;
  kind: DocumentKind;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploadedByName: string;
  metadata?: IDocumentVersion['metadata'];

  /**
   * If true (default), check sha256 against the latest existing version for
   * this (owner, kind) tuple; on a match, return the existing record without
   * creating a new version (idempotent re-upload).
   */
  dedupBySha?: boolean;
}

/**
 * Record a new version of a document.
 *
 * Always atomic from the model's perspective: assigns the next monotonic
 * version per (ownerType, ownerId, kind), uploads to S3 at a versioned key
 * that includes the version number, then writes the DocumentVersion row.
 *
 * If `dedupBySha` is true (default) and the latest existing version for this
 * tuple has the same sha256 as the buffer, returns the existing row without
 * creating a duplicate.
 */
export async function recordVersion(
  args: RecordVersionArgs
): Promise<IDocumentVersion> {
  const {
    ownerType,
    ownerId,
    kind,
    buffer,
    fileName,
    mimeType,
    uploadedBy,
    uploadedByName,
    metadata,
    dedupBySha = true,
  } = args;

  const digest = sha256(buffer);

  const latest = await findLatestVersion(ownerType, ownerId, kind);

  if (dedupBySha && latest && latest.sha256 === digest) {
    return latest;
  }

  const version = latest ? latest.version + 1 : 1;
  const documentId =
    latest?.documentId ?? new mongoose.Types.ObjectId();

  const s3Key = versionedS3Key(ownerType, String(ownerId), kind, version, fileName);
  await uploadFile(s3Key, buffer, mimeType);

  const created = await DocumentVersion.create({
    documentId,
    version,
    s3Key,
    fileName,
    mimeType,
    sizeBytes: buffer.length,
    sha256: digest,
    ownerType,
    ownerId,
    kind,
    uploadedBy,
    uploadedByName,
    supersedes: latest?._id,
    isDeleted: false,
    metadata,
  });

  if (latest) {
    latest.supersededBy = created._id as mongoose.Types.ObjectId;
    await latest.save();
  }

  return created;
}

/**
 * Soft-delete a single version (does NOT delete the S3 object — preserves
 * the audit trail). Use `purgeVersion` if you genuinely need to remove the
 * underlying bytes.
 */
export async function softDeleteVersion(
  id: mongoose.Types.ObjectId,
  deletedBy: mongoose.Types.ObjectId
): Promise<IDocumentVersion | null> {
  return DocumentVersion.findByIdAndUpdate(
    id,
    { isDeleted: true, deletedAt: new Date(), deletedBy },
    { new: true }
  ).exec();
}
