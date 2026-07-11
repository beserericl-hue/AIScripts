import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review, IReview, ComplianceStatus } from '../models/Review';
import { Submission } from '../models/Submission';
import { User } from '../models/User';
import { Assignment } from '../models/Assignment';
import { recordAuditEvent } from '../services/auditLog';
import { notify } from '../services/notificationService';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
  };
}

/**
 * Get all reviews assigned to the current reader
 */
export const getMyReviews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, programLevel } = req.query;

    const query: any = { reviewerId: new mongoose.Types.ObjectId(req.user?.id) };

    if (status) {
      query.status = status;
    }

    if (programLevel) {
      query.programLevel = programLevel;
    }

    const reviews = await Review.find(query)
      .sort({ assignedAt: -1 })
      .select('-assessments'); // Exclude detailed assessments for list view

    const reviewsWithProgress = reviews.map(review => ({
      id: review._id,
      submissionId: review.submissionId,
      institutionName: review.institutionName,
      programName: review.programName,
      programLevel: review.programLevel,
      status: review.status,
      reviewerNumber: review.reviewerNumber,
      totalReviewers: review.totalReviewers,
      progress: review.progress,
      completionPercentage: review.getCompletionPercentage(),
      assignedAt: review.assignedAt,
      startedAt: review.startedAt,
      completedAt: review.completedAt
    }));

    return res.json({ reviews: reviewsWithProgress });
  } catch (error) {
    console.error('Get my reviews error:', error);
    return res.status(500).json({ error: 'Failed to get reviews' });
  }
};

/**
 * Get a specific review with full details
 */
export const getReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .populate('reviewerId', 'firstName lastName email')
      .populate('submissionId', 'submissionId documents narratives');

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // SECURITY (cross-tenant isolation) — gate on the parent submission. The
    // reviewer reading their OWN review still passes via their active Assignment.
    const _sub = await requireSubmissionAccess(req as any, res, String((review.submissionId as any)?._id || review.submissionId));
    if (!_sub) return;

    // Check authorization (only assigned reader or admin can view)
    if (
      review.reviewerId._id.toString() !== req.user?.id &&
      req.user?.role !== 'admin' &&
      req.user?.role !== 'lead_reader'
    ) {
      return res.status(403).json({ error: 'Not authorized to view this review' });
    }

    return res.json({ review });
  } catch (error) {
    console.error('Get review error:', error);
    return res.status(500).json({ error: 'Failed to get review' });
  }
};

/**
 * Get review workspace data (submission + review for side-by-side view)
 */
export const getReviewWorkspace = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // SECURITY (cross-tenant isolation) — gate on the parent submission. The
    // reviewer accessing their OWN review still passes via their active Assignment.
    const _sub = await requireSubmissionAccess(req as any, res, String((review.submissionId as any)?._id || review.submissionId));
    if (!_sub) return;

    // Check authorization
    if (
      review.reviewerId.toString() !== req.user?.id &&
      req.user?.role !== 'admin' &&
      req.user?.role !== 'lead_reader'
    ) {
      return res.status(403).json({ error: 'Not authorized to access this review' });
    }

    const submission = await Submission.findById(review.submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    return res.json({
      review: {
        id: review._id,
        status: review.status,
        reviewerNumber: review.reviewerNumber,
        totalReviewers: review.totalReviewers,
        reviewDate: review.reviewDate,
        assessments: review.assessments,
        finalAssessment: review.finalAssessment,
        progress: review.progress,
        bookmarkedItems: review.bookmarkedItems,
        lastAutoSave: review.lastAutoSave
      },
      submission: {
        id: submission._id,
        submissionId: submission.submissionId,
        institutionName: submission.institutionName,
        programName: submission.programName,
        programLevel: submission.programLevel,
        narratives: submission.narratives,
        documents: submission.documents
      }
    });
  } catch (error) {
    console.error('Get review workspace error:', error);
    return res.status(500).json({ error: 'Failed to get review workspace' });
  }
};

/**
 * Save assessment for a specification (auto-save or manual)
 */
