import { Router } from 'express';
import {
  getItinerary,
  replaceAgenda,
  exportItineraryDocx
} from '../controllers/itineraryController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-013 / Sprint 6.2 — Site-visit itinerary co-edit.
router.get('/submissions/:submissionId/itinerary', getItinerary);
router.put('/submissions/:submissionId/itinerary', replaceAgenda);
router.get('/submissions/:submissionId/itinerary/export.docx', exportItineraryDocx);

export default router;
