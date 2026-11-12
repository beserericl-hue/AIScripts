import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listHelpVideos, getHelpVideoLinks } from '../controllers/helpVideoController';

// Per-screen help videos — any signed-in user (every role, incl. board).
const router = Router();
router.use(authenticate);
router.get('/', listHelpVideos);
router.get('/:screenId/links', getHelpVideoLinks);

export default router;
