---
name: CR-054 — Retire the n8n validation path + close the callback security holes
description: Migrate the three live `triggerValidation` callers (interactive editor validate, validateStandard, revalidateFailedSections) onto the in-process cshse-ai `validateSection` path, then delete the unauthenticated n8n callback endpoints and rotate the hardcoded workflow key. Closes the standing security findings (public callbacks, hardcoded key, help-chat session isolation) that ride on the dead n8n surface.
type: change-request
cr_id: CR-054
status: shipped
priority: P1
source: [[n8n-integration]], [[security-audit-2026-05-10]], [[sprint-plan-2026-05-31]]
sprint_target: Post-V1 / dedicated CR (carries a user-visible behavior migration + a security fix; not sprint hygiene)
tags: [n8n, security, validation, cleanup, migration, webhooks]
last_reviewed: 2026-06-01
revision_history:
  - 2026-05-31 — proposed. Splits out the S14 "n8n dead-code removal" line, which was reclassified deferred-to-CR because `triggerValidation` is live, not dead.
  - 2026-06-01 — shipped (branch `developer`). All 3 phases implemented. Phase 1: env-gated `verifyN8nCallback` shared-secret guard on spec-loader/document-matcher callbacks; help-chat session bound to `sha256(userId:clientSessionId)`; hardcoded spec-loader key replaced with `{{ $env.CSHSE_CALLBACK_KEY }}`. Phase 2: the live editor "Validate" caller now hits in-process cshse-ai via `POST /api/webhooks/validate` → `runSectionValidation` → `validationService.validateSection`. Phase 3: deleted the `/api/webhooks/n8n/{validate,callback}` plumbing, `triggerValidation`, `processCallback`, `callWebhook`, `validateStandard`, `revalidateFailedSections` (~570 LOC net removed). Note: the chosen Phase-1 approach **removes** the validation callback rather than HMAC-verifying it (the headline C2 exploit is closed by deletion). Two **deferred ops steps** to fully enforce: set `N8N_CALLBACK_SECRET` on Railway and `CSHSE_CALLBACK_KEY` on the n8n instance (see Deferred ops, below).
---

# CR-054 — Retire the n8n validation path + close the callback security holes

## Summary

The portal's AI validation moved in-process (cshse-ai FastAPI) over CR-049, but only the **submit-gate** flow was re-pointed. Three callers still drive the legacy **n8n** `triggerValidation` path, and the four **public, unauthenticated** n8n callback endpoints remain mounted. This CR does two coupled things:

1. **Migrate** the three live `triggerValidation` callers onto the cshse-ai `validateSection` path (a user-visible behavior change — needs PC review).
2. **Close the security holes** that exist only because the n8n surface is still wired: the unauthenticated callback endpoints (exploitable: mark any failing section as passing), the hardcoded workflow API key, and broken help-chat session isolation. Then delete the now-dead n8n caller + callback code (~600 LOC).

This was the Sprint 14 "n8n dead-code removal" line. It was **reclassified deferred-to-CR** because the code is live, not dead — see [[n8n-integration]]. The security angle (below) is the reason it should be scheduled rather than left indefinitely.

## Source quotes

- [[n8n-integration]] S14 decision: "`triggerValidation` still backs three **live** callers … Decision: do NOT rip it out in S14. A wholesale removal would force re-pointing the three live callers … onto the cshse-ai `validateSection` path — a **user-visible behavior migration**, not hygiene … That deserves its own change-request with PC review. The unauthenticated-callback security findings … are the stronger reason to schedule that migration CR."
- [[security-audit-2026-05-10]] **C2:** "`POST /api/webhooks/{n8n,spec-loader,document-matcher,help/upload}/callback` mounted before any `authenticate` middleware … the validation callback accepts `submissionId + standardCode + specCode` from the body and updates the matching pending `ValidationResult` with attacker-supplied result data."
- [[security-audit-2026-05-10]] **C5:** "Redis chat memory key is `$json.body.sessionId || 'default'` … client-supplied with no user binding. Anyone reusing or guessing a sessionId reads another user's chat history."
- [[sprint-plan-2026-05-31]] Track C: "n8n validation dead-code removal — `validationService.triggerValidation` … + `/api/webhooks/n8n/callback`. No longer on the submit path since CR-049; ~600 LOC."

