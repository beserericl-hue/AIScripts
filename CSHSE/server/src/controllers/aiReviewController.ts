/**
 * CR-043 — submission-scoped Review state controller.
 *
 * The persisted aiReviewState lives on Submission. These endpoints
 * give the client read + per-item mutation access independent of any
 * particular SelfStudyImport's lifecycle.
 *
 *   GET    /api/submissions/:submissionId/review            — full state
 *   POST   /api/submissions/:submissionId/review/approve    — per-item approve / unapprove
 *   POST   /api/submissions/:submissionId/review/discard    — per-item discard / undiscard
 *   POST   /api/submissions/:submissionId/review/clear-item — drop an item entirely (Discard button on the rail)
 *   POST   /api/submissions/:submissionId/review/apply      — read aiReviewState, push approved items to the editor
 *
 * The Matrix surface has a parallel pair:
 *   GET    /api/submissions/:submissionId/matrix-state      — aiMatrixState
 *   POST   /api/submissions/:submissionId/matrix-state      — write back row edits (CR-026)
 */
import { Request, Response } from 'express';
import mongoose from 'mongoose';

import { Submission } from '../models/Submission';
import { applyAIImportCore } from './aiImportController';

interface AuthenticatedRequest extends Request {
  user?: any;
}

async function _loadOwnedSubmission(
  req: AuthenticatedRequest,
  res: Response
): Promise<any | null> {
  const { submissionId } = req.params;
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return null;
  }
  // CR-043 AC#10 — cross-PC isolation. Admins + superusers bypass; readers
  // and lead readers get downstream ACLs; for a program_coordinator the
  // submission must be theirs (creator scoping) OR same institution.
  const user: any = req.user;
  const isElevated = user?.role === 'admin' || user?.isSuperuser === true;
  if (!isElevated && user?.role === 'program_coordinator') {
    const isOwner = submission.submitterId?.toString() === (user.id || user._id);
    const sameInstitution =
      user.institutionId &&
      submission.institutionId &&
      submission.institutionId.toString() === user.institutionId;
    if (!isOwner && !sameInstitution) {
      res.status(403).json({ error: 'Forbidden: cross-PC access' });
      return null;
    }
  }
  return submission;
}

/** GET /api/submissions/:submissionId/review */
export async function getReviewState(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const state = (submission as any).aiReviewState || null;
  res.json({
    submissionId: String(submission._id),
    aiReviewState: state,
    aiMatrixState: (submission as any).aiMatrixState || null
  });
}

/** POST /api/submissions/:submissionId/review/approve */
export async function approveItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { sectionId, approved } = req.body || {};
  if (!sectionId || typeof sectionId !== 'string') {
    res.status(400).json({ error: 'sectionId is required' });
    return;
  }
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }
  state.approvedIds = (state.approvedIds || []).filter((id: string) => id !== sectionId);
  if (approved !== false) {
    state.approvedIds.push(sectionId);
    // Approving overrides a prior discard.
    state.discardedIds = (state.discardedIds || []).filter((id: string) => id !== sectionId);
  }
  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  await submission.save();
  res.json({ ok: true, approvedIds: state.approvedIds });
}

/** POST /api/submissions/:submissionId/review/discard */
export async function discardItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { sectionId, discarded } = req.body || {};
  if (!sectionId || typeof sectionId !== 'string') {
    res.status(400).json({ error: 'sectionId is required' });
    return;
  }
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }
  state.discardedIds = (state.discardedIds || []).filter((id: string) => id !== sectionId);
  if (discarded !== false) {
    state.discardedIds.push(sectionId);
    state.approvedIds = (state.approvedIds || []).filter((id: string) => id !== sectionId);
  }
  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  await submission.save();
  res.json({ ok: true, discardedIds: state.discardedIds });
}

/**
 * POST /api/submissions/:submissionId/review/clear-item
 *
 * Hard remove from aiReviewState (vs Discard which is a soft mark).
 * The wizard's existing Discard-and-confirm UI uses this when the PC
 * is sure the item shouldn't even appear in the rail. Removes the
 * item from whatever kind/spec it sat in + from approvedIds/discardedIds
 * + from itemSources.
 */
