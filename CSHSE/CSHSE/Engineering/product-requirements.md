---
name: Product Requirements
description: What the CSHSE portal must support, derived from the 2024 Member Handbook (Accreditation and Self-Study Guide). The mental model an engineer needs before designing features or reviewing code.
type: concept
tags: [product, requirements, accreditation, handbook]
last_reviewed: 2026-05-10
---

# Product Requirements

Source: [CSHSE Member Handbook — 2024 FINAL.pdf](../../../../CSHSE%20Member%20Handbook%20-%202024%20FINAL.pdf), the [Associate](../../../../CSHSE-National-Standards-Associate-Degree-Revised%20-July%2028-2025.pdf) / [Baccalaureate](../../../../CSHSE-National-Standards-Baccalaureate-Degree-Revised%20-%20July%2028-2025.pdf) / [Master's](../../../../CSHSE-National-Standards-Masters-Degree-Revised%20July%2027-2025.pdf) standards PDFs.

## What CSHSE actually does

CSHSE accredits human-services degree programs (Associate / Baccalaureate / Master's). Programs become Members first; Members then go through Initial Accreditation, then Reaccreditation every 5 years (interim, no site visit) and 10 years (full, with site visit). The portal is the online platform where the **Self-Study** is prepared, uploaded, read, and acted on by the Council Board.

## The Self-Study has TWO required components

1. **Narrative response** — written prose, organized by Standard and by Specification (sub-item, e.g., 11a, 11b). For each Spec, the program must explain *how* it complies, citing specific syllabi/assignments/courses.
2. **Supporting documentation** — uploaded files (PDF strongly preferred) and external hyperlinks (must work, must NOT be password-protected). Examples called out by the Handbook:
   - **Course syllabi** for every required course on the matrix
   - **Curriculum matrix** (the I/T/K/S × L/M/H grid)
   - **Advisory committee minutes**
   - **Field placement manuals**
   - **Student handbooks**
   - **Evaluation forms and learning contracts**
   - **College catalog**
   - **Surveys** (students, graduates, employers, faculty)
   - **Student achievement / learning outcomes data** (must be within last 2 years)
   - **Program budget**
   - **Library / Student Services / Technology resources**
   - **Signed Certificate Page** (validates institutional approval)
   - **Organizational charts** (for multi-campus programs)
   - **Course assignments / projects** when not embedded in a syllabus
   - **Glossary of terms** used in the self-study

> Quote (Handbook §IV): *"Explaining how your program complies must always include reference(s) to a specific document or source where the reader can find evidence to verify your claim(s). If the highlighted assignment, project, or activity is not included in the course syllabus, upload the document that provides assignment specifics."*

This is **the central design driver** for [[evidence-document-review-pipeline|automated document review]]: a Spec is only meaningfully assessed when its narrative *and* its cited evidence files have both been read and judged together.

## Reader workflow (Handbook §III)

1. VPA assigns 2–3 readers + 1 designated lead reader within 15 days of the program's "request readers" event.
2. Readers have **45 days** to submit individual written reports.
3. Readers may NOT contact the program directly; questions route through the lead reader → VPA.
4. Lead reader compiles all reader reports + recommendations into a single objective formal report to the Board.
5. If reports are sufficient, VPA invites a **Site Visit** (2–3 days, ~11 meetings per the sample agenda).
6. Site visitors are drawn from the assigned readers; the lead reader serves as the lead site visitor.
7. Board acts at the next meeting (Feb / Jun / Oct). Outcomes (Appendix A):
   - **Accredited** — all standards met (recommendations may be added but not required for follow-up).
   - **Tabled** — insufficient information; program supplies more by a Board-set deadline (≥30 days before next meeting) or reapplies as initial.
   - **Deny / Suspend / Revoke** — out of compliance with one or more standards and compliance can't be achieved within the required timeline, OR a substantiated complaint is severe enough.

## What the portal must support (in priority order)

### Tier 1 — already substantially built

- Per-Standard / per-Spec narrative editing with auto-save.
- Curriculum matrix (courses × Specs with I/T/K/S × L/M/H markers).
- Evidence file upload to a Spec, with versioning when re-uploaded.
- Reader / Lead Reader split-screen workspace + comments.
- Lead Reader compilation view + final-determination capture.
- Site Visit scheduling and itinerary capture (partial — emails stubbed; see [[incomplete-features-2026-05-10|#1]]).

### Tier 2 — partially built or missing

- **AI review of evidence files themselves**, not just the narrative. The current validation workflow scores narrative + a 10K-char snippet of fetched URLs. **It never opens the S3-stored PDF/DOCX evidence.** This is the gap the May 2026 product brief calls out and is the subject of [[evidence-document-review-pipeline]].
- **Common-error checks** the Handbook explicitly lists (§IV "Common Errors"): matrix↔narrative congruence, missing Specs, missing required document types, inconsistent data, unlinked references, broken/expired hyperlinks. None are implemented today; all are mechanizable.
- **Email notifications** at every workflow transition (assignment, reader-due-soon, lead-report-due, board-decision). Stubs exist in 4 controllers — see [[incomplete-features-2026-05-10|#1]].
- **Self-Study Completion Checklist** — referenced in the Handbook; the portal should enforce this as a pre-submit gate.
- **PDF / hyperlink hygiene checks** — the Handbook is explicit that documents must be PDF and links must work and not be password-protected. The portal should validate at upload.
- **Exit/notification flow for Board decisions** — informal within 10 days, formal within 30 days, posted to website within 30 days. Today nothing automates this.

### Tier 3 — nice-to-haves implied by the Handbook

- Two-year deadline tracking for Initial Accreditation (program forfeits if not complete by then).
- Membership / dues lifecycle integration (lapse → automatic accreditation lapse).
- Cycle scheduler: 5-year interim, 10-year full, automatic reminders.
- Mock site visit checklist + itinerary builder using the Handbook's sample 2.5-day schedule as the template.

## Hard requirements the portal must NOT violate

- **Confidentiality** — reader feedback is "confidential and available only to Board members." The portal must enforce this in the role model. Today's superuser-impersonation pattern is a risk if not tightly audit-logged ([[security-audit-2026-05-10|L3]]).
- **No direct reader↔program contact** — UI should not surface reader identities to program coordinators during the review.
- **PDF + open-link rule** — uploads should default-encourage PDF; URL evidence should be probed for accessibility before save.

## User-requested additions (post-Handbook, 2026-05-11)

These are not in the 2024 Member Handbook but were raised by the product owner on 2026-05-11 (U1, U2, U3) and 2026-05-14 (U4). They're real product requirements for beta; planned in [[sprint-plan-2026-05-11|S2.10, S4.10 + Sprint 7]].

### U1. Multiple Program Coordinators per Institution

**Requirement:** One institution can have ≥1 Program Coordinator assigned. Real institutions often have two or more departments being accredited in parallel (e.g., Bachelor's in Human Services and Master's in Human Services run by different department chairs), each with their own PC.

**Today's behavior:** Institution model treats `coordinator` as a single field. Permission checks ask "is this user the PC of this institution?" — singular.

**Required behavior:**
- Admin can assign N coordinators to one institution.
- Each coordinator has the same PC permissions (no hierarchy among PCs).
- Each coordinator sees the institution + all its submissions in their dashboard.
- Removing the last coordinator is blocked or strongly confirmed.
- Submissions don't need to be partitioned per-coordinator — coordinators share access to all of the institution's submissions; departmental coordination happens out-of-band.

**Scope:** Data model + permission checks + admin UI. No new role.

### U3. Template-driven curriculum matrices, with multi-matrix per submission

**Requirement:** The curriculum matrix editor must follow the CSHSE matrix template structure exactly — pre-populating standards / specifications rows from the template, displaying the official directions visibly, and letting coordinators add their own course columns and mark cells. Coordinators must be able to create **multiple matrix instances per submission** when one matrix isn't wide enough to hold all required courses (per the template's instruction #1: *"Use as many versions of the Matrix as needed to deal with all of your required courses"*).

**Source documents (the templates):**
- Associate-level matrix template — Standards 11–20, 250 field-experience hours.
- Baccalaureate-level matrix template — Standards 11–21, 350 field-experience hours.
- Master's-level matrix template — Standards 11–21.

The user provided Google Docs links 2026-05-11; templates should be saved into the repo at `docs/matrix-templates/{associate,baccalaureate,masters}-matrix-template.docx` so they are version-controlled and accessible from the editor.

**Key behaviors required by the templates:**
- **Standards / Specifications rows are template-supplied,** not user-entered. The template defines which rows appear and the spec text in each row.
- **Course numbers appear as column headers, displayed vertically.**
- **Each cell may carry multiple letters** — the marking legend is a *combination* of content type (`I` = Introduction, `T` = Theory, `K` = Knowledge base, `S` = Skills / Field experience practice) and depth (`L` = Low, `M` = Moderate, `H` = Heavy). E.g., a cell may read `I, T, H`.
- **Multiple matrices per submission** when courses overflow a single matrix's column capacity.
- **Each matrix-listed course must be cross-referenced in the narrative** — the matrix↔narrative congruence check from [[incomplete-features-2026-05-11|T2.2]] should validate this.
- **Editor pre-fills missing data** — opening a fresh matrix populates all standards / specifications rows from the template; the user only enters course numbers and cell markings.
- **Directions visible in the editor** — the numbered template directions appear as a collapsible help panel above the grid.

**Today's behavior:** The matrix backend ([server/src/models/CurriculumMatrix.ts](../../../../server/src/models/CurriculumMatrix.ts)) supports the `CourseAssessment[]` shape (with array `type[]` matching the multi-letter requirement) and there's already a `matrixType: 'human_services_courses' | 'non_human_services_courses' | 'custom'` enum and a `Submission.curriculumMatrices: ObjectId[]` array reference. The data model is mostly there. **Missing:**
- Template registry (which standards / specifications rows belong to which program-level template).
- Client UI to drive template-based generation.
- UI workflow for spawning additional matrices on the same submission.
- Display of the official directions inside the editor.
- Cross-reference between matrix-listed courses and narrative HTML (the validation half of T2.2).

**Scope:** Server-side template registry + reference doc storage; client-side template-driven generator + multi-matrix UI + directions panel + per-cell multi-letter input. No permission changes; no new role.

### U4. Reader report — template-based DOCX export

**Requirement:** Each reader produces a single Word-document report for the self-study they reviewed. The report is generated from a CSHSE-issued template (one template per degree level — Associate, Baccalaureate, Master's), populated with the reader's own comments slotted into the correct Standard / Sub-standard sections. The reader triggers generation when their review is complete. The generated DOCX is automatically copied to shared storage so the Lead Reader can pick up all three reader reports as input for compilation. There is exactly **one report per reader per submission**, and the template selected is driven by `review.programLevel` (no manual choice).

**Source documents (the templates):** User provided Google Docs links 2026-05-14:
- Associate-level reader report template — `1YBs8V1LDNTvob80xU-dFQOCMCpEtwH07`
- Baccalaureate-level reader report template — `1Xz8VItPH0a4OKuUttZK69WlK1D7XzmLB`
- Master's-level reader report template — `13uvbdX5ySF6ygJJ4MkN2hiW5zMBk4OiO`

Templates should be saved into the repo at `docs/reader-report-templates/{associate,bachelors,masters}-reader-report-template.docx` so they are version-controlled, AND uploaded once to S3 under `reader-report-templates/{level}.docx` so the generator can fetch the active version without a redeploy. Admin re-uploads via Settings replace the S3 copy; the repo copy is the rollback seed.

**Required behavior:**
- Admin uploads / replaces each of the 3 templates from the Settings area; current uploaded-at + filename visible per level.
- Reader on the review-complete screen sees a "Generate Report" button; clicking it produces the filled DOCX, persists `Review.readerReportS3Key`, and offers an immediate download.
- Comments are placed by [Comment.standardCode](../../../../server/src/models/Comment.ts) (Standard) and [Comment.specCode](../../../../server/src/models/Comment.ts) (Sub-standard / Spec letter) — these fields already exist on the model, so no schema migration is needed.
- On review submit ([reviewController.ts:470](../../../../server/src/controllers/reviewController.ts#L470)) the generator fires asynchronously and writes the DOCX to `submissions/{submissionId}/reader-reports/{reviewerId}.docx` in S3. Idempotent on re-submit.
- Lead Reader's compilation view lists a download link per reader for the auto-shared DOCX; no manual upload needed.
- Reader names appear as real names in the DOCX (the Lead Reader is the audience); PC-facing surfaces remain redacted per the reader-identity redaction rule.

**Scope:** Template registry (server) + generator service + admin upload UI + reader-side button + lead-reader-side download link. Reuses the existing [s3Service](../../../../server/src/services/s3Service.ts) for storage and adds `docxtemplater` for template filling. No permission changes; no new role.

**Today's behavior:** [reportController.ts](../../../../server/src/controllers/reportController.ts) only generates a generic PDF via [pdfGenerator.ts](../../../../server/src/services/pdfGenerator.ts); there is no DOCX path, no template registry, and no auto-copy to shared storage for the Lead Reader.

### U2. Joint Ventures (institution grouping)

**Requirement:** Group 2+ institutions into a named "Joint Venture" for dashboard organization and aggregate reporting. Use case: consortium-style accreditation efforts, or multi-campus systems where the institutions are legally distinct but operationally linked.

**Scope is explicitly cosmetic / organizational only:**
- A Joint Venture has a name, description, and a list of member institutions (≥2).
- One institution belongs to at most one Joint Venture at a time.
- **Permissions do not change.** No new role; no JV-level access grant. A user who is a PC of one member institution still only has PC access to that institution, not to the others in the JV.
- The JV layer affects how things are *displayed* (dashboard grouping, admin filter dropdown, optional aggregate stats) — not who can read or write what.

**Required behavior:**
- Admin can create / edit / archive Joint Ventures from the Settings area.
- Admin / Lead Reader dashboard groups institutions by their JV (with a "Standalone" group for ungrouped institutions).
- PCs / Readers see a "Joint Venture: {name}" badge on their institution if it belongs to one — read-only context.
- Reports can be filtered by Joint Venture, aggregating across all member institutions.

## Related

- [[evidence-document-review-pipeline]] — the missing AI workflow for reading uploaded evidence
- [[overview]] — system overview
- [[sprint-plan-2026-05-10]] — superseded; see [[sprint-plan-2026-05-11]]
- [[sprint-plan-2026-05-11]] — current roadmap; carries U1 (S2.10) and U2 (Sprint 7)
- [[glossary]] — VPA, Lead Reader, Site Visit, etc.
- [[incomplete-features-2026-05-11]] — current product-requirements gap audit
