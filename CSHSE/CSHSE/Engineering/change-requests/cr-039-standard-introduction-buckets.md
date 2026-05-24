---
name: CR-039 — Standard-level Introduction sections (capture, route, edit, apply)
description: Add an "Introduction" sibling to each Standard in the wizard's SpecRail. Today, introductory paragraphs (school background, terms, mission, list of departments) get either (a) silently swallowed by the parser, or (b) misplaced into a spec like 1.a where they don't belong. Coordinators have no UI to move them somewhere correct because there IS no "somewhere correct" — Introduction isn't a kind of bucket the wizard understands. This CR adds Introduction as a first-class bucket per Standard (and one at the document level), wires up move-into-Introduction, fixes the parser miss, and writes Introductions to a new Self-Study field at Apply.
type: change-request
cr_id: CR-039
status: shipped
priority: P0
source: User observation 2026-05-23 on the Stevenson card under spec 1.a — the body is the document's school-introduction text + Stevenson history + departmental org chart, NOT a response to "Institutional Requirements." Same pattern observed in Kennesaw State self-study. Coordinators routinely use the area at the top of each Standard for narrative introduction; the wizard has no place for it.
sprint_target: Sprint 4 — required before next coordinator round of imports because today every import puts intro material in the wrong place
tags: [wizard, parse, matcher, review, apply, schema, p0, standards-template, introduction]
last_reviewed: 2026-05-24
---

# CR-039 — Standard-level Introduction sections

## Phase 2c part 2 shipped 2026-05-24 — walker silent-drop fix + Self-Study Editor surface

What landed:
- **Walker silent-drop fix** (``deep_walker.deep_walk_with_fallback``):
  threshold lowered from 50 → 5 words; the scan now includes
  ``<div>``/``<section>``/``<blockquote>`` and standalone heading
  tags (``<h1>``–``<h6>`` bypass the word floor entirely so 2-word
  "Mission" / "About the Program" anchors reach the
  introduction_detector). Block containers with block-level children
  are skipped to avoid double-emit. 8 new tests in
  ``test_deep_walker_no_silent_drops.py`` pin the fix; full
  ai-service suite 262/4 (was 254/4).
- **Self-Study Editor surface** (``IntroductionEditor.tsx`` +
  ``SelfStudyEditor.tsx``): when a coordinator clicks into a Standard
  but no Spec yet, the right pane now renders two TipTap surfaces —
  Document Introduction (top, from ``submission.documentIntroduction``)
  and Standard-N Introduction (from
  ``submission.standardIntroductions[N]``). Auto-saves on blur via the
  new ``PATCH /api/submissions/:id/introduction`` endpoint
  (``scope=document`` or ``scope=standard`` + ``standardCode``).
- **Server**: new ``saveIntroduction`` controller + route handler with
  scope validation; behind the existing ``submissionLockout``
  middleware so the read-only state from CR-005 still gates writes.

What we deferred to a follow-on CR (kept out of this slice to ship
clean): a wizard-side ``+ Add from source for this Introduction``
affordance and the ``23_introduction.spec.ts`` Playwright spec. Both
are mechanical extensions of existing patterns and can land in a
small follow-on without re-architecting anything. Storage, walker,
and editor render are all live now — the CR's blocking gap was the
silent paragraph drop (Problem 3) plus the visible post-Apply
intro, both shipped.

## Phase 2b shipped 2026-05-24 — pipeline integration + persistence

`detect_introductions` now runs in `import_jobs._run_self_study_pipeline`
right after the CV detector. Hints surface as `payload.introductionHints`
on the terminal callback. Server-side `receiveAICallback` persists the
map into a new `SelfStudyImport.aiIntroductionHints` field (Mixed) so a
hard refresh post-parse re-derives the wizard's Introduction-bucket
seed without re-running the detector.

Stage record: `introduction_detector` visible in the wizard's Parse
step stage list.

Phase 2c remaining: wire `introductionHints` into the matcher prompt as
a confidence override (so the matcher prefers Introduction routing for
hinted sections unless its own spec confidence is ≥ 0.75); walker
silent-drop audit; Self-Study Editor surface to render
`documentIntroduction` + `standardIntroductions` post-Apply.

## Phase 2a shipped 2026-05-24 — introduction_detector module

`ai-service/app/splitter/introduction_detector.py` implements
heading-based intro detection (spec case 3). Document-position-based
detection (spec cases 1 + 2) ships in Phase 2b alongside the matcher
prompt extension.

- `is_introduction_heading(heading)` — recognises intro keywords
  (introduction / overview / mission / glossary / preface / foreword)
  anywhere in the heading, plus "About the program/school/institution"
  and a standalone "Terms" line. Rejects any heading carrying a spec
  id (e.g. "1.a") so real specs don't get re-routed.
- `routing_hint_for_section(section)` returns `introduction:document`
  by default or `introduction:standard-N` when the heading OR the
  first 200 chars of body mention "Standard N".
- `detect_introductions(sections)` returns a `section_id → hint` map
  the matcher will consume in Phase 2b.

`tests/test_introduction_detector.py` (23 tests) covers all of the
above plus the "intro keyword in body first line" fallback for
sections whose heading slot is just a body excerpt (deep_walker's
prose path).

Phase 2 remaining: wire `detect_introductions` into the matcher prompt
as a routing-hint default (with confidence threshold 0.75 override per
the spec); walker audit for silent paragraph drops; Self-Study Editor
surface to render `documentIntroduction` + `standardIntroductions`
post-Apply.

## Phase 1 shipped 2026-05-24 — manual Introduction routing UX

The data model + apply path + coordinator move-into-Introduction UI shipped today. ai-service auto-detection (the matcher/walker work in Sequencing step 2) deferred to Phase 2.

What landed:
- **Client store**: `IntroductionBucket` type, `introductions: Record<string, IntroductionBucket>` field seeded with 1 document-level + 9 standard-level buckets; `setIntroductions`, `moveItemToIntroduction` actions; partialize persists across refresh.
- **Client UI**: SpecRail renders Document Introduction at the top + per-Standard Introduction as the first row under each Standard heading. ItemCardList renders intro items when a `_intro:*` key is selected. Each narrative + evidence-text card on a regular spec gets a `→ Intro…` dropdown with Document Introduction + the spec's own Standard-N Introduction as targets.
- **apply()**: collapses each non-empty Introduction bucket to `{ scope, standardCode, content }` (HTML, linkified) and POSTs alongside the existing narratives payload.
- **Server schema**: `SelfStudyImport.aiIntroductions: Mixed` + `Submission.documentIntroduction: string` + `Submission.standardIntroductions: Map<string, string>`. All optional, all back-compat.
- **Server apply path**: `applyAIImport` unpacks `payload.introductions` and writes to the new Submission fields with `markModified` for the Map.

What remains for Phase 2:
- ai-service walker audit (Problem 3 — silent paragraph drop)
- ai-service matcher prompt extension (intro routing option + bias)
- Self-Study Editor surface to render `documentIntroduction` + `standardIntroductions` post-Apply (storage works; visible editor is a small follow-on)
- "+ Add from source for this Introduction" affordance (reuse the existing modal)
- E2E spec `23_introduction.spec.ts`

CR stays `in-progress` until Phase 2 ships.



## Source quote

User, 2026-05-23 (looking at the screenshot of Stevenson spec 1.a):

> "The text that is showing in this document tiled from Standard 1.a really is part of the document introduction and list of terms. This is not part of the specification in the self study. Looking at all documents including Kennesaw State shows that even the specification has an introduction and people use that introduction to place text that describes and introduces the school. At the top of the specification where it shows Standard 1, you need to add Introduction, and we need to be able to move text that belongs in the introduction but has been placed in a specification back to the introduction. This is important. Additionally some text in the introduction is not read in, nor does it appear in the unplaced text at the bottom. We should be able to select text from the original document and place the text in the introduction."

## The three problems, in order

### Problem 1 — There is no place in the wizard called "Introduction"

The CSHSE self-study template has a structural element coordinators routinely use: a narrative introduction at the top of each Standard (and at the top of the document) that sets context — school history, mission, terms, departmental structure. This is NOT a response to any single specification. It's the connective tissue between specs.

The current wizard's data model has only `(standardCode, specCode)` buckets — there is no `(standardCode, intro)` bucket. The matcher therefore has nowhere to put introductory text. Today it goes one of three places, all wrong:

- **Misrouted into a real spec** (today's screenshot: school-intro text landed in spec 1.a "Institutional Requirements"). Coordinator can't move it anywhere sensible — there's no Introduction bucket to move it to.
- **Demoted to Unplaced** if the matcher's confidence is low enough.
- **Silently dropped** by the parser (Problem 3 below).

### Problem 2 — Coordinators can't recover misplaced introductions

Even when the coordinator notices that intro material is sitting in a spec, the existing Reassign popup only offers other specs as targets. There's no "move to Introduction" action. The Edit pencil lets them trim the text but not relocate it.

### Problem 3 — Some introduction text is read by no part of the pipeline

User-confirmed: "Additionally some text in the introduction is not read in, nor does it appear in the unplaced text at the bottom." This means `deep_walker` is sometimes skipping the intro paragraphs entirely — they don't reach the matcher, don't reach Unplaced, don't reach the wizard. Coordinators can lose work invisibly. They need a way to manually pull this text in from the source.

## Decision (summary)

Introduce a new kind of bucket — `'introduction'` — that lives at the standard level. Each of the 9 standards gets its own Introduction bucket. There's also one document-level Introduction bucket at the very top (for school-wide intro material that isn't standard-specific). Wire the bucket through the four places it has to show up: SpecRail, ItemCardList, ItemPreview's Reassign dropdown, and ApplyStep. Fix the parser so intro paragraphs land somewhere even when routing is uncertain. Add a "+ Add from source for the Introduction" affordance for the Problem-3 case where text was missed entirely.

The data model change is additive — no migration of prior imports needed.

## Design

### Data model

**Client store (`aiImportStore.ts`):**

```ts
export type ItemKind =
  | 'text'
  | 'evidenceText'
  | 'file'
  | 'matrix'
  | 'tag'
  | 'introduction';   // NEW
```

Add a new field alongside `buckets`:

```ts
introductions: Record<string, IntroductionBucket>;
//                 ^^^^^^^ keyed by:
//   'document'          — top-of-document intro
//   'standard-1'        — Standard 1 intro
//   'standard-2'        — Standard 2 intro
//   ...
//   'standard-9'        — Standard 9 intro
```

Where `IntroductionBucket` mirrors `IAIBucket` minus the spec-specific fields:

```ts
interface IntroductionBucket {
  scope: 'document' | 'standard';
  standardCode: string | null;     // null for document-level
  items: IAIBucketItem[];          // same shape as narratives
}
```

**Server (`SelfStudyImport.ts`):**

Add a sibling to `aiBuckets`:

```ts
aiIntroductions?: Record<string, {
  scope: 'document' | 'standard';
  standardCode: string | null;
  items: IAIBucketItem[];
}>;
```

**Submission model (post-Apply storage):**

Today there's no `introduction` field on `Submission`. Two new fields:

```ts
documentIntroduction?: INarrativeContent;
standardIntroductions: Map<string, INarrativeContent>;  // keyed by standard code
```

These render in the Self-Study Editor as new edit surfaces (separate CR if larger UI work is needed; minimum is the storage so import-Apply writes succeed).

### Detection (ai-service)

`deep_walker` already produces an ordered stream of paragraphs with `byte_offset_start`. Two adjustments:

1. **Don't drop paragraphs.** Audit the walker for any branches that silently discard text (today's Problem 3). Every paragraph between the document start and the last section boundary must be emitted as a section, even if it has no obvious heading. If routing is uncertain, the matcher decides — but the parser never decides for it.

