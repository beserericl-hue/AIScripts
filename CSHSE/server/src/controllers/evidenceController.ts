import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { Submission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { asyncHandler } from '../middleware/errorHandler';
import {
  AppError,
  ValidationError,
  AuthorizationError,
  NotFoundError,
  FileOperationError,
  logError
} from '../services/errorLogger';
import * as s3Service from '../services/s3Service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    institutionId?: string;
    isSuperuser?: boolean;
  };
  file?: Express.Multer.File;
}

/**
 * Verify user has access to a submission's evidence
 * Implements the access control requirement:
 * - Program coordinators can only see their own institution's evidence
 * - Readers/lead readers can only see evidence for submissions they're assigned to
 * - Admin can see all evidence
 */
async function verifyEvidenceAccess(
  userId: string,
  userRole: string,
  submissionId: string,
  institutionId?: string,
  isSuperuser?: boolean
): Promise<{ hasAccess: boolean; submission: any; institution: any }> {
  // Get submission with institution info
  const submission = await Submission.findById(submissionId).lean();
  if (!submission) {
    throw new NotFoundError('Submission');
  }

  // Get institution — try currentSubmissionId first, fall back to submission.institutionId
  let institution = await Institution.findOne({
    currentSubmissionId: submissionId
  }).lean();

  if (!institution && (submission as any).institutionId) {
    institution = await Institution.findById((submission as any).institutionId).lean();
  }

  // Superusers and admins have full access
  if (isSuperuser || userRole === 'admin') {
    return { hasAccess: true, submission, institution };
  }

  // Program coordinator - must be from same institution
  if (userRole === 'program_coordinator') {
    if (!institution) {
      return { hasAccess: false, submission, institution };
    }
    // Check if user's institution matches
    const userInst = await Institution.findOne({
      programCoordinatorId: userId
    }).lean();

    if (!userInst || userInst._id.toString() !== institution._id.toString()) {
      return { hasAccess: false, submission, institution };
    }
    return { hasAccess: true, submission, institution };
  }

  // Reader or Lead Reader - must be assigned to this institution/submission
  if (userRole === 'reader' || userRole === 'lead_reader') {
    if (!institution) {
      return { hasAccess: false, submission, institution };
    }

    // Check if lead reader is assigned
    if (userRole === 'lead_reader') {
      const isAssigned = institution.assignedLeadReaderId?.toString() === userId;
      return { hasAccess: isAssigned, submission, institution };
    }

    // Check if reader is assigned
    const isAssigned = institution.assignedReaderIds?.some(
      (id: any) => id.toString() === userId
    );
    return { hasAccess: isAssigned, submission, institution };
  }

  return { hasAccess: false, submission, institution };
}

/**
 * List evidence for a submission
 * Only returns evidence the user is authorized to see.
 * By default only returns current versions; pass includeVersions=true for all.
 */
export const listEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId } = req.params;
  const { standardCode, specCode, evidenceType, includeVersions } = req.query;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  // Verify access
  const { hasAccess, institution } = await verifyEvidenceAccess(
    userId,
    userRole,
    submissionId,
    undefined,
    isSuperuser
  );

  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this submission\'s evidence');
  }

  // Build query with access control
  const filter: any = {
    submissionId: new mongoose.Types.ObjectId(submissionId),
    isDeleted: false
  };

  // Only show current versions unless explicitly requesting all
  if (includeVersions !== 'true') {
    filter.$or = [
      { isCurrentVersion: true },
      { isCurrentVersion: { $exists: false } }  // backward compat for old records
    ];
  }

  if (standardCode) filter.standardCode = standardCode;
  if (specCode) filter.specCode = specCode;
  if (evidenceType) filter.evidenceType = evidenceType;

  // For non-admins, also filter by institutionId for extra security
  if (userRole !== 'admin' && institution) {
    filter.institutionId = institution._id;
  }

  // Don't include file.data in list response (too large)
  const evidence = await SupportingEvidence.find(filter)
    .select('-file.data')
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    evidence,
    count: evidence.length
  });
});

/**
 * Get a single evidence item
 */
export const getEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId, evidenceId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  // Verify access
  const { hasAccess } = await verifyEvidenceAccess(userId, userRole, submissionId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this evidence');
  }

  const evidence = await SupportingEvidence.findOne({
    _id: evidenceId,
    submissionId,
    isDeleted: false
  }).select('-file.data').lean();

  if (!evidence) {
    throw new NotFoundError('Evidence');
  }

  res.json(evidence);
});

