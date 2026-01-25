import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { LeadReaderCompilation } from '../models/LeadReaderCompilation';
import { Review } from '../models/Review';
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
 * Get all compilations assigned to the current lead reader
 */
export const getMyCompilations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;

    const query: any = { leadReaderId: new mongoose.Types.ObjectId(req.user?.id) };

    if (status) {
      query.status = status;
    }

    const compilations = await LeadReaderCompilation.find(query)
      .sort({ lastActivity: -1 })
      .select('-compiledAssessments -commentThreads'); // Exclude large fields for list view

    const compilationSummaries = compilations.map(c => ({
      id: c._id,
      submissionId: c.submissionId,
      institutionName: c.institutionName,
      programName: c.programName,
      programLevel: c.programLevel,
      status: c.status,
      totalReaders: c.totalReaders,
      completedReviews: c.completedReviews,
      complianceStatistics: c.finalCompilation.complianceStatistics,
      lastActivity: c.lastActivity,
      startedAt: c.startedAt,
      submittedAt: c.submittedAt
    }));

    return res.json({ compilations: compilationSummaries });
  } catch (error) {
    console.error('Get my compilations error:', error);
    return res.status(500).json({ error: 'Failed to get compilations' });
  }
};

/**
 * Get submissions ready for lead reader compilation
 */
export const getReadyForCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'lead_reader' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Find submissions where all reviews are submitted
    const submissionsWithReviews = await Submission.aggregate([
      { $match: { status: { $in: ['readers_assigned', 'under_review', 'review_complete'] } } },
      {
        $lookup: {
          from: 'reviews',
          localField: '_id',
          foreignField: 'submissionId',
          as: 'reviews'
        }
      },
      {
        $addFields: {
          totalReviews: { $size: '$reviews' },
          submittedReviews: {
            $size: {
              $filter: {
                input: '$reviews',
                cond: { $eq: ['$$this.status', 'submitted'] }
              }
            }
          }
        }
      },
      {
        $match: {
          totalReviews: { $gt: 0 },
          $expr: { $eq: ['$totalReviews', '$submittedReviews'] }
        }
      },
      {
        $project: {
          submissionId: 1,
          institutionName: 1,
          programName: 1,
          programLevel: 1,
          status: 1,
          totalReviews: 1,
          submittedReviews: 1,
          leadReader: 1,
          updatedAt: 1
        }
      }
    ]);

    // Check which ones already have compilations
    const compilationIds = await LeadReaderCompilation.find({})
      .select('submissionId')
      .lean();
    const compiledSubmissionIds = new Set(compilationIds.map(c => c.submissionId.toString()));

    const readySubmissions = submissionsWithReviews.map(s => ({
      ...s,
      hasCompilation: compiledSubmissionIds.has(s._id.toString())
    }));

    return res.json({ submissions: readySubmissions });
  } catch (error) {
    console.error('Get ready for compilation error:', error);
    return res.status(500).json({ error: 'Failed to get submissions' });
  }
};

/**
 * Create or get compilation for a submission
 */
export const createOrGetCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    if (req.user?.role !== 'lead_reader' && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Check if compilation already exists
    let compilation = await LeadReaderCompilation.findOne({
      submissionId: new mongoose.Types.ObjectId(submissionId)
    });

    if (compilation) {
      return res.json({ compilation, created: false });
    }

    // Get submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Get all submitted reviews
    const reviews = await Review.find({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      status: 'submitted'
    });

    if (reviews.length === 0) {
      return res.status(400).json({ error: 'No submitted reviews found for this submission' });
    }

    // Create compilation
    compilation = new LeadReaderCompilation({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      leadReaderId: new mongoose.Types.ObjectId(req.user?.id),
      institutionName: submission.institutionName,
      programName: submission.programName,
      programLevel: submission.programLevel,
      reviews: reviews.map(r => r._id),
      totalReaders: reviews.length,
      startedAt: new Date()
    });

    // Aggregate reader votes
    await compilation.aggregateReaderVotes();
    compilation.calculateStatistics();

    await compilation.save();

    // Update submission
    submission.leadReader = new mongoose.Types.ObjectId(req.user?.id);
    submission.status = 'review_complete';
    await submission.save();

    return res.json({ compilation, created: true });
  } catch (error) {
    console.error('Create compilation error:', error);
    return res.status(500).json({ error: 'Failed to create compilation' });
  }
};

/**
 * Get full compilation details
 */
export const getCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;

    const compilation = await LeadReaderCompilation.findById(compilationId)
      .populate('leadReaderId', 'firstName lastName email')
      .populate('reviews', 'reviewerId reviewerNumber status progress');

    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    // Check authorization
    if (
      compilation.leadReaderId._id.toString() !== req.user?.id &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Not authorized to view this compilation' });
    }

    return res.json({ compilation });
  } catch (error) {
    console.error('Get compilation error:', error);
    return res.status(500).json({ error: 'Failed to get compilation' });
  }
};

/**
 * Get side-by-side comparison of reader assessments
 */
export const getComparisonView = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const { standardCode, showDisagreementsOnly } = req.query;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    let assessments = compilation.compiledAssessments;

    // Filter by standard if specified
    if (standardCode) {
      assessments = assessments.filter(a => a.standardCode === standardCode);
    }

    // Filter to show only disagreements if specified
    if (showDisagreementsOnly === 'true') {
      assessments = assessments.map(a => ({
        ...a,
        specifications: a.specifications.filter(s => s.hasDisagreement)
      })).filter(a => a.specifications.length > 0);
    }

    return res.json({
      assessments,
      statistics: compilation.finalCompilation.complianceStatistics,
      totalDisagreements: compilation.getDisagreements().length
    });
  } catch (error) {
    console.error('Get comparison view error:', error);
    return res.status(500).json({ error: 'Failed to get comparison view' });
  }
};

/**
 * Get all disagreements across the compilation
 */
export const getDisagreements = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    const disagreements = compilation.getDisagreements();

    return res.json({
      count: disagreements.length,
      disagreements
    });
  } catch (error) {
    console.error('Get disagreements error:', error);
    return res.status(500).json({ error: 'Failed to get disagreements' });
  }
};

/**
 * Set final determination for a specification
 */
export const setFinalDetermination = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const { standardCode, specCode, determination, notes } = req.body;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    if (compilation.leadReaderId.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to modify this compilation' });
    }

    if (compilation.status === 'submitted' || compilation.status === 'approved') {
      return res.status(400).json({ error: 'Cannot modify a submitted compilation' });
    }

    // Find the specification
    const standardAssessment = compilation.compiledAssessments.find(
      a => a.standardCode === standardCode
    );
    if (!standardAssessment) {
      return res.status(404).json({ error: 'Standard not found' });
    }

    const specCompilation = standardAssessment.specifications.find(
      s => s.specCode === specCode
    );
    if (!specCompilation) {
      return res.status(404).json({ error: 'Specification not found' });
    }

    specCompilation.finalDetermination = determination;
    specCompilation.leadReaderNotes = notes;
    specCompilation.determinedAt = new Date();

    compilation.lastActivity = new Date();
    await compilation.save();

    // Recalculate statistics
    compilation.calculateStatistics();
    await compilation.save();

    return res.json({
      success: true,
      statistics: compilation.finalCompilation.complianceStatistics
    });
  } catch (error) {
    console.error('Set final determination error:', error);
    return res.status(500).json({ error: 'Failed to set final determination' });
  }
};

/**
 * Bulk set final determinations (use consensus for all)
 */
export const bulkSetDeterminations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const { useConsensus, standardCodes } = req.body;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    if (compilation.leadReaderId.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    let updatedCount = 0;

    for (const assessment of compilation.compiledAssessments) {
      if (standardCodes && !standardCodes.includes(assessment.standardCode)) {
        continue;
      }

      for (const spec of assessment.specifications) {
        if (useConsensus && spec.consensusCompliance && !spec.finalDetermination) {
          spec.finalDetermination = spec.consensusCompliance;
          spec.determinedAt = new Date();
          updatedCount++;
        }
      }
    }

    compilation.lastActivity = new Date();
    compilation.calculateStatistics();
    await compilation.save();

    return res.json({
      success: true,
      updatedCount,
      statistics: compilation.finalCompilation.complianceStatistics
    });
  } catch (error) {
    console.error('Bulk set determinations error:', error);
    return res.status(500).json({ error: 'Failed to bulk set determinations' });
  }
};

/**
 * Save final compilation (strengths, weaknesses, recommendation)
 */
export const saveFinalCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const {
      finalRecommendation,
      conditionDetails,
      finalStrengths,
      finalWeaknesses,
      leadReaderSummary
    } = req.body;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    if (compilation.leadReaderId.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (finalRecommendation !== undefined) {
      compilation.finalCompilation.finalRecommendation = finalRecommendation;
    }
    if (conditionDetails !== undefined) {
      compilation.finalCompilation.conditionDetails = conditionDetails;
    }
    if (finalStrengths !== undefined) {
      compilation.finalCompilation.finalStrengths = finalStrengths;
    }
    if (finalWeaknesses !== undefined) {
      compilation.finalCompilation.finalWeaknesses = finalWeaknesses;
    }
    if (leadReaderSummary !== undefined) {
      compilation.finalCompilation.leadReaderSummary = leadReaderSummary;
    }

    compilation.lastActivity = new Date();
    await compilation.save();

    return res.json({
      success: true,
      finalCompilation: compilation.finalCompilation
    });
  } catch (error) {
    console.error('Save final compilation error:', error);
    return res.status(500).json({ error: 'Failed to save final compilation' });
  }
};

/**
 * Submit completed compilation
 */
