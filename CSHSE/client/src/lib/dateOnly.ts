// Date-only values (a site visit's scheduledDate) are stored as UTC midnight
// ("2027-03-10T00:00:00.000Z"). Rendering that with `new Date(v)` in a US time
// zone shows the PREVIOUS day. dateOnly() returns a local Date on the same
// calendar day the value names, so format()/toLocaleDateString() print it right.
export function dateOnly(value: string | Date | null | undefined): Date {
  if (value == null || value === '') return new Date(NaN);
  if (value instanceof Date) {
    return new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return isNaN(d.getTime()) ? d : new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
