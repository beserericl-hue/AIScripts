"""Load the official CSHSE curriculum-matrix templates.

The CSHSE Handbook ships three template DOCX files (one per program level)
that show the expected structure of the curriculum matrix:

  docs/MatrixAssociateDegree_July_2025.docx        (Standards 11-20 + 21)
  docs/MatrixBaccalaureateDegree_July_2025.docx    (Standards 11-20 + 21)
  docs/MatrixMasterDegree_July_2025.docx           (Standards 11-21 with Master's-specific specs)

Each template contains three tables:
  1. Legend — defines cell codes I/T/K/S + L/M/H
  2. Main matrix (Standards 11-20) — rows are spec prompts, columns are
     courses (empty in the template, filled by the program)
  3. Field Experience matrix (Standard 21) — same shape, narrower

This loader extracts the ordered list of spec prompts so we can:
  - Detect that a table in a self-study IS a curriculum matrix by matching
    its row labels against the template's prompts.
  - Map filled-in cells back to (standard, spec, course, code).
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional

import mammoth
from bs4 import BeautifulSoup

ProgramLevel = Literal["associate", "bachelors", "masters"]

# CSHSE Standard-name → standardCode mapping used by the templates.
_STANDARD_NAMES_TO_CODES = {
    "history": "11",
    "human systems": "12",
    "human services delivery systems": "13",
    "information literacy": "14",
    "planning and evaluation": "15",
    "interventions and direct services": "16",
    "interventions and strategies": "16",
    "interpersonal communication": "17",
    "administrative roles and procedures": "18",
    "administrative": "18",
    "client-related values and attitudes": "19",
    "self-development": "20",
    "field experience": "21",
}


@dataclass(frozen=True)
class MatrixRow:
    """One row of the template = one Specification's prompt."""
    standard_code: str  # "11" .. "21"
    spec_text: str
    spec_code: Optional[str]  # may be unknown until aligned with Handbook
    standard_title: str  # "History", "Human Systems", etc.


@dataclass
class MatrixTemplate:
    """The full template for one program level."""
    program_level: ProgramLevel
    source_filename: str
    rows: list[MatrixRow]          # all Standards 11-20 + 21 in order
    column_count: int              # number of course columns (empty in template)
    legend: dict[str, str]         # {"I": "Introduction of topic", ...}


def _matrix_file(program_level: ProgramLevel) -> Path:
    """Resolve the absolute path of the template DOCX for a program level.

    The templates ship inside the ai-service Python package at
    ``app/matrix/templates/`` so they're available in the Railway-built
    Docker image. Falls back to ``CSHSE/docs/`` for local development
    where the canonical copies live alongside the source repo.
    """
    candidates = {
        "associate": "MatrixAssociateDegree_July_2025 .docx",  # note the space — actual filename
        "bachelors": "MatrixBaccalaureateDegree_July_2025.docx",
        "masters": "MatrixMasterDegree_July_2025 .docx",
    }
    fn = candidates.get(program_level)
    if not fn:
        raise ValueError(f"unknown program level: {program_level}")
    here = Path(__file__).resolve().parent
    search_dirs = [
        here / "templates",                  # packaged inside ai-service
        here.parents[1].parent / "docs",     # CSHSE/docs (local dev fallback)
    ]
    tried: list[Path] = []
    for d in search_dirs:
        p = d / fn
        tried.append(p)
        if p.exists():
            return p
        alt = d / fn.replace(" .docx", ".docx")
        tried.append(alt)
        if alt.exists():
            return alt
    raise FileNotFoundError(
        f"matrix template '{fn}' for {program_level} not found. Tried: {tried}"
    )


def _parse_legend(soup_table: BeautifulSoup) -> dict[str, str]:
    """The legend table maps the single letters (I/T/K/S/L/M/H) to descriptions."""
    legend: dict[str, str] = {}
    for tr in soup_table.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        for c in cells:
            text = c.get_text(separator=" ", strip=True)
            m = re.match(r"^\s*([ITKSLMH])\s*=\s*(.+?)\s*$", text)
            if m:
                legend[m.group(1).upper()] = m.group(2).strip()
    return legend