export const saveAssessment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { standardCode, specCode, compliance, comments, isAutoSave } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check authorization
    if (review.reviewerId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to modify this review' });
    }

    // Check if review is still editable
    if (review.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify a submitted review' });
    }

    // Find or create standard assessment. NOTE: after pushing a plain object to
    // a Mongoose DocumentArray, Mongoose stores a *cast copy* — mutating the
    // original object no longer affects the stored subdocument. So we re-read the
    // just-pushed subdoc from the array and mutate THAT. (Previously, the 2nd+
    // spec scored under a standard was written to a throwaway object and the
    // stored subdoc kept compliance=null, so the review never became submittable.)
    let standardAssessment = review.assessments.find(a => a.standardCode === standardCode);
    if (!standardAssessment) {
      review.assessments.push({ standardCode, specifications: [], isComplete: false });
      standardAssessment = review.assessments[review.assessments.length - 1];
    }

    // Find or create specification assessment (same cast-on-push rule).
    let specAssessment = standardAssessment.specifications.find(s => s.specCode === specCode);
    if (!specAssessment) {
      standardAssessment.specifications.push({ specCode, compliance: null, comments: '' });
      specAssessment = standardAssessment.specifications[standardAssessment.specifications.length - 1];
    }

    // Update the assessment
    if (compliance !== undefined) {
      specAssessment.compliance = compliance as ComplianceStatus;
    }
    if (comments !== undefined) {
      specAssessment.comments = comments;
    }
    specAssessment.reviewedAt = new Date();

    // Update auto-save timestamp
    if (isAutoSave) {
      review.lastAutoSave = new Date();
    }

    // Each call mutates a nested subdocument array
    // (assessments[].specifications[]). Mark the path dirty so Mongoose persists
    // pushes INTO an already-existing standard's specifications array — without
    // this, the 2nd+ spec scored under a standard is silently dropped on save
    // (only the first spec per standard, which rides in with the standard
    // subdoc push, survived), so a reader could never complete/submit a review.
    review.markModified('assessments');
    // Increment draft version
    review.draftVersion += 1;

    await review.save();

    return res.json({
      success: true,
      progress: review.progress,
      completionPercentage: review.getCompletionPercentage(),
      lastAutoSave: review.lastAutoSave
    });
  } catch (error) {
    console.error('Save assessment error:', error);
    return res.status(500).json({ error: 'Failed to save assessment' });
  }
};

/**
 * Bulk save assessments (for marking multiple as compliant/non-compliant)
 */
export const bulkSaveAssessments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { assessments } = req.body; // Array of { standardCode, specCode, compliance, comments }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check authorization
    if (review.reviewerId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to modify this review' });
    }

    if (review.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify a submitted review' });
    }

    for (const item of assessments) {
      // Re-read the pushed subdoc after push (Mongoose cast-on-push — see
      // saveAssessment) so mutations land on the stored subdocument.
      let standardAssessment = review.assessments.find(a => a.standardCode === item.standardCode);
      if (!standardAssessment) {
        review.assessments.push({ standardCode: item.standardCode, specifications: [], isComplete: false });
        standardAssessment = review.assessments[review.assessments.length - 1];
      }

      let specAssessment = standardAssessment.specifications.find(s => s.specCode === item.specCode);
      if (!specAssessment) {
        standardAssessment.specifications.push({ specCode: item.specCode, compliance: null, comments: '' });
        specAssessment = standardAssessment.specifications[standardAssessment.specifications.length - 1];
      }

      specAssessment.compliance = item.compliance;
      if (item.comments !== undefined) {
        specAssessment.comments = item.comments;
      }
      specAssessment.reviewedAt = new Date();
    }

    // Persist pushes into nested specifications arrays (see saveAssessment).
    review.markModified('assessments');
    review.draftVersion += 1;
    await review.save();

    return res.json({
      success: true,
      updatedCount: assessments.length,
      progress: review.progress,
      completionPercentage: review.getCompletionPercentage()
    });
  } catch (error) {
    console.error('Bulk save error:', error);
    return res.status(500).json({ error: 'Failed to bulk save assessments' });
  }
};

/**
 * Save final assessment
 */
