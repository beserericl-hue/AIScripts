import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, FileDown, Check, X, ClipboardList, Trash2 } from 'lucide-react';
import { useOnceHint } from '../../tour/useOnceHint';
import { t } from '../../../i18n/strings';

// ---------------------------------------------------------------------------
// CR-012 / Sprint 6.1 — partial-compliance checklist surface.
//
// View / container split:
//   - ChecklistView  : pure presentational; takes items + handlers.
//   - Checklist      : container; wires TanStack-Query for read +
//                      verify/unverify + DOCX export.
//
// The visit team uses this during the in-person visit. Auto-populated
// items appear when the lead reader has set a Final score of 0/1 on the
// CompilationTab. Verification flips a row "Yes" with an optional note.
// ---------------------------------------------------------------------------

export type ChecklistInclusionReason = 'partial' | 'non_compliant' | 'follow_up' | 'manual';

export interface ChecklistItem {
  _id: string;
  standardCode: string;
  specCode: string;
  inclusionReason: ChecklistInclusionReason;
  finalScoreAtInclusion: number;
  verified: boolean;
  verifiedByName?: string;
  verifiedAt?: string;
  verificationNote?: string;
  addedByName?: string;
  source: 'auto' | 'manual';
}

export interface ChecklistPayload {
  submissionId: string;
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  items: ChecklistItem[];
  counts: {
    total: number;
    partial: number;
    non_compliant: number;
    follow_up: number;
    manual: number;
    verified: number;
  };
}

export interface ChecklistViewProps {
  data: ChecklistPayload | null;
  isLoading: boolean;
  error?: string | null;
  canWrite: boolean;
  draftNotes: Record<string, string>;
  onChangeNote: (itemId: string, next: string) => void;
  onToggleVerify: (item: ChecklistItem) => void;
  onDelete: (item: ChecklistItem) => void;
  onExport: () => void;
  exporting?: boolean;
  savingId?: string | null;
}

function reasonChipClasses(reason: ChecklistInclusionReason): string {
  if (reason === 'non_compliant') return 'border-red-300 bg-red-100 text-red-900';
  if (reason === 'partial') return 'border-amber-300 bg-amber-100 text-amber-900';
  if (reason === 'follow_up') return 'border-indigo-300 bg-indigo-100 text-indigo-900';
  return 'border-slate-300 bg-slate-100 text-slate-700';
}

function reasonLabel(reason: ChecklistInclusionReason): string {
  if (reason === 'partial') return 'Partial';
  if (reason === 'non_compliant') return 'Non-compliant';
  if (reason === 'follow_up') return 'Follow-up';
  return 'Manual';
}

export function ChecklistView({
  data,
  isLoading,
  error,
  canWrite,
  draftNotes,
  onChangeNote,
  onToggleVerify,
  onDelete,
  onExport,
  exporting,
  savingId,
}: ChecklistViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="checklist-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading checklist…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="checklist-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load checklist: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div data-testid="checklist-empty-shell" className="m-6 rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No checklist data.
      </div>
    );
  }

  return (
    <div data-testid="checklist" className="mx-auto max-w-4xl p-6">
      <header className="mb-3 border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">
          Site-visit checklist
        </h1>
        <p className="text-sm text-slate-600">
          {data.institutionName} <span className="text-slate-400">·</span>{' '}
          {data.programName} <span className="text-slate-400">·</span>{' '}
          <span className="uppercase">{data.programLevel}</span>
        </p>
      </header>

      <div data-testid="checklist-toolbar" className="mb-3 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <span className="inline-flex items-center gap-1">
          <ClipboardList className="h-4 w-4" aria-hidden />
          <span>
            {data.counts.total} item{data.counts.total === 1 ? '' : 's'} ·{' '}
            {data.counts.verified} verified
          </span>
        </span>
        <span className="text-slate-400">·</span>
        <span>{data.counts.partial} partial</span>
        <span className="text-slate-400">·</span>
        <span>{data.counts.non_compliant} non-compliant</span>
        {(data.counts.manual || data.counts.follow_up) && (
          <>
            <span className="text-slate-400">·</span>
            <span>{data.counts.manual + data.counts.follow_up} manual / follow-up</span>
          </>
        )}
        <button
          type="button"
          data-testid="checklist-export-btn"
          onClick={onExport}
          disabled={exporting || data.counts.total === 0}
          className="ml-auto inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
          <span>{exporting ? 'Generating…' : 'Export DOCX'}</span>
        </button>
      </div>

      {data.items.length === 0 ? (
        <div data-testid="checklist-empty" className="rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No partial-compliance items yet. Items appear here once the lead reader sets a Final score of 0 or 1 on the Compilation tab.
        </div>
      ) : (
        <ul className="space-y-2">
          {data.items.map((item) => {
            const isSaving = savingId === item._id;
            const noteVal = draftNotes[item._id] ?? item.verificationNote ?? '';
            return (
              <li
                key={item._id}
                data-testid={`checklist-row-${item._id}`}
                data-verified={item.verified ? 'true' : 'false'}
                className={[
                  'rounded border p-3 shadow-sm',
                  item.verified ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white',
                ].join(' ')}
              >
                <header className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-700">
                    {item.standardCode}.{item.specCode}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${reasonChipClasses(item.inclusionReason)}`}
                  >
                    {reasonLabel(item.inclusionReason)}
                  </span>
                  {item.source === 'manual' && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
                      Manual
                    </span>
                  )}
                  {item.addedByName && (
                    <span className="text-[10px] text-slate-500">added by {item.addedByName}</span>
                  )}
                </header>

                <label className="block text-xs text-slate-700">
                  Visit-team note
                  <textarea
                    data-testid={`checklist-note-${item._id}`}
                    value={noteVal}
                    onChange={(e) => onChangeNote(item._id, e.target.value)}
                    rows={2}
                    disabled={!canWrite || isSaving}
                    placeholder="What did the visit team observe?"
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>

                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  {item.verified && item.verifiedByName && (
                    <span className="mr-auto text-[10px] text-slate-500">
                      Verified by {item.verifiedByName}
                    </span>
                  )}
                  {canWrite && item.source === 'manual' && (
                    <button
                      type="button"
                      data-testid={`checklist-delete-${item._id}`}
                      onClick={() => onDelete(item)}
                      disabled={isSaving}
                      className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" aria-hidden />
                      <span>Remove</span>
                    </button>
                  )}
                  <button
                    type="button"
                    id={`checklist-verify-${item._id}`}
                    data-testid={`checklist-verify-${item._id}`}
                    onClick={() => onToggleVerify(item)}
                    disabled={isSaving}
                    className={[
                      'inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium disabled:opacity-50',
                      item.verified
                        ? 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        : 'bg-emerald-700 text-white hover:bg-emerald-800',
                    ].join(' ')}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : item.verified ? (
                      <X className="h-3 w-3" aria-hidden />
                    ) : (
                      <Check className="h-3 w-3" aria-hidden />
                    )}
                    <span>{item.verified ? 'Un-verify' : 'Mark verified'}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export interface ChecklistProps {
  submissionId: string;
  /** Whether the current viewer can verify / unverify (and delete manual items). */
  canWrite: boolean;
}

export function Checklist({ submissionId, canWrite }: ChecklistProps): JSX.Element {
  const qc = useQueryClient();
  const [draftNotes, setDraftNotes] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const { fireOnce } = useOnceHint();

  const query = useQuery({
    queryKey: ['site-visit-checklist', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/checklist`);
      return r.data as ChecklistPayload;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['site-visit-checklist', submissionId] });
  };

  const verifyMutation = useMutation({
    mutationFn: async (vars: { item: ChecklistItem; verified: boolean; note?: string }) => {
      setSavingId(vars.item._id);
      return api.patch(
        `/api/submissions/${submissionId}/checklist/${vars.item._id}/verify`,
        { verified: vars.verified, note: vars.note ?? '' }
      );
    },
    onSettled: () => {
      setSavingId(null);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (item: ChecklistItem) => {
      setSavingId(item._id);
      return api.delete(`/api/submissions/${submissionId}/checklist/${item._id}`);
    },
    onSettled: () => {
      setSavingId(null);
      invalidate();
    },
  });

  const onChangeNote = (itemId: string, next: string) => {
    setDraftNotes((prev) => ({ ...prev, [itemId]: next }));
  };

  const onToggleVerify = (item: ChecklistItem) => {
    const note = draftNotes[item._id] ?? item.verificationNote ?? '';
    const nextVerified = !item.verified;
    // CR-052 / Sprint 9.3 — nudge on the first verify only (not un-verify).
    // The button stays mounted across the toggle, so anchoring is immediate.
    if (nextVerified) {
      fireOnce({
        id: 'checklist-first-verify',
        message: t('hint.checklist.firstVerify'),
        targetId: `checklist-verify-${item._id}`,
      });
    }
    verifyMutation.mutate({ item, verified: nextVerified, note });
  };

  const onDelete = (item: ChecklistItem) => {
    deleteMutation.mutate(item);
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const r = await api.get(
        `/api/submissions/${submissionId}/checklist/export.docx`,
        { responseType: 'blob' }
      );
      const blob = r.data instanceof Blob
        ? r.data
        : new Blob([r.data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safe = (query.data?.institutionName || 'submission').replace(/[^a-z0-9_.-]+/gi, '_');
      a.href = url;
      a.download = `site_visit_checklist_${safe}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Checklist export failed', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ChecklistView
      data={query.data ?? null}
      isLoading={query.isLoading}
      error={query.error ? (query.error as Error).message : null}
      canWrite={canWrite}
      draftNotes={draftNotes}
      onChangeNote={onChangeNote}
      onToggleVerify={onToggleVerify}
      onDelete={onDelete}
      onExport={onExport}
      exporting={exporting}
      savingId={savingId}
    />
  );
}
