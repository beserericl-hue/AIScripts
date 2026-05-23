---
name: Critical Error Processing Review — AI Import Flow
description: End-to-end audit of how errors are detected, propagated, displayed, and recovered from across cshse-server (Node), cshse-ai (Python/FastAPI), and the React client during the AI Import Wizard flow. Identifies what's missing for pre-go-live bullet-proofing, ranks gaps by impact, and maps each gap to a CR.
type: review
status: draft
priority: P0
source: User direction 2026-05-22 — "do a critical review of error processing through the entire system and document what is required in the obsidian vault." Triggered by the live-demo failure where (1) a cshse-ai redeploy caused 'AI service unreachable' and (2) the retry silently succeeded with zero buckets ("the process ran, no data is shown in the UI this was embarrasing").
tags: [review, error-handling, resilience, go-live, ai-import]
last_reviewed: 2026-05-22
related:
  - "[[change-requests/cr-036-ai-service-handshake-retries]]"
  - "[[change-requests/cr-037-empty-buckets-guard]]"
  - "[[change-requests/cr-028-matcher-worker-timeout]]"
---

# Critical Error Processing Review — AI Import Flow

## Scope

Every error pathway from the moment a coordinator drops a `.docx` on Upload to the moment they click Apply and land in the Self-Study Editor. This is the audit that should have happened before the demo today; it's now the bullet-proofing checklist for go-live.

## Method

Read-only static analysis of:

- `CSHSE/server/src/controllers/aiImportController.ts` (Node — orchestrator, ~800 LOC of import logic)
- `CSHSE/ai-service/app/import_jobs.py` (Python — pipeline driver)
- `CSHSE/ai-service/app/spec_matcher.py` (Python — Anthropic/OpenAI integration)
- `CSHSE/ai-service/app/splitter/deep_walker.py` (Python — DOCX parsing)
- `CSHSE/client/src/features/selfStudy/Editor/AIImport/steps/*Step.tsx` (React)
- `CSHSE/client/src/store/aiImportStore.ts` (Zustand)
- `CSHSE/client/src/services/api.ts` (fetch wrapper)

Triangulated against the two real failures of 2026-05-22 and the user's standing rule "Never push to developer during a wizard run."

## Findings — ranked by impact

### 🔴 P0 — demo-killers, must land before go-live

#### Finding 1 — Empty buckets accepted silently

**Where:** `aiImportController.ts` `receiveAICallback()` lines ~376–416; `ReviewStep.tsx` lines 22–144; `Stepper.tsx` lines 30–39; `ApplyStep.tsx` lines 30–46.

**What:** ai-service can deliver `{ buckets: {}, status: 'completed' }` and the chain accepts it. The coordinator advances to Review with zero items, can click Apply, "succeeds" with zero content.

**How it bites:** This is the second demo failure ("the process ran, no data is shown"). Any cascading matcher failure — Anthropic rate limit on every section, container restart mid-run, malformed input — produces this state.

**Defense:** Belt + suspenders + braces. See [[change-requests/cr-037-empty-buckets-guard]] (three layers — ai-service self-check, server validation, client gate).

**Verdict:** GAP — silent success.

#### Finding 2 — ai-service handshake has no retry

**Where:** `aiImportController.ts` lines ~233–286; `postToAIService()` helper lines ~165–181.

**What:** Single `fetch` to ai-service. ECONNREFUSED or any 5xx → import permanently fails with "AI service unreachable." No exponential backoff.

**How it bites:** This is the first demo failure. ai-service container restart window of 60–90s on Railway redeploy = permanent import failure for any coordinator who happens to click "Start" in that window.

**Defense:** [[change-requests/cr-036-ai-service-handshake-retries]].

**Verdict:** GAP — single point of failure on the most-trafficked endpoint.

#### Finding 3 — Anthropic rate-limit cascade is silent

**Where:** `ai-service/spec_matcher.py` lines ~443–481; `import_jobs.py` lines ~397–446.