def _is_standard_header(text: str) -> Optional[tuple[str, str]]:
    """Return (standard_code, standard_title) if the row's first cell is a Standard header."""
    t = text.strip()
    if not t:
        return None
    low = t.lower()
    # "Standard 11: ..." form
    m = re.match(r"standard\s+(\d{1,2})\s*[:.]?\s*(.*)$", low)
    if m:
        return (m.group(1), m.group(2).strip() or "")
    # "Specifications for Standard 11"
    m = re.match(r"specifications?\s+for\s+standard\s+(\d{1,2})", low)
    if m:
        return (m.group(1), "")
    # By standard name ("History", "Human Systems")
    if low in _STANDARD_NAMES_TO_CODES:
        return (_STANDARD_NAMES_TO_CODES[low], t)
    return None


def parse_matrix_template(docx_bytes: bytes, program_level: ProgramLevel, filename: str) -> MatrixTemplate:
    """Parse a template DOCX into a structured MatrixTemplate."""
    html = mammoth.convert_to_html(io.BytesIO(docx_bytes)).value
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")

    legend: dict[str, str] = {}
    rows: list[MatrixRow] = []
    column_count = 0

    for table in tables:
        first_row = table.find("tr")
        if not first_row:
            continue
        header_cells = first_row.find_all(["td", "th"])
        header_text = " ".join((c.get_text() or "").strip() for c in header_cells).lower()

        # Legend table
        if "type of course content" in header_text and "depth" in header_text:
            legend = _parse_legend(table)
            continue

        # Skip narrow tables (1-2 columns) — these are usually not the matrix
        col_count = max(len(r.find_all(["td", "th"])) for r in table.find_all("tr"))
        if col_count < 3:
            continue

        # This is a matrix table — extract rows
        column_count = max(column_count, col_count)
        current_std: Optional[str] = None
        current_title: str = ""
        # Skip the very first row (column headers)
        all_rows = table.find_all("tr")
        for tr in all_rows[1:]:
            cells = tr.find_all(["td", "th"])
            if not cells:
                continue
            first_text = (cells[0].get_text() or "").strip()
            if not first_text:
                continue

            std_hint = _is_standard_header(first_text)
            if std_hint:
                current_std, current_title = std_hint
                continue

            # Skip pure section labels that aren't spec prompts.
            if first_text.lower() in {"context", "context:"}:
                continue
            if first_text.startswith(("Skills to evaluate", "Standard ")) and len(first_text.split()) < 4:
                continue

            # Substantive spec prompt
            if len(first_text.split()) >= 3 and current_std:
                rows.append(
                    MatrixRow(
                        standard_code=current_std,
                        spec_text=first_text,
                        spec_code=None,  # filled after alignment with Handbook
                        standard_title=current_title or "",
                    )
                )

    return MatrixTemplate(
        program_level=program_level,
        source_filename=filename,
        rows=rows,
        column_count=column_count,
        legend=legend,
    )


def load_matrix_template(program_level: ProgramLevel) -> MatrixTemplate:
    p = _matrix_file(program_level)
    return parse_matrix_template(p.read_bytes(), program_level, p.name)


def align_template_to_handbook(
    template: MatrixTemplate, handbook_specs: list
) -> MatrixTemplate:
    """Assign spec_codes (a, b, c, ...) to each MatrixRow by sequential
    position within the template's Standard.

    Some templates list more rows per Standard than the Handbook has specs
    (the template breaks one spec into sub-bullets); we only let the
    Handbook's spec count drive the lettering.
    """
    by_std: dict[str, int] = {}
    new_rows: list[MatrixRow] = []
    handbook_by_std: dict[str, list] = {}
    for s in handbook_specs:
        handbook_by_std.setdefault(s.standard_code, []).append(s)
    for r in template.rows:
        idx = by_std.get(r.standard_code, 0)
        hb_list = handbook_by_std.get(r.standard_code, [])
        spec_code = hb_list[idx].spec_code if idx < len(hb_list) else None
        new_rows.append(
            MatrixRow(
                standard_code=r.standard_code,
                spec_text=r.spec_text,
                spec_code=spec_code,
                standard_title=r.standard_title,
            )
        )
        by_std[r.standard_code] = idx + 1
    return MatrixTemplate(
        program_level=template.program_level,
        source_filename=template.source_filename,
        rows=new_rows,
        column_count=template.column_count,
        legend=template.legend,
    )