## Decision

Sequence the work so the security fix can land independently of the behavior migration:

**Phase 1 — Security (no behavior change, ship first):**
- Authenticate or HMAC-verify all four `/api/webhooks/*/callback` endpoints; reject duplicate `executionId` for idempotency (closes C2 + M7). If n8n is already decommissioned in the target env, the lower-risk move is to **404 the callbacks** outright.
- Rotate the hardcoded spec-loader workflow key (`cshse-specification-loader-pdf.json:102` — leaked value `cshse_eXPTLboS18Gjgw_BTwEVJhe8CBiAjq9B`) and move it to env config.
- Bind help-chat sessions to the authenticated user (`sessionId = sha256(userId + clientSessionId)`) + Redis TTL (closes C5). The help-chat RAG is the one path that may still legitimately route through n8n, so this stays even if validation n8n is removed.

**Phase 2 — Validation migration (user-visible, PC review required):**
- Re-point the three `triggerValidation` callers onto the cshse-ai `validateSection` path:
  1. Interactive editor validate — `NarrativeEditor.tsx:373` → `useValidationStatus.triggerValidation` (`useValidationStatus.ts:121`) → `POST /api/webhooks/n8n/validate` → `webhookController.triggerValidation` (`webhookController.ts:16`) → `validationService.triggerValidation` (`validationService.ts:218`).
  2. `validateStandard` — `validationService.ts:783`.
  3. `revalidateFailedSections` — `validationService.ts:806`, surfaced by `FailedValidations.tsx` ("Revalidate").
- Preserve the graceful-degrade contract: today `triggerValidation` self-degrades to a `pending` / "manual review required" result when no `WebhookSettings` is active (`validationService.ts:278-287`). The replacement must keep an equivalent fail-soft so the editor's validate action is never a hard error.

**Phase 3 — Delete dead code:**
- Remove `triggerValidation` + the `/api/webhooks/n8n/{validate,callback}` plumbing once Phase 2's callers no longer reference it (~600 LOC). Archive the external n8n evidence-node workflow definitions on the n8n instance (ops task, no server code).

## Acceptance

- [x] **Phase 1:** an unauthenticated `POST` to any `/api/webhooks/*/callback` is rejected — the n8n *validation* callback is **404** (deleted); spec-loader/document-matcher are **401** without the shared secret (when `N8N_CALLBACK_SECRET` is set); help/upload is **403/404** without a valid per-doc token. An attacker can no longer flip a failing `ValidationResult` to passing — the validation callback no longer exists. Pinned by `server/tests/integration/webhook-callback-security.test.ts` (inverted from the old "documents-broken-state" guard to assert the secured behavior).
- [x] **Phase 1:** the leaked spec-loader key is rotated out of the repo and read from env (`{{ $env.CSHSE_CALLBACK_KEY }}`); no plaintext key in `n8n-workflows/` (verified by grep — only throwaway `.claude/worktrees/` copies remained, not the main tree).
- [x] **Phase 1:** help-chat memory is keyed by `sha256(userId:clientSessionId)` (`helpChatController.ts` `sendChatMessage`), not the raw client `sessionId`; a second user with the same client sessionId cannot read the first's history.
- [x] **Phase 2:** the editor "Validate" action now produces a score via cshse-ai `validateSection` (`POST /api/webhooks/validate` → `runSectionValidation`). `validateStandard` and the n8n `revalidateFailedSections` were **dead** surfaces (the live "Revalidate" affordance already used `POST /api/submissions/:id/revalidate` → `submissionController.revalidateFailed` → `validateSection`) and were deleted rather than migrated. `validateSection` keeps the fail-soft contract (returns a result object even when the AI path errors). PC to confirm the in-editor validation UX during the walkthrough.
- [x] **Phase 3:** `triggerValidation` and the `/api/webhooks/n8n/{validate,callback}` routes are deleted; `grep -rn triggerValidation server/src` returns only CR-054 explanatory comments, no live code; the help-chat proxy still works (covered by client `HelpChat.test.tsx`).

