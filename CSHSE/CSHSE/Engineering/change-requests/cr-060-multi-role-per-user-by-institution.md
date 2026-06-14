---
name: CR-060 — Multi-role per user (role-by-institution)
description: A user can hold different roles at different institutions (PC at A, Reader/Lead Reader at B) and an institution can have multiple PCs. New authoritative User.roleAssignments[] + roleResolver algorithm + admin Manage-roles UI. Phase 1+2 shipped; Phase 3 (access-gate rollout) pending review.
type: change-request
cr_id: CR-060
status: in-progress
priority: P1
source: "Administrator review 2026-06-14 (admin/settings Users + Institutions screens) · [[cr-017-cross-institution-isolation-audit]] · commit fd98f24 (Phase 1+2)"
sprint_target: Post-beta admin hardening
tags: [access-control, rbac, roles, admin, institution, multi-role]
last_reviewed: 2026-06-14
---

# CR-060 — Multi-role per user (role-by-institution)

## Summary

The single-role user model (`User.role` + one `User.institutionId`) cannot express the real org structure: one person serving as **Program Coordinator at one institution and Reader/Lead Reader at another**, and an institution having **more than one PC**. The administrator also has **no UI to edit a user and (re)assign roles**. CR-060 introduces an authoritative per-institution role list on the user record, an algorithm to resolve "what can this user do at institution X", and an admin editor — enforcing two business rules. **Phase 1 (data model + migration + auth wiring) and Phase 2 (admin Manage-roles UI + endpoint) are shipped; Phase 3 (rolling the ~178 access gates onto the new algorithm so cross-institution roles are actually enforced) is pending review before build.**

## Source quotes

From the administrator's 2026-06-14 review of `admin/settings` (Users + Institutions):

- "no way of editing a user and assigning a role to that user. This list needs to edit the individual user and assign the roles of program coordinator, reader, lead reader."
- "These roles must be honored both globally and assigned to an institution."
- **Rule 1** — "a PC for one institution, may be assigned as a reader for another institution. (they cannot be both in one institution). They can be PC in one institution, and Lead reader in another."
- **Rule 2** — "There can be multiple PCs in one institution as more than one person can share editing responsibility."
- "The institution record has no way of adding additional readers, lead reader, or PCs."
- "Please revise the user role data structure to account for multiple roles assigned to a single user. Devise an algorithm that correctly manages a role by institution, including visibility of other services."

## Decision

### Data model — `User.roleAssignments[]` (authoritative)

```ts
// User.roleAssignments
{ role: 'program_coordinator' | 'reader' | 'lead_reader', institutionId, institutionName? }
```

- `admin` / superuser are **global** — never in `roleAssignments` (`server/src/models/User.ts`).
- Legacy `User.role` + `User.institutionId` are KEPT as a **derived "primary"** (display + the impersonation identity), recomputed on every assignment change. Authoritative checks read `roleAssignments`.
- Indexed `{ roleAssignments.institutionId, roleAssignments.role }` to drive institution rosters.

### Algorithm — `server/src/services/roleResolver.ts`

- `rolesAt(user, institutionId)` → the set of roles the user holds at that institution.
- `hasRoleAt(user, role, institutionId)` — pure (no admin short-circuit; callers add their own elevation). `lead_reader` satisfies a `reader` requirement.
- `accessibleInstitutionIds(user)` / `institutionIdsWithRole(user, role)` — for visibility scoping (Phase 3).
- `validateRoleAssignments(list)` — enforces the rules + normalizes (`lead_reader` absorbs `reader` at the same institution).

### Rules (enforced at assignment time)

- **Rule 1** — within ONE institution a user may NOT be `program_coordinator` together with `reader`/`lead_reader`. Cross-institution mixing (PC@A + reader/lead@B) is allowed.
- **Rule 2** — MULTIPLE users may be `program_coordinator` at the same institution (no uniqueness). `Institution.programCoordinatorId` becomes a derived "primary"; the real set = users with a PC assignment there.

### Phasing

