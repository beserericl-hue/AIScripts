"""Single entry-point CLI for the AI Import Wizard preview generator.

Auto-detects whether the input DOCX is the **CSHSE Self-Study Template
format** (spec-as-outline; used by institutions just starting
accreditation) or a **free-form self-study** (Stevenson-style; used by
institutions submitting a finished or near-finished document) and
dispatches to the right pipeline.

Usage:

  scripts/build_preview.py --docx /path/to/Sample.docx

Optional flags:

  --format auto|template|self_study   Force a format instead of sniffing.
  --program-level bachelors|associate|masters
  --concurrency N                     Threads for matcher + reviewer.
  --output-suffix slug                Override the auto-derived institution
                                      slug used in the output filename.
  --date YYYY-MM-DD                   Date stamp on the preview page.

Behaviour by format:

  template     → runs the full template-format pipeline end-to-end
                 (DOCX → template_walker → matcher → buckets → coverage
                 review → render). No gap-fill (no appendix yet).

  self_study   → DOCX-direct self-study pipeline. mammoth converts the
                 DOCX → HTML, the existing deep_walk_with_fallback walks
                 it, the matcher runs LIVE on every section (no cached
                 classify_rows JSON), the appendix walker runs too, and
                 the same bucket / coverage / gap-fill / render helpers
                 as a Mongo-backed Stevenson run produce the preview.
                 Gap-fill is skipped automatically when no appendix is
                 detected (e.g. someone runs --format self_study on a
                 template-shaped DOCX).

The dispatcher is *additive*: it doesn't change either pipeline's
parsing rules, just routes inputs to the correct one.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.splitter.format_detector import FormatDetection, detect_format


_DEFAULT_DATE = "2026-05-18"


def _slugify_basename(path: str, max_len: int = 60) -> str:
    """Derive an output-suffix slug from the DOCX basename.

    "Sample to Council from KSU.docx" → "sample-to-council-from-ksu".
    Used as the default ``--output-suffix`` so each institution's
    preview lands in its own file.
    """
    name = Path(path).stem
    s = re.sub(r"[^a-zA-Z0-9-]+", "-", name).strip("-").lower()
    return (s or "preview")[:max_len]


def _print_detection(det: FormatDetection) -> None:
    print(f"🧭 format detection: {det.format} (conf {det.confidence:.2f})")
    print(f"   reasoning: {det.reasoning}")
    print(f"   signals:   {det.signals}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description=(
            "Sniff a DOCX and dispatch it to the right wizard preview "
            "pipeline (template vs free-form self-study)."
        )
    )
    ap.add_argument("--docx", required=True, help="Path to the input DOCX.")
    ap.add_argument(
        "--format",
        default="auto",
        choices=("auto", "template", "self_study"),
        help="Force a format. Default: sniff.",
    )
    ap.add_argument(
        "--program-level",
        default="bachelors",
        choices=("associate", "bachelors", "masters"),
    )
    ap.add_argument("--date", default=_DEFAULT_DATE)
    ap.add_argument("--concurrency", type=int, default=6)
    ap.add_argument(
        "--output-suffix",
        default=None,
        help=(
            "Filename suffix used in the output: ai-import-wizard-preview-"
            "<suffix>-<date>.md. Default: slug derived from the DOCX basename."
        ),
    )
    ap.add_argument(
        "--skip-gap-fill",
        action="store_true",
        help=(
            "(self_study only) Skip the appendix gap-fill pass. Auto-skipped "
            "anyway when no appendix is detected."
        ),
    )
    ap.add_argument(
        "--gap-fill-confidence",
        type=float,
        default=0.50,
        help="(self_study only) Verifier confidence threshold for gap-fill.",
    )
    ap.add_argument(
        "--min-section-words",
        type=int,
        default=30,
        help="(self_study only) Drop deep-walker sections below this word count.",
    )
    args = ap.parse_args()

    docx_path = args.docx
    if not Path(docx_path).is_file():
        print(f"❌ DOCX not found: {docx_path}", file=sys.stderr)
        return 1

    chosen_format = args.format
    if chosen_format == "auto":
        det = detect_format(docx_path)
        _print_detection(det)
        chosen_format = det.format
    else:
        print(f"🧭 format (forced by --format): {chosen_format}")

    suffix = args.output_suffix or _slugify_basename(docx_path)

    if chosen_format == "template":
        # In-process call — re-uses the env, no subprocess overhead.
        from scripts.build_template_preview import run_template_preview
        try:
            out_path = run_template_preview(
                docx=docx_path,
                program_level=args.program_level,
                date=args.date,
                concurrency=args.concurrency,
                output_suffix=suffix,
                base_id=suffix,
            )
        except KeyError as e:
            print(f"❌ Missing required environment variable: {e}", file=sys.stderr)
            print(
                "   Set OPENAI_API_KEY, ANTHROPIC_API_KEY, QDRANT_URL, "
                "QDRANT_API_KEY (load from the /tmp/run_wizard_preview.sh "
                "wrapper or your own env source).",
                file=sys.stderr,
            )
            return 1
        print()
        print(f"✅ template preview complete: {out_path}")
        return 0

    if chosen_format == "self_study":
        from scripts.build_wizard_preview import run_self_study_preview_from_docx
        try:
            out_path = run_self_study_preview_from_docx(
                docx=docx_path,
                program_level=args.program_level,
                date=args.date,
                concurrency=args.concurrency,
                output_suffix=suffix,
                base_id=suffix,
                skip_gap_fill=args.skip_gap_fill,
                gap_fill_confidence=args.gap_fill_confidence,
                min_section_words=args.min_section_words,
            )
        except KeyError as e:
            print(f"❌ Missing required environment variable: {e}", file=sys.stderr)
            print(
                "   Set OPENAI_API_KEY, ANTHROPIC_API_KEY, QDRANT_URL, "
                "QDRANT_API_KEY (load from the /tmp/run_wizard_preview.sh "
                "wrapper or your own env source).",
                file=sys.stderr,
            )
            return 1
        print()
        print(f"✅ self-study preview complete: {out_path}")
        return 0

    # Unreachable — argparse restricts choices — but keep a clean error.
    print(f"❌ Unknown format: {chosen_format}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
