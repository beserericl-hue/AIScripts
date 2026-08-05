"""RAG retrieval helper for the evaluators.

Embeds a spec query and searches the per-env ``cshse_evidence_{env}`` Qdrant
collection (per-institution + per-submission payload filter) for the most
relevant document chunks. Shared by the coverage reviewer AND the section
evaluator so both credit evidence that lives in the file library even when the
narrative does not name it. Best-effort: returns [] on any failure so a missing
collection / embedding hiccup never fails an eval.
"""
from __future__ import annotations

from app.config import get_settings


def retrieve_evidence_chunks(
    institution_id: str,
    submission_id: str,
    query_text: str,
    top_k: int = 6,
    settings=None,
) -> list[tuple[str, str]]:
    """Return up to ``top_k`` (source_filename, chunk_text) pairs most similar to
    ``query_text`` from this submission's indexed evidence."""
    settings = settings or get_settings()
    if not institution_id or not (query_text or "").strip():
        return []
    try:
        from app.embeddings.openai_client import EmbeddingClient
        from app.vector.qdrant_ops import VectorStore

        embedder = EmbeddingClient(settings.openai_api_key)
        store = VectorStore(settings.qdrant_url, settings.qdrant_api_key or None)
        store.ensure_collection(settings.evidence_collection)
        qv = embedder.embed_one(query_text[:2000])
        pf = {"institutionId": str(institution_id)}
        if submission_id:
            pf["submissionId"] = str(submission_id)
        hits = store.search(
            settings.evidence_collection,
            query_vector=qv,
            top_k=top_k,
            payload_filter=pf,
        )
        out: list[tuple[str, str]] = []
        for h in hits:
            p = h.payload or {}
            txt = (p.get("chunkText") or "").strip()
            if txt:
                out.append((p.get("sourceFilename") or "document", txt))
        return out
    except Exception:  # noqa: BLE001 — retrieval is best-effort
        return []
