import { Response } from 'express';
import { Institution } from '../models/Institution';
import { Invitation } from '../models/Invitation';
import { User } from '../models/User';
import { Spec } from '../models/Spec';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth';
import { isGlobalAdmin, accessibleInstitutionIds } from '../services/roleResolver';

/**
 * Get all institutions
 */
export const getInstitutions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, hasActiveSubmission, status, programCoordinatorId, page = '1', limit = '50' } = req.query;

    const query: any = {};
    // SECURITY (isolation audit) — was unscoped: any authenticated user listed
    // every institution + coordinator/lead PII. Non-admins are restricted to
    // the institutions they have a role at.
    if (!isGlobalAdmin(req.user)) {
      const allowed = accessibleInstitutionIds(req.user).map((s) => new mongoose.Types.ObjectId(String(s)));
      query._id = { $in: allowed };
    }
    if (type) query.type = type;
    if (status) query.status = status;
    if (programCoordinatorId) query.programCoordinatorId = programCoordinatorId;
    if (hasActiveSubmission === 'true') {
      query.currentSubmissionId = { $exists: true, $ne: null };
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [institutions, total] = await Promise.all([
      Institution.find(query)
        .populate('programCoordinatorId', 'firstName lastName email')
        .populate('assignedLeadReaderId', 'firstName lastName email')
        // The dashboard's deadlines table lists readers by name.
        .populate('assignedReaderIds', 'firstName lastName email')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Institution.countDocuments(query)
    ]);

    return res.json({
      institutions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get institutions error:', error);
    return res.status(500).json({ error: 'Failed to get institutions' });
  }
};

/**
 * Get single institution
 */
export const getInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // SECURITY (isolation audit) — was unscoped: any authenticated user read
    // any institution incl. its full current submission + coordinator PII.
    if (!isGlobalAdmin(req.user)) {
      const allowed = accessibleInstitutionIds(req.user).map((s) => String(s));
      if (!allowed.includes(String(id))) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const institution = await Institution.findById(id)
      .populate('programCoordinatorId', 'firstName lastName email')
      .populate('assignedLeadReaderId', 'firstName lastName email')
      .populate('assignedReaderIds', 'firstName lastName email')
      .populate('currentSubmissionId')
      .populate('specId', 'name version status')
      .lean();

    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    return res.json({ institution });
  } catch (error) {
    console.error('Get institution error:', error);
    return res.status(500).json({ error: 'Failed to get institution' });
  }
};

/**
 * Create a new institution (Admin or superuser only - enforced by route middleware)
 */
export const createInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      type,
      address,
      primaryContact,
      website,
      accreditationDeadline,
      specId,
      programCoordinatorEmail,
      programCoordinatorName
    } = req.body;

    // Check if institution already exists
    const existing = await Institution.findOne({ name });
    if (existing) {
      return res.status(409).json({ error: 'Institution with this name already exists' });
    }

    // Get spec name if specId provided
    let specName: string | undefined;
    if (specId) {
      const spec = await Spec.findById(specId);
      if (spec) {
        specName = `${spec.name} v${spec.version}`;
      }
    }

    // Create institution
    const institution = new Institution({
      name,
      type,
      address,
      primaryContact,
      website,
      accreditationDeadline: accreditationDeadline ? new Date(accreditationDeadline) : undefined,
      specId: specId ? new mongoose.Types.ObjectId(specId) : undefined,
      specName,
      status: 'active'
    });

    await institution.save();

    // If program coordinator email is provided, create invitation
    let invitation = null;
    if (programCoordinatorEmail && programCoordinatorName) {
      invitation = new Invitation({
        email: programCoordinatorEmail,
        name: programCoordinatorName,
        role: 'program_coordinator',
        institutionId: institution._id,
        institutionName: institution.name,
        invitedBy: req.user!.id,
        invitedByName: req.user!.name,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      });

      await invitation.save();

      // TODO: Send invitation email
      // await sendInvitationEmail(invitation);
    }

    return res.status(201).json({
      message: 'Institution created' + (invitation ? ' and invitation sent to program coordinator' : ''),
      institution,
      invitation: invitation ? {
        id: invitation._id,
        email: invitation.email,
        expiresAt: invitation.expiresAt
      } : undefined
    });
  } catch (error: any) {
    console.error('Create institution error:', error);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e: any) => e.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: messages
      });
    }

    return res.status(500).json({ error: 'Failed to create institution' });
  }
};

/**
 * Update an institution (Admin or superuser only - enforced by route middleware)
 */
