/**
 * CR-042 Slice 2 — SSO login controller.
 *
 * Endpoint: POST /api/v1/auth/sso-login
 *
 * Authenticates a server-to-server caller (MemberClick relay, E2E suite, or
 * any partner with an SSO-scoped API key) on behalf of a CSHSE user email,
 * and returns a session JWT identical in shape to the password-login path.
 *
 * Behavior:
 *   1. Validate the x-cshse-api-key header. Must hash to a known APIKey
 *      record with scope='sso-login' and isActive=true. Wrong scope → 403.
 *   2. Look up User by lowercase email.
 *   3. If user exists → mint JWT and return.
 *   4. If user missing AND key.autoProvision=true → derive the trusted
 *      domain allowlist from existing users provisioned via 'invitation' or
 *      'manual' (NOT 'sso-key' — prevents self-reinforcing trust). If the
 *      incoming email's domain is in the allowlist, create the user and
 *      mint a JWT. Otherwise 403 [sso-domain-not-yet-trusted].
 *   5. If user missing AND key.autoProvision=false → 404 [sso-user-not-found].
 *
 * Errors follow RFC 7807 Problem Details.
 *
 * Audit log: every attempt prints a single line with keyId, email, ip, outcome.
 */
import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { APIKey } from '../models/APIKey';
import { User } from '../models/User';

const ALLOWLIST_TTL_MS = 30_000;
let cachedAllowlist: { domains: Set<string>; expiresAt: number } | null = null;

/**
 * Build the trusted email-domain allowlist at request time.
 *
 * Only users provisioned via 'invitation' or 'manual' contribute their
 * domain. Users provisioned via 'sso-key' are deliberately excluded — if a
 * single rogue auto-provision created user@badactor.com, that user's mere
 * existence must NOT make badactor.com a trusted domain. Trust must trace
 * back to a real admin-driven invitation.
 *
 * Cached 30s to absorb traffic bursts without hammering Mongo with the same
 * distinct-aggregation.
 */
async function getDerivedDomainAllowlist(): Promise<Set<string>> {
  const now = Date.now();
  if (cachedAllowlist && cachedAllowlist.expiresAt > now) {
    return cachedAllowlist.domains;
  }
  const docs = await User.find({
    'provisionedBy.type': { $in: ['invitation', 'manual'] },
    email: { $exists: true, $ne: null }
  })
    .select('email')
    .lean();
  const domains = new Set<string>();
  for (const d of docs) {
    const email = (d.email || '').toLowerCase();
    const at = email.indexOf('@');
    if (at > 0 && at < email.length - 1) {
      domains.add(email.slice(at + 1));
    }
  }
  cachedAllowlist = { domains, expiresAt: now + ALLOWLIST_TTL_MS };
  return domains;
}

/**
 * Expose the cache invalidator for tests / admin actions that just added or
 * removed an invited user (the next /sso-login call will recompute).
 */
export function invalidateSsoAllowlistCache(): void {
  cachedAllowlist = null;
}

function problemDetails(
  status: number,
  code: string,
  title: string,
  detail: string,
  instance: string,
  requestId: string
): Record<string, unknown> {
  return {
    type: `https://docs.cshse.org/sso/errors/${code}`,
    title,
    status,
    detail,
    instance,
    request_id: requestId,
    code
  };
}

function deriveNameFromEmail(email: string): { firstName: string; lastName: string } {
  const localPart = email.slice(0, email.indexOf('@'));
  const tokens = localPart.split(/[._\-+]+/).filter(Boolean);
  const capitalize = (s: string) =>
    s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '';
  if (tokens.length === 0) {
    return { firstName: 'SSO', lastName: 'User' };
  }
  if (tokens.length === 1) {
    return { firstName: capitalize(tokens[0]), lastName: 'User' };
  }
  return {
    firstName: capitalize(tokens[0]),
    lastName: capitalize(tokens[tokens.length - 1])
  };
}

