"""Unit tests for the deep table walker."""
from __future__ import annotations

from app.splitter.deep_walker import (
    _classify_table,
    _expand_table_with_spans,
    _extract_marker,
    deep_walk,
    deep_walk_with_fallback,
)
from bs4 import BeautifulSoup


def _parse(html: str):
    return BeautifulSoup(html, "html.parser")


# -------------------------------------------------------------------- markers


def test_extract_marker_letter():
    assert _extract_marker("a. Provide name") == (None, "a")
    assert _extract_marker("b) Describe") == (None, "b")
    assert _extract_marker("c. ") == (None, "c")


def test_extract_marker_numeric():
    # "1." standalone — short, treated as a standard marker.
    assert _extract_marker("1. ") == ("1", None)
    # "11.a" → numeric + spec
    assert _extract_marker("11.a") == ("11", "a")
    # "11.a Foo" with trailing prose
    assert _extract_marker("11.a Foo") == ("11", "a")


def test_extract_marker_no_false_positives():
    assert _extract_marker("Standard 1 Title") is None
    assert _extract_marker("In 1999 the program") is None
    assert _extract_marker("Just some prose text") is None


# ------------------------------------------------------- rowspan expansion


def test_rowspan_expansion_basic():
    html = """
    <table>
      <tr><td rowspan="3">a.</td><td>Provide name</td></tr>
      <tr><td>Response: First answer</td></tr>
      <tr><td>Additional context</td></tr>
      <tr><td rowspan="2">b.</td><td>Describe foo</td></tr>
      <tr><td>Response: Second answer</td></tr>
    </table>"""
    table = _parse(html).find("table")
    grid = _expand_table_with_spans(table)

    # 5 rows total
    assert len(grid) == 5
    # Row 0: real 'a.' + 'Provide name'
    assert grid[0][0].text == "a." and grid[0][0].is_rowspan_continuation is False
    assert grid[0][1].text == "Provide name"
    # Row 1: inherited 'a.' + new 'Response' cell
    assert grid[1][0].text == "a." and grid[1][0].is_rowspan_continuation is True
    assert grid[1][1].text == "Response: First answer"
    # Row 2: inherited 'a.' + 'Additional context'
    assert grid[2][0].is_rowspan_continuation is True
    assert grid[2][1].text == "Additional context"
    # Row 3: new 'b.' (no more inheritance of 'a.')
    assert grid[3][0].text == "b." and grid[3][0].is_rowspan_continuation is False
    # Row 4: inherited 'b.'
    assert grid[4][0].is_rowspan_continuation is True
    assert grid[4][1].text == "Response: Second answer"


# --------------------------------------------------------- classification


def test_classify_curriculum_matrix():
    html = """
    <table>
      <tr><th></th><th>HS101</th><th>HS201</th><th>HS301</th><th>HS401</th><th>HS499</th></tr>
      <tr><td>1.a</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>
      <tr><td>1.b</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>
      <tr><td>1.c</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>
      <tr><td>1.d</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>
      <tr><td>1.e</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>
      <tr><td>1.f</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>
    </table>"""
    table = _parse(html).find("table")
    assert _classify_table(table) == "curriculum_matrix"


def test_classify_template_subspec_simple():
    html = """
    <table>
      <tr><td>a.</td><td>Provide the name and location.</td></tr>
      <tr><td>Response:</td><td>Stevenson University in Maryland.</td></tr>
      <tr><td>b.</td><td>Describe the structural location.</td></tr>
      <tr><td>Response:</td><td>The program is in the School of Humanities.</td></tr>
      <tr><td>c.</td><td>Describe relationships.</td></tr>
      <tr><td>Response:</td><td>Collaborations with Psychology.</td></tr>
    </table>"""
    table = _parse(html).find("table")
    assert _classify_table(table) == "template_subspec"


def test_classify_template_subspec_with_rowspan():
    """The realistic CSHSE shape: marker cells span the prompt+response rows."""
    html = """
    <table>
      <tr><td rowspan="3">a.</td><td>Provide the name and location.</td></tr>
      <tr><td>Response: Stevenson is in Maryland.</td></tr>
      <tr><td>Additional context paragraph.</td></tr>
      <tr><td rowspan="2">b.</td><td>Describe the structure.</td></tr>
      <tr><td>Response: The department reports to the dean.</td></tr>
    </table>"""
    table = _parse(html).find("table")
    assert _classify_table(table) == "template_subspec"


# ----------------------------------------------------- end-to-end deep walk


def test_deep_walk_emits_one_section_per_subspec_row():
    html = (
        "<html><body>"
        "<table>"
        "<tr><td>a. Provide a brief history of the program</td></tr>"
        "<tr><td>Response: The program started in 1999 and grew to over 187 students by 2024.</td></tr>"
        "<tr><td>b. Describe student population</td></tr>"
        "<tr><td>Response: 56 majors, 87% female, 49% white, predominantly full-time.</td></tr>"
        "<tr><td>c. Describe relationships</td></tr>"
        "<tr><td>Response: The program collaborates with Psychology and other academic units regularly.</td></tr>"
        "</table>"
        "</body></html>"
    )
    sections = deep_walk(html.encode("utf-8"), base_id="t")
    assert len(sections) == 3, [s.heading for s in sections]
    headings = [s.heading for s in sections]
    assert any("a. Provide a brief history" in h for h in headings)
    assert any("b. Describe student population" in h for h in headings)
    assert any("c. Describe relationships" in h for h in headings)
    for s in sections:
        assert s.word_count >= 8
        assert s.splitter_tier == "table_subspec_row"


