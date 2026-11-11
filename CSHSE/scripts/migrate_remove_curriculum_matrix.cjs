#!/usr/bin/env node
/**
 * Data migration — remove the curriculum matrix (CSHSE board decision, Nov 2026).
 *
 * The matrix is no longer part of the self-study. This deletes every matrix
 * record and strips every matrix field, and marks matrix DOCUMENTS (which stay
 * in the File Library) as excluded — exactly what the server's
 * services/curriculumMatrixExclusion.ts does for new uploads.
 *
 * DRY-RUN BY DEFAULT: prints what it would change. Pass --apply to write.
 * Re-runnable: a second --apply run finds nothing left to change.
 *
 *   MONGO_URI='mongodb://…/CSHSE?authSource=admin' node scripts/migrate_remove_curriculum_matrix.cjs
 *   MONGO_URI='…' node scripts/migrate_remove_curriculum_matrix.cjs --apply
 *   (or --uri=<uri>)
 *
 * Steps (counts reported for each):
 *   1. delete all CurriculumMatrix documents (Mongoose collection curriculummatrixes;
 *      curriculummatrices too, should a deployment have that spelling)
 *   2. delete all ProgramCourse documents (programcourses) — the per-program
 *      course catalog existed only for the matrix's course columns
 *   3. Submission: $unset aiMatrixState + curriculumMatrices
 *   4. Submission.aiReviewState.buckets.*.matrixCells: stripped
 *   5. SelfStudyImport: $unset aiMatrices + aiAppliedCounts.matrixCells;
 *      aiBuckets.*.matrixCells stripped; detectedSections[].isMatrix unset;
 *      legacy extractedContent.sections of type 'matrix' and mappedSections of
 *      fieldType 'matrix' removed (their enum values no longer exist)
 *   6. ImportCorrection rows with expectedSectionType 'curriculum_matrix',
 *      DocumentVersion rows of kind 'matrix_template' and ParserRule rows with
 *      extract.classification 'matrix': deleted
 *   7. SupportingEvidence identified as a curriculum matrix (file name has the
 *      word matrix/matrices, the extracted text carries the official form title
 *      "Matrix Illustrating Relationship of Required Courses to Curriculum
 *      Standards", or the retired 'kind:matrix' / 'curriculum-matrix' tags):
 *      tagged 'excluded:curriculum-matrix', the retired tags pulled, and
 *      un-assigned (standardCode / specCode / metadata.aiPlacement unset).
 *      The file itself is kept.
 */
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));

const APPLY = process.argv.includes('--apply');
const uriArg = process.argv.find((a) => a.startsWith('--uri='));
const URI = (uriArg && uriArg.slice('--uri='.length)) || process.env.MONGO_URI;
if (!URI) {
  console.error('Set MONGO_URI (or pass --uri=…).');
  process.exit(2);
}

// Keep these in sync with server/src/services/curriculumMatrixExclusion.ts.
const EXCLUDED_TAG = 'excluded:curriculum-matrix';
const RETIRED_TAGS = ['kind:matrix', 'curriculum-matrix'];
const NAME_RE = /(?<![a-z])matri(?:x|ces)(?![a-z])/i;
const FORM_TITLE_RE = /matrix\s+illustrating\s+relationship\s+of\s+required\s+courses\s+to\s+curriculum\s+standards/i;

const counts = {};
const bump = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

