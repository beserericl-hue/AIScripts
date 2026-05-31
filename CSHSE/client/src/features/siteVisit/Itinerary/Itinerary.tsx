import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, FileDown, Save } from 'lucide-react';
import { api } from '../../../services/api';

// ---------------------------------------------------------------------------
// CR-013 / Sprint 6.2 — site-visit itinerary co-edit surface.
//
// Lead reader + PC share the same view; both can edit (server enforces).
// Other readers see read-only. Editor lets the user add / remove slots,
// fill in time + activity + location + attendees + spec codes + notes,
// and save the whole agenda at once (replace semantics). DOCX export
// fetches the existing buffer pattern.
// ---------------------------------------------------------------------------

export interface AgendaSlot {
  time: string;
  activity: string;
  participants?: string;
  location?: string;
  attendees?: string[];
  specCodes?: string[];
  checklistItemIds?: string[];
  notes?: string;
}

export interface ItineraryPayload {
  submissionId: string;
  siteVisit: {
    _id: string;
    scheduledDate?: string;
    scheduledTime?: string;
    leadReaderName: string;
    institutionName: string;
    status: string;
    agenda?: AgendaSlot[];
  } | null;
  canCoEdit: boolean;
}

function toCsv(arr?: string[]): string {
  return arr ? arr.join(', ') : '';
}
function fromCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export interface ItineraryViewProps {
  data: ItineraryPayload | null;
  isLoading: boolean;
  error?: string | null;
  draft: AgendaSlot[];
  setDraft: (next: AgendaSlot[]) => void;
  onSave: () => void;
  onExport: () => void;
  saving?: boolean;
  exporting?: boolean;
}

