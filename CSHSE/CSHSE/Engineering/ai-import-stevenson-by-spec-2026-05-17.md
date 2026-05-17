---
name: AI Import — Stevenson by-Spec Coverage 2026-05-17
description: For every CSHSE Baccalaureate Specification, the exact text that the AI import wizard would write into `Submission.narratives[std][spec]` (narrative vs supporting evidence) plus matrix and unmatched-content gaps.
type: review
tags: [ai-import, sprint-1, stevenson, coverage, audit]
audit_date: 2026-05-17
auditor: claude
last_reviewed: 2026-05-17
---

# AI Import — Stevenson by-Spec Coverage (2026-05-17)

This page answers: *for every Specification in the 99-spec 2025 Baccalaureate Handbook, what content from Stevenson's self-study would the AI import wizard write into `Submission.narratives[std][spec]`?*

Each spec shows two destinations: **narrative** (`narratives[std][spec].content`) and **supporting evidence** (`narratives[std][spec].supportingEvidenceText` OR a new `SupportingEvidence` row linked to the same `(std, spec)`).

## Coverage summary

| Category | Count | % of 99 |
|---|---|---|
| Specs with at least one narrative match | 82 | 83% |
| Specs with at least one supporting-evidence match | 39 | 39% |
| Specs with **any** matched content | 86 | 87% |
| **Spec gaps** (zero matches → user must triage manually) | 10 | 10% |
| Curriculum matrices identified | 9 | — |
| Sections flagged `context` (won't import) | 177 | — |
| Sections flagged `unknown` (user must triage) | 7 | — |

## Specs with NO matched content (gaps to triage)

These specs from the Handbook had **zero** sections classified to them. Either Stevenson's self-study doesn't address them, or the matcher missed substance hidden in tables/appendices and the user needs to manually tag those areas.

| Spec | Standard Title | Spec Prompt |
|---|---|---|
| `2.b` | Philosophical Base of Programs | Demonstrate alignment with the mission of the units in which the program is housed (e.g., department, college, universit… |
| `2.d` | Philosophical Base of Programs | Describe the multidisciplinary, interdisciplinary, or transdisciplinary approach to knowledge, theories, and skills incl… |
| `2.e` | Philosophical Base of Programs | Provide a matrix mapping the curriculum Standards (11-20) and Specifications to required courses. The information provid… |
| `3.a` | Community Assessment | If the program is less than five years old, provide documentation that supported the initial development of the human se… |
| `7.a` | Personnel Roles, Responsibilities, and Evaluation | Document that faculty have the ultimate responsibility for setting policies and determining the content, implementation,… |
| `7.b` | Personnel Roles, Responsibilities, and Evaluation | Essential program roles include administration, curriculum development and review, instruction, field supervision, progr… |
| `7.e` | Personnel Roles, Responsibilities, and Evaluation | Describe how faculty and staff are provided opportunities for relevant professional development. |
| `15.a` | Knowledge, Theory, Skills, and Values | Knowledge and skills to analyze and assess the needs of clients or client groups. |
| `20.c` | Knowledge, Theory, Skills, and Values | Awareness of intercultural fluency as outlined in Standard 19.d. |
| `21.i` | Field Experience | Demonstrate that field supervisors have a degree at least as high as the one awarded by the program. It is strongly reco… |

---

## Per-spec coverage detail

Grouped by Standard. Each spec shows the exact text destined for its narrative slot and supporting-evidence slot.

## Standard 1

### `1.a` 🟢 has narrative — Institutional Requirements and Primary

**Spec prompt:** _The program is part of a degree granting college or university that is regionally accredited._

**→ Imported as NARRATIVE** (`narratives[1][a].content`):

##### Match 1 — 🟡 **conf 0.82** &nbsp;words 246 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **d.Provide a brief history of the program.Table of ContentsResponse: The Family Studies Program was d**

_AI rationale:_ This narrative provides the program's historical development, founding, accreditation milestones, and organizational evolution—directly addressing Standard 1.a's requirement for a statement of the program's philosophy, goals, and objectives grounded in the program's context and history.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.a — Institutional Requirements and Primary

Prompt: The program is part of a degree granting college or university that is regionally accredited.

Response:
d. Provide a brief history of the program. Table of Contents Response: The Family Studies Program was developed by Dr. Gigi Franyo in 1999 and began accepting students in Fall 2000. Dr. Franyo was the program coordinator and only full-time faculty member until 2004. The name of the program was changed to Family and Community Services in Spring 2003. Beginning in Fall 2004, the program acquired one additional full-time faculty member, Dr. Tom Swisher, to teach courses and serve as the field placement coordinator. The program was awarded accreditation from CSHSE in October of 2004. It expanded to three full-time faculty members in 2005, when Ms. Lauri Weiner joined the faculty. The name of the program was changed to Human Services in 2007 and in 2009 the Human Services Program was reaccredited by CSHSE. In 2012, the Program became a Department when Dr. John Rosicky was hired as Department Chair. In the fall of 2014, Dr. Mayaugust Finkenberg joined the full-time faculty when Dr. Franyo began phased retirement. In 2018, the department and program name was changed to Counseling &amp; Human Services in order to be more easily recognizable and help with recruiting. In December of 2022, Tom Swisher retired from the department; this resulted in the “department” designation being changed to “program”. Department offices moved from the Manning Academic Center (MAC) on the Owings Mills North campus to the new PAZ library building in January of 2024; all CHS classes are still offered in MAC.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[1][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `1.b` 🟢 has narrative — Institutional Requirements and Primary

**Spec prompt:** _Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials)._

**→ Imported as NARRATIVE** (`narratives[1][b].content`):

##### Match 1 — 🟢 **conf 0.95** &nbsp;words 259 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses the specification language requiring evidence that development of competent human services professionals is the primary objective and basis for degree program title, design, goals, curriculum, and administration. The response cites program purpose, objectives, catalog, brochure, website, and syllabi as mandated evidence.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.b — Institutional Requirements and Primary

Prompt: Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials).

Response:
Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials).Response: The Counseling & Human Services Program is designed for students who want to provide human services for people in need. The major prepares students for careers in human services and also for graduate school.  The courses provide students with a comprehensive understanding of how individuals and families develop and function.  Students also acquire the skills necessary to provide services to individuals and families.  The Counseling & Human Services Program goals are designed to prepare students for productive and meaningful work in the human services field. Graduates are expected to “apply key concepts, methods and values in human services to professional situations,” as stated in the program purpose and objectives. The program objectives are focused on preparing our majors for productive and meaningful experiences in the human services field. Graduates are expected to apply meaningful connections between classroom learning and experience in the field, demonstrate a professional attitude with sensitivity to diversity, display appropriate interpersonal skills and professional behavior, and exhibit their own continuing self-development (See Program Goals).The program’s focus on developing competent human service professionals is reflected in all departmental materials, including the Stevenson Catalog (See the Counseling & Human Services Program under Fields of Study), departmental brochure, and the department website. See also course descriptions and syllabi for all CHS courses.

```

##### Match 2 — 🟡 **conf 0.78** &nbsp;words 77 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **A. Institutional Requirements and Primary Program Objective**

_AI rationale:_ The section articulates the program's primary objective to prepare human services professionals for direct and indirect service delivery, directly addressing 1.b's requirement to evidence that competent human services professional development is the primary objective and basis for program design, goals, and curriculum.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.b — Institutional Requirements and Primary

Prompt: Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials).

Response:
Context: There is strong national commitment to the view that human services programs should develop professionals who provide direct or indirect services. These programs prepare human services professionals for a variety of functions related to the care and treatment of individuals, families, groups, and communities.

Standard 1: The primary program objective shall be to prepare human services professionals to serve individuals, families, groups, communities and/or other supported human services organization functions.Table of Contents

Specifications for Standard 1

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 79 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The Counseling & Human Services program is designed to give students a comprehensive understanding of how individuals an**

_AI rationale:_ This section articulates the program's design philosophy and core objectives—that students gain comprehensive understanding of human development and functioning plus service-delivery skills through coursework and field work. This directly demonstrates how the program's design, goals, and curriculum are based on developing competent human services professionals as the primary objective, matching Standard 1.b language.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.b — Institutional Requirements and Primary

Prompt: Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials).

Response:
The Counseling & Human Services program is designed to give students a comprehensive understanding of how individuals and families develop and function.  Students also acquire the skills necessary to provide services to individuals and families.  Therefore, the coursework, in addition to courses that fulfill the University’s requirements, is composed of (1) courses that emphasize the development and functioning of individuals and families, (2) courses that focus on the skills required to help individuals and families, and (3) field work.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 93 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The curriculum is designed to give students a comprehensive understanding of how individuals and families develop and fu**

_AI rationale:_ This section describes the overall curriculum design and composition (development/functioning courses, skills courses, and field work) as the foundational structure supporting the program's primary objective of developing competent human services professionals, directly addressing 1.b's requirement to demonstrate the program design basis.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.b — Institutional Requirements and Primary

Prompt: Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials).

Response:
The curriculum is designed to give students a comprehensive understanding of how individuals and families develop and function.  Students also acquire the skills necessary to provide services to individuals and families.  Therefore, the coursework, in addition to courses that fulfill the University’s requirements, is composed of (1) courses that emphasize the development and functioning of individuals and families, (2) courses that focus on the skills required to help individuals and families, and (3) field work.  A table that outlines the courses in these areas of concentration can be found on the following page.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[1][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `1.c` 🟢 has narrative — Institutional Requirements and Primary

**Spec prompt:** _Articulate how students are informed of the curricular and program expectations and requirements prior to admission._

**→ Imported as NARRATIVE** (`narratives[1][c].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 311 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses Standard 1.c by describing multiple methods through which prospective and current students are informed of curricular and program expectations and requirements prior to admission (Open Houses, website, faculty meetings, student handbook, orientation, etc.).

**Exact text that will be written to the narrative slot:**

```text
Standard 1.c — Institutional Requirements and Primary

Prompt: Articulate how students are informed of the curricular and program expectations and requirements prior to admission.

Response:
Articulate how students are informed of the curricular and program expectations and requirements prior to admission.Table of ContentsResponse: Prospective students and their parents or guardians may attend one of five “Open Houses” offered by Stevenson University. During each Open House, faculty and current students from the Counseling & Human Services Department provide a classroom session in which the program structure, goals and expectations are reviewed, with opportunities for questions and discussion. In addition, the Department Chair meets every year with the university recruiters in the Admissions Office to provide them with updated information about the Counseling & Human Services Program so they can speak knowledgably about it to potential students.  Current students who are not Counseling & Human Service majors, as well as prospective students, can access information about the program in numerous ways, including the program website, individual interviews with faculty, information displayed near the program office, and at numerous activities and functions offered throughout the year by the Human Services Club. Many non-majors also take CHS 101 Family Studies or CHS 105 Human Services and Social Policy to meet the social science requirement and are thereby introduced to the field of human services. All students who enter the major, either by transferring from another major or another school, or by starting at Stevenson, are informed of all aspects of the curricular and program requirements and expectations in the following ways: Transfer students meet individually with the Department Chair, who explains all program requirements, provides a student handbook, and creates an individualized plan of study. New college students participate in a group orientation before they enter the program where they receive a student handbook and get help with establishing a plan of study and registering for classes. They also participate in the 1-credit course FYS 100 First Year Seminar, which has a designated section for Counseling & Human Services majors.

```

##### Match 2 — 🔵 **conf 0.52** &nbsp;words 54 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students are expected to participate in all classes and to arrive promptly. Whenever a student is absent, it is the stud**

_AI rationale:_ This section describes attendance and participation expectations that students must be informed of prior to or upon admission. While attendance policies could relate to student retention procedures (5.c), the content most directly addresses how students are informed of program expectations and requirements (1.c).

**Exact text that will be written to the narrative slot:**

```text
Standard 1.c — Institutional Requirements and Primary

Prompt: Articulate how students are informed of the curricular and program expectations and requirements prior to admission.

Response:
Students are expected to participate in all classes and to arrive promptly. Whenever a student is absent, it is the student’s responsibility to obtain lecture notes and handouts for that class session. While a student is not required to attend all classes, a student cannot actively participate unless s/he is present for most classes

```

##### Match 3 — 🔵 **conf 0.42** &nbsp;words 57 &nbsp; `review_low_confidence`

_Source heading from doc:_ **If there is an unscheduled university closing on the day that an assignment is due, the assignment deadline will remain **

_AI rationale:_ This section describes policies that inform students of program expectations and requirements (assignment deadlines, quiz procedures), which aligns best with 1.c on communicating curricular and program expectations. It could also relate to program support resources (9.d) or general program description (1.f), but the focus on communicating rules to students before/during enrollment makes 1.c the primary fit.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.c — Institutional Requirements and Primary

Prompt: Articulate how students are informed of the curricular and program expectations and requirements prior to admission.

Response:
If there is an unscheduled university closing on the day that an assignment is due, the assignment deadline will remain unchanged if it was to be submitted through Blackboard (assuming Blackboard is operable).  If a quiz is administered in class on the day of an unscheduled closing, the quiz will be postponed until the next class meeting.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[1][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.52** &nbsp;words 77 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Classroom Policies: Regular class attendance and participation are necessary to pass and/or do well in this and indeed a**

_AI rationale:_ This syllabus excerpt documents classroom policies and student expectations (attendance, participation, Blackboard responsibilities) that inform students of curricular and program expectations prior to or at the start of coursework, aligning best with Standard 1.c. It is tangentially relevant to student conduct/fitness policies (5.d) but is fundamentally instructional guidance rather than a formal fitness-for-profession assessment policy.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.c — Institutional Requirements and Primary

Classroom Policies: Regular class attendance and participation are necessary to pass and/or do well in this and indeed all courses.  Students are encouraged to be punctual and regular to class as class discussions are likely to draw on materials not covered by the assigned readings. If class is canceled due to the weather or other unforeseen reason, the lesson will be posted on Blackboard.  It is the student’s responsibility to check Blackboard and complete any posted assignments!

```

##### Evidence 2 — 🔵 **conf 0.42** &nbsp;words 88 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Attendance is required and expected. Students are responsible for the material presented in class which includes lecture**

_AI rationale:_ This section describes course attendance and participation policies that inform students of program expectations and requirements. While the embedding similarity is modest across all candidates, Standard 1.c best captures the intent of articulating curricular and program expectations to students, even though this is a syllabus policy statement rather than a direct narrative response.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.c — Institutional Requirements and Primary

Attendance is required and expected. Students are responsible for the material presented in class which includes lectures and guest speakers- material that will not be found in your readings. If a student must miss class for an unavoidable reason, it is expected that the student will email the instructor to notify of the absence and contact a classmate to get class notes. Best practice is to ask a classmate to take notes prior to the missed class. Students should email the instructor with specific questions after contacting classmates.

```

---

### `1.d` 🟠 evidence-only — Institutional Requirements and Primary

**Spec prompt:** _Provide a brief history of the program._

**→ Imported as NARRATIVE** (`narratives[1][d].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[1][d].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.42** &nbsp;words 77 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Submission of Assignments or Projects: All assignments or presentations are due at the beginning of the class period on **

_AI rationale:_ This section describes course/assignment submission policies and grade penalties, which relates to student program policies and requirements communication. It most closely aligns with Standard 1.d (program policies and procedures), as it outlines expectations students must follow. The embedding similarities are all low, indicating this is a supplementary policy document rather than a direct response to any primary specification.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.d — Institutional Requirements and Primary

Submission of Assignments or Projects: All assignments or presentations are due at the beginning of the class period on the day they are due. Aside from the first journal assignment, all other journals are due in hard-copy in class. Assignments are not to be left in the instructor’s mailbox or slid under the office door. Grades will be lowered 10% for the assignment is lateness. Assignments more than two weeks late will receive a 50% grade reduction.

```

---

### `1.e` 🟢 has narrative — Institutional Requirements and Primary

**Spec prompt:** _Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year._

**→ Imported as NARRATIVE** (`narratives[1][e].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 136 &nbsp; `auto_accept`

_Source heading from doc:_ **e.Describe the student population including the number, gender, and diversity of students, as well a**

_AI rationale:_ The section directly addresses Standard 1.e, providing enrollment numbers, gender distribution, age, ethnic/racial diversity, full-time/part-time status, and graduation data—matching the specification language precisely.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.e — Institutional Requirements and Primary

Prompt: Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year.

Response:
e. Describe the student population including the number, gender, and diversity of students, as well as the numbers of full time, part time, and students graduating each year. Response: Fall 2023 enrollment figures show 56 Counseling &amp; Human Services majors. The vast majority are full-time students (96%). Majors are predominantly female (87%) with an average age of 22. They are from a wide variety of backgrounds, including the city of Baltimore and surrounding suburbs and rural areas. Most students are from the Mid-Atlantic region. The major is ethnically diverse (49% white; 45% black; 4% Hispanic; 2% Asian/other). The number of graduates has been fairly consistent with 24 in the 2018/2019 academic year and 20 in the 2022/2023 academic year. See attached table of enrollment and graduation trends and demographic information and pictures of recent graduating classes.

```

##### Match 2 — 🟢 **conf 0.89** &nbsp;words 84 &nbsp; `auto_accept`

_Source heading from doc:_ **Twenty four students graduated in the 2018-2019 academic year. This is slightly lower than the previous year, but repres**

_AI rationale:_ The section directly reports the number of students graduating in 2018-2019 and enrollment trends, which directly matches Standard 1.e's requirement to describe student population including numbers graduating each year. While graduation rates are also relevant to program evaluation (4.c), the primary focus is on institutional demographic reporting.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.e — Institutional Requirements and Primary

Prompt: Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year.

Response:
Twenty four students graduated in the 2018-2019 academic year. This is slightly lower than the previous year, but represents a stabilization in the decline of graduates, which is similar to the pattern for the number of majors. (see report below). The official number of majors for the Fall of 2019 will be reported on the census date of October 15.  A new cohort of certificate students at Sheppard Pratt will be starting this fall, but the exact number is not know at this time.

```

##### Match 3 — 🔵 **conf 0.82** &nbsp;words 68 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spr**

_AI rationale:_ The section reports current enrollment numbers (78 majors, 20 minors) matching Standard 1.e's requirement to 'describe the student population including the number' of students. The mention of recruitment and marketing efforts is secondary context.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.e — Institutional Requirements and Primary

Prompt: Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year.

Response:
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spring we have a total of 78 majors and 20 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Counseling & Human Services program through marketing and publicity efforts. The name change and move to the OM campus should be helpful in that regard.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[1][e].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.78** &nbsp;words 114 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ The data table directly provides enrollment numbers, majors, graduation counts, and admissions figures that satisfy Standard 1.e's requirement to describe student population including numbers, full-time/part-time status, and graduates per year. While 4.c also requests enrollment trends and graduation rates as performance indicators, 1.e is the primary institutional demographic specification.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.e — Institutional Requirements and Primary

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

---

### `1.f` 🟢 has narrative — Institutional Requirements and Primary

**Spec prompt:** _Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices)._

**→ Imported as NARRATIVE** (`narratives[1][f].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 261 &nbsp; `auto_accept`

_Source heading from doc:_ **f.Provide a complete program description, courses required, time to completion, and other program de**

_AI rationale:_ The section directly provides complete program description, required courses, time to completion (8 semesters), credit requirements (120 credits), and graduation rates—exactly matching the language of Standard 1.f specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.f — Institutional Requirements and Primary

Prompt: Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices).

Response:
f. Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices). Table of Contents Response: The Counseling &amp; Human Services bachelor’s degree is 120 credits and is typically completed in eight semesters. A complete program description and curriculum display are in the catalog and Appendix . Required courses in the Counseling &amp; Human Services include the following: CHS 101 Family Studies CHS 105 Human Services and Social Policy CHS 220 Diversity and Cultural Competence CHS 224 Research Methods and Writing CHS 315/515 Group Counseling CHS 340/540 Administration of Human Services CHS 360 Counseling Strategies for Individuals CHS 380 Internship in Counseling &amp; Human Services CHS 430 Family Dynamics and Interventions CHS 440 Practicum in Counseling &amp; Human Services CHS 441 Seminar in Counseling &amp; Human Services In addition, student must complete the following secondary requirements: SOC 101 Introduction to Sociology PSY 101 Introduction to Psychology PSY 108 Human Growth &amp; Development Two CHS Electives The University requires students to meet the general education requirements described in the Introductory Section ( A.3.b ), which includes courses in writing/literature, communication, fine arts, mathematics (statistics), science, and humanities. The program is designed to be completed in 8 semesters (4 years). More than half of students complete in 4 years (57%) with 5- and 6-year graduation rates of 84% and 895 respectively. A list of CHS elective courses and a schedule of course offerings for Human Services Electives is attached, along with a listing of courses commonly taken to meet the general education requirements .

```

##### Match 2 — 🟡 **conf 0.82** &nbsp;words 2234 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **A. ­­­Required Introductory Material: General Introduction to the Program1.Specify the degree(s) off**

_AI rationale:_ The section provides a complete program description including institutional context, organizational structure, degree levels offered, campus locations, and program characteristics (field experience requirement of 450+ hours), directly corresponding to Standard 1.f's requirement for complete program description and details. It also supports 1.b by articulating the program's primary emphasis on field experience to develop effective human service professionals.

**Exact text that will be written to the narrative slot:**

```text
Standard 1.f — Institutional Requirements and Primary

Prompt: Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices).

Response:
A. ­­­Required Introductory Material: General Introduction to the Program 1. Specify the degree(s) offered for which accreditation is being sought. Bachelor’s Degree 2. Describe the institution. Table of Contents Describe the organizational structure, whether state or private, age of institution, brief history, and so on. Response: Stevenson University is a private, independent, coeducational, liberal arts university with approximately 4,000 undergraduate and graduate students. The university was formerly known as Villa Julie College, which was founded in 1947 as a two-year preparatory school for women. Villa Julie became co-educational in 1972 and a four-year college in 1984. In 2004 the first residential facilities were opened on the Owings Mills campus and in 2008 the college changed its name to Stevenson University. Stevenson is located in Baltimore County, Maryland. Stevenson was initially established on the Greenspring campus but purchased the Owings Mills campus in 2002, and all recent development has happened in that area. All human services courses are offered on the Owings Mills campus, where the department moved in 2018. The Owings Mills campus houses all residential facilities and most athletic and student activity facilities. The Owings Mills North area was created by the purchase and renovation of the former Shire Pharmaceuticals site and houses the graphic design and art facilities, as well as the Manning Academic Center. A new library was constructed on the North Campus and opened in 2024. Offices for the Counseling &amp; Human Services program are in this building. CHS classes are taught in the MAC. A new theatre is also under construction on the North Campus. The Greenspring campus no longer has any undergraduate academic programs, although the PsyD program and administrative offices are still located there. Describe the institutional context of the Program. For example, include organization charts and structure, goals, and objectives. What levels of degree are offered by the institution? For large programs with multiple sites, organizational charts are extremely helpful to the readers. Table of Contents Response: The academic structure of the University includes seven schools. Stevenson University Online administers all graduate programs (master’s level; M.S. degree) and online instruction targeted to adult learners. Undergraduate programs (bachelor’s level; B.S and B.A. degrees) are organized under the Beverly K. Fine School of the Sciences, Brown School of Business and Leadership, Sandra R. Berman School of Nursing and Health Professions, School of Design, School of Education, and School of Humanities and Social Sciences. The Counseling &amp; Human Services Department is in the School of Humanities and Social Sciences (HaSS). There are 7 departments in HaSS: Psychology, Legal Studies, Criminal Justice, Interdisciplinary Studies, History and Humanities (the department includes philosophy and religion courses), English Language and Literature, and Counseling &amp; Human Services. Organizational charts for the University and for Academic Affairs are located in the Appendix. The University embraces the motto, “Imagine your future. Design your career” and the four core values of community, learning, integrity and excellence. See the University Mission, Vision &amp; Values . 3. Describe the Program (Do not duplicate information requested in the Specifications for Standard 1.) Table of Contents Briefly describe the strengths of the Program and any attributes that make the Program unique. Response: The Counseling &amp; Human Services Program at Stevenson University is characterized by an emphasis on field experience to develop effective human service professionals. All Counseling &amp; Human Services majors spend a minimum of 450 hours in field experiences. Students are placed in agencies related to their specific interests, such as mental health facilities, hospitals, addiction treatment centers, schools and centers for children with developmental and behavioral problems, facilities for the elderly, government agencies, and a variety of other sites. These valuable experiences give students the opportunity to apply the knowledge they have gained in the program and to develop their skills as confident and competent human services professionals. Additional strengths of the program are: The knowledgeable and dedicated faculty , both the three full-time instructors and the numerous adjunct instructors, who all bring significant expertise to the classroom and work collaboratively to strengthen the program. A diverse student population who are from a wide variety of backgrounds, but are all committed to helping others. (See pictures of recent graduating classes .) A supportive and engaged Advisory Board who understands both our students’ needs and the demands of the human services profession. They are effective advocates for our program, our students, and Stevenson University. A comprehensive and meaningful evaluation process that collects and analyzes information on student performance, both in the classroom and in the field, and uses that information to examine program processes and curriculum. Describe institutional course requirements for all students and explain how they prepare students for study in the human services program. For example, describe general education or liberal arts requirements of the institution. Response: The University requires students to take a general education core that includes two courses in writing/literature (plus two additional writing intensive (WI) courses, one at the 200 level and one at the 300 level; this requirement is fulfilled by required courses in the program), one communication course (usually public speaking), three courses in mathematics and science (statistics is required and biology is recommended), one course in fine arts, and four courses in the humanities (history, literature, religion, foreign language and philosophy). The general education core courses prepare students to communicate effectively, think deeply and critically about problems, and understand the complex social and cultural context of issues. A solid base in the liberal arts allows students to better understand the problems and perspectives of their clients and to be more effective helpers. See University learning goals . Include any other background information that may be pertinent such as action plans for identified problem areas, changing enrollment patterns, marketing strategies, or institutional or curricular restructuring. Response: Enrollment in the Counseling &amp; Human Services Program declined over the past ten years, but over the past 5 years has been relatively stable with about 50 majors. The program is well-established and continues to fulfill an important role in the University. Marketing strategies are centralized in the admissions area of the university, but a departmental Instagram page has been established and a centrally located bulletin board for the department highlights activities and graduates. There has been significant expansion university-wide with the addition of athletic fields on the East Campus and a new academic hub library where CHS offices are located. The CHS Program Coordinator, John Rosicky, developed a network of trails in the wooded areas between campuses. Programmatically, we have reduced the number of required credits in the CHS program (see program changes in 4c below) to further improve the flexibility of the program and make it more enticing as a transfer destination. The final practicum is still 9 credit hours, but the number of hours has been reduced to 360 hours to alleviate student stress. With the 90 hour internship we still exceed the required number of experience hours for the program. 4. Interim Report and Review and Reaccreditations only Table of Contents Include a copy of the letter from the Vice President of Accreditation (VPA) sent at the time of the prior accreditation notifying the Program of the disposition of the application for accreditation. Response: The Human Services Program was initially granted accreditation by CSHSE in October of 2004. It was granted reaccreditation based on a self-study in October of 2009, with a full site visit in 2014, and again based on a self-study in 2019. See reaccreditation letter in the Appendix. Describe how each condition in the VPA letter has been addressed. Response: The four requirements for the current reaccreditation were all addressed. More details are given under the appropriate Specifications, but briefly the requirements were: Standard 11.c Historical and current legislation affecting service delivery Include more emphasis on social policy, both present issues as well as how legislation has shaped existing services (or lack of). The title of the introductory course for the program CHS 201 was changed from “Introduction to Human Services” to “Human Services and Social Policy” in 2018 along with the addition of additional emphasis on social policy issues ( see current syllabus ) Standard 12.g Processes to effect social change through advocacy work at all levels of society including community development, community and grass-roots organizing, and local and global activism Include advocacy and social change for marginalized populations. Such advocacy can occur in the context of a human service agency but also by assisting and empowering individuals and community groups/organizations/churches to effectively advocate for resources and services that address their needs and concerns. In addition to the changes to CHS 201 mentioned about, an assignment was added to that course on conducting an assessment of community needs and proposing steps to address those needs, including advocacy and community organizing (not just doing “for”). This introduction is more thoroughly expanded in CHS 224 Research Methods and Writing, in which students write a grant proposal to address community needs with a fully developed rationale for the proposed strategy. Standard 14.g Knowledge, theory, and skills are included, analyzed, and applied in the curriculum in regard to: performing and elementary community needs assessment: Include a greater emphasis in the program on community development in contrast to the strong emphasis on service delivery within human services agencies. As mentioned above, a major assignment in the introductory course was added requiring students to visit a community/agency, assess needs, and report on ways to strength that community. Standard 14.h Knowledge, theory, and skills are included, analyzed, and applied in the curriculum in regard to conducting a basic program evaluation: Include more direct instruction on designing and conducting a program evaluation and on understanding research, in order to effectively identify, understand, and utilize evidence based practices. This issue is covered thoroughly in CHS 340 Administration of Human Services and in CHS 224 Research Methods and Writing. Conducting a program evaluation is part of strategic program planning and evaluation, as well as evidence-based management, both of which are units in the administration course. In addition, the narratives of program proposals developed in the research methods course must contain detailed plans for program evaluation. Describe any major program changes since the prior accreditation. Response: The program is fundamentally the same and the purpose, mission and objectives have not changed. The curriculum has been modified slightly as described below. The Sheppard Pratt certificate (a 5-course sequence of CHS courses offered to SP employees at their campus) has been on hold since the fourth cohort graduated in December of 2021. Detailed program analyses were conducted at faculty retreats in 2021 and 2022. One of our fulltime faculty members, Tom Swisher, retired in December of 2022 and the decrease from 4 to 3 faculty members resulted in the “department” becoming a “program”. Describe any major curriculum changes since the prior accreditation. Response: Summary of Changes to the Counseling &amp; Human Services Program: The course number of Human Services and Social Policy (introductory course in the first semester of the program) was changed from CHS 201 to CHS 105 in 2020. Social Justice was added as a topic for CHS 250 Topics in Human Services. (2021) The following changes were all implemented in 2023 following a departmental retreat in December of 2022. CHS 270 Psychopharmacology and Addictions will no longer be required of all students, but is still required in the Addictions and Mental Health Track and is a recommended elective course. CHS 217 Professional Development in Counseling &amp; Human Services will be replaced by CA 205 Foundations of Career offered by the Career Services Office Two CHS electives are still required, but the “Focused Elective” category has been eliminated, reducing the total number of required credits by 9 credits. (We used to require 5 Focused Electives, including at least 2 CHS courses). The number of hours for the CHS 440 Practicum in Human Services has been reduced from 410 to 360. The course is still 9 credit hours and fully meets accreditation requirements. Changes result in a decrease in total program requirements from 72 credits to 58 credits. Student still need a total of 120 credits to earn a B.S. The remaining requirements are general education courses and electives. 5. If the Program is delivered at multiple sites: Table of Contents For each site: Describe the physical location and any unique characteristics. Identify the faculty, directors, and staff. Describe the student population. Response: Although Stevenson’s physical facilities are split across two campuses, they are integrated into one University, so the Counseling &amp; Human Services Program is not delivered at multiple sites. Departmental offices and all CHS courses are located on the Owings Mills campus. Furnish evidence of formal policies and procedures that assure continuity and quality control of Program and Curriculum across all sites. Response: Not applicable. 6. Hybrid or Online Course Delivery: If more than 50% of required human service courses are offered in a hybrid/online format, the Program must: Table of Contents Provide a narrative and documentation which assures compliance with all Standards and Specifications Response: Not applicable. The only course currently offered in an online format is CHS 101 Family Studies. Document how they assure that students enrolled in the program or course(s) are who they say they are Response: Not applicable. Demonstrate that common learning outcomes/objectives exist for both face- to- face and hybrid/online delivery Response: Not applicable. Provide documentation that the program provides adequate technical training and support for students and faculty Response: Not applicable.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[1][f].supportingEvidenceText`):

##### Evidence 1 — 🟢 **conf 0.88** &nbsp;words 424 &nbsp; `auto_accept`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This articulation table documents course requirements, credits, and program pathways, directly supporting Standard 1.f's requirement to provide 'a complete program description, courses required, time to completion, and other program details.' It functions as program documentation typically found in institutional catalogs.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.f — Institutional Requirements and Primary

Articulated Courses- CCBC
Credits
Articulated Courses-SU
Credits
BIOL 107 Human Biology
Satisfies CCBC Biology and Physical Sciences Gen Ed Requirement
4
BIO 104 The Human Body and Contemporary Health Issues
4
CMNS 101 Fundamentals Communication
3
CM 101 Foundations of Communication
3
ENGl 101 College Composition I
3
ENG 151 English Composition
3
ENGl 102 College Composition II
OR
ENGL 239 Business Communication
Satisfies CCBC ENGL 102 recommendation as CCBC HUMS Program Requirement
3
ENG 152 Writing About Literature
OR
ENG Writing Elective (200 or above)
3
SOCL 121 Marriage and the Family
Satisfies CCBC HUMS Elective
3
CHS 101 Invitation to Family Studies
3
HUMS 101 Introduction to Human Services
3
CHS 201 Introduction to Human Services
3
PSYC 105 Human Relations in a Culturally Diverse Society
Satisfies CCBC Hums Elective
3
CHS 220 Diversity and Cultural Competence in Human Services
3
HUMS 139 Interview/Communication Techniques
3
Focused CHS Elective
3
HUMS 211 Case Management in Human Services
3
Focused CHS Elective
3
HUMS 274 Internship: Human Services
3
CHS 299
Satisfies CHS 380 Internship Requirement with the completion of a professional portfolio and advisement with a SU field experience coordinator to discuss final semester practicum opportunities based on HUMS 274 CCBC Internship.
3
HUMS 122 Aging in America
3
Focused CHS Elective
3
HUMS 220 Crisis Intervention
OR
HUMS 260 Behavior Management and Crisis Intervention in Youth
3
Focused CHS Elective
3
CSIT 101 Introduction to Computers
3
IS 134
MS Windows and Office Applications
(if CSIT 101 at CCBC) Not SU requirement Lower Level Electives (LLE)
3
MATH 153 Introduction to Statistical Methods
4
MATH 210  Statistics and Probability
Satisfies SU HUMS program requirement of MATH 140
4
PSYC 101 Introduction to Psychology
3
PSY 101 Introduction to Psychology
3
PSYC 103/EDTR Principles of Human Growth and Development
OR
HUMS 160 Life Stages in Child and Youth Care
3
PSY 108 Human Growth and Development
OR
PSY 206 Child Development
Satisfies Program Requirement for Children track or CHS Focused elective.
3
PSYC 201 Abnormal Psychology
3
PSY 215 Psychopathology
3
SOCL 101 Introduction to Sociology
Satisfies CCBC HUMS Program Requirement of SOCL 102 Social Problems
3
SOC 101 Introduction to Sociology
3
HUMS 205 Techniques of Group Counseling
3
CHS 215
Satisfies CHS 315 Group Process and Practice once student enters the SU HUMS program.
3
HUMS 106 Introduction to the Field of Child and Youth Care
3
CHS 275 Focused CHS Elective
Required for Children Track at SU
3
Total CCBC Credits Taken with AAS: 62
Total Credits Transferred: 62-70*

```

##### Evidence 2 — 🟢 **conf 0.88** &nbsp;words 90 &nbsp; `auto_accept`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This is a course listing table showing articulated courses and required curricula across institutions (AACC and SU), which directly supports the specification requiring a complete program description with courses required and other program details. It functions as a supporting artifact to the narrative program description.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.f — Institutional Requirements and Primary

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

##### Evidence 3 — 🔵 **conf 0.72** &nbsp;words 72 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Course Description:  Assists first-year students identify and use specific strategies for academic, personal, and social**

_AI rationale:_ This course description belongs in the program description requirement (1.f), which calls for complete program details including courses required and curricular components. The First-Year Seminar is a required foundational course that introduces students to program expectations, career development, and university regulations.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.f — Institutional Requirements and Primary

Course Description:  Assists first-year students identify and use specific strategies for academic, personal, and social success in college. The First-Year Seminar also serves as a tool to introduce students to the Career Architecture process that will guide them through their time at Stevenson University.  Additional topics discussed in first-year seminar include, but are not limited to, University regulations and procedures, clarifying values and decision-making processes, and exploring the principles of career development.

```

##### Evidence 4 — 🔵 **conf 0.42** &nbsp;words 69 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Regular and punctual attendance of classes is required because class discussions typically draw on materials and sources**

_AI rationale:_ This excerpt is syllabus language describing course attendance policy and participation expectations. It best fits Standard 1.f as part of program/course details and requirements documentation, though the similarity scores are low because this is granular course-policy content rather than program-level specification.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 1.f — Institutional Requirements and Primary

Regular and punctual attendance of classes is required because class discussions typically draw on materials and sources outside of the assigned readings.  Class discussions offer an invaluable opportunity for students to be active participants in the learning process.  In fact, course-points are allotted to class participation and you cannot earn these points if you don’t attend classes.  Overall, you cannot pass this class if you do not attend classes.

```

---

## Standard 2

### `2.a` 🟢 has narrative — Philosophical Base of Programs

**Spec prompt:** _Include a mission statement for the program._

**→ Imported as NARRATIVE** (`narratives[2][a].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 623 &nbsp; `auto_accept`

_Source heading from doc:_ **Specifications for Standard 2 Provide a succinct philosophical statement that becomes the conceptual**

_AI rationale:_ The section directly provides the program's conceptual framework (ASK model), mission statement, and demonstrates alignment with institutional mission—all core requirements of Standard 2.a. The alignment content also supports institutional requirements under Standard 1.b but is secondary to the primary philosophical and mission framing.

**Exact text that will be written to the narrative slot:**

```text
Standard 2.a — Philosophical Base of Programs

Prompt: Include a mission statement for the program.

Response:
Specifications for Standard 2 Provide a succinct philosophical statement that becomes the conceptual framework for the curriculum. Table of Contents Response: The Counseling &amp; Human Services Department follows the ASK conceptual model as described by Schram and Mandell in An Introduction to Human Services (2000). This model emphasizes the importance of the following three components to becoming an effective human services professional: Attitudes , including self-awareness and such personal attributes as empathy, warmth and genuineness; Skills , including case management, ethical decision-making, counseling strategies, and group leadership; and Knowledge of topics such as human development, psychopathology, group and family dynamics, diversity of lifestyles, legal issues that affect helping, the impact of society and culture on behavior, and the evaluation of research. Include a mission statement for the program. Table of Contents Response : The mission of the Counseling &amp; Human Services Program is to provide students with an educational foundation that will prepare them for meaningful and effective careers within the human services field and successful continuation of their education. Purpose The Counseling &amp; Human Services Department prepares students to become effective professionals in the helping disciplines. The program focuses on skill development, problem solving, and the application of research and best practice principles. Students learn to help others and to prepare thoughtfully and systematically for their careers. To meet these commitments, the Counseling &amp; Human Services Department offers its students a broad curriculum, learning experiences and professional activities beyond the classroom, and high levels of student-faculty interaction and collaboration. Demonstrate alignment with the mission of the units in which the program is housed (e.g., department, college, university, etc.). Table of Contents Response: The Counseling &amp; Human Services Department is housed within the School of Humanities and Social Sciences (HaSS), along with the following other programs: Psychology, Criminal Justice, Interdisciplinary Studies, English Language and Literature, History, and Legal Studies. According to the HaSS web page , the School offers students “a wide range of possibilities, experiences, and opportunities while maintaining SU’s commitment to small classes, personal attention, and career preparation. Our programs encourage students to learn outside the confines of their chosen fields of study as well as outside the classroom.” Students in the School “learn not just how to do but also why [they] do.” The Mission of Stevenson University is as follows : The University is an innovative, coeducational, independent university offering undergraduate and graduate students a career-focused education marked by individualized attention, civility, and respect for difference. The university blends the liberal arts with career exploration and planning, complementing a traditional education with applied learning beyond the classroom. The university meets students where they are and supports and challenges them to become reflective and accomplished individuals committed to a lifetime of learning and contribution. Students graduate with the competence and confidence needed to address creatively the opportunities and problems facing their communities, the nation, and the world. The Counseling &amp; Human Services Program at Stevenson utilizes an approach that is career-focused by offering two distinct field experiences. Individualized attention is emphasized through advising (students are required to meet with their advisors every semester.), faculty attention to individual needs (discussed at program faculty meetings), and in the field placement process (the Field Placement Coordinator meets individually with all prospective interns and practicum students.). Civility and respect for differences is underscored throughout the Program through course work. Behavioral guidelines of civility and professionalism are taught to and assessed for all majors before and during field placements. Special needs accommodations are available to our majors. Career exploration suited to the unique needs and interests of our students is an integral part of CHS 380 (Internship in Counseling &amp; Human Services), CHS 441 (Seminar in Counseling &amp; Human Services), and the field placement process.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[2][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `2.b` 🔴 no match — Philosophical Base of Programs

**Spec prompt:** _Demonstrate alignment with the mission of the units in which the program is housed (e.g., department, college, university, etc.)_

**→ Imported as NARRATIVE** (`narratives[2][b].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[2][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `2.c` 🟢 has narrative — Philosophical Base of Programs

**Spec prompt:** _Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.)._

**→ Imported as NARRATIVE** (`narratives[2][c].content`):

##### Match 1 — 🟢 **conf 0.89** &nbsp;words 187 &nbsp; `auto_accept`

_Source heading from doc:_ **Provide a brief description of the major knowledge base and theories from which the curriculum draws**

_AI rationale:_ The section directly addresses the major knowledge base and theories (biopsychosocial, theoretical orientations, eclectic approach) matching Standard 2.c language. The multidisciplinary approach content also responds to 2.d but is secondary to the primary knowledge/theory focus.

**Exact text that will be written to the narrative slot:**

```text
Standard 2.c — Philosophical Base of Programs

Prompt: Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.).

Response:
Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.). Table of Contents Response: The Counseling &amp; Human Services program emphasizes the interdisciplinary, biopsychosocial approach to helping. Throughout the program, students are introduced to various theoretical orientations, such as psychoanalysis, behavioral and cognitive-behavioral approaches to treatment, and client-centered therapies, but the emphasis is on an eclectic orientation that stresses the importance of flexibility to adapt helping responses to individual needs and circumstances. Describe the multidisciplinary, interdisciplinary, or transdisciplinary approach to knowledge, theories, and skills included in the curriculum. Table of Contents Response: The Counseling &amp; Human Services program utilizes a multidisciplinary approach to knowledge, theories and skills that includes liberal arts courses, human services skills courses, and field experiences. The general education core curriculum for the University includes an emphasis on writing, literature, communication, mathematics and scientific reasoning, computer and information literacy, and the arts and humanities. The Counseling &amp; Human Services major incorporates courses in psychology, sociology, psychopharmacology, research methods and statistics. (See program curriculum )

```

##### Match 2 — 🔵 **conf 0.68** &nbsp;words 131 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Major Family Therapy ApproachesObject Relations. (Framo and Scharff).Experiential. (Satir and Whitaker).Transgenerationa**

_AI rationale:_ This section enumerates major family therapy approaches and their theoretical foundations (Object Relations, Experiential, Transgenerational, Structural, Strategic, Cognitive-Behavioral, Social Constructionist, Narrative), directly describing the major knowledge base and theories that inform the program's conceptual framework per Standard 2.c.

**Exact text that will be written to the narrative slot:**

```text
Standard 2.c — Philosophical Base of Programs

Prompt: Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.).

Response:
Major Family Therapy ApproachesObject Relations. (Framo and Scharff).Experiential. (Satir and Whitaker).Transgenerational. (Bowen).Structural. (Minuchin).Strategic. (Haley).Cognitive-Behavioral. (Beck and Ellis).Social Constructionist. (deShazer and Anderson).Narrative. (Michael White).1. Object Relations. (Framo and Scharff).Satisfying relationship with some “object” (e.g., parent) is a fundamental need. Helps client gain insight into early relationships (objects from past) and how they affect current relationships enabling individual development and fulfilling relationships.2. Experiential. (Satir and Whitaker).Troubled families need a “growth experience” derived from an intimate interpersonal experience (therapy). By being real (authentic) and self-disclosing, families learn to be more honest, more expressive, and better able to achieve personal and interpersonal growth. For Satir, building self-esteem and learning to communicate openly are essential goals. Whitaker suggested that helping family members probe their own world of symbolic meanings frees them to activate innate growth processes.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[2][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.42** &nbsp;words 158 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This course syllabus outline documents the knowledge base and theoretical content (psychology, neuroscience, developmental and social theory, mental health disorders) that forms part of the curriculum's conceptual foundation. It is supporting evidence for the program's theoretical grounding rather than a narrative response.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 2.c — Philosophical Base of Programs

PSY 101 Introduction to Psychology
Fall, 2018
DATE
LECTURE TOPIC
MODULE
INTRO VIDEO
Week 1:
1-28
Introduction to course/ Why Science
Why Science?
https://www.youtube.com/watch?v=vo4pMVb0R6M
Week 2:
2-4
Research Methods
Research Design
https://www.youtube.com/watch?v=hFV71QPvX2I
Week 3:
2-11
The Brain and Nervous System
Brain & Nervous System/
Nature v. Nurture
https://www.youtube.com/watch?v=jmD0LBdAvlE
Week 4:
2-18
Developmental
Cognitive Development/
Social-personality
https://www.youtube.com/watch?v=8nz2dtv--ok
Week 5:
2-25
Self-identity and gender
Self and identity/
Gender
https://www.youtube.com/watch?v=CquRz_cceH8
Week 6:
3-4
Sensation and perception
Sensation and perception
https://www.youtube.com/watch?v=unWnZvXJH2o
https://www.youtube.com/watch?v=n46umYA_4dM
Week 7:
3-11
Conditioning
Conditioning
https://www.youtube.com/watch?v=qG2SwE_6uVM
Spring Break University Closed
Week 8:
3-25
Attention,  Memory, Forgetting
Memory/
Forgetting
https://www.youtube.com/watch?v=bSycdIx-C48
https://www.youtube.com/watch?v=HVWbrNls-Kw
Week 9:
4-1
Emotions
Functions of emotion
https://www.youtube.com/watch?v=4KbSRXP0wik
Week 10:
4-8
Personality
Personality Traits/
Personality Assessment
https://www.youtube.com/watch?v=sUrV6oZ3zsk
Week 11:
4-15
Social Relations
Social Cognition/
Conformity & Obedience
https://www.youtube.com/watch?v=h6HLDV0T5Q8
https://www.youtube.com/watch?v=UGxGDdQnC1Y
https://www.youtube.com/watch?v=LG6H_8BU-f4
Week 12:
4-22
Anxiety and Mood Disorders
Anxiety/
Mood disorders
https://www.youtube.com/watch?v=aX7jnVXXG5o&pbjreload=10
https://www.youtube.com/watch?v=nCgm1xQa06c
Week 13:
4-29
Schizophrenia
Schizophrenia
https://www.youtube.com/watch?v=uxktavpRdzU
Week 14:
5-6
Personality Disorders
Personality Disorders
https://www.youtube.com/watch?v=4E1JiDFxFGk
Week 15:
FINALS WEEK!

```

---

### `2.d` 🔴 no match — Philosophical Base of Programs

**Spec prompt:** _Describe the multidisciplinary, interdisciplinary, or transdisciplinary approach to knowledge, theories, and skills included in the curriculum._

**→ Imported as NARRATIVE** (`narratives[2][d].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[2][d].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `2.e` 📊 curriculum matrix — Philosophical Base of Programs

**Spec prompt:** _Provide a matrix mapping the curriculum Standards (11-20) and Specifications to required courses. The information provided on the matrix must clearly reflect congruence with the information provided in the Self-Study narrative and the syllabi._

**→ Imported as NARRATIVE** (`narratives[2][e].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[2][e].supportingEvidenceText`):

_(no sections matched as supporting evidence)_

**→ Imported as CURRICULUM MATRIX** (`CurriculumMatrix.rawContent` for `submissionId`):

- conf 0.92 &nbsp; words 129 &nbsp; heading: _(table)_
  ```
  Provide a matrix mapping the curriculum Standards (11-21) and Specifications to required courses. The information provided on the matrix must clearly reflect congruence with the information provided in the self-study narrative and the syllabi.
  Table of Contents
  NOTE:
  Information on how to access the 2018 Matrix Illustrating Relationship of Courses to Curriculum-Baccalaureate Degree Level is provid…
  ```

- conf 0.92 &nbsp; words 64 &nbsp; heading: _(curriculum matrix table)_
  ```
  Course
  Number
  Course Title
  Credit
  Hours
  CHS315/515
  Group Process and Practice
  3
  None
  CHS 340/540
  Administration  of Human Services
  3
  None
  CHS360
  Counseling Strategies for Individuals
  3
  None
  CHS380
  Internship in Human Services
  3
  None
  CHS430
  Family Dynamics and Interventions
  3
  None
  CHS440
  Practicum in Human Services
  9-12
  None
  CHS441
  Seminar in Human Services
  3
  None
  PHIL 415
  Topics in Professional Et…
  ```

- conf 0.89 &nbsp; words 216 &nbsp; heading: _(curriculum matrix table)_
  ```
  Stevenson University
  The Community College of Baltimore County
  Course Number
  Course Title
  Credit Hours
  CCBC Equivalency
  CHS 210
  Professional Writing in Human Services
  3
  None
  CHS 224
  Introduction to Research Methods
  3
  *PSYC 255  Experimental Psychology (4)
  LAW 259
  Children and Family Law
  3
  None
  PSY 108
  Human Growth and Development
  3
  *PSYC 103 Principles of Human Growth and
  Development
  Fine Arts Ele…
  ```

---

## Standard 3

### `3.a` 🔴 no match — Community Assessment

**Spec prompt:** _If the program is less than five years old, provide documentation that supported the initial development of the human services program (such as a community needs assessment)._

**→ Imported as NARRATIVE** (`narratives[3][a].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[3][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `3.b` 🟢 has narrative — Community Assessment

**Spec prompt:** _An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alums, current students, adjunct faculty, and other persons related to the field of human services. Provide the following: 1. A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.), 2. Minutes of advisory committee meetings from the last two years. 3. A narrative or table of how the committee interfaces with the program in relationship to specific issues._

**→ Imported as NARRATIVE** (`narratives[3][b].content`):

##### Match 1 — 🟡 **conf 0.92** &nbsp;words 533 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **C. Community Assessment**

_AI rationale:_ The section directly addresses Standard 3.b requirements: it provides detailed Advisory Committee membership description, meeting minutes from the past two years, and a narrative of how the committee interfaces with the program on specific issues (recruitment, curriculum, graduate programs, internship requirements). It also incorporates 3.c mechanisms (field supervisor feedback, student feedback, faculty review) used to respond to changing needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 3.b — Community Assessment

Prompt: An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alums, current students, adjunct faculty, and other persons related to the field of human services. Provide the following: 1. A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.), 2. Minutes of advisory committee meetings from the last two years. 3. A narrative or table of how the committee interfaces with the program in relationship to specific issues.

Response:
Context: Human services programs continually interact with and affect human services delivery within the local community through field placements and alumnae/i. Programs should be designed to interface with the needs of major employers in terms of job needs and career ladders so there is an orderly and continuous supply of competent professionals.

Standard 3: The program shall include periodic mechanisms for assessment of and response to changing policies, needs, and trends of the profession and community.

Specifications for Standard 3:

If the program is less than five years old, provide documentation that supported the initial development of the human services program (such as a community needs assessment).Table of ContentsResponse: Program is more than 5 years old.

An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alumnae/i, current students, adjunct faculty, and other persons related to the field of human services. Provide the following:A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.),Response: There are currently 14 external members of the Advisory Board, in addition to the 3 full-time faculty members in the department. The external members represent field placement agencies, employing agencies, graduate programs, community college human services program, adjunct faculty, and alumni. Note that the member from CCBC is also deeply involved in addiction credentialing in the state of Maryland and provides expertise in the area of addiction counseling, as well as teaching our addiction-related courses. See attached roster of Advisory Board members.Minutes of advisory committee meetings from the last two yearsResponse: The Advisory Board meets twice a year, typically in September and February. Minutes from the last four meetings (2017/2018 and 2018/2019 academic years) are here. A narrative or table of how the committee interfaces with the program in relationship to specific issues.Response: As illustrated in the Advisory Board minutes, the Board regularly provides helpful suggestions on such program issues as recruitment, curriculum needs (such as the recently approved professional writing course), the development of graduate programs, and internship/practicum requirements (such as the need for paid field experiences). At every meeting, program enrollment and completion statistics are presented, along with a summary of internship and practicum placements and the activities of the Human Services Club. During fall meetings, the annual report, including student feedback, is reviewed with the Board. Suggestions and comments are encouraged both during and after the meeting.

Describe other mechanisms, if any, used to respond to changing needs in the human services field.Table of ContentsResponse: Feedback is solicited from both field experience site supervisors and university supervisors (practicum only) who work with students in their internship and practicum placements. The department gets specific feedback on the performance of students and these supervisors may suggest areas where students, or the program, could improve. Students also provide feedback on the program before they graduate. All of this information is reviewed by department faculty and used to plan for program modifications. Formal department meetings occur every month and include both full-time and part-time instructors.

```

##### Match 2 — 🔵 **conf 0.82** &nbsp;words 256 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Program Modifications: In response to student feedback and a departmental faculty retreat in December, we are proposing **

_AI rationale:_ The section explicitly documents how the Advisory Committee (named members Arthur Hill, Lisa Boone, Candice Edwards) provided feedback on curriculum design and program modifications in response to field trends and employer needs. This directly addresses Standard 3.b's requirement for documentation of Advisory Committee interface with the program on specific issues.

**Exact text that will be written to the narrative slot:**

```text
Standard 3.b — Community Assessment

Prompt: An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alums, current students, adjunct faculty, and other persons related to the field of human services. Provide the following: 1. A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.), 2. Minutes of advisory committee meetings from the last two years. 3. A narrative or table of how the committee interfaces with the program in relationship to specific issues.

Response:
Program Modifications: In response to student feedback and a departmental faculty retreat in December, we are proposing several program modifications and board input was solicited. In addition to reducing the practicum hours, we have changed the name of the addictions course to Psychopharmacology and Addictions and will be requiring it of all majors. The name of CHS 315 has been changed to Group Counseling (from Group Processes and Practices). We polled our current students on which topics classes they would be most interested in taking. The results are attached and were reviewed in the meeting. We discussed potential topics and advisory board members shared a number of helpful ideas. Related to the low interest expressed by students in classes on aging, Lisa Boone indicated that at CCBC a certificate in Elder Care runs because it is offered online and attracts a number of returning students who are currently working. A course in Crisis Intervention, including anger de-escalation, conflict resolution, mediation skills, and burnout issues, was strongly endorsed, with Arthur Hill noting that Kennedy Krieger has employees take Crisis Prevention and Intervention (CPI) training. Candice Edwards suggested that a course related to immigrants, homeless and diverse populations, including at least 5 hours of out-of-class experience, would be useful for students. Some of this is currently covered in the required CHS 220 Diversity and Cultural Competence. The growing importance of Applied Behavioral Analysis and the BCBA certification in the field was stressed. This material is included in current counseling courses, but could be developed into a separate course.

```

##### Match 3 — 🔵 **conf 0.68** &nbsp;words 59 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Members of the Committee shall be full-time faculty members and shall be appointed by their respective schools.  Members**

_AI rationale:_ This section describes the composition, appointment process, and staggered membership structure of what appears to be an Advisory Committee, which directly addresses Standard 3.b's requirement to establish and describe an Advisory Committee's detailed membership and governance. The staggered appointment and full-time faculty requirement reflect governance structures for the advisory body.

**Exact text that will be written to the narrative slot:**

```text
Standard 3.b — Community Assessment

Prompt: An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alums, current students, adjunct faculty, and other persons related to the field of human services. Provide the following: 1. A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.), 2. Minutes of advisory committee meetings from the last two years. 3. A narrative or table of how the committee interfaces with the program in relationship to specific issues.

Response:
Members of the Committee shall be full-time faculty members and shall be appointed by their respective schools.  Members must serve at least two years on the committee, and no school shall elect two new members in the same year.  The appointment cycles must be staggered so that only one new member from a school joins in the same year.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[3][b].supportingEvidenceText`):

##### Evidence 1 — 🟢 **conf 0.92** &nbsp;words 211 &nbsp; `auto_accept`

_Source heading from doc:_ **All members for the advisory board described current events at their places of employment. Lisa Boone gave an update on **

_AI rationale:_ This section provides minutes or summary notes from an advisory committee meeting documenting membership updates, agency partnerships, and feedback on field trends and needs (transfer issues, internship opportunities, funding/policy changes at federal level), directly fulfilling the requirement to provide minutes of advisory committee meetings and demonstrate how the committee interfaces with the program regarding specific issues.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 3.b — Community Assessment

All members for the advisory board described current events at their places of employment. Lisa Boone gave an update on community college transfer issues and the status of a 4 year degree option, which is on hold for now. Recruitment efforts and conversion rates seem to benefit from personal touches. Arthur Hill reported that Kennedy Krieger has a new CEO and is seeking interns for their programs. Sheppard Pratt has a new administration and is offering diverse internship experiences, coordinated by new board member Tom Flis. He advocated for a focus on BCBA certification, since there is a great need. St. Elizabeth School is expanding its teaching space into the laundry building, which is being renovated. Debbie Boyce will be leaving the advisory board, but was thanked for her years of dedicated commitment to the Human Services program at SU. She brought Erika Rue to the meeting, who will be replacing her on the advisory board. Candice Edwards described governmental issues and reported that changes at the federal level have led to noticeable decreases in funding for TANF and other social welfare programs, as well as an increase in restrictions. There has been a crackdown on child support for non-custodial parents in the state and an increase in eligibility for daycare.

```

##### Evidence 2 — 🟢 **conf 0.89** &nbsp;words 241 &nbsp; `auto_accept`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This is a contact roster of Advisory Committee members with names, titles, agencies, and roles—directly supporting Standard 3.b's requirement for 'A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.)'

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 3.b — Community Assessment

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
Erika Rue
IEP and Testing Specialist
St. Elizabeth School
801 Argonne Drive
Baltimore, MD  21218
(410) 889-5054 x1177
erue@stelizabeth-school.org
Kathea Smith
(alum)
Assistant Dean for Academic Advising
University of Baltimore
410-837-5254
katheasmith@gmail.com
John Rosicky (ex officio)
Department Chair, Counseling & Human Services
Stevenson University
1525 Greenspring Valley Road, LRC 114
Stevenson, MD 21153
(443) 394-9636
(315) 525-6211 (c)
jrosicky@stevenson.edu

```

---

### `3.c` 🟢 has narrative — Community Assessment

**Spec prompt:** _Describe other mechanisms, if any, used to respond to changing needs in the human services field._

**→ Imported as NARRATIVE** (`narratives[3][c].content`):

##### Match 1 — 🔵 **conf 0.52** &nbsp;words 72 &nbsp; `review_low_confidence`

_Source heading from doc:_ **2. Collect new data. Each team member is responsible for a conducting field work activity. The field work should be part**

_AI rationale:_ The section describes data collection methods (field work, surveys, interviews) as part of a Community Needs Assessment Action Plan, which aligns with Standard 3.c on mechanisms to respond to changing needs. However, the procedural focus on field work structure and data collection instruments also relates to Standard 21.a on fieldwork process description.

**Exact text that will be written to the narrative slot:**

```text
Standard 3.c — Community Assessment

Prompt: Describe other mechanisms, if any, used to respond to changing needs in the human services field.

Response:
2. Collect new data. Each team member is responsible for a conducting field work activity. The field work should be part of the Community Needs Assessment Action Plan. Examples of field work can include an additional field experience with targeted questions or phone interviews of several service providers, a survey or interview of community members or other stakeholders. Create the data collection instrument (the survey or interview questions) and collect the data.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[3][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 4

### `4.a` 🟢 has narrative — Program Evaluation

**Spec prompt:** _The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change_

**→ Imported as NARRATIVE** (`narratives[4][a].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 1246 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly responds to Standard 4.a by providing measurable student learning outcomes (6 program goals with objectives) and describing an assessment plan using field placement evaluations with midpoint and final ratings. It addresses all three required components: SLOs, assessment plan with timing, and evaluation methodology.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
The program has clear, measureable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following:Table of ContentsMeasureable student learning outcomesResponse: The Program goals and associated objectives are as follows (also in Appendix):Upon completion of the Counseling & Human Services program, graduates will be able to:1. Apply research findings to analyze common problems encountered in the human services field and develop appropriate solutions.Objectives/OutcomesDemonstrate basic technological competence.Describe the role and importance of ethics in social research.Obtain, evaluate, and use academic research literature to analyze issues in human service settings.2. Based on comprehensive self-evaluation and feedback from faculty and supervisors, develop individualized professional development goals and objectives.Objectives/OutcomesAccept constructive criticism and attempt to make appropriate adjustments.Analyze one’s own interpersonal strengths and weaknesses and their application to therapeutic settings.Develop personal goals and objectives.Exhibit attitudes and behaviors related to self-care and wellness.Seek guidance from faculty and supervisors.3. Exhibit consistent professional attitudes and behaviors in applied human services settings.Objectives/OutcomesDemonstrate punctuality, appropriate dress, and constructive use of time.Exhibit consistent ethical behavior in applied human services settings. Follow all policies and procedures of field experience agency.Perform the duties, responsibilities and other professional obligations specified by field experience agency conscientiously.Protect clients’ right to privacy and confidentiality, except when such confidentiality would cause harm to client or others.Speak and write professionally in applied human services settings.Use initiative in interpreting and following instructions in applied human services settings.4. Exhibit culturally sensitive behavior in professional human services settings.Objectives/OutcomesDemonstrate an awareness of diversity by adapting helping approaches to reflect the needs of clients’ culture.Explain and appraise the customs, practices, beliefs and values of the cultures and communities within which he or she practices.Exhibit openness and a non-judgmental attitude related to individual, cultural, and global differences.Provide services without discrimination or preference based on age, ethnicity, culture, race, disability, gender, religion, sexual orientation, or socioeconomic status.5. Exhibit effective and appropriate interpersonal skills in professional human services settings.Objectives/OutcomesCommunicate effectively with others, both orally and in writing.Demonstrate caring, respect, empathy, and genuineness when interacting with others.Establish appropriate rapport with clients.6. Synthesize and appropriately apply key concepts, methods and values in human services to professional situations, independently and with minimal supervision.Objectives/OutcomesApply key concepts, perspectives, methods, and values related to human services. Display understanding of how services are delivered to individuals and families.Help others by using appropriate counseling skills in an applied human services setting.Assessment planResponse:The Assessment Plan for measuring the above student learning outcomes utilizes the evaluation of student performance in their field placements during their final semester in the program to determine whether students have met the learning objectives. Each of the program goals and learning objectives are incorporated into this evaluation tool. Students are rated during their internship using this evaluation and they are rated at the midpoint of their final practicum experience, so they have an opportunity to improve on any objectives on which they are below expectations. Measures and TimingEvaluation is a critical part of the Counseling & Human Services Department.  The needs of our communities, both our external community (agencies) and our internal community (students), are evaluated extensively and frequently through both quantitative and qualitative measures.QUANTITATIVE MEASURES.  Quantitative measures and the timing for each are as follows:  	a.  Agency Evaluation by Student – At end of field placement	b.  Course Evaluation by Student – At conclusion of fall and spring semester courses	c.  Field Placement Prerequisites Checklist – Prior to fall and spring field placements  d.  Graduate Acceptance by Graduate Programs – Annually at conclusion of spring semester	e.  Graduate Evaluation by Employer – Every five years (1 year after graduation)	f.  Program Evaluation by Senior – Immediately after completion of program	g.  Program Evaluation by Graduate – Annually (1 year after graduation)	h.  Program Evaluation/Student Field Placement Evaluation by Student and Field Instructor – At midpoint and end of field placementi.  Student Assessment by Faculty (Behavioral Indicators) – Commencing when student joins major.  j.  University Faculty Supervisor Evaluation by Student – At end of field placement. QUALITATIVE INFORMATION.  Qualitative information and the timing for each are as follows:a.  Advisory Board Meetings - One meeting per semester plus unscheduled communication b.  Faculty Evaluation by Department Chair – Course syllabi and objectives are reviewed every semester. Faculty members are observed regularly, following the University guidelines. Faculty Professional Development Plans are reviewed and discussed with faculty members during the annual Performance Appraisal Meeting. 	c.  Faculty Meetings  - One meeting per month plus unscheduled communication 	d.  Focus Groups of Graduates – At completion of program	e.  Midterm Faculty Evaluation by Student – At midpoint of fall and spring semester courses	f.  Program Evaluation by Student (Focus Group) – At completion of program g.  Responses to additional open-ended questions on all quantitative measures listed above – Timing varies as shown above.The field placement evaluation is the primary measure for student learning outcomes. However, additional measures for some of the outcomes occur in other courses. Goal 1, which involves the use of research literature to analyze problems in human services and the importance of ethics in social research, is assessed during CHS 224 Introduction to Research. Goal 4, regarding culturally sensitive behavior, is partially assessed during CHS 220 Diversity and Cultural Competence. Both of these goals are also assessed in the final field placement evaluation, but specific assignments and evaluations during these courses provide additional evidence of student achievement. Examples of assessment tools, e.g., rubrics, exams, portfolios, surveys, capstone evaluations, etc.Response: The field placement evaluation tool is presented in the Appendix. Students rate themselves at both the midpoint and end of their field experience (the same evaluation is used for both the internship and practicum, so students are familiar with the items). They are then rated by their site supervisor, who discusses the ratings with the student. For each of the six major learning goals and associated objectives, students are rated as being below expectations, meeting expectations, or exceeding expectations. These ratings are reviewed by the University Supervisor and used as both an evaluation of the student’s course performance and as a learning tool for students to improve their performance. A description of how the evaluation may or may not have resulted in any change. Response: One important result of recent program evaluations was the modification of the writing course that was created in 2014 to address an identified need to help students strengthen writing skills. That need still exists, but the writing requirements have been distributed between CHS 224 Research Methods and Writing, the newly created CHS 217 Professional Development in Counseling & Human Services, and CHS 360 Counseling Strategies for Individuals which incorporates the writing of case notes, incident reports and treatment plans.Students have consistently requested more variety in focused elective offerings. Elective courses have been expanded to include Trauma and Crisis Intervention, Therapeutic Recreation, Disability Studies, Coping, and Resilience and Growth Focused Counseling, in addition to regular offerings. See the schedule of elective offerings. Students frequently mentioned that the textbook for the seminar would have been helpful during the internship. As a result of these suggestions, the textbook (Successful Internship by Sweitzer and King) is now introduced in the internship and several chapters are used in that course. Students frequently comment on the challenging time demands of the practicum and the stress and exhaustion that they feel. Partly as a result of this feedback, the 12-credit (540 hour) option for the practicum is being eliminated for students entering the program. The practicum will be 9-credits and 410 hours for all students going forward.

```

##### Match 2 — 🟢 **conf 0.92** &nbsp;words 50 &nbsp; `auto_accept`

_Source heading from doc:_ **The average scores on each outcome are listed below. On all measures, half or more artifacts were rated as adequate. An **

_AI rationale:_ The section reports aggregate assessment results (outcome scores, adequacy ratings, artifact evaluation) directly aligned with Standard 4.a's requirement to describe assessment implementation and outcomes. The data showing adequacy and excellence ratings across artifacts demonstrates the evaluation plan's results.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
The average scores on each outcome are listed below. On all measures, half or more artifacts were rated as adequate. An addition 30-40% were rated as excellent. Three artifacts were rated as inadequate by at least one rater (one for professional development goals and two for professional attitudes and behaviors).

```

##### Match 3 — 🟢 **conf 0.87** &nbsp;words 184 &nbsp; `auto_accept`

_Source heading from doc:_ **These data indicate that all students in their senior practicum were rated by their supervisors as meeting or exceeding **

_AI rationale:_ The section presents concrete assessment data from field practicum supervisor ratings against learning outcomes, demonstrating implementation of an assessment plan and provision of assessment tool results (supervisor evaluations). The discussion of curricular change (professional writing course added) in response to performance data also aligns with 4.a's requirement to describe how evaluation resulted in change.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
These data indicate that all students in their senior practicum were rated by their supervisors as meeting or exceeding expectations on all of the learning outcomes. Nine of the supervisors gave the student they rated all “exceeds” ratings. In general, about twice as many students were given “exceeds” ratings as “meets”, but there was some variation on individual items. Items II.C., III.B. and III.D. were meant to be yes/no ratings, so the “exceeds” option was crossed out, but raters did not consistently use the “meets” option on these items; those who did respond used the “meets” option, so those items were 100% “meets”. Items III.H. on speaking and writing professionally and VI.A. on applying key concepts were close to 50/50 “meets”/”exceeds”, indicating that students did slightly less well on these skills. A professional writing course was added to the curriculum as a required course in 2014. Still, their performance was strong with no students being rated as below expectations. One student was given a “Below” expectations rating on punctuality, but still met expectations on Goal III. One student was identified as struggling with punctuality.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 70 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Evaluation is a very important phase of the learning process. The student and field instructor should each complete the **

_AI rationale:_ The section describes the evaluation tool and rating scale (Below/Meets/Exceeds Expectations) used to assess student learning outcomes at midpoint and end of semester, which directly addresses Standard 4.a's requirement for assessment tools and measurable evaluation criteria. While it touches on the evaluation process itself, the emphasis on the assessment instrument and rating methodology aligns most clearly with program evaluation and student learning outcome assessment.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
Evaluation is a very important phase of the learning process. The student and field instructor should each complete the same copy of the evaluation tool at midpoint and at the end of the semester.  Criteria for achievement of the program goals and objectives are expressed as Below Expectations, Meets Expectations, and Exceeds Expectations. If an objective or category within an objective does not apply, please rate it N.A. (Not Applicable).

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 102 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will write a critical review paper of an assigned reading.  The student will use the title of the article a**

_AI rationale:_ This section describes a specific assignment (critical review paper) with a rubric and point value that functions as an assessment tool demonstrating student learning outcomes and evaluation methodology. It directly supports Standard 4.a's requirement to provide examples of assessment tools (rubrics, portfolios, etc.) and describe how assignments evaluate student competency.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
Each student will write a critical review paper of an assigned reading.  The student will use the title of the article as title for this paper. This paper will summarize the article, highlighting the key points, issues raised, or conclusions arrived at by the author(s), and how the research for the paper was done. It should be written from the perspective of the student, focusing on methodological and analytic issues.  Students will offer a critique of the material and conclude with their own thoughts. (See Rubric for Critical Review Paper).    This assignment is worth 100 points, the same as a test grade.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 81 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research proces**

_AI rationale:_ This section describes a graded research proposal presentation assignment as a student learning assessment tool. It functions as an example of an assessment instrument (aligned with 4.a's requirement to 'provide examples of assessment tools') that measures student competency in understanding the research process, analysis, and critical thinking.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research process, share insights on their topics from the research, speculate on the prospective contribution their research could make, highlight the problems/limitations they anticipate and how they would overcome them.  It is an opportunity for students to engage each other, availing themselves the benefit of the knowledge produced by their individual research effort. This assignment is worth 100 points, the same as a test grade.

```

##### Match 7 — 🔵 **conf 0.68** &nbsp;words 78 &nbsp; `review_low_confidence`

_Source heading from doc:_ **All students either met or exceeded expectations for each of the six goals rated on the Student Field Placement Evaluati**

_AI rationale:_ The section reports results from a field placement evaluation survey showing that students met/exceeded learning expectations, which directly documents an assessment tool and its findings. This aligns best with Standard 4.a's requirement to provide examples of assessment tools and demonstrate that an assessment plan has been implemented.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
All students either met or exceeded expectations for each of the six goals rated on the Student Field Placement Evaluation /survey.  The field instructors’ comments were positive and supportive.  Students were commended for their professionalism, dedication, enthusiasm and persistence. Many students demonstrated openness to feedback and constructive criticism and a willingness to learn. In general students exhibited a high degree of caring for the people they were working with and their efforts were appreciated by clients and staff.

```

##### Match 8 — 🔵 **conf 0.68** &nbsp;words 52 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The demonstration of professional attitudes and behaviors (Objective #3) was rated based on professionalism of writing a**

_AI rationale:_ The section reports assessment results and rubric ratings of student artifacts against a learning objective, directly addressing Standard 4.a's requirement to describe assessment tools (rubrics) and evaluation results. The content demonstrates implementation of an assessment plan with evaluation data.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
The demonstration of professional attitudes and behaviors (Objective #3) was rated based on professionalism of writing and presentation. Two artifacts were judged to be inadequate by at least one of the raters. While 80% or artifacts were rated as adequate or excellent, there was less consistency on this objective then on others.

```

##### Match 9 — 🔵 **conf 0.68** &nbsp;words 81 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research proces**

_AI rationale:_ This section describes a student learning assessment tool (research proposal presentation) with defined point value and learning objectives (grasp of research process, contribution, problem-solving). It functions as an assessment tool example supporting Standard 4.a's requirement for assessment tools and measurable student learning outcomes.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
Students will be presenting their research proposals in class.  They will demonstrate their grasp of the research process, share insights on their topics from the research, speculate on the prospective contribution their research could make, highlight the problems/limitations they anticipate and how they would overcome them.  It is an opportunity for students to engage each other, availing themselves the benefit of the knowledge produced by their individual research effort. This assignment is worth 100 points, the same as a test grade.

```

##### Match 10 — 🔵 **conf 0.52** &nbsp;words 76 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Grading Standard: Grades are determined based on total number of points, not percentages so there is no rounding up. All**

_AI rationale:_ This section describes grading and assessment tool mechanics (rubrics, participation evaluation, peer review) that support the program's assessment plan and student learning outcome measurement processes outlined in Standard 4.a. While it is procedural rather than outcome-focused, it documents assessment methodology and tools.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.a — Program Evaluation

Prompt: The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change

Response:
Grading Standard: Grades are determined based on total number of points, not percentages so there is no rounding up. All assignment grades are posted in Blackboard. Participation grades are determined at the end of the semester including feedback obtained through student completion of a participation rubric. Group presentations are evaluated by classmates, as well as the instructor. Extra credit points earned are added in at the end of the semester and are not posted in Blackboard.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[4][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 204 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This is a grading rubric for student assignments assessing critical thinking and writing quality. It functions as an assessment tool (e.g., rubric) that directly supports Standard 4.a's requirement to provide 'Examples of assessment tools.' The rubric demonstrates how student learning outcomes are being measured.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.a — Program Evaluation

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

##### Evidence 2 — 🔵 **conf 0.72** &nbsp;words 169 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will write a critical review paper of an assigned reading.  This paper must be clearly divided into two sec**

_AI rationale:_ This section describes a specific graded assessment tool (critical review paper with rubric worth 100 points) used to evaluate student learning outcomes in research methodology and analytical thinking. It directly supports Standard 4.a's requirement for documented assessment tools and examples.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.a — Program Evaluation

Each student will write a critical review paper of an assigned reading.  This paper must be clearly divided into two sections with the captions ‘summary’ and ‘critical comments’.  Use the title of the article as title for this paper.  The summary section of this paper summarizes the article, highlighting the key points, issues raised, or conclusions arrived at by the author(s), and how the research for the paper was done.  The critical comments section should be written from the perspective of a research method student, focusing on methodological and analytic issues.  Students may also offer general critique of the material, pointing to the strengths and weaknesses of the material including wrong assumptions, faulty or misleading conclusions, alternative interpretations author(s) ignored, inconsistencies and contradictions in arguments/positions taken, organization and flow of the material and expositional clarity.  Conclude with your own thoughts on the material.  The details of this assignment & the grading rubric are provided in this syllabus. This assignment is worth 100 points, the same as a test grade.

```

##### Evidence 3 — 🔵 **conf 0.72** &nbsp;words 74 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The purpose of these exams is to assess your understanding of and ability to apply the material in this class. Some ques**

_AI rationale:_ This syllabus excerpt describes an assessment tool (exams) used to measure student learning outcomes and application of course material, directly supporting Standard 4.a's requirement to provide examples of assessment tools and demonstrate how evaluation is implemented.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.a — Program Evaluation

The purpose of these exams is to assess your understanding of and ability to apply the material in this class. Some questions will focus on assessing your knowledge and others will assess how well you can apply the information you’ve learned in class to realistic situations. There will be three non-cumulative exams in this class. Each exam is worth 100 points, and can consist of a combination of multiple choice and short answer questions.

```

##### Evidence 4 — 🔵 **conf 0.72** &nbsp;words 194 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Exams (50% of your total grade) The purpose of these exams is to assess your understanding of and ability to apply the m**

_AI rationale:_ This syllabus section describes an assessment tool (exams) used to measure student learning outcomes and their application of course material, which directly exemplifies the assessment plan and tools required by Standard 4.a. The content is part of a course syllabus detailing how student mastery is evaluated.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.a — Program Evaluation

Exams (50% of your total grade) The purpose of these exams is to assess your understanding of and ability to apply the material in this class. Some questions will focus on assessing your knowledge and others will assess how well you can apply the information you have learned in class to realistic situations. There will be four non-cumulative exams in this class. Each exam is worth 125 points and will consist of a combination of multiple choice and short answer questions. The final exam (i.e., Exam 4) will be the same format and worth the same number of points as the three midterm exams. Note that the final exam is not cumulative. Very selectively, permission may be given to miss an exam and take a makeup exam due to extenuating circumstances. Evidence (e.g., doctor’s note or other verification) will be required (but may not be sufficient) in order to get permission to make up an exam. Students who are requesting a makeup exam must submit the request form to the instructor (available on Blackboard). If you miss an exam and are not permitted a makeup exam, you will receive a 0 on that exam.

```

##### Evidence 5 — 🔵 **conf 0.72** &nbsp;words 114 &nbsp; `review_low_confidence`

_Source heading from doc:_ **We will have four tests/exams.  Each test will combine multiple-choice and essay questions. The questions in these tests**

_AI rationale:_ This syllabus section describes a specific assessment tool (exams combining multiple-choice and essay questions) that contributes to the program's assessment plan and measures student learning. It aligns best with Standard 4.a's requirement to provide 'Examples of assessment tools' as part of the implemented assessment plan.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.a — Program Evaluation

We will have four tests/exams.  Each test will combine multiple-choice and essay questions. The questions in these tests/exams will be drawn from our class discussions and assigned readings.  Three of these tests will be done on Blackboard.  These tests will be opened on the Friday of the scheduled week, remaining open until Sunday midnight. Students are responsible for ensuring that they take these tests as scheduled, using reliable internet connection.  The fourth is the final exam which will be in-class.  A make-up for a missed test will be arranged only if the reasons for missing the test are officially tenable, and appropriate documentation is provided.  These tests make up 50% of the course points.

```

---

### `4.b` 🟢 has narrative — Program Evaluation

**Spec prompt:** _The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change._

**→ Imported as NARRATIVE** (`narratives[4][b].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 759 &nbsp; `auto_accept`

_Source heading from doc:_ **The program shall conduct a formal program evaluation every five years. The formal evaluation shall**

_AI rationale:_ The section directly addresses Standard 4.b's requirement for formal program evaluation at least every five years, providing all four required elements: history of evaluations, methodology description, summative analysis of 2018-2019 evaluation, and reference to change resulting from evaluation (Standard 4c1). The narrative aligns precisely with the spec's mandate for student surveys, agency surveys, graduate follow-up surveys, advisory committee participation, and course/faculty evaluations.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
The program shall conduct a formal program evaluation every five years. The formal evaluation shall include: student surveys, agency surveys, graduate follow-up surveys (directed to both graduates and their employers), active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: Table of Contents A history of program evaluations Response: Comprehensive program evaluations that include the results of faculty and course evaluations, agency surveys, graduate surveys, and student surveys, as well as the active participation of the Advisory Board, have occurred annually since 2005. Employer evaluations of graduates occur regularly. These evaluations are supplemented by self-studies completed every five years for Council reaccreditation. Here is the Program Evaluation for 2018-201 9. A description of the methodology Response: Both quantitative and qualitative measures are employed to evaluate the Program. See the Program Evaluation Plan and copies of evaluation tools in the appendix. Evaluation tools that focus on faculty members are described in Standard 8 . Students complete quantitative evaluations of various facets of the Program, including evaluations of instructors (at midterm and end of each course), courses (at midterm and end of each course), field placement agencies (at midterm and end of field placement), University supervisors, agency supervisors, and, upon their completion of the Program and annually (one year after graduation), students evaluate the Program itself. Other quantitative evaluations are completed of graduate acceptance by graduate programs and by employers of Program graduates. Qualitative evaluations of field placement agencies utilized by the Program are made by University Supervisors in written submissions to the Field Placement Coordinator (at midterm and end of field placement) and by the Field Placement Coordinator in semester and annual assessments and revisions of what agencies are appropriate for field placements. In addition, qualitative evaluations are conducted each semester and in unscheduled communication by Program Advisory Board members. The Department Chair conducts qualitative evaluations of faculty, as more fully explained in the narrative for Standard 8 , through a combination of review of syllabi and course objectives, classroom observations, and annual performance appraisals. Other qualitative evaluations occur by faculty at monthly faculty meetings, by seniors in focus groups at the completion of the Program, and in response to open ended questions on quantitative measures. The Program Evaluation is disseminated by the Department Chair to faculty members, Advisory Board members, and the Field Placement Coordinator. The recipients then provide their input and recommendations regarding the Program Evaluation and the Program itself . See response to Standard 4c1 below for more details about dissemination of evaluation results. A summative analysis of the most recent evaluation Response: The most recently completed formal program evaluation was for the 2018-2019 academic year. (See the full report here .) In summary, the results confirm that the present curriculum and field experiences are effective in meeting the program mission, “to provide students with an educational foundation that will prepare them for meaningful and effective careers within the human services field and successful continuation of their education.” Student field placement evaluations also indicate that the program goals are being met. Students praised their CHS courses and the Counseling &amp; Human Services faculty. Some suggestions related to the Counseling &amp; Human Services curriculum included an expansion of topics course offerings and tracks to include such areas as: child life, disabilities and special education, counseling for children and youth, and school counseling. Several students questioned the usefulness of some of the general education courses and other non-departmental courses. A description of how and in what way the evaluation resulted in any change. Response: One important result of recent program evaluations was the reduction in the required hours for the practicum from 410 hours to 360 hours. There had been a number of comments about the stresses and mental health effects of the practicum. While learning to create a healthy work-life balance is part of professional growth, that can still be achieved in a slightly less demanding schedule. Students have consistently requested more variety in focused elective offerings. Elective courses have been expanded to include Trauma and Crisis Intervention, Social Justice, Disability Studies, Coping, and Resilience and Growth Focused Counseling, in addition to regular offerings. See the attached schedule of elective offerings . Students frequently mentioned that the textbook for the seminar would have been helpful during the internship. As a result of these suggestions, the textbook ( Successful Internship by Sweitzer and King) is now introduced in the internship and several chapters are used in that course.

```

##### Match 2 — 🟡 **conf 0.92** &nbsp;words 84 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **D. Program Evaluation**

_AI rationale:_ The section describes the program's regular formal evaluations—including student surveys, agency surveys, graduate follow-up surveys, advisory committee involvement, and course evaluations—which directly aligns with Standard 4.b's requirement for comprehensive formal program evaluation at least every five years. While 4.a addresses student learning outcomes and assessment planning, the primary content addresses the broader program evaluation methodology and history.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
Context: To ensure the program is effective in producing competent professionals, the program must be evaluated on a regular basis. In addition, the program must assess how well the needs of students and graduates are being met. These evaluations/ assessments are the bases for modifying and improving the program.

Standard 4: The program shall conduct, and report to the public, consistent formal evaluations, which determine its effectiveness in meeting the needs of the students, community, and the human services field.

Specifications for Standard 4:

```

##### Match 3 — 🟢 **conf 0.89** &nbsp;words 92 &nbsp; `auto_accept`

_Source heading from doc:_ **Graduate Survey Results: Feedback from graduating seniors last spring were reviewed. Students consistently point to thei**

_AI rationale:_ This section presents graduate survey results and feedback analysis, which directly fulfills Standard 4.b's requirement to conduct formal program evaluation including student surveys and to describe how evaluation resulted in change (discussing reduction of required hours and commitment to maintaining field experience).

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
Graduate Survey Results: Feedback from graduating seniors last spring were reviewed. Students consistently point to their field experiences, and to faculty, as the most beneficial parts of the program. However, some concern was expressed by students about the difficulty of completing the number of hours required and not getting paid. We discussed the possibility of reducing the number of required hours, but there was also a commitment to maintaining this vital part of the program. It will continue to be important to help students navigate finding a balance between work and practicum.

```

##### Match 4 — 🔵 **conf 0.82** &nbsp;words 66 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The results of the 2018-2019 Counseling & Human Services Program Evaluation confirm that the present curriculum and fiel**

_AI rationale:_ The section reports results from a formal 2018-2019 program evaluation that examined curriculum effectiveness, field experiences, and alignment with program mission and goals. This directly addresses Standard 4.b's requirement to conduct formal program evaluation and provide summative analysis of the most recent evaluation.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
The results of the 2018-2019 Counseling & Human Services Program Evaluation confirm that the present curriculum and field experiences are effective in meeting the program mission, “to provide students with an educational foundation that will prepare them for meaningful and effective careers within the human services field and successful continuation of their education.” Student field placement evaluations also indicate that the program goals are being met.

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 53 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The Department Chair is responsible for developing and coordinating program assessment procedures.  Thus, the results ob**

_AI rationale:_ The section describes program assessment procedures, collection and dissemination of assessment results, and evaluation of program effectiveness and relevance—core elements of Standard 4.b's formal program evaluation methodology and process. The administrative responsibility aligns with 4.b's requirement for systematic evaluation including multiple data sources and stakeholder involvement.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
The Department Chair is responsible for developing and coordinating program assessment procedures.  Thus, the results obtained from the sources listed above are collected and disseminated by him/her to the appropriate individuals and groups.  The results are indicative of the current relevance of the educational objectives and the effectiveness of the program and curriculum.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 77 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Many students indicated that there was no part of the program that was not worthwhile. Five students noted that the text**

_AI rationale:_ This section presents student survey feedback and evaluation results, directly addressing Standard 4.b's requirement to conduct formal program evaluation including student surveys and summative analysis of findings. The feedback on practicum hours, internship hours, and course content reflects evaluation data used to assess program effectiveness.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
Many students indicated that there was no part of the program that was not worthwhile. Five students noted that the textbook for practicum was redundant and could have been used in the internship. A few students felt that the demands were overwhelming, particularly the practicum hours, while others indicated that the internship had too few hours to be effective.  Individual students mentioned specific courses and experiences (statistics, focused electives/budgeting class, the portfolio, and too much group work).

```

##### Match 7 — 🔵 **conf 0.72** &nbsp;words 55 &nbsp; `review_low_confidence`

_Source heading from doc:_ **On the Program Evaluation Form and in the Senior Focus Groups, students praised their CHS courses and the Human Services**

_AI rationale:_ The section presents student feedback from evaluation forms and focus groups regarding curriculum and program offerings, which is core evidence of program evaluation methodology and use of student surveys as specified in Standard 4.b. While advisory input is mentioned, the focus is on student evaluation data collection and programmatic response.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
On the Program Evaluation Form and in the Senior Focus Groups, students praised their CHS courses and the Human Services faculty. Some suggestions related to the curriculum included an expansion of topics course offerings and tracks to include such areas as: child life, disabilities and special education, counseling for children and youth, and school counseling.

```

##### Match 8 — 🔵 **conf 0.72** &nbsp;words 60 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Only a few seniors offered suggestions for improving the program, but one theme was the expansion of course offerings an**

_AI rationale:_ This section reports student feedback and suggestions collected as part of program evaluation activities, directly addressing Standard 4.b's requirement that formal program evaluation include student surveys and analysis of results to inform program changes (course expansion, supervision improvements, articulation pathways). The narrative demonstrates how evaluation data is being used to guide improvement decisions.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
Only a few seniors offered suggestions for improving the program, but one theme was the expansion of course offerings and tracks. Suggestions included: more counseling classes, therapeutic play, disabilities, trauma and more psychology courses. One student suggested that University Supervisors visit sites more often and early in the semester to catch problems early. Another student requested more graduate school articulations.

```

##### Match 9 — 🔵 **conf 0.72** &nbsp;words 57 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Evaluations for all graduates (35 students combined in fall of 2016 and spring of 2017) were reviewed by both the Depart**

_AI rationale:_ The section describes a formal review of graduate evaluations by designated personnel (Department Chair and Field Experience Coordinator), calculating percentages of student achievement against defined items. This directly addresses Standard 4.b's requirement for formal program evaluation methodology and data analysis, though the brevity limits confidence.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.b — Program Evaluation

Prompt: The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change.

Response:
Evaluations for all graduates (35 students combined in fall of 2016 and spring of 2017) were reviewed by both the Department Chair (John Rosicky) and the Field Experience Coordinator (Mayaugust Finkenberg). The percentage of students who meet or exceed each item was calculated. Comments were reviewed and shared with faculty, but were not included in the analysis.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[4][b].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 117 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This table presents quantitative survey data evaluating field agency adequacy, field instructor preparation, and overall placement quality—core components of formal program evaluation methodology as specified in Standard 4.b, which explicitly requires agency surveys and field placement evaluations.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.b — Program Evaluation

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

##### Evidence 2 — 🔵 **conf 0.72** &nbsp;words 98 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This is a survey instrument measuring agency adequacy, field instructor preparation, feedback, and staff support—core elements of program evaluation data. Standard 4.b explicitly requires agency surveys and evaluative data, making this supporting evidence for formal program evaluation methodology.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.b — Program Evaluation

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

---

### `4.c` 🟢 has narrative — Program Evaluation

**Spec prompt:** _The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys._

**→ Imported as NARRATIVE** (`narratives[4][c].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 215 &nbsp; `auto_accept`

_Source heading from doc:_ **(table)**

_AI rationale:_ The section directly addresses the requirement to provide reliable information on program performance and student achievement to the public, including an active link on the website and aggregate data (enrollment, retention, graduation rates, GPA, student satisfaction, agency feedback). This matches Standard 4.c language and the CHEA Recognition Policy citation.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.c — Program Evaluation

Prompt: The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys.

Response:
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

##### Match 2 — 🔵 **conf 0.68** &nbsp;words 83 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This sem**

_AI rationale:_ The section reports enrollment trend data (83 majors, 16 minors) and explicitly mentions the need to track recruitment and student outcomes—directly aligned with Standard 4.c's requirement for reliable performance information including enrollment trends and retention data to be made publicly available.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.c — Program Evaluation

Prompt: The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys.

Response:
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This semester we have a total of 83 majors and 16 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Human Services program through marketing and publicity efforts. In discussing the enrollment statistics, Kathea suggested getting information from the admissions office about students who are accepted into Stevenson but end up going somewhere else and what schools they ultimately attend.

```

##### Match 3 — 🔵 **conf 0.68** &nbsp;words 51 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spr**

_AI rationale:_ The section reports enrollment trend data (83 majors, 20 minors) as a performance metric. Standard 4.c explicitly requires aggregate enrollment trends as evidence of student achievement and program performance. While the data fragment could support 1.e (student population description), the emphasis on trends and the forward-looking recruitment concern aligns best with program evaluation and public performance reporting.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.c — Program Evaluation

Prompt: The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys.

Response:
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This spring we have a total of 83 majors and 20 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Human Services program through marketing and publicity efforts.

```

##### Match 4 — 🔵 **conf 0.68** &nbsp;words 96 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This fal**

_AI rationale:_ The section reports enrollment statistics and trends, which directly align with Standard 4.c's requirement to provide enrollment trends as part of aggregate data on program performance and student achievement metrics.

**Exact text that will be written to the narrative slot:**

```text
Standard 4.c — Program Evaluation

Prompt: The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys.

Response:
Enrollment Statistics: Statistics on student enrollment continue to show a downward trend (see attached chart). This fall we have a total of 87 majors and 20 minors. We need to make continuing efforts to recruit students and emphasize the unique strengths of the Human Services program through marketing and publicity efforts. Kathea Smith offered to help by calling accepted students when the time is appropriate. She also suggested getting information from the admissions office about where accepted students decide to go if they don’t chose Stevenson, and why. Nigel suggested service events at local high schools.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[4][c].supportingEvidenceText`):

##### Evidence 1 — 🟢 **conf 0.87** &nbsp;words 520 &nbsp; `auto_accept`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This survey data table provides aggregate evidence of student achievement outcomes including employment data, graduate follow-up information, and graduate satisfaction metrics, directly supporting Standard 4.c's requirement for reliable performance information including employment data and alumni surveys.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

Survey questions
2015 Results*
Primary enrollment status at Stevenson:
Traditional Student (Day)
100%  (8)
Accelerated/online student (GPS)
0
Did you transfer to Stevenson from another college?
No
88%
Yes, from a Maryland community college
12%
Yes, from a Maryland four-year college or university
0
Yes, from an out-of-state college or university
0
What was the highest degree you received from Stevenson University?
Bachelor’s Degree
100%
Master’s Degree
0
Are you currently employed?
Yes, full-time
75%
Yes, part-time
25%
No, seeking employment
0
No not seeking employment
0
Select your current occupation from the list below:
Educator (teacher, professor)
0
Engineer or Architect (engineering technician)
0
Financial (accountant, broker, financial analyst)
12%
Health Professional
25%
Information Systems (programmer/analyst, computer/software    engineer, electronic technician)
0
Legal Professional or Law Enforcement
0
Manager, Executive, Proprietor
0
Sales or Marketing (retail, real estate)
12%
Scientist (physical, research, statistician, analyst)
0
Skilled trades (clerical, laborer, service occupation)
0
Social Worker
25%
Other Professional
25%
Where is your current place of employment
Maryland
75%
District of Columbia
0
Northern Virginia (suburbs of DC)
0
Neighboring state (DE, NJ, PA, WV, elsewhere in VA)
12%
Other state or country (specifically: Delaware)
13%
What is your annual salary in your current job?
Less than $20,000
12%
$20,000 to $29,999
38%
$30,000 to $39,999
50%
$40,000 to $49,999
0
$50,000 to $59,999
0
$60,000 to $69,999
0
$70,000 or more
0
To what extent is your current job related to your major or area of study at Stevenson?
Directly related
50%
Somewhat related
25%
Not related, but is not important to me
0
Not related, but I would like a job related to my major
25%
Was a Bachelor’s degree required in order to obtain your current job?
Yes
37%
No
63%
Not sure
0
How well did Stevenson prepare you for your current job?
Excellent preparation
12%
Good preparation
63%
Fair preparation
25%
Poor preparation
0
Uncertain
0
How well did Stevenson prepare you for graduate or professional study?
Excellent preparation
12%
Good preparation
25%
Fair preparation
0
Poor preparation
0
Uncertain
0
I have not enrolled in graduate/professional study
63%
Would you have been financially able to complete your degree without the financial aid you received?
I did not receive any type of financial aid
0
Yes, without major financial hardship to me and/or my family
0
Yes, with major financial hardship to me and/or my family
63%
No, I would not have been financially able to complete my          degree
37%
How likely are you to major in the same field again?
Very Likely
63%
Likely
12%
Unsure
12%
Unlikely
0
Not Likely
12%
How likely are you to attend Stevenson University again?
Very Likely
25%
Likely
37%
Unsure
25%
Unlikely
13%
Not Likely
0
How would you rate your overall education at Stevenson University?
Excellent
50%
Good
50%
Fair
0
Poor
0
Where do you currently live?
Maryland
75%
Elsewhere (specifically: Delaware, New Jersey)
25%
Gender
Female
100%
Male
0
Race/Ethnicity
African-American/Black
12%
American Indian/Alaska Native
0
Asian American/Asian
13%
Hispanic
0
White/Caucasian
75%
Other
0
Citizenship status
U.S. citizen
100%
Permanent U.S. resident
0
Non-resident
0

```

##### Evidence 2 — 🔵 **conf 0.82** &nbsp;words 441 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This alumni survey data table provides aggregate evidence of student achievement, graduate employment outcomes, and satisfaction—directly matching Standard 4.c's requirement for reliable performance information including employment data and alumni surveys. While it contains demographic elements, the primary intent is outcomes/achievement reporting.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

Survey questions
2015 Results
Primary enrollment status at Stevenson:
Traditional Student (Day)
100%  (6)
Accelerated/online student (GPS)
0
Did you transfer to Stevenson from another college?
No
67%
Yes
33%
What was the highest degree you received from Stevenson University?
Bachelor’s Degree
100%
Master’s Degree
0
Do you hold any professional designations (C.P.A, R.N., C.F.P., A.S.C.P., etc.)
No
50%
Yes (CAC-AD, HSBCP, LGSW)
50%
Indicate the highest degree you currently hold:
Bachelor’s Degree
50%
Master’s Degree
50%
Doctoral degree
0
Professional degree (M.D., J.D., etc.)
0
Are you currently employed?
Yes, full-time
83%
Yes, part-time
17%
No, seeking employment
0
No, not seeking employment
0
Where is your current place of employment?
Maryland
83%
District of Columbia
0
Northern Virginia (suburbs of DC)
0
Neighboring state (DE, NJ, PA, WV, elsewhere in VA)
17%
Other state or country:
0
To what extent is your current job related to your major or area of study at Stevenson?
Directly related
67%
Somewhat related
33%
Not related, but is not important to me
0
Not related, but I would like a job related to my major
0
How well did Stevenson prepare you for your current job?
Excellent preparation
67%
Good preparation
33%
Fair preparation
0
Poor preparation
0
Uncertain
0
What is your annual salary in your current job?
Less than $20,000
17%
$20,000 to $29,999
0
$30,000 to $39,999
33%
$40,000 to $49,999
17%
$50,000 to $59,999
0
$60,000 to $69,999
33%
$70,000 or more
0
If you were to do it over, how likely are you to major in the same field again?
Very likely
33%
Likely
67%
Unsure
0
Unlikely
0
Not Likely
0
If you were to do it over, would you attend Stevenson University again?
Very likely
33%
Likely
67%
Unsure
0
Unlikely
0
Not Likely
0
Please rate your level of satisfaction with your achievement in the followings skills or areas:
Skills
Very Satisfied
Satisfied
Neutral
Dissatisfied
Very Dissatisfied
Critical Thinking skills
67%
33%
0
0
0
Oral communication
83%
17%
0
0
0
Written communication
83%
17%
0
0
0
Diversity awareness
33%
50%
17%
0
0
Information literacy
67%
33%
0
0
0
Quantitative skills
50%
50%
0
0
0
Scientific reasoning
33%
50%
17%
0
0
Technology literacy
50%
33%
17%
0
0
How would you rate your overall education at Stevenson University?
Excellent
83%
Good
17%
Fair
0
Poor
0
Where do you currently live?
Maryland
67%
Elsewhere (Pennsylvania, Virginia)
33%
Gender
Female
100%
Male
0
Race/Ethnicity
African-American/Black
17%
American Indian/Alaska Native
0
Asian American/Asian
0
Hispanic
0
White/Caucasian
83%
Other
0
Citizenship status
U.S. citizen
100%
Permanent U.S. resident
0
Non-resident
0

```

##### Evidence 3 — 🔵 **conf 0.72** &nbsp;words 33 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This grading scale table is supporting evidence for aggregate student achievement data (grade point average) that programs must provide to the public per Standard 4.c. It demonstrates the institutional metrics used to calculate and report student performance outcomes.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

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

##### Evidence 4 — 🔵 **conf 0.72** &nbsp;words 33 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This grading scale table is supporting evidence for aggregate data on student achievement (grade point average) required under Standard 4.c's specification to provide reliable performance information including GPA to the public.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

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

##### Evidence 5 — 🔵 **conf 0.72** &nbsp;words 33 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This grading scale table is supporting evidence for student achievement metrics and aggregate data reporting required under Standard 4.c, which mandates programs provide reliable information on student achievement including grade point average as one indicator of performance.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

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

##### Evidence 6 — 🔵 **conf 0.72** &nbsp;words 33 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This grading scale table is supporting evidence for aggregate student achievement data (GPA), which Standard 4.c explicitly requests as part of public performance information. The grade-point-average conversion is a concrete artifact documenting one metric of student achievement.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

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

##### Evidence 7 — 🔵 **conf 0.72** &nbsp;words 33 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This grading scale table is supporting evidence for Standard 4.c's requirement to provide aggregate data on student achievement, specifically grade point average metrics. It documents the institutional grading policy that underpins GPA reporting.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

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

##### Evidence 8 — 🔵 **conf 0.72** &nbsp;words 33 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This grading scale table is supporting evidence for aggregate data on student achievement (grade point average) that programs must provide publicly per Standard 4.c. It establishes the institutional conversion framework for GPA reporting.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 4.c — Program Evaluation

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

---

## Standard 5

### `5.a` 🟢 has narrative — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of policies regarding the selection and admission of students._

**→ Imported as NARRATIVE** (`narratives[5][a].content`):

##### Match 1 — 🟢 **conf 0.93** &nbsp;words 76 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly documents policies regarding selection and admission of students, matching the exact language of Standard 5.a. The content addresses how students are admitted to the program through institutional procedures.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.a — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies regarding the selection and admission of students.

Response:
Provide documentation of policies regarding the selection and admission of students.Table of ContentsResponse:Students enter the program in accordance with the University's admission policies and procedures.  See the Admissions section of the University Catalog online.  There are no additional requirements for the Program.  Students are able to enter the program at the beginning of their first year or at any point throughout their college career; however, all requirements for the program must be completed prior to graduation.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 79 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every s**

_AI rationale:_ This section articulates institutional policies governing student conduct, enrollment continuity (withdrawal procedures), and academic standing (grading consequences for non-attendance), which are foundational student policies and procedures covered under Standard 5.a. The FX grade sanction relates to retention and dismissal decision-making.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.a — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies regarding the selection and admission of students.

Response:
Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 3 — 🔵 **conf 0.62** &nbsp;words 83 &nbsp; `review_low_confidence`

_Source heading from doc:_ **7.  The SPONSOR shall notify students selected for the Education Program that the student is not an employee of the HEAL**

_AI rationale:_ This section documents a program policy regarding the selection and admission of students—specifically, notification requirements for admitted students concerning their employment status and compensation. This falls under Standard 5.a (policies regarding selection and admission), though it also touches on student attributes and fitness-for-profession disclosures covered by 5.d.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.a — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies regarding the selection and admission of students.

Response:
7.  The SPONSOR shall notify students selected for the Education Program that the student is not an employee of the HEALTH SYSTEM for any purpose, that the student shall not be compensated in any way, and that the student is not entitled to any benefit afforded by the HEALTH SYSTEM to its employees, including, but not limited to worker’s compensation insurance.  Students shall be informed that they will not be reimbursed for rendering services to patients during the course of the Education Program.

```

##### Match 4 — 🔵 **conf 0.52** &nbsp;words 53 &nbsp; `review_low_confidence`

_Source heading from doc:_ **2.  The SPONSOR shall warrant to the HEALTH SYSTEM that each student has on record with the SPONSOR a complete physical,**

_AI rationale:_ This section addresses student health/medical screening requirements at admission, which falls under policies regarding selection and admission of students (5.a). While it also relates to 'fitness for the profession' (5.d), the primary focus is on documentation required prior to or at the point of admission.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.a — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies regarding the selection and admission of students.

Response:
2.  The SPONSOR shall warrant to the HEALTH SYSTEM that each student has on record with the SPONSOR a complete physical, showing general good health, freedom from tuberculosis and no other infectious diseases.  Upon request from the HEALTH SYSTEM, a copy of records reflecting the foregoing shall be made available to HEALTH SYSTEM.

```

##### Match 5 — 🔵 **conf 0.52** &nbsp;words 57 &nbsp; `review_low_confidence`

_Source heading from doc:_ **2.  Health Insurance.  Each student accepted into the Education Program, as a condition of participation, must carry hea**

_AI rationale:_ This section documents a mandatory health insurance policy as a condition of student participation in the program. While the similarity scores are modest across all candidates, Standard 5.a (admission policies) best captures the conditional requirement for program entry, though Standard 5.d (fitness for the profession) could also apply if health insurance is framed as a fitness/professional readiness requirement.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.a — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies regarding the selection and admission of students.

Response:
2.  Health Insurance.  Each student accepted into the Education Program, as a condition of participation, must carry health insurance including major medical coverage adequate to cover the student’s needs in case of any accident, injury or illness while participating in the HEALTH SYSTEM’s  Education Program, and shall furnish proof of such insurance to HEALTH SYSTEM upon request.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[5][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.42** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **E.  Notice of Student Cancellation.  In the event of cancellation by a student holding a reserved space in an Education **

_AI rationale:_ This section describes a contractual policy governing student program enrollment and cancellation notification procedures, which relates most broadly to Standard 5.a policies regarding student selection and admission. The content could secondarily address 5.c (dismissal/termination procedures), though the section does not directly address due process or grievance mechanisms.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.a — Policies and Procedures for Admitting, Retaining, and Dismissing Students

E.  Notice of Student Cancellation.  In the event of cancellation by a student holding a reserved space in an Education Program at HEALTH SYSTEM, SPONSOR shall immediately notify HEALTH SYSTEM.  Failure to notify of a cancellation, or excessive cancellations may, at HEALTH SYSTEM’s option, permit HEALTH SYSTEM to terminate this Agreement prior to the expiration of the term.

```

---

### `5.b` 🟢 has narrative — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies._

**→ Imported as NARRATIVE** (`narratives[5][b].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 491 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses the specification requirement to 'Provide documentation of policies and procedures for referring students for personal and academic assistance' by describing the institution's referral mechanisms through the Office of Student Success, Early Alert system, Wellness Center, and supporting services.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Provide documentation of policies and procedures for referring students for individualized personal and academic assistance. These policies must be consistent with the institution’s policies.Table of ContentsResponse:As a relatively small program, students are well known to departmental faculty and the support and ultimate success of every student is a priority. Each student is assigned a faculty advisor, and concerns (as well as plans to address them) about any students by any faculty members are discussed at every Department faculty meeting. Concerns about any issues, either academic or personal, are referred to the Office of Student Success, either through direct contact with staff in that office or through an Early Alert notification. The Office of Student Success follows up on all concerns and makes appropriate referrals as needed, keeping faculty members informed throughout the process. In addition, the University has a Wellness Center which offers a personalized environment, addressing an individual's needs through health and counseling services. While no referral form is used, faculty provide information about the Wellness Center to students who may need this resource and make contact with the Director of the Wellness Center about students referred. For more information about this service, visit the website Several University initiatives that potentially affect the wellness and support of students in the Counseling & Human Services Program include the existence of a Director of Multicultural Affairs, the University's written statement on accommodations, the Academic Link, and the Office of Student Success, as described in the following:Director of Multicultural Affairs.  This position was first filled in July 2003.  The Director of Multicultural Affairs coordinates the College's efforts to foster a diverse learning and working environment.  The Director provides counsel in initiating, developing, and implementing short and long-range plans related to diversity efforts.  He or she develops and maintains collaborative relationships with students, faculty, staff, community groups, and professional organizations while developing and implementing diversity and multi-cultural programs. The University also promotes multi-cultural events and speakers, including “Multi-Cultural Week.” University accommodations for students with disabilities. The Program adheres to the University policy on disability.  A disabled student is referred to the University’s Office of Student Success if he or she is not currently involved with them. Faculty in the Program work with Student Success Services to make sure the student has the accommodations needed to be successful in the program.  Policy and procedures regarding students with disabilities are outlined online here.The Academic Link.  Students work together with tutors as a team to learn effective study strategies, increase understanding of course content, and become independent learners. Any University student is eligible for free tutoring or other academic assistance in most subjects. More information about The Academic Link is available online.The Center for Student Success.  The Center for Student Success provides services and resources to students, faculty and staff that will strengthen academic performance, enhance student satisfaction, and improve student retention.  For a complete description of the numerous services provided by this office, visit the website.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 74 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section articulates institutional policies and procedures for student expectations regarding attendance, grade consequences, and academic standing (including the 'FX' grade policy), which directly address how students are retained or dismissed based on program compliance and academic performance under Standard 5.b.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 3 — 🔵 **conf 0.62** &nbsp;words 88 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for students with disabilities. The Office **

_AI rationale:_ This section describes institutional policies and procedures for referring students to support services (disability accommodations), which directly aligns with Standard 5.b's requirement to document policies for referring students for personal and academic assistance consistent with institutional policies.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for students with disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 4 — 🔵 **conf 0.62** &nbsp;words 78 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section articulates student policies regarding attendance, course completion, and grading consequences, which are core elements of institutional retention and dismissal procedures. While attendance policies are institutional in origin, they directly support how programs manage student academic standing and procedures for referring or dismissing students.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 5 — 🔵 **conf 0.62** &nbsp;words 78 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section articulates attendance policy and grading procedures that constitute documented policies and procedures for retaining students (including dismissal via 'FX' grade for non-attendance and failure to withdraw), which is the focus of Standard 5.b. While it touches on program communication (1.c), the primary regulatory and procedural intent aligns with student retention and dismissal protocols.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 6 — 🔵 **conf 0.58** &nbsp;words 82 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Academic Link - The John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), **

_AI rationale:_ The section describes the Academic Link as a resource for referring students for academic assistance (tutoring), which directly aligns with Standard 5.b's requirement to document policies and procedures for referring students for academic assistance. While it could also support Standard 9.d on resource support, the primary focus is on the referral/assistance policy mechanism.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Academic Link - The John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), provides free tutoring for many classes. If you are having difficulty with or would benefit from discussing the material with an upper level peer, seek assistance early in the semester. Tutoring often makes a difference in a student’s grade. To view the tutoring schedule and sign up for an appointment, go to stevenson.go-redrock.com, visit the Link in person, or call 443-394-9300.

```

##### Match 7 — 🔵 **conf 0.52** &nbsp;words 89 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. **

_AI rationale:_ The section describes institutional policies and procedures for referring students to support services (Disability Services), which aligns with Standard 5.b's requirement to document policies for referring students for personal and academic assistance. While resource support (9.d) is tangentially relevant, the core content is procedural policy for student assistance and accommodation.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 8 — 🔵 **conf 0.52** &nbsp;words 89 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. **

_AI rationale:_ This section describes institutional policies for referring students for personal and academic assistance (disability accommodations), which aligns most directly with Standard 5.b's requirement for documentation of referral policies. While it touches on student support resources (9.d), the primary focus is on admission/retention-related accommodation procedures.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 9 — 🔵 **conf 0.52** &nbsp;words 78 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section describes attendance and grading policies that directly relate to student retention and academic standing policies. Standard 5.b addresses documentation of policies for retaining and dismissing students, including academic consequences (the 'FX' grade for non-attendance and failure to withdraw).

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 10 — 🔵 **conf 0.52** &nbsp;words 89 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. **

_AI rationale:_ This section describes institutional policies and procedures for referring students to support services (disability accommodations), which aligns with Standard 5.b's requirement for documentation of policies directing students to personal and academic assistance. While it could tangentially relate to resource support (9.d), the primary focus is on institutional support policies and procedures.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 11 — 🔵 **conf 0.52** &nbsp;words 105 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disa**

_AI rationale:_ This section documents institutional policy and procedures for student accommodations and support services, which most directly aligns with Standard 5.b's requirement for policies and procedures for referring students for personal and academic assistance. While it could also support Standard 9.d (resource support), the emphasis is on policy documentation rather than resource adequacy.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for students who self-identify as having a disability and provide appropriate documentation. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive. This is the link to the University’s Office of Disability Services: http://www.stevenson.edu/academics/academic-resources/disability-support-services/

```

##### Match 12 — 🔵 **conf 0.48** &nbsp;words 93 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disa**

_AI rationale:_ This section describes institutional policies for referring students with disabilities to support services (ODS) and procedures for accommodation authorization, which most directly aligns with 5.b's requirement to document policies and procedures for referring students for personal and academic assistance. While it could support 9.d (resource support), the primary focus is on access procedures rather than adequacy of resources.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for students who self-identify as having a disability and provide appropriate documentation. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 13 — 🔵 **conf 0.48** &nbsp;words 89 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. **

_AI rationale:_ This section describes policies and procedures for referring students to support services (disability accommodations), which aligns with Standard 5.b's requirement for documentation of policies for referring students for personal and academic assistance. While the embedding score is modest, the narrative directly addresses institutional accommodation procedures and support referral.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 14 — 🔵 **conf 0.48** &nbsp;words 93 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disa**

_AI rationale:_ This section documents institutional policies for referring students to support services (disability accommodations), which aligns with Standard 5.b's requirement for policies on referring students for personal and academic assistance. While the institution's disability services structure could also touch on resource support (9.d), the primary content is policy documentation for student support referral.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for students who self-identify as having a disability and provide appropriate documentation. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 15 — 🔵 **conf 0.48** &nbsp;words 93 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disa**

_AI rationale:_ This section describes institutional policies and procedures for referring students to support services (disability accommodations), which aligns with Standard 5.b's requirement for documentation of policies for referring students for personal and academic assistance. While it could support Standard 9.d (resource support), the primary focus is on student support referral procedures.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for qualified students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for students who self-identify as having a disability and provide appropriate documentation. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 16 — 🔵 **conf 0.42** &nbsp;words 88 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services Stevenson University will make reasonable accommodations for students with disabilities. The Office **

_AI rationale:_ This section describes institutional policies and procedures for accommodating students and referring them for support services, which aligns most closely with Standard 5.b on policies for student assistance. While it touches on resource support (9.d), the content is primarily policy-procedural rather than descriptive of physical or technological resources.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services Stevenson University will make reasonable accommodations for students with disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 17 — 🔵 **conf 0.42** &nbsp;words 78 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section articulates student policies regarding attendance, grading, and withdrawal—institutional policies governing student retention and academic standing. While the similarity scores are modest, Standard 5.b (student policies and procedures for retention) is the best fit, as it addresses documentation of policies affecting student retention and dismissal, including academic performance consequences.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 18 — 🔵 **conf 0.42** &nbsp;words 78 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ This section documents student policies regarding attendance, grade consequences, and withdrawal procedures, which are institutional policies for retaining and dismissing students. It best aligns with Standard 5.b, though it could tangentially inform how students are informed of expectations (1.c).

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 19 — 🔵 **conf 0.42** &nbsp;words 90 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Disability Services  - Stevenson University will make reasonable accommodations for students with documented disabilitie**

_AI rationale:_ This narrative describes institutional policies and procedures for referring students to support services (Disability Services/accommodations), which aligns most closely with Standard 5.b's requirement for documentation of policies for referring students for personal and academic assistance. While support resources (9.d) could be a secondary fit, the emphasis here is on the referral and accommodation policy itself.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Disability Services  - Stevenson University will make reasonable accommodations for students with documented disabilities. The Office of Disability Services (ODS) facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact the Director of Disability Services located in Garrison Hall South Room 138 or send an email to ODS@stevenson.edu. Once accommodations are authorized by ODS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive.

```

##### Match 20 — 🔵 **conf 0.42** &nbsp;words 78 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is res**

_AI rationale:_ The section describes student policies regarding attendance, grading, and academic standing (including failure to withdraw resulting in 'FX' grade), which align with institutional policies for retaining and dismissing students. It is best classified under Standard 5.b, which requires documentation of policies for academic assistance and student retention/dismissal, though the content is tangentially relevant and similarity scores are modest.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies.

Response:
Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[5][b].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.68** &nbsp;words 52 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The Wellness Center - Stress is a normal part of being a student. However, if personal, emotional, 		or physical concern**

_AI rationale:_ This brief institutional resource description documents a referral mechanism (Wellness Center contact information) for students experiencing personal, emotional, or physical concerns, directly supporting Standard 5.b's requirement for documentation of policies and procedures for referring students for personal and academic assistance.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

The Wellness Center - Stress is a normal part of being a student. However, if personal, emotional, 		or physical concerns are interfering with your ability to be successful at Stevenson, please call the 		Wellness Center at 443-352-4200 to make an appointment. More information about the Wellness 		Center can be found at: http://www.stevenson.edu/student-life/health-wellness/

```

##### Evidence 2 — 🔵 **conf 0.52** &nbsp;words 79 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The Office of Student Success facilitates equal access for every student who self-identifies as having a disability. If **

_AI rationale:_ This content describes policies and procedures for referring students to support services (disability accommodations), which aligns with Standard 5.b's requirement for documentation of referral policies for personal and academic assistance. The disability services contact and process described constitute institutional support policy.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

The Office of Student Success facilitates equal access for every student who self-identifies as having a disability. If you are a student with a disability who needs accommodations in this class, please contact Abby Hurson, Director of Disability Services at ahurson@stevenson.edu / (443) 352-4920. Once accommodations are authorized by OSS, please provide me (your instructor) with your approved accommodations memo as soon as possible. Accommodations are not retroactive. This is the link to the University’s Disability Support Services: http://www.stevenson.edu/academics/academic-resources/disability-support-services/

```

##### Evidence 3 — 🔵 **conf 0.42** &nbsp;words 116 &nbsp; `review_low_confidence`

_Source heading from doc:_ **I prefer to talk to you in person about any ideas or issues you may have, so please schedule an appointment to meet with**

_AI rationale:_ This syllabus excerpt describes instructor accessibility and communication procedures for students needing academic support or clarification, which best aligns with policies for referring students for academic assistance under Standard 5.b. While it touches on resource support (technology, communication systems), the primary focus is procedural guidance for student support rather than facility/infrastructure description.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

I prefer to talk to you in person about any ideas or issues you may have, so please schedule an appointment to meet with me!  If you miss class, please get notes from a classmate and then meet with me to discuss anything you don’t understand from those notes.  If you need to email me, allow 48 hours for a response (although I’ll do my best to respond as soon as possible).  I will often correspond with you through campus e-mail or Blackboard announcements.  Please become familiar with how to log on to both systems and check your e-mail regularly.  Class changes and updates will be posted in Blackboard and sent to your Stevenson e-mail address.

```

##### Evidence 4 — 🔵 **conf 0.42** &nbsp;words 67 &nbsp; `review_low_confidence`

_Source heading from doc:_ **I will monitor your attendance in accordance with mandates from the Stevenson University Registrar.  While you will not **

_AI rationale:_ This syllabus statement describes institutional policies for monitoring student engagement and referring students for academic assistance, which most closely aligns with Standard 5.b's requirement to document policies for referring students for personal and academic assistance. The mention of instructor contact regarding attendance failure relates to retention and support policies.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.b — Policies and Procedures for Admitting, Retaining, and Dismissing Students

I will monitor your attendance in accordance with mandates from the Stevenson University Registrar.  While you will not earn a grade for attendance, failure to attend class regularly may cause you to miss assignments, pertinent information, and opportunities for participation.  As a result, it is to your benefit to attend class regularly.  If you continually fail to attend class, I will contact you to discuss your attendance.

```

---

### `5.c` 🟢 has narrative — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of written policies and procedures describing the due process for probation, remediation, dismissal, appeal, and grievance procedures affecting students._

**→ Imported as NARRATIVE** (`narratives[5][c].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 102 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses written policies and procedures for due process, probation, dismissal, appeal, and grievance procedures affecting students, which is the exact language of Standard 5.c in the current specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.c — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of written policies and procedures describing the due process for probation, remediation, dismissal, appeal, and grievance procedures affecting students.

Response:
Provide documentation of written policies and procedures describing the due process for probation, dismissal, appeal, and grievance procedures affecting students.Table of ContentsResponse:The Counseling & Human Services Program follows the University’s policies and procedures related to due process for probation, dismissal, appeal, and grievance procedures. Redress of student grievances and the policies and procedures regarding disciplinary proceedings can be found in the Stevenson University Policy Manual, Vol. V: Student Policies. Procedures for due process and appeal of all decisions are clearly laid out in this document, which is available to students on the SU portal and is included here on the thumb drive.

```

##### Match 2 — 🔵 **conf 0.62** &nbsp;words 83 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students will not receive credit for assignments submitted late or missed exams without prior approval of the instructor**

_AI rationale:_ This section describes written policies and procedures governing student assignment submission, grading, and consequences for non-compliance—core elements of due process and dismissal/remediation procedures under Standard 5.c. While not exclusively about probation or dismissal, the late-work and zero-grade policy constitutes a procedural rule affecting student standing and academic consequences.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.c — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of written policies and procedures describing the due process for probation, remediation, dismissal, appeal, and grievance procedures affecting students.

Response:
Students will not receive credit for assignments submitted late or missed exams without prior approval of the instructor. Student must provide a documented valid excuse explaining why they could not complete the assignment. Examples of documented valid excuses that will be considered are those involving illness, family emergencies, and catastrophic incidents, all of which can be verified through documentation and directly affect the involved student. If you miss an assignment without an acceptable documented valid excuse, you will earn a grade of Zero.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[5][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.62** &nbsp;words 53 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The above Stevenson grading system will be used. Because you have all semester to earn points, I do NOT negotiate grades**

_AI rationale:_ This syllabus excerpt describes grading policies and procedures affecting student academic standing and dismissal (no grade negotiation, no extra credit). While not a full due-process policy document, it addresses procedural fairness in student retention/dismissal decisions, which aligns best with Standard 5.c on policies for probation, remediation, and dismissal procedures.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.c — Policies and Procedures for Admitting, Retaining, and Dismissing Students

The above Stevenson grading system will be used. Because you have all semester to earn points, I do NOT negotiate grades at the end of the semester. Furthermore, I will NOT offer any extra credit assignment. I would be happy to talk to you about ways to improve your grade throughout the semester!

```

##### Evidence 2 — 🔵 **conf 0.52** &nbsp;words 73 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(vi)	Notwithstanding any provision of this Agreement to the contrary regarding term or termination, if HEALTH SYSTEM det**

_AI rationale:_ This excerpt is a contractual termination clause addressing grounds for student dismissal from an education program, which most closely aligns with Standard 5.c's requirement for documented dismissal procedures. The confidentiality violation trigger relates peripherally to Standard 19.c but is primarily a procedural/due-process matter.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.c — Policies and Procedures for Admitting, Retaining, and Dismissing Students

(vi)	Notwithstanding any provision of this Agreement to the contrary regarding term or termination, if HEALTH SYSTEM determines in good faith that SPONSOR or any student has violated a material term of this Paragraph C pertaining to the confidentiality of Protected Health Information, HEALTH SYSTEM shall have the option to immediately terminate this Agreement or to immediately terminate the participation in the Education Program of any student who was involved in the violation.

```

---

### `5.d` 🟢 has narrative — Policies and Procedures for Admitting, Retaining, and Dismissing Students

**Spec prompt:** _Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals._

**→ Imported as NARRATIVE** (`narratives[5][d].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 480 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The narrative directly responds to Standard 5.d's requirement to document policies and procedures for assessing and managing student attributes, characteristics, and behaviors ('fitness for the profession'). The section addresses behavioral indicators, ethical standards, assessment mechanisms, and dismissal procedures for students not meeting professional standards.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.Table of ContentsResponse: The Program’s behavioral expectations are included in the Counseling & Human Services Student Handbook.  Ethical behavior is addressed in the section on Department Procedures and in Appendix F, which lists the “Ethical Standards of Human Service Professionals.” A copy of the Handbook is provided to all Counseling & Human Services majors when they enter the major and they sign a New Student Acknowledgement Form confirming that they have received a handbook and agree to abide by the ethical standards.Faculty members who have a concern related to a student’s behavior document the concern with specific behaviors and discuss their concern with the individual student.  The student's advisor is also notified.  A list of “behavioral indicators” addressing respect for others, interpersonal skills, and professionalism is provided in the Counseling & Human Services Student Handbook here.  In addition to their presence in the Handbook, the Behavioral Indicators are reviewed when students enter the major and in both the Professional Development course (CHS 217) and Internship course (CHS 380).  Time is set aside at every faculty meeting for faculty members to raise any concerns they may have about students, including behavioral or legal concerns.  A plan on whether or how to address concerns is discussed and documented. Common initial outcomes include discussion of the concern between the instructor and student, referral of the student to his or her advisor, referral of the student to the Program Coordinator, referral of the student to the Stevenson Wellness Center, and/or referral of the student to another appropriate resource (see Department Meeting Minutes).Satisfactory performance in CHS 380 (internship and accompanying seminar) is required for the practicum (CHS 440).  Unsatisfactory performance (a grade below C) in CHS 380 will result in ineligibility for CHS 440.  Students whose performance in CHS 380 is unsatisfactory are permitted to repeat the course.  A second grade below C in CHS 380 will result in dismissal from the program (See CHS Student Handbook here).Students who have prior legal problems are not denied admission to the major; however, some field placements sites will not accept students who have a criminal record. Students are advised that they may need to submit to criminal background checks at internship or practicum sites. Prior to assignment of potential field placements, students complete a survey form asking that they explain any issues or limitations that could impact their field placement (such as disability, criminal record, citizenship) (See Appendix 5, pp. 2, 3.). Agencies that require a personal background check make the arrangements for doing so with the student. Procedures for handling issues which may arise during the field placement experience are addressed in the Field Placement Handbook here and here in the Counseling & Human Services Student Handbook.

```

##### Match 2 — 🟢 **conf 0.89** &nbsp;words 78 &nbsp; `auto_accept`

_Source heading from doc:_ **In order to be eligible for the practicum (CHS 440), students must have a 2.5 overall GPA and demonstrate adequate profe**

_AI rationale:_ The section directly addresses program policies for assessing and managing student fitness for the profession (GPA, professionalism standards, dismissal procedures), which is the core subject of Standard 5.d on retaining and dismissing students based on professional attributes.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
In order to be eligible for the practicum (CHS 440), students must have a 2.5 overall GPA and demonstrate adequate professionalism, as assessed by faculty. Any concerns related to meeting professional expectations will be communicated to students (see next section). Students who do not meet professional expectations, or have below a 2.5 GPA by the end of the semester before their practicum placement, will not be allowed to register for CHS 440 and may need to switch majors.

```

##### Match 3 — 🟢 **conf 0.88** &nbsp;words 76 &nbsp; `auto_accept`

_Source heading from doc:_ **In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profes**

_AI rationale:_ The section directly addresses program policies for assessing and managing student attributes and behaviors related to 'fitness for the profession,' including documentation of concerns and decisions regarding internship/practicum eligibility, which is the core requirement of Standard 5.d.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profession,” faculty members who have a concern about a student related to any of these indicators will document the concern with specific behaviors and will discuss their concern with the individual student. Serious or chronic concerns will be discussed by department faculty and students may be judged ineligible for internship or practicum based on failure to meet professional expectations.

```

##### Match 4 — 🔵 **conf 0.82** &nbsp;words 77 &nbsp; `review_low_confidence`

_Source heading from doc:_ **In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profes**

_AI rationale:_ The section directly addresses policies and procedures for assessing and managing student attributes, behaviors, and 'fitness for the profession'—the core language of Standard 5.d. The narrative describes faculty documentation of behavioral concerns and eligibility determination for practicum/internship, which are assessment and management mechanisms for professional fitness.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
In accordance with the Department’s obligation under CSHSE accreditation to prepare students who are “fit for the profession”, faculty members who have a concern about a student related to any of these indicators will document the concern with specific behaviors and will discuss their concern with the individual student. Serious or chronic concerns will be discussed by department faculty and students may be judged ineligible for internship or practicum based on failure to meet behavioral indicator prerequisites.

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 119 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The cornerstone for the retention of students in the Counseling & Human Services Department is the faculty advisor, who **

_AI rationale:_ The section describes institutional policies and procedures for student retention, including assignment of faculty advisors and their role in supporting student success, which directly addresses Standard 5.d's requirement for documentation of policies and procedures related to student retention and fitness for the profession.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
The cornerstone for the retention of students in the Counseling & Human Services Department is the faculty advisor, who is important in helping each student achieve his or her personal and career goals.  Upon admission to the department, each student is assigned an advisor who is a Counseling & Human Services faculty member.  Faculty advisors assist in course planning and are a source of information about the department and about the college in general.  Although it is the responsibility of the student to become familiar with academic regulations presented in university publications, the advisor can provide background knowledge and assistance, with emphasis on the student’s own decision-making.  Advisors schedule weekly office hours and are available for individually requested appointments.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 71 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Juniors will receive additional information about the 5-year degree program in the CHS 380 class.  Interested students m**

_AI rationale:_ The section describes admission criteria and requirements (GPA, degree completion, faculty recommendation, letter of interest) for a 5-year degree program, which directly addresses program policies and procedures for admitting students as specified in Standard 5.d.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
Juniors will receive additional information about the 5-year degree program in the CHS 380 class.  Interested students must submit (1) a letter of interest and (2) a recommendation by a full-time faculty member in the SU Human Services Program.  Minimum criteria for the program are (1) 2.75 GPA and (2) acquisition of a Bachelor’s Degree in Human Services prior to beginning the fifth year of their graduate studies at McDaniel College.

```

##### Match 7 — 🔵 **conf 0.72** &nbsp;words 95 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The HEALTH SYSTEM has adopted a policy to establish and maintain a work environment free from the effects of alcohol or **

_AI rationale:_ This section documents the program's drug and alcohol policy and dismissal consequences, directly addressing fitness-for-the-profession standards and behavioral expectations critical to student retention and dismissal decisions under Standard 5.d.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
The HEALTH SYSTEM has adopted a policy to establish and maintain a work environment free from the effects of alcohol or other drugs, and specifically prohibits the illegal or unauthorized use, possession, manufacture, dispensation or sale of alcohol, controlled substances, drugs or drug paraphernalia on HEALTH SYSTEM premises or on HEALTH SYSTEM business, or in HEALTH SYSTEM supplied vehicles.  SPONSOR agrees to advise students of this policy and to inform students that a determination by HEALTH SYSTEM of non-conformance to this policy shall result in the immediate termination of their participation in the Education Program.

```

##### Match 8 — 🔵 **conf 0.72** &nbsp;words 70 &nbsp; `review_low_confidence`

_Source heading from doc:_ **4.  The HEALTH SYSTEM shall retain the right to require the removal from, and deny access to, its facility of any studen**

_AI rationale:_ The section describes a policy for assessing and managing student behavior and professional conduct (fitness for the profession), including removal from a practicum facility, which directly aligns with Standard 5.d. It could secondarily address 5.c as it involves dismissal procedures, though the primary focus is on behavioral/fitness standards rather than due process language.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
4.  The HEALTH SYSTEM shall retain the right to require the removal from, and deny access to, its facility of any student whose professional or social conduct is, in the opinion of the HEALTH SYSTEM, disruptive, disreputable, or otherwise destructive of the established practices of the HEALTH SYSTEM or its standing in the community.  Such action shall be reported promptly to SPONSOR's contact person as noted in III, F, below.

```

##### Match 9 — 🔵 **conf 0.68** &nbsp;words 56 &nbsp; `review_low_confidence`

_Source heading from doc:_ **5.  	Effort will be made to maintain the placement.  Occasionally, however, the 	coordinator may decide that it is neces**

_AI rationale:_ This brief narrative describes program procedures for removing students from placements due to inadequate agency supervision or student Code of Ethics violations, which directly addresses fitness-for-the-profession assessment and dismissal/retention policies under Standard 5.d.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
5.  	Effort will be made to maintain the placement.  Occasionally, however, the 	coordinator may decide that it is necessary to remove a student from a particular 	placement.  The reasons for this action range from inadequate supervision on the 	part of the agency to a violation of the Code of Ethics on the part of the student.

```

##### Match 10 — 🔵 **conf 0.68** &nbsp;words 65 &nbsp; `review_low_confidence`

_Source heading from doc:_ **D.         Hepatitis B.        The Centers for Disease Control recommend that all personnel working in a patient care en**

_AI rationale:_ This section addresses program policies regarding student health and safety requirements (Hepatitis B vaccination), which falls under Standard 5.d's requirement to document policies assessing and managing student attributes, characteristics, and behaviors important for fitness for the profession in a clinical/patient-care context.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
D.         Hepatitis B.        The Centers for Disease Control recommend that all personnel working in a patient care environment receive the Hepatitis B vaccine.  At present, the HEALTH SYSTEM does not require that students enrolled in the HEALTH SYSTEM's clinical training programs receive the vaccine.  The HEALTH SYSTEM maintains that it is the student's personal and financial responsibility to determine whether they should receive the vaccine.

```

##### Match 11 — 🔵 **conf 0.62** &nbsp;words 79 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every s**

_AI rationale:_ This attendance policy addresses student behaviors and program expectations for maintaining good standing in the program, including consequences for non-compliance (FX grade), which aligns best with Standard 5.d on fitness for the profession and student conduct policies. It could secondarily inform 1.c regarding program expectations communicated to students.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
Attendance   Each student is responsible for his or her own class attendance and regular attendance is expected. Every student is responsible for the material covered or the skills exercised during scheduled classes. Grades will be based on demonstrated achievement of the objectives of the course, not on attendance in class as such. Students who stop attending and fail to officially withdraw from a class will be given a grade of "FX" which calculates as an "F" in the GPA.

```

##### Match 12 — 🔵 **conf 0.58** &nbsp;words 85 &nbsp; `review_low_confidence`

_Source heading from doc:_ **5.	If requested by Affiliate, the School shall instruct the student to provide Affiliate with evidence of current TB sta**

_AI rationale:_ This section documents policies and procedures related to student health and fitness requirements (TB testing, Hepatitis B immunization) that are relevant to assessing and managing student attributes and behaviors important for fitness for the profession in human services field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
5.	If requested by Affiliate, the School shall instruct the student to provide Affiliate with evidence of current TB status and Hepatitis B immunization or signed declination statement.  Otherwise, TB testing and Hepatitis B immunization will be provided by the Affiliate.  TB testing is required for all students at the Affiliate for (6) weeks or more.  Students are required to receive (2) PPD tests within the last (12) months as part of a two-step screening program required by the CDC, OSHA, and Affiliate’s accreditation agencies.

```

##### Match 13 — 🔵 **conf 0.58** &nbsp;words 51 &nbsp; `review_low_confidence`

_Source heading from doc:_ **4.	The School will instruct participating students to abide by rules, regulations, policies and procedures as stipulated**

_AI rationale:_ The section addresses student conduct expectations and professional fitness standards (rules, regulations, confidentiality) that align with Standard 5.d's requirement to document policies managing student attributes and behaviors important for profession success. The confidentiality emphasis secondarily connects to 14.c (upholding confidentiality).

**Exact text that will be written to the narrative slot:**

```text
Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Prompt: Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals.

Response:
4.	The School will instruct participating students to abide by rules, regulations, policies and procedures as stipulated by the Directors of the School and Affiliate, including the policy of holding patient information in the strictest confidence as required by local and federal regulations.  HIPAA training may be completed through the Affiliate.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[5][d].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 161 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Participation & Professionalism (10% of your total grade) Your participation grade will be based on your professionalism**

_AI rationale:_ This syllabus grading policy establishes criteria for assessing student professionalism, engagement, and behaviors ('non-professional activities,' respectful collaboration, professional conduct) that directly align with program policies for managing student attributes and fitness for the profession under Standard 5.d.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Participation & Professionalism (10% of your total grade) Your participation grade will be based on your professionalism, engagement, and contribution in large group and small group discussions and activities in class. There will be no opportunities to make up participation points. You must be present (both physically and mentally) in class in order to receive participation points. You will be given some early feedback regarding your participation and professionalism before the middle of the semester.  We are all colleagues and collaborators in learning. Therefore, we should all treat each other with the consideration and respect of professionals. Therefore, you will lose points for any non-professional activities. These include all disruptive and disrespectful behaviors including: using your computer device (e.g., laptop, cell phone, tablet, etc.) without approval from instructor (also see Policies on p.4 of the syllabus); tardiness or leaving class early;  missing appointments with faculty (or peers);  failing to work collaboratively and respectfully with peers;  participating in “extracurricular” conversations during class.

```

##### Evidence 2 — 🔵 **conf 0.68** &nbsp;words 110 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Participation & Professionalism:  The basic principle is that I expect respectful behavior in this class.  Your particip**

_AI rationale:_ This syllabus excerpt articulates course-level expectations regarding student professionalism, participation standards, and behavioral conduct that relate to assessing and managing student attributes and fitness for the profession as outlined in Standard 5.d.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Participation & Professionalism:  The basic principle is that I expect respectful behavior in this class.  Your participation grade will be based on your professionalism, engagement, and contribution in large group and small group discussions in class as well as large group, small group, and individual in-class activities. There will be no opportunities to make up participation points. You must be present (both physically and mentally) in class in order to receive participation points. We are all colleagues and collaborators in learning. Therefore, we should all treat each other with the consideration and respect of professionals.  Professionalism will count towards your grade. Therefore, you will lose points for any non-professional activities.

```

##### Evidence 3 — 🔵 **conf 0.42** &nbsp;words 50 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Regular class attendance and participation are necessary to pass and/or do well in this and indeed all courses.  Student**

_AI rationale:_ This passage describes course attendance and participation policies as requirements for student success and program standing. While embedded in a syllabus excerpt, the substance addresses student behavioral expectations and fitness-for-the-profession standards most closely aligned with Standard 5.d (student attributes, characteristics, and behaviors important for success).

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Regular class attendance and participation are necessary to pass and/or do well in this and indeed all courses.  Students are encouraged to be punctual and regular to class as class discussions are likely to draw on materials not covered by the assigned readings. Various in-class assignments are worth 10 points.

```

##### Evidence 4 — 🔵 **conf 0.42** &nbsp;words 147 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Policies: Late policy: All late assignments will lose 10% of its worth for each 24-hour period. Please note: No Computer**

_AI rationale:_ This section documents classroom conduct policies and device restrictions that relate to student attributes, behaviors, and fitness for the profession (5.d), though it is tangentially related to classroom space management (9.e) and due process procedures (5.c). The content most directly addresses professional conduct expectations for students in the learning environment.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 5.d — Policies and Procedures for Admitting, Retaining, and Dismissing Students

Policies: Late policy: All late assignments will lose 10% of its worth for each 24-hour period. Please note: No Computer Device Allowed in Class. No computer device (e.g., laptop, tablet, cell phone, etc.) will be allowed in class except with permission from the instructor. A study published in Psychological Science (one of the most prestigious journals in the field of Psychology) by Mueller and Oppenheimer (2014) found that using computers to take notes would actually hinder learning. In contrast, taking notes via longhand (i.e., traditional pen and paper) would encourage deeper processing, thus better understanding of the materials. Not to mention, students who use computer device during class tend to go off-task very frequently, which is really disrespectful to the instructor, and distracting for everyone else in class. Students who are requesting to use a computer device in class must complete a request form available on Blackboard.

```

---

## Standard 6

### `6.a` 🟢 has narrative — Credentials of Human Services Faculty

**Spec prompt:** _Include curriculum vitae of full-time and part-time faculty who teach human services courses. The vitae must demonstrate that: 1. Faculty have education in various disciplines and experience in human services or related fields 2. Teaching faculty have no less than one degree above the level of certificate or degree in which they teach. It is recommended that faculty have no less than a master’s degree._

**→ Imported as NARRATIVE** (`narratives[6][a].content`):

##### Match 1 — 🟡 **conf 0.89** &nbsp;words 1565 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **(curriculum matrix table)**

_AI rationale:_ The section's primary content responds to Standard 6.a by providing curriculum vitae evidence and demonstrating that faculty have diverse disciplinary education (counseling, social work, psychology, etc.) and experience in human services delivery. The secondary response about personnel roles and responsibilities aligns with Standard 7.b's request for role descriptions.

**Exact text that will be written to the narrative slot:**

```text
Standard 6.a — Credentials of Human Services Faculty

Prompt: Include curriculum vitae of full-time and part-time faculty who teach human services courses. The vitae must demonstrate that: 1. Faculty have education in various disciplines and experience in human services or related fields 2. Teaching faculty have no less than one degree above the level of certificate or degree in which they teach. It is recommended that faculty have no less than a master’s degree.

Response:
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
. Full-time and part-time program faculty have expertise in a variety of areas including counseling, human services, law, psychology, education, social work, administration of human services, addictions counseling, developmental psychology, special education, guidance counseling, educational leadership, and pastoral counseling.  Across the full-time and regular part-time faculty members, three faculty members have a Ph.D.; all have a Master’s Degree or higher.  Two faculty members have Juris Doctorates, two have doctorates in education; others have Master’s in Social Work, Counseling, or Special Education. Areas of current or previous employment among faculty members include the administration of human services for local or state government, disability services, child and adolescent programs, addictions treatment, private therapy practice, and the practice of law.
Teaching faculty have no less than one degree above the level of certificate or degree in which they teach. It is recommended that faculty have no less than a master’s degree.
Response:
As indicated in the curriculum vitae, all instructors of departmental courses have at least a master’s degree.
G. Personnel Roles, Responsibilities, and Evaluation
Context
:
To balance the academic and experiential characteristics of human services programs, adequate faculty and staff should be available to fill essential program roles.
Standard 7: The program shall adequately manage and evaluate the essential program roles and provide professional development opportunities for faculty and staff.
Specifications for Standard 7:
a.
Document that faculty have the ultimate responsibility for setting policies and determining the content, implementation, and evaluation of the curriculum.
Table of Contents
Response:
Department faculty make all decisions about Counseling & Human Services policies and curriculum through collaborative departmental discussions, faculty meetings, and consultation with the advisory board (see
department meeting minutes
). All changes to courses, objectives and program curriculum are approved through the Academic Affairs Committee of the Faculty Council, an all-faculty governing body with ultimate responsibility for academic decisions (see
AAC By-Laws
).
b.
Essential program roles include administration, curriculum development and review, instruction, field supervision, program planning, program evaluation, student advising, and student evaluation.
Table of Contents
Provide a brief description of how the essential roles are fulfilled in the program
Response:
The Counseling & Human Services Program at Stevenson includes four full-time faculty members and eight regular adjunct faculty members.  Program faculty have teaching responsibilities for human services courses along with administrative, program, and field placement duties as indicated below.  See Appendix for a detailed description of the roles of the
Department Chair
,
Field Placement Coordinator
, and
University Supervisors
.
Administration – Department Chair
Curriculum Development and Review – Department Chair in collaboration with faculty
Instruction – Four full-time and approximately eight part-time faculty
Field Supervision – Six University Supervisors
Program Planning – Department Chair in collaboration with faculty
Program Evaluation –  Department Chair
Student Advising – Four full-time faculty
Student Evaluation – Faculty
Provide a table matching faculty and staff positions and names with these roles.
Response:
Table 7. Human Services Faculty Members, Roles, Responsibilities & Instruction
Faculty Members
Responsibilities
Courses
Candice Baker (PT)
Field Supervision
Carol Dietrich, M.S.W. (PT)
Instruction, Student Evaluation
CHS 315/515,
360, 430, 441
Bunny Ebling (PT)
Instruction, Field Supervision, Student Evaluation
CHS 201, 315/515
Candice Edwards (PT)
Field Supervision
Roxanne Epps (PT)
Instruction, Student Evaluation
CHS 101, 275
Mayaugust Finkenberg, D.Ed. (FT)
Instruction, Student Evaluation
CHS 201
Barbara Guthrie, M.Ed. (PT)
Instruction, Student Evaluation
CHS 201, 340/540
Loryn Lesser (PT)
Instruction, Field Supervision, Student Evaluation
CHS 224, 101, 201
John Rosicky, Ph.D. (FT)
Administration, Curriculum, Instruction, Program Planning, Program Evaluation, Student Advising, Student Evaluation
CHS 101, 201, 250, 441
Harold Shaffer, M.S. (PT)
Instruction, Student Evaluation
CHS 270, 315/515, 360, 370, 371
Kathea Smith (PT)
Field Supervision
Tom Swisher, J.D., Ph.D. (FT)
Instruction, Student Advising, Student Evaluation
CHS 101, 430, 380
Barry Thomas, Ph.D. (PT)
Instruction, Student Evaluation
CHS 101
Diana Trujillo (PT)
Field Supervision
Lauri Weiner, M.A., J.D. (FT)
Instruction, Student Advising, Student Evaluation
CHS 101, 220, 250
Note: PT = Part-time;  FT = Full-time
c.
Describe the process for faculty and staff evaluation. Documentation may come from a variety of sources and may include, among others, student evaluations, administrative review, comments from field placement agencies, and peer review.
Response:
Each faculty member in the Counseling & Human Services Program is evaluated annually by the Department Chair and by themselves. In addition, faculty members are evaluated by students at midterm and at the semester conclusion of every course.
An extensive, University-wide faculty evaluation system provides a vehicle for the documentation of successful teaching and for the citation of areas where instructional improvement is being undertaken.  All faculty members, full-time or adjunct, are expected to be actively documenting their performance and working to expand their competence as instructors.
The system includes three criteria, which correspond to criteria for faculty rank.  They are professional competence and scholarship, teaching effectiveness, and service to the college and profession (not required for adjuncts).
The following table outlines the variety of resources through which the three criteria for faculty evaluation are evaluated:
Activities Related to Professional Competence/Scholarship, Teaching Effectiveness,
and Service to the College/Profession
Sources of Evaluation Data
Activities
Relationship to Roles
Student Evaluation of Course & Faculty
Midterm Student Evaluations
Student Evaluations at End of Semester
Faculty Response to Student Evaluations
Faculty
Faculty/Dept. Chair
Faculty/ Dept. Chair
Administration Evaluation of Course & Faculty
Review of Course Syllabi and Objectives
Classroom Observation
Performance Appraisals (with faculty response)
Faculty/ Dept. Chair
Faculty/ Dept. Chair
Faculty/ Dept. Chair
Faculty Self Evaluation
Teaching philosophy/portfolio (for promotion only)
Peer mentoring- new faculty by Program Coordinator
Peer mentoring between colleagues (optional)
Faculty
Faculty/ Dept. Chair Faculty
Evaluation Materials
Copies of the
Faculty Performance Appraisal- Department Chair Evaluation
,
Student Evaluation Form
,
Faculty Response to Student Evaluation Data
,
Classroom Observation Form
,
and
Midterm Faculty Evaluation Form
can be found in the Appendix.
In addition to the aforementioned vehicles of evaluation, students in field placements evaluate their University Supervisor using the
University Supervisor Evaluation Form
.
d.
Document how the evaluative process is used to identify strengths and limitations and how it is incorporated in specific procedures for improvement.
Table of Contents
Response:
Using the
Faculty Performance Appraisal Form
, faculty members rate themselves and are rated by the Department Chair as exceeding, meeting, or falling below a number of performance areas, thereby helping to identify strengths and limitations. Specific techniques for improving areas of limitation are discussed in individual meetings with the Department Chair and documented as recommendations which are reviewed annually.
For each course taught by a faculty member, final student evaluations serve as another method for identifying strengths and limitations in such areas as methods, style and practice of instruction, and course content. Faculty members are required to respond to the student evaluation data by identifying strengths, concerns, and intended corrective actions.  This process encourages reflection on, and incorporation of, specific procedures for improvement. See
Faculty Response to Student Evaluation Data Form
.
In addition, students evaluate faculty members at midterm. This information is valuable to faculty members in adjusting instruction to meet the needs of students in each of their classes.
Midterm evaluations
are reviewed solely by each faculty member.
e.
Describe how faculty and staff are provided opportunities for relevant professional development.
Table of Contents
Response:
A number of opportunities exist to promote faculty professional development, including programs through Human Resources and initiatives within Academic Affairs. Faculty research is supported through the
Office of Sponsored Programs and Research
which provides funding for attending and presenting at conferences, grant writing and publishing workshops, hosts a summer writers retreat (which has been attended by faculty in the department), a winter writing workshop, and provides research and scholarship grants. A faculty development initiative with Academic Affairs hosts electronic training workshops (Blackboard, Hoonuit, Office 365, etc.), provides diversity and inclusion resources, and compiles information on teaching strategies and supporting students. A regular interdisciplinary speakers series within the School of Humanities and Social Sciences provides faculty with opportunities to discuss cogent issues across disciplines. The Human Resources office regularly holds professional development workshops on a variety of topics, including a faculty interactive workshop series, sessions on creativity, conflict, leadership, and supporting students.
Funding for faculty conference attendance.
Full-time faculty members are eligible to receive funding to either attend or participate in professional conferences and also to conduct research.  Part-time faculty members are eligible to receive funding only if they are presenting at a professional conference.  Funds may be requested for conferences, conventions, or workshops. There is no geographic limit on the requests that may be considered.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[6][a].supportingEvidenceText`):

##### Evidence 1 — 🟢 **conf 0.92** &nbsp;words 845 &nbsp; `auto_accept`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This curriculum vitae documents faculty education (Ed.D., M.S.W., B.A.) and extensive human services experience (school social work, clinical therapy, university supervision, teaching), directly satisfying Standard 6.a's requirement to include vitae demonstrating faculty education in various disciplines and experience in human services or related fields.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 6.a — Credentials of Human Services Faculty

Education
2008-2012            Nova Southeastern University             Ft. Lauderdale, FL  Fischler School of Education and Human Services                      Dissertation: Program Evaluation of a Social-Emotional Learning Program at a Summer Camp for Children Experiencing Homelessness
Doctor of Education      Concentration- Special Education
1996 - 1998	University of Maryland at Baltimore          Baltimore, MD
Masters in Social Work      Concentration- Clinical- Mental Health
1988-1991            Syracuse University                                 Syracuse, NY
Bachelors of Arts    Majors- Non-Violent Conflict and Change/ History
Professional experience
2005– present	Stevenson University	Stevenson, MD
Adjunct Professor
Instruct undergraduate courses in the human services, education and psychology departments. Courses taught include Counseling Strategies for Individuals, Child Development and Introduction to Human Services.
2000– present	Baltimore County Public Schools	Baltimore, MD
School Social Worker
Provide individual, family and group psychotherapy to students with emotional and behavioral challenges.  Provide consultation in the development and refinement programs to address students’ social emotional development.  Develop individualized plans to help faculty meet the needs of students with behavioral and mental health issues including ADHD, Depression, Mood Disorders, and Oppositional Defiant Disorder.   Counsel students with issues such as eating disorders, identity issues, relationship issues, depression, suicidal ideation, alcohol and other drugs, and time and stress management. Coordinate family engagement activities such as an annual resource fair, family fun nights, and family workshops.
2012	Stevenson University	Stevenson, MD
University Supervisor, Human Services Department
Oversee the learning experience of human service students in their practicum placements. Conduct site-visits to assess the placement environment, collaborate with the field instructor, and ensure that student and field instructor are effectively communicating. Assist students and field instructors in troubleshooting challenges in the field placement. Encourage student reflection through monitoring of weekly journals. Dialog with student and field instructor to ensure optimal learning experience. Evaluate students in collaboration with field instructors.
1999– 2000	KidsPeace	Orfield, PA
Clinical Social Worker
Provided individual, group and family therapy in an acute in-patient psychiatric hospital setting.  Created Treatment Plans to help clients and their families overcome crisis.  Coordinated with local mental health agencies to ensure that patients had appropriate support once they were discharged from hospital care.
1998-1999	Baltimore County Public Schools	Baltimore, MD
School Social Worker, Chesapeake High School
Provided School Social Work services to students at Chesapeake High School in Baltimore County.  Coordinated Pregnant and Parenting Teens program to assist young mothers in completing their high school degrees.  Provided weekly psycho-educational groups to students.  Provided individual and group psychotherapy.  Increased parent involvement.  Provided consultation to staff.  Linked students and their families to outside resources.  Liaison with community based programs.  Assisted with occupational preparation programs to bring resources to students.
1995-1997	Baltimore County Public Schools	Baltimore, MD
Resource Teacher, Deep Creek Middle School and Kenwood High School
Coordinated a program for Pregnant and Parenting Teens which included overseeing the operations of the school based daycare center, monitoring progress of pregnant and parenting teens in the school setting as well as linking teens with outside agencies.  Directed in-school peer mediation program.  Created school-wide programs to improve student attendance as well as worked with individual students and their families to address barriers to regular school attendance.
1994-1995	South Carolina Youth Advocate Program	Columbia, SC
Intake Coordinator
Developed and refined therapeutic foster care, respite care, and family preservation programs for statewide agency.  Acted as liaison between SCYAP and funding agencies.  Screened potential clients, assessed their needs, and then matched them with appropriate service providers.
1991-1994	Catholic Charities of Delaware and Otsego Co. 	Delhi, NY
Supervisor, Adolescent Care Specialists
Supervised a staff that works with teenagers at risk of being placed in foster care. Worked directly with adolescents to help build their self-esteem and develop age appropriate social behaviors.
Presentations and trainings
Finkenberg, Mayaugust (2013).
Addressing the Needs of Homeless Children in School; How schools and educators can help children overcome adversity.
Workshop presented at the Baldwin Community Day at Notre Dame of Maryland University. Baltimore, MD.
Finkenberg, Mayaugust (2013).
Promoting Resiliency Skills in Children Experiencing Homelessness; An action research model for program development, refinement and evaluation.
Paper presentation at the Action Research Network of the Americas Conference. San Francisco, CA.
Finkenberg, Mayaugust (2012 and 2011
). Integrating Character Education into a Summer Learning Program.
A training presented to administrators and staff at SuperKids Camp, Parks and People Foundation.
Finkenberg, Mayaugust (2011).
Social Emotional Learning: The new direction of character education programming.
Maryland Center for Character Education Annual Conference.
Finkenberg, Mayaugust (2011).
Skills for Camp Counselors to promote Resiliency in Homeless Children.
A workshop presented to administrators and staff at St. Vincent’s de Paul.
Finkenberg, Mayaugust (2011).
The Importance of Summer Learning Opportunities for Children in Poverty.
Presented to Baltimore County Department of Student Support Services.
Finkenberg, Mayaugust (2011).
Embracing Diversity: Breaking down barriers to promote healthy staff and student relationships.
A workshop presented to administrators and staff at SuperKids Camp, Parks and People Foundation.
Professional memberships
National Association of Social Workers (NASW)
National Education Association (NEA)
Teachers Association of Baltimore County (TABCO)
School Social Work in Maryland (SSWIM)
Certifications
Certified School Social Worker through the Maryland State Department of Education
Licensed Certified Social Worker-Clinical through the Maryland Board of Social Work Examiners

```

##### Evidence 2 — 🔵 **conf 0.42** &nbsp;words 65 &nbsp; `review_low_confidence`

_Source heading from doc:_ **H.         Termination.  This Agreement may be terminated by either party upon giving written notice of such intent to t**

_AI rationale:_ This section describes termination procedures for an education program agreement with protections for enrolled students. While the highest embedding matches relate to student policies and procedures (Standard 5), the content itself is primarily a contractual/institutional governance document addressing program continuation and student protections—aligning best with Standard 6 (Governance and Administration) specifications on institutional policies. The student-protection clause is secondary to the termination agreement itself.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 6.a — Credentials of Human Services Faculty

H.         Termination.  This Agreement may be terminated by either party upon giving written notice of such intent to the other party as designated in F., above, by Certified or Registered Mail, Return Receipt Requested, at least thirty (30) days prior to the date of such termination.  Such termination shall not affect students currently enrolled in the Education Program, subject to the stipulations of II.A.4, above.

```

---

## Standard 7

### `7.a` 🔴 no match — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Document that faculty have the ultimate responsibility for setting policies and determining the content, implementation, and evaluation of the curriculum._

**→ Imported as NARRATIVE** (`narratives[7][a].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[7][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `7.b` 🔴 no match — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Essential program roles include administration, curriculum development and review, instruction, field supervision, program planning, program evaluation, student advising, and student evaluation. Provide the following: 1. A brief description of how these essential roles are fulfilled in the program 2. A table matching faculty and staff positions and names with these roles._

**→ Imported as NARRATIVE** (`narratives[7][b].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[7][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `7.c` 🟠 evidence-only — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Describe the process for faculty and staff evaluation. Documentation may come from a variety of sources and may include, among others, student evaluations, administrative review, comments from field placement agencies, and peer review._

**→ Imported as NARRATIVE** (`narratives[7][c].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[7][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.68** &nbsp;words 87 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This student evaluation survey of university supervisor performance is supporting evidence for faculty and staff evaluation processes (7.c), as it documents a systematic evaluation method that feeds into personnel assessment. The instrument includes items on site visits and support that tangentially address 21.j, but the primary purpose is evaluative feedback on faculty performance.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 7.c — Personnel Roles, Responsibilities, and Evaluation

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

##### Evidence 2 — 🔵 **conf 0.51** &nbsp;words 55 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The following signatures verify that a conference has taken place between the faculty member and the supervisor. These s**

_AI rationale:_ This section describes a faculty evaluation process involving conferences and documented signatures between faculty and supervisors, which aligns with Standard 7.c's requirement to describe the process for faculty and staff evaluation. While the language about written agreements and signatures could suggest field placement documentation (21.e), the content focuses on employee evaluation procedures rather than student learning agreements.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 7.c — Personnel Roles, Responsibilities, and Evaluation

The following signatures verify that a conference has taken place between the faculty member and the supervisor. These signatures do not necessarily certify that the employee agrees with the final evaluation score or all evaluation items. However, the faculty has the right to make written comments in this regard as seen in the section above.

```

---

### `7.d` 🟠 evidence-only — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Document how the evaluative process is used to identify strengths and limitations and how it is incorporated in specific procedures for improvement._

**→ Imported as NARRATIVE** (`narratives[7][d].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[7][d].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.62** &nbsp;words 80 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This table documents rater evaluation scores for student performance across professional competencies (goal development, professional attitudes, application of concepts). Standard 7.d addresses how evaluative processes identify strengths/limitations and drive improvement, which directly aligns with this structured performance assessment data.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 7.d — Personnel Roles, Responsibilities, and Evaluation

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

---

### `7.e` 🔴 no match — Personnel Roles, Responsibilities, and Evaluation

**Spec prompt:** _Describe how faculty and staff are provided opportunities for relevant professional development._

**→ Imported as NARRATIVE** (`narratives[7][e].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[7][e].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 8

### `8.a` 🟢 has narrative — Cultural Competence

**Spec prompt:** _Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff_

**→ Imported as NARRATIVE** (`narratives[8][a].content`):

##### Match 1 — 🟢 **conf 0.88** &nbsp;words 390 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly addresses how the program includes cultural competence in policies, procedures, and practices, and describes cultural competence training for faculty and staff. This matches Standard 8.a's requirement to demonstrate intercultural fluency and accessibility in program policies/procedures and faculty/staff training.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Demonstrate how the program Includes cultural competence in program policies, procedures, and practices.Table of ContentsResponse: Cultural competence is deeply embedded in the Counseling & Human Services program and throughout Stevenson University. One of the campus leaders in cultural competence issues, Lauri Weiner, is a full-time faculty member in the department. She teaches the required course CHS 220 Diversity and Cultural Competence, serves on a college-wide diversity task force, and has facilitated or co-led an ongoing series of faculty/student conversations on diversity for the past several years. Cultural competence is #4 of the six program outcomes. Professional expectations are emphasized throughout the program, but are included as prerequisites for participation in field experiences. These expectations explicitly include culturally sensitive behavior (item #1), as described in the student handbook. As indicated below, cultural competence skills are emphasized in multiple ways throughout the program and students are provided opportunities to develop and practice these skills. If a student continues to violate these expectations after repeated attempts to remediate the issue, this can be a basis for removal from the program (see Standard 5c and d). Includes cultural competence training for faculty and staffResponse: Institutionally, Stevenson University is committed to promoting cultural awareness and sensitivity in students, faculty and staff. A college-wide taskforce is working on developing systematic requirements for faculty to engage in cultural competence training. Currently, participation in training opportunities is voluntary. Through Academic Affairs Faculty Development, Diversity and Inclusion resources are available to faculty, including programs on Inclusivity in the Classroom, Language Variation in the Classroom, Confronting the Lies I Tell Myself, and a Peer Mentoring program for faculty. Human Resources offers periodic trainings related to diversity and cultural competence for the college community. Within the Counseling & Human Services Department, monthly faculty meetings regularly include discussions of student issues, which frequently relate to diversity and cultural competence issues. These regular discussions help to keep faculty attuned to these issues and give us an opportunity to have important conversations within the department. Prof. Weiner co-facilitates the “Conversations on Diversity” series, which involves 2-3 meetings each semester. These sessions typically include students, and are also an opportunity for faculty within the School of Humanities and Social Sciences to engage in conversations on a selected aspect of diversity. Most faculty in the Counseling & Human Services department have participated in these discussions regularly.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect and practice at every le**

_AI rationale:_ This institutional commitment statement demonstrates how the program integrates intercultural fluency and accessibility principles into program policies, procedures, and organizational practices—the core of Standard 8.a. The narrative articulates organizational-level commitment to diversity and inclusive climate that supports faculty, staff, and student development.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This institutional commitment statement directly addresses how the program includes intercultural fluency and accessibility principles in organizational policies, procedures, and practices across all levels—the core requirement of Standard 8.a. While it frames diversity at the organizational level rather than faculty/staff training specifically, it most closely maps to the program-wide policy and practice dimension of 8.a.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This narrative articulates the institution's commitment to diversity, intercultural fluency, and inclusive organizational climate, which directly addresses Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This narrative describes the institution's commitment to diversity, intercultural fluency, and inclusive organizational climate in program policies and practices, which directly aligns with Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in policies, procedures, and practices.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This institutional commitment statement directly addresses how the program includes intercultural fluency and accessibility principles in organizational policies, procedures, and practices—the core language of Standard 8.a. The emphasis on diversity awareness, education, respect, and inclusive organizational climate aligns with program-level cultural competence infrastructure.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 7 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This passage articulates the university's organizational commitment to diversity, intercultural fluency, and inclusive practices across policies and procedures, directly addressing Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 8 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This section articulates the institution's commitment to diversity, intercultural fluency, and inclusive organizational practices across policies and procedures, which directly addresses Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 9 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ The narrative articulates institutional commitment to diversity, inclusion, and intercultural awareness across all organizational levels and policies, directly addressing Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 10 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ The section articulates the university's commitment to diversity, inclusion, and intercultural fluency as an organizational value and practice, directly addressing how the program includes intercultural fluency and accessibility principles in program policies and organizational climate (Standard 8.a). It also supports 8.b by framing awareness and respect for diverse identities and perspectives.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 11 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every l**

_AI rationale:_ This section articulates the program's institutional commitment to diversity, intercultural fluency, and inclusive practices across the organization—directly addressing Standard 8.a's requirement to demonstrate how the program includes intercultural fluency and accessibility principles in program policies, procedures, and practices.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
Stevenson University commits itself to diversity as it relates to awareness, education, respect, and practice at every level of the organization. The University embraces people of all backgrounds, defined by, but not limited to, ethnicity, culture, race, gender, class, religion, nationality, sexual orientation, gender identity or expression, age, physical ability, learning styles, and political perspectives. The University believes its core values are strengthened when all of its members have voice and representation. The resulting inclusive organizational climate promotes the development of broad-minded members of the University who positively influence their local and global communities.

```

##### Match 12 — 🔵 **conf 0.62** &nbsp;words 82 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The Human Services Club is very active on Stevenson's campus.  The Club sponsors a variety of special charitable, educat**

_AI rationale:_ This section describes co-curricular student engagement, community service activities, and professional development opportunities (guest speakers from graduate programs), which best align with Standard 8.a (Student Development), specifically the application of knowledge and skills in community-based settings and professional socialization. The activities demonstrate practical engagement consistent with human services values and field exposure.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.a — Cultural Competence

Prompt: Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff

Response:
The Human Services Club is very active on Stevenson's campus.  The Club sponsors a variety of special charitable, educational, and social activities.  Students participate in several service projects that benefit people in need, such as dinners at the Children’s House, the Villa Maria Fair, and the “Port to Fort Walk/Run,” which aided the Believe in Tomorrow Foundation. The Club invites speakers such as admissions officers from graduate departments in counseling and social work, and hosts social gatherings like the annual "Holiday Party."

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[8][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `8.b` 🟢 has narrative — Cultural Competence

**Spec prompt:** _Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture._

**→ Imported as NARRATIVE** (`narratives[8][b].content`):

##### Match 1 — 🟢 **conf 0.91** &nbsp;words 325 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses Standard 8.b's requirement to demonstrate how the curriculum integrates culturally and inclusively appropriate standards, including student self-awareness of culture, biases, and prejudice, and development of awareness, knowledge, and skills of intercultural fluency. The narrative provides specific course examples and assignments that satisfy all enumerated elements of the spec.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
Demonstrate how the curriculum integrates cultural competence:Includes but is not limited to student self-awareness of own culture, biases, prejudice, and belief systems and stereotyping.Table of ContentsResponse: The curriculum includes CHS 220 Diversity and Cultural Competence as a required course. As part of this course, students complete a cultural autobiography and write three response papers that require reflection on their own cultural beliefs and experiences and how they affect their perception of the world. This emphasis on cultural self-reflection is introduced in the First Year Seminar (a 1-credit course required of entering freshmen) and carried throughout the curriculum. For example, in the capstone clinical skills course CHS 430 Family Dynamics and Interventions, students complete a detailed family of origin assignment that requires them to think deeply about their own family/cultural experiences and how those experiences have affected their perceptions and attitudes. Self-awareness is a key part of the program outcomes (see #6). Includes the development of awareness, knowledge, and skills of diversity and culture.Response: Awareness and knowledge of diversity and culture are integrated throughout the curriculum, as described above. Another good example of the incorporation of cultural issues is in CHS 101 Family Studies, which is focused on the diversity of family structures and includes an assignment asking students to research and report on multiple facets of a controversial issue. Skills are developed through the application of knowledge in the field experience courses, CHS 380 Internship and CHS 440 Practicum. In these courses, students work closely with on-site supervisors and with faculty to practice and improve their skills. As indicated in the field placement evaluation, which is completed as a self-evaluation by students and as a formal evaluation by supervisors both in the middle and end of both experiences, both self-reflection and culturally appropriate behaviors are strongly emphasized (see particularly sections IV and II). Students also practice culturally appropriate strategies through role-playing exercises in both the group and individual counseling courses (CHS 315 and CHS 360).

```

##### Match 2 — 🟡 **conf 0.87** &nbsp;words 520 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses how the curriculum integrates culturally and inclusively appropriate standards, including student self-awareness of culture and biases, development of intercultural awareness and skills across multiple courses—all core elements of Standard 8.b on Cultural Competence.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
Awareness of diversity.Response:Awareness of diversity is emphasized throughout the Counseling & Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 101, 105, 220, 224, 315/515, 360, 430, 380, 440 and 441.Course objective 4 of CHS 101 Family Studies requires that each student be able to “articulate the diversity of family life issues both domestically and internationally. Diversity issues are addressed throughout the course and specifically in the assigned reading, lecture, media presentations, and class discussions. See particularly units on gender, selecting a partner, and same sex couples.Awareness of diversity is addressed through readings, lectures, and discussions in CHS 105. Included in the CHS 105 Human Services and Social Policy course objectives is the objective that the students “articulate how diversity among individuals, families, and communities may affect the delivery of human services” (# 3).  In addition, awareness of diversity is explored through assigned readings, lecture, and in-class activities (units on special groups in need of services and multi-cultural issues). CHS 220 Diversity and Cultural Competence is devoted primarily to an awareness of diversity. See all course objectives, the course schedule, and group presentation and immigrant interview assignments. In CHS 224 Research Methods and Writing, students learn about the role of diversity in social science research (see weeks 2, 4 and the unit on comparative research in week 12). Students develop a detailed research proposal that includes a consideration of diversity in the research design. An awareness of diversity is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objectives 1 and 4 and schedule); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models, family of origin project, and Course Objective 5 “demonstrate sensitivity to differences in family structure and social, economic and cultural background”).  CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which an awareness of diversity is a primary objective. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific culturally sensitive behavior (See Student Field Placement Evaluation, Section IV). Objective 4 of the CHS 380 course is that the students “demonstrate sensitivity to diversity.” Students in the CHS 380 course use journaling, portfolios, and a substantial Reflection Paper which incorporates several self-assessment tools to broaden and explore their awareness of diversity (Course Requirements 3, 4, and 5).  The journaling and reflection papers in CHS 440 and 441, as well as the seminar discussions (“Understanding Yourself”), readings, issue presentation, lecture, and poster presentation are all designed to help students increase their awareness of diversity.An emphasis on the worth and uniqueness of individuals is also stressed in PSY 108, and SOC 101, required courses in other departments. The topic is taught through in-class activity and discussion, in-class media presentation, lecture, assigned readings, and out-of-class assignments.

```

##### Match 3 — 🟡 **conf 0.79** &nbsp;words 63 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **H. Cultural Competence**

_AI rationale:_ The section directly addresses curriculum integration of cultural competence, self-awareness of bias and beliefs, and development of intercultural fluency and cultural knowledge/skills, which align most closely with Standard 8.b's specification for curriculum integration. Standard 8.a is a near-equal alternate as the program statement mentions fostering competence through 'program characteristics, curriculum, and fieldwork,' touching both specs.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
Context: To ensure the program is effective in producing culturally competent professionals who possess high level of self-awareness, knowledge, and skills in the complexities of multiculturalism.  This encompasses the individual, family, and group levels as well as agency/organizational, community, and globally.

Standard 8: The program shall foster the development of culturally competent professionals through program characteristics, curriculum, and fieldwork.

Specifications for Standard 8:

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 67 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will choose a nation to study in-depth.  Students will examine how people from that nation or similar natio**

_AI rationale:_ The assignment directly addresses culturally inclusive curriculum by requiring students to examine stereotypes and media representations of specific cultural groups, while also developing awareness of services available to those populations—aligning with Standard 8.b's requirement to integrate awareness and knowledge of intercultural fluency and culture.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
Each student will choose a nation to study in-depth.  Students will examine how people from that nation or similar nations are presented in the media including news, television and movies.  Students will prepare a list of services available for that group to be given out during the presentation.  One copy of the team presentation will be provided to the instructor, and individually written reports will be submitted.

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 122 &nbsp; `review_low_confidence`

_Source heading from doc:_ **We live in a modern world, and yet, some of our beliefs and practices regarding race reveal that our world may not be as**

_AI rationale:_ The section addresses student self-awareness of biases, prejudice, and belief systems regarding race and racism—directly matching Standard 8.b's requirement that curriculum includes student self-awareness of culture, biases, prejudice, and belief systems, and stereotyping.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
We live in a modern world, and yet, some of our beliefs and practices regarding race reveal that our world may not be as developed as we would like. Looking at Baltimore City specifically, Freddie Gray is the perfect example that racism still exists in our society today. Racial profiling is common enough in our society that the term “Driving While Black” or DWB is used to address being pulled over by police officers for no apparent reason. Robin DiAngelo, through her presentation “Deconstructing White Privilege,” discusses racism in our society through her “white experience”; while informative about bias, racism and white superiority, she fails to address what we, as a society or as individuals, can do outside of recognition of racism.

```

##### Match 6 — 🔵 **conf 0.68** &nbsp;words 77 &nbsp; `review_low_confidence`

_Source heading from doc:_ **COURSE GROUND RULES:  Students will be exposed to different realities, opinions and perspectives with which you may be u**

_AI rationale:_ The section's primary focus is establishing classroom ground rules that address student self-awareness of biases, respectful engagement with diverse perspectives, and critical thinking about diversity—directly aligning with Standard 8.b's requirement to demonstrate curriculum integration of cultural competence including self-awareness of biases and intercultural fluency. The confidentiality statement is secondary to this primary educational intention.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
COURSE GROUND RULES:  Students will be exposed to different realities, opinions and perspectives with which you may be uncomfortable or disagree.  The class readings, assignments and discussions will require you to think critically about various aspects of diversity and may challenge some of your values and beliefs.  It is important to treat each other with respect, to listen to other points of view, and to question others in an appropriate manner. Information shared in class is confidential.

```

##### Match 7 — 🔵 **conf 0.68** &nbsp;words 112 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Robin DiAngelo opens a dialogue about the rampant and obvious racism that occurs in our society but misses the mark when**

_AI rationale:_ The passage critiques a presentation on implicit bias and racism, directly engaging with curriculum content about student self-awareness of biases, prejudice, and belief systems—core elements of Standard 8.b's requirement for student self-awareness development within culturally inclusive curriculum.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
Robin DiAngelo opens a dialogue about the rampant and obvious racism that occurs in our society but misses the mark when it comes to clarifying meaning. When the video ends, the viewer is left with more questions about their implicit bias and how to assess themselves and others. The presentation opens a can of worms, failing to discuss a solution as to how this can be fixed in our society. The apparent answer seems to be that it will take multiple generations before racism is truly less of a problem than it is now. But again, DiAngelo misses the mark on a full explanation of the purpose outside of recognizing the problem.

```

##### Match 8 — 🔵 **conf 0.52** &nbsp;words 180 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Although South Korea is fond, as well as welcoming when it comes to differing religions and customs, when it comes to di**

_AI rationale:_ The section discusses cultural competence challenges, discrimination, biases, and ethno-national homogeneity in South Korea as a case study of intercultural fluency gaps. This addresses Standard 8.b's curriculum integration of culturally appropriate standards including awareness of biases, prejudice, and belief systems.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
Although South Korea is fond, as well as welcoming when it comes to differing religions and customs, when it comes to diversity, they have a bit of a challenge with cultural competence. In fact many South Koreans have complained of the “growing intolerance” towards foreigners, going as far as to having “Korean-only” bars, which sparked outrage in the society (Meinecke, 2016). This discriminatory behavior is still occurring in the country because there are no anti-discriminatory laws in place to protect foreigners from discrimination itself, and efforts to change this have failed (Meinecke, 2016). Ethno-national and linguistic homogeneity have been the norm for South Korea for many years, and it is going to be rather difficult to change that. They have always, ever since Korea was founded 5,000 years ago, been a “one race”, “one blood country”, and they have taken great pride in that fact (Park, 2017). The government however, is trying to be more tolerant and more exploratory to foreigners in recent years however, as they began exploring the water on immigration primarily focusing on temporary workers (Park, 2017).

```

##### Match 9 — 🔵 **conf 0.42** &nbsp;words 87 &nbsp; `review_low_confidence`

_Source heading from doc:_ **All students who selected a related nation will conduct a seminar presentation for the entire class.  Presentations shou**

_AI rationale:_ The section describes a classroom seminar activity where students present on services and cultural contexts related to different nations/groups, which most directly aligns with Standard 8.b's requirement to demonstrate how the curriculum integrates culturally and inclusively appropriate standards through intercultural awareness and skills development.

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
All students who selected a related nation will conduct a seminar presentation for the entire class.  Presentations should be 30 minutes.  Some class time will be given to help the teams prepare for their presentations, if possible, but time outside of class will also be necessary. A copy of the presentation must be turned in at the beginning of the class.  Students will prepare a list of services that are available to members of the broader group, which that nation represents and hand out during the presentation.

```

##### Match 10 — 🔵 **conf 0.42** &nbsp;words 131 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students who so desire may write a 2-3 page review of the documentary Generation M: Misogyny in Media and Culture.  Your**

_AI rationale:_ This assignment on gender inequality and misogyny in media addresses student self-awareness of biases, prejudice, and belief systems (8.b), though the connection is indirect. The documentary review also relates to assessing quality of video information (14.b) and reflection on professional self through critical analysis (20.e).

**Exact text that will be written to the narrative slot:**

```text
Standard 8.b — Cultural Competence

Prompt: Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture.

Response:
Students who so desire may write a 2-3 page review of the documentary Generation M: Misogyny in Media and Culture.  Your opening paragraph summarily captures the video’s theme, explains it and states the subthemes under which it is discussed in the video.  Dedicate each subsequent paragraph to each of the subthemes: identify the subtheme and summarize how the video explains or discusses it ensuring that the key points of a subtheme are sufficiently reflected in your summary.  In your final/concluding paragraph, comment critically on the documentary with reference specifically to the video’s theme, highlighting any insights this video affords you on the general topic of gender inequality.  Make sure to correct all spelling and grammatical mistakes in your paper before submission.  Spelling and grammatical mistakes will be penalized with point deduction.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[8][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 9

### `9.a` 🟢 has narrative — Program Support

**Spec prompt:** _Include budgetary information that demonstrates sufficient funding, faculty, and staff to provide an ongoing and stable program._

**→ Imported as NARRATIVE** (`narratives[9][a].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 443 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly responds to the specification requesting budgetary information demonstrating sufficient funding, faculty, and staff to provide an ongoing and stable program. The narrative details the department's annual budget development, allocation across categories, and how expenses support students and community partners.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.a — Program Support

Prompt: Include budgetary information that demonstrates sufficient funding, faculty, and staff to provide an ongoing and stable program.

Response:
Include budgetary information that demonstrates sufficient funding, faculty, and staff to provide an ongoing and stable program. Table of ContentsNOTE: provide the reader both with a program budget and with a description of how to read and interpret it.Response:The budget is developed and proposed annually by the Department Chair and submitted to the Dean of the School of Humanities and Social Sciences.  See the operating budgets for 2018-2019 and for the upcoming year (2019-2020).The total department budget of $8,683.89 has been decreasing for the past few years as part of across-the-board spending reductions. Discretionary spending is allocated among 10 different categories, including professional development, student travel, department events, and gifts to others. Funds can be moved across categories, or into new categories to cover expenses that don’t fit in an existing category. To read the budget, the first column for each line item indicated the amount ‘Budgeted.” The column labeled “Actual” indicates expenses charged to line. The last column is “Funds Available,” which indicates the amount remaining in the line or the amount over the budgeted amount. The FY19 budget shows expenses in two categories (office supplies and printing) that did not have funds allocated to them. At the end of the year, negative balances are reconciled with lines that have a positive balance. For the past several years the department has been able to operate within the overall budget while providing outstanding experiences for students and supporting faculty and community partners (field placement sites). Specific expenses in each of the categories where significant expenditures occurred in this fiscal year are noted below:Salaries PT Student: This line is for hiring a student assistant for the department. We had an assistant for part of the semester, but she was not able to continue due to her scheduling issues, which is why the expenditures are small. Unspent funds from this line cannot be moved to other lines. Student Supplies: This line is books and supplies needed for classrooms. Promotional Give-Aways: Includes printing of departmental brochures and engraved pens.Professional Development: Registration at the annual NOHS conference for faculty.Professional Development Travel: Hotel at travel expenses for faculty at NOHS conference.Students Conference: Student recipients of the Professional Development Award are taken to NOHS conference each year. This line covers travel and registration expenses for the students.Membership: Professional: CSHSE departmental membership and NOHS memberships for faculty.Dept/Div Events: Food: Advisory board breakfasts; honors induction ceremony; graduate luncheons; senior poster session refreshments.Gifts to Others: Field placement supervisors/agencies are given gifts (engraved portable chargers or pen/keychain sets) at the end of each semester as a token of appreciation for working with our students. This also includes engraved business card holders for graduates.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[9][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 113 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(table)**

_AI rationale:_ This is a course syllabus/schedule for a research methods course that covers research ethics (NOHS Ethical Standards, ACA Ethics Code), research planning, literature review, and social science research fundamentals. It is supporting evidence for coursework content addressing Standard 9 (Research and Evaluation), specifically the research ethics, design, and methodology competencies required of human service professionals.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 9.a — Program Support

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

##### Evidence 2 — 🔵 **conf 0.52** &nbsp;words 52 &nbsp; `review_low_confidence`

_Source heading from doc:_ **This award is presented annually to two students who demonstrate academic excellence and a strong commitment to the fiel**

_AI rationale:_ This section describes a student achievement award and professional development opportunity (conference attendance with faculty and peer dissemination). While the embedding matches are weak across all candidates, this narrative best fits Standard 9 (Student Development and Support Services) as evidence of recognizing student excellence and providing professional development experiences, or alternatively Standard 10 (Graduation Requirements) as a co-curricular achievement marker.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 9.a — Program Support

This award is presented annually to two students who demonstrate academic excellence and a strong commitment to the field of human services.  The recipients, accompanied by Human Services Department faculty, attend a national conference for professionals in human services.  Upon their return, they disseminate information about their experience to the Stevenson community.

```

---

### `9.b` 🟢 has narrative — Program Support

**Spec prompt:** _Describe how program and field experience coordination is considered in calculating the teaching loads of faculty. It is recommended that consideration be given to distance between sites, expectations of observation, documentation requirements, number of students enrolled in the field experience, and the characteristics of the student population._

**→ Imported as NARRATIVE** (`narratives[9][b].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 296 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses the specification's prompt to describe how program and field experience coordination is considered in calculating teaching loads, with specific discussion of distance between sites, observation and documentation requirements, and number of students supervised.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.b — Program Support

Prompt: Describe how program and field experience coordination is considered in calculating the teaching loads of faculty. It is recommended that consideration be given to distance between sites, expectations of observation, documentation requirements, number of students enrolled in the field experience, and the characteristics of the student population.

Response:
Describe how program and field experience coordination is considered in calculating the teaching loads of faculty. It is recommended that consideration be given to distance between sites, expectations of observation, documentation requirements, number of students enrolled in the field experience, and the characteristics of the student population.Table of ContentsResponse:Full-time faculty members maintain a twelve credit teaching load per semester.  The Department Chair is released from teaching two courses during the Fall semester and two courses during the Spring semester in order to fulfill the responsibilities of the Department Chair as described in Standard 7.University faculty members responsible for field placements include the University Supervisors and the Field Placement Coordinator.  University Supervisors are adjunct faculty who provide supervision for students in their practicums. These supervisors receive payment based upon the number of students supervised (3-4 students = 1 credit hour), which we (and the supervisors) believe is a reasonable load given the expected observation and documentation requirements.  Distance is a consideration when assigning University Supervisors to students placed at particular sites. See Responsibilities of University Supervisor for Field Placements.The Field Placement Coordinator is a full time faculty member, Dr. Finkenberg who receives a one course equivalency to develop relationships with and visit new agencies, liaise with directors of agencies used previously, conduct classroom and individual meetings with all prospective interns and practicum students, determine and approve eligibility of students for field placements, and ensure appropriate placement assignments for all interns and practicum students. During both Fall and Spring semesters, the Field Placement Coordinator teaches CHS 440 Practicum as part of the teaching load. So teaching responsibilities for the Field Placement Coordinator are: Fall Semester                                         Spring SemesterCHS 440 Practicum                               CHS 440 Practicum2 academic courses                                CHS 380 Internship (usually two sections)                                                              1 academic courseSee Responsibilities of Field Placement Coordinator.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[9][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `9.c` 🟢 has narrative — Program Support

**Spec prompt:** _Describe how the program has adequate professional support staff to meet the needs of students, faculty, and administration._

**→ Imported as NARRATIVE** (`narratives[9][c].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 80 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly describes professional support staff (receptionists, administrative assistant, marketing staff) meeting the needs of students, faculty, and administration, matching Standard 9.c specification language exactly.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.c — Program Support

Prompt: Describe how the program has adequate professional support staff to meet the needs of students, faculty, and administration.

Response:
Describe how the program has adequate professional support staff to meet the needs of students, faculty, and administration.Table of ContentsResponse:Secretarial support for faculty members and for the program is provided by the University receptionists as well as the School of Humanities and Social Sciences’ Administrative Assistant, who has been particularly helpful with producing departmental materials, such as handbooks, certificates, and invitations. The departmental brochure is produced by staff in the Marketing and Digital Communications Department.  Their assistance is greatly appreciated.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[9][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `9.d` 🟢 has narrative — Program Support

**Spec prompt:** _Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration._

**→ Imported as NARRATIVE** (`narratives[9][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 314 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses the specification language 'adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration' by detailing computing facilities, classroom technology, library resources, and office infrastructure.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.Table of ContentsResponse:Technological/Computer Resources Considerable resource support for the program is available through the library, technology, computer labs, classroom technology, and tech support.Stevenson University has 471 computers located in 26 computer labs/spaces across all campus areas. This includes ten Macintosh Labs with a total of 138 Mac’s. The computer lab in the Greenspring library (LRC) accommodates 29 users.  See list of computing facilities.In addition to the computer in each faculty member's office, faculty members have access to computers in every classroom for teaching. Every computer on campus has access to the internet, to the library, and to the campus e-mail system. Through the Library web site, students and faculty can access numerous electronic resources and databases, including program-specific research guides. Videos are available for classroom presentations through Kanopy, a library resource.Every full-time faculty member has a private office which is equipped with a desk, file cabinet(s), telephone, computer, and monitor. Part-time faculty members share office space, desks, and computers.  Additional equipment can be requested through the Facilities Office.Classroom space consists of 42 classrooms, 15 seminar rooms, 1 photography classroom, 1 photo lab, 1 graphic studio, 2 art studios, and 7 science labs. Every classroom has an instructor PC, a permanently mounted video projection system, high speed internet access, and a screen.  Classrooms are typically in excellent 	condition and are maintained by a proficient facilities staff.Library ResourcesThe Stevenson University Library provides comfortable spaces to meet, quiet places to work and study, publicly accessible computers, a wide variety of information resources, and research assistance so users can make the best use of those resources – and their time. Further, digital tools and online reference services make library resources available 24/7. See the library website at http://stevensonlibrary.org/ and a description of Library Resources at Stevenson University.

```

##### Match 2 — 🟢 **conf 0.92** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ This section directly describes library resources, databases, and professional support available to students, which is concrete evidence of adequate resource support (library resources specifically mentioned) under Standard 9.d Program Support.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 3 — 🟢 **conf 0.92** &nbsp;words 65 &nbsp; `auto_accept`

_Source heading from doc:_ **SU Library- The SU Library provides extensive electronic and print resources to support your coursework. Research Guides**

_AI rationale:_ The section directly describes library resources (electronic and print), databases, and professional support services available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support including library resources to meet student needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
SU Library- The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 4 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section describes library resources (electronic, print, databases, tutorials, and professional support) that constitute adequate resource support for students, faculty, and administration, directly addressing Standard 9.d's specification on resource adequacy.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 5 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support available to students, matching Standard 9.d's specification for adequate resource support (library, technology, etc.) to meet student needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 6 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support staff available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support including library services.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 7 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section describes library resources, electronic databases, and professional support services available to students, directly addressing Standard 9.d's requirement to describe adequate resource support (library, technology) to meet student needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 8 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional librarian support available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support (including library) to meet student needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 9 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support services available to students, which directly addresses Standard 9.d's requirement to describe adequate resource support (library, technology, etc.) to meet student needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 10 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ This section directly describes library resources and support services available to students, which exemplifies the 'adequate resource support' requirement in Standard 9.d. While information literacy is tangentially relevant, the primary content is about institutional resource provision.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 11 — 🟢 **conf 0.89** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ This section directly describes library and electronic resource support available to students, matching Standard 9.d's requirement to describe adequate resource support including library resources to meet student needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 12 — 🟢 **conf 0.88** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, electronic databases, and professional support available to students, which exemplifies adequate resource support (technology and library services) required by Standard 9.d Program Support.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 13 — 🟢 **conf 0.88** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library and electronic resources available to support student coursework, which matches Standard 9.d's requirement to describe adequate resource support (library resources specifically cited). While information literacy is mentioned in Standard 14.d, the primary content is institutional resource provision rather than student skill development.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 14 — 🟢 **conf 0.88** &nbsp;words 63 &nbsp; `auto_accept`

_Source heading from doc:_ **The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databas**

_AI rationale:_ The section directly describes library resources, databases, technology, and professional support services available to meet student, faculty, and administrative needs, which aligns precisely with Standard 9.d's requirement to describe adequate resource support including library services.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Match 15 — 🔵 **conf 0.68** &nbsp;words 69 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The Academic Link, nationally certified by the College Reading and Learning Association, serves as Stevenson University’**

_AI rationale:_ The section describes The Academic Link as an institutional resource providing tutoring and academic assistance to support student learning and success. This directly addresses Standard 9.d's requirement to describe adequate resource support (e.g., tutoring, academic assistance services) to meet student needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
The Academic Link, nationally certified by the College Reading and Learning Association, serves as Stevenson University’s tutoring and academic assistance center, offering free tutoring in most courses to all enrolled students.  Students work with dedicated peer and faculty tutors as a team to learn effective study strategies, increase understanding of course content, and become independent learners.  The Link’s web site (http://academiclink.stevensonuniversity.org/) lists many of the services and resources available.

```

##### Match 16 — 🔵 **conf 0.68** &nbsp;words 80 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), pro**

_AI rationale:_ This section describes a specific resource support (the Academic Link tutoring facility and services) that enables students to meet their academic needs, directly addressing Standard 9.d's requirement to describe adequate resource support including technology and support services.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.d — Program Support

Prompt: Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration.

Response:
Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), provides free tutoring for many classes. If you are having difficulty with or would benefit from discussing the material with an upper level peer, seek assistance early in the semester. Tutoring often makes a difference in a student’s grade. To view the tutoring schedule and sign up for an appointment, go to stevenson.go-redrock.com, visit the Link in person, or call 443-394-9300.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[9][d].supportingEvidenceText`):

##### Evidence 1 — 🟢 **conf 0.92** &nbsp;words 66 &nbsp; `auto_accept`

_Source heading from doc:_ **SU Library - The SU Library provides extensive electronic and print resources to support your coursework. Research Guide**

_AI rationale:_ This section directly describes library resources and support services available to students, which exemplifies the 'adequate resource support' language in Standard 9.d. While information literacy is mentioned in Standard 14, the primary focus is on institutional resource provision rather than student competency in information evaluation.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 9.d — Program Support

SU Library - The SU Library provides extensive electronic and print resources to support your coursework. Research Guides and databases can be found on the library home page, as well as brief tutorials to assist you in using these resources. A professional librarian is always available to help you find the best information sources for your needs. For more information about library services, please visit: http://stevenson.libguides.com/stevensonlibrary

```

##### Evidence 2 — 🔵 **conf 0.68** &nbsp;words 80 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), pro**

_AI rationale:_ This section describes an institutional resource (the Academic Link tutoring center) that supports student learning and success. While it mentions referral for academic assistance, the primary focus is the physical facility and support resource itself, which aligns best with Standard 9.d's specification for adequate resource support including technology and support services to meet student needs.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 9.d — Program Support

Academic LinkThe John L. Stasiak Academic Link, located on Owings Mills in the Center for Student Success (GHS 101), provides free tutoring for many classes. If you are having difficulty with or would benefit from discussing the material with an upper level peer, seek assistance early in the semester. Tutoring often makes a difference in a student’s grade. To view the tutoring schedule and sign up for an appointment, go to stevenson.go-redrock.com, visit the Link in person, or call 443-394-9300.

```

---

### `9.e` 🟢 has narrative — Program Support

**Spec prompt:** _Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration._

**→ Imported as NARRATIVE** (`narratives[9][e].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 240 &nbsp; `auto_accept`

_Source heading from doc:_ **e.**

_AI rationale:_ The section directly addresses the exact language of Standard 9.e, describing office spaces (faculty private offices), classroom facilities, meeting spaces (conference rooms, faculty lounge), and informal gathering spaces (lounge areas, Learning Commons) and how they meet student, faculty, and administration needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.e — Program Support

Prompt: Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration.

Response:
Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration.Table of ContentsResponse:Stevenson University has two campuses. The original campus is located in Stevenson, Maryland, and the second is in Owings Mills, Maryland, about a 12 minute drive with free shuttle service connecting the campuses.  Program offices, staff support, and full-time human services faculty are housed on the Owings Mills (North) Campus. In addition, almost all Program courses are taught on the Owings Mills Campus.  Consequently, the descriptions contained herein are related to the Owings Mills campus. Every full-time faculty member has a private office which is equipped with a desk, file cabinet(s), telephone, 	computer, and 	monitor.  The program has access to two large conference rooms overseen by the School of the Sciences, a spacious faculty lounge, and a workroom/mailroom with a printing/scanning/copying machine.  Students have numerous areas for academic study at tables located near departmental offices and in the Learning Commons (part of the library system) on the third floor of the Manning Academic Center. Several computer labs are available. Classrooms are equipped with technology and equipment permitting the use of PowerPoint, projected computer displays, videos, overheads, audios, and large dry-erase boards. Classrooms for semester use are always available with adequate and comfortable seating for students.Lounge areas are available for both faculty and students.  In addition, the University maintains two cafeterias, other food hubs, gyms, physical fitness equipment, and other amenities.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 85 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Classrooms seem to be working effectively, despite a few adjustments. Students (and faculty) are finding their way aroun**

_AI rationale:_ The narrative directly addresses classroom spaces, physical facilities (new building), and informal gathering spaces (bulletin board outside faculty offices) and how they are being utilized by students and faculty, matching Standard 9.e's prompt to describe office, classroom, and informal gathering spaces and their adequacy.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.e — Program Support

Prompt: Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration.

Response:
Classrooms seem to be working effectively, despite a few adjustments. Students (and faculty) are finding their way around the new building. We discussed use of OneDrive to access, store and download/upload files. John asked if there were supply needs, since we need to get our own now (Carol mentioned gradebooks). We discussed ideas for the bulletin board outside of faculty offices – ideas included: current events “In the News”, a list of field placement and employment sites, Ecuador pictures and other pictures of departmental events.

```

##### Match 3 — 🔵 **conf 0.42** &nbsp;words 70 &nbsp; `review_low_confidence`

_Source heading from doc:_ **This class works best when you are here.  The Lab component in particular is accomplished in real time and much of the a**

_AI rationale:_ The section addresses in-person classroom and lab space usage and accessibility for students, which relates to Standard 9.e's requirement to describe how office, classroom, and informal spaces meet student needs. The content emphasizes the importance of physical presence for lab completion and TA support.

**Exact text that will be written to the narrative slot:**

```text
Standard 9.e — Program Support

Prompt: Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration.

Response:
This class works best when you are here.  The Lab component in particular is accomplished in real time and much of the activity can be completed in the assigned time.  Missing the Lab will almost certainly delay your progress.  The TA’s are available to help you in that time, and can assist at other times at their discretion. I generally know when you are here and when you are not.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[9][e].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.42** &nbsp;words 100 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Classroom Policies: I prefer to talk to you in person about any ideas or issues you may have, so please visit my office **

_AI rationale:_ This excerpt is a syllabus policy statement describing classroom communication, office accessibility, and use of learning platforms. While marginally related to student support referral (5.b) or grievance procedures (5.c), it best fits Standard 9.e as documentation of how faculty use office and meeting spaces and institutional systems to support student needs.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 9.e — Program Support

Classroom Policies: I prefer to talk to you in person about any ideas or issues you may have, so please visit my office hours or schedule an appointment to meet with me! If you miss class, please get notes from a classmate and then meet with me to discuss anything you don’t understand from those notes.  I will often correspond with you through campus email or Blackboard announcements. Please become familiar with how to log on to both systems and check your email regularly. Class changes and updates will be posted in Blackboard and sent to your Stevenson email address.

```

---

## Standard 10

### `10.a` 🟢 has narrative — Evaluation of Transfer Credits and Prior Learning

**Spec prompt:** _Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning._

**→ Imported as NARRATIVE** (`narratives[10][a].content`):

##### Match 1 — 🔵 **conf 0.72** &nbsp;words 55 &nbsp; `review_low_confidence`

_Source heading from doc:_ **70 credits that will be accepted by Stevenson University toward degree requirements. An appropriate score is determined **

_AI rationale:_ The section describes formal policies and procedures for transfer of credits and evaluation of prior learning (e.g., which credits transfer, which do not, and how students must submit documentation), directly addressing Standard 10.a's requirement to describe transfer and prior learning evaluation processes.

**Exact text that will be written to the narrative slot:**

```text
Standard 10.a — Evaluation of Transfer Credits and Prior Learning

Prompt: Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning.

Response:
70 credits that will be accepted by Stevenson University toward degree requirements. An appropriate score is determined by Stevenson University, and the student must submit original test scores/results to Stevenson University.  Tech Prep credits will not transfer. Credit awarded for experiential learning ("life experience") is not recognized by, and is not transferrable to, Stevenson University.

```

##### Match 2 — 🔵 **conf 0.68** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The agreement may be terminated by either party for due cause and after adequate notice to the other.  Termination of th**

_AI rationale:_ The section describes policies governing transfer of credits and articulation agreements between institutions, which directly addresses Standard 10.a's requirement for formal policies and procedures for transfer of credits. The mention of student credit transfer upon program termination is a procedural safeguard related to transfer policy.

**Exact text that will be written to the narrative slot:**

```text
Standard 10.a — Evaluation of Transfer Credits and Prior Learning

Prompt: Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning.

Response:
The agreement may be terminated by either party for due cause and after adequate notice to the other.  Termination of the agreement will not affect any students currently enrolled at The Community College of Baltimore County in the Human Services major at the time of termination, and they shall be able to transfer credits pursuant to this agreement.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[10][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `10.b` 🟢 has narrative — Evaluation of Transfer Credits and Prior Learning

**Spec prompt:** _Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE_

**→ Imported as NARRATIVE** (`narratives[10][b].content`):

##### Match 1 — 🟡 **conf 0.92** &nbsp;words 669 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly describes formal policies and procedures for transfer of credits (regional accreditation, grade requirements, course equivalencies, CLEP, IB) and evaluation of prior learning (internship waiver with portfolio/recommendation documentation), which aligns precisely with Standard 10.b's requirement to describe how students receive transfer and prior learning credit information.

**Exact text that will be written to the narrative slot:**

```text
Standard 10.b — Evaluation of Transfer Credits and Prior Learning

Prompt: Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE

Response:
Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning.Table of ContentsResponse: Transfer credits from other regionally accredited colleges are accepted through the SU registrar’s office. Course equivalencies for Maryland colleges are determined through the ArtSys database and in consultation with the department chair. A grade of C or better is required for a course to transfer. The department chair makes determinations about what program requirements are fulfilled by transfer courses and substitutions may be made as appropriate. See formal articulation agreements below. One course in the Program, CHS 380 (Internship in Counseling & Human Services), may be waived if the student provides evidence of the successful completion of a minimum of two years full-time employment in a human services agency.  The student must submit the following documentation for approval:  (1) Professional Portfolio and (2) Letter of Recommendation from the supervisor at the agency. The documentation will be evaluated by the Department Chair and the Field Placement Coordinator.  No other required human services courses in the Program may be waived.The University participates in College Level Examination Program (CLEP), which allows students to take a CLEP exam to earn credits at Stevenson. The University grants credit to SU students earning Stevenson University designated passing scores on CLEP exams.  For further information regarding acceptable exams, please review the Stevenson University CLEP Manual available on the Transfer Credit Center page of the website under Credit by Examination.The University recognizes the International Baccalaureate Diploma Programme and will grant credit for scores of 5 or higher in the "Higher Level" courses only. Scores of 4 will be taken into consideration, but not automatically granted credit. No credit is given for courses taken at the subsidiary level or for courses that duplicate others taken for Advanced Placement credit.Informal collaboration efforts occur through faculty members’ networking during national (NOHS) and regional (MACHS) conferences.  The Department Chair is a member of the advisory boards for two Associate Degree human services programs (Community College of Baltimore County and Anne Arundel Community College), and the Program Coordinator for an Associate Degree Program (CCBC) is on the SU Counseling & Human Services Advisory Board.  Board meetings provide opportunities for both formal and informal collaborative efforts. The Department Chair began an Associate Degree program in Human Services at Prince George’s Community College before coming to Stevenson and remains in close consultation with the Program Coordinator. The Counseling & Human Services Program at Stevenson University has developed formal articulation agreements with the following programs:Community College ProgramsAnne Arundel Community College Community College of Baltimore CountyFrederick Community College Howard Community College (in progress)Graduate School ProgramMcDaniel College – Human Services Management Program:  Special EducationStevenson University – Healthcare Management Stevenson University - Community Based Education and LeadershipWe have entered into Articulation Agreements with each of the above listed community colleges because they allow students from each of the institutions to continue a path in the study of human services which builds upon substantial courses already completed in the field. See each articulation agreement in the appendix for course equivalencies.The articulation agreement with McDaniel College allows Stevenson Counseling & Human Services majors who complete CHS 515 and CHS 540 to be eligible to obtain a Master’s Degree in Human Services Management: Special Education in one year.Students interested in the Stevenson Healthcare Management or Community Based Education and Leadership M.S. programs can apply to the BS to MS Option accelerated program and finish the combined program in five years. The two graduate level courses (CHS 515 and CHS 540) count towards the major and students can start taking graduate courses in the program during their final year in the undergraduate program and pay the standard undergraduate tuition.Students from Stevenson who want to transfer credits to graduate programs have the opportunity to take two courses at the graduate level (CHS 515 and CHS 540).  As explained in the response to Standard 10, Specification 3 the articulation agreement with the McDaniel College graduate program eliminates problems with the transfer of these credits.

```

##### Match 2 — 🟢 **conf 0.92** &nbsp;words 106 &nbsp; `auto_accept`

_Source heading from doc:_ **The Human Services degree at AACC is considered a career program. Therefore, Human Services students who transfer to Ste**

_AI rationale:_ The section directly addresses how transfer credits from an external institution (AACC) are evaluated and applied toward degree requirements at the receiving institution (Stevenson University), which is the core substance of Standard 10.b on Evaluation of Transfer Credits and Prior Learning.

**Exact text that will be written to the narrative slot:**

```text
Standard 10.b — Evaluation of Transfer Credits and Prior Learning

Prompt: Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE

Response:
The Human Services degree at AACC is considered a career program. Therefore, Human Services students who transfer to Stevenson University will have their coursework evaluated on a course-by-course basis to determine which of the Stevenson University education requirements and discipline requirements have been met. By taking full advantage of the AACC-Stevenson University course agreements outlined below, the transfer student may matriculate at junior standing. Further, this agreement allows the student who has obtained an A.A.S. degree in Human Services from AACC and who has enrolled in the Human Services major at Stevenson University to apply up to 70 transfer credits to required components of the major.

```

##### Match 3 — 🟢 **conf 0.89** &nbsp;words 68 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly describes how students receive information about articulation agreements and transfer of credits, which matches Standard 10.b's requirement to 'Describe how students receive this information' in the context of evaluation of transfer credits and prior learning.

**Exact text that will be written to the narrative slot:**

```text
Standard 10.b — Evaluation of Transfer Credits and Prior Learning

Prompt: Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE

Response:
Describe how students receive this information.Table of ContentsResponse: Students receive information about all articulation agreements from the Program’s website under the Tracks and Minors tab and on the college website.  All admissions and recruitment events include information about transfer of courses. Information about the graduate program articulation agreement is in the CHS Student Handbook (p. 15) and is given to students in CHS 380 and in CHS 441.

```

##### Match 4 — 🔵 **conf 0.82** &nbsp;words 61 &nbsp; `review_low_confidence`

_Source heading from doc:_ **If students transfer 6 credits (CHS 515 and CHS 540) and complete EDU 550 during their senior year, they will be able to**

_AI rationale:_ The section describes policies and procedures for how transfer credits are evaluated and applied toward program completion, directly addressing Standard 10.b's requirement to describe how students receive information about transfer credit evaluation and prior learning assessment.

**Exact text that will be written to the narrative slot:**

```text
Standard 10.b — Evaluation of Transfer Credits and Prior Learning

Prompt: Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE

Response:
If students transfer 6 credits (CHS 515 and CHS 540) and complete EDU 550 during their senior year, they will be able to complete McDaniel College's Master's Program in Human Services Management:  Special Education in 1 year (6 credits-summer; 9 credits-fall, and 9 credits-spring).  Only courses in which the student earns a grade of “B” or better are eligible for transfer.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[10][b].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 278 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This table documents the equivalency mapping of community college credits to the program's degree requirements, directly addressing how transfer credits from an external institution are evaluated and articulated into the Stevenson program. Standard 10.b explicitly covers evaluation and acceptance of transfer credits and prior learning.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 10.b — Evaluation of Transfer Credits and Prior Learning

Community College Degree Requirements
Stevenson Equivalency
Category
Credits Transferred
HEED 125
Ethics in Professional Practice
Focused Elective
Program Requirement
3
HUMS 110
Introduction to Human Services
CHS 201 Human Services and Social Policy
Program Requirement and GE Social Science
3
HUMS 122 Individual Counseling Techniques
CHS 260 Counseling Strategies for Individuals
Program Requirement
3
HUMS 123 Group Counseling Skills
Meets CHS 315 Group Counseling
Program Requirement
3
HUMS 124 Family Counseling
CHS 101 Family Studies
Program Requirement
3
HUMS 150 Community Resources and Partnerships
Focused Elective
Program Requirement
3
HUMS 250 Community Services Practicum
Meets CHS 380 Internship
Program Requirement
3
Elective: SU recommends HUMS 120 Medical Aspects of Chemical Dependency
CHS 270 Psychopharmacology and Addictions
Program Requirement
3
Elective (all options available will meet a focused elective requirement)
Depends on course selected
Program Requirement
(Focused Elective)
3
PSYC 101 General Psychology
PSY 101 Intro. to Psychology
Program Requirement
3
PSYC 200 Lifespan Development
PSY 108 Human Growth and Development
Program Requirement
3
PSYC 203 Abnormal Psychology
PSY 215 Psychopathology
Program Requirement (Focused Elective)
3
ENGL 121 College Composition
ENG 151 English Composition
Program Requirement and GE
3
BIOL 101 General Biology I
BIO 113 General Biology I
GE lab science
4
Arts and Humanities Core Group A
GE Humanities
3
Arts and Humanities Core Group B
GE Humanities
3
Science Gen Ed Core
GE math/science
3
Mathematics Gen Ed Core, SU recommends MATH 138 Statistics
MATH 136 Intro to Statistics
Program Requirement and GE Quant. Lit.
3
Social & Behavioral Sciences Core Group B
GE Social Science
3
General Education Core Course, SU recommends English 210
ENG 152 Into to Literature
GE Composition
3
Total
61 Credits

```

---

## Standard 11

### `11.a` 📊 curriculum matrix + 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The historical roots of human services as a discipline and a profession._

**→ Imported as NARRATIVE** (`narratives[11][a].content`):

##### Match 1 — 🟢 **conf 0.91** &nbsp;words 195 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly addresses the historical roots of human services as a discipline and profession through course coverage and assignments, matching the exact language of Standard 11.a. The narrative documents how multiple courses (CHS 105, 224, 430, 380, 440/441) teach this foundational knowledge.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.a — Knowledge, Theory, Skills, and Values

Prompt: The historical roots of human services as a discipline and a profession.

Response:
The historical roots of human services as a discipline and profession.Response: The historic roots of human services are covered in CHS 105 Human Services and Social Policy through in-class activities, discussion, lecture, and assigned reading (see Course Schedule; week 2 is devoted to the history of human services). In CHS 224 Research Methods and Writing, students read social science research articles that influenced the development of the human services field and create a detailed research proposal as a class assignment. In CHS 430 Family Dynamics and Interventions, students examine a variety of approaches to family therapy that have historically been utilized. Working in groups, they analyze each model and report to the class (see the course schedule and description of the group project). In the Field Placement courses, CHS 380 Internship includes in-class discussion following a journal assignment that requires students to become familiar with the historic roots of the agency at which they are completing their particular internships. Similarly, students in CHS 440 Practicum, learn about the history of the agency where they are completing their practicum and incorporate that into their poster presentations for CHS 441 Seminar at the end of the semester.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 70 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  **

_AI rationale:_ The section describes how the curriculum incorporates theory, research, application, and field experience as core components, along with elective courses—directly addressing the curriculum design and structure required by Standard 11.a (Core Curriculum). The mention of field experience as 'crucial' and elective courses 'approved by faculty' supports curriculum composition narratives.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.a — Knowledge, Theory, Skills, and Values

Prompt: The historical roots of human services as a discipline and a profession.

Response:
The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  In addition to the required courses, students choose five focused electives that allow them to tailor their program to meet their individual needs and interests.  These electives are courses that have been approved by faculty members in the department as being relevant to a career in human services, but are not specific requirements.

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 53 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Identify the study population, the population to whom your findings would apply.  Explain how you would collect data for**

_AI rationale:_ This section describes research methodology (study population, data collection technique, sampling strategy, sample size) which aligns with Standard 11.a's requirement to demonstrate assessment methodology and research design. While 1.e addresses student demographics, the content here is procedural/methodological rather than descriptive of enrollment.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.a — Knowledge, Theory, Skills, and Values

Prompt: The historical roots of human services as a discipline and a profession.

Response:
Identify the study population, the population to whom your findings would apply.  Explain how you would collect data for your proposed study, identifying your technique by name. State how you would select your sample, the sample selection technique you would use, how you would meet selection requirements, if any, and your sample size.

```

##### Match 4 — 🔵 **conf 0.68** &nbsp;words 70 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  **

_AI rationale:_ The section describes curriculum design incorporating theory, research, application, field experience, and elective choice—core elements of Standard 11.a (curriculum content and structure). The mention of field experience as 'crucial' and electives tailored to individual needs aligns with curriculum composition expectations in the current spec.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.a — Knowledge, Theory, Skills, and Values

Prompt: The historical roots of human services as a discipline and a profession.

Response:
The curriculum incorporates theory, research, and application, with field experience as a crucial part of the courses.  In addition to the required courses, students choose five focused electives that allow them to tailor the program to meet their individual needs and interests.  These electives are courses that have been approved by faculty members in the program as being relevant to a career in human services but are not program requirements.

```

##### Match 5 — 🔵 **conf 0.62** &nbsp;words 65 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Program Revisions: A new professional development course has been created and will be offered in place of our profession**

_AI rationale:_ This section describes substantive changes to the curriculum structure—shifting course content and creating new courses—which belongs in Standard 11 (curriculum matrix or curriculum design narrative). While the candidates mention specific skill areas (portfolio, grant writing), the primary content is curriculum reorganization rather than a response to a specific knowledge/skill specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.a — Knowledge, Theory, Skills, and Values

Prompt: The historical roots of human services as a discipline and a profession.

Response:
Program Revisions: A new professional development course has been created and will be offered in place of our professional writing class. Some of the writing projects related to careers (resume, cover letter, portfolio) will be moved to this class. Other writing assignments (literature review, needs assessment, grant proposal narrative) will be incorporated into the research methods course, which will be become a writing intensive course.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[11][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 273 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This course syllabus documents a research methods curriculum with weekly topics, assignments, and learning outcomes across qualitative and quantitative research approaches. It directly supports Standard 11 curriculum specification requirements to show how research and evaluation competencies are integrated across the program's coursework.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 11.a — Knowledge, Theory, Skills, and Values

Week 4
Feb 18
Qualitative & Quantitative Measurement
Why Measure
Validity & Reliability
Problem Statement & Research Questions
Assignment II – Problem Statement & Research Questions Due Feb 20
Qualitative Research
https://onedrive.live.com/view.aspx?resid=F4E7A0E8400F4748!8385&app=WordPdf
Quantitative Research
https://saylordotorg.github.io/text_research-methods-in-psychology/s09-02-reliability-and-validity-of-me.html
Overview: Quantitative vs Quantitative
http://stevenson.libguides.com/c.php?g=236343&p=1569474
Week 5
Feb 25
Sampling
Operationalization
Hypothesis
Assignment III -  Operationalization and Hypotheses Due Feb 27
Sampling
CHAPTER 8 page 65
http://www.oercommons.org/courses/social-science-research-principles-methods-and-practices/view
Week 6
Mar 4
Survey Research
2
nd
/MID-SEMESTER EXAM Mar 6
http://www.oercommons.org/courses/research-methods-in-psychology/view
CHAPTER 9
Week 7
Mar 11
Experimental & Non-Experimental Research Designs
Spring Break March 18-24
UNIVERSITY CLOSED
Experimental Research
https://saylordotorg.github.io/text_research-methods-in-psychology/s10-experimental-research.html
Non-Experimental Research
https://saylordotorg.github.io/text_research-methods-in-psychology/s11-nonexperimental-research.html
Week 8
Mar 25
Field Research, Observation
Literature Review Draft Due
Individual Meetings
https://1drv.ms/b/s!AkhHD0DooOf03zJD6Tq0hdCoCag7
https://1drv.ms/b/s!AkhHD0DooOf03zEFhkrL_6ACySj
Week 9
April 1
Field Research, Case Study
Assignment IV- Research Design                                 Due April 3
Case Research
CHAPTER 11 pages 93-102
http://www.oercommons.org/courses/social-science-research-principles-methods-and-practices/view
Week 10
April 8
Data Analysis: Qualitative/Quantitative
Critical Review Paper Due April 10
Types of Data
http://libweb.surrey.ac.uk/library/skills/Numeracy%20for%20professional%20purposes/2_Types%20of%20Data/index.htm
Descriptive Statistics
http://libweb.surrey.ac.uk/library/skills/Numeracy%20for%20professional%20purposes/3_Basic%20Descriptive%20Statistics%20introduction/index.htm
Quantitative II
http://libweb.surrey.ac.uk/library/skills/Numeracy%20for%20professional%20purposes/4_Basic%20Descriptive%20Statistics/index.htm
Week 11
April 15
Historical Research
Research Limitations/
Implications/
Impact Assessment
Assignment V -Literature Review
Draft Due April 15
Individual Meetings
UNIVERSITY CLOSED April 19
Historical Research
http://www.okstate.edu/ag/agedcm4h/academic/aged5980a/5980/newpage19.htm
Memory vs The Past
http://www.history.ucsb.edu/faculty/marcuse/projects/reception/ReceptHistGornCHE004.htm
History & the Web
http://chnm.gmu.edu/essays-on-history-new-media/essays/?essayid=12
Week 12
Apr 22
Conclusions
( Limitations, Implications, Impact Assessment
) References, next Steps
Assignment VI - Conclusion and References Due April 24
Reading(s) as assigned
Week 13
April 29
Current Research
COMPLETED PROPOSALS
DUE April 29
Reading(s) as assigned
COMPLETED PROPOSALS
DUE April 29
PRESENTATIONS
ATTENDANCE MANDATORY
*
*Unless arranged in advance with Dr. Lesser
Week 14
May 6
Presentation of Research Proposals
Final Exam
PRESENTATIONS
ATTENDANCE MANDATORY
*
*Unless arranged in advance with Dr. Lesser

```

##### Evidence 2 — 🔵 **conf 0.72** &nbsp;words 274 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This is a course syllabus schedule showing topics, readings, and assignments aligned to helping skills and relationship-building competencies. While it touches on reflection (journals), its primary purpose is to map curriculum content—empathy, probing, helping skills, problem-management, and service learning—making it a curriculum artifact best placed under Standard 11.a (curriculum matrix or course schedule documentation).

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 11.a — Knowledge, Theory, Skills, and Values

Date
Topic
Reading
Due
Week 1
8-28 & 30
Introduction, Objectives and Assignments
Chapter 1   The Power of Basics
The Handbook… Chapter 20
Week 2
9-4
Review the Problem-Management and Opportunity-Development  Process
Chapter 2
Week 2
9-6
Service Learning
Week 3
9-11 & 13
Values That Drive the Helping Relationship
Therapeutic Presence
Chapter 3
Chapter 4
Sept 11- Service Learning Preferences
Week 4
Sept 18 & 20
Empathetic Responding
Chapter 5
Week 5
Sept 25 & 27
Mastering the Art of Probing
Chapter 6
Begin Service Learning
Week 6
Oct 2 & 4
Help Clients Challenge Themselves
Chapter 7
DUE: Journal 1 Assignment &
Service Learning Contract
Fall Break
NO CLASS 10-9-18
Week 7
Oct 11
Mid Term Exam
Week 8
Oct 16 & 18
The Action Arrow &
Intro the Three Tasks of Stage I
Chapter 8
Week 9
Oct 23 & 25
The Three Tasks of Stage I:  Help Clients Tell the Story, the Real Story, and the Right Story
Chapter 9
Due: Interview Project 1- Oct 25
Week 10
Oct 30 & Nov 1
Stage II:  Help Clients Design and Set Problem-Managing Goals
Chapter 10
DUE:  Journal 2 Assignment:  11-1
Week 11
Nov 6 & 8
Assessment, Diagnosis and Treatment Planning
Reading:  The Handbook…Chapter 17
Week 12
Nov 13 & 15
Alternative class session
Week 13
Nov 20
Stage III:  Planning-Help Clients Design the Way Forward
Chapter 11
Nov 22
NO CLASS--- THANKSGIVING
Week 14
No 27 & 29
Role Plays
Journal 3 Assignment: 11-29
Week 15
Dec 4 & 6
Role Plays
Review
Week 16
Dec 11
Follow the University-Wide Exam Schedule
Tentative Exam Schedule
Dec 11 10:45-12:45
Final Exam

```


**→ Imported as CURRICULUM MATRIX** (`CurriculumMatrix.rawContent` for `submissionId`):

- conf 0.88 &nbsp; words 1537 &nbsp; heading: _(curriculum matrix table)_
  ```
  History
  Context
  :
  The history of human services provides the context in which the profession evolved, a foundation for assessment of present conditions in the field, and a framework for projecting and shaping trends and outcomes. Thus, human services professionals must have knowledge of how different human services emerged and the various forces that influenced their development.
  Standard 11: The…
  ```

- conf 0.72 &nbsp; words 210 &nbsp; heading: _(data table)_
  ```
  Articulated Courses-AACC
  Articulated Courses – SU
  BIO 101 Fundamentals of Biology or
  BIO 230 Structure and Function of the Human Body
  BIO 104 The Human Body and Contemporary Health Issues
  COM 111/COM 116 Fundamentals of Oral Communication or
  COM 131 Oral Interpretation
  CM 101 Public Speaking
  CSI 112 Computing/Information Technology
  IS 134 MS Windows and Office Applications
  ENG 111 Composition and…
  ```

- conf 0.72 &nbsp; words 116 &nbsp; heading: _(data table)_
  ```
  YEAR 3
  SEMESTER
  FALL
  SPRING
  RECOMMENDED COURSES
  SOC 101 Introduction to Sociology
  3
  CHS 220 Diversity & Cultural Comp.
  3
  CHS 217 Professional Development in Counseling & Human Services
  3
  CHS 224 Research Methods & Writing
  3
  General Elective
  3
  CHS 340 Administration of Human Services
  3
  General Elective
  3
  General Elective
  3
  General Elective
  3
  General Elective
  3
  CREDITS
  15
  CREDITS
  15 CREDITS
  YEAR 4
  S…
  ```

- conf 0.89 &nbsp; words 324 &nbsp; heading: _Baccalaureate Degree Level 2018Instructions: Use as many versions of the Matrix _
  ```
  Baccalaureate Degree Level 2018 Instructions: Use as many versions of the Matrix as needed to deal with all of your required courses. Place course numbers in the header columns at the top of each page; course numbers will appear vertically The courses listed on this Matrix must include all courses required for all students in the program, which contribute compliance with the Curriculum Standards.…
  ```

---

### `11.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Historical and current legislation impacting human service delivery._

**→ Imported as NARRATIVE** (`narratives[11][b].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 297 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses historical and current legislation impacting human service delivery across multiple courses (CHS 101, 105, 224, 340, 430, and field placements), which is the exact language and focus of Standard 11.b.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.b — Knowledge, Theory, Skills, and Values

Prompt: Historical and current legislation impacting human service delivery.

Response:
Historical and current legislation affecting services delivery.Response: Historical and current legislation affecting services delivery is addressed in CHS 101 Family Studies through discussion, media presentation, lecture, and assigned reading specifically regarding family structure and the legislation that affects it. This issue is addressed briefly in most chapters, but see specifically 3/28 “Issues in Contemporary U.S. Families” and 4/4 “Economy and Family Life” in the course schedule. CHS 105 Human Services and Social Policy addresses this issue through reading, lecture, and discussion, particularly in Week 2, which includes coverage of Great Society programs, welfare reform and related topics.CHS 224 Research Methods and Writing  includes an exploration of research studies assessing the need for services and the effectiveness of interventions, which influence legislation.  This is addressed through lecture, discussion, and assigned reading.CHS 340 Administration of Human Services covers legislation that affects service delivery indirectly through its influence on how agencies are administered and managed. For example, a unit on hiring includes legal issues governing this process (see course schedule) and a unit and assigned project on seeking resources (Course Requirement #6) covers legislation regarding fund-raising and finances (course schedule). CHS 430 Family Dynamics and Interventions examines legislation affecting service delivery through a group project where student groups analyze in-depth different models of family therapy, both current and historical. The analysis includes legislative issues affecting each approach (see the Group Project assignment for detail and a list of the models covered).Legislation affecting service delivery is also addressed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students become familiar with the legislative issues affecting their particular agency. This is often a topic in the Issues Presentation project and is included in Poster Presentations about the agencies at which students complete their practicums.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[11][b].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.62** &nbsp;words 317 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This course syllabus spans multiple foundational topics (history of helping, roles/functions, macro-level practice, community needs assessment, theoretical perspectives, casework skills, social policy, trauma-informed care, and ethics). The breadth and scope best align with Standard 11.b's requirement for demonstrated knowledge of theories, legislation, and systems impacting human service delivery. The detailed curriculum matrix listing would belong in Standard 11 context.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 11.b — Knowledge, Theory, Skills, and Values

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
Individual and Group Research
NOV 15- Individual Reflection Papers
Week 13
NOV 20
GROUP PRESENTATIONS
NO CLASS NOV 22- ENJOY THANKSGIVING
PRESENTATIONS
NOV 20- Quiz 4
Week 14
11/27 & 29
GROUP PRESENTATIONS
PRESENTATIONS
Group Presentations
Revised &Community Action Plan
Week 15
12/4, 12/6
MULTICULTURAL AND ETHICAL ISSUES IN HUMAN SERVICES
STRESS MANAGEMENT
FINAL REVIEW
NOHS Code of Ethics
Week 16
12/13
FINAL EXAM
8-10 AM
This is subject to change based on University-Wide exam Schedule.

```

---

### `11.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _How public and private attitudes influence legislation and the interpretation of policies related to human services._

**→ Imported as NARRATIVE** (`narratives[11][c].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 332 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section's narrative directly addresses how public and private attitudes influence legislation and policy interpretation—the exact language of Standard 11.c. The response demonstrates this competency across multiple courses (CHS 101, 105, 224, 340, 430, and field placements) with specific examples.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.c — Knowledge, Theory, Skills, and Values

Prompt: How public and private attitudes influence legislation and the interpretation of policies related to human services.

Response:
How public and private attitudes influence legislation and the interpretation of policies related to human services.Response: There is an emphasis on how public and private attitudes influence legislation and the interpretation of policies related to human services in CHS 101 Family Studies throughout the course as the factors influencing various aspects of family are explored through discussion, media presentation, lecture, and assigned reading. For example, the interpretation of laws related to same-sex couples, divorce and remarriage and work and family life are considered. The issue is addressed most directly and deeply in the unit on “Issues in Contemporary U.S. Families” (see course schedule). CHS 105 Human Services and Social Policy addresses this issue through reading, lecture, and discussion, particularly in the units on macro-level practice and social policy issues, which include detailed discussion of public attitudes towards helping(see course schedule).CHS 224 Research Methods and Writing includes discussions about how research on social issues is influenced by public and private attitudes and legislation (see week 2 in course schedule).  This is addressed through lecture, discussion, and assigned reading.CHS 340 Administration of Human Services covers the influence of public and private attitudes on legislation and policy through a variety of administrative issues. For example, see the unit on “Working with a Board” in course schedule. CHS 430 Family Dynamics and Interventions examines the influence of public and private attitudes on legislation and policy through a group project where student groups analyze in-depth different models of family therapy, both current and historical. The analysis includes legislative issues affecting each approach (see the Group Project assignment for detail and a list of the models covered).This issue is also addressed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students become familiar with the legislation and interpretation of policies that affects their particular agency. This is often a topic in the Issues Presentation project and is included in Poster Presentations about the agencies at which students complete their practicums.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[11][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `11.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs._

**→ Imported as NARRATIVE** (`narratives[11][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 317 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The narrative directly addresses how broader sociopolitical issues (systems of governance and economics) affect human service systems across multiple courses and field placements, matching the current Standard 11.d specification on sociopolitical context within Human Systems Context knowledge.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.d — Knowledge, Theory, Skills, and Values

Prompt: The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs.

Response:
The broader sociopolitical issues that affect human service systems.Response: Sociopolitical issues, including systems of governance and economics, are addressed in CHS 101 Family Studies, particularly as they relate to family issues through historical, national, and cultural contexts. Learning is accomplished through in-class activities, discussions, media presentations, lectures, and assigned readings. Sociopolitical issues are also integrated throughout  CHS 105 Human Services and Social Policy, particularly as they relate to the emergence of human services systems and the unit on Social Policy and Intervention (see course schedule).CHS 224 Research Methods and Writing includes discussions about how research on social issues is influenced by government and economic systems (see week 2 in course schedule).  This is addressed through lecture, discussion, and assigned reading.CHS 340 Administration of Human Services covers the influence of government and economic policies on a variety of administrative issues. For example, a unit on hiring includes legal issues governing this process (see course schedule) and a unit and assigned project on seeking resources (Course Requirement #6) covers both governmental (grants) and economic issues (course schedule). Government and economic systems and their relationship to family dynamics are covered in CHS 430 Family Dynamics and Interventions through a group project where student groups analyze different models of family therapy. The analysis includes how each approach fits within government and economic systems (see the Group Project assignment for detail and a list of the models covered). Differences between systems of governance and economics is also addressed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students become familiar with the governmental and economic issues affecting their particular agency. These issues are often a topic in the Issues Presentation project and are included in Poster Presentations about the agencies at which students complete their practicums.Required non-major course SOC 101 Introduction to Sociology includes frequent consideration of governmental and economic issues related to sociology.

```

##### Match 2 — 🟡 **conf 0.72** &nbsp;words 260 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **f.**

_AI rationale:_ The section demonstrates how the program addresses diversity and its role in determining and meeting human needs across the human services curriculum, which aligns with Standard 11.d's requirement to understand broader sociopolitical issues affecting human service systems and the structure and dynamics of communities and society. The emphasis on cultural competence and diversity as context for understanding human needs directly supports the specification's requirement for understanding how to determine appropriate responses to human needs.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.d — Knowledge, Theory, Skills, and Values

Prompt: The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs.

Response:
Emphasis on context and the role of diversity (including, but not limited to ethnicity, culture, gender, sexual orientation, learning styles, ability, and socio-economic status) in determining and meeting human needs.Response:Emphasis on context and the role of diversity (including, but not limited to ethnicity, culture, gender, sexual orientation, learning styles, ability, and socio-economic status) in determining and meeting human needs is provided throughout the Counseling & Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 101, 201, 220, 224, 315/515, 360, 340, 430, 380, 440 and 441.The role of diversity in determining and meeting human needs is the course topic in CHS 220 Diversity and Cultural Competence. This course explores the diversity of contemporary life styles.  The course examines the importance of cultural values for both individuals and their families.  It addresses what it means to be culturally competent as human services professionals when working with individuals of a different race, ethnicity, socio-economic status, religion, sexual orientation or other personal life style choices. (See CHS 220 syllabus)The role of diversity in determining and meeting human needs is emphasized in CHS 101 Family Studies (in-class activities, discussions, media presentations, lectures, and assigned readings), in CHS 105 Human Services and Social Policy (in-class activities, discussions, media presentations, lectures, and assigned readings), and CHS 441 (discussions and assigned readings). The role of diversity is also covered in PSY 101 and PSY 108 (discussions, lectures, and assigned readings), and SOC 101 (discussions, lectures, and assigned readings).

```

##### Match 3 — 🟡 **conf 0.72** &nbsp;words 287 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **e.**

_AI rationale:_ The section documents curriculum content on political ideologies and their influence on human services systems, social policy, and organizational contexts—directly aligned with Standard 11.d on broader sociopolitical issues affecting human service systems. The secondary fit to 11.c reflects the explicit discussion of how political attitudes influence legislation and policy interpretation.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.d — Knowledge, Theory, Skills, and Values

Prompt: The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs.

Response:
Exposure to a spectrum of political ideologies.Response: Exposure to a spectrum of political ideologies occurs in each unit of CHS 101 Family Studies , but see particularly “Selecting a Partner”, “Diversity in Marriages and Familes”, and “Employment in Relationships” where different political perspectives on family policy are studied directly. In CHS 105 Human Services and Social Policy,  political ideologies are central to discussions of the historical roots of helping and social policy and intervention approaches, as well as many other units, which are covered through in-class activities, discussions, media presentations, lectures, assigned readings, and out-of-class assignments. See especially the assignment  “Issue Presentation and Report”. In addition, political ideologies and their influence on research are discussed in CHS 224 Research Methods and Writing. See particularly week 2 in course schedule on the foundations of social science research.Political ideologies and their relationship to family dynamics are covered in detail in CHS 430 Family Dynamics and Interventions through a group project where student groups analyze different models of family therapy. The analysis includes how each approach fits with different political ideologies (see the Group Project assignment for detail and a list of the models covered). Exposure to a spectrum of political ideologies also occurs in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students become familiar with political ideologies that affect their particular agency. These issues are often a topic in the Issues Presentation project and are included in Poster Presentations about the agencies at which students complete their practicums.Political ideologies, as they relate to the specific topics of the courses, are analyzed throughout the required non-major course SOC 101 Introduction to Sociology and covered tangentially in PSY 101 Introduction to Psychology.

```

##### Match 4 — 🔵 **conf 0.42** &nbsp;words 60 &nbsp; `review_low_confidence`

_Source heading from doc:_ **There are more than 15 sociology concepts in this text, used either explicitly, described but not directly mentioned or **

_AI rationale:_ The assignment requires students to identify sociology concepts in a text, demonstrating understanding of broader sociopolitical and theoretical frameworks that underpin human service systems and social structures. This aligns best with Standard 11.d's emphasis on understanding broader sociopolitical issues and human systems context.

**Exact text that will be written to the narrative slot:**

```text
Standard 11.d — Knowledge, Theory, Skills, and Values

Prompt: The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs.

Response:
There are more than 15 sociology concepts in this text, used either explicitly, described but not directly mentioned or as underlying ideas of the text.  In this assignment, you will identify 15 of these concepts.  Note: the only texts in this paper are those from the article.  You are not allowed to write anything of your own in this paper.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[11][d].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.42** &nbsp;words 127 &nbsp; `review_low_confidence`

_Source heading from doc:_ **We understand something the most when we either experience it or are able to relate to it, one way or another.  This ass**

_AI rationale:_ This section describes a course assignment (socio-autobiography) designed to help students understand sociological concepts and demonstrate knowledge of theory. While the similarity score is modest, the assignment's focus on connecting personal experience to sociological vocabulary and theory best aligns with Standard 11's knowledge and theory requirements, specifically the broader understanding of social systems and human service context.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 11.d — Knowledge, Theory, Skills, and Values

We understand something the most when we either experience it or are able to relate to it, one way or another.  This assignment requires students to explore how sociology relates to them, using their life experiences.  It is an opportunity for them to demonstrate their understanding of key sociological vocabulary words (sociological concepts).  So each student will write a 3-4 page paper, a socio-autobiography, typed in normal font, 2-line spaced, narrating a life experience within any of the themes listed below.  This must be a coherent story of your experience, within any one of the themes listed below.  These concepts must flow naturally with the story and not be forced into the narrative to make the tally.  The key things I’m looking for in this paper are:

```

##### Evidence 2 — 🔵 **conf 0.42** &nbsp;words 185 &nbsp; `review_low_confidence`

_Source heading from doc:_ **In this assignment, students will read an assigned material and identify the sociology concepts (not theories) in the te**

_AI rationale:_ This assignment teaches students to identify and analyze sociology concepts within texts, which supports understanding of human systems context and broader sociopolitical issues. While the content touches on family structures (12.c), the primary focus is on conceptual analysis as foundational knowledge for understanding societal systems.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 11.d — Knowledge, Theory, Skills, and Values

In this assignment, students will read an assigned material and identify the sociology concepts (not theories) in the text they read.  These concepts may be used explicitly by the author(s), they may be described but not explicitly named or they may be detected as underlying ideas of the text, not necessarily mentioned explicitly or even described.  The material for this assignment is “The polygamous town facing genetic disaster” – on Blackboard.  In your paper, the concepts shall be numbered numerically, you will reproduce the text carrying the concept (the entire sentence, not parts of it) and provide the number of the page where it can be found.  Highlight the concept (in yellow), if it appears in the text or highlight the portion of the sentence that describes or carries the idea of the concept, or the entire sentence if that is the case.  Do not list a concept more than once.  Derivatives of a concept will not be counted e.g. if you list polygyny, polygynous will not be counted as another concept.  See the Blackboard for the example of how this paper shall be formatted.

```

---

## Standard 12

### `12.a` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Theories of human development._

**→ Imported as NARRATIVE** (`narratives[12][a].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 264 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly addresses theories of human development across multiple required and elective courses (PSY 108, PSY 101, CHS 101, CHS 224, CHS 315/515, CHS 360, CHS 430, CHS 380, CHS 440, CHS 441), matching the explicit specification language 'Theories of human development' under Standard 12.a.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.a — Knowledge, Theory, Skills, and Values

Prompt: Theories of human development.

Response:
Theories of human development.Response: Human development theory is the primary topic of PSY 108 Human Growth and Development. Human Development is introduced as a unit in PSY 101. Both are required courses in the major.Human development theory is included through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 101, 201, 224, 315/515, 360, 430, 380, 440 and 441.Human development theory is addressed in CHS 101 (see CHS 101 Family Studies syllabus, human development theories of Freud, Erikson, Piaget, and others are addressed as theoretical perspectives in the first chapter).Human development theory is addressed in CHS 105 Human Services and Social Policy through lectures and assigned readings (see course schedule).CHS 224 Research Methods and Writing covers theories of human development to the extent that these theories are the subject of social science research to determine their efficacy.CHS 315/515 Group Counseling and CHS 360 Counseling Strategies for Individuals are clinical skills courses that address stages of human development in the context of therapeutic interventions (group counseling and individual counseling, respectively). CHS 430 Family Dynamics and Interventions focuses specifically on the development of the family and the influence of the family on personal development. The Family of Origin project requires students to examine how their own family of origin has influenced their development. Students examine how different theoretical approaches to family therapy view development through the Group Project.Field Placement courses CHS 380 , CHS 440 and CHS 441 require students to understand the developmental context of the particular clients they work with at their agencies.

```

##### Match 2 — 🟢 **conf 0.92** &nbsp;words 318 &nbsp; `auto_accept`

_Source heading from doc:_ **Human Systems Context: The human services professional must have an understanding of the structure a**

_AI rationale:_ The section explicitly labels itself as addressing Standard 12 and demonstrates how knowledge and theory of human systems (individual, interpersonal, group, family, organizational, community, and societal) are included in the curriculum. This directly corresponds to Standard 12.a in the current spec, which addresses the foundational human systems context requirement.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.a — Knowledge, Theory, Skills, and Values

Prompt: Theories of human development.

Response:
Human Systems Context : The human services professional must have an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs. Standard 12: The curriculum shall include knowledge and theory of the interaction of human systems including: individual, interpersonal, group, family, organizational, community, and societal. Specifications for Standard 12 Demonstrate how the knowledge, theory, and skills for each of the following specifications are included, analyzed, and applied in the curriculum: Theories of human development. T M I,T L T L I L I L ITKSH ITKSH ITKSH T L Small groups: Overview of how small groups are used in human services settings, Theories of group dynamics, and Group facilitation skills. I,K L KS H ITKSH ITKSH ITKSH KS M Changing family structures and roles. TK M I,K L ITKSH IS M ISTK M K M An introduction to the organizational structures of communities. I M I,K L ITK M ITKSH ITKSH K M An understanding of the capacities, limitations, and resiliency of human systems. T M I,K L TKS M K,M ITKSH ITKSH ITKSH K M Emphasis on context and the role of diversity (including, but not limited to ethnicity, culture, gender, sexual orientation, learning styles, ability, and socio-economic status) in determining and meeting human needs. T M I,K M K H TK M I L I L I,L ITKSH ITKSH ITKSH K M Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism. I L I,K M I L KS M KS H IK M ITKSH ITKSH K L Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. I,K M KS M KS H IT M ITKSH ITKSH

```

##### Match 3 — 🟢 **conf 0.89** &nbsp;words 52 &nbsp; `auto_accept`

_Source heading from doc:_ **This course provides a lifespan perspective on the growth and development of humans from pre-conception until death. Thi**

_AI rationale:_ The section explicitly describes a lifespan course covering theories of human development across biological, cognitive, and socioemotional domains, with major theoretical approaches addressing innate and environmental factors—this directly aligns with Standard 12.a's specification of 'Theories of human development.'

**Exact text that will be written to the narrative slot:**

```text
Standard 12.a — Knowledge, Theory, Skills, and Values

Prompt: Theories of human development.

Response:
This course provides a lifespan perspective on the growth and development of humans from pre-conception until death. This course focuses on stability and change in the whole person, including the biological, cognitive, and socioemotional domains. This course presents major theoretical approaches to development that address innate factors, environmental influences, and their interactions.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 475 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This course syllabus/schedule covers human development across the lifespan (infancy through late adulthood), directly supporting Standard 12.a's requirement for knowledge of theories of human development. The reflections present a secondary connection to self-reflection (20.e), but the primary content is developmental theory.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 12.a — Knowledge, Theory, Skills, and Values

Week & Day
Topic
Readings
(All referred to Arnett)
What is Due?
Week 1
Monday, 1/28
Introduction
Chapter 1: Sec 1
Week 1
Wednesday, 1/30
Research Methods
Chapter 1: Sec 3
Week 1
Friday, 2/1
Research Methods
Quiz 1
Week 2
Monday, 2/4
Research Methods
Theories
Chapter 1: Sec 2
pp. 195-197
Week 2
Wednesday, 2/6
Theories
Week 2
Friday, 2/8
Theories
Quiz 2
Week 3
Monday, 2/11
Genetics and Environment
Chapter 2: Sec 1
Week 3
Wednesday, 2/13
Genetics and Environment
Week 3
Friday, 2/15
Prenatal Development
Chapter 2: Sec 2,3
Quiz 3
Reflection #1, Due by 11:59pm
Week 4
Monday, 2/18
Prenatal Development
Week 4
Wednesday, 2/20
The Newborn
Chapter 3: Sec 1, 2, 3
Week 4
Friday, 2/22
The Newborn
Week 5
Monday, 2/25
Exam #1
Exam 1
In Class
Week 5
Wednesday, 2/27
Infant Perception
Chapter 4: Sec 1, 2
Week 5
Friday, 3/1
Infant Perception
Quiz 4
Week 6
Monday, 3/4
Infant Cognition
Week 6
Wednesday, 3/6
Infant Cognition
Week 6
Friday, 3/8
Piaget’s Cognitive Development
Chapter 5: Sec 1, 2
Quiz 5
Week 7
Monday, 3/11
Piaget’s Cognitive Development
Chapter 6: Sec 2
Week 7
Wednesday, 3/13
Revisiting Piaget
Chapter 7: Sec 2
Week 7
Friday, 3/15
Revisiting Piaget
Chapter 8: Sec 2
Quiz 6
Reflection #2,
Due by 11:59pm
Week 8
3/18 – 3/22
No Class
Spring Break
Week 9
Monday, 3/25
Exam #2
Exam #2
In Class
Week 9
Wednesday, 3/27
Early Emotion
Chapter 6: Sec 3
Week 9
Friday, 3/29
Early Emotion
Week 10
Monday, 4/1
Temperament
Chapter 4: Sec 3
Week 10
Wednesday, 4/3
No Class
Dr. Wong at Conference
Week 10
Friday, 4/5
No Class
Dr. Wong at Conference
Week 11
Monday, 4/8
Temperament
Quiz 7
Week 11
Wednesday, 4/10
Attachment
Chapter 5: Sec 3
Week 11
Friday, 4/12
Attachment
Week 12
Monday, 4/15
Middle Childhood
Chapter 7: Sec 1, 3
Quiz 8
Week 12
Wednesday, 4/17
Middle Childhood
Reflection #3, Due by 11:59pm
Week 12
Friday, 4/19
No Class
Week 13
Monday, 4/22
Adolescence
Chapter 8: Sec 1, 3
Week 13
Wednesday, 4/24
Adolescence
Chapter 8: Sec 1, 3
Week 13
Friday, 4/26
Exam #3
Exam #3
In Class
Week 14
Monday, 4/29
Emerging Adulthood
Chapter 9: Sec 1, 2, 3
Quiz 9
Week 14
Wednesday, 5/1
Young and Middle
Adulthood
Chapter 10: Sec 1, 2, 3 Chapter 11: Sec 1, 2, 3
Week 14
Friday, 5/3
Late Adulthood
Chapter 12: Sec 1, 2, 3
Week 15
Monday, 5/6
Late Adulthood
Death and Dying
Chapter 13: Sec 1, 2, 3
Quiz 10 Reflection #4,
Due by 11:59pm
Week 15
Wednesday, 5/8
Attend Psychology Student Research Showcase @ Rockland Banquet
Week 15,
Friday, 5/10
Conclusion of Human Development
Week 16
Final Exam
Exam #4
Tentative:
ON1: W 5/15 9-10am
ON2: F 5/17 9-10am
ON3: M 5/13 10:45-11:45am
Exam #4
Note section, date, and time

```

##### Evidence 2 — 🔵 **conf 0.68** &nbsp;words 51 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Arnett, J.J. (2016). Human development: A cultural approach (2nd Edition). New York: Pearson. Revell Access Code: Arnett**

_AI rationale:_ This is a textbook citation for 'Human Development: A Cultural Approach,' which directly supports the curriculum content addressing theories of human development (Standard 12.a). The cultural focus also supports intercultural fluency (12.f), but the primary content mapping is to theories of human development.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 12.a — Knowledge, Theory, Skills, and Values

Arnett, J.J. (2016). Human development: A cultural approach (2nd Edition). New York: Pearson. Revell Access Code: Arnett  ISBN 0-13-461258-2. Loose Leaf Binding Version. Available at the campus book store for $122.50. e-Text version available online for less, just be sure you are buying the same ISBN number version of the eText.

```

---

### `12.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills._

**→ Imported as NARRATIVE** (`narratives[12][b].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 499 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses all three components of Standard 12.b: overview of small groups in human services settings, theories of group dynamics, and group facilitation skills. The narrative maps course-by-course evidence to each of these three sub-specifications.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
Small groups: Overview of how small groups are used in human services settingsResponse: An overview of how small groups are used in human services settings is included through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 201, 315, 380, 430, 440 and 441.Use of small groups in human services settings is covered in CHS 315/515 Group Counseling as the fundamental topic of this course through in-class activities, discussions, media presentations, lectures, assigned readings, and out of class assignments; see CHS 315/515 syllabus. This course investigates basic elements of group process and practice. The application of course material to specific groups is highlighted.Use of small groups in human services settings is also covered in CHS 105 Human Services and Social Policy (discussions, media presentations, lectures, assigned readings, and out of class assignments; see “Team Research Assignment”).  Use of small groups in human services settings is covered throughout CHS 380 Internship (discussions, in-class activities) and CHS 430 Family Dynamics and Interventions (in-class activities, discussions, media presentations, lectures, assigned readings, and out of class assignments).  In both CHS 380 and 430, students participate in an in-class activity involving the formation of small groups and the subsequent analysis of each group’s dynamic (see Group Project in CHS 430).  CHS 441 Seminar addresses use of small groups in discussions and is itself a small group. This course provides an opportunity for students to discuss and learn more about issues related to the practicum and to the field of human services.  Similar in organization to a professional development meeting, the seminar is designed to help facilitate the transition from undergraduate school to work and/or graduate school.Theories of group dynamicsResponse: Theories of group dynamics are introduced in CHS 105 Human Services and Social Policy through lecture and discussion (see schedule on the Helping Process) and are major topics in both CHS 315/515 Group Counseling (see Week 4) and in CHS 430 Family Dynamics and Interventions.Group facilitation skills.Response: Skills for facilitating groups are taught through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 201, 315, 380, and 430.Skills for facilitating groups are taught in CHS 315/515 Group Counseling as the fundamental learning goal of this course through in-class activities, discussions, media presentations, lectures, assigned readings, and out of class assignments; see course objective 6, “Apply group process concepts and practices to specific groups such as families”, which is achieved in part by in-class practice of skills for facilitating groups.These skills are further explored and practiced in CHS 380 Internship (discussions, in-class activities) and CHS 430 Family Dynamics and Interventions (in-class activities, discussions, media presentations, lectures, assigned readings, and out of class assignments).  In both CHS 380 and 430, students participate in an in-class activity involving the formation of small groups and the subsequent analysis of each group’s dynamic.  Skills for facilitating groups are discussed and practiced during these activities. (CHS 430 Group Project)

```

##### Match 2 — 🔵 **conf 0.82** &nbsp;words 105 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Apply your textbooks, as well as a minimum of 4 additional references, to your experience in group.  Your paper must add**

_AI rationale:_ The assignment explicitly requires students to apply theories of group dynamics, demonstrate group facilitation skills, and analyze group process concepts—core competencies directly addressed in Standard 12.b (small groups: theories of group dynamics and group facilitation skills). The reflective analysis component is secondary to the primary focus on group knowledge and skills.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
Apply your textbooks, as well as a minimum of 4 additional references, to your experience in group.  Your paper must address the stages of group, techniques and practice, and specific group process concepts to the evolution of your individual group.  Do a process commentary on your group from both a leader’s and member’s perspective.  Apply your research on group process to an analysis of your own experience in group.  Conceptualize the group process, rather than give a report of events.  Incorporate your own experience of key themes in a way that demonstrates your understanding of the readings by focusing on such points as the following:

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 57 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will be assigned to one of three groups. The groups’ role will rotate during the semester.  Each group will**

_AI rationale:_ The section describes a pedagogical technique using small groups with rotating roles and debate, directly matching Standard 12.b's requirement to address group facilitation skills and group dynamics in the curriculum.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
Each student will be assigned to one of three groups. The groups’ role will rotate during the semester.  Each group will have the opportunity of presenting support for or against a particular topic being considered.  The third group during each of these debates will listen to both sides and determine which side presented the most convincing evidence.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 138 &nbsp; `review_low_confidence`

_Source heading from doc:_ **515 Students will write a specific group proposal in outline form.  You may choose a group for children, adolescents, ad**

_AI rationale:_ The assignment requires students to develop a group proposal demonstrating knowledge of group dynamics, member screening and selection, facilitation procedures, and group evaluation—all core components of Standard 12.b on small groups theory, dynamics, and facilitation skills in human services.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
515 Students will write a specific group proposal in outline form.  You may choose a group for children, adolescents, adults or the elderly.  In your group proposal, show how you would screen, select and orient members; outline the practical considerations in setting up this group.  You might have an outline of topics that may structure your group sessions, if this is appropriate.  Discuss the rationale for your group and also how you would evaluate the outcomes.  Review the examples of the various group proposals in the textbook given in	Chapters 10 and 11 for ideas for the structure of your proposal.  Also, in Chapter 5,  specific guidelines are addressed for developing a proposal for a group and for forming groups.  Your proposal is designed to help you clarify the nature of the group and procedures you may use.

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 72 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Working in small groups of 5-6, students will pick a topic from the following, research it and present in class: Right t**

_AI rationale:_ The assignment describes students working in small groups of 5-6 to research and present topics, which directly aligns with Standard 12.b's focus on small group facilitation and group dynamics. While the topics addressed have policy/advocacy dimensions (12.g, 13.f), the core instructional method and learning activity is small group work.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
Working in small groups of 5-6, students will pick a topic from the following, research it and present in class: Right to Marry; Immigration Reform; Mass Shootings; Healthcare for all Americans (Obamacare); Voter ID Laws; Death Penalty; and “Black Lives Matter”.  Group members are expected to exercise discretion on the specific direction they wish to take their topic.  They should aim at sharing significant new information on their topic with their colleagues.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 84 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The class will break up into small groups of 5-6 to discuss the article “Lesbians blurring the boundaries….”  The discus**

_AI rationale:_ The assignment describes a small-group discussion activity using a structured discussion guide, which directly aligns with Standard 12.b's specification of small group facilitation and group dynamics instruction. While the optional written reflection could tangentially relate to 20.e (professional self-reflection), the core assignment is pedagogical delivery of small-group work.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
The class will break up into small groups of 5-6 to discuss the article “Lesbians blurring the boundaries….”  The discussion will be conducted using a discussion guide I will provide.  No written report is required.  However, students may submit a 2-3 page report answering the questions in the discussion guide, on the due date, for extra-credit points.  Make sure to number your answers correspondingly.  To use this assignment for extra-credit, students must participate in the in-class group discussion.  This paper must be written individually.

```

##### Match 7 — 🔵 **conf 0.52** &nbsp;words 87 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Throughout the course, students will take part in different types of group experiences as both members                  **

_AI rationale:_ The section describes students' participation in small and large group experiences with attention to group facilitation skills and group dynamics principles, which directly aligns with Standard 12.b's focus on small groups, group dynamics theories, and group facilitation skills in human services.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
Throughout the course, students will take part in different types of group experiences as both members                           		and leaders of small and large groups; therefore, class participation is essential.  Advance preparation 		is mandatory, as students will be expected to synthesize, analyze, and evaluate the readings in terms of 		academic knowledge as well as personal and professional experience.  Grading will take into 			consideration, the relevance of a student’s comments and questions, and the degree to which a 			student’s participation reflects an understanding of the underlying principles of this course.

```

##### Match 8 — 🔵 **conf 0.52** &nbsp;words 74 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will write two papers.  One will be a position paper on a group   membership or group 		leadership issue, s**

_AI rationale:_ The section describes assignments on group membership and group leadership issues, directly aligning with Standard 12.b's coverage of small groups, group dynamics, and group facilitation skills. The process analysis paper with reflection also has secondary relevance to Standard 20.e on reflection on professional self.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
Each student will write two papers.  One will be a position paper on a group   membership or group 		leadership issue, such as how to work effectively with a difficult group member.  The other will be a 		process analysis of the course, which will require the student to apply the readings to a 				conceptualization of his/her own experience in the course as well as researching theoretical methods..  		This paper will also be presented in class.

```

##### Match 9 — 🔵 **conf 0.42** &nbsp;words 80 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Groups will research their chosen topics and present their findings in class.  All members of the group must participate**

_AI rationale:_ This section describes a small-group activity involving research, compilation, and presentation—activities aligned with group facilitation and dynamics instruction (12.b), though the emphasis on information synthesis and reporting also partially matches 14.a.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
Groups will research their chosen topics and present their findings in class.  All members of the group must participate in the research, compilation or organization of materials, and presentation of their findings.  Group members who fail to participate in any aspect of this project: research, compilation, and presentation, shall not be entitled to the points for this assignment. Groups may select a topic outside of this list but such topic shall be cleared with me.  No written report is required.

```

##### Match 10 — 🔵 **conf 0.42** &nbsp;words 122 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The class will be split into small groups.  Each group will be assigned one or more class topics.  The group reads the a**

_AI rationale:_ The section describes small-group learning activities and discussion facilitation within a course, which most directly aligns with Standard 12.b on group dynamics and group facilitation skills in human services education, though the content is primarily pedagogical methodology rather than a direct specification response.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.b — Knowledge, Theory, Skills, and Values

Prompt: Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills.

Response:
The class will be split into small groups.  Each group will be assigned one or more class topics.  The group reads the assigned materials for the topic, and other relevant sources, and comes to class, on the date of the topic, with 5 questions or comments on their assigned topic, for the class to discuss.  These should not be one-liners so must be framed in a way that generates discussion among class members, not yes or no responses.  These questions must be generated by the group members, not copied from their sources.  Group members should review their questions and make all necessary corrections before submission.  Spelling and grammatical mistakes will be penalized.  The discussion questions are worth 5% of the course points.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][b].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.68** &nbsp;words 32 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(table)**

_AI rationale:_ The list documents articulated courses in group dynamics, group process, and agency management, which directly supports the knowledge, theory, skills, and values required for small groups and group facilitation specified in Standard 12.b.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 12.b — Knowledge, Theory, Skills, and Values

Articulated Courses at McDaniel College
Articulated Courses at Stevenson University
CED 508 Group Dynamics
CHS 515 Group Process and Practice
HSM 510 Introduction to Agency Management
CHS 540 Administration of Human Services

```

##### Evidence 2 — 🔵 **conf 0.62** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Examples of related professional journals for the individual and group assignments are:  American Journal of Family Ther**

_AI rationale:_ The section lists professional journals relevant to group and individual coursework assignments. This is best classified as supporting evidence for group facilitation and small group dynamics content (12.b), though the brevity and lack of narrative context suggest this is a journal list excerpt rather than a substantive response.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 12.b — Knowledge, Theory, Skills, and Values

Examples of related professional journals for the individual and group assignments are:  American Journal of Family Therapy, Family Process, Journal of Couple and Relationship Therapy, Journal of Family Therapy, Journal of Marital and Family Therapy, Journal of Sex and Marital Therapy as well as journals such as Family Relations, Journal of Marriage and Family, and Families in Society.

```

##### Evidence 3 — 🔵 **conf 0.62** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Examples of related professional journals for the individual and group assignments are:  American Journal of Family Ther**

_AI rationale:_ The section lists professional journals relevant to individual and group assignments, indicating support for teaching group facilitation theories and skills. Standard 12.b addresses group dynamics and group facilitation, making it the best fit for identifying scholarly resources used in that content area.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 12.b — Knowledge, Theory, Skills, and Values

Examples of related professional journals for the individual and group assignments are:  American Journal of Family Therapy, Family Process, Journal of Couple and Relationship Therapy, Journal of Family Therapy, Journal of Marital and Family Therapy, Journal of Sex and Marital Therapy as well as journals such as Family Relations, Journal of Marriage and Family, and Families in Society.

```

---

### `12.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Changing family structures and roles._

**→ Imported as NARRATIVE** (`narratives[12][c].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 194 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses changing family structures and roles as a knowledge domain, with course examples (CHS 101, CHS 430) demonstrating how students learn this content. This matches Standard 12.c exactly, which specifies this topic as part of the Knowledge, Theory, Skills, and Values standard.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.c — Knowledge, Theory, Skills, and Values

Prompt: Changing family structures and roles.

Response:
Changing family structures and roles.Response: Changing family structures and roles is the main topic in CHS 101 Family Studies.  Each unit addresses changes and variations over time and across cultures for that topic. See especially unit on Issues in Contemporary Families. Changing family structures is also addressed in CHS 105 Human Services and Social Policy through lectures and discussions at the beginning of the course related to defining needs and helping and in the unit on special groups. In CHS 430 Family Dynamics and Interventions, family structures are analyzed in depth from a variety of theoretical perspectives. See the Group Project on examining models of family therapy. In the course schedule, see units on Genograms and Ecomaps, on Family as a Psychosocial System, and on Family Development. The material is covered through lecture, discussion, readings, reflections and written assignments. Field Placement courses CHS 380 Internship, CHS 440 Practicum. and CHS 441 Seminar require students to understand the family structures and roles of the particular clients they work with at their agenciesA theoretical consideration of changing family structures is included in the required course SOC 101 (in-class activities, discussions, media presentations, lectures, and assigned readings).

```

##### Match 2 — 🔵 **conf 0.52** &nbsp;words 71 &nbsp; `review_low_confidence`

_Source heading from doc:_ **There are many controversial issues related to families.  In this assignment, you will investigate one of these issues b**

_AI rationale:_ The assignment centers on investigating controversial family-related issues through research and reflection, directly aligning with Standard 12.c (changing family structures and roles). While fieldwork preparation is mentioned, the assignment explicitly states 'not conducting fieldwork,' making this a classroom-based knowledge and theory exercise rather than a field experience.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.c — Knowledge, Theory, Skills, and Values

Prompt: Changing family structures and roles.

Response:
There are many controversial issues related to families.  In this assignment, you will investigate one of these issues by reading and preparing for but not conducting fieldwork.  After you have collected your data, you will present both sides of the issue to the class in a team presentation.  In an individual written report, you will summarize and react to a journal article, discuss your fieldwork preparation, and reflect on your topic.

```

##### Match 3 — 🔵 **conf 0.52** &nbsp;words 266 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Children are thought to be indebted to their parents and this debt lies in the idea of filial duty (“Treating parents re**

_AI rationale:_ The narrative describes traditional and contemporary family structures, roles, and dynamics in South Korean culture—directly addressing how family structures and roles change across time and cultural contexts. While cultural competence (19.d) is secondarily relevant, the content's primary focus on family system transformation aligns best with Standard 12.c.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.c — Knowledge, Theory, Skills, and Values

Prompt: Changing family structures and roles.

Response:
Children are thought to be indebted to their parents and this debt lies in the idea of filial duty (“Treating parents respectfully at all times, taking care of them in their old age, mourning them at proper funerals, and performing ceremonies for them after their deaths”) (The Value and Meaning of the Korean Family). The “children’s debt to their parents” goes further along, entailing that maintaining the family line is a must as well (The Value and Meaning of the Korean Family). Traditional South Korean families include children eventually leaving the home but living close by (The Value and Meaning of the Korean Family). Young children are “indulged” and are not disciplined until they are older (The Value and Meaning of the Korean Family). Parents also began separating girls and boys and trained children to be respectful to their elders, not being respectful to elders resulting in punishment (The Value and Meaning of the Korean Family). Girls were seen as outsiders that will eventually leave the family and, traditionally, many of them were not taught to read or to write (The Value and Meaning of the Korean Family). She was taught that her place in the family was inferior to that of her male siblings, and that of her father (The Value and Meaning of the Korean Family). In today’s South Korean household however due to democracy and urbanization, both girls and boys are entitled to an education and are both treated more equally in the household, although it is expected for the girls to take on more household tasks and chores when they get older.

```

##### Match 4 — 🔵 **conf 0.52** &nbsp;words 71 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Part two: In addition to a family “issue” you will be assigned a particular theory. You will need to research how your a**

_AI rationale:_ The section describes an assignment requiring students to research and demonstrate how a specific theoretical approach addresses a family issue, directly aligning with Standard 12.c on changing family structures and roles and theoretical knowledge. The emphasis on family systems theory application best matches the family-focused specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.c — Knowledge, Theory, Skills, and Values

Prompt: Changing family structures and roles.

Response:
Part two: In addition to a family “issue” you will be assigned a particular theory. You will need to research how your assigned issue would be addressed within this theory. For example if your issue was “alcoholism within the family” and your assigned theory was “solution-focused” you would need to research how a solution-focused family therapist would address alcoholism in the family. Your group will then do a demonstration of this

```

##### Match 5 — 🔵 **conf 0.52** &nbsp;words 62 &nbsp; `review_low_confidence`

_Source heading from doc:_ **You will be assigned to “families”. These families will be the subjects of the role plays we will do in class. In additi**

_AI rationale:_ The section describes a classroom assignment using family role-plays with assigned family structures, issues, and theoretical approaches. This directly addresses family structures and roles as a knowledge/theory domain. While group facilitation (12.b) is a secondary fit given the workgroup component, the primary focus is family dynamics and applying theory to family systems.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.c — Knowledge, Theory, Skills, and Values

Prompt: Changing family structures and roles.

Response:
You will be assigned to “families”. These families will be the subjects of the role plays we will do in class. In addition, your “family” will be your workgroup for the completion of this assignment. Your “family” will be assigned an “issue” or issues that bring you to therapy and will also be assigned a theory from which to approach this issue.

```

##### Match 6 — 🔵 **conf 0.42** &nbsp;words 233 &nbsp; `review_low_confidence`

_Source heading from doc:_ **When it comes to family structure, family background and educational level are important considerations when in search o**

_AI rationale:_ The section describes changing family structures, roles, and cultural practices in South Korea (marriage customs, household composition, inheritance patterns), directly addressing Standard 12.c's specification on 'Changing family structures and roles.' This is illustrative content about family systems that human service professionals must understand.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.c — Knowledge, Theory, Skills, and Values

Prompt: Changing family structures and roles.

Response:
When it comes to family structure, family background and educational level are important considerations when in search of a partner (South Korea). This is where the old and the new may collide, as some individuals have love marriages, but some may meet their spouse through arranged meetings by parents, relatives, friends, or matchmakers (South Korea). Marriage in itself is seen as a right of passage that comes with its own social status as well, and it is seen as a union of their families as well in order to ensure the continuation of the husband’s family line (South Korea). Remarriages are rare, and in some instances, in more traditional locales, remarriages of widows are not allowed and remarriages after a divorce are difficult (South Korea). The South Korean familial household mostly consists of two-generation households, three-generation households are more traditional, but that in itself is fading and only 14.7% of the total population belonged to a three-generation household in 1995 (South Korea). When it comes to inheritance, it was nationally known for the eldest son to receive a larger portion of the parent’s inheritance because it is more common for the eldest son to be held against higher standards and be given most of the responsibility (South Korea). In 1989 however, after a revision of the Family Law, it re-stated that family inheritance must be divided “equally among sons and daughters (South Korea).

```

##### Match 7 — 🔵 **conf 0.42** &nbsp;words 235 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Although progression, industrialization and democratization has revolutionized a woman’s role in South Korean society, t**

_AI rationale:_ The passage analyzes changing family and gender roles in South Korean society, including evolving women's participation and activism. While the content touches on social change and activism (12.g), the primary focus on family structure and gender role transformation aligns best with Standard 12.c on changing family structures and roles.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.c — Knowledge, Theory, Skills, and Values

Prompt: Changing family structures and roles.

Response:
Although progression, industrialization and democratization has revolutionized a woman’s role in South Korean society, traditional gender roles are highly favored (South Korea). House work is regarded as woman’s work even when a woman has a profession outside of the home (South Korea). Women in the workforce often also get paid less than men, and men overrepresent the workforce as well as the population within their political system (South Korea). The law also calls for equality of all citizens, regardless of gender; but that is not the norm, and these norms (gender role ideologies) often complicate things in multiple ways (South Korea). Women are allowed to do things such as run for presidency or for high power positions, but because of the norm of them being submissive towards men in social settings, it makes it quite difficult for women to actually run and succeed (South Korea); although in private, men often leave decision making to their wives (South Korea). This norm however, does not mean that women do not often fight to change it (South Korea). There are women’s movement whose goals are to protect women’s rights as well as improve their status (South Korea). In response to this activism, men organized the first National Men’s Association due to reverse sexism, and they enacted to prevent violence and sexual harassment that favor women and fight to abolish exclusively male duties such as military service (South Korea).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `12.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An introduction to the organizational structures of communities._

**→ Imported as NARRATIVE** (`narratives[12][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 220 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses 'An introduction to the organizational structures of communities,' which is the exact language of Standard 12.d. The narrative documents how this content is integrated across multiple courses (CHS 101, CHS 105, CHS 430, SOC 101) and field placements, with explicit evaluation of student competency in understanding community organizational structures.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.d — Knowledge, Theory, Skills, and Values

Prompt: An introduction to the organizational structures of communities.

Response:
An introduction to the organizational structures of communities.Response: The organizational structures of communities are introduced in CHS 101 Family Studies, particularly in the units on Work and Family Life, and Family Social Policy, although the social structures of communities affect families in all areas.   The organizational structures of communities are also addressed in CHS 105 Human Services and Social Policy through lectures and discussions, notably in the unit on Social Policy and Intervention. A community needs assessment was added as a major assignment in the course following the previous accreditation self-report.In CHS 430 Family Dynamics and Interventions, the organizational structures of communities are considered as they relate to family dynamics. See the unit on Family as a Psychosocial System (9/12). The material is covered through lecture, discussion, readings, reflections and written assignments. Field Placement courses CHS 380 Internship, CHS 440 Practicum. and CHS 441 Seminar require students to understand the organizational structures of the communities within which they work at their agencies. Each student is evaluated on their ability to “demonstrate knowledge about the customs, practices, beliefs and values of the cultures and communities within which he or she practices” (see Student Evaluation Form, Section IV.B)An introduction to the organizational structures of communities is included in the required course SOC 101 (in-class activities, discussions, media presentations, lectures, and assigned readings).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][d].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `12.e` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of the capacities, limitations, and resiliency of human systems._

**→ Imported as NARRATIVE** (`narratives[12][e].content`):

##### Match 1 — 🟢 **conf 0.95** &nbsp;words 296 &nbsp; `auto_accept`

_Source heading from doc:_ **e.**

_AI rationale:_ The section directly addresses understanding the capacities, limitations, and resiliency of human systems, which is the exact language of Standard 12.e in the current 2025 spec. The narrative describes how this understanding is taught across multiple courses including CHS 101, 365, 105, 224, 340, 430, and field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.e — Knowledge, Theory, Skills, and Values

Prompt: An understanding of the capacities, limitations, and resiliency of human systems.

Response:
An understanding of the capacities, limitations, and resiliency of human systems.Response: Theories related to the capacities, limitations and resiliency of human systems are a main topic in CHS 101 Family Studies.  In particular, resiliency is covered in the unit on Stress and Crisis in Relationships. The topic is addressed through reading, lectures and discussions. A new elective course has been added to the curriculum recently entitled CHS 365 Coping, Resilience and Growth-Focused Counseling. It will be taught by Dr. Swisher for the first time in the spring of 2020. CHS 105 Human Services and Social Policy focuses throughout the semester on the helping process, which is fundamentally about working within the limitations of human systems to create change.  See particularly chapters on the Helping Process and Social Policy and Intervention.  In CHS 224 Research Methods and Writing, students discuss the process of conducting research, including guidelines for using human subjects, as a system. In addition they explore how the capacity and limitations of human systems can be measured. CHS 340 Administration of Human Services focuses on how human systems can be effectively managed and administered. This is a theme throughout the course schedule, but see particularly the classes on 2/25 Humanizing the Organization and 4/15 Team and Coalition Building. In CHS 430 Family Dynamics and Interventions, the capacities, limitations, and resiliency of human systems is examined in the context of family dynamics. See the Group Project investigating theoretical perspectives on family therapy. The material is covered through lecture, discussion, readings, reflections and written assignments. Field Placement courses CHS 380 Internship, CHS 440 Practicum. and CHS 441 Seminar require students to reflect through journal writing and reflection papers on the capacities, limitations and resiliency of human systems as they relate to the particular agency where they work.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][e].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `12.f` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Emphasis on context and the role of intercultural fluency, including cultural group membership and individual identities in determining and meeting human needs._

**→ Imported as NARRATIVE** (`narratives[12][f].content`):

##### Match 1 — 🔵 **conf 0.68** &nbsp;words 218 &nbsp; `review_low_confidence`

_Source heading from doc:_ **While talking about being white, DiAngelo mentions that everyone has their own experience and promoting the concept of u**

_AI rationale:_ The student reflection directly engages intercultural fluency and how cultural group membership (race, neighborhood demographics) shapes individual experience and perception, central to 12.f's emphasis on context and cultural group membership in determining needs. The narrative demonstrates critical examination of systemic bias and stereotype—reflective of curriculum integration on cultural self-awareness.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.f — Knowledge, Theory, Skills, and Values

Prompt: Emphasis on context and the role of intercultural fluency, including cultural group membership and individual identities in determining and meeting human needs.

Response:
While talking about being white, DiAngelo mentions that everyone has their own experience and promoting the concept of universalism fails in allowing people to feel that their experience is real. Furthermore, the concept of individualism is also knocked by claiming that it is perpetuated by the dominant group (white). My main issue with both of her statements is that is appears that she does not have a clear answer as to what stance we should have (individualism vs universalism). When I was going through primary school I lived in a predominantly white suburb and often had one or two black people in school. As I went on to high school, I was accepted into a magnet program that was in a neighborhood people often felt was unsafe and impoverished. When I told my friends and certain family members I was told to be careful because I might get stabbed. The school was no longer mostly white and in fact was dominated by people of color. Through that experience I was able to see that the neighborhood was no more dangerous than the other neighborhoods, but rather people just viewed it as such because the dominant group was no longer white. Weed was extremely prevalent in the area, yet the “nice, white school” had many students overdosing on heroin.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][f].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `12.g` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism._

**→ Imported as NARRATIVE** (`narratives[12][g].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 245 &nbsp; `auto_accept`

_Source heading from doc:_ **g.**

_AI rationale:_ The section directly addresses processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism—exact language match to Standard 12.g specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.g — Knowledge, Theory, Skills, and Values

Prompt: Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism.

Response:
Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism.Response: Effecting social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism is a recurring and fundamental topic in CHS 340 Administration of Human Services (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment). This course focuses on the skills required for the development, delivery and administration of human services programs. It emphasizes the organizational and work related issues in human services and addresses how one effects social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism.In CHS 105 Human Services and Social Policy a major assignment has been added on assessing the needs of a community and part of that project involves discussions of how those needs can be met through advocacy and community organization. Effecting social change through advocacy is also addressed in CHS 101 Family Studies (lectures and assigned readings), CHS 220 Diversity and Cultural Competence (lectures, assigned reading and discussions), CHS 380 Internship (class discussions), CHS 430 Family Dynamics and Interventions (lectures), and CHS 441 Seminar (discussions, assigned readings). CHS 224 Research Methods and Writing covers the use of research to support advocacy. SOC 101 also addresses this area through in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][g].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `12.h` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession._

**→ Imported as NARRATIVE** (`narratives[12][h].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 135 &nbsp; `auto_accept`

_Source heading from doc:_ **h.**

_AI rationale:_ The section directly addresses processes to analyze, interpret, and effect policies and laws at local, state, and national levels influencing service delivery systems, which matches Standard 12.h specification language precisely. The narrative response documents curricular coverage through specific courses and field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.h — Knowledge, Theory, Skills, and Values

Prompt: Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession.

Response:
Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems.Response:The analysis, interpretation, and effect of policies and laws at local, state, and national levels that influence services delivery systems is a recurring and fundamental focus in CHS 340/540 (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment; see CHS 340 Administration of Human Services syllabus). It is also addressed in CHS 105 Human Services and Social Policy (in-class activities discussions, lectures, and assigned readings), CHS 224 Research Methods and Writing (the role of research in analyzing policies and influencing delivery systems), and CHS 430 Family Dynamics and Interventions (lecture).Field Placements CHS 380 and CHS 440.This area is also addressed in SOC 101 (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment).

```

##### Match 2 — 🟢 **conf 0.87** &nbsp;words 66 &nbsp; `auto_accept`

_Source heading from doc:_ **STANDARD 12 Human service professionals are aware of local, state, and federal laws. They advocate for change in regulat**

_AI rationale:_ The section content directly addresses processes to analyze, interpret, and effect policies and laws at local, state, and national levels, including advocacy for legislative change when laws conflict with ethical guidelines and client rights—the core substance of Standard 12.h.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.h — Knowledge, Theory, Skills, and Values

Prompt: Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession.

Response:
STANDARD 12 Human service professionals are aware of local, state, and federal laws. They advocate for change in regulations and statutes when such legislation conflicts with ethical guidelines and/or client rights. Where laws are harmful to individuals, groups, or communities, human service professionals consider the conflict between the values of obeying the law and the values of serving people and may decide to initiate social action.

```

##### Match 3 — 🟡 **conf 0.82** &nbsp;words 288 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **f.**

_AI rationale:_ The section directly addresses skills to analyze and interpret historical data for application in advocacy and social change, which maps most precisely to Standard 12.h's specification on processes to analyze, interpret, and effect policies and laws that influence service delivery systems. The narrative demonstrates how students learn to apply historical data and research methods to influence policy and interventions across multiple courses.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.h — Knowledge, Theory, Skills, and Values

Prompt: Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession.

Response:
Skills to analyze and interpret historical data for application in advocacy and social change.Response: Coverage of skills to analyze and interpret historical data for application in advocacy and social change is accomplished through in-class activities, discussion, lecture, and assigned reading, in CHS 101 Family Studies. In this course, students learn about the historical and social roots of each topic addressed and consider ways that current conditions could be changed to benefit families (see particularly “Marriage Relationships,” “Same-Sex Couples” and “Family Social Policy”). In CHS 105 Human Services and Social Policy,  the historical roots of helping are examined and the notion of advocacy is introduced through the helping process and through social policy and intervention. See especially the assignment  “Issue Presentation and Report.”CHS 224 Research Methods and Writing is fundamentally about the application of data to influence social policy and interventions. See particularly week 2 in course schedule on the foundations of social science research and the unit on historical/comparative research (week 12). The central project for the course is that students develop a detailed Research Proposal on a topic related to human services.CHS 430 Family Dynamics and Interventions addresses the use of data to support different types of family therapy interventions through a group project where student groups analyze in-depth different models of family therapy, both current and historical. The analysis includes historical data on the effectiveness of each approach (see the Group Project assignment for detail and a list of the models covered).Skills to analyze and interpret historical data for application in advocacy and social change are also developed in the field placement courses CHS 380 Internship, CHS 440 Practicum and CHS 441 Seminar in that students practice these skills as they relate to their particular agency.

```

##### Match 4 — 🔵 **conf 0.52** &nbsp;words 55 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Provides the student with an opportunity to learn the effects of a variety of physical, personal, psychological and soci**

_AI rationale:_ The section describes learning outcomes about older adults' physical, psychological, and social issues—content that directly exemplifies the human service delivery systems context (aging as an identifiable human condition) and the range of populations served. Standard 12.h's reference to identifiable human conditions including aging, and the focus on how these conditions shape service delivery systems, is the most precise match.

**Exact text that will be written to the narrative slot:**

```text
Standard 12.h — Knowledge, Theory, Skills, and Values

Prompt: Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession.

Response:
Provides the student with an opportunity to learn the effects of a variety of physical, personal, psychological and social issues faced by older adults and their families. Emphasis is placed on functional health status, social roles, social relationships, family issues, and the impact of these factors on specific services and the community at all levels.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[12][h].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 13

### `13.a` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The range and characteristics of human service delivery systems and organizations._

**→ Imported as NARRATIVE** (`narratives[13][a].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 407 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly addresses the range and characteristics of human service delivery systems and organizations through multiple courses and instructional methods, matching Standard 13.a specification language exactly. The narrative maps curriculum to this foundational knowledge requirement.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.a — Knowledge, Theory, Skills, and Values

Prompt: The range and characteristics of human service delivery systems and organizations.

Response:
The range and characteristics of human services delivery systems and organizations.Response:The range and characteristics of human services delivery systems and organizations is offered in CHS 101, CHS 105, CHS 224, CHS 430, CHS 380, CHS 440 and CHS 441.  In CHS 101 Family Studies, students are introduced to this material by assigned reading and in corresponding in-class discussion and lecture.  In addition, students in CHS 101 are assigned an article review which includes these issues and are given a group assignment involving written reports, individual data collection, and classroom presentations. This second assignment focuses on a human service related issue and the delivery, organization, and characteristics of services related thereto.CHS 105 Human Services and Social Policy focuses on human services delivery systems and organizations. This subject matter is conveyed by in class activity (CHS 105 Syllabus) and through an out-of-class assignment in which students research the needs of a particular community and prepare a written report and a group oral presentation related to these issues (Team Research Project). Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  In CHS 224 Research Methods and Writing students develop a grant proposal narrative that reflects the intricacies of how services are planned, funded and administered. CHS 380 Internship addresses human services delivery systems, organization, and characteristics through in-class discussion (students discuss their particular internship site systems, organizations, and characteristics) and through journaling. These topics are also covered through orientation and participation at each student’s placement, in preparation of each student’s portfolios, and Reflection Papers.  Lecture by the instructor and several guest speakers who discuss the human services delivery systems, organization, and characteristics of their respective sites is a significant part of the CHS 380 course. CHS 430 Family Dynamics and Interventions addresses human services delivery systems, organization, and characteristics as they are associated with treatment of family issues through lecture and corresponding outside reading (CHS 430 syllabus) and in group presentations by students (Group Project).  Finally, this specification is conveyed through lecture, readings, in-class activities and discussions in the CHS 441 “Seminar in Human Services” course and further by weekly journaling and participation in the student’s respective practicum sites.Required courses in other majors which address the range of human services delivery systems, organization, and characteristics include PSY 101 (lecture, class discussion, assignments, and reading.), PSY 108 (lecture, class discussion, assignments, and reading.), and SOC 101 (lecture, discussion, and reading.).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[13][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `13.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The range of populations served, and needs addressed by human services professionals._

**→ Imported as NARRATIVE** (`narratives[13][b].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 215 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses the range of populations served and needs addressed by human services professionals across multiple courses, matching the exact language of Standard 13.b in the current 2025 spec.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.b — Knowledge, Theory, Skills, and Values

Prompt: The range of populations served, and needs addressed by human services professionals.

Response:
The range of populations served and needs addressed by human services professionals.Response:The range of populations served and needs addressed by human services professionals are fundamental topics in: CHS 340 Administration of Human Services (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment); CHS 105 Human Services and Social Policy (in-class activities, discussions, lectures, assigned readings, and out-of-class assignment; see the 4th unit on Special Groups, the Field Experience Assignment and the Team Research Project); CHS 220 Diversity and Cultural Competence in the context of diversity issues (in-class activities, discussions, lectures, assigned readings, and out-of-class assignment); CHS 224 Research Methods and Writing in relation to research demonstrating needs and the effectiveness of interventions (in-class activities, discussions, lectures, and assigned readings) and CHS 430 Family Dynamics and Interventions in the context of family interventions (in-class activities, discussions, lectures, assigned readings, and out-of-class assignment; see Group Project).  It is also addressed in CHS 101 Family Studies (lectures and assigned readings.), CHS 380 Internship (in-class activities, discussions,), and CHS 441 Seminar (discussions, assigned readings.).  Required courses in other majors which address the range of populations served and needs addressed by human services professionals include PSY 101 (lecture, class discussion, assignments, and reading.), PSY 108 (lecture, class discussion, assignments, and reading.), and SOC 101 (lecture, discussion, and reading.).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[13][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `13.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning._

**→ Imported as NARRATIVE** (`narratives[13][c].content`):

##### Match 1 — 🟢 **conf 0.95** &nbsp;words 441 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses how the program teaches 'the major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning' through multiple courses and pedagogical methods, which is the exact language of Standard 13.c.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.c — Knowledge, Theory, Skills, and Values

Prompt: The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning.

Response:
The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning.Response:The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning are presented in CHS 101, CHS 201, CHS 224, CHS 380, CHS 430, and CHS 441.  In CHS 101 Family Studies, students are introduced to this material by assigned reading and in corresponding in-class discussion and lecture (Course Objectives 1, 3, and 5.).  In addition, students in CHS 101 are assigned an article review which includes these issues (Article Review Assignment) and are given a group assignment involving written reports, individual data collection, and classroom presentations (Issues Presentation Assignment).  CHS 105 Human Services and Social Policy focuses on major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning within the context of human services agencies. This subject matter is conveyed by in class activity (CHS 105 syllabus) and through an out-of-class assignment in which students research the needs of a particular community and prepare a written report and a group oral presentation related to these issues (Team Research Project). Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 201 syllabus.  CHS 224 Research Methods and Writing addresses major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning within the context of research aimed at assessing the models (See CHS 224 syllabus).  CHS 380 Internship addresses major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning through in-class discussion (students discuss their particular internship site models) and through journaling. These topics are also covered through orientation and participation at each student’s placement, in preparation of each student’s portfolio, and Reflection Papers. Lecture by the instructor and several guest speakers who discuss the human services models of their respective sites is a significant part of the CHS 380 course. CHS 430 Family Dynamics and Interventions addresses major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning as they are associated with treatment of family issues through lecture and corresponding outside reading and in group presentations by students (Group Project).Finally, this specification is conveyed through lecture, readings, in-class activities and discussions in CHS 441 Seminar Seminar in Counseling & Human Services, as well as by weekly journaling and participation in the student’s respective practicum sites.Required courses in other majors which address the major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning include PSY 101 (lecture, class discussion, assignments, and reading.), PSY 108 (lecture, class discussion, assignments, and reading.), and SOC 101 (lecture, discussion, and reading.).

```

##### Match 2 — 🟡 **conf 0.82** &nbsp;words 355 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **a.**

_AI rationale:_ The section explicitly addresses the major models and theoretical bases for prevention, intervention, and maintenance strategies across multiple courses, which directly aligns with Standard 13.c's requirement to demonstrate knowledge of these conceptual models and their integration for healthy functioning.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.c — Knowledge, Theory, Skills, and Values

Prompt: The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning.

Response:
Theory and knowledge bases of prevention, intervention, and maintenance strategies.Response:The application of prevention, intervention, and maintenance strategies is a fundamental principle that is covered in the following courses: CHS 101, 105, 224, 315/515, 360, 340, 430, 380, 440 and 441.The theoretical basis for prevention and intervention strategies is introduced in CHS 101 Family Studies (schedule first two weeks).In CHS 105 Human Services and Social Policy, in depth consideration of the goals and purpose of the helping process emphasize prevention and the goal of achieving maximum autonomy. CHS 224 Research Methods and Writing treats this goal as an important outcome measure for assessing programs (see the research proposal project).The application of prevention, intervention, and maintenance strategies is a primary focus of both CHS 315/515 Group Counseling (as an outcome of group process) CHS 360 Counseling Strategies for Individuals (related to individual counseling). In CHS 340 Administration of Human Services, the application of prevention, intervention, and maintenance strategies is analyzed as a vital part of effectively administering an agency (see Strategic Plan Appraisal in schedule). CHS 430 Family Dynamics and Interventions addresses these strategies as associated with the treatment of family issues and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention model.  The class then discusses how the presenting group addressed the application of prevention, intervention, and maintenance strategies through their intervention program.Prevention, intervention, and maintenance strategies are addressed in CHS 380 Internship and CHS 440 Practicum as an integral part of the field placement experiences and through class discussion, assigned readings, and journaling. In CHS 380, guest speakers, who discuss these strategies within their respective sites, are a significant part of the course. Students are evaluated on their ability to “demonstrate knowledge of how individuals and/or families develop and function” and “apply meaningful connection between classroom learning and experience in the field” (See Student Field Placement Evaluation, Section VI).  Required courses in other majors which address theory and knowledge bases for interventions include PSY 101 and PSY 108 (taught through in-class activity and discussion, in-class media presentation, lecture, assigned readings, and out-of-class assignments).

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 98 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Examines current theories, research and practices relating to resilience, coping and growth-focused counseling. Students**

_AI rationale:_ The narrative describes theories and practices for resilience, coping, and growth-focused counseling that directly align with Standard 13.c's emphasis on models conceptualizing prevention, maintenance, intervention, rehabilitation, and healthy functioning. The content on flourishing, positive psychology, wellness, and character strengths exemplifies integration of healthy functioning frameworks.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.c — Knowledge, Theory, Skills, and Values

Prompt: The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning.

Response:
Examines current theories, research and practices relating to resilience, coping and growth-focused counseling. Students learn to apply the science of flourishing and use empirical and experiential approaches to help clients enhance their lives. Students explore the importance of self-care and resilience in advancing their own personal and professional growth. Topics covered include the mental states of flow, mindfulness, happiness, pleasure, contentment, optimism and other positive emotions, character strengths, values, goal setting, wellness, the mind-body connection, self-esteem, meaningful relationships, and enabling institutions exemplified by positive education, positive work environments, healthy families, humane leadership, and the development of civic virtues.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 217 &nbsp; `review_low_confidence`

_Source heading from doc:_ **3. Transgenerational. (Bowen).Thinking, feeling, and behaving are tied to the family system. The individual’s problems a**

_AI rationale:_ The section presents multiple theoretical models (Bowen, Minuchin, Haley, Beck, Ellis, deShazer, Anderson, White) for conceptualizing and addressing family and individual problems across intervention contexts, directly matching Standard 13.c's requirement to cover major models for conceptualizing prevention, intervention, and healthy functioning.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.c — Knowledge, Theory, Skills, and Values

Prompt: The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning.

Response:
3. Transgenerational. (Bowen).Thinking, feeling, and behaving are tied to the family system. The individual’s problems arise and are maintained by relationship connections. Problems are passed from one generation to the next. Fusion = most vulnerable; Differentiation of self = least vulnerable.4. Structural. (Minuchin). Focuses on how families are organized and what rules govern their transactions. Pays attention to rules, roles, alignments, coalitions, and boundaries. Challenges rigid, repetitive transactions within a family, helping to “unfreeze” them and allow family reorganization.5. Strategic. (Haley).Assigns tasks to get family to change aspects of the system that maintain problematic behavior. Paradoxical interventions are employed to force clients to abandon symptoms. NOT interested in providing insight.6. Cognitive-Behavioral. (Beck and Ellis).Maladaptive behaviors can be extinguished as the contingencies of reinforcement are altered. Focuses on communication skills, parent training skills, cognitive restructuring, etc.7. Social Constructionist. (deShazer and Anderson).Suggests that each of our perceptions is not an exact duplication of the world, rather, a point of view seen through the limiting lens of our assumptions about people. Therapy involves jointly constructing new options that change past accounts and allow new alternatives.8. Narrative. (Michael White).Our sense of reality is organized and maintained through stories.Families present with negative, dead-end stories. The goal is to explore alternative stories, make new assumptions, and open up new possibilities by re-authoring stories.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[13][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.62** &nbsp;words 59 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Prepares students with the knowledge and skills required to effectively assess and treat persons with substance abuse pr**

_AI rationale:_ This course description covers assessment and treatment of substance abuse and addiction disorders, aligning with Standard 13.c's focus on major models used to conceptualize prevention, intervention, and rehabilitation. The emphasis on assessment, counseling approaches, and case management directly supports knowledge of intervention and rehabilitation frameworks.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 13.c — Knowledge, Theory, Skills, and Values

Prepares students with the knowledge and skills required to effectively assess and treat persons with substance abuse problems and other addiction disorders.  Topics include theory and techniques of assessment and counseling approaches for individuals with addiction disorders, working with family and significant others, dynamics of counseling special populations, and case management.  This course is taken concurrently with CHS 370.

```

---

### `13.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of systemic causes of poverty and its implications._

**→ Imported as NARRATIVE** (`narratives[13][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 255 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses 'an understanding of systemic causes of poverty and its implications' by listing specific courses (CHS 101, 201, 220, 224, 430, and field placements) where this content is taught. This matches verbatim the Standard 13.d specification language.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.d — Knowledge, Theory, Skills, and Values

Prompt: An understanding of systemic causes of poverty and its implications.

Response:
An understanding of systemic causes of poverty and its implications.Response:An examination of systemic causes of poverty and its implications, is included in CHS 101, CHS 201, CHS 220, CHS 224 and CHS 430, as well as in field placements CHS 380, 440 and 441.  In CHS 101 Family Studies, students are introduced to this material within a “Family Studies” context by assigned reading and in corresponding in-class discussion and lecture.  CHS 105 Human Services and Social Policy addresses economic and social class systems including systemic causes of poverty within the context of human services agencies. This subject matter is conveyed by in class activities and assignments (Team Research Project). Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 201 syllabus.  CHS 220 Diversity and Cultural Competence addresses issues of economic and social class systems, including systematic causes of poverty, as a component of diversity and cultural competence. CHS 224 Research Methods and Writing includes analysis of studies documenting these social issues. CHS 430 addresses economic and social class systems including systemic causes of poverty as they are associated with treatment of family issues through lecture and corresponding outside reading (CHS 430 Family Dynamics and Interventions syllabus) and in group presentations by students (Group Project).  Field Placements CHS 380 and CHS 440.Required courses in other majors which address the systemic causes of poverty include PSY 101 (lecture, class discussion, assignments, and reading.), PSY 108 (lecture, class discussion, assignments, and reading.), and SOC 101 (lecture, discussion, and reading.).

```

##### Match 2 — 🔵 **conf 0.78** &nbsp;words 168 &nbsp; `review_low_confidence`

_Source heading from doc:_ **DiAngelo opens with how our country was founded on race and unequal power, she uses an example that could be understood **

_AI rationale:_ The section explicitly analyzes systemic causes linking race, institutional power, poverty, wage inequality, and neighborhood segregation—directly addressing the spec's requirement for understanding systemic causes of poverty and its implications in human service contexts.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.d — Knowledge, Theory, Skills, and Values

Prompt: An understanding of systemic causes of poverty and its implications.

Response:
DiAngelo opens with how our country was founded on race and unequal power, she uses an example that could be understood by the masses explaining how men gave women the right to vote. She claims that this practice continues through “group prejudice backed by institutional power.” Her claim is easily seen through school and neighborhood segregation, she notes that bad neighborhoods are considered neighborhoods with people of color. What she fails to address about the school and neighborhood segregation is why this occurs; lower class neighborhoods are generally filled with people of color because of the cycle of poverty, statistics reveal that people of color are paid less than their white counterparts as well as the fact that women of color are paid even less then men of color. White supremacy is the dominant factor in these examples. While I feel that she does address neighborhood segregation she fails to address the cause (poverty) and without, there is a loss in the value of the information she presents.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[13][d].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `13.e` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _An understanding of national and global social policies and their influence on human service delivery._

**→ Imported as NARRATIVE** (`narratives[13][e].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 215 &nbsp; `auto_accept`

_Source heading from doc:_ **e.**

_AI rationale:_ The section directly addresses the specification 'An understanding of national and global social policies and their influence on human service delivery' by documenting courses (CHS 101, 105, 220, 430) and assignments that teach this content.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.e — Knowledge, Theory, Skills, and Values

Prompt: An understanding of national and global social policies and their influence on human service delivery.

Response:
An understanding of national and global social policies and their influence on human service delivery.Response:National and global social policies are addressed is CHS 101, CHS 201, CHS 220, and CHS 430.  In CHS 101 Family Studies, students are introduced to this material by assigned reading and in corresponding in-class discussion and lecture (see schedule). CHS 105 Human Services and Social Policy addresses national and global aspects of human services (Course Objectives 3, 4, 5, and 6.). This subject matter is conveyed by in class activities, readings and discussion. Lecture and reading about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.In CHS 220 Diversity and Cultural Competence, students complete a detailed report on a country of their choice and present it to the class. This assignment leads to discussions of global issues in human services delivery (see sample of a country report).  CHS 430 Family Dynamics and Interventions covers these issues in the context of family systems and specifically through lecture and discussion of international study of family therapy (e.g., Milan Therapy; see schedule).Field Placements CHS 380 and CHS 440.Required courses in other majors which address national and global social policy issues include PSY 101 (lecture, class discussion, assignments, and reading.) and SOC 101 (lecture, discussion, and reading.).

```

##### Match 2 — 🔵 **conf 0.68** &nbsp;words 253 &nbsp; `review_low_confidence`

_Source heading from doc:_ **In regard to the LGBTQ+ community, South Korea, especially within the Christian population of South Korea, is primarily **

_AI rationale:_ The section describes South Korea's national social policies regarding LGBTQ+ rights, discrimination protections, and government actions (censorship, military service restrictions, marriage recognition) and their influence on the LGBTQ+ community's access to services and civil participation—directly addressing how national and global social policies influence human service delivery and equity.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.e — Knowledge, Theory, Skills, and Values

Prompt: An understanding of national and global social policies and their influence on human service delivery.

Response:
In regard to the LGBTQ+ community, South Korea, especially within the Christian population of South Korea, is primarily conservative (Manzella, 2018). There have never been official laws that prohibit sex marriage or homosexual sex, but being gay, lesbian, or transgender is still a cultural taboo; most of the homosexual population in South Korea is still closeted (Manzella, 2018). Also, although there have not been laws specifically prohibiting same-sex marriage, this type of marriage is not recognized by the government and the population does not have laws against discrimination (Manzella, 2018). South Koreans who identify as LGBTQ+ are unable to adopt children or serve in the military (Manzella, 2018). Through censorship, the government has blocked same-sex dating apps and Korean Christian organizations often fuel campaigns that spread the message of marriage strictly being between a man and a woman (Manzella, 2018). Specifically with transgender individuals, only when they surgically change their sex can they officially change their sex from a male to a female or a female to a male (Manzella, 2018). Despite all of these bumps on the road for South Korea’s LGBTQ+ population, more than half of South Korean’s overall population supports same-sex marriage (Manzella, 2018). Korea is home to an annual pride event that occurs annually, as well as a Queer Culture Festival (although it had to go to court due to police banning this event) (Manzella, 2018). The progress is slow, it is an ongoing battle, but the LGBTQ+ community is is slowly but surely gaining momentum is South Korea.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[13][e].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `13.f` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing. 4. Discipline Inquiry and Information Literacy Context: The delivery of human services depends on the appropriate integration of various forms of information._

**→ Imported as NARRATIVE** (`narratives[13][f].content`):

##### Match 1 — 🟡 **conf 0.72** &nbsp;words 580 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **a.**

_AI rationale:_ The section describes curriculum across 11 courses teaching students to obtain, synthesize, and clearly report information from various sources—core to information literacy and discipline inquiry. Standard 13.f explicitly addresses 'Discipline Inquiry and Information Literacy' with context stating 'The delivery of human services depends on the appropriate integration of various forms of information,' matching the narrative's emphasis on research methods, critical analysis, and multi-source information synthesis.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.f — Knowledge, Theory, Skills, and Values

Prompt: Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing. 4. Discipline Inquiry and Information Literacy Context: The delivery of human services depends on the appropriate integration of various forms of information.

Response:
Obtain, synthesize, and clearly report information from various sources.Response: (see observation of systems below)Skills to obtain, synthesize, and clearly report information are provided in the following human services courses:  CHS 101, 105, 217, 220, 224, 315, 360, 380, 430, 440, and 441. CHS 101 Family Studies introduces the process of gathering information through library research, particularly in the Issue Presentation project. CHS 105 Human Services and Social Policy addresses skills to gather information through client observation, interviewing, active listening, consultation with others, library or other research, and the observation of clients and systems (See Course Objectives 2, 3, 4, 5, and 7). This subject matter is conveyed by in-class activity and a group assignment also related to these issues (Team Research Project). Lectures about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  As of Fall 2019, a new course CHS 217 Professional Development in Counseling & Human Services will be required. This course will incorporate professional writing and communication skills and career-related information gathering.  CHS 220 Diversity and Cultural Competence addresses skills to gather information through client observation, interviewing, active listening, consultation with others, and library or other research (Course Objective 1, 2, 3, 4, and 5).  This is accomplished through in-class activities and discussion, media presentations, lecture, assigned readings, and out-of-class assignments. Students obtain, synthesize and report information in the country research project. CHS 224 Research Methods and Writing focuses extensively on the skill of gathering information through reviewing research literature. See particularly the critical analysis assignment. This course is designated as a “writing intensive” course and the skills related to clearly communicating information that has been obtained are strongly emphasized. CHS 360 Counseling Strategies for Individuals addresses skills to gather information through client observation, interviewing, active listening, consultation with others, library or other research, and the observation of clients and systems in the context of “Counseling Strategies for Individuals” through in-class activity and discussion (Course Requirement 1), lecture and assigned readings corresponding to the syllabus “Schedule of Classes”, and out-of-class assignments (Course Requirement 3 “Papers”).  CHS 315 Group Counseling emphasizes the skills of gathering information through active listening, particularly in a group context (see specifically an assigned paper on group leadership). CHS 380 Internship addresses skills to gather information through client observation, interviewing, active listening, consultation with others, library or other research, and the observation of clients and systems through in-class discussion (students discuss their particular internship site approaches) and through journaling (Course Requirements/Assignments 1, 3). These topics are also covered through orientation and participation at each student’s placement, in preparation of each student’s portfolios (Course Requirements/Assignments 4.), and Reflection Papers (Course Requirements/Assignments 5.).  Lecture is provided by the instructor and several guest speakers who discuss how they gather information through client observation, interviewing, active listening, consultation with others, and library or other research. CHS 430 Family Dynamics and Interventions addresses skills to obtain, synthesize and report information as they are associated with treatment of family issues through lecture and corresponding outside reading (see class schedule) and in group presentations by students (Group Project).  In addition, students are taught and practice how to use genograms, ecomaps, and other counseling tools for gathering information effectively (Family of Origin Project).CHS 440 Practicum and CHS 441 Seminar emphasize skills to obtain information as part of the actual practicum placements, journaling, evaluations, and seminar.Required courses in other majors which address skills to obtain and report information include SOC 101, PSY 101, and PSY 108.

```

##### Match 2 — 🔵 **conf 0.68** &nbsp;words 146 &nbsp; `review_low_confidence`

_Source heading from doc:_ **f.**

_AI rationale:_ The section directly addresses constituency building and advocacy skills including lobbying, grassroots movements, and community development and organizing, which matches the exact language in Standard 13.f. The narrative documents how these competencies are integrated across multiple courses (CHS 101, 105, 220, 224, 430, 380, 440) and field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 13.f — Knowledge, Theory, Skills, and Values

Prompt: Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing. 4. Discipline Inquiry and Information Literacy Context: The delivery of human services depends on the appropriate integration of various forms of information.

Response:
Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing.Response:Constituency building and advocacy issues are introduced in CHS 105 Human Services and Social Policy and are a significant part of the Community Needs assignment. These issues are also addressed in CHS 101, CHS 220, CHS 224, and CHS 430.  In CHS 101 Family Studies, advocacy is covered specifically as it relates to family policies. CHS 220 Diversity and Cultural Competence emphasizes constituency building and advocacy in the context of diversity issues through lecture, discussion, and assignments (see specifically the Social Justice section of the schedule). CHS 224 Research Methods and Writing addresses grassroots and community development issues as they relate to compiling research to support program proposals.Field Placements CHS 380 and CHS 440.Required courses in other majors which address constituency building and advocacy include SOC 101 (lecture, discussion, and reading.).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[13][f].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 14

### `14.a` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Obtain, synthesize, and report information from various sources._

**→ Imported as NARRATIVE** (`narratives[14][a].content`):

##### Match 1 — 🟡 **conf 0.82** &nbsp;words 411 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **b.**

_AI rationale:_ The section describes skill training in assessing and analyzing client needs through observation, interviewing, active listening, consultation, and research—core competencies directly aligned with Standard 14.a (Knowledge and skills to assess client needs and strengths). Standard 14 establishes program planning and evaluation as foundational, and assessment of needs is the prerequisite step.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.a — Knowledge, Theory, Skills, and Values

Prompt: Obtain, synthesize, and report information from various sources.

Response:
Assess and analyze the needs of clients or client groups through observation, interviewing, active listening, consultation, and research.Response: The following human services courses include skill training in how to assess and analyze the needs of clients or client groups:  CHS 105, 224, 315/515, 360, 340, 430, 380, and 440.  The objectives of CHS 105 Human Services and Social Policy emphasize analyzing and addressing the needs of specific clients or client groups (Course Objectives 2, 3, 4, 5, 7, and 8.). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group using observation, interviewing, active listening, consultation, and research (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  CHS 224 Research Methods and Writing focuses on assessing and analyzing client needs as related to designing and proposing an intervention strategy (see research proposal project).CHS 315 Group Counseling addresses how to assess the needs of clients and client groups through observation, interviewing and active listening within the context of Group Counseling. All course objectives relate to this skill, but see specifically #6. The skills are conveyed through in-class activity and discussion, out-of-class assignments (Course Requirements #3 Papers and #5 Group Proposal), corresponding assigned readings, and lecture, as detailed in the course syllabus.  CHS 360 Counseling Strategies for Individuals addresses how to assess the needs of clients through observation, interviewing and active listening through in-class activity and discussion, lecture and assigned readings corresponding to the syllabus.  CHS 360 focuses on the interviewing process as one such intervention modality (see schedule). CHS 430 Family Dynamics and Interventions addresses assessing the needs of families through observation, interviewing and active listening through lecture and corresponding outside reading (see schedule) and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention.Using various strategies to assess and analyze the needs of clients or client groups is addressed in CHS 380 Internship and CHS 440 Practicum as an integral part of the field placement experiences and through class discussion, assigned readings, and journaling. In CHS 380, guest speakers, who discuss intervention approaches within their respective sites, are a significant part of the course. Students are evaluated on their ability to “apply meaningful connection between classroom learning and experience in the field” (See Student Field Placement Evaluation, Section VI).

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 411 &nbsp; `review_low_confidence`

_Source heading from doc:_ **a.**

_AI rationale:_ The section describes knowledge and skills to analyze and assess client needs across multiple courses and field placements, which directly aligns with Standard 14.a on assessing client needs and strengths as part of program planning and evaluation context. Standard 15.a (client interventions and strategies) is a secondary fit since assessment often precedes intervention design.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.a — Knowledge, Theory, Skills, and Values

Prompt: Obtain, synthesize, and report information from various sources.

Response:
Knowledge and skills to analyze and assess the needs of clients or client groups.Response:The knowledge and skills to analyze and assess the needs of clients or client groups is included in: CHS 105, 224, 360, 340, 430, 380 and 440. The objectives of CHS 105 Human Services and Social Policy include the application of skills to analyze and assess the needs of clients (Course Objectives 1 and 7). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus (See schedule).  CHS 224 Research Methods and Writing incorporates the analysis and assessment of client needs as part of the research proposal process.CHS 360 Counseling Strategies for Individuals addresses skills to analyze and assess the needs of clients within the context of individual counseling strategies (Course Objectives 2 and 3) and does so through in-class activity and discussion and out-of-class assignments (See Interview Project). CHS 360 focuses on the interviewing process as one way to analyze the needs of clients (see schedule).CHS 340 Administration of Human Services emphasizes the analysis and assessment of the needs of clients as a recurring and fundamental topic related to the effectiveness of any human services agency (in-class activities discussions, media presentations, lectures, assigned readings, and out-of-class assignment).  CHS 430 Family Dynamics and Interventions addresses how to analyze and assess the needs of clients as it is associated with treatment of family issues through lecture and corresponding outside reading (see schedule) and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention and issues.  The class then discusses how the presenting group analyzed the needs of clients, developed goals, and designed and implemented a plan of action. Analyzing and assessing the needs of clients is addressed in CHS 380 Internship and CHS 440 Practicum as an integral part of the field placement experiences and through class discussion, assigned readings, and journaling. In CHS 380, guest speakers, who discuss how they analyze and assess the needs of clients within their respective sites, are a significant part of the course.  Required courses in other majors which emphasize the application of skills to analyze and assess the needs of clients or client groups include: SOC 101 (lecture, discussion, and reading.).

```

##### Match 3 — 🔵 **conf 0.62** &nbsp;words 93 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The best way to can develop writing skills in writing literature reviews is to read others' literature reviews. The writ**

_AI rationale:_ The section addresses instruction on synthesizing and organizing information from multiple sources (literature review best practices using at least 8 primary sources), which directly aligns with Standard 14.a's requirement to 'obtain, synthesize, and report information from various sources.' This is pedagogical guidance on information literacy and research methodology.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.a — Knowledge, Theory, Skills, and Values

Prompt: Obtain, synthesize, and report information from various sources.

Response:
The best way to can develop writing skills in writing literature reviews is to read others' literature reviews. The write-up should reveal what is known about the topic generally, theoretically, and empirically, and the variables in your proposal. Your reader should have a fair knowledge of what others have said or found about your topic from the write-up.  Organize the literature review by themes or subthemes.  It’s a good idea to use your variables as themes or subthemes. WHY IS THIS TOPIC RELEVANT/ IMPORTANT/NECESSARY? Remember to Use at least eight (8) primary sources.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[14][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.42** &nbsp;words 73 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will write a research proposal that has potential for contributing to current knowledge in the student’s ch**

_AI rationale:_ The section describes an assignment requiring students to synthesize information from various sources into a research proposal, which aligns with Standard 14.a on obtaining, synthesizing, and reporting information. While portfolio/reflection elements echo 20.e, the core activity is research proposal development focused on information synthesis.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 14.a — Knowledge, Theory, Skills, and Values

Each student will write a research proposal that has potential for contributing to current knowledge in the student’s chosen topic/interest.  Students will develop this proposal, in stages, throughout the semester.  Each part of the proposal may be rewritten/improved using comments on the original version.  Students are encouraged to maintain a folder for all their work in this assignment.  This assignment, details of which are laid out in this syllabus, is worth 200 points.

```

---

### `14.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Assess the quality of information from various sources, including but not limited to print, audio, video, web, and social media, and understand its application._

**→ Imported as NARRATIVE** (`narratives[14][b].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 414 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section content directly and explicitly matches Standard 14.b, which specifies assessing quality of information from various sources (print, audio, video, web, social media) and understanding its application. The narrative maps course-by-course coverage of this exact competency.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.b — Knowledge, Theory, Skills, and Values

Prompt: Assess the quality of information from various sources, including but not limited to print, audio, video, web, and social media, and understand its application.

Response:
Assess the quality of information from various sources, including but not limited to: print, audio, video, web, and social media, and understand its application.Response:Skills to assess the quality of information from various sources are emphasized in all courses that require the gathering of information, which include: CHS 101, 105, 220, 224, 340, 380, 430, 440 and 441. CHS 101 Family Studies includes a research project in which students need to research an issue related to families and report to the class on their findings (Issue Presentation assignment). CHS 105 Human Services and Social Policy addresses skills to gather and assess the quality of information in a number of ways (See Course Objectives 1 and 7.). This subject matter is conveyed by in class activity and a group assignment related to these issues (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  CHS 220 Diversity and Cultural Competence requires students to gather and assess the quality of information related to diverse populations (see particularly the Immigrant Interview and Group Presentation assignments). CHS 224 Research Methods and Writing emphasizes the critical analysis of research findings throughout the course, but see particularly the Research Proposal project. CHS 340 Administration of Human Services addresses skills related to assessing the quality of information as a vital component of administration and management through in-class activities, discussion , lecture and assigned readings corresponding to the syllabus.  CHS 380 Internship addresses these skills through in-class discussion (students discuss their particular internship site approaches) and through journaling. These topics are also covered through orientation and participation at each student’s placement and Reflection Papers.  Lecture is provided by the instructor and several guest speakers who discuss the importance of critically assessing the quality of information. CHS 430 Family Dynamics and Interventions addresses skills to assess the quality of information in relationship to treatment of family issues through lecture and corresponding outside reading (e.g., class on genograms and ecomaps) and in group presentations by students (Group Project).  CHS 440 Practicum and CHS 441 Seminar emphasize skills to assess information as part of the actual practicum placements, journaling, evaluations, and seminar (see Issue Presentation and Poster Presentation projects).Required courses in other majors which address skills to assess the quality of information include SOC 101, and PSY 101. The newly created CHS 217 Professional Development in Counseling & Human Services will emphasize the development of skills related to the critical assessment of information as well.

```

##### Match 2 — 🔵 **conf 0.42** &nbsp;words 51 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The SU graduate will use inquiry and analysis, critical and creative thinking, scientific reasoning, and quantitative sk**

_AI rationale:_ The section describes graduates' ability to gather and evaluate evidence and solve problems using inquiry, analysis, and critical thinking—core elements of assessing information quality and application (14.b). Secondary alignment to 14.a (obtain and synthesize information) reflects the emphasis on gathering evidence from various sources.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.b — Knowledge, Theory, Skills, and Values

Prompt: Assess the quality of information from various sources, including but not limited to print, audio, video, web, and social media, and understand its application.

Response:
The SU graduate will use inquiry and analysis, critical and creative thinking, scientific reasoning, and quantitative skills to gather and evaluate evidence, to define and solve problems facing his or her communities, the nation, and the world, and to demonstrate an appreciation for the nature and value of the fine arts.

```

##### Match 3 — 🔵 **conf 0.42** &nbsp;words 51 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The SU graduate will use inquiry and analysis, critical and creative thinking, scientific reasoning, and quantitative sk**

_AI rationale:_ The section describes using inquiry, critical thinking, and evidence evaluation to solve problems—skills that align best with Standard 14.b's focus on assessing quality of information from various sources. The emphasis on gathering and evaluating evidence to address community problems matches information literacy and assessment competencies.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.b — Knowledge, Theory, Skills, and Values

Prompt: Assess the quality of information from various sources, including but not limited to print, audio, video, web, and social media, and understand its application.

Response:
The SU graduate will use inquiry and analysis, critical and creative thinking, scientific reasoning, and quantitative skills to gather and evaluate evidence, to define and solve problems facing his or her communities, the nation, and the world, and to demonstrate an appreciation for the nature and value of the fine arts.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[14][b].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.68** &nbsp;words 218 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This table teaches students to assess the quality and credibility of information sources by distinguishing scholarly journals from popular magazines—their authorship, peer-review processes, and intended audiences. This directly supports Standard 14.b's requirement to assess information quality from various sources and understand its application.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 14.b — Knowledge, Theory, Skills, and Values

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
Scholarly or professional associations or societies
Universities or research institutions
Magazines are published by:
Corporate conglomerates
Commercial publishers
Special interest groups

```

##### Evidence 2 — 🔵 **conf 0.68** &nbsp;words 52 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This list distinguishes between scholarly/credible sources (journals, peer-reviewed publications) and non-credible sources (popular magazines), directly supporting the spec requirement to assess information quality from various sources and understand application. The explicit 'DO NOT USE' annotation demonstrates evaluative criteria for source assessment.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 14.b — Knowledge, Theory, Skills, and Values

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

---

### `14.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Upholding confidentiality and using appropriate means to share information._

**→ Imported as NARRATIVE** (`narratives[14][c].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 213 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses the specification for upholding confidentiality and using appropriate means to share information, with detailed narrative describing course coverage, instruction methods, and field placement evaluation of this competency. The content maps precisely to Standard 14.c language.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.c — Knowledge, Theory, Skills, and Values

Prompt: Upholding confidentiality and using appropriate means to share information.

Response:
Upholding confidentiality and using appropriate means to share information.Response: Upholding client confidentiality and sharing information appropriately are consistently stressed throughout the program.  Specific courses that include instruction on this issue include: CHS 105, 224, 315, 360, 380, 430, 440, and 441. CHS 105 Human Services and Social Policy addresses issues of confidentiality and appropriate sharing of information (Course Objective 4). This skill is covered in lecture and reading (See CHS 105 schedule, classes on “The Helping Process” and “Professional, Legal, and Ethical Issues”).  CHS 224 Research Methods and Writing covers client confidentiality as an important consideration in the research process (Course Objective 5; Week 4 on Ethics in Social Science Research).Professional practice courses CHS 315 Group Counseling (Course Objective 5), CHS 360 Counseling Strategies for Individuals (Course Objective 4) and CHS 430 Family Dynamics and Interventions emphasize confidentiality as part of the treatment process. This skill is also an integral part of the CHS 380 Internship, CHS 440 Practicum, and CHS 441 Seminar courses and is an important part of the site requirements. Students are mentored and evaluated by their field instructor on their ability to “protect the client's right to privacy and confidentiality except when such confidentiality would cause harm to the client or others” (See Student Field Placement Evaluation, Section III).

```

##### Match 2 — 🟢 **conf 0.88** &nbsp;words 68 &nbsp; `auto_accept`

_Source heading from doc:_ **Ethical behavior in the field involves making sound decisions concerning issues such as confidentiality.  Information re**

_AI rationale:_ The section directly addresses confidentiality as a core ethical and professional issue in human services practice, which matches Standard 14.c's explicit specification on 'upholding confidentiality and using appropriate means to share information.' While the passage references NOHS ethical standards more broadly, the confidentiality focus is the primary content.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.c — Knowledge, Theory, Skills, and Values

Prompt: Upholding confidentiality and using appropriate means to share information.

Response:
Ethical behavior in the field involves making sound decisions concerning issues such as confidentiality.  Information regarding clients/personnel must be kept confidential and shared only in an appropriate professional context.  Confidentiality is a significant aspect of professionalism and must be maintained at all times.  Standards that address confidentiality and other ethical issues are contained in the code of standards of the National Organization for Human Services (Please see Appendix).

```

##### Match 3 — 🟡 **conf 0.72** &nbsp;words 65 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 9 When providing services through the use of technology, human service professionals take precautions to ensure**

_AI rationale:_ The section directly addresses upholding confidentiality when using technology and ensuring clients are aware of confidentiality concerns, which aligns with Standard 14.c's specification on upholding confidentiality and using appropriate means to share information. Standard 19.c on confidentiality of information is a secondary match given the emphasis on technology-mediated service delivery.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.c — Knowledge, Theory, Skills, and Values

Prompt: Upholding confidentiality and using appropriate means to share information.

Response:
STANDARD 9 When providing services through the use of technology, human service professionals take precautions to ensure and maintain confidentiality and comply with all relevant laws and requirements regarding storing, transmitting, and retrieving data. In addition, human service professionals ensure that clients are aware of any issues and concerns related to confidentiality, service issues, and how technology might negatively or positively impact the helping relationship.

```

##### Match 4 — 🟡 **conf 0.68** &nbsp;words 52 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 42 Human service educators establish and uphold appropriate guidelines concerning student disclosure of sensiti**

_AI rationale:_ The narrative addresses educator guidelines for managing student self-disclosure, confidentiality, and appropriate processing mechanisms. Standard 14.c on 'upholding confidentiality and using appropriate means to share information' is the closest match, as it concerns protection of sensitive information in educational contexts. Standard 19.c on confidentiality is a secondary fit for knowledge/values content.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.c — Knowledge, Theory, Skills, and Values

Prompt: Upholding confidentiality and using appropriate means to share information.

Response:
STANDARD 42 Human service educators establish and uphold appropriate guidelines concerning student disclosure of sensitive/personal information which includes letting students have fair warning of any self-disclosure activities, allowing students to opt-out of in-depth self-disclosure activities when feasible, and ensuring that a mechanism is available to discuss and process such activities as needed.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[14][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `14.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Using technology, including artificial intelligence, to locate, evaluate, and disseminate information. 5. Program Planning and Evaluation Context: A significant component of the human services profession involves assessing the needs of clients and client groups, and planning programs and interventions to assist them in promoting optimal functioning, growth, and goal attainment. At regular intervals, the outcomes must be evaluated, and necessary adjustments made to the plan, both at an individual client and program level._

**→ Imported as NARRATIVE** (`narratives[14][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 181 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses using technology to locate, evaluate, and disseminate information with specific course examples and assignments, matching Standard 14.d language precisely, including the new mention of artificial intelligence in the current spec.

**Exact text that will be written to the narrative slot:**

```text
Standard 14.d — Knowledge, Theory, Skills, and Values

Prompt: Using technology, including artificial intelligence, to locate, evaluate, and disseminate information. 5. Program Planning and Evaluation Context: A significant component of the human services profession involves assessing the needs of clients and client groups, and planning programs and interventions to assist them in promoting optimal functioning, growth, and goal attainment. At regular intervals, the outcomes must be evaluated, and necessary adjustments made to the plan, both at an individual client and program level.

Response:
Using technology to locate, evaluate, and disseminate information. Response:Skills regarding the use of technology to locate, evaluate, and disseminate information are basic expectations in all courses. Specific courses that address this issue, particularly as it relates to information literacy, include: CHS 101, 105, 217, 220, 224, 340, 380, 430, 440, and 441.  Each of these courses requires a research project that involves locating and evaluating information. For example, in CHS 105 Human Services and Social Policy, the Team Research Project requires the use of technology for locating and evaluating information. CHS 224 Research Methods and Writing in particular is devoted to teaching students the skills required to effectively locate and evaluate information (see Critical Analysis assignment). In CHS 220 Diversity and Cultural Competence, students use technology to locate information for the country report assignment. In the new CHS 217 Professional Development course, students will use technology to gather and professionally present career-related information.The use of technology to locate and disseminate information is expected in CHS 380 Internship, CHS 440 Practicum, and CHS 441 Seminar (See syllabi and Student Evaluation item I.A.).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[14][d].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 15

### `15.a` 📊 curriculum matrix — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Knowledge and skills to analyze and assess the needs of clients or client groups._

**→ Imported as NARRATIVE** (`narratives[15][a].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[15][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_

**→ Imported as CURRICULUM MATRIX** (`CurriculumMatrix.rawContent` for `submissionId`):

- conf 0.88 &nbsp; words 1224 &nbsp; heading: _(curriculum matrix table)_
  ```
  Planning and Evaluation
  Context
  :
  A major component of the human services profession involves the assessment of the needs of clients and client groups and the planning of programs and interventions that will assist clients and client groups in promoting optimal functioning, growth, and goal attainment. At regular intervals, the outcomes must be evaluated and necessary adjustments made to the plan…
  ```

---

### `15.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Skills to develop goals, design and implement a plan of action._

**→ Imported as NARRATIVE** (`narratives[15][b].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 387 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses skills to develop goals and design and implement a plan of action across seven courses (CHS 105, 224, 360, 340, 430, 380, 440), which is the exact wording of Standard 15.b. The narrative documents course objectives, assignments, and pedagogical methods supporting this core competency.

**Exact text that will be written to the narrative slot:**

```text
Standard 15.b — Knowledge, Theory, Skills, and Values

Prompt: Skills to develop goals, design and implement a plan of action.

Response:
Skills to develop goals, and design and implement a plan of action.Response: The skills to develop goals and design and implement a plan of action are included in: CHS 105, 224, 360, 340, 430, 380 and 440. The objectives of CHS 105 Human Services and Social Policy include the application of skills to develop goals and design and implement a plan of action (Course Objectives 1 and 7). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group that includes proposing goals and a plan of action to address those needs (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus.  CHS 224 Research Methods and Writing incorporates the development of goals and design and implementation of a plan of action as part of the research proposal process.CHS 360 Counseling Strategies for Individuals addresses skills to develop goals and design and implement a plan of action within the context of individual counseling strategies (Course Objectives 2 and 3) and does so through in-class activity and discussion and out-of-class assignments (See Interview Project). CHS 340 Administration of Human Services emphasizes the development of goals and design and implement a plan of action as a recurring and fundamental topic related to the strategic planning of human services agencies (in-class activities discussions, media presentations, lectures, assigned readings; see schedule).  CHS 430 Family Dynamics and Interventions addresses how to develop goals and design and implement a plan of action as associated with treatment of family issues through lecture and corresponding outside reading  and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention and issues.  The class then discusses how the presenting group developed goals, and designed and implemented a plan of action. Developing goals and designing and implementing a plan of action is addressed in CHS 380 Internship and CHS 440 Practicum as an integral part of the field placement experiences and through class discussion, assigned readings, and journaling. In CHS 380, guest speakers, who discuss how they develop goals and design and implement a plan of action within their respective sites, are a significant part of the course.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[15][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `15.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Skills to evaluate the outcomes of the plan and the impact on the client or client group. 6. Client Interventions and Strategies Context: Human service professionals function as change agents and must therefore attain and develop a core of knowledge, theory, and skills to provide direct services and interventions to clients and client groups._

**→ Imported as NARRATIVE** (`narratives[15][c].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 342 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses skills to evaluate outcomes of plans and their impact on clients/client groups across multiple courses (CHS 105, 224, 340, 430, 380, 440), matching Standard 15.c's specification on client intervention evaluation skills within the Knowledge, Theory, Skills, and Values framework for direct services.

**Exact text that will be written to the narrative slot:**

```text
Standard 15.c — Knowledge, Theory, Skills, and Values

Prompt: Skills to evaluate the outcomes of the plan and the impact on the client or client group. 6. Client Interventions and Strategies Context: Human service professionals function as change agents and must therefore attain and develop a core of knowledge, theory, and skills to provide direct services and interventions to clients and client groups.

Response:
Skills to evaluate the outcomes of the plan and the impact on the client or client group.Response: The skills to evaluate the outcomes of the plan and the impact on the client or client group are included in: CHS 105, 224, 340, 430, 380 and 440. The objectives of CHS 105 Human Services and Social Policy include the application of skills to evaluate the outcomes of the plan and the impact on the client (Course Objectives 1 and 7). This subject matter is conveyed by in-class activities and an out-of-class assignment in which students prepare an oral and written report on the needs of a particular client group that includes proposing a plan to address those needs and evaluate the outcome (Team Research Project). Lecture about these topics throughout the course corresponds with the class schedule provided in the CHS 105 syllabus (See schedule).  CHS 224 Research Methods and Writing incorporates the evaluation of outcomes as a primary measurement issue in the research proposal process.CHS 340 Administration of Human Services emphasizes the evaluation of outcomes and the impact on the client as a recurring and fundamental topic related to the strategic planning of human services agencies (in-class activities discussions, media presentations, lectures, assigned readings; see schedule).  CHS 430 Family Dynamics and Interventions addresses how to evaluate the outcomes of the plan and the impact on the client as associated with treatment of family issues through lecture and corresponding outside reading and in group presentations by students (Group Project) in which students design, model, and instruct the class on a specific family intervention and issues.  The class then discusses how the presenting group evaluated the outcomes of the intervention. Evaluating the outcomes of the plan and the impact on the client is addressed in CHS 380 Internship and CHS 440 Practicum as an integral part of the field placement experiences and through class discussion, assigned readings, and journaling. In CHS 380, guest speakers, who discuss how they evaluate the outcomes of interventions within their respective sites, are a significant part of the course.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[15][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 16

### `16.a` 🟠 evidence-only — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Theory and knowledge bases of prevention, intervention, and maintenance strategies._

**→ Imported as NARRATIVE** (`narratives[16][a].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[16][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.44** &nbsp;words 92 &nbsp; `review_low_confidence`

_Source heading from doc:_ **General instructions: This assignment requires you to apply the concept and theories we will study to your family of ori**

_AI rationale:_ This assignment excerpt describes an intake interviewing exercise requiring students to conduct family interviews with attention to confidentiality, consent, and ethical data handling—core competencies under Standard 16.a (Intake interviewing). The emphasis on obtaining and synthesizing information from family sources also aligns with Standard 14.a, but interviewing skill is the primary pedagogical focus.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 16.a — Knowledge, Theory, Skills, and Values

General instructions: This assignment requires you to apply the concept and theories we will study to your family of origin. In order to complete this assignment you will need to conduct at least two interviews of family members. You may interview parents, grandparents, siblings, aunts, uncles, or cousins. You will cite these interviews in your bibliography. Please discuss confidentiality with your interviewees, get permission to use the interview material, and use only initials when identifying participants. You may include pieces of transcript in your paper only with expressed permission of your interviewee.

```

---

### `16.a` 🟠 evidence-only — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Intake interviewing_

**→ Imported as NARRATIVE** (`narratives[16][a].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[16][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.44** &nbsp;words 92 &nbsp; `review_low_confidence`

_Source heading from doc:_ **General instructions: This assignment requires you to apply the concept and theories we will study to your family of ori**

_AI rationale:_ This assignment excerpt describes an intake interviewing exercise requiring students to conduct family interviews with attention to confidentiality, consent, and ethical data handling—core competencies under Standard 16.a (Intake interviewing). The emphasis on obtaining and synthesizing information from family sources also aligns with Standard 14.a, but interviewing skill is the primary pedagogical focus.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 16.a — Knowledge, Theory, Skills, and Values

General instructions: This assignment requires you to apply the concept and theories we will study to your family of origin. In order to complete this assignment you will need to conduct at least two interviews of family members. You may interview parents, grandparents, siblings, aunts, uncles, or cousins. You will cite these interviews in your bibliography. Please discuss confidentiality with your interviewees, get permission to use the interview material, and use only initials when identifying participants. You may include pieces of transcript in your paper only with expressed permission of your interviewee.

```

---

### `16.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Assess and analyze the needs of clients or client groups through observation, interviewing, active listening, consultation, and research._

**→ Imported as NARRATIVE** (`narratives[16][b].content`):

##### Match 1 — 🔵 **conf 0.72** &nbsp;words 82 &nbsp; `review_low_confidence`

_Source heading from doc:_ **As this is a skills-based course, there will be many hands-on activities designed to practice and 			perform individual **

_AI rationale:_ The section describes pedagogical design for practicing and performing counseling skills through hands-on activities, role-play, and demonstration of interpersonal competencies—directly aligned with Standard 16.b's 'Helping skills' specification. The reflection component also connects secondarily to 20.e on professional self-reflection.

**Exact text that will be written to the narrative slot:**

```text
Standard 16.b — Knowledge, Theory, Skills, and Values

Prompt: Assess and analyze the needs of clients or client groups through observation, interviewing, active listening, consultation, and research.

Response:
As this is a skills-based course, there will be many hands-on activities designed to practice and 			perform individual counseling skills. Students’ participation in these activities is critical to the learning 		process. Grading of students participation in these activities will take into consideration students’ 		demonstration of knowledge and understanding of the skills, willingness to try new strategies and even 		make mistakes. In addition to role-play activities, students will also be assessed on their contribution 		to classroom discussions and participation in guided self-reflection activities.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[16][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `16.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Helping skills:_

**→ Imported as NARRATIVE** (`narratives[16][b].content`):

##### Match 1 — 🔵 **conf 0.72** &nbsp;words 82 &nbsp; `review_low_confidence`

_Source heading from doc:_ **As this is a skills-based course, there will be many hands-on activities designed to practice and 			perform individual **

_AI rationale:_ The section describes pedagogical design for practicing and performing counseling skills through hands-on activities, role-play, and demonstration of interpersonal competencies—directly aligned with Standard 16.b's 'Helping skills' specification. The reflection component also connects secondarily to 20.e on professional self-reflection.

**Exact text that will be written to the narrative slot:**

```text
Standard 16.b — Knowledge, Theory, Skills, and Values

Prompt: Helping skills:

Response:
As this is a skills-based course, there will be many hands-on activities designed to practice and 			perform individual counseling skills. Students’ participation in these activities is critical to the learning 		process. Grading of students participation in these activities will take into consideration students’ 		demonstration of knowledge and understanding of the skills, willingness to try new strategies and even 		make mistakes. In addition to role-play activities, students will also be assessed on their contribution 		to classroom discussions and participation in guided self-reflection activities.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[16][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `16.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Knowledge and skill development in: 1. Case management_

**→ Imported as NARRATIVE** (`narratives[16][c].content`):

##### Match 1 — 🟢 **conf 0.85** &nbsp;words 951 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses identification and use of appropriate resources and referrals, intake interviewing, helping skills, and interpersonal communication—all core elements of Standard 16.c Knowledge, Theory, Skills, and Values in the current spec. The narrative maps these competencies across multiple courses with course objectives and field evaluation evidence.

**Exact text that will be written to the narrative slot:**

```text
Standard 16.c — Knowledge, Theory, Skills, and Values

Prompt: Knowledge and skill development in: 1. Case management

Response:
Knowledge and skill development in:Case managementIntake interviewingResponse:	Intake interviewing is addressed in the following human services courses: CHS 105, 315/515, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn about intake interviewing through the Team Research Project. The topic is covered in numerous classes (see schedule).  This skill is a primary objective and focus of CHS 315/515 Group Counseling (Course Objective 6, schedule chapters 2 and 4) and CHS 360 Counseling Strategies for Individuals (Course Objective 2, Course Requirement #3 –Interview Projects, and schedule chapters 3-6).In CHS 430 Family Dynamics and Interventions, students learn about intake interviewing within the context of family interventions (Group Project Presentation and classes on interviewing techniques (e.g., genograms)).  CHS 380 Internship and  CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which intake interviewing techniques are learned and practiced. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Helping skillsResponse:Helping skills are addressed in all of the following human services courses: CHS 105, 315, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn basic listening skills and the importance of establishing a helping relationship. The topic is covered in numerous classes (see schedule).  This skill is the primary objective and focus of the two counseling skills courses: CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals (All Course Objectives and classes).In CHS 430 Family Dynamics and Interventions, students learn about helping skills within the context of family interventions (Group Project Presentation and classes on counseling techniques).  CHS 380 Internship and  CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which helping skills are practiced and refined, as appropriate to the particular site. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Identification and use of appropriate resources and referralsResponse:The identification and use of resources and referrals is a component of all counseling skills courses, including: CHS 105, 315, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students are introduced to the importance of connecting clients to appropriate resources and the process of making referrals. The topic is covered in numerous classes (see schedule).  The use of resources and referrals is covered in depth in CHS 315 Group Counseling (see particularly Theories and Techniques (Ch. 4) and Groups in the Community (Ch. 11) in the schedule) and CHS 360 Counseling Strategies for Individuals (see particularly weeks 11 and 13 on treatment planning and designing the way forward in the schedule).In CHS 430 Family Dynamics and Interventions, students learn about external resources and referrals as they pertain to supporting families (Group Project Presentation and classes on supporting the family).  CHS 380 Internship and CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences that help students see the value of external resources and referrals, as appropriate to the particular site. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Group facilitationResponse:Group facilitation is addressed in the following human services courses: CHS 105, 315/515, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn basic skills related to group facilitation and counseling through classroom instruction and the Team Research Project. The topic is covered in numerous classes (see schedule).  This skill is the primary objective and focus of CHS 315 Group Counseling (All Course Objectives and classes).In CHS 430 Family Dynamics and Interventions, students learn about group facilitation within the context of family interventions (Group Project Presentation and classes on counseling techniques).  CHS 380 Internship and  CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which group facilitation techniques are practiced and refined, as appropriate to the particular site. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Use of consultation.Response:The use of consultation is addressed through in-class activities and discussions, media presentations, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 105, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn about different approaches to the use of consultation through the Team Research Project assignment and through reading, discussion, and lecture related to “Professional, Legal and Ethical Issues.”  In CHS 430 Family Dynamics and Interventions, students are introduced to the use of consultation within the context of “Family Dynamics and Intervention” (classes on family counseling, e.g., Milan Therapy which is a model of therapeutic consultation.).  CHS 380 Internship and CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which the use of consultation is learned and practiced. (See Student Field Placement Evaluation, Section III and VI).

```

##### Match 2 — 🟡 **conf 0.68** &nbsp;words 77 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **D.   Provides services w/o discrimination or preference based on age, ethnicity, culture, race, disability, gender, religion, sexual orientation or socioeconomic status.**

_AI rationale:_ The section's content focuses on interpersonal communication skills, caring, empathy, and respect in professional interactions—core elements of Standard 16.c's specification on interpersonal communication and the creation of genuine, empathic relationships. While ethical congruence (17.d) and self-development awareness (19.h) are secondary themes, the primary narrative emphasis is on relational and communication competencies.

**Exact text that will be written to the narrative slot:**

```text
Standard 16.c — Knowledge, Theory, Skills, and Values

Prompt: Knowledge and skill development in: 1. Case management

Response:
V:  Exhibits effective and appropriate interpersonal skills.

Communicates effectively with others, both orally and in writing.

Demonstrates caring, respect, empathy, and genuineness when interacting with others.

Establishes appropriate rapport with others.

VI:  Synthesizes and applies key concepts, methods and values in human services to professional situations.

Applies key concepts, perspectives, methods, and values related to human services.

Displays understanding of how services are delivered to individuals and families.

Helps others by using basic counseling/listening skills, as appropriate.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[16][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.62** &nbsp;words 135 &nbsp; `review_low_confidence`

_Source heading from doc:_ **How would you best succeed in this course?  You can best succeed by engaging in active and intentional reading/learning **

_AI rationale:_ This syllabus excerpt describes pedagogical strategies for developing interpersonal communication and group facilitation skills through active class participation, discussion, and small-group engagement—core elements of Standard 16.c's emphasis on 'Group facilitation' and 'Interpersonal Communication' in the context of creating genuine relationships.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 16.c — Knowledge, Theory, Skills, and Values

How would you best succeed in this course?  You can best succeed by engaging in active and intentional reading/learning of the assigned materials and coming to class ready to actively participate in the class discussions by making comments, asking and answering questions.  This means you will read the materials for each class in advance.  To make everyone’s involvement possible, the class will be split into small groups to generate questions/comments on the week’s topic for class discussion.  In this way, all class members will have an opportunity to actively participate, talk, so we can all break the monotony of hearing just my voice.  Please note that if the class gets too quiet, I might call on class members to share their thoughts and I hope those so asked won’t consider it as “picking” on them.

```

---

### `16.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Identification and use of appropriate resources and referrals. 2. Group facilitation 3. Use of consultation 7. Interpersonal Communication Context: The ability to create genuine and empathic relationships with others is central to the human services profession. These skills are applicable to all levels of education, and a greater proficiency is expected at each progressively higher level._

**→ Imported as NARRATIVE** (`narratives[16][c].content`):

##### Match 1 — 🟢 **conf 0.85** &nbsp;words 951 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses identification and use of appropriate resources and referrals, intake interviewing, helping skills, and interpersonal communication—all core elements of Standard 16.c Knowledge, Theory, Skills, and Values in the current spec. The narrative maps these competencies across multiple courses with course objectives and field evaluation evidence.

**Exact text that will be written to the narrative slot:**

```text
Standard 16.c — Knowledge, Theory, Skills, and Values

Prompt: Identification and use of appropriate resources and referrals. 2. Group facilitation 3. Use of consultation 7. Interpersonal Communication Context: The ability to create genuine and empathic relationships with others is central to the human services profession. These skills are applicable to all levels of education, and a greater proficiency is expected at each progressively higher level.

Response:
Knowledge and skill development in:Case managementIntake interviewingResponse:	Intake interviewing is addressed in the following human services courses: CHS 105, 315/515, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn about intake interviewing through the Team Research Project. The topic is covered in numerous classes (see schedule).  This skill is a primary objective and focus of CHS 315/515 Group Counseling (Course Objective 6, schedule chapters 2 and 4) and CHS 360 Counseling Strategies for Individuals (Course Objective 2, Course Requirement #3 –Interview Projects, and schedule chapters 3-6).In CHS 430 Family Dynamics and Interventions, students learn about intake interviewing within the context of family interventions (Group Project Presentation and classes on interviewing techniques (e.g., genograms)).  CHS 380 Internship and  CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which intake interviewing techniques are learned and practiced. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Helping skillsResponse:Helping skills are addressed in all of the following human services courses: CHS 105, 315, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn basic listening skills and the importance of establishing a helping relationship. The topic is covered in numerous classes (see schedule).  This skill is the primary objective and focus of the two counseling skills courses: CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals (All Course Objectives and classes).In CHS 430 Family Dynamics and Interventions, students learn about helping skills within the context of family interventions (Group Project Presentation and classes on counseling techniques).  CHS 380 Internship and  CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which helping skills are practiced and refined, as appropriate to the particular site. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Identification and use of appropriate resources and referralsResponse:The identification and use of resources and referrals is a component of all counseling skills courses, including: CHS 105, 315, 360, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students are introduced to the importance of connecting clients to appropriate resources and the process of making referrals. The topic is covered in numerous classes (see schedule).  The use of resources and referrals is covered in depth in CHS 315 Group Counseling (see particularly Theories and Techniques (Ch. 4) and Groups in the Community (Ch. 11) in the schedule) and CHS 360 Counseling Strategies for Individuals (see particularly weeks 11 and 13 on treatment planning and designing the way forward in the schedule).In CHS 430 Family Dynamics and Interventions, students learn about external resources and referrals as they pertain to supporting families (Group Project Presentation and classes on supporting the family).  CHS 380 Internship and CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences that help students see the value of external resources and referrals, as appropriate to the particular site. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Group facilitationResponse:Group facilitation is addressed in the following human services courses: CHS 105, 315/515, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn basic skills related to group facilitation and counseling through classroom instruction and the Team Research Project. The topic is covered in numerous classes (see schedule).  This skill is the primary objective and focus of CHS 315 Group Counseling (All Course Objectives and classes).In CHS 430 Family Dynamics and Interventions, students learn about group facilitation within the context of family interventions (Group Project Presentation and classes on counseling techniques).  CHS 380 Internship and  CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which group facilitation techniques are practiced and refined, as appropriate to the particular site. Students are mentored and evaluated by their field instructors on their ability to apply appropriate techniques learned in courses. For example, the student: “Applies key concepts, perspectives, methods, and values related to human services” and “Displays understanding of how services are delivered to individuals and families” (See Student Field Placement Evaluation, Section VI).Use of consultation.Response:The use of consultation is addressed through in-class activities and discussions, media presentations, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 105, 430, 380, and 440.  In CHS 105 Human Services and Social Policy, students learn about different approaches to the use of consultation through the Team Research Project assignment and through reading, discussion, and lecture related to “Professional, Legal and Ethical Issues.”  In CHS 430 Family Dynamics and Interventions, students are introduced to the use of consultation within the context of “Family Dynamics and Intervention” (classes on family counseling, e.g., Milan Therapy which is a model of therapeutic consultation.).  CHS 380 Internship and CHS 440 Practicum involve class or seminar experiences in conjunction with field placement experiences in which the use of consultation is learned and practiced. (See Student Field Placement Evaluation, Section III and VI).

```

##### Match 2 — 🟡 **conf 0.68** &nbsp;words 77 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **D.   Provides services w/o discrimination or preference based on age, ethnicity, culture, race, disability, gender, religion, sexual orientation or socioeconomic status.**

_AI rationale:_ The section's content focuses on interpersonal communication skills, caring, empathy, and respect in professional interactions—core elements of Standard 16.c's specification on interpersonal communication and the creation of genuine, empathic relationships. While ethical congruence (17.d) and self-development awareness (19.h) are secondary themes, the primary narrative emphasis is on relational and communication competencies.

**Exact text that will be written to the narrative slot:**

```text
Standard 16.c — Knowledge, Theory, Skills, and Values

Prompt: Identification and use of appropriate resources and referrals. 2. Group facilitation 3. Use of consultation 7. Interpersonal Communication Context: The ability to create genuine and empathic relationships with others is central to the human services profession. These skills are applicable to all levels of education, and a greater proficiency is expected at each progressively higher level.

Response:
V:  Exhibits effective and appropriate interpersonal skills.

Communicates effectively with others, both orally and in writing.

Demonstrates caring, respect, empathy, and genuineness when interacting with others.

Establishes appropriate rapport with others.

VI:  Synthesizes and applies key concepts, methods and values in human services to professional situations.

Applies key concepts, perspectives, methods, and values related to human services.

Displays understanding of how services are delivered to individuals and families.

Helps others by using basic counseling/listening skills, as appropriate.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[16][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.62** &nbsp;words 135 &nbsp; `review_low_confidence`

_Source heading from doc:_ **How would you best succeed in this course?  You can best succeed by engaging in active and intentional reading/learning **

_AI rationale:_ This syllabus excerpt describes pedagogical strategies for developing interpersonal communication and group facilitation skills through active class participation, discussion, and small-group engagement—core elements of Standard 16.c's emphasis on 'Group facilitation' and 'Interpersonal Communication' in the context of creating genuine relationships.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 16.c — Knowledge, Theory, Skills, and Values

How would you best succeed in this course?  You can best succeed by engaging in active and intentional reading/learning of the assigned materials and coming to class ready to actively participate in the class discussions by making comments, asking and answering questions.  This means you will read the materials for each class in advance.  To make everyone’s involvement possible, the class will be split into small groups to generate questions/comments on the week’s topic for class discussion.  In this way, all class members will have an opportunity to actively participate, talk, so we can all break the monotony of hearing just my voice.  Please note that if the class gets too quiet, I might call on class members to share their thoughts and I hope those so asked won’t consider it as “picking” on them.

```

---

## Standard 17

### `17.a` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Clarifying expectations._

**→ Imported as NARRATIVE** (`narratives[17][a].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 331 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly addresses the skill of 'clarifying expectations' and documents how it is taught across multiple human services courses with detailed course mapping and evaluation methods. This matches Standard 17.a specification precisely.

**Exact text that will be written to the narrative slot:**

```text
Standard 17.a — Knowledge, Theory, Skills, and Values

Prompt: Clarifying expectations.

Response:
Clarifying expectations.Response: Clarifying expectations is addressed through in-class activities and discussions, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 101, 105, 224, 315/515, 360, 340, 430, 380, 440, and 441.  In CHS 101 Family Studies, students learn about effective communication in relationships, which includes clarifying expectations (see schedule, unit on Communication). In CHS 105 Human Services and Social Policy, students learn about different approaches to clarifying expectations in classes addressing “Defining Roles and Problems” and “The Helping Process.”  CHS 224 Research Methods and Writing addresses clarifying expectations as a step in the process of social science research (see the research proposal project; week 2 class topic).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both focus on clarifying expectations as an essential component of establishing a helping relationship and setting therapeutic goals. For CHS 315, see weeks 5 and 6 on Forming a Group and Initial Stage of a Group. For CHS 360, see chapters 2 – 6, but especially chapter 4 on Working at Mutual Understanding, as well as the two interview projects. Clarifying expectations is an important part of CHS 340 Administration of Human Services and is taught as a leadership and management style within a human services agency (Course Objectives 2, 4, 5 and 9; Course Requirement 2 “Team Project/Strategic Plan Appraisal”). In CHS 430 Family Dynamics and Interventions, students are introduced to clarifying expectations within the context of “Family Dynamics and Intervention” (Group Project Presentation and classes on strategic and structural approaches to family therapy).  The skill of clarifying expectations is addressed in CHS 380 Internship and CHS 440 Practicum / CHS 441 Seminar as a part of the field placement experiences and through class discussion, assigned readings, and journaling. Students are evaluated on their ability to “help others by using basic counseling/listening skills, as appropriate” and “Applies key concepts, perspectives, methods, and values related to human services” (See Student Field Placement Evaluation, Section VI).

```

##### Match 2 — 🔵 **conf 0.62** &nbsp;words 53 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Class will be comprised of lectures, discussions, demonstrations, group activities, videos, web-based activities, etc. I**

_AI rationale:_ The section describes instructional methods and clarifies expectations for student preparation and participation, directly supporting Standard 17.a's focus on clarifying expectations about knowledge, theory, skills, and values delivery.

**Exact text that will be written to the narrative slot:**

```text
Standard 17.a — Knowledge, Theory, Skills, and Values

Prompt: Clarifying expectations.

Response:
Class will be comprised of lectures, discussions, demonstrations, group activities, videos, web-based activities, etc. It is expected that each student will have read the assigned material for each class and thus be prepared for participation in class discussion. The more prepared you are for class; the more enjoyable class will be for all.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[17][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.38** &nbsp;words 67 &nbsp; `review_low_confidence`

_Source heading from doc:_ **1.  Course Participation (20%)  You should arrive at each class prepared to offer analysis, questions, and critique of t**

_AI rationale:_ This is a course syllabus grading rubric describing expectations for classroom engagement and preparation. While it addresses pedagogical expectations rather than a direct standard response, Standard 17.a (Clarifying expectations) is the closest match in the current spec framework, though this is primarily a supporting artifact rather than a narrative response to a standard.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 17.a — Knowledge, Theory, Skills, and Values

1.  Course Participation (20%)  You should arrive at each class prepared to offer analysis, questions, and critique of the assigned readings, integrating prior knowledge and experience. The open discussion of readings is an integral part of the learning process for this course. The evaluation of the breadth and depth of this preparation and subsequent discussions will be the determination of the course participation score for this course.

```

---

### `17.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Dealing effectively with conflict._

**→ Imported as NARRATIVE** (`narratives[17][b].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 343 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses the specification 'Dealing effectively with conflict' by documenting how this skill is taught across multiple human services courses through specific pedagogical methods, clinical applications, and field placement evaluation criteria. The narrative response matches Standard 17.b exactly.

**Exact text that will be written to the narrative slot:**

```text
Standard 17.b — Knowledge, Theory, Skills, and Values

Prompt: Dealing effectively with conflict.

Response:
Dealing effectively with conflict.Response:Dealing effectively with conflict is addressed through in-class activities and discussions, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 101, 105, 224, 315/515, 360, 340, 430, 380, 440, and 441.  In CHS 101 Family Studies, students learn about dealing effectively with conflict in relationships (see classes on Communication and on Stress and Crisis in Relationships).In CHS 105 Human Services and Social Policy, students learn about different approaches to dealing with conflict in classes addressing “Defining Roles and Problems” and “The Helping Process.”  CHS 224 Research Methods and Writing addresses dealing with conflict as a skill that is sometimes necessary in proposing and implementing social science research (see the research proposal project; week 2 class topic).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both focus on techniques for dealing with conflict in a therapeutic context. For CHS 315, see classes on group stages, particularly the Transition Stage of a Group. For CHS 360, see chapters 2 – 6, but especially chapter 6 on Client Self-Challenging, as well as the two interview projects. Dealing effectively with conflict is an important part of CHS 340 Administration of Human Services and is taught as a leadership and management style within a human services agency (Course Objectives 2, 4, 5 and 9; Course Requirement 2 “Team Project/Strategic Plan Appraisal”). In CHS 430 Family Dynamics and Interventions, students are introduced to conflict management within the context of “Family Dynamics and Intervention” (Group Project Presentation and classes on systemic and structural approaches to family therapy).  The skill of dealing effectively with conflict is addressed in CHS 380 Internship and CHS 440 Practicum / CHS 441 Seminar as a part of the field placement experiences and through class discussion, assigned readings, and journaling (see Issue Presentation assignment in CHS 441). Students are evaluated on their ability to “help others by using basic counseling/listening skills, as appropriate” and “Applies key concepts, perspectives, methods, and values related to human services” (See Student Field Placement Evaluation, Section VI).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[17][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `17.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Establishing rapport with clients._

**→ Imported as NARRATIVE** (`narratives[17][c].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 314 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses 'Establishing rapport with clients' as a core skill, detailing how the program teaches this through multiple courses, clinical skills training, and field placements. This is an exact match to Standard 17.c's specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 17.c — Knowledge, Theory, Skills, and Values

Prompt: Establishing rapport with clients.

Response:
Establishing rapport with clients.Response:Establishing rapport with clients is addressed through in-class activities and discussions, lectures, assigned readings, and out-of-class assignments in the following human services courses: CHS 105, 220, 224, 315/515, 360, 430, 380, 440, and 441.  In CHS 105 Human Services and Social Policy, students learn about the importance of establishing rapport with clients as part of classes addressing “Defining Roles and Problems” and “The Helping Process.”  CHS 220 Diversity and Cultural Competence emphasizes diversity and understanding each person’s unique characteristics as a prerequisite for establishing rapport. See particularly the Immigrant Interview project. In CHS 224 Research Methods and Writing, students learn that establishing rapport is an essential step in conducting effective research (see the research proposal project; week 2 and week 4 class topics).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both emphasize techniques for establishing rapport in a therapeutic context. For CHS 315, see classes on group stages, particularly the topic of Forming a Group. For CHS 360, see chapters 2 – 6, but especially chapters 3&4 on Empathetic Presence and Responding, as well as the two interview projects. In CHS 430 Family Dynamics and Interventions, students learn techniques for establishing rapport in the context of family therapy. This is a component of all the models of family therapy (Group Project Presentation) and is included in the material on Adopting a Family Relationship Framework.  The skill of establishing rapport with clients is addressed in CHS 380 Internship and CHS 440 Practicum / CHS 441 Seminar as a part of the field placement experiences and through class discussion, assigned readings, and journaling (see Issue Presentation assignment in CHS 441). Students are evaluated on their ability to “help others by using basic counseling/listening skills, as appropriate” and “Applies key concepts, perspectives, methods, and values related to human services” (See Student Field Placement Evaluation, Section VI).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[17][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `17.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Developing and sustaining behaviors that are congruent with the values and ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at https://www.nationalhumanservices.org/ethical-standards-for- hsprofessionals). 8. Administrative Context: A holistic approach to human services recognizes direct and indirect services as components of the same system. Administrative support (indirect service) is essential to the effective delivery of direct services to clients or client groups._

**→ Imported as NARRATIVE** (`narratives[17][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 352 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses developing and sustaining behaviors congruent with professional values and ethical standards, with explicit reference to NOHS/CSHSE ethical standards. Standard 17.d is the primary specification for this competency, while 19.h addresses integration of ethical standards in self-development context as a secondary match.

**Exact text that will be written to the narrative slot:**

```text
Standard 17.d — Knowledge, Theory, Skills, and Values

Prompt: Developing and sustaining behaviors that are congruent with the values and ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at https://www.nationalhumanservices.org/ethical-standards-for- hsprofessionals). 8. Administrative Context: A holistic approach to human services recognizes direct and indirect services as components of the same system. Administrative support (indirect service) is essential to the effective delivery of direct services to clients or client groups.

Response:
Developing and sustaining behaviors that are congruent with the values and ethics of the profession.Response:Developing and sustaining behaviors that are congruent with the values and ethics of the profession is addressed in the following human services courses: CHS 105, 220, 224, 315/515, 360, 430, 380, 440, and 441.  In CHS 105 Human Services and Social Policy, students are introduced to the values and ethics of the helping profession through in-class activities and discussions, lectures, assigned readings (see class topics Defining Roles and Problems, The Helping Process, and Professional and Ethical Issues), as well as through the Team Research assignment. CHS 220 Diversity and Cultural Competence emphasizes the value of openness to diversity and understanding each person’s unique characteristics. See particularly the Immigrant Interview project. In CHS 224 Research Methods and Writing, students learn the values and ethics associated with conducting social science research (see the research proposal project; week 2 and week 4 class topics).The clinical skills courses of CHS 315 Group Counseling and CHS 360 Counseling Strategies for Individuals both emphasize helping students to develop and sustain therapeutic behaviors that are congruent with the values and ethics of the profession. For CHS 315, see classes on all group stages and week 3 on Ethical and Legal Issues in Group Counseling. For CHS 360, see chapters 2 – 6, but especially chapter 2 on the Helping Relationship and the Values That Drive It.In CHS 430 Family Dynamics and Interventions, students practice techniques that are congruent with the values and ethics of the profession in the context of family therapy. This is a component of all the models of family therapy (Group Project Presentation) and is included in the material on Adopting a Family Relationship Framework.  Developing and sustaining behaviors that are congruent with the values and ethics of the profession is one of the primary purposes of field experience courses CHS 380 Internship and CHS 440 Practicum / CHS 441 Seminar in which students can practice these skills. Students are evaluated on their ability to “Exhibit professional attitudes and behaviors” including “Exhibits consistent ethical behavior” (See Student Field Placement Evaluation, Section III).

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 73 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Examines ethical practice and decision-making in the counseling field.  The course focuses on personal and professional **

_AI rationale:_ The section describes a course on ethical practice and decision-making that develops awareness of values, boundaries, confidentiality, and professional responsibilities—directly matching Standard 17.d's specification on developing behaviors congruent with NOHS/CSHSE ethical standards. Standard 19.h on integration of ethical standards and Standard 18.d on legal/ethical issues are secondary fits, but 17.d best captures the focus on sustained ethical professional conduct.

**Exact text that will be written to the narrative slot:**

```text
Standard 17.d — Knowledge, Theory, Skills, and Values

Prompt: Developing and sustaining behaviors that are congruent with the values and ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at https://www.nationalhumanservices.org/ethical-standards-for- hsprofessionals). 8. Administrative Context: A holistic approach to human services recognizes direct and indirect services as components of the same system. Administrative support (indirect service) is essential to the effective delivery of direct services to clients or client groups.

Response:
Examines ethical practice and decision-making in the counseling field.  The course focuses on personal and professional awareness of values, self-disclosure, boundaries and dual relationships, confidentiality, counselor and client rights and responsibilities, professional relationships, and credentialing/regulating agencies. This course also provides a specific focus on ethical issues relevant to the addiction treatment field, including the impact of confidentiality regulations, working with mandated client populations, self-help fellowship participation, and counselors who are also in recovery.

```

##### Match 3 — 🔵 **conf 0.62** &nbsp;words 74 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students continue to struggle with consistently demonstrating professionalism in their writing and electronic communicat**

_AI rationale:_ The narrative addresses student development of professional behaviors and values through coursework and writing-intensive instruction, directly aligning with Standard 17.d's focus on developing and sustaining behaviors congruent with professional values and ethical standards. The mention of a new Professional Development course and emphasis on professionalism supports this competency-building requirement.

**Exact text that will be written to the narrative slot:**

```text
Standard 17.d — Knowledge, Theory, Skills, and Values

Prompt: Developing and sustaining behaviors that are congruent with the values and ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at https://www.nationalhumanservices.org/ethical-standards-for- hsprofessionals). 8. Administrative Context: A holistic approach to human services recognizes direct and indirect services as components of the same system. Administrative support (indirect service) is essential to the effective delivery of direct services to clients or client groups.

Response:
Students continue to struggle with consistently demonstrating professionalism in their writing and electronic communications. While most of them are able to maintain an acceptable degree of professionalism, this is an area that we will continue to emphasize. A new course was recently created (CHS 217 Professional Development in Counseling & Human Services) that will stress the importance of professionalism. We also continue to offer writing-intensive courses that require students to practice good writing skills.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[17][d].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 75 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Course Description:  This course emphasizes the organizational and work-related issues in human services, including prog**

_AI rationale:_ This course description addresses administrative competencies including program planning, evaluation, budgeting, and personnel administration—all core indirect services. Standard 17.d explicitly contextualizes administrative work as essential indirect service supporting the human services system, making it the best match despite the course's broader scope.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 17.d — Knowledge, Theory, Skills, and Values

Course Description:  This course emphasizes the organizational and work-related issues in human services, including program planning, development, and evaluation; personnel administration; fundraising and budgeting; and administrative procedures. Students will focus on professional writing throughout this course, including writing a strategic plan and program proposal. Students who anticipate continuing their education at the graduate level should register for the 500-level section; however, transferability of these courses to a graduate program is determined by the receiving institution.

```

---

## Standard 18

### `18.a` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Principles of leadership and management._

**→ Imported as NARRATIVE** (`narratives[18][a].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 229 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly addresses 'Principles of leadership and management' as stated in Standard 18.a, detailing how the program teaches these principles through specific courses (CHS 340/540, 430, 380, 440, 441) with course objectives, assignments, and field placement evaluations.

**Exact text that will be written to the narrative slot:**

```text
Standard 18.a — Knowledge, Theory, Skills, and Values

Prompt: Principles of leadership and management.

Response:
Principles of leadership and management.Response: The principles of leadership and management are primarily addressed by the required course CHS 340/540 Administration of Human Services. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 340/540, 430, 380, 440, and 441.  Leading and managing organizations is a main focus and objective of CHS 340/540 Administration of Human Services (see all Course Objectives; Course Requirement 2 - “Team Project/Strategic Plan Appraisal” and Course Requirement 6 – “Seeking Resources Project”) and is addressed through assigned reading, lecture, in-class activities and in-class discussions on a myriad of topics relating to managing organizations (See course schedule).In CHS 430 Family Dynamics and Interventions students are introduced to principles of administering clinical programs through the group project analyzing the application of various family therapy approaches. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which managing organizations through leadership and strategic planning is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate a professional attitude and behavior and follow the agency's policies and procedures (See Student Field Placement Evaluation, Section III).  Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[18][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 258 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This course schedule for an organizational/management course covers leadership, strategic planning, human resources, financial management, ethics, and board governance—directly aligned with Standard 18.a (Principles of leadership and management). The table documents course content and learning activities that support management competencies.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 18.a — Knowledge, Theory, Skills, and Values

COURSE SCHEDULE INFORMATION
Date (ONE1, ONE 2)
Topic
Readings
Other Strategies
January 28, 30
Overview of Course
Leading the Organization
Handouts
Chapters 1 and 2
Introduction and Envisioning
Activity.  Team Development
February 4, 6
Strategic Planning/Designing Programs
Chapter 4 Part A and B
Working on Team Presentations
February 11, 13
Creating a Strategic Plan. Implementing Action Plans/Problem Solving
Chapter 4 Part A and B
Team Presentations
Quiz: chapters 1,2, and 4
February 18, 20
Managing Employees and Managing Challenges
Chapter 5 A and B
Team Presentations and Hiring Strategies
February 25, 27
Supervising Staff/Assessing and Evaluating Staff/ Time Management
Chapters 6,7, and 8
540 Presentations
March 4, 6
Making Meetings Productive/ Improving Communication & Handling Conflicts/team Building
Chapters 9,10 and 11
Quiz: Chapters 5,6,7 and 8
Review for Midterm
March 11, 13
Midterm
Covers chapters 1 through 11 (except 3)
March 18-24
Spring Break
March 25, 27
Managing Finances/Strategic Resource Development/Preparing Effective Proposals, Seeking Funding
Chapters 13,14,15 and 16
Evidenced Based Programs and Seeking Funding
April 1, 3
Evidence Based Management
Chapter 17
Quiz Chapters 13,14,15,16.
Work on individual projects
April 8, 10
Ethical Dilemmas in Management/Humanizing the Organization
Chapters 18 and 19
Work on individual projects
April 15, 17
Seeking Resources
Individual student presentations
April 22, 24
Seeking Resources/Working with a Board of Trustees
Chapter 12
Presentations continued /Speaker regarding working in a Human Services agency
April 29,  May 1
Working with a Board of Trustees/Summary & Review
Chapter 12
Quiz;  Chapters 17,18,19 and 12
May 6, 8
Summary and Review/Final Exam
Covers Chapter 12 through 19

```

---

### `18.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Human resources and volunteer management._

**→ Imported as NARRATIVE** (`narratives[18][b].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 243 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses human resources and volunteer management through coursework and field experiences, matching Standard 18.b's specification. The narrative demonstrates how students learn these administrative competencies across multiple courses and practicum settings.

**Exact text that will be written to the narrative slot:**

```text
Standard 18.b — Knowledge, Theory, Skills, and Values

Prompt: Human resources and volunteer management.

Response:
Human resources and volunteer management.Response:Human resources issues and volunteer management are primarily addressed by the required course CHS 340/540 Administration of Human Services. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 340/540, 430, 380, 440, and 441.  Human resources issues and volunteer management are covered in depth in CHS 340/540 Administration of Human Services (see all Course Objectives; Course Requirement 2 - “Team Project/Strategic Plan Appraisal” and Course Requirement 6 – “Seeking Resources Project”) and are addressed through assigned reading, lecture, in-class activities and in-class discussions on a myriad of topics relating to supervision (See course schedule). The importance of volunteers is included in units on staff management, funding strategies, and humanizing the organization. In CHS 430 Family Dynamics and Interventions students are introduced to principles of administering clinical programs through the group project analyzing the application of various family therapy approaches. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which supervision and human resource management is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate a professional attitude and behavior and follow the agency's policies and procedures (See Student Field Placement Evaluation, Section III). Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[18][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `18.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Grant writing, fundraising, and other funding sources._

**→ Imported as NARRATIVE** (`narratives[18][c].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 230 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses grant writing, fundraising, and other funding sources as a knowledge, theory, skills, and values component, which exactly matches Standard 18.c specification language. The curriculum response documents how students learn and apply these competencies across multiple courses.

**Exact text that will be written to the narrative slot:**

```text
Standard 18.c — Knowledge, Theory, Skills, and Values

Prompt: Grant writing, fundraising, and other funding sources.

Response:
Grant writing, fundraising, and other funding sources.Response:Grant writing, fundraising, and funding sources are primarily addressed by the required course CHS 340/540 Administration of Human Services and are also a component of the grant proposal project in CHS 224. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 224, 340/540, 380, 440, and 441.  Grant writing and funding are a main focus and objective of CHS 340/540 Administration of Human Services (specifically Course Requirement 6 – “Seeking Resources Project”) and is the focus of a major course assignment on seeking resources. The topic is covered through assigned reading, lecture, in-class activities and in-class discussions relating to grant writing and funding (See course schedule).In CHS 224 Research Methods and Writing, students learn in-depth about using research to support the writing of a grant narrative. They develop a detailed research proposal with attention to funding issues. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the funding of programs is observed firsthand and students are often able to participate in fundraising initiative, depending on their placement site. Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441. (See Student Field Placement Evaluation, Section III).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[18][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `18.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Legal, ethical, and regulatory issues, and risk management._

**→ Imported as NARRATIVE** (`narratives[18][d].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 270 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses legal, ethical, and regulatory issues and risk management as taught across multiple required courses, matching Standard 18.d specification language exactly. The narrative describes coursework, assignments, and field placement experiences focused on these competencies.

**Exact text that will be written to the narrative slot:**

```text
Standard 18.d — Knowledge, Theory, Skills, and Values

Prompt: Legal, ethical, and regulatory issues, and risk management.

Response:
Legal, ethical, and regulatory issues, and risk management.Response:Legal, ethical, and regulatory issues and risk management are primarily addressed by the required course CHS 340/540 Administration of Human Services. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 224, 340/540, 430, 380, 440, and 441.  Legal, ethical, and regulatory issues and risk management is a main focus and objective of CHS 340/540 Administration of Human Services (see all Course Objectives; Course Requirement 2 - “Team Project/Strategic Plan Appraisal” and Course Requirement 6 – “Seeking Resources Project”) and is addressed through assigned reading, lecture, in-class activities and in-class discussions relating to legal, ethical and regulatory issues (See course schedule, particularly the units on ethical issues in management and working with a board or trustees).In CHS 224 Research Methods and Writing, students learn about legal and regulatory issues specifically related to research with human subjects. They develop a detailed research proposal that specifies how these issues will be addressed. In CHS 430 Family Dynamics and Interventions, students are introduced to principles of administering clinical programs through the group project analyzing the application of various family therapy approaches. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which legal and regulatory issues and risk management may be observed and practiced. Students are mentored and evaluated by their field instructor (See Student Field Placement Evaluation, Section III). Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[18][d].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `18.e` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Budget and financial management. 9. Client-Related Values and Attitudes Context: There are values and ethics intrinsic to the human services profession that have been agreed to as governing principles of professional practice._

**→ Imported as NARRATIVE** (`narratives[18][e].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 231 &nbsp; `auto_accept`

_Source heading from doc:_ **e.**

_AI rationale:_ The narrative directly addresses budget and financial management as a knowledge and skills competency taught across multiple courses (CHS 340/540, 224, 380, 440, 441), matching Standard 18.e. Grant writing and fundraising are also covered but are secondary topics within this response.

**Exact text that will be written to the narrative slot:**

```text
Standard 18.e — Knowledge, Theory, Skills, and Values

Prompt: Budget and financial management. 9. Client-Related Values and Attitudes Context: There are values and ethics intrinsic to the human services profession that have been agreed to as governing principles of professional practice.

Response:
Budget and financial management.Response:Budget and financial management issues are primarily addressed by the required course CHS 340/540 Administration of Human Services and are also a component of the grant proposal project in CHS 224. The issue is presented through in-class activities and discussions, lectures, assigned readings, in-class media presentation, and out-of-class assignments in the following human services courses: CHS 224, 340/540, 380, 440, and 441.  Budgetary and financial management are a main focus of CHS 340/540 Administration of Human Services (specifically Course Requirement 6 – “Seeking Resources Project”) and is the focus of a major course assignment on seeking resources. The topic is covered through assigned reading, lecture, in-class activities and in-class discussions relating to budget and financial management (See course schedule).In CHS 224 Research Methods and Writing, students learn about using evidence to justify a proposed budget in the writing of a grant narrative. They develop a detailed research proposal with attention to financial issues. CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the financial management of programs is observed firsthand and students are sometimes directly engaged in the financial operations of the agency, depending on their placement site. Students report on how the agency they worked in dealt with this issue as part of their final poster presentation for CHS 441. (See Student Field Placement Evaluation, Section III).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[18][e].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 19

### `19.a` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The least intrusive intervention in the least restrictive environment._

**→ Imported as NARRATIVE** (`narratives[19][a].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 263 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly addresses how the program teaches and evaluates 'the least intrusive intervention in the least restrictive environment,' which is the exact language of Standard 19.a. The narrative documents integration across multiple courses (CHS 105, 224, 315/515, 360, 430, 380, 440, 441) and field placement evaluation, demonstrating both knowledge delivery and skills demonstration.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.a — Knowledge, Theory, Skills, and Values

Prompt: The least intrusive intervention in the least restrictive environment.

Response:
The least intrusive intervention in the least restrictive environment.Response:Choosing the least intrusive intervention in the least restrictive environment is a principle that is taught through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (see topics on Foundational Concepts, the Roles and Functions of HS Workers, and Theoretical Issues in Working with Individuals and Families in the course schedule).In CHS 224 Research Methods and Writing, students learn to apply social science research techniques to assessing programs that use the least intrusive intervention in the least restrictive environment. Students develop a detailed research proposal that specifies how the research will be conducted. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 6); CHS 360 in the context of individual counseling techniques (see interview projects and class schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which choosing the least intrusive intervention in the least restrictive environment can be observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors (See Student Field Placement Evaluation, Section III).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `19.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Client self-determination._

**→ Imported as NARRATIVE** (`narratives[19][b].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 226 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses client self-determination as a core knowledge, theory, skill, and value taught across multiple human services courses and clinical practice settings, matching Standard 19.b exactly. The narrative documents how this principle is integrated throughout the curriculum and field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.b — Knowledge, Theory, Skills, and Values

Prompt: Client self-determination.

Response:
Client self-determination.Response:Client self-determination is a principle that is taught through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (see schedule and topics such as Foundational Concepts and Theoretical Issues).In CHS 224 Research Methods and Writing, students learn to apply social science research techniques to evaluate programs that emphasize client self-determination. Students develop a detailed research proposal that specifies how the research will be conducted. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 6; schedule of topics on Ethical Issues and Theories); CHS 360 in the context of individual counseling techniques (see interview projects and class schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which client self-determination is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors (See Student Field Placement Evaluation, Section III).

```

##### Match 2 — 🟡 **conf 0.72** &nbsp;words 78 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 2 Human service professionals obtain informed consent to provide services to clients at the beginning of the he**

_AI rationale:_ The section describes informed consent procedures and client rights to withdraw consent and ask questions, which directly aligns with Standard 19.b on client self-determination. The emphasis on client autonomy in the helping relationship is core to self-determination.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.b — Knowledge, Theory, Skills, and Values

Prompt: Client self-determination.

Response:
STANDARD 2 Human service professionals obtain informed consent to provide services to clients at the beginning of the helping relationship. Clients should be informed that they may withdraw consent at any time except where denied by court order and should be able to ask questions before agreeing to the services. Clients who are unable to give consent should have those who are legally able to give consent for them review an informed consent statement and provide appropriate consent.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `19.c` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Confidentiality of information._

**→ Imported as NARRATIVE** (`narratives[19][c].content`):

##### Match 1 — 🟡 **conf 0.92** &nbsp;words 60 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 3 Human service professionals protect the client's right to privacy and confidentiality except when such confid**

_AI rationale:_ The narrative directly addresses confidentiality of information, its limits, exceptions (serious harm, agency guidelines, legal requirements), and the obligation to inform clients—all core elements of Standard 19.c on confidentiality of information.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.c — Knowledge, Theory, Skills, and Values

Prompt: Confidentiality of information.

Response:
STANDARD 3 Human service professionals protect the client's right to privacy and confidentiality except when such confidentiality would cause serious harm to the client or others, when agency guidelines state otherwise, or under other stated conditions (e.g., local, state, or federal laws). Human service professionals inform clients of the limits of confidentiality prior to the onset of the helping relationship.

```

##### Match 2 — 🟢 **conf 0.89** &nbsp;words 240 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses confidentiality of information as a core principle taught across multiple courses and evaluated in field placements, matching Standard 19.c specification exactly. Standard 14.c is a weaker alternative as it frames confidentiality within a broader context of appropriate information sharing.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.c — Knowledge, Theory, Skills, and Values

Prompt: Confidentiality of information.

Response:
Confidentiality of information.Response:Confidentiality of information is a principle that is emphasized throughout the program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (schedule, specifically units on Foundational Concepts and Ethical Issues).In CHS 224 Research Methods and Writing, students learn about the importance of maintaining the confidentiality of information while conducting social science research (see Week 4). Students develop a detailed research proposal that includes a description of how information will be kept confidential. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 5; schedule); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which confidentiality of information is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors, including maintaining the confidentiality of client records (See Student Field Placement Evaluation, Section III).

```

##### Match 3 — 🟡 **conf 0.89** &nbsp;words 51 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 8 Human service professionals protect the integrity, safety, and security of client records. Client information**

_AI rationale:_ The section directly addresses confidentiality and security of client records, including written consent requirements and exceptions for supervision and legal obligation, which aligns precisely with Standard 19.c on 'Confidentiality of information.' This is a core ethical specification in the current handbook.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.c — Knowledge, Theory, Skills, and Values

Prompt: Confidentiality of information.

Response:
STANDARD 8 Human service professionals protect the integrity, safety, and security of client records. Client information in written or electronic form that is shared with other professionals must have the client’s prior written consent except in the course of professional supervision or when legally obliged or permitted to share such information.

```

##### Match 4 — 🟢 **conf 0.89** &nbsp;words 100 &nbsp; `auto_accept`

_Source heading from doc:_ **C. Confidentiality; HIPAA Compliance. In the course of a student’s participation in the Education Program, the student a**

_AI rationale:_ This section directly addresses confidentiality of information and HIPAA compliance requirements that students must uphold as part of their professional practice. Standard 19.c explicitly requires knowledge and skills related to confidentiality of information, which is the core subject of this policy narrative.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.c — Knowledge, Theory, Skills, and Values

Prompt: Confidentiality of information.

Response:
C. Confidentiality; HIPAA Compliance. In the course of a student’s participation in the Education Program, the student and the SPONSOR staff may become privy to, or may receive or create certain confidential health or medical information relating to persons being treated in the HEALTH SYSTEM (“Protected Health Information”), the confidentiality of which is regulated by the Health Insurance Portability and Accountability Act of 1996, Public Law 104-191 (“HIPAA”).  SPONSOR agrees to maintain and to require all students to maintain the confidentiality of all Protected Health Information as required by HIPAA. Not in limitation of the foregoing, but in addition thereto:

```

##### Match 5 — 🟢 **conf 0.85** &nbsp;words 56 &nbsp; `auto_accept`

_Source heading from doc:_ **Confidentiality: Students may have access to or knowledge of clients private or personal information at field placement **

_AI rationale:_ The section directly addresses confidentiality of client information and professional ethical standards students must uphold during field placement, matching Standard 19.c on Knowledge, Theory, Skills, and Values around confidentiality. Standard 14.c is a secondary match as it also covers confidentiality but in a broader context; Standard 21.d is tertiary as field placement policies documentation could support this content.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.c — Knowledge, Theory, Skills, and Values

Prompt: Confidentiality of information.

Response:
Confidentiality: Students may have access to or knowledge of clients private or personal information at field placement sites. Students must adhere to strict confidentiality, sharing this information only with the site-base field instructor and as directed by the field instructor. Client names must never be used in class discussion or in written materials for the course.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][c].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.68** &nbsp;words 100 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(v)	SPONSOR agrees to maintain records of any disclosures of Protected Health Information, and within ten days of a requ**

_AI rationale:_ This section describes institutional procedures for maintaining records and disclosures of Protected Health Information (PHI) in compliance with privacy regulations. Standard 19.c explicitly addresses 'Confidentiality of information,' which is the core governance and operational requirement being documented here. While Standard 14.c addresses student competencies in upholding confidentiality, this section is an institutional policy/procedure artifact, making 19.c the better fit.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 19.c — Knowledge, Theory, Skills, and Values

(v)	SPONSOR agrees to maintain records of any disclosures of Protected Health Information, and within ten days of a request by HEALTH SYSTEM for an accounting of disclosures of Protected Health Information, SPONSOR shall make available to HEALTH SYSTEM the information to provide such an accounting of disclosures.  At a minimum, such information shall include the date of disclosure, the name of the entity or person who received the Protected Health Information, and, if known, the address of such entity or person, a brief description of the Protected Health Information disclosed, and a statement of the purpose of the disclosure.

```

---

### `19.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _The worth and uniqueness of individuals based on intercultural fluency, including how they identify and the cultural groups to which they belong._

**→ Imported as NARRATIVE** (`narratives[19][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 354 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses the worth and uniqueness of individuals based on intercultural fluency and cultural groups, which is the core language of Standard 19.d. The program narrative demonstrates how diversity, culture, ethnicity, race, class, gender, religion, ability, and sexual orientation are integrated across multiple courses.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.d — Knowledge, Theory, Skills, and Values

Prompt: The worth and uniqueness of individuals based on intercultural fluency, including how they identify and the cultural groups to which they belong.

Response:
The worth and uniqueness of individuals including culture, ethnicity, race, class, gender, religion, ability, sexual orientation, and other expressions of diversity.Response:The worth and uniqueness of individuals including culture, ethnicity, race, class, gender, religion, ability, sexual orientation, and other expressions of diversity is emphasized throughout the program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 380, 440 and 441. This skill is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (specifically as part of Foundational Concepts and Ethical Issues).CHS 220 Diversity and Cultural Competence is devoted primarily to the goal of developing openness and a better understanding of the diversity of others. See all course objectives, the course schedule, and group presentation and immigrant interview assignments. In CHS 224 Research Methods and Writing, students learn how to conduct social science research in a way that upholds the integrity and dignity of diverse subjects (see Week 4). Students develop a detailed research proposal that specifies how these issues will be addressed. This principle is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 4; schedule); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the worth and uniqueness of individuals is a central operating principle. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific culturally sensitive behavior (See Student Field Placement Evaluation, Section IV). An emphasis on the worth and uniqueness of individuals in the context of social structures is a concept introduced in SOC 101, a required course in other departments. The topic is taught through in-class activity and discussion, in-class media presentation, lecture, assigned readings, and out-of-class assignments.

```

##### Match 2 — 🔵 **conf 0.42** &nbsp;words 87 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The purpose of this paper is for you to learn about the immigrant experience from a specific individual’s perspective.  **

_AI rationale:_ This assignment prompt emphasizes learning about individuals' experiences through their own perspective and cultural identity (immigrant background), which aligns best with Standard 19.d on intercultural fluency and understanding individuals' cultural group membership. The emphasis on listening to the person's lived experience rather than directive questioning also supports intercultural competence development.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.d — Knowledge, Theory, Skills, and Values

Prompt: The worth and uniqueness of individuals based on intercultural fluency, including how they identify and the cultural groups to which they belong.

Response:
The purpose of this paper is for you to learn about the immigrant experience from a specific individual’s perspective.  The individual can be a family member but does not have to be.  It does not matter whether the person is a documented or undocumented immigrant. The person you select must have been old enough at the time s/he came to this country to answer the questions meaningfully.  It is important that you give the person a chance to talk about their experience and not continuously ask questions.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][d].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `19.e` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Belief that individuals, service systems, and society can change._

**→ Imported as NARRATIVE** (`narratives[19][e].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 316 &nbsp; `auto_accept`

_Source heading from doc:_ **e.**

_AI rationale:_ The section content directly addresses the belief that individuals, service systems, and society can change through curricular coverage and field experiences, matching Standard 19.e specification language exactly.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.e — Knowledge, Theory, Skills, and Values

Prompt: Belief that individuals, service systems, and society can change.

Response:
Belief that individuals, services systems, and society can change.Response:The belief that individuals, services systems, and society can change is a fundamental tenant of the Counseling & Human Services program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441. This belief is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (classes on Foundational Concepts and the Role and Function of HS Workers in the schedule).CHS 220 Diversity and Cultural Competence emphasizes the belief that individuals, services systems, and society can change through an analysis of interactions between diverse groups of people. See all course objectives, the course schedule, and group presentation and immigrant interview assignments. In CHS 224 Research Methods and Writing, students investigate techniques for measuring the changes that occur when various interventions are applied. Students develop a detailed research proposal that specifies how these changes will be measured. This belief is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objectives; classes on stages of groups); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 340 Administration of Human Services focuses on the administrative issues related to managing change (see entire course schedule).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which many types of change is observed and practiced. Students are mentored and evaluated by their field instructor on their ability to exhibit a number of characteristics related to managing change (See Student Field Placement Evaluation, Section II - IV).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][e].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `19.f` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Interdisciplinary team approaches to problem solving._

**→ Imported as NARRATIVE** (`narratives[19][f].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 256 &nbsp; `auto_accept`

_Source heading from doc:_ **f.**

_AI rationale:_ The section content directly addresses interdisciplinary team approaches to problem solving across multiple courses (CHS 105, 224, 315/515, 360, 430, 340, 380, 440, 441), describing how students learn to work in teams, participate in team-based projects, and are evaluated on team collaboration skills. This matches Standard 19.f exactly.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.f — Knowledge, Theory, Skills, and Values

Prompt: Interdisciplinary team approaches to problem solving.

Response:
Interdisciplinary team approaches to problem solving.Response: Interdisciplinary team approaches to problem solving is emphasized throughout the program and is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 340, 380, 440 and 441. This approach is addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (team research project).In CHS 224 Research Methods and Writing, students learn about the design of social science research, which usually involves working in interdisciplinary teams. Students develop a detailed research proposal that describes how they will work with others to implement the research. Working with treatment teams is a primary objective and focus of the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 3; schedule); CHS 360 in the context of individual counseling techniques (see interview projects and schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 340 Administration of Human Services focuses on the management issues related to working in teams (see entire course schedule).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which students participate directly in interdisciplinary teams. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors related to working in teams (See Student Field Placement Evaluation, Section III and V).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][f].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `19.g` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Appropriate professional boundaries._

**→ Imported as NARRATIVE** (`narratives[19][g].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 298 &nbsp; `auto_accept`

_Source heading from doc:_ **g.**

_AI rationale:_ The section heading and content directly address 'Appropriate professional boundaries,' which is the exact language of Standard 19.g in the current 2025 spec. The narrative documents how the program teaches this competency across multiple courses and field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.g — Knowledge, Theory, Skills, and Values

Prompt: Appropriate professional boundaries.

Response:
Appropriate professional boundaries.Response:Appropriate professional boundaries are emphasized throughout the program, particularly as a component of professional behavior and expectations, and are specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441. Appropriate professional boundaries are addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (schedule, see specifically Foundational Concepts and Roles of HS Workers).CHS 220 Diversity and Cultural Competence emphasizes the importance of maintaining appropriate professional boundaries as an aspect of cultural competence. See course objectives, the course schedule, and group presentation and immigrant interview assignments.In CHS 224 Research Methods and Writing, students investigate a variety of social science research techniques that all include strict adherence to maintaining appropriate professional boundaries as a researcher. Students develop a detailed research proposal that specifies how these issues will be addressed. Maintaining appropriate professional boundaries is emphasized throughout the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 5); CHS 360 in the context of individual counseling techniques (see interview projects and class schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 340 Administration of Human Services addresses appropriate professional boundaries in the management of agencies and staff (see entire course schedule).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which students observe and practice appropriate professional boundaries. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors related to professional boundaries (See Student Field Placement Evaluation, Section III and V).

```

##### Match 2 — 🟡 **conf 0.88** &nbsp;words 50 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 5 Human service professionals recognize that multiple relationships may increase the risk of harm to or exploit**

_AI rationale:_ The section directly addresses professional boundaries and dual/multiple relationships, which aligns most precisely with Standard 19.g on 'Appropriate professional boundaries.' While Standard 17.d mentions ethical standards generally, 19.g specifically targets the boundary-management content of this passage.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.g — Knowledge, Theory, Skills, and Values

Prompt: Appropriate professional boundaries.

Response:
STANDARD 5 Human service professionals recognize that multiple relationships may increase the risk of harm to or exploitation of clients and may impair their professional judgment. When it is not feasible to avoid dual or multiple relationships, human service professionals should consider whether the professional relationship should avoided or curtailed.

```

##### Match 3 — 🟡 **conf 0.72** &nbsp;words 61 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 4 If it is suspected that danger or harm may occur to the client or to others as a result of a client's behavio**

_AI rationale:_ The section describes professional ethical conduct when client or third-party safety is at risk, including breaking confidentiality and seeking consultation—core elements of appropriate professional boundaries and ethical decision-making. This aligns most directly with Standard 19.g (appropriate professional boundaries) and secondarily with 14.c (confidentiality and information sharing).

**Exact text that will be written to the narrative slot:**

```text
Standard 19.g — Knowledge, Theory, Skills, and Values

Prompt: Appropriate professional boundaries.

Response:
STANDARD 4 If it is suspected that danger or harm may occur to the client or to others as a result of a client's behavior, the human service professional acts in an appropriate and professional manner to protect the safety of those individuals. This may involve, but is not limited to, seeking consultation, supervision, and/or breaking the confidentiality of the relationship.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 60 &nbsp; `review_low_confidence`

_Source heading from doc:_ **STANDARD 19 Human service professionals avoid duplicating another professional's helping relationship with a client. The**

_AI rationale:_ The narrative addresses avoiding duplication of helping relationships and consulting/collaborating with other professionals—core content of professional boundaries (19.g) in the 2025 specification. The emphasis on consultation and coordination with other professionals supports this ethical boundary specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.g — Knowledge, Theory, Skills, and Values

Prompt: Appropriate professional boundaries.

Response:
STANDARD 19 Human service professionals avoid duplicating another professional's helping relationship with a client. They consult with other professionals who are assisting the client in a different type of relationship when it is in the best interest of the client to do so. In addition, human services professionals seek ways to actively collaborate and coordinate with other professionals when appropriate.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][g].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `19.h` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at 10. Self-Development Context: Human services professionals use their experience and knowledge to understand and help clients. This requires awareness of one’s values, cultural bias, philosophies, personality, and style in the effective use of the professional self. It also requires an understanding of how these personal characteristics affect clients._

**→ Imported as NARRATIVE** (`narratives[19][h].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 393 &nbsp; `auto_accept`

_Source heading from doc:_ **h.**

_AI rationale:_ The section directly addresses integration of NOHS/CSHSE ethical standards throughout the curriculum and field experiences, which matches Standard 19.h's specification on integrating these ethical standards. Standard 17.d (developing behaviors congruent with ethical standards) is a secondary fit but less precise than the explicit 'integration' language in 19.h.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.h — Knowledge, Theory, Skills, and Values

Prompt: Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at 10. Self-Development Context: Human services professionals use their experience and knowledge to understand and help clients. This requires awareness of one’s values, cultural bias, philosophies, personality, and style in the effective use of the professional self. It also requires an understanding of how these personal characteristics affect clients.

Response:
Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available on NOHS website).Response:The ethical standards outlined by the National Organization for Human Services (NOHS) and the Council for Standards in Human Service Education are part of the CHS Student Handbook which is given to every human services major before they enter the Program. Each new student signs a form acknowledging receipt of the handbook and agreeing to abide by the ethical standards. The standards are also incorporated into the behavioral indicators (3.D.) which are prerequisite for field experiences. The NOHS ethical standards are integrated throughout the curriculum and are specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441. Ethical standards are addressed through readings, lectures, and discussions in CHS 105 Human Services and Social Policy (Course Objective #4; unit on Ethical Issues in course schedule).CHS 220 Diversity and Cultural Competence emphasizes the importance the ethical standards in dealing with others as a component of cultural competence. See course objectives, the course schedule, and group presentation and immigrant interview assignments.In CHS 224 Research Methods and Writing, students learn about ethical requirements of social science research (see Week 4). Students develop a detailed research proposal that follows ethical guidelines. Adhering to the NOHS code of ethics is emphasized throughout the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (Course Objective 5); CHS 360 in the context of individual counseling techniques (Course Objective 4); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see group assignment analyzing the application of family therapy models). CHS 340 Administration of Human Services addresses the application of ethical standards in administering Human Services agencies, including managing staff, interacting with the community and offering services to clients (see entire course schedule, particularly unit on ethical issues).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which students practice applying ethical standards in a professional setting. Students are mentored and evaluated by their field instructor on their ability to demonstrate specific professional attitudes and behaviors related to ethical behaviors (See Student Field Placement Evaluation, Section III.D., IV and V).

```

##### Match 2 — 🟡 **conf 0.72** &nbsp;words 70 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 26 Human service professionals seek the training, experience, education and supervision necessary to ensure the**

_AI rationale:_ The section addresses professional development, cultural competence, and self-awareness in working with diverse populations—core elements of Standard 19.h on integrating ethical standards and understanding one's professional self in relation to client effectiveness.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.h — Knowledge, Theory, Skills, and Values

Prompt: Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at 10. Self-Development Context: Human services professionals use their experience and knowledge to understand and help clients. This requires awareness of one’s values, cultural bias, philosophies, personality, and style in the effective use of the professional self. It also requires an understanding of how these personal characteristics affect clients.

Response:
STANDARD 26 Human service professionals seek the training, experience, education and supervision necessary to ensure their effectiveness in working with culturally diverse individuals based on age, ethnicity, culture, race, ability, gender, language preference, religion, sexual orientation, socioeconomic status, nationality, or other historically oppressive groups.  In addition, they will strive to increase their competence in methods which are known to be the best fit for the population(s) with whom they work.

```

##### Match 3 — 🟡 **conf 0.72** &nbsp;words 55 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 43 Human service educators are aware that in their relationships with students, power and status are unequal. H**

_AI rationale:_ The section addresses educator awareness of power dynamics and ethical conduct in student relationships, directly mapping to the integration of ethical standards and self-development context in Standard 19.h, which requires understanding how personal characteristics and professional relationships affect others.

**Exact text that will be written to the narrative slot:**

```text
Standard 19.h — Knowledge, Theory, Skills, and Values

Prompt: Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at 10. Self-Development Context: Human services professionals use their experience and knowledge to understand and help clients. This requires awareness of one’s values, cultural bias, philosophies, personality, and style in the effective use of the professional self. It also requires an understanding of how these personal characteristics affect clients.

Response:
STANDARD 43 Human service educators are aware that in their relationships with students, power and status are unequal. Human service educators are responsible to clearly define and maintain ethical and professional relationships with student; avoid conduct that is demeaning, embarrassing or exploitative of students; and always strive to treat students fairly, equally and without discrimination.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[19][h].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Standard 20

### `20.a` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Conscious use of self._

**→ Imported as NARRATIVE** (`narratives[20][a].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 487 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The narrative directly addresses conscious use of self as a core knowledge, theory, skill, and value, with detailed coverage of how it is taught across the curriculum and practiced in field placements. Standard 20.a explicitly specifies 'Conscious use of self' as a primary competency.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.a — Knowledge, Theory, Skills, and Values

Prompt: Conscious use of self.

Response:
Conscious use of self.Response:The conscious use of self is emphasized throughout the Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440 and 441.Included in the CHS 105 Human Services and Social Policy course objectives are the objectives that the student “describe how personal, ethical, and legal issues affect the delivery of human services” (#4) and “specify how his/her personal values and goals relate to a career in human services” (#6.).  In addition, conscious use of self is explored through assigned readings, lecture, and in-class activities (particularly the unit on the helping relationship, see schedule). CHS 220 Diversity and Cultural Competence emphasizes the conscious use of self as a component of cultural competence, particularly a focus on self-awareness and the influence of one’s own culture on perceptions and actions. See course objectives, the course schedule, and group presentation and immigrant interview assignments.In CHS 224 Research Methods and Writing, students learn about the conscious use of self as it relates to the influence a researcher can have on the data being collected (see Week 10). Students develop a detailed research proposal that accounts for the influence of self. The conscious use of self as a therapeutic tool is emphasized in all the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (process analysis paper; schedule); CHS 360 in the context of individual counseling techniques (Course Objective 1; interview papers; schedule); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see family of origin assignment; Genograms and Ecomaps; and group project analyzing the application of family therapy models). CHS 340 Administration of Human Services focuses on administrative issues, including personal leadership and the use of self to form relationships and manage effectively (see Course Objective #1; course schedule).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the conscious use of self is learned and practiced. Objective 2 of the CHS 380 course is that the students “analyze their own natural style of helping and its impact.” Students in the CHS 380 course use journaling, portfolios, and a substantial Reflection Paper which incorporates several self-assessment tools to broaden and explore their conscious use of self (Course Requirements 3, 4, and 5). In all field placements, students are mentored and evaluated by their field instructor partly on their ability to accept constructive criticism, analyze interpersonal strengths and weaknesses, and develop personal goals and objectives (See Student Field Placement Evaluation, Section II). Students also evaluate themselves using this tool. The journaling and reflection papers in CHS 440 and 441, as well as the seminar discussions, readings, issue presentation, lecture, development of the professional portfolio, and poster presentation are all designed to promote conscious use of self.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 203 &nbsp; `review_low_confidence`

_Source heading from doc:_ **DiAngelo is correct in saying we all have our own experience but how can I tell who has had what experience and how to a**

_AI rationale:_ The section reflects on personal bias, self-awareness regarding implicit prejudice, and the student's conscious recognition of their own perspectives and interpersonal triggers—core elements of conscious use of self. While cultural competence (12.f) is tangentially present, the dominant focus is self-reflective awareness in relational contexts.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.a — Knowledge, Theory, Skills, and Values

Prompt: Conscious use of self.

Response:
DiAngelo is correct in saying we all have our own experience but how can I tell who has had what experience and how to assess a situation properly. Which opens our eyes to the good/bad binary mentioned throughout the video, the bad or racist people often have specific characteristics associated with them and she says this binary prevents us from seeing people in a different light. But in personal experience, often this binary is true. My grandfather is an old white, republican, trump supporter and often stands behind his very similar racist beliefs, beliefs that extend beyond race to other ways that people live their lives. Not to say that I do not care about my grandfather but I vehemently disagree with him and often feel like I am in a losing battle when trying to discuss race. Implicit bias is rampant in our society and while not always correct, certain people do fit into that binary, often stereotypes are stereotypes for a reason. Not to say that we should not give people a chance but rather to address that implicit bias is created through experience. The good bad binary, while maybe should be considered as not totally accurate can often reign true.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[20][a].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `20.b` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Clarification of personal and professional values._

**→ Imported as NARRATIVE** (`narratives[20][b].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 475 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly addresses 'Clarification of personal and professional values' — the exact language of Standard 20.b. The narrative describes how the program emphasizes self-awareness, values exploration, and professional identity development across multiple courses and field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.b — Knowledge, Theory, Skills, and Values

Prompt: Clarification of personal and professional values.

Response:
Clarification of personal and professional values.Response:The clarification of personal and professional values is emphasized throughout the Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 220, 224, 315/515, 360, 430, 380, 440 and 441.Included in the CHS 105 Human Services and Social Policy course objectives are the objectives that the student “describe how personal, ethical, and legal issues affect the delivery of human services” (#4) and “specify how his/her personal values and goals relate to a career in human services” (#6.).  In addition, clarification of values is explored through assigned readings, lecture, and in-class activities related to self-assessment and becoming a helper and the helping process (see schedule). CHS 220 Diversity and Cultural Competence addresses the clarification of values in the context of diversity and cultural competence. Objective 1 of this course articulates that students should be able to “identify one’s own ethnic heritage, history or cultural background, values and assumptions and how this can affect one’s experience as a practitioner”.  This is amplified by Course Requirement 4 “Cultural Autobiography”.In CHS 224 Research Methods and Writing, students learn about the clarification of values as it relates to the values that are attached to social science research (see Week 10). Students develop a detailed research proposal that addresses the values and motivation behind the research. The clarification of personal and professional values is emphasized in all the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (process analysis paper); CHS 360 in the context of individual counseling techniques (Course Objective 1; interview papers); and CHS 430 Family Dynamics and Interventions in the context of family therapy (see family of origin assignment; Genograms and Ecomaps; and group project analyzing the application of family therapy models). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the clarification of personal and professional values is emphasized. Objective 2 of the CHS 380 course is that the students “analyze their own natural style of helping and its impact.” Students in the CHS 380 course use journaling, portfolios, and a substantial Reflection Paper which incorporates several self-assessment tools to help explore personal values (Course Requirements 3, 4, and 5). In all field placements, students are mentored and evaluated by their field instructor partly on their ability to accept constructive criticism, analyze interpersonal strengths and weaknesses, and develop personal goals and objectives (See Student Field Placement Evaluation, Section II). Students also evaluate themselves using this tool. The journaling and reflection papers in CHS 440 and 441, as well as the seminar discussions (“Understanding Yourself”), readings, issue presentation, lecture, development of the professional portfolio, and poster presentation are all designed to help students clarify their personal and professional values.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[20][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `20.c` 🔴 no match — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Awareness of intercultural fluency as outlined in Standard 19.d._

**→ Imported as NARRATIVE** (`narratives[20][c].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[20][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `20.d` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Strategies for self-care._

**→ Imported as NARRATIVE** (`narratives[20][d].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 353 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The narrative directly addresses 'Strategies for self-care' as specified in Standard 20.d, documenting how the program integrates self-care instruction across multiple courses and field placements through journaling, reflection, self-assessment, and mentored clinical experiences.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.d — Knowledge, Theory, Skills, and Values

Prompt: Strategies for self-care.

Response:
Strategies for self-care.Response:Strategies for self-care are emphasized throughout the Counseling & Human Services Program. They are specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 315/515, 360, 430, 380, 440 and 441.CHS 105 Human Services and Social Policy addresses strategies for self-care through class exercises, discussions, lecture, and readings related to classes defining helping and the role of the Human Services worker. Strategies for self-care is an important component of all the clinical skills courses: CHS 315/515 Group Counseling within the context of group counseling techniques (process analysis paper; schedule); CHS 360 in the context of individual counseling techniques (schedule); and CHS 430 in the context of family therapy (group project analyzing the application of family therapy models and related assignments, readings, lecture, and media presentations designed to promote increased self-awareness, reflection, and discussion of ways students can experience strategies for self-care both in the context of their own families and in working with other families; family of origin project). CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which strategies for self-care are emphasized. Objective 2 of the CHS 380 course is that the students “analyze their own natural style of helping and its impact.” Students in the CHS 380 course use journaling, portfolios, and a substantial Reflection Paper which incorporates several self-assessment tools to help improve their strategies for self-care (Course Requirements 3, 4, and 5). In all field placements, students are mentored and evaluated by their field instructor partly on their ability to accept constructive criticism, analyze interpersonal strengths and weaknesses, and develop personal goals and objectives (See Student Field Placement Evaluation, Section II). Students also evaluate themselves using this tool. The journaling and reflection papers in CHS 440 and 441, as well as the seminar discussions ( “Understanding Yourself”), readings, issue presentation, lecture, and poster presentation are all designed to help students strengthen their strategies for self-care. One class session in CHS 441 focuses on burnout and self-care strategies (“Advanced Tools for Staying Engaged”).

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[20][d].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `20.e` 🟢 has narrative — Knowledge, Theory, Skills, and Values

**Spec prompt:** _Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency)._

**→ Imported as NARRATIVE** (`narratives[20][e].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 442 &nbsp; `auto_accept`

_Source heading from doc:_ **e.**

_AI rationale:_ The section directly addresses reflection on professional self through journaling, portfolio development, and competency-demonstrating projects across the curriculum, which is the exact language of Standard 20.e in the current 2025 specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).Response:The reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency) is emphasized throughout the Counseling & Human Services Program. It is specifically addressed through in-class activities and discussions, lecture, in-class media presentation, assigned reading and out-of-class activities in the following human services classes: CHS 105, 224, 340, 430, 380, 440 and 441. Students complete a Professional Portfolio project throughout their curriculum. They begin the portfolio in CHS 217, developing a resume and describing agencies they have visited. In CHS 380 they add to the portfolio based on self-assessment inventories and their experiences in Internship. The portfolio is completed in CHS 441 and it designed to reflect their professional accomplishments and personal insights throughout the program. CHS 105 Human Services and Social Policy course objectives include: 4) “describe how personal, ethical, and legal issues affect the delivery of human services” and 6) “specify how his/her personal values and goals relate to a career in human services”.  In addition, reflection on professional self is explored through assigned readings, lecture, and in-class activities specifically related to the role of self in establishing a helping relationship. In CHS 224 Research Methods and Writing, students complete a project demonstrating competency that reflects their professional self when they develop a detailed research proposal related to an aspect of the human services field. In CHS 340 Administration of Human Services, students complete two projects related to professional self: they work as a group to design a strategic plan and they write a formal proposal seeking resources (Course Requirements 2 and 6). The CHS 430 Family Dynamics and Interventions course objectives include the expectations that the student be able to 2)“articulate how one’s family history influences perceptions of family processes” and 5) “demonstrate sensitivity to differences in family structure and social, economic and cultural background.” Related assignments, readings, lecture, and media presentations are designed to promote reflection on professional self (Family of Origin Project).CHS 380 Internship, 440 Practicum, and 441 Seminar involve class or seminar experiences and field placement experiences in which the reflection on professional self is learned and practiced. Objective 2 of the CHS 380 course is that the students “analyze their own natural style of helping and its impact”.  Students in the CHS 380 course use journaling, portfolios, and a substantial Reflection Paper which incorporates several self-assessment tools to broaden and explore their reflection on professional self (Course Requirements 3, 4, and 5). The journaling, discussions, readings, issue presentation, lecture, professional portfolio, and poster presentation of the CHS 441 course are also designed to promote reflection on professional self.

```

##### Match 2 — 🟢 **conf 0.89** &nbsp;words 92 &nbsp; `auto_accept`

_Source heading from doc:_ **Professional portfolios were collected from one of the two CHS 441 Seminar in Human Services courses that graduating sen**

_AI rationale:_ The section describes assessment of professional portfolios from graduating seniors using a rubric and rating scale, directly matching Standard 20.e's specification for 'development of a portfolio' as evidence of reflection on professional self and competency demonstration.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
Professional portfolios were collected from one of the two CHS 441 Seminar in Human Services courses that graduating seniors complete in conjunction with their practicum experience in their last semester. A total of 10 portfolios were examined (59% of graduating students). Each portfolio was rated independently by two faculty members on each of the three outcomes, using the attached rubric and a 3-points scale. Ratings were: Inadequate/No Evidence (0), Adequate/Satisfactory (1), and Excellent (2). Raters gave the same ratings on 83% of the items. When ratings were different, they were averaged together.

```

##### Match 3 — 🟢 **conf 0.89** &nbsp;words 50 &nbsp; `auto_accept`

_Source heading from doc:_ **In this class, you will complete the professional portfolio that you have been developing. The portfolio will document y**

_AI rationale:_ This course assignment directly addresses Standard 20.e's requirement for 'development of a portfolio' as a mechanism for reflection on professional self. The narrative explicitly describes portfolio development as documentation of knowledge and skills with reflection on past and future professional growth.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
In this class, you will complete the professional portfolio that you have been developing. The portfolio will document your knowledge and skills and help you reflect about what you have done and what you will do. Your portfolio will help you to prepare for job interviews and graduate school applications.

```

##### Match 4 — 🔵 **conf 0.82** &nbsp;words 55 &nbsp; `review_low_confidence`

_Source heading from doc:_ **After you complete your interview, you will write a paper (either traditional format or questions followed by answers an**

_AI rationale:_ The section describes a reflective assignment (paper with reflection covering learning, surprises, and changed views) that directly aligns with Standard 20.e's requirement for reflection on professional self through a project demonstrating competency. While the content involves an interview, the emphasis is on the student's reflective synthesis afterward, not the interview skill itself.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
After you complete your interview, you will write a paper (either traditional format or questions followed by answers and double-spaced) which addresses the questions asked and then includes a reflection by you  that should cover 1)what you learned from the interview, 2)what surprised you and 3)how your views might have changed based on the interview.

```

##### Match 5 — 🔵 **conf 0.78** &nbsp;words 102 &nbsp; `review_low_confidence`

_Source heading from doc:_ **2.  Journals (25%) Students will write a journal reflection at the end of each week they are in placement which is submi**

_AI rationale:_ The section describes a weekly journaling assignment requiring student reflection on experiences, thoughts, and feelings during field placement—a direct match to Standard 20.e's specification of journaling as a method for reflection on professional self. While field experience monitoring is mentioned in the candidate list, the core content addresses reflective practice rather than site visit documentation.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
2.  Journals (25%) Students will write a journal reflection at the end of each week they are in placement which is submitted to their University Supervisors via email. The journal is due each Friday at midnight and should be at least one-page, single-spaced in length. Each journal entries will include a summary of activities and duties performed that week, a reflection on one’s thoughts and feelings about experiences that week and responses to questions or prompts from the University Supervisor. In order to protect client confidentiality, never include the name of the agency, clients or client identifiable information in the journal entries.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 73 &nbsp; `review_low_confidence`

_Source heading from doc:_ **We will continue to emphasize professionalism in all program courses and settings. In the future, this may not be the be**

_AI rationale:_ The section explicitly describes plans to assess student professional development through portfolios and capstone coursework assignments, directly aligning with Standard 20.e's specification for reflection on professional self through portfolio development as a competency demonstration method.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
We will continue to emphasize professionalism in all program courses and settings. In the future, this may not be the best instrument to assess student attainment of goals. We plan to examine student professional portfolios, which are developed in their seminar course, as well as an assignment from the capstone clinical skills course (CHS 430 Family Dynamics and Interventions). This will hopefully give us better data to distinguish areas of difficulty for students.

```

##### Match 7 — 🔵 **conf 0.72** &nbsp;words 60 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students develop personal learning objectives and document progress toward meeting the objectives by journaling with the**

_AI rationale:_ The section describes students developing personal learning objectives, journaling with faculty supervisors, and maintaining portfolios—all core reflective practices for demonstrating competency and professional self-development as specified in Standard 20.e. The mention of seminars and field agency assignments provides secondary relevance to Standard 21 specs, but the primary focus is reflective documentation and portfolio development.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
Students develop personal learning objectives and document progress toward meeting the objectives by journaling with their faculty supervisor. As part of the seminar, students augment individual portfolios developed in prior human services courses and present a discussion of their experience at the end of the semester.  Additional assignments may be required for the courses or from the human services agency.

```

##### Match 8 — 🔵 **conf 0.72** &nbsp;words 60 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Students develop personal learning objectives and document progress toward meeting the objectives by journaling with the**

_AI rationale:_ The section describes students documenting progress toward learning objectives through journaling and portfolio development with faculty supervision in a seminar context. This directly addresses Standard 20.e's specification for reflection on professional self through journaling and portfolio development. While the field experience seminar context is present, the primary focus is on the reflective learning process rather than field placement documentation.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
Students develop personal learning objectives and document progress toward meeting the objectives by journaling with their faculty supervisor. As part of the seminar, students augment individual portfolios developed in prior human services courses and present a discussion of their experience at the end of the semester.  Additional assignments may be required for the courses or from the human services agency.

```

##### Match 9 — 🔵 **conf 0.72** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will deliver a short (3 minutes or less) oral presentation about some aspect of your family that illustrate**

_AI rationale:_ This assignment requires students to reflect on personal/family experiences and dynamics through creative oral presentation, directly addressing the reflection on professional self specification. While family structures and roles appear in the content, the assignment's primary pedagogical intent is reflective self-awareness development.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
Each student will deliver a short (3 minutes or less) oral presentation about some aspect of your family that illustrates a family dynamic (i.e., reflections about the role a family member assumed, family rituals, difficult moments, humorous moments which taught you something, family events or individuals that shaped you). Creativity is encouraged. Photos, poems, songs are also welcome.

```

##### Match 10 — 🔵 **conf 0.72** &nbsp;words 113 &nbsp; `review_low_confidence`

_Source heading from doc:_ **For each chapter assigned in the Sweitzer and King book, students will submit a one-page reflection that highlights one **

_AI rationale:_ The section describes a reflective writing assignment (one-page reflections on chapter readings) that directly aligns with Standard 20.e's requirement for 'reflection on professional self' through journaling or portfolio-type demonstrations. While field experience context is mentioned, the assignment itself is a reflective learning tool rather than field placement documentation.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
For each chapter assigned in the Sweitzer and King book, students will submit a one-page reflection that highlights one significant insight or noteworthy item they have gained from their reading of the chapter. In weeks where two chapters are assigned, there should be a separate reflection for each chapter (in one Word doc). These insights may consist of new ideas acquired, confirmations of prior beliefs, or applications of the reading to your placement. Reflections should be emailed to the instructor NO LATER THAN THE Sunday before the chapters will be discussed in the upcoming Monday class. See which chapters are assigned under the “Course Schedule Information” section at the end of our syllabus.

```

##### Match 11 — 🔵 **conf 0.72** &nbsp;words 96 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Your professional portfolio will be unique, but it will contain the four common elements listed below and the components**

_AI rationale:_ The section describes a professional portfolio containing reflection on learning, professional philosophy, values, and goals—directly matching Standard 20.e's specification for 'Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).' The portfolio structure explicitly includes self-reflection components central to professional self-development.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
Your professional portfolio will be unique, but it will contain the four common elements listed below and the components related to each of them. You should include an introduction section with a complete and professional resume; a list of courses with brief descriptions, reflection on your learning, and examples of your work; a field experiences section that summarizes you work in the human services field (this is different from your resume); and a section on your professional philosophy and values and your professional goals. It is imperative that you proofread carefully for spelling, grammar, and punctuation.

```

##### Match 12 — 🔵 **conf 0.52** &nbsp;words 72 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will write a research proposal that has potential for contributing to current knowledge in the student’s ch**

_AI rationale:_ The section describes a student assignment involving development of a research proposal with iterative feedback and portfolio maintenance, which aligns best with Standard 20.e's requirement for reflection on professional self through portfolio development or project demonstrating competency.

**Exact text that will be written to the narrative slot:**

```text
Standard 20.e — Knowledge, Theory, Skills, and Values

Prompt: Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency).

Response:
Each student will write a research proposal that has potential for contributing to current knowledge in the student’s chosen topic/interest.  Students will develop this proposal, in stages, throughout the semester.  Each part of the proposal may be rewritten/improved using comments on the original version.  Students are encouraged to maintain a folder for all their work in this assignment.  The details of this assignment & the grading rubric are provided in this syllabus.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[20][e].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.78** &nbsp;words 203 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Reflection Papers (30% of your total grade) The reflection papers give you an opportunity to connect your own experience**

_AI rationale:_ This syllabus section describes a reflective assignment requiring students to connect personal experience to course material, directly aligning with Standard 20.e's specification for reflection on professional self (e.g., journaling). The assignment is supporting evidence of how the program operationalizes self-reflection as a learning outcome.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 20.e — Knowledge, Theory, Skills, and Values

Reflection Papers (30% of your total grade) The reflection papers give you an opportunity to connect your own experience of human development to the material you are learning in this class. You will be submitting four reflection papers for this course. All reflections should be submitted through Blackboard by the time and date specified in the assignment. Each paper is worth 75 points. Late papers will lose 7.5 points for each 24-hour period. For example, if a paper is due at 11:59pm on Wednesday and you do not submit it until 12:15pm on Friday, the maximum possible points you can earn for that paper will be 75 – (7.5 x 2) = 60. Each reflection paper should be about 2-3 pages long, double-spaced written with Times New Roman font. Specific prompts will be discussed in class and then posted on the course website at least a week prior to the due date. Please cite your instructor (M. Wong, personal communication, Insert date here) and/or the textbook for in-text citations. A reference is not necessary for these papers. If you are unfamiliar with APA style, visit http://www.apastyle.org/learn/tutorials/basics-tutorial.aspx and pay special attention to slides 13 to 25. Be sure to visit Blackboard for more information.

```

##### Evidence 2 — 🔵 **conf 0.72** &nbsp;words 388 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This rubric assesses a reflective writing assignment on sociological concepts and the sociological imagination applied to personal experience—a direct match to Standard 20.e's requirement for reflection on professional self through demonstration of competency. The grammar and content standards embedded in the rubric align with portfolio or project-based assessment of self-awareness and critical thinking.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 20.e — Knowledge, Theory, Skills, and Values

Parts of
Paper
Excellent
Very Good
Good
Adequate
Inadequate
Use of
Sociology
Concepts
Correctly uses 14-15 sociology concepts
Correctly uses 12-13 sociology concepts
Correctly uses 10-11 sociology concepts
Correctly uses 7-9 sociology concepts
Correctly uses 6 or less sociology concepts
Pts: 70%
Apply the sociological imagination
Work applies the sociological imagination convincingly: explains connections between author’s experience and society clearly & logically or supports shared experience method with at least one peer-reviewed source.
Work applies the sociological imagination somewhat convincingly: explanation of connections between author’s experience and society lack sufficient clarity and logic or supports shared experience method with non-peer reviewed source.
Work applies the sociological imagination in a manner that is not sufficiently convincing: explanation of connection between author’s experience & society lacks clarity or logic or uses shared experience method without support.
Work applies the sociological imagination in a manner that is not coherent: explanation of connection between author’s experience & society is illogical & incoherent or shared experience claim is not supported.
Work does not apply the sociological imagination: there is no evidence of attempt to apply the sociological imagination in the work.
Pts: 20%
Use of grammar in work/paper
Work written in proper English with proper grammatical structure, with clear thesis statement. Work’s title relates to a theme in the guidelines and reflects the text.  Work effectively tells the story of author’s experience.  Contains few, if any, errors in grammar, punctuation, capitalization and spelling.
Work written in proper English with mostly proper grammatical structure, somewhat effectively tells the story of the author’s experience.  Contains minor errors in grammar, capitalization and spelling. Work’s title relates to a theme in the guidelines and reflects the text. .
Work written in proper English with somewhat proper grammatical structure and somewhat tells the story of the author’s experience. Its title relates to a theme in the guidelines.   Contains some errors in grammar, capitalization, punctuation & spelling.
Work written in English with minimal structure.  Fail to clearly tell the story of the author’s experience.  Contains several errors in grammar, punctuation, capitalization and spelling.  Its title not clearly tied to a theme in the guidelines.
Work poorly written.  Contains numerous grammar, punctuation, capitalization and spelling errors.  These errors interfere with the reader’s understanding of the writing. Uses assignment as title for paper or fails to provide a title.
Pts: 10%

```

---

## Standard 21

### `21.a` 📊 curriculum matrix + 🟢 has narrative — Field Experience

**Spec prompt:** _Provide a brief description of the overall process and structure of the fieldwork learning experience._

**→ Imported as NARRATIVE** (`narratives[21][a].content`):

##### Match 1 — 🟢 **conf 0.95** &nbsp;words 960 &nbsp; `auto_accept`

_Source heading from doc:_ **a.**

_AI rationale:_ The section directly provides a brief description of the overall process and structure of fieldwork learning experiences (internship and practicum), matching Standard 21.a language exactly. It also describes written learning contracts and progression elements that support 21.e and 21.h.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.a — Field Experience

Prompt: Provide a brief description of the overall process and structure of the fieldwork learning experience.

Response:
Provide a brief description of the overall process and structure of the fieldwork learning experience.Response: (See Field Placement Handbook)Internship During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a field experience in a professional human services setting (CHS 380 Internship).  This placement provides students with the opportunity to apply the knowledge and skills they have learned in the program.  Concurrently, they explore professional issues in a seminar that meets one hour each week.  The internship is an important precursor to the practicum, which is a much more extensive and intensive experience. In the fall of their junior year, students meet with the Field Placement Coordinator to determine eligibility and to discuss placement interests.  The Field Placement Coordinator then suggests appropriate agencies for students to contact for an interview.  Practicum During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a professional human services setting (CHS 440 Practicum). [Note the 12-credit hour option (540 hours) was recently eliminated, since it was determined that the extra hours did not add to the value of the experience, but did add significantly to student stress levels. Some students who entered the program under the previous curriculum are still completing the 12-credit practicum, but most are being advised into the 9-credit practicum.] Like the internship, the practicum experience allows students to apply the knowledge and skills learned throughout the program.  In the practicum, students function much like entry level staff members and are valued members of service teams. Concurrently, students enroll in CHS 441, a 3-credit course entitled Seminar in Counseling & Human Services.  The seminar provides students an opportunity to discuss and reflect upon issues that may arise during the practicum.  Topics that are covered include the role of the student in a professional setting as well as issues that pertain to the field of human services.Students develop personal learning objectives and document progress toward meeting the objectives by journaling with their faculty supervisor. As part of the seminar, students augment individual portfolios developed in prior human services courses and present a discussion of their experience at the end of the semester.  Additional assignments may be required for the courses or from the human services agency.  The semester before Practicum, students meet with the Field Placement Coordinator to determine eligibility and to discuss placement interests.  The Field Placement Coordinator then suggests an appropriate agency or agencies for students to contact for an interview.  Guidelines All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, students may not complete their internship or practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.Written Learning Contract.  A written learning contract for each student is developed and agreed to by the student, the University, and the field instructor. Through their seminar experiences, students are encouraged to write learning objectives in behavioral terms that describe specific actions and activities.  Field instructors collaborate with the students in writing the objectives, and the University Supervisor approves them.     Student Field Placement Evaluation.  Students in field placements are guided and evaluated by their field instructors and by themselves using the Student Field Placement Evaluation.  The field placement evaluation tool consists of six goals, which are also the goals of the Program.  Each goal is accompanied by a list of behavioral objectives. Goals and objectives are evaluated as “Below”, “Meets”, or “Exceeds” Expectations, and evaluators have space to comment on each goal or objective if desired.Students and field instructors each complete the evaluation tool midway through the semester and at the end of the semester. Field instructors write overall comments at midpoint, and both field instructors and faculty supervisors write overall, final comments.  In addition, field instructors recommend a grade of Pass or Fail at the end of the semester.  The University Supervisor, however, has the final say in determining a student’s grade.  In creating the Student Field Placement Evaluation, we attempted to make it uncomplicated for the field instructor to fill out and, at the same time, comprehensive enough to provide in-depth information about the student’s performance in his or her field placement.  Information from students, field instructors, and advisory board members was instrumental in its development.  Comments from field instructors, the Advisory Board, and faculty members indicate that the tool is user friendly both for those who are making the evaluations and for those who are interpreting the results. This spring the evaluation was modified slightly to reflect revised program goals. Agency Evaluation by Student. Students in field placements evaluate their placement sites by using the Agency Evaluation by Student.  This tool consists of 9 criteria to which students respond Strongly Agree, Agree, Disagree, Strongly Disagree, or Not Enough Data to Evaluate.  Four additional items permit students to comment on additional aspects of the agency.  Finally, students are asked whether they would recommend the placement to another student.  Students complete the tool at the end of their field experience and submit it to the University Supervisor who, in turn, gives it to the Field Placement Coordinator.  Please see Appendix 4 for a copy of the instrument, or click here (students complete the survey online).University Supervisor Evaluation by Student.  Students in field placements evaluate their University Supervisors.   This tool consists of 13 criteria to which students respond Strongly Agree, Agree, Disagree, Strongly Disagree, or No Opinion. A section for Additional Comments and/or Suggestions is provided. See Appendix 8, or click here (students complete the survey online).

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 74 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 28 students are i**

_AI rationale:_ This brief summary reports current field placement census and site locations, fitting best under Standard 21.a's requirement for 'a brief description of the overall process and structure of the fieldwork learning experience.' While it could support 21.j (site visits/monitoring) or 21.c (agency exposure), it is primarily contextual reporting of program structure.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.a — Field Experience

Prompt: Provide a brief description of the overall process and structure of the fieldwork learning experience.

Response:
Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 28 students are in internships and 17 students are in practicum placements. There are no new placements for practicum students this semester, but a new site near campus is working with an intern: Maximum Day Services, a medical day treatment and substance abuse program. Six students are at Sheppard Pratt, four are at St. Vincent’s and three are at St. Elizabeth School.

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 105 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 12 students are i**

_AI rationale:_ The section provides a descriptive summary of the overall field experience structure, including current placements, enrollment projections, and site development—directly matching Standard 21.a's requirement for a brief description of the overall fieldwork learning experience process and structure.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.a — Field Experience

Prompt: Provide a brief description of the overall process and structure of the fieldwork learning experience.

Response:
Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 12 students are in practicum placements in a variety of placement sites, including the Baltimore Child Abuse Center, Kennedy Krieger, St. Elizabeth School, Mtn. Manor, Sheppard Pratt, and the Y of Central Maryland. We are anticipating 20 students in practicum next semester and 22 in internship. Mayaugust is currently working with students to find placements and already has three confirmed. New sites being developed include Project Youth at Johns Hopkins, Turn Around (a program dealing with human trafficking), and International Social Services. Ted described the field placements at CCBC related to addiction counseling.

```

##### Match 4 — 🔵 **conf 0.62** &nbsp;words 95 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 21 students are i**

_AI rationale:_ This section provides a descriptive summary of field placements, agencies, and student enrollment numbers, which aligns best with Standard 21.a's request for 'a brief description of the overall process and structure of the fieldwork learning experience.' While site monitoring (21.j) is implied, no explicit evidence of site visits is documented.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.a — Field Experience

Prompt: Provide a brief description of the overall process and structure of the fieldwork learning experience.

Response:
Field Experiences Summary: Mayaugust Finkenberg reported on field placements this semester. Currently, 21 students are in internships and 17 students are in practicum placements. Sites where students are working include: Project Youth and JHU, Senior Housing at Sunrise Assisted Living in Columbia, Turn Around – an agency dealing with human trafficking, International Social Services (this placement has been affected by the metro closure), House of Ruth, Mentoring Mentors (a program founded and run by alumnus Alphonso Mayo), and programs dealing with domestic violence and teen pregnancy. We are anticipating 9 students in practicum next fall.

```

##### Match 5 — 🔵 **conf 0.52** &nbsp;words 59 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Each student will complete two projects in addition to the service learning components. The first interview is a process**

_AI rationale:_ This section describes specific student activities (process recordings, taped interviews, role plays) that are part of the fieldwork learning experience structure. While the content touches on experiential activities, it best fits Standard 21.a (overall fieldwork process and structure description) as it outlines concrete project components students complete during field experience.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.a — Field Experience

Prompt: Provide a brief description of the overall process and structure of the fieldwork learning experience.

Response:
Each student will complete two projects in addition to the service learning components. The first interview is a process recording and taped interview completed outside of class (20%). The second interview is an in-class role play completed during one of the last class sessions (10%). Details on each of these interviews will be provided separately and reviewed in class.

```

##### Match 6 — 🔵 **conf 0.52** &nbsp;words 92 &nbsp; `review_low_confidence`

_Source heading from doc:_ **You will present both orally and in writing an issue which you have encountered during your practicum.  This issue can b**

_AI rationale:_ This section describes a practicum assignment requiring students to present and analyze a field experience issue, which relates to the overall structure and process of fieldwork learning. While reflection elements align with 20.e, the primary focus is on demonstrating how the field experience itself is structured to include reflective analysis components.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.a — Field Experience

Prompt: Provide a brief description of the overall process and structure of the fieldwork learning experience.

Response:
You will present both orally and in writing an issue which you have encountered during your practicum.  This issue can be related to the work, the people, the site, or yourself (Chapter 10 in your textbook may be helpful in selecting a topic), and should include a description of the issue as well as a possible resolution(s). You should cite at least two external sources and include a bibliography using APA style. Papers should be approximately 3-4 pages long. Be prepared to give a fifteen-minute oral presentation and analysis of your issue.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][a].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.62** &nbsp;words 34 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(table)**

_AI rationale:_ This section comprises a set of reflective prompts about field placement duties, required qualities, and experiential outcomes. These questions probe the overall structure and student experience of fieldwork, which aligns best with 21.a's requirement to describe the process and structure of the fieldwork learning experience. While the prompts touch on progression and challenge (21.h) and could inform placement guidelines (21.d), the meta-level framing of duties and placement qualities most directly supports the foundational description of how fieldwork is organized.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.a — Field Experience

What were your duties at the field placement?
What qualities are necessary for success in this placement?
What were the positive aspects of your field experience?
What were the challenges of your field experience?

```


**→ Imported as CURRICULUM MATRIX** (`CurriculumMatrix.rawContent` for `submissionId`):

- conf 0.88 &nbsp; words 387 &nbsp; heading: _(curriculum matrix table)_
  ```
  Field Experience
  Field Experience
  Context
  : Field experience such as a practicum or internship occurs in a human services setting. Fieldwork provides an environment and context to integrate the knowledge, theory, skills, and professional behaviors that are concurrently being taught in the classroom. It must be an integral part of the education process.
  Standard Number 21: The program shall provide…
  ```

---

### `21.b` 🟢 has narrative — Field Experience

**Spec prompt:** _Provide evidence that one academic credit is awarded for no less than three hours of field experience per week._

**→ Imported as NARRATIVE** (`narratives[21][b].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 141 &nbsp; `auto_accept`

_Source heading from doc:_ **b.**

_AI rationale:_ The section directly responds to the specification prompt asking for evidence that one academic credit is awarded for no less than three hours of field experience per week, providing concrete examples of credit-to-hours ratios across different field placements.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.b — Field Experience

Prompt: Provide evidence that one academic credit is awarded for no less than three hours of field experience per week.

Response:
Provide evidence that one academic credit is awarded for no less than three hours of field experience per week.Response:Students are granted academic credits for field placements.  The number of credits is contingent upon the number of field work hours. One credit hour is the equivalent of 3 hours of field work per week for 15 weeks (one semester). Thus, students who participate in the internship of 90 hours (six hours per week for 15 weeks) receive two credit hours (plus one credit for meeting in class one hour per week).  Students who participate in the practicum of 410 hours (27 hours per week for 15 weeks) receive 9 credit hours, and students who participate in the practicum of 540 hours (36 hours per week for 15 weeks) receive 12 credit hours [the 540 hour option is being eliminated for entering students].

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 72 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Graduate Survey Results: Feedback from graduating seniors last fall was reviewed. Students consistently point to their f**

_AI rationale:_ The section directly addresses field experience hour requirements and credit calculation, specifying 410 hours (9 credit hours) as the new standard. This aligns with 21.b's specification of credit-to-hour ratios, and addresses the minimum 350-hour requirement under 21.a.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.b — Field Experience

Prompt: Provide evidence that one academic credit is awarded for no less than three hours of field experience per week.

Response:
Graduate Survey Results: Feedback from graduating seniors last fall was reviewed. Students consistently point to their field experiences, and to faculty, as the most beneficial parts of the program. Partly in response to student concerns, the number of hours required for the practicum will be limited to 410 (9 credit hours). This is already the most common option for students, but the 12-credit hour (540 hour, 39 hour/week) option will be eliminated.

```

##### Match 3 — 🔵 **conf 0.68** &nbsp;words 72 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Graduate Survey Results: Feedback from graduating seniors last spring was reviewed. Students consistently point to their**

_AI rationale:_ The section describes a decision to standardize field experience at 410 clock hours (9 credit hours), which directly addresses the credit-to-clock-hour conversion ratio specified in 21.b. The mention of eliminating the 12-credit option also relates to total field experience hour requirements in 21.g.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.b — Field Experience

Prompt: Provide evidence that one academic credit is awarded for no less than three hours of field experience per week.

Response:
Graduate Survey Results: Feedback from graduating seniors last spring was reviewed. Students consistently point to their field experiences, and to faculty, as the most beneficial parts of the program. Partly in response to student concerns, the number of hours required for the practicum will be limited to 410 (9 credit hours). This is already the most common option for students, but the 12-credit hour (540 hour, 39 hour/week) option will be eliminated.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][b].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `21.c` 🟢 has narrative — Field Experience

**Spec prompt:** _Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program._

**→ Imported as NARRATIVE** (`narratives[21][c].content`):

##### Match 1 — 🟢 **conf 0.98** &nbsp;words 280 &nbsp; `auto_accept`

_Source heading from doc:_ **c.**

_AI rationale:_ The section directly addresses the specification language requiring demonstration that students are exposed to human services agencies and clients early in the program through assigned visitations, observations, and agency interviews beginning in CHS 217. The narrative explicitly shows early exposure mechanisms (agency visits, interviews, tours) that match the spec's core requirement.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.c — Field Experience

Prompt: Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program.

Response:
Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program.Response:Field experiences are an integral part of each student’s total educational process. Their format and duration vary according to the particular student’s status in the program. Students’ exposures to agencies begin early in the program, when, as a requirement for CHS 217 Professional Development in Counseling & Human Services, students visit two different human services agencies and interview a human service worker at each agency.  In addition to the information collected during the interview, students are encouraged to tour the agencies and collect written documents (e.g., brochures, pamphlets, printed forms) describing the facility which can be shared in class.  Students present oral and written reports about their agencies.    Some type of field experience is incorporated into most courses in the program. For example, students in CHS 220 Diversity and Cultural Competence interview and write about someone who is part of a family that relates to a topic the class is discussing, such as a person who is an immigrant or whose parent/parents have immigrated to the United States.  Each student in CHS 360 Counseling Strategies for Individuals conducts an interview with a “client” and submits an audio recording and a systematic analysis of the interview.Although not a requirement of the program, many human services students receive direct exposure to agencies through their participation in the Human Services Club.  As part of their involvement in the club, students are responsible for both organizing and participating in various activities such as the Stevenson University Fair, and the Johns Hopkins University Children’s House, which provides housing for the families of critically ill children.

```

##### Match 2 — 🔵 **conf 0.82** &nbsp;words 117 &nbsp; `review_low_confidence`

_Source heading from doc:_ **As part of the course, you will have the opportunity to apply concepts and skills taught in the 			classroom to real wor**

_AI rationale:_ The section describes students being exposed to human services agencies through volunteer service opportunities, agency visitation, and observation/assistance—directly matching Standard 21.c's requirement to demonstrate early exposure to agencies and clients. The structured progression from orientation through service completion also partially addresses 21.h's progression framework.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.c — Field Experience

Prompt: Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program.

Response:
As part of the course, you will have the opportunity to apply concepts and skills taught in the 			classroom to real world situations. Counseling strategies students will complete 15-20 hours of 			volunteer service at one of six partner human services agencies. During the second week of class, 		representatives from our partner agencies will provide an overview of the service opportunities. 			Selection of service experiences will take place in week three with orientation in week four, service 		beginning in week five and finishing no later than the week before finals. Students are evaluated on 		service provided and active ownership of and reflection on your learning. There are three 				requirements to complete this component: journals, time sheets, and contracts.

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 128 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Loretta announced that she can take students seeking field experience now that she has moved into a new location in Pike**

_AI rationale:_ The section documents the program's efforts to identify and develop field placement sites and agencies where students can gain exposure and experience—directly addressing the requirement to demonstrate that students are exposed to human services agencies. The discussion of multiple placement opportunities (Loretta's groups, Target program, Sheppard Pratt, Project Search) exemplifies agency and client exposure early and throughout the program.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.c — Field Experience

Prompt: Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program.

Response:
Loretta announced that she can take students seeking field experience now that she has moved into a new location in Pikesville. She is developing a number of groups, including men’s and women’s groups, LGBT, couples, families and first responders. Lauren said that the Target program is very happy with SU students who are working there, including Chris and Abbey. Sheppard Pratt has a total of 15 interns and almost half of them are from Stevenson. A trauma unit at SP is something that students from the Trauma and Crisis Intervention class may be interested in exploring. Arthur mentioned that Project Search, near Johns Hopkins, is a program that seeks to place individuals with disabilities. There may be internship opportunities there – Arthur will send contact information to Mayaugust.

```

##### Match 4 — 🔵 **conf 0.68** &nbsp;words 91 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Service Learning Experience:  As part of the course requirement, each student will participate in a service learning pro**

_AI rationale:_ The service learning project requires students to engage directly with human services agencies and clients through volunteer work at designated sites, aligning with Standard 21.c's requirement that students be exposed to human services agencies and clients early in the program. The reflective journaling and supervised timesheets support documentation of this experiential learning.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.c — Field Experience

Prompt: Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program.

Response:
Service Learning Experience:  As part of the course requirement, each student will participate in a service learning project during the semester.  This will include an outside volunteer project at one or more of the sites made available by the professors. Each student will complete 15-20 hours at one or more of the sites and keep a journal of reflective and analytical entries of the service learning experience.   Student will be required to turn in three journal entries, due throughout the semester.  Time sheets will be signed for each day of service.

```

##### Match 5 — 🔵 **conf 0.42** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Provides students with an opportunity to explore career directions within the counseling and human services field and to**

_AI rationale:_ The section describes exposure to human services agencies, professionals, and career pathways early in the program through observation and interaction, which aligns best with Standard 21.c's requirement to expose students to agencies and clients. The ethical reflection and professional development planning elements also align with Standard 19.h on self-development and ethical standards.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.c — Field Experience

Prompt: Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program.

Response:
Provides students with an opportunity to explore career directions within the counseling and human services field and to develop appropriate professional materials to advance their careers. Students will interview professionals in the field, research graduate programs and career tracks, reflect on their own strengths and interests, explore ethical issues in the field, and develop individualized professional development plans.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][c].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `21.d` 🟢 has narrative — Field Experience

**Spec prompt:** _Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies._

**→ Imported as NARRATIVE** (`narratives[21][d].content`):

##### Match 1 — 🟢 **conf 0.93** &nbsp;words 77 &nbsp; `auto_accept`

_Source heading from doc:_ **d.**

_AI rationale:_ The section directly addresses the requirement to provide a copy of the current manual and guidelines given to students regarding field placement requirements and policies, which is an exact match to Standard 21.d.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.d — Field Experience

Prompt: Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.

Response:
Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.Response:The Field Placement Handbook, which each student receives before participating in a field placement, includes all necessary information pertaining to the field placement and thus functions as a field work manual.  The Field Placement Handbook is revised on a yearly basis. Information about field placements, including prerequisites, can also be found in the CHS Student Handbook.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 77 &nbsp; `review_low_confidence`

_Source heading from doc:_ **All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, st**

_AI rationale:_ The section describes field placement approval policies and requirements that students must follow, which directly aligns with Standard 21.d's requirement to provide a copy of current manuals and guidelines advising students of field placement requirements and policies.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.d — Field Experience

Prompt: Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.

Response:
All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, students may not complete their internship or practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.

```

##### Match 3 — 🔵 **conf 0.72** &nbsp;words 69 &nbsp; `review_low_confidence`

_Source heading from doc:_ **At the beginning of the semester before starting a practicum, students meet with the Field Placement Coordinator to esta**

_AI rationale:_ The section describes the field placement process and student eligibility criteria established before practicum begins. This directly supports Standard 21.d, which requires documentation of field placement requirements and policies given to students. The mention of eligibility assessment and placement procedures aligns with programmatic guidelines and policies for field placement.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.d — Field Experience

Prompt: Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.

Response:
At the beginning of the semester before starting a practicum, students meet with the Field Placement Coordinator to establish eligibility, discuss placement interests, and develop a list of appropriate agencies for students to contact for an interview. Student eligibility is assessed by the department, according to the criteria below, at the end of each semester with final eligibility determined at the end of the semester before the practicum starts.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 77 &nbsp; `review_low_confidence`

_Source heading from doc:_ **All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, st**

_AI rationale:_ The section describes field placement requirements, policies, and approval procedures that align with Standard 21.d, which calls for a manual/guidelines advising students of field placement requirements and policies. The content addresses placement approval processes and conditions (paid placements, concurrent employment restrictions) that would typically appear in such guidelines.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.d — Field Experience

Prompt: Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.

Response:
All placements must be approved by the Field Placement Coordinator. If currently employed at a human services agency, students may not complete their internship or practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 54 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Internship students interview at ONE agency.  If that agency is not appropriate the student must request permission from**

_AI rationale:_ This section describes field placement requirements and policies governing where students conduct internships and practicum interviews, directly matching Standard 21.d which requires documentation of current manuals and guidelines given to students about field placement requirements and policies.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.d — Field Experience

Prompt: Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.

Response:
Internship students interview at ONE agency.  If that agency is not appropriate the student must request permission from the Field Placement Coordinator to interview at another agency. Practicum students interview with three agencies.  If those agencies are not appropriate the student must request permission from the Field Placement Coordinator to interview at another agency.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 54 &nbsp; `review_low_confidence`

_Source heading from doc:_ **In preparation for the field placement, please review the university’s catalog on our website:  www.stevenson.edu/academ**

_AI rationale:_ The section directs students to review the university catalog containing field placement policies, non-discrimination policies, and grievance procedures prior to field placement. This directly addresses Standard 21.d's requirement to provide current manuals and guidelines for field placement requirements and policies.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.d — Field Experience

Prompt: Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.

Response:
In preparation for the field placement, please review the university’s catalog on our website:  www.stevenson.edu/academics/catalog .  The catalog provides the university’s calendar as well as the university’s “Non-Discrimination and Sexual Harassment” policies and “Grievance Procedures”.  Please review these policies, as you are expected to be aware of them and, where applicable, comply with them.

```

##### Match 7 — 🔵 **conf 0.72** &nbsp;words 72 &nbsp; `review_low_confidence`

_Source heading from doc:_ **1.  Field Agency Participation (40%) Regular attendance and active participation at the field agency placement is mandat**

_AI rationale:_ This section describes field placement requirements, policies, and expected student conduct (attendance, professional behavior, confidentiality, notification procedures), which directly aligns with Standard 21.d's requirement to provide a copy of manuals and guidelines advising students of field placement requirements and policies.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.d — Field Experience

Prompt: Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies.

Response:
1.  Field Agency Participation (40%) Regular attendance and active participation at the field agency placement is mandatory.  The student must follow all policies and procedures of the field placement site.  Professional behavior is expected at all times, which includes punctuality, appropriate dress, and maintaining confidentiality.  If the student must be late or absent due to an emergency, it is imperative that the field placement site and the University supervisor are notified immediately.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][d].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.78** &nbsp;words 63 &nbsp; `review_low_confidence`

_Source heading from doc:_ **I have attached the Student Field Placement Handbook for your reference.  The Field Placement Responsibilities list will**

_AI rationale:_ The section announces provision of the Student Field Placement Handbook containing placement requirements, policies, and responsibilities—directly supporting Standard 21.d's requirement to provide current manuals and guidelines advising students of field placement requirements and policies.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.d — Field Experience

I have attached the Student Field Placement Handbook for your reference.  The Field Placement Responsibilities list will clarify the roles and functions of yourself, your student, and the college supervisor.  The Student Field Placement Evaluation Tool is also found in the handbook; this form should be completed by the field instructor and student at the midpoint and at the end of the experience.

```

##### Evidence 2 — 🔵 **conf 0.72** &nbsp;words 195 &nbsp; `review_low_confidence`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This practicum calendar and scheduling document functions as a manual/guidelines artifact advising students of field placement requirements, policies, and procedures (21.d). It also provides supporting evidence for site visit monitoring (21.j) and learning contract requirements (21.e).

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.d — Field Experience

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

##### Evidence 3 — 🔵 **conf 0.72** &nbsp;words 63 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Directions:  Please document the hours spent at your field placement using this sheet or the Agency’s time sheet if requ**

_AI rationale:_ This is a directive sheet instructing students on field placement documentation and requirements, matching Standard 21.d which requires provision of manuals and guidelines given to students advising them of field placement requirements and policies.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.d — Field Experience

Directions:  Please document the hours spent at your field placement using this sheet or the Agency’s time sheet if requested to do so by the agency. Your field instructor must sign the sheet every other week.  If you are not able to be at the placement during your set time (emergency, illness, etc.), you must notify your field instructor and your university supervisor.

```

##### Evidence 4 — 🔵 **conf 0.42** &nbsp;words 154 &nbsp; `review_low_confidence`

_Source heading from doc:_ **For your issue presentation, choose an issue or challenge that you have been facing at your site this semester. It doesn**

_AI rationale:_ This is a field placement assignment instruction that describes student requirements and expectations during their field experience placement. While the content describes a classroom assignment rather than direct program policy, it most closely aligns with Standard 21.d regarding field placement guidelines and requirements provided to students.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.d — Field Experience

For your issue presentation, choose an issue or challenge that you have been facing at your site this semester. It doesn't necessarily have to be a problem, but something that you have noticed or had to deal with. You can get some ideas from your textbook, particularly the sections in chapter 8 about "Encountering Challenges" starting on p. 224 and "Issues with the Site" on p. 237. You will be expected to write a 3-4 page paper that describes the issue and possible resolutions. Do some research about the issue and include information from this additional reading in your paper (be sure to use appropriate APA format to cite your sources). In class, you will give a 10-15 minute presentation to the group about the issue. It does not need to be a formal presentation with PowerPoint slides, just be prepared to describe the issue and how you have handled it to the class.

```

---

### `21.e` 🟢 has narrative — Field Experience

**Spec prompt:** _Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student._

**→ Imported as NARRATIVE** (`narratives[21][e].content`):

##### Match 1 — 🟢 **conf 0.94** &nbsp;words 143 &nbsp; `auto_accept`

_Source heading from doc:_ **e.**

_AI rationale:_ The section directly addresses the requirement for written learning agreements with field agencies that specify student role, activities, learning outcomes, supervision, and signatures from agency representatives, fieldwork supervisors, instructors, and students—matching Standard 21.e exactly.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
Provide documentation of written learning agreements with field agencies that specify the student’s role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency director, fieldwork supervisor, program instructor, and student.Response:A list of agencies where students complete field placements is in the Appendix. Most of the agencies do not require a formal contract, but sample agreements with Kennedy Krieger Institute and Sheppard Pratt, two of our larger field placement sites, are included. These agreements have not changed in the past five years. A more recent agreement with Baltimore County DSS is here. Upon the placement of a student with an agency, the Field Placement Coordinator sends a letter of agreement to the agency confirming the placement and summarizing expectations, along with a copy of the Field Placement Handbook, which discusses all aspects of the field placement.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 94 &nbsp; `review_low_confidence`

_Source heading from doc:_ **6.	Students with clinical responsibilities under this agreement will be covered by the School’s professional liability i**

_AI rationale:_ This section specifies requirements within a written learning agreement between the school and field agency (affiliate), including professional liability insurance coverage provisions. Standard 21.e requires documentation of written learning agreements that specify terms and conditions; professional liability insurance is a material term of such agreements.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
6.	Students with clinical responsibilities under this agreement will be covered by the School’s professional liability insurance in the minimum of $1 million per occurrence and $3 million aggregate OR the School will advise students that they are individually responsible for securing and maintaining professional liability insurance with limits satisfactory to Affiliate, but in no case less than $1 million per occurrence and $3 million aggregate and shall assure compliance with this provision.  Proof of professional liability insurance coverage for students in clinical training shall be provided to the Affiliate on an annual basis.

```

##### Match 3 — 🟡 **conf 0.72** &nbsp;words 92 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **F.	Student’s acceptance into clinical or research training with Affiliate is contingent upon proof by student of profess**

_AI rationale:_ This section documents requirements for field placement agreements with affiliate agencies, specifying professional liability insurance as a condition of student acceptance into clinical training. The content directly addresses Standard 21.e's requirement for written learning agreements with field agencies that specify conditions and requirements for the affiliation.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
F.	Student’s acceptance into clinical or research training with Affiliate is contingent upon proof by student of professional liability coverage at limits accepted by Affiliate and the School, but in no case less that $1 million per occurrence and $3 million aggregate.  Coverage must remain in force throughout the period students are participating in the program.  Proof of professional liability insurance coverage for students in clinical training shall be provided to the Affiliate on an annual basis.  The Certificate of Insurance (COI) is required before the start of the training affiliation agreement.

```

##### Match 4 — 🔵 **conf 0.72** &nbsp;words 182 &nbsp; `review_low_confidence`

_Source heading from doc:_ **3.  Learning Objectives (10%)  Students’ learning objectives should be submitted with their journal entries on the date **

_AI rationale:_ The section describes learning objectives submitted as part of a signed learning agreement between student, field instructor, and university supervisor—directly matching Standard 21.e's requirement for written learning agreements specifying learning outcomes and signed by all parties. The evaluation and documentation components relate secondarily to monitoring/supervision (21.j) but are subordinate to the core learning agreement requirement.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
3.  Learning Objectives (10%)  Students’ learning objectives should be submitted with their journal entries on the date noted in the syllabus.  Students should discuss their learning objectives with their field instructor before submission and obtain the field instructor’s signature. The signed learning contract must be submitted to the student’s University supervisor.  								4.  Student Field Placement Evaluation (20%)  At midpoint and at the completion of the field experience the student will complete a Student Field Placement Evaluation and share it with the field instructor.  In addition, the field instructor will complete an evaluation of the student.  Students will be evaluated in terms of personal qualities, role expectations within the agency setting, and professional qualities.  Once both parties sign both forms, the evaluation tools must be submitted to the University supervisor at midpoint and semester end.  				5.  Practicum Documentation (5%)  The following items must be submitted at the end of the semester along with the above evaluations:    Time Sheet Student, Field Placement Evaluation, University Supervisor Evaluation, Agency Evaluation, Graduate Information Sheet, Program Evaluation, Copy of a typed “thank you” letter to the field instructor

```

##### Match 5 — 🔵 **conf 0.62** &nbsp;words 84 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If a**

_AI rationale:_ The section establishes policies regarding student employment during practicum and field placement arrangements, which directly relates to the written learning agreements and conditions governing field experiences specified in 21.e. The narrative addresses role definition and agency approval mechanisms that should be documented in placement agreements.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If already employed at a human services agency, the student may not complete their practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.

```

##### Match 6 — 🔵 **conf 0.62** &nbsp;words 84 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If a**

_AI rationale:_ This section establishes policies regarding field placement agreements and arrangements (employment restrictions, separate placements, coordinator approval, paid placement conditions), which directly supports the written learning agreement specification 21.e that requires documentation of field placement terms and appropriate approvals.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
Faculty members in the department believe that the student should NOT attempt to be employed during the practicum.  If already employed at a human services agency, the student may not complete their practicum as part of their current position of employment, but may arrange for a separate and distinct field placement experience within the agency, if approved by the Field Placement Coordinator. A limited number of agencies may offer paid field placements. Such placements are acceptable with the approval of the Field Placement Coordinator.

```

##### Match 7 — 🔵 **conf 0.58** &nbsp;words 54 &nbsp; `review_low_confidence`

_Source heading from doc:_ **E.         Representation.  In implementing this Agreement, the SPONSOR shall be represented by the head of the SPONSOR'**

_AI rationale:_ The section specifies designated representatives from both the academic sponsor and field agency who remain available for consultation and decision-making in a field agreement context, most closely aligning with Standard 21.e's requirement for written learning agreements signed by appropriate agency representatives and other parties.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
E.         Representation.  In implementing this Agreement, the SPONSOR shall be represented by the head of the SPONSOR's internship program or designee.  The HEALTH SYSTEM shall be represented by the Manager of Volunteer Services.  These representatives shall remain available for consultation and communication to act upon any decisions required in the performance of this Agreement.

```

##### Match 8 — 🔵 **conf 0.52** &nbsp;words 136 &nbsp; `review_low_confidence`

_Source heading from doc:_ **1.  General Liability Insurance.  The SPONSOR and any students earning academic credit through the Education Program sha**

_AI rationale:_ This section addresses requirements for field experience placement agreements, specifically insurance and conditions precedent to student placement in a practicum/internship setting. Standard 21.e requires written learning agreements with field agencies that specify conditions of placement; insurance requirements are administrative preconditions documented in such agreements.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.e — Field Experience

Prompt: Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student.

Response:
1.  General Liability Insurance.  The SPONSOR and any students earning academic credit through the Education Program shall have general liability insurance coverage provided either by the SPONSOR or by the student and coverage shall be in the minimum amount of One Hundred Thousand Dollars ($100,000) for each incident and Five Hundred Thousand Dollars ($500,000) for annual aggregate coverage for each student.  SPONSOR agrees to furnish to the HEALTH SYSTEM a valid Certificate of Insurance of such general liability insurance for each proposed student as soon as practicable prior to and as a condition of his/her placement in the Education Program.  Where such liability insurance is procured directly by the student, the student must provide a valid Certificate of Insurance as soon as practicable prior to and as a condition of his/her placement in the Education Program.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][e].supportingEvidenceText`):

##### Evidence 1 — 🔵 **conf 0.72** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either part**

_AI rationale:_ This section documents a written agreement between the program (Anne Arundel Community College and Stevenson University) and a field agency specifying terms of service, including effective date, duration, amendment procedures, and signatures—core elements of Standard 21.e field experience learning agreements.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.e — Field Experience

This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either party up to sixty (60) days prior written notice. Anne Arundel Community College and Stevenson University will consider, in good faith, any amendments proposed by either party; however, the agreement may only be amended in writing, signed by both parties.

```

##### Evidence 2 — 🔵 **conf 0.72** &nbsp;words 73 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Field placement instructors are expected to provide the students with an opportunity to demonstrate the application of t**

_AI rationale:_ This excerpt from a field placement handbook addresses expectations for student learning and activities at placement sites, directly corresponding to 21.e's requirement for documentation of learning agreements that specify student role, activities, and anticipated learning outcomes.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.e — Field Experience

Field placement instructors are expected to provide the students with an opportunity to demonstrate the application of their course studies to the workplace.  By accepting our student for a Field Placement, you are agreeing to comply with the terms and conditions as set forth in the Field Placement Handbook. If you have any questions as to what types of activities may be appropriate for your student, please do not hesitate to contact me.

```

##### Evidence 3 — 🔵 **conf 0.68** &nbsp;words 53 &nbsp; `review_low_confidence`

_Source heading from doc:_ **This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either part**

_AI rationale:_ This section is a boilerplate clause from a written learning agreement between the program and field agency, documenting the effective date, duration, and amendment process. Standard 21.e explicitly requires 'written learning agreements with field agencies' signed by all parties; this text appears to be part of such an agreement document.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.e — Field Experience

This agreement becomes effective upon signature by all parties and shall continue in effect unless voided by either party upon sixty (60) days prior written notice.  FCC and SU will consider, in good faith, any amendments proposed by either party; however, the Agreement may only be amended in writing, signed by both parties.

```

##### Evidence 4 — 🔵 **conf 0.58** &nbsp;words 59 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Thank you for agreeing to participate in a human services field placement experience.  Our students look forward to the **

_AI rationale:_ This letter template confirms placement of a student in an internship or practicum, which is the opening artifact of a written learning agreement process required by 21.e. The document appears to be the transmittal or cover letter initiating the formal agreement between program, agency, and student.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.e — Field Experience

Thank you for agreeing to participate in a human services field placement experience.  Our students look forward to the opportunity to put into practice what they have learned in their major courses.  Your participation in this experience is invaluable.  This letter is to confirm the placement of ____________  (Internship) ___________ (Practicum), the student who has been assigned to you.

```

##### Evidence 5 — 🔵 **conf 0.42** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **K.         Assignment.  No assignment of this Agreement or the rights and obligations hereunder shall be valid without t**

_AI rationale:_ This is contractual language governing assignment and modification of a field experience agreement. While not a direct match to any specification, it most closely relates to Standard 21.e's requirement for written learning agreements with field agencies, as it addresses the legal terms governing such agreements.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.e — Field Experience

K.         Assignment.  No assignment of this Agreement or the rights and obligations hereunder shall be valid without the specific written consent of both Parties hereto, except that this Agreement may be assigned by the HEALTH SYSTEM as a result of reorganization, merger, or consolidation, or to any successor entity operating the facility now operated by the HEALTH SYSTEM.

```

##### Evidence 6 — 🔵 **conf 0.42** &nbsp;words 61 &nbsp; `review_low_confidence`

_Source heading from doc:_ **N.         Execution.  This Agreement and amendments thereto shall be executed in duplicate copies:  (1) on behalf of th**

_AI rationale:_ This section is a contractual/administrative clause about execution of an agreement between a sponsor and health system. While it mentions signed agreements, it is a boilerplate legal provision rather than substantive documentation of learning agreements with field agencies as required by 21.e. The content is procedural contract language, not educational specification compliance.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.e — Field Experience

N.         Execution.  This Agreement and amendments thereto shall be executed in duplicate copies:  (1) on behalf of the SPONSOR by an appropriate official of SPONSOR; and (2) on behalf of the HEALTH SYSTEM by the authorized representative of the HEALTH SYSTEM.  Each duplicate copy shall be deemed an original, but both duplicate originals shall together constitute one and the same instrument.

```

---

### `21.f` 🟢 has narrative — Field Experience

**Spec prompt:** _Provide syllabi for required seminars. Seminars must meet at least every two weeks. Seminar hours must not be included in field experience hours._

**→ Imported as NARRATIVE** (`narratives[21][f].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 53 &nbsp; `auto_accept`

_Source heading from doc:_ **f.**

_AI rationale:_ The section directly responds to the specification requesting syllabi for required seminars with minimum frequency requirements and clarification that seminar hours are separate from field experience hours. The response cites specific course syllabi (CHS 380, CHS 441) meeting the stated seminar frequency standards.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.f — Field Experience

Prompt: Provide syllabi for required seminars. Seminars must meet at least every two weeks. Seminar hours must not be included in field experience hours.

Response:
Provide syllabi for required seminars. Seminars must meet no less than every two weeks. Seminar hours must not be included in field experience hours.Response:See syllabi for CHS 380 Internship and CHS 441 Seminar. Students meet in class weekly in CHS 380 and at least every other week in CHS 441 Seminar (for Practicum).

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 50 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Course Description:  Provides an opportunity for students to discuss and learn more about issues related to the practicu**

_AI rationale:_ The course description directly addresses a practicum seminar's purpose, structure, and organization. Standard 21.f requires syllabi for required seminars with specified meeting frequency; this description is the kind of foundational seminar documentation that would support that specification.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.f — Field Experience

Prompt: Provide syllabi for required seminars. Seminars must meet at least every two weeks. Seminar hours must not be included in field experience hours.

Response:
Course Description:  Provides an opportunity for students to discuss and learn more about issues related to the practicum and to the field of human services.  Similar in organization to a professional development meeting, the seminar is designed to help facilitate the transition from undergraduate school to work and/or graduate school.

```

##### Match 3 — 🔵 **conf 0.52** &nbsp;words 61 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Satisfactory performance in CHS 380 (internship and accompanying seminar) is required for the practicum (CHS 440).  Unsa**

_AI rationale:_ The section describes prerequisites and performance requirements for field experience courses (CHS 380 internship/seminar and CHS 440 practicum), which relates most directly to seminar requirements and documentation; however, the content is primarily procedural policy rather than substantive specification compliance.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.f — Field Experience

Prompt: Provide syllabi for required seminars. Seminars must meet at least every two weeks. Seminar hours must not be included in field experience hours.

Response:
Satisfactory performance in CHS 380 (internship and accompanying seminar) is required for the practicum (CHS 440).  Unsatisfactory performance (a grade below C) in CHS 380 will result in ineligibility for CHS 440.  Students whose performance in CHS 380 is unsatisfactory are permitted to repeat the course.  A second grade below C in CHS 380 will result in dismissal from the major.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][f].supportingEvidenceText`):

##### Evidence 1 — 🟡 **conf 0.72** &nbsp;words 353 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **(data table)**

_AI rationale:_ This is a course syllabus/schedule for a field experience seminar showing weekly topics, assignments, and required readings. Standard 21.f explicitly requires provision of syllabi for required seminars, making this supporting evidence for that specification.

**Exact text that will be written to the supporting-evidence slot:**

```text
Supporting Evidence for Standard 21.f — Field Experience

Date
Topics*
Assignment
Week 1
January 29/31
Introductions, confidentiality, learning objectives, handbook, syllabus
Read Chapter 1: The Big Picture, pp 2-20 only
Read NOHS Ethical Standard 3, 8 and 9
Week 2
February 5/7
Getting the most out of your experience- designing your placement/writing your learning contract
Read Chapter 3: HQI Essentials, pp 53-64 only
Journal #1 due
before class
via Blackboard
Week 3
February 12/14
Being Informed, Staying Engaged and Becoming a Professional
- Building Expertise --NOHS Ethical Standard 31 & 36
Read Chapter 4: HQI, pp89-116
Learning objectives due
in class.  Hardcopy
. Signed.
Week 4
February 19/21
GS
Get to know your client community --NOHS Ethical Standard 1, 11, 15, & 26
Journal 2 due
in class. Hardcopy.
Week 5
February 26/28
Career Building
Professional portfolios
Internship Issue Paper 1 Due.
Blackboard before class
.
Week 6
March 5/6
GS
Career Building
-resume writing and interviewing
Journal 3 due
in class. Hardcopy.
Week 7
March 12/14
Where are the boundaries? Dual relationships and self-disclosure --NOHS Ethical Standards 5, 6, and 33
Midpoint evaluation due
in class. Hardcopy.
March 18 through 22
SPRING BREAK
NO CLASS
Week 8
March 26/28
GS
Self-Assessments
Read Chapter 5, Self Awareness, pp. 122-132
Journal 4 due
in class. Hardcopy.*
special journal prompt
Week 9
April 2/4
GS
Career Building
Graduate School Speakers Series
Week 10
April 9/11
Work-Life Balance- Cultivating life-long habits of self-care
Journal 5 due
in class. Hardcopy.
Week 11
April 16/18
GS
Career Building
Graduate School Speakers Series
Portfolio Due
in class. Hardcopy.
Week 12
April 23/25
Handling Conflict in the Workplace -- NOHS Ethical Standards 20 & 21
Internship Issue Paper 1 Due.
Blackboard before class
.
Week 13
April 30/ May 2
GS
How to Bring Closure
Journal 6 due
on Blackboard before Class.
Week 14
May 7/9
Final Group Discussion – What have we learned?
** Plan to attend the Senior Poster Presentation. May 6 5:30-6:30. Location tbd
Final evaluations, timesheets, thank you notes and agency evals
due in class.  Hardcopy.
*Topics are subject to change based on availability of guest speakers and needs of students in the class.

```

---

### `21.g` 🟢 has narrative — Field Experience

**Spec prompt:** _Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years._

**→ Imported as NARRATIVE** (`narratives[21][g].content`):

##### Match 1 — 🟢 **conf 0.96** &nbsp;words 124 &nbsp; `auto_accept`

_Source heading from doc:_ **g.**

_AI rationale:_ The section directly addresses Standard 21.g by providing evidence that the program requires at least 350 clock hours of field experience (the program documents 500–630 hours total) with at least 100 hours occurring in junior and senior years (90 hours junior, 410–540 hours senior).

**Exact text that will be written to the narrative slot:**

```text
Standard 21.g — Field Experience

Prompt: Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.

Response:
Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.Response:During the junior year of the Program, students spend 90 hours participating in a field experience in a human services setting as part of CHS 380 Internship.  During the senior year of the Program, students spend a full semester in a 9-credit (410 hours) or 12-credit (540 hours) field experience as part of CHS 440 Practicum in Counseling & Human Services. Thus, their total field experience hours will be at least 500 or 630 hours, all completed in their junior and senior years (See syllabi for these courses).

```

##### Match 2 — 🔵 **conf 0.78** &nbsp;words 81 &nbsp; `review_low_confidence`

_Source heading from doc:_ **During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a fiel**

_AI rationale:_ The section describes a required 90-hour field experience in the junior year within a human services setting, directly addressing the clock-hour requirement and timing specification in Standard 21.g. The concurrent seminar component also relates to 21.f requirements regarding seminar structure.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.g — Field Experience

Prompt: Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.

Response:
During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a field experience in a non-profit, human services setting (CHS 380).  This placement provides students with the opportunity to apply the knowledge and skills they have learned in the program.  Concurrently, they explore professional issues in a seminar that meets one hour each week.  The internship is an important precursor to the practicum, which is a much more extensive and intensive experience.

```

##### Match 3 — 🔵 **conf 0.78** &nbsp;words 81 &nbsp; `review_low_confidence`

_Source heading from doc:_ **During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a fiel**

_AI rationale:_ The section describes a 90-hour junior year field experience in a human services setting, which directly addresses Standard 21.g's requirement that field experience include hours occurring in the junior and senior years. The concurrent seminar component also relates to 21.f (seminar requirements).

**Exact text that will be written to the narrative slot:**

```text
Standard 21.g — Field Experience

Prompt: Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.

Response:
During their junior year, students spend 90 hours (two mornings a week or two afternoons a week) participating in a field experience in a non-profit, human services setting (CHS 380).  This placement provides students with the opportunity to apply the knowledge and skills they have learned in the program.  Concurrently, they explore professional issues in a seminar that meets one hour each week.  The internship is an important precursor to the practicum, which is a much more extensive and intensive experience.

```

##### Match 4 — 🔵 **conf 0.78** &nbsp;words 51 &nbsp; `review_low_confidence`

_Source heading from doc:_ **In order to successfully complete practicum placement (CHS 440), students registered for the 9 credit practicum must be **

_AI rationale:_ The section specifies required field experience clock hours (410 and 540 hours depending on credit enrollment), which directly addresses Standard 21.g's requirement to provide evidence that field experience meets minimum clock hour thresholds. The content establishes the specific hour requirements for the practicum placement course.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.g — Field Experience

Prompt: Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.

Response:
In order to successfully complete practicum placement (CHS 440), students registered for the 9 credit practicum must be complete 410 hours in placement and students registered for the 12 credit practicum must complete 540 hours. Students should follow the guidelines for absences during placement as outline in the field placement handbook.

```

##### Match 5 — 🔵 **conf 0.72** &nbsp;words 118 &nbsp; `review_low_confidence`

_Source heading from doc:_ **During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a professional hu**

_AI rationale:_ The section describes a 9-credit (410 hours) field experience requirement in the senior year, directly addressing Standard 21.g which requires demonstration of field experience clock hours totaling at least 350 hours with 100 occurring in junior and senior years. The accompanying seminar (CHS 441) and progression from observation to independent functioning also align with 21.h.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.g — Field Experience

Prompt: Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.

Response:
During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a professional human services setting (CHS 440).  Like the internship, the practicum experience allows students to apply the knowledge and skills learned throughout the program.  In the practicum, students function much like entry level staff members and are valued members of service teams. Concurrently, students enroll in CHS 441, a 3-credit course entitled Seminar in Human Services.  The seminar provides students an opportunity to discuss and reflect upon issues that may arise during the practicum.  Topics that are covered include the role of the student in a professional setting as well as issues that pertain to the field of human services.

```

##### Match 6 — 🔵 **conf 0.72** &nbsp;words 118 &nbsp; `review_low_confidence`

_Source heading from doc:_ **During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a non-profit, hum**

_AI rationale:_ The section describes a 410-hour senior-year field experience (CHS 440) that directly addresses the required minimum clock hours and timing specified in Standard 21.g. The concurrent seminar (CHS 441) provides reflective oversight consistent with field monitoring expectations.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.g — Field Experience

Prompt: Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.

Response:
During their senior year, students spend a full semester in a 9-credit (410 hours) field experience in a non-profit, human services setting (CHS 440).  Like the internship, the practicum experience allows students to apply the knowledge and skills learned throughout the program.  In the practicum, students function much like entry level staff members and are valued members of service teams. Concurrently, students enroll in CHS 441, a 3-credit course entitled Seminar in Human Services.  The seminar provides students an opportunity to discuss and reflect upon issues that may arise during the practicum.  Topics that are covered include the role of the student in a professional setting as well as issues that pertain to the field of human services.

```

##### Match 7 — 🔵 **conf 0.72** &nbsp;words 73 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Attendance at your field placement is critical to the successful completion of this course. You are required to complete**

_AI rationale:_ The section specifies a required 90 clock hours of field experience with allowances for excused absences, directly addressing Standard 21.g which requires evidence of field experience clock hours. While the narrative does not specify the full 350-hour requirement or junior/senior year distribution, it documents the minimum hours and attendance policy central to field experience documentation.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.g — Field Experience

Prompt: Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years.

Response:
Attendance at your field placement is critical to the successful completion of this course. You are required to complete 90 hours of field placement. Up to 10% (nine hours) may be forgiven due to unscheduled agency closures such as due to inclement weather or serious illnesses or other emergencies. Approval of missed time for serious illnesses or emergencies will be reviewed on a case-by-case basis and will only be approved with appropriate documentation.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][g].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `21.h` 🟢 has narrative — Field Experience

**Spec prompt:** _Demonstrate how the field experience provides the student with an opportunity to progress from: 1. Observation to 2. Directly supervised client contacts to 3. Indirectly supervised client contacts to 4. An independent caseload OR assignment of administrative responsibility._

**→ Imported as NARRATIVE** (`narratives[21][h].content`):

##### Match 1 — 🟢 **conf 0.92** &nbsp;words 714 &nbsp; `auto_accept`

_Source heading from doc:_ **h.**

_AI rationale:_ The section's first and primary part (h.) directly addresses the progression from observation through directly supervised, indirectly supervised, to independent caseload or administrative responsibility—the exact language of Standard 21.h. The subsequent paragraphs (i. and j.) are embedded responses to those specs but the dominant content and longest narrative body maps to 21.h.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.h — Field Experience

Prompt: Demonstrate how the field experience provides the student with an opportunity to progress from: 1. Observation to 2. Directly supervised client contacts to 3. Indirectly supervised client contacts to 4. An independent caseload OR assignment of administrative responsibility.

Response:
Demonstrate how the field experience provides the student an opportunity to progress from:Observation toDirectly supervised client contact toIndirectly supervised client contact toAn independent caseload OR assignment of administrative responsibility.Response:Both the Internship (CHS 380) and Practicum (CHS 440) experiences typically provide students the opportunity to begin with observation and progress first to directly supervised client contact and then to indirectly supervised client contact and finally to independent caseloads or assignment of administrative responsibility.  For example, one student’s practicum experience was with the Baltimore County Department of Social Services’ Adoption and Foster Care Unit.  The student began by observing other workers’ interactions with clients, reading case files, and talking with her co-workers.  Next, she was supervised as she interacted with clients.  During the last two months of her field placement, she had the opportunity to have her own cases; in particular, she worked very closely with two children in foster care/pre-adoptive placements.  A young female teen that she mentored responded very positively to her interventions, and an emotionally disturbed 10-year old boy delighted in working on his Lifebook with her. The student also supervised visitations between children and their birthparent(s).Every semester, the Field Placement Coordinator reviews evaluations of placement sites completed by students and summaries of their experiences in order to assess the nature of their assignments and duties while at the site. The Field Placement Coordinator also reviews reports submitted by University Supervisors based on their visits to sites. When new sites are acquired or current sites fail to provide either an assignment of an independent caseload or assignment of administrative responsibilities within the agency, the Field Placement Coordinator contacts the site to ensure appropriate assignment of caseload or administrative responsibilities. Field placement sites which are not able provide assignments of independent caseloads or assignments of administrative responsibilities within the agency are removed from the catalog.

i. Demonstrate that field supervisors have no less than the same degree the program awards. It is strongly recommended that field supervisors have no less than one level of degree above the level of degree awarded by the program.Response:All University Supervisors have no less than one degree above the level of certificate or degree of the students they are supervising. A master’s degree is the minimum acceptable degree to be a University Supervisor.

j. Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology.  The technology that is used should ensure that the field placement supervisor and student can be identified.Response:For each student’s internship (CHS 380), the Field Placement Coordinator maintains open lines of communication with field instructors and students.  This person communicates with each intern through his or her responses to the student’s periodic journal entries and through leading the weekly internship seminar.  Students in practicums (CHS 440) communicate on a weekly basis through journal entries to an assigned University Supervisor and corresponding University Supervisor replies. University supervisors attend some seminar meetings and may also communicate by telephone with students in addition to their visit(s) to the site. At least one site visit to meet with the student and field instructor is a requirement of University Supervisors.Journal entries are required because of the power inherent in them. The Field Placement Coordinator, University Supervisors and students have found journaling to be extremely helpful to students in analyzing and processing their experiences.  Their reflections allow students to make connections between classroom information and their field experiences, and also between what they’re doing in the field and actual learning.  In addition, students’ journal entries allow the Field Placement Coordinator and University Supervisor to assess the student’s ability to meet course and personal objectives, and to communicate with students about their field experiences. Field instructors are given the Field Placement Coordinator’s and University Supervisor’s telephone number at the beginning of the placement with instructions to telephone if needed.  University Supervisors visit the agency at the midpoint of the semester to confer with the student and the field instructor a minimum of one time during the placement. With input from the field instructor, the University supervisors evaluate the student’s overall performance and provide a final course grade of “Pass” or “Fail”.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 54 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Seniors listed a wide variety of duties at their placements.  They observed and assisted supervisors, and planned, imple**

_AI rationale:_ The section describes seniors progressing through observation and assistance to direct client contact and administrative responsibility (office work, intake, outreach, communication), which directly demonstrates the progression framework in Standard 21.h from observation through supervised to independent work.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.h — Field Experience

Prompt: Demonstrate how the field experience provides the student with an opportunity to progress from: 1. Observation to 2. Directly supervised client contacts to 3. Indirectly supervised client contacts to 4. An independent caseload OR assignment of administrative responsibility.

Response:
Seniors listed a wide variety of duties at their placements.  They observed and assisted supervisors, and planned, implemented, and assessed activities.  Many reported that they were responsible for general “office work” such as data entry and filing.  Other duties included intake and outreach and communication with clients, employees within the organization, and the public.

```

##### Match 3 — 🔵 **conf 0.68** &nbsp;words 65 &nbsp; `review_low_confidence`

_Source heading from doc:_ **Field experiences (internship and practicum) were highlighted in the responses to the first question (over 75% of studen**

_AI rationale:_ The narrative describes students' progression from observation and classroom learning to applied practice with agency supervision and guidance, which directly aligns with Standard 21.h's requirement to demonstrate progression from observation through supervised to independent work. The mention of support, guidance, and learning outcomes also supports this reading.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.h — Field Experience

Prompt: Demonstrate how the field experience provides the student with an opportunity to progress from: 1. Observation to 2. Directly supervised client contacts to 3. Indirectly supervised client contacts to 4. An independent caseload OR assignment of administrative responsibility.

Response:
Field experiences (internship and practicum) were highlighted in the responses to the first question (over 75% of students mentioned this).  Students appreciated the opportunity to apply their classroom learning. Several students mentioned the support and guidance they received and how much they learned about themselves. Some specific courses/experiences were mentioned by individual students, such as the addiction courses, administration of human services, and student presentations.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][h].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `21.i` 🔴 no match — Field Experience

**Spec prompt:** _Demonstrate that field supervisors have a degree at least as high as the one awarded by the program. It is strongly recommended that field supervisors hold at least one degree level above the degree in Human Services or a related field._

**→ Imported as NARRATIVE** (`narratives[21][i].content`):

_(no sections matched as narrative)_

**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][i].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

### `21.j` 🟢 has narrative — Field Experience

**Spec prompt:** _Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology. The technology used should ensure that both the field placement supervisor and the student can be identified._

**→ Imported as NARRATIVE** (`narratives[21][j].content`):

##### Match 1 — 🔵 **conf 0.72** &nbsp;words 58 &nbsp; `review_low_confidence`

_Source heading from doc:_ **A majority of students (87%) indicated that they would recommend their placement to another student. Four students (13%)**

_AI rationale:_ The section reports on site visits conducted by the chair and field placement coordinator to evaluate placement quality and student outcomes, directly addressing the monitoring and site visit requirement in Standard 21.j.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.j — Field Experience

Prompt: Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology. The technology used should ensure that both the field placement supervisor and the student can be identified.

Response:
A majority of students (87%) indicated that they would recommend their placement to another student. Four students (13%) would not recommend their placement to another student. The CHS chair and the field placement coordinator have examined specific issues and visited one site. For those sites that may not be beneficial to all students, placements will be made selectively.

```

##### Match 2 — 🔵 **conf 0.72** &nbsp;words 132 &nbsp; `review_low_confidence`

_Source heading from doc:_ **The final Student Field Placement Evaluations in CHS 440 Practicum in Human Services were used to assess student perform**

_AI rationale:_ The section describes monitoring student progress in field placements through weekly reports to University Supervisors and formal evaluations completed by field supervisors, which directly addresses Standard 21.j's requirement to continually monitor progress. While evaluation data is also mentioned, the focus is on the monitoring mechanism and site oversight rather than comprehensive program evaluation.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.j — Field Experience

Prompt: Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology. The technology used should ensure that both the field placement supervisor and the student can be identified.

Response:
The final Student Field Placement Evaluations in CHS 440 Practicum in Human Services were used to assess student performance on all 6 program outcomes, which were directly rated by the students’ field supervisors. The goals were broken down into specific behaviors that supervisors rated as ‘Below’ ‘Meets’ or ‘Exceeds’ Expectations. Supervisors could make optional comments on each item and gave overall comments at the end of each evaluation. As background, for this course students are working at area agencies for either 410 hours or 540 hours over the semester (about 29 hrs/week or 39 hrs/week). Students work with the Field Placement Coordinator, Dr. Finkenberg, to select theirs sites; they report weekly to University Supervisors who oversee their progress is placements; but it is their supervisors at the agencies who complete the evaluations.

```

##### Match 3 — 🟡 **conf 0.72** &nbsp;words 54 &nbsp; `review_letter_disagrees`

_Source heading from doc:_ **STANDARD 41 Human service educators monitor students' field experiences to ensure the quality of the placement site, sup**

_AI rationale:_ The narrative addresses monitoring of field experiences and site quality, which directly aligns with Standard 21.j's requirement that programs continually monitor student progress and perform site visits to placement sites. The mention of safeguarding students during harmful events supports the oversight and quality assurance focus of monitoring specifications.

**Exact text that will be written to the narrative slot:**

```text
Standard 21.j — Field Experience

Prompt: Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology. The technology used should ensure that both the field placement supervisor and the student can be identified.

Response:
STANDARD 41 Human service educators monitor students' field experiences to ensure the quality of the placement site, supervisory experience, and learning experience towards the goals of personal, professional, academic, career, and civic development. When students experience potentially harmful events during field placements, educators provide reasonable investigation and response as necessary to safeguard the student.

```


**→ Imported as SUPPORTING EVIDENCE** (`narratives[21][j].supportingEvidenceText`):

_(no sections matched as supporting evidence)_
---

## Unimported buckets

These sections did NOT land in any spec slot. The wizard would skip them entirely (context) or route them to user review (unknown).

### context — 177 sections

_Framing prose without a strong single-spec match. Examples:_

- (355 words, conf 0.85) (data table)
- (298 words, conf 0.82) During the first republic, after the establishment of South Korea, popular elections elected Syngman Rhee as the first p
- (268 words, conf 0.42) Contrary to traditional norms, according to research, the elderly is not properly taken care of in South Korea, and it i
- (258 words, conf 0.85) Human Services Delivery Systems Context: The demand for services and the funding of educational prog
- (246 words, conf 0.05) Despite South Korea being a relatively new nation, its economy has been able to grow exponentially. Since the 1950s, Sou

### unknown — 7 sections

_AI couldn't classify; user must triage. Often off-topic content:_

- (156 words) During the third republic, Park Chung Hee (Major general of the military in South Korea during the second republic) ran 
  rationale: _This section contains historical content about South Korean politics and governance (Park Chung Hee, the third republic, national elections, emergency declarations) with no connection to any CSHSE acc_
- (150 words) During the second republic, It was the first and only time that South Korea utilized a cabinet system  instead of a pres
  rationale: _This section contains historical narrative about South Korea's Second Republic (1960-1961) and has no connection to CSHSE accreditation standards, which address human services education program requir_
- (133 words) During the fourth republic, Park developed a new constitution which gave him control over parliament (History of South K
  rationale: _This section contains historical narrative about South Korean political events (Park's constitution, assassination, Gwangju uprising, 1987 elections) with no connection to human service education accr_
- (110 words) Two extra-credit assignments are provided in this syllabus: the video review and the group discussion papers.  Students 
  rationale: _This section describes extra-credit assignment options and grading policies for a course syllabus. It does not substantively address any current CSHSE standard specification; it is pedagogical course _
- (105 words) Weekly In-Class Quizzes (10% of your total grade)  In order to ensure that you are keeping up with the readings, underst
  rationale: _This section is a syllabus fragment describing quiz assessment methodology and grading procedures. It does not address any CSHSE accreditation standard or specification; it is course-level pedagogical_

---

## Related
- [[ai-import-stevenson-2026-05-17]] — same data, **by-section** view
- [[legacy-self-study-import]] — design + architecture
- [[sprint-plan-2026-05-16]] — Sprint 1 stories