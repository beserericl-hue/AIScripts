"""CR-030 — pin matrix row→subspec inference behaviour."""
from __future__ import annotations

from unittest.mock import MagicMock

from app.config import Settings
from app.matrix.row_spec_inference import (
    RowSpecSuggestion,
    _parse_response,
    infer_row_spec,
)


def test_parse_response_handles_fenced_json():
    raw = """Sure! Here you go:
```json
{
  "suggestedSpec": "b",
  "confidence": 0.91,
  "rationale": "matches the policy-analysis language"
}
```
"""
    parsed = _parse_response(raw)
    assert parsed["suggestedSpec"] == "b"
    assert parsed["confidence"] == 0.91


def test_returns_null_when_no_anthropic_key():
    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="",
        openai_api_key="sk-fake",
    )
    result = infer_row_spec(
        row_prompt="The historical roots of human services.",
        standard_code="11",
        program_level="bachelors",
        anthropic_client=None,
        settings=settings,
    )
    assert result.suggested_spec is None
    assert result.confidence == 0.0
    assert "anthropic-api-key missing" in result.rationale


def test_returns_null_when_standard_has_no_handbook_specs():
    """Associate/Master's currently return [] from load_specifications. The
    endpoint shouldn't blow up — it should return a clean null result."""
    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="sk-fake",
        openai_api_key="sk-fake",
    )
    result = infer_row_spec(
        row_prompt="Some prompt",
        standard_code="99",  # nonexistent standard
        program_level="associate",  # currently returns []
        anthropic_client=MagicMock(),
        settings=settings,
    )
    assert result.suggested_spec is None
    assert "No Handbook specs available" in result.rationale


def test_returns_suggested_spec_when_haiku_picks_a_valid_code():
    """Mock Haiku response — verify the suggested code is accepted when
    it matches one of the candidate spec codes."""
    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="sk-fake",
        openai_api_key="sk-fake",
    )
    fake_msg = MagicMock()
    block = MagicMock()
    block.type = "text"
    block.text = (
        '{"suggestedSpec":"a","confidence":0.95,'
        '"rationale":"institutional sponsoring + accreditation status"}'
    )
    fake_msg.content = [block]
    anthropic_client = MagicMock()
    anthropic_client.messages.create.return_value = fake_msg

    result = infer_row_spec(
        row_prompt=(
            "Provide the name and location of the institution and its "
            "accreditation status."
        ),
        standard_code="1",
        program_level="bachelors",
        anthropic_client=anthropic_client,
        settings=settings,
    )
    assert result.suggested_spec == "a"
    assert result.confidence == 0.95
    assert "institutional sponsoring" in result.rationale


def test_rejects_hallucinated_spec_codes():
    """If Haiku returns a spec code not in the candidate list, we must
    nullify it so the client doesn't silently accept a hallucinated
    placement."""
    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="sk-fake",
        openai_api_key="sk-fake",
    )
    fake_msg = MagicMock()
    block = MagicMock()
    block.type = "text"
    block.text = '{"suggestedSpec":"z","confidence":0.99,"rationale":"hallucinated"}'
    fake_msg.content = [block]
    anthropic_client = MagicMock()
    anthropic_client.messages.create.return_value = fake_msg

    result = infer_row_spec(
        row_prompt="Anything",
        standard_code="1",
        program_level="bachelors",
        anthropic_client=anthropic_client,
        settings=settings,
    )
    assert result.suggested_spec is None
    # Confidence preserved for diagnostics but suggested_spec nullified
    # so the UI can show "no signal" rather than "z (99%)".


def test_clamps_confidence_to_unit_interval():
    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="sk-fake",
        openai_api_key="sk-fake",
    )
    fake_msg = MagicMock()
    block = MagicMock()
    block.type = "text"
    block.text = '{"suggestedSpec":"a","confidence":2.5,"rationale":""}'
    fake_msg.content = [block]
    anthropic_client = MagicMock()
    anthropic_client.messages.create.return_value = fake_msg

    result = infer_row_spec(
        row_prompt="x",
        standard_code="1",
        program_level="bachelors",
        anthropic_client=anthropic_client,
        settings=settings,
    )
    assert result.confidence == 1.0


def test_handles_inference_exception_gracefully():
    """Anthropic call raises — module must NOT propagate, must return
    a clean null result with the error in the rationale for diagnostics."""
    settings = Settings(
        cshse_env="dev",
        qdrant_url="http://example.invalid",
        anthropic_api_key="sk-fake",
        openai_api_key="sk-fake",
    )
    anthropic_client = MagicMock()
    anthropic_client.messages.create.side_effect = RuntimeError("connection reset")

    result = infer_row_spec(
        row_prompt="x",
        standard_code="1",
        program_level="bachelors",
        anthropic_client=anthropic_client,
        settings=settings,
    )
    assert result.suggested_spec is None
    assert "inference failed" in result.rationale
    assert "RuntimeError" in result.rationale
