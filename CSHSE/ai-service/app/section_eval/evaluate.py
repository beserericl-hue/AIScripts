"""CR-049 — section evaluation against the reader-review criteria.

For each spec, compose the section's narrative + supporting-evidence text +
submitted file references + scraped web-link text, and ask Claude Haiku to
judge it against the spec's CSHSE rubric criteria. Returns a verdict
(pass / needs_improvement / fail) + rationale + per-criterion coverage +
PC-facing improvement suggestions.

Mirrors :mod:`app.evidence.score`: injectable Anthropic client, strict-then-
loose JSON parse, fail-soft defaults (never crash the caller).

The verdict maps to the 4-level reader rubric so the reader report can
consume it: pass ≈ Largely/Fully, needs_improvement ≈ Partial, fail ≈ Non.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any, Callable, Optional

from anthropic import Anthropic

from app.config import Settings, get_settings
from app.section_eval.scrape import scrape_link, MAX_TEXT_CHARS

_HAIKU_MODEL = "claude-haiku-4-5"
# Headroom so the assembled prompt (narrative ≤6k + bounded evidence ≤9k +
# rubric + the trailing STRICT-JSON instructions) is never truncated. The old
# 12k ceiling cut the JSON instructions once evidence carried real text, which
# made the model emit non-JSON ("could not parse model response"). claude-haiku
# has a 200k context, so 40k chars (~10k tokens) is comfortable. 2026-06-08.
_MAX_INPUT_CHARS = 40000
_MAX_TOKENS_OUT = 1500  # headroom so an evidence-rich reply isn't truncated mid-JSON

_VALID_VERDICTS = {"pass", "needs_improvement", "fail"}


def _build_prompt(
    *,
    standard_code: str,
    spec_code: str,
    criteria: str,
    narrative: str,
    evidence_texts: list[str],
    files: list[dict],
    link_results: list[dict],
    correction_hints: str = "",
) -> str:
    # Bound the evidence block to a fixed char budget so it can never push the
    # JSON-format instructions (built at the END of this prompt) past
    # _MAX_INPUT_CHARS, which would truncate them and make the model emit
    # non-JSON ("could not parse model response"). 2026-06-08.
    _EV_ITEM_CAP = 800
    _EV_BLOCK_BUDGET = 9000
    _ev_lines: list[str] = []
    _ev_used = 0
    for _t in evidence_texts:
        if not _t:
            continue
        if _ev_used >= _EV_BLOCK_BUDGET or len(_ev_lines) >= 15:
            _ev_lines.append(f"- (+{len([x for x in evidence_texts if x]) - len(_ev_lines)} more evidence items omitted)")
            break
        _line = f"- {_t[:_EV_ITEM_CAP]}"
        _ev_lines.append(_line)
        _ev_used += len(_line)
    ev_block = "\n".join(_ev_lines) or "(none)"
    files_block = (
        "\n".join(f"- {f.get('filename') or f.get('s3Key') or 'file'}" for f in files)
        or "(none)"
    )
    links_block = (
        "\n".join(
            f"- {lr.get('url')}: "
            + (
                (lr.get("text") or "")[:1200]
                if lr.get("evaluable")
                else f"[NOT TEXT-EVALUABLE — {lr.get('reason')}]"
            )
            for lr in link_results
        )
        or "(none)"
    )
    hints_block = f"\n{correction_hints}\n" if correction_hints else ""
    return (
        "You are a CSHSE accreditation reader evaluating one specification of a "
        "self-study against the official rubric. Judge ONLY against the criteria.\n\n"
        f"Specification: Standard {standard_code}.{spec_code}\n"
        f"Rubric criteria:\n{criteria or '(criteria not supplied)'}\n"
        f"{hints_block}\n"
        f"=== Narrative ===\n{(narrative or '(empty)')[:6000]}\n\n"
        f"=== Supporting evidence (text) ===\n{ev_block}\n\n"
        f"=== Submitted files ===\n{files_block}\n\n"
        f"=== Web links (scraped text; non-text links flagged) ===\n{links_block}\n\n"
        "Decide a verdict:\n"
        "- \"pass\": the criteria are largely or fully met.\n"
        "- \"needs_improvement\": partially met; fixable gaps.\n"
        "- \"fail\": not met / missing.\n\n"
        "Do NOT fail a spec solely because a web link was flagged not "
        "text-evaluable — note it for human review instead.\n\n"
        "Reply with STRICT JSON only:\n"
        "{\"verdict\": \"pass|needs_improvement|fail\", "
        "\"rationale\": \"<short paragraph grounded in the criteria>\", "
        "\"criteriaCoverage\": [{\"criterion\": \"<text>\", \"met\": true, \"note\": \"<why>\"}], "
        "\"improvementSuggestions\": [\"<actionable suggestion>\"]}"
    )


def _parse_response(raw: str) -> dict:
    """Strict-then-loose JSON parse with a safe default verdict."""
    default = {
        "verdict": "needs_improvement",
        "rationale": "evaluation unavailable",
        "criteriaCoverage": [],
        "improvementSuggestions": [],
    }
    if not raw:
        return {**default, "rationale": "empty response"}
    obj: Any = None
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            try:
                obj = json.loads(m.group(0))
            except json.JSONDecodeError:
                obj = None
    if not isinstance(obj, dict):
        return {**default, "rationale": "could not parse model response"}
    verdict = str(obj.get("verdict", "")).strip().lower()
    if verdict not in _VALID_VERDICTS:
        verdict = "needs_improvement"
    return {
        "verdict": verdict,
        "rationale": str(obj.get("rationale", "")) or default["rationale"],
        "criteriaCoverage": obj.get("criteriaCoverage", []) or [],
        "improvementSuggestions": obj.get("improvementSuggestions", []) or [],
    }


def _evaluate_one_spec(
    *,
    spec: dict,
    narrative: str,
    evidence_texts: list[str],
    files: list[dict],
    link_results: list[dict],
    client: Optional[Anthropic],
    correction_hints: str = "",
) -> dict:
    std = str(spec.get("standardCode", ""))
    sp = str(spec.get("specCode", ""))
    sources_used = {
        "narrative": bool((narrative or "").strip()),
        "evidence": len([t for t in evidence_texts if t]),
        "files": len(files),
        "links": len(link_results),
        "linksNeedingReview": [lr.get("url") for lr in link_results if not lr.get("evaluable")],
    }
    base = {"standardCode": std, "specCode": sp, "sourcesUsed": sources_used}

    if client is None:
        return {
            **base,
            "verdict": "needs_improvement",
            "rationale": "ANTHROPIC_API_KEY not set; evaluation degraded",
            "criteriaCoverage": [],
            "improvementSuggestions": [],
        }

    prompt = _build_prompt(
        standard_code=std,
        spec_code=sp,
        criteria=str(spec.get("criteria", "")),
        narrative=narrative,
        evidence_texts=evidence_texts,
        files=files,
        link_results=link_results,
        correction_hints=correction_hints,
    )
    if len(prompt) > _MAX_INPUT_CHARS:
        prompt = prompt[:_MAX_INPUT_CHARS]
    # Retry the model call + parse a few times: haiku occasionally emits non-JSON
    # (and a verbose evidence-rich reply can cut the closing brace), which used to
    # surface as a hard "could not parse model response" fail — a false negative.
    # A fresh sample almost always parses. Transient API errors are retried too.
    raw = ""
    parsed: dict | None = None
    for _attempt in range(3):
        try:
            msg = client.messages.create(
                model=_HAIKU_MODEL,
                max_tokens=_MAX_TOKENS_OUT,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = "".join(b.text for b in msg.content if getattr(b, "text", None))
        except Exception as exc:  # noqa: BLE001 — never crash the caller
            if _attempt < 2:
                time.sleep(1.0 * (_attempt + 1))
                continue
            return {
                **base,
                "verdict": "needs_improvement",
                "rationale": f"evaluation error ({type(exc).__name__})",
                "criteriaCoverage": [],
                "improvementSuggestions": [],
            }
        cand = _parse_response(raw)
        if cand.get("rationale") != "could not parse model response":
            return {**base, **cand}
        parsed = cand
        if _attempt < 2:
            time.sleep(0.5 * (_attempt + 1))
    return {**base, **(parsed or _parse_response(raw))}


def evaluate_section(
    *,
    institution_id: str,
    submission_id: str,
    specs: list[dict],
    narrative_html: str = "",
    supporting_evidence_text: Optional[list[str]] = None,
    files: Optional[list[dict]] = None,
    web_links: Optional[list[str]] = None,
    anthropic: Optional[Anthropic] = None,
    settings: Optional[Settings] = None,
    scrape_fn: Callable[[str], Any] = scrape_link,
    hints_fn: Optional[Callable[[str, str], str]] = None,
) -> dict:
    """Evaluate one or many specs of a section against the rubric criteria.

    Web links are scraped once (shared across specs). Returns
    ``{"perSpec": [...]}``. ``scrape_fn`` is injectable for testing.
    """
    settings = settings or get_settings()
    if not institution_id:
        raise ValueError("institution_id is required")
    specs = specs or []
    evidence_texts = supporting_evidence_text or []
    files = files or []
    web_links = web_links or []

    # Scrape links once (links describe the section, not a single spec).
    link_results: list[dict] = []
    for url in web_links:
        try:
            res = scrape_fn(url)
            link_results.append(res.to_dict() if hasattr(res, "to_dict") else dict(res))
        except Exception as exc:  # noqa: BLE001
            link_results.append(
                {"url": url, "evaluable": False, "text": "", "reason": f"scrape error ({type(exc).__name__})"}
            )

    client = anthropic or (
        Anthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None
    )

    narrative = narrative_html or ""

    def _hints_for(spec: dict) -> str:
        # CR-049 Phase 4b — pull prior reader-override hints for this spec so
        # the evaluator learns from them. Best-effort: never fail the eval.
        if hints_fn is None:
            return ""
        try:
            return hints_fn(str(spec.get("standardCode", "")), str(spec.get("specCode", ""))) or ""
        except Exception:  # noqa: BLE001
            return ""

    per_spec = [
        _evaluate_one_spec(
            spec=spec,
            narrative=narrative,
            evidence_texts=evidence_texts,
            files=files,
            link_results=link_results,
            client=client,
            correction_hints=_hints_for(spec),
        )
        for spec in specs
    ]
    return {"perSpec": per_spec, "links": link_results}
