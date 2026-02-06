import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X, Loader2, Check, AlertCircle, Copy, Send } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../../services/api';
import type { TaggedSection } from './TaggedSectionsList';

// Standard names for dropdown
const STANDARD_NAMES: Record<string, string> = {
  '1': 'Program Identity',
  '2': 'Program Objectives',
  '3': 'Organizational Structure',
  '4': 'Budgetary Support',
  '5': 'Administrative Support',
  '6': 'Faculty',
  '7': 'Faculty Development',
  '8': 'Practicum Supervisors',
  '9': 'Student Services',
  '10': 'Admissions',
  '11': 'Curriculum',
  '12': 'Professional Practice',
  '13': 'Program Assessment',
  '14': 'Student Learning Outcomes',
  '15': 'Student Portfolio',
  '16': 'Advisory Committee',
  '17': 'Diversity',
  '18': 'Ethics',
  '19': 'Supervision',
  '20': 'Technology',
  '21': 'Field Experience'
};

const SPEC_OPTIONS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

interface SelectionState {
  html: string;
  text: string;
  previewText: string;
}

interface SubExtractionViewerModalProps {
  section: TaggedSection;
  importId: string;
  submissionId: string;
  htmlContent: string | null;
  textContent: string | null;
  isLoading: boolean;
  onClose: () => void;
  onExtractionApplied: () => void;
}

/**
 * SubExtractionViewerModal - Interactive viewer for extracted sections
 *
 * Allows users to:
 * 1. View the full content of a tagged section
 * 2. Select text within the content using cursor
 * 3. Capture the selection
 * 4. Choose destination (Standard, Spec, Narrative/Evidence)
 * 5. APPEND the content to the destination
 */
