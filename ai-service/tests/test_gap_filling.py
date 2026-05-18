"""Offline tests for the gap-filling pipeline.

Covers:
  - appendix indexer: collection naming, payload shape, batching, drop helper
  - gap searcher: filtered-then-unfiltered fallback, candidate dedup,
    skip-seen, accept above threshold, reject below threshold, JSON parse
    failure path
  - pipeline: skip-covered specs, skip when no appendix fill found,
    augment+re-review on success
"""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from app.coverage.spec_coverage import CoverageReview
from app.gap_filling.appendix_index import (
    drop_appendix_collection,
    gapfill_collection_name,
    index_appendix,
)
from app.gap_filling.gap_searcher import (
    GapCandidate,
    GapFill,
    GapVerification,
    _build_verify_prompt,
    _fallback_classification,
    search_gap,
    verify_candidate,
)
from app.gap_filling.pipeline import (
    SpecGapFillResult,
    _augmented_evidence_for,
    run_gap_filling,
)
from app.splitter.appendix_walker import AppendixItem
from app.standards.loader import Specification
from app.vector.qdrant_ops import SearchHit


# --------------------------------------------------------------------- helpers


def _fake_spec(std: str = "3", sp: str = "b") -> Specification:
    return Specification(
        standard_code=std,
        spec_code=sp,
        standard_title="Community Assessment",
        spec_text="An Advisory Committee shall be established …",
        program_level="bachelors",
    )


def _fake_appendix_item(
    index: int,
    title: str = "Advisory Committee Minutes Sep 2024",
    body: str = "Advisory committee met September 12 2024. Members present: …",
    standard: str = "3",
    anchor: str | None = "App3MinutesSep24",
) -> AppendixItem:
    return AppendixItem(
        item_title=title,
        body_text=body,
        standard_code=standard,
        appendix_anchor=anchor,
        item_index=index,
    )


def _fake_embedder(dim: int = 1536):
    e = MagicMock()
    e.embed_one.return_value = [0.1] * dim
    e.embed_batch.side_effect = lambda texts: [[0.1] * dim for _ in texts]
    return e


def _llm_response(text: str):
    msg = MagicMock()
    block = MagicMock()
    block.text = text
    block.type = "text"
    msg.content = [block]
    return msg


def _fake_anthropic(responses: list[str]):
    client = MagicMock()
    msgs = [_llm_response(t) for t in responses]
    client.messages.create.side_effect = msgs
    return client


# --------------------------------------------------------------------- naming


def test_gapfill_collection_name_sanitizes_input():
    name = gapfill_collection_name("abc-123:def/g")
    assert name.startswith("cshse_gapfill_")
    # No colons/slashes in qdrant collection names
    assert ":" not in name
    assert "/" not in name
    assert "-" not in name


def test_gapfill_collection_name_empty_fallback_uuid():
    name = gapfill_collection_name("")
    assert name.startswith("cshse_gapfill_")
    # The suffix is non-empty
    assert len(name) > len("cshse_gapfill_")


# --------------------------------------------------------------------- index


def test_index_appendix_creates_collection_and_upserts():
    store = MagicMock()
    embedder = _fake_embedder()
    items = [_fake_appendix_item(i) for i in range(3)]

    coll, entries = index_appendix(store, embedder, "import-42", items)

    assert coll == gapfill_collection_name("import-42")
    store.ensure_collection.assert_called_once_with(coll)
    assert len(entries) == 3
    # Each entry has stable point_id + carries through standard/anchor
    assert all(e.standard_code == "3" for e in entries)
    assert all(e.appendix_anchor for e in entries)
    # Upsert called with payload list shaped like our promised schema
    args, kwargs = store.upsert.call_args
    payloads = args[2]
    assert {"itemIndex", "itemTitle", "bodyText", "standardCode", "appendixAnchor"} <= payloads[0].keys()


