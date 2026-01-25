import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

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
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Hook for managing validation status of self-study sections
 */
export function useValidationStatus({
  submissionId,
  standardCode,
  specCode,
}: UseValidationStatusOptions) {
  const queryClient = useQueryClient();
  const [isValidating, setIsValidating] = useState(false);

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
        const response = await axios.get(
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

  // Trigger validation mutation
  const validateMutation = useMutation({
    mutationFn: async ({ narrativeText, validationType }: TriggerValidationParams) => {
      setIsValidating(true);
      const response = await axios.post(`${API_BASE}/webhooks/n8n/validate`, {
        submissionId,
        standardCode,
        specCode,
        narrativeText,
        validationType,
      });
      return response.data;
    },
    onSettled: () => {
      setIsValidating(false);
    },
    onSuccess: () => {
      // Invalidate validation query to refresh results
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
    const response = await axios.get(
      `${API_BASE}/webhooks/validation/standard/${submissionId}/${standardCode}`
    );
    return response.data;
  }, [submissionId, standardCode]);

  return {
    validationResult,
    isLoading,
    isValidating: isValidating || validateMutation.isPending,
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
