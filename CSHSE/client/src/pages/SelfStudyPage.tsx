import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  FileText,
  Upload,
  Plus,
  Building2,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Clock,
  CheckCircle,
  FileCheck,
  X,
  AlertCircle,
  MapPin,
  Check,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { SelfStudyEditor } from '../features/selfStudy/Editor/SelfStudyEditor';

interface Submission {
  _id: string;
  submissionId: string;
  institutionName: string;
  status: string;
  specName?: string;
  standardsStatus?: Record<string, { status: string; validationStatus: string }>;
  createdAt: string;
  updatedAt: string;
}

interface Institution {
  _id: string;
  name: string;
  specId?: string;
  specName?: string;
  currentSubmissionId?: string;
}

interface ImportStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  originalFilename: string;
  fileType: string;
  error?: string;
  extractedContent?: {
    pageCount: number;
    metadata: { title?: string; author?: string };
    sectionCount: number;
  };
  mappedCount: number;
  unmappedCount: number;
}

interface ExtractedSection {
  id: string;
  pageNumber: number;
  sectionType: string;
  content: string;
  fullContentLength: number;
  suggestedStandard?: string;
  confidence: number;
  mapping?: {
    standardCode: string;
    specCode: string;
    fieldType: string;
    mappedBy: 'auto' | 'manual';
  };
  unmappedReason?: string;
  status: 'mapped' | 'unmapped' | 'pending';
}

// Standard names for display
const STANDARD_NAMES: Record<string, string> = {
  '1': 'Program Identity',
  '2': 'Program Objectives',
  '3': 'Organizational Structure',
  '4': 'Budgetary Support',
  '5': 'Administrative Support',
  '6': 'Faculty',
  '7': 'Faculty Development',
  '8': 'Practicum/Field Experience Supervisors',
  '9': 'Student Services',
  '10': 'Admissions',
  '11': 'Curriculum',
  '12': 'Professional Practice',
  '13': 'Program Assessment',
  '14': 'Student Learning Outcomes',
  '15': 'Student Portfolio',
  '16': 'Program Advisory Committee',
  '17': 'Diversity',
  '18': 'Ethics',
  '19': 'Supervision',
  '20': 'Technology',
  '21': 'Field Experience'
};

