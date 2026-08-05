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
from app.evidence.retrieve import retrieve_evidence_chunks
from app.section_eval.scrape import scrape_link

_URL_RE = re.compile(r"https?://[^\s\"'<>)]+")


def _scrape_narrative_links(narrative_text: str, max_links: int = 4) -> list[tuple[str, str]]:
    """Fetch http(s) URLs cited in the narrative so the reviewer can read
    web-hosted evidence (catalogs, program websites) — mirrors the section
    evaluator's link scraper. Best-effort; file:// and network paths are ignored."""
    urls: list[str] = []
    seen: set[str] = set()
    for m in _URL_RE.finditer(narrative_text or ""):
        u = m.group(0).rstrip(".,);:'\"")
        if u not in seen:
            seen.add(u)
            urls.append(u)
        if len(urls) >= max_links:
            break
    out: list[tuple[str, str]] = []
    for u in urls:
        try:
            r = scrape_link(u)
            out.append((u, (r.text[:1500] if r.evaluable else f"[not text-evaluable: {r.reason}]")))
        except Exception:  # noqa: BLE001 — scraping is best-effort
            out.append((u, "[fetch failed]"))
    return out

DEFAULT_MODEL = "claude-haiku-4-5"
CONTENT_CHAR_LIMIT = 8000  # cap total content sent per spec to control cost
MAX_TOKENS = 1200  # headroom so a verbose gaps/strengths reply isn't truncated mid-JSON

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
    library_file_names: Optional[list[str]] = None,
    retrieved_chunks: Optional[list] = None,
    web_evidence: Optional[list] = None,
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

    _lib = [n for n in (library_file_names or []) if n][:200]
    if _lib:
        parts.append("")
        parts.append("=== DOCUMENTS AVAILABLE IN THIS SUBMISSION'S FILE LIBRARY ===")
        parts.extend(_lib)
        parts.append(
            "RULE — a cited document that EXISTS counts as provided: when the narrative "
            "names a document (manual, catalog, syllabus, report, appendix, agreement, "
            "form, worksheet, etc.) and a matching name appears in the library list "
            "above, treat that document as PROVIDED evidence. Do NOT report it as a gap "
            "or lower the score for a named document that is present in the library."
        )

    _ret = retrieved_chunks or []
    if _ret:
        parts.append("")
        parts.append("=== RELEVANT PASSAGES RETRIEVED FROM THE DOCUMENT LIBRARY (semantic search across ALL uploaded files) ===")
        for _fn, _txt in _ret[:6]:
            parts.append(f"[from {str(_fn)[:70]}]: {str(_txt)[:700]}")
        parts.append(
            "These passages were auto-retrieved from the institution's uploaded documents as most "
            "relevant to this Specification. Treat them as supporting evidence that EXISTS in the "
            "submission and credit them even if the narrative does not cite them by name."
        )

    _web = web_evidence or []
    if _web:
        parts.append("")
        parts.append("=== WEB LINKS CITED IN THE NARRATIVE (fetched page text) ===")
        for _u, _t in _web[:4]:
            parts.append(f"[{str(_u)[:80]}]: {str(_t)[:1000]}")
        parts.append("Treat readable web-page text above as supporting evidence the narrative cites.")

    parts.extend([
        "",
        "SCORING CALIBRATION — apply the Handbook the way a fair human reader does:",
        "1. Requirements vs recommendations: items phrased as 'recommended' or 'strongly",
        "   recommended' are NOT required. Never lower the score or call it a gap because a",
        "   RECOMMENDATION is unmet — mention it only as an optional suggestion.",
        "2. Substance over enumeration: a criterion is covered when its CORE requirement is",
        "   substantively addressed. Do NOT penalize for lacking explicit separate mention of",
        "   every enumerated sub-item when the narrative + evidence reasonably cover the intent",
        "   (e.g. 'faculty make all curriculum decisions' covers setting policy, content,",
        "   implementation AND evaluation).",
        "3. Documents/matrices/forms: when the criterion asks that a document, matrix, or form",
        "   be PROVIDED, its EXISTENCE in the file library satisfies that — do not treat it as a",
        "   gap because a table's exact cell contents can't be read from the extracted text.",
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
        library_file_names: Optional[list[str]] = None,
        institution_id: Optional[str] = None,
        submission_id: Optional[str] = None,
    ) -> CoverageReview:
        evidence_items = evidence_items or []
        retrieved = (
            retrieve_evidence_chunks(institution_id, submission_id or "", f"{spec.standard_title}\n{spec.spec_text}")
            if institution_id
            else []
        )
        web_evidence = _scrape_narrative_links(narrative_text)
        prompt = _build_prompt(spec, narrative_text, evidence_items, library_file_names, retrieved, web_evidence)
        # Retry the call+parse a few times: haiku occasionally emits non-JSON (and a
        # verbose gaps/strengths reply can cut the closing brace) — which used to
        # surface as a hard "LLM returned non-JSON response" gap (a false 0.0). A
        # fresh sample almost always parses. Transient API errors retry inside
        # _call_with_retry.
        raw = ""
        for _attempt in range(3):
            try:
                msg = self._call_with_retry(prompt)
            except Exception as exc:
                return CoverageReview(
                    standard_code=spec.standard_code,
                    spec_code=spec.spec_code,
                    is_covered=False,
                    coverage_score=0.0,
                    gaps=[f"coverage reviewer API error: {type(exc).__name__}"],
                    strengths=[],
                    suggestion=f"{type(exc).__name__}: {str(exc)[:400]}",
                    raw_response="",
                )
            raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
            try:
                parsed = _parse(raw)
            except json.JSONDecodeError:
                if _attempt < 2:
                    time.sleep(0.5 * (_attempt + 1))
                    continue
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
        # Unreachable (the loop always returns), but keeps type-checkers happy.
        return CoverageReview(
            standard_code=spec.standard_code, spec_code=spec.spec_code,
            is_covered=False, coverage_score=0.0, gaps=["LLM returned non-JSON response"],
            strengths=[], suggestion="", raw_response=raw,
        )


def review_specs(
    program_level: str,
    anthropic_key: str,
    items: list[dict],
    max_workers: int = 6,
    on_progress=None,
    library_file_names: Optional[list[str]] = None,
    institution_id: Optional[str] = None,
    submission_id: Optional[str] = None,
) -> list[CoverageReview]:
    """Run the coverage reviewer over a batch of specs — the reusable primitive
    shared by every import pipeline (so no document is parsed without a coverage
    assessment) AND by the on-demand "Check coverage" endpoint (to backfill an
    already-parsed submission without re-reading the document).

    ``items``: ``[{standard_code, spec_code, narrative_text, evidence_items:[(title,body)]}]``
    Returns a ``CoverageReview`` per item whose (std, spec) resolves to a known
    Handbook Specification for ``program_level``.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from app.standards.loader import load_specifications

    specs = load_specifications(program_level)
    by_key = {(str(s.standard_code), str(s.spec_code)): s for s in specs}
    reviewer = CoverageReviewer(anthropic_key)

    tasks = []
    for it in items:
        spec = by_key.get((str(it.get("standard_code")), str(it.get("spec_code"))))
        if spec is not None:
            tasks.append((spec, it))
    if not tasks:
        return []

    results: list[CoverageReview] = []
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        futures = {
            ex.submit(reviewer.review, spec, it.get("narrative_text") or "", it.get("evidence_items") or [], library_file_names, institution_id, submission_id): spec
            for (spec, it) in tasks
        }
        done = 0
        for fut in as_completed(futures):
            results.append(fut.result())
            done += 1
            if on_progress:
                try:
                    on_progress(done, len(futures))
                except Exception:  # noqa: BLE001 — progress is best-effort
                    pass
    return results
