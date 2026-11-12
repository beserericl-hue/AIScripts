import { describe, it, expect } from 'vitest';
import { summaryNames } from './institutionPeople';

describe('institution card summary agrees with the roster', () => {
  it('POSITIVE: no legacy coordinator field but one on the roster → shows the roster name', () => {
    expect(summaryNames(null, [{ _id: 'u1', firstName: 'Nicole', lastName: 'Williams' }])).toEqual(['Nicole Williams']);
  });
  it('legacy field first, roster de-duplicated', () => {
    expect(summaryNames({ _id: 'u1', firstName: 'Nicole', lastName: 'Williams' }, [{ _id: 'u1', firstName: 'Nicole', lastName: 'Williams' }, { _id: 'u2', firstName: 'Ann', lastName: 'Lee' }])).toEqual(['Nicole Williams', 'Ann Lee']);
  });
  it('NEGATIVE: nobody anywhere → empty (card says "No coordinator assigned")', () => {
    expect(summaryNames(undefined, [])).toEqual([]);
  });
});
