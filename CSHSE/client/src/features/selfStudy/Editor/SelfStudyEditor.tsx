import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Home,
  Upload,
  X,
  FileText,
  Check,
  AlertCircle,
  MapPin,
  Trash2,
  RefreshCw,
  Grid3X3,
  BookOpen,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import { StandardsNavigation } from './StandardsNavigation';
import { NarrativeEditor } from './NarrativeEditor';
import { EvidencePanel } from './EvidencePanel';
import { CurriculumMatrixEditor } from '../MatrixEditor';

// Use consistent API paths without relying on environment variable

interface SelfStudyEditorProps {
  submissionId: string;
}

interface NarrativeContent {
  standardCode: string;
  specCode: string;
  content: string;
  lastModified?: Date;
}

interface SubmissionData {
  _id: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  narrativeContent: NarrativeContent[];
  standardsStatus: Record<string, {
    status: 'not_started' | 'in_progress' | 'complete' | 'submitted' | 'validated';
    validationStatus?: 'pending' | 'pass' | 'fail';
  }>;
}

interface StandardDefinition {
  code: string;
  title: string;
  description: string;
  specifications: {
    code: string;
    title: string;
    text: string;
  }[];
}

/**
 * Main Self-Study Editor component
 * Provides a two-panel interface for editing accreditation self-study documents
 */
// Standard names for import display
const STANDARD_NAMES: Record<string, string> = {
  '1': 'Program Identity', '2': 'Program Objectives', '3': 'Organizational Structure',
  '4': 'Budgetary Support', '5': 'Administrative Support', '6': 'Faculty',
  '7': 'Faculty Development', '8': 'Practicum Supervisors', '9': 'Student Services',
  '10': 'Admissions', '11': 'Curriculum', '12': 'Professional Practice',
  '13': 'Program Assessment', '14': 'Student Learning Outcomes', '15': 'Student Portfolio',
  '16': 'Advisory Committee', '17': 'Diversity', '18': 'Ethics',
  '19': 'Supervision', '20': 'Technology', '21': 'Field Experience'
};

interface ImportStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  originalFilename: string;
  mappedCount: number;
  unmappedCount: number;
  error?: string;
  extractedContent?: { pageCount: number; sectionCount: number };
}

interface ExtractedSection {
  id: string;
  pageNumber: number;
  sectionType: string;
  content: string;
  confidence: number;
  mapping?: { standardCode: string; specCode: string; mappedBy: string };
  unmappedReason?: string;
  status: 'mapped' | 'unmapped' | 'pending';
}

