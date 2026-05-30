/**
 * CR-004 — role-aware comment serializer.
 *
 * The PC tier sees a *redacted* view of comments:
 *   - only comments with `relayed === true` cross over;
 *   - reader identity (`authorId`, `authorName`, `originalReaderId`) is
 *     wiped; the PC sees `pcLabel` (e.g. "Reader A") or no attribution;
 *   - `relayedText` replaces `content` when present, so Julia can
 *     sanitize phrasing without touching the original;
 *   - replies follow the same rule: only replies with `relayed === true`
 *     (or any program_coordinator reply, which is visible to the PC
 *     because they wrote it) cross into the PC view.
 *
 * The reader / lead_reader / admin / superuser tiers see the raw doc.
 *
 * Server-side enforcement (NOT just UI hiding): this serializer is the
 * one place every comment-returning controller must funnel through.
 * If a future code path goes around it, the PC could see reader names.
 */

export type ViewerRole = 'program_coordinator' | 'reader' | 'lead_reader' | 'admin' | string;

export interface RawReply {
  _id?: any;
  authorId?: any;
  authorName?: string;
  authorRole?: string;
  content?: string;
  relayed?: boolean;
  relayedText?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RawComment {
  _id?: any;
  submissionId?: any;
  standardCode?: string;
  specCode?: string | null;
  selectedText?: string;
  selectionStart?: number;
  selectionEnd?: number;
  authorId?: any;
  authorName?: string;
  authorRole?: string;
  content?: string;
  replies?: RawReply[];
  isResolved?: boolean;
  resolvedBy?: any;
  resolvedAt?: Date;
  relayed?: boolean;
  relayedText?: string;
  pcLabel?: string;
  originalReaderId?: any;
  relayedAt?: Date;
  relayedBy?: any;
  boardEscalated?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const READER_ID_FIELDS = [
  'authorId',
  'originalReaderId',
  'relayedBy',
];

function stripReaderIdentity(raw: RawComment): Partial<RawComment> {
  const out: Partial<RawComment> = { ...raw };
  for (const f of READER_ID_FIELDS) {
    delete (out as any)[f];
  }
  // Author name → pcLabel (if set) or "(redacted)".
  out.authorName = raw.pcLabel || '';
  out.authorRole = 'reader'; // generic role label is fine; we just stripped the identity.
  // Replace content with the relayed (sanitized) text if provided.
  if (raw.relayedText) {
    out.content = raw.relayedText;
  }
  return out;
}

function stripReplyForPc(reply: RawReply): RawReply | null {
  // PC's own replies are always visible to them. Reader replies are only
  // visible after relay.
  if (reply.authorRole === 'program_coordinator') return reply;
  if (!reply.relayed) return null;
  return {
    ...reply,
    authorId: undefined,
    authorName: '',
    content: reply.relayedText || reply.content,
  };
}

/**
 * Return a serializable view of a single comment for the given viewer.
 *
 * Returns null when the comment must not be visible to this viewer at all
 * (today: a non-relayed comment for a PC viewer).
 */
export function serializeCommentForViewer(
  raw: RawComment,
  viewerRole: ViewerRole
): RawComment | null {
  const isPC = viewerRole === 'program_coordinator';
  if (!isPC) {
    // Reader / lead_reader / admin / superuser see the raw doc.
    return raw;
  }
  // PC tier — gate by relayed.
  if (!raw.relayed) return null;
  const redacted = stripReaderIdentity(raw);
  // Filter replies: drop unrelayed reader replies; sanitize what remains.
  const replies = (raw.replies || [])
    .map(stripReplyForPc)
    .filter((r): r is RawReply => r != null);
  return { ...redacted, replies } as RawComment;
}

export function serializeCommentsForViewer(
  raws: RawComment[],
  viewerRole: ViewerRole
): RawComment[] {
  const out: RawComment[] = [];
  for (const raw of raws) {
    const view = serializeCommentForViewer(raw, viewerRole);
    if (view) out.push(view);
  }
  return out;
}
