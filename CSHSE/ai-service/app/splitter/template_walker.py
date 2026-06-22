"""Walker for the CSHSE Self-Study Template DOCX format.

The template format is the spec-as-outline alternative to a free-form
self-study like Stevenson's: each section is named directly after a
prompt from the Handbook (``1. Specify the degree(s)…``, ``2a. Describe
the organizational structure…``, ``Standard 1, Specification a.``) and
the institution writes a ``Response:`` underneath each. This format is
what institutions just starting accreditation receive as a writing
template, and they re-import it repeatedly as more sections are filled.

What this walker does:

  1. Reads the DOCX directly with python-docx (no HTML conversion).
  2. Walks paragraphs in document order. A paragraph whose text matches
     one of the template heading patterns starts a new section. Body
     paragraphs accumulate to the most recent heading.
  3. Treats ``Response:`` as a marker within a section, not a section
     boundary. The body after it is the institution's content.
  4. Treats ``See Appendix …`` lines as content (the matcher uses them
     as evidence pointers, not as cuts).
  5. Detects empty / ``Not applicable`` placeholder responses so the
     preview can show them as "section started but unwritten".
  6. Emits ``Section`` objects shaped exactly like the other walkers so
     the matcher + bucket allocator + coverage reviewer all run
     unchanged downstream.

What this walker does NOT do:

  - Table extraction. The template format embeds the Table of Contents,
    a Curriculum Requirements credit-hours table, and an Appendix list
    as tables; none of those carry per-spec narrative content. The
    matrix data extractor (``app/matrix/data_extractor.py``) handles
    matrix DOCX/tables separately when present.
  - HTML conversion. The template format ships as DOCX and is small
    (~400 KB) so we read paragraphs directly. A Stevenson-style HTML
    pipeline would be overkill.
"""
from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field

from docx import Document

from app.splitter.sections import Section, _heuristic_flags

# A "See Appendix …" / "See Part II Appendices …" reference. In real PC
# submissions these are REMINDERS for the coordinator to import the named
# appendix document as supporting evidence — never extractable content. We
# surface them as import reminders, we do not treat them as evidence files.
_APPENDIX_RE = re.compile(
    r"see\s+(?:part\s+[ivx]+\s+)?append(?:ix|ices)\b[^\n]{0,160}",
    re.IGNORECASE,
)

# ----------------------------------------------------------------- patterns
#
# Ordered from most-specific to most-general. The first pattern to match a
# paragraph's text wins. Patterns capture standard / spec hints when they
# appear in the heading itself; the matcher uses these as doc-letter /
# doc-standard-hint signals.

_HEADING_PATTERNS = [
    # "Standard 1, Specification a." or "Standard 11 Specification b"
    re.compile(
        r"^\s*Standard\s+(?P<std>\d{1,2})\s*[,.\s]+\s*Specification\s+(?P<spec>[a-j])\b",
        re.IGNORECASE,
    ),
    # "Standard 12b." / "Standard 16c"
    re.compile(
        r"^\s*Standard\s+(?P<std>\d{1,2})\s*(?P<spec>[a-j])\.?\s+",
        re.IGNORECASE,
    ),
    # "Standard 1:" / "Standard 4: The program shall…" — the colon form a
    # program uses to open a Standard whose normative ("shall") sentence runs
    # ON THE SAME LINE. It's a Standard ROOT: a std hint, NO spec. The specs
    # (1a., 1b., …) follow underneath. (Must precede the bare-standard rule.)
    re.compile(r"^\s*Standard\s+(?P<std>\d{1,2})\s*:", re.IGNORECASE),
    # "1.a." / "11.b" — dotted spec form (Handbook canonical form)
    re.compile(r"^\s*(?P<std>\d{1,2})\.(?P<spec>[a-j])\.?\s"),
    # "1a." / "2b" — undotted spec form (template intro-section form)
    re.compile(r"^\s*(?P<std>\d{1,2})(?P<spec>[a-j])\.?\s"),
    # Section root like "1." / "2." / "Standard 1" — std hint without spec
    re.compile(r"^\s*(?P<std>\d{1,2})\.\s"),
    re.compile(r"^\s*Standard\s+(?P<std>\d{1,2})\b\s*$", re.IGNORECASE),
    # "A. Required Self-Study Introductory…", "B. Glossary", etc.
    re.compile(r"^\s*(?P<letter>[A-Z])\.\s+[A-Z]"),
]

