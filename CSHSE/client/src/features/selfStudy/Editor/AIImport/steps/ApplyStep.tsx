/**
 * Step 5 — Apply (sub-sprint 1.a — calls the stubbed apply-ai endpoint).
 *
 * The server-side apply-ai is a no-op stub in 1.a (returns OK without
 * writing to Submission.narratives). Real Mongo session + S3 ordering
 * lands in sub-sprint 1.c per UI spec §19. The merge-mode UI is built
 * here so 1.c only has to flip the server-side behaviour.
 */
import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';
import { DiffModal, type DiffResolution } from '../apply/DiffModal';

export function ApplyStep(): JSX.Element {
  const buckets = useAIImportStore((s) => s.buckets);
  const tags = useAIImportStore((s) => s.tags);
  const placeholderSections = useAIImportStore((s) => s.placeholderSections);
  const mergeMode = useAIImportStore((s) => s.mergeMode);
  const setMergeMode = useAIImportStore((s) => s.setMergeMode);
  const status = useAIImportStore((s) => s.status);
  const appliedCounts = useAIImportStore((s) => s.appliedCounts);
  const applyError = useAIImportStore((s) => s.applyError);
  const apply = useAIImportStore((s) => s.apply);
  const setStep = useAIImportStore((s) => s.setStep);
  const submissionId = useAIImportStore((s) => s.submissionId);
  const perSpecResolution = useAIImportStore((s) => s.perSpecResolution);

  const [diffOpen, setDiffOpen] = useState(false);

  const touchedSpecs = useMemo(
    () =>
      Object.values(buckets)
        .filter(
          (b) =>
            b.narratives.length > 0 || b.evidenceText.length > 0 || b.evidenceFiles.length > 0
        )
        .map((b) => ({
          std: b.standardCode,
          spec: b.specCode,
          proposed:
            b.narratives.map((n) => n.snippet).join('\n---\n') ||
            b.evidenceText.map((e) => e.snippet).join('\n---\n') ||
            b.evidenceFiles.map((f) => f.heading).join(', ')
        })),
    [buckets]
  );

  const handleApply = async () => {
    if (mergeMode === 'per_spec') {
      setDiffOpen(true);
      return;
    }
    await apply();
  };

  const handleDiffConfirm = async () => {
    setDiffOpen(false);
    await apply();
  };

  const handleResolve = (key: string, choice: DiffResolution) => {
    useAIImportStore.setState({
      perSpecResolution: { ...perSpecResolution, [key]: choice }
    });
  };

  const totals = Object.values(buckets).reduce(
    (acc, b) => ({
      narratives: acc.narratives + b.narratives.length,
      evidenceText: acc.evidenceText + b.evidenceText.length,
      evidenceFiles: acc.evidenceFiles + b.evidenceFiles.length
    }),
    { narratives: 0, evidenceText: 0, evidenceFiles: 0 }
  );
  const isApplied = status === 'applied' || status === 'finished';
  const isApplying = status === 'applying';

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <h2 className="text-2xl font-semibold text-gray-900">
        {isApplied ? 'Imported' : 'Ready to apply'}
      </h2>

      <ul className="space-y-2 text-sm">
        <Row label="Narratives (text < 1000 words)" value={`${totals.narratives} items`} />
        <Row label="Supporting evidence text (≥ 1000 words)" value={`${totals.evidenceText} items`} />
        <Row label="Supporting evidence files" value={`${totals.evidenceFiles} files`} />
        <Row label="Tag list (deferred)" value={`${tags.length} items`} />
        <Row label="Unwritten template prompts" value={`${placeholderSections.length} sections`} />
      </ul>

      <fieldset className="space-y-2 border-t pt-4">
        <legend className="text-sm font-medium text-gray-700">Merge behaviour for narratives</legend>
        {(
          [
            { value: 'merge' as const, label: 'Merge (default for re-imports — keeps existing content)' },
            { value: 'replace' as const, label: 'Replace (overwrites existing — use sparingly)' },
            { value: 'per_spec' as const, label: 'Per-spec choice (opens diff modal)' }
          ]
        ).map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name="mergeMode"
              value={opt.value}
              checked={mergeMode === opt.value}
              onChange={() => setMergeMode(opt.value)}
              className="text-cshse-600 focus:ring-cshse-500"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </fieldset>

      {applyError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{applyError}</div>
        </div>
      )}

      {isApplied && appliedCounts && (
        <div className="rounded-md border border-cshse-200 bg-cshse-50 p-3 text-sm text-cshse-700">
          ✅ Imported {appliedCounts.narratives} narratives, {appliedCounts.evidenceText} evidence text,{' '}
          {appliedCounts.evidenceFiles} files. {appliedCounts.tags} items need review.
          {appliedCounts.placeholders !== undefined && ` ${appliedCounts.placeholders} unwritten prompts noted.`}
        </div>
      )}

      <div className="flex justify-between border-t pt-6">
        <button
          onClick={() => setStep('review')}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          ◂ Back
        </button>
        <button
          onClick={handleApply}
          disabled={isApplying || isApplied}
          className="rounded-md bg-cshse-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isApplying ? 'Applying…' : isApplied ? 'Applied ✓' : 'Apply & finish'}
        </button>
      </div>

      <DiffModal
        open={diffOpen}
        submissionId={submissionId}
        touchedSpecs={touchedSpecs}
        resolution={perSpecResolution as Record<string, DiffResolution>}
        onResolve={handleResolve}
        onClose={() => setDiffOpen(false)}
        onConfirm={handleDiffConfirm}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <li className="flex justify-between border-b border-gray-100 py-1 last:border-0">
      <span className="text-gray-700">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </li>
  );
}
