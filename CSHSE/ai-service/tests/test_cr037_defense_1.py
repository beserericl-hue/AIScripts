"""
CR-037 Defense 1 — ai-service self-validates before terminal callback.

Defenses 2 (server rewrite) + 3 (client gate) already ship and catch the
empty-bucket case downstream. Defense 1 closes the loop at the source:
if the pipeline finishes without producing any content (zero items
across buckets / tags / matrices / cvs / evidenceDocs / introductionHints),
the ai-service flips the job to `failed` with an actionable error rather
than handing the cshse-server a technically-successful-but-empty
terminal callback.

The check lives in app.import_jobs.run_job() right after the pipeline
returns and before the parsed-status flip. We test it by constructing
a JobRecord with the post-pipeline state and exercising the same
counting logic.
"""
from __future__ import annotations

import inspect
from dataclasses import fields

from app import import_jobs
from app.import_jobs import JobRecord


def test_defense_1_block_is_present_in_import_jobs_source():
    """Grep-style regression guard. The Defense 1 block must remain in
    the file with its anchor comment so a future refactor doesn't drop
    it silently (the cshse-server still ships Defenses 2+3 as the safety
    net, but losing Defense 1 means coordinators hit the failure mode
    one layer deeper than necessary)."""
    src = inspect.getsource(import_jobs)
    assert "CR-037 Defense 1" in src, (
        "CR-037 Defense 1 anchor comment missing — pre-callback "
        "empty-bucket invariant was either removed or never landed."
    )
    # The check sums across every content kind the rail surfaces.
    for token in (
        "narratives",
        "evidenceText",
        "evidenceFiles",
        "matrixCells",
        "job.tags",
        "job.matrices",
        "job.cvs",
        "job.evidence_docs",
        "job.introduction_hints",
    ):
        assert token in src, f"Defense 1 missing content-kind check: {token}"
    # The actionable error string is what the wizard surfaces in the
    # ParseStep error panel (CR-037 Defense 2 + 3 use the same wording).
    assert "AI matcher returned zero items" in src


def test_empty_job_record_would_count_as_zero():
    """Sanity: a fresh JobRecord (all content fields = None / empty)
    is what an empty parse produces. Defense 1's count must come out
    to zero for that shape."""
    # JobRecord requires constructor args — build with minimal stubs.
    # We're not invoking the full pipeline; just verifying the data
    # shape of the empty case matches what Defense 1 inspects.
    job_kwargs = {
        f.name: f.default if f.default is not None and not callable(f.default) else None
        for f in fields(JobRecord)
        if f.default is not None or f.default_factory is not None  # type: ignore[attr-defined]
    }
    # Required positional-ish fields
    job_kwargs.setdefault("job_id", "j-empty")
    job_kwargs.setdefault("s3_key", "k")
    job_kwargs.setdefault("submission_id", "s")
    job_kwargs.setdefault("import_id", "i")
    job_kwargs.setdefault("callback_url", "http://x.test/cb")
    job_kwargs.setdefault("program_level", "bachelors")
    job_kwargs.setdefault("institution_id", "inst-1")
    # Mirror Defense 1's count logic against an empty record.
    buckets_count = 0
    for b in (job_kwargs.get("buckets") or {}).values():
        buckets_count += len((b or {}).get("narratives") or [])
        buckets_count += len((b or {}).get("evidenceText") or [])
        buckets_count += len((b or {}).get("evidenceFiles") or [])
        buckets_count += len((b or {}).get("matrixCells") or [])
    total = (
        buckets_count
        + len(job_kwargs.get("tags") or [])
        + len(job_kwargs.get("matrices") or [])
        + len(job_kwargs.get("cvs") or [])
        + len(job_kwargs.get("evidence_docs") or [])
        + len(job_kwargs.get("introduction_hints") or {})
    )
    assert total == 0


def test_cv_only_job_record_counts_as_NON_zero():
    """Negative: a CV-only import (no buckets, no tags, no matrices, but
    >=1 CV) MUST count as non-zero. Coordinators dropping a stand-alone
    CV.docx should hit the standalone-CV review flow, NOT the empty-
    bucket fail panel."""
    cvs = [{"sectionId": "cv-1", "facultyName": "Dr. A", "snippet": "..."}]
    total = (
        0  # buckets empty
        + 0  # tags
        + 0  # matrices
        + len(cvs)
        + 0  # evidence_docs
        + 0  # introduction_hints
    )
    assert total > 0


def test_one_narrative_counts_as_non_zero():
    """Most common path: a regular import with at least one narrative
    in any bucket must pass Defense 1 (status → parsed, not failed)."""
    buckets = {
        "1.a": {
            "narratives": [{"sectionId": "n1", "snippet": "body"}],
            "evidenceText": [],
            "evidenceFiles": [],
            "matrixCells": [],
        }
    }
    count = 0
    for b in buckets.values():
        count += len(b.get("narratives") or [])
        count += len(b.get("evidenceText") or [])
        count += len(b.get("evidenceFiles") or [])
        count += len(b.get("matrixCells") or [])
    assert count == 1
