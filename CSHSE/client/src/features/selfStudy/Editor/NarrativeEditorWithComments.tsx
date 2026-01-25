import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Lock, Eye, MessageSquare } from 'lucide-react';
import { NarrativeEditor } from './NarrativeEditor';
import {
  CommentSidebar,
  CommentableText,
  CommentNavigation,
  ReaderLockedBanner
} from '../../comments';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Comment {
  _id: string;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  content: string;
  authorName: string;
  authorRole: 'reader' | 'lead_reader';
  replies: any[];
  isResolved: boolean;
}

interface LockStatus {
  isLocked: boolean;
  canEdit: boolean;
  lockMessage: string;
  lockDetails: any;
}

interface NarrativeEditorWithCommentsProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  initialContent: string;
  standardText: string;
  placeholder?: string;
  onSave: (content: string) => Promise<void>;
  onContentChange?: (content: string) => void;
  currentUserId: string;
  currentUserRole: 'reader' | 'lead_reader' | 'program_coordinator' | 'admin';
}

export function NarrativeEditorWithComments({
  submissionId,
  standardCode,
  specCode,
  initialContent,
  standardText,
  placeholder,
  onSave,
  onContentChange,
  currentUserId,
  currentUserRole
}: NarrativeEditorWithCommentsProps) {
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [currentCommentPage, setCurrentCommentPage] = useState(1);
  const [showCommentView, setShowCommentView] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Fetch comments for this standard/spec
  const { data: commentsData, refetch: refetchComments } = useQuery({
    queryKey: ['comments', submissionId, standardCode, specCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('standardCode', standardCode);
      if (specCode) params.append('specCode', specCode);

      const response = await axios.get(
        `${API_BASE}/submissions/${submissionId}/comments?${params}`
      );
      return response.data;
    }
  });

  const comments: Comment[] = commentsData?.comments || [];

  // Determine if user can edit
  const canEdit = lockStatus?.canEdit ?? (currentUserRole !== 'program_coordinator' || !lockStatus?.isLocked);
  const isReaderOrLeadReader = currentUserRole === 'reader' || currentUserRole === 'lead_reader';
  const isProgramCoordinator = currentUserRole === 'program_coordinator';
  const hasComments = comments.length > 0;

  // Handle comment click - scroll to highlighted text
  const handleCommentClick = useCallback((comment: Comment) => {
    setHighlightedCommentId(comment._id);

    // Scroll to the comment marker in the editor
    const marker = document.getElementById(`comment-marker-${comment._id}`);
    if (marker) {
      marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Clear highlight after a few seconds
    setTimeout(() => setHighlightedCommentId(null), 3000);
  }, []);

  // Handle navigation to a comment from the navigation header
  const handleNavigateToComment = useCallback(
    (stdCode: string, spCode?: string, commentId?: string) => {
      // If navigating to a different standard/spec, this would need to be handled
      // by the parent component through a callback
      if (stdCode === standardCode && (!spCode || spCode === specCode)) {
        if (commentId) {
          const comment = comments.find(c => c._id === commentId);
          if (comment) {
            handleCommentClick(comment);
          }
        }
      }
    },
    [standardCode, specCode, comments, handleCommentClick]
  );

  // Handle lock status change
  const handleLockStatusChange = useCallback((status: LockStatus) => {
    setLockStatus(status);
  }, []);

  // For program coordinators when locked - show read-only view with comments
  if (isProgramCoordinator && lockStatus?.isLocked) {
    return (
      <div className="narrative-editor-with-comments flex flex-col h-full">
        {/* Reader Lock Banner */}
        <ReaderLockedBanner
          submissionId={submissionId}
          currentUserRole={currentUserRole}
          onLockStatusChange={handleLockStatusChange}
        />

        {/* Comment Navigation Header */}
        {hasComments && (
          <CommentNavigation
            submissionId={submissionId}
            currentPage={currentCommentPage}
            onPageChange={setCurrentCommentPage}
            onNavigateToComment={handleNavigateToComment}
          />
        )}

        {/* Standard Text Reference */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-teal-800 mb-2">
            Standard {standardCode}{specCode ? `.${specCode}` : ''} Requirement
          </h4>
          <p className="text-sm text-teal-700">{standardText}</p>
        </div>

        {/* Read-Only Content with Comments */}
        <div className="flex flex-1 overflow-hidden">
          <div
            ref={editorContainerRef}
            className="flex-1 border border-gray-200 rounded-lg p-4 overflow-y-auto bg-gray-50"
          >
            <div className="flex items-center gap-2 mb-4 text-amber-700 bg-amber-50 p-3 rounded-lg">
              <Lock className="w-5 h-5" />
              <span className="text-sm font-medium">Read-Only Mode</span>
            </div>

            <CommentableText
              content={initialContent.replace(/<[^>]*>/g, '')} // Strip HTML for plain text view
              submissionId={submissionId}
              standardCode={standardCode}
              specCode={specCode}
              comments={comments}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              highlightedCommentId={highlightedCommentId}
            />
          </div>

          {/* Comment Sidebar */}
          {hasComments && (
            <CommentSidebar
              submissionId={submissionId}
              standardCode={standardCode}
              specCode={specCode}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onCommentClick={handleCommentClick}
            />
          )}
        </div>
      </div>
    );
  }

  // For readers/lead readers - full editing with comment capabilities
  if (isReaderOrLeadReader) {
    return (
      <div className="narrative-editor-with-comments flex flex-col h-full">
        {/* Reader Lock Banner - allows locking/unlocking */}
        <ReaderLockedBanner
          submissionId={submissionId}
          currentUserRole={currentUserRole}
          onLockStatusChange={handleLockStatusChange}
        />

        {/* Comment Navigation Header */}
        {hasComments && (
          <CommentNavigation
            submissionId={submissionId}
            currentPage={currentCommentPage}
            onPageChange={setCurrentCommentPage}
            onNavigateToComment={handleNavigateToComment}
          />
        )}

        {/* Toggle between editor view and comment view */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => setShowCommentView(false)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              !showCommentView
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            View Content
          </button>
          <button
            onClick={() => setShowCommentView(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
              showCommentView
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Add Comments ({comments.length})
          </button>
        </div>

        {showCommentView ? (
          // Comment view - allows selecting text and adding comments
          <div className="flex flex-1 overflow-hidden">
            <div
              ref={editorContainerRef}
              className="flex-1 border border-gray-200 rounded-lg p-4 overflow-y-auto"
            >
              {/* Standard Text Reference */}
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-teal-800 mb-2">
                  Standard {standardCode}{specCode ? `.${specCode}` : ''} Requirement
                </h4>
                <p className="text-sm text-teal-700">{standardText}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700">
                  <strong>Tip:</strong> Select text and right-click to add a comment.
                  Highlighted sections have existing comments.
                </p>
              </div>

              <CommentableText
                content={initialContent.replace(/<[^>]*>/g, '')}
                submissionId={submissionId}
                standardCode={standardCode}
                specCode={specCode}
                comments={comments}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onCommentAdded={() => refetchComments()}
                highlightedCommentId={highlightedCommentId}
              />
            </div>

            {/* Comment Sidebar */}
            {hasComments && (
              <CommentSidebar
                submissionId={submissionId}
                standardCode={standardCode}
                specCode={specCode}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onCommentClick={handleCommentClick}
              />
            )}
          </div>
        ) : (
          // Regular editor view
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1">
              <NarrativeEditor
                submissionId={submissionId}
                standardCode={standardCode}
                specCode={specCode}
                initialContent={initialContent}
                standardText={standardText}
                placeholder={placeholder}
                onSave={onSave}
                onContentChange={onContentChange}
                readOnly={false}
              />
            </div>

            {/* Show comment sidebar even in editor view */}
            {hasComments && (
              <CommentSidebar
                submissionId={submissionId}
                standardCode={standardCode}
                specCode={specCode}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                onCommentClick={handleCommentClick}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // For program coordinators when NOT locked (can edit)
  // or for other roles
  return (
    <div className="narrative-editor-with-comments flex flex-col h-full">
      {/* Reader Lock Banner (for program coordinators shows sent-back status) */}
      <ReaderLockedBanner
        submissionId={submissionId}
        currentUserRole={currentUserRole}
        onLockStatusChange={handleLockStatusChange}
      />

      {/* Comment Navigation Header */}
      {hasComments && (
        <CommentNavigation
          submissionId={submissionId}
          currentPage={currentCommentPage}
          onPageChange={setCurrentCommentPage}
          onNavigateToComment={handleNavigateToComment}
        />
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <NarrativeEditor
            submissionId={submissionId}
            standardCode={standardCode}
            specCode={specCode}
            initialContent={initialContent}
            standardText={standardText}
            placeholder={placeholder}
            onSave={onSave}
            onContentChange={onContentChange}
            readOnly={!canEdit}
          />
        </div>

        {/* Comment Sidebar (read-only for program coordinator) */}
        {hasComments && (
          <CommentSidebar
            submissionId={submissionId}
            standardCode={standardCode}
            specCode={specCode}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onCommentClick={handleCommentClick}
          />
        )}
      </div>
    </div>
  );
}

export default NarrativeEditorWithComments;