export function ItineraryView({
  data,
  isLoading,
  error,
  draft,
  setDraft,
  onSave,
  onExport,
  saving,
  exporting,
}: ItineraryViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="itin-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Loading itinerary…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="itin-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load itinerary: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div data-testid="itin-empty-shell" className="m-6 rounded border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No itinerary data.
      </div>
    );
  }
  if (!data.siteVisit) {
    return (
      <div data-testid="itin-no-visit" className="m-6 rounded border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
        No site visit scheduled for this submission yet. An admin can schedule one from the Site Visits page.
      </div>
    );
  }

  const canEdit = data.canCoEdit;

  const updateSlot = (idx: number, patch: Partial<AgendaSlot>) => {
    const next = draft.slice();
    next[idx] = { ...next[idx], ...patch };
    setDraft(next);
  };
  const removeSlot = (idx: number) => {
    setDraft(draft.filter((_, i) => i !== idx));
  };
  const addSlot = () => {
    setDraft([...draft, { time: '', activity: '' }]);
  };

  return (
    <div data-testid="itinerary" className="mx-auto max-w-4xl p-6">
      <header className="mb-3 border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Site-visit itinerary</h1>
        <p className="text-sm text-slate-600">
          {data.siteVisit.institutionName} <span className="text-slate-400">·</span>{' '}
          Lead reader: {data.siteVisit.leadReaderName}
          {data.siteVisit.scheduledDate && (
            <>
              <span className="text-slate-400"> · </span>
              {new Date(data.siteVisit.scheduledDate).toLocaleDateString()}
              {data.siteVisit.scheduledTime ? ` at ${data.siteVisit.scheduledTime}` : ''}
            </>
          )}
        </p>
      </header>

      <div data-testid="itin-toolbar" className="mb-3 flex flex-wrap items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <span>
          {draft.length} agenda slot{draft.length === 1 ? '' : 's'}
        </span>
        {!canEdit && (
          <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">
            Read only
          </span>
        )}
        <button
          type="button"
          data-testid="itin-export-btn"
          onClick={onExport}
          disabled={exporting || !data.siteVisit.agenda?.length}
          className="ml-auto inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
          <span>{exporting ? 'Generating…' : 'Export DOCX'}</span>
        </button>
        {canEdit && (
          <button
            type="button"
            data-testid="itin-save-btn"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded bg-teal-700 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            <span>Save itinerary</span>
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {draft.map((slot, idx) => (
          <li
            key={idx}
            data-testid={`itin-slot-${idx}`}
            className="rounded border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
              <label className="text-xs text-slate-700">
                Time
                <input
                  data-testid={`itin-slot-${idx}-time`}
                  value={slot.time}
                  onChange={(e) => updateSlot(idx, { time: e.target.value })}
                  disabled={!canEdit}
                  placeholder="09:00"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs text-slate-700">
                Activity
                <input
                  data-testid={`itin-slot-${idx}-activity`}
                  value={slot.activity}
                  onChange={(e) => updateSlot(idx, { activity: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Welcome + introductions"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-700">
                Location
                <input
                  data-testid={`itin-slot-${idx}-location`}
                  value={slot.location ?? ''}
                  onChange={(e) => updateSlot(idx, { location: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Room or building"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs text-slate-700">
                Attendees (comma-separated)
                <input
                  data-testid={`itin-slot-${idx}-attendees`}
                  value={toCsv(slot.attendees)}
                  onChange={(e) => updateSlot(idx, { attendees: fromCsv(e.target.value) })}
                  disabled={!canEdit}
                  placeholder="Pat, Lin, Bob"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
            </div>
            <div className="mt-2">
              <label className="text-xs text-slate-700">
                Specs addressed (comma-separated)
                <input
                  data-testid={`itin-slot-${idx}-specs`}
                  value={toCsv(slot.specCodes)}
                  onChange={(e) => updateSlot(idx, { specCodes: fromCsv(e.target.value) })}
                  disabled={!canEdit}
                  placeholder="1.a, 2.b, 3.c"
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
            </div>
            <div className="mt-2">
              <label className="text-xs text-slate-700">
                Notes
                <textarea
                  data-testid={`itin-slot-${idx}-notes`}
                  value={slot.notes ?? ''}
                  onChange={(e) => updateSlot(idx, { notes: e.target.value })}
                  disabled={!canEdit}
                  rows={2}
                  className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                />
              </label>
            </div>
            {canEdit && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  data-testid={`itin-slot-${idx}-remove`}
                  onClick={() => removeSlot(idx)}
                  className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                  <span>Remove slot</span>
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-3">
          <button
            type="button"
            data-testid="itin-add-slot"
            onClick={addSlot}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-800 hover:bg-slate-50"
          >
            <Plus className="h-3 w-3" aria-hidden />
            <span>Add agenda slot</span>
          </button>
        </div>
      )}
    </div>
  );
}

export interface ItineraryProps {
  submissionId: string;
}

export function Itinerary({ submissionId }: ItineraryProps): JSX.Element {
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<AgendaSlot[]>([]);
  const [draftLoaded, setDraftLoaded] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const query = useQuery({
    queryKey: ['itinerary', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/itinerary`);
      return r.data as ItineraryPayload;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  // Hydrate the draft from the server payload on first successful load.
  React.useEffect(() => {
    if (!query.data || draftLoaded) return;
    const agenda = (query.data.siteVisit?.agenda || []) as AgendaSlot[];
    setDraft(agenda.map((s) => ({ ...s })));
    setDraftLoaded(true);
  }, [query.data, draftLoaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      return api.put(`/api/submissions/${submissionId}/itinerary`, { agenda: draft });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['itinerary', submissionId] });
    },
  });

  const onExport = async () => {
    setExporting(true);
    try {
      const r = await api.get(`/api/submissions/${submissionId}/itinerary/export.docx`, { responseType: 'blob' });
      const blob = r.data instanceof Blob
        ? r.data
        : new Blob([r.data], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safe = (query.data?.siteVisit?.institutionName || 'submission').replace(/[^a-z0-9_.-]+/gi, '_');
      a.href = url;
      a.download = `site_visit_itinerary_${safe}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Itinerary export failed', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ItineraryView
      data={query.data ?? null}
      isLoading={query.isLoading}
      error={query.error ? (query.error as Error).message : null}
      draft={draft}
      setDraft={setDraft}
      onSave={() => saveMutation.mutate()}
      onExport={onExport}
      saving={saveMutation.isPending}
      exporting={exporting}
    />
  );
}
