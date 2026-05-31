---
name: N8N Integration
description: The five n8n workflows the portal calls into, the four public callback endpoints they call back to, and the documented-vs-actual retry behavior.
type: concept
tags: [n8n, webhooks, ai, async, integration, legacy]
last_reviewed: 2026-05-31
---

# N8N Integration

> **⚠️ LARGELY SUPERSEDED (2026-05-31).** This page documents the original "all AI runs in n8n" design. That is **no longer how the portal works**. The AI **import/matcher/spec-loader/validation** workflows have been replaced by the in-process [[legacy-self-study-import|cshse-ai FastAPI service]] (Standard/Spec tagging, matrix extraction, coverage, evidence scoring, section evaluation) and, for pre-submission checks, the server-side `GET /api/submissions/:id/preflight` endpoint (CR-008). The only path that may still route through n8n is the **help-chat RAG**. The four public callback endpoints described below still exist in the codebase but the import/validation callers no longer fire. Treat the workflow descriptions here as **historical**; for current architecture see [[system-architecture]] and [[module-catalog]]. This page is retained because the callback-endpoint security findings (hardcoded keys, unauthenticated callbacks) are still relevant until the dead code is removed.

All AI was originally offloaded to **n8n** workflows. The portal triggered them via HTTPS POST and received results on public callback endpoints.

## The five workflows

JSON exports live in [n8n-workflows/](../../../../n8n-workflows/).

### 1. `cshse-self-study-standard-validation.json`
Scores narrative + evidence against a single standard's text. GPT-4o-mini, 0–100 score, ≥80 = pass. Optionally fetches evidence URLs (15s timeout per URL, max 10 000 chars). **Failed URL fetches silently drop** — the LLM evaluates without that evidence and the user is never told.

### 2. `cshse-document-matcher.json`
Receives an imported document section (base64 HTML), strips embedded images and >500-char base64 strings, fetches all CSHSE specs from Supabase, asks GPT-4o-mini to classify, returns `{standard, subspecification, confidence, rationale}` per section as `section_result` callbacks. **Server-side caller for this is the missing N8N call from [[import-pipeline]]** — workflow exists but server never invokes it.

### 3. `cshse-specification-loader-pdf.json`
Receives a base64 PDF of a CSHSE standards document, parses with n8n's `readPDF`, embeds via `text-embedding-ada-002`, inserts into Supabase `cshse_specifications` table. **Hardcoded API key** in callback header (line 102): `cshse_eXPTLboS18Gjgw_BTwEVJhe8CBiAjq9B`. **Rotate immediately.** See [[security-audit-2026-05-10]].

### 4. `cshse-help-chat-agent.json`
LangChain Agent with a Vector Store Tool over the `help_documents` Supabase table (top-8 RPC `match_help_documents`), GPT-4o-mini, Redis Chat Memory keyed by client-supplied `sessionId`. **Session isolation is broken**: `sessionId` is provided by the client with no user binding, so any actor with the same sessionId sees the same chat history. See [[security-audit-2026-05-10]].

### 5. `cshse-help-document-upload.json`
Vectorizes the CSHSE Member Handbook + the project Readme into Supabase pgvector. PDF path uses n8n's PDF Vector Store Insert (auto-chunks). Text path chunks at 1000 chars / 200 overlap. No retries on embedding calls.

Schema for the help-doc table is in [n8n-workflows/supabase-help-documents.sql](../../../../n8n-workflows/supabase-help-documents.sql).

## Callback endpoints (server side)

All four are **public, no authentication**, defined in [server/src/routes/webhooks.ts](../../../../server/src/routes/webhooks.ts):

| Endpoint | Handler | Effect |
|----------|---------|--------|
| `POST /api/webhooks/n8n/callback` | `webhookController.receiveCallback` | Updates `ValidationResult` from pending → pass/fail. |
| `POST /api/webhooks/spec-loader/callback` | `receiveSpecLoaderCallback` | Marks spec as loaded. |
| `POST /api/webhooks/document-matcher/callback` | `receiveDocumentMatcherCallback` | Stores per-section match suggestions. |
| `POST /api/webhooks/help/upload/callback` | `receiveHelpUploadCallback` | Marks help doc as ingested. |

**The validation callback handler accepts arbitrary `submissionId + standardCode + specCode` from the body and falls back to looking up any pending validation matching them** ([server/src/controllers/webhookController.ts:301-306](../../../../server/src/controllers/webhookController.ts)). With the endpoint unauthenticated, this is exploitable: an attacker can mark any failing section as passing across any submission. See [[security-audit-2026-05-10]] critical #1.

**No idempotency** — if n8n retries delivery, the second callback overwrites the first.

## Outbound trigger pattern

Single entry point: `validationService.callWebhook()` ([server/src/services/validationService.ts:381-463](../../../../server/src/services/validationService.ts)).

- URL chosen: `APP_URL` → `RAILWAY_PUBLIC_DOMAIN` → `localhost` fallback.
- Single POST, 30s axios timeout.
- Auth headers from `WebhookSettings.authentication` (api-key or bearer).
- Custom headers from `WebhookSettings.headers`.
- **No retry loop.** Despite [Readme.md:323-329](../../../../Readme.md) claiming "Max Retries (default 3) / exp backoff / multiplier", the code does one attempt and gives up. Recent commit improved one part: when n8n call **outright fails**, the validation job stays in the pending list rather than being deleted (prevents data loss) — but if n8n succeeds and just *never calls back*, the `ValidationResult` stays `pending` forever with no timeout.

## Help-chat proxy

