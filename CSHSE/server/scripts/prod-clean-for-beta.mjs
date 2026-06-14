/**
 * Production "clean for beta" — strips ALL test/self-study/transactional data
 * from the PRODUCTION CSHSE database, keeping ONLY reference material and infra
 * config, so the CSHSE production team + beta users see a clean slate.
 *
 * KEEP  : specs, helpdocuments, files (spec_document/dashboard_document library),
 *         webhooksettings, apikeys, CSHSE (stray), empty collections.
 * PURGE : submissions, selfstudyimports, supportingevidences, curriculummatrixes,
 *         comments, scores, validationresults, invitations, errorlogs,
 *         htmlContent.* (the big self-study HTML GridFS), institutions, and
 *         (only when WIPE_USERS=YES) users.
 *
 * SAFETY: refuses to run unless CONFIRM_PROD_WIPE=YES AND the target really is
 * production (proxy host check + sanity bounds). Read-only dry-run by default.
 *
 *   Dry run : MONGO_URI=... node scripts/prod-clean-for-beta.mjs
 *   Execute : MONGO_URI=... CONFIRM_PROD_WIPE=YES [WIPE_USERS=YES] node scripts/prod-clean-for-beta.mjs
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
if (!uri) { console.error('MONGO_URI required'); process.exit(1); }
const EXECUTE = process.env.CONFIRM_PROD_WIPE === 'YES';
const WIPE_USERS = process.env.WIPE_USERS === 'YES';

// Collections whose every document is test/self-study/transactional → empty them.
const PURGE = [
  'submissions', 'selfstudyimports', 'supportingevidences', 'curriculummatrixes',
  'comments', 'scores', 'validationresults', 'invitations', 'errorlogs',
  'reviews', 'sitevisits', 'leadreadercompilations', 'changerequests', 'notifications',
];
// GridFS bucket holding the large self-study HTML — drop files + chunks.
const GRIDFS_BUCKETS = ['htmlContent'];
// Reference / infra — never touched.
const KEEP = ['specs', 'helpdocuments', 'files', 'webhooksettings', 'apikeys', 'CSHSE'];

const c = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
await c.connect();
const db = c.db();

// --- SAFETY GUARD: prove this is production, not develop ---
const host = (uri.match(/@([^/]+)/) || [])[1] || '';
const instCount = await db.collection('institutions').countDocuments();
const subCount = await db.collection('submissions').countDocuments();
const isProd = host.includes('turntable.proxy.rlwy.net') || host.includes('railway.internal');
if (!isProd) { console.error(`REFUSING: host ${host} is not the production proxy/internal host`); process.exit(2); }
if (instCount > 5 || subCount > 5) {
  console.error(`REFUSING: institutions=${instCount} submissions=${subCount} looks like develop, not a clean prod target`);
  process.exit(2);
}
console.log(`Target host=${host} db=${db.databaseName} | mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} | WIPE_USERS=${WIPE_USERS}`);

async function count(name) { try { return await db.collection(name).countDocuments(); } catch { return 0; } }

console.log('\n--- KEEP (untouched) ---');
for (const k of KEEP) console.log(`  ${k.padEnd(20)} ${await count(k)}`);

console.log('\n--- PURGE ---');
let purged = 0;
for (const name of PURGE) {
  const before = await count(name);
  if (before === 0) continue;
  if (EXECUTE) { const r = await db.collection(name).deleteMany({}); purged += r.deletedCount; console.log(`  ${name.padEnd(24)} -${r.deletedCount}`); }
  else console.log(`  ${name.padEnd(24)} would delete ${before}`);
}
for (const b of GRIDFS_BUCKETS) {
  const f = await count(`${b}.files`), ch = await count(`${b}.chunks`);
  if (f === 0 && ch === 0) continue;
  if (EXECUTE) {
    await db.collection(`${b}.files`).deleteMany({});
    await db.collection(`${b}.chunks`).deleteMany({});
    console.log(`  ${b}.{files,chunks}      -${f}/-${ch}`);
  } else console.log(`  ${b}.{files,chunks}      would delete ${f} files / ${ch} chunks`);
}
{ // institutions
  const before = await count('institutions');
  if (EXECUTE) { const r = await db.collection('institutions').deleteMany({}); console.log(`  institutions             -${r.deletedCount}`); }
  else console.log(`  institutions             would delete ${before}`);
}
{ // users — wipe all EXCEPT the bootstrap KEEP_USER_EMAIL (kept so prod stays loginable)
  const keepEmail = (process.env.KEEP_USER_EMAIL || '').trim().toLowerCase();
  const before = await count('users');
  if (WIPE_USERS) {
    const filter = keepEmail
      ? { email: { $not: { $regex: `^${keepEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } } }
      : {};
    if (EXECUTE) {
      const r = await db.collection('users').deleteMany(filter);
      console.log(`  users                    -${r.deletedCount}  (kept: ${keepEmail || 'NONE — prod may be locked out'})`);
      if (keepEmail) {
        // Detach the surviving bootstrap from the now-deleted institution so it's a
        // pure global superuser with no dangling institution/role references.
        const u = await db.collection('users').findOneAndUpdate(
          { email: { $regex: `^${keepEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
          { $set: { isSuperuser: true, role: 'admin', roleAssignments: [] }, $unset: { institutionId: '', impersonation: '' } },
          { returnDocument: 'after' }
        );
        console.log(`  bootstrap reset          ${u?.email || keepEmail} -> superuser admin, institution detached, roleAssignments cleared`);
      }
    } else {
      const wouldDelete = keepEmail ? await db.collection('users').countDocuments(filter) : before;
      console.log(`  users                    would delete ${wouldDelete} of ${before}  (kept: ${keepEmail || 'NONE'})`);
    }
  } else {
    console.log(`  users                    SKIPPED (WIPE_USERS not set) — ${before} kept`);
  }
}

console.log('\nDone.' + (EXECUTE ? ` Purged ~${purged} docs across PURGE collections.` : ' (dry-run — nothing changed)'));
await c.close();
