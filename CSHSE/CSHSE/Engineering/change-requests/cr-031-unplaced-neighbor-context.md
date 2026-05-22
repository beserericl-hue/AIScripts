---
name: CR-031 — Unplaced text shows nearest placed neighbor + spec
description: When the coordinator opens an Unplaced item in the Review step, surface "the placed item just above this in your document was assigned to spec X.Y" plus a one-click "append this fragment to X.Y" action so unplaced fragments inherit their neighbor's placement.
type: change-request
cr_id: CR-031
status: shipped
priority: P1
source: User observation 2026-05-22 during smoke test (screenshot with arrow from rail to source modal)
sprint_target: Sprint 3 polish
tags: [wizard, unplaced, review, ux, neighbor-context]
last_reviewed: 2026-05-22
---

# CR-031 — Unplaced text shows nearest placed neighbor + spec

## Summary

When the matcher leaves a section as Unplaced, the coordinator currently has to manually scroll the source document, find the unplaced fragment, look at what came right before it, then guess which spec that prior content was assigned to. The "Show in source" modal already pinpoints where the unplaced text lives in the document — but it doesn't tell the coordinator anything about its placed neighbors. That gap forces the coordinator to scroll up + down + back to the rail to figure out "what was the spec for the paragraph above this orphan?"

Almost always, an unplaced fragment that sits one paragraph below a placed paragraph belongs to the same spec as that placed paragraph. The Handbook is structured that way — a single spec's content is usually one continuous run, with subsection headers + a few orphan sentences mixed in. Surface that signal and let the coordinator inherit the neighbor's placement in one click.

## Source quotes

User, 2026-05-22:

> "I am looking at unplaced text to determine where it is in the original document. I need a feature from the original document to look where the text above the unplaced text is placed. If I want to append the unplaced text to that location, I would need to know where that location is. Do these text tags in the UI have an entry in mongo that contains the original document snippet this was parsed from? We would need to know how this text is linked into the document, what is the tag above the document and what spec and subspec has been assigned to that tag. Give me a good plan to fix this. Keep it simple, but allow me to determine from the unplaced text where the tag is that IS placed."

(Screenshot attached to thread shows the Review page with an Unplaced item selected, the "Show in source" modal open, and an arrow drawn from the rail to the highlighted passage in the source HTML.)

## What already exists (good news)

We have most of the data already; the gap is just exposure + one extra computed field.

### ai-service: `app/splitter/sections.py`

```python
@dataclass
class Section:
    id: str
    heading: str
    byte_offset_start: int   # ← THIS is the positional anchor
    byte_offset_end: int
    ...
```

Every section the deep_walker emits carries `byte_offset_start` — the position in the source HTML where the section's text begins. Sections are walked in document order, so sorting any list of sections by `byte_offset_start` gives you their source order.

### server: `SelfStudyImport.ts`

```ts
interface IAIBucketItem {
  sectionId: string;       // ← already stored
  heading: string;
  snippet: string;
  htmlSnippet?: string | null;
  ...
}

interface IAITag {
  tagId: string;
  sectionId: string;       // ← already stored on unplaced items too
  ...
}
```

The `sectionId` is the join key. Every placed item AND every unplaced tag knows its sectionId.

### What's missing

The `byte_offset_start` field is **not propagated** from the Python Section into the wire format dict. So the server's stored IAIBucketItem and IAITag have the sectionId but no positional metadata. To compute "nearest placed neighbor before this unplaced item" we need positions.

## Decision

Three small additions, no schema migration of legacy data:

### 1. Propagate `byte_offset_start` into the wire format

`ai-service/app/splitter/sections.py:Section.to_dict()` (or the equivalent serialization point in `import_jobs.py`) should emit:

```python
{
    "sectionId": s.id,
    "byteOffsetStart": s.byte_offset_start,
    ...
}
```

`server/src/models/SelfStudyImport.ts` adds `byteOffsetStart?: number` to both `IAIBucketItem` and `IAITag`. Optional so legacy records remain valid. The applyAIImport controller's bucket-build path copies the field through.

### 2. Server endpoint or pure-client computation

Two options, both viable; recommend client-side because the data already arrives via the snapshot:

**Option A (recommended): pure client-side compute.** All cells/tags arrive in the wizard's `useAIImportStore` already. A new selector / helper on the Review page:

```ts
function nearestPlacedNeighborFor(
  unplacedTag: Tag,
  buckets: Record<string, SpecBucket>,
  windowBytes: number = 4000   // look within ~3 paragraphs above
): {
  std: string; spec: string;
  neighborHeading: string;
  neighborSnippet: string;
  distanceBytes: number;
} | null
```

