import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification';

// ---------------------------------------------------------------------------
// In-app notification inbox (the notification pass).
//
// Every endpoint is strictly scoped to the caller: a user can only ever list,
// count, or mark-read their OWN notifications. There is no cross-user read.
//
//   GET   /api/notifications?unreadOnly=true&limit=N&offset=N
//   GET   /api/notifications/unread-count
//   POST  /api/notifications/:id/read
//   POST  /api/notifications/read-all
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

export const listNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientId = new mongoose.Types.ObjectId(req.user!.id);
    const query: any = { recipientId };
    if (String(req.query.unreadOnly) === 'true') query.read = false;

    const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 100);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      Notification.countDocuments({ recipientId, read: false })
    ]);

    return res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('listNotifications error:', err);
    return res.status(500).json({ error: 'Failed to list notifications' });
  }
};

export const unreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientId = new mongoose.Types.ObjectId(req.user!.id);
    const count = await Notification.countDocuments({ recipientId, read: false });
    return res.json({ unreadCount: count });
  } catch (err) {
    console.error('unreadCount error:', err);
    return res.status(500).json({ error: 'Failed to count notifications' });
  }
};

export const markRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }
    const recipientId = new mongoose.Types.ObjectId(req.user!.id);
    // Scope the update to the caller's own row — a foreign id simply matches
    // nothing (404), never another user's notification.
    const updated = await Notification.findOneAndUpdate(
      { _id: id, recipientId },
      { $set: { read: true, readAt: new Date() } },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ notification: updated });
  } catch (err) {
    console.error('markRead error:', err);
    return res.status(500).json({ error: 'Failed to mark read' });
  }
};

export const markAllRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientId = new mongoose.Types.ObjectId(req.user!.id);
    const result = await Notification.updateMany(
      { recipientId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    return res.json({ modified: result.modifiedCount });
  } catch (err) {
    console.error('markAllRead error:', err);
    return res.status(500).json({ error: 'Failed to mark all read' });
  }
};
