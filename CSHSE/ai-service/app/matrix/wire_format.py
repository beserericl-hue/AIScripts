"""Build the wire-format matrix payload for the wizard UI.

The Python matrix extractor returns ``MatrixExtractionResult`` (cells indexed
by std/spec/column). The wizard UI needs more than that:

  - The full ``<table>`` HTML so the user sees the same rows / columns
    they had in the source DOCX (no get_text() flatten).
  - Per-row anchor ids (``id="matrix-{name}-row-{std}-{spec}"``) so the
    spec-level "Jump to row" buttons can scroll to the exact row.
  - The column headers as a string list (course codes) so the UI can
    surface them in chips above the table.

This module wraps the extractor + augments the HTML in one place.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from bs4 import BeautifulSoup, Tag

from .data_extractor import MatrixCellData, extract_matrix
from .template_loader import MatrixTemplate

# Known anchor names used in CSHSE templates / institutional self-studies.
# Order matters only for display.
MATRIX_ANCHORS: tuple[tuple[str, str, str], ...] = (
    # (anchor_name, slug, human_label)
    ("MatrixHSR", "hsr", "Matrix for Human Services Courses"),
    ("Matrix2", "non-hsr", "Matrix for Non-Human Services Courses"),
)


def _slug(anchor_name: str) -> str:
    for a, s, _ in MATRIX_ANCHORS:
        if a == anchor_name:
            return s
    return anchor_name.lower()


def _human_label(anchor_name: str) -> str:
    for a, _, lbl in MATRIX_ANCHORS:
        if a == anchor_name:
            return lbl
    return f"Matrix {anchor_name}"


def _find_anchor_table(soup: BeautifulSoup, anchor: str) -> Tag | None:
    """Return the FIRST table that follows the named anchor element."""
    target = soup.find(attrs={"id": anchor}) or soup.find("a", attrs={"name": anchor})
    if not target:
        return None
    for el in target.find_all_next():
        if el.name == "table":
            rows = el.find_all("tr")
            if not rows:
                continue
            max_cols = max(len(r.find_all(["td", "th"])) for r in rows)
            if max_cols >= 4 and len(rows) >= 3:
                return el
    return None


def _column_headers(table: Tag) -> list[str]:
    """Pull the first row's non-empty cells as the course header list."""
    first = table.find("tr")
    if not first:
        return []
    cells = first.find_all(["td", "th"])
    # Drop the leading prompt cell (column 0) — it's empty / "Specifications".
    headers: list[str] = []
    for c in cells[1:]:
        text = re.sub(r"\s+", " ", (c.get_text() or "")).strip()
        headers.append(text)
    return headers


def _row_anchor_id(slug: str, std: str, spec: str | None) -> str:
    spec_part = spec or "x"
    return f"matrix-{slug}-row-{std}-{spec_part}"


def _augment_table_with_row_ids(
    table: Tag,
    slug: str,
    cells: Iterable[MatrixCellData],
) -> str:
    """Clone the table HTML and add ``id="matrix-{slug}-row-{std}-{spec}"``
    to every <tr> that maps to a known (std, spec).

    Each spec maps to exactly one row by ``row_index`` in the extractor's
    template alignment; we use the table row order to apply ids, skipping
    the header row.
    """
    # We can't directly mutate the original table (deep_walker may also
    # need it). Parse a fresh copy.
    copy = BeautifulSoup(str(table), "html.parser").find("table")
    if copy is None:
        return str(table)

    # Build a {prompt_text -> (std, spec)} index from the matched cells so we
    # can tag the right rows. We can't rely on positional alignment because
    # rows the extractor rejected (too short, header-like) shift the index.
    prompt_to_marker: dict[str, tuple[str, str | None]] = {}
    for c in cells:
        prompt_to_marker[c.spec_prompt.strip()] = (c.standard_code, c.spec_code)

    rows = copy.find_all("tr")
    seen: set[str] = set()
    for tr in rows:
        tds = tr.find_all(["td", "th"])
        if len(tds) < 2:
            continue
        prompt = (tds[0].get_text() or "").strip()
        # The extractor truncates prompts at 200 chars; match against the
        # leading portion of this row's prompt.
        marker: tuple[str, str | None] | None = None
        for stored_prompt, m in prompt_to_marker.items():
            if stored_prompt and (
                stored_prompt == prompt[: len(stored_prompt)]
                or stored_prompt in prompt
            ):
                marker = m
                break
        if marker is None:
            continue
        std, spec = marker
        anchor_id = _row_anchor_id(slug, std, spec)
        if anchor_id in seen:
            # Already tagged a row for this (std,spec) — duplicate rows
            # would re-use the id which is illegal HTML. Skip.
            continue
        seen.add(anchor_id)
        # Append to existing class string (if any) and set id.
        existing_class = tr.get("class") or []
        if isinstance(existing_class, str):
            existing_class = existing_class.split()
        tr["class"] = existing_class + ["cshse-matrix-row"]
        tr["id"] = anchor_id
        tr["data-std"] = std
        if spec:
            tr["data-spec"] = spec

    return str(copy)


