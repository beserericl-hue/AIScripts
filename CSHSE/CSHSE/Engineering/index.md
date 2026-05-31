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

- [[system-architecture]] — tier diagram, server layering, auth model, build/deploy, observability. **Refreshed 2026-05-31** — adds the `cshse-ai` FastAPI service, SSO, notifications, the Sprints 4–9 subsystems, and underscored role names; demotes n8n to legacy.
- [[storage-layer]] — Mongo / GridFS / S3 split; marker insertion/restore; memory pitfalls.
- [[import-pipeline]] — DOCX/PDF upload → manual tagging → extract → finish; state machine + gaps.
- [[narrative-storage]] — `Map<std, Map<spec, INarrativeContent>>` shape, Mongoose-8 Map persistence trap, edit lifecycle, AI packaging.
- [[n8n-integration]] — **LEGACY** (banner added 2026-05-31): the five AI workflows are retired — import/eval moved to `cshse-ai`, validation to `/preflight`; only help-chat RAG may still route here. Callback-endpoint security findings remain relevant.
- [[frontend-architecture]] — routing, role gating, TipTap editor, DocumentViewer, bundle.
- [[evidence-document-review-pipeline]] — design for the AI workflow that should pull S3 evidence and review it alongside the narrative.
- [[evidence-file-storage]] — how supporting-evidence files are uploaded, indexed by Standard / Sub-standard, displayed in three different UI surfaces. Reconciles the user's "EC3 folders" terminology with the code.
- [[import-marker-mechanism]] — deep mechanical companion to import-pipeline: how the GridFS HTML physically shortens via `<!-- EXTRACTED:... -->` comment markers, table-frag wrappers, two-pass streaming restore, three-tier repair, /tmp lifecycle, and what's stored where.
- [[repo-docs-reference]] — index of the four `/docs/*.md` files in the application repo (IMPORT_PROCESS_REFERENCE, api, n8n integration guide, claude-code prompt) with drift tracking against current code.
- [[module-catalog]] — every server route ↔ controller ↔ service ↔ model and every client page ↔ feature ↔ component, one-line each. **Refreshed 2026-05-31** — original 2026-05-10 tables kept as a historical layer; a new "Added since the 2026-05-10 baseline (Sprints 4–9)" section catalogues the cshse-ai integration, 11 new models, 16 new controllers, new services/middleware/routes, and the reader/leadReader/siteVisit/admin/tour client features.
- [[railway-deployment-topology]] — two-env Railway topology (production/main, develop/developer), isolated MongoDBs, shared Tigris S3 bucket. GraphQL ops cookbook for branch-swap and env-creation.
- [[db-migration-strategy]] — how every DB-touching sprint story flows develop → prod without breaking live readers. Forward-only migration runner, expand-contract for S2.10/S4.6 breaking changes, develop-from-prod refresh script, `dev/` prefix isolation for the shared S3 bucket.

## Reviews / audits (dated snapshots)

