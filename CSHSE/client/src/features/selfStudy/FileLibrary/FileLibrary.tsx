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
  Sparkles,
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
/** Compact upload-date label, e.g. "Aug 6, 2026". */
function formatUploadDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
/** True when the file was uploaded within the last 3 days (drives the "New" badge). */
function isRecentUpload(iso?: string): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !isNaN(t) && Date.now() - t < 3 * 24 * 60 * 60 * 1000;
}

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
  // CR-074 — the submit modal deep-links here with 'unassigned' so the PC lands
  // on the "Unassigned only" view (the files that block submit). Consumed once.
  initialFilter?: 'all' | 'unassigned';
  onFilterConsumed?: () => void;
}

export function FileLibrary({ submissionId, readOnly = false, scrollToSpec = null, onScrollConsumed, initialFilter = 'all', onFilterConsumed }: FileLibraryProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Accordion state — which standards are expanded
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  // CR-074 — assignment filter: show everything, or only files not yet assigned
  // to a Standard (the blocking set the submit gate enforces).
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned'>(initialFilter);

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

  // Inline "assign to Standard" state for classifying a library file directly.
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [assignStd, setAssignStd] = useState('');
  const [assignSpec, setAssignSpec] = useState('');
  // CR-074 — bulk-assign target for the "Assign all unassigned" action.
  const [bulkAssignStd, setBulkAssignStd] = useState('');
  const [bulkAssignSpec, setBulkAssignSpec] = useState('');
  // AI classify: the last suggestion returned for the file being assigned, shown
  // as a hint below the dropdowns (label + confidence). Cleared when the panel closes.
  const [assignHint, setAssignHint] = useState<{ label: string; confidence?: number } | null>(null);

  // Fetch standards definitions — LEVEL-AWARE (the submission's degree level) so
  // the Standard/Spec choices match this program, not the flat default.
  const { data: standards } = useQuery<StandardDefinition[]>({
    queryKey: ['standards', submissionId],
    queryFn: async () => {
      const response = await api.get(`/api/standards?submissionId=${submissionId}`);
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

  // CR-074 — the files that block submit: uploaded but never assigned to a
  // Standard (mirrors the server gate + the Review banner count). Exclude the
  // auto-generated Reader Report PDF/DOCX (no standardCode, but not stray
  // uploads — the submit gate ignores them too).
  const unassignedItems = useMemo(
    () => allEvidence.filter((e) => !e.standardCode && !(e.tags || []).some((t) => String(t).startsWith('reader-report'))),
    [allEvidence]
  );
  const unassignedCount = unassignedItems.length;

  // Honour a deep-link request to show only the unassigned files (from the
  // submit modal's hard block). Apply once, expand the group, then consume.
  useEffect(() => {
    if (initialFilter === 'unassigned') {
      setAssignmentFilter('unassigned');
      setExpandedStandards((prev) => new Set(prev).add('unassigned'));
      onFilterConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter]);

  // If the last unassigned file gets assigned while the filter is active, drop
  // back to the full view so the PC isn't staring at an empty list.
  useEffect(() => {
    if (assignmentFilter === 'unassigned' && unassignedCount === 0 && !isLoading) {
      setAssignmentFilter('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentFilter, unassignedCount, isLoading]);

  // Group evidence by standardCode → specCode (respecting the assignment filter)
  const evidenceByStandard = useMemo(() => {
    const source = assignmentFilter === 'unassigned' ? unassignedItems : allEvidence;
    const grouped: Record<string, Record<string, Evidence[]>> = {};
    for (const item of source) {
      const std = item.standardCode || 'unassigned';
      const spec = item.specCode || 'general';
      if (!grouped[std]) grouped[std] = {};
      if (!grouped[std][spec]) grouped[std][spec] = [];
      grouped[std][spec].push(item);
    }
    return grouped;
  }, [allEvidence, unassignedItems, assignmentFilter]);

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

  // Classify (or re-classify) an existing library file directly — assign it a
  // Standard/Spec without going through the Review panel. This is what lets a
  // coordinator route files that never surfaced in Review (bulk/direct uploads
  // the matcher couldn't place) so they become part of the standard.
  const classifyMutation = useMutation({
    mutationFn: async (v: { evidenceId: string; standardCode: string; specCode?: string }) => {
      await api.patch(
        `${API_BASE}/submissions/${submissionId}/evidence/${v.evidenceId}`,
        { standardCode: v.standardCode, specCode: v.specCode || undefined }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
      setAssignFor(null); setAssignStd(''); setAssignSpec(''); setAssignHint(null);
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'Failed to assign standard');
    },
  });

  // CR-074 — bulk-assign every currently-unassigned file to one target
  // (a Standard/spec or the Introduction), so the PC can clear the whole
  // submit-blocking set in one action.
  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      if (!bulkAssignStd) return;
      for (const item of unassignedItems) {
        await api.patch(
          `${API_BASE}/submissions/${submissionId}/evidence/${item._id}`,
          { standardCode: bulkAssignStd, specCode: bulkAssignStd === 'introduction' ? undefined : (bulkAssignSpec || undefined) }
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', submissionId] });
      setBulkAssignStd(''); setBulkAssignSpec('');
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'Failed to assign files');
    },
  });

  // AI-classify a single library file — reads the file, reference-matches the
  // narratives + runs the placement matcher, and pre-fills the dropdowns with the
  // best guess. Suggest-only: the coordinator still confirms and clicks Save.
  const suggestMutation = useMutation({
    mutationFn: async (v: { evidenceId: string }) => {
      const res = await api.post(
        `${API_BASE}/submissions/${submissionId}/evidence/${v.evidenceId}/suggest-standard`
      );
      return res.data as {
        best?: { standardCode: string; specCode?: string; confidence?: number } | null;
        suggestions?: { standardCode: string; specCode?: string; confidence?: number }[];
      };
    },
    onSuccess: (data) => {
      // Prefer the confident auto-route pick; otherwise fall back to the top-ranked
      // suggestion so the user still gets a "where does this fit" starting point
      // (clearly flagged low-confidence — they review + confirm before Save).
      const best = data?.best || data?.suggestions?.[0];
      const lowConf = !data?.best;
      if (best?.standardCode) {
        setAssignStd(best.standardCode);
        setAssignSpec(best.specCode || '');
        const std = (standards || []).find((s) => s.code === best.standardCode);
        setAssignHint({
          label: `${lowConf ? '(low confidence) ' : ''}${best.standardCode}${best.specCode ? `.${best.specCode}` : ''}${std ? ` — ${std.title}` : ''}`,
          confidence: best.confidence,
        });
      } else {
        setAssignHint({ label: 'No match found — choose a Standard manually.' });
      }
    },
    onError: (error: any) => {
      setUploadError(error.response?.data?.error || 'AI classify failed');
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
      setExpandedStandards(new Set(['introduction', ...standards.map((s) => s.code)]));
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
      // xlsx / pptx render natively via the Office web viewer.
      mime.includes('spreadsheetml') ||
      mime.includes('presentationml') ||
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
              {isRecentUpload(item.createdAt) && (
                <span
                  className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-wide"
                  title="Uploaded in the last 3 days"
                >
                  New
                </span>
              )}
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
              {item.createdAt && (
                <span
                  className="flex-shrink-0 text-xs text-gray-400"
                  title={`Uploaded ${new Date(item.createdAt).toLocaleString()}`}
                >
                  · Uploaded {formatUploadDate(item.createdAt)}
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
          {/* Assign / change the Standard for this file directly in the library.
              Essential for files that never appeared in the Review panel (bulk
              or direct uploads the matcher couldn't place). */}
          {!readOnly && (
            assignFor === item._id ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => suggestMutation.mutate({ evidenceId: item._id })}
                    disabled={suggestMutation.isPending}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded hover:bg-purple-100 disabled:opacity-50 whitespace-nowrap"
                    title="Let the AI read this file and suggest which Standard it supports"
                  >
                    {suggestMutation.isPending
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Sparkles className="w-3.5 h-3.5" />}
                    Suggest
                  </button>
                  <select
                    value={assignStd}
                    onChange={(e) => { setAssignStd(e.target.value); setAssignSpec(''); setAssignHint(null); }}
                    className="text-xs border border-gray-300 rounded px-1.5 py-1 max-w-[10rem]"
                  >
                    <option value="">Standard…</option>
                    <option value="introduction">Introduction (program intro)</option>
                    {(standards || []).map((s) => (
                      <option key={s.code} value={s.code}>{s.code} — {s.title}</option>
                    ))}
                  </select>
                  <select
                    value={assignSpec}
                    onChange={(e) => setAssignSpec(e.target.value)}
                    disabled={!assignStd || assignStd === 'introduction'}
                    className="text-xs border border-gray-300 rounded px-1.5 py-1 disabled:opacity-50"
                  >
                    <option value="">Spec…</option>
                    {(standards || []).find((s) => s.code === assignStd)?.specifications.map((sp) => (
                      <option key={sp.code} value={sp.code}>{sp.code}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => classifyMutation.mutate({ evidenceId: item._id, standardCode: assignStd, specCode: assignSpec })}
                    disabled={!assignStd || classifyMutation.isPending}
                    className="px-2 py-1 text-xs text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setAssignFor(null); setAssignStd(''); setAssignSpec(''); setAssignHint(null); }}
                    className="px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
                {assignHint && (
                  <div className="text-[11px] text-purple-700 pl-1">
                    <Sparkles className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                    AI suggests: <span className="font-medium">{assignHint.label}</span>
                    {typeof assignHint.confidence === 'number' && (
                      <span className="text-gray-500"> ({Math.round(assignHint.confidence * 100)}%)</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => { setAssignFor(item._id); setAssignStd(item.standardCode || ''); setAssignSpec(item.specCode || ''); setAssignHint(null); }}
                className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors whitespace-nowrap ${
                  item.standardCode
                    ? 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100'
                    : 'text-amber-800 bg-amber-100 border-amber-300 hover:bg-amber-200'
                }`}
                title={item.standardCode ? 'Change the Standard for this file' : 'Assign this file to a Standard'}
              >
                {item.standardCode ? 'Change Standard' : 'Assign to Standard'}
              </button>
            )
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

  // Files whose classification is the program introduction (standardCode
  // 'introduction') don't belong to any numbered standard, so they get their
  // own section at the top — otherwise intro-referenced appendices are stored
  // but never shown in the library.
  const renderIntroductionAccordion = () => {
    const introFiles = Object.values(evidenceByStandard['introduction'] || {}).flat();
    if (introFiles.length === 0) return null;
    const isExpanded = expandedStandards.has('introduction');
    return (
      <div key="introduction" className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleStandard('introduction')}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-800 flex-shrink-0">Introduction</span>
          <span className="text-sm text-gray-500 truncate flex-1">
            Files referenced in the program introduction
          </span>
          <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full whitespace-nowrap">
            {introFiles.length} file{introFiles.length !== 1 ? 's' : ''}
          </span>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 pt-3 border-t border-gray-100">
            {introFiles.map(renderEvidenceItem)}
          </div>
        )}
      </div>
    );
  };

  // Bulk-imported files that haven't been assigned a standard yet (standardCode
  // unset). They ARE in the library (stored) but need routing — show them in
  // their own section so a dropped file is visible immediately; approving it in
  // the Review rail moves it under its standard.
  const renderUnassignedAccordion = () => {
    const unassignedFiles = Object.values(evidenceByStandard['unassigned'] || {}).flat();
    if (unassignedFiles.length === 0) return null;
    const isExpanded = expandedStandards.has('unassigned');
    return (
      <div key="unassigned" className="border border-amber-200 rounded-lg overflow-hidden" data-testid="file-library-unassigned">
        <button
          onClick={() => toggleStandard('unassigned')}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-amber-50 transition-colors whitespace-nowrap bg-amber-50/40"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-amber-600 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-amber-800 flex-shrink-0">Unassigned</span>
          <span className="text-sm text-amber-700/80 truncate flex-1">
            Imported files awaiting a Standard — use “Assign to Standard” on each
          </span>
          <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full whitespace-nowrap">
            {unassignedFiles.length} file{unassignedFiles.length !== 1 ? 's' : ''}
          </span>
        </button>
        {isExpanded && (
          <div className="px-4 pb-4 pt-3 border-t border-amber-100">
            {unassignedFiles.map(renderEvidenceItem)}
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

      {/* Expand/Collapse controls + CR-074 assignment filter chips */}
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

        {/* Show all / Unassigned-only. The unassigned chip carries the count so
            the PC can see at a glance whether any files still block submit. */}
        <div className="ml-auto flex items-center gap-1" data-testid="file-library-filter">
          <button
            type="button"
            data-testid="file-filter-all"
            onClick={() => setAssignmentFilter('all')}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              assignmentFilter === 'all'
                ? 'bg-teal-100 text-teal-800'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            All files
          </button>
          <button
            type="button"
            data-testid="file-filter-unassigned"
            onClick={() => setAssignmentFilter('unassigned')}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              assignmentFilter === 'unassigned'
                ? 'bg-amber-200 text-amber-900'
                : unassignedCount > 0
                  ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'text-gray-400 hover:bg-gray-100'
            }`}
          >
            Unassigned
            <span
              className={`rounded-full px-1.5 text-[10px] ${
                unassignedCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {unassignedCount}
            </span>
          </button>
        </div>
      </div>

      {/* CR-074 — bulk "assign all unassigned" so the PC can clear the whole
          blocking set at once (there was previously only per-file assign +
          "un-approve all", with no matching bulk approve). */}
      {!readOnly && assignmentFilter === 'unassigned' && unassignedCount > 0 && (
        <div
          data-testid="bulk-assign-unassigned"
          className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-2 text-sm"
        >
          <span className="font-medium text-amber-900">
            Assign all {unassignedCount} unassigned file{unassignedCount === 1 ? '' : 's'} to:
          </span>
          <select
            data-testid="bulk-assign-standard"
            value={bulkAssignStd}
            onChange={(e) => { setBulkAssignStd(e.target.value); setBulkAssignSpec(''); }}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-sm"
          >
            <option value="">Choose…</option>
            <option value="introduction">Introduction (program intro)</option>
            {(standards || []).map((s) => (
              <option key={s.code} value={s.code}>Standard {s.code} — {s.title}</option>
            ))}
          </select>
          <select
            data-testid="bulk-assign-spec"
            value={bulkAssignSpec}
            onChange={(e) => setBulkAssignSpec(e.target.value)}
            disabled={!bulkAssignStd || bulkAssignStd === 'introduction'}
            className="rounded border border-amber-300 bg-white px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Whole standard</option>
            {(standards || []).find((s) => s.code === bulkAssignStd)?.specifications.map((sp) => (
              <option key={sp.code} value={sp.code}>{bulkAssignStd}.{sp.code}</option>
            ))}
          </select>
          <button
            type="button"
            data-testid="bulk-assign-apply"
            onClick={() => bulkAssignMutation.mutate()}
            disabled={!bulkAssignStd || bulkAssignMutation.isPending}
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {bulkAssignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Assign all
          </button>
        </div>
      )}

      {/* Accordion list */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
            <span className="ml-2 text-gray-500">Loading files...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Unassigned — bulk-imported files awaiting a standard */}
            {renderUnassignedAccordion()}
            {/* Introduction — files referenced in the program introduction */}
            {renderIntroductionAccordion()}
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
