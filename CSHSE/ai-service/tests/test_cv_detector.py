"""CR-033 Phase 2 — cv_detector unit tests.

The detector is deliberately permissive (false positives become
editable Discard cards). These tests pin the recall behavior so future
matcher prompt changes don't accidentally narrow the heuristic.
"""
from __future__ import annotations

import pytest

from app.splitter.cv_detector import (
    CVDetection,
    _is_anchor_line,
    _count_cv_markers,
    cv_to_dict,
    detect_cvs,
)
from app.splitter.sections import Section


def _section(id_: str, markdown: str, offset: int = 0) -> Section:
    return Section(
        id=id_,
        heading="",
        heading_level=0,
        markdown=markdown,
        byte_offset_start=offset,
        byte_offset_end=offset,
        word_count=len(markdown.split()),
        contains_table=False,
        contains_image=False,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="prose_outside_table",
    )


# -------------------------------------------------------------- anchor


@pytest.mark.parametrize(
    "line, expected",
    [
        ("Barry W. Thomas", "Barry W Thomas"),
        ("Susan Johnson", "Susan Johnson"),
        ("Mary Jane O'Brien", "Mary Jane O'Brien"),
        ("Dr. Sarah Williams", "Sarah Williams"),
        ("Prof. Maria del Carmen", "Maria del Carmen"),
        # No: too many tokens
        ("Susan Johnson Williams Thompson III", None),
        # No: not a name (a verb)
        ("Reviews curriculum decisions", None),
        # No: contains Standard
        ("Standard 7 Personnel", None),
        # No: too long
        ("The quick brown fox jumps over the lazy dog yet again every morning", None),
        # No: lowercase
        ("barry thomas", None),
    ],
)
def test_anchor_line_recognition(line: str, expected: str | None) -> None:
    out = _is_anchor_line(line)
    if expected is None:
        assert out is None
    else:
        # Honorific stripping turns "Dr. Sarah Williams" into "Sarah Williams"
        # and similar; punctuation is normalized too.
        assert out and out.replace(".", "") == expected.replace(".", "")


@pytest.mark.parametrize(
    "line, expected_stripped_name",
    [
        # CR-040 follow-on (2026-05-27) — real Stevenson document anchors
        # the pattern detector USED to miss. These tests pin the fix
        # against regression. Diagnostic against the actual deployed
        # Stevenson handbook (via /api/test/inspect-toc) confirmed
        # these are the credential-suffix + ALL-CAPS patterns the
        # detector needs to recognise.

        # Common credentials suffix patterns. Each must reduce to a
        # 2-4 token name so _is_anchor_line returns a non-None
        # stripped form.
        ("Thomas K. Swisher, J.D., Ph.D.", "Thomas K Swisher"),
        ("Mary Beth Olson, M.A.", "Mary Beth Olson"),
        ("Sarah Williams, Ph.D.", "Sarah Williams"),
        ("John Smith, M.S.", "John Smith"),
        ("Jane Doe, LCSW", "Jane Doe"),

        # ALL-CAPS proper name with middle initial — accept.
        ("LAURI A. WEINER", "LAURI A WEINER"),
        ("LAURI A. WEINER, HS-BCP", "LAURI A WEINER"),
        ("LAURI A. WEINER, J.D., HS-BCP", "LAURI A WEINER"),
        ("CHRIS M. JONES, LCPC", "CHRIS M JONES"),
    ],
)
def test_credentials_and_allcaps_anchors(line: str, expected_stripped_name: str) -> None:
    """Anchor-line recognition for real-world CV anchors with credentials
    suffix and/or all-caps names. These were systematically missed by
    the earlier rule (2-4 token + reject-all-caps)."""
    out = _is_anchor_line(line)
    assert out is not None, f"expected {line!r} → name, got None"
    # Compare normalised (punctuation-stripped) so the test isn't
    # picky about whether middle-initial periods survive.
    assert (
        out.replace(".", "").strip() == expected_stripped_name.replace(".", "").strip()
    ), f"_is_anchor_line({line!r}) = {out!r} (expected {expected_stripped_name!r})"


