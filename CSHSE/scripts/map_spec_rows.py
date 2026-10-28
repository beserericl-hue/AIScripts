#!/usr/bin/env python3
"""Dry-run: show which template row each catalog specification maps to."""
import json, re, sys
import docx
from docx.table import Table
from docx.oxml.ns import qn

LEVEL_FILES = {"associate": "associate", "baccalaureate": "baccalaureate", "masters": "masters"}
CAT = json.load(open("server/src/data/standardsByLevel.json"))
STOP = set("the a an of and to for in on is are be by with as or that this its it shall must program programs provide".split())

# The baccalaureate form prints Field Experience as "Standard 22"; the catalog
# (and every saved mark) calls it 21.
FORM_STD = {("baccalaureate", "21"): "22"}

def words(t):
    return [w for w in re.findall(r"[a-z]+", t.lower()) if w not in STOP and len(w) > 2]

def tables(doc):
    for blk in doc.element.body.iterchildren():
        if blk.tag == qn("w:tbl"):
            yield Table(blk, doc)

def uniq_cells(row):
    seen, out = set(), []
    for c in row.cells:
        if id(c._tc) in seen: continue
        seen.add(id(c._tc)); out.append(c)
    return out

def sections(doc):
    """{std: [rows after its header row, up to the next header]}"""
    cur, out = None, {}
    for tbl in tables(doc):
        for row in tbl.rows:
            m = re.search(r"\{\{c_(\d+)\}\}", "".join(c.text for c in row.cells))
            if m:
                cur = m.group(1); out[cur] = []; continue
            if "{{c_" in "".join(c.text for c in row.cells):
                cur = None; continue
            # Section-heading rows ("2. Human Systems / Context: …") are not specs.
            if cur and "context:" not in rowtext(row).lower(): out[cur].append(row)
    return out

def score(a, b):
    A, B = set(words(a)[:25]), set(words(b)[:25])
    return len(A & B) / max(1, min(len(A), len(B)))

def rowtext(row):
    return " ".join(dict.fromkeys(c.text.strip() for c in row.cells if c.text.strip()))

def mapping(level):
    doc = docx.Document(f"server/src/assets/reader-report-templates/{LEVEL_FILES[level]}.docx")
    secs = sections(doc)
    res, last = {}, {}
    for std, spec in sorted(((s, sp) for s in CAT[level] for sp in CAT[level][s]["specs"]),
                            key=lambda x: (int(x[0]), x[1])):
        rows = secs.get(FORM_STD.get((level, std), std), [])
        crit = CAT[level][std]["specs"][spec]["criteria"]
        # Specs appear in letter order on the form: only rows after the previous
        # spec's row are candidates.
        floor = last.get(std, -1)
        # A spec's own row comes before its numbered sub-item rows, so take the
        # FIRST strong match; fall back to the best weak one.
        cands = [(score(crit, rowtext(r)), i) for i, r in enumerate(rows) if i > floor]
        strong = [c for c in cands if c[0] >= 0.6]
        best = strong[0] if strong else max(cands, default=(0, None))
        if best[1] is not None and best[0] >= 0.5: last[std] = best[1]
        res[(std, spec)] = (best, rows[best[1]] if best[1] is not None else None, crit)
    return doc, secs, res

if __name__ == "__main__":
    for level in sys.argv[1:] or LEVEL_FILES:
        doc, secs, res = mapping(level)
        print("=====", level)
        used = {}
        for (std, spec), ((sc, i), row, crit) in res.items():
            flag = "  " if sc >= 0.5 else "??"
            used.setdefault((std, i), []).append(spec)
            print(f"{flag} {std}.{spec} [{sc:.2f}] row{i}: {crit[:55]!r} -> {rowtext(row)[:55] if row is not None else None!r}")
        for k, v in used.items():
            if len(v) > 1: print("   DUP", k, v)