export const saveFinalAssessment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const {
      recommendation,
      conditionDetails,
      denyExplanation,
      holdExplanation,
      programStrengths,
      programWeaknesses,
      additionalComments
    } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check authorization
    if (review.reviewerId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to modify this review' });
    }

    if (review.status === 'submitted') {
      return res.status(400).json({ error: 'Cannot modify a submitted review' });
    }

    // Update final assessment
    if (recommendation !== undefined) {
      review.finalAssessment.recommendation = recommendation;
    }
    if (conditionDetails !== undefined) {
      review.finalAssessment.conditionDetails = conditionDetails;
    }
    if (denyExplanation !== undefined) {
      review.finalAssessment.denyExplanation = denyExplanation;
    }
    if (holdExplanation !== undefined) {
      review.finalAssessment.holdExplanation = holdExplanation;
    }
    if (programStrengths !== undefined) {
      review.finalAssessment.programStrengths = programStrengths;
    }
    if (programWeaknesses !== undefined) {
      review.finalAssessment.programWeaknesses = programWeaknesses;
    }
    if (additionalComments !== undefined) {
      review.finalAssessment.additionalComments = additionalComments;
    }

    review.draftVersion += 1;
    await review.save();

    return res.json({
      success: true,
      finalAssessment: review.finalAssessment
    });
  } catch (error) {
    console.error('Save final assessment error:', error);
    return res.status(500).json({ error: 'Failed to save final assessment' });
  }
};

/**
 * Toggle bookmark on a specification
 */
export const toggleBookmark = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { standardCode, specCode } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to modify this review' });
    }

    const bookmarkKey = `${standardCode}.${specCode}`;
    const index = review.bookmarkedItems.indexOf(bookmarkKey);

    if (index === -1) {
      review.bookmarkedItems.push(bookmarkKey);
    } else {
      review.bookmarkedItems.splice(index, 1);
    }

    await review.save();

    return res.json({
      success: true,
      bookmarked: index === -1,
      bookmarkedItems: review.bookmarkedItems
    });
  } catch (error) {
    console.error('Toggle bookmark error:', error);
    return res.status(500).json({ error: 'Failed to toggle bookmark' });
  }
};

/**
 * Flag a specification for follow-up
 */
export const flagSpecification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { standardCode, specCode, flagged, reason } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to modify this review' });
    }

    const standardAssessment = review.assessments.find(a => a.standardCode === standardCode);
    if (!standardAssessment) {
      return res.status(404).json({ error: 'Standard assessment not found' });
    }

    const specAssessment = standardAssessment.specifications.find(s => s.specCode === specCode);
    if (!specAssessment) {
      return res.status(404).json({ error: 'Specification assessment not found' });
    }

    specAssessment.flagged = flagged;
    specAssessment.flagReason = reason;

    await review.save();

    return res.json({ success: true, flagged });
  } catch (error) {
    console.error('Flag specification error:', error);
    return res.status(500).json({ error: 'Failed to flag specification' });
  }
};

/**
 * Mark standard as complete
 */
export const markStandardComplete = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { standardCode, isComplete } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to modify this review' });
    }

    const standardAssessment = review.assessments.find(a => a.standardCode === standardCode);
    if (!standardAssessment) {
      return res.status(404).json({ error: 'Standard assessment not found' });
    }

    standardAssessment.isComplete = isComplete;
    if (isComplete) {
      standardAssessment.completedAt = new Date();
    }

    await review.save();

    return res.json({ success: true, isComplete });
  } catch (error) {
    console.error('Mark standard complete error:', error);
    return res.status(500).json({ error: 'Failed to mark standard complete' });
  }
};

/**
 * Submit completed review
 */
export const submitReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { signature } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    if (review.reviewerId.toString() !== req.user?.id) {
      return res.status(403).json({ error: 'Not authorized to submit this review' });
    }

    if (review.status === 'submitted') {
      return res.status(400).json({ error: 'Review already submitted' });
    }

    // Check if ready for submission
    const readiness = review.isReadyForSubmission();
    if (!readiness.ready) {
      return res.status(400).json({
        error: 'Review is not complete',
        missingItems: readiness.missingItems
      });
    }

    // Update review status
    review.status = 'submitted';
    review.finalAssessment.isComplete = true;
    review.finalAssessment.signature = signature || `${req.user?.firstName} ${req.user?.lastName}`;
    review.finalAssessment.signedAt = new Date();
    review.completedAt = new Date();
    review.submittedAt = new Date();

    await review.save();

    // Update submission status
    await Submission.findByIdAndUpdate(review.submissionId, {
      $set: { status: 'under_review' }
    });

    return res.json({
      success: true,
      message: 'Review submitted successfully',
      submittedAt: review.submittedAt
    });
  } catch (error) {
    console.error('Submit review error:', error);
    return res.status(500).json({ error: 'Failed to submit review' });
  }
};

