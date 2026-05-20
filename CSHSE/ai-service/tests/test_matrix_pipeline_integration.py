"""End-to-end integration test for the matrix-as-first-class wizard slice.

Exercises the WHOLE wire path that the live Stevenson run will hit, but
against an in-memory HTML fixture so it can run offline and lock the
behavior in unit-test form:

  1. deep_walker.deep_walk() must NOT emit `curriculum_matrix` tables as
     data-table sections (the bug the user surfaced from the Stevenson
     review screen — matrix rows were leaking into individual spec cards).
  2. build_wire_matrices() must detect BOTH known CSHSE anchors
     (MatrixHSR + Matrix2) when both are present.
  3. Each matrix's html_snippet must carry per-row anchor ids of the
     form `matrix-{slug}-row-{std}-{spec}` so the wizard's "View in
     Matrix" buttons can scroll to the exact row.
  4. Cells per matrix must round-trip standard + spec + column header +
     code metadata without loss.

Stevenson's real document has hundreds of standard sections and two
matrices. The fixture here keeps the matrix shape realistic (Standards
11–13, three courses, ITKS/LMH cell codes) while staying small enough
to run in <1s with no external services.
"""
from __future__ import annotations

from app.matrix.template_loader import MatrixRow, MatrixTemplate
from app.matrix.wire_format import build_wire_matrices
from app.splitter.deep_walker import deep_walk


# -------------------------------------------------------------- fixtures


def _stevenson_shaped_template() -> MatrixTemplate:
    """A baccalaureate-shaped template covering Standards 11-13 a-c."""
    prompts: list[tuple[str, str, str, str]] = [
        ("11", "a", "History", "Provide a brief history of the program"),
        ("11", "b", "History", "Describe the student population trends"),
        ("11", "c", "History", "Describe relationships with other units"),
        ("12", "a", "Human Systems", "Describe the human systems framework used"),
        ("12", "b", "Human Systems", "Describe how systems theory is applied"),
        ("13", "a", "Service Delivery", "Describe the service delivery model"),
        ("13", "b", "Service Delivery", "Describe practicum service placement"),
    ]
    rows = [
        MatrixRow(
            standard_code=std,
            spec_text=prompt,
            spec_code=sp,
            standard_title=title,
        )
        for (std, sp, title, prompt) in prompts
    ]
    return MatrixTemplate(
        program_level="bachelors",
        source_filename="stevenson-shaped.docx",
        rows=rows,
        column_count=4,
        legend={"I": "Introduction", "T": "Theory", "K": "Knowledge", "S": "Skills"},
    )


def _stevenson_shaped_html() -> bytes:
    """A document with BOTH matrices + several non-matrix data tables.

    Includes:
      - One leading narrative section.
      - A non-matrix data table (faculty roster — should still be picked
        up as a section since it isn't classified as curriculum_matrix).
      - The MatrixHSR matrix.
      - More narrative.
      - The Matrix2 (non-HS courses) matrix.
      - Trailing narrative.
    """
    matrix_rows_hsr = "".join(
        f"<tr><td>{prompt}</td><td>I,L</td><td>T,M</td><td>K,H</td></tr>"
        for (_std, _sp, _title, prompt) in [
            ("11", "a", "History", "Provide a brief history of the program"),
            ("11", "b", "History", "Describe the student population trends"),
            ("11", "c", "History", "Describe relationships with other units"),
            ("12", "a", "Human Systems", "Describe the human systems framework used"),
            ("12", "b", "Human Systems", "Describe how systems theory is applied"),
            ("13", "a", "Service Delivery", "Describe the service delivery model"),
            ("13", "b", "Service Delivery", "Describe practicum service placement"),
        ]
    )
    matrix_rows_non_hsr = "".join(
        f"<tr><td>{prompt}</td><td>S,H</td><td>K,M</td><td>T,L</td></tr>"
        for (_std, _sp, _title, prompt) in [
            ("11", "a", "History", "Provide a brief history of the program"),
            ("11", "b", "History", "Describe the student population trends"),
            ("12", "a", "Human Systems", "Describe the human systems framework used"),
            ("13", "a", "Service Delivery", "Describe the service delivery model"),
        ]
    )
    return (
        "<html><body>"
        "<h1>Stevenson University Self-Study</h1>"
        "<p>The Human Services program at Stevenson University was founded in 1999 "
        "and has grown steadily over the past two decades to become one of the "
        "largest undergraduate programs in the school. Total enrollment as of fall "
        "2024 stands at 187 students across all years.</p>"
        # Faculty roster — non-matrix data table.
        "<table>"
        "<tr><th>Name</th><th>Role</th><th>Years</th></tr>"
        "<tr><td>Dr. Ari Blum</td><td>Director</td><td>15</td></tr>"
        "<tr><td>Dr. Lisa Boone</td><td>Faculty</td><td>8</td></tr>"
        "<tr><td>Dr. Pat Lee</td><td>Field Coord</td><td>5</td></tr>"
        "</table>"
        # Matrix 1 — Human Services courses.
        '<h2 id="MatrixHSR">Matrix for Human Services Courses</h2>'
        "<table>"
        "<tr><th></th><th>HS101</th><th>HS201</th><th>HS301</th></tr>"
        f"{matrix_rows_hsr}"
        "</table>"
        "<p>The above table maps every CSHSE Standard 11-13 specification to "
        "the three required Human Services courses. Each cell encodes the type "
        "of coverage (Introduction, Theory, Knowledge, Skills) and depth (Low, "
        "Medium, High).</p>"
        # Matrix 2 — Non-Human Services courses.
        '<h2 id="Matrix2">Matrix for Non-Human Services Courses</h2>'
        "<table>"
        "<tr><th></th><th>PSY200</th><th>SOC210</th><th>ENG110</th></tr>"
        f"{matrix_rows_non_hsr}"
        "</table>"
        "<p>The above Non-Human Services course table maps a subset of the same "
        "specifications to courses outside the major.</p>"
        "</body></html>"
    ).encode("utf-8")


