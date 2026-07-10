"""Tests for the MCC narrative walker (third import format).

Pure-function tests run everywhere (CI). The `real_pdf` tests run only when the
16 MB source is present locally (env `MCC_PDF` or the default Downloads path),
so they validate against the actual document without committing it.

Maps to the T-* cases in Engineering/mcc-narrative-import-parser.md.
"""
from __future__ import annotations

import io
import os

import pytest

from app.splitter import mcc_narrative_walker as W


# --------------------------------------------------------------- pure-function


def test_detect_signals_and_verdict():
    text = (
        "Standard #1 The primary program objective shall...\n"
        "Standard #2 ...\n" + "\n".join(f"Standard #{n} x" for n in range(3, 21)) + "\n"
        "Appendix Section A – Program Administration & Institutional Documents\n"
        "(Supporting document: Program Manual appendix G1)\n"
    )
    sig = W.detect_mcc_signals(text)
    assert sig["standard_hash_markers"] == 20
    assert sig["has_appendix_index"] is True
    assert W.is_mcc_narrative(sig) is True
    # A template/free-form doc with no Standard #N markers is NOT mcc.
    assert W.is_mcc_narrative(W.detect_mcc_signals("Standard 1, Specification a\nResponse:")) is False


def test_reference_grammar_file_vs_link():
    # T-20 / T-24 — link (web), not a file.
    link = W.parse_references("blah (Supporting Link: MCC Accreditation Page )")
    assert len(link) == 1 and link[0].kind == "link" and link[0].code is None
    url = W.parse_references("(Supporting Link: https://www.mccneb.edu/programs/human-services)")
    assert url[0].kind == "link" and url[0].url.startswith("https://")


def test_reference_multi_code_and_nospace():
    # T-21 — one parenthetical, six appendix codes, in order.
    raw = (
        "(Supporting documents: Program Manual appendix G1; Advisory Committee Minutes appendix "
        "A7; Internal Program Review appendix A8; Practicum Course Outline appendix C12 and "
        "HMSV2050 Ethics and Professionalism Course Outline appendix C6; Quality Matters objectives "
        "appendix B10)"
    )
    refs = [r for r in W.parse_references(raw) if r.kind == "file"]
    assert [r.code for r in refs] == ["G1", "A7", "A8", "C12", "C6", "B10"]
    # T-22 — no space after "appendix".
    ns = W.parse_references("(Supporting document: Program Manual appendixG1)")
    assert [r.code for r in ns] == ["G1"]
    # labels are trimmed of leading citation punctuation.
    assert refs[0].label.lower().startswith("program manual")


def test_parse_catalog_synthetic():
    page = (
        "Appendix Index\n"
        "Appendix Section A – Program Administration & Institutional Documents\n"
        "Appendix Number Document Title\n"
        "A1 MCC General Education Guide\n"
        "A7 Advisory Committee Minutes\n"
        "25 Fall\n"
        "26 Spring\n"
        "Appendix Section B – Faculty & Personnel\n"
        "Appendix Number Document Title\n"
        "B1 Full-Time Faculty CVs\n"
        "Resume Chandra Petersen\n"
    )
    cat = W.parse_appendix_catalog([page])
    codes = {e.code: e for e in cat}
    assert set(codes) == {"A1", "A7", "B1"}
    assert codes["A7"].sub_documents == ["25 Fall", "26 Spring"]
    assert codes["B1"].sub_documents == ["Resume Chandra Petersen"]
    assert codes["B1"].kind == "cv"


def test_strip_footers():
    t = "MCC Self Study June 2026                   13 \nReal content\n"
    assert "MCC Self Study" not in W.strip_footers(t)
    assert "Real content" in W.strip_footers(t)


def test_intro_false_positive_not_a_heading():
    # "2024. Average GPA…" must NOT be treated as an intro header.
    assert not W.INTRO_HEADER_RE.match("2024. Average current cumulative GPA was 2.34")
    assert W.INTRO_HEADER_RE.match("2. MCC Description")


# --------------------------------------------------------------- real PDF


def _real_pdf_path() -> str | None:
    p = os.environ.get("MCC_PDF") or os.path.expanduser(
        "~/Downloads/Final Self Study June 2026 - Complete_vDRM.pdf"
    )
    return p if os.path.exists(p) else None


real_pdf = pytest.mark.skipif(_real_pdf_path() is None, reason="MCC source PDF not present")


@real_pdf
def test_real_pdf_structure():
    r = W.walk_mcc_pdf(_real_pdf_path())
    # T-01 — exactly 20 standards, numbered 1..20 in order.
    assert [s.n for s in r.standards] == list(range(1, 21))
    # every standard has a section title + a shall-statement.
    assert all(s.section_title for s in r.standards)
    assert all("shall" in s.shall_statement.lower() for s in r.standards)
    # T-70 — the group heading is kept as the section title.
    assert r.standards[0].section_title.startswith("A. Institutional Requirements")


@real_pdf
def test_real_pdf_catalog_and_ranges():
    r = W.walk_mcc_pdf(_real_pdf_path())
    codes = {e.code for e in r.appendix_catalog}
    # T-10 — sections A–G, A4 + B9 absent, reported not errored.
    assert {"A1", "B1", "C1", "D1", "E1", "F1", "G1"}.issubset(codes)
    assert "A4" not in codes and "B9" not in codes
    assert any("A4" in w for w in r.warnings)
    # T-11 — bundled sub-documents.
    a7 = next(e for e in r.appendix_catalog if e.code == "A7")
    assert a7.sub_documents == ["25 Fall", "26 Spring"]
    # T-32 — contiguous ranges; end of one = start of the next (A9 inferred).
    a9 = next(e for e in r.appendix_catalog if e.code == "A9")
    assert a9.page_start is not None and a9.page_end is not None and a9.page_end > a9.page_start


@real_pdf
def test_real_pdf_reference_wiring():
    r = W.walk_mcc_pdf(_real_pdf_path())
    s1 = r.standards[0]
    file_codes = {ref.code for ref in s1.references if ref.kind == "file" and ref.code}
    # T-21 — the 6-code parenthetical resolves under Standard #1.
    assert {"G1", "A7", "A8", "C12", "C6", "B10"}.issubset(file_codes)
    assert any(ref.kind == "link" for ref in s1.references)  # T-60/61


@real_pdf
def test_real_pdf_slice_is_native_pdf():
    from pypdf import PdfReader

    path = _real_pdf_path()
    r = W.walk_mcc_pdf(path)
    a3 = next(e for e in r.appendix_catalog if e.code == "A3")
    data = W.slice_pdf_pages(path, a3.page_start, a3.page_end)
    # T-30 — a real, openable PDF (not text) for the appendix page range.
    sl = PdfReader(io.BytesIO(data))
    assert len(sl.pages) == a3.page_end - a3.page_start
    assert data[:4] == b"%PDF"
