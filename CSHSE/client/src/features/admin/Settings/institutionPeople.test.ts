import { describe, it, expect } from 'vitest';
import { summaryNames, leadReadersFor } from './institutionPeople';

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

describe('lead readers: the card line and the Lead Readers list use one source', () => {
  const lead = { _id: 'L1', firstName: 'Lead', lastName: 'Assigned' };
  it('POSITIVE: a lead set only on the institution slot appears in the list too (marked slot-only)', () => {
    const out = leadReadersFor(lead, []);
    expect(out.map((p) => `${p.firstName} ${p.lastName}`)).toEqual(['Lead Assigned']);
    expect(out[0].slotOnly).toBe(true);
  });
  it('slot given as a bare id resolves the name from the users list', () => {
    expect(leadReadersFor('L1', [], [lead as any])[0]).toMatchObject({ _id: 'L1', firstName: 'Lead', slotOnly: true });
  });
  it('NEGATIVE: the same person on slot and roster is listed once, not as slot-only', () => {
    const out = leadReadersFor(lead, [lead]);
    expect(out).toHaveLength(1);
    expect(out[0].slotOnly).toBeUndefined();
  });
  it('NEGATIVE: no slot and no roster → nobody (card says "No lead reader", list says None)', () => {
    expect(leadReadersFor(null, [])).toEqual([]);
    expect(leadReadersFor('ghost', [], [])).toEqual([]);
  });
});
