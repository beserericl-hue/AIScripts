#!/usr/bin/env node
/**
 * Seed / refresh the "Demo University" practice school on DEV.
 *
 * Board members (and anyone else) get a sandbox to play in before doing a real
 * self-study, WITHOUT touching Stevenson University's own dev copy.
 *
 * What it does (idempotent — every run REPLACES Demo University's data):
 *   1. Snapshots Stevenson (document counts in every related collection + the
 *      updatedAt of its institution / submissions) BEFORE doing anything.
 *   2. Deletes everything that belongs to Demo University's submissions
 *      (never anything else; asserts no id overlaps Stevenson).
 *   3. Upserts the institution "Demo University" (bachelors), a demo Program
 *      Coordinator (demo-pc@cshse.test) and a demo Board member
 *      (board@cshse.test).
 *   4. Clones Stevenson's bachelors self-study into two Demo submissions:
 *        DEMO-001  in_progress — the practice self-study the demo PC edits
 *                  (narratives, intros, review state,
 *                  validation results, supporting-evidence records and the
 *                  import the review state points at, incl. its GridFS HTML,
 *                  copied server-side).
 *        DEMO-002  review_complete — a sample COMPLETED review with a sample
 *                  Lead Reader Report, so the Board dashboard has a demo
 *                  report to open / download.
 *      Reader assignments, comments, reader reports and scores are NOT copied.
 *      Evidence records keep their storage (base64 / same S3 key) — no S3
 *      object is created, moved or deleted.
 *   5. Re-snapshots Stevenson and FAILS (exit 2) if anything changed.
 *
 * Usage (from CSHSE/):
 *   MONGO_URI='mongodb://mongo:<pw>@altaria.proxy.rlwy.net:52322/CSHSE?authSource=admin&directConnection=true' \
 *     node scripts/seed_demo_university.cjs [--dry-run]
 *
 * Optional env:
 *   SOURCE_SUBMISSION_ID  Stevenson submission _id to clone (default: the
 *                         Stevenson bachelors study with submissionId 2026-001,
 *                         else its most recently updated bachelors study)
 *   DEMO_PASSWORD         password for the two demo users (default below)
 *
 * Swapping in other content later (e.g. Julia's combined real files): sign in
 * as demo-pc@cshse.test (or impersonate it), open DEMO-001 and import the new
 * self-study document through the normal importer — or point
 * SOURCE_SUBMISSION_ID at any other submission and re-run this script.
 *
 * DEV ONLY — refuses to run unless the URI host is the dev proxy, or
 * ALLOW_NON_DEV_HOST=1 is set deliberately.
 */
'use strict';
const path = require('path');
const serverDir = path.join(__dirname, '..', 'server');
const req = (m) => require(require.resolve(m, { paths: [serverDir] }));
const { MongoClient, ObjectId, BSON } = req('mongodb');
const bcrypt = req('bcrypt');
const { EJSON } = BSON;

const DRY = process.argv.includes('--dry-run');
const URI = process.env.MONGO_URI;
const DEV_HOST = 'altaria.proxy.rlwy.net:52322';
const STEVENSON = 'Stevenson University';
const DEMO = 'Demo University';
const DEMO_PC_EMAIL = 'demo-pc@cshse.test';
const DEMO_BOARD_EMAIL = 'board@cshse.test';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'CshseDemo-2026!';
const PRACTICE_CODE = 'DEMO-001';
const SAMPLE_CODE = 'DEMO-002';

// Collections whose docs hang off a submission (submissionId) — used both for
// the Stevenson snapshot and for wiping Demo's data.
const SUB_COLLECTIONS = [
  'assignments', 'auditlogentries', 'changerequests', 'comments', 'curriculummatrices',
  'curriculummatrixes', 'directmessages', 'directmessagethreads', 'documentversions',
  'evidencerecommendations', 'importbatches', 'importcorrections', 'leadfinalscores',
  'leadreadercompilations', 'leadreaderreports', 'notifications', 'programcourses',
  'readerreports', 'reviews', 'scores', 'selfstudyimports', 'sitevisitchecklistitems',
  'sitevisits', 'supportingevidences', 'validationresults',
];

