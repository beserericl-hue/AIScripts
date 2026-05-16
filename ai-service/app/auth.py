import hashlib
import hmac
import time

from fastapi import HTTPException, Request, status

from app.config import get_settings

_MAX_SKEW_SECONDS = 300


def verify_hmac_signature(request: Request, body: bytes) -> None:
    """Reject requests without a valid X-Service-Signature header.

    Signature format: ``t=<unix_seconds>,v1=<hex_digest>`` where the digest is
    HMAC-SHA256 of ``<timestamp>.<body>`` using NODE_SERVICE_HMAC_SECRET.
    """
    settings = get_settings()
    secret = settings.node_service_hmac_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="HMAC secret not configured",
        )

    sig = request.headers.get("x-service-signature")
    if not sig:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing X-Service-Signature",
        )

    parts = dict(p.split("=", 1) for p in sig.split(",") if "=" in p)
    ts = parts.get("t")
    digest = parts.get("v1")
    if not ts or not digest:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="malformed signature",
        )

    try:
        ts_int = int(ts)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="malformed timestamp",
        ) from exc

    if abs(time.time() - ts_int) > _MAX_SKEW_SECONDS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="signature expired",
        )

    expected = hmac.new(
        secret.encode(), f"{ts}.".encode() + body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, digest):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid signature",
        )
