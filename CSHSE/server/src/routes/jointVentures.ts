import { Router } from 'express';
import {
  listJointVentures,
  getJointVenture,
  createJointVenture,
  updateJointVenture,
  addMember,
  removeMember,
  archiveJointVenture,
  aggregateStats
} from '../controllers/jointVentureController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-019 / Sprint 8.1 — Joint Venture grouping.
router.get('/', listJointVentures);
router.post('/', createJointVenture);
router.get('/:id', getJointVenture);
router.patch('/:id', updateJointVenture);
router.post('/:id/institutions', addMember);
router.delete('/:id/institutions/:institutionId', removeMember);
router.post('/:id/archive', archiveJointVenture);
router.get('/:id/aggregate-stats', aggregateStats);

export default router;
