---
name: Evidence Document Review Pipeline (Missing)
description: The currently-missing AI pipeline that should pull evidence files from S3, parse their content, and judge them against the Standard text alongside the narrative. Today the validation workflow only scores the narrative and a tiny snippet of URL evidence.
type: concept
tags: [n8n, ai, evidence, s3, gap, design]
last_reviewed: 2026-05-10
---

# Evidence Document Review Pipeline (Missing)

## The gap

Coordinators upload evidence files (PDFs, Word, images, slide decks) per Spec into S3, and link URL evidence in the same UI ([[storage-layer]], [[frontend-architecture]]). [[product-requirements|The Handbook]] is explicit that **the Spec is only judged compliant when the evidence verifies the narrative claim** — so reviewing the narrative alone is insufficient.

> **On the term "EC3 folders" (raised 2026-05-10):** The phrase does not appear anywhere in the source code, the n8n workflow JSONs, or the CSHSE standards / handbook PDFs. Today the system has no "EC3" namespace — evidence is keyed in S3 as `{institutionId}/{versionId}/{filename}` ([server/src/services/s3Service.ts:69-76](../../../../server/src/services/s3Service.ts)) and grouped logically by `(institutionId, submissionId, standardCode, specCode)` in the [SupportingEvidence](../../../../server/src/models/SupportingEvidence.ts) model. If "EC3" refers to an external accreditation-evidence convention, the work below is what makes it possible — wherever the user thinks of "EC3 folders," the system today thinks of `(submissionId, standardCode, specCode)` evidence groups. If a literal "EC3" folder layer is required by an external workflow, it would map naturally to a coarser grouping above `standardCode` (e.g., `evidenceClass: 'EC1' | 'EC2' | …`) added to `SupportingEvidence` and surfaced in the UI.

The existing [[n8n-integration|self-study standard validation workflow]] today:

- Receives `narrativeText`, `evidenceText` (free-form), `evidenceUrls`, `evidenceFiles` (metadata only). Payload assembled at [server/src/services/validationService.ts:204-222](../../../../server/src/services/validationService.ts).
- The server-side query that fills `supportingEvidence.documents` selects `(submissionId, standardCode, specCode, isDeleted: false)` from `SupportingEvidence` and emits `{ filename, type, size }` only — never the file contents ([validationService.ts:172-194](../../../../server/src/services/validationService.ts)).
- Optionally fetches each `evidenceUrl` via HTTP GET, 15s timeout, **truncates to 10 000 characters**, then concats into the prompt (n8n workflow [cshse-self-study-standard-validation.json](../../../../n8n-workflows/cshse-self-study-standard-validation.json)).
- **Never opens the S3-stored evidence files.** The `evidenceFiles` field is metadata (filename, type) only.
- Scores 0–100; ≥80 = pass.

So today: a coordinator can upload a 200-page accreditation manual that perfectly demonstrates Spec 11a, and the LLM never reads a single character of it. The score reflects narrative quality only.

## Required behavior

For each Spec being validated, the AI must consider:

1. The Standard + Spec text (already in the prompt today).
2. The narrative (already in the prompt today).
3. **The full text of every evidence file linked to that Spec** (NEW).
4. **The fetched contents of every URL evidence linked to that Spec** (today: best-effort, untimely failures silently dropped).
5. The matrix cells touching this Spec — does the narrative cite the right course(s)?

It must produce, per Spec:

