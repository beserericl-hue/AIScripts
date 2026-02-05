import React, { useState } from 'react';
import { Trash2, FileText, Grid3X3, BookOpen, Eye, Loader2, Zap, CheckCircle2, Send } from 'lucide-react';

// Standard names for display - CSHSE Standards 1-21 (Build verification)
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

export interface TaggedSection {
  id: string;
  sectionType: 'standard' | 'matrix' | 'appendix' | 'skip' | 'narrative' | 'supporting_evidence';
  standardCode?: string;
  specCode?: string;
  title: string;
  previewText?: string;
  endPreviewText?: string; // Last 100 chars - helps frontend find where extraction ends
  contentLength?: number;
  createdAt?: string;
  appliedDirectly?: boolean; // If true, already applied to submission (skips N8N)
}

interface TaggedSectionsListProps {
  sections: TaggedSection[];
  isLoading: boolean;
  onDelete: (sectionId: string) => void;
  onView: (section: TaggedSection) => void;
  onApply: (section: TaggedSection, targetStandardCode: string, targetSpecCode: string) => Promise<void>;
  deletingId: string | null;
  applyingId: string | null;
}

/**
 * TaggedSectionsList - Displays list of already tagged sections
 *
 * Features:
 * - Shows section type icon and label
 * - Shows standard mapping for standard sections
 * - View content button
 * - Delete button with confirmation
 * - Progress indicator
 */
// Specification options (varies by standard, but commonly a-f)
const SPEC_OPTIONS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export function TaggedSectionsList({
  sections,
  isLoading,
  onDelete,
  onView,
  onApply,
  deletingId,
  applyingId
}: TaggedSectionsListProps) {
  // State for inline apply form
  const [applyFormOpen, setApplyFormOpen] = useState<string | null>(null);
  const [selectedStandard, setSelectedStandard] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('');

  const handleApplyClick = (sectionId: string) => {
    if (applyFormOpen === sectionId) {
      setApplyFormOpen(null);
      setSelectedStandard('');
      setSelectedSpec('');
    } else {
      setApplyFormOpen(sectionId);
      setSelectedStandard('');
      setSelectedSpec('');
    }
  };

  const handleApplySubmit = async (section: TaggedSection) => {
    if (!selectedStandard || !selectedSpec) return;
    await onApply(section, selectedStandard, selectedSpec);
    setApplyFormOpen(null);
    setSelectedStandard('');
    setSelectedSpec('');
  };

  // Group sections by type
  const standardSections = sections.filter(s => s.sectionType === 'standard' || s.sectionType === 'narrative');
  const matrixSections = sections.filter(s => s.sectionType === 'matrix');
  const appendixSections = sections.filter(s => s.sectionType === 'appendix' || s.sectionType === 'supporting_evidence');

  const getSectionIcon = (sectionType: string) => {
    switch (sectionType) {
      case 'standard':
      case 'narrative':
        return <FileText className="w-4 h-4" />;
      case 'matrix':
        return <Grid3X3 className="w-4 h-4" />;
      case 'appendix':
      case 'supporting_evidence':
        return <BookOpen className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getSectionLabel = (section: TaggedSection) => {
    if ((section.sectionType === 'standard' || section.sectionType === 'narrative') && section.standardCode) {
      const standardName = STANDARD_NAMES[section.standardCode] || `Standard ${section.standardCode}`;
      return section.specCode
        ? `${section.standardCode}.${section.specCode} - ${standardName}`
        : `${section.standardCode} - ${standardName}`;
    }
    if (section.sectionType === 'matrix') {
      return 'Curriculum Matrix';
    }
    if (section.sectionType === 'appendix' || section.sectionType === 'supporting_evidence') {
      return 'Appendix / Supporting Document';
    }
    return section.title || 'Unknown Section';
  };

  const getSectionTypeColor = (sectionType: string) => {
    switch (sectionType) {
      case 'standard':
      case 'narrative':
        return 'bg-teal-100 text-teal-700';
      case 'matrix':
        return 'bg-purple-100 text-purple-700';
      case 'appendix':
      case 'supporting_evidence':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading tagged sections...
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-gray-400 mb-2">
          <FileText className="w-12 h-12 mx-auto" />
        </div>
        <p className="text-gray-500">No sections tagged yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Use the document viewer to mark and tag sections
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {/* Summary */}
      <div className="p-3 bg-gray-50 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {sections.length} section{sections.length !== 1 ? 's' : ''} tagged
        </span>
        <div className="flex items-center gap-2 text-xs">
          {standardSections.length > 0 && (
            <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">
              {standardSections.length} Standards
            </span>
          )}
          {matrixSections.length > 0 && (
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
              {matrixSections.length} Matrix
            </span>
          )}
          {appendixSections.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              {appendixSections.length} Appendix
            </span>
          )}
        </div>
      </div>

      {/* Section List */}
      {sections.map((section) => (
        <div
          key={section.id}
          className="p-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Type Icon */}
            <div className={`p-2 rounded-lg ${getSectionTypeColor(section.sectionType)}`}>
              {getSectionIcon(section.sectionType)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">
                  {getSectionLabel(section)}
                </span>
                {section.appliedDirectly && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded" title="Applied directly to standard - skips N8N processing">
                    <CheckCircle2 className="w-3 h-3" />
                    Applied
                  </span>
                )}
              </div>
              {section.title && section.title !== getSectionLabel(section) && (
                <p className="text-sm text-gray-600 truncate mt-0.5">
                  {section.title}
                </p>
              )}
              {section.previewText && (
                <p className="text-xs text-gray-400 truncate mt-1">
                  {section.previewText.substring(0, 100)}...
                </p>
              )}
              {section.contentLength && (
                <p className="text-xs text-gray-400 mt-1">
                  {section.contentLength.toLocaleString()} characters
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {/* Apply button - only show if not already applied */}
              {!section.appliedDirectly && (
                <button
                  onClick={() => handleApplyClick(section.id)}
                  disabled={applyingId === section.id}
                  className={`p-1.5 rounded transition-colors ${
                    applyFormOpen === section.id
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                  } disabled:opacity-50`}
                  title="Apply to standard"
                >
                  {applyingId === section.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={() => onView(section)}
                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                title="View content"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(section.id)}
                disabled={deletingId === section.id}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Delete section"
              >
                {deletingId === section.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Inline Apply Form */}
          {applyFormOpen === section.id && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Apply to Standard</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedStandard}
                  onChange={(e) => {
                    setSelectedStandard(e.target.value);
                    setSelectedSpec('');
                  }}
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Standard...</option>
                  {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {code}. {name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedSpec}
                  onChange={(e) => setSelectedSpec(e.target.value)}
                  disabled={!selectedStandard}
                  className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Spec...</option>
                  {SPEC_OPTIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {selectedStandard}.{spec}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleApplySubmit(section)}
                  disabled={!selectedStandard || !selectedSpec || applyingId === section.id}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {applyingId === section.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  Apply
                </button>
                <button
                  onClick={() => {
                    setApplyFormOpen(null);
                    setSelectedStandard('');
                    setSelectedSpec('');
                  }}
                  className="px-2 py-1.5 text-gray-600 text-sm hover:bg-gray-200 rounded"
                >
                  Cancel
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                This will save the content directly to the selected standard/spec in the editor.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default TaggedSectionsList;
