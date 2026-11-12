"""Curriculum-matrix EXCLUSION helpers.

CSHSE board decision (Nov 2026): the curriculum matrix is no longer part of
the self-study — it is a prep tool used OUTSIDE it. Any matrix a program still
leaves in an upload must NOT be indexed: never a section, bucket, narrative,
evidence item, tag, appendix file or coverage input.

Nothing in this module recognises a matrix in order to USE it. Every helper
exists ONLY so the walkers / detectors can DROP a matrix they encounter.
Keep it that way: no extraction, no routing, no wire format.
"""
from __future__ import annotations

import re
from typing import Iterable

# --------------------------------------------------------------------- titles
# The official form title ("Matrix Illustrating Relationship of Required
# Courses to Curriculum Standards") and the common short names.
_TITLE_RE = re.compile(
    r"curriculum\s+matri(?:x|ces)"
    r"|matrix\s+illustrating\s+(?:the\s+)?relationship"
    r"|relationship\s+of\s+required\s+courses\s+to\s+(?:the\s+)?curriculum\s+standards",
    re.I,
)
# A title line is short; a long paragraph that merely MENTIONS the phrase is
# prose and is left alone.
_TITLE_MAX_WORDS = 30


def is_curriculum_matrix_title(text: str | None) -> bool:
    """True for a short title/heading/file name that names the curriculum
    matrix (so the titled block, appendix or document is dropped)."""
    if not text:
        return False
    t = text.strip()
    n_words = len(t.split())
    if n_words > _TITLE_MAX_WORDS:
        return False
    # A full sentence that merely mentions the matrix ("Our curriculum matrix
    # was revised in 2024.") is prose, not a title — leave it alone.
    if n_words > 8 and t.endswith((".", "?", "!")):
        return False
    return bool(_TITLE_RE.search(t))


# A matrix KEY/legend line ("I = Introduced, K = Knowledge, T = Theory,
# S = Skills; L = Low, M = Medium, H = High") — part of the matrix, not prose.
_LEGEND_TERM_RES = [
    re.compile(r"\bI\s*[=:\-–—]\s*Introduc", re.I),
    re.compile(r"\bK\s*[=:\-–—]\s*Knowledge", re.I),
    re.compile(r"\bT\s*[=:\-–—]\s*(?:Theory|Taught|Teach)", re.I),
    re.compile(r"\bS\s*[=:\-–—]\s*Skill", re.I),
    re.compile(r"\bL\s*[=:\-–—]\s*Low", re.I),
    re.compile(r"\bM\s*[=:\-–—]\s*(?:Medium|Moderate)", re.I),
    re.compile(r"\bH\s*[=:\-–—]\s*High", re.I),
]


def is_curriculum_matrix_legend(text: str | None) -> bool:
    """True for the matrix's coding key line (3+ of the I/K/T/S + L/M/H
    definitions in one short block)."""
    if not text or len(text.split()) > 60:
        return False
    return sum(1 for r in _LEGEND_TERM_RES if r.search(text)) >= 3


def is_curriculum_matrix_text_block(text: str | None) -> bool:
    """A standalone text block that belongs to a matrix (its title or its
    coding key) and is dropped along with it."""
    return is_curriculum_matrix_title(text) or is_curriculum_matrix_legend(text)


# -------------------------------------------------------------------- anchors
# Bookmark ids the CSHSE matrix template ships with (MatrixHSR, Matrix2, …).
def is_curriculum_matrix_anchor(name: str | None) -> bool:
    return bool(name) and name.lower().startswith("matrix")


# --------------------------------------------------------- flattened PDF rows
# A linear PDF text extractor flattens each matrix row into
# "<spec label> <cell> <cell> …" ("Intake interviewing HHH HHMXHHH M M M …").
# That run is UNMISTAKABLE — 4+ consecutive UPPERCASE tokens drawn only from the
# coverage alphabet {X,H,M,L,I,K,T,S}. Real prose never produces it.
# Case-sensitive so lowercase words like "it is this list" can never match.
_CELL_RUN_RE = re.compile(r"(?:\b[XHMLIKTS]{1,8}\b[ \t.,]*){4,}")


def strip_curriculum_matrix_cells(text: str) -> str:
    """Strip flattened matrix cell runs out of narrative text. Text with no
    cell run is returned UNCHANGED (clean prose is never touched)."""
    if not text or not _CELL_RUN_RE.search(text):
        return text
    cleaned = _CELL_RUN_RE.sub(" ", text)
    return re.sub(r"[ \t]{2,}", " ", cleaned).strip()


def is_curriculum_matrix_row(text: str) -> bool:
    """True when a chunk is essentially one flattened matrix ROW — once the
    cell runs are stripped only a 1–4 word topic label remains. Real
    narratives survive the strip with many words."""
    if not text or not _CELL_RUN_RE.search(text):
        return False
    words = re.findall(r"[A-Za-z]{3,}", strip_curriculum_matrix_cells(text))
    return len(words) < 5


