import React, { useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  X,
  Upload,
  FileText,
  Image,
  File,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface FileUploadProps {
  submissionId: string;
  standardCode?: string;
  specCode?: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * File upload component with drag-and-drop support
 */
export function FileUpload({
  submissionId,
  standardCode,
  specCode,
  onClose,
  onSuccess,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: UploadFile) => {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      if (standardCode) formData.append('standardCode', standardCode);
      if (specCode) formData.append('specCode', specCode);
      if (description) formData.append('description', description);

      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/evidence/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setFiles((prev) =>
              prev.map((f) =>
                f.id === uploadFile.id ? { ...f, progress } : f
              )
            );
          },
        }
      );
      return response.data;
    },
    onSuccess: (_, uploadFile) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
        )
      );
    },
    onError: (error: any, uploadFile) => {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'error', error: error.message || 'Upload failed' }
            : f
        )
      );
    },
  });

  // Validate file
  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'File type not supported';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 50MB limit';
    }
    return null;
  };

  // Add files
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const uploadFiles: UploadFile[] = fileArray.map((file) => {
      const error = validateFile(file);
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        status: error ? 'error' : 'pending',
        progress: 0,
        error: error || undefined,
      } as UploadFile;
    });

    setFiles((prev) => [...prev, ...uploadFiles]);
  }, []);

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  // Remove file
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Upload all files
  const handleUploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    for (const file of pendingFiles) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, status: 'uploading' } : f
        )
      );
      await uploadMutation.mutateAsync(file);
    }
    onSuccess();
  };

  // Get file icon
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="w-8 h-8 text-purple-500" />;
    }
    if (file.type.includes('pdf')) {
      return <FileText className="w-8 h-8 text-red-500" />;
    }
    if (file.type.includes('word')) {
      return <FileText className="w-8 h-8 text-blue-500" />;
    }
    if (file.type.includes('powerpoint') || file.type.includes('presentation')) {
      return <FileText className="w-8 h-8 text-orange-500" />;
    }
    return <File className="w-8 h-8 text-gray-500" />;
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const uploadingCount = files.filter((f) => f.status === 'uploading').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upload Evidence</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${
                isDragging
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
              }
            `}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports PDF, Word, PowerPoint, Excel, and images (max 50MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Description */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the uploaded files"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-700">
                Files ({files.length})
              </h3>
              {files.map((uploadFile) => (
                <div
                  key={uploadFile.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    uploadFile.status === 'error'
                      ? 'bg-red-50 border-red-200'
                      : uploadFile.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  {getFileIcon(uploadFile.file)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatSize(uploadFile.file.size)}
                    </p>
                    {uploadFile.status === 'uploading' && (
                      <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${uploadFile.progress}%` }}
                        />
                      </div>
                    )}
                    {uploadFile.error && (
                      <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadFile.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                    )}
                    {uploadFile.status === 'success' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {uploadFile.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    {uploadFile.status !== 'uploading' && (
                      <button
                        onClick={() => removeFile(uploadFile.id)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUploadAll}
            disabled={pendingCount === 0 || uploadingCount > 0}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploadingCount > 0 ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {pendingCount} File{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FileUpload;
