/**
 * Durable cleanup of E2E seed data (dev only — the /api/test router, and so
 * this sweeper, only mounts where E2E_SEED_ENABLED is set).
 *
 * The seed endpoint used to track what it created only in memory, so every
 * seed made before a server restart / redeploy leaked for good — dev
 * collected 56 "E2E-…" submissions, one of them a completed review that
 * showed up in the Board list and Board console next to Demo University.
 *
 * Seeds are recognisable in the database: their submissionId starts with
 * "E2E-" and their user's email is "<name>+<8 hex>@example.test". This
 * sweeper deletes seeds older than `olderThanMs`, with everything that hangs
 * off their submission, and the seeded users (only when they own no other
 * submission). Nothing outside that pattern is ever touched.
 */
import mongoose from 'mongoose';

export const SEED_SUBMISSION_ID = /^E2E-/;
export const SEED_USER_EMAIL = /\+[0-9a-f]{8}@example\.test$/i;

/** Collections whose documents belong to one submission (field submissionId). */
const PER_SUBMISSION = [
  'selfstudyimports',
  'importbatches',
  'leadreaderreports',
  'readerreports',
  'leadfinalscores',
  'leadreadercompilations',
  'supportingevidences',
  'validationresults',
  'assignments',
  'comments',
  'checklistitems',
  'sitevisits',
];

export interface SweepResult {
  submissions: number;
  users: number;
  related: Record<string, number>;
}

export async function sweepStaleE2ESeeds(olderThanMs = 2 * 60 * 60 * 1000): Promise<SweepResult> {
  const db = mongoose.connection.db;
  const out: SweepResult = { submissions: 0, users: 0, related: {} };
  if (!db) return out;
  const cutoff = new Date(Date.now() - olderThanMs);
  const subs = await db
    .collection('submissions')
    .find({ submissionId: SEED_SUBMISSION_ID, createdAt: { $lt: cutoff } }, { projection: { _id: 1, submitterId: 1 } })
    .toArray();
  if (!subs.length) return out;
  const ids = subs.map((s) => s._id);
  const have = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  for (const col of PER_SUBMISSION) {
    if (!have.has(col)) continue;
    const r = await db.collection(col).deleteMany({ submissionId: { $in: [...ids, ...ids.map(String)] } });
    if (r.deletedCount) out.related[col] = r.deletedCount;
  }
  out.submissions = (await db.collection('submissions').deleteMany({ _id: { $in: ids } })).deletedCount || 0;
  const submitters = [...new Set(subs.map((s) => String(s.submitterId || '')).filter(Boolean))].map((id) => new mongoose.Types.ObjectId(id));
  const users = await db.collection('users').find({ _id: { $in: submitters }, email: SEED_USER_EMAIL }, { projection: { _id: 1 } }).toArray();
  for (const u of users) {
    if (await db.collection('submissions').countDocuments({ submitterId: u._id })) continue; // still owns a live seed
    out.users += (await db.collection('users').deleteOne({ _id: u._id })).deletedCount || 0;
  }
  return out;
}
