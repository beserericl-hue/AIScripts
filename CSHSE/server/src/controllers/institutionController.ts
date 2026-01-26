import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Institution } from '../models/Institution';
import { Invitation } from '../models/Invitation';
import { User } from '../models/User';
import { Spec } from '../models/Spec';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

/**
 * Extract and verify user from JWT token
 */
async function getUserFromToken(req: Request): Promise<{
  id: string;
  name: string;
  role: string;
  isSuperuser?: boolean;
} | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';

  try {
    const decoded = jwt.verify(token, jwtSecret) as UserPayload;
    const user = await User.findById(decoded.id).select('firstName lastName role isSuperuser');
    if (!user) return null;

    return {
      id: decoded.id,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      isSuperuser: user.isSuperuser
    };
  } catch {
    return null;
  }
}

/**
 * Check if user has admin privileges (admin role OR superuser)
 */
function hasAdminAccess(user: { role: string; isSuperuser?: boolean }): boolean {
  return user.role === 'admin' || user.isSuperuser === true;
}

/**
 * Get all institutions
 */
export const getInstitutions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, hasActiveSubmission, status, page = '1', limit = '50' } = req.query;

    const query: any = {};
    if (type) query.type = type;
    if (status) query.status = status;
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
 * Create a new institution (Admin or superuser only)
 */
export const createInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUser = await getUserFromToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasAdminAccess(authUser)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
        invitedBy: authUser.id,
        invitedByName: authUser.name,
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
  } catch (error) {
    console.error('Create institution error:', error);
    return res.status(500).json({ error: 'Failed to create institution' });
  }
};

/**
 * Update an institution (Admin or superuser only)
 */
export const updateInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUser = await getUserFromToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasAdminAccess(authUser)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
 * Archive an institution (Admin or superuser only)
 */
export const archiveInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUser = await getUserFromToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasAdminAccess(authUser)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
 * Assign lead reader to institution (Admin or superuser only)
 */
export const assignLeadReader = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUser = await getUserFromToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasAdminAccess(authUser)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

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
 * Assign readers to institution (Admin, superuser, or Lead Reader)
 */
export const assignReaders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const authUser = await getUserFromToken(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const canAssign = hasAdminAccess(authUser) || authUser.role === 'lead_reader';
    if (!canAssign) {
      return res.status(403).json({ error: 'Admin or Lead Reader access required' });
    }

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
