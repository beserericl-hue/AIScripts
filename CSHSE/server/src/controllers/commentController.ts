import { Request, Response } from 'express';
import { Comment, IComment } from '../models/Comment';
import { Submission } from '../models/Submission';
import { serializeCommentsForViewer } from '../services/commentSerializer';
import { recordAuditEvent } from '../services/auditLog';
import { notify } from '../services/notificationService';
import { uploadFile, downloadFile, deleteFile } from '../services/s3Service';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';
import { AuthenticatedRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import path from 'path';

/**
 * Get all comments for a submission
 */
export const getComments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // CR-004 — PC tier now sees RELAYED comments (with identity stripped +
    // sanitized text). Reader/lead_reader/admin still see the raw list.
    // The previous "blocked entirely" policy hid even Julia's relay back to
    // the PC, breaking the comment-thread loop. The serializer below is the
    // single redaction point — every PC-visible comment-returning path
    // must funnel through it.
    const _sub = await requireSubmissionAccess(req, res, req.params.submissionId); if (!_sub) return;
    const { submissionId } = req.params;
    const { standardCode, specCode, page = '1', limit = '50' } = req.query;
    const role = req.user?.role || '';
    const isPC = role === 'program_coordinator';

    const query: any = { submissionId };
    if (standardCode) query.standardCode = standardCode;
    if (specCode) query.specCode = specCode;
    // PC viewers: only relayed comments come back. The serializer ALSO
    // enforces this — the query-level filter is defence-in-depth.
    if (isPC) query.relayed = true;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [commentsRaw, total] = await Promise.all([
      Comment.find(query)
        .sort({ standardCode: 1, specCode: 1, selectionStart: 1, createdAt: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Comment.countDocuments(query)
    ]);

    const comments = serializeCommentsForViewer(commentsRaw as any, role);

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
    const _sub = await requireSubmissionAccess(req, res, req.params.submissionId); if (!_sub) return;
    // Comments are never visible to program coordinators
    if (req.user?.role === 'program_coordinator') {
      return res.json({ total: 0, unresolved: 0, bySection: [] });
    }

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

    // Only readers, lead readers, and superusers (impersonating) can create comments
    if (!['reader', 'lead_reader'].includes(req.user?.role || '') && !req.user?.isSuperuser) {
      return res.status(403).json({
        error: 'Only readers and lead readers can create comments'
      });
    }

    // Verify submission exists
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // When a superuser impersonates a reader/lead reader, act AS that user:
    // assignment + authorship use the impersonated id, not the superuser's.
    const imp = (req.user as any)?.impersonation;
    const effectiveUserId = imp?.impersonatedUserId || req.user!.id;
    const effectiveName = imp?.impersonatedUserName || req.user!.name;

    // Verify the (effective) user is assigned to this submission (superusers
    // bypass — but note: while impersonating a non-admin, isSuperuser is false,
    // so the assignment of the impersonated reader is what matters).
    if (!req.user!.isSuperuser) {
      const userId = new mongoose.Types.ObjectId(effectiveUserId);
      const isAssigned =
        submission.assignedReaders.some(r => r.equals(userId)) ||
        submission.leadReader?.equals(userId);

      if (!isAssigned) {
        return res.status(403).json({
          error: 'You are not assigned to this submission'
        });
      }
    }

    const roleLabels: Record<string, string> = {
      reader: 'Reader', lead_reader: 'Lead Reader',
      program_coordinator: 'Program Coordinator', admin: 'Admin'
    };
    const authorName = effectiveName || roleLabels[req.user!.role] || req.user!.role;

    const comment = new Comment({
      submissionId,
      standardCode,
      specCode: specCode || null,
      selectedText,
      selectionStart,
      selectionEnd,
      authorId: effectiveUserId,
      authorName,
      // authorRole must be one of the enum values; a superuser/admin commenting
      // for oversight is recorded as a lead reader (avoids a 500 on save).
      authorRole: (['reader', 'lead_reader'].includes(req.user!.role) ? req.user!.role : 'lead_reader'),
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

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

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

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

    // Program coordinators cannot see or interact with comments (superusers bypass)
    if (req.user?.role === 'program_coordinator' && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Program coordinators cannot access comments' });
    }

    // When a superuser impersonates a reader/lead reader, attribute the reply to
    // the impersonated user (mirrors createComment). authorRole must be one of the
    // enum values; an admin/superuser replying is recorded as a lead reader.
    const imp = (req.user as any)?.impersonation;
    const effectiveUserId = imp?.impersonatedUserId || req.user!.id;
    const effectiveName = imp?.impersonatedUserName || req.user!.name;
    const reply = {
      authorId: new mongoose.Types.ObjectId(effectiveUserId),
      authorName: effectiveName,
      authorRole: (['reader', 'lead_reader'].includes(req.user!.role) ? req.user!.role : 'lead_reader') as 'reader' | 'lead_reader' | 'program_coordinator',
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

    if (!['reader', 'lead_reader'].includes(req.user?.role || '') && !req.user?.isSuperuser) {
      return res.status(403).json({
        error: 'Only readers and lead readers can resolve comments'
      });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

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
    const _sub = await requireSubmissionAccess(req, res, req.params.submissionId); if (!_sub) return;
    // Comments are never visible to program coordinators
    if (req.user?.role === 'program_coordinator') {
      return res.json({ comments: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0, hasFirst: false, hasPrevious: false, hasNext: false, hasLast: false }, navigation: { first: 1, previous: 1, next: 1, last: 1 } });
    }

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

// ============================================
// CR-023 — Julia relay endpoints (also CR-004 Phase 2)
// ============================================
//
// Three transitions Julia (or the board, via admin/lead_reader/superuser)
// uses to manage the reader → PC relay:
//
//   POST   /api/comments/:commentId/relay        — mark relayed (with optional
//                                                  sanitized text + pcLabel).
//   DELETE /api/comments/:commentId/relay        — un-mark; PC loses visibility.
//   POST   /api/comments/:commentId/escalate     — board-escalated flag.
//
// Every transition writes an audit entry so the timeline shows "comment
// X relayed by Julia at T with reason R."

function _canRelay(role?: string, isSuperuser?: boolean): boolean {
  return role === 'admin' || role === 'lead_reader' || isSuperuser === true;
}

export const relayComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_canRelay(req.user?.role, req.user?.isSuperuser as any)) {
      return res.status(403).json({ error: 'Only lead readers, admin, or the board can relay comments' });
    }
    const { commentId } = req.params;
    const { relayedText, pcLabel, reason } = req.body || {};

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

    const sanitized = typeof relayedText === 'string' ? relayedText.trim().slice(0, 8000) : undefined;
    const label = typeof pcLabel === 'string' ? pcLabel.trim().slice(0, 64) : undefined;

    comment.relayed = true;
    if (sanitized !== undefined) comment.relayedText = sanitized;
    if (label !== undefined) comment.pcLabel = label;
    comment.originalReaderId = (comment as any).authorId;
    comment.relayedAt = new Date();
    comment.relayedBy = new mongoose.Types.ObjectId(req.user!.id);
    await comment.save();

    void recordAuditEvent({
      action: 'comment.relayed',
      actor: { id: req.user!.id, role: req.user!.role, name: (req.user as any).name || '' },
      targetType: 'comment',
      targetId: String(comment._id),
      submissionId: String(comment.submissionId),
      payload: { pcLabel: comment.pcLabel },
      reason: typeof reason === 'string' ? reason : undefined,
    });

    // CR-010 / S12.2 — notify the PC (submission submitter) that a reader
    // comment was relayed to them. Fire-and-forget + fail-soft (never breaks
    // the relay). dedupeKey is per-comment so an un-relay/re-relay of the same
    // comment doesn't re-spam, but each distinct comment yields its own ping.
    void (async () => {
      try {
        const sub = await Submission.findById(comment.submissionId)
          .select('submitterId institutionName programName')
          .lean();
        const submitterId = (sub as any)?.submitterId;
        if (submitterId) {
          await notify({
            recipientId: String(submitterId),
            type: 'comment.relayed',
            title: 'A reviewer comment was shared with you',
            body: `${(sub as any).institutionName} — ${(sub as any).programName}: a reviewer comment is now visible in your self-study.`,
            link: `/self-study/${String(comment.submissionId)}`,
            submissionId: String(comment.submissionId),
            dedupeKey: `comment.relayed:${String(comment._id)}`,
            email: true,
          });
        }
      } catch (e) {
        console.error('relayComment notify (non-fatal):', e);
      }
    })();

    return res.json({
      message: 'Comment relayed to program coordinator',
      comment: { _id: comment._id, relayed: true, pcLabel: comment.pcLabel },
    });
  } catch (err) {
    console.error('relayComment error:', err);
    return res.status(500).json({ error: 'Failed to relay comment' });
  }
};

export const unrelayComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_canRelay(req.user?.role, req.user?.isSuperuser as any)) {
      return res.status(403).json({ error: 'Only lead readers, admin, or the board can unrelay comments' });
    }
    const { commentId } = req.params;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

    comment.relayed = false;
    comment.relayedAt = undefined;
    comment.relayedBy = undefined;
    await comment.save();

    void recordAuditEvent({
      action: 'comment.unrelayed',
      actor: { id: req.user!.id, role: req.user!.role, name: (req.user as any).name || '' },
      targetType: 'comment',
      targetId: String(comment._id),
      submissionId: String(comment.submissionId),
      payload: {},
    });

    return res.json({ message: 'Comment unrelayed', comment: { _id: comment._id, relayed: false } });
  } catch (err) {
    console.error('unrelayComment error:', err);
    return res.status(500).json({ error: 'Failed to unrelay comment' });
  }
};

