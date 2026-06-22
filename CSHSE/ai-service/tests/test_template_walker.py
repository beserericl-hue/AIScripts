"""Offline tests for the CSHSE Self-Study Template walker.

Covers:
  - canonical heading forms (``1.``, ``2a.``, ``11.b``, ``Standard 1, Specification a``)
  - ``Response:`` marker stripping
  - placeholder detection (Not applicable, TBD, See Appendix-only, empty body)
  - front-matter filtering (TOC, Introduction & Instructions)
  - body accumulation across multiple paragraphs
  - hint extraction (std + spec from heading)
"""
from __future__ import annotations

from app.splitter.template_walker import (
    walk_template_paragraphs,
    walk_template_docx,
    _is_placeholder,
    _match_heading,
)


def _texts(*paragraphs: str) -> list[str]:
    return list(paragraphs)


# ---------------------------------------------------------------- heading match


def test_match_heading_canonical_dotted_spec():
    assert _match_heading("1.a Provide…") == ("1", "a")
    assert _match_heading("11.b Describe…") == ("11", "b")


def test_match_heading_template_intro_form():
    assert _match_heading("2a. Describe the organizational structure") == ("2", "a")
    assert _match_heading("4c.  Describe any major program changes") == ("4", "c")


def test_match_heading_full_standard_specification_form():
    assert _match_heading("Standard 1, Specification a. The program is…") == ("1", "a")
    assert _match_heading("Standard 16 Specification b") == ("16", "b")
    assert _match_heading("Standard 12b. Small Groups") == ("12", "b")


def test_match_heading_standard_root_no_spec():
    assert _match_heading("1. Specify the degree(s)…") == ("1", None)
    assert _match_heading("Standard 1") == ("1", None)


def test_match_heading_section_letter_no_std():
    # "A. Required Self-Study Introductory Material" — section letter is
    # template-structural, not a Handbook standard hint.
    result = _match_heading("A. Required Self-Study Introductory Material")
    assert result is not None
    std, spec = result
    assert std is None  # no numeric std hint from a letter-prefix heading


def test_match_heading_rejects_body_paragraphs():
    assert _match_heading("KSU is governed by The Board of Regents…") is None
    assert _match_heading("Response:") is None
    assert _match_heading("See Appendix I") is None
    assert _match_heading("Not applicable") is None


def test_match_heading_skips_frontmatter():
    # Front-matter headings ARE cuts but emit no hints.
    assert _match_heading("Table of Contents") == (None, None)
    assert _match_heading("Introduction and Instructions: this template…") == (None, None)


# ---------------------------------------------------------------- placeholder


def test_placeholder_empty_body():
    assert _is_placeholder([]) is True
    assert _is_placeholder(["   ", ""]) is True


def test_placeholder_not_applicable():
    assert _is_placeholder(["Not applicable"]) is True
    assert _is_placeholder(["N/A"]) is True
    assert _is_placeholder(["TBD"]) is True


def test_placeholder_only_appendix_pointer():
    """A body that is JUST a 'See Appendix' line — no authored prose — is a placeholder.

    Reason: those pointers tell the institution where evidence will go,
    but until prose is written under the heading, the section is
    effectively unfilled.
    """
    assert _is_placeholder(["See Appendix I — #2 Map of Marietta Campus"]) is True


def test_not_placeholder_when_response_present():
    assert _is_placeholder(["The program was founded in 1999 by Dr. Franyo…"]) is False


def test_not_placeholder_when_appendix_pointer_plus_prose():
    body = [
        "See Appendix I — #1 Map of Kennesaw Campus",
        "KSU is a public research university with two campuses in Kennesaw and Marietta.",
    ]
    assert _is_placeholder(body) is False


# ---------------------------------------------------------------- walker


