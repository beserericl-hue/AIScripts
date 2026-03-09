import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Upload,
  Loader2,
  AlertCircle,
  FileText,
  FolderOpen,
  Trash2,
  Download,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface SpecOption {
  _id: string;
  name: string;
  version: string;
  status: string;
}

interface DashboardFile {
  _id: string;
  originalName: string;
  mimeType: string;
  size: number;
  relatedEntityId?: string;
  relatedEntityType?: string;
  description?: string;
  createdAt: string;
}

export function DashboardFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedSpecId, setSelectedSpecId] = useState('');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Fetch active specs for the dropdown
  const { data: specsData } = useQuery({
    queryKey: ['specs-active'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/specs`, { params: { status: 'active' } });
      return response.data;
    },
  });

  const specs: SpecOption[] = specsData?.specs || [];

  // Fetch dashboard files
  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['dashboard-files'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/files`, {
        params: { category: 'dashboard_document', limit: 100 },
      });
      return response.data;
    },
  });

  const dashboardFiles: DashboardFile[] = filesData?.files || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${API_BASE}/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-files'] });
    },
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedSpecId) {
      setUploadError('Please select a specification/degree type first.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'dashboard_document');
      formData.append('relatedEntityId', selectedSpecId);
      formData.append('relatedEntityType', 'Spec');
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      await api.post(`${API_BASE}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      queryClient.invalidateQueries({ queryKey: ['dashboard-files'] });
      setDescription('');
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to upload file';
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const response = await api.get(`${API_BASE}/files/${fileId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download file:', err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getSpecLabel = (specId?: string) => {
    if (!specId) return 'Unassigned';
    const spec = specs.find((s) => s._id === specId);
    return spec ? `${spec.name} v${spec.version}` : specId;
  };

  // Group files by spec
  const filesBySpec = dashboardFiles.reduce<Record<string, DashboardFile[]>>((acc, file) => {
    const key = file.relatedEntityId || 'unassigned';
    if (!acc[key]) acc[key] = [];
    acc[key].push(file);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-6 h-6 text-gray-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Dashboard Files</h2>
            <p className="text-sm text-gray-500">
              Upload specification documents and curriculum matrices that appear on the Program Coordinator dashboard.
              Files are linked to a degree type and shown based on the institution's assigned spec.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Upload New File</h3>

        <div className="space-y-4">
          {/* Spec/Degree selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specification / Degree Type
            </label>
            <select
              value={selectedSpecId}
              onChange={(e) => setSelectedSpecId(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a specification...</option>
              {specs.map((spec) => (
                <option key={spec._id} value={spec._id}>
                  {spec.name} v{spec.version}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Curriculum Matrix, Accreditation Standards"
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          {/* File picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ps,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/postscript"
                onChange={handleUpload}
                disabled={uploading}
                className="block w-full max-w-md text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50"
              />
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Supported: PDF, Word, PostScript, Excel, CSV. These files will appear in the dashboard for Program Coordinators.
            </p>
          </div>

          {/* Error banner */}
          {uploadError && (
            <div className="p-4 rounded-lg flex items-start gap-3 bg-red-50 border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{uploadError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Files List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Dashboard Files ({dashboardFiles.length})
        </h3>

        {filesLoading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading files...</span>
          </div>
        ) : dashboardFiles.length === 0 ? (
          <div className="text-center py-8">
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No dashboard files uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload specification documents and curriculum matrices for each degree type.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(filesBySpec).map(([specId, files]) => (
              <div key={specId}>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {getSpecLabel(specId === 'unassigned' ? undefined : specId)}
                </h4>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div key={file._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{file.originalName}</p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(file.size)}
                            {' · '}
                            {new Date(file.createdAt).toLocaleDateString()}
                            {file.description && (
                              <>
                                {' · '}
                                {file.description}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownload(file._id, file.originalName)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(file._id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