/**
 * Upload document evidence (Word, PDF, PPT, images)
 * Files are stored in S3 if configured, otherwise falls back to base64 in MongoDB.
 * Supports auto-versioning: if a file with the same originalName exists for the
 * same institution+standard+spec, the old one is marked as a previous version.
 */
export const uploadEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId } = req.params;
  const { standardCode, specCode, description } = req.body;
  const file = req.file;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  // Only program coordinators and admins can upload
  if (userRole !== 'program_coordinator' && userRole !== 'admin') {
    throw new AuthorizationError('Only program coordinators can upload evidence');
  }

  if (!file) {
    throw new ValidationError('No file uploaded');
  }

  // Verify access
  const { hasAccess, submission, institution } = await verifyEvidenceAccess(
    userId,
    userRole,
    submissionId,
    undefined,
    isSuperuser
  );

  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to upload evidence for this submission');
  }

  // Resolve institution ID: prefer linked institution, fall back to submission.institutionId
  const resolvedInstitutionId = institution?._id || submission?.institutionId;
  if (!resolvedInstitutionId) {
    throw new ValidationError('No institution found for this submission');
  }

  const instIdStr = resolvedInstitutionId.toString();

  // Determine evidence type based on mime type
  let evidenceType: 'document' | 'image' = 'document';
  if (file.mimetype.startsWith('image/')) {
    evidenceType = 'image';
  }

  try {
    // --- Versioning: check if a current version with the same filename exists ---
    const existingCurrent = await SupportingEvidence.findOne({
      institutionId: resolvedInstitutionId,
      standardCode: standardCode || { $exists: false },
      specCode: specCode || { $exists: false },
      'file.originalName': file.originalname,
      isCurrentVersion: true,
      isDeleted: false,
    });

    const previousVersionNumber = existingCurrent?.versionNumber || 0;
    const newVersionNumber = previousVersionNumber + 1;
    const newVersionId = `${instIdStr}-${newVersionNumber}`;

    // If replacing, mark old version as superseded
    if (existingCurrent) {
      existingCurrent.isCurrentVersion = false;
      // replacedById will be set after we create the new doc
    }

    // --- Upload to S3 or fall back to base64 ---
    const useS3 = s3Service.isS3Configured();
    let fileRecord: any;

    if (useS3) {
      const s3Key = s3Service.generateS3Key(instIdStr, newVersionId, file.originalname);
      await s3Service.uploadFile(s3Key, file.buffer, file.mimetype);

      fileRecord = {
        filename: `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        s3Key,
        s3Bucket: process.env.AWS_S3_BUCKET_NAME,
        storageType: 's3',
        uploadedAt: new Date(),
        uploadedBy: new mongoose.Types.ObjectId(userId),
      };
    } else {
      // Legacy fallback: store as base64 in MongoDB
      const base64Data = file.buffer.toString('base64');
      fileRecord = {
        filename: `${Date.now()}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        data: base64Data,
        encoding: 'base64',
        storageType: 'base64',
        uploadedAt: new Date(),
        uploadedBy: new mongoose.Types.ObjectId(userId),
      };
    }

    // Create new evidence record
    const evidence = await SupportingEvidence.create({
      institutionId: resolvedInstitutionId,
      submissionId: new mongoose.Types.ObjectId(submissionId),
      uploadedBy: new mongoose.Types.ObjectId(userId),
      standardCode: standardCode || undefined,
      specCode: specCode || undefined,
      evidenceType,
      file: fileRecord,
      description: description || undefined,
      metadata: {
        description: description || '',
      },
      versionId: newVersionId,
      versionNumber: newVersionNumber,
      isCurrentVersion: true,
      previousVersionId: existingCurrent?._id,
    });

    // Update the old version to point to the new one
    if (existingCurrent) {
      existingCurrent.replacedById = evidence._id as mongoose.Types.ObjectId;
      await existingCurrent.save();
    }

    // Return response without the file data
    const responseEvidence = evidence.toObject();
    delete (responseEvidence as any).file?.data;

    res.status(201).json({
      message: 'Evidence uploaded successfully',
      evidence: responseEvidence,
      versionInfo: existingCurrent
        ? { replaced: true, previousVersion: previousVersionNumber, newVersion: newVersionNumber }
        : { replaced: false, version: newVersionNumber },
    });
  } catch (error) {
    await logError(error as Error, req, {
      operation: 'uploadEvidence',
      submissionId,
      filename: file.originalname,
    });
    throw new FileOperationError('Failed to store evidence file', {
      filename: file.originalname,
      size: file.size,
    });
  }
});

/**
 * Add URL evidence
 */
