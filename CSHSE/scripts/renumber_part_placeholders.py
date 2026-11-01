#!/usr/bin/env python3
"""Renumber the reader-report forms' part tokens to the catalog's numbered parts.

Run after add_part_placeholders.py. That script numbered each specification's
part ROWS on the form 1, 2, 3 … — but on several forms the first numbered item
shares the specification's own row (8.a "Demonstrate how the program 1. Includes
…", 12.b "Small groups: 1. Overview …", 20.h "… progress from: 1. Observation
to"), so the form's first part row is really part 2. And the baccalaureate form's
"Intake interviewing / Helping skills / Identification …" rows carried
specification tokens 16_d/16_e/16_f, with "Group facilitation / Use of
consultation" filed as 16.f's parts — all six are 16.c's numbered parts.

The authoritative list is server/src/data/specParts.json (July 2025 Standards +
forms). Each part row is matched to its catalog part BY TEXT and its
{{c_/n_<std>_<spec>_p<n>}} tokens are rewritten; spec-parts.json and
spec-rows.json are rewritten to match. Idempotent.
"""
import json
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, 'server', 'src', 'assets', 'reader-report-templates')
CATALOG = json.load(open(os.path.join(ROOT, 'server', 'src', 'data', 'specParts.json')))

# Rows that sat under the wrong specification on the form.
MOVED_SPEC = {'baccalaureate': {'16.d': '16.c', '16.e': '16.c', '16.f': '16.c'}}

STOP = set('a an and the of to in for or with on as by is are be that their its from e g etc'.split())


def words(t):
    return {w for w in re.findall(r'[a-z]+', t.lower()) if w not in STOP and len(w) > 2}


def best_part(spec_parts, text):
    """1-based number of the catalog part whose wording best matches the row."""
    tw = words(text)
    scored = [(len(tw & words(p)) / max(1, min(len(tw), len(words(p)))), i + 1) for i, p in enumerate(spec_parts)]
    score, n = max(scored)
    return n if score >= 0.5 else None


def row_text(tr):
    return re.sub(r'\{\{[^}]+\}\}', '', re.sub(r'<[^>]+>', '', tr)).strip()


def main():
    parts_manifest = json.load(open(os.path.join(TPL, 'spec-parts.json')))
    rows_manifest = json.load(open(os.path.join(TPL, 'spec-rows.json')))
    for level in ('associate', 'baccalaureate', 'masters'):
        path = os.path.join(TPL, f'{level}.docx')
        zin = zipfile.ZipFile(path)
        xml = zin.read('word/document.xml').decode('utf-8')
        catalog = CATALOG[level]
        moved = MOVED_SPEC.get(level, {})
        renames = {}       # old "<std>_<spec>[_pN]" -> new "<std>_<spec>_pN"
        new_parts = []
        for tr in re.findall(r'<w:tr[ >].*?</w:tr>', xml, re.S):
            m = re.search(r'\{\{c_(\d+)_([a-z]+)(?:_p(\d+))?\}\}', tr)
            if not m:
                continue
            std, spec, pn = m.group(1), m.group(2), m.group(3)
            src = f'{std}.{spec}'
            target = moved.get(src, src)
            if pn is None and src not in moved:
                continue  # an ordinary specification row
            spec_parts = catalog.get(target)
            text = row_text(tr)
            n = best_part(spec_parts, text) if spec_parts else None
            if n is None:
                sys.exit(f'{level}: no catalog part of {target} matches form row "{text[:80]}"')
            old = f'{std}_{spec}' + (f'_p{pn}' if pn else '')
            new = f"{target.replace('.', '_')}_p{n}"
            renames[old] = new
            new_parts.append({'key': new, 'n': n, 'text': text, 'spec': target})
        # Two-phase rename so p1->p2 never collides with an existing p2.
        for old in renames:
            for pre in ('c', 'n', 'cm'):
                xml = xml.replace('{{%s_%s}}' % (pre, old), '{{%s_@%s}}' % (pre, old))
        for old, new in renames.items():
            xml = xml.replace('{{c_@%s}}' % old, '{{c_%s}}' % new).replace('{{n_@%s}}' % old, '{{n_%s}}' % new)
            # A moved spec row's comment cell becomes a part row's (parts carry no comment token).
            xml = xml.replace('{{cm_@%s}}' % old, '')
        tmp = path + '.tmp'
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = xml.encode('utf-8') if item.filename == 'word/document.xml' else zin.read(item.filename)
                zout.writestr(item, data)
        zin.close()
        os.replace(tmp, path)

        parts_manifest[level]['parts'] = sorted(
            new_parts, key=lambda p: (int(p['spec'].split('.')[0]), p['spec'], p['n']))
        rows_manifest[level] = [k for k in rows_manifest[level] if k not in moved]
        missing = [f'{s}.{i + 1}' for s, lst in catalog.items() if not s.startswith('_')
                   for i in range(len(lst)) if not any(p['spec'] == s and p['n'] == i + 1 for p in new_parts)]
        print(f'{level}: {len(new_parts)} part rows; renamed {sum(1 for o, n in renames.items() if o != n)}; '
              f'parts without their own form row (share the spec row): {", ".join(missing) or "none"}')

    with open(os.path.join(TPL, 'spec-parts.json'), 'w') as f:
        json.dump(parts_manifest, f, indent=1, ensure_ascii=False)
    with open(os.path.join(TPL, 'spec-rows.json'), 'w') as f:
        json.dump(rows_manifest, f, indent=1)


if __name__ == '__main__':
    main()