# ------------------------------------------------------------- HTML/DOCX grid
# Matrix cell content: I (Introduced) / T (Theory) / K (Knowledge) / S (Skill)
# with L/M/H depth — "ITM", "KSH", "I,T,M", or single letters; some programs
# use x / ✓ marks instead.
_GRID_CELL_RE = re.compile(r"^\s*[ITKSLMH]{1,6}(?:\s*,\s*[ITKSLMH]{1,6})*\s*$", re.I)
_GRID_X_CELL_RE = re.compile(r"^\s*[xX✓]\s*$")
_SPECS_FOR_STD_RE = re.compile(r"Specifications?\s+for\s+Standard\s+\d{1,2}", re.I)
_HANDBOOK_VERB_RE = re.compile(
    r"^\s*(Provide|Describe|Demonstrate|Include|Articulate|Identify|"
    r"Document|Indicate|Specify|List|Outline|Explain|Address|Discuss)\b",
    re.I,
)


def looks_like_curriculum_matrix_grid(cell_texts: list[str], first_col_texts: list[str], n_rows: int) -> bool:
    """Shape test on a table's cells: a spec-row × course-column grid filled
    with I/K/T/S + L/M/H codes (or x marks). Course numbers ALONE never make a
    matrix — a plain list of required courses is ordinary evidence."""
    if n_rows < 4:
        return False
    code_cells = _code_cell_count(cell_texts)
    nonempty = sum(1 for t in cell_texts if t.strip())
    # A real matrix is DOMINATED by code cells; a roster with a few "MS"
    # degree cells is not (ratio guard).
    if code_cells >= 4 and code_cells >= 0.25 * max(1, nonempty):
        return True
    if code_cells == 0:
        return False
    if any(_SPECS_FOR_STD_RE.search(t) for t in cell_texts):
        return True
    verb_rows = sum(1 for t in first_col_texts if _HANDBOOK_VERB_RE.match(t) and len(t.split()) > 4)
    return verb_rows >= 3


def _preceding_matrix_context(table, max_blocks: int = 3) -> str | None:
    """``"anchor"`` when the table sits under a matrix bookmark (MatrixHSR …),
    ``"title"`` when one of the few preceding text blocks is a matrix title,
    else ``None``. Never looks across another table or an <h1>."""
    seen_blocks = 0
    for el in table.find_all_previous():
        name = getattr(el, "name", None)
        if name is None:
            continue
        if is_curriculum_matrix_anchor(el.get("id")) or (
            name == "a" and is_curriculum_matrix_anchor(el.get("name"))
        ):
            return "anchor"
        if name == "table":
            return None
        if name in ("p", "h1", "h2", "h3", "h4", "h5", "h6", "caption"):
            text = el.get_text(" ", strip=True)
            if text:
                if is_curriculum_matrix_title(text):
                    return "title"
                seen_blocks += 1
                if name == "h1" or seen_blocks >= max_blocks:
                    return None
    return None


def _code_cell_count(cell_texts: list[str]) -> int:
    return sum(1 for t in cell_texts if _GRID_CELL_RE.match(t) or _GRID_X_CELL_RE.match(t))


def is_curriculum_matrix_table(table) -> bool:
    """True when a BeautifulSoup ``<table>`` is a curriculum matrix:
      * it sits under a matrix bookmark (MatrixHSR, Matrix2, …); or
      * its caption / first cells, or the text just above it, carry the matrix
        title AND it holds at least one I/K/T/S/L/M/H (or x) code cell; or
      * its cells form the matrix code grid on their own.
    A titled table with NO code cells (e.g. a plain list of required courses
    under an old "Provide a curriculum matrix" prompt) is kept."""
    rows = table.find_all("tr")
    cells = table.find_all(["td", "th"])
    cell_texts = [c.get_text(" ", strip=True) for c in cells]
    ctx = _preceding_matrix_context(table)
    if ctx == "anchor":
        return True
    has_codes = _code_cell_count(cell_texts) > 0
    cap = table.find("caption")
    titled = (
        ctx == "title"
        or (cap is not None and is_curriculum_matrix_title(cap.get_text(" ", strip=True)))
        or any(is_curriculum_matrix_title(t) for t in cell_texts[:6])
    )
    if titled and has_codes:
        return True
    first_col = []
    for r in rows[:60]:
        tds = r.find_all(["td", "th"])
        if tds:
            first_col.append(tds[0].get_text(" ", strip=True))
    return looks_like_curriculum_matrix_grid(cell_texts, first_col, len(rows))


def is_curriculum_matrix_table_html(table_html: str) -> bool:
    """``is_curriculum_matrix_table`` for a table serialized to HTML on its own
    (no surrounding document context)."""
    if not table_html or "<t" not in table_html:
        return False
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(table_html, "html.parser")
    table = soup.find("table")
    return bool(table is not None and is_curriculum_matrix_table(table))


def drop_curriculum_matrix_detections(detections: Iterable, title_attrs: tuple[str, ...] = ("title", "heading", "label")) -> tuple[list, list]:
    """Split detector output into (kept, dropped) — a detection whose title
    names the curriculum matrix is dropped so the matrix document is never
    stored or indexed. Works on dicts or objects."""
    kept, dropped = [], []
    for d in detections or []:
        titles = []
        for a in title_attrs:
            v = d.get(a) if isinstance(d, dict) else getattr(d, a, None)
            if isinstance(v, str):
                titles.append(v)
        (dropped if any(is_curriculum_matrix_title(t) for t in titles) else kept).append(d)
    return kept, dropped
