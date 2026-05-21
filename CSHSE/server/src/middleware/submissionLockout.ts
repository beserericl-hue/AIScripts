import { Response, NextFunction } from 'express';
import { Submission } from '../models/Submission';
import { AuthenticatedRequest } from './auth';

/**
 * Lockout middleware — refuses PC writes once a submission has been
 * final-submitted OR a reader/lead-reader has locked it. Mounted on
 * write routes that operate on a specific :submissionId.
 *
 * Returns 403 LOCKED with a structured payload so the client can render
 * the read-only banner from the same source of truth as the server.
 *
 * Admin + superuser are exempt — they may unlock the submission.
 *
 * For readers: a reader is allowed to write on a locked submission (that's
 * what reader review is) provided they hold the lock. The reader-lock
 * controller handles that semantic separately; this middleware is scoped
 * to **program-coordinator** writes.
 */
export const submissionLockout = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const submissionId = req.params.submissionId;
    if (!submissionId) return next();

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admin + superuser bypass the lockout (they can unlock and edit on the PC's behalf).
    if (req.user.role === 'admin' || req.user.isSuperuser) {
      return next();
    }

    const submission = await Submission.findById(submissionId)
      .select('status submitterId readerLock')
      .lean();

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Only the program-coordinator submitter is subject to lockout on their own submission.
    // Other roles (reader / lead_reader) are governed by the reader-lock controller.
    if (req.user.role !== 'program_coordinator') {
      return next();
    }

    const isFinalSubmitted =
      submission.status === 'submitted' ||
      submission.status === 'under_review' ||
      submission.status === 'readers_assigned' ||
      submission.status === 'review_complete';

    const isReaderLocked = !!submission.readerLock?.isLocked;

    if (!isFinalSubmitted && !isReaderLocked) {
      return next();
    }

    // Locked. Build a structured payload so the client banner has everything it needs.
    return res.status(403).json({
      error: 'LOCKED',
      message: isReaderLocked
        ? `Reader Locked — ${submission.readerLock?.lockedByName || 'A reviewer'} is currently reviewing this self-study. You can view comments and respond to them.`
        : 'This self-study was submitted for review and is read-only. Print and view are still available.',
      lock: {
        kind: isReaderLocked ? 'reader_lock' : 'final_submitted',
        status: submission.status,
        readerLock: submission.readerLock || { isLocked: false }
      }
    });
  } catch (err) {
    console.error('[submissionLockout] error', err);
    return res.status(500).json({ error: 'Lockout check failed' });
  }
};
