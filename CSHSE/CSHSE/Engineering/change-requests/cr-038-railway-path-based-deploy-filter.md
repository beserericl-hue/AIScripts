---
name: CR-038 — Railway path-based deploy filter so pushes to docs/, e2e/, ai-service/ don't bounce unrelated services
description: Railway today rebuilds and redeploys ALL services in the project on any push to `developer`, regardless of which files changed. A push that only touches `e2e/` or `docs/` still bounces cshse-ai (which kills any in-flight matcher) and cshse-server. Configure each Railway service to watch only its own directory tree. Reduces deploy noise, prevents the user-visible "AI service unreachable" mid-import errors traced to unrelated commits, and makes deploy timelines predictable.
type: change-request
cr_id: CR-038
status: proposed
priority: P1
source: User-visible failure 2026-05-22 — a push that only added a Playwright E2E spec file (`CSHSE/e2e/tests/discard_button.spec.ts`) triggered a redeploy of cshse-ai, which restarted the container mid-demo and caused the coordinator's import to fail. The user has had a standing rule "Never push to developer during a wizard run" for exactly this reason; this CR makes that rule structurally unnecessary by aligning Railway with the repo layout.
sprint_target: Sprint 4 — runbook task before the P0 code CRs land, since this is config-only and de-risks them.
tags: [infra, railway, deploy, ci, runbook]
last_reviewed: 2026-05-22
---

# CR-038 — Railway path-based deploy filter

## Source quote

User, 2026-05-22 (standing rule given at start of day):

> "Never push to developer during a wizard run — every push redeploys cshse-ai and kills the in-flight matcher."

And after the demo:

> "we need to bullet proof this importer."

## What's broken today

Railway's default behavior watches the **whole repository root**. Each service in the project (cshse-ai, CSHSE/cshse-server, CSHSE/client) listens to every push to `developer` and rebuilds. Result:

- A push touching only `CSHSE/e2e/tests/*.spec.ts` rebuilds cshse-ai (Python service), even though no Python file changed.
- A push touching only `CSHSE/CSHSE/Engineering/*.md` (Obsidian docs) rebuilds everything.
- A push touching only `client/src/` rebuilds cshse-ai (which doesn't ship the client).

The cshse-ai container restart window is 60–120s. Any import that starts during that window fails (until [[cr-036-ai-service-handshake-retries]] lands). Coordinators have no way to know a push is happening.

## Decision

Configure each Railway service to **only watch its own subdirectory**. Railway supports this via the per-service "Root Directory" + "Watch Paths" settings.

### Service mapping

| Railway service | Watch paths | Build command |
|---|---|---|
| `cshse-ai` | `CSHSE/ai-service/**` | (current FastAPI build) |
| `CSHSE` (Node server + client build) | `CSHSE/server/**`, `CSHSE/client/**`, `CSHSE/package.json`, `CSHSE/package-lock.json` | (current Node build that also builds the client) |

What's INTENTIONALLY excluded from all services:

- `CSHSE/e2e/**` — Playwright tests run in CI / locally, never need to deploy.
- `CSHSE/CSHSE/**` — Obsidian vault. Docs. No code.
- `CSHSE/docs/**` — Docs + sample files + the deck I generated earlier today.
- `CSHSE/n8n-workflows/**` — Separate concern, lives in its own Railway service if at all.
- Root-level `*.md`, `*.pdf`, `*.docx` — Docs and artifacts.

### Branch filter

Confirm Railway is configured to deploy `developer` only (not every branch). Feature branches like `feature/e2e-seed-bulletproof` MUST NOT trigger deploys. (This was implicitly assumed throughout today's work but should be verified.)

## How to apply

This is a runbook task, not a code change. Steps:

1. Railway dashboard → `cshse-ai` service → Settings → Source → Watch Paths:
   ```
   CSHSE/ai-service/**
   ```
2. Railway dashboard → `CSHSE` service → Settings → Source → Watch Paths:
   ```
   CSHSE/server/**
   CSHSE/client/**
   CSHSE/package.json
   CSHSE/package-lock.json
   ```
3. Save. Trigger a test push that only touches `CSHSE/docs/` and verify NO deploys fire.
4. Trigger a test push that touches `CSHSE/ai-service/`. Verify ONLY cshse-ai redeploys.
5. Trigger a test push that touches `CSHSE/client/`. Verify ONLY CSHSE redeploys.

If Railway's UI doesn't support path watches for the Project plan in use, the alternative is two service-level deploy filters via GitHub Actions:

- Add `.github/workflows/deploy-cshse-ai.yml` that triggers on push to `developer` with `paths: ['CSHSE/ai-service/**']` and calls the Railway deploy API.
- Same pattern for `deploy-cshse-server.yml`.
- Disable Railway's auto-deploy on the GitHub integration.

## Acceptance criteria

1. A push that touches only `CSHSE/e2e/tests/*.spec.ts` triggers ZERO Railway deploys.
2. A push that touches only `CSHSE/CSHSE/**/*.md` triggers ZERO deploys.
3. A push that touches only `CSHSE/ai-service/**` triggers ONLY a cshse-ai deploy (CSHSE service stays untouched).
4. A push that touches only `CSHSE/client/**` triggers ONLY a CSHSE deploy (cshse-ai stays untouched).
5. A push to any non-`developer` branch triggers zero deploys.
6. Existing deploy webhooks + commit-status reporters still work — GitHub still shows the per-service success/pending/failure badges on each commit.
7. The user's "Never push during a wizard run" standing rule becomes a soft preference rather than a hard requirement. Documented in [[CLAUDE]] memory.

## Risks

- **Misconfigured watch path = no deploys.** If the path globs are wrong, code changes won't ship. Mitigated by the test-push acceptance criteria above.
- **Shared infra changes.** If a future change touches both `client/` and `ai-service/`, both services correctly redeploy. If a change touches `package.json` at the repo root, both might pick it up — confirm Railway's watch-path semantics handle this consistently.
- **Feature-branch deploys.** Verify branch filter actually holds. If a feature branch ever triggered a deploy by accident in the past, document it.

## Engineering size

XS. Config-only. 30 minutes of Railway dashboard work + a half-hour of verification pushes. If GitHub Actions fallback is needed: half a day to wire up two workflows + disable Railway auto-deploy.

## Related

- [[cr-036-ai-service-handshake-retries]] — even with this filter, redeploys still happen sometimes. CR-036 is the runtime defense.
- [[cr-037-empty-buckets-guard]] — even with this filter + retries, a malformed run can still produce empty buckets. CR-037 catches that.
- [[../critical-error-processing-review-2026-05-22]] — Finding "Infrastructure: deploy noise."
- [[CLAUDE]] — Memory file that today contains "Never push to developer during a wizard run." Update once this CR ships.
