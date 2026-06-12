import React from 'react';
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
  // When the user navigates to a comment (next/prev or from the chat window),
  // this is the comment id to flash on the highlighted text.
  highlightCommentId?: string | null;
}

/**
 * The self-study comment process, reused per specification on the Reader Report:
 * the spec's narrative+evidence rendered as commentable text. Commented text is
 * highlighted INLINE (so comments sit next to the text they're on); select text
 * → right-click → Add Comment. Threads + replies live in the right chat window.
 */
export function SpecComments({ submissionId, standardCode, specCode, contentHtml, currentUserId, currentUserRole, highlightCommentId = null }: SpecCommentsProps): JSX.Element {
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

  return (
    <div data-testid={`rr-comments-${standardCode}-${specCode}`} className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
        <MessageSquare className="h-4 w-4" /> Narrative &amp; evidence — {comments.length} comment{comments.length === 1 ? '' : 's'}
        <span className="font-normal text-slate-400">· highlighted text has a comment; select text to add one</span>
      </div>
      <div className="p-3">
        {/* The reading + comment surface: commented text is highlighted inline,
            so comments sit right next to the text. Select text → right-click →
            Add Comment. Threads + replies live in the right "All comments" window. */}
        <CommentableText
          content={htmlToReadableText(contentHtml)}
          submissionId={submissionId}
          standardCode={standardCode}
          specCode={specCode}
          comments={comments as any}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onCommentAdded={() => refetch()}
          highlightedCommentId={highlightCommentId}
        />
      </div>
    </div>
  );
}

export default SpecComments;
