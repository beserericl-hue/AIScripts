"""MCC narrative walker — the third import format.

An *independent narrative* self-study delivered as a single large PDF:

  - front matter (title page + Table of Contents),
  - a numbered General Introduction + Glossary,
  - the gradable body as ``Standard #N`` blocks (N = 1..20 for Associate),
  - a back-of-document **Appendix Index** (``Appendix Section A–G`` tables
    mapping ``<CODE>`` → ``Document Title``, some codes bundling sub-docs),
  - hundreds of pages of embedded/scanned **appendix documents**, each
    introduced by an ``Appendix <CODE> <Title>`` cover page.

This walker operates on the **PDF directly** (``pypdf``) so it can page-anchor
the narrative and, at extract time, slice each appendix into its own native
PDF (see :func:`slice_pdf_pages`). It is *additive*: nothing about the
Stevenson (self_study) or KSU (template) walkers changes.

Design + validated evidence: Engineering/mcc-narrative-import-parser.md.
Two passes live here:
  Pass 1 — :func:`build_skeleton` — intro sections, 20 standards (title +
           shall-statement + page span), appendix catalog.
  Pass 2 — :func:`walk_mcc_pdf` — adds per-standard narrative text (footer
           stripped, lists preserved), inline references (file vs link),
           and appendix content page-ranges ready for slicing.
Pass 3 (confidence-scored sub-spec recommendation) is done downstream by the
matcher against the canonical spec definitions — not here.
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from typing import Optional


# ----------------------------------------------------------------- patterns

# Page header/footer stamped on every narrative page: "MCC Self Study June 2026   13".
FOOTER_RE = re.compile(r"^\s*MCC Self Study June\s*\d{2,4}\s+\d{1,4}\s*$", re.M)

# Spec anchor. MCC uses "Standard #N"; the template format uses
# "Standard N, Specification a" (never matched here).
STANDARD_RE = re.compile(r"Standard\s*#\s*(\d{1,2})\b")

# Group heading directly above a Standard marker → the standard's section
# title. Roman part ("I."/"II."), letter section ("A."–"J."), or numbered
# curriculum topic ("10. Field Experience"). The space after the dot is
# OPTIONAL — pypdf sometimes drops it ("B.Philosophical Base of Program").
SECTION_TITLE_RE = re.compile(
    r"^\s*(?:[A-J]\.|[IVX]{1,4}\.|\d{1,2}\.)\s*[A-Z][A-Za-z].{1,}$"
)

# Appendix Index structure.
APPENDIX_SECTION_RE = re.compile(r"^\s*Appendix Section\s+([A-Z])\s*[–-]\s*(.+?)\s*$", re.M)
APPENDIX_INDEX_HDR_RE = re.compile(r"Appendix Index")
CATALOG_HDR_ROW_RE = re.compile(r"^\s*Appendix Number\s+Document Title\s*$", re.I)
# A coded catalog row: "A1 MCC General Education Guide" (pypdf emits a single
# space between the code and the title).
CATALOG_ROW_RE = re.compile(r"^\s*([A-Z]\d{1,2})\s+([A-Za-z].*?)\s*$")

# Appendix content cover header: "Appendix A3 MCC Mission Achievement Plan (MAP)"
# optionally with a sub-title suffix "– 25 Fall".
APPENDIX_COVER_RE = re.compile(
    r"^\s*Appendix\s+([A-Z]\d{1,2})\b\s*(.*?)\s*$"
)

# Inline reference grammar (case-insensitive, colon optional). A reference is a
# parenthetical; the two kinds are distinguished by "Document" vs "Link".
SUPPORTING_DOC_RE = re.compile(
    r"\(\s*Supporting\s+Documents?\b(.*?)\)", re.I | re.S
)
SUPPORTING_LINK_RE = re.compile(
    r"\(\s*Supporting\s+Links?\b[:\s]*(.*?)\)", re.I | re.S
)
# Inside a Supporting-Document parenthetical, every "appendix <CODE>" (the
# space is optional — the source has "appendixG1").
APPENDIX_CODE_RE = re.compile(r"appendix\s*([A-Z]\d{1,2})\b", re.I)
URL_RE = re.compile(r"https?://\S+")

# ------------------------------------------------------------ matrix denoise
# A curriculum matrix (Appendix A6) is a grid: spec rows × course columns, cells
# rated X / H / M / L (with I/K/T/S sub-column headers). A linear PDF text
# extractor flattens each row into "<spec label> <cell> <cell> …", so the cells
# leak into the narrative ("Intake interviewing HHH HHMXHHH M M M …"). This run
# is UNMISTAKABLE — 4+ consecutive UPPERCASE tokens drawn only from the coverage
# alphabet {X,H,M,L,I,K,T,S}. Real prose never produces that (it would need 4+
# consecutive all-caps words made only of those letters). Case-sensitive so
# lowercase words like "it is this list" can never match.
_MATRIX_CELL_RUN = re.compile(r"(?:\b[XHMLIKTS]{1,8}\b[ \t.,]*){4,}")


def denoise_matrix_cells(text: str) -> str:
    """Strip flattened curriculum-matrix cell runs out of narrative text. Text
    with no cell run is returned UNCHANGED (we never touch clean prose)."""
    if not text or not _MATRIX_CELL_RUN.search(text):
        return text
    cleaned = _MATRIX_CELL_RUN.sub(" ", text)
    return re.sub(r"[ \t]{2,}", " ", cleaned).strip()


def is_matrix_row(text: str) -> bool:
    """True when a chunk is essentially a matrix ROW — i.e. once the cell runs
    are stripped, little real prose remains (a 1–4 word topic label like
    "Intake interviewing"). Real narratives survive denoising with many words."""
    if not text or not _MATRIX_CELL_RUN.search(text):
        return False
    stripped = denoise_matrix_cells(text)
    words = re.findall(r"[A-Za-z]{3,}", stripped)
    return len(words) < 5

# Numbered intro sub-section header ("1. MCC Associate of Applied Science").
# Anchored + Title-Case to avoid matching prose like "2024. Average GPA…".
INTRO_HEADER_RE = re.compile(r"^\s*([1-9]|1[0-9])\.\s+([A-Z][A-Za-z].{2,60})$")


# ------------------------------------------------------------------- types


@dataclass
class MccReference:
    """One inline reference found in narrative text."""
    kind: str            # "file" | "link"
    code: Optional[str] = None   # appendix code for kind=="file" (e.g. "G1")
    url: Optional[str] = None    # href/label for kind=="link"
    label: str = ""      # human descriptor near the citation
    raw: str = ""        # the raw parenthetical


@dataclass
class MccAppendixEntry:
    """One appendix from the Appendix Index catalog (Pass 1) + its content
    page-range (Pass 2, once the cover header is located)."""
    code: str
    title: str
    section: str                       # "A".."G"
    sub_documents: list[str] = field(default_factory=list)
    page_start: Optional[int] = None   # 0-based pypdf page index of cover header
    page_end: Optional[int] = None     # exclusive; = next appendix's page_start
    kind: str = "other"                # matrix|cv|syllabus|outline|assignment|handbook|minutes|other

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "title": self.title,
            "section": self.section,
            "subDocuments": list(self.sub_documents),
            "pageStart": self.page_start,
            "pageEnd": self.page_end,
            "kind": self.kind,
        }


@dataclass
class MccStandard:
    """One Standard #N block."""
    n: int
    section_title: str = ""
    shall_statement: str = ""
    text: str = ""
    references: list[MccReference] = field(default_factory=list)
    links: list[str] = field(default_factory=list)  # clickable hrefs (PDF URI annots)
    # link TEXT -> href, so inline "Supporting Link: <text>" becomes a real <a>.
    link_map: dict = field(default_factory=dict)
    page_start: Optional[int] = None
    page_end: Optional[int] = None

    def to_dict(self) -> dict:
        return {
            "n": self.n,
            "sectionTitle": self.section_title,
            "shallStatement": self.shall_statement,
            "text": self.text,
            "references": [
                {"kind": r.kind, "code": r.code, "url": r.url, "label": r.label, "raw": r.raw}
                for r in self.references
            ],
            "links": list(self.links),
            "linkMap": dict(self.link_map),
            "pageStart": self.page_start,
            "pageEnd": self.page_end,
        }


