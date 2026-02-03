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
    <div className="flex flex-col">
      {/* Header - Compact */}
      <div className="px-3 py-2 bg-teal-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-teal-600" />
          Section Tagger
        </h3>
      </div>

      {/* Controls - Compact spacing */}
      <div className="p-3 space-y-3 overflow-y-auto max-h-[400px]">
        {/* Position Buttons */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
            1. Mark Boundaries
          </label>
          <div className="flex gap-1.5">
            <button
              onClick={onMarkStart}
              disabled={isSaving}
              className={`flex-1 px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                startOffset !== null
                  ? 'bg-green-100 text-green-700 border border-green-400'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
              }`}
            >
              {startOffset !== null ? `Start: ${startOffset}` : 'Mark Start'}
            </button>
            <button
              onClick={onMarkEnd}
              disabled={startOffset === null || isSaving}
              className={`flex-1 px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                endOffset !== null
                  ? 'bg-red-100 text-red-700 border border-red-400'
                  : startOffset !== null
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
                  : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-transparent'
              }`}
            >
              {endOffset !== null ? `End: ${endOffset}` : 'Mark End'}
            </button>
          </div>
          {startOffset !== null && (
            <button
              onClick={onClearSelection}
              disabled={isSaving}
              className="w-full px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              Clear Selection
            </button>
          )}
        </div>

        {/* Preview - More compact */}
        {previewText && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Preview</label>
            <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 max-h-20 overflow-y-auto whitespace-pre-wrap">
              {previewText.substring(0, 300)}
              {previewText.length > 300 && '...'}
            </div>
          </div>
        )}

        {/* Section Type */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
            2. Section Type
          </label>
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value as SectionType)}
            disabled={isSaving}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="standard">Standard (1-21)</option>
            <option value="matrix">Curriculum Matrix</option>
            <option value="appendix">Appendix / Supporting Doc</option>
            <option value="skip">Skip / Ignore</option>
          </select>
        </div>

        {/* Standard-specific fields */}
        {sectionType === 'standard' && (
          <div className="space-y-2 p-2 bg-teal-50 rounded border border-teal-200">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Standard *
              </label>
              <select
                value={standardCode}
                onChange={(e) => setStandardCode(e.target.value)}
                disabled={isSaving}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">Select...</option>
                {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>
                    {code}. {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                Spec (optional)
              </label>
              <select
                value={specCode}
                onChange={(e) => setSpecCode(e.target.value)}
                disabled={isSaving || !standardCode}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="">All / General</option>
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
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSaving}
            placeholder="Section title"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        {/* Save Button - Inline with form */}
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className={`w-full px-3 py-2 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            canSave && !isSaving
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {sectionType === 'skip' ? 'Skip Content' : 'Save Section'}
            </>
          )}
        </button>

        {!hasSelection && (
          <p className="text-xs text-center text-gray-400">
            Click in document to mark boundaries
          </p>
        )}
      </div>
    </div>
  );
}

export default SectionTagger;
