"""Shared fixtures for the cshse-ai test suite.

Live-API tests are gated behind the marker ``live`` and skipped unless the
relevant API keys are present in the environment. Run them with::

    pytest -v -m live

Unit tests run without any external dependency::

    pytest -v -m "not live"
"""
from __future__ import annotations

import os

import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "live: requires live API keys (OPENAI_API_KEY, ANTHROPIC_API_KEY) and network access",
    )
    config.addinivalue_line(
        "markers",
        "mongo: requires MONGO_DEV_URL env var pointing at the dev CSHSE DB",
    )


def pytest_collection_modifyitems(config, items):
    skip_live = pytest.mark.skip(reason="live API keys not set")
    skip_mongo = pytest.mark.skip(reason="MONGO_DEV_URL not set")
    has_openai = bool(os.environ.get("OPENAI_API_KEY"))
    has_anthropic = bool(os.environ.get("ANTHROPIC_API_KEY"))
    has_mongo = bool(os.environ.get("MONGO_DEV_URL"))
    for item in items:
        if "live" in item.keywords and not (has_openai and has_anthropic):
            item.add_marker(skip_live)
        if "mongo" in item.keywords and not has_mongo:
            item.add_marker(skip_mongo)


@pytest.fixture
def stevenson_tagged_sections() -> list[dict]:
    """5 ground-truth sections extracted from the Stevenson University self-study.

    These mirror what we observed in dev Mongo's ``selfstudyimports`` collection
    on 2026-05-16 — each has a human-applied (standardCode, specCode) we can
    measure the matcher's accuracy against.
    """
    return [
        {
            "expected": ("1", "d"),
            "heading": "1.d History of the Program",
            "body": (
                "Provide a brief history of the program. Response: The Family Studies "
                "Program was developed by Dr. Gigi Franyo in 1999 and began accepting "
                "students in Fall 2000. The program was established to address growing "
                "demand for trained human services professionals in the region. Over "
                "the past two decades the program has grown from an initial cohort of "
                "12 students to a current enrollment of 187 across all years."
            ),
        },
        {
            "expected": ("1", "e"),
            "heading": "1.e Student Population",
            "body": (
                "Describe the student population including the number, gender, and "
                "diversity of students, as well as the numbers of full time, part time, "
                "and students graduating each year. Response: The program currently "
                "enrolls 187 students: 142 full-time and 45 part-time. Demographics: "
                "73% female, 27% male; 38% students of color; 24% first-generation. "
                "Graduates per year average 42 over the past five cohorts."
            ),
        },
        {
            "expected": ("1", "f"),
            "heading": "1.f Program Description",
            "body": (
                "Provide a complete program description, courses required, time to "
                "completion, and other program details. Response: The Baccalaureate "
                "in Human Services is a 120-credit-hour program completable in eight "
                "semesters of full-time study. Core requirements: 18 credits of "
                "general education, 42 credits of human services major coursework, "
                "and a 12-credit internship in years three and four."
            ),
        },
        {
            "expected": ("2", "a"),
            "heading": "2.a Philosophical Statement",
            "body": (
                "Provide a succinct philosophical statement that becomes the "
                "conceptual framework for the curriculum. Response: The Counseling "
                "and Human Services program is grounded in a strengths-based, "
                "ecological-systems framework that views clients as embedded in "
                "biological, psychological, social, and cultural contexts. We prepare "
                "students to engage clients as collaborators, focusing on resilience "
                "and capacity rather than deficit."
            ),
        },
        {
            "expected": ("2", "b"),
            "heading": "2.b Knowledge Base",
            "body": (
                "Provide a brief description of the major knowledge base and theories "
                "from which the curriculum draws to support the conceptual framework. "
                "Response: The curriculum draws on counseling theory (humanistic, "
                "cognitive-behavioral, narrative), biopsychosocial framework, "
                "ecological-systems theory, trauma-informed care, motivational "
                "interviewing, and culturally-responsive practice. Students engage "
                "these frameworks across foundation, methods, and capstone courses."
            ),
        },
    ]
