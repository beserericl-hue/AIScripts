---
name: Repo Docs Reference
description: Index of authoritative markdown docs that live in the application repo's /docs folder. Use these as primary sources for the import pipeline, REST API, and n8n integration; flag drift back into the wiki.
type: reference
tags: [reference, docs, source-of-truth, drift]
last_reviewed: 2026-05-10
---

# Repo Docs Reference

The application repository carries four hand-maintained docs under [`/docs/`](../../../../docs/). They are first-party references — when there's a question about API shape or import internals, **read these before guessing**. They are also the most likely sources to drift from code over time, so always cross-check against current source.

## Inventory

| Doc | Lines | Purpose | Drift status (2026-05-10) |
|-----|-------|---------|---------------------------|
| [docs/IMPORT_PROCESS_REFERENCE.md](../../../../docs/IMPORT_PROCESS_REFERENCE.md) | 792 | Authoritative technical reference for the import pipeline — architecture diagrams, all 28 endpoints, schema, marker system, repair flow with three tiers, diagnostics, and memory-safety patterns. | **Accurate.** Matches code. The 3-tier repair flow (T1 direct match → T2 text-offset matching → T3 sequential re-find) and the `flattenString` memory pattern are not redundantly re-documented in the wiki — see [[import-marker-mechanism]] which now references this. |
| [docs/api.md](../../../../docs/api.md) | 1475 | REST API documentation — every endpoint with request/response examples, error responses, rate limiting, SDK code samples (TypeScript + cURL). Most comprehensive endpoint reference in the project. | **Mostly accurate, with drift.** Documents `POST /auth/refresh` ([api.md:95](../../../../docs/api.md)) which does not exist in code — [client/src/services/api.ts:31-43](../../../../client/src/services/api.ts) explicitly comments "no token refresh." Treat as aspiration, not implementation. Endpoint shapes for evidence / submissions / comments / lock all match current code. |
| [docs/n8n-workflow-integration-guide.md](../../../../docs/n8n-workflow-integration-guide.md) | 675 | n8n workflow contracts — Supabase setup SQL (incl. `match_specifications` pgvector function), per-workflow request / response shapes, callback payload structure, TypeScript client examples, workflow IDs. | **Drift in two places (verified 2026-05-10):** (1) doc says model is `gpt-4-turbo` ([line 29](../../../../docs/n8n-workflow-integration-guide.md)) but workflow JSONs all use `gpt-4o-mini`. (2) doc says embeddings are `text-embedding-3-small` but `cshse-specification-loader-pdf.json` uses `text-embedding-ada-002`. (3) "Subspecifications labeled `a` through `f`" ([line 636](../../../../docs/n8n-workflow-integration-guide.md)) **matches** `data/standards.ts` — and **contradicts** the EvidenceManager UI which hardcodes `a`–`h` (real bug — see [[evidence-file-storage]]). |
| [docs/claude-code-web-interface-prompt.md](../../../../docs/claude-code-web-interface-prompt.md) | 740 | Original Claude Code task prompt for building the web interface — includes specs for two pages (`/admin/specifications` and `/documents/match`), backend endpoints to implement, callback handlers, and a results-display component. **Historical artifact — describes a planned interface, not necessarily what shipped.** | Use for design intent. Don't rely on it as a source-of-truth for current code. |

## How to use these in conjunction with the wiki

- **Wiki concept page** = durable narrative + cited code. Updated in place.
- **Repo doc** = authoritative reference snapshot in the application's own repo. Wiki should cite repo doc with `path:line` instead of duplicating.
- **Wiki review page** (dated) = snapshot in time; carries drift findings into the historical record.

When wiki and repo doc disagree, the **code wins** — verify against `path:line`, then update both.

## Cross-references back into the wiki

- IMPORT_PROCESS_REFERENCE.md → cited extensively in [[import-marker-mechanism]] and [[import-pipeline]].
- api.md → cited in [[module-catalog]] (which catalogs every server module by route).
- n8n-workflow-integration-guide.md → cited in [[n8n-integration]].
- claude-code-web-interface-prompt.md → not cited; design-intent only.

## Drift tracking

Open drift items as of 2026-05-10:

| What | Where (doc) | Where (code) | Resolution |
|------|-------------|--------------|------------|
| Token refresh exists | [docs/api.md:95-109](../../../../docs/api.md) | [client/src/services/api.ts:31-43](../../../../client/src/services/api.ts) — none | Either implement refresh or remove from docs. |
| LLM is `gpt-4-turbo` | [docs/n8n-workflow-integration-guide.md:29](../../../../docs/n8n-workflow-integration-guide.md) | All workflow JSONs use `gpt-4o-mini` | Update doc. |
| Embeddings are `text-embedding-3-small` | [docs/n8n-workflow-integration-guide.md:29](../../../../docs/n8n-workflow-integration-guide.md) | `cshse-specification-loader-pdf.json` uses `text-embedding-ada-002`; help-chat uses `-3-small` | Update doc per workflow. |
| Spec letters go `a`–`h` | [client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx:300](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) | `data/standards.ts` only defines `a`–`f` | Fix the EvidenceViewer dropdown (cap at `f`, fetch from `/api/standards`). |

## Related

- [[import-pipeline]] / [[import-marker-mechanism]] — code-level companions to IMPORT_PROCESS_REFERENCE.md
- [[module-catalog]] — code-level companion to api.md
- [[n8n-integration]] — code-level companion to n8n-workflow-integration-guide.md
- [[code-review-2026-05-10]] / [[client-features-deep-2026-05-10]] — dated snapshots that draw on these references
