---
name: E2E Coverage Review — Pre Go-Live
description: Complete inventory of test coverage across the CSHSE codebase (E2E, unit, integration), gap analysis against the user-facing feature surface, the role matrix (Coordinator / Reader / Lead Reader / Admin), and a prioritized list of tests that must exist before go-live. Companion to the earlier regression plan; this one focuses on "what's actually testable today" and "what blocks our ability to test the rest."
type: review
status: draft
priority: P0
source: User direction 2026-05-22 — "do a review of the E2E testing and make sure that we have developed a suite of tests that can test all functionality in the system. This is required before go live."
tags: [review, testing, e2e, playwright, go-live]
last_reviewed: 2026-05-22
related:
  - "[[ai-import-wizard-e2e-regression-plan-2026-05-22]]"
  - "[[change-requests/cr-034-e2e-seed-endpoint]]"
  - "[[critical-error-processing-review-2026-05-22]]"
---

# E2E Coverage Review — Pre Go-Live

## Where we are today (the brutal honest version)

3 Playwright specs total. Of those:

| Spec | Status | What it actually exercises |
|---|---|---|
| `e2e/tests/health.spec.ts` | passes | Server `/api/health` returns 200 |
| `e2e/tests/login.spec.ts` | 1 passes, 1 SKIP | Login page renders + wrong-creds fails. The "lands on dashboard after login" test is skipped because there's no seeded test DB |
| `e2e/tests/discard_button.spec.ts` | passes | Logs in, reaches wizard, scans the loaded JS bundle for a marker string. Does NOT click Discard. Does NOT exercise any wizard behavior beyond reaching it. |

That's it. Three specs. One of them is a bundle string-grep masquerading as an E2E test.

For everything else — every wizard step, every card kind, every recovery path, every role beyond Program Coordinator, every Self-Study Editor feature, every Curriculum Matrix interaction, every reader workflow, every admin function — there is **zero end-to-end coverage**. We've been verifying every shipped CR by hand-clicking through the deployed UI. Today's demo proved that doesn't scale.

## What does exist (unit + integration)

Client unit tests:

- `client/src/store/authStore.test.ts` — Zustand auth store
- `client/src/store/aiImportStore.test.ts` — Zustand import store
- `client/src/services/api.test.ts` — fetch wrapper (2 tests SKIPPED — 401-handling assertions need refactor)
- `client/src/components/HelpChat.test.tsx` — chat widget
- `client/src/features/selfStudy/Editor/AIImport/review/tableizeHtml.test.ts` — CR-032 invariant

Server tests:

- `server/tests/unit/user-model.test.ts`
- `server/tests/unit/documentVersionService.test.ts`
- `server/tests/integration/auth-routes.test.ts`
- `server/tests/integration/program-courses.test.ts`
- `server/tests/integration/ai-import.test.ts`
- `server/tests/integration/webhook-callback-security.test.ts`

ai-service tests: gated by env vars; 4 currently skipped per earlier audit.

**What's good:** unit + integration on the server side cover the auth and webhook-security surface. The store unit tests catch state-machine regressions cheaply. The tableize unit test pins a known regression.

**What's missing:** anything that exercises the **integrated** flow as a coordinator experiences it. A passing unit test for `aiImportStore` doesn't tell us the Review screen renders correctly with real server data. A passing integration test for `/api/imports` doesn't tell us the wizard's polling fallback kicks in when SSE drops.

## What the system actually does (feature surface)

The full surface area that needs coverage before go-live:

### Pages (top-level routes)

| Route | Roles | Feature description |
|---|---|---|
| `/login` | all | Email + password login |
| `/` | coordinator, reader, lead-reader, admin | Dashboard — list of submissions, role-specific actions |
| `/self-study/:id` | coordinator (own), reader (assigned), lead-reader, admin | Self-Study Editor + AI Import Wizard entry |
| `/admin` | admin | User mgmt, institutions, system config |
| `/invitations/:token` | (unauthenticated) | Accept invite, create account |
| `/impersonate` | admin | Impersonation selector |

### Self-Study Editor sub-surfaces

