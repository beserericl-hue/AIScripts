#!/usr/bin/env python3
"""
Correct the stale footers on the prepared Reader Report templates.

CSHSE's "July 2025" reader-report files still carry old footers — associate
"July 2022", baccalaureate "Associate's Degree … July 2023" (copied from the
associate form), masters "July 2020". Readers sending reports to the Council
saw "the 22 reader report" (Lauri, Oct 2026). Rewrites only the footer XML.
  python3 scripts/fix_template_footers.py
"""
import re, shutil, sys, tempfile, zipfile

OUT = "server/src/assets/reader-report-templates"
FIXES = {
    "associate": [(r">July 2022<", ">July 2025<")],
    "baccalaureate": [(r">Associate’s Degree<", ">Baccalaureate Degree<"), (r">July 202<", ">July 202<"), (r">3<", ">5<")],
    "masters": [(r"> 2020<", "> 2025<")],
}

for level, subs in FIXES.items():
    path = f"{OUT}/{level}.docx"
    tmp = tempfile.mktemp(suffix=".docx")
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if re.match(r"word/footer\d*\.xml$", item.filename):
                xml = data.decode("utf8")
                for a, b in subs:
                    xml, n = re.subn(a, b, xml, count=1)
                    if not n:
                        sys.exit(f"{level} {item.filename}: pattern {a!r} not found")
                data = xml.encode("utf8")
            zout.writestr(item, data)
    shutil.move(tmp, path)
    print(level, "footer fixed")
