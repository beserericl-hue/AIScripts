---
name: AI Import Wizard — E2E Regression Plan
description: The complete Playwright-based regression suite for the AI Import Wizard. Covers every wizard step, every recovery path, every kind of card (Narrative / Evidence / Tag / File / Matrix / CV), the standalone-CV upload flow, and a deploy-verification protocol. Consumes the seed endpoint from CR-034. Replaces the ad-hoc "check the bundle string" pattern with a real regression gate.
type: test-plan
status: draft
priority: P0
source: User direction 2026-05-22 — "I also want you to plan the entire regression test E2E and add E2E seed endpoints so that you can do what is needed. The entire UI needs to be planned out."
tags: [testing, e2e, playwright, regression, ai-import, wizard]
last_reviewed: 2026-05-22
related:
  - "[[change-requests/cr-034-e2e-seed-endpoint]]"
  - "[[change-requests/cr-033-cv-supporting-evidence]]"
---

# AI Import Wizard — E2E Regression Plan

## Why this exists

Every coordinator-visible bug shipped in the last week (table flattening on + Add from source, Discard not visible, Document Reader rename, matrix rows leaking into Unplaced) would have been caught by a 30-second smoke E2E. We've been verifying changes by:

1. `git push` → tell the user "deployed"
2. User clicks around manually
3. User reports the bug

That's the wrong way around. This plan defines what a comprehensive Playwright suite looks like, what it costs to land, and the deploy-verification protocol that wraps every code change.

## Prerequisites (must land first)

- [[change-requests/cr-034-e2e-seed-endpoint]] — without seed, every test below has to drive a full upload-parse-match which is too slow and flaky.

Until CR-034 ships, the **deploy verification protocol** below (Section 7) is the only real check we have.

## 1. Test architecture

```
e2e/
├── playwright.config.ts          (exists)
├── helpers/
│   ├── auth.ts                   (exists — loginViaUI)
│   ├── seed.ts                   (NEW — seedFixture, cleanupSeed, loginAsSeeded)
│   ├── bundle.ts                 (NEW — scanBundleForMarker)
│   └── wizard.ts                 (NEW — gotoWizardStep helper)
└── tests/
    ├── 00_health.spec.ts         (exists — health.spec.ts renamed)
    ├── 01_login.spec.ts          (exists — login.spec.ts renamed)
    ├── 02_upload.spec.ts         (NEW)
    ├── 03_parse.spec.ts          (NEW)
    ├── 04_match.spec.ts          (NEW)
    ├── 05_matrix.spec.ts         (NEW)
    ├── 06_review_narratives.spec.ts (NEW)
    ├── 07_review_evidence.spec.ts   (NEW)
    ├── 08_review_tags.spec.ts       (NEW)
    ├── 09_review_files.spec.ts      (NEW)
    ├── 10_review_matrix.spec.ts     (NEW)
    ├── 11_review_cv.spec.ts         (NEW — depends on CR-033)
    ├── 12_review_add_from_source.spec.ts (NEW)
    ├── 13_review_edit_pencil.spec.ts     (NEW)
    ├── 14_review_discard.spec.ts         (NEW — replaces discard_button.spec.ts)
    ├── 15_review_unplaced.spec.ts        (NEW)
    ├── 16_apply.spec.ts                  (NEW)
    ├── 17_recovery_hard_refresh.spec.ts  (NEW)
    ├── 18_recovery_matcher_disconnect.spec.ts (NEW)
    ├── 19_recovery_step_back.spec.ts          (NEW)
    └── 20_standalone_cv_upload.spec.ts        (NEW — depends on CR-033)
```

Numbered prefix = run order; Playwright runs them alphabetically by default. Each test file is self-contained — uses `beforeEach` to seed + login, `afterEach` to cleanup.

## 2. Coverage by wizard step

### Step 1 — Upload (`02_upload.spec.ts`)

- ✓ Valid `.docx` → wizard advances to Parse
- ✓ `.pdf` upload surfaces a clear error message without crashing
- ✓ 30+ MB file shows a progress indicator
- ✓ Cancel mid-upload returns to a clean upload screen, no orphan import job
- ✓ Pick wrong degree, fix it, restart → no stale state across the restart
- ✓ Stale-error banner from a prior failed import does NOT survive a successful upload
- ✓ Upload disabled when no degree selected
- ✓ Re-entering wizard after a successful Apply → upload screen is reset, not stuck on Apply

