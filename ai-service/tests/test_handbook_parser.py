"""Unit tests for the Handbook parser."""
from __future__ import annotations

from app.standards.handbook_parser import parse_handbook_text


SAMPLE = """
Council for Standards in Human Service Education
NATIONAL STANDARDS
BACCALAUREATE DEGREE IN HUMAN SERVICES

I. GENERAL PROGRAM CHARACTERISTICS A. Institutional Requirements and Primary
Program Objective

Context: Some framing prose that should be skipped.

Standard 1: The primary program objective shall be to prepare human services
professionals to serve individuals, families, groups, communities.

a. The program is part of a degree granting college or university that is regionally accredited.

b. Provide evidence that the development of competent human services professionals is the primary objective of the program.

c. Articulate how students are informed of expectations.

B. Philosophical Base of Programs

Context: Curriculum development integrates specific theories.

Standard 2: The program shall have a clearly defined knowledge base.

Include a mission statement for the program.

Demonstrate alignment with the mission of the units in which the program is housed.

Provide a brief description of the major knowledge base and theories.

C. Community Assessment

Standard 3: The program shall include periodic mechanisms for assessment.

a If the program is less than five years old, provide documentation of community needs.

b An Advisory Committee shall be established to provide feedback.

c Describe other mechanisms used to respond to changing needs.
"""


def test_extracts_correct_number_of_standards():
    specs = parse_handbook_text(SAMPLE)
    standards = sorted({s.standard_code for s in specs}, key=int)
    assert standards == ["1", "2", "3"]


def test_extracts_lettered_subspecs():
    specs = parse_handbook_text(SAMPLE)
    s1 = sorted(s.spec_code for s in specs if s.standard_code == "1")
    assert s1 == ["a", "b", "c"]


def test_assigns_letters_to_bare_paragraphs():
    """Standard 2 has no lettered markers — parser should assign a, b, c."""
    specs = parse_handbook_text(SAMPLE)
    s2 = sorted(s.spec_code for s in specs if s.standard_code == "2")
    assert s2 == ["a", "b", "c"]


def test_handles_bare_letter_marker_no_period():
    """Standard 3 uses 'a ' / 'b ' / 'c ' without periods — parser should handle."""
    specs = parse_handbook_text(SAMPLE)
    s3 = sorted(s.spec_code for s in specs if s.standard_code == "3")
    assert s3 == ["a", "b", "c"]


def test_attaches_standard_title():
    specs = parse_handbook_text(SAMPLE)
    s1 = next(s for s in specs if s.standard_code == "1" and s.spec_code == "a")
    assert "Institutional Requirements" in s1.standard_title


def test_spec_text_is_substantial():
    specs = parse_handbook_text(SAMPLE)
    for s in specs:
        assert len(s.spec_text) > 20, f"spec {s.standard_code}.{s.spec_code} too short"


def test_strips_leading_marker_from_text():
    specs = parse_handbook_text(SAMPLE)
    s1a = next(s for s in specs if s.standard_code == "1" and s.spec_code == "a")
    # The "a." prefix should be gone
    assert not s1a.spec_text.startswith("a.")
    assert not s1a.spec_text.startswith("a ")
    assert "regionally accredited" in s1a.spec_text


def test_program_level_propagates():
    specs = parse_handbook_text(SAMPLE, program_level="bachelors")
    assert all(s.program_level == "bachelors" for s in specs)
