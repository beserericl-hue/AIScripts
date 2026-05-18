"""Per-spec coverage review.

After narrative + supporting-evidence sections have been mapped to a spec,
ask Claude whether the combined material actually addresses the spec's
prompt. Surface specific gaps to the user.

Output per spec:
  - `is_covered`: boolean — Claude's overall verdict
  - `coverage_score`: 0.0-1.0 confidence the spec is fully addressed
  - `gaps`: list of specific things missing
  - `strengths`: list of what's well-addressed
  - `suggestion`: 1-2 sentence summary
"""
from __future__ import annotations

import json
import random
import re
import time
from dataclasses import dataclass
from typing import Optional

from anthropic import Anthropic, APIStatusError, InternalServerError, RateLimitError

from app.standards.loader import Specification

DEFAULT_MODEL = "claude-haiku-4-5"
CONTENT_CHAR_LIMIT = 8000  # cap total content sent per spec to control cost
MAX_TOKENS = 600

_RETRYABLE_STATUSES = {429, 500, 502, 503, 504, 529}
_MAX_RETRIES = 5


@dataclass
class CoverageReview:
    standard_code: str
    spec_code: str
    is_covered: bool
    coverage_score: float
    gaps: list[str]
    strengths: list[str]
    suggestion: str
    raw_response: str  # for debugging


def _build_prompt(
    spec: Specification,
    narrative_text: str,
    evidence_items: list[tuple[str, str]],  # [(title, body)]
) -> str:
    parts = [
        "You are an experienced CSHSE accreditation reviewer evaluating whether",
        "a self-study's narrative + supporting evidence adequately addresses ONE",
        "specific Specification from the 2025 CSHSE Baccalaureate Handbook.",
        "",
        f"SPECIFICATION {spec.standard_code}.{spec.spec_code} ({spec.standard_title}):",
        f"  {spec.spec_text}",
        "",
        "=== NARRATIVE RESPONSE ===",
        narrative_text[:CONTENT_CHAR_LIMIT] if narrative_text else "(none provided)",
        "",
    ]
    if evidence_items:
        parts.append("=== SUPPORTING EVIDENCE ITEMS ===")
        budget = CONTENT_CHAR_LIMIT
        for i, (title, body) in enumerate(evidence_items, 1):
            allowed = max(200, budget // max(1, len(evidence_items) - i + 1))
            ex = body[:allowed]
            parts.append(f"\n[Evidence {i}: {title[:80]}]")
            parts.append(ex)
            budget -= len(ex)
    else:
        parts.append("=== SUPPORTING EVIDENCE ===")
        parts.append("(none provided)")

    parts.extend([
        "",
        "Evaluate: does the combined narrative + supporting evidence above",
        "adequately address the Specification's prompt? Identify SPECIFIC gaps",
        "(elements of the prompt that aren't covered) and strengths (elements",
        "that are well-addressed). Be concrete — cite what's present or missing.",
        "",
        "Respond with STRICT JSON only (no prose, no markdown fences):",
        "{",
        '  "is_covered": boolean,',
        '  "coverage_score": float 0.0-1.0,',
        '  "gaps": [string, string, ...],',
        '  "strengths": [string, string, ...],',
        '  "suggestion": "1-2 sentence summary for the coordinator"',
        "}",
    ])
    return "\n".join(parts)


def _parse(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].lstrip("\n").lstrip()
    return json.loads(cleaned)


class CoverageReviewer:
    def __init__(self, anthropic_key: str, model: str = DEFAULT_MODEL):
        if not anthropic_key:
            raise ValueError("ANTHROPIC_API_KEY required")
        self._client = Anthropic(api_key=anthropic_key)
        self._model = model

    def _call_with_retry(self, prompt: str):
        """Backoff wrapper so transient 529/429/503 don't kill long batches."""
        delay = 1.0
        last_exc: Exception | None = None
        for _ in range(_MAX_RETRIES):
            try:
                return self._client.messages.create(
                    model=self._model,
                    max_tokens=MAX_TOKENS,
                    messages=[{"role": "user", "content": prompt}],
                )
            except (InternalServerError, RateLimitError) as exc:
                last_exc = exc
            except APIStatusError as exc:
                if exc.status_code not in _RETRYABLE_STATUSES:
                    raise
                last_exc = exc
            time.sleep(delay + random.uniform(0, 0.5))
            delay = min(delay * 2, 30.0)
        assert last_exc is not None
        raise last_exc

    def review(
        self,
        spec: Specification,
        narrative_text: str,
        evidence_items: Optional[list[tuple[str, str]]] = None,
    ) -> CoverageReview:
        evidence_items = evidence_items or []
        prompt = _build_prompt(spec, narrative_text, evidence_items)
        try:
            msg = self._call_with_retry(prompt)
        except Exception as exc:
            # Persistent failure — surface a non-empty CoverageReview so the
            # caller doesn't crash on a long batch and the user sees the error.
            return CoverageReview(
                standard_code=spec.standard_code,
                spec_code=spec.spec_code,
                is_covered=False,
                coverage_score=0.0,
                gaps=[f"coverage reviewer API error: {type(exc).__name__}"],
                strengths=[],
                suggestion="",
                raw_response="",
            )
        raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        try:
            parsed = _parse(raw)
        except json.JSONDecodeError:
            return CoverageReview(
                standard_code=spec.standard_code,
                spec_code=spec.spec_code,
                is_covered=False,
                coverage_score=0.0,
                gaps=["LLM returned non-JSON response"],
                strengths=[],
                suggestion=f"Raw response (truncated): {raw[:300]}",
                raw_response=raw,
            )

        return CoverageReview(
            standard_code=spec.standard_code,
            spec_code=spec.spec_code,
            is_covered=bool(parsed.get("is_covered", False)),
            coverage_score=float(parsed.get("coverage_score", 0.0)),
            gaps=list(parsed.get("gaps", [])),
            strengths=list(parsed.get("strengths", [])),
            suggestion=str(parsed.get("suggestion", "")),
            raw_response=raw,
        )
