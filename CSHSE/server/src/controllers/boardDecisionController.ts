import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Submission, BoardDecisionOutcome } from '../models/Submission';
import { User } from '../models/User';
import { recordAuditEvent } from '../services/auditLog';
import { notify } from '../services/notificationService';

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

    // CR-010 / S12.2 — notify the PC (submitter) that the board ruled on their
    // submission. Fail-soft. dedupeKey embeds decidedAt so a re-decide produces
    // a fresh ping while a duplicate request for the same decision doesn't.
    void (async () => {
      try {
        const submitterId = (submission as any).submitterId;
        if (submitterId) {
          await notify({
            recipientId: String(submitterId),
            type: 'board.decision',
            title: `Board decision: ${outcome}`,
            body: `${submission.institutionName} — ${submission.programName}: the board recorded a decision of "${outcome}".`,
            link: `/self-study/${String(submissionId)}`,
            submissionId: String(submissionId),
            dedupeKey: `board.decision:${String(submissionId)}:${now.toISOString()}`,
            email: true,
          });
        }
      } catch (e) {
        console.error('recordBoardDecision notify (non-fatal):', e);
      }
    })();

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

/**
 * POST /api/board/run-cycle-reminders?withinDays=N
 *
 * Scans for accreditations expiring (`accept` decisions whose `expiresAt`
 * lands inside the window) and tabled decisions due for reconsideration
 * (`reconsiderAt` inside the window), then notifies every admin / superuser.
 *
 * Idempotent: each notification carries a dedupeKey that embeds the relevant
 * date, so re-running never double-notifies — and a re-decided submission
 * with a new expiresAt produces a fresh reminder (different date → new key).
 *
 * Admin / superuser only. This server has no in-process cron; the endpoint is
 * meant to be driven by an external scheduler or fired by an admin from the
 * Board Console (CR-053 deferred: the data was queryable; this pushes it).
 */
export const runCycleReminders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can run cycle reminders.' });
    }
    const within = Math.min(
      Math.max(parseInt(String(req.query.withinDays || '180'), 10) || 180, 1),
      365 * 5
    );
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + within);

    const [expiring, tabled, admins] = await Promise.all([
      Submission.find({
        'decision.outcome': 'accept',
        'decision.expiresAt': { $lte: horizon, $gte: now }
      })
        .select('submissionId institutionName programName decision')
        .lean(),
      Submission.find({
        'decision.outcome': 'table',
        'decision.reconsiderAt': { $lte: horizon, $gte: now }
      })
        .select('submissionId institutionName programName decision')
        .lean(),
      User.find({ $or: [{ role: 'admin' }, { isSuperuser: true }] })
        .select('_id')
        .lean()
    ]);

    let notificationsCreated = 0;

    const fanOut = async (
      rows: any[],
      type: 'board.cycle_reminder' | 'board.reconsider_reminder',
      dateField: 'expiresAt' | 'reconsiderAt',
      keyPrefix: string,
      title: string,
      verb: string
    ) => {
      for (const s of rows) {
        const when = s.decision?.[dateField];
        if (!when) continue;
        const dateKey = new Date(when).toISOString().slice(0, 10);
        const body = `${s.institutionName} — ${s.programName} ${verb} ${dateKey}.`;
        for (const a of admins) {
          const created = await notify({
            recipientId: String(a._id),
            type,
            title,
            body,
            link: '/admin/board',
            submissionId: String(s._id),
            dedupeKey: `${keyPrefix}:${String(s._id)}:${dateKey}`,
            email: true
          });
          if (created) notificationsCreated++;
        }
      }
    };

    await fanOut(
      expiring,
      'board.cycle_reminder',
      'expiresAt',
      'cycle',
      'Accreditation expiring soon',
      'expires'
    );
    await fanOut(
      tabled,
      'board.reconsider_reminder',
      'reconsiderAt',
      'reconsider',
      'Tabled decision due for reconsideration',
      'is due for reconsideration'
    );

    return res.json({
      withinDays: within,
      scanned: { expiring: expiring.length, tabled: tabled.length },
      adminRecipients: admins.length,
      notificationsCreated
    });
  } catch (err) {
    console.error('runCycleReminders error:', err);
    return res.status(500).json({ error: 'Failed to run cycle reminders' });
  }
};

/**
 * POST /api/board/spin-up-reaccreditations?withinDays=N
 *
 * CR-053 / S12.1 — reaccreditation workflow auto-creation.
 *
 * Scans accept decisions whose `expiresAt` lands inside the window (default
 * 365 days; a CSHSE cycle is 7y so a year's notice is the sane default) and,
 * for each prior cycle that does NOT yet have a reaccreditation child, spins
 * up a fresh `type: 'reaccreditation'` self-study in `draft` for the same
 * institution / program / coordinator, links it back via `reaccreditationOf`,
 * and notifies the PC (the prior submitter) to begin the new cycle.
 *
 * Idempotent: `reaccreditationOf` is the dedupe key — a prior cycle yields at
 * most one reaccreditation child, so re-running the scan never duplicates.
 *
 * Admin / superuser only. No in-process cron; driven by an external scheduler
 * or a manual Board Console trigger (mirrors runCycleReminders).
 */
export const spinUpReaccreditations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can spin up reaccreditations.' });
    }
    const within = Math.min(
      Math.max(parseInt(String(req.query.withinDays || '365'), 10) || 365, 1),
      365 * 5
    );
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + within);

    const expiring = await Submission.find({
      'decision.outcome': 'accept',
      'decision.expiresAt': { $lte: horizon, $gte: now }
    })
      .select('submissionId institutionId institutionName programName programLevel submitterId decision')
      .lean();

    // Pre-compute the running submissionId counter once so multiple
    // creations in a single run don't collide on the unique index.
    const year = now.getFullYear();
    let yearCount = await Submission.countDocuments({ submissionId: new RegExp(`^${year}-`) });

    const created: Array<{ priorId: string; newId: string; submissionId: string }> = [];
    let skippedExisting = 0;
    let notificationsCreated = 0;

    for (const prior of expiring) {
      const priorId = (prior as any)._id;

      // Idempotency: one reaccreditation child per prior cycle.
      const already = await Submission.exists({ reaccreditationOf: priorId });
      if (already) {
        skippedExisting++;
        continue;
      }

      yearCount += 1;
      const submissionId = `${year}-${String(yearCount).padStart(3, '0')}`;

      // Initialize the 21-standard status map (mirrors createSubmission).
      const standardsStatus: Record<string, any> = {};
      for (let i = 1; i <= 21; i++) {
        standardsStatus[String(i)] = {
          status: 'not_started',
          completionPercentage: 0,
          lastModified: now
        };
      }

      const child = await Submission.create({
        submissionId,
        institutionId: (prior as any).institutionId,
        institutionName: (prior as any).institutionName,
        programName: (prior as any).programName,
        programLevel: (prior as any).programLevel || 'bachelors',
        submitterId: (prior as any).submitterId,
        type: 'reaccreditation',
        reaccreditationOf: priorId,
        status: 'draft',
        standardsStatus,
        selfStudyProgress: {
          totalSections: 21,
          completedSections: 0,
          validatedSections: 0,
          passedSections: 0,
          failedSections: 0,
          lastActivity: now
        }
      });

      created.push({
        priorId: String(priorId),
        newId: String(child._id),
        submissionId
      });

      void recordAuditEvent({
        action: 'submission.reaccreditation_spun_up',
        actor: { id: req.user!.id, role: req.user!.role, name: _actorName(req) },
        targetType: 'submission',
        targetId: String(child._id),
        submissionId: String(child._id),
        payload: {
          reaccreditationOf: String(priorId),
          institutionName: (prior as any).institutionName,
          programName: (prior as any).programName,
          priorExpiresAt: (prior as any).decision?.expiresAt
            ? new Date((prior as any).decision.expiresAt).toISOString()
            : null
        }
      });

      // Notify the PC (prior submitter) to begin the new cycle.
      if ((prior as any).submitterId) {
        const expKey = (prior as any).decision?.expiresAt
          ? new Date((prior as any).decision.expiresAt).toISOString().slice(0, 10)
          : 'soon';
        const notified = await notify({
          recipientId: String((prior as any).submitterId),
          type: 'reaccreditation.opened',
          title: 'Time to begin your reaccreditation self-study',
          body: `${(prior as any).institutionName} — ${(prior as any).programName}: your accreditation expires ${expKey}. A new reaccreditation self-study (${submissionId}) has been opened for you.`,
          link: `/self-study/${String(child._id)}`,
          submissionId: String(child._id),
          dedupeKey: `reaccreditation:${String(priorId)}`,
          email: true
        });
        if (notified) notificationsCreated++;
      }
    }

    return res.json({
      withinDays: within,
      scanned: expiring.length,
      created: created.length,
      skippedExisting,
      notificationsCreated,
      submissions: created
    });
  } catch (err) {
    console.error('spinUpReaccreditations error:', err);
    return res.status(500).json({ error: 'Failed to spin up reaccreditations' });
  }
};
