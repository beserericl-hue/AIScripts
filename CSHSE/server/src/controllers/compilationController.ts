import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Score } from '../models/Score';
import { LeadFinalScore } from '../models/LeadFinalScore';
import { Submission } from '../models/Submission';
import { recordAuditEvent } from '../services/auditLog';
import { generateSuggestionsDocx, SuggestionsMode } from '../services/suggestionsDocx';

// ---------------------------------------------------------------------------
// CR-009 / Sprint 5.1 — lead-reader compilation surface.
//
// The Sprint 3 reader client writes Score rows (0-3) per (submission, std,
// spec, reviewer). This controller is the lead reader's view of those:
//   - GET /api/submissions/:id/compilation
//       → all readers' 0-3 scores side-by-side per (std, spec), with
//         disagreement + zero flags, plus the lead reader's current
//         Final score per spec (if set).
//   - PUT /api/submissions/:id/compilation/final-score
//       → upsert a Final score for one (std, spec); audit-logged.
//   - DELETE /api/submissions/:id/compilation/final-score
//       → clear a Final score; audit-logged.
//
// Role gate: lead_reader, admin, superuser. Readers and PCs see 403.
// PCs are also blocked at the role-gate level (they should never see
// other readers' raw 0-3 votes).
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
 * GET /api/submissions/:submissionId/compilation
 *
 * Shape:
 * {
 *   submissionId, institutionName, programName, programLevel, status,
 *   readers: [{ id, name }],
 *   rows: [{
 *     standardCode, specCode,
 *     scores: [{ reviewerId, reviewerName, score }],
 *     hasZero: boolean,
 *     hasDisagreement: boolean,
 *     allAgree: boolean,
 *     finalScore: number | null,
 *     finalSetByName?: string,
 *     finalSetAt?: string,
 *     excluded: boolean,
 *     excludedReason?: string
 *   }]
 * }
 *
 * Disagreement: any two scores differ by ≥ 1 (we treat any non-equal
 * pair as disagreement — equivalent for integer 0..3).
 * Zero: at least one reader scored 0.
 * Excluded: the spec is N/A per CR-050 (`standardsStatus[`${std}_${spec}`].excluded`).
 */
export const getCompilation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can view the compilation' });
    }

    const { submissionId } = req.params;

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const [scores, finals] = await Promise.all([
      Score.find({ submissionId }).lean(),
      LeadFinalScore.find({ submissionId }).lean()
    ]);

    // Group reader scores by (std, spec).
    const scoresByKey = new Map<string, Array<{ reviewerId: string; reviewerName: string; score: number }>>();
    const readers = new Map<string, { id: string; name: string }>();
    for (const s of scores) {
      const key = `${s.standardCode}_${s.specCode}`;
      if (!scoresByKey.has(key)) scoresByKey.set(key, []);
      scoresByKey.get(key)!.push({
        reviewerId: String(s.reviewerId),
        reviewerName: s.reviewerName,
        score: s.score
      });
      readers.set(String(s.reviewerId), { id: String(s.reviewerId), name: s.reviewerName });
    }

    const finalsByKey = new Map<string, typeof finals[number]>();
    for (const f of finals) finalsByKey.set(`${f.standardCode}_${f.specCode}`, f);

    // standardsStatus is a Mongoose Map — convert to plain object for lookups.
    const status = (submission as any).standardsStatus instanceof Map
      ? Object.fromEntries((submission as any).standardsStatus)
      : ((submission as any).standardsStatus || {});

    // Build the row set from the union of (std, spec) keys present in
    // reader scores OR in finals. Empty specs (no reader has voted, no
    // final set) are skipped — the UI doesn't need them as empty rows,
    // it can compare against the active-specs list client-side.
    const allKeys = new Set<string>([...scoresByKey.keys(), ...finalsByKey.keys()]);
    const rows = Array.from(allKeys).map((key) => {
      const [standardCode, specCode] = key.split('_');
      const rowScores = scoresByKey.get(key) || [];
      const values = rowScores.map((s) => s.score);
      const hasZero = values.some((v) => v === 0);
      const distinct = new Set(values).size;
      const hasDisagreement = values.length > 1 && distinct > 1;
      const allAgree = values.length > 1 && distinct === 1;
      const fin = finalsByKey.get(key);
      const statusForKey = status[key] || {};
      return {
        standardCode,
        specCode,
        scores: rowScores,
        hasZero,
        hasDisagreement,
        allAgree,
        finalScore: fin ? fin.score : null,
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
 * PUT /api/submissions/:submissionId/compilation/final-score
 * Body: { standardCode, specCode, score, note? }
 */
export const setFinalScore = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can set a final score' });
    }

    const { submissionId } = req.params;
    const { standardCode, specCode, score, note } = req.body || {};

    if (!standardCode || !specCode || score === undefined || score === null) {
      return res.status(400).json({ error: 'standardCode, specCode, and score are required' });
    }
    if (!Number.isInteger(score) || score < 0 || score > 3) {
      return res.status(400).json({ error: 'Score must be 0, 1, 2, or 3' });
    }

    const submission = await Submission.findById(submissionId).lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const existing = await LeadFinalScore.findOne({ submissionId, standardCode, specCode }).lean();

    const result = await LeadFinalScore.findOneAndUpdate(
      { submissionId, standardCode, specCode },
      {
        $set: {
          score,
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

    void recordAuditEvent({
      action: 'compilation.final_set',
      actor: { id: req.user!.id, role: req.user!.role, name: actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: {
        standardCode,
        specCode,
        score,
        priorScore: existing ? existing.score : null,
        note: note ?? null
      }
    });

    return res.json({ finalScore: result });
  } catch (error) {
    console.error('Set final score error:', error);
    return res.status(500).json({ error: 'Failed to set final score' });
  }
};

/**
 * DELETE /api/submissions/:submissionId/compilation/final-score
 * Body: { standardCode, specCode }
 */
export const clearFinalScore = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Only lead readers and admins can clear a final score' });
    }

    const { submissionId } = req.params;
    const { standardCode, specCode } = req.body || {};

    if (!standardCode || !specCode) {
      return res.status(400).json({ error: 'standardCode and specCode are required' });
    }

    const existing = await LeadFinalScore.findOne({ submissionId, standardCode, specCode }).lean();

    await LeadFinalScore.deleteOne({ submissionId, standardCode, specCode });

    void recordAuditEvent({
      action: 'compilation.final_cleared',
      actor: { id: req.user!.id, role: req.user!.role, name: actorName(req) },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
      payload: {
        standardCode,
        specCode,
        priorScore: existing ? existing.score : null
      }
    });

    return res.json({ cleared: true });
  } catch (error) {
    console.error('Clear final score error:', error);
    return res.status(500).json({ error: 'Failed to clear final score' });
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