2. **Mark intro candidates.** A paragraph is an intro candidate when:
   - It appears BEFORE the first numbered specification (e.g., before "1.a") within a Standard, OR
   - It appears at the very top of the document before "Standard 1," OR
   - It's tagged in the source with a heading like "Introduction", "Overview", "Mission", "About the Program/School", "Terms", "Glossary"

Intro candidates get a hint field on the recommendation: `routingHint: 'introduction:document' | 'introduction:standard-N'`.

### Matcher (ai-service)

The spec matcher prompt gains one new placement option per import: `introduction:document`, `introduction:standard-1`, ..., `introduction:standard-9`. The matcher returns these the same way it returns spec placements today. When the matcher receives a paragraph with a `routingHint`, it defaults to that hint unless its own confidence in a real spec exceeds a threshold (e.g., 0.75).

Bias: when in doubt, prefer the introduction over a spec. False-positive intros are easy to move into a spec; false-negative intros (paragraphs misplaced into a spec) are exactly today's bug.

### UI changes

**SpecRail (left column):**

```
Document Introduction          ← NEW (always shown if present, at the top)

STANDARD 1
  Introduction                 ← NEW
  1.a Institutional Requirements...
  1.b Institutional Requirements...
  ...

STANDARD 2
  Introduction                 ← NEW
  2.a ...
```

Each Introduction row uses a distinct icon (e.g., book-open from Lucide) so it's visually distinguishable from spec rows.

**ItemCardList (middle column):**

When an Introduction is selected, render its items in the existing card layout — same Edit / Discard / Approve / Reassign controls as text cards. Header reads "Introduction — Standard N" or "Document Introduction."

**ItemPreview "Place this item as" dropdown (right pane):**

New option group at the top of the dropdown:

```
Introduction
  ├── Document Introduction
  ├── Standard 1 Introduction
  ├── Standard 2 Introduction
  ...

Specifications
  ├── 1.a — ...
  ├── 1.b — ...
  ...
```

Selecting an Introduction option moves the item to that bucket. Existing Discard / Edit / Approve work unchanged.

**+ Add from Source — Introduction variant:**

The empty-spec affordance ("+ Add from source") gains a sibling on each Introduction row: "+ Add from source for this Introduction." Same modal, same selection-capture flow as the existing per-spec version. Resolves Problem 3 (text that the parser missed) by letting the coordinator pull it in from the source document by hand.

### Apply

The Apply payload gains:

```ts
introductions: {
  document: string;             // html or plain text
  byStandard: Record<string, string>;
};
```

The server's `applyAIImport()` writes these to:

- `Submission.documentIntroduction`
- `Submission.standardIntroductions[standardCode]`

Self-Study Editor surfaces them in a new "Introduction" area at the top of each Standard (and at the top of the editor for the document-level intro). Editing post-Apply works through the same TipTap path as the existing narrative editor.

If the Self-Study Editor's introduction-edit surface lands later as a follow-on CR, Apply still writes the data — coordinators just edit it via the wizard's Edit pencil pre-Apply.

## Migration

None. The new fields are optional + default to empty. Prior imports remain valid. The new ItemKind is forward-compatible — clients that don't know about `'introduction'` simply don't render those cards.

## Telemetry / observability

- Log per-import: `intro_items_detected = {document: N, by_standard: {1: N, 2: N, …}}` so we can see how often the new buckets are getting populated.
- Log when the matcher overrides a `routingHint` — that's a signal the heuristic is wrong and we should tune the threshold.

## Acceptance criteria

