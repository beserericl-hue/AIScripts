"""Parse the CSHSE National Standards Handbook PDF into structured Specifications.

The Handbook has a consistent (but not perfectly clean) structure:

    I. GENERAL PROGRAM CHARACTERISTICS
    A. Institutional Requirements and Primary Program Objective
    Context: ... (framing prose, ignored)
    Standard 1: ...                  <- Standard prose
        a. ... <- spec 1.a
        b. ... <- spec 1.b
        ...
    B. Philosophical Base of Programs
    Standard 2: ...
        (sometimes bare paragraphs, sometimes lettered)

The parser walks linearly: tracks the current Standard number, then accumulates
text per subspec marker. When Standard 2's specs lack letter markers, we assign
letters sequentially (a, b, c, ...).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from app.standards.loader import Specification


_STANDARD_HEADER_RE = re.compile(r"^Standard\s+(\d{1,2}):\s*(.+?)$", re.MULTILINE)
# Subspec markers (a./b./.../a)/b)/...) — but ONLY where the line genuinely
# starts a list item. Require the letter to be followed by a period/paren OR
# (for bare letters) followed by a single space + a CAPITAL letter (real
# subspec prompts always start with a capital).
_SUBSPEC_RE = re.compile(
    r"^([a-z])(?:[.)]\s+|\s+(?=[A-Z]))(\S.+)$", re.MULTILINE
)
# Section-letter headings like "A. Institutional Requirements..."
# In the real PDF these often appear mid-line ("I. GENERAL ... A. Institutional...")
# so we don't anchor to ^. We DO require the title to start with capital+lowercase
# (rules out ALL-CAPS Roman headings) and have at least 2 words.
_SECTION_HEADER_RE = re.compile(
    r"(?:^|\s{2,})([A-Z])\.\s+([A-Z][a-z][A-Za-z ,&/-]{8,80})(?=\n|$)"
)
# Roman-numeral parts ("I. GENERAL PROGRAM CHARACTERISTICS")
_PART_RE = re.compile(r"^(I{1,3}|IV|V)\.\s+([A-Z][A-Z ]+)$", re.MULTILINE)

# Anything that looks like a noise line (page numbers, headers/footers)
_NOISE_PREFIXES = (
    "Council for Standards",
    "National Standards",
    "BACCALAUREATE",
    "ASSOCIATE",
    "MASTER",
    "http://",
    "https://",
    "Revised ",
    "Page ",
)


def _is_noise_line(s: str) -> bool:
    s = s.strip()
    if not s:
        return True
    if s.isdigit() and len(s) <= 3:
        return True  # bare page numbers
    return any(s.startswith(p) for p in _NOISE_PREFIXES)


def _normalize_whitespace(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


# Imperative verbs the CSHSE Handbook uses to start subspec prompts. When a
# Standard lacks letter markers we use these to detect the start of each
# implicit subspec.
_HANDBOOK_VERBS = {
    "Provide",
    "Describe",
    "Demonstrate",
    "Include",
    "Articulate",
    "Identify",
    "Document",
    "Indicate",
    "Specify",
    "List",
    "Outline",
    "Explain",
    "Compile",
    "Submit",
    "Show",
    "Address",
    "Discuss",
    "Detail",
    "Note",
}


def _join_wrapped_paragraphs(text: str) -> list[str]:
    """Join PDF-wrapped lines into proper paragraphs.

    A line continues the previous paragraph if it starts with a lowercase
    letter OR the previous line did not end with sentence-terminating
    punctuation (``.``, ``!``, ``?``, ``)``, ``:``). A line starting with one of
    the canonical CSHSE imperative verbs always begins a new paragraph.
    """
    lines = [ln.strip() for ln in text.split("\n")]
    paragraphs: list[str] = []
    current = ""
    for line in lines:
        if not line:
            if current:
                paragraphs.append(current)
                current = ""
            continue
        first_word = line.split(" ", 1)[0].rstrip(",.:;)")
        starts_new = first_word in _HANDBOOK_VERBS or first_word in {"a", "b", "c", "d", "e", "f", "g", "h"}
        if not current:
            current = line
            continue
        prev_terminal = current.rstrip().endswith((".", "!", "?", ")", ":"))
        starts_capital = line[:1].isupper()
        if starts_new or (prev_terminal and starts_capital):
            paragraphs.append(current)
            current = line
        else:
            current += " " + line
    if current:
        paragraphs.append(current)
    return paragraphs


@dataclass
class ParsedSpec:
    standard_code: str
    spec_code: str
    standard_title: str  # e.g. "Institutional Requirements and Primary Program Objective"
    standard_prose: str  # the "Standard N: ..." statement
    spec_text: str


def parse_handbook_text(text: str, program_level: str = "bachelors") -> list[Specification]:
    """Parse Handbook plain text into Specification records.

    Heuristics:
      - "Standard N: ..." opens a new Standard.
      - The most-recent "A. <Title>" heading before that line is the standard_title.
      - Lines starting with "[a-z]." or "[a-z] " are subspec markers.
      - If a Standard has *no* lettered subspecs we treat each paragraph (separated
        by blank line) as a sequential subspec, lettered a, b, c, … by order.
      - Sub-numbered "1. 2. 3." inside a subspec (e.g. 3.b.1) are kept as part of
        that subspec's spec_text rather than promoted to standalone specs — the
        Stevenson sections we tag are subspec-letter-level.
    """
    # Build lines list, skipping noise.
    raw_lines = text.split("\n")
    lines: list[str] = []
    for ln in raw_lines:
        if not _is_noise_line(ln):
            lines.append(ln.rstrip())

    # Pass 1: locate every "Standard N:" position with its preceding section title.
    cleaned = "\n".join(lines)

    # Find section-title headings (A. ..., B. ..., etc.) in order so we can
    # associate each Standard with its preceding section title.
    section_titles_by_offset: list[tuple[int, str]] = []
    for m in _SECTION_HEADER_RE.finditer(cleaned):
        title = _normalize_whitespace(m.group(2))
        if title.upper() == title:
            continue
        section_titles_by_offset.append((m.start(), title))

    # Also a lenient scan: titles that appear immediately after a Roman-numeral
    # heading on the same line (the very common "I. GENERAL ... A. Title" form).
    for m in re.finditer(
        r"(?<![a-z])\b([A-Z])\.\s+([A-Z][a-z][A-Za-z ,&/-]{6,80}?)(?=\s+(?:Context:|Standard \d|[A-Z]\.\s+[A-Z][a-z])|$|\n)",
        cleaned,
    ):
        title = _normalize_whitespace(m.group(2))
        if title.upper() == title:
            continue
        # Dedupe against the first pass
        if not any(abs(off - m.start()) < 5 for off, _ in section_titles_by_offset):
            section_titles_by_offset.append((m.start(), title))
    section_titles_by_offset.sort(key=lambda t: t[0])

    def title_for(offset: int, fallback: str) -> str:
        # The standard_title is the most recent A/B/C... heading BEFORE this offset
        last = ""
        for off, t in section_titles_by_offset:
            if off < offset:
                last = t
            else:
                break
        return last or fallback

    # Pass 2: locate every Standard N marker.
    std_positions: list[tuple[int, str, str]] = []  # (offset, std_num, std_prose)
    for m in _STANDARD_HEADER_RE.finditer(cleaned):
        std_num = m.group(1)
        # The "Standard N: " line itself often runs across a hard wrap. Capture
        # the rest of the paragraph up to the next blank line.
        start = m.start()
        rest = cleaned[m.end():]
        # Standard prose ends at the first blank-line gap or at the first subspec marker
        end_idx = None
        for mm in re.finditer(r"\n\s*\n|\n[a-z][\.\)]?\s+", rest):
            end_idx = mm.start()
            break
        prose_block = rest[: end_idx if end_idx is not None else 500]
        prose = _normalize_whitespace((m.group(2) or "") + " " + prose_block)
        std_positions.append((start, std_num, prose))

    # Pass 3: extract per-standard text region and parse subspecs.
    specs: list[Specification] = []
    for i, (start, num, prose) in enumerate(std_positions):
        end = std_positions[i + 1][0] if i + 1 < len(std_positions) else len(cleaned)
        region = cleaned[start:end]
        # Trim trailing section-header so the bare-paragraph fallback doesn't
        # absorb the next Standard's section title (e.g. "C. Community
        # Assessment Context: ...").
        next_section = re.search(
            r"\n[A-Z]\.\s+[A-Z][a-z][A-Za-z ,&/-]{4,80}",
            region,
        )
        if next_section:
            region = region[: next_section.start()]
        # Title: prefer explicit section header; else the Standard's own prose
        # (truncated for use as a label).
        prose_short = _normalize_whitespace(prose).split(". ", 1)[0][:80] or f"Standard {num}"
        title = title_for(start, fallback=prose_short)

        # Find subspec markers within region
        subspec_matches = list(_SUBSPEC_RE.finditer(region))
        if subspec_matches:
            for j, sm in enumerate(subspec_matches):
                letter = sm.group(1).lower()
                # Skip lines where the captured group is the start of a word
                # in the middle of a sentence — heuristic: require the line to
                # start near a paragraph boundary (preceded by newline).
                # In practice _SUBSPEC_RE already uses ^ in MULTILINE so this
                # is guaranteed.
                spec_start = sm.start()
                spec_end = subspec_matches[j + 1].start() if j + 1 < len(subspec_matches) else len(region)
                spec_text = _normalize_whitespace(region[spec_start:spec_end])
                # Strip leading "X." or "X " marker from the captured text
                spec_text = re.sub(rf"^{letter}[\.\)]?\s*", "", spec_text, count=1, flags=re.IGNORECASE)
                if len(spec_text) < 10:
                    continue
                specs.append(
                    Specification(
                        standard_code=num,
                        spec_code=letter,
                        standard_title=title,
                        spec_text=spec_text,
                        program_level=program_level,
                    )
                )
        else:
            # No lettered subspecs found — split the body into paragraphs using
            # the wrapped-line joiner and the Handbook's imperative-verb cues.
            # Skip the Standard prose line itself.
            body = region
            # Cut off the Standard N: ... prose by finding the prose end.
            prose_end_match = re.search(r"\n\s*\n", body) or re.search(r"\.\s*\n", body)
            if prose_end_match:
                body = body[prose_end_match.end():]
            paragraphs = _join_wrapped_paragraphs(body)
            paragraphs = [
                _normalize_whitespace(p) for p in paragraphs
                if not p.startswith(("Context:", "Standard ", "NOTE:", "1. ", "2. ", "3. "))
                and len(p) > 25
            ]
            for j, p in enumerate(paragraphs):
                letter = chr(ord("a") + j)
                if letter > "h":
                    break
                specs.append(
                    Specification(
                        standard_code=num,
                        spec_code=letter,
                        standard_title=title,
                        spec_text=p,
                        program_level=program_level,
                    )
                )

    return specs


def parse_handbook_pdf_bytes(pdf_bytes: bytes, program_level: str = "bachelors") -> list[Specification]:
    """Convenience: extract text from a PDF blob via pdfplumber, then parse."""
    import io
    import pdfplumber

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    return parse_handbook_text(text, program_level=program_level)
