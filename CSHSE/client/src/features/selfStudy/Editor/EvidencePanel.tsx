import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Paperclip,
  Link2,
  FileText,
  Download,
  Trash2,
  Plus,
  X,
  Loader2,
  ExternalLink,
  File,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Evidence {
  _id: string;
  evidenceType: 'document' | 'url' | 'image';
  // URL evidence (object from MongoDB)
  url?: {
    href: string;
    title: string;
    description?: string;
  };
  // File evidence
  file?: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    storageType?: 'base64' | 's3';
  };
  metadata?: {
    description?: string;
  };
  description?: string;
  versionNumber?: number;
  createdAt: string;
}

interface EvidencePanelProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  readOnly?: boolean;
}

export function EvidencePanel({
  submissionId,
  standardCode,
  specCode,
  readOnly = false,
}: EvidencePanelProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlForm, setUrlForm] = useState({ url: '', title: '', description: '' });
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Staged file upload: user picks a file, then enters description before uploading
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState('');

  // Fetch evidence for this submission/spec
  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['evidence', submissionId, standardCode, specCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('standardCode', standardCode);
      params.append('specCode', specCode);
      const response = await api.get(
        `${API_BASE}/submissions/${submissionId}/evidence?${params}`
      );
      return response.data;
    },
  });

  const evidence: Evidence[] = evidenceData?.evidence || [];

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, description }: { file: File; description: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('standardCode', standardCode);
      formData.append('specCode', specCode);
      formData.append('title', file.name);
      if (description) {
        formData.append('description', description);
      }

      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/evidence/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['evidence', submissionId, standardCode, specCode],
      });
      setUploadError(null);
      setStagedFile(null);
      setFileDescription('');
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'Failed to upload file');
    },
  });

  // Add URL mutation
  const addUrlMutation = useMutation({
    mutationFn: async (data: { url: string; title: string; description?: string }) => {
      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/evidence/url`,
        {
          ...data,
          standardCode,
          specCode,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['evidence', submissionId, standardCode, specCode],
      });
      setShowUrlModal(false);
      setUrlForm({ url: '', title: '', description: '' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      await api.delete(
        `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['evidence', submissionId, standardCode, specCode],
      });
      setUploadError(null);
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'Failed to delete evidence');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStagedFile(file);
      setFileDescription('');
      setUploadError(null);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmUpload = () => {
    if (stagedFile) {
      uploadMutation.mutate({ file: stagedFile, description: fileDescription });
    }
  };

  const handleCancelUpload = () => {
    setStagedFile(null);
    setFileDescription('');
    setUploadError(null);
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlForm.url && urlForm.title) {
      addUrlMutation.mutate(urlForm);
    }
  };

  const handleDelete = (evidenceId: string, title: string) => {
    if (window.confirm(`Delete evidence "${title}"?`)) {
      deleteMutation.mutate(evidenceId);
    }
  };

  const handleDownload = (evidenceId: string) => {
    window.open(
      `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/download`,
      '_blank'
    );
  };

  const getEvidenceIcon = (item: Evidence) => {
    if (item.evidenceType === 'url') return <Link2 className="w-4 h-4" />;
    if (item.evidenceType === 'image') return <ImageIcon className="w-4 h-4" />;
    if (item.file?.mimeType?.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDescription = (item: Evidence): string | undefined => {
    return item.description || item.metadata?.description || undefined;
  };

  return (
    <div className="evidence-panel border border-gray-200 rounded-lg bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">
            Supporting Evidence
          </span>
          <span className="text-xs text-gray-500">
            ({evidence.length} item{evidence.length !== 1 ? 's' : ''})
          </span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending || !!stagedFile}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              title="Upload file"
            >
              <Plus className="w-3 h-3" />
              File
            </button>
            <button
              onClick={() => setShowUrlModal(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
              title="Add URL link"
            >
              <Link2 className="w-3 h-3" />
              URL
            </button>
          </div>
        )}
      </div>

      {/* Staged file upload form */}
      {stagedFile && (
        <div className="p-3 bg-teal-50 border-b border-teal-200">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-800 truncate">
              {stagedFile.name}
            </span>
            <span className="text-xs text-teal-600">
              ({formatFileSize(stagedFile.size)})
            </span>
          </div>
          <input
            type="text"
            value={fileDescription}
            onChange={(e) => setFileDescription(e.target.value)}
            placeholder="Short description of this file (optional)"
            className="w-full px-2 py-1.5 text-sm border border-teal-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 mb-2"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleConfirmUpload}
              disabled={uploadMutation.isPending}
              className="flex items-center gap-1 px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
            >
              {uploadMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              Upload
            </button>
            <button
              onClick={handleCancelUpload}
              disabled={uploadMutation.isPending}
              className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {uploadError && (
        <div className="p-2 text-xs text-red-600 bg-red-50 border-b border-red-200">
          {uploadError}
        </div>
      )}

      {/* Evidence list */}
      <div className="max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : evidence.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            {readOnly
              ? 'No supporting evidence for this section.'
              : 'No evidence attached yet. Upload a file or add a URL.'}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {evidence.map((item) => (
              <li
                key={item._id}
                className="flex items-center justify-between p-2 hover:bg-gray-50"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-gray-400">{getEvidenceIcon(item)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-sm text-gray-800 truncate">
                        {item.evidenceType === 'url' ? item.url?.title : item.file?.originalName || 'Untitled'}
                      </p>
                      {item.versionNumber && item.versionNumber > 1 && (
                        <span className="flex-shrink-0 text-xs px-1 py-0.5 bg-blue-100 text-blue-700 rounded">
                          v{item.versionNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {item.evidenceType === 'url'
                        ? item.url?.href
                        : [formatFileSize(item.file?.size), getDescription(item)].filter(Boolean).join(' - ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {item.evidenceType === 'url' ? (
                    <a
                      href={item.url?.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-gray-400 hover:text-teal-600"
                      title="Open link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      onClick={() => handleDownload(item._id)}
                      className="p-1 text-gray-400 hover:text-teal-600"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  {!readOnly && <button
                    onClick={() => handleDelete(item._id, item.url?.title || item.file?.originalName || 'evidence')}
                    disabled={deleteMutation.isPending}
                    className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add URL Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Add URL Evidence</h3>
              <button
                onClick={() => setShowUrlModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUrl} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  required
                  value={urlForm.url}
                  onChange={(e) =>
                    setUrlForm((f) => ({ ...f, url: e.target.value }))
                  }
                  placeholder="https://example.com/document"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={urlForm.title}
                  onChange={(e) =>
                    setUrlForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Document title"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={urlForm.description}
                  onChange={(e) =>
                    setUrlForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Brief description of this evidence"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUrlModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addUrlMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {addUrlMutation.isPending && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  Add URL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvidencePanel;
