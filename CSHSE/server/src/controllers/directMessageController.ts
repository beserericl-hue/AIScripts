import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { DirectMessageThread, DirectMessage, DmParticipantRole } from '../models/DirectMessage';
import { User } from '../models/User';
import { notifyMany } from '../services/notificationService';

// ---------------------------------------------------------------------------
// CR-010 / Sprint 5.4 — Portal direct messaging.
//
// Endpoints:
//   GET    /api/submissions/:submissionId/messages — list threads for current user
//   POST   /api/submissions/:submissionId/messages — create a new thread (+ first message)
//   GET    /api/messages/:threadId — read a thread + its messages
//   POST   /api/messages/:threadId — append a message
//
// Server-side guarantees:
//   - PCs are always 403 (never list, read, post, or are added as participants).
//   - Non-participant reader / lead_reader → 403; admin / superuser bypass.
//   - New threads validate that every participant is a reader / lead_reader /
//     admin User; PC participants are rejected with 400.
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isSuperuser?: boolean;
  };
}

function _isElevated(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.isSuperuser === true;
}

function _canParticipate(role: string): role is DmParticipantRole {
  return role === 'reader' || role === 'lead_reader' || role === 'admin';
}

function _actorName(req: AuthenticatedRequest): string {
  if (req.user?.name) return req.user.name;
  const first = req.user?.firstName || '';
  const last = req.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || req.user?.email || 'unknown';
}

function _denyIfPC(req: AuthenticatedRequest, res: Response): boolean {
  if (req.user?.role === 'program_coordinator') {
    res.status(403).json({ error: 'Program coordinators cannot access direct messages' });
    return true;
  }
  return false;
}

function _isParticipant(
  participantIds: mongoose.Types.ObjectId[],
  userId: string
): boolean {
  return participantIds.some((p) => String(p) === String(userId));
}

function _snippet(text: string, max = 140): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Notify every participant except the sender that a new message landed.
 * In-app + email, fail-soft — never blocks the message write.
 */
function _notifyParticipants(opts: {
  participantIds: mongoose.Types.ObjectId[];
  senderId: string;
  senderName: string;
  subject: string;
  submissionId: string;
  content: string;
}): void {
  const recipients = opts.participantIds
    .map(String)
    .filter((id) => id !== String(opts.senderId));
  if (recipients.length === 0) return;
  void notifyMany(recipients, {
    type: 'dm.new_message',
    title: `New message from ${opts.senderName}`,
    body: `${opts.subject}: ${_snippet(opts.content)}`,
    link: `/reader/${opts.submissionId}`,
    submissionId: opts.submissionId,
    email: true
  });
}

/**
 * GET /api/submissions/:submissionId/messages
 * List threads on this submission where the caller is a participant
 * (or all threads if admin / superuser).
 */
export const listThreads = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    const { submissionId } = req.params;
    const query: any = { submissionId };
    if (!_isElevated(req)) {
      query.participantIds = new mongoose.Types.ObjectId(req.user!.id);
    }
    const threads = await DirectMessageThread.find(query)
      .sort({ lastMessageAt: -1 })
      .lean();
    return res.json({ threads });
  } catch (err) {
    console.error('listThreads error:', err);
    return res.status(500).json({ error: 'Failed to list threads' });
  }
};

/**
 * POST /api/submissions/:submissionId/messages
 * Body: { subject, participantIds[], message, contextStandardCode?, contextSpecCode? }
 *
 * Creates a thread and posts the opening message in one shot. The caller
 * is added to participants automatically.
 */
export const createThread = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    if (!_canParticipate(req.user?.role || '') && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Only readers / lead readers / admins can start DM threads' });
    }

    const { submissionId } = req.params;
    const {
      subject,
      participantIds = [],
      message,
      contextStandardCode,
      contextSpecCode
    } = req.body || {};

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ error: 'subject is required' });
    }
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (!Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'participantIds must be an array' });
    }

    const callerId = new mongoose.Types.ObjectId(req.user!.id);
    const otherIds = participantIds
      .filter((id: string) => String(id) !== String(req.user!.id))
      .map((id: string) => new mongoose.Types.ObjectId(id));

    // Verify all OTHER participants are eligible roles (no PCs allowed).
    if (otherIds.length > 0) {
      const others = await User.find({ _id: { $in: otherIds } }).select('role').lean();
      if (others.length !== otherIds.length) {
        return res.status(400).json({ error: 'One or more participantIds not found' });
      }
      const ineligible = others.find((u) => !_canParticipate(u.role));
      if (ineligible) {
        return res.status(400).json({ error: 'PCs cannot be DM participants' });
      }
    }

    const allParticipants = [callerId, ...otherIds];
    const callerRole = (req.user!.role as DmParticipantRole) || 'reader';

    const thread = await DirectMessageThread.create({
      submissionId: new mongoose.Types.ObjectId(submissionId),
      subject: subject.trim(),
      participantIds: allParticipants,
      createdBy: callerId,
      createdByName: _actorName(req),
      createdByRole: callerRole,
      lastMessageAt: new Date(),
      contextStandardCode,
      contextSpecCode
    });

    const firstMessage = await DirectMessage.create({
      threadId: thread._id,
      submissionId: thread.submissionId,
      senderId: callerId,
      senderName: _actorName(req),
      senderRole: callerRole,
      content: message.trim()
    });

    _notifyParticipants({
      participantIds: allParticipants,
      senderId: req.user!.id,
      senderName: _actorName(req),
      subject: thread.subject,
      submissionId: String(thread.submissionId),
      content: firstMessage.content
    });

    return res.status(201).json({ thread, message: firstMessage });
  } catch (err) {
    console.error('createThread error:', err);
    return res.status(500).json({ error: 'Failed to create thread' });
  }
};

/**
 * GET /api/messages/:threadId
 */
export const getThread = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    const { threadId } = req.params;
    const thread = await DirectMessageThread.findById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    if (!_isElevated(req) && !_isParticipant(thread.participantIds as any, req.user!.id)) {
      return res.status(403).json({ error: 'Not a participant in this thread' });
    }

    const messages = await DirectMessage.find({ threadId: thread._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ thread, messages });
  } catch (err) {
    console.error('getThread error:', err);
    return res.status(500).json({ error: 'Failed to get thread' });
  }
};

/**
 * POST /api/messages/:threadId
 * Body: { message }
 */
export const postMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (_denyIfPC(req, res)) return;
    const { threadId } = req.params;
    const { message } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const thread = await DirectMessageThread.findById(threadId);
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    if (!_isElevated(req) && !_isParticipant(thread.participantIds as any, req.user!.id)) {
      return res.status(403).json({ error: 'Not a participant in this thread' });
    }

    const senderRole = (req.user!.role as DmParticipantRole) || 'reader';
    const stored = await DirectMessage.create({
      threadId: thread._id,
      submissionId: thread.submissionId,
      senderId: new mongoose.Types.ObjectId(req.user!.id),
      senderName: _actorName(req),
      senderRole,
      content: message.trim()
    });

    thread.lastMessageAt = stored.createdAt;
    await thread.save();

    _notifyParticipants({
      participantIds: thread.participantIds as any,
      senderId: req.user!.id,
      senderName: _actorName(req),
      subject: thread.subject,
      submissionId: String(thread.submissionId),
      content: stored.content
    });

    return res.status(201).json({ message: stored });
  } catch (err) {
    console.error('postMessage error:', err);
    return res.status(500).json({ error: 'Failed to post message' });
  }
};
