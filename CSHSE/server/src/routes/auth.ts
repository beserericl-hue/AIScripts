import { Router } from 'express';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { verifyInvitation, acceptInvitation } from '../controllers/invitationController';
import { forgotPassword, resetPassword } from '../controllers/passwordResetController';
import { recordAuditEvent } from '../services/auditLog';
import { ImpersonationContext } from '../middleware/requestContext';
import jwt from 'jsonwebtoken';

const router = Router();

// ============================================
// AUTH ROUTES (Public)
// ============================================

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and return token
 * @access  Public
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'Account not activated. Please use the invitation link to set your password.'
      });
    }

    if (user.status === 'disabled' || !user.isActive) {
      return res.status(401).json({ error: 'Account is disabled' });
    }

    if (user.status === 'pending') {
      return res.status(401).json({
        error: 'Account not yet activated. Please check your email for the invitation link.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT - 30 day expiration for convenience
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        institutionId: user.institutionId?.toString() || null
      },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        institutionId: user.institutionId?.toString() || null,
        institutionName: user.institutionName,
        permissions: user.permissions,
        isSuperuser: user.isSuperuser
      },
      expiresIn: thirtyDaysInSeconds
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * @route   GET /api/auth/verify-invitation/:token
 * @desc    Verify invitation token is valid
 * @access  Public
 */
router.get('/verify-invitation/:token', verifyInvitation);

/**
 * @route   POST /api/auth/accept-invitation
 * @desc    Accept invitation and create account
 * @access  Public
 */
router.post('/accept-invitation', acceptInvitation);

/**
 * @route   POST /api/auth/forgot-password  { email }   (Public)
 *          POST /api/auth/reset-password    { token, password }  (Public)
 * @desc    Two-step self-service password reset for SITE (password) logins.
 *          memberclick-only users get {memberclickOnly:true} → contact MC admin.
 */
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 * @access  Private (requires valid token)
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';

    try {
      const decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: true }) as any;

      // Check if user still exists and is active
      const user = await User.findById(decoded.id);
      if (!user || user.status !== 'active') {
        return res.status(401).json({ error: 'User not found or inactive' });
      }

      // Generate new token - 30 day expiration
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
      const newToken = jwt.sign(
        {
          id: user._id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          role: user.role,
          institutionId: user.institutionId?.toString() || null
        },
        jwtSecret,
        { expiresIn: '30d' }
      );

      return res.json({
        token: newToken,
        expiresIn: thirtyDaysInSeconds
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout (client should discard token)
 * @access  Private
 */
router.post('/logout', (_req: Request, res: Response) => {
  // JWT is stateless, so we just return success
  // Client is responsible for discarding the token
  return res.json({ message: 'Logged out successfully' });
});

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change password for current user or impersonated user (admin/superuser only)
 * @access  Private
 */
router.put('/change-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;

    const { newPassword, userId } = req.body;
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Determine target user
    let targetUserId = decoded.id;
    if (userId && userId !== decoded.id) {
      // Changing another user's password — only admin/superuser can do this
      const callingUser = await User.findById(decoded.id).select('role isSuperuser');
      if (!callingUser?.isSuperuser && callingUser?.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin or superuser can change another user\'s password' });
      }
      targetUserId = userId;
    }

    const user = await User.findById(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.passwordHash = newPassword;
    await user.save();

    return res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';

    const decoded = jwt.verify(token, jwtSecret) as any;

    const user = await User.findById(decoded.id)
      .select('-passwordHash')
      .populate('institutionId', 'name type');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Extract institutionId as string from populated object or raw value
    const populatedInstitution = user.institutionId as any;
    const institutionIdStr = populatedInstitution?._id?.toString() || populatedInstitution?.toString() || null;
    const institutionNameStr = populatedInstitution?.name || user.institutionName;

    return res.json({
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        institutionId: institutionIdStr,
        institutionName: institutionNameStr,
        // CR-060 — every per-institution role the user holds (PC@A, Reader@B, …)
        // so the dashboard can list them all + let the user jump between contexts.
        roleAssignments: (user.roleAssignments || []).map((a: any) => ({
          role: a.role,
          institutionId: a.institutionId?.toString?.() || String(a.institutionId),
          institutionName: a.institutionName,
        })),
        permissions: user.permissions,
        status: user.status,
        lastLogin: user.lastLogin,
        isSuperuser: user.isSuperuser,
        // CR-045 — per-user UI preferences. A missing field defaults to
        // the clean single-importer toolbar (hideLegacyImporter: true).
        // CR-052 — tours map keyed by tour name. Empty object when absent.
        preferences: {
          hideLegacyImporter: user.preferences?.hideLegacyImporter ?? true,
          tours: ((): Record<string, boolean> => {
            const raw = (user.preferences as any)?.tours;
            if (raw instanceof Map) return Object.fromEntries(raw);
            if (raw && typeof raw === 'object') return raw as Record<string, boolean>;
            return {};
          })()
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

/**
 * @route   PATCH /api/auth/me/preferences
 * @desc    Update the current user's UI preferences (CR-045).
 * @access  Private
 *
 * Body: { hideLegacyImporter?: boolean }
 * Only known preference keys are accepted; unknown keys are ignored so a
 * stale client can't write arbitrary fields. Returns the full, defaulted
 * preferences block so the client can sync its local state.
 */
router.patch('/me/preferences', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    if (
      'hideLegacyImporter' in body &&
      typeof body.hideLegacyImporter !== 'boolean'
    ) {
      return res
        .status(400)
        .json({ error: 'hideLegacyImporter must be a boolean' });
    }

    // CR-052 — `tours` is a small map { tourName: boolean }. Validate the
    // shape strictly so a stale client can't smuggle arbitrary payloads.
    if ('tours' in body) {
      if (
        typeof body.tours !== 'object' ||
        body.tours === null ||
        Array.isArray(body.tours)
      ) {
        return res.status(400).json({ error: 'tours must be an object' });
      }
      for (const [k, v] of Object.entries(body.tours as Record<string, unknown>)) {
        if (typeof v !== 'boolean') {
          return res
            .status(400)
            .json({ error: `tours.${k} must be a boolean` });
        }
        if (k.length > 64 || !/^[a-z0-9_-]+$/i.test(k)) {
          return res
            .status(400)
            .json({ error: `tours key "${k}" is not a valid tour name` });
        }
      }
    }

    if (!user.preferences) {
      user.preferences = {};
    }
    if ('hideLegacyImporter' in body) {
      user.preferences.hideLegacyImporter = body.hideLegacyImporter as boolean;
    }

    // CR-052 — merge the inbound `tours` patch into the existing map.
    // NEVER overwrite — preserve every other tour name the user has
    // already completed. The preferences subdoc uses a Mongoose Map so
    // we treat the .tours field as a Map at read/write time. When the
    // existing prefs blob came back as a plain object (Map.toJSON or
    // fresh insert), normalize it to a Map first.
    if ('tours' in body) {
      const incoming = body.tours as Record<string, boolean>;
      const existingRaw = (user.preferences as any).tours;
      let nextMap: Map<string, boolean>;
      if (existingRaw instanceof Map) {
        nextMap = new Map(existingRaw);
      } else if (existingRaw && typeof existingRaw === 'object') {
        nextMap = new Map(Object.entries(existingRaw));
      } else {
        nextMap = new Map();
      }
      for (const [k, v] of Object.entries(incoming)) {
        nextMap.set(k, v);
      }
      (user.preferences as any).tours = nextMap;
    }

    user.markModified('preferences');
    await user.save();

    // Echo the full, defaulted blob so the client can sync local state.
    const toursRaw = (user.preferences as any).tours;
    const toursOut: Record<string, boolean> =
      toursRaw instanceof Map
        ? Object.fromEntries(toursRaw)
        : (toursRaw as Record<string, boolean> | undefined) ?? {};

    return res.json({
      ok: true,
      preferences: {
        hideLegacyImporter: user.preferences?.hideLegacyImporter ?? true,
        tours: toursOut
      }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// ============================================
// CR-058 — IMPERSONATION AUDIT (superuser only)
// ============================================
//
// The client calls these when a superuser starts / stops impersonating a role
// or a specific user. They write an append-only audit entry naming the true
// superuser actor + the impersonated identity, so the admin Audit Trail shows
// exactly who assumed which identity and when. Individual governance actions
// taken *during* the session are separately flagged by `recordAuditEvent` via
// the request-scoped impersonation context (see middleware/requestContext.ts).
//
// These live in the public auth router (inline jwt.verify, like the other
// routes here) and enforce superuser themselves.

const VALID_IMPERSONATION_ROLES = ['admin', 'program_coordinator', 'lead_reader', 'reader'];

async function handleImpersonationEvent(
  req: Request,
  res: Response,
  action: 'auth.impersonation_start' | 'auth.impersonation_stop'
) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;

    const actor = await User.findById(decoded.id).select(
      'role firstName lastName email isSuperuser'
    );
    if (!actor) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!actor.isSuperuser) {
      return res.status(403).json({ error: 'Superuser access required' });
    }

    const { impersonatedRole, impersonatedUserId, impersonatedUserName } = (req.body || {}) as {
      impersonatedRole?: string;
      impersonatedUserId?: string;
      impersonatedUserName?: string;
    };

    // On *start* an identity is required; on *stop* it's optional (we record
    // whatever the client knew it was ending).
    if (action === 'auth.impersonation_start') {
      if (!impersonatedRole && !impersonatedUserId) {
        return res
          .status(400)
          .json({ error: 'impersonatedRole or impersonatedUserId is required' });
      }
      if (impersonatedRole && !VALID_IMPERSONATION_ROLES.includes(impersonatedRole)) {
        return res.status(400).json({ error: 'invalid impersonatedRole' });
      }
    }

    const actorName =
      `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email;

    // Always re-resolve the impersonated user's name server-side from the id
    // (defence against a stale/spoofed label): the authoritative name is the
    // one stored on the user record, not whatever the client sent. Fall back to
    // the client-supplied label only if the id doesn't resolve to a user.
    let resolvedUserName = impersonatedUserName;
    if (impersonatedUserId) {
      const target = await User.findById(impersonatedUserId).select('firstName lastName email');
      if (target) {
        resolvedUserName =
          `${target.firstName || ''} ${target.lastName || ''}`.trim() || target.email;
      }
    }

    const impersonation: ImpersonationContext = {
      actualUserId: actor._id.toString(),
      actualName: actorName,
      actualRole: actor.role,
      impersonatedRole: impersonatedRole || undefined,
      impersonatedUserId: impersonatedUserId || undefined,
      impersonatedUserName: resolvedUserName || undefined
    };

    await recordAuditEvent({
      action,
      actor: { id: actor._id.toString(), role: actor.role, name: actorName },
      targetType: 'user',
      // Target the specific user when known, else the role label.
      targetId: impersonatedUserId || impersonatedRole || 'unknown',
      payload: {
        impersonatedRole: impersonatedRole || null,
        impersonatedUserId: impersonatedUserId || null,
        impersonatedUserName: resolvedUserName || null
      },
      impersonation
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Impersonation audit error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * @route   POST /api/auth/impersonation/start
 * @desc    Record that a superuser began impersonating a role / specific user.
 * @access  Private (superuser only)
 */
router.post('/impersonation/start', (req: Request, res: Response) =>
  handleImpersonationEvent(req, res, 'auth.impersonation_start')
);

/**
 * @route   POST /api/auth/impersonation/stop
 * @desc    Record that a superuser ended an impersonation session.
 * @access  Private (superuser only)
 */
router.post('/impersonation/stop', (req: Request, res: Response) =>
  handleImpersonationEvent(req, res, 'auth.impersonation_stop')
);

export default router;
