#!/usr/bin/env python3
"""Remove the curriculum matrix (and the retired "Conditional accreditation"
option) from the official Reader Report Word forms.

CSHSE board decision (Nov 2026, via Lauri): the curriculum matrix is no longer
part of the self-study — it is a prep tool used outside it — so every reference
to it is REMOVED from the reader forms, including the reader checklist boxes.
For each of server/src/assets/reader-report-templates/{associate,baccalaureate,
masters}.docx this script:

  1. rewrites Specification 2.e's text (the row that carries the {{c_2_e}} /
     {{n_2_e}} / {{cm_2_e}} tokens) to the new wording — DRAFT pending CSHSE
     confirmation, kept in SPEC_2E_TEXT below — and drops the "Note: The Matrix
     must include …" and "Note to Readers: The program will upload this
     document …" paragraphs of that row;
  2. masters only: deletes the standalone "Matrix … is present and congruent …"
     reader-checklist row at the top of the Curriculum Standards 11-18 table and
     blanks the "Matrix" label of that table's header row (the row's Compliant /
     Non-Compliant column headings stay);
  3. deletes the "Conditional accreditation because the program had a few
     noncompliance issues that require correction." checkbox paragraph, and its
     indented "Provide a list of proposed requirements …" sub-item, from the
     "Indicate your recommendation to the Council" section (the option was
     removed from the app; readerReportGenerator's VOTE_BOX_LABEL dropped it).

Same convention as renumber_part_placeholders.py: only word/document.xml is
rewritten, every other part of the package is copied byte-for-byte, and the
{{token}} placeholders the generator fills are untouched. Idempotent — a second
run changes nothing. Run from the repo's CSHSE/ directory or anywhere:

    python3 scripts/remove_matrix_from_reader_report_templates.py [--check]

--check only reports what would change (exit 1 if anything would).
"""
import os
import re
import sys
import zipfile

from lxml import etree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, 'server', 'src', 'assets', 'reader-report-templates')
LEVELS = ['associate', 'baccalaureate', 'masters']

W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
W = '{%s}' % W_NS
XML_SPACE = '{http://www.w3.org/XML/1998/namespace}space'

_CONCENTRATIONS = (
    ' If a program has specific concentrations, identify the specific core courses in the '
    'concentration that comply with a Standard and its Specifications.'
)
# DRAFT wording pending CSHSE confirmation — the one place it lives for the forms
# (server/src/data/standardsByLevel.json + scripts/generate_standards_catalog.py
# carry the same text for the AI rubric).
SPEC_2E_TEXT = {
    'baccalaureate': (
        'Identify the required courses for all students that contribute to compliance with the '
        'Curriculum Standards (11-20) and their Specifications. The information provided must clearly '
        'reflect congruence with the information provided in the Self-Study narrative and the syllabi.'
    ),
    'associate': (
        'Identify the required courses for all students that contribute to compliance with the '
        'Curriculum Standards (11-20) and their Specifications. The information provided must clearly '
        'reflect congruence with the information provided in the Self-Study narrative and the syllabi.'
        + _CONCENTRATIONS
    ),
    'masters': (
        'Identify the required courses for all students that contribute to compliance with the '
        'Curriculum Standards (11-18) and their Specifications. The information provided must clearly '
        'align with the information presented in the self-study narrative and the syllabi.'
        + _CONCENTRATIONS
    ),
}

MATRIX_RE = re.compile(r'matri(x|ces)', re.I)
NOTE_TO_READERS_RE = re.compile(r'^\s*Note to Readers:\s*The program will upload this document', re.I)
CONDITIONAL_RE = re.compile(r'Conditional accreditation because the program had a few noncompliance', re.I)
PROPOSED_REQ_RE = re.compile(r'^\s*Provide a list of proposed requirements', re.I)
# Leading list label typed into the masters form's spec cell ("e.").
LABEL_RE = re.compile(r'^\s*[a-z]\.?\s*$', re.I)


def text_of(el):
    return ''.join(t.text or '' for t in el.iter(W + 't'))


def remove(el):
    el.getparent().remove(el)


def rewrite_paragraph_text(p, new_text):
    """Replace a paragraph's visible text with new_text, keeping the paragraph
    properties, a leading list label run ("e.") and the first text run's
    formatting. Every other run's text is dropped."""
    runs = [r for r in p.iter(W + 'r') if r.find(W + 't') is not None]
    # The list label may be split over runs ("e" + "."): keep the leading runs
    # while their combined text is still just a label.
    i, label = 0, ''
    while i < len(runs) and LABEL_RE.match(label + text_of(runs[i])):
        label += text_of(runs[i])
        i += 1
    body_runs = runs[i:]
    if not body_runs:
        raise RuntimeError('2.e paragraph has no text run to rewrite')
    first = body_runs[0]
    ts = first.findall(W + 't')
    ts[0].text = new_text
    ts[0].set(XML_SPACE, 'preserve')
    for extra in ts[1:]:
        first.remove(extra)
    for r in body_runs[1:]:
        remove(r)
    for pe in list(p.iter(W + 'proofErr')):
        remove(pe)


