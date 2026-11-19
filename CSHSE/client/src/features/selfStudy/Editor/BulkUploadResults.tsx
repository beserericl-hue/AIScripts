/**
 * Per-file placement report for a multi-file evidence upload. Shows every file
 * and where it was filed (Standard.spec), or that it is waiting in Unassigned,
 * was already uploaded, or was skipped — so a misfiled upload is visible at once
 * instead of disappearing silently.
 */
import { useState } from 'react';

export interface BulkUploadRow {
  fileName: string;
  placedStd?: string | null;
  placedSpec?: string | null;
  resolvedStd?: string;
  resolvedSpec?: string;
  aiSuggestionRationale?: string;
  duplicateOf?: string;
  note?: string;
  error?: string;
  link?: string;
  /** Folder path the file came from ("Evidence/Standard 13/x.pdf"). */
  sourcePath?: string;
  /** A same-file copy in another standard's folder was linked there too. */
  alsoLinkedTo?: { std: string; spec?: string | null } | null;
  /** The self-study document itself (already imported) — intentionally not filed. */
  skippedSelfStudy?: boolean;
  /** Library record id (SupportingEvidence). */
  fileId?: string;
  /** The AI read the file and suggested resolvedStd/resolvedSpec — not filed yet. */
  aiSuggested?: boolean;
  /** The AI thinks this is internal working material, not evidence. */
  workingFile?: boolean;
  /** Filed by accepting the AI suggestion. */
  acceptedAi?: boolean;
}

export function placementLabel(r: BulkUploadRow): { text: string; tone: 'ok' | 'warn' | 'muted' | 'bad' } {
  if (r.skippedSelfStudy) return { text: 'Your imported self-study document — not added as evidence', tone: 'muted' };
  if (r.error) return { text: `Not uploaded — ${r.error}`, tone: 'bad' };
  if (r.duplicateOf && r.alsoLinkedTo) return { text: `Same file already uploaded — also linked to Standard ${r.alsoLinkedTo.std}${r.alsoLinkedTo.spec ? '.' + r.alsoLinkedTo.spec : ''}`, tone: 'ok' };
  if (r.duplicateOf) return { text: r.placedStd ? `Already uploaded · Standard ${r.placedStd}${r.placedSpec ? '.' + r.placedSpec : ''}` : 'Already uploaded', tone: 'muted' };
  if (r.placedStd) return { text: `Filed under Standard ${r.placedStd}${r.placedSpec ? '.' + r.placedSpec : ''}${r.acceptedAi ? ' (AI suggestion accepted)' : ''}`, tone: 'ok' };
  if (r.aiSuggested && r.resolvedStd) return { text: `AI suggests Standard ${r.resolvedStd}${r.resolvedSpec ? '.' + r.resolvedSpec : ''} — not filed yet`, tone: 'warn' };
  if (r.workingFile) return { text: 'AI: looks like working material, not evidence — choose a Standard in the File Library if it is evidence', tone: 'muted' };
  if (r.resolvedStd) return { text: `Suggested ${r.resolvedStd}${r.resolvedSpec ? '.' + r.resolvedSpec : ''} — confirm in Review`, tone: 'warn' };
  return { text: 'Unassigned — choose a Standard', tone: 'warn' };
}

export function BulkUploadResults({ rows, skipped = [], onAcceptSuggestions }: {
  rows: BulkUploadRow[];
  skipped?: Array<{ fileName: string; reason: string }>;
  /** Files every AI-suggested row; shown when some suggestions are waiting. */
  onAcceptSuggestions?: () => Promise<void> | void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState('');
  const all: BulkUploadRow[] = [...rows, ...skipped.map((s) => ({ fileName: s.fileName, error: s.reason }))];
  if (!all.length) return null;
  const filed = all.filter((r) => r.placedStd && !r.duplicateOf).length;
  const suggested = all.filter((r) => !r.placedStd && r.aiSuggested && r.resolvedStd && !r.duplicateOf && !r.error).length;
  const pending = all.filter((r) => !r.placedStd && !(r.aiSuggested && r.resolvedStd) && !r.duplicateOf && !r.error && !r.skippedSelfStudy).length;
  const linked = all.filter((r) => r.duplicateOf && r.alsoLinkedTo).length;
  const failed = all.filter((r) => r.error && !r.skippedSelfStudy).length;
  const tone = { ok: 'text-emerald-700', warn: 'text-amber-700', muted: 'text-gray-500', bad: 'text-red-700' } as const;
  return (
    <div data-testid="bulk-upload-results" className="rounded-md border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-600" data-testid="bulk-upload-summary">
        <b>{filed}</b> filed{suggested ? <> · <b className="text-amber-700">{suggested}</b> suggested by the AI</> : null} · <b>{pending}</b> need a Standard{linked ? <> · <b>{linked}</b> linked copies</> : null}{failed ? <> · <b className="text-red-700">{failed}</b> not uploaded</> : null} · {all.length} total
      </div>
      {suggested > 0 && onAcceptSuggestions && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>The AI read {suggested === 1 ? 'this file' : `these ${suggested} files`} and suggested where {suggested === 1 ? 'it belongs' : 'each belongs'}. Check the list, then:</span>
          <button
            type="button"
            data-testid="bulk-upload-accept-ai"
            disabled={accepting}
            onClick={async () => {
              setAccepting(true);
              setAcceptError('');
              try { await onAcceptSuggestions(); } catch (e: any) { setAcceptError(e?.response?.data?.error || e?.message || 'Could not file them'); }
              finally { setAccepting(false); }
            }}
            className="rounded bg-teal-600 px-2 py-1 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {accepting ? 'Filing…' : `File ${suggested === 1 ? 'it' : `all ${suggested}`} as suggested`}
          </button>
          <span className="text-amber-800">(you can move any file later in the Supporting File Library)</span>
          {acceptError && <span className="text-red-700">{acceptError}</span>}
        </div>
      )}
      <ul className="max-h-72 divide-y divide-gray-100 overflow-auto">
        {all.map((r, i) => {
          const p = placementLabel(r);
          return (
            <li key={i} data-testid={`bulk-upload-row-${i}`} className="px-3 py-2 text-xs">
              <div className="truncate font-medium text-gray-800" title={r.sourcePath || r.fileName}>{r.fileName}</div>
              {r.sourcePath && r.sourcePath !== r.fileName && (
                <div className="truncate text-[11px] text-gray-400" title={r.sourcePath}>{r.sourcePath}</div>
              )}
              <div className={tone[p.tone]} data-testid={`bulk-upload-placement-${i}`}>{p.text}</div>
              {r.aiSuggestionRationale && !r.duplicateOf && !r.error && (
                <div className="text-[11px] text-gray-400">{r.aiSuggestionRationale}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
