"""Unit tests for the transient-error classifier shared by the matcher and
the import_jobs error-routing logic. These guard against future contributors
swapping out the heuristics without realising the wizard error banner
depends on the classification: "transient" → warnings (silent),
"hard" → errors (red banner)."""
from __future__ import annotations

import pytest


class _FakeStatusErr(Exception):
    def __init__(self, status_code: int, msg: str = ""):
        super().__init__(msg)
        self.status_code = status_code


def test_matcher_transient_classifier_catches_disconnect_string():
    from app.matcher.spec_matcher import _is_transient_anthropic_error

    assert _is_transient_anthropic_error(
        Exception("Server disconnected without sending a response.")
    )


def test_matcher_transient_classifier_catches_timeout_string():
    from app.matcher.spec_matcher import _is_transient_anthropic_error

    assert _is_transient_anthropic_error(TimeoutError("read timeout"))
    assert _is_transient_anthropic_error(Exception("Connection reset by peer"))


def test_matcher_transient_classifier_catches_5xx_status():
    from app.matcher.spec_matcher import _is_transient_anthropic_error

    assert _is_transient_anthropic_error(_FakeStatusErr(503, "service unavailable"))
    assert _is_transient_anthropic_error(_FakeStatusErr(502))
    assert _is_transient_anthropic_error(_FakeStatusErr(500))


def test_matcher_transient_classifier_rejects_4xx_status():
    from app.matcher.spec_matcher import _is_transient_anthropic_error

    # 401/403/400 are NOT transient - retrying them never helps. They
    # belong in the errors[] banner so the operator can fix the cause.
    assert not _is_transient_anthropic_error(_FakeStatusErr(401, "unauthorized"))
    assert not _is_transient_anthropic_error(_FakeStatusErr(403, "forbidden"))
    assert not _is_transient_anthropic_error(_FakeStatusErr(400, "bad request"))


def test_matcher_transient_classifier_rejects_plain_runtime_error():
    from app.matcher.spec_matcher import _is_transient_anthropic_error

    # A KeyError or AttributeError from our own code path is a bug, not a
    # transient API hiccup - must surface as a real error.
    assert not _is_transient_anthropic_error(KeyError("standardCode"))
    assert not _is_transient_anthropic_error(AttributeError("foo"))
    assert not _is_transient_anthropic_error(ValueError("bad JSON"))


def test_import_jobs_classifier_matches_matcher_classifier_for_transient():
    """The two classifiers should agree on the obvious cases - if they
    drift apart, the wizard's "warnings vs errors" routing breaks."""
    from app.matcher.spec_matcher import _is_transient_anthropic_error as cls_matcher
    from app.import_jobs import _is_transient_runtime_error as cls_jobs

    cases = [
        Exception("Server disconnected without sending a response."),
        TimeoutError("read timeout"),
        Exception("Connection reset by peer"),
        _FakeStatusErr(503),
    ]
    for exc in cases:
        assert cls_matcher(exc), f"matcher misses: {exc}"
        assert cls_jobs(exc), f"import_jobs misses: {exc}"


def test_import_jobs_classifier_rejects_runtime_bugs():
    from app.import_jobs import _is_transient_runtime_error

    assert not _is_transient_runtime_error(KeyError("standardCode"))
    assert not _is_transient_runtime_error(ValueError("bad JSON"))
    assert not _is_transient_runtime_error(_FakeStatusErr(404))