@dataclass
class WireMatrix:
    """Serializable matrix entry attached to JobRecord.matrices."""
    matrix_id: str
    name: str
    anchor_name: str
    program_level: str
    html_snippet: str
    column_headers: list[str]
    rows_matched: int
    rows_total: int
    column_count: int
    cells: list[dict]  # already-serialized per-cell dicts (camelCase)

    def to_dict(self) -> dict:
        return {
            "matrixId": self.matrix_id,
            "name": self.name,
            "anchorName": self.anchor_name,
            "programLevel": self.program_level,
            "htmlSnippet": self.html_snippet,
            "columnHeaders": self.column_headers,
            "rowsMatched": self.rows_matched,
            "rowsTotal": self.rows_total,
            "columnCount": self.column_count,
            "cells": self.cells,
        }


def _cell_to_dict(
    c: MatrixCellData, slug: str, column_headers: list[str]
) -> dict:
    col_idx = c.column_index
    col_header = column_headers[col_idx - 1] if 0 < col_idx <= len(column_headers) else ""
    return {
        "std": c.standard_code,
        "spec": c.spec_code,
        "specPrompt": c.spec_prompt,
        "rowAnchor": _row_anchor_id(slug, c.standard_code, c.spec_code),
        "columnIndex": col_idx,
        "columnHeader": col_header,
        "codeRaw": c.code_raw,
        "contentTypes": list(c.content_types),
        "depth": c.depth,
        "confidence": c.confidence,
    }


def build_wire_matrices(
    html_bytes: bytes,
    template: MatrixTemplate,
) -> tuple[list[dict], set[int]]:
    """Walk every known CSHSE matrix anchor and return wire-format dicts.

    Returns
    -------
    (matrices, consumed_table_ids)
        ``matrices`` is the list of wire-format dicts ready to attach to
        ``JobRecord.matrices``. ``consumed_table_ids`` is the set of
        ``id()`` values for the ``<table>`` Tag objects we claimed — the
        deep_walker should NOT re-emit those as "(curriculum matrix table)"
        data-table sections.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    for noise in soup(["script", "style", "head"]):
        noise.decompose()

    matrices: list[dict] = []
    consumed: set[int] = set()
    for anchor_name, slug, label in MATRIX_ANCHORS:
        result = extract_matrix(html_bytes, template, anchor=anchor_name)
        if not result.cells:
            continue
        table = _find_anchor_table(soup, anchor_name)
        if table is None:
            continue
        consumed.add(id(table))
        column_headers = _column_headers(table)
        html_with_ids = _augment_table_with_row_ids(table, slug, result.cells)
        cell_dicts = [_cell_to_dict(c, slug, column_headers) for c in result.cells]
        wire = WireMatrix(
            matrix_id=f"matrix-{slug}",
            name=label,
            anchor_name=anchor_name,
            program_level=result.program_level,
            html_snippet=html_with_ids,
            column_headers=column_headers,
            rows_matched=result.rows_matched,
            rows_total=result.rows_total,
            column_count=result.column_count,
            cells=cell_dicts,
        )
        matrices.append(wire.to_dict())
    return matrices, consumed
