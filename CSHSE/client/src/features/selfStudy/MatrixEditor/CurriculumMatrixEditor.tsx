import React, { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Plus,
  Trash2,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Copy,
  FileText,
  Grid3X3,
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
  type: CoverageType | CoverageType[];
  depth: CoverageDepth;
}

interface StandardMapping {
  standardCode: string;
  specCode: string;
  rowIndex: number;
  courseAssessments: CourseAssessment[];
}

interface RawMatrixContent {
  id: string;
  content: string;
  title?: string;
  standardCode?: string;
  addedAt: string;
  processed: boolean;
}

interface CurriculumMatrix {
  _id: string;
  submissionId: string;
  courses: Course[];
  standards: StandardMapping[];
  rawContent?: RawMatrixContent[];
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
 * Curriculum Matrix Editor
 * Displays imported matrix HTML as rich text content, with an optional
 * manual grid for adding courses and assessments.
 */
export function CurriculumMatrixEditor({
  submissionId,
  matrixId,
}: CurriculumMatrixEditorProps) {
  const queryClient = useQueryClient();
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(
    new Set(['11', '12', '13'])
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showManualGrid, setShowManualGrid] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deletingRawId, setDeletingRawId] = useState<string | null>(null);

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

  // Fetch standards definitions
  const { data: standards } = useQuery<StandardDefinition[]>({
    queryKey: ['standards'],
    queryFn: async () => {
      const response = await api.get(`${API_BASE}/standards`);
      return response.data;
    },
  });

  const curriculumStandards = useMemo(() => {
    if (!standards) return [];
    return standards.filter((s) => parseInt(s.code) >= 11);
  }, [standards]);

