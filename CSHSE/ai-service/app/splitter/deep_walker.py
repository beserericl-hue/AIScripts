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

from app.splitter.sections import Section, _heuristic_flags, extract_images_from_tag

# Marker patterns at the head of a cell:
#   "a." / "a)" / "a "  → letter-only (subspec)
#   "1."                  → numeric (standard top-level)
#   "11.a" / "11.a."     → numeric.letter (combined)
_LETTER_MARKER_RE = re.compile(r"^\s*([a-h])\s*[.)]\s*(.*)$", re.IGNORECASE)
_NUMERIC_MARKER_RE = re.compile(
    r"^\s*(\d{1,2})\s*\.?\s*([a-h])?\s*\.?\s*(.*)$", re.IGNORECASE
)
_RESPONSE_PREFIX_RE = re.compile(r"^\s*(response|comment|narrative)\s*[:.]\s*", re.IGNORECASE)
# CSHSE curriculum-matrix cell content. Three formats observed in real
# self-studies:
#   1. Concatenated letters: ITM, KSH, IL, ITKL, TKSH (most common)
#   2. Comma-separated:      I,T,M
#   3. Single letter:        I or T or K
# Letters: I (Introduce), T (Teach/Theory), K (Knowledge), S (Skill),
#          L/M/H (Low/Moderate/High depth)
_MATRIX_CELL_RE = re.compile(
    r"^\s*[ITKSLMH]{1,6}(?:\s*,\s*[ITKSLMH]{1,6})*\s*$", re.IGNORECASE
)
# Some CSHSE matrices use 'x' marks instead of letter combos.
_MATRIX_X_CELL_RE = re.compile(r"^\s*[xX✓]\s*$")
_COURSE_NUMBER_RE = re.compile(r"^\s*[A-Z]{2,5}\s*\d{2,4}(?:\s*/\s*\d{2,4})?\s*$")
# Strong signal: the literal phrase "Specifications for Standard N" appears
# in a cell. This indicates a curriculum-matrix table almost certainly.
_SPECS_FOR_STD_RE = re.compile(r"Specifications?\s+for\s+Standard\s+\d{1,2}", re.IGNORECASE)
# Handbook subspec prompts almost always start with one of these imperative
# verbs. When the FIRST column of a table is filled with these prompts, the
# table is a curriculum-matrix template for some Standard.
_HANDBOOK_VERB_RE = re.compile(
    r"^\s*(Provide|Describe|Demonstrate|Include|Articulate|Identify|"
    r"Document|Indicate|Specify|List|Outline|Explain|Address|Discuss)\b",
    re.IGNORECASE,
)


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

    # ---- curriculum_matrix signals (any one strong signal is enough) -----
    cell_texts = [c.get_text().strip() for c in cells]

    letter_combo_cells = sum(1 for txt in cell_texts if _MATRIX_CELL_RE.match(txt))
    x_mark_cells = sum(1 for txt in cell_texts if _MATRIX_X_CELL_RE.match(txt))
    course_cells = sum(1 for txt in cell_texts if _COURSE_NUMBER_RE.match(txt))

    # Strong textual signal: a cell explicitly says "Specifications for Standard N"
    has_specs_for_std = any(_SPECS_FOR_STD_RE.search(txt) for txt in cell_texts)

    # First-column rows with Handbook-imperative verbs (Provide/Describe/...)
    # indicate the column 0 is a list of spec prompts — classic matrix shape.
    first_col_verb_rows = 0
    for r in rows[:60]:
        tds = r.find_all(["td", "th"])
        if not tds:
            continue
        first_txt = (tds[0].get_text() or "").strip()
        if _HANDBOOK_VERB_RE.match(first_txt) and len(first_txt.split()) > 4:
            first_col_verb_rows += 1

    # A curriculum matrix is a GRID — it MUST have grid-content cells
    # (letter combos, x-marks, or course numbers). A template-subspec table
    # also has Handbook-verb rows in column 0, so verb count alone is not
    # enough — require grid content alongside.
    has_grid_content = (
        (letter_combo_cells + x_mark_cells) >= 4 or course_cells >= 5
    )
    # Weaker signal: explicit "Specifications for Standard N" header + ANY
    # grid hint (even one letter combo / one x-mark / one course cell).
    soft_grid_content = (
        letter_combo_cells > 0 or x_mark_cells > 0 or course_cells > 0
    )

    if has_grid_content and len(rows) >= 4:
        return "curriculum_matrix"
    if has_specs_for_std and soft_grid_content and len(rows) >= 4:
        return "curriculum_matrix"
    if first_col_verb_rows >= 3 and soft_grid_content and len(rows) >= 4:
        return "curriculum_matrix"

    # ---- template_subspec (rowspan-aware) -----
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


