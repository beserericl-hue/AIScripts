"""CR-040 Phase 2b — Appendix paper + syllabus detector.

Per the spec, a section is an **appendix-paper candidate** when all
three signals are present within a short window:

1. **Header marker** — line ending in ``(NN points)``, or matching
   ``Sample/Report/Paper/Essay/Reflection/Interview``, or a course-code
   line ``CHS 220`` near the header.
2. **Position context** — after an ``Appendix\\b`` marker, after the
   main TOC, or in the last 25% of the document.
3. **Body length** — ≥200 words OR ≥1 image.

Signals 1 + 3 are section-local and live in this Phase 2b module.
Signal 2 (position context) requires document-wide state and ships in
Phase 2c alongside the boundary-validation pass (CR-040 addendum).

A separate ``detect_syllabi`` function applies the same shape with a
syllabus-specific header marker set. Both detectors return
``EvidenceDocDetection`` records with ``doc_sub_kind`` set to ``paper``
or ``syllabus``.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Iterable, Literal

from app.splitter.sections import Section


# ----------------------------------------------------------------------
# Paper header signals
# ----------------------------------------------------------------------

# Line ending in "(NN points)" — strongest single signal in CSHSE
# student-work appendices ("RESEARCH PAPER (Individual Work) (125 points)").
_POINTS_LINE_RE = re.compile(r"\(\s*\d{1,4}\s+points?\s*\)\s*$", re.IGNORECASE | re.MULTILINE)

# Paper titles like "Sample Country Report", "Immigrant Interview Paper",
# "Research Paper", "Final Project". Two-word minimum so generic
# "Report" alone doesn't fire.
_TITLE_KEYWORDS = (
    "report",
    "paper",
    "project",
    "essay",
    "reflection",
    "interview",
    "thesis",
    "capstone",
    "dissertation",
)
_TITLE_LINE_RE = re.compile(
    r"(?im)^\s*(?:Sample\s+)?[A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){0,4}\s+("
    + "|".join(_TITLE_KEYWORDS)
    + r")\s*$"
)

# Course code anywhere in the first ~5 lines (e.g. "CHS 220 Spring 2019").
_COURSE_CODE_RE = re.compile(r"\b[A-Z]{2,5}\s+\d{2,4}\b")

# Points value lifted out of a "(NN points)" line so the detector can
# attach it as metadata.
_POINTS_VALUE_RE = re.compile(r"\(\s*(\d{1,4})\s+points?\s*\)", re.IGNORECASE)


# ----------------------------------------------------------------------
# Syllabus header signals
# ----------------------------------------------------------------------

# Course code in the heading or first line is mandatory for a syllabus —
# without it we can't attribute the file to a course.
_SYLLABUS_KEYWORDS = (
    "syllabus",
    "course outline",
    "course description",
    "learning outcomes",
    "course objectives",
    "course schedule",
    "credit hours",
    "prerequisites",
)
_SYLLABUS_KEYWORDS_RE = re.compile(
    r"(?im)\b(" + "|".join(re.escape(k) for k in _SYLLABUS_KEYWORDS) + r")\b"
)


# ----------------------------------------------------------------------
# Public types
# ----------------------------------------------------------------------


DocSubKind = Literal["paper", "syllabus"]


@dataclass
class EvidenceDocDetection:
    """One detected appendix paper or syllabus.

    Mirrors the client-side ``EvidenceDocItem`` shape (see
    ``aiImportStore.ts``) so the wire format is symmetric.
    """
    section_id: str
    doc_sub_kind: DocSubKind
    title: str
    summary: str
    byte_offset_start: int
    page_count_estimate: int
    image_count: int
    course_code: str | None = None
    points: int | None = None
    section_ids: list[str] = field(default_factory=list)
    # Full body text used by Phase 2c .docx generation. Empty string
    # short-circuits the upload pipeline (a detection whose body the
    # walker couldn't capture lands as a metadata-only card).
    body: str = ""
    # Populated by import_jobs after a successful .docx generation +
    # S3 upload. The client's "View file" button opens these.
    s3_key: str | None = None
    s3_bucket: str | None = None
    file_size: int | None = None
    sha256: str | None = None


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def _first_non_blank_line(text: str, count: int = 1) -> list[str]:
    out: list[str] = []
    for line in text.splitlines():
        if line.strip():
            out.append(line.rstrip())
            if len(out) >= count:
                break
    return out


def _is_paper_header(text: str) -> tuple[str | None, int | None]:
    """Return ``(title, points)`` if the section's first ~5 lines look
    like an appendix-paper header, else ``(None, None)``.

    ``title`` is the matched title line (cleaned). ``points`` is parsed
    from a ``(NN points)`` suffix if present.
    """
    head = "\n".join(_first_non_blank_line(text, count=5))
    title_match = _TITLE_LINE_RE.search(head)
    points_match = _POINTS_LINE_RE.search(head)
    if not (title_match or points_match):
        return None, None
    # Prefer a clean title line; fall back to the first non-blank line.
    if title_match:
        title = title_match.group(0).strip()
    else:
        title = _first_non_blank_line(text)[0] if text.strip() else ""
    points = None
    pv = _POINTS_VALUE_RE.search(head)
    if pv:
        try:
            points = int(pv.group(1))
        except ValueError:
            points = None
    return title or None, points


def _is_syllabus_header(text: str, heading: str = "") -> tuple[bool, str | None]:
    """Return ``(matched, course_code)``. Syllabus needs course code AND
    at least one syllabus keyword in heading+first-5-lines."""
    haystack = " ".join([heading, "\n".join(_first_non_blank_line(text, count=10))])
    kw_match = _SYLLABUS_KEYWORDS_RE.search(haystack)
    if not kw_match:
        return False, None
    code_match = _COURSE_CODE_RE.search(haystack)
    if not code_match:
        return False, None
    return True, code_match.group(0)


def _estimate_pages(word_count: int, image_count: int) -> int:
    """Rough page count for the metadata badge. Word density of 300/page
    + 1 page per 2 images. Floor of 1."""
    return max(1, word_count // 300 + image_count // 2)


def _summary_of(text: str, limit: int = 200) -> str:
    return (text or "").strip()[:limit]


# ----------------------------------------------------------------------
# Public API
# ----------------------------------------------------------------------


def detect_evidence_docs(
    sections: Iterable[Section],
    *,
    min_paper_word_count: int = 200,
) -> tuple[list[EvidenceDocDetection], list[Section]]:
    """Scan an ordered section stream for appendix papers + syllabi.

    Returns ``(detections, residual_sections)``: detections are pulled
    out of the residual so they don't compete with regular specs for
    matcher routing.

    Pure function — no I/O. Phase 2c will add position-context filtering
    (only fire on sections in the appendix region) and boundary
    validation; this Phase 2b layer is intentionally permissive.
    """
    sections_list = list(sections)
    detections: list[EvidenceDocDetection] = []
    consumed: set[str] = set()

    for sec in sections_list:
        if sec.id in consumed:
            continue
        text = sec.markdown or ""
        image_count = len(getattr(sec, "images", []) or [])
        # Body-length signal: ≥200 words OR ≥1 image. Both branches
        # protect against header-matching false positives where the body
        # is just a title.
        if sec.word_count < min_paper_word_count and image_count == 0:
            continue

        # Try paper first (more restrictive header).
        title, points = _is_paper_header(text)
        if title:
            detections.append(
                EvidenceDocDetection(
                    section_id=sec.id,
                    doc_sub_kind="paper",
                    title=title,
                    summary=_summary_of(text),
                    byte_offset_start=sec.byte_offset_start,
                    page_count_estimate=_estimate_pages(sec.word_count, image_count),
                    image_count=image_count,
                    points=points,
                    section_ids=[sec.id],
                    body=text,
                )
            )
            consumed.add(sec.id)
            continue

        # Then syllabus.
        is_syllabus, course_code = _is_syllabus_header(text, heading=sec.heading or "")
        if is_syllabus:
            # Title falls back to "<course_code> Syllabus" so the wire
            # card always has something readable.
            title = (sec.heading or "").strip() or f"{course_code} Syllabus"
            detections.append(
                EvidenceDocDetection(
                    section_id=sec.id,
                    doc_sub_kind="syllabus",
                    title=title,
                    summary=_summary_of(text),
                    byte_offset_start=sec.byte_offset_start,
                    page_count_estimate=_estimate_pages(sec.word_count, image_count),
                    image_count=image_count,
                    course_code=course_code,
                    section_ids=[sec.id],
                    body=text,
                )
            )
            consumed.add(sec.id)
            continue

    residual = [s for s in sections_list if s.id not in consumed]
    return detections, residual


def detect_evidence_docs_from_html(
    html_bytes: bytes,
    *,
    min_paper_word_count: int = 200,
) -> tuple[list[EvidenceDocDetection], list[str]]:
    """Pre-walker pass for appendix papers + syllabi.

    Mirrors ``cv_detector.detect_cvs_from_html`` — the standard
    ``deep_walker`` fragments a paper across many `<p>` sections, none
    of which carry BOTH the header signal AND the body length together,
    so ``detect_evidence_docs`` (per-section) never fires on a real
    paper. This pre-scan walks every top-level `<p>` + heading in the
    raw HTML, finds header-signal paragraphs, then accumulates the
    body forward until the next header or document end. Returns
    ``(detections, dropped_paragraph_texts)`` so the caller can
    fingerprint-drop matching deep_walker sections.
    """
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()

    paragraphs: list[str] = []
    for tag in soup.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6"]):
        if any(a.name == "table" for a in tag.parents):
            continue
        text = tag.get_text(separator=" ", strip=True)
        if not text:
            continue
        paragraphs.append(text)

    n = len(paragraphs)
    detections: list[EvidenceDocDetection] = []
    dropped: list[str] = []
    i = 0
    while i < n:
        line = paragraphs[i]
        # Header-signal test: (NN points) line OR a title-line keyword
        # match. Pre-scan is permissive — false positives become
        # editable cards.
        points_hit = _POINTS_LINE_RE.search(line)
        title_hit = _TITLE_LINE_RE.match(line) if not points_hit else None
        is_paper_header = bool(points_hit or title_hit)
        # Syllabus header — coordinator-authored syllabi often split the
        # course-code line from the "Course Syllabus" / "Course
        # Description" / "Learning Outcomes" keyword line. Look across a
        # 3-paragraph window so we catch the dual signal even when the
        # docx puts them on separate <p> tags.
        head_window = "\n".join(paragraphs[i: min(i + 3, n)])
        is_syllabus_header = (
            _SYLLABUS_KEYWORDS_RE.search(head_window) is not None
            and _COURSE_CODE_RE.search(head_window) is not None
        )
        if not (is_paper_header or is_syllabus_header):
            i += 1
            continue

        # Accumulate body forward until the next header-shaped line or
        # the end of the document.
        body_parts = [line]
        consumed_local = [i]
        for j in range(i + 1, min(i + 200, n)):
            nxt = paragraphs[j]
            nxt_points = _POINTS_LINE_RE.search(nxt)
            nxt_title = _TITLE_LINE_RE.match(nxt) if not nxt_points else None
            nxt_is_paper = bool(nxt_points or nxt_title)
            nxt_window = "\n".join(paragraphs[j: min(j + 3, n)])
            nxt_is_syllabus = (
                _SYLLABUS_KEYWORDS_RE.search(nxt_window) is not None
                and _COURSE_CODE_RE.search(nxt_window) is not None
            )
            if (nxt_is_paper or nxt_is_syllabus) and j > i + 3:
                break
            body_parts.append(nxt)
            consumed_local.append(j)
        body = "\n".join(body_parts)
        word_count = len(body.split())
        if word_count < min_paper_word_count:
            i = consumed_local[-1] + 1
            continue

        title: str
        points: int | None = None
        course_code: str | None = None
        kind: DocSubKind
        if is_paper_header:
            kind = "paper"
            if title_hit:
                title = title_hit.group(0).strip()
            else:
                title = line.strip()
            pv = _POINTS_VALUE_RE.search(line)
            if pv:
                try:
                    points = int(pv.group(1))
                except ValueError:
                    points = None
        else:
            kind = "syllabus"
            code = _COURSE_CODE_RE.search(line)
            course_code = code.group(0) if code else None
            title = line.strip()

        synth_id = f"evdoc-prescan:{i}:{kind}"
        detections.append(
            EvidenceDocDetection(
                section_id=synth_id,
                doc_sub_kind=kind,
                title=title,
                summary=_summary_of(body),
                byte_offset_start=i,
                page_count_estimate=_estimate_pages(word_count, 0),
                image_count=0,
                course_code=course_code,
                points=points,
                section_ids=[synth_id],
                body=body,
            )
        )
        dropped.extend(paragraphs[k] for k in consumed_local)
        i = consumed_local[-1] + 1

    return detections, dropped


def evidence_doc_to_dict(doc: EvidenceDocDetection) -> dict:
    """Wire format mirrors the client-side ``EvidenceDocItem`` shape."""
    return {
        "sectionId": doc.section_id,
        "docSubKind": doc.doc_sub_kind,
        "title": doc.title,
        "summary": doc.summary,
        "byteOffsetStart": doc.byte_offset_start,
        "pageCountEstimate": doc.page_count_estimate,
        "imageCount": doc.image_count,
        "courseCode": doc.course_code,
        "points": doc.points,
        # Populated post-upload (Phase 2c). When the S3 upload was
        # skipped (env not configured or skipping intentionally),
        # these stay None; the client's "View file" button greys out.
        "s3Key": doc.s3_key,
        "s3Bucket": doc.s3_bucket,
        "fileSize": doc.file_size,
        "sha256": doc.sha256,
    }
