/**
 * CR-033 Phase 2c part 2 — Standalone-CV Review.
 *
 * Rendered by ReviewStep when the wizard detects that the coordinator
 * dropped one or more CV.docx files alone (no Standards/Specs body).
 * The three-column workspace is overkill in that case — coordinators
 * need to confirm the faculty name + pick a spec, then Apply. End-to-end
 * in well under a minute.
 *
 * Apply path is unchanged — store.cvs feeds the same aiCVs persistence
 * we already had from CR-033 Phase 2.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Rocket, Loader2, User } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';
import { api } from '../../../../../services/api';

type SpecOption = {
  std: string;
  specsForStd: Array<{ spec: string; title: string }>;
  title: string;
};

export function StandaloneCVReview(): JSX.Element {
  const cvs = useAIImportStore((s) => s.cvs);
  const updateCvFacultyName = useAIImportStore((s) => s.updateCvFacultyName);
  const updateCvRouting = useAIImportStore((s) => s.updateCvRouting);
  const apply = useAIImportStore((s) => s.apply);
  const status = useAIImportStore((s) => s.status);
  const setStep = useAIImportStore((s) => s.setStep);

  const [standards, setStandards] = useState<SpecOption[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // The standards catalog is the same shape the editor uses (one fetch
  // per session). The standalone-CV path doesn't have buckets to derive
  // a dropdown from, so we pull the master list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/standards');
        if (cancelled) return;
        const parsed: SpecOption[] = (res.data || []).map((s: any) => ({
          std: s.code,
          title: s.title,
          specsForStd: (s.specifications || []).map((spec: any) => ({
            spec: spec.code,
            title: spec.title || ''
          }))
        }));
        setStandards(parsed);
      } catch (err: any) {
        if (!cancelled) {
          setLoadErr(err?.message || 'failed to load standards');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isApplying = status === 'applying';
  const isApplied = status === 'applied' || status === 'finished';
  const allRouted = useMemo(
    () => cvs.length > 0 && cvs.every((c) => c.resolvedStd && c.resolvedSpec),
    [cvs]
  );

  const handleApply = useCallback(async () => {
    await apply();
    setStep('apply');
  }, [apply, setStep]);

  if (cvs.length === 0) {
    return (
      <div className="p-8 text-sm text-gray-600">
        We expected at least one CV but none were detected. Use <button
          onClick={() => setStep('upload')}
          className="text-cshse-700 underline"
        >
          Start Over
        </button> to re-upload.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Standalone CV{cvs.length === 1 ? '' : 's'} detected
          </h2>
          <p className="text-xs text-gray-500">
            {cvs.length} faculty CV{cvs.length === 1 ? '' : 's'} found. Confirm
            the faculty name and pick a spec for each, then Apply.
          </p>
        </div>
        <button
          onClick={handleApply}
          disabled={!allRouted || isApplying || isApplied}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          title={
            !allRouted
              ? 'Every CV needs a (standard, spec) selection'
              : 'Write the CV(s) as supporting evidence files'
          }
        >
          {isApplying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Applying…
            </>
          ) : isApplied ? (
            <>✓ Applied</>
          ) : (
            <>
              <Rocket className="h-4 w-4" aria-hidden /> Apply
            </>
          )}
        </button>
      </div>

      {loadErr && (
        <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
          Couldn{"'"}t load the standards catalog ({loadErr}). The dropdown is
          empty; pick will be unavailable until the page is reloaded.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {cvs.map((cv) => {
            const stdEntry = standards.find((s) => s.std === cv.resolvedStd);
            const specOptions = stdEntry?.specsForStd ?? [];
            return (
              <div
                key={cv.sectionId}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-full bg-cshse-100 p-2">
                    <User className="h-5 w-5 text-cshse-700" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500">
                      Faculty name
                    </label>
                    <input
                      type="text"
                      value={cv.facultyName}
                      onChange={(e) =>
                        updateCvFacultyName(cv.sectionId, e.target.value)
                      }
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-base font-semibold focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">
                      Standard
                    </label>
                    <select
                      value={cv.resolvedStd ?? ''}
                      onChange={(e) => {
                        const std = e.target.value;
                        // Reset spec when standard changes — the spec letters
                        // belong to a specific standard.
                        const firstSpec = standards.find((s) => s.std === std)
                          ?.specsForStd[0]?.spec;
                        updateCvRouting(cv.sectionId, std, firstSpec ?? '');
                      }}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
                    >
                      <option value="">— pick a standard —</option>
                      {standards.map((s) => (
                        <option key={s.std} value={s.std}>
                          {s.std} — {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">
                      Spec
                    </label>
                    <select
                      value={cv.resolvedSpec ?? ''}
                      onChange={(e) =>
                        updateCvRouting(
                          cv.sectionId,
                          cv.resolvedStd ?? '',
                          e.target.value
                        )
                      }
                      disabled={!cv.resolvedStd || specOptions.length === 0}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500 disabled:bg-gray-100"
                    >
                      <option value="">— pick a spec —</option>
                      {specOptions.map((opt) => (
                        <option key={opt.spec} value={opt.spec}>
                          {cv.resolvedStd}.{opt.spec}
                          {opt.title ? ` — ${opt.title}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {cv.routing?.source && cv.routing.source !== 'matcher' && (
                  <div className="mt-3 text-[11px] italic text-gray-500">
                    Auto-routed via {cv.routing.source}
                    {cv.routing.matrixRowAnchor
                      ? ` (${cv.routing.matrixRowAnchor})`
                      : ''}
                    . Override above if needed.
                  </div>
                )}

                {cv.snippet && (
                  <details className="mt-3 text-sm text-gray-600">
                    <summary className="cursor-pointer text-cshse-700">
                      Preview CV content
                    </summary>
                    {/* CR-044 typography parity — CV body is content the
                        PC reads to decide. prose-sm matches editor. */}
                    <div className="prose prose-sm mt-2 max-h-72 max-w-none overflow-y-auto whitespace-pre-wrap rounded border border-gray-100 bg-gray-50 p-3 text-gray-800">
                      {cv.snippet.slice(0, 1500)}
                      {cv.snippet.length > 1500 ? '\n…' : ''}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
