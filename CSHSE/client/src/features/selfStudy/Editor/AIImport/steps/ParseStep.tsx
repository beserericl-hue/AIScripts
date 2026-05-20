/**
 * Step 2 — Parse (UX revamp 2026-05-18).
 *
 * Smoke-test feedback was that the prior pipeline strip looked hung — the
 * matcher and gap_fill stages emit a "running, N/M" status that the
 * server's webhook only flushed at start/done milestones, leaving long
 * gaps between visible UI updates. This revamp fixes that by:
 *
 *  - **Always-on polling.** Even when the SSE stream is connected, we
 *    poll `/ai-status` every 3 s while in queued / parsing. SSE is the
 *    primary low-latency channel; polling is a guarantee that the user
 *    always sees fresh state within 3 s.
 *  - **Per-stage progress bars.** We parse "N / M" out of the stage's
 *    `detail` string and render a filled bar — so the matcher's
 *    "150 / 563" looks like ~27 % filled, ticking forward visibly.
 *  - **Elapsed timer + stall hint.** Big elapsed clock at the top.
 *    If no field on the import doc updates for > 30 s we surface a
 *    yellow "Still working — last update Ns ago" banner so the user
 *    knows the system is alive even when an individual stage is silent.
 *  - **Terminal-error surface.** Status === 'failed' / 'canceled'
 *    renders a red panel with the error message and a "Start over"
 *    action; never the optimistic "Waiting for a worker…" view.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2, X, AlertTriangle, Clock } from 'lucide-react';
import { useAIImportStore } from '../../../../../store/aiImportStore';

const POLL_INTERVAL_MS = 3000;
const STALL_AFTER_MS = 30000;

function fmtMinutes(seconds: number | null): string {
  if (!seconds || seconds < 60) return seconds ? `${seconds}s` : '—';
  const min = Math.round(seconds / 60);
  return `~${min} min`;
}

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ordinal(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
}

// Parse "150 / 563" or "150 of 563" out of a stage's detail string.
function parseStageProgress(detail: string | undefined): { current: number; total: number } | null {
  if (!detail) return null;
  const m = detail.match(/(\d+)\s*(?:\/|of)\s*(\d+)/);
  if (!m) return null;
  const current = parseInt(m[1], 10);
  const total = parseInt(m[2], 10);
  if (!total || total < current) return null;
  return { current, total };
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
  const startOver = useAIImportStore((s) => s.startOver);
  const cancelImport = useAIImportStore((s) => s.cancelImport);
  const closeEventStream = useAIImportStore((s) => s.closeEventStream);
  const openEventStream = useAIImportStore((s) => s.openEventStream);
  const pollAIStatus = useAIImportStore((s) => s.pollAIStatus);

  // Elapsed clock — ticks every second while the page is open.
  const [elapsedSec, setElapsedSec] = useState(0);
  // When did we last see a change in any tracked field? Drives the stall hint.
  const [lastChangeAt, setLastChangeAt] = useState<number>(Date.now());
  const [stalled, setStalled] = useState(false);

  const isQueued = status === 'queued';
  const isParsing = status === 'parsing';
  const isReady = status === 'parsed';
  const isFailed = status === 'failed';
  const isCanceled = status === 'canceled';
  const isActive = isQueued || isParsing;

  // Re-open SSE on mount if active; close on unmount.
  useEffect(() => {
    if (isActive) openEventStream();
    return () => {
      closeEventStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Belt-and-braces polling: even when SSE is healthy we hit /ai-status
  // every POLL_INTERVAL_MS so the user is guaranteed a refresh within
  // that window. SSE just makes most updates faster than that.
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => {
      pollAIStatus().catch(() => {
        // Errors are surfaced through the store's errors[] array; no-op here.
      });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isActive, pollAIStatus]);

  // Tick the elapsed clock every second.
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isActive]);

  // Track when anything changes — used to detect stalls.
  const stageSignature = useMemo(
    () => stages.map((s) => `${s.name}:${s.state}:${s.detail || ''}`).join('|'),
    [stages]
  );
  useEffect(() => {
    setLastChangeAt(Date.now());
    setStalled(false);
  }, [stageSignature, status, queuePosition, etaSeconds, format?.format]);

  // Watch for stalls (no updates in STALL_AFTER_MS).
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => {
      setStalled(Date.now() - lastChangeAt > STALL_AFTER_MS);
    }, 5000);
    return () => window.clearInterval(id);
  }, [isActive, lastChangeAt]);

  // ---------------------------------------------------------------- terminal

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
                errors.map((e, i) => (
                  <div key={i} className="font-mono text-xs">{e}</div>
                ))
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
            <StageList stages={stages} />
          </section>
        )}
        <div className="flex justify-between border-t pt-6">
          <button
            onClick={startOver}
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

  // ---------------------------------------------------------------- active

  const heading = isQueued
    ? 'Waiting for a worker…'
    : isParsing
    ? 'Parsing your document…'
    : isReady
    ? 'Parsing complete'
    : 'Connecting to AI service…';

  const lastChangeSec = Math.round((Date.now() - lastChangeAt) / 1000);

  return (
    <div className="max-w-3xl space-y-6 p-8">
      {/* heading + elapsed clock */}
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="text-2xl font-semibold text-gray-900">{heading}</h2>
        <div
          className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1 text-sm font-mono text-gray-700"
          aria-label="Elapsed time"
          title="Elapsed since this Parse step opened"
        >
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {fmtClock(elapsedSec)}
        </div>
      </div>

      {/* queue banner */}
      {isQueued && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-medium text-amber-800">
            Your import is {ordinal(queuePosition ?? 1)} in line
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-100">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{
                width: `${queueDepth ? Math.max(5, (1 - (queuePosition ?? 1) / queueDepth) * 100) : 5}%`
              }}
            />
          </div>
          <div className="mt-2 text-xs text-amber-700">
            Estimated start: {fmtMinutes(etaSeconds)}. You can leave this tab open or come back later.
          </div>
        </div>
      )}

      {/* format detection */}
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

      {/* pipeline */}
      <section aria-live="polite">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Pipeline</h3>
        <StageList stages={stages} placeholderQueued={isQueued} />
        <div className="mt-3 text-xs text-gray-500">
          {stages.length > 0
            ? `${stages.filter((s) => s.state === 'done').length} of ${stages.length} stages complete · refreshing every ${POLL_INTERVAL_MS / 1000} s`
            : `Refreshing every ${POLL_INTERVAL_MS / 1000} s…`}
        </div>
      </section>

      {/* stall hint */}
      {stalled && isParsing && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          <Loader2 className="h-4 w-4 flex-shrink-0 mt-0.5 animate-spin" aria-hidden />
          <div>
            <div className="font-medium">Still working…</div>
            <div className="mt-0.5 text-xs">
              Last status change was {lastChangeSec} seconds ago. Long-running stages (matcher, coverage_review, gap_fill)
              can stay on the same line for a few minutes. Cancel below if you suspect a real hang.
            </div>
          </div>
        </div>
      )}

      {/* polling fallback notice (only when SSE has dropped) */}
      {eventsTransport === 'polling' && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-700">
          Live updates unavailable — refreshing every 2 seconds.
        </div>
      )}

      {/* any non-terminal errors */}
      {errors.length > 0 && !isFailed && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{errors[errors.length - 1]}</div>
        </div>
      )}

      <div className="flex justify-between border-t pt-6">
        <button
          onClick={cancelImport}
          disabled={!isActive}
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

