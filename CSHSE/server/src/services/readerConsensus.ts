import { ReaderReport } from '../models/ReaderReport';
import { User } from '../models/User';

export interface ConsensusStandard {
  standardCode: string;
  label: string;
  /** 'noncompliant' if any reader flagged it, else 'compliant' (all who marked it agreed it's fine). */
  verdict: 'noncompliant' | 'compliant';
  nonCompliantCount: number;
  compliantCount: number;
  /** Readers who marked ≥1 specification in this standard non-compliant (agreed it's a problem). */
  nonCompliantReaders: string[];
  /** Readers who marked this standard and found no non-compliance (disagreed it's a problem). */
  compliantReaders: string[];
  /** The specifications anyone flagged non-compliant, e.g. ["11d"]. */
  specs: string[];
}

export interface ReaderConsensus {
  totalReaders: number;
  completedReaders: number;
  readers: Array<{ name: string; completed: boolean }>;
  standards: ConsensusStandard[];
}

/**
 * Site-Visit Review consensus — per numbered standard, which readers marked it
 * non-compliant (agreed it's a problem) and which marked it compliant
 * (disagreed), using each reader's OWN ReaderReport marks (not the lead's
 * override layer). Standards any reader flagged come first, ranked by how many
 * flagged them (3 of 3 → 2 of 3 → 1 of 3); fully-agreed-compliant standards
 * follow. A reader "counts" once they've set ≥1 mark. Only numbered standards
 * (not "introduction").
 *
 * `nameById` seeds reviewer display names; any reviewer not present is resolved
 * from User.
 */
export async function buildReaderConsensus(
  submissionId: any,
  nameById: Map<string, string>
): Promise<ReaderConsensus> {
  const reports: any[] = await ReaderReport.find({ submissionId })
    .select('reviewerId rows completedAt')
    .lean();

  const missing = reports
    .map((r) => String(r.reviewerId))
    .filter((id) => id && !nameById.has(id));
  if (missing.length) {
    const users: any[] = await User.find({ _id: { $in: missing } })
      .select('firstName lastName')
      .lean();
    for (const u of users) {
      nameById.set(String(u._id), `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Reader');
    }
  }

  const readers: Array<{ name: string; completed: boolean }> = [];
  // standardCode -> { nc:Set<name>, c:Set<name>, specs:Set<string> }
  const agg = new Map<string, { nc: Set<string>; c: Set<string>; specs: Set<string> }>();
  const ensure = (std: string) => {
    if (!agg.has(std)) agg.set(std, { nc: new Set(), c: new Set(), specs: new Set() });
    return agg.get(std)!;
  };

  for (const rep of reports) {
    const rows: any[] = rep.rows || [];
    const hasMarks = rows.some((r) => r.mark === 'compliant' || r.mark === 'noncompliant');
    if (!hasMarks) continue; // a reader only counts once they've evaluated
    const name = nameById.get(String(rep.reviewerId)) || 'Reader';

    // This reader's per-standard verdict: non-compliant if ANY spec in the
    // standard is non-compliant, else compliant if they marked it at all.
    const perStd = new Map<string, { hasNC: boolean; marked: boolean }>();
    for (const r of rows) {
      const std = String(r.standardCode || '');
      if (!/^\d+$/.test(std)) continue; // numbered standards only
      if (r.mark !== 'compliant' && r.mark !== 'noncompliant') continue;
      const e = perStd.get(std) || { hasNC: false, marked: false };
      e.marked = true;
      if (r.mark === 'noncompliant') {
        e.hasNC = true;
        if (r.specCode) ensure(std).specs.add(`${std}${r.specCode}`);
      }
      perStd.set(std, e);
    }
    for (const [std, e] of perStd) {
      if (!e.marked) continue;
      const a = ensure(std);
      if (e.hasNC) a.nc.add(name);
      else a.c.add(name);
    }
    readers.push({ name, completed: !!rep.completedAt });
  }

  const standards: ConsensusStandard[] = [...agg.entries()]
    .map(([standardCode, a]) => ({
      standardCode,
      label: `Standard ${standardCode}`,
      verdict: (a.nc.size > 0 ? 'noncompliant' : 'compliant') as 'noncompliant' | 'compliant',
      nonCompliantCount: a.nc.size,
      compliantCount: a.c.size,
      nonCompliantReaders: [...a.nc],
      compliantReaders: [...a.c],
      specs: [...a.specs].sort(),
    }))
    .sort(
      (x, y) =>
        y.nonCompliantCount - x.nonCompliantCount ||
        Number(x.standardCode) - Number(y.standardCode)
    );

  return {
    totalReaders: readers.length,
    completedReaders: readers.filter((r) => r.completed).length,
    readers: readers.sort((a, b) => a.name.localeCompare(b.name)),
    standards,
  };
}
