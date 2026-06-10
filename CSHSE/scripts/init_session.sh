#!/usr/bin/env bash
# CSHSE — new-session bootstrap.
#
#   source CSHSE/scripts/init_session.sh
#
# Sets the dev env, defines helper functions, prints session_context.md's TL;DR,
# and shows git state. SOURCE it (don't just run) so the functions stick around.
#
# Functions defined:
#   cshse_token [email]            echo a fresh SSO bearer token (default eric@agileadtesting.com)
#   cshse_api <path> [method] [json]   authenticated curl against the live API
#   cshse_bundle                   current live client bundle hash (/assets/index-*.js)
#   cshse_deploy_wait [prev-hash]  poll until a NEW client bundle ships (deploy is live)
#   cshse_e2e <spec...>            run Playwright spec(s) against live with the e2e env
#   cshse_pc_token                 SSO token for the Stevenson PC owner (beser.ericl@gmail.com)
#   cshse_help                     reprint this list

# ---- locate the repo regardless of where this is sourced from -------------
if [ -n "${BASH_SOURCE[0]}" ]; then
  _CSHSE_SCRIPT="${BASH_SOURCE[0]}"
else
  _CSHSE_SCRIPT="${(%):-%N}"   # zsh
fi
export CSHSE_DIR="$(cd "$(dirname "$_CSHSE_SCRIPT")/.." 2>/dev/null && pwd)"   # .../AIScripts/CSHSE
export REPO_ROOT="$(cd "$CSHSE_DIR/.." 2>/dev/null && pwd)"                    # .../AIScripts

# ---- env ------------------------------------------------------------------
export E2E_BASE_URL="https://cshse-develop.up.railway.app"
export E2E_SEED_TOKEN="7d9e8a3b6f1c4d2a8e5b9f0c3d7a1e6b"
export E2E_SSO_KEY="cshse_sso_v1_Det__YE_ypAIp_gXb2cswf0DK0J8NEeD"
export STEVENSON="6986239a6612bf17f04a3217"
export CSHSE_PC_EMAIL="beser.ericl@gmail.com"
export CSHSE_SU_EMAIL="eric@agileadtesting.com"

# ---- helpers --------------------------------------------------------------
cshse_token() {
  local email="${1:-$CSHSE_SU_EMAIL}"
  curl -s -X POST "$E2E_BASE_URL/api/v1/auth/sso-login" \
    -H "x-cshse-api-key: $E2E_SSO_KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\"}" \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))"
}

cshse_pc_token() { cshse_token "$CSHSE_PC_EMAIL"; }

cshse_api() {
  # cshse_api <path> [method] [json-body]
  local path="$1" method="${2:-GET}" body="$3"
  local tok; tok="$(cshse_token)"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$E2E_BASE_URL$path" \
      -H "Authorization: Bearer $tok" -H "Content-Type: application/json" -d "$body"
  else
    curl -s -X "$method" "$E2E_BASE_URL$path" -H "Authorization: Bearer $tok"
  fi
}

cshse_bundle() {
  curl -s "$E2E_BASE_URL/" -m 15 | grep -oE '/assets/index-[^"]+\.js' | head -1
}

cshse_deploy_wait() {
  # cshse_deploy_wait [prev-bundle-hash]  — waits until the live bundle changes.
  local prev="${1:-$(cshse_bundle)}"
  echo "waiting for a new client bundle (current: $prev) ..."
  local i main
  for i in $(seq 1 45); do
    main="$(cshse_bundle)"
    if [ -n "$main" ] && [ "$main" != "$prev" ]; then
      echo "NEW BUILD LIVE: $main (after ~$((i*20))s)"; return 0
    fi
    sleep 20
  done
  echo "timed out waiting for a new bundle (still $main)"; return 1
}

cshse_e2e() {
  # cshse_e2e <spec-substr...>  — run Playwright spec(s) against live.
  ( cd "$CSHSE_DIR/e2e" && \
    E2E_BASE_URL="$E2E_BASE_URL" E2E_SEED_TOKEN="$E2E_SEED_TOKEN" E2E_SSO_KEY="$E2E_SSO_KEY" \
    npx playwright test "$@" --reporter=line )
}

cshse_help() {
  sed -n '11,24p' "$CSHSE_DIR/scripts/init_session.sh"
}

# ---- print the handoff summary + repo state -------------------------------
echo "=============================================================="
echo " CSHSE session — repo: $REPO_ROOT"
echo " live: $E2E_BASE_URL   submission(Stevenson): $STEVENSON"
echo "=============================================================="
if [ -f "$CSHSE_DIR/session_context.md" ]; then
  # print the TL;DR block (between '## TL;DR' or the first heading and the next '---')
  awk 'NR<=14' "$CSHSE_DIR/session_context.md"
  echo "  ... (full handoff in CSHSE/session_context.md)"
else
  echo "  (no session_context.md found)"
fi
echo "--------------------------------------------------------------"
echo " git: $(cd "$REPO_ROOT" && git rev-parse --abbrev-ref HEAD) @ $(cd "$REPO_ROOT" && git log --oneline -1)"
( cd "$REPO_ROOT" && git status --short | head -10 )
echo "--------------------------------------------------------------"
echo " functions: cshse_token · cshse_pc_token · cshse_api · cshse_bundle · cshse_deploy_wait · cshse_e2e · cshse_help"
echo "=============================================================="
