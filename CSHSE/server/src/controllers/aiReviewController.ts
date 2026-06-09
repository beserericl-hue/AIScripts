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

import { Document, Packer, Paragraph, HeadingLevel } from 'docx';

import { Submission } from '../models/Submission';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { ValidationService } from '../services/validationService';
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

/**
 * CR-048 — enumerate every draft item's sectionId across the review
 * state: bucket narratives/evidenceText/evidenceFiles, tags, CVs,
 * evidence docs, and introduction items. Used by finishReview to
 * resolve "the rest" and by the unresolved-count rollups.
 */
function collectAllSectionIds(state: any): string[] {
  const ids: string[] = [];
  for (const bucket of Object.values(state?.buckets || {}) as any[]) {
    for (const kind of ['narratives', 'evidenceText', 'evidenceFiles']) {
      for (const it of (bucket?.[kind] || [])) {
        if (it?.sectionId) ids.push(it.sectionId);
      }
    }
  }
  for (const t of (state?.tags || [])) if (t?.sectionId) ids.push(t.sectionId);
  for (const c of (state?.cvs || [])) if (c?.sectionId) ids.push(c.sectionId);
  for (const e of (state?.evidenceDocs || [])) if (e?.sectionId) ids.push(e.sectionId);
  for (const ib of Object.values(state?.introductions || {}) as any[]) {
    for (const it of (ib?.items || [])) if (it?.sectionId) ids.push(it.sectionId);
  }
  return ids;
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
 * POST /api/submissions/:submissionId/review/route-evidence
 *
 * Persist a coordinator's Standard/Substandard assignment for a CV, syllabus,
 * or paper directly onto aiReviewState (so it survives reload AND Re-run
 * detectors, which merges with reimport:false and keeps existing items). The
 * client's assignment dropdowns call this on change — without it the routing
 * lived only in the browser store and was lost the moment the rail refetched.
 *
 * Sets resolvedStd/resolvedSpec (the display fields) AND routing.{std,spec}
 * (what apply-ai reads to stamp SupportingEvidence.standardCode/specCode).
 * Passing empty std/spec clears the assignment back to "Unassigned".
 */
export async function routeEvidence(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { sectionId, std, spec } = req.body || {};
  if (!sectionId || typeof sectionId !== 'string') {
    res.status(400).json({ error: 'sectionId is required' });
    return;
  }
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }

  const stdVal = typeof std === 'string' && std ? std : undefined;
  const specVal = typeof spec === 'string' && spec ? spec : undefined;

  const apply = (item: any): boolean => {
    if (!item || item.sectionId !== sectionId) return false;
    item.resolvedStd = stdVal;
    item.resolvedSpec = specVal;
    item.routing = {
      ...(item.routing || {}),
      std: stdVal,
      spec: specVal,
      source: 'coordinator',
    };
    return true;
  };

  let found = false;
  for (const c of state.cvs || []) if (apply(c)) found = true;
  for (const e of state.evidenceDocs || []) if (apply(e)) found = true;

  if (!found) {
    res.status(404).json({ error: 'No CV or evidence doc with that sectionId' });
    return;
  }

  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  await submission.save();
  res.json({ ok: true, sectionId, resolvedStd: stdVal, resolvedSpec: specVal });
}

/**
 * POST /api/submissions/:submissionId/review/save-state
 *
 * Autosave the review-rail CONTENT so every coordinator action on the Review
 * screen (change-kind, reassign, inline edit, revert, move-to-introduction,
 * bulk moves, standalone-CV routing) is persisted to the DB immediately —
 * instead of surviving only in browser localStorage until "Apply to editor".
 * Only the content fields are replaced; approvedIds / discardedIds /
 * itemSources / aiMatrixState are owned by their dedicated endpoints and left
 * untouched.
 */
const SAVEABLE_FIELDS = [
  'buckets',
  'tags',
  'cvs',
  'evidenceDocs',
  'introductions',
  'placeholderSections',
] as const;

