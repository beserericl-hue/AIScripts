---
name: AI Import — Stevenson Per-Spec Coverage Review 2026-05-17
description: For each of the 99 Baccalaureate specs, Claude's verdict on whether the assigned narrative + supporting evidence adequately addresses the spec prompt.
type: review
tags: [ai-import, sprint-1, stevenson, coverage, audit]
audit_date: 2026-05-17
auditor: claude
last_reviewed: 2026-05-17
---

# AI Import — Stevenson Per-Spec Coverage Review (2026-05-17)

After mapping document sections to specs, Claude re-reads each spec's assigned narrative + supporting evidence and judges whether the spec is **adequately addressed**. Gaps go to the wizard's review queue so the coordinator can patch them before submission.

## Summary

- **7/99** specs Claude says ARE adequately covered (7%)
- **92/99** specs have gaps Claude flags for user review
- **Average coverage score:** 0.40 / 1.0

---

## Per-spec verdicts


## Standard 1

### `1.a` 🔴 — covered=False, score=0.15

**Spec prompt:** _The program is part of a degree granting college or university that is regionally accredited._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The self-study must explicitly name the parent institution and provide direct evidence of current regional accreditation status (e.g., accreditor name, accreditation letter, or official institutional documentation). The current narrative addresses program history only, not the institutional accreditation requirement of Specification 1.a.

**Strengths:**
- Narrative demonstrates program longevity within an institutional context (1999-present)
- References to institutional locations and building names suggest legitimate college/university setting
- Program's CSHSE accreditation history (2004, 2009) indirectly implies institutional existence, though not accreditation status

**Gaps (user must address):**
- ⚠️ No evidence provided that the institution is regionally accredited
- ⚠️ Narrative does not identify the parent institution by name
- ⚠️ No documentation of regional accreditation status (e.g., SACSCOC, MSCHE, WASC, etc.)
- ⚠️ No institutional accreditation certificate, letter, or official statement included
- ⚠️ Narrative focuses on program history rather than institutional accreditation requirement

---
### `1.b` 🟡 — covered=False, score=0.45

**Spec prompt:** _Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials)._

**Assigned content:** 4 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative demonstrates understanding of the requirement but fails the specification because no supporting evidence documents are actually provided. Immediately attach the Stevenson Catalog excerpt, departmental brochure, website screenshots, representative course syllabi (especially skills and field work courses), and program goals document to make this adequately evidenced.

**Strengths:**
- Narrative clearly articulates that developing competent human services professionals is the primary objective
- Goals explicitly mention 'apply key concepts, methods and values in human services' and 'productive and meaningful work in the human services field'
- Identifies three curriculum components (development/functioning, skills, field work) that logically support professional preparation
- Acknowledges diversity, interpersonal skills, and professional behavior as expected competencies
- Program title ('Counseling & Human Services') is appropriately named for the objective
- Recognizes connection between classroom and field experience

**Gaps (user must address):**
- ⚠️ No actual supporting documents attached (catalog excerpt, brochure, website screenshots, syllabi) — narrative references them but evidence is missing entirely
- ⚠️ Degree program title alignment not explicitly demonstrated — no evidence showing how 'Counseling & Human Services' title reflects human services professional development objective
- ⚠️ Program design/structure not evidenced — claims about curriculum composition (development/functioning courses, skills courses, field work) lack supporting documentation or course mapping
- ⚠️ Teaching methodology not addressed — no syllabi, course descriptions, or pedagogical documents provided to show how instruction develops competent professionals
- ⚠️ Program administration alignment not addressed — no governance documents, mission statements, or administrative policies provided
- ⚠️ Marketing materials not provided — brochure and website mentioned but not attached as evidence
- ⚠️ Goals and objectives not fully supported — 'Program Goals' referenced parenthetically but actual document not included
- ⚠️ No concrete course examples or descriptions linking specific courses to human services competency development

---
### `1.c` 🟡 — covered=False, score=0.45

**Spec prompt:** _Articulate how students are informed of the curricular and program expectations and requirements prior to admission._

**Assigned content:** 3 narrative + 2 supporting evidence section(s)

**Claude's summary:** The narrative describes mechanisms for informing prospective students but lacks documentation. Provide actual artifacts (recruitment website screenshots, admissions materials, recruiter reference guides, program brochures) showing what curricular/program expectations are explicitly communicated BEFORE admission. Clarify the timeline: when do prospective students receive information relative to application deadlines?

**Strengths:**
- Narrative clearly describes multiple channels through which prospective students CAN learn about the program (Open Houses, recruiters, website, faculty interviews, Human Services Club activities)
- Narrative addresses how admitted/enrolled students are informed (transfer student meetings, group orientation, FYS 100), which partially contextualizes program expectations
- Narrative identifies specific roles (Department Chair, faculty, recruiters, current students) responsible for communicating information
- Multiple touchpoints for information dissemination are described, showing intentional systemic approach

**Gaps (user must address):**
- ⚠️ Supporting evidence provided (Evidence 1 & 2) addresses attendance/classroom policies AFTER admission, not PRIOR to admission as specified
- ⚠️ No evidence of how prospective students receive curricular expectations before applying or being admitted
- ⚠️ Narrative mentions Open Houses, recruiter training, and website but provides no actual artifacts (screenshots, brochures, website URLs, recruiter talking points) demonstrating what information is actually conveyed
- ⚠️ No documentation that prospective students can access program requirements, course sequences, or learning outcomes before admission
- ⚠️ Narrative references 'student handbook' but does not provide the handbook or evidence of when/how it is distributed to prospective vs. admitted students
- ⚠️ No evidence showing program expectations are communicated in admissions materials, application documents, or recruitment literature

---
### `1.d` 🔴 — covered=False, score=0.00

**Spec prompt:** _Provide a brief history of the program._

**Assigned content:** 0 narrative + 1 supporting evidence section(s)

**Claude's summary:** This specification is not addressed. Provide a brief narrative describing the program's founding, evolution, and key milestones, supported by institutional documents such as program establishment records, historical catalogs, or accreditation files.

**Strengths:**
- No contradictory information provided that would conflict with a program history

**Gaps (user must address):**
- ⚠️ No narrative provided addressing the program's history
- ⚠️ No supporting evidence documents the program's founding date or establishment
- ⚠️ No evidence describes how the program evolved or developed over time
- ⚠️ No evidence explains the program's origins, context, or institutional trajectory
- ⚠️ Supporting evidence is entirely unrelated to program history (it addresses assignment submission policies only)

---
### `1.e` 🟡 — covered=False, score=0.65

**Spec prompt:** _Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year._

**Assigned content:** 3 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative provides excellent current-year (Fall 2023) demographic detail but lacks historical demographic data (gender, race/ethnicity, age distribution) across multiple years. Expand the evidence table to include demographic breakdowns by year, complete the 'xx' certificate enrollment figure, and add the missing 2022-23 graduation data to create a comprehensive multi-year trend analysis.

**Strengths:**
- Total enrollment numbers clearly documented across multiple years (Fall 2014-2019 and Fall 2023)
- Graduation data provided for six consecutive years (2013-14 through 2018-19) showing trend
- Gender composition explicitly stated for current cohort (87% female)
- Racial/ethnic diversity percentages clearly articulated for Fall 2023 (49% white, 45% black, 4% Hispanic, 2% Asian/other)
- Full-time student proportion clearly stated for Fall 2023 (96%)
- Minor enrollment tracked across multiple years
- Age data provided (average age 22) for current students
- Geographic distribution described (Baltimore, suburbs, rural areas, Mid-Atlantic region)

**Gaps (user must address):**
- ⚠️ Age data is mentioned only as 'average age of 22' for Fall 2023; no age distribution or range provided, and no historical age data across multiple years
- ⚠️ Gender breakdown provided only for Fall 2023 (87% female); no gender data for other years in the evidence table
- ⚠️ Race/ethnicity percentages given only for Fall 2023; no historical demographic trends across multiple years
- ⚠️ Part-time student numbers appear in the evidence table (75:2 for Fall 2019, etc.) but are not explicitly discussed in the narrative or contextualized
- ⚠️ No data provided for the 2022-2023 academic year graduation figure mentioned in narrative (stated as '20 in the 2022/2023' but not in the evidence table)
- ⚠️ Certificate student enrollment numbers referenced as 'xx' for Fall 2019 in evidence, creating incomplete data
- ⚠️ No breakdown of full-time vs. part-time status for years prior to Fall 2023

---
### `1.f` 🟡 — covered=False, score=0.65

**Spec prompt:** _Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices)._

**Assigned content:** 2 narrative + 4 supporting evidence section(s)

**Claude's summary:** The narrative adequately lists required courses and time to completion but lacks a comprehensive program structure document (semester-by-semester course sequencing, credit-hour breakdowns by category, and learning outcomes). Provide or reference a detailed curriculum map and course sequencing guide as appendices to fully satisfy this specification.

**Strengths:**
- Complete list of 11 required core CHS courses provided with accurate course numbers and titles
- Clear statement that program is 120 credits, typically 8 semesters (4 years)
- Secondary requirements clearly identified (SOC 101, PSY 101, PSY 108, two electives)
- General education requirements referenced to institutional section (A.3.b)
- Institutional context well-documented: founding, campus locations, organizational structure, and school placement
- Actual graduation rate data provided (57% in 4 years, 84% in 5 years) demonstrating feasibility of stated timeline
- Evidence of articulation agreements with community colleges (CCBC, AACC) showing pathway clarity for transfer students

**Gaps (user must address):**
- ⚠️ No clear articulation of total credit hours required for the degree (stated as 120 but breakdown by category not provided)
- ⚠️ Missing explicit breakdown of general education requirements by credit hours and distribution
- ⚠️ No detailed course sequencing or recommended semester-by-semester schedule provided in narrative
- ⚠️ Incomplete list of CHS elective courses (referenced as 'attached' but not fully enumerated in narrative)
- ⚠️ No information on prerequisite structures or course dependencies
- ⚠️ Missing program learning outcomes or competencies that frame the curriculum
- ⚠️ No explanation of how secondary requirements (SOC 101, PSY 101, PSY 108) relate to program goals
- ⚠️ No mention of clinical hours, field experience requirements, or internship/practicum specifics beyond course titles
- ⚠️ Data on graduation rates (57%, 84%, 895 for 6-year—likely typo) included but no analysis of time-to-completion patterns
- ⚠️ Supporting evidence includes articulation agreements but does not address native program requirements comprehensively

---

## Standard 2

### `2.a` 🟢 — covered=True, score=0.85

**Spec prompt:** _Include a mission statement for the program._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The response adequately addresses Specification 2.a with a stated mission and philosophical framework, but must include formal supporting evidence documents (official mission statements, program materials) and complete the truncated alignment section. Consider also making the mission statement more discipline-specific to strengthen the submission.

**Strengths:**
- Clear, explicit mission statement is provided: 'The mission of the Counseling & Human Services Program is to provide students with an educational foundation that will prepare them for meaningful and effective careers within the human services field and successful continuation of their education.'
- Philosophical base is articulated through the ASK model (Attitudes, Skills, Knowledge) with specific examples provided for each component
- Alignment with parent unit (HaSS School) is demonstrated with relevant supporting quotes about small classes, personal attention, and career preparation
- Attempt to show alignment with institutional mission (Stevenson University) is present, though incomplete

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (e.g., official program mission statement document, department website printouts, catalog excerpts, or governing documents that formally establish the mission)
- ⚠️ Mission statement appears somewhat generic and could be more specific to counseling/human services discipline or CSHSE values
- ⚠️ No explicit connection drawn between the ASK conceptual model and the stated mission statement—how does the model operationalize the mission?
- ⚠️ Alignment narrative is incomplete (text cuts off mid-sentence regarding Stevenson University's mission), suggesting missing or truncated documentation

---
### `2.b` 🔴 — covered=False, score=0.00

**Spec prompt:** _Demonstrate alignment with the mission of the units in which the program is housed (e.g., department, college, university, etc.)_

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** The self-study provides no narrative or supporting evidence for Specification 2.b. Submit a narrative describing the program's philosophical foundation and provide institutional mission documents (department, college, university) alongside an explicit analysis demonstrating alignment between program philosophy and each relevant unit's mission.

**Gaps (user must address):**
- ⚠️ No narrative explaining the program's philosophical base or educational approach
- ⚠️ No evidence of the department's mission statement
- ⚠️ No evidence of the college or university mission statement
- ⚠️ No demonstrated alignment between program philosophy and unit mission(s)
- ⚠️ No documentation of how program goals reflect or support parent unit objectives
- ⚠️ No evidence of intentional integration of unit values into program design
- ⚠️ No narrative describing the rationale for philosophical choices made in the program

---
### `2.c` 🟡 — covered=False, score=0.45

**Spec prompt:** _Provide a brief description of the major knowledge base and theories from which the curriculum draws to support the conceptual framework (e.g. counseling theories, biopsychosocial, systems theory, change theory, etc.)._

**Assigned content:** 2 narrative + 1 supporting evidence section(s)

**Claude's summary:** Strengthen response by explicitly mapping which theories (object relations, systems, cognitive-behavioral, etc.) directly support the stated biopsychosocial and eclectic framework, and demonstrate through curriculum mapping how courses teach these foundational theories and their application to helping relationships.

**Strengths:**
- Narrative explicitly identifies eight major family therapy approaches with theorist attribution, showing familiarity with counseling theory literature
- Program statement clearly articulates a biopsychosocial, eclectic orientation as the conceptual framework
- Supporting evidence demonstrates breadth of psychology content (neurobiology, development, conditioning, social relations, psychopathology) that could support multiple theoretical orientations
- Narrative acknowledges multidisciplinary knowledge base including psychology, sociology, psychopharmacology, and research methods
- Program description shows intentional flexibility to adapt to individual client needs

**Gaps (user must address):**
- ⚠️ No explicit connection between listed theories (object relations, experiential, transgenerational, structural, strategic, cognitive-behavioral, social constructionist, narrative) and how they support the program's stated conceptual framework
- ⚠️ Narrative lists family therapy approaches but does not explain which theories underpin the 'biopsychosocial approach' or 'eclectic orientation' claimed as the program's foundation
- ⚠️ Missing explanation of systems theory, change theory, or other foundational frameworks referenced in the specification's examples
- ⚠️ No articulation of how specific theoretical orientations (psychoanalysis, behavioral, cognitive-behavioral, client-centered) translate into curriculum design or student learning outcomes
- ⚠️ Supporting evidence (PSY 101 syllabus) demonstrates course content (brain, development, conditioning, emotions, disorders) but does not connect these topics to the stated theoretical base or conceptual framework
- ⚠️ No evidence linking general education courses (writing, literature, communication) or multidisciplinary approach to the philosophical base
- ⚠️ Narrative does not explain why these particular theories were selected or how they align with the program's mission

---
### `2.d` 🔴 — covered=False, score=0.00

**Spec prompt:** _Describe the multidisciplinary, interdisciplinary, or transdisciplinary approach to knowledge, theories, and skills included in the curriculum._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** The institution must provide both a narrative description and supporting evidence (e.g., curriculum maps, course syllabi, program documents) that explicitly articulate how the program integrates multidisciplinary, interdisciplinary, and/or transdisciplinary approaches to knowledge, theories, and skills throughout the baccalaureate curriculum.

**Gaps (user must address):**
- ⚠️ No narrative description of the multidisciplinary approach to knowledge included in the curriculum
- ⚠️ No narrative description of the interdisciplinary approach to knowledge included in the curriculum
- ⚠️ No narrative description of the transdisciplinary approach to knowledge included in the curriculum
- ⚠️ No explanation of how theories are integrated across disciplines
- ⚠️ No explanation of how skills are integrated across disciplines
- ⚠️ No supporting evidence documents, curriculum maps, or course descriptions provided
- ⚠️ No examples of cross-disciplinary courses or learning outcomes
- ⚠️ No evidence of how the program organizes or structures multidisciplinary content

---
### `2.e` 🔴 — covered=False, score=0.00

**Spec prompt:** _Provide a matrix mapping the curriculum Standards (11-20) and Specifications to required courses. The information provided on the matrix must clearly reflect congruence with the information provided in the Self-Study narrative and the syllabi._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** The institution must submit a comprehensive response including: (1) a narrative explaining the program's philosophical base and how it guides curriculum design; (2) a detailed matrix clearly mapping each Standard (11-20) and Specification to specific required courses; and (3) representative syllabi demonstrating alignment with mapped content.

**Gaps (user must address):**
- ⚠️ No narrative response provided explaining the philosophical base of programs
- ⚠️ No curriculum matrix mapping Standards 11-20 to required courses
- ⚠️ No curriculum matrix mapping Specifications to required courses
- ⚠️ No supporting evidence (syllabi, course descriptions, or mapping documents) submitted
- ⚠️ No demonstration of congruence between curriculum design and philosophical framework
- ⚠️ No evidence that Standards 11-20 coverage is intentional and mapped across the curriculum
- ⚠️ No documentation showing how Specifications are addressed through specific courses
- ⚠️ No syllabi provided to verify alignment between course content and mapped Standards/Specifications

---

## Standard 3

### `3.a` 🔴 — covered=False, score=0.00

**Spec prompt:** _If the program is less than five years old, provide documentation that supported the initial development of the human services program (such as a community needs assessment)._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** The program must submit a complete response including: (1) clarification of program age, and if less than five years old, (2) documentation such as a formal community needs assessment, feasibility study, stakeholder survey results, or institutional planning documents that demonstrate the community need that supported initial program development.

**Gaps (user must address):**
- ⚠️ No narrative response provided addressing whether the program is less than five years old
- ⚠️ No documentation of community needs assessment submitted
- ⚠️ No evidence of initial program development process or planning documents
- ⚠️ No community input, stakeholder feedback, or data supporting program inception
- ⚠️ No timeline or context explaining the program's establishment
- ⚠️ No supporting evidence of any kind attached to demonstrate compliance

---
### `3.b` 🟡 — covered=False, score=0.65

**Spec prompt:** _An Advisory Committee shall be established to provide feedback regarding local, state, and national trends and needs, policy changes, and to act as an advocate for the program. The committee should include individuals representing the human services field, such as field experience agencies, employing agencies, citizen advocacy groups, alums, current students, adjunct faculty, and other persons related to the field of human services. Provide the following: 1. A detailed description of the membership of the Advisory Committee (e.g. names, agencies, roles, relationship to program, etc.), 2. Minutes of advisory committee meetings from the last two years. 3. A narrative or table of how the committee interfaces with the program in relationship to specific issues._

**Assigned content:** 3 narrative + 2 supporting evidence section(s)

**Claude's summary:** Provide complete, current minutes from the most recent two academic years (clearly dated), ensure the full Advisory Committee roster is complete with all 14 members listed with full details, and create a structured table mapping specific program issues to advisory board recommendations and resulting actions to fully satisfy the specification.

**Strengths:**
- Clear identification of 14 external members plus 3 faculty members, representing diverse stakeholder groups (field placement agencies, employing agencies, graduate programs, community college, alumni, private practice)
- Evidence of regular meeting schedule (twice yearly in September and February) with documented attendance and substantive discussion
- Detailed narrative demonstrating how advisory board feedback directly influenced specific curriculum decisions (Crisis Intervention course, Psychopharmacology and Addictions course renaming, Group Counseling course name change, potential ABA/BCBA course development)
- Documentation of board members' current roles and affiliations (Kennedy Krieger, Sheppard Pratt, Maryland Dept of Human Services, Community College of Baltimore County, etc.) showing relevant field expertise
- Evidence of board engagement with state/national trends (TANF funding changes, BCBA certification need, ABA growth, elder care certificate program online delivery)

**Gaps (user must address):**
- ⚠️ Missing minutes from the last two years - evidence provided is labeled from 2017/2018 and 2018/2019, which are not current to the submission date and do not represent 'the last two years' from time of accreditation review
- ⚠️ Incomplete Advisory Committee roster - Evidence 1 appears truncated (cuts off at 'Erika' with no last name, title, or affiliation provided); full member listing with all 14 external members' complete information is not fully visible
- ⚠️ Missing explicit documentation of how board feedback directly resulted in program modifications - while narrative mentions modifications were made 'in response to student feedback and faculty retreat,' the specific advisory board input that led to each change is not clearly traced
- ⚠️ No evidence of student or adjunct faculty representation on the committee itself - roster shows Human Services Club President listed but it is unclear if current students serve as voting/formal members; adjunct faculty presence is mentioned in narrative but not clearly identified in roster
- ⚠️ Table or structured format for committee interface is absent - specification requests 'a narrative or table' showing how committee interfaces with program on specific issues; only narrative paragraphs are provided without organized mapping of issues to committee actions

---
### `3.c` 🔴 — covered=False, score=0.35

**Spec prompt:** _Describe other mechanisms, if any, used to respond to changing needs in the human services field._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide concrete evidence (survey instruments, interview protocols, summary of findings, meeting minutes showing how data informed changes) and explicitly describe the decision-making process that translates community assessment findings into program responses. Clarify what other mechanisms exist beyond field work to monitor and respond to evolving field needs.

**Strengths:**
- Narrative outlines a reasonable data collection methodology involving multiple field work approaches (interviews, surveys, targeted experiences)
- Identifies responsible parties (team members) and connects activities to a formal action plan
- Recognizes multiple stakeholder groups (service providers, community members, other stakeholders) as data sources

**Gaps (user must address):**
- ⚠️ No evidence provided to support the narrative claims about field work activities, data collection instruments, or actual data collected
- ⚠️ Does not describe what happens AFTER data is collected—no mechanism for how findings are analyzed, interpreted, or used to respond to changing field needs
- ⚠️ Does not explain how this assessment process leads to actual curricular or programmatic changes in response to identified needs
- ⚠️ No description of the timeline, frequency, or systematic process for ongoing monitoring of field changes
- ⚠️ Missing documentation of which stakeholders are involved and how their input shapes program decisions
- ⚠️ Does not address whether other mechanisms beyond this field work activity exist to respond to changing needs

---

## Standard 4

### `4.a` 🔴 — covered=False, score=0.00

**Spec prompt:** _The program has clear, measurable student learning outcomes that align with the standards and an assessment plan that has been implemented. Provide the following: 1. Measurable student learning outcomes 2. Assessment plan (include timelines) 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations, etc.). 4. A description of how the evaluation may or may not have resulted in any change_

