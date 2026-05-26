"""
CR-039 Phase 2c — matcher prompt extension + LLM-driven intro routing.

Phase 1/2a/2b: heuristic introduction_detector flags intro headings
BEFORE the matcher runs, populating job.introduction_hints. Phase 2b
ships the existing routing where heuristic-flagged + low-matcher-
confidence sections are routed to intro tags.

Phase 2c closes the false-negative gap: when the heuristic misses an
intro (e.g. no "Introduction" keyword in the heading), the matcher
itself classifies via section_type='introduction'. The post-matcher
routing in import_jobs.py back-fills job.introduction_hints from the
matcher classification and treats the section as an intro override
regardless of confidence.

This test pins:
   1. SectionType literal includes 'introduction'.
   2. The matcher prompt instructs Haiku on what an intro looks like
      + provides matcher-style intro examples.
   3. The post-matcher routing back-fills introduction_hints from
      rec.section_type='introduction' when the heuristic missed.
   4. The warning telemetry breaks down heuristic vs matcher-LLM
      override counts.
"""
from __future__ import annotations

import inspect


def test_section_type_literal_includes_introduction():
    """The SectionType union added 'introduction' so the Haiku response
    parser accepts the new value without falling back to 'unknown'."""
    from app.matcher import spec_matcher

    # The Literal isn't easily introspectable across Python versions;
    # source-grep is the reliable assertion.
    src = inspect.getsource(spec_matcher)
    assert '"introduction"' in src, (
        "SectionType union missing the 'introduction' member — Haiku's "
        "introduction classification would be parsed as 'unknown'."
    )


def test_prompt_describes_introduction_section_type():
    """The system-prompt enum explanation MUST include the 'introduction'
    line so Haiku knows when to pick it. Without this, the model
    defaults to 'narrative_response' for intro-shaped sections, which
    is the false positive CR-039 closes."""
    from app.matcher import spec_matcher

    src = inspect.getsource(spec_matcher)
    # The enum-description block.
    assert "- introduction:" in src
    # Anchored phrases that survive minor edits.
    for anchor in ("mission", "Welcome", "About"):
        assert anchor in src, f"intro signal anchor '{anchor}' missing from prompt"
    # The field-rules list must include 'introduction' as a valid value.
    assert (
        '"introduction"' in src
        and '"section_type":' in src
    )


def test_prompt_includes_at_least_one_intro_example():
    """Haiku follows few-shot examples more reliably than rule-only
    instructions. Phase 2c added at least one section_type='introduction'
    example to the prompt's EXAMPLES block."""
    from app.matcher import spec_matcher

    src = inspect.getsource(spec_matcher)
    # The two CR-039 examples both contain this anchor pattern.
    assert '"section_type":"introduction"' in src


def test_import_jobs_backfills_intro_hint_from_matcher_classification():
    """When the heuristic detector missed a section but the matcher
    classified it as section_type='introduction', the routing code
    MUST back-fill job.introduction_hints[sec.id] so the terminal
    callback carries the hint to the wizard."""
    from app import import_jobs

    src = inspect.getsource(import_jobs)
    # The back-fill branch must look at rec.section_type.
    assert 'rec.section_type == "introduction"' in src, (
        "post-matcher routing no longer checks for matcher-LLM intro "
        "classification — false-negative gap reopened."
    )
    # The synthesized hint must use the standard-N or document key
    # convention so the Zustand store routes it to the right bucket.
    assert 'introduction:standard-' in src
    assert 'introduction:document' in src
    # Back-fill writes the hint into job.introduction_hints so terminal
    # callback carries it (Phase 2b already persists this dict).
    assert 'job.introduction_hints[sec.id]' in src


def test_telemetry_breaks_down_heuristic_vs_matcher_override_counts():
    """The post-routing warning records both sources separately so the
    audit log shows how often each caught an intro the other missed.
    Useful for tuning the heuristic + the prompt over time."""
    from app import import_jobs

    src = inspect.getsource(import_jobs)
    assert "heuristic=" in src
    assert "matcher_llm=" in src
    assert "matcher_intro_count" in src
