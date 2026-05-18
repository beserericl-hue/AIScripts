---
name: AI Import Wizard — Deploy Run-Book (sub-sprint 1.e)
description: Step-by-step instructions for promoting the Sprint 1 AI Import Wizard to the develop Railway environment, smoke-testing with the Kennesaw State template + Stevenson self-study, and handing off to the Coordinator team for UAT. Pre-flight checks, env-var changes, rollback plan, and the Stevenson re-preview parity check. PAUSED — awaiting user go-ahead before pushing.
type: plan
plan_date: 2026-05-18
status: ready-to-produce
tags: [ai-import, sprint-1, deploy, develop, railway, run-book]
last_reviewed: 2026-05-18
---

# AI Import Wizard — Deploy Run-Book (sub-sprint 1.e)

> 🛑 **Paused before pushing.** This page is the run-book for deploying the Sprint 1 AI Import Wizard to the `develop` Railway environment. It does NOT execute any deploy on its own — running through the steps requires explicit Coordinator / engineer go-ahead. The wizard code is fully built and all tests are green in the worktree; this page only documents what to do next.

Related: [[import-wizard-ui-spec-2026-05-18]] · [[railway-deployment-topology]] · [[ai-import-wizard-preview-stevenson-2026-05-18]] · [[ai-import-wizard-preview-kennesaw-state-2026-05-18]]

---

## 0. What's being deployed

| Component | Where it runs | New in Sprint 1 |
|---|---|---|
| `cshse-ai` (Python FastAPI) | Railway service `CSHSE-AI` / `ai-service` | `POST /ai/import/start`, `GET /ai/import/:jobId`, `POST /ai/import/:jobId/cancel`, in-process FIFO worker queue |
| `CSHSE` server (Node + Express) | Railway service `CSHSE` | 7 new routes under `/api/imports/*`, SSE fan-out, HMAC-verified webhooks, ProgramCourses CRUD, real apply-ai with merge / replace / per-spec modes |
| `CSHSE` client (Vite + React) | Same Railway service (served as static assets) | New AI Import tab, Wizard scaffold, full Review surface, Matrix step, TagListView + TagPopup |

Pre-deploy test totals (all in `feature/ai-import-wizard`):

- Python (`ai-service/tests`): **122 passed / 4 skipped**
- Server integration (`server/tests/integration`): **38 passed**
- Client unit (`client/src`): **29 passed / 2 skipped**

---

## 1. Pre-flight (≈ 15 min)

Run these locally before touching Railway. **Block deploy on any failure.**

1.1 Branch up-to-date with main:

```bash
cd /Users/ericbeser/Documents/GitHub/AIScripts
git fetch origin
git checkout feature/ai-import-wizard
git rebase origin/main   # resolve any drift; the wizard branch is additive so conflicts are unlikely
```

1.2 Test gates:

```bash
# Python
cd ai-service && .venv/bin/python -m pytest tests/

# Server
cd ../CSHSE/server && npx vitest run tests/integration/ai-import.test.ts tests/integration/program-courses.test.ts tests/integration/auth-routes.test.ts tests/integration/webhook-callback-security.test.ts

# Client
cd ../client && npx vitest run

# Type-check (server has 1 pre-existing flake in unit/; integration is clean)
cd ../server && npx tsc --noEmit | grep -E "aiImportController|aiImportStore|AIImport|SelfStudyImport|programCoursesController" || echo "OK"
cd ../client && npx tsc --noEmit | grep -E "aiImportStore|AIImport" || echo "OK"
```

1.3 Wizard smoke (local), end-to-end against the Kennesaw State DOCX. Already verified in [[ai-import-wizard-preview-kennesaw-state-2026-05-18]]. Re-run if anything has changed since:

```bash
/tmp/run_wizard_preview.sh --concurrency 6
# or via the dispatcher:
.venv/bin/python ai-service/scripts/build_preview.py --docx "CSHSE/docs/Sample to Council from KSU.docx" --output-suffix kennesaw-state
```

Expected: same numbers as the last preview (95 / 96 specs touched, 13 placeholder sections), ~25–30 s wall time.

---

## 2. Env-var changes on Railway `develop`

Per [[railway-deployment-topology]]: `CSHSE` and `ai-service` both run in `develop` env. Two new env vars are required for the wizard.

| Service | Env var | Value | Purpose |
|---|---|---|---|
| `CSHSE` (develop) | `AI_SERVICE_URL` | `http://ai-service.railway.internal:8080` | Server-to-cshse-ai dispatch URL (UI spec §11.2). Defaults to this if unset; setting it explicitly documents the dependency. |
| `CSHSE` (develop) | `NODE_SERVICE_HMAC_SECRET` | Generate via `openssl rand -hex 32` | Shared HMAC secret for the `/ai-event` + `/ai-callback` webhook auth (UI spec §11.4 + §11.8). |
| `CSHSE` (develop) | `SERVER_PUBLIC_URL` | `https://cshse-develop.up.railway.app` | Public URL the cshse-ai service POSTs webhook callbacks to. Defaults to `RAILWAY_PUBLIC_DOMAIN` if unset. |
| `CSHSE` (develop) | `MONGO_SUPPORTS_TRANSACTIONS` | `true` | Set only if Mongo runs as a replica set. Develop env is single-node — leave unset; apply-ai falls back to sequential saves + idempotency-key retry safety. |
| `ai-service` (develop) | `NODE_SERVICE_HMAC_SECRET` | **same value as the CSHSE service** | Shared secret end of the HMAC pair. **Must match exactly.** |
| `ai-service` (develop) | `CSHSE_S3_BUCKET` | `cshse-filestorage-qlyj5pn` | Where mammoth pulls the uploaded DOCX from. Defaults to this; setting it makes the dependency explicit. |

