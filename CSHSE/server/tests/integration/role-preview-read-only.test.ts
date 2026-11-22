/**
 * Superuser ROLE PREVIEW (impersonate a role, no specific user) is read-only,
 * and an unknown impersonated user id never leaks into req.user/audit.
 * 2026-11-22 — closes the "role-only impersonation is a preview" gap: a write
 * in a preview has no identity/institution to act as and used to be stamped
 * with the superuser.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import app from '../../src/index';
import { authenticate, rolePreviewWriteBlocked, AuthenticatedRequest } from '../../src/middleware/auth';
import { createUser, signTokenFor } from '../helpers/factories';

describe('rolePreviewWriteBlocked', () => {
  it('blocks writes for non-admin preview roles', () => {
    expect(rolePreviewWriteBlocked('POST', '/api/submissions', 'program_coordinator')).toBe(true);
    expect(rolePreviewWriteBlocked('PUT', '/api/submissions/x/narrative', 'reader')).toBe(true);
    expect(rolePreviewWriteBlocked('DELETE', '/api/evidence/x', 'lead_reader')).toBe(true);
  });
  it('NEGATIVE: reads, admin previews and session plumbing are allowed', () => {
    expect(rolePreviewWriteBlocked('GET', '/api/submissions', 'program_coordinator')).toBe(false);
    expect(rolePreviewWriteBlocked('POST', '/api/submissions', 'admin')).toBe(false);
    expect(rolePreviewWriteBlocked('POST', '/api/auth/impersonation/stop', 'reader')).toBe(false);
    expect(rolePreviewWriteBlocked('PATCH', '/api/notifications/abc/read', 'reader')).toBe(false);
    expect(rolePreviewWriteBlocked('POST', '/api/authx', 'reader')).toBe(true); // prefix must be a path segment
  });
});

describe('role preview through the real app', () => {
  it('POSITIVE: a PC role preview cannot write (403 ROLE_PREVIEW_READ_ONLY)', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const res = await request(app).post('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .set('X-Impersonated-Role', 'program_coordinator')
      .send({ institutionId: '000000000000000000000000' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ROLE_PREVIEW_READ_ONLY');
  });

  it('NEGATIVE: the same preview can still read', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const res = await request(app).get('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .set('X-Impersonated-Role', 'program_coordinator');
    expect(res.body?.code).not.toBe('ROLE_PREVIEW_READ_ONLY');
    expect(res.status).toBe(200);
  });

  it('NEGATIVE: impersonating a SPECIFIC user is not a preview — writes are not blocked by it', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const res = await request(app).post('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .set('X-Impersonated-Role', 'program_coordinator')
      .set('X-Impersonated-User-Id', String(pc._id))
      .send({});
    expect(res.body?.code).not.toBe('ROLE_PREVIEW_READ_ONLY');
  });

  it('NEGATIVE: a non-superuser sending preview headers is unaffected (headers ignored)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const res = await request(app).post('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .set('X-Impersonated-Role', 'reader')
      .send({});
    expect(res.body?.code).not.toBe('ROLE_PREVIEW_READ_ONLY');
  });
});

describe('impersonation context only carries a user that was actually loaded', () => {
  const probe = express();
  probe.get('/probe', authenticate as any, (req: AuthenticatedRequest, res) => res.json(req.user));

  it('POSITIVE: a real target → its id, name and DB role', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const { user: rd } = await createUser({ role: 'reader', firstName: 'Rita', lastName: 'Reader' });
    const r = await request(probe).get('/probe').set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .set('X-Impersonated-Role', 'program_coordinator') // spoofed: server must use the DB role
      .set('X-Impersonated-User-Id', String(rd._id));
    expect(r.body.id).toBe(String(rd._id));
    expect(r.body.role).toBe('reader');
    expect(r.body.isSuperuser).toBe(false);
    expect(r.body.realIsSuperuser).toBe(true);
    expect(r.body.impersonation.impersonatedUserId).toBe(String(rd._id));
    expect(r.body.impersonation.impersonatedUserName).toBe('Rita Reader');
    expect(r.body.impersonation.impersonatedRole).toBe('reader');
  });

  it('NEGATIVE: an unknown / malformed user id is NOT recorded (falls back to a role preview)', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    for (const bogus of ['000000000000000000000000', 'not-an-id']) {
      const r = await request(probe).get('/probe').set('Authorization', `Bearer ${signTokenFor(su as any)}`)
        .set('X-Impersonated-Role', 'reader').set('X-Impersonated-User-Id', bogus);
      expect(r.body.id).toBe(String(su._id));
      expect(r.body.role).toBe('reader');
      expect(r.body.impersonation.impersonatedUserId).toBeUndefined();
      expect(r.body.impersonation.impersonatedUserName).toBeUndefined();
    }
  });
});
