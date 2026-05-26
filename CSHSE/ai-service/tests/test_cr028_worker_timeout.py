"""
CR-028 — Matcher worker outer-timeout safety net.

The per-call timeouts on Anthropic/OpenAI/Qdrant inside
``SpecMatcher.recommend`` already cap any single network hop at ~60s.
The CR-028 outer safety net in ``app.import_jobs`` adds a SECOND layer
at the ``concurrent.futures`` level: each future is awaited via
``fut.result(timeout=N)`` so a worker still mid-flight when result() is
called raises FuturesTimeoutError, the loop logs a warning, and the
section is soft-failed rather than blocking the whole pipeline.

The test pins:
   1. The ``fut.result(timeout=N)`` idiom raises FuturesTimeoutError
      when the future isn't done — this is the load-bearing API.
   2. The catch-and-warn pattern in import_jobs.py is structurally
      preserved (grep-style inspection assertion).
   3. The CR-028 anchor comment is still in place so a future contributor
      reading the file knows WHY the timeout is there.
"""
from __future__ import annotations

import time
from concurrent.futures import (
    ThreadPoolExecutor,
    TimeoutError as FuturesTimeoutError,
)


def _slow_worker(seconds: float, value: int) -> int:
    time.sleep(seconds)
    return value * 2


def _fast_worker(value: int) -> int:
    return value * 2


def test_future_result_with_timeout_raises_when_worker_not_yet_done():
    """The load-bearing idiom: calling fut.result(timeout=tiny) on a
    future whose worker is still asleep MUST raise FuturesTimeoutError.

    This is the exact API CR-028's outer safety net depends on. If a
    Python upgrade changes this semantics (it won't, but pin it), the
    safety net silently degrades to a no-op wait."""
    with ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(_slow_worker, 0.5, 7)
        try:
            # 50ms < 500ms sleep → still in flight when we call result.
            fut.result(timeout=0.05)
            raise AssertionError("expected FuturesTimeoutError")
        except FuturesTimeoutError:
            pass
        # Let the worker finish so the pool can shut down cleanly.
        fut.result(timeout=5.0)


def test_future_result_returns_value_when_worker_done_before_timeout():
    """The happy path: when the worker completes inside the budget,
    result() returns the value and no timeout fires. This is the
    overwhelming common case in production."""
    with ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(_fast_worker, 5)
        assert fut.result(timeout=1.0) == 10


def test_future_cancel_on_timeout_is_best_effort_not_a_kill():
    """The production code calls fut.cancel() after a timeout. cancel()
    returns True if the future was PENDING; False if it's RUNNING (you
    can't cancel a running thread in Python). This test pins that
    behaviour so a contributor doesn't expect cancel() to kill workers."""
    with ThreadPoolExecutor(max_workers=1) as ex:
        fut = ex.submit(_slow_worker, 0.3, 1)
        # Give the executor a moment to actually start the thread.
        time.sleep(0.05)
        # The future is running; cancel() returns False.
        assert fut.cancel() is False
        # Drain so the test exits cleanly.
        fut.result(timeout=5.0)


def test_import_jobs_module_still_uses_concurrent_futures_pattern():
    """Grep-style regression guard. If a future contributor swaps to
    asyncio or removes the per-future timeout, this test fails loudly.

    The CR-028 invariant is structural: the outer safety net MUST use a
    timeout-on-result idiom OR an equivalent. Tying the test to the
    file contents catches "we converted to asyncio and forgot to add a
    wait_for() wrapper" regressions before they hit production."""
    import inspect

    from app import import_jobs

    src = inspect.getsource(import_jobs)
    # The pattern must still be present somewhere.
    assert ("fut.result(timeout=" in src) or ("future.result(timeout=" in src), (
        "CR-028 outer-timeout pattern missing from import_jobs.py — the "
        "per-section safety net no longer guards against wedged workers."
    )
    # The CR-028 anchor comment is still present so a contributor reading
    # the file knows WHY the timeout is there.
    assert "CR-028" in src
    # FuturesTimeoutError must be caught + soft-failed (warnings.append,
    # not job.errors.append) — the contract is "a wedged section doesn't
    # turn into a wizard-red-banner failure for the whole import".
    assert "FuturesTimeoutError" in src
    assert "warnings.append" in src
