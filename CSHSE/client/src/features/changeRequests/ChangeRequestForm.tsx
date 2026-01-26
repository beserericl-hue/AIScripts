import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  Clock,
  Calendar,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ChangeRequestFormProps {
  submissionId: string;
  institutionName: string;
  currentDeadline?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SiteVisit {
  _id: string;
  scheduledDate: string;
  status: string;
}

export function ChangeRequestForm({
  submissionId,
  institutionName,
  currentDeadline,
  onClose,
  onSuccess,
}: ChangeRequestFormProps) {
  const queryClient = useQueryClient();
  const [requestType, setRequestType] = useState<'deadline' | 'site_visit'>('deadline');
  const [requestedValue, setRequestedValue] = useState('');
  const [reason, setReason] = useState('');
  const [selectedSiteVisit, setSelectedSiteVisit] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Fetch site visits for this submission
  const { data: siteVisitsData } = useQuery({
    queryKey: ['site-visits', submissionId],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/site-visits`, {
        params: { submissionId },
      });
      return response.data;
    },
    enabled: requestType === 'site_visit',
  });

  const siteVisits: SiteVisit[] = siteVisitsData?.siteVisits || [];

  // Submit change request
  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        submissionId,
        type: requestType,
        requestedValue,
        reason,
      };
      if (requestType === 'site_visit') {
        payload.siteVisitId = selectedSiteVisit;
      }
      const response = await api.post(`${API_BASE}/change-requests`, payload);
      return response.data;
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      if (onSuccess) {
        setTimeout(onSuccess, 2000);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedValue || !reason) return;
    if (requestType === 'site_visit' && !selectedSiteVisit) return;
    submitMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Request Submitted
          </h2>
          <p className="text-gray-600 mb-6">
            Your change request has been submitted. Both the administrator and lead
            reader will need to approve it before the change takes effect.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Request a Change
            </h2>
            <p className="text-sm text-gray-500">{institutionName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Dual Approval Required</p>
              <p className="mt-1">
                Change requests require approval from both the administrator and
                the assigned lead reader before they take effect.
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Request Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What would you like to change?
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRequestType('deadline')}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-colors ${
                  requestType === 'deadline'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Clock
                  className={`w-6 h-6 ${
                    requestType === 'deadline'
                      ? 'text-teal-600'
                      : 'text-gray-400'
                  }`}
                />
                <div className="text-left">
                  <p
                    className={`font-medium ${
                      requestType === 'deadline'
                        ? 'text-teal-900'
                        : 'text-gray-900'
                    }`}
                  >
                    Deadline
                  </p>
                  <p className="text-xs text-gray-500">
                    Accreditation deadline
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRequestType('site_visit')}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-colors ${
                  requestType === 'site_visit'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Calendar
                  className={`w-6 h-6 ${
                    requestType === 'site_visit'
                      ? 'text-teal-600'
                      : 'text-gray-400'
                  }`}
                />
                <div className="text-left">
                  <p
                    className={`font-medium ${
                      requestType === 'site_visit'
                        ? 'text-teal-900'
                        : 'text-gray-900'
                    }`}
                  >
                    Site Visit
                  </p>
                  <p className="text-xs text-gray-500">Scheduled visit date</p>
                </div>
              </button>
            </div>
          </div>

          {/* Current Value Display */}
          {requestType === 'deadline' && currentDeadline && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Current Deadline</p>
              <p className="font-medium text-gray-900">
                {format(new Date(currentDeadline), 'MMMM d, yyyy')}
              </p>
            </div>
          )}

          {/* Site Visit Selection */}
          {requestType === 'site_visit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Site Visit to Reschedule
              </label>
              {siteVisits.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  No site visits scheduled for this submission
                </p>
              ) : (
                <select
                  value={selectedSiteVisit}
                  onChange={(e) => setSelectedSiteVisit(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="">Select a site visit...</option>
                  {siteVisits.map((sv) => (
                    <option key={sv._id} value={sv._id}>
                      {format(new Date(sv.scheduledDate), 'MMMM d, yyyy')} -{' '}
                      {sv.status}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Requested New Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Requested New{' '}
              {requestType === 'deadline' ? 'Deadline' : 'Site Visit Date'}
            </label>
            <input
              type="date"
              value={requestedValue}
              onChange={(e) => setRequestedValue(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Request *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide a detailed explanation for why this change is needed..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              A clear explanation helps reviewers understand your request
            </p>
          </div>

          {/* Error */}
          {submitMutation.isError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">
                  {(submitMutation.error as any)?.response?.data?.error ||
                    'Failed to submit request'}
                </span>
              </div>
            </div>
          )}
        </form>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !requestedValue ||
              !reason ||
              (requestType === 'site_visit' && !selectedSiteVisit) ||
              submitMutation.isPending
            }
            className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChangeRequestForm;