export const addUrlEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId } = req.params;
  const { standardCode, specCode, url, title, description } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  // Only program coordinators and admins can add evidence
  if (userRole !== 'program_coordinator' && userRole !== 'admin') {
    throw new AuthorizationError('Only program coordinators can add evidence');
  }

  if (!url) {
    throw new ValidationError('URL is required');
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  // Verify access
  const { hasAccess, submission: sub, institution } = await verifyEvidenceAccess(
    userId,
    userRole,
    submissionId,
    undefined,
    isSuperuser
  );

  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to add evidence for this submission');
  }

  // Resolve institution ID: prefer linked institution, fall back to submission.institutionId
  const resolvedInstitutionId = institution?._id || sub?.institutionId;
  if (!resolvedInstitutionId) {
    throw new ValidationError('No institution found for this submission');
  }

  const evidence = await SupportingEvidence.create({
    institutionId: resolvedInstitutionId,
    submissionId: new mongoose.Types.ObjectId(submissionId),
    uploadedBy: new mongoose.Types.ObjectId(userId),
    standardCode: standardCode || undefined,
    specCode: specCode || undefined,
    evidenceType: 'url',
    url: {
      href: url,
      title: title || url,
      description: description || '',
      addedAt: new Date(),
      addedBy: new mongoose.Types.ObjectId(userId),
      isAccessible: true
    }
  });

  res.status(201).json({
    message: 'URL evidence added successfully',
    evidence
  });
});

/**
 * Update evidence metadata
 */
export const updateEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId, evidenceId } = req.params;
  const { standardCode, specCode, description, title } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  // Verify access
  const { hasAccess } = await verifyEvidenceAccess(userId, userRole, submissionId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to update this evidence');
  }

  const evidence = await SupportingEvidence.findOne({
    _id: evidenceId,
    submissionId,
    isDeleted: false
  });

  if (!evidence) {
    throw new NotFoundError('Evidence');
  }

  // Only uploader, admin, or same institution program coordinator can update
  if (
    userRole !== 'admin' &&
    evidence.uploadedBy.toString() !== userId &&
    userRole !== 'program_coordinator'
  ) {
    throw new AuthorizationError('You cannot update this evidence');
  }

  // Update fields
  if (standardCode !== undefined) evidence.standardCode = standardCode || undefined;
  if (specCode !== undefined) evidence.specCode = specCode || undefined;

  if (evidence.evidenceType === 'url' && evidence.url) {
    if (title) evidence.url.title = title;
    if (description !== undefined) evidence.url.description = description;
  }

  if (evidence.metadata) {
    if (description !== undefined) evidence.metadata.description = description;
  } else if (description !== undefined) {
    evidence.metadata = { description };
  }

  await evidence.save();

  // Return without file data
  const responseEvidence = evidence.toObject();
  delete (responseEvidence as any).file?.data;

  res.json({
    message: 'Evidence updated successfully',
    evidence: responseEvidence
  });
});

/**
 * Delete evidence (soft delete)
 */
export const deleteEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId, evidenceId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  // Verify access
  const { hasAccess } = await verifyEvidenceAccess(userId, userRole, submissionId, undefined, isSuperuser);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to delete this evidence');
  }

  const evidence = await SupportingEvidence.findOne({
    _id: evidenceId,
    submissionId,
    isDeleted: false
  });

  if (!evidence) {
    throw new NotFoundError('Evidence');
  }

  // Superusers, admins, program coordinators, or the uploader can delete
  const canDelete =
    isSuperuser ||
    userRole === 'admin' ||
    userRole === 'program_coordinator' ||
    evidence.uploadedBy.toString() === userId;

  if (!canDelete) {
    throw new AuthorizationError('You cannot delete this evidence');
  }

  // Soft delete
  evidence.isDeleted = true;
  evidence.deletedAt = new Date();
  evidence.deletedBy = new mongoose.Types.ObjectId(userId);
  await evidence.save();

  res.json({ message: 'Evidence deleted successfully' });
});

/**
 * Download evidence file
 * Supports both S3 streaming and legacy base64 decoding
 */
