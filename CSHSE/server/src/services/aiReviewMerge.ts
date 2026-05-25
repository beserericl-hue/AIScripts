/**
 * CR-043 — submission-scoped Review state merge service.
 *
 * Called by receiveAICallback on every parse-complete. Takes the
 * import's parse output and merges it into Submission.aiReviewState
 * using the per-kind dedupe rules from the CR:
 *
 *   Fresh import (default):
 *     ADD all items; stamp each with itemSources[sectionId].
 *
 *   Reimport (aiIsReimport === true):
 *     REPLACE items whose (sourceFilename + sourceContentHash) matches
 *     prior items. Items from a DIFFERENT source are left alone.
 *     Approved/discarded marks tied to (importId,sectionId) are
 *     stripped from replaced items — coordinator must re-confirm.
 *
 * On the FIRST import for a submission after CR-043 ships, the handler
 * also clears any pre-CR-043 wizard state from prior SelfStudyImport
 * records on the same submission — user-directed cutover behavior
 * (no auto-hydrate, deliberate clean slate).
 */
import crypto from 'crypto';
import type { IAIReviewState, IAIItemSource } from '../models/Submission';

export interface MergeKindCounts {
  kept: number;
  replaced: number;
  added: number;
}

export interface MergeReport {
  counts: Record<string, MergeKindCounts>;
  cleared: boolean;
}

interface ImportInputs {
  importId: string;
  sourceFilename: string;
  sourceContentHash: string;   // SHA-256 of the original docx
  importedAt: Date;
  reimport: boolean;
  buckets: Record<string, any>;
  tags: any[];
  cvs: any[];
  evidenceDocs: any[];
  introductions: Record<string, any>;
  placeholderSections: any[];
  coverageReport?: any;
}

/** SHA-256 hex of an arbitrary string — used for client-provided
 *  content where the docx hash isn't available at write time. Mostly
 *  a fallback; the upload path stamps `aiDocumentVersionId.sha256`
 *  on the import record. */
