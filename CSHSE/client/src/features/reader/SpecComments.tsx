import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { CommentableText, CommentSidebar } from '../comments';

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

  const handleCommentClick = (c: any) => {
    setHighlightedCommentId(c._id);
    const m = document.getElementById(`comment-marker-${c._id}`);
    if (m) m.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightedCommentId(null), 3000);
  };

  return (
    <div data-testid={`rr-comments-${standardCode}-${specCode}`} className="mt-3 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
        <MessageSquare className="h-4 w-4" /> Comments ({comments.length})
        <span className="font-normal text-slate-400">— select text below, right-click to add</span>
      </div>
      <div className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="min-w-0 lg:flex-1">
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
          {/* Always-open comment thread (its own header + prev/next + replies). */}
          <div className="lg:w-80 lg:shrink-0">
            <CommentSidebar
              submissionId={submissionId}
              standardCode={standardCode}
              specCode={specCode}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              onCommentClick={handleCommentClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpecComments;
