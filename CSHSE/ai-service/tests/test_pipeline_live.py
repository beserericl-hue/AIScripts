"""End-to-end pipeline test against the Stevenson fixture.

Bootstraps ``cshse_specs`` in Qdrant, embeds each Stevenson section, runs the
matcher, and verifies that the AI's primary recommendation matches the
ground-truth tag for at least 4/5 sections.

Requires: OPENAI_API_KEY, ANTHROPIC_API_KEY, QDRANT_URL, QDRANT_API_KEY.
Skipped automatically when those env vars aren't set (see conftest.py).
"""
from __future__ import annotations

import os
import uuid

import pytest

from app.embeddings.openai_client import EmbeddingClient
from app.embeddings.spec_cache import bootstrap_spec_cache
from app.matcher.spec_matcher import SpecMatcher
from app.splitter.sections import Section
from app.vector.qdrant_ops import VectorStore


def _section_from(fixture: dict) -> Section:
    body = fixture["body"]
    return Section(
        id=f"stevenson:sec:{uuid.uuid4().hex[:8]}",
        heading=fixture["heading"],
        heading_level=2,
        markdown=body,
        byte_offset_start=0,
        byte_offset_end=len(body),
        word_count=len(body.split()),
        contains_table=False,
        contains_image=False,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="headings",
        flags={
            "containsTable": False,
            "containsImage": False,
            "hasResumeSignals": False,
            "hasSyllabusSignals": False,
        },
    )


@pytest.mark.live
def test_matcher_picks_correct_spec_for_stevenson_sections(stevenson_tagged_sections):
    qdrant_url = os.environ["QDRANT_URL"]
    qdrant_key = os.environ.get("QDRANT_API_KEY", "")
    openai_key = os.environ["OPENAI_API_KEY"]
    anthropic_key = os.environ["ANTHROPIC_API_KEY"]

    # Isolated collection so test runs don't stomp on the shared cache.
    test_collection = f"cshse_specs_test_{uuid.uuid4().hex[:8]}"

    store = VectorStore(qdrant_url, qdrant_key)
    embedder = EmbeddingClient(openai_key)

    bootstrap_spec_cache(store, embedder, collection=test_collection)

    matcher = SpecMatcher(
        store=store,
        embedder=embedder,
        anthropic_key=anthropic_key,
        specs_collection=test_collection,
    )

    hits = 0
    for fixture in stevenson_tagged_sections:
        section = _section_from(fixture)
        rec = matcher.recommend(section, program_level="bachelors")
        expected_std, expected_spec = fixture["expected"]
        got = (rec.primary_standard, rec.primary_spec)
        print(
            f"\n  [{fixture['heading'][:40]}] expected {expected_std}.{expected_spec} "
            f"got {rec.primary_standard}.{rec.primary_spec} conf={rec.primary_confidence:.2f}"
        )
        print(f"    rationale: {rec.rationale[:200]}")
        if got == (expected_std, expected_spec):
            hits += 1

    # Acceptance: 4/5 correct primary picks (the heuristic for "AI matcher beats
    # naive top-1" given the small candidate set; tighten when full Handbook is
    # loaded in spec_cache).
    assert hits >= 4, f"only {hits}/5 sections matched correctly"