export async function ssoLogin(req: Request, res: Response) {
  const requestId = crypto.randomBytes(8).toString('hex');
  const instance = '/api/v1/auth/sso-login';
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';

  try {
    const rawKey = (req.header('x-cshse-api-key') ?? '').trim();
    if (!rawKey) {
      return res
        .status(401)
        .json(
          problemDetails(
            401,
            'missing-api-key',
            'Missing API key',
            'Provide the x-cshse-api-key header.',
            instance,
            requestId
          )
        );
    }

    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await APIKey.findOne({ keyHash, isActive: true });
    if (!apiKey) {
      console.log(
        `[sso] event=sso-login keyId=- email=- ip=${ip} outcome=invalid-key request_id=${requestId}`
      );
      return res
        .status(401)
        .json(
          problemDetails(
            401,
            'key-revoked',
            'API key invalid or revoked',
            'The API key is unknown or has been revoked.',
            instance,
            requestId
          )
        );
    }
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      console.log(
        `[sso] event=sso-login keyId=${apiKey._id} email=- ip=${ip} outcome=expired request_id=${requestId}`
      );
      return res
        .status(401)
        .json(
          problemDetails(
            401,
            'key-expired',
            'API key expired',
            'The API key has expired.',
            instance,
            requestId
          )
        );
    }
    if (apiKey.scope !== 'sso-login') {
      console.log(
        `[sso] event=sso-login keyId=${apiKey._id} email=- ip=${ip} outcome=sso-key-misuse request_id=${requestId}`
      );
      return res
        .status(403)
        .json(
          problemDetails(
            403,
            'sso-key-misuse',
            'Wrong API key scope',
            "This API key's scope is not 'sso-login'.",
            instance,
            requestId
          )
        );
    }

    const emailRaw = (req.body?.email ?? '').toString().toLowerCase().trim();
    if (!emailRaw || !/^[\w.+-]+@([\w-]+\.)+[\w-]{2,}$/.test(emailRaw)) {
      return res
        .status(400)
        .json(
          problemDetails(
            400,
            'invalid-email',
            'Invalid email',
            'Body must include a valid email address.',
            instance,
            requestId
          )
        );
    }

    // Stamp last-used + count (best-effort; never block login on this).
    apiKey.lastUsedAt = new Date();
    apiKey.usageCount += 1;
    apiKey.save().catch((err) => {
      console.warn(`[sso] failed to stamp lastUsedAt on key ${apiKey._id}:`, err);
    });

    let user = await User.findOne({ email: emailRaw });

    if (!user) {
      if (!apiKey.autoProvision) {
        console.log(
          `[sso] event=sso-login keyId=${apiKey._id} email=${emailRaw} ip=${ip} outcome=user-not-found request_id=${requestId}`
        );
        return res
          .status(404)
          .json(
            problemDetails(
              404,
              'sso-user-not-found',
              'User not found',
              `No CSHSE user with email ${emailRaw}. Auto-provision is disabled on this key.`,
              instance,
              requestId
            )
          );
      }
      const domain = emailRaw.slice(emailRaw.indexOf('@') + 1);
      const allowlist = await getDerivedDomainAllowlist();
      if (!allowlist.has(domain)) {
        console.log(
          `[sso] event=sso-login keyId=${apiKey._id} email=${emailRaw} ip=${ip} outcome=domain-rejected request_id=${requestId}`
        );
        return res
          .status(403)
          .json(
            problemDetails(
              403,
              'sso-domain-not-yet-trusted',
              'Domain not yet trusted',
              `Your institution (${domain}) has not yet been onboarded to CSHSE. Ask your CSHSE administrator to invite at least one user from your institution; you'll then be able to sign in via this integration.`,
              instance,
              requestId
            )
          );
      }
      const role =
        (apiKey.allowedRoles && apiKey.allowedRoles[0]) || 'program_coordinator';
      const { firstName, lastName } = deriveNameFromEmail(emailRaw);
      user = await User.create({
        email: emailRaw,
        firstName,
        lastName,
        role,
        status: 'active',
        isActive: true,
        // passwordHash intentionally omitted — SSO users have no password.
        provisionedBy: {
          type: 'sso-key',
          keyId: apiKey._id,
          at: new Date()
        },
        accountCreatedAt: new Date()
      });
      console.log(
        `[sso] event=auto-provisioned keyId=${apiKey._id} email=${emailRaw} userId=${user._id} role=${role} request_id=${requestId}`
      );
    }

    if (user.status === 'disabled' || !user.isActive) {
      console.log(
        `[sso] event=sso-login keyId=${apiKey._id} email=${emailRaw} ip=${ip} outcome=user-disabled request_id=${requestId}`
      );
      return res
        .status(403)
        .json(
          problemDetails(
            403,
            'user-disabled',
            'User account disabled',
            'The CSHSE account is disabled.',
            instance,
            requestId
          )
        );
    }

    user.lastLogin = new Date();
    await user.save();

    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        institutionId: user.institutionId?.toString() || null,
        auth_method: 'sso-key'
      },
      jwtSecret,
      { expiresIn: '30d' }
    );
    const expiresAt = new Date(Date.now() + thirtyDaysInSeconds * 1000).toISOString();

    console.log(
      `[sso] event=sso-login keyId=${apiKey._id} email=${emailRaw} ip=${ip} outcome=ok request_id=${requestId}`
    );

    return res.json({
      sessionToken: token,
      // Alias so simpler callers (and the existing browser auth-store shape)
      // can use the same JSON without remapping.
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
      expiresAt,
      expiresIn: thirtyDaysInSeconds,
      request_id: requestId
    });
  } catch (err: any) {
    console.error(`[sso] event=sso-login outcome=server-error request_id=${requestId}`, err);
    return res
      .status(500)
      .json(
        problemDetails(
          500,
          'server-error',
          'Internal error',
          err?.message ?? 'Unexpected error',
          instance,
          requestId
        )
      );
  }
}
