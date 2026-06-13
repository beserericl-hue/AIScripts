import React, { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Grid3X3, FileText, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface RawSection { id: string; title?: string; content: string; standardCode?: string }

interface SpecMatrixModalProps {
  submissionId: string;
  focusStandard?: string; // the spec's standard code, scrolled into view + highlighted
  onClose: () => void;
}

/**
 * The Curriculum Matrix, viewed IN PLACE on the Reader Report. The per-spec
 * "Matrix" button used to navigate to /self-study?view=curriculum — but a reader
 * has no access to that route and gets bounced to the dashboard, so the imported
 * matrices "disappeared". This read-only modal fetches the same matrix and shows
 * its imported sections without leaving the report.
 */
export function SpecMatrixModal({ submissionId, focusStandard, onClose }: SpecMatrixModalProps): JSX.Element {
  const focusRef = useRef<HTMLDivElement>(null);
  const { data: matrix, isLoading } = useQuery({
    queryKey: ['matrix', submissionId],
    queryFn: async () => (await api.get(`/api/submissions/${submissionId}/matrix`)).data,
  });

  const sections: RawSection[] = matrix?.rawContent || [];
  // The clicked spec's standard first, so it's what the reader sees on open.
  const ordered = [...sections].sort((a, b) =>
    (b.standardCode === focusStandard ? 1 : 0) - (a.standardCode === focusStandard ? 1 : 0));

  useEffect(() => {
    if (focusRef.current) focusRef.current.scrollIntoView({ block: 'start' });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isLoading, onClose]);

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
        <div className="overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : sections.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">No curriculum matrix was imported for this submission.</div>
          ) : (
            <div className="space-y-6">
              {ordered.map((s) => {
                const isFocus = !!focusStandard && s.standardCode === focusStandard;
                return (
                  <div key={s.id} ref={isFocus ? focusRef : undefined} className={`rounded-lg border ${isFocus ? 'border-teal-300 ring-2 ring-teal-200' : 'border-slate-200'} p-3`}>
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
