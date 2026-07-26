"""Tests for the data-driven parser rule engine (CR-073).

The engine is STRICTLY default-preserving: with no matching active rules the
parse output must be byte-identical to today. These tests prove:

  * ``fetch_active_rules`` returns [] gracefully when ``mongo_url`` is "".
  * ``apply_post_pass`` with an empty rules list is a strict no-op (buckets
    deep-equal to a fixture).
  * a routing+classification rule MOVES a matching item and leaves the rest
    untouched.
  * a rule whose signature matches nothing is a no-op.
"""
from __future__ import annotations

import copy

import pytest

from app.config import get_settings
from app.rules.engine import RuleEngine, fetch_active_rules


# ---------------------------------------------------------------- fixtures


class _FakeJob:
    """Minimal stand-in for JobRecord — the engine only reads .buckets /
    .introductions."""

    def __init__(self, buckets=None, introductions=None, tags=None):
        self.buckets = buckets
        self.introductions = introductions
        self.tags = tags


def _fixture_buckets() -> dict:
    """Two placed items: a 'foo' narrative in 1.a and a 'bar' one in 2.b."""
    return {
        "1.a": {
            "standardCode": "1",
            "specCode": "a",
            "narratives": [
                {
                    "sectionId": "sec-foo",
                    "heading": "1.a Something",
                    "snippet": "This paragraph mentions FOO in the body.",
                    "htmlSnippet": None,
                    "wordCount": 8,
                }
            ],
            "evidenceText": [],
            "evidenceFiles": [],
        },
        "2.b": {
            "standardCode": "2",
            "specCode": "b",
            "narratives": [
                {
                    "sectionId": "sec-bar",
                    "heading": "2.b Other",
                    "snippet": "This one is about baseline knowledge only.",
                    "htmlSnippet": None,
                    "wordCount": 7,
                }
            ],
            "evidenceText": [],
            "evidenceFiles": [],
        },
    }


# ---------------------------------------------------------------- fetch


def test_fetch_returns_empty_when_mongo_url_blank(monkeypatch):
    """No MONGO_URL → [] with no connection attempt, no exception."""
    settings = get_settings()
    monkeypatch.setattr(settings, "mongo_url", "", raising=False)
    assert fetch_active_rules("template", None, None) == []


def test_fetch_swallows_errors(monkeypatch):
    """Any error inside fetch → [] (parsing must never break)."""
    import app.rules.engine as eng

    def _boom():
        raise RuntimeError("mongo exploded")

    monkeypatch.setattr(eng, "_client", _boom)
    assert eng.fetch_active_rules("template", "inst1", "bachelors") == []


# ---------------------------------------------------------------- no-op


def test_empty_rules_is_strict_noop():
    """apply_post_pass with no rules leaves buckets byte-identical."""
    buckets = _fixture_buckets()
    before = copy.deepcopy(buckets)
    job = _FakeJob(buckets=buckets)

    engine = RuleEngine([])
    summary = engine.apply_post_pass(job)

    assert summary == {"moved": 0, "reclassified": 0, "placedTags": 0, "appliedRuleIds": []}
    assert job.buckets == before  # deep-equal: nothing moved or reclassified


def test_signature_matching_nothing_is_noop():
    """An active routing rule whose signature matches no item is a no-op."""
    buckets = _fixture_buckets()
    before = copy.deepcopy(buckets)
    job = _FakeJob(buckets=buckets)

    rule = {
        "ruleId": "test.no-match",
        "match": {"signature": {"textContains": "nonexistent-needle"}},
        "extract": {
            "classification": "narrative",
            "params": {"std": "5", "spec": "a"},
        },
        "confidence": 1.0,
    }
    summary = RuleEngine([rule]).apply_post_pass(job)

    assert summary == {"moved": 0, "reclassified": 0, "placedTags": 0, "appliedRuleIds": []}
    assert job.buckets == before