def test_index_appendix_batches_large_inputs():
    store = MagicMock()
    embedder = _fake_embedder()
    items = [_fake_appendix_item(i) for i in range(150)]

    coll, entries = index_appendix(store, embedder, "import-big", items, batch_size=64)

    assert len(entries) == 150
    # 150 in batches of 64 → 3 upsert calls
    assert store.upsert.call_count == 3
    # Embedder hit once per batch
    assert embedder.embed_batch.call_count == 3


def test_index_appendix_handles_empty_input():
    store = MagicMock()
    embedder = _fake_embedder()

    coll, entries = index_appendix(store, embedder, "import-empty", [])

    assert coll == gapfill_collection_name("import-empty")
    assert entries == []
    store.ensure_collection.assert_called_once()
    store.upsert.assert_not_called()


def test_drop_appendix_collection_calls_qdrant_delete():
    store = MagicMock()
    store._client = MagicMock()
    store._client.delete_collection.return_value = True

    assert drop_appendix_collection(store, "import-42") is True
    store._client.delete_collection.assert_called_once_with(
        collection_name=gapfill_collection_name("import-42")
    )


def test_drop_appendix_collection_idempotent_when_missing():
    store = MagicMock()
    store._client = MagicMock()
    store._client.delete_collection.side_effect = RuntimeError("not found")

    # Should swallow the error and report False rather than raise.
    assert drop_appendix_collection(store, "import-missing") is False


def test_drop_appendix_collection_without_underlying_client():
    """Falls through cleanly if VectorStore wrapper doesn't expose ``_client``."""
    store = MagicMock(spec=[])
    assert drop_appendix_collection(store, "import-42") is False


# --------------------------------------------------------------------- verify


def test_verify_candidate_parses_strict_json():
    client = _fake_anthropic([
        '{"addresses_gap": true, "confidence": 0.88, '
        '"classification": "evidence_file", "rationale": "Minutes match dates."}'
    ])
    v = verify_candidate(client, _fake_spec(), "Missing meeting minutes from 2024",
                         "Advisory committee minutes — September 12, 2024 …")
    assert v.addresses_gap is True
    assert v.confidence == pytest.approx(0.88)
    assert v.classification == "evidence_file"
    assert "match" in v.rationale.lower()


def test_verify_candidate_tolerates_fenced_json():
    client = _fake_anthropic([
        '```json\n{"addresses_gap": false, "confidence": 0.1, '
        '"classification": "narrative_text", "rationale": "Off-topic."}\n```'
    ])
    v = verify_candidate(client, _fake_spec(), "g", "candidate body")
    assert v.addresses_gap is False
    assert v.classification == "narrative_text"


def test_verify_candidate_falls_back_on_invalid_json():
    client = _fake_anthropic(["this is not json at all"])
    v = verify_candidate(client, _fake_spec(), "g", "candidate body " * 500)
    assert v.addresses_gap is False
    assert v.confidence == 0.0
    # 500 × "candidate body " is well over the file threshold
    assert v.classification == "evidence_file"


def test_verify_candidate_falls_back_on_unknown_classification():
    client = _fake_anthropic([
        '{"addresses_gap": true, "confidence": 0.9, '
        '"classification": "WHATEVER", "rationale": "ok"}'
    ])
    v = verify_candidate(client, _fake_spec(), "g", "short body")
    # Falls back to narrative_text because body is short
    assert v.classification == "narrative_text"


def test_fallback_classification_threshold():
    assert _fallback_classification("a b c") == "narrative_text"
    assert _fallback_classification("word " * 300) == "evidence_file"


def test_build_verify_prompt_includes_spec_gap_and_body():
    p = _build_verify_prompt(_fake_spec("3", "b"),
                             "Missing minutes",
                             "Advisory committee minutes …")
    assert "3.b" in p
    assert "Missing minutes" in p
    assert "Advisory committee minutes" in p
    assert "STRICT JSON" in p


# --------------------------------------------------------------------- search


def _hit(score: float, item_index: int, standard: str = "3", body: str = "body text"):
    return SearchHit(
        score=score,
        payload={
            "itemIndex": item_index,
            "itemTitle": f"Item {item_index}",
            "bodyText": body,
            "standardCode": standard,
            "appendixAnchor": f"Anchor{item_index}",
        },
    )


