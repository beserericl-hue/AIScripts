/**
 * Seed the BASELINE parser rules (CR-073 §"Baseline capture") into the
 * `parserrules` collection. These are the rules the PROVEN parser already
 * applies to MCC, AACC and Kennesaw — captured here as explicit, versioned data
 * (the v1 baseline the rule-engine phase will consume and every future Parser
 * Train rule extends). Idempotent: upsert by (ruleId, version).
 *
 *   MONGO_URI=... node scripts/seed_baseline_parser_rules.mjs
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
if (!uri) { console.error('MONGO_URI required'); process.exit(1); }

const A = (emit = true) => ({ emit, wrap: 'section', idFrom: 'sectionId' });
const now = new Date();

// provenance: which proven document exhibits the rule
const RULES = [
  // ---- format detection ----
  { ruleId: 'detect.table-cells', name: 'Detect: fold table-cell text into format detection',
    description: 'A tabular official template hides its Standard N: / Response: signals inside table cells; detection reads cell text so it classifies template, not self_study.',
    match: { format: 'template', region: 'document', signature: { source: 'doc.paragraphs + table cells', signals: ['Standard N:', 'Response:'] } },
    extract: {}, examples: [{ doc: 'AACC' }] },

  // ---- template walker ----
  { ruleId: 'tmpl.standard-header', name: 'Template: Standard N: heading → standard root (intro)',
    match: { format: 'template', region: 'cell', signature: { firstCellRegex: '^\\s*Standard\\s+(\\d{1,2})\\s*:' } },
    extract: { standardAssignment: 'from-header', classification: 'intro' }, examples: [{ doc: 'AACC' }, { doc: 'Kennesaw' }] },
  { ruleId: 'tmpl.spec-row', name: 'Template: lettered spec row → narrative',
    match: { format: 'template', region: 'table', signature: { letterMarkerRegex: '^\\s*([a-j])[.)]?\\s*$' } },
    extract: { specAssignment: 'first-column-letter', contentCell: 'last-non-marker', promptResponseSplit: 'response-marker', classification: 'narrative' }, examples: [{ doc: 'AACC' }] },
  { ruleId: 'tmpl.headerless-continuation', name: 'Template: headerless table starting at "a" → next sequential standard',
    description: 'AACC Standards 5 and 10 have no Standard N: header cell; a headerless spec table whose first letter is a opens the next standard; a later letter continues the current one.',
    match: { format: 'template', region: 'table', signature: { hasStandardHeader: false, firstLetter: 'a' } },
    extract: { standardAssignment: 'sequential-next', specAssignment: 'first-column-letter', contentCell: 'last-non-marker', classification: 'narrative' }, examples: [{ doc: 'AACC', region: 'Std 5, Std 10' }] },
  { ruleId: 'tmpl.content-cell-last-non-marker', name: 'Template: 3-column table (a.|a.|content) → read the last non-marker cell',
    match: { format: 'template', region: 'table', signature: { columnCount: 3, duplicatedLetterMarker: true } },
    extract: { contentCell: 'last-non-marker' }, examples: [{ doc: 'AACC', region: 'Std 16' }] },
  { ruleId: 'tmpl.split-cell-paragraph', name: 'Template: split prompt/response on cell paragraph structure (Response:, bare Response, or no marker)',
    match: { format: 'template', region: 'cell', signature: { responseMarkerRegex: '^\\s*Response\\s*:?\\.?\\s*$', alsoBareResponse: true, alsoNoMarker: true } },
    extract: { promptResponseSplit: 'first-paragraph' }, examples: [{ doc: 'AACC', region: '1.c, 5.a' }] },
  { ruleId: 'tmpl.front-tables-intro', name: 'Template: Glossary + General Program Characteristics front tables → Document Introduction',
    match: { format: 'template', region: 'table', signature: { beforeFirstStandard: true, firstCellContains: 'Glossary | numbered/lettered intro prompts' } },
    extract: { classification: 'intro' }, examples: [{ doc: 'AACC' }] },
  { ruleId: 'tmpl.hint-first-routing', name: 'Template: route by document hint (std+spec), not the semantic matcher',
    description: 'The template labels the std/spec explicitly; the matcher must not steal a hinted spec into the wrong place.',
    match: { format: 'template', region: 'document', signature: { hasTemplateStandardHint: true, hasTemplateSpecHint: true } },
    extract: { standardAssignment: 'explicit', specAssignment: 'explicit' }, examples: [{ doc: 'AACC', region: 'Std 6, 18' }] },
  { ruleId: 'tmpl.hint-wins-over-intro', name: 'Template: an explicit spec hint beats a matcher-guessed introduction',
    match: { format: 'template', region: 'document', signature: { hasSpecHint: true, matcherSaysIntroduction: true } },
    extract: { standardAssignment: 'explicit' }, examples: [{ doc: 'AACC' }] },
  { ruleId: 'tmpl.create-missing-bucket', name: 'Template: create a bucket for any doc-defined spec the level catalog lacks',
    description: 'The associate catalog (derived from baccalaureate) misses Field Experience 20.f–j; the doc defines them, so trust the document.',
    match: { format: 'template', region: 'document', signature: { specNotInCatalog: true } },
    extract: {}, examples: [{ doc: 'AACC', region: 'Std 20.f–j' }] },
  { ruleId: 'tmpl.response-is-narrative', name: 'Template: a hint-routed section is the spec narrative regardless of matcher section_type',
    match: { format: 'template', region: 'document', signature: { hintRouted: true } },
    extract: { classification: 'narrative' }, examples: [{ doc: 'AACC', region: '1.a' }] },

  // ---- MCC ----
  { ruleId: 'mcc.standard-hash', name: 'MCC: Standard #N anchors → per-standard sections',
    match: { format: 'mcc_narrative', region: 'document', signature: { standardHashRegex: '^Standard\\s+#?\\d+' } },
    extract: { standardAssignment: 'from-header', specAssignment: 'catalog-text-match', classification: 'narrative' }, examples: [{ doc: 'MCC' }] },
  { ruleId: 'mcc.appendix-index', name: 'MCC: back-of-document Appendix Index → evidence files (native PDF slices)',
    match: { format: 'mcc_narrative', region: 'document', signature: { hasAppendixIndex: true, refGrammar: 'Supporting Document…appendix <CODE>' } },
    extract: { classification: 'appendix' }, examples: [{ doc: 'MCC' }] },

  // ---- classification of supporting files ----
  { ruleId: 'file.cv', name: 'Classify: faculty CV → cvs rail',
    match: { format: 'any', region: 'document', signature: { cvSignals: ['curriculum vitae', 'education', 'employment', 'degrees'] } },
    extract: { classification: 'cv' }, examples: [{ doc: 'MCC' }, { doc: 'AACC' }] },
  { ruleId: 'file.syllabus', name: 'Classify: syllabus → syllabi rail',
    match: { format: 'any', region: 'document', signature: { syllabusSignals: ['course', 'objectives', 'credit hours', 'schedule'] } },
    extract: { classification: 'syllabus' }, examples: [{ doc: 'MCC' }] },
  { ruleId: 'file.matrix', name: 'Classify: curriculum matrix → matrices rail',
    match: { format: 'any', region: 'table', signature: { matrixSignals: ['Standards (11-20)', 'course × spec grid'] } },
    extract: { classification: 'matrix' }, examples: [{ doc: 'MCC' }] },

  // ---- the anchor tag (global, non-negotiable §7d) ----
  { ruleId: 'anchor.every-item', name: 'Compare: emit a data-section-id marker for EVERY review item',
    description: 'Every narrative/evidence/intro item must carry a <section data-section-id> in the source HTML so Compare resolves to "located". Enforced by _ensure_all_items_anchored + reanchor-source.',
    match: { format: 'any', region: 'document', signature: { appliesTo: 'all items' } },
    extract: {}, examples: [{ doc: 'AACC' }, { doc: 'Kennesaw' }, { doc: 'MCC' }] },
];

(async () => {
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 });
  await c.connect();
  const col = c.db().collection('parserrules');
  await col.createIndex({ ruleId: 1, version: 1 }, { unique: true }).catch(() => {});
  let up = 0;
  for (const r of RULES) {
    const doc = {
      ruleId: r.ruleId, name: r.name, description: r.description || '',
      version: 1, scope: { level: 'global' }, status: 'active',
      createdBy: 'human', match: r.match, extract: r.extract || {},
      anchor: A(true), examples: r.examples || [], confidence: 1.0,
      contractChecks: {}, metrics: { appliedCount: 0 }, updatedAt: now,
    };
    await col.updateOne(
      { ruleId: r.ruleId, version: 1 },
      { $set: doc, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    up++;
  }
  const total = await col.countDocuments({ status: 'active' });
  console.log(`seeded/updated ${up} baseline rules; active rules in store: ${total}`);
  await c.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
