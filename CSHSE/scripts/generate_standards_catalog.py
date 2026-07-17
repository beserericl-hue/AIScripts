#!/usr/bin/env python3
"""Generate level-specific CSHSE standards/criteria catalogs for the AI rubric.

Source of truth = the official CSHSE National Standards PDFs (July 2025), parsed
with the same handbook_parser the AI-service matcher uses. Baccalaureate output
is taken verbatim from the known-good, hand-verified
ai-service/app/standards/baccalaureate_2025.py (99 specs).

Emits server/src/data/standardsByLevel.json:
  { "<level>": { "<std>": { "title": str,
                            "specs": { "<letter>": { "title": str, "criteria": str } } } } }

The `criteria` string is the official specification text, which already embeds the
"Provide the following: 1... 2..." reader-report checklist items — so the rubric
reflects BOTH sources the AI evaluation must use: the Standard itself and the
reader-report specification detail derived from it.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'ai-service'))

import pdfplumber  # noqa: E402
from app.standards.handbook_parser import parse_handbook_text  # noqa: E402
from app.standards.baccalaureate_2025 import BACCALAUREATE_2025  # noqa: E402

PDFS = {
    'associate': 'CSHSE-National-Standards-Associate-Degree-Revised -July 28-2025.pdf',
    'masters':   'CSHSE-National-Standards-Masters-Degree-Revised July 27-2025.pdf',
}


def _pdf_text(path):
    with pdfplumber.open(os.path.join(ROOT, path)) as pdf:
        return "\n".join((p.extract_text() or "") for p in pdf.pages)


def _letter_ord(c):
    return ord(c) - ord('a')


def parse_from_pdf(level, path):
    """Parse a level PDF into {std: {title, specs:{letter:{title,criteria}}}}.

    Fixes two handbook_parser artifacts:
      * some "Standard N" headers lack the trailing colon (masters Std 13) — we
        normalize them so the standard is detected.
      * a spec whose body contains a NESTED "a./b./c." list makes the parser emit
        phantom restart specs; we merge any letter that is <= the previous letter
        (a restart) back into the preceding real spec's criteria instead of
        creating a new spec.
    """
    txt = _pdf_text(path)
    # Ensure every "Standard N" header has a colon so it's detected.
    txt = re.sub(r'(?m)^(\s*Standard\s+\d{1,2})(\s+)(?=[A-Z])', r'\1:\2', txt)
    specs = parse_handbook_text(txt, program_level=level)

    cat = {}
    for s in specs:
        std = cat.setdefault(s.standard_code, {'title': s.standard_title, 'specs': {}, '_order': []})
        letters = std['_order']
        letter = s.spec_code
        is_restart = letters and _letter_ord(letter) <= _letter_ord(letters[-1])
        if is_restart:
            # Nested sub-list — append to the previous real spec's criteria.
            prev = letters[-1]
            std['specs'][prev]['criteria'] += f" {letter}. {s.spec_text}"
        elif letter in std['specs']:
            std['specs'][letter]['criteria'] += f" {s.spec_text}"
        else:
            std['specs'][letter] = {'title': s.standard_title, 'criteria': s.spec_text}
            letters.append(letter)
    for std in cat.values():
        std.pop('_order', None)
    return cat


def baccalaureate_from_gold():
    """Baccalaureate: use the verified BACCALAUREATE_2025 dataset verbatim."""
    cat = {}
    for s in BACCALAUREATE_2025:
        std = cat.setdefault(s.standard_code, {'title': s.standard_title, 'specs': {}})
        std['specs'][s.spec_code] = {'title': s.standard_title, 'criteria': s.spec_text}
    return cat


def main():
    out = {
        'associate': parse_from_pdf('associate', PDFS['associate']),
        'baccalaureate': baccalaureate_from_gold(),
        'masters': parse_from_pdf('masters', PDFS['masters']),
    }
    for level, cat in out.items():
        nspec = sum(len(v['specs']) for v in cat.values())
        print(f"{level}: {len(cat)} standards, {nspec} specs -> {sorted(cat, key=int)}")
    dest = os.path.join(ROOT, 'server', 'src', 'data', 'standardsByLevel.json')
    with open(dest, 'w') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print('wrote', dest)


if __name__ == '__main__':
    main()
