---
name: CR-054 — Retire the n8n validation path + close the callback security holes
description: Migrate the three live `triggerValidation` callers (interactive editor validate, validateStandard, revalidateFailedSections) onto the in-process cshse-ai `validateSection` path, then delete the unauthenticated n8n callback endpoints and rotate the hardcoded workflow key. Closes the standing security findings (public callbacks, hardcoded key, help-chat session isolation) that ride on the dead n8n surface.
type: change-request
cr_id: CR-054
status: proposed
priority: P1
source: [[n8n-integration]], [[security-audit-2026-05-10]], [[sprint-plan-2026-05-31]]
sprint_target: Post-V1 / dedicated CR (carries a user-visible behavior migration + a security fix; not sprint hygiene)
tags: [n8n, security, validation, cleanup, migration, webhooks]
last_reviewed: 2026-05-31
revision_history:
  - 2026-05-31 — proposed. Splits out the S14 "n8n dead-code removal" line, which was reclassified deferred-to-CR because `triggerValidation` is live, not dead.
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

- [ ] **Phase 1:** an unauthenticated `POST` to any `/api/webhooks/*/callback` is rejected (401/403/404) — an attacker can no longer flip a failing `ValidationResult` to passing. Integration test pins this.
- [ ] **Phase 1:** the leaked spec-loader key is rotated out of the repo and read from env; no plaintext key in `n8n-workflows/`.
- [ ] **Phase 1:** help-chat memory is keyed by an authenticated-user-derived hash, not the raw client `sessionId`; a second user with the same client sessionId cannot read the first's history.
- [ ] **Phase 2:** the editor "Validate" action, `validateStandard`, and the "Revalidate" button all produce a score via cshse-ai `validateSection`; with the AI path unreachable they degrade fail-soft (no hard error, no lost work). PC confirms the in-editor validation UX is acceptable.
- [ ] **Phase 3:** `triggerValidation` and the n8n validate/callback routes are deleted; `grep -r triggerValidation server/` returns nothing; the help-chat proxy still works.

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

## Open questions

- Does the in-editor validation need to stay **async** (fire + poll, as the n8n path was) or can it become a synchronous cshse-ai call? Affects the UX of the editor "Validate" button.
- Keep the help-chat RAG on n8n, or fold it into cshse-ai too? Phase 1 fixes its security either way; folding it in would let the n8n instance be fully decommissioned.
- For the deployed env: is the n8n instance already off? If so, Phase 1 simplifies to 404-ing the callbacks rather than authenticating them.