def test_walker_cuts_on_heading_and_accumulates_body():
    paras = _texts(
        "1. Specify the degree(s) offered",
        "Response:",
        "Bachelor of Science in Human Services.",
        "Accredited since 2004.",
        "2a. Describe the organizational structure",
        "Response:",
        "KSU is governed by the Board of Regents.",
    )
    sections = walk_template_paragraphs(paras)
    assert len(sections) == 2

    assert sections[0].heading.startswith("1. ")
    assert sections[0].standard_hint == "1"
    assert sections[0].spec_hint is None
    assert "Bachelor of Science in Human Services." in sections[0].body_text
    assert "Accredited since 2004." in sections[0].body_text
    # Response: marker should be stripped from the body
    assert "Response:" not in sections[0].body_text
    assert sections[0].placeholder is False

    assert sections[1].standard_hint == "2"
    assert sections[1].spec_hint == "a"
    assert "Board of Regents" in sections[1].body_text


def test_walker_marks_empty_section_as_placeholder():
    paras = _texts(
        "5a. Describe the physical location",
        "Response:",
        "",
        "5b. Describe the student population",
        "Response:",
        "The student population is 80% commuter.",
    )
    sections = walk_template_paragraphs(paras)
    assert len(sections) == 2
    assert sections[0].placeholder is True   # empty body
    assert sections[1].placeholder is False  # has real content


def test_walker_marks_not_applicable_as_placeholder():
    paras = _texts(
        "5. If the Program is delivered at multiple sites:",
        "Response:",
        "Not applicable",
        "6. Hybrid or Online Course Delivery",
        "Response:",
        "Not applicable",
    )
    sections = walk_template_paragraphs(paras)
    assert len(sections) == 2
    assert all(s.placeholder for s in sections)


def test_walker_skips_response_only_lines():
    """A bare ``Response:`` line emits nothing — actual content follows on the next paragraph."""
    paras = _texts(
        "1. Specify the degree(s) offered",
        "Response:",
        "Bachelor of Science in Human Services.",
    )
    sections = walk_template_paragraphs(paras)
    assert sections[0].body_text == "Bachelor of Science in Human Services."


def test_walker_strips_inline_response_marker():
    """``Response: text`` on one line should drop the marker but keep the text."""
    paras = _texts(
        "2a. Describe the organizational structure",
        "Response: KSU is governed by the Board of Regents.",
    )
    sections = walk_template_paragraphs(paras)
    assert sections[0].body_text == "KSU is governed by the Board of Regents."


def test_walker_drops_preamble_before_first_heading():
    """Paragraphs above the first heading (template title, instructions, etc.) are discarded."""
    paras = _texts(
        "Council for Standards in Human Service Education",
        "Self-Study Template",
        "BACCALAUREATE DEGREE IN HUMAN SERVICES",
        "Introduction and Instructions: This template is required…",
        "1. Specify the degree(s) offered",
        "Response:",
        "Bachelor of Science.",
    )
    sections = walk_template_paragraphs(paras)
    # Front-matter headings (Introduction and Instructions) ARE cuts but
    # have no body, so they become placeholder sections. We accept either
    # 1 or 2 depending on whether the front-matter section is filtered.
    # The important assertion: the substantive section is captured.
    real = [s for s in sections if not s.placeholder]
    assert len(real) == 1
    assert real[0].heading.startswith("1. ")
    assert real[0].body_text == "Bachelor of Science."


def test_walker_handles_per_spec_form_when_present():
    """Per-spec headings (``Standard 1, Specification a``) carry both std and spec hints."""
    paras = _texts(
        "Standard 1, Specification a.",
        "The program is part of Kennesaw State University, accredited by SACSCOC.",
        "Standard 1, Specification b.",
        "The primary objective of the program is to prepare HS professionals.",
    )
    sections = walk_template_paragraphs(paras)
    assert len(sections) == 2
    assert (sections[0].standard_hint, sections[0].spec_hint) == ("1", "a")
    assert (sections[1].standard_hint, sections[1].spec_hint) == ("1", "b")


def test_match_heading_standard_colon_form():
    """'Standard 1: The primary objective shall…' — colon form is a Standard
    ROOT (std hint, no spec). The shall-sentence runs on the same line."""
    assert _match_heading("Standard 1: The primary program objective shall be to prepare…") == ("1", None)
    assert _match_heading("Standard 10: Each program shall articulate policies…") == ("10", None)


def test_match_heading_widened_spec_letters():
    """Spec letters run past 'h' (e.g. Field Experience 21 a–j)."""
    assert _match_heading("21.j Provide…") == ("21", "j")
    assert _match_heading("9e. Describe office/classroom space") == ("9", "e")


