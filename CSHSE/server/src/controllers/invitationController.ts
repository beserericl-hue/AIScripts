import { Request, Response } from 'express';
import { Invitation } from '../models/Invitation';
import { User } from '../models/User';
import { Institution } from '../models/Institution';
import { emailService } from '../services/emailService';
import mongoose from 'mongoose';
import crypto from 'crypto';

// Helper to get base URL for invitation links
function getBaseUrl(): string {
  return process.env.APP_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
    || `http://localhost:${process.env.PORT || 3000}`;
}

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
    if (role === 'admin' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admin can invite administrators' });
    }
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

    // Generate token and hash before creating invitation (must be done before validation)
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Create invitation
    const invitation = new Invitation({
      email: email.toLowerCase(),
      name,
      role,
      institutionId: institutionId ? new mongoose.Types.ObjectId(institutionId) : undefined,
      institutionName,
      token,
      tokenHash,
      invitedBy: req.user!.id,
      invitedByName: req.user!.name,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: {
        customMessage,
        permissions
      }
    });

    await invitation.save();

    // Send invitation email
    const invitationLink = `${getBaseUrl()}/accept-invitation?token=${invitation.token}`;
    const emailSent = await emailService.sendInvitationEmail({
      recipientName: name,
      recipientEmail: email,
      inviterName: req.user!.name,
      role: role,
      institutionName: institutionName,
      invitationLink,
      expiresAt: invitation.expiresAt
    });

    if (emailSent) {
      invitation.emailSentAt = new Date();
      await invitation.save();
    }

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

    // Resend email
    const invitationLink = `${getBaseUrl()}/accept-invitation?token=${newToken}`;
    const emailSent = await emailService.sendInvitationEmail({
      recipientName: invitation.name,
      recipientEmail: invitation.email,
      inviterName: req.user!.name || 'Administrator',
      role: invitation.role,
      institutionName: invitation.institutionName,
      invitationLink,
      expiresAt: invitation.expiresAt
    });

    if (emailSent) {
      invitation.emailSentAt = new Date();
      await invitation.save();
    }

    return res.json({
      message: emailSent ? 'Invitation resent successfully' : 'Invitation updated but email failed to send',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        resendCount: invitation.emailResendCount,
        emailSent
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

/**
 * Create an ACTIVE user directly — no invitation email, no email verification.
 * The user can sign in immediately via SSO (MemberClick). Admin / superuser
 * only. This registers the email (so SSO matches on it) and — because it is a
 * `manual` provision — trusts the email's domain for the MemberClick relay.
 *
 * @route POST /api/users/create-active
 */
export const createActiveUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const requesterRole = req.user?.role;
    const isSuper = (req.user as any)?.isSuperuser || (req.user as any)?.realIsSuperuser;
    if (requesterRole !== 'admin' && !isSuper) {
      return res.status(403).json({ error: 'Only an administrator can add users directly' });
    }

    const { email, firstName, lastName, role, institutionId } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!/^[\w.+\-]+@([\w-]+\.)+[\w-]{2,}$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    const allowedRoles = ['program_coordinator', 'reader', 'lead_reader', 'admin'];
    const finalRole = allowedRoles.includes(role) ? role : 'reader';
    // Mirror the invite rules: only a real admin can mint admins / coordinators.
    if ((finalRole === 'admin' || finalRole === 'program_coordinator') && requesterRole !== 'admin' && !isSuper) {
      return res.status(403).json({ error: `Only an admin can add a ${finalRole}` });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // MemberClick refreshes the real name on first login; a placeholder keeps
    // the required fields satisfied until then.
    const fn = (firstName && String(firstName).trim()) || cleanEmail.split('@')[0];
    const ln = (lastName && String(lastName).trim()) || '(pending)';
    let inst: any = undefined;
    if (institutionId && mongoose.Types.ObjectId.isValid(institutionId)) inst = institutionId;

    const user = new User({
      email: cleanEmail,
      firstName: fn,
      lastName: ln,
      role: finalRole,
      institutionId: inst,
      isActive: true,
      status: 'active',
      // No password is set here, so this account signs in via MemberClick only.
      loginMethod: 'memberclick-only',
      provisionedBy: { type: 'manual', at: new Date() },
    });
    await user.save();
    console.log(`[users] createActiveUser email=${cleanEmail} role=${finalRole} by=${req.user?.id}`);

    return res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('createActiveUser error:', error);
    return res.status(500).json({ error: 'Failed to add user' });
  }
};

/**
 * One-time reconcile: convert every PENDING invitation into an ACTIVE,
 * MemberClick-only user so they can sign in via SSO immediately (no email,
 * no verification). Also backfills existing users' loginMethod to 'both'
 * (MemberClick OR the CSHSE password UI). Idempotent + admin/superuser only.
 *
 * @route POST /api/users/convert-pending-to-memberclick
 */
export const convertPendingToMemberclick = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSuper = (req.user as any)?.isSuperuser || (req.user as any)?.realIsSuperuser;
    if (req.user?.role !== 'admin' && !isSuper) {
      return res.status(403).json({ error: 'Only an administrator can run this' });
    }

    // 1) Backfill: any existing user without loginMethod signs in either way.
    const backfill = await User.updateMany(
      { loginMethod: { $exists: false } },
      { $set: { loginMethod: 'both' } }
    );

    // 2) Convert each pending invitation -> active MemberClick-only user.
    const pending = await Invitation.find({ status: 'pending' });
    const created: string[] = [];
    const linkedExisting: string[] = [];
    for (const inv of pending) {
      const email = (inv.email || '').toLowerCase().trim();
      if (!email) continue;
      let user = await User.findOne({ email });
      if (!user) {
        const parts = (inv.name || '').trim().split(/\s+/);
        const firstName = parts.shift() || email.split('@')[0];
        const lastName = parts.join(' ') || '(pending)';
        user = new User({
          email,
          firstName,
          lastName,
          role: inv.role || 'program_coordinator',
          institutionId: inv.institutionId || undefined,
          isActive: true,
          status: 'active',
          loginMethod: 'memberclick-only',
          provisionedBy: { type: 'manual', at: new Date() },
        });
        await user.save();
        created.push(email);
      } else {
        // Already a user — just make sure they're MemberClick-capable + active.
        if (!user.isActive) user.isActive = true;
        if (user.status !== 'active') user.status = 'active';
        await user.save();
        linkedExisting.push(email);
      }
      // Retire the invitation so it leaves the Pending list.
      inv.status = 'accepted';
      await inv.save();
    }

    const pendingRemaining = await Invitation.countDocuments({ status: 'pending' });
    console.log(
      `[users] convertPendingToMemberclick created=${created.length} linked=${linkedExisting.length} backfilled=${backfill.modifiedCount} pendingRemaining=${pendingRemaining}`
    );
    return res.json({
      createdCount: created.length,
      created,
      linkedExistingCount: linkedExisting.length,
      linkedExisting,
      backfilledToBoth: backfill.modifiedCount,
      pendingRemaining,
    });
  } catch (error) {
    console.error('convertPendingToMemberclick error:', error);
    return res.status(500).json({ error: 'Failed to convert pending invitations' });
  }
};