def test_baseline_structural_signatures_are_noop():
    """Seeded baseline rules carry structural signatures (regex/columnCount)
    the post-pass does not evaluate → they must move nothing."""
    buckets = _fixture_buckets()
    before = copy.deepcopy(buckets)
    job = _FakeJob(buckets=buckets)

    baseline_like = [
        {
            "ruleId": "tmpl.spec-row",
            "match": {"signature": {"letterMarkerRegex": "^\\s*([a-j])[.)]?\\s*$"}},
            "extract": {"classification": "narrative"},
            "confidence": 1.0,
        },
        {
            "ruleId": "mcc.standard-hash",
            "match": {"signature": {"standardHashRegex": "^Standard\\s+#?\\d+"}},
            "extract": {"classification": "narrative"},
            "confidence": 1.0,
        },
    ]
    summary = RuleEngine(baseline_like).apply_post_pass(job)

    assert summary == {"moved": 0, "reclassified": 0, "placedTags": 0, "appliedRuleIds": []}
    assert job.buckets == before


# ---------------------------------------------------------------- move


def test_routing_rule_moves_matching_item_only():
    """textContains:'foo' + params std/spec → move sec-foo from 1.a to 5.a;
    the non-matching 2.b item stays put."""
    buckets = _fixture_buckets()
    job = _FakeJob(buckets=buckets)

    rule = {
        "ruleId": "test.route-foo",
        "match": {"signature": {"textContains": "foo"}},
        "extract": {
            "classification": "narrative",
            "params": {"std": "5", "spec": "a"},
        },
        "confidence": 1.0,
    }
    summary = RuleEngine([rule]).apply_post_pass(job)

    assert summary["moved"] == 1
    assert summary["reclassified"] == 0
    assert summary["appliedRuleIds"] == ["test.route-foo"]

    # sec-foo left 1.a
    assert job.buckets["1.a"]["narratives"] == []
    # ...and landed in a freshly created 5.a bucket (create-missing shape)
    dest = job.buckets["5.a"]
    assert dest["standardCode"] == "5"
    assert dest["specCode"] == "a"
    assert [i["sectionId"] for i in dest["narratives"]] == ["sec-foo"]
    assert dest["evidenceText"] == []
    assert dest["evidenceFiles"] == []

    # the non-matching 2.b item is untouched
    assert [i["sectionId"] for i in job.buckets["2.b"]["narratives"]] == ["sec-bar"]


def test_reclassify_in_place_to_evidence_file_stamps_subkind():
    """A classification-only rule (no target std/spec) moves an item to a
    different sub-list of the SAME bucket and stamps docSubKind."""
    buckets = _fixture_buckets()
    job = _FakeJob(buckets=buckets)

    rule = {
        "ruleId": "test.reclass-foo",
        "match": {"signature": {"currentBucket": "1.a", "textContains": "foo"}},
        "extract": {"classification": "appendix"},
        "confidence": 1.0,
    }
    summary = RuleEngine([rule]).apply_post_pass(job)

    assert summary["moved"] == 0
    assert summary["reclassified"] == 1
    assert job.buckets["1.a"]["narratives"] == []
    files = job.buckets["1.a"]["evidenceFiles"]
    assert [i["sectionId"] for i in files] == ["sec-foo"]
    assert files[0]["docSubKind"] == "appendix"


def test_section_id_equals_signature():
    """sectionIdEquals targets one exact item."""
    buckets = _fixture_buckets()
    job = _FakeJob(buckets=buckets)

    rule = {
        "ruleId": "test.by-id",
        "match": {"signature": {"sectionIdEquals": "sec-bar"}},
        "extract": {
            "classification": "narrative",
            "params": {"std": "9", "spec": "c"},
        },
        "confidence": 1.0,
    }
    summary = RuleEngine([rule]).apply_post_pass(job)

    assert summary["moved"] == 1
    assert [i["sectionId"] for i in job.buckets["9.c"]["narratives"]] == ["sec-bar"]
    assert job.buckets["2.b"]["narratives"] == []
    # sec-foo (a different id) never moved
    assert [i["sectionId"] for i in job.buckets["1.a"]["narratives"]] == ["sec-foo"]


# ---------------------------------------------------------------- tag routing


def _fixture_tags() -> list:
    """Two unplaced tags in the ``job.tags`` shape (see
    import_jobs._recommendation_to_tag)."""
    return [
        {
            "tagId": "tag-aaaa1111",
            "sectionId": "sec-tag-orphan",
            "summary": "Program Evaluation Plan",
            "fullText": "This section describes our WIDGET evaluation methodology "
            "and annual review cycle in detail.",
            "htmlSnippet": None,
            "suggestedStd": None,
            "suggestedSpec": None,
            "confidence": 0.12,
            "sourceHeading": "Program Evaluation Plan",
            "acceptState": "review_unknown",
            "rationale": "Matcher returned low confidence.",
            "byteOffsetStart": 4200,
        },
        {
            "tagId": "tag-bbbb2222",
            "sectionId": "sec-tag-keep",
            "summary": "Miscellaneous appendix listing",
            "fullText": "An unrelated index of gadget references nobody routes.",
            "htmlSnippet": None,
            "suggestedStd": None,
            "suggestedSpec": None,
            "confidence": 0.05,
            "sourceHeading": "Miscellaneous appendix listing",
            "acceptState": "review_unknown",
            "rationale": "Matcher returned no recommendation.",
            "byteOffsetStart": 8800,
        },
    ]