# ------------------------------------------------ introduction region (KSU-style)


def _ksu_like():
    # Title block + intro prompts (their OWN 1./2a. numbering) + glossary,
    # THEN the standards region opening with "Standard 1: …" and real specs.
    return _texts(
        "1. Specify the degree(s) offered",
        "Response:",
        "Bachelor of Science in Human Services.",
        "2a. Describe the organizational structure",
        "Response:",
        "KSU is governed by the Board of Regents.",
        "B. Glossary of terms",
        "Accreditation: the process by which…",
        "Standard 1: The primary program objective shall be to prepare human services professionals.",
        "Context: institutional requirements.",
        "1a. The program is part of a regionally accredited institution.",
        "Response:",
        "KSU is accredited by SACSCOC.",
        "1b. Provide evidence that competent professionals is the primary objective.",
        "Response:",
        "The program's purpose is…",
    )


def test_intro_region_items_are_flagged_and_lose_spec_hints():
    sections = walk_template_paragraphs(_ksu_like())
    by_heading = {s.heading: s for s in sections}

    # The intro's own "1." / "2a." numbering must NOT be read as Standard specs.
    intro_degree = by_heading["1. Specify the degree(s) offered"]
    assert intro_degree.is_introduction is True
    assert (intro_degree.standard_hint, intro_degree.spec_hint) == (None, None)

    intro_org = by_heading["2a. Describe the organizational structure"]
    assert intro_org.is_introduction is True
    assert (intro_org.standard_hint, intro_org.spec_hint) == (None, None)

    # The glossary closes the introduction and stays in the intro region.
    glossary = by_heading["B. Glossary of terms"]
    assert glossary.is_introduction is True


def test_standards_after_intro_keep_their_hints():
    sections = walk_template_paragraphs(_ksu_like())
    by_heading = {s.heading: s for s in sections}

    # The Standard root (colon form) ends the intro and is NOT an intro section.
    std1 = next(s for s in sections if s.heading.startswith("Standard 1:"))
    assert std1.is_introduction is False
    assert std1.standard_hint == "1"
    assert std1.spec_hint is None

    # Real specs under the standard keep their std+spec hints.
    spec_1a = by_heading["1a. The program is part of a regionally accredited institution."]
    assert spec_1a.is_introduction is False
    assert (spec_1a.standard_hint, spec_1a.spec_hint) == ("1", "a")


def test_walker_keeps_see_appendix_pointer_inline():
    """``See Appendix`` lines mixed with prose are kept (matcher uses them as evidence pointers)."""
    paras = _texts(
        "2a. Describe the organizational structure",
        "Response:",
        "KSU is governed by the Board of Regents.",
        "See Appendix I — #1 Map of Kennesaw Campus",
        "The university operates on two campuses.",
    )
    sections = walk_template_paragraphs(paras)
    assert "See Appendix I — #1 Map of Kennesaw Campus" in sections[0].body_text
    assert "two campuses" in sections[0].body_text


# ------------------------------------- walk_template_docx flag emission (pipeline contract)


def _make_docx(paragraphs, path):
    from docx import Document as _D
    d = _D()
    for p in paragraphs:
        d.add_paragraph(p)
    d.save(str(path))


def test_docx_flags_route_intro_and_keep_spec_hints(tmp_path):
    """The flags the template pipeline reads: document intro + glossary →
    introduction:document; Standard root → introduction:standard-N; real spec
    keeps templateStandardHint/templateSpecHint and carries NO intro hint."""
    docx = tmp_path / "tmpl.docx"
    _make_docx(
        [
            "1. Specify the degree(s) offered",
            "Response:",
            "Bachelor of Science in Human Services.",
            "B. Glossary of terms",
            "Accreditation: the process by which an institution is reviewed.",
            "Standard 1: The primary program objective shall be to prepare professionals.",
            "Context: institutional requirements.",
            "1a. The program is part of a regionally accredited institution.",
            "Response:",
            "KSU is accredited by SACSCOC.",
        ],
        docx,
    )
    sections, _raw = walk_template_docx(str(docx), base_id="t")
    by_heading = {s.heading: s for s in sections}

    intro = by_heading["1. Specify the degree(s) offered"]
    assert intro.flags.get("templateIntroductionHint") == "introduction:document"
    assert intro.flags.get("templateStandardHint") == ""
    assert intro.flags.get("templateSpecHint") == ""

    glossary = by_heading["B. Glossary of terms"]
    assert glossary.flags.get("templateIntroductionHint") == "introduction:document"

    std_root = next(s for s in sections if s.heading.startswith("Standard 1:"))
    assert std_root.flags.get("templateIntroductionHint") == "introduction:standard-1"

    spec = by_heading["1a. The program is part of a regionally accredited institution."]
    assert spec.flags.get("templateIntroductionHint") in (None, "")
    assert spec.flags.get("templateStandardHint") == "1"
    assert spec.flags.get("templateSpecHint") == "a"


