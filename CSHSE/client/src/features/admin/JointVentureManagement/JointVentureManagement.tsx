import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, Plus, Archive, X, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// CR-019 / Sprint 8.2 — Admin Joint Venture management.
//
// Single screen with:
//   - active JV list (per row: name, member count, archived badge,
//     archive button)
//   - inline create form (name + description + institution multi-select
//     filtered to institutions not already in another active JV)
//
// View / container split; admin-gated by the parent route (AdminPage).
// ---------------------------------------------------------------------------

export interface JointVenture {
  _id: string;
  name: string;
  description?: string;
  institutionIds: string[];
  archived: boolean;
  archivedAt?: string;
  archivedReason?: string;
  createdByName: string;
  createdAt: string;
}

export interface InstitutionLite {
  _id: string;
  name: string;
  jointVentureId?: string | null;
}

export interface JointVentureManagementViewProps {
  jvs: JointVenture[];
  institutions: InstitutionLite[];
  isLoading: boolean;
  error?: string | null;
  showArchived: boolean;
  onToggleArchived: () => void;
  draft: { name: string; description: string; institutionIds: string[] };
  setDraft: (patch: Partial<{ name: string; description: string; institutionIds: string[] }>) => void;
  onCreate: () => void;
  creating?: boolean;
  onArchive: (jvId: string) => void;
  archivingId?: string | null;
}

