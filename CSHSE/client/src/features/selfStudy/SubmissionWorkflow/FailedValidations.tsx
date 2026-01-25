import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface FailedValidation {
  _id: string;
  submissionId: string;
  standardCode: string;
  specCode: string;
  result: {
    status: 'fail';
    score: number;
    feedback: string;
    suggestions: string[];
    missingElements: string[];
  };
  attemptNumber: number;
  createdAt: string;
}

interface RevalidationResult {
  standardCode: string;
  specCode: string;
  previousStatus: string;
  newStatus: string;
}

interface FailedValidationsProps {
  submissionId: string;
  standardCode?: string;
  onEditSpec?: (standardCode: string, specCode: string) => void;
}

/**
 * Shows failed validations with option to revalidate
 */
export function FailedValidations({
  submissionId,
  standardCode,
  onEditSpec,
}: FailedValidationsProps) {
  const queryClient = useQueryClient();

  // Fetch failed validations
  const { data: failures, isLoading } = useQuery<FailedValidation[]>({
    queryKey: ['failed-validations', submissionId, standardCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (standardCode) params.append('standardCode', standardCode);
      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/failed?${params}`
      );
      return response.data;
    },
  });

  // Revalidate mutation
  const revalidateMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `${API_BASE}/submissions/${submissionId}/revalidate`,
        { standardCode }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['failed-validations', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-progress', submissionId] });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-24">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!failures || failures.length === 0) {
    return (
      <div className="bg-green-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="font-semibold text-green-800">All Validations Passed</h3>
            <p className="text-sm text-green-700">
              {standardCode
                ? `Standard ${standardCode} has no failed validations.`
                : 'There are no failed validations.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h3 className="font-semibold text-gray-900">
            Failed Validations ({failures.length})
          </h3>
        </div>
        <button
          onClick={() => revalidateMutation.mutate()}
          disabled={revalidateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {revalidateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Revalidate All
        </button>
      </div>

      {/* Revalidation Result */}
      {revalidateMutation.isSuccess && (
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center gap-2 text-blue-800">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              Revalidation complete: {revalidateMutation.data.passed} passed,{' '}
              {revalidateMutation.data.failed} still failing
            </span>
          </div>
        </div>
      )}

      {/* Failures List */}
      <div className="divide-y divide-gray-100">
        {failures.map((failure) => (
          <div
            key={failure._id}
            className="p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Standard/Spec Header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-red-100 text-red-700 text-sm font-medium rounded">
                    {failure.standardCode}.{failure.specCode}
                  </span>
                  <span className="text-xs text-gray-500">
                    Attempt #{failure.attemptNumber}
                  </span>
                </div>

                {/* Feedback */}
                <p className="text-sm text-gray-700 mb-2">
                  {failure.result.feedback}
                </p>

                {/* Missing Elements */}
                {failure.result.missingElements.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-red-600 mb-1">
                      Missing Elements:
                    </p>
                    <ul className="text-xs text-red-600 list-disc list-inside">
                      {failure.result.missingElements.map((element, idx) => (
                        <li key={idx}>{element}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {failure.result.suggestions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-600 mb-1">
                      Suggestions:
                    </p>
                    <ul className="text-xs text-amber-700 list-disc list-inside">
                      {failure.result.suggestions.map((suggestion, idx) => (
                        <li key={idx}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Edit Button */}
              {onEditSpec && (
                <button
                  onClick={() => onEditSpec(failure.standardCode, failure.specCode)}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                >
                  Edit
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FailedValidations;
