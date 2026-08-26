import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { emailService } from '../services/emailService';

/** MemberClick admin a memberclick-only member is pointed to for password help. */
const MEMBERCLICK_ADMIN_NAME = process.env.MEMBERCLICK_ADMIN_NAME || 'Amy Primm';
const MEMBERCLICK_ADMIN_EMAIL = process.env.MEMBERCLICK_ADMIN_EMAIL || 'aprimm@updatemanagement.com';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

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
 * POST /api/auth/forgot-password  { email }
 * Step 1 of the two-step reset. Emails a reset link to a password-capable user.
 * A memberclick-only account gets NO reset — the client shows a "contact the
 * MemberClick administrator" screen instead (they have no CSHSE password). To
 * avoid email-enumeration we return {ok:true} whether or not the address exists,
 * EXCEPT we do surface the memberclick-only case (a deliberate product choice so
 * SSO members are told where to go).
 */
export async function forgotPassword(req: Request, res: Response): Promise<Response> {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const user = await User.findOne({
      email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });

    // MemberClick-only members have no CSHSE password → send them to the MC admin.
    if (user && user.loginMethod === 'memberclick-only') {
      return res.json({ memberclickOnly: true, adminName: MEMBERCLICK_ADMIN_NAME, adminEmail: MEMBERCLICK_ADMIN_EMAIL });
    }

    // No account (or a disabled one): behave as success, no email, no leak.
    if (user && user.isActive !== false && user.status !== 'disabled') {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordTokenHash = hashToken(rawToken);
      user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
      await user.save();
      const resetLink = `${baseUrl()}/reset-password?token=${rawToken}`;
      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        resetLink,
      });
    }
    return res.json({ ok: true });
  } catch (e) {
    console.error('forgotPassword error:', e);
    return res.status(500).json({ error: 'Could not process the request. Please try again.' });
  }
}

/**
 * POST /api/auth/reset-password  { token, password }
 * Step 2. Consumes the emailed token and sets the new password (the User
 * pre-save hook hashes it). Single-use: the token is cleared on success.
 */
export async function resetPassword(req: Request, res: Response): Promise<Response> {
  try {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');
    if (!token) return res.status(400).json({ error: 'Missing reset token.' });
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    const user = await User.findOne({
      resetPasswordTokenHash: hashToken(token),
      resetPasswordExpires: { $gt: new Date() },
    });
    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }
    if (user.loginMethod === 'memberclick-only') {
      return res.status(400).json({ error: 'This account signs in through MemberClick and has no CSHSE password.' });
    }
    user.passwordHash = password; // hashed by the pre-save hook
    user.resetPasswordTokenHash = undefined as any;
    user.resetPasswordExpires = undefined as any;
    if (user.status === 'pending') user.status = 'active';
    await user.save();
    console.log(`[auth] password reset completed for ${user.email}`);
    return res.json({ ok: true });
  } catch (e) {
    console.error('resetPassword error:', e);
    return res.status(500).json({ error: 'Could not reset the password. Please try again.' });
  }
}
