---
name: CR-028 — Add per-call timeouts to matcher Anthropic / OpenAI / Qdrant calls
description: Matcher worker threads can wedge indefinitely on slow external API calls because no per-call timeout is set; combined with the CR-024 retry loop a single section can hold a worker for 40+ minutes. Wedged workers freeze the `as_completed` iterator and stall the entire matcher stage.
type: change-request
cr_id: CR-028
status: shipped
priority: P0
source: User observation 2026-05-21 — matcher stuck at 100/573 for 45 minutes during Stevenson smoke test (no error surfaced)
sprint_target: Immediate hotfix when user clears smoke test
tags: [ai-service, matcher, timeouts, reliability, hotfix]
last_reviewed: 2026-05-24
---

# CR-028 — Add per-call timeouts to matcher Anthropic / OpenAI / Qdrant calls

## Summary

During a Stevenson smoke test on 2026-05-21, the wizard's matcher stage advanced to 100/573 sections, then stopped publishing progress for 45+ minutes (the in-app "Still working…" banner reported 2692 seconds since the last status change). The cshse-ai `/health` endpoint returned 200 throughout — the service was alive, just wedged.

The matcher stage uses a `ThreadPoolExecutor(max_workers=6)` and iterates futures via `as_completed`, which blocks until at least one future completes. If all six workers are simultaneously stuck in an external network call with no per-call timeout, the iterator hangs and `done_count` never advances.

My earlier fix in commit `ad88514` (CR-024 retry loop) made transient errors retry up to 4 times with [0.5s, 1.5s, 3.0s] backoffs — but did NOT set a per-request timeout on the Anthropic SDK call itself. The Anthropic SDK's default per-request timeout is generous (10 minutes for the full response), and with internal SDK retries on top of my outer retry the effective wait per section can exceed 40 minutes before the embedding fallback fires.

Same gap exists for the OpenAI embedding client (`embedder.embed_one`) and the Qdrant search (`store.search`) called from `_candidates_for`. A wedged TCP socket on either of those can deadlock a worker just as effectively.

## Source quotes

User, 2026-05-21:

> "something broke. System is hung up"

Screenshot evidence: matcher at 100/573 for 45 minutes; "Last status change was 2692 seconds ago. Long-running stages (matcher, coverage_review, gap_fill) can stay on the same line for a few minutes. Cancel below if you suspect a real hang."

## Decision

Three layers of timeouts, each independent so a fix at any layer breaks the deadlock:

### 1. Anthropic SDK client gets an explicit timeout

When constructing `Anthropic(...)` inside `SpecMatcher.__init__`, pass `timeout=httpx.Timeout(30.0, connect=10.0)`. The SDK respects this on every `messages.create()` call. After 30s a single request raises `APITimeoutError`, which my retry loop already classifies as transient.

### 2. Each Haiku call gets `request_options={"timeout": 30}`

Belt-and-braces — even if the client default isn't picked up correctly (e.g. monkey-patched in tests), the per-call timeout enforces.

### 3. OpenAI embedder + Qdrant client get the same treatment

- `EmbeddingClient` constructed in `import_jobs.py` and `spec_matcher.py` should pass `timeout=15.0` (embedding calls are fast; 15s is generous).
- `VectorStore(qdrant_url, qdrant_api_key, timeout=10.0)` — qdrant_client accepts `timeout` in its constructor. Apply uniformly.

### 4. Outer-loop safety net: matcher stage cap

In `import_jobs.py` `_run_matcher`, add a per-section timeout via `future.result(timeout=120)`. If any individual section's future hasn't returned in 2 minutes (which it shouldn't, given the layered timeouts above), force-cancel that future, log the section_id into `job.warnings`, and continue. The `as_completed` iterator only blocks on the slowest future, so this guarantees the stage cannot deadlock for more than `max_workers * 120s = 12 minutes` end-to-end, even if every network call hangs.

## Acceptance

- [ ] `SpecMatcher` initialises Anthropic client with `timeout=30s`.
- [ ] `EmbeddingClient` initialises with `timeout=15s`.
- [ ] `VectorStore` initialises with `timeout=10s`.
- [ ] `_run_matcher`'s `fut.result()` is called with `timeout=120` and on `TimeoutError` the worker is cancelled + logged to `job.warnings`.
- [ ] Smoke test: run Stevenson import end-to-end; matcher stage completes within reasonable bounds even when one section's Anthropic call is artificially slow.
- [ ] Unit test: mock a wedged Anthropic call (raises `APITimeoutError` after the configured timeout); assert the matcher retries 4 times then falls back to embedding-only without blocking the threadpool.
- [ ] Regression: existing transient-error retry test still passes (TimeoutError is in the classifier).

## Files affected

- `ai-service/app/matcher/spec_matcher.py` — `Anthropic(timeout=...)` + per-call `timeout` kwarg on `messages.create()`
- `ai-service/app/embeddings/openai_client.py` — pass `timeout=15.0` to the OpenAI client
- `ai-service/app/vector/qdrant_ops.py` — pass `timeout=10.0` to `QdrantClient(...)`
- `ai-service/app/import_jobs.py` — `_run_matcher` uses `fut.result(timeout=120)` with try/except `TimeoutError`
- `ai-service/tests/test_matcher_retry_classifier.py` — extend with a wedge test

## Test plan

- **Unit (mock):** install a mock Anthropic client whose `messages.create` blocks indefinitely. Assert the SDK raises `APITimeoutError` after 30s and the retry loop catches + falls back to embedding-only after 4 attempts.
- **Unit (mock):** install a mock future inside `_run_matcher` that never returns. Assert the outer `fut.result(timeout=120)` raises and the section gets logged to warnings + the rest of the pipeline continues.
- **Integration:** point `ANTHROPIC_API_KEY` at an invalid value that causes 401; matcher should NOT retry (not transient per the existing classifier) and the job should fail fast.
- **E2E:** Stevenson smoke test runs to completion; verify total matcher stage time stays under 30 minutes even on a bad network day.

## Dependencies

- The classifier shipped in `ad88514` already covers `APITimeoutError`, so the retry path is already correct — we just need to give the SDK a reason to RAISE that error in the first place.

## Open questions

- Should `timeout=30` be configurable via env? **Decision: not for v1.** A future "long-running model" feature flag might want this configurable, but a hardcoded value is fine until then.
- The cshse-ai service has a single in-process worker; if a future deploy moves to multi-worker, do these timeouts still suffice? **Yes** — timeouts are per-call regardless of worker model.

## Rollout

Hotfix as soon as the user clears the smoke test. Single commit to `developer`, no migration needed.