export const escalateComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_canRelay(req.user?.role, req.user?.isSuperuser as any)) {
      return res.status(403).json({ error: 'Only lead readers, admin, or the board can escalate' });
    }
    const { commentId } = req.params;
    const { reason } = req.body || {};
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

    comment.boardEscalated = true;
    await comment.save();

    void recordAuditEvent({
      // Reuse a generic audit action; we don't need a new union member
      // for what is at root a relay state change.
      action: 'comment.relayed',
      actor: { id: req.user!.id, role: req.user!.role, name: (req.user as any).name || '' },
      targetType: 'comment',
      targetId: String(comment._id),
      submissionId: String(comment.submissionId),
      payload: { boardEscalated: true },
      reason: typeof reason === 'string' ? reason : undefined,
    });

    return res.json({ message: 'Comment escalated to board', comment: { _id: comment._id, boardEscalated: true } });
  } catch (err) {
    console.error('escalateComment error:', err);
    return res.status(500).json({ error: 'Failed to escalate comment' });
  }
};

/**
 * Julia / admin / lead_reader inbox of comments awaiting relay decisions
 * for one submission. Returns the un-relayed reader/lead-reader comments
 * (and any board-escalated comments) the board needs to triage.
 */
export const getRelayQueue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _sub = await requireSubmissionAccess(req, res, req.params.submissionId); if (!_sub) return;
    if (!_canRelay(req.user?.role, req.user?.isSuperuser as any)) {
      return res.status(403).json({ error: 'Only lead readers, admin, or the board can view the relay queue' });
    }
    const { submissionId } = req.params;
    const comments = await Comment.find({
      submissionId,
      $or: [{ relayed: false }, { boardEscalated: true }],
    })
      .sort({ createdAt: 1 })
      .lean();
    return res.json({ comments });
  } catch (err) {
    console.error('getRelayQueue error:', err);
    return res.status(500).json({ error: 'Failed to load relay queue' });
  }
};