def test_search_gap_accepts_first_hit_above_threshold():
    store = MagicMock()
    store.search.return_value = [_hit(0.92, 5)]
    embedder = _fake_embedder()
    client = _fake_anthropic([
        '{"addresses_gap": true, "confidence": 0.9, '
        '"classification": "evidence_file", "rationale": "ok"}'
    ])

    outcome = search_gap(
        store=store, embedder=embedder, anthropic_client=client,
        collection="cshse_gapfill_t", spec=_fake_spec(), gap_text="Missing minutes",
    )

    assert outcome.accepted is not None
    assert outcome.accepted.candidate.item_index == 5
    assert outcome.rejected == []
    # Should have stopped after the first accepting verify call
    assert client.messages.create.call_count == 1


def test_search_gap_walks_past_rejected_candidates():
    """If Haiku rejects the first hit, we try the next one."""
    store = MagicMock()
    store.search.return_value = [_hit(0.9, 1), _hit(0.8, 2), _hit(0.7, 3)]
    embedder = _fake_embedder()
    # First two rejected, third accepted
    client = _fake_anthropic([
        '{"addresses_gap": false, "confidence": 0.2, "classification": "narrative_text", "rationale": "no"}',
        '{"addresses_gap": true, "confidence": 0.5, "classification": "narrative_text", "rationale": "borderline"}',
        '{"addresses_gap": true, "confidence": 0.8, "classification": "evidence_file", "rationale": "yes"}',
    ])

    outcome = search_gap(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", spec=_fake_spec(), gap_text="g",
    )

    assert outcome.accepted is not None
    assert outcome.accepted.candidate.item_index == 3
    # The second was true-but-below-threshold → rejected
    assert len(outcome.rejected) == 2


def test_search_gap_falls_back_to_unfiltered_when_filtered_rejected():
    """Standard-filtered pass returns rejects only, then unfiltered pass accepts."""
    store = MagicMock()
    filtered_hits = [_hit(0.8, 1)]
    unfiltered_hits = [_hit(0.6, 7, standard="14")]
    # First call (with filter) returns filtered_hits; second (no filter) returns unfiltered_hits
    store.search.side_effect = [filtered_hits, unfiltered_hits]
    embedder = _fake_embedder()
    client = _fake_anthropic([
        '{"addresses_gap": false, "confidence": 0.1, "classification": "narrative_text", "rationale": "no"}',
        '{"addresses_gap": true,  "confidence": 0.9, "classification": "evidence_file", "rationale": "yes"}',
    ])

    outcome = search_gap(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", spec=_fake_spec(), gap_text="g",
    )

    assert outcome.accepted is not None
    assert outcome.accepted.candidate.item_index == 7
    assert outcome.accepted.candidate.standard_code == "14"
    # Two qdrant calls (filter, then unfiltered)
    assert store.search.call_count == 2
    # First call had the standard filter
    first_call_kwargs = store.search.call_args_list[0].kwargs
    assert first_call_kwargs.get("payload_filter") == {"standardCode": "3"}
    # Second call had no filter
    second_call_kwargs = store.search.call_args_list[1].kwargs
    assert second_call_kwargs.get("payload_filter") is None


def test_search_gap_skips_seen_item_indices():
    """When the caller passes seen={5}, item 5 must not be re-verified."""
    store = MagicMock()
    # Both passes return only the seen item, so nothing should be accepted
    store.search.return_value = [_hit(0.99, 5)]
    embedder = _fake_embedder()
    client = _fake_anthropic([])  # Verifier should never be called

    outcome = search_gap(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", spec=_fake_spec(), gap_text="g",
        seen_item_indices={5},
    )

    assert outcome.accepted is None
    assert outcome.candidates == []  # Skipped entirely
    client.messages.create.assert_not_called()


