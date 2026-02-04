import React, { useState, useEffect } from 'react';
import { MapPin, Save, Loader2, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import type { SelectionData } from './DocumentViewer';

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
  applyDirectly?: boolean; // If true, apply directly to standard instead of sending to N8N
}

interface SectionTaggerProps {
  selection: SelectionData | null;
  onClearSelection: () => void;
  onSaveSection: (metadata: SectionMetadata) => Promise<void>;
  isSaving: boolean;
  error: string | null;
}

/**
 * SectionTagger - Controls for tagging and saving document sections
 *
 * Simplified flow:
 * 1. User selects text in the document viewer (drag to select)
 * 2. User clicks "Capture Selection" in the document viewer
 * 3. Selection appears here with preview
 * 4. User fills in section type, standard, title
 * 5. User clicks "Save Section" to save
 */
export function SectionTagger({
  selection,
  onClearSelection,
  onSaveSection,
  isSaving,
  error
}: SectionTaggerProps) {
  const [sectionType, setSectionType] = useState<SectionType>('standard');
  const [standardCode, setStandardCode] = useState('');
  const [specCode, setSpecCode] = useState('');
  const [title, setTitle] = useState('');
  const [applyDirectly, setApplyDirectly] = useState(false);

  // Auto-fill title from selection preview
  useEffect(() => {
    if (selection && !title) {
      // Extract first line as title
      const firstLine = selection.text.split('\n')[0].trim();
      // Limit to 100 characters
      setTitle(firstLine.substring(0, 100));
    }
  }, [selection]);

  // Reset title when selection is cleared
  useEffect(() => {
    if (!selection) {
      setTitle('');
    }
  }, [selection]);

  // Clear form after successful save
  const handleSave = async () => {
    if (!canSave) return;

    const metadata: SectionMetadata = {
      sectionType,
      title: title.trim() || 'Untitled Section',
      ...(sectionType === 'standard' && standardCode && {
        standardCode,
        specCode: specCode || undefined,
        applyDirectly: applyDirectly && specCode ? true : undefined // Only apply directly if spec is selected
      })
    };

    await onSaveSection(metadata);

    // Reset form
    setSectionType('standard');
    setStandardCode('');
    setSpecCode('');
    setTitle('');
    setApplyDirectly(false);
  };

  const hasSelection = selection !== null;

  const canSave = hasSelection &&
    (sectionType === 'skip' ||
     sectionType === 'appendix' ||
     sectionType === 'matrix' ||
     (sectionType === 'standard' && standardCode));

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 bg-teal-50 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-teal-600" />
          Section Tagger
        </h3>
      </div>

      {/* Controls */}
      <div className="p-3 space-y-3 overflow-y-auto max-h-[500px]">
        {/* Selection Status */}
        <div className={`p-2 rounded border ${hasSelection ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center gap-2">
            {hasSelection ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Selection captured ({selection.text.length.toLocaleString()} chars)
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500">
                Select text in the document, then click "Capture Selection"
              </span>
            )}
          </div>
        </div>

        {/* Preview */}
        {hasSelection && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Preview</label>
            <div className="p-2 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 max-h-24 overflow-y-auto whitespace-pre-wrap">
              {selection.previewText}
            </div>
            <button
              onClick={onClearSelection}
              disabled={isSaving}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Section Type */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide">
            Section Type
          </label>
          <select
            value={sectionType}
            onChange={(e) => setSectionType(e.target.value as SectionType)}
            disabled={isSaving || !hasSelection}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100"
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
                disabled={isSaving || !hasSelection}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100"
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
                disabled={isSaving || !standardCode || !hasSelection}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100"
              >
                <option value="">All / General</option>
                {SPEC_OPTIONS.map((spec) => (
                  <option key={spec} value={spec}>
                    {standardCode}.{spec}
                  </option>
                ))}
              </select>
            </div>

            {/* Apply Directly option - only shows when spec is selected */}
            {specCode && (
              <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyDirectly}
                    onChange={(e) => setApplyDirectly(e.target.checked)}
                    disabled={isSaving}
                    className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1 text-sm font-medium text-blue-800">
                      <Zap className="w-3.5 h-3.5" />
                      Apply Directly
                    </div>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Save directly to Standard {standardCode}.{specCode} in the editor.
                      Skips AI processing - use when content is already correctly labeled.
                    </p>
                  </div>
                </label>
              </div>
            )}
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
            disabled={isSaving || !hasSelection}
            placeholder="Section title"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-gray-100"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="text-xs">{error}</span>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className={`w-full px-3 py-2.5 rounded font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
            canSave && !isSaving
              ? 'bg-teal-600 text-white hover:bg-teal-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {applyDirectly && specCode ? 'Applying...' : 'Saving...'}
            </>
          ) : (
            <>
              {applyDirectly && specCode ? (
                <>
                  <Zap className="w-4 h-4" />
                  Apply to {standardCode}.{specCode}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {sectionType === 'skip' ? 'Skip Content' : 'Save Section'}
                </>
              )}
            </>
          )}
        </button>

        {!hasSelection && (
          <p className="text-xs text-center text-gray-400 mt-2">
            Select text in the document to begin
          </p>
        )}
      </div>
    </div>
  );
}

export default SectionTagger;
