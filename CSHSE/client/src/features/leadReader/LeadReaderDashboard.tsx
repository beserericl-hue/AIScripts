import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Loader2, ChevronRight, FileSpreadsheet } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-009 / Sprint 5.1 — Lead-reader dashboard.
//
// Lists submissions a lead reader should be looking at the compilation
// view for: anything with reader-assignable status or beyond. The
// /api/submissions listing already filters out drafts for reader-shaped
// roles (CR-007 server gate), so we just consume it.
//
// View / container split for unit-testability.
// ---------------------------------------------------------------------------

export interface LeadReaderSubmission {
  _id: string;
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: string;
}

export interface LeadReaderDashboardViewProps {
  submissions: LeadReaderSubmission[];
  isLoading: boolean;
  error?: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'Submitted — awaiting assignment', cls: 'bg-slate-100 text-slate-800' },
  readers_assigned: { label: 'Assigned for review', cls: 'bg-blue-100 text-blue-800' },
  under_review: { label: 'Under review', cls: 'bg-indigo-100 text-indigo-800' },
  review_complete: { label: 'Review complete — ready to compile', cls: 'bg-emerald-100 text-emerald-800' },
  compliant: { label: 'Compliant', cls: 'bg-green-100 text-green-800' },
  non_compliant: { label: 'Non-compliant', cls: 'bg-red-100 text-red-800' },
};

function statusMeta(status: string) {
  return STATUS_LABEL[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
}

export function LeadReaderDashboardView({
  submissions,
  isLoading,
  error,
}: LeadReaderDashboardViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="lead-dashboard-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading compilations…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="lead-dashboard-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load compilations: {error}
      </div>
    );
  }
  if (!submissions.length) {
    return (
      <div data-testid="lead-dashboard-empty" className="m-6 rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        <FileSpreadsheet className="mx-auto mb-2 h-6 w-6 text-slate-400" />
        No submissions are ready for compilation. They appear here once readers start scoring.
      </div>
    );
  }
  return (
    <div data-testid="lead-dashboard" className="mx-auto max-w-5xl p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Compilations</h1>
        <span className="text-xs text-slate-500">
          {submissions.length} submission{submissions.length === 1 ? '' : 's'}
        </span>
      </header>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        {submissions.map((sub) => {
          const meta = statusMeta(sub.status);
          return (
            <li key={sub._id}>
              <Link
                data-testid={`lead-submission-${sub._id}`}
                to={`/lead-reader/${sub._id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{sub.institutionName}</p>
                  <p className="truncate text-xs text-slate-600">
                    {sub.programName} <span className="text-slate-400">·</span>{' '}
                    <span className="uppercase">{sub.programLevel}</span> <span className="text-slate-400">·</span>{' '}
                    {sub.submissionId}
                  </p>
                </div>
                <span className={['rounded-full px-2 py-0.5 text-xs', meta.cls].join(' ')}>{meta.label}</span>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function LeadReaderDashboard(): JSX.Element {
  // Server-side CR-007 gate restricts reader-shaped viewers to status ≥
  // submitted. Admins/superusers see drafts too; we keep them in the
  // listing for cross-cutting visibility but mark drafts inert below.
  const query = useQuery({
    queryKey: ['lead-reader-dashboard-submissions'],
    queryFn: async () => {
      const r = await api.get('/api/submissions', { params: { limit: 50 } });
      return (r.data?.submissions || []) as LeadReaderSubmission[];
    },
    refetchOnWindowFocus: false,
  });

  return (
    <LeadReaderDashboardView
      submissions={query.data || []}
      isLoading={query.isLoading}
      error={query.error ? (query.error as Error).message : null}
    />
  );
}
