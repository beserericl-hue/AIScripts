import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, Loader2, Building2, CheckCircle } from 'lucide-react';
import { api } from '../../../services/api';

interface Institution {
  _id: string;
  name: string;
  type: string;
}

interface Submission {
  _id: string;
  submissionId: string;
  programName: string;
  status: string;
  createdAt: string;
}

export function DataManagement() {
  const queryClient = useQueryClient();
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Fetch all institutions
  const { data: institutions, isLoading: institutionsLoading } = useQuery({
    queryKey: ['institutions-all'],
    queryFn: async () => {
      const response = await api.get('/api/institutions');
      return response.data.institutions as Institution[];
    }
  });

  // Fetch submissions for selected institution
  const { data: submissions, isLoading: submissionsLoading } = useQuery({
    queryKey: ['institution-submissions', selectedInstitutionId],
    queryFn: async () => {
      const response = await api.get(`/api/submissions?institutionId=${selectedInstitutionId}`);
      return response.data.submissions as Submission[];
    },
    enabled: !!selectedInstitutionId
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (institutionId: string) => {
      const response = await api.delete(`/api/admin/institution-data/${institutionId}`);
      return response.data;
    },
    onSuccess: () => {
      setDeleteSuccess(true);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setSelectedInstitutionId('');
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['institution-submissions'] });
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      // Reset success message after 3 seconds
      setTimeout(() => setDeleteSuccess(false), 3000);
    },
    onError: (error: any) => {
      console.error('Delete failed:', error);
      alert(error.response?.data?.error || 'Failed to delete self-study data');
    }
  });

  const selectedInstitution = institutions?.find(i => i._id === selectedInstitutionId);

  const handleDeleteClick = () => {
    if (!selectedInstitutionId) return;
    setShowDeleteConfirm(true);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmText !== 'Delete' || !selectedInstitutionId) return;
    deleteMutation.mutate(selectedInstitutionId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Data Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Delete self-study data for testing and cleanup purposes. This action is irreversible.
        </p>
      </div>

      {/* Success Message */}
      {deleteSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-700">Self-study data has been successfully deleted.</p>
        </div>
      )}

      {/* Warning Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800">Caution: Destructive Action</p>
          <p className="text-sm text-amber-700 mt-1">
            Deleting self-study data will permanently remove all submissions, narratives,
            imports, and associated data for the selected institution. This cannot be undone.
          </p>
        </div>
      </div>

      {/* Institution Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Self-Study Data</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Institution
            </label>
            {institutionsLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading institutions...
              </div>
            ) : (
              <select
                value={selectedInstitutionId}
                onChange={(e) => {
                  setSelectedInstitutionId(e.target.value);
                  setDeleteSuccess(false);
                }}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">-- Select a university or college --</option>
                {institutions?.map((inst) => (
                  <option key={inst._id} value={inst._id}>
                    {inst.name} ({inst.type})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Show submissions count if institution selected */}
          {selectedInstitutionId && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{selectedInstitution?.name}</span>
              </div>
              {submissionsLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading submissions...
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <p>
                    <strong>{submissions?.length || 0}</strong> submission(s) will be deleted
                  </p>
                  {submissions && submissions.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {submissions.slice(0, 5).map((sub) => (
                        <li key={sub._id} className="text-gray-500">
                          - {sub.programName} ({sub.status})
                        </li>
                      ))}
                      {submissions.length > 5 && (
                        <li className="text-gray-400">
                          ... and {submissions.length - 5} more
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Delete Button */}
          <button
            onClick={handleDeleteClick}
            disabled={!selectedInstitutionId || deleteMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
            Delete Self-Study Data
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[480px] max-w-[90vw]">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Self-Study Data
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  for {selectedInstitution?.name}
                </p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                This will permanently delete:
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                <li>All self-study submissions ({submissions?.length || 0})</li>
                <li>All narrative content and imports</li>
                <li>All curriculum matrix data</li>
                <li>All supporting evidence</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-bold text-red-600">Delete</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type 'Delete' here"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteConfirmText !== 'Delete' || deleteMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
