"""CR-029 — pin the tightened matrix-row extraction so it can't regress.

The previous extractor used a token-Jaccard floor of 0.30, which let header
rows and unrelated rows get force-matched to template specs when they
happened to share common English words. These tests pin:

  - Header / wrapper rows do NOT emerge as data rows.
  - Random-prose rows below the new substring/Jaccard floors do NOT match.
  - Each template spec receives AT MOST one source row (best score wins).
  - Substring containment still works for institutional prompts that
    closely follow the template wording.
"""
from __future__ import annotations

import pytest

from app.matrix.data_extractor import (
    _best_template_match,
    _HEADER_ROW_PATTERNS,
    _JACCARD_MIN,
    _SUBSTRING_MIN_RATIO,
    extract_matrix,
)
from app.matrix.template_loader import MatrixRow, MatrixTemplate


def _tpl(rows: list[MatrixRow]) -> MatrixTemplate:
    return MatrixTemplate(
        program_level="bachelors",
        source_filename="test-template.docx",
        legend={"I": "Introduce", "T": "Theory", "K": "Knowledge", "S": "Skills"},
        rows=tuple(rows),
        column_count=13,
    )


def test_substring_match_above_ratio_accepts():
    tpl = _tpl([
        MatrixRow(
            standard_code="11",
            spec_text="The historical roots of human services",
            spec_code="a",
            standard_title="History",
        ),
    ])
    # Institutional prompt = template + a few trailing words. Should match
    # via substring with ratio close to 1.0.
    prompt = "The historical roots of human services."
    res = _best_template_match(prompt, tpl)
    assert res is not None
    row_idx, score = res
    assert row_idx == 0
    assert score >= _SUBSTRING_MIN_RATIO


def test_substring_match_below_ratio_rejects():
    """A short template prompt inside a much longer rambling row is NOT
    a match — the length ratio falls below the threshold."""
    tpl = _tpl([
        MatrixRow(
            standard_code="11",
            spec_text="historical roots",  # short
            spec_code="a",
            standard_title="History",
        ),
    ])
    prompt = (
        "Demonstrate how the historical roots of the program contribute "
        "to the development of human services in a broad social context "
        "with reference to multiple disciplines and methodologies"
    )
    res = _best_template_match(prompt, tpl)
    # Should be None — the template is a 2-word fragment, the prompt is
    # 30+ words, length ratio is far below 0.70.
    assert res is None or res[1] < _SUBSTRING_MIN_RATIO


def test_jaccard_below_floor_rejects_stopword_overlap():
    """Two rows sharing only common English stopwords ('the', 'of', 'and')
    must NOT match — that's the prior bug where header rows snuck in."""
    tpl = _tpl([
        MatrixRow(
            standard_code="11",
            spec_text="Theories of human development applied to client problems",
            spec_code="a",
            standard_title="History",
        ),
    ])
    # Row shares "of", "the", "human", "and" but is semantically unrelated.
    prompt = "Submit copies of the human resources policy and procedures"
    res = _best_template_match(prompt, tpl)
    # Either no match or score below the floor.
    assert res is None or res[1] < _JACCARD_MIN


def test_jaccard_above_floor_accepts_real_match():
    """Genuine paraphrase of a template spec should still match through
    the Jaccard path (substring fails when the institution rewrote the
    sentence structure)."""
    tpl = _tpl([
        MatrixRow(
            standard_code="13",
            spec_text="The continuum of care service-delivery model",
            spec_code="a",
            standard_title="Human Services Delivery Systems",
        ),
    ])
    # Different word order, same content tokens.
    prompt = "Service-delivery model and the continuum of care across populations"
    res = _best_template_match(prompt, tpl)
    assert res is not None
    row_idx, score = res
    assert row_idx == 0


def test_one_to_one_best_match_per_template_spec():
    """If two source rows would match the same template spec, only the
    higher-scoring one is emitted. Previously both got cells assigned
    to the same (std, spec), creating duplicate-row pollution."""
    template = _tpl([
        MatrixRow(
            standard_code="11",
            spec_text="The historical roots of human services",
            spec_code="a",
            standard_title="History",
        ),
    ])
    html = """
    <html><body>
      <a name="MatrixHSR"></a>
      <table>
        <tr><th>Spec</th><th>CHS 105</th><th>CHS 224</th><th>CHS 380</th></tr>
        <tr>
          <td>The historical roots of human services.</td>
          <td>IKM</td><td>TM</td><td>K</td>
        </tr>
        <tr>
          <td>The historical roots of human services and theory.</td>
          <td>K</td><td>T</td><td>I</td>
        </tr>
      </table>
    </body></html>
    """.encode()
    result = extract_matrix(html, template, anchor="MatrixHSR")
    # Should match exactly ONE template row (best of the two source rows).
    # Cells must all come from that one source row, not both.
    distinct_prompts = {c.spec_prompt for c in result.cells}
    assert len(distinct_prompts) == 1, (
        f"Two rows matched the same template spec — got prompts: {distinct_prompts}"
    )
    assert result.rows_matched == 1


def test_header_row_patterns_are_skipped():
    """Rows whose first cell is a known section header / wrapper must
    not emerge as data rows even if the Jaccard token overlap is high."""
    tpl = _tpl([
        MatrixRow(
            standard_code="11",
            spec_text="The historical roots of human services",
            spec_code="a",
            standard_title="History",
        ),
    ])
    # The wrapper text "Specifications for Standard 11" is a header inside
    # Stevenson's matrix and previously got emitted because of loose
    # Jaccard matching.
    for header in (
        "Specifications for Standard 11",
        "Standard 11: The curriculum shall include the historical development",
        "Knowledge, Theory, Skills, and Values",
        "Course Title",
    ):
        # Confirm the lowercased substring is in our pattern list.
        lp = header.lower()
        assert any(p in lp for p in _HEADER_ROW_PATTERNS), (
            f"header {header!r} not covered by _HEADER_ROW_PATTERNS"
        )


def test_extract_matrix_drops_header_rows_even_with_high_token_overlap():
    """End-to-end: a header row that token-overlaps a template spec is
    still dropped because the header pattern fires before scoring."""
    tpl = _tpl([
        MatrixRow(
            standard_code="11",
            spec_text="The historical roots of human services",
            spec_code="a",
            standard_title="History",
        ),
    ])
    html = """
    <html><body>
      <a name="MatrixHSR"></a>
      <table>
        <tr><th>Spec</th><th>CHS 105</th><th>CHS 224</th><th>CHS 380</th></tr>
        <tr>
          <td>Specifications for Standard 11 — historical roots of human services</td>
          <td>IKM</td><td>TM</td><td>K</td>
        </tr>
        <tr>
          <td>The historical roots of human services.</td>
          <td>K</td><td>T</td><td>IK</td>
        </tr>
      </table>
    </body></html>
    """.encode()
    result = extract_matrix(html, tpl, anchor="MatrixHSR")
    # The header-style first row must NOT produce cells. Only the real
    # data row survives.
    assert result.rows_matched == 1
    assert all("specifications for standard" not in c.spec_prompt.lower() for c in result.cells)
