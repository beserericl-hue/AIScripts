/**
 * Per-file placement report for a multi-file evidence upload. Shows every file
 * and where it was filed (Standard.spec), or that it is waiting in Unassigned,
 * was already uploaded, or was skipped — so a misfiled upload is visible at once
 * instead of disappearing silently.
 */
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
}

export function placementLabel(r: BulkUploadRow): { text: string; tone: 'ok' | 'warn' | 'muted' | 'bad' } {
  if (r.skippedSelfStudy) return { text: 'Your imported self-study document — not added as evidence', tone: 'muted' };
  if (r.error) return { text: `Not uploaded — ${r.error}`, tone: 'bad' };
  if (r.duplicateOf && r.alsoLinkedTo) return { text: `Same file already uploaded — also linked to Standard ${r.alsoLinkedTo.std}${r.alsoLinkedTo.spec ? '.' + r.alsoLinkedTo.spec : ''}`, tone: 'ok' };
  if (r.duplicateOf) return { text: r.placedStd ? `Already uploaded · Standard ${r.placedStd}${r.placedSpec ? '.' + r.placedSpec : ''}` : 'Already uploaded', tone: 'muted' };
  if (r.placedStd) return { text: `Filed under Standard ${r.placedStd}${r.placedSpec ? '.' + r.placedSpec : ''}`, tone: 'ok' };
  if (r.resolvedStd) return { text: `Suggested ${r.resolvedStd}${r.resolvedSpec ? '.' + r.resolvedSpec : ''} — confirm in Review`, tone: 'warn' };
  return { text: 'Unassigned — choose a Standard', tone: 'warn' };
}

export function BulkUploadResults({ rows, skipped = [] }: { rows: BulkUploadRow[]; skipped?: Array<{ fileName: string; reason: string }> }) {
  const all: BulkUploadRow[] = [...rows, ...skipped.map((s) => ({ fileName: s.fileName, error: s.reason }))];
  if (!all.length) return null;
  const filed = all.filter((r) => r.placedStd && !r.duplicateOf).length;
  const pending = all.filter((r) => !r.placedStd && !r.duplicateOf && !r.error && !r.skippedSelfStudy).length;
  const linked = all.filter((r) => r.duplicateOf && r.alsoLinkedTo).length;
  const failed = all.filter((r) => r.error && !r.skippedSelfStudy).length;
  const tone = { ok: 'text-emerald-700', warn: 'text-amber-700', muted: 'text-gray-500', bad: 'text-red-700' } as const;
  return (
    <div data-testid="bulk-upload-results" className="rounded-md border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-3 py-2 text-xs text-gray-600">
        <b>{filed}</b> filed · <b>{pending}</b> need a Standard{linked ? <> · <b>{linked}</b> linked copies</> : null}{failed ? <> · <b className="text-red-700">{failed}</b> not uploaded</> : null} · {all.length} total
      </div>
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