export async function saveReviewState(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }
  const body = req.body || {};
  let touched = 0;
  for (const f of SAVEABLE_FIELDS) {
    if (body[f] !== undefined) {
      state[f] = body[f];
      touched += 1;
    }
  }
  if (touched === 0) {
    res.status(400).json({ error: `provide at least one of: ${SAVEABLE_FIELDS.join(', ')}` });
    return;
  }
  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  await submission.save();
  res.json({ ok: true, saved: touched });
}

/**
 * POST /api/submissions/:submissionId/review/set-approved
 *
 * Replace the whole approved-id set in one shot. Backs the Review surface's
 * Approve / Approve-all / Clear actions so a coordinator's "Reviewed" marks are
 * persisted to the DB (they previously lived only in the browser store and were
 * wiped on reload). Idempotent; dedups; clears with an empty array.
 */
function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * IDEMPOTENT materialize — recompute the Self-Study editor from the currently
 * approved Review items. Replaces "Apply to editor": Approve / Approve-all now
 * move text straight into the editor. Idempotent because each spec's content is
 * RECOMPUTED as the concatenation of its approved items (replace, not append),
 * so re-running on every approve never duplicates. A spec with no approved
 * items is left untouched (un-approving the last item doesn't wipe prior work).
 *
 * Evidence files / CVs / syllabi / papers are materialized into the File
 * Library as SupportingEvidence, deduped by a `rev:<sectionId>` tag so repeated
 * runs don't create duplicate files.
 */
async function materializeApprovedToEditor(
  submission: any,
  userId: any
): Promise<Array<{ std: string; spec: string }>> {
  const state = submission.aiReviewState;
  // BUG FIX 2026-06-08: previously bailed when `state.buckets` was empty/missing.
  // A submission can have ONLY evidence (approved CVs / syllabi / papers) and no
  // narrative buckets — bailing here meant those evidence files were NEVER
  // materialized into SupportingEvidence (invisible to the editor + the AI eval).
  // Only bail when there's no review state at all; treat missing buckets as {}.
  if (!state) return [];
  const buckets = state.buckets || {};
  const approved = new Set<string>(state.approvedIds || []);
  const affected: Array<{ std: string; spec: string }> = [];

  // --- 1) narratives + supporting-evidence text → submission.narratives (Map) ---
  const bySpec = new Map<string, { std: string; spec: string; narr: string[]; ev: string[] }>();
  const slot = (std: string, spec: string) => {
    const k = `${std}.${spec}`;
    if (!bySpec.has(k)) bySpec.set(k, { std, spec, narr: [], ev: [] });
    return bySpec.get(k)!;
  };
  for (const bucket of Object.values(buckets) as any[]) {
    const std = bucket?.standardCode;
    const spec = bucket?.specCode;
    if (!std || !spec) continue;
    for (const it of bucket.narratives || []) {
      if (approved.has(it.sectionId)) {
        slot(std, spec).narr.push(it.htmlSnippet || `<p>${escapeHtml(it.snippet || '')}</p>`);
      }
    }
    for (const it of bucket.evidenceText || []) {
      if (approved.has(it.sectionId)) {
        slot(std, spec).ev.push(it.htmlSnippet || `<p>${escapeHtml(it.snippet || '')}</p>`);
      }
    }
  }
  if (!submission.narratives) submission.narratives = new Map();
  for (const { std, spec, narr, ev } of bySpec.values()) {
    if (narr.length === 0 && ev.length === 0) continue;
    const stdMap: Map<string, any> = submission.narratives.get(std) || new Map();
    const existing = stdMap.get(spec);
    stdMap.set(spec, {
      content: narr.length ? narr.join('\n<hr class="ai-import-merge"/>\n') : existing?.content || '',
      supportingEvidenceText: ev.length ? ev.join('\n\n') : existing?.supportingEvidenceText || '',
      lastModified: new Date(),
      isComplete: existing?.isComplete ?? false,
      linkedDocuments: existing?.linkedDocuments || [],
    });
    submission.narratives.set(std, stdMap);
    affected.push({ std, spec });
  }
  submission.markModified('narratives');

  // --- 1b) approved INTRODUCTION items → documentIntroduction / standardIntroductions ---
  // BUG FIX 2026-06-09: materialize previously handled narratives + evidence +
  // CVs/docs but NOT Introduction items, so an approved Document/Standard
  // introduction was never written into the editor's Introduction section.
  // Mirror the narrative semantics: a key's content is the concatenation of its
  // approved intro items (replace, not append) so re-running is idempotent.
  const introsState = (state.introductions || {}) as Record<string, { items?: any[] }>;
  let introTouched = false;
  for (const [ik, ib] of Object.entries(introsState)) {
    const approvedItems = (ib?.items || []).filter((it: any) => approved.has(it.sectionId));
    if (approvedItems.length === 0) continue;
    const html = approvedItems
      .map((it: any) => it.htmlSnippet || `<p>${escapeHtml(it.snippet || '')}</p>`)
      .join('\n<hr class="ai-import-merge"/>\n');
    if (ik === 'document') {
      submission.documentIntroduction = html;
      introTouched = true;
    } else if (ik.startsWith('standard-')) {
      const code = ik.slice('standard-'.length);
      if (!submission.standardIntroductions) submission.standardIntroductions = new Map<string, string>();
      (submission.standardIntroductions as Map<string, string>).set(String(code), html);
      introTouched = true;
    }
  }
  if (introTouched) {
    submission.markModified('documentIntroduction');
    submission.markModified('standardIntroductions');
  }

  // --- 2) approved evidence files / CVs / docs → SupportingEvidence ---
  //
  // 2026-06-07 (user-reported: "no evidence file should be invisible to the AI
  // evaluation; files must be findable; place them in the spec they belong to"):
  //  (a) We NO LONGER drop unassigned (un-routed) CVs / docs. Every approved
  //      evidence item now materializes so it is findable in the File Library.
  //      Routed items carry their (std, spec); un-routed items are saved with
  //      no code (the evaluator treats those as general submission evidence —
  //      see validationService — so they are still visible to every spec's AI
  //      evaluation rather than silently lost).
  //  (b) We store the actual evidence TEXT in `metadata.description` (and a
  //      short title in `description`). The evaluator reads that text, so the
  //      AI finally SEES the file content — previously it only got the title
  //      (e.g. "(data table)") and reported it couldn't see the evidence.
  //  (c) Existing records are now UPSERTED (not skipped): re-running set-approved
  //      heals records created before this fix (adds text + (std, spec) when the
  //      coordinator later assigns one), instead of leaving them content-less.
  const fileItems: Array<{ sectionId: string; std?: string; spec?: string; title: string; body: string; kind: string }> = [];
  for (const bucket of Object.values(buckets) as any[]) {
    for (const it of bucket.evidenceFiles || []) {
      if (approved.has(it.sectionId)) {
        // Files are frequently tables — the real content lives in htmlSnippet;
        // `snippet` is just a "(data table)" placeholder. Prefer the richer one.
        const body = evidenceBodyText(it.htmlSnippet, it.snippet);
        fileItems.push({ sectionId: it.sectionId, std: bucket.standardCode, spec: bucket.specCode, title: it.heading || 'Evidence file', body, kind: 'file' });
      }
    }
  }
  for (const c of state.cvs || []) {
    if (approved.has(c.sectionId)) {
      const body = evidenceBodyText(c.htmlSnippet, c.snippet || c.fullText);
      fileItems.push({ sectionId: c.sectionId, std: c.resolvedStd || c.routing?.std, spec: c.resolvedSpec || c.routing?.spec, title: `${c.facultyName || 'Faculty'} — CV`, body, kind: 'cv' });
    }
  }
  for (const e of state.evidenceDocs || []) {
    if (approved.has(e.sectionId)) {
      const body = evidenceBodyText(e.htmlSnippet, e.snippet || e.summary);
      fileItems.push({ sectionId: e.sectionId, std: e.resolvedStd || e.routing?.std, spec: e.resolvedSpec || e.routing?.spec, title: e.title || 'Evidence document', body, kind: e.docSubKind || 'paper' });
    }
  }
  // Record a stat even when nothing matched, so the set-approved response can
  // distinguish "no approved evidence" from a materialization failure.
  (submission as any).__evidenceStats = { items: fileItems.length, created: 0, updated: 0, errors: 0, firstError: '' };
  if (fileItems.length === 0) return affected;

  // Per-item try/catch: one bad evidence item must NOT abort materialization of
  // the rest (the previous single wrapping try/catch silently dropped every
  // remaining item on the first failure). Stats are stashed on the submission so
  // the set-approved response can surface them.
  let _evCreated = 0;
  let _evUpdated = 0;
  let _evErrors = 0;
  let _evFirstError = '';
  for (const fi of fileItems) {
    try {
      const tag = `rev:${fi.sectionId}`;
      // The AI evaluator reads `metadata.description` / `description` for the
      // evidence text — store the real body there so the file is visible to it.
      const bodyText = (fi.body || '').trim();
      const existing: any = await SupportingEvidence.findOne({ submissionId: submission._id, tags: tag, isDeleted: false });
      if (existing) {
        // Heal/upgrade an already-materialized record: refresh routing + text so
        // approvals made before this fix (or a later spec assignment) take effect.
        existing.standardCode = fi.std || undefined;
        existing.specCode = fi.spec || undefined;
        existing.description = fi.title;
        existing.metadata = { ...(existing.metadata || {}), description: bodyText };
        existing.markModified('metadata');
        await existing.save();
        _evUpdated += 1;
        if (fi.std && fi.spec) affected.push({ std: fi.std, spec: fi.spec });
        continue;
      }
      const children: any[] = [
        new Paragraph({ text: fi.title, heading: HeadingLevel.HEADING_1 }),
      ];
      for (const p of String(bodyText).split(/\n\s*\n/)) children.push(new Paragraph({ text: p.trim() }));
      const buffer = await Packer.toBuffer(new Document({ creator: 'CSHSE', title: fi.title, sections: [{ properties: {}, children }] }));
      const filename = `${String(fi.title).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'evidence'}.docx`;
      await SupportingEvidence.create({
        institutionId: submission.institutionId,
        submissionId: submission._id,
        uploadedBy: userId || submission.submitterId,
        standardCode: fi.std || undefined,
        specCode: fi.spec || undefined,
        evidenceType: 'document',
        file: {
          filename, originalName: filename,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: buffer.byteLength, data: buffer.toString('base64'), encoding: 'base64',
          storageType: 'base64', uploadedAt: new Date(), uploadedBy: userId || submission.submitterId,
        } as any,
        description: fi.title,
        // AI-readable evidence text (the evaluator selects metadata.description).
        metadata: { description: bodyText },
        versionNumber: 1, isCurrentVersion: true, isDeleted: false,
        linkedNarratives: [],
        tags: ['ai-import', `kind:${fi.kind}`, tag],
      });
      _evCreated += 1;
      if (fi.std && fi.spec) affected.push({ std: fi.std, spec: fi.spec });
    } catch (itemErr: any) {
      _evErrors += 1;
      if (!_evFirstError) _evFirstError = `${fi.kind}:${itemErr?.message || itemErr}`.slice(0, 300);
      console.warn(`[materializeApprovedToEditor] evidence item ${fi.sectionId} failed (non-fatal):`, itemErr);
    }
  }
  (submission as any).__evidenceStats = {
    ...((submission as any).__evidenceStats || {}),
    items: fileItems.length, created: _evCreated, updated: _evUpdated, errors: _evErrors, firstError: _evFirstError,
  };
  return affected;
}

/**
 * Best-effort plain-text body for an evidence record. Prefers the structural
 * htmlSnippet (which carries the real table/cell content) over the short
 * `snippet` placeholder (often just "(data table)"). Strips tags, decodes a
 * few common entities, and collapses whitespace so the AI evaluator receives
 * readable content rather than markup.
 */
function evidenceBodyText(html?: string | null, fallback?: string | null): string {
  const stripped = (html || '')
    .replace(/<\s*(br|tr|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<\s*(td|th)\b[^>]*>/gi, ' \t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const fb = (fallback || '').trim();
  // Use the HTML-derived text when it's clearly richer than the placeholder
  // snippet (which is often "(data table)" / a couple of words).
  if (stripped.length > fb.length) return stripped;
  return fb || stripped;
}

/**
 * 2026-06-09 — Unify "Approve all" with matrices. Matrices historically had a
 * SEPARATE apply path (import-time → CurriculumMatrix.rawContent), so approving
 * review items moved narratives/evidence/intros but NOT the curriculum matrices.
 * This materializes any detected matrices (aiMatrixState.matrices) into the
 * submission's CurriculumMatrix.rawContent — the source the Matrix editor
 * renders — so a single Approve also pushes the matrices.
 *
 * Idempotent + duplicate-safe: a matrix is skipped if an existing rawContent
 * entry already carries the same HTML or title (the import may have applied it),
 * so this never double-inserts.
 */
async function materializeApprovedMatrices(submission: any, userId: any): Promise<number> {
  const matrices = (submission as any).aiMatrixState?.matrices;
  if (!Array.isArray(matrices) || matrices.length === 0) return 0;
  let cm: any = await CurriculumMatrix.findOne({ submissionId: submission._id });
  if (!cm) {
    cm = new CurriculumMatrix({
      submissionId: submission._id,
      matrixType: 'human_services_courses',
      name: 'Curriculum Matrix',
      version: 1,
      lastModified: new Date(),
      lastModifiedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : submission.submitterId,
      courses: [],
      standards: [],
      rawContent: [],
    });
  }
  if (!Array.isArray(cm.rawContent)) cm.rawContent = [];
  let changed = 0;
  for (const m of matrices) {
    const html = m?.htmlSnippet;
    if (!html) continue;
    const already = cm.rawContent.some(
      (r: any) => r?.content === html || (m.name && r?.title === m.name)
    );
    if (already) continue;
    cm.rawContent.push({
      id: `matrix-ai-${m.matrixId || m.name || 'mx'}`,
      content: html,
      title: m.name || 'Curriculum Matrix',
      addedAt: new Date(),
      addedBy: userId ? new mongoose.Types.ObjectId(String(userId)) : submission.submitterId,
      processed: true,
      processedAt: new Date(),
    });
    changed += 1;
  }
  if (changed > 0) {
    cm.lastModified = new Date();
    cm.markModified('rawContent');
    await cm.save();
  }
  return changed;
}

/**
 * Auto-run the AI evaluation for the specs whose editor content just changed,
 * so the final-editing step already has verdicts/suggestions — no manual
 * "Validate" click per spec. Fire-and-forget with a small concurrency cap so a
 * big "Approve all" doesn't flood the AI service; failures are swallowed (the
 * coordinator can still Validate manually).
 */
async function runAutoEvaluations(
  submission: any,
  affected: Array<{ std: string; spec: string }>
): Promise<{ requested: number; evaluated: number; error?: string }> {
  if (!affected || affected.length === 0) return { requested: 0, evaluated: 0 };
  // Bound how many we evaluate synchronously so a giant "Approve all" can't
  // hang the request indefinitely; the rest get evaluated on the next approve.
  const MAX_SYNC = 24;
  const todo = affected.slice(0, MAX_SYNC);
  try {
    const svc = new ValidationService();
    const getContent = (std: string, spec: string) => {
      const stdMap = submission.narratives?.get?.(std);
      const entry = stdMap?.get?.(spec);
      return entry?.content || '';
    };
    let evaluated = 0;
    const CONCURRENCY = 3;
    const PER_CALL_MS = 30_000;
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
      const batch = todo.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(({ std, spec }) =>
          Promise.race([
            svc.validateSection({
              submissionId: String(submission._id),
              standardCode: std,
              specCode: spec,
              narrativeText: getContent(std, spec),
              validationType: 'manual_save',
            }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('eval-timeout')), PER_CALL_MS)),
          ])
        )
      );
      evaluated += results.filter((r) => r.status === 'fulfilled').length;
    }
    return { requested: todo.length, evaluated };
  } catch (err) {
    console.warn('[runAutoEvaluations] failed (non-fatal):', err);
    return { requested: todo.length, evaluated: 0, error: String(err).slice(0, 200) };
  }
}

