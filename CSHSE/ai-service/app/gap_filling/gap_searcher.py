"""Per-gap appendix search + Haiku verification.

For each shortcoming the coverage reviewer flagged on a spec, we:

  1. Embed the gap text.
  2. Top-K nearest-neighbour search in the per-import appendix collection,
     filtered to the spec's Standard (appendix items are pre-grouped by
     Standard; this prevents pulling a Std 14 syllabus to fill a Std 21
     gap). If zero filtered hits cross threshold we fall back to an
     unfiltered search.
  3. For each candidate, ask Haiku whether the snippet actually addresses
     the gap and classify it as ``narrative_text`` (attach to
     ``supportingEvidenceText``) or ``evidence_file`` (split out as a
     SupportingEvidence DOCX upload).

Cost per spec: ~ (n_gaps × 5) embeddings + Haiku calls. On Stevenson that
is roughly 92 specs × 7 gaps × 5 candidates ≈ 3200 Haiku verifier calls
per full import — about $2 at current pricing. Worth it.
"""
from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass, field
from typing import Literal, Protocol

from anthropic import Anthropic, APIStatusError, InternalServerError, RateLimitError

from app.standards.loader import Specification
from app.vector.qdrant_ops import SearchHit, VectorStore

DEFAULT_MODEL = "claude-haiku-4-5"
DEFAULT_TOP_K = 5
# Lowered from 0.65 → 0.50 after the 2026-05-18 Stevenson preview showed
# 2/3800 verifier acceptance. The verifier's `confidence` field is now an
# explicit band (see _build_verify_prompt): 0.80+ = direct documentation,
# 0.50–0.79 = partial/contextual support, <0.50 = tangential. We want the
# partial-support band to count, because accreditation evidence is rarely
# a 1:1 gap closure.
DEFAULT_CONFIDENCE_THRESHOLD = 0.50

# Anthropic's 529 "overloaded" responses are transient — back off and retry
# rather than letting one bad minute kill a long batch.
_RETRYABLE_STATUSES = {429, 500, 502, 503, 504, 529}
_MAX_RETRIES = 5

# Cap the candidate snippet we send to Haiku — appendix items can be CV-
# sized (3000+ words). 6000 chars keeps the prompt under the model's
# context window and the cost predictable.
_CANDIDATE_CHAR_LIMIT = 6000

# How big the candidate body must be to qualify as an "evidence_file"
# rather than a one-paragraph snippet — used as a fallback if Haiku
# doesn't return a classification.
_FILE_WORD_THRESHOLD = 250

Classification = Literal["narrative_text", "evidence_file"]


@dataclass
class GapVerification:
    """Haiku's per-candidate verdict."""
    addresses_gap: bool
    confidence: float
    classification: Classification
    rationale: str


@dataclass
class GapCandidate:
    """A single appendix snippet retrieved for a gap."""
    item_index: int
    item_title: str
    body_text: str
    appendix_anchor: str | None
    standard_code: str
    similarity: float


@dataclass
class GapFill:
    """A verified gap-filling appendix snippet."""
    gap_text: str
    candidate: GapCandidate
    verification: GapVerification


@dataclass
class GapSearchOutcome:
    """All candidates we considered for a single gap, plus the chosen fill."""
    gap_text: str
    candidates: list[GapCandidate] = field(default_factory=list)
    accepted: GapFill | None = None
    rejected: list[GapFill] = field(default_factory=list)


# ---------------------------------------------------------------- protocols


class _EmbeddingProto(Protocol):
    def embed_one(self, text: str) -> list[float]: ...


class _StoreProto(Protocol):
    def search(
        self,
        collection: str,
        query_vector: list[float],
        top_k: int = ...,
        payload_filter: dict | None = ...,
    ) -> list[SearchHit]: ...


# ---------------------------------------------------------------- prompt


