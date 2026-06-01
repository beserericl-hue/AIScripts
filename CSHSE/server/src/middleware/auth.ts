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
    isSuperuser?: boolean;
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
      const effectiveRole = (user.isSuperuser && impersonatedRole)
        ? impersonatedRole
        : user.role;

      const actorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      const impersonation: ImpersonationContext | undefined = isImpersonating
        ? {
            actualUserId: user._id.toString(),
            actualName: actorName,
            actualRole: user.role,
            impersonatedRole: impersonatedRole || undefined,
            impersonatedUserId: impersonatedUserId || undefined,
            impersonatedUserName: impersonatedUserName || undefined
          }
        : undefined;

      // Populate req.user with user information
      req.user = {
        id: user._id.toString(),
        _id: user._id.toString(),
        email: user.email,
        role: effectiveRole,
        firstName: user.firstName,
        lastName: user.lastName,
        name: actorName,
        institutionId: user.institutionId?.toString(),
        isSuperuser: user.isSuperuser,
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
