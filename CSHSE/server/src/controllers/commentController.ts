import { Request, Response } from 'express';
import { Comment, IComment } from '../models/Comment';
import { Submission } from '../models/Submission';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: 'admin' | 'reader' | 'lead_reader' | 'program_coordinator';
  };
}

/**
 * Get all comments for a submission
 */
export const getComments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { standardCode, specCode, page = '1', limit = '50' } = req.query;

    const query: any = { submissionId };
    if (standardCode) query.standardCode = standardCode;
    if (specCode) query.specCode = specCode;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .sort({ standardCode: 1, specCode: 1, selectionStart: 1, createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Comment.countDocuments(query)
    ]);

    // Group comments by standard/spec
    const groupedComments: Record<string, IComment[]> = {};
    comments.forEach((comment: any) => {
      const key = comment.specCode
        ? `${comment.standardCode}-${comment.specCode}`
        : comment.standardCode;
      if (!groupedComments[key]) {
        groupedComments[key] = [];
      }
      groupedComments[key].push(comment);
    });

    return res.json({
      comments,
      groupedComments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return res.status(500).json({ error: 'Failed to get comments' });
  }
};

/**
 * Get comment count summary for a submission
 */
export const getCommentSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const pipeline = [
      { $match: { submissionId: new mongoose.Types.ObjectId(submissionId) } },
      {
        $group: {
          _id: {
            standardCode: '$standardCode',
            specCode: '$specCode'
          },
          count: { $sum: 1 },
          unresolvedCount: {
            $sum: { $cond: [{ $eq: ['$isResolved', false] }, 1, 0] }
          }
        }
      },
      { $sort: { '_id.standardCode': 1, '_id.specCode': 1 } as any }
    ];

    const summary = await Comment.aggregate(pipeline);

    const totalComments = summary.reduce((acc, s) => acc + s.count, 0);
    const totalUnresolved = summary.reduce((acc, s) => acc + s.unresolvedCount, 0);

    // Get first comment location for navigation
    const firstComment = await Comment.findOne({ submissionId })
      .sort({ standardCode: 1, specCode: 1, selectionStart: 1, createdAt: 1 })
      .lean();

    return res.json({
      totalComments,
      totalUnresolved,
      bySection: summary.map(s => ({
        standardCode: s._id.standardCode,
        specCode: s._id.specCode,
        count: s.count,
        unresolvedCount: s.unresolvedCount
      })),
      firstComment: firstComment
        ? {
            standardCode: firstComment.standardCode,
            specCode: firstComment.specCode,
            commentId: firstComment._id
          }
        : null
    });
  } catch (error) {
    console.error('Get comment summary error:', error);
    return res.status(500).json({ error: 'Failed to get comment summary' });
  }
};

/**
 * Create a new comment (readers and lead readers only)
 */
export const createComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const {
      standardCode,
      specCode,
      selectedText,
      selectionStart,
      selectionEnd,
      content
    } = req.body;

    // Only readers and lead readers can create comments
    if (!['reader', 'lead_reader'].includes(req.user?.role || '')) {
      return res.status(403).json({
        error: 'Only readers and lead readers can create comments'
      });
    }

    // Verify submission exists
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Verify user is assigned to this submission
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const isAssigned =
      submission.assignedReaders.some(r => r.equals(userId)) ||
      submission.leadReader?.equals(userId);

    if (!isAssigned) {
      return res.status(403).json({
        error: 'You are not assigned to this submission'
      });
    }

    const comment = new Comment({
      submissionId,
      standardCode,
      specCode: specCode || null,
      selectedText,
      selectionStart,
      selectionEnd,
      authorId: req.user!.id,
      authorName: req.user!.name,
      authorRole: req.user!.role,
      content,
      replies: []
    });

    await comment.save();

    return res.status(201).json({
      message: 'Comment created successfully',
      comment
    });
  } catch (error) {
    console.error('Create comment error:', error);
    return res.status(500).json({ error: 'Failed to create comment' });
  }
};

/**
 * Update a comment (author only)
 */