export function SelfStudyEditor({ submissionId }: SelfStudyEditorProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStandard, setSelectedStandard] = useState('1');
  const [selectedSpec, setSelectedSpec] = useState<string | null>('a');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'standards' | 'curriculum'>('standards');

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [importStep, setImportStep] = useState<'upload' | 'processing' | 'review' | 'applying'>('upload');
  const [extractedSections, setExtractedSections] = useState<ExtractedSection[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  // Fetch submission data
  const { data: submission, isLoading: loadingSubmission, isError: submissionError, error: submissionErrorDetails } = useQuery<SubmissionData>({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const response = await api.get(`/api/submissions/${submissionId}`);
      return response.data;
    },
  });

  // Fetch standards definitions
  const { data: standards, isLoading: loadingStandards, isError: standardsError } = useQuery<StandardDefinition[]>({
    queryKey: ['standards'],
    queryFn: async () => {
      const response = await api.get(`/api/standards`);
      return response.data;
    },
  });

  // Save narrative mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      standardCode,
      specCode,
      content,
    }: {
      standardCode: string;
      specCode: string;
      content: string;
    }) => {
      await api.patch(`/api/submissions/${submissionId}/narrative`, {
        standardCode,
        specCode,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Submit standard mutation
  const submitStandardMutation = useMutation({
    mutationFn: async (standardCode: string) => {
      const response = await api.post(
        `/api/submissions/${submissionId}/standards/${standardCode}/submit`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Poll import status
  useEffect(() => {
    if (!importId || importStep !== 'processing') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/api/imports/${importId}`);
        const status = response.data as ImportStatus;
        setImportStatus(status);

        if (status.status === 'completed') {
          clearInterval(pollInterval);
          const sectionsResponse = await api.get(`/api/imports/${importId}/sections`);
          setExtractedSections(sectionsResponse.data.sections);
          setImportStep('review');
        } else if (status.status === 'failed') {
          clearInterval(pollInterval);
          setUploadError(status.error || 'Document processing failed');
          setImportStep('upload');
        }
      } catch (err) {
        console.error('Failed to poll import status:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [importId, importStep]);

  // Import handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUploadImport = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('submissionId', submissionId);

      const response = await api.post('/api/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setImportId(response.data.importId);
      setImportStep('processing');
      setSelectedFile(null);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyMappings = async () => {
    if (!importId) return;

    setIsApplying(true);
    try {
      await api.post(`/api/imports/${importId}/apply`);
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
      resetImportModal();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to apply mappings');
    } finally {
      setIsApplying(false);
    }
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setSelectedFile(null);
    setUploadError(null);
    setImportId(null);
    setImportStatus(null);
    setImportStep('upload');
    setExtractedSections([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get current content for selected standard/spec
  const getCurrentContent = useCallback(() => {
    if (!submission || !selectedSpec) return '';
    const narrative = submission.narrativeContent.find(
      (n) => n.standardCode === selectedStandard && n.specCode === selectedSpec
    );
    return narrative?.content || '';
  }, [submission, selectedStandard, selectedSpec]);

  // Get current standard data for the editor
  const getCurrentStandardData = useCallback(() => {
    if (!standards) return {
      standardTitle: '',
      standardDescription: '',
      specTitle: '',
      specText: ''
    };

    const standard = standards.find((s) => s.code === selectedStandard);
    if (!standard) return {
      standardTitle: '',
      standardDescription: '',
      specTitle: '',
      specText: ''
    };

    const spec = selectedSpec
      ? standard.specifications.find((sp) => sp.code === selectedSpec)
      : null;

    return {
      standardTitle: standard.title,
      standardDescription: standard.description,
      specTitle: spec?.title || '',
      specText: spec?.text || ''
    };
  }, [standards, selectedStandard, selectedSpec]);

  // Get current standard text (for backwards compatibility)
  const getCurrentStandardText = useCallback(() => {
    const data = getCurrentStandardData();
    return data.specText || data.standardDescription;
  }, [getCurrentStandardData]);

  // Build navigation data from standards
  const navigationData = React.useMemo(() => {
    if (!standards) return [];
    return standards.map((standard) => ({
      standardCode: standard.code,
      standardTitle: standard.title,
      status:
        submission?.standardsStatus[standard.code]?.status || 'not_started',
      specifications: standard.specifications.map((spec) => ({
        specCode: spec.code,
        specTitle: spec.title,
        status:
          submission?.standardsStatus[`${standard.code}.${spec.code}`]?.status ||
          'not_started',
        validationStatus:
          submission?.standardsStatus[`${standard.code}.${spec.code}`]?.validationStatus,
      })),
    }));
  }, [standards, submission]);

  // Handle save
  const handleSave = useCallback(
    async (content: string) => {
      if (!selectedSpec) return;
      await saveMutation.mutateAsync({
        standardCode: selectedStandard,
        specCode: selectedSpec,
        content,
      });
    },
    [saveMutation, selectedStandard, selectedSpec]
  );

  // Handle submit standard for review (triggers validation workflow)
  const handleSubmitStandard = useCallback(async () => {
    const confirmMessage = `Submit Standard ${selectedStandard} for Review?\n\nThis will trigger the validation workflow. Make sure you have saved all your changes first.`;
    if (window.confirm(confirmMessage)) {
      await submitStandardMutation.mutateAsync(selectedStandard);
    }
  }, [submitStandardMutation, selectedStandard]);

  // Check if all specifications in the selected standard are validated
  const isStandardReadyForSubmit = React.useMemo(() => {
    if (!standards || !submission?.standardsStatus) return false;

    const currentStandard = standards.find(s => s.code === selectedStandard);
    if (!currentStandard) return false;

    // Check if all specs have passed validation
    return currentStandard.specifications.every(spec => {
      const status = submission.standardsStatus[`${selectedStandard}.${spec.code}`];
      return status?.validationStatus === 'pass';
    });
  }, [standards, submission, selectedStandard]);

  // Navigate to next/prev spec
  const navigateSpec = useCallback(
    (direction: 'next' | 'prev') => {
      if (!standards) return;
      const currentStandard = standards.find((s) => s.code === selectedStandard);
      if (!currentStandard) return;

      const currentIndex = currentStandard.specifications.findIndex(
        (s) => s.code === selectedSpec
      );

      if (direction === 'next') {
        if (currentIndex < currentStandard.specifications.length - 1) {
          setSelectedSpec(currentStandard.specifications[currentIndex + 1].code);
        } else {
          // Move to next standard
          const standardIndex = standards.findIndex((s) => s.code === selectedStandard);
          if (standardIndex < standards.length - 1) {
            const nextStandard = standards[standardIndex + 1];
            setSelectedStandard(nextStandard.code);
            setSelectedSpec(nextStandard.specifications[0]?.code || null);
          }
        }
      } else {
        if (currentIndex > 0) {
          setSelectedSpec(currentStandard.specifications[currentIndex - 1].code);
        } else {
          // Move to prev standard
          const standardIndex = standards.findIndex((s) => s.code === selectedStandard);
          if (standardIndex > 0) {
            const prevStandard = standards[standardIndex - 1];
            setSelectedStandard(prevStandard.code);
            const lastSpec = prevStandard.specifications[prevStandard.specifications.length - 1];
            setSelectedSpec(lastSpec?.code || null);
          }
        }
      }
    },
    [standards, selectedStandard, selectedSpec]
  );

  if (loadingSubmission || loadingStandards) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading self-study editor...</p>
        </div>
      </div>
    );
  }

  // Handle errors
  if (submissionError || standardsError) {
    const errorMessage = (submissionErrorDetails as any)?.response?.data?.error || 'Failed to load submission data';
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Self-Study</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => navigate('/self-study')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Self-Study List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="self-study-editor min-h-[calc(100vh-160px)] flex flex-col bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 -my-6">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/self-study')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Self-Study"
            >
              <Home className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Self-Study Editor
              </h1>
              <p className="text-sm text-gray-500">
                {submission?.institutionName} - {submission?.programName}
              </p>
            </div>

            {/* View Tabs */}
            <div className="flex items-center ml-6 border-l pl-6 border-gray-200">
              <button
                onClick={() => setActiveView('standards')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'standards'
                    ? 'bg-teal-100 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                Standards
              </button>
              <button
                onClick={() => setActiveView('curriculum')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'curriculum'
                    ? 'bg-teal-100 text-teal-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Curriculum Matrix
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Overall Progress */}
            <ProgressIndicator submission={submission} />

            {/* Import Document Button */}
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              title="Import content from a PDF, Word, or PowerPoint document"
            >
              <Upload className="w-4 h-4" />
              Import Document
            </button>

            {/* Submit for Review Button - triggers workflow */}
            <button
              onClick={handleSubmitStandard}
              disabled={submitStandardMutation.isPending || !isStandardReadyForSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                isStandardReadyForSubmit
                  ? "Submit this standard for review - this action triggers the validation workflow"
                  : "All specifications must be validated before submitting for review"
              }
            >
              {submitStandardMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit Standard {selectedStandard} for Review
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Standards Editor View */}
        {activeView === 'standards' && (
          <>
            {/* Sidebar Navigation */}
            <aside
              className={`flex-shrink-0 transition-all duration-300 ${
                sidebarCollapsed ? 'w-0' : 'w-72'
              }`}
            >
              {!sidebarCollapsed && (
                <StandardsNavigation
                  standards={navigationData as any}
                  selectedStandard={selectedStandard}
                  selectedSpec={selectedSpec}
                  onSelectStandard={(code) => {
                    setSelectedStandard(code);
                    const standard = standards?.find((s) => s.code === code);
                    setSelectedSpec(standard?.specifications[0]?.code || null);
                  }}
                  onSelectSpec={(standardCode, specCode) => {
                    setSelectedStandard(standardCode);
                    setSelectedSpec(specCode);
                  }}
                />
              )}
            </aside>

            {/* Sidebar Toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex-shrink-0 w-6 bg-gray-100 hover:bg-gray-200 flex items-center justify-center border-l border-r border-gray-200 transition-colors"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              )}
            </button>

            {/* Editor Area */}
            <main className="flex-1 overflow-hidden flex flex-col p-6">
              {/* Navigation Breadcrumb */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Standard {selectedStandard}</span>
                  {selectedSpec && (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      <span className="text-gray-900 font-medium">
                        Specification {selectedSpec}
                      </span>
                    </>
                  )}
                </div>

                {/* Spec Navigation */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigateSpec('prev')}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Previous specification"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigateSpec('next')}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Next specification"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Editor Content */}
              <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto p-6">
                {selectedSpec ? (
                  <NarrativeEditor
                    submissionId={submissionId}
                    standardCode={selectedStandard}
                    specCode={selectedSpec}
                    initialContent={getCurrentContent()}
                    standardTitle={getCurrentStandardData().standardTitle}
                    standardDescription={getCurrentStandardData().standardDescription}
                    specTitle={getCurrentStandardData().specTitle}
                    standardText={getCurrentStandardData().specText}
                    onSave={handleSave}
                    onCancel={() => navigate('/self-study')}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <FileUp className="w-12 h-12 mb-4" />
                    <p>Select a specification to begin editing</p>
                  </div>
                )}
              </div>

              {/* Evidence Panel */}
              {selectedSpec && (
                <div className="mt-4">
                  <EvidencePanel
                    submissionId={submissionId}
                    standardCode={selectedStandard}
                    specCode={selectedSpec}
                  />
                </div>
              )}
            </main>
          </>
        )}

        {/* Curriculum Matrix View */}
        {activeView === 'curriculum' && (
          <main className="flex-1 overflow-hidden p-6">
            <CurriculumMatrixEditor submissionId={submissionId} />
          </main>
        )}
      </div>

      {/* Import Document Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Import Document
                </h2>
              </div>
              <button
                onClick={resetImportModal}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Upload Step */}
              {importStep === 'upload' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-gray-600 mb-2">
                      Upload a PDF, Word, or PowerPoint document to import content into your self-study.
                    </p>
                    <p className="text-sm text-gray-500">
                      The document will be analyzed and content will be mapped to the appropriate standards.
                    </p>
                  </div>

                  {/* File Input */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      selectedFile
                        ? 'border-teal-400 bg-teal-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="space-y-3">
                        <FileText className="w-12 h-12 mx-auto text-teal-600" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="font-medium text-gray-700">
                          Click to select a file
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          PDF, Word (.doc, .docx), or PowerPoint (.ppt, .pptx)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {uploadError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{uploadError}</span>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">
                      How it works:
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>1. Upload your existing self-study document</li>
                      <li>2. Our AI analyzes and extracts content sections</li>
                      <li>3. Content is mapped to CSHSE standards automatically</li>
                      <li>4. Review mappings and apply them to your current submission</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Processing Step */}
              {importStep === 'processing' && (
                <div className="text-center py-12 space-y-6">
                  <Loader2 className="w-16 h-16 animate-spin text-teal-600 mx-auto" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Processing Document
                    </h3>
                    <p className="text-gray-600">
                      {importStatus?.originalFilename || 'Your document'} is being analyzed...
                    </p>
                  </div>
                  {importStatus?.extractedContent && (
                    <div className="bg-gray-50 rounded-lg p-4 inline-block">
                      <p className="text-sm text-gray-600">
                        Found {importStatus.extractedContent.pageCount} pages,{' '}
                        {importStatus.extractedContent.sectionCount} sections
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Review Step */}
              {importStep === 'review' && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Analysis Complete
                      </h3>
                      <p className="text-sm text-gray-600">
                        {importStatus?.mappedCount || 0} sections mapped,{' '}
                        {importStatus?.unmappedCount || 0} unmapped
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        <Check className="w-4 h-4" />
                        {importStatus?.mappedCount || 0} Mapped
                      </span>
                      {(importStatus?.unmappedCount || 0) > 0 && (
                        <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                          <AlertCircle className="w-4 h-4" />
                          {importStatus?.unmappedCount || 0} Unmapped
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sections List */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {extractedSections.map((section) => (
                      <div
                        key={section.id}
                        className={`border rounded-lg p-4 ${
                          section.status === 'mapped'
                            ? 'border-green-200 bg-green-50'
                            : 'border-amber-200 bg-amber-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {section.status === 'mapped' ? (
                              <MapPin className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                            )}
                            <span className="font-medium text-gray-900">
                              {section.mapping
                                ? `Standard ${section.mapping.standardCode}${
                                    section.mapping.specCode
                                      ? `.${section.mapping.specCode}`
                                      : ''
                                  } - ${
                                    STANDARD_NAMES[section.mapping.standardCode] ||
                                    'Unknown'
                                  }`
                                : 'Unmapped Section'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            Page {section.pageNumber} |{' '}
                            {Math.round(section.confidence * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-3">
                          {section.content.substring(0, 300)}
                          {section.content.length > 300 ? '...' : ''}
                        </p>
                        {section.unmappedReason && (
                          <p className="text-xs text-amber-600 mt-2">
                            {section.unmappedReason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Error Message */}
                  {uploadError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{uploadError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={resetImportModal}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>

              {importStep === 'upload' && (
                <button
                  onClick={handleUploadImport}
                  disabled={!selectedFile || isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Process
                    </>
                  )}
                </button>
              )}

              {importStep === 'review' && (
                <button
                  onClick={handleApplyMappings}
                  disabled={isApplying || (importStatus?.mappedCount || 0) === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Apply {importStatus?.mappedCount || 0} Mappings
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Progress Indicator Component
function ProgressIndicator({ submission }: { submission?: SubmissionData }) {
  const progress = React.useMemo(() => {
    if (!submission?.standardsStatus) return { completed: 0, total: 21 };
    const statuses = Object.values(submission.standardsStatus);
    const completed = statuses.filter(
      (s) => s.status === 'complete' || s.status === 'submitted' || s.status === 'validated'
    ).length;
    return { completed, total: statuses.length || 21 };
  }, [submission]);

  const percent = Math.round((progress.completed / progress.total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm text-gray-600">
        {progress.completed}/{progress.total} Standards
      </span>
    </div>
  );
}

export default SelfStudyEditor;
