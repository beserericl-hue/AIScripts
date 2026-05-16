---
name: Sprint Plan — 2026-05-16
description: Eight-sprint roadmap. New Sprint 1 ships an AI-assisted Import Wizard (Python FastAPI + Qdrant + Claude) to replace days of manual tagging with minutes of review. Original 7-sprint plan shifts to Sprints 2–8.
type: plan
tags: [sprint-plan, roadmap, claude-code, executable, ai-import]
plan_date: 2026-05-16
horizon: ~16 weeks (8 × 2-week sprints)
status: proposed
supersedes: sprint-plan-2026-05-11
last_reviewed: 2026-05-16
---

# Sprint Plan — 2026-05-16

**Supersedes [[sprint-plan-2026-05-11]].** Re-prioritised on user direction (2026-05-16): the AI-assisted Import Wizard is now Sprint 1, displacing the security-and-compliance work to Sprint 2 and everything else by one. Full per-story specs for old Sprints 1-7 still live in [[sprint-plan-2026-05-11]] — this plan adds the new Sprint 1 in full detail and references the prior plan for Sprints 2-8.

## How to read this plan

Same conventions as [[sprint-plan-2026-05-11#how-to-read-this-plan]] — story shape (Source / Context / Files / Steps / Acceptance / Test plan / Estimate / Blocks), three-layer test requirement, story-level wiki citation.

## What's new in this plan

- **NEW Sprint 1: AI-Assisted Import Wizard.** Python FastAPI microservice + Qdrant vector store + Claude Haiku adjudication + linear-wizard React UI. Targets the single largest user-pain point (coordinators say manual tagging takes days). Detailed in [[legacy-self-study-import]].
- **Sprint 2 (= old Sprint 1)** gets one new story: **S2.11 — document versioning** for both imported and exported documents, per user direction 2026-05-16. Lives next to security work because both touch the same RBAC + audit-logging foundations.
- **Sprints 3–8** are old Sprints 2–7 with one-up renumber. All cross-references inside stories (`S2.x`, `S3.x`, etc.) need mechanical update — that pass happens before the first PR lands.

## Sprint roster — at a glance

| # | Theme | Primary outcome | Source plan |
|---|-------|-----------------|---|
| **1** | **AI-Assisted Import Wizard (NEW)** | **Python service deployed; Stevenson legacy DOCX imported end-to-end in <2 hours instead of days; recommendations accepted with confidence-bar UI** | this plan |
| 2 | Compliance + critical security (was Sprint 1) + **document versioning** | Handbook-rule violations closed; all 6 audit Criticals fixed; imported/exported docs versioned | [[sprint-plan-2026-05-11#sprint-1]] + S2.11 below |
| 3 | Auth hardening + input validation + multi-PC (was Sprint 2) | All Highs + key Mediums closed; multi-PC live | [[sprint-plan-2026-05-11#sprint-2]] |
| 4 | Evidence AI review + emails + reader deadlines (was Sprint 3) | Pipeline + emails + 45-day timer | [[sprint-plan-2026-05-11#sprint-3]] |
| 5 | Evidence review UI + matrix editor + multi-matrix + reader DOCX (was Sprint 4) | UI pills, template matrix, reader-report DOCX | [[sprint-plan-2026-05-11#sprint-4]] |
| 6 | Common-error checks + completion checklist + tests (was Sprint 5) | Pre-submit gate; ≥60/50% coverage | [[sprint-plan-2026-05-11#sprint-5]] |
| 7 | Board decisions, cycle scheduler, E2E, polish (was Sprint 6) | Post-decision flow; ops runbooks | [[sprint-plan-2026-05-11#sprint-6]] |
| 8 | Joint Ventures (was Sprint 7) | JV entity + admin UI + dashboard grouping | [[sprint-plan-2026-05-11#sprint-7]] |

---

# SPRINT 1 — AI-Assisted Import Wizard (2 weeks, **PRIORITY**)

**Goal:** Replace days of manual tagging with a wizard where coordinators review AI-generated recommendations and accept/override. End-to-end against the **Stevenson University** legacy DOCX already in `bubbly-solace.develop` Mongo (`SelfStudyImport._id = 6988ea3dc92032593e6bb9cd`, 353 MB HTML, 11/100+ sections tagged manually so far).

**Prerequisites (already complete, 2026-05-16):**
- Qdrant service installed in `bubbly-solace` project — **single shared instance in the production env** (decision 2026-05-16: RAG retrieval is read-after-write, no need for env duplication). Dev env's Qdrant instance is sleeping to save cost. Service id `88a41a9a-f0c4-46f2-be0b-b4ea7d62532d`. API key in `/tmp/cshse-creds-2026-05-16/qdrant.env` (move to password manager).
- **Namespace isolation strategy:** dev and prod share the Qdrant instance but use **separate Qdrant collections** to guarantee isolation:
  - `cshse_specs` (shared read-only across both — same standards in both envs)
  - `cshse_sections_prod` and `cshse_sections_dev` (per-import section embeddings, env-scoped)
  - `cshse_narratives_xinst_prod` and `…_dev` (cross-institution search, env-scoped, board-flag-gated)
  - The Python AI service reads `CSHSE_ENV` env var at boot and routes writes to `cshse_*_{env}` collections.
- Develop Mongo synced from prod (1481 docs across 21 collections per log).

**Architecture decisions locked in (2026-05-16):**
- AI work runs in a **new Python FastAPI microservice** deployed as a Docker image to a new Railway service `cshse-ai`. Repo path: `ai-service/` at the AIScripts repo root. **One AI service per env** (cshse-ai in prod, cshse-ai in dev) — but both point at the same Qdrant instance.
- **Qdrant** is the vector store; **single shared instance** (prod env, dev's instance sleeps). Collections are env-namespaced (`cshse_specs`, `cshse_sections_{env}`, `cshse_narratives_xinst_{env}`).
- **Anthropic Claude Haiku 4.5** for spec-matching adjudication. **OpenAI `text-embedding-3-small`** for embeddings (1536-dim, decision 2026-05-16: org already has an OpenAI key in n8n credentials; consolidating vendors).
- **Linear wizard** UI: 5 steps (Upload → Parse status → Review section splits → Review tag recommendations → Apply & finish).
- **Cross-institution semantic search** is wired in code but **feature-flagged OFF by default** — admin toggle, can be enabled when CSHSE board approves.
- Existing Node CSHSE service stays the canonical write surface. The Python service is **read + recommend only**; every write goes through the existing `extract-section` / `insert-marker` pipeline to preserve the marker-mechanism invariants.

**Total estimate:** ~22 days of work across 13 stories. Single-engineer 7-day sprint won't fit. **Plan:** two engineers (one Python/AI track, one Node/UI track); converge on S1.10 (wizard UI integration) and S1.13 (E2E against Stevenson).

---

## S1.1 — Python AI service scaffolding + Railway deploy

**Source:** Architecture decision 2026-05-16. Foundation for every other Sprint 1 story.

**Context:** [[legacy-self-study-import]], [[railway-deployment-topology]].

**Files (NEW):**
- `ai-service/Dockerfile` — Python 3.12-slim base, install poetry, copy `pyproject.toml` + `poetry.lock`, install deps, copy app, `CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- `ai-service/pyproject.toml` — deps: `fastapi`, `uvicorn[standard]`, `anthropic`, `qdrant-client`, `pydantic`, `httpx`, `mammoth` (DOCX→HTML), `marker-pdf` (PDF→MD), `python-multipart`, `pyjwt` (HMAC service-to-service auth), `prometheus-client`.
- `ai-service/app/main.py` — FastAPI app, health endpoint, Sentry init optional.
- `ai-service/app/config.py` — env vars: `QDRANT_URL` (single shared instance — `http://qdrant.railway.internal:6333` in BOTH envs), `QDRANT_API_KEY`, `CSHSE_ENV` (`prod` | `dev` — drives collection-name suffixes), `ANTHROPIC_API_KEY`, `EMBEDDING_PROVIDER` (`voyage` | `openai`), `EMBEDDING_API_KEY`, `NODE_SERVICE_HMAC_SECRET`, `CROSS_INSTITUTION_SEARCH_ENABLED` (default `false`), `MONGO_URL` (for reading specs).
- `ai-service/app/auth.py` — HMAC-SHA256 verification middleware for `X-Service-Signature` header from Node service.
- `ai-service/railway.toml` — Railway build config: `builder = "DOCKERFILE"`, `rootDirectory = "ai-service"`.
- New Railway service `cshse-ai` linked to `beserericl-hue/AIScripts:main` (prod) / `:developer` (dev), rootDirectory `ai-service/`.

**Steps:**
1. Add `ai-service/` directory with Poetry-managed Python project.
2. Create `cshse-ai` Railway service via `railway add --repo beserericl-hue/AIScripts --service cshse-ai`. Set rootDirectory via GraphQL.
3. Set env vars (different keys per env): `QDRANT_URL=http://qdrant.railway.internal:6333` (resolves per-env), `QDRANT_API_KEY=${{Qdrant.QDRANT__SERVICE__API_KEY}}`, etc.
4. Deploy. Hit `/health` from outside.
5. Add `NODE_AI_SERVICE_URL` env var to CSHSE service (Node side) pointing at the new service's internal domain.

**Acceptance:**
- [ ] `GET https://{ai-service}/health` returns 200 with version + git SHA.
- [ ] HMAC middleware rejects requests missing/invalid signature.
- [ ] Service reaches Qdrant: `GET /health/qdrant` returns Qdrant cluster info.
- [ ] Service reaches Anthropic: `GET /health/anthropic` returns 200 (single small Claude call).

**Test plan:**
- **Unit:** `ai-service/tests/test_auth.py` — HMAC verifier accepts valid signatures, rejects tampered or expired (skew >5 min).
- **Unit:** `ai-service/tests/test_config.py` — required env vars surface clear errors when missing.
- **System / integration:** `ai-service/tests/test_health.py` — uvicorn TestClient hits `/health` + `/health/qdrant` (against a Qdrant Docker container in CI).
- **E2E:** N/A (infra; rolled into S1.13 Stevenson E2E).

**Estimate:** 1.5 days. **Blocks:** every subsequent S1 story.

---

## S1.2 — Document storage with versioning (S3 + version metadata)

**Source:** User direction 2026-05-16 ("documents imported and exported must be versioned so that institutions have records of documents through the years"); [[legacy-self-study-import#issue-2-original-file-not-retained]].

**Context:** [[storage-layer]], [[evidence-file-storage]].

**Files:**
- `server/src/models/DocumentVersion.ts` — NEW. `{ documentId, version, s3Key, fileName, mimeType, sizeBytes, uploadedBy, uploadedAt, ownerType: 'institution' | 'submission' | 'review', ownerId, kind: 'original_import' | 'parsed_html' | 'reader_report' | 'matrix_template' | 'spec_document', sha256, supersedes?: ObjectId, supersededBy?: ObjectId }`. Indexes: `(ownerType, ownerId, kind, version desc)`, unique `(documentId, version)`, `sha256` for dedup.
- `server/src/services/documentVersionService.ts` — NEW. `recordVersion(ownerType, ownerId, kind, buffer, fileName, mimeType, uploadedBy) → DocumentVersion`. SHA-256s the bytes, dedups against existing versions for the same `(ownerType, ownerId, kind)`, uploads new versions to S3 at `versioned/{ownerType}/{ownerId}/{kind}/v{N}/{fileName}`, links `supersedes`.
- `server/src/controllers/importController.ts` — upload handler calls `recordVersion` for the original file BEFORE parsing. Stores returned `documentId` and `version` on `SelfStudyImport.originalFileDocumentId` + `originalFileVersion`.
- `server/src/models/SelfStudyImport.ts` — add `originalFileDocumentId?: ObjectId`, `originalFileVersion?: number`, `parsedHtmlDocumentId?: ObjectId`, `parsedHtmlVersion?: number`.
- `server/src/controllers/reportController.ts` — reader-report generator (S5.10 in this plan, was S4.10) calls `recordVersion` for the produced DOCX with `kind='reader_report'`, `ownerType='review'`.
- `server/src/routes/documents.ts` — NEW. `GET /api/documents/:id/versions` (list all versions), `GET /api/documents/:id/versions/:n/download` (presigned URL). RBAC: same as the owning entity.
- `client/src/features/admin/Settings/DocumentHistoryPage.tsx` — NEW. Admin-visible page listing all versions for any institution/submission.

**Steps:**
1. Build the `DocumentVersion` model + `documentVersionService.ts`.
2. Wire imports: every upload of a new self-study DOCX creates v1 of an `original_import` document for that submission. Re-uploads (repair flow, replace) bump to v2.
3. Wire parsed HTML: when parser finishes, store the HTML as v1 of `parsed_html`. Marker insertions modify the live GridFS file but **don't bump the version** (markers are tag-tracked separately).
4. Wire reader-report DOCX: when generated, store as v1 of `reader_report` per `(reviewId)`. Re-submit bumps version.
5. Add versioned access endpoints + history UI in admin.

**Acceptance:**
- [ ] Every uploaded self-study has a `DocumentVersion` record with v1.
- [ ] Re-uploading the same submission's self-study creates v2 (does NOT overwrite v1).
- [ ] Every reader-report DOCX created from a Review has a versioned record.
- [ ] Admin sees the full history per institution: every imported + exported doc with date / version / size / downloadable.
- [ ] SHA-256 dedup prevents accidental duplicate-upload version bumps when the bytes are identical.

**Test plan:**
- **Unit:** `server/tests/unit/documentVersionService.test.ts` — `recordVersion()` increments versions correctly; identical bytes return the existing version; chains `supersedes` correctly.
- **System / integration:** `server/tests/integration/import-creates-version.test.ts` — POST `/api/imports/upload` → assert a `DocumentVersion` row exists with `kind='original_import'`, `version=1`.
- **System / integration:** `server/tests/integration/reader-report-creates-version.test.ts` — submit a review → assert `kind='reader_report'`, `version=1`, S3 key present.
- **E2E:** S6.4 admin journey (was S6.4 in old plan) extended: admin opens DocumentHistoryPage → sees imports + exports for the seeded institution.

**Estimate:** 2 days. **Blocks:** S1.3 (parser writes need to record parsed_html version), S5.10 (reader-report version). **Depends:** none (foundational).

---

## S1.3 — HTML + Markdown parser improvements

**Source:** [[legacy-self-study-import#issue-1-50mb-multer-limit-truncates-large-imports]], [[legacy-self-study-import#part-3-the-redesign-ai-augmented-import--tagging]].

**Context:** [[import-pipeline]], [[import-marker-mechanism]].

**Files:**
- `server/src/middleware/multer.ts` (or wherever Multer is configured) — raise `limits.fileSize` to 500 MB. Switch to disk storage (already in use per `tempFileService`) — confirm streaming-not-buffer mode.
- `server/src/services/documentParserService.ts` — extend to ALSO emit Markdown alongside HTML. Use `mammoth.convertToMarkdown()` for DOCX. For PDF, use `marker-pdf` (run via the Python AI service — server posts the PDF, gets back MD + HTML).
- `server/src/services/gridFsService.ts` — add second GridFS bucket `markdownContent` mirroring `htmlContent`. Same lifecycle: stored at parse, deleted at finish-tagging.
- `server/src/models/SelfStudyImport.ts` — add `extractedContent.metadata.markdownStoredInGridFS: boolean`, `extractedContent.metadata.markdownSize: number`.
- `ai-service/app/parsers/pdf_to_markdown.py` — NEW. Wraps `marker-pdf` for PDFs. Exposes `POST /parse/pdf` accepting multipart upload, returns `{ markdown, html, images: [{ filename, bytes }] }`.

**Steps:**
1. Bump Multer limit, verify with a 300 MB upload locally.
2. Add MD output to DOCX parser. Store via new `storeMarkdownContent` / `storeMarkdownContentFromFile` GridFS helpers.
3. Implement PDF parser in Python (marker-pdf is mature, MIT-licensed, handles tables and images). Node parser delegates: PDF parsing happens in the AI service, Node persists the result.
4. Update `SelfStudyImport` schema fields and storage flags.

**Acceptance:**
- [ ] 300 MB DOCX uploads without 50MB-limit rejection.
- [ ] After parse, both HTML (existing GridFS bucket) and Markdown (new GridFS bucket) exist for any import.
- [ ] PDF imports produce Markdown via the Python service; HTML produced from MD for the viewer.
- [ ] Re-running the parser is idempotent (versions don't double-bump).

**Test plan:**
- **Unit:** `server/tests/unit/document-parser.test.ts` — small DOCX fixture → asserts both HTML and MD output produced, structure preserved (headings, tables).
- **System / integration:** `ai-service/tests/test_pdf_parser.py` — sample PDF → MD includes expected headings + table-row text.
- **System / integration:** `server/tests/integration/parse-stores-both-formats.test.ts` — full parse path → GridFS has files in both buckets.
- **E2E:** N/A (parsing is a server-side step; covered by S1.13).

**Estimate:** 2 days. **Blocks:** S1.4 (splitter consumes MD). **Depends:** S1.1 (PDF path needs the Python service).

---

## S1.4 — TOC + heading-based section splitter

**Source:** [[legacy-self-study-import#part-3-the-redesign-ai-augmented-import--tagging]].

**Context:** Implements Tier A (TOC) → Tier B (headings) → Tier C (semantic chunking) splitter described in the redesign.

**Files (NEW):**
- `ai-service/app/splitter/__init__.py` — `Section` dataclass + orchestrator.
- `ai-service/app/splitter/toc.py` — TOC detector. Scans MD for a "Table of Contents" or "Contents" heading, parses subsequent numbered list with page-number patterns, builds the section spine.
- `ai-service/app/splitter/headings.py` — heading-based splitter. Splits MD on `^# ` / `^## ` / `^### `. Fallback when no TOC.
- `ai-service/app/splitter/semantic.py` — sliding-window chunker (~800 tokens, 100-token overlap) as final fallback.
- `ai-service/app/api/splitter_route.py` — `POST /split` endpoint accepting `{ markdownDocumentId, mode: 'auto' }` returning `{ sections: [{ id, heading, headingLevel, markdown, byteOffsetStart, byteOffsetEnd, wordCount, containsTable, containsImage, hasResumeSignals, hasSyllabusSignals }] }`.
- `ai-service/app/heuristics/document_signals.py` — detects "resume" / "CV" / "syllabus" patterns (Education, Work Experience, References, Course Number, Course Description headings).

**Steps:**
1. Implement TOC detector. Stevenson DOCX has a TOC — use as fixture.
2. Implement heading splitter.
3. Implement semantic chunker.
4. Composer: TOC if found → headings if not → semantic if neither.
5. Add heuristic flags for each section (table, image, resume-like, syllabus-like).
6. Expose API endpoint.

**Acceptance:**
- [ ] Given Stevenson MD, `POST /split` returns 80-150 sections, each with non-empty heading and markdown.
- [ ] TOC-detected sections match the document's actual TOC entries (manual spot-check on Stevenson).
- [ ] Splitter completes in under 30 seconds on a 350 MB-equivalent Markdown.
- [ ] Heuristic flags are accurate: a section containing "Education / Work History / References" gets `hasResumeSignals=true`.

**Test plan:**
- **Unit:** `ai-service/tests/test_toc.py` — synthetic MD with various TOC styles → all detected correctly. Edge: TOC inside a different section heading.
- **Unit:** `ai-service/tests/test_headings.py` — splits on heading boundaries; preserves children under deepest header; counts words/tables correctly.
- **Unit:** `ai-service/tests/test_signals.py` — known resume/CV text → `hasResumeSignals=true`; narrative text about curriculum → `false`.
- **System / integration:** `ai-service/tests/test_split_endpoint.py` — full request/response cycle with Stevenson fixture excerpt → expected section count + structure.
- **E2E:** part of S1.13.

**Estimate:** 2.5 days. **Blocks:** S1.5, S1.6. **Depends:** S1.3 (needs MD).

---

## S1.5 — Standards + specs embedding service

**Source:** Architecture decision 2026-05-16; [[legacy-self-study-import#cost-model]].

**Context:** The embedding cache that section→spec matcher relies on.

**Files (NEW):**
- `ai-service/app/embeddings/client.py` — embedding client using OpenAI `text-embedding-3-small` (1536-dim). Single adapter; abstraction stub exists for future provider swap if needed.
- `ai-service/app/embeddings/spec_cache.py` — at boot, queries CSHSE Mongo for active `Spec` document (specifically `Standards` collection in the existing system), builds embeddings for each `(standardCode, specCode, text)` triple, upserts into Qdrant collection `cshse_specs` with payload `{ standardCode, specCode, specText, specVersion }`. Idempotent (skips if already-indexed for the same `specVersion`).
- `ai-service/app/api/admin_route.py` — `POST /admin/rebuild-specs-index` (HMAC + admin role). Re-embeds and overwrites the Qdrant collection.
- `server/src/services/standardsLoader.ts` — confirm where standards text lives ([data/standards.ts](../../../../server/src/data/standards.ts) or in the `specs` Mongo collection). Expose via a service-to-service endpoint the Python side can read.

**Steps:**
1. ~~Choose embedding provider~~ **DECIDED 2026-05-16: OpenAI `text-embedding-3-small`** (1536-dim, org already has key).
2. Implement provider adapters with rate-limiting + retry/backoff.
3. Build `spec_cache.bootstrap()` that runs at app start. Reads spec text from CSHSE Mongo (read-only role from [[db-migration-strategy]]).
4. Upsert into Qdrant collection `cshse_specs` with payload metadata so we can filter by program level (associate/bachelors/masters) later.
5. Add admin rebuild endpoint for when standards are updated.

**Acceptance:**
- [ ] At service boot, `cshse_specs` Qdrant collection has ~200 points (21 standards × ~10 specs each).
- [ ] Each point has payload `{ standardCode, specCode, specText, specVersion, programLevel? }`.
- [ ] Re-running the bootstrap is a no-op if `specVersion` hasn't changed.
- [ ] Cost of one bootstrap is under $0.01.

**Test plan:**
- **Unit:** `ai-service/tests/test_embedding_client.py` — `embed_batch` returns the expected vector dimensionality; retries on 429.
- **Unit:** `ai-service/tests/test_spec_cache.py` — idempotency: second `bootstrap()` makes zero new API calls.
- **System / integration:** `ai-service/tests/test_qdrant_integration.py` — against a Qdrant Docker in CI: bootstrap + similarity query returns expected nearest neighbor.
- **E2E:** N/A.

**Estimate:** 1.5 days. **Blocks:** S1.6 (matcher), S1.8 (drift detector). **Depends:** S1.1.

---

## S1.6 — Section → spec matcher (the core AI step)

**Source:** Architecture decision 2026-05-16. The heart of the redesign.

**Context:** [[legacy-self-study-import#architecture-overview]].

**Files (NEW):**
- `ai-service/app/matcher/section_to_spec.py` — main matcher. For each `Section`:
  1. Embed the section's first ~2000 tokens (heading + body), call it `section_vector`.
  2. Qdrant `search` against `cshse_specs` with `top_k=5`, optional filter by `programLevel` from submission context.
  3. Construct Claude Haiku prompt: section text excerpt + 5 candidates + "select the best (standard, spec) and give confidence 0-1".
  4. Parse Claude's JSON response → `Recommendation { primaryStandard, primarySpec, primaryConfidence, alternates[], rationale }`.
- `ai-service/app/matcher/prompts.py` — versioned prompts (`SECTION_TO_SPEC_V1`). Prompt-caching enabled on the system prompt + spec definitions block per [[claude-api]].
- `ai-service/app/api/recommend_route.py` — `POST /recommend` accepts `{ importId, programLevel, sections: Section[] }`, returns `{ recommendations: Recommendation[], elapsedMs, costCents }`. Runs embeddings + matcher concurrently (asyncio).
- `server/src/services/aiServiceClient.ts` — NEW. Node-side HTTP client for the Python service. HMAC signs each request.

**Steps:**
1. Author the matcher prompt (versioned, cached).
2. Implement `recommend` endpoint with concurrency control (max 10 simultaneous Claude calls).
3. Implement Node client.
4. Add Anthropic prompt caching for the spec-definitions block (saves ~80% of input cost on repeat sections).
5. Cost reporting per import: tokens × $/M from Anthropic billing API.

**Acceptance:**
- [ ] Stevenson legacy import (100+ sections) returns recommendations in <90 seconds.
- [ ] Per-import cost is under $0.20.
- [ ] Primary recommendation accuracy is ≥80% on a hand-labeled 20-section sample of Stevenson (judged against the existing manually-tagged sections that already have known correct standardCode/specCode).
- [ ] Each recommendation includes a human-readable rationale (1-2 sentences).
- [ ] Prompt cache hits show in the response (≥50% cache hits after the first 20 sections).

**Test plan:**
- **Unit:** `ai-service/tests/test_matcher_prompts.py` — known section about "curriculum" → top-5 candidates include 11.a.
- **Unit:** `ai-service/tests/test_matcher_parse.py` — Claude output (real fixtures) parses cleanly; malformed JSON → graceful degraded response with no recommendation.
- **System / integration:** `ai-service/tests/test_recommend_endpoint.py` — using VCR cassettes of Claude responses, full request/response cycle.
- **System / integration:** `ai-service/tests/test_matcher_accuracy.py` — against 20 hand-labeled Stevenson sections, primary recommendation must match for ≥16/20.
- **E2E:** S1.13.

**Estimate:** 3 days. **Blocks:** S1.7, S1.10. **Depends:** S1.4 (sections), S1.5 (embeddings).

---

## S1.7 — Supporting-evidence classifier

**Source:** [[legacy-self-study-import#part-3-the-redesign-ai-augmented-import--tagging]]; user: "if there is a resume or CV in the text, this generally is supporting evidence."

**Context:** Layered on top of S1.6's recommendation; allows the wizard to route a section to `Submission.narratives[std][spec].supportingEvidenceText` instead of `.content`.

**Files (NEW):**
- `ai-service/app/classifier/evidence_type.py` — classify each section into a fixed taxonomy: `resume_cv`, `syllabus`, `course_catalog`, `faculty_handbook`, `assessment_rubric`, `accreditation_letter`, `narrative_response`, `appendix_other`, `unknown`. Uses S1.4's heuristic flags + a Claude Haiku call for ambiguous cases.
- `ai-service/app/api/classify_route.py` — `POST /classify-evidence` (called as part of `/recommend`, or standalone). Output: `{ evidenceType, isSupportingEvidence: boolean, confidence }`.

**Steps:**
1. Define taxonomy + heuristic gates (regex patterns + section-length thresholds for the obvious cases).
2. LLM fallback for ambiguous cases.
3. Surface classification in the `/recommend` response so the wizard can pre-select "Apply as supporting evidence" vs "Apply as narrative."

**Acceptance:**
- [ ] CVs / résumés are flagged `isSupportingEvidence=true` with confidence > 0.85 on a 10-fixture eval set.
- [ ] Narrative responses (paragraph-style) are flagged `isSupportingEvidence=false`.
- [ ] Unknown / ambiguous sections fall through cleanly without breaking the wizard.

**Test plan:**
- **Unit:** `ai-service/tests/test_evidence_heuristics.py` — known resume / syllabus / catalog fixtures → expected `evidenceType`.
- **System / integration:** `ai-service/tests/test_classify_endpoint.py` — end-to-end + heuristics + LLM fallback.
- **E2E:** S1.13.

**Estimate:** 1 day. **Depends:** S1.4, S1.6.

---

## S1.8 — Standards-drift detector (legacy tags vs. current spec)

**Source:** User: "the standard has been modified, and what is marked as a spec and sub spec may not be the spec and sub spec of the standard any more"; [[legacy-self-study-import#issue-5-standards-drift-old-self-studies-tagged-against-outdated-specs]].

**Context:** Legacy self-studies often have human-supplied tags against old spec text. The system needs to flag drift.

**Files (NEW):**
- `ai-service/app/drift/detector.py` — for a legacy section's `(standardCode, specCode, content)`:
  1. Embed the section's body.
  2. Compute cosine similarity to (a) the current spec text for that (standardCode, specCode), (b) all other current specs.
  3. If current-spec similarity is below threshold (0.55) AND another spec has substantially higher similarity (>0.7), surface as **drifted** → recommend the new spec.
- `ai-service/app/api/drift_route.py` — `POST /detect-drift` accepting legacy `IDetectedSection[]`, returns `{ drifted: [{ sectionId, originalTag, suggestedTag, confidence, deltaSimilarity }], confirmed: [...] }`.
- Wizard surfaces these in Step 4: "These existing tags appear to reference older spec text. Suggested current mappings: ..."

**Steps:**
1. Implement detector logic with configurable thresholds.
2. Add API endpoint.
3. Wire UI display in the wizard's drift-review pane.

**Acceptance:**
- [ ] Given a synthetic case (section about Curriculum tagged as 4.a but actually current 11.a), detector correctly flags as drifted with suggested tag 11.a.
- [ ] False-positive rate on a calibration set of 30 known-correct tags is below 10%.

**Test plan:**
- **Unit:** `ai-service/tests/test_drift_detector.py` — synthetic embedding fixtures → expected drift verdict.
- **System / integration:** `ai-service/tests/test_drift_endpoint.py` — full cycle.
- **E2E:** S1.13 if Stevenson has drifted tags; otherwise unit.

**Estimate:** 1.5 days. **Depends:** S1.5 (spec embeddings).

---

## S1.9 — Cross-institution semantic search (feature-flagged, board-approval gated)

**Source:** User direction 2026-05-16: "cross institution may require CSHSE board approval but I like that code it in, make it an option that can be disabled if the board says no."

**Context:** Once tags are applied, push the section's vector + payload into a Qdrant collection `cshse_narratives_xinst` keyed by `(submissionId, standardCode, specCode)`. Admin search UI returns similar narratives from OTHER institutions.

**Files (NEW):**
- `ai-service/app/cross_institution/indexer.py` — on `finish-tagging`, the Node service POSTs the finalized narratives to `POST /cross-institution/index`. Python service embeds and upserts into Qdrant `cshse_narratives_xinst` with payload `{ submissionId, institutionId, institutionName, standardCode, specCode, programLevel, finalizedAt, contentExcerpt }`.
- `ai-service/app/cross_institution/search.py` — `POST /cross-institution/search` accepts `{ query, programLevel?, excludeSubmissionId? }`, returns top-k similar narratives across institutions. **Hard-gated by `CROSS_INSTITUTION_SEARCH_ENABLED=true`** at startup; returns 503 with body `{ disabled: true, reason: 'pending CSHSE board approval' }` if disabled.
- `client/src/features/admin/Settings/SettingsPage.tsx` — admin toggle "Enable cross-institution semantic search" (default OFF). Persists to `WebhookSettings` (or new `FeatureFlag` collection).
- `client/src/features/admin/CrossInstitutionSearch.tsx` — NEW. Admin-only UI that calls the search endpoint. Hidden if flag is off.
- Documentation block in [[legacy-self-study-import]] explaining: how to opt in, who can see what, and the data-governance implications for the board's review.

**Steps:**
1. Build the indexer (called from Node on finish-tagging).
2. Build the search endpoint with the hard-gate.
3. Admin UI: toggle + search page.
4. Document: governance note for CSHSE board, including data-isolation guarantees ("vectors only, not full text; no PII; can be disabled instantly").

**Acceptance:**
- [ ] Default state: search returns 503 with a clear "feature disabled" message.
- [ ] Admin toggle turns it on; subsequent searches return results.
- [ ] Toggling off again immediately re-disables (no service restart needed).
- [ ] Index population happens on finish-tagging WITHOUT regard to the flag (data sits in Qdrant; the gate is on READS).
- [ ] When disabled, the admin search UI is hidden from the admin nav.

**Test plan:**
- **Unit:** `ai-service/tests/test_cross_institution_gate.py` — flag off → 503; flag on → 200.
- **System / integration:** `ai-service/tests/test_cross_institution_flow.py` — finish-tagging-equivalent POST → vector indexed → search returns it.
- **System / integration:** `client/src/features/admin/CrossInstitutionSearch.test.tsx` — feature flag off → component renders disabled message.
- **E2E:** S6.4 admin journey extended (in this plan: S7.4).

**Estimate:** 2 days. **Depends:** S1.5, S1.6.

---

## S1.10 — Linear wizard UI (the coordinator-facing experience)

**Source:** User direction 2026-05-16: "an import wizard that just about puts data in the right self study and supporting data section."

**Context:** Replaces the existing free-form tagging flow (or adds an "AI-assisted" alternate path that becomes default for new imports).

**Files (NEW):**
- `client/src/features/selfStudy/ImportWizard/ImportWizard.tsx` — orchestrator. 5 steps:
  1. **Upload** — file picker, drag-and-drop, shows estimated time / cost.
  2. **Parsing** — progress bar; auto-advances to step 3.
  3. **Review section splits** — accordion list of detected sections; user can merge/split/rename before AI tagging. (Optional skip-ahead button.)
  4. **Review tag recommendations** — per-section: heading, preview, primary tag with confidence bar, alternates, rationale. Buttons: ✓ Accept primary, ⟳ Choose alternate, ⊕ Custom, ⏭ Skip. Bulk: "Accept all with confidence > 0.85". Cross-cutting "Drift detected" pane (S1.8).
  5. **Apply & finish** — final summary; one click sends all accept-decisions to the existing `extract-section` + `insert-marker` pipeline; status flips to `completed`.
- `client/src/features/selfStudy/ImportWizard/WizardStep1Upload.tsx`, `…Step2Parsing.tsx`, `…Step3Splits.tsx`, `…Step4Recommendations.tsx`, `…Step5Apply.tsx` — one component per step.
- `client/src/features/selfStudy/ImportWizard/RecommendationCard.tsx` — the per-section accept/override card.
- `client/src/features/selfStudy/ImportWizard/wizardStore.ts` — Zustand store for wizard state (current step, decisions, AI recommendations).

**Steps:**
1. Build the 5 step components with placeholder content.
2. Wire each step to the corresponding server endpoint (upload, parse-status, split, recommend, apply).
3. Implement the recommendation card with accept / change / custom / skip.
4. Bulk-accept threshold slider in step 4.
5. "Save and exit" at any step → resumes wizard from same step on return (state stored on `SelfStudyImport.wizardState`).
6. Click section in Step 4 → opens DocumentViewer modal positioned at that section (resolves the click-to-navigate bug from [[#issue-4-click-on-tag-should-navigate-to-text-in-viewer]]).

**Acceptance:**
- [ ] Coordinator can complete the full Stevenson import in < 90 minutes (vs. days today).
- [ ] Each step has a clear "Back" and "Save & exit" affordance.
- [ ] Bulk-accept threshold slider updates the count of pre-selected recommendations live.
- [ ] Resume mid-wizard restores the user to the same step.
- [ ] Manual override is always available — coordinator can deviate from AI at any section.

**Test plan:**
- **Unit:** each step component renders with mock props; key interactions emit correct events.
- **System / integration:** `client/src/features/selfStudy/ImportWizard/ImportWizard.test.tsx` — MSW-mocked endpoints; full step-by-step flow ends with `/finish-tagging` POST.
- **E2E:** S1.13 (Stevenson E2E).

**Estimate:** 4 days. **Depends:** S1.6 (data flowing), S1.7 (evidence flag), S1.8 (drift display).

---

## S1.11 — Bidirectional click-to-navigate

**Source:** [[legacy-self-study-import#issue-4-click-on-tag-should-navigate-to-text-in-viewer]]. User-flagged bug.

**Context:** Independent of the AI work; a clean small story.

**Files:**
- `client/src/features/selfStudy/Editor/components/DocumentViewer.tsx` — placeholder div gets `onClick` that emits `onPlaceholderClick(sectionId)`. Add a parent-provided `scrollToSectionId` prop that, when changed, scrolls the matching placeholder into view + flashes.
- `client/src/features/selfStudy/Editor/components/TaggedSectionsList.tsx` — each row gets `onClick` that calls `onNavigateToPlaceholder(sectionId)` on the parent.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — connects the two: clicking a tag in the list scrolls DocumentViewer; clicking a placeholder in DocumentViewer highlights the list entry.

**Acceptance:**
- [ ] Click a tag in the sidebar → DocumentViewer scrolls + highlights for 1.5s.
- [ ] Click a placeholder in DocumentViewer → sidebar entry highlights + scrolls into view.
- [ ] Smooth-scroll behavior; respects `prefers-reduced-motion`.

**Test plan:**
- **Unit:** RTL: click sidebar row → expect callback fired with correct id.
- **System / integration:** integration test with both components mounted → bidirectional sync works.
- **E2E:** part of S1.13.

**Estimate:** 0.5 days. **Depends:** none.

---

## S1.12 — Marker bug fixes (TABLE_FRAG validation + step-1/step-2 atomicity)

**Source:** [[legacy-self-study-import#issue-3-missing-tags-data-loss]].

**Files:**
- `server/src/services/gridFsService.ts` — strengthen TABLE_FRAG pair validation at [line ~1303](../../../../server/src/services/gridFsService.ts): if `TABLE_FRAG_START` present but `TABLE_FRAG_END` missing (or vice-versa), explicit error + structured log; recover by falling back to bare EXTRACTED marker if found.
- `server/src/controllers/importController.ts` — wrap step-1 (extract-section) + step-2 (insert-marker) in a unit: if step-2 fails, mark the step-1 section record `markerInsertionFailed: true` and surface in the UI for retry. Don't let it silently orphan in `detectedSections[]`.
- `client/src/features/selfStudy/Editor/components/TaggedSectionsList.tsx` — show a "⚠️ Insertion failed — Retry" affordance for any section flagged `markerInsertionFailed`.

**Acceptance:**
- [ ] Forced step-2 failure in test produces a clearly-flagged section in the UI with a retry button, not an invisible orphan.
- [ ] Forced TABLE_FRAG end-tag corruption is caught with a clear error, not silent failure.

**Test plan:**
- **Unit:** `server/tests/unit/marker-pair-validation.test.ts` — bad inputs → expected explicit errors.
- **System / integration:** `server/tests/integration/marker-insert-failure-retry.test.ts` — simulate step-2 failure → section persists with flag → retry endpoint succeeds.
- **E2E:** part of S1.13.

**Estimate:** 1 day. **Depends:** none.

---

## S1.13 — Stevenson E2E + recommendation audit trail

**Source:** Sprint goal: "Stevenson legacy DOCX imported end-to-end in <2 hours instead of days."

**Files:**
- `e2e/tests/legacy-import-stevenson.spec.ts` — NEW Playwright spec. Uploads the actual Stevenson DOCX (or a 50MB excerpt for CI speed). Walks the wizard. Asserts:
  - Section count between expected range (≥80).
  - At least 70% of recommendations have confidence > 0.7.
  - Bulk-accept reduces unreviewed sections by ≥80%.
  - Final `Submission.narratives` has populated entries for every accepted recommendation.
- `server/src/models/RecommendationAudit.ts` — NEW. `{ importId, sectionId, recommended: { standardCode, specCode, confidence, isSupportingEvidence }, accepted: boolean, finalDecision: { standardCode, specCode, source: 'ai_accepted' | 'manual_override' | 'skipped' }, userId, decidedAt }`. Audit every decision for accuracy tracking.
- `client/src/features/admin/AIAccuracyReport.tsx` — NEW. Admin page: aggregate stats — accept rate, top-tag accuracy by standard, drift between confidence and acceptance. Drives model evaluation over time.

**Acceptance:**
- [ ] E2E completes within 4 minutes on CI.
- [ ] At least one accept, one override, one skip exercised in the spec.
- [ ] Every wizard decision creates a `RecommendationAudit` row.
- [ ] Admin AIAccuracyReport shows non-empty stats after the E2E runs.

**Test plan:**
- **Unit:** RecommendationAudit model — schema validates.
- **System / integration:** wizard decisions → audit rows correctly created.
- **E2E:** the Stevenson run itself.

**Estimate:** 2 days. **Depends:** S1.10, S1.6, S1.7, S1.11, S1.12.

---

## Sprint 1 wrap-up summary

| # | Story | Estimate (d) | Track | Depends on |
|---|---|---|---|---|
| S1.1 | Python AI service scaffolding + Railway deploy | 1.5 | Python | — |
| S1.2 | Document storage with versioning (S3 + version metadata) | 2.0 | Node | — |
| S1.3 | HTML + Markdown parser improvements | 2.0 | Node + Python | S1.1 |
| S1.4 | TOC + heading section splitter | 2.5 | Python | S1.3 |
| S1.5 | Standards + specs embedding service | 1.5 | Python | S1.1 |
| S1.6 | Section→spec matcher | 3.0 | Python | S1.4, S1.5 |
| S1.7 | Supporting-evidence classifier | 1.0 | Python | S1.4, S1.6 |
| S1.8 | Standards-drift detector | 1.5 | Python | S1.5 |
| S1.9 | Cross-institution search (gated) | 2.0 | Python + Node | S1.5, S1.6 |
| S1.10 | Linear wizard UI | 4.0 | Node UI | S1.6, S1.7, S1.8 |
| S1.11 | Click-to-navigate bidirectional | 0.5 | Node UI | — |
| S1.12 | Marker bug fixes | 1.0 | Node | — |
| S1.13 | Stevenson E2E + audit trail | 2.0 | Node + Python | S1.10, S1.6, S1.7, S1.11, S1.12 |
| **Total** | | **24.5** | | |

**Parallelisation:**
- Engineer A (Node track): S1.2 → S1.3 (Node side) → S1.11 → S1.12 → S1.10 (wizard UI) — ~10 days.
- Engineer B (Python track): S1.1 → S1.3 (Python side) → S1.4 → S1.5 → S1.6 → S1.7 → S1.8 → S1.9 — ~14 days.
- Both converge on S1.13 (E2E) — 2 days both engineers.
- **Realistic ship date** with two engineers: ~14 working days = sprint horizon with a slight overflow that S1.7 (1d) or S1.9 (2d, board-flag-protected) can spill into Sprint 2 without affecting the wizard launch.

---

# SPRINT 2 — Compliance & Critical Security + Document Versioning (was Sprint 1)

**Status:** unchanged from old plan except for the addition of S2.11 (document versioning) per user direction 2026-05-16. All other stories carry over verbatim from [[sprint-plan-2026-05-11#sprint-1]] with `S1.x → S2.x` renumber.

Full per-story specs in [[sprint-plan-2026-05-11#sprint-1]]. Renumber:

| New ID | Title | Old ID |
|---|---|---|
| S2.1 | Reader-identity redaction in comments | S1.1 |
| S2.2 | Superuser impersonation audit log | S1.2 |
| S2.3 | URL accessibility probe + password-protected-link detection | S1.3 |
| S2.4 | PDF preference enforcement on upload (soft-block) | S1.4 |
| S2.5 | Rotate the leaked n8n API key + add secret-scanning | S1.5 |
| S2.6 | Refuse to boot in production without JWT_SECRET | S1.6 |
| S2.7 | HMAC-sign webhook callbacks + reject duplicate executionId | S1.7 |
| S2.8 | CORS allow-list + helmet defaults | S1.8 |
| S2.9 | Help-chat session binding | S1.9 |
| S2.10 | Fix isS3Configured() export | S1.10 |
| **S2.11** | **Document versioning (NEW — user direction 2026-05-16)** | — |

### S2.11 — Document versioning for imported + exported docs

**Source:** User direction 2026-05-16. Foundational for institutional records-keeping across years.

**Note:** This is the SAME story as Sprint 1's S1.2 above. Repeated here because user said "add this into sprint 2 or 3" — putting the canonical spec in Sprint 1 (where it actually executes, alongside the AI import work) and a reference here. If you want it explicitly in this sprint instead, the foundational model + service stories move to Sprint 2 and the import-side wiring stays in Sprint 1.

**Cross-sprint coordination:** S1.2 already builds the `DocumentVersion` model, service, and import-side wiring. S5.10 (reader-report DOCX, old S4.10) then *uses* it. So S2.11 is a no-op IF S1.2 ships first — which it should, since Sprint 1 is the new priority.

---

# SPRINT 3 — Auth Hardening + Input Validation + Multi-PC (was Sprint 2)

Unchanged from [[sprint-plan-2026-05-11#sprint-2]]. Renumber `S2.x → S3.x`. The S2.10 → S3.10 (Multi-PC) story is the **breaking change** that needs expand-contract per [[db-migration-strategy]].

---

# SPRINT 4 — Evidence AI Review + Emails + Reader Deadlines (was Sprint 3)

Unchanged from [[sprint-plan-2026-05-11#sprint-3]]. Renumber `S3.x → S4.x`.

---

# SPRINT 5 — Evidence Review UI + Matrix + Reader DOCX (was Sprint 4)

Unchanged from [[sprint-plan-2026-05-11#sprint-4]]. Renumber `S4.x → S5.x`. **S5.10 (reader-report DOCX, was S4.10) depends on S1.2** (document versioning) — already wired in this plan.

---

# SPRINT 6 — Common-Error Checks + Completion Checklist + Tests (was Sprint 5)

Unchanged from [[sprint-plan-2026-05-11#sprint-5]]. Renumber `S5.x → S6.x`.

---

# SPRINT 7 — Board Decisions, Cycle Scheduler, E2E, Polish (was Sprint 6)

Unchanged from [[sprint-plan-2026-05-11#sprint-6]]. Renumber `S6.x → S7.x`.

---

# SPRINT 8 — Joint Ventures (was Sprint 7)

Unchanged from [[sprint-plan-2026-05-11#sprint-7]]. Renumber `S7.x → S8.x`.

---

## What needs to happen before Sprint 1 starts

1. **Anthropic API key** — reused from n8n credentials (decision 2026-05-16: "use what we have and I will make changes later"). Plumb via `mcp__n8n-mcp-bearer__n8n_manage_credentials` → set as Railway shared variable `ANTHROPIC_API_KEY` on the `cshse-ai` service. Rotation deferred.
2. **OpenAI API key** — same plumbing; reused from n8n credentials. Set as `OPENAI_API_KEY` on `cshse-ai`.
3. ~~Dev Qdrant deploy fix~~ — **NOT NEEDED.** Decision 2026-05-16: dev's Qdrant instance is sleeping; prod's instance is shared by both envs via collection-namespace isolation (`cshse_sections_prod` vs. `cshse_sections_dev`). Saves operating cost and simplifies the rebuild-specs-index flow (one source of truth for spec embeddings).
4. **Engineering staffing** — two engineers for 2 weeks if we want full Sprint 1 scope. One engineer = scope cut (drop S1.9 cross-institution, defer S1.7 to Sprint 2; lands core wizard in ~3 weeks with one).
5. **Renumber pass** — mechanical sed/perl pass on [[sprint-plan-2026-05-11]] applying `S{n}.x → S{n+1}.x` and `Sprint {n} → Sprint {n+1}` for n=2..7 (reverse-order to avoid double-shifts). Not yet executed; do it in a separate PR once this plan is approved.

## Related

- [[legacy-self-study-import]] — full analysis of the current import flow + redesign architecture.
- [[railway-deployment-topology]] — production / develop env structure + Qdrant.
- [[db-migration-strategy]] — expand-contract pattern Sprint 1 follows for `SelfStudyImport` schema additions.
- [[sprint-plan-2026-05-11]] — superseded plan; still the authoritative source for Sprints 2-8 per-story detail.
- [[product-requirements]] — overall product north star.
