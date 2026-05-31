---
name: Glossary
description: Domain terms and acronyms used across the CSHSE portal codebase and docs.
type: glossary
last_reviewed: 2026-05-31
---

# Glossary

## Domain (accreditation)

- **CSHSE** — Council for Standards in Human Service Education. Accredits human-services degree programs in the US. Founded 1979.
- **Council / Board** — used interchangeably with CSHSE. The Board of Directors makes final accreditation decisions at three meetings/year (Feb, Jun, Oct).
- **Self-Study** — the report an institution prepares describing how its program meets each Standard. The portal's central artifact. Has TWO components: narrative response + supporting documentation. See [[product-requirements]].
- **Standard** — one of the 18–21 numbered requirements in a CSHSE degree-level rubric (e.g., Standard 11). Subdivided into **Specifications** (a–h).
- **Specification** — sub-item of a Standard, identified by lowercase letter. Each is independently assessed.
- **Initial Accreditation** — first-time accreditation. Two-year window from application to complete (no extensions). Requires self-study + site visit.
- **Reaccreditation** — Handbook language is "every 5 and 10 years": **Interim** (5-year) needs only a self-study, no site visit; **Full** (10-year) requires both. **Code note:** the board-cycle reminder feature (CR-053) defaults to a **7-year** expiry window for its "accreditation expiring" reminders (`board.cycle_reminder`) — a configurable reminder cadence, not a change to the Handbook's review schedule. Don't conflate the two.
- **Notice to Proceed** — letter from VPA opening the program's access to the accreditation platform after fees + application are received.
- **Site Visit** — 2–3 day on-site verification by 2 readers (one is the lead). Roughly 11 meetings per the Handbook's sample agenda. Required for initial accreditation and every 10 years thereafter. $4,500 + $200/extra-campus.
- **Tabled** — Board decision when there's insufficient information; program supplies more by a Board-set deadline (≥30 days before next meeting) or reapplies as initial.
- **Deny / Suspend / Revoke** — Board decisions when a program is out of compliance and cannot achieve compliance within the required timeline, OR a substantiated complaint is severe enough.

## CSHSE roles (people)

- **Program Coordinator** — institutional user who prepares and submits the self-study.
- **Reader / Reviewer** — drawn from Board members + qualified individuals approved by the Board. Independently reads the self-study and submits a written report within 45 days. May NOT contact the program directly.
- **Lead Reader** — compiles multiple readers' assessments into a single objective report to the Board. Routes any program-questions through the VPA. Becomes the **Lead Site Visitor** if a site visit is scheduled.
- **VPA** — Vice President for Accreditation. Coordinates everything Council-side: assigns readers, schedules board reviews, posts decision letters, monitors the platform, manages the Notice to Proceed.
- **Board Member-at-Large** — assigned as the program's **consultant** for the duration of the self-study writing process. Available for questions; explicitly NOT involved in reviewing the same program's accreditation.
- **Update Management, Inc.** — third-party org that processes membership/accreditation applications, dues, and fees. External to the portal.

## App roles (system)

- **Role enum** — the `User.role` values are **underscored**: `program_coordinator`, `reader`, `lead_reader`, `admin` (`server/src/models/APIKey.ts:17`). Older docs showed hyphens — those are wrong.
- **Superuser** — global flag on a `User`. Can impersonate any role via `X-Impersonated-Role` header. See [[system-architecture]].
- **Impersonation** — the mechanism a superuser uses to act with another role's permissions. State persists in the client `authStore`. No audit trail today (see [[security-audit-2026-05-10|L3]]).

## Review, scoring & decisions

- **0–3 Rubric** — the compliance score scale that replaced the old pass/fail. Each Spec is scored 0 (no evidence) → 3 (fully compliant). Readers pick it in `reader/Score4LevelSelector`; informs the AI confidence warnings (CR-003). Note: the reader PDF/DOCX export still renders pass/fail in places — see [[cr-003-zero-to-three-compliance-rubric]].
- **Reader Override** — a reader can override the AI-suggested score with their own, captured via `reader/ReaderOverrideControl`.
- **Compilation** — the lead reader's consolidation of multiple readers' per-Spec assessments into one report to the Board. Lives in `LeadReaderCompilation`; the lead stamps a **Final 0–3 score** per Spec (`LeadFinalScore` model; audit actions `compilation.final_set` / `final_cleared`). UI: `leadReader/CompilationTab`.
- **Relay / Relayed** — the admin (Julia) workflow of selectively forwarding reader comments back to the PC, optionally sanitized/anonymized (`pcLabel`). Audit actions `comment.relayed` / `comment.unrelayed`. See [[cr-023-julia-relay-workflow]].
- **Escalate (to Board)** — flag a comment for the Board's review queue rather than relaying it to the PC.
- **Board outcomes** — the recorded decision on a submission: **accept**, **table**, **deny**, **suspend**, **revoke** (audit action `board.decision_recorded`, CR-053). "Tabled" decisions carry a **reconsider date** that drives a `board.reconsider_reminder` notification.
- **N/A Spec (excluded)** — a Spec the PC marks Not Applicable, removing it from completeness/validation. Audit actions `submission.spec_marked_na` / `spec_na_cleared` (CR-050).
- **Preflight** — the server-side pre-submission validation (`GET /api/submissions/:id/preflight`) that returns structured errors + warnings shown in the `FinalSubmitModal` (CR-008).
- **Submission lockout** — once the PC final-submits, the submission is read-only; `submissionLockout` middleware returns `403 LOCKED` on PC writes (CR-005).

