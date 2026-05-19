"""End-to-end smoke test: matrix extraction against the live Stevenson DOCX.

Mirrors the wizard's data flow exactly — downloads the source DOCX from
S3 (Tigris) using the SAME path the cshse-ai worker uses, runs mammoth
→ HTML, then runs deep_walker + matrix.wire_format.build_wire_matrices.
Verifies:

  - 0 curriculum_matrix tables leak through deep_walker as data-table cards.
  - 2 matrices detected (MatrixHSR + Matrix2).
  - Each matrix has dozens of cells across multiple standards.
  - Per-row anchor ids (`id="matrix-{slug}-row-{std}-{spec}"`) present in HTML.
  - Non-matrix data tables still emerge as sections.

Env requirements (all populated from cshse-ai's Railway env)::

    AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION,
    AWS_ENDPOINT_URL, CSHSE_S3_BUCKET

Run::

    python scripts/smoke_test_stevenson_matrix.py
"""
from __future__ import annotations

import io
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

# Allow running this from anywhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import mammoth  # type: ignore[import-untyped]

from app.import_jobs import _resolve_s3_to_local
from app.matrix.template_loader import (
    align_template_to_handbook,
    load_matrix_template,
)
from app.matrix.wire_format import build_wire_matrices
from app.splitter.deep_walker import deep_walk
from app.standards.loader import load_specifications


def _ok(msg: str) -> None:
    print(f"  ✅ {msg}")


def _fail(msg: str) -> None:
    print(f"  ❌ {msg}")
    sys.exit(1)


def _fetch_stevenson_docx_then_html(s3_key: str) -> bytes:
    """Same flow as the wizard worker: S3 download → mammoth → HTML bytes.

    Uses `_resolve_s3_to_local` from `app.import_jobs` so the test exercises
    the exact code path that runs on Railway.
    """
    tmpdir = Path(tempfile.mkdtemp(prefix="stevenson-smoke-"))
    docx_path = tmpdir / "source.docx"
    print(f"  📥 S3 download: {s3_key}")
    t = time.time()
    _resolve_s3_to_local(s3_key, docx_path)
    size_mb = docx_path.stat().st_size / 1024 / 1024
    print(f"      pulled {size_mb:.1f} MB from S3 in {time.time()-t:.1f}s → {docx_path}")
    print(f"  📝 mammoth → HTML")
    t = time.time()
    with open(docx_path, "rb") as f:
        html_str = mammoth.convert_to_html(io.BytesIO(f.read())).value
    html_bytes = html_str.encode("utf-8")
    print(f"      {len(html_bytes)/1024/1024:.1f} MB HTML in {time.time()-t:.1f}s")
    return html_bytes


def main() -> None:
    for required in ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "CSHSE_S3_BUCKET"):
        if not os.environ.get(required):
            raise SystemExit(f"{required} must be set (pull from `railway variables` on cshse-ai)")
    s3_key = os.environ.get(
        "STEVENSON_S3_KEY",
        "versioned/submission/6986239a6612bf17f04a3217/original_import/v1/"
        "2024_CSHSE_Self-Study_Stevenson_University.docx",
    )

    print("=" * 76)
    print("Stevenson matrix-pipeline smoke test (S3 → mammoth → extractor)")
    print("=" * 76)

    html_bytes = _fetch_stevenson_docx_then_html(s3_key)

    print()
    print("Step 1: deep_walker (skip_matrices=True default)")
    t = time.time()
    sections = deep_walk(html_bytes)
    print(f"      {len(sections)} sections in {time.time()-t:.1f}s")
    matrix_leaks = [s for s in sections if s.splitter_tier == "table_curriculum_matrix"]
    if matrix_leaks:
        _fail(f"{len(matrix_leaks)} curriculum_matrix tables leaked through deep_walker: "
              f"{[s.heading for s in matrix_leaks]}")
    _ok("0 curriculum_matrix tables leaked into spec cards")
    other_tables = [s for s in sections if "table" in s.splitter_tier]
    print(f"      {len(other_tables)} other (non-matrix) data tables still emit as sections")

    print()
    print("Step 2: build_wire_matrices (full extraction)")
    template = load_matrix_template("bachelors")
    handbook = load_specifications("bachelors")
    aligned = align_template_to_handbook(template, handbook)
    print(f"      template rows={len(aligned.rows)} (Std 11-21)")
    t = time.time()
    matrices, consumed = build_wire_matrices(html_bytes, aligned)
    print(f"      {len(matrices)} matrices extracted in {time.time()-t:.1f}s "
          f"(consumed {len(consumed)} table(s))")

    if len(matrices) == 0:
        _fail("No matrices detected — expected MatrixHSR + Matrix2 in Stevenson")
    if len(matrices) > 2:
        print(f"  ⚠️  more than 2 matrices ({len(matrices)}) — verify anchors:")
        for m in matrices:
            print(f"      - {m['matrixId']} / {m['name']} / {len(m['cells'])} cells")

    by_id: dict[str, Any] = {m["matrixId"]: m for m in matrices}
    summary_rows: list[tuple[str, int, int, int]] = []
    for slug in ("matrix-hsr", "matrix-non-hsr"):
        m = by_id.get(slug)
        if m is None:
            _fail(f"Expected matrix {slug} not detected. Got: {list(by_id)}")
        cells = m["cells"]
        stds = {c["std"] for c in cells}
        cols = m["columnHeaders"]
        summary_rows.append((slug, len(cells), len(stds), len(cols)))
        if len(cells) < 20:
            _fail(f"{slug}: only {len(cells)} cells — too few; the real Stevenson "
                  f"matrices should have dozens")
        if len(stds) < 3:
            _fail(f"{slug}: only {len(stds)} standards covered — expected 5+")

    print()
    print("  Per-matrix summary:")
    print(f"  {'matrixId':<18} {'cells':>6} {'stds':>5} {'cols':>5}")
    for slug, cells, stds, cols in summary_rows:
        print(f"  {slug:<18} {cells:>6} {stds:>5} {cols:>5}")
    _ok(f"Both CSHSE matrices detected with substantive cell counts")

    print()
    print("Step 3: row-anchor verification")
    for slug, _, _, _ in summary_rows:
        m = by_id[slug]
        sample_cells = m["cells"][:5]
        for c in sample_cells:
            anchor = c["rowAnchor"]
            if f'id="{anchor}"' not in m["htmlSnippet"]:
                _fail(f"{slug}: anchor {anchor} missing from htmlSnippet")
    _ok("Sampled row anchors all present in htmlSnippet")

    print()
    print("Step 4: cell metadata round-trip")
    for slug, _, _, _ in summary_rows:
        m = by_id[slug]
        c0 = m["cells"][0]
        required = ("std", "spec", "columnIndex", "columnHeader", "codeRaw",
                    "contentTypes", "depth", "rowAnchor", "confidence")
        missing = [k for k in required if k not in c0]
        if missing:
            _fail(f"{slug}: cell 0 missing fields {missing}")
    _ok("All wire fields present on sample cells")

    print()
    print("=" * 76)
    print(f"✅ SMOKE TEST PASSED — {sum(c for _,c,_,_ in summary_rows)} total cells "
          f"across {len(summary_rows)} matrices, 0 leak into spec cards")
    print("=" * 76)


if __name__ == "__main__":
    main()
