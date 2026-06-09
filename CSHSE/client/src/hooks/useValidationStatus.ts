import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface ValidationResult {
  status: 'pass' | 'fail' | 'pending';
  // 3-level AI verdict (the binary `status` is the submit gate; `verdict`
  // is the nuanced result the UI displays).
  verdict?: 'pass' | 'needs_improvement' | 'fail';
  score: number;
  feedback: string;
  rationale?: string;
  suggestions: string[];
  missingElements: string[];
  criteriaCoverage?: Array<{ criterion: string; met: boolean; note?: string }>;
}

interface ValidationResponse {
  _id: string;
  submissionId: string;
  standardCode: string;
  specCode: string;
  validationType: 'auto_save' | 'manual_save' | 'submit';
  result: ValidationResult;
  attemptNumber: number;
  createdAt: string;
}

interface UseValidationStatusOptions {
  submissionId: string;
  standardCode: string;
  specCode?: string;
}

interface TriggerValidationParams {
  narrativeText: string;
  validationType: 'manual_save' | 'submit';
  evidenceText?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

/**
 * Hook for managing validation status of self-study sections
 * After triggering validation, polls until the callback result arrives,
 * then refreshes the submission data so the validated counter updates.
 */
export function useValidationStatus({
  submissionId,
  standardCode,
  specCode,
}: UseValidationStatusOptions) {
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = useState(false);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const [pendingValidationId, setPendingValidationId] = useState<string | null>(null);

  // Fetch latest validation result
  const { data: validationResult, isLoading } = useQuery<ValidationResponse | null>({
    queryKey: ['validation', submissionId, standardCode, specCode],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          submissionId,
          standardCode,
          ...(specCode && { specCode }),
        });
        const response = await api.get(
          `${API_BASE}/webhooks/validation/latest?${params}`
        );
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: !!submissionId && !!standardCode,
  });

  // Explicit polling via setInterval when waiting for callback result
  useEffect(() => {
    if (!waitingForResult) return;

    const intervalId = setInterval(() => {
      queryClient.refetchQueries({
        queryKey: ['validation', submissionId, standardCode, specCode],
      });
    }, POLL_INTERVAL_MS);

    // Safety timeout — stop polling after 60s
    const timeoutId = setTimeout(() => {
      setWaitingForResult(false);
      setPendingValidationId(null);
    }, POLL_TIMEOUT_MS);

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, [waitingForResult, queryClient, submissionId, standardCode, specCode]);

  // Detect when the callback result arrives by matching the validation ID
  useEffect(() => {
    if (!waitingForResult || !pendingValidationId) return;

    const currentStatus = validationResult?.result?.status;
    const currentId = validationResult?._id;

    // Only stop polling when the SPECIFIC validation we triggered is no longer pending
    if (currentId === pendingValidationId && currentStatus && currentStatus !== 'pending') {
      setWaitingForResult(false);
      setPendingValidationId(null);
      // Refresh submission data so the validated counter updates
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    }
  }, [validationResult, waitingForResult, pendingValidationId, queryClient, submissionId]);

  // Trigger validation mutation
  const validateMutation = useMutation({
    mutationFn: async ({ narrativeText, validationType, evidenceText }: TriggerValidationParams) => {
      setIsValidating(true);
      // CR-054 — validation is now in-process (cshse-ai). The call is
      // synchronous; the polling below still resolves it on the first refetch
      // since the persisted result is already final, not pending.
      const response = await api.post(`${API_BASE}/webhooks/validate`, {
        submissionId,
        standardCode,
        specCode,
        narrativeText,
        validationType,
        evidenceText,
      });
      return response.data;
    },
    onSettled: () => {
      setIsValidating(false);
    },
    onSuccess: (data) => {
      // Track the specific validation ID so we can match it when polling
      setPendingValidationId(data.validationId);
      setWaitingForResult(true);
      // Invalidate to immediately pick up the new "pending" record
      queryClient.invalidateQueries({
        queryKey: ['validation', submissionId, standardCode, specCode],
      });
    },
  });

  const triggerValidation = useCallback(
    (params: TriggerValidationParams) => {
      return validateMutation.mutateAsync(params);
    },
    [validateMutation]
  );

  // Get validation status summary for a standard
  const getStandardValidationStatus = useCallback(async () => {
    const response = await api.get(
      `${API_BASE}/webhooks/validation/standard/${submissionId}/${standardCode}`
    );
    return response.data;
  }, [submissionId, standardCode]);

  return {
    validationResult,
    isLoading,
    isValidating: isValidating || validateMutation.isPending || waitingForResult,
    triggerValidation,
    getStandardValidationStatus,
    validationError: validateMutation.error,
    status: validationResult?.result?.status ?? 'pending',
    // 3-level AI verdict (pass | needs_improvement | fail) — the nuanced result
    // the UI should display, vs `status` which is the binary submit gate.
    verdict: validationResult?.result?.verdict ?? null,
    feedback: validationResult?.result?.feedback ?? validationResult?.result?.rationale ?? null,
    suggestions: validationResult?.result?.suggestions ?? [],
    missingElements: validationResult?.result?.missingElements ?? [],
    criteriaCoverage: validationResult?.result?.criteriaCoverage ?? [],
    score: validationResult?.result?.score ?? null,
  };
}

export default useValidationStatus;