// ============================================================================
// CR-021 / Sprint 5.3 — reader file attachments on comments.
//
// POST /api/comments/:commentId/attachments   (multipart "file") — reader/lead-reader/admin
// DELETE /api/comments/:commentId/attachments/:attachmentId — uploader/lead-reader/admin
// GET /api/comments/:commentId/attachments/:attachmentId — same ACL as the parent
//
// ACL: matches the parent comment's relay state. PCs only see attachments
// on comments they can see (relayed === true), and only the parent comment's
// own attachments (no enumeration of unrelayed siblings).
// ============================================================================

const ATTACHMENT_MIME_ALLOWLIST = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB per CR-021 decision.

function _sanitizeAttachmentFilename(name: string): string {
  const ext = path.extname(name).toLowerCase().slice(0, 8);
  const base = path.basename(name, path.extname(name))
    .replace(/[^a-z0-9_.-]+/gi, '_')
    .slice(0, 64);
  return `${base || 'attachment'}${ext}`;
}

function _commentS3Key(commentId: string, filename: string): string {
  return `reader-attachments/${commentId}/${Date.now()}_${_sanitizeAttachmentFilename(filename)}`;
}

function _canReadAttachment(viewerRole: string, comment: IComment): boolean {
  if (viewerRole === 'admin' || viewerRole === 'superuser') return true;
  if (viewerRole === 'reader' || viewerRole === 'lead_reader') return true;
  if (viewerRole === 'program_coordinator') return comment.relayed === true;
  return false;
}

