---
name: N8N Integration
description: The five n8n workflows the portal calls into, the four public callback endpoints they call back to, and the documented-vs-actual retry behavior.
type: concept
tags: [n8n, webhooks, ai, async, integration]
last_reviewed: 2026-05-10
---

# N8N Integration

All AI is offloaded to **n8n** workflows. The portal triggers them via HTTPS POST and receives results on public callback endpoints.

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

## Related

- [[security-audit-2026-05-10]] — unauth'd callbacks, hardcoded API key, session hijack
- [[import-pipeline]] — Document Matcher call site (missing)
- [[incomplete-features-2026-05-10]] — N8N auto-mapping TODO, missing retries
- [[documentation-gaps-2026-05-10]] — workflow setup guide missing
