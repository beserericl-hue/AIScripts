import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Submission, BoardDecisionOutcome } from '../models/Submission';
import { recordAuditEvent } from '../services/auditLog';

// ---------------------------------------------------------------------------
// CR-053 / Sprint 7.1 — Board decisions + simple cycle-reminder scheduler.
//
// Endpoints:
//   POST  /api/submissions/:submissionId/decision    — admin/superuser only
//   GET   /api/board/upcoming-reaccreditations?withinDays=N
//
// Decision semantics:
//   - accept   → submission.status = 'compliant'; if effectiveAt is given,
//                expiresAt defaults to effectiveAt + 7 years
//   - deny     → status = 'non_compliant'
//   - suspend  → status = 'non_compliant'
//   - revoke   → status = 'non_compliant'
//   - table    → status stays under_review / review_complete; reconsiderAt
//                MUST be provided so the board calendar can list it
//
// Audit `board.decision_recorded` carries the prior outcome (for re-decides)
// + the new outcome + comments + effectiveAt/expiresAt/reconsiderAt + the
// decider's name.
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    isSuperuser?: boolean;
  };
}

function _actorName(req: AuthenticatedRequest): string {
  if (req.user?.name) return req.user.name;
  const first = req.user?.firstName || '';
  const last = req.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || req.user?.email || 'unknown';
}

function _isElevated(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.isSuperuser === true;
}

const ALLOWED_OUTCOMES: BoardDecisionOutcome[] = [
  'accept', 'table', 'deny', 'suspend', 'revoke'
];

function _statusFromOutcome(outcome: BoardDecisionOutcome): string | null {
  if (outcome === 'accept') return 'compliant';
  if (outcome === 'deny' || outcome === 'suspend' || outcome === 'revoke') return 'non_compliant';
  // `table` leaves status untouched.
  return null;
}

export const recordBoardDecision = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can record board decisions.' });
    }
    const { submissionId } = req.params;
    const body = req.body || {};
    const outcome = body.outcome as BoardDecisionOutcome;
    if (!ALLOWED_OUTCOMES.includes(outcome)) {
      return res.status(400).json({
        error: `outcome must be one of: ${ALLOWED_OUTCOMES.join(', ')}`
      });
    }
    if (outcome === 'table' && !body.reconsiderAt) {
      return res.status(400).json({ error: 'reconsiderAt is required when outcome is "table"' });
    }
    if (typeof body.comments !== 'string') {
      return res.status(400).json({ error: 'comments (string) is required' });
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const priorOutcome = submission.decision?.outcome || null;
    const now = new Date();

    let effectiveAt: Date | undefined;
    let expiresAt: Date | undefined;
    if (outcome === 'accept') {
      effectiveAt = body.effectiveAt ? new Date(body.effectiveAt) : now;
      if (body.expiresAt) {
        expiresAt = new Date(body.expiresAt);
      } else {
        // CSHSE default: 7-year accreditation cycle.
        const seven = new Date(effectiveAt);
        seven.setFullYear(seven.getFullYear() + 7);
        expiresAt = seven;
      }
    }
    const reconsiderAt = outcome === 'table' && body.reconsiderAt
      ? new Date(body.reconsiderAt)
      : undefined;

    submission.decision = {
      outcome,
      decidedBy: new mongoose.Types.ObjectId(req.user!.id),
      decidedByName: _actorName(req),
      decidedAt: now,
      comments: body.comments,
      reconsiderAt,
      effectiveAt,
      expiresAt
    };

    const nextStatus = _statusFromOutcome(outcome);
    if (nextStatus) submission.status = nextStatus as any;

    await submission.save();

    void recordAuditEvent({
      action: 'board.decision_recorded',
      actor: { id: req.user!.id, role: req.user!.role, name: _actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: {
        outcome,
        priorOutcome,
        comments: body.comments,
        effectiveAt: effectiveAt ? effectiveAt.toISOString() : null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        reconsiderAt: reconsiderAt ? reconsiderAt.toISOString() : null,
        statusAfter: submission.status
      }
    });

    return res.json({ decision: submission.decision, status: submission.status });
  } catch (err) {
    console.error('recordBoardDecision error:', err);
    return res.status(500).json({ error: 'Failed to record decision' });
  }
};

/**
 * GET /api/board/upcoming-reaccreditations?withinDays=N
 *
 * Returns submissions whose `decision.expiresAt` lands within the next
 * N days (default 365). Used by the board calendar to know which
 * institutions are approaching their re-accreditation window. Also
 * surfaces tabled decisions whose `reconsiderAt` lands inside the
 * window.
 *
 * Admin / superuser only.
 */
export const upcomingReaccreditations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can view the board calendar.' });
    }
    const within = Math.min(Math.max(parseInt(String(req.query.withinDays || '365'), 10) || 365, 1), 365 * 5);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + within);

    const expiring = await Submission.find({
      'decision.outcome': 'accept',
      'decision.expiresAt': { $lte: horizon, $gte: new Date() }
    })
      .select('submissionId institutionName programName programLevel decision status')
      .sort({ 'decision.expiresAt': 1 })
      .lean();

    const tabled = await Submission.find({
      'decision.outcome': 'table',
      'decision.reconsiderAt': { $lte: horizon, $gte: new Date() }
    })
      .select('submissionId institutionName programName programLevel decision status')
      .sort({ 'decision.reconsiderAt': 1 })
      .lean();

    return res.json({
      withinDays: within,
      horizon: horizon.toISOString(),
      expiring: expiring.map((s: any) => ({
        _id: String(s._id),
        submissionId: s.submissionId,
        institutionName: s.institutionName,
        programName: s.programName,
        programLevel: s.programLevel,
        status: s.status,
        expiresAt: s.decision?.expiresAt
      })),
      tabled: tabled.map((s: any) => ({
        _id: String(s._id),
        submissionId: s.submissionId,
        institutionName: s.institutionName,
        programName: s.programName,
        programLevel: s.programLevel,
        status: s.status,
        reconsiderAt: s.decision?.reconsiderAt
      }))
    });
  } catch (err) {
    console.error('upcomingReaccreditations error:', err);
    return res.status(500).json({ error: 'Failed to load board calendar' });
  }
};

/**
 * GET /api/board/queue
 *
 * Submissions in `review_complete` (lead reader compilation done) that
 * have NOT yet received a board decision. Admin / superuser only.
 * The board uses this as their inbox.
 */
export const boardQueue = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can view the board queue.' });
    }
    const rows = await Submission.find({
      status: 'review_complete',
      $or: [{ decision: { $exists: false } }, { 'decision.outcome': null }]
    })
      .select('submissionId institutionName programName programLevel status updatedAt')
      .sort({ updatedAt: 1 })
      .lean();
    return res.json({ submissions: rows });
  } catch (err) {
    console.error('boardQueue error:', err);
    return res.status(500).json({ error: 'Failed to load board queue' });
  }
};
