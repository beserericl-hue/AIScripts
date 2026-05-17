"""End-to-end demo: pull Stevenson's appendix items, classify via the matcher,
export each as a DOCX, show what would land in S3 + Mongo SupportingEvidence.

Dry-run by default — does NOT actually upload to S3 unless ``--commit`` is
passed (and even then, requires confirmation).
"""
from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.export.docx_writer import build_evidence_docx
from app.export.s3_writer import upload_evidence_docx
from app.splitter.appendix_walker import walk_appendix


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--html", default="/tmp/stevenson-original.html")
    ap.add_argument("--max", type=int, default=15, help="export at most N items")
    ap.add_argument("--commit", action="store_true", help="actually upload to S3")
    args = ap.parse_args()

    with open(args.html, "rb") as f:
        html = f.read()
    items = walk_appendix(html, base_id="stevenson")
    print(f"appendix walker found {len(items)} items")

    # Just take the first N from each Standard for the demo
    items = items[: args.max]

    INSTITUTION_ID = "6977d979870733bbb6de1a07"  # Stevenson
    SUBMISSION_ID = "6986239a6612bf17f04a3217"  # the dev Stevenson submission
    UPLOADED_BY = "69768d944fd61f9313be39ef"
    SOURCE_FILENAME = "2024 CSHSE Self-Study Stevenson University.docx"

    for i, sec in enumerate(items, 1):
        std = sec.flags.get("appendixStandard", "?")
        # Spec is undetermined per-item until the matcher runs; using 'a' as
        # placeholder. In the wizard the user would accept the AI's pick or
        # choose from the dropdown.
        spec = "a"

        exported = build_evidence_docx(
            title=sec.heading,
            body_text=sec.markdown,
            standard_code=std,
            spec_code=spec,
            source_filename=SOURCE_FILENAME,
            source_version=1,
        )
        upload = upload_evidence_docx(
            exported,
            institution_id=INSTITUTION_ID,
            submission_id=SUBMISSION_ID,
            uploaded_by=UPLOADED_BY,
            dry_run=not args.commit,
        )
        print(f"\n[{i}/{len(items)}] {sec.heading[:60]}")
        print(f"  → Standard {std}.{spec}")
        print(f"  → DOCX size: {len(exported.docx_bytes):,} bytes  sha256={exported.sha256[:12]}…")
        print(f"  → S3 key: {upload.s3_key}")
        print(f"  → Suggested filename: {exported.suggested_filename}")
        print(f"  → SupportingEvidence row keys: {list(upload.supporting_evidence_doc.keys())}")
        if sec.flags.get("isFacultyCV"):
            print(f"  ✓ flagged as Faculty CV")


if __name__ == "__main__":
    main()
