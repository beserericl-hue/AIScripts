"""CR-040 follow-on (2026-05-27) — TOC-anchored two-pass detector.

User feedback after the first redetect deploy: the pattern-based
``cv_detector`` and ``appendix_paper_detector`` missed several real
CVs (Thomas K. Swisher, Lauri A. Weiner, ...) in the Stevenson
document because the body anchor didn't fire — e.g. the CV body
opened with credentials on a separate line, or the section markers
inside the CV were capitalised differently ("Education" vs the
detector's "EDUCATION" expectation).

But the document's Table of Contents is the ground truth: it lists
every CV, syllabus, and paper that's actually in the appendix. So
instead of trying to detect items by matching ever-more-permissive
body anchors (which inflates false positives), we use the TOC as the
canonical index and treat the body extraction as a slicing problem:

Pass 1 — :func:`parse_toc`
    Find the "Table of Contents" heading in the document. Walk forward
    until the body starts. Group entries by their TOC section heading
    ("CVs", "Syllabi", "Papers / Projects") and per-entry by their
    text content. Each entry gets a kind: ``cv`` / ``syllabus`` /
    ``paper`` / ``unknown``.

Pass 2 — :func:`anchor_in_body`
    For each non-unknown TOC entry, find the earliest body paragraph
    whose normalized text starts with (or contains) the normalized
    entry label. That's the entry's anchor. The body slice runs from
    that anchor's paragraph index to the next anchor's index
    (exclusive). One :class:`TocAnchoredDetection` per anchor found.

The caller (``/ai/import/redetect``) merges TOC-anchored detections
with the pattern-based pre/post-scan output, deduping by a normalized
person-name or course-code key — see :func:`merge_detections`.

Pure function — no I/O, no LLM, no network. Lexical only. Deterministic
on the input HTML bytes.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal


TocEntryKind = Literal["cv", "syllabus", "paper", "unknown"]


@dataclass
class TocEntry:
    """One parsed Table-of-Contents entry."""

    label: str
    """Cleaned label text (no dotted page-number leader, no trailing
    page number). E.g. ``"Thomas K. Swisher, J.D., Ph.D."``"""

    kind: TocEntryKind
    """Best-guess classification. ``unknown`` entries are not anchored
    in the body — they sit out of the second pass."""

    raw: str
    """Original text including dotted leaders + page number, for
    diagnostics."""

    section_hint: str | None = None
    """The TOC section heading this entry sits under, if known
    (``cv`` / ``syllabus`` / ``paper``). The section hint takes
    precedence over per-entry lexical classification — under a "CVs"
    heading, even a plain-name entry classifies as ``cv``."""


@dataclass
class TocAnchoredDetection:
    """One TOC-entry-anchored body slice."""

    label: str
    kind: TocEntryKind
    body_html: str
    body_text: str
    byte_offset_start: int
    section_hint: str | None = None
    course_code: str | None = None
    """Extracted course code, if the label or body contains one
    (syllabus entries)."""


# ----------------------------------------------------------------------
# Regex toolbelt
# ----------------------------------------------------------------------

# Strip dotted leaders + trailing page numbers from TOC entry lines.
# Handles:
#   "John Rosicky ........ 45"
#   "John Rosicky\t45"
#   "John Rosicky…… 45"   (ellipsis chars)
#   "John Rosicky____ 45"           (underscore leader)
_TOC_TRAILER_RE = re.compile(r"\s*(?:\.{2,}|\t+|…+|_{2,})\s*\d{1,4}\s*$")
_LONE_TRAILING_PAGE_RE = re.compile(r"\s+\d{1,4}\s*$")
_PAGE_PREFIX_RE = re.compile(r"\s+page\s+\d+\s*$", re.IGNORECASE)

# Course code: 2-4 uppercase letters + 3-digit number, optional trailing
# letter. E.g. ``CHS 220``, ``ENG101``, ``MATH 220A``.
_COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,4})\s?(\d{3}[A-Z]?)\b")

# Curriculum-Vitae signals.
_CV_LABEL_RE = re.compile(
    r"\b(?:curriculum\s+vitae|cvs?|faculty\s+cv)\b", re.IGNORECASE
)

# Syllabus signals.
_SYLLABUS_LABEL_RE = re.compile(r"syllab(?:us|i)", re.IGNORECASE)

# Paper / project signals.
_PAPER_LABEL_RE = re.compile(
    r"\b(?:paper|project|research|sample|report)\b", re.IGNORECASE
)

# Common credentials suffixes — strip from labels for matching.
_CREDENTIALS_SUFFIX_RE = re.compile(
    r",?\s*(?:"
    r"J\.?\s?D\.?|"
    r"Ph\.?\s?D\.?|"
    r"Ed\.?\s?D\.?|"
    r"M\.?\s?D\.?|"
    r"M\.?\s?A\.?|"
    r"M\.?\s?S\.?|"
    r"M\.?\s?Ed\.?|"
    r"B\.?\s?A\.?|"
    r"B\.?\s?S\.?|"
    r"HS-?BCP|"
    r"LCSW|LPC|LCPC|LCMHC|RN|BSN|MSW|MSN|DSW|BSW|"
    r"NCC|NCSC|ACS|CAS"
    r")\.?(?=$|[,\s])",
    re.IGNORECASE,
)

# A TOC section group heading → entry kind mapping.
# Keys are normalized (lowercase, single space, trailing punctuation stripped).
_TOC_GROUP_HEADINGS: dict[str, TocEntryKind] = {
    "cv": "cv",
    "cvs": "cv",
    "cv's": "cv",
    "curriculum vitae": "cv",
    "curricula vitae": "cv",
    "faculty cv": "cv",
    "faculty cvs": "cv",
    "faculty curriculum vitae": "cv",
    "faculty curricula vitae": "cv",
    "faculty resumes": "cv",
    "syllabus": "syllabus",
    "syllabi": "syllabus",
    "course syllabi": "syllabus",
    "course syllabus": "syllabus",
    "syllabuses": "syllabus",
    "papers": "paper",
    "papers projects": "paper",
    "papers and projects": "paper",
    "projects": "paper",
    "student work": "paper",
    "student papers": "paper",
    "student projects": "paper",
    "research papers": "paper",
    "sample papers": "paper",
}

# Headings that mark the END of the TOC region — once we hit one in the
# walk-forward, stop. These are the document's body heading or the next
# top-level section.
_TOC_BODY_BOUNDARY_RE = re.compile(
    r"^\s*(?:standard\s+\d+\b|introduction\b|chapter\s+\d+\b|"
    r"executive\s+summary\b|self-?study\b)",
    re.IGNORECASE,
)


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _clean_toc_line(line: str) -> str:
    """Strip dotted leaders + trailing page numbers from a TOC line.

    Subtle: course codes look exactly like ``"<word> <digits>"``
    (``"CHS 220"``), and Standard headers look like ``"Standard 6"``.
    A naive trailing-digit strip would eat the meaningful number out
    of those. So we apply the trailer regex first (which only fires
    when there's a dotted/tab/ellipsis/underscore leader OR an
    explicit ``"page N"`` suffix); if THAT fired, we trust it
    completely and return. Only if no leader was present do we
    consider stripping a lone trailing number — and even then, only
    when the line has 3+ tokens (so 2-token "CHS 220" / "Standard 6"
    survive).
    """
    s = line.strip()
    s = _PAGE_PREFIX_RE.sub("", s)
    after_trailer = _TOC_TRAILER_RE.sub("", s)
    if after_trailer != s:
        return after_trailer.strip()
    parts = s.split()
    if len(parts) >= 3:
        # Only strip a trailing 1-3 digit number — 4-digit numbers are
        # likely years (e.g. "CHS 220 Spring 2019") and should stay.
        if re.search(r"\s+\d{1,3}\s*$", s):
            s = re.sub(r"\s+\d{1,3}\s*$", "", s)
    return s.strip()


def _normalize_heading(text: str) -> str:
    """Heading-style normalization for the TOC-group lookup."""
    s = text.lower().strip()
    s = re.sub(r"[/\-]+", " ", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _classify_entry(text: str, section_hint: TocEntryKind | None) -> TocEntryKind:
    """Decide what kind of supporting-evidence this TOC entry is.

    Precedence:
      1. Section hint from a parent group heading (e.g. under "CVs").
      2. Course code in the entry text → ``syllabus``.
      3. Explicit ``Syllabus`` / ``Syllabi`` token.
      4. Explicit ``Curriculum Vitae`` / ``CV`` token.
      5. ``Paper`` / ``Project`` / ``Research`` token.
      6. 2-5 token title-case sequence (looks like a person name) → ``cv``.
      7. Otherwise ``unknown``.
    """
    if section_hint:
        return section_hint
    if _COURSE_CODE_RE.search(text):
        return "syllabus"
    if _SYLLABUS_LABEL_RE.search(text):
        return "syllabus"
    if _CV_LABEL_RE.search(text):
        return "cv"
    if _PAPER_LABEL_RE.search(text):
        return "paper"
    # Plausibly a person name (no contact info required — we trust the TOC).
    stripped = _CREDENTIALS_SUFFIX_RE.sub("", text).strip(" ,")
    tokens = stripped.split()
    if 2 <= len(tokens) <= 5:
        # All tokens title-case-able (start with uppercase letter or are
        # particles / initials).
        ok = True
        for tok in tokens:
            t = tok.rstrip(",.")
            if not t:
                continue
            if t.lower() in {"de", "del", "della", "van", "von", "la", "di", "da", "du"}:
                continue
            if not t[0].isupper() and not t[0].isalpha():
                # Hyphen / apostrophe-leading? unusual — bail.
                ok = False
                break
            if not t[0].isupper():
                ok = False
                break
        if ok:
            return "cv"
    return "unknown"


def _extract_course_code(text: str) -> str | None:
    m = _COURSE_CODE_RE.search(text)
    if not m:
        return None
    return f"{m.group(1)} {m.group(2)}"


def _normalize_label_for_match(label: str) -> str:
    """Fuzzy-match normalization: lowercase, strip credentials, strip
    punctuation, collapse whitespace."""
    s = _CREDENTIALS_SUFFIX_RE.sub("", label).strip(" ,")
    s = re.sub(r"[^a-zA-Z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def normalize_person_key(name: str) -> str:
    """Public — produces a canonical person-name key used by
    :func:`merge_detections` to dedupe across TOC-anchored and
    pattern-based detections. Strips credentials, collapses
    middle-initial dots, lowercases."""
    s = _CREDENTIALS_SUFFIX_RE.sub("", name).strip(" ,")
    s = re.sub(r"\.", "", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def normalize_course_key(code: str) -> str:
    """Public — collapse ``"CHS 220"`` / ``"chs220"`` to a single
    canonical key ``"chs 220"``."""
    m = _COURSE_CODE_RE.search(code or "")
    if not m:
        return (code or "").strip().lower()
    return f"{m.group(1).lower()} {m.group(2).lower()}"


# ----------------------------------------------------------------------
# Pass 1 — TOC parsing
# ----------------------------------------------------------------------


def parse_toc(html_bytes: bytes) -> list[TocEntry]:
    """Parse the document's Table of Contents.

    Returns one :class:`TocEntry` per child entry, in document order.
    Empty list if no TOC heading is found.

    Heuristic — the Table of Contents is identified by:

    * A heading element (``<h1>``/``<h2>``/``<h3>``) whose text starts
      with ``"Table of Contents"``, OR
    * The first paragraph whose stripped text exactly equals
      ``"Table of Contents"`` (case-insensitive).

    From that anchor, walk forward through siblings, treating each
    non-empty top-level ``<p>``/``<h*>`` as a candidate entry. Stop on:

    * A long paragraph (>200 chars) — that's body text.
    * A heading matching :data:`_TOC_BODY_BOUNDARY_RE` (Standard N,
      Introduction, Chapter N, ...) where the text length suggests
      it's a body header, not a TOC line.
    * 5 consecutive blank elements.

    Inside the TOC, lines that match a known group heading
    (``"CVs"``, ``"Syllabi"``, ``"Papers / Projects"``) update the
    current ``section_hint`` so subsequent children inherit it.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()

    # Find the TOC anchor. Prefer headings, fall back to paragraphs.
    toc_anchor = None
    for tag in soup.find_all(["h1", "h2", "h3"]):
        if tag.get_text(strip=True).lower().startswith("table of contents"):
            toc_anchor = tag
            break
    if toc_anchor is None:
        for tag in soup.find_all("p"):
            if tag.get_text(strip=True).lower() == "table of contents":
                toc_anchor = tag
                break
    if toc_anchor is None:
        return []

    entries: list[TocEntry] = []
    current_hint: TocEntryKind | None = None
    blank_run = 0

    # Walk through document-order successors so nested tags don't trip us up.
    for sib in _iter_following_block_tags(toc_anchor):
        text = sib.get_text(separator=" ", strip=True)
        if not text:
            blank_run += 1
            if blank_run >= 5:
                break
            continue
        blank_run = 0

        # Body-boundary heuristic — once we cross into the body, stop.
        # For heading elements (h1-h3), a body-boundary text like
        # "Introduction" or "Standard 1" is authoritative regardless of
        # length — those are document-section headings, not TOC lines.
        # For paragraphs we require a length gate so a TOC entry that
        # happens to start with the word "Introduction" doesn't trip
        # the bail.
        low = text.lower().strip()
        is_heading = sib.name in ("h1", "h2", "h3", "h4")
        if _TOC_BODY_BOUNDARY_RE.match(low):
            if is_heading or len(text) > 60:
                break
        if len(text) > 200:
            # Long paragraph — that's prose, not a TOC line.
            break

        cleaned = _clean_toc_line(text)
        if not cleaned:
            continue
        cleaned_norm = _normalize_heading(cleaned)
        if cleaned_norm in _TOC_GROUP_HEADINGS:
            current_hint = _TOC_GROUP_HEADINGS[cleaned_norm]
            continue
        # Trailing colon variant ("CVs:") — also a group heading.
        if cleaned_norm.endswith(":") and cleaned_norm[:-1].strip() in _TOC_GROUP_HEADINGS:
            current_hint = _TOC_GROUP_HEADINGS[cleaned_norm[:-1].strip()]
            continue

        kind = _classify_entry(cleaned, current_hint)
        entries.append(
            TocEntry(
                label=cleaned,
                kind=kind,
                raw=text,
                section_hint=current_hint,
            )
        )

    return entries


