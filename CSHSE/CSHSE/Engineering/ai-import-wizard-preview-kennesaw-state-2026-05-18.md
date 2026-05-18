---
name: AI Import Wizard — Kennesaw State Template Preview 2026-05-18
description: End-to-end live run of the wizard pipeline against the CSHSE Self-Study Template format (Kennesaw State partial sample). Spec-as-outline input: each section heading IS a Handbook prompt. For every spec, shows what would land in narratives / supporting-evidence text / supporting-evidence files, which template sections remain unauthored, and which placed sections need human triage. Parallel to [[ai-import-wizard-preview-stevenson-2026-05-18]].
type: review
tags: [ai-import, sprint-1, template-format, kennesaw-state, wizard-preview, audit]
audit_date: 2026-05-18
auditor: claude
last_reviewed: 2026-05-18
---

# AI Import Wizard — Kennesaw State Template Preview (2026-05-18)

This page is the **complete output the AI Import Wizard would produce on `Sample to Council from KSU.docx`** — a partial-fill of the CSHSE Self-Study Template for the bachelors program level. The template format is the spec-as-outline variant of the self-study: each section heading is a Handbook prompt, the institution writes a `Response:` underneath, and the same document gets re-imported as more sections are filled.

Parallel to [[ai-import-wizard-preview-stevenson-2026-05-18]] (which targets Stevenson's finished free-form self-study). The wizard's downstream contract is identical — narratives, supporting-evidence text, supporting-evidence files, tag list — but the **walker** is the new piece: it cuts on template heading patterns (`1.`, `2a.`, `Standard 1, Specification a`), strips `Response:` markers, and detects unwritten / `Not applicable` responses as placeholders.

Pipeline that produced this:

1. **Template walker** (`ai-service/app/splitter/template_walker.py`) — reads the DOCX paragraphs, cuts on heading patterns, accumulates `Response:` bodies.
2. **Spec matcher** (`ai-service/app/matcher/spec_matcher.py`) — embedding + Haiku adjudication, run only on authored sections.
3. **Bucket allocation** — same auto-apply rules as Stevenson (narrative if < 1000 words & conf ≥ 0.85; evidence text if longer; evidence file for syllabus/CV/handbook shape; tag list below 0.50).
4. **First-pass coverage review** — Haiku per spec, run only on specs with at least one bucket entry. Empty specs get a synthesized "no content yet" verdict (saves ~80 % of the coverage cost on a partial-fill document).
5. **No gap-fill pass** — the template has no appendix to search. Gap-fill becomes relevant once the institution adds appendix items in a later import.
6. **Auto-apply rules** from [[import-wizard-ui-spec-2026-05-17]].

## Top-level summary

- Source document: `Sample to Council from KSU.docx` (bachelors program level)
- Specs in Handbook (bachelors): **96**
- Template sections detected: **27** (authored: **14**, placeholder/unwritten: **13**)
- Authored words across all responses: **6,417**
- Specs with at least one wizard write: **9**
- Specs with narrative content: **9**
- Specs with supporting-evidence text: **0**
- Specs with supporting-evidence files: **1**
- Total evidence files (with simulated S3 keys): **2**
- Tag list (user must triage in wizard's Tag List view): **1**
- Matcher API calls: **14** (authored sections only)
- Coverage review API calls: **9** of 96 possible (skipped 87 empty specs)

## Simulated import identity

- `submissionId`: `template-preview-4c994a97`
- `documentVersionId`: `docver-4df5bd69`
- S3 bucket: `cshse-filestorage-qlyj5pn` (Tigris). Files below use key pattern `{submissionId}/{documentVersionId}/{slug}.docx`. Files are NOT actually uploaded by this preview.

## Unwritten / placeholder template sections

These 13 template headings exist in the DOCX but have no authored response yet (empty body, `Not applicable`, or only a `See Appendix` pointer). On the next re-import, anything the institution writes under these headings will flow through the same walker → matcher → bucket pipeline.

| Para # | Hint | Heading |
|---|---|---|
| 123 | `3.-` | 3. Describe the Program (Do not duplicate information requested in the specifications for Standard 1) |
| 141 | `1.-` | 1. Advocacy, Relational Practice, and Social Work: Students in the Advocacy, Relational Practice, & Social Work concentr |
| 142 | `2.-` | 2. Nonprofit Leadership, Policy & Administration: Students who select the Nonprofit Leadership, Policy & Administration  |
| 178 | `4.-` | 4. Interim Report and Review and Reaccreditations only |
| 191 | `1.-` | 1. It was suggested that when listing student assessment tools in the accreditation document, it would be helpful to inc |
| 192 | `2.-` | 2. The second comment asked about the consequence if a student doesn’t meet professional fitness expectations? Students  |
| 225 | `12.b` | Standard 12b. Small Groups – 1. Overview of how small groups are used in human service settings; 2. Theories of group dy |
| 226 | `14.c` | Standard 14c. Uphold confidentiality and use appropriate means to share information; |
| 227 | `16.b` | Standard 16b. Assess and analyze the needs of clients or client groups through observation, interviewing, active listeni |
| 228 | `16.c` | Standard 16c. Develop knowledge and skill development in 1. Case Management: a. Intake Interviewing; b. Helping Skills;  |
| 229 | `17.b` | Standard 17b. Deal effectively with conflict; |
| 230 | `17.c` | Standard 17c. Establish rapport with clients; |
| 252 | `1.-` | 1. Describe the physical location and any unique characteristics. |

---

## Per-spec wizard output

Each spec block shows the four wizard destinations. A `🟢` icon means the coverage reviewer marked the spec adequately covered; `🟡` means partial coverage; `🔴` means major gaps (or no content authored yet).

## Standard 1

### `1.a` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _The program is part of a degree granting college or university that is regionally accredited._

**Coverage verdict:** covered=**False**, score=**0.45**
_Reviewer suggestion:_ The narrative must explicitly name KSU's regional accreditor (SACSCOC) and provide current regional accreditation documentation (letter or certificate) as direct evidence. Simply referencing BOR governance does not satisfy Specification 1.a's requirement for verified regional accreditation.

#### Narrative content
_Destination: `Submission.narratives[1][a].content`_

##### Narrative 1 — 🟡 conf 0.72, 321 words, `review_low_confidence`

_Source heading:_ **2a. Describe the organizational structure, whether state or private, age of institution, brief history, and so on.**

_AI rationale:_ The section establishes that KSU is a regionally accredited (USG-governed) degree-granting university, directly satisfying Standard 1.a's requirement that the program be part of such an institution. The institutional history and organizational structure also align with 1.d's request for a brief program history.

```text
KSU is governed by The Board of Regents (BOR) of the University System of Georgia (USG), the state governing and management authority for all 25 public colleges and universities in Georgia. These institutions include four research universities, four comprehensive universities, nine state universities, and eight state colleges. The BOR provides unified oversight of public higher education across the state, and its Chairman is appointed by the Governor of Georgia.

KSU’s history began in 1963 when the BOR chartered it as a two-year public junior college. The institution became a four-year senior college in 1976, awarded its first bachelor’s degree in 1980, and achieved university status in 1996. In January 2015, KSU merged with Southern Polytechnic State University (SPSU), then Georgia’s second-largest engineering university. By Fall 2025, KSU had become the third-largest public university in Georgia, enrolling more than 51,000 students. Today, the University comprises 11 degree-granting colleges across two major campuses—one in Kennesaw and one in Marietta—located approximately seven miles apart in northwest metropolitan Atlanta.

See Appendix I Required Introduction Material – #1 Map of Kennesaw Campus & #3 Map of Marietta Campus

KSU is ranked by multiple media outlets, including but not limited to the following:

U.S. News & World Report: KSU is ranked among the Top Public Universities and 20th nationally for National Universities Where Most Accepted Students Enroll (admissions yield rate). Included among National Universities in the 2026 Best Colleges rankings; recognized in Programs to Look For; ranked among the top 40 national universities for Best Undergraduate Teaching and among the top 55 for First-Year Experiences.

Forbes: KSU is listed among top public universities and best-value institutions.

The Princeton Review Best Colleges: KSU is included among the Best Colleges in the Southeast.

Military Times KSU in noted as Best for Vets: designated a military-
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][a].linkedDocuments`_

| # | File title | Slug | Words | Conf | S3 key (simulated) |
|---|---|---|---|---|---|
| 1 | 4a. Include a copy of the letter from the Vice President of  | `4a-include-a-copy-of-the-letter-from-the-vice-president-of-a` | 69 | 0.92 | `template-preview-4c994a97/docver-4df5bd69/4a-include-a-copy-of-the-letter-from-the-vice-president-of-a.docx` |
| 2 | B. Include a glossary of terms as they are used in the self- | `b-include-a-glossary-of-terms-as-they-are-used-in-the-self-s` | 2911 | 0.72 | `template-preview-4c994a97/docver-4df5bd69/b-include-a-glossary-of-terms-as-they-are-used-in-the-self-s.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ No direct evidence of KSU's regional accreditation status or accrediting body name (e.g., SACSCOC). The narrative mentions BOR governance but does not explicitly state which regional accreditor has accredited KSU.
- ⚠️ No current regional accreditation letter or certificate provided as supporting evidence. The only accreditation document provided is a CSHSE letter from 2022, not a regional accreditation credential.
- ⚠️ No reference to or documentation of the specific regional accrediting commission that accredits KSU or the University System of Georgia institutions.
- ⚠️ The narrative establishes KSU's history and size but does not address the core requirement: verification of regional accreditation status.

---

### `1.b` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials)._

**Coverage verdict:** covered=**False**, score=**0.35**
_Reviewer suggestion:_ Provide the promised Appendix I materials (catalog pages, course syllabi, website content, marketing materials, and program mission/goals statements) that directly demonstrate how program title, design, curriculum, teaching methods, and administration reflect the primary objective of developing comp

#### Narrative content
_Destination: `Submission.narratives[1][b].content`_

##### Narrative 1 — 🟢 conf 0.89, 917 words, `auto_accept`

_Source heading:_ **2b.  Describe the institutional context of the program. For example, organization charts and structure, goals and objectives. What levels of degree are offered by the institution? For large programs w**

_AI rationale:_ The section directly addresses institutional context, organizational structure, degree levels offered, and program goals/objectives—all core elements of Standard 1.b, which requires evidence that the program's design, goals, and administration reflect the primary objective of developing competent human services professionals.

```text
See Appendix I

Across its academic units, KSU offers and supports more than 90 undergraduate degrees and 75 graduate degrees. The Carnegie Classification designates KSU as a doctoral research institution (R2), placing it among the top six percent of colleges and universities in the United States (US) with an R1 or R2 research status. It is accredited by the Southern Association of Colleges and Schools Commission on Colleges (SACSCOC) to award associate, baccalaureate, master’s, specialist, and doctoral degrees.

President Kathy Schweig and the President’s Cabinet located in The Office of the President provide programmatic, operational, and fiscal oversight for KSU. The President’s Cabinet includes 13 university leaders responsible for major functional areas, including Student Affairs, Government Relations, Advancement, Administration, Research, Information Technology, Finance, External Affairs, Legal Affairs, Athletics, Academic Affairs and Enrollment Services, and Diverse and Inclusive Excellence.

KSU’s Academic Affairs Organizational Chart illustrates the structure of its Academic Affairs division, led by the Provost/Vice President for Academic Affairs. It depicts the leadership hierarchy, reporting relationships, and 11 major academic units, 9 of which are degree-granting.

Bagwell College of Education

College of Architecture and Construction Management

College of Computing and Software Engineering

Michael J. Coles College of Business

Norman J. Radow College of Humanities and Social Sciences

College of Science and Mathematics

Geer College of the Arts

Graduate College (does not confer degrees)

KSU Journey Honors College (does not confer degrees)

Southern Polytechnic College of Engineering & Engineering Technology

Wellstar College of Health and Human Services (WCHHS)

The KSU Bachelor of Science with a major in Human Services is offered in the Department of Social Work and Human Services (SWHS) within the Wellstar College of Health and Human Services.


… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 536 words, `review_low_confidence`

_Source heading:_ **3a. Briefly describe the strengths of the Program and any attributes and any attributes that make the Program unique**

_AI rationale:_ This section describes program strengths, unique attributes, and design elements (experiential education, internships, minors, certificates, concentration pathways) that demonstrate how the program's structure and objectives embody competent human services professional development—directly addressing Standard 1.b's requirement to show evidence that competent HS professionals is the primary objecti

```text
The KSU HS Degree Program is grounded in the Council for Standards in Human Service

Education (CSHSE) national standards. One way the HS program distinguishes itself is by

integrating CSHSE’s established competencies with KSU’s commitment to experiential education

and regional engagement.  It provides two distinct internships to build and master HS competencies. Additionally, the program offers courses with clear pre-requisites for advanced level courses. It also offers three minors and one certificate program.

The Child Advocacy Studies Minor The Child Advocacy Studies minor focuses on experiential, interdisciplinary, ethical, and culturally sensitive content that provides professionals with a common knowledge base for responding to child maltreatment. Its purpose is to prepare students to work effectively within the systems and institutions that respond to these incidents. Through the coursework, students examine interdisciplinary approaches to child maltreatment and develop a multidisciplinary perspective on the most effective interventions. Students who complete the program are equipped to support the work of agencies and systems, including health care, criminal justice, and social services, as they advocate for the needs of children who are victims and survivors of abuse.

The Behavioral Health Minor Students who complete the Behavioral Health minor gain essential knowledge about the foundations of mental health and substance misuse/addiction disorders. The program includes an exploration of treatment and intervention strategies, as well as the impact of cultural and socioeconomic factors on behavioral health. The knowledge gained in this program of study helps prepare students for future education and possible career opportunities in demand industries such as Registered Behavior Technicians, Case Managers, Board Certified Behavior Analysts, Substance Abuse Counselors, Behavior Technicians, Juvenile Probation Parole Specialists, Behavioral Counselors, and F
… (truncated, full text imported)
```

##### Narrative 3 — 🟡 conf 0.72, 518 words, `review_low_confidence`

_Source heading:_ **4d. Describe any major curriculum changes since the prior accreditation.**

_AI rationale:_ This section documents major curriculum changes and their alignment with program objectives and CSHSE standards, providing evidence that curriculum design reflects the program's primary objective of developing competent human services professionals (Standard 1.b). The explicit reference to HS Program Learning Outcomes based on CSHSE Standards 11–21 also supports curriculum mapping under Standard 1

```text
There were several curriculum changes in 2024 and again in 2026. The following changes have b and been approved and are currently are in the KSU 2026 catalogue:

KSU changed the required core courses for all students to the new IMPACTS core curriculum described above in 3b.

Currently, the HS Core Field of Study (9 credits) includes 3 courses, HS 2100 or HHS 2100, HS 2200, and HS 2300 instead of the earlier program requirements in the former Area F (General Studies).

Elective courses (9 credit) were added to the core field of study.

The program began offering 5 one-hour credit courses for students to accommodate their credit hour requirements if they had credits from other fields already fulfilling. The courses are HS 2410 Professional Writing for HS, HS 2420 Communication Skills for HS, HS 2430 Advocacy in Action, HS 2450 Prior Learning and Work Experience in HS.

In 2024, changes were made to HS 4900 Advanced Research Inquiry in Health and Human Services where the course was offered to other majors in the college for capstone designed for their respective disciplines. Human Services and students from other majors like Integrated Health Science could also take the course. Course content was also modified to enable students to complete either a research project, or a portfolio for employment-readiness, or a project that helped community agency with a problem.  This course is often taken by HS students while they are completing their final advanced internship (HS 4950).

In 2024, the human services curriculum was modified to accommodate not only the HS students, but other majors across the WCHHS. To enhance teaching efficiency, the course prefix was changed from HS to HHS and three modifications were made: HHS 2100 -Overview of Health and Human Services; HHS 3500 - Research Inquiry in Health and Human Services; and HHS 4800 - Ethical and Legal Approaches to Decision Making in Health and Human Services.

The HS curriculum added a third concentration, Related Studies
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided: narrative states 'See Appendix I' but no appendices, catalogs, brochures, syllabi, website content, or marketing materials are attached to verify claims
- ⚠️ Degree program title justification missing: no explicit statement that 'Human Services' title reflects primary objective of developing competent HS professionals
- ⚠️ Program goals not clearly articulated: narrative describes minors, certificates, and curriculum changes but does not explicitly state the primary program goal/mission focused on HS professional competence development
- ⚠️ Teaching methodology not addressed: no evidence that instructional approaches (e.g., experiential learning, internships) are intentionally designed to develop HS competencies
- ⚠️ Program design rationale incomplete: while internships and CSHSE alignment are mentioned, there is no explicit narrative connecting overall curriculum design to the primary objective of developing competent HS professionals
- ⚠️ Program administration connection unclear: no evidence showing how administrative structure (Director of HS Program, etc.) supports the primary objective
- ⚠️ Marketing materials absent: no brochures, website excerpts, or recruitment materials demonstrating that HS professional development is the marketed primary purpose

---

### `1.c` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Articulate how students are informed of the curricular and program expectations and requirements prior to admission._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[1][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[1][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `1.d` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Provide a brief history of the program._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[1][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[1][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `1.e` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[1][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[1][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `1.f` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices)._

**Coverage verdict:** covered=**False**, score=**0.45**
_Reviewer suggestion:_ The narrative addresses institutional general education requirements but does not substantively describe the Health Sciences program itself. Provide the actual HS program curriculum including required major courses, credit hour breakdown (general ed vs. major vs. electives), course sequences, and of

#### Narrative content
_Destination: `Submission.narratives[1][f].content`_

##### Narrative 1 — 🟡 conf 0.72, 418 words, `review_low_confidence`

_Source heading:_ **3b. Describe institutional course requirements for all students and explain how they prepare students for study in the human services program. For example, describe general education or liberal arts r**

_AI rationale:_ The section describes institutional degree requirements (120 credit hours), the general education curriculum structure (IMPACTS with seven areas, 42 required credits), grading policies, and program progression rules—all elements of a complete program description and curricular requirements. This directly aligns with Standard 1.f's request for 'complete program description, courses required, time t

```text
KSU confers a bachelor’s degree after the student completes a formal course of study consisting of at least 120 undergraduate semester credit hours.

Kennesaw State University’s General Education named IMPACTS is made up of required core courses that provide all KSU students with a broad academic foundation and introduce multiple ways of understanding the world. Together, these core courses cultivate essential skills, critical thinking, analytical reasoning, written communication, cultural awareness, and problem-solving, that directly support the more specialized learning students undertake in the HS major.

The IMPACTS core curriculum is organized across seven academic areas: 1) Institutional Priority; 2) Mathematics & Quantitative Skills; 3) Political Science & U.S. History; 4) Arts, Humanities & Ethics; 5) Communicating in Writing; 6) Technology, Mathematics & Science; and 7) Social Sciences. Each area is anchored by an orienting question, defined learning outcomes, and a set of career-ready competencies that guide course design and student learning. Each area contains a list of available courses that meet the criteria for learning in the area.

