# Archived n8n workflows — superseded by cshse-ai

These workflow JSON exports remain in-tree as historical reference but
are **not** wired up in production. Their behavior moved into the
`cshse-ai` (Python FastAPI) service as part of CR-018.

| File | Replacement |
|---|---|
| `cshse-document-matcher.json` | `cshse-ai` `/ai/import/start` pipeline (matcher + bucket allocation, with per-institution Qdrant scoping). |
| `cshse-self-study-standard-validation.json` | `cshse-ai` `/ai/evidence/extract`, `/ai/evidence/recommend`, `/ai/evidence/score` (CR-018 Phase 2 + Phase 2b PDF wrapper). |

## Why

- cshse-ai owns the matcher + RAG + Haiku adjudication paths end-to-end.
- n8n had no direct vector-store access and complicated per-institution
  isolation (see [[../../CSHSE/Engineering/cross-institution-isolation-audit-2026-05-24]]).
- These workflows were never deployed for evidence review in production
  (no Reader-side caller existed). Archiving here documents the
  transition without losing the JSON for reference.

## What's NOT archived (still live in n8n)

The other workflows under `n8n-workflows/` (help-chat, document-upload,
specification-loader-pdf, supabase-help-documents.sql) are unrelated to
CR-018 and stay in production.

## If you need to restore one

Just `git mv` the file back to `n8n-workflows/` and re-deploy the
workflow in the n8n instance.
