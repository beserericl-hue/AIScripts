---
name: CR-029 — Matrix step redesign — one row at a time, verify-against-source-or-remove
description: Replace the current Matrix step's column-dropdowns + per-row-edit table with a single "verify this row in the original document" form. PC sees one matrix row at a time with the source document open beside it; click Keep or Remove. No editing, no jargon, no cell tables. The current screen is a blocker for non-technical coordinators.
type: change-request
cr_id: CR-029
status: proposed
priority: P0
source: User feedback 2026-05-21 — "this is one of the most confusing screens I have seen, and I have 40 years of software engineering"
supersedes: CR-025 (column inference UX), CR-026 (per-row controls UX)
sprint_target: Immediate replacement; ships before any beta-institution wizard run
tags: [matrix, ux, redesign, blocker, simplification, plain-language]
last_reviewed: 2026-05-21
---

# CR-029 — Matrix step redesign — one row at a time, verify-against-source-or-remove

## Status: P0 BLOCKER

The current Matrix step ships in `f91b63e` + `e5bf55e` + `d3a291d`. A 40-year-software-engineer user — i.e. far more technical than the target audience of social-work program coordinators — described it as "one of the most confusing screens I have seen." That is a fatal finding. The Matrix step is the hardest screen in the wizard; if the most senior user we have can't understand it, no PC will.

**This CR replaces, not iterates on, the existing Matrix step.** The column-dropdown grid, the AI confidence pills, the verify-in-context drawer, the per-row Edit/Move/Remove column, and the bulk "Accept all green" button are all removed in favour of a single simple form.

## Source quotes

User, 2026-05-21:

> "The matrix screen needs a complete redo. This is one of the most confusing screens I have seen, and I have 40 years of software engineering. I cannot fathom what social workers professors who have limited computer experience are going to see this and panic. It's a major blocker."

> "First off, the descriptions of the functions What you are looking at, is too technical. They don't know or care what Mammoth is, they think an elephant. The description of why they are seeing this has to be in plain english in the language of a 5 year old."

> "Secondly the data has no frame of reference still. There is no way to select an individual row to see that row inside the full matrix unparsed where spec 11.d is referenced or 11.c or 12.f or whatever."

> "I specified this, but this is the most complicated, overengineered screen that I have seen, and I have not a clue as to what I am supposed to do with each individual row except to edit or delete it. Just showing the row with no context won't work. Selecting the courses from parsing should have given a better frame of reference."

> "What I want is for each individual row to be used to search through the matrix document (original) in the Qdrant db, and for it to be removed if it can't be matched to a given table, knowing that the spec is there."

> "This is far too complex. Give me a simple form that allows me to reduce this task to something simple. Do better. Simple."

## What I got wrong

1. **Built editing affordances when verification was needed.** The PC doesn't want to edit matrix data — they want to confirm the AI read the source document correctly. The current screen makes them feel like data-entry clerks.
2. **No frame of reference per row.** The cell table shows codes (I,KM / TKH / etc) with no way to see where that row came from in the source DOCX. The "Show original source-document table" collapsible is the WHOLE matrix dumped in one block — useless for verifying spec 11.d specifically.
3. **Jargon in the help text.** "Mammoth strips merged-cell formatting" assumes the user knows what mammoth is. They don't, and they shouldn't have to.
4. **Too many controls on one screen.** Column dropdowns + AI suggestions + confidence pills + "Run AI" + "Accept all green" + cell table + per-row dropdown + remove + restore + source-doc collapsible = 9 distinct affordances. A PC scanning this screen for the first time sees a wall of widgets.
5. **The current "Accept all green" button is dangerous.** It bulk-accepts AI suggestions without the PC verifying each one against the source. The verify-in-context drawer I shipped was a partial mitigation but adds yet another screen to navigate.

## The redesign

### One row at a time

Replace the entire Matrix step with a single linear form:

