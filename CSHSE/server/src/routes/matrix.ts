import { Router } from 'express';
import {
  getMatrix,
  addCourse,
  removeCourse,
  updateAssessment,
  reorderCourses,
  importMatrix,
  exportMatrix,
  addRawContent,
  parseMatrixContent,
  duplicateStandardRow,
  removeStandardRow
} from '../controllers/matrixController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

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

/**
 * @route   POST /api/submissions/:submissionId/matrix/:matrixId/raw-content
 * @desc    Add raw imported content to matrix for reference
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/matrix/:matrixId/raw-content', addRawContent);

/**
 * @route   POST /api/submissions/:submissionId/matrix/:matrixId/parse
 * @desc    Parse raw matrix HTML into structured courses + assessments (preview only)
 * @access  Private
 */
router.post('/submissions/:submissionId/matrix/:matrixId/parse', parseMatrixContent);

/**
 * @route   POST /api/submissions/:submissionId/matrix/:matrixId/duplicate-row
 * @desc    Create a duplicate standard/spec row for additional assessments
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/matrix/:matrixId/duplicate-row', duplicateStandardRow);

/**
 * @route   DELETE /api/submissions/:submissionId/matrix/:matrixId/remove-row
 * @desc    Remove a duplicate standard/spec row (rowIndex > 0 only)
 * @access  Private (Program Coordinator, Admin)
 */
router.delete('/submissions/:submissionId/matrix/:matrixId/remove-row', removeStandardRow);

export default router;
