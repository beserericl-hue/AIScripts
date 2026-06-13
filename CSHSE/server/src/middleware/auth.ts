import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { runWithRequestContext, ImpersonationContext } from './requestContext';

/**
 * Extended Request interface with user information from JWT
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    _id: string;
    email: string;
    role: string;
    firstName?: string;
    lastName?: string;
    name: string;
    institutionId?: string;
    // EFFECTIVE elevation: false while impersonating a non-admin role, so all
    // access checks treat the impersonated session as that role.
    isSuperuser?: boolean;
    // The TRUE underlying superuser flag (unaffected by impersonation) for the
    // rare feature that must know the real actor is a superuser.
    realIsSuperuser?: boolean;
    // CR-058 — present only when a superuser is acting through an
    // impersonation session. `role` above is the *effective* (impersonated)
    // role; this captures the true actor + the chosen identity.
    impersonation?: ImpersonationContext;
  };
}

/** Decode a header value the client URI-encoded (names may contain spaces/unicode). */
function decodeHeader(v: string | undefined): string | undefined {
  if (!v) return undefined;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

/**
 * Authentication middleware that extracts user from JWT token
 * and populates req.user with user information from the database
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';

    try {
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

      // Get full user info from database
      const user = await User.findById(decoded.id).select(
        'email role firstName lastName institutionId isSuperuser'
      );

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      // For superusers, allow role override via X-Impersonated-Role header.
      // CR-058 — the client also forwards the specific impersonated user (when
      // one was chosen) so the audit trail can name them, not just the role.
      const impersonatedRole = req.headers['x-impersonated-role'] as string | undefined;
      const impersonatedUserId = req.headers['x-impersonated-user-id'] as string | undefined;
      const impersonatedUserName = decodeHeader(req.headers['x-impersonated-user-name'] as string | undefined);
      const isImpersonating = !!(user.isSuperuser && (impersonatedRole || impersonatedUserId));
      const actorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

      // EFFECTIVE IDENTITY. When a superuser impersonates a SPECIFIC user, the
      // session must FULLY assume that user — id, _id, institutionId, role,
      // name, email — so EVERY downstream check behaves exactly as that user:
      // ownership gates, institution scoping, reader-assignment lookups, AND the
      // authorship/actor fields stamped onto anything written. Previously only
      // `role` was swapped while `id`/`institutionId` stayed the superuser's,
      // which both mis-scoped reads (a PC viewing as themselves saw the wrong
      // institution) AND silently stamped the superuser onto data the
      // impersonated user created (scores, locks, comments, imports, audit
      // actors). Assuming the identity here removes that class of bug at the
      // root for every controller, with no per-handler special-casing. The real
      // superuser is still recorded in `impersonation` / `realIsSuperuser` for
      // the audit trail and superuser-only features.
      //
      // Role-only impersonation (no specific user chosen) cannot assume an
      // identity — there is no target user — so it keeps the superuser's id and
      // only swaps the role. That path is a read preview; any write in it is
      // honestly the superuser's own (it overwrites no other user's
      // attribution, because no other identity was selected).
      let identityUser: typeof user = user;
      if (isImpersonating && impersonatedUserId) {
        try {
          const target = await User.findById(impersonatedUserId).select(
            'email role firstName lastName institutionId isSuperuser'
          );
          if (target) identityUser = target;
        } catch { /* invalid id — fall back to role-only impersonation below */ }
      }
      const assumedSpecificUser = identityUser !== user;

      // Role: a fully-assumed user uses THEIR DB role (authoritative — also
      // closes any client-supplied-role spoof); role-only impersonation uses the
      // header role; otherwise the user's own role.
      const effectiveRole = assumedSpecificUser
        ? identityUser.role
        : ((user.isSuperuser && impersonatedRole) ? impersonatedRole : user.role);

      const identityName =
        `${identityUser.firstName || ''} ${identityUser.lastName || ''}`.trim() || identityUser.email;

      const impersonation: ImpersonationContext | undefined = isImpersonating
        ? {
            actualUserId: user._id.toString(),
            actualName: actorName,
            actualRole: user.role,
            impersonatedRole: impersonatedRole || undefined,
            impersonatedUserId:
              impersonatedUserId || (assumedSpecificUser ? identityUser._id.toString() : undefined),
            impersonatedUserName:
              impersonatedUserName || (assumedSpecificUser ? identityName : undefined)
          }
        : undefined;

      // While impersonating a NON-admin role the superuser must be treated AS
      // that role for access control (elevation off), so reader/PC scoping
      // applies. Keep elevation only when NOT impersonating, or the effective
      // identity is itself an admin. `realIsSuperuser` preserves the true flag.
      const effectiveIsSuperuser =
        user.isSuperuser && (!isImpersonating || effectiveRole === 'admin');

      // Populate req.user with the EFFECTIVE identity.
      req.user = {
        id: identityUser._id.toString(),
        _id: identityUser._id.toString(),
        email: identityUser.email,
        role: effectiveRole,
        firstName: identityUser.firstName,
        lastName: identityUser.lastName,
        name: identityName,
        institutionId: identityUser.institutionId?.toString(),
        isSuperuser: effectiveIsSuperuser,
        realIsSuperuser: user.isSuperuser,
        impersonation
      };

      // CR-058 — bind the impersonation context for the request's async
      // lifetime so `recordAuditEvent` auto-flags every governance action
      // taken while impersonating, without threading it through controllers.
      if (impersonation) {
        return runWithRequestContext({ impersonation }, () => next());
      }
      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Optional authentication - populates req.user if token is present
 * but doesn't fail if no token is provided
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without authentication
    }

    const token = authHeader.slice(7);
    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';

    try {
      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

      const user = await User.findById(decoded.id).select(
        'email role firstName lastName institutionId isSuperuser'
      );

      if (user) {
        req.user = {
          id: user._id.toString(),
          _id: user._id.toString(),
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          institutionId: user.institutionId?.toString(),
          isSuperuser: user.isSuperuser
        };
      }
    } catch {
      // Token invalid - continue without authentication
    }

    next();
  } catch (error) {
    next(); // Continue without authentication on error
  }
};

/**
 * Check if user has admin privileges (admin role OR superuser)
 */
export const hasAdminAccess = (user?: AuthenticatedRequest['user']): boolean => {
  if (!user) return false;
  return user.role === 'admin' || user.isSuperuser === true;
};

/**
 * Middleware that requires admin access (admin role OR superuser)
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!hasAdminAccess(req.user)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware that requires superuser access only
 */
export const requireSuperuser = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.isSuperuser) {
    return res.status(403).json({ error: 'Superuser access required' });
  }
  next();
};

/**
 * Middleware that requires one of the specified roles
 */
export const requireRole = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Superusers can access everything
    if (req.user.isSuperuser) {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`
      });
    }

    next();
  };
};

export default {
  authenticate,
  optionalAuth,
  hasAdminAccess,
  requireAdmin,
  requireSuperuser,
  requireRole
};