## Site visit

- **Site-Visit Checklist** — per-item verification list the visiting team works through; items can be verified/un-verified (audit `checklist.item_verified`). Model `SiteVisitChecklistItem`; DOCX export via `siteVisitChecklistDocx`. CR-012.
- **Itinerary** — the site-visit agenda, co-editable by lead reader + PC (audit `itinerary.updated`). CR-013.

## Notifications & messaging

- **Notification** — in-app message to a user (`Notification` model). Types: `dm.new_message`, `board.cycle_reminder`, `board.reconsider_reminder`.
- **dedupeKey** — a unique-per-recipient key on a `Notification` that makes delivery idempotent, so cron re-runs don't double-notify. See `server/src/models/Notification.ts:10`.
- **Direct Message (DM)** — reader ↔ admin threaded messaging (`DirectMessage` model; participant roles `reader | lead_reader | admin`). CR-010.
- **Hint / Tour** — the onboarding overlay (`tour/` feature) and per-feature contextual hints. CR-052.

## Org & audit

- **Joint Venture (JV)** — a named grouping of multiple institutions sharing one accreditation effort. `JointVenture` model; auto-archives when membership drops below 2. Audit actions `jv.*`. CR-019. UI: `admin/JointVentureManagement`.
- **Audit Log** — append-only `AuditLogEntry` collection; pre-save/update/delete hooks throw to enforce immutability. Surfaced in `admin/AuditTrail`. The `AuditAction` union enumerates every tracked event (submit/lock/relay/compilation/checklist/itinerary/board/jv/account).
- **Bug Report** — in-app user-submitted bug (`BugReport` model / `bugReportController`).
- **Document Version** — versioned snapshot of a document (`DocumentVersion` / `documentVersionService`).

## Tech

- **GridFS** — MongoDB's spec for storing files >16 BSON limit by chunking. The portal uses two buckets: `htmlContent` (imported document HTML) and `images` (extracted figures). See [[storage-layer]].
- **TipTap** — the rich-text editor library used for narrative editing. Built on **ProseMirror**.
- **ProseMirror** — the underlying schema/editing model TipTap wraps. Defaults to `table-fixed` for table sizing; CSHSE overrides to `table-auto` with `!important`.
- **DocumentViewer** — the React component that renders raw imported HTML (not via TipTap) for visual section tagging. See [[frontend-architecture]].
- **Marker / Placeholder** — HTML comment markers (`<!-- EXTRACTED:sectionId -->` and `TABLE_FRAG_START / TABLE_FRAG_END`) inserted into stored HTML to track extracted regions. Round-tripped via `insertHtmlMarker` / `restoreMarker` in [server/src/services/gridFsService.ts](../../../../server/src/services/gridFsService.ts).
- **SlicedString / ConsString** — V8 internal string representations. `substring()` produces `SlicedString` that retains the parent; concatenation produces `ConsString` chains. Both can prevent GC of large source strings. Workaround: `Buffer.from(s, 'utf-8').toString('utf-8')` to force a flat copy. See [[storage-layer]].

## External services

- **cshse-ai** — the Python **FastAPI** microservice that powers the AI import wizard + section evaluation. Splits/embeds uploaded self-studies, calls Claude Haiku to tag Standards/Specs and classify evidence. Deployed as a second Railway service in `bubbly-solace`; talks to the Node server over **HMAC-SHA256**. Job-based API (`/ai/import/start` → `/ai/import/{job_id}`). See [[legacy-self-study-import]].
- **FastAPI** — the Python async web framework `cshse-ai` is built on.
- **Qdrant** — the vector database `cshse-ai` embeds sections into for similarity search (per-job isolation). Replaces the older Supabase/pgvector RAG for the import path.
- **Anthropic Claude Haiku** — the LLM `cshse-ai` uses for Standard/Spec tagging, evidence classification, and per-section 0–3 evaluation.
- **OpenAI embeddings** — text-embedding model `cshse-ai` uses to vectorize sections before Qdrant upsert.
- **MemberClick / SSO** — cshse.org's membership platform; the portal accepts a MemberClick browser **ticket** at `/sso/v1/*` for single sign-on.
- **n8n** — **legacy.** Visual workflow automation. Originally hosted five AI workflows; import + validation are retired (moved to `cshse-ai` / replaced by `/preflight`). Today only the help-chat RAG path may still route through it. See [[n8n-integration]].
- **Supabase / pgvector** — **legacy** RAG store for the help-chat path; the import pipeline now uses Qdrant.
- **RAG** — Retrieval-Augmented Generation. "Retrieve relevant docs first, then answer with an LLM grounded in them." Used by the help-chat workflow.
- **Railway** — the PaaS hosting both the Node server and `cshse-ai` containers. Two environments — see [[railway-deployment-topology]].
- **Mammoth** — DOCX-to-HTML converter. Used in the [[import-pipeline]].
- **pdf-parse** — PDF text extractor. Image extraction is **not** implemented (see [[incomplete-features-2026-05-10|#6]]).
- **Tesseract.js** — OCR library. Listed in `package.json` but not currently integrated.