export async function setApprovedIds(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { approvedIds } = req.body || {};
  if (!Array.isArray(approvedIds)) {
    res.status(400).json({ error: 'approvedIds must be an array' });
    return;
  }
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }
  const clean = [...new Set(approvedIds.filter((x: unknown) => typeof x === 'string'))];
  state.approvedIds = clean;
  // Approving overrides a prior discard for the same id.
  state.discardedIds = (state.discardedIds || []).filter((id: string) => !clean.includes(id));
  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  // Auto-apply: approving moves the text straight into the editor (replaces the
  // old separate "Apply to editor" button). Idempotent — safe on every call.
  const affected = await materializeApprovedToEditor(submission, req.user?.id);
  // Unify with matrices: approving also pushes detected curriculum matrices into
  // the editor's CurriculumMatrix (idempotent; no-op when none are pending).
  const matricesApplied = await materializeApprovedMatrices(submission, req.user?.id);
  await submission.save();
  // Run the AI evaluation for the affected specs so the final editor already has
  // the verdicts — saves the coordinator a manual "Validate" per spec. Awaited
  // (post-response fire-and-forget gets torn down on Railway), but the client
  // approve call is itself fire-and-forget so the UI never blocks on this.
  const evalSummary = await runAutoEvaluations(submission, affected);
  res.json({ ok: true, approvedIds: state.approvedIds, autoEval: evalSummary, evidence: (submission as any).__evidenceStats ?? null, matricesApplied });
}