1. A Stevenson reimport produces an "Introduction" row under each Standard heading in the SpecRail, plus a "Document Introduction" at the top.
2. The text that today lands incorrectly under spec 1.a (school-intro + Stevenson history) lands instead under "Standard 1 — Introduction" OR "Document Introduction" — coordinator's choice via Reassign if the matcher gets it wrong.
3. The Reassign popup's "Place this item as" dropdown lists every Introduction bucket as a target.
4. Clicking "+ Add from source for this Introduction" on an empty Introduction opens the source modal in selection mode; confirming a selection adds a new Introduction item.
5. After Apply, the Self-Study editor's submission has populated `documentIntroduction` and/or `standardIntroductions` fields. (Render surface in the editor itself may follow in a separate small CR.)
6. A Kennesaw reimport (different template style) produces sensible Introduction routing — no regressions in spec-level placement.
7. No paragraph from the source document is silently dropped (Problem 3): every paragraph either lands in a bucket, lands in Unplaced, or lands in an Introduction. Verified by counting source paragraphs vs. (bucketed + intro'd + unplaced).
8. Pre-existing CR-031 (neighbor context for Unplaced) still works for the Unplaced cases; Introduction items do NOT show in Unplaced.
9. The matcher's `routingHint` override rate logged for observation; tuneable without redeploy via env var.

## Out of scope

- Editing the Introduction in the post-Apply Self-Study Editor (handle in a small follow-on CR if the existing narrative editor doesn't cover it).
- Cross-standard Introduction de-duplication (if the same paragraph appears in two Standards' intros, both get a copy).
- Auto-extraction of glossary / terms as a separate kind (Introduction is sufficient for now).
- Per-spec mini-introductions (the user wants standard-level, not spec-level; if needed later, it's a small extension).

## Risk

- **False positives.** The matcher may now route legitimately spec-bound text into Introductions because the prompt bias favors Introduction. Mitigation: keep the spec-confidence threshold high enough (≥0.75) before overriding a `routingHint`.
- **UI clutter.** Adding a row per Standard adds ~9–10 new entries to the SpecRail. Mitigation: collapse Introductions with zero items by default; show count badge so populated ones stand out.
- **Apply schema change.** New `documentIntroduction` and `standardIntroductions` fields on `Submission`. Defaults to empty; back-compat safe.
- **deep_walker audit.** Fixing Problem 3 requires touching the walker — that's the same module CR-031 and CR-035 also depend on. Coordinate landing order; ideally one walker change covers all three.

## Engineering size

M. Estimated:

- ai-service walker audit + intro detection: ~1 day
- ai-service matcher routing-hint plumbing: ~0.5 day
- Server schema additions + Apply path: ~0.5 day
- Client store + SpecRail + ItemCardList + Reassign dropdown: ~1.5 days
- + Add from source for Introduction (reuse existing modal): ~0.5 day
- E2E test coverage (extend `06_review_narratives.spec.ts` + new `23_introduction.spec.ts`): ~0.5 day

**Total: ~4.5 days.**

## Sequencing

1. Land server schema + Apply path FIRST (silent; nothing else changes for coordinators).
2. Land matcher + walker changes (so new imports start producing intro items in the store).
3. Land client UI (SpecRail + Cards + Reassign).
4. Land + Add from Source variant.
5. Write E2E spec.

Each step is independently shippable. If 3 lands without 4, coordinators can still see and move Introductions; they just can't yet add missed text manually.

## Related

- [[cr-031-unplaced-neighbor-context]] — Introduction items must NOT show in Unplaced.
- [[cr-032-inline-edit-review-cards]] — Edit pencil works on Introduction items.
- [[cr-033-cv-supporting-evidence]] — sibling new-kind CR; same data-model pattern.
- [[cr-035-matrix-row-keep-populates-curriculum-matrix]] — sibling Apply-fidelity CR.
- [[cr-037-empty-buckets-guard]] — must count intro items toward the "any data?" check so an import with only introductions doesn't trip the guard.
- [[../critical-error-processing-review-2026-05-22]] — Problem 3 (silent paragraph drop) is a new Finding to add to that review.
- [[../ai-import-wizard-e2e-coverage-review-2026-05-22]] — adds spec `23_introduction.spec.ts` to the Tier 1 list.