// ----------------------------------------------------------------- StageList

interface StageListProps {
  stages: ReadonlyArray<{
    name: string;
    state: string;
    detail?: string;
    etaSeconds?: number | null;
  }>;
  placeholderQueued?: boolean;
}

function StageList({ stages, placeholderQueued }: StageListProps): JSX.Element {
  if (stages.length === 0) {
    return (
      <ul className="space-y-2 text-sm">
        <li className="text-gray-500">
          {placeholderQueued
            ? 'Pipeline will start when a worker is free.'
            : 'Connecting to the AI service…'}
        </li>
      </ul>
    );
  }
  return (
    <ul className="space-y-2 text-sm">
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
        const progress = parseStageProgress(stage.detail);
        const pct = progress ? (progress.current / progress.total) * 100 : null;
        return (
          <li key={`${stage.name}-${idx}`} className="">
            <div className="flex items-center gap-3">
              <Icon className={`h-4 w-4 ${colour}`} aria-hidden />
              <span className="min-w-[7rem] font-medium text-gray-700">{stage.name}</span>
              <span className="flex-1 text-gray-500">{stage.detail || (stage.state === 'running' ? 'working…' : '')}</span>
              {stage.etaSeconds != null && (
                <span className="text-xs text-gray-400">~{stage.etaSeconds}s</span>
              )}
            </div>
            {pct !== null && stage.state === 'running' && (
              <div className="ml-7 mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-cshse-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
