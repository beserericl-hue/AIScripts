"""Infer a subspec (e.g. "a", "b", "c") for a curriculum-matrix row when
the data extractor knew the standard but couldn't pin the subspec.

The extractor's `_best_template_match` only matches against rows in the
CSHSE template DOCX. When an institution rewrites a row's prompt enough
that no template row is a clean match, the extractor either drops the row
or matches at the standard level only — leaving spec_code=None which the
wizard UI renders as "Spec 12.?".

This module asks Claude Haiku: given a list of CSHSE Handbook
specifications for a known standard, which subspec best matches this row?
Returns a `RowSpecSuggestion` (suggested_spec + confidence + rationale).

Per-institution Qdrant context (cshse_matrix_context_{env}) is consulted
as a soft hint when available — surrounding paragraphs sometimes name the
subspec letter explicitly.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, asdict
from typing import Any

from anthropic import Anthropic

from app.config import Settings, get_settings
from app.standards.loader import Specification, load_specifications


# ----------------------------------------------------------------- types


@dataclass
class RowSpecSuggestion:
    suggested_spec: str | None  # "a", "b", … or None if no signal
    confidence: float            # 0.0 to 1.0
    rationale: str
    candidate_specs: list[dict[str, str]]  # what we showed the model

    def to_dict(self) -> dict[str, Any]:
        return {
            "suggestedSpec": self.suggested_spec,
            "confidence": round(self.confidence, 3),
            "rationale": self.rationale,
            "candidateSpecs": self.candidate_specs,
        }


# ----------------------------------------------------------------- helpers


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)


def _parse_response(text: str) -> dict[str, Any]:
    raw = text.strip()
    fence = _JSON_FENCE_RE.search(raw)
    if fence:
        raw = fence.group(1).strip()
    return json.loads(raw)


def _specs_for_standard(
    specs: list[Specification], standard_code: str
) -> list[Specification]:
    return [s for s in specs if s.standard_code == standard_code]


def _build_prompt(
    *,
    row_prompt: str,
    standard_code: str,
    candidates: list[Specification],
    surrounding_context: str,
) -> str:
    cands_block = "\n".join(
        f"  {s.spec_code}) {s.spec_text}" for s in candidates
    )
    context_block = (
        f"Surrounding narrative paragraphs from the same document "
        f"(may help disambiguate):\n```\n{surrounding_context[:3000]}\n```\n"
        if surrounding_context.strip()
        else ""
    )

    return f"""You are mapping a row from a CSHSE curriculum matrix to its subspec.

The row's prompt is:
```
{row_prompt[:1500]}
```

This row belongs to Standard {standard_code}. The candidate subspecs for Standard {standard_code} from the CSHSE Handbook are:

{cands_block}

{context_block}

Pick the ONE subspec whose definition best matches the row's prompt. Output strict JSON with this exact shape:
{{
  "suggestedSpec": "a",
  "confidence": 0.92,
  "rationale": "The row's mention of 'analyzing policies and laws' aligns with subspec X which defines policy analysis as the core skill."
}}

Rules:
  - "suggestedSpec" must be one of: {", ".join(s.spec_code for s in candidates)}.
  - If none of the candidates is a reasonable match, return suggestedSpec=null with confidence=0.0 and a one-sentence rationale ("no signal").
  - Confidence is your subjective probability, 0.0 to 1.0.
  - Output ONLY the JSON, no surrounding text.
"""


# ----------------------------------------------------------------- public api


def infer_row_spec(
    *,
    row_prompt: str,
    standard_code: str,
    program_level: str,
    surrounding_context: str = "",
    anthropic_client: Anthropic | None = None,
    settings: Settings | None = None,
) -> RowSpecSuggestion:
    """Ask Haiku to pick the best subspec for a row whose standard is known."""
    settings = settings or get_settings()

    # Load the CSHSE Handbook specs and filter to this standard.
    all_specs = load_specifications(program_level)  # type: ignore[arg-type]
    candidates = _specs_for_standard(all_specs, standard_code)

    candidate_dicts = [
        {"code": s.spec_code, "text": s.spec_text}
        for s in candidates
    ]

    if not candidates:
        # No Handbook coverage for this standard at this program level —
        # nothing to infer against. Return null so the UI falls back to
        # manual entry.
        return RowSpecSuggestion(
            suggested_spec=None,
            confidence=0.0,
            rationale=(
                f"No Handbook specs available for Standard {standard_code} "
                f"at program level {program_level}."
            ),
            candidate_specs=candidate_dicts,
        )

    if anthropic_client is None:
        if not settings.anthropic_api_key:
            return RowSpecSuggestion(
                suggested_spec=None,
                confidence=0.0,
                rationale="anthropic-api-key missing; cannot infer",
                candidate_specs=candidate_dicts,
            )
        anthropic_client = Anthropic(
            api_key=settings.anthropic_api_key,
            timeout=30.0,
            max_retries=0,
        )

    prompt = _build_prompt(
        row_prompt=row_prompt,
        standard_code=standard_code,
        candidates=candidates,
        surrounding_context=surrounding_context,
    )

    try:
        msg = anthropic_client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
        parsed = _parse_response(text)
    except Exception as exc:  # noqa: BLE001
        return RowSpecSuggestion(
            suggested_spec=None,
            confidence=0.0,
            rationale=f"inference failed: {type(exc).__name__}: {exc}",
            candidate_specs=candidate_dicts,
        )

    suggested = parsed.get("suggestedSpec")
    if isinstance(suggested, str):
        suggested = suggested.strip() or None
    # Defence: model must return one of our candidate codes; otherwise nullify
    # so the client UI doesn't silently accept a hallucinated spec.
    valid_codes = {s.spec_code for s in candidates}
    if suggested not in valid_codes:
        suggested = None

    conf = float(parsed.get("confidence") or 0.0)
    conf = max(0.0, min(1.0, conf))
    rationale = str(parsed.get("rationale") or "")

    return RowSpecSuggestion(
        suggested_spec=suggested,
        confidence=conf,
        rationale=rationale,
        candidate_specs=candidate_dicts,
    )
