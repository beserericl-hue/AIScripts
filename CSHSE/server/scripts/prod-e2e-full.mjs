/**
 * COMPLETE production E2E — drives the real pipeline as superuser, exercising
 * web<->cshse-ai<->Anthropic, then HARD-deletes everything it created (direct
 * Mongo) so production stays pristine for the beta. Cleanup runs in finally even
 * on failure.
 *
 * Env (never logged): BASE, SU_EMAIL, SU_PW, MONGO_URI (prod, for cleanup).
 */
import { readFileSync } from 'fs';
import { MongoClient, ObjectId } from 'mongodb';

let __mc = null;
async function getDb() {
  if (!__mc) { __mc = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 }); await __mc.connect(); }
  return __mc.db();
}

const BASE = (process.env.BASE || 'https://cshse.courseworx.media').replace(/\/+$/, '');
const EMAIL = process.env.SU_EMAIL, PW = process.env.SU_PW, MONGO_URI = process.env.MONGO_URI;
const DOC = process.env.DOC || '/Users/ericbeser/Documents/GitHub/AIScripts/CSHSE/docs/Sample to Council from KSU.docx';
if (!EMAIL || !PW || !MONGO_URI) { console.error('SU_EMAIL, SU_PW, MONGO_URI required'); process.exit(1); }

const TAG = 'e2e-smoke-prod';
let SU = null;
const cap = { institutionId: null, submissionId: null, importId: null, userIds: [], reviewIds: [], compilationId: null };
const R = [];
const log = (...a) => console.log(...a);
function rec(name, pass, detail) { R.push({ name, pass }); log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); return pass; }

