import { describe, it, expect } from 'vitest';
import {
  referenceMatch,
  explicitStandardFromName,
  titleFromFilename,
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
  it('parses "Standard N" out of a filename', () => {
    expect(explicitStandardFromName('Standard 4 Documentation Program Evaluation.pdf')).toBe('4');
    expect(explicitStandardFromName('Std 12 stuff')).toBe('12');
  });
  it('returns null when no standard is named', () => {
    expect(explicitStandardFromName('advisory board minutes.pdf')).toBeNull();
    expect(explicitStandardFromName('Human Services Stats.pptx')).toBeNull();
  });
});

describe('referenceMatch', () => {
  it('routes the advisory-board minutes to Standard 2.b by name', () => {
    const out = referenceMatch(
      { title: 'advisory board meeting june 2024 minutes', filename: 'advisory board meeting june 2024 minutes.pdf' },
      NARRATIVES
    );
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].standardCode).toBe('2');
    expect(out[0].specCode).toBe('b');
    expect(out[0].source).toBe('reference');
  });

  it('routes the transfer-rates workbook to Standard 3.a', () => {
    const out = referenceMatch(
      { title: 'Transfer Rates MDCC to USM', filename: 'Transfer Rates MDCC to USM.xlsx' },
      NARRATIVES
    );
    expect(out[0].standardCode).toBe('3');
    expect(out[0].specCode).toBe('a');
  });

  it('routes the equity-gaps worksheet to the HUS 101 spec (12.a)', () => {
    const out = referenceMatch(
      { title: 'Equity Gaps Worksheet HUS 101', filename: 'Equity Gaps Worksheet  HUS 101 .pdf' },
      NARRATIVES
    );
    expect(out[0].standardCode).toBe('12');
    expect(out[0].specCode).toBe('a');
  });

  it('returns nothing for a file the narratives never mention', () => {
    const out = referenceMatch(
      { title: 'Random Unrelated Zebra Photo', filename: 'zebra.jpg' },
      NARRATIVES
    );
    expect(out.length).toBe(0);
  });
});