| Tab | Description |
|---|---|
| Standards | Narrative editor per spec; TipTap rich editor |
| Curriculum Matrix | Structured matrix editor (this is what CR-035 is about) |
| Supporting File Library | File uploads per spec (CVs from CR-033 land here) |
| Import Document (Legacy) | Old per-standard importer (still required per CR-001) |
| Importer Wizard | AI wizard flow |
| Submit Self-Study for Review | Final-submit (CR-005 lockout) |

### AI Import Wizard steps

1. **Upload** — `.docx` (PDF fallback), degree level
2. **Parse** — Document Reader, Reading structure, Building chunks, Embedding, Indexing
3. **Match** — implicit (between Parse and Review)
4. **Matrix** — one row at a time (CR-029 redesign)
5. **Review** — spec rail + item cards by kind: Narratives, Evidence, Tags, Files, Matrix rows, CVs (post-CR-033), Unplaced
6. **Apply** — diff preview + commit

### Card actions on Review

- Select / Approve / Discard (CR-033) / Edit (CR-032) / Reassign / Show in source / + Add from source
- Per-card flag: kind, confidence, displayLabel, htmlSnippet, edited state, approved state

### Roles

- **Program Coordinator** — primary user. Creates + edits self-studies.
- **Reader** — read-only post-submission + comment.
- **Lead Reader** — Reader + escalate disagreements.
- **Admin** — everything + impersonate.

### Cross-cutting

- HMAC webhook validation (covered by unit test).
- SSE streaming + polling fallback.
- File upload / GridFS persistence.
- Hard-refresh persistence via Zustand `persist` + dirty flag.

## Blockers — without these, no real E2E is possible

### Blocker 1 — Seed endpoint (CR-034)

Until [[change-requests/cr-034-e2e-seed-endpoint]] ships, every test that needs to reach Parse / Match / Matrix / Review / Apply has to drive a full upload + 60s of AI processing. That's:

- Too slow (a 30-spec suite would take 30+ minutes wall-clock)
- Too flaky (Anthropic / OpenAI rate-limit hiccups, network blips)
- Too non-deterministic (matcher output varies run to run)

Status: CR-034 is proposed. Implementation is the highest-leverage E2E unlock available. See "Implementation in this branch" below.

### Blocker 2 — Test accounts

The codebase ships placeholder constants:

```ts
// e2e/helpers/auth.ts
export const TEST_USERS = {
  coordinator: { email: 'coord@example.test', password: 'Coordinator-Password-1' },
  reader:      { email: 'reader@example.test', password: 'Reader-Password-1' },
  admin:       { email: 'admin@example.test',  password: 'Admin-Password-1' },
};
```

These accounts don't exist in the deployed database. The seed endpoint (CR-034) can create them on demand per-test, OR we provision them once at deploy time. Either works.

### Blocker 3 — Test self-study + .docx fixtures

For genuine upload tests we need a small (under 100KB) representative `.docx` checked into the repo and used by `02_upload.spec.ts`. Today there's no such fixture.

### Blocker 4 — Ability to mock external services during E2E

For CR-036 retry behavior, CR-037 empty-bucket guard, and matcher-disconnect recovery tests, we need to inject failures into ai-service responses. Options:

- Run a local mock ai-service in E2E mode (recommended)
- Add a `?fail-mode=...` query param to ai-service endpoints (gated by `E2E_SEED_ENABLED=1`) that synthesizes specific failure modes

Either is small.

### Blocker 5 — Production-like test environment

Today E2E runs against `cshse-develop` shared with active development. Two problems:

- Tests can collide with the user's manual testing.
- Tests can be confused by deploys mid-run.

For pre-go-live: stand up a dedicated `cshse-e2e.up.railway.app` environment with its own ai-service, its own MongoDB. CI runs E2E against it. Devs don't touch it.

## Minimum E2E coverage required for go-live

The bar is "every shipped CR has at least one spec exercising its invariant, plus every recovery path has a spec, plus role-permission boundaries are asserted."

### Tier 1 — Bullet-proofing the importer (P0, before go-live)

