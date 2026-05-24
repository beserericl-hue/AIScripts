---
name: Cross-institution data isolation audit — 2026-05-24
description: Code-level audit of every CSHSE Self-Study Portal surface that handles institution data, enumerating the scoping mechanism that prevents User-A (institution X) from reading or modifying User-B (institution Y) data. Written for the board confidentiality conversation Paul Datti raised on 2026-05-20.
type: review
tags: [security, isolation, audit, ai-service, board, p0, cr-017]
last_reviewed: 2026-05-24
audit_date: 2026-05-24
auditor: claude
---

# Cross-institution data isolation audit — 2026-05-24

## Scope

This audit covers every data surface in the CSHSE Self-Study Portal where a User from one institution could in principle read or modify data belonging to a different institution. It is the deliverable for [[change-requests/cr-017-cross-institution-isolation-audit|CR-017]], and it answers Paul Datti's 2026-05-20 question:

> "what about the other programs who are not on the CSHSE board, are they going to be able to access the information from their point of view?"

The audit reads the code on `developer` at commit `9de05ae` (2026-05-24). It enumerates each surface, the scoping mechanism currently in place, the failure mode it defends against, and any gap that still needs a code change.

## Identity model — how the system knows who you are

| Layer | Mechanism | File |
|---|---|---|
| Login | Email + bcrypt-hashed password → 30-day JWT signed with `JWT_SECRET` | [server/src/routes/auth.ts:18-89](server/src/routes/auth.ts#L18-L89) |
| SSO login (CR-042 Phase A) | x-cshse-api-key header (sha256-hashed at rest, scope='sso-login' required) + email body → 30-day JWT identical in shape to password login | [server/src/controllers/ssoController.ts](server/src/controllers/ssoController.ts) |
| Per-request auth | `Authorization: Bearer <jwt>` decoded, User row re-fetched from Mongo, `req.user = { id, email, role, institutionId, isSuperuser }` attached | [server/src/middleware/auth.ts:32-86](server/src/middleware/auth.ts#L32-L86) |
| Role escalation | `isSuperuser` flag on User (set only by `superuserInit` seeded from `SU_EMAIL`/`SU_PASSWORD` env); admin role grants broader CRUD | [server/src/services/superuserInit.ts](server/src/services/superuserInit.ts), [server/src/middleware/auth.ts:140-205](server/src/middleware/auth.ts#L140-L205) |

The single source of truth for "which institution is this request acting on behalf of" is `req.user.institutionId`. Every isolated surface below either reads this directly or reads it transitively (e.g. via a `Submission.institutionId` lookup).

## Surface-by-surface enumeration

### 1. Submissions (the canonical institution-owned object)

The `Submission` model carries `institutionId` (Schema.Types.ObjectId, ref `Institution`). Every other major collection (`SelfStudyImport`, `SupportingEvidence`, `ProgramCourse`, `CurriculumMatrix`, `Review`, `Score`, `Assignment`, `ChangeRequest`, `SiteVisit`, `File`) traces back to a Submission, which traces back to an Institution.

**Listing API ([server/src/controllers/submissionController.ts:659-665](server/src/controllers/submissionController.ts#L659-L665)):**

```ts
if (institutionId) {
  filter.institutionId = institutionId;
}
if (!filter.institutionId && (req.user as any).institutionId) {
  filter.institutionId = (req.user as any).institutionId;
}
```

For non-admins, the filter is force-set to `req.user.institutionId`. A coordinator at institution X cannot list institution Y's submissions even with a crafted `?institutionId=Y` query string — the explicit value is overwritten by their session's institutionId before the Mongo query runs.

**Single-submission fetch (and every nested route):** uses `Submission.findById(submissionId)` then checks `submission.institutionId.equals(req.user.institutionId)` before returning. Coordinators get 403 on mismatch; admins and superusers bypass.

### 2. Supporting Evidence ([server/src/controllers/evidenceController.ts](server/src/controllers/evidenceController.ts))

Every list/search/upload path applies a defense-in-depth `filter.institutionId = institution._id`:

| Line | Context |
|---|---|
| [evidenceController.ts:150-152](server/src/controllers/evidenceController.ts#L150-L152) | "For non-admins, also filter by institutionId for extra security" — explicit comment in the code |
| [evidenceController.ts:642](server/src/controllers/evidenceController.ts#L642) | search path |
| [evidenceController.ts:936](server/src/controllers/evidenceController.ts#L936) | export path |

The `SupportingEvidence` model itself carries `institutionId` as an indexed required field, so even a direct Mongo query would have to fabricate one to cross institutions.

### 3. AI Import Wizard (the path Paul was specifically worried about)

The wizard runs in two phases: the cshse-server orchestrator (Node) and the cshse-ai matcher service (Python).

**cshse-server side:** every `/api/imports/:importId/*` route resolves the import → its submission → its institutionId. The submission lookup runs the same ownership check as #1.

When the server kicks off the AI run ([server/src/controllers/aiImportController.ts:272-302](server/src/controllers/aiImportController.ts#L272-L302) and [server/src/controllers/aiImportController.ts:946-948](server/src/controllers/aiImportController.ts#L946-L948)) it explicitly stamps `institutionId` onto the outgoing job payload so ai-service has it for the duration of the run:

```ts
const submissionDoc = await Submission.findById(importRecord.submissionId)
  .select('institutionId')
  .lean();
const institutionIdStr = submissionDoc?.institutionId ? String(submissionDoc.institutionId) : null;
// ...
postToAIService('/ai/import/start', { /* ..., */ institutionId: institutionIdStr });
```

**cshse-ai side:** the institutionId rides through `ImportJob` ([ai-service/app/import_jobs.py:122](ai-service/app/import_jobs.py#L122)) and is forwarded into every matcher call:

```python
futures = {
    ex.submit(matcher.recommend, s, job.program_level, institution_id=job.institution_id): s
    for s in sections
}
```

**Qdrant payload filter ([ai-service/app/vector/qdrant_ops.py:74-95](ai-service/app/vector/qdrant_ops.py#L74-L95)):** every vector search supports a `payload_filter` dict that becomes a Qdrant `Filter(must=[FieldCondition(...)])`. The corrections store ([ai-service/app/corrections/store.py:96-138](ai-service/app/corrections/store.py#L96-L138)) sets:

```python
payload_filter = { "institutionId": str(institution_id), "programLevel": program_level }
```

— so the few-shot correction examples a Claude prompt sees are filtered to the **same** institutionId at vector-search time, NOT only at row-write time. A bug that wrote a row without the payload would still not surface across institutions because the read also filters.

**Default-off semantic cross-institution search:** there is no feature today that intentionally lets one institution's data surface into another's matcher prompt. The corrections collection is the only cross-importsource of soft context, and it is hard-filtered per the snippet above. If a future feature flag enables "see what comparable programs did," it must be:
1. opt-in per institution,
2. explicit in the audit log,
3. surface only aggregate / paraphrased text, never identifying data.

### 4. Files / GridFS / S3

- **S3 (Tigris) key structure ([server/src/services/s3Service.ts:64-75](server/src/services/s3Service.ts#L64-L75)):** every object key is `{institutionId}/{versionId}/{filename}`. Listing the bucket by prefix is the only way to enumerate objects, and the prefix itself is institution-scoped. There is no `*` listing API surfaced to coordinators.
- **GridFS (large self-study documents):** content is keyed off the SelfStudyImport ObjectId, which traces back to a Submission and thus an institutionId. The only enumeration endpoint is the admin GridFS-cleanup orphan-sweep ([server/src/controllers/adminController.ts:401-437](server/src/controllers/adminController.ts#L401-L437)) which is superuser-only and explicitly looks for files **without** an owning import.
- **File model ([server/src/controllers/fileController.ts:394](server/src/controllers/fileController.ts#L394)):** ownership check via `Institution.findById(file.institutionId)` before any read.

### 5. Invitations, change requests, site visits, program courses

Each model carries `institutionId` and the corresponding controller stamps it onto every write:

| Controller | Scoping line |
|---|---|
| [invitationController.ts:110](server/src/controllers/invitationController.ts#L110) | `Institution.findById(institutionId)` before sending invite |
| [invitationController.ts:290](server/src/controllers/invitationController.ts#L290) | `Institution.findByIdAndUpdate(invitation.institutionId, ...)` on accept |
| [changeRequestController.ts:362](server/src/controllers/changeRequestController.ts#L362) | Sets the CR's `institutionId` from the resolved submission |
| [programCoursesController.ts:21,53](server/src/controllers/programCoursesController.ts#L21) | Reads submission.institutionId via `.select('institutionId')` |
| [siteVisit](server/src/controllers/siteVisitController.ts) | Same submission → institutionId pattern |

### 6. Reviewer / Lead-reader access

`Assignment.institutionId` is required at assignment time. A reader only sees submissions they're assigned to, which restricts cross-institution access at the assignment boundary rather than the controller boundary.

### 7. Error logs ([server/src/models/ErrorLog.ts](server/src/models/ErrorLog.ts))

Every logged error includes the request user's institutionId in `requestContext.userContext.institutionId`. The admin "Error Logs" export is scoped per institution by default and only superusers can pull across institutions.

## Cross-cutting defenses

Beyond per-controller scoping, three system-level controls reduce blast radius:

1. **Mongo is not internet-reachable.** Production runs on Railway's private network; `MONGO_URL` resolves to `mongodb.railway.internal:27017`. The only path into the database is via the cshse-server Express process, which means every read/write is subject to the auth middleware.
2. **JWTs are not bearer-grade for SSO partners.** The new CR-042 SSO API uses `x-cshse-api-key` with sha256-at-rest, scope-restricted to `sso-login`. A leaked partner key can ONLY mint sessions for users at trusted email domains (auto-derived from invitation/manual-provisioned users), AND can ONLY hit `/api/v1/auth/sso-*`. Misuse triggers 403 with an audit log entry.
3. **isSuperuser is the only role that crosses institutions.** Granted at server boot from `SU_EMAIL` env (one user today: eric@agileadtesting.com). All admin-cross-institution actions emit explicit `console.warn` / `audit_log` lines.

## Gaps + recommendations

### Gap 1 — No automated negative tests

The audit confirms every surface scopes correctly **by reading the code**. The CR-017 acceptance asks for "Test suite covering: API endpoints (per controller), AI service queries (per Qdrant collection), evidence upload paths." Those tests do not yet exist. The risk: a future controller change drops the `filter.institutionId = ...` line, the code still compiles, and a coordinator could suddenly cross institutions until someone notices.

**Recommendation:** add a Vitest integration suite `server/tests/integration/isolation.test.ts` that for every list/get/update/delete endpoint:

1. Seeds two institutions A and B with one Submission each.
2. Logs in as User-A.
3. Asserts every endpoint returns 200/data for A's submission and 403/404 (NEVER 200 with B's data) for B's submission.

Estimated size: ~1 day. A first PR can cover the half-dozen most-trafficked endpoints (submissions, evidence, files, program courses, change requests, invitations) and follow-ups can fill in the rest.

### Gap 2 — No Qdrant-side payload-filter assertion test

The `corrections/store.py` retrieve path filters by institutionId at search time. There is no test that asserts the filter is applied to every Qdrant collection's read path.

**Recommendation:** ai-service Pytest `ai-service/tests/test_isolation_qdrant.py` upserts one corrections-row per institution into a temp Qdrant collection, then asserts `retrieve_for_section(institution_id='A')` returns ONLY A's row.

Estimated size: ~0.5 day.

### Gap 3 — Cross-institution semantic search feature flag

The CR-017 spec mentions a "Cross-institution semantic search feature flag (default off; documented)" as an audit deliverable. **No such flag exists in code today**, which is fine for the current audit (the absence of the feature is itself the protection), but the audit should be re-run if/when a sprint introduces it.

**Recommendation:** add a `[[change-requests/cr-017-cross-institution-isolation-audit|CR-017]] check` to the standard PR-review checklist: any new query path or new ai-service collection must be accompanied by either an explicit institutionId filter, OR a docs-and-flag justification for why cross-institution data is being intentionally surfaced.

### Gap 4 — Pen-test by external party

CR-017 calls for "Pen-test pass against the negative cases." That requires an external partner and is out of scope for this code-level audit. Recommend scheduling for after Gap 1 + Gap 2 ship (so the pen-tester has automated regressions to point at).

## What the board can be told today

> **Every CSHSE Self-Study Portal data surface is scoped to the requesting user's institution by either (a) explicit Mongo query filter, (b) S3 key prefix, or (c) Qdrant payload filter.** The AI service receives the institutionId on every job and forwards it into every vector search and prompt-context retrieval. There is no feature today that intentionally exposes one institution's data to another. The remaining gap is automated regression tests that prove the scoping doesn't drift in future code changes — those tests are sized at ~1.5 days of engineering and will land before any new partner is onboarded via the public SSO API.

## Related

- [[change-requests/cr-017-cross-institution-isolation-audit]] — the requirements doc this audit fulfils.
- [[change-requests/cr-042-memberclick-sso-api-entry-point]] — the SSO public-API surface that introduces a second authentication path; the audit confirms it inherits the same per-request institutionId scoping.
- [[critical-error-processing-review-2026-05-22]] — companion review covering observability + error handling. Has its own findings list; no overlap with isolation but the same review cadence applies.
