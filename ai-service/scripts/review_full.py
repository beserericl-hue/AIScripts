"""Full review of every Stevenson section with full section text + full spec text.

Output is a markdown file you can read top-to-bottom. Shows for each detected
section in the Stevenson self-study:

  - the section heading
  - the FULL body text (not truncated)
  - the human-applied (standard, spec) tag if any
  - Claude's pick + confidence + rationale + supporting-evidence flag
  - the top-5 Qdrant candidates with their FULL spec text
  - a side-by-side "this is the section / this is the spec we matched" view

Saves to ``/tmp/stevenson-review-full.md`` so you can browse it in a Markdown
viewer (Cursor / VS Code preview).
"""
from __future__ import annotations

import os
import sys
import uuid
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient

from app.embeddings.openai_client import EmbeddingClient
from app.embeddings.spec_cache import bootstrap_spec_cache
from app.matcher.spec_matcher import SpecMatcher
from app.splitter.sections import Section
from app.standards.loader import load_specifications
from app.vector.qdrant_ops import VectorStore


OUTPUT = "/tmp/stevenson-review-full.md"


def _section_from(detected: dict, idx: int) -> Section:
    body = detected.get("fullContent") or ""
    heading = (detected.get("headerText") or f"Section {idx}").strip()
    return Section(
        id=f"stevenson:detected:{idx:04d}",
        heading=heading[:200],
        heading_level=2,
        markdown=body,
        byte_offset_start=int(detected.get("textStartOffset", 0)),
        byte_offset_end=int(detected.get("textStartOffset", 0))
        + int(detected.get("textLength", len(body))),
        word_count=len(body.split()),
        contains_table=bool(detected.get("wasTableExpanded", False)),
        contains_image=False,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="from-mongo",
        flags={
            "containsTable": bool(detected.get("wasTableExpanded", False)),
            "containsImage": False,
            "hasResumeSignals": False,
            "hasSyllabusSignals": False,
        },
    )