### Step 2 — Parse (`03_parse.spec.ts`)

- ✓ All five stage labels appear with the friendly names ("Document Reader", "Reading structure", "Building chunks", "Embedding", "Indexing")
- ✓ NO raw stage names ("mammoth", "deep_walker") visible on screen
- ✓ Each stage shows a green check on completion
- ✓ Hard refresh during parse → returns to the same stage and continues
- ✓ Matcher-disconnect mid-parse auto-retries (no permanent error banner)
- ✓ Parse timing telemetry is emitted (asserted via dev-only debug endpoint)

### Step 3 — Match (`04_match.spec.ts`)

- ✓ Every paragraph from the source ends up in exactly one bucket (count check)
- ✓ Confidence colors render correctly (high=green, medium=amber, low=red)
- ✓ Low-confidence items appear in the Unplaced bucket
- ✓ No paragraph silently dropped — `parsed_count` == `bucketed_count + unplaced_count`
- ✓ Matcher disconnect mid-run shows a retry banner that auto-clears
- ✓ Reimport produces monotonic `byte_offset_start` values (CR-031 invariant)
- ✓ Show-in-source highlights the right span, not an adjacent matrix row (CR-031 longest-prefix invariant)

### Step 4 — Matrix (`05_matrix.spec.ts`)

- ✓ Inferred sub-spec chip ("Spec 12.b") shown on each row
- ✓ "Spec ?.?" only appears when the AI inference truly cannot decide
- ✓ Keep this row → row appears on the Review screen under the resolved subspec
- ✓ Remove this row → row vanishes from Review; restore from Removed section returns it
- ✓ Retag to a different subspec → Review screen reflects the change immediately
- ✓ Hard refresh mid-matrix → resumes on the same row position
- ✓ Sub-spec dropdown is searchable and shows only valid sub-specs for the standard the row belongs to

### Step 5 — Review (multiple specs)

#### 5a. Narratives (`06_review_narratives.spec.ts`)

- ✓ Narratives kind-section appears with correct count
- ✓ Cards render in `byte_offset_start` order
- ✓ Clicking a card selects it + populates the right preview pane
- ✓ Confidence band on left card stripe matches the underlying confidence
- ✓ Empty spec shows a "no items" affordance, not a broken card

#### 5b. Evidence Text (`07_review_evidence.spec.ts`)

- Same shape as narratives, plus:
- ✓ HTML-table evidence renders as a table (not flattened) per the CR's tableize-at-render-time invariant
- ✓ Evidence-text section heading differs from narratives ("Evidence" not "Narratives")

#### 5c. Tags (`08_review_tags.spec.ts`)

- ✓ Tag cards render with the AI-generated tag label
- ✓ Unplaced tag bucket exists separately and shows the CR-031 neighbor panel for low-confidence tags

#### 5d. Files (`09_review_files.spec.ts`)

- ✓ File rows render with filename + size + uploader
- ✓ Files have no Edit pencil (correct — Edit is for text only)
- ✓ Files have a Discard button (one-click removal)

#### 5e. Matrix rows in Review (`10_review_matrix.spec.ts`)

- ✓ Kept matrix rows appear under their resolved subspec
- ✓ Matrix-cell rendering keeps the table structure
- ✓ Restore from Removed section in the Matrix step updates Review without reload

#### 5f. CV Supporting Evidence (`11_review_cv.spec.ts`) — depends on CR-033

- ✓ CV kind-section appears with faculty count badge
- ✓ Each CV card shows the faculty name as title + first ~6 lines as preview
- ✓ Routing badge shows the source ("via Matrix row", "via Heading", "via Matcher")
- ✓ CV card has Edit (typo fix), Discard, Approve buttons
- ✓ Right pane shows full CV body + routing decision
- ✓ "Place this item as:" dropdown is hidden for CV items
- ✓ A self-study with zero CVs produces zero CV cards (no false positives)
- ✓ CVs never appear in Narratives or Evidence kind sections

#### 5g. + Add from Source (`12_review_add_from_source.spec.ts`)