def test_search_gap_dedupes_between_filtered_and_unfiltered_passes():
    """If the same item appears in both passes, only verify it once."""
    store = MagicMock()
    store.search.side_effect = [[_hit(0.8, 1)], [_hit(0.7, 1)]]  # same item
    embedder = _fake_embedder()
    client = _fake_anthropic([
        '{"addresses_gap": false, "confidence": 0.1, "classification": "narrative_text", "rationale": "no"}',
    ])

    outcome = search_gap(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", spec=_fake_spec(), gap_text="g",
    )

    # Verifier called once, not twice
    assert client.messages.create.call_count == 1
    assert outcome.accepted is None
    assert len(outcome.rejected) == 1


def test_search_gap_returns_empty_outcome_when_no_hits():
    store = MagicMock()
    store.search.return_value = []
    embedder = _fake_embedder()
    client = _fake_anthropic([])

    outcome = search_gap(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", spec=_fake_spec(), gap_text="g",
    )

    assert outcome.accepted is None
    assert outcome.candidates == []
    assert outcome.rejected == []
    client.messages.create.assert_not_called()


# --------------------------------------------------------------------- pipeline


def _coverage_review(std="3", sp="b", covered=False, gaps=None, strengths=None):
    return CoverageReview(
        standard_code=std,
        spec_code=sp,
        is_covered=covered,
        coverage_score=0.6 if not covered else 0.9,
        gaps=list(gaps or []),
        strengths=list(strengths or []),
        suggestion="x",
        raw_response="{}",
    )


def test_augmented_evidence_appends_fills_with_tag():
    base = [("orig title", "orig body")]
    fill = GapFill(
        gap_text="g",
        candidate=GapCandidate(
            item_index=1,
            item_title="App minutes",
            body_text="full minutes …",
            appendix_anchor="App1",
            standard_code="3",
            similarity=0.9,
        ),
        verification=GapVerification(True, 0.9, "evidence_file", "ok"),
    )
    aug = _augmented_evidence_for(base, [fill])
    assert len(aug) == 2
    assert aug[0] == ("orig title", "orig body")
    assert aug[1][0].startswith("[gap-fill] ")
    assert aug[1][1] == "full minutes …"


def test_pipeline_passes_through_covered_specs_without_search():
    """Specs Claude already accepted shouldn't trigger any qdrant or LLM calls."""
    store = MagicMock()
    embedder = _fake_embedder()
    client = _fake_anthropic([])
    reviewer = MagicMock()

    review = _coverage_review(covered=True, gaps=[])
    spec_lookup = {("3", "b"): _fake_spec()}

    results = run_gap_filling(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", initial_reviews=[review],
        spec_lookup=spec_lookup, narrative_lookup={}, evidence_lookup={},
        reviewer=reviewer,
    )

    assert len(results) == 1
    assert results[0].final_review is review
    store.search.assert_not_called()
    reviewer.review.assert_not_called()


def test_pipeline_passes_through_specs_with_no_gaps_listed():
    store = MagicMock()
    embedder = _fake_embedder()
    client = _fake_anthropic([])
    reviewer = MagicMock()

    review = _coverage_review(covered=False, gaps=[])
    spec_lookup = {("3", "b"): _fake_spec()}

    results = run_gap_filling(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", initial_reviews=[review],
        spec_lookup=spec_lookup, narrative_lookup={}, evidence_lookup={},
        reviewer=reviewer,
    )

    assert results[0].final_review is review
    store.search.assert_not_called()


def test_pipeline_skips_re_review_when_no_fills_found():
    """Save the second-pass LLM cost when nothing was filled."""
    store = MagicMock()
    store.search.return_value = []  # No hits at all
    embedder = _fake_embedder()
    client = _fake_anthropic([])
    reviewer = MagicMock()

    review = _coverage_review(gaps=["Missing minutes"])
    spec_lookup = {("3", "b"): _fake_spec()}

    results = run_gap_filling(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", initial_reviews=[review],
        spec_lookup=spec_lookup, narrative_lookup={}, evidence_lookup={},
        reviewer=reviewer,
    )

    assert results[0].final_review is review
    reviewer.review.assert_not_called()


