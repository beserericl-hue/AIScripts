"""Section splitter.

Three-tier strategy:
  Tier A — TOC-driven (detects "Table of Contents" in MD; uses entries as cuts)
  Tier B — heading-driven (splits on ATX headings ``^# / ## / ###``)
  Tier C — semantic sliding window (last resort; ~800-token chunks)

Each Section gets heuristic flags used by the supporting-evidence classifier
(``hasResumeSignals``, ``hasSyllabusSignals``) and structural metadata
(``containsTable``, ``wordCount``).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

# ----------------------------------------------------------------------- types


@dataclass
class Section:
    id: str
    heading: str
    heading_level: int  # 1, 2, 3, 0 (no heading)
    markdown: str
    byte_offset_start: int
    byte_offset_end: int
    word_count: int
    contains_table: bool
    contains_image: bool
    has_resume_signals: bool
    has_syllabus_signals: bool
    splitter_tier: str  # "toc" | "headings" | "semantic"
    flags: dict[str, bool] = field(default_factory=dict)


# ---------------------------------------------------------- heuristic detectors

_TOC_HEADING_RE = re.compile(
    r"^#{1,3}\s+(table of contents|contents)\s*$",
    re.IGNORECASE | re.MULTILINE,
)
_ATX_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
_MD_TABLE_ROW_RE = re.compile(r"^\s*\|.*\|\s*$", re.MULTILINE)
_MD_IMAGE_RE = re.compile(r"!\[[^\]]*\]\([^)]+\)")

_RESUME_PATTERNS = [
    re.compile(r"\b(curriculum\s*vit[ae]e?|c\.?\s*v\.?)\b", re.IGNORECASE),
    re.compile(r"\b(work\s+experience|employment\s+history)\b", re.IGNORECASE),
    re.compile(r"\b(education)\b\s*[:\n]", re.IGNORECASE),
    re.compile(r"\b(references\s+available)\b", re.IGNORECASE),
]
_SYLLABUS_PATTERNS = [
    re.compile(r"\b(course\s+(syllabus|number|description))\b", re.IGNORECASE),
    re.compile(r"\b(learning\s+outcomes?|course\s+objectives?)\b", re.IGNORECASE),
    re.compile(r"\b(prerequisites?)\b\s*[:\n]", re.IGNORECASE),
    re.compile(r"\b(credit\s+hours?)\b", re.IGNORECASE),
]


def _heuristic_flags(markdown: str) -> dict[str, bool]:
    resume = sum(bool(p.search(markdown)) for p in _RESUME_PATTERNS) >= 2
    syllabus = sum(bool(p.search(markdown)) for p in _SYLLABUS_PATTERNS) >= 2
    return {
        "containsTable": bool(_MD_TABLE_ROW_RE.search(markdown)),
        "containsImage": bool(_MD_IMAGE_RE.search(markdown)),
        "hasResumeSignals": resume,
        "hasSyllabusSignals": syllabus,
    }


def _word_count(text: str) -> int:
    return len(text.split())


# ---------------------------------------------------------------- splitter API


def split_markdown(markdown: str, doc_id: str = "doc") -> list[Section]:
    """Split a Markdown document into sections using the best applicable tier."""
    if _TOC_HEADING_RE.search(markdown):
        sections = _split_by_toc(markdown, doc_id)
        if len(sections) >= 3:
            return sections
    # Tier B: headings (use it whenever there's at least one heading)
    sections = _split_by_headings(markdown, doc_id)
    if sections:
        return sections
    # Tier C: semantic chunking
    return _split_semantic(markdown, doc_id)


# ---------------------------------------------------------- Tier A: TOC-driven

def _split_by_toc(markdown: str, doc_id: str) -> list[Section]:
    """Use the TOC as a hint to find body-section headings, then split on those.

    Strategy: collect heading anchors that appear in the TOC list AND later
    in the document body. Use those as section boundaries. Fall back to plain
    heading-split for the body if TOC doesn't pan out.
    """
    toc_match = _TOC_HEADING_RE.search(markdown)
    if not toc_match:
        return []
    after_toc = markdown[toc_match.end():]
    # In practice TOC entries are bulleted/numbered lines that match body
    # headings. We approximate by finding the next ATX heading after TOC and
    # delegating to the heading splitter for that region — TOC presence is
    # mostly a confidence signal that the document is well-structured.
    return _split_by_headings(after_toc, doc_id, tier_label="toc")


# ----------------------------------------------------------- Tier B: headings


def _split_by_headings(
    markdown: str, doc_id: str, tier_label: str = "headings"
) -> list[Section]:
    matches = list(_ATX_HEADING_RE.finditer(markdown))
    if not matches:
        return []
    sections: list[Section] = []
    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(markdown)
        body = markdown[start:end]
        heading = m.group(2).strip()
        heading_level = len(m.group(1))
        flags = _heuristic_flags(body)
        sections.append(
            Section(
                id=f"{doc_id}:sec:{i:04d}",
                heading=heading,
                heading_level=heading_level,
                markdown=body,
                byte_offset_start=start,
                byte_offset_end=end,
                word_count=_word_count(body),
                contains_table=flags["containsTable"],
                contains_image=flags["containsImage"],
                has_resume_signals=flags["hasResumeSignals"],
                has_syllabus_signals=flags["hasSyllabusSignals"],
                splitter_tier=tier_label,
                flags=flags,
            )
        )
    return sections


# --------------------------------------------------- Tier C: semantic chunking


def _split_semantic(
    markdown: str, doc_id: str, target_words: int = 600, overlap_words: int = 80
) -> list[Section]:
    words = markdown.split()
    if not words:
        return []
    sections: list[Section] = []
    step = max(1, target_words - overlap_words)
    for i, start in enumerate(range(0, len(words), step)):
        end = min(start + target_words, len(words))
        chunk_words = words[start:end]
        body = " ".join(chunk_words)
        # Reconstruct approximate byte offsets — semantic is best-effort so we
        # set both to whole-document range; downstream consumers shouldn't rely
        # on these for marker insertion (semantic chunks aren't anchored).
        flags = _heuristic_flags(body)
        sections.append(
            Section(
                id=f"{doc_id}:semchunk:{i:04d}",
                heading=f"(unnamed section {i + 1})",
                heading_level=0,
                markdown=body,
                byte_offset_start=0,
                byte_offset_end=len(markdown),
                word_count=len(chunk_words),
                contains_table=flags["containsTable"],
                contains_image=flags["containsImage"],
                has_resume_signals=flags["hasResumeSignals"],
                has_syllabus_signals=flags["hasSyllabusSignals"],
                splitter_tier="semantic",
                flags=flags,
            )
        )
        if end >= len(words):
            break
    return sections


# --------------------------------------------- utility for callers that need MD


def to_dict(section: Section) -> dict:
    return {
        "id": section.id,
        "heading": section.heading,
        "headingLevel": section.heading_level,
        "markdown": section.markdown,
        "byteOffsetStart": section.byte_offset_start,
        "byteOffsetEnd": section.byte_offset_end,
        "wordCount": section.word_count,
        "containsTable": section.contains_table,
        "containsImage": section.contains_image,
        "hasResumeSignals": section.has_resume_signals,
        "hasSyllabusSignals": section.has_syllabus_signals,
        "splitterTier": section.splitter_tier,
    }


def sections_total_words(sections: Iterable[Section]) -> int:
    return sum(s.word_count for s in sections)
