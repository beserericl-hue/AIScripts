import { ReaderReport } from '../models/ReaderReport';
import { User } from '../models/User';

export interface ReaderConsensus {
  totalReaders: number;
  completedReaders: number;
  readers: Array<{ name: string; completed: boolean; nonCompliantStandards: string[] }>;
  standards: Array<{
    standardCode: string;
    label: string;
    nonCompliantCount: number;
    readerNames: string[];
    specs: string[];
  }>;
}

/**
 * Per-standard non-compliance consensus across every reader who has evaluated.
 * Uses each reader's OWN mark (the independent reader vote — not the lead
 * reader's override layer). For each numbered standard it counts how many
 * readers marked at least one specification in it non-compliant, and ranks the
 * standards most-flagged first, so the lead reader can see where the readers
 * most agree a program is out of compliance (3 of 3 → 2 of 3 → 1 of 3).
 *
 * This is a working tool for the lead reader to review and address at the site
 * visit — surfaced on the Lead Reader Compilation page, NOT on the board-facing
 * Lead Reader Report.
 *
 * `nameById` seeds reviewer display names (e.g. from active assignments or the
 * compilation's reader list); any reviewer not present is resolved from User.
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

  const readers: Array<{ name: string; completed: boolean; nonCompliantStandards: string[] }> = [];
  const tally = new Map<string, { names: Set<string>; specs: Set<string> }>();
  for (const rep of reports) {
    const rows: any[] = rep.rows || [];
    const hasMarks = rows.some((r) => r.mark === 'compliant' || r.mark === 'noncompliant');
    if (!hasMarks) continue; // a reader only counts once they've evaluated
    const name = nameById.get(String(rep.reviewerId)) || 'Reader';
    const ncStds = new Set<string>();
    for (const r of rows) {
      if (r.mark !== 'noncompliant') continue;
      const std = String(r.standardCode || '');
      if (!/^\d+$/.test(std)) continue; // numbered standards only (not "introduction")
      ncStds.add(std);
      if (!tally.has(std)) tally.set(std, { names: new Set(), specs: new Set() });
      const t = tally.get(std)!;
      t.names.add(name);
      if (r.specCode) t.specs.add(`${std}${r.specCode}`);
    }
    readers.push({
      name,
      completed: !!rep.completedAt,
      nonCompliantStandards: [...ncStds].sort((a, b) => Number(a) - Number(b)),
    });
  }

  const standards = [...tally.entries()]
    .map(([standardCode, t]) => ({
      standardCode,
      label: `Standard ${standardCode}`,
      nonCompliantCount: t.names.size,
      readerNames: [...t.names],
      specs: [...t.specs].sort(),
    }))
    .sort(
      (a, b) =>
        b.nonCompliantCount - a.nonCompliantCount ||
        Number(a.standardCode) - Number(b.standardCode)
    );

  return {
    totalReaders: readers.length,
    completedReaders: readers.filter((r) => r.completed).length,
    readers: readers.sort((a, b) => a.name.localeCompare(b.name)),
    standards,
  };
}
