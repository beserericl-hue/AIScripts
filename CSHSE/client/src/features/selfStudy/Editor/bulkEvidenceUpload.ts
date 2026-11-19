/**
 * Folder-aware, batched supporting-evidence upload.
 *
 * Program coordinators deliver their evidence as a FOLDER TREE (e.g. ETSU:
 * "CSHSE EVIDENCE AND LINKS/Standard 13/…", 380+ files). Two things broke that:
 *   1. a dropped folder arrives as ONE zero-byte entry in dataTransfer.files —
 *      its contents must be walked via webkitGetAsEntry();
 *   2. the server takes at most 30 files per request — a bigger drop failed
 *      as a whole.
 * This module walks dropped folders (and webkitdirectory picks), keeps each
 * file's RELATIVE PATH (the server reads "Standard 13/" as a routing signal),
 * skips OS junk, and uploads in small sequential batches, merging the results.
 */
import { api } from '../../../services/api';
import type { BulkUploadRow } from './BulkUploadResults';

export interface EvidenceEntry {
  file: File;
  /** Relative path incl. folders, e.g. "Evidence/Standard 13/BG4BN2.pdf". */
  path: string;
}

/** OS / editor junk that is never evidence (.DS_Store, Word lock files, …). */
export function isJunkFile(name: string): boolean {
  const n = (name || '').split('/').pop() || '';
  return /^\./.test(n) || /^~\$/.test(n) || /^(thumbs\.db|desktop\.ini|icon\r?)$/i.test(n);
}

function readAllEntries(reader: any): Promise<any[]> {
  // readEntries returns at most ~100 entries per call — keep reading until empty.
  return new Promise((resolve) => {
    const out: any[] = [];
    const next = () =>
      reader.readEntries(
        (batch: any[]) => {
          if (!batch.length) return resolve(out);
          out.push(...batch);
          next();
        },
        () => resolve(out)
      );
    next();
  });
}

async function walkEntry(entry: any, prefix: string, out: EvidenceEntry[]): Promise<void> {
  if (!entry) return;
  if (entry.isFile) {
    const file: File | null = await new Promise((res) => entry.file((f: File) => res(f), () => res(null)));
    if (file) out.push({ file, path: prefix + file.name });
    return;
  }
  if (entry.isDirectory) {
    const children = await readAllEntries(entry.createReader());
    for (const c of children) await walkEntry(c, `${prefix}${entry.name}/`, out);
  }
}

/** Files (recursively, with relative paths) from a drop — folders included. */
export async function entriesFromDataTransfer(dt: DataTransfer | null): Promise<EvidenceEntry[]> {
  if (!dt) return [];
  const items = Array.from(dt.items || []);
  const roots = items
    .filter((it) => it.kind === 'file')
    .map((it) => (typeof (it as any).webkitGetAsEntry === 'function' ? (it as any).webkitGetAsEntry() : null));
  let out: EvidenceEntry[] = [];
  if (roots.length && roots.every(Boolean)) {
    for (const r of roots) await walkEntry(r, '', out);
  } else {
    out = Array.from(dt.files || []).map((f) => ({ file: f, path: (f as any).webkitRelativePath || f.name }));
  }
  return out.filter((e) => !isJunkFile(e.path));
}

/** Files from an <input type=file> (multi-file or webkitdirectory folder pick). */
export function entriesFromFileList(list: FileList | File[] | null | undefined): EvidenceEntry[] {
  return Array.from(list || [])
    .map((f) => ({ file: f, path: (f as any).webkitRelativePath || f.name }))
    .filter((e) => !isJunkFile(e.path));
}

export interface BulkUploadOutcome {
  rows: BulkUploadRow[];
  skipped: Array<{ fileName: string; reason: string }>;
  count: number;
  failedBatches: number;
}

// Small batches: production sits behind a proxy that cuts any request at 100s
// (HTTP 524), and one batch can hold several large PDFs.
export const BULK_BATCH_SIZE = 5;

