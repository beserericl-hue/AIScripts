/**
 * Coverage explanations are shown in full (Kennesaw, Oct 2026): the tip now
 * scrolls, so points are no longer cut at 180 characters or capped at 3–5.
 */
import { describe, it, expect } from 'vitest';
import { coverageReason } from './SpecRail';

const long = 'Incomplete visit frequency compliance: narrative states visits occur each semester for HS 4950 but does not confirm this meets no less than one site visit per quarter or semester as required, nor how virtual visits are documented for HS 3000.';

describe('coverageReason', () => {
  it('shows every gap and strength in full (no "…" truncation, no 3–5 cap)', () => {
    const b: any = { narratives: [{ id: 'n' }], evidenceText: [], evidenceFiles: [], coverageScore: 0.55,
      coverageGaps: [long, 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'], coverageStrengths: ['s1', 's2', 's3', 's4'] };
    const t = coverageReason(b);
    expect(long.length).toBeGreaterThan(180);
    expect(t).toContain(long);
    expect(t).not.toContain('…');
    for (const x of ['g6', 'g7', 's4']) expect(t).toContain(`•  ${x}`);
  });
});
