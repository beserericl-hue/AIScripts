import { Router, Request, Response } from 'express';
import { ErrorLog } from '../models/ErrorLog';
import { errorLogger } from '../services/errorLogger';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError } from '../services/errorLogger';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);

/**
 * @route   GET /api/admin/error-logs
 * @desc    Get recent error logs with filtering
 * @access  Admin only
 */
router.get('/',  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    limit = '50',
    severity,
    category,
    resolved,
    startDate,
    endDate
  } = req.query;

  const errors = await errorLogger.getRecentErrors({
    limit: parseInt(limit as string, 10),
    severity: severity as any,
    category: category as any,
    resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
    startDate: startDate ? new Date(startDate as string) : undefined,
    endDate: endDate ? new Date(endDate as string) : undefined
  });

  res.json({
    errors,
    count: errors.length
  });
}));

/**
 * @route   GET /api/admin/error-logs/stats
 * @desc    Get error statistics
 * @access  Admin only
 */
router.get('/stats',  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { days = '7' } = req.query;
  const stats = await errorLogger.getErrorStats(parseInt(days as string, 10));

  res.json(stats);
}));

/**
 * @route   GET /api/admin/error-logs/:errorId
 * @desc    Get a specific error log by error ID
 * @access  Admin only
 */
router.get('/:errorId',  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { errorId } = req.params;

  const errorLog = await ErrorLog.findOne({ errorId }).lean();
  if (!errorLog) {
    throw new NotFoundError('Error log');
  }

  res.json(errorLog);
}));

/**
 * @route   POST /api/admin/error-logs/:errorId/resolve
 * @desc    Mark an error as resolved
 * @access  Admin only
 */
router.post('/:errorId/resolve',  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { errorId } = req.params;
  const { resolution } = req.body;
  const userId = req.user!.id;

  if (!resolution) {
    res.status(400).json({ error: 'Resolution description is required' });
    return;
  }

  const resolved = await errorLogger.resolveError(errorId, userId, resolution);
  if (!resolved) {
    throw new NotFoundError('Error log');
  }

  res.json({ message: 'Error marked as resolved' });
}));

/**
 * @route   GET /api/admin/error-logs/search
 * @desc    Search error logs by message or metadata
 * @access  Admin only
 */
router.get('/search',  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { q, limit = '50' } = req.query;

  if (!q) {
    res.status(400).json({ error: 'Search query is required' });
    return;
  }

  const errors = await ErrorLog.find({
    $or: [
      { message: { $regex: q as string, $options: 'i' } },
      { 'request.path': { $regex: q as string, $options: 'i' } },
      { fingerprint: q as string }
    ]
  })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit as string, 10))
    .lean();

  res.json({
    errors,
    count: errors.length,
    query: q
  });
}));

/**
 * @route   DELETE /api/admin/error-logs/:errorId
 * @desc    Delete an error log (use sparingly)
 * @access  Admin only
 */
router.delete('/:errorId',  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { errorId } = req.params;

  const result = await ErrorLog.deleteOne({ errorId });
  if (result.deletedCount === 0) {
    throw new NotFoundError('Error log');
  }

  res.json({ message: 'Error log deleted' });
}));

export default router;
