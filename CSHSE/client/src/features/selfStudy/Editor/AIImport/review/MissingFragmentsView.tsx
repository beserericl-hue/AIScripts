/**
 * CR-040 Phase 3b — Missing-from-import middle-pane view.
 *
 * Renders coverageReport.missingFragments as cards with Discard (marks
 * resolved as skip:coordinator-discarded) and Reassign-to-spec actions.
 * Apply is gated until every fragment is resolved (see ReviewStep's
 * applyBlockedByMissing check).
 *
 * Reassign-to-spec is implemented via the existing ReassignPopup hook
 * the parent passes in — same flow coordinators already use.
 */
import React, { useCallback, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useAIImportStore, type AIMissingFragment, type SpecBucket, type BucketItem } from '../../../../../store/aiImportStore';

interface MissingFragmentsViewProps {
  fragments: AIMissingFragment[];
  resolvedIds: Set<string>;
}

export function MissingFragmentsView({
  fragments,
  resolvedIds
}: MissingFragmentsViewProps): JSX.Element {
  const resolveMissingFragment = useAIImportStore((s) => s.resolveMissingFragment);
  const buckets = useAIImportStore((s) => s.buckets);
  const [reassignFor, setReassignFor] = useState<AIMissingFragment | null>(null);

  const unresolved = fragments.filter((f) => !resolvedIds.has(f.sectionId));
  const resolved = fragments.filter((f) => resolvedIds.has(f.sectionId));

  const handleDiscard = useCallback(
    (sectionId: string) => {
      resolveMissingFragment(sectionId);
    },
    [resolveMissingFragment]
  );

  const handleReassign = useCallback(
    (fragment: AIMissingFragment, std: string, spec: string) => {
      const key = `${std}.${spec}`;
      const targetBucket = buckets[key];
      if (!targetBucket) return;
      const item: BucketItem = {
        sectionId: fragment.sectionId,
        heading: fragment.heading || `Missing fragment ${fragment.sectionId}`,
        snippet: fragment.snippet,
        wordCount: fragment.wordCount,
        confidence: 1.0,
        acceptState: 'auto_accept',
        rationale:
          'Coordinator-rescued fragment from the coverage_verifier "Missing from import" list.'
      };
      const updated: SpecBucket = {
        ...targetBucket,
        narratives: [...targetBucket.narratives, item]
      };
      useAIImportStore.setState({
        buckets: { ...buckets, [key]: updated },
        dirty: true
      });
      resolveMissingFragment(fragment.sectionId);
      setReassignFor(null);
    },
    [buckets, resolveMissingFragment]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-red-200 bg-red-50 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-red-700" aria-hidden />
          <span className="font-semibold text-red-800">Missing from import</span>
          <span className="text-xs text-red-700">
            {unresolved.length} unresolved · {resolved.length} resolved
          </span>
        </div>
        <p className="mt-1 text-xs text-red-700">
          The coverage verifier flagged these sections as unaccounted for.
          Discard them (mark as intentionally skipped) or reassign them to
          a spec before Apply.
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {unresolved.map((fragment) => (
          <article
            key={fragment.sectionId}
            className="rounded-lg border border-red-300 bg-white p-3 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono text-gray-500">
                  {fragment.sectionId}
                </div>
                <div className="truncate text-sm font-semibold text-gray-900">
                  {fragment.heading || '(no heading)'}
                </div>
                <div className="text-xs text-gray-500">
                  {fragment.wordCount} words · {fragment.splitterTier} · {fragment.why}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setReassignFor(fragment)}
                  className="rounded border border-cshse-300 bg-white px-2 py-1 text-xs font-medium text-cshse-700 hover:bg-cshse-50"
                >
                  Reassign…
                </button>
                <button
                  onClick={() => handleDiscard(fragment.sectionId)}
                  className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Discard
                </button>
              </div>
            </div>
            {/* CR-044 typography parity — fragment body is content the
                PC reads to decide. prose-sm matches editor baseline. */}
            <div className="prose prose-sm max-w-none whitespace-pre-wrap rounded bg-gray-50 p-3 text-gray-800 max-h-32 overflow-y-auto">
              {fragment.snippet}
            </div>
          </article>
        ))}
        {resolved.length > 0 && (
          <details className="rounded border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
            <summary className="cursor-pointer font-medium">
              {resolved.length} resolved fragment{resolved.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-2 space-y-1">
              {resolved.map((f) => (
                <li key={f.sectionId} className="font-mono">
                  ✓ {f.sectionId} — {f.heading || '(no heading)'}
                </li>
              ))}
            </ul>
          </details>
        )}
        {unresolved.length === 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            ✓ All missing fragments resolved. Apply is unblocked.
          </div>
        )}
      </div>

      {reassignFor && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReassignFor(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">Reassign fragment to a spec</h3>
            <p className="mt-1 text-xs text-gray-500">
              {reassignFor.heading || '(no heading)'} · {reassignFor.wordCount} words
            </p>
            <div className="mt-3 max-h-72 overflow-y-auto rounded border border-gray-200">
              <ul className="divide-y divide-gray-100 text-sm">
                {Object.entries(buckets).map(([key, b]) => (
                  <li key={key}>
                    <button
                      onClick={() => handleReassign(reassignFor, b.standardCode, b.specCode)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-cshse-50"
                    >
                      <span className="font-mono text-xs">
                        {b.standardCode}.{b.specCode}
                      </span>
                      <span className="truncate text-xs text-gray-600">
                        {b.standardTitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setReassignFor(null)}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
