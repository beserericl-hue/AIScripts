#!/usr/bin/env node
/**
 * Site visits scheduled before the fix stored the submitter's USER id as
 * institutionId, so coordinators (who list by institution) never saw them.
 * Sets each visit's institutionId to its submission's institutionId.
 *   DRY-RUN BY DEFAULT.  MONGO_URI='…' node scripts/repair_site_visit_institution.cjs [--apply]
 */
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));
const APPLY = process.argv.includes('--apply');
(async () => {
  const c = await MongoClient.connect(process.env.MONGO_URI); const db = c.db();
  const visits = await db.collection('sitevisits').find({}).toArray();
  let wrong = 0, fixed = 0;
  for (const v of visits) {
    const sub = await db.collection('submissions').findOne({ _id: v.submissionId }, { projection: { institutionId: 1, submissionId: 1 } });
    if (!sub || !sub.institutionId || String(sub.institutionId) === String(v.institutionId)) continue;
    wrong++;
    console.log(`  ${v._id} (${sub.submissionId}) ${v.institutionId} -> ${sub.institutionId}`);
    if (APPLY) { await db.collection('sitevisits').updateOne({ _id: v._id }, { $set: { institutionId: sub.institutionId } }); fixed++; }
  }
  console.log(`[site-visit-institution] ${APPLY ? 'APPLY' : 'DRY-RUN'} · ${visits.length} visits, ${wrong} on the wrong institution${APPLY ? `, fixed ${fixed}` : ''}`);
  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });
