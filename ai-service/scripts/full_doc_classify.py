"""Parse Stevenson's entire self-study from GridFS, split into sections, and
classify every one with the AI matcher.

Workflow:
  1. Stream the GridFS ``htmlContent.{importId}.html`` chunks into memory.
  2. Convert HTML -> Markdown (preserve headings + tables).
  3. Run the section splitter to produce hundreds of Section records.
  4. For each section call the matcher.
  5. Write a markdown review with every section's classification.

Concurrency: matcher.recommend is sync; we use a ThreadPoolExecutor with a
modest pool so the OpenAI / Anthropic clients don't get rate-limited.

Outputs:
  /tmp/stevenson-full-classify.md       — human-readable review
  /tmp/stevenson-full-classify.json     — structured recommendations for the wizard

Usage::

  OPENAI_API_KEY=...
  ANTHROPIC_API_KEY=...
  QDRANT_URL=...
  QDRANT_API_KEY=...
  MONGO_DEV_URL=...
  python scripts/full_doc_classify.py [--max-sections N] [--concurrency M]
"""
from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bs4 import BeautifulSoup
from markdownify import markdownify
from pymongo import MongoClient

from app.embeddings.openai_client import EmbeddingClient
from app.embeddings.spec_cache import bootstrap_spec_cache
from app.matcher.spec_matcher import Recommendation, SpecMatcher
from app.splitter.deep_walker import deep_walk_with_fallback
from app.splitter.sections import Section, split_markdown
from app.vector.qdrant_ops import VectorStore


OUTPUT_MD = "/tmp/stevenson-full-classify.md"
OUTPUT_JSON = "/tmp/stevenson-full-classify.json"


def _stream_gridfs_html(db, filename: str) -> bytes:
    """Read an entire GridFS file in one go. For 350MB, this allocates ~700MB
    in Python; acceptable on a dev machine."""
    fs_files = db["htmlContent.files"]
    fs_chunks = db["htmlContent.chunks"]

    file_doc = fs_files.find_one({"filename": filename})
    if not file_doc:
        raise RuntimeError(f"htmlContent file not found: {filename}")

    print(f"  → file id: {file_doc['_id']}, length: {file_doc.get('length',0)/1024/1024:.1f} MB")

    buf = io.BytesIO()
    for chunk in fs_chunks.find({"files_id": file_doc["_id"]}).sort("n", 1):
        buf.write(chunk["data"])
    return buf.getvalue()


_CSHSE_HEADING_RE = re.compile(
    r"^\s*(Standard\s+\d{1,2}(?:\s*[-–]\s*.+)?|Part\s+(?:I|II|III|IV|V)\b.*|Appendix\s+[A-Z0-9].*|Specifications?\s+for\s+Standard\s+\d{1,2}.*)$",
    re.IGNORECASE,
)
_LEADING_LETTER_RE = re.compile(r"^\s*([a-h])\s*[.)]\s+\S")


def _is_likely_heading(text: str) -> tuple[bool, int]:
    """Return (is_heading, suggested_level) for a paragraph text.

    Heuristics tuned to DOCX-flattened CSHSE self-studies:
      - "Standard N", "Part I/II", "Appendix A" → level 1 heading
      - "Specifications for Standard N" → level 2
      - "a. ...", "b. ..." subspec letter → level 3
      - Bold-only short text (~< 12 words) without trailing colon → level 2
    """
    t = text.strip()
    if not t or len(t.split()) > 25:
        return False, 0
    if _CSHSE_HEADING_RE.match(t):
        if t.lower().startswith("specifications for standard"):
            return True, 2
        return True, 1
    if _LEADING_LETTER_RE.match(t):
        return True, 3
    return False, 0


_BLOCK_CONTAINERS = {"table", "thead", "tbody", "tr", "td", "th", "li", "ul", "ol"}


def _is_inside_block_container(tag) -> bool:
    """Return True if any ancestor is a table cell / list item — those break
    markdownify's heading rendering (headings inside <td> become inline text)."""
    for anc in tag.parents:
        if anc.name in _BLOCK_CONTAINERS:
            return True
    return False


def _promote_docx_headings(soup: BeautifulSoup) -> None:
    """Promote <p><strong>X</strong></p> → <h1/h2/h3> when X looks heading-like.

    Only promotes paragraphs that are NOT inside table cells / list items —
    headings inside <td> don't survive markdownify conversion to ATX.
    """
    for p in list(soup.find_all("p")):
        if _is_inside_block_container(p):
            continue
        text = p.get_text().strip()
        if not text:
            continue
        is_h, lvl = _is_likely_heading(text)
        if is_h:
            new_tag = soup.new_tag(f"h{min(max(lvl, 1), 3)}")
            new_tag.string = text
            p.replace_with(new_tag)
            continue
        # Treat all-bold short paragraphs as h2 even if regex didn't match.
        strong = p.find_all("strong")
        if (
            strong
            and len(text.split()) <= 15
            and not text.endswith(":")
            and len(strong) == 1
            and strong[0].get_text().strip() == text
        ):
            new_tag = soup.new_tag("h2")
            new_tag.string = text
            p.replace_with(new_tag)


