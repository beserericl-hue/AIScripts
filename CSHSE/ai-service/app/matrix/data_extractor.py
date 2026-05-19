"""Extract filled curriculum-matrix data from a CSHSE self-study.

Given:
  - The parsed HTML of the self-study (mammoth output of the original DOCX)
  - The MatrixTemplate for the program level (defines expected row prompts)

Produce:
  - One ``MatrixCellData`` per filled cell: (std, spec, course_col, code)
  - Decoded codes via the template's legend (I=Introduce, T=Theory, etc.)

CSHSE matrix tables are anchored at `#MatrixHSR` (Required Human Services
Courses) and `#Matrix2` (Non-Major Courses). The header row is usually a
colspan'd title — column course names are not always in-table; the wizard
asks the user to confirm the course list per column.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from bs4 import BeautifulSoup, Tag

from app.matrix.template_loader import MatrixTemplate

# Curriculum-matrix cells are concatenations of I/T/K/S (content) + L/M/H
# (depth). Some institutions (e.g. Stevenson's Matrix2) author cells with
# commas, spaces, or periods between the letters — "I,KM" and "KT M" are
# semantically identical to "IKM"/"KTM". Strip those before matching.
_CELL_CODE_STRIP_RE = re.compile(r"[\s,.;/]+")
_CELL_CODE_RE = re.compile(r"^[ITKSLMH]{1,8}$", re.IGNORECASE)
# A row is a "matrix data row" if its first cell is substantive prose.
_MIN_PROMPT_WORDS = 3
# Known matrix anchors used to stop one matrix's scan at the start of the next.
_MATRIX_ANCHOR_NAMES = ("MatrixHSR", "Matrix2")


def _normalize_cell_code(raw: str) -> str:
    """Strip whitespace, commas, periods, slashes — Stevenson's Matrix2 uses
    "I,KM" / "KT M" interchangeably with "IKM" / "KTM"."""
    return _CELL_CODE_STRIP_RE.sub("", raw).upper()


@dataclass
class MatrixCellData:
    standard_code: str          # e.g. "11"
    spec_code: str | None       # e.g. "b" — may be None if row didn't align to a template spec
    spec_prompt: str            # the literal prompt text from the row
    column_index: int           # 0-based, where 0 is the prompt cell
    code_raw: str               # e.g. "ITKSH"
    content_types: list[str] = field(default_factory=list)   # ["I","T","K","S"]
    depth: str | None = None    # "L"|"M"|"H"
    confidence: float = 1.0     # 1.0 = exact template match; lower if fuzzy


@dataclass
class MatrixExtractionResult:
    matrix_name: str            # "MatrixHSR" or "Matrix2"
    program_level: str
    cells: list[MatrixCellData]
    rows_matched: int           # number of template rows we matched
    rows_total: int             # total prompt rows seen in the table
    column_count: int


def _decode_code(raw: str) -> tuple[list[str], str | None]:
    """Decode a concatenated code like "ITKSH" into content+depth components."""
    content: list[str] = []
    depth: str | None = None
    for ch in raw.upper():
        if ch in "ITKS":
            content.append(ch)
        elif ch in "LMH":
            # Last L/M/H wins (depth is usually one character)
            depth = ch
    return content, depth


def _matrix_anchor_tables(soup: BeautifulSoup, anchor: str) -> list[Tag]:
    """Return candidate matrix tables appearing after ``anchor`` and BEFORE
    the next named matrix anchor.

    Pre-filter is coarse — real precision comes from anchor scoping +
    template-prompt matching + cell-code regex. We deliberately stop the
    scan at the next ``_MATRIX_ANCHOR_NAMES`` anchor so MatrixHSR's walk
    doesn't accidentally pick up tables belonging to Matrix2 (which lives
    later in the document).
    """
    target = soup.find(attrs={"id": anchor}) or soup.find("a", attrs={"name": anchor})
    if not target:
        return []
    other_anchors = {a for a in _MATRIX_ANCHOR_NAMES if a != anchor}
    out: list[Tag] = []
    for el in target.find_all_next():
        # Stop as soon as we hit another matrix's anchor.
        if other_anchors:
            el_id = el.get("id") if hasattr(el, "get") else None
            el_name = el.get("name") if hasattr(el, "get") else None
            if el_id in other_anchors or el_name in other_anchors:
                break
        if el.name == "table":
            rows = el.find_all("tr")
            if not rows:
                continue
            max_cols = max(len(r.find_all(["td", "th"])) for r in rows)
            if max_cols >= 4 and len(rows) >= 3:
                out.append(el)
    return out


def _normalize_prompt(s: str) -> str:
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def _best_template_match(prompt: str, template: MatrixTemplate) -> tuple[int, float] | None:
    """Pick the template row whose ``spec_text`` best matches this prompt.

    Returns ``(template_row_index, confidence_0_to_1)`` or ``None`` if no
    reasonable match. Uses normalized substring overlap — Stevenson's prompt
    often exactly matches the template's spec_text.
    """
    pn = _normalize_prompt(prompt)
    if len(pn) < 15:
        return None

    best_i = -1
    best_score = 0.0
    for i, row in enumerate(template.rows):
        rn = _normalize_prompt(row.spec_text)
        if not rn:
            continue
        # Exact-substring on either side
        if pn in rn or rn in pn:
            score = min(len(pn), len(rn)) / max(len(pn), len(rn))
            if score > best_score:
                best_score = score
                best_i = i
        else:
            # Token overlap (Jaccard on whitespace tokens)
            p_tokens = set(pn.split())
            r_tokens = set(rn.split())
            if not p_tokens or not r_tokens:
                continue
            inter = p_tokens & r_tokens
            union = p_tokens | r_tokens
            score = len(inter) / max(1, len(union))
            if score > best_score and score >= 0.3:
                best_score = score
                best_i = i
    if best_i < 0:
        return None
    return best_i, round(best_score, 3)


def extract_matrix(
    html_bytes: bytes,
    template: MatrixTemplate,
    anchor: str = "MatrixHSR",
) -> MatrixExtractionResult:
    """Walk the matrix table and emit per-cell data tagged by (std, spec)."""
    soup = BeautifulSoup(html_bytes, "html.parser")
    for noise in soup(["script", "style", "head"]):
        noise.decompose()

    tables = _matrix_anchor_tables(soup, anchor)
    cells: list[MatrixCellData] = []
    rows_seen = 0
    rows_matched = 0
    col_count = 0

    for table in tables:
        rows = table.find_all("tr")
        for r in rows:
            tds = r.find_all(["td", "th"])
            if len(tds) < 2:
                continue
            prompt_text = (tds[0].get_text() or "").strip()
            if len(prompt_text.split()) < _MIN_PROMPT_WORDS:
                continue
            # Skip wrapper / section-header prompts
            lp = prompt_text.lower()
            if lp.startswith(("specifications for standard", "standard ")):
                continue
            if "knowledge, theory, skills" in lp and "demonstrate" not in lp:
                continue
            rows_seen += 1
            col_count = max(col_count, len(tds))

            match = _best_template_match(prompt_text, template)
            if match is None:
                continue
            row_idx, score = match
            rows_matched += 1
            t_row = template.rows[row_idx]

            for ci, c in enumerate(tds[1:], start=1):
                raw = (c.get_text() or "").strip()
                if not raw:
                    continue
                # Normalise out commas/spaces/periods/slashes that some
                # institutions use as cell separators ("I,KM" / "KT M").
                normalised = _normalize_cell_code(raw)
                if not _CELL_CODE_RE.match(normalised):
                    continue
                ctypes, depth = _decode_code(normalised)
                cells.append(
                    MatrixCellData(
                        standard_code=t_row.standard_code,
                        spec_code=t_row.spec_code,
                        spec_prompt=prompt_text[:200],
                        column_index=ci,
                        code_raw=raw,
                        content_types=ctypes,
                        depth=depth,
                        confidence=score,
                    )
                )

    return MatrixExtractionResult(
        matrix_name=anchor,
        program_level=template.program_level,
        cells=cells,
        rows_matched=rows_matched,
        rows_total=rows_seen,
        column_count=col_count,
    )
