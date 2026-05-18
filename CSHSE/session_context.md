# Session Context — 2026-05-17 (handoff)

## Status

**Branch:** `feature/ai-import-wizard` (working dir `/Users/ericbeser/Documents/GitHub/AIScripts`)

**Working tree:** clean for AI service + CSHSE subtree. Recent commits on this branch:

```
79dc554 Matrix data extractor: decode filled cells into (std, spec, col, code)
bf62ef4 All CSHSE templates committed + matrix template tests
0f46979 Curriculum matrix template loader + commit 3 template DOCX/PDFs
0e15718 Sprint 1 end-to-end: appendix walker + DOCX export + coverage review
55a5ce4 Appendix walker + lock-in wizard data destinations
b38798c TOC anchor walker — extract sections by document's own TOC anchors
```

Untracked: `CSHSE/Engineering/import-wizard-ui-spec-2026-05-17.md`, this file. `CSHSE/Engineering/index.md` and `log.md` are modified (new spec linked + logged).

## What was finished this session

### 1. Matrix data extractor — DONE
- **File:** `ai-service/app/matrix/data_extractor.py`
- **Tests:** `ai-service/tests/test_matrix_data_extractor.py` — 6/6 pass
- **All matrix tests:** 12/12 pass
- Anchor-driven walk of `#MatrixHSR` / `#Matrix2`, template-row matching (substring + Jaccard token overlap, threshold 0.3), decodes ITKS+LMH cell codes into `content_types` + `depth`.
- **On Stevenson:** 191 rows seen → 150 matched → **370 cells extracted** across Stds 11–20.
- Pre-filter for candidate tables was loosened to `cols >= 4, rows >= 3` (was 8/6) so the synthetic fixture test passes — real precision comes from anchor + template match + cell regex.

### 2. AI Import Wizard UI spec — DONE (awaits user sign-off)
- **File:** `CSHSE/CSHSE/Engineering/import-wizard-ui-spec-2026-05-17.md`
- Linked from `CSHSE/Engineering/index.md`, logged in `log.md`.
- Sign-off gate before any React code lands.

Covers:
- Tab placement: new `AI Import` tab under Self-Study Editor (alongside Standards / Curriculum Matrix / Supporting File Library); the existing `Import Document` button activates it.
- Five linear steps: **Upload → Parse → Review → Matrix → Apply**
- **Auto-apply rules**:
  - text < 1000 words, conf ≥ 0.85, single-spec → `narratives[std][spec].content`
  - text ≥ 1000 words, conf ≥ 0.85 → `narratives[std][spec].supportingEvidenceText`
  - appendix file-shaped item, conf ≥ 0.70 → `SupportingEvidence` row + S3 DOCX + `linkedDocuments`
  - matrix cell with template match → `CurriculumMatrix.cells[]` (after Step 4 course-column confirmation)
  - conf < 0.50 → import tag list
- Three-column Review screen: left rail specs, middle item table (Conf/Kind columns), right preview with AI reasoning + action chooser
- Matrix review screen: column → course dropdown mapping
- Apply: per-spec diff modal + atomic Mongo session
- Tag list w/ click-to-popup: full text, AI reasoning, kind selector, std/spec dropdowns, Apply/Skip/Previous

Five **open questions** flagged inline for user decision:
1. Re-import diff merge UX (all-or-nothing vs. per-spec)
2. Tag-list lifetime (auto-prune vs. explicit-only)
3. Cross-institution semantic search visibility (hide for v1?)
4. Matrix course catalog modelling (structured collection vs. free-text)
5. Confidence-threshold calibration

## What's next

### User will provide corrections on the AI read
User said: *"I have some corrections to make on the AI read."* They will review the Stevenson by-spec/coverage outputs and the matrix extraction and feed back changes needed in the AI pipeline before any wizard UI is built.

Likely areas they will critique:
- Specific (std, spec) misplacements in [[ai-import-stevenson-by-spec-2026-05-17]]
- Spec gaps in [[ai-import-stevenson-coverage-2026-05-17]] that shouldn't be gaps
- Matrix rows where template alignment ran out of letters (some `spec_code=?`)
- Confidence thresholds and what gets auto-applied vs. tagged
- The 0.85 / 0.70 / 0.50 cutoffs in the UI spec

### After corrections land in the AI side, then sign off on the UI spec, then code the wizard.

Pending todo list:
1. ✅ Matrix data extractor
2. ✅ Commit matrix data extractor + tests
3. ✅ Full wizard UI spec in Obsidian
4. ⏸ **User review of UI spec + AI corrections** ← we are here
5. ⏳ Build wizard UI per approved spec; end-to-end test on Stevenson

## Key file paths

**AI service (Python):**
- `ai-service/app/matrix/data_extractor.py` — NEW, just committed
- `ai-service/app/matrix/template_loader.py` — 3 program-level templates
- `ai-service/app/splitter/toc_anchor_walker.py` — TOC anchor walk
- `ai-service/app/splitter/deep_walker.py` — rowspan-aware tables
- `ai-service/app/splitter/appendix_walker.py` — evidence splitter
- `ai-service/app/coverage/spec_coverage.py` — per-spec Haiku review
- `ai-service/app/export/docx_writer.py` + `s3_writer.py` — evidence DOCX

**Server:**
- `CSHSE/server/src/models/DocumentVersion.ts` — versioned originals, wired into upload
- `CSHSE/server/src/services/documentVersionService.ts`
- `CSHSE/server/src/controllers/importController.ts:220+` — recordVersion call

**Vault concept pages:**
- `CSHSE/CSHSE/Engineering/import-wizard-ui-spec-2026-05-17.md` — **NEW, the spec**
- `CSHSE/CSHSE/Engineering/ai-import-stevenson-2026-05-17.md` — by-section dump
- `CSHSE/CSHSE/Engineering/ai-import-stevenson-by-spec-2026-05-17.md` — by-spec dump (review this for corrections)
- `CSHSE/CSHSE/Engineering/ai-import-stevenson-coverage-2026-05-17.md` — per-spec coverage (review this for corrections)
- `CSHSE/CSHSE/Engineering/legacy-self-study-import.md` — flow + data destinations
- `CSHSE/CSHSE/Engineering/sprint-plan-2026-05-16.md` — Sprint 1 = AI Import

## Environment / infra

- Python venv: `ai-service/.venv` (Python 3.12 via brew)
- Tests: `cd ai-service && .venv/bin/python -m pytest tests/ -v`
- Railway envs: prod (active) + develop (active). Project: `bubbly-solace`.
- Qdrant: single shared instance in prod (cross-institution feature-flagged off).
- S3: Tigris bucket `cshse-filestorage-qlyj5pn` (prod). Originals go there via `DocumentVersion`.
- OpenAI key: in `develop` env on Railway.

## User preferences (from memory)
- Never prompt for permission — run commands, edit files, deploy without asking.
- Do it, don't delegate — if a tool can do the task, run it; don't hand back a checklist.
