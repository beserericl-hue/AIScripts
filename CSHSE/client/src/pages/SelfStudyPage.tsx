import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
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
  Download,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { SelfStudyEditor } from '../features/selfStudy/Editor/SelfStudyEditor';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface UploadedFile {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

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

export default function SelfStudyPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, getEffectiveRole, getEffectiveUser } = useAuthStore();
  const [showImportModal, setShowImportModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const response = await axios.post(`${API_BASE}/submissions`, data);
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
      const response = await axios.get(`${API_BASE}/institutions/${effectiveUser.institutionId}`);
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
      const response = await axios.get(`${API_BASE}/submissions`, { params });
      return response.data;
    },
    enabled: !submissionId
  });

  const institution: Institution | null = institutionData?.institution || null;
  const submissions: Submission[] = submissionsData?.submissions || [];
  const isLoading = institutionLoading || submissionsLoading;

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
    if (!selectedFile || !effectiveUser?.institutionId) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('category', 'self_study_import');
      formData.append('description', `Self-study import for ${institution?.name || 'institution'}`);

      const response = await api.post('/api/files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setUploadedFile(response.data.file);
      setSelectedFile(null);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setIsUploading(false);
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
    setUploadedFile(null);
    setUploadError(null);
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
                      and help you map it to the standards.
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
              <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Import Self-Study Document
                </h3>
                <button
                  onClick={resetImportModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                {/* Error display */}
                {uploadError && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{uploadError}</span>
                  </div>
                )}

                {/* Upload success - show uploaded file */}
                {uploadedFile ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileCheck className="w-8 h-8 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">{uploadedFile.originalName}</p>
                          <p className="text-sm text-green-600">{formatFileSize(uploadedFile.size)}</p>
                        </div>
                      </div>
                      <a
                        href={`/api/files/${uploadedFile._id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-green-600 hover:text-green-800"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-700">
                        Your document has been uploaded successfully. You can now use this file as a reference
                        while completing your self-study. The content will need to be organized according to
                        the CSHSE standards in the editor.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Upload area */
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
                                Upload
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
                          Supports PDF, Word (.doc, .docx), and PowerPoint (.ppt, .pptx) files (max 50MB)
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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
              </div>
              <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={resetImportModal}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  {uploadedFile ? 'Close' : 'Cancel'}
                </button>
                {uploadedFile && (
                  <button
                    onClick={() => {
                      // If there's an existing submission, navigate to it
                      const currentSubmission = submissions[0];
                      if (currentSubmission) {
                        navigate(`/self-study/${currentSubmission._id}`);
                      }
                      resetImportModal();
                    }}
                    className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                  >
                    Continue to Self-Study
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
