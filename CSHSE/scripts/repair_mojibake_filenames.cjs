#!/usr/bin/env node
/**
 * Repair file names stored garbled by the old multer latin1 decoding
 * ("Program Differentiators â\u0080\u0093 ETSU.pdf" → "Program Differentiators – ETSU.pdf",
 * "MASTERâ\u0080\u0099S" → "MASTER’S"). New uploads are already correct
 * (server/src/middleware/utf8Upload.ts); this fixes what was stored before.
 *
 * A value is changed only when it contains a mis-decoded sequence AND its
 * latin1 bytes form valid UTF-8 — the same rule as fixUploadFilename().
 *
 * DRY-RUN BY DEFAULT. With --apply, every document it changes is first saved
 * to --backup=<file.json> (default ~/Documents/CSHSE-backups/mojibake-<db>-<ts>.json).
 *   MONGO_URI='mongodb://…/CSHSE?authSource=admin' node scripts/repair_mojibake_filenames.cjs [--apply]
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));
const APPLY = process.argv.includes('--apply');
const URI = process.env.MONGO_URI;
if (!URI) { console.error('Set MONGO_URI'); process.exit(1); }

// collection -> dotted fields that hold a user-facing file name / title
const TARGETS = {
  supportingevidences: ['file.originalName', 'description', 'title', 'url.title'],
  files: ['originalName', 'description'],
  helpdocuments: ['originalName', 'filename', 'title'],
  selfstudyimports: ['originalFilename', 'fileName', 'originalName'],
  importbatches: ['files.originalName'],
  comments: ['attachments.originalName', 'attachment.originalName'],
};
const MOJI = /[Â-ô][\u0080-¿]/;
// Same class with the literal characters — MongoDB's PCRE2 rejects \u escapes.
const DB_MOJI = new RegExp('[' + String.fromCharCode(0xc2) + '-' + String.fromCharCode(0xf4) + '][' + String.fromCharCode(0x80) + '-' + String.fromCharCode(0xbf) + ']');

function repair(s) {
  if (typeof s !== 'string' || !MOJI.test(s) || /[^\u0000-ÿ]/.test(s)) return null;
  const fixed = Buffer.from(s, 'latin1').toString('utf8');
  if (fixed.includes('�') || fixed === s) return null;
  return fixed.normalize('NFC');
}

/** Visit a dotted path, descending into arrays; calls fn(container, key, value). */
function visit(obj, parts, fn) {
  if (obj == null) return;
  if (Array.isArray(obj)) return obj.forEach((o) => visit(o, parts, fn));
  const [head, ...rest] = parts;
  if (!rest.length) { if (typeof obj[head] === 'string') fn(obj, head, obj[head]); return; }
  visit(obj[head], rest, fn);
}

(async () => {
  const client = await MongoClient.connect(URI);
  const db = client.db();
  const have = new Set((await db.listCollections().toArray()).map((c) => c.name));
  console.log(`[mojibake] db=${db.databaseName} mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const backup = [];
  let docs = 0, values = 0;
  for (const [col, fields] of Object.entries(TARGETS)) {
    if (!have.has(col)) continue;
    const or = fields.map((f) => ({ [f]: DB_MOJI }));
    for await (const d of db.collection(col).find({ $or: or })) {
      const before = JSON.parse(JSON.stringify(d));
      const changes = [];
      for (const f of fields) visit(d, f.split('.'), (o, k, v) => { const r = repair(v); if (r) { o[k] = r; changes.push([f, v, r]); } });
      if (!changes.length) continue;
      docs++; values += changes.length;
      for (const [f, v, r] of changes) console.log(`  ${col} ${d._id} ${f}: ${JSON.stringify(v)} -> ${JSON.stringify(r)}`);
      if (APPLY) {
        backup.push({ collection: col, doc: before });
        const $set = {};
        for (const f of new Set(changes.map((c) => c[0].split('.')[0]))) $set[f] = d[f];
        await db.collection(col).updateOne({ _id: d._id }, { $set });
      }
    }
  }
  if (APPLY && backup.length) {
    const arg = process.argv.find((a) => a.startsWith('--backup='));
    const file = arg ? arg.slice(9) : path.join(os.homedir(), 'Documents', 'CSHSE-backups', `mojibake-${db.databaseName}-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(backup, null, 1));
    console.log(`  backup: ${file}`);
  }
  console.log(`  ${docs} document(s), ${values} value(s) ${APPLY ? 'repaired' : 'would be repaired — re-run with --apply'}`);
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });
