---
name: Narrative Storage
description: How per-Standard / per-Spec narrative content is shaped in the Submission document, edited in TipTap, persisted to MongoDB, and packaged for AI evaluation.
type: concept
tags: [narrative, mongoose, tiptap, validation, data-model]
last_reviewed: 2026-05-10
---

# Narrative Storage

The narrative is the prose half of every Self-Study (the other half is [[evidence-document-review-pipeline|supporting evidence]]). Narratives are stored inside the `Submission` document as a doubly-nested `Map`, edited in [[frontend-architecture|TipTap]], auto-saved on a debounce, and packaged into the [[n8n-integration|n8n validation webhook]] payload one Spec at a time.

## Data shape

Defined in [server/src/models/Submission.ts:33-39](../../../../server/src/models/Submission.ts), [server/src/models/Submission.ts:86](../../../../server/src/models/Submission.ts), [server/src/models/Submission.ts:218-225](../../../../server/src/models/Submission.ts):

```ts
narratives: Map<standardCode, Map<specCode, INarrativeContent>>

interface INarrativeContent {
  content: string;            // HTML produced by TipTap
  lastModified: Date;
  isComplete: boolean;        // coordinator-toggled "this Spec is done"
  linkedDocuments: string[];  // legacy pointer; current evidence linkage is via SupportingEvidence.standardCode + .specCode
  supportingEvidenceText?: string; // separate rich-text field for "narrative-style" evidence prose
}
```

Two text bodies per Spec: `content` (the narrative answer to the Spec) and `supportingEvidenceText` (free-form evidence-summary prose, distinct from uploaded evidence files).

Keys:

- `standardCode` is the bare standard number, e.g. `"1"`, `"11"`, `"21"` — see [server/src/data/standards.ts](../../../../server/src/data/standards.ts).
- `specCode` is the lowercase spec letter, **`"a"` through `"f"`** as defined in `data/standards.ts` (verified 2026-05-10). Note: [client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx:300](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) hardcodes `['a'..'h']` — a real bug; offering `g` and `h` options that map to no actual Spec.

Standards 1–21 are defined statically in [server/src/data/standards.ts](../../../../server/src/data/standards.ts). The shape of each `StandardDefinition` ([standards.ts:14-20](../../../../server/src/data/standards.ts)) is:

```ts
{ code: '1', title, description, part: 'I' | 'II', specifications: StandardSpecification[] }
```

Specs are **not** stored in MongoDB — they're compiled into the server bundle. The `Spec` Mongoose model in [server/src/models/Spec.ts](../../../../server/src/models/Spec.ts) is something different: it represents an **uploaded standards-source PDF** that an admin sends to n8n for vector embedding. Easy to confuse; see [[glossary]].

## Per-Standard status

`Submission.standardsStatus: Map<standardCode, IStandardStatusInfo>` ([Submission.ts:95](../../../../server/src/models/Submission.ts), [Submission.ts:127-141](../../../../server/src/models/Submission.ts)) tracks Standard-level rollup: status enum (`not_started` → `validated`), completion %, latest validation status, timestamps. Read by `recalculateProgress()` ([Submission.ts:299-326](../../../../server/src/models/Submission.ts)) to recompute `selfStudyProgress` aggregates.

## Mongoose-8 Map persistence trap

This is the single most important narrative-storage gotcha:

**Mongoose 8 does not persist subdocument fields written via `Map.set()` unless the parent path is marked modified.** Two patterns appear in the codebase:

1. `markModified('narratives')` then `submission.save()` — used in [importController.ts:1559](../../../../server/src/controllers/importController.ts), [submissionController.ts](../../../../server/src/controllers/submissionController.ts) auto-save handlers. Works, but vulnerable to lost-update races between concurrent saves.
2. **Atomic `$set`** — used in [validationService.ts:488-491](../../../../server/src/services/validationService.ts) to update `standardsStatus.${statusKey}` without round-tripping the whole document. The note at [Submission.ts:295-296](../../../../server/src/models/Submission.ts) explicitly removed an `updateStandardStatus()` method because `Map.set` + `save` did not persist its subdocument fields.

**Heuristic:** for cross-cutting nested-Map edits the controllers reach for pattern 1; for hot single-field writes the services reach for pattern 2. There is no enforced linter rule.

## Edit lifecycle

```
TipTap editor (NarrativeEditor.tsx)
    ↓ onUpdate (HTML)
useAutoSave hook (2-second debounce)
    ↓ PUT /api/submissions/:id/narratives/:standard/:spec
submissionController updateNarrative
    ↓ submission.narratives.get(...).set(...) + markModified('narratives') + save
MongoDB Submission document
```

Files involved:

- [client/src/features/selfStudy/Editor/NarrativeEditor.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx) — TipTap instance, toolbar, paste handlers.
- [client/src/hooks/useAutoSave.ts](../../../../client/src/hooks/useAutoSave.ts) — 2-second debounce. Two editors per page (main narrative + `supportingEvidenceText`).
- [server/src/controllers/submissionController.ts](../../../../server/src/controllers/submissionController.ts) — narrative save endpoint.

**Conflict policy:** when a server-side change lands while the editor has unsaved local changes, **the local TipTap state wins** with no merge UI ([[frontend-architecture|External-update conflict]]). Acceptable for single-coordinator use, dangerous if two coordinators ever edit the same Spec.