def _iter_following_block_tags(start_tag):
    """Yield following top-level block tags (``<p>``, ``<h1>``..``<h6>``,
    ``<li>``) in document order, starting after ``start_tag``.

    Skips tags nested inside a ``<table>`` (matrix territory) and
    skips repeated containers — we want one tag per visible TOC line.
    """
    seen = set()
    for tag in start_tag.find_all_next(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"]):
        if id(tag) in seen:
            continue
        seen.add(id(tag))
        if any(p.name == "table" for p in tag.parents):
            continue
        yield tag


# ----------------------------------------------------------------------
# Pass 2 — body anchoring
# ----------------------------------------------------------------------


def anchor_in_body(
    html_bytes: bytes,
    toc_entries: list[TocEntry],
) -> list[TocAnchoredDetection]:
    """Pass 2 — locate each TOC entry's anchor in the body and slice
    content from there to the next anchor.

    Returns one :class:`TocAnchoredDetection` per TOC entry whose
    anchor was found in the body. TOC entries with no body match are
    dropped — they remain only as TOC listings without supporting
    content (the caller can choose to surface them as low-confidence
    placeholders or skip them).

    Matching rule — for each TOC entry's normalized label:

    1. Find body paragraphs after the TOC region whose normalized
       text **starts with** the label (label-as-prefix).
    2. If no prefix match, fall back to **contains-in-first-120-chars**.

    Once an anchor is assigned, its paragraph index is reserved — no
    two TOC entries map to the same body anchor.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()

    # Find the TOC anchor (same logic as parse_toc). The body region
    # starts AFTER the TOC ends — we find the TOC anchor, then walk
    # forward until we cross into the body (per the same boundary rule).
    toc_anchor = None
    for tag in soup.find_all(["h1", "h2", "h3"]):
        if tag.get_text(strip=True).lower().startswith("table of contents"):
            toc_anchor = tag
            break
    if toc_anchor is None:
        for tag in soup.find_all("p"):
            if tag.get_text(strip=True).lower() == "table of contents":
                toc_anchor = tag
                break

    # Walk forward collecting body block tags. The body starts at the
    # first long paragraph or body-boundary heading after the TOC.
    body_start_tag = None
    if toc_anchor is not None:
        for sib in _iter_following_block_tags(toc_anchor):
            text = sib.get_text(separator=" ", strip=True)
            if not text:
                continue
            low = text.lower().strip()
            if _TOC_BODY_BOUNDARY_RE.match(low) and len(text) > 60:
                body_start_tag = sib
                break
            if len(text) > 200:
                body_start_tag = sib
                break

    if body_start_tag is None:
        # No TOC or no body boundary — fall back to "start from the first
        # block tag in the document".
        all_blocks = list(soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"]))
        if not all_blocks:
            return []
        body_start_tag = all_blocks[0]

    # Collect body tags in document order.
    body_tags = []
    for tag in [body_start_tag] + list(_iter_following_block_tags(body_start_tag)):
        if any(p.name == "table" for p in tag.parents):
            continue
        if not tag.get_text(strip=True):
            continue
        body_tags.append(tag)

    if not body_tags:
        return []

    # Pre-normalize the body text for fuzzy prefix matching.
    body_norms = [
        _normalize_label_for_match(t.get_text(separator=" ", strip=True))
        for t in body_tags
    ]

    # For each non-unknown TOC entry, find the earliest unused body
    # index whose normalized text starts with (or contains) the target.
    anchors: list[tuple[int, TocEntry]] = []
    used_indices: set[int] = set()
    for entry in toc_entries:
        if entry.kind == "unknown":
            continue
        target = _normalize_label_for_match(entry.label)
        if not target or len(target) < 4:
            continue
        chosen_idx: int | None = None
        # Pass A — strict prefix match.
        for idx, norm in enumerate(body_norms):
            if idx in used_indices:
                continue
            if norm.startswith(target):
                chosen_idx = idx
                break
        # Pass B — contains-in-first-120 (loose fallback).
        if chosen_idx is None:
            for idx, norm in enumerate(body_norms):
                if idx in used_indices:
                    continue
                if target in norm[:120]:
                    chosen_idx = idx
                    break
        # Pass C — for course-coded syllabi, match by course code alone.
        if chosen_idx is None and entry.kind == "syllabus":
            cc = _extract_course_code(entry.label)
            if cc:
                cc_target = _normalize_label_for_match(cc)
                for idx, norm in enumerate(body_norms):
                    if idx in used_indices:
                        continue
                    if cc_target in norm[:80]:
                        chosen_idx = idx
                        break
        if chosen_idx is not None:
            anchors.append((chosen_idx, entry))
            used_indices.add(chosen_idx)

    anchors.sort(key=lambda pair: pair[0])

    detections: list[TocAnchoredDetection] = []
    for i, (start_idx, entry) in enumerate(anchors):
        end_idx = anchors[i + 1][0] if i + 1 < len(anchors) else len(body_tags)
        # Hard cap on slice length — a missing terminal anchor shouldn't
        # let the last entry swallow everything to EOD.
        end_idx = min(end_idx, start_idx + 400)
        slice_tags = body_tags[start_idx:end_idx]
        body_html = "\n".join(str(t) for t in slice_tags)
        body_text = "\n\n".join(
            t.get_text(separator="\n", strip=True) for t in slice_tags
        ).strip()
        course_code = _extract_course_code(entry.label) or _extract_course_code(
            body_text[:400]
        )
        detections.append(
            TocAnchoredDetection(
                label=entry.label,
                kind=entry.kind,
                body_html=body_html,
                body_text=body_text,
                byte_offset_start=start_idx,
                section_hint=entry.section_hint,
                course_code=course_code,
            )
        )
    return detections


# ----------------------------------------------------------------------
# Merge helpers — used by /ai/import/redetect to combine TOC-anchored
# detections with the existing pattern-based detector output.
# ----------------------------------------------------------------------


def merge_cv_detections(
    pattern_cvs: list[dict],
    toc_detections: list[TocAnchoredDetection],
) -> list[dict]:
    """Combine pattern-based CV wire dicts with TOC-anchored CVs.

    Dedupe by :func:`normalize_person_key`. TOC-anchored entries are
    appended only when their normalized name is NOT already in the
    pattern-based set. Pattern-based entries always win on overlap
    (they carry the original ``section_id`` the rest of the pipeline
    expects).
    """
    seen = {
        normalize_person_key(d.get("facultyName") or ""): True
        for d in pattern_cvs
    }
    merged = list(pattern_cvs)
    for det in toc_detections:
        if det.kind != "cv":
            continue
        key = normalize_person_key(det.label)
        if not key or key in seen:
            continue
        seen[key] = True
        # Synthesise a wire dict matching cv_to_dict's output.
        snippet = (det.body_text or det.label).strip()[:200]
        section_id = f"cv-toc:{det.byte_offset_start}:{key.replace(' ', '-')}"
        merged.append(
            {
                "sectionId": section_id,
                "facultyName": det.label,
                "snippet": snippet,
                "htmlSnippet": det.body_html or None,
                "byteOffsetStart": det.byte_offset_start,
                "routing": {"source": "toc"},
                "sectionMarkerCount": 0,
            }
        )
    return merged


def merge_evidence_doc_detections(
    pattern_docs: list[dict],
    toc_detections: list[TocAnchoredDetection],
) -> list[dict]:
    """Combine pattern-based evidence-doc wire dicts (papers + syllabi)
    with TOC-anchored evidence-docs.

    Dedupe rules:
      * Syllabi → by course code (:func:`normalize_course_key`), falling
        back to title-normalized.
      * Papers → by title-normalized.
    """
    seen_courses: set[str] = set()
    seen_titles: set[str] = set()
    for d in pattern_docs:
        if d.get("docSubKind") == "syllabus":
            cc = d.get("courseCode")
            if cc:
                seen_courses.add(normalize_course_key(cc))
        title_key = _normalize_label_for_match(d.get("title") or "")
        if title_key:
            seen_titles.add(title_key)

    merged = list(pattern_docs)
    for det in toc_detections:
        if det.kind not in ("syllabus", "paper"):
            continue
        title_key = _normalize_label_for_match(det.label)
        course_key = (
            normalize_course_key(det.course_code) if det.course_code else None
        )
        if det.kind == "syllabus" and course_key and course_key in seen_courses:
            continue
        if title_key and title_key in seen_titles:
            continue
        if title_key:
            seen_titles.add(title_key)
        if course_key:
            seen_courses.add(course_key)

        summary = (det.body_text or det.label).strip()[:200]
        word_count = len((det.body_text or "").split())
        page_estimate = max(1, word_count // 300)
        section_id = (
            f"{det.kind}-toc:{det.byte_offset_start}:"
            f"{(title_key or 'unknown').replace(' ', '-')}"
        )
        merged.append(
            {
                "sectionId": section_id,
                "docSubKind": det.kind,
                "title": det.label,
                "summary": summary,
                "byteOffsetStart": det.byte_offset_start,
                "pageCountEstimate": page_estimate,
                "imageCount": 0,
                "courseCode": det.course_code,
                "points": None,
                "s3Key": None,
                "s3Bucket": None,
                "fileSize": None,
                "sha256": None,
            }
        )
    return merged