```
┌─────────────────────────────────────────────────────────────┐
│  Curriculum matrix — verify row 1 of 75                     │
│                                                             │
│  We found this row in your document:                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Spec 11.a — Knowledge, Theory, Skills, and Values   │   │
│  │                                                     │   │
│  │ "The historical roots of human services"            │   │
│  │                                                     │   │
│  │ Course-coverage codes from the document:            │   │
│  │   • Column 1 (CHS 105): I,KM                        │   │
│  │   • Column 7 (CHS 380): K,M                         │   │
│  │   • Column 9 (CHS 430): ITKS  H                     │   │
│  │   ... 5 more course columns                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Here's where this row sits in your original document:      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [embedded original document table, scrolled to     │   │
│  │  the matching row, with the row outlined in        │   │
│  │  yellow]                                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Does this look right?                                      │
│                                                             │
│  [ Yes — keep this row ]    [ No — remove this row ]       │
│                                                             │
│         ◄  Previous row              Next row  ►            │
└─────────────────────────────────────────────────────────────┘
```

That's the entire screen. No dropdowns, no confidence pills, no column mapping.

### How "match against source" works

The Qdrant `cshse_matrix_context_{env}` collection (shipped with CR-025 for column inference) already has the surrounding-narrative paragraphs per matrix. We extend the ingest to ALSO embed every individual row of the matrix's raw `<table>` HTML. Then, per-row verification:

1. AI service endpoint `POST /ai/matrix/find-row-in-source` takes the row's spec key (e.g. `11.a`) + the matrix slug.
2. Qdrant searches for the row in the per-institution `cshse_matrix_rows_{env}` collection.
3. If a high-confidence match is found: return the source HTML fragment + the row's exact position so the client can highlight it.
4. If NO match is found: the row gets auto-removed without asking the PC.

### Auto-removal of un-matched rows

Per the user's direction: "for it to be removed if it can't be matched to a given table, knowing that the spec is there."

When the verification API returns "no source match" for a row, the row is silently dropped from the wizard's matrix payload. The PC never sees that row. On the cover-page summary screen we can disclose "12 rows were removed because we couldn't find them in your source document" so the audit trail is visible.

### Plain language everywhere

- "Mammoth strips merged-cell formatting" → **DELETED** entirely. Coordinators don't need to know about mammoth or merged cells.
- "Curriculum matrix — map columns to your courses" → **"Check the courses in your matrix"**
- "What you're seeing" → **"What this screen does"**
- "AI suggestions pre-fill with a confidence indicator" → **DELETED**. No confidence indicators. We either know the answer or we ask.
- "Run AI column inference" → **DELETED**. AI runs automatically; no button.
- "Cell-code legend: I Introduction T Theory K Knowledge S Skills · L Low / M Medium / H High depth" → **kept**, but only on the source-document panel where the codes actually appear.

### Per-row column mapping happens AUTOMATICALLY

The PC never types a course code. The AI column inference from CR-025 still runs, but the result is **applied silently** and the PC sees the resolved course name in the per-row card ("Column 1 (CHS 105): I,KM"). If the AI confidence on a column is below threshold, the column shows as "Column 1 (unknown course): I,KM" — and the PC can use the source-doc panel to identify it visually if they want, but they aren't required to.

### Bulk option for the impatient

A single "Keep everything that has a source match" button at the top of the screen. One click → every row that has a Qdrant source match gets auto-kept; every row that doesn't gets auto-dropped. The PC then reviews the summary and clicks Next. Probably 90% of users will use this and finish the matrix step in under 30 seconds.

## Acceptance

- [ ] The new Matrix step has NO column-mapping dropdowns visible to the PC.
- [ ] Each row shows: spec code + spec title + the row's codes resolved to course names + the embedded source-document fragment scrolled to that row.
- [ ] Per-row buttons are "Yes — keep this row" and "No — remove this row."
- [ ] Prev/Next navigation between rows.
- [ ] "Keep everything with a source match" bulk option at the top.
- [ ] Rows with no Qdrant source match are auto-dropped, with a visible count on the summary.
- [ ] All help text is plain English, no jargon (no "mammoth", "DOCX", "merged-cell", "embedding", "confidence", etc.).
- [ ] A coordinator who has never seen the screen can complete the matrix step in under 2 minutes with no engineering help.

