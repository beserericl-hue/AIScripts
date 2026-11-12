/**
 * Keep an uploaded curriculum-matrix file in the File Library WITHOUT importing
 * it into the self-study (see curriculumMatrixExclusion). Used by the importer
 * entry points (single upload + multi-file batch) when the coordinator drops a
 * matrix document in: it is never parsed, indexed or evaluated.
 */
import mongoose from 'mongoose';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { CURRICULUM_MATRIX_EXCLUDED_TAG } from './curriculumMatrixExclusion';

export const EXCLUDED_MATRIX_MESSAGE =
  'This is a curriculum matrix, which is no longer part of the self-study. It was kept in your File Library but is not imported, indexed or evaluated.';

export async function storeExcludedCurriculumMatrixFile(args: {
  submission: { _id: any; institutionId?: any };
  file: { originalname: string; mimetype: string; buffer: Buffer };
  userId: string | undefined;
}) {
  const uploaderId = new mongoose.Types.ObjectId(args.userId);
  const { file, submission } = args;
  const evidence = await SupportingEvidence.create({
    institutionId: submission.institutionId,
    submissionId: submission._id,
    uploadedBy: uploaderId,
    evidenceType: 'document',
    file: {
      filename: file.originalname,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.buffer.length,
      data: file.buffer.toString('base64'),
      encoding: 'base64',
      storageType: 'base64',
      uploadedAt: new Date(),
      uploadedBy: uploaderId,
    } as any,
    description: file.originalname,
    versionNumber: 1,
    isCurrentVersion: true,
    isDeleted: false,
    linkedNarratives: [],
    // The pre-save hook also stamps this tag and keeps it un-assigned.
    tags: ['ai-import', 'direct-upload', CURRICULUM_MATRIX_EXCLUDED_TAG],
  });
  return {
    directStored: true,
    excluded: true,
    kind: CURRICULUM_MATRIX_EXCLUDED_TAG,
    evidenceId: evidence._id,
    fileName: file.originalname,
    message: EXCLUDED_MATRIX_MESSAGE,
  };
}
