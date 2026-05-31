import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { MessageSquare, Trash2, X, Paperclip, FileText, Loader2 } from 'lucide-react';
import {
  validateAttachmentFile,
  formatBytes,
  ATTACHMENT_ACCEPT
} from './attachmentValidation';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Comment {
  _id: string;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  content: string;
  authorName: string;
}

interface CommentableTextProps {
  content: string;
  submissionId: string;
  standardCode: string;
  specCode?: string;
  comments: Comment[];
  currentUserId: string;
  currentUserRole: 'reader' | 'lead_reader' | 'program_coordinator' | 'admin';
  onCommentAdded?: () => void;
  highlightedCommentId?: string | null;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  existingCommentId?: string;
}

interface CommentModalState {
  visible: boolean;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
}

export function CommentableText({
  content,
  submissionId,
  standardCode,
  specCode,
  comments,
  currentUserId,
  currentUserRole,
  onCommentAdded,
  highlightedCommentId
}: CommentableTextProps) {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0
  });
  const [commentModal, setCommentModal] = useState<CommentModalState>({
    visible: false,
    selectedText: '',
    selectionStart: 0,
    selectionEnd: 0
  });
  const [newCommentContent, setNewCommentContent] = useState('');
  // CR-021 — files staged in the composer; uploaded after the comment is
  // created (the upload endpoint is keyed by the new comment's id).
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canComment = currentUserRole === 'reader' || currentUserRole === 'lead_reader';

  const resetComposer = useCallback(() => {
    setCommentModal({ visible: false, selectedText: '', selectionStart: 0, selectionEnd: 0 });
    setNewCommentContent('');
    setStagedFiles([]);
    setAttachError(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    setAttachError(null);
    const accepted: File[] = [];
    for (const f of picked) {
      const result = validateAttachmentFile({ mimeType: f.type, sizeBytes: f.size });
      if (result.ok) {
        accepted.push(f);
      } else {
        setAttachError(`${f.name}: ${result.error}`);
      }
    }
    if (accepted.length > 0) setStagedFiles((prev) => [...prev, ...accepted]);
    // Allow re-picking the same file after a removal.
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveStaged = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadStagedAttachments = async (commentId: string) => {
    for (const file of stagedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(
        `${API_BASE}/comments/${commentId}/attachments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
    }
  };

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (data: {
      selectedText: string;
      selectionStart: number;
      selectionEnd: number;
      content: string;
    }) => {
      const response = await api.post(
        `${API_BASE}/submissions/${submissionId}/comments`,
        {
          standardCode,
          specCode,
          ...data
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['comments', submissionId, standardCode, specCode]
      });
      queryClient.invalidateQueries({
        queryKey: ['comments-summary', submissionId]
      });
      onCommentAdded?.();
    }
  });

  // Delete comment mutation
  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`${API_BASE}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['comments', submissionId, standardCode, specCode]
      });
      queryClient.invalidateQueries({
        queryKey: ['comments-summary', submissionId]
      });
    }
  });

  // Handle right-click context menu
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!canComment) return;

      const selection = window.getSelection();
      const selectedText = selection?.toString().trim() || '';

      if (selectedText.length > 0) {
        e.preventDefault();

        // Calculate selection position in the text
        const range = selection?.getRangeAt(0);
        const preCaretRange = range?.cloneRange();
        preCaretRange?.selectNodeContents(containerRef.current!);
        preCaretRange?.setEnd(range!.startContainer, range!.startOffset);
        const selectionStart = preCaretRange?.toString().length || 0;
        const selectionEnd = selectionStart + selectedText.length;

        // Check if there's an existing comment for this selection
        const existingComment = comments.find(
          c => c.selectionStart === selectionStart && c.selectionEnd === selectionEnd
        );

        setContextMenu({
          visible: true,
          x: e.clientX,
          y: e.clientY,
          selectedText,
          selectionStart,
          selectionEnd,
          existingCommentId: existingComment?._id
        });
      }
    },
    [canComment, comments]
  );

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Handle add comment from context menu
  const handleAddComment = () => {
    setCommentModal({
      visible: true,
      selectedText: contextMenu.selectedText,
      selectionStart: contextMenu.selectionStart,
      selectionEnd: contextMenu.selectionEnd
    });
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Handle delete comment from context menu
  const handleDeleteComment = () => {
    if (contextMenu.existingCommentId) {
      deleteCommentMutation.mutate(contextMenu.existingCommentId);
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Submit new comment, then upload any staged attachments to the new
  // comment id. The comment is committed even if an attachment upload fails;
  // we surface the upload error but keep the modal open so the user can retry.
  const handleSubmitComment = async () => {
    if (!newCommentContent.trim()) return;
    try {
      const result = await createCommentMutation.mutateAsync({
        selectedText: commentModal.selectedText,
        selectionStart: commentModal.selectionStart,
        selectionEnd: commentModal.selectionEnd,
        content: newCommentContent.trim()
      });
      const commentId = result?.comment?._id;
      if (commentId && stagedFiles.length > 0) {
        setUploading(true);
        try {
          await uploadStagedAttachments(String(commentId));
        } catch (err: any) {
          setUploading(false);
          setAttachError(
            err?.response?.data?.error || 'Comment saved, but a file failed to upload. Please try again.'
          );
          queryClient.invalidateQueries({
            queryKey: ['comments', submissionId, standardCode, specCode]
          });
          return;
        }
        queryClient.invalidateQueries({
          queryKey: ['comments', submissionId, standardCode, specCode]
        });
      }
      resetComposer();
    } catch {
      // create-comment failure is reflected via createCommentMutation state.
    }
  };

  // Render text with highlighted comments
  const renderHighlightedContent = () => {
    if (comments.length === 0) {
      return <span>{content}</span>;
    }

    // Sort comments by start position
    const sortedComments = [...comments].sort((a, b) => a.selectionStart - b.selectionStart);

    const elements: React.ReactNode[] = [];
    let currentIndex = 0;

    sortedComments.forEach((comment, i) => {
      // Add text before this comment
      if (comment.selectionStart > currentIndex) {
        elements.push(
          <span key={`text-${i}`}>
            {content.slice(currentIndex, comment.selectionStart)}
          </span>
        );
      }

      // Add highlighted comment text
      const isHighlighted = highlightedCommentId === comment._id;
      elements.push(
        <mark
          key={`comment-${comment._id}`}
          id={`comment-marker-${comment._id}`}
          className={`cursor-pointer transition-colors ${
            isHighlighted
              ? 'bg-yellow-400 ring-2 ring-yellow-500'
              : 'bg-yellow-200 hover:bg-yellow-300'
          }`}
          title={`Comment by ${comment.authorName}: ${comment.content.substring(0, 50)}...`}
        >
          {content.slice(comment.selectionStart, comment.selectionEnd)}
        </mark>
      );

      currentIndex = comment.selectionEnd;
    });

    // Add remaining text
    if (currentIndex < content.length) {
      elements.push(
        <span key="text-end">{content.slice(currentIndex)}</span>
      );
    }

    return elements;
  };

  return (
    <>
      {/* Commentable Text Container */}
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        className="prose prose-sm max-w-none"
      >
        {renderHighlightedContent()}
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {!contextMenu.existingCommentId ? (
            <button
              onClick={handleAddComment}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Add Comment
            </button>
          ) : (
            <button
              onClick={handleDeleteComment}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Comment
            </button>
          )}
        </div>
      )}

      {/* Comment Modal */}
      {commentModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Comment</h3>
              <button
                onClick={resetComposer}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Selected text preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Selected Text
                </label>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-gray-700 italic">
                  "{commentModal.selectedText}"
                </div>
              </div>

              {/* Comment input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Comment
                </label>
                <textarea
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  placeholder="Enter your comment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  rows={4}
                  autoFocus
                />
              </div>

              {/* CR-021 — attachments */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ATTACHMENT_ACCEPT}
                  onChange={handleSelectFiles}
                  className="hidden"
                  data-testid="comment-attachment-input"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  <Paperclip className="w-4 h-4" />
                  Attach file
                </button>
                <p className="mt-1 text-xs text-gray-400">PDF, DOC, DOCX, or TXT · up to 25 MB</p>

                {stagedFiles.length > 0 && (
                  <ul className="mt-2 space-y-1" data-testid="comment-staged-files">
                    {stagedFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-gray-700">
                          <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                          <span className="truncate">{file.name}</span>
                          <span className="shrink-0 text-xs text-gray-400">({formatBytes(file.size)})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveStaged(index)}
                          disabled={uploading}
                          className="shrink-0 rounded p-0.5 text-gray-400 hover:text-red-600 disabled:opacity-50"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {attachError && (
                  <p className="mt-2 text-xs text-red-600" data-testid="comment-attachment-error">
                    {attachError}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              <button
                onClick={resetComposer}
                disabled={uploading}
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitComment}
                disabled={!newCommentContent.trim() || createCommentMutation.isPending || uploading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(createCommentMutation.isPending || uploading) && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading
                  ? 'Uploading…'
                  : createCommentMutation.isPending
                    ? 'Adding…'
                    : 'Add Comment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CommentableText;
