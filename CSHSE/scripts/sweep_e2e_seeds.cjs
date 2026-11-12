#!/usr/bin/env node
/**
 * One-off cleanup of E2E seed data leaked on DEV (the server now sweeps these
 * itself: server/src/services/e2eSeedSweeper.ts, same rules).
 *
 * Deletes submissions whose submissionId starts with "E2E-" and that are older
 * than 2 hours, every document hanging off them (imports, batches, reports,
 * evidence, validation results, assignments, comments …), and their seed
 * users ("<name>+<8 hex>@example.test") that own no other submission.
 *
 * DRY-RUN BY DEFAULT. --apply first writes every affected document to
 * --backup=<file> (default ~/Documents/CSHSE-backups/e2e-seeds-<ts>.json).
 * Refuses the production database host.
 *   MONGO_URI='mongodb://…' node scripts/sweep_e2e_seeds.cjs [--apply]
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));
const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGO_URI;
if (!URI) { console.error('Set MONGO_URI'); process.exit(1); }
if (/kodama\.proxy\.rlwy\.net/.test(URI)) { console.error('refusing: production database'); process.exit(1); }

const PER_SUBMISSION = ['selfstudyimports', 'importbatches', 'leadreaderreports', 'readerreports', 'leadfinalscores', 'leadreadercompilations', 'supportingevidences', 'validationresults', 'assignments', 'comments', 'checklistitems', 'sitevisits'];
const SEED_USER_EMAIL = /\+[0-9a-f]{8}@example\.test$/i;

(async () => {
  const client = await MongoClient.connect(URI);
  const db = client.db();
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const subs = await db.collection('submissions').find({ submissionId: /^E2E-/, createdAt: { $lt: cutoff } }).toArray();
  const ids = subs.map((s) => s._id);
  const byStatus = {};
  subs.forEach((s) => (byStatus[s.status] = (byStatus[s.status] || 0) + 1));
  console.log(`[e2e-sweep] db=${db.databaseName} mode=${APPLY ? 'APPLY' : 'DRY-RUN'} · ${subs.length} stale E2E submissions ${JSON.stringify(byStatus)}`);
  const have = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const backup = { submissions: subs, related: {}, users: [] };
  for (const col of PER_SUBMISSION) {
    if (!have.has(col)) continue;
    const docs = await db.collection(col).find({ submissionId: { $in: [...ids, ...ids.map(String)] } }).toArray();
    if (docs.length) { backup.related[col] = docs; console.log(`  ${col}: ${docs.length}`); }
  }
  const submitters = [...new Set(subs.map((s) => String(s.submitterId || '')).filter(Boolean))];
  const users = await db.collection('users').find({ email: SEED_USER_EMAIL }).toArray();
  const removable = [];
  for (const u of users.filter((x) => submitters.includes(String(x._id)))) {
    const live = await db.collection('submissions').countDocuments({ submitterId: u._id, _id: { $nin: ids } });
    if (!live) removable.push(u);
  }
  backup.users = removable;
  console.log(`  seed users to delete: ${removable.length}`);
  if (!APPLY) { console.log('  DRY-RUN — nothing written. Re-run with --apply.'); await client.close(); return; }
  const arg = process.argv.find((a) => a.startsWith('--backup='));
  const file = arg ? arg.slice(9) : path.join(os.homedir(), 'Documents', 'CSHSE-backups', `e2e-seeds-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(backup));
  console.log(`  backup: ${file}`);
  for (const col of Object.keys(backup.related)) await db.collection(col).deleteMany({ submissionId: { $in: [...ids, ...ids.map(String)] } });
  const s = await db.collection('submissions').deleteMany({ _id: { $in: ids } });
  const u = await db.collection('users').deleteMany({ _id: { $in: removable.map((x) => x._id) } });
  console.log(`  deleted ${s.deletedCount} submissions, ${u.deletedCount} users`);
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
