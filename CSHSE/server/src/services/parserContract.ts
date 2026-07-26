/**
 * parserContract — the §7 required-output contract checker (CR-073 "the verifier").
 *
 * Given an import, it validates the parse result (the submission's aiReviewState)
 * + the stored source HTML against the required-output contract from
 * [[ai-parser-architecture]] §7: every item ANCHORED (the Compare marker),
 * coverage, kind + file-type classification, level, and loss. It is the agent's
 * exit test and the machine oracle the golden regression tests assert with.
 *
 * The ANCHOR check is the enforced gate (0 items may be un-anchored → Compare
 * would show "section not located"). The rest are measured + reported; the
 * golden snapshots enforce exact placement/coverage across runs.
 */
import { SelfStudyImport } from '../models/SelfStudyImport';
import { Submission } from '../models/Submission';
import * as gridFsService from './gridFsService';
import { getLevelStandards, normalizeLevel } from '../data/levelStandards';

export interface ContractItem {
  sectionId: string;
  std?: string;
  spec?: string;
  where: string; // 'narrative 4.a' | 'evidenceText 4.a' | 'intro document' | 'tag'
}

export interface ContractResult {
  ok: boolean;
  importId: string;
  submissionId: string;
  programLevel: string;
  format: string; // detected/used parser format (template | self_study | mcc_narrative)
  anchors: {
    ok: boolean;
    totalItems: number;
    anchored: number;
    missing: ContractItem[]; // items whose sectionId is NOT in the source HTML
  };
  coverage: {
    specsWithContent: number;
    byStandard: Record<string, string[]>; // std -> [spec letters with content]
    unplacedTags: number;
    catalogSpecs: number; // specs in the level catalog
  };
  fileTypes: {
    evidenceFiles: number;
    evidenceText: number;
    cvs: number;
    evidenceDocs: number;
    matrices: number;
    docSubKinds: Record<string, number>; // paper/syllabus/etc. across evidenceDocs
  };
  loss: {
    perSpecChars: Record<string, number>; // 'std.spec' -> narrative char count
  };
  findings: Array<{ severity: 'critical' | 'warn' | 'info'; check: string; detail: string }>;
}

function collectItems(rs: any): ContractItem[] {
  const items: ContractItem[] = [];
  const buckets = rs.buckets || {};
  for (const key of Object.keys(buckets)) {
    const [std, spec] = key.split('.');
    const b = buckets[key] || {};
    for (const kind of ['narratives', 'evidenceText', 'evidenceFiles']) {
      for (const it of b[kind] || []) {
        if (it?.sectionId) items.push({ sectionId: it.sectionId, std, spec, where: `${kind} ${key}` });
      }
    }
  }
  const intro = rs.introductions || {};
  for (const k of Object.keys(intro)) {
    for (const it of intro[k]?.items || []) {
      if (it?.sectionId) items.push({ sectionId: it.sectionId, where: `intro ${k}` });
    }
  }
  for (const it of rs.tags || []) {
    if (it?.sectionId) items.push({ sectionId: it.sectionId, where: 'tag' });
  }
  return items;
}

export async function checkParserContract(importId: string): Promise<ContractResult> {
  const imp: any = await SelfStudyImport.findById(importId).select('submissionId aiFormat').lean();
  if (!imp) throw new Error('import not found');
  const sub: any = await Submission.findById(imp.submissionId).select('aiReviewState programLevel').lean();
  const rs: any = sub?.aiReviewState || {};
  const programLevel = String(sub?.programLevel || '');

  // --- source HTML + its anchors ---
  let html = '';
  try {
    html = await gridFsService.getHtmlContent(String(importId));
  } catch {
    html = '';
  }
  const anchorIds = new Set<string>([...html.matchAll(/data-section-id="([^"]+)"/g)].map((m) => m[1]));

  // --- items + anchor check ---
  const items = collectItems(rs);
  const missing = items.filter((it) => !anchorIds.has(it.sectionId));
  const anchorsOk = missing.length === 0;

  // --- coverage ---
  const buckets = rs.buckets || {};
  const byStandard: Record<string, string[]> = {};
  let specsWithContent = 0;
  for (const key of Object.keys(buckets)) {
    const b = buckets[key] || {};
    const hasContent = (b.narratives || []).length > 0 || (b.evidenceText || []).length > 0;
    if (hasContent) {
      specsWithContent++;
      const [std, spec] = key.split('.');
      (byStandard[std] = byStandard[std] || []).push(spec);
    }
  }
  for (const std of Object.keys(byStandard)) byStandard[std].sort();
  const levelStds = getLevelStandards(programLevel) || [];
  const catalogSpecs = levelStds.reduce((n, s: any) => n + (s.specifications?.length || 0), 0);

  // --- file types ---
  const evidenceDocs = rs.evidenceDocs || [];
  const docSubKinds: Record<string, number> = {};
  for (const d of evidenceDocs) {
    const k = String(d.docSubKind || 'unknown');
    docSubKinds[k] = (docSubKinds[k] || 0) + 1;
  }
  let evFiles = 0;
  let evText = 0;
  const perSpecChars: Record<string, number> = {};
  for (const key of Object.keys(buckets)) {
    const b = buckets[key] || {};
    evFiles += (b.evidenceFiles || []).length;
    evText += (b.evidenceText || []).length;
    const chars = (b.narratives || []).reduce(
      (n: number, it: any) => n + String(it.snippet || it.htmlSnippet || '').replace(/<[^>]+>/g, '').length,
      0
    );
    if (chars > 0) perSpecChars[key] = chars;
  }

  // --- findings ---
  const findings: ContractResult['findings'] = [];
  if (!anchorsOk) {
    findings.push({
      severity: 'critical',
      check: 'anchors',
      detail: `${missing.length}/${items.length} items have no data-section-id anchor → Compare would show "section not located". Missing: ${missing.slice(0, 6).map((m) => `${m.where}:${m.sectionId}`).join(', ')}${missing.length > 6 ? ' …' : ''}`,
    });
  }
  const unplacedTags = (rs.tags || []).length;
  if (unplacedTags > 0) {
    findings.push({ severity: 'info', check: 'coverage', detail: `${unplacedTags} Unplaced tag(s) — content the matcher did not route to a spec.` });
  }
  for (const key of Object.keys(buckets)) {
    const b = buckets[key] || {};
    if ((b.narratives || []).length === 0 && ((b.evidenceText || []).length > 0 || (b.evidenceFiles || []).length > 0)) {
      findings.push({ severity: 'info', check: 'kind', detail: `${key} has evidence but no narrative response.` });
    }
  }

  return {
    ok: anchorsOk, // the enforced gate; other checks are measured/reported
    importId: String(importId),
    submissionId: String(imp.submissionId),
    programLevel: normalizeLevel(programLevel),
    format: String(imp.aiFormat?.format || (typeof imp.aiFormat === 'string' ? imp.aiFormat : '') || ''),
    anchors: { ok: anchorsOk, totalItems: items.length, anchored: items.length - missing.length, missing },
    coverage: { specsWithContent, byStandard, unplacedTags, catalogSpecs },
    fileTypes: { evidenceFiles: evFiles, evidenceText: evText, cvs: (rs.cvs || []).length, evidenceDocs: evidenceDocs.length, matrices: (rs.matrices || []).length, docSubKinds },
    loss: { perSpecChars },
    findings,
  };
}
