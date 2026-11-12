import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { LeadFinalMark, normalizeFinalMark, FinalMark } from '../models/LeadFinalMark';
import { ReaderReport } from '../models/ReaderReport';
import { Submission } from '../models/Submission';
import { User } from '../models/User';
import { SiteVisitChecklistItem } from '../models/SiteVisitChecklistItem';
import { recordAuditEvent } from '../services/auditLog';
import { notify } from '../services/notificationService';
import { generateSuggestionsDocx, SuggestionsMode } from '../services/suggestionsDocx';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';

// ---------------------------------------------------------------------------
// CR-009 / Sprint 5.1 — lead-reader compilation surface.
//
// Lauri CR (Nov 2026): the 0–3 numeric rating is removed. Each reader's
// decision per specification is the Compliant / Non-compliant MARK on their
// own Reader Report (ReaderReport.rows[].mark). This controller is the lead
// reader's side-by-side view of those marks:
//   - GET /api/submissions/:id/compilation
//       → every reader's mark per (std, spec), with disagreement /
//         any-non-compliant flags, plus the lead reader's Final mark.
//   - PUT /api/submissions/:id/compilation/final-mark
//       → set the Final mark (compliant | noncompliant) for one spec.
//   - DELETE /api/submissions/:id/compilation/final-mark
//       → clear a Final mark.
// Both writes are audit-logged and keep the site-visit checklist in sync.
//
// Role gate: lead_reader, admin, superuser. Readers and PCs see 403.
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    isSuperuser?: boolean;
    institutionId?: string;
  };
}

function isLeadOrAdmin(req: AuthenticatedRequest): boolean {
  const role = req.user?.role;
  return role === 'lead_reader' || role === 'admin' || req.user?.isSuperuser === true;
}

function effectiveRole(req: AuthenticatedRequest): 'lead_reader' | 'admin' | 'superuser' {
  if (req.user?.isSuperuser) return 'superuser';
  if (req.user?.role === 'admin') return 'admin';
  return 'lead_reader';
}

function actorName(req: AuthenticatedRequest): string {
  const first = req.user?.firstName || '';
  const last = req.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || req.user?.email || 'unknown';
}

/**
 * CR-012 — site-visit checklist sync for a lead Final mark.
 *
 *   'noncompliant' → upsert the row with inclusionReason='non_compliant'
 *                    (a lead reader's manual / follow-up row is kept as is)
 *   'compliant'    → remove the AUTO row unless it has been verified
 *                    (the visit team's note is sticky). Manual rows stay.
 *
 * Never throws — a checklist hiccup must not fail the user-facing write.
 */
export async function syncChecklistForFinalMark(opts: {
  submissionId: string;
  standardCode: string;
  specCode: string;
  finalMark: FinalMark;
  addedByName: string;
}): Promise<void> {
  try {
    const { submissionId, standardCode, specCode, finalMark, addedByName } = opts;
    const filter = { submissionId: new mongoose.Types.ObjectId(submissionId), standardCode, specCode };

    if (finalMark === 'noncompliant') {
      const existing = await SiteVisitChecklistItem.findOne(filter).select('source').lean();
      if (existing && existing.source === 'manual') {
        await SiteVisitChecklistItem.updateOne(filter, { $set: { finalMarkAtInclusion: 'noncompliant' } });
        return;
      }
      await SiteVisitChecklistItem.updateOne(
        filter,
        {
          $set: {
            inclusionReason: 'non_compliant',
            finalMarkAtInclusion: 'noncompliant',
            addedByName,
            source: 'auto'
          },
          $setOnInsert: {
            submissionId: filter.submissionId,
            standardCode,
            specCode,
            verified: false
          }
        },
        { upsert: true }
      );
      // Drop the retired numeric field from a legacy row (not in the schema,
      // so it goes through the raw collection).
      await SiteVisitChecklistItem.collection.updateOne(filter, { $unset: { finalScoreAtInclusion: '' } });
    } else {
      await SiteVisitChecklistItem.deleteOne({ ...filter, source: 'auto', verified: false });
    }
  } catch (err) {
    console.error('[checklist] syncChecklistForFinalMark failed:', err);
  }
}

type ReaderMark = 'compliant' | 'noncompliant';

