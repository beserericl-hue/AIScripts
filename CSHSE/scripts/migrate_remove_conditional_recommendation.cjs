#!/usr/bin/env node
/**
 * CSHSE change request (Lauri, Nov 2026): "The Reader Report and the Lead Reader
 * Report have an option for conditional accreditation in the Recommendation to
 * Council section. We need that removed."
 *
 * The option is gone from the app; this clears it from STORED reports so no
 * screen (lead, reader, board) or download still shows a Conditional choice.
 * A cleared recommendation shows as "not recorded" — the lead / reader picks
 * Accept, Deny or Hold again. Any conditional-requirements text the lead wrote
 * is kept untouched in conditionalRequirements (no screen shows it any more),
 * so nothing a lead wrote is lost.
 *
 *   DRY-RUN BY DEFAULT.  MONGO_URI='…' node scripts/migrate_remove_conditional_recommendation.cjs [--apply]
 */
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));
const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGO_URI;
if (!URI) { console.error('Set MONGO_URI'); process.exit(1); }

(async () => {
  const client = await MongoClient.connect(URI);
  const db = client.db();
  console.log(`[conditional] db=${db.databaseName} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const lrr = db.collection('leadreaderreports');
  const rr = db.collection('readerreports');
  const lrrN = await lrr.countDocuments({ recommendation: 'conditional' });
  const rrN = await rr.countDocuments({ acceptanceVote: 'conditional' });
  console.log(`  Lead Reader Reports with recommendation=conditional: ${lrrN}`);
  console.log(`  Reader Reports with acceptanceVote=conditional: ${rrN}`);
  if (APPLY) {
    const a = await lrr.updateMany({ recommendation: 'conditional' }, { $set: { recommendation: '' } });
    const b = await rr.updateMany({ acceptanceVote: 'conditional' }, { $set: { acceptanceVote: '' } });
    console.log(`  cleared: ${a.modifiedCount} lead reports, ${b.modifiedCount} reader votes`);
  } else {
    console.log('  DRY-RUN — nothing written. Re-run with --apply.');
  }
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
