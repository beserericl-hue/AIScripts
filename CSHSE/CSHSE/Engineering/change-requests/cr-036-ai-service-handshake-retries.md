---
name: CR-036 — Exponential-backoff retries on the cshse-server → ai-service initial handshake
description: The "Start AI import" call from cshse-server to cshse-ai is a single fetch with no retry. A 60-90s Railway redeploy window of cshse-ai causes the import to permanently fail with "AI service unreachable" instead of retrying transparently. Add 3–4 retries with exponential backoff (250ms → 500ms → 1s → 2s → fail) so a routine redeploy or transient network blip is invisible to coordinators.
type: change-request
cr_id: CR-036
status: proposed
priority: P0
source: User-visible failure 2026-05-22 during the live demo. Triggered by an unrelated push that caused Railway to redeploy cshse-ai. The "Could not start AI service: AI service unreachable" banner appeared while the container was rolling. CR-028 added per-call retries inside the matcher, but the initial handshake from cshse-server stays as a single attempt.
sprint_target: Sprint 4 — top of the list. Coordinator-blocking.
tags: [server, ai-service, retry, resilience, p0, demo-quality]
last_reviewed: 2026-05-22
---

# CR-036 — ai-service handshake retries

## Source quote

User, 2026-05-22 (mid-demo, after the cshse-ai container was redeploying):

> "just got this error. Why?" (screenshot: red "Import failed — Could not start AI service: AI service unreachable")

And later, after services recovered:

> "we need to bullet proof this importer."

## What's broken today

`server/src/controllers/aiImportController.ts` line ~236 — `postToAIService()` is a single `fetch` call. If the response is non-2xx OR the connection refuses (typical during a Railway container restart), the catch block at line ~266 sets `aiStatus: 'failed'`, broadcasts a terminal SSE event, and the user sees the red banner. There is no retry, no exponential backoff, no jitter.

Failure modes that trigger this in normal operation:

1. **Routine cshse-ai redeploy.** Railway redeploys cshse-ai on any push to `developer` (until [[cr-038-railway-path-based-deploy-filter]] lands). Container restart window: 60–120s. Any import started in that window fails permanently.
2. **Brief network blip between Railway services.** Sub-second packet loss → connection refused → permanent failure.
3. **ai-service crash + auto-restart.** Container OOM or panic → ~30s before restart → permanent failure.

CR-028 ([[cr-028-matcher-worker-timeout]]) already added per-call retries inside the matcher pipeline (Anthropic, OpenAI, Qdrant). Those retries protect calls **after** the import has successfully handed off to ai-service. They do NOT protect the handoff itself.

## Decision

Wrap `postToAIService()` in an exponential-backoff retry loop. Configurable via env. Sane defaults:

- **Max attempts:** 5
- **Backoff schedule:** 250ms, 500ms, 1s, 2s, 4s — total worst-case wait ~8s
- **Jitter:** ±20% on each delay (avoid thundering herd if multiple imports retry simultaneously)
- **Retryable conditions:**
  - Connection refused / ECONNREFUSED
  - Connection reset / ECONNRESET
  - DNS lookup failure (transient)
  - Fetch timeout (no response in 10s)
  - HTTP 502 / 503 / 504 (proxy reports backend not ready)
  - HTTP 5xx with body matching "starting up" / "not ready" / "warming up"
- **Non-retryable (fail fast):**
  - HTTP 4xx (auth, validation — these don't get better by retrying)
  - HTTP 5xx that isn't 502/503/504 — log + fail (likely a bug)

If all attempts fail, the existing failure path runs (set `aiStatus: 'failed'`, broadcast SSE, user sees banner). The banner text becomes more honest: "Could not reach AI service after 5 attempts over 8 seconds. Try again, or contact support if this persists."

## UI feedback during retries

The coordinator should NOT see a red banner for transient retries. Instead:

- While a retry is in-flight, the Parse step shows an ephemeral yellow banner: "Connecting to AI service…" with a quiet progress indicator. Disappears immediately on success.
- The banner stays yellow (not red) throughout the retry window. Red only appears after all retries are exhausted.
- A small "Retrying (attempt 2 of 5)…" line is fine; do not stack notifications.

## Logging + observability

Every retry attempt logs a single line at INFO:

```
[handshake-retry] importId=abc123 attempt=2/5 reason=ECONNREFUSED next-delay-ms=500
```

A final summary at SUCCESS or FAILURE:

```
[handshake-retry] importId=abc123 outcome=success total-attempts=3 total-elapsed-ms=1240
[handshake-retry] importId=abc123 outcome=failed total-attempts=5 total-elapsed-ms=8060 last-reason=HTTP_502
```

These logs feed the future "import-flow telemetry" CR.

## Idempotency

Retrying is only safe if `ai-service` treats the same `(importId, payload)` as idempotent. Two cases:

- **Case A — ai-service rejects duplicate POST.** Today this would surface as HTTP 409 on retry. Fix: ai-service `start_job` endpoint must check whether the job is already accepted and return HTTP 202 + the existing jobId rather than a 4xx. This is a small ai-service change.
- **Case B — ai-service silently accepts duplicate.** Two jobs run concurrently against the same import. We MUST prevent this. Same fix as Case A: ai-service deduplicates by importId.

The CR includes the ai-service idempotency fix. Without it, retries can corrupt state.

## Acceptance criteria

1. With ai-service deliberately stopped (`docker stop cshse-ai` locally or paused on Railway), starting a new import shows a yellow "Connecting…" banner for ~8s then a red exhausted-retries error. Coordinator never sees the red banner during a brief outage shorter than 8s.
2. With ai-service redeployed mid-import-start (~60s container restart on Railway), the import succeeds on the first retry attempt after the container comes back. Coordinator sees no banner at all.
3. Repeated rapid-fire "Start over" clicks within the retry window of a single import do not create duplicate ai-service jobs. ai-service returns the existing jobId.
4. Server logs show every attempt + the outcome with `importId`.
5. The yellow "Connecting…" banner is dismissed on success and replaced by the normal Parse stage progression.

## Out of scope

- Webhook retries (separate gap; see Section 5 of the critical error review doc).
- Anthropic / OpenAI / Qdrant retries (already in CR-028).
- Retries for callbacks ai-service → cshse-server (covered by polling fallback).
- General "all HTTP calls in the server retry" — this CR is scoped to the handshake only.

## Engineering size

S. ~80 LOC of server code in `aiImportController.ts` + a `withRetries(fn, opts)` helper, ~30 LOC of ai-service idempotency check, ~20 LOC of client banner state. Half a day.

## Related

- [[cr-028-matcher-worker-timeout]] — per-call retries inside the matcher.
- [[cr-037-empty-buckets-guard]] — sibling CR; together they prevent the two demo-killing failure modes.
- [[cr-038-railway-path-based-deploy-filter]] — reduces redeploy frequency, but does NOT eliminate the need for retries.
- [[../critical-error-processing-review-2026-05-22]] — Finding #3 in that review.
- [[../ai-import-wizard-e2e-regression-plan-2026-05-22]] — `18_recovery_matcher_disconnect.spec.ts` should exercise this.