- ✓ Button appears on every spec
- ✓ Clicking opens the source modal with the uploaded document pre-rendered
- ✓ Selecting tabular rows preserves table structure on the resulting card
- ✓ Selecting prose appears as a normal evidence card
- ✓ Confirming selection adds a new card with `kind: 'evidenceText'`
- ✓ Cancel returns to Review with no change
- ✓ Bare `<tr>` selection is wrapped in `<table>` (defense-in-depth invariant)

#### 5h. Edit Pencil — CR-032 (`13_review_edit_pencil.spec.ts`)

- ✓ Pencil appears on Narrative / Evidence-text / Tag cards
- ✓ Pencil does NOT appear on File cards
- ✓ Pencil is disabled (greyed) on cards with htmlSnippet containing a `<table>`
- ✓ Clicking pencil opens textarea in the right preview pane
- ✓ Save persists across hard refresh (the dirty-flag partialize invariant)
- ✓ Edited badge appears on the card after save
- ✓ Revert restores the original AI text
- ✓ Save → reload → text is the edited version

#### 5i. Discard — CR-033 button (`14_review_discard.spec.ts`)

- ✓ Discard button visible on every text-bearing card (Narrative / Evidence / Tag / CV)
- ✓ Discard button styled red (border + text)
- ✓ Clicking shows a confirm dialog with the card's displayLabel
- ✓ Confirming removes the card from the spec
- ✓ Cancel keeps the card
- ✓ Discarded card survives hard refresh (does not reappear)
- ✓ Discard via the new button takes the same path as the right-pane dropdown (no state divergence)

#### 5j. Unplaced bucket (`15_review_unplaced.spec.ts`)

- ✓ Unplaced section shows for low-confidence items in ANY bucket (CR-031 extended-coverage invariant)
- ✓ Nearest-placed-neighbor panel renders with spec context
- ✓ "Append to spec X.Y" one-click button works
- ✓ Unplaced items can be reassigned via the right-pane "Reassign to a different (Std, Spec)" dialog

### Step 6 — Apply (`16_apply.spec.ts`)

- ✓ Apply button is disabled until all items are either approved or discarded
- ✓ Clicking Apply lands on the Self-Study Editor with all spec content populated correctly
- ✓ Tables in the source survive Apply with structure intact
- ✓ Edited cards land with the edited text, not the AI's original
- ✓ Discarded cards are NOT present in the Self-Study Editor
- ✓ CVs (CR-033) appear as supporting-evidence files in the spec's Supporting File Library
- ✓ Re-entering the wizard after Apply starts on Step 1 with a clean slate

## 3. Recovery paths

### Hard refresh persistence (`17_recovery_hard_refresh.spec.ts`)

For each wizard step:

- Reach the step
- Make a deterministic change (edit a card, discard one, retag a matrix row)
- Force a hard refresh (`page.reload({ waitUntil: 'load' })`)
- Verify the change persisted

This is the single highest-value regression test in the suite. Every shipped CR has touched the persist layer.

### Matcher disconnect (`18_recovery_matcher_disconnect.spec.ts`)

- Seed a Match-step state
- Inject a fake fetch interceptor that returns 503 on the next 2 matcher calls
- Trigger the next match round
- Verify the retry banner appears + auto-clears + the round completes
- Verify no items lost to the disconnect

### Step-back regression (`19_recovery_step_back.spec.ts`) — CR-027 invariant

- Reach Review
- Navigate back to Upload
- Verify NO stale error banner from the prior parse appears
- Verify clicking forward to Review again still works (state survived)
- Re-upload a different file → fresh import, prior state cleanly replaced

## 4. Standalone CV upload (`20_standalone_cv_upload.spec.ts`) — depends on CR-033

- Upload a `.docx` containing ONLY a CV (no standards structure)
- Verify the wizard detects "CV-only" mode and skips Parse / Match / Matrix
- Verify the dedicated one-card screen appears with faculty name pre-filled
- Verify the spec dropdown defaults to the matrix-lookup result if a prior self-study exists
- Confirm → Review screen shows one CV card → Apply → file appears in the Supporting File Library

## 5. Cross-cutting

### Stage-label translation (`02_upload.spec.ts` + `03_parse.spec.ts`)

- ✓ The literal string "mammoth" never appears in any user-visible text
- ✓ Friendly labels per the `STAGE_LABELS` map in `ParseStep.tsx`

### Confidence / kind contract

