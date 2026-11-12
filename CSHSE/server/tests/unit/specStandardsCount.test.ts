import { describe, it, expect } from 'vitest';
import { catalogStandardsCount } from '../../src/controllers/specController';

describe('spec card standards count comes from the CSHSE catalog', () => {
  it('Associate 20, Baccalaureate 21, Master’s 18', () => {
    expect(catalogStandardsCount('ASSOCIATE DEGREE IN HUMAN SERVICES')).toBe(20);
    expect(catalogStandardsCount('BACCALAUREATE DEGREE IN HUMAN SERVICES')).toBe(21);
    expect(catalogStandardsCount('MASTER’S DEGREE IN HUMAN SERVICES')).toBe(18);
    expect(catalogStandardsCount("Master's Degree")).toBe(18);
  });
  it('NEGATIVE: a name without a degree level keeps the stored count', () => {
    expect(catalogStandardsCount('Draft spec')).toBeNull();
    expect(catalogStandardsCount('')).toBeNull();
  });
});
