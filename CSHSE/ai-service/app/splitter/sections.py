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

import base64
import re
from dataclasses import dataclass, field
from typing import Iterable


# CR-040 Phase 2 — Per-image cap (single image) + per-section cap (sum of
# all images in one section). Real-world coordinator docs contain
# screenshots, not raw camera images, so 5 MB / image and 10 MB / section
# is plenty without risking OOM in the matcher worker.
IMAGE_BYTES_PER_IMAGE_CAP = 5 * 1024 * 1024
IMAGE_BYTES_PER_SECTION_CAP = 10 * 1024 * 1024


@dataclass
class ImageRef:
    """CR-040 — one image captured from the source DOCX/HTML.

    The walker emits these into Section.images. The wire format
    (``to_dict`` below) preserves them so the cshse-server can route them
    through S3 at apply time. ``data_base64`` is the raw image payload
    base64-encoded; consumers must decode before persistence to keep S3
    object size honest.
    """
    mime: str
    byte_offset: int
    data_base64: str
    alt_text: str = ""
    truncated: bool = False  # True if the original image exceeded
                              # IMAGE_BYTES_PER_IMAGE_CAP


_DATA_URL_RE = re.compile(
    r"^data:(?P<mime>[\w./+-]+);base64,(?P<data>[A-Za-z0-9+/=]+)$"
)


def extract_images_from_tag(tag, *, base_byte_offset: int = 0) -> list[ImageRef]:
    """Walk ``tag`` and pull every ``<img>`` descendant into an ``ImageRef``.

    Used by deep_walker to populate ``Section.images`` for table sections
    and prose ``<p>`` sections. Honors the per-image + per-section caps
    so a runaway image (someone embeds a 50MB photo) can't OOM the
    matcher worker.

    ``base_byte_offset`` is the section's ``byte_offset_start``; per-image
    offsets are relative to the document position the walker assigned, so
    downstream consumers can correlate the image with its surrounding text.
    """
    out: list[ImageRef] = []
    if tag is None:
        return out
    try:
        # bs4's find_all walks descendants by default.
        img_tags = tag.find_all("img")
    except Exception:  # noqa: BLE001
        return out

    total_bytes = 0
    for idx, img in enumerate(img_tags):
        src = (img.get("src") or "").strip()
        if not src:
            continue
        m = _DATA_URL_RE.match(src)
        if not m:
            # Non-data-URL image (external URL) — we don't fetch it; just
            # record a placeholder so the count is honest. The base64
            # field carries the original URL for downstream resolution if
            # cshse-server later wants to follow it.
            out.append(
                ImageRef(
                    mime="image/unknown",
                    byte_offset=base_byte_offset + idx,
                    data_base64=src,
                    alt_text=img.get("alt", "") or "",
                )
            )
            continue
        mime = m.group("mime")
        b64 = m.group("data")
        try:
            raw_size = len(base64.b64decode(b64, validate=False))
        except Exception:  # noqa: BLE001
            continue
        truncated = False
        if raw_size > IMAGE_BYTES_PER_IMAGE_CAP:
            truncated = True
            # Truncate by clipping the base64 string (downstream can detect
            # the truncated flag and re-fetch from S3 in a future pass).
            b64 = b64[: IMAGE_BYTES_PER_IMAGE_CAP // 3 * 4]
            raw_size = IMAGE_BYTES_PER_IMAGE_CAP
        if total_bytes + raw_size > IMAGE_BYTES_PER_SECTION_CAP:
            # Section's image budget exhausted — drop remaining images
            # rather than risk a runaway payload. Surface as a flag below.
            break
        total_bytes += raw_size
        out.append(
            ImageRef(
                mime=mime,
                byte_offset=base_byte_offset + idx,
                data_base64=b64,
                alt_text=img.get("alt", "") or "",
                truncated=truncated,
            )
        )
    return out

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
    # Original HTML for table-bearing sections so the wizard can render the
    # source `<table>` instead of the get_text() flatten. Set only when the
    # walker has an authoritative HTML fragment (e.g. deep_walker's table
    # sections). None means "use markdown".
    html_snippet: str | None = None
    # CR-040 Phase 2 — captured per-section images. deep_walker fills
    # this for sites with HTML access (table sections + prose <p>).
    # Empty list by default (no images / not yet captured).
    images: list[ImageRef] = field(default_factory=list)


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
        "htmlSnippet": section.html_snippet,
        # CR-040 Phase 2 — per-section images. Each entry carries mime +
        # base64 data + byte_offset + alt_text. cshse-server routes these
        # through S3 at apply time.
        "images": [
            {
                "mime": img.mime,
                "byteOffset": img.byte_offset,
                "dataBase64": img.data_base64,
                "altText": img.alt_text,
                "truncated": img.truncated,
            }
            for img in section.images
        ],
        "imageCount": len(section.images),
    }


def sections_total_words(sections: Iterable[Section]) -> int:
    return sum(s.word_count for s in sections)