# The heading that OPENS the standards region. Everything BEFORE the first one
# of these is the document Introduction (front matter + the intro's own
# "1." / "2a." prompts + the closing Glossary of terms). The user's rule:
# "document introduction ends with glossary of terms" — and the glossary always
# sits just before the first Standard.
#
# Match ONLY a true boundary: a Roman-numeral part header ("I. GENERAL PROGRAM
# CHARACTERISTICS") or a Standard ROOT — "Standard 1:" (colon) or a bare
# "Standard 1" on its own line. Deliberately NOT inline curriculum citations
# like "Standard 13 a:" or "Standard 12b. …", which the front-matter program
# description sprinkles BEFORE the glossary — those must not end the intro early
# (that was dropping the glossary out of the introduction).
#
# Why the region matters: the Introduction reuses spec-LOOKING numbering ("2a.
# Describe the organizational structure" is an INTRO prompt, not Standard 2 spec
# a). Held inside the intro region, those hints are dropped so nothing misfiles
# under a Standard — the whole region routes to introduction:document instead.
_STANDARDS_REGION_RE = re.compile(
    r"^\s*(?:[IVX]+\.\s+[A-Z]|Standard\s+\d{1,2}\s*(?::|\.?\s*$))",
    re.IGNORECASE,
)

# Markers that are not section breaks — they appear inside a section body.
_RESPONSE_MARKER_RE = re.compile(r"^\s*Response\s*:\s*", re.IGNORECASE)

# Placeholder responses the institution hasn't filled in.
_PLACEHOLDER_RE = re.compile(
    r"^\s*(not\s+applicable|n/?a|tbd|to\s+be\s+determined|\[response\]|insert\s+response)\s*\.?\s*$",
    re.IGNORECASE,
)

# Headings that are document-front matter (skip — they don't map to specs).
_FRONT_MATTER_HEADINGS = re.compile(
    r"^\s*(table of contents|introduction and instructions|"
    r"council for standards in human service education|self-study template)\b",
    re.IGNORECASE,
)


# ---------------------------------------------------------------- public types


@dataclass
class TemplateSection:
    """A heading + accumulated body from the template DOCX, pre-Section.

    Kept as a thin intermediate so callers (and tests) can inspect what
    the walker found before it's wrapped into the downstream ``Section``
    dataclass. The ``placeholder`` flag is True when the response body
    is empty or matches the ``_PLACEHOLDER_RE`` patterns ("Not
    applicable", "TBD", etc.) — the wizard surfaces these as
    "started-but-unwritten" rather than passing them to the matcher.
    """
    paragraph_index: int  # 0-based index of the heading paragraph in the DOCX
    heading: str
    body_paragraphs: list[str]
    standard_hint: str | None
    spec_hint: str | None
    placeholder: bool
    # True when this section lives in the document Introduction region (before
    # the first Standard / Roman part header — title block, intro prompts,
    # glossary). These route to introduction:document, and their spec-looking
    # numbering is NOT trusted as Standard hints.
    is_introduction: bool = False
    # Embedded TABLES that fall under this section in document order (faculty
    # rosters, advisory-board attendee lists, credit-hour grids). The paragraph
    # walk drops tables entirely, so these are captured separately and surfaced
    # as SUPPORTING EVIDENCE for the section's spec. Each: {"html","text"}.
    evidence_tables: list[dict] = field(default_factory=list)
    # "See Appendix …" references found in this section's prose — surfaced as
    # PC import reminders (import that appendix doc as supporting evidence).
    appendix_refs: list[str] = field(default_factory=list)

    @property
    def body_text(self) -> str:
        return "\n\n".join(p for p in self.body_paragraphs if p).strip()

    @property
    def word_count(self) -> int:
        return len(self.body_text.split())


# ---------------------------------------------------------------- helpers


def _is_front_matter(text: str) -> bool:
    """``True`` for template title / instructions / TOC headings — these are
    skipped entirely (neither a section cut nor accumulated as body) so
    the title-page lines under them don't bleed into a pseudo-section.
    """
    return bool(_FRONT_MATTER_HEADINGS.match(text))


def _match_heading(text: str) -> tuple[str | None, str | None] | None:
    """Return ``(std_hint, spec_hint)`` if ``text`` matches a heading pattern.

    The hints may both be None even on a match (e.g. ``"B. Glossary"`` is
    a heading but doesn't carry a numeric standard hint). Front matter
    returns ``(None, None)`` so the walker can detect it and skip — see
    ``_is_front_matter``.
    """
    if _is_front_matter(text):
        return (None, None)
    for pat in _HEADING_PATTERNS:
        m = pat.match(text)
        if not m:
            continue
        std = m.groupdict().get("std")
        spec = m.groupdict().get("spec")
        return (std, spec.lower() if spec else None)
    return None