export function sha256Hex(input: Buffer | string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function emptyState(): IAIReviewState {
  return {
    buckets: {},
    tags: [],
    cvs: [],
    evidenceDocs: [],
    introductions: {},
    placeholderSections: [],
    coverageReport: undefined,
    approvedIds: [],
    discardedIds: [],
    itemSources: {},
    mergeLog: [],
    lastUpdatedAt: new Date()
  };
}

function ensureItemSource(state: IAIReviewState, sectionId: string, src: IAIItemSource): void {
  if (!state.itemSources[sectionId]) {
    state.itemSources[sectionId] = src;
  }
}

/**
 * Same-source match: an item from a prior merge MATCHES the new import
 * iff its sourceFilename AND sourceContentHash both equal the new
 * import's. "EXACT DOCUMENT" per the CR.
 */
function isSameSource(
  state: IAIReviewState,
  sectionId: string,
  newSourceFilename: string,
  newSourceHash: string
): boolean {
  const src = state.itemSources[sectionId];
  if (!src) return false;
  return src.sourceFilename === newSourceFilename && src.sourceContentHash === newSourceHash;
}

function stampItem<T extends { sectionId?: string }>(it: T, source: IAIItemSource): T & {
  sourceImportId: string;
  sourceFilename: string;
} {
  return {
    ...it,
    sourceImportId: source.importId,
    sourceFilename: source.sourceFilename
  };
}

function dropApprovalsForSection(state: IAIReviewState, sectionId: string): void {
  state.approvedIds = state.approvedIds.filter((id) => id !== sectionId);
  state.discardedIds = state.discardedIds.filter((id) => id !== sectionId);
}

/**
 * Merge one import's output into the submission's persisted Review
 * state. Mutates `state` in place and returns the per-kind counts for
 * audit-log purposes.
 */
export function mergeImportIntoReviewState(
  state: IAIReviewState,
  inputs: ImportInputs
): MergeReport {
  const source: IAIItemSource = {
    importId: inputs.importId,
    sourceFilename: inputs.sourceFilename,
    sourceContentHash: inputs.sourceContentHash,
    importedAt: inputs.importedAt
  };
  const counts: Record<string, MergeKindCounts> = {
    narratives: { kept: 0, replaced: 0, added: 0 },
    evidenceText: { kept: 0, replaced: 0, added: 0 },
    evidenceFiles: { kept: 0, replaced: 0, added: 0 },
    tags: { kept: 0, replaced: 0, added: 0 },
    cvs: { kept: 0, replaced: 0, added: 0 },
    evidenceDocs: { kept: 0, replaced: 0, added: 0 },
    introductions: { kept: 0, replaced: 0, added: 0 },
    placeholders: { kept: 0, replaced: 0, added: 0 },
    matrices: { kept: 0, replaced: 0, added: 0 }
  };

  // --- buckets (narratives + evidenceText + evidenceFiles per spec) ---
  for (const [specKey, incomingBucket] of Object.entries(inputs.buckets || {})) {
    const existing = state.buckets[specKey];
    if (!existing) {
      // Brand new spec; copy + stamp.
      const stamped = {
        ...incomingBucket,
        narratives: (incomingBucket.narratives || []).map((it: any) => stampItem(it, source)),
        evidenceText: (incomingBucket.evidenceText || []).map((it: any) => stampItem(it, source)),
        evidenceFiles: (incomingBucket.evidenceFiles || []).map((it: any) => stampItem(it, source))
      };
      state.buckets[specKey] = stamped;
      for (const it of stamped.narratives) ensureItemSource(state, it.sectionId, source);
      for (const it of stamped.evidenceText) ensureItemSource(state, it.sectionId, source);
      for (const it of stamped.evidenceFiles) ensureItemSource(state, it.sectionId, source);
      counts.narratives.added += stamped.narratives.length;
      counts.evidenceText.added += stamped.evidenceText.length;
      counts.evidenceFiles.added += stamped.evidenceFiles.length;
      continue;
    }
    // Merge per kind.
    for (const kindKey of ['narratives', 'evidenceText', 'evidenceFiles'] as const) {
      const incomingItems: any[] = incomingBucket[kindKey] || [];
      const existingItems: any[] = existing[kindKey] || [];
      let kept = 0;
      let replaced = 0;
      let added = 0;
      let merged = [...existingItems];

      if (inputs.reimport) {
        // Remove prior items whose source matches the incoming source
        // (strict-match on filename + content hash). Items from a
        // DIFFERENT source survive.
        const keep: any[] = [];
        for (const it of existingItems) {
          if (isSameSource(state, it.sectionId, inputs.sourceFilename, inputs.sourceContentHash)) {
            replaced += 1;
            dropApprovalsForSection(state, it.sectionId);
            delete state.itemSources[it.sectionId];
          } else {
            keep.push(it);
            kept += 1;
          }
        }
        merged = keep;
      } else {
        // Fresh import: skip incoming items whose sectionId already
        // exists (idempotent under retry). Track kept count for
        // accuracy.
        kept = existingItems.length;
      }

      const existingIds = new Set(merged.map((it) => it.sectionId));
      for (const it of incomingItems) {
        if (existingIds.has(it.sectionId)) continue;
        const stamped = stampItem(it, source);
        merged.push(stamped);
        ensureItemSource(state, stamped.sectionId, source);
        added += 1;
        existingIds.add(stamped.sectionId);
      }
      existing[kindKey] = merged;
      counts[kindKey].kept += kept;
      counts[kindKey].replaced += replaced;
      counts[kindKey].added += added;
    }
    state.buckets[specKey] = existing;
  }

  // --- tags ---
  const tagCounts = mergeFlatArray(
    state,
    state.tags,
    inputs.tags,
    source,
    inputs.reimport,
    (t: any) => t.tagId,
    (t: any) => t.sectionId  // for itemSource bookkeeping
  );
  state.tags = tagCounts.merged;
  counts.tags = tagCounts.counts;

  // --- cvs ---
  const cvCounts = mergeFlatArray(
    state,
    state.cvs,
    inputs.cvs,
    source,
    inputs.reimport,
    (c: any) => c.sectionId,
    (c: any) => c.sectionId
  );
  state.cvs = cvCounts.merged;
  counts.cvs = cvCounts.counts;

  // --- evidenceDocs ---
  const edCounts = mergeFlatArray(
    state,
    state.evidenceDocs,
    inputs.evidenceDocs,
    source,
    inputs.reimport,
    (e: any) => e.sectionId,
    (e: any) => e.sectionId
  );
  state.evidenceDocs = edCounts.merged;
  counts.evidenceDocs = edCounts.counts;

  // --- introductions (per intro bucket key) ---
  for (const [introKey, incomingBucket] of Object.entries(inputs.introductions || {})) {
    const existing = state.introductions[introKey];
    if (!existing) {
      const stampedItems = (incomingBucket.items || []).map((it: any) => stampItem(it, source));
      state.introductions[introKey] = { ...incomingBucket, items: stampedItems };
      for (const it of stampedItems) ensureItemSource(state, it.sectionId, source);
      counts.introductions.added += stampedItems.length;
      continue;
    }
    const existingItems: any[] = existing.items || [];
    const incomingItems: any[] = incomingBucket.items || [];
    let kept = 0;
    let replaced = 0;
    let added = 0;
    let merged = [...existingItems];

    if (inputs.reimport) {
      const keep: any[] = [];
      for (const it of existingItems) {
        if (isSameSource(state, it.sectionId, inputs.sourceFilename, inputs.sourceContentHash)) {
          replaced += 1;
          dropApprovalsForSection(state, it.sectionId);
          delete state.itemSources[it.sectionId];
        } else {
          keep.push(it);
          kept += 1;
        }
      }
      merged = keep;
    } else {
      kept = existingItems.length;
    }

    const existingIds = new Set(merged.map((it) => it.sectionId));
    for (const it of incomingItems) {
      if (existingIds.has(it.sectionId)) continue;
      const stamped = stampItem(it, source);
      merged.push(stamped);
      ensureItemSource(state, stamped.sectionId, source);
      added += 1;
      existingIds.add(stamped.sectionId);
    }
    existing.items = merged;
    state.introductions[introKey] = existing;
    counts.introductions.kept += kept;
    counts.introductions.replaced += replaced;
    counts.introductions.added += added;
  }

  // --- placeholderSections (replace per source on reimport, else add) ---
  const phCounts = mergeFlatArray(
    state,
    state.placeholderSections,
    inputs.placeholderSections || [],
    source,
    inputs.reimport,
    (p: any) => p.sectionId || `${p.paragraphIndex ?? 0}:${p.heading ?? ''}`,
    (p: any) => p.sectionId || `${p.paragraphIndex ?? 0}:${p.heading ?? ''}`
  );
  state.placeholderSections = phCounts.merged;
  counts.placeholders = phCounts.counts;

  if (inputs.coverageReport && typeof inputs.coverageReport === 'object') {
    state.coverageReport = inputs.coverageReport;
  }
  state.lastUpdatedAt = new Date();
  state.mergeLog.push({
    importId: inputs.importId,
    importedAt: inputs.importedAt,
    reimport: inputs.reimport,
    counts
  });
  return { counts, cleared: false };
}

/**
 * Flat-array merge helper. Returns the merged array + per-kind counts.
 * `keyFn` builds the dedupe key (e.g. tagId for tags, sectionId for cvs);
 * `sectionFn` returns the id used in itemSources (usually the same).
 */
function mergeFlatArray(
  state: IAIReviewState,
  existing: any[],
  incoming: any[],
  source: IAIItemSource,
  reimport: boolean,
  keyFn: (it: any) => string,
  sectionFn: (it: any) => string
): { merged: any[]; counts: MergeKindCounts } {
  const counts: MergeKindCounts = { kept: 0, replaced: 0, added: 0 };
  let merged = [...existing];
  if (reimport) {
    const keep: any[] = [];
    for (const it of existing) {
      const sid = sectionFn(it);
      if (isSameSource(state, sid, source.sourceFilename, source.sourceContentHash)) {
        counts.replaced += 1;
        dropApprovalsForSection(state, sid);
        delete state.itemSources[sid];
      } else {
        keep.push(it);
        counts.kept += 1;
      }
    }
    merged = keep;
  } else {
    counts.kept = existing.length;
  }
  const existingKeys = new Set(merged.map(keyFn));
  for (const it of incoming) {
    if (existingKeys.has(keyFn(it))) continue;
    const stamped = stampItem(it, source);
    merged.push(stamped);
    ensureItemSource(state, sectionFn(stamped), source);
    counts.added += 1;
    existingKeys.add(keyFn(stamped));
  }
  return { merged, counts };
}

/**
 * CR-043 cutover clear. Called by receiveAICallback when it sees a
 * submission with NO aiReviewState yet AND prior SelfStudyImport
 * records carrying pre-CR-043 wizard fields. Wipes those fields on
 * every prior import for the submission. Idempotent: the caller only
 * invokes this branch when state.aiReviewState === null.
 *
 * Returns the count of imports cleared so the audit log can report it.
 */
export async function clearPreCR043State(
  SelfStudyImportModel: any,
  submissionId: any,
  excludeImportId?: any
): Promise<number> {
  const filter: any = { submissionId };
  if (excludeImportId) {
    filter._id = { $ne: excludeImportId };
  }
  const result = await SelfStudyImportModel.updateMany(filter, {
    $unset: {
      aiBuckets: 1,
      aiTags: 1,
      aiCVs: 1,
      aiEvidenceDocs: 1,
      aiIntroductions: 1,
      aiIntroductionHints: 1,
      aiPlaceholderSections: 1,
      aiMatrices: 1
    }
  });
  return result.modifiedCount ?? 0;
}

/** Build an empty review state for first writes. */
export { emptyState as buildEmptyReviewState };
