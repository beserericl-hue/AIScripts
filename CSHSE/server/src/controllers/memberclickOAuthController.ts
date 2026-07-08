/**
 * MemberClick (MC Professional) OAuth 2.0 / OpenID Connect login.
 *
 * The reliable "Log in with MemberClick" handshake — replaces the brittle
 * hidden-form-with-merge-tag approach (which MC could not render per-viewer).
 *
 *   GET /sso/v1/memberclick/login     — start: redirect the member to MC's
 *                                       authorize endpoint (Authorization Code).
 *   GET /sso/v1/memberclick/callback  — MC redirects back with ?code&state;
 *                                       we exchange the code for a token, read
 *                                       the member's profile (email), find the
 *                                       matching CSHSE user, and mint a session
 *                                       JWT (same handoff as the ticket flow).
 *
 * MemberClick endpoints (per MC Professional docs), derived from the org
 * subdomain (MEMBERCLICK_OAUTH_ORG, default "cshse"):
 *   authorize : https://<org>.memberclicks.net/oauth/v1/authorize
 *   token     : https://<org>.memberclicks.net/oauth/v1/token
 *   userinfo  : https://<org>.memberclicks.net/api/v1/profile/me
 *
 * Config (Railway env):
 *   MEMBERCLICK_OAUTH_CLIENT_ID       (from MC "API Client")
 *   MEMBERCLICK_OAUTH_CLIENT_SECRET   (from MC "API Client")
 *   MEMBERCLICK_OAUTH_ORG             org subdomain (default "cshse")
 *   PUBLIC_BASE_URL                   used to build the redirect URI
 *   MEMBERCLICK_OAUTH_REDIRECT_URI    (optional override)
 *   MEMBERCLICK_OAUTH_{AUTHORIZE,TOKEN,USERINFO}_URL (optional overrides)
 *   MEMBERCLICK_OAUTH_SCOPE           (default "read")
 */
import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { User } from '../models/User';
import { notInvitedPage } from './ssoTicketController';

interface OAuthCfg {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  redirectUri: string;
  scope: string;
}

function oauthCfg(): OAuthCfg {
  const org = (process.env.MEMBERCLICK_OAUTH_ORG || 'cshse').trim();
  const base = `https://${org}.memberclicks.net`;
  const publicBase = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return {
    clientId: (process.env.MEMBERCLICK_OAUTH_CLIENT_ID || '').trim(),
    clientSecret: (process.env.MEMBERCLICK_OAUTH_CLIENT_SECRET || '').trim(),
    authorizeUrl: (process.env.MEMBERCLICK_OAUTH_AUTHORIZE_URL || `${base}/oauth/v1/authorize`).trim(),
    tokenUrl: (process.env.MEMBERCLICK_OAUTH_TOKEN_URL || `${base}/oauth/v1/token`).trim(),
    userinfoUrl: (process.env.MEMBERCLICK_OAUTH_USERINFO_URL || `${base}/api/v1/profile/me`).trim(),
    redirectUri:
      (process.env.MEMBERCLICK_OAUTH_REDIRECT_URI ||
        `${publicBase}/sso/v1/memberclick/callback`).trim(),
    scope: (process.env.MEMBERCLICK_OAUTH_SCOPE || 'read').trim(),
  };
}

// Short-lived CSRF `state` -> returnTo store (10 min TTL). In-memory is fine:
// the value only lives between the authorize redirect and the callback, on the
// same instance in the common case; a miss just asks the user to click again.
const stateStore = new Map<string, { returnTo: string; expiresAt: number }>();
function putState(returnTo: string): string {
  const s = crypto.randomBytes(16).toString('hex');
  stateStore.set(s, { returnTo, expiresAt: Date.now() + 10 * 60 * 1000 });
  if (stateStore.size > 5000) {
    const now = Date.now();
    for (const [k, v] of stateStore) if (v.expiresAt < now) stateStore.delete(k);
  }
  return s;
}
function takeState(s: string): { returnTo: string } | null {
  const rec = stateStore.get(s);
  if (!rec) return null;
  stateStore.delete(s);
  if (rec.expiresAt < Date.now()) return null;
  return { returnTo: rec.returnTo };
}

