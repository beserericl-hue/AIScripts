/**
 * The official CSHSE Reader Report "Certification + General Program
 * Characteristics: Introductory Information" section, transcribed 1:1 from the
 * paper Reader Report (ASSOCIATE / BACCALAUREATE / MASTER'S "…July 2025.docx",
 * Table 0, rows 0–21). The Introduction is identical across degree levels, so
 * one rubric serves all three.
 *
 * Structure (matches the paper form exactly):
 *   - A `cert` GATE row — "Certification of Self-Study Page" — marked Included
 *     Yes/No (not Compliant/Non-Compliant). If absent, the reader is told to
 *     stop and inform the Lead Reader.
 *   - Section "A. Introduction": each sub-item is its OWN Compliant/Non-Compliant
 *     line. Some sub-items are CONDITIONAL groups (Interim/Reaccreditation only,
 *     Multiple sites, Hybrid/Online) — "not applicable to this program" counts
 *     as Compliant, not a gap.
 *   - Section "B. Glossary of terms".
 *
 * standardsStatus / ReaderReport / ValidationResult keys are
 * `introduction_<specCode>`, matching the `${standardCode}_${specCode}`
 * convention used for the numbered standards.
 */

export const INTRO_STANDARD_CODE = 'introduction';

/** Section a row belongs to — drives the headers shown in the Reader Report. */
export type IntroGroup = 'cert' | 'A' | 'interim' | 'sites' | 'hybrid' | 'B';

export interface IntroRubricRow {
  specCode: string;
  /** Official row label shown in the Reader Report. */
  title: string;
  /** The "Reader Form Rubric" — the official language the reader (and the AI)
   *  evaluates the introduction against for THIS row. */
  criteria: string;
  /** Which section of the form the row belongs to. */
  group: IntroGroup;
  /** Header text to render ABOVE this row (only set on the first row of a
   *  section/sub-group), e.g. "A. Introduction". */
  groupLabel?: string;
  /** GATE rows are answered Included: Yes / No, not Compliant/Non-Compliant. */
  gate?: 'yesno';
  /** Conditional rows (Interim/Reaccreditation, multiple sites, hybrid/online):
   *  the reader/AI treats "not applicable to this program" as Compliant. */
  conditional?: boolean;
}