## Files affected

- `server/src/routes/webhooks.ts:36,43,50,57` — the four public callback mounts (auth/HMAC or removal)
- `server/src/controllers/webhookController.ts:16,62-103,301-306` — `triggerValidation` + the permissive validation-callback lookup
- `server/src/services/validationService.ts:104,218,278-287,783,806` — `triggerValidation`, the graceful-degrade branch, `validateStandard`, `revalidateFailedSections`; `validateSection` is the replacement target
- `client/src/features/selfStudy/Editor/NarrativeEditor.tsx:373` — editor validate caller
- `client/src/hooks/useValidationStatus.ts:121` — client trigger
- `client/src/features/selfStudy/SubmissionWorkflow/FailedValidations.tsx` — "Revalidate" button
- `n8n-workflows/cshse-specification-loader-pdf.json:102` — hardcoded key to rotate
- `n8n-workflows/cshse-help-chat-agent.json:190` — client-supplied sessionId binding

## Dependencies

- [[cr-049-ai-section-evaluation-against-reader-criteria]] — provides the `validateSection` replacement path the migration targets.
- [[security-audit-2026-05-10]] — the C2 / C3-adjacent / C5 / M7 findings this CR closes.

## Deferred ops (to fully enforce — not code, no server change)

The code ships an **env-gated** guard so the live spec-loader / document-matcher n8n
workflows do not break on deploy. Two ops steps complete the rotation:

1. **Railway (CSHSE service, env `develop`):** set `N8N_CALLBACK_SECRET` to a freshly
   generated value. Until this is set, `verifyN8nCallback` passes through (no behavior
   change) — the spec-loader/document-matcher callbacks remain open. The leaked key is
   no longer in the repo regardless. The existing spec-loader workflow already sends the
   secret as `X-API-Key`, so the guard accepts either `X-Callback-Secret` or `X-API-Key`
   — setting the env to the rotated value is sufficient; the live workflow needs no edit
   beyond step 2.
2. **n8n instance:** set workflow env `CSHSE_CALLBACK_KEY` to the same rotated value
   (the spec-loader workflow JSON now reads `{{ $env.CSHSE_CALLBACK_KEY }}` instead of the
   hardcoded `cshse_eXPTLboS18Gjgw_BTwEVJhe8CBiAjq9B`).

Order: set both to the same new value (n8n first or simultaneously) so the callback keeps
authenticating. The headline C2 exploit (validation-callback result tampering) is **already
closed in code** by deletion and does not depend on these steps.

## Open questions (resolved)

- ~~Async vs sync in-editor validation?~~ **Resolved: synchronous.** `validateSection` is a
  blocking in-process cshse-ai call. The existing `useValidationStatus` poll loop still works
  unchanged — the persisted result is already final (not `pending`) on the first refetch, so it
  resolves on the first poll by matching `_id === pendingValidationId`.
- ~~Keep help-chat RAG on n8n?~~ **Deferred (out of scope for CR-054).** Phase 1 secured its
  session isolation either way; folding the RAG into cshse-ai (to fully decommission n8n) is a
  separate future CR. The spec-loader + document-matcher workflows still legitimately use n8n.
- ~~Is n8n already off in the deployed env?~~ **No — n8n is live** (`n8n.agileadautomation.com`,
  5 active WebhookSettings). So Phase 1 keeps the spec-loader/document-matcher callbacks (guarded),
  and only the *validation* callback was 404'd by removal.