- A pass/fail with score and rationale (today's shape).
- **Per-evidence-file relevance**: for each linked file, did it support, partially support, or not support the claim? Quote the supporting passage.
- **Gap analysis**: what *would* be required to support the claim that the current evidence does not provide?
- **Common-error flags** from the Handbook §IV "Common Errors" list — matrix↔narrative congruence, missing Specs, etc.
- **PDF/link hygiene** — were any URLs unreachable / password-protected? Were any uploaded files non-PDF?

## Architecture sketch

### New / updated n8n workflow: `cshse-evidence-document-review`

```
Webhook  ─►  Validate input
         ─►  For each evidenceFile in payload:
               ├─ HTTP GET presigned-S3-URL
               ├─ Detect MIME (PDF / DOCX / PPTX / image)
               ├─ Extract text
               │    ├─ PDF: pdf-parse / textract
               │    ├─ DOCX: mammoth.convertToText
               │    ├─ PPTX: pptx-parser
               │    └─ Image: Tesseract OCR (already in package.json, unused)
               ├─ Chunk if >32K tokens
               └─ Per-chunk LLM relevance pass (gpt-4o-mini)
         ─►  Aggregate per-file findings + Standard/Spec/narrative
         ─►  Final LLM judgment with structured JSON output
         ─►  POST to /api/webhooks/evidence-review/callback
```

Streaming: emit a `file_result` callback per evidence file as soon as that file is judged, so the UI can show progressive feedback rather than waiting for all files. Mirror the streaming pattern already used by the [Document Matcher](../../../../n8n-workflows/cshse-document-matcher.json).

### Server changes

- **New trigger endpoint**: `POST /api/submissions/:id/standards/:code/specs/:spec/review-evidence` — gathers all evidence linked to that Spec, generates short-TTL presigned S3 URLs (≤5 min, see [[security-audit-2026-05-10|M4]]), packages with narrative + standard text, calls the new n8n webhook.
- **New callback endpoint**: `POST /api/webhooks/evidence-review/callback` — must be HMAC-signed (do NOT replicate the current unauthenticated-callback issue, see [[security-audit-2026-05-10|C2]]).
- **New model**: `EvidenceReviewResult` with `submissionId`, `standardCode`, `specCode`, `evidenceId`, `relevance: 'supports' | 'partial' | 'not_relevant'`, `quotedPassage`, `confidence`, `reviewedAt`. Index `(submissionId, standardCode, specCode)` and `(evidenceId)`.
- **Update** `validationService` to attach the latest evidence-review summaries when reporting a Spec's status.

### Client changes

- **EvidenceManager** ([client/src/features/selfStudy/EvidenceManager/](../../../../client/src/features/selfStudy/EvidenceManager/)): per-file row gains a "review status" pill (✓ supports / ◐ partial / ✗ not relevant / pending), clickable to a panel showing the AI's quoted passage and rationale.
- **NarrativeEditor** validation modal ([client/src/features/selfStudy/Editor/NarrativeEditor.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)): grow the existing modal with an "Evidence" tab listing per-file findings + gaps, alongside today's narrative-only feedback.
- **Reviewer workspace**: surface the same evidence-review pills so readers can quickly see what the AI thought of each file before they form their own opinion.

## Cost & performance considerations

- Most accreditation evidence is 5–50 pages. A 50-page PDF ≈ 25K tokens; well within gpt-4o-mini context.
- Heavy outliers (200-page college catalog) need chunking + retrieval (embed + RAG) rather than full-context.
- Per-Spec, per-revalidation cost scales linearly with evidence count. Cache results by `(evidenceId, evidenceVersionId, standardCode, specCode)` so re-running validation only re-evaluates files that changed since last run.
- Background-only — never block a save. Coordinator gets a "review in progress" pill that resolves async.

## Risks

- **Untrusted evidence content** — evidence is uploaded by coordinators (the people being assessed). A crafted PDF could attempt prompt injection. Wrap the file content in delimiters; instruct the LLM to treat anything inside as data, never instructions. Same defense as [[security-audit-2026-05-10|M8]].
- **Confidentiality** — evidence content goes to OpenAI. CSHSE / programs may have institutional rules about that. Surface this in admin UI with an opt-out per institution; if disabled, fall back to a manual-review-only flag.
- **OCR quality** — scanned PDFs vary wildly. Track confidence and let reviewers see "the AI couldn't read this clearly" rather than silently underweighting low-OCR-quality files.
- **Cost runaway** — auto-revalidation on every save is the obvious money pit. Trigger only on explicit "Save and Validate" + on submission, never on auto-save.

## Sequence with other in-flight work

This depends on:

- **Webhook callback security** ([[security-audit-2026-05-10|C2]]) — must be fixed *before* this new callback endpoint goes live, or it inherits the same vulnerability.
- **`isS3Configured()` bug** ([[incomplete-features-2026-05-10|#3]]) — without it, evidence is base64-in-Mongo, not S3, so presigned URLs aren't possible. Block this work on that fix.
- **Validation retry logic** ([[incomplete-features-2026-05-10|#4]]) — the new workflow inherits the same single-try, no-timeout pattern unless `callWebhook()` is hardened first.

Sequenced in [[sprint-plan-2026-05-10|Sprint 3]].

## Related

- [[product-requirements]] — why evidence review matters per the Handbook
- [[n8n-integration]] — current workflow inventory and contracts
- [[storage-layer]] — S3 presigned URL constraints
- [[security-audit-2026-05-10]] — security prerequisites (C2, M4, M8)
- [[sprint-plan-2026-05-10]] — when this lands
