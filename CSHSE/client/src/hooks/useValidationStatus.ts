import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

interface ValidationResult {
  status: 'pass' | 'fail' | 'pending';
  score: number;
  feedback: string;
  suggestions: string[];
  missingElements: string[];
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

/**
 * Hook for managing validation status of self-study sections
 * Polls for results after triggering validation, then refreshes submission data
 */
export function useValidationStatus({
  submissionId,
  standardCode,
  specCode,
}: UseValidationStatusOptions) {
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = useState(false);
  const [waitingForResult, setWaitingForResult] = useState(false);
  const previousStatusRef = useRef<string | null>(null);

  // Fetch latest validation result — polls every 3s while waiting for callback
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
    refetchInterval: waitingForResult ? 3000 : false,
  });

  // When result changes from pending to pass/fail, stop polling and refresh submission
  useEffect(() => {
    const currentStatus = validationResult?.result?.status;
    if (
      waitingForResult &&
      currentStatus &&
      currentStatus !== 'pending' &&
      previousStatusRef.current === 'pending'
    ) {
      setWaitingForResult(false);
      // Refresh submission data so the validated counter updates
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    }
    previousStatusRef.current = currentStatus ?? null;
  }, [validationResult?.result?.status, waitingForResult, queryClient, submissionId]);

  // Trigger validation mutation
  const validateMutation = useMutation({
    mutationFn: async ({ narrativeText, validationType, evidenceText }: TriggerValidationParams) => {
      setIsValidating(true);
      const response = await api.post(`${API_BASE}/webhooks/n8n/validate`, {
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
    onSuccess: () => {
      // Start polling for the callback result
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
    feedback: validationResult?.result?.feedback ?? null,
    suggestions: validationResult?.result?.suggestions ?? [],
    missingElements: validationResult?.result?.missingElements ?? [],
    score: validationResult?.result?.score ?? null,
  };
}

export default useValidationStatus;