@pytest.mark.parametrize(
    "line",
    [
        # Common CV section headings that LOOK all-caps + 2-4 tokens.
        # The middle-initial guard MUST reject these. A regression here
        # would fragment a real CV into one detection per section
        # heading.
        "EDUCATION",
        "PROFESSIONAL EXPERIENCE",
        "ACADEMIC EMPLOYMENT",
        "TEACHING EXPERIENCE",
        "TEACHING EXPERIENCES",
        "PUBLICATIONS",
        "AWARDS AND HONORS",
        "RESEARCH INTERESTS",
        "PROFESSIONAL DEVELOPMENT",
        "HONORS AND AWARDS",
        # The toc_detector false-positive set — none of these should
        # anchor a CV from the pattern path either.
        "Human Services Club",
        "Honor Society",
        "Professional Expectations",
        "Professional Development Award",
    ],
)
def test_allcaps_section_headings_rejected_as_anchors(line: str) -> None:
    """ALL-CAPS section headings (no middle initial) must NOT anchor a
    CV. Same for topic phrases that aren't person names."""
    # Some of the topic-phrase entries here aren't all-caps but are
    # title-case-only. They should still not anchor a CV because the
    # body context (_is_real_anchor in detect_cvs_from_html) doesn't
    # find CV markers around them. _is_anchor_line itself may return a
    # non-None for some — that's why we go through _is_real_anchor
    # one level up. Here we exercise just _is_anchor_line and check
    # that the ALL-CAPS ones are filtered.
    out = _is_anchor_line(line)
    if line == line.upper() and any(c.isalpha() for c in line):
        # ALL-CAPS path: must be None (no middle initial guard).
        assert out is None, (
            f"_is_anchor_line({line!r}) should reject all-caps section "
            f"heading without a middle initial; got {out!r}"
        )


# -------------------------------------------------------------- markers


def test_section_markers_count_unique() -> None:
    body = """\
Education
PhD, University of Chicago, 2005

Academic Employment
Stanford University, 2005-2010

Education
(this second 'Education' line shouldn't double-count)

Publications
Some paper, 2020
"""
    assert _count_cv_markers(body) == 3  # education + academic employment + publications


# ----------------------------------------------------------- end-to-end


def test_detect_cvs_finds_a_full_cv_section() -> None:
    cv_body = """\
Barry W. Thomas

Education
PhD, Higher Education Leadership, candidacy

Academic Employment
Stevenson University, 2015-present
Coordinator, Human Services Program

Teaching Experiences
HUSR 101 — Intro to Human Services
HUSR 410 — Senior Capstone

Publications
Thomas, B. W. (2019). Field-based learning models. JHS Quarterly.
"""
    secs = [_section("cv-1", cv_body, offset=1000)]
    cvs, residual = detect_cvs(secs)
    assert len(cvs) == 1
    assert cvs[0].faculty_name.startswith("Barry W")
    assert cvs[0].section_marker_count >= 3
    assert cvs[0].byte_offset_start == 1000
    assert residual == []


def test_detect_cvs_skips_narrative_text_with_only_one_marker() -> None:
    body = """\
Susan Johnson

Susan teaches HUSR 220. Her education background includes a B.A.
from Smith College and an M.S.W. from Boston College. She has been
with the department since 2018.
"""
    secs = [_section("narrative", body)]
    cvs, residual = detect_cvs(secs)
    assert cvs == []
    assert len(residual) == 1
    assert residual[0].id == "narrative"


def test_detect_cvs_rejects_section_that_straddles_standard_marker() -> None:
    body = """\
Mary Williams

Education
M.S.W., Boston College

Standard 7 — Personnel
The program coordinator holds a Master's in Counseling.

Publications
Williams, M. (2020). ...
"""
    secs = [_section("mixed", body)]
    cvs, residual = detect_cvs(secs)
    assert cvs == []
    assert len(residual) == 1


def test_detect_cvs_handles_multiple_cvs_in_a_stream() -> None:
    a = _section(
        "cv-a",
        """\
Barry Thomas

Education
PhD candidate, Higher Education

Academic Employment
Stevenson University, 2015-present

Publications
Thomas, B. (2019).
""",
        offset=1000,
    )
    b = _section("narrative", "Some unrelated paragraph about the program.", offset=2000)
    c = _section(
        "cv-c",
        """\
Susan Mitchell

Education
M.S.W., Smith College

Teaching Experiences
HUSR 101

Service
Faculty senate member, 2020-present
""",
        offset=3000,
    )
    cvs, residual = detect_cvs([a, b, c])
    assert {cv.section_id for cv in cvs} == {"cv-a", "cv-c"}
    assert [s.id for s in residual] == ["narrative"]


def test_cv_to_dict_wire_format() -> None:
    cv = CVDetection(
        section_id="cv-1",
        faculty_name="Barry W. Thomas",
        snippet="snippet preview",
        html_snippet="<p>snippet preview</p>",
        byte_offset_start=1000,
        section_marker_count=4,
        section_ids=["cv-1"],
    )
    d = cv_to_dict(cv)
    assert d["sectionId"] == "cv-1"
    assert d["facultyName"] == "Barry W. Thomas"
    assert d["snippet"] == "snippet preview"
    assert d["byteOffsetStart"] == 1000
    assert d["routing"] == {"source": "matcher"}
    assert d["sectionMarkerCount"] == 4
