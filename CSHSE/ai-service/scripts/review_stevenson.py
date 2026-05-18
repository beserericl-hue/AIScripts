"""Generate a human-reviewable report of what Claude picked for each Stevenson section.

Pulls Stevenson's tagged sections from the dev CSHSE Mongo, runs the real
pipeline (OpenAI embedding → Qdrant search → Claude Haiku adjudication), and
prints a side-by-side view of:

  - the section's heading
  - the section body (excerpted)
  - the human-applied (standardCode, specCode) from Mongo (ground truth)
  - Claude's primary pick + confidence
  - Claude's rationale
  - the alternates Claude considered
  - the top-5 Qdrant candidates with similarity scores

Usage::

    OPENAI_API_KEY=... ANTHROPIC_API_KEY=... QDRANT_URL=... QDRANT_API_KEY=... \\
    MONGO_DEV_URL=... python scripts/review_stevenson.py
"""
from __future__ import annotations

import os
import sys
import uuid

# Allow running this from anywhere
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient

from app.embeddings.openai_client import EmbeddingClient
from app.embeddings.spec_cache import bootstrap_spec_cache
from app.matcher.spec_matcher import SpecMatcher
from app.splitter.sections import Section
from app.vector.qdrant_ops import VectorStore


def _section_from_detected(detected: dict, idx: int) -> Section:
    body = detected.get("fullContent") or ""
    heading = (detected.get("headerText") or f"Section {idx}").strip()
    return Section(
        id=f"stevenson:detected:{idx:04d}",
        heading=heading[:120],
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
    qdrant_url = os.environ["QDRANT_URL"]
    qdrant_key = os.environ.get("QDRANT_API_KEY", "")
    openai_key = os.environ["OPENAI_API_KEY"]
    anthropic_key = os.environ["ANTHROPIC_API_KEY"]
    mongo_url = os.environ["MONGO_DEV_URL"]

    client = MongoClient(mongo_url)
    db = client.get_default_database()
    imp = db["selfstudyimports"].find_one({})
    assert imp, "no selfstudyimports in dev Mongo"

    print(f"📄 {imp['originalFilename']}")
    print(f"   status: {imp['status']}")
    print(f"   detectedSections: {len(imp.get('detectedSections') or [])}")
    htmlSize = (imp.get("extractedContent") or {}).get("metadata", {}).get("htmlSize", 0)
    print(f"   htmlSize: {htmlSize / 1024 / 1024:.1f} MB")
    print()

    # Isolated collection so prod data isn't touched.
    test_collection = f"cshse_specs_review_{uuid.uuid4().hex[:8]}"
    store = VectorStore(qdrant_url, qdrant_key)
    embedder = EmbeddingClient(openai_key)
    print(f"🧠 Bootstrapping spec cache → {test_collection}...")
    counts = bootstrap_spec_cache(store, embedder, collection=test_collection)
    print(f"   embedded {counts.get('bachelors', 0)} specifications")
    print()

    matcher = SpecMatcher(
        store=store,
        embedder=embedder,
        anthropic_key=anthropic_key,
        specs_collection=test_collection,
    )

    tagged = [
        s
        for s in (imp.get("detectedSections") or [])
        if s.get("standardCode") and (s.get("fullContent") or "").strip()
    ]
    print(f"🔍 Reviewing {len(tagged)} ground-truth sections\n")
    print("=" * 100)

    correct = 0
    for idx, ds in enumerate(tagged, 1):
        section = _section_from_detected(ds, idx)
        expected = (str(ds["standardCode"]), str(ds.get("specCode") or "-"))

        print(f"\n[{idx}/{len(tagged)}] {section.heading}")
        print("-" * 100)
        print("📋 SECTION BODY (first 600 chars):")
        body_excerpt = section.markdown[:600].replace("\n", " ").strip()
        print(f"   {body_excerpt}{'...' if len(section.markdown) > 600 else ''}")
        print()
        print(f"✅ HUMAN TAG: Standard {expected[0]}.{expected[1]}")

        rec = matcher.recommend(section, program_level="bachelors")

        got = (rec.primary_standard or "?", rec.primary_spec or "?")
        match_indicator = "✓" if got == expected else "✗"
        print(
            f"🤖 CLAUDE PICKED: Standard {got[0]}.{got[1]} {match_indicator}  "
            f"(confidence {rec.primary_confidence:.2f})"
        )
        print(f"   Supporting evidence? {rec.is_supporting_evidence}")
        print(f"   Rationale: {rec.rationale}")
        if rec.alternates:
            alts = ", ".join(
                f"{a['standardCode']}.{a['specCode']} ({a['confidence']:.2f})"
                for a in rec.alternates
            )
            print(f"   Other candidates considered: {alts}")
        print()
        print("🔎 TOP-5 QDRANT NEIGHBORS (by cosine similarity):")
        for i, c in enumerate(rec.candidates[:5], 1):
            std = c["standard_code"]
            spec = c["spec_code"]
            sim = c["similarity"]
            txt = c["spec_text"][:80] + "..." if len(c["spec_text"]) > 80 else c["spec_text"]
            print(f"   {i}. {std}.{spec} (sim={sim:.3f}) — {txt}")

        if got == expected:
            correct += 1
        print()
        print("=" * 100)

    print(f"\n🎯 ACCURACY: {correct}/{len(tagged)} correct ({100*correct/len(tagged):.0f}%)")
    print()


if __name__ == "__main__":
    main()