1. **Phase 1** — model + migration + `roleResolver` + load `roleAssignments` into `req.user` in `auth.ts`. *(shipped)*
2. **Phase 2** — admin **Manage-roles** editor (UserManagement) + `PUT /api/users/:id/role-assignments`. *(shipped)*
3. **Phase 3** — migrate the access gates (the ~178 sites reading the single `req.user.role`/`institutionId`) onto `rolesAt`/`hasRoleAt`, so a user's SECONDARY-institution role is enforced end-to-end. Focus sites: `submissionController` list/get scoping + cross-institution guard + edit/submit gates; reader visibility (combine `reader@inst` with the `Assignment` record — see decision 1); `userController.getUsers` PC scoping; institution roster reads. **Also:** the dashboard lists ALL of the user's role assignments (institution + role) as clickable entries to switch context — no header switcher (decision 2). *(Approved 2026-06-14; ready to build.)*
4. **Phase 3b** — institution-side roster UI on the institution record: list + **add/remove** PCs / readers / lead readers (decision 3). Committed (not optional).

## Acceptance

- [x] `User.roleAssignments[]` data model + index.
- [x] `roleResolver` algorithm with Rule-1/Rule-2 enforcement + normalization.
- [x] `auth.ts` carries the effective identity's `roleAssignments` (impersonated user's while impersonating).
- [x] Admin can edit a user and add/remove role@institution with live Rule-1 validation (Manage-roles modal).
- [x] `PUT /api/users/:id/role-assignments` (admin-only) re-validates server-side + refreshes the derived primary.
- [x] Migration backfilled existing users (17 users, 0 conflicts; one correctly got lead_reader at two institutions).
- [x] Live-verified: same-institution PC+reader → 400; reader@Stevenson + PC@E2E → 200.
- [ ] **Phase 3** — access gates honor `roleAssignments` so cross-institution roles take full effect (edit/submit, list/get visibility, reader review); reader visibility stays Assignment-gated per submission (decision 1).
- [ ] **Phase 3** — dashboard lists every one of the user's role assignments (institution + role), each clickable to enter that context (decision 2).
- [ ] **Phase 3b** — institution-record roster UI: list + add/remove PCs / readers / lead readers (decision 3).

## Files affected (Phase 1+2 — commit fd98f24, 2026-06-14, branch developer)

- `server/src/models/User.ts` — `roleAssignments` field + `IRoleAssignment` + index.
- `server/src/services/roleResolver.ts` (new) — `rolesAt` / `hasRoleAt` / `accessibleInstitutionIds` / `institutionIdsWithRole` / `validateRoleAssignments`.
- `server/src/middleware/auth.ts` — load `roleAssignments` into `req.user` (effective identity).
- `server/src/controllers/userController.ts` — `setUserRoleAssignments` + `derivePrimary` + legacy Institution-field sync.
- `server/src/routes/users.ts` — `PUT /:id/role-assignments` (requireAdmin).
- `client/src/features/admin/Settings/UserManagement.tsx` — per-institution role chips + Manage-roles modal.
- One-time migration (mongosh) — backfill from single role + Institution assignment fields + active `Assignment` docs.

## Dependencies

- [[cr-017-cross-institution-isolation-audit]] — Phase 3 must not weaken cross-institution isolation; the gate rollout should preserve the existing 403-on-cross-institution behavior, generalized to "no role at that institution".
- Impersonation identity assumption (auth.ts) — `req.user` already fully assumes the impersonated user incl. `roleAssignments`, so Phase 3 gates work under impersonation.
- `Assignment` collection ([[cr-055-assignreaders-assignment-producer]]) — reader VISIBILITY stays Assignment-gated per submission; `roleAssignments` adds the institution-eligibility layer on top.

## Resolved decisions (2026-06-14 administrator review)

1. **Reader scoping** — KEEP Assignment-gated per submission; `roleAssignments` governs *eligibility* only (which institutions a user may read for), the `Assignment` record governs *which* submissions. (recommended option accepted)
2. **Multi-institution landing** — NO header switcher. The **dashboard lists every one of the user's role assignments** (institution + role); the user clicks an assignment to enter that context.
3. **Institution roster UI** — BUILD IT (Phase 3b): the institution record gets a roster with **add/remove** of PCs / readers / lead readers.
4. **Admin scope** — OUT OF SCOPE for CR-060. `admin` / superuser stay strictly global.
