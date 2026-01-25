import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Bell,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  HourglassIcon,
  ChevronDown,
  ChevronUp,
  Loader2,
  User,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ChangeRequest {
  _id: string;
  submissionId: { _id: string; submissionId: string; institutionName: string };
  institutionName: string;
  type: 'deadline' | 'site_visit';
  currentValue: string;
  requestedValue: string;
  reason: string;
  requestedBy: { _id: string; firstName: string; lastName: string };
  requestedByName: string;
  requestedByRole: string;
  status: 'pending' | 'approved' | 'denied' | 'withdrawn';
  approvals: {
    admin: {
      approved?: boolean;
      userName?: string;
      approvedAt?: string;
      comments?: string;
    };
    leadReader: {
      approved?: boolean;
      userName?: string;
      approvedAt?: string;
      comments?: string;
    };
  };
  createdAt: string;
}

interface ChangeRequestsListProps {
  userRole: 'admin' | 'lead_reader';
  submissionId?: string;
  showFilters?: boolean;
}

export function ChangeRequestsList({
  userRole,
  submissionId,
  showFilters = true,
}: ChangeRequestsListProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [actionModal, setActionModal] = useState<{
    id: string;
    action: 'approve' | 'deny';
  } | null>(null);
  const [comments, setComments] = useState('');

  // Fetch change requests
  const { data, isLoading } = useQuery({
    queryKey: ['change-requests', { status: statusFilter, type: typeFilter, submissionId }],
    queryFn: async () => {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;
      if (submissionId) params.submissionId = submissionId;
      const response = await axios.get(`${API_BASE}/change-requests`, { params });
      return response.data;
    },
  });

  const changeRequests: ChangeRequest[] = data?.changeRequests || [];

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments?: string }) => {
      const response = await axios.post(
        `${API_BASE}/change-requests/${id}/approve`,
        { comments }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      setActionModal(null);
      setComments('');
    },
  });

  // Deny mutation
  const denyMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await axios.post(
        `${API_BASE}/change-requests/${id}/deny`,
        { reason }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      setActionModal(null);
      setComments('');
    },
  });

  const handleAction = () => {
    if (!actionModal) return;
    if (actionModal.action === 'approve') {
      approveMutation.mutate({ id: actionModal.id, comments });
    } else {
      if (!comments) return; // Reason is required for denial
      denyMutation.mutate({ id: actionModal.id, reason: comments });
    }
  };

  const getStatusBadge = (cr: ChangeRequest) => {
    switch (cr.status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      case 'denied':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Denied
          </span>
        );
      case 'withdrawn':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
            Withdrawn
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
            <HourglassIcon className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  const canTakeAction = (cr: ChangeRequest) => {
    if (cr.status !== 'pending') return false;
    const approvalKey = userRole === 'admin' ? 'admin' : 'leadReader';
    return cr.approvals[approvalKey]?.approved === undefined;
  };

  const hasApproved = (cr: ChangeRequest) => {
    const approvalKey = userRole === 'admin' ? 'admin' : 'leadReader';
    return cr.approvals[approvalKey]?.approved === true;
  };

  const hasDenied = (cr: ChangeRequest) => {
    const approvalKey = userRole === 'admin' ? 'admin' : 'leadReader';
    return cr.approvals[approvalKey]?.approved === false;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" />
          <h2 className="font-semibold text-gray-900">Change Requests</h2>
        </div>
        {changeRequests.filter((cr) => cr.status === 'pending').length > 0 && (
          <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
            {changeRequests.filter((cr) => cr.status === 'pending').length}{' '}
            pending
          </span>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 border-b border-gray-200">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="withdrawn">Withdrawn</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Types</option>
            <option value="deadline">Deadline Changes</option>
            <option value="site_visit">Site Visit Changes</option>
          </select>
        </div>
      )}

      {/* List */}
      <div className="divide-y divide-gray-100">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {!isLoading && changeRequests.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No change requests found</p>
          </div>
        )}

        {changeRequests.map((cr) => (
          <div key={cr._id} className="p-4">
            {/* Summary Row */}
            <div
              className="flex items-start justify-between cursor-pointer"
              onClick={() =>
                setExpandedId(expandedId === cr._id ? null : cr._id)
              }
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  {cr.type === 'deadline' ? (
                    <Clock className="w-4 h-4 text-purple-500" />
                  ) : (
                    <Calendar className="w-4 h-4 text-blue-500" />
                  )}
                  <span className="font-medium text-gray-900">
                    {cr.institutionName ||
                      cr.submissionId?.institutionName ||
                      'Unknown Institution'}
                  </span>
                  {getStatusBadge(cr)}
                </div>
                <p className="text-sm text-gray-600 ml-7">
                  {cr.type === 'deadline'
                    ? 'Deadline change request'
                    : 'Site visit reschedule request'}
                </p>
                <p className="text-xs text-gray-400 mt-1 ml-7">
                  Requested by {cr.requestedByName} •{' '}
                  {formatDistanceToNow(new Date(cr.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Approval Status Indicators */}
                <div className="flex flex-col items-end gap-1 mr-4">
                  <div className="flex items-center gap-1">
                    {cr.approvals?.admin?.approved === true ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : cr.approvals?.admin?.approved === false ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <HourglassIcon className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-500">Admin</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {cr.approvals?.leadReader?.approved === true ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : cr.approvals?.leadReader?.approved === false ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <HourglassIcon className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-xs text-gray-500">Lead Reader</span>
                  </div>
                </div>
                {expandedId === cr._id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {expandedId === cr._id && (
              <div className="mt-4 ml-7 space-y-4">
                {/* Change Details */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Current{' '}
                      {cr.type === 'deadline' ? 'Deadline' : 'Visit Date'}
                    </p>
                    <p className="font-medium text-gray-900">
                      {cr.currentValue
                        ? format(new Date(cr.currentValue), 'MMMM d, yyyy')
                        : 'Not set'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Requested{' '}
                      {cr.type === 'deadline' ? 'Deadline' : 'Visit Date'}
                    </p>
                    <p className="font-medium text-teal-600">
                      {format(new Date(cr.requestedValue), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Reason */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    Reason for Request
                  </p>
                  <p className="text-gray-700">{cr.reason}</p>
                </div>

                {/* Approval History */}
                {(cr.approvals?.admin?.approved !== undefined ||
                  cr.approvals?.leadReader?.approved !== undefined) && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Approval History
                    </p>
                    {cr.approvals?.admin?.approved !== undefined && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                        <User className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {cr.approvals.admin.userName || 'Admin'}
                            <span
                              className={`ml-2 text-xs ${
                                cr.approvals.admin.approved
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {cr.approvals.admin.approved
                                ? 'Approved'
                                : 'Denied'}
                            </span>
                          </p>
                          {cr.approvals.admin.comments && (
                            <p className="text-sm text-gray-600 mt-1">
                              {cr.approvals.admin.comments}
                            </p>
                          )}
                          {cr.approvals.admin.approvedAt && (
                            <p className="text-xs text-gray-400 mt-1">
                              {format(
                                new Date(cr.approvals.admin.approvedAt),
                                'MMM d, yyyy h:mm a'
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {cr.approvals?.leadReader?.approved !== undefined && (
                      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded">
                        <User className="w-4 h-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {cr.approvals.leadReader.userName || 'Lead Reader'}
                            <span
                              className={`ml-2 text-xs ${
                                cr.approvals.leadReader.approved
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {cr.approvals.leadReader.approved
                                ? 'Approved'
                                : 'Denied'}
                            </span>
                          </p>
                          {cr.approvals.leadReader.comments && (
                            <p className="text-sm text-gray-600 mt-1">
                              {cr.approvals.leadReader.comments}
                            </p>
                          )}
                          {cr.approvals.leadReader.approvedAt && (
                            <p className="text-xs text-gray-400 mt-1">
                              {format(
                                new Date(cr.approvals.leadReader.approvedAt),
                                'MMM d, yyyy h:mm a'
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {canTakeAction(cr) && (
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionModal({ id: cr._id, action: 'approve' });
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionModal({ id: cr._id, action: 'deny' });
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4" />
                      Deny
                    </button>
                  </div>
                )}

                {hasApproved(cr) && cr.status === 'pending' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700">
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      You have approved this request. Waiting for{' '}
                      {userRole === 'admin' ? 'lead reader' : 'admin'} approval.
                    </p>
                  </div>
                )}

                {hasDenied(cr) && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">
                      <XCircle className="w-4 h-4 inline mr-2" />
                      You have denied this request.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              {actionModal.action === 'approve'
                ? 'Approve Change Request'
                : 'Deny Change Request'}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {actionModal.action === 'approve'
                  ? 'Comments (optional)'
                  : 'Reason for Denial *'}
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder={
                  actionModal.action === 'approve'
                    ? 'Add any comments...'
                    : 'Please provide a reason for denying this request...'
                }
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                required={actionModal.action === 'deny'}
              />
            </div>

            {(approveMutation.isError || denyMutation.isError) && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <span>Failed to submit. Please try again.</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setActionModal(null);
                  setComments('');
                }}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={
                  (actionModal.action === 'deny' && !comments) ||
                  approveMutation.isPending ||
                  denyMutation.isPending
                }
                className={`flex items-center gap-2 px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  actionModal.action === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {(approveMutation.isPending || denyMutation.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {actionModal.action === 'approve' ? 'Approve' : 'Deny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChangeRequestsList;
