import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  Grid3X3,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

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
  // When set, scroll to and briefly flash the row matching this (std, spec).
  // The row id pattern matches what the AI matrix extractor injects:
  // `id="matrix-{slug}-row-{std}-{spec}"` on every spec-tagged <tr>.
  // After the scroll completes the parent should clear via onScrollConsumed.
  scrollToSpec?: { std: string; spec: string } | null;
  onScrollConsumed?: () => void;
}

/**
 * Curriculum Matrix Editor
 * Displays imported matrix HTML grouped by standard in accordion sections.
 */
export function CurriculumMatrixEditor({
  submissionId,
  matrixId,
  scrollToSpec,
  onScrollConsumed,
}: CurriculumMatrixEditorProps) {
  const queryClient = useQueryClient();
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(
    new Set(['11', '12', '13'])
  );
  const [deletingRawId, setDeletingRawId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

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

  // Group rawContent by standardCode
  const sectionsByStandard = useMemo(() => {
    const groups = new Map<string, RawMatrixContent[]>();
    const ungrouped: RawMatrixContent[] = [];

    for (const raw of matrix?.rawContent || []) {
      if (raw.standardCode) {
        if (!groups.has(raw.standardCode)) groups.set(raw.standardCode, []);
        groups.get(raw.standardCode)!.push(raw);
      } else {
        ungrouped.push(raw);
      }
    }

    return { groups, ungrouped };
  }, [matrix]);

  // Which standards have imported content
  const standardsWithContent = useMemo(() => {
    const codes = new Set<string>();
    for (const raw of matrix?.rawContent || []) {
      if (raw.standardCode) codes.add(raw.standardCode);
    }
    return codes;
  }, [matrix]);

  const toggleStandard = (code: string) => {
    setExpandedStandards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) newSet.delete(code);
      else newSet.add(code);
      return newSet;
    });
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

  // Scroll-into-view + flash highlight when the user clicked "View in matrix"
  // from a spec. Run AFTER the matrix HTML has rendered (loadingMatrix flips
  // to false) and after the next paint so the table is in the DOM.
  useEffect(() => {
    if (loadingMatrix || !scrollToSpec || !rootRef.current) return;
    // Try common slug variants: "hsr" first since that's the most populous
    // CSHSE matrix; fall back to all candidates.
    const candidates = ['hsr', 'non-hsr'].map(
      (slug) => `matrix-${slug}-row-${scrollToSpec.std}-${scrollToSpec.spec}`
    );
    let row: HTMLElement | null = null;
    for (const id of candidates) {
      row = rootRef.current.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (row) break;
    }
    if (!row) {
      // Fall back to a data-attribute lookup for any custom slug.
      row = rootRef.current.querySelector<HTMLElement>(
        `tr[data-std="${scrollToSpec.std}"][data-spec="${scrollToSpec.spec}"]`
      );
    }
    if (!row) {
      onScrollConsumed?.();
      return;
    }
    // Make sure the surrounding accordion is expanded (the row may be inside
    // a collapsed Standard panel).
    setExpandedStandards((prev) => {
      const std = scrollToSpec.std;
      if (prev.has(std)) return prev;
      const next = new Set(prev);
      next.add(std);
      return next;
    });
    // Defer the scroll one paint so the accordion expansion lands first.
    const handle = requestAnimationFrame(() => {
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row?.classList.add('cshse-matrix-row-flash');
      setTimeout(() => {
        row?.classList.remove('cshse-matrix-row-flash');
        onScrollConsumed?.();
      }, 2200);
    });
    return () => cancelAnimationFrame(handle);
  }, [loadingMatrix, scrollToSpec, onScrollConsumed]);

  if (loadingMatrix) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const rawSections = matrix?.rawContent || [];
  const hasRawContent = rawSections.length > 0;

  const renderSectionContent = (raw: RawMatrixContent) => (
    <div key={raw.id} className="border-t border-gray-100">
      <div className="flex items-center justify-between px-4 py-2 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="text-sm text-gray-700 truncate">
            {raw.title || 'Imported Section'}
          </span>
        </div>
        <button
          onClick={() => handleDeleteRawContent(raw.id)}
          disabled={deletingRawId === raw.id}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors shrink-0 ml-2"
          title="Remove imported section"
        >
          {deletingRawId === raw.id ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
      <div className="px-4 pb-4 overflow-auto">
        <div
          className="prose prose-sm max-w-none
            [&_table]:border-collapse [&_table]:w-full [&_table]:table-auto
            [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_td]:text-sm
            [&_th]:border [&_th]:border-gray-300 [&_th]:px-2 [&_th]:py-1 [&_th]:text-sm [&_th]:font-semibold
            [&_tr]:even:bg-gray-50"
          dangerouslySetInnerHTML={{ __html: raw.content }}
        />
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="curriculum-matrix-editor flex flex-col h-full overflow-hidden">
      <style>{`
        .cshse-matrix-row-flash { background-color: #fef9c3 !important; transition: background-color 0.4s ease; }
      `}</style>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Curriculum Matrix</h2>
          {hasRawContent && (
            <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              {rawSections.length} imported section{rawSections.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {/* Standards as accordion sections */}
        {curriculumStandards.map((standard) => {
          const sections = sectionsByStandard.groups.get(standard.code) || [];
          const hasContent = standardsWithContent.has(standard.code);
          const isExpanded = expandedStandards.has(standard.code);

          return (
            <div key={standard.code} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Standard Header */}
              <button
                onClick={() => toggleStandard(standard.code)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                )}
                <span className="font-semibold text-gray-900">Standard {standard.code}</span>
                <span className="text-sm text-gray-600 truncate">- {standard.title}</span>
                {hasContent && (
                  <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full shrink-0">
                    {sections.length} section{sections.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {/* Standard Content */}
              {isExpanded && (
                <div>
                  {sections.length > 0 ? (
                    sections.map(renderSectionContent)
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-gray-400 border-t border-gray-100">
                      No matrix content imported for this standard yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Ungrouped sections (no standardCode) */}
        {sectionsByStandard.ungrouped.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
              <span className="font-semibold text-gray-900">Other Imported Sections</span>
            </div>
            {sectionsByStandard.ungrouped.map(renderSectionContent)}
          </div>
        )}

        {/* Empty state */}
        {!hasRawContent && curriculumStandards.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Grid3X3 className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Matrix Content Yet</h3>
            <p className="text-sm text-gray-500 max-w-md">
              Import matrix sections from the document using the Section Tagger.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default CurriculumMatrixEditor;