# ------------------------------------------------------------- tests


def test_pipeline_suppresses_matrices_from_deep_walker_output():
    """The two CSHSE matrices must not show up as data-table sections."""
    sections = deep_walk(_stevenson_shaped_html())
    # Faculty roster is the only non-matrix table; we should see exactly
    # ONE table section emerge.
    table_sections = [s for s in sections if "table" in s.splitter_tier]
    assert len(table_sections) == 1, [s.splitter_tier for s in table_sections]
    headings = [s.heading for s in table_sections]
    assert all("matrix" not in h.lower() for h in headings), headings


def test_pipeline_extracts_both_matrices_with_anchors():
    """Both MatrixHSR and Matrix2 anchors must be detected when present."""
    template = _stevenson_shaped_template()
    matrices, consumed = build_wire_matrices(_stevenson_shaped_html(), template)

    assert len(matrices) == 2, [m["name"] for m in matrices]
    by_id = {m["matrixId"]: m for m in matrices}
    assert "matrix-hsr" in by_id
    assert "matrix-non-hsr" in by_id

    hsr = by_id["matrix-hsr"]
    assert hsr["name"] == "Matrix for Human Services Courses"
    assert hsr["columnHeaders"] == ["HS101", "HS201", "HS301"]
    # 7 template rows × 3 course cells = 21 cells in HSR.
    assert len(hsr["cells"]) == 21

    non = by_id["matrix-non-hsr"]
    assert non["name"] == "Matrix for Non-Human Services Courses"
    assert non["columnHeaders"] == ["PSY200", "SOC210", "ENG110"]
    # 4 rows × 3 cells = 12 cells in Non-HS.
    assert len(non["cells"]) == 12

    # Two top-level <table> tags should be consumed by the matrix extractor.
    assert len(consumed) == 2


def test_pipeline_row_anchors_are_addressable_per_spec():
    """Every (std, spec) the wizard renders deep-link buttons for must
    correspond to a `<tr id="matrix-{slug}-row-{std}-{spec}">` in the
    matrix HTML — otherwise the scroll-into-view would miss."""
    template = _stevenson_shaped_template()
    matrices, _ = build_wire_matrices(_stevenson_shaped_html(), template)
    hsr_html = next(m for m in matrices if m["matrixId"] == "matrix-hsr")["htmlSnippet"]
    for (std, spec) in [
        ("11", "a"), ("11", "b"), ("11", "c"),
        ("12", "a"), ("12", "b"),
        ("13", "a"), ("13", "b"),
    ]:
        anchor = f'id="matrix-hsr-row-{std}-{spec}"'
        assert anchor in hsr_html, f"missing anchor {anchor} in HSR html"
    # Same for the Non-HS matrix (subset of specs).
    non_html = next(m for m in matrices if m["matrixId"] == "matrix-non-hsr")["htmlSnippet"]
    for (std, spec) in [("11", "a"), ("11", "b"), ("12", "a"), ("13", "a")]:
        anchor = f'id="matrix-non-hsr-row-{std}-{spec}"'
        assert anchor in non_html, f"missing anchor {anchor} in Non-HS html"