export default function SelfStudyPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, getEffectiveRole, getEffectiveUser } = useAuthStore();
  const [showImportModal, setShowImportModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import workflow state
  const [importId, setImportId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [importStep, setImportStep] = useState<'upload' | 'processing' | 'review' | 'applying'>('upload');
  const [extractedSections, setExtractedSections] = useState<ExtractedSection[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const effectiveRole = getEffectiveRole();
  const effectiveUser = getEffectiveUser();
  const isProgramCoordinator = effectiveRole === 'program_coordinator';

  // Create submission mutation
  const createSubmissionMutation = useMutation({
    mutationFn: async (data: {
      institutionId: string;
      institutionName: string;
      programName: string;
      programLevel: string;
    }) => {
      const response = await api.post('/api/submissions', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
      // Navigate to the new submission
      if (data.submission?._id) {
        navigate(`/self-study/${data.submission._id}`);
      }
    },
    onError: (error: any) => {
      console.error('Failed to create submission:', error);
      alert(error.response?.data?.error || 'Failed to create self-study');
      setIsCreating(false);
    }
  });

  // Fetch user's institution if they are a program coordinator
  const { data: institutionData, isLoading: institutionLoading } = useQuery({
    queryKey: ['my-institution', effectiveUser?.institutionId],
    queryFn: async () => {
      if (!effectiveUser?.institutionId) return null;
      const response = await api.get(`/api/institutions/${effectiveUser.institutionId}`);
      return response.data;
    },
    enabled: isProgramCoordinator && !!effectiveUser?.institutionId
  });

  // Fetch submissions for the user
  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ['my-submissions', effectiveUser?.institutionId],
    queryFn: async () => {
      const params: any = { limit: 50 };
      if (isProgramCoordinator && effectiveUser?.institutionId) {
        params.institutionId = effectiveUser.institutionId;
      }
      const response = await api.get('/api/submissions', { params });
      return response.data;
    },
    enabled: !submissionId
  });

  const institution: Institution | null = institutionData?.institution || null;
  const submissions: Submission[] = submissionsData?.submissions || [];
  const isLoading = institutionLoading || submissionsLoading;

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
          // Fetch sections
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

  // File upload handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      ];
      if (allowedTypes.includes(file.type)) {
        setSelectedFile(file);
        setUploadError(null);
      } else {
        setUploadError('Please upload a PDF, Word, or PowerPoint file');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Need a submission to import into
    let targetSubmissionId = submissions[0]?._id;

    // If no existing submission, create one first
    if (!targetSubmissionId && institution) {
      setIsUploading(true);
      setUploadError(null);

      try {
        const createResponse = await api.post('/api/submissions', {
          institutionId: institution._id,
          institutionName: institution.name,
          programName: institution.specName || 'Self-Study',
          programLevel: 'bachelors'
        });
        targetSubmissionId = createResponse.data.submission._id;
        queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
      } catch (err: any) {
        setUploadError(err.response?.data?.error || 'Failed to create submission');
        setIsUploading(false);
        return;
      }
    }

    if (!targetSubmissionId) {
      setUploadError('No submission available. Please contact your administrator.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('submissionId', targetSubmissionId);

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
      const response = await api.post(`/api/imports/${importId}/apply`);

      // Success - navigate to editor
      const currentSubmission = submissions[0];
      if (currentSubmission) {
        queryClient.invalidateQueries({ queryKey: ['my-submissions'] });
        navigate(`/self-study/${currentSubmission._id}`);
      }
      resetImportModal();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to apply mappings');
    } finally {
      setIsApplying(false);
    }
  };

  const handleDiscardSection = async (sectionId: string) => {
    if (!importId) return;

    try {
      await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
        action: 'discard'
      });

      // Update local state
      setExtractedSections(sections =>
        sections.map(s =>
          s.id === sectionId ? { ...s, status: 'pending' as const, mapping: undefined } : s
        )
      );

      // Refresh status
      const statusResponse = await api.get(`/api/imports/${importId}`);
      setImportStatus(statusResponse.data);
    } catch (err) {
      console.error('Failed to discard section:', err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  // If viewing a specific submission
  if (submissionId) {
    return <SelfStudyEditor submissionId={submissionId} />;
  }

  // Program Coordinator - Unassigned state
  if (isProgramCoordinator && !effectiveUser?.institutionId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Unassigned University
            </h1>
            <p className="text-gray-600 mb-6">
              You have not been assigned to a university yet. Please contact your administrator
              to be assigned to an institution before you can start working on a self-study.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-500">
              <p>Your administrator will:</p>
              <ul className="mt-2 space-y-1 text-left max-w-md mx-auto">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-400" />
                  Assign you to your institution
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-400" />
                  Set up the accreditation spec for your self-study
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-400" />
                  Configure your submission deadline
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Program Coordinator view
  if (isProgramCoordinator) {
    const hasExistingSubmission = submissions.length > 0;
    const currentSubmission = submissions[0];

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Self-Study Editor</h1>
                <p className="text-sm text-gray-500">
                  {institution?.name || effectiveUser?.institutionName || 'Your Institution'}
                  {institution?.specName && (
                    <span className="ml-2 text-primary-600">• {institution.specName}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Action Cards */}
          {!hasExistingSubmission ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Start New Self-Study */}
              <button
                onClick={() => {
                  if (!institution) {
                    alert('Institution information not available. Please try again.');
                    return;
                  }
                  setIsCreating(true);
                  createSubmissionMutation.mutate({
                    institutionId: institution._id,
                    institutionName: institution.name,
                    programName: institution.specName || 'Self-Study',
                    programLevel: 'bachelors'
                  });
                }}
                disabled={isCreating || createSubmissionMutation.isPending}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left hover:border-primary-300 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                    {isCreating || createSubmissionMutation.isPending ? (
                      <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                    ) : (
                      <Plus className="w-6 h-6 text-primary-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {isCreating || createSubmissionMutation.isPending ? 'Creating...' : 'Start New Self-Study'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Begin a fresh self-study from scratch. You'll fill in each standard
                      using the guided editor.
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                </div>
              </button>

              {/* Import Existing Self-Study */}
              <button
                onClick={() => setShowImportModal(true)}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-left hover:border-primary-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                    <Upload className="w-6 h-6 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-teal-600 transition-colors">
                      Import Existing Self-Study
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload a PDF, Word, or PowerPoint file. We'll extract the content
                      and automatically map it to the standards.
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-teal-600 transition-colors" />
                </div>
              </button>
            </div>
          ) : (
            /* Existing Submission Card */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Your Self-Study</h2>
              </div>
              <div className="p-6">
                <div
                  onClick={() => navigate(`/self-study/${currentSubmission._id}`)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <FileCheck className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {currentSubmission.institutionName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          currentSubmission.status === 'draft'
                            ? 'bg-gray-100 text-gray-700'
                            : currentSubmission.status === 'submitted'
                            ? 'bg-blue-100 text-blue-700'
                            : currentSubmission.status === 'under_review'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {currentSubmission.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated {new Date(currentSubmission.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>

              {/* Import Option for Existing Submission */}
              <div className="px-6 pb-6">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700"
                >
                  <Upload className="w-4 h-4" />
                  Import content from file
                </button>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">About Your Self-Study</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Your self-study will be organized according to the CSHSE accreditation standards.
                  You can save your progress at any time and return to complete it later.
                  Once submitted, your self-study will be reviewed by assigned readers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Import Self-Study Document
                  </h3>
                  {importStep !== 'upload' && importStatus && (
                    <p className="text-sm text-gray-500 mt-1">
                      {importStatus.originalFilename}
                    </p>
                  )}
                </div>
                <button
                  onClick={resetImportModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {/* Error display */}
                {uploadError && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{uploadError}</span>
                  </div>
                )}

                {/* Step: Upload */}
                {importStep === 'upload' && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      selectedFile ? 'border-teal-400 bg-teal-50' : 'border-gray-300 hover:border-primary-400'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    {selectedFile ? (
                      <>
                        <FileText className="w-12 h-12 text-teal-600 mx-auto mb-4" />
                        <p className="text-teal-700 font-medium mb-1">{selectedFile.name}</p>
                        <p className="text-sm text-teal-600 mb-4">
                          {formatFileSize(selectedFile.size)}
                        </p>
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => setSelectedFile(null)}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                          >
                            Remove
                          </button>
                          <button
                            onClick={handleUpload}
                            disabled={isUploading}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
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
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-2">
                          Drag and drop your file here, or click to browse
                        </p>
                        <p className="text-sm text-gray-500 mb-4">
                          Supports PDF, Word (.docx), and PowerPoint (.pptx) files (max 50MB)
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                        >
                          Select File
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Step: Processing */}
                {importStep === 'processing' && (
                  <div className="text-center py-8">
                    <Loader2 className="w-12 h-12 text-teal-600 mx-auto mb-4 animate-spin" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Processing Document
                    </h4>
                    <p className="text-sm text-gray-500 mb-4">
                      We're extracting content and analyzing your document...
                    </p>
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      This may take a moment
                    </div>
                  </div>
                )}

                {/* Step: Review Mappings */}
                {importStep === 'review' && importStatus && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-6 h-6 text-teal-600" />
                        <div>
                          <h4 className="font-medium text-teal-900">Document Processed Successfully</h4>
                          <p className="text-sm text-teal-700">
                            {importStatus.extractedContent?.pageCount} pages • {importStatus.extractedContent?.sectionCount} sections extracted
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Mapping Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-green-600" />
                          <span className="text-2xl font-bold text-green-700">{importStatus.mappedCount}</span>
                        </div>
                        <p className="text-sm text-green-600 mt-1">Sections auto-mapped to standards</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                          <span className="text-2xl font-bold text-amber-700">{importStatus.unmappedCount}</span>
                        </div>
                        <p className="text-sm text-amber-600 mt-1">Sections need review</p>
                      </div>
                    </div>

                    {/* Section List */}
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">Extracted Sections</h5>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {extractedSections.map((section) => (
                          <div
                            key={section.id}
                            className={`p-3 rounded-lg border ${
                              section.status === 'mapped'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-amber-50 border-amber-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {section.status === 'mapped' ? (
                                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                  )}
                                  <span className="text-sm font-medium text-gray-900">
                                    {section.mapping ? (
                                      <>Standard {section.mapping.standardCode}{section.mapping.specCode ? `.${section.mapping.specCode}` : ''}: {STANDARD_NAMES[section.mapping.standardCode] || 'Unknown'}</>
                                    ) : (
                                      <span className="text-amber-700">{section.unmappedReason || 'Needs manual mapping'}</span>
                                    )}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">
                                  {section.content}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-400">Page {section.pageNumber}</span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-400 capitalize">{section.sectionType}</span>
                                  {section.mapping?.mappedBy === 'auto' && (
                                    <>
                                      <span className="text-xs text-gray-400">•</span>
                                      <span className="text-xs text-green-600">Auto-mapped ({Math.round(section.confidence * 100)}%)</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              {section.status === 'unmapped' && (
                                <button
                                  onClick={() => handleDiscardSection(section.id)}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                  title="Discard section"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-700">
                        <strong>Note:</strong> You can review and edit the imported content after it's applied to your self-study.
                        Unmapped sections can be manually assigned in the editor.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                <button
                  onClick={resetImportModal}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                {importStep === 'review' && (
                  <button
                    onClick={handleApplyMappings}
                    disabled={isApplying}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Applying...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Apply to Self-Study
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

  // Default view for other roles (Admin, Lead Reader, Reader)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Self-Study Editor</h1>
              <p className="text-sm text-gray-500">
                Select a submission to view or review
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {submissions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">No Submissions</h2>
            <p className="text-gray-500">
              There are no submissions assigned to you for review.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Submissions</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {submissions.map((submission) => (
                <div
                  key={submission._id}
                  onClick={() => navigate(`/self-study/${submission._id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {submission.institutionName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          submission.status === 'draft'
                            ? 'bg-gray-100 text-gray-700'
                            : submission.status === 'submitted'
                            ? 'bg-blue-100 text-blue-700'
                            : submission.status === 'under_review'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {submission.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">
                          {submission.submissionId}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
