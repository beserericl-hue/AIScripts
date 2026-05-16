import hashlib
import hmac
import time
from unittest.mock import patch

import pytest
from fastapi import HTTPException, Request

from app.auth import verify_hmac_signature
from app.config import Settings, get_settings


def _build_request(headers: dict) -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/x",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def _override_settings():
    get_settings.cache_clear()
    with patch.dict(
        "os.environ",
        {"NODE_SERVICE_HMAC_SECRET": "test-secret", "CSHSE_ENV": "dev"},
        clear=False,
    ):
        get_settings.cache_clear()
        yield
        get_settings.cache_clear()


def _sign(secret: str, ts: int, body: bytes) -> str:
    digest = hmac.new(
        secret.encode(), f"{ts}.".encode() + body, hashlib.sha256
    ).hexdigest()
    return f"t={ts},v1={digest}"


def test_valid_signature_passes():
    body = b'{"hello":"world"}'
    ts = int(time.time())
    req = _build_request({"x-service-signature": _sign("test-secret", ts, body)})
    verify_hmac_signature(req, body)


def test_missing_header_rejected():
    with pytest.raises(HTTPException) as ei:
        verify_hmac_signature(_build_request({}), b"")
    assert ei.value.status_code == 401


def test_expired_timestamp_rejected():
    body = b""
    old_ts = int(time.time()) - 1000
    sig = _sign("test-secret", old_ts, body)
    req = _build_request({"x-service-signature": sig})
    with pytest.raises(HTTPException) as ei:
        verify_hmac_signature(req, body)
    assert ei.value.status_code == 401


def test_tampered_body_rejected():
    body = b'{"hello":"world"}'
    ts = int(time.time())
    sig = _sign("test-secret", ts, body)
    req = _build_request({"x-service-signature": sig})
    with pytest.raises(HTTPException):
        verify_hmac_signature(req, b'{"hello":"tampered"}')