function die(msg, code = 1) {
  console.error(`ERROR: ${msg}`);
  process.exit(code);
}

/** Deep-clone a doc while rewriting every occurrence of the given ids. */
function remap(doc, idMap) {
  let s = EJSON.stringify(doc, { relaxed: false });
  for (const [from, to] of Object.entries(idMap)) s = s.split(from).join(to);
  return EJSON.parse(s, { relaxed: false });
}

async function snapshotStevenson(db, inst) {
  const subs = await db.collection('submissions').find({ institutionId: inst._id }).project({ _id: 1, updatedAt: 1 }).toArray();
  const subIds = subs.map((s) => s._id);
  const out = {
    institutionUpdatedAt: String((await db.collection('institutions').findOne({ _id: inst._id }))?.updatedAt),
    submissions: subs.length,
    submissionsUpdatedAt: subs.map((s) => `${s._id}:${s.updatedAt && s.updatedAt.toISOString()}`).sort().join(','),
    usersAtInstitution: await db.collection('users').countDocuments({ $or: [{ institutionId: inst._id }, { 'roleAssignments.institutionId': inst._id }] }),
  };
  for (const c of SUB_COLLECTIONS) {
    out[c] = await db.collection(c).countDocuments({ $or: [{ submissionId: { $in: subIds } }, { institutionId: inst._id }] });
  }
  const imports = await db.collection('selfstudyimports').find({ submissionId: { $in: subIds } }).project({ _id: 1 }).toArray();
  out['htmlContent.files'] = await db.collection('htmlContent.files').countDocuments({ filename: { $in: imports.map((i) => `${i._id}.html`) } });
  return out;
}

async function wipeDemo(db, demoSubIds, stevensonSubIds) {
  const stev = new Set(stevensonSubIds.map(String));
  for (const id of demoSubIds) if (stev.has(String(id))) die(`refusing: demo submission ${id} is a Stevenson submission`);
  if (demoSubIds.length === 0) return {};
  const removed = {};
  const imports = await db.collection('selfstudyimports').find({ submissionId: { $in: demoSubIds } }).project({ _id: 1 }).toArray();
  for (const imp of imports) {
    for (const bucket of ['htmlContent', 'images']) {
      const q = bucket === 'htmlContent' ? { filename: `${imp._id}.html` } : { filename: { $regex: `^${imp._id}/` } };
      const files = await db.collection(`${bucket}.files`).find(q).project({ _id: 1 }).toArray();
      const fids = files.map((f) => f._id);
      if (fids.length && !DRY) {
        await db.collection(`${bucket}.chunks`).deleteMany({ files_id: { $in: fids } });
        await db.collection(`${bucket}.files`).deleteMany({ _id: { $in: fids } });
      }
      removed[`${bucket}.files`] = (removed[`${bucket}.files`] || 0) + fids.length;
    }
  }
  for (const c of SUB_COLLECTIONS) {
    const q = { submissionId: { $in: demoSubIds } };
    removed[c] = await db.collection(c).countDocuments(q);
    if (!DRY && removed[c]) await db.collection(c).deleteMany(q);
  }
  removed.submissions = demoSubIds.length;
  if (!DRY) await db.collection('submissions').deleteMany({ _id: { $in: demoSubIds } });
  return removed;
}

/** Copy one GridFS file server-side (no download) under a new filename. */
async function copyGridFsFile(db, bucket, fileDoc, newFilename) {
  const newFid = new ObjectId();
  await db.collection(`${bucket}.files`).insertOne({ ...fileDoc, _id: newFid, filename: newFilename, uploadDate: new Date() });
  await db
    .collection(`${bucket}.chunks`)
    .aggregate([
      { $match: { files_id: fileDoc._id } },
      { $project: { _id: 0, n: 1, data: 1, files_id: { $literal: newFid } } },
      { $merge: { into: `${bucket}.chunks`, whenMatched: 'fail', whenNotMatched: 'insert' } },
    ], { allowDiskUse: true })
    .toArray();
  return newFid;
}

