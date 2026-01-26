import { Request, Response } from 'express';
import { Submission, ISubmission } from '../models/Submission';
import { ValidationResult } from '../models/ValidationResult';
import { ValidationService } from '../services/validationService';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
  };
}

const validationService = new ValidationService();

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

    return res.json(submission);
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
    const standardsStatus = submission.standardsStatus || {};
    const totalStandards = 21;
    let completedStandards = 0;
    let submittedStandards = 0;
    let validatedStandards = 0;
    let failedStandards = 0;

    Object.values(standardsStatus).forEach((status: any) => {
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
      standardsStatus,
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
    const { standardCode, specCode, content } = req.body;

    if (!standardCode || !content) {
      return res.status(400).json({ error: 'standardCode and content are required' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Find or create narrative entry
    const existingIndex = submission.narrativeContent?.findIndex(
      n => n.standardCode === standardCode && n.specCode === (specCode || '')
    ) ?? -1;

    if (existingIndex >= 0) {
      submission.narrativeContent![existingIndex].content = content;
      submission.narrativeContent![existingIndex].lastModified = new Date();
    } else {
      if (!submission.narrativeContent) {
        submission.narrativeContent = [];
      }
      submission.narrativeContent.push({
        standardCode,
        specCode: specCode || '',
        content,
        lastModified: new Date()
      });
    }

    // Update standard status to in_progress if not already complete
    if (!submission.standardsStatus) {
      submission.standardsStatus = {};
    }
    const statusKey = specCode ? `${standardCode}.${specCode}` : standardCode;
    if (!submission.standardsStatus[statusKey] ||
        submission.standardsStatus[statusKey].status === 'not_started') {
      submission.standardsStatus[statusKey] = {
        status: 'in_progress',
        validationStatus: 'pending'
      };
    }

    submission.markModified('narrativeContent');
    submission.markModified('standardsStatus');
    await submission.save();

    return res.json({
      message: 'Narrative saved successfully',
      narrative: submission.narrativeContent![
        existingIndex >= 0 ? existingIndex : submission.narrativeContent!.length - 1
      ]
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

    // Get all narratives for this standard
    const standardNarratives = submission.narrativeContent?.filter(
      n => n.standardCode === standardCode
    ) || [];

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

    // Update submission status
    if (!submission.standardsStatus) {
      submission.standardsStatus = {};
    }

    if (failedSpecs.length === 0) {
      // All passed - mark as submitted
      submission.standardsStatus[standardCode] = {
        status: 'submitted',
        validationStatus: 'pass',
        submittedAt: new Date()
      };
      submission.markModified('standardsStatus');
      await submission.save();

      return res.json({
        success: true,
        message: `Standard ${standardCode} submitted successfully`,
        validationResults
      });
    } else {
      // Some failed - mark as in_progress with failures
      submission.standardsStatus[standardCode] = {
        status: 'in_progress',
        validationStatus: 'fail'
      };
      submission.markModified('standardsStatus');
      await submission.save();

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
      const narrative = submission.narrativeContent?.find(
        n => n.standardCode === failedResult.standardCode &&
             n.specCode === failedResult.specCode
      );

      if (!narrative) continue;

      try {
        const result = await validationService.validateSection({
          submissionId,
          standardCode: failedResult.standardCode,
          specCode: failedResult.specCode,
          narrativeText: narrative.content,
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

    // Update standard status if all now pass
    if (standardCode && failCount === 0 && passCount > 0) {
      if (!submission.standardsStatus) {
        submission.standardsStatus = {};
      }
      submission.standardsStatus[standardCode] = {
        status: 'submitted',
        validationStatus: 'pass',
        submittedAt: new Date()
      };
      submission.markModified('standardsStatus');
      await submission.save();
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

    if (!submission.standardsStatus) {
      submission.standardsStatus = {};
    }

    submission.standardsStatus[standardCode] = {
      ...submission.standardsStatus[standardCode],
      status: 'complete'
    };

    submission.markModified('standardsStatus');
    await submission.save();

    return res.json({
      message: `Standard ${standardCode} marked as complete`,
      standardStatus: submission.standardsStatus[standardCode]
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

    // Filter by role
    if (req.user?.role === 'program_coordinator') {
      filter.coordinatorId = req.user.id;
    }

    // Filter by status
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

    const submission = new Submission({
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

    return res.status(201).json({
      submission,
      message: 'Self-study created successfully'
    });
  } catch (error) {
    console.error('Create submission error:', error);
    return res.status(500).json({ error: 'Failed to create submission' });
  }
};
