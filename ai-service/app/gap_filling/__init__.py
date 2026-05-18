"""Gap-filling pass — searches appendix content for evidence that fills
specific shortcomings the coverage reviewer flagged on each spec.

Architecture:
    1. ``appendix_index`` — embed every AppendixItem into an ephemeral
       Qdrant collection ``cshse_gapfill_<import_id>``.
    2. ``gap_searcher`` — for each gap on each spec, retrieve top-K
       appendix candidates and ask Haiku whether the snippet actually
       addresses the shortcoming. Confirmed hits are classified as
       ``narrative_text`` (attach to ``supportingEvidenceText``) or
       ``evidence_file`` (split-out DOCX → S3 + SupportingEvidence row).
    3. ``pipeline`` — orchestrator that runs the indexer, the gap search
       per spec, re-runs ``CoverageReviewer`` with the augmented evidence,
       and tears the collection down at the end.

The collection is per-import — never shared across institutions — and is
deleted at wizard finish / cancel / failure to keep the shared Qdrant
instance clean.
"""

from app.gap_filling.appendix_index import (
    AppendixIndexEntry,
    drop_appendix_collection,
    gapfill_collection_name,
    index_appendix,
)
from app.gap_filling.gap_searcher import (
    GapCandidate,
    GapFill,
    GapVerification,
    search_gap,
    verify_candidate,
)
from app.gap_filling.pipeline import (
    SpecGapFillResult,
    run_gap_filling,
)

__all__ = [
    "AppendixIndexEntry",
    "drop_appendix_collection",
    "gapfill_collection_name",
    "index_appendix",
    "GapCandidate",
    "GapFill",
    "GapVerification",
    "search_gap",
    "verify_candidate",
    "SpecGapFillResult",
    "run_gap_filling",
]
