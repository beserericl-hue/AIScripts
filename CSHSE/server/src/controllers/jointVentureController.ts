import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { JointVenture, IJointVenture } from '../models/JointVenture';
import { Institution } from '../models/Institution';
import { Submission } from '../models/Submission';
import { recordAuditEvent } from '../services/auditLog';

// ---------------------------------------------------------------------------
// CR-019 / Sprint 8.1 — Joint Venture controller.
//
// Endpoints (all mounted under /api/joint-ventures):
//   GET    .                  — list (admin: all; non-admin: only JVs the
//                                user's institution is a member of)
//   POST   .                  — create (admin only; ≥2 institutions required)
//   GET    /:id               — read (admin always; member-institution
//                                viewer 200; non-member 404 — don't leak
//                                existence per the original CR spec)
//   PATCH  /:id               — update name/description (admin only)
//   POST   /:id/institutions  — add a member (admin only; rejects if
//                                already in another active JV)
//   DELETE /:id/institutions/:institutionId — remove a member (admin;
//                                auto-archives the JV if count drops <2)
//   POST   /:id/archive       — manual archive (admin; reason required)
//   GET    /:id/aggregate-stats — admin or member viewer; rolled-up
//                                  submission stats across members
//
// Reverse pointer: Institution.jointVentureId is maintained in sync
// (set on add; cleared on remove; cleared on archive) so the dashboard
// can group institutions by JV in one query.
// ---------------------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    institutionId?: string;
    isSuperuser?: boolean;
  };
}

function _isElevated(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'admin' || req.user?.isSuperuser === true;
}

function _actorName(req: AuthenticatedRequest): string {
  if (req.user?.name) return req.user.name;
  const first = req.user?.firstName || '';
  const last = req.user?.lastName || '';
  const full = `${first} ${last}`.trim();
  return full || req.user?.email || 'unknown';
}

async function _userInstitutionId(req: AuthenticatedRequest): Promise<string | null> {
  if (req.user?.institutionId) return String(req.user.institutionId);
  return null;
}

function _isMemberInstitution(jv: IJointVenture, institutionId: string | null): boolean {
  if (!institutionId) return false;
  return jv.institutionIds.some((id) => String(id) === institutionId);
}

async function _audit(req: AuthenticatedRequest, action: any, jv: IJointVenture, payload?: Record<string, unknown>, reason?: string) {
  void recordAuditEvent({
    action,
    actor: { id: req.user!.id, role: req.user!.role, name: _actorName(req) },
    targetType: 'submission' as any, // AuditTargetType doesn't have 'jointVenture'; reuse 'submission' shape per the existing audit model surface area.
    targetId: String(jv._id),
    payload: { jointVentureId: String(jv._id), jointVentureName: jv.name, ...(payload || {}) },
    reason
  });
}

// ===========================================================================
// CREATE
// ===========================================================================
export const createJointVenture = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can create a joint venture.' });
    }
    const { name, description, institutionIds } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!Array.isArray(institutionIds) || institutionIds.length < 2) {
      return res.status(400).json({ error: 'institutionIds must contain at least 2 institutions' });
    }
    const ids: mongoose.Types.ObjectId[] = [];
    for (const id of institutionIds) {
      if (typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: `invalid institutionId: ${id}` });
      }
      ids.push(new mongoose.Types.ObjectId(id));
    }
    if (new Set(ids.map((i) => String(i))).size !== ids.length) {
      return res.status(400).json({ error: 'institutionIds must be unique' });
    }

    // All institutions must exist + not already be in another active JV.
    const insts = await Institution.find({ _id: { $in: ids } }).select('_id name jointVentureId').lean();
    if (insts.length !== ids.length) {
      return res.status(400).json({ error: 'one or more institutionIds not found' });
    }
    const conflicts = insts.filter((i: any) => i.jointVentureId);
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'one or more institutions already belong to another active joint venture',
        conflictIds: conflicts.map((i: any) => String(i._id))
      });
    }
    if (await JointVenture.findOne({ name: name.trim() })) {
      return res.status(409).json({ error: 'name already in use' });
    }

    const jv = await JointVenture.create({
      name: name.trim(),
      description: typeof description === 'string' ? description.slice(0, 2000) : undefined,
      institutionIds: ids,
      archived: false,
      createdBy: new mongoose.Types.ObjectId(req.user!.id),
      createdByName: _actorName(req)
    });

    // Sync reverse pointer.
    await Institution.updateMany({ _id: { $in: ids } }, { $set: { jointVentureId: jv._id } });

    await _audit(req, 'jv.created', jv, { memberCount: ids.length });
    return res.status(201).json({ jointVenture: jv });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'name already in use' });
    }
    console.error('createJointVenture error:', err);
    return res.status(500).json({ error: 'Failed to create joint venture' });
  }
};

