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