export async function clearItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { sectionId } = req.body || {};
  if (!sectionId || typeof sectionId !== 'string') {
    res.status(400).json({ error: 'sectionId is required' });
    return;
  }
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }

  // Remove from per-spec bucket kinds.
  for (const specKey of Object.keys(state.buckets || {})) {
    const bucket = state.buckets[specKey];
    if (!bucket) continue;
    for (const kind of ['narratives', 'evidenceText', 'evidenceFiles'] as const) {
      bucket[kind] = (bucket[kind] || []).filter((it: any) => it.sectionId !== sectionId);
    }
  }
  state.tags = (state.tags || []).filter((t: any) => t.sectionId !== sectionId);
  state.cvs = (state.cvs || []).filter((c: any) => c.sectionId !== sectionId);
  state.evidenceDocs = (state.evidenceDocs || []).filter((e: any) => e.sectionId !== sectionId);
  for (const introKey of Object.keys(state.introductions || {})) {
    const ib = state.introductions[introKey];
    if (!ib) continue;
    ib.items = (ib.items || []).filter((it: any) => it.sectionId !== sectionId);
  }
  state.approvedIds = (state.approvedIds || []).filter((id: string) => id !== sectionId);
  state.discardedIds = (state.discardedIds || []).filter((id: string) => id !== sectionId);
  delete (state.itemSources || {})[sectionId];
  state.lastUpdatedAt = new Date();

  (submission as any).markModified('aiReviewState');
  await submission.save();
  res.json({ ok: true });
}

/**
 * POST /api/submissions/:submissionId/review/apply
 *
 * Read from aiReviewState filtered to approvedIds, push into the
 * Submission's narratives + standardIntroductions + supporting evidence,
 * via the existing applyAIImportCore. Empties the corresponding bits of
 * aiReviewState (approved items move out; un-approved items stay).
 */
export async function applyReviewState(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty — nothing to apply' });
    return;
  }
  const approvedSet = new Set<string>(state.approvedIds || []);
  if (approvedSet.size === 0) {
    res.status(400).json({ error: 'No items are approved yet' });
    return;
  }
  // Build an Apply payload from approved items only.
  const payload: any = {
    narratives: {},
    supportingEvidenceText: {},
    supportingEvidenceFiles: [],
    matrices: (submission as any).aiMatrixState?.matrices || [],
    importTags: [],
    placeholderSections: [],
    introductions: {},
    evidenceDocs: [],
    cvs: [],
    idempotencyKey: `review-apply-${submission._id}-${Date.now().toString(36)}`,
    globalMergeMode: req.body?.mergeMode || 'merge',
    perSpecResolution: req.body?.perSpecResolution || {}
  };

  for (const [specKey, bucket] of Object.entries(state.buckets || {})) {
    const b: any = bucket;
    const std = b.standardCode;
    const spec = b.specCode;
    for (const item of (b.narratives || [])) {
      if (!approvedSet.has(item.sectionId)) continue;
      payload.narratives[std] = payload.narratives[std] || {};
      payload.narratives[std][spec] = {
        content: item.snippet || '',
        mode: 'merge'
      };
    }
    for (const item of (b.evidenceText || [])) {
      if (!approvedSet.has(item.sectionId)) continue;
      payload.supportingEvidenceText[std] = payload.supportingEvidenceText[std] || {};
      payload.supportingEvidenceText[std][spec] = {
        text: item.snippet || '',
        mode: 'merge'
      };
    }
    for (const item of (b.evidenceFiles || [])) {
      if (!approvedSet.has(item.sectionId)) continue;
      payload.supportingEvidenceFiles.push({
        std,
        spec,
        sectionId: item.sectionId,
        title: item.heading || item.sectionId
      });
    }
    void specKey;
  }
  // Introductions — write approved items to per-key intro buckets.
  for (const [introKey, ib] of Object.entries(state.introductions || {})) {
    const items = ((ib as any).items || []).filter((it: any) => approvedSet.has(it.sectionId));
    if (items.length === 0) continue;
    // Aggregate the approved items into one HTML blob per intro key,
    // mirroring the wizard's apply payload shape.
    const content = items.map((it: any) => (it.htmlSnippet || it.snippet || '')).join('\n\n');
    payload.introductions[introKey] = {
      scope: introKey === 'document' ? 'document' : 'standard',
      standardCode: introKey === 'document' ? null : introKey.replace(/^standard-/, ''),
      content
    };
  }
  // CVs + evidenceDocs ride the existing per-import apply path; we
  // pass through only the approved ones so the editor's supporting
  // file library lands the right set.
  payload.cvs = (state.cvs || []).filter((c: any) => approvedSet.has(c.sectionId));
  payload.evidenceDocs = (state.evidenceDocs || []).filter((e: any) =>
    approvedSet.has(e.sectionId)
  );

  // applyAIImportCore wants an importRecord; build a minimal proxy that
  // carries the bits the core reads (aiStatus + aiLastIdempotencyKey +
  // aiTags + aiPlaceholderSections + aiIntroductions + aiCVs +
  // aiEvidenceDocs + aiCompletedAt + save()).
  const proxyImport: any = {
    _id: new mongoose.Types.ObjectId(),
    submissionId: submission._id,
    aiStatus: 'parsed',
    aiAppliedCounts: undefined,
    aiLastIdempotencyKey: undefined,
    aiTags: [],
    aiPlaceholderSections: [],
    aiErrors: [],
    async save() {
      // No-op: we don't persist this proxy — Submission writes carry the
      // applied state. The core's importRecord.save() calls fall here
      // and intentionally do nothing.
    },
    markModified(_path: string): void {
      // No-op: the proxy is in-memory only; nothing to flag dirty.
    }
  };

  const useTransaction = process.env.MONGO_SUPPORTS_TRANSACTIONS === 'true';
  const session = useTransaction ? await mongoose.startSession() : null;
  if (session) session.startTransaction();
  try {
    const result = await applyAIImportCore({
      importRecord: proxyImport,
      payload,
      userId: req.user?.id || req.user?._id,
      session,
      externalSession: !!session
    });
    if (result.ok === false) {
      if (session) {
        try { await session.abortTransaction(); } catch { /* ignore */ }
      }
      res.status(result.httpStatus ?? 500).json({
        ok: false,
        status: result.status,
        error: result.error
      });
      return;
    }
    // After apply: drop the approved items from aiReviewState so they
    // don't re-apply on the next click. Remaining items (un-approved
    // OR discarded) stay so the PC can keep working on them.
    for (const specKey of Object.keys(state.buckets || {})) {
      const b: any = state.buckets[specKey];
      if (!b) continue;
      b.narratives = (b.narratives || []).filter((it: any) => !approvedSet.has(it.sectionId));
      b.evidenceText = (b.evidenceText || []).filter((it: any) => !approvedSet.has(it.sectionId));
      b.evidenceFiles = (b.evidenceFiles || []).filter((it: any) => !approvedSet.has(it.sectionId));
    }
    for (const introKey of Object.keys(state.introductions || {})) {
      state.introductions[introKey].items = (state.introductions[introKey].items || []).filter(
        (it: any) => !approvedSet.has(it.sectionId)
      );
    }
    state.cvs = (state.cvs || []).filter((c: any) => !approvedSet.has(c.sectionId));
    state.evidenceDocs = (state.evidenceDocs || []).filter(
      (e: any) => !approvedSet.has(e.sectionId)
    );
    // Approved-then-applied items leave both lists; itemSources keeps
    // the provenance breadcrumb for the audit log even after apply.
    for (const sid of approvedSet) {
      // remove from approvedIds; leave discardedIds untouched (already
      // mutually exclusive with approved).
      state.approvedIds = (state.approvedIds || []).filter((id: string) => id !== sid);
    }
    state.lastUpdatedAt = new Date();
    (submission as any).markModified('aiReviewState');
    await submission.save(session ? { session } : {});
    if (session) await session.commitTransaction();
    res.json({
      ok: true,
      status: result.status,
      appliedCounts: result.appliedCounts
    });
  } catch (err: any) {
    if (session) {
      try { await session.abortTransaction(); } catch { /* ignore */ }
    }
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  } finally {
    if (session) await session.endSession();
  }
}

