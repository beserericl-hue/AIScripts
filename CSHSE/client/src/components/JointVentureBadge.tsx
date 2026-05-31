import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Network } from 'lucide-react';
import { api } from '../services/api';

// ---------------------------------------------------------------------------
// CR-019 / Sprint 8.3 — Joint Venture badge.
//
// Renders an unobtrusive "Joint Venture: {name}" chip when the given
// institution belongs to an active JV the viewer can see (per the JV
// RBAC: admin always; member-institution viewer 200; everyone else
// 404). When the institution has no JV (or the viewer can't see it),
// nothing renders.
//
// Drop next to an institution name on any surface (reader dashboard
// row, PC dashboard header, lead-reader CompilationTab header).
// ---------------------------------------------------------------------------

export interface JointVentureBadgeProps {
  /** The viewer's institution OR an institution whose JV badge should appear here. */
  institutionId: string | null | undefined;
}

interface BadgeData {
  jointVentures: Array<{ _id: string; name: string; institutionIds: string[]; archived: boolean }>;
}

export function JointVentureBadge({ institutionId }: JointVentureBadgeProps): JSX.Element | null {
  // We pull the list endpoint (caller-scoped per server RBAC) and find
  // a JV containing institutionId locally. This sidesteps the need for
  // a per-institution lookup endpoint AND keeps the response paged at the
  // user level (admins see all; non-admin members only theirs).
  const query = useQuery({
    queryKey: ['joint-ventures-for-badge'],
    queryFn: async () => {
      const r = await api.get('/api/joint-ventures', { params: { archived: 'false' } });
      return r.data as BadgeData;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (!institutionId || !query.data) return null;
  const match = query.data.jointVentures.find(
    (j) => !j.archived && j.institutionIds.some((id) => String(id) === String(institutionId))
  );
  if (!match) return null;

  return (
    <span
      data-testid={`jv-badge-${institutionId}`}
      title="This institution is part of a joint venture."
      className="inline-flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-900"
    >
      <Network className="h-3 w-3" aria-hidden />
      <span>Joint Venture: {match.name}</span>
    </span>
  );
}
