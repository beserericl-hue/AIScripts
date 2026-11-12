"""CSHSE board decision (Nov 2026): the curriculum matrix is REMOVED from the
self-study. A matrix a program still leaves in its upload must never be
indexed — no section, bucket, narrative, evidence item, tag or coverage input,
and no ``matrices`` payload. Ordinary data tables (a faculty roster, a list of
required courses) are still kept as evidence.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from types import SimpleNamespace

import pytest
from docx import Document
from fastapi.testclient import TestClient

from app import import_jobs
from app.import_jobs import JobRecord
from app.matcher.spec_matcher import Recommendation
from app.splitter.curriculum_matrix_exclusion import (
    is_curriculum_matrix_row,
    is_curriculum_matrix_table_html,
    is_curriculum_matrix_title,
)
from app.splitter.deep_walker import deep_walk_with_fallback
from app.splitter.template_walker import walk_template_docx
from app.standards.loader import load_specifications

MATRIX_TITLE = "Matrix Illustrating Relationship of Required Courses to Curriculum Standards"
MATRIX_KEY = "Key: I = Introduced, K = Knowledge, T = Theory, S = Skills; L = Low, M = Medium, H = High"
# Distinctive matrix row labels + course columns (never appear elsewhere).
MATRIX_ROWS = [
    ("11.a Zephyr historical roots of the discipline", ["I,K", "T,M", "K,H", "S,H"]),
    ("11.b Zephyr systems knowledge and theory", ["IKL", "TM", "KSH", "KH"]),
    ("12.a Zephyr interaction of human systems", ["I", "TKM", "", "SH"]),
    ("12.b Zephyr changing human services delivery", ["K,L", "", "T,M", "S,H"]),
    ("13.a Zephyr program planning and evaluation", ["I,L", "K,M", "T,H", "S,H"]),
]
MATRIX_COURSES = ["QXZ 101", "QXZ 210", "QXZ 305", "QXZ 410"]
MATRIX_NEEDLES = ["Zephyr", "QXZ 101", "QXZ 410", MATRIX_TITLE, "I = Introduced"]

ROSTER_HEADER = ["Faculty Name", "Rank", "Highest Degree", "Discipline", "Courses Taught"]
ROSTER_ROWS = [
    ["Dr. Rosalind Okafor", "Professor", "PhD", "Counseling Psychology", "Ethics; Practicum Seminar"],
    ["Marcus Lindqvist", "Lecturer", "MS", "Social Work", "Case Management"],
    ["Priya Ramaswamy", "Associate Professor", "MS", "Human Development", "Lifespan Development"],
    ["Jonah Abernathy", "Instructor", "MS", "Public Administration", "Agency Administration"],
    ["Dr. Elena Varga", "Assistant Professor", "PhD", "Sociology", "Social Problems; Research Methods"],
    ["Theo Mbeki", "Adjunct", "MS", "Addiction Studies", "Substance Abuse Counseling"],
]

NARRATIVE = (
    "The Human Services program prepares competent professionals through a "
    "sequenced curriculum of required courses, supervised field experience and "
    "close faculty advising. Students complete core courses in ethics, case "
    "management, and agency administration before entering the practicum, and "
    "the program reviews the curriculum every year with its advisory committee."
)


def _matrix_html() -> str:
    head = "<tr><th>Specifications</th>" + "".join(f"<th>{c}</th>" for c in MATRIX_COURSES) + "</tr>"
    body = "".join(
        "<tr><td>" + label + "</td>" + "".join(f"<td>{v}</td>" for v in cells) + "</tr>"
        for label, cells in MATRIX_ROWS
    )
    return f"<table>{head}{body}</table>"


def _roster_html() -> str:
    head = "<tr>" + "".join(f"<th>{h}</th>" for h in ROSTER_HEADER) + "</tr>"
    body = "".join("<tr>" + "".join(f"<td>{v}</td>" for v in r) + "</tr>" for r in ROSTER_ROWS)
    return f"<table>{head}{body}</table>"


def _self_study_html() -> bytes:
    return (
        "<html><body>"
        "<h1>Standard 2: Philosophical Base of Programs</h1>"
        f"<p>{NARRATIVE}</p>"
        f"<h2>{MATRIX_TITLE}</h2>"
        f"<p>{MATRIX_KEY}</p>"
        f"{_matrix_html()}"
        "<h2>Faculty Roster</h2>"
        f"{_roster_html()}"
        "</body></html>"
    ).encode("utf-8")


def _self_study_docx(path: str, tabular_template: bool = False) -> None:
    d = Document()
    if tabular_template:
        t = d.add_table(rows=3, cols=2)
        for c in t.rows[0].cells:
            c.text = "Standard 2: The program shall have a philosophical base."
        t.rows[1].cells[0].text = "a."
        t.rows[1].cells[1].text = "Include a mission statement for the program.\nResponse:\n" + NARRATIVE
        t.rows[2].cells[0].text = "e."
        t.rows[2].cells[1].text = "Identify the required courses.\nResponse:\nThe required courses are listed in the catalog."
    else:
        d.add_heading("Standard 2: Philosophical Base of Programs", level=1)
        d.add_paragraph(NARRATIVE)
    d.add_heading(MATRIX_TITLE, level=2)
    d.add_paragraph(MATRIX_KEY)
    m = d.add_table(rows=1 + len(MATRIX_ROWS), cols=1 + len(MATRIX_COURSES))
    m.rows[0].cells[0].text = "Specifications"
    for j, c in enumerate(MATRIX_COURSES, 1):
        m.rows[0].cells[j].text = c
    for i, (label, cells) in enumerate(MATRIX_ROWS, 1):
        m.rows[i].cells[0].text = label
        for j, v in enumerate(cells, 1):
            m.rows[i].cells[j].text = v
    d.add_heading("Faculty Roster", level=2)
    r = d.add_table(rows=1 + len(ROSTER_ROWS), cols=len(ROSTER_HEADER))
    for j, h in enumerate(ROSTER_HEADER):
        r.rows[0].cells[j].text = h
    for i, row in enumerate(ROSTER_ROWS, 1):
        for j, v in enumerate(row):
            r.rows[i].cells[j].text = v
    d.save(path)


def _assert_no_matrix(blob: str) -> None:
    for needle in MATRIX_NEEDLES:
        assert needle not in blob, f"curriculum-matrix content leaked: {needle!r}"


@pytest.fixture
def docx_path():
    f = tempfile.mktemp(suffix=".docx")
    yield f
    if os.path.exists(f):
        os.remove(f)


# --------------------------------------------------------------- unit helpers


def test_helpers_recognise_matrix_only_to_exclude_it():
    assert is_curriculum_matrix_title(MATRIX_TITLE)
    assert is_curriculum_matrix_title("Appendix A6: Curriculum Matrix")
    # A sentence that merely mentions the matrix is prose, not a title.
    assert not is_curriculum_matrix_title("Our faculty revised the old curriculum matrix during the 2024 review cycle.")
    assert is_curriculum_matrix_table_html(_matrix_html())
    assert is_curriculum_matrix_row("Intake interviewing HHH HHMX HHH M M M")
    assert not is_curriculum_matrix_row(NARRATIVE)


def test_roster_and_course_list_are_not_matrices():
    """NEGATIVE: ordinary data tables are never mistaken for a matrix — a
    faculty roster (with 'MS' degree cells) and a plain list of required
    courses (course numbers, no I/K/T/S codes)."""
    assert not is_curriculum_matrix_table_html(_roster_html())
    courses = "<table><tr><th>Course</th><th>Title</th><th>Credits</th></tr>" + "".join(
        f"<tr><td>HUS {n}</td><td>Course {n}</td><td>3</td></tr>" for n in (101, 150, 210, 250, 305, 410)
    ) + "</table>"
    assert not is_curriculum_matrix_table_html(courses)


# ------------------------------------------------------------ walkers (HTML)


def test_html_self_study_matrix_produces_no_section():
    sections = deep_walk_with_fallback(_self_study_html(), base_id="t")
    blob = json.dumps([[s.heading, s.markdown, s.html_snippet] for s in sections])
    _assert_no_matrix(blob)
    # POSITIVE: the narrative and the roster survive.
    assert any("sequenced curriculum of required courses" in s.markdown for s in sections)
    roster = [s for s in sections if "Rosalind Okafor" in s.markdown]
    assert len(roster) == 1 and roster[0].contains_table


# ------------------------------------------------------- walkers (DOCX template)


@pytest.mark.parametrize("tabular", [False, True])
def test_template_docx_matrix_produces_no_section(docx_path, tabular):
    _self_study_docx(docx_path, tabular_template=tabular)
    sections, raw = walk_template_docx(docx_path)
    blob = json.dumps(
        [[s.heading, s.markdown, s.html_snippet] for s in sections]
        + [[r.body_html, r.body_text, r.evidence_tables] for r in raw],
        default=str,
    )
    _assert_no_matrix(blob)
    # POSITIVE: the roster is still carried as an evidence table.
    assert "Rosalind Okafor" in blob


# --------------------------------------------- full self-study import pipeline


class _FakeMatcher:
    """Routes EVERY section it is shown to 2.e with high confidence — so if a
    matrix section ever reached the matcher it would surface in a bucket."""

    def __init__(self, *a, **k):
        pass

    def recommend(self, section, level, institution_id=None):
        is_table = bool(getattr(section, "contains_table", False))
        return Recommendation(
            section_id=section.id,
            section_heading=section.heading,
            primary_standard="2",
            primary_spec="e",
            primary_confidence=0.95,
            alternates=[],
            rationale="fake",
            section_type="supporting_evidence" if is_table else "narrative_response",
            candidates=[],
            doc_letter=None,
            doc_standard_hint=None,
            accept_state="auto_accept",
        )


class _FakeReviewer:
    def __init__(self, *a, **k):
        pass

    def review(self, spec, narrative_text, evidence_items):
        return SimpleNamespace(coverage_score=1.0, is_covered=True, gaps=[], strengths=[])


def test_self_study_import_never_indexes_the_matrix(docx_path, monkeypatch):
    import app.coverage.spec_coverage as cov
    import app.embeddings.openai_client as emb
    import app.embeddings.spec_cache as cache
    import app.matcher.spec_matcher as sm
    import app.vector.qdrant_ops as q

    monkeypatch.setattr(sm, "SpecMatcher", _FakeMatcher)
    monkeypatch.setattr(cov, "CoverageReviewer", _FakeReviewer)
    monkeypatch.setattr(emb, "EmbeddingClient", lambda *a, **k: None)
    monkeypatch.setattr(q, "VectorStore", lambda *a, **k: None)
    monkeypatch.setattr(cache, "bootstrap_spec_cache", lambda *a, **k: None)
    monkeypatch.setattr(import_jobs, "_publish_status", lambda job: None)
    monkeypatch.setattr(import_jobs, "_persist_evidence_docs_to_s3", lambda job, dets: None)

    _self_study_docx(docx_path)
    job = JobRecord(
        job_id="j-mtx", import_id="i-mtx", s3_key="k", submission_id="s-mtx",
        program_level="bachelors", force_format="self_study", callback_url="",
        event_callback_url="", created_at=time.time(), institution_id="inst-1",
    )
    import_jobs._run_self_study_pipeline(job, docx_path)
    snap = job.snapshot()

    assert "matrices" not in snap
    for b in (snap["buckets"] or {}).values():
        assert "matrixCells" not in b
    _assert_no_matrix(json.dumps(snap, default=str))
    assert not any(st["name"] == "matrix_extract" for st in snap["stages"])

    # POSITIVE: the narrative and the roster are still indexed under 2.e.
    b2e = snap["buckets"]["2.e"]
    placed = json.dumps(b2e["narratives"] + b2e["evidenceText"] + b2e["evidenceFiles"])
    assert "sequenced curriculum of required courses" in placed
    assert "Rosalind Okafor" in placed
    # The excluded matrix is not reported as a missing fragment either.
    missing = json.dumps((snap.get("coverageReport") or {}).get("missingFragments") or [])
    _assert_no_matrix(missing)


# ------------------------------------------------------------- MCC appendix


def test_mcc_matrix_appendix_is_dropped():
    from app.splitter.mcc_narrative_walker import (
        MccAppendixEntry,
        MccParseResult,
        MccReference,
        MccStandard,
        _drop_curriculum_matrix_appendices,
    )

    res = MccParseResult(
        standards=[MccStandard(n=11, references=[
            MccReference(kind="file", code="A6", label="Curriculum Matrix", raw="(appendix A6)"),
            MccReference(kind="file", code="B1", label="Faculty CVs", raw="(appendix B1)"),
        ])],
        appendix_catalog=[
            MccAppendixEntry(code="A6", title="Curriculum Matrix", section="A", page_start=10, page_end=12),
            MccAppendixEntry(code="B1", title="Faculty CVs", section="B", page_start=12, page_end=20),
        ],
    )
    _drop_curriculum_matrix_appendices(res)
    assert [e.code for e in res.appendix_catalog] == ["B1"]
    assert [r.code for r in res.standards[0].references] == ["B1"]
    assert "Curriculum Matrix" not in json.dumps(res.to_dict()["appendixCatalog"])


# ----------------------------------------------------------------- endpoints


@pytest.mark.parametrize(
    "path",
    ["/ai/matrix/infer-columns", "/ai/matrix/confirm-column", "/ai/matrix/infer-row-spec", "/ai/matrix/extract"],
)
def test_matrix_endpoints_are_gone(path):
    from app.main import app

    client = TestClient(app)
    assert client.post(path, json={}).status_code == 404


def test_evidence_score_request_has_no_matrix_rows():
    from app.main import EvidenceScoreRequest

    assert "matrixRows" not in EvidenceScoreRequest.model_fields


# ------------------------------------------------------------------ catalogs


@pytest.mark.parametrize("level,rng", [("associate", "11-20"), ("bachelors", "11-20"), ("masters", "11-18")])
def test_spec_2e_no_longer_asks_for_a_matrix(level, rng):
    specs = load_specifications(level)
    s2e = [s for s in specs if s.standard_code == "2" and s.spec_code == "e"]
    assert len(s2e) == 1
    text = s2e[0].spec_text
    assert "matrix" not in text.lower()
    assert text.startswith("Identify the required courses for all students")
    assert f"Curriculum Standards ({rng})" in text
    for s in specs:
        assert "matrix" not in s.spec_text.lower(), f"{level} {s.standard_code}.{s.spec_code}"
