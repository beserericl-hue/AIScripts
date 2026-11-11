import { describe, it, expect } from 'vitest';
import {
  matchPartHeading,
  splitBucketsIntoParts,
  splitReviewStateIntoParts,
  composeSpecNarrativeHtml,
} from '../../src/services/specPartSplit';
import { getSpecParts } from '../../src/data/levelStandards';

const parts4a = getSpecParts('baccalaureate', '4', 'a');
const parts16c = getSpecParts('baccalaureate', '16', 'c');

// The shape ETSU's Draft for Submission.docx came through as (nested <p><p>).
const etsu4a =
  '<p><p>1. Measurable student learning outcomes</p></p><p><p>We measure five SLOs: 1) Empathy, 2) Multicultural Awareness.</p></p>' +
  '<p>4.a. 2. Assessment plan (include timelines)</p><p><p>Since 2018 the plan …</p></p>' +
  '<p>4.a. 3. Examples of assessment tools (e.g. rubrics, exams, portfolios, surveys, capstone evaluations,</p><p>etc.).</p>' +
  '<p>Examples include the Toronto Empathy Questionnaire.</p>' +
  '<p>4.a. 4. A description of how the evaluation may or may not have resulted in any change</p><p>Data led to a new rubric.</p>';

const bucket = (std: string, spec: string, html: string, id = 'sec-1') => ({
  standardCode: std,
  specCode: spec,
  narratives: [{ sectionId: id, heading: `${std}.${spec}. prompt`, snippet: 'x', htmlSnippet: html, wordCount: 99, confidence: 0.98 }],
  evidenceText: [],
  evidenceFiles: [],
});

describe('matchPartHeading', () => {
  it('recognises "1. Text" and "4.a. 2. Text" headings by the official wording', () => {
    expect(matchPartHeading('1. Measurable student learning outcomes', '4', 'a', parts4a)).toEqual({ n: 1, headingOnly: true });
    expect(matchPartHeading('4.a. 2. Assessment plan (include timelines)', '4', 'a', parts4a)?.n).toBe(2);
    expect(matchPartHeading('4a.3 Examples of assessment tools', '4', 'a', parts4a)?.n).toBe(3);
  });
  it('maps nested lettered parts to the flat catalog by wording (16.c)', () => {
    expect(matchPartHeading('a. Intake interviewing', '16', 'c', parts16c, 1)?.n).toBe(2);
    expect(matchPartHeading('16.c. b. Helping skills:', '16', 'c', parts16c, 2)?.n).toBe(3);
    expect(matchPartHeading('16.c. 2. Group facilitation', '16', 'c', parts16c, 4)?.n).toBe(5);
  });
  it('NEGATIVE: an ordinary numbered sentence inside an answer is not a part heading', () => {
    expect(matchPartHeading('1) Empathy, 2) Multicultural Awareness, 3) Information Literacy', '4', 'a', parts4a)).toBeNull();
    expect(matchPartHeading('Measurable student learning outcomes are listed below', '4', 'a', parts4a)).toBeNull(); // no marker
    expect(matchPartHeading('2. We revised the capstone rubric in 2023.', '4', 'a', parts4a)).toBeNull();
  });
  it('NEGATIVE: parts only move forward (a repeated earlier heading is ignored)', () => {
    expect(matchPartHeading('1. Measurable student learning outcomes', '4', 'a', parts4a, 2)).toBeNull();
  });
});

