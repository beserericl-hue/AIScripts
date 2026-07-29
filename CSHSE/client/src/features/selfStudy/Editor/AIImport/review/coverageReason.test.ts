import { describe, it, expect } from 'vitest';
import { coverageReason, coverageState } from './SpecRail';
import type { SpecBucket } from '../../../../../store/aiImportStore';

function bucket(over: Partial<SpecBucket>): SpecBucket {
  return {
    standardCode: '1', specCode: 'a', standardTitle: 'T', specPrompt: 'p',
    narratives: [], evidenceText: [], evidenceFiles: [], matrixCells: [],
    coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
    ...over,
  } as SpecBucket;
}
const item = (i: number) => ({ sectionId: `s${i}`, heading: 'h', snippet: 's', confidence: 0.9, wordCount: 10, rationale: '' } as any);

describe('coverageReason', () => {
  it('green/covered: explains it is covered + shows strengths', () => {
    const r = coverageReason(bucket({
      coverageCovered: true, coverageScore: 0.95, narratives: [item(1)],
      coverageStrengths: ['Narrative clearly states KSU is accredited by SACSCOC.'],
      coverageGaps: ['No direct citation to the SACSCOC letter.'],
    }));
    expect(r).toMatch(/🟢 Covered/);
    expect(r).toContain('95%');
    expect(r).toMatch(/What’s working/);
    expect(r).toContain('accredited by SACSCOC');
  });

  it('yellow/partial: says partial and lists what still needs work', () => {
    const r = coverageReason(bucket({
      coverageCovered: false, coverageScore: 0.65, narratives: [item(1)],
      coverageGaps: ['Specification asks how students are informed PRIOR to admission.'],
    }));
    expect(r).toMatch(/🟡 Partial/);
    expect(r).toContain('65%');
    expect(r).toMatch(/needs work/i);
    expect(r).toContain('PRIOR to admission');
  });

  it('red/gap: says gap and lists the missing criteria', () => {
    const r = coverageReason(bucket({
      coverageCovered: false, coverageScore: 0.25, evidenceText: [item(1)],
      coverageGaps: ['No actual numerical data provided in the narrative.'],
    }));
    expect(r).toMatch(/🔴 Gap/);
    expect(r).toContain('25%');
    expect(r).toContain('No actual numerical data');
  });

  it('empty spec: says nothing is placed here', () => {
    const r = coverageReason(bucket({ coverageCovered: null, coverageScore: null }));
    expect(r).toMatch(/No content placed here yet/);
  });

  it('model-error gaps are NOT shown raw; suggests re-running', () => {
    const r = coverageReason(bucket({
      coverageCovered: false, coverageScore: 0, narratives: [item(1)],
      coverageGaps: ['LLM returned non-JSON response'],
    }));
    expect(r).not.toContain('non-JSON');
    expect(r).toMatch(/Check coverage/);
  });
});

describe('coverageState + the "not assessed" (MCC) case', () => {
  it('content but NO assessment → unassessed (gray), NOT gap (red)', () => {
    const b = bucket({ coverageCovered: null, coverageScore: null, narratives: [item(1)] });
    expect(coverageState(b)).toBe('unassessed');
    const r = coverageReason(b);
    expect(r).toMatch(/Not yet assessed/);
    expect(r).toMatch(/Check coverage/);
    expect(r).not.toMatch(/🔴 Gap/);
  });
  it('assessed low score → gap (red)', () => {
    const b = bucket({ coverageCovered: false, coverageScore: 0.2, narratives: [item(1)], coverageGaps: ['x missing'] });
    expect(coverageState(b)).toBe('gap');
    expect(coverageReason(b)).toMatch(/🔴 Gap/);
  });
  it('covered → green; partial → yellow; empty → none', () => {
    expect(coverageState(bucket({ coverageCovered: true, coverageScore: 0.9, narratives: [item(1)] }))).toBe('covered');
    expect(coverageState(bucket({ coverageCovered: false, coverageScore: 0.6, narratives: [item(1)] }))).toBe('partial');
    expect(coverageState(bucket({ coverageCovered: null, coverageScore: null }))).toBe('none');
  });
});
