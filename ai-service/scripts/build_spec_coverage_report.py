"""By-spec coverage report.

For each (standard, spec) in the 99-spec Baccalaureate Handbook, lists:
  - The exact text that WILL BE IMPORTED as narrative_response
    (Submission.narratives[std][spec].content)
  - The exact text that WILL BE IMPORTED as supporting evidence
    (Submission.narratives[std][spec].supportingEvidenceText OR a new
    SupportingEvidence row)
  - The exact text that WILL BE IMPORTED as a curriculum matrix
    (CurriculumMatrix.rawContent)

Plus:
  - Specs with NO matched content (gaps the user should know about)
  - Sections classified as "context" or "unknown" (won't be imported)

Output: CSHSE/Engineering/ai-import-stevenson-by-spec-{date}.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.standards.loader import load_specifications

VAULT_DIR = Path("/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/CSHSE/Engineering")


def _truncate(s: str, n: int = 600) -> str:
    s = s.strip()
    return s if len(s) <= n else s[:n].rstrip() + "…"


def _format_import_text(spec_std: str, spec_letter: str, spec_title: str, spec_prompt: str, snippet: str) -> str:
    """The literal text the wizard would write to
    ``Submission.narratives[std][spec].content``.

    Format the wizard uses:
        Standard {std}.{spec} — {standard_title}

        Prompt: {spec prompt from Handbook}

        Response:
        {section body}

    This is the EXACT block the user will see when they open the
    narrative editor after the wizard finishes.
    """
    return (
        f"Standard {spec_std}.{spec_letter} — {spec_title}\n\n"
        f"Prompt: {spec_prompt}\n\n"
        f"Response:\n{snippet.strip()}\n"
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/tmp/stevenson-full-classify.json")
    ap.add_argument("--date", default="2026-05-17")
    args = ap.parse_args()

    data = json.load(open(args.input))
    specs = load_specifications("bachelors")

    # Group sections by (standard, spec)
    by_spec_narrative: dict[tuple[str, str], list[dict]] = defaultdict(list)
    by_spec_evidence: dict[tuple[str, str], list[dict]] = defaultdict(list)
    by_spec_matrix: dict[tuple[str, str], list[dict]] = defaultdict(list)
    context_sections: list[dict] = []
    unknown_sections: list[dict] = []

    for r in data:
        std = r["primary_standard"]
        spec = r["primary_spec"]
        if not std or not spec:
            unknown_sections.append(r)
            continue
        key = (std, spec)
        t = r["section_type"]
        if t == "narrative_response":
            by_spec_narrative[key].append(r)
        elif t == "supporting_evidence":
            by_spec_evidence[key].append(r)
        elif t == "curriculum_matrix":
            by_spec_matrix[key].append(r)
        elif t == "context":
            context_sections.append(r)
        else:
            unknown_sections.append(r)

    # Build the report
    lines: list[str] = []
    out = lines.append

    out("---")
    out(f"name: AI Import — Stevenson by-Spec Coverage {args.date}")
    out(
        "description: For every CSHSE Baccalaureate Specification, the exact "
        "text that the AI import wizard would write into "
        "`Submission.narratives[std][spec]` (narrative vs supporting "
        "evidence) plus matrix and unmatched-content gaps."
    )
    out("type: review")
    out("tags: [ai-import, sprint-1, stevenson, coverage, audit]")
    out(f"audit_date: {args.date}")
    out("auditor: claude")
    out(f"last_reviewed: {args.date}")
    out("---")
    out("")
    out(f"# AI Import — Stevenson by-Spec Coverage ({args.date})")
    out("")
    out(
        "This page answers: *for every Specification in the 99-spec 2025 "
        "Baccalaureate Handbook, what content from Stevenson's self-study "
        "would the AI import wizard write into "
        "`Submission.narratives[std][spec]`?*"
    )
    out("")
    out(
        "Each spec shows two destinations: **narrative** "
        "(`narratives[std][spec].content`) and **supporting evidence** "
        "(`narratives[std][spec].supportingEvidenceText` OR a new "
        "`SupportingEvidence` row linked to the same `(std, spec)`)."
    )
    out("")

    # ---- top-level coverage table -----
    specs_set = {(s.standard_code, s.spec_code) for s in specs}
    have_narrative = set(by_spec_narrative.keys()) & specs_set
    have_evidence = set(by_spec_evidence.keys()) & specs_set
    have_any = have_narrative | have_evidence
    gap = specs_set - have_any

    out("## Coverage summary")
    out("")
    out("| Category | Count | % of 99 |")
    out("|---|---|---|")
    out(f"| Specs with at least one narrative match | {len(have_narrative)} | {100*len(have_narrative)/99:.0f}% |")
    out(f"| Specs with at least one supporting-evidence match | {len(have_evidence)} | {100*len(have_evidence)/99:.0f}% |")
    out(f"| Specs with **any** matched content | {len(have_any)} | {100*len(have_any)/99:.0f}% |")
    out(f"| **Spec gaps** (zero matches → user must triage manually) | {len(gap)} | {100*len(gap)/99:.0f}% |")
    out(f"| Curriculum matrices identified | {sum(len(v) for v in by_spec_matrix.values())} | — |")
    out(f"| Sections flagged `context` (won't import) | {len(context_sections)} | — |")
    out(f"| Sections flagged `unknown` (user must triage) | {len(unknown_sections)} | — |")
    out("")

    # ---- gap list -----
    if gap:
        out("## Specs with NO matched content (gaps to triage)")
        out("")
        out(
            "These specs from the Handbook had **zero** sections classified to "
            "them. Either Stevenson's self-study doesn't address them, or the "
            "matcher missed substance hidden in tables/appendices and the user "
            "needs to manually tag those areas."
        )
        out("")
        sorted_gaps = sorted(
            gap,
            key=lambda k: (int(k[0]) if k[0].isdigit() else 99, k[1]),
        )
        out("| Spec | Standard Title | Spec Prompt |")
        out("|---|---|---|")
        for std, spec in sorted_gaps:
            sp = next(
                (s for s in specs if s.standard_code == std and s.spec_code == spec),
                None,
            )
            if not sp:
                continue
            prompt = sp.spec_text.replace("\n", " ").replace("|", "\\|")
            if len(prompt) > 120:
                prompt = prompt[:120] + "…"
            out(f"| `{std}.{spec}` | {sp.standard_title} | {prompt} |")
        out("")

    out("---")
    out("")

    # ---- per-spec detail, grouped by standard -----
    out("## Per-spec coverage detail")
    out("")
    out("Grouped by Standard. Each spec shows the exact text destined for "
        "its narrative slot and supporting-evidence slot.")
    out("")

    by_std: dict[str, list] = defaultdict(list)
    for s in specs:
        by_std[s.standard_code].append(s)

    for std in sorted(by_std.keys(), key=int):
        std_specs = sorted(by_std[std], key=lambda s: s.spec_code)
        out(f"## Standard {std}")
        out("")

        for sp in std_specs:
            key = (sp.standard_code, sp.spec_code)
            nar = by_spec_narrative.get(key, [])
            ev = by_spec_evidence.get(key, [])
            matrix = by_spec_matrix.get(key, [])
            status = "🟢 has narrative" if nar else ("🟠 evidence-only" if ev else "🔴 no match")
            if matrix:
                status = "📊 curriculum matrix" + (" + " + status if (nar or ev) else "")

            out(f"### `{sp.standard_code}.{sp.spec_code}` {status} — {sp.standard_title}")
            out("")
            out(f"**Spec prompt:** _{sp.spec_text}_")
            out("")

            # NARRATIVE destination
            out(f"**→ Imported as NARRATIVE** (`narratives[{sp.standard_code}][{sp.spec_code}].content`):")
            out("")
            if not nar:
                out("_(no sections matched as narrative)_")
            else:
                nar_sorted = sorted(nar, key=lambda r: -r["primary_confidence"])
                for i, r in enumerate(nar_sorted, 1):
                    state_icon = {
                        "auto_accept": "🟢",
                        "review_letter_disagrees": "🟡",
                        "review_low_confidence": "🔵",
                        "review_unknown": "⚪",
                    }.get(r["accept_state"], "⚪")
                    out(
                        f"##### Match {i} — {state_icon} **conf {r['primary_confidence']:.2f}** &nbsp;"
                        f"words {r['wordCount']} &nbsp; "
                        f"`{r['accept_state']}`"
                    )
                    out("")
                    out(f"_Source heading from doc:_ **{(r['heading'] or '')[:200]}**")
                    out("")
                    rationale = (r.get("rationale") or "").replace("\n", " ").strip()
                    out(f"_AI rationale:_ {rationale}")
                    out("")
                    out("**Exact text that will be written to the narrative slot:**")
                    out("")
                    out("```text")
                    import_text = _format_import_text(
                        sp.standard_code,
                        sp.spec_code,
                        sp.standard_title,
                        sp.spec_text,
                        r.get("snippet") or "",
                    )
                    out(import_text)
                    if r.get("snippet_truncated"):
                        out("[NOTE: source snippet was truncated at 800 chars in the JSON; "
                            "the actual import preserves the full section body.]")
                    out("```")
                    out("")
            out("")

            # SUPPORTING EVIDENCE destination
            out(
                f"**→ Imported as SUPPORTING EVIDENCE** "
                f"(`narratives[{sp.standard_code}][{sp.spec_code}].supportingEvidenceText`):"
            )
            out("")
            if not ev:
                out("_(no sections matched as supporting evidence)_")
            else:
                ev_sorted = sorted(ev, key=lambda r: -r["primary_confidence"])
                for i, r in enumerate(ev_sorted, 1):
                    state_icon = {
                        "auto_accept": "🟢",
                        "review_letter_disagrees": "🟡",
                        "review_low_confidence": "🔵",
                        "review_unknown": "⚪",
                    }.get(r["accept_state"], "⚪")
                    out(
                        f"##### Evidence {i} — {state_icon} **conf {r['primary_confidence']:.2f}** &nbsp;"
                        f"words {r['wordCount']} &nbsp; "
                        f"`{r['accept_state']}`"
                    )
                    out("")
                    out(f"_Source heading from doc:_ **{(r['heading'] or '')[:200]}**")
                    out("")
                    rationale = (r.get("rationale") or "").replace("\n", " ").strip()
                    out(f"_AI rationale:_ {rationale}")
                    out("")
                    out("**Exact text that will be written to the supporting-evidence slot:**")
                    out("")
                    out("```text")
                    out(
                        f"Supporting Evidence for Standard {sp.standard_code}.{sp.spec_code} — "
                        f"{sp.standard_title}\n\n"
                        f"{(r.get('snippet') or '').strip()}\n"
                    )
                    if r.get("snippet_truncated"):
                        out("[NOTE: snippet truncated at 800 chars in JSON; actual import preserves full body.]")
                    out("```")
                    out("")

            if matrix:
                out("")
                out(
                    f"**→ Imported as CURRICULUM MATRIX** "
                    f"(`CurriculumMatrix.rawContent` for `submissionId`):"
                )
                out("")
                for r in matrix:
                    out(
                        f"- conf {r['primary_confidence']:.2f} &nbsp; "
                        f"words {r['wordCount']} &nbsp; "
                        f"heading: _{(r['heading'] or '')[:80]}_"
                    )
                    out("  ```")
                    out("  " + _truncate(r.get("snippet") or "", 400).replace("\n", "\n  "))
                    out("  ```")
                    out("")

            out("---")
            out("")

    # ---- context + unknown buckets -----
    out("## Unimported buckets")
    out("")
    out(
        "These sections did NOT land in any spec slot. The wizard would skip "
        "them entirely (context) or route them to user review (unknown)."
    )
    out("")
    out(f"### context — {len(context_sections)} sections")
    out("")
    out("_Framing prose without a strong single-spec match. Examples:_")
    out("")
    for r in sorted(context_sections, key=lambda r: -r["wordCount"])[:5]:
        out(f"- ({r['wordCount']} words, conf {r['primary_confidence']:.2f}) {(r['heading'] or '')[:120]}")
    out("")
    out(f"### unknown — {len(unknown_sections)} sections")
    out("")
    out("_AI couldn't classify; user must triage. Often off-topic content:_")
    out("")
    for r in sorted(unknown_sections, key=lambda r: -r["wordCount"])[:5]:
        out(f"- ({r['wordCount']} words) {(r['heading'] or '')[:120]}")
        out(f"  rationale: _{(r.get('rationale') or '')[:200]}_")
    out("")

    out("---")
    out("")
    out("## Related")
    out("- [[ai-import-stevenson-2026-05-17]] — same data, **by-section** view")
    out("- [[legacy-self-study-import]] — design + architecture")
    out("- [[sprint-plan-2026-05-16]] — Sprint 1 stories")

    output_path = VAULT_DIR / f"ai-import-stevenson-by-spec-{args.date}.md"
    output_path.write_text("\n".join(lines))
    kb = output_path.stat().st_size / 1024
    print(f"✅ wrote {output_path}")
    print(f"   {kb:.0f} KB, {len(lines)} lines")
    print()
    print(f"  Specs with narrative match:        {len(have_narrative)}/99")
    print(f"  Specs with supporting-evidence:    {len(have_evidence)}/99")
    print(f"  Specs with any matched content:    {len(have_any)}/99")
    print(f"  Spec gaps (NO match):              {len(gap)}/99")


if __name__ == "__main__":
    main()