def _strip_response_marker(text: str) -> str:
    """Drop a leading ``Response:`` marker; return the remainder (possibly empty)."""
    return _RESPONSE_MARKER_RE.sub("", text).strip()


def _extract_appendix_refs(text: str) -> list[str]:
    """Return any ``See Appendix …`` references in ``text`` (verbatim, trimmed)."""
    return [m.group(0).strip() for m in _APPENDIX_RE.finditer(text or "")]


def _esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _table_to_text(table) -> str:
    return "\n".join(
        " | ".join((c.text or "").strip() for c in r.cells) for r in table.rows
    ).strip()


def _table_to_html(table) -> str:
    rows = [
        "<tr>" + "".join(f"<td>{_esc((c.text or '').strip())}</td>" for c in r.cells) + "</tr>"
        for r in table.rows
    ]
    return "<table>" + "".join(rows) + "</table>"


def _iter_block_items(doc):
    """Yield ``("p", text)`` and ``("table", html, text)`` for every paragraph
    and table in the document, IN DOCUMENT ORDER. ``doc.paragraphs`` alone drops
    tables; we walk the body XML so embedded tables land under the right section.
    """
    from docx.oxml.text.paragraph import CT_P
    from docx.oxml.table import CT_Tbl
    from docx.table import Table as _Table
    from docx.text.paragraph import Paragraph as _Paragraph

    for child in doc.element.body.iterchildren():
        if isinstance(child, CT_P):
            yield ("p", _Paragraph(child, doc).text or "")
        elif isinstance(child, CT_Tbl):
            t = _Table(child, doc)
            yield ("table", _table_to_html(t), _table_to_text(t))


def _is_placeholder(body_paragraphs: list[str]) -> bool:
    """A section is a placeholder when every non-empty body paragraph
    matches the ``_PLACEHOLDER_RE`` pattern, or when the body is empty.

    ``See Appendix …`` lines alone are NOT placeholders — they're
    legitimate references — but a body of ONLY a "See Appendix" pointer
    AND nothing else is also treated as unwritten content for preview
    purposes (the institution hasn't actually authored a response yet).
    """
    real = [p.strip() for p in body_paragraphs if p.strip()]
    if not real:
        return True
    non_placeholder = [
        p for p in real
        if not _PLACEHOLDER_RE.match(p) and not p.lower().startswith("see appendix")
    ]
    return not non_placeholder


# ---------------------------------------------------------------- public API


def walk_template_paragraphs(
    paragraph_texts: list[str],
) -> list[TemplateSection]:
    """Pure-function walker over a list of paragraph strings (no tables).

    Thin wrapper over :func:`walk_template_blocks` — kept for the unit tests
    and any caller that only has paragraph text.
    """
    return walk_template_blocks([("p", t) for t in paragraph_texts])


def walk_template_blocks(blocks: list[tuple]) -> list[TemplateSection]:
    """Walk an in-document-order block stream into sections.

    Each block is ``("p", text)`` or ``("table", html, text)``. Paragraphs cut
    and fill sections exactly as before; a table attaches to the CURRENT
    section's ``evidence_tables`` (so embedded rosters/grids stay with their
    spec instead of being dropped). ``See Appendix …`` lines are also recorded
    on the section as import reminders.
    """
    sections: list[TemplateSection] = []
    current: TemplateSection | None = None
    # Everything before the first Standard / Roman part header is the document
    # Introduction (ends with the glossary of terms). Only gate on this when the
    # document ACTUALLY has a standards region — otherwise a bare fragment of
    # "1." / "2a." headings (no Standard) keeps its spec hints (old behavior).
    text_blocks = [b[1] for b in blocks if b and b[0] == "p"]
    has_standards_region = any(
        _STANDARDS_REGION_RE.match((t or "").strip()) for t in text_blocks
    )
    in_introduction = has_standards_region

    for idx, block in enumerate(blocks):
        if block and block[0] == "table":
            # A table belongs to whatever section it sits under in the document.
            if current is not None:
                current.evidence_tables.append({"html": block[1], "text": block[2]})
            continue

        text = (block[1] if block else "").strip()
        if not text:
            continue

        # Skip front-matter lines (template title, "Introduction and
        # Instructions:", "Table of Contents"). They are not section
        # cuts AND they should not be accumulated into the body of the
        # previous section. Dropping them entirely is cleanest.
        if _is_front_matter(text):
            continue

        # Leaving the Introduction: the first Standard (or Roman part header)
        # ends it. Detected BEFORE heading classification so the Standard line
        # itself is NOT tagged as introduction.
        if in_introduction and _STANDARDS_REGION_RE.match(text):
            in_introduction = False

        hit = _match_heading(text)
        if hit is not None:
            # Close the previous section.
            if current is not None:
                current.placeholder = _is_placeholder(current.body_paragraphs)
                sections.append(current)
            std_hint, spec_hint = hit
            if in_introduction:
                # Intro numbering ("1.", "2a.", "B. Glossary") is the intro's
                # own, NOT Standard specs — drop the hints so nothing buckets
                # under a Standard; the section routes to introduction:document.
                std_hint, spec_hint = None, None
            current = TemplateSection(
                paragraph_index=idx,
                heading=text,
                body_paragraphs=[],
                standard_hint=std_hint,
                spec_hint=spec_hint,
                placeholder=False,  # set on close
                is_introduction=in_introduction,
            )
            continue

        if current is None:
            # Paragraphs before the first heading are preamble — drop them.
            # The template's actual content always starts under a heading.
            continue

        # Record any "See Appendix …" references as import reminders (kept in
        # the body too — they're part of the prose, just also actionable).
        refs = _extract_appendix_refs(text)
        if refs:
            current.appendix_refs.extend(refs)

        # Inside a section. Strip ``Response:`` markers; if the line is
        # only the marker, skip it entirely (the body comes on the next
        # paragraph). Otherwise keep what remains.
        stripped = _strip_response_marker(text)
        if not stripped:
            continue
        current.body_paragraphs.append(stripped)

    if current is not None:
        current.placeholder = _is_placeholder(current.body_paragraphs)
        sections.append(current)

    return sections


