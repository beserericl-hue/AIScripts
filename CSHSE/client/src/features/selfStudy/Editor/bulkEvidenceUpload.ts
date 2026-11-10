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

export const BULK_BATCH_SIZE = 10;

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
    const form = new FormData();
    batch.forEach((e) => form.append('files', e.file));
    form.append('paths', JSON.stringify(batch.map((e) => e.path)));
    try {
      const resp = await api.post(`/api/submissions/${submissionId}/review/bulk-evidence`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000,
      });
      rows.push(...((resp.data?.added || []) as BulkUploadRow[]));
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
export async function suggestPlacementsForUnassigned(
  submissionId: string,
  onProgress?: (done: number, remaining: number) => void
): Promise<{ processed: number; placed: number; workingFiles: number; error?: string }> {
  let processed = 0, placed = 0, workingFiles = 0;
  try {
    for (let guard = 0; guard < 50; guard++) {
      const res = await api.post(`/api/submissions/${submissionId}/evidence/ai-place-unassigned`, {}, { timeout: 600_000 });
      const d = res.data || {};
      processed += d.processed || 0; placed += d.placed || 0; workingFiles += d.workingFiles || 0;
      onProgress?.(processed, d.remaining || 0);
      if (!d.remaining || !d.processed) break;
    }
    return { processed, placed, workingFiles };
  } catch (err: any) {
    return { processed, placed, workingFiles, error: err?.response?.data?.error || err?.message || 'AI placement failed' };
  }
}
