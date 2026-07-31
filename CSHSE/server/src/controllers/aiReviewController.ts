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

import { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';

import { Submission } from '../models/Submission';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { SelfStudyImport } from '../models/SelfStudyImport';
import { Assignment } from '../models/Assignment';
import { buildEmptyReviewState } from '../services/aiReviewMerge';
import { ValidationService } from '../services/validationService';
import { applyAIImportCore } from './aiImportController';
import { downloadFileAsBuffer, generateS3Key, uploadFile, isS3Configured } from '../services/s3Service';
import { v4 as uuidv4 } from 'uuid';
import { extractFileText, reviewCoverage } from '../services/cshseAiClient';
import { suggestStandardForFile, NarrativeTuple, titleFromFilename } from '../services/evidenceStandardSuggester';
import { signFileAccessToken } from '../services/fileAccessToken';

interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Persist ONLY aiReviewState with an atomic $set — NEVER re-save the whole
 * submission. A full submission.save() rewrites narratives from whatever
 * snapshot the handler loaded; if it lands during a concurrent Approve→
 * materialize, it clobbers the just-written narratives (prod: Standard 2 "did
 * not copy over"). Every review-item handler that touches only aiReviewState
 * uses this so no background/foreground write can lose narratives.
 */
async function persistAiReviewState(submission: any, state: any): Promise<void> {
  const plain = state && typeof state.toObject === 'function' ? state.toObject() : state;
  await Submission.updateOne({ _id: submission._id }, { $set: { aiReviewState: plain } });
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
  // DATA ISOLATION — a submission's review data may only be reached by:
  //   • an admin / superuser (elevated), OR
  //   • a program coordinator who owns it OR is in the same institution, OR
  //   • a reader / lead reader with an ACTIVE assignment to it (or the legacy
  //     institution-level assignment).
  // Everyone else is 403'd. (Impersonation swaps req.user to the effective
  // identity, so user.id / user.institutionId are already the acting user's.)
  const user: any = req.user;
  const isElevated = user?.role === 'admin' || user?.isSuperuser === true;
  if (isElevated) return submission;

  const uid = String(user?.id || user?._id || '');
  const sameInstitution =
    user?.institutionId &&
    submission.institutionId &&
    submission.institutionId.toString() === String(user.institutionId);

  if (user?.role === 'program_coordinator') {
    const isOwner = submission.submitterId?.toString() === uid;
    if (!isOwner && !sameInstitution) {
      res.status(403).json({ error: 'Forbidden: cross-institution access' });
      return null;
    }
    return submission;
  }

  if (user?.role === 'reader' || user?.role === 'lead_reader') {
    const hasAssignment = await Assignment.exists({
      submissionId: submission._id,
      userId: uid,
      status: 'active',
    });
    const sub: any = submission;
    const legacyAssigned =
      (Array.isArray(sub.assignedReaderIds) && sub.assignedReaderIds.some((id: any) => id?.toString() === uid)) ||
      (Array.isArray(sub.assignedReaders) && sub.assignedReaders.some((id: any) => id?.toString() === uid)) ||
      sub.assignedLeadReaderId?.toString() === uid ||
      sub.leadReader?.toString() === uid;
    if (!hasAssignment && !legacyAssigned) {
      res.status(403).json({ error: 'Forbidden: not assigned to this submission' });
      return null;
    }
    return submission;
  }

  // Any other non-elevated role has no business here.
  res.status(403).json({ error: 'Forbidden' });
  return null;
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

/**
 * Surface curriculum matrices in the Review rail's MatrixData shape, drawn from
 * the DURABLE sources — the applied `CurriculumMatrix.rawContent` PLUS any
 * importer-detected `isMatrix` section that never got applied. The Review rail
 * reads ONLY `aiMatrixState.matrices`; on some submissions that field was never
 * populated (the matrices live in CurriculumMatrix / SelfStudyImport instead),
 * so the "Matrices" entry silently vanished even though the data was imported.
 * Rebuilding it here — read-only, never persisted — keeps classified matrix
 * content visible no matter which field it landed in. Mirrors getAllMatrices in
 * matrixController (same dedup-by-content-signature). See the hard rule:
 * imported matrix/CV/syllabus/project content must never be lost.
 */
async function buildMatricesFromDurableSources(
  submissionId: string,
  programLevel: string
): Promise<any[]> {
  const out: any[] = [];
  const seen = new Set<string>();
  const sig = (html: string) =>
    (html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
  const toMatrixData = (id: string, name: string, html: string) => ({
    matrixId: id,
    name,
    anchorName: '',
    programLevel: programLevel || '',
    htmlSnippet: html,
    columnHeaders: [] as string[],
    rowsMatched: 0,
    rowsTotal: 0,
    columnCount: 0,
    cells: [] as any[]
  });

  // 0) AUTHORITATIVE SOURCE — the AI parser's own `aiMatrices` from the most
  // recent import that produced any. These are the real, full curriculum
  // matrices (e.g. the HS-courses and non-HS-courses matrices), already in the
  // exact MatrixData shape with structured cells + per-row anchors. They MUST
  // win over the legacy fallbacks below, which can hold mis-split fragments
  // (header + per-standard context paragraphs) of the same document — using
  // those instead silently shows the wrong, incomplete matrices.
  const withAiMatrices = await SelfStudyImport.find({
    submissionId,
    'aiMatrices.0': { $exists: true }
  })
    .sort({ _id: -1 })
    .limit(1)
    .lean();
  if (withAiMatrices.length > 0) {
    const ai = ((withAiMatrices[0] as any).aiMatrices || []).filter(
      (m: any) => m && (m.htmlSnippet || '').trim()
    );
    if (ai.length > 0) {
      return ai.map((m: any, i: number) => ({
        matrixId: m.matrixId || `ai-${i}`,
        name: m.name || 'Curriculum Matrix',
        anchorName: m.anchorName || '',
        programLevel: m.programLevel || programLevel || '',
        htmlSnippet: m.htmlSnippet || '',
        columnHeaders: Array.isArray(m.columnHeaders) ? m.columnHeaders : [],
        rowsMatched: m.rowsMatched || 0,
        rowsTotal: m.rowsTotal || 0,
        columnCount: m.columnCount || 0,
        cells: Array.isArray(m.cells) ? m.cells : []
      }));
    }
  }

  // FALLBACK (only when the AI parser produced no matrices anywhere) — flatten
  // applied CurriculumMatrix sections + importer-detected isMatrix sections.
  // 1) Applied/stored matrix sections.
  const matrices = await CurriculumMatrix.find({ submissionId }).lean();
  for (const m of matrices) {
    let idx = 0;
    for (const rc of ((m as any).rawContent || [])) {
      const content = rc.content || '';
      if (!content) continue;
      seen.add(sig(content));
      out.push(
        toMatrixData(
          `cm-${String((m as any)._id)}-${rc.id || idx}`,
          rc.title || (m as any).name || 'Curriculum Matrix',
          content
        )
      );
      idx++;
    }
  }

  // 2) Importer-detected matrices not (yet) applied — deduped by content.
  const imports = await SelfStudyImport.find({ submissionId }).lean();
  for (const im of imports) {
    for (const s of (((im as any).detectedSections) || [])) {
      if (!s?.isMatrix) continue;
      const content = s.htmlContent || s.fullContent || '';
      if (!content || seen.has(sig(content))) continue;
      seen.add(sig(content));
      out.push(
        toMatrixData(
          `im-${String((im as any)._id)}-${s.id || s._id || sig(content)}`,
          s.headerText || s.title || 'Imported matrix',
          content
        )
      );
    }
  }
  return out;
}

/** GET /api/submissions/:submissionId/review */
export async function getReviewState(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const state = (submission as any).aiReviewState || null;
  let matrixState = (submission as any).aiMatrixState || null;
  // If the persisted matrix state has no matrices, rebuild the list from the
  // durable CurriculumMatrix / SelfStudyImport sources AND PERSIST it back into
  // submission.aiMatrixState. The parse pipeline only writes aiMatrixState when
  // the AI path emits aiMatrices[]; matrices detected via detectedSections
  // (isMatrix) or applied into CurriculumMatrix never reached this field, so
  // the Review rail's "Matrices" entry vanished and the data effectively lived
  // only wherever the client had cached it. Writing it here makes the parsed
  // matrices a durable DB field (self-healing on first open) — all parsed data
  // belongs in the database, never only in browser-local state.
  if (!matrixState || !Array.isArray(matrixState.matrices) || matrixState.matrices.length === 0) {
    const rebuilt = await buildMatricesFromDurableSources(
      String(submission._id),
      (submission as any).programLevel || ''
    );
    if (rebuilt.length > 0) {
      matrixState = {
        ...(matrixState || {}),
        matrices: rebuilt,
        matrixRowEdits: (matrixState && matrixState.matrixRowEdits) || {},
        lastUpdatedAt: new Date()
      };
      (submission as any).aiMatrixState = matrixState;
      (submission as any).markModified('aiMatrixState');
      try {
        await submission.save();
      } catch (persistErr) {
        // Non-fatal: the response still carries the rebuilt matrices even if
        // the durable write fails (e.g. a transient write conflict).
        console.warn('[matrices] failed to persist rebuilt aiMatrixState:', persistErr);
      }
    }
  }
  res.json({
    submissionId: String(submission._id),
    aiReviewState: state,
    aiMatrixState: matrixState
  });
}

/**
 * GET /api/submissions/:submissionId/review/evidence-doc/:sectionId/file
 *
 * Streams the appendix's OWN stored file (the native PDF the MCC pipeline
 * sliced out and uploaded to S3) so "View source" on an appendix card shows
 * exactly that appendix as its own PDF — not the whole self-study HTML where
 * you can't tell where one appendix ends and the next begins. Access-gated by
 * _loadOwnedSubmission; the S3 key comes from the persisted review state, never
 * from the client.
 */
export async function getReviewEvidenceDocFile(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { sectionId } = req.params;
  const state = (submission as any).aiReviewState;
  const doc = ((state?.evidenceDocs as any[]) || []).find((e) => e?.sectionId === sectionId);
  if (!doc) {
    res.status(404).json({ error: 'Evidence file not found in this submission’s review state' });
    return;
  }
  if (!doc.s3Key) {
    res.status(404).json({ error: 'This appendix has no stored file yet (S3 upload may have failed at import).' });
    return;
  }
  try {
    const buf = await downloadFileAsBuffer(String(doc.s3Key));
    const name = String(doc.fileName || `${doc.mccCode || 'appendix'}.pdf`).replace(/[\r\n"]/g, '');
    res.setHeader('Content-Type', String(doc.mimeType || 'application/pdf'));
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buf);
  } catch (err: any) {
    console.error('[getReviewEvidenceDocFile] S3 fetch failed:', err?.message || err);
    res.status(502).json({ error: 'Could not fetch the stored file from storage.' });
  }
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
  await persistAiReviewState(submission, state);
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
  await persistAiReviewState(submission, state);
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

  await persistAiReviewState(submission, state);
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
  await persistAiReviewState(submission, state);
  res.json({ ok: true, sectionId, resolvedStd: stdVal, resolvedSpec: specVal });
}

/**
 * POST /api/submissions/:submissionId/review/evidence-doc-references
 *
 * Persist MULTIPLE Standard/Substandard references for a single appendix /
 * evidence doc (or CV) so one file can be linked under several specs (e.g.
 * Appendix A10 → both the Introduction AND Standard 1.e). Mirrors
 * routeEvidence, but writes `referencedBySpecs: [{std, spec}]` — the list the
 * materialize path (setApproved) fans out over to create one SupportingEvidence
 * per referenced spec. Back-compat: also mirrors the FIRST reference onto
 * resolvedStd/resolvedSpec/routing so the single-dropdown prefill + fallback
 * still work when the list is empty.
 */
export async function setEvidenceDocReferences(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { sectionId, references } = req.body || {};
  if (!sectionId || typeof sectionId !== 'string') {
    res.status(400).json({ error: 'sectionId is required' });
    return;
  }
  const state = (submission as any).aiReviewState;
  if (!state) {
    res.status(409).json({ error: 'aiReviewState is empty' });
    return;
  }

  // Normalize + dedupe the incoming references (keep only entries with a std).
  const seen = new Set<string>();
  const refs: Array<{ std: string; spec?: string }> = [];
  for (const r of Array.isArray(references) ? references : []) {
    if (!r || !r.std) continue;
    const std = String(r.std);
    const spec = r.spec ? String(r.spec) : undefined;
    const key = `${std}::${spec ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ std, spec });
  }

  const first = refs[0];

  const apply = (item: any): boolean => {
    if (!item || item.sectionId !== sectionId) return false;
    item.referencedBySpecs = refs;
    // Back-compat: keep the single-routing display fields + apply fallback in
    // sync with the FIRST reference (or clear them when the list is empty).
    item.resolvedStd = first?.std;
    item.resolvedSpec = first?.spec;
    item.routing = {
      ...(item.routing || {}),
      std: first?.std,
      spec: first?.spec,
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
  await persistAiReviewState(submission, state);
  res.json({ ok: true, sectionId, referencedBySpecs: refs });
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
  // Apply-gate state: which coverage-verifier "missing fragments" the
  // coordinator has resolved. Persist it so the gate survives a refresh
  // instead of resetting (and silently re-blocking Apply).
  'resolvedMissingFragmentIds',
] as const;

export async function saveReviewState(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  // UPSERT: if this submission has no aiReviewState yet (the import callback
  // never seeded it, or seeding failed), DON'T reject — initialize an empty
  // state and save into it. Previously this returned 409, which meant the
  // client's recovery autosave (it has the content, the server doesn't) could
  // never heal a never-seeded submission, leaving that content stranded in the
  // browser. All parsed/entered content must be able to reach the database.
  let state = (submission as any).aiReviewState;
  if (!state) {
    state = buildEmptyReviewState();
    (submission as any).aiReviewState = state;
  }
  const body = req.body || {};

  // ── DATA ISOLATION GUARD ────────────────────────────────────────────────
  // A submission's review state may ONLY hold content that originated from an
  // import of THIS submission. Every merged review item is stamped with its
  // `sourceImportId`; every import belongs to exactly one submission. Reject a
  // save whose items carry an import origin from a DIFFERENT submission — this
  // is what stops a stale browser store from bleeding one institution's parsed
  // document onto another submission (cross-institution data leak).
  const referencedImportIds = new Set<string>();
  const noteOrigin = (v: any) => {
    const id = v && (v.sourceImportId || v.importId);
    if (id) referencedImportIds.add(String(id));
  };
  for (const b of Object.values((body.buckets || {}) as Record<string, any>)) {
    (b?.narratives || []).forEach(noteOrigin);
    (b?.evidenceText || []).forEach(noteOrigin);
    (b?.evidenceFiles || []).forEach(noteOrigin);
  }
  (body.tags || []).forEach(noteOrigin);
  (body.cvs || []).forEach(noteOrigin);
  (body.evidenceDocs || []).forEach(noteOrigin);
  for (const b of Object.values((body.introductions || {}) as Record<string, any>)) {
    (b?.items || []).forEach(noteOrigin);
  }
  if (referencedImportIds.size > 0) {
    const validIds = [...referencedImportIds].filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );
    const imports = validIds.length
      ? await SelfStudyImport.find({ _id: { $in: validIds } })
          .select('_id submissionId')
          .lean()
      : [];
    const foreign = imports.filter(
      (imp: any) => String(imp.submissionId) !== String(submission._id)
    );
    if (foreign.length > 0) {
      console.error(
        `[save-state BLOCKED — data isolation] submission ${submission._id} ` +
          `(institution ${(submission as any).institutionId}) received review content ` +
          `from foreign import(s) ${foreign
            .map((i: any) => `${i._id}->submission:${i.submissionId}`)
            .join(', ')} by user ${req.user?.id} (${req.user?.role}). Rejected.`
      );
      res.status(409).json({
        error:
          'This content does not belong to this submission and was blocked to protect ' +
          'institution data. Please reload the page before continuing.',
        code: 'CROSS_SUBMISSION_CONTENT_BLOCKED',
      });
      return;
    }
  }
  // Stamp the owner so the origin is auditable + future reads can double-check.
  (state as any).ownerSubmissionId = String(submission._id);
  (state as any).ownerInstitutionId = (submission as any).institutionId
    ? String((submission as any).institutionId)
    : null;
  // ────────────────────────────────────────────────────────────────────────

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
  // BUG FIX 2026-07-13 (prod: "Approve all → Standard didn't copy over") —
  // this used submission.save(), which rewrites the ENTIRE document from the
  // snapshot loaded at the top of this handler. save-state is fired on every
  // Approve; when it lands AFTER the concurrent set-approved materialize, its
  // stale narratives snapshot clobbered the just-written narratives (lost
  // update — exactly what wiped Standard 2). Write ONLY aiReviewState with an
  // atomic $set so narratives (and every other field) are never touched.
  const plainState =
    typeof (state as any)?.toObject === 'function' ? (state as any).toObject() : state;
  await Submission.updateOne(
    { _id: submission._id },
    { $set: { aiReviewState: plainState } }
  );
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
  const fileItems: Array<{ sectionId: string; std?: string; spec?: string; title: string; body: string; html?: string | null; kind: string; s3Key?: string; s3Bucket?: string; mimeType?: string; fileName?: string; fileSize?: number; aiText?: string }> = [];
  for (const bucket of Object.values(buckets) as any[]) {
    for (const it of bucket.evidenceFiles || []) {
      if (approved.has(it.sectionId)) {
        // Files are frequently tables — the real content lives in htmlSnippet;
        // `snippet` is just a "(data table)" placeholder. Prefer the richer one.
        const body = evidenceBodyText(it.htmlSnippet, it.snippet);
        fileItems.push({ sectionId: it.sectionId, std: bucket.standardCode, spec: bucket.specCode, title: it.heading || 'Evidence file', body, html: it.htmlSnippet, kind: 'file' });
      }
    }
  }
  for (const c of state.cvs || []) {
    if (approved.has(c.sectionId)) {
      const body = evidenceBodyText(c.htmlSnippet, c.snippet || c.fullText);
      fileItems.push({ sectionId: c.sectionId, std: c.resolvedStd || c.routing?.std, spec: c.resolvedSpec || c.routing?.spec, title: `${c.facultyName || 'Faculty'} — CV`, body, html: c.htmlSnippet, kind: 'cv' });
    }
  }
  for (const e of state.evidenceDocs || []) {
    if (!approved.has(e.sectionId)) continue;
    const body = evidenceBodyText(e.htmlSnippet, e.snippet || e.summary);
    const common = {
      title: e.title || 'Evidence document',
      body,
      html: e.htmlSnippet,
      kind: e.docSubKind || 'paper',
      // MCC appendix files arrive pre-sliced as native PDFs already in S3.
      // Carry the S3 handle + the HIDDEN extracted text (AI-eval only).
      s3Key: e.s3Key || undefined,
      s3Bucket: e.s3Bucket || undefined,
      mimeType: e.mimeType || undefined,
      fileName: e.fileName || undefined,
      fileSize: e.fileSize || undefined,
      aiText: (e as any).extractedText || undefined,
    };
    // THIRD PASS multi-link: materialize the file under EVERY spec its text
    // cites (referencedBySpecs), so each spec's File Library shows exactly the
    // documents it references — not just the first-citing spec. Falls back to
    // the single resolved routing (incl. 'introduction' / unassigned) when the
    // parser produced no multi-spec list (CVs, non-MCC docs, intro-only files).
    const specs: Array<{ std?: string; spec?: string }> =
      Array.isArray((e as any).referencedBySpecs) && (e as any).referencedBySpecs.length
        ? (e as any).referencedBySpecs.map((r: any) => ({
            std: String(r.std),
            // An 'introduction' reference has no substandard — must stay
            // undefined, NOT the literal string "undefined".
            spec: r.spec != null && r.spec !== '' ? String(r.spec) : undefined,
          }))
        : [{ std: e.resolvedStd || e.routing?.std, spec: e.resolvedSpec || e.routing?.spec }];
    for (const { std, spec } of specs) {
      // Distinct rev tag per (file, spec) so one appendix can appear under every
      // citing spec without colliding on the upsert key.
      const perSpecId = specs.length > 1 && std && spec ? `${e.sectionId}::${std}.${spec}` : e.sectionId;
      fileItems.push({ sectionId: perSpecId, std, spec, ...common });
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

      // ── Native S3-backed file (MCC appendix PDF, OR a bulk-imported
      // pdf/docx/xlsx/pptx): keep the ORIGINAL file as-is — NOT flattened to a
      // synthesized .docx. The reader opens the real file (natively / via the
      // Office web viewer); the HIDDEN extracted text goes to
      // metadata.description so the AI evaluator can read the content.
      if (fi.s3Key && fi.mimeType) {
        const extByMime = (fi.mimeType || '').includes('spreadsheetml') ? '.xlsx'
          : (fi.mimeType || '').includes('presentationml') ? '.pptx'
          : (fi.mimeType || '').includes('wordprocessingml') ? '.docx'
          : (fi.mimeType || '').includes('pdf') ? '.pdf' : '';
        const nativeName = (fi.fileName || `${String(fi.title).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'evidence'}${extByMime}`);
        const aiText = (fi.aiText || bodyText || '').trim();
        const existingPdf: any = await SupportingEvidence.findOne({ submissionId: submission._id, tags: tag, isDeleted: false });
        const fileData = {
          filename: nativeName,
          originalName: nativeName,
          mimeType: fi.mimeType,
          size: fi.fileSize || 0,
          s3Key: fi.s3Key,
          s3Bucket: fi.s3Bucket,
          storageType: 's3' as const,
          uploadedAt: new Date(),
          uploadedBy: userId || submission.submitterId,
        };
        if (existingPdf) {
          existingPdf.standardCode = fi.std || undefined;
          existingPdf.specCode = fi.spec || undefined;
          existingPdf.description = fi.title;
          existingPdf.metadata = { ...(existingPdf.metadata || {}), description: aiText };
          existingPdf.markModified('metadata');
          existingPdf.file = { ...(existingPdf.file || {}), ...fileData } as any;
          existingPdf.markModified('file');
          await existingPdf.save();
          _evUpdated += 1;
        } else {
          await SupportingEvidence.create({
            institutionId: submission.institutionId,
            submissionId: submission._id,
            uploadedBy: userId || submission.submitterId,
            standardCode: fi.std || undefined,
            specCode: fi.spec || undefined,
            evidenceType: 'document',
            file: fileData as any,
            description: fi.title,
            // HIDDEN AI-readable text (extracted/OCR); reader sees the file only.
            metadata: { description: aiText },
            versionNumber: 1, isCurrentVersion: true, isDeleted: false,
            linkedNarratives: [],
            tags: ['ai-import', 'native-file', `kind:${fi.kind}`, tag],
          });
          _evCreated += 1;
        }
        if (fi.std && fi.spec) affected.push({ std: fi.std, spec: fi.spec });
        continue;
      }

      // Build the .docx with REAL tables when the source has them (evidence is
      // frequently tabular). Mammoth round-trips real Word tables back to <table>
      // so the File-Library preview is readable instead of a run-on paragraph.
      const children: any[] = [
        new Paragraph({ text: fi.title, heading: HeadingLevel.HEADING_1 }),
        ...evidenceDocxBlocks(fi.html, bodyText),
      ];
      const buffer = await Packer.toBuffer(new Document({ creator: 'CSHSE', title: fi.title, sections: [{ properties: {}, children }] }));
      const filename = `${String(fi.title).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80) || 'evidence'}.docx`;
      const existing: any = await SupportingEvidence.findOne({ submissionId: submission._id, tags: tag, isDeleted: false });
      if (existing) {
        // Heal/upgrade an already-materialized record: refresh routing + text AND
        // regenerate the file so older flattened-table .docx files become readable
        // (real tables) on the next set-approved.
        existing.standardCode = fi.std || undefined;
        existing.specCode = fi.spec || undefined;
        existing.description = fi.title;
        existing.metadata = { ...(existing.metadata || {}), description: bodyText };
        existing.markModified('metadata');
        const ef = existing.file || {};
        existing.file = {
          ...ef,
          filename: ef.filename || filename,
          originalName: ef.originalName || filename,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: buffer.byteLength, data: buffer.toString('base64'), encoding: 'base64',
          storageType: 'base64', uploadedAt: new Date(), uploadedBy: userId || submission.submitterId,
        };
        existing.markModified('file');
        await existing.save();
        _evUpdated += 1;
        if (fi.std && fi.spec) affected.push({ std: fi.std, spec: fi.spec });
        continue;
      }
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

function _cellText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const _TBL_BORDER = { style: BorderStyle.SINGLE, size: 1, color: '999999' } as const;

/** Parse one `<table>…</table>` HTML block into a real Word table. */
function _htmlTableToDocx(tableHtml: string): Table | null {
  const rows: TableRow[] = [];
  const trRe = /<tr\b[\s\S]*?<\/tr>/gi;
  let tr: RegExpExecArray | null;
  let maxCols = 0;
  const rawRows: string[][] = [];
  while ((tr = trRe.exec(tableHtml))) {
    const cells: string[] = [];
    const cellRe = /<(td|th)\b[\s\S]*?<\/\1>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(tr[0]))) cells.push(_cellText(c[0]));
    if (cells.length) { rawRows.push(cells); maxCols = Math.max(maxCols, cells.length); }
  }
  if (rawRows.length === 0 || maxCols === 0) return null;
  for (const cells of rawRows) {
    // Pad short rows so every row has the same column count (valid OOXML table).
    while (cells.length < maxCols) cells.push('');
    rows.push(new TableRow({
      children: cells.map((t) => new TableCell({ children: [new Paragraph({ text: t })] })),
    }));
  }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: _TBL_BORDER, bottom: _TBL_BORDER, left: _TBL_BORDER, right: _TBL_BORDER,
      insideHorizontal: _TBL_BORDER, insideVertical: _TBL_BORDER,
    },
  });
}

/**
 * Build DOCX body blocks (paragraphs + REAL tables) for an evidence item.
 * Evidence items are frequently tables — rendering them as a flat paragraph
 * makes the File-Library preview unreadable. When `html` carries `<table>`s we
 * emit real Word tables (so mammoth round-trips them back to <table> in preview)
 * and paragraphs for the surrounding prose; otherwise we fall back to plain-text
 * paragraphs.
 */
function evidenceDocxBlocks(html?: string | null, fallbackText?: string): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  const src = html || '';
  const pushProse = (chunk: string) => {
    const parts = chunk
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .split('\n')
      .map(_cellText)
      .filter(Boolean);
    for (const p of parts) out.push(new Paragraph({ text: p }));
  };

  if (/<table[\s>]/i.test(src)) {
    const re = /<table\b[\s\S]*?<\/table>/gi;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      if (m.index > last) pushProse(src.slice(last, m.index));
      const t = _htmlTableToDocx(m[0]);
      if (t) out.push(t);
      last = re.lastIndex;
    }
    if (last < src.length) pushProse(src.slice(last));
  } else {
    // No HTML tables — split the readable text into paragraphs.
    for (const p of String(fallbackText || evidenceBodyText(html, fallbackText)).split(/\n\s*\n/)) {
      const t = p.trim();
      if (t) out.push(new Paragraph({ text: t }));
    }
  }
  if (out.length === 0) out.push(new Paragraph({ text: (fallbackText || '').trim() }));
  return out;
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
  // 2026-06-09 — instead of synchronously evaluating up to 24 specs (which left
  // the rest un-evaluated), ENQUEUE every affected spec for background AI
  // evaluation. The worker drains the queue in batches so "Approve all" runs the
  // AI against EVERYTHING without blocking the request/UI.
  const evalQueued = await enqueueSpecsForEval(submission._id, affected.map((a) => `${a.std}.${a.spec}`));
  res.json({
    ok: true,
    approvedIds: state.approvedIds,
    evidence: (submission as any).__evidenceStats ?? null,
    matricesApplied,
    evalQueued, // how many specs were (re)queued for background evaluation
  });
}

/** Specs (as "std.spec") that currently have non-empty narrative content. */
function specsWithContent(submission: any): string[] {
  const out: string[] = [];
  const narr = submission.narratives;
  if (!narr) return out;
  const stdEntries: Array<[string, any]> =
    narr instanceof Map ? Array.from(narr.entries()) : Object.entries(narr);
  for (const [std, specMap] of stdEntries) {
    const specEntries: Array<[string, any]> =
      specMap instanceof Map ? Array.from(specMap.entries()) : Object.entries(specMap || {});
    for (const [spec, entry] of specEntries) {
      if (((entry?.content as string) || '').trim()) out.push(`${std}.${spec}`);
    }
  }
  return out;
}

/** Merge spec keys into the submission's background eval queue (atomic). */
async function enqueueSpecsForEval(submissionId: any, keys: string[]): Promise<number> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return 0;
  await Submission.updateOne(
    { _id: submissionId },
    {
      $addToSet: { aiEvalQueue: { $each: unique } },
      $set: { aiEvalQueueStartedAt: new Date() },
      $unset: { aiEvalQueueDoneAt: '' },
    }
  );
  // Bump the high-water-mark total so progress (done = total - remaining) is sane.
  const fresh: any = await Submission.findById(submissionId).select('aiEvalQueue aiEvalQueueTotal');
  const len = (fresh?.aiEvalQueue || []).length;
  const total = Math.max(fresh?.aiEvalQueueTotal || 0, len);
  await Submission.updateOne({ _id: submissionId }, { $set: { aiEvalQueueTotal: total } });
  return unique.length;
}

/**
 * POST /api/submissions/:submissionId/review/evaluate-all
 * Queue EVERY spec-with-content for background AI evaluation ("Validate all").
 * Returns immediately; the worker drains the queue. Progress via /eval-progress.
 */
export async function evaluateAllSpecs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const keys = specsWithContent(submission);
  await Submission.updateOne(
    { _id: submission._id },
    {
      $set: {
        aiEvalQueue: keys,
        aiEvalQueueTotal: keys.length,
        aiEvalQueueStartedAt: new Date(),
      },
      $unset: { aiEvalQueueDoneAt: '' },
    }
  );
  res.json({ ok: true, queued: keys.length });
}

/**
 * GET /api/submissions/:submissionId/review/eval-progress
 * Progress of the background AI-evaluation queue.
 */
export async function getEvalProgress(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const remaining = ((submission as any).aiEvalQueue || []).length;
  const total = (submission as any).aiEvalQueueTotal || 0;
  res.json({
    total,
    remaining,
    done: Math.max(0, total - remaining),
    running: remaining > 0,
    doneAt: (submission as any).aiEvalQueueDoneAt || null,
  });
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
  await persistAiReviewState(submission, state);
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
  await persistAiReviewState(submission, state);
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

// ============================================================================
// Bulk supporting-evidence import (drag-and-drop many files into the Review)
// ============================================================================

/** Infer a proper MIME from the filename when the client sent a generic one. */
function normalizeMime(mime: string, filename: string): string {
  const m = (mime || '').toLowerCase();
  if (m && m !== 'application/octet-stream' && m !== 'binary/octet-stream') return mime;
  const ext = (filename.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  const byExt: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff',
  };
  return byExt[ext] || mime || 'application/octet-stream';
}

/** Strip HTML → plain text for reference matching. */
function htmlToPlain(html?: string | null): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Collect every (standardCode, specCode, plain-text) tuple the coordinator has
 * imported — from the in-review buckets/introductions AND the applied
 * narratives/standardIntroductions — so we can reference-match a dropped file
 * against whatever the self-study actually says.
 */
export function gatherNarrativeTuples(submission: any): NarrativeTuple[] {
  const tuples: NarrativeTuple[] = [];
  const push = (std?: string, spec?: string, text?: string) => {
    const t = (text || '').trim();
    if (std && t) tuples.push({ standardCode: String(std), specCode: spec ? String(spec) : undefined, content: t });
  };

  const state = submission.aiReviewState || {};
  // In-review buckets (pre-Apply).
  for (const bucket of Object.values(state.buckets || {}) as any[]) {
    const parts: string[] = [];
    for (const it of [...(bucket?.narratives || []), ...(bucket?.evidenceText || [])]) {
      parts.push(it.htmlSnippet ? htmlToPlain(it.htmlSnippet) : it.snippet || '');
    }
    push(bucket?.standardCode, bucket?.specCode, parts.join(' \n '));
  }
  // In-review introductions (keyed e.g. `_intro:standard-2`).
  for (const [key, ib] of Object.entries(state.introductions || {}) as any[]) {
    const items = (ib?.items || []) as any[];
    const text = items.map((it) => (it.htmlSnippet ? htmlToPlain(it.htmlSnippet) : it.snippet || '')).join(' \n ');
    const m = String(key).match(/standard-(\d+)/);
    if (m) push(m[1], undefined, text);
  }

  // Applied narratives (post-Apply) — Mongoose nested Maps.
  const narr = submission.narratives;
  if (narr && typeof narr.forEach === 'function') {
    narr.forEach((specMap: any, std: string) => {
      if (specMap && typeof specMap.forEach === 'function') {
        specMap.forEach((val: any, spec: string) => push(std, spec, htmlToPlain(val?.content)));
      }
    });
  }
  const intros = submission.standardIntroductions;
  if (intros && typeof intros.forEach === 'function') {
    intros.forEach((val: any, std: string) => push(std, undefined, htmlToPlain(val)));
  }

  return tuples;
}

/**
 * POST /api/submissions/:submissionId/review/bulk-evidence
 * multipart: files[] (up to 30). For each file:
 *   1. store the ORIGINAL file to S3 (native format preserved),
 *   2. create a SupportingEvidence row immediately (unassigned) so it appears
 *      in the File Library right away — the Approve button only stamps the
 *      (standard, spec) later,
 *   3. extract its text + suggest a (standard, sub-spec) by reference-matching
 *      the imported narratives and the AI placement matcher,
 *   4. add it to aiReviewState.evidenceDocs so it shows in the Review Evidence
 *      rail with its suggestion pre-filled.
 * Returns the added docs (with suggestions) so the client can refresh the rail.
 */
export async function bulkAddEvidence(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const files = (req as any).files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files uploaded (field name must be "files").' });
    return;
  }
  if (!isS3Configured()) {
    res.status(503).json({ error: 'File storage (S3) is not configured on this server.' });
    return;
  }

  const userId = req.user?.id || req.user?._id;
  const institutionId = submission.institutionId;
  const programLevel = String(submission.programLevel || 'bachelors');
  const bucketName = process.env.AWS_S3_BUCKET_NAME || '';

  // One narrative snapshot for the whole batch (cheap, avoids re-gathering).
  const narratives = gatherNarrativeTuples(submission);

  // Ensure a review-state object exists (a submission may have only evidence).
  let state = (submission as any).aiReviewState;
  if (!state || typeof state !== 'object') {
    state = buildEmptyReviewState();
    (submission as any).aiReviewState = state;
  }
  if (!Array.isArray(state.evidenceDocs)) state.evidenceDocs = [];

  // Bounded-concurrency processing — a folder drop can be 20+ files and each may
  // call the AI classifier + extractor, so serial awaits would time out. Order is
  // preserved in the response.
  const CONCURRENCY = 5;
  const results: Array<{ doc: any; summary: any } | null> = new Array(files.length).fill(null);
  const errors: Array<any | null> = new Array(files.length).fill(null);

  const processOne = async (f: Express.Multer.File): Promise<{ doc: any; summary: any }> => {
      const sectionId = `bulk-${uuidv4()}`;
      const title = titleFromFilename(f.originalname);
      const mime = normalizeMime(f.mimetype, f.originalname);
      const versionId = uuidv4();
      const s3Key = generateS3Key(String(institutionId), versionId, f.originalname);
      const { bucket } = await uploadFile(s3Key, f.buffer, mime);

      // Extract text (best-effort) for suggestion + hidden AI-eval body.
      const extracted = await extractFileText({ s3Key, s3Bucket: bucket, mimeType: mime, filename: f.originalname });
      const text = extracted.text || '';

      // Suggest a placement (reference-match + semantic).
      const { suggestions, best } = await suggestStandardForFile({
        title,
        filename: f.originalname,
        text,
        narratives,
        programLevel,
        institutionId: String(institutionId),
      });

      // Create the SupportingEvidence row NOW (unassigned) so it's already in
      // the File Library; the rev tag is the upsert key set-approved uses later.
      const evTag = `rev:${sectionId}`;
      const ev = await SupportingEvidence.create({
        institutionId,
        submissionId: submission._id,
        uploadedBy: userId || submission.submitterId,
        // no standardCode/specCode yet — Approve stamps it.
        evidenceType: (mime || '').startsWith('image/') ? 'image' : 'document',
        file: {
          filename: f.originalname,
          originalName: f.originalname,
          mimeType: mime,
          size: f.size,
          s3Key,
          s3Bucket: bucket,
          storageType: 's3',
          uploadedAt: new Date(),
          uploadedBy: userId || submission.submitterId,
        },
        description: title,
        // hidden extracted text — the AI evaluator reads metadata.description.
        metadata: { description: text.slice(0, 20000) },
        versionNumber: 1,
        isCurrentVersion: true,
        isDeleted: false,
        linkedNarratives: [],
        tags: ['ai-import', 'bulk-import', evTag],
      });

      // Detect a syllabus by name so the rail groups it correctly.
      const isSyllabus = /syllab|course outline/i.test(f.originalname);
      const doc: any = {
        sectionId,
        docSubKind: isSyllabus ? 'syllabus' : 'paper',
        title,
        sourceFilename: f.originalname,
        fileName: f.originalname,
        s3Key,
        s3Bucket: bucket,
        mimeType: mime,
        fileSize: f.size,
        fileId: String(ev._id),
        pageCountEstimate: 0,
        imageCount: 0,
        summary: text ? text.slice(0, 400) : title,
        extractedText: text.slice(0, 20000),
        // Pre-fill the routing dropdowns with the best suggestion (accept-as-is
        // or override) ONLY when the matcher was confident. A weak/ambiguous
        // match leaves the file UNASSIGNED (it's already in the library) with
        // its closest guesses shown — better than a confident wrong route.
        resolvedStd: best?.standardCode,
        resolvedSpec: best?.specCode,
        routing: best ? { std: best.standardCode, spec: best.specCode, source: 'suggestion' } : undefined,
        // Suggestion metadata for the rationale line + alternates.
        aiSuggestions: suggestions.slice(0, 3),
        aiSuggestionRationale: best
          ? best.rationale
          : suggestions.length
          ? `Not confident enough to auto-assign — please choose. Closest guesses: ${suggestions
              .slice(0, 2)
              .map((s) => `Std ${s.standardCode}${s.specCode ? '.' + s.specCode : ''} (${Math.round(s.confidence * 100)}%)`)
              .join(', ')}`
          : 'Could not determine a standard from the file — please assign it.',
        aiSuggestionConfidence: best?.confidence,
        bulkImported: true,
      };
      return {
        doc,
        summary: { ...doc, extractedTextChars: text.length, extractError: extracted.error },
      };
  };

  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= files.length) return;
      try {
        results[i] = await processOne(files[i]);
      } catch (err: any) {
        console.error('[bulkAddEvidence] failed for', files[i].originalname, err?.message || err);
        errors[i] = { sectionId: null, fileName: files[i].originalname, error: err?.message || String(err) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()));

  const added: any[] = [];
  for (let i = 0; i < files.length; i++) {
    if (results[i]) {
      state.evidenceDocs.push(results[i]!.doc);
      added.push(results[i]!.summary);
    } else if (errors[i]) {
      added.push(errors[i]);
    }
  }

  (submission as any).markModified('aiReviewState');
  await persistAiReviewState(submission, state);

  res.json({ ok: true, count: added.filter((a) => a.sectionId).length, added });
}

/**
 * POST /api/submissions/:submissionId/review/recompute-coverage
 * Run the AI coverage reviewer over the submission's filled spec buckets and
 * write score/covered/gaps/strengths back onto each — so the green/yellow/red
 * dot + its "why" tooltip have real data. Backfills imports that never ran the
 * reviewer (older MCC imports). Body { onlyMissing?: boolean } (default true).
 */
export async function recomputeCoverage(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const state = (submission as any).aiReviewState;
  if (!state || !state.buckets) {
    res.status(409).json({ error: 'No review state / buckets to assess.' });
    return;
  }
  const onlyMissing = req.body?.onlyMissing !== false; // default: fill the gaps
  const programLevel = String(submission.programLevel || 'bachelors');

  const specs: Array<{ standardCode: string; specCode: string; narrativeText: string; evidence: any[]; _key: string }> = [];
  for (const [key, bAny] of Object.entries(state.buckets)) {
    const b = bAny as any;
    const std = b?.standardCode, spec = b?.specCode;
    if (!std || !spec) continue;
    const narr = b.narratives || [], evt = b.evidenceText || [], evf = b.evidenceFiles || [];
    if (!(narr.length || evt.length || evf.length)) continue; // empty spec — no dot
    if (onlyMissing && (b.coverageScore != null || b.coverageCovered != null)) continue;
    const narrativeText = narr
      .map((n: any) => (n.htmlSnippet ? htmlToPlain(n.htmlSnippet) : n.snippet || ''))
      .join('\n\n')
      .slice(0, 12000);
    const evidence = [...evt, ...evf].map((e: any) => ({
      heading: e.heading || '',
      snippet: (e.htmlSnippet ? htmlToPlain(e.htmlSnippet) : e.snippet || '').slice(0, 1500),
    }));
    specs.push({ standardCode: String(std), specCode: String(spec), narrativeText, evidence, _key: key });
  }

  if (specs.length === 0) {
    res.json({ ok: true, assessed: 0, message: onlyMissing ? 'All filled specs already have a coverage assessment.' : 'No filled specs to assess.' });
    return;
  }

  const { results, error } = await reviewCoverage({
    programLevel,
    specs: specs.map((s) => ({ standardCode: s.standardCode, specCode: s.specCode, narrativeText: s.narrativeText, evidence: s.evidence })),
  });
  if (error && results.length === 0) {
    res.status(502).json({ error: `Coverage review failed: ${error}` });
    return;
  }
  const byKey = new Map(results.map((r) => [`${r.standardCode}.${r.specCode}`, r]));
  let assessed = 0;
  for (const s of specs) {
    const r = byKey.get(`${s.standardCode}.${s.specCode}`);
    if (!r) continue;
    const b = state.buckets[s._key] as any;
    b.coverageScore = r.coverageScore;
    b.coverageCovered = r.coverageCovered;
    b.coverageGaps = r.coverageGaps || [];
    b.coverageStrengths = r.coverageStrengths || [];
    assessed += 1;
  }
  (submission as any).markModified('aiReviewState');
  await persistAiReviewState(submission, state);
  res.json({ ok: true, assessed, total: specs.length });
}

// ---------------------------------------------------------------- matrix denoise
// A curriculum matrix (spec rows × course columns, cells X/H/M/L) flattened by
// the PDF text extractor leaks its cells into narrative text. Mirror of the
// ai-service `denoise_matrix_cells` / `is_matrix_row` so we can clean an
// already-parsed submission's buckets in place (no re-import → approvals kept).
const _CELL_RUN = /(?:\b[XHMLIKTS]{1,8}\b[ \t.,]*){4,}/; // test (non-global)
const _CELL_RUN_G = /(?:\b[XHMLIKTS]{1,8}\b[ \t.,]*){4,}/g; // replace (global)
function denoiseMatrixCells(text: string): string {
  if (!text || !_CELL_RUN.test(text)) return text;
  return text.replace(_CELL_RUN_G, ' ').replace(/[ \t]{2,}/g, ' ').trim();
}
function isMatrixRow(text: string): boolean {
  if (!text || !_CELL_RUN.test(text)) return false;
  const stripped = denoiseMatrixCells(text);
  return (stripped.match(/[A-Za-z]{3,}/g) || []).length < 5;
}

/**
 * POST /api/submissions/:submissionId/review/denoise-narratives
 * Clean curriculum-matrix garbage out of an ALREADY-parsed submission's
 * narratives (no re-import needed, so approvals survive): drop chunks that are
 * pure matrix rows, strip stray cell runs from the rest. Idempotent.
 */
export async function denoiseNarratives(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const state = (submission as any).aiReviewState;
  if (!state || !state.buckets) {
    res.status(409).json({ error: 'No review state / buckets to clean.' });
    return;
  }
  const approved = new Set<string>(state.approvedIds || []);
  const discarded = new Set<string>(state.discardedIds || []);
  let dropped = 0, cleaned = 0;
  const removedIds: string[] = [];

  for (const bAny of Object.values(state.buckets)) {
    const b = bAny as any;
    const kept: any[] = [];
    for (const it of (b.narratives || [])) {
      const snip = String(it.snippet || '');
      const head = String(it.heading || '');
      if (isMatrixRow(snip) || isMatrixRow(head)) {
        dropped += 1;
        if (it.sectionId) removedIds.push(it.sectionId);
        continue; // a pure matrix row — the grid lives in Appendix A6
      }
      const nSnip = denoiseMatrixCells(snip);
      const nHead = denoiseMatrixCells(head);
      const nHtml = it.htmlSnippet ? denoiseMatrixCells(String(it.htmlSnippet)) : it.htmlSnippet;
      if (nSnip !== snip || nHead !== head || nHtml !== it.htmlSnippet) {
        it.snippet = nSnip;
        it.heading = nHead;
        if (it.htmlSnippet) it.htmlSnippet = nHtml;
        it.wordCount = nSnip.split(/\s+/).filter(Boolean).length;
        cleaned += 1;
      }
      kept.push(it);
    }
    b.narratives = kept;
  }
  // Prune removed ids from approved/discarded sets.
  for (const id of removedIds) { approved.delete(id); discarded.delete(id); }
  state.approvedIds = [...approved];
  state.discardedIds = [...discarded];
  state.lastUpdatedAt = new Date();
  (submission as any).markModified('aiReviewState');
  await persistAiReviewState(submission, state);
  res.json({ ok: true, dropped, cleaned });
}

/**
 * GET /api/submissions/:submissionId/review/evidence-doc/:sectionId/public-url
 * Mint a short-lived public URL for the Office web viewer (xlsx/pptx). Access is
 * checked here (owned submission); the returned URL carries a signed token.
 */
export async function getReviewEvidenceDocPublicUrl(req: AuthenticatedRequest, res: Response): Promise<void> {
  const submission = await _loadOwnedSubmission(req, res);
  if (!submission) return;
  const { sectionId } = req.params;
  const state = (submission as any).aiReviewState;
  const doc = ((state?.evidenceDocs as any[]) || []).find((e) => e?.sectionId === sectionId);
  if (!doc || !doc.s3Key) {
    res.status(404).json({ error: 'No stored file for this evidence item.' });
    return;
  }
  const token = signFileAccessToken({
    s3Key: String(doc.s3Key),
    mimeType: String(doc.mimeType || 'application/octet-stream'),
    fileName: String(doc.fileName || 'file'),
    sub: String(submission._id),
  });
  const base = `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${base}/public-file/${token}` });
}
