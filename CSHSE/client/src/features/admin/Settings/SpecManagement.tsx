import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  CheckCircle,
  Archive,
  Clock,
  Building2,
  AlertCircle,
  Upload,
  X,
  Download,
  Brain,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';

interface Spec {
  _id: string;
  name: string;
  version: string;
  description?: string;
  documentUrl?: string;
  documentFileId?: string;
  standardsCount: number;
  status: 'active' | 'archived' | 'draft';
  uploadedAt: string;
  uploadedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  // AI Loading status
  aiLoadingStatus?: 'not_loaded' | 'loading' | 'loaded' | 'error';
  aiLoadedAt?: string;
  aiLoadError?: string;
  createdAt: string;
  updatedAt: string;
}

interface UploadedFile {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export function SpecManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    version: '',
    description: '',
    documentUrl: '',
    documentFileId: '',
    standardsCount: 21
  });

  // Fetch specs
  const { data: specsData, isLoading, error: fetchError } = useQuery({
    queryKey: ['specs-management'],
    queryFn: async () => {
      const response = await api.get('/api/specs');
      return response.data;
    }
  });

  // Create spec mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post('/api/specs', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
      setShowCreateModal(false);
      setError(null);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create spec');
    }
  });

  // Update spec mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/api/specs/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
      setEditingSpec(null);
      setError(null);
      resetForm();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update spec');
    }
  });

  // Archive spec mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/specs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to archive spec');
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      version: '',
      description: '',
      documentUrl: '',
      documentFileId: '',
      standardsCount: 21
    });
    setSelectedFile(null);
    setUploadedFile(null);
  };

  // Upload file to MongoDB
  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const uploadData = new FormData();
      uploadData.append('file', selectedFile);
      uploadData.append('category', 'spec_document');
      uploadData.append('description', `Spec document for ${formData.name || 'New Spec'}`);

      const response = await api.post('/api/files', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const file = response.data.file;
      setUploadedFile(file);
      setFormData(prev => ({ ...prev, documentFileId: file._id }));
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setSelectedFile(null);
    setFormData(prev => ({ ...prev, documentFileId: '' }));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleCreate = () => {
    // Validate: if a file is selected but not uploaded, show error
    if (selectedFile && !uploadedFile) {
      setError('Please upload the selected file before creating the spec, or remove it.');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleUpdate = () => {
    // Validate: if a file is selected but not uploaded, show error
    if (selectedFile && !uploadedFile) {
      setError('Please upload the selected file before updating the spec, or remove it.');
      return;
    }
    if (editingSpec) {
      updateMutation.mutate({
        id: editingSpec._id,
        data: formData
      });
    }
  };

  const openEditModal = (spec: Spec) => {
    setEditingSpec(spec);
    setFormData({
      name: spec.name,
      version: spec.version,
      description: spec.description || '',
      documentUrl: spec.documentUrl || '',
      documentFileId: spec.documentFileId || '',
      standardsCount: spec.standardsCount
    });
    // Clear file states when editing
    setSelectedFile(null);
    setUploadedFile(null);
  };

  const specs: Spec[] = specsData?.specs || [];

  const filteredSpecs = specs.filter(spec =>
    spec.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    spec.version.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeSpecs = filteredSpecs.filter(s => s.status === 'active');
  const archivedSpecs = filteredSpecs.filter(s => s.status === 'archived');

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-gray-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Spec Documents</h2>
              <p className="text-sm text-gray-500">
                Manage accreditation spec documents and versions
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setError(null);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Spec
          </button>
        </div>

        {/* Search */}
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search specs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Spec List */}
        <div className="divide-y divide-gray-100">
          {filteredSpecs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No specs found</p>
              <p className="text-sm mt-1">Add your first spec document to get started</p>
            </div>
          ) : (
            <>
              {/* Active Specs */}
              {activeSpecs.length > 0 && (
                <div>
                  <div className="px-6 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Specs ({activeSpecs.length})
                  </div>
                  {activeSpecs.map((spec) => (
                    <SpecRow
                      key={spec._id}
                      spec={spec}
                      onEdit={openEditModal}
                      onArchive={() => archiveMutation.mutate(spec._id)}
                      isArchiving={archiveMutation.isPending}
                    />
                  ))}
                </div>
              )}

              {/* Archived Specs */}
              {archivedSpecs.length > 0 && (
                <div>
                  <div className="px-6 py-2 bg-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Archived Specs ({archivedSpecs.length})
                  </div>
                  {archivedSpecs.map((spec) => (
                    <SpecRow
                      key={spec._id}
                      spec={spec}
                      onEdit={openEditModal}
                      onArchive={() => {}}
                      isArchiving={false}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSpec) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingSpec ? 'Edit Spec' : 'Add New Spec'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Spec Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., CSHSE Standards"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version *
                  </label>
                  <input
                    type="text"
                    value={formData.version}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="e.g., 2024"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Standards Count
                  </label>
                  <input
                    type="number"
                    value={formData.standardsCount}
                    onChange={(e) => setFormData({ ...formData, standardsCount: parseInt(e.target.value) || 21 })}
                    min="1"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="Brief description of this spec version..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.documentUrl}
                    onChange={(e) => setFormData({ ...formData, documentUrl: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    External link to the spec document (e.g., Google Docs)
                  </p>
                </div>

                {/* File Upload Section */}
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Upload Document (optional)
                  </label>

                  {/* Show uploaded file info */}
                  {(uploadedFile || formData.documentFileId) && (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-green-800">
                            {uploadedFile?.originalName || 'Document uploaded'}
                          </p>
                          {uploadedFile && (
                            <p className="text-xs text-green-600">
                              {formatFileSize(uploadedFile.size)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={`/api/files/${formData.documentFileId || uploadedFile?._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 text-green-600 hover:text-green-800"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={handleRemoveFile}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* File input and upload button */}
                  {!uploadedFile && !formData.documentFileId && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                        />
                        {selectedFile && (
                          <button
                            type="button"
                            onClick={handleFileUpload}
                            disabled={isUploading}
                            className="flex items-center gap-1 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                          >
                            {isUploading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Upload className="w-4 h-4" />
                            )}
                            Upload
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        Supported: PDF, Word, Excel, PowerPoint (max 50MB)
                      </p>
                      {/* Warning if file selected but not uploaded */}
                      {selectedFile && !uploadedFile && (
                        <div className="flex items-center gap-1 text-amber-600 text-xs mt-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Click "Upload" to save the file before creating the spec</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingSpec(null);
                  setError(null);
                  resetForm();
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={editingSpec ? handleUpdate : handleCreate}
                disabled={
                  !formData.name ||
                  !formData.version ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editingSpec ? 'Save Changes' : 'Create Spec'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface SpecRowProps {
  spec: Spec;
  onEdit: (spec: Spec) => void;
  onArchive: () => void;
  isArchiving: boolean;
}

function SpecRow({ spec, onEdit, onArchive, isArchiving }: SpecRowProps) {
  const queryClient = useQueryClient();
  const [showInstitutions, setShowInstitutions] = useState(false);
  const { data: institutionsData } = useQuery({
    queryKey: ['spec-institutions', spec._id],
    queryFn: async () => {
      const response = await api.get(`/api/specs/${spec._id}/institutions`);
      return response.data;
    },
    enabled: showInstitutions
  });

  // Load to AI mutation
  const loadToAIMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/specs/${spec._id}/load-to-ai`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to load spec to AI');
    }
  });

  // Reset AI status mutation (cancel/retry)
  const resetAIStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/specs/${spec._id}/reset-ai-status`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to reset AI status');
    }
  });

  const aiStatus = spec.aiLoadingStatus || 'not_loaded';

  // Poll for AI status when loading
  const { data: aiStatusData } = useQuery({
    queryKey: ['spec-ai-status', spec._id],
    queryFn: async () => {
      const response = await api.get(`/api/specs/${spec._id}/ai-status`);
      return response.data;
    },
    enabled: aiStatus === 'loading',
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // When polled status changes from loading, refresh the specs list
  useEffect(() => {
    if (aiStatusData?.aiLoadingStatus && aiStatusData.aiLoadingStatus !== 'loading') {
      queryClient.invalidateQueries({ queryKey: ['specs-management'] });
      queryClient.invalidateQueries({ queryKey: ['specs'] });
    }
  }, [aiStatusData?.aiLoadingStatus, queryClient]);
  const canLoadToAI = spec.documentFileId && spec.status !== 'archived';
  const isLoading = aiStatus === 'loading' || loadToAIMutation.isPending;
  const isResetting = resetAIStatusMutation.isPending;

  return (
    <div className="p-6 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-medium text-gray-900">
              {spec.name}
            </h3>
            <span className="px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
              v{spec.version}
            </span>
            {spec.status === 'archived' && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full flex items-center gap-1">
                <Archive className="w-3 h-3" />
                Archived
              </span>
            )}
          </div>

          {spec.description && (
            <p className="text-sm text-gray-600 mt-1">{spec.description}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              {spec.standardsCount} standards
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Added {format(new Date(spec.createdAt), 'MMM d, yyyy')}
            </span>
            {spec.uploadedBy && (
              <span className="text-gray-400">
                by {spec.uploadedBy.firstName} {spec.uploadedBy.lastName}
              </span>
            )}
            {/* Document links */}
            {spec.documentFileId && (
              <a
                href={`/api/files/${spec.documentFileId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-teal-600 hover:text-teal-700"
              >
                <Download className="w-4 h-4" />
                Download Document
              </a>
            )}
            {spec.documentUrl && (
              <a
                href={spec.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
              >
                <FileText className="w-4 h-4" />
                View External Link
              </a>
            )}
          </div>

          {/* Institutions using this spec */}
          <div className="mt-3">
            <button
              onClick={() => setShowInstitutions(!showInstitutions)}
              className="text-sm text-teal-600 hover:text-teal-700 flex items-center gap-1"
            >
              <Building2 className="w-4 h-4" />
              {showInstitutions ? 'Hide' : 'Show'} institutions using this spec
            </button>

            {showInstitutions && institutionsData && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                {institutionsData.institutions.length === 0 ? (
                  <p className="text-sm text-gray-500">No institutions are using this spec</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {institutionsData.institutions.map((inst: any) => (
                      <li key={inst._id} className="text-gray-700">
                        {inst.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Load to AI Button */}
          {canLoadToAI && (
            <>
              {aiStatus === 'loaded' ? (
                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                  <CheckCircle className="w-3 h-3" />
                  Loaded
                </span>
              ) : aiStatus === 'error' ? (
                <button
                  onClick={() => loadToAIMutation.mutate()}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs disabled:opacity-50"
                  title={spec.aiLoadError || 'Error loading to AI'}
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  Retry
                </button>
              ) : isLoading ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading...
                  </span>
                  <button
                    onClick={() => resetAIStatusMutation.mutate()}
                    disabled={isResetting}
                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Cancel loading and reset"
                  >
                    {isResetting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => loadToAIMutation.mutate()}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-xs disabled:opacity-50"
                  title="Load specification document to AI for intelligent matching"
                >
                  <Brain className="w-3 h-3" />
                  Load To AI
                </button>
              )}
            </>
          )}
          <button
            onClick={() => onEdit(spec)}
            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {spec.status !== 'archived' && (
            <button
              onClick={onArchive}
              disabled={isArchiving}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
              title="Archive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SpecManagement;