`POST /api/webhooks/help/chat` proxies the user's question + sessionId to the help-chat workflow. `GET /api/webhooks/help/status` returns `{available: true}` if the help-chat webhook URL is configured. The frontend hides the chat bubble when `available: false`.

## Documented-vs-actual drift

| Readme/docs claim | Reality |
|-------------------|---------|
| Max retries 3, exp backoff | One attempt, no retry. |
| Idempotent callbacks | None. Re-delivery overwrites. |
| Session isolation per user (help chat) | sessionId is client-provided, not user-scoped. |
| Output paging/streaming for large sections | Whole HTML sent in single POST. |
| Partial-success callbacks on partial failure | Single result only. |
| Error notifications via error workflow | No error nodes in any workflow. |

## Workflow IDs (per [docs/n8n-workflow-integration-guide.md:669-674](../../../../docs/n8n-workflow-integration-guide.md))

| Workflow | n8n ID |
|----------|--------|
| Specification Loader (PDF) | `UWg1TsqA9Bmc7NFg` |
| Document Matcher | `B9fsLY5OK5H1C245` |

Useful when looking up runs in the n8n UI or filing tickets against a specific workflow version.

## Doc-vs-code drift

[docs/n8n-workflow-integration-guide.md](../../../../docs/n8n-workflow-integration-guide.md) is the most comprehensive contract documentation but has stale model references (verified 2026-05-10):

| Doc claim | Reality | Where in code |
|-----------|---------|---------------|
| LLM is `gpt-4-turbo` | All three workflows use `gpt-4o-mini` | `n8n-workflows/cshse-{document-matcher,help-chat-agent,self-study-standard-validation}.json` |
| Embeddings via `text-embedding-3-small` | spec-loader uses `text-embedding-ada-002` (1536 dims); help-chat uses `-3-small` | `cshse-specification-loader-pdf.json`, `cshse-help-chat-agent.json` |
| Subspecs labeled `a` through `f` | Matches `server/src/data/standards.ts` (only `a`–`f` defined) | Code is right, but [EvidenceViewer.tsx:300](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) hardcodes `['a'..'h']` (UI bug, see [[evidence-file-storage]]) |

Cross-referenced in [[repo-docs-reference]].

## S14 decision (2026-05-31) — `triggerValidation` is NOT dead code; rip-out deferred to a dedicated CR

The Sprint 14 plan ([[sprint-plan-2026-05-31]] line 124) listed "n8n dead-code removal (validation webhook + `triggerValidation`)" as a ~600-LOC hygiene cut, on the premise it is "no longer on the submit path since CR-049." That premise is **half-right and the conclusion is wrong**: CR-049's `validationService.validateSection` (cshse-ai) replaced only the **submit-gate** flow — its own doc-comment says so verbatim (`server/src/services/validationService.ts:104`: "REPLACES the legacy n8n `triggerValidation` path **for that flow**"). `triggerValidation` still backs three **live** callers:

1. **Interactive editor validation** — `client/src/features/selfStudy/Editor/NarrativeEditor.tsx:373` → `useValidationStatus.triggerValidation` (`client/src/hooks/useValidationStatus.ts:121`) → `POST /api/webhooks/n8n/validate` → `webhookController.triggerValidation` (`server/src/controllers/webhookController.ts:16`) → `validationService.triggerValidation` (`server/src/services/validationService.ts:218`).
2. **`validateStandard`** — `server/src/services/validationService.ts:783`.
3. **`revalidateFailedSections`** — `server/src/services/validationService.ts:806`, surfaced by `client/src/features/selfStudy/SubmissionWorkflow/FailedValidations.tsx` ("Revalidate" button).

Crucially, the path is **not broken when n8n is decommissioned**: `triggerValidation` does a `WebhookSettings.findOne({settingType:'n8n_validation', isActive:true})` lookup and, when none is active, **gracefully degrades** to a `pending` / "No validation webhook configured. Manual review required." result (`server/src/services/validationService.ts:278-287`) rather than throwing. So with n8n off, the editor's validate action is inert-but-safe — exactly the kind of working code the project's standing rule says not to disturb.

**Decision: do NOT rip it out in S14.** A wholesale removal would force re-pointing the three live callers (most visibly the editor) onto the cshse-ai `validateSection` path — a **user-visible behavior migration**, not hygiene, and it touches working code. That deserves its own change-request with PC review (mirroring how [[cr-026-matrix-correction-verify-in-context|CR-026]] was closed-as-superseded rather than force-built under a sprint-hygiene banner). The S14 line is therefore reclassified **deferred-to-CR**, not done. The "archive external n8n evidence-node workflow definitions" sub-item remains a pure **ops task** on the n8n instance (no server code) and is unaffected by this decision. The unauthenticated-callback security findings above (critical #1) stay open and are the stronger reason to schedule that migration CR.

**Scheduled (2026-05-31):** the migration CR now exists — [[cr-054-n8n-validation-migration-and-callback-security]] (`proposed`, P1). It sequences a Phase-1 security fix (authenticate/404 the callbacks, rotate the hardcoded spec-loader key, bind help-chat sessions to the authenticated user) that can ship independently of the Phase-2 editor-validation re-point and Phase-3 dead-code removal.

## Related

- [[security-audit-2026-05-10]] — unauth'd callbacks, hardcoded API key, session hijack
- [[import-pipeline]] / [[import-marker-mechanism]] — Document Matcher call site (missing)
- [[incomplete-features-2026-05-10]] — N8N auto-mapping TODO, missing retries
- [[documentation-gaps-2026-05-10]] — workflow setup guide missing
- [[repo-docs-reference]] — index of repo `/docs/*.md` (incl. n8n integration guide)