Set them via Railway CLI (preferred) or the dashboard:

```bash
# Generate the shared secret ONCE and pin to both services
SECRET=$(openssl rand -hex 32)

railway variables --service CSHSE --environment develop \
  --set "AI_SERVICE_URL=http://ai-service.railway.internal:8080" \
  --set "NODE_SERVICE_HMAC_SECRET=$SECRET" \
  --set "SERVER_PUBLIC_URL=https://cshse-develop.up.railway.app"

railway variables --service ai-service --environment develop \
  --set "NODE_SERVICE_HMAC_SECRET=$SECRET" \
  --set "CSHSE_S3_BUCKET=cshse-filestorage-qlyj5pn"
```

**Verify after setting:**

```bash
railway run --service CSHSE --environment develop -- /bin/sh -c 'echo "URL=$AI_SERVICE_URL HMAC_LEN=${#NODE_SERVICE_HMAC_SECRET}"'
railway run --service ai-service --environment develop -- /bin/sh -c 'echo "HMAC_LEN=${#NODE_SERVICE_HMAC_SECRET}"'
```

Both should print `HMAC_LEN=64`.

---

## 3. Migrations

No DB migrations required. The `SelfStudyImport` schema additions (`aiStatus`, `aiBuckets`, `aiTags`, etc.) are all optional fields that default to `undefined` — existing imports continue to work unchanged. The `ProgramCourse` collection is new and gets its unique index created on first insert.

If the develop Mongo has stale `SelfStudyImport` records from earlier sprints, they're safe to leave alone — the wizard ignores any record whose `aiStatus` is unset.

---

## 4. Deploy

`cshse-ai` ships first so it's ready before the CSHSE server hits it on first wizard upload:

```bash
# 1. Push the branch
cd /Users/ericbeser/Documents/GitHub/AIScripts
git push origin feature/ai-import-wizard

# 2. Trigger the develop deploy. Railway auto-deploys the `developer`
#    branch by default (see [[railway-deployment-topology]] §branch-swap-mechanics).
#    If we keep the wizard branch separate, manually point the develop
#    deployment trigger at feature/ai-import-wizard:
#
# railway service link CSHSE --environment develop
# (then via the dashboard or GraphQL deploymentTriggerUpdate per the topology page)
#
# Or merge to developer first:
#   git checkout developer && git merge feature/ai-import-wizard && git push origin developer
```

Wait for both services to become healthy:

```bash
# cshse-ai health
curl https://ai-service-develop.up.railway.app/health
# Expected: {"status":"ok","version":"0.1.0","git":"<sha>","env":"dev"}

# CSHSE server health (existing endpoint)
curl https://cshse-develop.up.railway.app/api/health
```

---

## 5. Post-deploy smoke (≈ 10 min)

### 5.1 Health checks

```bash
# cshse-ai endpoints
curl https://ai-service-develop.up.railway.app/health/qdrant
curl https://ai-service-develop.up.railway.app/health/anthropic
curl https://ai-service-develop.up.railway.app/health/openai
```

All three should return `"reachable": true`.

### 5.2 Wizard happy path — Kennesaw State template

1. Open `https://cshse-develop.up.railway.app/submissions/<test-submission-id>/editor/ai-import` as a Program Coordinator.
2. Pick `docs/Sample to Council from KSU.docx`, leave program level on Baccalaureate.
3. Click Next. Expected:
   - SSE stream opens; you see "Parsing your document…"
   - Format detection: `template @ 0.95` with template-title reasoning
   - Pipeline strip: download → mammoth → template_walker → matcher (14 sections) → coverage_review (8–9 specs) → matrix_extract (`n/a`) → gap_fill (`skipped`)
   - Status flips to `parsed` within ~30s
4. Review step: 8 specs with content (1.a, 1.b, 1.f, 3.a, 4.a, 4.b, 9.e, 21.a), 13 placeholder sections in "Unwritten" rail.
5. Click through to Apply, pick "Replace" mode, click Apply & finish.
6. Check `https://cshse-develop.up.railway.app/api/submissions/<test-submission-id>` — `narratives['1']['a'].content` should be populated.

### 5.3 Wizard re-import — Stevenson self-study

Larger / slower; tests the self-study branch and gap-fill end-to-end.

