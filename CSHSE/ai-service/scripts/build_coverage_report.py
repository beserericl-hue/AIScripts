"""Run the per-spec coverage review against Stevenson and emit a vault report.

For each (std, spec) in the Baccalaureate Handbook, pulls all narrative +
supporting-evidence sections classified for that spec, sends to Claude Haiku
for a coverage review, and writes the result to a vault page.

Total API cost ≈ $0.10 (one Haiku call per spec × 99 specs).

Output:
  CSHSE/Engineering/ai-import-stevenson-coverage-{date}.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.coverage.spec_coverage import CoverageReviewer
from app.standards.loader import load_specifications

VAULT_DIR = Path("/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/CSHSE/Engineering")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/tmp/stevenson-full-classify.json")
    ap.add_argument("--date", default="2026-05-17")
    ap.add_argument("--concurrency", type=int, default=8)
    args = ap.parse_args()

    anthropic_key = os.environ["ANTHROPIC_API_KEY"]
    reviewer = CoverageReviewer(anthropic_key)

    data = json.load(open(args.input))
    specs = load_specifications("bachelors")

    # Group classified sections per (std, spec)
    by_spec_narrative: dict[tuple[str, str], list[dict]] = defaultdict(list)
    by_spec_evidence: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in data:
        std = r.get("primary_standard")
        spec = r.get("primary_spec")
        if not std or not spec:
            continue
        key = (std, spec)
        t = r.get("section_type")
        if t == "narrative_response":
            by_spec_narrative[key].append(r)
        elif t == "supporting_evidence":
            by_spec_evidence[key].append(r)

    # Build review tasks for every spec in the Handbook (even ones with no content
    # — those reviews surface the obvious gap to the user).
    print(f"Reviewing {len(specs)} specs against Stevenson's classifications…")
    t0 = time.time()

    def _review_one(sp):
        key = (sp.standard_code, sp.spec_code)
        narratives = by_spec_narrative.get(key, [])
        evidence = by_spec_evidence.get(key, [])
        narrative_text = "\n\n".join(
            (r.get("snippet") or "")[:3000] for r in narratives
        ).strip()
        evidence_items = [
            ((r.get("heading") or "")[:80], (r.get("snippet") or "")[:1500])
            for r in evidence
        ]
        review = reviewer.review(sp, narrative_text, evidence_items)
        return sp, review, len(narratives), len(evidence)

    results = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futures = {ex.submit(_review_one, sp): sp for sp in specs}
        done = 0
        for fut in as_completed(futures):
            try:
                sp, review, nar_count, ev_count = fut.result()
                results.append((sp, review, nar_count, ev_count))
            except Exception as e:
                print(f"  ✗ {futures[fut].standard_code}.{futures[fut].spec_code}: {e}")
            done += 1
            if done % 10 == 0 or done == len(specs):
                print(f"  {done}/{len(specs)} ({time.time()-t0:.0f}s)")

    print(f"  ✓ {len(results)} reviews in {time.time()-t0:.0f}s")

    # Stats
    covered = sum(1 for _, r, _, _ in results if r.is_covered)
    not_covered = len(results) - covered
    avg_score = sum(r.coverage_score for _, r, _, _ in results) / max(1, len(results))

    # Build the report
    lines: list[str] = []
    out = lines.append
    out("---")
    out(f"name: AI Import — Stevenson Per-Spec Coverage Review {args.date}")
    out("description: For each of the 99 Baccalaureate specs, Claude's verdict on whether the assigned narrative + supporting evidence adequately addresses the spec prompt.")
    out("type: review")
    out("tags: [ai-import, sprint-1, stevenson, coverage, audit]")
    out(f"audit_date: {args.date}")
    out("auditor: claude")
    out(f"last_reviewed: {args.date}")
    out("---")
    out("")
    out(f"# AI Import — Stevenson Per-Spec Coverage Review ({args.date})")
    out("")
    out(
        "After mapping document sections to specs, Claude re-reads each "
        "spec's assigned narrative + supporting evidence and judges whether "
        "the spec is **adequately addressed**. Gaps go to the wizard's "
        "review queue so the coordinator can patch them before submission."
    )
    out("")
    out("## Summary")
    out("")
    out(f"- **{covered}/99** specs Claude says ARE adequately covered ({100*covered/99:.0f}%)")
    out(f"- **{not_covered}/99** specs have gaps Claude flags for user review")
    out(f"- **Average coverage score:** {avg_score:.2f} / 1.0")
    out("")
    out("---")
    out("")
    out("## Per-spec verdicts")
    out("")

    sorted_results = sorted(
        results, key=lambda x: (int(x[0].standard_code), x[0].spec_code)
    )
    last_std = None
    for sp, r, nar_count, ev_count in sorted_results:
        if sp.standard_code != last_std:
            out(f"\n## Standard {sp.standard_code}")
            out("")
            last_std = sp.standard_code
        icon = "🟢" if r.is_covered else ("🟡" if r.coverage_score >= 0.4 else "🔴")
        out(
            f"### `{sp.standard_code}.{sp.spec_code}` {icon} — "
            f"covered={r.is_covered}, score={r.coverage_score:.2f}"
        )
        out("")
        out(f"**Spec prompt:** _{sp.spec_text}_")
        out("")
        out(f"**Assigned content:** {nar_count} narrative + {ev_count} supporting evidence section(s)")
        out("")
        out(f"**Claude's summary:** {r.suggestion}")
        out("")
        if r.strengths:
            out("**Strengths:**")
            for s in r.strengths:
                out(f"- {s}")
            out("")
        if r.gaps:
            out("**Gaps (user must address):**")
            for g in r.gaps:
                out(f"- ⚠️ {g}")
            out("")
        out("---")

    output_path = VAULT_DIR / f"ai-import-stevenson-coverage-{args.date}.md"
    output_path.write_text("\n".join(lines))
    print()
    print(f"✅ wrote {output_path}")
    print(f"   {output_path.stat().st_size/1024:.0f} KB")
    print(f"\n  covered: {covered}/99, avg score: {avg_score:.2f}")


if __name__ == "__main__":
    main()
