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

// User-facing labels for the pipeline stages. The technical names come
// from the Python ai-service (import_jobs.py); coordinators don't know
// what 'mammoth' or 'deep_walker' are. User direction 2026-05-22:
// rename mammoth → 'Document Reader'. While we're here, humanize the
// other stage names too so the parse step reads in plain English.
const STAGE_LABELS: Record<string, string> = {
  download_s3: 'Downloading document',
  format_detect: 'Detecting format',
  mammoth: 'Document Reader',
  deep_walker: 'Reading structure',
  matcher: 'Matching to specifications',
  coverage_review: 'Reviewing coverage',
  gap_fill: 'Filling coverage gaps',
  matrix_extract: 'Extracting matrices',
};

function stageLabel(name: string): string {
  return STAGE_LABELS[name] ?? name;
}

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

  // CR-037 Defense 3 — client-side empty-buckets guard. Even if server-side
  // Defense 2 missed a case, the wizard refuses to advance the coordinator
  // to Review when ai-service returned literally nothing. Renders a
  // "no items detected — retry or contact support" message in place of
  // the Next button.
  const buckets = useAIImportStore((s) => s.buckets);
  const tags = useAIImportStore((s) => s.tags);
  const matrices = useAIImportStore((s) => s.matrices);
  const totalReviewableItems =
    Object.values(buckets ?? {}).reduce(
      (n, b) =>
        n +
        (b?.narratives?.length ?? 0) +
        (b?.evidenceText?.length ?? 0) +
        (b?.evidenceFiles?.length ?? 0),
      0
    ) +
    (tags?.length ?? 0) +
    (matrices?.length ?? 0);
  const isEmptyParse = isReady && totalReviewableItems === 0;

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
                  Last stage: <span className="font-medium">{stageLabel(failedStage.name)}</span>
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
        <CoverageBadge />
        <BatchProgress />
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
          disabled={!isReady || isEmptyParse}
          title={isEmptyParse ? 'AI returned zero items — re-upload or contact support' : undefined}
          className="rounded-md bg-cshse-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-cshse-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Next ▸
        </button>
        {isEmptyParse && (
          <div
            data-testid="cr-037-empty-buckets-banner"
            className="ml-auto text-xs text-red-700"
          >
            AI returned zero items. Try re-uploading or contact support if this persists.
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- BatchProgress

/**
 * CR-041 US-4 — multi-file batch progress.
 *
 * Renders one row per child of the parent ImportBatch when the wizard
 * is in batch mode. Polls /api/imports/batch/:id every 3 s so the
 * coordinator sees status changes without an SSE channel per child.
 * US-5 gate (hold-for-review) lives here too: when on, the Next button
 * is disabled until every child has finished.
 */
function BatchProgress(): JSX.Element | null {
  const batchId = useAIImportStore((s) => s.batchId);
  const snapshot = useAIImportStore((s) => s.batchSnapshot);
  const holdForReview = useAIImportStore((s) => s.holdForReview);
  const pollBatch = useAIImportStore((s) => s.pollBatch);
  const setStep = useAIImportStore((s) => s.setStep);
  React.useEffect(() => {
    if (!batchId) return;
    pollBatch();
    const id = setInterval(pollBatch, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [batchId, pollBatch]);
  if (!batchId || !snapshot) return null;

  const done = snapshot.completedCount + snapshot.failedCount;
  const total = snapshot.fileCount;
  const allDone = done >= total;
  const reviewUnlocked = !holdForReview ? done >= 1 : allDone;

  return (
    <section className="mt-6 rounded-md border border-cshse-200 bg-white p-3">
      <header className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-800">
          Multi-file batch — {done} of {total} files complete
          {snapshot.failedCount > 0 && (
            <span className="ml-2 text-red-700">· {snapshot.failedCount} failed</span>
          )}
        </div>
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700">
          {snapshot.status}
        </span>
      </header>
      <ul className="space-y-1 text-xs">
        {snapshot.children.map((c) => (
          <li
            key={c.importId}
            className="flex items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-gray-500">{c.batchPosition}.</span>
              <span className="truncate font-medium text-gray-800">
                {c.originalFilename}
              </span>
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                c.status === 'parsed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : c.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : c.status === 'parsing'
                  ? 'bg-cshse-100 text-cshse-800'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              {c.status}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <div className="text-[11px] italic text-gray-600">
          {holdForReview
            ? allDone
              ? 'All files complete. Open merged Review when ready.'
              : 'Waiting for every file to finish before opening Review (hold-for-review ON).'
            : reviewUnlocked
            ? 'Review is open. New files merge in as they complete.'
            : 'Review opens after the first file finishes.'}
        </div>
        <button
          onClick={() => setStep('review')}
          disabled={!reviewUnlocked}
          className="rounded bg-cshse-600 px-3 py-1 text-xs font-medium text-white shadow disabled:cursor-not-allowed disabled:bg-gray-300"
          title={
            reviewUnlocked
              ? 'Open merged Review'
              : 'Hold-for-review gate active — every child must finish first'
          }
        >
          Next: Review ▸
        </button>
      </div>
    </section>
  );
}

// -------------------------------------------------------------- CoverageBadge

/**
 * CR-040 Phase 3b — coverage stat surfaced under the pipeline.
 *
 * Reads coverageReport from the store; renders nothing until the
 * verifier has emitted a report. Color cues mirror the CR spec:
 * green ≥ 99.5%, amber 95–99.5%, red < 95%. Below 90% would
 * normally block Review entirely — for now we surface the cue and let
 * the coordinator continue. Hard-blocking gate ships when the verifier
 * has run against enough real coordinator docs to know the floor.
 */
function CoverageBadge(): JSX.Element | null {
  const report = useAIImportStore((s) => s.coverageReport);
  if (!report) return null;
  const pct = typeof report.coveragePercentBytes === 'number'
    ? report.coveragePercentBytes
    : (report.coveragePercent ?? 100);
  const missing = report.missingFragments?.length ?? 0;
  const boundaryWarnings = report.boundaryWarnings?.length ?? 0;
  const color =
    pct >= 99.5
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : pct >= 95
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : 'border-red-300 bg-red-50 text-red-800';
  return (
    <div className={`mt-3 inline-flex items-center gap-2 rounded border px-2.5 py-1 text-xs ${color}`}>
      <span className="font-mono font-semibold">COVERAGE: {pct.toFixed(1)}%</span>
      {missing > 0 && <span>· {missing} missing fragment{missing === 1 ? '' : 's'}</span>}
      {boundaryWarnings > 0 && (
        <span>· {boundaryWarnings} boundary warning{boundaryWarnings === 1 ? '' : 's'}</span>
      )}
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
              <span
                className="min-w-[9rem] font-medium text-gray-700"
                title={`Pipeline stage: ${stage.name}`}
              >
                {stageLabel(stage.name)}
              </span>
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
