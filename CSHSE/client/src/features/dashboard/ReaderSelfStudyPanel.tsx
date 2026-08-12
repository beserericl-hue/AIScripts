import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BookOpenCheck, ChevronRight, ClipboardList, FileText, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

const API_BASE = '/api';

// CR-074 — the reader/lead-reader "Reader Self Study" panel. Replaces the
// separate "Review queue" screen: the self-studies assigned to this reviewer
// live on the Home dashboard, each with the reviewer's own read-marked
// progress (Introduction rows + numbered specs marked in their reader report).

interface ReaderProgress {
  introMarked: number;
  introTotal: number;
  specsMarked: number;
  specsTotal: number;
  totalMarked: number;
  total: number;
  completedAt: string | null;
  acceptanceVote: string;
}
interface ReaderDashboardItem {
  _id: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: string;
  submittedAt: string | null;
  assignmentType: 'reader' | 'lead_reader';
  progress: ReaderProgress;
}

const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  readers_assigned: { label: 'In review', cls: 'bg-indigo-100 text-indigo-700' },
  under_review: { label: 'In review', cls: 'bg-indigo-100 text-indigo-700' },
  review_complete: { label: 'Review complete', cls: 'bg-green-100 text-green-700' },
  compliant: { label: 'Compliant', cls: 'bg-green-100 text-green-700' },
  non_compliant: { label: 'Non-compliant', cls: 'bg-red-100 text-red-700' },
};

function ProgressBar({ marked, total, label }: { marked: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((marked / total) * 100) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{marked}/{total}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ReaderSelfStudyPanel(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<{ items: ReaderDashboardItem[] }>({
    queryKey: ['reader-dashboard'],
    queryFn: async () => {
      const res = await api.get(`${API_BASE}/reports/reader-dashboard`);
      return res.data;
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm" data-testid="reader-self-study-panel">
      <div className="mb-4 flex items-center gap-2">
        <BookOpenCheck className="h-5 w-5 text-teal-600" />
        <h2 className="font-semibold text-gray-900">Reader Self Study</h2>
        <span className="text-sm text-gray-500">
          ({items.length} assigned to you)
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-gray-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your assignments…
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-gray-200 py-10 text-center">
          <FileText className="mb-2 h-8 w-8 text-gray-300" />
          <p className="text-gray-500">
            Nothing assigned to you yet. When a self-study is submitted for your
            review, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="reader-self-study-list">
          {items.map((it) => {
            const pill = STATUS_PILL[it.status] || { label: it.status, cls: 'bg-gray-100 text-gray-700' };
            const p = it.progress;
            return (
              <div
                key={it._id}
                data-testid={`reader-self-study-item-${it._id}`}
                className="rounded-lg border border-gray-200 p-4 transition-colors hover:border-teal-300"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-900">{it.institutionName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${pill.cls}`}>
                        {pill.label}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {it.assignmentType === 'lead_reader' ? 'Lead reader' : 'Reader'}
                      </span>
                      {p.completedAt && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                          Report complete
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">
                      {it.programName}{it.programLevel ? ` · ${it.programLevel}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      type="button"
                      data-testid={`reader-open-study-${it._id}`}
                      onClick={() => navigate(`/self-study/${it._id}`)}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <FileText className="h-4 w-4" /> Read
                    </button>
                    <button
                      type="button"
                      data-testid={`reader-open-report-${it._id}`}
                      onClick={() => navigate(`/reader-report/${it._id}`)}
                      className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      <ClipboardList className="h-4 w-4" /> Reader report
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Per-intro / per-spec read-marked progress from this reviewer's
                    own reader report. */}
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <ProgressBar marked={p.introMarked} total={p.introTotal} label="Introduction sections read" />
                  <ProgressBar marked={p.specsMarked} total={p.specsTotal} label="Specifications read" />
                  <div className="w-full text-xs text-gray-500 sm:w-auto">
                    <span className="font-medium tabular-nums text-gray-700">{p.totalMarked}</span>
                    {' / '}
                    <span className="tabular-nums">{p.total}</span> marked overall
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ReaderSelfStudyPanel;
