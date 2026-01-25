import React, { useState, useRef, useEffect } from 'react';

export type CoverageType = 'I' | 'T' | 'K' | 'S' | null;
export type CoverageDepth = 'L' | 'M' | 'H' | null;

interface AssessmentCellProps {
  courseId: string;
  standardCode: string;
  specCode: string;
  type: CoverageType;
  depth: CoverageDepth;
  onChange: (type: CoverageType, depth: CoverageDepth) => void;
  readOnly?: boolean;
}

const TYPE_OPTIONS: { value: CoverageType; label: string; description: string }[] = [
  { value: 'I', label: 'I', description: 'Introduction - Basic exposure to concept' },
  { value: 'T', label: 'T', description: 'Theory - Theoretical understanding' },
  { value: 'K', label: 'K', description: 'Knowledge - Factual knowledge' },
  { value: 'S', label: 'S', description: 'Skills - Practical application' },
];

const DEPTH_OPTIONS: { value: CoverageDepth; label: string; description: string }[] = [
  { value: 'L', label: 'L', description: 'Low - Minimal coverage' },
  { value: 'M', label: 'M', description: 'Medium - Moderate coverage' },
  { value: 'H', label: 'H', description: 'High - Comprehensive coverage' },
];

/**
 * Individual cell in the curriculum matrix
 * Shows Type (I/T/K/S) and Depth (L/M/H) with click-to-edit
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
  const [localType, setLocalType] = useState<CoverageType>(type);
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
  }, [isEditing, localType, localDepth]);

  // Update local state when props change
  useEffect(() => {
    setLocalType(type);
    setLocalDepth(depth);
  }, [type, depth]);

  const handleSave = () => {
    if (localType !== type || localDepth !== depth) {
      onChange(localType, localDepth);
    }
    setIsEditing(false);
  };

  const handleClear = () => {
    setLocalType(null);
    setLocalDepth(null);
    onChange(null, null);
    setIsEditing(false);
  };

  const handleCellClick = () => {
    if (!readOnly) {
      setIsEditing(true);
    }
  };

  // Get display value
  const displayValue = type && depth ? `${type}/${depth}` : type || depth || '';

  // Get background color based on depth
  const getBackgroundColor = () => {
    if (!type || !depth) return 'bg-gray-50';
    switch (depth) {
      case 'H':
        return 'bg-teal-100';
      case 'M':
        return 'bg-teal-50';
      case 'L':
        return 'bg-gray-100';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <div className="relative">
      {/* Cell Display */}
      <div
        ref={cellRef}
        onClick={handleCellClick}
        className={`
          w-full h-full min-h-[40px] flex items-center justify-center
          text-sm font-medium cursor-pointer
          border border-gray-200 transition-colors
          ${getBackgroundColor()}
          ${!readOnly ? 'hover:border-teal-400' : ''}
          ${isEditing ? 'border-teal-500 ring-1 ring-teal-500' : ''}
        `}
      >
        {displayValue || <span className="text-gray-300">—</span>}
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

          {/* Type Selection */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Coverage Type
            </label>
            <div className="flex gap-1">
              {TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLocalType(option.value)}
                  title={option.description}
                  className={`
                    flex-1 py-2 px-3 text-sm font-medium rounded
                    transition-colors
                    ${
                      localType === option.value
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

          {/* Legend */}
          <div className="text-xs text-gray-500 mb-4 p-2 bg-gray-50 rounded">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong>Types:</strong>
                <br />I = Introduction
                <br />T = Theory
                <br />K = Knowledge
                <br />S = Skills
              </div>
              <div>
                <strong>Depth:</strong>
                <br />L = Low
                <br />M = Medium
                <br />H = High
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
                  setLocalType(type);
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