// ===========================================================================
// LIST
// ===========================================================================
export const listJointVentures = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const archivedRaw = String(req.query.archived ?? '').toLowerCase();
    const filter: any = {};
    if (archivedRaw === 'true') filter.archived = true;
    else if (archivedRaw === 'false') filter.archived = false;

    if (!_isElevated(req)) {
      // Non-admin: only JVs the user's institution is a member of.
      const myInst = await _userInstitutionId(req);
      if (!myInst) return res.json({ jointVentures: [] });
      filter.institutionIds = new mongoose.Types.ObjectId(myInst);
    }
    const rows = await JointVenture.find(filter).sort({ name: 1 }).lean();
    return res.json({ jointVentures: rows });
  } catch (err) {
    console.error('listJointVentures error:', err);
    return res.status(500).json({ error: 'Failed to list joint ventures' });
  }
};

// ===========================================================================
// READ ONE
// ===========================================================================
export const getJointVenture = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jv = await JointVenture.findById(req.params.id);
    if (!jv) return res.status(404).json({ error: 'Joint venture not found' });
    if (!_isElevated(req)) {
      const myInst = await _userInstitutionId(req);
      if (!_isMemberInstitution(jv, myInst)) {
        // Per the CR: don't leak existence to non-members → 404, not 403.
        return res.status(404).json({ error: 'Joint venture not found' });
      }
    }
    return res.json({ jointVenture: jv });
  } catch (err) {
    console.error('getJointVenture error:', err);
    return res.status(500).json({ error: 'Failed to load joint venture' });
  }
};

// ===========================================================================
// UPDATE name/description
// ===========================================================================
export const updateJointVenture = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can update a joint venture.' });
    }
    const jv = await JointVenture.findById(req.params.id);
    if (!jv) return res.status(404).json({ error: 'Joint venture not found' });

    const b = req.body || {};
    const prior = { name: jv.name, description: jv.description };
    if (typeof b.name === 'string') {
      const n = b.name.trim();
      if (!n) return res.status(400).json({ error: 'name cannot be empty' });
      if (n !== jv.name) {
        const dupe = await JointVenture.findOne({ name: n, _id: { $ne: jv._id } });
        if (dupe) return res.status(409).json({ error: 'name already in use' });
        jv.name = n;
      }
    }
    if ('description' in b) {
      jv.description = typeof b.description === 'string' ? b.description.slice(0, 2000) : undefined;
    }
    await jv.save();
    await _audit(req, 'jv.updated', jv, { prior });
    return res.json({ jointVenture: jv });
  } catch (err: any) {
    if (err?.code === 11000) return res.status(409).json({ error: 'name already in use' });
    console.error('updateJointVenture error:', err);
    return res.status(500).json({ error: 'Failed to update joint venture' });
  }
};

// ===========================================================================
// ADD MEMBER
// ===========================================================================
export const addMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can add a member.' });
    }
    const jv = await JointVenture.findById(req.params.id);
    if (!jv) return res.status(404).json({ error: 'Joint venture not found' });
    if (jv.archived) return res.status(400).json({ error: 'Cannot modify an archived joint venture.' });

    const { institutionId } = req.body || {};
    if (typeof institutionId !== 'string' || !mongoose.Types.ObjectId.isValid(institutionId)) {
      return res.status(400).json({ error: 'institutionId is required and must be a valid ObjectId' });
    }
    if (_isMemberInstitution(jv, institutionId)) {
      return res.status(409).json({ error: 'institution is already a member of this joint venture' });
    }
    const inst: any = await Institution.findById(institutionId).select('_id jointVentureId');
    if (!inst) return res.status(404).json({ error: 'Institution not found' });
    if (inst.jointVentureId) {
      return res.status(409).json({ error: 'institution already belongs to another active joint venture' });
    }

    jv.institutionIds.push(new mongoose.Types.ObjectId(institutionId) as any);
    await jv.save();
    inst.jointVentureId = jv._id;
    await inst.save();

    await _audit(req, 'jv.member_added', jv, { institutionId });
    return res.json({ jointVenture: jv });
  } catch (err) {
    console.error('addMember error:', err);
    return res.status(500).json({ error: 'Failed to add member' });
  }
};

