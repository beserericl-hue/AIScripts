import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Inbox, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { RelayConsole } from '../features/admin/RelayConsole/RelayConsole';

// ---------------------------------------------------------------------------
// CR-023 / S11.2 — host page for the (previously orphaned) RelayConsole.
//
// Two modes:
//   - /relay                  → a picker listing the submissions in review the
//                               current user can relay for.
//   - /relay/:submissionId    → the relay queue for one submission.
//
// Access: admin / superuser / lead_reader — mirrors the server relay role
// gate (commentController relay/unrelay/escalate + relay-queue). PCs and plain
// readers are refused.
// ---------------------------------------------------------------------------

// Statuses where a relay workflow makes sense (post-submission, in review).
const RELAY_STATUSES = ['submitted', 'under_review', 'readers_assigned', 'review_complete'];

interface SubmissionListItem {
  _id: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: string;
}

function AccessDenied(): JSX.Element {
  return (
    <div className="p-8">
      <div className="card max-w-md mx-auto p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-500 mt-2">You do not have permission to access the relay console.</p>
      </div>
    </div>
  );
}

function RelayPicker(): JSX.Element {
  const query = useQuery({
    queryKey: ['relay-picker-submissions'],
    queryFn: async () => {
      const r = await api.get('/api/submissions', { params: { limit: 100 } });
      return (r.data?.submissions || []) as SubmissionListItem[];
    },
    refetchOnWindowFocus: false,
  });

  const items = (query.data || []).filter((s) => RELAY_STATUSES.includes(s.status));

  return (
    <div className="mx-auto max-w-3xl p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Relay console</h1>
        <p className="text-sm text-slate-600">
          Choose a self-study to triage and relay reader comments back to the program coordinator.
        </p>
      </header>

      {query.isLoading && (
        <div className="flex items-center gap-2 p-6 text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading submissions…</span>
        </div>
      )}

      {query.error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          Could not load submissions: {(query.error as Error).message}
        </div>
      )}

      {!query.isLoading && !query.error && items.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          <Inbox className="h-6 w-6 text-slate-400" />
          <span>No self-studies are currently in review.</span>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s._id}>
            <Link
              to={`/relay/${s._id}`}
              data-testid={`relay-pick-${s._id}`}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300 hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{s.institutionName}</p>
                <p className="text-xs text-slate-500">
                  {s.programName} ({String(s.programLevel).toUpperCase()})
                </p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {s.status.replace(/_/g, ' ')}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RelayConsolePage(): JSX.Element {
  const { submissionId } = useParams<{ submissionId?: string }>();
  const { getEffectiveRole, isSuperuser } = useAuthStore();
  const role = getEffectiveRole();
  const canRelay = role === 'admin' || role === 'lead_reader' || isSuperuser();

  if (!canRelay) {
    return <AccessDenied />;
  }

  if (!submissionId) {
    return <RelayPicker />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="px-6 pt-6">
        <Link
          to="/relay"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>All submissions</span>
        </Link>
      </div>
      <RelayConsole submissionId={submissionId} />
    </div>
  );
}
