import { Request, Response } from 'express';
import { Invitation } from '../models/Invitation';
import { User } from '../models/User';
import { Institution } from '../models/Institution';
import mongoose from 'mongoose';
import crypto from 'crypto';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    role: string;
  };
}

/**
 * Get all invitations (Admin only)
 */
export const getInvitations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, role, institutionId, page = '1', limit = '50' } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (role) query.role = role;
    if (institutionId) query.institutionId = institutionId;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [invitations, total] = await Promise.all([
      Invitation.find(query)
        .select('-token -tokenHash')
        .populate('invitedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Invitation.countDocuments(query)
    ]);

    return res.json({
      invitations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get invitations error:', error);
    return res.status(500).json({ error: 'Failed to get invitations' });
  }
};

/**
 * Create invitation (Admin or Lead Reader)
 */
export const createInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userRole = req.user?.role;
    const { email, name, role, institutionId, customMessage, permissions } = req.body;

    // Permission checks
    if (role === 'program_coordinator' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admin can invite program coordinators' });
    }
    if (['reader', 'lead_reader'].includes(role) && !['admin', 'lead_reader'].includes(userRole || '')) {
      return res.status(403).json({ error: 'Only admin or lead reader can invite readers' });
    }

    // Check if email already exists as a user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Check for pending invitation
    const existingInvitation = await Invitation.findOne({
      email: email.toLowerCase(),
      status: 'pending'
    });
    if (existingInvitation) {
      return res.status(409).json({
        error: 'A pending invitation already exists for this email',
        invitationId: existingInvitation._id
      });
    }

    // Get institution name if provided
    let institutionName;
    if (institutionId) {
      const institution = await Institution.findById(institutionId);
      if (!institution) {
        return res.status(400).json({ error: 'Invalid institution ID' });
      }
      institutionName = institution.name;
    }

    // Create invitation
    const invitation = new Invitation({
      email: email.toLowerCase(),
      name,
      role,
      institutionId: institutionId ? new mongoose.Types.ObjectId(institutionId) : undefined,
      institutionName,
      invitedBy: req.user!.id,
      invitedByName: req.user!.name,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: {
        customMessage,
        permissions
      }
    });

    await invitation.save();

    // TODO: Send invitation email
    // const inviteUrl = `${process.env.APP_URL}/accept-invitation?token=${invitation.token}`;
    // await sendEmail({
    //   to: email,
    //   subject: 'You have been invited to CSHSE Accreditation System',
    //   template: 'invitation',
    //   data: { name, role, inviteUrl, customMessage }
    // });

    invitation.emailSentAt = new Date();
    await invitation.save();

    return res.status(201).json({
      message: 'Invitation created and sent',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        institutionName: invitation.institutionName,
        expiresAt: invitation.expiresAt,
        // Include token only in development for testing
        ...(process.env.NODE_ENV === 'development' && { token: invitation.token })
      }
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    return res.status(500).json({ error: 'Failed to create invitation' });
  }
};

/**
 * Verify invitation token (Public - used when user clicks email link)
 */
export const verifyInvitation = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await Invitation.findOne({ tokenHash });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation token' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({
        error: `Invitation has already been ${invitation.status}`,
        status: invitation.status
      });
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    return res.json({
      valid: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        institutionName: invitation.institutionName,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Verify invitation error:', error);
    return res.status(500).json({ error: 'Failed to verify invitation' });
  }
};

/**
 * Accept invitation and create account (Public)
 */
export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invitation = await Invitation.findOne({ tokenHash, status: 'pending' });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation token' });
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Parse name
    const nameParts = invitation.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || nameParts[0];

    // Determine default permissions based on role
    const defaultPermissions: string[] = [];
    if (invitation.role === 'program_coordinator') {
      defaultPermissions.push('edit_self_study', 'view_comments');
    } else if (invitation.role === 'reader') {
      defaultPermissions.push('view_comments', 'add_comments');
    } else if (invitation.role === 'lead_reader') {
      defaultPermissions.push('view_comments', 'add_comments', 'assign_readers', 'schedule_site_visits');
    }

    // Create user
    const user = new User({
      email: invitation.email,
      passwordHash: password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      role: invitation.role,
      institutionId: invitation.institutionId,
      institutionName: invitation.institutionName,
      status: 'active',
      permissions: invitation.metadata?.permissions || defaultPermissions,
      isActive: true,
      invitedAt: invitation.createdAt,
      invitedBy: invitation.invitedBy,
      accountCreatedAt: new Date()
    });

    await user.save();

    // Update invitation
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    invitation.userId = user._id;
    await invitation.save();

    // If program coordinator, update institution
    if (invitation.role === 'program_coordinator' && invitation.institutionId) {
      await Institution.findByIdAndUpdate(invitation.institutionId, {
        programCoordinatorId: user._id
      });
    }

    return res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        institutionName: user.institutionName
      }
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    return res.status(500).json({ error: 'Failed to create account' });
  }
};

/**
 * Resend invitation email (Admin only)
 */
export const resendInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Cannot resend ${invitation.status} invitation` });
    }

    // Extend expiration
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    invitation.emailResendCount += 1;

    // Generate new token
    const newToken = crypto.randomBytes(32).toString('hex');
    invitation.token = newToken;
    invitation.tokenHash = crypto.createHash('sha256').update(newToken).digest('hex');

    await invitation.save();

    // TODO: Resend email
    invitation.emailSentAt = new Date();
    await invitation.save();

    return res.json({
      message: 'Invitation resent successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        resendCount: invitation.emailResendCount
      }
    });
  } catch (error) {
    console.error('Resend invitation error:', error);
    return res.status(500).json({ error: 'Failed to resend invitation' });
  }
};

/**
 * Revoke invitation (Admin only)
 */
export const revokeInvitation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Cannot revoke ${invitation.status} invitation` });
    }

    invitation.status = 'revoked';
    await invitation.save();

    return res.json({
      message: 'Invitation revoked successfully'
    });
  } catch (error) {
    console.error('Revoke invitation error:', error);
    return res.status(500).json({ error: 'Failed to revoke invitation' });
  }
};