def test_inline_standard_citation_does_not_end_intro_before_glossary():
    """A front-matter curriculum citation ('Standard 13 a:') must NOT end the
    Introduction — the glossary that follows it still belongs to the intro."""
    paras = _texts(
        "1. Specify the degree(s) offered",
        "Response:",
        "Bachelor of Science.",
        "Standard 13 a: students understand small-group theory",  # inline citation
        "B. Include a glossary of terms",
        "Accreditation: the process by which…",
        "Standard 1: The primary objective shall be to prepare professionals.",
        "1a. The program is regionally accredited.",
        "Response:",
        "Accredited by SACSCOC.",
    )
    sections = walk_template_paragraphs(paras)
    glossary = next(s for s in sections if "glossary" in s.heading.lower())
    assert glossary.is_introduction is True
    spec_1a = next(s for s in sections if s.heading.startswith("1a."))
    assert spec_1a.is_introduction is False
    assert (spec_1a.standard_hint, spec_1a.spec_hint) == ("1", "a")


def test_standard_root_with_empty_body_still_emits_standard_intro(tmp_path):
    """Standard 9: with the shall-sentence in the heading and no body still
    emits a section routed to introduction:standard-9 (not dropped as empty)."""
    docx = tmp_path / "t.docx"
    _make_docx(
        [
            "I. GENERAL PROGRAM CHARACTERISTICS",
            "Standard 9: The program shall have adequate faculty, staff, and resources.",
            "9a. Include budgetary information.",
            "Response:",
            "The annual budget is sufficient.",
        ],
        docx,
    )
    sections, _ = walk_template_docx(str(docx), base_id="t")
    root = next(s for s in sections if s.heading.startswith("Standard 9:"))
    assert root.flags.get("templateIntroductionHint") == "introduction:standard-9"


def test_walker_captures_embedded_table_and_appendix_refs(tmp_path):
    """Embedded tables attach to the current spec as evidence; 'See Appendix'
    lines are captured as import reminders. (Paragraph-only walking dropped
    tables entirely — the rosters/grids that ARE the supporting evidence.)"""
    from docx import Document as _D
    d = _D()
    d.add_paragraph("I. GENERAL PROGRAM CHARACTERISTICS")
    d.add_paragraph("Standard 7: The program shall manage essential roles.")
    d.add_paragraph("7b 2. Provide a table matching faculty and staff with roles.")
    d.add_paragraph("Response:")
    d.add_paragraph("The roles are filled as shown. See Appendix VII Standard 7 Roster.")
    t = d.add_table(rows=2, cols=2)
    t.rows[0].cells[0].text = "Name"; t.rows[0].cells[1].text = "Role"
    t.rows[1].cells[0].text = "Jane Doe"; t.rows[1].cells[1].text = "Director"
    docx = tmp_path / "roster.docx"; d.save(str(docx))

    sections, raw = walk_template_docx(str(docx), base_id="t")
    spec = next(r for r in raw if r.standard_hint == "7" and r.spec_hint == "b")
    assert len(spec.evidence_tables) == 1
    assert "Name" in spec.evidence_tables[0]["text"] and "Director" in spec.evidence_tables[0]["text"]
    assert "<table>" in spec.evidence_tables[0]["html"]
    assert spec.appendix_refs and "Appendix VII" in spec.appendix_refs[0]
