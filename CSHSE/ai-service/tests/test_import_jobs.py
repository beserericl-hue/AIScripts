"""Offline tests for the import job tracker.

Covers the queue mechanics that drive the wizard's UI:
  - enqueue assigns a job_id and initial queue position
  - multiple enqueues stack in FIFO order
  - cancel removes a queued job and bumps everyone behind it up
  - cancel on running flips status
  - cancel on terminal returns False
  - get_job returns None for missing IDs

The actual pipeline body (mammoth → walkers → matcher) is not exercised
here — it requires live OpenAI / Anthropic / Qdrant. Pipeline behaviour
is covered by the integration smoke runs.
"""
from __future__ import annotations

from unittest.mock import patch

from app import import_jobs


def _reset_jobs():
    """Clear the module-level state between tests so they don't bleed."""
    import_jobs._JOBS.clear()
    import_jobs._QUEUE.clear()
    import_jobs._WORKER_BUSY = False
    import_jobs._WORKER_STARTED = False


def _stub_enqueue(import_id="imp-1"):
    """Enqueue without firing the webhook or starting the real worker."""
    with patch.object(import_jobs, "_publish_status"), \
         patch.object(import_jobs, "_publish_terminal"), \
         patch.object(import_jobs, "_ensure_worker"):
        return import_jobs.enqueue_job(
            import_id=import_id,
            s3_key=f"{import_id}/source.docx",
            submission_id="sub-1",
            program_level="bachelors",
            force_format=None,
            callback_url="https://server/api/imports/imp-1/ai-callback",
            event_callback_url="https://server/api/imports/imp-1/ai-event",
        )


# ---------------------------------------------------------------- enqueue


def test_enqueue_assigns_job_id_and_queue_position():
    _reset_jobs()
    snap = _stub_enqueue()
    assert snap["jobId"].startswith("job-")
    assert snap["status"] == "queued"
    assert snap["queuePosition"] == 1
    assert snap["queueDepth"] == 1
    assert snap["errors"] == []


def test_multiple_enqueues_get_fifo_positions():
    _reset_jobs()
    snaps = [_stub_enqueue(f"imp-{i}") for i in range(3)]

    # All three are queued behind a worker that never started (we stubbed
    # ensure_worker), so they retain their FIFO positions.
    assert snaps[0]["queuePosition"] == 1
    # After enqueue #2, depth becomes 2 but snap[0] still shows old value.
    # Re-fetch snapshots from the registry to get the latest:
    latest = [import_jobs.get_job(s["jobId"]) for s in snaps]
    assert [j["queuePosition"] for j in latest] == [1, 2, 3]
    assert all(j["queueDepth"] == 3 for j in latest)


# ---------------------------------------------------------------- get_job


def test_get_job_returns_none_for_missing_id():
    _reset_jobs()
    assert import_jobs.get_job("job-nope") is None


def test_get_job_returns_snapshot_for_existing():
    _reset_jobs()
    snap = _stub_enqueue()
    fetched = import_jobs.get_job(snap["jobId"])
    assert fetched is not None
    assert fetched["jobId"] == snap["jobId"]
    assert fetched["importId"] == "imp-1"


# ---------------------------------------------------------------- cancel


def test_cancel_queued_job_removes_from_queue_and_bumps_others():
    _reset_jobs()
    snaps = [_stub_enqueue(f"imp-{i}") for i in range(3)]

    with patch.object(import_jobs, "_publish_status"), \
         patch.object(import_jobs, "_publish_terminal"):
        ok = import_jobs.cancel_job(snaps[1]["jobId"])  # cancel middle one
    assert ok is True

    # The cancelled job is now in terminal "canceled" state and
    # NOT in the active queue.
    cancelled = import_jobs.get_job(snaps[1]["jobId"])
    assert cancelled["status"] == "canceled"
    assert snaps[1]["jobId"] not in import_jobs._QUEUE

    # The remaining jobs are at positions 1 and 2 (was 1 and 3).
    remaining = [import_jobs.get_job(snaps[0]["jobId"]), import_jobs.get_job(snaps[2]["jobId"])]
    assert remaining[0]["queuePosition"] == 1
    assert remaining[1]["queuePosition"] == 2
    assert all(r["queueDepth"] == 2 for r in remaining)


def test_cancel_on_terminal_status_returns_false():
    _reset_jobs()
    snap = _stub_enqueue()
    # Manually flip to terminal — simulates a parsed/failed job.
    import_jobs._JOBS[snap["jobId"]].status = "parsed"
    with patch.object(import_jobs, "_publish_status"), \
         patch.object(import_jobs, "_publish_terminal"):
        ok = import_jobs.cancel_job(snap["jobId"])
    assert ok is False
    assert import_jobs.get_job(snap["jobId"])["status"] == "parsed"


def test_cancel_missing_job_returns_false():
    _reset_jobs()
    with patch.object(import_jobs, "_publish_status"), \
         patch.object(import_jobs, "_publish_terminal"):
        ok = import_jobs.cancel_job("job-nope")
    assert ok is False


# ---------------------------------------------------------------- signing


def test_hmac_signature_format_matches_inbound_verifier():
    """Outbound webhooks must use the same format auth.verify_hmac_signature accepts."""
    body = b'{"status":"parsing"}'
    sig = import_jobs._hmac_sign(body, "test-secret")
    # Format: t=<unix>,v1=<hex>
    parts = dict(p.split("=", 1) for p in sig.split(","))
    assert "t" in parts and parts["t"].isdigit()
    assert "v1" in parts and len(parts["v1"]) == 64  # hex SHA-256


def test_hmac_signature_empty_when_no_secret():
    """No secret → no signature; webhook still posts but unauth'd. Caller can decide."""
    assert import_jobs._hmac_sign(b"x", "") == ""


# ---------------------------------------------------------------- conversion helpers


def test_section_to_item_strips_heading_prefix_from_markdown():
    """The template walker emits ``# heading\\n\\nbody``; the item snippet
    should be just the body so the wizard doesn't double-render the heading."""
    class _Sec:
        id = "sec-1"
        heading = "1. Specify the degree(s)"
        markdown = "# 1. Specify the degree(s)\n\nBachelor of Science in Human Services."
        word_count = 6

    class _Rec:
        primary_confidence = 0.94
        accept_state = "auto_accept"
        rationale = "Matches Spec 1.a."

    item = import_jobs._section_to_item(_Sec(), _Rec())
    assert item["heading"] == "1. Specify the degree(s)"
    assert item["snippet"] == "Bachelor of Science in Human Services."
    assert item["wordCount"] == 6


def test_recommendation_to_tag_handles_null_rec():
    """Tags for sections the matcher couldn't recommend on still get sensible defaults."""
    class _Sec:
        id = "sec-2"
        heading = "Untagged section"
        markdown = "Some body text."

    tag = import_jobs._recommendation_to_tag(_Sec(), None)
    assert tag["tagId"].startswith("tag-")
    assert tag["suggestedStd"] is None
    assert tag["confidence"] == 0.0
    assert tag["acceptState"] == "review_unknown"
