import { Request, Response } from 'express';
import { Submission, ISubmission } from '../models/Submission';
import { Institution } from '../models/Institution';
import { ValidationResult } from '../models/ValidationResult';
import { ValidationService } from '../services/validationService';
import { emailService } from '../services/emailService';
import { recordAuditEvent } from '../services/auditLog';
import { User } from '../models/User';
import { Spec } from '../models/Spec';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    name?: string;
    isSuperuser?: boolean;
  };
}

const validationService = new ValidationService();

/**
 * Convert narratives Map to array format for client
 */
function narrativesMapToArray(narratives: Map<string, Map<string, any>> | undefined): Array<{
  standardCode: string;
  specCode: string;
  content: string;
  lastModified?: Date;
  supportingEvidenceText?: string;
}> {
  if (!narratives) return [];

  const result: Array<any> = [];
  narratives.forEach((specMap, standardCode) => {
    if (specMap instanceof Map) {
      specMap.forEach((narrativeContent, specCode) => {
        result.push({
          standardCode,
          specCode,
          content: narrativeContent.content || '',
          lastModified: narrativeContent.lastModified,
          supportingEvidenceText: narrativeContent.supportingEvidenceText || ''
        });
      });
    }
  });
  return result;
}

/**
 * Get submission by ID
 */
export const getSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-007: readers + lead readers can only see a submission once the PC
    // has clicked final submit. Direct URL access to a draft returns 403.
    const isElevated = req.user?.role === 'admin' || (req.user as any)?.isSuperuser;
    if (!isElevated && (req.user?.role === 'reader' || req.user?.role === 'lead_reader')) {
      const draftStates = ['draft', 'in_progress'];
      if (draftStates.includes(submission.status)) {
        return res.status(403).json({
          error: 'This self-study has not yet been submitted for review',
          status: submission.status
        });
      }
    }

    // Convert nested Map to array format for client
    const submissionObj = submission.toObject();
    const narrativeContent = narrativesMapToArray(submission.narratives);

    // Explicitly flatten standardsStatus Map to POJO for JSON serialization
    // (Mongoose Maps may not serialize correctly via toObject() alone)
    const standardsStatus: Record<string, any> = {};
    if (submission.standardsStatus) {
      submission.standardsStatus.forEach((value: any, key: string) => {
        standardsStatus[key] = typeof value?.toObject === 'function'
          ? value.toObject()
          : { ...value };
      });
    }

    // Debug: log standardsStatus entries with validationStatus set
    const validatedKeys = Object.entries(standardsStatus)
      .filter(([, v]: [string, any]) => v?.validationStatus)
      .map(([k, v]: [string, any]) => `${k}=${v.validationStatus}`);
    if (validatedKeys.length > 0) {
      console.log(`[getSubmission] ${submissionId} has ${validatedKeys.length} validated entries:`, validatedKeys.join(', '));
    } else {
      console.log(`[getSubmission] ${submissionId} standardsStatus has ${Object.keys(standardsStatus).length} keys, 0 with validationStatus`);
    }

    return res.json({
      ...submissionObj,
      narrativeContent,
      standardsStatus
    });
  } catch (error) {
    console.error('Get submission error:', error);
    return res.status(500).json({ error: 'Failed to get submission' });
  }
};

/**
 * Get submission progress
 */
