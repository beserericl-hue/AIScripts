/**
 * DiffModal — per-spec keep/take/merge resolution (UI spec §6.5).
 *
 * Opens when the Coordinator picks "Per-spec choice" mode at Apply.
 * Lists every (std, spec) the wizard would touch with a current vs.
 * proposed preview and a radio for the resolution. The chosen mode
 * flows into the apply-ai payload's `perSpecResolution` field.
 *
 * Existing content for the diff is fetched lazily from the Submission
 * via /api/submissions/:id/narratives so the modal can show a real
 * before/after instead of a placeholder. Falls back gracefully if the
 * fetch fails (server might be slow; user can still pick a mode).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../../../../../services/api';

export type DiffResolution = 'keep' | 'take' | 'merge';

interface TouchedSpec {
  std: string;
  spec: string;
  proposed: string;
}

interface DiffModalProps {
  open: boolean;
  submissionId: string | null;
  touchedSpecs: TouchedSpec[];
  resolution: Record<string, DiffResolution>;
  onResolve: (key: string, choice: DiffResolution) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function DiffModal({
  open,
  submissionId,
  touchedSpecs,
  resolution,
  onResolve,
  onClose,
  onConfirm
}: DiffModalProps): JSX.Element | null {
  const [existing, setExisting] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !submissionId) return;
    setLoading(true);
    api
      .get(`/api/submissions/${submissionId}`)
      .then((res) => {
        const narr = res.data?.submission?.narratives || res.data?.narratives;
        if (!narr) return;
        const flat: Record<string, string> = {};
        for (const [std, specs] of Object.entries(narr as Record<string, any>)) {
          for (const [spec, val] of Object.entries(specs as Record<string, any>)) {
            flat[`${std}.${spec}`] = (val && (val as any).content) || '';
          }
        }
        setExisting(flat);
      })
      .catch(() => {
        // Non-fatal — modal still works with empty existing content.
      })
      .finally(() => setLoading(false));
  }, [open, submissionId]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const sorted = useMemo(
    () =>
      [...touchedSpecs].sort((a, b) => {
        const stdCmp = (parseInt(a.std, 10) || 99) - (parseInt(b.std, 10) || 99);
        return stdCmp !== 0 ? stdCmp : a.spec.localeCompare(b.spec);
      }),
    [touchedSpecs]
  );

  const allChosen = sorted.every((t) => resolution[`${t.std}.${t.spec}`]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id="diff-title" className="text-base font-semibold text-gray-900">
            Resolve per-spec merge ({sorted.length} {sorted.length === 1 ? 'spec' : 'specs'})
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Loading existing narratives…
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <ul className="space-y-4">
              {sorted.map((t) => {
                const key = `${t.std}.${t.spec}`;
                const before = existing[key] || '';
                const choice = resolution[key];
                return (
                  <li key={key} className="rounded border border-gray-200">
                    <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800">
                      {t.std}.{t.spec}
                    </div>
                    <div className="grid grid-cols-2 gap-3 p-3 text-xs">
                      <div>
                        <div className="mb-1 font-semibold text-gray-600">Existing</div>
                        <div className="max-h-40 overflow-auto rounded bg-gray-50 p-2 font-mono text-gray-800">
                          {before ? before.slice(0, 800) : <em className="text-gray-400">(none)</em>}
                          {before.length > 800 && '…'}
                        </div>
                      </div>
                      <div>
                        <div className="mb-1 font-semibold text-gray-600">Proposed</div>
                        <div className="max-h-40 overflow-auto rounded bg-cshse-50 p-2 font-mono text-gray-800">
                          {t.proposed.slice(0, 800)}
                          {t.proposed.length > 800 && '…'}
                        </div>
                      </div>
                    </div>
                    <div
                      role="radiogroup"
                      aria-label={`Resolution for ${key}`}
                      className="flex gap-4 border-t border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                    >
                      {(['keep', 'take', 'merge'] as const).map((opt) => (
                        <label key={opt} className="flex cursor-pointer items-center gap-1.5">
                          <input
                            type="radio"
                            name={`resolution-${key}`}
                            value={opt}
                            checked={choice === opt}
                            onChange={() => onResolve(key, opt)}
                            className="text-cshse-600 focus:ring-cshse-500"
                          />
                          <span className="capitalize">
                            {opt === 'keep' ? 'Keep mine' : opt === 'take' ? 'Take new' : 'Merge both'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
          <button
            onClick={onClose}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!allChosen}
            className="rounded bg-cshse-600 px-3 py-1.5 text-sm text-white hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            Confirm & apply
          </button>
        </div>
      </div>
    </div>
  );
}
