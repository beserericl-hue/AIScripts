import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

/**
 * Numbered parts of a specification (4.a.1, 4.a.2 …). Only a few specifications
 * have them; each part must be approved before the specification is complete.
 * The Review rail and the Self-Study Editor share this one server record, so a
 * part approved in one shows approved in the other.
 */
export interface SpecPart {
  n: number;
  text: string;
}

interface SpecPartsState {
  parts: Record<string, SpecPart[]>;
  approvals: Record<string, Record<string, { approvedBy?: string; approvedAt?: string }>>;
}

const EMPTY: SpecPartsState = { parts: {}, approvals: {} };

export function useSpecParts(submissionId: string | null | undefined) {
  const queryClient = useQueryClient();
  const key = ['spec-parts', submissionId];

  const { data } = useQuery<SpecPartsState>({
    queryKey: key,
    enabled: !!submissionId,
    queryFn: async () => (await api.get(`/api/submissions/${submissionId}/spec-parts`)).data,
    staleTime: 30_000,
  });
  const state = data || EMPTY;

  const mutation = useMutation({
    mutationFn: async (v: { standardCode: string; specCode: string; n: number; approved: boolean }) =>
      (await api.post(`/api/submissions/${submissionId}/spec-parts/approval`, v)).data,
    // Tick immediately; the server's answer replaces the guess (or rolls it back).
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<SpecPartsState>(key);
      if (prev) {
        const k = `${v.standardCode}_${v.specCode}`;
        const forSpec = { ...(prev.approvals[k] || {}) };
        if (v.approved) forSpec[String(v.n)] = { approvedAt: new Date().toISOString() };
        else delete forSpec[String(v.n)];
        queryClient.setQueryData<SpecPartsState>(key, { ...prev, approvals: { ...prev.approvals, [k]: forSpec } });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(key, ctx.prev);
    },
    onSuccess: (res: { specPartApprovals: SpecPartsState['approvals'] }) => {
      const prev = queryClient.getQueryData<SpecPartsState>(key);
      if (prev) queryClient.setQueryData<SpecPartsState>(key, { ...prev, approvals: res.specPartApprovals || {} });
    },
  });

  const partsOf = useCallback(
    (standardCode: string, specCode: string): SpecPart[] => state.parts[`${standardCode}_${specCode}`] || [],
    [state]
  );
  const isApproved = useCallback(
    (standardCode: string, specCode: string, n: number) => !!state.approvals[`${standardCode}_${specCode}`]?.[String(n)],
    [state]
  );
  const approvedCount = useCallback(
    (standardCode: string, specCode: string) =>
      partsOf(standardCode, specCode).filter((p) => isApproved(standardCode, specCode, p.n)).length,
    [partsOf, isApproved]
  );
  const setApproved = useCallback(
    (standardCode: string, specCode: string, n: number, approved: boolean) =>
      mutation.mutate({ standardCode, specCode, n, approved }),
    [mutation]
  );

  return { partsOf, isApproved, approvedCount, setApproved };
}