function messagePage(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — CSHSE Self-Study Portal</title></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:14vh auto;padding:0 20px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:36px 32px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
      <h1 style="color:#0f766e;font-size:20px;margin:0 0 14px;">${title}</h1>
      <p style="color:#334155;font-size:15px;line-height:1.65;margin:0;">${body}</p>
    </div>
  </div>
</body></html>`;
}

/** Pull an email out of MC's profile response, tolerant of its exact shape. */
export function extractEmail(profile: any): string {
  if (!profile || typeof profile !== 'object') return '';
  const direct = [
    profile.email,
    profile.Email,
    profile.emailAddress,
    profile.primaryEmail,
    profile.contactEmail,
    profile['[Email]'],
    profile.attributes?.email,
    profile.attributes?.Email,
    profile.profile?.email,
  ];
  for (const c of direct) {
    if (typeof c === 'string' && c.includes('@')) return c.trim().toLowerCase();
  }
  // Deep scan: first string under an "email"-ish key that looks like an email.
  const stack: any[] = [profile];
  let guard = 0;
  while (stack.length && guard < 500) {
    const cur = stack.pop();
    guard += 1;
    if (cur && typeof cur === 'object') {
      for (const [k, v] of Object.entries(cur)) {
        if (typeof v === 'string' && /e-?mail/i.test(k) && v.includes('@')) {
          return v.trim().toLowerCase();
        }
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }
  return '';
}

/** GET /sso/v1/memberclick/login — kick off the OAuth Authorization Code flow. */
export function memberclickLogin(req: Request, res: Response): void {
  const c = oauthCfg();
  if (!c.clientId || !c.redirectUri.startsWith('http')) {
    res
      .status(200)
      .type('text/html')
      .send(
        messagePage(
          'Not set up yet',
          'MemberClick sign-in has not been configured yet. Please contact your CSHSE administrator.'
        )
      );
    return;
  }
  const rawReturn = String((req.query.returnTo as string) || '/dashboard');
  const returnTo = rawReturn.startsWith('/') ? rawReturn : '/dashboard';
  const state = putState(returnTo);
  const u = new URL(c.authorizeUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', c.clientId);
  u.searchParams.set('redirect_uri', c.redirectUri);
  u.searchParams.set('scope', c.scope);
  u.searchParams.set('state', state);
  console.log(`[mc-oauth] login redirect state=${state.slice(0, 8)} redirect_uri=${c.redirectUri}`);
  res.redirect(302, u.toString());
}

/** GET /sso/v1/memberclick/callback — finish OAuth, sign the member in. */
export async function memberclickCallback(req: Request, res: Response): Promise<void> {
  const c = oauthCfg();
  const code = String((req.query.code as string) || '');
  const state = String((req.query.state as string) || '');
  const providerError = String((req.query.error as string) || '');

  if (providerError) {
    console.log(`[mc-oauth] callback provider-error=${providerError}`);
    res
      .status(400)
      .type('text/html')
      .send(messagePage('Sign-in canceled', 'MemberClick did not complete the sign-in. Please try again.'));
    return;
  }

  const st = state ? takeState(state) : null;
  if (!code || !st) {
    res
      .status(400)
      .type('text/html')
      .send(
        messagePage(
          'Sign-in link expired',
          'This sign-in link expired or was already used. Please click the link again.'
        )
      );
    return;
  }

  try {
    // 1) Exchange the authorization code for an access token.
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: c.redirectUri,
      client_id: c.clientId,
    });
    // MemberClick requires the client credentials via HTTP Basic auth on the
    // token endpoint (body-only client_secret gets 401 Unauthorized).
    const basicAuth = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');
    const tokenResp = await axios.post(c.tokenUrl, body.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      timeout: 15000,
      validateStatus: () => true,
    });
    const accessToken: string | undefined = tokenResp.data?.access_token;
    if (tokenResp.status >= 400 || !accessToken) {
      console.log(
        `[mc-oauth] token-exchange-failed status=${tokenResp.status} body=${JSON.stringify(
          tokenResp.data
        ).slice(0, 240)}`
      );
      res
        .status(400)
        .type('text/html')
        .send(
          messagePage(
            'Sign-in error',
            'MemberClick did not return a valid token. Please try again, or contact your CSHSE administrator.'
          )
        );
      return;
    }

    // 2) Read the member's profile to get their email.
    const me = await axios.get(c.userinfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      timeout: 15000,
      validateStatus: () => true,
    });
    if (me.status >= 400) {
      console.log(`[mc-oauth] userinfo-failed status=${me.status} body=${JSON.stringify(me.data).slice(0, 200)}`);
      res
        .status(400)
        .type('text/html')
        .send(messagePage('Sign-in error', 'We could not read your MemberClick profile. Please contact your CSHSE administrator.'));
      return;
    }
    const email = extractEmail(me.data);
    if (!email) {
      console.log(`[mc-oauth] no-email profile-keys=${Object.keys(me.data || {}).slice(0, 25).join(',')}`);
      res
        .status(400)
        .type('text/html')
        .send(messagePage('Sign-in error', 'We could not read your email from MemberClick. Please contact your CSHSE administrator.'));
      return;
    }

    // 3) Match to a CSHSE user (invited/active) and mint the session.
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      console.log(`[mc-oauth] not-provisioned email=${email}`);
      res.status(403).type('text/html').send(notInvitedPage());
      return;
    }
    user.lastLogin = new Date();
    await user.save();

    const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        institutionId: user.institutionId?.toString() || null,
        auth_method: 'memberclick-oauth',
      },
      jwtSecret,
      { expiresIn: '30d' }
    );
    const returnTo = st.returnTo || '/dashboard';
    const target = `${returnTo}${returnTo.includes('#') ? '&' : '#'}token=${encodeURIComponent(token)}`;
    console.log(`[mc-oauth] ok email=${email} returnTo=${returnTo}`);
    res.redirect(303, target);
  } catch (e: any) {
    const detail = e?.response?.data
      ? JSON.stringify(e.response.data).slice(0, 200)
      : String(e?.message || e);
    console.log(`[mc-oauth] callback-exception ${detail}`);
    res
      .status(400)
      .type('text/html')
      .send(
        messagePage(
          'Sign-in error',
          'Something went wrong signing you in through MemberClick. Please try again, or contact your CSHSE administrator.'
        )
      );
  }
}
