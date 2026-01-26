import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { X, Link, Loader2, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface URLInputProps {
  submissionId: string;
  standardCode?: string;
  specCode?: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * URL input component for adding web link evidence
 */
export function URLInput({
  submissionId,
  standardCode,
  specCode,
  onClose,
  onSuccess,
}: URLInputProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Add URL mutation
  const addUrlMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/evidence/url`,
        {
          url,
          title,
          description,
          standardCode,
          specCode,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to add URL');
    },
  });

  // Validate URL
  const validateUrl = (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('URL is required');
      return;
    }

    if (!validateUrl(url)) {
      setError('Please enter a valid URL');
      return;
    }

    addUrlMutation.mutate();
  };

  // Auto-fill title from URL
  const handleUrlBlur = () => {
    if (url && !title) {
      try {
        const urlObj = new URL(url);
        // Use hostname as default title if no title provided
        setTitle(urlObj.hostname.replace('www.', ''));
      } catch {
        // Invalid URL, ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add URL Evidence</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={handleUrlBlur}
                placeholder="https://example.com/document"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Link to external document, webpage, or resource
            </p>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document or resource title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this resource"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {/* Preview */}
          {url && validateUrl(url) && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Preview:</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="truncate">{title || url}</span>
              </a>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addUrlMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addUrlMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Link className="w-4 h-4" />
                  Add URL
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default URLInput;
