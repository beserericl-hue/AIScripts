import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
  AlertCircle,
} from 'lucide-react';
import { AssessmentCell, CoverageType, CoverageDepth } from './AssessmentCell';
import { AddCourseModal } from './AddCourseModal';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Course {
  id: string;
  coursePrefix: string;
  courseNumber: string;
  courseName: string;
  credits: number;
  order: number;
}

interface CourseAssessment {
  courseId: string;
  type: CoverageType;
  depth: CoverageDepth;
}

interface StandardMapping {
  standardCode: string;
  specCode: string;
  courseAssessments: CourseAssessment[];
}

interface CurriculumMatrix {
  _id: string;
  submissionId: string;
  courses: Course[];
  standards: StandardMapping[];
}

interface StandardDefinition {
  code: string;
  title: string;
  specifications: { code: string; title: string }[];
}

interface CurriculumMatrixEditorProps {
  submissionId: string;
  matrixId?: string;
}

/**
 * Curriculum Matrix Editor - Spreadsheet-like interface for mapping
 * courses to CSHSE standards with Type (I/T/K/S) and Depth (L/M/H)
 */
export function CurriculumMatrixEditor({
  submissionId,
  matrixId,
}: CurriculumMatrixEditorProps) {
  const queryClient = useQueryClient();
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(
    new Set(['11', '12', '13']) // Start with curriculum standards expanded
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch matrix data
  const { data: matrix, isLoading: loadingMatrix } = useQuery<CurriculumMatrix>({
    queryKey: ['matrix', submissionId, matrixId],
    queryFn: async () => {
      const url = matrixId
        ? `${API_BASE}/submissions/${submissionId}/matrix/${matrixId}`
        : `${API_BASE}/submissions/${submissionId}/matrix`;
      const response = await api.get(url);
      return response.data;
    },
  });

  // Fetch standards definitions (only Part II - curriculum standards)
  const { data: standards } = useQuery<StandardDefinition[]>({
    queryKey: ['standards'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/standards`);
      return response.data;
    },
  });

  // Filter to only curriculum standards (11-21)
  const curriculumStandards = useMemo(() => {
    if (!standards) return [];
    return standards.filter((s) => parseInt(s.code) >= 11);
  }, [standards]);

  // Add course mutation
  const addCourseMutation = useMutation({
    mutationFn: async (courseData: Omit<Course, 'id' | 'order'>) => {
      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/matrix/${matrix?._id}/course`,
        courseData
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
    },
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: string) => {
      await api.delete(
        `${API_BASE}/submissions/${submissionId}/matrix/${matrix?._id}/course/${courseId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
    },
  });

  // Update assessment mutation
  const updateAssessmentMutation = useMutation({
    mutationFn: async ({
      standardCode,
      specCode,
      courseId,
      type,
      depth,
    }: {
      standardCode: string;
      specCode: string;
      courseId: string;
      type: CoverageType;
      depth: CoverageDepth;
    }) => {
      await api.put(
        `${API_BASE}/submissions/${submissionId}/matrix/${matrix?._id}/assessment`,
        { standardCode, specCode, courseId, type, depth }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
      setHasUnsavedChanges(false);
    },
  });

  // Handle assessment change
  const handleAssessmentChange = useCallback(
    (
      standardCode: string,
      specCode: string,
      courseId: string,
      type: CoverageType,
      depth: CoverageDepth
    ) => {
      updateAssessmentMutation.mutate({
        standardCode,
        specCode,
        courseId,
        type,
        depth,
      });
    },
    [updateAssessmentMutation]
  );

  // Get assessment for a cell
  const getAssessment = useCallback(
    (standardCode: string, specCode: string, courseId: string) => {
      if (!matrix) return { type: null, depth: null };
      const mapping = matrix.standards.find(
        (s) => s.standardCode === standardCode && s.specCode === specCode
      );
      if (!mapping) return { type: null, depth: null };
      const assessment = mapping.courseAssessments.find(
        (a) => a.courseId === courseId
      );
      return {
        type: assessment?.type || null,
        depth: assessment?.depth || null,
      };
    },
    [matrix]
  );

  // Toggle standard expansion
  const toggleStandard = (code: string) => {
    setExpandedStandards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  };

  // Handle delete course
  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${courseName}"? This will remove all assessments for this course.`
      )
    ) {
      await deleteCourseMutation.mutateAsync(courseId);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!matrix || !curriculumStandards) return;

    const headers = [
      'Standard',
      'Specification',
      ...matrix.courses.map(
        (c) => `${c.coursePrefix} ${c.courseNumber}`
      ),
    ];

    const rows: string[][] = [];

    curriculumStandards.forEach((standard) => {
      standard.specifications.forEach((spec) => {
        const row = [
          standard.code,
          spec.code,
          ...matrix.courses.map((course) => {
            const { type, depth } = getAssessment(
              standard.code,
              spec.code,
              course.id
            );
            return type && depth ? `${type}/${depth}` : '';
          }),
        ];
        rows.push(row);
      });
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'curriculum-matrix.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingMatrix) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const courses = matrix?.courses || [];

  return (
    <div className="curriculum-matrix-editor bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Curriculum Matrix
          </h2>
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddCourse(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Course
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>

          <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Upload className="w-4 h-4" />
            Import
          </button>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="overflow-auto max-h-[calc(100vh-300px)]">
        <table className="w-full border-collapse">
          {/* Header Row - Course Columns */}
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-r border-gray-200 min-w-[200px]">
                Standard / Specification
              </th>
              {courses.map((course) => (
                <th
                  key={course.id}
                  className="p-2 text-center border-b border-gray-200 min-w-[100px]"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-sm font-semibold text-gray-900">
                      {course.coursePrefix} {course.courseNumber}
                    </span>
                    <span className="text-xs text-gray-500 truncate max-w-[90px]" title={course.courseName}>
                      {course.courseName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {course.credits} cr
                    </span>
                    <button
                      onClick={() => handleDeleteCourse(course.id, `${course.coursePrefix} ${course.courseNumber}`)}
                      className="mt-1 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete course"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </th>
              ))}
              {courses.length === 0 && (
                <th className="p-4 text-center text-sm text-gray-500 border-b border-gray-200">
                  No courses added yet. Click "Add Course" to begin.
                </th>
              )}
            </tr>
          </thead>

          {/* Body - Standard/Spec Rows */}
          <tbody>
            {curriculumStandards.map((standard) => (
              <React.Fragment key={standard.code}>
                {/* Standard Header Row */}
                <tr className="bg-gray-100">
                  <td
                    colSpan={courses.length + 1}
                    className="sticky left-0 z-10 bg-gray-100"
                  >
                    <button
                      onClick={() => toggleStandard(standard.code)}
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-200 transition-colors"
                    >
                      {expandedStandards.has(standard.code) ? (
                        <ChevronDown className="w-4 h-4 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      )}
                      <span className="font-semibold text-gray-900">
                        Standard {standard.code}
                      </span>
                      <span className="text-sm text-gray-600">
                        - {standard.title}
                      </span>
                    </button>
                  </td>
                </tr>

                {/* Specification Rows */}
                {expandedStandards.has(standard.code) &&
                  standard.specifications.map((spec) => (
                    <tr key={`${standard.code}-${spec.code}`} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white p-3 border-b border-r border-gray-200">
                        <div className="flex items-start gap-2">
                          <span className="font-medium text-gray-700">
                            {standard.code}.{spec.code}
                          </span>
                          <span className="text-sm text-gray-600 truncate" title={spec.title}>
                            {spec.title}
                          </span>
                        </div>
                      </td>
                      {courses.map((course) => {
                        const { type, depth } = getAssessment(
                          standard.code,
                          spec.code,
                          course.id
                        );
                        return (
                          <td
                            key={course.id}
                            className="p-0 border-b border-gray-200"
                          >
                            <AssessmentCell
                              courseId={course.id}
                              standardCode={standard.code}
                              specCode={spec.code}
                              type={type}
                              depth={depth}
                              onChange={(newType, newDepth) =>
                                handleAssessmentChange(
                                  standard.code,
                                  spec.code,
                                  course.id,
                                  newType,
                                  newDepth
                                )
                              }
                            />
                          </td>
                        );
                      })}
                      {courses.length === 0 && (
                        <td className="p-4 text-center text-gray-400 border-b border-gray-200">
                          —
                        </td>
                      )}
                    </tr>
                  ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="font-medium text-gray-700 mr-2">Type:</span>
            <span className="text-gray-600">
              I = Introduction, T = Theory, K = Knowledge, S = Skills
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700 mr-2">Depth:</span>
            <span className="text-gray-600">L = Low, M = Medium, H = High</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700">Coverage:</span>
            <span className="inline-block w-4 h-4 bg-teal-100 rounded" /> High
            <span className="inline-block w-4 h-4 bg-teal-50 rounded" /> Medium
            <span className="inline-block w-4 h-4 bg-gray-100 rounded" /> Low
          </div>
        </div>
      </div>

      {/* Add Course Modal */}
      <AddCourseModal
        isOpen={showAddCourse}
        onClose={() => setShowAddCourse(false)}
        onAdd={async (courseData) => {
          await addCourseMutation.mutateAsync(courseData);
        }}
        existingPrefixes={courses.map((c) => c.coursePrefix)}
      />
    </div>
  );
}

export default CurriculumMatrixEditor;
