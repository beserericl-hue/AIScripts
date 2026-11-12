#!/usr/bin/env node
/**
 * Self-studies still at status 'submitted' that already have assigned reviewers
 * (auto-assigned from the institution at submit, before that path advanced the
 * status) → 'readers_assigned', so queues stop saying "awaiting assignment"
 * (AACC). Only 'submitted' rows with a lead reader or ≥1 assigned reader move.
 *
 *   DRY-RUN BY DEFAULT.  MONGO_URI='…' node scripts/migrate_advance_assigned_status.cjs [--apply]
 */
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));
const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGO_URI;
if (!URI) { console.error('Set MONGO_URI'); process.exit(1); }

(async () => {
  const client = await MongoClient.connect(URI);
  const subs = client.db().collection('submissions');
  const q = {
    status: 'submitted',
    $or: [{ leadReader: { $exists: true, $ne: null } }, { 'assignedReaders.0': { $exists: true } }],
  };
  const rows = await subs.find(q, { projection: { submissionId: 1, institutionName: 1 } }).toArray();
  console.log(`[assigned-status] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} · ${rows.length} submitted study(ies) with reviewers assigned`);
  rows.forEach((r) => console.log(`  ${r.submissionId} · ${r.institutionName}`));
  if (APPLY && rows.length) {
    const r = await subs.updateMany(q, { $set: { status: 'readers_assigned' } });
    console.log(`  advanced ${r.modifiedCount} to readers_assigned`);
  } else if (!APPLY) console.log('  DRY-RUN — nothing written. Re-run with --apply.');
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
