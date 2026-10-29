"""Repair paragraphs whose first child is a run instead of <w:pPr>.

prepare_reader_report_templates.py used to insert each standard's {{c_N}} /
{{n_N}} run at index 0 of the cell paragraph, ahead of its <w:pPr> — invalid
OOXML (pPr must come first) that leaves Word to guess the paragraph's
formatting. Moves the pPr back to the front. Idempotent.

    python3 scripts/fix_template_run_order.py
"""
import re
import shutil
import tempfile
import zipfile
from pathlib import Path

TEMPLATES = Path(__file__).resolve().parent.parent / "server/src/assets/reader-report-templates"
# <w:p …> + one or more runs + <w:pPr>…</w:pPr>  →  <w:p …> + pPr + runs
BAD = re.compile(r"(<w:p(?:\s[^>]*)?>)((?:<w:r>(?:(?!</w:r>).)*</w:r>)+)(<w:pPr>(?:(?!</w:pPr>).)*</w:pPr>)", re.S)


def fix(path: Path) -> int:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml").decode("utf-8")
        items = [(i, z.read(i.filename)) for i in z.infolist()]
    fixed, n = BAD.subn(lambda m: m.group(1) + m.group(3) + m.group(2), xml)
    if n:
        tmp = Path(tempfile.mkstemp(suffix=".docx")[1])
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as out:
            for info, data in items:
                out.writestr(info, fixed.encode("utf-8") if info.filename == "word/document.xml" else data)
        shutil.move(tmp, path)
    return n


if __name__ == "__main__":
    for f in sorted(TEMPLATES.glob("*.docx")):
        print(f.name, fix(f))
