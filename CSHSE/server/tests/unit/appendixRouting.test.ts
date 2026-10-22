/**
 * Appendix-named evidence routing (Kennesaw State, Oct 2026): coordinators name
 * appendix files "APPENDIX IV 9 Alumni Survey Data.pdf" and the self-study cites
 * them in notes like "see Appendix IV Program Evaluation, 8 Results from Exit
 * Survey 2022_2026, and 9 Alumni Survey Data". Routing must read the appendix,
 * map it to the standard USING THE SELF-STUDY'S OWN mapping, and pick the spec
 * whose note cites the item.
 */
import { describe, it, expect } from 'vitest';
import {
  numeralToInt, appendixFromName, appendixStandardMap, appendixRoute, suggestStandardForFile, NarrativeTuple,
} from '../../src/services/evidenceStandardSuggester';

const N: NarrativeTuple[] = [
  { standardCode: '1', specCode: 'a', content: 'Kennesaw is accredited by SACSCOC. See Appendix II Standard I Institutional Requirements and Primary Program Objective 3 Certificate page.' },
  { standardCode: '4', specCode: 'a', content: 'Learning outcomes are assessed. See Appendix IV Standard IV Program Evaluation 2 AOL Plan 3 2024 Assessment of Learning (AOL) Results' },
  { standardCode: '4', specCode: 'b', content: 'Formal program evaluation every five years. See Appendix IV Standard IV Program Evaluation 5 HS 3000 Site Supervisor Evaluation Form' },
  { standardCode: '4', specCode: 'c', content: 'For student satisfaction and graduate school or employment data, please see Appendix IV Program Evaluation, 8 Results from Exit Survey 2022_2026, and 9 Alumni Survey Data. For retention of transfer students, please see Appendix IV Program Evaluation, 11 2026 Transfer Data.' },
  { standardCode: '21', specCode: 'd', content: 'Students log hours using the Internship Hour Documentation form.' },
  ...['11.a', '12.a', '13.a', '14.a', '15.a', '16.a', '17.a', '18.a', '19.a', '20.a'].map((k) => ({
    standardCode: k.split('.')[0], specCode: 'a', content: 'Field evidence includes the Learning Contract and Competency Log.',
  })),
];

describe('appendix parsing', () => {
  it('reads roman and arabic numerals', () => {
    expect(numeralToInt('IV')).toBe(4); expect(numeralToInt('xix')).toBe(19); expect(numeralToInt('12')).toBe(12);
    expect(numeralToInt('abc')).toBeNull();
  });
  it('parses appendix, item and title from the file name', () => {
    expect(appendixFromName('APPENDIX IV 9 Alumni Survey Data.pdf')).toEqual({ appendix: 4, label: 'IV', item: 9, rest: 'Alumni Survey Data' });
    expect(appendixFromName('Appendix 4 - Exit Survey.pdf')).toMatchObject({ appendix: 4, rest: 'Exit Survey' });
    expect(appendixFromName('APPENDIX IV 10 2026 BS GPA.pdf')).toMatchObject({ appendix: 4, item: 10, rest: '2026 BS GPA' });
  });
  it('ignores names that merely mention an appendix (negative)', () => {
    expect(appendixFromName('Exit Survey see appendix IV.pdf')).toBeNull();
    expect(appendixFromName('Alumni Survey Data.pdf')).toBeNull();
  });
});

describe('appendix → standard comes from the self-study itself', () => {
  it('maps Appendix II to Standard I (numerals are not always equal)', () => {
    const m = appendixStandardMap(N);
    expect(m.get(2)).toBe('1');
    expect(m.get(4)).toBe('4');
  });
});

describe('appendixRoute', () => {
  it('routes an item cited in a note to that spec (9 Alumni Survey Data → 4.c)', () => {
    const r = appendixRoute({ filename: 'APPENDIX IV 9 Alumni Survey Data.pdf' }, N)!;
    expect(r).toMatchObject({ standardCode: '4', specCode: 'c', source: 'filename' });
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.rationale).toMatch(/Appendix IV is Standard 4 in your self-study/);
  });
  it('uses the self-study mapping (Appendix II → Standard 1)', () => {
    expect(appendixRoute({ filename: 'APPENDIX II 3 Certificate page.pdf' }, N)).toMatchObject({ standardCode: '1' });
  });
  it('an item the self-study never cites still lands on the right STANDARD (no spec)', () => {
    const r = appendixRoute({ filename: 'APPENDIX IV 15 HS Student Orientation to Internship.pdf' }, N)!;
    expect(r.standardCode).toBe('4');
    expect(r.specCode).toBeUndefined();
  });
  it('records other specs that name the file (Internship Hour Documentation → also 21.d)', () => {
    const r = appendixRoute({ filename: 'APPENDIX IV 12 Internship Hour Documentation.pdf' }, N)!;
    expect(r.alsoCitedIn).toEqual([{ standardCode: '21', specCode: 'd' }]);
  });
  it('treats a title found in many specs as boilerplate, not a citation (negative)', () => {
    const r = appendixRoute({ filename: 'APPENDIX IV 13 Learning Contract.pdf' }, N)!;
    expect(r.specCode).toBeUndefined();
    expect(r.alsoCitedIn).toEqual([]);
  });
  it('without a mapping in the text, falls back to the numeral with lower confidence', () => {
    const r = appendixRoute({ filename: 'Appendix VII 1 Faculty handbook.pdf' }, [])!;
    expect(r).toMatchObject({ standardCode: '7', confidence: 0.8 });
  });
  it('a non-appendix name returns null (negative)', () => {
    expect(appendixRoute({ filename: 'Alumni Survey Data.pdf' }, N)).toBeNull();
  });
  it('suggestStandardForFile auto-routes appendix files without calling the AI', async () => {
    const { best } = await suggestStandardForFile({ title: 'APPENDIX IV 8 Results from Exit Survey 2022 2026', filename: 'APPENDIX IV 8 Results from Exit Survey 2022_2026.docx', narratives: N, programLevel: 'bachelors' });
    expect(best).toMatchObject({ standardCode: '4', specCode: 'c', source: 'filename' });
  });
});
