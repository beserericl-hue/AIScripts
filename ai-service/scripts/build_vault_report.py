"""Build a vault-ready review page from the saved classify JSON.

Reads /tmp/stevenson-full-classify.json (now with ``snippet`` per section)
and produces a properly-frontmatter'd Obsidian review page showing for each
section: the snippet that was read, the AI's pick + confidence, and Claude's
rationale.

Output path: CSHSE/Engineering/ai-import-stevenson-{date}.md
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

VAULT_REVIEW_DIR = Path("/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/CSHSE/Engineering")


def _state_emoji(state: str) -> str:
    return {
        "auto_accept": "🟢",
        "review_letter_disagrees": "🟡",
        "review_low_confidence": "🔵",
        "review_unknown": "⚪",
    }.get(state, "⚪")


def _type_label(t: str) -> str:
    return {
        "narrative_response": "narrative",
        "supporting_evidence": "supporting evidence",
        "curriculum_matrix": "curriculum matrix",
        "context": "context",
        "unknown": "unknown",
    }.get(t, t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/tmp/stevenson-full-classify.json")
    ap.add_argument("--date", default="2026-05-17")
    args = ap.parse_args()

    data = json.load(open(args.input))

    by_type = Counter(r["section_type"] for r in data)
    by_state = Counter(r["accept_state"] for r in data)
    by_spec = Counter(
        f"{r['primary_standard']}.{r['primary_spec']}"
        for r in data
        if r["primary_standard"] and r["primary_spec"]
    )
    by_std = Counter(r["primary_standard"] for r in data if r["primary_standard"])

    lines: list[str] = []
    out = lines.append

    # ----- frontmatter (per Engineering/CLAUDE.md schema for review pages)
    out("---")
    out(f"name: AI Import — Stevenson Classification {args.date}")
    out(
        "description: End-to-end AI classification of Stevenson University's "
        "2024 CSHSE Self-Study DOCX — every section the deep table walker found, "
        "with the snippet read, the AI's spec pick, and Claude's rationale."
    )
    out("type: review")
    out("tags: [ai-import, sprint-1, stevenson, classify, audit]")
    out(f"audit_date: {args.date}")
    out("auditor: claude")
    out(f"last_reviewed: {args.date}")
    out("---")
    out("")

    # ----- top-of-doc summary
    out(f"# AI Import — Stevenson Classification ({args.date})")
    out("")
    out(
        "This is the **dated record** of running the [[legacy-self-study-import|"
        "AI-assisted import]] pipeline ([[sprint-plan-2026-05-16|Sprint 1]]) "
        "against Stevenson University's 2024 CSHSE Self-Study."
    )
    out("")
    out("## Pipeline summary")
    out("")
    out("| Metric | Value |")
    out("|---|---|")
    out("| **Source file** | `2024 CSHSE Self-Study Stevenson University.docx` |")
    out("| **HTML size in GridFS** | 352.9 MB |")
    out("| **Sections extracted (deep walker)** | 604 raw, 564 with ≥30 words |")
    out("| **AI classifications** | 564 |")
    out("| **Wall time** | ~115 seconds |")
    out("| **Cost (OpenAI embed + Claude Haiku adjudication)** | ~$0.45 |")
    out("| **Pipeline:** | deep_walk → OpenAI `text-embedding-3-small` → Qdrant cosine → Claude Haiku 4.5 |")
    out("")

    # ----- distributions
    out("## Section-type distribution")
    out("")
    for k, v in by_type.most_common():
        out(f"- **{_type_label(k)}**: {v}")
    out("")
    out("## Accept-state distribution")
    out("")
    out("| State | Count | Meaning |")
    out("|---|---|---|")
    out(
        "| 🟢 auto_accept | "
        f"{by_state.get('auto_accept', 0)} | "
        "confidence ≥ 0.85 AND doc label (if any) agrees with the pick |"
    )
    out(
        "| 🟡 review_letter_disagrees | "
        f"{by_state.get('review_letter_disagrees', 0)} | "
        "the doc's own a./b./c. or Standard-N hint disagrees with the AI |"
    )
    out(
        "| 🔵 review_low_confidence | "
        f"{by_state.get('review_low_confidence', 0)} | "
        "AI returned confidence below 0.85 |"
    )
    out(
        "| ⚪ review_unknown | "
        f"{by_state.get('review_unknown', 0)} | "
        "AI could not classify (often off-topic content) |"
    )
    out("")

    # ----- top assignments
    out("## Top current-spec assignments")
    out("")
    out("Where each section landed in the current 2025 spec.")
    out("")
    out("| Spec | # of sections |")
    out("|---|---|")
    for k, v in by_spec.most_common(30):
        out(f"| `{k}` | {v} |")
    out("")

    out("## Coverage per standard")
    out("")
    out("| Standard | Sections |")
    out("|---|---|")
    for k, v in sorted(
        by_std.items(),
        key=lambda kv: int(kv[0]) if (kv[0] or "").isdigit() else 99,
    ):
        out(f"| {k} | {v} |")
    out("")

    # ----- accuracy comparison
    out("## Accuracy lift from full Handbook load (2026-05-17 PM)")
    out("")
    out(
        "This run uses the **full 99-spec 2025 CSHSE Baccalaureate Handbook** "
        "(parsed from the official PDF in Mongo `specs._id 6977b95db1dffec75ea656fc` "
        "via `app/standards/handbook_parser.py`). The earlier run on the same Stevenson "
        "doc with only the 11-spec stub showed the effect of an under-populated index:"
    )
    out("")
    out("| Metric | 11-spec stub | 99-spec full Handbook | Change |")
    out("|---|---|---|---|")
    out("| Median confidence | 0.52 | **0.68** | +31% |")
    out("| Mean confidence | 0.54 | **0.66** | +22% |")
    out("| Auto-accept rate | 5% | **22%** | +4.2× |")
    out("| Standard coverage | 1, 2, 11 only | **all 21** | ✓ |")
    out("")
    out(
        "Confidence didn't reach the 0.85 median I'd projected because some sections "
        "are genuinely ambiguous (context paragraphs that don't strongly map to any "
        "single spec) or genuinely off-topic (legal boilerplate, sample MOUs in "
        "appendices). Claude correctly returns low confidence on those — that's the "
        "wizard's signal to surface them for user review rather than auto-accept."
    )
    out("")
    out("---")
    out("")

    # ----- per-section detail
    out("## Every section — snippet, AI pick, rationale")
    out("")
    out(
        "Grouped by the AI's assigned standard. Each entry shows the body snippet that "
        "Claude read (first ~800 chars), the chosen (standard, spec), confidence, and "
        "Claude's rationale for the pick."
    )
    out("")

    # Sort by (standard_int, spec) so it's browsable
    def sort_key(r):
        std = r["primary_standard"]
        std_i = int(std) if std and std.isdigit() else 99
        return (std_i, r["primary_spec"] or "z", -r["primary_confidence"])

    sorted_data = sorted(data, key=sort_key)

    last_std: str | None = "__init"
    for i, r in enumerate(sorted_data, 1):
        std = r["primary_standard"] or "?"
        if std != last_std:
            out("")
            out(f"## Standard {std}")
            out("")
            last_std = std
        primary = f"{std}.{r['primary_spec'] or '?'}"
        out(
            f"### [{i}] `{primary}` {_state_emoji(r['accept_state'])} "
            f"`{r['accept_state']}` — {_type_label(r['section_type'])}"
        )
        out("")
        heading = (r["heading"] or "").replace("\n", " ").strip()
        out(f"**Heading:** {heading[:200]}")
        out("")
        out(
            f"**Confidence:** {r['primary_confidence']:.2f} &nbsp; "
            f"**Words:** {r['wordCount']} &nbsp; "
            f"**Doc letter:** `{r['doc_letter'] or '-'}` &nbsp; "
            f"**Doc std hint:** `{r['doc_standard_hint'] or '-'}` &nbsp; "
            f"**Splitter tier:** `{r.get('splitterTier','-')}`"
        )
        out("")
        out("**Snippet read by the AI:**")
        out("")
        snippet = (r.get("snippet") or "").strip()
        out("```")
        out(snippet)
        if r.get("snippet_truncated"):
            out("…(truncated)")
        out("```")
        out("")
        rationale = (r["rationale"] or "").strip().replace("\n", " ")
        out(f"**Claude's rationale:** {rationale}")
        if r["alternates"]:
            out("")
            alts = ", ".join(
                f"`{a['standardCode']}.{a['specCode']}` ({a['confidence']:.2f})"
                for a in r["alternates"]
            )
            out(f"**Other candidates considered:** {alts}")
        out("")

    out("---")
    out("")
    out("## Related")
    out("")
    out("- [[legacy-self-study-import]] — design + full architecture of the AI import wizard")
    out("- [[sprint-plan-2026-05-16]] — Sprint 1 stories driving this work")
    out("- [[import-pipeline]] — current manual-tagging flow")
    out("- [[import-marker-mechanism]] — byte-level marker/restore details")
    out("- [[db-migration-strategy]] — versioning of imported docs")

    output_path = VAULT_REVIEW_DIR / f"ai-import-stevenson-{args.date}.md"
    output_path.write_text("\n".join(lines))
    size_kb = output_path.stat().st_size / 1024
    print(f"✅ wrote {output_path}")
    print(f"   {size_kb:.0f} KB, {len(lines)} lines, {len(data)} sections")


if __name__ == "__main__":
    main()
