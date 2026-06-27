---
name: CR-019 — Joint Venture grouping
description: Cosmetic / organizational layer above institutions that groups 2+ institutions into a named Joint Venture. JV-level dashboards + reporting; no RBAC changes (each member institution keeps its own PC, readers, and submissions).
type: change-request
cr_id: CR-019
status: shipped
priority: P2
source: [[sprint-plan-2026-05-11#sprint-7]], user direction 2026-05-30 (revive from rejected — "Sprint 8/CR-019 should not be dormant. This is an expected requirement. Work it now.")
sprint_target: Sprint 8
tags: [joint-venture, scheduling, sprint-plan]
last_reviewed: 2026-05-30
revision_history:
  - 2026-05-20 — initial decision: rejected (no beta institution surfaced a JV need at the 2026-05-20 webinar).
  - 2026-05-30 — revived per user direction; revival rationale: JV is an expected requirement per the original product spec ([[product-requirements#u2-joint-ventures-institution-grouping]]) and the previously-superseded [[sprint-plan-2026-05-11#sprint-7]] full spec. Shipped same day.
  - 2026-06-16 — discoverability follow-on (prod): admin reported "no way to add a JV." Feature was complete but only at `/admin/joint-ventures`. Surfaced as a Joint Ventures tab in Admin Settings (commit `cb5b17b`) + an optional JV dropdown in the institution Add/Edit modal (commit `5bd0bed`). Both live in production.
last_reviewed_note: discoverability surfaces added 2026-06-16
---

# CR-019 — Joint Venture grouping (revived 2026-05-30)

## Update 2026-06-16 — discoverability (shipped to prod)

The JV feature (model + 8 endpoints + create/list/archive UI) was complete but only reachable at the standalone `/admin/joint-ventures` route, so an admin in Admin Settings → Institutions saw no obvious way to define one. Two additive surfaces, no backend change:

- Joint Ventures tab in `SettingsPage.tsx` (below Institutions) mounts the existing `JointVentureManagement` component. Commit `cb5b17b`.
- Optional "Joint Venture" dropdown in the Add/Edit Institution modal (`InstitutionManagement.tsx`): lists active JVs + "None"; on save it syncs membership via the JV member endpoints (remove-from-current then add), surfacing the "one active JV per institution" conflict in the open modal; create flow adds after the institution is created. Commit `5bd0bed`.

## Status: shipped (2026-05-30)

The 2026-05-20 rejection was based on no beta institution raising JV at the webinar. User direction 2026-05-30 explicitly overrides: JV is an expected requirement. Implementation followed the [[sprint-plan-2026-05-11#sprint-7]] spec.

## Decision

Cosmetic / organizational layer above institutions. JV is a named grouping with ≥2 member institutions; it does NOT change RBAC (each member institution keeps its own PC, readers, and submissions). Admins manage the grouping; non-admin members see a small badge.

### Invariants

- `name` unique.
- `institutionIds.length >= 2` enforced at the controller layer.
- An institution belongs to AT MOST ONE active JV (`Institution.jointVentureId` reverse pointer maintained by the controller).
- Removing a member that drops the count below 2 → auto-archive with audit `jv.archived` (payload `reason: 'auto'`).
- Audit fires on every transition: `jv.created` / `jv.updated` / `jv.member_added` / `jv.member_removed` / `jv.archived`.

### RBAC

- Admin / superuser: full CRUD.
- Non-admin (PC / reader / lead): `GET` only the JVs whose member institution they belong to. Non-member viewers of `:id` get **404 (don't leak existence)** per the original CR spec.

## Acceptance — all met

- [x] Admin creates a JV with ≥2 institutions; create with <2 → 400.
- [x] Adding an institution that's already in another JV → 409.
- [x] Removing a member that brings count below 2 → JV auto-archives with audit-log entry.
- [x] `Institution.jointVentureId` is populated and stays in sync (set on create + add; cleared on remove + archive).
- [x] Non-admin GETs JV only if their institution is a member; otherwise 404 (don't leak existence).
- [x] Aggregate stats endpoint rolls submissions across members (`totalSubmissions`, `activeSubmissions`, `decidedSubmissions`).
- [x] Admin UI for create / archive / member multi-select (filtered to non-JV-member institutions).
- [x] JV badge on PC / reader / lead surfaces (mounted on the reader dashboard rows).

## Files affected (as shipped, Sprint 8, 2026-05-30)

### Server (additive)
- `server/src/models/JointVenture.ts` (new) — schema + indexes.
- `server/src/models/Institution.ts` — adds `jointVentureId?: ObjectId` reverse pointer + index.
- `server/src/controllers/jointVentureController.ts` (new) — list / get / create / update / addMember / removeMember / archive / aggregateStats.
- `server/src/routes/jointVentures.ts` (new) — mounted at `/api/joint-ventures`.
- `server/src/index.ts` — router wired.
- `server/src/models/AuditLogEntry.ts` — adds 5 new actions (`jv.created`, `jv.updated`, `jv.member_added`, `jv.member_removed`, `jv.archived`).
- `server/src/controllers/submissionController.ts` — `listSubmissions` projection widens to include `institutionId` (so the reader dashboard JV badge has the id).

### Client (additive)
- `client/src/features/admin/JointVentureManagement/JointVentureManagement.tsx` (new) — pure view + container at `/admin/joint-ventures`.
- `client/src/components/JointVentureBadge.tsx` (new) — small inline chip; renders only when the viewer can see the JV.
- `client/src/features/reader/ReaderDashboard.tsx` — mounts the badge inline next to each institution name.
- `client/src/pages/AdminPage.tsx` — adds `/admin/joint-ventures` route.

## Tests

- **Server (12):** `tests/integration/joint-ventures.test.ts` — create + min-2 + duplicate-name + cross-JV conflict; admin-only CUD (PC + lead 403); add member + reverse pointer; remove drops <2 → auto-archive (verifies both `member_removed` + `archived` audits, both institution pointers cleared); RBAC (member 200, non-member 404, no leak); list filter (non-admin per-member; admin sees all); aggregate-stats across members (1 active, 1 decided); manual archive + audit + reverse pointers cleared.
- **Client (15):** `JointVentureManagement.test.tsx` (11) — loading/error/eligible-filter/Create-disabled-until-name+≥2/toggle-fires-setDraft/Create-fires-onCreate/rows-with-member-count/archived-hides-Archive/Archive-fires-onArchive/no-eligible-notice/toggle-archived. `JointVentureBadge.test.tsx` (4) — null institutionId no-op; no-match no-op; match renders the chip; archived JV no-op.

## Deferred (next-pass follow-ons)

- **Dashboard JV grouping** for admin / lead-reader dashboards (S7.3 of the original spec). The data + badge are live; the section-header grouping is a discrete UI pass when product confirms the desired dashboard shape.
- **JV reporting filter dropdown** + report-endpoint `?jointVentureId` parameter (S7.4 of the original spec). Aggregate-stats endpoint exists; the filter on existing reports lands when the reporting pass picks up.
- **PC dashboard badge** — same component, just mount on the PC dashboard row when product confirms the surface.

## Dependencies

- [[cr-007-reader-access-after-submit]] — RBAC unchanged; JV adds NO permission shifts.
- [[cr-045-pc-ui-preferences]] — preference patterns reusable if admins want a "default JV view" toggle.

## Open questions

- None — all acceptance criteria met. Future product asks land as discrete follow-ons.

## S13 Resolution (2026-05-31) — two of three follow-ons shipped

Picked up two of the three "Deferred" follow-ons in the Sprint 13 JV slot. Both are additive; no RBAC change (per the original CR invariant — JV adds NO permission shifts).

### Shipped

- **JV reporting filter `?jointVentureId`** on `GET /api/submissions/`. `listSubmissions` (`server/src/controllers/submissionController.ts`, ~line 1432) now accepts a `jointVentureId` query param, gated to elevated viewers (`isElevated_`). It resolves the JV's `institutionIds` and intersects them into the existing `filter.institutionId`:
  - no prior institution filter → `filter.institutionId = { $in: memberIds }`;
  - an existing institution filter that is NOT a JV member → forced to a non-matching ObjectId (empty result), so the param can only ever *narrow* scope.
  - A non-elevated reader passing the param gets nothing widened — their scope stays assignment+status gated. Verified by `server/tests/integration/submission-jv-filter.test.ts` (2 tests, both green): admin scopes the list to JV members only (`['Alpha U','Beta U']`, excludes `Outside U`); non-member submissions excluded.
- **PC dashboard JV badge** — the existing `JointVentureBadge` component is now mounted on the PC dashboard header (`client/src/features/dashboard/Dashboard.tsx`), next to the "Self-Study Progress Dashboard" subtitle, keyed on the PC's own institution id. Renders only when that institution is a visible JV member (same null-safe behavior as the reader-surface mount).

### Still deferred (product-gated UI)

- **Dashboard JV section grouping** for admin / lead-reader dashboards (original S7.3). The data + badge + reporting filter are all live now; the section-header *grouping layout* remains a discrete UI pass pending product confirmation of the desired dashboard shape. No code change in S13 — this is a layout/UX decision, not a missing capability.

### Files touched (S13, additive)

- `server/src/controllers/submissionController.ts` — `jointVentureId` filter branch + `JointVenture` import.
- `server/tests/integration/submission-jv-filter.test.ts` (new) — 2 tests.
- `client/src/features/dashboard/Dashboard.tsx` — `JointVentureBadge` mount on the PC header.