export function JointVentureManagementView({
  jvs,
  institutions,
  isLoading,
  error,
  showArchived,
  onToggleArchived,
  draft,
  setDraft,
  onCreate,
  creating,
  onArchive,
  archivingId,
}: JointVentureManagementViewProps): JSX.Element {
  if (isLoading) {
    return (
      <div data-testid="jv-loading" className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading joint ventures…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div data-testid="jv-error" className="m-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Could not load joint ventures: {error}
      </div>
    );
  }

  const eligibleInstitutions = institutions.filter((i) => !i.jointVentureId);
  const canSubmit = !!draft.name.trim() && draft.institutionIds.length >= 2;
  const instById = new Map(institutions.map((i) => [i._id, i]));

  const toggleInst = (id: string) => {
    const set = new Set(draft.institutionIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    setDraft({ institutionIds: Array.from(set) });
  };

  return (
    <div data-testid="jv-mgmt" className="mx-auto max-w-5xl p-6">
      <header className="mb-3 border-b border-slate-200 pb-3">
        <h1 className="text-xl font-semibold text-slate-900">Joint ventures</h1>
        <p className="text-sm text-slate-600">
          Group two or more institutions that co-deliver an accredited program.
          Grouping is organizational only — each member institution keeps its own coordinator, readers, and submissions.
        </p>
      </header>

      <section data-testid="jv-create" className="mb-6 rounded border border-slate-200 bg-white p-3 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">Create a joint venture</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-700">
            Name
            <input
              data-testid="jv-create-name"
              value={draft.name}
              onChange={(e) => setDraft({ name: e.target.value })}
              placeholder="e.g. Coastal Allied Health Consortium"
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <label className="text-xs text-slate-700">
            Description (optional)
            <input
              data-testid="jv-create-description"
              value={draft.description}
              onChange={(e) => setDraft({ description: e.target.value })}
              placeholder="What is this venture for?"
              className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-slate-700">
            Member institutions ({draft.institutionIds.length} picked — minimum 2)
          </p>
          {eligibleInstitutions.length === 0 ? (
            <p data-testid="jv-no-eligible" className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              No institutions are eligible — every institution is already part of another joint venture.
            </p>
          ) : (
            <ul data-testid="jv-eligible" className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {eligibleInstitutions.map((inst) => {
                const picked = draft.institutionIds.includes(inst._id);
                return (
                  <li key={inst._id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs hover:bg-slate-100">
                      <input
                        type="checkbox"
                        data-testid={`jv-pick-${inst._id}`}
                        checked={picked}
                        onChange={() => toggleInst(inst._id)}
                      />
                      <span>{inst.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            data-testid="jv-create-submit"
            onClick={onCreate}
            disabled={!canSubmit || creating}
            className="inline-flex items-center gap-1 rounded bg-teal-700 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            <span>Create joint venture</span>
          </button>
        </div>
      </section>

      <section>
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
            {showArchived ? 'Archived' : 'Active'} ({jvs.length})
          </h2>
          <button
            type="button"
            data-testid="jv-toggle-archived"
            onClick={onToggleArchived}
            className="text-xs text-slate-600 underline hover:text-slate-900"
          >
            {showArchived ? 'Show active' : 'Show archived'}
          </button>
        </header>
        {jvs.length === 0 ? (
          <p data-testid="jv-empty" className="rounded border border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
            No {showArchived ? 'archived' : 'active'} joint ventures.
          </p>
        ) : (
          <ul className="space-y-2">
            {jvs.map((jv) => {
              const isArchiving = archivingId === jv._id;
              const memberNames = jv.institutionIds
                .map((id) => instById.get(id)?.name || id.slice(-6))
                .join(', ');
              return (
                <li
                  key={jv._id}
                  data-testid={`jv-row-${jv._id}`}
                  className="rounded border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{jv.name}</h3>
                    <span className="text-xs text-slate-500">
                      {jv.institutionIds.length} member{jv.institutionIds.length === 1 ? '' : 's'}
                      {jv.archived && (
                        <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">
                          archived
                        </span>
                      )}
                    </span>
                  </div>
                  {jv.description && <p className="mt-1 text-xs text-slate-700">{jv.description}</p>}
                  <p className="mt-1 text-[10px] text-slate-500">{memberNames}</p>
                  {!jv.archived && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        data-testid={`jv-archive-${jv._id}`}
                        onClick={() => onArchive(jv._id)}
                        disabled={isArchiving}
                        className="inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {isArchiving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                        <span>Archive</span>
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export function JointVentureManagement(): JSX.Element {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = React.useState(false);
  const [draft, setDraftState] = React.useState<{ name: string; description: string; institutionIds: string[] }>({
    name: '',
    description: '',
    institutionIds: [],
  });
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const jvsQ = useQuery({
    queryKey: ['joint-ventures', { archived: showArchived }],
    queryFn: async () => {
      const r = await api.get('/api/joint-ventures', { params: { archived: showArchived ? 'true' : 'false' } });
      return (r.data?.jointVentures || []) as JointVenture[];
    },
    refetchOnWindowFocus: false,
  });

  const institutionsQ = useQuery({
    queryKey: ['institutions-lite'],
    queryFn: async () => {
      const r = await api.get('/api/institutions');
      const list = (r.data?.institutions || r.data || []) as any[];
      return list.map((i) => ({
        _id: String(i._id),
        name: i.name,
        jointVentureId: i.jointVentureId ? String(i.jointVentureId) : null,
      })) as InstitutionLite[];
    },
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return api.post('/api/joint-ventures', {
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        institutionIds: draft.institutionIds,
      });
    },
    onSuccess: () => {
      setDraftState({ name: '', description: '', institutionIds: [] });
      void qc.invalidateQueries({ queryKey: ['joint-ventures'] });
      void qc.invalidateQueries({ queryKey: ['institutions-lite'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      setArchivingId(id);
      return api.post(`/api/joint-ventures/${id}/archive`, { reason: 'Archived from admin UI' });
    },
    onSettled: () => {
      setArchivingId(null);
      void qc.invalidateQueries({ queryKey: ['joint-ventures'] });
      void qc.invalidateQueries({ queryKey: ['institutions-lite'] });
    },
  });

  return (
    <JointVentureManagementView
      jvs={jvsQ.data || []}
      institutions={institutionsQ.data || []}
      isLoading={jvsQ.isLoading || institutionsQ.isLoading}
      error={jvsQ.error ? (jvsQ.error as Error).message : institutionsQ.error ? (institutionsQ.error as Error).message : null}
      showArchived={showArchived}
      onToggleArchived={() => setShowArchived((v) => !v)}
      draft={draft}
      setDraft={(patch) => setDraftState((prev) => ({ ...prev, ...patch }))}
      onCreate={() => createMutation.mutate()}
      creating={createMutation.isPending}
      onArchive={(id) => archiveMutation.mutate(id)}
      archivingId={archivingId}
    />
  );
}
