"""Unit tests for the section splitter (no network, no DB)."""
from __future__ import annotations

from app.splitter.sections import (
    Section,
    sections_total_words,
    split_markdown,
)


def test_splits_on_atx_headings():
    md = (
        "# Introduction\n\nFirst section body about the program.\n\n"
        "## Background\n\nSecond section body.\n\n"
        "## History\n\nThird section body.\n"
    )
    sections = split_markdown(md, doc_id="t")
    assert len(sections) == 3
    assert [s.heading for s in sections] == ["Introduction", "Background", "History"]
    assert sections[0].heading_level == 1
    assert sections[1].heading_level == 2


def test_falls_back_to_semantic_when_no_headings():
    md = " ".join(["word"] * 1500)
    sections = split_markdown(md, doc_id="t")
    assert len(sections) >= 2
    assert all(s.splitter_tier == "semantic" for s in sections)
    assert sections_total_words(sections) >= 1500


def test_detects_table():
    md = (
        "# Curriculum\n\nIntro.\n\n"
        "| Course | Credits |\n|---|---|\n| HS100 | 3 |\n"
    )
    sections = split_markdown(md, doc_id="t")
    assert sections[0].contains_table is True


def test_detects_resume_signals():
    md = (
        "# Faculty\n\nDr. Jane Doe — Curriculum Vitae\n\n"
        "Education:\nPhD, Counseling Psychology, 2010\n\n"
        "Work Experience:\nProfessor, 2010-present\n\n"
        "References available upon request.\n"
    )
    sections = split_markdown(md, doc_id="t")
    assert sections[0].has_resume_signals is True


def test_detects_syllabus_signals():
    md = (
        "# HS 201\n\nCourse syllabus for Introduction to Human Services\n\n"
        "Learning outcomes: students will demonstrate...\n\n"
        "Prerequisites: HS 100\n\n"
        "Credit hours: 3\n"
    )
    sections = split_markdown(md, doc_id="t")
    assert sections[0].has_syllabus_signals is True


def test_byte_offsets_are_consistent():
    md = "# A\n\nBody one.\n\n# B\n\nBody two.\n"
    sections = split_markdown(md, doc_id="t")
    # Concatenating section markdown should reconstruct the original
    # (modulo trailing newlines which split discards).
    reconstructed = "".join(s.markdown for s in sections)
    assert reconstructed.strip() == md.strip()


def test_toc_marker_triggers_toc_tier():
    md = (
        "# Table of Contents\n\n- Introduction\n- Background\n\n"
        "# Introduction\n\nBody.\n\n"
        "# Background\n\nBody.\n\n"
        "# Curriculum\n\nBody.\n"
    )
    sections = split_markdown(md, doc_id="t")
    # TOC tier kicks in when ≥3 body sections detected
    assert len(sections) >= 3
    assert sections[0].splitter_tier == "toc"
