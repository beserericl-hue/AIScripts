import { describe, it, expect } from 'vitest';
import { computeSpecGate, notReadyReasons, specStateOf } from './submitReadiness';

// Same fixture semantics as server tests/integration/submit-readiness-consistency.test.ts.
const standards = [
  { code: '1', specifications: [{ code: 'a' }, { code: 'b' }, { code: 'c' }] },
  { code: '2', specifications: [{ code: 'a' }, { code: 'b' }] },
];

describe('computeSpecGate (client mirror of the server rule)', () => {
  it('counts only catalog specs — intro / standard-level rows never inflate it', () => {
    const g = computeSpecGate(standards, {
      '1_a': { verdict: 'pass' }, '1_b': { verdict: 'pass' }, '1_c': { verdict: 'pass' },
      '2_a': { verdict: 'pass' }, '2_b': { verdict: 'pass' },
      '1': { status: 'complete' }, intro_document: { validationStatus: 'pass' }, '9_z': { verdict: 'pass' },
    });
    expect(g.total).toBe(5);
    expect(g.validated).toBe(5);
    expect(g.specsReady).toBe(true);
  });
  it('needs improvement validates; N/A leaves the denominator; fail and unevaluated block', () => {
    const g = computeSpecGate(standards, {
      '1_a': { verdict: 'needs_improvement', validationStatus: 'fail' },
      '1_b': { excluded: true },
      '1_c': { verdict: 'fail' },
      '2_a': { validationStatus: 'pass' }, // legacy row
    });
    expect(g).toMatchObject({ total: 4, excluded: 1, passed: 1, needsImprovement: 1, validated: 2, failed: 1, notEvaluated: 1, evaluated: 3, specsReady: false });
  });
  it('open numbered parts block readiness', () => {
    const all = { '1_a': { verdict: 'pass' }, '1_b': { verdict: 'pass' }, '1_c': { verdict: 'pass' }, '2_a': { verdict: 'pass' }, '2_b': { verdict: 'pass' } };
    expect(computeSpecGate(standards, all, (s, p) => (s === '1' && p === 'a' ? 2 : 0))).toMatchObject({ partsOpen: 1, specsReady: false });
  });
  it('status of a status-only "validated" row with no AI verdict is not_evaluated', () => {
    expect(specStateOf({ status: 'validated' })).toBe('not_evaluated');
  });
  it('reasons', () => {
    expect(notReadyReasons({ total: 96, validated: 95, partsOpen: 0 }, 1)).toEqual(['1 specification still to validate', '1 file not assigned to a Standard']);
    expect(notReadyReasons({ total: 96, validated: 96, partsOpen: 0 }, 0)).toEqual([]);
  });
});
