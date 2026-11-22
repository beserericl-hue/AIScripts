/**
 * Text for the orange "Viewing as" banner shown while a superuser impersonates.
 *
 * It must name the role ACTUALLY in effect. A multi-role user (e.g. Program
 * Coordinator at Kennesaw + Reader at Stevenson) can switch to another
 * "role · institution" while being impersonated; the banner used to keep showing
 * the impersonated user's PRIMARY role ("program coordinator") after switching
 * to Reader · Stevenson (2026-11-22).
 */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  program_coordinator: 'Program Coordinator',
  lead_reader: 'Lead Reader',
  reader: 'Reader',
  board: 'CSHSE Board',
};

export function roleLabel(role?: string | null): string {
  if (!role) return '';
  return ROLE_LABELS[role] || role.replace(/_/g, ' ');
}

export function impersonationBannerLabel(args: {
  impersonatedUser?: { firstName?: string; lastName?: string; institutionName?: string } | null;
  impersonatedRole?: string | null;
  activeContext?: { role: string; institutionName?: string } | null;
}): string {
  const { impersonatedUser, impersonatedRole, activeContext } = args;
  const role = roleLabel(activeContext?.role || impersonatedRole);
  if (!impersonatedUser) return role;
  const name = `${impersonatedUser.firstName || ''} ${impersonatedUser.lastName || ''}`.trim();
  // No role chosen yet → the user's primary role at their primary institution,
  // which is exactly what the header's role switcher shows.
  const inst = activeContext ? activeContext.institutionName : impersonatedUser.institutionName;
  const where = inst ? ` · ${inst}` : '';
  return `${name} (${role}${where})`;
}
