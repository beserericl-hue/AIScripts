import { Request, Response } from 'express';
import { User } from '../models/User';
import { Institution } from '../models/Institution';
import { Invitation } from '../models/Invitation';
import mongoose from 'mongoose';
import { isGlobalAdmin, institutionIdsWithRole, validateRoleAssignments } from '../services/roleResolver';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
    institutionId?: string;
    isSuperuser?: boolean;
    realIsSuperuser?: boolean;
    // CR-060 — per-institution role assignments (for role-by-institution scoping).
    roleAssignments?: Array<{ role: string; institutionId: string; institutionName?: string }>;
  };
}

/**
 * Get all users (Admin only, or filtered for other roles)
 */
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { role, institutionId, status, page = '1', limit = '50' } = req.query;
    const userRole = req.user?.role;

    // Build query based on user's role
    const query: any = {};

    // CR-060 — role-by-institution scoping. Global admins/superusers see all;
    // a lead reader (anywhere) sees the readers/PCs committee; a Program
    // Coordinator sees users at the institution(s) where they coordinate.
    if (!isGlobalAdmin(req.user)) {
      const leadInsts = institutionIdsWithRole(req.user, 'lead_reader');
      const pcInsts = institutionIdsWithRole(req.user, 'program_coordinator');
      if (leadInsts.length > 0) {
        query.role = { $in: ['reader', 'program_coordinator'] };
      } else if (pcInsts.length > 0) {
        query.institutionId = { $in: pcInsts.map((id) => new mongoose.Types.ObjectId(id)) };
      } else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Apply client filters WITHOUT escaping the role-based scope above.
    // SECURITY (isolation audit): these previously OVERWROTE query.role /
    // query.institutionId, letting a PC pass ?institutionId=<other institution>
    // to enumerate any institution's users, and a lead_reader pass ?role=admin
    // to enumerate admin/superuser accounts. Now a client filter may only
    // NARROW within the already-computed scope.
    if (status) query.status = status;
    if (role) {
      if (query.role?.$in && !query.role.$in.includes(role)) {
        return res.json({ users: [], total: 0, page: parseInt(page as string, 10) || 1, pages: 0 });
      }
      query.role = role;
    }
    if (institutionId) {
      if (query.institutionId?.$in) {
        const allowed = query.institutionId.$in.map((o: any) => o.toString());
        if (!allowed.includes(String(institutionId))) {
          return res.json({ users: [], total: 0, page: parseInt(page as string, 10) || 1, pages: 0 });
        }
      }
      query.institutionId = institutionId;
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .populate('institutionId', 'name type')
        .sort({ lastName: 1, firstName: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      User.countDocuments(query)
    ]);

    return res.json({
      users: users.map(user => {
        const populatedInstitution = user.institutionId as any;
        return {
          ...user,
          name: `${user.firstName} ${user.lastName}`,
          // Extract the raw institutionId from the populated object
          institutionId: populatedInstitution?._id?.toString() || null,
          institutionName: populatedInstitution?.name || user.institutionName
        };
      }),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Failed to get users' });
  }
};

/**
 * Get single user
 */
export const getUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    const user = await User.findById(id)
      .select('-passwordHash')
      .populate('institutionId', 'name type address')
      .populate('assignedSubmissions', 'submissionId institutionName status')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Permission check - extract ID from potentially populated object
    const populatedInstitution = user.institutionId as any;
    const institutionIdStr = populatedInstitution?._id?.toString() || populatedInstitution?.toString() || null;

    // SECURITY (isolation audit) — DEFAULT DENY. Previously only a PC was
    // blocked cross-institution; a reader/lead_reader fell through and could
    // read ANY user's PII (incl. admins/superusers and other institutions' PCs)
    // by id. Now: admin/superuser, self, PC-at-same-institution, or a
    // reader/lead viewing another reader/lead (committee) only.
    const isSelf = String((user as any)._id) === String(req.user?.id);
    const isAdmin = userRole === 'admin' || (req.user as any)?.isSuperuser === true;
    const targetRole = (user as any).role;
    let allowed = isAdmin || isSelf;
    if (!allowed && userRole === 'program_coordinator') {
      allowed = institutionIdStr === req.user?.institutionId;
    }
    if (!allowed && (userRole === 'lead_reader' || userRole === 'reader')) {
      allowed = targetRole === 'reader' || targetRole === 'lead_reader';
    }
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json({
      ...user,
      name: `${user.firstName} ${user.lastName}`,
      institutionId: institutionIdStr,
      institutionName: populatedInstitution?.name || user.institutionName
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
};

/**
 * Update user (Admin only, or self-update for limited fields)
 */
export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userRole = req.user?.role;
    const currentUserId = req.user?.id;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Self-update allowed for limited fields
    const isSelf = id === currentUserId;

    if (!isSelf && userRole !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Fields that users can update themselves
    const selfUpdateFields = ['firstName', 'lastName'];

    // Fields that only admin can update
    const adminOnlyFields = ['role', 'status', 'permissions', 'institutionId', 'isActive'];

    // SECURITY (isolation audit) — fields that must NEVER be settable through
    // this generic endpoint. `isSuperuser` was previously writable by any admin
    // (privilege escalation: a plain admin could POST {isSuperuser:true} on
    // itself); superuser is managed ONLY via the requireSuperuser-gated
    // /users/:id/superuser routes. roleAssignments has its own gated endpoint.
    const forbiddenFields = new Set(['isSuperuser', 'roleAssignments', 'superuser']);

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key === '_id' || key === 'passwordHash' || key === 'email') {
        return; // Skip immutable fields
      }
      if (forbiddenFields.has(key)) {
        return; // Never settable here — use the dedicated gated endpoints.
      }

      if (isSelf && !selfUpdateFields.includes(key) && userRole !== 'admin') {
        return; // Non-admin self-update restricted
      }

      if (adminOnlyFields.includes(key) && userRole !== 'admin') {
        return; // Admin-only fields
      }

      (user as any)[key] = updates[key];
    });

    await user.save();

    return res.json({
      message: 'User updated successfully',
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
};

/**
 * Disable user (Admin only)
 */
export const disableUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot disable your own account' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.status = 'disabled';
    user.isActive = false;
    await user.save();

    return res.json({
      message: 'User disabled successfully'
    });
  } catch (error) {
    console.error('Disable user error:', error);
    return res.status(500).json({ error: 'Failed to disable user' });
  }
};

