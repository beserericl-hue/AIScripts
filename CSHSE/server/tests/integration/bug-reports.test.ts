/**
 * CR-016 / Sprint 7.2 — In-app bug reporter.
 *
 * Pins:
 *   - any auth user can POST a report; 401 unauth
 *   - 400 on missing description/route/userAgent
 *   - response includes a `reference` (the BugReport _id)
 *   - secret-token scrub strips Bearer tokens + JWT-ish triples + AWS keys
 *     from `description` AND each `recentConsoleErrors[].message`
 *   - GET /admin/bug-reports is admin-only; sorts newest-first
 *   - PATCH /admin/bug-reports/:id flips status + records triageNote
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { BugReport } from '../../src/models/BugReport';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function seed() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  const { user: reader } = await createUser({ role: 'reader' });
  return {
    adminTok: signTokenFor(admin as any),
    pcTok: signTokenFor(pc as any),
    readerTok: signTokenFor(reader as any)
  };
}

const BASE_BODY = {
  description: 'The save button on the editor does nothing.',
  route: '/self-study/abc',
  userAgent: 'Mozilla/5.0 (Macintosh) Chrome/123',
  buildSha: 'abc1234',
  recentConsoleErrors: [
    { message: 'TypeError: foo is undefined', ts: new Date().toISOString() },
    { message: 'Network request failed', ts: new Date().toISOString() }
  ]
};

describe('CR-016 — POST /api/bug-reports', () => {
  it('any auth user submits a report; returns 201 + reference', async () => {
    const { pcTok } = await seed();
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`)
      .send(BASE_BODY);
    expect(res.status).toBe(201);
    expect(res.body.reference).toBeTruthy();
    const stored = await BugReport.findById(res.body.reference);
    expect(stored).not.toBeNull();
    expect(stored?.description).toMatch(/save button/);
    expect(stored?.reporterRole).toBe('program_coordinator');
    expect(stored?.recentConsoleErrors?.length).toBe(2);
  });

  it('401 without a token', async () => {
    const res = await request(app).post('/api/bug-reports').send(BASE_BODY);
    expect(res.status).toBe(401);
  });

  it('400 when description / route / userAgent missing', async () => {
    const { pcTok } = await seed();
    for (const k of ['description', 'route', 'userAgent']) {
      const body: any = { ...BASE_BODY };
      delete body[k];
      const res = await request(app)
        .post('/api/bug-reports')
        .set('Authorization', `Bearer ${pcTok}`)
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('scrubs Bearer tokens / JWT-ish triples / AWS keys from description + console errors', async () => {
    const { pcTok } = await seed();
    // Realistic JWT shape: each segment ≥ 20 chars (the JWT regex requires that).
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const body = {
      ...BASE_BODY,
      description: `I clicked save. Bearer eyJsupersecretjwt; api_key=topsecret_value; ${jwt}`,
      recentConsoleErrors: [
        { message: `Failed: Authorization: Bearer ${jwt}`, ts: new Date().toISOString() },
        { message: 'AWS error: AKIAIOSFODNN7EXAMPLE region us-east-1', ts: new Date().toISOString() }
      ]
    };
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`)
      .send(body);
    expect(res.status).toBe(201);
    const stored = await BugReport.findById(res.body.reference);
    expect(stored?.description).not.toMatch(/Bearer /i);
    expect(stored?.description).not.toMatch(jwt);
    expect(stored?.description).not.toMatch(/topsecret_value/);
    expect(stored?.description).toMatch(/\[REDACTED\]/);
    expect(stored?.recentConsoleErrors?.[0].message).toMatch(/\[REDACTED\]/);
    expect(stored?.recentConsoleErrors?.[1].message).not.toMatch(/AKIA/);
  });

  it('caps console errors to the last 10', async () => {
    const { pcTok } = await seed();
    const errs = Array.from({ length: 20 }, (_, i) => ({ message: `err-${i}`, ts: new Date().toISOString() }));
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ ...BASE_BODY, recentConsoleErrors: errs });
    expect(res.status).toBe(201);
    const stored = await BugReport.findById(res.body.reference);
    expect(stored?.recentConsoleErrors?.length).toBe(10);
    expect(stored?.recentConsoleErrors?.[0].message).toBe('err-10');
    expect(stored?.recentConsoleErrors?.[9].message).toBe('err-19');
  });

  // CR-016 / S13d — optional flag-gated auto-screenshot.
  it('stores a valid image data-URL screenshot when provided', async () => {
    const { pcTok } = await seed();
    const dataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(64);
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ ...BASE_BODY, screenshot: dataUrl });
    expect(res.status).toBe(201);
    const stored = await BugReport.findById(res.body.reference);
    expect(stored?.screenshot).toBe(dataUrl);
  });

  it('drops a non-image-data-URL screenshot but still saves the report', async () => {
    const { pcTok } = await seed();
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ ...BASE_BODY, screenshot: 'javascript:alert(1)' });
    expect(res.status).toBe(201);
    const stored = await BugReport.findById(res.body.reference);
    expect(stored?.screenshot).toBeUndefined();
  });

  it('drops an oversized screenshot but still saves the report', async () => {
    const { pcTok } = await seed();
    const huge = 'data:image/png;base64,' + 'A'.repeat(3_000_001);
    const res = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ ...BASE_BODY, screenshot: huge });
    expect(res.status).toBe(201);
    const stored = await BugReport.findById(res.body.reference);
    expect(stored?.screenshot).toBeUndefined();
  });
});

describe('CR-016 — GET /api/admin/bug-reports', () => {
  it('admin sees the list newest-first; non-admin 403', async () => {
    const { adminTok, pcTok, readerTok } = await seed();
    // Seed two reports.
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/bug-reports')
        .set('Authorization', `Bearer ${pcTok}`)
        .send({ ...BASE_BODY, description: `report ${i}` });
      await new Promise((r) => setTimeout(r, 15));
    }
    const res = await request(app)
      .get('/api/admin/bug-reports')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    expect(res.body.reports.length).toBeGreaterThanOrEqual(2);
    const ts = res.body.reports.map((r: any) => new Date(r.createdAt).getTime());
    for (let i = 0; i < ts.length - 1; i++) expect(ts[i]).toBeGreaterThanOrEqual(ts[i + 1]);

    const denied1 = await request(app)
      .get('/api/admin/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`);
    expect(denied1.status).toBe(403);
    const denied2 = await request(app)
      .get('/api/admin/bug-reports')
      .set('Authorization', `Bearer ${readerTok}`);
    expect(denied2.status).toBe(403);
  });

  it('PATCH /admin/bug-reports/:id flips status + triageNote; admin-only', async () => {
    const { adminTok, pcTok } = await seed();
    const post = await request(app)
      .post('/api/bug-reports')
      .set('Authorization', `Bearer ${pcTok}`)
      .send(BASE_BODY);
    const id = post.body.reference;
    const triaged = await request(app)
      .patch(`/api/admin/bug-reports/${id}`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ status: 'triaged', triageNote: 'Reproduced on develop.' });
    expect(triaged.status).toBe(200);
    expect(triaged.body.report.status).toBe('triaged');
    expect(triaged.body.report.triageNote).toMatch(/Reproduced/);

    const denied = await request(app)
      .patch(`/api/admin/bug-reports/${id}`)
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ status: 'dismissed' });
    expect(denied.status).toBe(403);

    const bad = await request(app)
      .patch(`/api/admin/bug-reports/${id}`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ status: 'made-up' });
    expect(bad.status).toBe(400);
  });
});
