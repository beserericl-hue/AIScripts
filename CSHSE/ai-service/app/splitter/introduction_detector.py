"""CR-039 Phase 2a — Introduction-candidate detector.

Per the spec, an intro candidate is one of:

1. A paragraph that appears BEFORE the first numbered specification
   (e.g. before "1.a") within a Standard,
2. A paragraph at the very top of the document before "Standard 1," or
3. A section tagged in the source with a heading like "Introduction",
   "Overview", "Mission", "About the Program/School", "Terms",
   "Glossary".

Phase 2a (this commit) implements case 3 — heading-based detection,
the cheapest and most reliable signal. Cases 1 and 2 require
byte-offset context across the whole document and ship in Phase 2b
alongside the matcher prompt extension.

Output is a ``routing_hint`` string the matcher can default to (the
matcher overrides when its own spec confidence is high enough — see
the spec's section on "Bias: when in doubt, prefer the introduction
over a spec").
"""
from __future__ import annotations

import re
from typing import Iterable

from app.splitter.sections import Section


# Headings that flag an Introduction. Match anywhere in the heading
# (e.g. "Standard 2 — Introduction" is valid) but reject headings that
# carry a spec id like "1.a" (those are real specs, not intros).
_INTRO_KEYWORDS = (
    "introduction",
    "overview",
    "mission",
    "preface",
    "foreword",
    "glossary",
)
# Word-boundary match against the keywords.
_INTRO_KEYWORDS_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in _INTRO_KEYWORDS) + r")\b",
    re.IGNORECASE,
)
# "About the X" forms — explicit because "about" is too generic to allow
# everywhere.
_ABOUT_RE = re.compile(
    r"\babout\s+(the\s+)?(program|school|institution)\b", re.IGNORECASE
)
# "Terms" only when it sits as a standalone heading (otherwise it
# false-positives on "the program's terms of accreditation" etc).
_TERMS_STANDALONE_RE = re.compile(r"^terms\s*$", re.IGNORECASE)

# Spec-id signature that disqualifies a heading from being an intro
# (e.g. "1.a", "11.b") — those are real specs.
_SPEC_ID_RE = re.compile(r"\b\d+\.[a-z]\b")

# Match "Standard N" inside a heading to derive the standard-level
# routing-hint suffix. Picks the FIRST numbered standard reference.
_STD_IN_HEADING_RE = re.compile(r"\bstandard\s+(\d+)\b", re.IGNORECASE)


def is_introduction_heading(heading: str) -> bool:
    """True if ``heading`` looks like an introduction-style section title.

    Recognises intro keywords (introduction / overview / mission /
    glossary / preface / foreword) anywhere in the heading, plus
    "About the program/school/institution" and a standalone "Terms"
    line. Rejects any heading carrying a spec id (e.g. "1.a"
    Institutional Requirements is a real spec, not an intro).
    """
    if not heading:
        return False
    s = heading.strip()
    if _SPEC_ID_RE.search(s):
        return False
    if _INTRO_KEYWORDS_RE.search(s):
        return True
    if _ABOUT_RE.search(s):
        return True
    if _TERMS_STANDALONE_RE.match(s):
        return True
    return False


def routing_hint_for_section(section: Section) -> str | None:
    """Return the routing-hint string the matcher should default to, or
    None if the section isn't an intro candidate.

    Format matches the spec:
        ``introduction:document`` — document-level Introduction
        ``introduction:standard-N`` — Standard-N Introduction
    """
    if not is_introduction_heading(section.heading or ""):
        # Fall through to detect "Introduction" headings that lived in the
        # body's first line (deep_walker often uses first 120 chars of
        # prose as the heading; for cleanly-headed templates this works).
        first_line = (section.markdown or "").splitlines()[:1]
        if not first_line or not is_introduction_heading(first_line[0]):
            return None

    # Heading matched. Look for "Standard N" anywhere in the heading or
    # the section's first 200 chars of body — many CSHSE templates write
    # the standard number AT the Introduction (e.g., "Standard 2 -
    # Introduction"). Phase 2b will use byte-offset position instead of
    # text-match for cases where the Introduction has no numeric
    # reference of its own.
    haystack = " ".join(
        [
            section.heading or "",
            (section.markdown or "")[:200],
        ]
    )
    m = _STD_IN_HEADING_RE.search(haystack)
    if m:
        return f"introduction:standard-{m.group(1)}"
    return "introduction:document"


def detect_introductions(sections: Iterable[Section]) -> dict[str, str]:
    """Scan an ordered section stream and return a mapping of
    ``section_id -> routing_hint`` for every section that's an intro
    candidate. Sections without a hint are absent from the mapping.

    Deterministic, pure function — safe to call from the matcher's
    section-level loop.
    """
    out: dict[str, str] = {}
    for s in sections:
        hint = routing_hint_for_section(s)
        if hint:
            out[s.id] = hint
    return out
