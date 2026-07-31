/**
 * inferProgramLevel — read the degree level from a program NAME so imports stop
 * blind-defaulting associate/masters programs to baccalaureate.
 *
 * Regression: Metropolitan Community College's "ASSOCIATE DEGREE IN HUMAN
 * SERVICES v2025" was stored as programLevel='bachelors', so the level-aware
 * spec catalog served baccalaureate Standard 12 (a–h) and the rail showed
 * phantom "12.g"/"12.h" rows. The name plainly says "ASSOCIATE".
 */
import { describe, expect, it } from 'vitest';
import { inferProgramLevel } from '../../src/data/levelStandards';

describe('inferProgramLevel', () => {
  it('reads ASSOCIATE from the reported MCC program name', () => {
    expect(inferProgramLevel('ASSOCIATE DEGREE IN HUMAN SERVICES v2025')).toBe('associate');
  });

  it('classifies the three degree levels by their spelled-out words', () => {
    expect(inferProgramLevel('Associate of Applied Science in Human Services')).toBe('associate');
    expect(inferProgramLevel('Bachelor of Science in Human Services')).toBe('bachelors');
    expect(inferProgramLevel('Baccalaureate Human Services Program')).toBe('bachelors');
    expect(inferProgramLevel("Master's in Human Services")).toBe('masters');
    expect(inferProgramLevel('Master of Social Work')).toBe('masters');
  });

  it('reads dotted degree abbreviations', () => {
    expect(inferProgramLevel('A.A. Human Services')).toBe('associate');
    expect(inferProgramLevel('B.S. Human Services')).toBe('bachelors');
    expect(inferProgramLevel('M.S.W. Program')).toBe('masters');
    expect(inferProgramLevel('AAS Human Services')).toBe('associate');
  });

  it('does NOT false-match bare words like "as" or "ba" in a title', () => {
    // "as" appears but must not trigger 'associate'; no degree word → default.
    expect(inferProgramLevel('Human Services as a Profession')).toBe('bachelors');
  });

  it('falls back to bachelors only when the name is indeterminate', () => {
    expect(inferProgramLevel('Human Services Program')).toBe('bachelors');
    expect(inferProgramLevel('')).toBe('bachelors');
    expect(inferProgramLevel(null)).toBe('bachelors');
  });
});
