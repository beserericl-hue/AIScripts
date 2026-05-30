import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import { Loader2, FileText, ChevronRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// S3.1 — Reader dashboard.
// Lists submissions a reader is allowed to see (the server's CR-007 access
// gating restricts readers to status ∈ submitted/under_review/
// readers_assigned/review_complete/compliant/non_compliant — drafts are
// PC-only). Submissions are grouped by status with the reader's per-spec
// progress summary so they can jump straight to "what's next to review."
// ---------------------------------------------------------------------------

export interface ReaderDashboardSubmission {
  _id: string;
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: string;
  createdAt: string;
}

export interface ReaderDashboardViewProps {
  submissions: ReaderDashboardSubmission[];
  isLoading: boolean;
  error?: string | null;
}

// Status → human label + neutral colour. We deliberately avoid leaking
// reviewer judgement (no "ready" / "needs work" framing); statuses describe
// where the submission is in the workflow, not the quality.
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'Submitted — awaiting assignment', cls: 'bg-slate-100 text-slate-800' },
  readers_assigned: { label: 'Assigned for review', cls: 'bg-blue-100 text-blue-800' },
  under_review: { label: 'Under review', cls: 'bg-indigo-100 text-indigo-800' },
  review_complete: { label: 'Review complete', cls: 'bg-emerald-100 text-emerald-800' },
  compliant: { label: 'Compliant', cls: 'bg-green-100 text-green-800' },
  non_compliant: { label: 'Non-compliant', cls: 'bg-red-100 text-red-800' },
};

function statusMeta(status: string) {
  return STATUS_LABEL[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
}

export function ReaderDashboardView({
  submissions,
  isLoading,
  error,
}: ReaderDashboardViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="reader-dashboard-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading your review queue…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="reader-dashboard-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load submissions: {error}
      </div>
    );
  }
  if (!submissions.length) {
    return (
      <div data-testid="reader-dashboard-empty" className="m-6 rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        <FileText className="mx-auto mb-2 h-6 w-6 text-slate-400" />
        Nothing assigned to you yet. When a self-study lands here, it will appear in this list.
      </div>
    );
  }
  return (
    <div data-testid="reader-dashboard" className="mx-auto max-w-5xl p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Review queue</h1>
        <span className="text-xs text-slate-500">{submissions.length} submission{submissions.length === 1 ? '' : 's'}</span>
      </header>
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        {submissions.map((sub) => {
          const meta = statusMeta(sub.status);
          return (
            <li key={sub._id}>
              <Link
                data-testid={`reader-submission-${sub._id}`}
                to={`/reader/${sub._id}`}
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

export function ReaderDashboard(): JSX.Element {
  // CR-007 — server already restricts readers to status ≥ submitted.
  // Listing without filters returns the right set; we still ask the
  // server for the full set so a reader can see review_complete +
  // compliant/non_compliant for context.
  const query = useQuery({
    queryKey: ['reader-dashboard-submissions'],
    queryFn: async () => {
      const r = await api.get('/api/submissions', { params: { limit: 50 } });
      return (r.data?.submissions || []) as ReaderDashboardSubmission[];
    },
    refetchOnWindowFocus: false,
  });

  return (
    <ReaderDashboardView
      submissions={query.data || []}
      isLoading={query.isLoading}
      error={query.error ? (query.error as Error).message : null}
    />
  );
}
