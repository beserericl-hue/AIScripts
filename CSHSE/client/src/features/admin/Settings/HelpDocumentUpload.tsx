import React, { useState, useRef } from 'react';
import { api } from '../../../services/api';
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  HelpCircle,
  Trash2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface UploadedDoc {
  fileName: string;
  source: string;
  uploadedAt: string;
  fileSize: number;
}

export function HelpDocumentUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('helpDocsUploaded') || '[]');
    } catch { return []; }
  });
  const [selectedSource, setSelectedSource] = useState('handbook');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveUploadedDocs = (docs: UploadedDoc[]) => {
    setUploadedDocs(docs);
    localStorage.setItem('helpDocsUploaded', JSON.stringify(docs));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', selectedSource);
      formData.append('title', file.name);

      const response = await api.post(`${API_BASE}/webhooks/help/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000
      });

      setUploadResult({ success: true, message: response.data.message || 'Document uploaded successfully' });

      const newDoc: UploadedDoc = {
        fileName: file.name,
        source: selectedSource,
        uploadedAt: new Date().toISOString(),
        fileSize: file.size
      };
      saveUploadedDocs([newDoc, ...uploadedDocs]);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to upload document';
      setUploadResult({ success: false, message: msg });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeDoc = (index: number) => {
    const updated = uploadedDocs.filter((_, i) => i !== index);
    saveUploadedDocs(updated);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-6 h-6 text-gray-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Help Document Upload</h2>
            <p className="text-sm text-gray-500">
              Upload documents to the AI help chat knowledge base. Supported formats: PDF, Markdown (.md), and plain text.
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Upload New Document</h3>

        <div className="space-y-4">
          {/* Source selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="handbook">CSHSE Member Handbook</option>
              <option value="user_guide">User Guide / Readme</option>
              <option value="reference">Reference Document</option>
            </select>
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
                accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
                onChange={handleUpload}
                disabled={uploading}
                className="block w-full max-w-md text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 disabled:opacity-50"
              />
              {uploading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading and processing...
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              The file will be chunked, vectorized, and stored in the AI knowledge base.
            </p>
          </div>

          {/* Upload result */}
          {uploadResult && (
            <div className={`p-4 rounded-lg flex items-start gap-3 ${
              uploadResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {uploadResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${uploadResult.success ? 'text-green-800' : 'text-red-800'}`}>
                {uploadResult.message}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Uploaded Documents List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Uploaded Documents ({uploadedDocs.length})
        </h3>

        {uploadedDocs.length === 0 ? (
          <div className="text-center py-8">
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No documents uploaded yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Upload the CSHSE Member Handbook and User Guide to enable the help chat.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {uploadedDocs.map((doc, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{doc.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {doc.source === 'handbook' ? 'Handbook' : doc.source === 'user_guide' ? 'User Guide' : 'Reference'}
                      {' · '}
                      {formatFileSize(doc.fileSize)}
                      {' · '}
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeDoc(index)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Remove from list"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Note: Removing a document from this list does not delete it from the vector database.
          To clear the vector database, contact the system administrator.
        </p>
      </div>
    </div>
  );
}
