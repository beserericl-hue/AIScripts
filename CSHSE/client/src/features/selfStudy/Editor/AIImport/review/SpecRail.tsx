/**
 * SpecRail — left column of the Review step.
 *
 * Lists every spec for the current program level (UI spec §6.3), with
 * a checkmark + count when items have been auto-placed, a coverage
 * badge (🟢/🟡/🔴) once the second-pass review has set scores, and
 * two synthetic buckets at the bottom:
 *   - "Unplaced": items the matcher couldn't assign to any spec
 *   - "Unwritten": placeholder template sections (template format only)
 */
import React, { useMemo, useState } from 'react';
import { Search, AlertTriangle, FileText, Grid3x3 } from 'lucide-react';
import type {
  SpecBucket,
  PlaceholderSection,
  Tag,
  MatrixData
} from '../../../../../store/aiImportStore';

export const UNPLACED_KEY = '_unplaced';
export const UNWRITTEN_KEY = '_unwritten';
export const MATRICES_KEY = '_matrices';

interface SpecRailProps {
  buckets: Record<string, SpecBucket>;
  tags: Tag[];
  placeholders: PlaceholderSection[];
  matrices: MatrixData[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

function coverageIcon(b: SpecBucket): string {
  if (b.coverageCovered === true) return '🟢';
  if (b.coverageScore !== null && b.coverageScore >= 0.5) return '🟡';
  if (b.narratives.length || b.evidenceText.length || b.evidenceFiles.length) return '🔴';
  return '';
}

function bucketCount(b: SpecBucket): number {
  const mc = (b as any).matrixCells?.length || 0;
  return b.narratives.length + b.evidenceText.length + b.evidenceFiles.length + mc;
}

export function SpecRail({ buckets, tags, placeholders, matrices, selectedKey, onSelect }: SpecRailProps): JSX.Element {
  const [filter, setFilter] = useState('');

  // Group buckets by standard for the rail's accordion structure.
  const byStandard = useMemo(() => {
    const map = new Map<string, SpecBucket[]>();
    for (const b of Object.values(buckets)) {
      if (!map.has(b.standardCode)) map.set(b.standardCode, []);
      map.get(b.standardCode)!.push(b);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.specCode.localeCompare(b.specCode));
    }
    return [...map.entries()].sort(
      ([a], [b]) => (parseInt(a, 10) || 99) - (parseInt(b, 10) || 99)
    );
  }, [buckets]);

  const filterMatches = (text: string): boolean => {
    if (!filter) return true;
    return text.toLowerCase().includes(filter.toLowerCase());
  };

  // Synthetic "Unplaced" items come from tags whose suggestedStd is null
  // (matcher couldn't classify them). Tags with confidence below 0.50
  // are also tag-list-only — those show on the Apply screen, not here.
  const unplaced = tags.filter((t) => !t.suggestedStd || !t.suggestedSpec);

  return (
    <aside
      className="flex h-full w-72 flex-col border-r border-gray-200 bg-gray-50"
      aria-label="Specifications"
    >
      <div className="border-b border-gray-200 p-3">
        <label className="relative block">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter specs…"
            aria-label="Filter specifications"
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-cshse-500 focus:outline-none focus:ring-1 focus:ring-cshse-500"
          />
        </label>
      </div>

      <nav role="tablist" aria-orientation="vertical" className="flex-1 overflow-auto p-2 text-sm">
        {matrices.length > 0 && (
          <div className="mb-3 border-b border-gray-200 pb-3">
            <button
              role="tab"
              aria-selected={selectedKey === MATRICES_KEY}
              onClick={() => onSelect(MATRICES_KEY)}
              title={`${matrices.length} curriculum matrix(es): ${matrices.map((m) => m.name).join(', ')}`}
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                selectedKey === MATRICES_KEY
                  ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Grid3x3 className="h-3.5 w-3.5 text-cshse-700" aria-hidden />
                <span className="font-medium">Matrices</span>
              </span>
              <span className="rounded bg-cshse-200 px-1.5 text-xs text-cshse-800">
                {matrices.length}
              </span>
            </button>
          </div>
        )}
        {byStandard.map(([std, list]) => {
          const visible = list.filter((b) =>
            filterMatches(`${std}.${b.specCode} ${b.standardTitle} ${b.specPrompt}`)
          );
          if (visible.length === 0) return null;
          return (
            <div key={std} className="mb-2">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Standard {std}
              </div>
              <ul>
                {visible.map((b) => {
                  const key = `${b.standardCode}.${b.specCode}`;
                  const count = bucketCount(b);
                  const icon = coverageIcon(b);
                  const isActive = selectedKey === key;
                  // Truncated titles in the rail; native title attribute provides
                  // a hover tooltip showing the full standard title + spec prompt.
                  const fullTitle = b.specPrompt
                    ? `${b.standardCode}.${b.specCode} — ${b.standardTitle}\n\n${b.specPrompt}`
                    : `${b.standardCode}.${b.specCode} — ${b.standardTitle}`;
                  return (
                    <li key={key}>
                      <button
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => onSelect(key)}
                        title={fullTitle}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left ${
                          isActive
                            ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                            : 'hover:bg-gray-100 text-gray-700'
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="font-mono text-xs">{b.standardCode}.{b.specCode}</span>
                          <span className="truncate text-xs text-gray-500">{b.standardTitle}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          {count > 0 && (
                            <span className="rounded bg-cshse-200 px-1.5 text-cshse-800">{count}</span>
                          )}
                          {icon && <span aria-hidden>{icon}</span>}
                          <span className="sr-only">
                            {b.coverageCovered === true
                              ? 'covered'
                              : b.coverageScore !== null && b.coverageScore >= 0.5
                              ? 'partial coverage'
                              : count > 0
                              ? 'gaps remain'
                              : ''}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div className="mt-4 border-t border-gray-200 pt-3">
          <button
            role="tab"
            aria-selected={selectedKey === UNPLACED_KEY}
            onClick={() => onSelect(UNPLACED_KEY)}
            className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
              selectedKey === UNPLACED_KEY
                ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              <span>Unplaced</span>
            </span>
            <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-700">{unplaced.length}</span>
          </button>

          {placeholders.length > 0 && (
            <button
              role="tab"
              aria-selected={selectedKey === UNWRITTEN_KEY}
              onClick={() => onSelect(UNWRITTEN_KEY)}
              className={`mt-1 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm ${
                selectedKey === UNWRITTEN_KEY
                  ? 'bg-cshse-100 text-cshse-800 ring-1 ring-cshse-500'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-gray-500" aria-hidden />
                <span>Unwritten</span>
              </span>
              <span className="rounded bg-gray-200 px-1.5 text-xs text-gray-700">{placeholders.length}</span>
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
}
