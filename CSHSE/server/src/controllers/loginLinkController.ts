import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { emailService } from '../services/emailService';

/**
 * Passwordless "email me a sign-in link" (magic link). Fully self-contained on
 * our side — no MemberClick, no password. The member enters their email, we send
 * a one-time link to a CONFIRM PAGE (not a direct consume, so email security
 * scanners can't burn the token). Clicking "Sign in" on that page hits
 * /login-link/consume, which mints the SAME 30-day session JWT the normal login
 * and MemberClick callback mint, and hands it to the client via the existing
 * `#token=` fragment handoff.
 */

const LOGIN_LINK_TTL_MS = 30 * 60 * 1000; // 30 minutes

function baseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.PUBLIC_BASE_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
    `http://localhost:${process.env.PORT || 3000}`
  ).replace(/\/$/, '');
}
const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/**
 * POST /api/auth/login-link  { email }
 * Emails a one-time sign-in link to an active account. No email-enumeration:
 * always returns { ok: true }. Works for any active user regardless of
 * loginMethod — the link proves control of the mailbox, which is the identity.
 */
export async function requestLoginLink(req: Request, res: Response): Promise<Response> {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const user = await User.findOne({
      email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (user && user.isActive !== false && user.status !== 'disabled' && user.status !== 'pending') {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.loginLinkTokenHash = hashToken(rawToken);
      user.loginLinkExpires = new Date(Date.now() + LOGIN_LINK_TTL_MS);
      await user.save();
      const loginLink = `${baseUrl()}/sign-in-link/confirm?token=${rawToken}`;
      await emailService.sendLoginLinkEmail({
        to: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        loginLink,
      });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('requestLoginLink error:', e);
    return res.status(500).json({ error: 'Could not process the request. Please try again.' });
  }
}

/**
 * GET /api/auth/login-link/consume?token=...
 * Validates the one-time token, mints the session JWT, and 303-redirects to
 * `/dashboard#token=<JWT>` — the same fragment handoff MemberClick SSO uses, so
 * the existing client picks up the session. Invalid/expired → /login?linkError=1.
 */
export async function consumeLoginLink(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.query?.token || '').trim();
    if (!token) { res.redirect(303, '/login?linkError=1'); return; }
    const user = await User.findOne({
      loginLinkTokenHash: hashToken(token),
      loginLinkExpires: { $gt: new Date() },
    });
    if (!user || user.isActive === false || user.status === 'disabled') {
      res.redirect(303, '/login?linkError=1');
      return;
    }
    // Consume the token (single-use) and stamp the login.
    user.loginLinkTokenHash = undefined as any;
    user.loginLinkExpires = undefined as any;
    user.lastLogin = new Date();
    await user.save();

    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const jwtToken = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        institutionId: user.institutionId?.toString() || null,
      },
      jwtSecret,
      { expiresIn: '30d' }
    );
    console.log(`[auth] passwordless sign-in for ${user.email}`);
    res.redirect(303, `/dashboard#token=${jwtToken}`);
  } catch (e) {
    console.error('consumeLoginLink error:', e);
    res.redirect(303, '/login?linkError=1');
  }
}
