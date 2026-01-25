import { Request, Response } from 'express';
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
 * Get lock status for a submission
 */
export const getLockStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId)
      .select('readerLock submitterId assignedReaders leadReader')
      .lean();

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Determine if current user can edit
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const isLocked = submission.readerLock?.isLocked || false;

    let canEdit = false;
    let lockMessage = '';

    if (userRole === 'program_coordinator') {
      // Program coordinator can only edit if NOT locked
      if (isLocked) {
        canEdit = false;
        lockMessage = `Reader Locked - ${submission.readerLock?.lockedByName || 'A reviewer'} is currently reviewing this self-study. You can view comments and respond to them.`;
      } else if (submission.readerLock?.lockReason === 'sent_back_for_correction') {
        canEdit = true;
        lockMessage = `Sent back for correction: ${submission.readerLock?.sentBackReason || 'Please review and correct the noted issues.'}`;
      } else {
        canEdit = submission.submitterId?.toString() === userId;
      }
    } else if (userRole === 'reader' || userRole === 'lead_reader') {
      // Readers and lead readers can always view but editing depends on assignment
      const assignedReaderIds = (submission.assignedReaders || []).map(r => r.toString());
      const isAssigned = assignedReaderIds.includes(userId) ||
        submission.leadReader?.toString() === userId;
      canEdit = isAssigned;
    } else if (userRole === 'admin') {
      canEdit = true;
    }

    return res.json({
      isLocked,
      canEdit,
      lockMessage,
      lockDetails: submission.readerLock || { isLocked: false }
    });
  } catch (error) {
    console.error('Get lock status error:', error);
    return res.status(500).json({ error: 'Failed to get lock status' });
  }
};

/**
 * Lock a submission (readers and lead readers only)
 * Called when a reader/lead reader starts reviewing
 */
export const lockSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { reason } = req.body; // 'reader_review' or 'lead_reader_review'

    // Only readers and lead readers can lock
    if (!['reader', 'lead_reader'].includes(req.user?.role || '')) {
      return res.status(403).json({
        error: 'Only readers and lead readers can lock submissions'
      });
    }

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

    // Check if already locked by someone else
    if (submission.readerLock?.isLocked &&
        submission.readerLock.lockedBy?.toString() !== req.user!.id) {
      return res.status(409).json({
        error: `Submission is already locked by ${submission.readerLock.lockedByName}`,
        lockedBy: submission.readerLock.lockedByName,
        lockedAt: submission.readerLock.lockedAt
      });
    }

    // Lock the submission
    submission.readerLock = {
      isLocked: true,
      lockedBy: userId,
      lockedByName: req.user!.name,
      lockedByRole: req.user!.role as 'reader' | 'lead_reader',
      lockedAt: new Date(),
      lockReason: reason || (req.user!.role === 'lead_reader' ? 'lead_reader_review' : 'reader_review')
    };

    await submission.save();

    return res.json({
      message: 'Submission locked successfully',
      readerLock: submission.readerLock
    });
  } catch (error) {
    console.error('Lock submission error:', error);
    return res.status(500).json({ error: 'Failed to lock submission' });
  }
};

/**
 * Unlock a submission (reader who locked it, lead reader, or admin)
 */
export const unlockSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.readerLock?.isLocked) {
      return res.json({
        message: 'Submission is not locked',
        readerLock: submission.readerLock
      });
    }

    // Check permission to unlock
    const canUnlock =
      req.user!.role === 'admin' ||
      req.user!.role === 'lead_reader' ||
      submission.readerLock.lockedBy?.toString() === req.user!.id;

    if (!canUnlock) {
      return res.status(403).json({
        error: 'You do not have permission to unlock this submission'
      });
    }

    // Unlock
    submission.readerLock = {
      isLocked: false,
      lockedBy: undefined,
      lockedByName: undefined,
      lockedByRole: undefined,
      lockedAt: undefined,
      lockReason: undefined
    };

    await submission.save();

    return res.json({
      message: 'Submission unlocked successfully',
      readerLock: submission.readerLock
    });
  } catch (error) {
    console.error('Unlock submission error:', error);
    return res.status(500).json({ error: 'Failed to unlock submission' });
  }
};

/**
 * Send submission back to program coordinator for correction
 * (readers and lead readers only)
 */
export const sendBackForCorrection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { reason } = req.body;

    if (!['reader', 'lead_reader'].includes(req.user?.role || '')) {
      return res.status(403).json({
        error: 'Only readers and lead readers can send back for correction'
      });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        error: 'A reason for sending back is required'
      });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Verify user is assigned
    const userId = new mongoose.Types.ObjectId(req.user!.id);
    const isAssigned =
      submission.assignedReaders.some(r => r.equals(userId)) ||
      submission.leadReader?.equals(userId);

    if (!isAssigned) {
      return res.status(403).json({
        error: 'You are not assigned to this submission'
      });
    }

    // Unlock and set sent back status
    submission.readerLock = {
      isLocked: false,
      lockedBy: undefined,
      lockedByName: undefined,
      lockedByRole: undefined,
      lockedAt: undefined,
      lockReason: 'sent_back_for_correction',
      sentBackAt: new Date(),
      sentBackReason: reason
    };

    await submission.save();

    // TODO: Send notification to program coordinator

    return res.json({
      message: 'Submission sent back for correction',
      readerLock: submission.readerLock
    });
  } catch (error) {
    console.error('Send back for correction error:', error);
    return res.status(500).json({ error: 'Failed to send back for correction' });
  }
};

/**
 * Clear the "sent back" status after program coordinator makes corrections
 * (program coordinator only)
 */
export const clearSentBack = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    if (req.user?.role !== 'program_coordinator') {
      return res.status(403).json({
        error: 'Only program coordinators can clear the sent back status'
      });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Verify this is the program coordinator's submission
    if (submission.submitterId?.toString() !== req.user!.id) {
      return res.status(403).json({
        error: 'You can only clear sent back status on your own submissions'
      });
    }

    if (submission.readerLock?.lockReason !== 'sent_back_for_correction') {
      return res.json({
        message: 'Submission was not sent back for correction',
        readerLock: submission.readerLock
      });
    }

    // Clear the sent back status
    submission.readerLock = {
      isLocked: false
    };

    await submission.save();

    return res.json({
      message: 'Corrections submitted, sent back status cleared',
      readerLock: submission.readerLock
    });
  } catch (error) {
    console.error('Clear sent back error:', error);
    return res.status(500).json({ error: 'Failed to clear sent back status' });
  }
};