@dataclass
class MccParseResult:
    introduction: str = ""
    intro_references: list[MccReference] = field(default_factory=list)
    standards: list[MccStandard] = field(default_factory=list)
    appendix_catalog: list[MccAppendixEntry] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    page_count: int = 0

    def to_dict(self) -> dict:
        return {
            "format": "mcc_narrative",
            "pageCount": self.page_count,
            "introduction": self.introduction,
            "introReferences": [
                {"kind": r.kind, "code": r.code, "url": r.url, "label": r.label, "raw": r.raw}
                for r in self.intro_references
            ],
            "standards": [s.to_dict() for s in self.standards],
            "appendixCatalog": [a.to_dict() for a in self.appendix_catalog],
            "warnings": list(self.warnings),
        }


# ------------------------------------------------------------- text helpers


def _kind_for_section(section: str) -> str:
    return {
        "B": "cv",
        "C": "outline",
        "D": "syllabus",
        "E": "assignment",
        "F": "practicum",
        "G": "handbook",
    }.get(section, "other")


def strip_footers(text: str) -> str:
    """Remove the running ``MCC Self Study June 2026  <n>`` header/footer lines."""
    return FOOTER_RE.sub("", text)


def _collapse_ws(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def parse_references(text: str) -> list[MccReference]:
    """Extract inline file/link references from a run of narrative text.

    ``(Supporting Document… appendix <CODE>…)`` → one file ref per code (a
    single parenthetical may cite several). ``(Supporting Link… )`` → a link.
    Whitespace/line-breaks inside a parenthetical are tolerated.
    """
    refs: list[MccReference] = []

    for m in SUPPORTING_DOC_RE.finditer(text):
        inner = m.group(1)
        raw = _collapse_ws(m.group(0))
        codes = list(APPENDIX_CODE_RE.finditer(inner))
        if not codes:
            # Doc reference with no appendix code — keep as a link-less note so
            # nothing is silently dropped.
            refs.append(MccReference(kind="file", code=None, label=_collapse_ws(inner), raw=raw))
            continue
        for i, cm in enumerate(codes):
            code = cm.group(1).upper()
            start = codes[i - 1].end() if i > 0 else 0
            label = _collapse_ws(inner[start:cm.start()])
            # Trim leading citation punctuation/connectors (": ", "; ", ", ", "and ").
            label = re.sub(r"^\s*(?:[:;,]|and\b)\s*", "", label, flags=re.I).strip()
            refs.append(MccReference(kind="file", code=code, label=label, raw=raw))

    for m in SUPPORTING_LINK_RE.finditer(text):
        val = _collapse_ws(m.group(1))
        url_m = URL_RE.search(val)
        refs.append(
            MccReference(
                kind="link",
                url=(url_m.group(0) if url_m else None),
                label=val,
                raw=_collapse_ws(m.group(0)),
            )
        )
    return refs


# ----------------------------------------------------------- catalog parsing


def parse_appendix_catalog(pages_text: list[str]) -> list[MccAppendixEntry]:
    """Parse the Appendix Index tables (Sections A–G) into catalog entries.

    Only the *real* Appendix Index (the section-body tables), not the TOC
    line-leader entries, produces rows: we require the ``Appendix Number /
    Document Title`` header or coded ``<CODE>  <Title>`` rows.
    """
    entries: list[MccAppendixEntry] = []
    current_section: Optional[str] = None
    last_entry: Optional[MccAppendixEntry] = None
    seen_codes: set[str] = set()

    for text in pages_text:
        # Only consider pages that actually carry catalog tables.
        if "Appendix Number" not in text and not APPENDIX_SECTION_RE.search(text):
            continue
        for raw_line in text.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                continue
            if FOOTER_RE.match(line):
                continue
            sm = APPENDIX_SECTION_RE.match(line)
            if sm:
                current_section = sm.group(1)
                last_entry = None
                continue
            if CATALOG_HDR_ROW_RE.match(line):
                continue
            if line.strip().startswith("Appendix Index"):
                continue
            row = CATALOG_ROW_RE.match(line)
            if row and current_section:
                code = row.group(1).upper()
                if code in seen_codes:
                    # A repeated header row on a continuation page — skip.
                    continue
                seen_codes.add(code)
                last_entry = MccAppendixEntry(
                    code=code,
                    title=_collapse_ws(row.group(2)),
                    section=current_section,
                    kind=_kind_for_section(current_section),
                )
                entries.append(last_entry)
            elif last_entry is not None and current_section:
                # An un-coded, indented line under a coded row → a sub-document.
                sub = _collapse_ws(line)
                if sub and sub.lower() not in ("appendix number document title",):
                    last_entry.sub_documents.append(sub)
    return entries


def locate_appendix_content(pages_text: list[str], catalog_codes: set[str]) -> dict[str, tuple[int, int]]:
    """Find the page range of each appendix's *content* by scanning for its
    ``Appendix <CODE> …`` cover header. ``page_end`` of one appendix = the
    ``page_start`` of the next (per the spec); the last runs to EOF.

    Returns ``{code: (page_start, page_end_exclusive)}`` for codes whose cover
    header was found in the content region (after the Appendix Index).
    """
    # The content region begins after the LAST page that still contains the
    # Appendix Index tables (those pages hold the catalog, not content).
    index_last = -1
    for i, text in enumerate(pages_text):
        if "Appendix Number" in text or "Appendix Index" in text:
            index_last = i

    covers: list[tuple[int, str]] = []  # (page_index, code)
    for i in range(index_last + 1, len(pages_text)):
        for line in pages_text[i].splitlines():
            cm = APPENDIX_COVER_RE.match(line)
            if cm and cm.group(1).upper() in catalog_codes:
                covers.append((i, cm.group(1).upper()))
                break  # first cover header on the page wins

    ranges: dict[str, tuple[int, int]] = {}
    for idx, (page, code) in enumerate(covers):
        end = covers[idx + 1][0] if idx + 1 < len(covers) else len(pages_text)
        # Keep the first occurrence of a code (its content start).
        ranges.setdefault(code, (page, end))
    return ranges


# --------------------------------------------------------------- detection


def detect_mcc_signals(full_text: str) -> dict:
    """Signals used to decide the ``mcc_narrative`` format (see format_detector)."""
    standard_hashes = len(set(STANDARD_RE.findall(full_text)))
    has_appendix_index = bool(re.search(r"Appendix Section\s+[A-Z]\s*[–-]", full_text))
    doc_refs = len(SUPPORTING_DOC_RE.findall(full_text))
    return {
        "standard_hash_markers": standard_hashes,
        "has_appendix_index": has_appendix_index,
        "supporting_document_refs": doc_refs,
    }


def is_mcc_narrative(signals: dict) -> bool:
    """Conservative: ≥10 distinct ``Standard #N`` markers AND (appendix index
    OR many supporting-document references)."""
    return signals.get("standard_hash_markers", 0) >= 10 and (
        signals.get("has_appendix_index") or signals.get("supporting_document_refs", 0) >= 10
    )


# ------------------------------------------------------------------ passes


def _page_texts_from_reader(reader) -> list[str]:
    out: list[str] = []
    for p in reader.pages:
        try:
            out.append(p.extract_text() or "")
        except Exception:  # noqa: BLE001
            out.append("")
    return out


def _find_section_title(lines_before: list[str]) -> str:
    """Nearest preceding group heading (letter/roman/number)."""
    for line in reversed(lines_before[-12:]):
        s = line.strip()
        if not s or FOOTER_RE.match(s):
            continue
        if SECTION_TITLE_RE.match(s):
            return _collapse_ws(s)
    return ""


def build_skeleton(pages_text: list[str], expected_standards: int = 20) -> MccParseResult:
    """Pass 1 — intro sections, standards (title + shall + span), catalog."""
    result = MccParseResult(page_count=len(pages_text))

    # Locate each Standard #N by page + char offset in the footer-stripped body.
    # Build a page-boundary map so we can record page_start per standard.
    per_page = [strip_footers(t) for t in pages_text]
    joined = "\n".join(per_page)
    # char offset -> page index
    bounds: list[int] = []
    acc = 0
    for t in per_page:
        bounds.append(acc)
        acc += len(t) + 1

    def page_of(offset: int) -> int:
        lo = 0
        for i, b in enumerate(bounds):
            if b <= offset:
                lo = i
            else:
                break
        return lo

    markers = [(int(m.group(1)), m.start(), m.end()) for m in STANDARD_RE.finditer(joined)]
    # Keep the FIRST occurrence of each standard number, in order 1..N.
    first_by_n: dict[int, tuple[int, int]] = {}
    for n, start, end in markers:
        if n not in first_by_n and 1 <= n <= 27:
            first_by_n[n] = (start, end)
    ordered = sorted(first_by_n.items(), key=lambda kv: kv[0])

    if len(ordered) != expected_standards:
        result.warnings.append(
            f"Expected {expected_standards} standards; found {len(ordered)} "
            f"({sorted(first_by_n.keys())})."
        )

    # Introduction = footer-stripped body before Standard #1, minus TOC.
    if ordered:
        first_start = ordered[0][1][0]
        intro_raw = joined[:first_start]
        result.introduction = _extract_introduction(intro_raw)
        result.intro_references = parse_references(intro_raw)

    starts = [se[1][0] for se in ordered]
    for idx, (n, (start, end)) in enumerate(ordered):
        nxt = starts[idx + 1] if idx + 1 < len(starts) else len(joined)
        block = joined[start:nxt]
        std = MccStandard(n=n)
        std.page_start = page_of(start)
        std.page_end = page_of(nxt - 1)
        # shall statement = text after the marker up to the first lowercase
        # sub-point ("a. ") or a blank line.
        after = joined[end:nxt]
        std.shall_statement = _extract_shall(after)
        # section title = nearest group heading before the marker.
        std.section_title = _find_section_title(joined[:start].splitlines())
        std.text = block.strip()
        std.references = parse_references(block)
        result.standards.append(std)

    result.appendix_catalog = parse_appendix_catalog(pages_text)
    # Report gaps in each section's code sequence (informational).
    result.warnings.extend(_catalog_gap_warnings(result.appendix_catalog))
    return result


def _extract_shall(after: str) -> str:
    stop = re.search(r"\n\s*[a-z]\.\s|\n\s*\n", after)
    seg = after[: stop.start()] if stop else after[:600]
    return _collapse_ws(seg)


def _extract_introduction(intro_raw: str) -> str:
    """Drop the title page + Table of Contents; keep intro sections + glossary
    with headings preserved (single documentIntroduction blob)."""
    lines = intro_raw.splitlines()
    # Find the first real intro section header ("1. MCC Associate…") that is NOT
    # inside the dotted-leader TOC (TOC lines contain long runs of dots).
    start_i = 0
    for i, line in enumerate(lines):
        if "...." in line or ". . ." in line:
            continue
        if INTRO_HEADER_RE.match(line.strip()):
            start_i = i
            break
    kept = [ln for ln in lines[start_i:] if "...." not in ln]
    return "\n".join(kept).strip()


def _catalog_gap_warnings(catalog: list[MccAppendixEntry]) -> list[str]:
    out: list[str] = []
    by_section: dict[str, list[int]] = {}
    for e in catalog:
        m = re.match(r"^([A-Z])(\d+)$", e.code)
        if m:
            by_section.setdefault(m.group(1), []).append(int(m.group(2)))
    for sec, nums in by_section.items():
        nums_sorted = sorted(nums)
        missing = [n for n in range(1, max(nums_sorted) + 1) if n not in nums]
        if missing:
            out.append(f"Appendix section {sec}: missing codes {[f'{sec}{n}' for n in missing]} (expected — reported, not an error).")
    return out


def walk_mcc_pdf(pdf_path: str, expected_standards: int = 20) -> MccParseResult:
    """Pass 1 + Pass 2 over a PDF path. Adds appendix content page-ranges."""
    from pypdf import PdfReader

    reader = PdfReader(pdf_path)
    pages_text = _page_texts_from_reader(reader)
    result = build_skeleton(pages_text, expected_standards=expected_standards)

    # Clickable links per standard (from PDF URI annotations on its page range).
    for std in result.standards:
        if std.page_start is not None:
            end = (std.page_end or std.page_start) + 1
            std.links = extract_uri_links(reader, std.page_start, end)
            std.link_map = extract_link_map(pdf_path, std.page_start, end)

    codes = {e.code for e in result.appendix_catalog}
    ranges = locate_appendix_content(pages_text, codes)
    for entry in result.appendix_catalog:
        rng = ranges.get(entry.code)
        if rng:
            entry.page_start, entry.page_end = rng

    # Gap-inference for pure-scan appendices with no text cover header: if a
    # single un-located catalog code sits between two located neighbours, its
    # pages are the gap between them (end of one appendix = start of the next).
    catalog = result.appendix_catalog
    i = 0
    while i < len(catalog):
        if catalog[i].page_start is not None:
            i += 1
            continue
        j = i
        while j < len(catalog) and catalog[j].page_start is None:
            j += 1
        prev_end = catalog[i - 1].page_end if i > 0 and catalog[i - 1].page_end is not None else None
        next_start = catalog[j].page_start if j < len(catalog) else len(pages_text)
        run = catalog[i:j]
        if len(run) == 1 and prev_end is not None and next_start is not None and next_start > prev_end:
            run[0].page_start, run[0].page_end = prev_end, next_start
        else:
            for e in run:
                result.warnings.append(
                    f"Appendix {e.code} '{e.title}': no text cover header and the page range "
                    "is ambiguous (adjacent scanned appendices) — needs manual page confirmation."
                )
        i = j

    # ---- Clamp the LAST standard so it doesn't swallow the appendix section ----
    # build_skeleton runs the final "Standard #N" block to EOF (no next marker),
    # which pulls in the appendix index + the Appendix A6 curriculum matrix pages.
    # Those matrix rows ("a. Intake interviewing HHH HHMX…") then get letter-split
    # into that standard's specs — the garbage cards. Re-bound the last standard to
    # end at the first appendix content page so the matrix never enters a narrative.
    app_starts = [e.page_start for e in result.appendix_catalog if e.page_start is not None]
    if app_starts and result.standards:
        body_end = min(app_starts)  # 0-based; body is [.. body_end)
        last = result.standards[-1]
        if last.page_start is not None and body_end > last.page_start and (
            last.page_end is None or last.page_end >= body_end
        ):
            per_page = [strip_footers(t) for t in pages_text]
            body_text = "\n".join(per_page[last.page_start:body_end])
            m = STANDARD_RE.search(per_page[last.page_start])
            last.text = (body_text[m.start():] if m else body_text).strip()
            last.page_end = body_end - 1
            last.references = parse_references(last.text)
            result.warnings.append(
                f"Clamped Standard #{last.n} to end before the appendix section "
                f"(page {body_end}) so the curriculum matrix isn't read as narrative."
            )
    return result


def extract_uri_links(reader, page_start: int, page_end: int) -> list[str]:
    """Collect the hrefs of every hyperlink (PDF /URI annotation) on the given
    page range, de-duplicated in document order. pypdf plain-text extraction
    drops hyperlinks, so we read the annotations directly to keep links
    clickable in the Review + Self-Study editors."""
    uris: list[str] = []
    seen: set[str] = set()
    for i in range(max(0, page_start or 0), min(page_end or 0, len(reader.pages))):
        try:
            annots = reader.pages[i].get("/Annots")
        except Exception:  # noqa: BLE001
            annots = None
        if not annots:
            continue
        for a in annots:
            try:
                obj = a.get_object()
                action = obj.get("/A")
                uri = action.get("/URI") if action else None
                if uri:
                    uri = str(uri).strip()
                    if uri and uri not in seen:
                        seen.add(uri)
                        uris.append(uri)
            except Exception:  # noqa: BLE001
                continue
    return uris


def extract_link_map(pdf_path: str, page_start: int, page_end: int) -> dict:
    """Map each hyperlink's visible TEXT -> its href over a page range, using
    PyMuPDF (which exposes both the link rect and the text under it). pypdf drops
    hyperlinks entirely, so this is how "(Supporting Link: MCC Accreditation
    Page)" becomes a real clickable link in the imported narrative. Returns {}
    if PyMuPDF is unavailable (graceful — the text is still imported, just not
    linked)."""
    try:
        import fitz  # PyMuPDF
    except Exception:  # noqa: BLE001
        return {}
    out: dict[str, str] = {}
    try:
        doc = fitz.open(pdf_path)
    except Exception:  # noqa: BLE001
        return {}
    for i in range(max(0, page_start or 0), min((page_end or 0), len(doc))):
        try:
            page = doc[i]
            for link in page.get_links():
                uri = link.get("uri")
                if not uri:
                    continue
                text = (page.get_textbox(link["from"]) or "").strip()
                text = re.sub(r"\s+", " ", text)
                if text and text not in out:
                    out[text] = uri
        except Exception:  # noqa: BLE001
            continue
    try:
        doc.close()
    except Exception:  # noqa: BLE001
        pass
    return out


def slice_pdf_pages(pdf_path: str, page_start: int, page_end: int) -> bytes:
    """Return a standalone PDF (bytes) for pages [page_start, page_end) of the
    source — the native display copy of one appendix. Pass 2 file extraction."""
    from pypdf import PdfReader, PdfWriter

    reader = PdfReader(pdf_path)
    writer = PdfWriter()
    for i in range(max(0, page_start), min(page_end, len(reader.pages))):
        writer.add_page(reader.pages[i])
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()
