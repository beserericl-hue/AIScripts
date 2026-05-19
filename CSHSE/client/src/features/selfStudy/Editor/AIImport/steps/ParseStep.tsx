/**
 * Step 2 — Parse (sub-sprint 1.a functional stub).
 *
 * Shows two states (UI spec §6.2):
 *  - Queued: "Your import is Nth in line… Estimated start: ~M minutes"
 *  - Running: format-detection verdict + live pipeline strip
 *
 * Subscribes to the SSE stream via the store's `openEventStream` (called
 * from `startUpload`). On unmount or terminal status, the stream is
 * closed via `closeEventStream`. Falls back to polling automatically
 * after 3 SSE reconnect failures (handled in the store).
 */
import React, { useEffect } from 'react';
import { CheckCircle2, Circle, Loader2, X, AlertTriangle } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';

function fmtMinutes(seconds: number | null): string {
  if (!seconds || seconds < 60) return seconds ? `${seconds}s` : '—';
  const min = Math.round(seconds / 60);
  return `~${min} min`;
}

export function ParseStep(): JSX.Element {
  const status = useAIImportStore((s) => s.status);
  const queuePosition = useAIImportStore((s) => s.queuePosition);
  const queueDepth = useAIImportStore((s) => s.queueDepth);
  const etaSeconds = useAIImportStore((s) => s.etaSeconds);
  const format = useAIImportStore((s) => s.format);
  const stages = useAIImportStore((s) => s.pipelineStages);
  const errors = useAIImportStore((s) => s.errors);
  const eventsTransport = useAIImportStore((s) => s.eventsTransport);
  const setStep = useAIImportStore((s) => s.setStep);
  const cancelImport = useAIImportStore((s) => s.cancelImport);
  const closeEventStream = useAIImportStore((s) => s.closeEventStream);
  const openEventStream = useAIImportStore((s) => s.openEventStream);

  // Re-open the stream on mount if we landed here via deep-link or
  // tab-reopen and the import is still active.
  useEffect(() => {
    if (status === 'queued' || status === 'parsing') {
      openEventStream();
    }
    return () => {
      // Close on unmount — tab navigation away should not keep the EventSource alive.
      closeEventStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isQueued = status === 'queued';
  const isParsing = status === 'parsing';
  const isReady = status === 'parsed';
  const isFailed = status === 'failed';
  const isCanceled = status === 'canceled';

  // When the import has failed or been cancelled, render a terminal-error
  // surface instead of the optimistic "Waiting for a worker…" UI so the
  // coordinator sees what went wrong immediately and can take action.
  if (isFailed || isCanceled) {
    const failedStage = stages.find((s) => s.state === 'failed') || stages[stages.length - 1];
    return (
      <div className="max-w-3xl space-y-6 p-8">
        <h2 className="text-2xl font-semibold text-red-700">
          {isFailed ? 'Import failed' : 'Import canceled'}
        </h2>
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600" />
            <div className="space-y-2 text-sm text-red-700">
              {errors.length > 0 ? (
                errors.map((e, i) => <div key={i} className="font-mono text-xs">{e}</div>)
              ) : (
                <div>The import did not complete. See pipeline stages below.</div>
              )}
              {failedStage && (
                <div className="text-xs text-red-600">
                  Last stage: <span className="font-medium">{failedStage.name}</span>
                  {failedStage.detail && <> — {failedStage.detail}</>}
                </div>
              )}
            </div>
          </div>
        </div>

        {stages.length > 0 && (
          <section aria-live="polite">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Pipeline (last state)</h3>
            <ul className="space-y-2 text-sm">
              {stages.map((stage, idx) => {
                const Icon =
                  stage.state === 'done' ? CheckCircle2 :
                  stage.state === 'running' ? Loader2 :
                  stage.state === 'failed' ? X : Circle;
                const colour =
                  stage.state === 'done' ? 'text-cshse-600' :
                  stage.state === 'running' ? 'text-cshse-500' :
                  stage.state === 'failed' ? 'text-red-600' : 'text-gray-400';
                return (
                  <li key={`${stage.name}-${idx}`} className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${colour}`} aria-hidden />
                    <span className="font-medium text-gray-700">{stage.name}</span>
                    <span className="text-gray-500">{stage.detail || ''}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="flex justify-between border-t pt-6">
          <button
            onClick={() => setStep('upload')}
            className="rounded-md bg-cshse-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cshse-700"
          >
            ◂ Start over
          </button>
          <button
            onClick={cancelImport}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 p-8">
      <h2 className="text-2xl font-semibold text-gray-900">
        {isQueued ? 'Waiting for a worker…' : isParsing ? 'Parsing your document…' : isReady ? 'Parsing complete' : 'Parsing…'}
      </h2>

      {isQueued && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-medium text-amber-800">
            Your import is {ordinal(queuePosition ?? 1)} in line
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{
                width: `${
                  queueDepth ? Math.max(5, (1 - (queuePosition ?? 1) / queueDepth) * 100) : 5
                }%`
              }}
            />
          </div>
          <div className="mt-2 text-xs text-amber-700">
            Estimated start: {fmtMinutes(etaSeconds)}. You can leave this tab open or come back later.
          </div>
        </div>
      )}

      {format && (
        <div className="rounded-md border border-cshse-200 bg-cshse-50 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-cshse-700">
            <span>🧭 Format detection</span>
            <span className="rounded bg-cshse-100 px-2 py-0.5 text-xs">
              {format.format} · conf {format.confidence.toFixed(2)}
            </span>
          </div>
          <div className="mt-1 text-xs text-cshse-700">{format.reasoning}</div>
        </div>
      )}

      <section aria-live="polite">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Pipeline</h3>
        <ul className="space-y-2 text-sm">
          {stages.length === 0 && isQueued && (
            <li className="text-gray-500">Pipeline will start when a worker is free.</li>
          )}
          {stages.length === 0 && !isQueued && (
            <li className="text-gray-500">Connecting to the AI service…</li>
          )}
          {stages.map((stage, idx) => {
            const Icon =
              stage.state === 'done'
                ? CheckCircle2
                : stage.state === 'running'
                ? Loader2
                : stage.state === 'failed'
                ? X
                : Circle;
            const colour =
              stage.state === 'done'
                ? 'text-cshse-600'
                : stage.state === 'running'
                ? 'text-cshse-500 animate-spin'
                : stage.state === 'failed'
                ? 'text-red-600'
                : 'text-gray-400';
            return (
              <li key={`${stage.name}-${idx}`} className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${colour}`} aria-hidden />
                <span className="font-medium text-gray-700">{stage.name}</span>
                <span className="text-gray-500">{stage.detail || ''}</span>
                {stage.etaSeconds != null && <span className="ml-auto text-xs text-gray-400">~{stage.etaSeconds}s</span>}
              </li>
            );
          })}
        </ul>
      </section>

      {eventsTransport === 'polling' && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
          Live updates unavailable — refreshing every 2 seconds.
        </div>
      )}

      {errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{errors[errors.length - 1]}</div>
        </div>
      )}

      <div className="flex justify-between border-t pt-6">
        <button
          onClick={cancelImport}
          disabled={!isQueued && !isParsing}
          className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400"
        >
          Cancel
        </button>
        <button
          onClick={() => setStep('review')}
          disabled={!isReady}
          className="rounded-md bg-cshse-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Next ▸
        </button>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
