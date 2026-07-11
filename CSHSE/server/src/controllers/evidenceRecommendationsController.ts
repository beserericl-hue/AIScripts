import { Response } from 'express';
import { Submission } from '../models/Submission';
import { recommendEvidence } from '../services/cshseAiClient';
import { AuthenticatedRequest } from '../middleware/auth';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';

// ---------------------------------------------------------------------------
// CR-018 / Sprint 4.1 finish — reader-side evidence-recommendations caller.
//
// GET /api/submissions/:submissionId/specs/:standardCode/:specCode/evidence-recommendations
//
// Returns the top-K evidence chunks (from `cshse_evidence_{env}` Qdrant)
// that ai-service judges most relevant to the spec's prompt + standard
// title, filtered to the submission's (institutionId, submissionId)
// payload boundary (the cross-institution-isolation Gap 2 audit
// boundary).
//
// Role gate: reader / lead_reader / admin / superuser. PCs are 403
// (evidence recommendations are a reviewer-side affordance).
//
// Failure mode: ai-service unreachable / Qdrant down → 502 with a clean
// error. The reader UI fail-softs to "No recommendations available."
// ---------------------------------------------------------------------------

function _canRead(role: string): boolean {
  return role === 'reader' || role === 'lead_reader' || role === 'admin';
}

export const getEvidenceRecommendations = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const _sub = await requireSubmissionAccess(req, res, req.params.submissionId);
    if (!_sub) return;
    if (!_canRead(req.user?.role || '') && !req.user?.isSuperuser) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const { submissionId, standardCode, specCode } = req.params;
    const topKRaw = req.query.topK;
    const topK = typeof topKRaw === 'string' ? Math.min(Math.max(parseInt(topKRaw, 10) || 5, 1), 20) : 5;

    const submission = await Submission.findById(submissionId).select('institutionId programLevel').lean();
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (!submission.institutionId) {
      // Cross-institution isolation requires this; refuse rather than
      // sending a wide-open recommend request.
      return res.status(400).json({ error: 'Submission is missing institutionId; cannot recommend evidence.' });
    }

    try {
      const out = await recommendEvidence({
        institutionId: String(submission.institutionId),
        submissionId: String(submission._id),
        standardCode,
        specCode,
        topK,
        programLevel: submission.programLevel
      });
      if (!out.ready) {
        const notReady = out as { ready: false; phase: string; detail: string };
        return res.status(503).json({
          error: 'Evidence recommendations not available yet',
          phase: notReady.phase,
          detail: notReady.detail
        });
      }
      const ready = out as { ready: true; data: { chunks: unknown[] } };
      return res.json({
        chunks: ready.data.chunks,
        collection: (out as any).collection ?? null,
        standardCode,
        specCode,
        topK
      });
    } catch (err) {
      console.error('[evidenceRecommendations] ai-service call failed:', err);
      return res.status(502).json({ error: 'ai-service unreachable; no recommendations available' });
    }
  } catch (err) {
    console.error('getEvidenceRecommendations error:', err);
    return res.status(500).json({ error: 'Failed to get evidence recommendations' });
  }
};