- [[security-audit-2026-05-10]] — critical/high/med/low findings across server, client, n8n.
- [[incomplete-features-2026-05-10]] — stubbed emails, missing matcher call, broken `isS3Configured()`, no retries, no tests. **Superseded by [[incomplete-features-2026-05-11]].**
- [[incomplete-features-2026-05-11]] — product-requirements-driven audit. Walks down [[product-requirements]] tier by tier. New: Handbook-compliance gaps (reader-identity leak, impersonation audit, URL hygiene, PDF preference); curriculum-matrix client/server asymmetry; 45-day reader deadline tracking; completion checklist; common-error checks.
- [[documentation-gaps-2026-05-10]] — what docs exist, drift, what's missing.
- [[code-review-2026-05-10]] — comprehensive verify-and-catalog pass; answers the "EC3 folders" question; sequences the evidence-document-review work.
- [[client-features-deep-2026-05-10]] — file-by-file documentation of every client feature, page, component, hook, store, service. Spotlights the file-upload critical path.
- [[ai-import-stevenson-2026-05-17]] — by-section record of running the AI import pipeline against Stevenson University's 2024 CSHSE Self-Study DOCX. 564 sections classified end-to-end (snippet read + AI pick + Claude rationale per section).
- [[ai-import-stevenson-by-spec-2026-05-17]] — by-spec coverage view: for each of the 99 Baccalaureate specs, the **exact text** that will be written to `narratives[std][spec].content` and `supportingEvidenceText`. Includes the 8 spec gaps (no matched content) so the user knows where to triage manually.
- [[import-wizard-ui-spec-2026-05-17]] — initial UI sketch. **Superseded** by [[import-wizard-ui-spec-2026-05-18]]; kept for historical reference.
- [[import-wizard-ui-spec-2026-05-18]] — **complete, code-ready UI spec.** Covers both input formats (free-form self-study + spec-as-outline template), format auto-detection UX, re-import flow, store shape, exact API contracts, component prop signatures, loading / error / empty states, WCAG 2.1 AA accessibility, telemetry events, performance budgets, E2E test plan, and a 5-sub-sprint phased build. Sign-off gates Sprint 1 code.
- [[ai-import-wizard-preview-stevenson-2026-05-18]] — end-to-end live run of the full wizard pipeline (walkers + matcher + first-pass coverage + appendix gap-fill + second-pass coverage + auto-apply rules) on Stevenson. For every spec: the exact narratives, supporting-evidence text and files (with simulated S3 keys), matrix detections, remaining gaps, tag-list entries, and unmatched sections — i.e. the wizard's full output before the Apply click.
- [[ai-import-wizard-preview-kennesaw-state-2026-05-18]] — sibling preview against the **CSHSE Self-Study Template format** (Kennesaw State partial-fill sample). Spec-as-outline input: each section heading IS a Handbook prompt. **Additive** parsing rule — the Stevenson walkers (TOC anchor / deep table / appendix) are untouched; the new `template_walker` is an additional rule that cuts on template heading patterns (`1.`, `2a.`, `Standard 1, Specification a`), strips `Response:` markers, and detects unwritten / `Not applicable` placeholders so the institution can see which prompts still need a response. No gap-fill (no appendix yet). Generated via the new dispatcher `scripts/build_preview.py` which auto-detects format.
- [[ai-import-stevenson-matrices-2026-05-19]] — smoke test for the matrix-as-first-class-entity slice (commit `5ad2efb`). Against the real 353 MB Stevenson HTML: 2 matrices, 437 cells, 0 leaks into spec cards. Pipeline + UI + apply flow + Standards-editor link all wired.
- [[wizard-user-guide-2026-05-20]] — top-down user guide + test plan for the wizard as of commit `8ea57e6`. Walks every screen from the .docx drop to the Standards editor; includes a 12-step QA checklist and a troubleshooting table. Companion PowerPoint deck ships alongside.
- [[webinar-action-items-2026-05-20]] — full discussion log + 23 timestamped action items from the 1h 42m Beta Group Training webinar (Julia, Yvonne, Paul, Monica, Nicole, Sara, AACC, Tracee). Every decision is anchored to a transcript timestamp. Source of the change-requests catalog.
- [[submission-stack-verification-2026-05-29]] — **Sprint R.1.** Empirical verification (13 integration tests) of the PC submit → lockout stack. Verdict: the lockout middleware works, but the submit endpoints are broken — `submitStandard` validation is non-functional (missing `validateSection`, → CR-049) and `submitSelfStudy` always 400s (queries a non-existent `Spec.isActive` field, → new Sprint 2A S2A.0). CR-005 + CR-006 stay in-progress.

## Change requests

- [[change-requests/index|Change Requests catalog]] — master index of every shippable behavior change request (CR-001 through CR-023), organized by priority. New folder `Engineering/change-requests/`. Driven primarily by [[webinar-action-items-2026-05-20]].

## Plans (dated, forward-looking)

- [[sprint-plan-2026-05-10]] — eight-sprint roadmap. **Superseded by [[sprint-plan-2026-05-11]].**
- [[sprint-plan-2026-05-11]] — seven-sprint roadmap. **Superseded by [[sprint-plan-2026-05-16]].**
- [[sprint-plan-2026-05-16]] — eight-sprint roadmap. **Superseded by [[sprint-plan-2026-05-20]].** Sprint 1 shipped. Stories S2.1, S4.1-S4.3+S4.5, S5.10, S7.3 are superseded by post-webinar CRs.
- [[sprint-plan-2026-05-20]] — eight-sprint roadmap post-webinar. **Superseded by [[sprint-plan-2026-05-29]].**
- [[sprint-plan-2026-05-29]] — Re-baselined after a code-vs-vault reconciliation; drove Sprints 4–9 to completion (lead-reader workflow, site visit, board, audit UI, JV grouping, notification pass). **Superseded by [[sprint-plan-2026-05-31]].**
- [[sprint-plan-2026-05-31]] — **CURRENT.** Portal-completion plan. Built on a 2026-05-31 code-verification sweep of every stale-looking CR: corrects drifted statuses (CR-004/006/049/050 → shipped; CR-025/026 → superseded), pins four code-confirmed PARTIAL gaps (CR-003/005/007/023) + two latent bugs (a `?status` reader-enumeration leak and unlocked evidence routes), and lays out the full deferred-task inventory + phased **Sprint 10–14** schedule to finish the portal. Sprints 10–11 are the true beta-ready bar.
- [[ai-import-deploy-runbook-2026-05-18]] — **sub-sprint 1.e deploy run-book.** Step-by-step Railway-develop promote, env-var setup, post-deploy smoke (Kennesaw State template + Stevenson self-study), rollback plan, UAT handoff. **Paused** before actual deploy — requires explicit go-ahead.
- [[legacy-self-study-import]] — complete analysis of the current import flow + AI-augmented redesign that drives Sprint 1 of [[sprint-plan-2026-05-16]].

## Sources

(Add source-summary pages here as they're created.)

## Sibling folders

The vault has a sibling top-level folder for non-engineering artefacts:

- [Marketing/](../Marketing/) — sales copy, video scripts, film plans. Current artefact: [[marketing-plan-2026-05-11]] (v1 launch, distributes via cshse.org).