export const updateInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const institution = await Institution.findById(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    // Handle specId update - get spec name
    if (updates.specId && updates.specId !== institution.specId?.toString()) {
      const spec = await Spec.findById(updates.specId);
      if (spec) {
        updates.specName = `${spec.name} v${spec.version}`;
        updates.specId = new mongoose.Types.ObjectId(updates.specId);
      }
    } else if (updates.specId === '') {
      // Clear spec assignment
      updates.specId = undefined;
      updates.specName = undefined;
    }

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && updates[key] !== undefined) {
        (institution as any)[key] = updates[key];
      }
    });

    await institution.save();

    return res.json({
      message: 'Institution updated successfully',
      institution
    });
  } catch (error) {
    console.error('Update institution error:', error);
    return res.status(500).json({ error: 'Failed to update institution' });
  }
};

/**
 * Archive an institution (Admin or superuser only - enforced by route middleware)
 */
export const archiveInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const institution = await Institution.findById(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    institution.status = 'archived';
    await institution.save();

    return res.json({
      message: 'Institution archived successfully',
      institution
    });
  } catch (error) {
    console.error('Archive institution error:', error);
    return res.status(500).json({ error: 'Failed to archive institution' });
  }
};

/**
 * Assign lead reader to institution (Admin or superuser only - enforced by route middleware)
 */
export const assignLeadReader = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { leadReaderId } = req.body;

    const institution = await Institution.findById(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    const leadReader = await User.findById(leadReaderId);
    if (!leadReader || leadReader.role !== 'lead_reader') {
      return res.status(400).json({ error: 'Invalid lead reader' });
    }

    institution.assignedLeadReaderId = new mongoose.Types.ObjectId(leadReaderId);
    await institution.save();

    // Keep the canonical role-by-institution roster in step with the legacy
    // slot: the Settings → Institutions "Lead Readers" list reads
    // User.roleAssignments, so a lead set only on the slot showed on the card
    // but not in the list. (A PC at the same institution can't also review.)
    const ras: any[] = (leadReader as any).roleAssignments || [];
    const atInst = ras.filter((a) => String(a.institutionId) === String(institution._id));
    if (!atInst.some((a) => a.role === 'lead_reader') && !atInst.some((a) => a.role === 'program_coordinator')) {
      (leadReader as any).roleAssignments = [
        ...ras,
        { role: 'lead_reader', institutionId: institution._id, institutionName: institution.name },
      ];
      await leadReader.save();
    }

    // TODO: Send notification email to lead reader

    return res.json({
      message: 'Lead reader assigned successfully',
      institution
    });
  } catch (error) {
    console.error('Assign lead reader error:', error);
    return res.status(500).json({ error: 'Failed to assign lead reader' });
  }
};

/**
 * Clear the institution's lead-reader slot (Admin only). Also removes that
 * user's lead_reader assignment at this institution so the roster agrees.
 */
export const unassignLeadReader = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const institution = await Institution.findById(req.params.id);
    if (!institution) return res.status(404).json({ error: 'Institution not found' });
    const prev = institution.assignedLeadReaderId;
    institution.assignedLeadReaderId = undefined as any;
    await institution.save();
    if (prev) {
      const u: any = await User.findById(prev);
      if (u && Array.isArray(u.roleAssignments)) {
        const next = u.roleAssignments.filter(
          (a: any) => !(String(a.institutionId) === String(institution._id) && a.role === 'lead_reader')
        );
        if (next.length !== u.roleAssignments.length) {
          u.roleAssignments = next;
          await u.save();
        }
      }
    }
    return res.json({ message: 'Lead reader unassigned', institution });
  } catch (error) {
    console.error('Unassign lead reader error:', error);
    return res.status(500).json({ error: 'Failed to unassign lead reader' });
  }
};

/**
 * Assign readers to institution (Admin or superuser only - enforced by route middleware)
 */
export const assignReaders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { readerIds } = req.body;

    const institution = await Institution.findById(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    // Verify all readers exist and have reader role
    const readers = await User.find({
      _id: { $in: readerIds },
      role: 'reader'
    });

    if (readers.length !== readerIds.length) {
      return res.status(400).json({ error: 'Some reader IDs are invalid' });
    }

    institution.assignedReaderIds = readerIds.map(
      (id: string) => new mongoose.Types.ObjectId(id)
    );
    await institution.save();

    // TODO: Send notification emails to assigned readers

    return res.json({
      message: 'Readers assigned successfully',
      institution
    });
  } catch (error) {
    console.error('Assign readers error:', error);
    return res.status(500).json({ error: 'Failed to assign readers' });
  }
};
