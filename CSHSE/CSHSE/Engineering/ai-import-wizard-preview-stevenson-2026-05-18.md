---
name: AI Import Wizard — Stevenson End-to-End Preview 2026-05-18
description: For every Baccalaureate spec, the exact narratives, supporting-evidence text snippets, file uploads, matrix detections, tag-list entries, and remaining gaps that the wizard would produce on Stevenson — i.e. the wizard's full output before the user clicks Apply.
type: review
tags: [ai-import, sprint-1, stevenson, wizard-preview, audit]
audit_date: 2026-05-18
auditor: claude
last_reviewed: 2026-05-18
---

# AI Import Wizard — Stevenson End-to-End Preview (2026-05-18)

This page is the **complete output the AI Import Wizard would produce on Stevenson** if a Program Coordinator ran the import today. For every (std, spec) we show the artifacts that would land in each destination, plus tags, unmatched sections, and gaps that remain after the appendix gap-filling pass.

Pipeline that produced this:

1. Section classifier (deep walker + matcher) — 568 sections, cached
2. Appendix walker — split appendix into supporting-evidence items
3. First-pass coverage review (Haiku, per spec)
4. **Appendix gap-fill** — embed appendix into per-import Qdrant collection, search for snippets that address each shortcoming, verify with Haiku, augment evidence
5. Second-pass coverage review on augmented evidence
6. Auto-apply rules from [[import-wizard-ui-spec-2026-05-17]]

## Top-level summary

- Specs in Handbook (Baccalaureate): **96**
- Specs with at least one wizard write: **84**
- Specs with narrative content: **81**
- Specs with supporting-evidence text: **27**
- Specs with supporting-evidence files: **11**
- Total evidence files (with simulated S3 keys): **14**
- Tag list (user must triage in wizard's Tag List view): **47**
- Sections skipped as `context`: **178**
- Sections sent to `unknown` bucket: **6**
- Appendix items indexed for gap-fill: **890**
- Initial gaps flagged by coverage reviewer: **653**
- Gaps filled from appendix (verified by Haiku): **2**
- Appendix candidates rejected by Haiku verifier: **3798**
- Gaps still remaining after gap-fill: **638**

## Simulated import identity

- `submissionId`: `6986239a6612bf17f04a3217`
- `documentVersionId`: `docver-cb9174cf`
- S3 bucket: `cshse-filestorage-qlyj5pn` (Tigris). Files below use key pattern `{submissionId}/{documentVersionId}/{slug}.docx`. Files are NOT actually uploaded by this preview; the wizard creates them on Step-5 Apply.

---

## Per-spec wizard output

Each spec block shows the four wizard destinations and the gap-fill delta. A `🟢` icon means the second-pass coverage reviewer marked the spec adequately covered; `🟡` means partial; `🔴` means gaps remain.

## Standard 1

### `1.a` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _The program is part of a degree granting college or university that is regionally accredited._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[1][a].content`_

##### Narrative 1 — 🟡 conf 0.82, 246 words, `review_letter_disagrees`

_Source heading:_ **d.Provide a brief history of the program.Table of ContentsResponse: The Family Studies Program was d**

_AI rationale:_ This narrative provides the program's historical development, founding, accreditation milestones, and organizational evolution—directly addressing Standard 1.a's requirement for a statement of the program's philosophy, goals, and objectives grounded in the program's context and history.

```text
d. Provide a brief history of the program. Table of Contents Response: The Family Studies Program was developed by Dr. Gigi Franyo in 1999 and began accepting students in Fall 2000. Dr. Franyo was the program coordinator and only full-time faculty member until 2004. The name of the program was changed to Family and Community Services in Spring 2003. Beginning in Fall 2004, the program acquired one additional full-time faculty member, Dr. Tom Swisher, to teach courses and serve as the field placement coordinator. The program was awarded accreditation from CSHSE in October of 2004. It expanded to three full-time faculty members in 2005, when Ms. Lauri Weiner joined the faculty. The name of the program was changed to Human Services in 2007 and in 2009 the Human Services Program was reaccredited by CSHSE. In 2012, the Program became a Department when Dr. John Rosicky was hired as Department Chair. In the fall of 2014, Dr. Mayaugust Finkenberg joined the full-time faculty when Dr. Franyo began phased retirement. In 2018, the department and program name was changed to Counseling &amp; Human Services in order to be more easily recognizable and help with recruiting. In December of 2022, Tom Swisher retired from the department; this resulted in the “department” designation being changed to “program”. Department offices moved from the Manning Academic Center (MAC) on the Owings Mills North campus to the new PAZ library building in January of 2024; all CHS classes are still offered in MAC.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided that the institution is regionally accredited
- ⚠️ No documentation of the parent institution's regional accreditation status (e.g., SACSCOC, MSCHE, WASC, etc.)
- ⚠️ No identification of the college/university name or its accrediting body
- ⚠️ Narrative describes program history but does not address the institutional requirement
- ⚠️ No supporting documents such as institutional accreditation certificates, letters, or official statements

---

### `1.b` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials)._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[1][b].content`_

##### Narrative 1 — 🟢 conf 0.95, 259 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses the specification language requiring evidence that development of competent human services professionals is the primary objective and basis for degree program title, design, goals, curriculum, and administration. The response cites program purpose, objectives, catalog, brochure, website, and syllabi as mandated evidence.

```text
Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials).Response: The Counseling & Human Services Program is designed for students who want to provide human services for people in need. The major prepares students for careers in human services and also for graduate school.  The courses provide students with a comprehensive understanding of how individuals and families develop and function.  Students also acquire the skills necessary to provide services to individuals and families.  The Counseling & Human Services Program goals are designed to prepare students for productive and meaningful work in the human services field. Graduates are expected to “apply key concepts, methods and values in human services to professional situations,” as stated in the program purpose and objectives. The program objectives are focused on preparing our majors for productive and meaningful experiences in the human services field. Graduates are expected to apply meaningful connections between classroom learning and experience in the field, demonstrate a professional attitude with sensitivity to diversity, display appropriate interpersonal skills and professional behavior, and exhibit their own continuing self-development (See Program Goals).The program’s focus on developing competent human service professionals is reflected in all departmental materials, including the Stevenson Catalog (See the Counseling & Human Services Program under Fields of Study), departmental brochure, and the department website. See also course descriptions and syllabi for all CHS courses.
```

##### Narrative 2 — 🟡 conf 0.78, 77 words, `review_letter_disagrees`

_Source heading:_ **A. Institutional Requirements and Primary Program Objective**

_AI rationale:_ The section articulates the program's primary objective to prepare human services professionals for direct and indirect service delivery, directly addressing 1.b's requirement to evidence that competent human services professional development is the primary objective and basis for program design, goals, and curriculum.

```text
Context: There is strong national commitment to the view that human services programs should develop professionals who provide direct or indirect services. These programs prepare human services professionals for a variety of functions related to the care and treatment of individuals, families, groups, and communities.

Standard 1: The primary program objective shall be to prepare human services professionals to serve individuals, families, groups, communities and/or other supported human services organization functions.Table of Contents

Specifications for Standard 1
```

##### Narrative 3 — 🟡 conf 0.72, 79 words, `review_low_confidence`

_Source heading:_ **The Counseling & Human Services program is designed to give students a comprehensive understanding of how individuals an**

_AI rationale:_ This section articulates the program's design philosophy and core objectives—that students gain comprehensive understanding of human development and functioning plus service-delivery skills through coursework and field work. This directly demonstrates how the program's design, goals, and curriculum are based on developing competent human services professionals as the primary objective, matching St

```text
The Counseling & Human Services program is designed to give students a comprehensive understanding of how individuals and families develop and function.  Students also acquire the skills necessary to provide services to individuals and families.  Therefore, the coursework, in addition to courses that fulfill the University’s requirements, is composed of (1) courses that emphasize the development and functioning of individuals and families, (2) courses that focus on the skills required to help individuals and families, and (3) field work.
```

##### Narrative 4 — 🟡 conf 0.72, 93 words, `review_low_confidence`

_Source heading:_ **The curriculum is designed to give students a comprehensive understanding of how individuals and families develop and fu**

_AI rationale:_ This section describes the overall curriculum design and composition (development/functioning courses, skills courses, and field work) as the foundational structure supporting the program's primary objective of developing competent human services professionals, directly addressing 1.b's requirement to demonstrate the program design basis.

```text
The curriculum is designed to give students a comprehensive understanding of how individuals and families develop and function.  Students also acquire the skills necessary to provide services to individuals and families.  Therefore, the coursework, in addition to courses that fulfill the University’s requirements, is composed of (1) courses that emphasize the development and functioning of individuals and families, (2) courses that focus on the skills required to help individuals and families, and (3) field work.  A table that outlines the courses in these areas of concentration can be found on the following page.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents attached (catalog pages, brochures, website screenshots, syllabi) despite repeated references to them
- ⚠️ Degree program title not explicitly analyzed or justified as reflecting human services professional development mission
- ⚠️ Program design rationale not explained—why these three curriculum components (development/functioning, helping skills, field work) specifically prepare competent HS professionals
- ⚠️ Teaching methodology not addressed—no description of how instructional approaches support competency development
- ⚠️ Program administration practices not discussed—no evidence of how administrative decisions prioritize HS professional competency
- ⚠️ Marketing materials and website content referenced but not provided
- ⚠️ Course syllabi mentioned but not included as evidence
- ⚠️ No explicit connection made between program objectives and CSHSE's definition of human services professional competencies
- ⚠️ Graduate outcomes/assessment data not provided to demonstrate competency development is actually achieved

---

### `1.c` 🟡 — Institutional Requirements and Primary

**Spec prompt:** _Articulate how students are informed of the curricular and program expectations and requirements prior to admission._

**Final coverage verdict:** covered=**False**, score=**0.65**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.65, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[1][c].content`_

##### Narrative 1 — 🟢 conf 0.94, 311 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses Standard 1.c by describing multiple methods through which prospective and current students are informed of curricular and program expectations and requirements prior to admission (Open Houses, website, faculty meetings, student handbook, orientation, etc.).

```text
Articulate how students are informed of the curricular and program expectations and requirements prior to admission.Table of ContentsResponse: Prospective students and their parents or guardians may attend one of five “Open Houses” offered by Stevenson University. During each Open House, faculty and current students from the Counseling & Human Services Department provide a classroom session in which the program structure, goals and expectations are reviewed, with opportunities for questions and discussion. In addition, the Department Chair meets every year with the university recruiters in the Admissions Office to provide them with updated information about the Counseling & Human Services Program so they can speak knowledgably about it to potential students.  Current students who are not Counseling & Human Service majors, as well as prospective students, can access information about the program in numerous ways, including the program website, individual interviews with faculty, information displayed near the program office, and at numerous activities and functions offered throughout the year by the Human Services Club. Many non-majors also take CHS 101 Family Studies or CHS 105 Human Services and Social Policy to meet the social science requirement and are thereby introduced to the field of human services. All students who enter the major, either by transferring from another major or another school, or by starting at Stevenson, are informed of all aspects of the curricular and program requirements and expectations in the following ways: Transfer students meet individually with the Department Chair, who explains all program requirements, provides a student handbook, and creates an individualized plan of study. New college students participate in a group orientation before they enter the program where they receive a student handbook and get help with establishing a plan of study and registering for classes. They also participate in the 1-credit course FYS 100 First Ye
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.52, 54 words, `review_low_confidence`

_Source heading:_ **Students are expected to participate in all classes and to arrive promptly. Whenever a student is absent, it is the stud**

_AI rationale:_ This section describes attendance and participation expectations that students must be informed of prior to or upon admission. While attendance policies could relate to student retention procedures (5.c), the content most directly addresses how students are informed of program expectations and requirements (1.c).

```text
Students are expected to participate in all classes and to arrive promptly. Whenever a student is absent, it is the student’s responsibility to obtain lecture notes and handouts for that class session. While a student is not required to attend all classes, a student cannot actively participate unless s/he is present for most classes
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][c].supportingEvidenceText`_

##### Evidence text 1 — conf 0.52, 77 words, `review_low_confidence`

_Source heading:_ **Classroom Policies: Regular class attendance and participation are necessary to pass and/or do well in this and indeed a**

```text
Classroom Policies: Regular class attendance and participation are necessary to pass and/or do well in this and indeed all courses.  Students are encouraged to be punctual and regular to class as class discussions are likely to draw on materials not covered by the assigned readings. If class is canceled due to the weather or other unforeseen reason, the lesson will be posted on Blackboard.  It is the student’s responsibility to check Blackboard and complete any posted assignments!
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence that prospective students (pre-admission) receive written curricular requirements—narrative mentions Open Houses and website but doesn't document what specific program expectations/requirements materials are available to prospects before they apply
- ⚠️ No mention of how program requirements are communicated via admissions materials (viewbooks, website screenshots, recruitment brochures)—only that recruiters are briefed annually
- ⚠️ Supporting evidence (Classroom Policies) addresses post-admission classroom expectations, not pre-admission program/curricular expectations
- ⚠️ No documentation of what 'program website' contains regarding curricular structure, course sequences, prerequisites, or degree requirements
- ⚠️ Lacks evidence that all prospective students (not just Open House attendees) systematically receive curricular expectations—Open House attendance is voluntary and optional
- ⚠️ No evidence of written program overview, curriculum map, or degree requirements document shared with prospects prior to admission

---

### `1.d` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Provide a brief history of the program._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative response provided to address the specification
- ⚠️ No supporting evidence submitted to document program history
- ⚠️ Missing foundational information: when the program was established
- ⚠️ Missing program evolution details: how the program has developed over time
- ⚠️ Missing contextual information: institutional context for program creation
- ⚠️ Missing milestone information: significant program changes, expansions, or curriculum revisions
- ⚠️ Missing documentation of program development trajectory

---

### `1.e` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.00, delta=-0.65)_

#### Narrative content
_Destination: `Submission.narratives[1][e].content`_

##### Narrative 1 — 🟡 conf 0.82, 68 words, `review_low_confidence`

_Source heading:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spr**

_AI rationale:_ The section reports current enrollment numbers (78 majors, 20 minors) matching Standard 1.e's requirement to 'describe the student population including the number' of students. The mention of recruitment and marketing efforts is secondary context.

```text
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spring we have a total of 78 majors and 20 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Counseling & Human Services program through marketing and publicity efforts. The name change and move to the OM campus should be helpful in that regard.
```

##### Narrative 2 — 🟢 conf 0.89, 84 words, `auto_accept`

_Source heading:_ **Twenty four students graduated in the 2018-2019 academic year. This is slightly lower than the previous year, but repres**

_AI rationale:_ The section directly reports the number of students graduating in 2018-2019 and enrollment trends, which directly matches Standard 1.e's requirement to describe student population including numbers graduating each year. While graduation rates are also relevant to program evaluation (4.c), the primary focus is on institutional demographic reporting.

```text
Twenty four students graduated in the 2018-2019 academic year. This is slightly lower than the previous year, but represents a stabilization in the decline of graduates, which is similar to the pattern for the number of majors. (see report below). The official number of majors for the Fall of 2019 will be reported on the census date of October 15.  A new cohort of certificate students at Sheppard Pratt will be starting this fall, but the exact number is not know at this time.
```

##### Narrative 3 — 🟢 conf 0.98, 136 words, `auto_accept`

_Source heading:_ **e.Describe the student population including the number, gender, and diversity of students, as well a**

_AI rationale:_ The section directly addresses Standard 1.e, providing enrollment numbers, gender distribution, age, ethnic/racial diversity, full-time/part-time status, and graduation data—matching the specification language precisely.

```text
e. Describe the student population including the number, gender, and diversity of students, as well as the numbers of full time, part time, and students graduating each year. Response: Fall 2023 enrollment figures show 56 Counseling &amp; Human Services majors. The vast majority are full-time students (96%). Majors are predominantly female (87%) with an average age of 22. They are from a wide variety of backgrounds, including the city of Baltimore and surrounding suburbs and rural areas. Most students are from the Mid-Atlantic region. The major is ethnically diverse (49% white; 45% black; 4% Hispanic; 2% Asian/other). The number of graduates has been fairly consistent with 24 in the 2018/2019 academic year and 20 in the 2022/2023 academic year. See attached table of enrollment and graduation trends and demographic information and pictures of recent graduating classes.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][e].supportingEvidenceText`_

##### Evidence text 1 — conf 0.78, 114 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Number of Graduates:
2013-14
2014-15
2015-16
2016-17
2017-18
2018-19
# Graduates
46
35
56
35
28
24
Admissions Report
Fall 2014
Fall 2015
Fall 2016
Fall 2017
Fall 2018
Fall 2019
Number of Applicants
47
69
58
41
34
30
Number Accepted
27
24
29
20
24
21
Number Attending
6
6
8
5
8
6
Transfer Students
11
8
8
6
3
11
Number of Majors:
Fall 2014
Fall 2015
Fall 2016
Fall 2017
Fall 2018
Fall 2019
Human Services
141
138
100
86
82
78
Fulltime:Parttime
136:5
133:5
98:2
83:3
78:4
75;2
Human Services Certificate
24
20
15
15
13
xx
Number of Minors:
# Minors
9
10
12
20
16
16
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][e].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | Survey questions 2015 Results* — Survey questions 2015 Resul | `survey-questions-2015-results-survey-questions-2015-results-` | 523 | 0.75 | 🧩 gap-fill | `6986239a6612bf17f04a3217/docver-cb9174cf/survey-questions-2015-results-survey-questions-2015-results-.docx` |

_File 1 fills gap_: Gender breakdown is provided only for Fall 2023 (87% female); no historical gender data across years shown

```text
2015 Results*

Primary enrollment status at Stevenson: Traditional Student (Day) 100%  (8) Accelerated/online student (GPS) 0 Did you transfer to Stevenson from another college? No 88% Yes, from a Maryland community college 12% Yes, from a Maryland four-year college or university 0 Yes, from an out-of-state college or university 0 What was the highest degree you received from Stevenson University? Bachelor’s Degree 100% Master’s Degree 0 Are you currently employed? Yes, full-time 75% Yes, part-time 25% No, seeking employment 0 No not seeking employment 0 Select your current occupation from the list below: Educator (teacher, professor) 0 Engineer or Architect (engineering technician) 0 Financial (accountant, broker, financial analyst) 12% Health Professional 25% Information Systems (programmer/analyst, computer/software    engineer, electronic technician) 0 Legal Professional or Law Enforcement 0 Manager, Executive, Proprietor 0 Sales or Marketing (retail, real estate) 12% Scientist (physical, research, statistician, analyst) 0 Skilled trades (clerical, laborer, service occupation) 0 Social Worker 25% Other Professional 25% Where is your current place of employment Maryland 75% District of Columbia 0 Northern Virginia (suburbs of DC) 0 Neighboring state (DE, NJ, PA, WV, elsewhere in VA) 12% Other state or country (specifically: Delaware) 13% What is your annual salary in your current job? Less than $20,000 12% $20,000 to $29,999 38% $30,000 to $39,999 50% $40,000 to $49,999 0 
… (truncated, full DOCX preserves full body)
```

#### Gaps still remaining (user must address manually after import)
- ⚠️ coverage reviewer API error: BadRequestError

---

### `1.f` 🔴 — Institutional Requirements and Primary

**Spec prompt:** _Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices)._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.00, delta=-0.65)_

#### Narrative content
_Destination: `Submission.narratives[1][f].content`_

##### Narrative 1 — 🟢 conf 0.98, 261 words, `auto_accept`

_Source heading:_ **f.Provide a complete program description, courses required, time to completion, and other program de**

_AI rationale:_ The section directly provides complete program description, required courses, time to completion (8 semesters), credit requirements (120 credits), and graduation rates—exactly matching the language of Standard 1.f specification.

```text
f. Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices). Table of Contents Response: The Counseling &amp; Human Services bachelor’s degree is 120 credits and is typically completed in eight semesters. A complete program description and curriculum display are in the catalog and Appendix . Required courses in the Counseling &amp; Human Services include the following: CHS 101 Family Studies CHS 105 Human Services and Social Policy CHS 220 Diversity and Cultural Competence CHS 224 Research Methods and Writing CHS 315/515 Group Counseling CHS 340/540 Administration of Human Services CHS 360 Counseling Strategies for Individuals CHS 380 Internship in Counseling &amp; Human Services CHS 430 Family Dynamics and Interventions CHS 440 Practicum in Counseling &amp; Human Services CHS 441 Seminar in Counseling &amp; Human Services In addition, student must complete the following secondary requirements: SOC 101 Introduction to Sociology PSY 101 Introduction to Psychology PSY 108 Human Growth &amp; Development Two CHS Electives The University requires students to meet the general education requirements described in the Introductory Section ( A.3.b ), which includes courses in writing/literature, communication, fine arts, mathematics (statistics), science, and humanities. The program is designed to be completed in 8 semesters (4 years). More than half of students complete in 4 years (57%) with 5- and 6-year graduation rates of 84% and 895 respectively. A list of CHS elective courses and a schedule of course offerings for Human Services Electives is attached, along with a listing of courses commonly taken to meet the general education requirements .
```

##### Narrative 2 — 🟡 conf 0.82, 2234 words, `review_letter_disagrees`

_Source heading:_ **A. ­­­Required Introductory Material: General Introduction to the Program1.Specify the degree(s) off**

_AI rationale:_ The section provides a complete program description including institutional context, organizational structure, degree levels offered, campus locations, and program characteristics (field experience requirement of 450+ hours), directly corresponding to Standard 1.f's requirement for complete program description and details. It also supports 1.b by articulating the program's primary emphasis on fiel

```text
A. ­­­Required Introductory Material: General Introduction to the Program 1. Specify the degree(s) offered for which accreditation is being sought. Bachelor’s Degree 2. Describe the institution. Table of Contents Describe the organizational structure, whether state or private, age of institution, brief history, and so on. Response: Stevenson University is a private, independent, coeducational, liberal arts university with approximately 4,000 undergraduate and graduate students. The university was formerly known as Villa Julie College, which was founded in 1947 as a two-year preparatory school for women. Villa Julie became co-educational in 1972 and a four-year college in 1984. In 2004 the first residential facilities were opened on the Owings Mills campus and in 2008 the college changed its name to Stevenson University. Stevenson is located in Baltimore County, Maryland. Stevenson was initially established on the Greenspring campus but purchased the Owings Mills campus in 2002, and all recent development has happened in that area. All human services courses are offered on the Owings Mills campus, where the department moved in 2018. The Owings Mills campus houses all residential facilities and most athletic and student activity facilities. The Owings Mills North area was created by the purchase and renovation of the former Shire Pharmaceuticals site and houses the graphic design and art facilities, as well as the Manning Academic Center. A new library was constructed on the North Campus and opened in 2024. Offices for the Counseling &amp; Human Services program are in this building. CHS classes are taught in the MAC. A new theatre is also under construction on the North Campus. The Greenspring campus no longer has any undergraduate academic programs, although the PsyD program and administrative offices are still located there. Describe the institutional context of the Program. For example, include organization charts and structure, goals, and objectives. What levels 
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[1][f].supportingEvidenceText`_

##### Evidence text 1 — conf 0.88, 90 words, `auto_accept`

_Source heading:_ **(data table)**

```text
Articulated Courses - AACC
Articulated Courses - SU
ART 101, FLM 120, MUS 100, THA 111***
Fine Arts Elective (ART, FLM, MUS, THEA)
ENG 207***
ENG 210 Business Writing or ENG 212 Science Writing
ENG 209, ENG 211, HIS 111, HIS 211, PHL 100, PHL 111***
Humanities Electives (3)
LGS 160 Domestic Relations
LAW 259 Children and Family Law
MAT 131, PHS 100, PHS 119***
Math(above 140) or Science Elective
PSY 211 Developmental Psychology
PSY 108 Human Growth and Development
SOC 211 Marriage and the Family
CHS 101 Family Studies
```

##### Evidence text 2 — conf 0.72, 72 words, `review_low_confidence`

_Source heading:_ **Course Description:  Assists first-year students identify and use specific strategies for academic, personal, and social**

```text
Course Description:  Assists first-year students identify and use specific strategies for academic, personal, and social success in college. The First-Year Seminar also serves as a tool to introduce students to the Career Architecture process that will guide them through their time at Stevenson University.  Additional topics discussed in first-year seminar include, but are not limited to, University regulations and procedures, clarifying values and decision-making processes, and exploring the principles of career development.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[1][f].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 424 | 0.88 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |
| 2 | Community College Degree Requirements Stevenson Equivalency  | `community-college-degree-requirements-stevenson-equivalency-` | 269 | 0.92 | 🧩 gap-fill | `6986239a6612bf17f04a3217/docver-cb9174cf/community-college-degree-requirements-stevenson-equivalency-.docx` |

_File 2 fills gap_: No explicit statement of total credit hours for general education requirements or breakdown by category

```text
HEED 125 Ethics in Professional Practice Focused Elective Program Requirement 3 HUMS 110 Introduction to Human Services CHS 201 Human Services and Social Policy Program Requirement and GE Social Science 3 HUMS 122 Individual Counseling Techniques CHS 260 Counseling Strategies for Individuals Program Requirement 3 HUMS 123 Group Counseling Skills Meets CHS 315 Group Counseling Program Requirement 3 HUMS 124 Family Counseling CHS 101 Family Studies Program Requirement 3 HUMS 150 Community Resources and Partnerships Focused Elective Program Requirement 3 HUMS 250 Community Services Practicum Meets CHS 380 Internship Program Requirement 3 Elective: SU recommends HUMS 120 Medical Aspects of Chemical Dependency CHS 270 Psychopharmacology and Addictions Program Requirement 3 Elective (all options available will meet a focused elective requirement) Depends on course selected Program Requirement (Focused Elective) 3 PSYC 101 General Psychology PSY 101 Intro. to Psychology Program Requirement 3 PSYC 200 Lifespan Development PSY 108 Human Growth and Development Program Requirement 3 PSYC 203 Abnormal Psychology PSY 215 Psychopathology Program Requirement (Focused Elective) 3 ENGL 121 College Composition ENG 151 English Composition Program Requirement and GE 3 BIOL 101 General Biology I BIO 113 General Biology I GE lab science 4 Arts and Humanities Core Group A GE Humanities 3 Arts and Humanities Core Group B GE Humanities 3 Science Gen Ed Core GE math/science 3 Mathematics Gen Ed Core, 
… (truncated, full DOCX preserves full body)
```

#### Gaps still remaining (user must address manually after import)
- ⚠️ coverage reviewer API error: BadRequestError

---

## Standard 2

### `2.a` 🟢 — Philosophical Base of Programs

**Spec prompt:** _Include a mission statement for the program._

**Final coverage verdict:** covered=**True**, score=**0.92**
_(first-pass: covered=True, score=0.92; second-pass after gap-fill: covered=True, score=0.92, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[2][a].content`_

##### Narrative 1 — 🟢 conf 0.92, 623 words, `auto_accept`

_Source heading:_ **Specifications for Standard 2 Provide a succinct philosophical statement that becomes the conceptual**

_AI rationale:_ The section directly provides the program's conceptual framework (ASK model), mission statement, and demonstrates alignment with institutional mission—all core requirements of Standard 2.a. The alignment content also supports institutional requirements under Standard 1.b but is secondary to the primary philosophical and mission framing.

```text
Specifications for Standard 2 Provide a succinct philosophical statement that becomes the conceptual framework for the curriculum. Table of Contents Response: The Counseling &amp; Human Services Department follows the ASK conceptual model as described by Schram and Mandell in An Introduction to Human Services (2000). This model emphasizes the importance of the following three components to becoming an effective human services professional: Attitudes , including self-awareness and such personal attributes as empathy, warmth and genuineness; Skills , including case management, ethical decision-making, counseling strategies, and group leadership; and Knowledge of topics such as human development, psychopathology, group and family dynamics, diversity of lifestyles, legal issues that affect helping, the impact of society and culture on behavior, and the evaluation of research. Include a mission statement for the program. Table of Contents Response : The mission of the Counseling &amp; Human Services Program is to provide students with an educational foundation that will prepare them for meaningful and effective careers within the human services field and successful continuation of their education. Purpose The Counseling &amp; Human Services Department prepares students to become effective professionals in the helping disciplines. The program focuses on skill development, problem solving, and the application of research and best practice principles. Students learn to help others and to prepare thoughtfully and systematically for their careers. To meet these commitments, the Counseling &amp; Human Services Department offers its students a broad curriculum, learning experiences and professional activities beyond the classroom, and high levels of student-faculty interaction and collaboration. Demonstrate alignment with the mission of the units in which the program is housed (e.g., department, college, university, etc.). Table of Contents Response: The Counseling &amp; Human 
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[2][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (e.g., program handbook excerpt, website screenshot, official mission statement document) to verify the stated mission
- ⚠️ Mission statement is somewhat lengthy and could be more succinct; CSHSE typically expects concise mission statements
- ⚠️ No explicit statement addressing how the program mission aligns with CSHSE standards or baccalaureate-level expectations in human services

---

### `2.b` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Demonstrate alignment with the mission of the units in which the program is housed (e.g., department, college, university, etc.)_

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative statement articulating the program's philosophical base or educational approach
- ⚠️ No evidence of alignment between program mission/philosophy and departmental mission
- ⚠️ No evidence of alignment between program mission/philosophy and college-level mission
- ⚠️ No evidence of alignment between program mission/philosophy and university-level mission
- ⚠️ No documentation of how program goals/outcomes reflect unit missions
- ⚠️ No demonstration of intentional integration of unit values into program curriculum or delivery
- ⚠️ No evidence of stakeholder involvement in establishing philosophical alignment
- ⚠️ No examples of program decisions or practices rooted in unit mission alignment

---

### `2.c` 🟡 — Philosophical Base of Programs

**Spec prompt:** _Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.)._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[2][c].content`_

##### Narrative 1 — 🟡 conf 0.68, 131 words, `review_low_confidence`

_Source heading:_ **Major Family Therapy ApproachesObject Relations. (Framo and Scharff).Experiential. (Satir and Whitaker).Transgenerationa**

_AI rationale:_ This section enumerates major family therapy approaches and their theoretical foundations (Object Relations, Experiential, Transgenerational, Structural, Strategic, Cognitive-Behavioral, Social Constructionist, Narrative), directly describing the major knowledge base and theories that inform the program's conceptual framework per Standard 2.c.

```text
Major Family Therapy ApproachesObject Relations. (Framo and Scharff).Experiential. (Satir and Whitaker).Transgenerational. (Bowen).Structural. (Minuchin).Strategic. (Haley).Cognitive-Behavioral. (Beck and Ellis).Social Constructionist. (deShazer and Anderson).Narrative. (Michael White).1. Object Relations. (Framo and Scharff).Satisfying relationship with some “object” (e.g., parent) is a fundamental need. Helps client gain insight into early relationships (objects from past) and how they affect current relationships enabling individual development and fulfilling relationships.2. Experiential. (Satir and Whitaker).Troubled families need a “growth experience” derived from an intimate interpersonal experience (therapy). By being real (authentic) and self-disclosing, families learn to be more honest, more expressive, and better able to achieve personal and interpersonal growth. For Satir, building self-esteem and learning to communicate openly are essential goals. Whitaker suggested that helping family members probe their own world of symbolic meanings frees them to activate innate growth processes.
```

##### Narrative 2 — 🟢 conf 0.89, 187 words, `auto_accept`

_Source heading:_ **Provide a brief description of the major knowledge base and theories from which the curriculum draws**

_AI rationale:_ The section directly addresses the major knowledge base and theories (biopsychosocial, theoretical orientations, eclectic approach) matching Standard 2.c language. The multidisciplinary approach content also responds to 2.d but is secondary to the primary knowledge/theory focus.

```text
Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.). Table of Contents Response: The Counseling &amp; Human Services program emphasizes the interdisciplinary, biopsychosocial approach to helping. Throughout the program, students are introduced to various theoretical orientations, such as psychoanalysis, behavioral and cognitive-behavioral approaches to treatment, and client-centered therapies, but the emphasis is on an eclectic orientation that stresses the importance of flexibility to adapt helping responses to individual needs and circumstances. Describe the multidisciplinary, interdisciplinary, or transdisciplinary approach to knowledge, theories, and skills included in the curriculum. Table of Contents Response: The Counseling &amp; Human Services program utilizes a multidisciplinary approach to knowledge, theories and skills that includes liberal arts courses, human services skills courses, and field experiences. The general education core curriculum for the University includes an emphasis on writing, literature, communication, mathematics and scientific reasoning, computer and information literacy, and the arts and humanities. The Counseling &amp; Human Services major incorporates courses in psychology, sociology, psychopharmacology, research methods and statistics. (See program curriculum )
```

#### Supporting evidence — text
_Destination: `Submission.narratives[2][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No explicit connection between listed theories and the program's stated biopsychosocial conceptual framework
- ⚠️ Missing explanation of how the eclectic orientation is theoretically justified or operationalized in curriculum
- ⚠️ No description of systems theory application, despite implicit relevance to family therapy content
- ⚠️ Change theory is not addressed despite being explicitly mentioned in the Specification prompt as an example
- ⚠️ Supporting evidence section is empty; no syllabus excerpts, course descriptions, or curriculum mapping provided
- ⚠️ Disconnect between the two narrative sections: family therapy theories listed first are not integrated into the overall program philosophy description
- ⚠️ No clarity on how multidisciplinary courses (psychology, sociology, psychopharmacology) connect to the theoretical knowledge base
- ⚠️ Missing explanation of how liberal arts and general education core support or relate to the counseling-specific theoretical frameworks

---

### `2.d` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Describe the multidisciplinary, interdisciplinary, or transdisciplinary approach to knowledge, theories, and skills included in the curriculum._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative description of multidisciplinary approach to knowledge
- ⚠️ No narrative description of interdisciplinary approach to knowledge
- ⚠️ No narrative description of transdisciplinary approach to knowledge
- ⚠️ No explanation of how theories are integrated across disciplines
- ⚠️ No explanation of how skills are integrated across disciplines
- ⚠️ No supporting evidence documents provided (curriculum maps, course syllabi, program descriptions, etc.)
- ⚠️ No examples of how multiple disciplines are represented in coursework
- ⚠️ No demonstration of how students engage with knowledge from multiple fields

---

### `2.e` 🔴 — Philosophical Base of Programs

**Spec prompt:** _Provide a matrix mapping the curriculum Standards (11-20) and Specifications to required courses. The information provided on the matrix must clearly reflect congruence with the information provided in the Self-Study narrative and the syllabi._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[2][e].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[2][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[2][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Curriculum matrix cells
_Destination: `CurriculumMatrix.cells[]`_

- matrix: `(table)`, col -1, code `(see matrix extractor)`, types [], depth `—`
- matrix: `(curriculum matrix table)`, col -1, code `(see matrix extractor)`, types [], depth `—`
- matrix: `(curriculum matrix table)`, col -1, code `(see matrix extractor)`, types [], depth `—`

#### Gaps still remaining (user must address manually after import)
- ⚠️ No narrative provided explaining the philosophical base of the program
- ⚠️ No curriculum matrix mapping Standards 11-20 to required courses
- ⚠️ No matrix mapping Specifications to required courses
- ⚠️ No syllabi provided to verify congruence between matrix and course documentation
- ⚠️ No evidence of how program philosophy aligns with curriculum design
- ⚠️ No demonstration of how Standards 11-20 are addressed across the curriculum
- ⚠️ No evidence of intentional curriculum structure or sequencing based on philosophical framework

---

## Standard 3

### `3.a` 🔴 — Community Assessment

**Spec prompt:** _If the program is less than five years old, provide documentation that supported the initial development of the human services program (such as a community needs assessment)._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative explanation provided regarding program age or whether the less-than-five-years threshold applies
- ⚠️ No documentation of community needs assessment submitted
- ⚠️ No evidence of initial program development rationale or supporting research
- ⚠️ No community stakeholder input or data presented
- ⚠️ No documentation of how community needs informed curriculum or program design
- ⚠️ Absence of any supporting materials (surveys, focus group reports, demographic data, letters of support, etc.)

---

### `3.b` 🔴 — Community Assessment

**Spec prompt:** _An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alums, current students, adjunct faculty, and other persons related to the field of human services. Provide the following: 1. A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.), 2. Minutes of advisory committee meetings from the last two years. 3. A narrative or table of how the committee interfaces with the program in relationship to specific issues._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[3][b].content`_

##### Narrative 1 — 🟢 conf 0.92, 533 words, `review_letter_disagrees`

_Source heading:_ **C. Community Assessment**

_AI rationale:_ The section directly addresses Standard 3.b requirements: it provides detailed Advisory Committee membership description, meeting minutes from the past two years, and a narrative of how the committee interfaces with the program on specific issues (recruitment, curriculum, graduate programs, internship requirements). It also incorporates 3.c mechanisms (field supervisor feedback, student feedback, 

```text
Context: Human services programs continually interact with and affect human services delivery within the local community through field placements and alumnae/i. Programs should be designed to interface with the needs of major employers in terms of job needs and career ladders so there is an orderly and continuous supply of competent professionals.

Standard 3: The program shall include periodic mechanisms for assessment of and response to changing policies, needs, and trends of the profession and community.

Specifications for Standard 3:

If the program is less than five years old, provide documentation that supported the initial development of the human services program (such as a community needs assessment).Table of ContentsResponse: Program is more than 5 years old.

An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alumnae/i, current students, adjunct faculty, and other persons related to the field of human services. Provide the following:A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.),Response: There are currently 14 external members of the Advisory Board, in addition to the 3 full-time faculty members in the department. The external members represent field placement agencies, employing agencies, graduate programs, community college human services program, adjunct faculty, and alumni. Note that the member from CCBC is also deeply involved in addiction credentialing in the state of Maryland and provides expertise in the area of addiction counseling, as well as teaching our addiction-related courses. See attached roster of Advisory Board members.Minutes of advisory committee meetings from the last two 
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.82, 256 words, `review_low_confidence`

_Source heading:_ **Program Modifications: In response to student feedback and a departmental faculty retreat in December, we are proposing **

_AI rationale:_ The section explicitly documents how the Advisory Committee (named members Arthur Hill, Lisa Boone, Candice Edwards) provided feedback on curriculum design and program modifications in response to field trends and employer needs. This directly addresses Standard 3.b's requirement for documentation of Advisory Committee interface with the program on specific issues.

```text
Program Modifications: In response to student feedback and a departmental faculty retreat in December, we are proposing several program modifications and board input was solicited. In addition to reducing the practicum hours, we have changed the name of the addictions course to Psychopharmacology and Addictions and will be requiring it of all majors. The name of CHS 315 has been changed to Group Counseling (from Group Processes and Practices). We polled our current students on which topics classes they would be most interested in taking. The results are attached and were reviewed in the meeting. We discussed potential topics and advisory board members shared a number of helpful ideas. Related to the low interest expressed by students in classes on aging, Lisa Boone indicated that at CCBC a certificate in Elder Care runs because it is offered online and attracts a number of returning students who are currently working. A course in Crisis Intervention, including anger de-escalation, conflict resolution, mediation skills, and burnout issues, was strongly endorsed, with Arthur Hill noting that Kennedy Krieger has employees take Crisis Prevention and Intervention (CPI) training. Candice Edwards suggested that a course related to immigrants, homeless and diverse populations, including at least 5 hours of out-of-class experience, would be useful for students. Some of this is currently covered in the required CHS 220 Diversity and Cultural Competence. The growing importance of Applied Behavioral Analysis and the BCBA certification in the field was stressed. This material is included in current counseling courses, but could be developed into a separate course.
```

##### Narrative 3 — 🟡 conf 0.68, 59 words, `review_low_confidence`

_Source heading:_ **Members of the Committee shall be full-time faculty members and shall be appointed by their respective schools.  Members**

_AI rationale:_ This section describes the composition, appointment process, and staggered membership structure of what appears to be an Advisory Committee, which directly addresses Standard 3.b's requirement to establish and describe an Advisory Committee's detailed membership and governance. The staggered appointment and full-time faculty requirement reflect governance structures for the advisory body.

```text
Members of the Committee shall be full-time faculty members and shall be appointed by their respective schools.  Members must serve at least two years on the committee, and no school shall elect two new members in the same year.  The appointment cycles must be staggered so that only one new member from a school joins in the same year.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[3][b].supportingEvidenceText`_

##### Evidence text 1 — conf 0.89, 241 words, `auto_accept`

_Source heading:_ **(data table)**

```text
Name/Title
Address
Phone
E-Mail Address
Ari Blum
Director, Health Programs
Inst. for Innovation & Implementation
University of Maryland School of Social Work
525 W. Redwood Street
Baltimore, MD 21201
(410) 705-7506
ablum@ssw.umaryland.edu
Lisa Boone
Coordinator, Human Services
Community College of Baltimore County
800 South Rolling Road
Baltimore, MD  21228-5317
(443) 840-4379
lboone@ccbcmd.edu
Bunny Ebling
(alum)
Eldercare Consultant, Private Practice
(443) 465-6177 (c)
helaina.ebling@gmail.com
Candice Edwards
(alum)
Assistant Director
Maryland Dept. of Human Services
Bureau of Policy and Legislation
(410) 916-0868
candice.edwards1@maryland.gov
Loretta Elizalde
, LCPC
Clinical Therapist (private practice)
17 Warren Rd., Suite 3A
Pikesville, MD 21208
(410) 241-6006 (c)
lecs.elizalde@yahoo.com
Tom Flis
Behavioral Services Manager
Sheppard Pratt Health System
6501 N. Charles Street
Towson, MD  21285-6815
(410) 938-4852
tflis@sheppardpratt.org
Meghan Graves
Program Director
Mountain Manor – Recovery Support Services
443-683-0069
meghangraves@marylandtreatment.org
Human Services Club Officer
Nicole Rogers,
President
nrogers@stevenson.edu
Arthur Hill
Assistant Vice President of  Public School Partnerships
Kennedy Krieger Institute
3825 Greenspring Ave.
Baltimore, MD 21211
443-923-7781
hill@kennedykrieger.org
Lauren Minnich
Director of Recruitment & Training
Target Community & Educ. Services
111 Stoner Ave.
Westminster, MD 21157
(410) 848-9090 x26
lminnich@targetcommunity.org
Erika
… (truncated, full text imported)
```

##### Evidence text 2 — conf 0.92, 211 words, `auto_accept`

_Source heading:_ **All members for the advisory board described current events at their places of employment. Lisa Boone gave an update on **

```text
All members for the advisory board described current events at their places of employment. Lisa Boone gave an update on community college transfer issues and the status of a 4 year degree option, which is on hold for now. Recruitment efforts and conversion rates seem to benefit from personal touches. Arthur Hill reported that Kennedy Krieger has a new CEO and is seeking interns for their programs. Sheppard Pratt has a new administration and is offering diverse internship experiences, coordinated by new board member Tom Flis. He advocated for a focus on BCBA certification, since there is a great need. St. Elizabeth School is expanding its teaching space into the laundry building, which is being renovated. Debbie Boyce will be leaving the advisory board, but was thanked for her years of dedicated commitment to the Human Services program at SU. She brought Erika Rue to the meeting, who will be replacing her on the advisory board. Candice Edwards described governmental issues and reported that changes at the federal level have led to noticeable decreases in funding for TANF and other social welfare programs, as well as an increase in restrictions. There has been a crackdown on child support for non-custodial parents in the state and an increase in eligibility for daycare.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[3][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ LLM returned non-JSON response

---

### `3.c` 🔴 — Community Assessment

**Spec prompt:** _Describe other mechanisms, if any, used to respond to changing needs in the human services field._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[3][c].content`_

##### Narrative 1 — 🟡 conf 0.52, 72 words, `review_low_confidence`

_Source heading:_ **2. Collect new data. Each team member is responsible for a conducting field work activity. The field work should be part**

_AI rationale:_ The section describes data collection methods (field work, surveys, interviews) as part of a Community Needs Assessment Action Plan, which aligns with Standard 3.c on mechanisms to respond to changing needs. However, the procedural focus on field work structure and data collection instruments also relates to Standard 21.a on fieldwork process description.

```text
2. Collect new data. Each team member is responsible for a conducting field work activity. The field work should be part of the Community Needs Assessment Action Plan. Examples of field work can include an additional field experience with targeted questions or phone interviews of several service providers, a survey or interview of community members or other stakeholders. Create the data collection instrument (the survey or interview questions) and collect the data.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[3][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[3][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided to support the narrative claims about field work activities or data collection
- ⚠️ No description of HOW data collected is actually used to respond to changing field needs
- ⚠️ No documentation of what 'changing needs' were identified or how the program modified curriculum/operations in response
- ⚠️ No timeline or frequency specified for when these assessments occur
- ⚠️ No examples of actual mechanisms implemented based on assessment findings
- ⚠️ No demonstration that this process is systematic and ongoing, not ad hoc
- ⚠️ No evidence of stakeholder involvement in interpreting or acting on findings

---

## Standard 4

### `4.a` 🔴 — Program Evaluation

**Spec prompt:** _The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change_

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[4][a].content`_

##### Narrative 1 — 🟡 conf 0.68, 78 words, `review_low_confidence`

_Source heading:_ **All students either met or exceeded expectations for each of the six goals rated on the Student Field Placement Evaluati**

_AI rationale:_ The section reports results from a field placement evaluation survey showing that students met/exceeded learning expectations, which directly documents an assessment tool and its findings. This aligns best with Standard 4.a's requirement to provide examples of assessment tools and demonstrate that an assessment plan has been implemented.

```text
All students either met or exceeded expectations for each of the six goals rated on the Student Field Placement Evaluation /survey.  The field instructors’ comments were positive and supportive.  Students were commended for their professionalism, dedication, enthusiasm and persistence. Many students demonstrated openness to feedback and constructive criticism and a willingness to learn. In general students exhibited a high degree of caring for the people they were working with and their efforts were appreciated by clients and staff.
```

##### Narrative 2 — 🟢 conf 0.87, 184 words, `auto_accept`

_Source heading:_ **These data indicate that all students in their senior practicum were rated by their supervisors as meeting or exceeding **

_AI rationale:_ The section presents concrete assessment data from field practicum supervisor ratings against learning outcomes, demonstrating implementation of an assessment plan and provision of assessment tool results (supervisor evaluations). The discussion of curricular change (professional writing course added) in response to performance data also aligns with 4.a's requirement to describe how evaluation res

```text
These data indicate that all students in their senior practicum were rated by their supervisors as meeting or exceeding expectations on all of the learning outcomes. Nine of the supervisors gave the student they rated all “exceeds” ratings. In general, about twice as many students were given “exceeds” ratings as “meets”, but there was some variation on individual items. Items II.C., III.B. and III.D. were meant to be yes/no ratings, so the “exceeds” option was crossed out, but raters did not consistently use the “meets” option on these items; those who did respond used the “meets” option, so those items were 100% “meets”. Items III.H. on speaking and writing professionally and VI.A. on applying key concepts were close to 50/50 “meets”/”exceeds”, indicating that students did slightly less well on these skills. A professional writing course was added to the curriculum as a required course in 2014. Still, their performance was strong with no students being rated as below expectations. One student was given a “Below” expectations rating on punctuality, but still met expectations on Goal III. One student was identified as struggling with punctuality.
```

##### Narrative 3 — 🟢 conf 0.92, 50 words, `auto_accept`

_Source heading:_ **The average scores on each outcome are listed below. On all measures, half or more artifacts were rated as adequate. An **

_AI rationale:_ The section reports aggregate assessment results (outcome scores, adequacy ratings, artifact evaluation) directly aligned with Standard 4.a's requirement to describe assessment implementation and outcomes. The data showing adequacy and excellence ratings across artifacts demonstrates the evaluation plan's results.

```text
The average scores on each outcome are listed below. On all measures, half or more artifacts were rated as adequate. An addition 30-40% were rated as excellent. Three artifacts were rated as inadequate by at least one rater (one for professional development goals and two for professional attitudes and behaviors).
```

##### Narrative 4 — 🟡 conf 0.68, 52 words, `review_low_confidence`

_Source heading:_ **The demonstration of professional attitudes and behaviors (Objective #3) was rated based on professionalism of writing a**

_AI rationale:_ The section reports assessment results and rubric ratings of student artifacts against a learning objective, directly addressing Standard 4.a's requirement to describe assessment tools (rubrics) and evaluation results. The content demonstrates implementation of an assessment plan with evaluation data.

```text
The demonstration of professional attitudes and behaviors (Objective #3) was rated based on professionalism of writing and presentation. Two artifacts were judged to be inadequate by at least one of the raters. While 80% or artifacts were rated as adequate or excellent, there was less consistency on this objective then on others.
```

##### Narrative 5 — 🟡 conf 0.72, 70 words, `review_low_confidence`

_Source heading:_ **Evaluation is a very important phase of the learning process. The student and field instructor should each complete the **

_AI rationale:_ The section describes the evaluation tool and rating scale (Below/Meets/Exceeds Expectations) used to assess student learning outcomes at midpoint and end of semester, which directly addresses Standard 4.a's requirement for assessment tools and measurable evaluation criteria. While it touches on the evaluation process itself, the emphasis on the assessment instrument and rating methodology aligns 

```text
Evaluation is a very important phase of the learning process. The student and field instructor should each complete the same copy of the evaluation tool at midpoint and at the end of the semester.  Criteria for achievement of the program goals and objectives are expressed as Below Expectations, Meets Expectations, and Exceeds Expectations. If an objective or category within an objective does not apply, please rate it N.A. (Not Applicable).
```

##### Narrative 6 — 🟡 conf 0.52, 76 words, `review_low_confidence`

_Source heading:_ **Grading Standard: Grades are determined based on total number of points, not percentages so there is no rounding up. All**

_AI rationale:_ This section describes grading and assessment tool mechanics (rubrics, participation evaluation, peer review) that support the program's assessment plan and student learning outcome measurement processes outlined in Standard 4.a. While it is procedural rather than outcome-focused, it documents assessment methodology and tools.

```text
Grading Standard: Grades are determined based on total number of points, not percentages so there is no rounding up. All assignment grades are posted in Blackboard. Participation grades are determined at the end of the semester including feedback obtained through student completion of a participation rubric. Group presentations are evaluated by classmates, as well as the instructor. Extra credit points earned are added in at the end of the semester and are not posted in Blackboard.
```

##### Narrative 7 — 🟡 conf 0.72, 102 words, `review_low_confidence`

_Source heading:_ **Each student will write a critical review paper of an assigned reading.  The student will use the title of the article a**

_AI rationale:_ This section describes a specific assignment (critical review paper) with a rubric and point value that functions as an assessment tool demonstrating student learning outcomes and evaluation methodology. It directly supports Standard 4.a's requirement to provide examples of assessment tools (rubrics, portfolios, etc.) and describe how assignments evaluate student competency.

```text
Each student will write a critical review paper of an assigned reading.  The student will use the title of the article as title for this paper. This paper will summarize the article, highlighting the key points, issues raised, or conclusions arrived at by the author(s), and how the research for the paper was done. It should be written from the perspective of the student, focusing on methodological and analytic issues.  Students will offer a critique of the material and conclude with their own thoughts. (See Rubric for Critical Review Paper).    This assignment is worth 100 points, the same as a test grade.
```

##### Narrative 8 — 🟡 conf 0.72, 81 words, `review_low_confidence`

_Source heading:_ **Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research proces**

_AI rationale:_ This section describes a graded research proposal presentation assignment as a student learning assessment tool. It functions as an example of an assessment instrument (aligned with 4.a's requirement to 'provide examples of assessment tools') that measures student competency in understanding the research process, analysis, and critical thinking.

```text
Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research process, share insights on their topics from the research, speculate on the prospective contribution their research could make, highlight the problems/limitations they anticipate and how they would overcome them.  It is an opportunity for students to engage each other, availing themselves the benefit of the knowledge produced by their individual research effort. This assignment is worth 100 points, the same as a test grade.
```

##### Narrative 9 — 🟡 conf 0.68, 81 words, `review_low_confidence`

_Source heading:_ **Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research proces**

_AI rationale:_ This section describes a student learning assessment tool (research proposal presentation) with defined point value and learning objectives (grasp of research process, contribution, problem-solving). It functions as an assessment tool example supporting Standard 4.a's requirement for assessment tools and measurable student learning outcomes.

```text
Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research process, share insights on their topics from the research, speculate on the prospective contribution their research could make, highlight the problems/limitations they anticipate and how they would overcome them.  It is an opportunity for students to engage each other, availing themselves the benefit of the knowledge produced by their individual research effort. This assignment is worth 100 points, the same as a test grade.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[4][a].supportingEvidenceText`_

##### Evidence text 1 — conf 0.98, 1246 words, `auto_accept` ⤴️ _promoted from long prose_

_Source heading:_ **a.**

```text
The program has clear, measureable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following:Table of ContentsMeasureable student learning outcomesResponse: The Program goals and associated objectives are as follows (also in Appendix):Upon completion of the Counseling & Human Services program, graduates will be able to:1. Apply research findings to analyze common problems encountered in the human services field and develop appropriate solutions.Objectives/OutcomesDemonstrate basic technological competence.Describe the role and importance of ethics in social research.Obtain, evaluate, and use academic research literature to analyze issues in human service settings.2. Based on comprehensive self-evaluation and feedback from faculty and supervisors, develop individualized professional development goals and objectives.Objectives/OutcomesAccept constructive criticism and attempt to make appropriate adjustments.Analyze one’s own interpersonal strengths and weaknesses and their application to therapeutic settings.Develop personal goals and objectives.Exhibit attitudes and behaviors related to self-care and wellness.Seek guidance from faculty and supervisors.3. Exhibit consistent professional attitudes and behaviors in applied human services settings.Objectives/OutcomesDemonstrate punctuality, appropriate dress, and constructive use of time.Exhibit consistent ethical behavior in applied human services settings. Fol
… (truncated, full text imported)
```

##### Evidence text 2 — conf 0.72, 204 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Response
Criteria
Points
Excellent
Paper complete, well-organized and sections labeled as instructed.
Summary shows clear understanding of the author’s purpose(s), key points, arguments, and issues raised, conclusions arrived at, and explains how the research for the paper was done.
Critical comments show clear insight into the paper’s methodological problems, and clearly spell all or most of them out.
Paper contains zero or only minor writing error that does not detract from its quality.
90-100
Very
Good
Paper complete, organized and sections labeled as instructed.
Summary shows understanding of the author’s purpose(s), key points, arguments, and issues raised, conclusions arrived at, and explains how the research for the paper was done.
Critical comments show insight into the paper’s methodological problems, and spell many of them out.
Paper contains one or two writing errors.
70-80
Satisfactory
Paper divided into labeled sections as instructed.
Summary is ambiguous or unclear regarding the author’s purpose(s), key points, arguments, and issues raised, conclusions arrived at, and how the research for the paper was done.
Critical comments are lacking in clarity regarding the specific methodological problems of the paper and offer critique of a general nature.
Paper contains obvious writing errors:  spelling and grammatical.
40-60
No Attempt
No essay submitted
0
```

##### Evidence text 3 — conf 0.72, 169 words, `review_low_confidence`

_Source heading:_ **Each student will write a critical review paper of an assigned reading.  This paper must be clearly divided into two sec**

```text
Each student will write a critical review paper of an assigned reading.  This paper must be clearly divided into two sections with the captions ‘summary’ and ‘critical comments’.  Use the title of the article as title for this paper.  The summary section of this paper summarizes the article, highlighting the key points, issues raised, or conclusions arrived at by the author(s), and how the research for the paper was done.  The critical comments section should be written from the perspective of a research method student, focusing on methodological and analytic issues.  Students may also offer general critique of the material, pointing to the strengths and weaknesses of the material including wrong assumptions, faulty or misleading conclusions, alternative interpretations author(s) ignored, inconsistencies and contradictions in arguments/positions taken, organization and flow of the material and expositional clarity.  Conclude with your own thoughts on the material.  The details of this assignment & the grading rubric are provided in this syllabus. This assignment is worth 100 points, the same as a test grade.
```

##### Evidence text 4 — conf 0.72, 74 words, `review_low_confidence`

_Source heading:_ **The purpose of these exams is to assess your understanding of and ability to apply the material in this class. Some ques**

```text
The purpose of these exams is to assess your understanding of and ability to apply the material in this class. Some questions will focus on assessing your knowledge and others will assess how well you can apply the information you’ve learned in class to realistic situations. There will be three non-cumulative exams in this class. Each exam is worth 100 points, and can consist of a combination of multiple choice and short answer questions.
```

##### Evidence text 5 — conf 0.72, 194 words, `review_low_confidence`

_Source heading:_ **Exams (50% of your total grade) The purpose of these exams is to assess your understanding of and ability to apply the m**

```text
Exams (50% of your total grade) The purpose of these exams is to assess your understanding of and ability to apply the material in this class. Some questions will focus on assessing your knowledge and others will assess how well you can apply the information you have learned in class to realistic situations. There will be four non-cumulative exams in this class. Each exam is worth 125 points and will consist of a combination of multiple choice and short answer questions. The final exam (i.e., Exam 4) will be the same format and worth the same number of points as the three midterm exams. Note that the final exam is not cumulative. Very selectively, permission may be given to miss an exam and take a makeup exam due to extenuating circumstances. Evidence (e.g., doctor’s note or other verification) will be required (but may not be sufficient) in order to get permission to make up an exam. Students who are requesting a makeup exam must submit the request form to the instructor (available on Blackboard). If you miss an exam and are not permitted a makeup exam, you will receive a 0 on that exam.
```

##### Evidence text 6 — conf 0.72, 114 words, `review_low_confidence`

_Source heading:_ **We will have four tests/exams.  Each test will combine multiple-choice and essay questions. The questions in these tests**

```text
We will have four tests/exams.  Each test will combine multiple-choice and essay questions. The questions in these tests/exams will be drawn from our class discussions and assigned readings.  Three of these tests will be done on Blackboard.  These tests will be opened on the Friday of the scheduled week, remaining open until Sunday midnight. Students are responsible for ensuring that they take these tests as scheduled, using reliable internet connection.  The fourth is the final exam which will be in-class.  A make-up for a missed test will be arranged only if the reasons for missing the test are officially tenable, and appropriate documentation is provided.  These tests make up 50% of the course points.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[4][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ LLM returned non-JSON response

---

### `4.b` 🟡 — Program Evaluation

**Spec prompt:** _The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change._

**Final coverage verdict:** covered=**False**, score=**0.52**
_(first-pass: covered=False, score=0.52; second-pass after gap-fill: covered=False, score=0.52, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[4][b].content`_

##### Narrative 1 — 🟢 conf 0.92, 84 words, `review_letter_disagrees`

_Source heading:_ **D. Program Evaluation**

_AI rationale:_ The section describes the program's regular formal evaluations—including student surveys, agency surveys, graduate follow-up surveys, advisory committee involvement, and course evaluations—which directly aligns with Standard 4.b's requirement for comprehensive formal program evaluation at least every five years. While 4.a addresses student learning outcomes and assessment planning, the primary con

```text
Context: To ensure the program is effective in producing competent professionals, the program must be evaluated on a regular basis. In addition, the program must assess how well the needs of students and graduates are being met. These evaluations/ assessments are the bases for modifying and improving the program.

Standard 4: The program shall conduct, and report to the public, consistent formal evaluations, which determine its effectiveness in meeting the needs of the students, community, and the human services field.

Specifications for Standard 4:
```

##### Narrative 2 — 🟢 conf 0.89, 92 words, `auto_accept`

_Source heading:_ **Graduate Survey Results: Feedback from graduating seniors last spring were reviewed. Students consistently point to thei**

_AI rationale:_ This section presents graduate survey results and feedback analysis, which directly fulfills Standard 4.b's requirement to conduct formal program evaluation including student surveys and to describe how evaluation resulted in change (discussing reduction of required hours and commitment to maintaining field experience).

```text
Graduate Survey Results: Feedback from graduating seniors last spring were reviewed. Students consistently point to their field experiences, and to faculty, as the most beneficial parts of the program. However, some concern was expressed by students about the difficulty of completing the number of hours required and not getting paid. We discussed the possibility of reducing the number of required hours, but there was also a commitment to maintaining this vital part of the program. It will continue to be important to help students navigate finding a balance between work and practicum.
```

##### Narrative 3 — 🟡 conf 0.82, 66 words, `review_low_confidence`

_Source heading:_ **The results of the 2018-2019 Counseling & Human Services Program Evaluation confirm that the present curriculum and fiel**

_AI rationale:_ The section reports results from a formal 2018-2019 program evaluation that examined curriculum effectiveness, field experiences, and alignment with program mission and goals. This directly addresses Standard 4.b's requirement to conduct formal program evaluation and provide summative analysis of the most recent evaluation.

```text
The results of the 2018-2019 Counseling & Human Services Program Evaluation confirm that the present curriculum and field experiences are effective in meeting the program mission, “to provide students with an educational foundation that will prepare them for meaningful and effective careers within the human services field and successful continuation of their education.” Student field placement evaluations also indicate that the program goals are being met.
```

##### Narrative 4 — 🟡 conf 0.72, 53 words, `review_low_confidence`

_Source heading:_ **The Department Chair is responsible for developing and coordinating program assessment procedures.  Thus, the results ob**

_AI rationale:_ The section describes program assessment procedures, collection and dissemination of assessment results, and evaluation of program effectiveness and relevance—core elements of Standard 4.b's formal program evaluation methodology and process. The administrative responsibility aligns with 4.b's requirement for systematic evaluation including multiple data sources and stakeholder involvement.

```text
The Department Chair is responsible for developing and coordinating program assessment procedures.  Thus, the results obtained from the sources listed above are collected and disseminated by him/her to the appropriate individuals and groups.  The results are indicative of the current relevance of the educational objectives and the effectiveness of the program and curriculum.
```

##### Narrative 5 — 🟡 conf 0.72, 77 words, `review_low_confidence`

_Source heading:_ **Many students indicated that there was no part of the program that was not worthwhile. Five students noted that the text**

_AI rationale:_ This section presents student survey feedback and evaluation results, directly addressing Standard 4.b's requirement to conduct formal program evaluation including student surveys and summative analysis of findings. The feedback on practicum hours, internship hours, and course content reflects evaluation data used to assess program effectiveness.

```text
Many students indicated that there was no part of the program that was not worthwhile. Five students noted that the textbook for practicum was redundant and could have been used in the internship. A few students felt that the demands were overwhelming, particularly the practicum hours, while others indicated that the internship had too few hours to be effective.  Individual students mentioned specific courses and experiences (statistics, focused electives/budgeting class, the portfolio, and too much group work).
```

##### Narrative 6 — 🟡 conf 0.72, 55 words, `review_low_confidence`

_Source heading:_ **On the Program Evaluation Form and in the Senior Focus Groups, students praised their CHS courses and the Human Services**

_AI rationale:_ The section presents student feedback from evaluation forms and focus groups regarding curriculum and program offerings, which is core evidence of program evaluation methodology and use of student surveys as specified in Standard 4.b. While advisory input is mentioned, the focus is on student evaluation data collection and programmatic response.

```text
On the Program Evaluation Form and in the Senior Focus Groups, students praised their CHS courses and the Human Services faculty. Some suggestions related to the curriculum included an expansion of topics course offerings and tracks to include such areas as: child life, disabilities and special education, counseling for children and youth, and school counseling.
```

##### Narrative 7 — 🟡 conf 0.72, 60 words, `review_low_confidence`

_Source heading:_ **Only a few seniors offered suggestions for improving the program, but one theme was the expansion of course offerings an**

_AI rationale:_ This section reports student feedback and suggestions collected as part of program evaluation activities, directly addressing Standard 4.b's requirement that formal program evaluation include student surveys and analysis of results to inform program changes (course expansion, supervision improvements, articulation pathways). The narrative demonstrates how evaluation data is being used to guide imp

```text
Only a few seniors offered suggestions for improving the program, but one theme was the expansion of course offerings and tracks. Suggestions included: more counseling classes, therapeutic play, disabilities, trauma and more psychology courses. One student suggested that University Supervisors visit sites more often and early in the semester to catch problems early. Another student requested more graduate school articulations.
```

##### Narrative 8 — 🟡 conf 0.72, 57 words, `review_low_confidence`

_Source heading:_ **Evaluations for all graduates (35 students combined in fall of 2016 and spring of 2017) were reviewed by both the Depart**

_AI rationale:_ The section describes a formal review of graduate evaluations by designated personnel (Department Chair and Field Experience Coordinator), calculating percentages of student achievement against defined items. This directly addresses Standard 4.b's requirement for formal program evaluation methodology and data analysis, though the brevity limits confidence.

```text
Evaluations for all graduates (35 students combined in fall of 2016 and spring of 2017) were reviewed by both the Department Chair (John Rosicky) and the Field Experience Coordinator (Mayaugust Finkenberg). The percentage of students who meet or exceed each item was calculated. Comments were reviewed and shared with faculty, but were not included in the analysis.
```

##### Narrative 9 — 🟢 conf 0.96, 759 words, `auto_accept`

_Source heading:_ **The program shall conduct a formal program evaluation every five years. The formal evaluation shall**

_AI rationale:_ The section directly addresses Standard 4.b's requirement for formal program evaluation at least every five years, providing all four required elements: history of evaluations, methodology description, summative analysis of 2018-2019 evaluation, and reference to change resulting from evaluation (Standard 4c1). The narrative aligns precisely with the spec's mandate for student surveys, agency surve

```text
The program shall conduct a formal program evaluation every five years. The formal evaluation shall include: student surveys, agency surveys, graduate follow-up surveys (directed to both graduates and their employers), active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: Table of Contents A history of program evaluations Response: Comprehensive program evaluations that include the results of faculty and course evaluations, agency surveys, graduate surveys, and student surveys, as well as the active participation of the Advisory Board, have occurred annually since 2005. Employer evaluations of graduates occur regularly. These evaluations are supplemented by self-studies completed every five years for Council reaccreditation. Here is the Program Evaluation for 2018-201 9. A description of the methodology Response: Both quantitative and qualitative measures are employed to evaluate the Program. See the Program Evaluation Plan and copies of evaluation tools in the appendix. Evaluation tools that focus on faculty members are described in Standard 8 . Students complete quantitative evaluations of various facets of the Program, including evaluations of instructors (at midterm and end of each course), courses (at midterm and end of each course), field placement agencies (at midterm and end of field placement), University supervisors, agency supervisors, and, upon their completion of the Program and annually (one year after graduation), students evaluate the Program itself. Other quantitative evaluations are completed of graduate acceptance by graduate programs and by employers of Program graduates. Qualitative evaluations of field placement agencies utilized by the Program are made by University Supervisors in written submissions to the Field Placement Coordinator (at midterm and end of field placemen
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[4][b].supportingEvidenceText`_

##### Evidence text 1 — conf 0.72, 117 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Strongly Agree
Agree
Disagree
Strongly Disagree
No Opinion
Opinion
The agency was adequate for meeting course objectives.
61%
39%
An adequate orientation was provided by the agency.
58%
35%
3%
3%
The agency rules and regulations were explained clearly.
71%
26%
3%
The field instructor was available to discuss issues or concerns related to the experience.
52%
45%
3%
The field instructor was well prepared and organized.
52%
35%
10%
3%
The field instructor encouraged student questions and comments.
77%
20%
3%
The field instructor provided useful feedback during the semester.
68%
22%
10%
The staff was helpful and supportive to students.
77%
23%
The staff holds a positive attitude toward students and learning.
77%
20%
3%
```

##### Evidence text 2 — conf 0.72, 98 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Strongly
Agree
Agree
Disagree
Strongly Disagree
No Opinion
1. The agency was adequate for meeting course objectives.
2.  An adequate orientation      was provided by the agency.
3.  The agency rules and regulations were explained clearly.
4.  The field instructor was available to discuss issues or concerns related to the experience.
5.  The field instructor was well prepared and organized.
6.  The field instructor encouraged student questions and comments.
7.  The field instructor provided useful feedback during the semester.
8.  The staff was helpful and supportive to students.
9.  The staff holds a positive attitude toward students and learning.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[4][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No clear history of program evaluations provided—narrative claims 'annual' evaluations since 2005 but provides only one evaluation year (2018-2019) with no dates, frequency documentation, or timeline of prior evaluations
- ⚠️ Agency surveys are mentioned as part of methodology but no actual agency survey data, results, or analysis is provided in supporting evidence
- ⚠️ Graduate follow-up surveys are referenced but no actual graduate follow-up survey tool, data, or employer feedback is presented in evidence
- ⚠️ Active participation of advisory committee is claimed but no documentation of advisory committee meeting minutes, recommendations, or their specific contributions to the evaluation process
- ⚠️ No summative analysis of the most recent evaluation is provided—narrative includes student comments and quotes but lacks systematic analysis of quantitative results (e.g., percentages meeting standards, trend analysis)
- ⚠️ No clear description of how evaluation results led to specific, documented program changes—narrative discusses 'possibility of reducing hours' and mentions student suggestions for new tracks but provides no evidence of implemented decisions or outcomes
- ⚠️ Evaluation tools referenced in appendix are not provided as supporting evidence (Program Evaluation Plan, copies of evaluation instruments)
- ⚠️ Course and faculty evaluations are mentioned as occurring but no actual data or results from these evaluations are included
- ⚠️ Evaluative data mandated or conducted by the institution is not clearly identified or included
- ⚠️ Supporting evidence tables show only field placement agency/supervisor evaluations; student surveys, graduate surveys, employer evaluations, and other required evaluation sources are absent

---

### `4.c` 🔴 — Program Evaluation

**Spec prompt:** _The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[4][c].content`_

##### Narrative 1 — 🟢 conf 0.98, 215 words, `auto_accept`

_Source heading:_ **(table)**

_AI rationale:_ The section directly addresses the requirement to provide reliable information on program performance and student achievement to the public, including an active link on the website and aggregate data (enrollment, retention, graduation rates, GPA, student satisfaction, agency feedback). This matches Standard 4.c language and the CHEA Recognition Policy citation.

```text
c.
The program must routinely provide reliable information to the public on its performance, including student achievement.
[NOTE
: This Specification relates to accreditation standards or policies that require institutions or programs routinely to provide reliable information to the public on their performance including student achievement as determined by the institution or program (Paragraph 12 (B)(1), 2010 CHEA Recognition Policy and Procedures)] Provide the following:
Table of Contents
An active link to student achievement indicators on the Program’s website.
Response:
Student outcomes are displayed on the departmental web page
here
. The Department Chair is responsible for developing and coordinating program assessment procedures.  Thus, the results obtained from the sources listed in specification a.2 above are collected and disseminated by him/her to the appropriate individuals and groups.  The results are indicative of the current relevance of the educational objectives and the effectiveness of the program and curriculum.
Aggregate data as evidence of student achievement must include at a minimum:
enrollment trends
retention
graduation rates and grade point average
student satisfaction
agency feedback.
Optional student achievement indicators such as graduate transfer rates, graduate school or employment data, and alumni surveys may be included.
Response:
The required information is included on the departmental website, which is available to the public, in a section entitled
Student Outcomes
.
```

##### Narrative 2 — 🟡 conf 0.68, 83 words, `review_low_confidence`

_Source heading:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This sem**

_AI rationale:_ The section reports enrollment trend data (83 majors, 16 minors) and explicitly mentions the need to track recruitment and student outcomes—directly aligned with Standard 4.c's requirement for reliable performance information including enrollment trends and retention data to be made publicly available.

```text
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This semester we have a total of 83 majors and 16 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Human Services program through marketing and publicity efforts. In discussing the enrollment statistics, Kathea suggested getting information from the admissions office about students who are accepted into Stevenson but end up going somewhere else and what schools they ultimately attend.
```

##### Narrative 3 — 🟡 conf 0.68, 51 words, `review_low_confidence`

_Source heading:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spr**

_AI rationale:_ The section reports enrollment trend data (83 majors, 20 minors) as a performance metric. Standard 4.c explicitly requires aggregate enrollment trends as evidence of student achievement and program performance. While the data fragment could support 1.e (student population description), the emphasis on trends and the forward-looking recruitment concern aligns best with program evaluation and public

```text
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spring we have a total of 83 majors and 20 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Human Services program through marketing and publicity efforts.
```

##### Narrative 4 — 🟡 conf 0.68, 96 words, `review_low_confidence`

_Source heading:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This fal**

_AI rationale:_ The section reports enrollment statistics and trends, which directly align with Standard 4.c's requirement to provide enrollment trends as part of aggregate data on program performance and student achievement metrics.

```text
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This fall we have a total of 87 majors and 20 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Human Services program through marketing and publicity efforts. Kathea Smith offered to help by calling accepted students when the time is appropriate. She also suggested getting information from the admissions office about where accepted students decide to go if they don’t chose Stevenson, and why. Nigel suggested service events at local high schools.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[4][c].supportingEvidenceText`_

##### Evidence text 1 — conf 0.72, 33 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Letter Grade
Percentage Points
QPA Points
A
93-100
4.0
A-
90-92
3.7
B+
87-89
3.3
B
83-86
3.0
B-
80-82
2.7
C+
77-79
2.3
C
70-76
2.0
D
60-69
1.0
F
0-59
0.0
```

##### Evidence text 2 — conf 0.72, 33 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Letter Grade
Percentage Points
QPA Points
A
93-100
4.0
A-
90-92
3.7
B+
87-89
3.3
B
83-86
3.0
B-
80-82
2.7
C+
77-79
2.3
C
70-76
2.0
D
60-69
1.0
F
0-59
0.0
```

##### Evidence text 3 — conf 0.72, 33 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Letter Grade
Percentage Points
QPA Points
A
93-100
4.0
A-
90-92
3.7
B+
87-89
3.3
B
83-86
3.0
B-
80-82
2.7
C+
77-79
2.3
C
70-76
2.0
D
60-69
1.0
F
0-59
0.0
```

##### Evidence text 4 — conf 0.72, 33 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Letter Grade
Percentage Points
QPA Points
A
93-100
4.0
A-
90-92
3.7
B+
87-89
3.3
B
83-86
3.0
B-
80-82
2.7
C+
77-79
2.3
C
70-76
2.0
D
60-69
1.0
F
0-59
0.0
```

##### Evidence text 5 — conf 0.72, 33 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Letter Grade
Percentage Points
QPA Points
A
93-100
4.0
A-
90-92
3.7
B+
87-89
3.3
B
83-86
3.0
B-
80-82
2.7
C+
77-79
2.3
C
70-76
2.0
D
60-69
1.0
F
0-59
0.0
```

##### Evidence text 6 — conf 0.72, 33 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Letter Grade
Percentage Points
QPA Points
A
93-100
4.0
A-
90-92
3.7
B+
87-89
3.3
B
83-86
3.0
B-
80-82
2.7
C+
77-79
2.3
C
70-76
2.0
D
60-69
1.0
F
0-59
0.0
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[4][c].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 520 | 0.87 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |
| 2 | (data table) | `data-table` | 441 | 0.82 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ LLM returned non-JSON response

---

## Standard 5

### `5.a` 🔴 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of policies regarding the selection and admission of students._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[5][a].content`_

##### Narrative 1 — 🟢 conf 0.93, 76 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly documents policies regarding selection and admission of students, matching the exact language of Standard 5.a. The content addresses how students are admitted to the program through institutional procedures.

```text
Provide documentation of policies regarding the selection and admission of students.Table of ContentsResponse:Students enter the program in accordance with the University's admission policies and procedures.  See the Admissions section of the University Catalog online.  There are no additional requirements for the Program.  Students are able to enter the program at the beginning of their first year or at any point throughout their college career; however, all requirements for the program must be completed prior to graduation.
```

##### Narrative 2 — 🟡 conf 0.62, 83 words, `review_low_confidence`

_Source heading:_ **7.  The SPONSOR shall notify students selected for the Education Program that the student is not an employee of the HEAL**

_AI rationale:_ This section documents a program policy regarding the selection and admission of students—specifically, notification requirements for admitted students concerning their employment status and compensation. This falls under Standard 5.a (policies regarding selection and admission), though it also touches on student attributes and fitness-for-profession disclosures covered by 5.d.

```text
7.  The SPONSOR shall notify students selected for the Education Program that the student is not an employee of the HEALTH SYSTEM for any purpose, that the student shall not be compensated in any way, and that the student is not entitled to any benefit afforded by the HEALTH SYSTEM to its employees, including, but not limited to worker’s compensation insurance.  Students shall be informed that they will not be reimbursed for rendering services to patients during the course of the Education Program.
```

##### Narrative 3 — 🟡 conf 0.52, 53 words, `review_low_confidence`

_Source heading:_ **2.  The SPONSOR shall warrant to the HEALTH SYSTEM that each student has on record with the SPONSOR a complete physical,**

_AI rationale:_ This section addresses student health/medical screening requirements at admission, which falls under policies regarding selection and admission of students (5.a). While it also relates to 'fitness for the profession' (5.d), the primary focus is on documentation required prior to or at the point of admission.

```text
2.  The SPONSOR shall warrant to the HEALTH SYSTEM that each student has on record with the SPONSOR a complete physical, showing general good health, freedom from tuberculosis and no other infectious diseases.  Upon request from the HEALTH SYSTEM, a copy of records reflecting the foregoing shall be made available to HEALTH SYSTEM.
```

##### Narrative 4 — 🟡 conf 0.52, 57 words, `review_low_confidence`

_Source heading:_ **2.  Health Insurance.  Each student accepted into the Education Program, as a condition of participation, must carry hea**

_AI rationale:_ This section documents a mandatory health insurance policy as a condition of student participation in the program. While the similarity scores are modest across all candidates, Standard 5.a (admission policies) best captures the conditional requirement for program entry, though Standard 5.d (fitness for the profession) could also apply if health insurance is framed as a fitness/professional readin

```text
2.  Health Insurance.  Each student accepted into the Education Program, as a condition of participation, must carry health insurance including major medical coverage adequate to cover the student’s needs in case of any accident, injury or illness while participating in the HEALTH SYSTEM’s  Education Program, and shall furnish proof of such insurance to HEALTH SYSTEM upon request.
```

##### Narrative 5 — 🟡 conf 0.72, 79 words, `review_low_confidence`

_Source heading:_ **Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every s**

_AI rationale:_ This section articulates institutional policies governing student conduct, enrollment continuity (withdrawal procedures), and academic standing (grading consequences for non-attendance), which are foundational student policies and procedures covered under Standard 5.a. The FX grade sanction relates to retention and dismissal decision-making.

```text
Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[5][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No direct link or copy of actual University admission policies/procedures provided as supporting evidence; only a reference to 'see online catalog'
- ⚠️ Admission criteria not specified (e.g., GPA requirements, prerequisite courses, standardized test scores, or other selection benchmarks)
- ⚠️ No documentation of how the program selects or evaluates applicants beyond relying on university-wide admission
- ⚠️ No evidence of program-specific admission application materials or forms
- ⚠️ Conflicting/unclear admission structure: narrative states students can enter 'at the beginning of first year or at any point throughout their college career' but lacks detail on how mid-program entry is evaluated or managed
- ⚠️ No supporting evidence attached; all statements are unsubstantiated narrative only
- ⚠️ Health insurance and physical exam requirements appear to be conditions of participation rather than admission, and lack clear integration into formal admission policy

---

### `5.b` 🟡 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[5][b].content`_

##### Narrative 1 — 🟢 conf 0.94, 491 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses the specification requirement to 'Provide documentation of policies and procedures for referring students for personal and academic assistance' by describing the institution's referral mechanisms through the Office of Student Success, Early Alert system, Wellness Center, and supporting services.

```text
Provide documentation of policies and procedures for referring students for individualized personal and academic assistance. These policies must be consistent with the institution’s policies.Table of ContentsResponse:As a relatively small program, students are well known to departmental faculty and the support and ultimate success of every student is a priority. Each student is assigned a faculty advisor, and concerns (as well as plans to address them) about any students by any faculty members are discussed at every Department faculty meeting. Concerns about any issues, either academic or personal, are referred to the Office of Student Success, either through direct contact with staff in that office or through an Early Alert notification. The Office of Student Success follows up on all concerns and makes appropriate referrals as needed, keeping faculty members informed throughout the process. In addition, the University has a Wellness Center which offers a personalized environment, addressing an individual's needs through health and counseling services. While no referral form is used, faculty provide information about the Wellness Center to students who may need this resource and make contact with the Director of the Wellness Center about students referred. For more information about this service, visit the website Several University initiatives that potentially affect the wellness and support of students in the Counseling & Human Services Program include the existence of a Director of Multicultural Affairs, the University's written statement on accommodations, the Academic Link, and the Office of Student Success, as described in the following:Director of Multicultural Affairs.  This position was first filled in July 2003.  The Director of Multicultural Affairs coordinates the College's efforts to foster a diverse learning and working environment.  The Director provides counsel in initiating, developing, and implementing short and long-range plans related to diversi
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 74 words, `review_low_confidence`

_Source heading:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section articulates institutional policies and procedures for student expectations regarding attendance, grade consequences, and academic standing (including the 'FX' grade policy), which directly address how students are retained or dismissed based on program compliance and academic performance under Standard 5.b.

```text
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.
```

##### Narrative 3 — 🟡 conf 0.52, 89 words, `review_low_confidence`

_Source heading:_ **Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. **

_AI rationale:_ The section describes institutional policies and procedures for referring students to support services (Disability Services), which aligns with Standard 5.b's requirement to document policies for referring students for personal and academic assistance. While resource support (9.d) is tangentially relevant, the core content is procedural policy for student assistance and accommodation.

```text
Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.
```

##### Narrative 4 — 🟡 conf 0.52, 89 words, `review_low_confidence`

_Source heading:_ **Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. **

_AI rationale:_ This section describes institutional policies for referring students for personal and academic assistance (disability accommodations), which aligns most directly with Standard 5.b's requirement for documentation of referral policies. While it touches on student support resources (9.d), the primary focus is on admission/retention-related accommodation procedures.

```text
Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.
```

##### Narrative 5 — 🟡 conf 0.62, 88 words, `review_low_confidence`

_Source heading:_ **Disability Services Stevenson University will make reasonable accommodations for students with disabilities. The Office **

_AI rationale:_ This section describes institutional policies and procedures for referring students to support services (disability accommodations), which directly aligns with Standard 5.b's requirement to document policies for referring students for personal and academic assistance consistent with institutional policies.

```text
Disability Services Stevenson University will make reasonable accommodations for students with disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.
```

##### Narrative 6 — 🟡 conf 0.52, 78 words, `review_low_confidence`

_Source heading:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section describes attendance and grading policies that directly relate to student retention and academic standing policies. Standard 5.b addresses documentation of policies for retaining and dismissing students, including academic consequences (the 'FX' grade for non-attendance and failure to withdraw).

```text
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.
```

##### Narrative 7 — 🟡 conf 0.58, 82 words, `review_low_confidence`

_Source heading:_ **Academic Link - The John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), **

_AI rationale:_ The section describes the Academic Link as a resource for referring students for academic assistance (tutoring), which directly aligns with Standard 5.b's requirement to document policies and procedures for referring students for academic assistance. While it could also support Standard 9.d on resource support, the primary focus is on the referral/assistance policy mechanism.

```text
Academic Link - The John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), provides free tutoring for many classes. If you are having difficulty with or would benefit from discussing the material with an upper level peer, seek assistance early in the semester. Tutoring often makes a difference in a student’s grade. To view the tutoring schedule and sign up for an appointment, go to stevenson.go-redrock.com, visit the Link in person, or call 443-394-9300.
```

##### Narrative 8 — 🟡 conf 0.52, 89 words, `review_low_confidence`

_Source heading:_ **Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. **

_AI rationale:_ This section describes institutional policies and procedures for referring students to support services (disability accommodations), which aligns with Standard 5.b's requirement for documentation of policies directing students to personal and academic assistance. While it could tangentially relate to resource support (9.d), the primary focus is on institutional support policies and procedures.

```text
Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.
```

##### Narrative 9 — 🟡 conf 0.62, 78 words, `review_low_confidence`

_Source heading:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section articulates student policies regarding attendance, course completion, and grading consequences, which are core elements of institutional retention and dismissal procedures. While attendance policies are institutional in origin, they directly support how programs manage student academic standing and procedures for referring or dismissing students.

```text
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.
```

##### Narrative 10 — 🟡 conf 0.52, 105 words, `review_low_confidence`

_Source heading:_ **Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disa**

_AI rationale:_ This section documents institutional policy and procedures for student accommodations and support services, which most directly aligns with Standard 5.b's requirement for policies and procedures for referring students for personal and academic assistance. While it could also support Standard 9.d (resource support), the emphasis is on policy documentation rather than resource adequacy.

```text
Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for students who self-identify as having a disability and provide appropriate documentation. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive. This is the link to the University’s Office of Disability Services: http://www.stevenson.edu/academics/academic-resources/disability-support-services/
```

##### Narrative 11 — 🟡 conf 0.62, 78 words, `review_low_confidence`

_Source heading:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section articulates attendance policy and grading procedures that constitute documented policies and procedures for retaining students (including dismissal via 'FX' grade for non-attendance and failure to withdraw), which is the focus of Standard 5.b. While it touches on program communication (1.c), the primary regulatory and procedural intent aligns with student retention and dismissal proto

```text
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[5][b].supportingEvidenceText`_

##### Evidence text 1 — conf 0.52, 79 words, `review_low_confidence`

_Source heading:_ **The Office of Student Success facilitates equal access for every student who self-identifies as having a disability. If **

```text
The Office of Student Success facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact Abby Hurson, Director of Disability Services at ahurson@stevenson.edu / (443) 352-4920. Once accommodations are authorized by OSS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive. This is the link to the University’s Disability Support Services: http://www.stevenson.edu/academics/academic-resources/disability-support-services/
```

##### Evidence text 2 — conf 0.68, 52 words, `review_low_confidence`

_Source heading:_ **The Wellness Center - Stress is a normal part of being a student. However, if personal, emotional, 		or physical concern**

```text
The Wellness Center - Stress is a normal part of being a student. However, if personal, emotional, 		or physical concerns are interfering with your ability to be successful at Stevenson, please call the 		Wellness Center at 443-352-4200 to make an appointment. More information about the Wellness 		Center can be found at: http://www.stevenson.edu/student-life/health-wellness/
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No formal, documented referral procedures or referral form(s) explicitly provided as evidence. The narrative states 'no referral form is used' but does not document the alternative procedure in writing.
- ⚠️ Missing explicit written policies and procedures specific to the Counseling & Human Services Program for referring students for personal and academic assistance. Evidence shows university-wide resources but not program-level policies.
- ⚠️ No documentation of the actual Early Alert notification system mentioned in the narrative—procedures, triggers, or form are not provided as supporting evidence.
- ⚠️ Missing clarity on the faculty-to-Office of Student Success referral process: no written protocol, template, or step-by-step procedure provided.
- ⚠️ No documented procedures for how concerns discussed in faculty meetings are formally documented and referred; the process appears informal.
- ⚠️ Limited evidence of how wellness referrals are tracked and communicated back to faculty ('keeping faculty members informed' is mentioned but not documented with evidence).

---

### `5.c` 🔴 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of written policies and procedures describing the due process for probation, remediation, dismissal, appeal, and grievance procedures affecting students._

**Final coverage verdict:** covered=**False**, score=**0.25**
_(first-pass: covered=False, score=0.25; second-pass after gap-fill: covered=False, score=0.25, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[5][c].content`_

##### Narrative 1 — 🟢 conf 0.96, 102 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses written policies and procedures for due process, probation, dismissal, appeal, and grievance procedures affecting students, which is the exact language of Standard 5.c in the current specification.

```text
Provide documentation of written policies and procedures describing the due process for probation, dismissal, appeal, and grievance procedures affecting students.Table of ContentsResponse:The Counseling & Human Services Program follows the University’s policies and procedures related to due process for probation, dismissal, appeal, and grievance procedures. Redress of student grievances and the policies and procedures regarding disciplinary proceedings can be found in the Stevenson University Policy Manual, Vol. V: Student Policies. Procedures for due process and appeal of all decisions are clearly laid out in this document, which is available to students on the SU portal and is included here on the thumb drive.
```

##### Narrative 2 — 🟡 conf 0.62, 83 words, `review_low_confidence`

_Source heading:_ **Students will not receive credit for assignments submitted late or missed exams without prior approval of the instructor**

_AI rationale:_ This section describes written policies and procedures governing student assignment submission, grading, and consequences for non-compliance—core elements of due process and dismissal/remediation procedures under Standard 5.c. While not exclusively about probation or dismissal, the late-work and zero-grade policy constitutes a procedural rule affecting student standing and academic consequences.

```text
Students will not receive credit for assignments submitted late or missed exams without prior approval of the instructor. Student must provide a documented valid excuse explaining why they could not complete the assignment. Examples of documented valid excuses that will be considered are those involving illness, family emergencies, and catastrophic incidents, all of which can be verified through documentation and directly affect the involved student. If you miss an assignment without an acceptable documented valid excuse, you will earn a grade of Zero.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[5][c].supportingEvidenceText`_

##### Evidence text 1 — conf 0.52, 73 words, `review_low_confidence`

_Source heading:_ **(vi)	Notwithstanding any provision of this Agreement to the contrary regarding term or termination, if HEALTH SYSTEM det**

```text
(vi)	Notwithstanding any provision of this Agreement to the contrary regarding term or termination, if HEALTH SYSTEM determines in good faith that SPONSOR or any student has violated a material term of this Paragraph C pertaining to the confidentiality of Protected Health Information, HEALTH SYSTEM shall have the option to immediately terminate this Agreement or to immediately terminate the participation in the Education Program of any student who was involved in the violation.
```

##### Evidence text 2 — conf 0.62, 53 words, `review_low_confidence`

_Source heading:_ **The above Stevenson grading system will be used. Because you have all semester to earn points, I do NOT negotiate grades**

```text
The above Stevenson grading system will be used. Because you have all semester to earn points, I do NOT negotiate grades at the end of the semester. Furthermore, I will NOT offer any extra credit assignment. I would be happy to talk to you about ways to improve your grade throughout the semester!
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No documentation of written probation policies or procedures provided
- ⚠️ No documentation of remediation procedures provided (remediation explicitly required in Specification 5.c)
- ⚠️ No documentation of dismissal due process procedures provided beyond vague reference to university manual
- ⚠️ No documentation of appeal procedures specific to the counseling program provided
- ⚠️ No documentation of grievance procedures specific to the counseling program provided
- ⚠️ Evidence items do not substantiate the narrative claims—Evidence 1 is an unrelated health system confidentiality clause, Evidence 2 is a grading policy unrelated to due process
- ⚠️ The thumb drive reference claims policies are 'included here' but no actual policy documents are attached or described
- ⚠️ Narrative relies entirely on deferral to university-level policies without program-specific documentation
- ⚠️ Late assignment and missed exam policies (Evidence 2, narrative) do not address probation, remediation, dismissal, appeal, or grievance procedures

---

### `5.d` 🔴 — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[5][d].content`_

##### Narrative 1 — 🟢 conf 0.94, 480 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The narrative directly responds to Standard 5.d's requirement to document policies and procedures for assessing and managing student attributes, characteristics, and behaviors ('fitness for the profession'). The section addresses behavioral indicators, ethical standards, assessment mechanisms, and dismissal procedures for students not meeting professional standards.

```text
Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.Table of ContentsResponse: The Program’s behavioral expectations are included in the Counseling & Human Services Student Handbook.  Ethical behavior is addressed in the section on Department Procedures and in Appendix F, which lists the “Ethical Standards of Human Service Professionals.” A copy of the Handbook is provided to all Counseling & Human Services majors when they enter the major and they sign a New Student Acknowledgement Form confirming that they have received a handbook and agree to abide by the ethical standards.Faculty members who have a concern related to a student’s behavior document the concern with specific behaviors and discuss their concern with the individual student.  The student's advisor is also notified.  A list of “behavioral indicators” addressing respect for others, interpersonal skills, and professionalism is provided in the Counseling & Human Services Student Handbook here.  In addition to their presence in the Handbook, the Behavioral Indicators are reviewed when students enter the major and in both the Professional Development course (CHS 217) and Internship course (CHS 380).  Time is set aside at every faculty meeting for faculty members to raise any concerns they may have about students, including behavioral or legal concerns.  A plan on whether or how to address concerns is discussed and documented. Common initial outcomes include discussion of the concern between the instructor and student, referral of the student to his or her advisor, referral of the student to the Program Coordinator, referral of the student to the Stevenson Wellness Center, and/or referral of the student to another appropriate resource (see Department Meeting Minutes).Satisfactory performance in CHS 380 (internship and accompanying 
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 119 words, `review_low_confidence`

_Source heading:_ **The cornerstone for the retention of students in the Counseling & Human Services Department is the faculty advisor, who **

_AI rationale:_ The section describes institutional policies and procedures for student retention, including assignment of faculty advisors and their role in supporting student success, which directly addresses Standard 5.d's requirement for documentation of policies and procedures related to student retention and fitness for the profession.

```text
The cornerstone for the retention of students in the Counseling & Human Services Department is the faculty advisor, who is important in helping each student achieve his or her personal and career goals.  Upon admission to the department, each student is assigned an advisor who is a Counseling & Human Services faculty member.  Faculty advisors assist in course planning and are a source of information about the department and about the college in general.  Although it is the responsibility of the student to become familiar with academic regulations presented in university publications, the advisor can provide background knowledge and assistance, with emphasis on the student’s own decision-making.  Advisors schedule weekly office hours and are available for individually requested appointments.
```

##### Narrative 3 — 🟢 conf 0.89, 78 words, `auto_accept`

_Source heading:_ **In order to be eligible for the practicum (CHS 440), students must have a 2.5 overall GPA and demonstrate adequate profe**

_AI rationale:_ The section directly addresses program policies for assessing and managing student fitness for the profession (GPA, professionalism standards, dismissal procedures), which is the core subject of Standard 5.d on retaining and dismissing students based on professional attributes.

```text
In order to be eligible for the practicum (CHS 440), students must have a 2.5 overall GPA and demonstrate adequate professionalism, as assessed by faculty. Any concerns related to meeting professional expectations will be communicated to students (see next section). Students who do not meet professional expectations, or have below a 2.5 GPA by the end of the semester before their practicum placement, will not be allowed to register for CHS 440 and may need to switch majors.
```

##### Narrative 4 — 🟢 conf 0.88, 76 words, `auto_accept`

_Source heading:_ **In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profes**

_AI rationale:_ The section directly addresses program policies for assessing and managing student attributes and behaviors related to 'fitness for the profession,' including documentation of concerns and decisions regarding internship/practicum eligibility, which is the core requirement of Standard 5.d.

```text
In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profession,” faculty members who have a concern about a student related to any of these indicators will document the concern with specific behaviors and will discuss their concern with the individual student. Serious or chronic concerns will be discussed by department faculty and students may be judged ineligible for internship or practicum based on failure to meet professional expectations.
```

##### Narrative 5 — 🟡 conf 0.68, 56 words, `review_low_confidence`

_Source heading:_ **5.  	Effort will be made to maintain the placement.  Occasionally, however, the 	coordinator may decide that it is neces**

_AI rationale:_ This brief narrative describes program procedures for removing students from placements due to inadequate agency supervision or student Code of Ethics violations, which directly addresses fitness-for-the-profession assessment and dismissal/retention policies under Standard 5.d.

```text
5.  	Effort will be made to maintain the placement.  Occasionally, however, the 	coordinator may decide that it is necessary to remove a student from a particular 	placement.  The reasons for this action range from inadequate supervision on the 	part of the agency to a violation of the Code of Ethics on the part of the student.
```

##### Narrative 6 — 🟡 conf 0.82, 77 words, `review_low_confidence`

_Source heading:_ **In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profes**

_AI rationale:_ The section directly addresses policies and procedures for assessing and managing student attributes, behaviors, and 'fitness for the profession'—the core language of Standard 5.d. The narrative describes faculty documentation of behavioral concerns and eligibility determination for practicum/internship, which are assessment and management mechanisms for professional fitness.

```text
In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profession”, faculty members who have a concern about a student related to any of these indicators will document the concern with specific behaviors and will discuss their concern with the individual student. Serious or chronic concerns will be discussed by department faculty and students may be judged ineligible for internship or practicum based on failure to meet behavioral indicator prerequisites.
```

##### Narrative 7 — 🟡 conf 0.72, 71 words, `review_low_confidence`

_Source heading:_ **Juniors will receive additional information about the 5-year degree program in the CHS 380 class.  Interested students m**

_AI rationale:_ The section describes admission criteria and requirements (GPA, degree completion, faculty recommendation, letter of interest) for a 5-year degree program, which directly addresses program policies and procedures for admitting students as specified in Standard 5.d.

```text
Juniors will receive additional information about the 5-year degree program in the CHS 380 class.  Interested students must submit (1) a letter of interest and (2) a recommendation by a full-time faculty member in the SU Human Services Program.  Minimum criteria for the program are (1) 2.75 GPA and (2) acquisition of a Bachelor’s Degree in Human Services prior to beginning the fifth year of their graduate studies at McDaniel College.
```

##### Narrative 8 — 🟡 conf 0.58, 85 words, `review_low_confidence`

_Source heading:_ **5.	If requested by Affiliate, the School shall instruct the student to provide Affiliate with evidence of current TB sta**

_AI rationale:_ This section documents policies and procedures related to student health and fitness requirements (TB testing, Hepatitis B immunization) that are relevant to assessing and managing student attributes and behaviors important for fitness for the profession in human services field placements.

```text
5.	If requested by Affiliate, the School shall instruct the student to provide Affiliate with evidence of current TB status and Hepatitis B immunization or signed declination statement.  Otherwise, TB testing and Hepatitis B immunization will be provided by the Affiliate.  TB testing is required for all students at the Affiliate for (6) weeks or more.  Students are required to receive (2) PPD tests within the last (12) months as part of a two-step screening program required by the CDC, OSHA, and Affiliate’s accreditation agencies.
```

##### Narrative 9 — 🟡 conf 0.58, 51 words, `review_low_confidence`

_Source heading:_ **4.	The School will instruct participating students to abide by rules, regulations, policies and procedures as stipulated**

_AI rationale:_ The section addresses student conduct expectations and professional fitness standards (rules, regulations, confidentiality) that align with Standard 5.d's requirement to document policies managing student attributes and behaviors important for profession success. The confidentiality emphasis secondarily connects to 14.c (upholding confidentiality).

```text
4.	The School will instruct participating students to abide by rules, regulations, policies and procedures as stipulated by the Directors of the School and Affiliate, including the policy of holding patient information in the strictest confidence as required by local and federal regulations.  HIPAA training may be completed through the Affiliate.
```

##### Narrative 10 — 🟡 conf 0.72, 95 words, `review_low_confidence`

_Source heading:_ **The HEALTH SYSTEM has adopted a policy to establish and maintain a work environment free from the effects of alcohol or **

_AI rationale:_ This section documents the program's drug and alcohol policy and dismissal consequences, directly addressing fitness-for-the-profession standards and behavioral expectations critical to student retention and dismissal decisions under Standard 5.d.

```text
The HEALTH SYSTEM has adopted a policy to establish and maintain a work environment free from the effects of alcohol or other drugs, and specifically prohibits the illegal or unauthorized use, possession, manufacture, dispensation or sale of alcohol, controlled substances, drugs or drug paraphernalia on HEALTH SYSTEM premises or on HEALTH SYSTEM business, or in HEALTH SYSTEM supplied vehicles.  SPONSOR agrees to advise students of this policy and to inform students that a determination by HEALTH SYSTEM of non-conformance to this policy shall result in the immediate termination of their participation in the Education Program.
```

##### Narrative 11 — 🟡 conf 0.72, 70 words, `review_low_confidence`

_Source heading:_ **4.  The HEALTH SYSTEM shall retain the right to require the removal from, and deny access to, its facility of any studen**

_AI rationale:_ The section describes a policy for assessing and managing student behavior and professional conduct (fitness for the profession), including removal from a practicum facility, which directly aligns with Standard 5.d. It could secondarily address 5.c as it involves dismissal procedures, though the primary focus is on behavioral/fitness standards rather than due process language.

```text
4.  The HEALTH SYSTEM shall retain the right to require the removal from, and deny access to, its facility of any student whose professional or social conduct is, in the opinion of the HEALTH SYSTEM, disruptive, disreputable, or otherwise destructive of the established practices of the HEALTH SYSTEM or its standing in the community.  Such action shall be reported promptly to SPONSOR's contact person as noted in III, F, below.
```

##### Narrative 12 — 🟡 conf 0.68, 65 words, `review_low_confidence`

_Source heading:_ **D.         Hepatitis B.        The Centers for Disease Control recommend that all personnel working in a patient care en**

_AI rationale:_ This section addresses program policies regarding student health and safety requirements (Hepatitis B vaccination), which falls under Standard 5.d's requirement to document policies assessing and managing student attributes, characteristics, and behaviors important for fitness for the profession in a clinical/patient-care context.

```text
D.         Hepatitis B.        The Centers for Disease Control recommend that all personnel working in a patient care environment receive the Hepatitis B vaccine.  At present, the HEALTH SYSTEM does not require that students enrolled in the HEALTH SYSTEM's clinical training programs receive the vaccine.  The HEALTH SYSTEM maintains that it is the student's personal and financial responsibility to determine whether they should receive the vaccine.
```

##### Narrative 13 — 🟡 conf 0.62, 79 words, `review_low_confidence`

_Source heading:_ **Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every s**

_AI rationale:_ This attendance policy addresses student behaviors and program expectations for maintaining good standing in the program, including consequences for non-compliance (FX grade), which aligns best with Standard 5.d on fitness for the profession and student conduct policies. It could secondarily inform 1.c regarding program expectations communicated to students.

```text
Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[5][d].supportingEvidenceText`_

##### Evidence text 1 — conf 0.68, 110 words, `review_low_confidence`

_Source heading:_ **Participation & Professionalism:  The basic principle is that I expect respectful behavior in this class.  Your particip**

```text
Participation & Professionalism:  The basic principle is that I expect respectful behavior in this class.  Your participation grade will be based on your professionalism, engagement, and contribution in large group and small group discussions in class as well as large group, small group, and individual in-class activities. There will be no opportunities to make up participation points. You must be present (both physically and mentally) in class in order to receive participation points. We are all colleagues and collaborators in learning. Therefore, we should all treat each other with the consideration and respect of professionals.  Professionalism will count towards your grade. Therefore, you will lose points for any non-professional activities.
```

##### Evidence text 2 — conf 0.72, 161 words, `review_low_confidence`

_Source heading:_ **Participation & Professionalism (10% of your total grade) Your participation grade will be based on your professionalism**

```text
Participation & Professionalism (10% of your total grade) Your participation grade will be based on your professionalism, engagement, and contribution in large group and small group discussions and activities in class. There will be no opportunities to make up participation points. You must be present (both physically and mentally) in class in order to receive participation points. You will be given some early feedback regarding your participation and professionalism before the middle of the semester.  We are all colleagues and collaborators in learning. Therefore, we should all treat each other with the consideration and respect of professionals. Therefore, you will lose points for any non-professional activities. These include all disruptive and disrespectful behaviors including: using your computer device (e.g., laptop, cell phone, tablet, etc.) without approval from instructor (also see Policies on p.4 of the syllabus); tardiness or leaving class early;  missing appointments with faculty (or peers);  failing to work collaboratively and respectfully with peers;  participating in “extracurricular” conversations during class.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[5][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ LLM returned non-JSON response

---

## Standard 6

### `6.a` 🔴 — Credentials of Human Services Faculty

**Spec prompt:** _Include curriculum vitae of full-time and part-time faculty who teach human services courses. The vitae must demonstrate that: 1. Faculty have education in various disciplines and experience in human services or related fields 2. Teaching faculty have no less than one degree above the level of certificate or degree in which they teach. It is recommended that faculty have no less than a master’s degree._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[6][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[6][a].supportingEvidenceText`_

##### Evidence text 1 — conf 0.89, 1565 words, `review_letter_disagrees` ⤴️ _promoted from long prose_

_Source heading:_ **(curriculum matrix table)**

```text
F. Credentials of Human Services Faculty
Context
:
Human services programs have relied primarily on professionals from fields such as human services, psychology, sociology, social work, counseling, political science, adult education, and nursing to provide teaching faculty. Since both field and classroom orientations are important characteristics of teaching staff, consideration should be given to faculty trained in human services and/or interdisciplinary methods and approaches.
Standard 6: The combined competencies and disciplines of the faculty for each program shall include both a strong and diverse knowledge base and clinical/practical experience in the delivery of human services to clients.
Specifications for Standard 6:
a.
Include curriculum vitae of full-time and part-time faculty who teach human services courses. The vitae must demonstrate that:
Faculty have education in various disciplines and experience in human services or related fields
Table of Contents
Response:
Curriculum vitae for full-time and part-time instructors are included in the
Appendix
. Full-time and part-time program faculty have expertise in a variety of areas including counseling, human services, law, psychology, education, social work, administration of human services, addictions counseling, developmental psychology, special education, guidance counseling, educational leadership, and pastoral counseling.  Across the full-time and regular part-time faculty members, three faculty members have a Ph.
… (truncated, full text imported)
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[6][a].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 845 | 0.92 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ No narrative response provided to introduce or contextualize the faculty credentials evidence
- ⚠️ Evidence 1 is incomplete—text cuts off mid-sentence ('three faculty members have a Ph.') without completing the degree information
- ⚠️ Only one sample CV provided (Evidence 2); Specification requires CVs for 'full-time and part-time faculty who teach human services courses'—no evidence of comprehensive faculty roster
- ⚠️ Evidence 2 demonstrates one faculty member's education and experience but does not show verification that ALL faculty meet the requirement of 'no less than one degree above the level of certificate or degree in which they teach'
- ⚠️ No systematic summary table or appendix reference confirming all faculty teaching human services courses have master's degrees or higher (the recommended standard)
- ⚠️ Missing evidence of faculty diversity across disciplines—only one CV provided; cannot verify 'various disciplines' claim without additional examples

---

## Standard 7

### `7.a` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Document that faculty have the ultimate responsibility for setting policies and determining the content, implementation, and evaluation of the curriculum._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative explanation of faculty responsibility for curriculum policy-setting
- ⚠️ No documentation of faculty authority over curriculum content determination
- ⚠️ No evidence of faculty involvement in curriculum implementation decisions
- ⚠️ No documentation of faculty role in curriculum evaluation processes
- ⚠️ No supporting evidence (e.g., governance documents, committee minutes, policy statements) provided
- ⚠️ No demonstration of institutional structures that establish faculty primacy in curricular matters
- ⚠️ No evidence of decision-making authority delegation or chain of responsibility

---

### `7.b` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Essential program roles include administration, curriculum development and review, instruction, field supervision, program planning, program evaluation, student advising, and student evaluation. Provide the following: 1. A brief description of how these essential roles are fulfilled in the program 2. A table matching faculty and staff positions and names with these roles._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative description of how essential roles (administration, curriculum development and review, instruction, field supervision, program planning, program evaluation, student advising, student evaluation) are fulfilled
- ⚠️ No table matching faculty and staff positions/names with essential program roles
- ⚠️ No evidence of role assignments or responsibility descriptions
- ⚠️ No documentation of personnel structure or organizational chart
- ⚠️ No demonstration of how each of the eight essential roles is addressed in the program

---

### `7.c` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Describe the process for faculty and staff evaluation. Documentation may come from a variety of sources and may include, among others, student evaluations, administrative review, comments from field placement agencies, and peer review._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[7][c].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[7][c].supportingEvidenceText`_

##### Evidence text 1 — conf 0.68, 87 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
ITEM
RESPONSE
The university supervisor…
Strongly Agree
Agree Somewhat
No Opinion
Disagree Somewhat
Strongly Disagree
Provided me with sufficient feedback.
Encouraged me to be self-reflective.
Responded to journal entries in a timely manner.
Encouraged me to do my best.
Was interested in my professional development.
Was appropriately supportive.
Listened to what I had to say.
Answered my questions adequately.
Was someone I felt free to talk to.
Explained things so that I could understand.
Was easy to contact.
Evaluated me fairly.
Visited my placement site (if appropriate)
```

##### Evidence text 2 — conf 0.51, 55 words, `review_low_confidence`

_Source heading:_ **The following signatures verify that a conference has taken place between the faculty member and the supervisor. These s**

```text
The following signatures verify that a conference has taken place between the faculty member and the supervisor. These signatures do not necessarily certify that the employee agrees with the final evaluation score or all evaluation items. However, the faculty has the right to make written comments in this regard as seen in the section above.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[7][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No narrative explanation provided; the specification explicitly asks to 'describe the process' but no descriptive text is included
- ⚠️ No documentation of administrative review process or criteria for faculty/staff evaluation
- ⚠️ No evidence of peer review process or documentation
- ⚠️ No evidence of comments from field placement agencies being incorporated into evaluation
- ⚠️ No clear description of how multiple evaluation sources are compiled, weighted, or used in summative decisions
- ⚠️ No documentation of evaluation frequency, timeline, or procedures
- ⚠️ No evidence of how student evaluations (Evidence 1) are formally integrated into personnel evaluation decisions
- ⚠️ No description of evaluation standards, rubrics, or performance expectations
- ⚠️ No evidence of appeal or remediation processes for faculty/staff
- ⚠️ Evidence 2 demonstrates conference documentation but lacks context about evaluation procedures, standards, or how this fits into the broader evaluation system

---

### `7.d` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Document how the evaluative process is used to identify strengths and limitations and how it is incorporated in specific procedures for improvement._

**Final coverage verdict:** covered=**False**, score=**0.15**
_(first-pass: covered=False, score=0.15; second-pass after gap-fill: covered=False, score=0.15, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[7][d].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[7][d].supportingEvidenceText`_

##### Evidence text 1 — conf 0.62, 80 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Criteria/Performance Rating
Scoring points
Inadequate/
No Evidence
0
Adequate/
Satisfactory
1
Excellent
2
Score
Develops individualized professional development goals and objectives
Average Rating:
1.3
Rater 1 Score: ___________
Rater 2 Score: ___________
Exhibits consistent professional attitudes and behaviors in applied human services settings
Average Rating:
1.2
Rater 1 Score: ___________
Rater 2 Score: ___________
Synthesizes and appropriately applies key concepts, methods and values in human services to professional situations
Average Rating:
1.45
Rater 1 Score: ___________
Rater 2 Score: ___________
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[7][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No narrative explanation provided; specification requires documentation of HOW the evaluative process is used
- ⚠️ No evidence of how evaluation findings identify specific STRENGTHS of personnel
- ⚠️ No evidence of how evaluation findings identify specific LIMITATIONS of personnel
- ⚠️ No documentation of specific procedures for improvement that result FROM evaluation findings
- ⚠️ No connection shown between evaluation data (ratings) and actual improvement actions taken
- ⚠️ No evidence of follow-up or monitoring to assess whether improvement procedures were effective
- ⚠️ Data table shows ratings only; lacks context for what triggered action, who reviewed results, or what next steps occurred
- ⚠️ No demonstration of how low ratings (e.g., 1.2 average) triggered specific improvement planning

---

### `7.e` 🔴 — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Describe how faculty and staff are provided opportunities for relevant professional development._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative description of professional development opportunities provided
- ⚠️ No evidence of institutional policies, programs, or structures supporting faculty/staff development
- ⚠️ No documentation of types of professional development offered (conferences, workshops, training, etc.)
- ⚠️ No evidence of budget allocation or resources dedicated to professional development
- ⚠️ No description of how development opportunities relate to faculty/staff roles and responsibilities
- ⚠️ No evidence of participation rates, attendance records, or tracking of professional development activities
- ⚠️ No explanation of how professional development needs are assessed or identified
- ⚠️ No evidence of professional development outcomes or impact on program quality
- ⚠️ No documentation of support for credentials, certifications, or advanced degrees
- ⚠️ No evidence of faculty/staff input or choice in professional development selection

---

## Standard 8

### `8.a` 🟡 — Cultural Competence

**Spec prompt:** _Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff_

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[8][a].content`_

##### Narrative 1 — 🟢 conf 0.88, 390 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly addresses how the program includes cultural competence in policies, procedures, and practices, and describes cultural competence training for faculty and staff. This matches Standard 8.a's requirement to demonstrate intercultural fluency and accessibility in program policies/procedures and faculty/staff training.

```text
Demonstrate how the program Includes cultural competence in program policies, procedures, and practices.Table of ContentsResponse: Cultural competence is deeply embedded in the Counseling & Human Services program and throughout Stevenson University. One of the campus leaders in cultural competence issues, Lauri Weiner, is a full-time faculty member in the department. She teaches the required course CHS 220 Diversity and Cultural Competence, serves on a college-wide diversity task force, and has facilitated or co-led an ongoing series of faculty/student conversations on diversity for the past several years. Cultural competence is #4 of the six program outcomes. Professional expectations are emphasized throughout the program, but are included as prerequisites for participation in field experiences. These expectations explicitly include culturally sensitive behavior (item #1), as described in the student handbook. As indicated below, cultural competence skills are emphasized in multiple ways throughout the program and students are provided opportunities to develop and practice these skills. If a student continues to violate these expectations after repeated attempts to remediate the issue, this can be a basis for removal from the program (see Standard 5c and d). Includes cultural competence training for faculty and staffResponse: Institutionally, Stevenson University is committed to promoting cultural awareness and sensitivity in students, faculty and staff. A college-wide taskforce is working on developing systematic requirements for faculty to engage in cultural competence training. Currently, participation in training opportunities is voluntary. Through Academic Affairs Faculty Development, Diversity and Inclusion resources are available to faculty, including programs on Inclusivity in the Classroom, Language Variation in the Classroom, Confronting the Lies I Tell Myself, and a Peer Mentoring program for faculty. Human Resources offers periodic trainings related to 
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect and practice at every le**

_AI rationale:_ This institutional commitment statement demonstrates how the program integrates intercultural fluency and accessibility principles into program policies, procedures, and organizational practices—the core of Standard 8.a. The narrative articulates organizational-level commitment to diversity and inclusive climate that supports faculty, staff, and student development.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 3 — 🟡 conf 0.62, 82 words, `review_low_confidence`

_Source heading:_ **The Human Services Club is very active on Stevenson's campus.  The Club sponsors a variety of special charitable, educat**

_AI rationale:_ This section describes co-curricular student engagement, community service activities, and professional development opportunities (guest speakers from graduate programs), which best align with Standard 8.a (Student Development), specifically the application of knowledge and skills in community-based settings and professional socialization. The activities demonstrate practical engagement consistent

```text
The Human Services Club is very active on Stevenson's campus.  The Club sponsors a variety of special charitable, educational, and social activities.  Students participate in several service projects that benefit people in need, such as dinners at the Children’s House, the Villa Maria Fair, and the “Port to Fort Walk/Run,” which aided the Believe in Tomorrow Foundation. The Club invites speakers such as admissions officers from graduate departments in counseling and social work, and hosts social gatherings like the annual "Holiday Party."
```

##### Narrative 4 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This institutional commitment statement directly addresses how the program includes intercultural fluency and accessibility principles in organizational policies, procedures, and practices across all levels—the core requirement of Standard 8.a. While it frames diversity at the organizational level rather than faculty/staff training specifically, it most closely maps to the program-wide policy and 

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 5 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This narrative articulates the institution's commitment to diversity, intercultural fluency, and inclusive organizational climate, which directly addresses Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 6 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This narrative describes the institution's commitment to diversity, intercultural fluency, and inclusive organizational climate in program policies and practices, which directly aligns with Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in policies, procedures, and practices.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 7 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This institutional commitment statement directly addresses how the program includes intercultural fluency and accessibility principles in organizational policies, procedures, and practices—the core language of Standard 8.a. The emphasis on diversity awareness, education, respect, and inclusive organizational climate aligns with program-level cultural competence infrastructure.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 8 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This passage articulates the university's organizational commitment to diversity, intercultural fluency, and inclusive practices across policies and procedures, directly addressing Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 9 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This section articulates the institution's commitment to diversity, intercultural fluency, and inclusive organizational practices across policies and procedures, which directly addresses Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 10 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ The narrative articulates institutional commitment to diversity, inclusion, and intercultural awareness across all organizational levels and policies, directly addressing Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 11 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ The section articulates the university's commitment to diversity, inclusion, and intercultural fluency as an organizational value and practice, directly addressing how the program includes intercultural fluency and accessibility principles in program policies and organizational climate (Standard 8.a). It also supports 8.b by framing awareness and respect for diverse identities and perspectives.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

##### Narrative 12 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This section articulates the program's institutional commitment to diversity, intercultural fluency, and inclusive practices across the organization—directly addressing Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

```text
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[8][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[8][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence of specific accessibility principles integrated into program policies, procedures, and practices—only cultural competence is addressed
- ⚠️ Faculty/staff training on accessibility is completely absent; only voluntary cultural competence training opportunities are mentioned
- ⚠️ No documentation of mandatory or systematic cultural competence and accessibility training requirements for faculty and staff (acknowledged as 'voluntary' and 'in development')
- ⚠️ No supporting evidence documents provided (e.g., course syllabus for CHS 220, field experience handbooks, professional expectations documents, training records, accessibility policies)
- ⚠️ Intercultural fluency is implied but not explicitly defined or mapped to specific policies, procedures, or practices
- ⚠️ Heavy repetition of university diversity statement (appears 6+ times) dilutes rather than strengthens the response and suggests padding
- ⚠️ Student club activities and community service projects do not directly address how accessibility and intercultural fluency are embedded in program policies and procedures
- ⚠️ No mention of how accessibility accommodations are formalized in program policies or how accessibility is monitored in field placements

---

### `8.b` 🔴 — Cultural Competence

**Spec prompt:** _Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[8][b].content`_

##### Narrative 1 — 🟢 conf 0.91, 325 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses Standard 8.b's requirement to demonstrate how the curriculum integrates culturally and inclusively appropriate standards, including student self-awareness of culture, biases, and prejudice, and development of awareness, knowledge, and skills of intercultural fluency. The narrative provides specific course examples and assignments that satisfy all enumerated elements 

```text
Demonstrate how the curriculum integrates cultural competence:Includes but is not limited to student self-awareness of own culture, biases, prejudice, and belief systems and stereotyping.Table of ContentsResponse: The curriculum includes CHS 220 Diversity and Cultural Competence as a required course. As part of this course, students complete a cultural autobiography and write three response papers that require reflection on their own cultural beliefs and experiences and how they affect their perception of the world. This emphasis on cultural self-reflection is introduced in the First Year Seminar (a 1-credit course required of entering freshmen) and carried throughout the curriculum. For example, in the capstone clinical skills course CHS 430 Family Dynamics and Interventions, students complete a detailed family of origin assignment that requires them to think deeply about their own family/cultural experiences and how those experiences have affected their perceptions and attitudes. Self-awareness is a key part of the program outcomes (see #6). Includes the development of awareness, knowledge, and skills of diversity and culture.Response: Awareness and knowledge of diversity and culture are integrated throughout the curriculum, as described above. Another good example of the incorporation of cultural issues is in CHS 101 Family Studies, which is focused on the diversity of family structures and includes an assignment asking students to research and report on multiple facets of a controversial issue. Skills are developed through the application of knowledge in the field experience courses, CHS 380 Internship and CHS 440 Practicum. In these courses, students work closely with on-site supervisors and with faculty to practice and improve their skills. As indicated in the field placement evaluation, which is completed as a self-evaluation by students and as a formal evaluation by supervisors both in the middle and end of both experiences, both self-reflection and cultural
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.79, 63 words, `review_letter_disagrees`

_Source heading:_ **H. Cultural Competence**

_AI rationale:_ The section directly addresses curriculum integration of cultural competence, self-awareness of bias and beliefs, and development of intercultural fluency and cultural knowledge/skills, which align most closely with Standard 8.b's specification for curriculum integration. Standard 8.a is a near-equal alternate as the program statement mentions fostering competence through 'program characteristics,

```text
Context: To ensure the program is effective in producing culturally competent professionals who possess high level of self-awareness, knowledge, and skills in the complexities of multiculturalism.  This encompasses the individual, family, and group levels as well as agency/organizational, community, and globally.

Standard 8: The program shall foster the development of culturally competent professionals through program characteristics, curriculum, and fieldwork.

Specifications for Standard 8:
```

##### Narrative 3 — 🟢 conf 0.87, 520 words, `review_letter_disagrees`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses how the curriculum integrates culturally and inclusively appropriate standards, including student self-awareness of culture and biases, development of intercultural awareness and skills across multiple courses—all core elements of Standard 8.b on Cultural Competence.

```text
Awareness of diversity.Response:Awareness of diversity is emphasized throughout the Counseling & Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 101, 105, 220, 224, 315/515, 360, 430, 380, 440 and 441.Course objective 4 of CHS 101 Family Studies requires that each student be able to “articulate the diversity of family life issues both domestically and internationally. Diversity issues are addressed throughout the course and specifically in the assigned reading, lecture, media presentations, and class discussions. See particularly units on gender, selecting a partner, and same sex couples.Awareness of diversity is addressed through readings, lectures, and discussions in CHS 105. Included in the CHS 105 Human Services and Social Policy course objectives is the objective that the students “articulate how diversity among individuals, families, and communities may affect the delivery of human services” (# 3).  In addition, awareness of diversity is explored through assigned readings, lecture, and in-class activities (units on special groups in need of services and multi-cultural issues). CHS 220 Diversity and Cultural Competence is devoted primarily to an awareness of diversity. See all course objectives, the course schedule, and group presentation and immigrant interview assignments. In CHS 224 Research Methods and Writing, students learn about the role of diversity in social science research (see weeks 2, 4 and the unit on comparative research in week 12). Students develop a detailed research proposal that includes a consideration of diversity in the research design. An awareness of diversity is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objectives 1 and 4 and schedule); CHS 360 in the cont
… (truncated, full text imported)
```

##### Narrative 4 — 🟡 conf 0.72, 67 words, `review_low_confidence`

_Source heading:_ **Each student will choose a nation to study in-depth.  Students will examine how people from that nation or similar natio**

_AI rationale:_ The assignment directly addresses culturally inclusive curriculum by requiring students to examine stereotypes and media representations of specific cultural groups, while also developing awareness of services available to those populations—aligning with Standard 8.b's requirement to integrate awareness and knowledge of intercultural fluency and culture.

```text
Each student will choose a nation to study in-depth.  Students will examine how people from that nation or similar nations are presented in the media including news, television and movies.  Students will prepare a list of services available for that group to be given out during the presentation.  One copy of the team presentation will be provided to the instructor, and individually written reports will be submitted.
```

##### Narrative 5 — 🟡 conf 0.68, 77 words, `review_low_confidence`

_Source heading:_ **COURSE GROUND RULES:  Students will be exposed to different realities, opinions and perspectives with which you may be u**

_AI rationale:_ The section's primary focus is establishing classroom ground rules that address student self-awareness of biases, respectful engagement with diverse perspectives, and critical thinking about diversity—directly aligning with Standard 8.b's requirement to demonstrate curriculum integration of cultural competence including self-awareness of biases and intercultural fluency. The confidentiality statem

```text
COURSE GROUND RULES:  Students will be exposed to different realities, opinions and perspectives with which you may be uncomfortable or disagree.  The class readings, assignments and discussions will require you to think critically about various aspects of diversity and may challenge some of your values and beliefs.  It is important to treat each other with respect, to listen to other points of view, and to question others in an appropriate manner. Information shared in class is confidential.
```

##### Narrative 6 — 🟡 conf 0.72, 122 words, `review_low_confidence`

_Source heading:_ **We live in a modern world, and yet, some of our beliefs and practices regarding race reveal that our world may not be as**

_AI rationale:_ The section addresses student self-awareness of biases, prejudice, and belief systems regarding race and racism—directly matching Standard 8.b's requirement that curriculum includes student self-awareness of culture, biases, prejudice, and belief systems, and stereotyping.

```text
We live in a modern world, and yet, some of our beliefs and practices regarding race reveal that our world may not be as developed as we would like. Looking at Baltimore City specifically, Freddie Gray is the perfect example that racism still exists in our society today. Racial profiling is common enough in our society that the term “Driving While Black” or DWB is used to address being pulled over by police officers for no apparent reason. Robin DiAngelo, through her presentation “Deconstructing White Privilege,” discusses racism in our society through her “white experience”; while informative about bias, racism and white superiority, she fails to address what we, as a society or as individuals, can do outside of recognition of racism.
```

##### Narrative 7 — 🟡 conf 0.52, 180 words, `review_low_confidence`

_Source heading:_ **Although South Korea is fond, as well as welcoming when it comes to differing religions and customs, when it comes to di**

_AI rationale:_ The section discusses cultural competence challenges, discrimination, biases, and ethno-national homogeneity in South Korea as a case study of intercultural fluency gaps. This addresses Standard 8.b's curriculum integration of culturally appropriate standards including awareness of biases, prejudice, and belief systems.

```text
Although South Korea is fond, as well as welcoming when it comes to differing religions and customs, when it comes to diversity, they have a bit of a challenge with cultural competence. In fact many South Koreans have complained of the “growing intolerance” towards foreigners, going as far as to having “Korean-only” bars, which sparked outrage in the society (Meinecke, 2016). This discriminatory behavior is still occurring in the country because there are no anti-discriminatory laws in place to protect foreigners from discrimination itself, and efforts to change this have failed (Meinecke, 2016). Ethno-national and linguistic homogeneity have been the norm for South Korea for many years, and it is going to be rather difficult to change that. They have always, ever since Korea was founded 5,000 years ago, been a “one race”, “one blood country”, and they have taken great pride in that fact (Park, 2017). The government however, is trying to be more tolerant and more exploratory to foreigners in recent years however, as they began exploring the water on immigration primarily focusing on temporary workers (Park, 2017).
```

##### Narrative 8 — 🟡 conf 0.68, 112 words, `review_low_confidence`

_Source heading:_ **Robin DiAngelo opens a dialogue about the rampant and obvious racism that occurs in our society but misses the mark when**

_AI rationale:_ The passage critiques a presentation on implicit bias and racism, directly engaging with curriculum content about student self-awareness of biases, prejudice, and belief systems—core elements of Standard 8.b's requirement for student self-awareness development within culturally inclusive curriculum.

```text
Robin DiAngelo opens a dialogue about the rampant and obvious racism that occurs in our society but misses the mark when it comes to clarifying meaning. When the video ends, the viewer is left with more questions about their implicit bias and how to assess themselves and others. The presentation opens a can of worms, failing to discuss a solution as to how this can be fixed in our society. The apparent answer seems to be that it will take multiple generations before racism is truly less of a problem than it is now. But again, DiAngelo misses the mark on a full explanation of the purpose outside of recognizing the problem.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[8][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[8][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ LLM returned non-JSON response

---

## Standard 9

### `9.a` 🔴 — Program Support

**Spec prompt:** _Include budgetary information that demonstrates sufficient funding, faculty, and staff to provide an ongoing and stable program._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[9][a].content`_

##### Narrative 1 — 🟢 conf 0.98, 443 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly responds to the specification requesting budgetary information demonstrating sufficient funding, faculty, and staff to provide an ongoing and stable program. The narrative details the department's annual budget development, allocation across categories, and how expenses support students and community partners.

```text
Include budgetary information that demonstrates sufficient funding, faculty, and staff to provide an ongoing and stable program. Table of ContentsNOTE: provide the reader both with a program budget and with a description of how to read and interpret it.Response:The budget is developed and proposed annually by the Department Chair and submitted to the Dean of the School of Humanities and Social Sciences.  See the operating budgets for 2018-2019 and for the upcoming year (2019-2020).The total department budget of $8,683.89 has been decreasing for the past few years as part of across-the-board spending reductions. Discretionary spending is allocated among 10 different categories, including professional development, student travel, department events, and gifts to others. Funds can be moved across categories, or into new categories to cover expenses that don’t fit in an existing category. To read the budget, the first column for each line item indicated the amount ‘Budgeted.” The column labeled “Actual” indicates expenses charged to line. The last column is “Funds Available,” which indicates the amount remaining in the line or the amount over the budgeted amount. The FY19 budget shows expenses in two categories (office supplies and printing) that did not have funds allocated to them. At the end of the year, negative balances are reconciled with lines that have a positive balance. For the past several years the department has been able to operate within the overall budget while providing outstanding experiences for students and supporting faculty and community partners (field placement sites). Specific expenses in each of the categories where significant expenditures occurred in this fiscal year are noted below:Salaries PT Student: This line is for hiring a student assistant for the department. We had an assistant for part of the semester, but she was not able to continue due to her scheduling issues, which is why the expenditures are small. Unspent funds from this line c
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[9][a].supportingEvidenceText`_

##### Evidence text 1 — conf 0.72, 113 words, `review_low_confidence`

_Source heading:_ **(table)**

```text
Date
Topics
Assignments
Week 1
Jan 28
Introduction: Syllabus & Professor
Social Science Research: An Overview
What is research?
Planning your research
Avoiding Plagiarism
Finlay Intro
Also, on Blackboard
http://stevenson.libguides.com/jumpstart?p=264212
Getting Started in Research
Sections 2.1 and 2.2
https://saylordotorg.github.io/text_research-methods-in-psychology/s06-getting-started-in-research.html
Plagiarism
http://stevenson.libguides.com/plagiarism
Copyright for Students
http://stevenson.libguides.com/copyrightforstudents
Paraphrasing
http://stevenson.libguides.com/CHS210?p=854317
Week 2
Feb 4
Selecting a Topic: Reviewing the Literature
Literature review
Using the SU Library resources
Evaluating sources
Research Methods
Section 2.3
https://saylordotorg.github.io/text_research-methods-in-psychology/s06-getting-started-in-research.html
Critical Reading
http://www.writing.utoronto.ca/advice/reading-and-researching/critical-reading
Literature Review
http://stevenson.libguides.com/CHS210?p=1442457
Evaluating Sources
http://stevenson.libguides.com/CHS210?p=854463
Week 3
Feb 11
Ethics in Social Research
NOHS Ethical Standards
ACA Ethics Code
1
st
Exam Feb 15
Assignment I - Topic Due
Research Ethics
https://saylordotorg.github.io/text_research-methods-in-psychology/s07-research-ethics.html
NOHS Ethics
http://www.nationalhumanservices.org/ethical-standards-for-hs-professionals
ACA Ethics
http://www.counseling.org/knowledge-center/ethics/code-of-ethics-resources
```

##### Evidence text 2 — conf 0.52, 52 words, `review_low_confidence`

_Source heading:_ **This award is presented annually to two students who demonstrate academic excellence and a strong commitment to the fiel**

```text
This award is presented annually to two students who demonstrate academic excellence and a strong commitment to the field of human services.  The recipients, accompanied by Human Services Department faculty, attend a national conference for professionals in human services.  Upon their return, they disseminate information about their experience to the Stevenson community.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No faculty roster or FTE allocations provided; narrative does not specify number of full-time/part-time faculty positions, their qualifications, or stability of staffing
- ⚠️ No staff positions listed (administrative, clerical, advisors); narrative mentions only a student assistant whose role is incomplete
- ⚠️ Budget is extremely limited ($8,683.89) and declining year-over-year; no analysis of whether this level of funding is sufficient to operate a baccalaureate program
- ⚠️ No explanation of how faculty are compensated or funded (salary lines absent from budget); the budget shows only discretionary/operating expenses
- ⚠️ No evidence that funding is 'ongoing and stable'—narrative explicitly states budget has been 'decreasing for the past few years'
- ⚠️ Missing information on dedicated program administration/leadership support
- ⚠️ Supporting evidence [Evidence 1] is a course syllabus/schedule (irrelevant to budget/staffing) and [Evidence 2] is about a student award, neither of which demonstrates program support
- ⚠️ No multi-year budget trend analysis or projections demonstrating sustainability

---

### `9.b` 🟡 — Program Support

**Spec prompt:** _Describe how program and field experience coordination is considered in calculating the teaching loads of faculty. It is recommended that consideration be given to distance between sites, expectations of observation, documentation requirements, number of students enrolled in the field experience, and the characteristics of the student population._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[9][b].content`_

##### Narrative 1 — 🟢 conf 0.98, 296 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses the specification's prompt to describe how program and field experience coordination is considered in calculating teaching loads, with specific discussion of distance between sites, observation and documentation requirements, and number of students supervised.

```text
Describe how program and field experience coordination is considered in calculating the teaching loads of faculty. It is recommended that consideration be given to distance between sites, expectations of observation, documentation requirements, number of students enrolled in the field experience, and the characteristics of the student population.Table of ContentsResponse:Full-time faculty members maintain a twelve credit teaching load per semester.  The Department Chair is released from teaching two courses during the Fall semester and two courses during the Spring semester in order to fulfill the responsibilities of the Department Chair as described in Standard 7.University faculty members responsible for field placements include the University Supervisors and the Field Placement Coordinator.  University Supervisors are adjunct faculty who provide supervision for students in their practicums. These supervisors receive payment based upon the number of students supervised (3-4 students = 1 credit hour), which we (and the supervisors) believe is a reasonable load given the expected observation and documentation requirements.  Distance is a consideration when assigning University Supervisors to students placed at particular sites. See Responsibilities of University Supervisor for Field Placements.The Field Placement Coordinator is a full time faculty member, Dr. Finkenberg who receives a one course equivalency to develop relationships with and visit new agencies, liaise with directors of agencies used previously, conduct classroom and individual meetings with all prospective interns and practicum students, determine and approve eligibility of students for field placements, and ensure appropriate placement assignments for all interns and practicum students. During both Fall and Spring semesters, the Field Placement Coordinator teaches CHS 440 Practicum as part of the teaching load. So teaching responsibilities for the Field Placement Coordinator are: Fall Semester      
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[9][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence of how distance between sites is systematically considered in calculating teaching loads—only mentioned as 'a consideration' without detail on implementation
- ⚠️ Expectations of observation are not quantified or described (frequency, duration, or intensity of required supervision visits)
- ⚠️ Documentation requirements are referenced but never specified or linked to workload calculation
- ⚠️ Number of students enrolled in field experience is addressed only for adjunct supervisors (3-4 = 1 credit); no analysis of how this scales or impacts full-time faculty load
- ⚠️ Characteristics of student population (e.g., at-risk students, first-generation, diverse needs) are not mentioned or considered in load calculations
- ⚠️ No supporting evidence provided (job descriptions, load calculation worksheets, supervision visit logs, or agency distance data)
- ⚠️ The Field Placement Coordinator's load appears heavy (3 courses + CHS 440 practicum + CHS 380 + coordination duties); no justification for whether the 1-course equivalency adequately accounts for all coordination responsibilities

---

### `9.c` 🔴 — Program Support

**Spec prompt:** _Describe how the program has adequate professional support staff to meet the needs of students, faculty, and administration._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[9][c].content`_

##### Narrative 1 — 🟢 conf 0.92, 80 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly describes professional support staff (receptionists, administrative assistant, marketing staff) meeting the needs of students, faculty, and administration, matching Standard 9.c specification language exactly.

```text
Describe how the program has adequate professional support staff to meet the needs of students, faculty, and administration.Table of ContentsResponse:Secretarial support for faculty members and for the program is provided by the University receptionists as well as the School of Humanities and Social Sciences’ Administrative Assistant, who has been particularly helpful with producing departmental materials, such as handbooks, certificates, and invitations. The departmental brochure is produced by staff in the Marketing and Digital Communications Department.  Their assistance is greatly appreciated.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[9][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence of adequacy: narrative makes no claim that support staff are 'adequate' in number, qualifications, or capacity to meet needs
- ⚠️ No assessment of student support needs: missing discussion of how student support needs are identified or whether current staffing meets them
- ⚠️ No assessment of faculty support needs: missing discussion of how faculty support needs are identified or whether current staffing meets them
- ⚠️ No assessment of administrative support needs: missing discussion of how administrative support needs are identified or whether current staffing meets them
- ⚠️ No staffing structure/organization chart: no documentation of reporting lines, roles, responsibilities, or FTE allocations
- ⚠️ No supporting evidence provided: narrative is entirely unsupported by documentation (job descriptions, organizational charts, needs assessments, staffing plans, or budget allocations)
- ⚠️ Vague role descriptions: 'particularly helpful' and 'greatly appreciated' do not substantiate adequate capacity or coverage
- ⚠️ No identification of gaps or future planning: no discussion of whether current staffing is sufficient or if gaps exist

---

### `9.d` 🔴 — Program Support

**Spec prompt:** _Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[9][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 314 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses the specification language 'adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration' by detailing computing facilities, classroom technology, library resources, and office infrastructure.

```text
Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.Table of ContentsResponse:Technological/Computer Resources Considerable resource support for the program is available through the library, technology, computer labs, classroom technology, and tech support.Stevenson University has 471 computers located in 26 computer labs/spaces across all campus areas. This includes ten Macintosh Labs with a total of 138 Mac’s. The computer lab in the Greenspring library (LRC) accommodates 29 users.  See list of computing facilities.In addition to the computer in each faculty member's office, faculty members have access to computers in every classroom for teaching. Every computer on campus has access to the internet, to the library, and to the campus e-mail system. Through the Library web site, students and faculty can access numerous electronic resources and databases, including program-specific research guides. Videos are available for classroom presentations through Kanopy, a library resource.Every full-time faculty member has a private office which is equipped with a desk, file cabinet(s), telephone, computer, and monitor. Part-time faculty members share office space, desks, and computers.  Additional equipment can be requested through the Facilities Office.Classroom space consists of 42 classrooms, 15 seminar rooms, 1 photography classroom, 1 photo lab, 1 graphic studio, 2 art studios, and 7 science labs. Every classroom has an instructor PC, a permanently mounted video projection system, high speed internet access, and a screen.  Classrooms are typically in excellent 	condition and are maintained by a proficient facilities staff.Library ResourcesThe Stevenson University Library provides comfortable spaces to meet, quiet places to work and study, publicly accessible computers, a wide variety of information resources, and research assistance so users can make the best use of 
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.68, 69 words, `review_low_confidence`

_Source heading:_ **The Academic Link, nationally certified by the College Reading and Learning Association, serves as Stevenson University’**

_AI rationale:_ The section describes The Academic Link as an institutional resource providing tutoring and academic assistance to support student learning and success. This directly addresses Standard 9.d's requirement to describe adequate resource support (e.g., tutoring, academic assistance services) to meet student needs.

```text
The Academic Link, nationally certified by the College Reading and Learning Association, serves as Stevenson University’s tutoring and academic assistance center, offering free tutoring in most courses to all enrolled students.  Students work with dedicated peer and faculty tutors as a team to learn effective study strategies, increase understanding of course content, and become independent learners.  The Link’s web site (http://academiclink.stevensonuniversity.org/) lists many of the services and resources available.
```

##### Narrative 3 — 🟢 conf 0.88, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support available to students, which exemplifies adequate resource support (technology and library services) required by Standard 9.d Program Support.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 4 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section describes library resources (electronic, print, databases, tutorials, and professional support) that constitute adequate resource support for students, faculty, and administration, directly addressing Standard 9.d's specification on resource adequacy.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 5 — 🟡 conf 0.68, 80 words, `review_low_confidence`

_Source heading:_ **Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), pro**

_AI rationale:_ This section describes a specific resource support (the Academic Link tutoring facility and services) that enables students to meet their academic needs, directly addressing Standard 9.d's requirement to describe adequate resource support including technology and support services.

```text
Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), provides free tutoring for many classes. If you are having difficulty with or would benefit from discussing the material with an upper level peer, seek assistance early in the semester. Tutoring often makes a difference in a student’s grade. To view the tutoring schedule and sign up for an appointment, go to stevenson.go-redrock.com, visit the Link in person, or call 443-394-9300.
```

##### Narrative 6 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support available to students, matching Standard 9.d's specification for adequate resource support (library, technology, etc.) to meet student needs.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 7 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support staff available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support including library services.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 8 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section describes library resources, electronic databases, and professional support services available to students, directly addressing Standard 9.d's requirement to describe adequate resource support (library, technology) to meet student needs.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 9 — 🟢 conf 0.92, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ This section directly describes library resources, databases, and professional support available to students, which is concrete evidence of adequate resource support (library resources specifically mentioned) under Standard 9.d Program Support.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 10 — 🟢 conf 0.92, 65 words, `auto_accept`

_Source heading:_ **SU Library- The SU Library provides extensive electronic and print resources to support your coursework. Research Guides**

_AI rationale:_ The section directly describes library resources (electronic and print), databases, and professional support services available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support including library resources to meet student needs.

```text
SU Library- The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 11 — 🟢 conf 0.88, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library and electronic resources available to support student coursework, which matches Standard 9.d's requirement to describe adequate resource support (library resources specifically cited). While information literacy is mentioned in Standard 14.d, the primary content is institutional resource provision rather than student skill development.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 12 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional librarian support available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support (including library) to meet student needs.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 13 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support services available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support (library, technology, etc.) to meet student needs.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 14 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ This section directly describes library resources and support services available to students, which exemplifies the 'adequate resource support' requirement in Standard 9.d. While information literacy is tangentially relevant, the primary content is about institutional resource provision.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 15 — 🟢 conf 0.88, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, databases, technology, and professional support services available to meet student, faculty, and administrative needs, which aligns precisely with Standard 9.d's requirement to describe adequate resource support including library services.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Narrative 16 — 🟢 conf 0.89, 63 words, `auto_accept`

_Source heading:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ This section directly describes library and electronic resource support available to students, matching Standard 9.d's requirement to describe adequate resource support including library resources to meet student needs.

```text
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

#### Supporting evidence — text
_Destination: `Submission.narratives[9][d].supportingEvidenceText`_

##### Evidence text 1 — conf 0.92, 66 words, `auto_accept`

_Source heading:_ **SU Library - The SU Library provides extensive electronic and print resources to support your coursework. Research Guide**

```text
SU Library - The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary
```

##### Evidence text 2 — conf 0.68, 80 words, `review_low_confidence`

_Source heading:_ **Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), pro**

```text
Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), provides free tutoring for many classes. If you are having difficulty with or would benefit from discussing the material with an upper level peer, seek assistance early in the semester. Tutoring often makes a difference in a student’s grade. To view the tutoring schedule and sign up for an appointment, go to stevenson.go-redrock.com, visit the Link in person, or call 443-394-9300.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ LLM returned non-JSON response

---

### `9.e` 🟡 — Program Support

**Spec prompt:** _Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[9][e].content`_

##### Narrative 1 — 🟢 conf 0.98, 240 words, `auto_accept`

_Source heading:_ **e.**

_AI rationale:_ The section directly addresses the exact language of Standard 9.e, describing office spaces (faculty private offices), classroom facilities, meeting spaces (conference rooms, faculty lounge), and informal gathering spaces (lounge areas, Learning Commons) and how they meet student, faculty, and administration needs.

```text
Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration.Table of ContentsResponse:Stevenson University has two campuses. The original campus is located in Stevenson, Maryland, and the second is in Owings Mills, Maryland, about a 12 minute drive with free shuttle service connecting the campuses.  Program offices, staff support, and full-time human services faculty are housed on the Owings Mills (North) Campus. In addition, almost all Program courses are taught on the Owings Mills Campus.  Consequently, the descriptions contained herein are related to the Owings Mills campus. Every full-time faculty member has a private office which is equipped with a desk, file cabinet(s), telephone, 	computer, and 	monitor.  The program has access to two large conference rooms overseen by the School of the Sciences, a spacious faculty lounge, and a workroom/mailroom with a printing/scanning/copying machine.  Students have numerous areas for academic study at tables located near departmental offices and in the Learning Commons (part of the library system) on the third floor of the Manning Academic Center. Several computer labs are available. Classrooms are equipped with technology and equipment permitting the use of PowerPoint, projected computer displays, videos, overheads, audios, and large dry-erase boards. Classrooms for semester use are always available with adequate and comfortable seating for students.Lounge areas are available for both faculty and students.  In addition, the University maintains two cafeterias, other food hubs, gyms, physical fitness equipment, and other amenities.
```

##### Narrative 2 — 🟡 conf 0.72, 85 words, `review_low_confidence`

_Source heading:_ **Classrooms seem to be working effectively, despite a few adjustments. Students (and faculty) are finding their way aroun**

_AI rationale:_ The narrative directly addresses classroom spaces, physical facilities (new building), and informal gathering spaces (bulletin board outside faculty offices) and how they are being utilized by students and faculty, matching Standard 9.e's prompt to describe office, classroom, and informal gathering spaces and their adequacy.

```text
Classrooms seem to be working effectively, despite a few adjustments. Students (and faculty) are finding their way around the new building. We discussed use of OneDrive to access, store and download/upload files. John asked if there were supply needs, since we need to get our own now (Carol mentioned gradebooks). We discussed ideas for the bulletin board outside of faculty offices – ideas included: current events “In the News”, a list of field placement and employment sites, Ecuador pictures and other pictures of departmental events.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[9][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[9][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No description of how meeting spaces specifically meet the needs of students, faculty, and administration—only that they exist
- ⚠️ No evidence of informal gathering spaces or how they support student/faculty community
- ⚠️ No assessment of whether office, classroom, and meeting spaces are adequate in quantity or quality relative to program enrollment
- ⚠️ No mention of accessibility features or accommodations in any spaces
- ⚠️ No discussion of how spaces support faculty-student interactions, mentoring, or advising
- ⚠️ No supporting evidence (photos, floor plans, utilization data, surveys) provided to substantiate claims
- ⚠️ Narrative includes irrelevant details (shuttle service, cafeterias, gyms) not central to program spaces
- ⚠️ Casual mid-narrative discussion about OneDrive and supply needs undermines professional tone and clarity
- ⚠️ No explicit connection between space features and how they meet administration's operational needs

---

## Standard 10

### `10.a` 🔴 — Evaluation of Transfer Credits and Prior Learning

**Spec prompt:** _Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning._

**Final coverage verdict:** covered=**False**, score=**0.25**
_(first-pass: covered=False, score=0.25; second-pass after gap-fill: covered=False, score=0.25, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[10][a].content`_

##### Narrative 1 — 🟡 conf 0.72, 55 words, `review_low_confidence`

_Source heading:_ **70 credits that will be accepted by Stevenson University toward degree requirements. An appropriate score is determined **

_AI rationale:_ The section describes formal policies and procedures for transfer of credits and evaluation of prior learning (e.g., which credits transfer, which do not, and how students must submit documentation), directly addressing Standard 10.a's requirement to describe transfer and prior learning evaluation processes.

```text
70 credits that will be accepted by Stevenson University toward degree requirements. An appropriate score is determined by Stevenson University, and the student must submit original test scores/results to Stevenson University.  Tech Prep credits will not transfer. Credit awarded for experiential learning ("life experience") is not recognized by, and is not transferrable to, Stevenson University.
```

##### Narrative 2 — 🟡 conf 0.68, 58 words, `review_low_confidence`

_Source heading:_ **The agreement may be terminated by either party for due cause and after adequate notice to the other.  Termination of th**

_AI rationale:_ The section describes policies governing transfer of credits and articulation agreements between institutions, which directly addresses Standard 10.a's requirement for formal policies and procedures for transfer of credits. The mention of student credit transfer upon program termination is a procedural safeguard related to transfer policy.

```text
The agreement may be terminated by either party for due cause and after adequate notice to the other.  Termination of the agreement will not affect any students currently enrolled at The Community College of Baltimore County in the Human Services major at the time of termination, and they shall be able to transfer credits pursuant to this agreement.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[10][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[10][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No description of formal policies and procedures for transfer credit evaluation process (e.g., who evaluates, timeline, criteria, documentation required)
- ⚠️ No explanation of how prior learning is assessed or evaluated (methods, rubrics, responsible parties)
- ⚠️ No detail on what constitutes 'appropriate score' for transfer credits or how equivalencies are determined
- ⚠️ No information on appeal or grievance procedures for denied transfer credits
- ⚠️ No description of how transferred credits are applied to degree requirements (e.g., general education, major, electives)
- ⚠️ No explanation of GPA requirements, minimum grades needed for transfer, or grade replacement policies
- ⚠️ No supporting evidence provided (policies, procedures documents, articulation agreements, evaluation forms, etc.)
- ⚠️ Narrative only addresses articulation agreement specifics, not institutional transfer policies broadly
- ⚠️ No mention of how students are informed of transfer credit decisions or transcript documentation

---

### `10.b` 🟢 — Evaluation of Transfer Credits and Prior Learning

**Spec prompt:** _Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE_

**Final coverage verdict:** covered=**True**, score=**0.82**
_(first-pass: covered=True, score=0.82; second-pass after gap-fill: covered=True, score=0.82, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[10][b].content`_

##### Narrative 1 — 🟢 conf 0.89, 68 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly describes how students receive information about articulation agreements and transfer of credits, which matches Standard 10.b's requirement to 'Describe how students receive this information' in the context of evaluation of transfer credits and prior learning.

```text
Describe how students receive this information.Table of ContentsResponse: Students receive information about all articulation agreements from the Program’s website under the Tracks and Minors tab and on the college website.  All admissions and recruitment events include information about transfer of courses. Information about the graduate program articulation agreement is in the CHS Student Handbook (p. 15) and is given to students in CHS 380 and in CHS 441.
```

##### Narrative 2 — 🟢 conf 0.92, 669 words, `review_letter_disagrees`

_Source heading:_ **a.**

_AI rationale:_ The section directly describes formal policies and procedures for transfer of credits (regional accreditation, grade requirements, course equivalencies, CLEP, IB) and evaluation of prior learning (internship waiver with portfolio/recommendation documentation), which aligns precisely with Standard 10.b's requirement to describe how students receive transfer and prior learning credit information.

```text
Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning.Table of ContentsResponse: Transfer credits from other regionally accredited colleges are accepted through the SU registrar’s office. Course equivalencies for Maryland colleges are determined through the ArtSys database and in consultation with the department chair. A grade of C or better is required for a course to transfer. The department chair makes determinations about what program requirements are fulfilled by transfer courses and substitutions may be made as appropriate. See formal articulation agreements below. One course in the Program, CHS 380 (Internship in Counseling & Human Services), may be waived if the student provides evidence of the successful completion of a minimum of two years full-time employment in a human services agency.  The student must submit the following documentation for approval:  (1) Professional Portfolio and (2) Letter of Recommendation from the supervisor at the agency. The documentation will be evaluated by the Department Chair and the Field Placement Coordinator.  No other required human services courses in the Program may be waived.The University participates in College Level Examination Program (CLEP), which allows students to take a CLEP exam to earn credits at Stevenson. The University grants credit to SU students earning Stevenson University designated passing scores on CLEP exams.  For further information regarding acceptable exams, please review the Stevenson University CLEP Manual available on the Transfer Credit Center page of the website under Credit by Examination.The University recognizes the International Baccalaureate Diploma Programme and will grant credit for scores of 5 or higher in the "Higher Level" courses only. Scores of 4 will be taken into consideration, but not automatically granted credit. No credit is given for courses taken at the subsidiary level or for courses that duplicate oth
… (truncated, full text imported)
```

##### Narrative 3 — 🟢 conf 0.92, 106 words, `auto_accept`

_Source heading:_ **The Human Services degree at AACC is considered a career program. Therefore, Human Services students who transfer to Ste**

_AI rationale:_ The section directly addresses how transfer credits from an external institution (AACC) are evaluated and applied toward degree requirements at the receiving institution (Stevenson University), which is the core substance of Standard 10.b on Evaluation of Transfer Credits and Prior Learning.

```text
The Human Services degree at AACC is considered a career program. Therefore, Human Services students who transfer to Stevenson University will have their coursework evaluated on a course-by-course basis to determine which of the Stevenson University education requirements and discipline requirements have been met. By taking full advantage of the AACC-Stevenson University course agreements outlined below, the transfer student may matriculate at junior standing. Further, this agreement allows the student who has obtained an A.A.S. degree in Human Services from AACC and who has enrolled in the Human Services major at Stevenson University to apply up to 70 transfer credits to required components of the major.
```

##### Narrative 4 — 🟡 conf 0.82, 61 words, `review_low_confidence`

_Source heading:_ **If students transfer 6 credits (CHS 515 and CHS 540) and complete EDU 550 during their senior year, they will be able to**

_AI rationale:_ The section describes policies and procedures for how transfer credits are evaluated and applied toward program completion, directly addressing Standard 10.b's requirement to describe how students receive information about transfer credit evaluation and prior learning assessment.

```text
If students transfer 6 credits (CHS 515 and CHS 540) and complete EDU 550 during their senior year, they will be able to complete McDaniel College's Master's Program in Human Services Management:  Special Education in 1 year (6 credits-summer; 9 credits-fall, and 9 credits-spring).  Only courses in which the student earns a grade of “B” or better are eligible for transfer.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[10][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[10][b].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 278 | 0.72 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ No description of HOW or WHEN students receive transfer credit evaluation information (e.g., during orientation, advising sessions, in writing)
- ⚠️ Missing timeline for transfer credit decisions and how long evaluation takes
- ⚠️ No explanation of how students are informed of credit denials or partial credit awards
- ⚠️ Lacks detail on who specifically communicates transfer decisions to students (registrar, advisor, department chair)
- ⚠️ No mention of appeals process if students disagree with transfer credit evaluation
- ⚠️ CLEP and IB credit procedures described but no detail on how students are informed of these options or results
- ⚠️ Prior learning evaluation (CHS 380 waiver) criteria are clear, but process for student notification of approval/denial is not described

---

## Standard 11

### `11.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The historical roots of human services as a discipline and a profession._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[11][a].content`_

##### Narrative 1 — 🟢 conf 0.91, 195 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly addresses the historical roots of human services as a discipline and profession through course coverage and assignments, matching the exact language of Standard 11.a. The narrative documents how multiple courses (CHS 105, 224, 430, 380, 440/441) teach this foundational knowledge.

```text
The historical roots of human services as a discipline and profession.Response: The historic roots of human services are covered in CHS 105 Human Services and Social Policy through in-class activities, discussion, lecture, and assigned reading (see Course Schedule; week 2 is devoted to the history of human services). In CHS 224 Research Methods and Writing, students read social science research articles that influenced the development of the human services field and create a detailed research proposal as a class assignment. In CHS 430 Family Dynamics and Interventions, students examine a variety of approaches to family therapy that have historically been utilized. Working in groups, they analyze each model and report to the class (see the course schedule and description of the group project). In the Field Placement courses, CHS 380 Internship includes in-class discussion following a journal assignment that requires students to become familiar with the historic roots of the agency at which they are completing their particular internships. Similarly, students in CHS 440 Practicum, learn about the history of the agency where they are completing their practicum and incorporate that into their poster presentations for CHS 441 Seminar at the end of the semester.
```

##### Narrative 2 — 🟡 conf 0.62, 65 words, `review_low_confidence`

_Source heading:_ **Program Revisions: A new professional development course has been created and will be offered in place of our profession**

_AI rationale:_ This section describes substantive changes to the curriculum structure—shifting course content and creating new courses—which belongs in Standard 11 (curriculum matrix or curriculum design narrative). While the candidates mention specific skill areas (portfolio, grant writing), the primary content is curriculum reorganization rather than a response to a specific knowledge/skill specification.

```text
Program Revisions: A new professional development course has been created and will be offered in place of our professional writing class. Some of the writing projects related to careers (resume, cover letter, portfolio) will be moved to this class. Other writing assignments (literature review, needs assessment, grant proposal narrative) will be incorporated into the research methods course, which will be become a writing intensive course.
```

##### Narrative 3 — 🟡 conf 0.72, 70 words, `review_low_confidence`

_Source heading:_ **The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  **

_AI rationale:_ The section describes how the curriculum incorporates theory, research, application, and field experience as core components, along with elective courses—directly addressing the curriculum design and structure required by Standard 11.a (Core Curriculum). The mention of field experience as 'crucial' and elective courses 'approved by faculty' supports curriculum composition narratives.

```text
The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  In addition to the required courses, students choose five focused electives that allow them to tailor their program to meet their individual needs and interests.  These electives are courses that have been approved by faculty members in the department as being relevant to a career in human services, but are not specific requirements.
```

##### Narrative 4 — 🟡 conf 0.68, 70 words, `review_low_confidence`

_Source heading:_ **The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  **

_AI rationale:_ The section describes curriculum design incorporating theory, research, application, field experience, and elective choice—core elements of Standard 11.a (curriculum content and structure). The mention of field experience as 'crucial' and electives tailored to individual needs aligns with curriculum composition expectations in the current spec.

```text
The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  In addition to the required courses, students choose five focused electives that allow them to tailor the program to meet their individual needs and interests.  These electives are courses that have been approved by faculty members in the program as being relevant to a career in human services but are not program requirements.
```

##### Narrative 5 — 🟡 conf 0.72, 53 words, `review_low_confidence`

_Source heading:_ **Identify the study population, the population to whom your findings would apply.  Explain how you would collect data for**

_AI rationale:_ This section describes research methodology (study population, data collection technique, sampling strategy, sample size) which aligns with Standard 11.a's requirement to demonstrate assessment methodology and research design. While 1.e addresses student demographics, the content here is procedural/methodological rather than descriptive of enrollment.

```text
Identify the study population, the population to whom your findings would apply.  Explain how you would collect data for your proposed study, identifying your technique by name. State how you would select your sample, the sample selection technique you would use, how you would meet selection requirements, if any, and your sample size.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[11][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][a].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 273 | 0.72 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |
| 2 | (data table) | `data-table` | 274 | 0.72 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Curriculum matrix cells
_Destination: `CurriculumMatrix.cells[]`_

- matrix: `(curriculum matrix table)`, col -1, code `(see matrix extractor)`, types [], depth `—`
- matrix: `(data table)`, col -1, code `(see matrix extractor)`, types [], depth `—`
- matrix: `(data table)`, col -1, code `(see matrix extractor)`, types [], depth `—`
- matrix: `Baccalaureate Degree Level 2018Instructions: Use as many versions of the Matrix `, col -1, code `(see matrix extractor)`, types [], depth `—`

#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence that CHS 105 course schedule actually includes Week 2 history content—course schedule provided (Evidence 2) does not show CHS 105 and begins with unrelated topics (Problem-Management Process, Service Learning)
- ⚠️ Missing syllabus or detailed curriculum map showing where historical roots are explicitly taught across the named courses (CHS 105, 224, 430, 380, 440, 441)
- ⚠️ No student learning outcome data, assignments, or assessments demonstrating students actually learned the historical roots of human services
- ⚠️ Narrative mentions that CHS 224 students 'read social science research articles that influenced the development of the human services field' but provides no evidence or reading list
- ⚠️ Vague reference to 'in-class discussion' and 'journal assignments' about agency history in field placement courses—no actual assignment prompts, rubrics, or student work provided
- ⚠️ The narrative includes unrelated text about research study design (population, sampling, data collection) that does not address the specification
- ⚠️ No evidence of how elective courses contribute to understanding historical roots
- ⚠️ Missing documentation of program revisions' impact on teaching historical content

---

### `11.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Historical and current legislation impacting human service delivery._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[11][b].content`_

##### Narrative 1 — 🟢 conf 0.96, 297 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses historical and current legislation impacting human service delivery across multiple courses (CHS 101, 105, 224, 340, 430, and field placements), which is the exact language and focus of Standard 11.b.

```text
Historical and current legislation affecting services delivery.Response: Historical and current legislation affecting services delivery is addressed in CHS 101 Family Studies through discussion, media presentation, lecture, and assigned reading specifically regarding family structure and the legislation that affects it. This issue is addressed briefly in most chapters, but see specifically 3/28 “Issues in Contemporary U.S. Families” and 4/4 “Economy and Family Life” in the course schedule. CHS 105 Human Services and Social Policy addresses this issue through reading, lecture, and discussion, particularly in Week 2, which includes coverage of Great Society programs, welfare reform and related topics.CHS 224 Research Methods and Writing  includes an exploration of research studies assessing the need for services and the effectiveness of interventions, which influence legislation.  This is addressed through lecture, discussion, and assigned reading.CHS 340 Administration of Human Services covers legislation that affects service delivery indirectly through its influence on how agencies are administered and managed. For example, a unit on hiring includes legal issues governing this process (see course schedule) and a unit and assigned project on seeking resources (Course Requirement #6) covers legislation regarding fund-raising and finances (course schedule). CHS 430 Family Dynamics and Interventions examines legislation affecting service delivery through a group project where student groups analyze in-depth different models of family therapy, both current and historical. The analysis includes legislative issues affecting each approach (see the Group Project assignment for detail and a list of the models covered).Legislation affecting service delivery is also addressed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students become familiar with the legislative issues affecting their particular agency. This is often a topi
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[11][b].supportingEvidenceText`_

##### Evidence text 1 — conf 0.62, 317 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Topics Covered
Required Readings
Due
Week 1
Aug 28 &30
COURSE OVERVIEW, FOUNDATIONAL CONCEPTS
Piliavin, 2009 Altruism and Helping.pdf
Week 2
Sept 4 & 6
THE HISTORY OF HELPING and MODERN DAY HUMAN SERVICES
ROLES AND FUNCTIONS OF HUMAN SERVICE WORKERS
DiGiovanni-CSHSE_Legacy.pdf (pp 9-14);
Kincaid, 2009 -four essential components of CHS.pdf
Week 3
9/11, 9/13
MACRO-LEVEL PRACTICE
The Community Tool Box (weblinks on BB)
SEPT 11- Quiz 1
Week 4
9/18, 9/20
ASSESSING THE NEEDS OF THE COMMUNITY
The Community Tool Box and
Conducting a Needs Assessment
Meet in library computer lab
Week 5
9/25, 9/27
WORKING WITH INDIVIDUVAL AND FAMILIES: THEORETICAL PERSPECTIVES
Mehr, Chapter 6 (pp 102-110 only)
Mehr Chapter 8
SEPT 27- Community Needs Assessment Action Plan – Questions due
Week 6
10/2, 10/4
WORKING WITH INDIVIDUVAL AND FAMILIES: THEORETICAL PERSPECTIVES
Mehr, Chapter 7 (March 1)
10/4- Review and “catch-up” day
OCT 2- Quiz 2
OCT 4- Annotated Bibliography
10/9
FALL BREAK
NO CLASS
Week 7
10/11
Mid Term EXAM
Mid Term Exam
Week 8
10/16, 10/18
THE SKILLS OF HELPING- CASEMANAGMENT AND SOFT SKILLS
Bogo (2006) pp. 123-130 and 137-140
Burnard (1999) pp. 48-54
OCT 18- Team Role Preference Scale
Week 9
10/23, 10/25
ISSUE-SPECIFIC SOCIAL POLICY
Reading TBD
Week 10
10/30, 11/1
ISSUE SPECIFIC SOCIAL POLICY
Reading TBD
OCT 30- Quiz 3
Week 11
11/6, 11/8
TRAUMA INFORMED CARE AND CRISIS INTERVENTION
Miller Najavits 2012- Trauma informed care in correctional facilities.pdf
Week 12
NOV 13 & 15
Individual and
… (truncated, full text imported)
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No specific legislation is named or discussed in the narrative or evidence (e.g., ADA, HIPAA, FERPA, Social Security Act, Medicaid, specific welfare reform laws). The specification requires knowledge of 'historical and current legislation' but only generic references to 'legislation' and 'legal issues' are provided.
- ⚠️ Supporting evidence (course schedule) is incomplete and truncated—Week 9-10 'ISSUE-SPECIFIC SOCIAL POLICY' readings are marked 'TBD,' making it impossible to verify what legislation is actually assigned or covered.
- ⚠️ CHS 101 'legislation affecting family structure' is mentioned but no specific family law examples are provided in evidence; course schedule excerpt does not include the cited 3/28 or 4/4 dates.
- ⚠️ CHS 105 reference to 'Great Society programs, welfare reform' is plausible but no syllabus, reading list, or assignment details provided as corroborating evidence.
- ⚠️ Field placement courses (CHS 380, 440, 441) are claimed to address legislation 'affecting their particular agency' but no evidence demonstrates systematic, structured coverage of federal/state legislation (e.g., through assignments, discussion guides, or assessment rubrics).
- ⚠️ No evidence of assessment or learning outcomes demonstrating students can identify, analyze, or apply specific legislation to human service contexts.

---

### `11.c` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _How public and private attitudes influence legislation and the interpretation of policies related to human services._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[11][c].content`_

##### Narrative 1 — 🟢 conf 0.98, 332 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section's narrative directly addresses how public and private attitudes influence legislation and policy interpretation—the exact language of Standard 11.c. The response demonstrates this competency across multiple courses (CHS 101, 105, 224, 340, 430, and field placements) with specific examples.

```text
How public and private attitudes influence legislation and the interpretation of policies related to human services.Response: There is an emphasis on how public and private attitudes influence legislation and the interpretation of policies related to human services in CHS 101 Family Studies throughout the course as the factors influencing various aspects of family are explored through discussion, media presentation, lecture, and assigned reading. For example, the interpretation of laws related to same-sex couples, divorce and remarriage and work and family life are considered. The issue is addressed most directly and deeply in the unit on “Issues in Contemporary U.S. Families” (see course schedule). CHS 105 Human Services and Social Policy addresses this issue through reading, lecture, and discussion, particularly in the units on macro-level practice and social policy issues, which include detailed discussion of public attitudes towards helping(see course schedule).CHS 224 Research Methods and Writing includes discussions about how research on social issues is influenced by public and private attitudes and legislation (see week 2 in course schedule).  This is addressed through lecture, discussion, and assigned reading.CHS 340 Administration of Human Services covers the influence of public and private attitudes on legislation and policy through a variety of administrative issues. For example, see the unit on “Working with a Board” in course schedule. CHS 430 Family Dynamics and Interventions examines the influence of public and private attitudes on legislation and policy through a group project where student groups analyze in-depth different models of family therapy, both current and historical. The analysis includes legislative issues affecting each approach (see the Group Project assignment for detail and a list of the models covered).This issue is also addressed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that studen
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[11][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, course schedules, or rubrics) to verify that the described content actually exists and is taught as claimed
- ⚠️ Narrative lacks specific examples of how attitudes influence legislation outcomes (e.g., does a course show how public opposition shaped welfare reform, or how private sector interests affected healthcare policy?)
- ⚠️ No demonstration of student learning outcomes or assessment data showing students can actually analyze the relationship between attitudes and policy interpretation
- ⚠️ Vague reference to 'Issues Presentation project' and 'Poster Presentations' without evidence of what these assignments require or assess
- ⚠️ Insufficient detail on the depth of coverage in CHS 224 (Research Methods) regarding attitude-legislation influence—appears to be minimal ('week 2 discussion')
- ⚠️ No evidence that students engage with competing or conflicting attitudes and their differential impacts on policy
- ⚠️ Field placement courses (CHS 380, 440, 441) described as addressing the topic indirectly through student experience, but no required assignment framework shown to ensure systematic coverage

---

### `11.d` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs._

**Final coverage verdict:** covered=**False**, score=**0.65**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.65, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[11][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 317 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The narrative directly addresses how broader sociopolitical issues (systems of governance and economics) affect human service systems across multiple courses and field placements, matching the current Standard 11.d specification on sociopolitical context within Human Systems Context knowledge.

```text
The broader sociopolitical issues that affect human service systems.Response: Sociopolitical issues, including systems of governance and economics, are addressed in CHS 101 Family Studies, particularly as they relate to family issues through historical, national, and cultural contexts. Learning is accomplished through in-class activities, discussions, media presentations, lectures, and assigned readings. Sociopolitical issues are also integrated throughout  CHS 105 Human Services and Social Policy, particularly as they relate to the emergence of human services systems and the unit on Social Policy and Intervention (see course schedule).CHS 224 Research Methods and Writing includes discussions about how research on social issues is influenced by government and economic systems (see week 2 in course schedule).  This is addressed through lecture, discussion, and assigned reading.CHS 340 Administration of Human Services covers the influence of government and economic policies on a variety of administrative issues. For example, a unit on hiring includes legal issues governing this process (see course schedule) and a unit and assigned project on seeking resources (Course Requirement #6) covers both governmental (grants) and economic issues (course schedule). Government and economic systems and their relationship to family dynamics are covered in CHS 430 Family Dynamics and Interventions through a group project where student groups analyze different models of family therapy. The analysis includes how each approach fits within government and economic systems (see the Group Project assignment for detail and a list of the models covered). Differences between systems of governance and economics is also addressed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students become familiar with the governmental and economic issues affecting their particular agency. These issues are often a topic in the Issues Presentation project and 
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 260 words, `review_letter_disagrees`

_Source heading:_ **f.**

_AI rationale:_ The section demonstrates how the program addresses diversity and its role in determining and meeting human needs across the human services curriculum, which aligns with Standard 11.d's requirement to understand broader sociopolitical issues affecting human service systems and the structure and dynamics of communities and society. The emphasis on cultural competence and diversity as context for und

```text
Emphasis on context and the role of diversity (including, but not limited to ethnicity, culture, gender, sexual orientation, learning styles, ability, and socio-economic status) in determining and meeting human needs.Response:Emphasis on context and the role of diversity (including, but not limited to ethnicity, culture, gender, sexual orientation, learning styles, ability, and socio-economic status) in determining and meeting human needs is provided throughout the Counseling & Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 101, 201, 220, 224, 315/515, 360, 340, 430, 380, 440 and 441.The role of diversity in determining and meeting human needs is the course topic in CHS 220 Diversity and Cultural Competence. This course explores the diversity of contemporary life styles.  The course examines the importance of cultural values for both individuals and their families.  It addresses what it means to be culturally competent as human services professionals when working with individuals of a different race, ethnicity, socio-economic status, religion, sexual orientation or other personal life style choices. (See CHS 220 syllabus)The role of diversity in determining and meeting human needs is emphasized in CHS 101 Family Studies (in-class activities, discussions, media presentations, lectures, and assigned readings), in CHS 105 Human Services and Social Policy (in-class activities, discussions, media presentations, lectures, and assigned readings), and CHS 441 (discussions and assigned readings). The role of diversity is also covered in PSY 101 and PSY 108 (discussions, lectures, and assigned readings), and SOC 101 (discussions, lectures, and assigned readings).
```

##### Narrative 3 — 🟡 conf 0.72, 287 words, `review_letter_disagrees`

_Source heading:_ **e.**

_AI rationale:_ The section documents curriculum content on political ideologies and their influence on human services systems, social policy, and organizational contexts—directly aligned with Standard 11.d on broader sociopolitical issues affecting human service systems. The secondary fit to 11.c reflects the explicit discussion of how political attitudes influence legislation and policy interpretation.

```text
Exposure to a spectrum of political ideologies.Response: Exposure to a spectrum of political ideologies occurs in each unit of CHS 101 Family Studies , but see particularly “Selecting a Partner”, “Diversity in Marriages and Familes”, and “Employment in Relationships” where different political perspectives on family policy are studied directly. In CHS 105 Human Services and Social Policy,  political ideologies are central to discussions of the historical roots of helping and social policy and intervention approaches, as well as many other units, which are covered through in-class activities, discussions, media presentations, lectures, assigned readings, and out-of-class assignments. See especially the assignment  “Issue Presentation and Report”. In addition, political ideologies and their influence on research are discussed in CHS 224 Research Methods and Writing. See particularly week 2 in course schedule on the foundations of social science research.Political ideologies and their relationship to family dynamics are covered in detail in CHS 430 Family Dynamics and Interventions through a group project where student groups analyze different models of family therapy. The analysis includes how each approach fits with different political ideologies (see the Group Project assignment for detail and a list of the models covered). Exposure to a spectrum of political ideologies also occurs in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students become familiar with political ideologies that affect their particular agency. These issues are often a topic in the Issues Presentation project and are included in Poster Presentations about the agencies at which students complete their practicums.Political ideologies, as they relate to the specific topics of the courses, are analyzed throughout the required non-major course SOC 101 Introduction to Sociology and covered tangentially in PSY 101 Introduction to Psychology.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[11][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[11][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided: syllabi, course schedules, assignments, or rubrics are referenced but not attached, making verification impossible
- ⚠️ Incomplete coverage of 'structure and dynamics of organizations': while government/economic systems are mentioned, organizational structure, culture, and internal dynamics are minimally addressed
- ⚠️ Limited evidence of 'dynamics of communities': narrative focuses heavily on families and governance systems but lacks explicit coverage of community-level structures and dynamics
- ⚠️ Vague coverage of 'nature of individuals and groups': the narrative emphasizes diversity characteristics but does not clearly demonstrate teaching of individual development, group behavior, or group dynamics theory
- ⚠️ Missing explicit connection between sociopolitical context and 'appropriate responses to human needs': the specification requires showing how understanding systems informs intervention decisions, but this causal link is not articulated
- ⚠️ Field placement courses (CHS 380, 440, 441) claimed to address this but no concrete evidence (student reflections, assignment descriptions, or learning outcomes) is provided
- ⚠️ Scope of 'broader sociopolitical issues' appears narrow: focuses primarily on government and economics, with limited attention to other systemic issues (healthcare systems, criminal justice, education systems, etc.)

---

## Standard 12

### `12.a` 🟢 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Theories of human development._

**Final coverage verdict:** covered=**True**, score=**0.78**
_(first-pass: covered=True, score=0.78; second-pass after gap-fill: covered=True, score=0.78, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][a].content`_

##### Narrative 1 — 🟢 conf 0.92, 264 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly addresses theories of human development across multiple required and elective courses (PSY 108, PSY 101, CHS 101, CHS 224, CHS 315/515, CHS 360, CHS 430, CHS 380, CHS 440, CHS 441), matching the explicit specification language 'Theories of human development' under Standard 12.a.

```text
Theories of human development.Response: Human development theory is the primary topic of PSY 108 Human Growth and Development. Human Development is introduced as a unit in PSY 101. Both are required courses in the major.Human development theory is included through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 101, 201, 224, 315/515, 360, 430, 380, 440 and 441.Human development theory is addressed in CHS 101 (see CHS 101 Family Studies syllabus, human development theories of Freud, Erikson, Piaget, and others are addressed as theoretical perspectives in the first chapter).Human development theory is addressed in CHS 105 Human Services and Social Policy through lectures and assigned readings (see course schedule).CHS 224 Research Methods and Writing covers theories of human development to the extent that these theories are the subject of social science research to determine their efficacy.CHS 315/515 Group Counseling and CHS 360 Counseling Strategies for Individuals are clinical skills courses that address stages of human development in the context of therapeutic interventions (group counseling and individual counseling, respectively). CHS 430 Family Dynamics and Interventions focuses specifically on the development of the family and the influence of the family on personal development. The Family of Origin project requires students to examine how their own family of origin has influenced their development. Students examine how different theoretical approaches to family therapy view development through the Group Project.Field Placement courses CHS 380 , CHS 440 and CHS 441 require students to understand the developmental context of the particular clients they work with at their agencies.
```

##### Narrative 2 — 🟢 conf 0.89, 52 words, `auto_accept`

_Source heading:_ **This course provides a lifespan perspective on the growth and development of humans from pre-conception until death. Thi**

_AI rationale:_ The section explicitly describes a lifespan course covering theories of human development across biological, cognitive, and socioemotional domains, with major theoretical approaches addressing innate and environmental factors—this directly aligns with Standard 12.a's specification of 'Theories of human development.'

```text
This course provides a lifespan perspective on the growth and development of humans from pre-conception until death. This course focuses on stability and change in the whole person, including the biological, cognitive, and socioemotional domains. This course presents major theoretical approaches to development that address innate factors, environmental influences, and their interactions.
```

##### Narrative 3 — 🟢 conf 0.92, 318 words, `auto_accept`

_Source heading:_ **Human Systems Context: The human services professional must have an understanding of the structure a**

_AI rationale:_ The section explicitly labels itself as addressing Standard 12 and demonstrates how knowledge and theory of human systems (individual, interpersonal, group, family, organizational, community, and societal) are included in the curriculum. This directly corresponds to Standard 12.a in the current spec, which addresses the foundational human systems context requirement.

```text
Human Systems Context : The human services professional must have an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs. Standard 12: The curriculum shall include knowledge and theory of the interaction of human systems including: individual, interpersonal, group, family, organizational, community, and societal. Specifications for Standard 12 Demonstrate how the knowledge, theory, and skills for each of the following specifications are included, analyzed, and applied in the curriculum: Theories of human development. T M I,T L T L I L I L ITKSH ITKSH ITKSH T L Small groups: Overview of how small groups are used in human services settings, Theories of group dynamics, and Group facilitation skills. I,K L KS H ITKSH ITKSH ITKSH KS M Changing family structures and roles. TK M I,K L ITKSH IS M ISTK M K M An introduction to the organizational structures of communities. I M I,K L ITK M ITKSH ITKSH K M An understanding of the capacities, limitations, and resiliency of human systems. T M I,K L TKS M K,M ITKSH ITKSH ITKSH K M Emphasis on context and the role of diversity (including, but not limited to ethnicity, culture, gender, sexual orientation, learning styles, ability, and socio-economic status) in determining and meeting human needs. T M I,K M K H TK M I L I L I,L ITKSH ITKSH ITKSH K M Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism. I L I,K M I L KS M KS H IK M ITKSH ITKSH K L Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. I,K M KS M KS H IT M ITKSH ITKSH
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][a].supportingEvidenceText`_

##### Evidence text 1 — conf 0.68, 51 words, `review_low_confidence`

_Source heading:_ **Arnett, J.J. (2016). Human development: A cultural approach (2nd Edition). New York: Pearson. Revell Access Code: Arnett**

```text
Arnett, J.J. (2016). Human development: A cultural approach (2nd Edition). New York: Pearson. Revell Access Code: Arnett  ISBN 0-13-461258-2. Loose Leaf Binding Version. Available at the campus book store for $122.50. e-Text version available online for less, just be sure you are buying the same ISBN number version of the eText.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][a].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 475 | 0.72 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence that students analyze or critically evaluate theories of human development—only exposure/coverage is demonstrated
- ⚠️ Missing evidence showing how theories are applied in practice settings; narrative mentions field placement courses (CHS 380, 440, 441) require 'developmental context' but provides no concrete assessment or application examples
- ⚠️ No evidence of explicit instruction in contemporary or culturally-informed developmental theories beyond traditional Western theorists (Freud, Erikson, Piaget); textbook description mentions 'cultural approach' but no supporting syllabi confirm this integration across the curriculum
- ⚠️ Lacks evidence of how students develop skills in assessing or intervening based on developmental theory; narrative describes coverage but not demonstration of competency
- ⚠️ Missing documentation showing how diversity factors (ethnicity, culture, gender, sexual orientation, ability, socioeconomic status) are integrated into the teaching of human development theories, despite Standard 12 requirement

---

### `12.b` 🟢 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills._

**Final coverage verdict:** covered=**True**, score=**0.75**
_(first-pass: covered=True, score=0.75; second-pass after gap-fill: covered=True, score=0.75, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][b].content`_

##### Narrative 1 — 🟢 conf 0.92, 499 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses all three components of Standard 12.b: overview of small groups in human services settings, theories of group dynamics, and group facilitation skills. The narrative maps course-by-course evidence to each of these three sub-specifications.

```text
Small groups: Overview of how small groups are used in human services settingsResponse: An overview of how small groups are used in human services settings is included through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 201, 315, 380, 430, 440 and 441.Use of small groups in human services settings is covered in CHS 315/515 Group Counseling as the fundamental topic of this course through in-class activities, discussions, media presentations, lectures, assigned readings, and out of class assignments; see CHS 315/515 syllabus. This course investigates basic elements of group process and practice. The application of course material to specific groups is highlighted.Use of small groups in human services settings is also covered in CHS 105 Human Services and Social Policy (discussions, media presentations, lectures, assigned readings, and out of class assignments; see “Team Research Assignment”).  Use of small groups in human services settings is covered throughout CHS 380 Internship (discussions, in-class activities) and CHS 430 Family Dynamics and Interventions (in-class activities, discussions, media presentations, lectures, assigned readings, and out of class assignments).  In both CHS 380 and 430, students participate in an in-class activity involving the formation of small groups and the subsequent analysis of each group’s dynamic (see Group Project in CHS 430).  CHS 441 Seminar addresses use of small groups in discussions and is itself a small group. This course provides an opportunity for students to discuss and learn more about issues related to the practicum and to the field of human services.  Similar in organization to a professional development meeting, the seminar is designed to help facilitate the transition from undergraduate school to work and/or graduate school.Theories of group dynamicsResponse: Theories of group dynamics are introduc
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 57 words, `review_low_confidence`

_Source heading:_ **Each student will be assigned to one of three groups. The groups’ role will rotate during the semester.  Each group will**

_AI rationale:_ The section describes a pedagogical technique using small groups with rotating roles and debate, directly matching Standard 12.b's requirement to address group facilitation skills and group dynamics in the curriculum.

```text
Each student will be assigned to one of three groups. The groups’ role will rotate during the semester.  Each group will have the opportunity of presenting support for or against a particular topic being considered.  The third group during each of these debates will listen to both sides and determine which side presented the most convincing evidence.
```

##### Narrative 3 — 🟡 conf 0.52, 87 words, `review_low_confidence`

_Source heading:_ **Throughout the course, students will take part in different types of group experiences as both members                  **

_AI rationale:_ The section describes students' participation in small and large group experiences with attention to group facilitation skills and group dynamics principles, which directly aligns with Standard 12.b's focus on small groups, group dynamics theories, and group facilitation skills in human services.

```text
Throughout the course, students will take part in different types of group experiences as both members                           		and leaders of small and large groups; therefore, class participation is essential.  Advance preparation 		is mandatory, as students will be expected to synthesize, analyze, and evaluate the readings in terms of 		academic knowledge as well as personal and professional experience.  Grading will take into 			consideration, the relevance of a student’s comments and questions, and the degree to which a 			student’s participation reflects an understanding of the underlying principles of this course.
```

##### Narrative 4 — 🟡 conf 0.52, 74 words, `review_low_confidence`

_Source heading:_ **Each student will write two papers.  One will be a position paper on a group   membership or group 		leadership issue, s**

_AI rationale:_ The section describes assignments on group membership and group leadership issues, directly aligning with Standard 12.b's coverage of small groups, group dynamics, and group facilitation skills. The process analysis paper with reflection also has secondary relevance to Standard 20.e on reflection on professional self.

```text
Each student will write two papers.  One will be a position paper on a group   membership or group 		leadership issue, such as how to work effectively with a difficult group member.  The other will be a 		process analysis of the course, which will require the student to apply the readings to a 				conceptualization of his/her own experience in the course as well as researching theoretical methods..  		This paper will also be presented in class.
```

##### Narrative 5 — 🟡 conf 0.72, 138 words, `review_low_confidence`

_Source heading:_ **515 Students will write a specific group proposal in outline form.  You may choose a group for children, adolescents, ad**

_AI rationale:_ The assignment requires students to develop a group proposal demonstrating knowledge of group dynamics, member screening and selection, facilitation procedures, and group evaluation—all core components of Standard 12.b on small groups theory, dynamics, and facilitation skills in human services.

```text
515 Students will write a specific group proposal in outline form.  You may choose a group for children, adolescents, adults or the elderly.  In your group proposal, show how you would screen, select and orient members; outline the practical considerations in setting up this group.  You might have an outline of topics that may structure your group sessions, if this is appropriate.  Discuss the rationale for your group and also how you would evaluate the outcomes.  Review the examples of the various group proposals in the textbook given in	Chapters 10 and 11 for ideas for the structure of your proposal.  Also, in Chapter 5,  specific guidelines are addressed for developing a proposal for a group and for forming groups.  Your proposal is designed to help you clarify the nature of the group and procedures you may use.
```

##### Narrative 6 — 🟡 conf 0.82, 105 words, `review_low_confidence`

_Source heading:_ **Apply your textbooks, as well as a minimum of 4 additional references, to your experience in group.  Your paper must add**

_AI rationale:_ The assignment explicitly requires students to apply theories of group dynamics, demonstrate group facilitation skills, and analyze group process concepts—core competencies directly addressed in Standard 12.b (small groups: theories of group dynamics and group facilitation skills). The reflective analysis component is secondary to the primary focus on group knowledge and skills.

```text
Apply your textbooks, as well as a minimum of 4 additional references, to your experience in group.  Your paper must address the stages of group, techniques and practice, and specific group process concepts to the evolution of your individual group.  Do a process commentary on your group from both a leader’s and member’s perspective.  Apply your research on group process to an analysis of your own experience in group.  Conceptualize the group process, rather than give a report of events.  Incorporate your own experience of key themes in a way that demonstrates your understanding of the readings by focusing on such points as the following:
```

##### Narrative 7 — 🟡 conf 0.72, 72 words, `review_low_confidence`

_Source heading:_ **Working in small groups of 5-6, students will pick a topic from the following, research it and present in class: Right t**

_AI rationale:_ The assignment describes students working in small groups of 5-6 to research and present topics, which directly aligns with Standard 12.b's focus on small group facilitation and group dynamics. While the topics addressed have policy/advocacy dimensions (12.g, 13.f), the core instructional method and learning activity is small group work.

```text
Working in small groups of 5-6, students will pick a topic from the following, research it and present in class: Right to Marry; Immigration Reform; Mass Shootings; Healthcare for all Americans (Obamacare); Voter ID Laws; Death Penalty; and “Black Lives Matter”.  Group members are expected to exercise discretion on the specific direction they wish to take their topic.  They should aim at sharing significant new information on their topic with their colleagues.
```

##### Narrative 8 — 🟡 conf 0.72, 84 words, `review_low_confidence`

_Source heading:_ **The class will break up into small groups of 5-6 to discuss the article “Lesbians blurring the boundaries….”  The discus**

_AI rationale:_ The assignment describes a small-group discussion activity using a structured discussion guide, which directly aligns with Standard 12.b's specification of small group facilitation and group dynamics instruction. While the optional written reflection could tangentially relate to 20.e (professional self-reflection), the core assignment is pedagogical delivery of small-group work.

```text
The class will break up into small groups of 5-6 to discuss the article “Lesbians blurring the boundaries….”  The discussion will be conducted using a discussion guide I will provide.  No written report is required.  However, students may submit a 2-3 page report answering the questions in the discussion guide, on the due date, for extra-credit points.  Make sure to number your answers correspondingly.  To use this assignment for extra-credit, students must participate in the in-class group discussion.  This paper must be written individually.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][b].supportingEvidenceText`_

##### Evidence text 1 — conf 0.68, 32 words, `review_low_confidence`

_Source heading:_ **(table)**

```text
Articulated Courses at McDaniel College
Articulated Courses at Stevenson University
CED 508 Group Dynamics
CHS 515 Group Process and Practice
HSM 510 Introduction to Agency Management
CHS 540 Administration of Human Services
```

##### Evidence text 2 — conf 0.62, 58 words, `review_low_confidence`

_Source heading:_ **Examples of related professional journals for the individual and group assignments are:  American Journal of Family Ther**

```text
Examples of related professional journals for the individual and group assignments are:  American Journal of Family Therapy, Family Process, Journal of Couple and Relationship Therapy, Journal of Family Therapy, Journal of Marital and Family Therapy, Journal of Sex and Marital Therapy as well as journals such as Family Relations, Journal of Marriage and Family, and Families in Society.
```

##### Evidence text 3 — conf 0.62, 58 words, `review_low_confidence`

_Source heading:_ **Examples of related professional journals for the individual and group assignments are:  American Journal of Family Ther**

```text
Examples of related professional journals for the individual and group assignments are:  American Journal of Family Therapy, Family Process, Journal of Couple and Relationship Therapy, Journal of Family Therapy, Journal of Marital and Family Therapy, Journal of Sex and Marital Therapy as well as journals such as Family Relations, Journal of Marriage and Family, and Families in Society.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No explicit reference to specific group dynamics theories (e.g., Tuckman's stages, Yalom's curative factors, systems theory). Narrative mentions 'theories of group dynamics' are covered in CHS 315/515 Week 4 and CHS 430, but no syllabus excerpts, reading lists, or concrete examples of which theories are taught are provided.
- ⚠️ Limited evidence of formalized assessment of group facilitation skills. While multiple courses list skill-building activities, there is no rubric, grading criteria, or explicit assessment tool shown for evaluating students' actual competence in facilitating groups.
- ⚠️ Supporting evidence items (Evidence 2 and 3) are duplicates listing only family therapy journals; they do not directly support coverage of small group dynamics, theories, or facilitation. No evidence of required textbooks, theoretical frameworks, or skill-building resources is provided.
- ⚠️ Internship (CHS 380) coverage of group facilitation skills is mentioned in narrative but incomplete—no detail on how students are supervised or evaluated in applying group facilitation skills in field settings.

---

### `12.c` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Changing family structures and roles._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][c].content`_

##### Narrative 1 — 🟢 conf 0.92, 194 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses changing family structures and roles as a knowledge domain, with course examples (CHS 101, CHS 430) demonstrating how students learn this content. This matches Standard 12.c exactly, which specifies this topic as part of the Knowledge, Theory, Skills, and Values standard.

```text
Changing family structures and roles.Response: Changing family structures and roles is the main topic in CHS 101 Family Studies.  Each unit addresses changes and variations over time and across cultures for that topic. See especially unit on Issues in Contemporary Families. Changing family structures is also addressed in CHS 105 Human Services and Social Policy through lectures and discussions at the beginning of the course related to defining needs and helping and in the unit on special groups. In CHS 430 Family Dynamics and Interventions, family structures are analyzed in depth from a variety of theoretical perspectives. See the Group Project on examining models of family therapy. In the course schedule, see units on Genograms and Ecomaps, on Family as a Psychosocial System, and on Family Development. The material is covered through lecture, discussion, readings, reflections and written assignments. Field Placement courses CHS 380 Internship, CHS 440 Practicum. and CHS 441 Seminar require students to understand the family structures and roles of the particular clients they work with at their agenciesA theoretical consideration of changing family structures is included in the required course SOC 101 (in-class activities, discussions, media presentations, lectures, and assigned readings).
```

##### Narrative 2 — 🟡 conf 0.52, 71 words, `review_low_confidence`

_Source heading:_ **There are many controversial issues related to families.  In this assignment, you will investigate one of these issues b**

_AI rationale:_ The assignment centers on investigating controversial family-related issues through research and reflection, directly aligning with Standard 12.c (changing family structures and roles). While fieldwork preparation is mentioned, the assignment explicitly states 'not conducting fieldwork,' making this a classroom-based knowledge and theory exercise rather than a field experience.

```text
There are many controversial issues related to families.  In this assignment, you will investigate one of these issues by reading and preparing for but not conducting fieldwork.  After you have collected your data, you will present both sides of the issue to the class in a team presentation.  In an individual written report, you will summarize and react to a journal article, discuss your fieldwork preparation, and reflect on your topic.
```

##### Narrative 3 — 🟡 conf 0.52, 266 words, `review_low_confidence`

_Source heading:_ **Children are thought to be indebted to their parents and this debt lies in the idea of filial duty (“Treating parents re**

_AI rationale:_ The narrative describes traditional and contemporary family structures, roles, and dynamics in South Korean culture—directly addressing how family structures and roles change across time and cultural contexts. While cultural competence (19.d) is secondarily relevant, the content's primary focus on family system transformation aligns best with Standard 12.c.

```text
Children are thought to be indebted to their parents and this debt lies in the idea of filial duty (“Treating parents respectfully at all times, taking care of them in their old age, mourning them at proper funerals, and performing ceremonies for them after their deaths”) (The Value and Meaning of the Korean Family). The “children’s debt to their parents” goes further along, entailing that maintaining the family line is a must as well (The Value and Meaning of the Korean Family). Traditional South Korean families include children eventually leaving the home but living close by (The Value and Meaning of the Korean Family). Young children are “indulged” and are not disciplined until they are older (The Value and Meaning of the Korean Family). Parents also began separating girls and boys and trained children to be respectful to their elders, not being respectful to elders resulting in punishment (The Value and Meaning of the Korean Family). Girls were seen as outsiders that will eventually leave the family and, traditionally, many of them were not taught to read or to write (The Value and Meaning of the Korean Family). She was taught that her place in the family was inferior to that of her male siblings, and that of her father (The Value and Meaning of the Korean Family). In today’s South Korean household however due to democracy and urbanization, both girls and boys are entitled to an education and are both treated more equally in the household, although it is expected for the girls to take on more household tasks and chores when they get older.
```

##### Narrative 4 — 🟡 conf 0.52, 71 words, `review_low_confidence`

_Source heading:_ **Part two: In addition to a family “issue” you will be assigned a particular theory. You will need to research how your a**

_AI rationale:_ The section describes an assignment requiring students to research and demonstrate how a specific theoretical approach addresses a family issue, directly aligning with Standard 12.c on changing family structures and roles and theoretical knowledge. The emphasis on family systems theory application best matches the family-focused specification.

```text
Part two: In addition to a family “issue” you will be assigned a particular theory. You will need to research how your assigned issue would be addressed within this theory. For example if your issue was “alcoholism within the family” and your assigned theory was “solution-focused” you would need to research how a solution-focused family therapist would address alcoholism in the family. Your group will then do a demonstration of this
```

##### Narrative 5 — 🟡 conf 0.52, 62 words, `review_low_confidence`

_Source heading:_ **You will be assigned to “families”. These families will be the subjects of the role plays we will do in class. In additi**

_AI rationale:_ The section describes a classroom assignment using family role-plays with assigned family structures, issues, and theoretical approaches. This directly addresses family structures and roles as a knowledge/theory domain. While group facilitation (12.b) is a secondary fit given the workgroup component, the primary focus is family dynamics and applying theory to family systems.

```text
You will be assigned to “families”. These families will be the subjects of the role plays we will do in class. In addition, your “family” will be your workgroup for the completion of this assignment. Your “family” will be assigned an “issue” or issues that bring you to therapy and will also be assigned a theory from which to approach this issue.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabus excerpts, assignment rubrics, course materials, readings lists) to verify claims about course content
- ⚠️ Vague references to 'especially unit on Issues in Contemporary Families' and 'units on Genograms and Ecomaps' without demonstrating actual curriculum content addresses changing structures/roles
- ⚠️ No evidence that students engage with diverse family structures (single-parent, blended, same-sex, multigenerational, non-traditional arrangements) beyond Korean family example
- ⚠️ Limited demonstration of theoretical frameworks used to analyze changing family structures—'variety of theoretical perspectives' mentioned but not specified
- ⚠️ Field placement requirement mentioned (CHS 380, 440, 441) but no evidence provided showing how students actually apply knowledge of changing family structures in practice
- ⚠️ Korean family example provided appears to be student work product rather than course design documentation; unclear if this represents program-level content or one assignment
- ⚠️ No evidence of how learning outcomes are assessed regarding students' knowledge of changing family structures and roles
- ⚠️ Insufficient evidence showing breadth of cultural and structural variations addressed across curriculum

---

### `12.d` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An introduction to the organizational structures of communities._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 220 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses 'An introduction to the organizational structures of communities,' which is the exact language of Standard 12.d. The narrative documents how this content is integrated across multiple courses (CHS 101, CHS 105, CHS 430, SOC 101) and field placements, with explicit evaluation of student competency in understanding community organizational structures.

```text
An introduction to the organizational structures of communities.Response: The organizational structures of communities are introduced in CHS 101 Family Studies, particularly in the units on Work and Family Life, and Family Social Policy, although the social structures of communities affect families in all areas.   The organizational structures of communities are also addressed in CHS 105 Human Services and Social Policy through lectures and discussions, notably in the unit on Social Policy and Intervention. A community needs assessment was added as a major assignment in the course following the previous accreditation self-report.In CHS 430 Family Dynamics and Interventions, the organizational structures of communities are considered as they relate to family dynamics. See the unit on Family as a Psychosocial System (9/12). The material is covered through lecture, discussion, readings, reflections and written assignments. Field Placement courses CHS 380 Internship, CHS 440 Practicum. and CHS 441 Seminar require students to understand the organizational structures of the communities within which they work at their agencies. Each student is evaluated on their ability to “demonstrate knowledge about the customs, practices, beliefs and values of the cultures and communities within which he or she practices” (see Student Evaluation Form, Section IV.B)An introduction to the organizational structures of communities is included in the required course SOC 101 (in-class activities, discussions, media presentations, lectures, and assigned readings).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided (syllabi, assignment descriptions, learning outcomes, rubrics, student work samples) to verify claims about course content
- ⚠️ Vague description of 'organizational structures' — unclear whether this means governance, agencies, institutions, resource networks, formal vs. informal structures, or decision-making hierarchies
- ⚠️ No evidence that students can identify, analyze, or evaluate organizational structures (only that content is 'introduced')
- ⚠️ No clear learning outcome or competency statement defining what 'introduction' means or at what depth students master this concept
- ⚠️ Field placement evaluation criterion mentions 'cultures and communities' but does not explicitly assess understanding of organizational structures
- ⚠️ Unclear how SOC 101 (non-major course) content is integrated into the CSHSE program or assessed for program-level competency

---

### `12.e` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of the capacities, limitations, and resiliency of human systems._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][e].content`_

##### Narrative 1 — 🟢 conf 0.95, 296 words, `auto_accept`

_Source heading:_ **e.**

_AI rationale:_ The section directly addresses understanding the capacities, limitations, and resiliency of human systems, which is the exact language of Standard 12.e in the current 2025 spec. The narrative describes how this understanding is taught across multiple courses including CHS 101, 365, 105, 224, 340, 430, and field placements.

```text
An understanding of the capacities, limitations, and resiliency of human systems.Response: Theories related to the capacities, limitations and resiliency of human systems are a main topic in CHS 101 Family Studies.  In particular, resiliency is covered in the unit on Stress and Crisis in Relationships. The topic is addressed through reading, lectures and discussions. A new elective course has been added to the curriculum recently entitled CHS 365 Coping, Resilience and Growth-Focused Counseling. It will be taught by Dr. Swisher for the first time in the spring of 2020. CHS 105 Human Services and Social Policy focuses throughout the semester on the helping process, which is fundamentally about working within the limitations of human systems to create change.  See particularly chapters on the Helping Process and Social Policy and Intervention.  In CHS 224 Research Methods and Writing, students discuss the process of conducting research, including guidelines for using human subjects, as a system. In addition they explore how the capacity and limitations of human systems can be measured. CHS 340 Administration of Human Services focuses on how human systems can be effectively managed and administered. This is a theme throughout the course schedule, but see particularly the classes on 2/25 Humanizing the Organization and 4/15 Team and Coalition Building. In CHS 430 Family Dynamics and Interventions, the capacities, limitations, and resiliency of human systems is examined in the context of family dynamics. See the Group Project investigating theoretical perspectives on family therapy. The material is covered through lecture, discussion, readings, reflections and written assignments. Field Placement courses CHS 380 Internship, CHS 440 Practicum. and CHS 441 Seminar require students to reflect through journal writing and reflection papers on the capacities, limitations and resiliency of human systems as they relate to the particular agency where they work.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided—narrative claims lack documentation (syllabi, assignments, readings, rubrics)
- ⚠️ No explicit definition or conceptual framework for what 'capacities, limitations, and resiliency' means in the program's context
- ⚠️ Unclear how 'human systems' is operationalized—appears to mix individual/family/organizational/policy levels without distinction
- ⚠️ No assessment data demonstrating students actually achieve understanding of this concept (no learning outcome measures, rubrics, or student work samples)
- ⚠️ CHS 365 listed as 'new' and 'taught for first time in spring 2020'—date is outdated; unclear if course was delivered and whether it is currently part of curriculum
- ⚠️ Vague references to course content (e.g., 'see particularly chapters...', 'theme throughout') without actual evidence of learning activities or assignments
- ⚠️ No evidence of how resiliency is distinct from or related to capacities and limitations—conflates concepts
- ⚠️ Field placement reflection (CHS 380/440/441) mentioned but no examples of student reflections or guidance showing how students engage with this specification

---

### `12.f` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Emphasis on context and the role of intercultural fluency, including cultural group membership and individual identities in determining and meeting human needs._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][f].content`_

##### Narrative 1 — 🟡 conf 0.68, 218 words, `review_low_confidence`

_Source heading:_ **While talking about being white, DiAngelo mentions that everyone has their own experience and promoting the concept of u**

_AI rationale:_ The student reflection directly engages intercultural fluency and how cultural group membership (race, neighborhood demographics) shapes individual experience and perception, central to 12.f's emphasis on context and cultural group membership in determining needs. The narrative demonstrates critical examination of systemic bias and stereotype—reflective of curriculum integration on cultural self-a

```text
While talking about being white, DiAngelo mentions that everyone has their own experience and promoting the concept of universalism fails in allowing people to feel that their experience is real. Furthermore, the concept of individualism is also knocked by claiming that it is perpetuated by the dominant group (white). My main issue with both of her statements is that is appears that she does not have a clear answer as to what stance we should have (individualism vs universalism). When I was going through primary school I lived in a predominantly white suburb and often had one or two black people in school. As I went on to high school, I was accepted into a magnet program that was in a neighborhood people often felt was unsafe and impoverished. When I told my friends and certain family members I was told to be careful because I might get stabbed. The school was no longer mostly white and in fact was dominated by people of color. Through that experience I was able to see that the neighborhood was no more dangerous than the other neighborhoods, but rather people just viewed it as such because the dominant group was no longer white. Weed was extremely prevalent in the area, yet the “nice, white school” had many students overdosing on heroin.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No explicit connection to human needs assessment or meeting human needs across cultural contexts
- ⚠️ Missing demonstration of intercultural fluency as a professional competency or skill to be developed
- ⚠️ Lacks evidence of understanding cultural group membership dynamics beyond personal anecdote
- ⚠️ No discussion of how individual identities intersect with cultural group membership in social work practice
- ⚠️ Absence of theoretical or conceptual framework linking context to service delivery or assessment
- ⚠️ No mention of how this understanding would be applied in professional social work settings
- ⚠️ Missing evidence of reflection on own cultural identity development or positionality
- ⚠️ No supporting documentation (readings, course materials, assessments) provided to corroborate learning

---

### `12.g` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][g].content`_

##### Narrative 1 — 🟢 conf 0.96, 245 words, `auto_accept`

_Source heading:_ **g.**

_AI rationale:_ The section directly addresses processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism—exact language match to Standard 12.g specification.

```text
Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism.Response: Effecting social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism is a recurring and fundamental topic in CHS 340 Administration of Human Services (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment). This course focuses on the skills required for the development, delivery and administration of human services programs. It emphasizes the organizational and work related issues in human services and addresses how one effects social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism.In CHS 105 Human Services and Social Policy a major assignment has been added on assessing the needs of a community and part of that project involves discussions of how those needs can be met through advocacy and community organization. Effecting social change through advocacy is also addressed in CHS 101 Family Studies (lectures and assigned readings), CHS 220 Diversity and Cultural Competence (lectures, assigned reading and discussions), CHS 380 Internship (class discussions), CHS 430 Family Dynamics and Interventions (lectures), and CHS 441 Seminar (discussions, assigned readings). CHS 224 Research Methods and Writing covers the use of research to support advocacy. SOC 101 also addresses this area through in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][g].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][g].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided (syllabi, assignments, readings, or student work samples) to verify claims about course content
- ⚠️ No concrete examples of advocacy assignments, projects, or learning outcomes demonstrating student competency in advocacy skills
- ⚠️ Community development processes not explicitly addressed—only mentioned in passing without description of how students learn development strategies
- ⚠️ Grassroots organizing content claimed but not evidenced; no description of organizing models, tactics, or student application
- ⚠️ Local and global activism distinction unclear; global activism barely mentioned despite being explicitly required by specification
- ⚠️ No evidence of how students develop and practice actual advocacy skills (e.g., policy briefs, testimony, campaign planning, stakeholder engagement)
- ⚠️ No assessment data showing students can effect social change or demonstrate advocacy competencies
- ⚠️ Internship (CHS 380) mentioned only as 'discussions' without evidence of hands-on advocacy experience or outcomes

---

### `12.h` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[12][h].content`_

##### Narrative 1 — 🟡 conf 0.82, 288 words, `review_letter_disagrees`

_Source heading:_ **f.**

_AI rationale:_ The section directly addresses skills to analyze and interpret historical data for application in advocacy and social change, which maps most precisely to Standard 12.h's specification on processes to analyze, interpret, and effect policies and laws that influence service delivery systems. The narrative demonstrates how students learn to apply historical data and research methods to influence poli

```text
Skills to analyze and interpret historical data for application in advocacy and social change.Response: Coverage of skills to analyze and interpret historical data for application in advocacy and social change is accomplished through in-class activities, discussion, lecture, and assigned reading, in CHS 101 Family Studies. In this course, students learn about the historical and social roots of each topic addressed and consider ways that current conditions could be changed to benefit families (see particularly “Marriage Relationships,” “Same-Sex Couples” and “Family Social Policy”). In CHS 105 Human Services and Social Policy,  the historical roots of helping are examined and the notion of advocacy is introduced through the helping process and through social policy and intervention. See especially the assignment  “Issue Presentation and Report.”CHS 224 Research Methods and Writing is fundamentally about the application of data to influence social policy and interventions. See particularly week 2 in course schedule on the foundations of social science research and the unit on historical/comparative research (week 12). The central project for the course is that students develop a detailed Research Proposal on a topic related to human services.CHS 430 Family Dynamics and Interventions addresses the use of data to support different types of family therapy interventions through a group project where student groups analyze in-depth different models of family therapy, both current and historical. The analysis includes historical data on the effectiveness of each approach (see the Group Project assignment for detail and a list of the models covered).Skills to analyze and interpret historical data for application in advocacy and social change are also developed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students practice these skills as they relate to their particular agency.
```

##### Narrative 2 — 🟢 conf 0.94, 135 words, `auto_accept`

_Source heading:_ **h.**

_AI rationale:_ The section directly addresses processes to analyze, interpret, and effect policies and laws at local, state, and national levels influencing service delivery systems, which matches Standard 12.h specification language precisely. The narrative response documents curricular coverage through specific courses and field placements.

```text
Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems.Response:The analysis, interpretation, and effect of policies and laws at local, state, and national levels that influence services delivery systems is a recurring and fundamental focus in CHS 340/540 (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment; see CHS 340 Administration of Human Services syllabus). It is also addressed in CHS 105 Human Services and Social Policy (in-class activities discussions, lectures, and assigned readings), CHS 224 Research Methods and Writing (the role of research in analyzing policies and influencing delivery systems), and CHS 430 Family Dynamics and Interventions (lecture).Field Placements CHS 380 and CHS 440.This area is also addressed in SOC 101 (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment).
```

##### Narrative 3 — 🟡 conf 0.52, 55 words, `review_low_confidence`

_Source heading:_ **Provides the student with an opportunity to learn the effects of a variety of physical, personal, psychological and soci**

_AI rationale:_ The section describes learning outcomes about older adults' physical, psychological, and social issues—content that directly exemplifies the human service delivery systems context (aging as an identifiable human condition) and the range of populations served. Standard 12.h's reference to identifiable human conditions including aging, and the focus on how these conditions shape service delivery sys

```text
Provides the student with an opportunity to learn the effects of a variety of physical, personal, psychological and social issues faced by older adults and their families. Emphasis is placed on functional health status, social roles, social relationships, family issues, and the impact of these factors on specific services and the community at all levels.
```

##### Narrative 4 — 🟢 conf 0.87, 66 words, `auto_accept`

_Source heading:_ **STANDARD 12 Human service professionals are aware of local, state, and federal laws. They advocate for change in regulat**

_AI rationale:_ The section content directly addresses processes to analyze, interpret, and effect policies and laws at local, state, and national levels, including advocacy for legislative change when laws conflict with ethical guidelines and client rights—the core substance of Standard 12.h.

```text
STANDARD 12 Human service professionals are aware of local, state, and federal laws. They advocate for change in regulations and statutes when such legislation conflicts with ethical guidelines and/or client rights. Where laws are harmful to individuals, groups, or communities, human service professionals consider the conflict between the values of obeying the law and the values of serving people and may decide to initiate social action.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[12][h].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[12][h].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided to verify any claims made in the narrative; supporting documentation is completely absent
- ⚠️ Specification requires demonstration of processes to 'effect' (create/implement change in) policies and laws, but narrative only addresses analysis and interpretation
- ⚠️ No explicit connection to the specific human conditions listed in the specification (aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, disabilities) that drive service delivery systems
- ⚠️ Aging services emphasis mentioned in specification prompt is not addressed in narrative response
- ⚠️ No demonstration of how students learn about LOCAL, STATE, and NATIONAL policy levels—distinctions are blurred or absent
- ⚠️ Standard 12 requires advocacy for regulatory change and understanding conflict between law and ethics/client rights; narrative does not address this critical ethical dimension
- ⚠️ Field placement courses (CHS 380, 440, 441) are mentioned but with no detail on what students actually do to analyze or effect policy change
- ⚠️ No evidence of student learning outcomes, assignments, assessments, or work samples demonstrating competency in policy analysis or advocacy

---

## Standard 13

### `13.a` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The range and characteristics of human service delivery systems and organizations._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[13][a].content`_

##### Narrative 1 — 🟢 conf 0.96, 407 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly addresses the range and characteristics of human service delivery systems and organizations through multiple courses and instructional methods, matching Standard 13.a specification language exactly. The narrative maps curriculum to this foundational knowledge requirement.

```text
The range and characteristics of human services delivery systems and organizations.Response:The range and characteristics of human services delivery systems and organizations is offered in CHS 101, CHS 105, CHS 224, CHS 430, CHS 380, CHS 440 and CHS 441.  In CHS 101 Family Studies, students are introduced to this material by assigned reading and in corresponding in-class discussion and lecture.  In addition, students in CHS 101 are assigned an article review which includes these issues and are given a group assignment involving written reports, individual data collection, and classroom presentations. This second assignment focuses on a human service related issue and the delivery, organization, and characteristics of services related thereto.CHS 105 Human Services and Social Policy focuses on human services delivery systems and organizations. This subject matter is conveyed by in class activity (CHS 105 Syllabus) and through an out-of-class assignment in which students research the needs of a particular community and prepare a written report and a group oral presentation related to these issues (Team Research Project). Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  In CHS 224 Research Methods and Writing students develop a grant proposal narrative that reflects the intricacies of how services are planned, funded and administered. CHS 380 Internship addresses human services delivery systems, organization, and characteristics through in-class discussion (students discuss their particular internship site systems, organizations, and characteristics) and through journaling. These topics are also covered through orientation and participation at each student’s placement, in preparation of each student’s portfolios, and Reflection Papers.  Lecture by the instructor and several guest speakers who discuss the human services delivery systems, organization, and characteristics of their respecti
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[13][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content and learning activities
- ⚠️ Narrative does not distinguish between different TYPES of human service delivery systems (e.g., public vs. private, for-profit vs. nonprofit, formal vs. informal, mental health vs. social services vs. substance abuse treatment)
- ⚠️ No explicit description of organizational structures, models, or frameworks students learn (e.g., hierarchical, flat, matrix organizations; funding models; governance structures)
- ⚠️ Narrative does not clarify what 'characteristics' of organizations are taught (e.g., mission, goals, staffing patterns, accreditation, ethical frameworks, legal requirements)
- ⚠️ No evidence of comparative analysis across multiple delivery systems or organizations
- ⚠️ Internship and practicum experiences (CHS 380, CHS 441) are mentioned but lack detail about how students systematically learn organizational structures vs. only observing their single placement site
- ⚠️ No indication of breadth of systems covered—unclear whether students learn about health services, child welfare, aging services, corrections, employment services, etc.

---

### `13.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The range of populations served, and needs addressed by human services professionals._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[13][b].content`_

##### Narrative 1 — 🟢 conf 0.96, 215 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses the range of populations served and needs addressed by human services professionals across multiple courses, matching the exact language of Standard 13.b in the current 2025 spec.

```text
The range of populations served and needs addressed by human services professionals.Response:The range of populations served and needs addressed by human services professionals are fundamental topics in: CHS 340 Administration of Human Services (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment); CHS 105 Human Services and Social Policy (in-class activities, discussions, lectures, assigned readings, and out-of-class assignment; see the 4th unit on Special Groups, the Field Experience Assignment and the Team Research Project); CHS 220 Diversity and Cultural Competence in the context of diversity issues (in-class activities, discussions, lectures, assigned readings, and out-of-class assignment); CHS 224 Research Methods and Writing in relation to research demonstrating needs and the effectiveness of interventions (in-class activities, discussions, lectures, and assigned readings) and CHS 430 Family Dynamics and Interventions in the context of family interventions (in-class activities, discussions, lectures, assigned readings, and out-of-class assignment; see Group Project).  It is also addressed in CHS 101 Family Studies (lectures and assigned readings.), CHS 380 Internship (in-class activities, discussions,), and CHS 441 Seminar (discussions, assigned readings.).  Required courses in other majors which address the range of populations served and needs addressed by human services professionals include PSY 101 (lecture, class discussion, assignments, and reading.), PSY 108 (lecture, class discussion, assignments, and reading.), and SOC 101 (lecture, discussion, and reading.).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[13][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content
- ⚠️ Narrative lists courses but provides no concrete examples of specific populations served (e.g., homeless, elderly, children, individuals with mental illness, veterans, LGBTQ+)
- ⚠️ No examples of specific needs addressed (e.g., mental health, substance abuse, housing, employment, trauma, poverty)
- ⚠️ Vague pedagogical descriptions ('in-class activities,' 'discussions,' 'lectures') without detail on what populations or needs are actually covered
- ⚠️ No evidence of breadth across vulnerable/underserved populations required by human services context
- ⚠️ No demonstration of how students learn to identify and respond to diverse population needs
- ⚠️ Unclear how PSY 101, PSY 108, and SOC 101 specifically address range of populations served by human services professionals

---

### `13.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[13][c].content`_

##### Narrative 1 — 🟢 conf 0.95, 441 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses how the program teaches 'the major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning' through multiple courses and pedagogical methods, which is the exact language of Standard 13.c.

```text
The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning.Response:The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning are presented in CHS 101, CHS 201, CHS 224, CHS 380, CHS 430, and CHS 441.  In CHS 101 Family Studies, students are introduced to this material by assigned reading and in corresponding in-class discussion and lecture (Course Objectives 1, 3, and 5.).  In addition, students in CHS 101 are assigned an article review which includes these issues (Article Review Assignment) and are given a group assignment involving written reports, individual data collection, and classroom presentations (Issues Presentation Assignment).  CHS 105 Human Services and Social Policy focuses on major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning within the context of human services agencies. This subject matter is conveyed by in class activity (CHS 105 syllabus) and through an out-of-class assignment in which students research the needs of a particular community and prepare a written report and a group oral presentation related to these issues (Team Research Project). Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 201 syllabus.  CHS 224 Research Methods and Writing addresses major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning within the context of research aimed at assessing the models (See CHS 224 syllabus).  CHS 380 Internship addresses major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning through in-class discussion (students discuss their particular internship site models) and through journaling. These topics are also covered thro
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.82, 355 words, `review_letter_disagrees`

_Source heading:_ **a.**

_AI rationale:_ The section explicitly addresses the major models and theoretical bases for prevention, intervention, and maintenance strategies across multiple courses, which directly aligns with Standard 13.c's requirement to demonstrate knowledge of these conceptual models and their integration for healthy functioning.

```text
Theory and knowledge bases of prevention, intervention, and maintenance strategies.Response:The application of prevention, intervention, and maintenance strategies is a fundamental principle that is covered in the following courses: CHS 101, 105, 224, 315/515, 360, 340, 430, 380, 440 and 441.The theoretical basis for prevention and intervention strategies is introduced in CHS 101 Family Studies (schedule first two weeks).In CHS 105 Human Services and Social Policy, in depth consideration of the goals and purpose of the helping process emphasize prevention and the goal of achieving maximum autonomy. CHS 224 Research Methods and Writing treats this goal as an important outcome measure for assessing programs (see the research proposal project).The application of prevention, intervention, and maintenance strategies is a primary focus of both CHS 315/515 Group Counseling (as an outcome of group process) CHS 360 Counseling Strategies for Individuals (related to individual counseling). In CHS 340 Administration of Human Services, the application of prevention, intervention, and maintenance strategies is analyzed as a vital part of effectively administering an agency (see Strategic Plan Appraisal in schedule). CHS 430 Family Dynamics and Interventions addresses these strategies as associated with the treatment of family issues and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention model.  The class then discusses how the presenting group addressed the application of prevention, intervention, and maintenance strategies through their intervention program.Prevention, intervention, and maintenance strategies are addressed in CHS 380 Internship and CHS 440 Practicum as an integral part of the field placement experiences and through class discussion, assigned readings, and journaling. In CHS 380, guest speakers, who discuss these strategies within their respective sites, are a significant pa
… (truncated, full text imported)
```

##### Narrative 3 — 🟡 conf 0.72, 98 words, `review_low_confidence`

_Source heading:_ **Examines current theories, research and practices relating to resilience, coping and growth-focused counseling. Students**

_AI rationale:_ The narrative describes theories and practices for resilience, coping, and growth-focused counseling that directly align with Standard 13.c's emphasis on models conceptualizing prevention, maintenance, intervention, rehabilitation, and healthy functioning. The content on flourishing, positive psychology, wellness, and character strengths exemplifies integration of healthy functioning frameworks.

```text
Examines current theories, research and practices relating to resilience, coping and growth-focused counseling. Students learn to apply the science of flourishing and use empirical and experiential approaches to help clients enhance their lives. Students explore the importance of self-care and resilience in advancing their own personal and professional growth. Topics covered include the mental states of flow, mindfulness, happiness, pleasure, contentment, optimism and other positive emotions, character strengths, values, goal setting, wellness, the mind-body connection, self-esteem, meaningful relationships, and enabling institutions exemplified by positive education, positive work environments, healthy families, humane leadership, and the development of civic virtues.
```

##### Narrative 4 — 🟡 conf 0.72, 217 words, `review_low_confidence`

_Source heading:_ **3. Transgenerational. (Bowen).Thinking, feeling, and behaving are tied to the family system. The individual’s problems a**

_AI rationale:_ The section presents multiple theoretical models (Bowen, Minuchin, Haley, Beck, Ellis, deShazer, Anderson, White) for conceptualizing and addressing family and individual problems across intervention contexts, directly matching Standard 13.c's requirement to cover major models for conceptualizing prevention, intervention, and healthy functioning.

```text
3. Transgenerational. (Bowen).Thinking, feeling, and behaving are tied to the family system. The individual’s problems arise and are maintained by relationship connections. Problems are passed from one generation to the next. Fusion = most vulnerable; Differentiation of self = least vulnerable.4. Structural. (Minuchin). Focuses on how families are organized and what rules govern their transactions. Pays attention to rules, roles, alignments, coalitions, and boundaries. Challenges rigid, repetitive transactions within a family, helping to “unfreeze” them and allow family reorganization.5. Strategic. (Haley).Assigns tasks to get family to change aspects of the system that maintain problematic behavior. Paradoxical interventions are employed to force clients to abandon symptoms. NOT interested in providing insight.6. Cognitive-Behavioral. (Beck and Ellis).Maladaptive behaviors can be extinguished as the contingencies of reinforcement are altered. Focuses on communication skills, parent training skills, cognitive restructuring, etc.7. Social Constructionist. (deShazer and Anderson).Suggests that each of our perceptions is not an exact duplication of the world, rather, a point of view seen through the limiting lens of our assumptions about people. Therapy involves jointly constructing new options that change past accounts and allow new alternatives.8. Narrative. (Michael White).Our sense of reality is organized and maintained through stories.Families present with negative, dead-end stories. The goal is to explore alternative stories, make new assumptions, and open up new possibilities by re-authoring stories.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[13][c].supportingEvidenceText`_

##### Evidence text 1 — conf 0.62, 59 words, `review_low_confidence`

_Source heading:_ **Prepares students with the knowledge and skills required to effectively assess and treat persons with substance abuse pr**

```text
Prepares students with the knowledge and skills required to effectively assess and treat persons with substance abuse problems and other addiction disorders.  Topics include theory and techniques of assessment and counseling approaches for individuals with addiction disorders, working with family and significant others, dynamics of counseling special populations, and case management.  This course is taken concurrently with CHS 370.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ LLM returned non-JSON response

---

### `13.d` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of systemic causes of poverty and its implications._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[13][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 255 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses 'an understanding of systemic causes of poverty and its implications' by listing specific courses (CHS 101, 201, 220, 224, 430, and field placements) where this content is taught. This matches verbatim the Standard 13.d specification language.

```text
An understanding of systemic causes of poverty and its implications.Response:An examination of systemic causes of poverty and its implications, is included in CHS 101, CHS 201, CHS 220, CHS 224 and CHS 430, as well as in field placements CHS 380, 440 and 441.  In CHS 101 Family Studies, students are introduced to this material within a “Family Studies” context by assigned reading and in corresponding in-class discussion and lecture.  CHS 105 Human Services and Social Policy addresses economic and social class systems including systemic causes of poverty within the context of human services agencies. This subject matter is conveyed by in class activities and assignments (Team Research Project). Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 201 syllabus.  CHS 220 Diversity and Cultural Competence addresses issues of economic and social class systems, including systematic causes of poverty, as a component of diversity and cultural competence. CHS 224 Research Methods and Writing includes analysis of studies documenting these social issues. CHS 430 addresses economic and social class systems including systemic causes of poverty as they are associated with treatment of family issues through lecture and corresponding outside reading (CHS 430 Family Dynamics and Interventions syllabus) and in group presentations by students (Group Project).  Field Placements CHS 380 and CHS 440.Required courses in other majors which address the systemic causes of poverty include PSY 101 (lecture, class discussion, assignments, and reading.), PSY 108 (lecture, class discussion, assignments, and reading.), and SOC 101 (lecture, discussion, and reading.).
```

##### Narrative 2 — 🟡 conf 0.78, 168 words, `review_low_confidence`

_Source heading:_ **DiAngelo opens with how our country was founded on race and unequal power, she uses an example that could be understood **

_AI rationale:_ The section explicitly analyzes systemic causes linking race, institutional power, poverty, wage inequality, and neighborhood segregation—directly addressing the spec's requirement for understanding systemic causes of poverty and its implications in human service contexts.

```text
DiAngelo opens with how our country was founded on race and unequal power, she uses an example that could be understood by the masses explaining how men gave women the right to vote. She claims that this practice continues through “group prejudice backed by institutional power.” Her claim is easily seen through school and neighborhood segregation, she notes that bad neighborhoods are considered neighborhoods with people of color. What she fails to address about the school and neighborhood segregation is why this occurs; lower class neighborhoods are generally filled with people of color because of the cycle of poverty, statistics reveal that people of color are paid less than their white counterparts as well as the fact that women of color are paid even less then men of color. White supremacy is the dominant factor in these examples. While I feel that she does address neighborhood segregation she fails to address the cause (poverty) and without, there is a loss in the value of the information she presents.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[13][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence (syllabi, assignments, student work samples, or rubrics) provided to verify that courses actually teach systemic causes of poverty
- ⚠️ Narrative lists courses but provides minimal detail on specific content, learning outcomes, or assessment methods demonstrating mastery of this competency
- ⚠️ No evidence of student learning or competency demonstration (exams, papers, projects, reflections) that shows students understand systemic causes
- ⚠️ Field placement learning (CHS 380, 440, 441) mentioned but not described—no evidence of how placement experiences build understanding of systemic poverty
- ⚠️ Second paragraph appears to be student work/reflection on DiAngelo rather than institutional evidence of curriculum design or assessment
- ⚠️ No clear connection between 'understanding systemic causes' and 'implications'—implications are largely absent
- ⚠️ PSY 101, PSY 108, SOC 101 are mentioned as 'required courses in other majors' but unclear how/whether CHS majors take these or how they integrate into CHS curriculum
- ⚠️ No assessment data, rubrics, or evaluation criteria showing how the program measures whether students achieve this specification

---

### `13.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of national and global social policies and their influence on human service delivery._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[13][e].content`_

##### Narrative 1 — 🟢 conf 0.96, 215 words, `auto_accept`

_Source heading:_ **e.**

_AI rationale:_ The section directly addresses the specification 'An understanding of national and global social policies and their influence on human service delivery' by documenting courses (CHS 101, 105, 220, 430) and assignments that teach this content.

```text
An understanding of national and global social policies and their influence on human service delivery.Response:National and global social policies are addressed is CHS 101, CHS 201, CHS 220, and CHS 430.  In CHS 101 Family Studies, students are introduced to this material by assigned reading and in corresponding in-class discussion and lecture (see schedule). CHS 105 Human Services and Social Policy addresses national and global aspects of human services (Course Objectives 3, 4, 5, and 6.). This subject matter is conveyed by in class activities, readings and discussion. Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.In CHS 220 Diversity and Cultural Competence, students complete a detailed report on a country of their choice and present it to the class. This assignment leads to discussions of global issues in human services delivery (see sample of a country report).  CHS 430 Family Dynamics and Interventions covers these issues in the context of family systems and specifically through lecture and discussion of international study of family therapy (e.g., Milan Therapy; see schedule).Field Placements CHS 380 and CHS 440.Required courses in other majors which address national and global social policy issues include PSY 101 (lecture, class discussion, assignments, and reading.) and SOC 101 (lecture, discussion, and reading.).
```

##### Narrative 2 — 🟡 conf 0.68, 253 words, `review_low_confidence`

_Source heading:_ **In regard to the LGBTQ+ community, South Korea, especially within the Christian population of South Korea, is primarily **

_AI rationale:_ The section describes South Korea's national social policies regarding LGBTQ+ rights, discrimination protections, and government actions (censorship, military service restrictions, marriage recognition) and their influence on the LGBTQ+ community's access to services and civil participation—directly addressing how national and global social policies influence human service delivery and equity.

```text
In regard to the LGBTQ+ community, South Korea, especially within the Christian population of South Korea, is primarily conservative (Manzella, 2018). There have never been official laws that prohibit sex marriage or homosexual sex, but being gay, lesbian, or transgender is still a cultural taboo; most of the homosexual population in South Korea is still closeted (Manzella, 2018). Also, although there have not been laws specifically prohibiting same-sex marriage, this type of marriage is not recognized by the government and the population does not have laws against discrimination (Manzella, 2018). South Koreans who identify as LGBTQ+ are unable to adopt children or serve in the military (Manzella, 2018). Through censorship, the government has blocked same-sex dating apps and Korean Christian organizations often fuel campaigns that spread the message of marriage strictly being between a man and a woman (Manzella, 2018). Specifically with transgender individuals, only when they surgically change their sex can they officially change their sex from a male to a female or a female to a male (Manzella, 2018). Despite all of these bumps on the road for South Korea’s LGBTQ+ population, more than half of South Korean’s overall population supports same-sex marriage (Manzella, 2018). Korea is home to an annual pride event that occurs annually, as well as a Queer Culture Festival (although it had to go to court due to police banning this event) (Manzella, 2018). The progress is slow, it is an ongoing battle, but the LGBTQ+ community is is slowly but surely gaining momentum is South Korea.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[13][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided (syllabi, assignments, rubrics, or student work samples) to verify that courses actually teach national and global social policies and their influence on human service delivery
- ⚠️ Vague course descriptions lack specificity about *which* national and global policies are taught (e.g., healthcare policy, welfare reform, immigration policy, child protection laws, mental health parity legislation)
- ⚠️ No clear connection demonstrated between policy content and *influence on human service delivery*—the specification requires understanding how policies shape service systems, not just awareness that policies exist
- ⚠️ South Korea LGBTQ+ policy example appears disconnected from the main response and lacks context for how this policy knowledge influences human service delivery
- ⚠️ No evidence that field placements (CHS 380, CHS 440) integrate policy learning or require students to analyze how policies affect their practice settings
- ⚠️ Cross-listed courses (PSY 101, SOC 101) are mentioned but no evidence provided that these courses explicitly address the specification or how they integrate into the human services curriculum
- ⚠️ No assessment data, student learning outcomes, or evaluation methods documented to demonstrate student mastery of understanding policies and their influence on service delivery

---

### `13.f` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing. 4. Discipline Inquiry and Information Literacy Context: The delivery of human services depends on the appropriate integration of various forms of information._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[13][f].content`_

##### Narrative 1 — 🟡 conf 0.68, 146 words, `review_low_confidence`

_Source heading:_ **f.**

_AI rationale:_ The section directly addresses constituency building and advocacy skills including lobbying, grassroots movements, and community development and organizing, which matches the exact language in Standard 13.f. The narrative documents how these competencies are integrated across multiple courses (CHS 101, 105, 220, 224, 430, 380, 440) and field placements.

```text
Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing.Response:Constituency building and advocacy issues are introduced in CHS 105 Human Services and Social Policy and are a significant part of the Community Needs assignment. These issues are also addressed in CHS 101, CHS 220, CHS 224, and CHS 430.  In CHS 101 Family Studies, advocacy is covered specifically as it relates to family policies. CHS 220 Diversity and Cultural Competence emphasizes constituency building and advocacy in the context of diversity issues through lecture, discussion, and assignments (see specifically the Social Justice section of the schedule). CHS 224 Research Methods and Writing addresses grassroots and community development issues as they relate to compiling research to support program proposals.Field Placements CHS 380 and CHS 440.Required courses in other majors which address constituency building and advocacy include SOC 101 (lecture, discussion, and reading.).
```

##### Narrative 2 — 🟡 conf 0.72, 580 words, `review_letter_disagrees`

_Source heading:_ **a.**

_AI rationale:_ The section describes curriculum across 11 courses teaching students to obtain, synthesize, and clearly report information from various sources—core to information literacy and discipline inquiry. Standard 13.f explicitly addresses 'Discipline Inquiry and Information Literacy' with context stating 'The delivery of human services depends on the appropriate integration of various forms of informatio

```text
Obtain, synthesize, and clearly report information from various sources.Response: (see observation of systems below)Skills to obtain, synthesize, and clearly report information are provided in the following human services courses:  CHS 101, 105, 217, 220, 224, 315, 360, 380, 430, 440, and 441. CHS 101 Family Studies introduces the process of gathering information through library research, particularly in the Issue Presentation project. CHS 105 Human Services and Social Policy addresses skills to gather information through client observation, interviewing, active listening, consultation with others, library or other research, and the observation of clients and systems (See Course Objectives 2, 3, 4, 5, and 7). This subject matter is conveyed by in-class activity and a group assignment also related to these issues (Team Research Project). Lectures about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  As of Fall 2019, a new course CHS 217 Professional Development in Counseling & Human Services will be required. This course will incorporate professional writing and communication skills and career-related information gathering.  CHS 220 Diversity and Cultural Competence addresses skills to gather information through client observation, interviewing, active listening, consultation with others, and library or other research (Course Objective 1, 2, 3, 4, and 5).  This is accomplished through in-class activities and discussion, media presentations, lecture, assigned readings, and out-of-class assignments. Students obtain, synthesize and report information in the country research project. CHS 224 Research Methods and Writing focuses extensively on the skill of gathering information through reviewing research literature. See particularly the critical analysis assignment. This course is designated as a “writing intensive” course and the skills related to clearly communicating information that has been obtained are strong
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[13][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[13][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided (syllabi, assignments, course schedules, rubrics) to verify claims about course content and learning outcomes
- ⚠️ Constituency building component is vaguely described; no concrete examples of how students learn to build constituencies or what deliverables demonstrate this skill
- ⚠️ Lobbying skills are mentioned in specification but not addressed in narrative response
- ⚠️ Grassroots movements instruction claimed but not substantiated with course details, assignments, or assessment methods
- ⚠️ Community organizing skills mentioned in specification but narrative focuses primarily on community development; distinction unclear
- ⚠️ Information literacy context is addressed but lacks integration with advocacy/constituency building components as the specification requires
- ⚠️ No evidence of how 'discipline inquiry' specifically relates to human services advocacy work
- ⚠️ Field placement courses (CHS 380, 440) claim to address these topics but narrative ends mid-sentence without completion
- ⚠️ No assessment data or student learning outcomes demonstrating mastery of advocacy skills
- ⚠️ SOC 101 is mentioned as addressing constituency building but no detail provided about content or relevance to human services

---

## Standard 14

### `14.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Obtain, synthesize, and report information from various sources._

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[14][a].content`_

##### Narrative 1 — 🟡 conf 0.72, 411 words, `review_low_confidence`

_Source heading:_ **a.**

_AI rationale:_ The section describes knowledge and skills to analyze and assess client needs across multiple courses and field placements, which directly aligns with Standard 14.a on assessing client needs and strengths as part of program planning and evaluation context. Standard 15.a (client interventions and strategies) is a secondary fit since assessment often precedes intervention design.

```text
Knowledge and skills to analyze and assess the needs of clients or client groups.Response:The knowledge and skills to analyze and assess the needs of clients or client groups is included in: CHS 105, 224, 360, 340, 430, 380 and 440. The objectives of CHS 105 Human Services and Social Policy include the application of skills to analyze and assess the needs of clients (Course Objectives 1 and 7). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus (See schedule).  CHS 224 Research Methods and Writing incorporates the analysis and assessment of client needs as part of the research proposal process.CHS 360 Counseling Strategies for Individuals addresses skills to analyze and assess the needs of clients within the context of individual counseling strategies (Course Objectives 2 and 3) and does so through in-class activity and discussion and out-of-class assignments (See Interview Project). CHS 360 focuses on the interviewing process as one way to analyze the needs of clients (see schedule).CHS 340 Administration of Human Services emphasizes the analysis and assessment of the needs of clients as a recurring and fundamental topic related to the effectiveness of any human services agency (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment).  CHS 430 Family Dynamics and Interventions addresses how to analyze and assess the needs of clients as it is associated with treatment of family issues through lecture and corresponding outside reading (see schedule) and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention and issues.  The class then discusses how the present
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.82, 411 words, `review_letter_disagrees`

_Source heading:_ **b.**

_AI rationale:_ The section describes skill training in assessing and analyzing client needs through observation, interviewing, active listening, consultation, and research—core competencies directly aligned with Standard 14.a (Knowledge and skills to assess client needs and strengths). Standard 14 establishes program planning and evaluation as foundational, and assessment of needs is the prerequisite step.

```text
Assess and analyze the needs of clients or client groups through observation, interviewing, active listening, consultation, and research.Response: The following human services courses include skill training in how to assess and analyze the needs of clients or client groups:  CHS 105, 224, 315/515, 360, 340, 430, 380, and 440.  The objectives of CHS 105 Human Services and Social Policy emphasize analyzing and addressing the needs of specific clients or client groups (Course Objectives 2, 3, 4, 5, 7, and 8.). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group using observation, interviewing, active listening, consultation, and research (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  CHS 224 Research Methods and Writing focuses on assessing and analyzing client needs as related to designing and proposing an intervention strategy (see research proposal project).CHS 315 Group Counseling addresses how to assess the needs of clients and client groups through observation, interviewing and active listening within the context of Group Counseling. All course objectives relate to this skill, but see specifically #6. The skills are conveyed through in-class activity and discussion, out-of-class assignments (Course Requirements #3 Papers and #5 Group Proposal), corresponding assigned readings, and lecture, as detailed in the course syllabus.  CHS 360 Counseling Strategies for Individuals addresses how to assess the needs of clients through observation, interviewing and active listening through in-class activity and discussion, lecture and assigned readings corresponding to the syllabus.  CHS 360 focuses on the interviewing process as one such intervention modality (see schedule). CHS 430 Family Dynamics and Interventions addresses assessing the needs of fam
… (truncated, full text imported)
```

##### Narrative 3 — 🟡 conf 0.62, 93 words, `review_low_confidence`

_Source heading:_ **The best way to can develop writing skills in writing literature reviews is to read others' literature reviews. The writ**

_AI rationale:_ The section addresses instruction on synthesizing and organizing information from multiple sources (literature review best practices using at least 8 primary sources), which directly aligns with Standard 14.a's requirement to 'obtain, synthesize, and report information from various sources.' This is pedagogical guidance on information literacy and research methodology.

```text
The best way to can develop writing skills in writing literature reviews is to read others' literature reviews. The write-up should reveal what is known about the topic generally, theoretically, and empirically, and the variables in your proposal. Your reader should have a fair knowledge of what others have said or found about your topic from the write-up.  Organize the literature review by themes or subthemes.  It’s a good idea to use your variables as themes or subthemes. WHY IS THIS TOPIC RELEVANT/ IMPORTANT/NECESSARY? Remember to Use at least eight (8) primary sources.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[14][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ Specification 14.a requires demonstration of ability to 'obtain, synthesize, and report information from various sources' but narrative focuses primarily on assessing client needs rather than the information synthesis and reporting competency
- ⚠️ No evidence of curriculum content addressing how to identify, locate, and obtain information from diverse sources (academic databases, primary sources, secondary sources, community resources, etc.)
- ⚠️ Missing evidence demonstrating synthesis skills—how students integrate and analyze information from multiple sources to draw conclusions or create new understanding
- ⚠️ No documentation of reporting/communication formats (written reports, oral presentations, policy briefs, data summaries) required across courses
- ⚠️ Narrative contains irrelevant content about literature review writing that does not correspond to Specification 14.a requirements
- ⚠️ Supporting evidence section is completely empty—no syllabi, assignments, rubrics, or student work samples provided
- ⚠️ No evidence showing use of 'various sources' (e.g., empirical research, statistical data, community data, policy documents, expert consultation)
- ⚠️ Missing assessment data demonstrating student proficiency in obtaining, synthesizing, and reporting information

---

### `14.b` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Assess the quality of information from various sources, including but not limited to print, audio, video, web, and social media, and understand its application._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[14][b].content`_

##### Narrative 1 — 🟢 conf 0.98, 414 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section content directly and explicitly matches Standard 14.b, which specifies assessing quality of information from various sources (print, audio, video, web, social media) and understanding its application. The narrative maps course-by-course coverage of this exact competency.

```text
Assess the quality of information from various sources, including but not limited to: print, audio, video, web, and social media, and understand its application.Response:Skills to assess the quality of information from various sources are emphasized in all courses that require the gathering of information, which include: CHS 101, 105, 220, 224, 340, 380, 430, 440 and 441. CHS 101 Family Studies includes a research project in which students need to research an issue related to families and report to the class on their findings (Issue Presentation assignment). CHS 105 Human Services and Social Policy addresses skills to gather and assess the quality of information in a number of ways (See Course Objectives 1 and 7.). This subject matter is conveyed by in class activity and a group assignment related to these issues (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  CHS 220 Diversity and Cultural Competence requires students to gather and assess the quality of information related to diverse populations (see particularly the Immigrant Interview and Group Presentation assignments). CHS 224 Research Methods and Writing emphasizes the critical analysis of research findings throughout the course, but see particularly the Research Proposal project. CHS 340 Administration of Human Services addresses skills related to assessing the quality of information as a vital component of administration and management through in-class activities, discussion , lecture and assigned readings corresponding to the syllabus.  CHS 380 Internship addresses these skills through in-class discussion (students discuss their particular internship site approaches) and through journaling. These topics are also covered through orientation and participation at each student’s placement and Reflection Papers.  Lecture is provided by the instructor and several guest speakers who discuss the importance of critically
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[14][b].supportingEvidenceText`_

##### Evidence text 1 — conf 0.68, 218 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Scholarly-Use for paper
Popular-DO NOT USE
These periodicals are called:
Journals
Scholarly journals
Peer reviewed journals
Refereed journals
These periodicals are called:
Magazines
Digests
Their intended audience is:
Scholars within one academic discipline
Subject specialists
Their intended audience is:
The general reader
A specific demographic group
Enthusiasts or hobbyists with common interests
Journals publish:
Original scholarly research including abstracts, methodology, conclusions and cited references
Discussions of current topics within an academic discipline
Magazines publish:
Articles related to the theme of the magazine
News oriented articles
First person accounts
Articles summarizing current research for an average reader
Published articles must:
Be submitted by recognized scholars in the field
Pass a rigorous review by a panel of subject experts (
peer-review
)
Meet strict guidelines for format and content
Published articles are:
Written by a magazine’s own staff writers
Submitted by freelance writers
Generally checked for factual accuracy
Edited for style, grammar, and punctuation
Journals include:
Advertisements for other scholarly publications, scholarly conferences or professional products
Illustrations or photographs that enhance the understanding of an article
Magazines include:
Vast quantities of glossy advertisements
Eye catching illustrations and photographs
Visual effects to grab a reader’s attention
Journals are published by:
Scholarly or professional 
… (truncated, full text imported)
```

##### Evidence text 2 — conf 0.68, 52 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Scholarly Journals
Popular Magazines-DO NOT USE
American Journal of Psychology
Psychology Today
Women’s Studies Quarterly
Ladies Home Journal
Science
Scientific American
Current Issues in Psychological Science
National Geographic
Journal of American History
Time
Journal of Marriage and the Family
Family Circle
JAMA (Journal of the American Medical Association)
Health
Child Development
Parents
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence of instruction or assessment of audio sources (podcasts, audiobooks, recorded interviews, etc.)
- ⚠️ No evidence of instruction or assessment of video sources (documentaries, news broadcasts, YouTube, streaming content, etc.)
- ⚠️ No evidence of instruction or assessment of social media sources (Facebook, Twitter, Instagram, TikTok, etc.) or their credibility challenges
- ⚠️ No evidence of explicit web evaluation skills (domain analysis, website authority, fact-checking websites, identifying misinformation/disinformation)
- ⚠️ Supporting evidence is limited to journal vs. magazine distinction only; does not address all source types listed in the specification
- ⚠️ No documentation of student assignments or assessments that specifically evaluate these multiple source types
- ⚠️ Narrative lacks specific learning outcomes or rubrics demonstrating how students demonstrate competency in assessing quality across diverse media formats
- ⚠️ Missing evidence of how students apply their assessment skills in real-world contexts with contemporary media

---

### `14.c` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Upholding confidentiality and using appropriate means to share information._

**Final coverage verdict:** covered=**False**, score=**0.65**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.65, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[14][c].content`_

##### Narrative 1 — 🟢 conf 0.92, 213 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses the specification for upholding confidentiality and using appropriate means to share information, with detailed narrative describing course coverage, instruction methods, and field placement evaluation of this competency. The content maps precisely to Standard 14.c language.

```text
Upholding confidentiality and using appropriate means to share information.Response: Upholding client confidentiality and sharing information appropriately are consistently stressed throughout the program.  Specific courses that include instruction on this issue include: CHS 105, 224, 315, 360, 380, 430, 440, and 441. CHS 105 Human Services and Social Policy addresses issues of confidentiality and appropriate sharing of information (Course Objective 4). This skill is covered in lecture and reading (See CHS 105 schedule, classes on “The Helping Process” and “Professional, Legal, and Ethical Issues”).  CHS 224 Research Methods and Writing covers client confidentiality as an important consideration in the research process (Course Objective 5; Week 4 on Ethics in Social Science Research).Professional practice courses CHS 315 Group Counseling (Course Objective 5), CHS 360 Counseling Strategies for Individuals (Course Objective 4) and CHS 430 Family Dynamics and Interventions emphasize confidentiality as part of the treatment process. This skill is also an integral part of the CHS 380 Internship, CHS 440 Practicum, and CHS 441 Seminar courses and is an important part of the site requirements. Students are mentored and evaluated by their field instructor on their ability to “protect the client's right to privacy and confidentiality except when such confidentiality would cause harm to the client or others” (See Student Field Placement Evaluation, Section III).
```

##### Narrative 2 — 🟢 conf 0.88, 68 words, `auto_accept`

_Source heading:_ **Ethical behavior in the field involves making sound decisions concerning issues such as confidentiality.  Information re**

_AI rationale:_ The section directly addresses confidentiality as a core ethical and professional issue in human services practice, which matches Standard 14.c's explicit specification on 'upholding confidentiality and using appropriate means to share information.' While the passage references NOHS ethical standards more broadly, the confidentiality focus is the primary content.

```text
Ethical behavior in the field involves making sound decisions concerning issues such as confidentiality.  Information regarding clients/personnel must be kept confidential and shared only in an appropriate professional context.  Confidentiality is a significant aspect of professionalism and must be maintained at all times.  Standards that address confidentiality and other ethical issues are contained in the code of standards of the National Organization for Human Services (Please see Appendix).
```

##### Narrative 3 — 🟡 conf 0.72, 65 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 9 When providing services through the use of technology, human service professionals take precautions to ensure**

_AI rationale:_ The section directly addresses upholding confidentiality when using technology and ensuring clients are aware of confidentiality concerns, which aligns with Standard 14.c's specification on upholding confidentiality and using appropriate means to share information. Standard 19.c on confidentiality of information is a secondary match given the emphasis on technology-mediated service delivery.

```text
STANDARD 9 When providing services through the use of technology, human service professionals take precautions to ensure and maintain confidentiality and comply with all relevant laws and requirements regarding storing, transmitting, and retrieving data. In addition, human service professionals ensure that clients are aware of any issues and concerns related to confidentiality, service issues, and how technology might negatively or positively impact the helping relationship.
```

##### Narrative 4 — 🟡 conf 0.68, 52 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 42 Human service educators establish and uphold appropriate guidelines concerning student disclosure of sensiti**

_AI rationale:_ The narrative addresses educator guidelines for managing student self-disclosure, confidentiality, and appropriate processing mechanisms. Standard 14.c on 'upholding confidentiality and using appropriate means to share information' is the closest match, as it concerns protection of sensitive information in educational contexts. Standard 19.c on confidentiality is a secondary fit for knowledge/valu

```text
STANDARD 42 Human service educators establish and uphold appropriate guidelines concerning student disclosure of sensitive/personal information which includes letting students have fair warning of any self-disclosure activities, allowing students to opt-out of in-depth self-disclosure activities when feasible, and ensuring that a mechanism is available to discuss and process such activities as needed.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[14][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, course schedules, evaluation forms, or NOHS code referenced in narrative are missing)
- ⚠️ No demonstration of how confidentiality instruction addresses technology-related concerns (STANDARD 9 mentioned but not evidenced in courses or field placements)
- ⚠️ No evidence of student guidelines or opt-out mechanisms for self-disclosure activities (STANDARD 42 requirements not demonstrated)
- ⚠️ Internship/practicum evaluation form cited but not attached to verify confidentiality assessment criteria
- ⚠️ No evidence of how clients are informed about confidentiality limits, exceptions (harm clause), or technology risks
- ⚠️ Narrative lists courses but provides no syllabi excerpts, assignment descriptions, or learning outcomes documentation
- ⚠️ No evidence of field site requirements documentation that supposedly emphasizes confidentiality

---

### `14.d` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Using technology, including artificial intelligence, to locate, evaluate, and disseminate information. 5. Program Planning and Evaluation Context: A significant component of the human services profession involves assessing the needs of clients and client groups, and planning programs and interventions to assist them in promoting optimal functioning, growth, and goal attainment. At regular intervals, the outcomes must be evaluated, and necessary adjustments made to the plan, both at an individual client and program level._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[14][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 181 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses using technology to locate, evaluate, and disseminate information with specific course examples and assignments, matching Standard 14.d language precisely, including the new mention of artificial intelligence in the current spec.

```text
Using technology to locate, evaluate, and disseminate information. Response:Skills regarding the use of technology to locate, evaluate, and disseminate information are basic expectations in all courses. Specific courses that address this issue, particularly as it relates to information literacy, include: CHS 101, 105, 217, 220, 224, 340, 380, 430, 440, and 441.  Each of these courses requires a research project that involves locating and evaluating information. For example, in CHS 105 Human Services and Social Policy, the Team Research Project requires the use of technology for locating and evaluating information. CHS 224 Research Methods and Writing in particular is devoted to teaching students the skills required to effectively locate and evaluate information (see Critical Analysis assignment). In CHS 220 Diversity and Cultural Competence, students use technology to locate information for the country report assignment. In the new CHS 217 Professional Development course, students will use technology to gather and professionally present career-related information.The use of technology to locate and disseminate information is expected in CHS 380 Internship, CHS 440 Practicum, and CHS 441 Seminar (See syllabi and Student Evaluation item I.A.).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[14][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[14][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided: narrative cites syllabi, assignments (Critical Analysis, Team Research Project, country report), and Student Evaluation item I.A., but NONE of these documents are attached or submitted for review
- ⚠️ AI component missing: Specification explicitly requires 'including artificial intelligence' but narrative makes no mention of how AI tools (ChatGPT, research databases with AI features, AI-assisted literature review, etc.) are taught or integrated
- ⚠️ Evaluation/dissemination underdeveloped: narrative emphasizes 'locating and evaluating information' but provides minimal evidence of 'disseminate information' component—only brief mention of CHS 217 'professionally present' without detail
- ⚠️ Program-level planning/evaluation connection unclear: Specification's context emphasizes 'program planning and evaluation' and 'adjustments made to the plan at individual client and program level,' but narrative does not connect technology use to program assessment, outcome evaluation, or data-driven decision-making
- ⚠️ Client/population needs assessment missing: no evidence that students learn to use technology to assess client needs or program outcomes, which is central to the Specification's intent
- ⚠️ No demonstration of student learning outcomes: narrative lists courses but provides no evidence of what students actually know or can do with technology after instruction

---

## Standard 15

### `15.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Knowledge and skills to analyze and assess the needs of clients or client groups._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[15][a].content`_

_(no narrative content auto-applied)_
#### Supporting evidence — text
_Destination: `Submission.narratives[15][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[15][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Curriculum matrix cells
_Destination: `CurriculumMatrix.cells[]`_

- matrix: `(curriculum matrix table)`, col -1, code `(see matrix extractor)`, types [], depth `—`

#### Gaps still remaining (user must address manually after import)
- ⚠️ No narrative describing how the program teaches students to analyze client/client group needs
- ⚠️ No evidence of curriculum content addressing needs assessment frameworks or models
- ⚠️ No demonstration of assessment methods (e.g., interviews, observations, standardized tools) taught to students
- ⚠️ No evidence of coursework or learning outcomes related to individual vs. group-level needs analysis
- ⚠️ No documentation of how students practice or apply needs assessment skills (practicum, case studies, simulations)
- ⚠️ No evidence of evaluation of student competency in needs analysis and assessment
- ⚠️ No supporting materials such as syllabi, assignments, rubrics, or student work samples demonstrating this competency

---

### `15.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Skills to develop goals, design and implement a plan of action._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[15][b].content`_

##### Narrative 1 — 🟢 conf 0.96, 387 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses skills to develop goals and design and implement a plan of action across seven courses (CHS 105, 224, 360, 340, 430, 380, 440), which is the exact wording of Standard 15.b. The narrative documents course objectives, assignments, and pedagogical methods supporting this core competency.

```text
Skills to develop goals, and design and implement a plan of action.Response: The skills to develop goals and design and implement a plan of action are included in: CHS 105, 224, 360, 340, 430, 380 and 440. The objectives of CHS 105 Human Services and Social Policy include the application of skills to develop goals and design and implement a plan of action (Course Objectives 1 and 7). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group that includes proposing goals and a plan of action to address those needs (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  CHS 224 Research Methods and Writing incorporates the development of goals and design and implementation of a plan of action as part of the research proposal process.CHS 360 Counseling Strategies for Individuals addresses skills to develop goals and design and implement a plan of action within the context of individual counseling strategies (Course Objectives 2 and 3) and does so through in-class activity and discussion and out-of-class assignments (See Interview Project). CHS 340 Administration of Human Services emphasizes the development of goals and design and implement a plan of action as a recurring and fundamental topic related to the strategic planning of human services agencies (in-class activities discussions, media presentations, lectures, assigned readings; see schedule).  CHS 430 Family Dynamics and Interventions addresses how to develop goals and design and implement a plan of action as associated with treatment of family issues through lecture and corresponding outside reading  and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention and issues.  The class then discusses how the presenting grou
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[15][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[15][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, course materials, assignments, rubrics) to verify claims about course content and learning activities
- ⚠️ No specific examples of student learning outcomes or assessment data demonstrating students actually acquired these skills
- ⚠️ Specification requires 'skills' (plural, actionable competencies) but narrative lists only courses without defining what specific, measurable skills students develop
- ⚠️ No evidence of how 'design and implement' is distinguished from 'develop goals' in instruction or assessment
- ⚠️ Vague descriptions of learning activities ('in-class activities,' 'discussions,' 'lectures') lack detail about how skill development is structured or scaffolded
- ⚠️ No documentation of assessment methods or rubrics used to evaluate student competency in goal-setting and action planning
- ⚠️ Missing evidence of how skills are evaluated across field placements (CHS 380, 440) with concrete examples of student performance

---

### `15.c` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Skills to evaluate the outcomes of the plan and the impact on the client or client group. 6. Client Interventions and Strategies Context: Human service professionals function as change agents and must therefore attain and develop a core of knowledge, theory, and skills to provide direct services and interventions to clients and client groups._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[15][c].content`_

##### Narrative 1 — 🟢 conf 0.92, 342 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses skills to evaluate outcomes of plans and their impact on clients/client groups across multiple courses (CHS 105, 224, 340, 430, 380, 440), matching Standard 15.c's specification on client intervention evaluation skills within the Knowledge, Theory, Skills, and Values framework for direct services.

```text
Skills to evaluate the outcomes of the plan and the impact on the client or client group.Response: The skills to evaluate the outcomes of the plan and the impact on the client or client group are included in: CHS 105, 224, 340, 430, 380 and 440. The objectives of CHS 105 Human Services and Social Policy include the application of skills to evaluate the outcomes of the plan and the impact on the client (Course Objectives 1 and 7). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group that includes proposing a plan to address those needs and evaluate the outcome (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus (See schedule).  CHS 224 Research Methods and Writing incorporates the evaluation of outcomes as a primary measurement issue in the research proposal process.CHS 340 Administration of Human Services emphasizes the evaluation of outcomes and the impact on the client as a recurring and fundamental topic related to the strategic planning of human services agencies (in-class activities discussions, media presentations, lectures, assigned readings; see schedule).  CHS 430 Family Dynamics and Interventions addresses how to evaluate the outcomes of the plan and the impact on the client as associated with treatment of family issues through lecture and corresponding outside reading and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention and issues.  The class then discusses how the presenting group evaluated the outcomes of the intervention. Evaluating the outcomes of the plan and the impact on the client is addressed in CHS 380 Internship and CHS 440 Practicum as an integral part of the field placement experiences and through class discussion, assigned readings, and
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[15][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[15][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided (syllabi, assignment rubrics, course schedules, student work samples) to verify claims about course content and learning activities
- ⚠️ Lacks explicit evidence that students develop evaluative SKILLS (not just knowledge); narrative describes what courses cover the topic but not how students practice or demonstrate competency in outcome evaluation
- ⚠️ No documentation of assessment methods or criteria used to measure whether students actually achieve the skill of evaluating plan outcomes and client impact
- ⚠️ Missing evidence of what 'evaluation of outcomes' specifically entails—no examples of evaluation tools, frameworks, or methodologies students learn to use
- ⚠️ No demonstration of how skills progress across the curriculum from foundational (CHS 105) to applied (CHS 380, 440)
- ⚠️ Internship and Practicum (CHS 380, 440) described only by teaching methods (journaling, discussions, guest speakers) without evidence of direct student application or evaluation of actual client outcomes
- ⚠️ No student learning outcome statements or competency rubrics demonstrating mastery of outcome evaluation skills

---

## Standard 16

### `16.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Intake interviewing_

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative describing how intake interviewing knowledge is taught or integrated into curriculum
- ⚠️ No narrative explaining theoretical foundations of intake interviewing
- ⚠️ No narrative detailing specific skills students develop in intake interviewing
- ⚠️ No narrative addressing professional values related to intake interviewing
- ⚠️ No syllabus, course materials, or assignment descriptions demonstrating intake interviewing content
- ⚠️ No evidence of learning outcomes or competencies specific to intake interviewing
- ⚠️ No documentation of instructional methods (e.g., role plays, simulations, practice interviews)
- ⚠️ No evidence of assessment strategies measuring student competency in intake interviewing
- ⚠️ No evidence of field placement or practicum requirements involving intake interviewing
- ⚠️ No readings, frameworks, or theoretical models cited to support intake interviewing instruction

---

### `16.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Helping skills:_

**Final coverage verdict:** covered=**False**, score=**0.35**
_(first-pass: covered=False, score=0.35; second-pass after gap-fill: covered=False, score=0.35, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[16][b].content`_

##### Narrative 1 — 🟡 conf 0.72, 82 words, `review_low_confidence`

_Source heading:_ **As this is a skills-based course, there will be many hands-on activities designed to practice and 			perform individual **

_AI rationale:_ The section describes pedagogical design for practicing and performing counseling skills through hands-on activities, role-play, and demonstration of interpersonal competencies—directly aligned with Standard 16.b's 'Helping skills' specification. The reflection component also connects secondarily to 20.e on professional self-reflection.

```text
As this is a skills-based course, there will be many hands-on activities designed to practice and 			perform individual counseling skills. Students’ participation in these activities is critical to the learning 		process. Grading of students participation in these activities will take into consideration students’ 		demonstration of knowledge and understanding of the skills, willingness to try new strategies and even 		make mistakes. In addition to role-play activities, students will also be assessed on their contribution 		to classroom discussions and participation in guided self-reflection activities.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[16][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[16][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No identification of specific helping skills being taught (e.g., attending, reflection, summarization, confrontation, etc.)
- ⚠️ No description of theoretical frameworks or models underpinning the skills instruction
- ⚠️ No evidence of how values (e.g., cultural competence, ethical practice, client-centered approach) are integrated into helping skills development
- ⚠️ No supporting evidence provided (syllabus, rubrics, assignments, course materials) to document what is actually taught
- ⚠️ No explanation of how students demonstrate competency or mastery of specific helping skills
- ⚠️ No mention of feedback mechanisms or how students receive evaluative input on skill performance
- ⚠️ Vague assessment criteria ('willingness to try') without clear skill-based learning outcomes
- ⚠️ No reference to how helping skills align with counseling standards or professional competencies

---

### `16.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Identification and use of appropriate resources and referrals. 2. Group facilitation 3. Use of consultation 7. Interpersonal Communication Context: The ability to create genuine and empathic relationships with others is central to the human services profession. These skills are applicable to all levels of education, and a greater proficiency is expected at each progressively higher level._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[16][c].content`_

##### Narrative 1 — 🟢 conf 0.85, 951 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses identification and use of appropriate resources and referrals, intake interviewing, helping skills, and interpersonal communication—all core elements of Standard 16.c Knowledge, Theory, Skills, and Values in the current spec. The narrative maps these competencies across multiple courses with course objectives and field evaluation evidence.

```text
Knowledge and skill development in:Case managementIntake interviewingResponse:	Intake interviewing is addressed in the following human services courses: CHS 105, 315/515, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn about intake interviewing through the Team Research Project. The topic is covered in numerous classes (see schedule).  This skill is a primary objective and focus of CHS 315/515 Group Counseling (Course Objective 6, schedule chapters 2 and 4) and CHS 360 Counseling Strategies for Individuals (Course Objective 2, Course Requirement #3 –Interview Projects, and schedule chapters 3-6).In CHS 430 Family Dynamics and Interventions, students learn about intake interviewing within the context of family interventions (Group Project Presentation and classes on interviewing techniques (e.g., genograms)).  CHS 380 Internship and  CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which intake interviewing techniques are learned and practiced. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Helping skillsResponse:Helping skills are addressed in all of the following human services courses: CHS 105, 315, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn basic listening skills and the importance of establishing a helping relationship. The topic is covered in numerous classes (see schedule).  This skill is the primary objective and focus of the two counseling skills courses: CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals (All Course Objectives and classes).In CHS 430 Family Dynamics and I
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.68, 77 words, `review_letter_disagrees`

_Source heading:_ **D.   Provides services w/o discrimination or preference based on age, ethnicity, culture, race, disability, gender, religion, sexual orientation or socioeconomic status.**

_AI rationale:_ The section's content focuses on interpersonal communication skills, caring, empathy, and respect in professional interactions—core elements of Standard 16.c's specification on interpersonal communication and the creation of genuine, empathic relationships. While ethical congruence (17.d) and self-development awareness (19.h) are secondary themes, the primary narrative emphasis is on relational an

```text
V:  Exhibits effective and appropriate interpersonal skills.

Communicates effectively with others, both orally and in writing.

Demonstrates caring, respect, empathy, and genuineness when interacting with others.

Establishes appropriate rapport with others.

VI:  Synthesizes and applies key concepts, methods and values in human services to professional situations.

Applies key concepts, perspectives, methods, and values related to human services.

Displays understanding of how services are delivered to individuals and families.

Helps others by using basic counseling/listening skills, as appropriate.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[16][c].supportingEvidenceText`_

##### Evidence text 1 — conf 0.62, 135 words, `review_low_confidence`

_Source heading:_ **How would you best succeed in this course?  You can best succeed by engaging in active and intentional reading/learning **

```text
How would you best succeed in this course?  You can best succeed by engaging in active and intentional reading/learning of the assigned materials and coming to class ready to actively participate in the class discussions by making comments, asking and answering questions.  This means you will read the materials for each class in advance.  To make everyone’s involvement possible, the class will be split into small groups to generate questions/comments on the week’s topic for class discussion.  In this way, all class members will have an opportunity to actively participate, talk, so we can all break the monotony of hearing just my voice.  Please note that if the class gets too quiet, I might call on class members to share their thoughts and I hope those so asked won’t consider it as “picking” on them.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[16][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ Group facilitation is mentioned in course titles (CHS 315/515 Group Counseling) but no narrative explanation of how this competency is taught, assessed, or demonstrated by students
- ⚠️ Use of consultation is not addressed anywhere in the narrative or evidence; this is a core element of Spec 16.c that is completely absent
- ⚠️ Interpersonal Communication Context is minimally addressed; while 'helping skills' and 'establishing helping relationships' are mentioned, there is no explicit discussion of creating genuine and empathic relationships or the progression of proficiency expected at the baccalaureate level
- ⚠️ Supporting evidence provided (one syllabus excerpt) is generic and does not demonstrate actual student learning outcomes, assignments, or assessments related to the four specific competencies listed in the specification
- ⚠️ No evidence of how proficiency in interpersonal communication is measured or evaluated beyond vague references to field instructor evaluations
- ⚠️ Narrative response is incomplete; it cuts off mid-sentence under 'Identification and use of appropriate resources and referrals' without finishing the response

---

## Standard 17

### `17.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Clarifying expectations._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[17][a].content`_

##### Narrative 1 — 🟢 conf 0.94, 331 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly addresses the skill of 'clarifying expectations' and documents how it is taught across multiple human services courses with detailed course mapping and evaluation methods. This matches Standard 17.a specification precisely.

```text
Clarifying expectations.Response: Clarifying expectations is addressed through in-class activities and discussions, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 101, 105, 224, 315/515, 360, 340, 430, 380, 440, and 441.  In CHS 101 Family Studies, students learn about effective communication in relationships, which includes clarifying expectations (see schedule, unit on Communication). In CHS 105 Human Services and Social Policy, students learn about different approaches to clarifying expectations in classes addressing “Defining Roles and Problems” and “The Helping Process.”  CHS 224 Research Methods and Writing addresses clarifying expectations as a step in the process of social science research (see the research proposal project; week 2 class topic).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both focus on clarifying expectations as an essential component of establishing a helping relationship and setting therapeutic goals. For CHS 315, see weeks 5 and 6 on Forming a Group and Initial Stage of a Group. For CHS 360, see chapters 2 – 6, but especially chapter 4 on Working at Mutual Understanding, as well as the two interview projects. Clarifying expectations is an important part of CHS 340 Administration of Human Services and is taught as a leadership and management style within a human services agency (Course Objectives 2, 4, 5 and 9; Course Requirement 2 “Team Project/Strategic Plan Appraisal”). In CHS 430 Family Dynamics and Interventions, students are introduced to clarifying expectations within the context of “Family Dynamics and Intervention” (Group Project Presentation and classes on strategic and structural approaches to family therapy).  The skill of clarifying expectations is addressed in CHS 380 Internship and CHS 440 Practicum / CHS 441 Seminar as a part of the field placement experiences and through class discussion, assigned readings, 
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.62, 53 words, `review_low_confidence`

_Source heading:_ **Class will be comprised of lectures, discussions, demonstrations, group activities, videos, web-based activities, etc. I**

_AI rationale:_ The section describes instructional methods and clarifies expectations for student preparation and participation, directly supporting Standard 17.a's focus on clarifying expectations about knowledge, theory, skills, and values delivery.

```text
Class will be comprised of lectures, discussions, demonstrations, group activities, videos, web-based activities, etc. It is expected that each student will have read the assigned material for each class and thus be prepared for participation in class discussion. The more prepared you are for class; the more enjoyable class will be for all.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[17][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content and learning activities
- ⚠️ Specification 17.a requires clarifying 'expectations' but the narrative does not define what 'expectations' means in the context of human services competencies
- ⚠️ No assessment data or evidence that students actually demonstrate the ability to clarify expectations; claims are curriculum-based only, not outcome-based
- ⚠️ Missing explicit connection between clarifying expectations as a core human services skill/competency and how it aligns with CSHSE standards or professional values
- ⚠️ No evidence of how clarifying expectations is assessed or measured (e.g., rubrics, competency evaluations, grades)
- ⚠️ Final paragraph about class preparation expectations is unrelated to the skill of clarifying expectations in human services practice
- ⚠️ No evidence of validation that the listed courses actually teach this skill at the depth and rigor expected for baccalaureate-level human services

---

### `17.b` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Dealing effectively with conflict._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[17][b].content`_

##### Narrative 1 — 🟢 conf 0.98, 343 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses the specification 'Dealing effectively with conflict' by documenting how this skill is taught across multiple human services courses through specific pedagogical methods, clinical applications, and field placement evaluation criteria. The narrative response matches Standard 17.b exactly.

```text
Dealing effectively with conflict.Response:Dealing effectively with conflict is addressed through in-class activities and discussions, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 101, 105, 224, 315/515, 360, 340, 430, 380, 440, and 441.  In CHS 101 Family Studies, students learn about dealing effectively with conflict in relationships (see classes on Communication and on Stress and Crisis in Relationships).In CHS 105 Human Services and Social Policy, students learn about different approaches to dealing with conflict in classes addressing “Defining Roles and Problems” and “The Helping Process.”  CHS 224 Research Methods and Writing addresses dealing with conflict as a skill that is sometimes necessary in proposing and implementing social science research (see the research proposal project; week 2 class topic).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both focus on techniques for dealing with conflict in a therapeutic context. For CHS 315, see classes on group stages, particularly the Transition Stage of a Group. For CHS 360, see chapters 2 – 6, but especially chapter 6 on Client Self-Challenging, as well as the two interview projects. Dealing effectively with conflict is an important part of CHS 340 Administration of Human Services and is taught as a leadership and management style within a human services agency (Course Objectives 2, 4, 5 and 9; Course Requirement 2 “Team Project/Strategic Plan Appraisal”). In CHS 430 Family Dynamics and Interventions, students are introduced to conflict management within the context of “Family Dynamics and Intervention” (Group Project Presentation and classes on systemic and structural approaches to family therapy).  The skill of dealing effectively with conflict is addressed in CHS 380 Internship and CHS 440 Practicum / CHS 441 Seminar as a part of the field placement experiences and through class discussion, a
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[17][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabus excerpts, assignment examples, rubrics, student work samples) to verify claims about conflict resolution content
- ⚠️ Narrative claims specific course topics (e.g., 'Transition Stage of a Group,' 'Client Self-Challenging,' 'systemic and structural approaches') but provides no artifacts demonstrating these topics actually address conflict resolution skills
- ⚠️ No evidence of assessment data showing students actually develop competency in dealing with conflict (e.g., no evaluation results, rubric scores, or student demonstrations)
- ⚠️ Lacks clarity on what 'dealing effectively with conflict' means operationally—narrative doesn't define the specific knowledge, skills, and values students should demonstrate
- ⚠️ No evidence of how conflict resolution is taught across different contexts (interpersonal, organizational, therapeutic, research) or whether students integrate learning across courses
- ⚠️ Missing documentation of field placement evaluations cited in narrative (Student Field Placement Evaluation, Section VI) that would show real-world application of conflict resolution skills

---

### `17.c` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Establishing rapport with clients._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[17][c].content`_

##### Narrative 1 — 🟢 conf 0.96, 314 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses 'Establishing rapport with clients' as a core skill, detailing how the program teaches this through multiple courses, clinical skills training, and field placements. This is an exact match to Standard 17.c's specification.

```text
Establishing rapport with clients.Response:Establishing rapport with clients is addressed through in-class activities and discussions, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 105, 220, 224, 315/515, 360, 430, 380, 440, and 441.  In CHS 105 Human Services and Social Policy, students learn about the importance of establishing rapport with clients as part of classes addressing “Defining Roles and Problems” and “The Helping Process.”  CHS 220 Diversity and Cultural Competence emphasizes diversity and understanding each person’s unique characteristics as a prerequisite for establishing rapport. See particularly the Immigrant Interview project. In CHS 224 Research Methods and Writing, students learn that establishing rapport is an essential step in conducting effective research (see the research proposal project; week 2 and week 4 class topics).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both emphasize techniques for establishing rapport in a therapeutic context. For CHS 315, see classes on group stages, particularly the topic of Forming a Group. For CHS 360, see chapters 2 – 6, but especially chapters 3&4 on Empathetic Presence and Responding, as well as the two interview projects. In CHS 430 Family Dynamics and Interventions, students learn techniques for establishing rapport in the context of family therapy. This is a component of all the models of family therapy (Group Project Presentation) and is included in the material on Adopting a Family Relationship Framework.  The skill of establishing rapport with clients is addressed in CHS 380 Internship and CHS 440 Practicum / CHS 441 Seminar as a part of the field placement experiences and through class discussion, assigned readings, and journaling (see Issue Presentation assignment in CHS 441). Students are evaluated on their ability to “help others by using basic counseling/listening skills, as app
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[17][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify that the described content actually exists in courses
- ⚠️ Lacks specific learning outcomes or competency statements defining what 'establishing rapport' means in the program's context
- ⚠️ No assessment data demonstrating that students actually achieve competency in rapport-building
- ⚠️ Missing evidence of how rapport-building is taught and evaluated in field placements (CHS 380/440/441)
- ⚠️ No examples of actual assignments (e.g., the Immigrant Interview, interview projects, Issue Presentation) to confirm they address rapport-building
- ⚠️ Lacks clarity on which knowledge (theory), skills, and values related to rapport are explicitly taught vs. assumed
- ⚠️ No documentation of student learning outcomes or performance data on rapport competency
- ⚠️ References to specific textbook chapters (e.g., CHS 360, chapters 3-4) are not substantiated with syllabi

---

### `17.d` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Developing and sustaining behaviors that are congruent with the values and ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at https://www.nationalhumanservices.org/ethical-standards-for- hsprofessionals). 8. Administrative Context: A holistic approach to human services recognizes direct and indirect services as components of the same system. Administrative support (indirect service) is essential to the effective delivery of direct services to clients or client groups._

**Final coverage verdict:** covered=**False**, score=**0.65**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.65, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[17][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 352 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses developing and sustaining behaviors congruent with professional values and ethical standards, with explicit reference to NOHS/CSHSE ethical standards. Standard 17.d is the primary specification for this competency, while 19.h addresses integration of ethical standards in self-development context as a secondary match.

```text
Developing and sustaining behaviors that are congruent with the values and ethics of the profession.Response:Developing and sustaining behaviors that are congruent with the values and ethics of the profession is addressed in the following human services courses: CHS 105, 220, 224, 315/515, 360, 430, 380, 440, and 441.  In CHS 105 Human Services and Social Policy, students are introduced to the values and ethics of the helping profession through in-class activities and discussions, lectures, assigned readings (see class topics Defining Roles and Problems, The Helping Process, and Professional and Ethical Issues), as well as through the Team Research assignment. CHS 220 Diversity and Cultural Competence emphasizes the value of openness to diversity and understanding each person’s unique characteristics. See particularly the Immigrant Interview project. In CHS 224 Research Methods and Writing, students learn the values and ethics associated with conducting social science research (see the research proposal project; week 2 and week 4 class topics).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both emphasize helping students to develop and sustain therapeutic behaviors that are congruent with the values and ethics of the profession. For CHS 315, see classes on all group stages and week 3 on Ethical and Legal Issues in Group Counseling. For CHS 360, see chapters 2 – 6, but especially chapter 2 on the Helping Relationship and the Values That Drive It.In CHS 430 Family Dynamics and Interventions, students practice techniques that are congruent with the values and ethics of the profession in the context of family therapy. This is a component of all the models of family therapy (Group Project Presentation) and is included in the material on Adopting a Family Relationship Framework.  Developing and sustaining behaviors that are congruent with the values and ethics of the profession is one of the primary purposes of fi
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.62, 74 words, `review_low_confidence`

_Source heading:_ **Students continue to struggle with consistently demonstrating professionalism in their writing and electronic communicat**

_AI rationale:_ The narrative addresses student development of professional behaviors and values through coursework and writing-intensive instruction, directly aligning with Standard 17.d's focus on developing and sustaining behaviors congruent with professional values and ethical standards. The mention of a new Professional Development course and emphasis on professionalism supports this competency-building requ

```text
Students continue to struggle with consistently demonstrating professionalism in their writing and electronic communications. While most of them are able to maintain an acceptable degree of professionalism, this is an area that we will continue to emphasize. A new course was recently created (CHS 217 Professional Development in Counseling & Human Services) that will stress the importance of professionalism. We also continue to offer writing-intensive courses that require students to practice good writing skills.
```

##### Narrative 3 — 🟡 conf 0.72, 73 words, `review_low_confidence`

_Source heading:_ **Examines ethical practice and decision-making in the counseling field.  The course focuses on personal and professional **

_AI rationale:_ The section describes a course on ethical practice and decision-making that develops awareness of values, boundaries, confidentiality, and professional responsibilities—directly matching Standard 17.d's specification on developing behaviors congruent with NOHS/CSHSE ethical standards. Standard 19.h on integration of ethical standards and Standard 18.d on legal/ethical issues are secondary fits, bu

```text
Examines ethical practice and decision-making in the counseling field.  The course focuses on personal and professional awareness of values, self-disclosure, boundaries and dual relationships, confidentiality, counselor and client rights and responsibilities, professional relationships, and credentialing/regulating agencies. This course also provides a specific focus on ethical issues relevant to the addiction treatment field, including the impact of confidentiality regulations, working with mandated client populations, self-help fellowship participation, and counselors who are also in recovery.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[17][d].supportingEvidenceText`_

##### Evidence text 1 — conf 0.72, 75 words, `review_low_confidence`

_Source heading:_ **Course Description:  This course emphasizes the organizational and work-related issues in human services, including prog**

```text
Course Description:  This course emphasizes the organizational and work-related issues in human services, including program planning, development, and evaluation; personnel administration; fundraising and budgeting; and administrative procedures. Students will focus on professional writing throughout this course, including writing a strategic plan and program proposal. Students who anticipate continuing their education at the graduate level should register for the 500-level section; however, transferability of these courses to a graduate program is determined by the receiving institution.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[17][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No explicit reference to the NOHS/CSHSE Ethical Standards document itself—the narrative does not demonstrate that students engage directly with or are assessed against the specific ethical standards outlined in the national guidelines
- ⚠️ Administrative context requirement inadequately addressed—the specification explicitly requires attention to 'administrative support (indirect service) as essential to effective delivery of direct services,' but the narrative focuses almost entirely on direct service clinical skills; the single supporting evidence item on administrative coursework is disconnected from the ethical standards discussion
- ⚠️ Missing evidence of how ethical standards are integrated into administrative/indirect service roles—no documentation that students learning program planning, budgeting, personnel administration, etc. are expected to apply the NOHS ethical standards to those contexts
- ⚠️ Incomplete assessment documentation—while field placement evaluation is mentioned, no actual rubric, scoring data, or examples are provided showing how 'consistent ethical behavior' is specifically measured against the national ethical standards
- ⚠️ Sustainability of ethical behaviors not clearly demonstrated—the narrative acknowledges ongoing struggles with professionalism but provides limited evidence of systematic reinforcement mechanisms or assessment of long-term ethical practice maintenance

---

## Standard 18

### `18.a` 🟢 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Principles of leadership and management._

**Final coverage verdict:** covered=**True**, score=**0.82**
_(first-pass: covered=True, score=0.82; second-pass after gap-fill: covered=True, score=0.82, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[18][a].content`_

##### Narrative 1 — 🟢 conf 0.98, 229 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly addresses 'Principles of leadership and management' as stated in Standard 18.a, detailing how the program teaches these principles through specific courses (CHS 340/540, 430, 380, 440, 441) with course objectives, assignments, and field placement evaluations.

```text
Principles of leadership and management.Response: The principles of leadership and management are primarily addressed by the required course CHS 340/540 Administration of Human Services. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 340/540, 430, 380, 440, and 441.  Leading and managing organizations is a main focus and objective of CHS 340/540 Administration of Human Services (see all Course Objectives; Course Requirement 2 - “Team Project/Strategic Plan Appraisal” and Course Requirement 6 – “Seeking Resources Project”) and is addressed through assigned reading, lecture, in-class activities and in-class discussions on a myriad of topics relating to managing organizations (See course schedule).In CHS 430 Family Dynamics and Interventions students are introduced to principles of administering clinical programs through the group project analyzing the application of various family therapy approaches. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which managing organizations through leadership and strategic planning is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate a professional attitude and behavior and follow the agency's policies and procedures (See Student Field Placement Evaluation, Section III).  Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[18][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][a].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 258 | 0.72 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ No explicit evidence that students demonstrate competency in applying leadership/management principles (e.g., rubrics, graded assignments, learning outcome data showing mastery levels)
- ⚠️ Limited documentation of how leadership/management principles are assessed across the five courses mentioned (CHS 340/540, 430, 380, 440, 441); only CHS 340/540 has detailed evidence
- ⚠️ No evidence of how values-based leadership or ethical leadership dimensions are integrated beyond brief mention of 'Ethical Dilemmas in Management' as one lecture topic
- ⚠️ Field placement evaluation (Student Field Placement Evaluation, Section III) is referenced but not provided; cannot verify that leadership/management competency is actually measured in internship/practicum settings
- ⚠️ No student learning outcome data, assessment results, or examples demonstrating that students can articulate, apply, or evaluate leadership/management principles

---

### `18.b` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Human resources and volunteer management._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[18][b].content`_

##### Narrative 1 — 🟢 conf 0.94, 243 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses human resources and volunteer management through coursework and field experiences, matching Standard 18.b's specification. The narrative demonstrates how students learn these administrative competencies across multiple courses and practicum settings.

```text
Human resources and volunteer management.Response:Human resources issues and volunteer management are primarily addressed by the required course CHS 340/540 Administration of Human Services. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 340/540, 430, 380, 440, and 441.  Human resources issues and volunteer management are covered in depth in CHS 340/540 Administration of Human Services (see all Course Objectives; Course Requirement 2 - “Team Project/Strategic Plan Appraisal” and Course Requirement 6 – “Seeking Resources Project”) and are addressed through assigned reading, lecture, in-class activities and in-class discussions on a myriad of topics relating to supervision (See course schedule). The importance of volunteers is included in units on staff management, funding strategies, and humanizing the organization. In CHS 430 Family Dynamics and Interventions students are introduced to principles of administering clinical programs through the group project analyzing the application of various family therapy approaches. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which supervision and human resource management is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate a professional attitude and behavior and follow the agency's policies and procedures (See Student Field Placement Evaluation, Section III). Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[18][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided (syllabus excerpts, assignment descriptions, rubrics, student work samples) to substantiate claims about course content coverage
- ⚠️ Specification requires 'Knowledge, Theory, Skills, and Values' but narrative only describes where topics are mentioned, not what theoretical frameworks or conceptual models are taught
- ⚠️ No evidence that volunteer management is formally assessed or evaluated as a distinct competency; mention of volunteers is vague ('importance of volunteers is included in units')
- ⚠️ Human resources skills (recruitment, hiring, retention, conflict resolution, performance management) are listed in specification but narrative only emphasizes supervision
- ⚠️ No documentation of how students demonstrate competency in HR/volunteer management (no rubrics, assessment tools, or student performance data provided)
- ⚠️ Fieldwork evaluation form referenced (Student Field Placement Evaluation, Section III) but not provided; cannot verify it measures HR/volunteer management competencies
- ⚠️ No evidence of explicit instruction on diversity, equity, or ethical dimensions of HR management
- ⚠️ Unclear how 'values' component (ethics, social justice in HR practices) is addressed across courses

---

### `18.c` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Grant writing, fundraising, and other funding sources._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[18][c].content`_

##### Narrative 1 — 🟢 conf 0.94, 230 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses grant writing, fundraising, and other funding sources as a knowledge, theory, skills, and values component, which exactly matches Standard 18.c specification language. The curriculum response documents how students learn and apply these competencies across multiple courses.

```text
Grant writing, fundraising, and other funding sources.Response:Grant writing, fundraising, and funding sources are primarily addressed by the required course CHS 340/540 Administration of Human Services and are also a component of the grant proposal project in CHS 224. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 224, 340/540, 380, 440, and 441.  Grant writing and funding are a main focus and objective of CHS 340/540 Administration of Human Services (specifically Course Requirement 6 – “Seeking Resources Project”) and is the focus of a major course assignment on seeking resources. The topic is covered through assigned reading, lecture, in-class activities and in-class discussions relating to grant writing and funding (See course schedule).In CHS 224 Research Methods and Writing, students learn in-depth about using research to support the writing of a grant narrative. They develop a detailed research proposal with attention to funding issues. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the funding of programs is observed firsthand and students are often able to participate in fundraising initiative, depending on their placement site. Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441. (See Student Field Placement Evaluation, Section III).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[18][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (course syllabi, assignment rubrics, student work samples) to substantiate claims about grant writing instruction
- ⚠️ No evidence of specific learning outcomes or competencies assessed related to grant writing, fundraising, or funding source identification
- ⚠️ Grant writing content described as 'primarily addressed' in CHS 340/540 but no details about specific grant-writing skills taught (e.g., needs assessment, budget justification, logic models, RFP analysis)
- ⚠️ Fundraising strategies mentioned only vaguely as 'depending on their placement site' with no systematic curriculum integration or assessment
- ⚠️ No mention of instruction on identifying/researching funding sources (foundations, government agencies, corporate sponsors, individual donors) as distinct from writing grants
- ⚠️ Field placement reporting (CHS 441 poster presentation) described as observational rather than demonstrating student competency in actual grant writing or fundraising
- ⚠️ No evidence that all students encounter grant writing/fundraising instruction or assessment; reliance on elective internships/practicums creates inconsistent coverage

---

### `18.d` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Legal, ethical, and regulatory issues, and risk management._

**Final coverage verdict:** covered=**False**, score=**0.52**
_(first-pass: covered=False, score=0.52; second-pass after gap-fill: covered=False, score=0.52, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[18][d].content`_

##### Narrative 1 — 🟢 conf 0.98, 270 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses legal, ethical, and regulatory issues and risk management as taught across multiple required courses, matching Standard 18.d specification language exactly. The narrative describes coursework, assignments, and field placement experiences focused on these competencies.

```text
Legal, ethical, and regulatory issues, and risk management.Response:Legal, ethical, and regulatory issues and risk management are primarily addressed by the required course CHS 340/540 Administration of Human Services. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 224, 340/540, 430, 380, 440, and 441.  Legal, ethical, and regulatory issues and risk management is a main focus and objective of CHS 340/540 Administration of Human Services (see all Course Objectives; Course Requirement 2 - “Team Project/Strategic Plan Appraisal” and Course Requirement 6 – “Seeking Resources Project”) and is addressed through assigned reading, lecture, in-class activities and in-class discussions relating to legal, ethical and regulatory issues (See course schedule, particularly the units on ethical issues in management and working with a board or trustees).In CHS 224 Research Methods and Writing, students learn about legal and regulatory issues specifically related to research with human subjects. They develop a detailed research proposal that specifies how these issues will be addressed. In CHS 430 Family Dynamics and Interventions, students are introduced to principles of administering clinical programs through the group project analyzing the application of various family therapy approaches. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which legal and regulatory issues and risk management may be observed and practiced. Students are mentored and evaluated by their field instructor (See Student Field Placement Evaluation, Section III). Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[18][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided (syllabi, assignments, rubrics, student work samples, field placement evaluations) to verify claims about content coverage
- ⚠️ Lack of concrete examples of legal/ethical/regulatory issues actually taught (e.g., confidentiality laws, mandatory reporting, HIPAA, licensing regulations, liability)
- ⚠️ No evidence of explicit risk management instruction or competency assessment
- ⚠️ Values component of the specification is not addressed in the narrative
- ⚠️ No documentation of how field placement experiences integrate legal/ethical/regulatory learning or how field instructor evaluations assess these competencies
- ⚠️ CHS 224 description mentions research ethics but doesn't clarify how this connects to human services legal/ethical practice
- ⚠️ No evidence of assessment methods or learning outcomes related to legal/ethical/regulatory knowledge and skills
- ⚠️ Field placement evaluation reference (Section III) is mentioned but not provided as evidence

---

### `18.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Budget and financial management. 9. Client-Related Values and Attitudes Context: There are values and ethics intrinsic to the human services profession that have been agreed to as governing principles of professional practice._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[18][e].content`_

##### Narrative 1 — 🟢 conf 0.92, 231 words, `auto_accept`

_Source heading:_ **e.**

_AI rationale:_ The narrative directly addresses budget and financial management as a knowledge and skills competency taught across multiple courses (CHS 340/540, 224, 380, 440, 441), matching Standard 18.e. Grant writing and fundraising are also covered but are secondary topics within this response.

```text
Budget and financial management.Response:Budget and financial management issues are primarily addressed by the required course CHS 340/540 Administration of Human Services and are also a component of the grant proposal project in CHS 224. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 224, 340/540, 380, 440, and 441.  Budgetary and financial management are a main focus of CHS 340/540 Administration of Human Services (specifically Course Requirement 6 – “Seeking Resources Project”) and is the focus of a major course assignment on seeking resources. The topic is covered through assigned reading, lecture, in-class activities and in-class discussions relating to budget and financial management (See course schedule).In CHS 224 Research Methods and Writing, students learn about using evidence to justify a proposed budget in the writing of a grant narrative. They develop a detailed research proposal with attention to financial issues. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the financial management of programs is observed firsthand and students are sometimes directly engaged in the financial operations of the agency, depending on their placement site. Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441. (See Student Field Placement Evaluation, Section III).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[18][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[18][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided to support narrative claims about course content, assignments, or student learning outcomes related to budget and financial management
- ⚠️ Missing explicit connection to 'Client-Related Values and Attitudes' — the narrative addresses technical budget/financial skills but does not address the ethical values and attitudes intrinsic to responsible financial stewardship in human services
- ⚠️ No documentation of how students develop values regarding fiscal responsibility, ethical use of resources, or advocacy for adequate client services funding
- ⚠️ Lack of assessment data showing students actually achieve competency in budget/financial management or develop appropriate professional values in this domain
- ⚠️ No evidence of specific learning outcomes, rubrics, or evaluation methods that demonstrate students can apply budgeting knowledge with professional integrity
- ⚠️ Missing examples of how courses address the ethical implications of budget decisions on client services and vulnerable populations

---

## Standard 19

### `19.a` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The least intrusive intervention in the least restrictive environment._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][a].content`_

##### Narrative 1 — 🟢 conf 0.92, 263 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly addresses how the program teaches and evaluates 'the least intrusive intervention in the least restrictive environment,' which is the exact language of Standard 19.a. The narrative documents integration across multiple courses (CHS 105, 224, 315/515, 360, 430, 380, 440, 441) and field placement evaluation, demonstrating both knowledge delivery and skills demonstration.

```text
The least intrusive intervention in the least restrictive environment.Response:Choosing the least intrusive intervention in the least restrictive environment is a principle that is taught through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (see topics on Foundational Concepts, the Roles and Functions of HS Workers, and Theoretical Issues in Working with Individuals and Families in the course schedule).In CHS 224 Research Methods and Writing, students learn to apply social science research techniques to assessing programs that use the least intrusive intervention in the least restrictive environment. Students develop a detailed research proposal that specifies how the research will be conducted. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 6); CHS 360 in the context of individual counseling techniques (see interview projects and class schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which choosing the least intrusive intervention in the least restrictive environment can be observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors (See Student Field Placement Evaluation, Section III).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (course syllabi, assignments, rubrics, student work samples) to verify claims about content coverage
- ⚠️ No explicit definition or explanation of what 'least intrusive intervention' means in the program's context
- ⚠️ No explicit definition or explanation of what 'least restrictive environment' means in the program's context
- ⚠️ No description of how students demonstrate mastery or competency in applying this principle
- ⚠️ No assessment data or evaluation results showing students can apply this principle in practice
- ⚠️ Vague reference to 'Student Field Placement Evaluation, Section III' without showing actual evaluation criteria or evidence that this principle is assessed
- ⚠️ No examples of specific assignments, case studies, or scenarios used to teach this principle
- ⚠️ No evidence of how this principle is integrated into clinical skills courses beyond listing course numbers
- ⚠️ No documentation of field instructor feedback or evaluation outcomes related to this competency

---

### `19.b` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Client self-determination._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][b].content`_

##### Narrative 1 — 🟢 conf 0.94, 226 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses client self-determination as a core knowledge, theory, skill, and value taught across multiple human services courses and clinical practice settings, matching Standard 19.b exactly. The narrative documents how this principle is integrated throughout the curriculum and field placements.

```text
Client self-determination.Response:Client self-determination is a principle that is taught through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (see schedule and topics such as Foundational Concepts and Theoretical Issues).In CHS 224 Research Methods and Writing, students learn to apply social science research techniques to evaluate programs that emphasize client self-determination. Students develop a detailed research proposal that specifies how the research will be conducted. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 6; schedule of topics on Ethical Issues and Theories); CHS 360 in the context of individual counseling techniques (see interview projects and class schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which client self-determination is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors (See Student Field Placement Evaluation, Section III).
```

##### Narrative 2 — 🟡 conf 0.72, 78 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 2 Human service professionals obtain informed consent to provide services to clients at the beginning of the he**

_AI rationale:_ The section describes informed consent procedures and client rights to withdraw consent and ask questions, which directly aligns with Standard 19.b on client self-determination. The emphasis on client autonomy in the helping relationship is core to self-determination.

```text
STANDARD 2 Human service professionals obtain informed consent to provide services to clients at the beginning of the helping relationship. Clients should be informed that they may withdraw consent at any time except where denied by court order and should be able to ask questions before agreeing to the services. Clients who are unable to give consent should have those who are legally able to give consent for them review an informed consent statement and provide appropriate consent.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence provided; narrative alone is insufficient for accreditation review
- ⚠️ No demonstration of how informed consent procedures are taught or practiced
- ⚠️ No evidence that students learn about withdrawal of consent and client right to refuse services
- ⚠️ No evidence addressing clients unable to give consent (minors, guardianship situations, court orders)
- ⚠️ No documentation of actual course materials, syllabi, assignments, or rubrics referenced in narrative
- ⚠️ No evidence of how field instructors evaluate students' competence in obtaining and explaining informed consent
- ⚠️ Student Field Placement Evaluation form mentioned but not provided; cannot verify it assesses informed consent competency
- ⚠️ Narrative does not explicitly address the STANDARD 2 requirement regarding informed consent documentation and procedures
- ⚠️ No evidence of how ethical standards around self-determination/informed consent are integrated into clinical courses

---

### `19.c` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Confidentiality of information._

**Final coverage verdict:** covered=**False**, score=**0.65**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.65, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][c].content`_

##### Narrative 1 — 🟢 conf 0.89, 240 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses confidentiality of information as a core principle taught across multiple courses and evaluated in field placements, matching Standard 19.c specification exactly. Standard 14.c is a weaker alternative as it frames confidentiality within a broader context of appropriate information sharing.

```text
Confidentiality of information.Response:Confidentiality of information is a principle that is emphasized throughout the program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (schedule, specifically units on Foundational Concepts and Ethical Issues).In CHS 224 Research Methods and Writing, students learn about the importance of maintaining the confidentiality of information while conducting social science research (see Week 4). Students develop a detailed research proposal that includes a description of how information will be kept confidential. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 5; schedule); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which confidentiality of information is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors, including maintaining the confidentiality of client records (See Student Field Placement Evaluation, Section III).
```

##### Narrative 2 — 🟢 conf 0.92, 60 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 3 Human service professionals protect the client's right to privacy and confidentiality except when such confid**

_AI rationale:_ The narrative directly addresses confidentiality of information, its limits, exceptions (serious harm, agency guidelines, legal requirements), and the obligation to inform clients—all core elements of Standard 19.c on confidentiality of information.

```text
STANDARD 3 Human service professionals protect the client's right to privacy and confidentiality except when such confidentiality would cause serious harm to the client or others, when agency guidelines state otherwise, or under other stated conditions (e.g., local, state, or federal laws). Human service professionals inform clients of the limits of confidentiality prior to the onset of the helping relationship.
```

##### Narrative 3 — 🟢 conf 0.89, 51 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 8 Human service professionals protect the integrity, safety, and security of client records. Client information**

_AI rationale:_ The section directly addresses confidentiality and security of client records, including written consent requirements and exceptions for supervision and legal obligation, which aligns precisely with Standard 19.c on 'Confidentiality of information.' This is a core ethical specification in the current handbook.

```text
STANDARD 8 Human service professionals protect the integrity, safety, and security of client records. Client information in written or electronic form that is shared with other professionals must have the client’s prior written consent except in the course of professional supervision or when legally obliged or permitted to share such information.
```

##### Narrative 4 — 🟢 conf 0.89, 100 words, `auto_accept`

_Source heading:_ **C. Confidentiality; HIPAA Compliance. In the course of a student’s participation in the Education Program, the student a**

_AI rationale:_ This section directly addresses confidentiality of information and HIPAA compliance requirements that students must uphold as part of their professional practice. Standard 19.c explicitly requires knowledge and skills related to confidentiality of information, which is the core subject of this policy narrative.

```text
C. Confidentiality; HIPAA Compliance. In the course of a student’s participation in the Education Program, the student and the SPONSOR staff may become privy to, or may receive or create certain confidential health or medical information relating to persons being treated in the HEALTH SYSTEM (“Protected Health Information”), the confidentiality of which is regulated by the Health Insurance Portability and Accountability Act of 1996, Public Law 104-191 (“HIPAA”).  SPONSOR agrees to maintain and to require all students to maintain the confidentiality of all Protected Health Information as required by HIPAA. Not in limitation of the foregoing, but in addition thereto:
```

##### Narrative 5 — 🟢 conf 0.85, 56 words, `auto_accept`

_Source heading:_ **Confidentiality: Students may have access to or knowledge of clients private or personal information at field placement **

_AI rationale:_ The section directly addresses confidentiality of client information and professional ethical standards students must uphold during field placement, matching Standard 19.c on Knowledge, Theory, Skills, and Values around confidentiality. Standard 14.c is a secondary match as it also covers confidentiality but in a broader context; Standard 21.d is tertiary as field placement policies documentation 

```text
Confidentiality: Students may have access to or knowledge of clients private or personal information at field placement sites. Students must adhere to strict confidentiality, sharing this information only with the site-base field instructor and as directed by the field instructor. Client names must never be used in class discussion or in written materials for the course.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][c].supportingEvidenceText`_

##### Evidence text 1 — conf 0.68, 100 words, `review_low_confidence`

_Source heading:_ **(v)	SPONSOR agrees to maintain records of any disclosures of Protected Health Information, and within ten days of a requ**

```text
(v)	SPONSOR agrees to maintain records of any disclosures of Protected Health Information, and within ten days of a request by HEALTH SYSTEM for an accounting of disclosures of Protected Health Information, SPONSOR shall make available to HEALTH SYSTEM the information to provide such an accounting of disclosures.  At a minimum, such information shall include the date of disclosure, the name of the entity or person who received the Protected Health Information, and, if known, the address of such entity or person, a brief description of the Protected Health Information disclosed, and a statement of the purpose of the disclosure.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence that students are taught to inform clients of the limits of confidentiality prior to onset of helping relationship (STANDARD 3 requirement)
- ⚠️ No demonstration of how exceptions to confidentiality (serious harm, agency guidelines, legal obligations) are explicitly taught or evaluated
- ⚠️ No evidence of instruction on HIPAA compliance beyond administrative agreement language; students may not understand their obligations
- ⚠️ No evidence of how electronic security and integrity of client records is addressed in curriculum (STANDARD 8)
- ⚠️ Supporting evidence provided (HIPAA disclosure accounting) is administrative/institutional rather than curriculum or student-focused
- ⚠️ No course syllabus excerpts, assignments, or evaluation tools showing confidentiality competency assessment
- ⚠️ Missing evidence that students understand conditions under which confidentiality may be breached and their legal/ethical obligations in those scenarios

---

### `19.d` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The worth and uniqueness of individuals based on intercultural fluency, including how they identify and the cultural groups to which they belong._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 354 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses the worth and uniqueness of individuals based on intercultural fluency and cultural groups, which is the core language of Standard 19.d. The program narrative demonstrates how diversity, culture, ethnicity, race, class, gender, religion, ability, and sexual orientation are integrated across multiple courses.

```text
The worth and uniqueness of individuals including culture, ethnicity, race, class, gender, religion, ability, sexual orientation, and other expressions of diversity.Response:The worth and uniqueness of individuals including culture, ethnicity, race, class, gender, religion, ability, sexual orientation, and other expressions of diversity is emphasized throughout the program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (specifically as part of Foundational Concepts and Ethical Issues).CHS 220 Diversity and Cultural Competence is devoted primarily to the goal of developing openness and a better understanding of the diversity of others. See all course objectives, the course schedule, and group presentation and immigrant interview assignments. In CHS 224 Research Methods and Writing, students learn how to conduct social science research in a way that upholds the integrity and dignity of diverse subjects (see Week 4). Students develop a detailed research proposal that specifies how these issues will be addressed. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 4; schedule); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the worth and uniqueness of individuals is a central operating principle. Students 
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided; narrative claims cannot be verified (e.g., course syllabi, assignments, evaluation rubrics, student work samples)
- ⚠️ Specification requires 'intercultural fluency' specifically—narrative addresses diversity awareness/competence but does not explicitly demonstrate how students develop fluency (ability to navigate, communicate, and work effectively across cultural differences)
- ⚠️ No evidence of assessment data showing student learning outcomes related to intercultural fluency or the worth/uniqueness of individuals
- ⚠️ Narrative lists many courses but provides minimal detail on how intercultural fluency is taught or practiced in each (e.g., what specific skills, what learning activities beyond 'lecture and discussion')
- ⚠️ Missing evidence of how students demonstrate intercultural fluency in practice (field placement evaluation referenced but not provided; no sample evaluations or rubrics shown)
- ⚠️ No demonstration of how the program measures or documents students' ability to recognize and respect how individuals identify and their cultural group belonging—a key part of the specification

---

### `19.e` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Belief that individuals, service systems, and society can change._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][e].content`_

##### Narrative 1 — 🟢 conf 0.94, 316 words, `auto_accept`

_Source heading:_ **e.**

_AI rationale:_ The section content directly addresses the belief that individuals, service systems, and society can change through curricular coverage and field experiences, matching Standard 19.e specification language exactly.

```text
Belief that individuals, services systems, and society can change.Response:The belief that individuals, services systems, and society can change is a fundamental tenant of the Counseling & Human Services program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441. This belief is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (classes on Foundational Concepts and the Role and Function of HS Workers in the schedule).CHS 220 Diversity and Cultural Competence emphasizes the belief that individuals, services systems, and society can change through an analysis of interactions between diverse groups of people. See all course objectives, the course schedule, and group presentation and immigrant interview assignments. In CHS 224 Research Methods and Writing, students investigate techniques for measuring the changes that occur when various interventions are applied. Students develop a detailed research proposal that specifies how these changes will be measured. This belief is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objectives; classes on stages of groups); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 340 Administration of Human Services focuses on the administrative issues related to managing change (see entire course schedule).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which many types of change is observed and practiced. Student
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][e].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (course syllabi, assignments, rubrics, student work samples) to validate claims made in the narrative
- ⚠️ Narrative lists courses but does not explicitly explain HOW each course teaches the belief that change is possible—lacks specific pedagogical strategies or learning activities
- ⚠️ No evidence of student learning outcomes or assessment data demonstrating students actually developed this belief
- ⚠️ Missing explanation of how systems-level change (not just individual change) is taught; narrative focuses heavily on counseling/intervention skills rather than macro-level advocacy or social change
- ⚠️ No mention of critical consciousness, social justice frameworks, or empowerment models that typically ground belief in societal changeability
- ⚠️ Field placement evaluation referenced but not provided; no evidence of how field instructors assess this specific belief or competency
- ⚠️ Narrative does not address how students move from theoretical understanding to internalized belief—the distinction between knowing change is possible and believing it
- ⚠️ No description of how students who may hold fatalistic or deficit-based worldviews are specifically engaged to develop this belief

---

### `19.f` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Interdisciplinary team approaches to problem solving._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][f].content`_

##### Narrative 1 — 🟢 conf 0.98, 256 words, `auto_accept`

_Source heading:_ **f.**

_AI rationale:_ The section content directly addresses interdisciplinary team approaches to problem solving across multiple courses (CHS 105, 224, 315/515, 360, 430, 340, 380, 440, 441), describing how students learn to work in teams, participate in team-based projects, and are evaluated on team collaboration skills. This matches Standard 19.f exactly.

```text
Interdisciplinary team approaches to problem solving.Response: Interdisciplinary team approaches to problem solving is emphasized throughout the program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 340, 380, 440 and 441. This approach is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (team research project).In CHS 224 Research Methods and Writing, students learn about the design of social science research, which usually involves working in interdisciplinary teams. Students develop a detailed research proposal that describes how they will work with others to implement the research. Working with treatment teams is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 3; schedule); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 340 Administration of Human Services focuses on the management issues related to working in teams (see entire course schedule).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which students participate directly in interdisciplinary teams. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors related to working in teams (See Student Field Placement Evaluation, Section III and V).
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][f].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (course syllabi, assignments, rubrics, field placement evaluation forms, student work samples)
- ⚠️ Narrative lists courses but provides minimal detail on what 'interdisciplinary team approaches' actually means or entails in each context
- ⚠️ No evidence of how students learn to work with professionals from OTHER disciplines (e.g., social workers, nurses, counselors, case managers, etc.) - narrative focuses on internal human services team structures
- ⚠️ No documentation of learning outcomes, competencies, or assessment criteria specific to interdisciplinary teamwork
- ⚠️ Vague references to 'group assignments' and 'field instructor evaluation' without concrete examples or artifacts
- ⚠️ No evidence that students demonstrate competency in interdisciplinary problem-solving (e.g., grades, evaluation rubrics, portfolio artifacts)
- ⚠️ Field Placement Evaluation form referenced but not provided; cannot verify it actually assesses interdisciplinary teamwork skills

---

### `19.g` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Appropriate professional boundaries._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][g].content`_

##### Narrative 1 — 🟢 conf 0.98, 298 words, `auto_accept`

_Source heading:_ **g.**

_AI rationale:_ The section heading and content directly address 'Appropriate professional boundaries,' which is the exact language of Standard 19.g in the current 2025 spec. The narrative documents how the program teaches this competency across multiple courses and field placements.

```text
Appropriate professional boundaries.Response:Appropriate professional boundaries are emphasized throughout the program, particularly as a component of professional behavior and expectations, and are specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441. Appropriate professional boundaries are addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (schedule, see specifically Foundational Concepts and Roles of HS Workers).CHS 220 Diversity and Cultural Competence emphasizes the importance of maintaining appropriate professional boundaries as an aspect of cultural competence. See course objectives, the course schedule, and group presentation and immigrant interview assignments.In CHS 224 Research Methods and Writing, students investigate a variety of social science research techniques that all include strict adherence to maintaining appropriate professional boundaries as a researcher. Students develop a detailed research proposal that specifies how these issues will be addressed. Maintaining appropriate professional boundaries is emphasized throughout the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 5); CHS 360 in the context of individual counseling techniques (see interview projects and class schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 340 Administration of Human Services addresses appropriate professional boundaries in the management of agencies and staff (see entire course schedule).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which students observe and 
… (truncated, full text imported)
```

##### Narrative 2 — 🟢 conf 0.88, 50 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 5 Human service professionals recognize that multiple relationships may increase the risk of harm to or exploit**

_AI rationale:_ The section directly addresses professional boundaries and dual/multiple relationships, which aligns most precisely with Standard 19.g on 'Appropriate professional boundaries.' While Standard 17.d mentions ethical standards generally, 19.g specifically targets the boundary-management content of this passage.

```text
STANDARD 5 Human service professionals recognize that multiple relationships may increase the risk of harm to or exploitation of clients and may impair their professional judgment. When it is not feasible to avoid dual or multiple relationships, human service professionals should consider whether the professional relationship should avoided or curtailed.
```

##### Narrative 3 — 🟡 conf 0.72, 61 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 4 If it is suspected that danger or harm may occur to the client or to others as a result of a client's behavio**

_AI rationale:_ The section describes professional ethical conduct when client or third-party safety is at risk, including breaking confidentiality and seeking consultation—core elements of appropriate professional boundaries and ethical decision-making. This aligns most directly with Standard 19.g (appropriate professional boundaries) and secondarily with 14.c (confidentiality and information sharing).

```text
STANDARD 4 If it is suspected that danger or harm may occur to the client or to others as a result of a client's behavior, the human service professional acts in an appropriate and professional manner to protect the safety of those individuals. This may involve, but is not limited to, seeking consultation, supervision, and/or breaking the confidentiality of the relationship.
```

##### Narrative 4 — 🟡 conf 0.72, 60 words, `review_low_confidence`

_Source heading:_ **STANDARD 19 Human service professionals avoid duplicating another professional's helping relationship with a client. The**

_AI rationale:_ The narrative addresses avoiding duplication of helping relationships and consulting/collaborating with other professionals—core content of professional boundaries (19.g) in the 2025 specification. The emphasis on consultation and coordination with other professionals supports this ethical boundary specification.

```text
STANDARD 19 Human service professionals avoid duplicating another professional's helping relationship with a client. They consult with other professionals who are assisting the client in a different type of relationship when it is in the best interest of the client to do so. In addition, human services professionals seek ways to actively collaborate and coordinate with other professionals when appropriate.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][g].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][g].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, evaluation forms referenced but not attached)
- ⚠️ Narrative lacks specific content examples: what exactly is taught about boundary violations, warning signs, or corrective actions
- ⚠️ No evidence of how students learn to recognize dual/multiple relationships (Standard 5) or how to manage them when unavoidable
- ⚠️ Narrative does not address how students learn to identify harm/danger situations and break confidentiality appropriately (Standard 4)
- ⚠️ No demonstration of how students learn to coordinate/collaborate with other professionals (Standard 19)
- ⚠️ Missing evidence of assessment methods: how is mastery of professional boundaries measured beyond field instructor evaluation?
- ⚠️ Field Placement Evaluation form referenced but not provided; unclear what specific boundary-related criteria are assessed in Sections III and V
- ⚠️ No evidence of explicit instruction on power dynamics, transference, countertransference, or boundary violations in intimate/social contexts

---

### `19.h` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at 10. Self-Development Context: Human services professionals use their experience and knowledge to understand and help clients. This requires awareness of one’s values, cultural bias, philosophies, personality, and style in the effective use of the professional self. It also requires an understanding of how these personal characteristics affect clients._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[19][h].content`_

##### Narrative 1 — 🟢 conf 0.92, 393 words, `auto_accept`

_Source heading:_ **h.**

_AI rationale:_ The section directly addresses integration of NOHS/CSHSE ethical standards throughout the curriculum and field experiences, which matches Standard 19.h's specification on integrating these ethical standards. Standard 17.d (developing behaviors congruent with ethical standards) is a secondary fit but less precise than the explicit 'integration' language in 19.h.

```text
Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available on NOHS website).Response:The ethical standards outlined by the National Organization for Human Services (NOHS) and the Council for Standards in Human Service Education are part of the CHS Student Handbook which is given to every human services major before they enter the Program. Each new student signs a form acknowledging receipt of the handbook and agreeing to abide by the ethical standards. The standards are also incorporated into the behavioral indicators (3.D.) which are prerequisite for field experiences. The NOHS ethical standards are integrated throughout the curriculum and are specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441. Ethical standards are addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (Course Objective #4; unit on Ethical Issues in course schedule).CHS 220 Diversity and Cultural Competence emphasizes the importance the ethical standards in dealing with others as a component of cultural competence. See course objectives, the course schedule, and group presentation and immigrant interview assignments.In CHS 224 Research Methods and Writing, students learn about ethical requirements of social science research (see Week 4). Students develop a detailed research proposal that follows ethical guidelines. Adhering to the NOHS code of ethics is emphasized throughout the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 5); CHS 360 in the context of individual counseling techniques (Course Objective 4); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see 
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 70 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 26 Human service professionals seek the training, experience, education and supervision necessary to ensure the**

_AI rationale:_ The section addresses professional development, cultural competence, and self-awareness in working with diverse populations—core elements of Standard 19.h on integrating ethical standards and understanding one's professional self in relation to client effectiveness.

```text
STANDARD 26 Human service professionals seek the training, experience, education and supervision necessary to ensure their effectiveness in working with culturally diverse individuals based on age, ethnicity, culture, race, ability, gender, language preference, religion, sexual orientation, socioeconomic status, nationality, or other historically oppressive groups.  In addition, they will strive to increase their competence in methods which are known to be the best fit for the population(s) with whom they work.
```

##### Narrative 3 — 🟡 conf 0.72, 55 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 43 Human service educators are aware that in their relationships with students, power and status are unequal. H**

_AI rationale:_ The section addresses educator awareness of power dynamics and ethical conduct in student relationships, directly mapping to the integration of ethical standards and self-development context in Standard 19.h, which requires understanding how personal characteristics and professional relationships affect others.

```text
STANDARD 43 Human service educators are aware that in their relationships with students, power and status are unequal. Human service educators are responsible to clearly define and maintain ethical and professional relationships with student; avoid conduct that is demeaning, embarrassing or exploitative of students; and always strive to treat students fairly, equally and without discrimination.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[19][h].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[19][h].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided to substantiate claims about NOHS ethical standards integration (narrative only, zero supporting documents)
- ⚠️ Missing documentation of the CHS Student Handbook itself or the acknowledgment forms students sign
- ⚠️ No evidence showing how behavioral indicators (3.D.) specifically operationalize NOHS ethical standards
- ⚠️ Lack of syllabi or course materials demonstrating ethical standards content in the 10 courses listed (CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440, 441)
- ⚠️ No demonstration of how 'self-development context' (awareness of personal values, cultural bias, philosophy, personality, style) is explicitly taught or assessed
- ⚠️ Missing evidence of how students develop understanding of how personal characteristics affect clients
- ⚠️ No Student Field Placement Evaluation form provided despite citation in narrative
- ⚠️ Absence of field instructor feedback/evaluation documentation showing ethical behavior assessment
- ⚠️ STANDARD 26 (culturally diverse populations, best-fit methods) mentioned only tangentially in CHS 220; no evidence of curriculum-wide integration
- ⚠️ STANDARD 43 (educator awareness of power/status dynamics, fair treatment of students) not addressed at all in narrative or evidence

---

## Standard 20

### `20.a` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Conscious use of self._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[20][a].content`_

##### Narrative 1 — 🟢 conf 0.92, 487 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The narrative directly addresses conscious use of self as a core knowledge, theory, skill, and value, with detailed coverage of how it is taught across the curriculum and practiced in field placements. Standard 20.a explicitly specifies 'Conscious use of self' as a primary competency.

```text
Conscious use of self.Response:The conscious use of self is emphasized throughout the Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441.Included in the CHS 105 Human Services and Social Policy course objectives are the objectives that the student “describe how personal, ethical, and legal issues affect the delivery of human services” (#4) and “specify how his/her personal values and goals relate to a career in human services” (#6.).  In addition, conscious use of self is explored through assigned readings, lecture, and in-class activities (particularly the unit on the helping relationship, see schedule). CHS 220 Diversity and Cultural Competence emphasizes the conscious use of self as a component of cultural competence, particularly a focus on self-awareness and the influence of one’s own culture on perceptions and actions. See course objectives, the course schedule, and group presentation and immigrant interview assignments.In CHS 224 Research Methods and Writing, students learn about the conscious use of self as it relates to the influence a researcher can have on the data being collected (see Week 10). Students develop a detailed research proposal that accounts for the influence of self. The conscious use of self as a therapeutic tool is emphasized in all the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (process analysis paper; schedule); CHS 360 in the context of individual counseling techniques (Course Objective 1; interview papers; schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see family of origin assignment; Genograms and Ecomaps; and group project analyzing the application of family therapy models). CHS 340 Administration of Hum
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 203 words, `review_low_confidence`

_Source heading:_ **DiAngelo is correct in saying we all have our own experience but how can I tell who has had what experience and how to a**

_AI rationale:_ The section reflects on personal bias, self-awareness regarding implicit prejudice, and the student's conscious recognition of their own perspectives and interpersonal triggers—core elements of conscious use of self. While cultural competence (12.f) is tangentially present, the dominant focus is self-reflective awareness in relational contexts.

```text
DiAngelo is correct in saying we all have our own experience but how can I tell who has had what experience and how to assess a situation properly. Which opens our eyes to the good/bad binary mentioned throughout the video, the bad or racist people often have specific characteristics associated with them and she says this binary prevents us from seeing people in a different light. But in personal experience, often this binary is true. My grandfather is an old white, republican, trump supporter and often stands behind his very similar racist beliefs, beliefs that extend beyond race to other ways that people live their lives. Not to say that I do not care about my grandfather but I vehemently disagree with him and often feel like I am in a losing battle when trying to discuss race. Implicit bias is rampant in our society and while not always correct, certain people do fit into that binary, often stereotypes are stereotypes for a reason. Not to say that we should not give people a chance but rather to address that implicit bias is created through experience. The good bad binary, while maybe should be considered as not totally accurate can often reign true.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[20][a].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content and learning activities
- ⚠️ Narrative lacks clear definition or explanation of what 'conscious use of self' means within the human services context
- ⚠️ No demonstration of student learning outcomes—no evidence that students actually achieve competency in conscious use of self (e.g., no student reflections, evaluation results, or assessment data)
- ⚠️ Second half of narrative (DiAngelo excerpt) appears to be unrelated student work/reflection that does not substantiate program-level instruction in conscious use of self
- ⚠️ No evidence of how assessment of conscious use of self competency occurs or what benchmarks/standards are used
- ⚠️ Vague references to assignments (e.g., 'process analysis paper,' 'interview papers,' 'Reflection Paper') without showing actual assignment descriptions, rubrics, or examples of student work
- ⚠️ No explanation of how conscious use of self is scaffolded across the curriculum or how students progress in this competency
- ⚠️ Field placement evaluation mentioned but not provided as supporting document

---

### `20.b` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Clarification of personal and professional values._

**Final coverage verdict:** covered=**False**, score=**0.65**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.65, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[20][b].content`_

##### Narrative 1 — 🟢 conf 0.98, 475 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly addresses 'Clarification of personal and professional values' — the exact language of Standard 20.b. The narrative describes how the program emphasizes self-awareness, values exploration, and professional identity development across multiple courses and field placements.

```text
Clarification of personal and professional values.Response:The clarification of personal and professional values is emphasized throughout the Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 380, 440 and 441.Included in the CHS 105 Human Services and Social Policy course objectives are the objectives that the student “describe how personal, ethical, and legal issues affect the delivery of human services” (#4) and “specify how his/her personal values and goals relate to a career in human services” (#6.).  In addition, clarification of values is explored through assigned readings, lecture, and in-class activities related to self-assessment and becoming a helper and the helping process (see schedule). CHS 220 Diversity and Cultural Competence addresses the clarification of values in the context of diversity and cultural competence. Objective 1 of this course articulates that students should be able to “identify one’s own ethnic heritage, history or cultural background, values and assumptions and how this can affect one’s experience as a practitioner”.  This is amplified by Course Requirement 4 “Cultural Autobiography”.In CHS 224 Research Methods and Writing, students learn about the clarification of values as it relates to the values that are attached to social science research (see Week 10). Students develop a detailed research proposal that addresses the values and motivation behind the research. The clarification of personal and professional values is emphasized in all the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (process analysis paper); CHS 360 in the context of individual counseling techniques (Course Objective 1; interview papers); and CHS 430 Family Dynamics and Interventions in the context o
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[20][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided despite extensive citations to course syllabi, assignments, objectives, and evaluation tools throughout the narrative
- ⚠️ Missing actual examples of student work demonstrating values clarification (e.g., samples from Cultural Autobiography, Reflection Papers, process analysis papers, genograms)
- ⚠️ No evidence of the Student Field Placement Evaluation form referenced in narrative to demonstrate how values clarification is assessed
- ⚠️ Narrative is incomplete—cuts off mid-sentence ('Students also evaluate themselves using th') suggesting missing information
- ⚠️ No evidence of how clarification of personal vs. professional values is distinguished or scaffolded across the curriculum
- ⚠️ Missing documentation of specific self-assessment tools mentioned (referenced but not identified or provided)
- ⚠️ No evidence demonstrating how students' clarified values are connected to professional practice competencies or ethical decision-making frameworks

---

### `20.c` 🔴 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Awareness of intercultural fluency as outlined in Standard 19.d._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative provided addressing intercultural fluency awareness
- ⚠️ No supporting evidence documents, artifacts, or data submitted
- ⚠️ No demonstration of curriculum content related to intercultural competence
- ⚠️ No evidence of student learning outcomes or assessments related to intercultural fluency
- ⚠️ No examples of how Standard 19.d intercultural fluency is operationalized in the program
- ⚠️ No faculty/staff development or institutional practices related to intercultural awareness documented
- ⚠️ No student experiences, coursework, or assignments demonstrating intercultural fluency integration

---

### `20.d` 🟡 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Strategies for self-care._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[20][d].content`_

##### Narrative 1 — 🟢 conf 0.92, 353 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The narrative directly addresses 'Strategies for self-care' as specified in Standard 20.d, documenting how the program integrates self-care instruction across multiple courses and field placements through journaling, reflection, self-assessment, and mentored clinical experiences.

```text
Strategies for self-care.Response:Strategies for self-care are emphasized throughout the Counseling & Human Services Program. They are specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441.CHS 105 Human Services and Social Policy addresses strategies for self-care through class exercises, discussions, lecture, and readings related to classes defining helping and the role of the Human Services worker. Strategies for self-care is an important component of all the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (process analysis paper; schedule); CHS 360 in the context of individual counseling techniques (schedule); and CHS 430 in the context of family therapy (group project analyzing the application of family therapy models and related assignments, readings, lecture, and media presentations designed to promote increased self-awareness, reflection, and discussion of ways students can experience strategies for self-care both in the context of their own families and in working with other families; family of origin project). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which strategies for self-care are emphasized. Objective 2 of the CHS 380 course is that the students “analyze their own natural style of helping and its impact.” Students in the CHS 380 course use journaling, portfolios, and a substantial Reflection Paper which incorporates several self-assessment tools to help improve their strategies for self-care (Course Requirements 3, 4, and 5). In all field placements, students are mentored and evaluated by their field instructor partly on their ability to accept constructive criticism, analyze interpersonal strengths and weaknesses, and develop perso
… (truncated, full text imported)
```

#### Supporting evidence — text
_Destination: `Submission.narratives[20][d].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][d].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about self-care instruction
- ⚠️ Narrative lacks definition or explicit statement of what 'strategies for self-care' means in the counseling/human services context
- ⚠️ No evidence that self-care is taught as standalone content with specific competencies or learning outcomes; appears fragmented across courses without clear curricular sequencing
- ⚠️ Missing documentation of specific self-care strategies actually taught (e.g., stress management, boundary-setting, mindfulness, supervision/consultation, work-life balance, recognizing burnout signs)
- ⚠️ No evidence of assessment methods beyond course-embedded activities; unclear how mastery of self-care strategies is measured or evaluated
- ⚠️ Vague references to 'readings,' 'discussions,' and 'media presentations' without titles or specifics that could be verified
- ⚠️ Family of Origin project and reflection papers mentioned but not provided; cannot assess whether self-care is explicitly addressed in these assignments
- ⚠️ Field placement evaluation mention lacks detail—cannot verify that self-care competency is systematically assessed during internship/practicum

---

### `20.e` 🟢 — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency)._

**Final coverage verdict:** covered=**True**, score=**0.78**
_(first-pass: covered=True, score=0.78; second-pass after gap-fill: covered=True, score=0.78, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[20][e].content`_

##### Narrative 1 — 🟢 conf 0.94, 442 words, `auto_accept`

_Source heading:_ **e.**

_AI rationale:_ The section directly addresses reflection on professional self through journaling, portfolio development, and competency-demonstrating projects across the curriculum, which is the exact language of Standard 20.e in the current 2025 specification.

```text
Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).Response:The reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency) is emphasized throughout the Counseling & Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 340, 430, 380, 440 and 441. Students complete a Professional Portfolio project throughout their curriculum. They begin the portfolio in CHS 217, developing a resume and describing agencies they have visited. In CHS 380 they add to the portfolio based on self-assessment inventories and their experiences in Internship. The portfolio is completed in CHS 441 and it designed to reflect their professional accomplishments and personal insights throughout the program. CHS 105 Human Services and Social Policy course objectives include: 4) “describe how personal, ethical, and legal issues affect the delivery of human services” and 6) “specify how his/her personal values and goals relate to a career in human services”.  In addition, reflection on professional self is explored through assigned readings, lecture, and in-class activities specifically related to the role of self in establishing a helping relationship. In CHS 224 Research Methods and Writing, students complete a project demonstrating competency that reflects their professional self when they develop a detailed research proposal related to an aspect of the human services field. In CHS 340 Administration of Human Services, students complete two projects related to professional self: they work as a group to design a strategic plan and they write a formal proposal seeking resources (Course Requirements 2 and 6). The CHS 430 Family Dynamics and Interventions course objectives include the expectations that t
… (truncated, full text imported)
```

##### Narrative 2 — 🟢 conf 0.89, 92 words, `auto_accept`

_Source heading:_ **Professional portfolios were collected from one of the two CHS 441 Seminar in Human Services courses that graduating sen**

_AI rationale:_ The section describes assessment of professional portfolios from graduating seniors using a rubric and rating scale, directly matching Standard 20.e's specification for 'development of a portfolio' as evidence of reflection on professional self and competency demonstration.

```text
Professional portfolios were collected from one of the two CHS 441 Seminar in Human Services courses that graduating seniors complete in conjunction with their practicum experience in their last semester. A total of 10 portfolios were examined (59% of graduating students). Each portfolio was rated independently by two faculty members on each of the three outcomes, using the attached rubric and a 3-points scale. Ratings were: Inadequate/No Evidence (0), Adequate/Satisfactory (1), and Excellent (2). Raters gave the same ratings on 83% of the items. When ratings were different, they were averaged together.
```

##### Narrative 3 — 🟡 conf 0.72, 73 words, `review_low_confidence`

_Source heading:_ **We will continue to emphasize professionalism in all program courses and settings. In the future, this may not be the be**

_AI rationale:_ The section explicitly describes plans to assess student professional development through portfolios and capstone coursework assignments, directly aligning with Standard 20.e's specification for reflection on professional self through portfolio development as a competency demonstration method.

```text
We will continue to emphasize professionalism in all program courses and settings. In the future, this may not be the best instrument to assess student attainment of goals. We plan to examine student professional portfolios, which are developed in their seminar course, as well as an assignment from the capstone clinical skills course (CHS 430 Family Dynamics and Interventions). This will hopefully give us better data to distinguish areas of difficulty for students.
```

##### Narrative 4 — 🟡 conf 0.72, 60 words, `review_low_confidence`

_Source heading:_ **Students develop personal learning objectives and document progress toward meeting the objectives by journaling with the**

_AI rationale:_ The section describes students developing personal learning objectives, journaling with faculty supervisors, and maintaining portfolios—all core reflective practices for demonstrating competency and professional self-development as specified in Standard 20.e. The mention of seminars and field agency assignments provides secondary relevance to Standard 21 specs, but the primary focus is reflective 

```text
Students develop personal learning objectives and document progress toward meeting the objectives by journaling with their faculty supervisor. As part of the seminar, students augment individual portfolios developed in prior human services courses and present a discussion of their experience at the end of the semester.  Additional assignments may be required for the courses or from the human services agency.
```

##### Narrative 5 — 🟡 conf 0.72, 60 words, `review_low_confidence`

_Source heading:_ **Students develop personal learning objectives and document progress toward meeting the objectives by journaling with the**

_AI rationale:_ The section describes students documenting progress toward learning objectives through journaling and portfolio development with faculty supervision in a seminar context. This directly addresses Standard 20.e's specification for reflection on professional self through journaling and portfolio development. While the field experience seminar context is present, the primary focus is on the reflective

```text
Students develop personal learning objectives and document progress toward meeting the objectives by journaling with their faculty supervisor. As part of the seminar, students augment individual portfolios developed in prior human services courses and present a discussion of their experience at the end of the semester.  Additional assignments may be required for the courses or from the human services agency.
```

##### Narrative 6 — 🟡 conf 0.82, 55 words, `review_low_confidence`

_Source heading:_ **After you complete your interview, you will write a paper (either traditional format or questions followed by answers an**

_AI rationale:_ The section describes a reflective assignment (paper with reflection covering learning, surprises, and changed views) that directly aligns with Standard 20.e's requirement for reflection on professional self through a project demonstrating competency. While the content involves an interview, the emphasis is on the student's reflective synthesis afterward, not the interview skill itself.

```text
After you complete your interview, you will write a paper (either traditional format or questions followed by answers and double-spaced) which addresses the questions asked and then includes a reflection by you  that should cover 1)what you learned from the interview, 2)what surprised you and 3)how your views might have changed based on the interview.
```

##### Narrative 7 — 🟡 conf 0.52, 72 words, `review_low_confidence`

_Source heading:_ **Each student will write a research proposal that has potential for contributing to current knowledge in the student’s ch**

_AI rationale:_ The section describes a student assignment involving development of a research proposal with iterative feedback and portfolio maintenance, which aligns best with Standard 20.e's requirement for reflection on professional self through portfolio development or project demonstrating competency.

```text
Each student will write a research proposal that has potential for contributing to current knowledge in the student’s chosen topic/interest.  Students will develop this proposal, in stages, throughout the semester.  Each part of the proposal may be rewritten/improved using comments on the original version.  Students are encouraged to maintain a folder for all their work in this assignment.  The details of this assignment & the grading rubric are provided in this syllabus.
```

##### Narrative 8 — 🟡 conf 0.72, 58 words, `review_low_confidence`

_Source heading:_ **Each student will deliver a short (3 minutes or less) oral presentation about some aspect of your family that illustrate**

_AI rationale:_ This assignment requires students to reflect on personal/family experiences and dynamics through creative oral presentation, directly addressing the reflection on professional self specification. While family structures and roles appear in the content, the assignment's primary pedagogical intent is reflective self-awareness development.

```text
Each student will deliver a short (3 minutes or less) oral presentation about some aspect of your family that illustrates a family dynamic (i.e., reflections about the role a family member assumed, family rituals, difficult moments, humorous moments which taught you something, family events or individuals that shaped you). Creativity is encouraged. Photos, poems, songs are also welcome.
```

##### Narrative 9 — 🟡 conf 0.72, 113 words, `review_low_confidence`

_Source heading:_ **For each chapter assigned in the Sweitzer and King book, students will submit a one-page reflection that highlights one **

_AI rationale:_ The section describes a reflective writing assignment (one-page reflections on chapter readings) that directly aligns with Standard 20.e's requirement for 'reflection on professional self' through journaling or portfolio-type demonstrations. While field experience context is mentioned, the assignment itself is a reflective learning tool rather than field placement documentation.

```text
For each chapter assigned in the Sweitzer and King book, students will submit a one-page reflection that highlights one significant insight or noteworthy item they have gained from their reading of the chapter. In weeks where two chapters are assigned, there should be a separate reflection for each chapter (in one Word doc). These insights may consist of new ideas acquired, confirmations of prior beliefs, or applications of the reading to your placement. Reflections should be emailed to the instructor NO LATER THAN THE Sunday before the chapters will be discussed in the upcoming Monday class. See which chapters are assigned under the “Course Schedule Information” section at the end of our syllabus.
```

##### Narrative 10 — 🟡 conf 0.78, 102 words, `review_low_confidence`

_Source heading:_ **2.  Journals (25%) Students will write a journal reflection at the end of each week they are in placement which is submi**

_AI rationale:_ The section describes a weekly journaling assignment requiring student reflection on experiences, thoughts, and feelings during field placement—a direct match to Standard 20.e's specification of journaling as a method for reflection on professional self. While field experience monitoring is mentioned in the candidate list, the core content addresses reflective practice rather than site visit docum

```text
2.  Journals (25%) Students will write a journal reflection at the end of each week they are in placement which is submitted to their University Supervisors via email. The journal is due each Friday at midnight and should be at least one-page, single-spaced in length. Each journal entries will include a summary of activities and duties performed that week, a reflection on one’s thoughts and feelings about experiences that week and responses to questions or prompts from the University Supervisor. In order to protect client confidentiality, never include the name of the agency, clients or client identifiable information in the journal entries.
```

##### Narrative 11 — 🟢 conf 0.89, 50 words, `auto_accept`

_Source heading:_ **In this class, you will complete the professional portfolio that you have been developing. The portfolio will document y**

_AI rationale:_ This course assignment directly addresses Standard 20.e's requirement for 'development of a portfolio' as a mechanism for reflection on professional self. The narrative explicitly describes portfolio development as documentation of knowledge and skills with reflection on past and future professional growth.

```text
In this class, you will complete the professional portfolio that you have been developing. The portfolio will document your knowledge and skills and help you reflect about what you have done and what you will do. Your portfolio will help you to prepare for job interviews and graduate school applications.
```

##### Narrative 12 — 🟡 conf 0.72, 96 words, `review_low_confidence`

_Source heading:_ **Your professional portfolio will be unique, but it will contain the four common elements listed below and the components**

_AI rationale:_ The section describes a professional portfolio containing reflection on learning, professional philosophy, values, and goals—directly matching Standard 20.e's specification for 'Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).' The portfolio structure explicitly includes self-reflection components central to professional self-deve

```text
Your professional portfolio will be unique, but it will contain the four common elements listed below and the components related to each of them. You should include an introduction section with a complete and professional resume; a list of courses with brief descriptions, reflection on your learning, and examples of your work; a field experiences section that summarizes you work in the human services field (this is different from your resume); and a section on your professional philosophy and values and your professional goals. It is imperative that you proofread carefully for spelling, grammar, and punctuation.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[20][e].supportingEvidenceText`_

##### Evidence text 1 — conf 0.78, 203 words, `review_low_confidence`

_Source heading:_ **Reflection Papers (30% of your total grade) The reflection papers give you an opportunity to connect your own experience**

```text
Reflection Papers (30% of your total grade) The reflection papers give you an opportunity to connect your own experience of human development to the material you are learning in this class. You will be submitting four reflection papers for this course. All reflections should be submitted through Blackboard by the time and date specified in the assignment. Each paper is worth 75 points. Late papers will lose 7.5 points for each 24-hour period. For example, if a paper is due at 11:59pm on Wednesday and you do not submit it until 12:15pm on Friday, the maximum possible points you can earn for that paper will be 75 – (7.5 x 2) = 60. Each reflection paper should be about 2-3 pages long, double-spaced written with Times New Roman font. Specific prompts will be discussed in class and then posted on the course website at least a week prior to the due date. Please cite your instructor (M. Wong, personal communication, Insert date here) and/or the textbook for in-text citations. A reference is not necessary for these papers. If you are unfamiliar with APA style, visit http://www.apastyle.org/learn/tutorials/basics-tutorial.aspx and pay special attention to slides 13 to 25. Be sure to visit Blackboard for more information.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[20][e].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 388 | 0.72 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence provided showing actual student work samples or portfolios that demonstrate reflection on professional self; narrative describes portfolio components but no artifacts are attached
- ⚠️ Assessment data (the '10 portfolios examined' mention) lacks actual results, rubric scores, or outcome percentages—only mentions '83% agreement' between raters but no performance levels achieved
- ⚠️ Missing evidence of how journaling specifically demonstrates professional self-reflection; narrative mentions journaling occurs but provides no sample journal entries or analysis of their content
- ⚠️ No documentation of the actual rubric used to evaluate portfolios, despite being referenced as 'attached'
- ⚠️ Narrative indicates future plans to 'examine student professional portfolios' and assignments from CHS 430, suggesting current assessment is incomplete or under development
- ⚠️ No evidence demonstrating the Family of Origin Project (CHS 430) or how assignments from CHS 224 or CHS 340 specifically prompt reflection on professional self beyond assignment descriptions

---

## Standard 21

### `21.a` 🟢 — Field Experience

**Spec prompt:** _Provide a brief description of the overall process and structure of the fieldwork learning experience._

**Final coverage verdict:** covered=**True**, score=**0.82**
_(first-pass: covered=True, score=0.82; second-pass after gap-fill: covered=True, score=0.82, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][a].content`_

##### Narrative 1 — 🟢 conf 0.95, 960 words, `auto_accept`

_Source heading:_ **a.**

_AI rationale:_ The section directly provides a brief description of the overall process and structure of fieldwork learning experiences (internship and practicum), matching Standard 21.a language exactly. It also describes written learning contracts and progression elements that support 21.e and 21.h.

```text
Provide a brief description of the overall process and structure of the fieldwork learning experience.Response: (See Field Placement Handbook)Internship During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a field experience in a professional human services setting (CHS 380 Internship).  This placement provides students with the opportunity to apply the knowledge and skills they have learned in the program.  Concurrently, they explore professional issues in a seminar that meets one hour each week.  The internship is an important precursor to the practicum, which is a much more extensive and intensive experience. In the fall of their junior year, students meet with the Field Placement Coordinator to determine eligibility and to discuss placement interests.  The Field Placement Coordinator then suggests appropriate agencies for students to contact for an interview.  Practicum During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a professional human services setting (CHS 440 Practicum). [Note the 12-credit hour option (540 hours) was recently eliminated, since it was determined that the extra hours did not add to the value of the experience, but did add significantly to student stress levels. Some students who entered the program under the previous curriculum are still completing the 12-credit practicum, but most are being advised into the 9-credit practicum.] Like the internship, the practicum experience allows students to apply the knowledge and skills learned throughout the program.  In the practicum, students function much like entry level staff members and are valued members of service teams. Concurrently, students enroll in CHS 441, a 3-credit course entitled Seminar in Counseling & Human Services.  The seminar provides students an opportunity to discuss and reflect upon issues that may arise during the practicum.  Topics that are covered include the rol
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.72, 74 words, `review_low_confidence`

_Source heading:_ **Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 28 students are i**

_AI rationale:_ This brief summary reports current field placement census and site locations, fitting best under Standard 21.a's requirement for 'a brief description of the overall process and structure of the fieldwork learning experience.' While it could support 21.j (site visits/monitoring) or 21.c (agency exposure), it is primarily contextual reporting of program structure.

```text
Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 28 students are in internships and 17 students are in practicum placements. There are no new placements for practicum students this semester, but a new site near campus is working with an intern: Maximum Day Services, a medical day treatment and substance abuse program. Six students are at Sheppard Pratt, four are at St. Vincent’s and three are at St. Elizabeth School.
```

##### Narrative 3 — 🟡 conf 0.62, 95 words, `review_low_confidence`

_Source heading:_ **Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 21 students are i**

_AI rationale:_ This section provides a descriptive summary of field placements, agencies, and student enrollment numbers, which aligns best with Standard 21.a's request for 'a brief description of the overall process and structure of the fieldwork learning experience.' While site monitoring (21.j) is implied, no explicit evidence of site visits is documented.

```text
Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 21 students are in internships and 17 students are in practicum placements. Sites where students are working include: Project Youth and JHU, Senior Housing at Sunrise Assisted Living in Columbia, Turn Around – an agency dealing with human trafficking, International Social Services (this placement has been affected by the metro closure), House of Ruth, Mentoring Mentors (a program founded and run by alumnus Alphonso Mayo), and programs dealing with domestic violence and teen pregnancy. We are anticipating 9 students in practicum next fall.
```

##### Narrative 4 — 🟡 conf 0.72, 105 words, `review_low_confidence`

_Source heading:_ **Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 12 students are i**

_AI rationale:_ The section provides a descriptive summary of the overall field experience structure, including current placements, enrollment projections, and site development—directly matching Standard 21.a's requirement for a brief description of the overall fieldwork learning experience process and structure.

```text
Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 12 students are in practicum placements in a variety of placement sites, including the Baltimore Child Abuse Center, Kennedy Krieger, St. Elizabeth School, Mtn. Manor, Sheppard Pratt, and the Y of Central Maryland. We are anticipating 20 students in practicum next semester and 22 in internship. Mayaugust is currently working with students to find placements and already has three confirmed. New sites being developed include Project Youth at Johns Hopkins, Turn Around (a program dealing with human trafficking), and International Social Services. Ted described the field placements at CCBC related to addiction counseling.
```

##### Narrative 5 — 🟡 conf 0.52, 59 words, `review_low_confidence`

_Source heading:_ **Each student will complete two projects in addition to the service learning components. The first interview is a process**

_AI rationale:_ This section describes specific student activities (process recordings, taped interviews, role plays) that are part of the fieldwork learning experience structure. While the content touches on experiential activities, it best fits Standard 21.a (overall fieldwork process and structure description) as it outlines concrete project components students complete during field experience.

```text
Each student will complete two projects in addition to the service learning components. The first interview is a process recording and taped interview completed outside of class (20%). The second interview is an in-class role play completed during one of the last class sessions (10%). Details on each of these interviews will be provided separately and reviewed in class.
```

##### Narrative 6 — 🟡 conf 0.52, 92 words, `review_low_confidence`

_Source heading:_ **You will present both orally and in writing an issue which you have encountered during your practicum.  This issue can b**

_AI rationale:_ This section describes a practicum assignment requiring students to present and analyze a field experience issue, which relates to the overall structure and process of fieldwork learning. While reflection elements align with 20.e, the primary focus is on demonstrating how the field experience itself is structured to include reflective analysis components.

```text
You will present both orally and in writing an issue which you have encountered during your practicum.  This issue can be related to the work, the people, the site, or yourself (Chapter 10 in your textbook may be helpful in selecting a topic), and should include a description of the issue as well as a possible resolution(s). You should cite at least two external sources and include a bibliography using APA style. Papers should be approximately 3-4 pages long. Be prepared to give a fifteen-minute oral presentation and analysis of your issue.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][a].supportingEvidenceText`_

##### Evidence text 1 — conf 0.62, 34 words, `review_low_confidence`

_Source heading:_ **(table)**

```text
What were your duties at the field placement?
What qualities are necessary for success in this placement?
What were the positive aspects of your field experience?
What were the challenges of your field experience?
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][a].linkedDocuments`_

_(no evidence files auto-applied)_
#### Curriculum matrix cells
_Destination: `CurriculumMatrix.cells[]`_

- matrix: `(curriculum matrix table)`, col -1, code `(see matrix extractor)`, types [], depth `—`

#### Gaps still remaining (user must address manually after import)
- ⚠️ No explicit description of how students are selected or admitted into field experiences (prerequisites, GPA requirements, etc.)
- ⚠️ Limited detail on the role and expectations of faculty supervisors beyond 'journaling with faculty supervisor'
- ⚠️ No description of how placements are monitored, evaluated, or quality-assured beyond initial Field Placement Coordinator approval
- ⚠️ Minimal detail on learning outcomes or competencies students are expected to develop through fieldwork
- ⚠️ No information on how the program ensures diversity, equity, or appropriate population representation across placement sites
- ⚠️ The sentence about employed students is incomplete/cut off mid-word ('posit')

---

### `21.b` 🟡 — Field Experience

**Spec prompt:** _Provide evidence that one academic credit is awarded for no less than three hours of field experience per week._

**Final coverage verdict:** covered=**False**, score=**0.65**
_(first-pass: covered=False, score=0.65; second-pass after gap-fill: covered=False, score=0.65, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][b].content`_

##### Narrative 1 — 🟢 conf 0.94, 141 words, `auto_accept`

_Source heading:_ **b.**

_AI rationale:_ The section directly responds to the specification prompt asking for evidence that one academic credit is awarded for no less than three hours of field experience per week, providing concrete examples of credit-to-hours ratios across different field placements.

```text
Provide evidence that one academic credit is awarded for no less than three hours of field experience per week.Response:Students are granted academic credits for field placements.  The number of credits is contingent upon the number of field work hours. One credit hour is the equivalent of 3 hours of field work per week for 15 weeks (one semester). Thus, students who participate in the internship of 90 hours (six hours per week for 15 weeks) receive two credit hours (plus one credit for meeting in class one hour per week).  Students who participate in the practicum of 410 hours (27 hours per week for 15 weeks) receive 9 credit hours, and students who participate in the practicum of 540 hours (36 hours per week for 15 weeks) receive 12 credit hours [the 540 hour option is being eliminated for entering students].
```

##### Narrative 2 — 🟡 conf 0.72, 72 words, `review_low_confidence`

_Source heading:_ **Graduate Survey Results: Feedback from graduating seniors last fall was reviewed. Students consistently point to their f**

_AI rationale:_ The section directly addresses field experience hour requirements and credit calculation, specifying 410 hours (9 credit hours) as the new standard. This aligns with 21.b's specification of credit-to-hour ratios, and addresses the minimum 350-hour requirement under 21.a.

```text
Graduate Survey Results: Feedback from graduating seniors last fall was reviewed. Students consistently point to their field experiences, and to faculty, as the most beneficial parts of the program. Partly in response to student concerns, the number of hours required for the practicum will be limited to 410 (9 credit hours). This is already the most common option for students, but the 12-credit hour (540 hour, 39 hour/week) option will be eliminated.
```

##### Narrative 3 — 🟡 conf 0.68, 72 words, `review_low_confidence`

_Source heading:_ **Graduate Survey Results: Feedback from graduating seniors last spring was reviewed. Students consistently point to their**

_AI rationale:_ The section describes a decision to standardize field experience at 410 clock hours (9 credit hours), which directly addresses the credit-to-clock-hour conversion ratio specified in 21.b. The mention of eliminating the 12-credit option also relates to total field experience hour requirements in 21.g.

```text
Graduate Survey Results: Feedback from graduating seniors last spring was reviewed. Students consistently point to their field experiences, and to faculty, as the most beneficial parts of the program. Partly in response to student concerns, the number of hours required for the practicum will be limited to 410 (9 credit hours). This is already the most common option for students, but the 12-credit hour (540 hour, 39 hour/week) option will be eliminated.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][b].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][b].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting documentation provided (syllabus, credit hour policy, course catalog, field experience contracts, or student transcripts)
- ⚠️ No evidence of institutional policy or procedure that formally establishes the 1 credit = 3 hours per week formula
- ⚠️ No verification that credits are actually being awarded at the stated ratios (claims 2, 9, and 12 credits but provides no transcript examples or registrar confirmation)
- ⚠️ No documentation of how field hours are tracked, verified, and documented by supervisors or faculty
- ⚠️ Unclear whether the narrative describes current practice or future intent (mentions 540-hour option 'being eliminated' and repeated survey results suggest aspirational rather than implemented policy)

---

### `21.c` 🟢 — Field Experience

**Spec prompt:** _Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program._

**Final coverage verdict:** covered=**True**, score=**0.82**
_(first-pass: covered=True, score=0.82; second-pass after gap-fill: covered=True, score=0.82, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][c].content`_

##### Narrative 1 — 🟢 conf 0.98, 280 words, `auto_accept`

_Source heading:_ **c.**

_AI rationale:_ The section directly addresses the specification language requiring demonstration that students are exposed to human services agencies and clients early in the program through assigned visitations, observations, and agency interviews beginning in CHS 217. The narrative explicitly shows early exposure mechanisms (agency visits, interviews, tours) that match the spec's core requirement.

```text
Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program.Response:Field experiences are an integral part of each student’s total educational process. Their format and duration vary according to the particular student’s status in the program. Students’ exposures to agencies begin early in the program, when, as a requirement for CHS 217 Professional Development in Counseling & Human Services, students visit two different human services agencies and interview a human service worker at each agency.  In addition to the information collected during the interview, students are encouraged to tour the agencies and collect written documents (e.g., brochures, pamphlets, printed forms) describing the facility which can be shared in class.  Students present oral and written reports about their agencies.    Some type of field experience is incorporated into most courses in the program. For example, students in CHS 220 Diversity and Cultural Competence interview and write about someone who is part of a family that relates to a topic the class is discussing, such as a person who is an immigrant or whose parent/parents have immigrated to the United States.  Each student in CHS 360 Counseling Strategies for Individuals conducts an interview with a “client” and submits an audio recording and a systematic analysis of the interview.Although not a requirement of the program, many human services students receive direct exposure to agencies through their participation in the Human Services Club.  As part of their involvement in the club, students are responsible for both organizing and participating in various activities such as the Stevenson University Fair, and the Johns Hopkins University Children’s House, which provides housing for the families of critically ill children.
```

##### Narrative 2 — 🟡 conf 0.72, 128 words, `review_low_confidence`

_Source heading:_ **Loretta announced that she can take students seeking field experience now that she has moved into a new location in Pike**

_AI rationale:_ The section documents the program's efforts to identify and develop field placement sites and agencies where students can gain exposure and experience—directly addressing the requirement to demonstrate that students are exposed to human services agencies. The discussion of multiple placement opportunities (Loretta's groups, Target program, Sheppard Pratt, Project Search) exemplifies agency and cli

```text
Loretta announced that she can take students seeking field experience now that she has moved into a new location in Pikesville. She is developing a number of groups, including men’s and women’s groups, LGBT, couples, families and first responders. Lauren said that the Target program is very happy with SU students who are working there, including Chris and Abbey. Sheppard Pratt has a total of 15 interns and almost half of them are from Stevenson. A trauma unit at SP is something that students from the Trauma and Crisis Intervention class may be interested in exploring. Arthur mentioned that Project Search, near Johns Hopkins, is a program that seeks to place individuals with disabilities. There may be internship opportunities there – Arthur will send contact information to Mayaugust.
```

##### Narrative 3 — 🟡 conf 0.82, 117 words, `review_low_confidence`

_Source heading:_ **As part of the course, you will have the opportunity to apply concepts and skills taught in the 			classroom to real wor**

_AI rationale:_ The section describes students being exposed to human services agencies through volunteer service opportunities, agency visitation, and observation/assistance—directly matching Standard 21.c's requirement to demonstrate early exposure to agencies and clients. The structured progression from orientation through service completion also partially addresses 21.h's progression framework.

```text
As part of the course, you will have the opportunity to apply concepts and skills taught in the 			classroom to real world situations. Counseling strategies students will complete 15-20 hours of 			volunteer service at one of six partner human services agencies. During the second week of class, 		representatives from our partner agencies will provide an overview of the service opportunities. 			Selection of service experiences will take place in week three with orientation in week four, service 		beginning in week five and finishing no later than the week before finals. Students are evaluated on 		service provided and active ownership of and reflection on your learning. There are three 				requirements to complete this component: journals, time sheets, and contracts.
```

##### Narrative 4 — 🟡 conf 0.68, 91 words, `review_low_confidence`

_Source heading:_ **Service Learning Experience:  As part of the course requirement, each student will participate in a service learning pro**

_AI rationale:_ The service learning project requires students to engage directly with human services agencies and clients through volunteer work at designated sites, aligning with Standard 21.c's requirement that students be exposed to human services agencies and clients early in the program. The reflective journaling and supervised timesheets support documentation of this experiential learning.

```text
Service Learning Experience:  As part of the course requirement, each student will participate in a service learning project during the semester.  This will include an outside volunteer project at one or more of the sites made available by the professors. Each student will complete 15-20 hours at one or more of the sites and keep a journal of reflective and analytical entries of the service learning experience.   Student will be required to turn in three journal entries, due throughout the semester.  Time sheets will be signed for each day of service.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][c].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][c].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi, student reflections, agency agreements, etc.) to verify claims made in narrative
- ⚠️ Unclear timing: narrative states field experiences begin 'early in the program' but does not specify which semester(s) or year students first engage with agencies
- ⚠️ Limited documentation of 'assigned visitation' requirement—narrative describes CHS 217 agency visits but provides no evidence of assignment structure, rubrics, or completion rates
- ⚠️ No evidence that service learning in 'Counseling Strategies' course is mandatory across the program or represents systemic early exposure (appears to be one course requirement only)
- ⚠️ Human Services Club participation is explicitly stated as 'not a requirement'—this does not demonstrate mandatory early exposure as Specification requires
- ⚠️ Missing clarity on whether 'early in program' applies to all students or only those in specific tracks/electives

---

### `21.d` 🔴 — Field Experience

**Spec prompt:** _Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][d].content`_

##### Narrative 1 — 🟢 conf 0.93, 77 words, `auto_accept`

_Source heading:_ **d.**

_AI rationale:_ The section directly addresses the requirement to provide a copy of the current manual and guidelines given to students regarding field placement requirements and policies, which is an exact match to Standard 21.d.

```text
Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.Response:The Field Placement Handbook, which each student receives before participating in a field placement, includes all necessary information pertaining to the field placement and thus functions as a field work manual.  The Field Placement Handbook is revised on a yearly basis. Information about field placements, including prerequisites, can also be found in the CHS Student Handbook.
```

##### Narrative 2 — 🟡 conf 0.72, 77 words, `review_low_confidence`

_Source heading:_ **All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, st**

_AI rationale:_ The section describes field placement approval policies and requirements that students must follow, which directly aligns with Standard 21.d's requirement to provide a copy of current manuals and guidelines advising students of field placement requirements and policies.

```text
All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, students may not complete their internship or practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.
```

##### Narrative 3 — 🟡 conf 0.72, 69 words, `review_low_confidence`

_Source heading:_ **At the beginning of the semester before starting a practicum, students meet with the Field Placement Coordinator to esta**

_AI rationale:_ The section describes the field placement process and student eligibility criteria established before practicum begins. This directly supports Standard 21.d, which requires documentation of field placement requirements and policies given to students. The mention of eligibility assessment and placement procedures aligns with programmatic guidelines and policies for field placement.

```text
At the beginning of the semester before starting a practicum, students meet with the Field Placement Coordinator to establish eligibility, discuss placement interests, and develop a list of appropriate agencies for students to contact for an interview. Student eligibility is assessed by the department, according to the criteria below, at the end of each semester with final eligibility determined at the end of the semester before the practicum starts.
```

##### Narrative 4 — 🟡 conf 0.72, 77 words, `review_low_confidence`

_Source heading:_ **All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, st**

_AI rationale:_ The section describes field placement requirements, policies, and approval procedures that align with Standard 21.d, which calls for a manual/guidelines advising students of field placement requirements and policies. The content addresses placement approval processes and conditions (paid placements, concurrent employment restrictions) that would typically appear in such guidelines.

```text
All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, students may not complete their internship or practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.
```

##### Narrative 5 — 🟡 conf 0.72, 54 words, `review_low_confidence`

_Source heading:_ **Internship students interview at ONE agency.  If that agency is not appropriate the student must request permission from**

_AI rationale:_ This section describes field placement requirements and policies governing where students conduct internships and practicum interviews, directly matching Standard 21.d which requires documentation of current manuals and guidelines given to students about field placement requirements and policies.

```text
Internship students interview at ONE agency.  If that agency is not appropriate the student must request permission from the Field Placement Coordinator to interview at another agency. Practicum students interview with three agencies.  If those agencies are not appropriate the student must request permission from the Field Placement Coordinator to interview at another agency.
```

##### Narrative 6 — 🟡 conf 0.72, 54 words, `review_low_confidence`

_Source heading:_ **In preparation for the field placement, please review the university’s catalog on our website:  www.stevenson.edu/academ**

_AI rationale:_ The section directs students to review the university catalog containing field placement policies, non-discrimination policies, and grievance procedures prior to field placement. This directly addresses Standard 21.d's requirement to provide current manuals and guidelines for field placement requirements and policies.

```text
In preparation for the field placement, please review the university’s catalog on our website:  www.stevenson.edu/academics/catalog .  The catalog provides the university’s calendar as well as the university’s “Non-Discrimination and Sexual Harassment” policies and “Grievance Procedures”.  Please review these policies, as you are expected to be aware of them and, where applicable, comply with them.
```

##### Narrative 7 — 🟡 conf 0.72, 72 words, `review_low_confidence`

_Source heading:_ **1.  Field Agency Participation (40%) Regular attendance and active participation at the field agency placement is mandat**

_AI rationale:_ This section describes field placement requirements, policies, and expected student conduct (attendance, professional behavior, confidentiality, notification procedures), which directly aligns with Standard 21.d's requirement to provide a copy of manuals and guidelines advising students of field placement requirements and policies.

```text
1.  Field Agency Participation (40%) Regular attendance and active participation at the field agency placement is mandatory.  The student must follow all policies and procedures of the field placement site.  Professional behavior is expected at all times, which includes punctuality, appropriate dress, and maintaining confidentiality.  If the student must be late or absent due to an emergency, it is imperative that the field placement site and the University supervisor are notified immediately.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][d].supportingEvidenceText`_

##### Evidence text 1 — conf 0.72, 195 words, `review_low_confidence`

_Source heading:_ **(data table)**

```text
Important Dates for Practicum Spring 2019
January 28
First Day of Placement
Meet your University Supervisor during Seminar Class
February 11
Learning Contract Due
Preview of Time Sheets with University Supervisor
Meet your University Supervisor during Seminar Class
February 18
Revised Learning Contracts Due to University Supervisor
February 22
First University Supervisor Site Visit completed
March 11
Mid-Term Evaluations Due
Preview of Time Sheets with University Supervisor
Meet with your University Supervisor during Seminar Class
April 8
Preview of Time Sheets with University Supervisor
Set last day of placement
May 6 (Tentative)
Senior Practicum Poster Presentation
5-7pm location TBD
May 17
Final Paperwork due
Graduate Celebration Luncheon and Focus Group Discussion
Other Scheduling Notes:
Holiday Closings.
You will follow the holiday schedule of your placement site rather than Stevenson University’s calendar.  This is particularly important for the Spring Break.
Site Visits
.
Your University Supervisor will meet with you and your Field Instructor once before mid-term evaluations are due. Additional visits may be scheduled depending on the needs of the student and placement site.
Weekly Journal Reflections.
You will submit your weekly journal reflections to your University Supervisor weekly every week you are in placement.
```

##### Evidence text 2 — conf 0.72, 63 words, `review_low_confidence`

_Source heading:_ **Directions:  Please document the hours spent at your field placement using this sheet or the Agency’s time sheet if requ**

```text
Directions:  Please document the hours spent at your field placement using this sheet or the Agency’s time sheet if requested to do so by the agency. Your field instructor must sign the sheet every other week.  If you are not able to be at the placement during your set time (emergency, illness, etc.), you must notify your field instructor and your university supervisor.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][d].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | I have attached the Student Field Placement Handbook for you | `i-have-attached-the-student-field-placement-handbook-for-you` | 63 | 0.78 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/i-have-attached-the-student-field-placement-handbook-for-you.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ The actual Field Placement Handbook document itself is NOT provided; only a reference stating 'I have attached the Student Field Placement Handbook' appears in Evidence 3, but the handbook content is not included in the submitted materials
- ⚠️ No copy of the CHS Student Handbook is provided, despite the narrative stating field placement information 'can also be found' there
- ⚠️ The narrative describes policies but does not provide a comprehensive manual or guideline document that students receive; instead, it provides narrative summary of some policies
- ⚠️ Missing documentation of specific prerequisites for field placements beyond vague 'eligibility criteria' language
- ⚠️ No evidence of the yearly revised handbook itself—only references to its existence
- ⚠️ Missing details on student responsibilities, learning outcomes, or competency expectations that would typically appear in a field placement manual
- ⚠️ No documentation of agency expectations, requirements for field instructors, or evaluation criteria in a manual format

---

### `21.e` 🔴 — Field Experience

**Spec prompt:** _Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student._

**Final coverage verdict:** covered=**False**, score=**0.45**
_(first-pass: covered=False, score=0.45; second-pass after gap-fill: covered=False, score=0.45, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][e].content`_

##### Narrative 1 — 🟢 conf 0.94, 143 words, `auto_accept`

_Source heading:_ **e.**

_AI rationale:_ The section directly addresses the requirement for written learning agreements with field agencies that specify student role, activities, learning outcomes, supervision, and signatures from agency representatives, fieldwork supervisors, instructors, and students—matching Standard 21.e exactly.

```text
Provide documentation of written learning agreements with field agencies that specify the student’s role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency director, fieldwork supervisor, program instructor, and student.Response:A list of agencies where students complete field placements is in the Appendix. Most of the agencies do not require a formal contract, but sample agreements with Kennedy Krieger Institute and Sheppard Pratt, two of our larger field placement sites, are included. These agreements have not changed in the past five years. A more recent agreement with Baltimore County DSS is here. Upon the placement of a student with an agency, the Field Placement Coordinator sends a letter of agreement to the agency confirming the placement and summarizing expectations, along with a copy of the Field Placement Handbook, which discusses all aspects of the field placement.
```

##### Narrative 2 — 🟡 conf 0.62, 84 words, `review_low_confidence`

_Source heading:_ **Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If a**

_AI rationale:_ The section establishes policies regarding student employment during practicum and field placement arrangements, which directly relates to the written learning agreements and conditions governing field experiences specified in 21.e. The narrative addresses role definition and agency approval mechanisms that should be documented in placement agreements.

```text
Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If already employed at a human services agency, the student may not complete their practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.
```

##### Narrative 3 — 🟡 conf 0.62, 84 words, `review_low_confidence`

_Source heading:_ **Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If a**

_AI rationale:_ This section establishes policies regarding field placement agreements and arrangements (employment restrictions, separate placements, coordinator approval, paid placement conditions), which directly supports the written learning agreement specification 21.e that requires documentation of field placement terms and appropriate approvals.

```text
Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If already employed at a human services agency, the student may not complete their practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.
```

##### Narrative 4 — 🟡 conf 0.72, 94 words, `review_low_confidence`

_Source heading:_ **6.	Students with clinical responsibilities under this agreement will be covered by the School’s professional liability i**

_AI rationale:_ This section specifies requirements within a written learning agreement between the school and field agency (affiliate), including professional liability insurance coverage provisions. Standard 21.e requires documentation of written learning agreements that specify terms and conditions; professional liability insurance is a material term of such agreements.

```text
6.	Students with clinical responsibilities under this agreement will be covered by the School’s professional liability insurance in the minimum of $1 million per occurrence and $3 million aggregate OR the School will advise students that they are individually responsible for securing and maintaining professional liability insurance with limits satisfactory to Affiliate, but in no case less than $1 million per occurrence and $3 million aggregate and shall assure compliance with this provision.  Proof of professional liability insurance coverage for students in clinical training shall be provided to the Affiliate on an annual basis.
```

##### Narrative 5 — 🟡 conf 0.72, 92 words, `review_letter_disagrees`

_Source heading:_ **F.	Student’s acceptance into clinical or research training with Affiliate is contingent upon proof by student of profess**

_AI rationale:_ This section documents requirements for field placement agreements with affiliate agencies, specifying professional liability insurance as a condition of student acceptance into clinical training. The content directly addresses Standard 21.e's requirement for written learning agreements with field agencies that specify conditions and requirements for the affiliation.

```text
F.	Student’s acceptance into clinical or research training with Affiliate is contingent upon proof by student of professional liability coverage at limits accepted by Affiliate and the School, but in no case less that $1 million per occurrence and $3 million aggregate.  Coverage must remain in force throughout the period students are participating in the program.  Proof of professional liability insurance coverage for students in clinical training shall be provided to the Affiliate on an annual basis.  The Certificate of Insurance (COI) is required before the start of the training affiliation agreement.
```

##### Narrative 6 — 🟡 conf 0.52, 136 words, `review_low_confidence`

_Source heading:_ **1.  General Liability Insurance.  The SPONSOR and any students earning academic credit through the Education Program sha**

_AI rationale:_ This section addresses requirements for field experience placement agreements, specifically insurance and conditions precedent to student placement in a practicum/internship setting. Standard 21.e requires written learning agreements with field agencies that specify conditions of placement; insurance requirements are administrative preconditions documented in such agreements.

```text
1.  General Liability Insurance.  The SPONSOR and any students earning academic credit through the Education Program shall have general liability insurance coverage provided either by the SPONSOR or by the student and coverage shall be in the minimum amount of One Hundred Thousand Dollars ($100,000) for each incident and Five Hundred Thousand Dollars ($500,000) for annual aggregate coverage for each student.  SPONSOR agrees to furnish to the HEALTH SYSTEM a valid Certificate of Insurance of such general liability insurance for each proposed student as soon as practicable prior to and as a condition of his/her placement in the Education Program.  Where such liability insurance is procured directly by the student, the student must provide a valid Certificate of Insurance as soon as practicable prior to and as a condition of his/her placement in the Education Program.
```

##### Narrative 7 — 🟡 conf 0.58, 54 words, `review_low_confidence`

_Source heading:_ **E.         Representation.  In implementing this Agreement, the SPONSOR shall be represented by the head of the SPONSOR'**

_AI rationale:_ The section specifies designated representatives from both the academic sponsor and field agency who remain available for consultation and decision-making in a field agreement context, most closely aligning with Standard 21.e's requirement for written learning agreements signed by appropriate agency representatives and other parties.

```text
E.         Representation.  In implementing this Agreement, the SPONSOR shall be represented by the head of the SPONSOR's internship program or designee.  The HEALTH SYSTEM shall be represented by the Manager of Volunteer Services.  These representatives shall remain available for consultation and communication to act upon any decisions required in the performance of this Agreement.
```

##### Narrative 8 — 🟡 conf 0.72, 182 words, `review_low_confidence`

_Source heading:_ **3.  Learning Objectives (10%)  Students’ learning objectives should be submitted with their journal entries on the date **

_AI rationale:_ The section describes learning objectives submitted as part of a signed learning agreement between student, field instructor, and university supervisor—directly matching Standard 21.e's requirement for written learning agreements specifying learning outcomes and signed by all parties. The evaluation and documentation components relate secondarily to monitoring/supervision (21.j) but are subordinat

```text
3.  Learning Objectives (10%)  Students’ learning objectives should be submitted with their journal entries on the date noted in the syllabus.  Students should discuss their learning objectives with their field instructor before submission and obtain the field instructor’s signature. The signed learning contract must be submitted to the student’s University supervisor.  								4.  Student Field Placement Evaluation (20%)  At midpoint and at the completion of the field experience the student will complete a Student Field Placement Evaluation and share it with the field instructor.  In addition, the field instructor will complete an evaluation of the student.  Students will be evaluated in terms of personal qualities, role expectations within the agency setting, and professional qualities.  Once both parties sign both forms, the evaluation tools must be submitted to the University supervisor at midpoint and semester end.  				5.  Practicum Documentation (5%)  The following items must be submitted at the end of the semester along with the above evaluations:    Time Sheet Student, Field Placement Evaluation, University Supervisor Evaluation, Agency Evaluation, Graduate Information Sheet, Program Evaluation, Copy of a typed “thank you” letter to the field instructor
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][e].supportingEvidenceText`_

##### Evidence text 1 — conf 0.72, 58 words, `review_low_confidence`

_Source heading:_ **This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either part**

```text
This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either party up to sixty (60) days prior written notice. Anne Arundel Community College and Stevenson University will consider, in good faith, any amendments proposed by either party; however, the agreement may only be amended in writing, signed by both parties.
```

##### Evidence text 2 — conf 0.68, 53 words, `review_low_confidence`

_Source heading:_ **This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either part**

```text
This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either party upon sixty (60) days prior written notice.  FCC and SU will consider, in good faith, any amendments proposed by either party; however, the Agreement may only be amended in writing, signed by both parties.
```

##### Evidence text 3 — conf 0.58, 59 words, `review_low_confidence`

_Source heading:_ **Thank you for agreeing to participate in a human services field placement experience.  Our students look forward to the **

```text
Thank you for agreeing to participate in a human services field placement experience.  Our students look forward to the opportunity to put into practice what they have learned in their major courses.  Your participation in this experience is invaluable.  This letter is to confirm the placement of ____________  (Internship) ___________ (Practicum), the student who has been assigned to you.
```

##### Evidence text 4 — conf 0.72, 73 words, `review_low_confidence`

_Source heading:_ **Field placement instructors are expected to provide the students with an opportunity to demonstrate the application of t**

```text
Field placement instructors are expected to provide the students with an opportunity to demonstrate the application of their course studies to the workplace.  By accepting our student for a Field Placement, you are agreeing to comply with the terms and conditions as set forth in the Field Placement Handbook. If you have any questions as to what types of activities may be appropriate for your student, please do not hesitate to contact me.
```

#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][e].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence of a single, standardized written learning agreement template that is consistently used across all field placements; narrative states 'most agencies do not require a formal contract' and only samples from two agencies are provided
- ⚠️ No documentation showing that learning agreements specify the student's ROLE in concrete, observable terms
- ⚠️ No documentation showing that learning agreements specify ACTIVITIES to be performed by the student
- ⚠️ No documentation showing that learning agreements specify ANTICIPATED LEARNING OUTCOMES for each student
- ⚠️ No documentation showing that learning agreements specify the nature and frequency of SUPERVISION arrangements
- ⚠️ No documentation showing that learning agreements specify FIELD INSTRUCTION details (e.g., who provides it, frequency, format)
- ⚠️ No evidence of a standard signature block or executed agreements signed by all required parties (agency representative/director, fieldwork supervisor, seminar/program instructor, and student) on the same document
- ⚠️ The narrative references a 'Field Placement Handbook' and informal 'letter of agreement' sent by the Coordinator, but these do not appear to be the legally-binding written learning agreement the specification requires
- ⚠️ Supporting evidence includes institutional affiliation agreements (with insurance provisions) but not individual student learning agreements
- ⚠️ No sample of an actual completed/signed student learning agreement is provided in the evidence

---

### `21.f` 🟢 — Field Experience

**Spec prompt:** _Provide syllabi for required seminars. Seminars must meet at least every two weeks. Seminar hours must not be included in field experience hours._

**Final coverage verdict:** covered=**True**, score=**0.85**
_(first-pass: covered=True, score=0.85; second-pass after gap-fill: covered=True, score=0.85, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][f].content`_

##### Narrative 1 — 🟢 conf 0.96, 53 words, `auto_accept`

_Source heading:_ **f.**

_AI rationale:_ The section directly responds to the specification requesting syllabi for required seminars with minimum frequency requirements and clarification that seminar hours are separate from field experience hours. The response cites specific course syllabi (CHS 380, CHS 441) meeting the stated seminar frequency standards.

```text
Provide syllabi for required seminars. Seminars must meet no less than every two weeks. Seminar hours must not be included in field experience hours.Response:See syllabi for CHS 380 Internship and CHS 441 Seminar. Students meet in class weekly in CHS 380 and at least every other week in CHS 441 Seminar (for Practicum).
```

##### Narrative 2 — 🟡 conf 0.52, 61 words, `review_low_confidence`

_Source heading:_ **Satisfactory performance in CHS 380 (internship and accompanying seminar) is required for the practicum (CHS 440).  Unsa**

_AI rationale:_ The section describes prerequisites and performance requirements for field experience courses (CHS 380 internship/seminar and CHS 440 practicum), which relates most directly to seminar requirements and documentation; however, the content is primarily procedural policy rather than substantive specification compliance.

```text
Satisfactory performance in CHS 380 (internship and accompanying seminar) is required for the practicum (CHS 440).  Unsatisfactory performance (a grade below C) in CHS 380 will result in ineligibility for CHS 440.  Students whose performance in CHS 380 is unsatisfactory are permitted to repeat the course.  A second grade below C in CHS 380 will result in dismissal from the major.
```

##### Narrative 3 — 🟡 conf 0.72, 50 words, `review_low_confidence`

_Source heading:_ **Course Description:  Provides an opportunity for students to discuss and learn more about issues related to the practicu**

_AI rationale:_ The course description directly addresses a practicum seminar's purpose, structure, and organization. Standard 21.f requires syllabi for required seminars with specified meeting frequency; this description is the kind of foundational seminar documentation that would support that specification.

```text
Course Description:  Provides an opportunity for students to discuss and learn more about issues related to the practicum and to the field of human services.  Similar in organization to a professional development meeting, the seminar is designed to help facilitate the transition from undergraduate school to work and/or graduate school.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][f].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][f].linkedDocuments`_

| # | File title | Slug | Words | Conf | Source | S3 key (simulated) |
|---|---|---|---|---|---|---|
| 1 | (data table) | `data-table` | 353 | 0.72 | primary | `6986239a6612bf17f04a3217/docver-cb9174cf/data-table.docx` |

#### Gaps still remaining (user must address manually after import)
- ⚠️ No explicit syllabi documents provided as supporting evidence—only a weekly schedule/calendar table is shown. The Specification requires 'syllabi for required seminars' (plural), and no formal syllabus document with standard components (course title, number, credits, prerequisites, learning outcomes, grading breakdown, etc.) is attached.
- ⚠️ CHS 380 seminar frequency is stated as 'weekly' in narrative but the table shows only 10 weeks of content across ~11 calendar weeks (Jan 29–Apr 11), making verification of consistent weekly meetings difficult without a full semester schedule.
- ⚠️ Distinction between CHS 380 and CHS 441 seminar hour requirements is unclear. Narrative mentions both courses but only CHS 380 schedule is provided; CHS 441 frequency ('at least every other week') is asserted but no schedule is shown.
- ⚠️ No explicit statement or documentation confirming that seminar hours are not counted toward field experience hours totals, despite narrative acknowledgment of the requirement.

---

### `21.g` 🟢 — Field Experience

**Spec prompt:** _Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years._

**Final coverage verdict:** covered=**True**, score=**0.85**
_(first-pass: covered=True, score=0.85; second-pass after gap-fill: covered=True, score=0.85, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][g].content`_

##### Narrative 1 — 🟢 conf 0.96, 124 words, `auto_accept`

_Source heading:_ **g.**

_AI rationale:_ The section directly addresses Standard 21.g by providing evidence that the program requires at least 350 clock hours of field experience (the program documents 500–630 hours total) with at least 100 hours occurring in junior and senior years (90 hours junior, 410–540 hours senior).

```text
Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.Response:During the junior year of the Program, students spend 90 hours participating in a field experience in a human services setting as part of CHS 380 Internship.  During the senior year of the Program, students spend a full semester in a 9-credit (410 hours) or 12-credit (540 hours) field experience as part of CHS 440 Practicum in Counseling & Human Services. Thus, their total field experience hours will be at least 500 or 630 hours, all completed in their junior and senior years (See syllabi for these courses).
```

##### Narrative 2 — 🟡 conf 0.72, 118 words, `review_low_confidence`

_Source heading:_ **During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a professional hu**

_AI rationale:_ The section describes a 9-credit (410 hours) field experience requirement in the senior year, directly addressing Standard 21.g which requires demonstration of field experience clock hours totaling at least 350 hours with 100 occurring in junior and senior years. The accompanying seminar (CHS 441) and progression from observation to independent functioning also align with 21.h.

```text
During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a professional human services setting (CHS 440).  Like the internship, the practicum experience allows students to apply the knowledge and skills learned throughout the program.  In the practicum, students function much like entry level staff members and are valued members of service teams. Concurrently, students enroll in CHS 441, a 3-credit course entitled Seminar in Human Services.  The seminar provides students an opportunity to discuss and reflect upon issues that may arise during the practicum.  Topics that are covered include the role of the student in a professional setting as well as issues that pertain to the field of human services.
```

##### Narrative 3 — 🟡 conf 0.78, 81 words, `review_low_confidence`

_Source heading:_ **During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a fiel**

_AI rationale:_ The section describes a required 90-hour field experience in the junior year within a human services setting, directly addressing the clock-hour requirement and timing specification in Standard 21.g. The concurrent seminar component also relates to 21.f requirements regarding seminar structure.

```text
During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a field experience in a non-profit, human services setting (CHS 380).  This placement provides students with the opportunity to apply the knowledge and skills they have learned in the program.  Concurrently, they explore professional issues in a seminar that meets one hour each week.  The internship is an important precursor to the practicum, which is a much more extensive and intensive experience.
```

##### Narrative 4 — 🟡 conf 0.78, 81 words, `review_low_confidence`

_Source heading:_ **During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a fiel**

_AI rationale:_ The section describes a 90-hour junior year field experience in a human services setting, which directly addresses Standard 21.g's requirement that field experience include hours occurring in the junior and senior years. The concurrent seminar component also relates to 21.f (seminar requirements).

```text
During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a field experience in a non-profit, human services setting (CHS 380).  This placement provides students with the opportunity to apply the knowledge and skills they have learned in the program.  Concurrently, they explore professional issues in a seminar that meets one hour each week.  The internship is an important precursor to the practicum, which is a much more extensive and intensive experience.
```

##### Narrative 5 — 🟡 conf 0.72, 118 words, `review_low_confidence`

_Source heading:_ **During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a non-profit, hum**

_AI rationale:_ The section describes a 410-hour senior-year field experience (CHS 440) that directly addresses the required minimum clock hours and timing specified in Standard 21.g. The concurrent seminar (CHS 441) provides reflective oversight consistent with field monitoring expectations.

```text
During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a non-profit, human services setting (CHS 440).  Like the internship, the practicum experience allows students to apply the knowledge and skills learned throughout the program.  In the practicum, students function much like entry level staff members and are valued members of service teams. Concurrently, students enroll in CHS 441, a 3-credit course entitled Seminar in Human Services.  The seminar provides students an opportunity to discuss and reflect upon issues that may arise during the practicum.  Topics that are covered include the role of the student in a professional setting as well as issues that pertain to the field of human services.
```

##### Narrative 6 — 🟡 conf 0.72, 73 words, `review_low_confidence`

_Source heading:_ **Attendance at your field placement is critical to the successful completion of this course. You are required to complete**

_AI rationale:_ The section specifies a required 90 clock hours of field experience with allowances for excused absences, directly addressing Standard 21.g which requires evidence of field experience clock hours. While the narrative does not specify the full 350-hour requirement or junior/senior year distribution, it documents the minimum hours and attendance policy central to field experience documentation.

```text
Attendance at your field placement is critical to the successful completion of this course. You are required to complete 90 hours of field placement. Up to 10% (nine hours) may be forgiven due to unscheduled agency closures such as due to inclement weather or serious illnesses or other emergencies. Approval of missed time for serious illnesses or emergencies will be reviewed on a case-by-case basis and will only be approved with appropriate documentation.
```

##### Narrative 7 — 🟡 conf 0.78, 51 words, `review_low_confidence`

_Source heading:_ **In order to successfully complete practicum placement (CHS 440), students registered for the 9 credit practicum must be **

_AI rationale:_ The section specifies required field experience clock hours (410 and 540 hours depending on credit enrollment), which directly addresses Standard 21.g's requirement to provide evidence that field experience meets minimum clock hour thresholds. The content establishes the specific hour requirements for the practicum placement course.

```text
In order to successfully complete practicum placement (CHS 440), students registered for the 9 credit practicum must be complete 410 hours in placement and students registered for the 12 credit practicum must complete 540 hours. Students should follow the guidelines for absences during placement as outline in the field placement handbook.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][g].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][g].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (syllabi referenced in narrative but not attached)
- ⚠️ No documentation of how associate-level hours (if any) are tracked or documented in the program
- ⚠️ No evidence of verification mechanism showing students actually complete required hours (e.g., timesheets, supervisor sign-offs, placement agreements)
- ⚠️ Redundant narrative text (junior year CHS 380 description repeated twice) suggests possible editing errors and reduces confidence in thoroughness
- ⚠️ No clarification on whether all students complete both CHS 380 (90 hours) and CHS 440 (410+ hours) or if there are alternative pathways

---

### `21.h` 🟡 — Field Experience

**Spec prompt:** _Demonstrate how the field experience provides the student with an opportunity to progress from: 1. Observation to 2. Directly supervised client contacts to 3. Indirectly supervised client contacts to 4. An independent caseload OR assignment of administrative responsibility._

**Final coverage verdict:** covered=**False**, score=**0.55**
_(first-pass: covered=False, score=0.55; second-pass after gap-fill: covered=False, score=0.55, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][h].content`_

##### Narrative 1 — 🟢 conf 0.92, 714 words, `auto_accept`

_Source heading:_ **h.**

_AI rationale:_ The section's first and primary part (h.) directly addresses the progression from observation through directly supervised, indirectly supervised, to independent caseload or administrative responsibility—the exact language of Standard 21.h. The subsequent paragraphs (i. and j.) are embedded responses to those specs but the dominant content and longest narrative body maps to 21.h.

```text
Demonstrate how the field experience provides the student an opportunity to progress from:Observation toDirectly supervised client contact toIndirectly supervised client contact toAn independent caseload OR assignment of administrative responsibility.Response:Both the Internship (CHS 380) and Practicum (CHS 440) experiences typically provide students the opportunity to begin with observation and progress first to directly supervised client contact and then to indirectly supervised client contact and finally to independent caseloads or assignment of administrative responsibility.  For example, one student’s practicum experience was with the Baltimore County Department of Social Services’ Adoption and Foster Care Unit.  The student began by observing other workers’ interactions with clients, reading case files, and talking with her co-workers.  Next, she was supervised as she interacted with clients.  During the last two months of her field placement, she had the opportunity to have her own cases; in particular, she worked very closely with two children in foster care/pre-adoptive placements.  A young female teen that she mentored responded very positively to her interventions, and an emotionally disturbed 10-year old boy delighted in working on his Lifebook with her. The student also supervised visitations between children and their birthparent(s).Every semester, the Field Placement Coordinator reviews evaluations of placement sites completed by students and summaries of their experiences in order to assess the nature of their assignments and duties while at the site. The Field Placement Coordinator also reviews reports submitted by University Supervisors based on their visits to sites. When new sites are acquired or current sites fail to provide either an assignment of an independent caseload or assignment of administrative responsibilities within the agency, the Field Placement Coordinator contacts the site to ensure appropriate assignment of caseload or administra
… (truncated, full text imported)
```

##### Narrative 2 — 🟡 conf 0.68, 65 words, `review_low_confidence`

_Source heading:_ **Field experiences (internship and practicum) were highlighted in the responses to the first question (over 75% of studen**

_AI rationale:_ The narrative describes students' progression from observation and classroom learning to applied practice with agency supervision and guidance, which directly aligns with Standard 21.h's requirement to demonstrate progression from observation through supervised to independent work. The mention of support, guidance, and learning outcomes also supports this reading.

```text
Field experiences (internship and practicum) were highlighted in the responses to the first question (over 75% of students mentioned this).  Students appreciated the opportunity to apply their classroom learning. Several students mentioned the support and guidance they received and how much they learned about themselves. Some specific courses/experiences were mentioned by individual students, such as the addiction courses, administration of human services, and student presentations.
```

##### Narrative 3 — 🟡 conf 0.72, 54 words, `review_low_confidence`

_Source heading:_ **Seniors listed a wide variety of duties at their placements.  They observed and assisted supervisors, and planned, imple**

_AI rationale:_ The section describes seniors progressing through observation and assistance to direct client contact and administrative responsibility (office work, intake, outreach, communication), which directly demonstrates the progression framework in Standard 21.h from observation through supervised to independent work.

```text
Seniors listed a wide variety of duties at their placements.  They observed and assisted supervisors, and planned, implemented, and assessed activities.  Many reported that they were responsible for general “office work” such as data entry and filing.  Other duties included intake and outreach and communication with clients, employees within the organization, and the public.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][h].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][h].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No supporting evidence documents provided (e.g., field placement agreements, student evaluation forms, supervisor visit reports, placement site catalogs)
- ⚠️ Narrative relies on single anecdotal example (Baltimore County adoption/foster care student) rather than demonstrating systematic progression across multiple students
- ⚠️ No evidence that ALL students progress through all four stages; narrative uses language like 'typically provide' and 'opportunity to' rather than demonstrating consistent requirement
- ⚠️ No documentation showing how the Field Placement Coordinator's monitoring process ensures each student completes all four progression stages
- ⚠️ No data on what percentage of students achieve independent caseload vs. administrative responsibility assignments
- ⚠️ Vague description of how 'indirectly supervised client contact' stage is defined and assessed
- ⚠️ Student feedback quotes mention 'applying classroom learning' and 'support and guidance' but do not specifically address progression through observation to independence
- ⚠️ Student duty list from seniors (observed/assisted, data entry, intake, communication) does not clearly map to the four progressive stages required
- ⚠️ No evidence that site removal process (mentioned for inadequate caseload/admin assignments) is actually implemented with documentation

---

### `21.i` 🔴 — Field Experience

**Spec prompt:** _Demonstrate that field supervisors have a degree at least as high as the one awarded by the program. It is strongly recommended that field supervisors hold at least one degree level above the degree in Human Services or a related field._

**Final coverage verdict:** covered=**False**, score=**0.00**
_(first-pass: covered=False, score=0.00; second-pass after gap-fill: covered=False, score=0.00, delta=+0.00)_

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
- ⚠️ No narrative explanation provided describing the program's approach to field supervisor qualifications
- ⚠️ No evidence of field supervisor degree verification (transcripts, credentials, or roster with degree information)
- ⚠️ No documentation of minimum degree requirement alignment with the degree awarded by the program
- ⚠️ No evidence addressing the strongly recommended requirement that supervisors hold at least one degree level above the program's degree
- ⚠️ No list or roster of current field supervisors with their educational credentials
- ⚠️ No policy or procedure documentation showing how the program vets and maintains supervisor qualifications

---

### `21.j` 🔴 — Field Experience

**Spec prompt:** _Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology. The technology used should ensure that both the field placement supervisor and the student can be identified._

**Final coverage verdict:** covered=**False**, score=**0.25**
_(first-pass: covered=False, score=0.25; second-pass after gap-fill: covered=False, score=0.25, delta=+0.00)_

#### Narrative content
_Destination: `Submission.narratives[21][j].content`_

##### Narrative 1 — 🟡 conf 0.72, 58 words, `review_low_confidence`

_Source heading:_ **A majority of students (87%) indicated that they would recommend their placement to another student. Four students (13%)**

_AI rationale:_ The section reports on site visits conducted by the chair and field placement coordinator to evaluate placement quality and student outcomes, directly addressing the monitoring and site visit requirement in Standard 21.j.

```text
A majority of students (87%) indicated that they would recommend their placement to another student. Four students (13%) would not recommend their placement to another student. The CHS chair and the field placement coordinator have examined specific issues and visited one site. For those sites that may not be beneficial to all students, placements will be made selectively.
```

##### Narrative 2 — 🟡 conf 0.72, 132 words, `review_low_confidence`

_Source heading:_ **The final Student Field Placement Evaluations in CHS 440 Practicum in Human Services were used to assess student perform**

_AI rationale:_ The section describes monitoring student progress in field placements through weekly reports to University Supervisors and formal evaluations completed by field supervisors, which directly addresses Standard 21.j's requirement to continually monitor progress. While evaluation data is also mentioned, the focus is on the monitoring mechanism and site oversight rather than comprehensive program evalu

```text
The final Student Field Placement Evaluations in CHS 440 Practicum in Human Services were used to assess student performance on all 6 program outcomes, which were directly rated by the students’ field supervisors. The goals were broken down into specific behaviors that supervisors rated as ‘Below’ ‘Meets’ or ‘Exceeds’ Expectations. Supervisors could make optional comments on each item and gave overall comments at the end of each evaluation. As background, for this course students are working at area agencies for either 410 hours or 540 hours over the semester (about 29 hrs/week or 39 hrs/week). Students work with the Field Placement Coordinator, Dr. Finkenberg, to select theirs sites; they report weekly to University Supervisors who oversee their progress is placements; but it is their supervisors at the agencies who complete the evaluations.
```

##### Narrative 3 — 🟡 conf 0.72, 54 words, `review_letter_disagrees`

_Source heading:_ **STANDARD 41 Human service educators monitor students' field experiences to ensure the quality of the placement site, sup**

_AI rationale:_ The narrative addresses monitoring of field experiences and site quality, which directly aligns with Standard 21.j's requirement that programs continually monitor student progress and perform site visits to placement sites. The mention of safeguarding students during harmful events supports the oversight and quality assurance focus of monitoring specifications.

```text
STANDARD 41 Human service educators monitor students' field experiences to ensure the quality of the placement site, supervisory experience, and learning experience towards the goals of personal, professional, academic, career, and civic development. When students experience potentially harmful events during field placements, educators provide reasonable investigation and response as necessary to safeguard the student.
```

#### Supporting evidence — text
_Destination: `Submission.narratives[21][j].supportingEvidenceText`_

_(no supporting-evidence text auto-applied)_
#### Supporting evidence — files
_Destination: `SupportingEvidence` collection in Mongo + S3 upload + `narratives[21][j].linkedDocuments`_

_(no evidence files auto-applied)_
#### Gaps still remaining (user must address manually after import)
- ⚠️ No evidence that site visits occur 'no less than one site visit to each field placement site per quarter or semester' — narrative mentions only that 'the CHS chair and the field placement coordinator have examined specific issues and visited one site' (singular), not systematic visits to all sites
- ⚠️ No documentation of a monitoring system or schedule for conducting required site visits
- ⚠️ No evidence of direct site visits or technology-enabled visits with identification of both field supervisor and student
- ⚠️ No supporting documentation provided (visit logs, schedules, sign-in sheets, video conference records, or other evidence of actual site visits)
- ⚠️ Narrative focuses on student satisfaction survey results and supervisor evaluations rather than evidence of required site monitoring visits
- ⚠️ No clarification of what 'appropriate technology' is being used, if any, or how identification is verified
- ⚠️ No systematic process described for monitoring 'each' student's progress through site visits

---

---

## Tag list — items needing human triage

These 47 items did not auto-apply. They become rows in the wizard's **Tag List** view; the coordinator clicks each one to see full text, AI reasoning, and dropdowns to assign std/spec/kind and apply or discard. (See [[import-wizard-ui-spec-2026-05-17#4-the-tag-list-what-happens-to-questionable-items]].)

| Tag ID | Suggested | Conf | Source heading | Excerpt |
|---|---|---|---|---|
| `tag-ee8b4236` | `0.x` | 0.00 | During the third republic, Park Chung Hee (Major general of the military in Sout | During the third republic, Park Chung Hee (Major general of the military in South Korea during the second republic) ran again and won 51.4% … |
| `tag-b38b8bc5` | `—` | 0.00 | During the fourth republic, Park developed a new constitution which gave him con | During the fourth republic, Park developed a new constitution which gave him control over parliament (History of South Korea). This journey … |
| `tag-f9b1a28e` | `—` | 0.00 | This paper will be graded based on the appropriate use of the selected sociology | This paper will be graded based on the appropriate use of the selected sociology concepts, appropriate title for the paper, organization of … |
| `tag-87a4971a` | `—` | 0.02 | During the second republic, It was the first and only time that South Korea util | During the second republic, It was the first and only time that South Korea utilized a cabinet system  instead of a presidential system (His… |
| `tag-2ee20d6e` | `—` | 0.05 | Weekly In-Class Quizzes (10% of your total grade)  In order to ensure that you a | Weekly In-Class Quizzes (10% of your total grade)  In order to ensure that you are keeping up with the readings, understanding the course ma… |
| `tag-e15a95d1` | `—` | 0.15 | Two extra-credit assignments are provided in this syllabus: the video review and | Two extra-credit assignments are provided in this syllabus: the video review and the group discussion papers.  Students who are interested m… |
| `tag-8b8b66f6` | `17.a` | 0.38 | 1.  Course Participation (20%)  You should arrive at each class prepared to offe | 1.  Course Participation (20%)  You should arrive at each class prepared to offer analysis, questions, and critique of the assigned readings… |
| `tag-91e9d22a` | `2.c` | 0.42 | (data table) | PSY 101 Introduction to Psychology Fall, 2018 DATE LECTURE TOPIC MODULE INTRO VIDEO Week 1: 1-28 Introduction to course/ Why Science Why Sci… |
| `tag-9a02627d` | `21.c` | 0.42 | Provides students with an opportunity to explore career directions within the co | Provides students with an opportunity to explore career directions within the counseling and human services field and to develop appropriate… |
| `tag-87c8ac37` | `5.a` | 0.42 | E.  Notice of Student Cancellation.  In the event of cancellation by a student h | E.  Notice of Student Cancellation.  In the event of cancellation by a student holding a reserved space in an Education Program at HEALTH SY… |
| `tag-d3bc4921` | `21.e` | 0.42 | K.         Assignment.  No assignment of this Agreement or the rights and obliga | K.         Assignment.  No assignment of this Agreement or the rights and obligations hereunder shall be valid without the specific written … |
| `tag-10f5a603` | `6.a` | 0.42 | H.         Termination.  This Agreement may be terminated by either party upon g | H.         Termination.  This Agreement may be terminated by either party upon giving written notice of such intent to the other party as de… |
| `tag-0e11bd23` | `21.e` | 0.42 | N.         Execution.  This Agreement and amendments thereto shall be executed i | N.         Execution.  This Agreement and amendments thereto shall be executed in duplicate copies:  (1) on behalf of the SPONSOR by an appr… |
| `tag-5aa3375b` | `1.c` | 0.42 | Attendance is required and expected. Students are responsible for the material p | Attendance is required and expected. Students are responsible for the material presented in class which includes lectures and guest speakers… |
| `tag-a8494952` | `5.b` | 0.42 | Disability Services Stevenson University will make reasonable accommodations for | Disability Services Stevenson University will make reasonable accommodations for students with disabilities. The Office of Disability Servic… |
| `tag-225aa0d7` | `14.b` | 0.42 | The SU graduate will use inquiry and analysis, critical and creative thinking, s | The SU graduate will use inquiry and analysis, critical and creative thinking, scientific reasoning, and quantitative skills to gather and e… |
| `tag-fdb2be59` | `8.b` | 0.42 | All students who selected a related nation will conduct a seminar presentation f | All students who selected a related nation will conduct a seminar presentation for the entire class.  Presentations should be 30 minutes.  S… |
| `tag-e4b42454` | `19.d` | 0.42 | The purpose of this paper is for you to learn about the immigrant experience fro | The purpose of this paper is for you to learn about the immigrant experience from a specific individual’s perspective.  The individual can b… |
| `tag-ff58a6c5` | `14.a` | 0.42 | Each student will write a research proposal that has potential for contributing  | Each student will write a research proposal that has potential for contributing to current knowledge in the student’s chosen topic/interest.… |
| `tag-aab6b371` | `5.b` | 0.42 | Each student is responsible for his or her own class attendance and regular atte | Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the mat… |
| `tag-6f0dc8ff` | `5.d` | 0.42 | Regular class attendance and participation are necessary to pass and/or do well  | Regular class attendance and participation are necessary to pass and/or do well in this and indeed all courses.  Students are encouraged to … |
| `tag-94c03274` | `12.c` | 0.42 | Although progression, industrialization and democratization has revolutionized a | Although progression, industrialization and democratization has revolutionized a woman’s role in South Korean society, traditional gender ro… |
| `tag-88db7773` | `5.b` | 0.42 | Each student is responsible for his or her own class attendance and regular atte | Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the mat… |
| `tag-32173a6d` | `14.b` | 0.42 | The SU graduate will use inquiry and analysis, critical and creative thinking, s | The SU graduate will use inquiry and analysis, critical and creative thinking, scientific reasoning, and quantitative skills to gather and e… |
| `tag-cf28e7b5` | `1.d` | 0.42 | Submission of Assignments or Projects: All assignments or presentations are due  | Submission of Assignments or Projects: All assignments or presentations are due at the beginning of the class period on the day they are due… |
| `tag-3ed47b6b` | `5.b` | 0.42 | Disability Services  - Stevenson University will make reasonable accommodations  | Disability Services  - Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Dis… |
| `tag-e3963cd3` | `21.d` | 0.42 | For your issue presentation, choose an issue or challenge that you have been fac | For your issue presentation, choose an issue or challenge that you have been facing at your site this semester. It doesn't necessarily have … |
| `tag-710b77fd` | `5.b` | 0.42 | Each student is responsible for his or her own class attendance and regular atte | Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the mat… |
| `tag-712782b0` | `1.c` | 0.42 | If there is an unscheduled university closing on the day that an assignment is d | If there is an unscheduled university closing on the day that an assignment is due, the assignment deadline will remain unchanged if it was … |
| `tag-2dc7bd81` | `5.b` | 0.42 | I prefer to talk to you in person about any ideas or issues you may have, so ple | I prefer to talk to you in person about any ideas or issues you may have, so please schedule an appointment to meet with me!  If you miss cl… |
| `tag-9093bb7a` | `9.e` | 0.42 | This class works best when you are here.  The Lab component in particular is acc | This class works best when you are here.  The Lab component in particular is accomplished in real time and much of the activity can be compl… |
| `tag-70f78851` | `5.b` | 0.42 | I will monitor your attendance in accordance with mandates from the Stevenson Un | I will monitor your attendance in accordance with mandates from the Stevenson University Registrar.  While you will not earn a grade for att… |
| `tag-f2c545ca` | `5.d` | 0.42 | Policies: Late policy: All late assignments will lose 10% of its worth for each  | Policies: Late policy: All late assignments will lose 10% of its worth for each 24-hour period. Please note: No Computer Device Allowed in C… |
| `tag-381db192` | `9.e` | 0.42 | Classroom Policies: I prefer to talk to you in person about any ideas or issues  | Classroom Policies: I prefer to talk to you in person about any ideas or issues you may have, so please visit my office hours or schedule an… |
| `tag-761790c0` | `11.d` | 0.42 | We understand something the most when we either experience it or are able to rel | We understand something the most when we either experience it or are able to relate to it, one way or another.  This assignment requires stu… |
| `tag-f4045c35` | `11.d` | 0.42 | There are more than 15 sociology concepts in this text, used either explicitly,  | There are more than 15 sociology concepts in this text, used either explicitly, described but not directly mentioned or as underlying ideas … |
| `tag-c3868d6b` | `12.b` | 0.42 | Groups will research their chosen topics and present their findings in class.  A | Groups will research their chosen topics and present their findings in class.  All members of the group must participate in the research, co… |
| `tag-32b53baa` | `12.b` | 0.42 | The class will be split into small groups.  Each group will be assigned one or m | The class will be split into small groups.  Each group will be assigned one or more class topics.  The group reads the assigned materials fo… |
| `tag-45688fc7` | `11.d` | 0.42 | In this assignment, students will read an assigned material and identify the soc | In this assignment, students will read an assigned material and identify the sociology concepts (not theories) in the text they read.  These… |
| `tag-0b09e171` | `8.b` | 0.42 | Students who so desire may write a 2-3 page review of the documentary Generation | Students who so desire may write a 2-3 page review of the documentary Generation M: Misogyny in Media and Culture.  Your opening paragraph s… |
| `tag-4330562b` | `1.f` | 0.42 | Regular and punctual attendance of classes is required because class discussions | Regular and punctual attendance of classes is required because class discussions typically draw on materials and sources outside of the assi… |
| `tag-1ddaf9ef` | `12.c` | 0.42 | When it comes to family structure, family background and educational level are i | When it comes to family structure, family background and educational level are important considerations when in search of a partner (South K… |
| `tag-b3d293e5` | `16.a` | 0.44 | General instructions: This assignment requires you to apply the concept and theo | General instructions: This assignment requires you to apply the concept and theories we will study to your family of origin. In order to com… |
| `tag-a76f4b68` | `5.b` | 0.48 | Disability Services Stevenson University will make reasonable accommodations for | Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office… |
| `tag-909ab3d3` | `5.b` | 0.48 | Disability Services Stevenson University will make reasonable accommodations for | Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disabi… |
| `tag-0f724b19` | `5.b` | 0.48 | Disability Services Stevenson University will make reasonable accommodations for | Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office… |
| `tag-15635b1a` | `5.b` | 0.48 | Disability Services Stevenson University will make reasonable accommodations for | Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office… |

---

## Unmatched / context sections (NOT imported)

- `context` sections (178): framing prose. The wizard intentionally skips these — they don't land in any spec.
- `unknown` sections (6): matcher couldn't classify. Routed to the tag list above. Listed here for completeness.

### Top 10 context sections by word count

- (355 words, conf 0.85) (data table)
- (298 words, conf 0.82) During the first republic, after the establishment of South Korea, popular elections elected Syngman Rhee as the first p
- (268 words, conf 0.42) Contrary to traditional norms, according to research, the elderly is not properly taken care of in South Korea, and it i
- (258 words, conf 0.85) Human Services Delivery Systems Context: The demand for services and the funding of educational prog
- (246 words, conf 0.05) Despite South Korea being a relatively new nation, its economy has been able to grow exponentially. Since the 1950s, Sou
- (241 words, conf 0.42) South Korea is strong in many ways; however, the mental health field is not one of its strengths. In Korea, “there is no
- (241 words, conf 0.28) Aside from the challenges with the elderly population, the challenges when it comes to the lack of help for those suffer
- (211 words, conf 0.85) South Korea’s history officially begins after World War II, when Japanese occupation ends with Soviet troops occupying t
- (198 words, conf 0.28) It is typical of South Korean citizens to want to remain a purely Korean nation and due to this, it has only been recent
- (194 words, conf 0.28) Ever since 1987, South Korea has been a democratic community, and managed to create one of the most vibrant “democratic 

### Top 10 unknown sections by word count

- (156 words) During the third republic, Park Chung Hee (Major general of the military in South Korea during the second republic) ran 
  _rationale_: This section contains historical content about South Korean politics and governance (Park Chung Hee, the third republic, national elections, emergency declarations) with no connection to any CSHSE acc
- (150 words) During the second republic, It was the first and only time that South Korea utilized a cabinet system  instead of a pres
  _rationale_: This section contains historical narrative about South Korea's Second Republic (1960-1961) and has no connection to CSHSE accreditation standards, which address human services education program requir
- (133 words) During the fourth republic, Park developed a new constitution which gave him control over parliament (History of South K
  _rationale_: This section contains historical narrative about South Korean political events (Park's constitution, assassination, Gwangju uprising, 1987 elections) with no connection to human service education accr
- (110 words) Two extra-credit assignments are provided in this syllabus: the video review and the group discussion papers.  Students 
  _rationale_: This section describes extra-credit assignment options and grading policies for a course syllabus. It does not substantively address any current CSHSE standard specification; it is pedagogical course 
- (105 words) Weekly In-Class Quizzes (10% of your total grade)  In order to ensure that you are keeping up with the readings, underst
  _rationale_: This section is a syllabus fragment describing quiz assessment methodology and grading procedures. It does not address any CSHSE accreditation standard or specification; it is course-level pedagogical
- (63 words) This paper will be graded based on the appropriate use of the selected sociology concepts, appropriate title for the pap
  _rationale_: This section is a grading rubric/assignment instruction for a student paper on sociology concepts. It describes evaluation criteria (grammar, organization, use of sociological imagination) but does no

---

## Related
- [[import-wizard-ui-spec-2026-05-17]] — the UI spec these rules came from
- [[ai-import-stevenson-by-spec-2026-05-17]] — prior by-spec dump (no gap-fill)
- [[ai-import-stevenson-coverage-2026-05-17]] — prior first-pass coverage