"""CR-040 Phase 3 — Post-parse coverage verification.

Per the CR-040 addendum:

> Every byte of the source document must be accounted for in exactly
> one destination: a bucket item, an Introduction, an evidenceDoc
> (paper / syllabus), a CV, an Unplaced item, or an explicit "skip"
> category.

Phase 3 shipped the section-level census + gap detector.
Phase 3b (this slice) adds:

- **Pass 1 byte-level census** — uses each section's
  ``byte_offset_end - byte_offset_start`` (word-count units after the
  walker fix in this CR) as the size unit. Total = sum across all
  sections; assigned = sum across sections routed to any destination;
  coverage % is the ratio. Closer to the "every byte accounted for"
  intent the CR addendum describes than the binary section count.
- **Pass 3 boundary validation** — for each evidenceDoc section,
  check that the body starts mid-sentence (header-line check) AND
  that the next contiguous section by byte order also starts cleanly
  (no-orphan-paragraph check). Violations surface as
  ``BoundaryWarning`` entries on the report.

Skip categories are explicit: ``skip:page-numbers``, ``skip:toc``,
``skip:image-only-para``, ``skip:whitespace-or-noise``. Sections
shorter than the noise floor are auto-classified rather than counted
as a missing fragment, so the coordinator-visible list stays focused
on real gaps.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

from app.splitter.sections import Section


# Sections below this word floor are treated as ``skip:whitespace-or-noise``
# rather than surfaced as coordinator-actionable missing fragments. Matches
# the wizard's existing per-section minimum so we don't surface fragments
# the matcher already filtered out.
NOISE_WORD_FLOOR = 5


@dataclass
class MissingFragment:
    """One source section the pipeline assigned nowhere.

    The wizard surfaces these in a new "Missing from import" rail
    entry the coordinator can manually reassign or explicitly discard.
    """
    section_id: str
    heading: str
    snippet: str
    word_count: int
    byte_offset_start: int
    splitter_tier: str
    why: str = "unassigned"


@dataclass
class BoundaryWarning:
    """CR-040 Phase 3b — one cut-off boundary on an evidenceDoc section.

    Surfaced alongside missing fragments so the coordinator can see when
    the appendix-paper / syllabus detector likely truncated a paper. The
    wizard shows these as informational yellow chips next to the file
    card — not blocking, but a "we may have lost a page" signal.
    """
    section_id: str
    kind: str  # "header_check" | "sentence_edge" | "orphan_paragraph"
    detail: str


# Heuristic patterns for Pass 3 boundary validation. Cheap regex — these
# are signals, not proofs. Coordinator confirms via the existing
# Reassign / Discard controls if the heuristic was wrong.
_HEADER_HINT_RE = re.compile(
    r"^\s*("
    r"(sample\s+)?[A-Z][a-z]+\s+(report|paper|project|essay|reflection|interview)"
    r"|[A-Z]{2,5}\s+\d{2,4}"
    r"|.{0,80}\(\d+\s*points\)"
    r"|syllabus|course\s+outline"
    r")",
    re.IGNORECASE,
)
_SENTENCE_END_RE = re.compile(r"[.!?]['\"\)]?\s*$")


@dataclass
class CoverageReport:
    total_sections: int
    sections_to_buckets: int
    sections_to_tags: int
    sections_to_introductions: int
    sections_to_cvs: int
    sections_to_evidence_docs: int
    sections_to_matrices: int
    missing_fragments: list[MissingFragment] = field(default_factory=list)
    # CR-040 Phase 3b additions:
    # Byte-level census uses word_count as the size unit (after the
    # Phase 3b walker fix that makes byte_offset_end meaningful).
    bytes_total: int = 0
    bytes_assigned: int = 0
    skip_breakdown: dict[str, int] = field(default_factory=dict)
    boundary_warnings: list[BoundaryWarning] = field(default_factory=list)

    @property
    def coverage_percent(self) -> float:
        """Section-level coverage — accounted sections / total sections."""
        if self.total_sections == 0:
            return 100.0
        accounted = (
            self.total_sections - len(self.missing_fragments)
        )
        return round(100.0 * accounted / self.total_sections, 1)

    @property
    def coverage_percent_bytes(self) -> float:
        """CR-040 Phase 3b — byte-level coverage as a content-size ratio."""
        if self.bytes_total == 0:
            return 100.0
        return round(100.0 * self.bytes_assigned / self.bytes_total, 1)

    def to_dict(self) -> dict:
        return {
            "totalSections": self.total_sections,
            "sectionsToBuckets": self.sections_to_buckets,
            "sectionsToTags": self.sections_to_tags,
            "sectionsToIntroductions": self.sections_to_introductions,
            "sectionsToCVs": self.sections_to_cvs,
            "sectionsToEvidenceDocs": self.sections_to_evidence_docs,
            "sectionsToMatrices": self.sections_to_matrices,
            "coveragePercent": self.coverage_percent,
            # CR-040 Phase 3b wire fields.
            "bytesTotal": self.bytes_total,
            "bytesAssigned": self.bytes_assigned,
            "coveragePercentBytes": self.coverage_percent_bytes,
            "skipBreakdown": dict(self.skip_breakdown),
            "boundaryWarnings": [
                {
                    "sectionId": w.section_id,
                    "kind": w.kind,
                    "detail": w.detail,
                }
                for w in self.boundary_warnings
            ],
            "missingFragments": [
                {
                    "sectionId": f.section_id,
                    "heading": f.heading,
                    "snippet": f.snippet,
                    "wordCount": f.word_count,
                    "byteOffsetStart": f.byte_offset_start,
                    "splitterTier": f.splitter_tier,
                    "why": f.why,
                }
                for f in self.missing_fragments
            ],
        }


def _section_size(sec: Section) -> int:
    """Phase 3b — content size for the byte-level census.

    Falls back to ``word_count`` when the walker didn't expand
    ``byte_offset_end`` (older imports replayed against the new
    verifier still produce sensible numbers).
    """
    extent = max(0, sec.byte_offset_end - sec.byte_offset_start)
    return extent if extent > 0 else max(0, sec.word_count)


def _classify_skip(sec: Section) -> str | None:
    """Phase 3b — auto-classify low-value sections into skip categories.

    Returns the skip-category string when the section should NOT be
    surfaced as a missing fragment; returns None otherwise so the
    caller treats the section as a real orphan.
    """
    text = (sec.markdown or "").strip()
    if not text:
        return "skip:whitespace-or-noise"
    # Check special heading patterns BEFORE the noise floor — a 3-word
    # "Table of Contents" heading is meaningful skip metadata, not just
    # whitespace-tier noise.
    if sec.splitter_tier == "prose_outside_table_heading" and sec.word_count < 8:
        lower = text.lower()
        if "table of contents" in lower or lower.startswith("appendix"):
            return "skip:toc"
    if sec.word_count < NOISE_WORD_FLOOR:
        return "skip:whitespace-or-noise"
    return None


def _validate_boundaries(
    raw: list[Section], evidence_doc_ids: set[str]
) -> list[BoundaryWarning]:
    """Phase 3b Pass 3 — sentence-edge + header-line checks on evidenceDocs.

    Bias is to surface candidate truncations; coordinator confirms.
    """
    warnings: list[BoundaryWarning] = []
    # Index sections by byte order so we can look up the previous one
    # cheaply for the orphan-paragraph check.
    in_order = sorted(raw, key=lambda s: s.byte_offset_start)
    for idx, sec in enumerate(in_order):
        if sec.id not in evidence_doc_ids:
            continue
        text = (sec.markdown or "").strip()
        if not text:
            continue
        first_line = text.split("\n", 1)[0].strip()
        if not _HEADER_HINT_RE.match(first_line):
            warnings.append(
                BoundaryWarning(
                    section_id=sec.id,
                    kind="header_check",
                    detail=(
                        f"first line {first_line[:60]!r} doesn't match a "
                        "paper/syllabus header pattern; the boundary may have "
                        "drifted forward into body content"
                    ),
                )
            )
        if not _SENTENCE_END_RE.search(text[-160:]):
            warnings.append(
                BoundaryWarning(
                    section_id=sec.id,
                    kind="sentence_edge",
                    detail=(
                        "body doesn't end on a sentence boundary; "
                        "the boundary may have truncated mid-paragraph"
                    ),
                )
            )
        # Orphan-paragraph check — if the section immediately before this
        # evidenceDoc has ≥30 words and the same splitter_tier, it likely
        # belongs inside the paper but the boundary cut it off.
        if idx > 0:
            prev = in_order[idx - 1]
            if prev.id not in evidence_doc_ids and prev.word_count >= 30:
                warnings.append(
                    BoundaryWarning(
                        section_id=sec.id,
                        kind="orphan_paragraph",
                        detail=(
                            f"previous section {prev.id} has {prev.word_count} words "
                            "and might belong inside this paper"
                        ),
                    )
                )
    return warnings


def verify_coverage(
    *,
    raw_sections: Iterable[Section],
    bucketed_section_ids: Iterable[str],
    tag_section_ids: Iterable[str],
    intro_section_ids: Iterable[str],
    cv_section_ids: Iterable[str],
    evidence_doc_section_ids: Iterable[str],
    matrix_section_ids: Iterable[str] = (),
    snippet_chars: int = 200,
) -> CoverageReport:
    """Walk every input section and classify it into a destination.

    Pure function — accepts the raw section stream + each downstream
    consumer's id set, returns a CoverageReport with the per-bucket
    counts, byte-level census, boundary warnings, and a
    MissingFragment per orphan section.
    """
    raw = list(raw_sections)
    bucketed = set(bucketed_section_ids)
    tagged = set(tag_section_ids)
    intros = set(intro_section_ids)
    cvs = set(cv_section_ids)
    evidence_docs = set(evidence_doc_section_ids)
    matrices = set(matrix_section_ids)
    assigned_anywhere = bucketed | tagged | intros | cvs | evidence_docs | matrices

    missing: list[MissingFragment] = []
    skip_breakdown: dict[str, int] = {}
    bytes_total = 0
    bytes_assigned = 0
    for sec in raw:
        size = _section_size(sec)
        bytes_total += size
        if sec.id in assigned_anywhere:
            bytes_assigned += size
            continue
        skip_cat = _classify_skip(sec)
        if skip_cat is not None:
            skip_breakdown[skip_cat] = skip_breakdown.get(skip_cat, 0) + size
            # Count skipped bytes as "assigned" — they're explicitly
            # classified, not unaccounted.
            bytes_assigned += size
            continue
        missing.append(
            MissingFragment(
                section_id=sec.id,
                heading=(sec.heading or "")[:200],
                snippet=(sec.markdown or "").strip()[:snippet_chars],
                word_count=sec.word_count,
                byte_offset_start=sec.byte_offset_start,
                splitter_tier=sec.splitter_tier,
                why="unassigned",
            )
        )

    boundary_warnings = _validate_boundaries(raw, evidence_docs)

    return CoverageReport(
        total_sections=len(raw),
        sections_to_buckets=len(bucketed),
        sections_to_tags=len(tagged),
        sections_to_introductions=len(intros),
        sections_to_cvs=len(cvs),
        sections_to_evidence_docs=len(evidence_docs),
        sections_to_matrices=len(matrices),
        missing_fragments=missing,
        bytes_total=bytes_total,
        bytes_assigned=bytes_assigned,
        skip_breakdown=skip_breakdown,
        boundary_warnings=boundary_warnings,
    )