## Files affected

### ai-service

- `ai-service/app/matrix/row_search.py` (new) — Qdrant search per-row + match scoring
- `ai-service/app/main.py` — new endpoint `POST /ai/matrix/find-row-in-source`
- `ai-service/app/import_jobs.py` — extend `ingest_matrix_context` to ALSO ingest per-row content
- `ai-service/app/config.py` — `matrix_rows_collection` property

### server

- `server/src/controllers/aiImportController.ts` — `findRowInSource` controller + route
- `server/src/routes/imports.ts` — new route

### client

- **`client/src/features/selfStudy/Editor/AIImport/steps/MatrixStep.tsx` — full rewrite.** Existing component is ~700 lines; the rewrite is closer to 200. Delete `MatrixPreviewDrawer.tsx`, the column-dropdown logic, the verify-in-context flow, the per-row controls column, the "Accept all green" + "Run AI column inference" buttons.
- `client/src/features/selfStudy/Editor/AIImport/steps/MatrixRowCard.tsx` (new) — one-row card component
- `client/src/store/aiImportStore.ts` — replace `matrixRowEdits` (retag/remove/restore) with a simpler `matrixRowVerdicts: Record<rowAnchor, 'keep'|'remove'|'auto-removed'>`

### code removed

- `MatrixPreviewDrawer.tsx`
- `MatrixColumnDropdown.tsx` (if it exists)
- The retag/remove/restore store actions
- The "Run AI column inference" button + endpoint forwarding
- The "Accept all green" button

## Test plan

- **E2E (the most important):** drop a coordinator who has never seen the wizard in front of a Stevenson DOCX import. Time how long it takes them to finish the Matrix step. Target: under 2 minutes with zero engineering questions.
- **ai-service unit:** `row_search` returns high-confidence matches for known-good rows in the Stevenson matrix; returns no-match for synthesized random rows.
- **Client unit:** keep/remove/auto-removed verdict state machine.
- **Integration:** rows with no Qdrant match auto-drop before the PC sees them.

## Dependencies

- CR-025 column inference plumbing stays in the ai-service backend (we still need to resolve "Column 1" → "CHS 105" silently); only the UI is rewritten.
- CR-026 row controls are SUPERSEDED. The "move row to different spec" affordance is removed entirely; rows are tied to specs by the source-document position, not by user editing.

## Open questions

- **What if the PC has a row where the AI correctly read the spec but mis-read a column code?** They click "No — remove this row," then re-enter the row manually in the Curriculum Matrix tab afterward (the existing per-standard matrix editor handles this case fine). The wizard isn't the right place for cell-level edits.
- **What about rows where AI matched the spec wrong?** Same answer — Keep or Remove are the only choices. If the spec is wrong, Remove and re-create from the matrix tab. The wizard's job is to get 90% of the data in with minimum friction, not to be a full matrix editor.
- **Mammoth merged-cell limitation still exists.** We don't try to fix it in the UI; we work around it server-side by searching the raw `<table>` HTML bytes (which still have merged-cell header info even when mammoth's DOM walk loses it).

## Rollout

When user gives the green light:

1. Ship the new MatrixStep.tsx + ai-service row search in one commit. Old code deleted, not toggled.
2. Keep CR-025 column inference plumbing in place (silently used).
3. Mark CR-025 and CR-026 status as `superseded`.
4. Update [[wizard-user-guide-2026-05-20]] to reflect the new screen.

No feature flag, no gradual rollout — the current screen is unusable; we're replacing it.

## Personal accountability

I built the original Matrix step incrementally over three sprint slices (S2B.6, S2B.7, S2B.8) without ever stepping back to ask whether the whole shape was right. Each individual feature (column inference, confidence pills, verify-in-context drawer, per-row controls) made sense in isolation; together they made the screen unusable. CR-029 is the lesson — when a screen accumulates more than three primary affordances, stop and ask whether the underlying model is wrong, not whether to add another widget.
