#!/bin/sh
# Startup wrapper for Railway. Railway's runtime kept passing literal "$PORT"
# to uvicorn regardless of CMD form (exec/shell) or serviceInstance.startCommand
# — see deploy logs 2026-05-18. This script reads PORT from env and binds
# uvicorn explicitly, with a hardcoded fallback.
PORT="${PORT:-8080}"
echo "[start.sh] Booting uvicorn on 0.0.0.0:${PORT}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}"