Walks every placed item across all buckets, computes `delta = unplacedTag.byteOffsetStart - placed.byteOffsetStart`, keeps the placement with the smallest **positive** delta (i.e. placed strictly BEFORE the unplaced item) within `windowBytes`. Tie-break by largest byte offset (closest above).

**Option B (server-side):** new endpoint `GET /api/imports/:importId/unplaced/:sectionId/neighbor`. Heavier; only worth it if we want to share the logic with non-wizard surfaces. Skip for v1.

### 3. UI changes

On the Review page when the user selects the **Unplaced** rail entry and clicks any tag in the center pane:

```
┌─────────────────────────────────────────────────────────────────┐
│ Unplaced — "Human services majors at Stevenson..."              │
│                                                                  │
│ Body of the unplaced fragment...                                 │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ 📍 Nearest placed neighbor (just above in your document)   │ │
│ │                                                              │ │
│ │ Placed under spec 4.b — Program Evaluation                  │ │
│ │ "Papers should address the information in the format..."    │ │
│ │ 187 bytes earlier in the document                            │ │
│ │                                                              │ │
│ │ [ Append this fragment to 4.b ] [ Show neighbor in source ] │ │
│ └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

If no neighbor exists within `windowBytes`, render a softer "No nearby placed content — pick a spec manually below" message.

**Append action** dispatches the existing `moveItem` from a synthetic "tag" source to the neighbor's `(std, spec)` as a narrative (or evidence, configurable). Reuses the kind-chip mechanism that just got fixed; sets `dirty: true` for hard-refresh persistence.

## Acceptance

- [ ] `byte_offset_start` flows from Python Section through to client `Tag` + `BucketItem`
- [ ] Client helper returns the nearest placed neighbor (or null) for any unplaced tag
- [ ] Review page renders a "Nearest placed neighbor" panel under the unplaced item with: spec code, heading excerpt, byte distance, and an "Append to neighbor's spec" button
- [ ] Append action moves the unplaced tag into the neighbor's bucket as a narrative; the tag disappears from Unplaced; the bucket's count + matrix-coverage view both update
- [ ] Edits persist across hard refresh (CR-029 dirty flag already covers this)
- [ ] "Show neighbor in source" button opens the existing ShowInSource modal targeted at the neighbor's section, not the unplaced one
- [ ] Negative case: when no placed neighbor falls within the 4000-byte window, the UI shows "no nearby placed content" and doesn't render an append button

## Files affected

### ai-service

- `app/splitter/sections.py` — already has `byte_offset_start` on Section; verify `to_dict()` includes it (it currently doesn't, per inspection 2026-05-22)
- `app/import_jobs.py` — wire-format dict that goes into buckets/tags needs to carry the offset
- Add a unit test pinning the field through end-to-end

### server

- `src/models/SelfStudyImport.ts` — `byteOffsetStart?: number` on `IAIBucketItem` + `IAITag` + their Mongoose schemas
- `src/controllers/aiImportController.ts` — bucket-build paths preserve the field on cell ingest

### client

- `src/store/aiImportStore.ts` — types for `BucketItem` + `Tag` add `byteOffsetStart?: number`
- `src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx` — new "Nearest placed neighbor" panel rendered when `selectedKey === UNPLACED_KEY` and a tag is selected
- New helper `src/features/selfStudy/Editor/AIImport/review/nearestPlacedNeighbor.ts` (or inline in ReviewStep) computing the join
- Append action wires through the existing `moveItem` from ReviewStep

## Dependencies

- CR-029 (matrix step redesign + parser tightening) — independent
- CR-027 (stale error on step-back) — independent
- CR-030 (subspec inference) — independent

## Open questions

- Should we surface the neighbor's spec as a **suggestion** that the coordinator confirms (current proposal — explicit "Append" click) or auto-place every unplaced item within the window? **Decision: explicit click only.** Auto-place would silently silence the matcher's "I don't know" signal; coordinators need to see + confirm the inheritance.
- Should the window be measured in bytes or in number of intervening sections? **Decision: bytes for v1.** Section sizes vary wildly; 4000 bytes captures roughly 3-4 paragraphs in most CSHSE documents. Tunable via a constant if it turns out to be wrong on real data.
- What if the nearest placed neighbor is in a totally different document section (e.g. the unplaced fragment lives right before a Standard 6 section header but the closest-above-by-byte was a Standard 5 narrative)? **Decision: that's still the right inheritance.** The byte distance is the strongest signal we have; the coordinator can reject the suggestion if it looks wrong.
- Should the "append" action default to kind=narrative or kind=evidenceText? **Decision: kind=narrative.** Match the existing default for moveItem. Coordinator can flip via the existing kind chips after the move.

## Rollout

Vault doc only at the moment. Implementation queued for Sprint 3 polish — small, no schema migration, no AI cost. Two engineer-days estimated.
