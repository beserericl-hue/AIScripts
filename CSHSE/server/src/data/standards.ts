/**
 * CSHSE Accreditation Standards Definitions
 * Full text of all 21 standards with their subspecifications
 * Used to display guidance text in the Self-Study Editor
 */

export interface StandardSpecification {
  code: string;
  title: string;
  text: string;
}

export interface StandardDefinition {
  code: string;
  title: string;
  description: string;
  part: 'I' | 'II';
  specifications: StandardSpecification[];
}

export const CSHSE_STANDARDS: StandardDefinition[] = [
  // PART I: GENERAL STANDARDS (1-10)
  {
    code: '1',
    title: 'Program Identity',
    description: 'The primary program objective shall be to prepare human services professionals to serve individuals, families, groups, communities and/or other supported human services organization functions.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Regional Accreditation',
        text: 'The program is part of a degree granting college or university that is regionally accredited.'
      },
      {
        code: 'b',
        title: 'Primary Objective Evidence',
        text: 'Provide evidence that the development of competent human services professionals is the primary objective of the program and the basis for the degree program title, design, goals and curriculum, teaching methodology, and program administration (e.g. through documents such as catalog, brochures, course syllabi, website, and marketing materials).'
      },
      {
        code: 'c',
        title: 'Student Information',
        text: 'Articulate how students are informed of the curricular and program expectations and requirements prior to admission.'
      },
      {
        code: 'd',
        title: 'Program History',
        text: 'Provide a brief history of the program.'
      },
      {
        code: 'e',
        title: 'Student Population',
        text: 'Describe the student population including the number, gender, race, ethnicity and age of students of students, as well as the numbers of full time, part time, and students graduating each year.'
      },
      {
        code: 'f',
        title: 'Program Description',
        text: 'Provide a complete program description, courses required, time to completion, and other program details (refer to catalogs and other appendices).'
      }
    ]
  },
  {
    code: '2',
    title: 'Program Objectives',
    description: 'The program shall have clearly stated objectives that demonstrate its intent to prepare students for employment or continued education in human services.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Published Objectives',
        text: 'Program objectives are published and accessible to the public.'
      },
      {
        code: 'b',
        title: 'Curriculum Relationship',
        text: 'Program objectives reflect the curriculum and are appropriate to the degree level (Associate, Bachelor\'s, or Master\'s).'
      },
      {
        code: 'c',
        title: 'Outcome Measurement',
        text: 'Program objectives are measurable and regularly assessed.'
      },
      {
        code: 'd',
        title: 'Stakeholder Input',
        text: 'Program objectives are developed with input from stakeholders including students, faculty, employers, and community partners.'
      }
    ]
  },
  {
    code: '3',
    title: 'Organizational Structure',
    description: 'The organizational structure of the program shall ensure adequate support for the achievement of program objectives.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Administrative Location',
        text: 'Describe the administrative location of the program within the institution\'s organizational structure.'
      },
      {
        code: 'b',
        title: 'Program Leadership',
        text: 'Identify the program director/coordinator and describe their qualifications and responsibilities.'
      },
      {
        code: 'c',
        title: 'Decision Making',
        text: 'Describe how program decisions are made and faculty involvement in governance.'
      },
      {
        code: 'd',
        title: 'Communication',
        text: 'Describe communication channels between program and institutional administration.'
      }
    ]
  },
  {
    code: '4',
    title: 'Budgetary Support',
    description: 'The program shall have adequate financial support to achieve its objectives.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Budget Adequacy',
        text: 'Describe the program budget and demonstrate it is adequate to support program operations.'
      },
      {
        code: 'b',
        title: 'Resource Allocation',
        text: 'Describe how financial resources are allocated to support instruction, faculty development, and student services.'
      },
      {
        code: 'c',
        title: 'Budget Process',
        text: 'Describe the budget development process and faculty input.'
      }
    ]
  },
  {
    code: '5',
    title: 'Administrative Support',
    description: 'The program shall have adequate administrative support to achieve its objectives.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Support Staff',
        text: 'Describe administrative and clerical support available to the program.'
      },
      {
        code: 'b',
        title: 'Physical Resources',
        text: 'Describe physical facilities including office space, classrooms, and equipment.'
      },
      {
        code: 'c',
        title: 'Technology Resources',
        text: 'Describe technology resources available to faculty and students.'
      },
      {
        code: 'd',
        title: 'Library Resources',
        text: 'Describe library and learning resources that support the curriculum.'
      }
    ]
  },
  {
    code: '6',
    title: 'Faculty',
    description: 'The program shall have qualified faculty sufficient in number to achieve program objectives.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Faculty Qualifications',
        text: 'All faculty teaching in the program shall hold at minimum a Master\'s degree in human services or a closely related field. Describe faculty qualifications.'
      },
      {
        code: 'b',
        title: 'Faculty Numbers',
        text: 'Describe the number of full-time and part-time faculty and demonstrate sufficiency for program delivery.'
      },
      {
        code: 'c',
        title: 'Faculty Experience',
        text: 'Describe faculty professional experience in human services practice.'
      },
      {
        code: 'd',
        title: 'Faculty Load',
        text: 'Describe faculty teaching loads and other responsibilities.'
      },
      {
        code: 'e',
        title: 'Adjunct Faculty',
        text: 'Describe policies and practices regarding adjunct/part-time faculty supervision and support.'
      }
    ]
  },
  {
    code: '7',
    title: 'Faculty Development',
    description: 'The program shall support ongoing professional development of faculty.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Development Opportunities',
        text: 'Describe professional development opportunities available to faculty.'
      },
      {
        code: 'b',
        title: 'Development Funding',
        text: 'Describe funding support for faculty professional development.'
      },
      {
        code: 'c',
        title: 'Scholarly Activities',
        text: 'Describe faculty participation in scholarly activities including research, publication, and presentations.'
      },
      {
        code: 'd',
        title: 'Professional Involvement',
        text: 'Describe faculty involvement in professional organizations and community service.'
      }
    ]
  },
  {
    code: '8',
    title: 'Practicum/Field Experience Supervisors',
    description: 'Field supervisors shall be qualified to provide supervision of student field experiences.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Supervisor Qualifications',
        text: 'Describe minimum qualifications for field supervisors.'
      },
      {
        code: 'b',
        title: 'Supervisor Selection',
        text: 'Describe the process for selecting and approving field supervisors.'
      },
      {
        code: 'c',
        title: 'Supervisor Orientation',
        text: 'Describe orientation and training provided to field supervisors.'
      },
      {
        code: 'd',
        title: 'Supervisor Communication',
        text: 'Describe communication between program and field supervisors regarding student performance.'
      }
    ]
  },
  {
    code: '9',
    title: 'Student Services',
    description: 'The program shall ensure students have access to adequate support services.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Academic Advising',
        text: 'Describe academic advising services available to students.'
      },
      {
        code: 'b',
        title: 'Career Services',
        text: 'Describe career counseling and job placement assistance available to students.'
      },
      {
        code: 'c',
        title: 'Personal Counseling',
        text: 'Describe personal counseling services available to students.'
      },
      {
        code: 'd',
        title: 'Student Organizations',
        text: 'Describe human services student organizations and activities.'
      }
    ]
  },
  {
    code: '10',
    title: 'Admissions',
    description: 'The program shall have clearly defined admission criteria and procedures.',
    part: 'I',
    specifications: [
      {
        code: 'a',
        title: 'Admission Requirements',
        text: 'Describe program admission requirements and how they are communicated to prospective students.'
      },
      {
        code: 'b',
        title: 'Selection Process',
        text: 'Describe the student selection process including any interviews, essays, or other requirements.'
      },
      {
        code: 'c',
        title: 'Transfer Policies',
        text: 'Describe policies for transfer students including credit evaluation.'
      },
      {
        code: 'd',
        title: 'Retention Policies',
        text: 'Describe academic progression and retention policies.'
      }
    ]
  },
  // PART II: CURRICULUM STANDARDS (11-21)
  {
    code: '11',
    title: 'Curriculum',
    description: 'The curriculum shall provide students with knowledge and skills essential for effective practice in human services.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Curriculum Structure',
        text: 'Describe the overall curriculum structure including general education and major requirements.'
      },
      {
        code: 'b',
        title: 'Course Sequencing',
        text: 'Describe the sequence of courses and any prerequisites.'
      },
      {
        code: 'c',
        title: 'Curriculum Matrix',
        text: 'Provide a curriculum matrix showing where program objectives and CSHSE standards are addressed in courses.'
      },
      {
        code: 'd',
        title: 'Curriculum Review',
        text: 'Describe the process for regular curriculum review and revision.'
      }
    ]
  },
  {
    code: '12',
    title: 'Professional Practice',
    description: 'The curriculum shall include supervised practice experience that allows students to apply knowledge and develop skills.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Field Experience Requirements',
        text: 'Describe field experience/internship requirements including hours (minimum of 250 hours for Bachelor\'s programs).'
      },
      {
        code: 'b',
        title: 'Placement Process',
        text: 'Describe the process for selecting and approving field placement sites.'
      },
      {
        code: 'c',
        title: 'Learning Agreements',
        text: 'Describe learning agreements or contracts used with field placement sites.'
      },
      {
        code: 'd',
        title: 'Supervision',
        text: 'Describe supervision provided during field experience including faculty site visits.'
      },
      {
        code: 'e',
        title: 'Evaluation',
        text: 'Describe how student performance in field experience is evaluated.'
      }
    ]
  },
  {
    code: '13',
    title: 'Program Assessment',
    description: 'The program shall have a systematic plan for assessing program effectiveness.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Assessment Plan',
        text: 'Describe the program assessment plan including measures used to evaluate program effectiveness.'
      },
      {
        code: 'b',
        title: 'Data Collection',
        text: 'Describe how assessment data is collected and analyzed.'
      },
      {
        code: 'c',
        title: 'Use of Results',
        text: 'Describe how assessment results are used for program improvement.'
      },
      {
        code: 'd',
        title: 'Stakeholder Involvement',
        text: 'Describe how stakeholders are involved in assessment activities.'
      }
    ]
  },
  {
    code: '14',
    title: 'Student Learning Outcomes',
    description: 'The program shall define student learning outcomes that align with program objectives.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Learning Outcomes',
        text: 'List student learning outcomes for the program.'
      },
      {
        code: 'b',
        title: 'Alignment',
        text: 'Demonstrate how student learning outcomes align with program objectives and CSHSE standards.'
      },
      {
        code: 'c',
        title: 'Assessment Methods',
        text: 'Describe methods used to assess student learning outcomes.'
      },
      {
        code: 'd',
        title: 'Results',
        text: 'Provide evidence of student achievement of learning outcomes.'
      }
    ]
  },
  {
    code: '15',
    title: 'Student Portfolio',
    description: 'Students shall demonstrate competency through portfolio or other culminating experience.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Portfolio Requirements',
        text: 'Describe portfolio or capstone requirements for students.'
      },
      {
        code: 'b',
        title: 'Portfolio Contents',
        text: 'Describe required contents of the student portfolio.'
      },
      {
        code: 'c',
        title: 'Evaluation Criteria',
        text: 'Describe criteria used to evaluate student portfolios.'
      }
    ]
  },
  {
    code: '16',
    title: 'Program Advisory Committee',
    description: 'The program shall have an advisory committee that provides input on program development.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Committee Composition',
        text: 'Describe the composition of the advisory committee including representation from human services agencies, alumni, and other stakeholders.'
      },
      {
        code: 'b',
        title: 'Meeting Frequency',
        text: 'Describe how often the advisory committee meets.'
      },
      {
        code: 'c',
        title: 'Committee Role',
        text: 'Describe the role of the advisory committee in program planning and evaluation.'
      }
    ]
  },
  {
    code: '17',
    title: 'Diversity',
    description: 'The curriculum shall address cultural diversity and prepare students to work with diverse populations.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Diversity in Curriculum',
        text: 'Describe how cultural diversity is addressed throughout the curriculum.'
      },
      {
        code: 'b',
        title: 'Faculty Diversity',
        text: 'Describe efforts to maintain diverse faculty.'
      },
      {
        code: 'c',
        title: 'Student Diversity',
        text: 'Describe recruitment and retention efforts for diverse students.'
      },
      {
        code: 'd',
        title: 'Competence Development',
        text: 'Describe how students develop cultural competence.'
      }
    ]
  },
  {
    code: '18',
    title: 'Ethics',
    description: 'The curriculum shall include instruction in professional ethics.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Ethics Education',
        text: 'Describe how ethical standards and principles are taught in the curriculum.'
      },
      {
        code: 'b',
        title: 'NOHS Standards',
        text: 'Describe how the NOHS Ethical Standards for Human Services Professionals are integrated into the curriculum.'
      },
      {
        code: 'c',
        title: 'Ethical Decision Making',
        text: 'Describe how students learn ethical decision-making processes.'
      }
    ]
  },
  {
    code: '19',
    title: 'Supervision',
    description: 'The curriculum shall address human services supervision.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Supervision Content',
        text: 'Describe how supervision concepts and skills are addressed in the curriculum.'
      },
      {
        code: 'b',
        title: 'Leadership Development',
        text: 'Describe how students develop leadership skills.'
      }
    ]
  },
  {
    code: '20',
    title: 'Technology',
    description: 'The curriculum shall address the use of technology in human services.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Technology Integration',
        text: 'Describe how technology is integrated into the curriculum.'
      },
      {
        code: 'b',
        title: 'Digital Literacy',
        text: 'Describe how students develop digital literacy skills relevant to human services practice.'
      },
      {
        code: 'c',
        title: 'Technology Ethics',
        text: 'Describe how ethical use of technology is addressed.'
      }
    ]
  },
  {
    code: '21',
    title: 'Field Experience',
    description: 'Field experience shall provide students with supervised opportunities to develop and demonstrate professional competencies.',
    part: 'II',
    specifications: [
      {
        code: 'a',
        title: 'Site Requirements',
        text: 'Describe requirements for approved field experience sites.'
      },
      {
        code: 'b',
        title: 'Student Preparation',
        text: 'Describe how students are prepared for field experience.'
      },
      {
        code: 'c',
        title: 'Learning Objectives',
        text: 'Describe learning objectives for field experience.'
      },
      {
        code: 'd',
        title: 'Supervision Requirements',
        text: 'Describe supervision requirements during field experience including faculty contact hours.'
      },
      {
        code: 'e',
        title: 'Evaluation Process',
        text: 'Describe the evaluation process for student field experience performance.'
      },
      {
        code: 'f',
        title: 'Problem Resolution',
        text: 'Describe procedures for addressing problems that arise during field experience.'
      }
    ]
  }
];

/**
 * Get all standards
 */
export function getAllStandards(): StandardDefinition[] {
  return CSHSE_STANDARDS;
}

/**
 * Get a specific standard by code
 */
export function getStandardByCode(code: string): StandardDefinition | undefined {
  return CSHSE_STANDARDS.find(s => s.code === code);
}

/**
 * Get standards by part (I or II)
 */
export function getStandardsByPart(part: 'I' | 'II'): StandardDefinition[] {
  return CSHSE_STANDARDS.filter(s => s.part === part);
}