def _build_verify_prompt(spec: Specification, gap_text: str, candidate_body: str) -> str:
    body = candidate_body[:_CANDIDATE_CHAR_LIMIT]
    return "\n".join(
        [
            "You are an accreditation reviewer at CSHSE (Council for Standards",
            "in Human Service Education). The coverage review on a specific",
            "Specification flagged the SHORTCOMING below. We searched the",
            "self-study's appendix and pulled a candidate snippet that may",
            "serve as supporting evidence. Your job is to decide whether the",
            "snippet is relevant evidence a reviewer would cite for this",
            "shortcoming.",
            "",
            f"SPECIFICATION {spec.standard_code}.{spec.spec_code} ({spec.standard_title}):",
            f"  {spec.spec_text}",
            "",
            "=== SHORTCOMING TO ADDRESS ===",
            gap_text,
            "",
            "=== CANDIDATE APPENDIX SNIPPET ===",
            body,
            "",
            "Accreditation evidence is typically partial. A single appendix",
            "item rarely closes a shortcoming on its own — a reviewer",
            "assembles narrative plus multiple evidence items to determine",
            "coverage. ACCEPT (addresses_gap=true) when the snippet provides",
            "documentation, data, or examples a reviewer would reasonably",
            "cite for this shortcoming, OR adds context that materially",
            "advances coverage of the missing element (even partially).",
            "REJECT only when the snippet is off-topic, contradicts the",
            "shortcoming, or contains nothing a reviewer could plausibly",
            "point to (e.g., a faculty CV when the gap asks for course",
            "syllabi, or unrelated administrative content).",
            "",
            "Use the `confidence` field as an explicit band:",
            "  - 0.80-1.00: direct documentation a reviewer would point to",
            "  - 0.50-0.79: partial / contextual support that helps but",
            "               doesn't close the shortcoming on its own",
            "  - below 0.50: only tangentially related; reviewer unlikely",
            "                to cite this item for this shortcoming",
            "",
            'Also classify the snippet shape: pick "evidence_file" if it is a',
            "standalone document (faculty CV, syllabus, meeting minutes, policy",
            "memo, brochure, course catalog excerpt) — i.e. something we would",
            'split out as a separate SupportingEvidence file. Pick "narrative_text"',
            "if it is a short prose paragraph that belongs inline in",
            "``supportingEvidenceText``.",
            "",
            "Respond with STRICT JSON only (no prose, no markdown fences):",
            "{",
            '  "addresses_gap": boolean,',
            '  "confidence": float 0.0-1.0,',
            '  "classification": "narrative_text" | "evidence_file",',
            '  "rationale": "1-2 sentences explaining the verdict"',
            "}",
        ]
    )


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].lstrip("\n").lstrip()
    return json.loads(cleaned)


def _fallback_classification(body: str) -> Classification:
    return "evidence_file" if len(body.split()) >= _FILE_WORD_THRESHOLD else "narrative_text"


# ---------------------------------------------------------------- public API


def _call_with_retry(client: Anthropic, model: str, prompt: str, max_tokens: int):
    """Wrap messages.create with backoff so transient 529/429/503 don't kill a long batch."""
    delay = 1.0
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            return client.messages.create(
                model=model,
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )
        except (InternalServerError, RateLimitError) as exc:
            last_exc = exc
        except APIStatusError as exc:
            if exc.status_code not in _RETRYABLE_STATUSES:
                raise
            last_exc = exc
        sleep_for = delay + random.uniform(0, 0.5)
        time.sleep(sleep_for)
        delay = min(delay * 2, 30.0)
    # Out of retries — re-raise the last exception so the caller can record a failure.
    assert last_exc is not None
    raise last_exc


def verify_candidate(
    client: Anthropic,
    spec: Specification,
    gap_text: str,
    candidate_body: str,
    model: str = DEFAULT_MODEL,
) -> GapVerification:
    """Ask Haiku whether ``candidate_body`` addresses ``gap_text`` for ``spec``."""
    prompt = _build_verify_prompt(spec, gap_text, candidate_body)
    try:
        msg = _call_with_retry(client, model, prompt, max_tokens=300)
    except Exception as exc:
        # Persistent failure — degrade gracefully so the batch keeps moving.
        # Carry the API message in the rationale so credit/quota/model-id
        # issues surface in the preview without a separate diagnostic call.
        return GapVerification(
            addresses_gap=False,
            confidence=0.0,
            classification=_fallback_classification(candidate_body),
            rationale=f"verifier API error: {type(exc).__name__}: {str(exc)[:300]}",
        )
    raw = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    try:
        parsed = _parse_json(raw)
    except json.JSONDecodeError:
        return GapVerification(
            addresses_gap=False,
            confidence=0.0,
            classification=_fallback_classification(candidate_body),
            rationale=f"LLM returned non-JSON: {raw[:200]}",
        )

    classification = parsed.get("classification")
    if classification not in ("narrative_text", "evidence_file"):
        classification = _fallback_classification(candidate_body)

    return GapVerification(
        addresses_gap=bool(parsed.get("addresses_gap", False)),
        confidence=float(parsed.get("confidence", 0.0)),
        classification=classification,  # type: ignore[arg-type]
        rationale=str(parsed.get("rationale", "")),
    )


