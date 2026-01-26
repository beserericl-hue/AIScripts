import { Request, Response } from 'express';
import { User } from '../models/User';
import { Institution } from '../models/Institution';
import { Invitation } from '../models/Invitation';
import mongoose from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
    institutionId?: string;
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

    // Only admin can see all users
    if (userRole !== 'admin') {
      // Lead readers can see readers assigned to their institutions
      if (userRole === 'lead_reader') {
        query.role = { $in: ['reader', 'program_coordinator'] };
      }
      // Program coordinators can only see users from their institution
      else if (userRole === 'program_coordinator') {
        query.institutionId = req.user?.institutionId;
      }
      else {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Apply filters
    if (role) query.role = role;
    if (institutionId) query.institutionId = institutionId;
    if (status) query.status = status;

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

    // Permission check
    if (userRole !== 'admin') {
      if (userRole === 'program_coordinator' && user.institutionId?.toString() !== req.user?.institutionId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    return res.json({
      ...user,
      name: `${user.firstName} ${user.lastName}`
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

    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key === '_id' || key === 'passwordHash' || key === 'email') {
        return; // Skip immutable fields
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
