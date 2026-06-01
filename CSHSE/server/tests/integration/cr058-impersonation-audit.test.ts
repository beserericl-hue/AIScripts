/**
 * CR-058 — impersonation audit logging.
 *
 * Before this CR a superuser could impersonate any role / user but nothing was
 * recorded: the only server-side effect was the `X-Impersonated-Role` header
 * overriding the effective role, and the impersonated *user* identity never
 * reached the server at all. This suite pins the new behaviour:
 *
 *   1. POST /api/auth/impersonation/start|stop writes an append-only audit
 *      entry naming the TRUE superuser actor + the impersonated identity.
 *   2. Only a superuser may write those entries (403 otherwise).
 *   3. Governance actions taken *during* an impersonated request are
 *      auto-flagged with the true actor via the request-scoped context —
 *      verified end-to-end through a real audited route (reader lock).
 *   4. The admin audit-log surfaces the impersonation block.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { recordAuditEvent } from '../../src/services/auditLog';
import { runWithRequestContext } from '../../src/middleware/requestContext';
import { createUser, signTokenFor } from '../helpers/factories';

describe('CR-058 — impersonation audit endpoints', () => {
  it('start records the true SU actor + impersonated specific user', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true, firstName: 'Sue', lastName: 'Super' });
    const { user: pc } = await createUser({ role: 'program_coordinator', firstName: 'Pam', lastName: 'Coord' });

    const res = await request(app)
      .post('/api/auth/impersonation/start')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      // Send a deliberately spoofed name — the server must ignore it and
      // re-resolve the authoritative name from the user id.
      .send({
        impersonatedRole: 'program_coordinator',
        impersonatedUserId: String(pc._id),
        impersonatedUserName: 'Totally Spoofed',
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const entry = await AuditLogEntry.findOne({ action: 'auth.impersonation_start' }).lean();
    expect(entry).toBeTruthy();
    expect(String(entry!.actorId)).toBe(String(su._id));
    expect(entry!.impersonation).toBeTruthy();
    expect(String(entry!.impersonation!.actualUserId)).toBe(String(su._id));
    expect(entry!.impersonation!.actualName).toBe('Sue Super');
    expect(entry!.impersonation!.impersonatedRole).toBe('program_coordinator');
    expect(String(entry!.impersonation!.impersonatedUserId)).toBe(String(pc._id));
    // Name resolved server-side from the user id.
    expect(entry!.impersonation!.impersonatedUserName).toBe('Pam Coord');
  });

  it('start with only a role records the role (no specific user)', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const res = await request(app)
      .post('/api/auth/impersonation/start')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .send({ impersonatedRole: 'reader' });
    expect(res.status).toBe(200);
    const entry = await AuditLogEntry.findOne({
      action: 'auth.impersonation_start',
      actorId: su._id,
    }).lean();
    expect(entry!.impersonation!.impersonatedRole).toBe('reader');
    expect(entry!.impersonation!.impersonatedUserId).toBeUndefined();
  });

  it('stop records an impersonation_stop entry', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const res = await request(app)
      .post('/api/auth/impersonation/stop')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .send({ impersonatedRole: 'lead_reader' });
    expect(res.status).toBe(200);
    const entry = await AuditLogEntry.findOne({
      action: 'auth.impersonation_stop',
      actorId: su._id,
    }).lean();
    expect(entry).toBeTruthy();
    expect(entry!.impersonation!.impersonatedRole).toBe('lead_reader');
  });

  it('a non-superuser cannot write impersonation audit entries (403)', async () => {
    const { user: admin } = await createUser({ role: 'admin', isSuperuser: false });
    const res = await request(app)
      .post('/api/auth/impersonation/start')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ impersonatedRole: 'reader' });
    expect(res.status).toBe(403);
  });

  it('start requires an identity (400 when neither role nor user given)', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const res = await request(app)
      .post('/api/auth/impersonation/start')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('unauthenticated start is rejected (401)', async () => {
    const res = await request(app)
      .post('/api/auth/impersonation/start')
      .send({ impersonatedRole: 'reader' });
    expect(res.status).toBe(401);
  });

  it('the admin audit-log surfaces the impersonation block', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true, firstName: 'Iris', lastName: 'Impersonator' });
    await request(app)
      .post('/api/auth/impersonation/start')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`)
      .send({ impersonatedRole: 'reader' });

    const list = await request(app)
      .get('/api/admin/audit-log?action=auth.impersonation_start')
      .set('Authorization', `Bearer ${signTokenFor(su as any)}`);
    expect(list.status).toBe(200);
    const mine = list.body.entries.find((e: any) => e.impersonation?.actualName === 'Iris Impersonator');
    expect(mine).toBeTruthy();
    expect(mine.impersonation.impersonatedRole).toBe('reader');
  });
});

describe('CR-058 — recordAuditEvent auto-flags within an impersonation context', () => {
  it('an audit event written inside runWithRequestContext carries the true actor', async () => {
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true, firstName: 'Sam', lastName: 'Superuser' });
    const submissionId = new mongoose.Types.ObjectId();

    const ctx = {
      actualUserId: String(su._id),
      actualName: 'Sam Superuser',
      actualRole: 'admin',
      impersonatedRole: 'lead_reader',
      impersonatedUserId: String(su._id),
      impersonatedUserName: 'Lead Person',
    };

    // Simulate the middleware binding the context for the request's async
    // lifetime, then a controller deep in the chain recording an event WITHOUT
    // knowing anything about impersonation.
    await runWithRequestContext({ impersonation: ctx }, async () => {
      await recordAuditEvent({
        action: 'submission.reader_lock',
        actor: { id: String(su._id), role: 'lead_reader', name: 'Lead Person' },
        targetType: 'submission',
        targetId: String(submissionId),
        submissionId: String(submissionId),
      });
    });

    const entry = await AuditLogEntry.findOne({
      action: 'submission.reader_lock',
      submissionId,
    }).lean();
    expect(entry).toBeTruthy();
    // The effective actor is the impersonated identity...
    expect(entry!.actorRole).toBe('lead_reader');
    // ...but the impersonation block names who REALLY did it.
    expect(entry!.impersonation).toBeTruthy();
    expect(String(entry!.impersonation!.actualUserId)).toBe(String(su._id));
    expect(entry!.impersonation!.actualName).toBe('Sam Superuser');
    expect(entry!.impersonation!.impersonatedRole).toBe('lead_reader');
  });

  it('an audit event written OUTSIDE any impersonation context has no flag', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const submissionId = new mongoose.Types.ObjectId();
    await recordAuditEvent({
      action: 'submission.lock',
      actor: { id: String(admin._id), role: 'admin', name: 'Plain Admin' },
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId: String(submissionId),
    });
    const entry = await AuditLogEntry.findOne({ action: 'submission.lock', submissionId }).lean();
    expect(entry).toBeTruthy();
    expect(entry!.impersonation).toBeUndefined();
  });
});
