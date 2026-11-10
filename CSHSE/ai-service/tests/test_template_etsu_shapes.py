"""Official tabular template, ETSU shapes (East Tennessee State, Nov 2026).

ETSU answered the official CSHSE standards document IN ITS TABLES but:
  * never wrote "Response:" — the detector called it a free-form self-study;
  * tagged course evidence inline: "Standard 13: a (IKS-H)" — each read as a
    Standard ROOT, emptying the specs into the Standard introductions;
  * Standard 2 rows carry NO letters; Standard 3 letters are INLINE ("a If …");
  * a table holds 14.d and then the Standard 15 header (letters in column 2);
  * 1.e is answered only with NESTED tables;
  * "II. CURRICULUM: …" part header bled onto 10.b.
"""
from __future__ import annotations

import pytest
from docx import Document

from app.splitter.format_detector import detect_format
from app.splitter.template_walker import walk_template_docx, _is_std_citation


def _set(cell, text):
    """One PARAGRAPH per line (cell.text = "a\nb" makes a single paragraph)."""
    lines = text.split("\n")
    cell.text = lines[0]
    for line in lines[1:]:
        cell.add_paragraph(line)


def _std_table(doc, header, rows, cols=2):
    t = doc.add_table(rows=1 + len(rows), cols=cols)
    t.rows[0].cells[0].merge(t.rows[0].cells[cols - 1]).text = header
    for i, (marker, content) in enumerate(rows, start=1):
        cells = t.rows[i].cells
        if cols == 4:
            _set(cells[1], marker)
            _set(cells[2], content)
        else:
            _set(cells[0], marker)
            _set(cells[cols - 1], content)
    return t


@pytest.fixture()
def etsu_docx(tmp_path):
    doc = Document()
    doc.add_paragraph("Council for Standards in Human Service Education")
    doc.add_paragraph("I. GENERAL PROGRAM CHARACTERISTICS A. Institutional Requirements")
    doc.add_paragraph("Context: There is a strong national commitment…")
    t1 = _std_table(doc, "Standard 1: The primary program objective shall be to prepare professionals.", [
        ("a.", "The program is part of a degree granting college.\nETSU is regionally accredited by SACSCOC."),
        ("e.", "Describe the student population.\n"),
    ])
    nested = t1.rows[2].cells[1].add_table(rows=2, cols=2)
    nested.rows[0].cells[0].text = "Female"
    nested.rows[0].cells[1].text = "88%"
    doc.add_paragraph("B. Philosophical Base of Programs")
    doc.add_paragraph("Context: A benchmark of human services education…")
    _std_table(doc, "Standard 2: The program shall have a clearly defined knowledge base.", [
        ("", "Include a mission statement for the program.\nOur mission is to prepare helpers."),
        ("", "Demonstrate alignment with the mission of the units.\nAligned with the college mission."),
    ])
    doc.add_paragraph("C. Community Assessment")
    _std_table(doc, "Standard 3: The program shall include periodic mechanisms for assessment.", [
        ("", "a If the program is less than five years old, provide documentation.\nNot applicable — founded 1998."),
    ], cols=3)
    cont = doc.add_table(rows=2, cols=2)
    _set(cont.rows[0].cells[1], "b An Advisory Committee shall be established.\nOur committee meets each semester.")
    _set(cont.rows[1].cells[1], "c Describe other mechanisms.\nAlumni surveys every spring.")
    _std_table(doc, "Standard 10: Each program shall articulate transfer policies.", [
        ("a.", "Describe formal policies.\nWe follow TBR transfer policy."),
        ("b.", "Describe how students receive this information.\nAdvisors and the catalog."),
    ])
    doc.add_paragraph("II. CURRICULUM: BACCALAUREATE DEGREE")
    doc.add_paragraph("A. Knowledge, Theory, Skills, and Values")
    doc.add_paragraph("Context: The history of human services…")
    _std_table(doc, "Standard 14: The curriculum shall provide knowledge and skills in information management.", [
        ("a.", "Obtain, synthesize, and report information.\nStandard 14: a (IK-M)\nSRVL 1020 students write a research summary."),
    ])
    t = doc.add_table(rows=4, cols=4)
    t.rows[0].cells[1].text = "d."
    _set(t.rows[0].cells[2], "Using technology, including AI.\nStandard 14: d (IKS-M)\nStudents evaluate AI output.")
    t.rows[1].cells[1].merge(t.rows[1].cells[2]).text = "Standard 15: The curriculum shall provide knowledge and skill development in systematic analysis."
    t.rows[2].cells[1].text = "a."
    _set(t.rows[2].cells[2], "Knowledge and skills to analyze needs.\nHDAL 3510 needs assessment project.")
    t.rows[3].cells[1].text = "b."
    _set(t.rows[3].cells[2], "Skills to develop goals.\nStandard 15: b (KS; M), c (S; M)\nService plan assignment.")
    for n in range(16, 22):
        _std_table(doc, f"Standard {n}: The program shall do item {n}.", [
            ("a.", f"Prompt {n}a.\nAnswer {n}a."),
            ("b.", f"Prompt {n}b.\nAnswer {n}b."),
        ])
    p = tmp_path / "etsu_like.docx"
    doc.save(p)
    return str(p)