/** The proxy gave up (524/504/502) or the network dropped — the server may
 *  still have stored the files, so the batch is re-sent once: the server's
 *  name+size duplicate check makes that safe. */
export function isRetryableUploadError(err: any): boolean {
  const st = err?.response?.status;
  return st === 524 || st === 504 || st === 502 || st === 503 || (!err?.response && !!err);
}

/**
 * Upload entries in sequential batches (server cap = 30/request; small batches
 * keep each request well under the proxy timeout). A failed batch never stops
 * the rest — its files are reported as "Not uploaded" with the reason.
 */
export async function uploadEvidenceInBatches(
  submissionId: string,
  entries: EvidenceEntry[],
  onProgress?: (done: number, total: number, rows: BulkUploadRow[]) => void
): Promise<BulkUploadOutcome> {
  const rows: BulkUploadRow[] = [];
  const skipped: Array<{ fileName: string; reason: string }> = [];
  let count = 0;
  let failedBatches = 0;
  for (let i = 0; i < entries.length; i += BULK_BATCH_SIZE) {
    const batch = entries.slice(i, i + BULK_BATCH_SIZE);
    const send = () => {
      const f = new FormData();
      batch.forEach((e) => f.append('files', e.file));
      f.append('paths', JSON.stringify(batch.map((e) => e.path)));
      return api.post(`/api/submissions/${submissionId}/review/bulk-evidence`, f, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000,
      });
    };
    try {
      let resp;
      let retried = false;
      try {
        resp = await send();
      } catch (first: any) {
        if (!isRetryableUploadError(first)) throw first;
        retried = true;
        resp = await send();
      }
      let added = (resp.data?.added || []) as BulkUploadRow[];
      if (retried) {
        // The first attempt timed out at the proxy but the server finished it:
        // the re-send reports those files as duplicates — they ARE uploaded.
        added = added.map((r) => (r.duplicateOf && !r.alsoLinkedTo
          ? { ...r, duplicateOf: undefined, note: 'Uploaded (confirmed after a slow first attempt)' }
          : r));
        count += added.filter((r) => !r.error).length - (resp.data?.count ?? 0);
      }
      rows.push(...added);
      skipped.push(...(resp.data?.skipped || []));
      count += resp.data?.count ?? 0;
    } catch (err: any) {
      failedBatches += 1;
      const srvSkipped = err?.response?.data?.skipped as Array<{ fileName: string; reason: string }> | undefined;
      if (srvSkipped?.length) skipped.push(...srvSkipped);
      const reason = err?.response?.data?.error || err?.message || 'upload failed';
      for (const e of batch) {
        if (!srvSkipped?.some((s) => s.fileName === e.file.name)) rows.push({ fileName: e.path, error: reason });
      }
    }
    onProgress?.(Math.min(i + BULK_BATCH_SIZE, entries.length), entries.length, rows);
  }
  return { rows, skipped, count, failedBatches };
}

/**
 * After an upload, let the AI suggest a specification for every file that is
 * still unassigned (server works 20 at a time; loop while some remain). The
 * suggestions are tentative — shown in the File Library with Accept.
 */
export interface AiPlacementResult {
  id: string;
  std?: string | null;
  spec?: string | null;
  confidence?: number;
  kind?: string;
  reason?: string;
  error?: string;
}

