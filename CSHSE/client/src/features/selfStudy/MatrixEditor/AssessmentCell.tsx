import React, { useState, useRef, useEffect } from 'react';

// Single type for backwards compatibility, but internally we use arrays
export type CoverageType = 'I' | 'T' | 'K' | 'S' | null;
export type CoverageDepth = 'L' | 'M' | 'H' | null;

// Color mapping for each coverage type - matches typical CSHSE matrix styling
export const TYPE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  'I': { text: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-300' },      // Introduction - Blue
  'T': { text: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-300' }, // Theory - Purple
  'K': { text: 'text-green-600', bg: 'bg-green-100', border: 'border-green-300' },    // Knowledge - Green
  'S': { text: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-300' }, // Skills - Orange
};

// Depth indicator colors
export const DEPTH_COLORS: Record<string, { bg: string; intensity: string }> = {
  'H': { bg: 'bg-teal-100', intensity: 'border-b-4 border-b-teal-500' },
  'M': { bg: 'bg-teal-50', intensity: 'border-b-2 border-b-teal-400' },
  'L': { bg: 'bg-gray-50', intensity: 'border-b border-b-teal-300' },
};

interface AssessmentCellProps {
  courseId: string;
  standardCode: string;
  specCode: string;
  type: CoverageType | CoverageType[];  // Support both single and array
  depth: CoverageDepth;
  onChange: (type: CoverageType | CoverageType[], depth: CoverageDepth) => void;
  readOnly?: boolean;
}

const TYPE_OPTIONS: { value: 'I' | 'T' | 'K' | 'S'; label: string; description: string; color: string }[] = [
  { value: 'I', label: 'I', description: 'Introduction - Basic exposure to concept', color: 'text-blue-600' },
  { value: 'T', label: 'T', description: 'Theory - Theoretical understanding', color: 'text-purple-600' },
  { value: 'K', label: 'K', description: 'Knowledge - Factual knowledge', color: 'text-green-600' },
  { value: 'S', label: 'S', description: 'Skills - Practical application', color: 'text-orange-600' },
];

const DEPTH_OPTIONS: { value: CoverageDepth; label: string; description: string }[] = [
  { value: 'L', label: 'L', description: 'Low - Minimal coverage' },
  { value: 'M', label: 'M', description: 'Medium - Moderate coverage' },
  { value: 'H', label: 'H', description: 'High - Comprehensive coverage' },
];

// Helper to normalize type to array
function normalizeTypes(type: CoverageType | CoverageType[] | null | undefined): ('I' | 'T' | 'K' | 'S')[] {
  if (!type) return [];
  if (Array.isArray(type)) return type.filter((t): t is 'I' | 'T' | 'K' | 'S' => t !== null);
  return type ? [type] : [];
}

/**
 * Individual cell in the curriculum matrix
 * Shows Type (I/T/K/S) and Depth (L/M/H) with click-to-edit
 * Supports multiple types per cell with color coding
 */
export function AssessmentCell({
  courseId,
  standardCode,
  specCode,
  type,
  depth,
  onChange,
  readOnly = false,
}: AssessmentCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localTypes, setLocalTypes] = useState<('I' | 'T' | 'K' | 'S')[]>(normalizeTypes(type));
  const [localDepth, setLocalDepth] = useState<CoverageDepth>(depth);
  const cellRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        cellRef.current &&
        !cellRef.current.contains(event.target as Node)
      ) {
        handleSave();
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, localTypes, localDepth]);

  // Update local state when props change
  useEffect(() => {
    setLocalTypes(normalizeTypes(type));
    setLocalDepth(depth);
  }, [type, depth]);

  const handleSave = () => {
    const typesChanged = JSON.stringify(localTypes) !== JSON.stringify(normalizeTypes(type));
    if (typesChanged || localDepth !== depth) {
      onChange(localTypes.length > 0 ? localTypes : null, localDepth);
    }
    setIsEditing(false);
  };

  const handleClear = () => {
    setLocalTypes([]);
    setLocalDepth(null);
    onChange(null, null);
    setIsEditing(false);
  };

  // Toggle a type in the selection
  const toggleType = (t: 'I' | 'T' | 'K' | 'S') => {
    setLocalTypes(prev => {
      if (prev.includes(t)) {
        return prev.filter(x => x !== t);
      } else {
        return [...prev, t].sort(); // Keep sorted: I, K, S, T
      }
    });
  };

  const handleCellClick = () => {
    if (!readOnly) {
      setIsEditing(true);
    }
  };

  // Normalize type for display
  const displayTypes = normalizeTypes(type);
  const hasContent = displayTypes.length > 0 && depth;

  // Get background color based on depth
  const getBackgroundColor = () => {
    if (!hasContent) return 'bg-gray-50';
    return DEPTH_COLORS[depth!]?.bg || 'bg-gray-50';
  };

  // Get depth indicator
  const getDepthIndicator = () => {
    if (!hasContent) return '';
    return DEPTH_COLORS[depth!]?.intensity || '';
  };

  // Render colored type letters
  const renderColoredTypes = (types: ('I' | 'T' | 'K' | 'S')[], showDepth = true) => {
    if (types.length === 0) return <span className="text-gray-300">—</span>;

    return (
      <span className="flex items-center justify-center gap-0.5">
        {types.map((t, i) => (
          <span
            key={t}
            className={`font-bold ${TYPE_COLORS[t]?.text || 'text-gray-600'}`}
          >
            {t}
          </span>
        ))}
        {showDepth && depth && (
          <span className="text-gray-400 ml-0.5 text-xs font-normal">/{depth}</span>
        )}
      </span>
    );
  };

  return (
    <div className="relative">
      {/* Cell Display */}
      <div
        ref={cellRef}
        onClick={handleCellClick}
        className={`
          w-full h-full min-h-[40px] flex items-center justify-center
          text-sm cursor-pointer
          border border-gray-200 transition-colors
          ${getBackgroundColor()}
          ${getDepthIndicator()}
          ${!readOnly ? 'hover:border-teal-400' : ''}
          ${isEditing ? 'border-teal-500 ring-1 ring-teal-500' : ''}
        `}
      >
        {renderColoredTypes(displayTypes)}
      </div>

      {/* Edit Popover */}
      {isEditing && (
        <div
          ref={popoverRef}
          className="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 min-w-[240px]"
        >
          {/* Header */}
          <div className="text-xs text-gray-500 mb-3">
            {standardCode}.{specCode} × Course
          </div>

          {/* Type Selection - Multi-select */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Coverage Type(s) <span className="text-gray-400 font-normal">(select multiple)</span>
            </label>
            <div className="flex gap-1">
              {TYPE_OPTIONS.map((option) => {
                const isSelected = localTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => toggleType(option.value)}
                    title={option.description}
                    className={`
                      flex-1 py-2 px-3 text-sm font-bold rounded
                      transition-all border-2
                      ${
                        isSelected
                          ? `${TYPE_COLORS[option.value].bg} ${TYPE_COLORS[option.value].text} ${TYPE_COLORS[option.value].border}`
                          : 'bg-gray-100 text-gray-400 border-transparent hover:bg-gray-200'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            {/* Preview of selected types */}
            {localTypes.length > 0 && (
              <div className="mt-2 text-center">
                <span className="text-xs text-gray-500">Preview: </span>
                {renderColoredTypes(localTypes, false)}
              </div>
            )}
          </div>

          {/* Depth Selection */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Coverage Depth
            </label>
            <div className="flex gap-1">
              {DEPTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLocalDepth(option.value)}
                  title={option.description}
                  className={`
                    flex-1 py-2 px-3 text-sm font-medium rounded
                    transition-colors
                    ${
                      localDepth === option.value
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legend with colors */}
          <div className="text-xs mb-4 p-2 bg-gray-50 rounded">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong className="text-gray-700">Types:</strong>
                <div className="mt-1 space-y-0.5">
                  <div><span className="font-bold text-blue-600">I</span> = Introduction</div>
                  <div><span className="font-bold text-purple-600">T</span> = Theory</div>
                  <div><span className="font-bold text-green-600">K</span> = Knowledge</div>
                  <div><span className="font-bold text-orange-600">S</span> = Skills</div>
                </div>
              </div>
              <div>
                <strong className="text-gray-700">Depth:</strong>
                <div className="mt-1 space-y-0.5">
                  <div><span className="inline-block w-3 h-3 bg-teal-100 border-b-2 border-b-teal-500 mr-1"></span>H = High</div>
                  <div><span className="inline-block w-3 h-3 bg-teal-50 border-b border-b-teal-400 mr-1"></span>M = Medium</div>
                  <div><span className="inline-block w-3 h-3 bg-gray-100 border-b border-b-teal-300 mr-1"></span>L = Low</div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleClear}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLocalTypes(normalizeTypes(type));
                  setLocalDepth(depth);
                  setIsEditing(false);
                }}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded hover:bg-teal-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AssessmentCell;