**What:** 3-attempt retry on transient Anthropic errors (HTTP 429, network), then "embedding-only fallback." Section is marked complete with low-confidence tags. If 429 persists across all sections (free-tier limits, rate exhaustion), every section quietly downgrades to tags and the matcher reports "success" with degraded data.

**How it bites:** This is the most insidious failure mode — coordinators see SOME content land but the wizard's quality silently collapses. Not flagged anywhere in the UI. Cascades with Finding 1 — if downgrade is total, buckets stay empty.

**Defense:** Same three-layer guard as Finding 1, plus a stronger backoff schedule on 429 specifically (1s → 5s → 30s → fail visibly, not silently downgrade), plus a "matcher quality" panel on the Parse step showing per-section status.

**Verdict:** GAP — invisible quality degradation.

#### Finding 4 — Unrelated pushes redeploy cshse-ai — RETIRED

**Where:** Railway project configuration.

**What:** Pushing an E2E spec or a doc redeploys the Python service. 60–90s outage window that triggers Finding 2.

**Defense:** Originally proposed config-level fix in [[change-requests/cr-038-railway-path-based-deploy-filter]]. **RETIRED 2026-05-23** per user direction — the dev environment audience is developers only, production deploys happen at PR cadence, and Finding 2's defense (handshake retries via CR-036) covers the runtime case regardless of which event caused the brief ai-service unavailability.

**Verdict:** RECLASSIFIED as a dev-environment annoyance, not a coordinator-facing gap. Defense is Finding 2's fix (CR-036).

### 🟠 P1 — visible to coordinators in adverse conditions

#### Finding 5 — Webhook posting from ai-service → cshse-server is not retried

**Where:** `import_jobs.py` lines ~201–213.

**What:** Single attempt with 10s timeout. If it fails (cshse-server restart, network blip), the job's terminal event is dropped.

**Mitigated by:** Client polls `/ai-status` every 3s (`ParseStep.tsx` lines ~125–133). So the user eventually sees the right state even if the webhook is dropped. But this masks the underlying brittleness.

**Defense:** Add 3-attempt webhook retry with the same exponential backoff helper from CR-036. Trivial.

**Verdict:** GOOD-MITIGATED — has a fallback. Still should be retried for cleanliness + telemetry.

#### Finding 6 — Multi-error imports only show the final error

**Where:** `ParseStep.tsx` lines 174–186, 307–312.

**What:** If two errors fire (e.g., one section hits a 429 then another hits a Qdrant timeout), the second overwrites the first in the banner state. Coordinator only sees the last message; first error is lost.

**Defense:** Render an error list, not a single message. Each entry shows stage + timestamp + severity. Errors collapse to "3 errors during parse — show details" if more than two.

**Verdict:** UX GAP — debugging-hostile.

#### Finding 7 — GridFS large-doc write has no progress / no resume

**Where:** Server `importController.ts` — upload path (GridFS streaming).

**What:** A 50MB+ document upload that fails partway has no resumable state. User sees "Upload failed" and has to start over. For coordinators on slow connections this can mean repeated full re-uploads.

**Defense:** Out of MVP scope, but document. Tus.io-style resumable uploads would be a separate CR. Pre-go-live workaround: warn coordinators ">30MB documents should be uploaded on a wired connection."

**Verdict:** GAP — acceptable for v1, document the limit.

#### Finding 8 — No request-ID tracing across services

**Where:** Throughout cshse-server and ai-service.

**What:** When an error happens deep in the matcher (e.g., an Anthropic 500 for one section), there's no `request-id` carried from the client → server → ai-service → Anthropic call that allows debugging. Each layer logs in isolation. Correlation requires manually matching timestamps.

**Defense:** Generate a `requestId` at the client when starting an import, pass it through every API call, every webhook payload, every Anthropic / OpenAI / Qdrant request as a header (e.g. `X-Cshse-Request-Id`), log it at every level. Foundation for any future telemetry/observability work.

