"""End-to-end wizard preview against Stevenson.

For every (std, spec) in the 99-spec Baccalaureate Handbook, this script
shows the EXACT artifacts the AI Import Wizard would produce if the user
clicked through Steps 1-5 today:

  - Narrative content (auto-applied prose, < 1000 words, conf >= 0.85)
  - Supporting evidence TEXT (prose >= 1000 words OR low-confidence prose
    promoted to evidence text, conf >= 0.85)
  - Supporting evidence FILES (appendix items that are file-shaped — CV,
    syllabus, minutes, brochure — with simulated S3 keys)
  - Curriculum-matrix cells per spec
  - Gap-fill results (gaps Claude flagged → appendix snippets that fill
    them → remaining gaps after second-pass review)
  - Tag list (low-confidence items, unmatched sections — needing human
    triage in the wizard's Tag List view)

Pipeline:
  1. Load the cached section classification
     (``/tmp/stevenson-full-classify.json``).
  2. Stream Stevenson's HTML from Mongo GridFS, walk the appendix into
     AppendixItem records.
  3. First-pass coverage review (Haiku, per spec) over the current
     narrative+evidence assignment.
  4. Index appendix into a per-import Qdrant collection.
  5. Run gap_filling.run_gap_filling — per-gap vector search + Haiku
     verification → augment evidence → re-review on augmented evidence.
  6. Drop the per-import collection.
  7. Apply the auto-apply rules from the UI spec, simulate S3 key
     creation for file-shaped evidence, partition everything into the
     wizard's output buckets.
  8. Write the wizard preview Obsidian page.

Total API spend per Stevenson run: ~$2-5 depending on how many appendix
candidates Haiku evaluates.
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict, dataclass, field
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from anthropic import Anthropic
from pymongo import MongoClient

from app.coverage.spec_coverage import CoverageReview, CoverageReviewer
from app.embeddings.openai_client import EmbeddingClient
from app.gap_filling import (
    drop_appendix_collection,
    gapfill_collection_name,
    index_appendix,
    run_gap_filling,
    SpecGapFillResult,
)
from app.gap_filling.gap_searcher import GapFill
from app.splitter.appendix_walker import AppendixItem, walk_appendix
from app.standards.loader import Specification, load_specifications
from app.vector.qdrant_ops import VectorStore

VAULT_DIR = Path(
    "/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/CSHSE/Engineering"
)

# Auto-apply thresholds, locked in import-wizard-ui-spec-2026-05-17.md.
TEXT_NARRATIVE_WORD_LIMIT = 1000
TEXT_AUTO_APPLY_CONF = 0.85
FILE_AUTO_APPLY_CONF = 0.70
TAG_LIST_CONF = 0.50


# --------------------------------------------------------------------- helpers


def _slugify(s: str, max_len: int = 60) -> str:
    s = re.sub(r"[^a-zA-Z0-9-]+", "-", s.strip().lower()).strip("-")
    return (s or "untitled")[:max_len]


def _stream_gridfs_html(db, filename: str) -> bytes:
    """Read an entire GridFS file. Stevenson is ~370 MB; allocates ~2x in memory."""
    fs_files = db["htmlContent.files"]
    fs_chunks = db["htmlContent.chunks"]
    file_doc = fs_files.find_one({"filename": filename})
    if not file_doc:
        raise RuntimeError(f"htmlContent file not found: {filename}")
    print(f"   → file id: {file_doc['_id']}, length: {file_doc.get('length', 0)/1024/1024:.1f} MB")
    buf = io.BytesIO()
    for chunk in fs_chunks.find({"files_id": file_doc["_id"]}).sort("n", 1):
        buf.write(chunk["data"])
    return buf.getvalue()


# --------------------------------------------------------------------- types


@dataclass
class AppliedNarrative:
    section_id: str
    heading: str
    snippet: str
    word_count: int
    confidence: float
    accept_state: str
    rationale: str


@dataclass
class AppliedEvidenceText:
    section_id: str
    heading: str
    snippet: str
    word_count: int
    confidence: float
    accept_state: str
    source: str  # "primary_classification" | "gap_fill" | "promoted_from_prose"
    gap_filled: str | None = None  # original gap text if source==gap_fill


@dataclass
class AppliedEvidenceFile:
    section_id: str
    file_title: str
    s3_key: str
    slug: str
    word_count: int
    confidence: float
    body: str
    source: str  # "primary_classification" | "gap_fill"
    gap_filled: str | None = None


@dataclass
class AppliedMatrixCell:
    matrix: str
    column_index: int
    code_raw: str
    content_types: list[str]
    depth: str | None


@dataclass
class TagListEntry:
    tag_id: str
    section_id: str
    summary: str
    full_text: str
    suggested_std: str | None
    suggested_spec: str | None
    confidence: float
    source_anchor: str
    accept_state: str
    rationale: str


@dataclass
class SpecBucket:
    """All wizard-destined artifacts for one (std, spec)."""
    standard_code: str
    spec_code: str
    standard_title: str
    spec_prompt: str

    narratives: list[AppliedNarrative] = field(default_factory=list)
    evidence_text: list[AppliedEvidenceText] = field(default_factory=list)
    evidence_files: list[AppliedEvidenceFile] = field(default_factory=list)
    matrix_cells: list[AppliedMatrixCell] = field(default_factory=list)

    initial_review: CoverageReview | None = None
    final_review: CoverageReview | None = None
    accepted_fills: list[GapFill] = field(default_factory=list)
    rejected_fills_total: int = 0

    @property
    def remaining_gaps(self) -> list[str]:
        rv = self.final_review or self.initial_review
        return rv.gaps if rv else []


# --------------------------------------------------------------------- pipeline


def _classify_appendix_item_shape(item: AppendixItem) -> str:
    """Use the same heuristic as the wizard's auto-apply rules:
    file-shaped if the body has resume/syllabus signals or is long; else
    'text-shaped' (gets promoted to supportingEvidenceText)."""
    body = item.body_text
    words = len(body.split())
    title_lower = item.item_title.lower()
    if (
        "cv" in title_lower
        or "resume" in title_lower
        or "syllabus" in title_lower
        or "minutes" in title_lower
        or "letter" in title_lower
        or "brochure" in title_lower
        or "handbook" in title_lower
        or "schedule" in title_lower
        or words >= 250
    ):
        return "file"
    return "text"


def _build_s3_key(submission_id: str, doc_version_id: str, slug: str) -> str:
    """Same shape as cshse-filestorage S3 keys: {institutionId}/{versionId}/{slug}.docx."""
    return f"{submission_id}/{doc_version_id}/{slug}.docx"


def _allocate_to_buckets(
    *,
    classify_rows: list[dict],
    spec_index: dict[tuple[str, str], Specification],
    appendix_items: list[AppendixItem],
    submission_id: str,
    doc_version_id: str,
) -> tuple[
    dict[tuple[str, str], SpecBucket],
    list[TagListEntry],
    list[dict],  # context_sections
    list[dict],  # unknown_sections
]:
    """Partition classify rows + appendix items by auto-apply rules.

    Returns:
      buckets: keyed by (std, spec) — SpecBucket with narratives, evidence,
        files, matrix populated from PRIMARY CLASSIFICATION ONLY (no
        gap-fill yet — that's layered on later).
      tags: TagListEntry list (rule: section_type=='unknown', or conf <
        TAG_LIST_CONF, or confidence 0.50-0.84 demoted by user — for the
        preview we keep only the strictly low-confidence ones).
      context_sections, unknown_sections: skipped buckets we keep for
        the report.
    """
    buckets: dict[tuple[str, str], SpecBucket] = {}
    for (std, sp), spec in spec_index.items():
        buckets[(std, sp)] = SpecBucket(
            standard_code=std,
            spec_code=sp,
            standard_title=spec.standard_title,
            spec_prompt=spec.spec_text,
        )

    tags: list[TagListEntry] = []
    context_sections: list[dict] = []
    unknown_sections: list[dict] = []

    for r in classify_rows:
        std = r.get("primary_standard")
        spec = r.get("primary_spec")
        section_type = r.get("section_type")
        conf = float(r.get("primary_confidence") or 0.0)
        word_count = int(r.get("wordCount") or 0)
        accept_state = r.get("accept_state") or "review_unknown"
        snippet = r.get("snippet") or ""
        heading = r.get("heading") or "(no heading)"
        section_id = r.get("section_id") or ""
        rationale = r.get("rationale") or ""

        # Context / unknown — never auto-apply; context skipped entirely;
        # unknown → tag list.
        if section_type == "context":
            context_sections.append(r)
            continue
        if section_type == "unknown" or not std or not spec:
            unknown_sections.append(r)
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=section_id,
                    summary=heading[:120],
                    full_text=snippet,
                    suggested_std=std,
                    suggested_spec=spec,
                    confidence=conf,
                    source_anchor=heading[:120],
                    accept_state=accept_state,
                    rationale=rationale,
                )
            )
            continue

        # Below tag threshold → tag list.
        if conf < TAG_LIST_CONF:
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=section_id,
                    summary=heading[:120],
                    full_text=snippet,
                    suggested_std=std,
                    suggested_spec=spec,
                    confidence=conf,
                    source_anchor=heading[:120],
                    accept_state=accept_state,
                    rationale=rationale,
                )
            )
            continue

        key = (std, spec)
        if key not in buckets:
            # Recommended spec isn't in the loaded handbook — fall back
            # to tag list rather than silently drop.
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=section_id,
                    summary=heading[:120],
                    full_text=snippet,
                    suggested_std=std,
                    suggested_spec=spec,
                    confidence=conf,
                    source_anchor=heading[:120],
                    accept_state=accept_state,
                    rationale=rationale,
                )
            )
            continue

        bucket = buckets[key]

        # Curriculum matrix — special case. We don't have per-cell data
        # here (that's in the matrix data_extractor output); for the
        # preview we record a single placeholder "matrix detected here"
        # entry. The matrix-cell exporter is run separately by the
        # wizard's Step 4.
        if section_type == "curriculum_matrix":
            bucket.matrix_cells.append(
                AppliedMatrixCell(
                    matrix=heading[:80],
                    column_index=-1,
                    code_raw="(see matrix extractor)",
                    content_types=[],
                    depth=None,
                )
            )
            continue

        if section_type == "narrative_response":
            if conf >= TEXT_AUTO_APPLY_CONF and word_count < TEXT_NARRATIVE_WORD_LIMIT:
                bucket.narratives.append(
                    AppliedNarrative(
                        section_id=section_id,
                        heading=heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=accept_state,
                        rationale=rationale,
                    )
                )
            elif conf >= TEXT_AUTO_APPLY_CONF:
                # Long prose → supportingEvidenceText
                bucket.evidence_text.append(
                    AppliedEvidenceText(
                        section_id=section_id,
                        heading=heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=accept_state,
                        source="promoted_from_prose",
                    )
                )
            else:
                # conf 0.50-0.84 yellow — UI spec says auto-apply but
                # flagged for the user. We still place into narrative for
                # the preview but mark accept_state.
                bucket.narratives.append(
                    AppliedNarrative(
                        section_id=section_id,
                        heading=heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=accept_state,
                        rationale=rationale,
                    )
                )

        elif section_type == "supporting_evidence":
            # Decide if this is a file-shape (long, looks like a CV /
            # syllabus / minutes) vs text-shape.
            looks_file = (
                word_count >= 250
                or any(
                    kw in heading.lower()
                    for kw in (
                        "cv",
                        "syllabus",
                        "minutes",
                        "letter",
                        "brochure",
                        "handbook",
                        "schedule",
                    )
                )
            )
            if looks_file and conf >= FILE_AUTO_APPLY_CONF:
                slug = _slugify(heading)
                s3_key = _build_s3_key(submission_id, doc_version_id, slug)
                bucket.evidence_files.append(
                    AppliedEvidenceFile(
                        section_id=section_id,
                        file_title=heading[:120],
                        s3_key=s3_key,
                        slug=slug,
                        word_count=word_count,
                        confidence=conf,
                        body=snippet,
                        source="primary_classification",
                    )
                )
            elif conf >= TEXT_AUTO_APPLY_CONF:
                bucket.evidence_text.append(
                    AppliedEvidenceText(
                        section_id=section_id,
                        heading=heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=accept_state,
                        source="primary_classification",
                    )
                )
            else:
                # Yellow band — keep as evidence_text with the yellow flag
                bucket.evidence_text.append(
                    AppliedEvidenceText(
                        section_id=section_id,
                        heading=heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=accept_state,
                        source="primary_classification",
                    )
                )

    return buckets, tags, context_sections, unknown_sections


def _apply_gap_fills(
    buckets: dict[tuple[str, str], SpecBucket],
    gap_results: list[SpecGapFillResult],
    appendix_items_by_index: dict[int, AppendixItem],
    submission_id: str,
    doc_version_id: str,
) -> None:
    """Layer gap-fill results onto the primary buckets in-place.

    Each accepted fill becomes either an evidence_text entry (if Haiku
    classified narrative_text) or an evidence_file entry with a simulated
    S3 key (if classification was evidence_file).
    """
    for gr in gap_results:
        key = (gr.standard_code, gr.spec_code)
        bucket = buckets.get(key)
        if bucket is None:
            continue
        bucket.initial_review = gr.initial_review
        bucket.final_review = gr.final_review
        bucket.rejected_fills_total = sum(len(o.rejected) for o in gr.outcomes)
        for fill in gr.accepted_fills:
            bucket.accepted_fills.append(fill)
            item = appendix_items_by_index.get(fill.candidate.item_index)
            body = item.body_text if item else fill.candidate.body_text
            heading = item.item_title if item else fill.candidate.item_title
            cls = fill.verification.classification
            word_count = len(body.split())
            if cls == "evidence_file":
                slug = _slugify(heading)
                s3_key = _build_s3_key(submission_id, doc_version_id, slug)
                bucket.evidence_files.append(
                    AppliedEvidenceFile(
                        section_id=f"appendix:{fill.candidate.item_index}",
                        file_title=heading[:120],
                        s3_key=s3_key,
                        slug=slug,
                        word_count=word_count,
                        confidence=fill.verification.confidence,
                        body=body,
                        source="gap_fill",
                        gap_filled=fill.gap_text,
                    )
                )
            else:
                bucket.evidence_text.append(
                    AppliedEvidenceText(
                        section_id=f"appendix:{fill.candidate.item_index}",
                        heading=heading,
                        snippet=body,
                        word_count=word_count,
                        confidence=fill.verification.confidence,
                        accept_state="auto_accept",
                        source="gap_fill",
                        gap_filled=fill.gap_text,
                    )
                )


# --------------------------------------------------------------------- render


def _render_obsidian(
    *,
    buckets: dict[tuple[str, str], SpecBucket],
    tags: list[TagListEntry],
    appendix_items: list[AppendixItem],
    context_sections: list[dict],
    unknown_sections: list[dict],
    classify_rows: list[dict],
    date_str: str,
    submission_id: str,
    doc_version_id: str,
) -> str:
    L: list[str] = []
    out = L.append

    n_specs = len(buckets)
    n_with_narr = sum(1 for b in buckets.values() if b.narratives)
    n_with_evtext = sum(1 for b in buckets.values() if b.evidence_text)
    n_with_files = sum(1 for b in buckets.values() if b.evidence_files)
    n_with_anything = sum(
        1 for b in buckets.values()
        if b.narratives or b.evidence_text or b.evidence_files
    )
    n_gaps_remaining = sum(len(b.remaining_gaps) for b in buckets.values())
    n_files_total = sum(len(b.evidence_files) for b in buckets.values())
    n_fills_accepted = sum(len(b.accepted_fills) for b in buckets.values())
    n_fills_rejected = sum(b.rejected_fills_total for b in buckets.values())
    n_initial_gaps = sum(
        len(b.initial_review.gaps) for b in buckets.values() if b.initial_review
    )

    out("---")
    out(f"name: AI Import Wizard — Stevenson End-to-End Preview {date_str}")
    out(
        "description: For every Baccalaureate spec, the exact narratives, "
        "supporting-evidence text snippets, file uploads, matrix detections, "
        "tag-list entries, and remaining gaps that the wizard would produce on "
        "Stevenson — i.e. the wizard's full output before the user clicks "
        "Apply."
    )
    out("type: review")
    out("tags: [ai-import, sprint-1, stevenson, wizard-preview, audit]")
    out(f"audit_date: {date_str}")
    out("auditor: claude")
    out(f"last_reviewed: {date_str}")
    out("---")
    out("")
    out(f"# AI Import Wizard — Stevenson End-to-End Preview ({date_str})")
    out("")
    out(
        "This page is the **complete output the AI Import Wizard would "
        "produce on Stevenson** if a Program Coordinator ran the import "
        "today. For every (std, spec) we show the artifacts that would land "
        "in each destination, plus tags, unmatched sections, and gaps that "
        "remain after the appendix gap-filling pass."
    )
    out("")
    out("Pipeline that produced this:")
    out("")
    out("1. Section classifier (deep walker + matcher) — 568 sections, cached")
    out("2. Appendix walker — split appendix into supporting-evidence items")
    out("3. First-pass coverage review (Haiku, per spec)")
    out(
        "4. **Appendix gap-fill** — embed appendix into per-import Qdrant "
        "collection, search for snippets that address each shortcoming, "
        "verify with Haiku, augment evidence"
    )
    out("5. Second-pass coverage review on augmented evidence")
    out("6. Auto-apply rules from [[import-wizard-ui-spec-2026-05-17]]")
    out("")

    out("## Top-level summary")
    out("")
    out(f"- Specs in Handbook (Baccalaureate): **{n_specs}**")
    out(f"- Specs with at least one wizard write: **{n_with_anything}**")
    out(f"- Specs with narrative content: **{n_with_narr}**")
    out(f"- Specs with supporting-evidence text: **{n_with_evtext}**")
    out(f"- Specs with supporting-evidence files: **{n_with_files}**")
    out(f"- Total evidence files (with simulated S3 keys): **{n_files_total}**")
    out(f"- Tag list (user must triage in wizard's Tag List view): **{len(tags)}**")
    out(f"- Sections skipped as `context`: **{len(context_sections)}**")
    out(f"- Sections sent to `unknown` bucket: **{len(unknown_sections)}**")
    out(f"- Appendix items indexed for gap-fill: **{len(appendix_items)}**")
    out(f"- Initial gaps flagged by coverage reviewer: **{n_initial_gaps}**")
    out(f"- Gaps filled from appendix (verified by Haiku): **{n_fills_accepted}**")
    out(f"- Appendix candidates rejected by Haiku verifier: **{n_fills_rejected}**")
    out(f"- Gaps still remaining after gap-fill: **{n_gaps_remaining}**")
    out("")

    out("## Simulated import identity")
    out("")
    out(f"- `submissionId`: `{submission_id}`")
    out(f"- `documentVersionId`: `{doc_version_id}`")
    out(
        "- S3 bucket: `cshse-filestorage-qlyj5pn` (Tigris). Files below use "
        "key pattern `{submissionId}/{documentVersionId}/{slug}.docx`. Files "
        "are NOT actually uploaded by this preview; the wizard creates them "
        "on Step-5 Apply."
    )
    out("")

    out("---")
    out("")
    out("## Per-spec wizard output")
    out("")
    out(
        "Each spec block shows the four wizard destinations and the gap-fill "
        "delta. A `🟢` icon means the second-pass coverage reviewer marked "
        "the spec adequately covered; `🟡` means partial; `🔴` means gaps "
        "remain."
    )
    out("")

    by_std: dict[str, list[SpecBucket]] = defaultdict(list)
    for b in buckets.values():
        by_std[b.standard_code].append(b)

    for std in sorted(by_std.keys(), key=lambda s: (int(s) if s.isdigit() else 99)):
        out(f"## Standard {std}")
        out("")
        for bucket in sorted(by_std[std], key=lambda b: b.spec_code):
            _render_spec_block(out, bucket)

    out("---")
    out("")
    out("## Tag list — items needing human triage")
    out("")
    out(
        f"These {len(tags)} items did not auto-apply. They become rows in "
        "the wizard's **Tag List** view; the coordinator clicks each one to "
        "see full text, AI reasoning, and dropdowns to assign std/spec/kind "
        "and apply or discard. (See [[import-wizard-ui-spec-2026-05-17#4-the-tag-list-what-happens-to-questionable-items]].)"
    )
    out("")
    if not tags:
        out("_(empty)_")
    else:
        out("| Tag ID | Suggested | Conf | Source heading | Excerpt |")
        out("|---|---|---|---|---|")
        for t in sorted(tags, key=lambda t: t.confidence):
            suggested = f"{t.suggested_std}.{t.suggested_spec}" if (t.suggested_std and t.suggested_spec) else "—"
            excerpt = (t.full_text[:140] or "").replace("\n", " ").replace("|", "\\|") + ("…" if len(t.full_text) > 140 else "")
            heading = (t.source_anchor or "").replace("|", "\\|")[:80]
            out(f"| `{t.tag_id}` | `{suggested}` | {t.confidence:.2f} | {heading} | {excerpt} |")
    out("")

    out("---")
    out("")
    out("## Unmatched / context sections (NOT imported)")
    out("")
    out(
        f"- `context` sections ({len(context_sections)}): framing prose. The "
        "wizard intentionally skips these — they don't land in any spec."
    )
    out(
        f"- `unknown` sections ({len(unknown_sections)}): matcher couldn't "
        "classify. Routed to the tag list above. Listed here for completeness."
    )
    out("")
    if context_sections:
        out("### Top 10 context sections by word count")
        out("")
        for r in sorted(context_sections, key=lambda r: -int(r.get("wordCount") or 0))[:10]:
            out(
                f"- ({r.get('wordCount', 0)} words, conf {r.get('primary_confidence', 0):.2f}) "
                f"{(r.get('heading') or '')[:140]}"
            )
        out("")
    if unknown_sections:
        out("### Top 10 unknown sections by word count")
        out("")
        for r in sorted(unknown_sections, key=lambda r: -int(r.get("wordCount") or 0))[:10]:
            out(
                f"- ({r.get('wordCount', 0)} words) "
                f"{(r.get('heading') or '')[:140]}"
            )
            out(f"  _rationale_: {(r.get('rationale') or '')[:200]}")
        out("")

    out("---")
    out("")
    out("## Related")
    out("- [[import-wizard-ui-spec-2026-05-17]] — the UI spec these rules came from")
    out("- [[ai-import-stevenson-by-spec-2026-05-17]] — prior by-spec dump (no gap-fill)")
    out("- [[ai-import-stevenson-coverage-2026-05-17]] — prior first-pass coverage")

    return "\n".join(L)


def _render_spec_block(out, bucket: SpecBucket) -> None:
    rv = bucket.final_review or bucket.initial_review
    icon = "🔴"
    if rv:
        if rv.is_covered:
            icon = "🟢"
        elif rv.coverage_score >= 0.5:
            icon = "🟡"

    out(
        f"### `{bucket.standard_code}.{bucket.spec_code}` {icon} — "
        f"{bucket.standard_title}"
    )
    out("")
    out(f"**Spec prompt:** _{bucket.spec_prompt}_")
    out("")

    if rv:
        score = rv.coverage_score
        out(
            f"**Final coverage verdict:** covered=**{rv.is_covered}**, "
            f"score=**{score:.2f}**"
        )
        if bucket.initial_review and bucket.final_review:
            ir = bucket.initial_review
            fr = bucket.final_review
            out(
                f"_(first-pass: covered={ir.is_covered}, score={ir.coverage_score:.2f}; "
                f"second-pass after gap-fill: covered={fr.is_covered}, "
                f"score={fr.coverage_score:.2f}, delta={fr.coverage_score - ir.coverage_score:+.2f})_"
            )
        out("")

    # --- narratives ---
    out("#### Narrative content")
    out(
        f"_Destination: `Submission.narratives[{bucket.standard_code}]"
        f"[{bucket.spec_code}].content`_"
    )
    out("")
    if not bucket.narratives:
        out("_(no narrative content auto-applied)_")
    else:
        for i, n in enumerate(bucket.narratives, 1):
            conf_emoji = "🟢" if n.confidence >= 0.85 else ("🟡" if n.confidence >= 0.50 else "🔵")
            out(
                f"##### Narrative {i} — {conf_emoji} conf {n.confidence:.2f}, "
                f"{n.word_count} words, `{n.accept_state}`"
            )
            out("")
            out(f"_Source heading:_ **{n.heading[:200]}**")
            out("")
            if n.rationale:
                out(f"_AI rationale:_ {n.rationale[:400]}")
                out("")
            out("```text")
            snippet = n.snippet.strip()
            out(snippet if len(snippet) <= 2000 else snippet[:2000] + "\n… (truncated, full text imported)")
            out("```")
            out("")

    # --- evidence text ---
    out("#### Supporting evidence — text")
    out(
        f"_Destination: `Submission.narratives[{bucket.standard_code}]"
        f"[{bucket.spec_code}].supportingEvidenceText`_"
    )
    out("")
    if not bucket.evidence_text:
        out("_(no supporting-evidence text auto-applied)_")
    else:
        for i, e in enumerate(bucket.evidence_text, 1):
            tag = ""
            if e.source == "gap_fill":
                tag = " 🧩 _gap-fill_"
            elif e.source == "promoted_from_prose":
                tag = " ⤴️ _promoted from long prose_"
            out(
                f"##### Evidence text {i} — conf {e.confidence:.2f}, "
                f"{e.word_count} words, `{e.accept_state}`{tag}"
            )
            out("")
            if e.source == "gap_fill" and e.gap_filled:
                out(f"_Fills gap:_ {e.gap_filled}")
                out("")
            out(f"_Source heading:_ **{e.heading[:200]}**")
            out("")
            out("```text")
            snippet = e.snippet.strip()
            out(snippet if len(snippet) <= 1500 else snippet[:1500] + "\n… (truncated, full text imported)")
            out("```")
            out("")

    # --- evidence files ---
    out("#### Supporting evidence — files")
    out(
        f"_Destination: `SupportingEvidence` collection in Mongo + S3 upload + "
        f"`narratives[{bucket.standard_code}][{bucket.spec_code}].linkedDocuments`_"
    )
    out("")
    if not bucket.evidence_files:
        out("_(no evidence files auto-applied)_")
    else:
        out("| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |")
        out("|---|---|---|---|---|---|---|")
        for i, f in enumerate(bucket.evidence_files, 1):
            src_tag = "🧩 gap-fill" if f.source == "gap_fill" else "primary"
            out(
                f"| {i} | {f.file_title[:60]} | `{f.slug}` | {f.word_count} | "
                f"{f.confidence:.2f} | {src_tag} | `{f.s3_key}` |"
            )
        out("")
        # Inline the gap-fill bodies so the user can see what each file will hold
        for i, f in enumerate(bucket.evidence_files, 1):
            if f.source == "gap_fill" and f.gap_filled:
                out(f"_File {i} fills gap_: {f.gap_filled}")
                out("")
                out("```text")
                body = f.body.strip()
                out(body if len(body) <= 1500 else body[:1500] + "\n… (truncated, full DOCX preserves full body)")
                out("```")
                out("")

    # --- matrix cells ---
    if bucket.matrix_cells:
        out("#### Curriculum matrix cells")
        out("_Destination: `CurriculumMatrix.cells[]`_")
        out("")
        for c in bucket.matrix_cells:
            out(f"- matrix: `{c.matrix}`, col {c.column_index}, code `{c.code_raw}`, "
                f"types {c.content_types}, depth `{c.depth or '—'}`")
        out("")

    # --- gaps remaining ---
    if bucket.remaining_gaps:
        out(
            "#### Gaps still remaining (user must address manually after import)"
        )
        for g in bucket.remaining_gaps:
            out(f"- ⚠️ {g}")
        out("")

    out("---")
    out("")


# --------------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/tmp/stevenson-full-classify.json")
    ap.add_argument("--date", default="2026-05-18")
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument(
        "--max-specs",
        type=int,
        default=None,
        help="Smoke-test mode: only process the first N specs. Default: all.",
    )
    ap.add_argument(
        "--skip-gap-fill",
        action="store_true",
        help="Skip the gap-fill pass (much faster, half the cost).",
    )
    ap.add_argument(
        "--gap-fill-confidence",
        type=float,
        default=0.65,
        help="Haiku verification threshold for accepting a gap-fill candidate.",
    )
    args = ap.parse_args()

    openai_key = os.environ["OPENAI_API_KEY"]
    anthropic_key = os.environ["ANTHROPIC_API_KEY"]
    qdrant_url = os.environ["QDRANT_URL"]
    qdrant_key = os.environ.get("QDRANT_API_KEY", "")
    mongo_url = os.environ["MONGODB_URI"]

    print("📊 loading classify JSON…")
    classify_rows = json.load(open(args.input))
    print(f"   {len(classify_rows)} sections")

    print("📚 loading Baccalaureate handbook…")
    specs = load_specifications("bachelors")
    spec_index = {(s.standard_code, s.spec_code): s for s in specs}
    print(f"   {len(specs)} specs loaded")
    if args.max_specs:
        spec_index = dict(list(spec_index.items())[: args.max_specs])
        print(f"   limited to first {len(spec_index)} specs (smoke-test mode)")

    print("🌊 streaming Stevenson HTML from Mongo GridFS…")
    t0 = time.time()
    mc = MongoClient(mongo_url)
    db_name = os.environ.get("MONGO_DB_NAME", "CSHSE")
    try:
        db = mc.get_default_database()
    except Exception:
        db = mc[db_name]
    imp = db["selfstudyimports"].find_one({})
    if not imp:
        raise RuntimeError("No selfstudyimports document found in Mongo")
    submission_id = str(imp.get("submissionId") or imp.get("_id"))
    doc_version_id = f"docver-{uuid.uuid4().hex[:8]}"
    print(f"   submission: {imp.get('originalFilename')}")
    html_bytes = _stream_gridfs_html(db, f"{imp['_id']}.html")
    print(f"   {len(html_bytes)/1024/1024:.1f} MB in {time.time()-t0:.1f}s")

    print("📜 walking appendix…")
    t0 = time.time()
    appendix_sections = walk_appendix(html_bytes, base_id="stevenson")
    appendix_items: list[AppendixItem] = []
    for i, sec in enumerate(appendix_sections):
        appendix_items.append(
            AppendixItem(
                item_title=sec.heading,
                body_text=sec.markdown,
                standard_code=(sec.flags or {}).get("appendixStandard") or "",
                appendix_anchor=(sec.flags or {}).get("appendixAnchor") or None,
                item_index=i,
            )
        )
    appendix_items_by_index = {it.item_index: it for it in appendix_items}
    print(f"   {len(appendix_items)} appendix items in {time.time()-t0:.1f}s")

    print("🧮 allocating sections to wizard buckets…")
    buckets, tags, context_sections, unknown_sections = _allocate_to_buckets(
        classify_rows=classify_rows,
        spec_index=spec_index,
        appendix_items=appendix_items,
        submission_id=submission_id,
        doc_version_id=doc_version_id,
    )
    n_initial_narratives = sum(len(b.narratives) for b in buckets.values())
    n_initial_evtext = sum(len(b.evidence_text) for b in buckets.values())
    n_initial_files = sum(len(b.evidence_files) for b in buckets.values())
    print(
        f"   narratives={n_initial_narratives}, evidence_text={n_initial_evtext}, "
        f"files={n_initial_files}, tags={len(tags)}, context={len(context_sections)}, "
        f"unknown={len(unknown_sections)}"
    )

    print("🧠 first-pass coverage review (Haiku × specs)…")
    reviewer = CoverageReviewer(anthropic_key)
    initial_reviews: list[CoverageReview] = []
    t0 = time.time()

    def _review_one(spec: Specification) -> CoverageReview:
        bucket = buckets[(spec.standard_code, spec.spec_code)]
        narrative_text = "\n\n".join(
            n.snippet[:3000] for n in bucket.narratives
        ).strip()
        evidence_items = [
            (e.heading[:80], e.snippet[:1500])
            for e in bucket.evidence_text
        ] + [
            (f.file_title[:80], f.body[:1500])
            for f in bucket.evidence_files
        ]
        return reviewer.review(spec, narrative_text, evidence_items)

    target_specs = [spec_index[k] for k in spec_index]
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futures = {ex.submit(_review_one, s): s for s in target_specs}
        done = 0
        for fut in as_completed(futures):
            sp = futures[fut]
            try:
                rv = fut.result()
                initial_reviews.append(rv)
                buckets[(sp.standard_code, sp.spec_code)].initial_review = rv
            except Exception as e:
                print(f"   ✗ {sp.standard_code}.{sp.spec_code}: {e}")
            done += 1
            if done % 10 == 0 or done == len(target_specs):
                print(f"   {done}/{len(target_specs)} ({time.time()-t0:.0f}s)")
    print(f"   ✓ {len(initial_reviews)} reviews in {time.time()-t0:.0f}s")

    if args.skip_gap_fill:
        print("⏩ skipping gap-fill (per --skip-gap-fill)")
        # Carry initial review forward as final for the report.
        for b in buckets.values():
            b.final_review = b.initial_review
    else:
        print("🗂️  indexing appendix into per-import Qdrant collection…")
        store = VectorStore(qdrant_url, qdrant_key or None)
        embedder = EmbeddingClient(openai_key)
        import_id = f"wizard-preview-{uuid.uuid4().hex[:8]}"
        collection = gapfill_collection_name(import_id)
        t0 = time.time()
        coll_name, entries = index_appendix(
            store, embedder, import_id, appendix_items
        )
        print(f"   collection: {coll_name}, {len(entries)} entries, {time.time()-t0:.1f}s")

        print("🔎 running gap-fill pipeline…")
        t0 = time.time()
        anthropic_client = Anthropic(api_key=anthropic_key)
        narrative_lookup = {
            (sp.standard_code, sp.spec_code): "\n\n".join(
                n.snippet[:3000] for n in buckets[(sp.standard_code, sp.spec_code)].narratives
            ).strip()
            for sp in target_specs
        }
        evidence_lookup = {
            (sp.standard_code, sp.spec_code): [
                (e.heading[:80], e.snippet[:1500])
                for e in buckets[(sp.standard_code, sp.spec_code)].evidence_text
            ] + [
                (f.file_title[:80], f.body[:1500])
                for f in buckets[(sp.standard_code, sp.spec_code)].evidence_files
            ]
            for sp in target_specs
        }
        gap_t0 = time.time()

        def _gap_progress(done: int, total: int) -> None:
            if done % 5 == 0 or done == total:
                elapsed = time.time() - gap_t0
                eta = (elapsed / done) * (total - done) if done else 0
                print(
                    f"   {done}/{total} specs ({elapsed:.0f}s elapsed, "
                    f"~{eta:.0f}s remaining)"
                )

        try:
            gap_results = run_gap_filling(
                store=store,
                embedder=embedder,
                anthropic_client=anthropic_client,
                collection=coll_name,
                initial_reviews=initial_reviews,
                spec_lookup=spec_index,
                narrative_lookup=narrative_lookup,
                evidence_lookup=evidence_lookup,
                reviewer=reviewer,
                confidence_threshold=args.gap_fill_confidence,
                concurrency=args.concurrency,
                progress_callback=_gap_progress,
            )
            print(f"   ✓ {len(gap_results)} specs processed in {time.time()-t0:.0f}s")

            print("🧾 layering gap fills onto buckets…")
            _apply_gap_fills(
                buckets, gap_results, appendix_items_by_index,
                submission_id, doc_version_id,
            )
        finally:
            print("🗑️  dropping per-import Qdrant collection…")
            ok = drop_appendix_collection(store, import_id)
            print(f"   drop ok: {ok}")

    print("📝 rendering Obsidian preview…")
    rendered = _render_obsidian(
        buckets=buckets,
        tags=tags,
        appendix_items=appendix_items,
        context_sections=context_sections,
        unknown_sections=unknown_sections,
        classify_rows=classify_rows,
        date_str=args.date,
        submission_id=submission_id,
        doc_version_id=doc_version_id,
    )
    out_path = VAULT_DIR / f"ai-import-wizard-preview-stevenson-{args.date}.md"
    out_path.write_text(rendered)
    print(f"✅ wrote {out_path}")
    print(f"   {out_path.stat().st_size/1024:.0f} KB, {len(rendered.splitlines())} lines")


if __name__ == "__main__":
    main()