/**
 * Re-enable user (Admin only)
 */
export const enableUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.status = 'active';
    user.isActive = true;
    await user.save();

    return res.json({
      message: 'User enabled successfully'
    });
  } catch (error) {
    console.error('Enable user error:', error);
    return res.status(500).json({ error: 'Failed to enable user' });
  }
};

/**
 * Get readers committee (Admin only)
 */
export const getReadersCommittee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && req.user?.role !== 'lead_reader') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const readers = await User.find({
      role: { $in: ['reader', 'lead_reader'] },
      status: 'active'
    })
      .select('firstName lastName email role status lastLogin assignedSubmissions')
      .populate('assignedSubmissions', 'submissionId institutionName status')
      .sort({ role: -1, lastName: 1 })
      .lean();

    const leadReaders = readers.filter(r => r.role === 'lead_reader');
    const regularReaders = readers.filter(r => r.role === 'reader');

    return res.json({
      leadReaders: leadReaders.map(r => ({
        ...r,
        name: `${r.firstName} ${r.lastName}`,
        assignmentCount: r.assignedSubmissions?.length || 0
      })),
      readers: regularReaders.map(r => ({
        ...r,
        name: `${r.firstName} ${r.lastName}`,
        assignmentCount: r.assignedSubmissions?.length || 0
      })),
      totals: {
        leadReaders: leadReaders.length,
        readers: regularReaders.length,
        total: readers.length
      }
    });
  } catch (error) {
    console.error('Get readers committee error:', error);
    return res.status(500).json({ error: 'Failed to get readers committee' });
  }
};

/**
 * Assign user to submission (Admin or Lead Reader)
 */
export const assignToSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'lead_reader') {
      return res.status(403).json({ error: 'Admin or Lead Reader access required' });
    }

    const { id } = req.params;
    const { submissionId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!['reader', 'lead_reader'].includes(user.role)) {
      return res.status(400).json({ error: 'Can only assign readers or lead readers' });
    }

    // Add submission to user's assignments
    const subId = new mongoose.Types.ObjectId(submissionId);
    if (!user.assignedSubmissions.some(s => s.equals(subId))) {
      user.assignedSubmissions.push(subId);
      await user.save();
    }

    return res.json({
      message: 'User assigned to submission',
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        assignedSubmissions: user.assignedSubmissions
      }
    });
  } catch (error) {
    console.error('Assign to submission error:', error);
    return res.status(500).json({ error: 'Failed to assign user' });
  }
};

/**
 * Remove user from submission (Admin or Lead Reader)
 */
