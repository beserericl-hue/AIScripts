import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review, IReview, ComplianceStatus } from '../models/Review';
import { Submission } from '../models/Submission';
import { User } from '../models/User';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    firstName?: string;
    lastName?: string;
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

    // Find or create standard assessment
    let standardAssessment = review.assessments.find(a => a.standardCode === standardCode);
    if (!standardAssessment) {
      standardAssessment = {
        standardCode,
        specifications: [],
        isComplete: false
      };
      review.assessments.push(standardAssessment);
    }

    // Find or create specification assessment
    let specAssessment = standardAssessment.specifications.find(s => s.specCode === specCode);
    if (!specAssessment) {
      specAssessment = {
        specCode,
        compliance: null,
        comments: ''
      };
      standardAssessment.specifications.push(specAssessment);
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
      let standardAssessment = review.assessments.find(a => a.standardCode === item.standardCode);
      if (!standardAssessment) {
        standardAssessment = {
          standardCode: item.standardCode,
          specifications: [],
          isComplete: false
        };
        review.assessments.push(standardAssessment);
      }

      let specAssessment = standardAssessment.specifications.find(s => s.specCode === item.specCode);
      if (!specAssessment) {
        specAssessment = {
          specCode: item.specCode,
          compliance: null,
          comments: ''
        };
        standardAssessment.specifications.push(specAssessment);
      }

      specAssessment.compliance = item.compliance;
      if (item.comments !== undefined) {
        specAssessment.comments = item.comments;
      }
      specAssessment.reviewedAt = new Date();
    }

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
    const { readerIds } = req.body; // Array of user IDs

    if (req.user?.role !== 'admin' && req.user?.role !== 'lead_reader') {
      return res.status(403).json({ error: 'Not authorized to assign readers' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
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
    submission.assignedReaders = readerIds.map(id => new mongoose.Types.ObjectId(id));
    submission.status = 'readers_assigned';
    await submission.save();

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
 * Get all reviews for a submission (for lead reader or admin)
 */
export const getSubmissionReviews = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

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
