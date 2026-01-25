import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Lock,
  Unlock,
  AlertTriangle,
  FileEdit,
  CheckCircle,
  Loader2,
  Send
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface LockStatus {
  isLocked: boolean;
  canEdit: boolean;
  lockMessage: string;
  lockDetails: {
    isLocked: boolean;
    lockedBy?: string;
    lockedByName?: string;
    lockedByRole?: 'reader' | 'lead_reader';
    lockedAt?: string;
    lockReason?: 'reader_review' | 'lead_reader_review' | 'sent_back_for_correction';
    sentBackAt?: string;
    sentBackReason?: string;
  };
}

interface ReaderLockedBannerProps {
  submissionId: string;
  currentUserRole: 'reader' | 'lead_reader' | 'program_coordinator' | 'admin';
  onLockStatusChange?: (status: LockStatus) => void;
}

export function ReaderLockedBanner({
  submissionId,
  currentUserRole,
  onLockStatusChange
}: ReaderLockedBannerProps) {
  const queryClient = useQueryClient();
  const [sendBackReason, setSendBackReason] = React.useState('');
  const [showSendBackModal, setShowSendBackModal] = React.useState(false);

  // Fetch lock status
  const { data: lockStatus, isLoading } = useQuery<LockStatus>({
    queryKey: ['lock-status', submissionId],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/lock`
      );
      return response.data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Notify parent of lock status changes
  React.useEffect(() => {
    if (lockStatus) {
      onLockStatusChange?.(lockStatus);
    }
  }, [lockStatus, onLockStatusChange]);

  // Lock submission mutation
  const lockMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `${API_BASE}/submissions/${submissionId}/lock`,
        { reason: currentUserRole === 'lead_reader' ? 'lead_reader_review' : 'reader_review' }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lock-status', submissionId] });
    }
  });

  // Unlock submission mutation
  const unlockMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.delete(
        `${API_BASE}/submissions/${submissionId}/lock`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lock-status', submissionId] });
    }
  });

  // Send back for correction mutation
  const sendBackMutation = useMutation({
    mutationFn: async (reason: string) => {
      const response = await axios.post(
        `${API_BASE}/submissions/${submissionId}/send-back`,
        { reason }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lock-status', submissionId] });
      setShowSendBackModal(false);
      setSendBackReason('');
    }
  });

  // Clear sent back status mutation
  const clearSentBackMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(
        `${API_BASE}/submissions/${submissionId}/clear-sent-back`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lock-status', submissionId] });
    }
  });

  if (isLoading) {
    return null;
  }

  if (!lockStatus) {
    return null;
  }

  const { isLocked, canEdit, lockMessage, lockDetails } = lockStatus;
  const isReaderOrLeadReader = currentUserRole === 'reader' || currentUserRole === 'lead_reader';
  const isProgramCoordinator = currentUserRole === 'program_coordinator';
  const isSentBack = lockDetails.lockReason === 'sent_back_for_correction';

  // Program Coordinator view when locked
  if (isProgramCoordinator && isLocked) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <Lock className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 text-lg">
              Reader Locked
            </h3>
            <p className="text-amber-700 mt-1">
              {lockMessage}
            </p>
            <p className="text-sm text-amber-600 mt-2">
              Locked by: {lockDetails.lockedByName} ({lockDetails.lockedByRole === 'lead_reader' ? 'Lead Reader' : 'Reader'})
              {lockDetails.lockedAt && (
                <> on {new Date(lockDetails.lockedAt).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Program Coordinator view when sent back for correction
  if (isProgramCoordinator && isSentBack) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-orange-800 text-lg">
              Corrections Requested
            </h3>
            <p className="text-orange-700 mt-1">
              The reviewer has requested corrections to this self-study.
            </p>
            {lockDetails.sentBackReason && (
              <div className="mt-3 p-3 bg-white border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-800">Reason:</p>
                <p className="text-sm text-orange-700 mt-1">{lockDetails.sentBackReason}</p>
              </div>
            )}
            <p className="text-sm text-orange-600 mt-2">
              Sent back on: {lockDetails.sentBackAt && new Date(lockDetails.sentBackAt).toLocaleDateString()}
            </p>
            <button
              onClick={() => clearSentBackMutation.mutate()}
              disabled={clearSentBackMutation.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {clearSentBackMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Submit Corrections
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reader/Lead Reader view - controls to lock/unlock and send back
  if (isReaderOrLeadReader) {
    return (
      <>
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLocked ? (
                <Lock className="w-5 h-5 text-teal-600" />
              ) : (
                <Unlock className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <h3 className="font-medium text-gray-900">
                  Review Lock Status
                </h3>
                <p className="text-sm text-gray-500">
                  {isLocked
                    ? 'Submission is locked. Program coordinator cannot make changes.'
                    : 'Submission is unlocked. Program coordinator can make changes.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Lock/Unlock Button */}
              {isLocked ? (
                <button
                  onClick={() => unlockMutation.mutate()}
                  disabled={unlockMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {unlockMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  Unlock
                </button>
              ) : (
                <button
                  onClick={() => lockMutation.mutate()}
                  disabled={lockMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {lockMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Start Review (Lock)
                </button>
              )}

              {/* Send Back Button */}
              <button
                onClick={() => setShowSendBackModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50"
              >
                <Send className="w-4 h-4" />
                Send Back for Correction
              </button>
            </div>
          </div>
        </div>

        {/* Send Back Modal */}
        {showSendBackModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <FileEdit className="w-6 h-6 text-orange-600" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Send Back for Correction
                  </h3>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  This will unlock the submission and notify the program coordinator
                  that corrections are needed.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Correction *
                  </label>
                  <textarea
                    value={sendBackReason}
                    onChange={(e) => setSendBackReason(e.target.value)}
                    placeholder="Describe what needs to be corrected..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    rows={4}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => {
                    setShowSendBackModal(false);
                    setSendBackReason('');
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  onClick={() => sendBackMutation.mutate(sendBackReason)}
                  disabled={!sendBackReason.trim() || sendBackMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendBackMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Send Back
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export default ReaderLockedBanner;
