/**
 * CR-060 — multi-role resolution.
 *
 * A user can hold different institution-scoped roles at different institutions
 * (Program Coordinator at A, Reader/Lead Reader at B). The authoritative source
 * is `user.roleAssignments: [{ role, institutionId }]`. `admin` / superuser are
 * GLOBAL (not in roleAssignments) and are handled by callers via isElevated.
 *
 * These helpers answer "what role(s) does this user have AT this institution?"
 * and enforce the two business rules:
 *   Rule 1 — within ONE institution a user may NOT be program_coordinator AND a
 *            reviewer (reader/lead_reader). Cross-institution mixing is allowed.
 *   Rule 2 — MULTIPLE users may be program_coordinator at the same institution
 *            (no uniqueness — enforced by simply allowing it everywhere).
 *
 * They accept any "role bearer" — a Mongoose User doc OR req.user — so the same
 * logic runs in controllers and in the auth layer.
 */

export type InstitutionScopedRole = 'program_coordinator' | 'reader' | 'lead_reader';

export interface RoleAssignmentLike {
  role: InstitutionScopedRole | string;
  institutionId: unknown;
}

export interface RoleBearer {
  role?: string;
  // Legacy single-institution scope (pre-CR-060 / un-migrated users). Used as a
  // fallback when roleAssignments is empty.
  institutionId?: unknown;
  isSuperuser?: boolean;
  realIsSuperuser?: boolean;
  roleAssignments?: RoleAssignmentLike[] | null;
}

const SCOPED_ROLES: ReadonlySet<string> = new Set(['program_coordinator', 'reader', 'lead_reader']);

/**
 * The bearer's effective assignments. Prefers `roleAssignments`; if those are
 * absent/empty, falls back to the LEGACY single `role` + `institutionId` (so a
 * user the CR-060 migration hasn't touched, or one created through an old code
 * path, still resolves correctly). Admin/superuser have no institution-scoped
 * assignment here (handled separately via isGlobalAdmin).
 */
function effectiveAssignments(u: RoleBearer | null | undefined): RoleAssignmentLike[] {
  const ra = u?.roleAssignments || [];
  if (ra.length > 0) return ra;
  if (u && u.role && SCOPED_ROLES.has(u.role) && u.institutionId) {
    return [{ role: u.role, institutionId: u.institutionId }];
  }
  return [];
}

/** Normalize any id-ish value (ObjectId | string | populated doc) to a string. */
export function idStr(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const anyV = v as any;
  if (anyV._id) return String(anyV._id);
  return String(v);
}

/**
 * True when the bearer has GLOBAL admin power right now. Uses the EFFECTIVE
 * `isSuperuser` (false while a superuser impersonates a non-admin) plus the
 * 'admin' role, so an impersonated non-admin does NOT get global access.
 */
export function isGlobalAdmin(u: RoleBearer | null | undefined): boolean {
  if (!u) return false;
  return u.role === 'admin' || u.isSuperuser === true;
}

/** The set of institution-scoped roles the bearer holds AT institutionId. */
export function rolesAt(u: RoleBearer | null | undefined, institutionId: unknown): Set<string> {
  const out = new Set<string>();
  if (!u) return out;
  const target = idStr(institutionId);
  if (!target) return out;
  for (const a of effectiveAssignments(u)) {
    if (idStr(a.institutionId) === target) out.add(String(a.role));
  }
  return out;
}

/**
 * Does the bearer hold `role` at `institutionId`? PURE — it does NOT short-
 * circuit on admin; callers combine it with their own isElevated/admin check so
 * existing "admin can also do X" behavior stays explicit. lead_reader satisfies
 * a `reader` requirement (a lead reader is a reader).
 */
export function hasRoleAt(
  u: RoleBearer | null | undefined,
  role: InstitutionScopedRole,
  institutionId: unknown
): boolean {
  const roles = rolesAt(u, institutionId);
  if (roles.has(role)) return true;
  if (role === 'reader' && roles.has('lead_reader')) return true;
  return false;
}

/** Distinct institution ids (as strings) where the bearer holds ANY role. */
export function accessibleInstitutionIds(u: RoleBearer | null | undefined): string[] {
  const set = new Set<string>();
  for (const a of effectiveAssignments(u)) {
    const id = idStr(a.institutionId);
    if (id) set.add(id);
  }
  return [...set];
}

/** Institution ids (as strings) where the bearer holds the given role. */
export function institutionIdsWithRole(
  u: RoleBearer | null | undefined,
  role: InstitutionScopedRole
): string[] {
  const set = new Set<string>();
  for (const a of effectiveAssignments(u)) {
    if (a.role === role || (role === 'reader' && a.role === 'lead_reader')) {
      const id = idStr(a.institutionId);
      if (id) set.add(id);
    }
  }
  return [...set];
}

export interface NormalizedAssignment {
  role: InstitutionScopedRole;
  institutionId: string;
}

export interface ValidateResult {
  ok: boolean;
  error?: string;
  /** De-duplicated + normalized assignments (lead_reader absorbs reader). */
  normalized: NormalizedAssignment[];
}

/**
 * Validate + normalize a proposed set of role assignments:
 *  - drops blanks / unknown roles,
 *  - collapses duplicates and (reader + lead_reader at the same institution) to
 *    lead_reader,
 *  - Rule 1: rejects program_coordinator together with any reviewer role at the
 *    SAME institution.
 * Returns the normalized list on success, or an error string on a Rule-1 clash.
 */
export function validateRoleAssignments(
  assignments: Array<{ role?: string; institutionId?: unknown }>
): ValidateResult {
  // institutionId -> set of roles
  const byInst = new Map<string, Set<string>>();
  for (const a of (assignments || [])) {
    const role = String(a?.role || '');
    const inst = idStr(a?.institutionId);
    if (!inst) continue;
    if (role !== 'program_coordinator' && role !== 'reader' && role !== 'lead_reader') continue;
    if (!byInst.has(inst)) byInst.set(inst, new Set());
    byInst.get(inst)!.add(role);
  }

  const normalized: NormalizedAssignment[] = [];
  for (const [inst, roles] of byInst) {
    const isPC = roles.has('program_coordinator');
    const isReviewer = roles.has('reader') || roles.has('lead_reader');
    if (isPC && isReviewer) {
      return {
        ok: false,
        normalized: [],
        error:
          'A user cannot be a Program Coordinator and a Reader/Lead Reader at the same institution. ' +
          'Assign the reviewer role at a different institution.'
      };
    }
    if (isPC) {
      normalized.push({ role: 'program_coordinator', institutionId: inst });
    } else if (roles.has('lead_reader')) {
      // lead_reader implies reader — keep only lead_reader.
      normalized.push({ role: 'lead_reader', institutionId: inst });
    } else if (roles.has('reader')) {
      normalized.push({ role: 'reader', institutionId: inst });
    }
  }
  return { ok: true, normalized };
}
