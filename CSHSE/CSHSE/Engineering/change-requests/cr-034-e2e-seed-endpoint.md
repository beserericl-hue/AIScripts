---
name: CR-034 — E2E seed endpoint for wizard regression tests
description: Add a single dev-only POST /api/test/seed endpoint that lets Playwright (or any test runner) drop a known import-job state into MongoDB + return the Zustand store JSON to inject, so an E2E test can land directly on Parse / Match / Matrix / Review / Apply with deterministic fixtures. Replaces today's only path of driving a full upload-and-parse from Step 1.
type: change-request
cr_id: CR-034
status: proposed
priority: P0
source: User direction 2026-05-22 — "I also want you to plan the entire regression test E2E and add E2E seed endpoints so that you can do what is needed." Follow-on of the Discard-button E2E that could only verify via bundle-string scan because there was no way to reach the Review step deterministically.
sprint_target: Sprint 4 — must land before the full regression suite (CR-033 verification depends on this)
tags: [testing, e2e, playwright, dev-only, infra]
last_reviewed: 2026-05-22
---

# CR-034 — E2E seed endpoint

## Source quote

User, 2026-05-22:

> "I also want you to plan the entire regression test E2E and add E2E seed endpoints so that you can do what is needed."

And earlier in the same thread, after watching a Discard-button E2E settle for a bundle-string scan because the wizard's localStorage state couldn't be reproduced in a fresh Playwright session:

> "i suggest you run E2E on any change you make"

## What's broken today

The wizard's state lives in a Zustand store persisted to the browser's `localStorage` (`ai-import-storage` key). To exercise anything past Step 1 (Upload) you have to drive a real upload, wait for the Parse pipeline, wait for the matcher, and then wait for matrix inference — three Anthropic calls + an embedding pass minimum. On a fresh Playwright browser this takes 60–120 seconds **at best**, is flaky on transient AI errors, and depends on the exact .docx file being available.

Result: today's only E2E test that touches the Review step ([[../discard_button.spec.ts|discard_button.spec.ts]]) gives up on functional verification and falls back to grepping the loaded JS for a marker string. That's enough to prove "the code shipped" but not enough to prove "the button works."

The existing `e2e/tests/login.spec.ts` already notes the gap:

```ts
test.skip('logs a coordinator in and lands them on the dashboard (needs seeded DB)', ...)
// Skipped until an E2E seed endpoint exists.
```

## Decision

One endpoint, one purpose: drop a deterministic import-job state into the database and return both the server-side `selfStudyId` / `importJobId` AND the Zustand store JSON to inject into `localStorage`. The test then `page.evaluate(...)` injects the JSON, reloads, and lands on whatever step it asked for.

**Hard requirements:**

- Disabled by default. Only mounted when `E2E_SEED_ENABLED=1`.
- Refuses to run if `NODE_ENV === 'production'`.
- Requires a header `x-e2e-seed-token: <env var>` — same token only ever appears in CI / local dev.
- Logs every call at INFO level with the seed name + caller IP.

That's the entire security surface. No user impersonation, no email confirmation flow, no SSO bypass.

## Endpoint shape

```http
POST /api/test/seed
Content-Type: application/json
x-e2e-seed-token: <token>

{
  "fixture": "wizard_review_minimal",
  "overrides": { /* optional — patch specific fields */ }
}
```

Response:

```jsonc
{
  "selfStudyId": "6986239a6612bf17f04a3217",
  "importJobId": "abc123",
  "userId": "...",
  "userEmail": "e2e-coordinator@example.test",
  "userPassword": "TestSeedPw-1",   // for the loginViaUI helper
  "localStorageInject": {
    "ai-import-storage": "<serialised Zustand state>"
  },
  "cleanupToken": "..."              // pass back to DELETE /api/test/seed
}
```

A matching `DELETE /api/test/seed` accepts the `cleanupToken` and reverses everything (drops the self-study, the import job, the user). Each Playwright test calls seed in `beforeEach`, cleanup in `afterEach` — guarantees no state leaks across runs.

## Fixtures

A small library of named fixtures lives in `server/src/test/fixtures/`:

| Fixture name | Wizard step landed on | What's seeded |
|---|---|---|
| `wizard_upload_clean` | Upload (Step 1) | Fresh user, no import job yet |
| `wizard_parse_running` | Parse (Step 2) | Import job mid-parse, two stages done |
| `wizard_match_done` | Match (Step 3) | Match results with mixed confidences |
| `wizard_matrix_pending` | Matrix (Step 4) | 3 faculty rows awaiting subspec confirm |
| `wizard_review_minimal` | Review (Step 5) | 3 narratives, 1 evidence, 1 file, 2 matrix rows, 1 unplaced |
| `wizard_review_cv_smoke` | Review (Step 5) | Same as `wizard_review_minimal` + 2 CV items (for CR-033) |
| `wizard_apply_dryrun` | Apply (Step 6) | Same as review but with approvals pre-set |

Each fixture is a single JSON file checked into the repo. Adding a new step or kind = adding a JSON file, no code change.

## Test usage pattern

```ts
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeeded } from '../helpers/seed';

test('Discard removes a card from the spec', async ({ page }) => {
  const seed = await seedFixture('wizard_review_minimal');
  try {
    await loginAsSeeded(page, seed);
    await page.goto(`/self-study/${seed.selfStudyId}`);
    await page.getByRole('button', { name: /importer wizard/i }).click();
    await page.getByRole('button', { name: /review/i }).click();

    const card = page.locator('[data-section-id="narr-001"]');
    await card.getByRole('button', { name: /^discard$/i }).click();
    page.on('dialog', d => d.accept());

    await expect(card).not.toBeVisible();
  } finally {
    await cleanupSeed(seed);
  }
});
```

A new `e2e/helpers/seed.ts` wraps the HTTP calls + the `page.evaluate` injection.

## Server implementation outline

- New file `server/src/routes/test.ts` mounted at `/api/test/*` only when `E2E_SEED_ENABLED=1`.
- `seedFixture(name)` — reads JSON from `server/src/test/fixtures/{name}.json`, applies overrides, writes a fresh self-study, fresh user, fresh import job to MongoDB, generates a one-time `cleanupToken` (stored on the seeded user record).
- `cleanupSeed(token)` — deletes the self-study, the import job, the user.
- All writes use the same Mongoose models the production routes use — no shadow schema.

## Why not just inject `localStorage` directly without a server call?

Tried that. It works for client-only state but the Review step also queries `/api/imports/{id}/...` on render to fetch buckets that are too large for `localStorage`. Without a server-side import job, the API call 404s and the screen renders empty. So we need both halves.

## Risk

- **Accidentally enabled in prod.** Mitigated by the `NODE_ENV` check + the env-gated mount + the header token.
- **Fixtures drift from production behavior.** Mitigated by reusing the same Mongoose models — if a field is added in the real importer, fixture validation fails on next test run.
- **Seed leaks state.** Each test's `afterEach` cleanup pairs with seed; cleanup is also called on the suite's global teardown to catch any orphans.

## Acceptance criteria

1. Setting `E2E_SEED_ENABLED=1 npm start` exposes `POST /api/test/seed`. Without the env var, the route 404s.
2. `seedFixture('wizard_review_minimal')` followed by login + navigate puts Playwright on the Review screen in < 5 seconds with 3+ visible cards.
3. `cleanupSeed(token)` removes the seeded self-study, import job, and user; no orphan records remain in MongoDB.
4. The existing `login.spec.ts` skipped test ("logs a coordinator in and lands them on the dashboard") un-skips and passes.
5. The Discard-button E2E ([[../discard_button.spec.ts|discard_button.spec.ts]]) is rewritten to use the seed endpoint and actually clicks Discard + asserts the card disappears.

## Engineering size

S. ~200 LOC server-side, ~80 LOC test helper, six fixture JSON files. Half a day.

## Related

- [[ai-import-wizard-e2e-regression-plan-2026-05-22]] — the full test plan that consumes this endpoint.
- [[cr-033-cv-supporting-evidence]] — CV regression tests need the `wizard_review_cv_smoke` fixture.
- [[../discard_button.spec.ts]] — first consumer.
