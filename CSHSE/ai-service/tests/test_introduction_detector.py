"""CR-039 Phase 2a — introduction-detector tests.

Locks in the heading-based recall behavior so a future matcher prompt
extension (Phase 2b) doesn't accidentally narrow what counts as an
intro candidate.
"""
from __future__ import annotations

import pytest

from app.splitter.introduction_detector import (
    detect_introductions,
    is_introduction_heading,
    routing_hint_for_section,
)
from app.splitter.sections import Section


def _section(id_: str, heading: str, body: str = "") -> Section:
    return Section(
        id=id_,
        heading=heading,
        heading_level=2,
        markdown=body or heading,
        byte_offset_start=0,
        byte_offset_end=0,
        word_count=len((body or heading).split()),
        contains_table=False,
        contains_image=False,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="prose_outside_table",
    )


@pytest.mark.parametrize(
    "heading, expected",
    [
        ("Introduction", True),
        ("INTRODUCTION", True),
        ("Standard 2 — Introduction", True),
        ("Overview", True),
        ("Mission Statement", True),
        ("About the Program", True),
        ("About the School", True),
        ("Terms", True),
        ("Glossary of Terms", True),
        ("Preface", True),
        ("Foreword", True),
        # NOT intros:
        ("Standard 1.a Institutional Requirements", False),
        ("Curriculum Matrix", False),
        ("Course Catalog", False),
        ("Personnel — Faculty Credentials", False),
        ("", False),
    ],
)
def test_is_introduction_heading(heading: str, expected: bool) -> None:
    assert is_introduction_heading(heading) is expected


def test_routing_hint_document_level() -> None:
    sec = _section("s1", "Introduction", body="Welcome to Stevenson University.")
    assert routing_hint_for_section(sec) == "introduction:document"


def test_routing_hint_standard_level_from_heading() -> None:
    sec = _section(
        "s2",
        "Standard 2 — Introduction",
        body="The philosophical base of our program ...",
    )
    assert routing_hint_for_section(sec) == "introduction:standard-2"


def test_routing_hint_standard_level_from_body_when_heading_silent() -> None:
    sec = _section(
        "s3",
        "Introduction",
        body="Standard 7. The personnel of the program include ...",
    )
    assert routing_hint_for_section(sec) == "introduction:standard-7"


def test_routing_hint_falls_back_to_document_when_no_std_match() -> None:
    sec = _section(
        "s4",
        "Mission",
        body="Our mission is to graduate human services professionals.",
    )
    assert routing_hint_for_section(sec) == "introduction:document"


def test_routing_hint_returns_none_for_non_intro_section() -> None:
    sec = _section(
        "s5",
        "Standard 1.a Institutional Requirements",
        body="Stevenson University is regionally accredited by ...",
    )
    assert routing_hint_for_section(sec) is None


def test_detect_introductions_returns_id_to_hint_map() -> None:
    sections = [
        _section("intro-doc", "Introduction", body="Welcome to Stevenson."),
        _section(
            "intro-std-3",
            "Standard 3 — Overview",
            body="Standard 3 covers the philosophical base ...",
        ),
        _section(
            "spec-1-a",
            "1.a Institutional Requirements",
            body="Stevenson is a regionally accredited institution.",
        ),
        _section("intro-mission", "Mission", body="Our mission is to ..."),
    ]
    out = detect_introductions(sections)
    assert out == {
        "intro-doc": "introduction:document",
        "intro-std-3": "introduction:standard-3",
        "intro-mission": "introduction:document",
    }


def test_detects_intro_when_heading_is_in_body_first_line() -> None:
    # deep_walker's prose_outside_table path uses the first ~120 chars of
    # body as the heading. For these sections the intro signal lives in
    # the body's first line, not the heading slot.
    sec = _section(
        "prose-1",
        heading="Welcome — Stevenson University's Human Services Program",
        body="Introduction\n\nThe Human Services Program at Stevenson serves ...",
    )
    assert routing_hint_for_section(sec) == "introduction:document"
