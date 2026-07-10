"""Sniff a DOCX to decide which parser pipeline it belongs in.

The wizard supports two input shapes today:

  - ``template`` — the CSHSE Self-Study Template DOCX format. Spec-as-
    outline; each section heading IS a Handbook prompt; the institution
    writes a ``Response:`` underneath. Parsed by
    :mod:`app.splitter.template_walker`. Used by institutions just
    starting accreditation, re-imported repeatedly.

  - ``self_study`` — free-form finished or near-finished self-study
    (Stevenson-style). Has a TOC, a main narrative with arbitrary
    headings, and a structured appendix. Parsed by the
    :mod:`app.splitter.toc_anchor_walker` /
    :mod:`app.splitter.deep_walker` /
    :mod:`app.splitter.appendix_walker` trio after HTML conversion.

Detection is conservative: only call ``template`` when strong signals
exist (template title in the first paragraphs, or many ``Response:``
markers + many template-style headings). Otherwise default to
``self_study``, which has the broader downstream pipeline and graceful
fallbacks. The sniff function never raises on unfamiliar input — it
returns a verdict with low confidence and the raw signals so the caller
can decide what to do.

This is *additive* to the existing walkers: nothing about Stevenson's
parsing changes, and the template walker isn't touched here either.
The detector is a thin shim above both.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from docx import Document

Format = Literal["template", "self_study", "mcc_narrative"]

# Title strings that appear early in the CSHSE Self-Study Template DOCX
# and its sibling Reader Report templates. Case-insensitive match.
_TEMPLATE_TITLE_RES = [
    re.compile(r"self[-\s]?study template", re.I),
    re.compile(r"self[-\s]?study reader report", re.I),
    re.compile(r"council for standards in human service education.*template", re.I | re.DOTALL),
]

# "Response:" — the marker that follows each prompt in the template
# format. A free-form self-study almost never uses this verbatim.
_RESPONSE_RE = re.compile(r"^\s*Response\s*:", re.I)

# Template-style heading shapes. Same ordering / patterns as
# template_walker._HEADING_PATTERNS but kept duplicated so the detector
# doesn't depend on the walker's internals.
_TEMPLATE_HEADING_RES = [
    re.compile(r"^\s*\d{1,2}\.\s"),                        # "1. Specify the degree(s)"
    re.compile(r"^\s*\d{1,2}[a-h]\.?\s"),                  # "2a. Describe…"
    re.compile(r"^\s*\d{1,2}\.[a-h]\.?\s"),                # "1.a Provide…"
    re.compile(
        r"^\s*Standard\s+\d{1,2}\s*[,.\s]+\s*Specification\s+[a-h]",
        re.I,
    ),                                                      # "Standard 1, Specification a"
    re.compile(r"^\s*Standard\s+\d{1,2}\s*[a-h]\.", re.I),  # "Standard 12b."
]

# Strong self-study signals: counts of these indicate the document is a
# free-form finished self-study rather than a template. We don't *need*
# these for the decision (absence of template signals → default
# self_study) but they raise confidence on a positive verdict.
_SELF_STUDY_HEADING_RES = [
    # Free-form free-text headings used in real self-studies but NOT in
    # the template format. These are best-effort.
    re.compile(r"^\s*Faculty\s+(CVs?|Resum[eé]s?|Vitae)\b", re.I),
    re.compile(r"^\s*Curriculum\s+Matrix\b", re.I),
    re.compile(r"^\s*Appendix\b", re.I),
    re.compile(r"^\s*Faculty\s+Handbook\b", re.I),
]


# ---------------------------------------------------------------- types


@dataclass
class FormatDetection:
    """A format verdict plus the raw signals that drove it.

    The ``signals`` map is included so callers can log or surface it to
    the user (the dispatcher CLI prints it). ``reasoning`` is a one-line
    human-readable summary of how the verdict was reached.
    """
    format: Format
    confidence: float
    signals: dict[str, int | bool] = field(default_factory=dict)
    reasoning: str = ""


# ---------------------------------------------------------------- public API


def detect_format_from_paragraphs(
    paragraphs: list[str],
    head_paragraphs: int = 20,
) -> FormatDetection:
    """Pure-function detector over a paragraph list.

    Kept separate from ``detect_format`` for unit testing without DOCX
    I/O. ``paragraphs`` is the document's paragraphs in order.
    """
    head_text = " ".join(p.strip() for p in paragraphs[:head_paragraphs] if p)
    template_title_hit = any(r.search(head_text) for r in _TEMPLATE_TITLE_RES)

    response_count = sum(1 for p in paragraphs if _RESPONSE_RE.match(p.strip() if p else ""))
    template_heading_count = sum(
        1
        for p in paragraphs
        if p and any(r.match(p.strip()) for r in _TEMPLATE_HEADING_RES)
    )
    self_study_heading_count = sum(
        1
        for p in paragraphs
        if p and any(r.match(p.strip()) for r in _SELF_STUDY_HEADING_RES)
    )

    signals: dict[str, int | bool] = {
        "template_title_in_head": template_title_hit,
        "response_marker_count": response_count,
        "template_heading_count": template_heading_count,
        "self_study_heading_count": self_study_heading_count,
        "total_paragraphs": len(paragraphs),
    }

    if template_title_hit:
        return FormatDetection(
            format="template",
            confidence=0.95,
            signals=signals,
            reasoning=(
                f"Template title matched in the first {head_paragraphs} "
                "paragraphs of the DOCX."
            ),
        )
    if response_count >= 3 and template_heading_count >= 5:
        return FormatDetection(
            format="template",
            confidence=0.85,
            signals=signals,
            reasoning=(
                f"{response_count} 'Response:' markers and "
                f"{template_heading_count} template-style headings — "
                "strong spec-as-outline signals."
            ),
        )
    # No strong template signals. Default to self_study with moderate
    # confidence raised slightly when we see explicit self-study hints
    # like Faculty CVs / Appendix / Curriculum Matrix.
    confidence = 0.70 + min(0.15, self_study_heading_count * 0.03)
    return FormatDetection(
        format="self_study",
        confidence=min(confidence, 0.90),
        signals=signals,
        reasoning=(
            "No template-format signals detected; defaulting to free-form "
            f"self-study. Found {self_study_heading_count} self-study-shaped "
            "headings."
        ),
    )


def detect_format(docx_path: str, head_paragraphs: int = 20) -> FormatDetection:
    """Sniff a file and return its format verdict.

    Handles both DOCX (the original two formats) and **PDF** (the MCC
    independent-narrative format). The MCC document is a single large PDF, so
    when the bytes are a PDF we extract its text and run the MCC signal check
    before anything else.
    """
    try:
        with open(docx_path, "rb") as fh:
            head = fh.read(5)
    except OSError:
        head = b""

    if head.startswith(b"%PDF"):
        return _detect_format_pdf(docx_path)

    doc = Document(docx_path)
    paragraphs = [(p.text or "") for p in doc.paragraphs]
    return detect_format_from_paragraphs(paragraphs, head_paragraphs=head_paragraphs)


def _detect_format_pdf(pdf_path: str) -> FormatDetection:
    """PDF branch. MCC narrative when the ``Standard #N`` + Appendix-Index
    signals fire; otherwise fall back to free-form ``self_study`` (a PDF
    self-study without those markers still has the broader pipeline)."""
    from pypdf import PdfReader

    from app.splitter.mcc_narrative_walker import detect_mcc_signals, is_mcc_narrative

    try:
        reader = PdfReader(pdf_path)
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
    except Exception as exc:  # noqa: BLE001
        text = ""
    signals = detect_mcc_signals(text)
    if is_mcc_narrative(signals):
        return FormatDetection(
            format="mcc_narrative",
            confidence=0.95,
            signals={
                "standard_hash_markers": signals["standard_hash_markers"],
                "has_appendix_index": signals["has_appendix_index"],
                "supporting_document_refs": signals["supporting_document_refs"],
                "is_pdf": True,
            },
            reasoning=(
                f"{signals['standard_hash_markers']} 'Standard #N' markers + "
                f"Appendix Index={signals['has_appendix_index']} + "
                f"{signals['supporting_document_refs']} supporting-document refs — "
                "MCC independent-narrative PDF."
            ),
        )
    return FormatDetection(
        format="self_study",
        confidence=0.60,
        signals={"is_pdf": True, **{k: int(v) if isinstance(v, bool) else v for k, v in signals.items()}},
        reasoning="PDF without MCC markers; defaulting to free-form self-study.",
    )
