import { Request, Response } from 'express';
import { Institution } from '../models/Institution';
import { Invitation } from '../models/Invitation';
import { User } from '../models/User';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
  };
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
      .lean();

    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
    }

    return res.json(institution);
  } catch (error) {
    console.error('Get institution error:', error);
    return res.status(500).json({ error: 'Failed to get institution' });
  }
};

/**
 * Create a new institution (Admin only)
 */
export const createInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      name,
      type,
      address,
      primaryContact,
      website,
      accreditationDeadline,
      programCoordinatorEmail,
      programCoordinatorName
    } = req.body;

    // Check if institution already exists
    const existing = await Institution.findOne({ name });
    if (existing) {
      return res.status(409).json({ error: 'Institution with this name already exists' });
    }

    // Create institution
    const institution = new Institution({
      name,
      type,
      address,
      primaryContact,
      website,
      accreditationDeadline: accreditationDeadline ? new Date(accreditationDeadline) : undefined,
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
  } catch (error) {
    console.error('Create institution error:', error);
    return res.status(500).json({ error: 'Failed to create institution' });
  }
};

/**
 * Update an institution (Admin only)
 */
export const updateInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const updates = req.body;

    const institution = await Institution.findById(id);
    if (!institution) {
      return res.status(404).json({ error: 'Institution not found' });
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
 * Archive an institution (Admin only)
 */
export const archiveInstitution = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
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
 * Assign lead reader to institution (Admin only)
 */
export const assignLeadReader = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
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
 * Assign readers to institution (Admin or Lead Reader)
 */
export const assignReaders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    if (userRole !== 'admin' && userRole !== 'lead_reader') {
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