1. Upload a Stevenson-shape DOCX (you can `railway run --service ai-service ... -- python` to fetch the original from S3 if it's not on disk).
2. Format detection should pick `self_study`.
3. Pipeline: download → mammoth (~14 s) → deep_walker (568 sections) → matcher live (~5–7 min) → coverage_review (~70 s) → matrix_extract (~30 s) → gap_fill (~3 min).
4. Total wall time ~10–12 min. SSE keeps the UI live the whole time.
5. Review surface should match the [[ai-import-wizard-preview-stevenson-2026-05-18]] numbers within Haiku variance (95 specs touched, 333 verified gap fills give-or-take).
6. Apply with "Merge" mode. Spot-check 1.a, 1.b, 1.c on the resulting Submission to confirm narratives land.

### 5.4 Queue behaviour (manual)

While the Stevenson run is mid-parse, start a second wizard upload from a different browser session.

Expected:
- Second wizard's Parse step shows the queued UI: "Your import is 2nd in line".
- Position decrements live (no refresh needed) as the first job completes.
- "Cancel" on the queued job releases the slot immediately.

### 5.5 Apply failure path

Manually break apply-ai once to exercise the error path:

```bash
# Temporarily set MONGO_SUPPORTS_TRANSACTIONS=true on the develop CSHSE
# service when the underlying Mongo is single-node — apply-ai will throw on
# commitTransaction. Verify the wizard shows the inline error + status
# rolls back to "parsed" + the idempotency key allows clean retry.
# REVERT this env var immediately after.
```

---

## 6. Rollback plan

The wizard is additive — the legacy import flow (`/upload` modal, `SectionTagger`, `DocumentViewer` placeholder mechanism) is **completely untouched and still mounted**. If the wizard misbehaves in develop:

1. **Soft disable** (preferred): hide the AI Import tab via a feature flag. Set env var on CSHSE develop:
   ```bash
   railway variables --service CSHSE --environment develop --set "FEATURE_AI_IMPORT=off"
   ```
   *(Feature flag is not yet wired in code — UI spec §17 phasing puts this in sub-sprint 1.e if needed. Implementation: 5 lines in `SelfStudyEditor.tsx` to conditionally render the tab.)*
2. **Hard rollback**: re-point the develop deployment trigger at `main` (last known good). Use Railway's `deploymentTriggerUpdate` mutation per [[railway-deployment-topology#branch-swap-mechanics]]. No DB rollback needed since the wizard schema additions are non-breaking.
3. **Half-rollback** (degrade just cshse-ai): roll the AI service to the previous commit while keeping the CSHSE server. The wizard's `start-ai` route will return 502; the UI shows "AI Import service is unavailable" but the rest of the editor keeps working.

---

## 7. Coordinator UAT handoff

After 5.x smoke passes, hand off to the Coordinator team with the following short note:

> The AI Import Wizard is live in develop at `https://cshse-develop.up.railway.app`. Open any Submission's editor and click the new **AI Import** tab.
>
> Quick happy-path test: upload `docs/Sample to Council from KSU.docx`, walk through Upload → Parse → Review → Apply. Watch the live progress strip in Parse; the Review step shows the AI-placed content per spec.
>
> Known v1 limitations:
> - Evidence files are recorded as `linkedDocuments` references on the narrative, not yet split out into the SupportingEvidence + S3 DOCX flow ([[evidence-document-review-pipeline]] integration is a Sprint 2 follow-up).
> - Stevenson-sized parses take ~10–12 minutes (cost ~$3–5). The Parse strip stays live the entire time; queue position updates if multiple Coordinators run at once.
> - `prefers-reduced-motion` is respected in CSS; full WCAG audit happens in Sprint 2 polish.
> - Cross-institution similarity search is feature-flagged off (UI spec §20.3).
>
> Please file feedback as Issues with the `ai-import` label. We'll triage and patch through develop before the prod promote.

---

## 8. Promote to production (LATER — explicit go-ahead required)

**Do not run this section without sign-off from a Coordinator AND a successful UAT week in develop.**

```bash
# After UAT passes:
git checkout main
git merge --no-ff feature/ai-import-wizard
git push origin main

# Then re-point the production deployment triggers per [[railway-deployment-topology]].
# Production env vars need the same setup as §2 above, generated as a NEW HMAC
# secret distinct from develop's (do not reuse — that's the only reason envs
# stay isolated).
```

---

## 9. Status — sub-sprint 1.e

| Step | State |
|---|---|
| 1. Pre-flight tests green | ✅ Python 122 / server 38 / client 29 |
| 2. Env-var commands documented | ✅ this page §2 |
| 3. Migration plan | ✅ no migrations needed |
| 4. Deploy commands | ✅ documented, **not executed** |
| 5. Smoke procedure | ✅ documented |
| 6. Rollback plan | ✅ documented |
| 7. UAT handoff note | ✅ documented |
| 8. Production promote | ⏸ pending UAT |

**Awaiting explicit Coordinator go-ahead to execute §2 + §4.** When ready, fire each command, watch the health checks, then run §5 smoke; revert per §6 on any failure.
