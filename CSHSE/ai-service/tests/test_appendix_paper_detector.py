"""CR-040 Phase 2b — appendix_paper_detector tests."""
from __future__ import annotations

import pytest

from app.splitter.appendix_paper_detector import (
    EvidenceDocDetection,
    detect_evidence_docs,
    evidence_doc_to_dict,
)
from app.splitter.sections import ImageRef, Section


def _section(
    id_: str,
    body: str,
    *,
    heading: str = "",
    word_count: int | None = None,
    images: list[ImageRef] | None = None,
    offset: int = 0,
) -> Section:
    return Section(
        id=id_,
        heading=heading,
        heading_level=2,
        markdown=body,
        byte_offset_start=offset,
        byte_offset_end=offset,
        word_count=word_count if word_count is not None else len(body.split()),
        contains_table=False,
        contains_image=bool(images),
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="prose_outside_table",
        images=images or [],
    )


# ---------------------------------------------------------------- paper


def test_detects_a_research_paper_with_points_suffix() -> None:
    body = (
        "RESEARCH PAPER (Individual Work) (125 points)\n"
        "CHS 220 Spring 2019\n\n"
        + ("South Korea is a country in East Asia. " * 60)
    )
    sec = _section("paper-1", body, offset=1000)
    docs, residual = detect_evidence_docs([sec])
    assert len(docs) == 1
    d = docs[0]
    assert d.doc_sub_kind == "paper"
    assert d.points == 125
    assert d.page_count_estimate >= 1
    assert residual == []


def test_detects_a_titled_paper_without_points() -> None:
    body = (
        "Sample Country Report\n\n"
        + ("South Korea has a population of about 51 million people. " * 50)
    )
    sec = _section("paper-2", body)
    docs, _ = detect_evidence_docs([sec])
    assert len(docs) == 1
    assert docs[0].doc_sub_kind == "paper"
    assert "Sample Country Report" in docs[0].title


def test_paper_requires_minimum_body_length() -> None:
    """A title alone is not enough — must have ≥200 words OR ≥1 image."""
    body = "Sample Country Report\n\nShort body."
    sec = _section("too-short", body)
    docs, residual = detect_evidence_docs([sec])
    assert docs == []
    assert residual[0].id == "too-short"


def test_paper_with_image_bypasses_word_count_threshold() -> None:
    body = "Sample Country Report\n\nA short body with one image attached."
    sec = _section(
        "paper-with-img",
        body,
        word_count=20,
        images=[
            ImageRef(
                mime="image/png",
                byte_offset=0,
                data_base64="abc",
                alt_text="Map of Korea",
            )
        ],
    )
    docs, _ = detect_evidence_docs([sec])
    assert len(docs) == 1
    assert docs[0].image_count == 1


# ------------------------------------------------------------- syllabus


def test_detects_a_syllabus_with_course_code_and_keyword() -> None:
    body = (
        "CHS 105 - Introduction to Human Services\n"
        "Course Syllabus - Fall 2024\n\n"
        + ("Learning outcomes: students will be able to ... " * 50)
    )
    sec = _section("syl-1", body, heading="CHS 105 - Intro to Human Services")
    docs, _ = detect_evidence_docs([sec])
    assert len(docs) == 1
    assert docs[0].doc_sub_kind == "syllabus"
    assert docs[0].course_code == "CHS 105"


def test_syllabus_keyword_without_course_code_does_not_fire() -> None:
    body = (
        "Some narrative about course outcomes and prerequisites and "
        "credit hours sprinkled throughout, but no course code anywhere "
        "in the heading or the first ten lines of body. "
    ) * 10
    sec = _section("not-syl", body)
    docs, _ = detect_evidence_docs([sec])
    assert docs == []


def test_course_code_without_syllabus_keyword_does_not_fire() -> None:
    body = "CHS 220 was offered in Spring 2019. " * 40
    sec = _section("just-mention", body)
    docs, _ = detect_evidence_docs([sec])
    assert docs == []


# ----------------------------------------------------- stream behaviour


def test_residual_is_input_minus_detected() -> None:
    a = _section(
        "narrative",
        "Some plain narrative text with no paper or syllabus markers. " * 50,
    )
    b = _section(
        "paper",
        "Research Paper (Individual Work) (75 points)\n\n"
        + ("CHS 220 Spring 2019. " * 50),
    )
    docs, residual = detect_evidence_docs([a, b])
    assert {d.section_id for d in docs} == {"paper"}
    assert [s.id for s in residual] == ["narrative"]


def test_evidence_doc_to_dict_wire_format() -> None:
    doc = EvidenceDocDetection(
        section_id="d1",
        doc_sub_kind="paper",
        title="Sample Country Report",
        summary="snippet",
        byte_offset_start=1000,
        page_count_estimate=12,
        image_count=2,
        course_code=None,
        points=125,
    )
    d = evidence_doc_to_dict(doc)
    assert d["sectionId"] == "d1"
    assert d["docSubKind"] == "paper"
    assert d["pageCountEstimate"] == 12
    assert d["imageCount"] == 2
    assert d["points"] == 125
    assert d["courseCode"] is None
