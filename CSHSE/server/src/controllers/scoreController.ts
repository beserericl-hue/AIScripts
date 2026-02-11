import { Request, Response } from 'express';
import { Score } from '../models/Score';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Upsert a score for the current reviewer on a specific standard+spec
 * PUT /api/submissions/:submissionId/scores
 * Body: { standardCode, specCode, score }
 */
export const upsertScore = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!['reader', 'lead_reader'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Only readers and lead readers can score' });
    }

    const { submissionId } = req.params;
    const { standardCode, specCode, score } = req.body;

    if (!standardCode || !specCode || score === undefined) {
      return res.status(400).json({ error: 'standardCode, specCode, and score are required' });
    }

    if (!Number.isInteger(score) || score < 0 || score > 3) {
      return res.status(400).json({ error: 'Score must be 0, 1, 2, or 3' });
    }

    const result = await Score.findOneAndUpdate(
      {
        submissionId,
        standardCode,
        specCode,
        reviewerId: req.user!.id
      },
      {
        $set: {
          score,
          reviewerName: `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || req.user!.email,
          reviewerRole: req.user!.role
        },
        $setOnInsert: {
          submissionId,
          standardCode,
          specCode,
          reviewerId: req.user!.id
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.json({ score: result });
  } catch (error: any) {
    console.error('Upsert score error:', error);
    return res.status(500).json({ error: 'Failed to save score' });
  }
};

/**
 * Delete a score (unset/clear) for the current reviewer on a specific standard+spec
 * DELETE /api/submissions/:submissionId/scores
 * Body: { standardCode, specCode }
 */
export const deleteScore = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!['reader', 'lead_reader'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Only readers and lead readers can manage scores' });
    }

    const { submissionId } = req.params;
    const { standardCode, specCode } = req.body;

    await Score.deleteOne({
      submissionId,
      standardCode,
      specCode,
      reviewerId: req.user!.id
    });

    return res.json({ message: 'Score cleared' });
  } catch (error: any) {
    console.error('Delete score error:', error);
    return res.status(500).json({ error: 'Failed to delete score' });
  }
};

/**
 * Get all scores for a submission (for the current reviewer or all if lead_reader/admin)
 * GET /api/submissions/:submissionId/scores
 * Query: ?reviewerId=xxx (optional, admin/lead_reader can query others)
 */
export const getScores = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'program_coordinator') {
      return res.json({ scores: [] });
    }

    const { submissionId } = req.params;
    const { reviewerId } = req.query;

    const filter: any = { submissionId };

    // Readers can only see their own scores; lead_reader and admin can see all
    if (req.user?.role === 'reader') {
      filter.reviewerId = req.user.id;
    } else if (reviewerId) {
      filter.reviewerId = reviewerId;
    }

    const scores = await Score.find(filter).lean();

    return res.json({ scores });
  } catch (error: any) {
    console.error('Get scores error:', error);
    return res.status(500).json({ error: 'Failed to get scores' });
  }
};

/**
 * Get averaged scores summary for a submission
 * GET /api/submissions/:submissionId/scores/summary
 * Returns: { bySpec, byStandard, global }
 */
export const getScoreSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role === 'program_coordinator') {
      return res.json({ bySpec: {}, byStandard: {}, global: null });
    }

    const { submissionId } = req.params;

    const scores = await Score.find({ submissionId }).lean();

    if (scores.length === 0) {
      return res.json({ bySpec: {}, byStandard: {}, global: null });
    }

    // Group by standard+spec
    const bySpecMap = new Map<string, number[]>();
    for (const s of scores) {
      const key = `${s.standardCode}_${s.specCode}`;
      if (!bySpecMap.has(key)) bySpecMap.set(key, []);
      bySpecMap.get(key)!.push(s.score);
    }

    // Average per spec
    const bySpec: Record<string, { average: number; count: number }> = {};
    for (const [key, values] of bySpecMap) {
      bySpec[key] = {
        average: values.reduce((a, b) => a + b, 0) / values.length,
        count: values.length
      };
    }

    // Average per standard
    const byStandardMap = new Map<string, number[]>();
    for (const [key, data] of Object.entries(bySpec)) {
      const standardCode = key.split('_')[0];
      if (!byStandardMap.has(standardCode)) byStandardMap.set(standardCode, []);
      byStandardMap.get(standardCode)!.push(data.average);
    }

    const byStandard: Record<string, { average: number; specCount: number }> = {};
    for (const [code, averages] of byStandardMap) {
      byStandard[code] = {
        average: averages.reduce((a, b) => a + b, 0) / averages.length,
        specCount: averages.length
      };
    }

    // Global average (average of all standard averages)
    const standardAverages = Object.values(byStandard).map(s => s.average);
    const globalAverage = standardAverages.length > 0
      ? standardAverages.reduce((a, b) => a + b, 0) / standardAverages.length
      : null;

    return res.json({ bySpec, byStandard, global: globalAverage });
  } catch (error: any) {
    console.error('Get score summary error:', error);
    return res.status(500).json({ error: 'Failed to get score summary' });
  }
};
