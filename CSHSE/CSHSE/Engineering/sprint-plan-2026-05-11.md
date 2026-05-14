---
name: Sprint Plan — 2026-05-11
description: Seven-sprint roadmap (~14 weeks) that closes every gap surfaced in [[incomplete-features-2026-05-11]], [[security-audit-2026-05-10]], and the new user-requested additions in [[product-requirements#user-requested-additions-post-handbook-2026-05-11]]. Structured for direct Claude-Code consumption — each story has file paths, line citations, acceptance criteria, and a unit / system / E2E test plan.
type: plan
tags: [sprint-plan, roadmap, claude-code, executable]
plan_date: 2026-05-11
horizon: ~14 weeks (7 × 2-week sprints)
status: proposed
supersedes: sprint-plan-2026-05-10
last_reviewed: 2026-05-11
---

# Sprint Plan — 2026-05-11

**Supersedes [[sprint-plan-2026-05-10]].** Re-prioritised against the product-requirements audit ([[incomplete-features-2026-05-11]]) which surfaced Handbook-compliance gaps not in the prior plan. Originally compressed 8 → 6 sprints; expanded to 7 on 2026-05-11 to add the user-requested multi-PC support (S2.10) and Joint Venture grouping (Sprint 7). On 2026-05-14 S4.10 was added for the reader-report DOCX export (U4). All user-requested additions live in [[product-requirements#user-requested-additions-post-handbook-2026-05-11]].

> **For Claude Code:** Each story is self-contained. Read the linked wiki concept page first for context, then make the listed code changes, then ensure the acceptance criteria pass. Stories are ordered within each sprint by dependency.

## How to read this plan

Each story has the same shape:

```
### S{sprint}.{n} — Title
**Source:** [[wiki-page#anchor]] — what audit/feature this fixes
**Context:** [[concept-page]] — read before touching code
**Files:**
  - `path/to/file.ts:start-end` — what to change
**Steps:**
  1. Concrete instruction
  2. Concrete instruction
**Acceptance:**
  - [ ] Verifiable outcome
**Test plan:**
  - **Unit:** isolated function/component, mocked deps, fast (Vitest in `server/tests/unit/` or `client/src/**/*.test.tsx`)
  - **System / integration:** full HTTP route or fully-wired component with real DB / MSW (Vitest in `server/tests/integration/` or `client/src/**/*.test.tsx`)
  - **E2E:** Playwright in `e2e/tests/` — user-visible browser behavior
**Estimate:** N days
**Blocks:** S{x}.{y} (downstream stories this enables)
```

### Test plan conventions

- **All three layers required** for every story unless explicitly marked `N/A` with a reason (pure server-side cron with no UI surface → no E2E; pure-styling change → no system test; etc.).
- **E2E coverage rolls up where possible.** Most stories link to an S6 journey (S6.4) rather than adding a new spec — bloating the E2E suite past ~5 min runtime causes flakiness. When a story needs a dedicated E2E (auth, security boundaries) it's spelled out.
- **Server stack:** Vitest + supertest + `mongodb-memory-server` (setup in [server/tests/setup.ts](../../../../server/tests/setup.ts)).
- **Client stack:** Vitest + React Testing Library + MSW + jsdom (setup in [client/src/test/setup.ts](../../../../client/src/test/setup.ts)).
- **E2E stack:** Playwright at repo root in [e2e/](../../../../e2e/).
- **Definition of done for a story:** all three layers' tests pass in CI; concept page touched if applicable; PR description links the story.
- **Coverage ratchet:** S5 establishes the baseline; no PR after S5 may drop line coverage by more than 0.5%.

Wiki concept pages are durable; review pages and the audit table inside them are dated snapshots. When in doubt, **the code wins** — verify against `path:line` and surface drift back to the wiki.

## Working assumptions

- 1 full-time engineer or equivalent (halve estimates for 2 engineers on independent stories).
- 2-week sprints, ~7 working days each after meetings.
- "Done" = code merged + tests passing + concept page updated (per [[CLAUDE]] schema).
- Each sprint has a hard goal; slipping it triggers a re-plan, not silent drift.

## Sprint roster — at a glance

| # | Theme | Primary outcome | Sources |
|---|-------|-----------------|---------|
| 1 | Compliance + critical security | Handbook-rule violations closed; all 6 audit Criticals fixed | [[incomplete-features-2026-05-11]] H1–H4; [[security-audit-2026-05-10]] C1–C5 |
| 2 | Auth hardening + input validation + multi-PC support | All Highs + key Mediums closed; safe auth surface; multi-PC per institution live (foundational for all downstream RBAC) | [[security-audit-2026-05-10]] H1–H7, M2, M5; [[product-requirements#u1-multiple-program-coordinators-per-institution]] |
| 3 | Evidence AI review (server + n8n) + emails (env config + wire-up) + reader deadlines | New AI pipeline operational; env-driven SMTP / sender / domain config; every workflow email wired; 45-day reader timer ticking | [[evidence-document-review-pipeline]]; [[incomplete-features-2026-05-11]] T2.1, T2.3, T2.7 |
| 4 | Evidence review UI + template-driven matrix editor + multi-matrix + reader-report DOCX export | Evidence pills in 3 surfaces; matrix backend finally has a template-driven client with multi-instance support; reader generates a DOCX report from CSHSE template on review-complete, auto-uploaded to S3 for Lead Reader pickup | [[incomplete-features-2026-05-11]] T1.2, T1.3, T2.1 (UI half); [[product-requirements#u3-template-driven-curriculum-matrices-with-multi-matrix-per-submission]]; [[product-requirements#u4-reader-report-template-based-docx-export]] |
| 5 | Common-error checks + completion checklist + tests | Pre-submit gate; mechanizable Handbook checks live; test coverage ≥60/50% | [[incomplete-features-2026-05-11]] T2.2, T2.4 |
| 6 | Board decisions, cycle scheduler, E2E, polish | Post-decision flow; cycle reminders; full E2E journeys; ops runbooks | [[incomplete-features-2026-05-11]] T2.6, T3.x; [[documentation-gaps-2026-05-10]] |
| 7 | Joint Ventures (multi-institution organization) | JV entity + admin UI + dashboard grouping + reporting filter; **no permission changes** | [[product-requirements#u2-joint-ventures-institution-grouping]] |

---

# SPRINT 1 — Compliance & Critical Security (2 weeks)

**Goal:** Close every Handbook-rule violation ([[incomplete-features-2026-05-11|H1–H4]]) and every Critical from [[security-audit-2026-05-10|C1–C5]]. **Nothing else ships in front of these.** The portal cannot accept real submissions until S1 is done.

**Prerequisites:** Access to the production n8n instance (for key rotation + workflow updates).

## S1.1 — Reader-identity redaction in comments

**Source:** [[incomplete-features-2026-05-11#h1]] — Handbook compliance violation: reader names + roles leak to Program Coordinators.

**Context:** [[client-features-deep-2026-05-10|comments feature]], [[product-requirements#hard-requirements]].

**Files:**
- `server/src/controllers/commentController.ts:181-192` — `createComment` persists `authorName: req.user!.name`. Keep this for the database, but resolve the display name at READ time.
- `server/src/controllers/commentController.ts` (all GET handlers — line refs in the file via `grep "Comment.find"`)— wrap response in a role-aware mapper.
- `server/src/models/Comment.ts` — add helper `getDisplayName(viewerRole, viewerId)` that returns:
  - To `program-coordinator`: `"Reader 1"` / `"Reader 2"` / `"Lead Reader"` (stable per submission via a deterministic hash of `authorId + submissionId`).
  - To `reader`, `lead_reader`, `admin`: the real `authorName`.
- `client/src/features/comments/CommentSidebar.tsx` — already trusts the server response; no change needed if mapping happens server-side.

**Steps:**
1. Add `displayName(viewerRole, viewerId)` helper to `Comment` model.
2. Build a `reader → "Reader N"` deterministic resolver keyed by `(submissionId, authorId)`. Cache the mapping per submission in memory or via a small lookup collection so the same reader gets the same number across all of one submission's comments.
3. Update every comment GET handler to call the resolver before sending the response.
4. Same treatment for `LeadReaderCompilation` comment threads ([leadReaderController.ts](../../../../server/src/controllers/leadReaderController.ts) endpoints `createCommentThread / addThreadMessage`).

**Acceptance:**
- [ ] PC viewing comments sees `"Reader 1"` / `"Reader 2"` / `"Lead Reader"`, never a real name.
- [ ] Same reader on the same submission gets the same number across all their comments.
- [ ] Reader / Lead Reader / Admin views still see real names.
- [ ] Existing comment data unchanged — redaction is at-read, not at-write.

**Test plan:**
- **Unit:** `server/tests/unit/comment-display-name.test.ts` — `Comment.getDisplayName(viewerRole, viewerId)` table-driven: 4 viewer roles × 2 author roles → 8 expected strings. Pure function, no DB.
- **System / integration:** `server/tests/integration/comment-redaction.test.ts` — supertest: a PC token reads comments on a submission with 2 reader-authored + 1 lead-reader-authored comment; assert response shows `"Reader 1"`/`"Reader 2"`/`"Lead Reader"`. Same fixture, lead-reader token → assert real names appear.
- **System / integration:** `server/tests/integration/comment-redaction-stability.test.ts` — assert the same reader gets the same number across multiple comments on one submission (deterministic), but a different number on a different submission.
- **E2E:** covered by S6.4 coordinator + reviewer journeys (assert PC view of a reader comment shows "Reader 1" and never the real name from the seed fixture).

**Estimate:** 2 days. **Blocks:** none (independent).

---

## S1.2 — Superuser impersonation audit log

**Source:** [[incomplete-features-2026-05-11#h2]] (compliance); [[security-audit-2026-05-10|L3]].

**Context:** [[system-architecture#auth-model]].

**Files:**
- `server/src/models/ImpersonationAudit.ts` — NEW. Fields: `superuserId, originalRole, impersonatedRole, impersonatedUserId?, startedAt, endedAt?, ipAddress, userAgent`. Indexes: `(superuserId, startedAt desc)`, `(impersonatedUserId, startedAt desc)`.
- `server/src/middleware/auth.ts:59-63` — when `X-Impersonated-Role` is honored, append a row.
- `server/src/controllers/userController.ts` — new GET `/api/admin/impersonation-audit` (admin-only, paginated, defaults to last 100).
- `server/src/routes/admin.ts` — mount the new endpoint.
- `client/src/features/admin/Settings/` — new `ImpersonationAuditPage.tsx` panel; add tab to [SettingsPage.tsx](../../../../client/src/features/admin/Settings/SettingsPage.tsx).

**Steps:**
1. Create the model + index.
2. Wire the append on impersonation header acceptance. Use a "session" record: write on start, update with `endedAt` when the same `superuserId` sends a no-impersonation request.
3. Build the admin UI panel (list view, filter by superuser / target).

**Acceptance:**
- [ ] Every impersonation request creates / updates an audit row.
- [ ] Admin can view + filter the log.
- [ ] Log cannot be deleted via the UI; only via direct DB write.

**Test plan:**
- **Unit:** `server/tests/unit/impersonation-audit-model.test.ts` — schema validation: required fields rejected when missing; TTL/index presence.
- **System / integration:** `server/tests/integration/impersonation-audit-write.test.ts` — supertest fires 3 impersonation requests with different `X-Impersonated-Role` values, asserts 3 rows in `ImpersonationAudit` with correct `startedAt`/`endedAt` chains. Also asserts non-admin GET on `/api/admin/impersonation-audit` returns 403.
- **System / integration:** `client/src/features/admin/Settings/ImpersonationAuditPage.test.tsx` — RTL with MSW: page renders rows, filter by superuserId works.
- **E2E:** covered by S6.4 admin journey (impersonate-then-check-audit step).

**Estimate:** 1.5 days. **Blocks:** none.

---

## S1.3 — URL accessibility probe + password-protected-link detection

**Source:** [[incomplete-features-2026-05-11#h3]] — Handbook hyperlink rule.

**Context:** [[evidence-file-storage]].

**Files:**
- `server/src/services/urlProbe.ts` — NEW. Single function `probeUrl(href): Promise<{ ok: boolean; status: number; redirectsToLogin: boolean }>`. Use `axios.head` with 10s timeout, follow redirects, detect login-page redirects via final URL containing `/login` / `/signin` / `/auth` or final hostname mismatch with original.
- `server/src/controllers/evidenceController.ts:466` — replace `isAccessible: true` hardcode with `const probe = await probeUrl(url); { isAccessible: probe.ok && !probe.redirectsToLogin, lastVerified: new Date() }`.
- `server/src/controllers/evidenceController.ts` — also patch the URL-update endpoint to re-probe on change.
- `server/src/services/cronJobs.ts` — NEW (or extend existing) — nightly re-probe of every URL evidence; bump `lastVerified` and toggle `isAccessible`.
- `client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx`, `EvidencePanel.tsx`, `FileLibrary.tsx` — show red badge when `url.isAccessible === false` or `url.lastVerified` is >30 days stale.

**Acceptance:**
- [ ] Adding a 404 URL marks `isAccessible: false`.
- [ ] Adding a Google-Drive-private link (redirects to accounts.google.com login) marks `isAccessible: false` AND surfaces a tooltip "appears password-protected."
- [ ] Nightly cron flips `isAccessible` on a previously-working link that breaks.
- [ ] UI shows red badge on broken links.

**Test plan:**
- **Unit:** `server/tests/unit/urlProbe.test.ts` — nock-mocked HTTP responses across the matrix: 200 → ok; 404 → not ok; 301→/login → `redirectsToLogin: true`; timeout → not ok; SSL error → not ok.
- **System / integration:** `server/tests/integration/evidence-url-add.test.ts` — POST `/api/submissions/:id/evidence/url` with a stubbed `urlProbe` returning each scenario; assert `isAccessible` and `lastVerified` persist correctly to MongoDB.
- **System / integration:** `server/tests/integration/cron-url-reprobe.test.ts` — frozen-time test: seed 3 URL evidence rows with old `lastVerified`, run the cron job, assert all 3 reprobed and `lastVerified` bumped.
- **System / integration:** `client/src/features/selfStudy/EvidenceManager/EvidenceManager.test.tsx` (extend) — red badge renders when `url.isAccessible === false`; tooltip on password-protected.
- **E2E:** covered by S6.4 coordinator journey (add a URL evidence, assert the badge appears for a known-broken seed URL).

**Estimate:** 2 days. **Blocks:** S5.3 (broken-link admin page).

---

## S1.4 — PDF preference enforcement on upload (soft-block)

**Source:** [[incomplete-features-2026-05-11#h4]].

**Context:** [[evidence-file-storage]].

**Files:**
- `client/src/features/selfStudy/EvidenceManager/FileUpload.tsx` — on non-PDF selection, show a confirm modal: "PDF is strongly preferred — continue with .docx anyway?" with primary CTA "Convert to PDF" (disabled for now — back-end half) and secondary "Continue anyway" + "Cancel."
- `client/src/features/selfStudy/Editor/EvidencePanel.tsx` and `FileLibrary.tsx` — same modal pattern.
- `server/src/controllers/evidenceController.ts` upload handler — store `preferredFormat: 'pdf' | 'other'` on `SupportingEvidence.file` so reviewer can filter.

**Steps:**
1. Soft-block modal (no server-side block).
2. Add a per-submission report at submit time listing non-PDF evidence count (input to S5 completion checklist).
3. Conversion path is **deferred** (libreoffice via Docker) — wire the button to call a placeholder `POST /api/evidence/:id/convert-to-pdf` that returns 501 with a "coming soon" message. Schedule in S6.

**Acceptance:**
- [ ] Selecting a `.docx` shows the soft-block modal in all 3 upload UIs.
- [ ] "Continue anyway" still works.
- [ ] Submission report shows count of non-PDF evidence.

**Test plan:**
- **Unit:** N/A — pure UX wiring, no isolated logic worth unit-testing.
- **System / integration:** `client/src/features/selfStudy/EvidenceManager/FileUpload.test.tsx`, `client/src/features/selfStudy/Editor/EvidencePanel.test.tsx`, `client/src/features/selfStudy/FileLibrary/FileLibrary.test.tsx` — RTL: select a `.docx` File object, assert soft-block modal appears; "Continue anyway" closes the modal and upload proceeds; "Convert to PDF" triggers `POST /api/evidence/:id/convert-to-pdf` and gets 501.
- **System / integration:** `server/tests/integration/evidence-preferred-format.test.ts` — after upload, assert `SupportingEvidence.file.preferredFormat` is set to `'pdf'` vs `'other'` correctly.
- **E2E:** covered by S6.4 coordinator journey (upload one PDF + one DOCX; assert the DOCX triggers the modal).

**Estimate:** 1 day. **Blocks:** S6.5 (conversion endpoint).

---

## S1.5 — Rotate the leaked n8n API key + add secret-scanning

**Source:** [[security-audit-2026-05-10|C1]].

**Files:**
- `n8n-workflows/cshse-specification-loader-pdf.json:102` — currently `"X-API-Key": "cshse_eXPTLboS18Gjgw_BTwEVJhe8CBiAjq9B"`. Move to n8n Credentials.
- `.git/hooks/pre-commit` (or `.husky/pre-commit`) — install gitleaks: `gitleaks protect --staged --no-banner`.
- `package.json` — add `gitleaks` to dev deps if practical, else document install.
- `Readme.md` — add "Rotating secrets" section.

**Steps:**
1. Rotate the key in the production n8n instance.
2. Update the workflow JSON to reference an n8n Credential rather than the literal key.
3. Add gitleaks pre-commit hook.
4. Sanity-scan the whole repo: `gitleaks detect`. Document any other historical exposures.

**Acceptance:**
- [ ] The literal `cshse_eXPT...` does not appear in any file or git history reachable from current branches.
- [ ] `git commit` with a new key-pattern in any staged file fails.
- [ ] N8N workflows still function with the rotated credential.

**Test plan:**
- **Unit:** N/A — infra change, not application logic.
- **System / integration:** CI step that runs `gitleaks detect --no-banner --no-git --exit-code 1` on the full source tree; build fails on any hit. Add a fixture test that introduces a fake key in a test branch and asserts the hook rejects.
- **E2E:** manual smoke after rotation — fire one spec-loader-callback call against staging n8n, assert 200 (proves the rotated credential works).

**Estimate:** 0.5 days. **Blocks:** none.

---

## S1.6 — Refuse to boot in production without `JWT_SECRET`

**Source:** [[security-audit-2026-05-10|C3]].

**Files:**
- `server/src/config/auth.ts` — NEW. Reads `process.env.JWT_SECRET`. In `NODE_ENV=production`, throws if unset or `< 32` bytes. Exports `getJwtSecret()`.
- All `process.env.JWT_SECRET || 'development-secret-key'` call sites — search-replace with `import { getJwtSecret } from '../config/auth'; ... getJwtSecret()`. Known sites (grep for the literal):
  - `server/src/middleware/auth.ts:45`
  - `server/src/routes/auth.ts:57`
  - `server/src/controllers/fileController.ts:44`
  - (any others — grep for `'development-secret-key'`)

**Acceptance:**
- [ ] `'development-secret-key'` literal does not appear anywhere in the repo.
- [ ] `NODE_ENV=production npm start` with no `JWT_SECRET` exits non-zero immediately.
- [ ] Local `NODE_ENV=development` still works with a fallback.

**Test plan:**
- **Unit:** `server/tests/unit/config-auth-boot-guard.test.ts` — `getJwtSecret()` throws when `NODE_ENV=production` + `JWT_SECRET` unset; throws when set but `< 32` bytes; returns the secret when valid; returns a dev fallback in `NODE_ENV=development`.
- **System / integration:** `server/tests/integration/boot-guard.test.ts` — spawn a child process with `NODE_ENV=production` and no `JWT_SECRET`, assert exit code is non-zero and stderr contains a recognizable error message.
- **E2E:** N/A — boot-time concern; not visible in browser.

**Estimate:** 0.5 days. **Blocks:** S2.x (other security work assumes the secret is real).

---

## S1.7 — HMAC-sign webhook callbacks + reject duplicate `executionId`

**Source:** [[security-audit-2026-05-10|C2]], [[security-audit-2026-05-10|M7]], [[security-audit-2026-05-10|M8]] (partial).

**Context:** [[n8n-integration]].

**Files:**
- `server/src/middleware/webhookAuth.ts` — NEW. `verifyHmac(req, res, next)`:
  - Reads `X-Signature` header.
  - Recomputes `hmacSha256(WebhookSettings.callbackSecret, rawBody)`.
  - Compares via `crypto.timingSafeEqual`.
  - Looks up `WebhookCallback` table by `executionId`; if exists, 409; else inserts.
- `server/src/models/WebhookSettings.ts` — add `callbackSecret: string` (encrypted at rest).
- `server/src/models/WebhookCallback.ts` — NEW. `{ executionId (unique), settingType, receivedAt }`. TTL index to expire after 7 days.
- `server/src/routes/webhooks.ts:36,43,50,57` — apply `verifyHmac` middleware before each callback handler.
- `n8n-workflows/*.json` — every callback HTTP node: add `X-Signature: {{ $crypto.hmac('sha256', body, $env.CALLBACK_SECRET) }}` header.
- `server/tests/integration/webhook-callback-security.test.ts` — **invert** the existing regression-guard assertions: now expect 401 on unsigned, 409 on duplicate `executionId`, 200 on valid signed callback.

**Acceptance:**
- [ ] All 4 callback endpoints reject unsigned POSTs with 401.
- [ ] Duplicate `executionId` returns 409 (idempotent retries safe).
- [ ] Valid signed callback works end-to-end with n8n.
- [ ] Test file is inverted and passing.

**Test plan:**
- **Unit:** `server/tests/unit/webhookAuth.test.ts` — `verifyHmac` middleware: valid signature passes; tampered body fails; wrong-key fails; missing `X-Signature` returns 401. Use `crypto.timingSafeEqual` correctly (no early-return on length mismatch).
- **Unit:** `server/tests/unit/webhook-callback-dedup.test.ts` — second insert with same `executionId` triggers the unique-index error path; 409 returned.
- **System / integration:** `server/tests/integration/webhook-callback-security.test.ts` — **invert** the existing file's regression-guard assertions. New shape: unsigned POST → 401; signed-but-tampered POST → 401; valid signed POST → 200; replay of same `executionId` → 409. All four callback endpoints covered.
- **E2E:** N/A — server-to-server contract; no browser surface. Stand-in: a manual smoke test fires a real n8n callback against staging and confirms 200 + correct DB write.

**Estimate:** 2.5 days. **Blocks:** S3.3 (evidence-review callback inherits this pattern).

---

## S1.8 — CORS allow-list + helmet defaults

**Source:** [[security-audit-2026-05-10|C4]], [[security-audit-2026-05-10|M3]].

**Files:**
- `server/src/index.ts:50` — `app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false, credentials: true }))`.
- `server/src/index.ts` — add `import helmet from 'helmet'; app.use(helmet({ contentSecurityPolicy: false }))` (CSP needs separate tuning).
- `.env.example` — add `ALLOWED_ORIGINS=https://app.example.com,https://staging.example.com`.

**Acceptance:**
- [ ] Cross-origin POST from a non-allowed origin is blocked by the browser preflight.
- [ ] `Strict-Transport-Security` header present on production responses.
- [ ] Local dev (`ALLOWED_ORIGINS=http://localhost:3000`) still works.

**Test plan:**
- **Unit:** N/A — config-level wiring.
- **System / integration:** `server/tests/integration/cors-and-helmet.test.ts` — request with `Origin: https://evil.com` → response lacks `Access-Control-Allow-Origin: https://evil.com` (preflight fails). Request with `Origin: ${ALLOWED_ORIGINS[0]}` → headers present. Any response includes `Strict-Transport-Security` header.
- **E2E:** N/A — browser-level CORS would require cross-origin Playwright setup that's high-effort/low-yield; integration test covers the assertion.

**Estimate:** 0.5 days. **Blocks:** S2.5 (httpOnly cookies need cors `credentials: true`).

---

## S1.9 — Help-chat session binding

**Source:** [[security-audit-2026-05-10|C5]].

**Files:**
- `server/src/controllers/helpChatController.ts` (the `/api/webhooks/help/chat` proxy) — before forwarding, replace `sessionId` with `sha256(userId + clientSessionId)`.
- `n8n-workflows/cshse-help-chat-agent.json:190` — Redis chat memory key already reads `$json.body.sessionId`; no n8n change needed once the server pre-hashes.
- Document the new behavior in the wiki: update [[n8n-integration]] session-isolation note.

**Acceptance:**
- [ ] Two users sharing a client-side `sessionId` see separate chat histories.
- [ ] Redis TTL is set (e.g., 24h).

**Test plan:**
- **Unit:** `server/tests/unit/helpchat-session-binding.test.ts` — `bindSession(userId, clientSessionId)` returns `sha256(userId + clientSessionId)`; same inputs → same output; different `userId` → different output.
- **System / integration:** `server/tests/integration/helpchat-session-isolation.test.ts` — two test users send chats with identical client `sessionId`; assert the server forwards different `sessionId` values to n8n (mock the n8n endpoint); assert no chat-history bleed between users.
- **E2E:** covered by S6.4 admin journey (impersonate user A → ask help-chat a question; impersonate user B with the same client sessionId → assert no leakage).

**Estimate:** 1 day. **Blocks:** none.

---

## S1.10 — Fix `isS3Configured()` export

**Source:** [[incomplete-features-2026-05-10|#3]] (carried) → [[incomplete-features-2026-05-11|T1.3]].

**Context:** [[storage-layer]].

**Files:**
- `server/src/services/s3Service.ts` — add `export function isS3Configured(): boolean { return !!(process.env.AWS_S3_BUCKET_NAME && process.env.AWS_ACCESS_KEY_ID); }`.
- `server/src/controllers/evidenceController.ts:309` — verify the now-resolved call.
- `.env.example` — add every S3 env var the code reads.

**Acceptance:**
- [ ] With `AWS_*` env set, evidence upload writes to S3 (verify with AWS CLI).
- [ ] With `AWS_*` unset, evidence upload writes to base64-in-Mongo (current legacy behavior).
- [ ] No regression in download/preview for either path.

**Test plan:**
- **Unit:** `server/tests/unit/s3-isConfigured.test.ts` — true when both env vars set; false when either missing; false when both empty strings.
- **System / integration:** `server/tests/integration/evidence-upload-path.test.ts` — with mocked S3 client and env set, POST upload → assert `SupportingEvidence.file.storageType === 's3'` + `s3Key` present + no `data` (base64) field. With env unset, POST upload → assert `storageType === 'base64'` + `data` present + no `s3Key`. Same fixture, both branches.
- **E2E:** covered by S6.4 coordinator journey (upload an evidence file; for now, just assert it appears in the UI — storage path is server-side concern).

**Estimate:** 0.5 days. **Blocks:** S3.1 (evidence AI review needs S3 presigned URLs).

---

**Sprint 1 success metrics:**
- 4 / 4 Handbook-compliance violations addressed (H1–H4).
- 5 / 5 critical security findings closed (C1–C5).
- `isS3Configured()` resolved.
- Estimate total: ~12 days for one engineer (slightly over a 7-day sprint — parallelize S1.1, S1.2, S1.3 with S1.5–S1.10 if possible).

---

# SPRINT 2 — Auth Hardening + Input Validation (2 weeks)

**Goal:** Close every High and key Medium from [[security-audit-2026-05-10]]. Build the auth surface so attacks beyond Critical level don't succeed.

**Prerequisites:** S1 done (CORS + JWT_SECRET + impersonation audit are dependencies).

## S2.1 — Rate-limit `/api/auth/login` + account lockout

**Source:** [[security-audit-2026-05-10|H1]].

**Files:**
- `server/src/middleware/rateLimit.ts` — NEW. Wraps `express-rate-limit` with Redis store (if available) or memory.
- `server/src/routes/auth.ts:18` — apply the limiter to `POST /login`.
- `server/src/models/User.ts` — add `failedLoginAttempts: number, lockedUntil?: Date`.
- `server/src/controllers/userController.ts` login handler — increment on failure; when ≥10 in 1h, set `lockedUntil = now + 1h`; admin can unlock.

**Acceptance:**
- [ ] 5 wrong attempts per IP per 15min → 429.
- [ ] 10 wrong attempts on a single account → user locked for 1h (configurable).
- [ ] Admin "Unlock account" button on UserManagement.tsx.

**Test plan:**
- **Unit:** `server/tests/unit/rateLimit-middleware.test.ts` — limiter increments per key (IP); reset window honored; backed by an in-memory store.
- **System / integration:** `server/tests/integration/login-rate-limit.test.ts` — supertest fires 5 logins from one IP → 5 × 401; the 6th → 429. From a different IP, the 6th login succeeds. Lockout test: 10 wrong on one account → `User.lockedUntil` set; further logins on that account get 403 regardless of IP.
- **System / integration:** `client/src/features/admin/Settings/UserManagement.test.tsx` (extend) — "Unlock account" button calls `POST /api/users/:id/unlock`.
- **E2E:** covered by S6.4 admin journey (lock a fixture account → admin clicks Unlock → assert next login succeeds).

**Estimate:** 1 day.

## S2.2 — Forgot-password / reset-password flow

**Source:** [[security-audit-2026-05-10|H7]].

**Files:**
- `server/src/models/PasswordResetToken.ts` — NEW. `{ userId, tokenHash, expiresAt, usedAt? }`. TTL index on `expiresAt`.
- `server/src/controllers/userController.ts` — `forgotPassword` (rate-limited per S2.1) + `resetPassword`.
- `server/src/routes/auth.ts` — `POST /forgot-password`, `POST /reset-password`.
- `client/src/pages/ForgotPasswordPage.tsx`, `client/src/pages/ResetPasswordPage.tsx` — NEW.
- `client/src/App.tsx` — wire the routes (public).
- Email template in `server/src/templates/email/forgot-password.html` (used by S3.7).

**Acceptance:**
- [ ] User can request a reset; receives an email with a signed token (≤1h TTL).
- [ ] Token can be used exactly once.
- [ ] Rate-limited at 3 requests per email per hour.

**Test plan:**
- **Unit:** `server/tests/unit/passwordResetToken.test.ts` — hash before storing; verify-and-mark-used in one atomic step; TTL indexed at the schema level.
- **System / integration:** `server/tests/integration/forgot-password-flow.test.ts` — POST /forgot-password with a valid email → 200 + email queued (mocked transport from S3.7). POST /reset-password with the token + new password → 200, user can log in with new password. Re-use of same token → 410. Expired token (frozen time +2h) → 410. Unknown email → 200 (no enumeration).
- **System / integration:** `client/src/pages/ForgotPasswordPage.test.tsx` + `ResetPasswordPage.test.tsx` — RTL with MSW: form submits, success state shows, error states render correctly.
- **E2E:** `e2e/tests/forgot-password.spec.ts` — NEW dedicated spec (security-critical surface deserves its own). Flow: submit email → assert toast → grab token from JSON transport via test helper → visit reset link → set new password → log in with new password.

**Estimate:** 2 days. **Depends:** S3.7 (real email send) but tests can use JSON transport.

## S2.3 — JWT short-TTL + refresh tokens + revocation

**Source:** [[security-audit-2026-05-10|H2]].

**Files:**
- `server/src/models/RefreshToken.ts` — NEW. `{ userId, tokenHash, expiresAt, revokedAt? }`. TTL index.
- `server/src/models/RevokedToken.ts` — NEW. `{ jti, revokedAt, expiresAt }`. TTL index matching JWT max lifetime.
- `server/src/middleware/auth.ts` — check `jti` against `RevokedToken` before honoring.
- `server/src/routes/auth.ts:68` — change `expiresIn: '30d'` → `expiresIn: '1h'`. Include `jti = uuidv4()`.
- New endpoint `POST /api/auth/refresh` — accepts refresh token, returns new access token + rotates the refresh token.
- `POST /api/auth/logout` — write `jti` to `RevokedToken`.
- `client/src/services/api.ts` — 401 response triggers an automatic refresh attempt before redirecting to /login (interceptor enhancement).

**Acceptance:**
- [ ] Access token expires in 1h.
- [ ] Client transparently refreshes once before redirecting to login.
- [ ] Logout makes the old token reject within seconds.
- [ ] Refresh token rotates on each use (old becomes invalid).

**Test plan:**
- **Unit:** `server/tests/unit/jwt-jti-revocation.test.ts` — middleware rejects token whose `jti` is in `RevokedToken`; allows token whose `jti` is not.
- **Unit:** `server/tests/unit/refresh-rotation.test.ts` — old refresh-token becomes invalid after one use; new one issued is single-use.
- **System / integration:** `server/tests/integration/auth-lifecycle.test.ts` — login → access token works for 1h (frozen time); access expires → /refresh issues new token; logout → previous access token rejected within 1s; refresh-token re-use → 401.
- **System / integration:** `client/src/services/api.test.ts` (extend) — 401 response triggers refresh attempt; second 401 after failed refresh redirects to /login.
- **E2E:** `e2e/tests/auth-lifecycle.spec.ts` — NEW. Log in → make a request → manually expire the access token via fixture endpoint → make another request → assert transparent refresh + success.

**Estimate:** 2.5 days. **Blocks:** S2.5.

## S2.4 — Server-side HTML sanitization on imported documents

**Source:** [[security-audit-2026-05-10|H3]].

**Context:** [[import-marker-mechanism]], [[storage-layer]].

**Files:**
- `server/src/services/documentParser.ts` — after Mammoth/pdf-parse produces HTML, run through `sanitize-html` with a whitelist of safe tags (p, h1-h6, ul, ol, li, table, tr, td, th, thead, tbody, colgroup, col, b, i, u, em, strong, a, img, br, hr, div, span — see Mammoth's defaults).
- Specifically forbid: `script`, `style`, `iframe`, `object`, `embed`, all event handlers (`on*` attrs), `javascript:` URLs in `href`/`src`.
- `server/src/services/gridFsService.ts:38-70` (storeHtmlContent) — sanitize once at write if upstream is uncertain; do NOT double-sanitize on every read.
- `client/src/features/selfStudy/Editor/components/DocumentViewer.tsx:841` — keep `dangerouslySetInnerHTML` (it now receives sanitized HTML).

**Acceptance:**
- [ ] A DOCX with `<script>alert(1)</script>` lands in GridFS without the script.
- [ ] An `<a href="javascript:...">` lands without the href.
- [ ] Tables and images survive sanitization intact.

**Test plan:**
- **Unit:** `server/tests/unit/sanitizeHtml.test.ts` — table-driven malicious payloads: `<script>` removed; `onclick="..."` removed; `<a href="javascript:...">` href cleared; `<iframe>` removed; safe tags + attrs preserved (p, table, tr, td, img with src/alt).
- **System / integration:** `server/tests/integration/import-sanitization.test.ts` — POST `/api/imports/upload` with a DOCX fixture containing `<script>alert(1)</script>`; assert resulting GridFS HTML lacks `<script`. Same fixture for `javascript:` hrefs.
- **System / integration:** `client/src/features/selfStudy/Editor/components/DocumentViewer.test.tsx` (extend) — render with a fixture HTML that would have been malicious pre-sanitization (now safe); assert no script tags in resulting DOM.
- **E2E:** covered by S6.4 coordinator journey (import a DOCX with crafted payload from the seed fixtures → assert no popup / no script execution).

**Estimate:** 1 day.

## S2.5 — JWT in httpOnly cookie (migrate from localStorage)

**Source:** [[security-audit-2026-05-10|H5]].

**Files:**
- `server/src/routes/auth.ts` login + refresh handlers — set the JWT via `res.cookie('access_token', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 1h })`. Same for refresh token.
- `server/src/middleware/auth.ts` — read token from `req.cookies.access_token` BEFORE `Authorization` header (fall back to header for API clients).
- `client/src/services/api.ts:11-28` — drop the `Authorization: Bearer` interceptor; rely on cookies. Set `axios.defaults.withCredentials = true`.
- `client/src/store/authStore.ts:205-213` — stop persisting `token`. Still persist `impersonation` + `needsImpersonationSelection`.

**Acceptance:**
- [ ] No JWT visible in localStorage or `document.cookie`.
- [ ] All authenticated requests succeed using cookie auth.
- [ ] Existing tokens issued before migration are invalidated (acceptable one-time forced re-login).

**Test plan:**
- **Unit:** `server/tests/unit/cookie-auth-middleware.test.ts` — middleware reads cookie first, falls back to Authorization header; cookie attrs verified (httpOnly, Secure, SameSite=Strict).
- **System / integration:** `server/tests/integration/cookie-auth-flow.test.ts` — login response has Set-Cookie; subsequent request without Authorization header succeeds via cookie; logout clears the cookie.
- **System / integration:** `client/src/services/api.test.ts` (extend) — assert Authorization header is NOT added; `withCredentials: true` set.
- **System / integration:** `client/src/store/authStore.test.ts` (extend) — token NOT persisted in localStorage; impersonation state still persisted.
- **E2E:** `e2e/tests/cookie-auth.spec.ts` — NEW. Log in → assert document.cookie does not expose JWT (only the Secure httpOnly cookie via response headers); reload → still authenticated; logout → request fails.

**Estimate:** 2 days (high blast radius). **Feature-flag for phased rollout if hot path.** **Depends:** S1.8 (CORS `credentials: true`), S2.3.

## S2.6 — Zod input validation at every route boundary

**Source:** [[security-audit-2026-05-10|H6]].

**Files:**
- `server/src/schemas/` — NEW directory. One Zod schema per route group: `auth.ts`, `evidence.ts`, `imports.ts`, etc.
- `server/src/middleware/validate.ts` — NEW. `validate(schema)` middleware that parses `req.body` / `req.query` / `req.params` and rejects unknown keys.
- Apply across every controller route gradually. Priority order:
  1. `auth.ts` routes (handle credentials).
  2. `webhooks.ts` callbacks (untrusted bodies).
  3. `evidence.ts` (file metadata).
  4. The rest.

**Acceptance:**
- [ ] Query string `?status[$ne]=pending` is rejected at the validator, not reaching Mongoose.
- [ ] Unknown fields in `req.body` are rejected.
- [ ] All existing happy paths still pass.

**Test plan:**
- **Unit:** `server/tests/unit/validate-middleware.test.ts` — middleware: schema pass → next(); schema fail → 400 with formatted Zod error; unknown keys rejected (strict mode).
- **Unit:** `server/tests/unit/schemas-*.test.ts` — one per schema file. Valid + invalid inputs at every required/optional boundary.
- **System / integration:** `server/tests/integration/nosql-injection-regression.test.ts` — fires `?status[$ne]=pending` query against the submissions list; assert response is 400 from the validator, NOT 200 with leaked rows.
- **System / integration:** `server/tests/integration/route-validation-rollup.test.ts` — for each updated route, assert happy path still passes AND a known-bad payload returns 400.
- **E2E:** N/A — validation behavior is server-side; integration tests cover.

**Estimate:** 2.5 days.

## S2.7 — Admin password-reset audit trail

**Source:** [[security-audit-2026-05-10|H4]].

**Files:**
- `server/src/models/AdminAction.ts` — NEW. `{ adminId, action: 'password_reset' | 'user_disabled' | 'role_changed', targetUserId, performedAt, reason?, ipAddress }`.
- `server/src/routes/auth.ts:173-217` — on admin password reset, write audit row + send email to the target user.
- `client/src/features/admin/Settings/UserManagement.tsx` — show recent admin actions on the user detail.

**Acceptance:**
- [ ] Every admin password reset writes an audit row + sends an email to the target user.
- [ ] Admin UI surfaces the history.

**Test plan:**
- **Unit:** `server/tests/unit/AdminAction-model.test.ts` — schema validation; required fields.
- **System / integration:** `server/tests/integration/admin-password-reset.test.ts` — admin resets target's password → assert `AdminAction` row written + target user receives `password-reset.html` email (mocked transport). Assert admin UI returns recent actions via GET endpoint.
- **System / integration:** `client/src/features/admin/Settings/UserManagement.test.tsx` (extend) — admin sees recent reset actions on user detail.
- **E2E:** covered by S6.4 admin journey (admin resets a coordinator's password → coordinator receives email → can log in with new password).

**Estimate:** 1 day.

## S2.8 — Default-deny in `verifyEvidenceAccess`

**Source:** [[security-audit-2026-05-10|M2]].

**Files:**
- `server/src/controllers/evidenceController.ts:64-66` — change `hasAccess = true` for null-institution non-admin → `hasAccess = false`.

**Acceptance:**
- [ ] User without an `institutionId` cannot list evidence belonging to a submission with no institution link.
- [ ] No regression for normal access flows.

**Test plan:**
- **Unit:** `server/tests/unit/verifyEvidenceAccess.test.ts` — table-driven across (user role) × (institution null vs set) × (own vs other institution); assert `hasAccess` correctness. Null-institution + non-admin → `false` (the fix).
- **System / integration:** `server/tests/integration/evidence-rbac.test.ts` — full RBAC matrix via supertest: PC of inst A, reader assigned to inst B's submission, lead-reader, admin, user with no institution. CRUD operations on inst-A evidence × null-institution evidence.
- **E2E:** N/A — covered by RBAC integration matrix.

**Estimate:** 0.5 days.

## S2.9 — Multer magic-byte validation

**Source:** [[security-audit-2026-05-10|M5]].

**Files:**
- `server/src/routes/imports.ts:50-62` (Multer config) — add `fileFilter` that uses the `file-type` package to verify magic bytes match the claimed MIME.
- Same for `server/src/routes/evidence.ts` upload.

**Acceptance:**
- [ ] A file named `report.pdf` with `Content-Type: application/pdf` but containing an executable header is rejected.

**Test plan:**
- **Unit:** `server/tests/unit/file-type-validator.test.ts` — `verifyMagicBytes(buffer, claimedMime)`: PDF buffer + `application/pdf` → true; HTML buffer + `application/pdf` → false; DOCX buffer + `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → true.
- **System / integration:** `server/tests/integration/upload-magic-byte-reject.test.ts` — POST with `Content-Type: application/pdf` but HTML body → 400. POST with matching content + mime → 201.
- **E2E:** N/A — server-side validation; integration covers it.

**Estimate:** 0.5 days.

## S2.10 — Multiple Program Coordinators per Institution

**Source:** [[product-requirements#u1-multiple-program-coordinators-per-institution]] — user requirement raised 2026-05-11. Foundational for all subsequent RBAC work.

**Context:** [[product-requirements]], [[system-architecture#auth-model]], [[evidence-file-storage#data-model-recap]].

**Files:**
- `server/src/models/Institution.ts` — replace any singular `coordinator` / `coordinatorId` / `programCoordinatorId` field with `coordinatorIds: ObjectId[]` (ref: User). Keep an index for membership lookups.
- `server/src/migrations/` — NEW migration `convertCoordinatorToArray.ts`: for each Institution with the legacy singular field, convert to a single-element `coordinatorIds` array. Idempotent.
- `server/src/controllers/institutionController.ts` — new endpoints `POST /api/institutions/:id/coordinators` (add) and `DELETE /api/institutions/:id/coordinators/:userId` (remove). Block removing the last coordinator unless `?force=true` + audit log.
- All permission checks for institution-scoped resources — grep `coordinatorId` and convert to "is `req.user.id` in `institution.coordinatorIds`":
  - `server/src/controllers/evidenceController.ts` (verifyEvidenceAccess and similar).
  - `server/src/controllers/submissionController.ts` (PC permission gates).
  - `server/src/controllers/changeRequestController.ts`.
  - `server/src/controllers/readerLockController.ts`.
- `client/src/features/admin/Settings/InstitutionManagement.tsx` — UI: list current coordinators as removable chips; "Add coordinator" button opens a user picker filtered to `program-coordinator` role.
- `client/src/features/dashboard/Dashboard.tsx` (PC variant) — query that finds "my institutions" must use `coordinatorIds: $in: [userId]` instead of `coordinatorId: userId`.
- Email templates for invitation and assignment — when a new PC is added, notify existing PCs of the new co-coordinator.

**Steps:**
1. Schema change + migration. Run migration on all environments.
2. Sweep permission-check call sites; replace singular reference with array `.includes(userId)`.
3. Add admin endpoints + UI for add/remove.
4. Update PC dashboard query.
5. Update email templates.

**Acceptance:**
- [ ] Admin can assign 2+ PCs to a single institution.
- [ ] Each assigned PC sees the institution + all its submissions in their dashboard.
- [ ] Removing a PC requires confirmation; removing the last PC is blocked without explicit `force=true` admin action.
- [ ] Existing single-coordinator institutions migrate to a one-element array without data loss.
- [ ] Permission checks for evidence, narratives, submissions, change-requests, reader-lock all work for any PC in the array.
- [ ] Audit log captures every add/remove of a coordinator.

**Test plan:**
- **Unit:** `server/tests/unit/institution-coordinator-permission.test.ts` — `isCoordinatorOf(user, institution)` returns true for any user in `coordinatorIds[]`; false for non-members.
- **Unit:** `server/tests/unit/coordinator-migration.test.ts` — migration converts legacy singular field to a one-element array; running it twice is a no-op (idempotent).
- **System / integration:** `server/tests/integration/institution-multi-pc.test.ts` — admin POSTs to add a 2nd PC; both PCs successfully GET the institution + its submissions; non-member PC gets 403; cannot remove last PC without `force=true`.
- **System / integration:** `server/tests/integration/evidence-rbac.test.ts` (extend to cover multi-PC) — both PCs on the same institution can read/write evidence; PC of a different institution still denied.
- **System / integration:** `client/src/features/admin/Settings/InstitutionManagement.test.tsx` (extend) — add a 2nd PC via picker → chip appears; remove chip → DELETE fires; "remove last" disabled.
- **System / integration:** `client/src/features/dashboard/Dashboard.test.tsx` (PC variant, extend) — PC who is one of two coordinators sees the institution.
- **E2E:** covered by S6.4 admin journey (admin assigns 2 PCs to seed institution → impersonate each → both see the institution; remove 2nd → original retains access; assert RBAC matrix).

**Estimate:** 3 days. **Blocks:** S5.5 RBAC matrix tests must run against the multi-PC model. **Depends:** S1.1 (audit log infrastructure) for the coordinator-add/remove audit trail.

---

**Sprint 2 success metrics:**
- 7 / 7 Highs closed.
- 2 of the 8 Mediums closed (M2, M5).
- `'development-secret-key'` literal does not exist in repo.
- Multi-PC support live so all subsequent RBAC work runs against the right model (S2.10).
- Total estimate: ~16 days. Parallelize S2.1, S2.7, S2.8, S2.9, S2.10 against the bigger S2.3 + S2.5.

---

# SPRINT 3 — Evidence AI Review (Server + N8N) + Email Notifications + Reader Deadlines (2 weeks)

**Goal:** Stand up the missing AI evidence-review pipeline end-to-end. Wire every stubbed email. Make the 45-day reader deadline actually tick.

**Prerequisites:** S1.10 (S3 is real), S1.7 (HMAC pattern in place), S2.x (real auth surface).

## S3.1 — New `cshse-evidence-document-review` n8n workflow

**Source:** [[evidence-document-review-pipeline]].

**Files:**
- `n8n-workflows/cshse-evidence-document-review.json` — NEW. Follow the design at [[evidence-document-review-pipeline#architecture-sketch]]:
  - Webhook in.
  - For each file in payload: HTTP GET presigned URL → MIME-detect → text extract (pdf-parse / mammoth / pptx-parser / Tesseract OCR for images) → chunk if >32K tokens → per-chunk LLM relevance pass (`gpt-4o-mini`) → aggregate.
  - Stream `file_result` callback per file (mirror Document Matcher streaming pattern).
  - Final aggregate callback at the end.

**Acceptance:**
- [ ] Workflow imports cleanly into n8n.
- [ ] Test fixture: 1 PDF, 1 DOCX, 1 image → 3 `file_result` callbacks arrive.

**Test plan:**
- **Unit:** N/A — n8n workflow has no Vitest surface.
- **System / integration:** `server/tests/integration/evidence-review-fixture.test.ts` — fires the trigger endpoint (S3.2) against a mock n8n that returns a fixture `file_result` payload for 1 PDF + 1 DOCX + 1 image; assert 3 `EvidenceReviewResult` rows persisted with correct shape.
- **E2E:** Manual smoke against staging n8n with a known submission; assert callbacks arrive in <5 min total. Documented in N8N-SETUP.md (S6.7).

**Estimate:** 3 days.

## S3.2 — Server: `POST /review-evidence` trigger endpoint

**Source:** [[evidence-document-review-pipeline]], [[code-review-2026-05-10#what-must-change]].

**Files:**
- `server/src/controllers/evidenceReviewController.ts` — NEW.
- `server/src/routes/submissions.ts` — mount `POST /api/submissions/:id/standards/:code/specs/:spec/review-evidence`.
- Inside: query `SupportingEvidence.find({ submissionId, standardCode, specCode, isCurrentVersion: true, isDeleted: false })`. For each S3-backed file, mint a 5-min presigned URL via `s3Service`. For each base64 file, inline the bytes. POST to the new workflow's webhook with narrative + Standard text + per-file URLs.
- `server/src/services/s3Service.ts` — add `getPresignedUrl(key, ttlSec)` if not already exported; cap TTL at 300s ([[security-audit-2026-05-10|M4]]).

**Acceptance:**
- [ ] Endpoint requires PC or admin role.
- [ ] Returns 202 with `jobId` immediately.
- [ ] Presigned URLs expire at 5 min.

**Test plan:**
- **Unit:** `server/tests/unit/presigned-url-ttl.test.ts` — `getPresignedUrl(key, ttlSec)` caps `ttlSec` at 300 (clamp anything higher).
- **System / integration:** `server/tests/integration/review-evidence-trigger.test.ts` — POST trigger with PC token; mock n8n endpoint; assert outgoing payload has narrative + standard text + per-file presigned URLs (matching live S3-backed fixtures) AND inlined base64 for legacy rows. Non-PC token → 403. Returns 202 with `jobId`.
- **E2E:** covered by S6.4 coordinator journey (trigger review, assert spinner → pills appear).

**Estimate:** 1.5 days. **Depends:** S1.10.

## S3.3 — Server: HMAC-signed evidence-review callback + `EvidenceReviewResult` model

**Source:** [[evidence-document-review-pipeline]].

**Files:**
- `server/src/models/EvidenceReviewResult.ts` — NEW. `{ submissionId, standardCode, specCode, evidenceId, evidenceVersionId, relevance: 'supports'|'partial'|'not_relevant', quotedPassage, confidence, reviewedAt }`. Compound index on `(submissionId, standardCode, specCode)` and unique `(evidenceId, evidenceVersionId, standardCode, specCode)` for cache.
- `server/src/controllers/webhookController.ts` — new `receiveEvidenceReviewCallback`.
- `server/src/routes/webhooks.ts` — mount with the `verifyHmac` middleware from S1.7.

**Acceptance:**
- [ ] Unsigned callback returns 401.
- [ ] Duplicate `(evidenceId, evidenceVersionId, std, spec)` is treated as cache hit (overwrites latest).

**Test plan:**
- **Unit:** `server/tests/unit/EvidenceReviewResult-model.test.ts` — schema validation; unique constraint on `(evidenceId, evidenceVersionId, standardCode, specCode)` causes upsert behavior on retry.
- **System / integration:** `server/tests/integration/evidence-review-callback.test.ts` — unsigned POST → 401 (HMAC from S1.7); valid signed POST persists row; duplicate `(evidenceId, evidenceVersionId, std, spec)` overwrites cleanly without throwing; invalid `relevance` value → 400.
- **E2E:** covered by S6.4 coordinator journey (trigger review → wait for callbacks → pills update).

**Estimate:** 1.5 days. **Depends:** S1.7.

## S3.4 — Cache: dedup unchanged files on revalidation

**Source:** [[evidence-document-review-pipeline#cost-performance]].

**Files:**
- `server/src/controllers/evidenceReviewController.ts` (from S3.2) — before triggering, query `EvidenceReviewResult` for existing rows; only include unchanged-file IDs that have no row.

**Acceptance:**
- [ ] Re-running review on the same submission re-evaluates only files that changed (different `evidenceVersionId`) or have no result yet.

**Test plan:**
- **Unit:** `server/tests/unit/evidence-review-cache.test.ts` — function `selectFilesToReview(submission, std, spec)` given a fixture: 3 files (2 with existing `EvidenceReviewResult` matching current versions, 1 with a newer version) → returns only the 1 changed file.
- **System / integration:** `server/tests/integration/evidence-review-cache-flow.test.ts` — second trigger of review on same submission with no file changes → mocked n8n receives ZERO files in payload (skipped); changing one file's version → next trigger sends only that file.
- **E2E:** N/A — internal optimization; not directly user-visible.

**Estimate:** 1 day.

## S3.5 — Retry / backoff on outbound n8n calls

**Source:** [[incomplete-features-2026-05-10|#4]] (carried), [[n8n-integration]].

**Files:**
- `server/src/services/validationService.ts:381-463` (`callWebhook`) — wrap fetch in retry-with-exp-backoff (3 attempts, 1s/2s/4s delays, retry only on 5xx + network errors). Use `WebhookSettings.retryConfig` if set, else defaults.
- Apply same wrapper to the new `evidenceReviewController` outbound call.

**Acceptance:**
- [ ] Transient 503 from n8n triggers retries.
- [ ] Permanent 401 / 422 does NOT retry.
- [ ] Each attempt logged via `errorLogger` with attempt number.

**Test plan:**
- **Unit:** `server/tests/unit/callWebhook-retry.test.ts` — Vitest fake timers + mocked fetch: 503 × 2 then 200 → 3 attempts, success returned; 401 → 1 attempt, no retry; network error × 3 → 3 attempts then failure; delays match expected backoff (1s, 2s, 4s).
- **System / integration:** `server/tests/integration/validation-retry.test.ts` — full triggerValidation path with mocked transient n8n failure; assert ValidationResult stays `pending` then transitions on retry success; ErrorLog rows written per failed attempt.
- **E2E:** N/A — internal resilience behavior.

**Estimate:** 1 day.

## S3.6 — OCR fallback for image-only PDFs

**Source:** [[incomplete-features-2026-05-10|#6]] (carried).

**Files:**
- `server/src/services/documentParser.ts:~85` — when pdf-parse returns ≤100 text chars but `pageCount > 0`, fall back to rendering pages → Tesseract.js OCR.
- The n8n workflow from S3.1 should also have OCR for image-evidence types.

**Acceptance:**
- [ ] An image-only PDF imports with extracted text and `confidence: 'ocr'` flag.

**Test plan:**
- **Unit:** `server/tests/unit/ocr-fallback-trigger.test.ts` — `shouldOcr(pdfParseResult)` → true when text < 100 chars AND pageCount > 0; false otherwise.
- **System / integration:** `server/tests/integration/scanned-pdf-import.test.ts` — POST an image-only PDF fixture; assert extracted text length > 100 chars; assert `confidence: 'ocr'` flag persisted.
- **E2E:** covered by S6.4 coordinator journey if a scanned-PDF seed fixture is added; otherwise integration covers.

**Estimate:** 1.5 days.

## S3.7 — Email server env config + sender identity

**Source:** New requirement raised 2026-05-11 — env-driven SMTP server name, sender email, and domain configuration. Pulled forward of S3.8 so wiring (S3.8) can rely on it.

**Files:**
- `server/src/config/email.ts` — NEW. Centralizes every email-related env var; throws at boot in `NODE_ENV=production` if any required field is missing. Required env keys:
  - `SMTP_HOST` (e.g. `smtp.sendgrid.net`) — the email server name.
  - `SMTP_PORT` (e.g. `587`).
  - `SMTP_SECURE` (`"true"` for 465/SMTPS, `"false"` for STARTTLS on 587).
  - `SMTP_USER`, `SMTP_PASSWORD` — auth.
  - `EMAIL_FROM_ADDRESS` (e.g. `accreditation@cshse.org`) — the `From:` address every system email uses.
  - `EMAIL_FROM_NAME` (e.g. `CSHSE Accreditation Portal`) — the friendly display name.
  - `EMAIL_DOMAIN` (e.g. `cshse.org`) — the sending domain, used to validate `EMAIL_FROM_ADDRESS` matches and surfaced in SPF/DKIM/DMARC setup docs (S6.7).
  - `EMAIL_REPLY_TO` (optional, e.g. `support@cshse.org`).
  - Dev fallback: when `NODE_ENV !== 'production'` and `SMTP_HOST` is empty, fall back to nodemailer's JSON transport so dev/test never tries to send real mail.
- `server/src/services/emailService.ts` — finish the wrapper:
  - Build a single `nodemailer.createTransport(...)` from `config/email.ts`.
  - One exported function `sendEmail({ to, templateKey, vars })`.
  - Always sets `from: "${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>"`, `replyTo: EMAIL_REPLY_TO || EMAIL_FROM_ADDRESS`.
  - Validates `to` is non-empty; warns if `to` domain matches a known disposable-mail list (best-effort).
  - On any failure, logs to ErrorLog and returns `{ sent: false, error }` — never throws to a request handler.
- `.env.example` — add every key above with comments + an example SPF/DKIM/DMARC DNS record block.
- `client/src/features/admin/Settings/EmailSettings.tsx` — NEW. Read-only display of current SMTP host + sender + domain (pulled from a new `GET /api/admin/email-config` that returns config WITHOUT credentials). "Send test email" form: input a recipient → fires `POST /api/admin/email-test` → success toast + ErrorLog entry on failure.
- `server/src/controllers/adminController.ts` — add `GET /api/admin/email-config` and `POST /api/admin/email-test`.

**Steps:**
1. Build `config/email.ts` with strict boot-time validation in production.
2. Rewrite `emailService.ts` around the central config.
3. Add the admin read-only config view + test-email button.
4. Update `.env.example` with full key set + DNS record template.
5. Document SPF/DKIM/DMARC setup steps in `DEPLOY.md` (handed to S6.7).

**Acceptance:**
- [ ] Production boot fails if any required `SMTP_*` / `EMAIL_FROM_*` / `EMAIL_DOMAIN` is missing.
- [ ] Dev boot with no SMTP env succeeds and uses JSON transport (test emails accumulate in process memory; no real send).
- [ ] `EMAIL_FROM_ADDRESS` domain mismatch with `EMAIL_DOMAIN` causes a clear error at boot.
- [ ] Admin can view current config (without secrets) and fire a test email to any address.
- [ ] All system emails use the same `From:` header derived from env.

**Test plan:**
- **Unit:** `server/tests/unit/config-email.test.ts` — table-driven across (missing key) × (NODE_ENV=production|development): production+missing → throws; dev+missing → returns dev fallback config. Also: `EMAIL_FROM_ADDRESS=foo@bar.com` + `EMAIL_DOMAIN=cshse.org` → throws domain mismatch.
- **Unit:** `server/tests/unit/emailService-send.test.ts` — with mocked nodemailer transport: `sendEmail({to, templateKey, vars})` resolves the template, interpolates vars, calls transport with correct `from` + `replyTo`; failure path returns `{sent:false}` and logs to ErrorLog (assert via mock).
- **System / integration:** `server/tests/integration/admin-email-config.test.ts` — admin token → `GET /api/admin/email-config` returns 200 with host/sender/domain but NOT password. Non-admin → 403. `POST /api/admin/email-test` with mocked transport → asserts `to` received the test email body.
- **System / integration:** `client/src/features/admin/Settings/EmailSettings.test.tsx` — RTL with MSW: renders config; "Send test email" success toast on 200; error banner on 500.
- **E2E:** covered by S6.4 admin journey (open EmailSettings → see configured server name + sender → fire a test email → assert success toast).

**Estimate:** 1.5 days. **Blocks:** S3.8 (this provides the transport S3.8 sends through).

---

## S3.8 — Wire all stubbed email sites + templates

**Source:** [[incomplete-features-2026-05-11|T2.3]], [[incomplete-features-2026-05-10|#1]] (carried).

**Files:**
- `server/src/templates/email/` — NEW directory of HBS/HTML templates:
  - `invitation.html`, `password-reset.html`, `site-visit-scheduled.html`, `site-visit-updated.html`, `change-request-submitted.html`, `change-request-approved.html`, `change-request-denied.html`, `reader-locked.html`, `reader-overdue.html`, `submission-sent-back.html`, `decision-informal.html`, `decision-formal.html` (last two for S6.1).
- Call sites (replace `// TODO: Send notification email`):
  - `server/src/controllers/siteVisitController.ts:181-296` (4 sites).
  - `server/src/controllers/changeRequestController.ts:156-307` (3 sites).
  - `server/src/controllers/institutionController.ts:143,263,303` (3 sites).
  - `server/src/controllers/readerLockController.ts:239` (1 site).
  - `server/src/controllers/invitationController.ts` (the invite-create handler — verify).
  - `server/src/controllers/leadReaderController.ts` (reader-reminder endpoint — verify).
- All call sites use the `sendEmail()` wrapper from S3.7 — no direct nodemailer use.

**Acceptance:**
- [ ] Every previously-stubbed call site sends email (real in prod, JSON transport in dev).
- [ ] Email body matches a template + interpolated vars.
- [ ] Send failures log to ErrorLog and do not break the request.
- [ ] All emails carry the env-driven `From:` and `Reply-To:`.

**Test plan:**
- **Unit:** `server/tests/unit/email-template-render.test.ts` — for each template, given a fixed `vars` object, the rendered HTML/text matches a snapshot. Catches accidental template breakage.
- **System / integration:** `server/tests/integration/email-call-sites.test.ts` — for each previously-stubbed site (site-visit, change-request, institution-invite, reader-lock, lead-reader-reminder), fire the controller action with mocked transport, assert `sendEmail` was called with the right `to` + templateKey + vars.
- **System / integration:** `server/tests/integration/email-failure-isolation.test.ts` — force `sendEmail` to throw; assert the calling controller still returns 200/201 (email failure does NOT break the user action), AND an ErrorLog row was written.
- **E2E:** covered by S6.4 coordinator + admin journeys (create a change request → assert the lead reader receives an email in the JSON transport buffer).

**Estimate:** 3 days. **Depends:** S3.7.

## S3.9 — 45-day reader deadline tracking

**Source:** [[incomplete-features-2026-05-11|T2.7]].

**Files:**
- `server/src/models/Review.ts` — add `dueAt: Date`. Default at create: `assignedAt + 45 days`.
- `server/src/services/cronJobs.ts` — daily job that queries `Review.find({ dueAt: { $lt: in7days }, status: { $ne: 'submitted' } })`, sends `reader-overdue.html` email + dashboard banner state.
- `client/src/features/dashboard/Dashboard.tsx` (reviewer/lead-reader variant) — show deadline urgency badge (red <14d, amber <30d) per assignment.
- `server/src/controllers/leadReaderController.ts` reminder endpoint — already exists; now actually sends email (per S3.7).

**Acceptance:**
- [ ] Newly-created `Review` has `dueAt = assignedAt + 45 days`.
- [ ] Cron job fires on a fixture set at < 7 days remaining.
- [ ] Reviewer dashboard shows red/amber pills.

**Test plan:**
- **Unit:** `server/tests/unit/review-dueAt-derivation.test.ts` — new Review default has `dueAt = assignedAt + 45 days`; configurable via env override.
- **System / integration:** `server/tests/integration/reader-overdue-cron.test.ts` — seed 3 Reviews at -50d, -30d, -1d assignedAt; run cron with frozen time; assert only the one at +44d (1 day until due) NOT yet overdue gets a soft reminder, the -50d (overdue) gets the overdue email, etc. Assert email mock received correct vars.
- **System / integration:** `client/src/features/dashboard/Dashboard.test.tsx` (reviewer variant) — fixture review with `dueAt` 5 days out → red urgency pill; 25 days out → amber; 40 days out → none.
- **E2E:** covered by S6.4 reviewer journey (dashboard shows urgency pill on a seed assignment near due).

**Estimate:** 1.5 days. **Depends:** S3.7, S3.8.

---

**Sprint 3 success metrics:**
- Evidence-review pipeline operational end-to-end.
- Env-driven email config with admin viewer + test-email button (S3.7).
- 11+ previously-stubbed email sites now send through the central wrapper (S3.8).
- Reader deadline tracking + reminders live (S3.9).
- Total estimate: ~15.5 days. **Tight** — consider deferring S3.6 (OCR fallback) to S4 if needed.

---

# SPRINT 4 — Evidence Review UI + Curriculum Matrix Editor (2 weeks)

**Goal:** Surface the new pipeline in all three evidence UIs. Finish the matrix backend with a real client editor. Clean up tier-1 evidence UX gaps.

**Prerequisites:** S3 done.

## S4.1 — Evidence review pills in `EvidencePanel`, `EvidenceManager`, `FileLibrary`

**Source:** [[evidence-document-review-pipeline]], [[evidence-file-storage#what-changes-are-required]].

**Files:**
- `client/src/features/selfStudy/Editor/EvidencePanel.tsx` — per-row status pill (`pending` / `✓ supports` / `◐ partial` / `✗ not relevant`). Clicking opens a side-panel with the AI quote + rationale + confidence.
- `client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx` — same per-row pill.
- `client/src/features/selfStudy/FileLibrary/FileLibrary.tsx` — same per-row pill; **roll up aggregate pill on the Standard accordion header** (e.g., "5 ✓ / 1 ◐ / 2 ✗").
- `client/src/features/comments/CommentSidebar.tsx` (reviewer view) — read-only pills visible.

**Acceptance:**
- [ ] Coordinator sees pill in all three surfaces.
- [ ] Reviewer sees same pill (read-only).
- [ ] Pill updates progressively as `file_result` callbacks arrive.

**Test plan:**
- **Unit:** `client/src/features/selfStudy/Editor/EvidencePanel.test.tsx`, `EvidenceManager.test.tsx`, `FileLibrary.test.tsx` — pure-component render tests across all four pill states (pending / supports / partial / not_relevant); click pill → detail panel renders with passage + rationale + confidence.
- **System / integration:** same files, MSW mocking `GET /api/.../evidence-review-results` — full data flow from request through render. Aggregate pill on Standard accordion in FileLibrary correctly sums child counts.
- **System / integration:** `client/src/features/comments/CommentSidebar.test.tsx` (reviewer view extend) — read-only pills visible to readers.
- **E2E:** covered by S6.4 coordinator + reviewer journeys (trigger review → assert pills appear progressively as `file_result` callbacks arrive in the seed flow).

**Estimate:** 2.5 days.

## S4.2 — NarrativeEditor validation modal: "Evidence" tab

**Source:** [[evidence-document-review-pipeline]].

**Files:**
- `client/src/features/selfStudy/Editor/NarrativeEditor.tsx:1102-1152` (validation modal) — add a tabbed layout. "Narrative" tab is the existing content; new "Evidence" tab lists per-file findings, gap analysis ("What would be needed to support this claim that the current evidence doesn't provide?"), and a "Re-run evidence review" button.

**Acceptance:**
- [ ] Save and Validate shows both tabs.
- [ ] Each file's row links to its preview.

**Test plan:**
- **Unit:** N/A — tab logic is presentational.
- **System / integration:** `client/src/features/selfStudy/Editor/NarrativeEditor.test.tsx` (extend) — Save-and-Validate opens modal; Narrative tab shows existing feedback; Evidence tab shows per-file findings + gap-analysis text; "Re-run evidence review" button fires POST.
- **System / integration:** with MSW: switching tabs updates the panel without re-fetching.
- **E2E:** covered by S6.4 coordinator journey (after evidence review completes → open validation modal → switch to Evidence tab → assert per-file rows visible).

**Estimate:** 1.5 days.

## S4.3 — Template-driven curriculum matrix spreadsheet editor (the big one — revised 2026-05-11)

**Source:** [[incomplete-features-2026-05-11|T1.2]] (the largest "half-done" feature) + [[product-requirements#u3-template-driven-curriculum-matrices-with-multi-matrix-per-submission]] (user requirement raised 2026-05-11).

**Context:** [[product-requirements]], the official CSHSE matrix templates at `docs/matrix-templates/` (added in S4.8).

**Files:**
- `client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx` (currently 261 lines, view-only) — replace the accordion display with the new template-driven spreadsheet UI.
- New: `client/src/features/selfStudy/MatrixEditor/MatrixGrid.tsx` — the spreadsheet grid:
  - **Rows are template-supplied** — each row is one `(standardCode, specCode)` pair drawn from the matrix template registry (S4.8). The full spec text appears as the row label.
  - **Columns are user-added courses** — course numbers display vertically in the header (per template direction #2). Course-add button at the right of the header strip.
  - **Cells are multi-letter** — each cell holds a *combination* of content-type letters `I, T, K, S` AND a depth letter `L, M, H`. UI: a checkbox grid for I/T/K/S (multi-select) + a single L/M/H radio. Rendered display: comma-separated letters, e.g. `I, T, H`.
  - Virtualization via `react-window` (already in package.json — verify) so a 100-course × 100-row matrix is performant.
- New: `client/src/features/selfStudy/MatrixEditor/DirectionsPanel.tsx` — collapsible header above the grid showing the official template directions verbatim (the 5 numbered instructions from the template) so coordinators see the rules in-context.
- New: `client/src/features/selfStudy/MatrixEditor/NewMatrixModal.tsx` — workflow for creating a new matrix instance: pick template (defaulted to submission's program level), name (e.g. *"Required Core Courses"*, *"Cohort 2025 Electives"*), and an optional description. Clicking Create → POST `/api/submissions/:id/matrix` with `templateId` → server returns a fresh `CurriculumMatrix` with all rows pre-populated from the template (zero cells).
- Existing backend wired (no changes — already supports the shape):
  - `POST /api/submissions/:id/matrix/:mid/course` — add course column.
  - `DELETE /.../course/:courseId` — remove.
  - `PUT /.../assessment` — update one cell with `{ type: ['I','T'], depth: 'H' }`.
  - `POST /.../duplicate-row`, `DELETE /.../row/:rowIndex`.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — when the user opens the Matrix view, render a list of all matrices for the submission with a "+ New Matrix" button. Clicking a matrix opens it in `CurriculumMatrixEditor`. Multi-matrix support is the bridge to S4.9.
- Keep the existing imported `rawContent[]` display as a "Imported Reference Content" panel below the grid (legacy import flow continues to work).

**Steps:**
1. Build `MatrixGrid` against the existing data shape (rows from template, columns user-added).
2. Build `DirectionsPanel` displaying the 5 numbered instructions from the template (also store the directions text in the template registry from S4.8).
3. Build `NewMatrixModal` driving template-based creation.
4. Wire create / cell-edit / course-add against the existing backend endpoints.
5. Add 2-second auto-save debounce on cell edits (mirror `NarrativeEditor` pattern via `useAutoSave` hook).
6. Add the "matrix list view" inside SelfStudyEditor's Matrix tab.

**Acceptance:**
- [ ] Coordinator can create a new matrix from a template; the matrix opens with all `(standardCode, specCode)` rows pre-populated and zero course columns.
- [ ] Coordinator can add a course column with course number; number displays vertically.
- [ ] Coordinator can edit a cell, choosing any subset of I/T/K/S checkboxes plus one L/M/H radio. Display: `I, T, H` style.
- [ ] Auto-save fires 2 seconds after the last edit.
- [ ] Submission's matrix list shows all matrices; "+ New Matrix" button creates additional instances (sets up S4.9).
- [ ] Directions panel shows the verbatim template instructions and is collapsible.
- [ ] Imported `rawContent` still visible in the legacy panel below the grid.

**Test plan:**
- **Unit:** `client/src/features/selfStudy/MatrixEditor/MatrixGrid.test.tsx` — cell-click toggles I/T/K/S checkbox set; depth radio changes L/M/H; multi-letter combinations render as comma-separated; debounce groups rapid clicks into one save call.
- **Unit:** `client/src/features/selfStudy/MatrixEditor/matrixGrid-virtualization.test.tsx` — 100-course × 100-row fixture renders in <100ms (react-window virtualization).
- **Unit:** `client/src/features/selfStudy/MatrixEditor/DirectionsPanel.test.tsx` — directions render verbatim; collapse/expand state persists.
- **Unit:** `client/src/features/selfStudy/MatrixEditor/NewMatrixModal.test.tsx` — template defaults from `submission.programLevel`; submit fires POST with `templateId` + `name`.
- **System / integration:** `client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.test.tsx` — MSW: create from template → grid renders with all rows pre-populated; add course → `POST /course`; edit cell → `PUT /assessment` with multi-letter payload; remove course → `DELETE /course/:id`; imported rawContent still visible.
- **System / integration:** `server/tests/integration/matrix-cell-updates.test.ts` (extend) — full round-trip with multi-letter cells; verify `CurriculumMatrix.standards[].courseAssessments[].type` persists as an array, not a single value.
- **E2E:** covered by S6.4 coordinator journey (create matrix from template → add 3 courses → fill 5 cells with multi-letter combinations → reload → assert persistence + cell display).

**Estimate:** 5 days (revised up from 4 due to template-driven generation, directions panel, and new-matrix modal). **Depends:** S4.8 (template registry).

## S4.8 — Curriculum matrix template registry + reference docs

**Source:** [[product-requirements#u3-template-driven-curriculum-matrices-with-multi-matrix-per-submission]] — user requirement raised 2026-05-11.

**Context:** [[product-requirements]], CSHSE template DOCX files supplied 2026-05-11.

**Files:**
- `docs/matrix-templates/` — NEW directory. The user adds three CSHSE-issued DOCX templates (downloaded from the Google Docs links provided 2026-05-11):
  - `associate-matrix-template.docx`
  - `baccalaureate-matrix-template.docx`
  - `masters-matrix-template.docx`
  These are version-controlled in the repo so the editor reference is stable.
- `server/src/data/matrixTemplates.ts` — NEW. Static template registry, modeled on `data/standards.ts`. Each entry:
  ```ts
  {
    id: 'associate-2025' | 'baccalaureate-2025' | 'masters-2025',
    programLevel: 'associate' | 'bachelors' | 'masters',
    title: string,
    revisionDate: '2025-07',
    fieldHoursMinimum: 250 | 350 | 0,
    docxPath: 'docs/matrix-templates/associate-matrix-template.docx',
    rows: Array<{ standardCode: string, specCode: string, specText: string, order: number }>,
    directions: string[]   // the 5 numbered instructions from the template
  }
  ```
  Populate the `rows` from each template document — Standards 11–20 for Associate, 11–21 for Baccalaureate and Master's, with all sub-spec rows in template order. Spec text matches `data/standards.ts` so they stay in sync.
- `server/src/controllers/matrixTemplateController.ts` — NEW. `GET /api/matrix-templates` (list); `GET /api/matrix-templates/:id` (full template including rows + directions); `GET /api/matrix-templates/:id/document` (stream the DOCX from `docs/matrix-templates/`).
- `server/src/routes/matrixTemplates.ts` — NEW. Mount under `/api/matrix-templates`. GET-only, authenticated.
- `server/src/index.ts` — wire the router.
- `server/src/controllers/matrixController.ts` — extend `createMatrix` to accept a `templateId` and pre-populate `standards[]` from the template's `rows`. Default `name`/`matrixType` from template if not supplied.

**Steps:**
1. User saves the three DOCX files into `docs/matrix-templates/`.
2. Hand-encode the template structure (rows + spec text + directions) into `data/matrixTemplates.ts`. Cross-check spec text against `data/standards.ts` to stay consistent.
3. Build the templates controller + routes.
4. Extend `createMatrix` to honor `templateId`.

**Acceptance:**
- [ ] `GET /api/matrix-templates` returns 3 templates (associate / bach / masters).
- [ ] `GET /api/matrix-templates/:id/document` streams the DOCX with correct `Content-Type`.
- [ ] `POST /api/submissions/:id/matrix { templateId: 'associate-2025' }` creates a matrix with all rows pre-populated from the template, zero courses.
- [ ] Spec text in template matches `data/standards.ts` (no drift).

**Test plan:**
- **Unit:** `server/tests/unit/matrixTemplate-registry.test.ts` — registry returns expected counts (Associate: 10 standards, Bach: 11, Masters: 11). All `specText` matches the corresponding entry in `data/standards.ts`.
- **System / integration:** `server/tests/integration/matrix-template-routes.test.ts` — supertest: list → 3 entries; GET by id; GET document streams binary; create-matrix with `templateId` → resulting `CurriculumMatrix.standards[]` has all template rows.
- **System / integration:** `server/tests/integration/template-vs-standards-consistency.test.ts` — registry rows' `specText` is byte-equal to the `specifications[].text` in `data/standards.ts` for the same `(standardCode, specCode)` pair. Catches accidental drift.
- **E2E:** covered by S6.4 coordinator journey (open a fresh submission, click "+ New Matrix", pick template, assert rows pre-populated).

**Estimate:** 1.5 days. **Depends:** user-supplied DOCX files in `docs/matrix-templates/`. **Blocks:** S4.3.

## S4.9 — Multi-matrix per submission (multiple matrices for sets of courses)

**Source:** [[product-requirements#u3-template-driven-curriculum-matrices-with-multi-matrix-per-submission]] — user requirement: *"It should allow a new matrix for each set of courses for each spec."* Per the template's instruction #1: *"Use as many versions of the Matrix as needed to deal with all of your required courses."*

**Context:** [[product-requirements]], existing data model already supports the array via `Submission.curriculumMatrices: ObjectId[]`.

**Files:**
- `server/src/controllers/submissionController.ts` — confirm the `Submission.curriculumMatrices` array is already pushed to on matrix create. Add an endpoint or extend existing: `GET /api/submissions/:id/matrices` returns the full list with name + course count + last-modified for each matrix.
- `server/src/controllers/matrixController.ts` — `POST /api/submissions/:id/matrix` accepts the optional `templateId` from S4.8 + a required `name` ("Required Core Courses", "Electives Cohort 2025", etc.). `DELETE /api/submissions/:id/matrix/:mid` archives a matrix (soft delete, removes from list view but kept for audit).
- `client/src/features/selfStudy/MatrixEditor/MatrixListView.tsx` — NEW. Inside the Matrix tab of `SelfStudyEditor`, replace the single-matrix opener with a list of all matrices for the submission. Each row: name, course count, row count, last-modified, "Open" / "Archive" actions. "+ New Matrix" button at top.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — Matrix tab navigation: when a matrix is opened, show a breadcrumb "All Matrices > {name}" with back link. Multiple open matrices = navigate via list, not tabs (keep UI simple).
- `client/src/features/selfStudy/SubmissionWorkflow/CommonErrorsPanel.tsx` (extend in S5.1 dependency) — when checking matrix↔narrative congruence, iterate ALL matrices for the submission, not just the first.
- `server/src/services/commonErrorChecks.ts` (S5.1, future) — same: iterate all matrices.

**Steps:**
1. Add `MatrixListView` UI inside the Matrix tab.
2. Wire create + archive endpoints.
3. Update the Matrix tab navigation to flow list → editor → back to list.
4. Surface course-count + row-count summary in the list.
5. Add a hint banner: *"Use additional matrices when one isn't wide enough for all courses (max ~20 courses per matrix recommended)."*

**Acceptance:**
- [ ] Coordinator can create multiple matrices for one submission via the "+ New Matrix" button.
- [ ] List view shows all matrices with metadata.
- [ ] Archived matrices removed from list but preserved in DB.
- [ ] Common-error congruence check (S5.1) iterates all matrices when it lands.

**Test plan:**
- **Unit:** `client/src/features/selfStudy/MatrixEditor/MatrixListView.test.tsx` — list renders with N matrices; create button opens modal; archive button confirms then removes from list.
- **System / integration:** `server/tests/integration/multi-matrix-per-submission.test.ts` — create 3 matrices on one submission via supertest; assert `Submission.curriculumMatrices` length is 3; archive one → list returns 2; archived row still in DB with `archived: true`.
- **System / integration:** `client/src/features/selfStudy/Editor/SelfStudyEditor.test.tsx` (extend) — open Matrix tab → list visible; click a matrix → editor view; click back → list view.
- **E2E:** covered by S6.4 coordinator journey (create a submission, add 2 matrices, fill differently, assert both saved + visible).

**Estimate:** 2 days. **Depends:** S4.3, S4.8.

## S4.4 — Fix EvidenceViewer spec-letter hardcoding

**Source:** [[incomplete-features-2026-05-11#n3]], [[evidence-file-storage#quirks]].

**Files:**
- `client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx:283-304` — replace the hardcoded `Array.from({length: 21})` and `['a'..'h']` with `useQuery` against `/api/standards`, then dependent dropdown driven by selected Standard's actual `specifications` array (`a` through `f`).

**Acceptance:**
- [ ] Dropdown shows the live standards list (mirrors FileLibrary's already-correct pattern).
- [ ] No more `g` / `h` options that point to non-existent specs.

**Test plan:**
- **Unit:** N/A — straightforward query wiring.
- **System / integration:** `client/src/features/selfStudy/EvidenceManager/EvidenceViewer.test.tsx` — MSW returns 5 specs with letters a-f for a Standard → dropdown shows exactly 6 options (one empty + a-f), no g/h. Selecting Standard 11 → dependent dropdown filtered to that Standard's specs.
- **E2E:** covered by S6.4 coordinator journey (link evidence to Standard 11 Spec a → assert dropdown options).

**Estimate:** 0.5 days.

## S4.5 — Show "Unassigned" accordion in FileLibrary

**Source:** [[incomplete-features-2026-05-11|N2 carried]], [[evidence-file-storage]].

**Files:**
- `client/src/features/selfStudy/FileLibrary/FileLibrary.tsx:914-933` — render an extra "Unassigned" accordion before Part I when `evidenceByStandard['unassigned']` is non-empty.

**Acceptance:**
- [ ] Files without `standardCode` are visible in this view (not just in EvidenceManager's "Unlinked" filter).
- [ ] User can click an unassigned file's row to open a "Link to Standard" modal.

**Test plan:**
- **Unit:** N/A — presentational.
- **System / integration:** `client/src/features/selfStudy/FileLibrary/FileLibrary.test.tsx` (extend) — fixture data with 2 unassigned files → "Unassigned" accordion renders with count badge; click a row → "Link to Standard" modal opens.
- **E2E:** covered by S6.4 coordinator journey if unassigned-evidence fixture added; otherwise integration covers.

**Estimate:** 0.5 days.

## S4.6 — Cleanup: dead fields + two-description tech debt

**Source:** [[incomplete-features-2026-05-11|N1 carried]], [[evidence-file-storage#quirks]].

**Files:**
- `server/src/models/SupportingEvidence.ts` — pick `description` as canonical; deprecate `metadata.description`. Migration to copy any `metadata.description` to top-level.
- Remove `imageMetadata.ocrText` and `linkedNarratives[]` fields (dead).
- `client/src/features/selfStudy/Editor/EvidencePanel.tsx:215-217` — simplify `getDescription`.

**Acceptance:**
- [ ] All UI reads from `description` only.
- [ ] No code references the removed fields.
- [ ] Migration script idempotent.

**Test plan:**
- **Unit:** `server/tests/unit/evidence-description-migration.test.ts` — migration fn given fixture with `metadata.description: "X"` and empty top-level → top-level becomes "X". Idempotency: re-running the migration produces no further change.
- **System / integration:** `server/tests/integration/evidence-after-migration.test.ts` — after migration, all evidence rows have non-null top-level `description` where any source had a value.
- **E2E:** N/A — internal cleanup.

**Estimate:** 0.5 days.

## S4.7 — Bulk evidence upload by Spec range

**Source:** [[incomplete-features-2026-05-11|N6]].

**Files:**
- `client/src/features/selfStudy/FileLibrary/FileLibrary.tsx` — add "Bulk Upload" button. Drag-drop N files, prompt for default Standard/Sub-standard, OR offer to use Document Matcher (S6) to auto-classify.

**Acceptance:**
- [ ] Coordinator can drop 50 files and assign them all to Standard 11 in one action.

**Test plan:**
- **Unit:** N/A — UI orchestration.
- **System / integration:** `client/src/features/selfStudy/FileLibrary/FileLibrary.test.tsx` (extend) — drop 5 File objects → bulk-upload form appears; pick Standard + Spec → 5 POSTs to evidence/upload fire; assert progress UI.
- **System / integration:** `server/tests/integration/bulk-evidence-upload.test.ts` — N concurrent uploads to the same submission succeed without collision.
- **E2E:** covered by S6.4 coordinator journey (drop 3 files at once → assert all 3 land under the right Standard).

**Estimate:** 1 day.

---

## S4.10 — Reader-report DOCX export from template + auto-share with Lead Reader

**Source:** [[product-requirements#u4-reader-report-template-based-docx-export]] — user-requested 2026-05-14.

**Context:** [[client-features-deep-2026-05-10|comments + reviews]]. The existing PDF generator ([server/src/services/pdfGenerator.ts:31](../../../../server/src/services/pdfGenerator.ts#L31)) produces a generic PDF; the Handbook workflow requires a Word document filled from a CSHSE-issued template, with each reader's comments routed to the correct Standard / Sub-standard sections so the Lead Reader can compile. There is **one report per reader per submission**, and the template is chosen by `review.programLevel` — no manual selection.

**Files:**
- `docs/reader-report-templates/{associate,bachelors,masters}-reader-report-template.docx` — NEW. The three CSHSE-issued templates (Google Doc sources: `1YBs8V1LDNTvob80xU-dFQOCMCpEtwH07`, `1Xz8VItPH0a4OKuUttZK69WlK1D7XzmLB`, `13uvbdX5ySF6ygJJ4MkN2hiW5zMBk4OiO`). Saved as version-controlled DOCX with `{{standardN_comments}}` and `{{standardN_specM_comments}}` placeholders — one placeholder per Standard / Sub-standard the Handbook recognises (sourced from [data/standards.ts](../../../../server/src/data/standards.ts) so names cannot drift).
- `server/src/data/readerReportTemplates.ts` — NEW. Registry: `{ associate: { s3Key, placeholderMap }, bachelors: {...}, masters: {...} }`. `placeholderMap` enumerates every `standardCode` / `specCode` the template expects.
- `server/src/services/readerReportGenerator.ts` — NEW. `generateReaderReportDocx(reviewId): Promise<{ s3Key: string; buffer: Buffer }>`. Steps: fetch [Review](../../../../server/src/models/Review.ts), look up template by `review.programLevel`, fetch template DOCX from S3 (repo seed as fallback), fetch all [Comments](../../../../server/src/models/Comment.ts) authored by `review.reviewerId` for `submissionId = review.submissionId`, group by `(standardCode, specCode)`, render with `docxtemplater`, upload to S3 at `submissions/{submissionId}/reader-reports/{reviewerId}.docx`, persist `s3Key` on the Review.
- `server/src/controllers/reportController.ts` — NEW handler `generateReaderReportDocx` modelled on the existing `generateReaderReportPDF` ([reportController.ts:19](../../../../server/src/controllers/reportController.ts#L19)) but writes DOCX + uploads to shared storage.
- `server/src/routes/reports.ts:25` — add `POST /api/reports/reader/:reviewId/generate` (kicks off generation, returns s3Key) and `GET /api/reports/reader/:reviewId/docx` (streams or pre-signed-URL redirects).
- `server/src/models/Review.ts` — add `readerReportS3Key?: string; readerReportGeneratedAt?: Date`.
- `server/src/controllers/reviewController.ts:470` — `submitReview`: on transition to `submitted`, async-invoke `generateReaderReportDocx(review._id)` and persist the resulting key. Failures land in [ErrorLog](../../../../server/src/services/errorLogger.ts).
- `server/src/controllers/leadReaderController.ts` — extend the list-reviews-for-submission response to include `readerReportS3Key` so the Lead Reader UI can download.
- `client/src/features/admin/Settings/` — NEW `ReaderReportTemplatesPage.tsx` panel. Admin uploads each of the 3 templates to S3 under `reader-report-templates/{level}.docx`. Shows current filename + uploaded-at; supports replace. New tab on [SettingsPage.tsx](../../../../client/src/features/admin/Settings/SettingsPage.tsx).
- `client/src/features/reviewer/` (or the reader review-workflow surface) — "Generate Report" button on the reader's review-complete screen. Enabled only when `review.status === 'submitted'` (or when all `assessments` are complete). Calls `POST .../generate` then `GET .../docx` and saves to disk.
- `client/src/features/leadReader/` — compilation view lists each submitted reader and links to the auto-shared DOCX (download only — no Lead Reader upload; the auto-shared S3 copies *are* the upload).

**Steps:**
1. Add `docxtemplater` + `pizzip` to `server/package.json`. Both are MIT-licensed.
2. Save the three Google Doc templates locally as `.docx`. Replace static "comment goes here" placeholder cells with `{{standardN_comments}}` (e.g., `{{standard11_comments}}`) and `{{standardN_specM_comments}}` (e.g., `{{standard11_specA_comments}}`). Commit to `docs/reader-report-templates/`. **Hard prerequisite — templates must exist before the registry can resolve.**
3. Implement [`readerReportTemplates.ts`](../../../../server/src/data/readerReportTemplates.ts) registry, with placeholder names cross-checked against [data/standards.ts](../../../../server/src/data/standards.ts) at module load (throw on drift).
4. Implement [`readerReportGenerator.ts`](../../../../server/src/services/readerReportGenerator.ts). Group comments by `(standardCode, specCode)` and render replies inline. Names in the DOCX are real names (Lead Reader audience); PC-facing surfaces keep the [[#s1-1|reader-identity redaction]] from S1.1.
5. Add the controller + routes. RBAC: the reader who authored the review, the lead reader on the submission, and admin can fetch; everyone else 403.
6. Wire `submitReview` to fire generation asynchronously. Idempotent — re-submit overwrites the prior DOCX at the same S3 key.
7. Admin Settings panel — multipart POST to `/api/admin/reader-report-templates/:level` which calls [s3Service.uploadFile](../../../../server/src/services/s3Service.ts#L81).
8. Reader UI "Generate Report" button — enabled when the review is complete; spinner during generation; downloads the DOCX on success.
9. Lead Reader UI — render the per-reader download list. No upload UI.

**Acceptance:**
- [ ] Admin can upload each of the 3 templates from Settings; the currently active filename + uploaded-at is visible per level.
- [ ] Reader on the review-complete screen can generate a DOCX whose body contains every comment they authored, placed under the correct Standard / Sub-standard heading from the template.
- [ ] Template selection is driven entirely by `review.programLevel` — a Masters review never picks the Associate template; mismatching is impossible by construction.
- [ ] On `submitReview`, the DOCX is uploaded to `s3://{bucket}/submissions/{submissionId}/reader-reports/{reviewerId}.docx` and `Review.readerReportS3Key` is set within 10s. Re-submit overwrites the same key.
- [ ] Lead Reader sees a download link for each submitted reader's report on the compilation view; clicking downloads the auto-shared DOCX.
- [ ] One report per degree level — reader has no template picker.
- [ ] A reader who did not author the review gets 403 on both endpoints.

**Test plan:**
- **Unit:** `server/tests/unit/readerReportGenerator.test.ts` — table-driven: comments with 3 distinct `(standardCode, specCode)` triples → output buffer contains expected placeholder substitutions; missing-comments → placeholder renders empty. Use a tiny fixture DOCX (1 paragraph, 2 placeholders) in `server/tests/fixtures/`. Pure function; mock S3 template fetch.
- **Unit:** `server/tests/unit/readerReportTemplates.test.ts` — registry `placeholderMap` is a strict subset of [data/standards.ts](../../../../server/src/data/standards.ts) codes for the matching program level (anti-drift).
- **System / integration:** `server/tests/integration/reader-report-docx-generate.test.ts` — supertest: seed a submission + 3 reader comments + a stubbed `@aws-sdk/client-s3`; call `POST /api/reports/reader/:id/generate`; assert (a) `PutObjectCommand` invoked with the expected key, (b) `Review.readerReportS3Key` persists, (c) `GET .../docx` returns a non-empty buffer with `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- **System / integration:** `server/tests/integration/submit-review-auto-generates-docx.test.ts` — submit a review → assert the generator was invoked and `readerReportS3Key` is set within 2s (use fake timers + flush microtasks).
- **System / integration:** `server/tests/integration/reader-report-rbac.test.ts` — a reader who didn't author the review gets 403; a PC gets 403; the authoring reader, the lead reader on the submission, and admin succeed.
- **System / integration:** `client/src/features/admin/Settings/ReaderReportTemplatesPage.test.tsx` — RTL + MSW: upload form posts multipart for `level=associate`; list re-renders with new uploaded-at.
- **E2E:** extend S6.4 reviewer journey — complete a review → click "Generate Report" → assert DOCX downloads + Lead Reader sidebar shows the new file under the reader's entry.

**Estimate:** 3 days (1 day registry + generator, 0.5 admin upload UI, 0.5 reader UI button + workflow wire-up, 0.5 lead-reader UI, 0.5 tests). **Depends:** [[#s1-1|S1.1]] (reader-identity redaction — establishes who the DOCX is "for"); templates committed to `docs/reader-report-templates/` (hard prerequisite). **Blocks:** none (Lead Reader compilation can still proceed manually if the generator is offline).

---

**Sprint 4 grew on 2026-05-11** with the addition of S4.8 (template registry) and S4.9 (multi-matrix per submission). S4.3 also expanded from 4 to 5 days. **On 2026-05-14** S4.10 was added for the reader-report DOCX export (U4), +3 days.

**Sprint 4 success metrics:**
- 3 evidence UIs show review pills.
- Matrix client editor is functional **and template-driven** (largest Tier-1 gap closed; template-based per program level).
- Multi-matrix per submission supported (S4.9).
- Matrix template registry includes all 3 program levels with version-controlled DOCX references (S4.8).
- Reader-report DOCX export operational: 3 program-level templates uploaded; reader generates a DOCX on review-complete that auto-uploads to S3 for Lead Reader pickup (S4.10).
- Spec-letter hardcoding bug fixed.
- Total estimate: ~17 days (was ~14; +3 days S4.10). Clearly overflows a single-engineer 7-day sprint — needs two engineers or partial spill into Sprint 5.

---

# SPRINT 5 — Common-Error Checks, Completion Checklist & Test Coverage (2 weeks)

**Goal:** Mechanize the Handbook §IV "Common Errors" list. Block submission until checklist passes. Get to ≥60% server / ≥50% client line coverage.

**Prerequisites:** S3 (so checklist can include "evidence reviewed" as a check).

## S5.1 — Matrix↔narrative congruence check

**Source:** [[incomplete-features-2026-05-11|T2.2]].

**Files:**
- `server/src/services/commonErrorChecks.ts` — NEW. Function `checkMatrixCongruence(submissionId)` returns issues array:
  - Each course in matrix that isn't referenced in any narrative HTML.
  - Each course referenced in narrative that isn't on the matrix.
- `server/src/routes/submissions.ts` — `GET /api/submissions/:id/common-errors`.
- `client/src/features/selfStudy/SubmissionWorkflow/CommonErrorsPanel.tsx` — NEW. Section in pre-submit view.

**Acceptance:**
- [ ] Curriculum mismatch surfaces in the panel.
- [ ] Can be overridden with rationale (writes to `Submission.commonErrorOverrides[]`).

**Test plan:**
- **Unit:** `server/tests/unit/checkMatrixCongruence.test.ts` — fixture submission with course "HSV101" in matrix but absent from narratives → issue list contains "HSV101 not referenced." Same fixture, narrative references "HSV999" missing from matrix → issue list contains "HSV999 referenced but not on matrix."
- **System / integration:** `server/tests/integration/common-errors-endpoint.test.ts` — `GET /api/submissions/:id/common-errors` returns issues for a known-bad fixture; override endpoint accepts rationale and persists `Submission.commonErrorOverrides[]`.
- **System / integration:** `client/src/features/selfStudy/SubmissionWorkflow/CommonErrorsPanel.test.tsx` — issues render; override form submits.
- **E2E:** covered by S6.4 coordinator journey (intentionally seed a mismatch → assert the panel surfaces it).

**Estimate:** 1.5 days.

## S5.2 — Missing-Spec + missing-required-document checks

**Source:** [[incomplete-features-2026-05-11|T2.2]].

**Files:**
- `server/src/services/commonErrorChecks.ts` — extend:
  - `checkMissingSpecs(submission)` → any Spec with empty narrative.
  - `checkMissingRequiredDocs(submission, programLevel)` → comparison against a hardcoded `REQUIRED_DOC_CATEGORIES` per [[product-requirements#tier-2]]. Examples: syllabi for every course on the matrix, advisory minutes (≤2 yrs old), evaluation forms, student handbook, etc.
- `server/src/data/requiredDocs.ts` — NEW. The 14-or-so categories from the Handbook.

**Acceptance:**
- [ ] Submission missing a Spec narrative shows in the panel.
- [ ] Submission missing any required document category shows.

**Test plan:**
- **Unit:** `server/tests/unit/checkMissingSpecs.test.ts` — submission with Spec 11.b narrative empty → issue list contains "11.b empty." All filled → empty list.
- **Unit:** `server/tests/unit/checkMissingRequiredDocs.test.ts` — fixture submission missing "advisory_minutes" category → issue. Provide one matching evidence → issue resolved.
- **System / integration:** `server/tests/integration/common-errors-rollup.test.ts` — submission with multiple gaps (missing Spec narrative + missing required-doc category) → both surfaced in one GET response.
- **E2E:** covered by S6.4 coordinator journey via the panel.

**Estimate:** 1.5 days.

## S5.3 — Unlinked references scanner + broken-link page

**Source:** [[incomplete-features-2026-05-11|T2.2]], extends S1.3.

**Files:**
- `server/src/services/commonErrorChecks.ts` — `checkUnlinkedReferences(submission)`:
  - Scan narrative HTML for "Appendix X" / "Exhibit Y" references.
  - Cross-check against uploaded evidence titles / descriptions.
  - Report each reference with no matching evidence.
- `server/src/services/cronJobs.ts` — extend with `verifyAllUrls()` action.
- `client/src/features/admin/Settings/LinkHealthPage.tsx` — NEW. Lists every URL evidence with status + last verified.

**Acceptance:**
- [ ] "Refers to Appendix C but no evidence is titled Appendix C" surfaces.
- [ ] Admin link-health page shows aggregate URL status.

**Test plan:**
- **Unit:** `server/tests/unit/checkUnlinkedReferences.test.ts` — narrative HTML "see Appendix C" + zero evidence titled "Appendix C" → issue. Add matching evidence → resolved. Case-insensitive match.
- **System / integration:** `server/tests/integration/url-reprobe-cron.test.ts` — daily cron flips a previously-ok URL to broken when probe returns 404; admin link-health page surfaces it.
- **System / integration:** `client/src/features/admin/Settings/LinkHealthPage.test.tsx` — MSW fixture with mixed statuses; aggregate counts correct; click row → detail.
- **E2E:** covered by S6.4 admin journey (admin opens LinkHealthPage → assert seeded broken-link visible).

**Estimate:** 2 days. **Depends:** S1.3.

## S5.4 — Self-Study Completion Checklist as pre-submit gate

**Source:** [[incomplete-features-2026-05-11|T2.4]].

**Files:**
- `server/src/services/completionChecklist.ts` — NEW. Aggregates:
  - Every Spec has narrative ≥ N chars.
  - Every required-doc category has ≥1 evidence file.
  - Every URL evidence is accessible.
  - Matrix congruence passes (S5.1).
  - All AI validations pass (or have override rationale).
- `server/src/controllers/submissionController.ts` — `POST /api/submissions/:id/submit` checks this; rejects with 422 + issue list if not green.
- `client/src/features/selfStudy/SubmissionWorkflow/CompletionChecklist.tsx` — NEW. Required-items checklist with green/red pills + jump-to actions.
- Admin bypass: admin role can `POST /submit?bypass=true` with a reason.

**Acceptance:**
- [ ] Submit blocked until checklist green (or admin bypass).
- [ ] Coordinator sees actionable list of what's missing.

**Test plan:**
- **Unit:** `server/tests/unit/completionChecklist.test.ts` — checklist function takes a submission state, returns checklist with `{key, passed: boolean, message}`. Cover all required-items × pass/fail.
- **System / integration:** `server/tests/integration/submit-checklist-gate.test.ts` — POST `/submit` with red checklist → 422 + issue list; with green checklist → 200; with admin token + `bypass=true&reason="..."` → 200 with audit row.
- **System / integration:** `client/src/features/selfStudy/SubmissionWorkflow/CompletionChecklist.test.tsx` — green/red pills; Submit button disabled until green; jump-to action navigates.
- **E2E:** covered by S6.4 coordinator journey (attempt submit on incomplete → blocked → fill remaining → submit succeeds).

**Estimate:** 2 days. **Depends:** S5.1, S5.2.

## S5.5 — Server test coverage: marker round-trip + S3 + RBAC matrix

**Source:** [[sprint-plan-2026-05-10#sprint-5]] carried + [[code-review-2026-05-10]] gaps.

**Files (test scaffolds already exist in `server/tests/` — extend):**
- `server/tests/integration/gridfs-marker-roundtrip.test.ts` — NEW. Insert marker, restore, assert byte-identical original.
- `server/tests/integration/s3-service.test.ts` — NEW. Mock S3 client; cover upload / download / delete / presigned URL TTL.
- `server/tests/integration/evidence-rbac.test.ts` — NEW. Table-driven: 4 roles × own-vs-other-institution × CRUD.
- `server/tests/unit/validation-retry.test.ts` — NEW. With fake timers, assert retry/backoff (S3.5).

**Acceptance:**
- [ ] Server line coverage ≥60%.
- [ ] Marker round-trip test passes byte-identical assertion (incl. table-frag case).

**Test plan:**
- **Unit:** the listed test files ARE the deliverable for unit-level coverage of marker logic, S3 client wrappers, retry function.
- **System / integration:** the listed test files ARE the deliverable for integration-level coverage. RBAC matrix is the highest-value addition.
- **E2E:** N/A — this sprint is about server unit + integration test coverage. E2E is S6.4.

**Estimate:** 3 days.

## S5.6 — Client test coverage: autosave, table-row removal, evidence error toasts

**Source:** [[sprint-plan-2026-05-10#sprint-5]] carried.

**Files:**
- `client/src/features/selfStudy/Editor/NarrativeEditor.test.tsx` — NEW. Autosave 2s debounce; don't-save-on-load regression.
- `client/src/features/selfStudy/Editor/components/DocumentViewer.test.tsx` — NEW. Table-aware row removal (boundary touches, multi-row spans, orphaned cells).
- `client/src/features/selfStudy/EvidenceManager/EvidenceManager.test.tsx` — NEW. Delete error toast (regression for [[frontend-architecture|silent-failure]]).
- `client/src/features/admin/WebhookSettings/WebhookSettings.test.tsx` — NEW. API key never echoed back.

**Acceptance:**
- [ ] Client line coverage ≥50%.

**Test plan:**
- **Unit:** test files listed under Files above. Heavy on isolated hook + component behavior.
- **System / integration:** same files with MSW for any backend-dependent assertions (e.g., autosave PATCH success/failure paths).
- **E2E:** N/A this sprint — E2E covered by S6.4 journeys.

**Estimate:** 2.5 days.

## S5.7 — Fix carried `auth-routes` failing tests

**Source:** [[code-review-2026-05-10#findings-carried-forward]].

**Files:**
- `server/tests/integration/auth-routes.test.ts:110,132,142` — 3 change-password tests currently fail with 404. Likely route mounting drift since tests were written.
- Investigate `server/src/routes/auth.ts` change-password handler; either fix the route or fix the tests.

**Acceptance:**
- [ ] All 23 server tests pass.

**Test plan:**
- **Unit:** N/A — these ARE tests being fixed.
- **System / integration:** `server/tests/integration/auth-routes.test.ts` at lines 110, 132, 142 (the three failures) — after fix, all 23 tests in this file pass.
- **E2E:** N/A.

**Estimate:** 0.5 days.

---

**Sprint 5 success metrics:**
- All Common-Error checks in [[product-requirements#tier-2]] implemented.
- Completion checklist blocks submit.
- Test coverage: ≥60% server, ≥50% client.
- Total estimate: ~13 days.

---

# SPRINT 6 — Board Decisions, Cycle Scheduler, E2E & Polish (2 weeks)

**Goal:** Close the loop after the Board decides. Schedule the recurring 5/10-year cycles. Full E2E coverage. Ops runbooks and accessibility polish.

**Prerequisites:** S3.7 (emails wired), S5 (tests passing).

## S6.1 — Board decision notification flow

**Source:** [[incomplete-features-2026-05-11|T2.6]].

**Files:**
- `server/src/services/decisionNotifications.ts` — NEW. Hooks on `Submission.decision` write:
  - Schedule informal-notice email at +0 days (10-day SLA buffer).
  - Schedule formal-notice email at +30 days (with PDF cover letter).
  - Website-post hook (POST to a configurable URL with the decision payload).
- `server/src/models/Submission.ts` — add `decision.informalSentAt`, `formalSentAt`, `webPostedAt`.
- `client/src/features/admin/Settings/BoardDecisionsPage.tsx` — NEW. View / re-send / mark-as-posted.

**Acceptance:**
- [ ] Decision write triggers informal email immediately.
- [ ] 30-day formal email scheduled (job queue or cron-driven date check).
- [ ] Website-post webhook fires once.

**Test plan:**
- **Unit:** `server/tests/unit/decisionNotifications.test.ts` — schedule fn given a fresh decision returns 3 scheduled jobs at the right offsets.
- **System / integration:** `server/tests/integration/decision-flow.test.ts` — write `Submission.decision` → immediate informal email queued; advance frozen time +30d → formal email + website-post webhook fire exactly once; re-send action works idempotently.
- **System / integration:** `client/src/features/admin/Settings/BoardDecisionsPage.test.tsx` — view / re-send / mark-as-posted controls operate.
- **E2E:** covered by S6.4 admin journey if decision-fixture seed added.

**Estimate:** 2 days. **Depends:** S3.7, S3.8.

## S6.2 — Cycle scheduler (5-year interim, 10-year full) + 2-year initial deadline

**Source:** [[incomplete-features-2026-05-11|T3.1, T3.3]].

**Files:**
- `server/src/models/AccreditationCycle.ts` — NEW. `{ institutionId, type: 'initial' | 'interim' | 'full', dueAt, completedAt? }`.
- `server/src/services/cronJobs.ts` — extend with `checkCycleReminders()`:
  - Initial: warn 6 months before 2-year deadline; forfeit if not complete.
  - Interim (5-year): remind 6 months out.
  - Full (10-year): remind 12 months out.
- Migration: backfill from `Institution.accreditationDeadline`.

**Acceptance:**
- [ ] Each institution gets a `next_due` displayed on Dashboard.
- [ ] Email sent at correct horizons.

**Test plan:**
- **Unit:** `server/tests/unit/cycleReminder-derivation.test.ts` — given a cycle `{type, dueAt}`, which horizons (12mo / 6mo / 30d) trigger reminders. Boundary tests.
- **System / integration:** `server/tests/integration/cycle-scheduler.test.ts` — frozen-time fixture: institution with initial cycle due in 19 months → no reminder. Fast-forward to 6 months out → email + dashboard banner. Fast-forward to overdue → forfeit warning email.
- **System / integration:** `server/tests/integration/cycle-backfill-migration.test.ts` — migration creates AccreditationCycle rows from existing Institution.accreditationDeadline.
- **E2E:** covered by S6.4 admin journey (dashboard banner visible on a seeded near-due cycle).

**Estimate:** 2 days.

## S6.3 — Mock site visit checklist + 2.5-day itinerary template

**Source:** [[incomplete-features-2026-05-11|T1.6, T3.4]].

**Files:**
- `server/src/data/siteVisitTemplate.ts` — NEW. The Handbook's sample 2.5-day schedule encoded as an importable template (sessions, suggested attendees, durations).
- `client/src/features/siteVisits/SiteVisitScheduler.tsx` — "Use template" button on create form.

**Acceptance:**
- [ ] User creating a new visit can apply the template and edit from there.

**Test plan:**
- **Unit:** `server/tests/unit/siteVisitTemplate.test.ts` — template shape is parseable; total duration ≈ 2.5 days.
- **System / integration:** `client/src/features/siteVisits/SiteVisitScheduler.test.tsx` (extend) — "Use template" button applies the template; user can edit afterward; save persists the resulting agenda.
- **E2E:** covered by S6.4 admin journey (apply template → schedule → assert agenda renders).

**Estimate:** 1 day.

## S6.4 — Seed endpoint + E2E coordinator/reviewer/lead-reader/admin journeys

**Source:** [[sprint-plan-2026-05-10#sprint-6]] carried.

**Files:**
- `server/src/routes/test.ts` — NEW. **Only mounted when `NODE_ENV=test` OR `E2E_SEED=1`** (hard-gated). `POST /api/test/seed` creates known fixture users, an institution, a submission with a partial self-study, an assigned reader, a lead reader.
- `e2e/tests/coordinator-journey.spec.ts` — NEW. Login → create submission → import sample DOCX → tag 2 sections → finish tagging → edit narrative → upload evidence → trigger validation → see result.
- `e2e/tests/reviewer-journey.spec.ts` — NEW. Login → open assigned review → Y/N/NA on 3 specs → add comments → submit.
- `e2e/tests/lead-reader-journey.spec.ts` — NEW. Login → comparison view → resolve disagreement → set final determination.
- `e2e/tests/admin-journey.spec.ts` — NEW. Invite a coordinator → impersonate → configure webhook → test it.
- `e2e/tests/login.spec.ts` — un-skip the existing test.
- `e2e/helpers/auth.ts` — programmatic login helper.

**Acceptance:**
- [ ] All 4 journeys pass.
- [ ] Total E2E runtime ≤5 min.
- [ ] Seed endpoint cannot be hit in production (assert via integration test in production-like env).

**Test plan:**
- **Unit:** `server/tests/unit/seed-endpoint-gating.test.ts` — `mountTestRoutes()` returns nothing when `NODE_ENV=production` AND `E2E_SEED!=1`.
- **System / integration:** `server/tests/integration/seed-endpoint-prod-gate.test.ts` — fire request against a `NODE_ENV=production` app → 404. Same against `E2E_SEED=1` → 200 + seed completes.
- **E2E:** the four Playwright spec files listed above ARE the deliverable. Each runs against a freshly-seeded DB. Visual regression budget: `toHaveScreenshot()` on 5 critical pages (dashboard, editor, evidence library, validation modal, lead-reader compilation).

**Estimate:** 3 days.

## S6.5 — DOCX→PDF conversion (the deferred half of S1.4)

**Source:** S1.4 deferred.

**Files:**
- `server/src/services/pdfConvert.ts` — NEW. Use `libreoffice-convert` (Docker'd headless soffice) OR a managed service (CloudConvert) if libreoffice in the Railway container is too heavy. Recommend libreoffice in a separate Railway service.
- `server/src/controllers/evidenceController.ts` — implement the `POST /api/evidence/:id/convert-to-pdf` placeholder from S1.4.

**Acceptance:**
- [ ] A .docx evidence can be converted to PDF; new version saved with `isCurrentVersion: true`.

**Test plan:**
- **Unit:** `server/tests/unit/pdfConvert.test.ts` — given a stubbed converter, function returns the new PDF buffer; failure path throws cleanly.
- **System / integration:** `server/tests/integration/docx-to-pdf-flow.test.ts` — POST `/api/evidence/:id/convert-to-pdf` on a fixture DOCX evidence → new SupportingEvidence row with `mimeType: application/pdf`, `isCurrentVersion: true`, prior row marked `replacedById`.
- **E2E:** covered by S6.4 coordinator journey (after S1.4 soft-block modal, choose "Convert to PDF" → assert PDF version appears in evidence list).

**Estimate:** 2 days. **Risk:** infra-touchy; defer to S+1 if blocking.

## S6.6 — Restore-marker atomicity fix

**Source:** [[storage-layer]], [[incomplete-features-2026-05-10|hardening]], [[import-marker-mechanism#atomicity-caveat]].

**Files:**
- `server/src/services/gridFsService.ts:1390` — currently writes new file then deletes old. If delete fails, two files exist for `{importId}.html`. Two options:
  - (a) Use Mongo transactions for the new-file-write + old-file-delete (requires replica set; check infra).
  - (b) Add a periodic cleanup that compares `bucket.find({filename: 'X.html'})` results and keeps only the newest by `uploadDate`.

**Acceptance:**
- [ ] After a forced delete failure, the next read still returns the new file (not the orphaned old one).

**Test plan:**
- **Unit:** `server/tests/unit/gridfs-atomicity.test.ts` — given a faulty bucket whose `delete()` rejects after a successful new-file `finish`, the chosen strategy (transaction or version-pick) still yields a valid latest-only read.
- **System / integration:** `server/tests/integration/restoreMarker-fault-injection.test.ts` — restore section while injecting a delete failure; next `getHtmlContent()` returns the new (post-restore) bytes, not the orphan.
- **System / integration:** `server/tests/integration/orphan-detection.test.ts` — after a forced two-file state, the cleanup mechanism reduces back to one.
- **E2E:** N/A — internal correctness.

**Estimate:** 1.5 days.

## S6.7 — Ops runbooks

**Source:** [[documentation-gaps-2026-05-10]].

**Files:**
- `DEPLOY.md` — Railway + MongoDB Atlas + S3 + SMTP + n8n setup, step by step.
- `N8N-SETUP.md` — how to import all 6 workflows + Supabase schema; credential mapping; **drift table** from [[repo-docs-reference]] addressed.
- `ADMIN-RUNBOOK.md` — invite users, configure webhooks, troubleshoot common issues, where to find logs.
- `server/.env.example` — every env var the code currently reads.

**Acceptance:**
- [ ] Following DEPLOY.md cold produces a working instance.
- [ ] `.env.example` is complete (manual diff against `grep -r 'process.env' server/src/`).

**Test plan:**
- **Unit:** N/A — documentation.
- **System / integration:** `server/tests/integration/env-example-completeness.test.ts` — grep `process.env\.[A-Z_]+` across `server/src/`; assert every variable appears in `.env.example`. CI fails if drift.
- **E2E:** manual — fresh engineer follows DEPLOY.md cold on a new Railway project and confirms a working instance. Time-box to 1h; if it takes longer, the doc has a gap.

**Estimate:** 1.5 days.

## S6.8 — Accessibility pass

**Source:** [[frontend-architecture#accessibility]], [[incomplete-features-2026-05-10]] hardening.

**Files:**
- `client/src/features/selfStudy/Editor/NarrativeEditor.tsx` (toolbar) — `aria-label` on every icon-only button.
- All other icon-only buttons across `client/src/features/*` — same.
- Keyboard navigation testing in the toolbar and tagging modal.

**Acceptance:**
- [ ] Every icon-only button has an `aria-label`.
- [ ] Tab through the editor reaches every action.

**Test plan:**
- **Unit:** `client/src/test/axe.ts` — helper to run `axe-core` against a rendered tree.
- **System / integration:** `client/src/features/selfStudy/Editor/NarrativeEditor.a11y.test.tsx`, `Layout.a11y.test.tsx`, `Dashboard.a11y.test.tsx` — axe scan finds 0 violations of the documented rules (color-contrast, button-name, label).
- **System / integration:** keyboard-nav test using @testing-library/user-event: Tab through toolbar reaches every action without skipping any.
- **E2E:** `e2e/tests/accessibility.spec.ts` — Playwright + @axe-core/playwright on critical pages.

**Estimate:** 1 day.

## S6.9 — ErrorLog TTL + size cap + admin viewer

**Source:** [[security-audit-2026-05-10|L4]], [[incomplete-features-2026-05-10]].

**Files:**
- `server/src/models/ErrorLog.ts` — add TTL index: `{ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }`.
- `client/src/features/admin/Settings/ErrorLogPage.tsx` — paginated viewer with filter.

**Acceptance:**
- [ ] Error logs older than 90 days disappear.
- [ ] Admin can browse.

**Test plan:**
- **Unit:** N/A — schema change.
- **System / integration:** `server/tests/integration/errorlog-ttl.test.ts` — insert 3 ErrorLog rows with `createdAt` set to 91 days ago via fixture; let Mongo TTL monitor run (or trigger directly via `db.errorlogs.find().expireAfterSeconds`); assert rows gone after sweep.
- **System / integration:** `client/src/features/admin/Settings/ErrorLogPage.test.tsx` — MSW paginated fixture; filters work; truncated stack rendered.
- **E2E:** covered by S6.4 admin journey (ErrorLog page renders with seeded rows).

**Estimate:** 1 day.

## S6.10 — Re-run audits + close-out

**Source:** [[sprint-plan-2026-05-10#cross-cutting-tracks]].

**Steps:**
1. Re-run security audit. Save as `security-audit-2026-MM-DD.md` (don't edit the original).
2. Re-run incomplete-features audit. Save as `incomplete-features-2026-MM-DD.md`.
3. Update [[code-review-2026-05-10]] with a new dated review documenting what changed.
4. Update concept pages: [[storage-layer]], [[import-pipeline]], [[narrative-storage]], [[evidence-file-storage]], [[n8n-integration]] all need fresh `last_reviewed`.

**Acceptance:**
- [ ] New audit pages created.
- [ ] All concept pages have current `last_reviewed`.

**Test plan:**
- **Unit:** N/A — documentation work.
- **System / integration:** automated drift check: a CI script greps concept pages for `last_reviewed` dates older than 60 days and warns.
- **E2E:** N/A.

**Estimate:** 1.5 days.

---

**Sprint 6 success metrics:**
- Board-decision flow live.
- Cycle scheduler running.
- 4 E2E journeys pass.
- Ops runbooks complete; deploy-from-scratch works.
- Re-audit shows 0 Criticals, ≤2 Highs.
- Total estimate: ~16 days. Probably overflows — defer S6.5 if needed.

---

# SPRINT 7 — Multi-Institution Organization (Joint Ventures) (~7 days)

**Goal:** Add a cosmetic / organizational layer above institutions to group 2+ institutions into a "Joint Venture." Dashboard + admin UI grouping; aggregate reporting filter; **no permission changes** ([[product-requirements#u2-joint-ventures-institution-grouping]]).

**Prerequisites:** S2.10 (multi-PC) — the JV view correctly reflects multi-PC institutions. S6.4 (E2E + seed endpoint) so JV journeys can be added to the existing journey suite.

## S7.1 — Joint Venture data model + REST API

**Source:** [[product-requirements#u2-joint-ventures-institution-grouping]] — user requirement raised 2026-05-11.

**Context:** [[module-catalog]], [[system-architecture]].

**Files:**
- `server/src/models/JointVenture.ts` — NEW. Fields: `name (unique, required)`, `description?`, `institutionIds: ObjectId[] (required, min 2)`, `archived: boolean`, `createdBy`, `createdAt`, `updatedAt`. Indexes: unique on `name`, plus `(institutionIds)` for reverse lookup.
- `server/src/models/Institution.ts` — add `jointVentureId?: ObjectId` for fast reverse lookup. Maintained in sync with JointVenture.institutionIds via the controller (or via a save hook on JointVenture).
- `server/src/controllers/jointVentureController.ts` — NEW. Endpoints: `GET /` (list, supports `?archived=false` filter), `GET /:id`, `POST /` (admin only, requires ≥2 institutionIds), `PUT /:id` (admin only), `DELETE /:id` (soft archive), `POST /:id/institutions` (add member), `DELETE /:id/institutions/:institutionId` (remove member). Validation: an institution can be in at most ONE active JV; a JV must always have ≥2 active institutions or it auto-archives.
- `server/src/routes/jointVentures.ts` — NEW. Mount under `/api/joint-ventures`. Admin-only for CUD; PC/Reader/Lead can GET a JV they belong to (their institution is a member).
- `server/src/index.ts` — wire the router.
- `server/src/migrations/backfillJointVenturePointer.ts` — NEW. After data is loaded, set `Institution.jointVentureId` from JointVenture.institutionIds. Idempotent.

**Steps:**
1. Create `JointVenture` model with the validation rules.
2. Add the reverse pointer on Institution; keep it consistent via controller logic (or a Mongoose post-save hook on JointVenture).
3. Build CRUD endpoints with RBAC matrix.
4. Validate the "single JV per institution" invariant.
5. Validate the "minimum 2 institutions" invariant on JV update.

**Acceptance:**
- [ ] Admin can create a JV with ≥2 institutions; create with <2 → 400.
- [ ] Adding an institution that's already in another JV → 409.
- [ ] Removing a member that brings count below 2 → JV auto-archives with audit-log entry.
- [ ] `Institution.jointVentureId` is populated and stays in sync.
- [ ] Non-admin GETs JV only if their institution is a member; otherwise 404 (don't leak existence).

**Test plan:**
- **Unit:** `server/tests/unit/JointVenture-model.test.ts` — schema validation: name uniqueness, ≥2 institutionIds enforced, archived default false.
- **Unit:** `server/tests/unit/jointVenture-invariants.test.ts` — `canAddInstitution(jv, instId)` rejects when institution already in another JV; `canRemoveInstitution(jv, instId)` triggers auto-archive when result <2 members.
- **System / integration:** `server/tests/integration/jointVenture-crud.test.ts` — admin creates JV; non-admin POST → 403; add/remove member endpoints; auto-archive on member-count drop below 2; reverse-pointer on Institution stays in sync.
- **System / integration:** `server/tests/integration/jointVenture-rbac.test.ts` — PC of inst A (member of JV X) GETs JV X → 200; PC of inst B (not a member of JV X) → 404; admin → 200 from both.
- **System / integration:** `server/tests/integration/jointVenture-pointer-migration.test.ts` — backfill migration sets `Institution.jointVentureId` correctly; idempotent.
- **E2E:** covered by S7.3 + S6.4 admin journey extension (admin creates JV, assigns 2 institutions, navigates dashboard).

**Estimate:** 2.5 days. **Blocks:** S7.2 (UI needs the API), S7.3 (dashboard needs the model), S7.4 (reporting needs the model).

## S7.2 — Admin UI for Joint Venture management

**Source:** [[product-requirements#u2-joint-ventures-institution-grouping]].

**Files:**
- `client/src/features/admin/Settings/JointVentureManagement.tsx` — NEW. List view with create / edit / archive controls. Edit modal includes:
  - Name (required, unique-checked).
  - Description (optional).
  - Institution multi-select picker — filtered to institutions that are not already in another active JV; shows institution name + city + program level.
  - Submit disabled until ≥2 institutions selected.
- `client/src/features/admin/Settings/SettingsPage.tsx` — add new tab "Joint Ventures" to the admin navigation; visible only to admins.
- `client/src/features/admin/Settings/index.ts` — re-export.

**Steps:**
1. Build list view (name, member count, archived badge, edit/archive actions).
2. Build create/edit modal with the multi-select picker and validation.
3. Add the tab to SettingsPage.

**Acceptance:**
- [ ] Admin sees JV list; can create, edit, archive.
- [ ] Picker excludes institutions already assigned to another active JV.
- [ ] Submit disabled when <2 institutions selected (matches server validation).
- [ ] Archive prompt confirms; archived JVs filterable.

**Test plan:**
- **Unit:** N/A — UI orchestration over API.
- **System / integration:** `client/src/features/admin/Settings/JointVentureManagement.test.tsx` — RTL with MSW: render list with 3 fixture JVs; open create modal; pick institutions; submit fires POST with right payload; failure path renders error.
- **System / integration:** institution-picker filter test — fixture with 5 institutions, 2 already in another JV → picker only shows the 3 free ones.
- **E2E:** covered by S6.4 admin journey extension (admin creates a JV with 2 seed institutions; verifies it appears in list).

**Estimate:** 1.5 days. **Depends:** S7.1.

## S7.3 — Dashboard JV grouping for admin / PC / reader / lead-reader

**Source:** [[product-requirements#u2-joint-ventures-institution-grouping]].

**Files:**
- `client/src/features/dashboard/Dashboard.tsx` — for the **admin / lead-reader** variant: group institutions by their JV; render each JV as a section with a header showing JV name + member count + rolled-up status (active submissions, pending requests, upcoming deadlines). Institutions without a JV go in a "Standalone" group. JV grouping toggleable on/off.
- For the **PC** variant: if the coordinator's institution is in a JV, show a "Joint Venture: {name}" badge near the institution name. Optional click-through to a JV-overview page (defer to v1.1 if time-tight).
- For the **reader / lead-reader** variant: same JV badge appears on assignments where the institution belongs to a JV; provides context only — no permission impact.
- New API call: `GET /api/joint-ventures?membersOnly=true` returns only JVs the caller has visibility into (per S7.1 RBAC).

**Steps:**
1. Fetch the JV list filtered to caller-visible.
2. Group institutions by `institution.jointVentureId` in the dashboard memo.
3. Render section headers with rolled-up stats (pull from existing per-institution data — no new aggregation API yet; that's S7.4).
4. Add the JV badge component for PC/reader views.
5. Toggle to disable grouping (some admins prefer flat list).

**Acceptance:**
- [ ] Admin sees institutions grouped under JV section headers; "Standalone" group for non-JV institutions.
- [ ] PC sees a JV badge on their institution if applicable.
- [ ] Reader/lead-reader sees the same badge on their assignments.
- [ ] Toggle off → flat list (legacy behavior).

**Test plan:**
- **Unit:** `client/src/features/dashboard/groupByJv.test.ts` — pure grouping function: given a list of institutions and a list of JVs, returns `{ jvId → institutions[] } + standalone[]`.
- **System / integration:** `client/src/features/dashboard/Dashboard.test.tsx` — admin variant with fixture (3 institutions in 1 JV + 2 standalone) → assert section headers render correctly. PC variant with PC's institution in a JV → badge renders.
- **System / integration:** reader variant — assignment to an institution in a JV → badge appears.
- **E2E:** S6.4 admin journey extension: admin sets up a JV → opens dashboard → asserts grouping; impersonates PC → asserts badge.

**Estimate:** 2 days. **Depends:** S7.1.

## S7.4 — JV-level reporting roll-up + filter

**Source:** [[product-requirements#u2-joint-ventures-institution-grouping]].

**Files:**
- `server/src/controllers/reportController.ts` — extend existing report endpoints with optional `jointVentureId` query parameter; aggregate across all member institutions when present.
- `server/src/controllers/jointVentureController.ts` — new endpoint `GET /:id/aggregate-stats` returning `{ totalSubmissions, activeSubmissions, decisionsThisYear, openChangeRequests, upcomingSiteVisits }` rolled up across member institutions.
- `client/src/features/dashboard/Dashboard.tsx` — admin filter panel: add "Joint Venture" dropdown that filters institutions / change-requests / site-visits to JV members only.
- `client/src/features/admin/Settings/JointVentureManagement.tsx` — show per-JV aggregate-stats card on the list view.

**Steps:**
1. Add `jointVentureId` filter parameter to existing report endpoints.
2. Build the aggregate-stats endpoint.
3. Add JV filter dropdown to admin dashboard.
4. Add stat cards to JV management page.

**Acceptance:**
- [ ] Admin can filter dashboard by JV → only that JV's institutions visible.
- [ ] JV management page shows aggregate stats per JV.
- [ ] Reports endpoint with `jointVentureId` returns aggregated data across members.

**Test plan:**
- **Unit:** `server/tests/unit/jv-aggregate-stats.test.ts` — function rolls up metrics correctly across N member institutions.
- **System / integration:** `server/tests/integration/reports-jv-filter.test.ts` — GET reports with `?jointVentureId=X` returns only that JV's data; without the param returns all data.
- **System / integration:** `client/src/features/dashboard/Dashboard.test.tsx` — admin selects JV from dropdown → filter applied to all sections.
- **System / integration:** `client/src/features/admin/Settings/JointVentureManagement.test.tsx` (extend) — stat card per JV row.
- **E2E:** S6.4 admin journey extension (admin filters dashboard by a seed JV → verifies count matches expectation).

**Estimate:** 1 day. **Depends:** S7.1, S7.3.

---

**Sprint 7 success metrics:**
- Joint Venture entity exists with full CRUD + RBAC.
- Admin UI to manage Joint Ventures.
- Dashboards group institutions by JV (admin + lead-reader views) and show JV badges (PC + reader views).
- Aggregate reports filterable by JV.
- Zero permission changes — verified by re-running the full S5.5 RBAC matrix against the new model.
- Total estimate: ~7 days.

---

# Cross-cutting tracks (run alongside all sprints)

These don't fit in a single sprint:

- **Concept-page freshness** — every PR touching a Tier-1 surface updates its concept page (`gridFsService` → [[storage-layer]] + [[import-marker-mechanism]]; evidence → [[evidence-file-storage]]; etc.). Enforce via CI lint (forbid PRs that change a documented file without updating the linked concept page).
- **Test coverage ratchet** — once S5 establishes baseline, no PR may reduce line coverage by more than 0.5%. CI gate.
- **Drift sweep** — monthly check of [[repo-docs-reference]] drift table; either update doc or update code.
- **Memory / heap monitoring** — given the 370MB-document scenario, add a `process.memoryUsage()` probe on every `getHtmlContent()` call; log spikes > 1GB.

# Risks & mitigations

| Risk | Sprint | Mitigation |
|------|--------|------------|
| HMAC rollout breaks live n8n calls | S1 | Stage in a feature flag; coordinate cutover with n8n operator. |
| httpOnly cookie migration breaks every authenticated request | S2 | Feature flag; phased per-user rollout. |
| OpenAI cost runaway in evidence review | S3 | Per-institution daily token cap before any production traffic. |
| Email deliverability (Gmail/Outlook spam-folder a new sending domain) | S3 | SPF/DKIM/DMARC setup before non-dev rollout. |
| Matrix grid performance on 100+ courses | S4 | Virtualize via react-window; benchmark with 100×100 fixture. |
| Seed endpoint reachable in production | S6 | Hard-gate via `NODE_ENV` + integration test asserts 404 in prod-like env. |
| libreoffice deployment complexity | S6 | Defer to S+1 if Railway integration is rough. |
| Re-audit surfaces new Criticals | end of S6 | Reserve 20% buffer for a S7 patch cycle. |

# Success metrics — overall plan

| Metric | Baseline (2026-05-11) | Plan-end target (after S7) |
|--------|------------------------|----------------------------|
| Handbook-compliance violations | 4 (H1–H4) | 0 |
| Critical audit findings | 6 | 0 |
| High audit findings | 7 | ≤2 |
| Stubbed `// TODO: send email` sites | 11 | 0 |
| Server line coverage | low (initial scaffolding) | ≥60% |
| Client line coverage | low | ≥50% |
| E2E journeys | 0 | 4 (extended in S7 to cover JV flows) |
| Pre-submit checklist blocks submit | no | yes |
| Documented n8n setup | partial | complete |
| `'development-secret-key'` literal in repo | 8+ sites | 0 |
| Spec-letter dropdown bug | exists | fixed |
| Curriculum matrix client editor | view-only | **template-driven** spreadsheet editor; multi-matrix per submission; template registry covers all 3 program levels (U3) |
| Evidence AI review | 0 (metadata only) | per-file LLM judgments visible in UI |
| Reader 45-day deadline tracking | none | dueAt + reminders |
| Board decision notification automation | none | informal + formal + web post |
| `ImpersonationAudit` log | none | every switch recorded |
| Reader identity redaction to PCs | leaked | redacted |
| Multiple PCs per institution (U1) | not supported | supported (S2.10) |
| Joint Venture grouping (U2) | not supported | full CRUD + dashboard grouping + JV-filter reporting (Sprint 7) |
| Reader-report DOCX export (U4) | manual / generic PDF only | template-driven DOCX per degree level; comments slotted by Standard / Sub-standard; auto-uploaded to S3 for Lead Reader (S4.10) |

# Out of scope

- Public-facing program directory / accreditation status website (CSHSE runs separately).
- Membership dues lifecycle integration with Update Management, Inc. ([[product-requirements|T3.2]]).
- Migration off Railway / MongoDB Atlas.
- Mobile-native app.
- JV-level role permissions (Joint Ventures are explicitly cosmetic/UI per [[product-requirements#u2-joint-ventures-institution-grouping]]; if JV-level admins are ever needed, that's a separate feature).
- A coordinator-of-coordinators role within an institution (multi-PC per S2.10 treats all PCs as peers; no hierarchy).

# Related

- [[incomplete-features-2026-05-11]] — drives sprints 1–6
- [[security-audit-2026-05-10]] — drives sprints 1–2
- [[product-requirements]] — north-star for what to build
- [[evidence-document-review-pipeline]] — designs sprint 3 + 4
- [[evidence-file-storage]] — context for sprint 4
- [[import-marker-mechanism]] — context for S5.5 marker tests + S6.6 atomicity fix
- [[narrative-storage]] — context for save / validation flows touched in S3 + S5
- [[module-catalog]] — file-by-file reference for any "where do I edit X" question
- [[repo-docs-reference]] — drift table to consult before changing the integration contracts
- [[CLAUDE]] — vault schema (this plan was written to those rules)
