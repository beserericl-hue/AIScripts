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
  /** 'review' = set because the part's draft was approved in Review (cleared again
   *  when no approved draft for the part remains). Absent = ticked by hand. */
  via?: 'review';
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

/**
 * Keep part approvals in step with Review: approving a draft that belongs to a
 * numbered part (it carries `partN`, from specPartSplit) approves that part;
 * when no approved draft for the part remains, an approval that Review set is
 * withdrawn. A part ticked by hand (no `via`) is never touched.
 *
 * Mutates `submission.specPartApprovals` in place and returns true when it
 * changed. Only parts in the level catalog are considered.
 */
export function syncPartApprovalsFromReview(submission: any, userId?: string): boolean {
  const state = submission?.aiReviewState;
  const buckets = state?.buckets || {};
  const approved = new Set<string>(state?.approvedIds || []);
  const want = new Map<string, Set<number>>(); // "std_spec" -> parts with an approved draft
  const seen = new Set<string>(); // "std_spec" with any part-tagged draft
  for (const bucket of Object.values(buckets) as any[]) {
    const std = bucket?.standardCode, spec = bucket?.specCode;
    if (!std || !spec) continue;
    const key = `${std}_${String(spec).toLowerCase()}`;
    for (const it of bucket.narratives || []) {
      if (typeof it?.partN !== 'number') continue;
      seen.add(key);
      if (approved.has(it.sectionId)) {
        if (!want.has(key)) want.set(key, new Set());
        want.get(key)!.add(it.partN);
      }
    }
  }
  const all: SpecPartApprovals = JSON.parse(JSON.stringify(partApprovalsOf(submission)));
  let changed = false;
  for (const key of seen) {
    const [std, spec] = key.split('_');
    const valid = new Set(getSpecParts(submission?.programLevel, std, spec).map((p) => p.n));
    const forSpec = all[key] || {};
    for (const n of want.get(key) || []) {
      if (!valid.has(n) || forSpec[String(n)]) continue;
      forSpec[String(n)] = { approvedBy: userId ? String(userId) : undefined, approvedAt: new Date(), via: 'review' };
      changed = true;
    }
    for (const [n, a] of Object.entries(forSpec)) {
      if (a?.via === 'review' && !(want.get(key)?.has(Number(n)))) {
        delete forSpec[n];
        changed = true;
      }
    }
    all[key] = forSpec;
  }
  if (changed) {
    submission.specPartApprovals = all;
    if (typeof submission.markModified === 'function') submission.markModified('specPartApprovals');
  }
  return changed;
}
