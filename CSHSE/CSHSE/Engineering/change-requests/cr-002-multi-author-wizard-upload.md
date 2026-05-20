---
name: CR-002 — Multi-author wizard upload (partial documents)
description: AI wizard must support uploading partial documents from multiple coordinators, merging contributions into one self-study.
type: change-request
cr_id: CR-002
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#44-07]]
sprint_target: Sprint 2
tags: [import, wizard, multi-author]
last_reviewed: 2026-05-20
---

# CR-002 — Multi-author wizard upload (partial documents)

## Summary

A single self-study is often co-authored. Each contributor finishes their slice (a couple of standards) and hands it to the PC. The wizard today accepts one DOCX at a time and treats it as a complete document. We need to support a workflow where multiple partial uploads merge into the same self-study without overwriting prior contributions.

## Source quotes

> **[44:07 — Monica]:** "either we upload a whole new file of 300 pages or we copy and paste. We have both the options."
> **[44:21 — Eric]:** "You have several people doing the work, they can each load their portion of the document, and it will read it in."

## Decision

Allow the AI Import wizard to run **multiple times against the same self-study**. Each run:

- Tags + recommends only against the content in the uploaded document
- Lets the PC review + apply only the placements they intend to keep
- Merges into existing standards/specs **additively** — never deletes prior narrative/evidence

The first run of the wizard becomes the seed. Subsequent runs append. The PC sees "X items added to standards Y, Z" after each apply.

## Acceptance

- [ ] Wizard can be opened against a self-study that already has applied content; existing content is preserved on apply.
- [ ] Apply page calls out which standards already had content and which are net-new from this run.
- [ ] Audit log records each wizard run as a distinct event with the uploader's userId.
- [ ] Smoke test: upload doc A (covers standards 1-7) → apply → upload doc B (covers 8-14) → apply → verify all 14 are populated and no cross-contamination.
- [ ] Conflict on the same spec from two runs: prompt PC to choose keep-existing / append / replace.

## Files affected

- `server/src/controllers/aiImportController.ts` — `applyAIImport` already creates buckets; needs to detect existing content per spec.
- `client/src/features/selfStudy/Editor/AIImport/steps/ApplyStep.tsx` — conflict-resolution UI per spec.
- `client/src/store/aiImportStore.ts` — track which standards already had content at wizard-start.

## Dependencies

- CR-001 (both importers required) — implies the merge behavior anyway.

## Open questions

- Should the wizard show the existing narrative inline so the PC can compare before merging? — likely yes, scope TBD.
