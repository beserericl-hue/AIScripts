"""Offline tests for the input-format sniff function.

Covers:
  - template title in the head → template, high confidence
  - many Response: markers + template headings → template, medium confidence
  - free-form self-study shape → self_study, default confidence
  - explicit self-study signals (Appendix, Faculty CVs, Curriculum
    Matrix) raise self_study confidence
  - empty / pathological inputs don't crash
"""
from __future__ import annotations

from app.splitter.format_detector import (
    FormatDetection,
    detect_format_from_paragraphs,
)


def _ksu_like_paragraphs() -> list[str]:
    """Simplified facsimile of the Kennesaw State template DOCX head + body."""
    return [
        "Council for Standards in Human Service Education",
        "Self-Study Template",
        "BACCALAUREATE DEGREE IN HUMAN SERVICES",
        "",
        "June 2025",
        "Introduction and Instructions: This template is required.",
        "",
        "TABLE OF CONTENTS",
        "Required Self-Study Introductory Information",
        "",
        "1. Specify the degree(s) offered for which accreditation is being sought.",
        "Response:",
        "Bachelor of Science in Human Services.",
        "2a. Describe the organizational structure, age of institution, brief history.",
        "Response:",
        "Kennesaw State is governed by the Board of Regents.",
        "2b. Describe the institutional context of the program.",
        "Response:",
        "KSU offers 90 undergraduate degrees.",
        "3a. Briefly describe the strengths of the Program.",
        "Response:",
        "The program emphasizes experiential learning.",
        "4a. Include a copy of the VPA letter.",
        "Response:",
        "Not applicable.",
    ]


def _stevenson_like_paragraphs() -> list[str]:
    """Simplified facsimile of a finished free-form self-study (no Response: markers)."""
    return [
        "Stevenson University",
        "2024 CSHSE Self-Study",
        "Counseling & Human Services Program",
        "Bachelor of Science",
        "",
        "Table of Contents",
        "Introduction",
        "The Counseling & Human Services Program was developed by Dr. Franyo in 1999.",
        "Standard 1: Institutional Requirements",
        "a. The program is part of Stevenson University, which is regionally accredited by MSCHE.",
        "b. The primary objective of the program is to prepare competent human services professionals.",
        "Standard 2: Program Description",
        "The program operates within the Counseling & Human Services Department.",
        "Curriculum Matrix",
        "Appendix",
        "Standard 1",
        "Faculty CVs",
        "John Rosicky, Department Chair",
        "Faculty Handbook excerpt",
    ]


# ---------------------------------------------------------------- template


def test_template_title_in_head_returns_high_confidence_template():
    det = detect_format_from_paragraphs(_ksu_like_paragraphs())
    assert det.format == "template"
    assert det.confidence >= 0.90
    assert det.signals["template_title_in_head"] is True


def test_template_detection_signals_are_populated():
    det = detect_format_from_paragraphs(_ksu_like_paragraphs())
    # The KSU facsimile has multiple Response: markers and template headings
    assert det.signals["response_marker_count"] >= 4
    assert det.signals["template_heading_count"] >= 4


def test_response_markers_plus_template_headings_without_title_still_template():
    """Even without the title-page string, enough structural signals
    should produce a template verdict at slightly lower confidence."""
    paras = [
        "Some intro paragraph that doesn't mention the title",
        "1. Specify the degree(s)",
        "Response:",
        "Bachelor of Science",
        "2a. Describe the institution",
        "Response:",
        "KSU is in Georgia",
        "2b. Describe the program",
        "Response:",
        "We have three concentrations",
        "3a. Strengths",
        "Response:",
        "Strong field placements",
        "3b. Course requirements",
        "Response:",
        "All majors take CHS 101",
    ]
    det = detect_format_from_paragraphs(paras)
    assert det.format == "template"
    assert det.confidence >= 0.80
    assert det.signals["template_title_in_head"] is False
    assert det.signals["response_marker_count"] >= 5
    assert det.signals["template_heading_count"] >= 5


# ---------------------------------------------------------------- self_study


def test_stevenson_like_paragraphs_detected_as_self_study():
    det = detect_format_from_paragraphs(_stevenson_like_paragraphs())
    assert det.format == "self_study"
    # No template signals
    assert det.signals["template_title_in_head"] is False
    assert det.signals["response_marker_count"] == 0


def test_self_study_signals_raise_confidence():
    """Curriculum Matrix / Appendix / Faculty CVs / Faculty Handbook
    headings should bump confidence above the bare-default 0.70."""
    det = detect_format_from_paragraphs(_stevenson_like_paragraphs())
    assert det.format == "self_study"
    # The facsimile has at least 3 self-study headings
    assert det.signals["self_study_heading_count"] >= 3
    assert det.confidence > 0.70


def test_self_study_confidence_capped_at_0_90():
    paras = ["Curriculum Matrix"] * 50 + ["Appendix"] * 50
    det = detect_format_from_paragraphs(paras)
    assert det.confidence <= 0.90


# ---------------------------------------------------------------- edge cases


def test_empty_document_defaults_to_self_study_low_signals():
    det = detect_format_from_paragraphs([])
    assert det.format == "self_study"
    assert det.signals["total_paragraphs"] == 0
    assert det.signals["response_marker_count"] == 0


def test_only_blank_paragraphs():
    det = detect_format_from_paragraphs(["", "   ", "\t", ""])
    assert det.format == "self_study"
    assert det.signals["response_marker_count"] == 0


def test_few_response_markers_alone_not_enough_for_template():
    """A real self-study might mention 'Response:' a couple of times in
    prose. Don't false-positive into template format on those alone."""
    paras = [
        "The faculty's response: we trained students more carefully.",
        "Another paragraph.",
        "Response: a third edge case in prose.",
        "Just two Response: lines isn't a template signal.",
    ]
    det = detect_format_from_paragraphs(paras)
    # response_count is 3 but template_heading_count is 0 → still self_study
    assert det.format == "self_study"