def test_deep_walk_handles_rowspan_marker_column():
    """The marker cell uses rowspan to span prompt + response — make sure we
    still emit ONE section per marker (not lose continuation rows)."""
    html = (
        "<html><body>"
        "<table>"
        '<tr><td rowspan="3">a.</td><td>Provide a brief history of the program.</td></tr>'
        "<tr><td>Response: The program started in 1999 and grew steadily through 2024 with many graduates.</td></tr>"
        "<tr><td>Additional detail about faculty and reorganization.</td></tr>"
        '<tr><td rowspan="2">b.</td><td>Describe the student population.</td></tr>'
        "<tr><td>Response: 56 majors, 87 percent female, predominantly full-time enrollment.</td></tr>"
        "</table>"
        "</body></html>"
    )
    sections = deep_walk(html.encode("utf-8"), base_id="t")
    assert len(sections) == 2, [s.heading for s in sections]
    # The 'a.' section should have absorbed the rowspan continuation rows.
    sec_a = next(s for s in sections if s.heading.startswith("a"))
    assert "program started in 1999" in sec_a.markdown.lower()
    assert "additional detail about faculty" in sec_a.markdown.lower()
    # The 'b.' section should have just its row + its rowspan continuation.
    sec_b = next(s for s in sections if s.heading.startswith("b"))
    assert "56 majors" in sec_b.markdown


def test_deep_walk_curriculum_matrix_suppressed_by_default():
    """By default deep_walk SKIPS curriculum_matrix tables — the matrix
    extractor / wire_format.py owns them and the wizard surfaces them as
    first-class entities. Passing ``skip_matrices=False`` restores the
    legacy behavior for callers that don't run the matrix pipeline."""
    matrix = (
        "<html><body>"
        "<table>"
        "<tr><th></th><th>HS101</th><th>HS201</th><th>HS301</th><th>HS401</th><th>HS499</th></tr>"
        "<tr><td>1.a</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>"
        "<tr><td>1.b</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>"
        "<tr><td>1.c</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>"
        "<tr><td>1.d</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>"
        "<tr><td>1.e</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>"
        "<tr><td>1.f</td><td>I,L</td><td>T,M</td><td>K,H</td><td>S,H</td><td>K,H</td></tr>"
        "</table></body></html>"
    )
    # Default — matrix is suppressed (claimed by matrix_extract elsewhere).
    assert deep_walk(matrix.encode("utf-8"), base_id="t") == []
    # Opt-in legacy behavior — emits the matrix as a data-table section.
    sections = deep_walk(matrix.encode("utf-8"), base_id="t", skip_matrices=False)
    assert len(sections) == 1
    assert sections[0].contains_table is True
    assert sections[0].splitter_tier == "table_curriculum_matrix"


def test_table_section_preserves_html_snippet():
    """deep_walker must carry the original <table> HTML so the wizard's review
    pane can render rows and columns instead of the get_text() flatten."""
    html = (
        "<html><body>"
        "<table>"
        "<tr><th>Name</th><th>Role</th></tr>"
        "<tr><td>Ari Blum</td><td>Director, Health Programs</td></tr>"
        "<tr><td>Lisa Boone</td><td>Faculty Lead</td></tr>"
        "<tr><td>Pat Lee</td><td>Field Coordinator</td></tr>"
        "</table>"
        "</body></html>"
    )
    sections = deep_walk(html.encode("utf-8"), base_id="t")
    assert len(sections) == 1
    sec = sections[0]
    # Markdown stays flattened for embedding/matching.
    assert "Ari Blum" in sec.markdown
    # But html_snippet holds the structural source for the UI.
    assert sec.html_snippet is not None
    assert "<table" in sec.html_snippet
    assert "<th>Name</th>" in sec.html_snippet
    assert "<td>Ari Blum</td>" in sec.html_snippet


def test_deep_walk_with_fallback_captures_outside_prose():
    html = (
        "<html><body>"
        "<p>This is preamble prose that sets context for the program. It is fifty words or more "
        "describing the structure of the human services department, including faculty mix and "
        "program location. The narrative needs to be substantial to be captured by the fallback "
        "since short paragraphs are filtered out as likely noise rather than meaningful prose.</p>"
        "<table>"
        "<tr><td>a. Provide a brief history</td></tr>"
        "<tr><td>Response: The program started in 1999 and grew significantly by 2024.</td></tr>"
        "<tr><td>b. Describe foo</td></tr>"
        "<tr><td>Response: Bar baz quux and additional discussion content here.</td></tr>"
        "</table>"
        "</body></html>"
    )
    sections = deep_walk_with_fallback(html.encode("utf-8"), base_id="t")
    prose_tier = [s for s in sections if s.splitter_tier == "prose_outside_table"]
    table_tier = [s for s in sections if s.splitter_tier == "table_subspec_row"]
    assert prose_tier, "expected at least one prose section"
    assert len(table_tier) == 2, f"expected 2 subspec sections, got {len(table_tier)}"