describe('splitBucketsIntoParts', () => {
  it('splits 4.a into four items, one per part, heading lines removed (wrapped tail too)', () => {
    const { buckets, idMap, changed } = splitBucketsIntoParts({ '4.a': bucket('4', 'a', etsu4a) }, 'baccalaureate');
    expect(changed).toBe(true);
    const n = buckets['4.a'].narratives;
    expect(n.map((x: any) => x.partN)).toEqual([1, 2, 3, 4]);
    expect(n[0].heading).toBe('4.a.1 Measurable student learning outcomes');
    expect(n[0].snippet).toContain('We measure five SLOs');
    expect(n[1].snippet).toBe('Since 2018 the plan …');
    expect(n[2].snippet).toBe('Examples include the Toronto Empathy Questionnaire.'); // "etc.)." absorbed into the heading
    expect(n[3].htmlSnippet).toContain('new rubric');
    expect(idMap['sec-1']).toEqual(['sec-1::part-1', 'sec-1::part-2', 'sec-1::part-3', 'sec-1::part-4']);
  });
  it('is idempotent', () => {
    const once = splitBucketsIntoParts({ '4.a': bucket('4', 'a', etsu4a) }, 'baccalaureate').buckets;
    const twice = splitBucketsIntoParts(once, 'baccalaureate');
    expect(twice.changed).toBe(false);
  });
  it('NEGATIVE: a spec without parts, or an answer without part headings, is left alone', () => {
    const r = splitBucketsIntoParts(
      { '5.a': bucket('5', 'a', '<p>1. Admissions policy is posted.</p>'), '4.b': bucket('4', 'b', '<p>We evaluate yearly.</p>') },
      'baccalaureate'
    );
    expect(r.changed).toBe(false);
  });
  it('NEGATIVE: parts restated as a list, then one combined answer (ETSU 21.h) stay one narrative', () => {
    const html =
      '<p>1.  Observation to</p><p>2.  Directly supervised client contacts to</p><p>3.  Indirectly supervised client contacts to</p>' +
      '<p>4.  An independent caseload OR assignment of administrative responsibility.</p><p>The program follows a developmental model …</p>';
    const r = splitBucketsIntoParts({ '21.h': bucket('21', 'h', html) }, 'baccalaureate');
    expect(r.changed).toBe(false);
  });
  it('one part left unanswered still splits the others', () => {
    const html = '<p>1. A history of program evaluations</p><p>Every 5 years.</p><p>4.b. 2. A description of the methodology</p><p>4.b. 3. A summative analysis of the most recent evaluation</p><p>Retention rose.</p>';
    const r = splitBucketsIntoParts({ '4.b': bucket('4', 'b', html) }, 'baccalaureate');
    expect(r.buckets['4.b'].narratives.map((x: any) => x.partN)).toEqual([1, 2, 3]);
  });
  it('keeps text before the first part heading as the spec intro (not "Provide the following:")', () => {
    const html = '<p>Provide the following:</p><p>1. A history of program evaluations</p><p>Every 5 years.</p>';
    const r = splitBucketsIntoParts({ '4.b': bucket('4', 'b', html) }, 'baccalaureate');
    expect(r.buckets['4.b'].narratives.map((x: any) => x.partN)).toEqual([1]);
    const html2 = '<p>Our program evaluates itself.</p><p>1. A history of program evaluations</p><p>Every 5 years.</p>';
    const r2 = splitBucketsIntoParts({ '4.b': bucket('4', 'b', html2) }, 'baccalaureate');
    expect(r2.buckets['4.b'].narratives[0]).toMatchObject({ sectionId: 'sec-1', partIntro: true });
  });
});

describe('splitReviewStateIntoParts', () => {
  it('part items inherit approval / discard / source of the item they came from', () => {
    const state: any = {
      buckets: { '4.a': bucket('4', 'a', etsu4a) },
      approvedIds: ['sec-1'],
      discardedIds: [],
      itemSources: { 'sec-1': { importId: 'imp' } },
    };
    expect(splitReviewStateIntoParts(state, 'baccalaureate')).toBe(true);
    expect(state.approvedIds).toEqual(expect.arrayContaining(['sec-1::part-1', 'sec-1::part-4']));
    expect(state.itemSources['sec-1::part-3']).toEqual({ importId: 'imp' });
  });
});

describe('composeSpecNarrativeHtml', () => {
  it('writes each part under its own numbered heading, in official order', () => {
    const html = composeSpecNarrativeHtml(
      [
        { html: '<p>B</p>', partN: 2, partText: 'Assessment plan (include timelines)' },
        { html: '<p>intro</p>' },
        { html: '<p>A</p>', partN: 1, partText: 'Measurable student learning outcomes' },
      ],
      '4',
      'a'
    );
    expect(html.indexOf('intro')).toBeLessThan(html.indexOf('4.a.1'));
    expect(html.indexOf('<h3>4.a.1 Measurable')).toBeLessThan(html.indexOf('<h3>4.a.2 Assessment'));
  });
  it('NEGATIVE: specs without parts keep the old merge', () => {
    expect(composeSpecNarrativeHtml([{ html: '<p>a</p>' }, { html: '<p>b</p>' }], '5', 'a')).toBe('<p>a</p>\n<hr class="ai-import-merge"/>\n<p>b</p>');
  });
});
