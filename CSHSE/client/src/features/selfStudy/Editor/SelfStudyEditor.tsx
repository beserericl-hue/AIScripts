import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Send,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Paperclip,
  Home,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StandardsNavigation } from './StandardsNavigation';
import { NarrativeEditor } from './NarrativeEditor';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
export function SelfStudyEditor({ submissionId }: SelfStudyEditorProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedStandard, setSelectedStandard] = useState('1');
  const [selectedSpec, setSelectedSpec] = useState<string | null>('a');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch submission data
  const { data: submission, isLoading: loadingSubmission } = useQuery<SubmissionData>({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/submissions/${submissionId}`);
      return response.data;
    },
  });

  // Fetch standards definitions
  const { data: standards, isLoading: loadingStandards } = useQuery<StandardDefinition[]>({
    queryKey: ['standards'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/standards`);
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
      await axios.patch(`${API_BASE}/submissions/${submissionId}/narrative`, {
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
      const response = await axios.post(
        `${API_BASE}/submissions/${submissionId}/standards/${standardCode}/submit`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

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
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading self-study editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="self-study-editor h-screen flex flex-col bg-gray-50">
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
          </div>
          <div className="flex items-center gap-4">
            {/* Overall Progress */}
            <ProgressIndicator submission={submission} />

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

          {/* Evidence Quick Actions */}
          <div className="mt-4 flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm">
              <Paperclip className="w-4 h-4" />
              Attach Evidence
            </button>
          </div>
        </main>
      </div>
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
