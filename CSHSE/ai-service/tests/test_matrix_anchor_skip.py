"""Regression test for the matrix-anchor skip in deep_walker.

User reported 2026-05-22 that rows of a curriculum-matrix table were
emerging as Unplaced narratives in the wizard's Review step. Root cause:
deep_walker ran before the matrix extractor and walked matrix tables via
the template_subspec path when _classify_table mis-tagged them.

Fix: skip ANY table that follows a known matrix anchor (MatrixHSR /
Matrix2) in the document, regardless of _classify_table's verdict. This
test pins that behaviour so a future contributor can't regress.
"""
from __future__ import annotations

from app.splitter.deep_walker import (
    _is_table_under_matrix_anchor,
    deep_walk,
)
from bs4 import BeautifulSoup


def test_table_under_matrixhsr_anchor_is_recognized():
    html = """
    <html><body>
      <h1>Curriculum</h1>
      <a name="MatrixHSR"></a>
      <table>
        <tr><th>Spec</th><th>CHS 105</th></tr>
        <tr><td>The worth and uniqueness...</td><td>I,KM</td></tr>
      </table>
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    assert table is not None
    assert _is_table_under_matrix_anchor(table) is True


def test_table_under_matrix2_anchor_is_recognized():
    html = """
    <html><body>
      <a name="Matrix2"></a>
      <table>
        <tr><th>Spec</th><th>CHS 105</th></tr>
        <tr><td>Self-development requires...</td><td>K,L</td></tr>
      </table>
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    assert _is_table_under_matrix_anchor(table) is True


def test_table_after_h1_without_matrix_anchor_is_not_matrix_owned():
    """An ordinary data table that follows a major section header (no
    matrix anchor between) is not matrix-owned and should be walked
    normally."""
    html = """
    <html><body>
      <a name="MatrixHSR"></a>
      <table><tr><td>matrix</td><td>I,K</td><td>M</td></tr></table>
      <h1>Faculty Roster</h1>
      <table>
        <tr><th>Name</th><th>Title</th><th>Email</th></tr>
        <tr><td>Dr Smith</td><td>Chair</td><td>smith@x.edu</td></tr>
      </table>
    </body></html>
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    # First table is matrix-owned (right after the anchor).
    assert _is_table_under_matrix_anchor(tables[0]) is True
    # Second table is AFTER an h1, so the matrix anchor doesn't own it.
    assert _is_table_under_matrix_anchor(tables[1]) is False


def test_deep_walk_drops_matrix_owned_tables_even_with_subspec_shape():
    """End-to-end: a table that LOOKS like template_subspec
    (Handbook-verb rows in column 0, etc) but lives under a matrix
    anchor MUST NOT emit per-row sections. The bug being pinned here
    is: rows from the matrix would otherwise show up as Unplaced
    narrative tags in the wizard.
    """
    html = """
    <html><body>
      <p>Some leading prose padded out to clear the fifty-word floor of
         the fallback walker. We add filler text so this paragraph counts
         as a real prose section and the walker actually emits it as a
         section. More filler. More filler. More filler. More filler.
         More filler. More filler. More filler. More filler. Filler.</p>
      <a name="MatrixHSR"></a>
      <table>
        <tr><th>Spec</th><th>CHS 105</th><th>CHS 224</th><th>CHS 380</th></tr>
        <tr>
          <td>The worth and uniqueness of individuals including culture, ethnicity, race, class.</td>
          <td>I,KM</td><td>KS,H</td><td>K,M</td>
        </tr>
        <tr>
          <td>Confidentiality of information across all client interactions.</td>
          <td>I,KM</td><td>KS,H</td><td>KS,H</td>
        </tr>
      </table>
    </body></html>
    """.encode()
    sections = deep_walk(html, base_id="test")
    # The matrix rows must NOT emerge as sections.
    for s in sections:
        assert "The worth and uniqueness" not in s.markdown, (
            "matrix row leaked into deep_walker output: "
            f"{s.markdown[:80]}"
        )
        assert "Confidentiality of information" not in s.markdown, (
            "matrix row leaked into deep_walker output: "
            f"{s.markdown[:80]}"
        )