export const INTRO_RUBRIC: IntroRubricRow[] = [
  // ── Certification gate ──────────────────────────────────────────────────
  {
    specCode: 'cert',
    group: 'cert',
    gate: 'yesno',
    title: 'Certification of Self-Study Page',
    criteria:
      'If absent, do not proceed with reading the Self-Study and inform the Lead Reader. NOTE: The format for this page is in the Member Handbook: Accreditation and Self-Study Guide, Appendix G. This page MUST be included at the very beginning of the self-study, and be in the correct format, with all the required information. If absent, do not proceed with reading and evaluating the self-study until this page is furnished.',
  },

  // ── A. Introduction (always required) ───────────────────────────────────
  {
    specCode: 'a', group: 'A', groupLabel: 'A. Introduction',
    title: 'Specify the degree(s) offered for which accreditation is being sought',
    criteria: 'Specify the degree(s) offered for which accreditation is being sought.',
  },
  {
    specCode: 'b', group: 'A',
    title: 'Describe the institution',
    criteria: 'Describe the institution: describe the organizational structure, whether state or private, age of institution, brief history, etc.',
  },
  {
    specCode: 'c', group: 'A',
    title: 'Describe the institutional context of the Program',
    criteria: 'Describe the institutional context of the Program. For example, include organization charts and structure, goals and objectives. What levels of degrees are offered by the institution?',
  },
  {
    specCode: 'd', group: 'A',
    title: 'Describe the Program',
    criteria: 'Describe the Program (this should not duplicate information requested in the Specifications for Standard 1). Briefly describe the strengths of the Program and any attributes that make the Program unique.',
  },
  {
    specCode: 'e', group: 'A',
    title: 'Describe institutional course requirements for all students',
    criteria: 'Describe institutional course requirements for all students and explain how they prepare students for study in the human services program. For example, describe general education or liberal arts requirements of the institution.',
  },
  {
    specCode: 'f', group: 'A',
    title: 'Include any other pertinent background information',
    criteria: 'Include any other background information that may be pertinent such as action plans for identified problem areas, changing enrollment patterns, marketing strategies, or institutional or curricular restructuring.',
  },

  // ── Interim Report / Reaccreditations ONLY (conditional) ────────────────
  {
    specCode: 'g', group: 'interim', conditional: true,
    groupLabel: 'Interim Report and Review and Reaccreditations only',
    title: 'Copy of the VPA letter from the prior accreditation',
    criteria: 'Interim Report and Review and Reaccreditations only: Include a copy of the letter from the Vice President of Accreditation (VPA) sent at the time of the prior accreditation notifying the Program of the disposition of the application for accreditation. (Initial accreditation: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'h', group: 'interim', conditional: true,
    title: 'How each condition in the VPA letter has been addressed',
    criteria: 'Describe how each condition in the VPA letter has been addressed. (Initial accreditation: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'i', group: 'interim', conditional: true,
    title: 'Major program changes since the prior accreditation',
    criteria: 'Describe any major program changes since the prior accreditation. (Initial accreditation: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'j', group: 'interim', conditional: true,
    title: 'Major curriculum changes since the prior accreditation',
    criteria: 'Describe any major curriculum changes since the prior accreditation. (Initial accreditation: not applicable — treat as Compliant.)',
  },

  // ── Delivery at multiple sites (conditional) ────────────────────────────
  {
    specCode: 'k', group: 'sites', conditional: true,
    groupLabel: 'If the Program is delivered at multiple sites',
    title: 'Physical location and unique characteristics of each site',
    criteria: 'If the Program is delivered at multiple sites, for each site: describe the physical location and any unique characteristics. (Single site: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'l', group: 'sites', conditional: true,
    title: 'Identify the faculty, directors, and staff (each site)',
    criteria: 'For each site: identify the faculty, directors, and staff. (Single site: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'm', group: 'sites', conditional: true,
    title: 'Describe the student population (each site)',
    criteria: 'For each site: describe the student population. (Single site: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'n', group: 'sites', conditional: true,
    title: 'Policies assuring continuity and quality across all sites',
    criteria: 'Furnish evidence of formal policies and procedures that assure continuity and quality control of Program and Curriculum across all sites. (Single site: not applicable — treat as Compliant.)',
  },

  // ── Hybrid or online course delivery (conditional) ──────────────────────
  {
    specCode: 'o', group: 'hybrid', conditional: true,
    groupLabel: 'Hybrid or Online Course Delivery (if more than 50% of required human service courses are hybrid/online)',
    title: 'Verify students are who they say they are',
    criteria: 'If more than 50% of required human service courses are offered in a hybrid/online format, the Program must document how they assure that students enrolled in the program or course(s) are who they say they are. (Primarily in-person: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'p', group: 'hybrid', conditional: true,
    title: 'Common learning outcomes across delivery modes',
    criteria: 'Demonstrate that common learning outcomes/objectives exist for both face-to-face and hybrid/online delivery. (Primarily in-person: not applicable — treat as Compliant.)',
  },
  {
    specCode: 'q', group: 'hybrid', conditional: true,
    title: 'Adequate technical training and support',
    criteria: 'Provide documentation that the program provides adequate technical training and support for students and faculty. (Primarily in-person: not applicable — treat as Compliant.)',
  },

  // ── B. Glossary of terms ────────────────────────────────────────────────
  {
    specCode: 'r', group: 'B', groupLabel: 'B. Glossary of terms',
    title: 'Include a glossary of terms',
    criteria: 'Include a glossary of terms as they are used in the self-study and Program materials (e.g., appendices) to provide clarity for the self-study readers.',
  },
];

export const INTRO_SPEC_CODES = INTRO_RUBRIC.map((r) => r.specCode);
/** Spec codes that get an AI verdict (everything except the Yes/No gate). */
export const INTRO_EVAL_SPEC_CODES = INTRO_RUBRIC.filter((r) => r.gate !== 'yesno').map((r) => r.specCode);

/** The rubric row for an intro spec code, or undefined. */
export function getIntroRubricRow(specCode: string): IntroRubricRow | undefined {
  return INTRO_RUBRIC.find((r) => r.specCode === specCode);
}
