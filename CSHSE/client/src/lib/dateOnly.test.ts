import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import { dateOnly } from './dateOnly';

describe('dateOnly', () => {
  it('keeps the stored calendar day for UTC-midnight values (no day-early shift)', () => {
    expect(format(dateOnly('2027-03-10T00:00:00.000Z'), 'yyyy-MM-dd')).toBe('2027-03-10');
    expect(format(dateOnly('2027-03-10'), 'yyyy-MM-dd')).toBe('2027-03-10');
    expect(format(dateOnly(new Date('2027-03-10T00:00:00.000Z')), 'yyyy-MM-dd')).toBe('2027-03-10');
    expect(dateOnly('2027-03-10T00:00:00.000Z').getHours()).toBe(0);
  });
  it('negative: naive new Date() of the same value is NOT safe in a western time zone', () => {
    // Under TZ=America/New_York (set in this test run) the naive parse is the 9th.
    const naive = format(new Date('2027-03-10T00:00:00.000Z'), 'yyyy-MM-dd');
    if (new Date('2027-03-10T00:00:00.000Z').getTimezoneOffset() > 0) expect(naive).toBe('2027-03-09');
  });
  it('empty / invalid input gives an invalid Date', () => {
    expect(isNaN(dateOnly(undefined).getTime())).toBe(true);
    expect(isNaN(dateOnly('nope').getTime())).toBe(true);
  });
});
