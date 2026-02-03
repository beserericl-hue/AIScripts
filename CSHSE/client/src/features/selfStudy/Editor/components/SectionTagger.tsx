import React, { useState, useEffect } from 'react';
import { MapPin, Trash2, Save, Loader2, AlertCircle } from 'lucide-react';

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

// Specification options (varies by standard, but commonly a-f)
const SPEC_OPTIONS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export type SectionType = 'standard' | 'matrix' | 'appendix' | 'skip';

export interface SectionMetadata {
  sectionType: SectionType;
  standardCode?: string;
  specCode?: string;
  title: string;
}

interface SectionTaggerProps {
  startOffset: number | null;
  endOffset: number | null;
  previewText: string;
  onMarkStart: () => void;
  onMarkEnd: () => void;
  onClearSelection: () => void;
  onSaveSection: (metadata: SectionMetadata) => Promise<void>;
  isSaving: boolean;
  error: string | null;
}

/**
 * SectionTagger - Controls for marking and saving document sections
 *
 * Features:
 * - Mark Start / Mark End buttons
 * - Section type selection (Standard, Matrix, Appendix, Skip)
 * - Standard number and specification selection (for Standard type)
 * - Title input (auto-filled from first line of selection)
 * - Save and Clear buttons
 */
export function SectionTagger({
  startOffset,
  endOffset,
  previewText,
  onMarkStart,
  onMarkEnd,
  onClearSelection,
  onSaveSection,
  isSaving,
  error
}: SectionTaggerProps) {
  const [sectionType, setSectionType] = useState<SectionType>('standard');
  const [standardCode, setStandardCode] = useState('');
  const [specCode, setSpecCode] = useState('');
  const [title, setTitle] = useState('');

  // Auto-fill title from preview text
  useEffect(() => {
    if (previewText && !title) {
      // Extract first line as title
      const firstLine = previewText.split('\n')[0].trim();
      // Limit to 100 characters
      setTitle(firstLine.substring(0, 100));
    }
  }, [previewText]);

  // Clear form after successful save
  const handleSave = async () => {
    if (!canSave) return;

    const metadata: SectionMetadata = {
      sectionType,
      title: title.trim() || 'Untitled Section',
      ...(sectionType === 'standard' && standardCode && {
        standardCode,
        specCode: specCode || undefined
      })
    };

    await onSaveSection(metadata);

    // Reset form (offset clearing is handled by parent)
    setSectionType('standard');
    setStandardCode('');
    setSpecCode('');
    setTitle('');
  };

  const hasSelection = startOffset !== null && endOffset !== null;
  const canSave = hasSelection &&
    (sectionType === 'skip' ||
     sectionType === 'appendix' ||
     sectionType === 'matrix' ||
     (sectionType === 'standard' && standardCode));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-teal-600" />
          Section Tagger
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Mark section boundaries and assign metadata
        </p>
      </div>

      {/* Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Position Buttons */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Step 1: Mark Boundaries
          </label>
          <div className="flex gap-2">
            <button
              onClick={onMarkStart}
              disabled={isSaving}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                startOffset !== null
                  ? 'bg-green-100 text-green-700 border-2 border-green-500'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
              }`}
            >
              {startOffset !== null ? `Start: ${startOffset}` : 'Mark Start'}
            </button>
            <button
              onClick={onMarkEnd}
              disabled={startOffset === null || isSaving}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                endOffset !== null
                  ? 'bg-red-100 text-red-700 border-2 border-red-500'
                  : startOffset !== null
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent'
                  : 'bg-gray-50 text-gray-400 cursor-not-allowed border-2 border-transparent'
              }`}
            >
              {endOffset !== null ? `End: ${endOffset}` : 'Mark End'}
            </button>
          </div>
          {startOffset !== null && (
            <button
              onClick={onClearSelection}
              disabled={isSaving}
              className="w-full px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Preview */}
        {previewText && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Selection Preview
            </label>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600 max-h-32 overflow-y-auto">
              {previewText.substring(0, 500)}
              {previewText.length > 500 && '...'}
            </div>
          </div>
        )}

        {/* Section Type */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Step 2: Section Type
          </label>
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value as SectionType)}
            disabled={isSaving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="standard">Standard (1-21)</option>
            <option value="matrix">Curriculum Matrix</option>
            <option value="appendix">Appendix / Supporting Document</option>
            <option value="skip">Skip / Ignore</option>
          </select>
        </div>

        {/* Standard-specific fields */}
        {sectionType === 'standard' && (
          <div className="space-y-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Standard Number *
              </label>
              <select
                value={standardCode}
                onChange={(e) => setStandardCode(e.target.value)}
                disabled={isSaving}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select a standard...</option>
                {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code}. {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Specification (optional)
              </label>
              <select
                value={specCode}
                onChange={(e) => setSpecCode(e.target.value)}
                disabled={isSaving || !standardCode}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">All specifications / General</option>
                {SPEC_OPTIONS.map((spec) => (
                  <option key={spec} value={spec}>
                    {standardCode}.{spec}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Section Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSaving}
            placeholder="Enter a title for this section"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <p className="text-xs text-gray-500">
            Auto-filled from the first line of your selection
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className={`w-full px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            canSave && !isSaving
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving Section...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {sectionType === 'skip' ? 'Remove Content' : 'Save Section'}
            </>
          )}
        </button>

        {!hasSelection && (
          <p className="text-xs text-center text-gray-500">
            Click in the document to mark the start and end of a section
          </p>
        )}
      </div>
    </div>
  );
}

export default SectionTagger;