export const removeFromSubmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'lead_reader') {
      return res.status(403).json({ error: 'Admin or Lead Reader access required' });
    }

    const { id } = req.params;
    const { submissionId } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subId = new mongoose.Types.ObjectId(submissionId);
    user.assignedSubmissions = user.assignedSubmissions.filter(s => !s.equals(subId));
    await user.save();

    return res.json({
      message: 'User removed from submission',
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        assignedSubmissions: user.assignedSubmissions
      }
    });
  } catch (error) {
    console.error('Remove from submission error:', error);
    return res.status(500).json({ error: 'Failed to remove user from submission' });
  }
};

// ============================================================================
// CR-060 — multi-role management. A user can hold different institution-scoped
// roles at different institutions (PC at A, Reader/Lead Reader at B). These are
// the authoritative source; the legacy single role/institutionId are kept as a
// DERIVED "primary" for display + the impersonation identity.
// ============================================================================

/** Derive the back-compat primary {role, institutionId, institutionName} from a
 *  user's role assignments. PC outranks lead_reader outranks reader. Admins are
 *  left untouched. */
function derivePrimary(assignments: Array<{ role: string; institutionId: any; institutionName?: string }>):
  { role: string; institutionId?: any; institutionName?: string } | null {
  if (!assignments || assignments.length === 0) return null;
  const order = ['program_coordinator', 'lead_reader', 'reader'];
  for (const role of order) {
    const hit = assignments.find((a) => a.role === role);
    if (hit) return { role, institutionId: hit.institutionId, institutionName: hit.institutionName };
  }
  return null;
}

/**
 * PUT /api/users/:id/role-assignments  (Admin only)
 * Body: { roleAssignments: [{ role, institutionId }] }
 * Replaces the user's full assignment list. Enforces Rule 1 (no PC + reviewer
 * at the same institution) via the roleResolver, normalizes (lead_reader
 * absorbs reader), stamps institution names, and refreshes the derived primary
 * role/institutionId. Best-effort syncs the legacy Institution roster fields so
 * existing reads stay consistent until the access-gate rollout (Phase 3).
 */
export const setUserRoleAssignments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin' && !(req.user as any)?.isSuperuser) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const input = Array.isArray(req.body?.roleAssignments) ? req.body.roleAssignments : [];
    const { ok, error, normalized } = validateRoleAssignments(input);
    if (!ok) return res.status(400).json({ error });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin' || user.isSuperuser) {
      return res.status(400).json({ error: 'Admins / superusers are global and do not take per-institution roles.' });
    }

    // Validate every institution exists + collect names.
    const instIds: string[] = [...new Set<string>(normalized.map((a: any) => String(a.institutionId)))];
    const insts = await Institution.find({ _id: { $in: instIds } }).select('name').lean();
    const nameById = new Map(insts.map((i: any) => [String(i._id), i.name]));
    if (insts.length !== instIds.length) {
      return res.status(400).json({ error: 'One or more institutions not found' });
    }

    const prevInstIds = new Set((user.roleAssignments || []).map((a: any) => String(a.institutionId)));

    user.roleAssignments = normalized.map((a: any) => ({
      role: a.role,
      institutionId: new mongoose.Types.ObjectId(String(a.institutionId)),
      institutionName: nameById.get(String(a.institutionId))
    })) as any;

    // Refresh the derived primary so legacy role/institutionId reads stay valid.
    const primary = derivePrimary(user.roleAssignments as any);
    if (primary) {
      user.role = primary.role as any;
      user.institutionId = primary.institutionId;
      user.institutionName = primary.institutionName;
    }
    user.markModified('roleAssignments');
    await user.save();

    // Best-effort legacy-field sync so the existing Institution-based reads /
    // dashboards stay consistent before Phase 3. (roleAssignments is canonical.)
    const touched = new Set<string>([...prevInstIds, ...instIds]);
    for (const instId of touched) {
      try {
        const inst = await Institution.findById(instId);
        if (!inst) continue;
        const myRoles = new Set(
          (user.roleAssignments || [])
            .filter((a: any) => String(a.institutionId) === instId)
            .map((a: any) => a.role)
        );
        const uid = user._id as mongoose.Types.ObjectId;
        // Readers array — add/remove this user.
        const isReader = myRoles.has('reader') || myRoles.has('lead_reader');
        const already = (inst.assignedReaderIds || []).some((r: any) => String(r) === String(uid));
        if (isReader && !already) inst.assignedReaderIds.push(uid);
        if (!isReader && already) inst.assignedReaderIds = inst.assignedReaderIds.filter((r: any) => String(r) !== String(uid));
        // Lead reader (single legacy slot) — set if this user leads + empty; clear if this user no longer leads.
        if (myRoles.has('lead_reader') && !inst.assignedLeadReaderId) inst.assignedLeadReaderId = uid;
        if (!myRoles.has('lead_reader') && String(inst.assignedLeadReaderId || '') === String(uid)) inst.assignedLeadReaderId = undefined as any;
        // PC (single legacy slot) — set if this user is PC + empty; clear if this user no longer PC.
        if (myRoles.has('program_coordinator') && !inst.programCoordinatorId) inst.programCoordinatorId = uid;
        if (!myRoles.has('program_coordinator') && String(inst.programCoordinatorId || '') === String(uid)) inst.programCoordinatorId = undefined as any;
        await inst.save();
      } catch { /* best-effort */ }
    }

    return res.json({
      message: 'Role assignments updated',
      user: {
        id: user._id,
        role: user.role,
        institutionId: user.institutionId,
        roleAssignments: user.roleAssignments
      }
    });
  } catch (error) {
    console.error('Set role assignments error:', error);
    return res.status(500).json({ error: 'Failed to update role assignments' });
  }
};

