"""Appendix splitter for CSHSE self-studies.

The appendix is structured BY STANDARD: each "Standard N" text header in the
appendix divides supporting-evidence items grouped under that Standard.
Stevenson's appendix shows the pattern:

    Standard 1
      Counseling & Human Services Program Goals and Objectives
      Department Brochure
      Enrollment and Graduation Trends
      Curriculum Display
      ...
    Standard 3
      Advisory Board Roster
      Advisory Board Minutes
    Standard 6
      Picture of Faculty
      Faculty Curriculum Vitae
        (each faculty CV is its own anchored sub-item: FacCVsRosicky,
         FacCVsSwish, FacCVsWeiner, etc.)
    Standard 7
      Academic Affairs Council (AAC) By-Laws
      Responsibilities of Department Chair
      ...

Each item becomes a candidate ``SupportingEvidence`` record tagged with the
Standard. The AI matcher narrows down to the specific spec letter inside the
Standard.

Multi-CV scenarios (Standard 6) split via explicit anchors so each faculty
gets its own evidence record.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from typing import Optional

from bs4 import BeautifulSoup, Tag

from app.splitter.sections import Section, _heuristic_flags

# Appendix-grouping markers used inside Stevenson's appendix to delimit
# Standards. The text is just "Standard N" (sometimes "Standards 11-21").
_APPENDIX_STANDARD_RE = re.compile(r"^Standards?\s+(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?$")
_FAC_CV_ANCHOR_RE = re.compile(r"^FacCVs?[A-Z]", re.IGNORECASE)

# Anchors that are explicitly appendix anchors (point to specific items)
_APPENDIX_SECTION_ANCHORS = {"Appendices", "Syllabi", "FacPic", "FacCVs"}


@dataclass
class AppendixItem:
    """One supporting-evidence candidate from the appendix."""
    item_title: str
    body_text: str
    standard_code: str          # the Standard this item is grouped under
    appendix_anchor: Optional[str]  # the source anchor if one exists
    item_index: int             # order within the appendix


def _find_appendix_start(soup: BeautifulSoup) -> Optional[Tag]:
    """Locate the appendix section start in the document."""
    for anchor_name in ("Appendices", "Appendix"):
        target = soup.find(attrs={"id": anchor_name}) or soup.find(
            "a", attrs={"name": anchor_name}
        )
        if target:
            return target
    return None


def _is_standard_marker_text(text: str) -> Optional[str]:
    """Return the Standard number if ``text`` is just a 'Standard N' header."""
    t = text.strip()
    m = _APPENDIX_STANDARD_RE.match(t)
    if m:
        return m.group(1)
    return None


def walk_appendix(html_bytes: bytes, base_id: str = "doc") -> list[Section]:
    """Walk the appendix and emit one Section per supporting-evidence item.

    Sections returned have ``splitter_tier='appendix_item'`` and
    ``flags['appendixStandard']`` set to the Standard the item is grouped
    under. The AI matcher later narrows to the specific spec letter.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()

    app_start = _find_appendix_start(soup)
    if not app_start:
        return []

    # Walk every block-level element after the appendix anchor, tracking the
    # CURRENT Standard context and accumulating each item's body until the
    # next item-start (any heading-like short paragraph) or next Standard.
    current_standard: Optional[str] = None
    current_title: Optional[str] = None
    current_body: list[str] = []
    current_anchor: Optional[str] = None
    items: list[AppendixItem] = []

    def flush():
        nonlocal current_title, current_body, current_anchor
        if current_title and current_standard:
            body = "\n\n".join(p for p in current_body if p).strip()
            if len(body.split()) >= 5:
                items.append(
                    AppendixItem(
                        item_title=current_title.strip()[:200],
                        body_text=body,
                        standard_code=current_standard,
                        appendix_anchor=current_anchor,
                        item_index=len(items),
                    )
                )
        current_title = None
        current_body = []
        current_anchor = None

    for elem in app_start.find_all_next():
        if not isinstance(elem, Tag):
            continue
        text = elem.get_text(separator=" ", strip=True)
        if not text:
            continue

        # Standard-N divider — switches the active Standard
        std = _is_standard_marker_text(text)
        if std:
            flush()
            current_standard = std
            continue

        # Faculty CV explicit anchor — starts a new item for THIS faculty
        # member.
        cv_anchor = elem.get("id") or (
            elem.find("a", attrs={"id": True}).get("id")
            if elem.find("a", attrs={"id": True})
            else None
        )
        if cv_anchor and _FAC_CV_ANCHOR_RE.match(cv_anchor):
            flush()
            # The faculty name is usually the next short text
            current_title = text[:120]
            current_anchor = cv_anchor
            continue

        # Short-line + capitalized first word + currently inside a Standard
        # context = a new item header.
        is_short = len(text) <= 120 and len(text.split()) <= 18
        starts_capital = text[:1].isupper()
        if (
            is_short
            and starts_capital
            and current_standard
            and not text.endswith(":")
        ):
            # If we already have an open item, only treat this as a NEW item
            # if the previous one has accumulated meaningful body text. This
            # prevents 2-line titles from getting split.
            if current_title is None or len(" ".join(current_body).split()) >= 30:
                flush()
                current_title = text
                continue

        # Otherwise it's body content of the current item.
        if current_title:
            current_body.append(text)

    flush()

    # Convert to Section objects
    sections: list[Section] = []
    for item in items:
        flags = _heuristic_flags(item.body_text)
        # Faculty CV detection
        is_faculty_cv = bool(item.appendix_anchor and _FAC_CV_ANCHOR_RE.match(item.appendix_anchor))
        if is_faculty_cv:
            flags["hasResumeSignals"] = True
        sections.append(
            Section(
                id=f"{base_id}:appx:{uuid.uuid4().hex[:8]}",
                heading=item.item_title[:200],
                heading_level=3,
                markdown=item.body_text,
                byte_offset_start=0,
                byte_offset_end=0,
                word_count=len(item.body_text.split()),
                contains_table="<table" in item.body_text or "| " in item.body_text,
                contains_image=False,
                has_resume_signals=flags.get("hasResumeSignals", False),
                has_syllabus_signals=flags.get("hasSyllabusSignals", False),
                splitter_tier="appendix_item",
                flags={
                    **flags,
                    "appendixStandard": item.standard_code,
                    "appendixAnchor": item.appendix_anchor or "",
                    "isFacultyCV": is_faculty_cv,
                },
            )
        )

    return sections
