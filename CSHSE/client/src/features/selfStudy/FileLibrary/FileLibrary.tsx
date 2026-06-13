import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { FilePreviewModal } from './FilePreviewModal';
import {
  ChevronDown,
  ChevronRight,
  Upload,
  Download,
  Trash2,
  Loader2,
  FileText,
  File,
  Image as ImageIcon,
  FolderOpen,
  Link2,
  ExternalLink,
  Plus,
  X,
  Replace,
  History,
  Eye,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface StandardDefinition {
  code: string;
  title: string;
  description: string;
  part: 'I' | 'II';
  specifications: { code: string; title: string; text: string }[];
}

interface Evidence {
  _id: string;
  evidenceType: 'document' | 'url' | 'image';
  standardCode?: string;
  specCode?: string;
  url?: {
    href: string;
    title: string;
    description?: string;
  };
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
  tags?: string[];
  versionNumber?: number;
  isCurrentVersion?: boolean;
  createdAt: string;
}

// Map the import "kind:" tag to a human label for files whose original name is
// junk (e.g. a numeric import-row label like "4." → "4..docx").
const KIND_LABEL: Record<string, string> = {
  syllabus: 'Syllabus', cv: 'CV', paper: 'Paper', project: 'Project', file: 'Document',
};

/** A readable file name: the real originalName, or — when that's just a number/
 *  letter from an import row — a label derived from its kind + standard. */
function prettyFileName(item: Evidence): string {
  const raw = item.file?.originalName || '';
  const dot = raw.lastIndexOf('.');
  const ext = dot > 0 ? raw.slice(dot) : '';
  const base = (dot > 0 ? raw.slice(0, dot) : raw).trim();
  const alnum = base.replace(/[^a-z0-9]/gi, '');
  if (alnum.length > 2) return raw; // a real name — keep it
  const kindTag = (item.tags || []).find((t) => t.startsWith('kind:'));
  const kind = kindTag ? (KIND_LABEL[kindTag.slice(5)] || 'Document') : 'Document';
  const where = item.standardCode ? ` — Standard ${item.standardCode}${item.specCode ? `.${item.specCode}` : ''}` : '';
  return `${kind}${where}${ext}`;
}

interface FileLibraryProps {
  submissionId: string;
  readOnly?: boolean;
  // Deep-link target: expand this standard and scroll to this spec's files
  // (a reader clicks "Open files for 1.a" on the Reader Report).
  scrollToSpec?: { std: string; spec: string } | null;
  onScrollConsumed?: () => void;
}

export function FileLibrary({ submissionId, readOnly = false, scrollToSpec = null, onScrollConsumed }: FileLibraryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accordion state — which standards are expanded
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());

  // Upload form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadStandard, setUploadStandard] = useState('');
  const [uploadSpec, setUploadSpec] = useState('');
  const [uploadMode, setUploadMode] = useState<'version' | 'replace'>('version');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // URL form state
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlForm, setUrlForm] = useState({ url: '', title: '', description: '' });
  const [urlStandard, setUrlStandard] = useState('');
  const [urlSpec, setUrlSpec] = useState('');

  // Preview modal state
  const [previewEvidence, setPreviewEvidence] = useState<Evidence | null>(null);

  // Fetch standards definitions
  const { data: standards } = useQuery<StandardDefinition[]>({
    queryKey: ['standards'],
    queryFn: async () => {
      const response = await api.get(`/api/standards`);
      return response.data;
    },
  });

  // Fetch ALL evidence for this submission (no standard/spec filter)
  const { data: evidenceData, isLoading } = useQuery({
    queryKey: ['evidence', submissionId, 'all'],
    queryFn: async () => {
      const response = await api.get(
        `${API_BASE}/submissions/${submissionId}/evidence`
      );
      return response.data;
    },
  });

  const allEvidence: Evidence[] = evidenceData?.evidence || [];

  // Group evidence by standardCode → specCode
  const evidenceByStandard = useMemo(() => {
    const grouped: Record<string, Record<string, Evidence[]>> = {};
    for (const item of allEvidence) {
      const std = item.standardCode || 'unassigned';
      const spec = item.specCode || 'general';
      if (!grouped[std]) grouped[std] = {};
      if (!grouped[std][spec]) grouped[std][spec] = [];
      grouped[std][spec].push(item);
    }
    return grouped;
  }, [allEvidence]);

  // Deep-link: when a reader opens the library targeting a spec, expand that
  // standard and scroll/flash its files. Runs once the evidence has loaded.
  useEffect(() => {
    if (!scrollToSpec || isLoading) return;
    const { std, spec } = scrollToSpec;
    setExpandedStandards((prev) => new Set(prev).add(std));
    const t = setTimeout(() => {
      const el = document.getElementById(`file-spec-${std}-${spec}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-teal-400', 'rounded');
        setTimeout(() => el.classList.remove('ring-2', 'ring-teal-400', 'rounded'), 2200);
      }
      onScrollConsumed?.();
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToSpec, isLoading]);

  // Count evidence per standard
  const countForStandard = (code: string): number => {
    const specs = evidenceByStandard[code];
    if (!specs) return 0;
    return Object.values(specs).reduce((sum, arr) => sum + arr.length, 0);
  };

  // Get available specs for a selected standard
  const specsForStandard = useMemo(() => {
    if (!uploadStandard || !standards) return [];
    const std = standards.find((s) => s.code === uploadStandard);
    return std?.specifications || [];
  }, [uploadStandard, standards]);

  const urlSpecsForStandard = useMemo(() => {
    if (!urlStandard || !standards) return [];
    const std = standards.find((s) => s.code === urlStandard);
    return std?.specifications || [];
  }, [urlStandard, standards]);

  // Upload file mutation
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      description,
      standardCode,
      specCode,
      mode,
    }: {
      file: File;
      description: string;
      standardCode: string;
      specCode: string;
      mode: 'version' | 'replace';
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('standardCode', standardCode);
      formData.append('specCode', specCode);
      formData.append('title', file.name);
      if (description) formData.append('description', description);
      if (mode === 'replace') formData.append('replaceExisting', 'true');

      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/evidence/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
      resetUploadForm();
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'Failed to upload file');
    },
  });

  // Add URL mutation
  const addUrlMutation = useMutation({
    mutationFn: async (data: {
      url: string;
      title: string;
      description?: string;
      standardCode: string;
      specCode: string;
    }) => {
      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/evidence/url`,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
      resetUrlForm();
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'Failed to add URL');
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
      queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'Failed to delete evidence');
    },
  });

  const toggleStandard = (code: string) => {
    setExpandedStandards((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const expandAll = () => {
    if (standards) {
      setExpandedStandards(new Set(standards.map((s) => s.code)));
    }
  };

  const collapseAll = () => {
    setExpandedStandards(new Set());
  };

  const resetUploadForm = () => {
    setStagedFile(null);
    setUploadDescription('');
    setUploadStandard('');
    setUploadSpec('');
    setUploadMode('version');
    setUploadError(null);
    setShowUploadForm(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetUrlForm = () => {
    setUrlForm({ url: '', title: '', description: '' });
    setUrlStandard('');
    setUrlSpec('');
    setShowUrlForm(false);
    setUploadError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setStagedFile(file);
      setUploadError(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = () => {
    if (!stagedFile || !uploadStandard || !uploadSpec) return;
    uploadMutation.mutate({
      file: stagedFile,
      description: uploadDescription,
      standardCode: uploadStandard,
      specCode: uploadSpec,
      mode: uploadMode,
    });
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlForm.url || !urlForm.title || !urlStandard || !urlSpec) return;
    addUrlMutation.mutate({
      ...urlForm,
      standardCode: urlStandard,
      specCode: urlSpec,
    });
  };

  const handleDelete = (evidenceId: string, title: string) => {
    if (window.confirm(`Delete "${title}"?`)) {
      deleteMutation.mutate(evidenceId);
    }
  };

  const handleDownload = async (evidenceId: string, filename?: string) => {
    try {
      const response = await api.get(
        `${API_BASE}/submissions/${submissionId}/evidence/${evidenceId}/download`,
        { responseType: 'blob' }
      );
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to download file');
    }
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

  const getEvidenceIcon = (item: Evidence) => {
    if (item.evidenceType === 'url') return <Link2 className="w-4 h-4 text-blue-500" />;
    if (item.evidenceType === 'image') return <ImageIcon className="w-4 h-4 text-purple-500" />;
    if (item.file?.mimeType?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

  // Group standards by part
  const partI = standards?.filter((s) => s.part === 'I') || [];
  const partII = standards?.filter((s) => s.part === 'II') || [];

  const isPreviewableType = (item: Evidence): boolean => {
    if (item.evidenceType === 'url') return false;
    const mime = item.file?.mimeType || '';
    return (
      mime.includes('pdf') ||
      mime.includes('wordprocessingml') ||
      mime.startsWith('image/')
    );
  };

  const renderEvidenceItem = (item: Evidence) => {
    const title =
      item.evidenceType === 'url'
        ? item.url?.title || 'Untitled Link'
        : (item.file ? prettyFileName(item) : 'Untitled File');
    const desc = getDescription(item);

    return (
      <div
        key={item._id}
        className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 rounded group"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Left icon: clickable download for files, link icon for URLs */}
          {item.evidenceType === 'url' ? (
            <a
              href={item.url?.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-1 rounded hover:bg-blue-100 transition-colors"
              title="Open link"
            >
              <Link2 className="w-4 h-4 text-blue-500" />
            </a>
          ) : (
            <button
              onClick={() => handleDownload(item._id, prettyFileName(item))}
              className="flex-shrink-0 p-1 rounded hover:bg-teal-100 transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4 text-teal-600" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-800 truncate">
                {title}
              </span>
              {item.versionNumber && item.versionNumber > 1 && (
                <span className="flex-shrink-0 text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                  v{item.versionNumber}
                </span>
              )}
              {item.file?.size && (
                <span className="flex-shrink-0 text-xs text-gray-400">
                  {formatFileSize(item.file.size)}
                </span>
              )}
            </div>
            {desc && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{desc}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 ml-2 whitespace-nowrap flex-shrink-0">
          {/* Preview button (eye icon) for previewable file types */}
          {item.evidenceType !== 'url' && isPreviewableType(item) && (
            <button
              onClick={() => setPreviewEvidence(item)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors whitespace-nowrap"
              title="Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          )}
          {/* For non-previewable files, still show a download button on the right */}
          {item.evidenceType !== 'url' && !isPreviewableType(item) && (
            <button
              onClick={() => handleDownload(item._id, prettyFileName(item))}
              className="flex items-center gap-1 px-2 py-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          )}
          {item.evidenceType === 'url' && (
            <a
              href={item.url?.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded hover:bg-teal-100 transition-colors"
              title="Open link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open
            </a>
          )}
          {!readOnly && (
            <button
              onClick={() => handleDelete(item._id, title)}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSpecSection = (
    standardCode: string,
    spec: { code: string; title: string },
  ) => {
    const items = evidenceByStandard[standardCode]?.[spec.code] || [];
    if (items.length === 0) return null;

    return (
      <div key={spec.code} id={`file-spec-${standardCode}-${spec.code}`} className="mb-3 scroll-mt-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded text-sm">
          <span className="font-medium text-gray-600">
            {standardCode}.{spec.code}
          </span>
          <span className="text-gray-500">{spec.title}</span>
          <span className="text-xs text-gray-400 ml-auto">
            {items.length} file{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="ml-2 border-l-2 border-gray-100 pl-2 mt-1">
          {items.map(renderEvidenceItem)}
        </div>
      </div>
    );
  };

  const renderStandardAccordion = (standard: StandardDefinition) => {
    const isExpanded = expandedStandards.has(standard.code);
    const fileCount = countForStandard(standard.code);

    return (
      <div
        key={standard.code}
        className="border border-gray-200 rounded-lg overflow-hidden"
      >
        {/* Accordion header */}
        <button
          onClick={() => toggleStandard(standard.code)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-800 flex-shrink-0">
            Standard {standard.code}
          </span>
          <span className="text-sm text-gray-500 truncate flex-1">
            {standard.title}
          </span>
          {fileCount > 0 && (
            <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full whitespace-nowrap">
              {fileCount} file{fileCount !== 1 ? 's' : ''}
            </span>
          )}
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-gray-100">
            {standard.specifications.map((spec) =>
              renderSpecSection(standard.code, spec)
            )}
            {/* Show empty state if no files for this standard */}
            {fileCount === 0 && (
              <div className="py-6 text-center text-sm text-gray-400">
                No files uploaded for this standard yet.
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header bar with upload buttons */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3 whitespace-nowrap">
          <FolderOpen className="w-5 h-5 text-teal-600 flex-shrink-0" />
          <h2 className="text-lg font-semibold text-gray-800">
            Supporting File Library
          </h2>
          <span className="text-sm text-gray-500">
            ({allEvidence.length} file{allEvidence.length !== 1 ? 's' : ''})
          </span>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <button
              onClick={() => {
                setShowUrlForm(false);
                setShowUploadForm(!showUploadForm);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4 flex-shrink-0" />
              Upload File
            </button>
            <button
              onClick={() => {
                setShowUploadForm(false);
                setShowUrlForm(!showUrlForm);
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <Link2 className="w-4 h-4 flex-shrink-0" />
              Add URL
            </button>
          </div>
        )}
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="px-4 py-4 bg-teal-50 border-b border-teal-200 flex-shrink-0">
          <div className="max-w-2xl">
            <h3 className="text-sm font-semibold text-teal-800 mb-3">
              Upload Supporting File
            </h3>

            {/* File selection */}
            <div className="mb-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                onChange={handleFileSelect}
              />
              {stagedFile ? (
                <div className="flex items-center gap-2 p-2 bg-white rounded border border-teal-200">
                  <FileText className="w-4 h-4 text-teal-600" />
                  <span className="text-sm text-teal-800 truncate flex-1">
                    {stagedFile.name}
                  </span>
                  <span className="text-xs text-teal-600">
                    ({formatFileSize(stagedFile.size)})
                  </span>
                  <button
                    onClick={() => {
                      setStagedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-1 text-gray-400 hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border-2 border-dashed border-teal-300 rounded-lg text-center hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
                >
                  <Plus className="w-5 h-5 text-teal-500 mx-auto mb-1" />
                  <span className="text-sm text-teal-700">
                    Click to select a file
                  </span>
                  <span className="block text-xs text-teal-500 mt-0.5">
                    PDF, Word, PowerPoint, Excel, or images
                  </span>
                </button>
              )}
            </div>

            {/* Standard & Spec selection */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">
                  Standard *
                </label>
                <select
                  value={uploadStandard}
                  onChange={(e) => {
                    setUploadStandard(e.target.value);
                    setUploadSpec('');
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-teal-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white"
                >
                  <option value="">Select standard...</option>
                  {standards?.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.code} - {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-teal-700 mb-1">
                  Sub-standard *
                </label>
                <select
                  value={uploadSpec}
                  onChange={(e) => setUploadSpec(e.target.value)}
                  disabled={!uploadStandard}
                  className="w-full px-2 py-1.5 text-sm border border-teal-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 bg-white disabled:opacity-50"
                >
                  <option value="">Select sub-standard...</option>
                  {specsForStandard.map((spec) => (
                    <option key={spec.code} value={spec.code}>
                      {uploadStandard}.{spec.code} - {spec.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-teal-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description of this file"
                className="w-full px-2 py-1.5 text-sm border border-teal-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>

            {/* Version vs Replace */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-teal-700 mb-2">
                If a file with the same name exists:
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="uploadMode"
                    value="version"
                    checked={uploadMode === 'version'}
                    onChange={() => setUploadMode('version')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <History className="w-4 h-4 text-teal-600" />
                  <span className="text-sm text-gray-700">
                    Keep as new version
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="uploadMode"
                    value="replace"
                    checked={uploadMode === 'replace'}
                    onChange={() => setUploadMode('replace')}
                    className="text-teal-600 focus:ring-teal-500"
                  />
                  <Replace className="w-4 h-4 text-orange-500" />
                  <span className="text-sm text-gray-700">
                    Replace existing file
                  </span>
                </label>
              </div>
            </div>

            {/* Error message */}
            {uploadError && (
              <div className="mb-3 p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
                {uploadError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpload}
                disabled={
                  !stagedFile ||
                  !uploadStandard ||
                  !uploadSpec ||
                  uploadMutation.isPending
                }
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Upload
              </button>
              <button
                onClick={resetUploadForm}
                disabled={uploadMutation.isPending}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* URL Form */}
      {showUrlForm && (
        <div className="px-4 py-4 bg-blue-50 border-b border-blue-200 flex-shrink-0">
          <div className="max-w-2xl">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">
              Add URL Evidence
            </h3>
            <form onSubmit={handleAddUrl}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
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
                    className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
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
                    className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Standard *
                  </label>
                  <select
                    value={urlStandard}
                    onChange={(e) => {
                      setUrlStandard(e.target.value);
                      setUrlSpec('');
                    }}
                    className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">Select standard...</option>
                    {standards?.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} - {s.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Sub-standard *
                  </label>
                  <select
                    value={urlSpec}
                    onChange={(e) => setUrlSpec(e.target.value)}
                    disabled={!urlStandard}
                    className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white disabled:opacity-50"
                  >
                    <option value="">Select sub-standard...</option>
                    {urlSpecsForStandard.map((spec) => (
                      <option key={spec.code} value={spec.code}>
                        {urlStandard}.{spec.code} - {spec.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium text-blue-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={urlForm.description}
                  onChange={(e) =>
                    setUrlForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Brief description"
                  className="w-full px-2 py-1.5 text-sm border border-blue-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {uploadError && (
                <div className="mb-3 p-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded">
                  {uploadError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={
                    !urlForm.url ||
                    !urlForm.title ||
                    !urlStandard ||
                    !urlSpec ||
                    addUrlMutation.isPending
                  }
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {addUrlMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  Add URL
                </button>
                <button
                  type="button"
                  onClick={resetUrlForm}
                  disabled={addUrlMutation.isPending}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expand/Collapse controls */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={expandAll}
          className="text-xs text-teal-600 hover:text-teal-800 hover:underline"
        >
          Expand All
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={collapseAll}
          className="text-xs text-teal-600 hover:text-teal-800 hover:underline"
        >
          Collapse All
        </button>
      </div>

      {/* Accordion list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            <span className="ml-2 text-gray-500">Loading files...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Part I */}
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 px-1">
                Part I: General Standards (1-10)
              </h3>
              <div className="space-y-2">
                {partI.map(renderStandardAccordion)}
              </div>
            </div>

            {/* Part II */}
            <div>
              <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-2 px-1">
                Part II: Curriculum Standards (11-21)
              </h3>
              <div className="space-y-2">
                {partII.map(renderStandardAccordion)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewEvidence && (
        <FilePreviewModal
          submissionId={submissionId}
          evidenceId={previewEvidence._id}
          fileName={previewEvidence.file?.originalName || 'File'}
          mimeType={previewEvidence.file?.mimeType}
          fileSize={previewEvidence.file?.size}
          onClose={() => setPreviewEvidence(null)}
          onDescriptionUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
          }}
        />
      )}
    </div>
  );
}

export default FileLibrary;
