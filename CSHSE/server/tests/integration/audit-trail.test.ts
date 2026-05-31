/**
 * CR-020 / Sprint 7.3 — admin audit-trail endpoints.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function seedEntries(actorId: mongoose.Types.ObjectId) {
  const submissionId = new mongoose.Types.ObjectId();
  const now = Date.now();
  for (let i = 0; i < 5; i++) {
    await AuditLogEntry.create({
      action: i % 2 === 0 ? 'board.decision_recorded' : 'compilation.final_set',
      actorId,
      actorRole: 'admin',
      actorName: 'Alex Admin',
      targetType: 'submission',
      targetId: String(submissionId),
      submissionId,
      payload: { idx: i },
      timestamp: new Date(now - i * 1000) // each row is 1s older
    });
  }
  return submissionId;
}

describe('CR-020 — GET /api/admin/audit-log', () => {
  it('admin lists entries newest-first; non-admin 403', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    await seedEntries(admin._id as any);

    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(5);
    expect(res.body.total).toBeGreaterThanOrEqual(5);
    const ts = res.body.entries.map((r: any) => new Date(r.timestamp).getTime());
    for (let i = 0; i < ts.length - 1; i++) expect(ts[i]).toBeGreaterThanOrEqual(ts[i + 1]);

    const denied = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(denied.status).toBe(403);
  });

  it('filter by action (single + comma-list)', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    await seedEntries(admin._id as any);
    const single = await request(app)
      .get('/api/admin/audit-log?action=board.decision_recorded')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(single.status).toBe(200);
    expect(single.body.entries.every((e: any) => e.action === 'board.decision_recorded')).toBe(true);

    const both = await request(app)
      .get('/api/admin/audit-log?action=board.decision_recorded,compilation.final_set')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(both.status).toBe(200);
    expect(both.body.entries.length).toBeGreaterThanOrEqual(5);
  });

  it('filter by submissionId; bad submissionId → 400', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sid = await seedEntries(admin._id as any);
    const ok = await request(app)
      .get(`/api/admin/audit-log?submissionId=${sid}`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(ok.status).toBe(200);
    expect(ok.body.entries.length).toBeGreaterThanOrEqual(5);

    const bad = await request(app)
      .get('/api/admin/audit-log?submissionId=not-an-id')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(bad.status).toBe(400);
  });

  it('limit clamped to [1, 500]; offset works', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    await seedEntries(admin._id as any);
    const r1 = await request(app)
      .get('/api/admin/audit-log?limit=2&offset=0')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(r1.body.entries.length).toBe(2);
    expect(r1.body.hasMore).toBe(true);

    const r2 = await request(app)
      .get('/api/admin/audit-log?limit=99999')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(r2.body.limit).toBe(500);
  });
});

describe('CR-020 — GET /api/admin/audit-log/export.csv', () => {
  it('admin downloads a CSV with header + rows; non-admin 403', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    await seedEntries(admin._id as any);

    const res = await request(app)
      .get('/api/admin/audit-log/export.csv')
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/audit-log/);
    const text = res.text;
    expect(text.split('\n')[0]).toBe('timestamp,action,actorName,actorRole,targetType,targetId,submissionId,reason,payload');
    expect(text).toContain('board.decision_recorded');
    expect(text).toContain('Alex Admin');

    const denied = await request(app)
      .get('/api/admin/audit-log/export.csv')
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(denied.status).toBe(403);
  });
});
