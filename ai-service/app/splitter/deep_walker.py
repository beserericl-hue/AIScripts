"""Deep document walker for CSHSE self-studies.

CSHSE self-studies are TABLE-TEMPLATED. The subspec letter (a./b./c./...)
often lives in a column that spans multiple rows via ``rowspan``. Naive
row-by-row walks miss the inherited markers entirely.

This walker:
  1. Identifies every top-level (non-nested) ``<table>`` in document order.
  2. Classifies each as ``template_subspec`` | ``curriculum_matrix`` |
     ``data_table`` | ``unknown``.
  3. For ``template_subspec`` tables, **expands rowspan/colspan** into a
     virtual grid so the marker cell is visible on every continuation row,
     then groups rows by the active marker → one Section per subspec.
  4. For ``curriculum_matrix`` and other tables, emits a single Section
     flagged appropriately.
  5. A fallback path captures substantial prose paragraphs that live
     OUTSIDE any table (rare in CSHSE templates but worth catching).

Output: a flat ordered list of ``Section`` records. Downstream pipeline
(embedder + matcher) doesn't care whether the section came from a
``<p>`` or a ``<td>``.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Iterator, Optional

from bs4 import BeautifulSoup, Tag

from app.splitter.sections import Section, _heuristic_flags

# Marker patterns at the head of a cell:
#   "a." / "a)" / "a "  → letter-only (subspec)
#   "1."                  → numeric (standard top-level)
#   "11.a" / "11.a."     → numeric.letter (combined)
_LETTER_MARKER_RE = re.compile(r"^\s*([a-h])\s*[.)]\s*(.*)$", re.IGNORECASE)
_NUMERIC_MARKER_RE = re.compile(
    r"^\s*(\d{1,2})\s*\.?\s*([a-h])?\s*\.?\s*(.*)$", re.IGNORECASE
)
_RESPONSE_PREFIX_RE = re.compile(r"^\s*(response|comment|narrative)\s*[:.]\s*", re.IGNORECASE)
_MATRIX_CELL_RE = re.compile(r"^\s*[ITKSLMH](?:\s*,\s*[ITKSLMH])*\s*$", re.IGNORECASE)
_COURSE_NUMBER_RE = re.compile(r"^\s*[A-Z]{2,5}\s*\d{2,4}\s*$")


def _extract_marker(text: str) -> Optional[tuple[Optional[str], Optional[str]]]:
    """Return (standard?, spec?) extracted from cell text, or None.

    Matches the front of the cell; trailing prose is ignored.
    """
    t = text.strip()
    if not t:
        return None
    m = _LETTER_MARKER_RE.match(t)
    if m:
        return (None, m.group(1).lower())
    m = _NUMERIC_MARKER_RE.match(t)
    if m and m.group(1):
        spec = (m.group(2) or "").lower() or None
        # Guard: don't match "1999" or other long numbers as standard markers.
        if 1 <= len(m.group(1)) <= 2 and len(t.split()) <= 6:
            return (m.group(1), spec)
    return None


# ----------------------------------------------------------- rowspan expansion


@dataclass
class _VirtualCell:
    text: str
    is_rowspan_continuation: bool  # True if inherited from earlier row


def _expand_table_with_spans(table: Tag) -> list[list[_VirtualCell]]:
    """Return a virtual grid (list of rows; each row is a list of VirtualCells)
    with rowspan + colspan correctly accounted for.

    Each cell in the output represents one (row, col) position in the rendered
    table. A cell with ``is_rowspan_continuation=True`` is a position visually
    occupied by a rowspan from a previous row.
    """
    rows = table.find_all("tr", recursive=False) or table.find_all("tr")
    if not rows:
        return []

    grid: list[list[_VirtualCell]] = []
    # active_spans: column_index -> (remaining_rows_after_this_one, text)
    active_spans: dict[int, tuple[int, str]] = {}

    for row in rows:
        cells = row.find_all(["td", "th"], recursive=False)
        # Some HTML has cells deeper than direct children
        if not cells:
            cells = row.find_all(["td", "th"])
        row_grid: list[_VirtualCell] = []
        col_idx = 0
        cell_iter = iter(cells)

        # Walk columns; fill from active_spans first, then from the actual cells.
        # Loop until both sources are exhausted.
        consumed_cell = None
        while True:
            # 1. If a rowspan continuation occupies this column, place it.
            if col_idx in active_spans:
                rem, text = active_spans[col_idx]
                row_grid.append(_VirtualCell(text=text, is_rowspan_continuation=True))
                if rem - 1 <= 0:
                    del active_spans[col_idx]
                else:
                    active_spans[col_idx] = (rem - 1, text)
                col_idx += 1
                continue

            # 2. Otherwise consume the next actual cell from this row.
            if consumed_cell is None:
                consumed_cell = next(cell_iter, None)
            if consumed_cell is None:
                break

            text = (consumed_cell.get_text() or "").strip()
            try:
                rowspan = int(consumed_cell.get("rowspan", 1) or 1)
            except ValueError:
                rowspan = 1
            try:
                colspan = int(consumed_cell.get("colspan", 1) or 1)
            except ValueError:
                colspan = 1

            for span in range(colspan):
                row_grid.append(
                    _VirtualCell(
                        text=text if span == 0 else "",
                        is_rowspan_continuation=False,
                    )
                )
                if rowspan > 1:
                    active_spans[col_idx + span] = (rowspan - 1, text if span == 0 else "")
            col_idx += colspan
            consumed_cell = None  # ready to consume next

        grid.append(row_grid)

    return grid


# --------------------------------------------------------------- classification


def _classify_table(table: Tag) -> str:
    rows = table.find_all("tr")
    if not rows:
        return "unknown"
    cells = table.find_all(["td", "th"])
    letter_combo_cells = sum(1 for c in cells if _MATRIX_CELL_RE.match(c.get_text().strip()))
    course_cells = sum(1 for c in cells if _COURSE_NUMBER_RE.match(c.get_text().strip()))
    if (letter_combo_cells >= 8 or course_cells >= 5) and len(rows) > 5:
        return "curriculum_matrix"

    # Template detection: rowspan-aware. Walk the virtual grid; count distinct
    # rows whose first non-empty cell starts with a marker (a./b./.../1./11.a)
    grid = _expand_table_with_spans(table)
    marker_rows = 0
    for row in grid[:100]:
        first = next((c.text for c in row if c.text), "")
        if first and _extract_marker(first):
            marker_rows += 1
    if marker_rows >= 2:
        return "template_subspec"

    if len(cells) > 12 and len(rows) > 3:
        return "data_table"
    return "unknown"


# --------------------------------------------------------------- subspec rows


def _row_body_text(row_grid: list[_VirtualCell], skip_first: bool = False) -> str:
    """Concatenate the body (non-marker) cells of a virtual row."""
    parts: list[str] = []
    for i, cell in enumerate(row_grid):
        if skip_first and i == 0:
            continue
        if cell.is_rowspan_continuation:
            continue  # body of a rowspan is only counted in its origin row
        if cell.text:
            parts.append(cell.text)
    return " ".join(parts).strip()


def _table_extracts_for_subspec_template(table: Tag, base_id: str) -> list[Section]:
    """Emit one Section per (rowspan-aware) marker group.

    Groups consecutive rows that share the same active marker. Useful when the
    marker cell uses ``rowspan`` to span the prompt + response + extras rows.
    """
    grid = _expand_table_with_spans(table)
    sections: list[Section] = []

    current_marker_key: Optional[str] = None
    current_marker_std: Optional[str] = None
    current_marker_spec: Optional[str] = None
    current_heading: Optional[str] = None
    current_body: list[str] = []

    def flush():
        if not current_marker_key or len(" ".join(current_body).split()) < 8:
            return
        body = "\n\n".join(p for p in current_body if p).strip()
        body = _RESPONSE_PREFIX_RE.sub("", body, count=1)
        flags = _heuristic_flags(body)
        heading = current_heading or current_marker_key
        sections.append(
            Section(
                id=f"{base_id}:tbl:{uuid.uuid4().hex[:8]}",
                heading=heading[:200],
                heading_level=3,
                markdown=body,
                byte_offset_start=0,
                byte_offset_end=0,
                word_count=len(body.split()),
                contains_table=False,
                contains_image=False,
                has_resume_signals=flags["hasResumeSignals"],
                has_syllabus_signals=flags["hasSyllabusSignals"],
                splitter_tier="table_subspec_row",
                flags={
                    **flags,
                    "markerStandard": current_marker_std or "",
                    "markerSpec": current_marker_spec or "",
                },
            )
        )

    for row_grid in grid:
        if not row_grid:
            continue
        first_cell = row_grid[0]
        first_text = first_cell.text.strip()

        # A rowspan-inherited first cell is NEVER a fresh marker — it's the
        # same marker carrying down. Only treat as new-marker when the cell
        # is genuinely a new (not inherited) cell.
        is_continuation = first_cell.is_rowspan_continuation
        marker = (
            _extract_marker(first_text)
            if (first_text and not is_continuation)
            else None
        )

        if marker is not None:
            # New marker group — flush the previous one.
            flush()
            std, spec = marker
            current_marker_std = std
            current_marker_spec = spec
            current_marker_key = f"{std or '?'}.{spec or '?'}"
            current_heading = first_text
            current_body = []
            body_text = _row_body_text(row_grid, skip_first=True)
            if body_text:
                current_body.append(body_text)
        else:
            # Continuation row (rowspan-inherited OR no marker in non-inherited
            # row). Only counts if a marker group is active.
            if current_marker_key is None:
                continue
            if is_continuation:
                # Skip the inherited marker cell; collect the rest.
                body_text = _row_body_text(row_grid, skip_first=True)
            else:
                # No marker on a fresh row — likely a "Response:" prefix row.
                body_text = " ".join(c.text for c in row_grid if c.text and not c.is_rowspan_continuation).strip()
            if body_text:
                current_body.append(body_text)

    flush()
    return sections


def _table_as_one_section(
    table: Tag, base_id: str, table_type: str, heading_text: str = ""
) -> Section | None:
    text = table.get_text("\n", strip=True)
    words = text.split()
    if len(words) < 8:
        return None
    heading = heading_text or {
        "curriculum_matrix": "(curriculum matrix table)",
        "data_table": "(data table)",
        "unknown": "(table)",
    }.get(table_type, "(table)")
    flags = _heuristic_flags(text)
    return Section(
        id=f"{base_id}:tbl:{uuid.uuid4().hex[:8]}",
        heading=heading[:200],
        heading_level=2,
        markdown=text,
        byte_offset_start=0,
        byte_offset_end=0,
        word_count=len(words),
        contains_table=True,
        contains_image=False,
        has_resume_signals=flags["hasResumeSignals"],
        has_syllabus_signals=flags["hasSyllabusSignals"],
        splitter_tier=f"table_{table_type}",
        flags=flags,
    )


# -------------------------------------------------------------- public walkers


def _iter_top_level_tables(soup: BeautifulSoup) -> Iterator[Tag]:
    """Yield every <table> that is NOT nested inside another <table>, in
    document order."""
    body = soup.body or soup
    for table in body.find_all("table"):
        nested = False
        for anc in table.parents:
            if anc.name == "table":
                nested = True
                break
        if not nested:
            yield table


def deep_walk(html_bytes: bytes, base_id: str = "doc") -> list[Section]:
    """Extract sections by walking every top-level table."""
    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()
    for tag in soup.find_all(class_="extracted-section-placeholder"):
        tag.decompose()

    sections: list[Section] = []
    for table in _iter_top_level_tables(soup):
        table_type = _classify_table(table)
        if table_type == "template_subspec":
            sections.extend(_table_extracts_for_subspec_template(table, base_id))
        else:
            sec = _table_as_one_section(table, base_id, table_type)
            if sec:
                sections.append(sec)
    return sections


def _is_inside_table(tag: Tag) -> bool:
    for a in tag.parents:
        if a.name == "table":
            return True
    return False


def deep_walk_with_fallback(
    html_bytes: bytes, base_id: str = "doc", min_prose_words: int = 50
) -> list[Section]:
    """Walk tables AND emit sections for substantial non-table prose blocks."""
    table_sections = deep_walk(html_bytes, base_id)

    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()

    prose_sections: list[Section] = []
    for p in soup.find_all("p"):
        if _is_inside_table(p):
            continue
        text = p.get_text().strip()
        if len(text.split()) < min_prose_words:
            continue
        flags = _heuristic_flags(text)
        prose_sections.append(
            Section(
                id=f"{base_id}:prose:{uuid.uuid4().hex[:8]}",
                heading=text[:120],
                heading_level=2,
                markdown=text,
                byte_offset_start=0,
                byte_offset_end=0,
                word_count=len(text.split()),
                contains_table=False,
                contains_image=False,
                has_resume_signals=flags["hasResumeSignals"],
                has_syllabus_signals=flags["hasSyllabusSignals"],
                splitter_tier="prose_outside_table",
                flags=flags,
            )
        )

    return table_sections + prose_sections