IMPACTS

A video that more fully explains the core IMPACTS curriculum is found at https://www.youtube.com/watch?v=Z6oUyVxeKOI

The Seven (7) Academic Areas

General Information About KSU Coreo IMPACTS Curriculum

The Core IMPACTS curriculum is required of each USG postsecondary school that offers a bachelor’s degree. Each comprises the same required 42 credit hours, ensuring consistency and transferability while allowing students flexibility in course selection aligned with their academic goals.

Courses taken in more than one area may only be applied once in a degree program and are not able to be counted twice for credit, including in the Field of Study or major requirement areas.

In accordance with the KSU Catalog Policy: Students must earn a grade of “D” or better in KSU’s General Education Core IMPACTS Curriculum an
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No specific Health Sciences major course requirements listed; narrative addresses only general education (IMPACTS), not major-specific courses
- ⚠️ No Health Sciences program course sequence or curriculum map provided
- ⚠️ No explicit statement of total credit hours required for HS major beyond the 120 minimum mentioned
- ⚠️ No time-to-completion estimate provided (e.g., 4 years, semester-by-semester progression)
- ⚠️ No reference to or inclusion of actual program catalog pages showing HS major requirements
- ⚠️ No elective course options within the HS major described
- ⚠️ No prerequisites for HS major courses specified
- ⚠️ No information on concentration options, specializations, or tracks if applicable to HS program
- ⚠️ Missing supporting evidence (catalog excerpts, program sheets, curriculum maps) entirely

