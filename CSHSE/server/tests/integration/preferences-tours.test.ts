/**
 * CR-052 / Sprint 7 — User.preferences.tours storage.
 *
 * The PATCH /api/auth/me/preferences endpoint already merges
 * `hideLegacyImporter` (CR-045). This test pins the same contract for the
 * new `tours: { [name]: boolean }` map:
 *
 *   - persists; round-trips on GET /me;
 *   - merges in place (a second PATCH with a different key keeps the
 *     first key);
 *   - preserves `hideLegacyImporter` siblings (and vice versa);
 *   - validates shape strictly (non-object body, non-boolean value, bad
 *     key all 400);
 *   - missing tours map on GET /me is returned as {} (empty object).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

describe('CR-052 — PATCH /api/auth/me/preferences tours', () => {
  it('persists a tour completion and returns the merged blob', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const tok = signTokenFor(user as any);

    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { welcome: true } });

    expect(res.status).toBe(200);
    expect(res.body.preferences.tours).toEqual({ welcome: true });
    // hideLegacyImporter still defaults to true.
    expect(res.body.preferences.hideLegacyImporter).toBe(true);

    const got = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tok}`);
    expect(got.status).toBe(200);
    expect(got.body.user.preferences.tours).toEqual({ welcome: true });
  });

  it('merges a subsequent tours PATCH (sibling tour key survives)', async () => {
    const { user } = await createUser({ role: 'reader' });
    const tok = signTokenFor(user as any);

    await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { welcome: true } });

    const second = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { compilations: true } });

    expect(second.status).toBe(200);
    expect(second.body.preferences.tours).toEqual({
      welcome: true,
      compilations: true
    });
  });

  it('preserves hideLegacyImporter when patching tours', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const tok = signTokenFor(user as any);

    await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ hideLegacyImporter: false });

    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { welcome: true } });

    expect(res.status).toBe(200);
    expect(res.body.preferences.hideLegacyImporter).toBe(false);
    expect(res.body.preferences.tours).toEqual({ welcome: true });
  });

  it('preserves tours when patching hideLegacyImporter', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const tok = signTokenFor(user as any);

    await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { welcome: true } });

    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ hideLegacyImporter: false });

    expect(res.status).toBe(200);
    expect(res.body.preferences.hideLegacyImporter).toBe(false);
    expect(res.body.preferences.tours).toEqual({ welcome: true });
  });

  it('rejects a non-object tours body (400)', async () => {
    const { user } = await createUser({ role: 'reader' });
    const tok = signTokenFor(user as any);
    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: 'welcome' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tours must be an object/);
  });

  it('rejects a non-boolean tour value (400)', async () => {
    const { user } = await createUser({ role: 'reader' });
    const tok = signTokenFor(user as any);
    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { welcome: 'yes' } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/welcome must be a boolean/);
  });

  it('rejects a malformed tour name (400)', async () => {
    const { user } = await createUser({ role: 'reader' });
    const tok = signTokenFor(user as any);
    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { 'has spaces!': true } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a valid tour name/);
  });

  it('GET /me returns tours as {} for a fresh user (no prefs blob)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const tok = signTokenFor(user as any);
    const got = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tok}`);
    expect(got.status).toBe(200);
    expect(got.body.user.preferences.tours).toEqual({});
  });

  it('the database actually stores tours as a Map (round-trip)', async () => {
    const { user } = await createUser({ role: 'reader' });
    const tok = signTokenFor(user as any);
    await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${tok}`)
      .send({ tours: { welcome: true } });

    const stored = await User.findById(user._id);
    const tours = (stored?.preferences as any)?.tours;
    // Mongoose Map subdocs come back as Map instances.
    expect(tours instanceof Map || (tours && typeof tours === 'object')).toBe(true);
    const asObj = tours instanceof Map ? Object.fromEntries(tours) : tours;
    expect(asObj.welcome).toBe(true);
  });
});