**Verdict:** OBSERVABILITY GAP — slows root-cause analysis.

#### Finding 9 — MongoDB connection drop mid-write has undefined behavior

**Where:** `importController.ts` `applyAIImport()` lines ~495–794. Three separate write loops (narratives, evidence, files) inside a Mongo session.

**What:** If `MONGO_SUPPORTS_TRANSACTIONS === 'true'`, writes are atomic. If false (e.g., a standalone replica set without transactions, or local dev MongoDB), writes are best-effort and a connection drop between loops leaves the Self-Study in an inconsistent state (narratives written, files not).

**Defense:** Require transactions in production. Refuse to start the server if `NODE_ENV=production` and transactions aren't available. Document in deploy runbook.

**Verdict:** DATA-INTEGRITY GAP — config issue, not code.

#### Finding 10 — Idempotency of "Start import" is unclear

**Where:** `aiImportController.ts` `startAIImport()` + ai-service `start_job` endpoint.

**What:** Rapid-fire "Start over" clicks could plausibly create duplicate ai-service jobs. Today there's no `(importId) → jobId` deduplication confirmed on the ai-service side.

**Defense:** ai-service `start_job` checks whether a job for this importId is already running/queued and returns the existing job — see [[change-requests/cr-036-ai-service-handshake-retries]] "Idempotency" section.

**Verdict:** GAP — required precondition for CR-036's retry safety.

### 🟡 P2 — robustness improvements, post-go-live

#### Finding 11 — `postToAIService` error text truncated to 300 chars

**Where:** `aiImportController.ts` line ~178.

**What:** Diagnostic detail beyond 300 chars is silently dropped. For some ai-service errors (Python traceback, large JSON body) the truncation hides the root cause.

**Defense:** Bump to 4000 chars. Log full body to server logs always; truncate only for the user-facing banner.

#### Finding 12 — No timeout on `fetch` in `postToAIService`

**Where:** `aiImportController.ts` lines ~165–181.

**What:** Node's default fetch timeout is implementation-dependent and can be 120s+. A wedged ai-service could hang the user for 2 minutes before failing.

**Defense:** Set explicit 10s timeout via `AbortController`. Covered by CR-036's retry helper.

#### Finding 13 — Polling fallback has no backoff

**Where:** `ParseStep.tsx` line ~125.

**What:** 3-second fixed interval. If the server is slow to respond, multiple in-flight polls can stack.

**Defense:** Exponential backoff on poll failure (3s → 5s → 10s, cap at 10s). Reset to 3s on first success.

#### Finding 14 — Tableizer hides table-flattening bugs

**Where:** `client/src/features/selfStudy/Editor/AIImport/review/tableizeHtml.ts`.

**What:** The defense-in-depth `tableizeIfBareRows` wraps bare `<tr>` at render time, which is correct, BUT also masks any case where the capture-time wrapping didn't happen. We never know which path is doing the work.

**Defense:** Add a console.warn when the render-time path fires, tagged with the importId so we can see how often capture-time misses. Strictly diagnostic.

### 🟢 GOOD — these are working well

- **HMAC signature validation on all webhook callbacks** (`webhook-callback-security.test.ts` covers this) — no spoofed callbacks.
- **SSE + polling redundancy** for status streaming — one fails, the other carries.
- **Per-section timeouts inside the matcher** (CR-028) — one stuck section can't wedge the whole pipeline.
- **Transient vs hard error classification** in `_is_transient_runtime_error()` — distinguishes signal from noise.
- **Mongo session use for Apply** when transactions are available — atomic commits.
- **The 'Discard' button (CR-033) + Edit pencil (CR-032)** give coordinators a way out of bad AI output.

## Cross-cutting themes

### Theme A — Silent successes are worse than loud failures

