/**
 * ONE definition of "how far along is this self-study" and "may it be
 * submitted", shared by the PC dashboard (workflow summary), the Final Submit
 * dialog (preflight), the Needs-Improvement list and the submit gate itself.
 *
 * Before this, each surface counted differently: the dashboard walked the
 * level-agnostic flat catalog (83 specs) and counted EVERY standardsStatus row
 * (intro sections included — "98 of 83 · 118%"), while the editor used the
 * level catalog (96 for baccalaureate); the dashboard ignored Needs-Improvement
 * verdicts and unassigned files when deciding "ready", the editor ignored
 * unassigned files. The client editor mirrors `specGate` in
 * client/src/lib/submitReadiness.ts (same rule, same fixture-pinned tests).
 *
 * Rules (match the submit gate since CR-074 + the needs_improvement decision):
 *  - the spec list is the submission's LEVEL catalog (associate / bacc / masters);
 *    only `<std>_<spec>` keys of that catalog count — never intro rows.
 *  - a spec marked Not Applicable (excluded) leaves the denominator.
 *  - a spec is VALIDATED (clears the gate) when its verdict is pass or
 *    needs_improvement (legacy rows: validationStatus 'pass').
 *  - a spec with numbered parts (4.a.1 …) also needs every part approved.
 *  - every live, non-matrix, non-reader-report supporting file must be
 *    assigned to a Standard.
 */
import mongoose from 'mongoose';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { getAllStandards } from '../data/standards';
import { getLevelStandards } from '../data/levelStandards';
import { unapprovedParts } from './specPartApprovals';
import { notCurriculumMatrixFilter } from './curriculumMatrixExclusion';

export type SpecState = 'pass' | 'needs_improvement' | 'fail' | 'not_evaluated' | 'excluded';

export interface SpecGateRow {
  standardCode: string;
  specCode: string;
  state: SpecState;
  openParts: number[];
}

export interface SpecGate {
  /** specs in the level catalog that still apply (Not Applicable removed) */
  total: number;
  /** every spec in the level catalog */
  catalogTotal: number;
  excluded: number;
  passed: number;
  needsImprovement: number;
  /** passed + needsImprovement — cleared the AI gate. Never exceeds total. */
  validated: number;
  failed: number;
  notEvaluated: number;
  /** specs with any AI verdict (pass / needs improvement / fail) */
  evaluated: number;
  /** specs whose numbered parts are not all approved */
  partsOpen: number;
  /** every applicable spec validated and every part approved */
  specsReady: boolean;
  rows: SpecGateRow[];
}

function statusOf(submission: any, key: string): any {
  const raw = submission?.standardsStatus;
  if (!raw) return undefined;
  return raw instanceof Map ? raw.get(key) : raw[key];
}

export function specStateOf(status: any): SpecState {
  if (status?.excluded === true) return 'excluded';
  const v = status?.verdict;
  if (v === 'pass' || v === 'needs_improvement' || v === 'fail') return v;
  // Legacy rows carry only the binary validationStatus.
  if (status?.validationStatus === 'pass') return 'pass';
  if (status?.validationStatus === 'fail') return 'fail';
  return 'not_evaluated';
}

export function catalogFor(programLevel: string | null | undefined) {
  return getLevelStandards(programLevel) || getAllStandards();
}

export function computeSpecGate(submission: any): SpecGate {
  const rows: SpecGateRow[] = [];
  for (const standard of catalogFor(submission?.programLevel)) {
    for (const spec of standard.specifications || []) {
      const state = specStateOf(statusOf(submission, `${standard.code}_${spec.code}`));
      const openParts =
        state === 'excluded' ? [] : unapprovedParts(submission, standard.code, spec.code).map((p: any) => p.n);
      rows.push({ standardCode: String(standard.code), specCode: String(spec.code), state, openParts });
    }
  }
  const n = (s: SpecState) => rows.filter((r) => r.state === s).length;
  const excluded = n('excluded');
  const passed = n('pass');
  const needsImprovement = n('needs_improvement');
  const failed = n('fail');
  const notEvaluated = n('not_evaluated');
  const total = rows.length - excluded;
  const partsOpen = rows.filter((r) => r.openParts.length > 0).length;
  const validated = passed + needsImprovement;
  return {
    total,
    catalogTotal: rows.length,
    excluded,
    passed,
    needsImprovement,
    validated,
    failed,
    notEvaluated,
    evaluated: passed + needsImprovement + failed,
    partsOpen,
    specsReady: rows.length > 0 && validated === total && partsOpen === 0,
    rows,
  };
}

/**
 * CR-074 — supporting files that would be stranded by submit: live (not
 * deleted), not filed under a Standard, not a system-generated reader report,
 * not a curriculum matrix (those are deliberately unassigned).
 */
export function unassignedEvidenceFilter(submissionId: string) {
  return {
    submissionId: new mongoose.Types.ObjectId(submissionId),
    isDeleted: { $ne: true },
    $or: [{ standardCode: { $exists: false } }, { standardCode: null }, { standardCode: '' }],
    tags: { $not: { $elemMatch: { $regex: /^reader-report/ } } },
    ...notCurriculumMatrixFilter(),
  };
}

export async function findUnassignedEvidence(submissionId: string) {
  return SupportingEvidence.find(unassignedEvidenceFilter(submissionId))
    .select('_id file.originalName title')
    .lean();
}

export async function countUnassignedEvidence(submissionId: string): Promise<number> {
  return SupportingEvidence.countDocuments(unassignedEvidenceFilter(submissionId));
}

export interface SubmitReadiness extends SpecGate {
  unassignedFiles: number;
  ready: boolean;
}

export async function computeSubmitReadiness(submission: any): Promise<SubmitReadiness> {
  const gate = computeSpecGate(submission);
  const unassignedFiles = await countUnassignedEvidence(String(submission._id));
  return { ...gate, unassignedFiles, ready: gate.specsReady && unassignedFiles === 0 };
}