export const downloadEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId, evidenceId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  // Verify access - includes all three IDs for security
  const { hasAccess, institution } = await verifyEvidenceAccess(
    userId,
    userRole,
    submissionId,
    undefined,
    isSuperuser
  );

  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to download this file');
  }

  // Find evidence with access control check
  const filter: any = {
    _id: evidenceId,
    submissionId,
    isDeleted: false
  };

  // Extra security: also check institutionId for non-admins
  if (userRole !== 'admin' && institution) {
    filter.institutionId = institution._id;
  }

  const evidence = await SupportingEvidence.findOne(filter);

  if (!evidence) {
    throw new NotFoundError('Evidence');
  }

  if (evidence.evidenceType === 'url') {
    // For URL evidence, redirect to the URL
    if (evidence.url?.href) {
      res.redirect(evidence.url.href);
      return;
    }
    throw new ValidationError('No URL available for this evidence');
  }

  if (!evidence.file) {
    throw new NotFoundError('File data');
  }

  try {
    const storageType = evidence.file.storageType || 'base64';

    if (storageType === 's3' && evidence.file.s3Key) {
      // --- S3 download: stream directly to response ---
      const { stream, contentLength } = await s3Service.downloadFile(evidence.file.s3Key);

      res.setHeader('Content-Type', evidence.file.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(evidence.file.originalName)}"`
      );
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      stream.pipe(res);
    } else if (evidence.file.data) {
      // --- Legacy base64 download ---
      const fileBuffer = Buffer.from(evidence.file.data, 'base64');

      res.setHeader('Content-Type', evidence.file.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(evidence.file.originalName)}"`
      );
      res.setHeader('Content-Length', fileBuffer.length);

      res.send(fileBuffer);
    } else {
      throw new NotFoundError('File data (no S3 key or base64 data found)');
    }
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    await logError(error as Error, req, {
      operation: 'downloadEvidence',
      evidenceId,
      filename: evidence.file.originalName
    });
    throw new FileOperationError('Failed to download file', {
      evidenceId,
      filename: evidence.file.originalName
    });
  }
});

/**
 * Link evidence to a specification
 */
export const linkEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId, evidenceId } = req.params;
  const { standardCode, specCode } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  if (!standardCode || !specCode) {
    throw new ValidationError('standardCode and specCode are required');
  }

  const { hasAccess } = await verifyEvidenceAccess(userId, userRole, submissionId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to link this evidence');
  }

  const evidence = await SupportingEvidence.findOne({
    _id: evidenceId,
    submissionId,
    isDeleted: false
  });

  if (!evidence) {
    throw new NotFoundError('Evidence');
  }

  evidence.standardCode = standardCode;
  evidence.specCode = specCode;
  await evidence.save();

  // Return without file data
  const responseEvidence = evidence.toObject();
  delete (responseEvidence as any).file?.data;

  res.json({
    message: 'Evidence linked successfully',
    evidence: responseEvidence
  });
});

/**
 * Unlink evidence from a specification
 */
export const unlinkEvidence = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId, evidenceId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  const { hasAccess } = await verifyEvidenceAccess(userId, userRole, submissionId);
  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to unlink this evidence');
  }

  const evidence = await SupportingEvidence.findOne({
    _id: evidenceId,
    submissionId,
    isDeleted: false
  });

  if (!evidence) {
    throw new NotFoundError('Evidence');
  }

  evidence.standardCode = undefined;
  evidence.specCode = undefined;
  await evidence.save();

  // Return without file data
  const responseEvidence = evidence.toObject();
  delete (responseEvidence as any).file?.data;

  res.json({
    message: 'Evidence unlinked successfully',
    evidence: responseEvidence
  });
});

/**
 * Get evidence statistics for a submission
 */
export const getEvidenceStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { submissionId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const isSuperuser = req.user?.isSuperuser;

  if (!userId || !userRole) {
    throw new AuthorizationError('Authentication required');
  }

  const { hasAccess, institution } = await verifyEvidenceAccess(
    userId,
    userRole,
    submissionId,
    undefined,
    isSuperuser
  );

  if (!hasAccess) {
    throw new AuthorizationError('You do not have access to this submission\'s evidence');
  }

  // Build match criteria with access control
  const matchCriteria: any = {
    submissionId: new mongoose.Types.ObjectId(submissionId),
    isDeleted: false
  };

  if (userRole !== 'admin' && institution) {
    matchCriteria.institutionId = institution._id;
  }

  const stats = await SupportingEvidence.aggregate([
    { $match: matchCriteria },
    {
      $group: {
        _id: '$evidenceType',
        count: { $sum: 1 },
        totalSize: { $sum: '$file.size' }
      }
    }
  ]);

  const linkedCount = await SupportingEvidence.countDocuments({
    ...matchCriteria,
    standardCode: { $ne: null, $exists: true }
  });

  const unlinkedCount = await SupportingEvidence.countDocuments({
    ...matchCriteria,
    $or: [
      { standardCode: null },
      { standardCode: { $exists: false } }
    ]
  });

  res.json({
    byType: stats.reduce((acc, s) => {
      acc[s._id] = { count: s.count, totalSize: s.totalSize || 0 };
      return acc;
    }, {} as Record<string, any>),
    linkedCount,
    unlinkedCount,
    total: linkedCount + unlinkedCount
  });
});
