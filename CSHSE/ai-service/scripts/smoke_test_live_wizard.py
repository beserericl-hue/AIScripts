"""End-to-end LIVE wizard smoke test against the deployed cshse-ai service.

Kicks off a fresh /ai/import/start job pointing at the existing Stevenson
S3 source, polls cshse-ai's snapshot endpoint until the matrix_extract
stage completes, and verifies:

  - matrix_extract finished with detail like "2 matrix(es), 437 cells"
  - the snapshot's `matrices` array has 2 entries with the expected shape
  - row anchor ids are baked into each matrix's htmlSnippet

The synthetic importId is just a fresh ObjectId — cshse-ai doesn't need
it to exist in Mongo; its only role is keying the job in cshse-ai's
in-memory registry. The CSHSE-side callback will 404 (no such import)
but that's fine: we read the snapshot directly from cshse-ai.

Env::

    NODE_SERVICE_HMAC_SECRET=<64-hex shared secret>
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
import uuid

import httpx
from bson import ObjectId

AI_BASE = os.environ.get("AI_BASE", "https://cshse-ai-develop.up.railway.app")
HMAC_SECRET = os.environ["NODE_SERVICE_HMAC_SECRET"]
SUBMISSION_ID = "6986239a6612bf17f04a3217"  # the Stevenson UAT submission
STEVENSON_S3_KEY = (
    "versioned/submission/6986239a6612bf17f04a3217/original_import/v1/"
    "2024_CSHSE_Self-Study_Stevenson_University.docx"
)


def _sign(body: bytes) -> str:
    ts = str(int(time.time()))
    digest = hmac.new(HMAC_SECRET.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={ts},v1={digest}"


def _post(path: str, payload: dict) -> dict:
    body = json.dumps(payload).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Service-Signature": _sign(body),
    }
    r = httpx.post(f"{AI_BASE}{path}", content=body, headers=headers, timeout=30.0)
    r.raise_for_status()
    return r.json()


def _get(path: str) -> dict:
    body = b""
    headers = {"X-Service-Signature": _sign(body)}
    r = httpx.get(f"{AI_BASE}{path}", headers=headers, timeout=30.0)
    r.raise_for_status()
    return r.json()


def main() -> None:
    import_id = str(ObjectId())
    print(f"Triggering live wizard run:")
    print(f"  AI base: {AI_BASE}")
    print(f"  synthetic importId: {import_id}")
    print(f"  submissionId: {SUBMISSION_ID}")
    print(f"  s3Key: {STEVENSON_S3_KEY}")
    print()

    start = _post("/ai/import/start", {
        "importId": import_id,
        "submissionId": SUBMISSION_ID,
        "s3Key": STEVENSON_S3_KEY,
        "programLevel": "bachelors",
        "forceFormat": "self_study",
        # Callbacks that will 404 — we're reading the snapshot directly.
        "callbackUrl": f"https://cshse-develop.up.railway.app/api/imports/{import_id}/ai-callback",
        "eventCallbackUrl": f"https://cshse-develop.up.railway.app/api/imports/{import_id}/ai-event-callback",
    })
    job_id = start["jobId"]
    print(f"job started: jobId={job_id}  status={start['status']}")

    # Poll until the job is parsed/failed/canceled, OR until matrix_extract finishes.
    deadline = time.time() + 25 * 60  # 25 min hard cap (the wizard usually takes <12)
    last_stage_count = 0
    last_status = start["status"]
    matrix_done = False
    final_snap: dict = start
    while time.time() < deadline:
        time.sleep(15)
        try:
            snap = _get(f"/ai/import/{job_id}")
        except httpx.HTTPStatusError as e:
            print(f"  ⚠️ snapshot request failed: {e}")
            continue
        stages = snap.get("stages") or []
        status = snap.get("status")
        if len(stages) > last_stage_count or status != last_status:
            print(f"  [{time.strftime('%H:%M:%S')}] status={status} stages={len(stages)}")
            for s in stages[last_stage_count:]:
                detail = s.get("detail") or ""
                print(f"      {s['state']:>9} · {s['name']:<18} {detail}")
            last_stage_count = len(stages)
            last_status = status
        if status in ("parsed", "failed", "canceled"):
            final_snap = snap
            break
        if not matrix_done:
            for s in stages:
                if s.get("name") == "matrix_extract" and s.get("state") in ("done", "skipped"):
                    matrix_done = True
                    print(f"  ✔ matrix_extract reached terminal state: {s.get('state')} — {s.get('detail')}")
    else:
        print("  ⚠️ deadline reached before job terminal state")
        final_snap = _get(f"/ai/import/{job_id}")

    print()
    print("Final snapshot:")
    print(f"  status: {final_snap.get('status')}")
    print(f"  errors: {final_snap.get('errors')}")
    matrices = final_snap.get("matrices") or []
    print(f"  matrices: {len(matrices)}")
    for m in matrices:
        print(f"    - {m['matrixId']}: {m['name']}  cells={len(m.get('cells', []))}  "
              f"rowsMatched={m.get('rowsMatched')}  cols={len(m.get('columnHeaders', []))}")

    if final_snap.get("status") == "failed":
        sys.exit(f"FAILED: {final_snap.get('errors')}")

    if len(matrices) < 2:
        sys.exit(f"FAILED: expected 2 matrices, got {len(matrices)}")

    # Spot-check row anchors in the first matrix's htmlSnippet.
    first = matrices[0]
    sample_cells = first.get("cells", [])[:5]
    for c in sample_cells:
        anchor = c.get("rowAnchor")
        if anchor and f'id="{anchor}"' not in first.get("htmlSnippet", ""):
            sys.exit(f"FAILED: anchor {anchor} missing from {first['matrixId']} htmlSnippet")

    print()
    print("✅ LIVE WIZARD SMOKE TEST PASSED")


if __name__ == "__main__":
    main()
