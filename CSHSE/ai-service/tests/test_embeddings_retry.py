"""Embedding client retries transient errors instead of hard-failing the import."""
from __future__ import annotations

import types
import pytest
from openai import APITimeoutError

from app.embeddings.openai_client import EmbeddingClient


def _resp(vecs):
    return types.SimpleNamespace(data=[types.SimpleNamespace(embedding=v) for v in vecs])


def test_embed_batch_retries_then_succeeds(monkeypatch):
    c = EmbeddingClient(api_key="test")
    calls = {"n": 0}

    def flaky(model, input):  # noqa: A002
        calls["n"] += 1
        if calls["n"] < 3:
            raise APITimeoutError(request=None)
        return _resp([[0.1, 0.2]] * len(input))

    monkeypatch.setattr(c._client.embeddings, "create", flaky)
    monkeypatch.setattr("app.embeddings.openai_client.time.sleep", lambda *_: None)

    out = c.embed_batch(["a", "b"])
    assert calls["n"] == 3          # failed twice, succeeded on the third
    assert out == [[0.1, 0.2], [0.1, 0.2]]


def test_embed_batch_raises_after_exhausting_retries(monkeypatch):
    c = EmbeddingClient(api_key="test")

    def always_timeout(model, input):  # noqa: A002
        raise APITimeoutError(request=None)

    monkeypatch.setattr(c._client.embeddings, "create", always_timeout)
    monkeypatch.setattr("app.embeddings.openai_client.time.sleep", lambda *_: None)

    with pytest.raises(APITimeoutError):
        c.embed_batch(["a"])


def test_embed_batch_empty_is_noop():
    assert EmbeddingClient(api_key="test").embed_batch([]) == []
