"""CR-040 Phase 3b — byte-level census + boundary validation tests."""
from __future__ import annotations

from app.splitter.coverage_verifier import (
    BoundaryWarning,
    CoverageReport,
    verify_coverage,
)
from app.splitter.sections import Section


def _section(
    id_: str,
    body: str = "x x x x x x x",
    words: int = 7,
    byte_start: int = 0,
    byte_end: int | None = None,
    splitter_tier: str = "prose_outside_table",
) -> Section:
    return Section(
        id=id_,
        heading=id_,
        heading_level=2,
        markdown=body,
        byte_offset_start=byte_start,
        byte_offset_end=byte_end if byte_end is not None else byte_start + words,
        word_count=words,
        contains_table=False,
        contains_image=False,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier=splitter_tier,
    )


# ---------------------------- byte-level census ----------------------------


def test_byte_census_full_coverage() -> None:
    raw = [
        _section("a", words=10, byte_start=0),
        _section("b", words=20, byte_start=10),
        _section("c", words=5, byte_start=30),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"a", "b", "c"},
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.bytes_total == 35
    assert report.bytes_assigned == 35
    assert report.coverage_percent_bytes == 100.0


def test_byte_census_partial_coverage() -> None:
    raw = [
        _section("a", words=10, byte_start=0),
        _section("b", words=20, byte_start=10),
        _section("c", words=20, byte_start=30),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"a"},
        tag_section_ids={"b"},
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.bytes_total == 50
    assert report.bytes_assigned == 30
    assert report.coverage_percent_bytes == 60.0


def test_byte_census_uses_word_count_when_extent_missing() -> None:
    # Older imports may have byte_offset_end == byte_offset_start; the
    # verifier falls back to word_count so we still get a meaningful census.
    raw = [
        _section("a", words=8, byte_start=0, byte_end=0),
        _section("b", words=12, byte_start=1, byte_end=1),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"a", "b"},
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.bytes_total == 20  # 8 + 12 via word_count fallback
    assert report.coverage_percent_bytes == 100.0


# ---------------------------- skip classification --------------------------


def test_short_unassigned_section_classified_as_noise() -> None:
    raw = [
        _section("good", words=10, byte_start=0),
        _section("noise", words=2, byte_start=10, body="hi there"),  # under 5-word floor
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"good"},
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    assert report.missing_fragments == []
    assert report.skip_breakdown.get("skip:whitespace-or-noise", 0) > 0
    # Noise still counts as "assigned" for the byte census so coverage
    # reads as 100% — nothing is left unaccounted for.
    assert report.coverage_percent_bytes == 100.0


def test_toc_heading_classified_as_toc_skip() -> None:
    raw = [
        _section(
            "toc",
            words=3,
            byte_start=0,
            body="Table of Contents",
            splitter_tier="prose_outside_table_heading",
        ),
        _section("real", words=10, byte_start=3),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"real"},
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    # toc-shaped heading auto-classified as skip:toc, not surfaced.
    assert report.missing_fragments == []
    assert report.skip_breakdown.get("skip:toc", 0) >= 1


# ------------------------- boundary validation -----------------------------


def test_evidence_doc_with_clean_header_passes() -> None:
    raw = [
        _section(
            "paper-1",
            words=50,
            byte_start=0,
            body="Sample Country Report\n\nThis is a comprehensive analysis of South Korea's healthcare system. The report covers history, current policy, and outcomes across multiple decades.",
        ),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids=set(),
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids={"paper-1"},
    )
    header_warnings = [w for w in report.boundary_warnings if w.kind == "header_check"]
    assert header_warnings == [], (
        "clean Sample Country Report header should pass header check"
    )


def test_evidence_doc_with_truncated_ending_warns() -> None:
    raw = [
        _section(
            "paper-trunc",
            words=40,
            byte_start=0,
            body="Sample Country Report\n\nThis report begins with proper context and then trails off mid-sentence at the boundary the appendix detector picked",
        ),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids=set(),
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids={"paper-trunc"},
    )
    sentence_warnings = [w for w in report.boundary_warnings if w.kind == "sentence_edge"]
    assert sentence_warnings, "mid-sentence boundary should produce a warning"


def test_evidence_doc_without_header_warns() -> None:
    raw = [
        _section(
            "paper-broken",
            words=40,
            byte_start=0,
            body="and the policy implementation continued through the following decade with notable improvements in outcomes that the analysis revealed in detail across multiple chapters.",
        ),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids=set(),
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids={"paper-broken"},
    )
    header_warnings = [w for w in report.boundary_warnings if w.kind == "header_check"]
    assert header_warnings, "body-only section should fail the header check"


def test_orphan_paragraph_before_paper_warns() -> None:
    raw = [
        _section(
            "orphan-prose",
            words=35,
            byte_start=0,
            body="This is a long paragraph of substantial prose that almost certainly belongs with the paper that follows but the boundary detector cut it off as ordinary narrative.",
            splitter_tier="prose_outside_table",
        ),
        _section(
            "paper-after",
            words=40,
            byte_start=35,
            body="Sample Country Report\n\nThis is the actual paper body picking up after the orphan. It covers analysis and conclusions cleanly.",
        ),
    ]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"orphan-prose"},  # routed somewhere; still warns
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids={"paper-after"},
    )
    orphan_warnings = [
        w for w in report.boundary_warnings if w.kind == "orphan_paragraph"
    ]
    assert orphan_warnings, (
        "previous 35-word section should fire the orphan-paragraph warning"
    )


# ---------------------------- wire format ---------------------------------


def test_wire_format_carries_phase3b_fields() -> None:
    raw = [_section("x", words=10, byte_start=0)]
    report = verify_coverage(
        raw_sections=raw,
        bucketed_section_ids={"x"},
        tag_section_ids=set(),
        intro_section_ids=set(),
        cv_section_ids=set(),
        evidence_doc_section_ids=set(),
    )
    d = report.to_dict()
    assert d["bytesTotal"] == 10
    assert d["bytesAssigned"] == 10
    assert d["coveragePercentBytes"] == 100.0
    assert d["skipBreakdown"] == {}
    assert d["boundaryWarnings"] == []
