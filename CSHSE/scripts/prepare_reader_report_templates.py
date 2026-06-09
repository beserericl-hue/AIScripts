#!/usr/bin/env python3
"""
Prepare CSHSE Reader Report templates for runtime fill (docx.patchDocument).

The official July-2025 reader report templates (one per degree level) are
compliance checklists: per-standard rows with Compliant / Non-Compliant columns
and a Reader's Comments column. This script inserts {{placeholder}} tokens into
the numbered-standard rows + the Institution/Program header fields, producing
templated copies the Node server fills at runtime (docx.patchDocument).

Run locally with the ai-service venv (has python-docx):
  CSHSE/ai-service/.venv/bin/python scripts/prepare_reader_report_templates.py

Fillable rows are detected in document order (a row with a "Reader's Comments"
cell). The ORDERED `keys` list below assigns each detected row to a standard
number, or None to leave it blank (intro / conditional rows the reader fills).
"""
import re, sys
import docx
from docx.table import Table
from docx.oxml.ns import qn

SRC = "docs"
OUT = "server/src/assets/reader-report-templates"

# Ordered standard-key per detected fillable row, per degree level.
# None = leave blank for the reader (intro / not-applicable rows).
LEVELS = {
    "baccalaureate": {
        "file": "BACCALAUREATE Self_Study_Reader Report template_ Baccalaureate degree  July 2025.docx",
        "keys": [None,None,None,None,None,None,"1","2","3","4","5","6","7","8","9","10",
                 "11","12","13","14","15","16","17","18","19","20","22"],
    },
    "associate": {
        "file": "ASSOCIATE Self_Study_Reader Report template_ Associate degree  July 2025.docx",
        "keys": [None,"1","2","3","4","5","6","7","8","9","10",
                 "11","12","13","14","15","16","17","18","19","20"],
    },
}

def is_fillable(row):
    for c in row.cells:
        t = c.text.lower()
        if "reader" in t and "comment" in t:
            return True
    return False

def find_cells(row):
    """Return (compliant_cell, noncompliant_cell, comments_cell) or (None,None,None)."""
    comp = noncomp = comm = None
    seen = set()
    for c in row.cells:
        if id(c._tc) in seen:  # skip merged duplicates
            continue
        seen.add(id(c._tc))
        t = c.text.strip()
        tl = t.lower()
        norm = re.sub(r"[^a-z]", "", tl)
        if "reader" in tl and "comment" in tl:
            comm = c
        elif norm == "compliant":
            comp = c
        elif norm.startswith("noncompliant"):
            noncomp = c
    return comp, noncomp, comm

def prepend_run(cell, text):
    p = cell.paragraphs[0]
    r = p.add_run(text)
    # move the new run to the front of the paragraph
    p._p.insert(0, r._r)

def fill_header(doc, label, token):
    """Replace the underscores after a 'Label:' paragraph with a token."""
    for p in doc.paragraphs:
        t = p.text
        if t.strip().startswith(label):
            # keep label, drop underscores, add token
            for r in list(p.runs):
                r._r.getparent().remove(r._r)
            p.add_run(f"{label} {token}")
            return True
    return False

def tables(doc):
    for blk in doc.element.body.iterchildren():
        if blk.tag == qn("w:tbl"):
            yield Table(blk, doc)

def process(level, cfg):
    path = f"{SRC}/{cfg['file']}"
    doc = docx.Document(path)
    # fillable rows in document order
    rows = []
    for tbl in tables(doc):
        for row in tbl.rows:
            if is_fillable(row):
                rows.append(row)
    keys = cfg["keys"]
    if len(rows) != len(keys):
        print(f"  !! {level}: detected {len(rows)} fillable rows but keys has {len(keys)} — ABORT")
        return False
    filled = 0
    for row, key in zip(rows, keys):
        if key is None:
            continue
        comp, noncomp, comm = find_cells(row)
        if comp is not None:  prepend_run(comp, f"{{{{c_{key}}}}} ")
        if noncomp is not None: prepend_run(noncomp, f"{{{{n_{key}}}}} ")
        if comm is not None:  comm.add_paragraph(f"{{{{cm_{key}}}}}")
        filled += 1
    ih = fill_header(doc, "Institution’s Name:", "{{inst_name}}")
    ph = fill_header(doc, "Program’s Name:", "{{prog_name}}")
    out = f"{OUT}/{level}.docx"
    doc.save(out)
    print(f"  {level}: {filled} standard rows templated, header(inst={ih},prog={ph}) -> {out}")
    return True

ok = True
for level, cfg in LEVELS.items():
    print(f"== {level} ==")
    ok = process(level, cfg) and ok
sys.exit(0 if ok else 1)
