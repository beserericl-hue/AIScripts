import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, Loader2, Building2, CheckCircle, HardDrive, Search, Zap } from 'lucide-react';
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

interface GridFsStats {
  htmlContent: {
    fileCount: number;
    totalSizeBytes: number;
    totalSizeMB: number;
  };
}

interface CleanupResult {
  success: boolean;
  dryRun: boolean;
  message: string;
  orphanedHtmlFiles: number;
  orphanedImageFiles: number;
  totalBytesFreed: number;
  totalMBFreed: number;
  orphanedImportIds: string[];
}

export function DataManagement() {
  const queryClient = useQueryClient();
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // GridFS state
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);

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

  // Fetch GridFS stats
  const { data: gridFsStats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['gridfs-stats'],
    queryFn: async () => {
      const response = await api.get('/api/admin/gridfs/stats');
      return response.data as GridFsStats;
    }
  });

  // GridFS cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const response = await api.post(`/api/admin/gridfs/cleanup${dryRun ? '?dryRun=true' : ''}`);
      return response.data as CleanupResult;
    },
    onSuccess: (result) => {
      setCleanupResult(result);
      if (!result.dryRun) {
        // Refresh stats after actual cleanup
        refetchStats();
      }
    },
    onError: (error: any) => {
      console.error('Cleanup failed:', error);
      alert(error.response?.data?.error || 'Failed to cleanup orphaned files');
    }
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

      {/* GridFS Storage Management */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-6 h-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Document Storage (GridFS)</h3>
            <p className="text-sm text-gray-500">
              Manage uploaded HTML documents and images stored in GridFS
            </p>
          </div>
        </div>

        {/* Storage Stats */}
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-4">
          <h4 className="font-medium text-gray-900 mb-3">Current Storage Usage</h4>
          {statsLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading storage stats...
            </div>
          ) : gridFsStats ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">HTML Documents</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {gridFsStats.htmlContent.fileCount}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Size</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {gridFsStats.htmlContent.totalSizeMB.toFixed(2)} MB
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Unable to load stats</p>
          )}
        </div>

        {/* Cleanup Result */}
        {cleanupResult && (
          <div className={`p-4 rounded-lg mb-4 ${
            cleanupResult.dryRun
              ? 'bg-blue-50 border border-blue-200'
              : 'bg-green-50 border border-green-200'
          }`}>
            <div className="flex items-start gap-3">
              {cleanupResult.dryRun ? (
                <Search className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`font-medium ${cleanupResult.dryRun ? 'text-blue-800' : 'text-green-800'}`}>
                  {cleanupResult.dryRun ? 'Scan Complete (Preview)' : 'Cleanup Complete'}
                </p>
                <p className={`text-sm mt-1 ${cleanupResult.dryRun ? 'text-blue-700' : 'text-green-700'}`}>
                  {cleanupResult.message}
                </p>
                {cleanupResult.orphanedHtmlFiles > 0 || cleanupResult.orphanedImageFiles > 0 ? (
                  <div className="mt-2 text-sm">
                    <p className={cleanupResult.dryRun ? 'text-blue-600' : 'text-green-600'}>
                      • {cleanupResult.orphanedHtmlFiles} orphaned HTML file(s)
                    </p>
                    <p className={cleanupResult.dryRun ? 'text-blue-600' : 'text-green-600'}>
                      • {cleanupResult.orphanedImageFiles} orphaned image file(s)
                    </p>
                    <p className={cleanupResult.dryRun ? 'text-blue-600' : 'text-green-600'}>
                      • {cleanupResult.totalMBFreed.toFixed(2)} MB {cleanupResult.dryRun ? 'can be freed' : 'freed'}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-600">No orphaned files found.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cleanup Actions */}
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Orphaned files are GridFS documents whose associated import record has been deleted.
            These files consume storage but are no longer accessible.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => cleanupMutation.mutate(true)}
              disabled={cleanupMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cleanupMutation.isPending && cleanupMutation.variables === true ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Scan for Orphaned Files
                </>
              )}
            </button>

            {cleanupResult && cleanupResult.dryRun && (cleanupResult.orphanedHtmlFiles > 0 || cleanupResult.orphanedImageFiles > 0) && (
              <button
                onClick={() => setShowCleanupConfirm(true)}
                disabled={cleanupMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4" />
                Delete Orphaned Files
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cleanup Confirmation Modal */}
      {showCleanupConfirm && cleanupResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-[480px] max-w-[90vw]">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full">
                <HardDrive className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Orphaned Files
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will permanently delete orphaned GridFS files
                </p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                This will delete:
              </p>
              <ul className="text-sm text-amber-700 mt-2 list-disc list-inside">
                <li>{cleanupResult.orphanedHtmlFiles} orphaned HTML document(s)</li>
                <li>{cleanupResult.orphanedImageFiles} orphaned image file(s)</li>
                <li>{cleanupResult.totalMBFreed.toFixed(2)} MB of storage will be freed</li>
              </ul>
              <p className="text-sm text-amber-600 mt-2">
                These files are no longer associated with any import and cannot be recovered.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCleanupConfirm(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCleanupConfirm(false);
                  cleanupMutation.mutate(false);
                }}
                disabled={cleanupMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cleanupMutation.isPending ? (
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
