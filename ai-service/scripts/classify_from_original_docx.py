"""Run the AI classify pipeline against an ORIGINAL DOCX (not the mutated GridFS HTML).

This is the architecturally-correct flow per user direction 2026-05-17:
  - Original DOCX is preserved in S3 as an immutable reference.
  - The wizard reads the DOCX, runs mammoth → fresh HTML, runs the deep walker.
  - Results go into the database (recommendations) + GridFS (HTML for editor).

Compared to ``full_doc_classify.py`` which reads the (mutated) GridFS HTML,
this script reads the pristine source so we're not comparing apples-to-oranges.

Usage:
    python scripts/classify_from_original_docx.py [--input PATH] [--concurrency N]
"""
from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import mammoth

from app.embeddings.openai_client import EmbeddingClient
from app.embeddings.spec_cache import bootstrap_spec_cache
from app.matcher.spec_matcher import SpecMatcher
from app.splitter.deep_walker import deep_walk_with_fallback
from app.vector.qdrant_ops import VectorStore


def _docx_to_html(docx_bytes: bytes) -> str:
    """Convert DOCX bytes to HTML using mammoth (preserves structure including tables)."""
    result = mammoth.convert_to_html(io.BytesIO(docx_bytes))
    return result.value  # HTML string


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/tmp/stevenson-original.docx")
    ap.add_argument("--concurrency", type=int, default=12)
    ap.add_argument("--min-words", type=int, default=30)
    ap.add_argument("--output-json", default="/tmp/stevenson-from-original.json")
    args = ap.parse_args()

    qdrant_url = os.environ["QDRANT_URL"]
    qdrant_key = os.environ.get("QDRANT_API_KEY", "")
    openai_key = os.environ["OPENAI_API_KEY"]
    anthropic_key = os.environ["ANTHROPIC_API_KEY"]

    print(f"📄 source: {args.input}")
    with open(args.input, "rb") as f:
        docx_bytes = f.read()
    print(f"   {len(docx_bytes)/1024/1024:.1f} MB DOCX")

    t0 = time.time()
    print("🔄 mammoth: DOCX → fresh HTML…")
    html = _docx_to_html(docx_bytes)
    print(f"   {len(html)/1024/1024:.2f} MB HTML in {time.time()-t0:.1f}s")
    # Save to /tmp for inspection
    with open("/tmp/stevenson-original.html", "w") as f:
        f.write(html)

    t0 = time.time()
    print("✂️  deep walk on FRESH HTML (no marker contamination)…")
    raw_sections = deep_walk_with_fallback(html.encode("utf-8"), base_id="stevenson-orig")
    sections = [s for s in raw_sections if s.word_count >= args.min_words]
    print(f"   {len(raw_sections)} raw, {len(sections)} after min-words filter ({time.time()-t0:.1f}s)")

    tiers: dict[str, int] = {}
    for s in raw_sections:
        tiers[s.splitter_tier] = tiers.get(s.splitter_tier, 0) + 1
    print(f"   tier distribution: {tiers}")

    print("🧠 bootstrap spec cache…")
    test_collection = f"cshse_specs_orig_{uuid.uuid4().hex[:8]}"
    store = VectorStore(qdrant_url, qdrant_key)
    embedder = EmbeddingClient(openai_key)
    counts = bootstrap_spec_cache(store, embedder, collection=test_collection)
    print(f"   {counts.get('bachelors',0)} specs embedded")

    matcher = SpecMatcher(
        store=store,
        embedder=embedder,
        anthropic_key=anthropic_key,
        specs_collection=test_collection,
    )

    print(f"🤖 classify {len(sections)} sections, concurrency={args.concurrency}…")
    t0 = time.time()
    results = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futures = {ex.submit(matcher.recommend, s, "bachelors"): s for s in sections}
        done = 0
        for fut in as_completed(futures):
            section = futures[fut]
            try:
                rec = fut.result()
            except Exception as exc:
                print(f"   ✗ {section.id}: {exc}")
                continue
            results.append((section, rec))
            done += 1
            if done % 25 == 0 or done == len(sections):
                print(f"   {done}/{len(sections)} ({time.time()-t0:.0f}s)")
    print(f"   ✓ {len(results)} classified in {time.time()-t0:.0f}s")

    json_out = [
        {
            "section_id": s.id,
            "heading": s.heading,
            "wordCount": s.word_count,
            "containsTable": s.contains_table,
            "splitterTier": s.splitter_tier,
            "humanTaggedStandard": None,
            "humanTaggedSpec": None,
            "primary_standard": r.primary_standard,
            "primary_spec": r.primary_spec,
            "primary_confidence": r.primary_confidence,
            "section_type": r.section_type,
            "accept_state": r.accept_state,
            "doc_letter": r.doc_letter,
            "doc_standard_hint": r.doc_standard_hint,
            "rationale": r.rationale,
            "alternates": r.alternates,
            "snippet": s.markdown,
            "snippet_truncated": False,
            "byteOffsetStart": s.byte_offset_start,
            "byteOffsetEnd": s.byte_offset_end,
        }
        for s, r in results
    ]
    with open(args.output_json, "w") as f:
        json.dump(json_out, f, indent=2)
    print(f"📄 wrote {args.output_json}")

    # Quick stats
    from collections import Counter
    by_state = Counter(r.accept_state for s, r in results)
    by_type = Counter(r.section_type for s, r in results)
    by_spec = Counter(
        f"{r.primary_standard}.{r.primary_spec}"
        for s, r in results
        if r.primary_standard and r.primary_spec
    )
    print()
    print("=" * 60)
    print("SUMMARY")
    print(f"  sections: {len(results)}")
    print(f"  section_type: {dict(by_type)}")
    print(f"  accept_state: {dict(by_state)}")
    print(f"  auto_accept rate: {by_state.get('auto_accept',0)}/{len(results)} = {100*by_state.get('auto_accept',0)/max(1,len(results)):.0f}%")
    confs = [r.primary_confidence for _, r in results]
    if confs:
        print(f"  confidence median: {sorted(confs)[len(confs)//2]:.2f}  mean: {sum(confs)/len(confs):.2f}")
    print(f"  top 10 spec assignments: {by_spec.most_common(10)}")


if __name__ == "__main__":
    main()
