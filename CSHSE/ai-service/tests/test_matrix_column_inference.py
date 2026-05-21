"""Unit tests for CR-025 matrix column inference.

Smoke-coverage focused: prompt building, response parsing, and the
no-anthropic-key graceful fallback. Live Haiku calls are exercised by
the integration smoke script.
"""
from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.matrix.column_inference import (
    ColumnSuggestion,
    InferenceResult,
    _course_candidates_from_html,
    _build_inference_prompt,
    _parse_response,
    infer_columns,
)


def test_course_candidates_picks_up_codes_inside_table_html():
    html = """
      <table>
        <thead>
          <tr><th>CHS 105 — Human Services</th><th>CHS 224 — Research</th><th>CHS 380</th></tr>
        </thead>
        <tbody>
          <tr><td>I,KM</td><td>T,L</td><td>K,M</td></tr>
        </tbody>
      </table>
    """
    out = _course_candidates_from_html(html)
    assert out[:3] == ["CHS 105", "CHS 224", "CHS 380"]


def test_course_candidates_dedupes_in_first_seen_order():
    html = "<p>CHS 105 then CHS 224 then CHS 105 again then CHS 380</p>"
    assert _course_candidates_from_html(html) == ["CHS 105", "CHS 224", "CHS 380"]


def test_prompt_includes_known_courses_and_rag_block():
    prompt = _build_inference_prompt(
        raw_table_html="<table></table>",
        column_count=3,
        surrounding_context="The course CHS 105 covers policy.",
        known_courses=["CHS 105", "CHS 224"],
        rag_examples=[
            {"columnIndex": 0, "course": "CHS 105", "matrixSlug": "matrix-hsr", "priorConfidence": 0.95},
        ],
    )
    assert "CHS 105" in prompt
    assert "CHS 224" in prompt
    assert "Previously-confirmed column" in prompt
    # Column count is rendered as 0..N-1
    assert "0 to 2" in prompt


def test_prompt_includes_no_prior_when_known_courses_empty():
    prompt = _build_inference_prompt(
        raw_table_html="<table></table>",
        column_count=1,
        surrounding_context="",
        known_courses=[],
        rag_examples=[],
    )
    assert "No prior catalog entries" in prompt


def test_parse_response_handles_fenced_json():
    raw = """Here's the answer:
```json
{
  "suggestions": [
    {"columnIndex": 0, "suggestedCourse": "CHS 105", "confidence": 0.9, "rationale": "merged cell"},
    {"columnIndex": 1, "suggestedCourse": null, "confidence": 0.0, "rationale": "no signal"}
  ]
}
```
"""
    parsed = _parse_response(raw)
    assert len(parsed) == 2
    assert parsed[0].suggested_course == "CHS 105"
    assert parsed[1].suggested_course is None
    assert parsed[1].confidence == 0.0


def test_parse_response_clamps_confidence_to_unit_interval():
    raw = '{"suggestions":[{"columnIndex":0,"suggestedCourse":"X","confidence":2.5,"rationale":""}]}'
    parsed = _parse_response(raw)
    assert parsed[0].confidence == 1.0

    raw_neg = '{"suggestions":[{"columnIndex":0,"suggestedCourse":"X","confidence":-0.5,"rationale":""}]}'
    parsed_neg = _parse_response(raw_neg)
    assert parsed_neg[0].confidence == 0.0


def test_inference_result_to_dict_shape():
    result = InferenceResult(
        matrix_slug="matrix-hsr",
        suggestions=[
            ColumnSuggestion(0, "CHS 105", 0.9, "ok"),
            ColumnSuggestion(1, None, 0.0, "no signal"),
        ],
    )
    d = result.to_dict()
    assert d["matrixSlug"] == "matrix-hsr"
    assert d["suggestions"][0]["suggestedCourse"] == "CHS 105"
    assert d["suggestions"][0]["confidence"] == 0.9
    assert d["suggestions"][1]["suggestedCourse"] is None


def test_infer_columns_returns_padded_empty_when_no_anthropic_key(monkeypatch):
    """No API key → return one empty suggestion per column, no crash.

    This is the smoke-test path the client uses: if cshse-ai is configured
    without an Anthropic key (CI run, sandboxed dev), the wizard should
    fall back to the legacy free-text inputs rather than 500.
    """
    from app.config import Settings

    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="",
        openai_api_key="sk-fake",
    )
    result = infer_columns(
        matrix_slug="matrix-hsr",
        raw_table_html="<table><tr><td>x</td></tr></table>",
        column_count=3,
        institution_id=None,  # no RAG hits, no leaks
        program_level="bachelors",
        surrounding_context="",
        embedder=None,
        store=None,
        anthropic_client=None,
        settings=settings,
    )
    assert len(result.suggestions) == 3
    assert all(s.suggested_course is None for s in result.suggestions)
    assert all(s.confidence == 0.0 for s in result.suggestions)
    assert all("anthropic-api-key missing" in s.rationale for s in result.suggestions)


def test_infer_columns_pads_response_to_full_column_count():
    """Haiku might return fewer suggestions than columns. We pad so the
    client gets a 1:1 mapping between dropdown slots and suggestions."""
    from app.config import Settings

    # Mock Anthropic client returning only 2 suggestions for a 4-column request.
    fake_msg = MagicMock()
    block = MagicMock()
    block.type = "text"
    block.text = (
        '{"suggestions":['
        '{"columnIndex":0,"suggestedCourse":"CHS 105","confidence":0.9,"rationale":"ok"},'
        '{"columnIndex":1,"suggestedCourse":"CHS 224","confidence":0.8,"rationale":"ok"}'
        ']}'
    )
    fake_msg.content = [block]
    anthropic_client = MagicMock()
    anthropic_client.messages.create.return_value = fake_msg

    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="sk-fake",
        openai_api_key="sk-fake",
    )
    result = infer_columns(
        matrix_slug="matrix-hsr",
        raw_table_html="<table><tr><td>CHS 105</td></tr></table>",
        column_count=4,
        institution_id=None,
        program_level="bachelors",
        anthropic_client=anthropic_client,
        store=None,
        embedder=None,
        settings=settings,
    )
    assert len(result.suggestions) == 4
    assert result.suggestions[0].suggested_course == "CHS 105"
    assert result.suggestions[1].suggested_course == "CHS 224"
    assert result.suggestions[2].suggested_course is None
    assert result.suggestions[3].suggested_course is None
    assert result.suggestions[2].rationale == "no signal"