export const updateComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Only the author can edit their comment
    if (comment.authorId.toString() !== req.user!.id) {
      return res.status(403).json({
        error: 'You can only edit your own comments'
      });
    }

    comment.content = content;
    await comment.save();

    return res.json({
      message: 'Comment updated successfully',
      comment
    });
  } catch (error) {
    console.error('Update comment error:', error);
    return res.status(500).json({ error: 'Failed to update comment' });
  }
};

/**
 * Delete a comment (author or lead reader only)
 */
export const deleteComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Author or lead reader can delete
    const isAuthor = comment.authorId.toString() === req.user!.id;
    const isLeadReader = req.user!.role === 'lead_reader';

    if (!isAuthor && !isLeadReader) {
      return res.status(403).json({
        error: 'You can only delete your own comments or must be a lead reader'
      });
    }

    await comment.deleteOne();

    return res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    return res.status(500).json({ error: 'Failed to delete comment' });
  }
};

/**
 * Add a reply to a comment (all roles can reply)
 */
export const addReply = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Program coordinators can only reply, not create comments
    // All roles (reader, lead_reader, program_coordinator) can add replies
    const reply = {
      authorId: new mongoose.Types.ObjectId(req.user!.id),
      authorName: req.user!.name,
      authorRole: req.user!.role as 'reader' | 'lead_reader' | 'program_coordinator',
      content,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    comment.replies.push(reply);
    await comment.save();

    return res.status(201).json({
      message: 'Reply added successfully',
      comment
    });
  } catch (error) {
    console.error('Add reply error:', error);
    return res.status(500).json({ error: 'Failed to add reply' });
  }
};

/**
 * Delete a reply (only author of the reply can delete)
 */
export const deleteReply = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId, replyId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const replyIndex = comment.replies.findIndex(
      r => r._id?.toString() === replyId
    );

    if (replyIndex === -1) {
      return res.status(404).json({ error: 'Reply not found' });
    }

    const reply = comment.replies[replyIndex];

    // Only the reply author can delete their reply
    if (reply.authorId.toString() !== req.user!.id) {
      return res.status(403).json({
        error: 'You can only delete your own replies'
      });
    }

    comment.replies.splice(replyIndex, 1);
    await comment.save();

    return res.json({
      message: 'Reply deleted successfully',
      comment
    });
  } catch (error) {
    console.error('Delete reply error:', error);
    return res.status(500).json({ error: 'Failed to delete reply' });
  }
};

/**
 * Resolve/unresolve a comment (readers and lead readers only)
 */
export const toggleResolve = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;

    if (!['reader', 'lead_reader'].includes(req.user?.role || '')) {
      return res.status(403).json({
        error: 'Only readers and lead readers can resolve comments'
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    comment.isResolved = !comment.isResolved;
    if (comment.isResolved) {
      comment.resolvedBy = new mongoose.Types.ObjectId(req.user!.id);
      comment.resolvedAt = new Date();
    } else {
      comment.resolvedBy = undefined;
      comment.resolvedAt = undefined;
    }

    await comment.save();

    return res.json({
      message: comment.isResolved ? 'Comment resolved' : 'Comment unresolved',
      comment
    });
  } catch (error) {
    console.error('Toggle resolve error:', error);
    return res.status(500).json({ error: 'Failed to toggle resolve status' });
  }
};

/**
 * Get comments for navigation (paginated list for << < > >> buttons)
 */
export const getCommentsForNavigation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [comments, total] = await Promise.all([
      Comment.find({ submissionId })
        .select('_id standardCode specCode selectedText authorName createdAt isResolved')
        .sort({ standardCode: 1, specCode: 1, selectionStart: 1, createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Comment.countDocuments({ submissionId })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      comments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasFirst: pageNum > 1,
        hasPrevious: pageNum > 1,
        hasNext: pageNum < totalPages,
        hasLast: pageNum < totalPages
      },
      navigation: {
        first: 1,
        previous: Math.max(1, pageNum - 1),
        next: Math.min(totalPages, pageNum + 1),
        last: totalPages
      }
    });
  } catch (error) {
    console.error('Get comments for navigation error:', error);
    return res.status(500).json({ error: 'Failed to get comments for navigation' });
  }
};
