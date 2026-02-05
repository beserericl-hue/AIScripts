import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Maximize2,
  ArrowRight,
  PlayCircle,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useNavigate } from 'react-router-dom';
import { StandardsNavigation } from './StandardsNavigation';
import { NarrativeEditor } from './NarrativeEditor';
import { EvidencePanel } from './EvidencePanel';
import { CurriculumMatrixEditor } from '../MatrixEditor';
import { DocumentViewer, SectionTagger, TaggedSectionsList, type SectionMetadata, type TaggedSection, type SelectionData, type TaggedSectionInfo } from './components';

// Use consistent API paths without relying on environment variable

interface SelfStudyEditorProps {
  submissionId: string;
}

interface NarrativeContent {
  standardCode: string;
  specCode: string;
  content: string;
  lastModified?: Date;
  supportingEvidenceText?: string;
}

interface SubmissionData {
  _id: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'under_review' | 'readers_assigned' | 'review_complete' | 'compliant' | 'non_compliant';
  narrativeContent: NarrativeContent[];
  standardsStatus: Record<string, {
    status: 'not_started' | 'in_progress' | 'complete' | 'submitted' | 'validated';
    validationStatus?: 'pending' | 'pass' | 'fail';
  }>;
  readerLock?: {
    isLocked: boolean;
    lockReason?: string;
  };
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

interface ParsingDetails {
  tocEntriesFound?: number;
  tocTitles?: string[];
  sectionsCreated?: number;
  sectionTitles?: string[];
  currentSectionIndex?: number;
}

interface ImportProgress {
  step: 'initializing' | 'parsing' | 'analyzing' | 'matching' | 'complete' | 'error' | string;
  stepDescription: string;
  totalSections: number;
  receivedSections: number;
  percentComplete: number;
  elapsedTime?: string;
  elapsedMs?: number;
  n8nSentAt?: string;
  recentMappings: Array<{
    standardCode: string;
    specCode: string;
    mappedBy: string;
  }>;
  parsingDetails?: ParsingDetails;
}

interface ImportStatus {
  id: string;
  status: 'pending' | 'processing' | 'awaiting_selection' | 'completed' | 'failed';
  originalFilename: string;
  mappedCount: number;
  unmappedCount: number;
  error?: string;
  specName?: string;
  progress?: ImportProgress;
  extractedContent?: { pageCount: number; sectionCount: number };
}

// Part 6: Detected section for user selection
interface DetectedSection {
  id: string;
  level: 1 | 2 | 3;
  headerType: 'roman' | 'letter' | 'number' | 'standard' | 'appendix' | 'heading';
  headerText: string;
  previewText: string;
  fullContent: string;
  htmlContent: string;
  startPosition: number;
  endPosition: number;
  isAppendix: boolean;
  isSelected: boolean;
  parentId?: string;
  children: DetectedSection[];
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
  // AI suggestions for unmapped sections
  suggestedStandardCode?: string;
  suggestedSpecCode?: string;
  suggestedConfidence?: number;
}

// Type for tracking unmapped section assignments
interface UnmappedAssignment {
  standardCode: string;
  specCode: string;
  toSupportingEvidence: boolean;
  toCurriculumMatrix: boolean;
}

// Part 6: Component for rendering section selection items with hierarchy
function SectionSelectionItem({
  section,
  onToggle,
  onViewFull,
  level = 0
}: {
  section: DetectedSection;
  onToggle: (id: string, selected: boolean) => void;
  onViewFull: (section: DetectedSection) => void;
  level?: number;
}) {
  const paddingLeft = level * 20;

  return (
    <>
      <div
        className={`flex items-start gap-3 p-3 hover:bg-gray-50 ${
          section.isAppendix ? 'bg-amber-50' : ''
        }`}
        style={{ paddingLeft: `${12 + paddingLeft}px` }}
      >
        <input
          type="checkbox"
          checked={section.isSelected}
          onChange={(e) => onToggle(section.id, e.target.checked)}
          disabled={section.isAppendix}
          className="mt-1 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {section.isAppendix && (
              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                Appendix
              </span>
            )}
            <span className="font-medium text-gray-900 truncate">
              {section.headerText}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
            {section.previewText}
          </p>
        </div>
        <button
          onClick={() => onViewFull(section)}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap"
        >
          View Full
        </button>
      </div>
      {section.children.map((child) => (
        <SectionSelectionItem
          key={child.id}
          section={child}
          onToggle={onToggle}
          onViewFull={onViewFull}
          level={level + 1}
        />
      ))}
    </>
  );
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
  const [importStep, setImportStep] = useState<'upload' | 'processing' | 'manual_tagging' | 'section_selection' | 'review' | 'applying'>('upload');

  // Session persistence - resume existing import
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [existingImportInfo, setExistingImportInfo] = useState<{
    id: string;
    status: string;
    originalFilename: string;
    uploadedAt: string;
    taggedSectionsCount: number;
  } | null>(null);
  const [isCheckingExistingImport, setIsCheckingExistingImport] = useState(false);
  const [isDiscardingImport, setIsDiscardingImport] = useState(false);
  const [extractedSections, setExtractedSections] = useState<ExtractedSection[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // State for managing unmapped section assignments
  const [unmappedAssignments, setUnmappedAssignments] = useState<Record<string, UnmappedAssignment>>({});
  const [movingSection, setMovingSection] = useState<string | null>(null);

  // Batch assignment state for sections (both mapped and unmapped)
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [batchAssignment, setBatchAssignment] = useState<UnmappedAssignment>({
    standardCode: '',
    specCode: '',
    toSupportingEvidence: false,
    toCurriculumMatrix: false
  });
  const [isBatchMoving, setIsBatchMoving] = useState(false);

  // State for viewing full section content
  const [expandedSection, setExpandedSection] = useState<ExtractedSection | null>(null);
  const [loadingFullContent, setLoadingFullContent] = useState(false);

  // Part 6: State for section selection before AI processing
  const [detectedSections, setDetectedSections] = useState<DetectedSection[]>([]);
  const [appendixSection, setAppendixSection] = useState<DetectedSection | null>(null);
  const [isConfirmingSelections, setIsConfirmingSelections] = useState(false);
  const [viewingFullSection, setViewingFullSection] = useState<DetectedSection | null>(null);

  // Manual Tagging Workflow State
  const [documentHtml, setDocumentHtml] = useState<string>('');
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [taggedSections, setTaggedSections] = useState<TaggedSection[]>([]);
  const [showTaggedSections, setShowTaggedSections] = useState(true);
  const [isLoadingTaggedSections, setIsLoadingTaggedSections] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<SelectionData | null>(null);
  const documentViewerRef = useRef<HTMLDivElement>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [viewingTaggedSection, setViewingTaggedSection] = useState<TaggedSection | null>(null);
  const [viewingFullContent, setViewingFullContent] = useState<string | null>(null);
  const [viewingHtmlContent, setViewingHtmlContent] = useState<string | null>(null); // HTML content for formatting
  const [isLoadingFullContent, setIsLoadingFullContent] = useState(false);

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

  // Save supporting evidence mutation
  const saveSupportingEvidenceMutation = useMutation({
    mutationFn: async ({
      standardCode,
      specCode,
      supportingEvidenceText,
    }: {
      standardCode: string;
      specCode: string;
      supportingEvidenceText: string;
    }) => {
      await api.patch(`/api/submissions/${submissionId}/narrative`, {
        standardCode,
        specCode,
        supportingEvidenceText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Submit standard mutation (for individual standard validation)
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

  // Submit entire self-study mutation (locks submission for review)
  const submitSelfStudyMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/submissions/${submissionId}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Poll import status
  useEffect(() => {
    if (!importId || importStep !== 'processing') return;

    console.log('[Import Poll] Starting polling for import:', importId);

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/api/imports/${importId}`);
        const status = response.data as ImportStatus;
        console.log('[Import Poll] Status received:', status.status, {
          progress: status.progress,
          mappedCount: status.mappedCount,
          unmappedCount: status.unmappedCount
        });
        setImportStatus(status);

        if (status.status === 'awaiting_selection') {
          // Manual Tagging Workflow: Load document for visual tagging
          console.log('[Import Poll] Status is awaiting_selection - loading document for manual tagging');
          clearInterval(pollInterval);
          try {
            // Load document HTML content from temp file
            const contentResponse = await api.get(`/api/imports/${importId}/content`);
            console.log('[Import Poll] Document content loaded:', {
              htmlLength: contentResponse.data.htmlContent?.length || 0
            });
            setDocumentHtml(contentResponse.data.htmlContent || '');

            // Load any already tagged sections
            const taggedResponse = await api.get(`/api/imports/${importId}/tagged-sections`);
            console.log('[Import Poll] Tagged sections loaded:', {
              count: taggedResponse.data.sections?.length || 0
            });
            setTaggedSections(taggedResponse.data.sections || []);

            setImportStep('manual_tagging');
            console.log('[Import Poll] Transitioned to manual_tagging step');
          } catch (loadErr: any) {
            console.error('[Import Poll] Failed to load document for manual tagging:', loadErr);
            setUploadError(loadErr.response?.data?.error || 'Failed to load document content');
          }
        } else if (status.status === 'completed') {
          console.log('[Import Poll] Status is completed - fetching extracted sections');
          clearInterval(pollInterval);
          const sectionsResponse = await api.get(`/api/imports/${importId}/sections`);
          setExtractedSections(sectionsResponse.data.sections);
          setImportStep('review');
        } else if (status.status === 'failed') {
          console.log('[Import Poll] Status is failed:', status.error);
          clearInterval(pollInterval);
          setUploadError(status.error || 'Document processing failed');
          setImportStep('upload');
        } else {
          console.log('[Import Poll] Status is still:', status.status);
        }
      } catch (err) {
        console.error('[Import Poll] Failed to poll import status:', err);
      }
    }, 2000);

    return () => {
      console.log('[Import Poll] Stopping polling');
      clearInterval(pollInterval);
    };
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

  const handleCancelImport = async () => {
    if (!importId) return;

    setIsCancelling(true);
    try {
      await api.post(`/api/imports/${importId}/cancel`);
      resetImportModal();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to cancel import');
    } finally {
      setIsCancelling(false);
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
    setUnmappedAssignments({});
    setMovingSection(null);
    // Reset batch assignment state
    setSelectedSectionIds(new Set());
    setBatchAssignment({ standardCode: '', specCode: '', toSupportingEvidence: false, toCurriculumMatrix: false });
    setIsBatchMoving(false);
    // Reset Part 6 section selection state
    setDetectedSections([]);
    setAppendixSection(null);
    setViewingFullSection(null);
    // Reset manual tagging state
    setDocumentHtml('');
    setDocumentError(null);
    setTaggedSections([]);
    setCurrentSelection(null);
    setSectionError(null);
    setViewingTaggedSection(null);
    // Reset resume dialog state
    setShowResumeDialog(false);
    setExistingImportInfo(null);
  };

  // Check for existing in-progress import when user clicks Import Document
  // Auto-resumes if found - no dialog needed
  const handleImportButtonClick = async () => {
    setIsCheckingExistingImport(true);
    setUploadError(null);

    try {
      const response = await api.get(`/api/imports/check/${submissionId}`);

      if (response.data.hasExistingImport) {
        // Found an existing import - auto-resume directly (no dialog)
        const existingImport = response.data.import;
        setExistingImportInfo(existingImport);
        setImportId(existingImport.id);
        setShowImportModal(true);
        setImportStep('manual_tagging');
        // Document content and tagged sections will be loaded by useEffect
      } else {
        // No existing import - show fresh upload modal
        setShowImportModal(true);
        setImportStep('upload');
      }
    } catch (err: any) {
      // If check fails, just show the upload modal
      console.error('Failed to check for existing import:', err);
      setShowImportModal(true);
      setImportStep('upload');
    } finally {
      setIsCheckingExistingImport(false);
    }
  };

  // Save progress and exit - closes the import panel
  // Progress is already auto-saved with each tagged section
  const handleSaveProgressAndExit = () => {
    setShowImportModal(false);
    // Don't reset importId or other state - preserve for next time
    // Just close the modal
  };

  // Start over - discard existing import and show upload screen
  const handleStartOver = async () => {
    const idToDiscard = importId || existingImportInfo?.id;
    if (!idToDiscard) return;

    setIsDiscardingImport(true);

    try {
      await api.delete(`/api/imports/${idToDiscard}/discard`);

      // Reset all import state and show upload screen
      setImportId(null);
      setExistingImportInfo(null);
      setImportStep('upload');
      setDocumentHtml('');
      setTaggedSections([]);
      setCurrentSelection(null);
      setSectionError(null);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to discard import');
    } finally {
      setIsDiscardingImport(false);
    }
  };

  // Manual Tagging: Load document content from temp file
  const loadDocumentContent = async () => {
    if (!importId) return;

    setIsLoadingDocument(true);
    setDocumentError(null);

    try {
      const response = await api.get(`/api/imports/${importId}/content`);
      setDocumentHtml(response.data.htmlContent);
    } catch (err: any) {
      setDocumentError(err.response?.data?.error || 'Failed to load document content');
    } finally {
      setIsLoadingDocument(false);
    }
  };

  // Manual Tagging: Load tagged sections
  const loadTaggedSections = async () => {
    if (!importId) return;

    setIsLoadingTaggedSections(true);

    try {
      const response = await api.get(`/api/imports/${importId}/tagged-sections`);
      setTaggedSections(response.data.sections || []);
    } catch (err: any) {
      console.error('Failed to load tagged sections:', err);
    } finally {
      setIsLoadingTaggedSections(false);
    }
  };

  // Manual Tagging: Handle selection capture from DocumentViewer
  // User selects text by dragging, clicks "Capture Selection" button
  const handleSelectionCapture = useCallback((selection: SelectionData | null) => {
    setCurrentSelection(selection);
    setSectionError(null);
  }, []);

  // Manual Tagging: Clear selection - resets everything
  const handleClearSelection = useCallback(() => {
    setCurrentSelection(null);
    setSectionError(null);
    // Also clear browser selection
    window.getSelection()?.removeAllRanges();
  }, []);

  // Manual Tagging: Save section
  // Uses HTML content already captured in SelectionData
  // If applyDirectly is true, saves directly to the submission's narrative (skips N8N)
  const handleSaveSection = async (metadata: SectionMetadata) => {
    if (!importId || !currentSelection) return;

    setIsSavingSection(true);
    setSectionError(null);

    try {
      // Selection already contains the HTML - send directly to backend
      const extractedHtml = currentSelection.html;
      const extractedText = currentSelection.text;

      if (!extractedHtml.trim()) {
        throw new Error('No content selected');
      }

      // If applyDirectly is true and we have standard/spec, save directly to submission
      if (metadata.applyDirectly && metadata.standardCode && metadata.specCode) {
        // Save directly to the submission's narrative using the existing mutation
        await saveMutation.mutateAsync({
          standardCode: metadata.standardCode,
          specCode: metadata.specCode,
          content: extractedText, // Use plain text for narrative content
        });

        // Also save to tagged sections for tracking (marked as applied)
        await api.post(`/api/imports/${importId}/extract-section`, {
          htmlContent: extractedHtml,
          sectionType: 'standard',
          standardCode: metadata.standardCode,
          specCode: metadata.specCode,
          title: metadata.title,
          appliedDirectly: true // Flag to indicate it was already applied
        });

        // Refresh document content
        await loadDocumentContent();

        // Refresh tagged sections list
        await loadTaggedSections();

        // Clear selection
        handleClearSelection();

        // Show success feedback - briefly navigate to the standard to show it was applied
        // (This refreshes the narrative content in the editor)
        queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });

        return;
      }

      // Normal flow: Send extracted HTML to backend for N8N processing later
      await api.post(`/api/imports/${importId}/extract-section`, {
        htmlContent: extractedHtml,
        sectionType: metadata.sectionType,
        standardCode: metadata.standardCode,
        specCode: metadata.specCode,
        title: metadata.title
      });

      // Refresh document content
      await loadDocumentContent();

      // Refresh tagged sections list
      await loadTaggedSections();

      // Clear selection
      handleClearSelection();
    } catch (err: any) {
      setSectionError(err.response?.data?.error || err.message || 'Failed to save section');
    } finally {
      setIsSavingSection(false);
    }
  };

  // Manual Tagging: Delete tagged section
  const handleDeleteTaggedSection = async (sectionId: string) => {
    if (!importId) return;

    setDeletingSectionId(sectionId);

    try {
      await api.delete(`/api/imports/${importId}/tagged-sections/${sectionId}`);

      // Refresh tagged sections list
      await loadTaggedSections();

      // Note: Content is not restored to the document (as per plan)
    } catch (err: any) {
      setSectionError(err.response?.data?.error || 'Failed to delete section');
    } finally {
      setDeletingSectionId(null);
    }
  };

  // Manual Tagging: View tagged section content (fetch full content from API)
  const handleViewTaggedSection = async (section: TaggedSection) => {
    setViewingTaggedSection(section);
    setViewingFullContent(null);
    setViewingHtmlContent(null);
    setIsLoadingFullContent(true);

    try {
      const response = await api.get(`/api/imports/${importId}/tagged-sections/${section.id}`);
      setViewingFullContent(response.data.fullContent || 'No content available');
      // Store HTML content separately for formatted display
      setViewingHtmlContent(response.data.htmlContent || null);
    } catch (err: any) {
      console.error('Failed to load full section content:', err);
      setViewingFullContent(section.previewText || 'Failed to load content');
    } finally {
      setIsLoadingFullContent(false);
    }
  };

  // Manual Tagging: Finish tagging and proceed
  const handleFinishTagging = async () => {
    if (!importId) return;

    setIsConfirmingSelections(true);
    setSectionError(null);

    try {
      const response = await api.post(`/api/imports/${importId}/finish-tagging`, {
        skipAiProcessing: true // For now, skip AI and go directly to review
      });

      // Transition to review step or completed
      if (response.data.status === 'completed') {
        setImportStatus(prev => prev ? { ...prev, status: 'completed' } : null);
        setImportStep('review');
        // Reload extracted sections for review
        const sectionsResponse = await api.get(`/api/imports/${importId}/sections`);
        setExtractedSections(sectionsResponse.data.sections || []);
      } else {
        // Proceed to AI processing (if enabled)
        setImportStep('processing');
      }
    } catch (err: any) {
      setSectionError(err.response?.data?.error || 'Failed to finish tagging');
    } finally {
      setIsConfirmingSelections(false);
    }
  };

  // Part 6: Toggle section selection
  const handleToggleSectionSelection = (sectionId: string, isSelected: boolean) => {
    const updateSelection = (sections: DetectedSection[]): DetectedSection[] => {
      return sections.map(section => {
        if (section.id === sectionId) {
          return { ...section, isSelected };
        }
        if (section.children.length > 0) {
          return { ...section, children: updateSelection(section.children) };
        }
        return section;
      });
    };
    setDetectedSections(prev => updateSelection(prev));
  };

  // Part 6: Select/deselect all sections
  const handleSelectAllSections = (selectAll: boolean) => {
    const updateAll = (sections: DetectedSection[]): DetectedSection[] => {
      return sections.map(section => ({
        ...section,
        isSelected: section.isAppendix ? false : selectAll,
        children: updateAll(section.children)
      }));
    };
    setDetectedSections(prev => updateAll(prev));
  };

  // Part 6: Count selected sections
  const countSelectedSections = (sections: DetectedSection[]): number => {
    let count = 0;
    for (const section of sections) {
      if (section.isSelected && !section.isAppendix) count++;
      count += countSelectedSections(section.children);
    }
    return count;
  };

  // Part 6: Confirm section selections and proceed to AI processing
  const handleConfirmSectionSelections = async () => {
    if (!importId) return;

    const selectedCount = countSelectedSections(detectedSections);
    if (selectedCount === 0) {
      setUploadError('Please select at least one section to process');
      return;
    }

    setIsConfirmingSelections(true);
    setUploadError(null);

    try {
      // First, save the section selections
      const getSelections = (sections: DetectedSection[]): Array<{ id: string; isSelected: boolean }> => {
        const result: Array<{ id: string; isSelected: boolean }> = [];
        for (const section of sections) {
          result.push({ id: section.id, isSelected: section.isSelected });
          result.push(...getSelections(section.children));
        }
        return result;
      };

      await api.post(`/api/imports/${importId}/select-sections`, {
        selections: getSelections(detectedSections)
      });

      // Then confirm and start AI processing
      await api.post(`/api/imports/${importId}/confirm-selections`);

      // Move to processing step (will poll for completion)
      setImportStep('processing');
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to confirm section selections');
    } finally {
      setIsConfirmingSelections(false);
    }
  };

  // Part 6: View full section content
  const handleViewDetectedSectionContent = async (section: DetectedSection) => {
    setViewingFullSection(section);
  };

  // Fetch full section content and open modal
  const handleViewFullContent = async (section: ExtractedSection) => {
    if (!importId) {
      // If no importId, just show the truncated content we have
      setExpandedSection(section);
      return;
    }

    setLoadingFullContent(true);
    setExpandedSection(section); // Show modal immediately with loading state

    try {
      const response = await api.get(`/api/imports/${importId}/sections/${section.id}`);
      // Update expandedSection with full content
      setExpandedSection({
        ...section,
        content: response.data.content,
        unmappedReason: response.data.unmappedReason,
        suggestedStandardCode: response.data.suggestedStandardCode,
        suggestedSpecCode: response.data.suggestedSpecCode,
        suggestedConfidence: response.data.suggestedConfidence,
      });
    } catch (err) {
      console.error('Failed to fetch full section content:', err);
      // Keep showing the truncated content if fetch fails
    } finally {
      setLoadingFullContent(false);
    }
  };

  // Handle moving an unmapped section to a spec or curriculum matrix
  const handleMoveUnmapped = async (sectionId: string) => {
    if (!importId) return;

    // Get the section to access AI suggestions
    const section = extractedSections.find(s => s.id === sectionId);
    const assignment = unmappedAssignments[sectionId];

    // Check if moving to curriculum matrix
    const toCurriculumMatrix = assignment?.toCurriculumMatrix || false;

    // Use user assignment if available, otherwise fall back to AI suggestions
    const standardCode = assignment?.standardCode || section?.suggestedStandardCode || '';
    const specCode = assignment?.specCode || section?.suggestedSpecCode || '';
    const toSupportingEvidence = assignment?.toSupportingEvidence || false;

    // Require standard/spec selection unless moving to curriculum matrix
    if (!toCurriculumMatrix && (!standardCode || !specCode)) {
      setUploadError('Please select a standard and specification');
      return;
    }

    setMovingSection(sectionId);
    setUploadError(null);

    try {
      if (toCurriculumMatrix) {
        // Move to curriculum matrix
        await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
          action: 'move_to_matrix',
          toCurriculumMatrix: true,
          matrixType: 'non_human_services_courses'
        });
      } else {
        // Move to standard/spec
        await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
          action: 'assign',
          standardCode,
          specCode,
          toSupportingEvidence
        });
      }

      // Remove from extracted sections list
      setExtractedSections(prev => prev.filter(s => s.id !== sectionId));

      // Clear the assignment
      setUnmappedAssignments(prev => {
        const newAssignments = { ...prev };
        delete newAssignments[sectionId];
        return newAssignments;
      });

      // Refresh submission data
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to move content');
    } finally {
      setMovingSection(null);
    }
  };

  // Handle discarding an unmapped section
  const handleDiscardUnmapped = async (sectionId: string) => {
    if (!importId) return;

    if (!window.confirm('Discard this content? It will not be imported.')) {
      return;
    }

    setMovingSection(sectionId);
    try {
      await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
        action: 'discard'
      });

      // Remove from extracted sections list
      setExtractedSections(prev => prev.filter(s => s.id !== sectionId));
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to discard content');
    } finally {
      setMovingSection(null);
    }
  };

  // Update unmapped assignment
  const updateUnmappedAssignment = (sectionId: string, update: Partial<UnmappedAssignment>) => {
    setUnmappedAssignments(prev => ({
      ...prev,
      [sectionId]: {
        standardCode: prev[sectionId]?.standardCode || '',
        specCode: prev[sectionId]?.specCode || '',
        toSupportingEvidence: prev[sectionId]?.toSupportingEvidence || false,
        toCurriculumMatrix: prev[sectionId]?.toCurriculumMatrix || false,
        ...update
      }
    }));
  };

  // Batch selection handlers
  const toggleSectionSelection = (sectionId: string) => {
    setSelectedSectionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const selectAllSections = () => {
    const allIds = extractedSections.map(s => s.id);
    setSelectedSectionIds(new Set(allIds));
  };

  const selectNoneSections = () => {
    setSelectedSectionIds(new Set());
  };

  // Batch move handler
  const handleBatchMoveSections = async () => {
    if (!importId || selectedSectionIds.size === 0) return;

    // Require standard/spec selection unless moving to curriculum matrix
    if (!batchAssignment.toCurriculumMatrix && (!batchAssignment.standardCode || !batchAssignment.specCode)) {
      setUploadError('Please select a standard and specification');
      return;
    }

    setIsBatchMoving(true);
    setUploadError(null);

    let successCount = 0;
    let failCount = 0;

    for (const sectionId of selectedSectionIds) {
      try {
        if (batchAssignment.toCurriculumMatrix) {
          // Move to curriculum matrix
          await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
            action: 'move_to_matrix',
            toCurriculumMatrix: true,
            matrixType: 'non_human_services_courses'
          });
        } else {
          // Move to standard/spec
          await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
            action: 'assign',
            standardCode: batchAssignment.standardCode,
            specCode: batchAssignment.specCode,
            toSupportingEvidence: batchAssignment.toSupportingEvidence
          });
        }
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Failed to move section ${sectionId}:`, err);
      }
    }

    // Remove successfully moved sections from list
    setExtractedSections(prev =>
      prev.filter(s => !selectedSectionIds.has(s.id) || failCount > 0)
    );
    setSelectedSectionIds(new Set());

    // Refresh submission data
    queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });

    if (failCount > 0) {
      setUploadError(`Moved ${successCount} section(s), ${failCount} failed`);
    }

    setIsBatchMoving(false);
  };

  // Batch discard handler
  const handleBatchDiscardSections = async () => {
    if (!importId || selectedSectionIds.size === 0) return;

    if (!window.confirm(`Discard ${selectedSectionIds.size} selected section(s)? This content will not be imported.`)) {
      return;
    }

    setIsBatchMoving(true);
    setUploadError(null);

    let successCount = 0;
    let failCount = 0;

    for (const sectionId of selectedSectionIds) {
      try {
        await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
          action: 'discard'
        });
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Failed to discard section ${sectionId}:`, err);
      }
    }

    // Remove successfully discarded sections from list
    if (successCount > 0) {
      setExtractedSections(prev =>
        prev.filter(s => !selectedSectionIds.has(s.id))
      );
    }
    setSelectedSectionIds(new Set());

    if (failCount > 0) {
      setUploadError(`Discarded ${successCount} section(s), ${failCount} failed`);
    }

    setIsBatchMoving(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get current content for selected standard/spec
  const getCurrentContent = useCallback(() => {
    if (!submission || !selectedSpec) return '';
    const narrative = (submission.narrativeContent || []).find(
      (n) => n.standardCode === selectedStandard && n.specCode === selectedSpec
    );
    return narrative?.content || '';
  }, [submission, selectedStandard, selectedSpec]);

  // Get current supporting evidence text for selected standard/spec
  const getCurrentSupportingEvidence = useCallback(() => {
    if (!submission || !selectedSpec) return '';
    const narrative = (submission.narrativeContent || []).find(
      (n) => n.standardCode === selectedStandard && n.specCode === selectedSpec
    );
    return narrative?.supportingEvidenceText || '';
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
      ? (standard.specifications || []).find((sp) => sp.code === selectedSpec)
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
      specifications: (standard.specifications || []).map((spec) => ({
        specCode: spec.code,
        specTitle: spec.title,
        status:
          submission?.standardsStatus?.[`${standard.code}.${spec.code}`]?.status ||
          'not_started',
        validationStatus:
          submission?.standardsStatus?.[`${standard.code}.${spec.code}`]?.validationStatus,
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

  // Handle save supporting evidence
  const handleSaveSupportingEvidence = useCallback(
    async (supportingEvidenceText: string) => {
      if (!selectedSpec) return;
      await saveSupportingEvidenceMutation.mutateAsync({
        standardCode: selectedStandard,
        specCode: selectedSpec,
        supportingEvidenceText,
      });
    },
    [saveSupportingEvidenceMutation, selectedStandard, selectedSpec]
  );

  // Handle submit entire self-study for review (locks submission)
  const handleSubmitSelfStudy = useCallback(async () => {
    const confirmMessage = `Submit Self-Study for Review?\n\nThis will lock the self-study for review by the lead reader. You will not be able to make edits until the review is complete.\n\nMake sure you have saved all your changes first.`;
    if (window.confirm(confirmMessage)) {
      await submitSelfStudyMutation.mutateAsync();
    }
  }, [submitSelfStudyMutation]);

  // Calculate validated specs count for progress display
  const validationProgress = React.useMemo(() => {
    if (!standards || !submission?.standardsStatus) {
      return { validated: 0, total: 0 };
    }

    let validated = 0;
    let total = 0;

    for (const standard of standards) {
      for (const spec of standard.specifications || []) {
        total++;
        const status = submission.standardsStatus?.[`${standard.code}.${spec.code}`];
        if (status?.validationStatus === 'pass') {
          validated++;
        }
      }
    }

    return { validated, total };
  }, [standards, submission?.standardsStatus]);

  // Check if entire self-study is ready for submission (all specs validated)
  const isSelfStudyReadyForSubmit = React.useMemo(() => {
    if (!standards || !submission?.standardsStatus) return false;

    // Check ALL specs across ALL standards
    return standards.every(standard =>
      (standard.specifications || []).every(spec => {
        const status = submission.standardsStatus?.[`${standard.code}.${spec.code}`];
        return status?.validationStatus === 'pass';
      })
    );
  }, [standards, submission?.standardsStatus]);

  // Check if submission is already submitted or locked
  const isSubmissionLocked = React.useMemo(() => {
    return submission?.status === 'submitted' ||
           submission?.status === 'under_review' ||
           submission?.readerLock?.isLocked;
  }, [submission?.status, submission?.readerLock?.isLocked]);

  // Navigate to next/prev spec
  const navigateSpec = useCallback(
    (direction: 'next' | 'prev') => {
      if (!standards) return;
      const currentStandard = standards.find((s) => s.code === selectedStandard);
      if (!currentStandard) return;

      const specs = currentStandard.specifications || [];
      const currentIndex = specs.findIndex((s) => s.code === selectedSpec);

      if (direction === 'next') {
        if (currentIndex < specs.length - 1) {
          setSelectedSpec(specs[currentIndex + 1].code);
        } else {
          // Move to next standard
          const standardIndex = standards.findIndex((s) => s.code === selectedStandard);
          if (standardIndex < standards.length - 1) {
            const nextStandard = standards[standardIndex + 1];
            setSelectedStandard(nextStandard.code);
            setSelectedSpec((nextStandard.specifications || [])[0]?.code || null);
          }
        }
      } else {
        if (currentIndex > 0) {
          setSelectedSpec(specs[currentIndex - 1].code);
        } else {
          // Move to prev standard
          const standardIndex = standards.findIndex((s) => s.code === selectedStandard);
          if (standardIndex > 0) {
            const prevStandard = standards[standardIndex - 1];
            setSelectedStandard(prevStandard.code);
            const prevSpecs = prevStandard.specifications || [];
            const lastSpec = prevSpecs[prevSpecs.length - 1];
            setSelectedSpec(lastSpec?.code || null);
          }
        }
      }
    },
    [standards, selectedStandard, selectedSpec]
  );

  // Debug: Log render state
  console.log('SelfStudyEditor render:', {
    loadingSubmission,
    loadingStandards,
    submissionError,
    standardsError,
    hasSubmission: !!submission,
    hasStandards: !!standards,
    submissionId
  });

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

  // Handle case where data is missing (shouldn't happen but safety check)
  if (!submission || !standards) {
    console.error('SelfStudyEditor: Data missing after loading completed', { submission, standards });
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Data Not Available</h2>
          <p className="text-gray-600 mb-4">The submission data could not be loaded. Please try again.</p>
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
    <div className="self-study-editor flex flex-col bg-gray-50 h-[calc(100vh-64px)]">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
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
              onClick={handleImportButtonClick}
              disabled={isCheckingExistingImport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              title="Import content from a PDF, Word, or PowerPoint document"
            >
              {isCheckingExistingImport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Import Document
            </button>

            {/* Validation Progress */}
            <span className="text-sm text-gray-500">
              {validationProgress.validated}/{validationProgress.total} Validated
            </span>

            {/* Submit Self-Study Button */}
            <button
              onClick={handleSubmitSelfStudy}
              disabled={submitSelfStudyMutation.isPending || !isSelfStudyReadyForSubmit || isSubmissionLocked}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isSubmissionLocked
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
              title={
                isSubmissionLocked
                  ? "Self-study has been submitted for review"
                  : isSelfStudyReadyForSubmit
                  ? "Submit self-study for review - this will lock the document"
                  : `All specifications must be validated before submitting (${validationProgress.validated}/${validationProgress.total} complete)`
              }
            >
              {submitSelfStudyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSubmissionLocked ? (
                <Check className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSubmissionLocked ? 'Submitted' : 'Submit Self-Study for Review'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - flex container that includes import panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Editor/Content Area - shrinks when import panel is open */}
        <div className="flex-1 flex min-w-0">
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
                      setSelectedSpec((standard?.specifications || [])[0]?.code || null);
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
              <main className="flex-1 flex flex-col p-2 min-w-0">
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
              <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto p-4">
                {selectedSpec ? (
                  <NarrativeEditor
                    submissionId={submissionId}
                    standardCode={selectedStandard}
                    specCode={selectedSpec}
                    initialContent={getCurrentContent()}
                    initialSupportingEvidence={getCurrentSupportingEvidence()}
                    standardTitle={getCurrentStandardData().standardTitle}
                    standardDescription={getCurrentStandardData().standardDescription}
                    specTitle={getCurrentStandardData().specTitle}
                    standardText={getCurrentStandardData().specText}
                    onSave={handleSave}
                    onSaveSupportingEvidence={handleSaveSupportingEvidence}
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
            <main className="flex-1 overflow-hidden p-2">
              <CurriculumMatrixEditor submissionId={submissionId} />
            </main>
          )}
        </div>

        {/* Import Document Side Panel - Part of layout, not overlay */}
        {showImportModal && (
          <div className={`${importStep === 'manual_tagging' ? 'w-[85vw] max-w-[1400px]' : 'w-[420px]'} h-full max-h-full flex-shrink-0 border-l border-gray-200 bg-white shadow-lg flex flex-col transition-all duration-300 overflow-hidden`}>
            {/* Panel Header */}
            <div className={`flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 ${
              importStep === 'review' ? 'bg-teal-50' : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {importStep === 'review' ? 'Import Review' : 'Import Document'}
                </h2>
                {/* Show resuming indicator if we have existing import info */}
                {importStep === 'manual_tagging' && existingImportInfo && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    Resuming
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Save Progress & Exit - shown during manual tagging */}
                {importStep === 'manual_tagging' && (
                  <button
                    onClick={handleSaveProgressAndExit}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    title="Save your progress and exit - you can resume later"
                  >
                    <Check className="w-4 h-4" />
                    Save & Exit
                  </button>
                )}
                <button
                  onClick={importStep === 'manual_tagging' ? handleSaveProgressAndExit : resetImportModal}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title={importStep === 'manual_tagging' ? "Save progress and close" : "Close"}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
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

              {/* Processing Step - Detailed Progress */}
              {importStep === 'processing' && (
                <div className="space-y-6">
                  {/* Header with filename and elapsed time */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Processing Document
                    </h3>
                    <p className="text-sm text-gray-500">
                      {importStatus?.originalFilename || 'Your document'}
                    </p>
                    {importStatus?.progress?.elapsedTime && (
                      <p className="text-xs text-gray-400 mt-1">
                        Elapsed: {importStatus.progress.elapsedTime}
                      </p>
                    )}
                  </div>

                  {/* Progress Steps */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    {/* Step indicators */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                      {['parsing', 'analyzing', 'matching'].map((step, index) => {
                        const currentStepIndex = ['initializing', 'parsing', 'analyzing', 'matching'].indexOf(
                          importStatus?.progress?.step || 'initializing'
                        );
                        const stepIndex = index + 1;
                        const isActive = stepIndex === currentStepIndex;
                        const isComplete = stepIndex < currentStepIndex;
                        return (
                          <React.Fragment key={step}>
                            {index > 0 && (
                              <div className={`w-8 h-0.5 ${isComplete ? 'bg-teal-500' : 'bg-gray-300'}`} />
                            )}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isComplete
                                  ? 'bg-teal-500 text-white'
                                  : isActive
                                  ? 'bg-teal-100 text-teal-700 border-2 border-teal-500'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Step labels */}
                    <div className="flex justify-between text-xs text-gray-500 mb-6 px-2">
                      <span>Parsing</span>
                      <span>Analyzing</span>
                      <span>Matching</span>
                    </div>

                    {/* Current action with spinner */}
                    <div className="flex flex-col items-center justify-center gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                        <span className="text-gray-700 font-medium">
                          {importStatus?.progress?.stepDescription || 'Initializing...'}
                        </span>
                      </div>
                      {/* Show helpful message when waiting for AI analysis */}
                      {importStatus?.progress?.step === 'analyzing' &&
                       importStatus?.progress?.elapsedMs &&
                       importStatus.progress.elapsedMs > 60000 && (
                        <p className="text-xs text-gray-500 text-center mt-2 max-w-xs">
                          AI analysis is in progress. Large documents may take several minutes to process.
                        </p>
                      )}
                    </div>

                    {/* Show discovered sections during parsing - show tocTitles first, then sectionTitles when available */}
                    {((importStatus?.progress?.parsingDetails?.tocEntriesFound && importStatus.progress.parsingDetails.tocEntriesFound > 0) ||
                      (importStatus?.progress?.parsingDetails?.sectionsCreated && importStatus.progress.parsingDetails.sectionsCreated > 0)) && (
                      <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-3 py-2 bg-teal-50 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-sm font-medium text-teal-800">
                            {importStatus?.progress?.parsingDetails?.sectionsCreated
                              ? 'Sections to Process'
                              : 'TOC Entries Found'}
                          </span>
                          <span className="text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">
                            {importStatus?.progress?.parsingDetails?.sectionsCreated || importStatus?.progress?.parsingDetails?.tocEntriesFound} found
                          </span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {/* Show sectionTitles if available, otherwise show tocTitles */}
                          {(importStatus?.progress?.parsingDetails?.sectionTitles && importStatus.progress.parsingDetails.sectionTitles.length > 0
                            ? importStatus.progress.parsingDetails.sectionTitles
                            : importStatus?.progress?.parsingDetails?.tocTitles || []
                          ).map((title, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 text-xs text-gray-600 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                            >
                              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded text-gray-500 text-xs">
                                {idx + 1}
                              </span>
                              <span className="truncate">{title}</span>
                            </div>
                          ))}
                          {/* Show "and X more" for sections */}
                          {importStatus?.progress?.parsingDetails?.sectionsCreated &&
                           importStatus.progress.parsingDetails.sectionsCreated > (importStatus.progress.parsingDetails.sectionTitles?.length || 0) && (
                            <div className="px-3 py-1.5 text-xs text-gray-400 italic">
                              ... and {importStatus.progress.parsingDetails.sectionsCreated - (importStatus.progress.parsingDetails.sectionTitles?.length || 0)} more
                            </div>
                          )}
                          {/* Show "and X more" for TOC entries (when sections not yet created) */}
                          {!importStatus?.progress?.parsingDetails?.sectionsCreated &&
                           importStatus?.progress?.parsingDetails?.tocEntriesFound &&
                           importStatus.progress.parsingDetails.tocEntriesFound > (importStatus.progress.parsingDetails.tocTitles?.length || 0) && (
                            <div className="px-3 py-1.5 text-xs text-gray-400 italic">
                              ... and {importStatus.progress.parsingDetails.tocEntriesFound - (importStatus.progress.parsingDetails.tocTitles?.length || 0)} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Progress bar (when matching) */}
                    {importStatus?.progress?.step === 'matching' && importStatus.progress.totalSections > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Sections processed</span>
                          <span>{importStatus.progress.receivedSections} / {importStatus.progress.totalSections}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 transition-all duration-500"
                            style={{ width: `${importStatus.progress.percentComplete}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {importStatus?.extractedContent?.pageCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Pages</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-teal-600">
                        {importStatus?.mappedCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Mapped</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">
                        {importStatus?.unmappedCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Unmapped</div>
                    </div>
                  </div>

                  {/* Recent mappings */}
                  {importStatus?.progress?.recentMappings && importStatus.progress.recentMappings.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Recent Mappings</h4>
                        <span className="text-xs text-gray-500">{importStatus.progress.recentMappings.length} mappings</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                        {importStatus.progress.recentMappings.map((mapping, index) => (
                          <div key={index} className="px-4 py-2 flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="font-medium text-gray-900">
                              Standard {mapping.standardCode}.{mapping.specCode}
                            </span>
                            <span className="text-gray-500">-</span>
                            <span className="text-gray-600 truncate">
                              {STANDARD_NAMES[mapping.standardCode] || 'Unknown Standard'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Tagging Step - Horizontal Split Layout */}
              {importStep === 'manual_tagging' && (
                <div className="flex flex-col h-full -m-4">
                  {/* Main Content - Horizontal Split */}
                  <div className="flex-1 flex min-h-0">
                    {/* Left: Document Viewer (takes most space) */}
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                      {/* Document Header */}
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                        <h3 className="text-lg font-semibold text-gray-900">Document Content</h3>
                        <p className="text-sm text-gray-500">Select text by dragging, then click "Capture Selection"</p>
                      </div>
                      {/* Document Viewer - Full Height with scroll */}
                      <div className="flex-1 min-h-0 h-full">
                        <DocumentViewer
                          importId={importId || ''}
                          htmlContent={documentHtml}
                          isLoading={isLoadingDocument}
                          error={documentError}
                          onSelectionCapture={handleSelectionCapture}
                          onRefresh={loadDocumentContent}
                          hasSelection={currentSelection !== null}
                          taggedSections={taggedSections.map(s => ({
                            id: s.id,
                            title: s.title,
                            previewText: s.previewText || '',
                            contentLength: s.contentLength || 0
                          }))}
                        />
                      </div>
                    </div>

                    {/* Right: Controls Panel (fixed width) */}
                    <div className="w-80 flex-shrink-0 border-l border-gray-200 flex flex-col overflow-hidden bg-gray-50">
                      {/* Section Tagger */}
                      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
                        <SectionTagger
                          selection={currentSelection}
                          onClearSelection={handleClearSelection}
                          onSaveSection={handleSaveSection}
                          isSaving={isSavingSection}
                          error={sectionError}
                        />
                      </div>

                      {/* Tagged Sections - Expandable */}
                      <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        <button
                          onClick={() => setShowTaggedSections(!showTaggedSections)}
                          className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between hover:bg-gray-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-4 h-4 transition-transform ${showTaggedSections ? '' : '-rotate-90'}`} />
                            <h4 className="font-medium text-gray-700">Tagged Sections</h4>
                          </div>
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                            {taggedSections.length}
                          </span>
                        </button>
                        {showTaggedSections && (
                          <div className="flex-1 overflow-y-auto">
                            <TaggedSectionsList
                              sections={taggedSections}
                              isLoading={isLoadingTaggedSections}
                              onDelete={handleDeleteTaggedSection}
                              onView={handleViewTaggedSection}
                              deletingId={deletingSectionId}
                            />
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="p-3 bg-gray-50 border-t border-gray-200 flex flex-col gap-2 flex-shrink-0">
                        <button
                          onClick={handleFinishTagging}
                          disabled={isConfirmingSelections || taggedSections.length === 0}
                          className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                        >
                          {isConfirmingSelections ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              Finish Tagging ({taggedSections.length})
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                        <button
                          onClick={handleCancelImport}
                          disabled={isConfirmingSelections}
                          className="w-full px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                        >
                          Cancel Import
                        </button>

                        {/* Start Over link */}
                        <div className="text-center pt-1">
                          <button
                            onClick={handleStartOver}
                            disabled={isDiscardingImport || isConfirmingSelections}
                            className="text-xs text-gray-400 hover:text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isDiscardingImport ? 'Discarding...' : 'Start Over (discard all progress)'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* View Tagged Section Modal */}
                  {viewingTaggedSection && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {viewingTaggedSection.title}
                          </h3>
                          <button
                            onClick={() => {
                              setViewingTaggedSection(null);
                              setViewingFullContent(null);
                              setViewingHtmlContent(null);
                            }}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                          {isLoadingFullContent ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-6 h-6 animate-spin text-teal-600 mr-2" />
                              <span className="text-gray-500">Loading full content...</span>
                            </div>
                          ) : viewingHtmlContent ? (
                            // Render HTML content to preserve formatting (tables, lists, etc.)
                            <>
                              <style>{`
                                .tagged-section-content table {
                                  border-collapse: collapse;
                                  width: 100%;
                                  margin: 1rem 0;
                                }
                                .tagged-section-content th,
                                .tagged-section-content td {
                                  border: 1px solid #d1d5db;
                                  padding: 0.5rem 0.75rem;
                                  text-align: left;
                                }
                                .tagged-section-content th {
                                  background: #f3f4f6;
                                  font-weight: 600;
                                }
                                .tagged-section-content tr:nth-child(even) {
                                  background: #f9fafb;
                                }
                                .tagged-section-content p {
                                  margin: 0.5rem 0;
                                }
                                .tagged-section-content ul,
                                .tagged-section-content ol {
                                  margin: 0.5rem 0;
                                  padding-left: 1.5rem;
                                }
                              `}</style>
                              <div
                                className="tagged-section-content prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: viewingHtmlContent }}
                              />
                            </>
                          ) : (
                            // Fallback to plain text
                            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                              {viewingFullContent || viewingTaggedSection.previewText || 'No content available'}
                            </div>
                          )}
                          {viewingTaggedSection.contentLength && !isLoadingFullContent && (
                            <p className="text-sm text-gray-400 mt-4 pt-4 border-t">
                              Total content: {viewingTaggedSection.contentLength.toLocaleString()} characters
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-end p-4 border-t border-gray-200 bg-gray-50">
                          <button
                            onClick={() => {
                              setViewingTaggedSection(null);
                              setViewingFullContent(null);
                              setViewingHtmlContent(null);
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Part 6: Section Selection Step (Legacy - kept for backwards compatibility) */}
              {importStep === 'section_selection' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Select Sections to Process
                    </h3>
                    <p className="text-sm text-gray-500">
                      {detectedSections.length > 0 ? (
                        <>
                          {countSelectedSections(detectedSections)} of {detectedSections.reduce((acc, s) => acc + 1 + countSelectedSections(s.children), 0)} sections selected
                        </>
                      ) : (
                        'Loading sections...'
                      )}
                    </p>
                  </div>

                  {/* Select All / None */}
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <button
                      onClick={() => handleSelectAllSections(true)}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleSelectAllSections(false)}
                      className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Select None
                    </button>
                  </div>

                  {/* Section List */}
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {detectedSections.map((section) => (
                      <SectionSelectionItem
                        key={section.id}
                        section={section}
                        onToggle={handleToggleSectionSelection}
                        onViewFull={handleViewDetectedSectionContent}
                        level={0}
                      />
                    ))}
                    {detectedSections.length === 0 && (
                      <div className="p-4 text-center text-gray-500">
                        No sections detected in the document
                      </div>
                    )}
                  </div>

                  {/* Error message */}
                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {uploadError}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleCancelImport}
                      disabled={isConfirmingSelections}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmSectionSelections}
                      disabled={isConfirmingSelections || countSelectedSections(detectedSections) === 0}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isConfirmingSelections ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Process {countSelectedSections(detectedSections)} Sections
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Full Section Content Modal */}
              {viewingFullSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {viewingFullSection.headerText}
                      </h3>
                      <button
                        onClick={() => setViewingFullSection(null)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: viewingFullSection.htmlContent }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={viewingFullSection.isSelected}
                          onChange={(e) => {
                            handleToggleSectionSelection(viewingFullSection.id, e.target.checked);
                            setViewingFullSection({ ...viewingFullSection, isSelected: e.target.checked });
                          }}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        Include this section for processing
                      </label>
                      <button
                        onClick={() => setViewingFullSection(null)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
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

                  {/* Batch Assignment UI for All Sections */}
                  {extractedSections.length > 0 && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-800">
                          Assign Sections
                        </h4>
                        <div className="flex items-center gap-2 text-sm">
                          <button
                            onClick={selectAllSections}
                            className="text-teal-600 hover:text-teal-700 underline"
                          >
                            Select All
                          </button>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={selectNoneSections}
                            className="text-teal-600 hover:text-teal-700 underline"
                          >
                            Select None
                          </button>
                          <span className="text-gray-500 ml-2">
                            ({selectedSectionIds.size} selected)
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={batchAssignment.standardCode}
                          onChange={(e) => setBatchAssignment(prev => ({
                            ...prev,
                            standardCode: e.target.value,
                            specCode: '' // Reset spec when standard changes
                          }))}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                          disabled={batchAssignment.toCurriculumMatrix}
                        >
                          <option value="">Select Standard...</option>
                          {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                            <option key={code} value={code}>
                              Std {code}: {name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={batchAssignment.specCode}
                          onChange={(e) => setBatchAssignment(prev => ({
                            ...prev,
                            specCode: e.target.value
                          }))}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                          disabled={!batchAssignment.standardCode || batchAssignment.toCurriculumMatrix}
                        >
                          <option value="">Select Spec...</option>
                          {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((spec) => (
                            <option key={spec} value={spec}>
                              Spec {spec}
                            </option>
                          ))}
                        </select>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={batchAssignment.toSupportingEvidence}
                            onChange={(e) => setBatchAssignment(prev => ({
                              ...prev,
                              toSupportingEvidence: e.target.checked,
                              toCurriculumMatrix: e.target.checked ? false : prev.toCurriculumMatrix
                            }))}
                            disabled={batchAssignment.toCurriculumMatrix}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                          />
                          Supporting Evidence
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={batchAssignment.toCurriculumMatrix}
                            onChange={(e) => setBatchAssignment(prev => ({
                              ...prev,
                              toCurriculumMatrix: e.target.checked,
                              // Clear standard/spec when moving to matrix
                              standardCode: e.target.checked ? '' : prev.standardCode,
                              specCode: e.target.checked ? '' : prev.specCode,
                              toSupportingEvidence: e.target.checked ? false : prev.toSupportingEvidence
                            }))}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          To Curriculum Matrix
                        </label>

                        <button
                          onClick={handleBatchMoveSections}
                          disabled={
                            isBatchMoving ||
                            selectedSectionIds.size === 0 ||
                            (!batchAssignment.toCurriculumMatrix && (!batchAssignment.standardCode || !batchAssignment.specCode))
                          }
                          className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${
                            batchAssignment.toCurriculumMatrix
                              ? 'bg-purple-600 hover:bg-purple-700'
                              : 'bg-teal-600 hover:bg-teal-700'
                          }`}
                        >
                          {isBatchMoving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {batchAssignment.toCurriculumMatrix ? 'Move to Matrix' : 'Move Selected'} ({selectedSectionIds.size})
                        </button>

                        <button
                          onClick={handleBatchDiscardSections}
                          disabled={isBatchMoving || selectedSectionIds.size === 0}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {isBatchMoving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Discard Selected
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sections List */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
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
                            {/* Checkbox for batch selection (all sections) */}
                            <input
                              type="checkbox"
                              checked={selectedSectionIds.has(section.id)}
                              onChange={() => toggleSectionSelection(section.id)}
                              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
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
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Page {section.pageNumber} |{' '}
                              {Math.round(section.confidence * 100)}% confidence
                            </span>
                            <button
                              onClick={() => handleViewFullContent(section)}
                              className="p-1 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded transition-colors"
                              title="View full content"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Content preview */}
                        <div
                          className="text-sm text-gray-700 mb-3 max-h-32 overflow-y-auto border border-gray-200 bg-white rounded p-2 cursor-pointer hover:border-teal-300"
                          onClick={() => handleViewFullContent(section)}
                          dangerouslySetInnerHTML={{
                            __html: section.content.substring(0, 500) + (section.content.length > 500 ? '...' : '')
                          }}
                          title="Click to view full content"
                        />

                        {section.unmappedReason && (
                          <p className="text-xs text-amber-600 mb-3">
                            {section.unmappedReason}
                          </p>
                        )}

                        {/* Unmapped section controls */}
                        {section.status === 'unmapped' && (
                          <div className="border-t border-amber-200 pt-3 mt-3 space-y-3">
                            {/* AI suggestion if available */}
                            {section.suggestedStandardCode && (
                              <p className="text-xs text-blue-600">
                                💡 AI suggests: Standard {section.suggestedStandardCode}
                                {section.suggestedSpecCode && `.${section.suggestedSpecCode}`}
                                {section.suggestedConfidence && ` (${section.suggestedConfidence}% confidence)`}
                              </p>
                            )}

                            {/* Standard/Spec dropdowns */}
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={unmappedAssignments[section.id]?.standardCode || section.suggestedStandardCode || ''}
                                onChange={(e) => {
                                  updateUnmappedAssignment(section.id, {
                                    standardCode: e.target.value,
                                    specCode: '' // Reset spec when standard changes
                                  });
                                }}
                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                                disabled={unmappedAssignments[section.id]?.toCurriculumMatrix}
                              >
                                <option value="">Select Standard...</option>
                                {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                                  <option key={code} value={code}>
                                    Std {code}: {name}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={unmappedAssignments[section.id]?.specCode || section.suggestedSpecCode || ''}
                                onChange={(e) => {
                                  updateUnmappedAssignment(section.id, { specCode: e.target.value });
                                }}
                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                                disabled={(!unmappedAssignments[section.id]?.standardCode && !section.suggestedStandardCode) || unmappedAssignments[section.id]?.toCurriculumMatrix}
                              >
                                <option value="">Select Spec...</option>
                                {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((spec) => (
                                  <option key={spec} value={spec}>
                                    Spec {spec}
                                  </option>
                                ))}
                              </select>

                              <label className="flex items-center gap-1 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={unmappedAssignments[section.id]?.toSupportingEvidence || false}
                                  onChange={(e) => {
                                    updateUnmappedAssignment(section.id, {
                                      toSupportingEvidence: e.target.checked,
                                      toCurriculumMatrix: e.target.checked ? false : unmappedAssignments[section.id]?.toCurriculumMatrix
                                    });
                                  }}
                                  disabled={unmappedAssignments[section.id]?.toCurriculumMatrix}
                                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                                />
                                Evidence
                              </label>

                              <label className="flex items-center gap-1 text-xs text-purple-700">
                                <input
                                  type="checkbox"
                                  checked={unmappedAssignments[section.id]?.toCurriculumMatrix || false}
                                  onChange={(e) => {
                                    updateUnmappedAssignment(section.id, {
                                      toCurriculumMatrix: e.target.checked,
                                      // Clear standard/spec when moving to matrix
                                      standardCode: e.target.checked ? '' : unmappedAssignments[section.id]?.standardCode,
                                      specCode: e.target.checked ? '' : unmappedAssignments[section.id]?.specCode,
                                      toSupportingEvidence: e.target.checked ? false : unmappedAssignments[section.id]?.toSupportingEvidence
                                    });
                                  }}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                Matrix
                              </label>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleMoveUnmapped(section.id)}
                                disabled={
                                  movingSection === section.id ||
                                  (!unmappedAssignments[section.id]?.toCurriculumMatrix &&
                                    ((!unmappedAssignments[section.id]?.standardCode && !section.suggestedStandardCode) ||
                                    (!unmappedAssignments[section.id]?.specCode && !section.suggestedSpecCode)))
                                }
                                className={`flex items-center gap-1 px-3 py-1 text-xs text-white rounded disabled:opacity-50 disabled:cursor-not-allowed ${
                                  unmappedAssignments[section.id]?.toCurriculumMatrix
                                    ? 'bg-purple-600 hover:bg-purple-700'
                                    : 'bg-teal-600 hover:bg-teal-700'
                                }`}
                              >
                                {movingSection === section.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                {unmappedAssignments[section.id]?.toCurriculumMatrix ? 'Move to Matrix' : 'Move to Spec'}
                              </button>
                              <button
                                onClick={() => handleDiscardUnmapped(section.id)}
                                disabled={movingSection === section.id}
                                className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Discard
                              </button>
                            </div>
                          </div>
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

            {/* Modal Footer - flex-shrink-0 ensures buttons are always visible */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              {/* Close/Cancel button - different behavior based on step */}
              {importStep === 'processing' ? (
                <button
                  onClick={handleCancelImport}
                  disabled={isCancelling}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Cancel Import
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={resetImportModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {importStep === 'review' ? 'Close' : 'Cancel'}
                </button>
              )}

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
        )}
      </div>

      {/* Full Content Viewer Modal */}
      {expandedSection && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-teal-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Section Content
                  </h2>
                  <p className="text-sm text-gray-500">
                    Page {expandedSection.pageNumber} | {Math.round(expandedSection.confidence * 100)}% confidence
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExpandedSection(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Unmapped reason if available */}
              {expandedSection.unmappedReason && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700">
                    <strong>AI Analysis:</strong> {expandedSection.unmappedReason}
                  </p>
                </div>
              )}

              {/* AI suggestion if available */}
              {expandedSection.suggestedStandardCode && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 <strong>AI Suggestion:</strong> Standard {expandedSection.suggestedStandardCode}
                    {expandedSection.suggestedSpecCode && `.${expandedSection.suggestedSpecCode}`}
                    {expandedSection.suggestedConfidence && ` (${expandedSection.suggestedConfidence}% confidence)`}
                  </p>
                </div>
              )}

              {/* Full content */}
              <div className="prose prose-sm max-w-none">
                {loadingFullContent ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                    <span className="ml-2 text-gray-500">Loading full content...</span>
                  </div>
                ) : (
                  <div
                    className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: expandedSection.content }}
                  />
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setExpandedSection(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
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