Findings 1, 3, and to some extent 14 share a pattern: the system completes "successfully" with degraded or absent data. Across the codebase there's a bias toward "swallow and continue" — webhook errors, matcher soft-fails, empty buckets. Coordinators have no way to know the wizard is lying.

**Pre-go-live invariant to add:** every step must have a "did we actually do anything useful?" sanity check that converts silent success into loud failure. CR-037 implements this for the matcher → Review handoff; the pattern should extend to Apply (did we actually write anything to the Self-Study?) and to Parse (did we actually extract any sections?).

### Theme B — Lack of telemetry blocks root-cause analysis

Findings 8 and 14 share a theme: when something goes wrong in production, we cannot tell why. There's no request-id tracing, no per-section timing, no Anthropic/OpenAI/Qdrant latency distributions surfaced anywhere. Today's failures were diagnosed by reading code, not by reading logs.

**Pre-go-live work:** request-id tracing (Finding 8) is the foundation. After it lands, add structured logging at every layer with the requestId. Build a tiny admin page (`/admin/imports/:requestId`) that surfaces the full timeline.

### Theme C — Coordinators see infrastructure failures as product failures

The "AI service unreachable" banner is technically accurate but operationally useless — coordinators don't know what an AI service is, only that "the importer is broken." Combined with the lack of retries (Finding 2), this turns routine infrastructure events into customer-visible product failures.

**Pre-go-live invariant:** every coordinator-visible error must answer "what should I do now?" Either "wait and retry" or "your document was malformed, here's why" or "this is a real bug, contact support with this request-id." Today's banners answer none of these.

## Pre-go-live checklist (extracted from findings)

P0 (must ship):

- [ ] [[change-requests/cr-036-ai-service-handshake-retries]] — close Finding 2 + part of Finding 5 + Finding 10 + Finding 12.
- [ ] [[change-requests/cr-037-empty-buckets-guard]] — close Finding 1 + part of Finding 3.
- ~~[[change-requests/cr-038-railway-path-based-deploy-filter]]~~ — **RETIRED 2026-05-23**; Finding 4 reclassified as dev-environment-only; CR-036 covers the runtime case.
- [ ] Per-section status panel on the Parse step (Finding 3) — visible quality indicator.
- [ ] Server-side enforcement: `NODE_ENV=production` requires `MONGO_SUPPORTS_TRANSACTIONS=true` (Finding 9).

P1 (early post-go-live):

- [ ] Request-ID propagation (Finding 8) + structured logging.
- [ ] Multi-error error list on Parse step (Finding 6).
- [ ] Webhook retries (Finding 5) for cleanliness + telemetry.

P2 (later):

- [ ] Polling backoff (Finding 13).
- [ ] Resumable uploads (Finding 7).
- [ ] Tableize render-time diagnostic (Finding 14).
- [ ] Error-text truncation bump (Finding 11) + explicit fetch timeout (Finding 12 — partly handled by CR-036).

## Definition of "bullet-proofed" for go-live

A coordinator running an end-to-end import:

1. Does not see "AI service unreachable" for any redeploy/restart window < 8 seconds (CR-036).
2. Does not see an empty Review screen with no error (CR-037).
3. Sees per-section progress and quality on the Parse step (Finding 3 work).
4. If something goes wrong, sees an actionable error with a request-id they can give to support (Finding 8 work).
5. Can recover by clicking "Start over" without any orphan state on the server (CR-036 idempotency).

Until those five conditions hold, the importer is not ready for general use.

## Related

- [[change-requests/cr-036-ai-service-handshake-retries]]
- [[change-requests/cr-037-empty-buckets-guard]]
- [[change-requests/cr-028-matcher-worker-timeout]]
- ~~[[change-requests/cr-038-railway-path-based-deploy-filter]]~~ — RETIRED 2026-05-23
- [[ai-import-wizard-e2e-regression-plan-2026-05-22]]
- [[ai-import-wizard-e2e-coverage-review-2026-05-22]]
