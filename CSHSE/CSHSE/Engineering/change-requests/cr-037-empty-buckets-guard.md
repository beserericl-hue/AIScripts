---
name: CR-037 — Reject empty-bucket imports before the wizard advances to Review
description: Today, if the ai-service finishes a job and writes `{ buckets: {} }` to the server (for any reason — matcher silently failed every section, document was malformed, container restarted mid-run, transient outage cascaded), the wizard advances the coordinator to the Review screen with zero items visible. They can then click Apply and "succeed" with zero content. Add a server-side guard that rejects empty terminal callbacks AND a client-side guard that blocks advancing to Review when the bucket count is zero, replacing the silent failure with an actionable error.
type: change-request
cr_id: CR-037
status: proposed
priority: P0
source: User-visible failure 2026-05-22 during the live demo. After CR-036's redeploy blip, the user retried the import. It "ran" without an error banner but the Review screen was empty. Quote: "the process ran, no data is shown in the UI this was embarrasing."
sprint_target: Sprint 4 — second only to CR-036. Together they close the two demo-killers.
tags: [server, ai-service, client, validation, p0, demo-quality]
last_reviewed: 2026-05-22
---

# CR-037 — Empty-buckets guard

## Source quote

User, 2026-05-22 (post-demo):

> "the process ran, no data is shown in the UI this was embarrasing"

And:

> "we need to bullet proof this importer."

## What's broken today

Three independent code points form a silent-success chain:

1. **ai-service emits an empty terminal payload.** `ai-service/app/import_jobs.py` lines ~451–495 — if every section soft-fails (Anthropic rate-limit cascade, embedding-only fallback, OR matcher container restart re-processes nothing), the `buckets` dict stays empty. The terminal callback posts `{ buckets: {}, status: 'completed', errors: [] }` to cshse-server.

2. **cshse-server accepts the empty payload.** `server/src/controllers/aiImportController.ts` `receiveAICallback()` lines ~376–416 — persists whatever ai-service sends, no schema validation, no "did this produce anything?" check. Sets `aiBuckets: {}` and marks the import as parsed.

3. **Client advances coordinator to Review.** `client/src/features/selfStudy/Editor/AIImport/`:
   - `Stepper.tsx` — gates only on `status === 'parsed'`, not on `buckets.length > 0`.
   - `ReviewStep.tsx` — reads `buckets`, renders an empty spec rail with no warning.
   - `ApplyStep.tsx` — sums per-bucket counts and renders "0 items" rows, but Apply button stays enabled.

End-to-end result: the coordinator sees a fully-rendered but completely empty Review screen. There is no error. The wizard claims success.

## Decision

Three defenses, all of them required because each one alone can be bypassed by a future code change:

### Defense 1 — ai-service self-validates before terminal callback

In `ai-service/app/import_jobs.py`, before posting the terminal callback, run a final invariant check:

```python
total_items = sum(
    len(b.get('narratives', []))
    + len(b.get('evidenceText', []))
    + len(b.get('evidenceFiles', []))
    for b in job.buckets.values()
)
if total_items == 0 and not job.errors:
    job.errors.append({
        "stage": "matcher",
        "severity": "error",
        "message": "Matcher produced zero items. See per-section diagnostics."
    })
    job.status = 'failed'
```

This converts "silent zero-item success" into an explicit failure with a diagnostic message. The callback still goes out, but with `status: 'failed'` and an error the user can see.

### Defense 2 — cshse-server validates the callback payload

In `aiImportController.ts` `receiveAICallback()`, when `status === 'completed'` and the payload's total-item-count is zero, refuse to persist as parsed:

```ts
const totalItems = sumBucketCounts(payload.buckets);
if (totalItems === 0 && (!payload.errors || payload.errors.length === 0)) {
  payload.status = 'failed';
  payload.errors = [{
    stage: 'matcher',
    severity: 'error',
    message: 'AI matcher returned zero items. The document may have been ' +
             'malformed, or all sections may have failed individually. ' +
             'Try re-uploading; contact support if this persists.'
  }];
}
```

This is the belt-and-suspenders to Defense 1. Even if ai-service is wrong (or runs an old version), the server catches it.

### Defense 3 — client gates wizard advancement

In `Stepper.tsx`, the Parse → Review transition checks:

```ts
const canAdvanceToReview =
  status === 'parsed' &&
  totalBucketItemsAcrossAllSpecs(buckets) > 0;
```

If `parsed` but zero items, the Parse step renders an "Import completed with zero items — see details" panel and the Review tab stays unreachable. The coordinator clicks "Start over" or "Re-upload" without ever seeing the broken empty Review screen.

This is the user-visible defense. Defenses 1 and 2 mean the data never reaches this state; Defense 3 means even if it does (e.g. a bug in 1 or 2, or an in-flight job from before the fix shipped), the coordinator sees a coherent error.

## What an actionable error looks like

If all three defenses fire (which means the matcher genuinely produced nothing for a real document), the Parse step shows:

```
⚠ Import completed but no content was placed.

Possible causes:
  • The document was malformed or had no extractable text.
  • The AI matcher hit a rate limit on every section.
  • A network blip during processing dropped intermediate results.

Diagnostics: [importId abc123] — share with support if needed.

[ Start over ]  [ View ai-service logs ]
```

The "View ai-service logs" link opens the per-import diagnostic page (small new admin route — separate CR if not in scope).

## Acceptance criteria

1. Forcing ai-service to soft-fail every section (e.g. by injecting an Anthropic 429 mock on every call) results in the user seeing the "Import completed but no content was placed" panel, NOT an empty Review screen.
2. Forcing ai-service to send `{ buckets: {}, status: 'completed' }` directly to the webhook bypasses Defense 1 but Defense 2 catches it; user still sees the actionable error.
3. Forcing the server to mark a fake import as `status: 'parsed'` with empty buckets in MongoDB bypasses Defenses 1 and 2; the client Defense 3 catches it; user still sees an actionable error.
4. A genuine empty-document upload (a `.docx` with zero text) reaches the same actionable-error state via Defense 1.
5. A normal multi-bucket import is unaffected — no false positives, no extra latency.
6. Server logs explicitly tag every Defense fire: `[empty-buckets-guard] defense=1|2|3 importId=...`.

## Out of scope

- Showing per-section diagnostics in the UI (separate CR).
- Auto-retry of failed sections (could be a follow-on).
- Distinguishing "all rate-limited" from "all parsed but matched nothing" — both are equally bad outcomes from the coordinator's perspective.

## Engineering size

S–M. ~40 LOC each in ai-service, server, client. Half a day for Defenses 1+2, half a day for Defense 3 + the error panel UI.

## Related

- [[cr-036-ai-service-handshake-retries]] — sibling CR; together they close the demo failure modes.
- [[../critical-error-processing-review-2026-05-22]] — Finding #1 in that review.
- [[../ai-import-wizard-e2e-regression-plan-2026-05-22]] — new spec `21_empty_buckets_guard.spec.ts` to be added.
