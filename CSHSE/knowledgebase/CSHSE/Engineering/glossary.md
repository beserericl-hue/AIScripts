---
name: Glossary
description: Domain terms and acronyms used across the CSHSE portal codebase and docs.
type: glossary
last_reviewed: 2026-05-10
---

# Glossary

## Domain (accreditation)

- **CSHSE** — Council for Standards in Human Service Education. Accredits human-services degree programs in the US. Founded 1979.
- **Council / Board** — used interchangeably with CSHSE. The Board of Directors makes final accreditation decisions at three meetings/year (Feb, Jun, Oct).
- **Self-Study** — the report an institution prepares describing how its program meets each Standard. The portal's central artifact. Has TWO components: narrative response + supporting documentation. See [[product-requirements]].
- **Standard** — one of the 18–21 numbered requirements in a CSHSE degree-level rubric (e.g., Standard 11). Subdivided into **Specifications** (a–h).
- **Specification** — sub-item of a Standard, identified by lowercase letter. Each is independently assessed.
- **Initial Accreditation** — first-time accreditation. Two-year window from application to complete (no extensions). Requires self-study + site visit.
- **Reaccreditation** — every 5 and 10 years. **Interim** (5-year) needs only a self-study, no site visit. **Full** (10-year) requires both.
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

- **Superuser** — global flag on a `User`. Can impersonate any role via `X-Impersonated-Role` header. See [[system-architecture]].
- **Impersonation** — the mechanism a superuser uses to act with another role's permissions. State persists in the client `authStore`. No audit trail today (see [[security-audit-2026-05-10|L3]]).

## App roles

- **Superuser** — global flag on a `User`. Can impersonate any role via `X-Impersonated-Role` header. See [[system-architecture]].
- **Impersonation** — the mechanism a superuser uses to act with another role's permissions. State persists in the client `authStore`. No audit trail today (see [[security-audit-2026-05-10|L3]]).

## Tech

- **GridFS** — MongoDB's spec for storing files >16 BSON limit by chunking. The portal uses two buckets: `htmlContent` (imported document HTML) and `images` (extracted figures). See [[storage-layer]].
- **TipTap** — the rich-text editor library used for narrative editing. Built on **ProseMirror**.
- **ProseMirror** — the underlying schema/editing model TipTap wraps. Defaults to `table-fixed` for table sizing; CSHSE overrides to `table-auto` with `!important`.
- **DocumentViewer** — the React component that renders raw imported HTML (not via TipTap) for visual section tagging. See [[frontend-architecture]].
- **Marker / Placeholder** — HTML comment markers (`<!-- EXTRACTED:sectionId -->` and `TABLE_FRAG_START / TABLE_FRAG_END`) inserted into stored HTML to track extracted regions. Round-tripped via `insertHtmlMarker` / `restoreMarker` in [server/src/services/gridFsService.ts](../../../../server/src/services/gridFsService.ts).
- **SlicedString / ConsString** — V8 internal string representations. `substring()` produces `SlicedString` that retains the parent; concatenation produces `ConsString` chains. Both can prevent GC of large source strings. Workaround: `Buffer.from(s, 'utf-8').toString('utf-8')` to force a flat copy. See [[storage-layer]].

## External services

- **n8n** — visual workflow automation platform. Hosts all five AI workflows the portal calls into. See [[n8n-integration]].
- **Supabase** — Postgres-as-a-service. Used here for **pgvector** storage of help-chat document embeddings.
- **pgvector** — Postgres extension for vector similarity search. Backs the help-chat RAG.
- **RAG** — Retrieval-Augmented Generation. Pattern of "retrieve relevant docs first, then answer with an LLM grounded in them." Used by the help-chat workflow.
- **Railway** — the PaaS hosting the application container.
- **Mammoth** — DOCX-to-HTML converter. Used in the [[import-pipeline]].
- **pdf-parse** — PDF text extractor. Image extraction is **not** implemented (see [[incomplete-features-2026-05-10|#6]]).
- **Tesseract.js** — OCR library. Listed in `package.json` but not currently integrated.
