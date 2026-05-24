"""CR-033 Phase 2 — Faculty CV detector.

Runs after ``deep_walker`` produces the linear section stream but BEFORE
the matcher routes them. Detected CV ranges are pulled out of the
matcher's input so a faculty CV doesn't compete with regular spec
narratives for placement.

Detection heuristic per the CR spec — all three signals must be present
within a short window:

1. **Anchor line** — short (< 60 chars), 2-4 title-case words, no verbs
   or Standard-X reference. Optionally followed within 3 lines by an
   email or phone.
2. **Section markers** — within 30 lines after the anchor, at least TWO
   of: EDUCATION / ACADEMIC EMPLOYMENT / TEACHING EXPERIENCES /
   PROFESSIONAL EXPERIENCE / PUBLICATIONS / LICENSES /
   CERTIFICATIONS / CURRICULUM VITAE.
3. **End boundary** — next anchor with section markers, or a CSHSE-style
   heading (``Standard X``, ``X.a``, ``Specification``, ``Table of
   Contents``), or end-of-document.

Cheap regex throughout. No ML. Optimised for recall over precision —
false positives become editable Discard-able cards.

Public surface:

* ``detect_cvs(sections)`` — accepts an ordered ``list[Section]``,
  returns ``(cv_items, residual_sections)`` where ``residual_sections``
  has the CV-classified sections removed.
* ``CVDetection`` — the per-detection record used both as the public
  output and as the wire format for the cshse-server.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable

from app.splitter.sections import Section


# ----------------------------------------------------------------------
# Heuristic regexes — line-anchored where it matters.
# ----------------------------------------------------------------------

# 2-5 tokens forming a person name. Each token is either:
#  - A title-case word with optional apostrophe / hyphen
#    (e.g. "Barry", "O'Brien", "Mary-Jane")
#  - A capitalised single-letter middle initial with optional period
#    (e.g. "W", "W.")
#  - A common lowercase particle ("de", "del", "van", "von", "della",
#    "la", "di", "da") that joins compound surnames.
# Honorifics are stripped first; trailing punctuation on the full line
# is normalised before tokenisation.
_TITLE_PREFIX_RE = re.compile(r"^(Dr|Prof|Mr|Mrs|Ms|Mx)\.?\s+", re.IGNORECASE)
_NAME_WORD_RE = re.compile(r"^[A-Z][A-Za-z'\-]{1,30}$")
_NAME_INITIAL_RE = re.compile(r"^[A-Z]\.?$")
_NAME_PARTICLES = {"de", "del", "della", "van", "von", "la", "di", "da", "du"}
_TRAILING_PUNCT_RE = re.compile(r"[,.;:]+$")

_CONTACT_RE = re.compile(
    r"(\b[\w.+-]+@[\w-]+\.\w{2,}\b)|(\+?\d[\d\s().-]{6,}\d)",
    re.IGNORECASE,
)

# Section markers a CV typically contains. Case-insensitive,
# line-anchored — a paragraph that happens to mention "education" in
# prose doesn't trigger; the WORD has to start a line.
_CV_SECTION_MARKERS = (
    "curriculum vitae",
    "education",
    "academic employment",
    "teaching experience",
    "teaching experiences",
    "professional experience",
    "professional employment",
    "publications",
    "presentations",
    "licenses",
    "licensure",
    "certifications",
    "honors and awards",
    "research interests",
    "service",
)
_CV_SECTION_MARKERS_RE = re.compile(
    r"(?im)^\s*("
    + "|".join(re.escape(m) for m in _CV_SECTION_MARKERS)
    + r")\b\s*:?\s*$"
)

# CSHSE structural markers that bound a CV against the rest of the
# document. Catching these prevents the detector from running off the
# end of a CV into a Standard's narrative.
_CSHSE_BOUNDARY_RE = re.compile(
    r"(?im)^\s*(standard\s+\d+|spec(?:ification)?\s+|table\s+of\s+contents|appendix\b)",
)


# ----------------------------------------------------------------------
# Public types
# ----------------------------------------------------------------------


@dataclass
class CVDetection:
    """One detected CV (one faculty per detection).

    Mirrors the client-side ``CVItem`` shape (see ``aiImportStore.ts``)
    so the wire format is symmetric. ``section_ids`` records every input
    Section that contributed to this CV so the caller can drop them from
    the matcher's input.
    """
    section_id: str
    faculty_name: str
    snippet: str
    html_snippet: str | None
    byte_offset_start: int
    section_marker_count: int
    section_ids: list[str] = field(default_factory=list)


# ----------------------------------------------------------------------
# Implementation helpers
# ----------------------------------------------------------------------


def _strip_honorific(line: str) -> str:
    return _TITLE_PREFIX_RE.sub("", line, count=1).strip()


def _is_name_token(tok: str) -> bool:
    if _NAME_WORD_RE.match(tok):
        return True
    if _NAME_INITIAL_RE.match(tok):
        return True
    if tok.lower() in _NAME_PARTICLES:
        return True
    return False


def _is_anchor_line(line: str) -> str | None:
    """Return the normalised faculty name if ``line`` looks like a CV anchor,
    else None.

    Permissive — false positives become editable Discard-able cards;
    false negatives mean a CV slips past detection and surfaces as a
    misrouted narrative, which is the bug we're trying to fix.
    """
    s = line.strip()
    if not s or len(s) > 60:
        return None
    s = _TRAILING_PUNCT_RE.sub("", s)
    s = _strip_honorific(s)
    tokens = s.split()
    if not (2 <= len(tokens) <= 4):
        return None
    if not all(_is_name_token(tok) for tok in tokens):
        return None
    # The FIRST token must be a real title-case word, not an initial or
    # particle (otherwise things like "W. del Smith" would pass).
    if not _NAME_WORD_RE.match(tokens[0]):
        return None
    # At least one token must be a real name word (so "W. del J." doesn't
    # qualify — it needs at least one full name).
    if sum(bool(_NAME_WORD_RE.match(t)) for t in tokens) < 2:
        return None
    # Filter out lines that contain Standard-N or spec-id, even though
    # they could pass the token check (e.g. "Standard One Introduction").
    low = s.lower()
    if "standard" in low or "spec" in low or "appendix" in low:
        return None
    return s


def _count_cv_markers(text: str) -> int:
    return len(set(m.group(1).lower() for m in _CV_SECTION_MARKERS_RE.finditer(text)))


def _contains_cshse_boundary(text: str) -> bool:
    return bool(_CSHSE_BOUNDARY_RE.search(text))


def _section_is_cv_candidate(section: Section) -> tuple[str, int] | None:
    """Return ``(faculty_name, marker_count)`` if the section's first
    non-blank line is a plausible anchor AND its body has >=2 CV section
    markers, else None.
    """
    text = section.markdown or ""
    if not text.strip():
        return None
    # First non-blank line drives anchor detection.
    first_line = next((ln for ln in text.splitlines() if ln.strip()), "")
    name = _is_anchor_line(first_line)
    if not name:
        return None
    marker_count = _count_cv_markers(text)
    if marker_count < 2:
        return None
    # Reject if the section straddles a CSHSE structural marker — that
    # means we'd swallow content that belongs to a Standard.
    if _contains_cshse_boundary(text):
        return None
    return (name, marker_count)


# ----------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------


def detect_cvs(
    sections: Iterable[Section],
) -> tuple[list[CVDetection], list[Section]]:
    """Scan an ordered section stream for faculty CVs.

    Returns a tuple ``(cv_items, residual_sections)``:
    * ``cv_items`` — one ``CVDetection`` per detected CV.
    * ``residual_sections`` — the input list MINUS any section that was
      consumed by a CV detection. The caller (e.g. ``import_jobs``) feeds
      these to the matcher; CV-classified sections never compete with
      regular specs for routing.

    Pure function — no I/O, no logging. Deterministic on the input.
    """
    sections_list = list(sections)
    cvs: list[CVDetection] = []
    consumed_ids: set[str] = set()

    for sec in sections_list:
        if sec.id in consumed_ids:
            continue
        candidate = _section_is_cv_candidate(sec)
        if not candidate:
            continue
        name, marker_count = candidate
        # First-line snippet preview ~ 200 chars of body for the wire
        # format. The full body is in ``markdown``; the snippet is just
        # for the card preview.
        snippet = (sec.markdown or "").strip()[:200]
        cvs.append(
            CVDetection(
                section_id=sec.id,
                faculty_name=name,
                snippet=snippet,
                html_snippet=sec.html_snippet,
                byte_offset_start=sec.byte_offset_start,
                section_marker_count=marker_count,
                section_ids=[sec.id],
            )
        )
        consumed_ids.add(sec.id)

    residual = [s for s in sections_list if s.id not in consumed_ids]
    return cvs, residual


def cv_to_dict(cv: CVDetection) -> dict:
    """Wire format for the cshse-server callback. Matches the client-side
    ``CVItem`` shape so the apply-payload round-trip is symmetric."""
    return {
        "sectionId": cv.section_id,
        "facultyName": cv.faculty_name,
        "snippet": cv.snippet,
        "htmlSnippet": cv.html_snippet,
        "byteOffsetStart": cv.byte_offset_start,
        "routing": {"source": "matcher"},  # Phase 2: matrix-row routing
                                            # adds 'matrix'/'heading' values.
        "sectionMarkerCount": cv.section_marker_count,
    }