// ===========================================================================
// REMOVE MEMBER
// ===========================================================================
export const removeMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can remove a member.' });
    }
    const jv = await JointVenture.findById(req.params.id);
    if (!jv) return res.status(404).json({ error: 'Joint venture not found' });
    if (jv.archived) return res.status(400).json({ error: 'Cannot modify an archived joint venture.' });

    const { institutionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(institutionId)) {
      return res.status(400).json({ error: 'invalid institutionId' });
    }
    if (!_isMemberInstitution(jv, institutionId)) {
      return res.status(404).json({ error: 'institution is not a member of this joint venture' });
    }

    jv.institutionIds = jv.institutionIds.filter((id) => String(id) !== institutionId) as any;
    await Institution.updateOne({ _id: institutionId }, { $unset: { jointVentureId: '' } });

    let autoArchived = false;
    if (jv.institutionIds.length < 2) {
      jv.archived = true;
      jv.archivedAt = new Date();
      jv.archivedReason = 'auto-archived: member count dropped below 2';
      // Clear all remaining members' pointer too (the JV is gone).
      if (jv.institutionIds.length > 0) {
        await Institution.updateMany(
          { _id: { $in: jv.institutionIds } },
          { $unset: { jointVentureId: '' } }
        );
      }
      autoArchived = true;
    }
    await jv.save();

    await _audit(req, 'jv.member_removed', jv, { institutionId, autoArchived, memberCount: jv.institutionIds.length });
    if (autoArchived) {
      await _audit(req, 'jv.archived', jv, { reason: 'auto', memberCount: jv.institutionIds.length });
    }
    return res.json({ jointVenture: jv, autoArchived });
  } catch (err) {
    console.error('removeMember error:', err);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
};

// ===========================================================================
// MANUAL ARCHIVE
// ===========================================================================
export const archiveJointVenture = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!_isElevated(req)) {
      return res.status(403).json({ error: 'Only admins can archive a joint venture.' });
    }
    const jv = await JointVenture.findById(req.params.id);
    if (!jv) return res.status(404).json({ error: 'Joint venture not found' });
    if (jv.archived) {
      return res.status(400).json({ error: 'Joint venture is already archived.' });
    }
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : undefined;

    // Clear reverse pointers on every member institution.
    if (jv.institutionIds.length > 0) {
      await Institution.updateMany(
        { _id: { $in: jv.institutionIds } },
        { $unset: { jointVentureId: '' } }
      );
    }

    jv.archived = true;
    jv.archivedAt = new Date();
    jv.archivedReason = reason;
    await jv.save();

    await _audit(req, 'jv.archived', jv, { reason: 'manual' }, reason);
    return res.json({ jointVenture: jv });
  } catch (err) {
    console.error('archiveJointVenture error:', err);
    return res.status(500).json({ error: 'Failed to archive joint venture' });
  }
};

// ===========================================================================
// AGGREGATE STATS
// ===========================================================================
export const aggregateStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jv = await JointVenture.findById(req.params.id);
    if (!jv) return res.status(404).json({ error: 'Joint venture not found' });
    if (!_isElevated(req)) {
      const myInst = await _userInstitutionId(req);
      if (!_isMemberInstitution(jv, myInst)) {
        return res.status(404).json({ error: 'Joint venture not found' });
      }
    }

    const memberIds = jv.institutionIds;
    const ACTIVE_STATUSES = ['submitted', 'under_review', 'readers_assigned', 'review_complete'];
    const TERMINAL_STATUSES = ['compliant', 'non_compliant'];
    const [total, active, terminal, upcomingVisits] = await Promise.all([
      Submission.countDocuments({ institutionId: { $in: memberIds } }),
      Submission.countDocuments({ institutionId: { $in: memberIds }, status: { $in: ACTIVE_STATUSES } }),
      Submission.countDocuments({ institutionId: { $in: memberIds }, status: { $in: TERMINAL_STATUSES } }),
      // SiteVisit lookups would go here; placeholder = 0 to keep the contract
      // stable. Wire siteVisits when the dashboard surfaces them.
      Promise.resolve(0)
    ]);

    return res.json({
      jointVentureId: String(jv._id),
      name: jv.name,
      memberCount: memberIds.length,
      stats: {
        totalSubmissions: total,
        activeSubmissions: active,
        decidedSubmissions: terminal,
        upcomingSiteVisits: upcomingVisits
      }
    });
  } catch (err) {
    console.error('aggregateStats error:', err);
    return res.status(500).json({ error: 'Failed to load joint venture stats' });
  }
};