export async function suggestPlacementsForUnassigned(
  submissionId: string,
  onProgress?: (done: number, remaining: number) => void
): Promise<{ processed: number; placed: number; workingFiles: number; results: AiPlacementResult[]; error?: string }> {
  let processed = 0, placed = 0, workingFiles = 0;
  const results: AiPlacementResult[] = [];
  try {
    for (let guard = 0; guard < 50; guard++) {
      const res = await api.post(`/api/submissions/${submissionId}/evidence/ai-place-unassigned`, {}, { timeout: 600_000 });
      const d = res.data || {};
      processed += d.processed || 0; placed += d.placed || 0; workingFiles += d.workingFiles || 0;
      if (Array.isArray(d.results)) results.push(...d.results);
      onProgress?.(processed, d.remaining || 0);
      if (!d.remaining || !d.processed) break;
    }
    return { processed, placed, workingFiles, results };
  } catch (err: any) {
    return { processed, placed, workingFiles, results, error: err?.response?.data?.error || err?.message || 'AI placement failed' };
  }
}

/**
 * Fold the AI pass back into the per-file upload list. Without this the list
 * kept saying "Unassigned — choose a Standard" for every file even after the
 * AI had read them and suggested a specification (Kennesaw, 2026-11-19).
 */
export function applyAiSuggestions(rows: BulkUploadRow[], results: AiPlacementResult[]): BulkUploadRow[] {
  const byId = new Map(results.filter((r) => r && r.id && !r.error).map((r) => [String(r.id), r]));
  return rows.map((row) => {
    if (row.placedStd || row.duplicateOf || row.error || row.skippedSelfStudy || !row.fileId) return row;
    const r = byId.get(String(row.fileId));
    if (!r) return row;
    if (r.kind === 'working_file') {
      return { ...row, workingFile: true, aiSuggested: false, aiSuggestionRationale: r.reason ? `AI: ${r.reason}` : row.aiSuggestionRationale };
    }
    if (!r.std) return row;
    const pct = typeof r.confidence === 'number' ? ` (${Math.round(r.confidence * 100)}% sure)` : '';
    return {
      ...row,
      resolvedStd: String(r.std),
      resolvedSpec: r.spec ? String(r.spec) : undefined,
      aiSuggested: true,
      aiSuggestionRationale: r.reason ? `AI${pct}: ${r.reason}` : row.aiSuggestionRationale,
    };
  });
}

/** Rows whose AI suggestion is still waiting to be accepted. */
export function suggestedRows(rows: BulkUploadRow[]): BulkUploadRow[] {
  return rows.filter((r) => r.aiSuggested && !r.placedStd && r.fileId && r.resolvedStd);
}

/**
 * File every listed AI suggestion (the coordinator clicked "File all … as
 * suggested"). Returns the rows with those files marked as filed.
 */
export async function acceptAiSuggestions(submissionId: string, rows: BulkUploadRow[]): Promise<BulkUploadRow[]> {
  const ids = suggestedRows(rows).map((r) => String(r.fileId));
  if (!ids.length) return rows;
  await api.post(`/api/submissions/${submissionId}/evidence/accept-ai-placements`, { evidenceIds: ids });
  const done = new Set(ids);
  return rows.map((r) => (r.fileId && done.has(String(r.fileId))
    ? { ...r, placedStd: r.resolvedStd, placedSpec: r.resolvedSpec || null, aiSuggested: false, acceptedAi: true }
    : r));
}


/**
 * Re-read (with OCR) every library file that still has no text — screenshots,
 * scanned PDFs, extractions that timed out during the upload. The server works
 * ~60s per call; loop while some remain. Runs BEFORE the AI placement pass so
 * the AI can read those files too.
 */
export async function fillMissingText(
  submissionId: string,
  onProgress?: (filled: number, remaining: number) => void
): Promise<{ filled: number; error?: string }> {
  let filled = 0;
  try {
    for (let guard = 0; guard < 100; guard++) {
      const res = await api.post(`/api/submissions/${submissionId}/evidence/fill-missing-text`, {}, { timeout: 300_000 });
      const d = res.data || {};
      filled += d.filled || 0;
      onProgress?.(filled, d.remaining || 0);
      if (!d.remaining || !d.processed) break;
    }
    return { filled };
  } catch (err: any) {
    return { filled, error: err?.response?.data?.error || err?.message || 'text pass failed' };
  }
}
