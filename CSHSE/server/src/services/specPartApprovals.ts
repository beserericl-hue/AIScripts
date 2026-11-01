/**
 * Numbered parts of a specification (4.a.1, 4.a.2 …) must each be approved by
 * the program coordinator — in the Review rail or the Self-Study Editor, which
 * share this one record — before the specification counts as complete.
 *
 * Stored on `Submission.specPartApprovals` as
 *   { "<std>_<spec>": { "<n>": { approvedBy, approvedAt } } }
 * (keys use "_" like standardsStatus — Mongo field names can't hold dots).
 * Only specifications listed in `data/specParts.json` have parts.
 */
import { getSpecParts, SpecPart } from '../data/levelStandards';

export interface PartApproval {
  approvedBy?: string;
  approvedAt?: Date;
}
export type SpecPartApprovals = Record<string, Record<string, PartApproval>>;

export function partApprovalsOf(submission: any): SpecPartApprovals {
  const raw = submission?.specPartApprovals;
  return raw && typeof raw === 'object' ? (raw as SpecPartApprovals) : {};
}

/** Parts of a spec that have not been approved yet (empty when the spec has none). */
export function unapprovedParts(submission: any, standardCode: string, specCode: string): SpecPart[] {
  const parts = getSpecParts(submission?.programLevel, standardCode, specCode);
  if (!parts.length) return [];
  const done = partApprovalsOf(submission)[`${standardCode}_${specCode}`] || {};
  return parts.filter((p) => !done[String(p.n)]);
}