// ============================================================
// Superuser management (superuser-only; routes gate on requireSuperuser)
// ============================================================

// Every permission in the system — a superuser holds all of them (mirrors
// services/superuserInit.ts so a granted superuser is fully functional).
const ALL_PERMISSIONS = [
  'edit_self_study',
  'view_comments',
  'add_comments',
  'manage_users',
  'manage_institutions',
  'assign_readers',
  'schedule_site_visits',
  'approve_changes',
] as const;

/** True if `email` is the env-bootstrap superuser (SU_EMAIL). That account is
 *  re-promoted on every server start, so revoking it is futile — we protect it. */
function isBootstrapSuperuserEmail(email?: string): boolean {
  const su = (process.env.SU_EMAIL || '').trim().toLowerCase();
  return !!su && !!email && email.trim().toLowerCase() === su;
}

function superuserSummary(u: any) {
  return {
    id: u._id,
    email: u.email,
    name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
    role: u.role,
    isSuperuser: u.isSuperuser === true,
    isBootstrap: isBootstrapSuperuserEmail(u.email),
  };
}

/** GET /api/users/superusers — list current superusers (superuser-only). */
export const listSuperusers = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const supers = await User.find({ isSuperuser: true })
      .select('email firstName lastName role isSuperuser')
      .sort({ lastName: 1, firstName: 1 })
      .lean();
    return res.json({ superusers: supers.map(superuserSummary) });
  } catch (error) {
    console.error('List superusers error:', error);
    return res.status(500).json({ error: 'Failed to list superusers' });
  }
};

/** POST /api/users/:id/superuser — grant superuser (superuser-only).
 *  A superuser is global admin with all permissions, so we align those fields
 *  the same way the bootstrap does, guaranteeing the account actually works. */
export const grantSuperuser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.isSuperuser) {
      return res.json({ message: 'Already a superuser', user: superuserSummary(user) });
    }

    user.isSuperuser = true;
    user.role = 'admin';
    user.status = 'active' as any;
    user.isActive = true;
    user.permissions = [...ALL_PERMISSIONS] as any;
    await user.save();

    console.log(
      `[superuser] GRANTED to ${user.email} by ${req.user?.id} (${req.user?.name})`
    );
    return res.json({ message: 'Superuser granted', user: superuserSummary(user) });
  } catch (error) {
    console.error('Grant superuser error:', error);
    return res.status(500).json({ error: 'Failed to grant superuser' });
  }
};

/** DELETE /api/users/:id/superuser — revoke superuser (superuser-only).
 *  Cannot revoke yourself (no accidental lockout) or the env-bootstrap account
 *  (it returns on the next restart anyway). Role/permissions are left as admin;
 *  further downgrade is done through the normal role UI. */
export const revokeSuperuser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (String(user._id) === String(req.user?.id)) {
      return res.status(400).json({ error: 'You cannot remove your own superuser access.' });
    }
    if (isBootstrapSuperuserEmail(user.email)) {
      return res.status(400).json({
        error: 'This is the built-in bootstrap superuser (set via server config) and cannot be removed here.',
      });
    }
    if (!user.isSuperuser) {
      return res.json({ message: 'Not a superuser', user: superuserSummary(user) });
    }

    user.isSuperuser = false;
    await user.save();

    console.log(
      `[superuser] REVOKED from ${user.email} by ${req.user?.id} (${req.user?.name})`
    );
    return res.json({ message: 'Superuser removed', user: superuserSummary(user) });
  } catch (error) {
    console.error('Revoke superuser error:', error);
    return res.status(500).json({ error: 'Failed to remove superuser' });
  }
};