| Spec | Covers | Depends on |
|---|---|---|
| `02_upload.spec.ts` | Valid `.docx`, `.pdf` rejection, large file progress, cancel, degree selection, stale-error cleanup | Test fixture .docx, CR-034 |
| `03_parse.spec.ts` | Friendly stage labels (no raw "mammoth"), 5 stages tick green, polling fallback when SSE blocked, hard-refresh resume | CR-034 |
| `04_match.spec.ts` | Bucket counts, confidence colors, no-paragraph-dropped invariant, monotonic byte offsets (CR-031) | CR-034 |
| `05_matrix.spec.ts` | Subspec inference, "Spec ?.?" only when truly unknown, Keep/Remove/Retag/Restore, hard-refresh persistence | CR-034 |
| `10_review_matrix.spec.ts` | Kept rows surface on Review, table structure preserved, restore from Removed | CR-034 |
| `13_review_edit_pencil.spec.ts` | CR-032 edit + Save + Revert + hard-refresh persistence + table-disabled state | CR-034 |
| `14_review_discard.spec.ts` | CR-033 button visible, red styling, confirm + remove, hard-refresh persistence (REWRITE of existing bundle-scan spec) | CR-034 |
| `15_review_unplaced.spec.ts` | CR-031 neighbor panel for low-confidence items in any spec, "Append to spec X.Y" | CR-034 |
| `16_apply.spec.ts` | Apply disabled until all items approved/discarded, content lands in editor, tables survive, discarded absent | CR-034, fixtures |
| `17_recovery_hard_refresh.spec.ts` | For each step: change → refresh → persisted | CR-034 |
| `18_recovery_matcher_disconnect.spec.ts` | Inject 503 on matcher call, retry banner, auto-clear, completion | CR-034, mock |
| `19_recovery_step_back.spec.ts` | CR-027 — back to Upload, no stale error, forward still works | CR-034 |
| `21_empty_buckets_guard.spec.ts` | CR-037 — three defenses against silent empty success | CR-034, mock |
| `22_handshake_retries.spec.ts` | CR-036 — yellow banner during retries, success on second attempt, exhausted retries shows red | CR-034, mock |

That's **14 P0 specs**, all depending on CR-034. Estimate: ~1.5 hours each once the seed endpoint exists = ~3 days.

### Tier 2 — Per-card-kind coverage (P0)

| Spec | Covers |
|---|---|
| `06_review_narratives.spec.ts` | Card order by byte offset, selection populates preview, confidence band |
| `07_review_evidence.spec.ts` | HTML tables render structured (not flattened), evidence-vs-narrative distinction |
| `08_review_tags.spec.ts` | Tag labels render, unplaced-tag panel works |
| `09_review_files.spec.ts` | File rows show filename + size, no Edit pencil, Discard works |
| `12_review_add_from_source.spec.ts` | Modal pre-renders, tabular selection preserves table, prose adds as evidence, bare `<tr>` wrapped (defense in depth) |

Another **5 specs**. Estimate: ~1 hour each = half a day.

### Tier 3 — CR-033 CV coverage (P1, ships with CR-033)

| Spec | Covers |
|---|---|
| `11_review_cv.spec.ts` | CV kind section, faculty name as title, routing badge, edit/discard/approve, no false positives |
| `20_standalone_cv_upload.spec.ts` | CV-only doc skips Parse/Match/Matrix, lands on one-card screen, spec dropdown defaults correctly |

**2 specs**, ship with CR-033 not independently.

### Tier 4 — Role + permission boundaries (P0)

| Spec | Covers |
|---|---|
| `30_role_coordinator.spec.ts` | Coordinator sees own self-studies, cannot see others' |
| `31_role_reader.spec.ts` | Reader sees assigned submissions only, read-only, can comment |
| `32_role_lead_reader.spec.ts` | Lead reader can escalate, comment, sees escalation queue |
| `33_role_admin.spec.ts` | Admin sees all institutions, can impersonate, can manage users |
| `34_role_no_cross_institution.spec.ts` | CR-017 — coordinator at Institution A cannot read Institution B's data |

**5 specs**. Estimate: 1 hour each = half a day.

### Tier 5 — Self-Study Editor (not wizard) (P1)

| Spec | Covers |
|---|---|
| `40_editor_narrative.spec.ts` | TipTap edit + save + restore on reload |
| `41_editor_evidence.spec.ts` | Inline evidence + comment threading |
| `42_editor_curriculum_matrix.spec.ts` | Matrix cell edit, CR-035 round-trip from wizard |
| `43_editor_file_library.spec.ts` | Upload file, view, download |
| `44_editor_submit_lock.spec.ts` | CR-005 — read-only after final submit |