/**
 * Get review progress summary
 */
export const getReviewProgress = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // SECURITY (cross-tenant isolation) — gate on the parent submission. The
    // reviewer reading their OWN review still passes via their active Assignment.
    const _sub = await requireSubmissionAccess(req as any, res, String((review.submissionId as any)?._id || review.submissionId));
    if (!_sub) return;

    // Build detailed progress by standard
    const standardProgress = review.assessments.map(assessment => {
      const total = assessment.specifications.length;
      const reviewed = assessment.specifications.filter(s => s.compliance !== null).length;
      const compliant = assessment.specifications.filter(s => s.compliance === 'compliant').length;
      const nonCompliant = assessment.specifications.filter(s => s.compliance === 'non_compliant').length;

      return {
        standardCode: assessment.standardCode,
        total,
        reviewed,
        compliant,
        nonCompliant,
        percentComplete: total > 0 ? Math.round((reviewed / total) * 100) : 0,
        isComplete: assessment.isComplete
      };
    });

    return res.json({
      overall: review.progress,
      completionPercentage: review.getCompletionPercentage(),
      byStandard: standardProgress,
      bookmarkedCount: review.bookmarkedItems.length,
      readiness: review.isReadyForSubmission()
    });
  } catch (error) {
    console.error('Get review progress error:', error);
    return res.status(500).json({ error: 'Failed to get review progress' });
  }
};

/**
 * Admin: Assign readers to a submission
 */
