import { Router } from 'express';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { verifyInvitation, acceptInvitation } from '../controllers/invitationController';
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
        institutionId: user.institutionId
      },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        institutionId: user.institutionId,
        institutionName: user.institutionName,
        permissions: user.permissions
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
          institutionId: user.institutionId
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

    return res.json({
      id: user._id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      institutionId: user.institutionId,
      institutionName: user.institutionName,
      permissions: user.permissions,
      status: user.status,
      lastLogin: user.lastLogin
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
