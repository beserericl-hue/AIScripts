import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  MessageSquare,
  Reply,
  Trash2,
  CheckCircle,
  Circle,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
  X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface CommentReply {
  _id: string;
  authorId: string;
  authorName: string;
  authorRole: 'reader' | 'lead_reader' | 'program_coordinator';
  content: string;
  createdAt: string;
}

interface Comment {
  _id: string;
  standardCode: string;
  specCode?: string;
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
  authorId: string;
  authorName: string;
  authorRole: 'reader' | 'lead_reader';
  content: string;
  replies: CommentReply[];
  isResolved: boolean;
  createdAt: string;
}

interface CommentSidebarProps {
  submissionId: string;
  standardCode: string;
  specCode?: string;
  currentUserId: string;
  currentUserRole: 'reader' | 'lead_reader' | 'program_coordinator' | 'admin';
  onCommentClick?: (comment: Comment) => void;
}

const roleColors: Record<string, string> = {
  reader: 'bg-blue-100 text-blue-800',
  lead_reader: 'bg-purple-100 text-purple-800',
  program_coordinator: 'bg-green-100 text-green-800'
};

const roleLabels: Record<string, string> = {
  reader: 'Reader',
  lead_reader: 'Lead Reader',
  program_coordinator: 'Program Coordinator'
};

export function CommentSidebar({
  submissionId,
  standardCode,
  specCode,
  currentUserId,
  currentUserRole,
  onCommentClick
}: CommentSidebarProps) {
  const queryClient = useQueryClient();
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Fetch comments for this standard/spec
  const { data, isLoading } = useQuery({
    queryKey: ['comments', submissionId, standardCode, specCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('standardCode', standardCode);
      if (specCode) params.append('specCode', specCode);

      const response = await api.get(
        `${API_BASE}/submissions/${submissionId}/comments?${params}`
      );
      return response.data;
    }
  });

  // Add reply mutation
  const addReplyMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const response = await api.post(
        `${API_BASE}/comments/${commentId}/replies`,
        { content }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['comments', submissionId, standardCode, specCode]
      });
      setReplyingTo(null);
      setReplyContent('');
    }
  });

  // Delete reply mutation
  const deleteReplyMutation = useMutation({
    mutationFn: async ({ commentId, replyId }: { commentId: string; replyId: string }) => {
      await api.delete(`${API_BASE}/comments/${commentId}/replies/${replyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['comments', submissionId, standardCode, specCode]
      });
    }
  });

  // Toggle resolve mutation
  const toggleResolveMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await api.post(`${API_BASE}/comments/${commentId}/resolve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['comments', submissionId, standardCode, specCode]
      });
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
    }
  });

  const toggleExpanded = (commentId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  };

  const handleReplySubmit = (commentId: string) => {
    if (replyContent.trim()) {
      addReplyMutation.mutate({ commentId, content: replyContent.trim() });
    }
  };

  const canDeleteComment = (comment: Comment) => {
    return comment.authorId === currentUserId || currentUserRole === 'lead_reader';
  };

  const canResolve = () => {
    return currentUserRole === 'reader' || currentUserRole === 'lead_reader';
  };

  const canReply = () => {
    return ['reader', 'lead_reader', 'program_coordinator'].includes(currentUserRole);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="w-80 border-l border-gray-200 bg-gray-50 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const comments: Comment[] = data?.comments || [];

  if (comments.length === 0) {
    return null; // Don't show sidebar if no comments
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">
            Comments ({comments.length})
          </h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Standard {standardCode}{specCode ? `, Spec ${specCode}` : ''}
        </p>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {comments.map((comment) => {
          const isExpanded = expandedComments.has(comment._id);
          const hasReplies = comment.replies.length > 0;

          return (
            <div
              key={comment._id}
              className={`bg-white rounded-lg shadow-sm border ${
                comment.isResolved
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200'
              }`}
            >
              {/* Comment Header */}
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {comment.authorName}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${roleColors[comment.authorRole]}`}>
                        {roleLabels[comment.authorRole]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {canResolve() && (
                      <button
                        onClick={() => toggleResolveMutation.mutate(comment._id)}
                        className={`p-1 rounded hover:bg-gray-100 ${
                          comment.isResolved ? 'text-green-600' : 'text-gray-400'
                        }`}
                        title={comment.isResolved ? 'Mark unresolved' : 'Mark resolved'}
                      >
                        {comment.isResolved ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {canDeleteComment(comment) && (
                      <button
                        onClick={() => deleteCommentMutation.mutate(comment._id)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                        title="Delete comment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Selected Text Preview */}
              <div
                className="px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400 cursor-pointer"
                onClick={() => onCommentClick?.(comment)}
              >
                <p className="text-xs text-yellow-800 italic line-clamp-2">
                  "{comment.selectedText}"
                </p>
              </div>

              {/* Comment Content */}
              <div className="p-3">
                <p className="text-sm text-gray-700">{comment.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatDate(comment.createdAt)}
                </div>
              </div>

              {/* Replies Section */}
              {(hasReplies || isExpanded) && (
                <div className="border-t border-gray-100">
                  {/* Toggle Replies */}
                  {hasReplies && (
                    <button
                      onClick={() => toggleExpanded(comment._id)}
                      className="w-full px-3 py-2 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <span>{comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}

                  {/* Expanded Replies */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3">
                      {comment.replies.map((reply) => (
                        <div
                          key={reply._id}
                          className="pl-3 border-l-2 border-gray-200"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-medium text-gray-900">
                                {reply.authorName}
                              </p>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${roleColors[reply.authorRole]}`}>
                                {roleLabels[reply.authorRole]}
                              </span>
                            </div>
                            {reply.authorId === currentUserId && (
                              <button
                                onClick={() =>
                                  deleteReplyMutation.mutate({
                                    commentId: comment._id,
                                    replyId: reply._id
                                  })
                                }
                                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{reply.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(reply.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reply Input */}
              {canReply() && (
                <div className="border-t border-gray-100 p-3">
                  {replyingTo === comment._id ? (
                    <div className="space-y-2">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyContent('');
                          }}
                          className="px-3 py-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReplySubmit(comment._id)}
                          disabled={!replyContent.trim() || addReplyMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                          Reply
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setReplyingTo(comment._id);
                        if (!isExpanded && hasReplies) {
                          toggleExpanded(comment._id);
                        }
                      }}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-teal-600"
                    >
                      <Reply className="w-3 h-3" />
                      Reply
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CommentSidebar;
