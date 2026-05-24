#!/usr/bin/env python3
"""Throwaway: split a CSHSE self-study DOCX into per-section files for
the multi-file wizard test.

NOT delivered in the system. Run locally to produce a small folder of
related .docx files we can drag-and-drop onto the wizard's multi-file
Upload step (CR-041) to exercise the batched-import flow.

Usage:
    python3 split_stevenson_for_multifile_test.py /path/to/stevenson.docx

Output: writes new files into the same directory as the input. Existing
output files are overwritten. Files produced:

    stevenson__01-standards-01-05.docx     (Standard 1 → Standard 5)
    stevenson__02-standards-06-09.docx     (Standard 6 → Standard 9)
    stevenson__03-standards-10-13.docx     (Standard 10 → Standard 13)
    stevenson__04-standards-14-21.docx     (Standard 14 → Standard 21)
    stevenson__05-appendix.docx            (everything after the last Standard)

Plus, when the original contains identifiable blocks, optional standalones:
    stevenson__cv-only__<faculty>.docx   (faculty CV blocks, if detected)
    stevenson__paper__<title>.docx       (research paper / report blocks)
    stevenson__syllabus__<code>.docx     (syllabus blocks)

The chunker is intentionally rough — it splits on \"Standard N\" headings
and uses cheap regex for the appendix items. False positives become
extra files the coordinator can drop or skip in the wizard.

Dependencies: python-docx (already in ai-service/requirements.txt; install
locally with `pip install python-docx` if running outside the venv).
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Iterable

try:
    from docx import Document  # type: ignore[import-untyped]
    from docx.document import Document as _DocumentT  # type: ignore[import-untyped]
except ImportError:
    sys.stderr.write(
        "python-docx is required. Install with: pip install python-docx\n"
    )
    sys.exit(1)


# Headings that delimit a Standard. Matches "Standard 1", "STANDARD 12.a", etc.
_STANDARD_RE = re.compile(r"^\s*STANDARD\s+(\d{1,2})\b", re.IGNORECASE)
# Appendix items inside Stevenson's tail. These are best-effort regex.
_APPENDIX_PAPER_RE = re.compile(
    r"(sample\s+\w+\s+(report|paper|project|essay|reflection|interview)"
    r"|^(.*\(\d+\s*points\))\s*$)",
    re.IGNORECASE,
)
_APPENDIX_SYLLABUS_RE = re.compile(
    r"(course\s+syllabus|syllabus|^[A-Z]{2,5}\s+\d{2,4}\b)",
    re.IGNORECASE,
)
# Faculty CV: name line + "EDUCATION" within ~10 paragraphs.
_FACULTY_NAME_RE = re.compile(
    r"^\s*((?:Dr\.\s+)?[A-Z][a-z]+\s+(?:[A-Z]\.\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*$"
)
_EDUCATION_RE = re.compile(r"^\s*EDUCATION\b", re.IGNORECASE)


def _slugify(s: str, max_len: int = 50) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s[:max_len] or "untitled"


def _paragraphs_with_styles(doc: _DocumentT) -> list[tuple[str, str]]:
    """Return (style_name, text) for every paragraph."""
    return [(p.style.name if p.style else "Normal", p.text) for p in doc.paragraphs]


def _split_by_standards(paragraphs: list[tuple[str, str]]) -> dict[int, list[int]]:
    """Return {standard_number: [paragraph_index, paragraph_index, ...]}.

    Standard 0 is the preamble (everything before Standard 1).
    Standard 99 is the appendix (everything after the last Standard).
    """
    current = 0
    saw_any_standard = False
    by_standard: dict[int, list[int]] = {0: []}
    for idx, (_style, text) in enumerate(paragraphs):
        m = _STANDARD_RE.match(text)
        if m and not saw_any_standard:
            # First Standard found — open it.
            current = int(m.group(1))
            saw_any_standard = True
            by_standard.setdefault(current, []).append(idx)
            continue
        if m and saw_any_standard:
            new_std = int(m.group(1))
            if new_std != current:
                current = new_std
                by_standard.setdefault(current, []).append(idx)
                continue
        by_standard.setdefault(current, []).append(idx)
    return by_standard


def _write_docx(
    src: _DocumentT,
    paragraph_indices: Iterable[int],
    out_path: Path,
    title: str,
) -> None:
    """Create a new .docx containing only the selected paragraphs.

    python-docx doesn't have a clean "copy paragraph" API; we recreate
    each paragraph by reading its text + applying the source style name.
    Images and complex formatting are lost — that's fine for the
    multi-file test fixture.
    """
    out = Document()
    out.add_paragraph(title, style="Heading 1")
    src_paragraphs = list(src.paragraphs)
    for i in paragraph_indices:
        if i < 0 or i >= len(src_paragraphs):
            continue
        sp = src_paragraphs[i]
        style_name = sp.style.name if sp.style else "Normal"
        try:
            out.add_paragraph(sp.text, style=style_name)
        except KeyError:
            # Style not found in the new doc's catalog; fall back to Normal.
            out.add_paragraph(sp.text)
    out.save(out_path)


def _detect_cv_blocks(paragraphs: list[tuple[str, str]]) -> list[tuple[str, list[int]]]:
    """Cheap CV detector: name-shaped line + EDUCATION within 10 paras.

    Returns [(faculty_name, [paragraph_indices])]. Each block extends
    until the next CV anchor or until 60 paragraphs pass.
    """
    out: list[tuple[str, list[int]]] = []
    i = 0
    while i < len(paragraphs):
        _, text = paragraphs[i]
        nm = _FACULTY_NAME_RE.match(text)
        if not nm:
            i += 1
            continue
        # Look ahead for EDUCATION.
        edu_hit = False
        for j in range(i + 1, min(i + 11, len(paragraphs))):
            if _EDUCATION_RE.match(paragraphs[j][1]):
                edu_hit = True
                break
        if not edu_hit:
            i += 1
            continue
        name = nm.group(1).strip()
        # Extend block until next CV anchor or 60 paragraphs.
        end = min(i + 60, len(paragraphs))
        for k in range(i + 1, end):
            if k > i + 5 and _FACULTY_NAME_RE.match(paragraphs[k][1]):
                # Next CV starts; close this block before it.
                end = k
                break
        out.append((name, list(range(i, end))))
        i = end
    return out


def _detect_paper_blocks(paragraphs: list[tuple[str, str]]) -> list[tuple[str, list[int]]]:
    out: list[tuple[str, list[int]]] = []
    i = 0
    while i < len(paragraphs):
        _, text = paragraphs[i]
        if _APPENDIX_PAPER_RE.search(text):
            title = text.strip()[:40] or f"paper-{i}"
            end = min(i + 80, len(paragraphs))
            # Stop early at the next paper / syllabus / standard.
            for k in range(i + 1, end):
                t = paragraphs[k][1]
                if (
                    _APPENDIX_PAPER_RE.search(t)
                    or _APPENDIX_SYLLABUS_RE.search(t)
                    or _STANDARD_RE.match(t)
                ):
                    end = k
                    break
            out.append((title, list(range(i, end))))
            i = end
        else:
            i += 1
    return out


def _detect_syllabus_blocks(paragraphs: list[tuple[str, str]]) -> list[tuple[str, list[int]]]:
    out: list[tuple[str, list[int]]] = []
    i = 0
    seen_titles: set[str] = set()
    while i < len(paragraphs):
        _, text = paragraphs[i]
        if _APPENDIX_SYLLABUS_RE.search(text):
            title = text.strip()[:40] or f"syllabus-{i}"
            if title in seen_titles:
                i += 1
                continue
            seen_titles.add(title)
            end = min(i + 60, len(paragraphs))
            for k in range(i + 1, end):
                t = paragraphs[k][1]
                if (
                    _APPENDIX_SYLLABUS_RE.search(t)
                    or _APPENDIX_PAPER_RE.search(t)
                    or _STANDARD_RE.match(t)
                ):
                    end = k
                    break
            out.append((title, list(range(i, end))))
            i = end
        else:
            i += 1
    return out


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        sys.stderr.write(
            "Usage: split_stevenson_for_multifile_test.py /path/to/stevenson.docx\n"
        )
        return 2
    src_path = Path(argv[1]).expanduser().resolve()
    if not src_path.exists():
        sys.stderr.write(f"Input not found: {src_path}\n")
        return 1
    if src_path.suffix.lower() != ".docx":
        sys.stderr.write(f"Expected a .docx file, got: {src_path.suffix}\n")
        return 1

    out_dir = src_path.parent
    base = src_path.stem
    print(f"Reading {src_path}")
    src = Document(str(src_path))
    paragraphs = _paragraphs_with_styles(src)
    print(f"  {len(paragraphs)} paragraphs")

    by_standard = _split_by_standards(paragraphs)
    print(f"  found Standards: {sorted(k for k in by_standard if 1 <= k <= 21)}")

    # Group standards into 4 chunks for the multi-file test.
    groups = [
        ("01-standards-01-05", range(1, 6)),
        ("02-standards-06-09", range(6, 10)),
        ("03-standards-10-13", range(10, 14)),
        ("04-standards-14-21", range(14, 22)),
    ]
    for label, stds in groups:
        indices: list[int] = []
        for std in stds:
            indices.extend(by_standard.get(std, []))
        if not indices:
            print(f"  skip {label}: no paragraphs")
            continue
        out_path = out_dir / f"{base}__{label}.docx"
        _write_docx(src, indices, out_path, f"{base} — {label.replace('-', ' ').title()}")
        print(f"  wrote {out_path.name} ({len(indices)} paragraphs)")

    # Preamble + appendix as separate files.
    if by_standard.get(0):
        out_path = out_dir / f"{base}__00-preamble.docx"
        _write_docx(src, by_standard[0], out_path, f"{base} — preamble")
        print(f"  wrote {out_path.name} ({len(by_standard[0])} paragraphs)")

    appendix_paragraphs: list[int] = []
    last_std = max((k for k in by_standard if 1 <= k <= 21), default=0)
    if last_std:
        for std, idxs in by_standard.items():
            if std > last_std:
                appendix_paragraphs.extend(idxs)
    # Anything after the last Standard's paragraph index counts as appendix.
    if last_std and by_standard.get(last_std):
        last_paragraph = max(by_standard[last_std])
        appendix_paragraphs.extend(
            i for i in range(last_paragraph + 1, len(paragraphs))
        )
    appendix_paragraphs = sorted(set(appendix_paragraphs))
    if appendix_paragraphs:
        out_path = out_dir / f"{base}__05-appendix.docx"
        _write_docx(src, appendix_paragraphs, out_path, f"{base} — appendix")
        print(f"  wrote {out_path.name} ({len(appendix_paragraphs)} paragraphs)")

    # Optional standalone CV / paper / syllabus files (for CR-033 + CR-040
    # standalone-upload testing).
    cvs = _detect_cv_blocks(paragraphs)
    for name, idxs in cvs[:5]:  # cap to keep output manageable
        slug = _slugify(name)
        out_path = out_dir / f"{base}__cv-only__{slug}.docx"
        _write_docx(src, idxs, out_path, f"CV — {name}")
        print(f"  wrote {out_path.name} (CV; {len(idxs)} paragraphs)")
    papers = _detect_paper_blocks(paragraphs)
    for title, idxs in papers[:5]:
        slug = _slugify(title)
        out_path = out_dir / f"{base}__paper__{slug}.docx"
        _write_docx(src, idxs, out_path, f"Paper — {title}")
        print(f"  wrote {out_path.name} (paper; {len(idxs)} paragraphs)")
    syllabi = _detect_syllabus_blocks(paragraphs)
    for title, idxs in syllabi[:5]:
        slug = _slugify(title)
        out_path = out_dir / f"{base}__syllabus__{slug}.docx"
        _write_docx(src, idxs, out_path, f"Syllabus — {title}")
        print(f"  wrote {out_path.name} (syllabus; {len(idxs)} paragraphs)")

    print("Done. Drag any combination of these files onto the wizard's")
    print("Upload step to exercise the multi-file batched-import flow.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
