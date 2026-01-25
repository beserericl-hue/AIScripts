import React, { useState } from 'react';
import {
  X,
  Download,
  ExternalLink,
  Link2,
  Unlink,
  FileText,
  Image,
  Loader2,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Evidence {
  _id: string;
  submissionId: string;
  standardCode?: string;
  specCode?: string;
  evidenceType: 'document' | 'url' | 'image';
  file?: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    storagePath: string;
  };
  url?: {
    href: string;
    title: string;
    description: string;
  };
  imageMetadata?: {
    sourceType: string;
    description: string;
  };
  createdAt: string;
}

interface EvidenceViewerProps {
  evidence: Evidence;
  submissionId: string;
  onClose: () => void;
  onLink: (standardCode: string, specCode: string) => void;
}

/**
 * Evidence viewer component - shows preview and metadata
 */
export function EvidenceViewer({
  evidence,
  submissionId,
  onClose,
  onLink,
}: EvidenceViewerProps) {
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkStandard, setLinkStandard] = useState(evidence.standardCode || '');
  const [linkSpec, setLinkSpec] = useState(evidence.specCode || '');

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get download URL
  const downloadUrl = `${API_BASE}/submissions/${submissionId}/evidence/${evidence._id}/download`;

  // Handle link submit
  const handleLinkSubmit = () => {
    if (linkStandard && linkSpec) {
      onLink(linkStandard, linkSpec);
      setShowLinkDialog(false);
    }
  };

  // Render preview based on evidence type
  const renderPreview = () => {
    if (evidence.evidenceType === 'url') {
      return (
        <div className="flex flex-col items-center justify-center h-64 bg-gray-100 rounded-lg">
          <ExternalLink className="w-16 h-16 text-blue-500 mb-4" />
          <a
            href={evidence.url?.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-medium text-blue-600 hover:underline"
          >
            {evidence.url?.title || evidence.url?.href}
          </a>
          <p className="text-sm text-gray-500 mt-2 max-w-md text-center">
            {evidence.url?.description}
          </p>
        </div>
      );
    }

    if (evidence.evidenceType === 'image' && evidence.file) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={downloadUrl}
            alt={evidence.file.originalName}
            className="max-h-96 object-contain"
          />
        </div>
      );
    }

    // Document preview
    if (evidence.file?.mimeType === 'application/pdf') {
      return (
        <div className="h-96 bg-gray-100 rounded-lg overflow-hidden">
          <iframe
            src={downloadUrl}
            className="w-full h-full"
            title={evidence.file.originalName}
          />
        </div>
      );
    }

    // Generic document preview
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-100 rounded-lg">
        <FileText className="w-16 h-16 text-gray-400 mb-4" />
        <p className="text-lg font-medium text-gray-700">
          {evidence.file?.originalName}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Click download to view this document
        </p>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 truncate">
          {evidence.file?.originalName || evidence.url?.title}
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {renderPreview()}

        {/* Metadata */}
        <div className="mt-4 space-y-3">
          {/* Type */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-24">Type:</span>
            <span className="font-medium capitalize">{evidence.evidenceType}</span>
          </div>

          {/* Size */}
          {evidence.file && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 w-24">Size:</span>
              <span className="font-medium">{formatSize(evidence.file.size)}</span>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-24">Added:</span>
            <span className="font-medium flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(evidence.createdAt), 'MMM d, yyyy')}
            </span>
          </div>

          {/* Linked To */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500 w-24">Linked to:</span>
            {evidence.standardCode ? (
              <span className="font-medium text-teal-600">
                Standard {evidence.standardCode}
                {evidence.specCode ? `.${evidence.specCode}` : ''}
              </span>
            ) : (
              <span className="text-amber-600">Not linked</span>
            )}
          </div>

          {/* URL */}
          {evidence.url && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-gray-500 w-24">URL:</span>
              <a
                href={evidence.url.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {evidence.url.href}
              </a>
            </div>
          )}

          {/* Description */}
          {evidence.url?.description && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-gray-500 w-24">Description:</span>
              <span className="text-gray-700">{evidence.url.description}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinkDialog(true)}
            className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors"
          >
            <Link2 className="w-4 h-4" />
            {evidence.standardCode ? 'Change Link' : 'Link to Standard'}
          </button>
          {evidence.standardCode && (
            <button
              onClick={() => onLink('', '')}
              className="flex items-center gap-1 px-3 py-2 text-sm text-amber-600 border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <Unlink className="w-4 h-4" />
              Unlink
            </button>
          )}
        </div>

        {evidence.evidenceType !== 'url' && (
          <a
            href={downloadUrl}
            download={evidence.file?.originalName}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        )}
        {evidence.evidenceType === 'url' && (
          <a
            href={evidence.url?.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Link
          </a>
        )}
      </div>

      {/* Link Dialog */}
      {showLinkDialog && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl p-4 w-80">
            <h4 className="font-semibold text-gray-900 mb-4">Link to Standard</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Standard
                </label>
                <select
                  value={linkStandard}
                  onChange={(e) => setLinkStandard(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select standard...</option>
                  {Array.from({ length: 21 }, (_, i) => i + 1).map((num) => (
                    <option key={num} value={num.toString()}>
                      Standard {num}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Specification
                </label>
                <select
                  value={linkSpec}
                  onChange={(e) => setLinkSpec(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select specification...</option>
                  {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((spec) => (
                    <option key={spec} value={spec}>
                      Specification {spec}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowLinkDialog(false)}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkSubmit}
                disabled={!linkStandard || !linkSpec}
                className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EvidenceViewer;