async function upsertUser(db, email, fields, passwordHash) {
  const now = new Date();
  await db.collection('users').updateOne(
    { email },
    {
      $set: { ...fields, passwordHash, status: 'active', isActive: true, loginMethod: 'both', updatedAt: now },
      $setOnInsert: { email, createdAt: now, accountCreatedAt: now, permissions: [], assignedSubmissions: [], isSuperuser: false, provisionedBy: { type: 'manual', at: now }, __v: 0 },
    },
    { upsert: true }
  );
  return db.collection('users').findOne({ email });
}

(async () => {
  if (!URI) die('set MONGO_URI (dev Mongo)');
  if (!URI.includes(DEV_HOST) && process.env.ALLOW_NON_DEV_HOST !== '1') die(`refusing: MONGO_URI host is not the dev proxy (${DEV_HOST})`);
  const client = await MongoClient.connect(URI);
  const db = client.db();
  console.log(`Connected to ${db.databaseName}${DRY ? ' (DRY RUN — no writes)' : ''}`);

  const stev = await db.collection('institutions').findOne({ name: STEVENSON });
  if (!stev) die(`institution "${STEVENSON}" not found`);
  const stevSubs = await db.collection('submissions').find({ institutionId: stev._id }).project({ _id: 1 }).toArray();
  const stevSubIds = stevSubs.map((s) => s._id);

  let source;
  if (process.env.SOURCE_SUBMISSION_ID) {
    source = await db.collection('submissions').findOne({ _id: new ObjectId(process.env.SOURCE_SUBMISSION_ID) });
  } else {
    source =
      (await db.collection('submissions').findOne({ institutionId: stev._id, submissionId: '2026-001', programLevel: 'bachelors' })) ||
      (await db.collection('submissions').find({ institutionId: stev._id, institutionName: STEVENSON, programLevel: 'bachelors', trainingRun: { $ne: true } }).sort({ updatedAt: -1 }).limit(1).next());
  }
  if (!source) die('source submission not found');
  console.log(`Source: ${source.institutionName} / ${source.programName} (${source._id}, ${source.submissionId}, ${source.status})`);

  const before = await snapshotStevenson(db, stev);
  console.log('\nStevenson BEFORE:', JSON.stringify(before, null, 2));

  // ---- 1. Demo institution (stable _id across runs) ----
  let demo = await db.collection('institutions').findOne({ name: DEMO });
  if (demo && String(demo._id) === String(stev._id)) die('refusing: Demo == Stevenson');
  const demoInstId = demo ? demo._id : new ObjectId();

  const existingDemoSubs = demo
    ? await db.collection('submissions').find({ institutionId: demoInstId }).project({ _id: 1, submissionId: 1 }).toArray()
    : [];
  const idByCode = Object.fromEntries(existingDemoSubs.map((s) => [s.submissionId, s._id]));
  const practiceId = idByCode[PRACTICE_CODE] || new ObjectId();
  const sampleId = idByCode[SAMPLE_CODE] || new ObjectId();
  const prevImport = existingDemoSubs.length
    ? await db.collection('selfstudyimports').findOne({ submissionId: practiceId })
    : null;
  const demoImportId = prevImport ? prevImport._id : new ObjectId();

  // ---- 2. Wipe Demo's previous data ----
  const removed = await wipeDemo(db, existingDemoSubs.map((s) => s._id), stevSubIds);
  console.log('\nRemoved previous Demo data:', JSON.stringify(removed));

  if (DRY) {
    console.log('\nDRY RUN — stopping before writes.');
    await client.close();
    return;
  }

  const now = new Date();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ---- 3. Users ----
  const pc = await upsertUser(db, DEMO_PC_EMAIL, {
    firstName: 'Demo', lastName: 'Coordinator', role: 'program_coordinator',
    institutionId: demoInstId, institutionName: DEMO, isBoardMember: false,
    roleAssignments: [{ role: 'program_coordinator', institutionId: demoInstId, institutionName: DEMO }],
  }, passwordHash);
  const board = await upsertUser(db, DEMO_BOARD_EMAIL, {
    firstName: 'Demo', lastName: 'Board Member', role: 'board', isBoardMember: true,
    institutionId: null, institutionName: null, roleAssignments: [],
  }, passwordHash);

  // ---- 4. Institution ----
  await db.collection('institutions').updateOne(
    { _id: demoInstId },
    {
      $set: {
        name: DEMO,
        type: stev.type || 'university',
        address: { street: '1 Practice Way', city: 'Demo City', state: 'MD', zip: '00000', country: 'USA' },
        primaryContact: { name: 'Demo Coordinator', email: DEMO_PC_EMAIL, phone: '555-0100' },
        website: '',
        specId: stev.specId,
        specName: stev.specName,
        accreditationDeadline: new Date(now.getFullYear() + 1, 3, 30),
        previousSubmissions: [],
        assignedReaderIds: [],
        accreditationHistory: [],
        status: 'active',
        programCoordinatorId: pc._id,
        currentSubmissionId: practiceId,
        updatedAt: now,
      },
      $unset: { assignedLeadReaderId: '' },
      $setOnInsert: { createdAt: now, __v: 0 },
    },
    { upsert: true }
  );

  // ---- 5. Submissions ----
  const srcImportId = (() => {
    const s = JSON.stringify(source.aiReviewState || {});
    const m = s.match(/"importId":"([a-f0-9]{24})"/);
    return m ? m[1] : null;
  })();
  const baseMap = { [String(stev._id)]: String(demoInstId) };
  if (srcImportId) baseMap[srcImportId] = String(demoImportId);

  const buildSub = (newId, code, status) => {
    const doc = remap(source, { ...baseMap, [String(source._id)]: String(newId) });
    doc._id = newId;
    doc.submissionId = code;
    doc.institutionId = demoInstId;
    doc.institutionName = DEMO;
    doc.submitterId = pc._id;
    doc.status = status;
    doc.readerLock = { isLocked: false };
    doc.assignedReaders = [];
    doc.aiEvalQueue = [];
    doc.createdAt = now;
    doc.updatedAt = now;
    delete doc.leadReader;
    delete doc.decision;
    // The curriculum matrix was removed from the self-study (CSHSE board, Nov 2026):
    // never carry matrix data into the practice school.
    delete doc.aiMatrixState;
    delete doc.curriculumMatrices;
    for (const b of Object.values((doc.aiReviewState && doc.aiReviewState.buckets) || {})) if (b) delete b.matrixCells;
    delete doc.trainingRun;
    delete doc.reaccreditationOf;
    if (status === 'review_complete') doc.submittedAt = now;
    else delete doc.submittedAt;
    return doc;
  };
  await db.collection('submissions').insertOne(buildSub(practiceId, PRACTICE_CODE, 'in_progress'));
  await db.collection('submissions').insertOne(buildSub(sampleId, SAMPLE_CODE, 'review_complete'));

  const created = { submissions: 2 };
  // Cloned child collections for BOTH demo submissions (evidence +
  // validation results); the import + its GridFS HTML for the practice one.
  for (const [target, label] of [[practiceId, PRACTICE_CODE], [sampleId, SAMPLE_CODE]]) {
    const map = { ...baseMap, [String(source._id)]: String(target) };
    for (const c of ['validationresults', 'supportingevidences']) {
      const q = { submissionId: source._id };
      if (c === 'supportingevidences') q.isDeleted = { $ne: true };
      const docs = await db.collection(c).find(q).toArray();
      if (!docs.length) continue;
      const clones = docs.map((d) => {
        const x = remap(d, map);
        x._id = new ObjectId();
        x.submissionId = target;
        if ('institutionId' in x) x.institutionId = demoInstId;
        if ('uploadedBy' in x) x.uploadedBy = pc._id;
        if ('lastModifiedBy' in x) x.lastModifiedBy = pc._id;
        return x;
      });
      await db.collection(c).insertMany(clones, { ordered: false });
      created[`${label}.${c}`] = clones.length;
    }
  }

  if (srcImportId) {
    const imp = await db.collection('selfstudyimports').findOne({ _id: new ObjectId(srcImportId) });
    if (imp) {
      const x = remap(imp, { ...baseMap, [String(source._id)]: String(practiceId) });
      x._id = demoImportId;
      x.submissionId = practiceId;
      x.uploadedBy = pc._id;
      await db.collection('selfstudyimports').insertOne(x);
      created[`${PRACTICE_CODE}.selfstudyimports`] = 1;
      const html = await db.collection('htmlContent.files').findOne({ filename: `${srcImportId}.html` });
      if (html) {
        await copyGridFsFile(db, 'htmlContent', html, `${demoImportId}.html`);
        created[`${PRACTICE_CODE}.htmlContent.files`] = 1;
      }
      const imgs = await db.collection('images.files').find({ filename: { $regex: `^${srcImportId}/` } }).toArray();
      for (const f of imgs) await copyGridFsFile(db, 'images', f, f.filename.replace(srcImportId, String(demoImportId)));
      if (imgs.length) created[`${PRACTICE_CODE}.images.files`] = imgs.length;
    }
  }

  // Sample completed Lead Reader Report (clearly marked as practice data).
  await db.collection('leadreaderreports').insertOne({
    submissionId: sampleId,
    vpaRecipients: 'Dr. Demo Provost, Vice President for Academic Affairs (SAMPLE)',
    contactInfo: `Demo Coordinator — ${DEMO_PC_EMAIL}, 1 Practice Way, Demo City, MD`,
    accreditationStatus: 'initial',
    initialAccreditationDate: '',
    lastReaccreditationDate: '',
    siteVisitDate: '',
    noSiteVisitRequired: false,
    programDescription: 'SAMPLE PRACTICE REPORT — Demo University is a practice school. This Lead Reader Report is sample data for CSHSE Board members to explore; it is not a real review.',
    strengthsFromSelfStudy: 'Sample: well-documented field placement sequence; strong faculty credentials.',
    strengthsFromSiteVisit: 'Sample: engaged advisory committee and students.',
    nonComplianceText: 'Sample: Standard 7.e — provide evidence of faculty professional development funding.',
    requiredCoursesOverride: '',
    secondSiteVisitorName: '',
    recommendation: 'conditional',
    conditionalRequirements: 'Sample: submit evidence for Standard 7.e within six months.',
    holdExplanation: '',
    additionalRecommendations: 'Sample: consider expanding community partnerships.',
    nextSelfStudySuggestions: 'Sample: link every artifact directly from the narrative.',
    submittedByName: 'Demo Lead Reader',
    submissionDate: now.toLocaleDateString('en-US'),
    updatedAt: now,
    __v: 0,
  });
  created[`${SAMPLE_CODE}.leadreaderreports`] = 1;

  console.log('\nCreated:', JSON.stringify(created, null, 2));

  // ---- 6. Verify Stevenson untouched ----
  const after = await snapshotStevenson(db, stev);
  console.log('\nStevenson AFTER:', JSON.stringify(after, null, 2));
  const same = JSON.stringify(before) === JSON.stringify(after);
  console.log(`\nStevenson unchanged: ${same ? 'YES' : 'NO'}`);

  console.log('\nDemo ids:');
  console.log(`  institution  ${DEMO}  ${demoInstId}`);
  console.log(`  submission   ${PRACTICE_CODE} (in_progress, practice)  ${practiceId}`);
  console.log(`  submission   ${SAMPLE_CODE} (review_complete, sample LRR)  ${sampleId}`);
  console.log(`  import       ${demoImportId}`);
  console.log(`  user PC      ${DEMO_PC_EMAIL}  ${pc._id}`);
  console.log(`  user Board   ${DEMO_BOARD_EMAIL}  ${board._id}`);
  await client.close();
  if (!same) process.exit(2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