def _table_extracts_for_subspec_template(table: Tag, base_id: str, order_start: int = 0) -> list[Section]:
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

    # CR-031 — assign a monotonic document-order index to each emitted
    # Section. Stored in byte_offset_start; semantic is "earlier sections
    # have lower numbers." Used by the wizard's nearestPlacedNeighbor
    # helper to figure out which placed item sits just above an unplaced
    # one in the source document.
    order_counter = [order_start]
    def _next_order() -> int:
        order_counter[0] += 1
        return order_counter[0]

    def flush():
        if not current_marker_key or len(" ".join(current_body).split()) < 8:
            return
        body = "\n\n".join(p for p in current_body if p).strip()
        body = _RESPONSE_PREFIX_RE.sub("", body, count=1)
        flags = _heuristic_flags(body)
        heading = current_heading or current_marker_key
        order = _next_order()
        sections.append(
            Section(
                id=f"{base_id}:tbl:{uuid.uuid4().hex[:8]}",
                heading=heading[:200],
                heading_level=3,
                markdown=body,
                byte_offset_start=order,
                # CR-040 Phase 3b — byte_offset_end now reflects the
                # section's content size (in words, the natural unit our
                # coverage census uses) rather than being a duplicate of
                # _start. The interval map becomes meaningful so byte-level
                # census and gap detection can compute a real coverage %.
                byte_offset_end=order + max(1, len(body.split())),
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
    table: Tag, base_id: str, table_type: str, heading_text: str = "", order: int = 0
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
    # CR-040 Phase 2 — capture every <img> inside this table so figures
    # embedded in source DOCX appendix tables aren't silently dropped.
    images = extract_images_from_tag(table, base_byte_offset=order)
    return Section(
        id=f"{base_id}:tbl:{uuid.uuid4().hex[:8]}",
        heading=heading[:200],
        heading_level=2,
        markdown=text,
        # CR-031 — document-order index passed in by the caller.
        byte_offset_start=order,
        # CR-040 Phase 3b — non-collapsed end so coverage census sees a
        # real extent (size = word count).
        byte_offset_end=order + max(1, len(words)),
        word_count=len(words),
        contains_table=True,
        contains_image=bool(images),
        has_resume_signals=flags["hasResumeSignals"],
        has_syllabus_signals=flags["hasSyllabusSignals"],
        splitter_tier=f"table_{table_type}",
        flags=flags,
        # Preserve the original <table> so the wizard's review UI can show
        # rows and columns instead of get_text()'s newline-flattened blob.
        html_snippet=str(table),
        images=images,
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


# Anchor names the matrix extractor claims. ANY top-level table whose
# nearest preceding anchor (id or <a name>) is one of these is treated
# as a matrix table by deep_walker and skipped unconditionally — even
# if _classify_table would otherwise tag it as template_subspec. Without
# this guard, rows from a curriculum matrix can leak into the section
# list as Unplaced narratives (regression observed 2026-05-22).
_KNOWN_MATRIX_ANCHOR_NAMES = ("MatrixHSR", "Matrix2")


def _is_table_under_matrix_anchor(table: Tag) -> bool:
    """Walk backwards through previous siblings and ancestors looking for
    a recently-named matrix anchor before any other matrix anchor or a
    new top-level <h1>/<h2> heading. If the nearest such anchor before
    this table is one of the known matrix anchor names, treat the table
    as matrix-owned and skip it.

    Matches the same anchor-resolution logic the matrix extractor uses,
    so deep_walker and build_wire_matrices stay in lock-step.
    """
    # Walk up + back through previous elements in document order. We use
    # find_all_previous which yields preceding elements in reverse-document
    # order — perfect for "find the nearest anchor that owns me".
    for el in table.find_all_previous():
        if el.name in ("h1",):
            # Crossed a major-section header without finding a matrix
            # anchor first — this table is not matrix-owned.
            return False
        if hasattr(el, "get"):
            el_id = el.get("id")
            el_name = el.get("name") if el.name == "a" else None
            if el_id in _KNOWN_MATRIX_ANCHOR_NAMES or el_name in _KNOWN_MATRIX_ANCHOR_NAMES:
                return True
    return False


def deep_walk(
    html_bytes: bytes,
    base_id: str = "doc",
    skip_matrices: bool = True,
) -> list[Section]:
    """Extract sections by walking every top-level table.

    When ``skip_matrices`` is True (the default), tables classified as
    ``curriculum_matrix`` are NOT emitted as data-table sections — they
    are handled by the matrix extractor (see ``matrix/wire_format.py``)
    and surfaced in the wizard as first-class entities. Without this
    skip, the same matrix would show up both as "(curriculum matrix
    table)" cards under random specs AND as a structured matrix entry.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()
    for tag in soup.find_all(class_="extracted-section-placeholder"):
        tag.decompose()

    sections: list[Section] = []
    # CR-031 — monotonic document-order index across all emitted sections.
    # Threaded through the table-bounded helpers so per-row sections inside
    # a single table still get unique increasing indices.
    order_cursor = 0
    for table in _iter_top_level_tables(soup):
        # Anchor-first skip: ANY table owned by a known matrix anchor
        # belongs to the matrix extractor, NOT to deep_walker. This fires
        # before _classify_table so misclassification (matrix table that
        # _classify_table tags as template_subspec) can't leak rows into
        # the section list as Unplaced narratives. (Bug observed
        # 2026-05-22.)
        if skip_matrices and _is_table_under_matrix_anchor(table):
            continue
        table_type = _classify_table(table)
        if skip_matrices and table_type == "curriculum_matrix":
            continue
        if table_type == "template_subspec":
            new_secs = _table_extracts_for_subspec_template(
                table, base_id, order_start=order_cursor
            )
            sections.extend(new_secs)
            if new_secs:
                # Each sub-row sec already used _next_order(); the cursor
                # advances by that many sections.
                order_cursor = new_secs[-1].byte_offset_start
        else:
            order_cursor += 1
            sec = _table_as_one_section(
                table, base_id, table_type, order=order_cursor
            )
            if sec:
                sections.append(sec)
    return sections


def _is_inside_table(tag: Tag) -> bool:
    for a in tag.parents:
        if a.name == "table":
            return True
    return False


def deep_walk_with_fallback(
    html_bytes: bytes,
    base_id: str = "doc",
    min_prose_words: int = 5,
    skip_matrices: bool = True,
) -> list[Section]:
    """Walk tables AND emit sections for prose blocks outside tables.

    ``skip_matrices`` is forwarded to ``deep_walk``; default True so the
    wizard pipeline doesn't double-emit curriculum matrices.

    CR-039 Phase 2c part 2 — Problem 3: previously this dropped every
    paragraph below 50 words (mission statements, short intros, terms
    glossary entries vanished). The threshold is now 5 words and we
    also capture standalone block-level prose containers that aren't
    ``<p>`` tags (``<div>``, ``<section>``, ``<blockquote>``) plus
    standalone heading tags. The matcher / introduction_detector
    decides what to do with the section — the walker no longer makes
    the keep/drop call on the wizard's behalf.

    Coordinator-visible behavior: short intro paragraphs that used to
    vanish entirely now reach the Review-step Unplaced list (or get
    routed into the Introduction buckets by introduction_detector
    when the heading matches).
    """
    table_sections = deep_walk(html_bytes, base_id, skip_matrices=skip_matrices)

    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()

    # CR-031 — assign source-order indices to prose sections too.
    # Continue numbering after the table sections so the combined list,
    # when sorted by byte_offset_start, reflects approximate document order.
    # Tables walk before prose in this function, but the per-section order
    # values still let nearestPlacedNeighbor compute a usable "above me"
    # relation as long as values are unique + monotonic per-pass.
    prose_order = max((s.byte_offset_start for s in table_sections), default=0)

    prose_sections: list[Section] = []
    # CR-039 Phase 2c part 2 — broaden the scan beyond `<p>` so block-level
    # containers (`<div>`, `<section>`, `<blockquote>`) and standalone
    # heading tags don't silently slip past the walker. We dedupe by
    # tracking the byte position of each tag's text so a `<div>` wrapping
    # a `<p>` doesn't emit twice.
    PROSE_TAGS = ("p", "div", "section", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6")
    seen_text_hashes: set[int] = set()
    for tag in soup.find_all(PROSE_TAGS):
        if _is_inside_table(tag):
            continue
        # Skip a container that has block-level children — its text will
        # be emitted via the child instead. Without this, a `<div>` with
        # three `<p>` inside would emit one big div-section AND three
        # paragraph-sections covering the same bytes.
        if tag.name in ("div", "section", "blockquote") and tag.find(["p", "div", "section", "blockquote"]):
            continue
        text = tag.get_text().strip()
        if not text:
            continue
        # Heading tags (`<h1>`–`<h6>`) bypass the word floor — a 2-word
        # "Mission" anchor still matters for introduction_detector.
        is_heading_tag = tag.name.startswith("h") and tag.name[1:].isdigit()
        if not is_heading_tag and len(text.split()) < min_prose_words:
            continue
        # Dedupe identical-text emissions (rare, but a defensive guard so
        # the walker can't double-count if a `<div>` slips past the
        # has-block-child check above).
        text_hash = hash(text[:200])
        if text_hash in seen_text_hashes:
            continue
        seen_text_hashes.add(text_hash)

        flags = _heuristic_flags(text)
        prose_order += 1
        # CR-040 Phase 2 — capture inline images in this prose paragraph
        # (mammoth emits <img src="data:image/png;base64,..."> for embedded
        # DOCX images; previously hardcoded to contains_image=False).
        p_images = extract_images_from_tag(tag, base_byte_offset=prose_order)
        # Distinguish heading-only sections so introduction_detector can
        # treat them as candidate intro anchors even when the body is
        # short. The standalone `<h1>`/`<h2>` case is exactly how
        # "Introduction", "Mission", "About the Program" lines appear
        # in coordinator-authored DOCX bodies.
        is_heading = tag.name.startswith("h") and tag.name[1:].isdigit()
        tier_label = "prose_outside_table_heading" if is_heading else "prose_outside_table"
        prose_sections.append(
            Section(
                id=f"{base_id}:prose:{uuid.uuid4().hex[:8]}",
                heading=text[:120],
                heading_level=int(tag.name[1]) if is_heading else 2,
                markdown=text,
                byte_offset_start=prose_order,
                # CR-040 Phase 3b — give the prose section a non-zero
                # extent so the byte-level coverage census stops
                # reading prose as "zero-width" and treating it as a
                # spurious gap.
                byte_offset_end=prose_order + max(1, len(text.split())),
                word_count=len(text.split()),
                contains_table=False,
                contains_image=bool(p_images),
                has_resume_signals=flags["hasResumeSignals"],
                has_syllabus_signals=flags["hasSyllabusSignals"],
                splitter_tier=tier_label,
                flags=flags,
                images=p_images,
            )
        )

    return table_sections + prose_sections
