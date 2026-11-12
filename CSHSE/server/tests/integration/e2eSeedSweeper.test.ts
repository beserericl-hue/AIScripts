import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { sweepStaleE2ESeeds } from '../../src/services/e2eSeedSweeper';

const db = () => mongoose.connection.db!;
const HOUR = 60 * 60 * 1000;

async function seed(submissionId: string, email: string, ageMs: number) {
  const createdAt = new Date(Date.now() - ageMs);
  const u = await db().collection('users').insertOne({ email, firstName: 'S', lastName: 'Seed', role: 'program_coordinator', createdAt });
  const s = await db().collection('submissions').insertOne({ submissionId, submitterId: u.insertedId, status: 'review_complete', createdAt });
  await db().collection('selfstudyimports').insertOne({ submissionId: s.insertedId, createdAt });
  await db().collection('leadreaderreports').insertOne({ submissionId: s.insertedId, recommendation: 'hold' });
  return { userId: u.insertedId, subId: s.insertedId };
}

describe('E2E seed sweeper (durable cleanup of leaked seeds)', () => {
  it('POSITIVE: deletes a stale seed, everything hanging off it, and its seed user', async () => {
    const old = await seed(`E2E-sw${Date.now()}`, `coordinator+0a1b2c3d@example.test`, 3 * HOUR);
    const r = await sweepStaleE2ESeeds();
    expect(r.submissions).toBeGreaterThanOrEqual(1);
    expect(await db().collection('submissions').countDocuments({ _id: old.subId })).toBe(0);
    expect(await db().collection('selfstudyimports').countDocuments({ submissionId: old.subId })).toBe(0);
    expect(await db().collection('leadreaderreports').countDocuments({ submissionId: old.subId })).toBe(0);
    expect(await db().collection('users').countDocuments({ _id: old.userId })).toBe(0);
  });

  it('NEGATIVE: keeps fresh seeds, real submissions and non-seed users', async () => {
    const fresh = await seed(`E2E-fresh${Date.now()}`, `coordinator+deadbeef@example.test`, 10 * 60 * 1000);
    const real = await seed(`2026-9${String(Date.now()).slice(-2)}`, `coordinator+cafef00d@example.test`, 30 * 24 * HOUR);
    const realUser = await seed(`E2E-ru${Date.now()}`, 'nicole.williams@college.edu', 3 * HOUR);
    await sweepStaleE2ESeeds();
    expect(await db().collection('submissions').countDocuments({ _id: fresh.subId })).toBe(1);
    expect(await db().collection('submissions').countDocuments({ _id: real.subId })).toBe(1);
    expect(await db().collection('leadreaderreports').countDocuments({ submissionId: real.subId })).toBe(1);
    // the E2E submission goes, but a user without a seed email is never deleted
    expect(await db().collection('submissions').countDocuments({ _id: realUser.subId })).toBe(0);
    expect(await db().collection('users').countDocuments({ _id: realUser.userId })).toBe(1);
  });
});