def cell_of_token(root, token):
    for t in root.iter(W + 't'):
        if t.text and token in t.text:
            tc = next(t.iterancestors(W + 'tc'), None)
            if tc is not None:
                return tc
    return None


def fix_spec_2e(root, level, log):
    tc = cell_of_token(root, '{{c_2_e}}')
    if tc is None:
        raise RuntimeError('no {{c_2_e}} token in %s' % level)
    tr = next(tc.iterancestors(W + 'tr'))
    spec_cell = tr.findall(W + 'tc')[0]
    paras = spec_cell.findall(W + 'p')
    target = next((p for p in paras if MATRIX_RE.search(text_of(p)) and 'Provide a matrix' in text_of(p)), None)
    new_text = SPEC_2E_TEXT[level]
    if target is not None:
        rewrite_paragraph_text(target, new_text)
        log.append('2.e: spec text rewritten')
    elif not any(new_text in text_of(p) for p in paras):
        raise RuntimeError('2.e spec cell in %s has neither the matrix text nor the new wording' % level)
    for p in spec_cell.findall(W + 'p'):
        t = text_of(p)
        if new_text in t:
            continue
        if MATRIX_RE.search(t) or NOTE_TO_READERS_RE.search(t):
            remove(p)
            log.append('2.e: removed paragraph %r' % t.strip()[:70])


def fix_masters_matrix_rows(root, log):
    for tr in list(root.iter(W + 'tr')):
        cells = tr.findall(W + 'tc')
        if not cells:
            continue
        first = text_of(cells[0]).strip()
        if re.match(r'^Matrix mapping the curriculum Standards', first, re.I):
            remove(tr)
            log.append('masters: removed checklist row %r' % first[:60])
        elif first == 'Matrix':
            for t in cells[0].iter(W + 't'):
                if t.text and t.text.strip() == 'Matrix':
                    t.text = ''
            log.append('masters: blanked the "Matrix" header label')


def fix_conditional(root, log):
    body = root.find(W + 'body')
    for p in list(root.iter(W + 'p')):
        if p.getparent() is None:
            continue
        if CONDITIONAL_RE.search(text_of(p)):
            nxt = p.getnext()
            remove(p)
            log.append('recommendation: removed "Conditional accreditation" option')
            if nxt is not None and nxt.tag == W + 'p' and PROPOSED_REQ_RE.search(text_of(nxt)):
                remove(nxt)
                log.append('recommendation: removed its "Provide a list of proposed requirements" sub-item')
    return body


def process(level, check_only):
    path = os.path.join(TPL, '%s.docx' % level)
    zin = zipfile.ZipFile(path)
    xml = zin.read('word/document.xml')
    root = etree.fromstring(xml)
    log = []
    fix_spec_2e(root, level, log)
    if level == 'masters':
        fix_masters_matrix_rows(root, log)
    fix_conditional(root, log)
    full = text_of(root)
    leftovers = [m.group(0) for m in re.finditer(r'.{0,40}(atri|Conditional accreditation).{0,40}', full, re.I)]
    for item in zin.infolist():
        if item.filename != 'word/document.xml' and re.match(r'word/.*\.xml$', item.filename):
            part_text = text_of(etree.fromstring(zin.read(item.filename)))
            leftovers += ['%s: %s' % (item.filename, m.group(0)) for m in re.finditer(r'.{0,40}atri.{0,40}', part_text, re.I)]
    if leftovers:
        raise RuntimeError('%s still mentions: %s' % (level, leftovers))
    if not log:
        print('%s: already clean' % level)
        zin.close()
        return False
    for line in log:
        print('%s: %s' % (level, line))
    if check_only:
        zin.close()
        return True
    out = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
    tmp = path + '.tmp'
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = out if item.filename == 'word/document.xml' else zin.read(item.filename)
            zout.writestr(item, data)
    zin.close()
    os.replace(tmp, path)
    return True


def main():
    check_only = '--check' in sys.argv
    changed = [process(level, check_only) for level in LEVELS]
    if check_only and any(changed):
        sys.exit(1)


if __name__ == '__main__':
    main()