/**
 * GET /api/submissions/:submissionId/compilation
 *
 * Shape:
 * {
 *   submissionId, institutionName, programName, programLevel, status,
 *   readers: [{ id, name, completed }],
 *   rows: [{
 *     standardCode, specCode,
 *     marks: [{ reviewerId, reviewerName, mark }],   // each reader's OWN mark
 *     hasNonCompliant: boolean,   // ≥1 reader marked it Non-compliant
 *     hasDisagreement: boolean,   // readers' marks differ
 *     allAgree: boolean,          // ≥2 readers, all the same mark
 *     finalMark: 'compliant' | 'noncompliant' | null,
 *     finalSetByName?, finalSetAt?, finalNote?,
 *     excluded: boolean, excludedReason?
 *   }]
 * }
 *
 * Only numbered standards with a specification code are compiled (the
 * Introduction rows have no lead Final). A reader is listed once they have
 * marked at least one specification.
 */
export const getCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId); if (!_sub) return;
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can view the compilation' });
    }

    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const [reports, finalsRaw] = await Promise.all([
      ReaderReport.find({ submissionId }).select('reviewerId rows completedAt').lean(),
      LeadFinalMark.find({ submissionId }).lean()
    ]);
    // Legacy 0–3 documents carry no finalMark — dropped from use.
    const finals = finalsRaw.filter((f) => f.finalMark === 'compliant' || f.finalMark === 'noncompliant');

    const reviewerIds = reports.map((r) => String(r.reviewerId));
    const users = reviewerIds.length
      ? await User.find({ _id: { $in: reviewerIds } }).select('firstName lastName email').lean()
      : [];
    const nameById = new Map<string, string>(
      users.map((u: any) => [String(u._id), `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Reader'])
    );

    const marksByKey = new Map<string, Array<{ reviewerId: string; reviewerName: string; mark: ReaderMark }>>();
    const readers = new Map<string, { id: string; name: string; completed: boolean }>();
    for (const rep of reports) {
      const rid = String(rep.reviewerId);
      const name = nameById.get(rid) || 'Reader';
      let marked = false;
      for (const row of rep.rows || []) {
        const std = String(row.standardCode || '');
        const spec = String(row.specCode || '');
        if (!/^\d+$/.test(std) || !spec) continue;
        if (row.mark !== 'compliant' && row.mark !== 'noncompliant') continue;
        const key = `${std}_${spec}`;
        if (!marksByKey.has(key)) marksByKey.set(key, []);
        marksByKey.get(key)!.push({ reviewerId: rid, reviewerName: name, mark: row.mark });
        marked = true;
      }
      if (marked) readers.set(rid, { id: rid, name, completed: !!rep.completedAt });
    }

    const finalsByKey = new Map<string, typeof finals[number]>();
    for (const f of finals) finalsByKey.set(`${f.standardCode}_${f.specCode}`, f);

    // standardsStatus is a Mongoose Map — convert to plain object for lookups.
    const status = (submission as any).standardsStatus instanceof Map
      ? Object.fromEntries((submission as any).standardsStatus)
      : ((submission as any).standardsStatus || {});

    const allKeys = new Set<string>([...marksByKey.keys(), ...finalsByKey.keys()]);
    const rows = Array.from(allKeys).map((key) => {
      const idx = key.indexOf('_');
      const standardCode = key.slice(0, idx);
      const specCode = key.slice(idx + 1);
      const rowMarks = marksByKey.get(key) || [];
      const values = rowMarks.map((m) => m.mark);
      const distinct = new Set(values).size;
      const fin = finalsByKey.get(key);
      const statusForKey = status[key] || {};
      return {
        standardCode,
        specCode,
        marks: rowMarks,
        hasNonCompliant: values.includes('noncompliant'),
        hasDisagreement: values.length > 1 && distinct > 1,
        allAgree: values.length > 1 && distinct === 1,
        finalMark: fin ? (fin.finalMark as FinalMark) : null,
        finalSetByName: fin?.setByName,
        finalSetAt: fin?.updatedAt,
        finalNote: fin?.note,
        excluded: statusForKey.excluded === true,
        excludedReason: statusForKey.excludedReason
      };
    });

    rows.sort((a, b) => {
      if (a.standardCode !== b.standardCode) {
        return a.standardCode.localeCompare(b.standardCode, undefined, { numeric: true });
      }
      return a.specCode.localeCompare(b.specCode, undefined, { numeric: true });
    });

    return res.json({
      submissionId: String(submission._id),
      institutionName: submission.institutionName,
      programName: submission.programName,
      programLevel: submission.programLevel,
      status: submission.status,
      readers: Array.from(readers.values()).sort((a, b) => a.name.localeCompare(b.name)),
      rows
    });
  } catch (error) {
    console.error('Get compilation error:', error);
    return res.status(500).json({ error: 'Failed to get compilation' });
  }
};

/**
 * PUT /api/submissions/:submissionId/compilation/final-mark
 * Body: { standardCode, specCode, mark: 'compliant' | 'noncompliant', note? }
 */
export const setFinalMark = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId); if (!_sub) return;
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can set a final mark' });
    }

    const { submissionId } = req.params;
    const { standardCode, specCode, mark, note } = req.body || {};

    if (!standardCode || !specCode || mark === undefined || mark === null || mark === '') {
      return res.status(400).json({ error: 'standardCode, specCode, and mark are required' });
    }
    const finalMark = normalizeFinalMark(mark);
    if (!finalMark) {
      return res.status(400).json({ error: 'mark must be "compliant" or "noncompliant"' });
    }

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const existing = await LeadFinalMark.findOne({ submissionId, standardCode, specCode }).lean();

    const result = await LeadFinalMark.findOneAndUpdate(
      { submissionId, standardCode, specCode },
      {
        $set: {
          finalMark,
          setById: new mongoose.Types.ObjectId(req.user!.id),
          setByName: actorName(req),
          setByRole: effectiveRole(req),
          note: note ?? undefined
        },
        $setOnInsert: {
          submissionId: new mongoose.Types.ObjectId(submissionId),
          standardCode,
          specCode
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
    // Drop the retired numeric value from a legacy doc being re-set (not in
    // the schema, so through the raw collection).
    await LeadFinalMark.collection.updateOne(
      { _id: result!._id },
      { $unset: { score: '' } }
    );

    void recordAuditEvent({
      action: 'compilation.final_set',
      actor: { id: req.user!.id, role: req.user!.role, name: actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: {
        standardCode,
        specCode,
        finalMark,
        priorFinalMark: existing?.finalMark ?? null,
        note: note ?? null
      }
    });

    // CR-012 — Non-compliant adds the spec to the site-visit checklist;
    // Compliant removes the auto row (verified rows are kept). Awaited so the
    // contract is "after this 200 returns, the checklist reflects it".
    await syncChecklistForFinalMark({
      submissionId: String(submissionId),
      standardCode,
      specCode,
      finalMark,
      addedByName: actorName(req)
    });

    return res.json({ finalMark: result });
  } catch (error) {
    console.error('Set final mark error:', error);
    return res.status(500).json({ error: 'Failed to set final mark' });
  }
};

/**
 * DELETE /api/submissions/:submissionId/compilation/final-mark
 * Body: { standardCode, specCode }
 */
export const clearFinalMark = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId); if (!_sub) return;
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can clear a final mark' });
    }

    const { submissionId } = req.params;
    const { standardCode, specCode } = req.body || {};

    if (!standardCode || !specCode) {
      return res.status(400).json({ error: 'standardCode and specCode are required' });
    }

    const existing = await LeadFinalMark.findOne({ submissionId, standardCode, specCode }).lean();

    await LeadFinalMark.deleteOne({ submissionId, standardCode, specCode });

    void recordAuditEvent({
      action: 'compilation.final_cleared',
      actor: { id: req.user!.id, role: req.user!.role, name: actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: {
        standardCode,
        specCode,
        priorFinalMark: existing?.finalMark ?? null
      }
    });

    // CR-012 — clearing the Final removes auto-populated checklist rows;
    // verified rows are preserved.
    try {
      await SiteVisitChecklistItem.deleteOne({
        submissionId: new mongoose.Types.ObjectId(submissionId),
        standardCode,
        specCode,
        source: 'auto',
        verified: false
      });
    } catch (e) {
      console.error('[checklist] delete on clearFinalMark failed:', e);
    }

    return res.json({ cleared: true });
  } catch (error) {
    console.error('Clear final mark error:', error);
    return res.status(500).json({ error: 'Failed to clear final mark' });
  }
};

/**
 * GET /api/submissions/:submissionId/compilation/suggestions-doc?mode=internal|pc_facing
 *
 * CR-011 — consolidated reader-suggestions DOCX. Lead reader / admin only.
 * Server-side redaction in pc_facing mode (PC may never see unrelayed
 * reader comments or reader identities).
 */
export const exportSuggestionsDoc = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId); if (!_sub) return;
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can export suggestions' });
    }

    const { submissionId } = req.params;
    const rawMode = (req.query.mode as string) || 'internal';
    const mode: SuggestionsMode = rawMode === 'pc_facing' ? 'pc_facing' : 'internal';

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const buffer = await generateSuggestionsDocx({ submissionId, mode });

    const safeName = String(submission.institutionName || 'submission')
      .replace(/[^a-zA-Z0-9_.-]+/g, '_')
      .slice(0, 60);
    const filename = `suggestions_${safeName}_${mode}_${new Date().toISOString().slice(0, 10)}.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Suggestions-Mode', mode);
    return res.send(buffer);
  } catch (error) {
    console.error('Export suggestions doc error:', error);
    return res.status(500).json({ error: 'Failed to export suggestions document' });
  }
};

/**
 * POST /api/submissions/:submissionId/compilation/finalize
 *
 * CR-056 — lead-reader "Complete review & send to board". Flips a submission
 * whose reader review is done into `review_complete`, the status the board
 * queue (GET /api/board/queue) reads. Before this, nothing in the modern
 * compilation UI advanced a submission past `readers_assigned`,
 * so the board step was unreachable through the product — the reader →
 * lead-reader → board chain dead-ended at compilation.
 *
 * Lead reader / admin / superuser only. A lead reader finalizing claims the
 * compilation (stamps submission.leadReader). Idempotent: re-finalizing an
 * already-complete submission is a no-op success. Audit-logged; notifies the
 * board (active admins) fail-soft.
 */
export const finalizeCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const _sub = await requireSubmissionAccess(req as any, res, req.params.submissionId); if (!_sub) return;
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can send a review to the board' });
    }

    const { submissionId } = req.params;
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Idempotent — already at (or past) the board hand-off.
    if (submission.status === 'review_complete') {
      return res.json({ ok: true, status: 'review_complete', alreadyComplete: true });
    }
    if (submission.status === 'compliant' || submission.status === 'non_compliant') {
      return res.status(409).json({
        error: `This self-study already has a board decision (status "${submission.status}").`
      });
    }

    const ADVANCEABLE = ['submitted', 'readers_assigned', 'under_review'];
    if (!ADVANCEABLE.includes(submission.status)) {
      return res.status(409).json({
        error: `Cannot send to the board from status "${submission.status}". The self-study must be submitted and under reader review first.`
      });
    }

    const priorStatus = submission.status;
    // A lead reader who finalizes claims the compilation; admins/superusers
    // leave any existing lead reader in place.
    if (req.user?.role === 'lead_reader' && req.user?.id) {
      submission.leadReader = new mongoose.Types.ObjectId(req.user.id);
    }
    submission.status = 'review_complete';
    await submission.save();

    void recordAuditEvent({
      action: 'compilation.finalized',
      actor: { id: req.user!.id, role: req.user!.role, name: actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: { priorStatus, newStatus: 'review_complete' }
    });

    // Notify the board (active admins) that a review is ready to decide.
    void (async () => {
      try {
        const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
        for (const a of admins) {
          await notify({
            recipientId: String(a._id),
            type: 'board.ready',
            title: 'A review is ready for a board decision',
            body: `${submission.institutionName} — ${submission.programName}: reader review is complete and awaiting a board decision.`,
            link: `/admin/board`,
            submissionId: String(submissionId),
            dedupeKey: `board.ready:${submissionId}`,
            email: true
          });
        }
      } catch (e) {
        console.error('finalizeCompilation notify (non-fatal):', e);
      }
    })();

    return res.json({ ok: true, status: 'review_complete' });
  } catch (error) {
    console.error('Finalize compilation error:', error);
    return res.status(500).json({ error: 'Failed to send review to the board' });
  }
};