/** GET /api/submissions/:submissionId/matrix-state */
export async function getMatrixState(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  res.json({
    submissionId: String(submission._id),
    aiMatrixState: (submission as any).aiMatrixState || null
  });
}

/** POST /api/submissions/:submissionId/matrix-state */
export async function setMatrixRowEdit(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { matrixSlug, rowAnchor, edit } = req.body || {};
  if (!matrixSlug || !rowAnchor) {
    res.status(400).json({ error: 'matrixSlug + rowAnchor required' });
    return;
  }
  const state = (submission as any).aiMatrixState || {
    matrices: [],
    matrixRowEdits: {},
    lastUpdatedAt: new Date()
  };
  // Mongoose Mixed-type quirk — an empty nested object can come back
  // undefined after a save round trip. Re-establish the field so the
  // mutation below never crashes the request handler.
  if (!state.matrixRowEdits || typeof state.matrixRowEdits !== 'object') {
    state.matrixRowEdits = {};
  }
  if (!state.matrices) {
    state.matrices = [];
  }
  const key = `${matrixSlug}|${rowAnchor}`;
  if (edit === null || edit === undefined) {
    delete state.matrixRowEdits[key];
  } else {
    state.matrixRowEdits[key] = edit;
  }
  state.lastUpdatedAt = new Date();
  (submission as any).aiMatrixState = state;
  (submission as any).markModified('aiMatrixState');
  await submission.save();
  res.json({ ok: true });
}