- ✓ Every BucketItem has a `kind` that is one of the valid `ItemKind` values (no enum drift)
- ✓ Confidence values in `[0, 1]` (no overflow)
- ✓ `byte_offset_start` is monotonic within a single import (CR-031 invariant)

## 6. Fixtures contract

Lives in `server/src/test/fixtures/`. Each fixture name maps to a Playwright `seedFixture()` call. Adding a kind = adding a fixture, not a code change.

| Fixture | Wizard step | Card count | Purpose |
|---|---|---|---|
| `wizard_upload_clean` | Upload | 0 | Fresh-user start |
| `wizard_parse_running` | Parse | n/a | Mid-stage |
| `wizard_match_done` | Match | 50+ | Distribution across confidences |
| `wizard_matrix_pending` | Matrix | 3 rows | Subspec inference confirm |
| `wizard_review_minimal` | Review | 3N+1E+1F+2M+1U | The everyday case |
| `wizard_review_cv_smoke` | Review | + 2 CV | CR-033 coverage |
| `wizard_review_unplaced_heavy` | Review | 0N+5U | Low-confidence dominant |
| `wizard_apply_dryrun` | Apply | all approved | Apply-button enable |

`N` = Narrative, `E` = Evidence, `F` = File, `M` = Matrix row, `U` = Unplaced.

## 7. Deploy verification protocol (in effect immediately, before CR-034 lands)

After every push to `developer`:

1. **Poll commit status** until every service context returns `success`:
   ```bash
   gh api repos/beserericl-hue/AIScripts/commits/<SHA>/status \
     | jq -r '.statuses[] | "\(.context) -> \(.state)"'
   ```
2. **Verify bundle hash flipped:**
   ```bash
   curl -s https://cshse-develop.up.railway.app/self-study/ \
     | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js'
   ```
   The hash MUST be different from the pre-push hash.
3. **Verify marker string is in the served bundle:**
   ```bash
   curl -s https://cshse-develop.up.railway.app${BUNDLE} \
     | grep -c "<marker string unique to this change>"
   ```
4. **Run the relevant Playwright spec** with `--reporter=list`. For changes that touch the Review step, use [[../discard_button.spec.ts]] as the template.

Only after steps 1–4 are green is a change "deployed and verified."

Failure of step 1 means the build is still running. Failure of step 2 means Railway didn't redeploy. Failure of step 3 means the build cache served stale JS. Failure of step 4 means the change works in code but breaks at runtime.

## 8. CI integration (later)

Once the suite is stable (target: end of Sprint 4), add to GitHub Actions:

```yaml
- name: E2E regression
  run: |
    cd CSHSE/e2e && npm ci && \
      E2E_BASE_URL='https://cshse-develop.up.railway.app' \
      E2E_USER='${{ secrets.E2E_USER }}' \
      E2E_PASS='${{ secrets.E2E_PASS }}' \
      E2E_SEED_TOKEN='${{ secrets.E2E_SEED_TOKEN }}' \
      npm test
```

Runs on every push to `developer`. Fails the deploy if any spec fails. Artifacts (screenshots, videos, traces) uploaded to the run for triage.

## 9. Engineering size

- CR-034 seed endpoint: ~half a day
- Helper scaffolding (`seed.ts`, `bundle.ts`, `wizard.ts`): ~half a day
- The 19 new spec files: ~3–4 days at 1–2 hours each
- CI wiring: half a day
- **Total: ~5 days** spread across Sprint 4

## 10. Definition of done

- All specs in Section 1 exist and pass against the deployed `cshse-develop`
- The Discard-button spec converted from bundle-scan to real click-and-assert
- CR-034 endpoint mounted only when `E2E_SEED_ENABLED=1`
- Every shipped CR (031, 032, 033) has at least one spec exercising its core invariant
- A 30-second smoke subset (login + reach review + click discard + apply) runs as part of the deploy protocol
- This document updated with the running list of specs and their pass/fail history

## Related

- [[change-requests/cr-033-cv-supporting-evidence]]
- [[change-requests/cr-034-e2e-seed-endpoint]]
- [[change-requests/cr-031-unplaced-neighbor-context]]
- [[change-requests/cr-032-inline-edit-review-cards]]
- [[change-requests/cr-027-stale-error-on-wizard-step-back]]
