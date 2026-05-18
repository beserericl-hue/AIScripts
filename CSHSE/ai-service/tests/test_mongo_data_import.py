"""Data-import test against the actual Stevenson University self-study in MongoDB.

Pulls every ``detectedSection`` from the dev CSHSE Mongo, runs each through the
splitter + matcher (mocked Claude so cost stays zero), and asserts pipeline
shape on real production-grade content (353 MB HTML, 11 manually-tagged
sections at time of writing).

This is the "data import test" the user asked for on 2026-05-16 — it verifies
the splitter and matcher don't choke on real long-form CSHSE narrative
content, and that the pipeline returns a sensible shape for every section.

Requires: ``MONGO_DEV_URL`` env var pointing at the dev CSHSE Mongo. Skipped
otherwise. Run via::

    MONGO_DEV_URL='mongodb://mongo:pw@host:port/CSHSE?authSource=admin' \\
    pytest tests/test_mongo_data_import.py -v -s
"""
from __future__ import annotations

import os
from unittest.mock import MagicMock

import pytest
from pymongo import MongoClient

from app.matcher.spec_matcher import SpecMatcher
from app.splitter.sections import Section, split_markdown
from app.vector.qdrant_ops import SearchHit


def _fake_store_for_match(expected_std: str, expected_spec: str):
    """Return a fake VectorStore whose Qdrant search always picks the
    ground-truth tag as #1 — lets us exercise the matcher's fallback path
    without paying Claude API cost."""
    store = MagicMock()
    store.search.return_value = [
        SearchHit(
            score=0.95,
            payload={
                "standardCode": expected_std,
                "specCode": expected_spec,
                "standardTitle": "Stub Title",
                "specText": "Stub spec text",
            },
        ),
        SearchHit(
            score=0.40,
            payload={
                "standardCode": "99",
                "specCode": "z",
                "standardTitle": "Other",
                "specText": "Other spec text",
            },
        ),
    ]
    return store


def _fake_embedder():
    e = MagicMock()
    e.embed_one.return_value = [0.0] * 1536
    return e


def _section_from_detected(detected: dict, idx: int) -> Section:
    body = (detected.get("fullContent") or detected.get("htmlContent") or "")
    heading = detected.get("headerText") or f"Section {idx}"
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


@pytest.fixture(scope="module")
def stevenson_import() -> dict:
    url = os.environ["MONGO_DEV_URL"]
    client = MongoClient(url)
    db = client.get_default_database()
    imp = db["selfstudyimports"].find_one({})
    assert imp is not None, "no selfstudyimports in dev Mongo"
    return imp


@pytest.mark.mongo
def test_stevenson_data_loads(stevenson_import):
    assert stevenson_import["originalFilename"].endswith(".docx")
    sections = stevenson_import.get("detectedSections") or []
    assert len(sections) > 0, "Stevenson import has no detectedSections"
    print(f"\n  Stevenson: {stevenson_import['originalFilename']}")
    print(f"  status: {stevenson_import['status']}")
    print(f"  detectedSections: {len(sections)}")
    htmlSize = (
        stevenson_import.get("extractedContent", {})
        .get("metadata", {})
        .get("htmlSize", 0)
    )
    print(f"  htmlSize: {htmlSize / 1024 / 1024:.1f} MB")


@pytest.mark.mongo
def test_splitter_handles_every_detected_section(stevenson_import):
    """The splitter must produce >=1 section for every body text we feed it."""
    sections = stevenson_import.get("detectedSections") or []
    sections_with_body = [s for s in sections if (s.get("fullContent") or "").strip()]
    assert sections_with_body, "no detectedSections had fullContent"

    for ds in sections_with_body:
        body = ds["fullContent"]
        out = split_markdown(body, doc_id=f"ds:{ds['id'][:8]}")
        assert out, f"splitter returned 0 sections for body of len {len(body)}"
        # Body must be representable — at minimum, semantic fallback always runs
        assert sum(s.word_count for s in out) > 0


@pytest.mark.mongo
def test_matcher_pipeline_on_stevenson_ground_truth(stevenson_import):
    """For every Stevenson section with a human-applied tag, run the matcher
    with a Qdrant stub that returns the ground-truth as top-1, no LLM key
    (forces embedding-only fallback), and verify the pipeline shape."""
    tagged = [
        s
        for s in (stevenson_import.get("detectedSections") or [])
        if s.get("standardCode")
        and s.get("fullContent")
        and len((s.get("fullContent") or "").strip()) > 100
    ]
    assert tagged, "no Stevenson sections with both standardCode and fullContent"

    correct = 0
    for idx, ds in enumerate(tagged):
        section = _section_from_detected(ds, idx)
        std = str(ds["standardCode"])
        spec = str(ds.get("specCode") or "a")
        store = _fake_store_for_match(std, spec)
        matcher = SpecMatcher(
            store=store,
            embedder=_fake_embedder(),
            anthropic_key="",  # no LLM => embedding-only fallback
        )
        rec = matcher.recommend(section, program_level="bachelors")

        # With our stub, the recommender should pick the stub's top-1
        # — this validates the candidate -> recommendation transformation
        # without paying for Claude.
        assert rec.primary_standard == std
        assert rec.primary_spec == spec
        assert 0.0 < rec.primary_confidence <= 1.0
        assert rec.candidates, "should expose top-K candidates for debugging"
        correct += 1
        print(
            f"\n  [{section.heading[:50]}] expected {std}.{spec} "
            f"primary={rec.primary_standard}.{rec.primary_spec} "
            f"conf={rec.primary_confidence:.2f}"
        )

    print(f"\n  ✓ pipeline shape valid for {correct} ground-truth sections")
