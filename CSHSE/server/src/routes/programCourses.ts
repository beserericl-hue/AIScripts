/**
 * Routes for the per-institution course catalog used by the Matrix step.
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listProgramCourses,
  createProgramCourse
} from '../controllers/programCoursesController';

const router = Router();
router.use(authenticate);

router.get('/:submissionId/courses', listProgramCourses);
router.post('/:submissionId/courses', createProgramCourse);

export default router;