**Assigned content:** 10 narrative + 5 supporting evidence section(s)

**Claude's summary:** Raw response (truncated): ```json
{
  "is_covered": false,
  "coverage_score": 0.55,
  "gaps": [
    "Assessment plan lacks explicit timeline: no specific dates or semester schedule provided for when SLOs are assessed (e.g., 'fall semester junior year,' 'end of senior practicum')",
    "Missing systematic assessment schedule

**Gaps (user must address):**
- ⚠️ LLM returned non-JSON response

---
### `4.b` 🔴 — covered=False, score=0.00

**Spec prompt:** _The program shall conduct a formal program evaluation at least every five years. The formal evaluation shall include student surveys, agency surveys, graduate follow-up surveys, active participation of the advisory committee, involvement of agencies where students are in field placements, course and faculty evaluations, and evaluative data mandated or conducted by the institution. Provide the following: 1. A history of program evaluations 2. A description of the methodology 3. A summative analysis of the most recent evaluation 4. A description of how and in what way the evaluation resulted in any change._

**Assigned content:** 9 narrative + 2 supporting evidence section(s)

**Claude's summary:** Raw response (truncated): ```json
{
  "is_covered": false,
  "coverage_score": 0.55,
  "gaps": [
    "No formal history of program evaluations provided—narrative mentions 'annually since 2005' but provides no documented schedule, dates, or summary of past evaluations",
    "Agency surveys are not adequately documented—only s

**Gaps (user must address):**
- ⚠️ LLM returned non-JSON response

---
### `4.c` 🔴 — covered=False, score=0.35

**Spec prompt:** _The program must provide reliable information on its performance, including student achievement, to the public for the last two years. [NOTE: This Specification relates to accreditation standards or policies that require institutions or programs to provide timely, readily accessible, accurate, and consistent aggregate information to the public about institutional or programmatic performance and student achievement, as the institution or program determines such information. (Paragraph 12 (B)(1), 2019 CHEA Recognition Policy and Procedures)] Provide the following: 1. An active link to student achievement indicators on the Program’s website. 2. Aggregate data as evidence of student achievement. Include as many of the following as available: enrollment trends, retention, student learning outcomes, graduation rates, grade point average, student satisfaction, agency feedback, graduate transfer rates, graduate school or employment data, and alum surveys._

**Assigned content:** 4 narrative + 8 supporting evidence section(s)

**Claude's summary:** This submission does not adequately meet Specification 4.c. The program must provide: (1) a working, direct URL to publicly accessible student achievement data; (2) actual aggregate performance data covering the last two complete calendar/academic years (not just current snapshots) for enrollment trends, retention, graduation rates, GPA, and satisfaction; and (3) recent alumni survey and employment data (not 2015 surveys). Recreate the evidence package with current two-year datasets and ensure the website link is functional.

**Strengths:**
- Program acknowledges the requirement and identifies a responsible party (Department Chair) for assessment and dissemination
- Enrollment statistics are discussed with acknowledgment of downward trend and proposed action items (recruitment, marketing, high school outreach)
- Alumni employment data collected shows 75–83% full-time employment and job relevance, indicating some graduate outcome tracking
- Program website is identified as the public-facing location for student outcomes, meeting accessibility intent

**Gaps (user must address):**
- ⚠️ No active, functional link to student achievement indicators provided—narrative states 'here' but no actual URL or hyperlink is given
- ⚠️ No enrollment trend data for the last TWO YEARS—only current semester snapshots (83 majors, 87 majors, etc.) without historical comparison or charts despite narrative referencing 'attached chart'
- ⚠️ No retention data provided—completely absent from narrative and evidence
- ⚠️ No graduation rates provided—completely absent from narrative and evidence
- ⚠️ No grade point average (GPA) data provided—only grading scale tables (Evidence 3–8) with no actual student GPA performance metrics
- ⚠️ No student satisfaction data provided—completely absent from narrative and evidence
- ⚠️ No agency feedback provided—completely absent from narrative and evidence
- ⚠️ Graduate transfer rates not provided—completely absent from narrative and evidence
- ⚠️ Alumni survey data incomplete—two survey tables (Evidence 1–2) appear to be from 2015 only; no data from second year required (last TWO years); surveys are fragmented and cut off mid-question
- ⚠️ No employment outcome data summary—only raw 2015 survey tables with no aggregate analysis or trend comparison across two years
- ⚠️ Data currency issue—all alumni survey evidence is from 2015; no current or recent data (2023–2024) to meet 'last two years' requirement

---

## Standard 5

### `5.a` 🔴 — covered=False, score=0.35

**Spec prompt:** _Provide documentation of policies regarding the selection and admission of students._

**Assigned content:** 5 narrative + 1 supporting evidence section(s)

**Claude's summary:** The self-study does not adequately address Specification 5.a. Attach the actual University admission policy document and clearly articulate any program-specific admission selection criteria, qualifications, or procedures. The supporting evidence provided relates to cancellation/withdrawal, not admission—add documentation that explicitly shows how students are selected and admitted into the program.

**Strengths:**
- Narrative clearly states that University admission policies apply and directs reviewer to the catalog
- Program flexibility regarding entry point (first year or later) is transparently communicated
- Clear statement that all program requirements must be completed before graduation
- Health insurance and physical examination requirements are documented as conditions for participation
- Attendance expectations are clearly outlined

**Gaps (user must address):**
- ⚠️ No explicit documentation of admission criteria or selection standards (e.g., GPA requirements, prerequisite courses, test scores, or qualifications needed to enter the program)
- ⚠️ Narrative defers entirely to 'University's admission policies' without providing or attaching the actual university admission policy documentation
- ⚠️ No clear program-specific admission requirements or processes are defined, despite the narrative claiming 'no additional requirements'—this should be explicitly documented
- ⚠️ Missing documentation of how students are selected or evaluated for admission (application materials, interviews, evaluations, etc.)
- ⚠️ Supporting evidence provided (E. Notice of Student Cancellation) addresses cancellation/withdrawal, not admission or selection
- ⚠️ Health, insurance, and employment-related content in narrative are retention/participation conditions, not admission selection criteria
- ⚠️ No evidence of actual admission policy document or criteria rubric attached

---
### `5.b` 🟡 — covered=False, score=0.55

**Spec prompt:** _Provide documentation of policies and procedures for referring students for personal and academic assistance. These policies must be consistent with the institution’s policies._

**Assigned content:** 20 narrative + 4 supporting evidence section(s)

**Claude's summary:** The program must develop and provide a formal, written referral policy document that outlines specific procedures (referral triggers, process steps, responsible parties, documentation requirements, and follow-up protocols) rather than relying solely on informal practice descriptions. A referral form or tracking system should also be introduced to meet the specification's explicit requirement for 'documentation of policies and procedures.'

**Strengths:**
- Narrative clearly identifies multiple referral pathways (faculty advisors, Office of Student Success via direct contact or Early Alert, Wellness Center, Disability Services, Director of Multicultural Affairs)
- Good description of how faculty identify and discuss concerns (regular departmental meetings, advisor system)
- Supports institutional alignment by naming specific university offices and their roles (Office of Student Success, Wellness Center, Office of Disability Services)
- Evidence 1 and 2 provide concrete contact information and links to university disability and wellness resources
- Evidence 4 demonstrates faculty monitoring of attendance as a referral trigger

**Gaps (user must address):**
- ⚠️ No formal, documented referral procedures or referral form/process is explicitly provided—narrative states 'no referral form is used,' which undermines the specification's requirement for 'documentation of policies and procedures'
- ⚠️ Missing written policy document that outlines the step-by-step referral process (who refers, to whom, when, how, follow-up procedures)
- ⚠️ No evidence of a program-specific referral policy or procedure that is distinct from general university resources; specification requires policies 'consistent with the institution's policies,' implying program-level documentation is needed
- ⚠️ Incomplete supporting evidence: Evidence 3 and 4 are individual faculty syllabi statements, not institutional policies; they do not constitute formal referral procedures
- ⚠️ No documentation of criteria for when/how a student should be referred (academic vs. personal triggers, urgency levels, mandatory vs. discretionary referrals)
- ⚠️ Missing documentation of the Early Alert system mentioned in narrative—what triggers it, how it works, outcomes tracking
- ⚠️ No evidence showing how the program documents and tracks referrals, follow-ups, or outcomes

---
### `5.c` 🔴 — covered=False, score=0.25

**Spec prompt:** _Provide documentation of written policies and procedures describing the due process for probation, remediation, dismissal, appeal, and grievance procedures affecting students._

**Assigned content:** 2 narrative + 2 supporting evidence section(s)

**Claude's summary:** The self-study must provide actual copies of the university's written policies and procedures for probation, remediation, dismissal, appeal, and grievance—not just reference their existence. Additionally, clarify any program-specific procedures that supplement university policy, and ensure all five required due process elements (probation, remediation, dismissal, appeal, grievance) are explicitly documented and addressed.

**Strengths:**
- Narrative correctly identifies that university policies govern due process procedures
- Narrative acknowledges existence of Student Policies document in Stevenson University Policy Manual Vol. V
- Narrative confirms policies are accessible to students via SU portal
- Narrative indicates materials are provided for review (thumb drive reference)

**Gaps (user must address):**
- ⚠️ No documentation of written probation procedures or criteria for academic/professional standing probation
- ⚠️ No documentation of remediation procedures or support structures for at-risk students
- ⚠️ No documentation of formal dismissal procedures or due process steps required before dismissal
- ⚠️ No documentation of appeal procedures for adverse decisions (probation, remediation failure, dismissal)
- ⚠️ No documentation of grievance procedures or mechanisms for student complaints
- ⚠️ No evidence of program-specific policies; only generic university reference provided without actual attachment or detail
- ⚠️ Supporting evidence addresses grading and late work policy, not due process for probation, remediation, dismissal, appeal, or grievance
- ⚠️ No evidence of how students are notified of probation status or opportunity to remediate before dismissal
- ⚠️ No evidence of formal appeal timelines, procedures, or appeal bodies/committees

---
### `5.d` 🔴 — covered=False, score=0.00

**Spec prompt:** _Provide documentation of program policies and procedures for assessing and managing student attributes, characteristics, and behaviors (“fitness for the profession”) that are important for the success of human service professionals._

**Assigned content:** 13 narrative + 4 supporting evidence section(s)

**Claude's summary:** Raw response (truncated): ```json
{
  "is_covered": false,
  "coverage_score": 0.55,
  "gaps": [
    "No evidence provided of the actual 'Behavioral Indicators' document referenced repeatedly in narrative—only mentioned as being in the Handbook and reviewed in courses, but the specific list is not attached or detailed",
    

**Gaps (user must address):**
- ⚠️ LLM returned non-JSON response

---

## Standard 6

### `6.a` 🟡 — covered=False, score=0.45

**Spec prompt:** _Include curriculum vitae of full-time and part-time faculty who teach human services courses. The vitae must demonstrate that: 1. Faculty have education in various disciplines and experience in human services or related fields 2. Teaching faculty have no less than one degree above the level of certificate or degree in which they teach. It is recommended that faculty have no less than a master’s degree._

**Assigned content:** 1 narrative + 2 supporting evidence section(s)

**Claude's summary:** Provide complete CVs for all full-time and part-time faculty teaching human services courses in an appendix, ensuring each CV clearly documents degree credentials and human services or related field experience. Remove or replace the unrelated contract document (Evidence 2). Create a summary table mapping each faculty member to their degrees and professional experience areas.

**Strengths:**
- Narrative clearly states all instructors hold at least a master's degree, exceeding the minimum requirement of one degree above the teaching level
- Narrative documents doctoral-level credentials (3 Ph.D.s, 2 J.D.s, 2 Ed.D.s) demonstrating advanced preparation
- Narrative specifies diverse disciplinary backgrounds (counseling, human services, law, psychology, education, social work, etc.), addressing the 'various disciplines' requirement
- Narrative describes varied professional experience in relevant fields (human services administration, disability services, addictions treatment, therapy practice)
- Evidence 1 demonstrates one faculty member's relevant master's degree (MSW) and doctoral preparation (Ed.D.) in special education with practical experience as school social worker

**Gaps (user must address):**
- ⚠️ No actual curriculum vitae documents are provided in the response—the narrative states 'curriculum vitae for full-time and part-time instructors are included in the Appendix' but no appendix materials are attached or visible in the supporting evidence
- ⚠️ Only one faculty member's CV excerpt is provided (Evidence 1); the specification requires vitae for ALL full-time and part-time faculty who teach human services courses—the breadth of coverage is unclear
- ⚠️ Evidence 2 is a contract termination clause unrelated to faculty credentials and does not support the specification
- ⚠️ No evidence demonstrates the specific educational disciplines represented across the faculty cohort (narrative lists areas but does not map which faculty hold which degrees)
- ⚠️ No evidence demonstrates clinical/practical experience in human services delivery for each individual faculty member—only aggregate claims are made
- ⚠️ Part-time faculty credentials are not clearly differentiated or documented; the narrative mentions 'regular part-time faculty' but provides no CV evidence for part-time instructors

---

## Standard 7

### `7.a` 🔴 — covered=False, score=0.00

**Spec prompt:** _Document that faculty have the ultimate responsibility for setting policies and determining the content, implementation, and evaluation of the curriculum._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** Submit both a narrative statement explaining your faculty governance structure and concrete supporting evidence such as faculty handbook excerpts, curriculum committee charter, meeting minutes, or policy documents that demonstrate faculty's ultimate responsibility for curriculum policies, content, implementation, and evaluation.

**Gaps (user must address):**
- ⚠️ No narrative provided documenting faculty responsibility for setting curriculum policies
- ⚠️ No evidence of faculty involvement in determining curriculum content
- ⚠️ No documentation of faculty role in curriculum implementation decisions
- ⚠️ No evidence of faculty participation in curriculum evaluation processes
- ⚠️ No supporting documents (e.g., faculty governance policies, curriculum committee minutes, job descriptions) submitted
- ⚠️ No demonstration of faculty ultimate authority versus administrative or other stakeholder roles
- ⚠️ No explanation of governance structures that ensure faculty control over curriculum decisions

---
### `7.b` 🔴 — covered=False, score=0.00

**Spec prompt:** _Essential program roles include administration, curriculum development and review, instruction, field supervision, program planning, program evaluation, student advising, and student evaluation. Provide the following: 1. A brief description of how these essential roles are fulfilled in the program 2. A table matching faculty and staff positions and names with these roles._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** A complete response is required. Submit a brief narrative describing how the eight essential roles are fulfilled in the program, along with a comprehensive table that lists faculty and staff names with their assigned positions and corresponding essential roles.

**Gaps (user must address):**
- ⚠️ No narrative description provided explaining how essential roles are fulfilled
- ⚠️ No table provided matching faculty/staff positions and names to roles
- ⚠️ Administration role fulfillment not described
- ⚠️ Curriculum development and review role not addressed
- ⚠️ Instruction role not addressed
- ⚠️ Field supervision role not addressed
- ⚠️ Program planning role not addressed
- ⚠️ Program evaluation role not addressed
- ⚠️ Student advising role not addressed
- ⚠️ Student evaluation role not addressed
- ⚠️ No supporting evidence documents submitted
- ⚠️ No organizational chart or role assignment documentation provided

---
### `7.c` 🔴 — covered=False, score=0.35

**Spec prompt:** _Describe the process for faculty and staff evaluation. Documentation may come from a variety of sources and may include, among others, student evaluations, administrative review, comments from field placement agencies, and peer review._

**Assigned content:** 0 narrative + 2 supporting evidence section(s)

**Claude's summary:** The self-study lacks a critical narrative section describing the comprehensive evaluation process—who evaluates faculty/staff, using what methods, with what documentation sources, and how results are utilized. Provide an overview narrative explaining the complete system before presenting supporting evidence of individual components.

**Strengths:**
- Evidence 1 provides a student evaluation instrument with multiple dimensions relevant to faculty supervision quality (feedback, responsiveness, fairness, accessibility)
- Evidence 2 demonstrates a documented conference procedure with faculty notification and right-to-respond mechanism
- Evidence 2 shows acknowledgment that signatures do not imply agreement, protecting faculty due process

**Gaps (user must address):**
- ⚠️ No narrative explanation of the evaluation process itself—what steps are involved, who evaluates whom, timelines, or frequency
- ⚠️ No description of how multiple evaluation sources (student evaluations, administrative review, field placement agency feedback, peer review) are actually collected or integrated
- ⚠️ No explanation of evaluation criteria, standards, or performance expectations
- ⚠️ No documentation of administrative review processes or procedures
- ⚠️ No evidence of peer review mechanisms or processes
- ⚠️ No evidence of field placement agency feedback collection methods
- ⚠️ No explanation of how evaluation results are used for professional development or improvement
- ⚠️ No documentation of faculty/staff appeal or response procedures beyond the brief signature statement
- ⚠️ No clarity on whether the student evaluation instrument (Evidence 1) is used for faculty evaluation or only for supervisor feedback assessment

---
### `7.d` 🔴 — covered=False, score=0.25

**Spec prompt:** _Document how the evaluative process is used to identify strengths and limitations and how it is incorporated in specific procedures for improvement._

**Assigned content:** 0 narrative + 1 supporting evidence section(s)

**Claude's summary:** A narrative must be added explaining: (1) how the program uses these rating data to identify specific strengths and limitations; (2) the concrete improvement procedures or professional development plans that result from low ratings (e.g., 1.2, 1.3); and (3) how feedback is communicated and monitored for change.

**Strengths:**
- Data table provides quantifiable performance ratings across three relevant competency areas
- Average ratings (1.2–1.45 on 0–2 scale) suggest moderate performance levels that could serve as baseline for improvement discussion
- Criteria are clearly aligned with human services professional competencies

**Gaps (user must address):**
- ⚠️ No narrative explanation provided; specification requires documented description of evaluative process
- ⚠️ Evidence shows raw performance ratings only; no explanation of how strengths/limitations are identified from these scores
- ⚠️ No documentation of how evaluation results are incorporated into specific improvement procedures or action plans
- ⚠️ Missing evidence of follow-up mechanisms or timelines for addressing identified limitations
- ⚠️ No description of the evaluative instrument, methodology, or process itself
- ⚠️ Lacks evidence of how identified strengths are leveraged or reinforced
- ⚠️ No documentation of feedback loops or communication to personnel about evaluation findings

---
### `7.e` 🔴 — covered=False, score=0.00

**Spec prompt:** _Describe how faculty and staff are provided opportunities for relevant professional development._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** The self-study submission is completely empty for this specification. The coordinator must provide both a narrative describing the institution's professional development opportunities for faculty and staff, and supporting evidence such as policies, budgets, training records, or participation documentation.

**Gaps (user must address):**
- ⚠️ No narrative description of professional development opportunities provided
- ⚠️ No evidence of systematic professional development policies or programs
- ⚠️ No documentation of types of professional development offered (conferences, workshops, training, etc.)
- ⚠️ No evidence of how opportunities are communicated or made available to faculty and staff
- ⚠️ No data on participation rates or attendance in professional development activities
- ⚠️ No evidence of funding or resource allocation for professional development
- ⚠️ No documentation of alignment between professional development and institutional/program goals
- ⚠️ No evidence of evaluation or assessment of professional development effectiveness
- ⚠️ No information about mentorship, coaching, or peer learning opportunities
- ⚠️ No details on support for credential advancement, certification, or continuing education

---

## Standard 8

### `8.a` 🟡 — covered=False, score=0.55

**Spec prompt:** _Demonstrate how the program 1. Includes intercultural fluency, and accessibility principles in program policies, procedures, and practices. 2. Includes intercultural fluency, and accessibility principles training for faculty and staff_

**Assigned content:** 12 narrative + 0 supporting evidence section(s)

**Claude's summary:** This response addresses cultural competence but significantly undershoots the specification by: (1) omitting accessibility principles entirely; (2) providing no supporting evidence documents; and (3) acknowledging that faculty training remains voluntary rather than systematic. Revise to explicitly incorporate accessibility (physical, digital, instructional), provide syllabi/policies/training logs as evidence, and establish or document mandatory professional development requirements.

**Strengths:**
- Cultural competence integrated as a program outcome (#4 of six) and reinforced through required course (CHS 220)
- Professional expectations including culturally sensitive behavior are documented in student handbook and required for field experiences
- Dedicated faculty leadership (Lauri Weiner) actively champions cultural competence through teaching, task force participation, and facilitation of diversity conversations
- Monthly departmental faculty meetings include ongoing diversity discussions to keep faculty engaged
- University commitment statement clearly articulates comprehensive diversity values across multiple dimensions (ethnicity, gender, sexual orientation, ability, learning styles, etc.)
- Multiple institutional training opportunities exist (Inclusivity in the Classroom, Language Variation, Peer Mentoring programs)

**Gaps (user must address):**
- ⚠️ No evidence documents provided to support claims (e.g., curriculum syllabi, policy documents, training records, student handbook excerpts)
- ⚠️ Accessibility principles not explicitly addressed—narrative focuses exclusively on cultural competence/diversity, omitting physical accessibility, digital accessibility, or universal design for learning
- ⚠️ Faculty/staff training requirement is only voluntary; narrative acknowledges no systematic mandate exists ('participation in training opportunities is voluntary'), which does not meet the specification's expectation of structured training
- ⚠️ No specific data, metrics, or documentation of how many faculty have actually completed training or what training outcomes were measured
- ⚠️ Limited detail on how intercultural fluency and accessibility are embedded in specific program policies and procedures (e.g., admissions, field placement, grading, classroom accommodations)
- ⚠️ Human Services Club activities mentioned but not clearly connected to how program policies/procedures ensure intercultural fluency and accessibility
- ⚠️ No evidence of assessment or evaluation of cultural competence/accessibility implementation effectiveness

---
### `8.b` 🔴 — covered=False, score=0.00

**Spec prompt:** _Demonstrate how the curriculum integrates culturally and inclusively appropriate standards: 1. Includes but is not limited to student self-awareness of their own culture, biases, prejudice, and belief systems, and stereotyping. 2. Includes the development of awareness, knowledge, and skills of intercultural fluency, accessibility, and culture._

**Assigned content:** 10 narrative + 0 supporting evidence section(s)

**Claude's summary:** Raw response (truncated): ```json
{
  "is_covered": false,
  "coverage_score": 0.62,
  "gaps": [
    "No evidence provided: Narrative references course syllabi, assignments, and evaluations (e.g., 'Student Field Placement Evaluation, Section IV,' course schedules, reflection papers) but NO actual supporting documents are att

**Gaps (user must address):**
- ⚠️ LLM returned non-JSON response

---

## Standard 9

### `9.a` 🔴 — covered=False, score=0.35

**Spec prompt:** _Include budgetary information that demonstrates sufficient funding, faculty, and staff to provide an ongoing and stable program._

**Assigned content:** 1 narrative + 2 supporting evidence section(s)

**Claude's summary:** The narrative provides only a discretionary operating budget snapshot without faculty/staff rosters, salaries, or multi-year trends. To meet Specification 9.a, provide a comprehensive budget summary that includes faculty salaries, administrative/support staff positions and costs, total program budget, and 3–5 year trend data demonstrating ongoing stability and sufficiency for program delivery.

**Strengths:**
- Budget structure is clearly explained: narrative provides a readable interpretation of budget columns (Budgeted, Actual, Funds Available)
- Some budget categories align with program support: professional development, student travel, and field placement gifts demonstrate allocation toward student and faculty development
- Narrative acknowledges budget constraints: honest assessment that budget has declined and reductions are ongoing
- Discretionary spending flexibility noted: explanation that funds can be moved across or into new categories shows some adaptive capacity

**Gaps (user must address):**
- ⚠️ No faculty staffing information provided: number of full-time faculty, part-time faculty, credentials, or assignments to the program
- ⚠️ No staff (administrative, support, advising) information: titles, FTE, responsibilities, or adequacy for program delivery
- ⚠️ Budget is incomplete and outdated: only discretionary/operating budget shown ($8,683.89); missing salary lines for faculty, adjuncts, and staff that constitute typical program costs
- ⚠️ No faculty/staff trend data: narrative mentions budget 'decreasing for past few years' but provides no longitudinal staffing or salary information to demonstrate stability
- ⚠️ Missing evidence of program sustainability: no explanation of how current budget/staffing levels support the full scope of the baccalaureate program (courses, advising, field placements, etc.)
- ⚠️ No institutional context: unclear how department budget relates to overall institutional resource allocation or how program quality is maintained despite reductions
- ⚠️ Supporting evidence unrelated: Evidence 1 is a course syllabus; Evidence 2 describes a student award—neither addresses budgetary or staffing sufficiency

---
### `9.b` 🟡 — covered=False, score=0.55

**Spec prompt:** _Describe how program and field experience coordination is considered in calculating the teaching loads of faculty. It is recommended that consideration be given to distance between sites, expectations of observation, documentation requirements, number of students enrolled in the field experience, and the characteristics of the student population._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Strengthen the response by: (1) providing written policy documents or load calculation frameworks that explicitly incorporate the five recommended factors (distance, observation expectations, documentation, student numbers, student characteristics) into teaching load determinations for both full-time and adjunct faculty; and (2) adding evidence such as load justification statements, supervisor feedback, or comparative data demonstrating how field coordination responsibilities are weighted in overall faculty workload.

**Strengths:**
- Clearly identifies which faculty are responsible for field experience coordination (University Supervisors and Field Placement Coordinator)
- Provides specific credit-hour equivalencies for adjunct supervisors based on student numbers (3-4 students = 1 credit hour)
- Documents that distance is considered in supervisor assignments to sites
- Lists concrete responsibilities of the Field Placement Coordinator
- Shows semester-by-semester teaching load breakdown for the Field Placement Coordinator
- Acknowledges that supervisors and institution view the load as 'reasonable' given expectations

**Gaps (user must address):**
- ⚠️ No explicit discussion of how distance between sites is factored into full-time faculty teaching loads (only mentioned for adjunct supervisors)
- ⚠️ Missing rationale or justification for why the one-course equivalency for Field Placement Coordinator is adequate given the full scope of responsibilities
- ⚠️ No documentation of how characteristics of the student population (e.g., high-risk students, first-generation, non-traditional) influence load calculations
- ⚠️ Lacks explanation of how number of students enrolled in field experience affects full-time faculty workload beyond adjunct payment structure
- ⚠️ No supporting evidence provided (e.g., policy documents, load calculation worksheets, meeting minutes, or supervisor feedback) to substantiate the narrative claims
- ⚠️ Limited detail on observation expectations for full-time faculty and how these translate into load considerations
- ⚠️ No comparative analysis or institutional data showing how field coordination loads compare to non-field-coordination faculty loads

---
### `9.c` 🔴 — covered=False, score=0.25

**Spec prompt:** _Describe how the program has adequate professional support staff to meet the needs of students, faculty, and administration._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Strengthen this response by providing a staffing table or organizational chart showing all professional support positions, documenting how current staffing levels were determined to be adequate, and explaining how student/faculty/administrative support needs are being met across advising, scheduling, and other core functions. Include supporting evidence such as position descriptions or workload analysis.

**Strengths:**
- Identifies specific support staff roles (receptionists, Administrative Assistant, Marketing/Communications staff)
- Names concrete outputs produced (handbooks, certificates, invitations, brochures)
- Acknowledges contributions from multiple departments

**Gaps (user must address):**
- ⚠️ No evidence of adequacy - narrative makes no claims about whether current staffing is 'adequate' or meets actual documented needs
- ⚠️ No needs assessment data provided - no explanation of how student, faculty, and administrative needs were identified or measured
- ⚠️ No quantification of support staff - no FTE counts, job descriptions, or ratios of staff to students/faculty
- ⚠️ Missing administrative support details - no mention of advising support, graduation clearance, recruitment coordination, or other core program functions
- ⚠️ No discussion of student support services - advising, tutoring, career counseling, disability services, or other student-facing support
- ⚠️ No evidence of staffing adequacy - no supporting documentation (org charts, position descriptions, staffing plans, budget allocations, or workload analyses)
- ⚠️ No assessment of effectiveness - no data showing whether current support staff actually meet identified needs

---
### `9.d` 🟡 — covered=False, score=0.65

**Spec prompt:** _Describe how there is adequate resource support (e.g., technology, library, computer labs, etc.) to meet the needs of students, faculty, and administration._

**Assigned content:** 16 narrative + 2 supporting evidence section(s)

**Claude's summary:** The narrative provides good descriptive inventory of resources but lacks the evaluative component—add data demonstrating these resources actually meet demonstrated needs (utilization metrics, satisfaction data, assessment results) and clarify administrative technology support, IT helpdesk services, and resource adequacy relative to enrollment. Address the excessive repetition in library descriptions before resubmission.

**Strengths:**
- Concrete inventory of technology resources provided (471 computers, 26 labs, 42 classrooms with AV equipment)
- Comprehensive classroom infrastructure described (instructor PCs, projection systems, high-speed internet in all classrooms)
- Library resources well-documented with 24/7 digital access and research guides available
- Faculty office support described with specifics (full-time faculty have private offices; equipment request process noted)
- Academic support services identified (Academic Link tutoring center with specific location and contact information)
- Specialized facilities documented (science labs, photo labs, art studios, photography classroom)

**Gaps (user must address):**
- ⚠️ No evidence of adequacy assessment—no data on utilization rates, student/faculty satisfaction surveys, or metrics demonstrating resources meet actual needs
- ⚠️ Administrative technology support not addressed—no mention of systems, tools, or IT infrastructure supporting administrative functions
- ⚠️ Technology support services inadequately described—no mention of help desk, IT support hours, response times, or technical assistance availability
- ⚠️ No discussion of resource allocation or budgeting processes to ensure ongoing adequacy
- ⚠️ Significant repetition in narrative (library description repeated 10+ times) obscures substantive content and suggests poor editing/organization
- ⚠️ No mention of online/distance learning technology or support for remote students or faculty
- ⚠️ Computer lab capacity relative to enrollment not analyzed—471 computers across 26 labs provided without context on whether adequate for student population
- ⚠️ Part-time faculty office/resource support mentioned only briefly with no detail on adequacy of shared space arrangement

---
### `9.e` 🟡 — covered=False, score=0.45

**Spec prompt:** _Describe office, classroom, meeting, and informal gathering spaces and how they meet the needs of students, faculty, and administration._

**Assigned content:** 3 narrative + 1 supporting evidence section(s)

**Claude's summary:** Expand the narrative to include detailed descriptions of administrative office spaces, meeting room capacities and uses, and how informal gathering spaces specifically support students and faculty needs. Replace the classroom policies evidence with documentation (photos, floor plans, or usage data) showing how spaces are actively meeting program constituents' needs. Address accessibility and environmental adequacy.

**Strengths:**
- Clearly identifies which campus houses the program and explains consolidation rationale
- Provides concrete detail on faculty office equipment (desk, file cabinet, telephone, computer, monitor)
- Specifies classroom technology capabilities (PowerPoint, projectors, dry-erase boards)
- Mentions dedicated student study areas (tables near offices, Learning Commons)
- Notes availability of computer labs and multiple campus amenities (cafeterias, gyms)
- Acknowledges feedback from faculty and students about space use ('adjusting to new building')

**Gaps (user must address):**
- ⚠️ No description of office spaces for administration (only mentions faculty offices)
- ⚠️ Minimal detail on meeting spaces beyond 'two large conference rooms' — no information on capacity, accessibility, or how they support program needs
- ⚠️ No description of informal gathering spaces or how they specifically meet student needs (lounge areas mentioned but not characterized)
- ⚠️ No explanation of how spaces meet the needs of administration as a distinct user group
- ⚠️ Missing information on accessibility features, technology infrastructure, or environmental conditions (lighting, temperature, etc.)
- ⚠️ No assessment of whether current spaces are adequate or underutilized; vague statement 'seem to be working effectively' lacks specificity
- ⚠️ Evidence item discusses classroom policies unrelated to space adequacy and does not support the specification prompt
- ⚠️ No discussion of how informal gathering spaces support community-building or collaborative learning

---

## Standard 10

### `10.a` 🔴 — covered=False, score=0.25

**Spec prompt:** _Describe formal policies and procedures, and informal practices for the transfer of credits and evaluation of prior learning._

**Assigned content:** 2 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative provides only fragmented information about one articulation agreement rather than addressing formal policies and procedures for evaluating transfer credits and prior learning comprehensively. Provide a complete transfer credit policy document, evaluation procedures, criteria matrix, and evidence of how prior learning is assessed across all transfer sources.

**Strengths:**
- Clearly states that 70 credits will be accepted toward degree requirements from the specified partnership
- Identifies that experiential/life experience credits are NOT accepted, which demonstrates a defined boundary
- Notes that Tech Prep credits do not transfer, providing specific exclusions
- Includes language about protecting currently enrolled students if an agreement is terminated

**Gaps (user must address):**
- ⚠️ No description of formal policies and procedures for transfer credit evaluation—only mentions specific credit limits and test score requirements without documenting the policy framework
- ⚠️ No explanation of the process or criteria used to evaluate prior learning or experiential learning
- ⚠️ No description of informal practices for transfer credit evaluation
- ⚠️ Missing detail on who evaluates transfer credits and what qualifications they possess
- ⚠️ No information on appeals or dispute resolution processes for transfer credit decisions
- ⚠️ No timeline or expected turnaround for transfer credit evaluation
- ⚠️ No mention of how transfer credits are applied to specific degree requirements or general education
- ⚠️ No supporting evidence documents provided (e.g., transfer policies, articulation agreements, evaluation rubrics, procedures manuals)
- ⚠️ Narrative focuses only on one institution partnership (Community College of Baltimore County) rather than addressing transfer policies comprehensively across all accepted transfer sources

---
### `10.b` 🟢 — covered=True, score=0.82

**Spec prompt:** _Describe how students receive this information. II. CURRICULUM: BACCALAUREATE DEGREE_

**Assigned content:** 4 narrative + 1 supporting evidence section(s)

**Claude's summary:** Strengthen the response by explicitly describing the communication touchpoints and timeline for when students receive their individual transfer credit evaluation decisions, how they access official documentation of those decisions, and what recourse they have if they wish to appeal or discuss an evaluation outcome.

**Strengths:**
- Clearly identifies multiple channels where students receive transfer information: program website, college website, admissions/recruitment events, student handbook, and courses (CHS 380, CHS 441)
- Comprehensive formal policies covering regionally accredited transfers, minimum grade requirements (C or better), role of registrar and department chair in evaluation
- Detailed articulation agreements with specific community colleges provided with course-by-course mapping (Evidence 1)
- Addresses credit by examination pathways: CLEP with specific Stevenson-designated passing scores, International Baccalaureate with score thresholds (5+ for Higher Level)
- Documents prior learning evaluation procedure for CHS 380 waiver with specific documentation requirements (portfolio, supervisor letter) and review authority
- Identifies informal collaborative mechanisms (advisory boards, national/regional conferences) that support ongoing transfer credit alignment
- Graduate program articulation agreement with McDaniel College explicitly specified with credit transfer conditions (grade B or better)

**Gaps (user must address):**
- ⚠️ No explicit description of HOW students are initially informed about transfer credit evaluation procedures (e.g., during advising intake, orientation, or first contact with admissions)
- ⚠️ Missing timeline/timeline expectations for when transfer credit evaluations are completed and communicated to students
- ⚠️ No mention of written documentation or formal notification students receive after transfer credits are evaluated (e.g., official letter, evaluation report, transcript notation)
- ⚠️ Lacks detail on how students access their individual transfer credit evaluation results (e.g., through student portal, advising meetings, registrar correspondence)
- ⚠️ No description of appeal or reconsideration process if students dispute transfer credit decisions
- ⚠️ Limited explanation of how non-course-based prior learning (beyond employment waiver for CHS 380) is evaluated and credited

---

## Standard 11

### `11.a` 🔴 — covered=False, score=0.35

**Spec prompt:** _The historical roots of human services as a discipline and a profession._

**Assigned content:** 5 narrative + 2 supporting evidence section(s)

**Claude's summary:** This response lacks substantive evidence of student learning regarding the historical roots of human services as a discipline. Provide: (1) CHS 105 syllabus and Week 2 materials showing specific historical content covered; (2) actual research articles used in CHS 224 that connect to field development; (3) assessment artifacts demonstrating student understanding of disciplinary history; (4) course materials explicitly connecting agency/intervention histories to broader human services profession origins.

**Strengths:**
- Narrative identifies multiple courses (CHS 105, 224, 430, 380, 440) where history content could be embedded
- Program acknowledges integration of theory, research, and application across curriculum
- Internship and practicum courses include reflective components that could support historical learning

**Gaps (user must address):**
- ⚠️ No evidence that CHS 105 Week 2 history content actually covers historical roots; only a schedule notation exists—no syllabus, learning outcomes, or sample materials provided
- ⚠️ CHS 224 'social science research articles that influenced the field' is mentioned but no actual articles, titles, or evidence of their historical relevance to human services discipline provided
- ⚠️ CHS 430 family therapy models analysis does not demonstrate connection to broader historical roots of human services as a discipline/profession
- ⚠️ Field placement journal assignments about agency history (CHS 380, CHS 440) document local/organizational history, not disciplinary historical roots
- ⚠️ No evidence linking any coursework to seminal figures, historical movements, legislative developments, or philosophical foundations of human services (e.g., Progressive Era, social work origins, helping profession evolution)
- ⚠️ Supporting evidence includes unrelated research methods course schedules (Evidence 1) and a helping skills course schedule (Evidence 2) that do not address this specification
- ⚠️ Program revision section discusses writing courses and electives but contains no content addressing historical roots
- ⚠️ No assessment data, student work samples, or outcomes demonstrating student learning of historical roots

---
### `11.b` 🟡 — covered=False, score=0.55

**Spec prompt:** _Historical and current legislation impacting human service delivery._

**Assigned content:** 1 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative adequately identifies where legislation *could* be taught, but the supporting evidence does not substantiate *what* legislation is actually taught or assessed. Provide course syllabi excerpts, reading lists, assignment rubrics, or learning outcome assessments demonstrating that students master specific historical and current legislation (e.g., Social Security Act, ADA, IDEA, welfare reform laws, health care legislation) across these courses.

**Strengths:**
- Multiple courses identified across curriculum (CHS 101, 105, 224, 340, 430, 380, 440, 441) suggest intentional coverage across breadth of program
- Recognition that legislation is embedded in different contexts (family policy, social policy, administration, practice) shows integrated approach
- Field placement integration demonstrates applied learning opportunity for students to encounter real-world legislative impacts
- Acknowledgment of both 'historical and current' legislation in narrative response addresses both temporal dimensions of the specification

**Gaps (user must address):**
- ⚠️ Supporting evidence (course schedule) does not demonstrate actual coverage of legislation—no specific laws, bills, or policy names are listed in the curriculum materials provided
- ⚠️ CHS 105 'Social Policy' course schedule is incomplete; Week 2 mentions 'Great Society programs, welfare reform' but provides no reading assignments, syllabus details, or assessment evidence to verify this content is taught
- ⚠️ No evidence that 'current legislation' is systematically covered—the supporting documents do not show recent or contemporary laws (e.g., ACA, ESSA, TANF reauthorizations, Medicaid expansion, etc.)
- ⚠️ CHS 224 (Research Methods) connection to legislation is vague and indirect; the evidence shows only that research influences policy but does not demonstrate students learn specific legislation
- ⚠️ CHS 340 (Administration) legislation component is limited to hiring and fundraising legalities; no evidence of broader service-delivery legislation coverage
- ⚠️ CHS 430 (Family Dynamics) group project assignment is referenced but not provided; unclear whether 'legislative issues affecting each approach' is substantively addressed or merely mentioned
- ⚠️ Field placement courses (CHS 380/440/441) address agency-specific legislation only; no evidence of systematic, program-level instruction in historical and current legislation impacting human service delivery broadly
- ⚠️ No reading list or syllabus excerpts provided for most courses mentioned, limiting ability to verify legislation is actually a course outcome or core content

---
### `11.c` 🟡 — covered=False, score=0.55

**Spec prompt:** _How public and private attitudes influence legislation and the interpretation of policies related to human services._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** While the narrative demonstrates intentional curriculum design addressing this specification across multiple courses, the complete absence of supporting evidence makes verification impossible. Provide course syllabi excerpts, assignment prompts, student work samples, or assessment data demonstrating students can analyze how public/private attitudes influence legislation and policy interpretation.

**Strengths:**
- Breadth of curriculum—identifies seven courses integrating this specification across the program
- Sequencing logic—progresses from foundational awareness (CHS 101) to applied practice (CHS 380/440/441)
- Relevant course content—selections (same-sex marriage laws, social policy, family therapy models, board governance) appropriately illustrate attitude-legislation connections
- Multiple pedagogical approaches mentioned (lecture, discussion, reading, projects, field placement)
- Field placement courses provide authentic context for learning about real agency policies

**Gaps (user must address):**
- ⚠️ No supporting evidence provided despite multiple course references; claims about course content are unverified
- ⚠️ Lacks concrete examples demonstrating student learning outcomes (e.g., student work samples, assignments, projects)
- ⚠️ No evidence of how students actually analyze the relationship between attitudes and legislation/policy interpretation
- ⚠️ Missing documentation of assessment methods showing students can apply this knowledge (e.g., exam questions, rubrics, student papers)
- ⚠️ Vague reference to 'Issues Presentation project' and 'Poster Presentations' without actual assignment descriptions or samples
- ⚠️ No evidence addressing 'private attitudes' specifically; narrative focuses heavily on 'public attitudes' only
- ⚠️ Lacks clarity on depth of coverage—narrative states issues are 'addressed' but provides no evidence of substantive engagement

---
### `11.d` 🔴 — covered=False, score=0.35

**Spec prompt:** _The broader sociopolitical issues that affect human service systems. 2. Human Systems Context: The human services professional must demonstrate an understanding of the structure and dynamics of organizations, communities, and society as well as the nature of individuals and groups. This understanding is prerequisite to the determination of appropriate responses to human needs._

**Assigned content:** 4 narrative + 2 supporting evidence section(s)

**Claude's summary:** The narrative adequately addresses sociopolitical content and diversity, but supporting evidence is misaligned—it provides sociology assignment instructions rather than student work or assessment demonstrating that students understand how sociopolitical factors and organizational/community dynamics inform appropriate human service responses. Provide evidence from CHS core courses (syllabi, assignments, student work samples, rubrics) showing students analyze and apply sociopolitical/organizational knowledge to determine professional responses to human needs.

**Strengths:**
- Narrative clearly maps sociopolitical content (governance, economics, policy, political ideologies) across multiple courses (CHS 101, 105, 224, 340, 430, 380, 440, 441) with specific course references.
- Narrative addresses diversity's role in determining and meeting human needs across 11 courses with concrete examples (CHS 220 dedicated course on cultural competence).
- Narrative demonstrates exposure to spectrum of political ideologies through multiple teaching methods (discussions, assignments, group projects) and field placement integration.
- Field placement courses (CHS 380, 440, 441) explicitly integrate real-world organizational and policy contexts through Issues Presentations and agency analysis.
- Narrative addresses both individual diversity factors and systemic context, connecting cultural competence to professional practice.

**Gaps (user must address):**
- ⚠️ Supporting evidence provided (Evidence 1 & 2) describes sociology concept identification assignments unrelated to Specification 11.d; neither addresses sociopolitical issues affecting human service systems, organizational/community dynamics, or how professionals determine appropriate responses to human needs.
- ⚠️ No evidence demonstrates student learning outcomes regarding 'structure and dynamics of organizations, communities, and society' as required by the specification.
- ⚠️ No evidence shows how understanding of individuals and groups informs 'determination of appropriate responses to human needs'—the core application requirement of Specification 11.d.
- ⚠️ Supporting evidence about sociology concept papers does not connect to human services practice, policy analysis, or professional decision-making in organizational/community contexts.
- ⚠️ Missing evidence of assessment or demonstration that students can apply sociopolitical understanding to actual human service delivery decisions or organizational contexts.
- ⚠️ The Evidence 1 & 2 assignments appear to be from SOC 101 (a non-major course) rather than core human services courses where this competency should be developed and assessed.

---

## Standard 12

### `12.a` 🟢 — covered=True, score=0.78

**Spec prompt:** _Theories of human development._

**Assigned content:** 3 narrative + 2 supporting evidence section(s)

**Claude's summary:** Specification is adequately covered for KNOWLEDGE and THEORY, but the self-study would strengthen accreditation review by adding evidence of how students APPLY developmental theories in practice (case examples, field placement documentation, clinical skill assessments) and demonstrating VALUES integration. Include explicit syllabus excerpts showing cultural perspectives on development and comprehensive theory lists.

**Strengths:**
- Strong breadth of curriculum integration: theories of human development are threaded across 10+ courses (PSY 101, PSY 108, CHS 101, 105, 224, 315/515, 360, 380, 430, 440, 441), indicating systemic coverage.
- Clear lifespan perspective explicitly stated: pre-conception to death across biological, cognitive, and socioemotional domains aligns with standard developmental psychology curricula.
- Multiple instructional modalities documented: lectures, discussions, in-class activities, media presentations, assigned readings, and out-of-class activities support varied learning approaches.
- Evidence of applied context in clinical courses (CHS 315/515, 360) and Field Placement courses (CHS 380, 440, 441) that require understanding developmental context of actual clients.
- Foundation course (PSY 108) is explicitly dedicated to human development theory, indicating dedicated depth beyond introductory coverage in PSY 101.
- Course schedule evidence (Evidence 1) demonstrates systematic coverage of major developmental theories and domains (genetics, prenatal, infant cognition, Piaget stages, temperament).

**Gaps (user must address):**
- ⚠️ No evidence provided showing HOW theories are analyzed or applied in practice settings (e.g., case studies, clinical applications, field placement examples). Narrative mentions field placements but provides no documentation of developmental theory application.
- ⚠️ Missing explicit evidence that students demonstrate SKILLS in applying human development theory (e.g., assessments, treatment planning based on developmental stages). Narrative focuses on knowledge/theory presentation rather than competency demonstration.
- ⚠️ No evidence of how VALUES related to human development (e.g., respect for developmental diversity, person-centered perspectives) are explicitly taught or assessed.
- ⚠️ Limited documentation of specific theories beyond Freud, Erikson, and Piaget. Narrative mentions 'and others' but provides no comprehensive list of theoretical frameworks covered across the curriculum.
- ⚠️ Sparse evidence of cultural perspectives on human development. Arnett text appears to use 'cultural approach' but no syllabus excerpts demonstrate how cultural variations in development are explicitly integrated into instruction.

---
### `12.b` 🔴 — covered=False, score=0.00

**Spec prompt:** _Small groups: 1. Overview of how small groups are used in human services settings 2. Theories of group dynamics 3. Group facilitation skills._

**Assigned content:** 10 narrative + 3 supporting evidence section(s)

**Claude's summary:** Raw response (truncated): ```json
{
  "is_covered": true,
  "coverage_score": 0.78,
  "gaps": [
    "No explicit identification or citation of specific group dynamics theories (e.g., Tuckman's stages, Yalom's factors, systems theory) — narrative mentions 'theories of group dynamics' are 'major topics' in CHS 315 and 430 but 

**Gaps (user must address):**
- ⚠️ LLM returned non-JSON response

---
### `12.c` 🟡 — covered=False, score=0.45

**Spec prompt:** _Changing family structures and roles._

**Assigned content:** 7 narrative + 0 supporting evidence section(s)

**Claude's summary:** This submission lacks adequate supporting evidence to verify curriculum coverage. Provide course syllabi (especially CHS 101, 105, 430), assignment rubrics with student examples, and field placement evaluation protocols that explicitly demonstrate students are learning about changing family structures and roles across cultures and time periods. The South Korean case study, while detailed, is insufficient evidence of systematic curricular treatment of this specification.

**Strengths:**
- Narrative identifies multiple courses (CHS 101, 105, 430, SOC 101) and field placements (CHS 380, 440, 441) where content is addressed, suggesting breadth of coverage
- Mentions diverse pedagogical methods (lecture, discussion, readings, reflections, written assignments, presentations, role-plays, fieldwork)
- Demonstrates engagement with cultural variation (South Korea example shows attention to cross-cultural family patterns)
- Field placement integration shows practical application of understanding changing family structures in real client contexts
- Assignment structure (investigating controversial family issues, applying theories to family problems) suggests active learning approach to the topic

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, readings, or learning outcomes) to verify claims made in narrative
- ⚠️ Narrative conflates 'changing family structures' with a specific country case study (South Korea); lacks evidence of how curriculum addresses diverse family structures across multiple cultural contexts and time periods
- ⚠️ No documentation of specific learning outcomes or competencies students must demonstrate regarding understanding changing family structures and roles
- ⚠️ Missing evidence of assessment methods—narrative mentions 'reflections and written assignments' but provides no rubrics, student work samples, or evaluation criteria
- ⚠️ Field placement requirement (CHS 380, 440, 441) is mentioned but no evidence provided showing how students are evaluated on understanding clients' family structures and roles
- ⚠️ Narrative includes an extended student essay on South Korean families but this appears to be ONE student assignment example, not systematic curriculum coverage
- ⚠️ No evidence that students understand historical evolution of family structures (e.g., how/why structures have changed over time) versus just contemporary variations
- ⚠️ Missing documentation of how theoretical perspectives in CHS 430 (mentioned as 'analyzing family structures from variety of theoretical perspectives') actually address changing family structures

---
### `12.d` 🟡 — covered=False, score=0.55

**Spec prompt:** _An introduction to the organizational structures of communities._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide actual course syllabi, assignment descriptions, and/or student learning outcome statements that explicitly define and demonstrate how 'organizational structures of communities' are taught and assessed. Include rubrics or student work samples showing mastery of this competency.

**Strengths:**
- Multiple courses identified across the curriculum (CHS 101, CHS 105, CHS 430, SOC 101, and field placements) showing breadth of coverage
- Integration across foundational and advanced courses demonstrates scaffolding from introduction to application
- Field placement courses (CHS 380, 440, 441) provide experiential learning context where students apply organizational knowledge in real agencies
- Recognition that organizational structures affect families and human services practice shows appropriate integration with program goals

**Gaps (user must address):**
- ⚠️ No supporting evidence provided (syllabi, assignments, learning outcomes, rubrics, or student work samples) to verify that organizational structures are actually taught
- ⚠️ Narrative lacks specificity about what 'organizational structures of communities' means—no definition provided and no clear distinction between community organizations, government structures, social institutions, or service systems
- ⚠️ No evidence that students demonstrate understanding of these structures (e.g., no assessment data, student artifacts, or evaluation results cited)
- ⚠️ Vague language: 'introduced,' 'addressed,' and 'considered' lack clarity about depth of coverage or learning outcomes achieved
- ⚠️ Community needs assessment mentioned as 'added' but no details on how it teaches organizational structures or what students learned from it
- ⚠️ Student Evaluation Form Section IV.B cited but not provided; cannot verify it assesses knowledge of organizational structures specifically
- ⚠️ SOC 101 listed but narrative does not explain how in-class activities, discussions, and lectures specifically cover organizational structures

---
### `12.e` 🟡 — covered=False, score=0.55

**Spec prompt:** _An understanding of the capacities, limitations, and resiliency of human systems._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** While the narrative identifies multiple courses addressing human systems resiliency and capacities/limitations, it lacks concrete supporting evidence (syllabi, assignment samples, assessment tools, student outcomes data) to verify these claims. Provide course materials, learning outcome assessments, and at least one example of student work demonstrating mastery of understanding human systems' capacities, limitations, and resiliency.

**Strengths:**
- Multiple courses cited across curriculum suggesting intentional integration of the concept across the program sequence
- Mix of instructional modalities mentioned (lectures, discussions, readings, reflections, written assignments, journal writing) shows varied pedagogical approaches
- Connection to applied practice through field placements demonstrates attempt to move from theory to real-world application
- Specific course topics identified (e.g., 'Stress and Crisis in Relationships,' 'Team and Coalition Building') that directly relate to human systems resilience

**Gaps (user must address):**
- ⚠️ No supporting evidence provided (syllabi, assignments, readings, rubrics, student work samples) to verify claims about course content coverage
- ⚠️ Vague reference to 'theories related to capacities, limitations and resiliency' in CHS 101 without specifying which theories (e.g., family systems theory, ecological systems theory, trauma-informed approaches, resilience frameworks)
- ⚠️ No explicit connection to what 'capacities' and 'limitations' of human systems means in the context of counselor education—unclear whether this addresses individual, family, organizational, or community-level systems
- ⚠️ CHS 224 description mentions 'how capacity and limitations of human systems can be measured' but provides no evidence of actual measurement tools, assessment methods, or learning outcomes
- ⚠️ Field placement courses (CHS 380, 440, 441) claim students reflect on resiliency but no evidence of structured reflection prompts, assessment criteria, or examples of student reflections provided
- ⚠️ New course CHS 365 listed but narrative states it 'will be taught' in spring 2020 (past tense now)—no evidence of actual delivery, content covered, or student outcomes
- ⚠️ No assessment data demonstrating students actually achieve understanding of these concepts (grades, rubric scores, competency verification)

---
### `12.f` 🔴 — covered=False, score=0.35

**Spec prompt:** _Emphasis on context and the role of intercultural fluency, including cultural group membership and individual identities in determining and meeting human needs._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** While the narrative shows emerging critical consciousness, it reads as a personal reflection essay rather than evidence of mastering intercultural fluency as a professional competency. Provide coursework assignments, readings, or assessments demonstrating how students translate cultural self-awareness into culturally-responsive practice skills for meeting diverse human needs.

**Strengths:**
- Student demonstrates critical reflection on stereotypes and bias (e.g., neighborhood danger narratives)
- Shows awareness that dominant group (white) perspectives shape perceptions of communities
- Provides concrete personal example of cross-cultural exposure and stereotype questioning
- Indicates movement beyond individual perspective to recognize structural/group-level patterns

**Gaps (user must address):**
- ⚠️ No explicit connection to how intercultural fluency is developed or applied in social work practice/intervention
- ⚠️ Lacks demonstration of understanding cultural group membership as a systematic factor (vs. individual anecdote)
- ⚠️ Missing evidence of how individual identities intersect with cultural group membership in determining human needs
- ⚠️ No discussion of how this awareness translates to meeting human needs across diverse populations
- ⚠️ Absence of theoretical framework connecting personal reflection to professional competency
- ⚠️ No supporting evidence (readings, assignments, assessments) provided to corroborate learning
- ⚠️ Fails to address how context shapes service delivery, assessment, or intervention planning
- ⚠️ Does not demonstrate knowledge of how dominant/non-dominant group dynamics affect human needs identification

---
### `12.g` 🟡 — covered=False, score=0.45

**Spec prompt:** _Processes to effect social change through advocacy work at all levels of society including community development, community and grassroots organizing, and local and global activism._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide syllabi, assignment descriptions, rubrics, and sample student work demonstrating how advocacy, community development, grassroots organizing, and activism are explicitly taught and assessed. Clarify which courses provide foundational exposure vs. substantive skill-building, and include evidence of student application in real-world or simulated advocacy contexts.

**Strengths:**
- Identifies multiple courses where advocacy and social change are addressed (8 courses mentioned)
- CHS 340 explicitly framed around 'administration' and 'effecting social change' through advocacy
- CHS 105 explicitly includes community needs assessment and advocacy/community organization assignment
- CHS 224 identifies research as a tool to support advocacy (methodology component)
- CHS 380 Internship mentioned, suggesting applied/experiential component exists
- Attempts to show integration across curriculum rather than isolated course

**Gaps (user must address):**
- ⚠️ No supporting evidence provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content
- ⚠️ No concrete examples of how 'community development' is taught or demonstrated by students
- ⚠️ No evidence of how 'grassroots organizing' skills are actually taught or practiced
- ⚠️ No demonstration of 'local and global activism' instruction or student engagement
- ⚠️ Missing evidence that advocacy work is taught 'at all levels of society' (individual, organizational, community, systemic/policy)
- ⚠️ No student learning outcomes or assessment data showing competency in these processes
- ⚠️ Unclear how CHS 101 (Family Studies), CHS 430 (Family Dynamics), and CHS 220 (Diversity) specifically address advocacy and organizing rather than just related topics
- ⚠️ No evidence of experiential learning, simulations, or real-world advocacy projects
- ⚠️ No clarification on depth vs. breadth: are these topics woven throughout courses or substantively addressed?

---
### `12.h` 🟡 — covered=False, score=0.55

**Spec prompt:** _Processes to analyze, interpret, and effect policies and laws at local, state, and national levels that influence services delivery systems. 3. Human Service Delivery Systems Context: The demand for services and the funding of educational programs has been closely related to identifiable human conditions including, among others: aging, delinquency, crime, poverty, mental illness, physical illness, chemical dependency, and disabilities. The needs that arise in these conditions provide the focus for the human services profession._

**Assigned content:** 4 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide concrete syllabi, assignment descriptions, and student work samples demonstrating policy analysis at multiple governmental levels and evidence of students learning to advocate for policy change. Currently, claims about coverage lack supporting documentation, and the narrative does not clearly address how students learn to *effect* policy change or engage with the specific human service contexts (aging, poverty, disability, etc.) named in the Specification.

**Strengths:**
- Narrative identifies multiple courses addressing policy and advocacy (CHS 105, CHS 340/540, CHS 224)
- Research methods course (CHS 224) appropriately connects data analysis to policy influence
- Field placement courses are mentioned as venues for practice with real-world policy contexts
- Some historical context is acknowledged (e.g., 'historical roots of helping' in CHS 105)
- Interdisciplinary approach noted with SOC 101 inclusion

**Gaps (user must address):**
- ⚠️ No evidence provided to support any of the narrative claims—syllabi, assignment rubrics, course schedules, student work samples, or policy analysis examples are absent
- ⚠️ No demonstration that students learn to *effect* (create, influence, change) policies and laws; narrative focuses on analysis and interpretation only
- ⚠️ No specific coverage of local, state, and national level policy analysis with concrete examples (e.g., Medicaid policy, child welfare legislation, housing law)
- ⚠️ Missing content on aging populations and their specific service delivery systems, which is explicitly named in the Specification context
- ⚠️ No evidence of instruction on the ethical conflict between legal compliance and client rights (Standard 12 requirement)
- ⚠️ No documentation of how field placements specifically integrate policy analysis and advocacy—placements are listed but not described
- ⚠️ Missing explicit connection to how human conditions (aging, poverty, mental illness, chemical dependency, disabilities) drive policy needs and service delivery systems
- ⚠️ No student assignments, projects, or assessments shown that require analysis of actual policies/laws and their service delivery impact

---

## Standard 13

### `13.a` 🟡 — covered=False, score=0.45

**Spec prompt:** _The range and characteristics of human service delivery systems and organizations._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide actual course syllabi, assignment descriptions, and student artifacts demonstrating what 'range and characteristics' of human service delivery systems students learn. Clarify which specific organizational types, delivery models, and structural characteristics are explicitly covered, and strengthen the role of non-CHS courses in meeting a CHS-specific specification.

**Strengths:**
- Identifies multiple CHS courses (CHS 101, 105, 224, 380, 430, 440, 441) that address the specification
- Shows varied instructional methods (lecture, discussion, readings, assignments, guest speakers, practical experience)
- Includes experiential learning through internship (CHS 380) and practicum (CHS 441) where students encounter real organizational systems
- Demonstrates integration across the curriculum rather than siloing content in one course
- Mentions specific assignments (grant proposal, research projects, group presentations) that suggest active engagement with the topic

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, readings, student work samples) to verify claims about course content
- ⚠️ No definition or explanation of what 'range and characteristics' means in the context of human service delivery systems
- ⚠️ Vague description of how different delivery systems (public vs. private, nonprofit vs. for-profit, governmental vs. community-based) are explicitly taught
- ⚠️ No evidence that students learn about organizational structures, governance models, or operational characteristics of different types of human service organizations
- ⚠️ No documentation of learning outcomes, assessments, or student demonstrations of competency in this area
- ⚠️ Missing evidence about coverage of different service sectors (mental health, child welfare, aging, substance abuse, etc.) and their respective delivery systems
- ⚠️ No clarification on the depth or breadth of coverage across the multiple courses listed
- ⚠️ Incomplete coverage claim: SOC 101 and PSY 101/108 are listed as addressing this but are not CHS courses—unclear if/how these adequately support a CHS-specific specification

---
### `13.b` 🔴 — covered=False, score=0.35

**Spec prompt:** _The range of populations served, and needs addressed by human services professionals._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide syllabi excerpts or assignment descriptions showing which specific populations and needs are taught in core courses (e.g., 'CHS 105 Unit 4 addresses homeless youth, foster youth, and LGBTQ+ populations'), and include 1-2 student work samples demonstrating mastery of identifying populations/needs.

**Strengths:**
- Multiple courses are identified as addressing the topic (8+ courses listed)
- CHS 105 specifically mentions a 'Special Groups' unit and research projects that could address diverse populations
- CHS 220 explicitly addresses diversity and cultural competence in relation to populations
- CHS 430 addresses family interventions, indicating at least one specific population/need area
- Variety of pedagogical methods mentioned (discussions, readings, assignments, projects) suggests active learning approaches

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify that populations and needs are actually taught
- ⚠️ Narrative lists course names and general teaching methods but does not specify WHICH populations are covered (e.g., homeless, elderly, children, mental health, substance abuse, LGBTQ+, etc.)
- ⚠️ Narrative does not specify WHICH human services needs are addressed (e.g., housing, healthcare access, employment, crisis intervention, etc.)
- ⚠️ No evidence of the breadth of populations—unclear if program covers vulnerable/marginalized populations beyond those implied by 'Special Groups' and 'Diversity'
- ⚠️ No demonstration that students can identify and articulate the range of populations and needs post-instruction (no learning outcomes, assessments, or student artifacts)
- ⚠️ Courses in other majors (PSY 101, PSY 108, SOC 101) are mentioned but not explained as to how they specifically address populations served by human services

---
### `13.c` 🟡 — covered=False, score=0.55

**Spec prompt:** _The major models used to conceptualize and integrate prevention, maintenance, intervention, rehabilitation, and healthy functioning._

**Assigned content:** 4 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative conflates course coverage with specification mastery and lacks concrete evidence that students learn to identify, differentiate, and integrate major conceptual models (prevention, maintenance, intervention, rehabilitation, healthy functioning). Provide curriculum map showing explicit learning outcomes for each model type, sample assignments/rubrics demonstrating student understanding, and field evaluation data confirming competency.

**Strengths:**
- Narrative identifies multiple courses (CHS 101, 105, 201, 224, 315/515, 340, 360, 380, 430, 440, 441) where content is allegedly covered, suggesting breadth of exposure
- Includes both classroom and experiential learning modalities (lecture, discussion, reading, internship, practicum, guest speakers, journaling) appropriate for knowledge and skills development
- Demonstrates integration across different service contexts (families, individuals, groups, agencies, community) relevant to the specification
- Family intervention models listed in evidence provide concrete examples of one category of 'major models' with theoretical attribution
- Field placement evaluations mentioned suggest some attempt to assess transfer of knowledge to practice

**Gaps (user must address):**
- ⚠️ No explicit definition or conceptual framework for what 'major models' means in the context of prevention-maintenance-intervention-rehabilitation-healthy functioning integration
- ⚠️ Missing clear evidence that students can actually NAME and DIFFERENTIATE between major models (e.g., public health model, medical model, social-ecological model, strength-based model, recovery model)
- ⚠️ The supporting evidence provided (family therapy models: Bowen, Minuchin, Haley, Beck/Ellis, deShazer, White) addresses family intervention but does NOT demonstrate coverage of prevention and maintenance models broadly across human services contexts
- ⚠️ No evidence showing how prevention (primary, secondary, tertiary) is conceptually distinguished and integrated with maintenance, intervention, and rehabilitation
- ⚠️ Narrative lists courses and activities but lacks explicit connection between course content and mastery of 'major models'—no syllabus excerpts, assignment rubrics, or learning outcome assessments provided
- ⚠️ Single evidence item (substance abuse assessment) is disconnected from the broader specification requirement and does not address the integration of prevention-maintenance-intervention-rehabilitation-healthy functioning
- ⚠️ No evidence of student competency demonstration (e.g., exam results, project rubrics, field evaluations showing students can identify and apply major models)

---
### `13.d` 🟡 — covered=False, score=0.45

**Spec prompt:** _An understanding of systemic causes of poverty and its implications._

**Assigned content:** 2 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide syllabi excerpts, assignment rubrics, and student work samples demonstrating explicit teaching and assessment of systemic poverty concepts. Clarify the distinction between general course content and specific measurable outcomes for understanding systemic causes and their implications for human services practice.

**Strengths:**
- Identifies multiple courses (CHS 101, 201, 220, 224, 430) and cross-disciplinary courses (PSY, SOC) where content is claimed to be integrated
- Attempts to show progression from introductory (CHS 101) to advanced (CHS 430) coursework
- References active learning methods (team projects, group presentations, assignments) rather than lecture-only approaches
- Student reflection demonstrates some critical thinking about systemic causes (race, unequal pay, cycle of poverty, white supremacy)

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, assessments, student work samples) to verify claims about course content
- ⚠️ Vague references to 'assigned reading,' 'lecture,' and 'discussion' without specific titles, authors, or learning outcomes that demonstrate systemic poverty analysis
- ⚠️ No clear assessment data showing students actually understand systemic causes (structural inequality, institutional racism, economic systems) versus surface-level exposure
- ⚠️ Second paragraph is a student book review/reflection on DiAngelo—not evidence of program-level instruction on systemic poverty; unclear how this demonstrates institutional learning outcomes
- ⚠️ No explicit connection between stated course content and measurable student competency in understanding systemic poverty's implications (e.g., policy analysis, case studies, capstone projects)
- ⚠️ Missing evidence from field placements (CHS 380, 440, 441) despite claims they address this content
- ⚠️ No evidence of integration across curriculum showing scaffolded learning on systemic causes from foundational through advanced courses
- ⚠️ Lacks demonstration of understanding 'implications' of systemic poverty (e.g., impact on service delivery, policy advocacy, client outcomes)

---
### `13.e` 🟡 — covered=False, score=0.45

**Spec prompt:** _An understanding of national and global social policies and their influence on human service delivery._

**Assigned content:** 2 narrative + 0 supporting evidence section(s)

**Claude's summary:** Resubmit with all referenced supporting documents (course syllabi, assignment samples, assessment rubrics, student work examples). Clarify the connection between studying social policies and developing competency to deliver human services; remove unrelated South Korea content or contextualize it as a student assignment. Include assessment evidence demonstrating students understand how policies influence service delivery.

**Strengths:**
- Multiple courses identified as addressing national and global social policies (CHS 101, CHS 105, CHS 220, CHS 430)
- CHS 105 explicitly titled 'Human Services and Social Policy' directly targets the specification topic
- CHS 220 country report assignment demonstrates active engagement with global policy contexts
- Recognition that both national (U.S.) and global contexts are covered across the curriculum
- References to specific pedagogical methods (lecture, discussion, reading, assignments, presentations)

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, schedules, country reports referenced are mentioned but not attached)
- ⚠️ Vague connection between course content and student learning outcomes—narrative does not explain HOW understanding of national/global social policies influences human service delivery practice
- ⚠️ Second half of narrative (South Korea LGBTQ+ policy) appears to be a student work sample or unrelated content; unclear how this demonstrates program-level curricular coverage of the specification
- ⚠️ Field placement courses (CHS 380, CHS 440) mentioned but no description of how they address national/global social policies
- ⚠️ No assessment data or evidence of student learning/competency related to this specification
- ⚠️ Cross-listed courses (PSY 101, SOC 101) mentioned without syllabi confirmation or direct connection to the specification's requirement
- ⚠️ Missing explicit connection between understanding social policies and competence in human service delivery—the specification requires both knowledge AND application/influence

---
### `13.f` 🟡 — covered=False, score=0.45

**Spec prompt:** _Constituency building and other advocacy skills such as lobbying, grassroots movements, and community development and organizing. 4. Discipline Inquiry and Information Literacy Context: The delivery of human services depends on the appropriate integration of various forms of information._

**Assigned content:** 2 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide syllabi, assignment rubrics, and student work samples demonstrating concrete instruction and assessment of lobbying, grassroots movements, and community organizing as distinct skills. Include evidence showing how information literacy (research, synthesis, reporting) is applied specifically to advocacy and constituency-building outcomes in at least 2-3 signature courses.

**Strengths:**
- Broad curriculum mapping shows multiple courses touch on information gathering and synthesis (CHS 101, 105, 217, 220, 224, 315, 360, 380, 430, 440, 441)
- CHS 224 is identified as writing-intensive and specifically addresses critical analysis of literature, which supports information literacy
- Field placements are explicitly referenced as venues for practicing these skills
- Narrative identifies specific course objectives and assignment types (Country Research Project, Team Research Project, Issue Presentation) that could involve these competencies
- Recognition that CHS 220 addresses social justice context alongside diversity provides some thematic integration

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content and learning outcomes
- ⚠️ Constituency building specifically lacks concrete demonstration—narrative lists courses but provides no evidence of actual assignments, projects, or assessments focused on this skill
- ⚠️ Lobbying skills are not mentioned or addressed anywhere in the narrative
- ⚠️ Grassroots movements are mentioned only once in CHS 224 description with no supporting evidence of how deeply this is integrated or assessed
- ⚠️ Community organizing is mentioned but not clearly distinguished from community development; no evidence of dedicated instruction or assessment
- ⚠️ Information literacy context is addressed generically across many courses but lacks evidence of integration with advocacy/community development work (e.g., how students use research to support grassroots advocacy)
- ⚠️ No evidence of how field placements (CHS 380, 440) specifically assess advocacy or constituency-building skills
- ⚠️ No demonstration of where/how students synthesize information specifically to support advocacy goals, legislative proposals, or community organizing initiatives
- ⚠️ The narrative response appears incomplete—the CHS 380 entry cuts off mid-sentence and provides no closure
- ⚠️ SOC 101 is mentioned as addressing advocacy but it is not a human services course; its relevance is unclear and unsupported

---

## Standard 14

### `14.a` 🔴 — covered=False, score=0.35

**Spec prompt:** _Obtain, synthesize, and report information from various sources._

**Assigned content:** 3 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative conflates 'assessing client needs' with 'obtaining and synthesizing information from various sources'—these are related but distinct competencies. Reframe the response to explicitly address how students learn to locate diverse information sources, evaluate them critically, synthesize findings across sources, and communicate integrated results. Provide actual syllabi excerpts, assignment instructions, and assessment tools as evidence.

**Strengths:**
- The narrative maps multiple courses (CHS 105, 224, 315/515, 360, 340, 430, 380, 440) that could address information-gathering skills
- CHS 224 Research Methods and Writing is explicitly tied to research proposals, which could involve obtaining and synthesizing information
- The program describes active learning methods (interviews, guest speakers, group projects, journaling) that could involve information gathering
- Field placement courses (CHS 380, 440) are mentioned as venues for practical application of skills

**Gaps (user must address):**
- ⚠️ Specification 14.a asks students to 'Obtain, synthesize, and report information from various sources' but the narrative focuses almost exclusively on assessing client needs, not on the broader skill of information synthesis and reporting from multiple sources
- ⚠️ No evidence that students learn to obtain information from various source types (databases, primary vs. secondary sources, mixed methods, etc.)
- ⚠️ Missing demonstration of synthesis skills—the narrative describes individual assignments (research proposals, interviews, group projects) but does not show how students integrate or synthesize information across multiple sources
- ⚠️ The single supporting evidence provided (research proposal assignment) is incomplete and does not detail how students obtain, synthesize, or report from various sources
- ⚠️ No syllabi, assignment rubrics, or course materials provided as evidence to demonstrate the actual teaching and assessment of information synthesis
- ⚠️ No evidence of instruction on how to evaluate source quality, credibility, or relevance when obtaining information from various sources
- ⚠️ The narrative includes an out-of-place paragraph about writing literature reviews (beginning with 'The best way to can develop writing skills...') that appears to be copied guidance rather than evidence of program implementation

---
### `14.b` 🟡 — covered=False, score=0.45

**Spec prompt:** _Assess the quality of information from various sources, including but not limited to print, audio, video, web, and social media, and understand its application._

**Assigned content:** 3 narrative + 2 supporting evidence section(s)

**Claude's summary:** The submission adequately addresses print source evaluation but lacks evidence that students are explicitly taught to assess quality of audio, video, web, and social media sources as required by the specification. Provide syllabi excerpts, assignment rubrics, or student work demonstrating competency across all five source types mandated.

**Strengths:**
- Narrative identifies multiple courses (9 CHS courses) where information gathering and assessment occurs
- Specification requires assessment of print, audio, video, web, and social media; narrative demonstrates solid coverage of PRINT sources through course assignments (research projects, proposals, readings)
- Evidence 1 & 2 provide clear instructional materials distinguishing scholarly from popular print sources, showing pedagogical scaffolding
- Internship (CHS 380) and Practicum (CHS 440/441) offer real-world contexts for evaluating information quality
- Multiple assignment types mentioned (presentations, journaling, reflections, group projects) suggest varied assessment methods

**Gaps (user must address):**
- ⚠️ No evidence of teaching students to assess AUDIO sources specifically
- ⚠️ No evidence of teaching students to assess VIDEO sources specifically
- ⚠️ No evidence of teaching students to assess WEB sources specifically (beyond general research skills)
- ⚠️ No evidence of teaching students to assess SOCIAL MEDIA sources specifically
- ⚠️ Supporting evidence (Evidence 1 & 2) only addresses print/scholarly journals vs. magazines—does not demonstrate coverage of the full range of source types mandated by the specification
- ⚠️ No syllabi, assignments, or course materials provided showing explicit instruction in evaluating quality across the four non-print media types
- ⚠️ Narrative lists courses but provides minimal detail on how quality assessment of diverse source types is actually taught or demonstrated
- ⚠️ No assessment data or student work samples showing students can evaluate audio, video, web, and social media sources

---
### `14.c` 🟡 — covered=False, score=0.55

**Spec prompt:** _Upholding confidentiality and using appropriate means to share information._

**Assigned content:** 4 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide actual supporting evidence (syllabi excerpts, evaluation forms, assignment rubrics) to verify confidentiality instruction across courses. Additionally, strengthen the narrative to explicitly address the 'appropriate means to share information' component and how technology/disclosure guidelines are taught and assessed.

**Strengths:**
- Narrative identifies multiple courses (8 courses) across the curriculum where confidentiality is addressed, showing systematic coverage
- Clearly specifies course objectives and course topics (e.g., 'Professional, Legal, and Ethical Issues') related to confidentiality
- References field placement evaluation and mentoring by field instructors as a practical assessment method
- Acknowledges the NOHS standards framework and emphasizes confidentiality as integral to professionalism
- Includes acknowledgment of exceptions to confidentiality (harm standard), demonstrating nuanced understanding

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (e.g., syllabi, course schedules, field placement evaluation forms, NOHS code excerpts) to verify claims about course content and student evaluation criteria
- ⚠️ Specification requires addressing both 'upholding confidentiality' AND 'using appropriate means to share information'—narrative focuses heavily on confidentiality but minimally addresses when/how to appropriately share information with other professionals, agencies, or supervisors
- ⚠️ No evidence of how technology-related confidentiality concerns (Standard 9) are taught or assessed, despite mention of the standard
- ⚠️ No documentation of student disclosure guidelines (Standard 42) or mechanisms for students to opt-out of self-disclosure activities in coursework
- ⚠️ Internship/practicum evaluation criteria mentioned but actual evaluation form not provided; cannot verify that specific confidentiality language is used or how students are assessed
- ⚠️ No evidence of how students demonstrate competency in discerning exceptions to confidentiality (harm to client/others) beyond a single sentence in the field evaluation prompt

---
### `14.d` 🟡 — covered=False, score=0.45

**Spec prompt:** _Using technology, including artificial intelligence, to locate, evaluate, and disseminate information. 5. Program Planning and Evaluation Context: A significant component of the human services profession involves assessing the needs of clients and client groups, and planning programs and interventions to assist them in promoting optimal functioning, growth, and goal attainment. At regular intervals, the outcomes must be evaluated, and necessary adjustments made to the plan, both at an individual client and program level._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide course syllabi, assignment descriptions, and rubrics for at least 3-4 courses showing explicit instruction in source evaluation and AI literacy; include student work samples or assessment data demonstrating competency; clarify how these technology skills directly support program planning and evaluation in client/community contexts.

**Strengths:**
- Identifies multiple courses (11 courses) that address technology and information literacy
- Specific course names and assignment types are named (Team Research Project, Critical Analysis, Country Report)
- Acknowledges AI as part of the specification by mentioning it in the opening sentence
- Connects skills to internship/practicum experiences where application likely occurs
- Shows awareness that this is a cross-curricular expectation rather than isolated to one course

**Gaps (user must address):**
- ⚠️ No evidence provided to support claims about specific courses (syllabi, assignments, rubrics, or student work samples referenced but not attached)
- ⚠️ No demonstration of how AI tools specifically are integrated into curriculum or assignments
- ⚠️ No evidence that students learn to EVALUATE the credibility/quality of information sources, only that they 'locate' information
- ⚠️ No evidence of how technology skills connect to program planning and evaluation at individual client or program levels
- ⚠️ No assessment data showing students actually develop these competencies or demonstrate proficiency
- ⚠️ Critical Analysis assignment mentioned for CHS 224 but not provided; Country Report assignment for CHS 220 not provided; Student Evaluation item I.A. referenced but not included
- ⚠️ No evidence of how dissemination of information is taught or assessed (narrative focuses heavily on locating/evaluating)
- ⚠️ No documentation of how these technology skills are scaffolded across the curriculum or measured at program completion

---

## Standard 15

### `15.a` 🔴 — covered=False, score=0.00

**Spec prompt:** _Knowledge and skills to analyze and assess the needs of clients or client groups._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** The self-study submission is incomplete; no narrative or supporting evidence has been provided for Specification 15.a. The program must submit a clear narrative describing how coursework and learning experiences develop students' knowledge and skills in client needs assessment, accompanied by relevant syllabi, assignment examples, or competency frameworks demonstrating this content.

**Gaps (user must address):**
- ⚠️ No narrative explaining how the program teaches knowledge of assessment frameworks or models
- ⚠️ No evidence of curriculum content addressing needs analysis methodologies
- ⚠️ No demonstration of skill-building in client/group assessment techniques
- ⚠️ No examples of how students learn to apply assessment tools in practice
- ⚠️ No evidence of coursework or assignments focused on analyzing client needs
- ⚠️ No description of how programs ensure students can assess both individual and group-level needs
- ⚠️ No supporting documents such as syllabi, competency rubrics, or assignment examples
- ⚠️ No evidence of theory integration (e.g., biopsychosocial models, ecological perspectives) in needs assessment

---
### `15.b` 🟡 — covered=False, score=0.55

**Spec prompt:** _Skills to develop goals, design and implement a plan of action._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative provides a coherent course map but lacks any supporting documentation. Attach at minimum three representative syllabi (one foundational, one intermediate, one capstone) showing explicit course objectives and assignments, plus one sample rubric or student work demonstrating proficiency in goal-setting and action-planning skills.

**Strengths:**
- Breadth of coverage: specification is addressed across seven courses (CHS 105, 224, 340, 360, 380, 430, 440), suggesting intentional curriculum design
- Multiple pedagogical approaches identified: narrative mentions lectures, in-class discussions, group projects, field placements, guest speakers, and journaling—indicating varied instructional methods
- Connection to applied practice: internship and practicum courses (CHS 380, 440) explicitly embed goal-setting and action planning in real-world field experiences
- Specific assignments named: references to Team Research Project, Interview Project, and Group Project suggest concrete learning activities focused on the skill

**Gaps (user must address):**
- ⚠️ No supporting evidence provided: syllabi, course objectives, assignments, or rubrics are referenced but not attached, making verification impossible
- ⚠️ No explicit demonstration of student learning outcomes: narrative describes course activities but provides no evidence that students actually develop competency in goal-setting and action planning (e.g., no sample assignments, student work, or assessment results)
- ⚠️ Lack of clarity on skill progression: narrative lists courses but doesn't demonstrate how the skill develops across the curriculum from foundational to advanced
- ⚠️ Missing assessment methodology: no mention of how the program evaluates whether students meet this specification or what proficiency standard is expected
- ⚠️ Vague pedagogical description: phrases like 'lecture and corresponding outside reading' lack specificity about how instructors ensure goal-development and action-planning skills are explicitly taught and measured
- ⚠️ No evidence of integration with human services practice standards: no reference to how these skills align with professional competency frameworks or CSHSE expectations for goal-setting methodologies

---
### `15.c` 🟡 — covered=False, score=0.55

**Spec prompt:** _Skills to evaluate the outcomes of the plan and the impact on the client or client group. 6. Client Interventions and Strategies Context: Human service professionals function as change agents and must therefore attain and develop a core of knowledge, theory, and skills to provide direct services and interventions to clients and client groups._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide course syllabi, assignment rubrics, and student work samples demonstrating that graduates can actually select appropriate evaluation methods, measure outcomes, and interpret results. Include assessment data showing competency attainment in outcome evaluation skills.

**Strengths:**
- Identifies six courses (CHS 105, 224, 340, 380, 430, 440) where evaluation skills are integrated across the curriculum
- Describes multiple instructional methods (lectures, assignments, group projects, field placements, guest speakers, journaling) supporting skill development
- Explicitly names two signature assignments (Team Research Project in CHS 105, Group Project in CHS 430) that require outcome evaluation
- Recognizes evaluation as 'fundamental' and 'integral' across courses, suggesting intentional curricular design
- References field placements (CHS 380, 440) as venues for applied evaluation practice

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, rubrics, assignments, student work samples) to verify claims about course content and learning activities
- ⚠️ Lacks specific demonstration of how students develop and practice evaluation skills (e.g., pre/post assessment tools, outcome measurement techniques, data analysis methods)
- ⚠️ No evidence that students actually learn to SELECT or DESIGN appropriate outcome evaluation measures for different client populations
- ⚠️ Missing concrete examples of what 'evaluation of outcomes' means in practice (e.g., standardized instruments, qualitative methods, goal attainment scaling)
- ⚠️ No assessment data showing students can competently evaluate plan outcomes and client impact by program completion
- ⚠️ Insufficient detail on how CHS 224 (Research Methods) specifically teaches outcome evaluation beyond mentioning it as a 'primary measurement issue'
- ⚠️ Guest speaker component in CHS 380 mentioned but not verified by supporting materials

---

## Standard 16

### `16.a` 🔴 — covered=False, score=0.25

**Spec prompt:** _Intake interviewing_

**Assigned content:** 0 narrative + 1 supporting evidence section(s)

**Claude's summary:** The evidence shows an assignment with ethical interview practices, but lacks substantive demonstration that students are learning intake interviewing as a professional skill. A narrative explaining how intake interviewing theory, knowledge, and competencies are taught and assessed is essential, along with evidence of structured skill-building beyond family interviews.

**Strengths:**
- Assignment demonstrates attention to informed consent and confidentiality (core ethical values in intake work)
- Instructions show awareness of documentation ethics and participant protection (initials, permission, transcript use)
- Requires actual interview interaction with structured preparation

**Gaps (user must address):**
- ⚠️ No narrative explanation of how intake interviewing is taught, practiced, or assessed
- ⚠️ No evidence of structured intake interview training or curriculum content
- ⚠️ No demonstration of knowledge of intake interview theory, frameworks, or best practices
- ⚠️ No evidence of skill development in rapport-building, assessment, information gathering, or documentation
- ⚠️ No evidence of supervised practice or simulated intake interviews
- ⚠️ No rubric or assessment tool demonstrating learning outcomes for intake interviewing competency
- ⚠️ Assignment appears to be a family systems project rather than professional intake interviewing skill development
- ⚠️ No evidence of ethical/values foundation specific to intake interviewing (e.g., informed consent, cultural humility, trauma-informed approaches)
- ⚠️ Missing connection between assignment and professional social work intake interview standards

---
### `16.a` 🔴 — covered=False, score=0.15

**Spec prompt:** _Theory and knowledge bases of prevention, intervention, and maintenance strategies._

**Assigned content:** 0 narrative + 1 supporting evidence section(s)

**Claude's summary:** Provide a narrative explaining which prevention, intervention, and maintenance theories/knowledge bases are taught in this course, and submit course syllabus or curriculum map showing where theory instruction occurs. The family assignment alone is insufficient evidence without explicit connection to the three core strategy types.

**Strengths:**
- Assignment requires students to apply concepts and theories to a real-world context (family systems), indicating theory is embedded in coursework
- Includes ethical guidelines (confidentiality, informed consent, use of initials), demonstrating values integration
- Requires citation and bibliography, suggesting students engage with theoretical literature

**Gaps (user must address):**
- ⚠️ No narrative statement provided to explain how the assignment addresses prevention, intervention, and maintenance strategies
- ⚠️ Evidence describes only a family interview assignment structure; does not demonstrate how theory and knowledge bases are actually taught or applied
- ⚠️ No evidence that prevention theory (primary, secondary, tertiary) is explicitly covered
- ⚠️ No evidence that intervention strategies or their theoretical foundations are addressed
- ⚠️ No evidence that maintenance/relapse prevention strategies are included
- ⚠️ Missing evidence of which specific counseling theories or models are taught (e.g., systems theory, cognitive-behavioral, psychodynamic, etc.)
- ⚠️ Assignment instructions focus on family history collection but do not explicitly connect to prevention/intervention/maintenance competencies
- ⚠️ No syllabus, course objectives, or curriculum map provided to situate this assignment within broader theory instruction

---
### `16.b` 🔴 — covered=False, score=0.20

**Spec prompt:** _Assess and analyze the needs of clients or client groups through observation, interviewing, active listening, consultation, and research._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** This response does not adequately address Specification 16.b. The narrative describes generic counseling skills practice but provides no evidence of teaching the five specific methods (observation, interviewing, active listening, consultation, research) for assessing client needs. Submit syllabi, assignment descriptions, and rubrics demonstrating explicit instruction and assessment of needs assessment competencies.

**Strengths:**
- Narrative acknowledges hands-on practice activities and skills-based learning approach
- Mention of role-play activities shows some attempt at simulated client interaction
- Reference to active listening is present in the specification language, though not demonstrated in application to needs assessment

**Gaps (user must address):**
- ⚠️ No evidence of teaching or assessing observation skills for client needs assessment
- ⚠️ No evidence of teaching or assessing interviewing techniques for needs assessment
- ⚠️ No evidence of teaching or assessing active listening skills in client assessment context
- ⚠️ No evidence of teaching or assessing consultation skills for needs assessment
- ⚠️ No evidence of teaching or assessing research methods for client needs analysis
- ⚠️ No evidence of actual client or client group needs assessment activities (narrative describes only role-play and classroom discussion)
- ⚠️ No supporting evidence documents provided (syllabus, rubrics, assignment descriptions, or assessment tools)
- ⚠️ Narrative focuses on generic counseling skills practice rather than the specific competency of assessing/analyzing client needs
- ⚠️ No demonstration of how students learn to differentiate between individual client needs and client group needs

---
### `16.b` 🔴 — covered=False, score=0.35

**Spec prompt:** _Helping skills:_

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative describes instructional methods but does not substantively address what helping skills are taught, what theoretical foundations guide instruction, or what values are developed. Provide course syllabus, competency rubrics, learning outcomes mapping to specific skills (attending, reflecting, etc.), and evidence of theory integration and values-based instruction.

**Strengths:**
- Narrative confirms experiential/practice-based learning approach is used
- Role-play activities are explicitly mentioned as primary teaching method
- Self-reflection is incorporated as a learning tool
- Recognition that mistakes are acceptable in learning environment shows growth-oriented philosophy
- Multiple assessment modalities mentioned (role-play, discussion, reflection)

**Gaps (user must address):**
- ⚠️ No evidence of specific helping skills curriculum (e.g., which skills are taught: attending, listening, empathy, genuineness, etc.)
- ⚠️ No documentation of how theory underlying helping skills is integrated into instruction
- ⚠️ No evidence of how values (e.g., cultural humility, ethical stance, client-centered values) are explicitly taught or assessed
- ⚠️ No supporting evidence provided (syllabus, rubrics, assignment descriptions, learning outcomes)
- ⚠️ No description of skill progression or developmental sequence across the course
- ⚠️ No mention of how students demonstrate competency in actual helping skills (only participation/discussion mentioned)
- ⚠️ No reference to established helping skills models or frameworks (e.g., Ivey's microskills, person-centered approach)
- ⚠️ Assessment criteria remain vague ('willingness to try,' 'contribution') without measurable standards for skill mastery

---
### `16.c` 🔴 — covered=False, score=0.35

**Spec prompt:** _Knowledge and skill development in: 1. Case management_

**Assigned content:** 2 narrative + 1 supporting evidence section(s)

**Claude's summary:** This submission does not adequately address Specification 16.c because the core competency—case management—is missing entirely from the narrative. The program must demonstrate where and how case management (distinct from counseling skills or intake) is taught, with evidence such as course syllabi showing case management content, assignments, and learning outcomes. The supporting evidence provided is also insufficient and irrelevant to the claim.

**Strengths:**
- Narrative identifies multiple courses and attempts to map skill development across the curriculum (CHS 105, 315/515, 360, 430, 380, 440).
- Addresses three related competencies: intake interviewing, helping skills, and resources/referrals with some specificity (course objectives, assignments).
- References field placement evaluation rubric (Student Field Placement Evaluation, Section VI) as an assessment method.
- Distinguishes between didactic instruction (courses) and experiential learning (internship/practicum).

**Gaps (user must address):**
- ⚠️ CRITICAL: Case management is listed in the Specification title but ENTIRELY ABSENT from the narrative response. The response addresses only intake interviewing, helping skills, and resources/referrals—not case management itself.
- ⚠️ No evidence that case management concepts, theory, or skills are taught in any identified course (CHS 105, 315/515, 360, 430, 380, 440).
- ⚠️ No course syllabus excerpts, learning outcomes, or assignments demonstrating case management instruction (e.g., case planning, client advocacy, service coordination, caseload management).
- ⚠️ Supporting evidence provided is generic and discusses class participation format only—does not demonstrate any content delivery on case management, intake interviewing, helping skills, or resource identification.
- ⚠️ No field placement evaluation data or student work samples showing competency in case management.
- ⚠️ The narrative appears incomplete (cuts off mid-sentence under 'Identification and use of appropriate resources and referrals').

---
### `16.c` 🟡 — covered=False, score=0.45

**Spec prompt:** _Identification and use of appropriate resources and referrals. 2. Group facilitation 3. Use of consultation 7. Interpersonal Communication Context: The ability to create genuine and empathic relationships with others is central to the human services profession. These skills are applicable to all levels of education, and a greater proficiency is expected at each progressively higher level._

**Assigned content:** 2 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative adequately addresses intake interviewing and helping skills but significantly underdevelops group facilitation, consultation, and interpersonal communication as distinct competencies. Provide specific course content, assignments, and assessment data demonstrating student mastery of all four required areas, particularly group facilitation and consultation skills, with evidence of progressive complexity across course levels.

**Strengths:**
- Narrative clearly maps intake interviewing and helping skills across multiple courses (CHS 105, 315/515, 360, 430, 380, 440) with specific course objectives and requirements cited
- Field placement evaluation criteria in Section VI explicitly align with interpersonal skills and application of human services concepts
- Evidence of mentoring and evaluation by field instructors in practicum/internship settings demonstrates experiential learning
- Narrative addresses empathy and caring as values in the Student Field Placement Evaluation language ('caring, respect, empathy, and genuineness')
- Multiple course levels provide developmental scaffolding for skill building from foundational to advanced

**Gaps (user must address):**
- ⚠️ Group facilitation is mentioned in CHS 315/515 title but not explicitly addressed in the narrative response; no evidence of how students develop or practice group facilitation skills
- ⚠️ Use of consultation is not mentioned anywhere in the narrative or evidence
- ⚠️ Interpersonal communication context and the requirement to demonstrate 'genuine and empathic relationships' is addressed only generically; no specific evidence of how empathy and genuineness are taught, assessed, or demonstrated
- ⚠️ No evidence provided that directly demonstrates student learning outcomes related to resources/referrals; narrative mentions it is 'a component' but text cuts off mid-sentence
- ⚠️ Supporting evidence [Evidence 1] addresses classroom participation and discussion format but does not document actual student competency in any of the four required areas (resources/referrals, group facilitation, consultation, interpersonal communication)
- ⚠️ No assessment data, rubrics, or student work samples demonstrating proficiency in the four skill areas
- ⚠️ No evidence that 'greater proficiency is expected at each progressively higher level' as stated in the specification context

---

## Standard 17

### `17.a` 🟡 — covered=False, score=0.45

**Spec prompt:** _Clarifying expectations._

**Assigned content:** 2 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative identifies relevant courses but lacks concrete evidence of student competency assessment. Provide actual assignment rubrics, student work samples, field placement evaluation results, and a clear operational definition of 'clarifying expectations' to demonstrate mastery across the curriculum.

**Strengths:**
- Narrative demonstrates breadth of course coverage across the curriculum (10+ courses identified)
- Appropriate course sequencing identified, from foundational (CHS 101, 105) to clinical (CHS 315, 360) to applied (CHS 380, 440, 441)
- Recognition that clarifying expectations is relevant across multiple contexts (individual counseling, group work, family therapy, organizational leadership, field placements)
- Specific chapter/week references provided for some courses (e.g., CHS 360 chapters 2-6, CHS 315 weeks 5-6) showing intentional curriculum design

**Gaps (user must address):**
- ⚠️ No evidence provided demonstrating student learning outcomes or competency in clarifying expectations—only course titles and topics are listed
- ⚠️ Missing direct assessment data (assignments, rubrics, student work samples) showing students actually master clarifying expectations
- ⚠️ No evidence that clarifying expectations is explicitly defined or taught as a discrete skill with clear criteria for competency
- ⚠️ Evidence item [1] addresses course participation expectations but does not demonstrate how students learn or are evaluated on the skill of clarifying expectations itself
- ⚠️ No evidence from field placement evaluations, internship reports, or practicum supervisor feedback specifically documenting students' clarifying expectations competency
- ⚠️ Missing connection between course content and CSHSE's specific definition/expectation of what 'clarifying expectations' means in human services contexts
- ⚠️ Narrative lists courses but lacks detail on teaching methods, learning activities, or assignments that explicitly build this skill

---
### `17.b` 🟡 — covered=False, score=0.55

**Spec prompt:** _Dealing effectively with conflict._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative provides solid course mapping but lacks foundational evidence. Provide: (1) course syllabi excerpts showing specific learning outcomes for conflict competency; (2) sample assignments/rubrics demonstrating expectations; (3) the Student Field Placement Evaluation form; and (4) assessment data showing student performance on this competency.

**Strengths:**
- Identifies 10 specific courses where conflict competency is addressed across the curriculum
- Shows integration across multiple course types (foundational, clinical skills, administration, field-based)
- References both classroom instruction and field placement experiences
- Connects conflict competency to relevant contexts (therapeutic, family systems, organizational/leadership)
- Mentions multiple instructional modalities (lectures, discussions, assignments, projects, journaling)
- Includes evaluation reference suggesting competency is assessed in field placements

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content and learning outcomes
- ⚠️ No explicit definition or conceptualization of what 'dealing effectively with conflict' means in the program's human services context
- ⚠️ No description of specific learning outcomes or competencies students are expected to demonstrate related to conflict resolution
- ⚠️ No assessment data or evidence showing how students are actually evaluated on this competency or their demonstrated proficiency levels
- ⚠️ Limited detail on instructional methods beyond generic listing (e.g., what specific conflict scenarios, role plays, or case studies are used?)
- ⚠️ No mention of how conflict competency is assessed across the curriculum or integrated into field placements beyond general references
- ⚠️ Vague reference to 'Student Field Placement Evaluation' without providing the actual evaluation instrument or rubric
- ⚠️ No evidence of scaffolding or developmental progression in conflict competency from introductory to advanced courses

---
### `17.c` 🟡 — covered=False, score=0.65

**Spec prompt:** _Establishing rapport with clients._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative demonstrates thoughtful course integration but lacks critical supporting evidence. Provide actual copies of assignments, rubrics, course syllabi excerpts, assessment instruments, and aggregated student performance data showing how rapport-building competency is taught, practiced, and evaluated across the curriculum.

**Strengths:**
- Comprehensive course mapping across 9 courses shows institution recognizes rapport-building as important across the curriculum
- Narrative identifies both classroom instruction and experiential learning (field placement, practicum, internship) as delivery methods
- Specific references to relevant content areas (e.g., empathetic presence, group formation stages, diversity/cultural competence as prerequisites) demonstrate conceptual understanding
- Integration across skill progression from foundational (CHS 105) to advanced clinical courses (CHS 315, 360, 430) to field experience (CHS 380, 440, 441) shows intentional sequencing
- Mention of Student Field Placement Evaluation tool suggests an assessment instrument exists

**Gaps (user must address):**
- ⚠️ No supporting evidence provided despite extensive references to specific assignments, projects, and course materials (e.g., Immigrant Interview project, research proposal project, interview projects, Group Project Presentation, Issue Presentation assignment, Student Field Placement Evaluation)
- ⚠️ No demonstration of student learning outcomes or assessment data showing students actually achieve competency in establishing rapport
- ⚠️ No sample student work, rubrics, or evaluation instruments showing how rapport-building is measured or assessed
- ⚠️ No evidence of specific instructional methods or teaching strategies (e.g., role-play activities, skills practice, feedback mechanisms) beyond listing course names
- ⚠️ Narrative lacks clarity on whether establishing rapport is taught as a distinct, primary learning outcome versus incidentally covered within broader course topics
- ⚠️ No evidence addressing how the program ensures rapport-building competency is evaluated consistently across multiple courses and field placements

---
### `17.d` 🔴 — covered=False, score=0.00

**Spec prompt:** _Developing and sustaining behaviors that are congruent with the values and ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at https://www.nationalhumanservices.org/ethical-standards-for- hsprofessionals). 8. Administrative Context: A holistic approach to human services recognizes direct and indirect services as components of the same system. Administrative support (indirect service) is essential to the effective delivery of direct services to clients or client groups._

**Assigned content:** 3 narrative + 1 supporting evidence section(s)

**Claude's summary:** Raw response (truncated): ```json
{
  "is_covered": false,
  "coverage_score": 0.55,
  "gaps": [
    "Administrative Context requirement is NOT addressed: Specification explicitly requires explanation of how indirect services (administrative support) are essential to effective delivery of direct services; the narrative focus

**Gaps (user must address):**
- ⚠️ LLM returned non-JSON response

---

## Standard 18

### `18.a` 🟢 — covered=True, score=0.78

**Spec prompt:** _Principles of leadership and management._

**Assigned content:** 1 narrative + 1 supporting evidence section(s)

**Claude's summary:** Strengthen the evidence package by providing actual student work samples or assessment data demonstrating competency in applying leadership principles, completing the truncated course schedule, and submitting the Student Field Placement Evaluation form to verify leadership/management competencies are formally assessed in practice settings.

**Strengths:**
- Core required course (CHS 340/540) clearly identified with explicit focus on administration and management principles
- Comprehensive course schedule provided showing systematic coverage of major leadership/management topics (strategic planning, staff management, supervision, communication, conflict resolution, finances, ethical dilemmas)
- Multiple teaching strategies documented (lectures, discussions, readings, team projects, presentations) supporting active learning
- Integration across multiple courses (CHS 380, 430, 440, 441) demonstrates reinforcement of concepts in different contexts
- Field-based learning component explicitly addresses observation and practice of management in real agency settings
- Specific course requirements and assignments named (Strategic Plan Appraisal, Seeking Resources Project, field placement evaluation rubric reference)

**Gaps (user must address):**
- ⚠️ No explicit evidence that students demonstrate mastery or competency in leadership and management principles through measurable learning outcomes or assessment results
- ⚠️ Lack of specific examples or artifacts showing student application of leadership/management theory to practice (e.g., sample strategic plans, case analyses, or student work products)
- ⚠️ Limited detail on how leadership VALUES (ethical leadership, equity, social justice in management) are explicitly taught and assessed beyond a single mention of 'Ethical Dilemmas in Management'
- ⚠️ No evidence of how students evaluate or critically analyze leadership theories and models; narrative emphasizes exposure but not depth of theoretical understanding
- ⚠️ Field placement evaluation evidence cited but not actually provided; cannot verify that leadership/management competencies are formally assessed in internship/practicum settings
- ⚠️ Incomplete course schedule (April 22-24 entry cuts off mid-sentence); appears missing final course topics and outcomes

---
### `18.b` 🟡 — covered=False, score=0.45

**Spec prompt:** _Human resources and volunteer management._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide syllabi for CHS 340/540 and other listed courses, course assignment descriptions/rubrics, student work samples, the Student Field Placement Evaluation form, and evidence of student competency (e.g., sample evaluations or capstone reflections). Strengthen narrative by explicitly connecting course content to the four required components: knowledge (theories/frameworks), theory (HR models), skills (specific competencies), and values (ethical/humanistic principles).

**Strengths:**
- Narrative identifies a primary course (CHS 340/540) with multiple instructional methods (lectures, discussions, readings, media, assignments, projects)
- Narrative maps coverage across multiple courses (CHS 340/540, 430, 380, 440, 441), suggesting integrated approach
- Narrative includes both classroom and field-based learning experiences
- Specific course requirements mentioned (Team Project/Strategic Plan, Seeking Resources Project) suggest structured assignments
- Field placement evaluation process and student reflection (poster presentation in CHS 441) indicate some assessment mechanism

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignment descriptions, rubrics, student work samples) to verify claims about course content and learning outcomes
- ⚠️ Narrative does not explicitly address 'knowledge' component: no mention of what theories, frameworks, or HR management models students learn
- ⚠️ Narrative does not explicitly address 'theory' component: no reference to specific HR or volunteer management theories or conceptual approaches taught
- ⚠️ Narrative does not explicitly address 'skills' component: no concrete description of which HR/volunteer management skills students actually demonstrate or practice
- ⚠️ Narrative does not explicitly address 'values' component: no mention of values related to ethical HR practices, equity, or humane treatment of staff/volunteers
- ⚠️ No evidence that volunteer management is meaningfully integrated—volunteers mentioned only briefly in context of funding strategies and organizational humanization, without depth
- ⚠️ Field placement evaluation referenced but not provided; cannot verify whether supervision and HR competencies are actually assessed
- ⚠️ No student learning outcomes or evidence of student competency demonstration (e.g., assignments, evaluations, capstone work samples)
- ⚠️ Unclear what 'depth' means in CHS 340/540 without access to actual course materials or student deliverables

---
### `18.c` 🟡 — covered=False, score=0.55

**Spec prompt:** _Grant writing, fundraising, and other funding sources._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Narrative adequately outlines course placement and teaching methods, but lacks any supporting documentation. Submit syllabi excerpts, assignment descriptions, rubrics, student grant proposal samples, and assessment data (e.g., grades on Seeking Resources Project, field placement evaluation summaries) to validate coverage claims. Clarify what 'other funding sources' beyond grants are being taught.

**Strengths:**
- Narrative identifies specific courses (CHS 224, 340/540, 380, 440, 441) where content is addressed, showing systemic integration across curriculum
- Multiple pedagogical approaches mentioned (lecture, discussion, in-class activities, readings, assignments, field experience), suggesting varied instructional methods
- CHS 340/540 explicitly named as primary course with 'Seeking Resources Project' as major assignment, indicating intentional focus
- Connection between research skills (CHS 224) and grant narrative writing demonstrates understanding of grant-writing foundations
- Field placement component suggests real-world exposure to organizational funding challenges

**Gaps (user must address):**
- ⚠️ No supporting evidence provided despite narrative citing multiple courses, assignments, and evaluations (e.g., course schedules, 'Seeking Resources Project' syllabus materials, Student Field Placement Evaluation Section III, grant proposal examples)
- ⚠️ No demonstration of student learning outcomes or competency mastery in grant writing—narrative describes exposure only, not assessment of whether students can actually write grants or identify funding sources
- ⚠️ No evidence of coverage of 'other funding sources' beyond grant writing—diversified funding landscape (donations, crowdfunding, corporate sponsorship, government contracts, fee-for-service) is not explicitly addressed
- ⚠️ No sample student work (grant proposals, fundraising plans, funding analysis assignments) provided to substantiate claims about grant writing instruction in CHS 224 and CHS 340/540
- ⚠️ Internship/practicum experience (CHS 380, 440, 441) described as observation-based only—no evidence of direct student participation in or assessment of fundraising competency
- ⚠️ No rubrics, assignment descriptions, or evaluation tools provided to verify that grant writing and funding source identification are formally assessed

---
### `18.d` 🟡 — covered=False, score=0.55

**Spec prompt:** _Legal, ethical, and regulatory issues, and risk management._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide syllabi, course schedules, assignment rubrics, and student field placement evaluation forms that directly demonstrate content coverage. Include at least one concrete example of how students develop and demonstrate competency in legal/ethical/risk management knowledge, theory, skills, and values.

**Strengths:**
- Identifies a clear primary course (CHS 340/540) with stated focus on legal, ethical, and regulatory issues
- Shows broad curricular integration across 7 courses (CHS 224, 340/540, 430, 380, 440, 441)
- Recognizes multiple instructional methods (lectures, discussions, readings, media, activities, field placement)
- Includes field placement component with mention of mentor evaluation and student reporting mechanisms
- Acknowledges specific topic areas (research ethics, management ethics, board governance)

**Gaps (user must address):**
- ⚠️ No supporting evidence provided despite narrative citing specific course materials (course objectives, schedules, assignments, evaluation forms, projects); claims cannot be verified
- ⚠️ Specification requires demonstration of student KNOWLEDGE, THEORY, SKILLS, and VALUES—narrative addresses only courses/activities but provides no evidence of what students actually learn or demonstrate
- ⚠️ No documentation of specific legal/ethical/regulatory content taught (e.g., HIPAA, duty to warn, confidentiality, informed consent, licensing law)
- ⚠️ No evidence of how risk management is taught or assessed; narrative mentions it passively ('may be observed and practiced') without demonstrating intentional curriculum design
- ⚠️ Values component largely absent; narrative focuses on knowledge/skills through courses but doesn't show how ethical values are developed or assessed
- ⚠️ Field placement evaluation cited but not provided; cannot verify whether legal/ethical/risk management competencies are actually assessed in internship/practicum
- ⚠️ No syllabus excerpts, assignment examples, or rubrics showing explicit alignment between course objectives and this specification
- ⚠️ Vague language ('may be observed,' 'are introduced to') suggests incidental rather than intentional coverage

---
### `18.e` 🟡 — covered=False, score=0.45

**Spec prompt:** _Budget and financial management. 9. Client-Related Values and Attitudes Context: There are values and ethics intrinsic to the human services profession that have been agreed to as governing principles of professional practice._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Reframe narrative to explicitly address the 'values and ethics' dimension of budgeting and financial stewardship (not just mechanics), and provide concrete supporting evidence: course syllabi showing budget/financial management learning outcomes, assignment rubrics, student work examples, and field placement evaluation data demonstrating competency.

**Strengths:**
- Narrative identifies multiple courses (CHS 224, 340/540, 380, 440, 441) where topic appears, suggesting curriculum integration across the program
- CHS 340/540 Administration course and 'Seeking Resources Project' appear to be dedicated structures for this content
- Includes both classroom learning (lecture, readings, discussion) and experiential learning (fieldwork, agency observation), providing varied pedagogical approaches
- Recognition that students engage in financial operations 'depending on placement site' acknowledges real-world application

**Gaps (user must address):**
- ⚠️ No supporting evidence provided (syllabus excerpts, assignments, rubrics, student work samples) to verify that budget/financial management is actually taught or assessed
- ⚠️ Specification requires addressing 'Client-Related Values and Attitudes' and 'professional values and ethics' intrinsic to human services—narrative focuses entirely on technical budget/financial skills with no mention of ethical dimensions, fiduciary responsibility to clients, or values-based decision-making in resource allocation
- ⚠️ No evidence that students learn about ethical conflicts in budgeting (e.g., allocating limited resources equitably, advocacy when budgets harm vulnerable populations, ethical grant-seeking practices)
- ⚠️ No assessment data showing student competency in budget/financial management; no documentation of learning outcomes, grades, or mastery on this topic
- ⚠️ Field placement reporting is mentioned but not provided; unclear if CHS 441 poster presentations actually address financial management or how this is evaluated
- ⚠️ No evidence of how courses integrate the professional values/ethics context mentioned in the Specification's preamble

---

## Standard 19

### `19.a` 🟡 — covered=False, score=0.45

**Spec prompt:** _The least intrusive intervention in the least restrictive environment._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide substantive supporting documentation (syllabi excerpts showing learning outcomes, assignment rubrics, student work samples, and completed field evaluations) that demonstrate how students actually learn, practice, and are assessed on selecting least intrusive/least restrictive interventions. The narrative needs concrete operational definitions and measurable evidence of student competency.

**Strengths:**
- Narrative identifies multiple course touchpoints (8 courses listed) where the principle is addressed
- Distinguishes between foundational courses (CHS 105, 224) and applied/clinical courses (CHS 315/515, 360, 430, 380, 440, 441)
- Mentions field placements and mentorship as venues for observation and practice
- References specific course components (assignments, discussions, readings) suggesting intentional integration

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (course syllabi, assignments, rubrics, student work samples, field evaluation forms) to verify claims
- ⚠️ Vague description of how the principle is 'taught' lacks specificity about learning outcomes, competency demonstration, or assessment methods
- ⚠️ No explanation of what 'least intrusive intervention in the least restrictive environment' means in the program's context or how it's operationalized
- ⚠️ No evidence that students demonstrate mastery of this principle before graduation
- ⚠️ Field Placement Evaluation (Section III) mentioned but not provided; cannot verify if it actually assesses this competency
- ⚠️ No description of how this principle is integrated across the curriculum or reinforced progressively
- ⚠️ Missing evidence of how clinical faculty model or teach decision-making processes for selecting appropriate intervention levels
- ⚠️ No student examples, case studies, or portfolio evidence showing application of this principle

---
### `19.b` 🟡 — covered=False, score=0.45

**Spec prompt:** _Client self-determination._

**Assigned content:** 2 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide all cited course materials (syllabi, schedules, assignments), the referenced Student Field Placement Evaluation form (Section III), and examples of student work or field evaluations demonstrating competency in obtaining informed consent and respecting client self-determination across the curriculum.

**Strengths:**
- Narrative identifies multiple courses across the curriculum (CHS 105, 224, 315/515, 360, 380, 430, 440, 441) where self-determination is addressed
- Recognizes clinical skills courses as primary venues for self-determination instruction and practice
- Acknowledges that students are mentored and evaluated in field placements on professional attitudes and behaviors related to self-determination
- Connects self-determination to broader human services principles (informed consent, legal considerations)

**Gaps (user must address):**
- ⚠️ No evidence provided despite narrative citing multiple course materials (syllabi, schedules, assignments, evaluation forms) — claims are unsubstantiated
- ⚠️ Narrative does not address informed consent procedures, which is explicitly required by Standard 2 and central to client self-determination
- ⚠️ No documentation of how students learn to obtain informed consent at the beginning of helping relationships
- ⚠️ Missing evidence that students understand clients' right to withdraw consent and exceptions (e.g., court orders)
- ⚠️ No evidence addressing how students handle consent for clients unable to provide it themselves or involving legally authorized representatives
- ⚠️ Narrative lists courses but provides no syllabi, assignment descriptions, rubrics, or field evaluation forms to verify content
- ⚠️ No examples of student work, case studies, or field instructor evaluations demonstrating competency in self-determination practices
- ⚠️ Internship/practicum evaluation form referenced (Student Field Placement Evaluation, Section III) is not attached

---
### `19.c` 🟡 — covered=False, score=0.65

**Spec prompt:** _Confidentiality of information._

**Assigned content:** 5 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative adequately addresses WHERE confidentiality is taught but inadequately addresses WHAT is taught regarding limits of confidentiality, exceptions, and HIPAA specifics. Add evidence of curriculum content on informed consent about confidentiality limits, legal exceptions, PHI handling procedures, and written consent processes for information sharing with third parties.

**Strengths:**
- Confidentiality is addressed across multiple courses (CHS 105, 224, 315/515, 360, 380, 430, 440, 441) demonstrating integration throughout curriculum
- Field placement evaluation includes assessment of confidentiality competency by field instructors (Student Field Placement Evaluation, Section III)
- Clinical skills courses (360, 315/515, 430) explicitly cover confidentiality in context-specific ways (individual, group, family)
- Research methods course (CHS 224) includes confidentiality in research proposal requirements
- Policy excerpt establishes clear prohibition on using client names in class or written materials
- HIPAA agreement framework is present in institutional documentation

**Gaps (user must address):**
- ⚠️ No evidence that students are informed of the LIMITS OF CONFIDENTIALITY prior to onset of helping relationship (required by STANDARD 3 and the confidentiality policy excerpt)
- ⚠️ No evidence of instruction on exceptions to confidentiality (serious harm to client/others, agency guidelines, legal obligations) required by STANDARD 3
- ⚠️ No evidence of training on HIPAA compliance specifics, Protected Health Information (PHI) handling, or the accounting of disclosures process mentioned in the supporting document
- ⚠️ No evidence of assessment/evaluation methods to verify student competency in maintaining confidentiality beyond field instructor evaluation
- ⚠️ No evidence of written consent procedures for sharing client information with other professionals, as required by STANDARD 8
- ⚠️ No evidence of training on security and integrity of electronic client records or data protection protocols

---
### `19.d` 🟡 — covered=False, score=0.45

**Spec prompt:** _The worth and uniqueness of individuals based on intercultural fluency, including how they identify and the cultural groups to which they belong._

**Assigned content:** 2 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide course syllabi, assignment rubrics, and representative student work samples—particularly from CHS 220 and the immigrant interview project—to verify that instruction moves beyond diversity awareness to demonstrated intercultural fluency. Include the Student Field Placement Evaluation tool and sample evaluations showing how cultural competency is assessed in practice.

**Strengths:**
- Comprehensive course mapping shows multiple touchpoints across the curriculum (9+ courses listed)
- Clinical skills courses (315/515, 360, 430) explicitly integrate cultural sensitivity into practice-based learning
- Field placement component (380, 440, 441) embeds worth/uniqueness as operational principle with instructor evaluation
- CHS 220 course appears specifically designed to address diversity and cultural competence with named assignments
- Recognition that research ethics (CHS 224) must uphold dignity of diverse subjects shows integration across domains

**Gaps (user must address):**
- ⚠️ No evidence provided to verify claims—narrative alone without syllabi, assignments, rubrics, or student work samples
- ⚠️ Missing explicit connection to 'intercultural fluency' as defined in the specification; narrative addresses diversity awareness but not the developmental skill of intercultural fluency
- ⚠️ No demonstration of how students develop competence in *understanding and navigating* cultural differences (fluency implies active skill, not just awareness of diversity categories)
- ⚠️ No assessment data showing students actually achieve this competency; Field Placement Evaluation is cited but not provided
- ⚠️ Immigrant interview assignment description is incomplete—lacks clarity on how it develops intercultural fluency vs. one-time exposure
- ⚠️ Missing articulation of how the program ensures students can *identify how individuals identify culturally* and understand group belonging—focuses on categories rather than individual cultural identity development

---
### `19.e` 🟡 — covered=False, score=0.45

**Spec prompt:** _Belief that individuals, service systems, and society can change._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide actual course syllabi excerpts, assignment descriptions, and evaluation rubrics that explicitly connect learning activities to belief in change. Include at least one student artifact (reflection, assessment result) demonstrating that students have developed this belief/value, and clarify how affective learning outcomes differ from cognitive or skill-based outcomes.

**Strengths:**
- Narrative identifies 10+ relevant courses across the curriculum, showing breadth of exposure to change-related content
- Mentions multiple pedagogical methods (lectures, discussions, readings, assignments, field placements) that could support belief development
- Connects belief to concrete contexts (individual counseling, group work, family therapy, administration, internship) showing integration across program
- References clinical skills courses and field placement experiences, which are appropriate venues for values development
- Acknowledges that field instructors evaluate students on change-related characteristics (though evaluation tool not provided)

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (course syllabi, assignments, rubrics, student work samples) to substantiate claims about how belief in change is actually taught and assessed
- ⚠️ Narrative lists courses but provides minimal detail on WHAT specific content, activities, or assignments demonstrate this belief—references are vague (e.g., 'readings, lectures, discussions' without naming them)
- ⚠️ No evidence of explicit learning outcomes or competency statements that operationalize 'belief that individuals, service systems, and society can change'
- ⚠️ Missing demonstration of how students are evaluated or assessed on this belief/value; Field Placement Evaluation is mentioned but not provided
- ⚠️ No evidence that this belief is embedded in course design intentionally (e.g., syllabus language, assignment rubrics with criteria related to change-orientation)
- ⚠️ Unclear how 'belief' (an affective/values domain) is distinguished from knowledge or skills in curriculum; no evidence of values-based instruction or reflection
- ⚠️ No student artifacts, reflections, or assessment data showing that students actually develop or demonstrate this belief

---
### `19.f` 🟡 — covered=False, score=0.55

**Spec prompt:** _Interdisciplinary team approaches to problem solving._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide actual supporting documents (course syllabi showing interdisciplinary learning objectives, sample assignments requiring interdisciplinary problem-solving, student work examples, and field placement evaluation forms) that concretely demonstrate how students learn and are assessed on interdisciplinary team competencies rather than course listings alone.

**Strengths:**
- Narrative identifies 9 courses that address the competency, showing breadth across the curriculum
- Specific course objectives and assignments are mentioned (team research project in CHS 105, research proposal in CHS 224, group assignments in CHS 430)
- Internship, practicum, and seminar courses (CHS 380, 440, 441) explicitly involve field-based interdisciplinary team participation with faculty evaluation
- References to evaluation tools (Student Field Placement Evaluation) suggest systematic assessment exists
- Progression from classroom activities to applied field experiences shows developmental approach

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (course syllabi, assignments, rubrics, student work samples, field placement evaluations referenced in narrative)
- ⚠️ Narrative lists courses but provides minimal concrete detail on what 'interdisciplinary team approaches' actually means or how students learn to solve problems using this method
- ⚠️ No evidence of how students learn to identify when interdisciplinary approaches are needed or how to navigate role conflicts/professional boundaries across disciplines
- ⚠️ No documentation of learning outcomes assessment data showing students can actually apply interdisciplinary problem-solving
- ⚠️ Vague references to 'group assignments' and 'field placement experiences' without specific examples of interdisciplinary team problems students solved
- ⚠️ No evidence demonstrating students work with actual professionals from other disciplines (e.g., social workers, counselors, medical professionals, educators) rather than just peer group work
- ⚠️ Missing clarity on how the program teaches conflict resolution, communication protocols, or coordination strategies essential to interdisciplinary teamwork

---
### `19.g` 🟡 — covered=False, score=0.45

**Spec prompt:** _Appropriate professional boundaries._

**Assigned content:** 4 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide syllabi excerpts, assignment descriptions, student work samples, and completed field placement evaluations showing how professional boundaries (including Standards 4, 5, and 19) are explicitly taught, practiced, and assessed. Without supporting evidence, the narrative's course listings cannot be verified.

**Strengths:**
- Narrative identifies a comprehensive breadth of courses (10 courses listed) where professional boundaries are addressed
- Recognition that professional boundaries appear in multiple contexts: research ethics, group work, individual counseling, family therapy, and agency administration
- Acknowledges that field placement includes observation, practice, and evaluation of professional boundaries
- Connects professional boundaries to related competencies (cultural competence, clinical skills)
- Attempts to show integration across curriculum rather than isolated coverage

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, evaluations) to verify claims made in narrative
- ⚠️ Narrative lists courses but provides no concrete examples of what 'appropriate professional boundaries' instruction actually entails
- ⚠️ No evidence of student learning outcomes or assessments demonstrating students can identify and apply professional boundary concepts
- ⚠️ Standard 5 (dual/multiple relationships and impaired judgment) is not explicitly addressed in narrative
- ⚠️ Standard 4 (duty to warn/protect safety, breaking confidentiality) is mentioned only vaguely; no specific instruction or assessment shown
- ⚠️ Standard 19 (avoiding duplicate helping relationships, collaboration with other professionals) is not directly addressed in narrative
- ⚠️ Field Placement Evaluation form is referenced but not provided; cannot verify Section III and V actually assess professional boundaries
- ⚠️ No evidence of how professional boundaries are taught differently across skill levels (105 foundational vs. 440/441 advanced)
- ⚠️ Missing specific examples of student assignments, projects, or case studies that demonstrate boundary-setting skills
- ⚠️ No data on student performance or mastery of boundary concepts across the curriculum

---
### `19.h` 🟡 — covered=False, score=0.45

**Spec prompt:** _Integration of the ethical standards outlined by the National Organization for Human Services/Council for Standards in Human Service Education (available at 10. Self-Development Context: Human services professionals use their experience and knowledge to understand and help clients. This requires awareness of one’s values, cultural bias, philosophies, personality, and style in the effective use of the professional self. It also requires an understanding of how these personal characteristics affect clients._

**Assigned content:** 3 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative addresses WHAT courses cover NOHS ethics but fails to address the 'Self-Development Context' requirement—students' awareness of their own values, biases, and personal characteristics and how these affect clients. Provide evidence (syllabi, assignment examples, evaluation tools, student reflections) showing how students engage in self-reflection, receive feedback on personal biases, and develop professional self-awareness across the curriculum, particularly in clinical and field-based courses.

**Strengths:**
- Narrative clearly identifies that NOHS ethical standards are integrated across multiple courses throughout the curriculum (CHS 105, 220, 224, 315/515, 360, 430, 340, 380, 440, 441)
- Acknowledges that ethical standards are addressed through multiple modalities (readings, lectures, discussions, assignments, media, field experiences)
- Connects ethical standards to field placement with mention of student evaluation on 'professional attitudes and behaviors related to ethical behaviors'
- Shows intentional incorporation of ethics into student handbook and acknowledgment requirement at program entry
- Identifies behavioral indicators (3.D.) as prerequisites for field experiences, suggesting competency-based progression

**Gaps (user must address):**
- ⚠️ No evidence of how students develop AWARENESS OF THEIR OWN VALUES, CULTURAL BIAS, PHILOSOPHIES, PERSONALITY, AND STYLE—the core of the 'Self-Development Context' requirement
- ⚠️ Missing demonstration of how students understand HOW THEIR PERSONAL CHARACTERISTICS AFFECT CLIENTS, a key element of the specification
- ⚠️ No supporting documentation provided (course syllabi, assignments, evaluation rubrics, student work samples) to verify claims about ethical integration
- ⚠️ Narrative lists course names but does not explain WHAT STUDENTS ACTUALLY DO to develop self-awareness or reflective practice
- ⚠️ No mention of reflective journals, self-assessments, personality inventories, supervision reflections, or other mechanisms for self-development
- ⚠️ Missing evidence of how educators model ethical behavior and self-awareness (STANDARD 43 connection not demonstrated)
- ⚠️ No documentation of field placement supervision that includes self-reflection on personal biases and their impact on client work
- ⚠️ Lacks evidence of how CHS 220 (Diversity) specifically addresses students' own cultural biases and self-awareness, not just knowledge of others' cultures

---

## Standard 20

### `20.a` 🔴 — covered=False, score=0.35

**Spec prompt:** _Conscious use of self._

**Assigned content:** 2 narrative + 0 supporting evidence section(s)

**Claude's summary:** Resubmit with actual course syllabi, assignment descriptions, rubrics, and student work samples demonstrating how conscious use of self is taught and assessed. Remove the irrelevant personal reflection paragraph and provide a clear definition of 'conscious use of self' aligned with CSHSE standards. Include evidence of specific competencies students achieve (e.g., self-awareness, impact on helping relationships, cultural humility).

**Strengths:**
- Narrative identifies multiple courses across the curriculum that address conscious use of self, showing breadth of integration
- Specific course objectives are cited (e.g., CHS 105 objectives #4 and #6) that relate to self-awareness and values clarification
- Recognition that conscious use of self applies across contexts: clinical skills, research, administration, and field practice
- References to reflective practices (journaling, portfolios, reflection papers) which are appropriate pedagogies for developing self-awareness
- Acknowledges self-assessment tools and mentoring/feedback from field instructors as mechanisms for growth

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, assignments, rubrics, student work samples) to verify claims about course content and learning outcomes
- ⚠️ Narrative lacks explicit definition or conceptual framework for 'conscious use of self' as required by CSHSE standards
- ⚠️ No demonstration of how students actually develop self-awareness competencies (e.g., through what specific pedagogical methods or assessments)
- ⚠️ Missing evidence of assessment/evaluation of students' conscious use of self (no rubrics, evaluation tools, or performance data cited)
- ⚠️ The second paragraph is irrelevant personal reflection on implicit bias and appears to be incorrectly pasted student work, not institutional documentation
- ⚠️ No evidence showing how students integrate self-awareness into direct service delivery with clients/populations
- ⚠️ Vague references to assignments (e.g., 'process analysis paper,' 'interview papers,' 'reflection paper') without actual documents or evidence of how these assess conscious use of self
- ⚠️ No clarity on how field placement evaluations (mentioned as Section II) actually measure or reinforce conscious use of self

---
### `20.b` 🟡 — covered=False, score=0.65

**Spec prompt:** _Clarification of personal and professional values._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative demonstrates a comprehensive curricular approach to values clarification across the program, but lacks supporting evidence (course syllabi, assignments, evaluation rubrics, student artifacts) needed to verify these claims. Resubmit with attached documents and complete the narrative sentence that cuts off mid-phrase.

**Strengths:**
- Narrative clearly maps values clarification across multiple courses (CHS 105, 220, 224, 315/515, 360, 380, 430, 440, 441) with specific course objectives cited
- Identifies multiple pedagogical strategies (journaling, portfolios, reflection papers, cultural autobiography, genograms, process analysis) used to facilitate values work
- CHS 220 specifically addresses values in cultural context, which is crucial for human services
- Field placement component (CHS 380/440/441) integrates values clarification into authentic practice settings with mentor feedback
- Course objectives are concrete and measurable (e.g., CHS 105 #6: 'specify how his/her personal values and goals relate to a career')

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabus excerpts, assignment rubrics, student work samples, or evaluation tools referenced in narrative are missing)
- ⚠️ Narrative cuts off mid-sentence at the end ('Students also evaluate themselves using th...'), suggesting incomplete submission
- ⚠️ No explicit evidence that values clarification addresses the full range of professional contexts (e.g., ethical dilemmas, value conflicts with clients, professional boundaries)
- ⚠️ Claims about field placement evaluation (Student Field Placement Evaluation, Section II) and self-assessment tools are referenced but not attached
- ⚠️ No evidence demonstrating how students integrate personal values clarification into actual practice decisions or case conceptualization
- ⚠️ Missing evidence of how the program addresses value clarification across diverse student populations and worldviews

---
### `20.c` 🔴 — covered=False, score=0.00

**Spec prompt:** _Awareness of intercultural fluency as outlined in Standard 19.d._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** The institution must provide both a narrative description of how the program builds student awareness of intercultural fluency (per Standard 19.d) and concrete supporting evidence such as course syllabi, learning outcomes, assignments, or assessment data demonstrating student achievement in this area.

**Gaps (user must address):**
- ⚠️ No narrative explanation provided addressing intercultural fluency awareness
- ⚠️ No supporting evidence submitted to demonstrate student learning or program content related to intercultural fluency
- ⚠️ No reference to Standard 19.d competencies or how they are integrated into curriculum
- ⚠️ No demonstration of how students develop awareness of cultural differences, communication styles, or perspectives
- ⚠️ No evidence of assessment methods measuring intercultural fluency outcomes
- ⚠️ No documentation of course content, learning activities, or experiences designed to build intercultural competency

---
### `20.d` 🟡 — covered=False, score=0.55

**Spec prompt:** _Strategies for self-care._

**Assigned content:** 1 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative provides good programmatic breadth but fails the fundamental accreditation requirement of providing supporting evidence. Attach syllabus excerpts, assignment descriptions, evaluation rubrics, and sample student work demonstrating self-care strategy acquisition. Additionally, explicitly define which self-care strategies are taught and provide assessment data confirming student learning.

**Strengths:**
- Narrative demonstrates integration across multiple courses (8 courses cited) showing programmatic approach rather than isolated coverage
- Identifies both classroom and field-based experiential learning (journaling, reflection papers, mentoring, field instructor evaluation)
- Acknowledges the interconnection between self-awareness and self-care development
- Specific course objectives quoted (e.g., CHS 380 Objective 2) provide some structure to claims
- Mentions evaluation of self-care behaviors in field placements through Student Field Placement Evaluation tool
- Addresses both didactic (lecture, readings, media) and experiential (journaling, portfolio, seminar) modalities

**Gaps (user must address):**
- ⚠️ No supporting evidence provided despite extensive narrative claims; all evidence documents referenced (syllabus schedules, assignments, evaluation forms, reflection papers) are absent
- ⚠️ Narrative lacks explicit definition or description of what 'strategies for self-care' actually means in the counseling/human services context
- ⚠️ No demonstration of learning outcomes—unclear whether students actually develop or master self-care strategies or if activities merely expose them to the concept
- ⚠️ Missing concrete examples of self-care strategies taught (e.g., boundary-setting, stress management techniques, mindfulness, supervision seeking, peer support, etc.)
- ⚠️ No evidence of assessment results showing students gained knowledge or skills in self-care strategies
- ⚠️ Vague references to 'reflection,' 'self-awareness,' and 'discussions' without clarity on what self-care competencies are being developed
- ⚠️ CHS 224 mentioned in opening sentence but never addressed in narrative detail

---
### `20.e` 🔴 — covered=False, score=0.00

**Spec prompt:** _Reflection on professional self (e.g., journaling, development of a portfolio, or project demonstrating competency)._

**Assigned content:** 12 narrative + 2 supporting evidence section(s)

**Claude's summary:** Raw response (truncated): ```json
{
  "is_covered": true,
  "coverage_score": 0.78,
  "gaps": [
    "No clear evidence that portfolios are evaluated using a standardized rubric aligned to professional self-reflection competencies; the data table provided shows sociology concepts rubric, not professional self-reflection rubri

**Gaps (user must address):**
- ⚠️ LLM returned non-JSON response

---

## Standard 21

### `21.a` 🟢 — covered=True, score=0.82

**Spec prompt:** _Provide a brief description of the overall process and structure of the fieldwork learning experience._

**Assigned content:** 6 narrative + 1 supporting evidence section(s)

**Claude's summary:** The narrative adequately describes the overall structure, timeline, and learning activities for field experiences, but should be strengthened by adding details on student prerequisites/eligibility criteria, faculty supervisor roles and responsibilities, placement quality assurance processes, and a grading/evaluation rubric. Complete the cut-off sentence regarding employed students and include the referenced student reflection table.

**Strengths:**
- Clear timeline: two-tiered structure with 90-hour internship (junior year) followed by 410-hour practicum (senior year)
- Well-defined concurrent seminar components (CHS 380 with weekly meetings; CHS 441 for practicum reflection)
- Specific learning activities identified: journaling, portfolio development, process recordings, taped interviews, and capstone presentations with external sources
- Explicit description of Field Placement Coordinator's role in matching students with agencies
- Approval process clearly stated: all placements must be approved by Field Placement Coordinator
- Concrete examples of actual placement sites across multiple data points (Sheppard Pratt, St. Vincent's, House of Ruth, Kennedy Krieger, etc.)
- Distinction between internship and practicum roles articulated (entry-level staff functioning in practicum)
- Supporting data on student enrollment numbers in field experiences over multiple reporting periods

**Gaps (user must address):**
- ⚠️ No description of how students are selected or admitted into field experiences (prerequisites, GPA requirements, etc.)
- ⚠️ Lacks detail on the role and responsibilities of faculty supervisors beyond 'journaling'
- ⚠️ No information on how placements are evaluated or assessed for quality and appropriateness
- ⚠️ Missing description of student evaluation/grading criteria for internship and practicum
- ⚠️ No explanation of how the program ensures consistency across diverse placement sites
- ⚠️ Incomplete sentence at end of narrative ('their current posit') suggests document was cut off
- ⚠️ Evidence item (table with student reflections) is mentioned but actual student responses are not provided
- ⚠️ No description of orientation or preparation students receive before entering placements

---
### `21.b` 🟡 — covered=False, score=0.55

**Spec prompt:** _Provide evidence that one academic credit is awarded for no less than three hours of field experience per week._

**Assigned content:** 3 narrative + 0 supporting evidence section(s)

**Claude's summary:** Strengthen this response by attaching institutional documentation (registrar policy, field placement syllabus, student transcript examples) that verifies the stated credit-to-hours conversion is actually implemented. The narrative alone, while logically sound, lacks the supporting evidence needed for accreditation review.

**Strengths:**
- Narrative clearly articulates the credit-to-hours formula: one credit = 3 hours/week for 15 weeks (45 hours total)
- Multiple field experience options are described with specific hour and credit configurations (internship 90 hours = 2 credits; practicum 410 hours = 9 credits; practicum 540 hours = 12 credits)
- Response addresses curriculum changes in response to student feedback, showing intentional program review
- Mathematical calculations are transparent and verifiable (e.g., 27 hours/week × 15 weeks = 410 hours = 9 credits)

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (syllabi, credit hour policies, student transcripts, field placement agreements) to verify the stated credit-to-hours conversion
- ⚠️ No documentation showing institutional policy or registrar confirmation that one academic credit equals three hours of field experience per week
- ⚠️ No sample student records or transcript examples demonstrating actual credit awards aligned with field experience hours
- ⚠️ Narrative lacks clarity on how the 'one credit for meeting in class one hour per week' fits within the specification's field experience requirement
- ⚠️ No evidence that the conversion ratio (3 hours field work = 1 credit) is consistently applied across all field placements
- ⚠️ Missing documentation of field placement agreements or contracts that specify hour requirements and corresponding credit awards

---
### `21.c` 🟢 — covered=True, score=0.78

**Spec prompt:** _Demonstrate that students are exposed to human services agencies and clients (assigned visitation, observation, assisting staff, etc.) early in the program._

**Assigned content:** 5 narrative + 0 supporting evidence section(s)

**Claude's summary:** Strengthen this submission by providing supporting evidence (CHS 217 syllabus, agency partnership agreements, student reflection samples) and clarifying the program timeline to explicitly show when field experiences occur relative to program entry. Replace the meeting notes section with formal documentation of active agency partnerships and their current status.

**Strengths:**
- Clear identification of CHS 217 as an early, required course with structured agency visitation and interview components
- Demonstrates multiple pathways for field exposure across different courses (CHS 220, CHS 360) beyond a single capstone experience
- Provides specific examples of agency partnerships and placement types (Sheppard Pratt, Target, Johns Hopkins, Project Search, counseling groups)
- Includes concrete student deliverables (oral/written reports, audio recordings, journals, timesheets) demonstrating active engagement beyond observation
- Describes both observation/visitation (early exposure) and direct service/client contact (deeper engagement) on a continuum

**Gaps (user must address):**
- ⚠️ No explicit evidence provided (e.g., course syllabi, agency partnership agreements, student reflection samples) to corroborate the narrative claims about field experiences
- ⚠️ Unclear definition of 'early in the program' — no specification of which semester(s) or year students begin field exposure relative to total program length
- ⚠️ Limited detail on direct client contact — interviews and observations described but depth and quality of client exposure not quantified
- ⚠️ Human Services Club participation noted as 'not a requirement' which weakens the claim that all students are exposed early; reliance on optional activities
- ⚠️ Second section appears to be meeting notes or draft planning language rather than established program documentation, creating ambiguity about which agencies are currently active partners
- ⚠️ Service learning hours (15-20) and volunteer placements mentioned but not clearly linked to timing within the program sequence or whether this occurs 'early'

---
### `21.d` 🟡 — covered=False, score=0.45

**Spec prompt:** _Provide a copy of the current manual and guidelines that are given to students advising them of field placement requirements and policies._

**Assigned content:** 7 narrative + 4 supporting evidence section(s)

**Claude's summary:** The submission references a Field Placement Handbook but does not provide the actual document for reviewer verification. Provide the complete, current Field Placement Handbook and relevant sections from the CHS Student Handbook as standalone attachments to fully satisfy this specification, which explicitly requires 'a copy of the current manual and guidelines.'

**Strengths:**
- Narrative clearly identifies the Field Placement Handbook as the primary resource given to students and notes it is revised yearly
- Field Agency Participation expectations are detailed in narrative (attendance, policies, professional behavior, notification procedures)
- Evidence 1 provides concrete timeline/schedule of field placement requirements and key dates, demonstrating operational procedures
- Evidence 2 documents time-tracking requirements and communication protocols for absences
- Narrative explains eligibility assessment, agency approval process, and interview requirements (differentiated by internship vs. practicum)
- Paid placement and current employment policies are explicitly stated in narrative

**Gaps (user must address):**
- ⚠️ The actual Field Placement Handbook document itself is NOT provided in the evidence—only a reference to it being 'attached' (Evidence 3), but the handbook content is not visible for review
- ⚠️ No copy of the CHS Student Handbook section on field placements is provided, despite narrative claiming field placement information is found there
- ⚠️ Specific field placement requirements (e.g., minimum hours, duration, timing, course prerequisites) are referenced but not systematically documented in a single manual/guideline format
- ⚠️ Field placement policies regarding dismissal, remediation, or failure criteria are not addressed in narrative or evidence
- ⚠️ Grievance procedures specific to field placements are mentioned as being in the university catalog but not provided as a standalone document
- ⚠️ No documentation of what constitutes 'professional behavior' standards beyond the brief narrative mention of punctuality, dress, and confidentiality

---
### `21.e` 🟡 — covered=False, score=0.45

**Spec prompt:** _Provide documentation of written learning agreements with field agencies that specify the student's role, activities, anticipated learning outcomes, supervision, and field instruction. The agreement must be signed by the appropriate agency representative and/or fieldwork supervisor, seminar instructor, and student._

**Assigned content:** 8 narrative + 6 supporting evidence section(s)

**Claude's summary:** The program must provide comprehensive, signed field placement agreements for all students that explicitly document student role, activities, anticipated learning outcomes, supervision arrangements, and field instruction details—currently only sample agreements for select agencies are submitted. Strengthen by submitting completed learning agreements (not just confirmation letters) signed by all four required parties for a representative sample of current placements.

**Strengths:**
- Narrative acknowledges the specification requirement and references written documentation with field agencies
- Evidence of placement confirmation letters (Evidence 4) showing communication with agencies about student placement
- Evidence of systematic processes including Field Placement Handbook distributed to agencies (Evidence 6)
- Documentation shows agreements address professional liability insurance and representation/supervision structures (multiple evidence items)
- Narrative indicates learning objectives are collected and signed by field instructors before submission to University supervisor
- Evidence of evaluation processes at midpoint and completion with multiple signatures (narrative section 4)

**Gaps (user must address):**
- ⚠️ No evidence of written learning agreements that specify the student's role and activities—narrative mentions 'most agencies do not require a formal contract' and only sample agreements are included, not systematic documentation
- ⚠️ No evidence of anticipated learning outcomes being documented in signed agreements—narrative mentions 'Learning Objectives' submission but this appears to be separate from field placement agreements and signed after placement
- ⚠️ No evidence of field instruction specifications documented in the field placement agreements themselves—narrative references a Field Placement Handbook but the actual agreement documents provided do not detail supervision and field instruction parameters
- ⚠️ Missing systematic evidence that ALL field placements have signed written agreements—narrative states agreements exist for only 2-3 larger agencies (Kennedy Krieger, Sheppard Pratt, Baltimore County DSS) with unclear status for other placements
- ⚠️ No evidence that agreements are signed by all required parties consistently—narrative states agreements should be signed by 'agency director, fieldwork supervisor, program instructor, and student' but supporting evidence items do not demonstrate this for all placements
- ⚠️ Lack of actual field placement agreement templates or completed examples with all required signatures—Evidence 4 shows only a confirmation letter, not a comprehensive learning agreement

---
### `21.f` 🟡 — covered=False, score=0.65

**Spec prompt:** _Provide syllabi for required seminars. Seminars must meet at least every two weeks. Seminar hours must not be included in field experience hours._

**Assigned content:** 3 narrative + 1 supporting evidence section(s)

**Claude's summary:** Provide complete syllabi for both CHS 380 and CHS 441 (not just schedules) with explicit statements about how seminar hours are tracked separately from field experience hours. Clarify the meeting schedule notation to confirm all dates meet the biweekly minimum.

**Strengths:**
- Narrative clearly states seminars meet weekly (CHS 380) and at least every other week (CHS 441), satisfying the 'at least every two weeks' requirement
- Course description provided explains seminar purpose and professional development focus
- Evidence table demonstrates detailed, structured seminar content with clear topics and assignments across multiple weeks
- Prerequisites and grading consequences described, showing integration with practicum sequence
- Assignments (journals, evaluations, portfolios) shown are appropriate for reflective seminar work distinct from field practice

**Gaps (user must address):**
- ⚠️ No syllabus documents provided as required by the Specification—only a schedule/calendar table is present
- ⚠️ CHS 380 syllabus is referenced but not included in supporting evidence; only CHS 441 schedule is shown
- ⚠️ Evidence does not explicitly state or clarify how seminar hours are separated/tracked from field experience hours in the grade calculation or transcript
- ⚠️ No formal documentation demonstrating that seminar hours are not counted toward field experience hour requirements
- ⚠️ Schedule shows inconsistent meeting patterns (some weeks show two dates like '1/29/31,' unclear if this means two separate meetings or a typo); frequency compliance is ambiguous

---
### `21.g` 🟢 — covered=True, score=0.85

**Spec prompt:** _Provide evidence that required field experience is no less than 350 (may include 250 from associate level) clock hours of field experience with at least 100 of these clock hours occurring in the junior and senior years._

**Assigned content:** 7 narrative + 0 supporting evidence section(s)

**Claude's summary:** The narrative adequately demonstrates that the program exceeds all quantitative requirements (350 total hours, 100+ in junior/senior years). Attach the referenced course syllabi, field placement handbook, and any documentation showing how clock hours are calculated and verified to fully satisfy the evidentiary requirement.

**Strengths:**
- Narrative clearly states total field experience hours (500-630) well exceed the 350-hour minimum
- Explicitly identifies that ALL field hours occur in junior and senior years, exceeding the 100-hour requirement for those years
- Describes two distinct field experiences (CHS 380 internship at 90 hours; CHS 440 practicum at 410-540 hours)
- Includes concurrent seminar courses (CHS 441) that provide reflection and integration of field experience
- Specifies field settings are nonprofit human services organizations
- Addresses attendance requirements and absence policies with documentation guidelines

**Gaps (user must address):**
- ⚠️ No supporting evidence documents provided (e.g., course syllabi referenced multiple times but not attached)
- ⚠️ No documentation of actual clock hour calculations or verification methodology
- ⚠️ No evidence that field experiences occur in settings that meet human services standards
- ⚠️ No documentation of student completion rates or how the program ensures students actually complete required hours
- ⚠️ Unclear whether the 90 hours in CHS 380 plus 410-540 hours in CHS 440 definitively meets the minimum 100 hours in junior/senior years (narrative states 90+410=500 minimum, which exceeds 100, but this calculation should be explicitly verified)
- ⚠️ No field placement handbook or documented policies provided to support absence/forgiveness procedures mentioned

---
### `21.h` 🟡 — covered=False, score=0.55

**Spec prompt:** _Demonstrate how the field experience provides the student with an opportunity to progress from: 1. Observation to 2. Directly supervised client contacts to 3. Indirectly supervised client contacts to 4. An independent caseload OR assignment of administrative responsibility._

**Assigned content:** 3 narrative + 0 supporting evidence section(s)

**Claude's summary:** Strengthen this response by providing aggregate data (e.g., percentage of students completing each stage, documentation of supervisor evaluations, site visit reports, and placement agreements) that systematically demonstrates all students progress through the four-stage model, not just one illustrative example. Include samples of tools used to monitor and assess progression.

**Strengths:**
- Narrative clearly articulates understanding of the four-stage progression model (observation → directly supervised → indirectly supervised → independent/administrative)
- Provides one detailed, concrete example of a student's progression through all four stages in the Baltimore County Department of Social Services placement
- Describes proactive quality assurance mechanisms (Field Placement Coordinator reviews, University Supervisor site visits, removal of non-compliant sites)
- Addresses related specification 21.i regarding supervisor credentials (Master's degree minimum)
- Demonstrates awareness that sites must be held accountable for providing appropriate level assignments

**Gaps (user must address):**
- ⚠️ No supporting evidence provided - narrative is entirely unsupported by documentation (evaluations, supervisor reports, site visit records, student reflections, or placement agreements)
- ⚠️ Lack of systematic data demonstrating that ALL students progress through all four stages; narrative provides only one anecdotal example
- ⚠️ No evidence that the progression model is consistently implemented across both Internship (CHS 380) and Practicum (CHS 440) courses
- ⚠️ Missing documentation of the Field Placement Coordinator's review process, audit results, or data showing how sites are monitored for compliance with progression requirements
- ⚠️ No evidence demonstrating criteria or timeline for progression (e.g., how long in each stage, what triggers advancement)
- ⚠️ Vague reference to 'typically provide' rather than demonstrating systematic assurance for all students
- ⚠️ Supporting student feedback mentions 'observed and assisted' and 'office work' but does not explicitly connect these activities to the four-stage progression model
- ⚠️ No documentation of how students with independent caseloads vs. administrative responsibilities are tracked or that both pathways are equally available

---
### `21.i` 🔴 — covered=False, score=0.00

**Spec prompt:** _Demonstrate that field supervisors have a degree at least as high as the one awarded by the program. It is strongly recommended that field supervisors hold at least one degree level above the degree in Human Services or a related field._

**Assigned content:** 0 narrative + 0 supporting evidence section(s)

**Claude's summary:** Submit a narrative explaining the program's process for verifying field supervisor credentials and provide supporting evidence (such as supervisor CVs, degree verification documents, or a summary table) demonstrating that all supervisors hold at least a baccalaureate degree and ideally a graduate degree in Human Services or a related field.

**Gaps (user must address):**
- ⚠️ No narrative explanation of how the program ensures field supervisors meet the minimum degree requirement (at least as high as the baccalaureate degree awarded)
- ⚠️ No documentation or list of field supervisors' actual credentials and degree levels
- ⚠️ No evidence addressing the strongly recommended standard that supervisors hold a degree level above the baccalaureate in Human Services or a related field
- ⚠️ No policy or procedure describing the recruitment, hiring, or qualification verification process for field supervisors
- ⚠️ No supporting documentation (e.g., CV summaries, credential verification forms, hire agreements) demonstrating supervisor qualifications

---
### `21.j` 🔴 — covered=False, score=0.25

**Spec prompt:** _Demonstrate that the program continually monitors the progress of each student and performs no less than one site visit to each field placement site per quarter or semester. The visit can be held as a direct site visit or with appropriate technology. The technology used should ensure that both the field placement supervisor and the student can be identified._

**Assigned content:** 3 narrative + 0 supporting evidence section(s)

**Claude's summary:** Provide a policy document or checklist showing the required frequency of site visits (per quarter/semester), and attach concrete evidence such as site visit logs, supervisor sign-in sheets, or technology-based visit documentation (with timestamps and participant identification) for a representative sample of placements from the review period.

**Strengths:**
- Narrative confirms existence of a Field Placement Coordinator role (Dr. Finkenberg) with clear responsibility for placements
- Narrative documents that University Supervisors oversee student progress in placements on a weekly basis
- Narrative indicates field supervisors complete formal evaluations aligned with program outcomes, demonstrating some level of monitoring mechanism
- Program demonstrates awareness of placement quality issues and willingness to respond (selective placement decisions mentioned)

**Gaps (user must address):**
- ⚠️ No evidence of a systematic monitoring plan that occurs 'no less than one site visit...per quarter or semester' — narrative mentions only that 'the CHS chair and the field placement coordinator have examined specific issues and visited one site,' which is anecdotal rather than systematic
- ⚠️ No documentation of site visit frequency across all placement sites — specification requires monitoring of 'each field placement site,' but narrative provides no data on how many sites exist, how many were visited, or on what schedule
- ⚠️ No clarification of whether visits are direct site visits or technology-based — specification requires visits 'as a direct site visit or with appropriate technology' but narrative does not specify which method(s) are used
- ⚠️ No evidence that technology used (if applicable) ensures identification of both field placement supervisor and student, as required by the specification
- ⚠️ No supporting evidence documents provided — the narrative references evaluations and supervisory reports but no actual site visit logs, schedules, documentation forms, or records are attached to verify the monitoring actually occurs
- ⚠️ Missing explanation of how the program 'continually monitors the progress of each student' — narrative mentions weekly reports to University Supervisors but does not describe how this translates into required site visits

---