  const groupedStandards = useMemo(() => {
    if (!matrix) return new Map<string, StandardMapping[]>();
    const groups = new Map<string, StandardMapping[]>();
    for (const s of matrix.standards) {
      const key = `${s.standardCode}|${s.specCode}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    for (const [, rows] of groups) {
      rows.sort((a, b) => (a.rowIndex || 0) - (b.rowIndex || 0));
    }
    return groups;
  }, [matrix]);

  // Mutations
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

  const updateAssessmentMutation = useMutation({
    mutationFn: async ({
      standardCode, specCode, courseId, type, depth, rowIndex,
    }: {
      standardCode: string; specCode: string; courseId: string;
      type: CoverageType | CoverageType[] | null; depth: CoverageDepth; rowIndex: number;
    }) => {
      await api.put(
        `${API_BASE}/submissions/${submissionId}/matrix/${matrix?._id}/assessment`,
        { standardCode, specCode, courseId, type, depth, rowIndex }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
      setHasUnsavedChanges(false);
    },
  });

  const duplicateRowMutation = useMutation({
    mutationFn: async ({ standardCode, specCode }: { standardCode: string; specCode: string }) => {
      await api.post(
        `${API_BASE}/submissions/${submissionId}/matrix/${matrix?._id}/duplicate-row`,
        { standardCode, specCode }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
    },
  });

  const removeRowMutation = useMutation({
    mutationFn: async ({ standardCode, specCode, rowIndex }: { standardCode: string; specCode: string; rowIndex: number }) => {
      await api.delete(
        `${API_BASE}/submissions/${submissionId}/matrix/${matrix?._id}/remove-row`,
        { data: { standardCode, specCode, rowIndex } }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
    },
  });

  // Handlers
  const handleAssessmentChange = useCallback(
    (standardCode: string, specCode: string, courseId: string,
     type: CoverageType | CoverageType[], depth: CoverageDepth, rowIndex: number = 0) => {
      const typeArray = Array.isArray(type) ? type.filter((t): t is CoverageType => t !== null) : (type ? [type] : []);
      updateAssessmentMutation.mutate({
        standardCode, specCode, courseId,
        type: typeArray.length > 0 ? typeArray : null as any,
        depth, rowIndex,
      });
    },
    [updateAssessmentMutation]
  );

  const getAssessment = useCallback(
    (standardCode: string, specCode: string, courseId: string, rowIndex: number = 0): { type: CoverageType | CoverageType[] | null; depth: CoverageDepth | null } => {
      if (!matrix) return { type: null, depth: null };
      const mapping = matrix.standards.find(
        (s) => s.standardCode === standardCode && s.specCode === specCode && (s.rowIndex || 0) === rowIndex
      );
      if (!mapping) return { type: null, depth: null };
      const assessment = mapping.courseAssessments.find((a) => a.courseId === courseId);
      return { type: assessment?.type || null, depth: assessment?.depth || null };
    },
    [matrix]
  );

  const toggleStandard = (code: string) => {
    setExpandedStandards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) newSet.delete(code);
      else newSet.add(code);
      return newSet;
    });
  };

  const toggleSectionCollapse = (id: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (window.confirm(`Are you sure you want to delete "${courseName}"? This will remove all assessments for this course.`)) {
      await deleteCourseMutation.mutateAsync(courseId);
    }
  };

  const handleDeleteRawContent = async (rawContentId: string) => {
    if (!matrix || !window.confirm('Remove this imported section?')) return;
    setDeletingRawId(rawContentId);
    try {
      await api.delete(
        `${API_BASE}/submissions/${submissionId}/matrix/${matrix._id}/raw-content/${rawContentId}`
      );
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
    } catch (err) {
      console.error('Failed to delete raw content:', err);
    } finally {
      setDeletingRawId(null);
    }
  };

  const handleExportCSV = () => {
    if (!matrix || !curriculumStandards) return;
    const headers = ['Standard', 'Specification', ...matrix.courses.map((c) => `${c.coursePrefix} ${c.courseNumber}`)];
    const rows: string[][] = [];
    curriculumStandards.forEach((standard) => {
      standard.specifications.forEach((spec) => {
        const row = [standard.code, spec.code, ...matrix.courses.map((course) => {
          const { type, depth } = getAssessment(standard.code, spec.code, course.id);
          return type && depth ? `${type}/${depth}` : '';
        })];
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
  const rawSections = matrix?.rawContent || [];
  const hasRawContent = rawSections.length > 0;
  const hasCourses = courses.length > 0;

  return (
    <div className="curriculum-matrix-editor flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Curriculum Matrix</h2>
          {hasRawContent && (
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              {rawSections.length} imported section{rawSections.length !== 1 ? 's' : ''}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1 text-sm text-amber-600">
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasCourses && (
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          )}
          <button
            onClick={() => setShowManualGrid(!showManualGrid)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
              showManualGrid ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Manual Grid
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Imported Rich Text Sections */}
        {hasRawContent && rawSections.map((raw) => (
          <div key={raw.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            {/* Section Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <button
                onClick={() => toggleSectionCollapse(raw.id)}
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                {collapsedSections.has(raw.id) ? (
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                )}
                <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                <span className="font-medium text-gray-900 truncate">
                  {raw.title || 'Imported Matrix Section'}
                </span>
                {raw.standardCode && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded shrink-0">
                    Standard {raw.standardCode}
                  </span>
                )}
              </button>
              <button
                onClick={() => handleDeleteRawContent(raw.id)}
                disabled={deletingRawId === raw.id}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0 ml-2"
                title="Remove imported section"
              >
                {deletingRawId === raw.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Section Content */}
            {!collapsedSections.has(raw.id) && (
              <div className="p-4 overflow-auto max-h-[70vh]">
                <div
                  className="prose prose-sm max-w-none
                    [&_table]:border-collapse [&_table]:w-full [&_table]:table-auto
                    [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm
                    [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:font-semibold
                    [&_tr]:even:bg-gray-50"
                  dangerouslySetInnerHTML={{ __html: raw.content }}
                />
              </div>
            )}
          </div>
        ))}

        {/* Empty state when no content at all */}
        {!hasRawContent && !hasCourses && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Grid3X3 className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Matrix Content Yet</h3>
            <p className="text-sm text-gray-500 max-w-md">
              Import matrix sections from the document using the Section Tagger,
              or click "Manual Grid" to add courses and assessments manually.
            </p>
          </div>
        )}

        {/* Manual Grid Section */}
        {showManualGrid && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-teal-600" />
                <span className="font-medium text-gray-900">Manual Assessment Grid</span>
              </div>
              <button
                onClick={() => setShowAddCourse(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Course
              </button>
            </div>

            <div className="overflow-auto max-h-[calc(100vh-400px)]">
              <table className="w-full border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 z-20 bg-gray-50 p-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-r border-gray-200 min-w-[200px]">
                      Standard / Specification
                    </th>
                    {courses.map((course) => (
                      <th key={course.id} className="p-2 text-center border-b border-gray-200 min-w-[100px]">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-semibold text-gray-900">
                            {course.coursePrefix} {course.courseNumber}
                          </span>
                          <span className="text-xs text-gray-500 truncate max-w-[90px]" title={course.courseName}>
                            {course.courseName}
                          </span>
                          <span className="text-xs text-gray-400">{course.credits} cr</span>
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
                <tbody>
                  {curriculumStandards.map((standard) => (
                    <React.Fragment key={standard.code}>
                      <tr className="bg-gray-100">
                        <td colSpan={courses.length + 1} className="sticky left-0 z-10 bg-gray-100">
                          <button
                            onClick={() => toggleStandard(standard.code)}
                            className="w-full flex items-center gap-2 p-3 text-left hover:bg-gray-200 transition-colors"
                          >
                            {expandedStandards.has(standard.code) ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-600" />
                            )}
                            <span className="font-semibold text-gray-900">Standard {standard.code}</span>
                            <span className="text-sm text-gray-600">- {standard.title}</span>
                          </button>
                        </td>
                      </tr>
                      {expandedStandards.has(standard.code) &&
                        standard.specifications.map((spec) => {
                          const key = `${standard.code}|${spec.code}`;
                          const duplicateRows = groupedStandards.get(key) || [];
                          const rowIndicesToRender = duplicateRows.length > 0
                            ? duplicateRows.map(r => r.rowIndex || 0)
                            : [0];

                          return (
                            <React.Fragment key={`${standard.code}-${spec.code}`}>
                              {rowIndicesToRender.map((rowIdx, renderIdx) => (
                                <tr
                                  key={`${standard.code}-${spec.code}-${rowIdx}`}
                                  className={`hover:bg-gray-50 ${rowIdx > 0 ? 'bg-gray-50/50' : ''}`}
                                >
                                  <td className="sticky left-0 z-10 bg-white p-3 border-b border-r border-gray-200">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 flex items-start gap-2">
                                        <span className="font-medium text-gray-700">
                                          {standard.code}.{spec.code}
                                          {rowIdx > 0 && (
                                            <span className="ml-1 text-xs text-purple-600 font-normal">({rowIdx + 1})</span>
                                          )}
                                        </span>
                                        {renderIdx === 0 && (
                                          <span className="text-sm text-gray-600 truncate" title={spec.title}>
                                            {spec.title}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {renderIdx === 0 && (
                                          <button
                                            onClick={() => duplicateRowMutation.mutate({ standardCode: standard.code, specCode: spec.code })}
                                            className="p-1 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                            title="Add duplicate row for this spec"
                                          >
                                            <Copy className="w-3 h-3" />
                                          </button>
                                        )}
                                        {rowIdx > 0 && (
                                          <button
                                            onClick={() => {
                                              if (window.confirm('Remove this duplicate row?')) {
                                                removeRowMutation.mutate({ standardCode: standard.code, specCode: spec.code, rowIndex: rowIdx });
                                              }
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            title="Remove this duplicate row"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  {courses.map((course) => {
                                    const { type, depth } = getAssessment(standard.code, spec.code, course.id, rowIdx);
                                    return (
                                      <td key={course.id} className="p-0 border-b border-gray-200">
                                        <AssessmentCell
                                          courseId={course.id}
                                          standardCode={standard.code}
                                          specCode={spec.code}
                                          type={type}
                                          depth={depth}
                                          onChange={(newType, newDepth) =>
                                            handleAssessmentChange(standard.code, spec.code, course.id, newType, newDepth, rowIdx)
                                          }
                                        />
                                      </td>
                                    );
                                  })}
                                  {courses.length === 0 && (
                                    <td className="p-4 text-center text-gray-400 border-b border-gray-200">-</td>
                                  )}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-700">Type:</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-blue-600">I</span><span className="text-gray-500">=Introduction</span>
                    <span className="font-bold text-purple-600">T</span><span className="text-gray-500">=Theory</span>
                    <span className="font-bold text-green-600">K</span><span className="text-gray-500">=Knowledge</span>
                    <span className="font-bold text-orange-600">S</span><span className="text-gray-500">=Skills</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-700">Depth:</span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 bg-teal-100 border-b-2 border-b-teal-500 rounded-sm" /><span className="text-gray-500">H=High</span>
                    <span className="inline-block w-4 h-4 bg-teal-50 border-b border-b-teal-400 rounded-sm" /><span className="text-gray-500">M=Medium</span>
                    <span className="inline-block w-4 h-4 bg-gray-100 border-b border-b-teal-300 rounded-sm" /><span className="text-gray-500">L=Low</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
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
