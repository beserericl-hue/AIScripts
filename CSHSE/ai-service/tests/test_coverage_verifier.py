"""CR-040 Phase 3 — coverage_verifier tests."""
from __future__ import annotations

from app.splitter.coverage_verifier import (
    CoverageReport,
    MissingFragment,
    verify_coverage,
)
from app.splitter.sections import Section


def _section(id_: str, heading: str = "", body: str = "x x x", words: int = 3) -> Section:
    return Section(
        id=id_,
        heading=heading or id_,
        heading_level=2,
        markdown=body,
        byte_offset_start=0,
        byte_offset_end=0,
        word_count=words,
        contains_table=False,
        contains_image=False,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="prose_outside_table",
    )


def test_full_coverage_zero_missing() -> None:
    raw = [_section("a"), _section("b"), _section("c")]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"a", "b"},
        tag_section_ids={"c"},
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.total_sections == 3
    assert report.missing_fragments == []
    assert report.coverage_percent == 100.0


def test_missing_sections_surface_with_metadata() -> None:
    raw = [
        _section("a", heading="Intro to Standard 1", body="A 5-word body here.", words=5),
        _section("b", heading="Orphan paragraph", body="Five word orphan body here.", words=5),
        _section("c", heading="Another orphan", body="Another five-word orphan body.", words=5),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"a"},
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.total_sections == 3
    assert len(report.missing_fragments) == 2
    assert {f.section_id for f in report.missing_fragments} == {"b", "c"}
    assert report.coverage_percent == round(100.0 / 3, 1)
    f0 = report.missing_fragments[0]
    assert f0.heading
    assert f0.word_count == 5
    assert f0.why == "unassigned"


def test_section_assigned_to_multiple_destinations_counts_once() -> None:
    raw = [_section("a")]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"a"},
        tag_section_ids={"a"},
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.total_sections == 1
    assert report.sections_to_buckets == 1
    assert report.sections_to_tags == 1
    assert report.missing_fragments == []  # union, no double-count of missing


def test_empty_input_is_full_coverage() -> None:
    report = verify_coverage(
        raw_sections=[],
        bucketed_section_ids=set(),
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.total_sections == 0
    assert report.coverage_percent == 100.0


def test_to_dict_wire_shape() -> None:
    # Use a section above the CR-040 Phase 3b noise floor so it surfaces
    # as a real missing fragment rather than auto-classified as
    # skip:whitespace-or-noise.
    raw = [_section("orphan", heading="orphan h", body="orphan body with enough words here", words=6)]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids=set(),
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    d = report.to_dict()
    assert d["totalSections"] == 1
    assert d["coveragePercent"] == 0.0
    assert len(d["missingFragments"]) == 1
    mf = d["missingFragments"][0]
    assert mf["sectionId"] == "orphan"
    assert mf["why"] == "unassigned"
    # Phase 3b wire fields present.
    assert "bytesTotal" in d
    assert "bytesAssigned" in d
    assert "coveragePercentBytes" in d
    assert "skipBreakdown" in d
    assert "boundaryWarnings" in d
