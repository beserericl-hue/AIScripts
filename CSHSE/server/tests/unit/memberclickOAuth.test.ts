/**
 * MemberClick OAuth — the risky bits: parsing the member email out of MC's
 * (loosely-specified) profile response, and building the authorize redirect.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractEmail, memberclickLogin } from '../../src/controllers/memberclickOAuthController';

describe('extractEmail (MC profile → email)', () => {
  it('reads a top-level email field', () => {
    expect(extractEmail({ email: 'Jane@FDTC.edu' })).toBe('jane@fdtc.edu');
  });
  it('reads alternative field names', () => {
    expect(extractEmail({ primaryEmail: 'a@b.org' })).toBe('a@b.org');
    expect(extractEmail({ emailAddress: 'c@d.org' })).toBe('c@d.org');
    expect(extractEmail({ Email: 'E@F.ORG' })).toBe('e@f.org');
  });
  it('finds a nested email under an email-ish key', () => {
    expect(extractEmail({ profile: { attributes: { 'Primary Email': 'nested@x.edu' } } })).toBe('nested@x.edu');
  });
  it('returns empty when there is no email', () => {
    expect(extractEmail({ name: 'No Email Here', id: 5 })).toBe('');
    expect(extractEmail(null)).toBe('');
    expect(extractEmail('nope')).toBe('');
  });
});

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.type = vi.fn(() => res);
  res.send = vi.fn((b: any) => { res.body = b; return res; });
  res.redirect = vi.fn((code: number, url?: string) => { res.redirectCode = code; res.redirectUrl = url; return res; });
  return res;
}

describe('memberclickLogin redirect', () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  it('503s when not configured (no client id)', () => {
    delete process.env.MEMBERCLICK_OAUTH_CLIENT_ID;
    const res = mockRes();
    memberclickLogin({ query: {} } as any, res);
    expect(res.statusCode).toBe(503);
  });

  it('redirects to MC authorize with the right params when configured', () => {
    process.env.MEMBERCLICK_OAUTH_CLIENT_ID = 'client-123';
    process.env.MEMBERCLICK_OAUTH_CLIENT_SECRET = 'secret-xyz';
    process.env.MEMBERCLICK_OAUTH_ORG = 'cshse';
    process.env.PUBLIC_BASE_URL = 'https://cshse.courseworx.media';
    const res = mockRes();
    memberclickLogin({ query: { returnTo: '/dashboard' } } as any, res);
    expect(res.redirectCode).toBe(302);
    const u = new URL(res.redirectUrl);
    expect(u.origin + u.pathname).toBe('https://cshse.memberclicks.net/oauth/v1/authorize');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe('client-123');
    expect(u.searchParams.get('redirect_uri')).toBe('https://cshse.courseworx.media/sso/v1/memberclick/callback');
    expect(u.searchParams.get('scope')).toBe('read');
    expect(u.searchParams.get('state')).toBeTruthy();
  });
});
