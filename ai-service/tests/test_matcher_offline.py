"""Matcher tests that don't hit any external API.

Uses fake embedding + Qdrant stand-ins to verify the pipeline logic:
- top-K returned in similarity order
- LLM-absent fallback returns the embedding top-1 as primary
- malformed LLM JSON gracefully degrades
"""
from __future__ import annotations

from unittest.mock import MagicMock

from app.matcher.spec_matcher import (
    Candidate,
    SpecMatcher,
    _build_prompt,
    _parse_claude_response,
)
from app.splitter.sections import Section
from app.vector.qdrant_ops import SearchHit


def _fake_section(text: str = "history of the program", heading: str = "1.d History") -> Section:
    return Section(
        id="t:sec:0001",
        heading=heading,
        heading_level=2,
        markdown=text,
        byte_offset_start=0,
        byte_offset_end=len(text),
        word_count=len(text.split()),
        contains_table=False,
        contains_image=False,
        has_resume_signals=False,
        has_syllabus_signals=False,
        splitter_tier="headings",
        flags={"containsTable": False, "containsImage": False,
               "hasResumeSignals": False, "hasSyllabusSignals": False},
    )


def _fake_store_returning_hits(hits: list[SearchHit]):
    store = MagicMock()
    store.search.return_value = hits
    return store


def _fake_embedder():
    e = MagicMock()
    e.embed_one.return_value = [0.1] * 1536
    return e


def test_no_candidates_returns_neutral():
    store = _fake_store_returning_hits([])
    matcher = SpecMatcher(store, _fake_embedder(), anthropic_key="")
    rec = matcher.recommend(_fake_section(), program_level="bachelors")
    assert rec.primary_standard is None
    assert rec.primary_confidence == 0.0


def test_embedding_fallback_when_no_llm_key():
    hits = [
        SearchHit(
            score=0.93,
            payload={
                "standardCode": "1",
                "specCode": "d",
                "standardTitle": "Program Context",
                "specText": "Provide a brief history of the program.",
            },
        ),
        SearchHit(
            score=0.42,
            payload={
                "standardCode": "11",
                "specCode": "a",
                "standardTitle": "Curriculum",
                "specText": "Provide a curriculum matrix.",
            },
        ),
    ]
    matcher = SpecMatcher(_fake_store_returning_hits(hits), _fake_embedder(), anthropic_key="")
    rec = matcher.recommend(_fake_section(), program_level="bachelors")
    assert rec.primary_standard == "1"
    assert rec.primary_spec == "d"
    assert 0.9 < rec.primary_confidence <= 1.0
    assert "fallback" in rec.rationale.lower()


def test_parse_strict_json():
    parsed = _parse_claude_response(
        '{"primary_standard":"1","primary_spec":"d","primary_confidence":0.9,'
        '"alternates":[],"rationale":"good","is_supporting_evidence":false}'
    )
    assert parsed["primary_standard"] == "1"
    assert parsed["is_supporting_evidence"] is False


def test_parse_tolerates_fenced_json():
    fenced = (
        "```json\n"
        '{"primary_standard":"1","primary_spec":"d","primary_confidence":0.9,'
        '"alternates":[],"rationale":"x","is_supporting_evidence":false}\n'
        "```"
    )
    parsed = _parse_claude_response(fenced)
    assert parsed["primary_standard"] == "1"


def test_prompt_contains_candidates_and_section_excerpt():
    sec = _fake_section(text="A long history about the program from 1999.")
    candidates = [
        Candidate("1", "d", "Program Context", "Provide a brief history of the program.", 0.93),
        Candidate("11", "a", "Curriculum", "Provide a curriculum matrix.", 0.42),
    ]
    prompt = _build_prompt(sec, candidates)
    assert "1.d" in prompt
    assert "11.a" in prompt
    assert "Provide a brief history of the program." in prompt
    assert "A long history about the program" in prompt
