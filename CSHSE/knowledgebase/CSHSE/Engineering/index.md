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
- [[n8n-integration]] — five workflows, four callback endpoints, doc-vs-code drift.
- [[frontend-architecture]] — routing, role gating, TipTap editor, DocumentViewer, bundle.
- [[evidence-document-review-pipeline]] — **Missing.** The AI workflow that should pull S3 evidence and review it alongside the narrative.

## Reviews / audits (dated snapshots)

- [[security-audit-2026-05-10]] — critical/high/med/low findings across server, client, n8n.
- [[incomplete-features-2026-05-10]] — stubbed emails, missing matcher call, broken `isS3Configured()`, no retries, no tests.
- [[documentation-gaps-2026-05-10]] — what docs exist, drift, what's missing.

## Plans (dated, forward-looking)

- [[sprint-plan-2026-05-10]] — eight-sprint roadmap covering audit fixes, evidence document review pipeline, full test coverage, and ops polish.

## Sources

(Add source-summary pages here as they're created.)