export function SubExtractionViewerModal({
  section,
  importId,
  submissionId,
  htmlContent,
  textContent,
  isLoading,
  onClose,
  onExtractionApplied
}: SubExtractionViewerModalProps) {
  const queryClient = useQueryClient();
  const contentRef = useRef<HTMLDivElement>(null);

  // Selection state
  const [currentSelection, setCurrentSelection] = useState<SelectionState | null>(null);
  const [capturedSelection, setCapturedSelection] = useState<SelectionState | null>(null);

  // Destination state
  const [targetStandard, setTargetStandard] = useState('');
  const [targetSpec, setTargetSpec] = useState('');
  const [targetField, setTargetField] = useState<'narrative' | 'supportingEvidence'>('supportingEvidence');

  // UI state
  const [isApplying, setIsApplying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Mutation to save content
  const saveMutation = useMutation({
    mutationFn: async ({
      standardCode,
      specCode,
      content,
      supportingEvidenceText
    }: {
      standardCode: string;
      specCode: string;
      content?: string;
      supportingEvidenceText?: string;
    }) => {
      await api.patch(`/api/submissions/${submissionId}/narrative`, {
        standardCode,
        specCode,
        ...(content !== undefined && { content }),
        ...(supportingEvidenceText !== undefined && { supportingEvidenceText })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    }
  });

  // Handle mouse up - detect text selection
  const handleMouseUp = useCallback(() => {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !contentRef.current) {
        setCurrentSelection(null);
        return;
      }

      const range = selection.getRangeAt(0);

      // Verify selection is within our content area
      if (!contentRef.current.contains(range.commonAncestorContainer)) {
        setCurrentSelection(null);
        return;
      }

      // Extract HTML using cloneContents() to preserve formatting
      const fragment = range.cloneContents();
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(fragment);

      const html = tempDiv.innerHTML;
      const text = tempDiv.textContent || '';

      if (text.trim().length === 0) {
        setCurrentSelection(null);
        return;
      }

      setCurrentSelection({
        html,
        text,
        previewText: text.substring(0, 200) + (text.length > 200 ? '...' : '')
      });
    }, 10);
  }, []);

  // Capture the current selection
  const handleCaptureSelection = useCallback(() => {
    if (!currentSelection) return;

    setCapturedSelection(currentSelection);
    setCurrentSelection(null);
    setSuccessMessage(null);
    setErrorMessage(null);

    // Clear browser selection
    window.getSelection()?.removeAllRanges();
  }, [currentSelection]);

  // Clear captured selection
  const handleClearSelection = useCallback(() => {
    setCapturedSelection(null);
    setTargetStandard('');
    setTargetSpec('');
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  // Fetch existing content for a standard/spec
  const fetchExistingContent = async (standardCode: string, specCode: string, field: 'narrative' | 'supportingEvidence'): Promise<string> => {
    try {
      const response = await api.get(`/api/submissions/${submissionId}`);
      const submission = response.data;

      // Find existing narrative content
      const narratives = submission.narrativeContent || [];
      const existing = narratives.find(
        (n: any) => n.standardCode === standardCode && n.specCode === specCode
      );

      if (!existing) return '';

      return field === 'narrative'
        ? (existing.content || '')
        : (existing.supportingEvidenceText || '');
    } catch (error) {
      console.error('[SubExtractionViewer] Error fetching existing content:', error);
      return '';
    }
  };

  // Apply the captured selection to the target
  const handleApplyExtraction = useCallback(async () => {
    if (!capturedSelection || !targetStandard || !targetSpec) {
      setErrorMessage('Please select a standard and specification');
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Fetch existing content
      const existingContent = await fetchExistingContent(targetStandard, targetSpec, targetField);

      // Append with separator (horizontal rule)
      const separator = existingContent.trim() ? '<hr class="my-4 border-gray-300" />' : '';
      const newContent = existingContent + separator + capturedSelection.html;

      // Save via API
      if (targetField === 'narrative') {
        await saveMutation.mutateAsync({
          standardCode: targetStandard,
          specCode: targetSpec,
          content: newContent
        });
      } else {
        await saveMutation.mutateAsync({
          standardCode: targetStandard,
          specCode: targetSpec,
          supportingEvidenceText: newContent
        });
      }

      // Success!
      const fieldLabel = targetField === 'narrative' ? 'Narrative' : 'Supporting Evidence';
      setSuccessMessage(`Content appended to Standard ${targetStandard}.${targetSpec} ${fieldLabel}`);

      // Clear selection for next extraction
      setCapturedSelection(null);
      setTargetStandard('');
      setTargetSpec('');

      // Notify parent
      onExtractionApplied();

    } catch (error: any) {
      console.error('[SubExtractionViewer] Error applying extraction:', error);
      setErrorMessage(error.message || 'Failed to save content');
    } finally {
      setIsApplying(false);
    }
  }, [capturedSelection, targetStandard, targetSpec, targetField, saveMutation, onExtractionApplied]);

  // Add event listeners
  useEffect(() => {
    const contentEl = contentRef.current;
    if (contentEl) {
      contentEl.addEventListener('mouseup', handleMouseUp);
      return () => {
        contentEl.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [handleMouseUp]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-white">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {section.title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Select text to extract and send to any standard/specification
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selection Bar - shows when text is selected but not captured */}
        {currentSelection && !capturedSelection && (
          <div className="p-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Copy className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Selected: <strong>{currentSelection.text.length.toLocaleString()}</strong> characters
              </span>
              <span className="text-xs text-blue-600 truncate max-w-md">
                "{currentSelection.previewText}"
              </span>
            </div>
            <button
              onClick={handleCaptureSelection}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Capture Selection
            </button>
          </div>
        )}

        {/* Extraction Toolbar - shows when selection is captured */}
        {capturedSelection && (
          <div className="p-3 bg-teal-50 border-b border-teal-200">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-4 h-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-800">
                Send to Standard/Specification
              </span>
              <span className="text-xs text-teal-600">
                ({capturedSelection.text.length.toLocaleString()} chars captured)
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Standard dropdown */}
              <select
                value={targetStandard}
                onChange={(e) => {
                  setTargetStandard(e.target.value);
                  setTargetSpec('');
                  setErrorMessage(null);
                }}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[200px]"
              >
                <option value="">Select Standard...</option>
                {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code}. {name}
                  </option>
                ))}
              </select>

              {/* Spec dropdown */}
              <select
                value={targetSpec}
                onChange={(e) => {
                  setTargetSpec(e.target.value);
                  setErrorMessage(null);
                }}
                disabled={!targetStandard}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-20 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Spec</option>
                {SPEC_OPTIONS.map((spec) => (
                  <option key={spec} value={spec}>
                    {targetStandard}.{spec}
                  </option>
                ))}
              </select>

              {/* Target field dropdown */}
              <select
                value={targetField}
                onChange={(e) => setTargetField(e.target.value as 'narrative' | 'supportingEvidence')}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="supportingEvidence">Supporting Evidence</option>
                <option value="narrative">Narrative</option>
              </select>

              {/* Apply button */}
              <button
                onClick={handleApplyExtraction}
                disabled={isApplying || !targetStandard || !targetSpec}
                className="px-4 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Apply
                  </>
                )}
              </button>

              {/* Clear button */}
              <button
                onClick={handleClearSelection}
                disabled={isApplying}
                className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-200 rounded-lg"
              >
                Clear
              </button>
            </div>
            <p className="text-xs text-teal-600 mt-2">
              Content will be <strong>APPENDED</strong> to existing content (never replaces).
            </p>
          </div>
        )}

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="p-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">{successMessage}</span>
            <span className="text-xs text-green-600 ml-auto">
              Select more text to continue extracting
            </span>
          </div>
        )}
        {errorMessage && (
          <div className="p-3 bg-red-50 border-b border-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-800">{errorMessage}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600 mr-2" />
              <span className="text-gray-500">Loading full content...</span>
            </div>
          ) : htmlContent ? (
            <>
              <style>{`
                .sub-extraction-content {
                  user-select: text;
                  cursor: text;
                }
                .sub-extraction-content table {
                  border-collapse: collapse;
                  width: 100%;
                  margin: 1rem 0;
                }
                .sub-extraction-content th,
                .sub-extraction-content td {
                  border: 1px solid #d1d5db;
                  padding: 0.5rem 0.75rem;
                  text-align: left;
                }
                .sub-extraction-content th {
                  background: #f3f4f6;
                  font-weight: 600;
                }
                .sub-extraction-content tr:nth-child(even) {
                  background: #f9fafb;
                }
                .sub-extraction-content p {
                  margin: 0.5rem 0;
                }
                .sub-extraction-content ul,
                .sub-extraction-content ol {
                  margin: 0.5rem 0;
                  padding-left: 1.5rem;
                }
                .sub-extraction-content ::selection {
                  background-color: #99f6e4;
                }
              `}</style>
              <div
                ref={contentRef}
                className="sub-extraction-content prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </>
          ) : (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">
              {textContent || section.previewText || 'No content available'}
            </div>
          )}

          {section.contentLength && !isLoading && (
            <p className="text-sm text-gray-400 mt-4 pt-4 border-t">
              Total content: {section.contentLength.toLocaleString()} characters
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500">
            Tip: Drag to select text, then click "Capture Selection" to extract
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubExtractionViewerModal;
