"""End-to-end wizard preview against a CSHSE Self-Study Template DOCX.

Parallel to ``build_wizard_preview.py`` (which targets Stevenson's free-
form self-study), this driver handles the **template format** that
institutions just starting accreditation use: the spec is the outline,
each section is a Handbook prompt with a ``Response:`` marker, and the
document is re-imported repeatedly as more sections get filled in.

Pipeline:
  1. Walk the DOCX via ``template_walker`` (heading-aware cuts, Response:
     marker stripping, placeholder detection).
  2. Run the existing spec matcher on filled sections only (placeholders
     don't waste API calls).
  3. Allocate to per-spec wizard buckets via the same auto-apply rules
     as the Stevenson driver.
  4. First-pass coverage review on specs that have at least one bucket
     entry. Empty specs get a synthesized "no content yet" review so the
     preview shows the institution exactly which prompts still need a
     response.
  5. Skip the gap-fill pass entirely — this format has no appendix to
     fill from. (Once an institution adds an appendix in a later import,
     the Stevenson-style preview should be run instead.)
  6. Render the Obsidian preview page paralleling
     ``ai-import-wizard-preview-stevenson-…md``.

The driver assumes the template represents a Baccalaureate self-study by
default (the Kennesaw State sample is one); pass ``--program-level`` for associate
or masters.
"""
from __future__ import annotations

import argparse
import os
import sys
import time
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.coverage.spec_coverage import CoverageReview, CoverageReviewer
from app.embeddings.openai_client import EmbeddingClient
from app.matcher.spec_matcher import Recommendation, SpecMatcher
from app.splitter.sections import Section
from app.splitter.template_walker import (
    TemplateSection,
    walk_template_docx,
)
from app.standards.loader import Specification, load_specifications
from app.vector.qdrant_ops import VectorStore

VAULT_DIR = Path(
    "/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/CSHSE/Engineering"
)

# Auto-apply thresholds from import-wizard-ui-spec-2026-05-17.md.
TEXT_NARRATIVE_WORD_LIMIT = 1000
TEXT_AUTO_APPLY_CONF = 0.85
FILE_AUTO_APPLY_CONF = 0.70
TAG_LIST_CONF = 0.50


# --------------------------------------------------------------------- helpers


def _slugify(s: str, max_len: int = 60) -> str:
    import re
    s = re.sub(r"[^a-zA-Z0-9-]+", "-", s.strip().lower()).strip("-")
    return (s or "untitled")[:max_len]


def _build_s3_key(submission_id: str, doc_version_id: str, slug: str) -> str:
    return f"{submission_id}/{doc_version_id}/{slug}.docx"


def _synthesized_empty_review(spec: Specification) -> CoverageReview:
    """Build a CoverageReview for a spec with no bucket content, without
    burning a Haiku call. The point is to tell the institution "you
    haven't written this section yet" rather than asking Claude to say
    the same thing 80 times.
    """
    return CoverageReview(
        standard_code=spec.standard_code,
        spec_code=spec.spec_code,
        is_covered=False,
        coverage_score=0.0,
        gaps=[
            "No content authored yet — institution must write a response under this Specification.",
        ],
        strengths=[],
        suggestion="Add a Response under this Specification's prompt in the template.",
        raw_response="(synthesized: no bucket content)",
    )


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
    source: str
    rationale: str = ""


@dataclass
class AppliedEvidenceFile:
    section_id: str
    file_title: str
    s3_key: str
    slug: str
    word_count: int
    confidence: float
    body: str
    source: str
    rationale: str = ""


@dataclass
class TagListEntry:
    tag_id: str
    section_id: str
    summary: str
    full_text: str
    suggested_std: str | None
    suggested_spec: str | None
    confidence: float
    source_heading: str
    accept_state: str
    rationale: str