def _specs(path):
    sections, _ = walk_template_docx(path)
    out: dict[tuple[str, str], str] = {}
    for s in sections:
        f = s.flags
        if f.get("templateSpecHint"):
            out[(f["templateStandardHint"], f["templateSpecHint"])] = out.get((f["templateStandardHint"], f["templateSpecHint"]), "") + s.markdown
    intros = {f.get("templateIntroductionHint"): s.markdown for s in sections for f in [s.flags] if f.get("templateIntroductionHint")}
    return out, intros


def test_detects_official_template_without_response_markers(etsu_docx):
    v = detect_format(etsu_docx)
    assert v.format == "template", v.reasoning
    assert v.signals["response_marker_count"] == 0


def test_inline_course_citations_are_not_standard_roots(etsu_docx):
    specs, intros = _specs(etsu_docx)
    assert "research summary" in specs[("14", "a")]
    assert "research summary" not in intros.get("introduction:standard-14", "")
    assert "Service plan assignment" in specs[("15", "b")]


def test_citation_regex():
    assert _is_std_citation("Standard 13: a (IKS-H)")
    assert _is_std_citation("Standard 13:  b (K, S; H)")
    assert _is_std_citation("Standard 19: a (S; M), b (S; M), c (S; H)")
    assert _is_std_citation("Standard 12: (KS; M)")
    assert _is_std_citation("Standard 12: F (IKS-M)")
    assert not _is_std_citation("Standard 4: The program shall conduct evaluations")
    assert not _is_std_citation("Standard 7: A program shall manage roles")
    assert not _is_std_citation("Standard 19:")


def test_letterless_standard_rows_are_specs_in_order(etsu_docx):
    specs, _ = _specs(etsu_docx)
    assert "prepare helpers" in specs[("2", "a")]
    assert "college mission" in specs[("2", "b")]


def test_inline_letters_and_headerless_continuation(etsu_docx):
    specs, _ = _specs(etsu_docx)
    assert "founded 1998" in specs[("3", "a")]
    assert "meets each semester" in specs[("3", "b")]
    assert "Alumni surveys" in specs[("3", "c")]


def test_nested_table_answer_is_kept(etsu_docx):
    specs, _ = _specs(etsu_docx)
    assert "88%" in specs[("1", "e")]


def test_second_header_mid_table_and_letters_in_column_two(etsu_docx):
    specs, _ = _specs(etsu_docx)
    assert "evaluate AI output" in specs[("14", "d")]
    assert "needs assessment project" in specs[("15", "a")]
    assert ("15", "d") not in specs


def test_part_header_does_not_bleed_onto_previous_spec(etsu_docx):
    specs, _ = _specs(etsu_docx)
    assert "II. CURRICULUM" not in specs[("10", "b")]
    assert "Advisors and the catalog" in specs[("10", "b")]