export const getSubmissionProgress = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Calculate overall progress
    const statusEntries: any[] = submission.standardsStatus
      ? Array.from(submission.standardsStatus.values())
      : [];
    const totalStandards = 21;
    let completedStandards = 0;
    let submittedStandards = 0;
    let validatedStandards = 0;
    let failedStandards = 0;

    statusEntries.forEach((status: any) => {
      if (status.status === 'complete' || status.status === 'submitted' || status.status === 'validated') {
        completedStandards++;
      }
      if (status.status === 'submitted' || status.status === 'validated') {
        submittedStandards++;
      }
      if (status.status === 'validated') {
        validatedStandards++;
      }
      if (status.validationStatus === 'fail') {
        failedStandards++;
      }
    });

    // Get validation results summary
    const validationResults = await ValidationResult.aggregate([
      { $match: { submissionId: submissionId } },
      {
        $group: {
          _id: { standardCode: '$standardCode', specCode: '$specCode' },
          latestResult: { $last: '$result' },
          attemptCount: { $max: '$attemptNumber' }
        }
      }
    ]);

    const passCount = validationResults.filter(v => v.latestResult?.status === 'pass').length;
    const failCount = validationResults.filter(v => v.latestResult?.status === 'fail').length;
    const pendingCount = validationResults.filter(v => v.latestResult?.status === 'pending').length;

    return res.json({
      submissionId,
      totalStandards,
      completedStandards,
      submittedStandards,
      validatedStandards,
      failedStandards,
      progressPercent: Math.round((completedStandards / totalStandards) * 100),
      validation: {
        passed: passCount,
        failed: failCount,
        pending: pendingCount
      },
      standardsStatus: submission.standardsStatus
        ? Object.fromEntries(submission.standardsStatus)
        : {},
      selfStudyProgress: submission.selfStudyProgress || {}
    });
  } catch (error) {
    console.error('Get submission progress error:', error);
    return res.status(500).json({ error: 'Failed to get progress' });
  }
};

/**
 * Save narrative content
 */
