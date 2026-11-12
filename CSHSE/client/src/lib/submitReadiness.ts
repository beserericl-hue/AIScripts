// Client mirror of server/src/services/submitReadiness.ts `computeSpecGate` —
// the ONE rule for "X of Y validated" and "ready to submit", shared with the
// PC dashboard (workflow summary), the Final Submit dialog and the submit gate.
// Keep the two in step: both are pinned by the same fixture in their tests.
//
//  - specs = the submission's level catalog (`standards` from /api/standards);
//    only "<std>_<spec>" status keys count, never intro rows.
//  - Not Applicable (excluded) leaves the denominator.
//  - validated = verdict pass OR needs_improvement (legacy: validationStatus 'pass').
//  - numbered parts must all be approved.

export type SpecState = 'pass' | 'needs_improvement' | 'fail' | 'not_evaluated' | 'excluded';

export function specStateOf(status: any): SpecState {
  if (status?.excluded === true) return 'excluded';
  const v = status?.verdict;
  if (v === 'pass' || v === 'needs_improvement' || v === 'fail') return v;
  if (status?.validationStatus === 'pass') return 'pass';
  if (status?.validationStatus === 'fail') return 'fail';
  return 'not_evaluated';
}

export interface SpecGate {
  total: number;
  excluded: number;
  passed: number;
  needsImprovement: number;
  validated: number;
  failed: number;
  notEvaluated: number;
  evaluated: number;
  partsOpen: number;
  specsReady: boolean;
}

export function computeSpecGate(
  standards: Array<{ code: string; specifications?: Array<{ code: string }> }> | undefined | null,
  standardsStatus: Record<string, any> | undefined | null,
  openPartsOf: (std: string, spec: string) => number = () => 0
): SpecGate {
  let rows = 0, excluded = 0, passed = 0, ni = 0, failed = 0, notEvaluated = 0, partsOpen = 0;
  for (const std of standards || []) {
    for (const spec of std.specifications || []) {
      rows++;
      const state = specStateOf(standardsStatus?.[`${std.code}_${spec.code}`]);
      if (state === 'excluded') { excluded++; continue; }
      if (state === 'pass') passed++;
      else if (state === 'needs_improvement') ni++;
      else if (state === 'fail') failed++;
      else notEvaluated++;
      if (openPartsOf(std.code, spec.code) > 0) partsOpen++;
    }
  }
  const total = rows - excluded;
  const validated = passed + ni;
  return {
    total, excluded, passed, needsImprovement: ni, validated, failed, notEvaluated,
    evaluated: passed + ni + failed, partsOpen,
    specsReady: rows > 0 && validated === total && partsOpen === 0,
  };
}

/** Plain-language reasons a self-study is not ready (empty when ready). */
export function notReadyReasons(g: Pick<SpecGate, 'total' | 'validated' | 'partsOpen'>, unassignedFiles: number): string[] {
  const out: string[] = [];
  const left = Math.max(0, g.total - g.validated);
  if (left) out.push(`${left} specification${left === 1 ? '' : 's'} still to validate`);
  if (g.partsOpen) out.push(`${g.partsOpen} with numbered parts to approve`);
  if (unassignedFiles) out.push(`${unassignedFiles} file${unassignedFiles === 1 ? '' : 's'} not assigned to a Standard`);
  return out;
}