export const assignReaders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { readerIds, reason } = req.body; // Array of user IDs

    if (req.user?.role !== 'admin' && req.user?.role !== 'lead_reader') {
      return res.status(403).json({ error: 'Not authorized to assign readers' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // CR-022 / Sprint 6 — assignment lockout after submit.
    // Once a submission reaches `submitted` or further, only admin may
    // change reader assignments, and the change requires a reason for
    // the audit trail. Lead readers must request a change from an admin.
    // Superuser bypasses the role check (impersonation/break-glass) but
    // still requires the reason.
    const LOCKED_STATUSES = ['submitted', 'under_review', 'readers_assigned', 'review_complete', 'compliant', 'non_compliant'];
    const isLockedPhase = LOCKED_STATUSES.includes(submission.status);
    if (isLockedPhase) {
      const isElevated = req.user?.role === 'admin' || (req.user as any)?.isSuperuser === true;
      if (!isElevated) {
        return res.status(403).json({
          error: 'Reader assignments are locked after submission. Request a change from an administrator.'
        });
      }
      if (!reason || typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({
          error: 'A reason is required to change reader assignments on a submitted self-study.'
        });
      }
    }

    // Validate all readers exist and have reader role
    const readers = await User.find({
      _id: { $in: readerIds },
      role: { $in: ['reader', 'lead_reader'] },
      isActive: true
    });

    if (readers.length !== readerIds.length) {
      return res.status(400).json({ error: 'Some reader IDs are invalid' });
    }

    const createdReviews: IReview[] = [];
    const totalReviewers = readerIds.length;

    for (let i = 0; i < readerIds.length; i++) {
      // Check if review already exists
      const existingReview = await Review.findOne({
        submissionId: new mongoose.Types.ObjectId(submissionId),
        reviewerId: new mongoose.Types.ObjectId(readerIds[i])
      });

      if (existingReview) {
        continue; // Skip if already assigned
      }

      const review = new Review({
        submissionId: new mongoose.Types.ObjectId(submissionId),
        reviewerId: new mongoose.Types.ObjectId(readerIds[i]),
        reviewerNumber: i + 1,
        totalReviewers,
        institutionName: submission.institutionName,
        programName: submission.programName,
        programLevel: submission.programLevel,
        status: 'assigned'
      });

      await review.save();
      createdReviews.push(review);
    }

    // Update submission
    const priorStatus = submission.status;
    submission.assignedReaders = readerIds.map(id => new mongoose.Types.ObjectId(id));
    submission.status = 'readers_assigned';
    // CR-055 — record the lead reader on the submission when one is in the
    // batch (drives the submit-time notification + the compilation lead id).
    const leadUser = readers.find((r) => r.role === 'lead_reader');
    if (leadUser) {
      submission.leadReader = leadUser._id as mongoose.Types.ObjectId;
    }
    await submission.save();

    // CR-055 — Assignment is the access source-of-truth: listSubmissions,
    // getSubmission and getFinalScoresForReader all gate reader-shaped roles
    // on an ACTIVE Assignment record. assignReaders historically created only
    // Review docs + submission.assignedReaders, so an assigned reader still
    // 403'd on every read path (empty dashboard, "not assigned" on open).
    // Reconcile Assignment docs to the new reader set here: mark dropped
    // readers removed, then activate/refresh one Assignment per assigned user.
    const assignerName =
      req.user!.name || req.user!.email || `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim();
    const leadName = leadUser ? `${leadUser.firstName} ${leadUser.lastName}`.trim() : undefined;
    await Assignment.updateMany(
      {
        submissionId: submission._id,
        status: 'active',
        userId: { $nin: readers.map((r) => r._id) }
      },
      {
        $set: {
          status: 'removed',
          removedAt: new Date(),
          removedBy: new mongoose.Types.ObjectId(req.user!.id),
          removalReason: isLockedPhase ? String(reason || '').trim() || 'reassigned' : 'reassigned'
        }
      }
    );
    for (const r of readers) {
      const assignmentType = r.role === 'lead_reader' ? 'lead_reader' : 'reader';
      const userName = `${r.firstName} ${r.lastName}`.trim();
      const existing = await Assignment.findOne({
        submissionId: submission._id,
        userId: r._id,
        status: 'active'
      });
      if (existing) {
        existing.assignmentType = assignmentType;
        if (leadUser) {
          existing.leadReaderId = leadUser._id as mongoose.Types.ObjectId;
          existing.leadReaderName = leadName;
        }
        await existing.save();
        continue;
      }
      await Assignment.create({
        submissionId: submission._id,
        institutionId: submission.institutionId,
        institutionName: submission.institutionName,
        userId: r._id,
        userName,
        userEmail: r.email,
        assignmentType,
        assignedBy: new mongoose.Types.ObjectId(req.user!.id),
        assignedByName: assignerName,
        assignedByRole: req.user!.role,
        status: 'active',
        leadReaderId: leadUser ? (leadUser._id as mongoose.Types.ObjectId) : undefined,
        leadReaderName: leadName
      });
    }

    // CR-006 S2A.1 — record reader assignment per reader (one entry each so
    // the timeline shows who and when, not a single fan-out blob).
    // CR-022 — on a locked-phase change, attach the required reason + the
    // submission status at the moment of the change.
    for (const r of readers) {
      void recordAuditEvent({
        action: 'reader.assigned',
        actor: {
          id: req.user!.id,
          role: req.user!.role,
          name: req.user!.name || req.user!.email || `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim()
        },
        targetType: 'submission',
        targetId: submissionId,
        submissionId,
        payload: {
          readerId: (r as any)._id?.toString?.() || String((r as any)._id),
          readerName: (r as any).name,
          readerRole: (r as any).role,
          totalReviewers,
          submissionStatusAtChange: priorStatus,
          lockedPhase: isLockedPhase
        },
        reason: isLockedPhase ? String(reason || '').trim() : undefined
      });
    }

    // CR-010 / S12.2 — notify each assigned reader. Fail-soft; dedupeKey is
    // per (submission, reader) so a re-assign of the same reader doesn't spam.
    void (async () => {
      for (const r of readers) {
        try {
          await notify({
            recipientId: String((r as any)._id),
            type: 'reader.assignment',
            title: 'You were assigned to a review',
            body: `${submission.institutionName} — ${submission.programName}: you were assigned as a reviewer.`,
            link: `/reader/${submissionId}`,
            submissionId,
            dedupeKey: `reader.assignment:${submissionId}:${String((r as any)._id)}`,
            email: true,
          });
        } catch (e) {
          console.error('assignReaders notify (non-fatal):', e);
        }
      }
    })();

    return res.json({
      success: true,
      assignedCount: createdReviews.length,
      totalReviewers
    });
  } catch (error) {
    console.error('Assign readers error:', error);
    return res.status(500).json({ error: 'Failed to assign readers' });
  }
};