export const saveNarrative = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode, specCode, content, supportingEvidenceText } = req.body;

    // Require standardCode, and at least one of content or supportingEvidenceText
    // Note: content can be empty string (for clearing section)
    if (!standardCode) {
      return res.status(400).json({ error: 'standardCode is required' });
    }

    // Check if at least one field is being updated (content can be empty string, which is valid)
    const hasContent = content !== undefined;
    const hasSupportingEvidence = supportingEvidenceText !== undefined;

    if (!hasContent && !hasSupportingEvidence) {
      return res.status(400).json({ error: 'content or supportingEvidenceText is required' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Initialize narratives map if not present
    if (!submission.narratives) {
      submission.narratives = new Map();
    }

    // Get or create standard map
    let standardNarratives = submission.narratives.get(standardCode);
    if (!standardNarratives) {
      standardNarratives = new Map();
      submission.narratives.set(standardCode, standardNarratives);
    }

    // Get existing narrative or create new
    const specKey = specCode || '';
    const existingNarrative = standardNarratives.get(specKey);

    // Update only the provided fields, preserving others
    standardNarratives.set(specKey, {
      content: hasContent ? content : (existingNarrative?.content || ''),
      lastModified: new Date(),
      isComplete: existingNarrative?.isComplete || false,
      linkedDocuments: existingNarrative?.linkedDocuments || [],
      supportingEvidenceText: hasSupportingEvidence ? supportingEvidenceText : (existingNarrative?.supportingEvidenceText || '')
    });

    // CRITICAL: Mark nested maps as modified for Mongoose to save them
    submission.markModified('narratives');
    await submission.save();

    // Use atomic $set for standardsStatus (Mongoose Map.set() doesn't persist in Mongoose 8)
    const statusKey = specCode ? `${standardCode}_${specCode}` : standardCode;
    const currentStatus = submission.standardsStatus?.get(statusKey);
    if (!currentStatus || currentStatus.status === 'not_started') {
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${statusKey}.status`]: 'in_progress',
          [`standardsStatus.${statusKey}.completionPercentage`]: 0,
          [`standardsStatus.${statusKey}.lastModified`]: new Date()
        }}
      );
    }

    // Get the saved narrative for the response
    const savedNarrative = standardNarratives.get(specKey);

    return res.json({
      message: 'Narrative saved successfully',
      narrative: {
        standardCode,
        specCode: specKey,
        content: savedNarrative?.content || '',
        supportingEvidenceText: savedNarrative?.supportingEvidenceText || '',
        lastModified: new Date()
      }
    });
  } catch (error) {
    console.error('Save narrative error:', error);
    return res.status(500).json({ error: 'Failed to save narrative' });
  }
};

/**
 * Submit a standard for validation
 */
export const submitStandard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Get all narratives for this standard from the Map
    const standardNarrativesMap = submission.narratives?.get(standardCode);
    const standardNarratives: Array<{ standardCode: string; specCode: string; content: string }> = [];

    if (standardNarrativesMap && standardNarrativesMap instanceof Map) {
      standardNarrativesMap.forEach((narrativeContent, specCode) => {
        standardNarratives.push({
          standardCode,
          specCode,
          content: narrativeContent.content || ''
        });
      });
    }

    if (standardNarratives.length === 0) {
      return res.status(400).json({
        error: 'No content found for this standard. Please add narrative content before submitting.'
      });
    }

    // Validate each specification
    const validationResults: any[] = [];
    const failedSpecs: any[] = [];

    for (const narrative of standardNarratives) {
      try {
        const result = await validationService.validateSection({
          submissionId,
          standardCode: narrative.standardCode,
          specCode: narrative.specCode,
          narrativeText: narrative.content,
          validationType: 'submit'
        });

        validationResults.push({
          standardCode: narrative.standardCode,
          specCode: narrative.specCode,
          result
        });

        // Track failures
        if (result.result?.status === 'fail') {
          failedSpecs.push({
            standardCode: narrative.standardCode,
            specCode: narrative.specCode,
            feedback: result.result.feedback,
            missingElements: result.result.missingElements
          });
        }
      } catch (err) {
        console.error('Validation error for spec:', narrative.specCode, err);
        failedSpecs.push({
          standardCode: narrative.standardCode,
          specCode: narrative.specCode,
          error: 'Validation failed'
        });
      }
    }

    // Update submission status (atomic $set creates the key if missing)
    if (failedSpecs.length === 0) {
      // All passed - mark as submitted (atomic $set bypasses Mongoose 8 Map bug)
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${standardCode}.status`]: 'submitted',
          [`standardsStatus.${standardCode}.validationStatus`]: 'pass',
          [`standardsStatus.${standardCode}.completionPercentage`]: 100,
          [`standardsStatus.${standardCode}.submittedAt`]: new Date(),
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        }}
      );

      void recordAuditEvent({
        action: 'submission.submit_standard',
        actor: {
          id: req.user!.id,
          role: req.user!.role,
          name: req.user!.name || req.user!.email
        },
        targetType: 'standard',
        targetId: `${submissionId}:${standardCode}`,
        submissionId,
        payload: { standardCode, passed: true, specCount: standardNarratives.length }
      });

      return res.json({
        success: true,
        message: `Standard ${standardCode} submitted successfully`,
        validationResults
      });
    } else {
      // Some failed - mark as in_progress with failures (atomic $set)
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${standardCode}.status`]: 'in_progress',
          [`standardsStatus.${standardCode}.validationStatus`]: 'fail',
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        }}
      );

      return res.status(400).json({
        success: false,
        message: 'Some specifications failed validation',
        failedSpecs,
        validationResults
      });
    }
  } catch (error) {
    console.error('Submit standard error:', error);
    return res.status(500).json({ error: 'Failed to submit standard' });
  }
};

/**
 * Revert a standard from `submitted` back to `in_progress` so the PC can
 * keep editing. Per CR-006 the per-standard submit must be reversible —
 * only the final-submit on the whole self-study triggers the lockout.
 */
export const revertStandard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Ownership check — only the PC submitter or admin may revert.
    if (
      submission.submitterId.toString() !== req.user!.id &&
      req.user!.role !== 'admin' &&
      !req.user!.isSuperuser
    ) {
      return res.status(403).json({ error: 'Not authorized to revert this standard' });
    }

    // The submissionLockout middleware already refuses if the whole self-study
    // has been final-submitted; we still defend against the per-standard
    // 'validated' state (means a reader has signed off) — that's not revertable
    // from this endpoint.
    const existing = submission.standardsStatus?.get(standardCode);
    if (existing?.status === 'validated') {
      return res.status(409).json({
        error: 'Standard has been validated by a reader and cannot be reverted by the PC'
      });
    }

    await Submission.updateOne(
      { _id: submission._id },
      {
        $set: {
          [`standardsStatus.${standardCode}.status`]: 'in_progress',
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        },
        $unset: {
          [`standardsStatus.${standardCode}.submittedAt`]: ''
        }
      }
    );

    void recordAuditEvent({
      action: 'submission.revert_standard',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: req.user!.name || req.user!.email
      },
      targetType: 'standard',
      targetId: `${submissionId}:${standardCode}`,
      submissionId,
      payload: { standardCode, previousStatus: existing?.status }
    });

    return res.json({
      success: true,
      message: `Standard ${standardCode} reverted to in_progress`
    });
  } catch (error) {
    console.error('Revert standard error:', error);
    return res.status(500).json({ error: 'Failed to revert standard' });
  }
};

/**
 * Revalidate failed sections only (incremental)
 */
export const revalidateFailed = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode } = req.body;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Get failed validation results
    const failedResults = await ValidationResult.find({
      submissionId,
      ...(standardCode && { standardCode }),
      'result.status': 'fail'
    }).sort({ createdAt: -1 });

    // Get unique failed specs
    const failedSpecsMap = new Map<string, any>();
    failedResults.forEach(result => {
      const key = `${result.standardCode}.${result.specCode}`;
      if (!failedSpecsMap.has(key)) {
        failedSpecsMap.set(key, result);
      }
    });

    if (failedSpecsMap.size === 0) {
      return res.json({
        message: 'No failed validations to revalidate',
        revalidatedCount: 0
      });
    }

    // Revalidate each failed spec
    const revalidationResults: any[] = [];
    let passCount = 0;
    let failCount = 0;

    for (const [key, failedResult] of failedSpecsMap) {
      // Get narrative from the Map format
      const standardNarrativesMap = submission.narratives?.get(failedResult.standardCode);
      const narrativeContent = standardNarrativesMap?.get(failedResult.specCode);

      if (!narrativeContent?.content) continue;

      try {
        const result = await validationService.validateSection({
          submissionId,
          standardCode: failedResult.standardCode,
          specCode: failedResult.specCode,
          narrativeText: narrativeContent.content,
          validationType: 'submit',
          previousValidationId: failedResult._id.toString()
        });

        revalidationResults.push({
          standardCode: failedResult.standardCode,
          specCode: failedResult.specCode,
          previousStatus: 'fail',
          newStatus: result.result?.status,
          result
        });

        if (result.result?.status === 'pass') {
          passCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Revalidation error:', err);
        failCount++;
      }
    }

    // Update standard status if all now pass (atomic $set bypasses Mongoose 8 Map bug)
    if (standardCode && failCount === 0 && passCount > 0) {
      await Submission.updateOne(
        { _id: submission._id },
        { $set: {
          [`standardsStatus.${standardCode}.status`]: 'submitted',
          [`standardsStatus.${standardCode}.validationStatus`]: 'pass',
          [`standardsStatus.${standardCode}.completionPercentage`]: 100,
          [`standardsStatus.${standardCode}.submittedAt`]: new Date(),
          [`standardsStatus.${standardCode}.lastModified`]: new Date()
        }}
      );
    }

    return res.json({
      message: 'Revalidation complete',
      revalidatedCount: revalidationResults.length,
      passed: passCount,
      failed: failCount,
      results: revalidationResults
    });
  } catch (error) {
    console.error('Revalidate failed error:', error);
    return res.status(500).json({ error: 'Failed to revalidate' });
  }
};

/**
 * Get failed validations for a submission
 */
export const getFailedValidations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode } = req.query;

    const filter: any = {
      submissionId,
      'result.status': 'fail'
    };

    if (standardCode) {
      filter.standardCode = standardCode;
    }

    const failedValidations = await ValidationResult.find(filter)
      .sort({ standardCode: 1, specCode: 1, createdAt: -1 });

    // Group by standard/spec and get latest
    const latestFailures = new Map<string, any>();
    failedValidations.forEach(v => {
      const key = `${v.standardCode}.${v.specCode}`;
      if (!latestFailures.has(key)) {
        latestFailures.set(key, v);
      }
    });

    return res.json(Array.from(latestFailures.values()));
  } catch (error) {
    console.error('Get failed validations error:', error);
    return res.status(500).json({ error: 'Failed to get failed validations' });
  }
};

/**
 * Mark a standard as complete (manual)
 */
export const markStandardComplete = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, standardCode } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Atomic $set bypasses Mongoose 8 Map bug
    await Submission.updateOne(
      { _id: submission._id },
      { $set: {
        [`standardsStatus.${standardCode}.status`]: 'complete',
        [`standardsStatus.${standardCode}.completionPercentage`]: 100,
        [`standardsStatus.${standardCode}.lastModified`]: new Date()
      }}
    );

    return res.json({
      message: `Standard ${standardCode} marked as complete`
    });
  } catch (error) {
    console.error('Mark standard complete error:', error);
    return res.status(500).json({ error: 'Failed to mark standard complete' });
  }
};

/**
 * List all submissions for current user
 */
export const listSubmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, limit = 10, offset = 0, institutionId } = req.query;

    const filter: any = {};

    // Filter by institution ID if provided
    if (institutionId) {
      filter.institutionId = institutionId;
    }

    // Filter by role — scope program coordinators to their own institution
    if (req.user?.role === 'program_coordinator') {
      if (!filter.institutionId && (req.user as any).institutionId) {
        filter.institutionId = (req.user as any).institutionId;
      }
    }

    // CR-007: readers + lead readers only see submissions whose status has
    // progressed beyond draft. Draft submissions are PC-only.
    // Admin + superuser are exempt.
    const isElevated = req.user?.role === 'admin' || (req.user as any)?.isSuperuser;
    if (!isElevated && (req.user?.role === 'reader' || req.user?.role === 'lead_reader')) {
      filter.status = {
        $in: ['submitted', 'under_review', 'readers_assigned', 'review_complete', 'compliant', 'non_compliant']
      };
    }

    // Filter by status (explicit query param overrides the role-based default)
    if (status) {
      filter.status = status;
    }

    const [submissions, total] = await Promise.all([
      Submission.find(filter)
        .select('submissionId institutionName programName programLevel status createdAt updatedAt standardsStatus readerLock')
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit)),
      Submission.countDocuments(filter)
    ]);

    return res.json({
      submissions,
      total,
      hasMore: Number(offset) + submissions.length < total
    });
  } catch (error) {
    console.error('List submissions error:', error);
    return res.status(500).json({ error: 'Failed to list submissions' });
  }
};

/**
 * Create a new submission
 */
export const createSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      institutionId,
      institutionName,
      programName,
      programLevel,
      type = 'initial'
    } = req.body;

    if (!institutionName || !programName) {
      return res.status(400).json({ error: 'Institution name and program name are required' });
    }

    // Initialize standards status for 21 standards
    const standardsStatus: Record<string, any> = {};
    for (let i = 1; i <= 21; i++) {
      standardsStatus[String(i)] = {
        status: 'not_started',
        completionPercentage: 0,
        lastModified: new Date()
      };
    }

    // Generate submissionId before creating (Mongoose validation runs before pre-save hooks)
    const year = new Date().getFullYear();
    const count = await Submission.countDocuments({
      submissionId: new RegExp(`^${year}-`)
    });
    const submissionId = `${year}-${String(count + 1).padStart(3, '0')}`;

    const submission = new Submission({
      submissionId,
      institutionId,
      institutionName,
      programName,
      programLevel: programLevel || 'bachelors',
      submitterId: req.user!.id,
      type,
      status: 'draft',
      standardsStatus,
      selfStudyProgress: {
        totalSections: 21,
        completedSections: 0,
        validatedSections: 0,
        passedSections: 0,
        failedSections: 0,
        lastActivity: new Date()
      }
    });

    await submission.save();

    // Link institution to this submission so evidence access works
    if (institutionId) {
      await Institution.findByIdAndUpdate(institutionId, {
        currentSubmissionId: submission._id
      });
    }

    return res.status(201).json({
      submission,
      message: 'Self-study created successfully'
    });
  } catch (error) {
    console.error('Create submission error:', error);
    return res.status(500).json({ error: 'Failed to create submission' });
  }
};

/**
 * Submit the entire self-study for review
 * - Requires all specs to be validated (pass)
 * - Locks the self-study (program coordinator becomes read-only)
 * - Notifies the lead reader
 */
export const submitSelfStudy = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check ownership - only the program coordinator who owns this can submit
    if (submission.submitterId.toString() !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to submit this self-study' });
    }

    // Check if already submitted
    if (submission.status === 'submitted' || submission.status === 'under_review') {
      return res.status(400).json({ error: 'Self-study has already been submitted' });
    }

    // Get the active spec to determine all required standards/specs
    const activeSpec = await Spec.findOne({ isActive: true });
    if (!activeSpec) {
      return res.status(400).json({ error: 'No active specification found' });
    }

    // Verify all specs are validated (pass)
    const standardsStatus = submission.standardsStatus || new Map();
    const missingValidations: string[] = [];

    for (const standard of activeSpec.standards) {
      for (const spec of standard.specifications || []) {
        const statusKey = `${standard.code}_${spec.code}`;
        const status = standardsStatus instanceof Map
          ? standardsStatus.get(statusKey)
          : standardsStatus[statusKey];

        if (!status || status.validationStatus !== 'pass') {
          missingValidations.push(`Standard ${standard.code}, Spec ${spec.code}`);
        }
      }
    }

    if (missingValidations.length > 0) {
      return res.status(400).json({
        error: 'All specifications must be validated before submitting',
        missingValidations: missingValidations.slice(0, 10), // Show first 10
        totalMissing: missingValidations.length
      });
    }

    // Update submission status
    submission.status = 'submitted';
    submission.submittedAt = new Date();

    // Lock the self-study (program coordinator can only read, not edit)
    submission.readerLock = {
      isLocked: true,
      lockedBy: undefined, // System lock, not a person
      lockedByName: 'System',
      lockedByRole: undefined,
      lockedAt: new Date(),
      lockReason: 'submission_complete'
    };

    await submission.save();

    // CR-006 audit trail — record the final-submit event with the optional
    // submission note the PC enters in the confirm modal.
    const submissionNote = typeof req.body?.submissionNote === 'string'
      ? String(req.body.submissionNote).trim().slice(0, 2000)
      : undefined;
    void recordAuditEvent({
      action: 'submission.final_submit',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: req.user!.name || req.user!.email
      },
      targetType: 'submission',
      targetId: submissionId,
      submissionId,
      payload: {
        institutionName: submission.institutionName,
        programLevel: submission.programLevel,
        submittedAt: submission.submittedAt
      },
      reason: submissionNote
    });

    // Notify lead reader if assigned
    if (submission.leadReader) {
      try {
        const leadReader = await User.findById(submission.leadReader);
        const submitter = await User.findById(submission.submitterId);

        if (leadReader && submitter) {
          const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
          await emailService.sendSelfStudySubmittedEmail({
            leadReaderName: leadReader.name,
            leadReaderEmail: leadReader.email,
            programName: submission.programName,
            institutionName: submission.institutionName,
            submitterName: submitter.name,
            submissionLink: `${baseUrl}/self-study/${submission._id}`,
            submittedAt: new Date()
          });
        }
      } catch (emailError) {
        console.error('Failed to send submission notification email:', emailError);
        // Don't fail the submission if email fails
      }
    }

    return res.json({
      message: 'Self-study submitted successfully',
      submission: {
        _id: submission._id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        readerLock: submission.readerLock
      }
    });
  } catch (error) {
    console.error('Submit self-study error:', error);
    return res.status(500).json({ error: 'Failed to submit self-study' });
  }
};
