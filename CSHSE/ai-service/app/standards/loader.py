"""Standards / Specifications data loader.

Source of truth: the CSHSE Member Handbook PDFs referenced by ``specs``
collection in MongoDB (one per program level: associate / bachelors / masters).

The full text of each Standard's Specifications lives in those PDFs, not in
structured Mongo fields. Production should parse them into the registry below
on spec-upload. For Sprint 1 MVP we ship a hand-curated subset of
Baccalaureate Standards 1 and 2 (sufficient to validate the matcher against
Stevenson's tagged sections).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ProgramLevel = Literal["associate", "bachelors", "masters"]


@dataclass(frozen=True)
class Specification:
    """One (standard, spec) pair with its prose definition from the Handbook."""
    standard_code: str
    spec_code: str
    standard_title: str
    spec_text: str
    program_level: ProgramLevel
    version: str = "2025"


# Baccalaureate Standards 1 + 2 — hand-curated from CSHSE Member Handbook
# Revised July 2025 (matches the spec version in Stevenson's data).
# Production replaces this with PDF parsing at spec-upload time.
BACCALAUREATE_SAMPLE: list[Specification] = [
    Specification(
        standard_code="1",
        spec_code="a",
        standard_title="Program Context",
        spec_text=(
            "Provide the name and location of the institution sponsoring the "
            "human services program, the institution's mission, and the "
            "institution's accreditation status."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="1",
        spec_code="b",
        standard_title="Program Context",
        spec_text=(
            "Describe the structural location of the human services program "
            "within the institution (department, school, college) and its "
            "reporting lines."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="1",
        spec_code="c",
        standard_title="Program Context",
        spec_text=(
            "Describe the relationship of the human services program to other "
            "academic units and any interdisciplinary collaborations."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="1",
        spec_code="d",
        standard_title="Program Context",
        spec_text=(
            "Provide a brief history of the program — when it was established, "
            "the founders, key milestones in its development, and significant "
            "changes over time."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="1",
        spec_code="e",
        standard_title="Program Context",
        spec_text=(
            "Describe the student population, including the number, gender, "
            "and diversity of students, as well as the numbers of full-time, "
            "part-time, and graduating students per year."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="1",
        spec_code="f",
        standard_title="Program Context",
        spec_text=(
            "Provide a complete program description: courses required, time "
            "to completion, modalities of delivery, and other program details."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="2",
        spec_code="a",
        standard_title="Program Philosophy",
        spec_text=(
            "Provide a succinct philosophical statement that becomes the "
            "conceptual framework for the curriculum, articulating the "
            "program's view of human services practice."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="2",
        spec_code="b",
        standard_title="Program Philosophy",
        spec_text=(
            "Provide a brief description of the major knowledge base and "
            "theories from which the curriculum draws to support the "
            "conceptual framework (counseling theories, biopsychosocial, "
            "ecological systems, strengths-based, etc.)."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="2",
        spec_code="c",
        standard_title="Program Philosophy",
        spec_text=(
            "Describe how the program's philosophy is operationalized through "
            "curriculum design, teaching methods, and student-learning "
            "experiences."
        ),
        program_level="bachelors",
    ),
    # Curriculum standards (excerpt — full Handbook has 21 standards)
    Specification(
        standard_code="11",
        spec_code="a",
        standard_title="Curriculum",
        spec_text=(
            "Provide a curriculum matrix demonstrating how each Specification "
            "in Standard 11 is addressed by required courses, with course "
            "numbers, content type (Introduce / Teach / Knowledge / Skill), "
            "and depth (Low / Medium / High)."
        ),
        program_level="bachelors",
    ),
    Specification(
        standard_code="11",
        spec_code="b",
        standard_title="Curriculum",
        spec_text=(
            "Describe the required introductory material covering history, "
            "scope, and ethical foundations of human services practice."
        ),
        program_level="bachelors",
    ),
]


def load_specifications(program_level: ProgramLevel) -> list[Specification]:
    """Return the active Specification list for a program level.

    Baccalaureate: returns the full 99-spec ``BACCALAUREATE_2025`` dataset
    parsed from the official CSHSE Handbook PDF.

    Associate / Master's: TODO — same parser, different PDF (planned for
    Sprint 1 follow-up).
    """
    if program_level == "bachelors":
        # Import lazily so the (parsed) data file is only loaded when needed.
        from app.standards.baccalaureate_2025 import BACCALAUREATE_2025

        return BACCALAUREATE_2025
    if program_level == "associate":
        # The Associate degree is NOT Baccalaureate 1-20: it has 20 standards but
        # the tail curriculum standards differ (Std 18 = KTSV a-h, Std 19 = KTSV
        # a-e, Std 20 = Field Experience a-j), because the Baccalaureate inserts an
        # extra curriculum standard that shifts the numbering. Deriving from a bacc
        # slice dropped the real associate specs (18.f-h, 20.f-j) so the coverage
        # reviewer silently skipped them ("Check coverage" assessed 0). Use the
        # authoritative per-level catalog generated from standardsByLevel.json.
        from app.standards.associate_2025 import ASSOCIATE_2025

        return ASSOCIATE_2025
    if program_level == "masters":
        from app.standards.masters_2025 import MASTERS_2025

        return MASTERS_2025
    return []
