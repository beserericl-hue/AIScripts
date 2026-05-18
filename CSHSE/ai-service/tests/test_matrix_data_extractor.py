"""Tests for the matrix data extractor."""
from __future__ import annotations

from app.matrix.data_extractor import (
    _CELL_CODE_RE,
    _decode_code,
    _best_template_match,
    extract_matrix,
)
from app.matrix.template_loader import MatrixRow, MatrixTemplate


def test_cell_code_regex():
    assert _CELL_CODE_RE.match("ITKSH")
    assert _CELL_CODE_RE.match("KM")
    assert _CELL_CODE_RE.match("I")
    assert _CELL_CODE_RE.match("h")  # case-insensitive
    assert not _CELL_CODE_RE.match("")
    assert not _CELL_CODE_RE.match("xyz")
    assert not _CELL_CODE_RE.match("ITKSH ")  # no trailing space
    assert not _CELL_CODE_RE.match("3")


def test_decode_code():
    types, depth = _decode_code("ITKSH")
    assert types == ["I", "T", "K", "S"]
    assert depth == "H"

    types, depth = _decode_code("KM")
    assert types == ["K"]
    assert depth == "M"

    types, depth = _decode_code("IL")
    assert types == ["I"]
    assert depth == "L"

    types, depth = _decode_code("ITKM")
    assert types == ["I", "T", "K"]
    assert depth == "M"


def test_best_template_match_exact_substring():
    template = MatrixTemplate(
        program_level="bachelors",
        source_filename="test.docx",
        rows=[
            MatrixRow("11", "Theories of human development.", "b", "Human Systems"),
            MatrixRow("12", "Small groups overview", "c", "Human Systems"),
            MatrixRow("13", "Family structures", "d", "Human Systems"),
        ],
        column_count=13,
        legend={"I": "Introduction", "T": "Theory"},
    )
    # Exact substring should pick row 0
    m = _best_template_match("Theories of human development.", template)
    assert m is not None
    idx, conf = m
    assert idx == 0
    assert conf == 1.0


def test_best_template_match_token_overlap():
    template = MatrixTemplate(
        program_level="bachelors",
        source_filename="test.docx",
        rows=[
            MatrixRow("11", "Theories of human development.", "b", "T"),
            MatrixRow("12", "Small groups: overview of how small groups are used", "c", "HS"),
        ],
        column_count=13,
        legend={},
    )
    # Token overlap should still match
    m = _best_template_match("Small groups overview small groups used", template)
    assert m is not None
    idx, _ = m
    assert idx == 1


def test_best_template_match_no_match():
    template = MatrixTemplate(
        program_level="bachelors",
        source_filename="test.docx",
        rows=[
            MatrixRow("11", "Theories of human development.", "b", "T"),
        ],
        column_count=13,
        legend={},
    )
    m = _best_template_match("Completely unrelated text about quantum physics.", template)
    assert m is None or m[1] < 0.4  # very low confidence


def test_extract_matrix_end_to_end():
    """Synthesize a small matrix HTML + template + verify extraction."""
    html = """
    <html><body>
    <a id="MatrixHSR"></a>
    <table>
      <tr><th>Type</th><th>Depth</th></tr>
      <tr><td>I</td><td>L</td></tr>
    </table>
    <table>
      <tr><td colspan="6">Standards and Specifications</td></tr>
      <tr><td colspan="6">Knowledge, Theory, Skills</td></tr>
      <tr><td>Specifications for Standard 11</td><td></td><td></td><td></td><td></td><td></td></tr>
      <tr><td>The historical roots of human services.</td><td>KM</td><td></td><td>ITKSH</td><td></td><td>IL</td></tr>
      <tr><td>Historical and current legislation</td><td></td><td>ITM</td><td></td><td>KSH</td><td></td></tr>
    </table>
    </body></html>"""

    template = MatrixTemplate(
        program_level="bachelors",
        source_filename="test.docx",
        rows=[
            MatrixRow("11", "The historical roots of human services.", "a", "History"),
            MatrixRow("11", "Historical and current legislation affecting services delivery.", "b", "History"),
        ],
        column_count=13,
        legend={"I": "Introduction", "T": "Theory", "K": "Knowledge", "S": "Skills",
                "L": "Low", "M": "Moderate", "H": "Heavy"},
    )

    result = extract_matrix(html.encode("utf-8"), template, anchor="MatrixHSR")

    # Should find 2 rows, both matched to template
    assert result.rows_total == 2
    assert result.rows_matched == 2

    # Should have multiple cells extracted
    by_spec = {(c.standard_code, c.spec_code): [] for c in result.cells}
    for c in result.cells:
        by_spec[(c.standard_code, c.spec_code)].append(c)

    # Row 1 (11.a): KM @ col 1, ITKSH @ col 3, IL @ col 5
    spec_a_cells = [c for c in result.cells if (c.standard_code, c.spec_code) == ("11", "a")]
    assert len(spec_a_cells) == 3
    codes_a = {c.code_raw for c in spec_a_cells}
    assert codes_a == {"KM", "ITKSH", "IL"}

    # Row 2 (11.b): ITM @ col 2, KSH @ col 4
    spec_b_cells = [c for c in result.cells if (c.standard_code, c.spec_code) == ("11", "b")]
    assert len(spec_b_cells) == 2
    codes_b = {c.code_raw for c in spec_b_cells}
    assert codes_b == {"ITM", "KSH"}

    # Verify decoding worked
    cell_itksh = next(c for c in spec_a_cells if c.code_raw == "ITKSH")
    assert cell_itksh.content_types == ["I", "T", "K", "S"]
    assert cell_itksh.depth == "H"