def test_routing_rule_places_matching_tag_into_bucket():
    """A textContains rule matching a tag's fullText + routing to 5.a MOVES the
    tag out of job.tags and INTO buckets['5.a'].narratives as a bucket item."""
    buckets = _fixture_buckets()
    tags = _fixture_tags()
    job = _FakeJob(buckets=buckets, tags=tags)

    rule = {
        "ruleId": "test.place-widget",
        "match": {"signature": {"textContains": "widget"}},  # matches fullText
        "extract": {
            "classification": "narrative",
            "params": {"std": "5", "spec": "a"},
        },
        "confidence": 1.0,
    }
    summary = RuleEngine([rule]).apply_post_pass(job)

    assert summary["placedTags"] == 1
    assert summary["moved"] == 0
    assert summary["reclassified"] == 0
    assert summary["appliedRuleIds"] == ["test.place-widget"]

    # The matched tag left job.tags (removed by identity)...
    assert [t["sectionId"] for t in job.tags] == ["sec-tag-keep"]
    # ...and landed in a freshly created 5.a bucket, converted to a bucket item.
    dest = job.buckets["5.a"]
    assert [i["sectionId"] for i in dest["narratives"]] == ["sec-tag-orphan"]
    placed = dest["narratives"][0]
    # Converted shape: heading from summary, snippet from fullText, wordCount set.
    assert placed["heading"] == "Program Evaluation Plan"
    assert placed["snippet"].startswith("This section describes our WIDGET")
    assert placed["wordCount"] == len(
        _fixture_tags()[0]["fullText"].split()
    )
    assert "fullText" not in placed  # it's a bucket item now, not a tag


def test_empty_rules_leaves_tags_untouched():
    """apply_post_pass with no rules is a strict no-op — job.tags deep-equal."""
    tags = _fixture_tags()
    before = copy.deepcopy(tags)
    job = _FakeJob(buckets=_fixture_buckets(), tags=tags)

    summary = RuleEngine([]).apply_post_pass(job)

    assert summary == {"moved": 0, "reclassified": 0, "placedTags": 0, "appliedRuleIds": []}
    assert job.tags == before  # deep-equal: no tag moved, mutated, or removed


def test_unmatched_tag_stays_in_tags():
    """A tag no rule matches stays in job.tags untouched."""
    tags = _fixture_tags()
    before = copy.deepcopy(tags)
    job = _FakeJob(buckets=_fixture_buckets(), tags=tags)

    # This rule matches the FIRST tag only ('widget'), never the second.
    rule = {
        "ruleId": "test.place-widget",
        "match": {"signature": {"textContains": "widget"}},
        "extract": {"classification": "narrative", "params": {"std": "5", "spec": "a"}},
        "confidence": 1.0,
    }
    RuleEngine([rule]).apply_post_pass(job)

    # The un-matched 'gadget' tag is still present and identical to before.
    remaining = [t for t in job.tags if t["sectionId"] == "sec-tag-keep"]
    assert len(remaining) == 1
    assert remaining[0] == before[1]


def test_classification_only_rule_does_not_place_tag():
    """A tag can only be placed by a ROUTING rule (needs a dest bucket). A
    classification-only rule that matches a tag is a no-op — the tag stays."""
    tags = _fixture_tags()
    before = copy.deepcopy(tags)
    job = _FakeJob(buckets=_fixture_buckets(), tags=tags)

    rule = {
        "ruleId": "test.reclass-only",
        "match": {"signature": {"textContains": "widget"}},
        "extract": {"classification": "appendix"},  # no params.std/spec → no routing
        "confidence": 1.0,
    }
    summary = RuleEngine([rule]).apply_post_pass(job)

    assert summary["placedTags"] == 0
    assert job.tags == before