---

## Standard 2

### `2.a` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Include a mission statement for the program._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[2][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[2][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `2.b` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Demonstrate alignment with the mission of the units in which the program is housed (e.g., department, college, university, etc.)_

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[2][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[2][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `2.c` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.)._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[2][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[2][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `2.d` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Describe the multidisciplinary, interdisciplinary, or transdisciplinary approach to knowledge, theories, and skills included in the curriculum._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[2][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[2][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `2.e` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Provide a matrix mapping the curriculum Standards (11-20) and Specifications to required courses. The information provided on the matrix must clearly reflect congruence with the information provided in the Self-Study narrative and the syllabi._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[2][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[2][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 3

### `3.a` 🔴 — Community Assessment

**Spec prompt:** _If the program is less than five years old, provide documentation that supported the initial development of the human services program (such as a community needs assessment)._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[3][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[3][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[3][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `3.b` 🔴 — Community Assessment

**Spec prompt:** _An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alums, current students, adjunct faculty, and other persons related to the field of human services. Provide the following: 1. A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.), 2. Minutes of advisory committee meetings from the last two years. 3. A narrative or table of how the committee interfaces with the program in relationship to specific issues._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[3][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[3][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[3][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `3.c` 🔴 — Community Assessment

**Spec prompt:** _Describe other mechanisms, if any, used to respond to changing needs in the human services field._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[3][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[3][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[3][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 4

### `4.a` 🔴 — Program Evaluation

**Spec prompt:** _The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change_

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[4][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[4][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[4][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `4.b` 🔴 — Program Evaluation

**Spec prompt:** _The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change._

**Coverage verdict:** covered=**False**, score=**0.05**
_Reviewer suggestion:_ This response is inadequate and does not address Specification 4.b. The program must submit comprehensive documentation including: a five-year evaluation history, formal evaluation reports with identified methodology, survey instruments and results (student, agency, graduate), advisory committee mee

#### Narrative content
_Destination: `Submission.narratives[4][b].content`_

##### Narrative 1 — 🟢 conf 0.85, 35 words, `auto_accept`

_Source heading:_ **4b. Describe how each condition in the VPA letter has been addressed.**

_AI rationale:_ The section directly addresses the VPA (Verification of Program Accreditation) letter and conditions/recommendations, which is the explicit subject of Standard 4.b's requirement to document formal program evaluation history, methodology, and resulting changes. The narrative acknowledges no formal conditions but notes reader suggestions, fitting the evaluation-response framework.

```text
The VPA letter did not specify any conditions that needed to be formerly ameliorated. However, the letter provided suggestions from two readers.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[4][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[4][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No history of program evaluations provided
- ⚠️ No description of evaluation methodology
- ⚠️ No summative analysis of most recent evaluation
- ⚠️ No evidence of student surveys
- ⚠️ No evidence of agency surveys
- ⚠️ No evidence of graduate follow-up surveys
- ⚠️ No documentation of advisory committee participation in evaluation
- ⚠️ No evidence of involvement from agencies with field placements
- ⚠️ No course evaluations presented
- ⚠️ No faculty evaluations presented
- ⚠️ No institutional mandated/conducted evaluative data included
- ⚠️ No description of how evaluation findings resulted in programmatic changes
- ⚠️ No supporting evidence documents attached
- ⚠️ Narrative references only VPA letter suggestions, not formal program evaluation

---

### `4.c` 🔴 — Program Evaluation

**Spec prompt:** _The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[4][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[4][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[4][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 5

### `5.a` 🔴 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of policies regarding the selection and admission of students._

**Coverage verdict:** covered=**False**, score=**0.00**
_Reviewer suggestion:_ The response is non-responsive to Specification 5.a. The program must either provide complete documentation of admission, retention, and dismissal policies with supporting evidence, or provide a detailed written justification explaining why this specification genuinely does not apply to this program

#### Narrative content
_Destination: `Submission.narratives[5][a].content`_

##### Narrative 1 — 🟡 conf 0.58, 47 words, `review_low_confidence`

_Source heading:_ **2. Describe the student population.**

_AI rationale:_ The section heading 'Describe the student population' most directly aligns with Standard 5.a (policies regarding selection and admission of students), which necessarily requires understanding and documentation of the student population being admitted. The content is marked 'Not applicable,' indicating no substantive response was provided.

```text
Not applicable

b. Furnish evidence of formal policies and procedures that assure continuity and quality control of Program and Curriculum across all sites.

Not applicable

c. Provide a narrative and documentation which assures compliance with all Standards and Specifications

Not applicable
```

#### Supporting evidence — text
_Destination: `Submission.narratives[5][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No documentation of admission policies provided
- ⚠️ No evidence of student selection criteria or procedures
- ⚠️ No formal policies regarding student retention documented
- ⚠️ No procedures for student dismissal provided
- ⚠️ No supporting evidence attached to substantiate any claims
- ⚠️ Narrative simply states 'Not applicable' without explanation of why this specification does not apply
- ⚠️ No clarification of whether the program has admissions processes or if they are handled entirely by institution

---

### `5.b` 🔴 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[5][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[5][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `5.c` 🔴 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of written policies and procedures describing the due process for probation, remediation, dismissal, appeal, and grievance procedures affecting students._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[5][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[5][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `5.d` 🔴 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals._

**Coverage verdict:** covered=**False**, score=**0.25**
_Reviewer suggestion:_ This response addresses only academic admission criteria, not the core requirement of fitness-for-profession assessment and management. Provide comprehensive policies and procedures documenting how the program evaluates, monitors, and addresses professional attributes (ethics, interpersonal skills, 

#### Narrative content
_Destination: `Submission.narratives[5][d].content`_

##### Narrative 1 — 🟡 conf 0.72, 289 words, `review_low_confidence`

_Source heading:_ **4c.  Describe any major program changes since prior to accreditation.**

_AI rationale:_ The section documents substantive changes to program admission policies and procedures—specifically gating removal and GPA/course requirements—which directly address Standard 5.d's requirement for documentation of program policies and procedures for admitting and retaining students.

```text
Two main changes have occurred in the HS program since the prior accreditation in 2022. Admission to the HS major is no longer gated, and some courses have been opened to other WCHHS majors.

Changed the Policy for Declaring the HS Major: Until 2024, admission to the HS program was separate from admissions to KSU. The HS program was gated, and students were forced to wait until their junior year to declare the HS major. At that time, to enter the major and pursue the degree, the student was required to have and maintain an institutional GPA of 2.0 or better and have completed the following courses with a "C" or greater: 1. ENGL 1101 or ENGL 1102 2. Any Area D1 Math course (i.e., STAT 1401, MATH 1160, MATH 1179, MATH 1190, or MATH 2202) 3. ECON 1000 4. PSYC 1101 OR ECON 2106 5. SOCI 1101 6. HS 2100 7. HS 2200 8. HS 2300 9. HS 2400.

Since 2024, the HS program has not been gated. Students can declare HS as a major when they enter KSU; they do not need to wait until junior year. Currently, program requirements for declaring a HS major are minimal: a) HS majors must have and maintain a minimum institutional GPA of 2.00, and they must successfully complete all HS major courses with a grade of “C” or higher.

Some HS Courses Opened to Other Majors in the Wellstar of HHS: Other majors such as Integrated Health Services (IHS), Public Health (PH) and Nursing are now allowed to take specific HS Courses. The prefixes for these courses were changed from HS (Human Services) to HHS (Health and Human Services).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[5][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No documentation of 'fitness for the profession' assessment criteria or tools (e.g., professional behaviors, ethical standards, interpersonal skills, mental health, substance abuse screening)
- ⚠️ No procedures for identifying, monitoring, or addressing concerning student attributes/behaviors during the program
- ⚠️ No retention policies or procedures for managing students who demonstrate unfitness for the profession
- ⚠️ No dismissal procedures or due process safeguards for students found unfit
- ⚠️ No supporting evidence documents provided (policies, procedures, forms, assessment tools, rubrics, case examples)
- ⚠️ Changes to admission gating described but lack of clarity on whether new admission criteria assess fitness for profession
- ⚠️ No mention of professional liability, criminal background checks, or other fitness-related screening at admission
- ⚠️ No procedures for remediation or support when fitness concerns are identified

---

## Standard 6

### `6.a` 🔴 — Credentials of Human Services Faculty

**Spec prompt:** _Include curriculum vitae of full-time and part-time faculty who teach human services courses. The vitae must demonstrate that: 1. Faculty have education in various disciplines and experience in human services or related fields 2. Teaching faculty have no less than one degree above the level of certificate or degree in which they teach. It is recommended that faculty have no less than a master’s degree._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[6][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[6][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[6][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 7

### `7.a` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Document that faculty have the ultimate responsibility for setting policies and determining the content, implementation, and evaluation of the curriculum._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[7][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[7][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[7][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `7.b` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Essential program roles include administration, curriculum development and review, instruction, field supervision, program planning, program evaluation, student advising, and student evaluation. Provide the following: 1. A brief description of how these essential roles are fulfilled in the program 2. A table matching faculty and staff positions and names with these roles._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[7][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[7][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[7][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `7.c` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Describe the process for faculty and staff evaluation. Documentation may come from a variety of sources and may include, among others, student evaluations, administrative review, comments from field placement agencies, and peer review._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[7][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[7][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[7][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `7.d` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Document how the evaluative process is used to identify strengths and limitations and how it is incorporated in specific procedures for improvement._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[7][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[7][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[7][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `7.e` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Describe how faculty and staff are provided opportunities for relevant professional development._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[7][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[7][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[7][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 8

### `8.a` 🔴 — Cultural Competence

**Spec prompt:** _Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff_

**Coverage verdict:** covered=**False**, score=**0.00**
_Reviewer suggestion:_ The program must provide comprehensive narrative and supporting documentation demonstrating how intercultural fluency and accessibility principles are embedded in policies/procedures/practices, and evidence of mandatory training for all faculty and staff. Currently, the specification is entirely una

#### Narrative content
_Destination: `Submission.narratives[8][a].content`_

##### Narrative 1 — 🟡 conf 0.72, 95 words, `review_low_confidence`

_Source heading:_ **6. Hybrid or Online Course Delivery: If more than 50% of required human service courses are offered in a hybrid/online format, the Program must:**

_AI rationale:_ This section addresses program delivery modality, instructional design, and support infrastructure for hybrid/online courses. Standard 8 (Instructional Delivery) most directly governs how programs design and deliver coursework, including alternative formats, learning outcome alignment across delivery methods, and technical/student support systems.

```text
a. Provide a narrative and documentation which assures compliance with all Standards and Specifications.

Not applicable

b. Document how they assure that students enrolled in the program or course(s) are who they say they are.

Not applicable

c. Demonstrate that common learning outcomes/objectives exist for both face-to-face and hybrid/online delivery.

Not applicable

d. Provide documentation that the program provides adequate technical training and support for students and faculty

Not applicable
```

#### Supporting evidence — text
_Destination: `Submission.narratives[8][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[8][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No narrative or evidence addressing intercultural fluency integration in program policies, procedures, and practices
- ⚠️ No narrative or evidence addressing accessibility principles integration in program policies, procedures, and practices
- ⚠️ No documentation of intercultural fluency training for faculty and staff
- ⚠️ No documentation of accessibility principles training for faculty and staff
- ⚠️ No supporting evidence of any kind provided
- ⚠️ Response incorrectly marks specification as 'Not applicable' without justification

---

### `8.b` 🔴 — Cultural Competence

**Spec prompt:** _Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[8][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[8][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[8][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 9

### `9.a` 🔴 — Program Support

**Spec prompt:** _Include budgetary information that demonstrates sufficient funding, faculty, and staff to provide an ongoing and stable program._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[9][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[9][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `9.b` 🔴 — Program Support

**Spec prompt:** _Describe how program and field experience coordination is considered in calculating the teaching loads of faculty. It is recommended that consideration be given to distance between sites, expectations of observation, documentation requirements, number of students enrolled in the field experience, and the characteristics of the student population._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[9][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[9][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `9.c` 🔴 — Program Support

**Spec prompt:** _Describe how the program has adequate professional support staff to meet the needs of students, faculty, and administration._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[9][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[9][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `9.d` 🔴 — Program Support

**Spec prompt:** _Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[9][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[9][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `9.e` 🔴 — Program Support

**Spec prompt:** _Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration._

**Coverage verdict:** covered=**False**, score=**0.15**
_Reviewer suggestion:_ The narrative provides only a basic location statement and lacks substantive description of any spaces or evidence of how they support program needs. Rewrite to describe each space type (offices, classrooms, meeting rooms, gathering areas), their features, and how they meet user needs, supported by 

#### Narrative content
_Destination: `Submission.narratives[9][e].content`_

##### Narrative 1 — 🟡 conf 0.51, 52 words, `review_low_confidence`

_Source heading:_ **5.  If the Program is delivered at multiple sites:**

_AI rationale:_ The section describes the physical location and layout of program spaces (departmental administration, faculty, support staff, and classrooms across campus buildings), which directly addresses how office, classroom, meeting, and informal gathering spaces are organized and distributed to meet program needs under Standard 9.e.

```text
The program is delivered at one site. The HS departmental administration, faculty, support staff, and some classrooms are in Prillaman Hall on the KSU Campus in Kennesaw, while some classrooms are in nearby buildings on the same campus.

a.  For each site:
```

#### Supporting evidence — text
_Destination: `Submission.narratives[9][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No description of office spaces (size, functionality, adequacy for faculty/admin work)
- ⚠️ No description of classroom spaces (capacity, technology, accessibility, condition)
- ⚠️ No description of meeting spaces (dedicated rooms, availability, suitability for various meeting types)
- ⚠️ No description of informal gathering spaces (lounges, break rooms, student collaboration areas)
- ⚠️ No explanation of how any spaces meet the needs of students, faculty, or administration
- ⚠️ No supporting evidence provided (photos, floor plans, capacity lists, accessibility documentation, etc.)
- ⚠️ No discussion of adequacy or sufficiency of current spaces
- ⚠️ No mention of accessibility features or accommodations
- ⚠️ No clarification of which specific classrooms are in which buildings or how many spaces exist

---

## Standard 10

### `10.a` 🔴 — Evaluation of Transfer Credits and Prior Learning

**Spec prompt:** _Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[10][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[10][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[10][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `10.b` 🔴 — Evaluation of Transfer Credits and Prior Learning

**Spec prompt:** _Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE_

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[10][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[10][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[10][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 11

### `11.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The historical roots of human services as a discipline and a profession._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[11][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[11][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `11.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Historical and current legislation impacting human service delivery._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[11][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[11][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `11.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _How public and private attitudes influence legislation and the interpretation of policies related to human services._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[11][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[11][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `11.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[11][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[11][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 12

### `12.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Theories of human development._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `12.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `12.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Changing family structures and roles._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `12.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An introduction to the organizational structures of communities._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `12.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of the capacities, limitations, and resiliency of human systems._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `12.f` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Emphasis on context and the role of intercultural fluency, including cultural group membership and individual identities in determining and meeting human needs._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][f].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `12.g` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][g].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][g].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][g].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `12.h` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[12][h].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[12][h].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][h].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 13

### `13.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The range and characteristics of human service delivery systems and organizations._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[13][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[13][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `13.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The range of populations served, and needs addressed by human services professionals._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[13][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[13][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `13.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[13][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[13][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `13.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of systemic causes of poverty and its implications._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[13][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[13][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `13.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of national and global social policies and their influence on human service delivery._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[13][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[13][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `13.f` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing. 4. Discipline Inquiry and Information Literacy Context: The delivery of human services depends on the appropriate integration of various forms of information._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[13][f].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[13][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 14

### `14.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Obtain, synthesize, and report information from various sources._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[14][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[14][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `14.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Assess the quality of information from various sources, including but not limited to print, audio, video, web, and social media, and understand its application._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[14][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[14][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `14.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Upholding confidentiality and using appropriate means to share information._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[14][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[14][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `14.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Using technology, including artificial intelligence, to locate, evaluate, and disseminate information. 5. Program Planning and Evaluation Context: A significant component of the human services profession involves assessing the needs of clients and client groups, and planning programs and interventions to assist them in promoting optimal functioning, growth, and goal attainment. At regular intervals, the outcomes must be evaluated, and necessary adjustments made to the plan, both at an individual client and program level._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[14][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[14][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 15

### `15.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Knowledge and skills to analyze and assess the needs of clients or client groups._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[15][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[15][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[15][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `15.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Skills to develop goals, design and implement a plan of action._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[15][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[15][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[15][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `15.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Skills to evaluate the outcomes of the plan and the impact on the client or client group. 6. Client Interventions and Strategies Context: Human service professionals function as change agents and must therefore attain and develop a core of knowledge, theory, and skills to provide direct services and interventions to clients and client groups._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[15][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[15][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[15][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 16

### `16.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Intake interviewing_

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[16][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[16][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[16][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `16.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Helping skills:_

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[16][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[16][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[16][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `16.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Identification and use of appropriate resources and referrals. 2. Group facilitation 3. Use of consultation 7. Interpersonal Communication Context: The ability to create genuine and empathic relationships with others is central to the human services profession. These skills are applicable to all levels of education, and a greater proficiency is expected at each progressively higher level._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[16][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[16][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[16][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 17

### `17.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Clarifying expectations._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[17][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[17][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `17.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Dealing effectively with conflict._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[17][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[17][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `17.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Establishing rapport with clients._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[17][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[17][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `17.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Developing and sustaining behaviors that are congruent with the values and ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at https://www.nationalhumanservices.org/ethical-standards-for- hsprofessionals). 8. Administrative Context: A holistic approach to human services recognizes direct and indirect services as components of the same system. Administrative support (indirect service) is essential to the effective delivery of direct services to clients or client groups._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[17][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[17][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 18

### `18.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Principles of leadership and management._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[18][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[18][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `18.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Human resources and volunteer management._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[18][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[18][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `18.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Grant writing, fundraising, and other funding sources._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[18][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[18][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `18.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Legal, ethical, and regulatory issues, and risk management._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[18][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[18][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `18.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Budget and financial management. 9. Client-Related Values and Attitudes Context: There are values and ethics intrinsic to the human services profession that have been agreed to as governing principles of professional practice._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[18][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[18][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 19

### `19.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The least intrusive intervention in the least restrictive environment._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `19.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Client self-determination._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `19.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Confidentiality of information._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `19.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The worth and uniqueness of individuals based on intercultural fluency, including how they identify and the cultural groups to which they belong._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `19.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Belief that individuals, service systems, and society can change._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `19.f` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Interdisciplinary team approaches to problem solving._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][f].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `19.g` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Appropriate professional boundaries._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][g].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][g].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][g].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `19.h` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at 10. Self-Development Context: Human services professionals use their experience and knowledge to understand and help clients. This requires awareness of one’s values, cultural bias, philosophies, personality, and style in the effective use of the professional self. It also requires an understanding of how these personal characteristics affect clients._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[19][h].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[19][h].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][h].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 20

### `20.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Conscious use of self._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[20][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[20][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `20.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Clarification of personal and professional values._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[20][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[20][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `20.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Awareness of intercultural fluency as outlined in Standard 19.d._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[20][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[20][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `20.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Strategies for self-care._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[20][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[20][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `20.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency)._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[20][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[20][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

## Standard 21

### `21.a` 🔴 — Field Experience

**Spec prompt:** _Provide a brief description of the overall process and structure of the fieldwork learning experience._

**Coverage verdict:** covered=**False**, score=**0.45**
_Reviewer suggestion:_ Provide a clear, sequential description of the baccalaureate fieldwork structure (timing, prerequisites, progression, supervision, assessment) with supporting evidence such as curriculum maps, field experience policies, and evaluation rubrics. Separate graduate pathway information from undergraduate

#### Narrative content
_Destination: `Submission.narratives[21][a].content`_

##### Narrative 1 — 🟡 conf 0.68, 237 words, `review_low_confidence`

_Source heading:_ **3. Related Studies in Human Services: Students in the Related Studies in HS concentration focus on integrating an approved set of courses (i.e., a minor, certificate, micro-credential) complementary t**

_AI rationale:_ The section describes two internship experiences (Foundation and Advanced) with specified hour requirements and competency demonstrations, which directly aligns with Standard 21 (Field Experience) requirements for field placement structure and scope. The mention of NOHS ethics compliance and community agency partnerships supports the field experience framework.

```text
The Double Owl Pathways HS students can earn both undergraduate and graduate credentials simultaneously through an accelerated pathway. This option streamlines academic progress, reduces overall costs, and prepares students for advanced roles in healthcare and human services. The following double-degree pathways are available:

Human Services B.S. / Business Administration (MBA)

Human Services B.S. / Criminal Justice M.S

Human Services B.S. / Public Administration (MPA)

Human Services B.S. / Social Work (MSW)

Unique Internship Opportunities: The HS curriculum includes two internship experiences (Foundation and Advanced), and course sequencing that facilitates the horizontal and vertical integration of human services values, knowledge, and skills throughout the program.  In the foundation internship (120 hours), students demonstrate beginning level CSHSE competencies and in advance internship (300 hours), they demonstrate advanced level competencies.

Extensive Community Agency Partnerships: The HS program continues to develop and foster partnerships with over 100 community human service agencies in the Metropolitan Atlanta and Northwest GA areas. Majors can apply concepts learned in the classroom to real world experiences within the agency settings through internships, service-learning, or by engaging in research. Through these learning experiences, students gain a working knowledge of and comply with the National Organization of Human Services (NOHS) code of ethics.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No description of the overall PROCESS or STRUCTURE of fieldwork—when/how students progress through field experiences
- ⚠️ No information on duration, timing, or sequencing within the curriculum (e.g., when Foundation vs. Advanced internships occur)
- ⚠️ No detail on supervision model, oversight, or faculty involvement in field placements
- ⚠️ No description of how learning outcomes are assessed or evaluated during fieldwork
- ⚠️ No mention of field experience eligibility requirements or prerequisites
- ⚠️ No explanation of how field placements are secured, matched, or coordinated with agencies
- ⚠️ No supporting evidence provided (syllabi, policies, placement procedures, assessment tools, etc.)
- ⚠️ Narrative conflates Double Degree Pathways (graduate credentials) with field experience requirements—unclear which apply to baccalaureate students only

---

### `21.b` 🔴 — Field Experience

**Spec prompt:** _Provide evidence that one academic credit is awarded for no less than three hours of field experience per week._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][b].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.c` 🔴 — Field Experience

**Spec prompt:** _Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.d` 🔴 — Field Experience

**Spec prompt:** _Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.e` 🔴 — Field Experience

**Spec prompt:** _Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.f` 🔴 — Field Experience

**Spec prompt:** _Provide syllabi for required seminars. Seminars must meet at least every two weeks. Seminar hours must not be included in field experience hours._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][f].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.g` 🔴 — Field Experience

**Spec prompt:** _Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][g].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][g].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][g].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.h` 🔴 — Field Experience

**Spec prompt:** _Demonstrate how the field experience provides the student with an opportunity to progress from: 1. Observation to 2. Directly supervised client contacts to 3. Indirectly supervised client contacts to 4. An independent caseload OR assignment of administrative responsibility._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][h].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][h].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][h].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.i` 🔴 — Field Experience

**Spec prompt:** _Demonstrate that field supervisors have a degree at least as high as the one awarded by the program. It is strongly recommended that field supervisors hold at least one degree level above the degree in Human Services or a related field._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][i].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][i].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][i].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

### `21.j` 🔴 — Field Experience

**Spec prompt:** _Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology. The technology used should ensure that both the field placement supervisor and the student can be identified._

**Coverage verdict:** covered=**False**, score=**0.00** _(synthesized — no content authored)_

#### Narrative content
_Destination: `Submission.narratives[21][j].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[21][j].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][j].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No content authored yet — institution must write a response under this Specification.

---

---

## Tag list — items needing human triage

These 1 items did not auto-apply. They become rows in the wizard's **Tag List** view; the coordinator clicks each one to see full text, AI reasoning, and dropdowns to assign std/spec/kind and apply or discard. (See [[import-wizard-ui-spec-2026-05-17#4-the-tag-list-what-happens-to-questionable-items]].)

| Tag ID | Suggested | Conf | Source heading | Excerpt |
|---|---|---|---|---|
| `tag-c6cafe54` | `17.d` | 0.72 | Standard 17d. Develop and sustain behaviors that are congruent with the values a | Concentration titles and made changes to pathways and electives  Updated Concentration titles and made changes to pathways and electives  Up… |

---

## How this differs from the Stevenson preview

- **Input shape:** spec-as-outline (template) vs. free-form self-study. Stevenson required a TOC anchor walker + deep table walker + appendix walker; the template just needs paragraph walking with heading detection.
- **Section count:** template format produces tens of sections (here: 27) vs. Stevenson's 568. Most are direct spec-prompt responses, so matcher confidence tends to be higher.
- **No appendix gap-fill:** template documents don't carry an appendix until late drafts, so the gap-fill pass is skipped here. Once an appendix is added, the Stevenson-style preview applies.
- **Re-import friendly:** since the template format is designed for repeated imports as more sections get filled, the **placeholder section table** above is the key signal for the institution: those are the prompts still waiting for a response.

## Related
- [[import-wizard-ui-spec-2026-05-17]] — the UI spec these rules came from
- [[ai-import-wizard-preview-stevenson-2026-05-18]] — sibling preview on Stevenson's free-form self-study
- [[legacy-self-study-import]] — pre-AI manual flow this replaces