import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { CommentableText } from '../comments';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/** HTML → readable plain text so comments anchor by character offset but tables
 *  stay legible (mirrors NarrativeEditorWithComments). */
function htmlToReadableText(html: string): string {
  return String(html || '')
    .replace(/<\/\s*(td|th)\s*>/gi, ' | ')
    .replace(/<\/\s*tr\s*>/gi, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|table)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/[ \t]*\|\s*$/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface SpecCommentsProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  contentHtml: string;
  currentUserId: string;
  currentUserRole: 'reader' | 'lead_reader' | 'program_coordinator' | 'admin';
}

/**
 * The self-study comment process, reused per specification on the Reader Report:
 * the spec's narrative+evidence rendered as commentable text (select → right-click
 * → Add Comment) with the comment thread sidebar. Collapsed by default.
 */
export function SpecComments({ submissionId, standardCode, specCode, contentHtml, currentUserId, currentUserRole }: SpecCommentsProps): JSX.Element {
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ['comments', submissionId, standardCode, specCode],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('standardCode', standardCode);
      if (specCode) params.append('specCode', specCode);
      const r = await api.get(`${API_BASE}/submissions/${submissionId}/comments?${params}`);
      return r.data;
    },
    enabled: !!submissionId && !!standardCode,
    refetchOnWindowFocus: false,
  });
  const comments: any[] = data?.comments || [];
  // highlightedCommentId is kept for CommentableText's highlight prop; setter
  // is currently unused but retained for future "jump from drawer" wiring.
  void setHighlightedCommentId;

  return (
    <div data-testid={`rr-comments-${standardCode}-${specCode}`} className="mt-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
        <MessageSquare className="h-4 w-4" /> Add a comment ({comments.length})
        <span className="font-normal text-slate-400">— select text below, right-click to add. All comments appear in the chat window on the right.</span>
      </div>
      <div className="p-3">
        {/* The add surface: select text → right-click → Add Comment. The full
            threaded discussion lives in the right-hand "All comments" drawer. */}
        <CommentableText
          content={htmlToReadableText(contentHtml)}
          submissionId={submissionId}
          standardCode={standardCode}
          specCode={specCode}
          comments={comments as any}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onCommentAdded={() => refetch()}
          highlightedCommentId={highlightedCommentId}
        />
      </div>
    </div>
  );
}

export default SpecComments;