function stripBucketCells(buckets) {
  if (!buckets || typeof buckets !== 'object') return 0;
  let n = 0;
  for (const b of Object.values(buckets)) {
    if (b && typeof b === 'object' && Object.prototype.hasOwnProperty.call(b, 'matrixCells')) {
      delete b.matrixCells;
      n += 1;
    }
  }
  return n;
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();
  const have = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));
  const col = (name) => (have.has(name) ? db.collection(name) : null);
  console.log(`[migrate] db=${db.databaseName} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  // 1 + 2 — matrix records.
  for (const name of ['curriculummatrixes', 'curriculummatrices', 'programcourses']) {
    const c = col(name);
    const n = c ? await c.countDocuments({}) : 0;
    counts[`${name} deleted`] = n;
    if (APPLY && c && n) await c.deleteMany({});
  }

  // 3 + 4 — submissions.
  const subs = col('submissions');
  if (subs) {
    counts['submissions with aiMatrixState'] = await subs.countDocuments({ aiMatrixState: { $exists: true } });
    counts['submissions with curriculumMatrices'] = await subs.countDocuments({ curriculumMatrices: { $exists: true } });
    if (APPLY) await subs.updateMany(
      { $or: [{ aiMatrixState: { $exists: true } }, { curriculumMatrices: { $exists: true } }] },
      { $unset: { aiMatrixState: '', curriculumMatrices: '' } },
    );
    const cur = subs.find({ 'aiReviewState.buckets': { $exists: true } }, { projection: { 'aiReviewState.buckets': 1 } });
    for await (const s of cur) {
      const buckets = s.aiReviewState && s.aiReviewState.buckets;
      const n = stripBucketCells(buckets);
      if (!n) continue;
      bump('submissions with review buckets carrying matrixCells');
      bump('review buckets stripped of matrixCells', n);
      if (APPLY) await subs.updateOne({ _id: s._id }, { $set: { 'aiReviewState.buckets': buckets } });
    }
  }

  // 5 — imports.
  const imps = col('selfstudyimports');
  if (imps) {
    counts['imports with aiMatrices'] = await imps.countDocuments({ aiMatrices: { $exists: true } });
    counts['imports with aiAppliedCounts.matrixCells'] = await imps.countDocuments({ 'aiAppliedCounts.matrixCells': { $exists: true } });
    if (APPLY) await imps.updateMany(
      { $or: [{ aiMatrices: { $exists: true } }, { 'aiAppliedCounts.matrixCells': { $exists: true } }] },
      { $unset: { aiMatrices: '', 'aiAppliedCounts.matrixCells': '' } },
    );
    const cur = imps.find(
      { $or: [
        { aiBuckets: { $exists: true } },
        { 'detectedSections.isMatrix': { $exists: true } },
        { 'extractedContent.sections.sectionType': 'matrix' },
        { 'mappedSections.fieldType': 'matrix' },
      ] },
      { projection: { aiBuckets: 1, detectedSections: 1, 'extractedContent.sections': 1, mappedSections: 1 } },
    );
    for await (const im of cur) {
      const set = {};
      const n = stripBucketCells(im.aiBuckets);
      if (n) { bump('imports with aiBuckets carrying matrixCells'); bump('import buckets stripped of matrixCells', n); set.aiBuckets = im.aiBuckets; }
      if (Array.isArray(im.detectedSections) && im.detectedSections.some((d) => d && 'isMatrix' in d)) {
        const marked = im.detectedSections.filter((d) => d && d.isMatrix).length;
        bump('imports with detectedSections.isMatrix');
        bump('detectedSections flagged isMatrix (flag removed)', marked);
        set.detectedSections = im.detectedSections.map((d) => { if (d && 'isMatrix' in d) { const { isMatrix, ...rest } = d; return rest; } return d; });
      }
      const secs = im.extractedContent && im.extractedContent.sections;
      if (Array.isArray(secs) && secs.some((x) => x && x.sectionType === 'matrix')) {
        bump('legacy extracted matrix sections removed', secs.filter((x) => x && x.sectionType === 'matrix').length);
        set['extractedContent.sections'] = secs.filter((x) => !(x && x.sectionType === 'matrix'));
      }
      if (Array.isArray(im.mappedSections) && im.mappedSections.some((x) => x && x.fieldType === 'matrix')) {
        bump('legacy matrix mappedSections removed', im.mappedSections.filter((x) => x && x.fieldType === 'matrix').length);
        set.mappedSections = im.mappedSections.filter((x) => !(x && x.fieldType === 'matrix'));
      }
      if (APPLY && Object.keys(set).length) await imps.updateOne({ _id: im._id }, { $set: set });
    }
  }

  // 6 — retired enum values.
  for (const [name, q, label] of [
    ['importcorrections', { expectedSectionType: 'curriculum_matrix' }, 'importcorrections (curriculum_matrix) deleted'],
    ['documentversions', { kind: 'matrix_template' }, 'documentversions (matrix_template) deleted'],
    ['parserrules', { 'extract.classification': 'matrix' }, 'parserrules (classification matrix) deleted'],
  ]) {
    const c = col(name);
    const n = c ? await c.countDocuments(q) : 0;
    counts[label] = n;
    if (APPLY && c && n) await c.deleteMany(q);
  }

  // 7 — matrix documents in the File Library.
  const ev = col('supportingevidences');
  if (ev) {
    const cur = ev.find(
      { $or: [
        { 'file.originalName': NAME_RE },
        { 'file.filename': NAME_RE },
        { tags: { $in: [EXCLUDED_TAG, ...RETIRED_TAGS] } },
        { extractedText: FORM_TITLE_RE },
        { 'metadata.description': FORM_TITLE_RE },
      ] },
      { projection: { 'file.originalName': 1, tags: 1, standardCode: 1, specCode: 1, 'metadata.aiPlacement': 1, isDeleted: 1, submissionId: 1 } },
    );
    const samples = [];
    for await (const e of cur) {
      const tags = (e.tags || []).map(String);
      const needs = !tags.includes(EXCLUDED_TAG) || tags.some((t) => RETIRED_TAGS.includes(t))
        || e.standardCode || e.specCode || (e.metadata && e.metadata.aiPlacement);
      bump('matrix documents found (kept in File Library)');
      if (e.isDeleted) bump('  of which soft-deleted');
      if (!needs) { bump('  already marked'); continue; }
      bump('matrix documents to tag + un-assign');
      if (e.standardCode) bump('  of which were filed under a Standard');
      if (samples.length < 15) samples.push(`${e.file && e.file.originalName} [sub ${e.submissionId}] std=${e.standardCode || '-'}.${e.specCode || '-'}`);
      if (APPLY) {
        await ev.updateOne({ _id: e._id }, {
          $set: { tags: [...tags.filter((t) => !RETIRED_TAGS.includes(t) && t !== EXCLUDED_TAG), EXCLUDED_TAG] },
          $unset: { standardCode: '', specCode: '', 'metadata.aiPlacement': '' },
        });
      }
    }
    if (samples.length) console.log('[migrate] sample matrix documents:\n  ' + samples.join('\n  '));
  }

  console.log('[migrate] counts:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);
  if (!APPLY) console.log('[migrate] DRY-RUN — nothing written. Re-run with --apply to write.');
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
