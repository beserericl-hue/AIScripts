import { Router } from 'express';
import {
  getMatrix,
  addCourse,
  removeCourse,
  updateAssessment,
  reorderCourses,
  importMatrix,
  exportMatrix
} from '../controllers/matrixController';

const router = Router();

// ============================================
// CURRICULUM MATRIX ROUTES
// ============================================

/**
 * @route   GET /api/submissions/:submissionId/matrix
 * @desc    Get curriculum matrix for a submission
 * @access  Private
 */
router.get('/submissions/:submissionId/matrix', getMatrix);

/**
 * @route   GET /api/submissions/:submissionId/matrix/:matrixId
 * @desc    Get a specific matrix by ID
 * @access  Private
 */
router.get('/submissions/:submissionId/matrix/:matrixId', getMatrix);

/**
 * @route   POST /api/submissions/:submissionId/matrix/:matrixId/course
 * @desc    Add a course column to the matrix
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/matrix/:matrixId/course', addCourse);

/**
 * @route   DELETE /api/submissions/:submissionId/matrix/:matrixId/course/:courseId
 * @desc    Remove a course column from the matrix
 * @access  Private (Program Coordinator, Admin)
 */
router.delete('/submissions/:submissionId/matrix/:matrixId/course/:courseId', removeCourse);

/**
 * @route   PUT /api/submissions/:submissionId/matrix/:matrixId/assessment
 * @desc    Update assessment for a cell (course x specification)
 * @access  Private (Program Coordinator, Admin)
 */
router.put('/submissions/:submissionId/matrix/:matrixId/assessment', updateAssessment);

/**
 * @route   PUT /api/submissions/:submissionId/matrix/:matrixId/reorder
 * @desc    Reorder courses in the matrix
 * @access  Private (Program Coordinator, Admin)
 */
router.put('/submissions/:submissionId/matrix/:matrixId/reorder', reorderCourses);

/**
 * @route   POST /api/submissions/:submissionId/matrix/:matrixId/import
 * @desc    Import matrix from CSV/Excel data
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/matrix/:matrixId/import', importMatrix);

/**
 * @route   GET /api/submissions/:submissionId/matrix/:matrixId/export
 * @desc    Export matrix data (JSON or CSV)
 * @access  Private
 * @query   format - 'json' or 'csv'
 */
router.get('/submissions/:submissionId/matrix/:matrixId/export', exportMatrix);

export default router;
