#!/usr/bin/env node
/**
 * Template imports turned each Standard ROOT row (CSHSE's standard statement,
 * no program text) into an EMPTY Introduction draft; approving one wrote
 * "<p></p>" into the editor's Standard introduction. This removes empty intro
 * drafts from aiReviewState.introductions (and their ids from approvedIds), and
 * clears standardIntroductions / documentIntroduction values that render
 * nothing. Non-empty drafts and real introductions are never touched.
 *
 *   DRY-RUN BY DEFAULT.  MONGO_URI='…' node scripts/drop_empty_intro_drafts.cjs [--apply] [--backup=<file>]
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require(path.join(__dirname, '..', 'server', 'node_modules', 'mongodb'));
const APPLY = process.argv.includes('--apply');
const BK = (process.argv.find((a) => a.startsWith('--backup=')) || '').slice(9);
// Mirrors server/src/services/introItems.ts: an item with no visible text, or
// whose only text is CSHSE's own lead-in prompt ("Describe and provide
// evidence that the following are adequately addressed in the curriculum:"),
// is not a program draft.
const promptOnly = (t) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return !!t && t.length <= 300 && /^(describe|provide|identify|explain|document|demonstrate|list|show|discuss)\b[^.:;?!]*:$/i.test(t); };
const visibleText = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
const hasBody = (it) => {
  if (!it) return false;
  const h = String(it.htmlSnippet || '');
  if (/<(img|table)\b/i.test(h)) return true;
  const t = String(it.snippet || '').trim() || visibleText(h);
  return !!t && !promptOnly(t);
};
const emptyHtml = (h) => !/<(img|table)\b/i.test(String(h || '')) && (visibleText(h).length === 0 || promptOnly(visibleText(h)));
(async () => {
  const c = await MongoClient.connect(process.env.MONGO_URI); const db = c.db();
  const subs = await db.collection('submissions').find({}, { projection: { submissionId: 1, institutionName: 1, 'aiReviewState.introductions': 1, 'aiReviewState.approvedIds': 1, standardIntroductions: 1, documentIntroduction: 1 } }).toArray();
  const backup = []; let items = 0, intros = 0, touched = 0;
  for (const s of subs) {
    const I = s.aiReviewState?.introductions || {}; const set = {}; const unset = {}; const dropIds = [];
    for (const [k, b] of Object.entries(I)) {
      const keep = (b.items || []).filter(hasBody);
      const drop = (b.items || []).filter((x) => !hasBody(x));
      if (!drop.length) continue;
      items += drop.length; dropIds.push(...drop.map((x) => x.sectionId));
      if (keep.length) set[`aiReviewState.introductions.${k}.items`] = keep; else unset[`aiReviewState.introductions.${k}`] = '';
    }
    for (const [code, html] of Object.entries(s.standardIntroductions || {})) if (emptyHtml(html)) { unset[`standardIntroductions.${code}`] = ''; intros++; }
    if (s.documentIntroduction != null && s.documentIntroduction !== '' && emptyHtml(s.documentIntroduction)) { set.documentIntroduction = ''; intros++; }
    if (!Object.keys(set).length && !Object.keys(unset).length) continue;
    touched++;
    console.log(`  ${s.submissionId} ${s.institutionName}: ${dropIds.length} empty draft(s), ${Object.keys(unset).filter((k) => k.startsWith('standardIntroductions.')).length} empty standard intro(s)`);
    if (APPLY) {
      backup.push(s);
      const upd = {}; if (Object.keys(set).length) upd.$set = set; if (Object.keys(unset).length) upd.$unset = unset;
      await db.collection('submissions').updateOne({ _id: s._id }, upd);
      if (dropIds.length) await db.collection('submissions').updateOne({ _id: s._id }, { $pull: { 'aiReviewState.approvedIds': { $in: dropIds } } });
    }
  }
  if (APPLY && BK) fs.writeFileSync(BK, JSON.stringify(backup, null, 1));
  console.log(`[empty-intros] ${APPLY ? 'APPLY' : 'DRY-RUN'} · ${touched} submission(s), ${items} empty draft(s), ${intros} empty editor intro(s)${APPLY && BK ? ` · backup ${BK}` : ''}`);
  await c.close();
})().catch((e) => { console.error(e); process.exit(1); });
