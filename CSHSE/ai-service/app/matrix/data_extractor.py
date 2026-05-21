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

# CR-029 — tightened thresholds. Previous fuzzy-token Jaccard floor of 0.3
# let unrelated rows match a template spec when they happened to share a
# few common words ("the", "of", "students", "and") — exactly the "random
# rows from the middle of the table" the user reported. The new floors:
#   - substring overlap: require >=0.70 length-ratio match
#   - token Jaccard: require >=0.55 (was 0.30)
# This drops the recall for genuinely-edited prompts but cuts the false-
# positive rate to near zero; the new "verify against source" UI handles
# any remaining ambiguity by showing the source fragment per row.
_SUBSTRING_MIN_RATIO = 0.70
_JACCARD_MIN = 0.55

# Header / wrapper row patterns that should NEVER be treated as data rows
# even if they happen to overlap with template tokens. These come from the
# CSHSE matrix template itself.
_HEADER_ROW_PATTERNS = (
    "specifications for standard",
    "standard ",
    "demonstrate how the knowledge",
    "knowledge, theory, skills, and values",  # Section-header row inside Stevenson's matrix
    "knowledge, theory, and skills",
    "specifications and courses",
    "course title",
    "course number",
    "introduction",  # Legend headers — not data
)


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
    reasonable match. Two scoring paths:

      1. Substring containment — one prompt is wholly inside the other AND
         the length ratio is >= ``_SUBSTRING_MIN_RATIO``. This is the
         high-precision path; Stevenson's prompts often match here.
      2. Token Jaccard — fallback for prompts the institution rewrote.
         Filters out the most common English stopwords so short prompts
         can't match on noise tokens, and requires >= ``_JACCARD_MIN``.

    CR-029 — previous version accepted Jaccard >= 0.3, which let header /
    wrapper rows match a template spec when they happened to share a few
    common words. New floors push false-positive matches to near zero;
    rows that fail are dropped entirely (no forced placement).
    """
    pn = _normalize_prompt(prompt)
    if len(pn) < 15:
        return None

    # Stopwords excluded from the Jaccard count. Without this, a row like
    # "Demonstrate how the knowledge, theory, and skills…" matches almost
    # every template prompt because it shares "the", "and", "of", etc.
    stopwords = {
        "the", "and", "or", "of", "to", "a", "an", "in", "for", "on", "at",
        "with", "by", "is", "are", "as", "be", "this", "that", "these",
        "those", "how", "what", "which", "their", "students", "demonstrate",
        "show", "knowledge", "theory", "skills", "applied",
    }

    best_i = -1
    best_score = 0.0
    for i, row in enumerate(template.rows):
        rn = _normalize_prompt(row.spec_text)
        if not rn or len(rn) < 15:
            continue

        # Substring path (tight): one fully contained in the other, with
        # length ratio above the threshold. A 200-char prompt matching a
        # 30-char template spec via substring isn't a "match" — it's a
        # row that happens to mention the template's words.
        if pn in rn or rn in pn:
            ratio = min(len(pn), len(rn)) / max(len(pn), len(rn))
            if ratio >= _SUBSTRING_MIN_RATIO and ratio > best_score:
                best_score = ratio
                best_i = i
                continue

        # Jaccard path with stopword filtering. Require both sides to have
        # at least 3 non-stopword tokens — otherwise the Jaccard ratio is
        # dominated by accidental noise.
        p_tokens = {t for t in pn.split() if t not in stopwords and len(t) > 2}
        r_tokens = {t for t in rn.split() if t not in stopwords and len(t) > 2}
        if len(p_tokens) < 3 or len(r_tokens) < 3:
            continue
        inter = p_tokens & r_tokens
        union = p_tokens | r_tokens
        score = len(inter) / max(1, len(union))
        if score > best_score and score >= _JACCARD_MIN:
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

    # CR-029 — two-pass extraction. First pass scores every candidate row
    # against every template row and stores (row_idx, score, tds, prompt_text);
    # second pass picks the SINGLE best source row per template spec so no
    # template spec ever gets two rows assigned. This kills the prior bug
    # where multiple source rows would all match the same template spec at
    # low confidence, polluting the output.
    candidates_per_template: dict[int, list[tuple[float, list, str]]] = {}

    for table in tables:
        rows = table.find_all("tr")
        for r in rows:
            tds = r.find_all(["td", "th"])
            if len(tds) < 2:
                continue
            prompt_text = (tds[0].get_text() or "").strip()
            if len(prompt_text.split()) < _MIN_PROMPT_WORDS:
                continue

            # CR-029 — broader header-row exclusions. Match by ANY of the
            # known patterns (lowercased substring). Previously only two
            # patterns were checked, which let other header rows slip
            # through and get force-matched by the loose Jaccard floor.
            lp = prompt_text.lower()
            if any(pattern in lp for pattern in _HEADER_ROW_PATTERNS):
                # Header rows count as seen-but-skipped for the rows_total
                # metric so the wizard's "X of Y rows matched" stays honest.
                rows_seen += 1
                col_count = max(col_count, len(tds))
                continue

            rows_seen += 1
            col_count = max(col_count, len(tds))

            match = _best_template_match(prompt_text, template)
            if match is None:
                continue
            row_idx, score = match
            candidates_per_template.setdefault(row_idx, []).append(
                (score, list(tds), prompt_text)
            )

    # Second pass — emit cells from the best source row per template spec.
    for row_idx, candidates in candidates_per_template.items():
        # Highest score wins; ties go to the longer prompt (more specific).
        candidates.sort(key=lambda c: (c[0], len(c[2])), reverse=True)
        score, tds, prompt_text = candidates[0]
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