/**
 * POST /api/submissions/:submissionId/review/split-item
 *
 * Move part of a card into another subspec. The parser sometimes dumps a whole
 * Standard's prose into its first subspec; the coordinator selects the text
 * that belongs elsewhere and moves it. This:
 *   1. trims the SOURCE item's content to the remainder (selection removed),
 *   2. creates a NEW item (the moved selection) in the target spec bucket.
 * Both halves live in aiReviewState, so the split survives reload + apply.
 *
 * body: { sourceSectionId, kind ('narratives'|'evidenceText'|'evidenceFiles'),
 *         remainderHtml, movedHtml, targetStd, targetSpec, newSectionId, heading }
 */
const BUCKET_KINDS = ['narratives', 'evidenceText', 'evidenceFiles'] as const;
type BucketKind = (typeof BUCKET_KINDS)[number];

function htmlToText(html: string): string {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function splitReviewItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const {
    sourceSectionId,
    kind,
    remainderHtml,
    movedHtml,
    targetStd,
    targetSpec,
    newSectionId,
    heading,
  } = req.body || {};

  if (!sourceSectionId || typeof sourceSectionId !== 'string') {
    res.status(400).json({ error: 'sourceSectionId is required' });
    return;
  }
  if (!BUCKET_KINDS.includes(kind)) {
    res.status(400).json({ error: `kind must be one of ${BUCKET_KINDS.join(', ')}` });
    return;
  }
  if (!targetStd || !targetSpec) {
    res.status(400).json({ error: 'targetStd and targetSpec are required' });
    return;
  }
  if (!newSectionId || typeof newSectionId !== 'string') {
    res.status(400).json({ error: 'newSectionId is required' });
    return;
  }
  if (typeof movedHtml !== 'string' || !htmlToText(movedHtml)) {
    res.status(400).json({ error: 'movedHtml must contain text' });
    return;
  }

  const state = (submission as any).aiReviewState;
  if (!state || !state.buckets) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }

  // 1) Trim the source item to the remainder, wherever it lives.
  let sourceItem: any = null;
  for (const specKey of Object.keys(state.buckets)) {
    const bucket = state.buckets[specKey];
    if (!bucket) continue;
    for (const k of BUCKET_KINDS) {
      const hit = (bucket[k] || []).find((it: any) => it.sectionId === sourceSectionId);
      if (hit) {
        sourceItem = hit;
        hit.htmlSnippet = typeof remainderHtml === 'string' ? remainderHtml : hit.htmlSnippet;
        hit.snippet = htmlToText(remainderHtml ?? hit.snippet ?? '');
        hit.wordCount = hit.snippet ? hit.snippet.split(' ').length : 0;
        break;
      }
    }
    if (sourceItem) break;
  }
  if (!sourceItem) {
    res.status(404).json({ error: 'source item not found' });
    return;
  }

  // 2) Ensure the target bucket exists, then add the moved selection as a new item.
  const targetKey = `${targetStd}.${targetSpec}`;
  if (!state.buckets[targetKey]) {
    state.buckets[targetKey] = {
      standardCode: String(targetStd),
      specCode: String(targetSpec),
      standardTitle: '',
      specPrompt: '',
      narratives: [],
      evidenceText: [],
      evidenceFiles: [],
      matrixCells: [],
    };
  }
  const target = state.buckets[targetKey];
  const movedText = htmlToText(movedHtml);
  const newItem = {
    sectionId: newSectionId,
    heading: heading || `Moved from ${sourceSectionId}`,
    snippet: movedText,
    htmlSnippet: movedHtml,
    wordCount: movedText ? movedText.split(' ').length : 0,
    confidence: typeof sourceItem.confidence === 'number' ? sourceItem.confidence : 1,
    acceptState: 'pending',
    rationale: 'Moved here from another subspec by the coordinator.',
    sourceImportId: sourceItem.sourceImportId,
    sourceFilename: sourceItem.sourceFilename,
  };
  target[kind as BucketKind] = [...(target[kind as BucketKind] || []), newItem];

  // Provenance breadcrumb for the new item.
  state.itemSources = state.itemSources || {};
  if (state.itemSources[sourceSectionId]) {
    state.itemSources[newSectionId] = { ...state.itemSources[sourceSectionId] };
  }

  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  await submission.save();
  res.json({ ok: true, newSectionId, targetKey });
}

