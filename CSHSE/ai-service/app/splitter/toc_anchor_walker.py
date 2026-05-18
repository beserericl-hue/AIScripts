"""TOC anchor-driven section extractor for CSHSE self-studies.

CSHSE templates put explicit `<a id="S1d">` anchors at the start of every
subspec response, and a Table of Contents at the top of the document with
links like `<a href="#S1d">Brief History of the Program</a>`.

This walker is FAR more reliable than embedding similarity for documents
that follow the template (the vast majority of CSHSE self-studies do):

  1. Parse the TOC to build {anchor → (standard, spec, label)}.
  2. For each anchor, find its target element in the doc.
  3. Extract all content between this anchor target and the next.
  4. That content IS the (standard, spec)'s narrative response —
     no AI guessing needed for placement.

The AI matcher still has a role for:
  - Sections that AREN'T anchored (appendices, supporting evidence)
  - Section-type classification (narrative vs supporting evidence vs matrix)
  - Drift detection (anchor says 1.d but content has moved to 2.a in new spec)
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Optional

from bs4 import BeautifulSoup, NavigableString, Tag

from app.splitter.sections import Section, _heuristic_flags


# CSHSE anchor patterns observed in real self-studies:
#   #S1d, #S2a, #S11a            → standard.spec
#   #Standard1, #Standard11       → start of Standard N (typically maps to N.a)
#   #S8beval, #S19h               → standard with extended letter (8.b "eval" variant)
_SUBSPEC_ANCHOR_RE = re.compile(r"^S(\d{1,2})([a-h])(?:[a-z]+)?$", re.IGNORECASE)
_STANDARD_ANCHOR_RE = re.compile(r"^Standard(\d{1,2})$", re.IGNORECASE)
# Matrix-specific anchors
_MATRIX_ANCHOR_NAMES = {"MatrixHSR", "Matrix2", "Matrix3", "Matrix4"}


@dataclass
class TocEntry:
    anchor: str             # raw anchor name without '#'
    standard_code: str      # e.g. "1", "11"
    spec_code: str          # e.g. "a", "b" — or "*matrix" for matrix anchors
    label: str              # human-readable label from the TOC link text
    kind: str               # "subspec" | "matrix" | "appendix" | "intro"


def parse_toc(soup: BeautifulSoup) -> dict[str, TocEntry]:
    """Walk the doc's <a href="#..."> links and infer a TocEntry per anchor.

    Returns ``{anchor_name: TocEntry}``. Anchors that don't map to a standard /
    spec / matrix are omitted (they're usually intro or appendix anchors).
    """
    result: dict[str, TocEntry] = {}
    seen_anchors: set[str] = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if not href.startswith("#"):
            continue
        anchor = href[1:]
        if anchor in seen_anchors:
            continue
        seen_anchors.add(anchor)
        label = (a.get_text() or "").strip()
        if not label or len(label) > 200:
            continue

        # Subspec form (S1d, S2a, etc.)
        m = _SUBSPEC_ANCHOR_RE.match(anchor)
        if m:
            std = m.group(1)
            spec = m.group(2).lower()
            result[anchor] = TocEntry(anchor, std, spec, label, "subspec")
            continue

        # Standard-N form (intro to Standard N — typically maps to N.a)
        m = _STANDARD_ANCHOR_RE.match(anchor)
        if m:
            std = m.group(1)
            result[anchor] = TocEntry(anchor, std, "a", label, "intro")
            continue

        # Matrix anchors
        if anchor in _MATRIX_ANCHOR_NAMES or anchor.lower().startswith("matrix"):
            result[anchor] = TocEntry(anchor, "11", "*matrix", label, "matrix")
            continue

        # Skip other anchors (Appendices, Syllabi, Glossary, etc.) — those
        # aren't (standard, spec) sections.

    return result


def _find_anchor_target(soup: BeautifulSoup, anchor: str) -> Optional[Tag]:
    """Locate the in-document element marked by `id=anchor` or `name=anchor`."""
    # `<a id="..."></a>` is the typical Word/DOCX → HTML output
    target = soup.find(attrs={"id": anchor})
    if target:
        return target
    target = soup.find("a", attrs={"name": anchor})
    if target:
        return target
    return None


def _collect_content_until(
    start_tag: Tag, end_tag: Optional[Tag]
) -> list[Tag | NavigableString]:
    """Collect every element from ``start_tag`` (exclusive) up to ``end_tag``
    (exclusive). The start anchor itself is excluded because it's just a marker."""
    collected: list[Tag | NavigableString] = []
    seen_start = False
    for descendant in start_tag.parent.descendants if start_tag.parent else []:
        if not seen_start:
            if descendant is start_tag:
                seen_start = True
            continue
        if end_tag is not None and descendant is end_tag:
            break
        collected.append(descendant)
    return collected


def _section_body_text(start_tag: Tag, end_tag: Optional[Tag]) -> str:
    """Concatenate the visible text between two anchor targets.

    CSHSE templates put anchors INSIDE table cells (e.g. `<td><a id="S1d">d.`),
    so a sibling-only walk gets trapped in the marker cell. Instead, walk
    document order forward via ``find_all_next`` until we hit the next anchor's
    target. Collect text from any block-level descendant we cross.
    """
    parts: list[str] = []
    seen_ids: set[int] = set()

    # Quick path: same parent, walk siblings.
    cursor = start_tag

    # Build a set of nodes that mark the END (the next anchor target + its
    # descendants — we should stop BEFORE entering that subtree).
    end_subtree: set[int] = set()
    if end_tag is not None:
        end_subtree.add(id(end_tag))
        for d in end_tag.descendants:
            end_subtree.add(id(d))

    # Walk document order forward from start_tag.
    for elem in start_tag.find_all_next():
        # Stop if we've entered the end-anchor's subtree.
        if end_tag is not None and id(elem) in end_subtree:
            break
        if id(elem) in seen_ids:
            continue
        seen_ids.add(id(elem))
        # Only emit text once per block-level element to avoid duplication
        # from get_text on parent then child.
        if isinstance(elem, Tag) and elem.name in (
            "p", "li", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6",
        ):
            txt = elem.get_text(separator=" ", strip=True)
            if txt:
                parts.append(txt)
    # De-dupe consecutive duplicates (table cells often produce repeated text)
    deduped: list[str] = []
    for p in parts:
        if not deduped or deduped[-1] != p:
            deduped.append(p)
    return "\n\n".join(deduped).strip()


def extract_toc_anchored_sections(html_bytes: bytes, base_id: str = "doc") -> list[Section]:
    """Walk every TOC-anchored section in the document and emit one Section per
    (standard, spec) anchor.

    Returns Sections with ``splitter_tier='toc_anchor'`` and the
    document-asserted ``(standardCode, specCode)`` stored in ``flags``.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()

    toc = parse_toc(soup)
    if not toc:
        return []

    # Sort anchors by their position in the document so we can find the
    # NEXT anchor target after each one.
    anchor_positions: list[tuple[int, str, Tag]] = []
    for anchor, entry in toc.items():
        target = _find_anchor_target(soup, anchor)
        if target is None:
            continue
        # Determine source-order index by walking soup
        anchor_positions.append((-1, anchor, target))

    # Re-order by document position
    all_elems = list(soup.descendants)
    elem_index = {id(el): i for i, el in enumerate(all_elems) if isinstance(el, Tag)}
    anchor_positions = [
        (elem_index.get(id(target), -1), anchor, target)
        for _, anchor, target in anchor_positions
    ]
    anchor_positions.sort(key=lambda t: t[0])

    sections: list[Section] = []
    for i, (pos, anchor, target) in enumerate(anchor_positions):
        next_target = anchor_positions[i + 1][2] if i + 1 < len(anchor_positions) else None
        body = _section_body_text(target, next_target)
        if not body or len(body.split()) < 5:
            continue

        entry = toc[anchor]
        flags = _heuristic_flags(body)
        sections.append(
            Section(
                id=f"{base_id}:toc:{uuid.uuid4().hex[:8]}",
                heading=entry.label[:200] or f"#{anchor}",
                heading_level=2,
                markdown=body,
                byte_offset_start=0,
                byte_offset_end=0,
                word_count=len(body.split()),
                contains_table=any(t in body for t in ("</td>", "<table")),
                contains_image=False,
                has_resume_signals=flags["hasResumeSignals"],
                has_syllabus_signals=flags["hasSyllabusSignals"],
                splitter_tier="toc_anchor",
                flags={
                    **flags,
                    "tocAnchor": anchor,
                    "tocLabel": entry.label,
                    "docStandard": entry.standard_code,
                    "docSpec": entry.spec_code,
                    "tocKind": entry.kind,
                },
            )
        )

    return sections
