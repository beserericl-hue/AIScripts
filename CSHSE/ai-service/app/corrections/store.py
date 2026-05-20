"""Corrections feedback loop — ingest + retrieve.

When the wizard's matcher misses a spec, the coordinator highlights the
source passage and the CSHSE server posts the correction to
``/ai/corrections/ingest``. This module is what runs server-side:

  - ``ingest_correction`` embeds the source text with the same OpenAI
    model the matcher uses, then upserts the point into the per-env
    Qdrant collection ``cshse_corrections_{env}`` keyed by
    ``correctionId``. The payload carries ``institutionId``,
    ``programLevel``, and the expected ``(std, spec)`` so the matcher
    can filter at retrieval time.

  - ``retrieve_for_section`` queries that collection scoped to the
    current institution + program level. The matcher injects the top-N
    hits into the Haiku prompt as few-shot examples (soft hint).

Scope policy (decision 2026-05-20): per-institution. A correction from
Stevenson shapes only Stevenson's future imports; never Kennesaw State's.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.config import Settings, get_settings
from app.embeddings.openai_client import EmbeddingClient
from app.vector.qdrant_ops import SearchHit, VectorStore


@dataclass
class CorrectionExample:
    """One previously-corrected example used as a Haiku few-shot."""
    expected_std: str
    expected_spec: str
    source_heading: str
    source_text: str
    score: float
    correction_type: str


def _payload_for(req: dict[str, Any]) -> dict[str, Any]:
    """Pull the fields we need from the inbound ingest request."""
    return {
        "correctionId": req["correctionId"],
        "institutionId": str(req["institutionId"]),
        "programLevel": req["programLevel"],
        "expectedStd": req["expectedStd"],
        "expectedSpec": req["expectedSpec"],
        "expectedSectionType": req.get("expectedSectionType", "narrative_response"),
        "sourceHeading": req.get("sourceHeading", ""),
        "sourceText": req["sourceText"],
        "correctionType": req.get("correctionType", "missed-by-matcher"),
    }


def ingest_correction(
    req: dict[str, Any],
    *,
    embedder: EmbeddingClient | None = None,
    store: VectorStore | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Embed ``sourceText`` and upsert into the corrections collection.

    Returns a small ack dict the caller (FastAPI handler) can return to
    the Node server. Keeps a fingerprint-shaped response so the server's
    background reconciler can detect stale rows.
    """
    settings = settings or get_settings()
    embedder = embedder or EmbeddingClient(settings.openai_api_key)
    store = store or VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)

    store.ensure_collection(settings.corrections_collection)

    vec = embedder.embed_one(req["sourceText"])
    payload = _payload_for(req)
    point_id = str(req["correctionId"])
    store.upsert(
        settings.corrections_collection,
        vectors=[vec],
        payloads=[payload],
        ids=[point_id],
    )
    return {
        "ok": True,
        "correctionId": point_id,
        "collection": settings.corrections_collection,
        "embeddingModel": "text-embedding-3-small",
    }


def retrieve_for_section(
    *,
    section_text: str,
    institution_id: str | None,
    program_level: str,
    top_k: int = 3,
    min_score: float = 0.55,
    embedder: EmbeddingClient | None = None,
    store: VectorStore | None = None,
    settings: Settings | None = None,
) -> list[CorrectionExample]:
    """Find previously-corrected examples similar to a new section.

    Filters by ``institutionId`` + ``programLevel`` so corrections from
    one school never bleed into another's matcher prompt. Returns the
    examples sorted by similarity, capped at ``top_k`` and gated by
    ``min_score``.

    If ``institution_id`` is None (smoke/test paths) the filter still
    requires programLevel — better to surface nothing than to leak
    Kennesaw's corrections into a Stevenson run because of a missing id.
    """
    if not institution_id:
        return []
    settings = settings or get_settings()
    # An empty corrections collection short-circuits cleanly — ensure_collection
    # creates it if missing; a brand-new instance returns zero hits.
    embedder = embedder or EmbeddingClient(settings.openai_api_key)
    store = store or VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    store.ensure_collection(settings.corrections_collection)

    try:
        vec = embedder.embed_one(section_text)
    except Exception:  # noqa: BLE001
        # Embedding failure shouldn't take down the matcher.
        return []

    payload_filter = {
        "institutionId": str(institution_id),
        "programLevel": program_level,
    }
    hits: list[SearchHit] = store.search(
        settings.corrections_collection,
        query_vector=vec,
        top_k=top_k * 3,  # pull a few extra and gate by min_score
        payload_filter=payload_filter,
    )
    out: list[CorrectionExample] = []
    for h in hits:
        if h.score < min_score:
            continue
        p = h.payload or {}
        out.append(
            CorrectionExample(
                expected_std=str(p.get("expectedStd") or ""),
                expected_spec=str(p.get("expectedSpec") or ""),
                source_heading=str(p.get("sourceHeading") or ""),
                source_text=str(p.get("sourceText") or ""),
                score=float(h.score),
                correction_type=str(p.get("correctionType") or "missed-by-matcher"),
            )
        )
        if len(out) >= top_k:
            break
    return out


def format_examples_for_prompt(examples: list[CorrectionExample]) -> str:
    """Render examples as a Haiku-prompt block; empty string if none."""
    if not examples:
        return ""
    lines = [
        "Previously-corrected examples from this institution (use these as",
        "soft hints; you may still override them with your own judgement):",
    ]
    for ex in examples:
        snippet = ex.source_text.strip().replace("\n", " ")
        if len(snippet) > 240:
            snippet = snippet[:240] + "…"
        lines.append(
            f"  • EXAMPLE → {ex.expected_std}.{ex.expected_spec} "
            f"({ex.correction_type}, sim={ex.score:.2f}): {snippet!r}"
        )
    return "\n".join(lines)