def test_pipeline_augments_and_re_reviews_when_fill_found():
    """End-to-end happy path: gap found → augment → re-review with new evidence."""
    store = MagicMock()
    store.search.return_value = [_hit(0.9, 1, body="Advisory minutes Sep 2024 …")]
    embedder = _fake_embedder()
    # Verifier ACCEPTS the candidate
    client = _fake_anthropic([
        '{"addresses_gap": true, "confidence": 0.85, "classification": "evidence_file", "rationale": "ok"}',
    ])

    final = _coverage_review(covered=True, gaps=[], strengths=["Now has minutes"])
    reviewer = MagicMock()
    reviewer.review.return_value = final

    review = _coverage_review(gaps=["Missing minutes from last 2 years"])
    spec = _fake_spec()
    spec_lookup = {("3", "b"): spec}
    narrative_lookup = {("3", "b"): "the narrative …"}
    evidence_lookup = {("3", "b"): [("orig", "orig body")]}

    results = run_gap_filling(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", initial_reviews=[review],
        spec_lookup=spec_lookup, narrative_lookup=narrative_lookup,
        evidence_lookup=evidence_lookup, reviewer=reviewer,
    )

    res = results[0]
    assert res.final_review is final
    assert len(res.accepted_fills) == 1
    assert res.remaining_gap_count == 0

    # Reviewer was called with augmented evidence
    args, _kwargs = reviewer.review.call_args
    passed_spec, passed_narr, passed_evidence = args
    assert passed_spec is spec
    assert passed_narr == "the narrative …"
    assert len(passed_evidence) == 2  # 1 original + 1 gap-fill
    assert passed_evidence[1][0].startswith("[gap-fill] ")


def test_pipeline_unknown_spec_passes_through():
    """A review whose (std, spec) isn't in the lookup is returned unchanged."""
    store = MagicMock()
    embedder = _fake_embedder()
    client = _fake_anthropic([])
    reviewer = MagicMock()

    review = _coverage_review(std="99", sp="z", gaps=["x"])

    results = run_gap_filling(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", initial_reviews=[review],
        spec_lookup={}, narrative_lookup={}, evidence_lookup={},
        reviewer=reviewer,
    )

    assert results[0].final_review is review
    store.search.assert_not_called()


def test_pipeline_handles_multiple_gaps_with_seen_dedup():
    """Two gaps on the same spec must not both fill from the same appendix item."""
    store = MagicMock()
    # Both passes return the same item — pipeline should accept it for gap 1
    # and skip it for gap 2 (then exit empty-handed on gap 2).
    item_hit = _hit(0.9, 1)
    store.search.return_value = [item_hit]
    embedder = _fake_embedder()
    client = _fake_anthropic([
        '{"addresses_gap": true, "confidence": 0.9, "classification": "evidence_file", "rationale": "ok"}',
    ])
    reviewer = MagicMock()
    final = _coverage_review(covered=True, gaps=[])
    reviewer.review.return_value = final

    review = _coverage_review(gaps=["gap A", "gap B"])
    spec_lookup = {("3", "b"): _fake_spec()}

    results = run_gap_filling(
        store=store, embedder=embedder, anthropic_client=client,
        collection="c", initial_reviews=[review],
        spec_lookup=spec_lookup, narrative_lookup={}, evidence_lookup={},
        reviewer=reviewer,
    )

    res = results[0]
    assert len(res.outcomes) == 2
    # Gap A filled, Gap B not (item already used)
    assert res.outcomes[0].accepted is not None
    assert res.outcomes[1].accepted is None
    # Re-review still runs because one fill was found
    reviewer.review.assert_called_once()


def test_pipeline_requires_reviewer_or_anthropic_key():
    with pytest.raises(ValueError):
        run_gap_filling(
            store=MagicMock(), embedder=_fake_embedder(),
            anthropic_client=_fake_anthropic([]),
            collection="c", initial_reviews=[],
            spec_lookup={}, narrative_lookup={}, evidence_lookup={},
            reviewer=None, anthropic_key=None,
        )
