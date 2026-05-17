"""Appendix splitter for CSHSE self-studies.

The appendix is structured BY STANDARD: each "Standard N" text header in the
appendix divides supporting-evidence items grouped under that Standard. Each
top-level item under that Standard (Department Brochure, Faculty CVs, Field
Placement Handbook, etc.) becomes a candidate ``SupportingEvidence`` record.

Refinement rules (2026-05-17):
  - Minimum 30 words of body content per item (drops titles-only).
  - Skip repeated TOC navigation text ("Table of Contents", repeated headers).
  - Faculty CVs split via explicit anchors (FacCVsRosicky, FacCVsSwish, ...).
  - Other items: use first-line short capitalized text as the title, then
    accumulate body until the next title OR next Standard divider.
  - Dedupe consecutive identical lines (the parser often emits headers twice).
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


# Nav/boilerplate text that appears repeatedly in PDF-converted HTML
_NOISE_PATTERNS = {
    "table of contents",
    "appendices",
    "appendix",
    "list of supporting documents",
}
_MIN_BODY_WORDS = 30  # raised from 5 — drops titles-only / headers-only items


def _is_noise_text(t: str) -> bool:
    return t.strip().lower() in _NOISE_PATTERNS


def _dedupe_consecutive(parts: list[str]) -> list[str]:
    """Drop consecutive duplicates that PDF→HTML conversion emits when the
    same heading appears twice (once as the heading, once as text)."""
    out: list[str] = []
    prev = None
    for p in parts:
        if p and p != prev:
            out.append(p)
            prev = p
    return out


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

    current_standard: Optional[str] = None
    current_title: Optional[str] = None
    current_body: list[str] = []
    current_anchor: Optional[str] = None
    items: list[AppendixItem] = []

    def flush():
        nonlocal current_title, current_body, current_anchor
        if current_title and current_standard:
            body_parts = _dedupe_consecutive(current_body)
            body = "\n\n".join(body_parts).strip()
            words = body.split()
            if len(words) >= _MIN_BODY_WORDS:
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
        if not text or _is_noise_text(text):
            continue

        # Standard-N divider — switches the active Standard
        std = _is_standard_marker_text(text)
        if std:
            flush()
            current_standard = std
            continue

        # Faculty CV explicit anchor — starts a new item for THIS faculty
        # member.
        cv_anchor = None
        if elem.has_attr("id") and _FAC_CV_ANCHOR_RE.match(elem.get("id", "")):
            cv_anchor = elem.get("id")
        else:
            inner = elem.find("a", attrs={"id": True})
            if inner and _FAC_CV_ANCHOR_RE.match(inner.get("id", "")):
                cv_anchor = inner.get("id")
        if cv_anchor:
            flush()
            current_title = text[:120]
            current_anchor = cv_anchor
            continue

        # Title detection: short paragraph, capital-led, no trailing colon.
        # Only treat as NEW item if the previous one has substance.
        is_short_title = (
            len(text) <= 120
            and len(text.split()) <= 18
            and text[:1].isupper()
            and not text.endswith(":")
        )
        if is_short_title and current_standard:
            cur_word_count = sum(len(p.split()) for p in current_body)
            if current_title is None:
                current_title = text
                continue
            if cur_word_count >= _MIN_BODY_WORDS:
                flush()
                current_title = text
                continue
            # Otherwise: previous item lacks body — treat this short text as
            # a sub-title and merge with prior title.
            current_title = (current_title + " — " + text)[:200] if current_title else text
            continue

        # Body content
        if current_title:
            current_body.append(text)

    flush()

    # Filter out items whose body is just the title repeated.
    real_items: list[AppendixItem] = []
    for it in items:
        body_minus_title = it.body_text.replace(it.item_title, "", 1).strip()
        if len(body_minus_title.split()) >= _MIN_BODY_WORDS // 2:
            real_items.append(it)

    sections: list[Section] = []
    for item in real_items:
        flags = _heuristic_flags(item.body_text)
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