**5 specs**. Estimate: 1.5 hours each = ~1 day.

### Tier 6 — Smoke / health (already exists, expand)

| Spec | Covers |
|---|---|
| `00_health.spec.ts` | Server health, ai-service health (new check), MongoDB connection, Qdrant reachable |
| `01_login.spec.ts` | Login renders, wrong creds, correct creds → dashboard (currently skipped, un-skip after seed) |

Estimate: 30 minutes.

## Total estimate to "ready for go-live"

| Tier | Specs | Days |
|---|---|---|
| 1 — Bullet-proof importer | 14 | 3.0 |
| 2 — Per-card kind | 5 | 0.5 |
| 4 — Roles | 5 | 0.5 |
| 5 — Editor | 5 | 1.0 |
| 6 — Smoke | 2 | 0.05 |
| **Subtotal P0** | **31 specs** | **~5 days** |
| 3 — CV (with CR-033) | 2 | 0.25 |
| **Plus CR-034 implementation** | — | 0.5 |
| **TOTAL** | **33** | **~6 days** |

## CI integration (after specs land)

Add to `.github/workflows/ci.yml`:

```yaml
- name: E2E Smoke (10 min cap)
  if: always()
  run: |
    cd CSHSE/e2e
    npm ci
    npm test -- --grep "smoke" --reporter=list --timeout=600000
  env:
    E2E_BASE_URL: https://cshse-e2e.up.railway.app
    E2E_USER: ${{ secrets.E2E_USER }}
    E2E_PASS: ${{ secrets.E2E_PASS }}
    E2E_SEED_TOKEN: ${{ secrets.E2E_SEED_TOKEN }}

- name: E2E Full (run on schedule + on developer push)
  if: github.ref == 'refs/heads/developer'
  run: |
    cd CSHSE/e2e && npm ci && npm test
```

Smoke = `00_health`, `01_login`, `14_review_discard`, `17_recovery_hard_refresh`. Runs on every PR.

Full = everything. Runs nightly + on every push to `developer`.

## Implementation in this branch (`feature/e2e-seed-bulletproof`)

This review is paired with an implementation that lands TODAY (on this feature branch, NOT pushed to `developer`):

- `server/src/routes/test.ts` — CR-034 seed endpoint.
- `server/src/test/fixtures/wizard_review_minimal.json` + companions — seed fixtures.
- `e2e/helpers/seed.ts` — `seedFixture()` + `cleanupSeed()` + `loginAsSeeded()`.
- `e2e/helpers/bundle.ts` — bundle-string scanner extracted from the discard spec.
- `e2e/tests/14_review_discard.spec.ts` — rewrite of discard_button.spec.ts that actually clicks Discard.
- `e2e/tests/00_health.spec.ts` — expanded smoke.
- `e2e/tests/17_recovery_hard_refresh.spec.ts` — first recovery-path spec.

When you (Eric) approve, merge to `developer` triggers cshse-server redeploy with `E2E_SEED_ENABLED=1` set in Railway env, and the suite runs green.

The remaining 26 P0 specs are scaffolded as TODO-marked stubs so the structure is in place; each one takes ~1h to flesh out.

## Definition of done for "E2E ready for go-live"

- [ ] CR-034 seed endpoint deployed.
- [ ] All Tier 1 specs (14) green.
- [ ] All Tier 2 specs (5) green.
- [ ] All Tier 4 specs (5) green.
- [ ] All Tier 6 specs (2) green.
- [ ] Smoke suite runs in under 5 minutes and is in CI.
- [ ] Full suite runs in under 30 minutes nightly + on developer push.
- [ ] Test environment (`cshse-e2e.up.railway.app`) provisioned separately from `cshse-develop`.
- [ ] A failing spec blocks the deploy (configurable per-spec via flake bucket).

## Related

- [[ai-import-wizard-e2e-regression-plan-2026-05-22]] — the earlier, more abstract plan.
- [[change-requests/cr-034-e2e-seed-endpoint]] — blocking dependency.
- [[critical-error-processing-review-2026-05-22]] — companion review for error handling.