def _hit_to_candidate(hit: SearchHit) -> GapCandidate:
    p = hit.payload
    return GapCandidate(
        item_index=int(p.get("itemIndex", -1)),
        item_title=str(p.get("itemTitle", "")),
        body_text=str(p.get("bodyText", "")),
        appendix_anchor=(p.get("appendixAnchor") or None),
        standard_code=str(p.get("standardCode", "")),
        similarity=float(hit.score),
    )


def search_gap(
    store: _StoreProto,
    embedder: _EmbeddingProto,
    anthropic_client: Anthropic,
    collection: str,
    spec: Specification,
    gap_text: str,
    top_k: int = DEFAULT_TOP_K,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    model: str = DEFAULT_MODEL,
    seen_item_indices: set[int] | None = None,
) -> GapSearchOutcome:
    """Search the appendix for content that fills ``gap_text`` on ``spec``.

    Returns the candidate set considered and either the accepted fill or
    the list of rejected candidates with Haiku rationale.

    Filtering:
      1. First search filters by ``standardCode == spec.standard_code``.
      2. If none of the filtered hits address the gap above threshold, we
         retry without the filter (cross-Standard items can still be the
         right answer when an appendix item is misgrouped).

    ``seen_item_indices`` lets callers avoid using the same appendix
    item to fill two different gaps in the same spec.
    """
    seen = seen_item_indices if seen_item_indices is not None else set()
    outcome = GapSearchOutcome(gap_text=gap_text)
    query_vec = embedder.embed_one(gap_text)

    # Pass 1: Standard-filtered search.
    hits = store.search(
        collection,
        query_vec,
        top_k=top_k,
        payload_filter={"standardCode": spec.standard_code},
    )
    accepted = _consider_hits(
        outcome=outcome,
        hits=hits,
        anthropic_client=anthropic_client,
        spec=spec,
        gap_text=gap_text,
        confidence_threshold=confidence_threshold,
        model=model,
        seen_item_indices=seen,
    )
    if accepted is not None:
        outcome.accepted = accepted
        seen.add(accepted.candidate.item_index)
        return outcome

    # Pass 2: unfiltered fallback.
    hits = store.search(collection, query_vec, top_k=top_k, payload_filter=None)
    accepted = _consider_hits(
        outcome=outcome,
        hits=hits,
        anthropic_client=anthropic_client,
        spec=spec,
        gap_text=gap_text,
        confidence_threshold=confidence_threshold,
        model=model,
        seen_item_indices=seen,
    )
    if accepted is not None:
        outcome.accepted = accepted
        seen.add(accepted.candidate.item_index)
    return outcome


def _consider_hits(
    *,
    outcome: GapSearchOutcome,
    hits: list[SearchHit],
    anthropic_client: Anthropic,
    spec: Specification,
    gap_text: str,
    confidence_threshold: float,
    model: str,
    seen_item_indices: set[int],
) -> GapFill | None:
    """Walk hits in score order; return the first one Haiku accepts."""
    for hit in hits:
        cand = _hit_to_candidate(hit)
        # Avoid re-using an appendix item that already filled another gap
        # on this spec.
        if cand.item_index in seen_item_indices:
            continue
        # Avoid duplicating candidates between filtered and unfiltered
        # passes.
        if any(c.item_index == cand.item_index for c in outcome.candidates):
            continue
        outcome.candidates.append(cand)
        verdict = verify_candidate(
            anthropic_client, spec, gap_text, cand.body_text, model=model
        )
        fill = GapFill(gap_text=gap_text, candidate=cand, verification=verdict)
        if verdict.addresses_gap and verdict.confidence >= confidence_threshold:
            return fill
        outcome.rejected.append(fill)
    return None