@dataclass
class SpecBucket:
    standard_code: str
    spec_code: str
    standard_title: str
    spec_prompt: str

    narratives: list[AppliedNarrative] = field(default_factory=list)
    evidence_text: list[AppliedEvidenceText] = field(default_factory=list)
    evidence_files: list[AppliedEvidenceFile] = field(default_factory=list)

    initial_review: CoverageReview | None = None
    review_synthesized: bool = False  # True when we faked the "no content" review

    @property
    def has_any_content(self) -> bool:
        return bool(self.narratives or self.evidence_text or self.evidence_files)

    @property
    def gaps(self) -> list[str]:
        return self.initial_review.gaps if self.initial_review else []


# --------------------------------------------------------------------- pipeline


def _allocate_to_buckets(
    *,
    sections: list[Section],
    recommendations: dict[str, Recommendation],
    spec_index: dict[tuple[str, str], Specification],
    submission_id: str,
    doc_version_id: str,
) -> tuple[dict[tuple[str, str], SpecBucket], list[TagListEntry], list[Section]]:
    """Partition matcher recommendations into per-spec wizard buckets.

    Returns:
      buckets:   keyed by (std, spec) — populated for every spec in the
                 handbook so the preview can render every prompt, even
                 ones with no content.
      tags:      tag-list entries for low-confidence / unmatched items.
      unmatched: sections the matcher couldn't classify at all (also in tags).
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
    unmatched: list[Section] = []

    for sec in sections:
        rec = recommendations.get(sec.id)
        if rec is None:
            unmatched.append(sec)
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=sec.id,
                    summary=sec.heading[:120],
                    full_text=sec.markdown[:600],
                    suggested_std=None,
                    suggested_spec=None,
                    confidence=0.0,
                    source_heading=sec.heading[:120],
                    accept_state="review_unknown",
                    rationale="Matcher returned no recommendation.",
                )
            )
            continue

        std = rec.primary_standard
        spec_letter = rec.primary_spec
        conf = float(rec.primary_confidence or 0.0)
        section_type = rec.section_type
        snippet = sec.markdown
        # Drop the leading "# heading" prefix added by the walker so the
        # snippet displayed in the preview is just the body prose.
        if snippet.startswith("# "):
            snippet = snippet.split("\n", 2)[-1] if "\n" in snippet else ""
        snippet = snippet.strip()

        if section_type == "context" or std is None or spec_letter is None or section_type == "unknown":
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=sec.id,
                    summary=sec.heading[:120],
                    full_text=snippet[:600],
                    suggested_std=std,
                    suggested_spec=spec_letter,
                    confidence=conf,
                    source_heading=sec.heading[:120],
                    accept_state=rec.accept_state,
                    rationale=rec.rationale,
                )
            )
            continue

        if conf < TAG_LIST_CONF:
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=sec.id,
                    summary=sec.heading[:120],
                    full_text=snippet[:600],
                    suggested_std=std,
                    suggested_spec=spec_letter,
                    confidence=conf,
                    source_heading=sec.heading[:120],
                    accept_state=rec.accept_state,
                    rationale=rec.rationale,
                )
            )
            continue

        key = (std, spec_letter)
        if key not in buckets:
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=sec.id,
                    summary=sec.heading[:120],
                    full_text=snippet[:600],
                    suggested_std=std,
                    suggested_spec=spec_letter,
                    confidence=conf,
                    source_heading=sec.heading[:120],
                    accept_state=rec.accept_state,
                    rationale="Matcher picked a spec not present in the loaded handbook for this program level.",
                )
            )
            continue

        bucket = buckets[key]
        word_count = sec.word_count

        if section_type == "narrative_response":
            if conf >= TEXT_AUTO_APPLY_CONF and word_count < TEXT_NARRATIVE_WORD_LIMIT:
                bucket.narratives.append(
                    AppliedNarrative(
                        section_id=sec.id,
                        heading=sec.heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=rec.accept_state,
                        rationale=rec.rationale,
                    )
                )
            elif conf >= TEXT_AUTO_APPLY_CONF:
                bucket.evidence_text.append(
                    AppliedEvidenceText(
                        section_id=sec.id,
                        heading=sec.heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=rec.accept_state,
                        source="promoted_from_prose",
                        rationale=rec.rationale,
                    )
                )
            else:
                # 0.50–0.84 yellow band: auto-apply as narrative with flag
                bucket.narratives.append(
                    AppliedNarrative(
                        section_id=sec.id,
                        heading=sec.heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=rec.accept_state,
                        rationale=rec.rationale,
                    )
                )
        elif section_type == "supporting_evidence":
            looks_file = (
                word_count >= 250
                or any(
                    kw in sec.heading.lower()
                    for kw in ("cv", "syllabus", "minutes", "letter", "brochure", "handbook", "schedule")
                )
            )
            if looks_file and conf >= FILE_AUTO_APPLY_CONF:
                slug = _slugify(sec.heading)
                bucket.evidence_files.append(
                    AppliedEvidenceFile(
                        section_id=sec.id,
                        file_title=sec.heading[:120],
                        s3_key=_build_s3_key(submission_id, doc_version_id, slug),
                        slug=slug,
                        word_count=word_count,
                        confidence=conf,
                        body=snippet,
                        source="primary_classification",
                        rationale=rec.rationale,
                    )
                )
            else:
                bucket.evidence_text.append(
                    AppliedEvidenceText(
                        section_id=sec.id,
                        heading=sec.heading,
                        snippet=snippet,
                        word_count=word_count,
                        confidence=conf,
                        accept_state=rec.accept_state,
                        source="primary_classification",
                        rationale=rec.rationale,
                    )
                )
        elif section_type == "curriculum_matrix":
            # Template format usually doesn't embed the matrix as table data
            # — it's a separate DOCX. Route to tags so the user knows.
            tags.append(
                TagListEntry(
                    tag_id=f"tag-{uuid.uuid4().hex[:8]}",
                    section_id=sec.id,
                    summary=sec.heading[:120],
                    full_text=snippet[:600],
                    suggested_std=std,
                    suggested_spec=spec_letter,
                    confidence=conf,
                    source_heading=sec.heading[:120],
                    accept_state=rec.accept_state,
                    rationale="Matcher classified as curriculum_matrix; matrix-cell extraction runs separately on the matrix DOCX.",
                )
            )

    return buckets, tags, unmatched


# --------------------------------------------------------------------- render


def _render_obsidian(
    *,
    buckets: dict[tuple[str, str], SpecBucket],
    tags: list[TagListEntry],
    raw_template_sections: list[TemplateSection],
    placeholder_sections: list[TemplateSection],
    docx_filename: str,
    program_level: str,
    date_str: str,
    submission_id: str,
    doc_version_id: str,
    matcher_call_count: int,
    coverage_review_call_count: int,
) -> str:
    L: list[str] = []
    out = L.append

    n_specs = len(buckets)
    n_with_narr = sum(1 for b in buckets.values() if b.narratives)
    n_with_evtext = sum(1 for b in buckets.values() if b.evidence_text)
    n_with_files = sum(1 for b in buckets.values() if b.evidence_files)
    n_with_anything = sum(1 for b in buckets.values() if b.has_any_content)
    n_files_total = sum(len(b.evidence_files) for b in buckets.values())
    n_authored_sections = sum(1 for r in raw_template_sections if not r.placeholder)
    n_placeholder_sections = len(placeholder_sections)
    n_authored_words = sum(r.word_count for r in raw_template_sections if not r.placeholder)

    out("---")
    out(f"name: AI Import Wizard — Kennesaw State Template Preview {date_str}")
    out(
        "description: End-to-end live run of the wizard pipeline against the "
        "CSHSE Self-Study Template format (Kennesaw State partial sample). Spec-as-outline "
        "input: each section heading IS a Handbook prompt. For every spec, "
        "shows what would land in narratives / supporting-evidence text / "
        "supporting-evidence files, which template sections remain unauthored, "
        "and which placed sections need human triage. Parallel to "
        "[[ai-import-wizard-preview-stevenson-2026-05-18]]."
    )
    out("type: review")
    out("tags: [ai-import, sprint-1, template-format, kennesaw-state, wizard-preview, audit]")
    out(f"audit_date: {date_str}")
    out("auditor: claude")
    out(f"last_reviewed: {date_str}")
    out("---")
    out("")
    out(f"# AI Import Wizard — Kennesaw State Template Preview ({date_str})")
    out("")
    out(
        "This page is the **complete output the AI Import Wizard would "
        f"produce on `{docx_filename}`** — a partial-fill of the CSHSE "
        f"Self-Study Template for the {program_level} program level. The "
        "template format is the spec-as-outline variant of the self-study: "
        "each section heading is a Handbook prompt, the institution writes "
        "a `Response:` underneath, and the same document gets re-imported "
        "as more sections are filled."
    )
    out("")
    out(
        "Parallel to [[ai-import-wizard-preview-stevenson-2026-05-18]] "
        "(which targets Stevenson's finished free-form self-study). The "
        "wizard's downstream contract is identical — narratives, "
        "supporting-evidence text, supporting-evidence files, tag list — "
        "but the **walker** is the new piece: it cuts on template heading "
        "patterns (`1.`, `2a.`, `Standard 1, Specification a`), strips "
        "`Response:` markers, and detects unwritten / `Not applicable` "
        "responses as placeholders."
    )
    out("")
    out("Pipeline that produced this:")
    out("")
    out(
        "1. **Template walker** (`ai-service/app/splitter/template_walker.py`) "
        "— reads the DOCX paragraphs, cuts on heading patterns, accumulates "
        "`Response:` bodies."
    )
    out(
        "2. **Spec matcher** (`ai-service/app/matcher/spec_matcher.py`) — "
        "embedding + Haiku adjudication, run only on authored sections."
    )
    out(
        "3. **Bucket allocation** — same auto-apply rules as Stevenson "
        "(narrative if < 1000 words & conf ≥ 0.85; evidence text if longer; "
        "evidence file for syllabus/CV/handbook shape; tag list below 0.50)."
    )
    out(
        "4. **First-pass coverage review** — Haiku per spec, run only on "
        "specs with at least one bucket entry. Empty specs get a synthesized "
        '"no content yet" verdict (saves ~80 % of the coverage cost on a '
        "partial-fill document)."
    )
    out(
        "5. **No gap-fill pass** — the template has no appendix to search. "
        "Gap-fill becomes relevant once the institution adds appendix items "
        "in a later import."
    )
    out(
        "6. **Auto-apply rules** from "
        "[[import-wizard-ui-spec-2026-05-17]]."
    )
    out("")

    out("## Top-level summary")
    out("")
    out(f"- Source document: `{docx_filename}` ({program_level} program level)")
    out(f"- Specs in Handbook ({program_level}): **{n_specs}**")
    out(
        f"- Template sections detected: **{len(raw_template_sections)}** "
        f"(authored: **{n_authored_sections}**, placeholder/unwritten: "
        f"**{n_placeholder_sections}**)"
    )
    out(f"- Authored words across all responses: **{n_authored_words:,}**")
    out(f"- Specs with at least one wizard write: **{n_with_anything}**")
    out(f"- Specs with narrative content: **{n_with_narr}**")
    out(f"- Specs with supporting-evidence text: **{n_with_evtext}**")
    out(f"- Specs with supporting-evidence files: **{n_with_files}**")
    out(f"- Total evidence files (with simulated S3 keys): **{n_files_total}**")
    out(f"- Tag list (user must triage in wizard's Tag List view): **{len(tags)}**")
    out(f"- Matcher API calls: **{matcher_call_count}** (authored sections only)")
    out(
        f"- Coverage review API calls: **{coverage_review_call_count}** of "
        f"{n_specs} possible (skipped {n_specs - coverage_review_call_count} "
        "empty specs)"
    )
    out("")

    out("## Simulated import identity")
    out("")
    out(f"- `submissionId`: `{submission_id}`")
    out(f"- `documentVersionId`: `{doc_version_id}`")
    out(
        "- S3 bucket: `cshse-filestorage-qlyj5pn` (Tigris). Files below use "
        "key pattern `{submissionId}/{documentVersionId}/{slug}.docx`. Files "
        "are NOT actually uploaded by this preview."
    )
    out("")

    # Re-import context section — what's unique to the template format
    out("## Unwritten / placeholder template sections")
    out("")
    out(
        f"These {n_placeholder_sections} template headings exist in the DOCX "
        "but have no authored response yet (empty body, `Not applicable`, or "
        "only a `See Appendix` pointer). On the next re-import, anything the "
        "institution writes under these headings will flow through the same "
        "walker → matcher → bucket pipeline."
    )
    out("")
    if not placeholder_sections:
        out("_(none — every detected heading has authored content)_")
    else:
        out("| Para # | Hint | Heading |")
        out("|---|---|---|")
        for r in placeholder_sections:
            hint = f"`{r.standard_hint or '-'}.{r.spec_hint or '-'}`"
            heading = r.heading[:120].replace("|", "\\|")
            out(f"| {r.paragraph_index} | {hint} | {heading} |")
    out("")

    out("---")
    out("")
    out("## Per-spec wizard output")
    out("")
    out(
        "Each spec block shows the four wizard destinations. A `🟢` icon "
        "means the coverage reviewer marked the spec adequately covered; "
        "`🟡` means partial coverage; `🔴` means major gaps (or no content "
        "authored yet)."
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
            suggested = (
                f"{t.suggested_std}.{t.suggested_spec}"
                if (t.suggested_std and t.suggested_spec)
                else "—"
            )
            excerpt = (t.full_text[:140] or "").replace("\n", " ").replace("|", "\\|") + (
                "…" if len(t.full_text) > 140 else ""
            )
            heading = (t.source_heading or "").replace("|", "\\|")[:80]
            out(f"| `{t.tag_id}` | `{suggested}` | {t.confidence:.2f} | {heading} | {excerpt} |")
    out("")

    out("---")
    out("")
    out("## How this differs from the Stevenson preview")
    out("")
    out(
        "- **Input shape:** spec-as-outline (template) vs. free-form self-"
        "study. Stevenson required a TOC anchor walker + deep table walker "
        "+ appendix walker; the template just needs paragraph walking with "
        "heading detection."
    )
    out(
        "- **Section count:** template format produces tens of sections "
        f"(here: {len(raw_template_sections)}) vs. Stevenson's 568. Most "
        "are direct spec-prompt responses, so matcher confidence tends to "
        "be higher."
    )
    out(
        "- **No appendix gap-fill:** template documents don't carry an "
        "appendix until late drafts, so the gap-fill pass is skipped here. "
        "Once an appendix is added, the Stevenson-style preview applies."
    )
    out(
        "- **Re-import friendly:** since the template format is designed "
        "for repeated imports as more sections get filled, the **placeholder "
        "section table** above is the key signal for the institution: "
        "those are the prompts still waiting for a response."
    )
    out("")

    out("## Related")
    out("- [[import-wizard-ui-spec-2026-05-17]] — the UI spec these rules came from")
    out("- [[ai-import-wizard-preview-stevenson-2026-05-18]] — sibling preview on Stevenson's free-form self-study")
    out("- [[legacy-self-study-import]] — pre-AI manual flow this replaces")

    return "\n".join(L)


def _render_spec_block(out, bucket: SpecBucket) -> None:
    rv = bucket.initial_review
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
        tag = " _(synthesized — no content authored)_" if bucket.review_synthesized else ""
        out(
            f"**Coverage verdict:** covered=**{rv.is_covered}**, "
            f"score=**{score:.2f}**{tag}"
        )
        if rv.suggestion and not bucket.review_synthesized:
            out(f"_Reviewer suggestion:_ {rv.suggestion[:300]}")
        out("")

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
            tag = " ⤴️ _promoted from long prose_" if e.source == "promoted_from_prose" else ""
            out(
                f"##### Evidence text {i} — conf {e.confidence:.2f}, "
                f"{e.word_count} words, `{e.accept_state}`{tag}"
            )
            out("")
            out(f"_Source heading:_ **{e.heading[:200]}**")
            out("")
            if e.rationale:
                out(f"_AI rationale:_ {e.rationale[:300]}")
                out("")
            out("```text")
            snippet = e.snippet.strip()
            out(snippet if len(snippet) <= 1500 else snippet[:1500] + "\n… (truncated, full text imported)")
            out("```")
            out("")

    out("#### Supporting evidence — files")
    out(
        f"_Destination: `SupportingEvidence` collection in Mongo + S3 upload + "
        f"`narratives[{bucket.standard_code}][{bucket.spec_code}].linkedDocuments`_"
    )
    out("")
    if not bucket.evidence_files:
        out("_(no evidence files auto-applied)_")
    else:
        out("| # | File title | Slug | Words | Conf | S3 key (simulated) |")
        out("|---|---|---|---|---|---|")
        for i, f in enumerate(bucket.evidence_files, 1):
            out(
                f"| {i} | {f.file_title[:60]} | `{f.slug}` | {f.word_count} | "
                f"{f.confidence:.2f} | `{f.s3_key}` |"
            )
        out("")

    if bucket.gaps:
        out("#### Gaps still remaining (user must address manually after import)")
        for g in bucket.gaps:
            out(f"- ⚠️ {g}")
        out("")

    out("---")
    out("")


# --------------------------------------------------------------------- callable runner


def run_template_preview(
    *,
    docx: str,
    program_level: str = "bachelors",
    date: str = "2026-05-18",
    concurrency: int = 6,
    output_suffix: str = "kennesaw-state",
    base_id: str | None = None,
    openai_key: str | None = None,
    anthropic_key: str | None = None,
    qdrant_url: str | None = None,
    qdrant_key: str | None = None,
) -> Path:
    """Run the template-format preview pipeline and write the Obsidian page.

    Importable callable so dispatchers (``scripts/build_preview.py``)
    can invoke this in-process without subprocess overhead. All API
    credentials default to the matching environment variables; pass
    them explicitly to override.

    Returns the ``Path`` of the written preview file.
    """
    openai_key = openai_key or os.environ["OPENAI_API_KEY"]
    anthropic_key = anthropic_key or os.environ["ANTHROPIC_API_KEY"]
    qdrant_url = qdrant_url or os.environ["QDRANT_URL"]
    qdrant_key = qdrant_key if qdrant_key is not None else os.environ.get("QDRANT_API_KEY", "")

    docx_path = docx
    docx_filename = os.path.basename(docx_path)
    submission_id = f"template-preview-{uuid.uuid4().hex[:8]}"
    doc_version_id = f"docver-{uuid.uuid4().hex[:8]}"
    walker_base_id = base_id or output_suffix

    print(f"📄 walking template: {docx_filename}")
    t0 = time.time()
    sections, raw_sections = walk_template_docx(docx_path, base_id=walker_base_id)
    placeholders = [r for r in raw_sections if r.placeholder]
    print(
        f"   {len(raw_sections)} raw template sections "
        f"({len(sections)} authored, {len(placeholders)} placeholder) "
        f"in {time.time()-t0:.1f}s"
    )

    print(f"📚 loading {program_level} handbook…")
    specs = load_specifications(program_level)
    spec_index = {(s.standard_code, s.spec_code): s for s in specs}
    print(f"   {len(specs)} specs loaded")

    print("🔎 running matcher on authored sections…")
    store = VectorStore(qdrant_url, qdrant_key or None)
    embedder = EmbeddingClient(openai_key)
    matcher = SpecMatcher(store, embedder, anthropic_key)

    recommendations: dict[str, Recommendation] = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = {
            ex.submit(matcher.recommend, sec, program_level): sec
            for sec in sections
        }
        for fut in as_completed(futures):
            sec = futures[fut]
            try:
                rec = fut.result()
                recommendations[sec.id] = rec
            except Exception as exc:
                print(f"   ✗ {sec.heading[:60]}: {type(exc).__name__}: {exc}")
    print(f"   ✓ {len(recommendations)} recommendations in {time.time()-t0:.1f}s")

    print("🧮 allocating sections to wizard buckets…")
    buckets, tags, unmatched = _allocate_to_buckets(
        sections=sections,
        recommendations=recommendations,
        spec_index=spec_index,
        submission_id=submission_id,
        doc_version_id=doc_version_id,
    )
    n_initial_narratives = sum(len(b.narratives) for b in buckets.values())
    n_initial_evtext = sum(len(b.evidence_text) for b in buckets.values())
    n_initial_files = sum(len(b.evidence_files) for b in buckets.values())
    print(
        f"   narratives={n_initial_narratives}, evidence_text={n_initial_evtext}, "
        f"files={n_initial_files}, tags={len(tags)}, unmatched={len(unmatched)}"
    )

    print("🧠 coverage review on filled specs only…")
    reviewer = CoverageReviewer(anthropic_key)
    t0 = time.time()
    coverage_call_count = 0

    def _review_one(spec: Specification) -> tuple[Specification, CoverageReview]:
        bucket = buckets[(spec.standard_code, spec.spec_code)]
        narrative_text = "\n\n".join(n.snippet[:3000] for n in bucket.narratives).strip()
        evidence_items = [
            (e.heading[:80], e.snippet[:1500]) for e in bucket.evidence_text
        ] + [
            (f.file_title[:80], f.body[:1500]) for f in bucket.evidence_files
        ]
        return spec, reviewer.review(spec, narrative_text, evidence_items)

    filled_specs = [
        spec for spec in specs
        if buckets[(spec.standard_code, spec.spec_code)].has_any_content
    ]
    empty_specs = [s for s in specs if s not in filled_specs]
    print(f"   {len(filled_specs)} specs to review, {len(empty_specs)} synthesized")

    with ThreadPoolExecutor(max_workers=concurrency) as ex:
        futures = {ex.submit(_review_one, s): s for s in filled_specs}
        done = 0
        for fut in as_completed(futures):
            sp = futures[fut]
            try:
                _, rv = fut.result()
                buckets[(sp.standard_code, sp.spec_code)].initial_review = rv
            except Exception as exc:
                print(f"   ✗ {sp.standard_code}.{sp.spec_code}: {exc}")
            done += 1
            coverage_call_count += 1
    for spec in empty_specs:
        buckets[(spec.standard_code, spec.spec_code)].initial_review = (
            _synthesized_empty_review(spec)
        )
        buckets[(spec.standard_code, spec.spec_code)].review_synthesized = True
    print(f"   ✓ {coverage_call_count} reviews in {time.time()-t0:.0f}s")

    print("📝 rendering Obsidian preview…")
    rendered = _render_obsidian(
        buckets=buckets,
        tags=tags,
        raw_template_sections=raw_sections,
        placeholder_sections=placeholders,
        docx_filename=docx_filename,
        program_level=program_level,
        date_str=date,
        submission_id=submission_id,
        doc_version_id=doc_version_id,
        matcher_call_count=len(recommendations),
        coverage_review_call_count=coverage_call_count,
    )
    out_path = VAULT_DIR / f"ai-import-wizard-preview-{output_suffix}-{date}.md"
    out_path.write_text(rendered)
    print(f"✅ wrote {out_path}")
    print(f"   {out_path.stat().st_size/1024:.0f} KB, {len(rendered.splitlines())} lines")
    return out_path


# --------------------------------------------------------------------- CLI


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--docx",
        default="/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/docs/Sample to Council from KSU.docx",
    )
    ap.add_argument(
        "--program-level",
        default="bachelors",
        choices=("associate", "bachelors", "masters"),
    )
    ap.add_argument("--date", default="2026-05-18")
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument(
        "--output-suffix",
        default="kennesaw-state",
        help="Suffix used in the output filename: ai-import-wizard-preview-<suffix>-<date>.md",
    )
    args = ap.parse_args()
    run_template_preview(
        docx=args.docx,
        program_level=args.program_level,
        date=args.date,
        concurrency=args.concurrency,
        output_suffix=args.output_suffix,
    )


if __name__ == "__main__":
    main()
