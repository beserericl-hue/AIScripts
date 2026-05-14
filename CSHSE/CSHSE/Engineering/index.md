---
name: Index
description: Catalog of every page in this wiki, organized by topic. Read first when answering a query.
type: index
last_reviewed: 2026-05-10
---

# Index

The catalog. One line per page. When answering a question, scan this first to find candidate pages, then drill into 1–3 of them rather than re-reading source material.

## Read first

- [[overview]] — what this app is, who uses it, the personas. **Start here.**
- [[CLAUDE]] — wiki schema and workflows.
- [[glossary]] — CSHSE/tech terms (VPA, Standard, Specification, Lead Reader, GridFS, RAG, Marker, etc.).
- [[product-requirements]] — what the portal must support, derived from the 2024 Member Handbook.

## Architecture & systems (concept pages — durable)

- [[system-architecture]] — tier diagram, server layering, auth model, build/deploy, observability.
- [[storage-layer]] — Mongo / GridFS / S3 split; marker insertion/restore; memory pitfalls.
- [[import-pipeline]] — DOCX/PDF upload → manual tagging → extract → finish; state machine + gaps.
- [[narrative-storage]] — `Map<std, Map<spec, INarrativeContent>>` shape, Mongoose-8 Map persistence trap, edit lifecycle, AI packaging.
- [[n8n-integration]] — five workflows, four callback endpoints, doc-vs-code drift.
- [[frontend-architecture]] — routing, role gating, TipTap editor, DocumentViewer, bundle.
- [[evidence-document-review-pipeline]] — design for the AI workflow that should pull S3 evidence and review it alongside the narrative.
- [[evidence-file-storage]] — how supporting-evidence files are uploaded, indexed by Standard / Sub-standard, displayed in three different UI surfaces. Reconciles the user's "EC3 folders" terminology with the code.
- [[import-marker-mechanism]] — deep mechanical companion to import-pipeline: how the GridFS HTML physically shortens via `<!-- EXTRACTED:... -->` comment markers, table-frag wrappers, two-pass streaming restore, three-tier repair, /tmp lifecycle, and what's stored where.
- [[repo-docs-reference]] — index of the four `/docs/*.md` files in the application repo (IMPORT_PROCESS_REFERENCE, api, n8n integration guide, claude-code prompt) with drift tracking against current code.
- [[module-catalog]] — every server route ↔ controller ↔ service ↔ model and every client page ↔ feature ↔ component, one-line each.

## Reviews / audits (dated snapshots)

- [[security-audit-2026-05-10]] — critical/high/med/low findings across server, client, n8n.
- [[incomplete-features-2026-05-10]] — stubbed emails, missing matcher call, broken `isS3Configured()`, no retries, no tests. **Superseded by [[incomplete-features-2026-05-11]].**
- [[incomplete-features-2026-05-11]] — product-requirements-driven audit. Walks down [[product-requirements]] tier by tier. New: Handbook-compliance gaps (reader-identity leak, impersonation audit, URL hygiene, PDF preference); curriculum-matrix client/server asymmetry; 45-day reader deadline tracking; completion checklist; common-error checks.
- [[documentation-gaps-2026-05-10]] — what docs exist, drift, what's missing.
- [[code-review-2026-05-10]] — comprehensive verify-and-catalog pass; answers the "EC3 folders" question; sequences the evidence-document-review work.
- [[client-features-deep-2026-05-10]] — file-by-file documentation of every client feature, page, component, hook, store, service. Spotlights the file-upload critical path.

## Plans (dated, forward-looking)

- [[sprint-plan-2026-05-10]] — eight-sprint roadmap. **Superseded by [[sprint-plan-2026-05-11]].**
- [[sprint-plan-2026-05-11]] — six-sprint roadmap structured for Claude Code consumption. Fixes every gap in [[incomplete-features-2026-05-11]] + [[security-audit-2026-05-10]]. Each story carries file paths, line citations, acceptance criteria, tests.

## Sources

(Add source-summary pages here as they're created.)

## Sibling folders

The vault has a sibling top-level folder for non-engineering artefacts:

- [Marketing/](../Marketing/) — sales copy, video scripts, film plans. Current artefact: [[marketing-plan-2026-05-11]] (v1 launch, distributes via cshse.org).