def _html_to_markdown(html_bytes: bytes) -> str:
    """Pre-clean and convert HTML to Markdown.

    Strips bulky head/script/style noise, drops extracted-section placeholders,
    and PROMOTES DOCX-flattened paragraph-style headings into real h1/h2/h3
    so the section splitter can find boundaries.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    for tag in soup(["script", "style", "head"]):
        tag.decompose()
    for tag in soup.find_all(class_="extracted-section-placeholder"):
        tag.decompose()
    _promote_docx_headings(soup)
    body = soup.body or soup
    md = markdownify(str(body), heading_style="ATX")
    return _collapse_blanks(md)


def _collapse_blanks(s: str) -> str:
    out: list[str] = []
    blanks = 0
    for line in s.split("\n"):
        if line.strip() == "":
            blanks += 1
            if blanks <= 2:
                out.append(line)
        else:
            blanks = 0
            out.append(line)
    return "\n".join(out)


def _recommend_one(matcher: SpecMatcher, section: Section) -> Recommendation:
    return matcher.recommend(section, program_level="bachelors")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--max-sections",
        type=int,
        default=None,
        help="Only process the first N sections (debug). Default: all.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=8,
        help="Parallel matcher calls. Default 8.",
    )
    parser.add_argument(
        "--min-words",
        type=int,
        default=30,
        help="Skip sections shorter than N words (TOC entries, headings). Default 30.",
    )
    args = parser.parse_args()

    mongo_url = os.environ["MONGO_DEV_URL"]
    qdrant_url = os.environ["QDRANT_URL"]
    qdrant_key = os.environ.get("QDRANT_API_KEY", "")
    openai_key = os.environ["OPENAI_API_KEY"]
    anthropic_key = os.environ["ANTHROPIC_API_KEY"]

    client = MongoClient(mongo_url)
    db = client.get_default_database()
    imp = db["selfstudyimports"].find_one({})
    assert imp, "no selfstudyimports in dev Mongo"

    print(f"📄 {imp['originalFilename']}")
    filename = f"{imp['_id']}.html"

    t0 = time.time()
    print("🌊 streaming GridFS HTML…")
    html = _stream_gridfs_html(db, filename)
    print(f"   {len(html)/1024/1024:.1f} MB read in {time.time()-t0:.1f}s")

    t0 = time.time()
    print("✂️  deep table walk (rowspan-aware, into <td>)…")
    raw_sections = deep_walk_with_fallback(html, base_id="stevenson")
    sections = [s for s in raw_sections if s.word_count >= args.min_words]
    print(
        f"   {len(raw_sections)} raw sections, {len(sections)} after min-words filter "
        f"({time.time()-t0:.1f}s)"
    )

    # Sanity: tier distribution
    tiers: dict[str, int] = {}
    for s in raw_sections:
        tiers[s.splitter_tier] = tiers.get(s.splitter_tier, 0) + 1
    print(f"   tier distribution: {tiers}")
    if args.max_sections:
        sections = sections[: args.max_sections]
        print(f"   capped at {len(sections)} for this run")

    print("🧠 bootstrapping spec cache…")
    test_collection = f"cshse_specs_full_{uuid.uuid4().hex[:8]}"
    store = VectorStore(qdrant_url, qdrant_key)
    embedder = EmbeddingClient(openai_key)
    counts = bootstrap_spec_cache(store, embedder, collection=test_collection)
    print(f"   embedded {counts.get('bachelors',0)} specs")

    matcher = SpecMatcher(
        store=store,
        embedder=embedder,
        anthropic_key=anthropic_key,
        specs_collection=test_collection,
    )

    print(f"🤖 classifying {len(sections)} sections (concurrency={args.concurrency})…")
    t0 = time.time()
    results: list[tuple[Section, Recommendation]] = []
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futures = {ex.submit(_recommend_one, matcher, s): s for s in sections}
        done = 0
        for fut in as_completed(futures):
            section = futures[fut]
            try:
                rec = fut.result()
            except Exception as exc:
                print(f"  ✗ {section.id}: {exc}")
                continue
            results.append((section, rec))
            done += 1
            if done % 10 == 0 or done == len(sections):
                print(f"   {done}/{len(sections)} ({time.time()-t0:.0f}s)")

    results.sort(key=lambda x: x[0].byte_offset_start)
    print(f"   ✓ {len(results)} classified in {time.time()-t0:.0f}s")

    # ---- Write JSON ----
    json_out = [
        {
            "section_id": s.id,
            "heading": s.heading,
            "wordCount": s.word_count,
            "byteOffsetStart": s.byte_offset_start,
            "byteOffsetEnd": s.byte_offset_end,
            "containsTable": s.contains_table,
            "splitterTier": s.splitter_tier,
            "primary_standard": r.primary_standard,
            "primary_spec": r.primary_spec,
            "primary_confidence": r.primary_confidence,
            "section_type": r.section_type,
            "accept_state": r.accept_state,
            "doc_letter": r.doc_letter,
            "doc_standard_hint": r.doc_standard_hint,
            "rationale": r.rationale,
            "alternates": r.alternates,
            "snippet": s.markdown[:800],
            "snippet_truncated": len(s.markdown) > 800,
        }
        for (s, r) in results
    ]
    with open(OUTPUT_JSON, "w") as f:
        json.dump(json_out, f, indent=2)
    print(f"📄 wrote {OUTPUT_JSON}")

    # ---- Write Markdown ----
    lines: list[str] = []
    out = lines.append

    by_type: dict[str, int] = {}
    by_state: dict[str, int] = {}
    by_spec: dict[str, int] = {}
    for _, r in results:
        by_type[r.section_type] = by_type.get(r.section_type, 0) + 1
        by_state[r.accept_state] = by_state.get(r.accept_state, 0) + 1
        if r.primary_standard and r.primary_spec:
            key = f"{r.primary_standard}.{r.primary_spec}"
            by_spec[key] = by_spec.get(key, 0) + 1

    out(f"# Stevenson Full-Document Classification")
    out("")
    out(f"**File:** {imp['originalFilename']}  ")
    out(f"**HTML size:** {len(html)/1024/1024:.1f} MB  ")
    out(f"**Sections classified:** {len(results)}  ")
    out("")
    out("## Section-type distribution")
    out("")
    for k in ["narrative_response", "supporting_evidence", "curriculum_matrix", "context", "unknown"]:
        out(f"- **{k}**: {by_type.get(k, 0)}")
    out("")
    out("## Accept-state distribution")
    out("")
    for k in ["auto_accept", "review_letter_disagrees", "review_low_confidence", "review_unknown"]:
        out(f"- **{k}**: {by_state.get(k, 0)}")
    out("")
    out("## Top current-spec assignments")
    out("")
    for k, v in sorted(by_spec.items(), key=lambda kv: -kv[1])[:30]:
        out(f"- `{k}`: {v} sections")
    out("")
    out("---")
    out("")
    out("## Every section, in document order")
    out("")

    for i, (s, r) in enumerate(results, 1):
        out(
            f"### [{i}] `{r.primary_standard or '?'}` . `{r.primary_spec or '?'}` "
            f"— {r.section_type} — `{r.accept_state}`"
        )
        out("")
        out(
            f"**Heading:** {s.heading[:140]}  "
            f"**Words:** {s.word_count}  "
            f"**Conf:** {r.primary_confidence:.2f}  "
            f"**Doc letter:** {r.doc_letter or '-'}  "
            f"**Doc std hint:** {r.doc_standard_hint or '-'}"
        )
        out("")
        out(f"_{r.rationale}_")
        out("")
        if r.alternates:
            out(
                "Alternates: "
                + ", ".join(
                    f"`{a['standardCode']}.{a['specCode']}` ({a['confidence']:.2f})"
                    for a in r.alternates
                )
            )
            out("")

    with open(OUTPUT_MD, "w") as f:
        f.write("\n".join(lines))
    print(f"📄 wrote {OUTPUT_MD}")

    # Summary to stdout
    print()
    print("=" * 60)
    print(f"📊 SUMMARY ({len(results)} sections)")
    print(f"   Section type:")
    for k in ["narrative_response", "supporting_evidence", "curriculum_matrix", "context", "unknown"]:
        print(f"     {k:25s} {by_type.get(k, 0)}")
    print(f"   Accept state:")
    for k in ["auto_accept", "review_letter_disagrees", "review_low_confidence", "review_unknown"]:
        print(f"     {k:25s} {by_state.get(k, 0)}")
    print(f"   Top spec assignments:")
    for k, v in sorted(by_spec.items(), key=lambda kv: -kv[1])[:10]:
        print(f"     {k:8s} {v} sections")


if __name__ == "__main__":
    main()