def walk_template_docx(
    docx_path: str,
    base_id: str = "template",
) -> tuple[list[Section], list[TemplateSection]]:
    """Open a DOCX and walk it. Returns ``(sections, raw_template_sections)``.

    ``sections`` is the ``Section`` list the matcher consumes.
    ``raw_template_sections`` is the intermediate form, kept so the
    preview renderer can show placeholder/empty sections that the
    matcher never sees.
    """
    doc = Document(docx_path)
    blocks = list(_iter_block_items(doc))
    raw_sections = walk_template_blocks(blocks)

    sections: list[Section] = []
    for raw in raw_sections:
        # A Standard ROOT ("Standard 9: …the program shall…") carries its
        # normative statement IN THE HEADING, so its body is often empty — but
        # it still anchors that Standard's introduction. Emit it even when the
        # body is a placeholder; skip only genuinely-unwritten spec responses.
        is_std_root = bool(
            raw.standard_hint
            and not raw.spec_hint
            and not raw.is_introduction
            and re.match(r"^\s*Standard\b", raw.heading, re.IGNORECASE)
        )
        if raw.placeholder and not is_std_root:
            # Don't send unwritten / "Not applicable" sections through the
            # matcher — there's nothing to classify and we'd just waste
            # API calls (and add noise to the preview).
            continue
        md = f"# {raw.heading}\n\n{raw.body_text}"
        flags = _heuristic_flags(md)
        # Carry the heading-derived hints in flags so downstream coverage /
        # bucket-allocation can also surface them, not just the matcher.
        # Introduction-region sections carry NO standard/spec hint and a
        # document-introduction routing hint instead — the template pipeline
        # routes them to the documentIntroduction bucket rather than the matcher.
        if raw.is_introduction:
            flags["templateStandardHint"] = ""
            flags["templateSpecHint"] = ""
            flags["templateIntroductionHint"] = "introduction:document"
        elif raw.standard_hint and not raw.spec_hint and re.match(
            r"^\s*Standard\b", raw.heading, re.IGNORECASE
        ):
            # A Standard ROOT ("Standard 1: …the program shall…") — the
            # normative sentence + Context framing is NOT a spec response;
            # route it to that Standard's introduction (standardIntroductions[N]).
            flags["templateStandardHint"] = raw.standard_hint
            flags["templateSpecHint"] = ""
            flags["templateIntroductionHint"] = f"introduction:standard-{raw.standard_hint}"
        else:
            flags["templateStandardHint"] = raw.standard_hint or ""
            flags["templateSpecHint"] = raw.spec_hint or ""
        flags["templateHeading"] = raw.heading[:200]
        sections.append(
            Section(
                id=f"{base_id}:tmpl:{uuid.uuid4().hex[:8]}",
                heading=raw.heading[:200],
                heading_level=2,
                markdown=md,
                byte_offset_start=0,
                byte_offset_end=len(md),
                word_count=len(md.split()),
                contains_table=flags.get("containsTable", False),
                contains_image=flags.get("containsImage", False),
                has_resume_signals=flags.get("hasResumeSignals", False),
                has_syllabus_signals=flags.get("hasSyllabusSignals", False),
                splitter_tier="template",
                flags=flags,
            )
        )
    return sections, raw_sections
