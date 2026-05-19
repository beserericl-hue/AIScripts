"""Unit tests for the matrix wire-format builder.

`build_wire_matrices` is what turns the raw extractor output into the
shape the wizard UI consumes: per-matrix dicts with the full <table>
HTML (with row anchors injected), column headers, and per-cell rows
indexed by std/spec/column.
"""
from __future__ import annotations

from app.matrix.template_loader import MatrixRow, MatrixTemplate
from app.matrix.wire_format import (
    MATRIX_ANCHORS,
    build_wire_matrices,
)


def _toy_template() -> MatrixTemplate:
    """A minimal template covering Standards 11 a-c only."""
    rows = [
        MatrixRow(
            standard_code="11",
            spec_text=p,
            spec_code=sp,
            standard_title="History",
        )
        for sp, p in [
            ("a", "Provide a brief history of the program"),
            ("b", "Describe the student population trends"),
            ("c", "Describe relationships with other units"),
        ]
    ]
    return MatrixTemplate(
        program_level="bachelors",
        source_filename="toy.docx",
        rows=rows,
        column_count=4,
        legend={"I": "Introduction", "T": "Theory", "K": "Knowledge", "S": "Skills"},
    )


def _toy_html() -> bytes:
    """A doc with a #MatrixHSR anchor and a curriculum matrix table."""
    return (
        "<html><body>"
        '<a id="MatrixHSR"></a>'
        "<table>"
        "<tr><th></th><th>HS101</th><th>HS201</th><th>HS301</th></tr>"
        "<tr><td>Provide a brief history of the program</td>"
        "<td>I,L</td><td>T,M</td><td>K,H</td></tr>"
        "<tr><td>Describe the student population trends</td>"
        "<td>I,L</td><td>T,M</td><td>K,H</td></tr>"
        "<tr><td>Describe relationships with other units</td>"
        "<td>I,L</td><td>T,M</td><td>K,H</td></tr>"
        "</table>"
        "</body></html>"
    ).encode("utf-8")


def test_build_wire_matrices_basic():
    template = _toy_template()
    matrices, consumed = build_wire_matrices(_toy_html(), template)

    assert len(matrices) == 1
    m = matrices[0]
    assert m["matrixId"] == "matrix-hsr"
    assert m["name"] == "Matrix for Human Services Courses"
    assert m["anchorName"] == "MatrixHSR"
    assert m["programLevel"] == "bachelors"
    assert m["columnHeaders"] == ["HS101", "HS201", "HS301"]
    assert m["rowsMatched"] == 3
    assert m["columnCount"] == 4

    # 3 specs × 3 column cells = 9 cells total
    assert len(m["cells"]) == 9
    first = m["cells"][0]
    assert first["std"] == "11"
    assert first["spec"] == "a"
    assert first["rowAnchor"] == "matrix-hsr-row-11-a"
    assert first["columnHeader"] == "HS101"
    assert first["contentTypes"] == ["I"]
    assert first["depth"] == "L"

    # consumed table id is recorded so deep_walker can skip it
    assert len(consumed) == 1


def test_build_wire_matrices_html_has_row_anchors():
    template = _toy_template()
    matrices, _ = build_wire_matrices(_toy_html(), template)
    html = matrices[0]["htmlSnippet"]
    # Each matched row gets id="matrix-hsr-row-{std}-{spec}"
    assert 'id="matrix-hsr-row-11-a"' in html
    assert 'id="matrix-hsr-row-11-b"' in html
    assert 'id="matrix-hsr-row-11-c"' in html
    # data attributes carry std/spec for client-side lookups
    assert 'data-std="11"' in html
    assert 'data-spec="a"' in html
    # The cshse-matrix-row class is added so the UI can target the row.
    assert "cshse-matrix-row" in html


def test_build_wire_matrices_no_anchor_returns_empty():
    """If neither MatrixHSR nor Matrix2 anchor exists, return []."""
    template = _toy_template()
    html = b"<html><body><p>No matrix here.</p></body></html>"
    matrices, consumed = build_wire_matrices(html, template)
    assert matrices == []
    assert consumed == set()


def test_matrix_anchors_includes_both_known_names():
    names = {a for (a, _, _) in MATRIX_ANCHORS}
    assert "MatrixHSR" in names
    assert "Matrix2" in names
