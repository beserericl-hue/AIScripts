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

## Related

- [[evidence-document-review-pipeline]] — the missing AI workflow for reading uploaded evidence
- [[overview]] — system overview
- [[sprint-plan-2026-05-10]] — current roadmap
- [[glossary]] — VPA, Lead Reader, Site Visit, etc.