## Initial population (from import)

Most narratives don't start blank — they're populated by [[import-pipeline|the import pipeline]]:

1. Coordinator uploads a legacy DOCX/PDF.
2. Visually tags sections in [DocumentViewer](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx).
3. `POST /api/imports/:id/finish-tagging` writes each tagged section into `Submission.narratives` via the loop at [importController.ts:1502-1556](../../../../server/src/controllers/importController.ts).

Behavior on collision: when a second tag targets the same `(standardCode, specCode)`, the new content is **appended** to the existing content with `\n\n` ([importController.ts:1531-1533](../../../../server/src/controllers/importController.ts)) — never overwritten. Implication: re-running the same import twice will duplicate every narrative. There is no idempotency key.

## AI evaluation packaging

`validationService.triggerValidation(submissionId, standardCode, specCode)` ([validationService.ts:47-273](../../../../server/src/services/validationService.ts)) builds the n8n payload:

| Field | Source |
|-------|--------|
| `narrativeText` | `submission.narratives.get(standard).get(spec).content` ([line 209](../../../../server/src/services/validationService.ts)) |
| `evidenceText` | Caller-supplied (typically the editor's `supportingEvidenceText`) |
| `standardText`, `specText` | Static lookup via `getStandardByCode()` from [data/standards.ts](../../../../server/src/data/standards.ts) ([lines 155-166](../../../../server/src/services/validationService.ts)) |
| `supportingEvidence.documents` | `SupportingEvidence` query by `(submissionId, standardCode, specCode)` — **filename + type only**, NO file contents ([lines 173-194](../../../../server/src/services/validationService.ts)) |
| `supportingEvidence.urls` | Same query, URL records — `href + title + description` |
| `callbackUrl` | `${APP_URL || RAILWAY_PUBLIC_DOMAIN || localhost}/api/webhooks/n8n/callback` ([lines 147-150](../../../../server/src/services/validationService.ts)) |

A `ValidationResult` is created up-front in `pending` state ([lines 74-84](../../../../server/src/services/validationService.ts)), with `attemptNumber` and `previousValidationId` chained from the prior attempt for that `(submissionId, standardCode, specCode)`. The webhook is called single-shot with a 30s timeout ([validationService.ts:381-463](../../../../server/src/services/validationService.ts)) — **no retry loop** despite Readme claims (see [[n8n-integration]]).

When n8n fires `POST /api/webhooks/n8n/callback`, `processCallback()` ([validationService.ts:278-376](../../../../server/src/services/validationService.ts)):

1. Looks up by `n8nExecutionId`; falls back to `(submissionId, standardCode, specCode, status: 'pending')` — **the fallback is the C2 attack vector** ([[security-audit-2026-05-10]]).
2. Patches the result, sets `validatedAt`.
3. Calls `updateSubmissionValidationStatus()` which uses the atomic `$set` pattern above to flip `standardsStatus.{standard}_{spec}.validationStatus` to `pass` / `fail`.
4. Reloads the submission and calls `recalculateProgress()` to refresh aggregate counts.

## Queries the system runs against narratives

- `getLatestValidation(submissionId, standardCode, specCode?)` — `findOne({...}).sort({validatedAt: -1})` ([validationService.ts:512-525](../../../../server/src/services/validationService.ts)).
- `getValidationsForStandard(submissionId, standardCode)` — aggregation, group-by-spec, take latest ([lines 530-554](../../../../server/src/services/validationService.ts)).
- `getFailedSections(submissionId, standardCodes?)` — same aggregation pattern, filtered to `result.status: 'fail'` ([lines 559-587](../../../../server/src/services/validationService.ts)).
- `isStandardReadyForSubmission(submissionId, standardCode)` — returns `{ ready, failedSpecs[] }`; pass only if every Spec's latest is `pass` ([lines 650-678](../../../../server/src/services/validationService.ts)).

**Index gap:** `ValidationResult` lacks a compound index on `(submissionId, standardCode, specCode, validatedAt desc)`; the latest-first lookups scan more than they should. See [[storage-layer]].

## Gaps

| Gap | Where |
|-----|-------|
| No optimistic locking — last write wins | `submissionController` save handler |
| No idempotency on import re-application | [importController.ts:1531-1533](../../../../server/src/controllers/importController.ts) |
| No revision history of the narrative itself | only `lastModified` is kept |
| Validation never sees the **content** of uploaded evidence files | [validationService.ts:187-193](../../../../server/src/services/validationService.ts) — only metadata sent. This is the [[evidence-document-review-pipeline]] gap. |
| `linkedDocuments[]` field on `INarrativeContent` is dead — current linkage is via `SupportingEvidence.standardCode + .specCode` | [Submission.ts:37](../../../../server/src/models/Submission.ts) |

## Related

- [[evidence-document-review-pipeline]] — what's missing on the AI side
- [[import-pipeline]] — how narratives get bootstrapped from legacy docs
- [[n8n-integration]] — the validation workflow that consumes the packaged payload
- [[storage-layer]] — Mongoose 8 Map persistence + missing indexes
- [[module-catalog]] — every controller / service / model in one place
