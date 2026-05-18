"""Gap-filling orchestrator.

Runs after the first-pass coverage review on the whole document. For each
spec the reviewer flagged as not-covered with concrete gaps, this module:

  1. Searches the per-import appendix Qdrant collection for snippets that
     fill the specific shortcomings.
  2. Augments the spec's evidence list with the verified hits.
  3. Re-runs the coverage reviewer on the augmented evidence.
  4. Surfaces only the gaps still remaining after the second pass.

The collection is created by the caller via ``index_appendix`` and torn
down by the caller via ``drop_appendix_collection``. This module never
creates or deletes collections on its own — that keeps the lifecycle
explicit at the wizard layer.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from anthropic import Anthropic

from app.coverage.spec_coverage import CoverageReview, CoverageReviewer
from app.gap_filling.gap_searcher import (
    DEFAULT_CONFIDENCE_THRESHOLD,
    DEFAULT_TOP_K,
    GapFill,
    GapSearchOutcome,
    search_gap,
)
from app.standards.loader import Specification


class _EmbeddingProto(Protocol):
    def embed_one(self, text: str) -> list[float]: ...


class _StoreProto(Protocol):
    def search(self, *args, **kwargs): ...


@dataclass
class SpecGapFillResult:
    """The full before/after picture for one spec."""
    standard_code: str
    spec_code: str
    initial_review: CoverageReview
    outcomes: list[GapSearchOutcome] = field(default_factory=list)
    final_review: CoverageReview | None = None  # None when no re-review ran

    @property
    def accepted_fills(self) -> list[GapFill]:
        return [o.accepted for o in self.outcomes if o.accepted is not None]

    @property
    def remaining_gap_count(self) -> int:
        review = self.final_review or self.initial_review
        return len(review.gaps)


def _augmented_evidence_for(
    base_evidence: list[tuple[str, str]],
    fills: list[GapFill],
) -> list[tuple[str, str]]:
    """Concatenate base evidence with verified gap-fill snippets.

    Each fill becomes a new ``(title, body)`` tuple suffixed with a tag so
    the second-pass reviewer can see this evidence came from a targeted
    appendix search.
    """
    out = list(base_evidence)
    for fill in fills:
        title = f"[gap-fill] {fill.candidate.item_title}"
        out.append((title, fill.candidate.body_text))
    return out


def run_gap_filling(
    *,
    store: _StoreProto,
    embedder: _EmbeddingProto,
    anthropic_client: Anthropic,
    collection: str,
    initial_reviews: list[CoverageReview],
    spec_lookup: dict[tuple[str, str], Specification],
    narrative_lookup: dict[tuple[str, str], str],
    evidence_lookup: dict[tuple[str, str], list[tuple[str, str]]],
    reviewer: CoverageReviewer | None = None,
    anthropic_key: str | None = None,
    top_k: int = DEFAULT_TOP_K,
    confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
) -> list[SpecGapFillResult]:
    """For every spec with gaps, search the appendix and re-review.

    Arguments:
      ``initial_reviews`` — first-pass output of ``CoverageReviewer.review``
        for every spec under audit.
      ``spec_lookup`` — ``(standard_code, spec_code) -> Specification`` so
        we can hand the second-pass reviewer the prompt context.
      ``narrative_lookup``, ``evidence_lookup`` — what the wizard already
        decided to assign to each (std, spec) BEFORE gap filling. Keys are
        ``(standard_code, spec_code)``.
      ``reviewer`` — optional pre-built CoverageReviewer (lets callers
        share state / mock it in tests). If absent, one is built from
        ``anthropic_key``.

    Specs Claude already marked covered are passed through unchanged with
    ``final_review = initial_review`` (no re-call). Specs with no gaps
    listed are likewise skipped.
    """
    if reviewer is None:
        if not anthropic_key:
            raise ValueError("Either reviewer or anthropic_key must be provided")
        reviewer = CoverageReviewer(anthropic_key=anthropic_key)

    results: list[SpecGapFillResult] = []
    for review in initial_reviews:
        key = (review.standard_code, review.spec_code)
        spec = spec_lookup.get(key)
        if spec is None:
            # Unknown spec — pass through; we cannot run the search prompt
            # without the spec text.
            results.append(
                SpecGapFillResult(
                    standard_code=review.standard_code,
                    spec_code=review.spec_code,
                    initial_review=review,
                    final_review=review,
                )
            )
            continue

        # Skip when there's nothing to fill — keeps cost down on the 7%
        # of specs Claude already accepts.
        if review.is_covered or not review.gaps:
            results.append(
                SpecGapFillResult(
                    standard_code=review.standard_code,
                    spec_code=review.spec_code,
                    initial_review=review,
                    final_review=review,
                )
            )
            continue

        outcomes: list[GapSearchOutcome] = []
        seen: set[int] = set()
        for gap_text in review.gaps:
            outcome = search_gap(
                store=store,
                embedder=embedder,
                anthropic_client=anthropic_client,
                collection=collection,
                spec=spec,
                gap_text=gap_text,
                top_k=top_k,
                confidence_threshold=confidence_threshold,
                seen_item_indices=seen,
            )
            outcomes.append(outcome)

        fills = [o.accepted for o in outcomes if o.accepted is not None]

        if not fills:
            # Nothing useful in the appendix — second pass would just
            # repeat the first pass. Save the cost.
            results.append(
                SpecGapFillResult(
                    standard_code=review.standard_code,
                    spec_code=review.spec_code,
                    initial_review=review,
                    outcomes=outcomes,
                    final_review=review,
                )
            )
            continue

        base_evidence = evidence_lookup.get(key, [])
        augmented = _augmented_evidence_for(base_evidence, fills)
        narrative_text = narrative_lookup.get(key, "")
        final = reviewer.review(spec, narrative_text, augmented)
        results.append(
            SpecGapFillResult(
                standard_code=review.standard_code,
                spec_code=review.spec_code,
                initial_review=review,
                outcomes=outcomes,
                final_review=final,
            )
        )

    return results