async function api(method, path, { body, token = SU, imp, multipart } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (imp) headers['X-Impersonated-User-Id'] = imp;
  let payload;
  if (multipart) { payload = multipart; }
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const t = await res.text(); let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  return { status: res.status, data: d };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const idOf = (o) => o && (o._id || o.id);

async function main() {
  // 1 LOGIN
  let r = await api('POST', '/api/auth/login', { token: null, body: { email: EMAIL, password: PW } });
  SU = r.data?.token || r.data?.accessToken || r.data?.data?.token;
  rec('1 login superuser', r.status < 300 && !!SU, `status=${r.status}`);
  if (!SU) throw new Error('no token');

  // 2 CREATE INSTITUTION
  r = await api('POST', '/api/institutions', { body: {
    name: `E2E Smoke Univ ${TAG}`, type: 'university',
    address: { street: '1 Test St', city: 'Testville', state: 'MD', zip: '21000', country: 'USA' },
    primaryContact: { name: 'E2E Admin', email: `e2e-admin@${TAG}.test`, phone: '555-0100' },
  }});
  cap.institutionId = idOf(r.data?.institution || r.data);
  rec('2 create institution', r.status < 300 && !!cap.institutionId, `status=${r.status} id=${cap.institutionId}`);

  // 3 PROVISION PC + 2 READERS + LEAD READER as real active User docs (invite
  // only creates pending Invitations; the pipeline needs real reader users).
  const dbi = await getDb();
  async function mkUser(role, n) {
    const now = new Date();
    const doc = {
      email: `${role}-${n}-${TAG}@example.test`, firstName: role, lastName: `T${n}`,
      role, institutionId: new ObjectId(cap.institutionId), status: 'active', isActive: true,
      provisionedBy: { type: 'manual' }, createdAt: now, updatedAt: now, __v: 0,
    };
    const r = await dbi.collection('users').insertOne(doc);
    const uid = String(r.insertedId); cap.userIds.push(uid);
    return { uid };
  }
  const pc = await mkUser('program_coordinator', 1);
  rec('3a provision program_coordinator', !!pc.uid, pc.uid);
  const rd1 = await mkUser('reader', 1), rd2 = await mkUser('reader', 2);
  rec('3b provision reader x2', !!(rd1.uid && rd2.uid), `${rd1.uid} ${rd2.uid}`);
  const lead = await mkUser('lead_reader', 1);
  rec('3c provision lead_reader', !!lead.uid, lead.uid);

  // 4 CREATE SUBMISSION
  r = await api('POST', '/api/submissions', { body: {
    institutionId: cap.institutionId, institutionName: `E2E Smoke Univ ${TAG}`,
    programName: 'E2E Human Services BA', programLevel: 'bachelors', type: 'initial' } });
  cap.submissionId = idOf(r.data?.submission || r.data);
  rec('4 create submission', r.status < 300 && !!cap.submissionId, `status=${r.status} id=${cap.submissionId}`);

  // 5 UPLOAD self-study doc
  const fd = new FormData();
  fd.append('submissionId', cap.submissionId);
  fd.append('file', new Blob([readFileSync(DOC)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'sample-self-study.docx');
  r = await api('POST', '/api/imports/upload', { multipart: fd });
  cap.importId = r.data?.importId || idOf(r.data?.import || r.data);
  rec('5 upload self-study .docx', r.status < 300 && !!cap.importId, `status=${r.status} id=${cap.importId}`);

  // 6 START AI IMPORT (web -> cshse-ai -> Anthropic)
  r = await api('POST', `/api/imports/${cap.importId}/start-ai`, { body: { programLevel: 'bachelors' } });
  rec('6 start-ai (web->cshse-ai)', r.status < 300, `status=${r.status} ${JSON.stringify(r.data).slice(0,120)}`);

  // 7 POLL AI IMPORT until finished (<= 10 min)
  let aiDone = false, aiStat = '';
  for (let i = 0; i < 80; i++) {
    const s = await api('GET', `/api/imports/${cap.importId}/ai-status`);
    aiStat = s.data?.aiStatus || s.data?.status || '';
    const prog = s.data?.progress ?? '';
    if (['finished', 'complete', 'completed', 'done'].includes(String(aiStat).toLowerCase())) { aiDone = true; break; }
    if (['error', 'failed'].includes(String(aiStat).toLowerCase())) break;
    if (i % 4 === 0) log(`   …ai-status=${aiStat} progress=${prog} (${i*8}s)`);
    await sleep(8000);
  }
  rec('7 AI import parsed (cshse-ai+Anthropic+S3)', aiDone, `aiStatus=${aiStat}`);

  // 8 APPLY AI IMPORT
  if (aiDone) {
    r = await api('POST', `/api/imports/${cap.importId}/apply-ai`, { body: {} });
    rec('8 apply-ai (materialize)', r.status < 300, `status=${r.status} ${JSON.stringify(r.data).slice(0,100)}`);
  } else rec('8 apply-ai (skipped, import not finished)', false);

  // 9 VALIDATE-ALL (background -> cshse-ai /ai/section/evaluate)
  r = await api('POST', `/api/submissions/${cap.submissionId}/review/evaluate-all`, { body: {} });
  rec('9 evaluate-all enqueued', r.status < 300, `status=${r.status} ${JSON.stringify(r.data).slice(0,100)}`);

  // 10 POLL eval progress (<= 10 min)
  let evalDone = false, evalInfo = '';
  for (let i = 0; i < 75; i++) {
    const s = await api('GET', `/api/submissions/${cap.submissionId}/review/eval-progress`);
    const { total, done, remaining, running } = s.data || {};
    evalInfo = `done=${done}/${total} remaining=${remaining}`;
    if (running === false && (total > 0)) { evalDone = true; break; }
    if (i % 4 === 0) log(`   …${evalInfo} running=${running} (${i*8}s)`);
    await sleep(8000);
  }
  rec('10 AI validation completed', evalDone, evalInfo);

  // 11 SUBMIT self-study
  r = await api('POST', `/api/submissions/${cap.submissionId}/submit`, { body: {} });
  rec('11 submit self-study', r.status < 300, `status=${r.status} -> ${(r.data?.submission||{}).status}`);

  // 12 ASSIGN READERS
  r = await api('POST', `/api/reviews/submissions/${cap.submissionId}/assign`, { body: {
    readerIds: [rd1.uid, rd2.uid], reason: 'E2E smoke reader assignment' } });
  const reviews = r.data?.reviews || r.data?.assignments || [];
  cap.reviewIds = reviews.map(idOf).filter(Boolean);
  const reviewByReader = {}; reviews.forEach(v => { reviewByReader[v.reviewerId || v.readerId] = idOf(v); });
  rec('12 assign readers', r.status < 300 && reviews.length >= 1, `status=${r.status} reviews=${reviews.length}`);

  // 13 READER SCORING (impersonate each reader) — score a few specs + final + submit
  async function readerFlow(uid, label) {
    const revId = reviewByReader[uid];
    if (!revId) return rec(`13 ${label} review found`, false);
    let okAll = true;
    for (const [std, spec] of [['1','1.1'],['1','1.2'],['2','2.1']]) {
      const a = await api('PATCH', `/api/reviews/${revId}/assessment`, {
        imp: uid, body: { standardCode: std, specCode: spec, compliance: 'compliant', comments: `E2E ${spec}` } });
      okAll = okAll && a.status < 300;
    }
    const f = await api('PATCH', `/api/reviews/${revId}/final-assessment`, {
      imp: uid, body: { finalRecommendation: 'accreditation_no_conditions', strengths: 'E2E ok', weaknesses: 'none' } });
    const sub = await api('POST', `/api/reviews/${revId}/submit`, { imp: uid, body: {} });
    return rec(`13 ${label} score+final+submit`, okAll && f.status < 300 && sub.status < 300,
      `assess=${okAll} final=${f.status} submit=${sub.status}`);
  }
  await readerFlow(rd1.uid, 'reader1');
  await readerFlow(rd2.uid, 'reader2');

  // 14 LEAD READER compile -> determinations -> final -> submit (impersonate lead)
  const li = lead.uid;
  r = await api('POST', `/api/lead-reviews/submissions/${cap.submissionId}`, { imp: li, body: {} });
  cap.compilationId = idOf(r.data?.compilation || r.data);
  let leadOk = r.status < 300 && !!cap.compilationId;
  if (cap.compilationId) {
    const det = await api('PATCH', `/api/lead-reviews/${cap.compilationId}/determinations/bulk`, { imp: li, body: { useConsensus: true } });
    const fin = await api('PATCH', `/api/lead-reviews/${cap.compilationId}/final`, { imp: li, body: {
      finalRecommendation: 'accreditation_no_conditions', finalStrengths: 'E2E strong', finalWeaknesses: 'E2E minor' } });
    const sub = await api('POST', `/api/lead-reviews/${cap.compilationId}/submit`, { imp: li, body: { signature: 'E2E Lead' } });
    leadOk = leadOk && fin.status < 300 && sub.status < 300;
    log(`   lead: det=${det.status} final=${fin.status} submit=${sub.status}`);
  }
  rec('14 lead-reader compile+finalize+submit', leadOk, `compId=${cap.compilationId}`);

  // 15 BOARD DECISION (as superuser)
  r = await api('POST', `/api/submissions/${cap.submissionId}/decision`, { body: {
    outcome: 'accept', comments: 'E2E board accept',
    effectiveAt: '2026-06-14T00:00:00Z', expiresAt: '2033-06-14T00:00:00Z' } });
  rec('15 board decision', r.status < 300, `status=${r.status} -> ${(r.data?.submission||{}).status}`);
}

async function hardCleanup() {
  log('\n--- CLEANUP (hard-delete from prod Mongo) ---');
  {
    const db = await getDb();
    const instId = cap.institutionId, subId = cap.submissionId, impId = cap.importId;
    let total = 0;
    async function del(coll, filter) {
      try { const r = await db.collection(coll).deleteMany(filter); if (r.deletedCount) { total += r.deletedCount; log(`   ${coll} -${r.deletedCount}`); } } catch {}
    }
    // institutions / users / submissions / imports by _id
    if (instId) await del('institutions', { _id: { $in: await mixIds([instId]) } });
    if (cap.userIds.length) await del('users', { _id: { $in: await mixIds(cap.userIds) } });
    if (subId) await del('submissions', { _id: { $in: await mixIds([subId]) } });
    if (impId) await del('selfstudyimports', { _id: { $in: await mixIds([impId]) } });
    // anything referencing the submission / institution / import
    for (const coll of ['selfstudyimports','supportingevidences','reviews','leadreadercompilations','scores','validationresults','comments','notifications','assignments','curriculummatrixes','invitations','files']) {
      await del(coll, { $or: [
        { submissionId: { $in: await mixIds([subId]) } },
        { institutionId: { $in: await mixIds([instId]) } },
        { importId: { $in: await mixIds([impId]) } },
      ].filter(x => Object.values(x)[0].$in.length) });
    }
    // GridFS htmlContent: delete chunks then files for this import
    if (impId) {
      const hf = await db.collection('htmlContent.files').find({ 'metadata.importId': impId }).project({ _id: 1 }).toArray();
      const fids = hf.map(f => f._id);
      if (fids.length) { await del('htmlContent.chunks', { files_id: { $in: fids } }); await del('htmlContent.files', { _id: { $in: fids } }); }
    }
    log(`   cleanup removed ~${total} docs`);
    const left = await db.collection('institutions').countDocuments();
    const subs = await db.collection('submissions').countDocuments();
    const usrs = await db.collection('users').countDocuments();
    log(`   POST-CLEANUP: institutions=${left} submissions=${subs} users=${usrs}`);
  }
}
async function mixIds(arr) {
  const out = [];
  for (const s of arr.filter(Boolean)) { out.push(s); try { out.push(new ObjectId(s)); } catch {} }
  return out;
}

let failed = false;
try { await main(); } catch (e) { failed = true; console.error('E2E ERROR:', e.message); }
finally {
  try { await hardCleanup(); } catch (e) { console.error('CLEANUP ERROR:', e.message); }
  if (__mc) await __mc.close().catch(() => {});
}
const pass = R.filter(r => r.pass).length;
log(`\n==== E2E RESULT: ${pass}/${R.length} passed ====`);
R.filter(r => !r.pass).forEach(r => log(`   FAILED: ${r.name}`));
process.exit(failed || pass < R.length ? 1 : 0);
