import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, Download, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-020 / Sprint 7.3 — Admin audit-trail UI.
//
// Read-only table over the AuditLogEntry collection.  Filter by action /
// submissionId / date range. CSV export.
//
// Append-only is a server-side invariant; the UI surfaces no edit
// affordances at all.
// ---------------------------------------------------------------------------

export interface AuditEntry {
  _id: string;
  action: string;
  actorName: string;
  actorRole: string;
  targetType: string;
  targetId: string;
  submissionId?: string;
  reason?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

export interface AuditTrailFilter {
  action?: string;
  submissionId?: string;
  since?: string;
  until?: string;
}

export interface AuditTrailViewProps {
  entries: AuditEntry[];
  total: number;
  isLoading: boolean;
  error?: string | null;
  filter: AuditTrailFilter;
  onChangeFilter: (patch: Partial<AuditTrailFilter>) => void;
  onRefresh: () => void;
  onExport: () => void;
  exporting?: boolean;
}

export function AuditTrailView({
  entries,
  total,
  isLoading,
  error,
  filter,
  onChangeFilter,
  onRefresh,
  onExport,
  exporting,
}: AuditTrailViewProps): JSX.Element {
  return (
    <div data-testid="audit-trail" className="mx-auto max-w-6xl p-6">
      <header className="mb-3 border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Audit trail</h1>
        <p className="text-sm text-slate-600">
          Append-only log of every governance-relevant action — locks, submissions, score changes, board decisions, comment relays, and more.
        </p>
      </header>

      <div data-testid="audit-filters" className="mb-3 grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs text-slate-700">
          Action (single or comma-list)
          <input
            data-testid="audit-filter-action"
            value={filter.action || ''}
            onChange={(e) => onChangeFilter({ action: e.target.value })}
            placeholder="e.g. board.decision_recorded"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>
        <label className="text-xs text-slate-700">
          Submission ID
          <input
            data-testid="audit-filter-submission"
            value={filter.submissionId || ''}
            onChange={(e) => onChangeFilter({ submissionId: e.target.value })}
            placeholder="ObjectId"
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>
        <label className="text-xs text-slate-700">
          Since
          <input
            type="date"
            data-testid="audit-filter-since"
            value={filter.since || ''}
            onChange={(e) => onChangeFilter({ since: e.target.value })}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>
        <label className="text-xs text-slate-700">
          Until
          <input
            type="date"
            data-testid="audit-filter-until"
            value={filter.until || ''}
            onChange={(e) => onChangeFilter({ until: e.target.value })}
            className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            data-testid="audit-refresh"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            <span>Refresh</span>
          </button>
          <button
            type="button"
            data-testid="audit-export-csv"
            onClick={onExport}
            disabled={exporting}
            className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            <span>CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div data-testid="audit-error" className="mb-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
          {error}
        </div>
      )}

      <div data-testid="audit-count" className="mb-2 text-xs text-slate-600">
        Showing {entries.length} of {total} entries.
      </div>

      <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-2 py-1 text-left">When</th>
              <th className="px-2 py-1 text-left">Action</th>
              <th className="px-2 py-1 text-left">Actor</th>
              <th className="px-2 py-1 text-left">Target</th>
              <th className="px-2 py-1 text-left">Reason / Payload</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.length === 0 ? (
              <tr data-testid="audit-empty">
                <td colSpan={5} className="px-2 py-6 text-center text-slate-500">
                  No audit entries match the current filters.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e._id} data-testid={`audit-row-${e._id}`} className="align-top">
                  <td className="whitespace-nowrap px-2 py-1 font-mono text-[10px] text-slate-700">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-2 py-1 font-mono text-slate-800">{e.action}</td>
                  <td className="px-2 py-1 text-slate-700">
                    {e.actorName}
                    <span className="ml-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600">{e.actorRole}</span>
                  </td>
                  <td className="px-2 py-1 text-slate-700">
                    <div className="font-mono text-[10px]">{e.targetType}</div>
                    <div className="font-mono text-[10px] text-slate-500">{e.targetId}</div>
                    {e.submissionId && (
                      <div className="font-mono text-[10px] text-slate-500">sub: {e.submissionId}</div>
                    )}
                  </td>
                  <td className="px-2 py-1 text-slate-700">
                    {e.reason && <div className="italic text-slate-700">{e.reason}</div>}
                    {e.payload && (
                      <pre className="mt-0.5 max-w-xs overflow-x-auto rounded bg-slate-50 p-1 text-[10px] text-slate-700">
                        {JSON.stringify(e.payload, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AuditTrail(): JSX.Element {
  const [filter, setFilter] = React.useState<AuditTrailFilter>({});
  const [exporting, setExporting] = React.useState(false);

  const query = useQuery({
    queryKey: ['audit-log', filter],
    queryFn: async () => {
      const r = await api.get('/api/admin/audit-log', {
        params: {
          action: filter.action || undefined,
          submissionId: filter.submissionId || undefined,
          since: filter.since || undefined,
          until: filter.until || undefined,
          limit: 200
        }
      });
      return r.data as { entries: AuditEntry[]; total: number };
    },
    refetchOnWindowFocus: false,
  });

  const onExport = async () => {
    setExporting(true);
    try {
      const r = await api.get('/api/admin/audit-log/export.csv', {
        params: {
          action: filter.action || undefined,
          submissionId: filter.submissionId || undefined,
          since: filter.since || undefined,
          until: filter.until || undefined,
          limit: 10000
        },
        responseType: 'blob'
      });
      const blob = r.data instanceof Blob ? r.data : new Blob([r.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Audit CSV export failed', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AuditTrailView
      entries={query.data?.entries || []}
      total={query.data?.total || 0}
      isLoading={query.isLoading}
      error={query.error ? (query.error as Error).message : null}
      filter={filter}
      onChangeFilter={(patch) => setFilter((prev) => ({ ...prev, ...patch }))}
      onRefresh={() => query.refetch()}
      onExport={onExport}
      exporting={exporting}
    />
  );
}