export const uploadCommentAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId } = req.params;
    const role = req.user?.role || '';
    if (!['reader', 'lead_reader', 'admin'].includes(role) && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Only readers, lead readers, and admins can upload attachments' });
    }

    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded (field name "file")' });
    }
    if (!ATTACHMENT_MIME_ALLOWLIST.has(file.mimetype)) {
      return res.status(400).json({ error: `File type not allowed: ${file.mimetype}. Allowed: PDF, DOCX, TXT.` });
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      return res.status(400).json({ error: 'File exceeds 25 MB limit' });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

    const key = _commentS3Key(String(comment._id), file.originalname);
    await uploadFile(key, file.buffer, file.mimetype);

    const attachment = {
      s3Key: key,
      filename: _sanitizeAttachmentFilename(file.originalname),
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: new mongoose.Types.ObjectId(req.user!.id),
      uploadedByName: req.user!.name || req.user!.role,
      uploadedAt: new Date()
    };

    comment.attachments.push(attachment as any);
    await comment.save();

    const added = comment.attachments[comment.attachments.length - 1];

    return res.status(201).json({
      message: 'Attachment uploaded',
      attachment: {
        _id: added._id,
        filename: added.filename,
        mimeType: added.mimeType,
        sizeBytes: added.sizeBytes,
        uploadedByName: added.uploadedByName,
        uploadedAt: added.uploadedAt
      }
    });
  } catch (err) {
    console.error('uploadCommentAttachment error:', err);
    return res.status(500).json({ error: 'Failed to upload attachment' });
  }
};

export const downloadCommentAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId, attachmentId } = req.params;
    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

    const role = req.user?.role || '';
    if (!_canReadAttachment(role, comment) && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    const att = comment.attachments.find((a: any) => String(a._id) === String(attachmentId));
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    const { stream, contentType } = await downloadFile(att.s3Key);
    res.setHeader('Content-Type', contentType || att.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${att.filename}"`);
    stream.pipe(res);
  } catch (err) {
    console.error('downloadCommentAttachment error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download attachment' });
  }
};

export const deleteCommentAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commentId, attachmentId } = req.params;
    const role = req.user?.role || '';

    const comment = await Comment.findById(commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const _sub = await requireSubmissionAccess(req, res, String(comment.submissionId)); if (!_sub) return;

    const att = comment.attachments.find((a: any) => String(a._id) === String(attachmentId));
    if (!att) return res.status(404).json({ error: 'Attachment not found' });

    const isUploader = String(att.uploadedBy) === String(req.user!.id);
    const isElevated = role === 'admin' || role === 'lead_reader' || req.user?.isSuperuser;
    if (!isUploader && !isElevated) {
      return res.status(403).json({ error: 'Only the uploader, lead readers, or admins can delete attachments' });
    }

    try {
      await deleteFile(att.s3Key);
    } catch (e) {
      console.warn('S3 delete failed (continuing with DB cleanup):', (e as Error).message);
    }

    comment.attachments = comment.attachments.filter((a: any) => String(a._id) !== String(attachmentId)) as any;
    await comment.save();

    return res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('deleteCommentAttachment error:', err);
    return res.status(500).json({ error: 'Failed to delete attachment' });
  }
};
