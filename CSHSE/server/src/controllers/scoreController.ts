import { Request, Response } from 'express';
import { Score } from '../models/Score';
import { isGlobalAdmin, institutionIdsWithRole } from '../services/roleResolver';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email: string;
    firstName?: string;
    lastName?: string;
    institutionId?: string;
    isSuperuser?: boolean;
    realIsSuperuser?: boolean;
    // CR-060 — per-institution role assignments.
    roleAssignments?: Array<{ role: string; institutionId: string; institutionName?: string }>;
  };
}

// CR-060 — a caller may enter/clear scores if they hold a reviewer role
// (reader/lead_reader) at ANY institution, or are a global admin. Assignment
// scopes WHICH submission they're actually working on (enforced upstream by the
// reader-report/getSubmission gates). reader folds lead in institutionIdsWithRole.
function canScore(u: AuthenticatedRequest['user']): boolean {
  // global admin, OR a legacy global reviewer (primary role reader/lead with no
  // institution), OR an institution-scoped reviewer assignment.
  return isGlobalAdmin(u as any)
    || u?.role === 'reader' || u?.role === 'lead_reader'
    || institutionIdsWithRole(u as any, 'reader').length > 0;
}
function isLeadOrAdminAnywhere(u: AuthenticatedRequest['user']): boolean {
  return isGlobalAdmin(u as any)
    || u?.role === 'lead_reader'
    || institutionIdsWithRole(u as any, 'lead_reader').length > 0;
}

/**
 * Upsert a score for the current reviewer on a specific standard+spec
 * PUT /api/submissions/:submissionId/scores
 * Body: { standardCode, specCode, score }
 */
export const upsertScore = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // SECURITY (cross-tenant isolation) — gate on the submission first.
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId);
    if (!_sub) return;

    if (!canScore(req.user)) {
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

    // CR-060 — Score.reviewerRole only allows reader/lead_reader. Derive it from
    // the caller's REVIEWER role (a cross-role user whose primary role is
    // program_coordinator but who scores as a reader must record 'reader' /
    // 'lead_reader', never their primary role).
    const reviewerRole: 'reader' | 'lead_reader' =
      isLeadOrAdminAnywhere(req.user) && !isGlobalAdmin(req.user as any) ? 'lead_reader' : 'reader';

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
          reviewerRole
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
    // SECURITY (cross-tenant isolation) — gate on the submission first.
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId);
    if (!_sub) return;

    if (!canScore(req.user)) {
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
    // SECURITY (cross-tenant isolation) — gate on the submission first.
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId);
    if (!_sub) return;

    // CR-060 — non-reviewers (PC-only / no role) see no scores.
    if (!canScore(req.user)) {
      return res.json({ scores: [] });
    }

    const { submissionId } = req.params;
    const { reviewerId } = req.query;

    const filter: any = { submissionId };

    // A plain reader sees only their own scores; a lead reader (anywhere) or
    // admin can see all (or a requested reviewer's).
    if (!isLeadOrAdminAnywhere(req.user)) {
      filter.reviewerId = req.user!.id;
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
    // SECURITY (cross-tenant isolation) — gate on the submission first.
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId);
    if (!_sub) return;

    // CR-060 — non-reviewers (PC-only / no role) get no score summary.
    if (!canScore(req.user)) {
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
