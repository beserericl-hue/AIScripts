"""CR-040 Phase 3 — Post-parse coverage verification.

Per the CR-040 addendum:

> Every byte of the source document must be accounted for in exactly
> one destination: a bucket item, an Introduction, an evidenceDoc
> (paper / syllabus), a CV, an Unplaced item, or an explicit "skip"
> category.

Phase 3 ships a section-level census + gap detector. The matcher's
``byte_offset_start`` field gives us per-section document order; we
walk all input sections and classify each into a destination based on
which downstream pass consumed it. Any section that ended up nowhere
becomes a ``MissingFragment``.

The byte-level interval-map census from the spec (Pass 1) and the
boundary-sentence validation (Pass 3) are larger pieces that depend
on accurate document-byte tracking the walker doesn't expose today.
This Phase 3a delivers the coordinator-visible "Missing from import"
count + per-section diagnostics; the deeper byte-range work ships
when the walker grows ``byte_offset_end`` accuracy.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from app.splitter.sections import Section


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
class CoverageReport:
    total_sections: int
    sections_to_buckets: int
    sections_to_tags: int
    sections_to_introductions: int
    sections_to_cvs: int
    sections_to_evidence_docs: int
    sections_to_matrices: int
    missing_fragments: list[MissingFragment] = field(default_factory=list)

    @property
    def coverage_percent(self) -> float:
        if self.total_sections == 0:
            return 100.0
        accounted = (
            self.total_sections - len(self.missing_fragments)
        )
        return round(100.0 * accounted / self.total_sections, 1)

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
    counts AND a MissingFragment per orphan section.
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
    for sec in raw:
        if sec.id in assigned_anywhere:
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

    return CoverageReport(
        total_sections=len(raw),
        sections_to_buckets=len(bucketed),
        sections_to_tags=len(tagged),
        sections_to_introductions=len(intros),
        sections_to_cvs=len(cvs),
        sections_to_evidence_docs=len(evidence_docs),
        sections_to_matrices=len(matrices),
        missing_fragments=missing,
    )
