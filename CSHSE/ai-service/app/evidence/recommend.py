"""CR-018 Phase 2 — RAG retrieval of evidence chunks for a spec.

Embeds the spec's prompt + standard title, searches the per-env
``cshse_evidence_{env}`` Qdrant collection with ``institutionId`` +
``submissionId`` payload filter, returns the top-K hits.
"""
from __future__ import annotations

from app.config import Settings, get_settings
from app.embeddings.openai_client import EmbeddingClient
from app.standards.loader import load_specifications
from app.vector.qdrant_ops import SearchHit, VectorStore


def recommend_evidence(
    *,
    institution_id: str,
    submission_id: str,
    standard_code: str,
    spec_code: str,
    top_k: int = 5,
    embedder: EmbeddingClient | None = None,
    store: VectorStore | None = None,
    settings: Settings | None = None,
    program_level: str = "bachelors",
) -> dict:
    """Return up to ``top_k`` evidence chunks similar to the spec text.

    The matcher already knows the institution + submission; passing them
    here is the audit boundary the [[cross-institution-isolation-audit-2026-05-24]]
    Gap 2 test asserts.
    """
    settings = settings or get_settings()
    if not institution_id:
        raise ValueError("institution_id is required")

    # Resolve the spec text from the loaded standards. Fall back to the
    # raw spec code if the lookup fails — at worst the retrieval is less
    # relevant.
    spec_text = f"Standard {standard_code}.{spec_code}"
    try:
        specs = load_specifications(program_level)
        for s in specs:
            if s.standard_code == standard_code and s.spec_code == spec_code:
                spec_text = f"{s.standard_title}\n\n{s.spec_text}"
                break
    except Exception:  # noqa: BLE001
        pass

    embedder = embedder or EmbeddingClient(settings.openai_api_key)
    store = store or VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
    store.ensure_collection(settings.evidence_collection)

    query_vec = embedder.embed_one(spec_text)
    payload_filter = {
        "institutionId": str(institution_id),
        "submissionId": str(submission_id),
    }
    hits: list[SearchHit] = store.search(
        settings.evidence_collection,
        query_vector=query_vec,
        top_k=top_k,
        payload_filter=payload_filter,
    )
    return {
        "chunks": [
            {
                "score": float(h.score),
                "payload": h.payload or {},
            }
            for h in hits
        ],
        "collection": settings.evidence_collection,
        "standardCode": standard_code,
        "specCode": spec_code,
    }