def main():
    lines: list[str] = []
    out = lines.append

    qdrant_url = os.environ["QDRANT_URL"]
    qdrant_key = os.environ.get("QDRANT_API_KEY", "")
    openai_key = os.environ["OPENAI_API_KEY"]
    anthropic_key = os.environ["ANTHROPIC_API_KEY"]
    mongo_url = os.environ["MONGO_DEV_URL"]

    client = MongoClient(mongo_url)
    db = client.get_default_database()
    imp = db["selfstudyimports"].find_one({})
    assert imp, "no selfstudyimports in dev Mongo"

    out("# Stevenson Self-Study — Full Pipeline Review")
    out("")
    out(f"**File:** {imp['originalFilename']}  ")
    out(f"**Import status:** `{imp['status']}`  ")
    out(f"**Detected sections:** {len(imp.get('detectedSections') or [])}  ")
    htmlSize = (imp.get("extractedContent") or {}).get("metadata", {}).get("htmlSize", 0)
    out(f"**HTML size:** {htmlSize / 1024 / 1024:.1f} MB  ")
    out("")

    # ---- THE SPEC DATASET WE'RE MATCHING AGAINST ------------------------
    specs = load_specifications("bachelors")
    out("## Specification dataset")
    out("")
    out(
        f"Currently {len(specs)} hand-curated bachelors-level specifications "
        "are loaded into Qdrant (Sprint 1 MVP scope — full PDF parsing of the "
        "CSHSE Handbook is a follow-up). For Stevenson's bachelors-level "
        "self-study these cover Standards 1, 2, and part of 11."
    )
    out("")
    out("| Std.Spec | Standard Title | Spec Text |")
    out("|---|---|---|")
    for s in specs:
        out(
            f"| **{s.standard_code}.{s.spec_code}** "
            f"| {s.standard_title} "
            f"| {s.spec_text.replace('|', '\\|')} |"
        )
    out("")
    out("---")
    out("")

    # ---- BOOTSTRAP QDRANT -----------------------------------------------
    test_collection = f"cshse_specs_review_{uuid.uuid4().hex[:8]}"
    store = VectorStore(qdrant_url, qdrant_key)
    embedder = EmbeddingClient(openai_key)
    bootstrap_spec_cache(store, embedder, collection=test_collection)

    matcher = SpecMatcher(
        store=store,
        embedder=embedder,
        anthropic_key=anthropic_key,
        specs_collection=test_collection,
    )

    detected = [
        s for s in (imp.get("detectedSections") or [])
        if (s.get("fullContent") or "").strip()
    ]

    out(f"## Per-section pipeline output ({len(detected)} sections)")
    out("")

    correct = 0
    tagged_total = 0
    for idx, ds in enumerate(detected, 1):
        section = _section_from(ds, idx)
        rec = matcher.recommend(section, program_level="bachelors")

        human_tag: tuple[str | None, str | None] = (
            ds.get("standardCode"),
            ds.get("specCode"),
        )
        got = (rec.primary_standard, rec.primary_spec)
        is_tagged = bool(ds.get("standardCode"))
        match = (got == (str(human_tag[0]) if human_tag[0] else None,
                         str(human_tag[1]) if human_tag[1] else None))
        if is_tagged:
            tagged_total += 1
            if match:
                correct += 1

        # ---- Section header -----
        out(f"### Section {idx}: {section.heading[:120]}")
        out("")
        out(
            f"**Words:** {section.word_count}  "
            f"**Text offset:** {section.byte_offset_start}..{section.byte_offset_end}"
        )
        out("")

        # ---- Tag row ------------
        if is_tagged:
            out(
                f"**Human tag:** Standard {human_tag[0]}.{human_tag[1] or '-'} "
                + ("✓ match" if match else "✗ MISMATCH")
            )
        else:
            out("**Human tag:** _(untagged in the source data)_")
        out(
            f"**Claude pick:** Standard `{rec.primary_standard or '?'}`."
            f"`{rec.primary_spec or '?'}` — confidence **{rec.primary_confidence:.2f}**"
        )
        out(f"**Section type:** `{rec.section_type}` &nbsp; **Accept state:** `{rec.accept_state}`")
        out(
            f"**Doc letter hint:** `{rec.doc_letter or '-'}` &nbsp; "
            f"**Doc standard hint:** `{rec.doc_standard_hint or '-'}`"
        )
        out("")
        out(f"**Rationale:** {rec.rationale}")
        if rec.alternates:
            out("")
            out("**Other candidates Claude considered:**")
            for a in rec.alternates:
                out(
                    f"- `{a['standardCode']}.{a['specCode']}` "
                    f"(confidence {a['confidence']:.2f})"
                )
        out("")

        # ---- Full section body --
        out("<details>")
        out("<summary>📄 Full section body</summary>")
        out("")
        out("```")
        out(section.markdown.strip())
        out("```")
        out("")
        out("</details>")
        out("")

        # ---- Top-K candidate spec text (with full text) -----
        out("<details>")
        out("<summary>🔎 Top-5 Qdrant candidates (with full spec text)</summary>")
        out("")
        for i, c in enumerate(rec.candidates[:5], 1):
            out(
                f"**{i}. {c['standard_code']}.{c['spec_code']}** — "
                f"_{c['standard_title']}_ — similarity **{c['similarity']:.3f}**"
            )
            out("")
            out(f"> {c['spec_text']}")
            out("")
        out("</details>")
        out("")
        out("---")
        out("")

    # ---- Summary ----------------------------------------------------------
    out("## Summary")
    out("")
    if tagged_total > 0:
        out(
            f"**Accuracy on ground-truth-tagged sections:** "
            f"{correct}/{tagged_total} = {100 * correct / tagged_total:.0f}%"
        )
    out(f"**Total sections processed:** {len(detected)}")
    out(f"**Untagged sections (Claude auto-tagged):** {len(detected) - tagged_total}")
    out("")

    body = "\n".join(lines)
    with open(OUTPUT, "w") as f:
        f.write(body)
    print(f"\n✅ Wrote review to {OUTPUT}")
    print(f"   {len(body)} chars, {len(lines)} lines")
    print(f"\nTagged ground-truth accuracy: {correct}/{tagged_total}")
    print(f"Total sections: {len(detected)}")


if __name__ == "__main__":
    main()
