---
name: CR-011 — Suggestions consolidation document
description: Per-standard reader suggestions roll up into one document the PC can hand to the VP for accreditation.
type: change-request
cr_id: CR-011
status: shipped
priority: P1
source: [[webinar-action-items-2026-05-20#1-04-19]], [[webinar-action-items-2026-05-20#1-04-53]]
sprint_target: Sprint 5.2
tags: [reports, readers, vp-for-accreditation, exports]
last_reviewed: 2026-05-30
---

# CR-011 — Suggestions consolidation document

## Summary

Yvonne flagged that some reader suggestions need to be escalated through the VP for accreditation back to the program. Today that requires manually copying across multiple reader reports. The portal should generate a single consolidated suggestions document — all readers' suggestions, grouped by standard.

## Source quotes

> **[1:04:19 — Yvonne]:** "the suggestions from each standard can be pulled together in one document, and the reason that I ask is that sometimes some of those suggestions need to be addressed, need to go through the VP for accreditation, and back to the program to ask them to provide more data in the process of completing the self-study review."

> **[1:04:53 — Eric]:** "I see that as necessary as well, and so my note taker is taking that as an action item to effectively get that in."

## Decision

Lead-reader-triggered export. Generates a DOCX with:

- Cover page (institution, program, accreditation cycle, date)
- TOC by standard
- Per-standard section listing every reader's suggestions verbatim, attributed by `pcLabel` (anonymized per [[cr-004-comment-threading-identity-redaction]]) or by reader name (depending on consumer — see below).

Two output modes:

1. **Internal (board / VP)** — full reader names visible.
2. **PC-facing** — reader names redacted to `pcLabel`. This is the document the PC receives via Julia.

## Acceptance

- [x] Lead-reader-only "Generate suggestions doc" button on the Compilation tab — server endpoint role-gated to lead_reader / admin / superuser; PC + reader → 403.
- [x] Two-mode toggle (internal vs PC-facing) selectable at export time — query param `mode=internal|pc_facing` (default + fallback: internal).
- [x] PC-facing mode strips reader identity server-side (not client filter) — unrelayed comments dropped entirely; relayed surface as `pcLabel` + `relayedText`; reader override notes suppressed. Verified by unzipping the .docx in tests and asserting redaction in `word/document.xml`.
- [ ] DOCX matches CSHSE branding (header/footer + logo). **Deferred:** structural content lands here; brand styling lands with the next docx-export pass (board decisions sprint).
- [x] Tests cover the redaction round-trip — `tests/integration/suggestions-doc.test.ts` (7) seeds an unrelayed comment + a relayed-with-pcLabel comment + a reader-overridden ValidationResult, then asserts each mode's body XML.

## Files affected (as shipped, Sprint 5.2, 2026-05-30)

- `server/src/services/suggestionsDocx.ts` (new) — `generateSuggestionsDocx({ submissionId, mode })`; pulls comments + reader override notes (ValidationResult) + AI suggestions; groups by Standard → Specification.
- `server/src/controllers/compilationController.ts` — adds `exportSuggestionsDoc` (lead/admin only; server-side mode coercion; sets `Content-Type: wordprocessingml`, `Content-Disposition` attachment, `X-Suggestions-Mode` header).
- `server/src/routes/compilation.ts` — adds `GET /api/submissions/:id/compilation/suggestions-doc`.
- `client/src/features/leadReader/CompilationTab/CompilationTab.tsx` — adds an export toolbar (mode radio + Generate button) below the header; container streams the response as a Blob and triggers a download via `URL.createObjectURL`.

## Dependencies

- [[cr-009-compilation-tab-lead-reader]] — same surface; same role gate.
- [[cr-004-comment-threading-identity-redaction]] — PC-facing mode honors the relay state + pcLabel substitution.

## Open questions

- Should the AI matcher suggest additional remediation language inline? Defer.
- CSHSE-branded header/footer template — picked up in the next docx-export pass.

## Resolution (2026-05-31, Sprint 11 / S11.4) — DOCX branding SHIPPED

The deferred "DOCX matches CSHSE branding (header/footer + logo)" acceptance item is closed.
- **Shared branding module** `server/src/services/docxBranding.ts` (new) — `buildBrandedHeader()` (CSHSE logo left + "Council for Standards in Human Service Education" right, with a bottom rule), `buildBrandedFooter()` ("CSHSE — Confidential accreditation document" + Word PAGE/NUMPAGES fields), and `brandedSectionChrome()` which returns the `headers`/`footers` section options. Degrades to a text-only header if the logo asset is missing (`hasBrandLogo()` exposed for tests).
- **Logo asset** bundled at `server/src/assets/cshse-logo.png` (400×400 PNG) and mirrored to `dist/assets` by `server/build.js` (new copy step) so the path resolves in both ts-node and compiled trees. Loaded once at module init via `path.join(__dirname, '..', 'assets', 'cshse-logo.png')`.
- **Both DOCX generators** now spread `...brandedSectionChrome()` into their section: `server/src/services/suggestionsDocx.ts` (consolidated suggestions) and `server/src/services/siteVisitChecklistDocx.ts` (CR-012 site-visit checklist).
- Tests: `server/tests/integration/suggestions-doc.test.ts` (+3 S11.4 cases — header carries the org name, footer carries the confidentiality line + page-number fields, `word/media/` holds the embedded logo; the checklist DOCX is branded identically; `hasBrandLogo()` true) — 12 green. Existing suggestions + checklist + redaction tests unaffected.
