---
name: CSHSE wiki — schema
description: Schema and conventions for this Obsidian-backed wiki. Skills like /challenge-obsidian and /save-obsidian read this file to know how the vault is structured.
type: schema
last_reviewed: 2026-05-10
---

# CSHSE wiki — schema

LLM-maintained wiki for the CSHSE Accreditation Self-Study Portal. All content lives under `Engineering/`.

## Page types

- `overview` — top-level system synthesis. Read first.
- `concept` — durable knowledge about a system component, pattern, or flow. Update in place when the underlying code changes.
- `review` — dated snapshot of a code-review/audit pass. Filename includes the date (e.g., `security-audit-2026-05-10.md`). **Do not** rewrite history; create a new dated review when re-auditing, then link old one as superseded.
- `plan` — dated, forward-looking sprint/roadmap plan. Filename includes the date. Plans are *expected to drift* from reality; supersede with a new dated plan rather than rewriting.
- `entity` — a named external system or service we depend on (n8n, Supabase, Railway, S3).
- `glossary` — domain terms.
- `schema` — this file.

## Frontmatter

Every content page has YAML frontmatter:

```yaml
---
name: <Page Title>
description: <one specific line — used to find this page later>
type: <one of the types above>
tags: [<tag1>, <tag2>]
last_reviewed: YYYY-MM-DD
---
```

`review` pages additionally include `audit_date: YYYY-MM-DD` and `auditor: <name or "claude">`.

## Filename convention

`kebab-case.md`. Reviews append the date: `security-audit-2026-05-10.md`. Wikilinks resolve by basename; avoid duplicate basenames.

## Cross-references

Use `[[basename]]` Obsidian wikilinks, not relative markdown paths.

## Source citations

Cite source code as `<repo-relative path>:<line>` (e.g., `server/src/middleware/auth.ts:45`). For commits, use the short SHA.

## Log format

`log.md` is append-only. Entries:

```
## [YYYY-MM-DD] <action> | <subject>
```

Action verbs: `audit`, `ingest`, `query`, `update`, `setup`.

## Workflow conventions

- Update `index.md` whenever a page is added/removed/renamed.
- Append `log.md` whenever the vault is meaningfully modified.
- Concept pages are durable — when code changes, edit the existing page rather than creating a new one.
- Review pages are snapshots — never edit a past audit; create a new dated one and link.

## Hard rules

- Never invent file paths or line numbers. If unsure, leave a TBD with a note.
- Never delete pages without confirming.
- Quote code with `path:line` so claims are verifiable.
