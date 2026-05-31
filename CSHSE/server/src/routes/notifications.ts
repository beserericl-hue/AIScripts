import { Router } from 'express';
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Notification pass — in-app inbox, scoped to the caller.
router.get('/notifications', listNotifications);
router.get('/notifications/unread-count', unreadCount);
router.post('/notifications/:id/read', markRead);
router.post('/notifications/read-all', markAllRead);

export default router;
