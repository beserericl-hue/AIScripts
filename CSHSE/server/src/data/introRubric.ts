/**
 * The official CSHSE Reader Report "Introduction / General Program
 * Characteristics" section (pages 1–4 of the reader form), decomposed into the
 * six fillable rows the reader marks Compliant / Non-Compliant with comments.
 *
 * These six rows are the ground truth extracted from the baccalaureate reader
 * template (the {{c_intro_a}}..{{c_intro_f}} rows, in document order); the
 * Introduction is identical across degree levels, so one rubric serves all
 * three. Each row carries:
 *   - `title`   the official form row label (shown in the Reader Report).
 *   - `criteria` the "Reader Form Rubric" the AI evaluates the introduction
 *               against for THIS row (fed to /ai/section/evaluate exactly like a
 *               standard's spec criteria — the evaluator is code-agnostic).
 *   - `anchors` substrings that mark where this row's content begins in the
 *               self-study introduction narrative, so the narrative can be split
 *               into the matching section for display (best-effort).
 *
 * standardsStatus keys are `introduction_a` .. `introduction_f`, matching the
 * `${standardCode}_${specCode}` convention used for numbered standards.
 */

export const INTRO_STANDARD_CODE = 'introduction';

export interface IntroRubricRow {
  specCode: string;
  title: string;
  criteria: string;
  anchors: string[];
  /** Conditional rows (multiple sites / hybrid-online / reaccreditation) — the
   *  AI must treat "not applicable to this program" as Compliant, not a gap. */
  conditional?: boolean;
}

export const INTRO_RUBRIC: IntroRubricRow[] = [
  {
    specCode: 'a',
    title: 'Introduction',
    criteria:
      'The self-study opens with a general Introduction that orients the reader to the program and institution and frames the material that follows. Confirm an introduction is present and provides an overview of the program seeking accreditation.',
    anchors: ['Introduction', 'A.'],
  },
  {
    specCode: 'b',
    title: 'Required Introductory Material: General Introduction to the Program',
    criteria:
      'The introduction specifies the degree(s) offered for which accreditation is being sought, and describes the institution: its organizational structure (state or private, age of institution, brief history) and the institutional context of the program (organizational charts and structure, goals and objectives, the levels of degree offered by the institution). Note any missing element.',
    anchors: ['Required Introductory Material', 'Specify the degree', 'Describe the institution'],
  },
  {
    specCode: 'c',
    title: 'Describe the Program (Do not duplicate information requested in the Specifications for Standard 1.)',
    criteria:
      'The introduction describes the Program: briefly the strengths of the Program and any attributes that make it unique, and the institutional course requirements for all students and how they prepare students for study in the field. This description must NOT duplicate information requested in the Specifications for Standard 1.',
    anchors: ['Describe the Program', 'strengths of the Program', 'Summary of Changes'],
  },
  {
    specCode: 'd',
    title: 'Interim Report and Review and Reaccreditations only',
    criteria:
      'Applies ONLY to Interim Reports and Reaccreditations: the introduction summarizes the changes to the program since the last review. For an INITIAL accreditation this row is not applicable and should be treated as Compliant.',
    anchors: ['Interim Report and Review', 'Reaccreditation', 'changes to the'],
    conditional: true,
  },
  {
    specCode: 'e',
    title: 'Delivery at Multiple Sites',
    criteria:
      'If the Program is delivered at multiple sites, the introduction addresses the delivery at each site. If the program is delivered at a single site this row is not applicable and should be treated as Compliant.',
    anchors: ['multiple sites', 'delivered at multiple'],
    conditional: true,
  },
  {
    specCode: 'f',
    title: 'Hybrid or Online Course Delivery',
    criteria:
      'If more than 50% of the required human-service courses are offered in a hybrid or online format, the introduction addresses the hybrid/online delivery. If the program is primarily in-person this row is not applicable and should be treated as Compliant.',
    anchors: ['Hybrid or Online', 'hybrid/online', 'online form'],
    conditional: true,
  },
];

export const INTRO_SPEC_CODES = INTRO_RUBRIC.map((r) => r.specCode);

/** The rubric row for an intro spec code, or undefined. */
export function getIntroRubricRow(specCode: string): IntroRubricRow | undefined {
  return INTRO_RUBRIC.find((r) => r.specCode === specCode);
}

/**
 * Split a self-study introduction (one HTML blob) into the six official rows by
 * anchor text, in document order. Returns a map specCode → HTML slice. A row
 * whose anchor is not found gets an empty string (the caller decides the
 * fallback). Robust to missing anchors: slices run from each found anchor to the
 * next found anchor in rubric order.
 */
export function splitIntroductionHtml(introHtml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const html = introHtml || '';
  if (!html.trim()) {
    for (const r of INTRO_RUBRIC) out[r.specCode] = '';
    return out;
  }
  const lower = html.toLowerCase();
  // Find the first index at/after `from` where any of the row's anchors appears.
  const findAnchor = (row: IntroRubricRow, from: number): number => {
    let best = -1;
    for (const a of row.anchors) {
      const i = lower.indexOf(a.toLowerCase(), from);
      if (i !== -1 && (best === -1 || i < best)) best = i;
    }
    return best;
  };
  // Locate each row's start index (monotonic, in rubric order).
  const starts: Array<{ code: string; idx: number }> = [];
  let cursor = 0;
  for (const row of INTRO_RUBRIC) {
    const idx = findAnchor(row, cursor);
    starts.push({ code: row.specCode, idx });
    if (idx !== -1) cursor = idx + 1;
  }
  // Row a always starts at 0 if its anchor wasn't found before the others.
  if (starts[0].idx === -1) starts[0].idx = 0;
  // Build slices: each found row runs to the next found row's start.
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    if (s.idx === -1) { out[s.code] = ''; continue; }
    let end = html.length;
    for (let j = i + 1; j < starts.length; j++) {
      if (starts[j].idx !== -1) { end = starts[j].idx; break; }
    }
    out[s.code] = html.slice(s.idx, end).trim();
  }
  return out;
}
