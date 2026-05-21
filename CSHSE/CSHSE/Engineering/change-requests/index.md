---
name: Change Requests — Catalog
description: Master index of every shippable behavior change request derived from the 2026-05-20 Beta Group Training webinar and follow-on conversations.
type: overview
tags: [change-requests, catalog, webinar, requirements]
last_reviewed: 2026-05-20
---

# Change Requests — Catalog

All CRs are scoped to a single shippable behavior. Each is sourced from a timestamp in [[webinar-action-items-2026-05-20]] or from a follow-on engineering conversation captured in [[log]].

## Status legend

| Status | Meaning |
|---|---|
| `proposed` | Captured, not yet sized or scheduled |
| `accepted` | Sized + on the sprint plan |
| `in-progress` | Engineering started |
| `shipped` | Verified in prod |
| `rejected` | Considered + declined |
| `superseded` | Replaced by another CR |

## P0 — required before next reader cycle (Stevenson + Kennesaw beta)

| CR | Title | Status | Source |
|---|---|---|---|
| [[cr-001-both-importers-required]] | Keep both AI wizard + legacy per-standard importer | proposed | [[webinar-action-items-2026-05-20#28-25]] |
| [[cr-005-pc-lockout-on-final-submit]] | PC locked to read-only + print after final submit | proposed | [[webinar-action-items-2026-05-20#1-17-54]] |
| [[cr-006-two-stage-submission]] | Per-section submit-for-review vs final-submit | proposed | [[webinar-action-items-2026-05-20#1-13-05]] |
| [[cr-007-reader-access-after-submit]] | Readers see nothing until PC clicks final submit | proposed | [[webinar-action-items-2026-05-20#1-19-38]] |
| [[cr-004-comment-threading-identity-redaction]] | Reader names hidden from PC + Julia relays | proposed | [[webinar-action-items-2026-05-20#1-18-28]] |
| [[cr-003-zero-to-three-compliance-rubric]] | Non / Partial / Largely / Fully compliant rubric | proposed | [[webinar-action-items-2026-05-20#1-05-23]] |
| [[cr-017-cross-institution-isolation-audit]] | Documented data-flow audit for cross-institution isolation | proposed | [[webinar-action-items-2026-05-20#24-07]] |
| [[cr-025-ai-matrix-column-inference]] | AI infers matrix column → course mapping; dropdown replaces free-text | proposed | User observation 2026-05-21 |
| [[cr-026-matrix-correction-verify-in-context]] | Verify-in-context preview + per-row move/remove for AI matrix corrections | proposed | User observation 2026-05-21 |

## P1 — required for general beta

| CR | Title | Status | Source |
|---|---|---|---|
| [[cr-002-multi-author-wizard-upload]] | Wizard accepts partial documents from multiple PCs | proposed | [[webinar-action-items-2026-05-20#44-07]] |
| [[cr-008-pre-submission-validation-popup]] | Pre-submit validation popup + warnings | proposed | [[webinar-action-items-2026-05-20#1-08-47]] |
| [[cr-009-compilation-tab-lead-reader]] | Side-by-side reader-scores compilation tab | proposed | [[webinar-action-items-2026-05-20#compilation-tab]] |
| [[cr-010-portal-direct-messaging]] | Reader-to-reader portal direct messaging | proposed | [[webinar-action-items-2026-05-20#1-25-52]] |
| [[cr-011-suggestions-consolidation-doc]] | Consolidated suggestions doc per standard for VP for accreditation | proposed | [[webinar-action-items-2026-05-20#1-04-19]] |
| [[cr-012-site-visit-partial-compliance-tracking]] | Partial-compliance carried into site-visit checklist | proposed | [[webinar-action-items-2026-05-20#1-05-53]] |
| [[cr-013-site-visit-itinerary-builder]] | Itinerary builder for lead reader + PC | proposed | [[webinar-action-items-2026-05-20#1-26-47]] |
| [[cr-014-drag-drop-multi-file]] | Drag-and-drop multi-file upload to Supporting Evidence | proposed | [[webinar-action-items-2026-05-20#50-36]] |
| [[cr-015-narrative-hyperlink-preservation]] | URLs in pasted narrative remain clickable | proposed | [[webinar-action-items-2026-05-20#56-14]] |
| [[cr-018-ai-evidence-review-via-cshse-ai]] | Move evidence review off n8n into cshse-ai | proposed | [[sprint-plan-2026-05-11#sprint-3]] |
| [[cr-023-julia-relay-workflow]] | Julia-as-relay model for comments + clarifications | proposed | [[webinar-action-items-2026-05-20#1-11-35]] |
| [[cr-024-matrix-spec-bidirectional-link]] | Matrix ↔ spec bidirectional link + AI eval reads matrix rows | proposed | User observation 2026-05-21 |

## P2 — backlog

| CR | Title | Status | Source |
|---|---|---|---|
| [[cr-016-in-app-bug-reporter]] | Screenshot + paragraph in-app bug report | proposed | [[webinar-action-items-2026-05-20#37-56]] |
| [[cr-019-joint-venture-pull-forward]] | Consider pulling Joint Venture work earlier | rejected | [[sprint-plan-2026-05-11#sprint-7]] |
| [[cr-020-account-lock-unlock-audit-trail]] | Admin lock/unlock audit-trail UI | proposed | [[webinar-action-items-2026-05-20#1-11-35]] |
| [[cr-021-reader-uploaded-files]] | Readers can attach files to comments (partial relevant evidence) | proposed | new — implied by relay flow |
| [[cr-022-reader-assignment-lockout]] | Only Admin can reassign readers post-lockout | proposed | new — implied by lockout flow |

## Existing CRs that need revision

These are flagged in [[sprint-plan-2026-05-16]] and need to be rewritten or split:

| Existing CR | Conflict | Action |
|---|---|---|
| S4.1 / S4.2 / S4.3 / S4.5 | n8n evidence review pipeline | Supersede with [[cr-018-ai-evidence-review-via-cshse-ai]] |
| S2.1 | Reader-identity redaction is narrower than [[cr-004-comment-threading-identity-redaction]] | Broaden in next sprint plan |
| S5.10 | Reader DOCX report uses pass/fail | Add 0-3 rubric per [[cr-003-zero-to-three-compliance-rubric]] |
| S7.3 | Site visit checklist | Merge with [[cr-013-site-visit-itinerary-builder]] |

## How to add a new CR

1. Pick next free `cr-NNN` number (zero-padded).
2. Copy frontmatter from any existing CR file. Required fields: `cr_id`, `status`, `priority`, `source`.
3. Body sections in this order: Summary · Source quotes · Decision · Acceptance · Files affected · Dependencies · Open questions.
4. Add a row to the table above in the correct priority block.
5. Append [[log]] with `## [YYYY-MM-DD] update | change-requests`.