/**
 * POST /api/submissions/:submissionId/review/finish
 *
 * CR-048 — "I've reviewed enough." Mark every still-untriaged draft
 * (neither approved nor already discarded) as discarded, i.e. an
 * explicit "not included in the self-study". Items stay in the state
 * (visible under a Discarded filter, individually un-discardable later),
 * but the unresolved count drops to zero so the workflow stops treating
 * Review as having pending work. Idempotent: a second call is a no-op.
 */
export async function finishReview(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }
  const approved = new Set<string>(state.approvedIds || []);
  const discarded = new Set<string>(state.discardedIds || []);
  let newlyDiscarded = 0;
  for (const id of collectAllSectionIds(state)) {
    if (!approved.has(id) && !discarded.has(id)) {
      discarded.add(id);
      newlyDiscarded++;
    }
  }
  state.discardedIds = Array.from(discarded);
  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  await submission.save();
  res.json({ ok: true, discardedIds: state.discardedIds, newlyDiscarded });
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
  // Build a brand-new plain edits object (handling Map-or-object) and assign a
  // FRESH aiMatrixState. Mutating-in-place on a Mixed path isn't reliably
  // change-tracked by Mongoose — a restore (edit:null) silently failed to
  // persist until we replaced the whole subtree.
  const edits: Record<string, unknown> =
    state.matrixRowEdits instanceof Map
      ? Object.fromEntries(state.matrixRowEdits)
      : { ...(state.matrixRowEdits || {}) };
  if (edit === null || edit === undefined) {
    delete edits[key];
  } else {
    edits[key] = edit;
  }
  (submission as any).aiMatrixState = {
    matrices: Array.isArray(state.matrices) ? state.matrices : [],
    matrixRowEdits: edits,
    lastUpdatedAt: new Date(),
  };
  (submission as any).markModified('aiMatrixState');
  await submission.save();
  res.json({ ok: true });
}
