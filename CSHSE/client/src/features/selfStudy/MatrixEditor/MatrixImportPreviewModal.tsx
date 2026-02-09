import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, Check, Loader2, ChevronDown, ChevronRight } from 'lucide-react';

// Types matching server ParsedMatrixResult
export interface ParsedCourse {
  coursePrefix: string;
  courseNumber: string;
  courseName: string;
  included?: boolean; // client-side toggle
}

export interface ParsedAssessment {
  standardCode: string;
  specCode: string;
  coursePrefix: string;
  courseNumber: string;
  type: string[];
  depth: string;
}

export interface ParsedMatrixResult {
  courses: ParsedCourse[];
  assessments: ParsedAssessment[];
  warnings: string[];
  stats: {
    totalCourses: number;
    totalAssessments: number;
    unparsedCells: number;
  };
}

// Type colors (matching AssessmentCell.tsx)
const TYPE_COLORS: Record<string, string> = {
  'I': 'bg-blue-100 text-blue-700',
  'T': 'bg-purple-100 text-purple-700',
  'K': 'bg-green-100 text-green-700',
  'S': 'bg-orange-100 text-orange-700',
};

const DEPTH_STYLES: Record<string, string> = {
  'H': 'border-b-4 border-b-teal-500 bg-teal-50',
  'M': 'border-b-2 border-b-teal-400 bg-teal-50/50',
  'L': 'border-b border-b-teal-300 bg-gray-50',
};

interface MatrixImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  parsedData: ParsedMatrixResult;
  onImport: (courses: ParsedCourse[], assessments: ParsedAssessment[]) => Promise<void>;
  standardCode?: string; // If provided, filter to this standard
}

export function MatrixImportPreviewModal({
  isOpen,
  onClose,
  parsedData,
  onImport,
  standardCode,
}: MatrixImportPreviewModalProps) {
  const [courses, setCourses] = useState<ParsedCourse[]>(() =>
    parsedData.courses.map(c => ({ ...c, included: true }))
  );
  const [importing, setImporting] = useState(false);
  const [showWarnings, setShowWarnings] = useState(false);

  // Filter assessments to included courses (and optionally to standardCode)
  const filteredAssessments = useMemo(() => {
    const includedCourses = new Set(
      courses.filter(c => c.included !== false).map(c => `${c.coursePrefix}|${c.courseNumber}`)
    );
    return parsedData.assessments.filter(a => {
      if (!includedCourses.has(`${a.coursePrefix}|${a.courseNumber}`)) return false;
      if (standardCode && a.standardCode !== standardCode) return false;
      return true;
    });
  }, [courses, parsedData.assessments, standardCode]);

  // Group assessments by standard for preview
  const groupedByStandard = useMemo(() => {
    const groups: Record<string, ParsedAssessment[]> = {};
    for (const a of filteredAssessments) {
      const key = `${a.standardCode}.${a.specCode}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return groups;
  }, [filteredAssessments]);

  const handleToggleCourse = (idx: number) => {
    setCourses(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], included: !next[idx].included };
      return next;
    });
  };

  const handleEditCourse = (idx: number, field: keyof ParsedCourse, value: string) => {
    setCourses(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const includedCourses = courses.filter(c => c.included !== false);
      await onImport(includedCourses, filteredAssessments);
      onClose();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Matrix Data</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Review parsed data before importing to the curriculum matrix
              {standardCode && <span className="font-medium text-teal-700"> (Standard {standardCode})</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <span className="px-3 py-1 bg-teal-100 text-teal-800 rounded-full font-medium">
              {courses.filter(c => c.included !== false).length} courses
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
              {filteredAssessments.length} assessments
            </span>
            {parsedData.warnings.length > 0 && (
              <button
                onClick={() => setShowWarnings(!showWarnings)}
                className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full font-medium hover:bg-amber-200"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {parsedData.warnings.length} warnings
                {showWarnings ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Warnings */}
          {showWarnings && parsedData.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <ul className="text-xs text-amber-700 space-y-1">
                {parsedData.warnings.map((w, i) => (
                  <li key={i}>- {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Courses */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Detected Courses</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-10">Include</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Prefix</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Number</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {courses.map((course, idx) => (
                    <tr key={idx} className={course.included === false ? 'opacity-40' : ''}>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={course.included !== false}
                          onChange={() => handleToggleCourse(idx)}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={course.coursePrefix}
                          onChange={e => handleEditCourse(idx, 'coursePrefix', e.target.value.toUpperCase())}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={course.courseNumber}
                          onChange={e => handleEditCourse(idx, 'courseNumber', e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          value={course.courseName}
                          onChange={e => handleEditCourse(idx, 'courseName', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assessment Preview */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Assessment Preview</h3>
            <div className="border border-gray-200 rounded-lg overflow-auto max-h-[300px]">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-gray-500 border-b sticky left-0 bg-gray-50">Spec</th>
                    {courses.filter(c => c.included !== false).map((c, i) => (
                      <th key={i} className="px-2 py-2 text-center font-medium text-gray-500 border-b min-w-[70px]">
                        {c.coursePrefix} {c.courseNumber}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedByStandard).sort().map(([specKey, assessments]) => {
                    const includedCourses = courses.filter(c => c.included !== false);
                    return (
                      <tr key={specKey} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5 font-medium text-gray-700 border-b sticky left-0 bg-white whitespace-nowrap">
                          {specKey}
                        </td>
                        {includedCourses.map((course, ci) => {
                          const a = assessments.find(
                            x => x.coursePrefix === course.coursePrefix && x.courseNumber === course.courseNumber
                          );
                          if (!a) {
                            return <td key={ci} className="px-2 py-1.5 border-b text-center text-gray-300">-</td>;
                          }
                          return (
                            <td key={ci} className={`px-2 py-1.5 border-b text-center ${DEPTH_STYLES[a.depth] || ''}`}>
                              <div className="flex items-center justify-center gap-0.5">
                                {a.type.map(t => (
                                  <span key={t} className={`inline-block px-1 rounded text-[10px] font-bold ${TYPE_COLORS[t] || ''}`}>
                                    {t}
                                  </span>
                                ))}
                              </div>
                              <span className="text-[10px] text-gray-400">{a.depth}</span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {Object.keys(groupedByStandard).length === 0 && (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No assessments found{standardCode ? ` for Standard ${standardCode}` : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-500">
            Importing will merge with existing matrix data. New courses will be added, existing assessments will be updated.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={importing || filteredAssessments.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Import to Matrix ({filteredAssessments.length} assessments)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatrixImportPreviewModal;