def test_pipeline_cells_carry_full_metadata():
    """The wizard depends on per-cell columnHeader + contentTypes + depth +
    rowAnchor for the per-spec "View in Matrix" button + the matrix view's
    per-row tooltips. None of those may be lost in the wire serialization."""
    template = _stevenson_shaped_template()
    matrices, _ = build_wire_matrices(_stevenson_shaped_html(), template)
    hsr = next(m for m in matrices if m["matrixId"] == "matrix-hsr")
    # Pick a specific cell: Standard 11 spec a, column HS201 (column index 2).
    cell = next(
        c for c in hsr["cells"]
        if c["std"] == "11" and c["spec"] == "a" and c["columnIndex"] == 2
    )
    assert cell["columnHeader"] == "HS201"
    assert cell["codeRaw"] == "T,M"
    assert cell["contentTypes"] == ["T"]
    assert cell["depth"] == "M"
    assert cell["rowAnchor"] == "matrix-hsr-row-11-a"


def test_pipeline_faculty_roster_still_emerges_as_normal_section():
    """Sanity guard: only `curriculum_matrix`-classified tables are
    suppressed. Other data tables (faculty rosters, course schedules,
    etc.) must still emerge as deep_walker sections."""
    sections = deep_walk(_stevenson_shaped_html())
    roster = [s for s in sections if "Ari Blum" in s.markdown]
    assert len(roster) == 1, [s.heading for s in sections]


def test_pipeline_short_letter_tagged_sections_survive_word_filter():
    """The wizard pipeline's word-count filter must NOT drop letter-tagged
    subspec rows even when their full text is under 30 words.

    Stevenson's spec 1.a — "The program is part of a degree granting college
    or university that is regionally accredited. Response: Stevenson
    University is accredited by the Middle States Commission on Higher
    Education." — is ~26 words. deep_walker emits it as
    ``splitter_tier="table_subspec_row"`` (its own internal 8-word floor on
    the response body is met, but the SECTION's total word_count is just
    shy of 30 because the prompt is short). The pipeline filter must keep
    those by tier, not by length, otherwise spec 1.a shows empty in the
    rail even though the document plainly addresses it.
    """
    from app.splitter.deep_walker import deep_walk_with_fallback

    # Reproduces the Stevenson template shape: a letter-marker prompt row +
    # a "Response:" body row. Each response is ≥8 words (walker's internal
    # floor) but the SECTION's total word_count lands just under 30 — which
    # is what the import_jobs filter used to drop pre-fix.
    html = (
        "<html><body>"
        "<table>"
        "<tr><td>a. The program is part of a degree granting college "
        "or university that is regionally accredited.</td></tr>"
        "<tr><td>Response: Stevenson University is accredited by the Middle "
        "States Commission on Higher Education.</td></tr>"
        "<tr><td>b. Describe the institutional commitment to the program.</td></tr>"
        "<tr><td>Response: The institution has provided dedicated faculty, "
        "facilities, and operating budget since the program's inception.</td></tr>"
        "</table>"
        "</body></html>"
    ).encode("utf-8")

    raw = deep_walk_with_fallback(html, base_id="t")
    subspec_rows = [s for s in raw if s.splitter_tier == "table_subspec_row"]
    assert len(subspec_rows) == 2, [s.heading for s in raw]

    short_subspec = [s for s in subspec_rows if s.word_count < 30]
    assert short_subspec, (
        "fixture should produce table_subspec_row sections under 30 words; "
        f"got word counts {[s.word_count for s in subspec_rows]}"
    )

    # The filter the import_jobs pipeline uses must keep them all.
    filtered = [
        s for s in raw
        if s.splitter_tier == "table_subspec_row" or s.word_count >= 30
    ]
    headings = " | ".join(s.heading for s in filtered)
    assert "a." in headings, headings
    assert "b." in headings, headings
