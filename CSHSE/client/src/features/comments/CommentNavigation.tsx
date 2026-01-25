import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import {
  MessageSquare,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  AlertCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface CommentSummary {
  totalComments: number;
  totalUnresolved: number;
  bySection: {
    standardCode: string;
    specCode?: string;
    count: number;
    unresolvedCount: number;
  }[];
  firstComment: {
    standardCode: string;
    specCode?: string;
    commentId: string;
  } | null;
}

interface NavigationData {
  comments: {
    _id: string;
    standardCode: string;
    specCode?: string;
    selectedText: string;
    authorName: string;
    isResolved: boolean;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasFirst: boolean;
    hasPrevious: boolean;
    hasNext: boolean;
    hasLast: boolean;
  };
  navigation: {
    first: number;
    previous: number;
    next: number;
    last: number;
  };
}

interface CommentNavigationProps {
  submissionId: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onNavigateToComment: (standardCode: string, specCode?: string, commentId?: string) => void;
}

export function CommentNavigation({
  submissionId,
  currentPage,
  onPageChange,
  onNavigateToComment
}: CommentNavigationProps) {
  // Fetch comment summary
  const { data: summary, isLoading: summaryLoading } = useQuery<CommentSummary>({
    queryKey: ['comments-summary', submissionId],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/comments/summary`
      );
      return response.data;
    }
  });

  // Fetch navigation data
  const { data: navData, isLoading: navLoading } = useQuery<NavigationData>({
    queryKey: ['comments-navigate', submissionId, currentPage],
    queryFn: async () => {
      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/comments/navigate?page=${currentPage}&limit=10`
      );
      return response.data;
    },
    enabled: !!summary && summary.totalComments > 0
  });

  if (summaryLoading) {
    return (
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="animate-pulse flex items-center gap-4">
          <div className="h-5 w-32 bg-gray-200 rounded" />
          <div className="h-8 w-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!summary || summary.totalComments === 0) {
    return null;
  }

  const pagination = navData?.pagination;
  const navigation = navData?.navigation;

  const handleGoToFirst = () => {
    if (summary.firstComment) {
      onNavigateToComment(
        summary.firstComment.standardCode,
        summary.firstComment.specCode,
        summary.firstComment.commentId
      );
    }
    if (navigation) {
      onPageChange(navigation.first);
    }
  };

  const handleGoToPrevious = () => {
    if (navigation && pagination?.hasPrevious) {
      onPageChange(navigation.previous);
    }
  };

  const handleGoToNext = () => {
    if (navigation && pagination?.hasNext) {
      onPageChange(navigation.next);
    }
  };

  const handleGoToLast = () => {
    if (navigation) {
      onPageChange(navigation.last);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Comment Count */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            <span className="font-medium text-gray-900">
              {summary.totalComments} {summary.totalComments === 1 ? 'Comment' : 'Comments'}
            </span>
          </div>

          {summary.totalUnresolved > 0 && (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">
                {summary.totalUnresolved} unresolved
              </span>
            </div>
          )}

          {/* Go to First Comment Button */}
          <button
            onClick={handleGoToFirst}
            className="px-3 py-1.5 text-sm bg-teal-50 text-teal-700 rounded-lg hover:bg-teal-100 transition-colors"
          >
            Go to First Comment
          </button>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          {/* First (<<) */}
          <button
            onClick={handleGoToFirst}
            disabled={!pagination?.hasFirst}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Go to first page"
          >
            <ChevronsLeft className="w-5 h-5 text-gray-600" />
          </button>

          {/* Previous (<) */}
          <button
            onClick={handleGoToPrevious}
            disabled={!pagination?.hasPrevious}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Previous page"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>

          {/* Page indicator */}
          {pagination && (
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
          )}

          {/* Next (>) */}
          <button
            onClick={handleGoToNext}
            disabled={!pagination?.hasNext}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Next page"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>

          {/* Last (>>) */}
          <button
            onClick={handleGoToLast}
            disabled={!pagination?.hasLast}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Go to last page"
          >
            <ChevronsRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Current Page Comments Preview */}
      {navData && navData.comments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {navData.comments.map((comment) => (
            <button
              key={comment._id}
              onClick={() =>
                onNavigateToComment(comment.standardCode, comment.specCode, comment._id)
              }
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                comment.isResolved
                  ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
              }`}
            >
              Std {comment.standardCode}
              {comment.specCode && `.${comment.specCode}`}
              {' - '}
              {comment.selectedText.substring(0, 20)}...
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommentNavigation;
