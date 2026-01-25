import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Upload,
  Link,
  FileText,
  Image,
  ExternalLink,
  Trash2,
  Download,
  Filter,
  Loader2,
  Plus,
  X,
  Search,
  Link2,
  Unlink,
} from 'lucide-react';
import { FileUpload } from './FileUpload';
import { URLInput } from './URLInput';
import { EvidenceViewer } from './EvidenceViewer';

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

interface EvidenceStats {
  byType: Record<string, { count: number; totalSize: number }>;
  linkedCount: number;
  unlinkedCount: number;
  total: number;
}

interface EvidenceManagerProps {
  submissionId: string;
  standardCode?: string;
  specCode?: string;
  onSelectEvidence?: (evidence: Evidence) => void;
}

/**
 * Evidence Manager - Upload, organize, and link supporting evidence
 */
export function EvidenceManager({
  submissionId,
  standardCode,
  specCode,
  onSelectEvidence,
}: EvidenceManagerProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'documents' | 'urls' | 'images'>('all');
  const [showUpload, setShowUpload] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all');

  // Fetch evidence list
  const { data: evidenceList, isLoading } = useQuery<Evidence[]>({
    queryKey: ['evidence', submissionId, activeTab, standardCode, specCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeTab !== 'all') {
        const typeMap = { documents: 'document', urls: 'url', images: 'image' };
        params.append('evidenceType', typeMap[activeTab] || '');
      }
      if (standardCode) params.append('standardCode', standardCode);
      if (specCode) params.append('specCode', specCode);

      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/evidence?${params}`
      );
      return response.data;
    },
  });

  // Fetch statistics
  const { data: stats } = useQuery<EvidenceStats>({
    queryKey: ['evidence-stats', submissionId],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/evidence/stats`
      );
      return response.data;
    },
  });

  // Delete evidence mutation
  const deleteMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      await axios.delete(
        `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['evidence-stats', submissionId] });
    },
  });

  // Link evidence mutation
  const linkMutation = useMutation({
    mutationFn: async ({
      evidenceId,
      standardCode,
      specCode,
    }: {
      evidenceId: string;
      standardCode: string;
      specCode: string;
    }) => {
      await axios.post(
        `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/link`,
        { standardCode, specCode }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
    },
  });

  // Filter evidence
  const filteredEvidence = React.useMemo(() => {
    if (!evidenceList) return [];
    let filtered = evidenceList;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((e) => {
        const name = e.file?.originalName || e.url?.title || '';
        const desc = e.url?.description || e.imageMetadata?.description || '';
        return name.toLowerCase().includes(query) || desc.toLowerCase().includes(query);
      });
    }

    // Linked filter
    if (filterLinked === 'linked') {
      filtered = filtered.filter((e) => e.standardCode);
    } else if (filterLinked === 'unlinked') {
      filtered = filtered.filter((e) => !e.standardCode);
    }

    return filtered;
  }, [evidenceList, searchQuery, filterLinked]);

  // Handle delete
  const handleDelete = async (evidence: Evidence) => {
    if (
      window.confirm(
        `Delete "${evidence.file?.originalName || evidence.url?.title}"? This cannot be undone.`
      )
    ) {
      await deleteMutation.mutateAsync(evidence._id);
      if (selectedEvidence?._id === evidence._id) {
        setSelectedEvidence(null);
      }
    }
  };

  // Handle upload success
  const handleUploadSuccess = () => {
    setShowUpload(false);
    queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
    queryClient.invalidateQueries({ queryKey: ['evidence-stats', submissionId] });
  };

  // Handle URL add success
  const handleUrlSuccess = () => {
    setShowUrlInput(false);
    queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
    queryClient.invalidateQueries({ queryKey: ['evidence-stats', submissionId] });
  };

  // Format file size
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get icon for evidence type
  const getEvidenceIcon = (evidence: Evidence) => {
    switch (evidence.evidenceType) {
      case 'image':
        return <Image className="w-5 h-5 text-purple-500" />;
      case 'url':
        return <ExternalLink className="w-5 h-5 text-blue-500" />;
      default:
        return <FileText className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="evidence-manager flex h-full bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Left Panel - List */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Supporting Evidence
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUrlInput(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Link className="w-4 h-4" />
                Add URL
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <span>{stats.total} items</span>
              <span className="text-green-600">{stats.linkedCount} linked</span>
              <span className="text-amber-600">{stats.unlinkedCount} unlinked</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-4">
            {(['all', 'documents', 'urls', 'images'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-teal-100 text-teal-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search evidence..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <select
              value={filterLinked}
              onChange={(e) => setFilterLinked(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="unlinked">Unlinked</option>
            </select>
          </div>
        </div>

        {/* Evidence List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredEvidence.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <FileText className="w-8 h-8 mb-2" />
              <p>No evidence found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredEvidence.map((evidence) => (
                <div
                  key={evidence._id}
                  onClick={() => {
                    setSelectedEvidence(evidence);
                    onSelectEvidence?.(evidence);
                  }}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedEvidence?._id === evidence._id
                      ? 'bg-teal-50 border-l-4 border-teal-500'
                      : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {getEvidenceIcon(evidence)}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {evidence.file?.originalName || evidence.url?.title}
                      </p>
                      {evidence.standardCode && (
                        <p className="text-xs text-teal-600">
                          Linked to {evidence.standardCode}
                          {evidence.specCode ? `.${evidence.specCode}` : ''}
                        </p>
                      )}
                      {evidence.file && (
                        <p className="text-xs text-gray-500">
                          {formatSize(evidence.file.size)}
                        </p>
                      )}
                      {evidence.url && (
                        <p className="text-xs text-gray-500 truncate">
                          {evidence.url.href}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!evidence.standardCode && (
                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                          Unlinked
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(evidence);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Preview/Details */}
      <div className="w-1/2 flex flex-col">
        {selectedEvidence ? (
          <EvidenceViewer
            evidence={selectedEvidence}
            submissionId={submissionId}
            onClose={() => setSelectedEvidence(null)}
            onLink={(standardCode, specCode) =>
              linkMutation.mutate({
                evidenceId: selectedEvidence._id,
                standardCode,
                specCode,
              })
            }
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FileText className="w-12 h-12 mb-4" />
            <p>Select an item to preview</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <FileUpload
          submissionId={submissionId}
          standardCode={standardCode}
          specCode={specCode}
          onClose={() => setShowUpload(false)}
          onSuccess={handleUploadSuccess}
        />
      )}

      {/* URL Input Modal */}
      {showUrlInput && (
        <URLInput
          submissionId={submissionId}
          standardCode={standardCode}
          specCode={specCode}
          onClose={() => setShowUrlInput(false)}
          onSuccess={handleUrlSuccess}
        />
      )}
    </div>
  );
}

export default EvidenceManager;