/**
 * CR-022 / S13c — lead-reader "Request change from admin" affordance.
 *
 * Once a submission is in a locked phase, lead readers cannot re-assign
 * readers (see `assignReaders` — they get a 403). The governed path is to
 * ask an admin. This endpoint records that ask: it audit-logs the request
 * and notifies every active admin. It performs NO assignment mutation — the
 * admin acts on the request via the normal (reason-gated) assign flow.
 */
export const requestAssignmentChange = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { reason } = req.body;

    // Only lead readers use this affordance. Admins don't need to ask
    // themselves; plain readers have no assignment authority to begin with.
    if (req.user?.role !== 'lead_reader') {
      return res.status(403).json({ error: 'Only a lead reader can request an assignment change.' });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'A reason is required to request an assignment change.' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const requesterName =
      req.user!.name || req.user!.email || `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim();
    const trimmedReason = String(reason).trim();

    // Append-only audit entry so the timeline shows who asked, when, and why.
    void recordAuditEvent({
      action: 'reader.assignment_change_requested',
      actor: {
        id: req.user!.id,
        role: req.user!.role,
        name: requesterName,
      },
      targetType: 'submission',
      targetId: submissionId,
      submissionId,
      payload: {
        submissionStatusAtRequest: submission.status,
      },
      reason: trimmedReason,
    });

    // Notify every active admin. Fail-soft; dedupeKey is per (admin,
    // submission, requester) so repeated asks from the same lead reader on the
    // same submission don't spam — admins see one actionable nudge.
    void (async () => {
      try {
        const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
        for (const a of admins) {
          try {
            await notify({
              recipientId: String((a as any)._id),
              type: 'reader.assignment_change_requested',
              title: 'A lead reader requested an assignment change',
              body: `${submission.institutionName} — ${submission.programName}: ${requesterName} asked you to change reader assignments. Reason: ${trimmedReason}`,
              link: `/admin/submissions/${submissionId}`,
              submissionId,
              dedupeKey: `reader.assignment_change_requested:${submissionId}:${req.user!.id}`,
              email: true,
            });
          } catch (e) {
            console.error('requestAssignmentChange notify (non-fatal):', e);
          }
        }
      } catch (e) {
        console.error('requestAssignmentChange admin lookup (non-fatal):', e);
      }
    })();

    return res.json({ success: true });
  } catch (error) {
    console.error('Request assignment change error:', error);
    return res.status(500).json({ error: 'Failed to request an assignment change' });
  }
};

/**
 * Get all reviews for a submission (for lead reader or admin)
 */
export const getSubmissionReviews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    // SECURITY (cross-tenant isolation) — gate on the submission first.
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId);
    if (!_sub) return;

    if (req.user?.role !== 'admin' && req.user?.role !== 'lead_reader') {
      return res.status(403).json({ error: 'Not authorized to view all reviews' });
    }

    const reviews = await Review.find({ submissionId: new mongoose.Types.ObjectId(submissionId) })
      .populate('reviewerId', 'firstName lastName email')
      .sort({ reviewerNumber: 1 });

    const reviewSummaries = reviews.map(review => ({
      id: review._id,
      reviewerId: review.reviewerId,
      reviewerNumber: review.reviewerNumber,
      status: review.status,
      progress: review.progress,
      completionPercentage: review.getCompletionPercentage(),
      finalRecommendation: review.finalAssessment.recommendation,
      assignedAt: review.assignedAt,
      startedAt: review.startedAt,
      completedAt: review.completedAt,
      submittedAt: review.submittedAt
    }));

    return res.json({
      submissionId,
      totalReviewers: reviews.length,
      completedCount: reviews.filter(r => r.status === 'submitted').length,
      reviews: reviewSummaries
    });
  } catch (error) {
    console.error('Get submission reviews error:', error);
    return res.status(500).json({ error: 'Failed to get submission reviews' });
  }
};
