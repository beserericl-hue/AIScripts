import { describe, it, expect } from 'vitest';
import {
  referenceMatch,
  explicitStandardFromName,
  titleFromFilename,
  MIN_CONFIDENT,
  NarrativeTuple,
} from '../../src/services/evidenceStandardSuggester';

// Realistic AACC narrative snippets (paraphrased from the imported self-study).
const NARRATIVES: NarrativeTuple[] = [
  { standardCode: '2', specCode: 'b', content: 'The program convenes a Human Services Advisory Board that meets to review curriculum. Minutes of the advisory board meeting are retained as evidence of community input.' },
  { standardCode: '3', specCode: 'a', content: 'Transfer rates from the community college to University System of Maryland institutions are tracked for program graduates.' },
  { standardCode: '4', specCode: 'a', content: 'Program evaluation is conducted through a documented cycle, including learning outcome assessment and curriculum mapping.' },
  { standardCode: '12', specCode: 'a', content: 'HUS 101 Ethics in Human Services and Addiction Counseling addresses equity gaps identified through a worksheet given to students.' },
  { standardCode: '1', specCode: 'a', content: 'Faculty hold appropriate credentials and the program has sufficient institutional support.' },
];

describe('titleFromFilename', () => {
  it('strips extension and normalizes separators', () => {
    expect(titleFromFilename('advisory board meeting  june 2024 minutes.pdf')).toBe('advisory board meeting june 2024 minutes');
    expect(titleFromFilename('Transfer_Rates_MDCC_to_USM.xlsx')).toBe('Transfer Rates MDCC to USM');
  });
});

describe('explicitStandardFromName', () => {
  it('parses "Standard N" and the optional sub-spec', () => {
    expect(explicitStandardFromName('Standard 4 Documentation Program Evaluation.pdf')).toEqual({ std: '4', spec: undefined });
    expect(explicitStandardFromName('Std 11.a Course Contents.pdf')).toEqual({ std: '11', spec: 'a' });
    expect(explicitStandardFromName('4.b Departmental Bylaws.pdf')).toEqual({ std: '4', spec: 'b' });
  });
  it('returns null when no standard is named', () => {
    expect(explicitStandardFromName('advisory board minutes.pdf')).toBeNull();
    expect(explicitStandardFromName('Human Services Stats.pptx')).toBeNull();
  });
});

describe('referenceMatch — ranking (unchanged intent)', () => {
  it('routes the advisory-board minutes to Standard 2.b by name', () => {
    const out = referenceMatch({ title: 'advisory board meeting june 2024 minutes', filename: 'advisory board meeting june 2024 minutes.pdf' }, NARRATIVES);
    expect(out[0]?.standardCode).toBe('2');
    expect(out[0]?.specCode).toBe('b');
  });
  it('returns nothing for a file the narratives never mention', () => {
    const out = referenceMatch({ title: 'Random Unrelated Zebra Photo', filename: 'zebra.jpg' }, NARRATIVES);
    expect(out.length).toBe(0);
  });
});

describe('referenceMatch — HONEST confidence (the bug Monica hit)', () => {
  const NAR = [
    { standardCode: '8', specCode: 'b', content: 'Materials are distributed to faculty each term for their reference.' },
    { standardCode: '11', specCode: 'a', content: 'The curriculum maps course contents across the horizontal and vertical sequence of the program.' },
    { standardCode: '4', specCode: 'a', content: 'Program evaluation tracks alumni education outcomes and career pathways after graduation.' },
  ];

  it('a single incidental word ("faculty") yields LOW confidence, not 100%', () => {
    // "…TO SEND TO FACULTY.xlsx" is a curriculum map, not a faculty doc.
    const out = referenceMatch(
      { title: 'HS Horizontal and Vertical Course Contents TO SEND TO FACULTY', filename: '2026 UPDATED HS ... TO SEND TO FACULTY.xlsx' },
      NAR
    );
    const faculty = out.find((s) => s.standardCode === '8');
    // It may appear as a candidate, but must NOT be auto-route confident.
    if (faculty) expect(faculty.confidence).toBeLessThan(MIN_CONFIDENT);
    // The curriculum standard (distinctive multi-word overlap) should rank at least as high.
    expect(out[0]?.standardCode === '11' || (faculty?.confidence ?? 0) < MIN_CONFIDENT).toBe(true);
  });

  it('boilerplate words (final/updated/copy/pdf/master/list) are ignored', () => {
    // Only boilerplate + generic → no confident match.
    const out = referenceMatch({ title: 'FINAL Master List copy 2', filename: 'FINAL Master List copy 2.pdf' }, NAR);
    const best = out[0];
    expect(best === undefined || best.confidence < MIN_CONFIDENT).toBe(true);
  });

  it('the top pick is damped when a runner-up standard is nearly as strong', () => {
    // "education outcomes" appears in Std 4; nothing else distinctive → still
    // should not be a falsely-confident single answer.
    const out = referenceMatch({ title: 'Education Outcomes Alumni', filename: 'Education_Outcomes_HS Alumni.pdf' }, NAR);
    // Whatever ranks first, keyword-only confidence stays well below certainty.
    expect(out[0].confidence).toBeLessThan(0.75);
  });
});
