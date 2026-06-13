import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Grid3X3, FileText, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface RawSection { id: string; title?: string; content: string; standardCode?: string }

interface SpecMatrixModalProps {
  submissionId: string;
  focusStandard?: string;   // the spec's standard code (scroll to its section)
  focusSpecText?: string;   // the spec's title — scroll to its ROW within the matrix
  onClose: () => void;
}

/** lowercase alphanumerics + single spaces, for fuzzy row matching. */
function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The Curriculum Matrix, viewed IN PLACE on the Reader Report. The per-spec
 * "Matrix" button used to navigate to /self-study?view=curriculum — but a reader
 * has no access to that route and gets bounced to the dashboard, so the imported
 * matrices "disappeared". This read-only modal fetches the same matrix and shows
 * its imported sections without leaving the report.
 */
export function SpecMatrixModal({ submissionId, focusStandard, focusSpecText, onClose }: SpecMatrixModalProps): JSX.Element {
  const focusRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Fetch ALL matrices' sections (a submission can have more than one imported
  // matrix; the primary /matrix endpoint only returns the first).
  const { data, isLoading } = useQuery({
    queryKey: ['matrices-all', submissionId],
    queryFn: async () => (await api.get(`/api/submissions/${submissionId}/matrices`)).data,
  });
  const matrix = data;
  const sections: RawSection[] = data?.sections || [];
  // The clicked spec's standard first, so it's what the reader sees on open.
  const ordered = [...sections].sort((a, b) =>
    (b.standardCode === focusStandard ? 1 : 0) - (a.standardCode === focusStandard ? 1 : 0));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // After the matrix renders, jump to the SPECIFICATION's row (matched by its
  // text — the matrix has no per-spec anchors), falling back to the standard's
  // section. The matched cell is highlighted so the reader sees the right line.
  useEffect(() => {
    if (isLoading) return;
    const body = bodyRef.current;
    const key = norm(focusSpecText || '').split(' ').slice(0, 5).join(' ');
    if (body && key.length >= 8) {
      const cells = Array.from(body.querySelectorAll('td, th')) as HTMLElement[];
      const hit = cells.find((c) => norm(c.textContent || '').includes(key));
      if (hit) {
        const row = (hit.closest('tr') as HTMLElement) || hit;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.outline = '2px solid #2dd4bf';
        row.style.background = '#ccfbf1';
        return;
      }
    }
    if (focusRef.current) focusRef.current.scrollIntoView({ block: 'start' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, focusSpecText, matrix]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div data-testid="rr-matrix-modal" className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Grid3X3 className="h-5 w-5 text-teal-600" />
            Curriculum Matrix
            {sections.length > 0 && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{sections.length} imported section{sections.length !== 1 ? 's' : ''}</span>}
          </h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        {/* Index of EVERY imported matrix section, so it's obvious there's more
            than one and the reader can jump between them. */}
        {sections.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs">
            <span className="font-semibold text-slate-500">Matrices:</span>
            {ordered.map((s, i) => (
              <button
                key={s.id}
                data-testid={`rr-matrix-jump-${s.id}`}
                onClick={() => { const el = bodyRef.current?.querySelector(`#matrix-sec-${s.id}`) as HTMLElement | null; el?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 font-medium text-purple-700 hover:bg-purple-100"
              >
                {s.standardCode ? `Standard ${s.standardCode}` : `Matrix ${i + 1}`}
              </button>
            ))}
          </div>
        )}
        <div ref={bodyRef} className="overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : sections.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">No curriculum matrix was imported for this submission.</div>
          ) : (
            <div className="space-y-6">
              {ordered.map((s) => {
                const isFocus = !!focusStandard && s.standardCode === focusStandard;
                return (
                  <div key={s.id} id={`matrix-sec-${s.id}`} ref={isFocus ? focusRef : undefined} className={`scroll-mt-2 rounded-lg border ${isFocus ? 'border-teal-300 ring-2 ring-teal-200' : 'border-slate-200'} p-3`}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <FileText className="h-4 w-4 text-purple-500" />
                      {s.standardCode ? `Standard ${s.standardCode} — ` : ''}{s.title || 'Imported matrix'}
                    </div>
                    <div
                      className="prose prose-sm max-w-none overflow-x-auto
                        [&_table]:w-full [&_table]:table-auto [&_table]:border-collapse
                        [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm
                        [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:font-semibold
                        [&_tr]:even:bg-slate-50"
                      dangerouslySetInnerHTML={{ __html: s.content }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpecMatrixModal;
