// Who coordinates / leads an institution, for the Settings → Institutions card.
// The legacy single-slot fields (programCoordinatorId / assignedLeadReaderId)
// are often empty now that people are assigned role-by-institution
// (User.roleAssignments) — the roster below the card. The card summary must
// agree with that roster, so it falls back to it.

export interface PersonLike {
  _id?: string;
  firstName?: string;
  lastName?: string;
}

export function fullName(p: PersonLike): string {
  return `${p.firstName || ''} ${p.lastName || ''}`.trim();
}

/** Names for the card line: the legacy field first, else everyone on the roster. */
export function summaryNames(legacy: PersonLike | null | undefined, roster: PersonLike[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (p: PersonLike | null | undefined) => {
    if (!p) return;
    const n = fullName(p);
    const key = String(p._id || n);
    if (!n || seen.has(key)) return;
    seen.add(key);
    names.push(n);
  };
  add(legacy);
  roster.forEach(add);
  return names;
}

/**
 * The institution's lead readers: everyone with a lead_reader assignment there
 * (the roster) PLUS the legacy single-slot lead (`assignedLeadReaderId`), which
 * is a real assignment — submit auto-assigns the lead from it. Slot-only people
 * are marked `slotOnly` so removing them clears the slot. The card line and the
 * Lead Readers list both use this, so they always agree.
 */
export function leadReadersFor<T extends PersonLike>(
  slot: PersonLike | string | null | undefined,
  roster: T[],
  allUsers: T[] = []
): Array<T & { slotOnly?: boolean }> {
  const out: Array<T & { slotOnly?: boolean }> = roster.map((p) => ({ ...p }));
  if (!slot) return out;
  const slotId = typeof slot === 'string' ? slot : String(slot._id || '');
  if (!slotId || out.some((p) => String(p._id) === slotId)) return out;
  const person = (allUsers.find((u) => String(u._id) === slotId) || (typeof slot === 'string' ? null : slot)) as T | null;
  if (person && fullName(person)) out.unshift({ ...person, _id: slotId, slotOnly: true });
  return out;
}