export const submitCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const { signature } = req.body;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    if (compilation.leadReaderId.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Validate completion
    const missingItems: string[] = [];

    // Check all specifications have final determinations
    for (const assessment of compilation.compiledAssessments) {
      for (const spec of assessment.specifications) {
        if (!spec.finalDetermination) {
          missingItems.push(`Standard ${assessment.standardCode}, Spec ${spec.specCode}`);
        }
      }
    }

    if (!compilation.finalCompilation.finalRecommendation) {
      missingItems.push('Final recommendation');
    }

    if (!compilation.finalCompilation.finalStrengths?.trim()) {
      missingItems.push('Final strengths');
    }

    if (!compilation.finalCompilation.finalWeaknesses?.trim()) {
      missingItems.push('Final weaknesses');
    }

    if (missingItems.length > 0) {
      return res.status(400).json({
        error: 'Compilation is not complete',
        missingItems
      });
    }

    compilation.status = 'submitted';
    compilation.finalCompilation.isComplete = true;
    compilation.finalCompilation.signature = signature || `${req.user?.firstName} ${req.user?.lastName}`;
    compilation.finalCompilation.signedAt = new Date();
    compilation.completedAt = new Date();
    compilation.submittedAt = new Date();

    await compilation.save();

    // Update submission status
    const submission = await Submission.findById(compilation.submissionId);
    if (submission) {
      const decision = compilation.finalCompilation.finalRecommendation;
      if (decision === 'accreditation_no_conditions' || decision === 'conditional_accreditation') {
        submission.status = 'compliant';
      } else {
        submission.status = 'non_compliant';
      }
      await submission.save();
    }

    return res.json({
      success: true,
      submittedAt: compilation.submittedAt
    });
  } catch (error) {
    console.error('Submit compilation error:', error);
    return res.status(500).json({ error: 'Failed to submit compilation' });
  }
};

/**
 * Create a comment thread
 */
export const createCommentThread = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const { standardCode, specCode, message, participantIds } = req.body;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    const thread = {
      threadId: uuidv4(),
      standardCode,
      specCode,
      participants: [
        new mongoose.Types.ObjectId(req.user?.id),
        ...participantIds.map((id: string) => new mongoose.Types.ObjectId(id))
      ],
      messages: [{
        senderId: new mongoose.Types.ObjectId(req.user?.id),
        senderName: `${req.user?.firstName} ${req.user?.lastName}`,
        message,
        sentAt: new Date()
      }],
      isResolved: false,
      createdAt: new Date()
    };

    compilation.commentThreads.push(thread);
    compilation.lastActivity = new Date();
    await compilation.save();

    return res.json({ success: true, thread });
  } catch (error) {
    console.error('Create comment thread error:', error);
    return res.status(500).json({ error: 'Failed to create comment thread' });
  }
};

/**
 * Add message to comment thread
 */
export const addThreadMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId, threadId } = req.params;
    const { message } = req.body;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    const thread = compilation.commentThreads.find(t => t.threadId === threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    thread.messages.push({
      senderId: new mongoose.Types.ObjectId(req.user?.id),
      senderName: `${req.user?.firstName} ${req.user?.lastName}`,
      message,
      sentAt: new Date()
    });

    compilation.lastActivity = new Date();
    await compilation.save();

    return res.json({ success: true, thread });
  } catch (error) {
    console.error('Add thread message error:', error);
    return res.status(500).json({ error: 'Failed to add message' });
  }
};

/**
 * Resolve/unresolve comment thread
 */
export const toggleThreadResolved = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId, threadId } = req.params;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    const thread = compilation.commentThreads.find(t => t.threadId === threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    thread.isResolved = !thread.isResolved;
    await compilation.save();

    return res.json({ success: true, isResolved: thread.isResolved });
  } catch (error) {
    console.error('Toggle thread resolved error:', error);
    return res.status(500).json({ error: 'Failed to toggle thread status' });
  }
};

/**
 * Send reminder to readers
 */
export const sendReaderReminder = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const { readerIds, message } = req.body;

    // In a real implementation, this would send emails or notifications
    // For now, we'll just log the action

    console.log(`Reminder sent to readers: ${readerIds.join(', ')}`);
    console.log(`Message: ${message}`);

    return res.json({
      success: true,
      message: 'Reminders sent successfully',
      sentTo: readerIds.length
    });
  } catch (error) {
    console.error('Send reminder error:', error);
    return res.status(500).json({ error: 'Failed to send reminders' });
  }
};

/**
 * Export compilation data
 */
export const exportCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;
    const { format } = req.query; // 'json' or 'csv'

    const compilation = await LeadReaderCompilation.findById(compilationId)
      .populate('leadReaderId', 'firstName lastName email');

    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    if (format === 'csv') {
      // Build CSV
      const rows: string[] = [];
      rows.push('Standard,Specification,Consensus,Final Determination,Has Disagreement,Reader Votes');

      for (const assessment of compilation.compiledAssessments) {
        for (const spec of assessment.specifications) {
          const votes = spec.readerVotes.map(v => `${v.reviewerName}: ${v.compliance}`).join('; ');
          rows.push([
            assessment.standardCode,
            spec.specCode,
            spec.consensusCompliance || '',
            spec.finalDetermination || '',
            spec.hasDisagreement ? 'Yes' : 'No',
            `"${votes}"`
          ].join(','));
        }
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="compilation-${compilationId}.csv"`);
      return res.send(rows.join('\n'));
    }

    // Default to JSON
    return res.json({ compilation });
  } catch (error) {
    console.error('Export compilation error:', error);
    return res.status(500).json({ error: 'Failed to export compilation' });
  }
};
