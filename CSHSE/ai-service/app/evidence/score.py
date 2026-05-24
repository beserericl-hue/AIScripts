"""CR-018 Phase 2 — Evidence-vs-spec scoring via Claude Haiku.

Takes a spec + a list of candidate evidence chunks (returned from
:mod:`app.evidence.recommend` or supplied by the caller) and asks
Claude to score how well the evidence supports the spec.

Output:
    {
      "confidence": 0.0..1.0,
      "rationale": "short paragraph",
      "citations": [{"chunkId": "...", "matrixRowAnchor": "..."}],
    }

The score endpoint is the most expensive of the three so it ships
with a generous budget cap (~2k input tokens) and a fail-soft fallback
(if Claude returns malformed JSON, return ``confidence=0.0`` rather
than crash the caller).
"""
from __future__ import annotations

import json
import re
from typing import Any

from anthropic import Anthropic

from app.config import Settings, get_settings


_HAIKU_MODEL = "claude-3-5-haiku-latest"
_MAX_INPUT_CHARS = 8000  # ~2k tokens
_MAX_TOKENS_OUT = 600


def _build_prompt(
    standard_code: str,
    spec_code: str,
    candidate_chunks: list[dict],
    matrix_rows: list[dict] | None,
) -> str:
    chunks_block = "\n\n".join(
        [
            f"<chunk id={c.get('chunkId') or i}>\n"
            f"{(c.get('text') or c.get('payload', {}).get('chunkText') or '')[:1500]}\n"
            f"</chunk>"
            for i, c in enumerate(candidate_chunks)
        ]
    )
    matrix_block = ""
    if matrix_rows:
        matrix_block = "\n\n<matrix>\n" + "\n".join(
            [
                f"row {r.get('rowAnchor') or ''}: {json.dumps(r)[:300]}"
                for r in matrix_rows
            ]
        ) + "\n</matrix>"
    return (
        "You are auditing a self-study submission for the CSHSE accreditation board.\n\n"
        f"Spec: Standard {standard_code}.{spec_code}\n\n"
        f"Candidate evidence chunks:\n{chunks_block}{matrix_block}\n\n"
        "On a scale of 0.0 to 1.0, how strongly do these chunks support the spec? "
        "Reply with STRICT JSON:\n"
        '{"confidence": <float>, "rationale": "<short paragraph>", '
        '"citations": [{"chunkId": "..."}]}'
    )


def _parse_response(raw: str) -> dict:
    """Strict-then-loose JSON parse with a safe default."""
    if not raw:
        return {"confidence": 0.0, "rationale": "empty response", "citations": []}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Look for the first {...} block.
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return {
                "confidence": 0.0,
                "rationale": "could not parse model response",
                "citations": [],
            }
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            return {
                "confidence": 0.0,
                "rationale": "malformed JSON in model response",
                "citations": [],
            }


def score_evidence(
    *,
    institution_id: str,
    submission_id: str,
    standard_code: str,
    spec_code: str,
    candidate_chunks: list[dict],
    matrix_rows: list[dict] | None = None,
    anthropic: Anthropic | None = None,
    settings: Settings | None = None,
) -> dict:
    """Score a set of evidence chunks against a spec.

    Returns the parsed JSON shape from the prompt.
    """
    settings = settings or get_settings()
    if not institution_id:
        raise ValueError("institution_id is required")
    if not candidate_chunks:
        return {
            "confidence": 0.0,
            "rationale": "no candidate chunks supplied",
            "citations": [],
        }

    prompt = _build_prompt(standard_code, spec_code, candidate_chunks, matrix_rows)
    if len(prompt) > _MAX_INPUT_CHARS:
        prompt = prompt[:_MAX_INPUT_CHARS]

    client = anthropic or (Anthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None)
    if client is None:
        # Graceful degradation — no key configured.
        return {
            "confidence": 0.0,
            "rationale": "ANTHROPIC_API_KEY not set; scoring degraded",
            "citations": [],
        }

    msg = client.messages.create(
        model=_HAIKU_MODEL,
        max_tokens=_MAX_TOKENS_OUT,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = "".join(b.text for b in msg.content if getattr(b, "text", None))
    parsed = _parse_response(raw)
    # Clamp confidence to [0, 1] in case the model returns out-of-range.
    conf = parsed.get("confidence", 0.0)
    try:
        conf = max(0.0, min(1.0, float(conf)))
    except (TypeError, ValueError):
        conf = 0.0
    parsed["confidence"] = conf
    parsed.setdefault("rationale", "")
    parsed.setdefault("citations", [])
    return parsed
