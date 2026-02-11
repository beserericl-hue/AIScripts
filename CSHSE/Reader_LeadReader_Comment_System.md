# Reader / Lead Reader Comment System

## Overview

The comment system allows **Readers** and **Lead Readers** to annotate specific text passages within the self-study narrative editor. Comments are anchored to highlighted text selections, visible in a dedicated sidebar, and support threaded replies, resolution tracking, and cross-section navigation.

## Roles and Permissions

| Capability | Reader | Lead Reader | Program Coordinator | Admin |
|---|---|---|---|---|
| Select text & create comments | Yes | Yes | No | No |
| Reply to comments | Yes | Yes | Yes | No |
| Resolve / unresolve comments | Yes | Yes | No | No |
| Delete own comments | Yes | Yes | No | No |
| Delete any comment | No | Yes | No | No |
| Delete own replies | Yes | Yes | Yes | No |
| View comments | Yes | Yes | Yes | Yes |
| Score specifications (0-3) | Yes | Yes | No | No |

## Architecture

### Data Model — `Comment` (MongoDB)

```
server/src/models/Comment.ts
```

| Field | Type | Description |
|---|---|---|
| `submissionId` | ObjectId | Links to the Submission being reviewed |
| `standardCode` | String | Standard code (e.g., "1", "11") |
| `specCode` | String | Specification code (e.g., "1A", "11B") |
| `selectedText` | String | The exact text passage the comment annotates |
| `selectionStart` | Number | TipTap document offset (from) |
| `selectionEnd` | Number | TipTap document offset (to) |
| `authorId` | String | User ID of the comment author |
| `authorName` | String | Display name (first + last or email fallback) |
| `authorRole` | Enum | `reader` or `lead_reader` |
| `content` | String | The comment body text |
| `replies` | Array | Nested reply subdocuments (see below) |
| `isResolved` | Boolean | Whether the comment has been marked resolved |
| `createdAt` | Date | Auto-generated timestamp |

**Reply subdocument:**

| Field | Type |
|---|---|
| `authorId` | String |
| `authorName` | String |
| `authorRole` | Enum (`reader`, `lead_reader`, `program_coordinator`) |
| `content` | String |
| `createdAt` | Date |

### Server API Endpoints

All routes require authentication via `authenticate` middleware.

```
server/src/routes/comments.ts
server/src/controllers/commentController.ts
```

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/submissions/:submissionId/comments` | Create a new comment |
| `GET` | `/api/submissions/:submissionId/comments` | List comments (filter by `standardCode`, `specCode`) |
| `GET` | `/api/submissions/:submissionId/comments/summary` | Get comment counts grouped by section |
| `POST` | `/api/comments/:commentId/resolve` | Toggle resolved status |
| `DELETE` | `/api/comments/:commentId` | Delete a comment |
| `POST` | `/api/comments/:commentId/replies` | Add a reply |
| `DELETE` | `/api/comments/:commentId/replies/:replyId` | Delete a reply |

**Create comment request body:**
```json
{
  "standardCode": "1",
  "specCode": "1A",
  "selectedText": "The program maintains...",
  "selectionStart": 142,
  "selectionEnd": 178,
  "content": "This needs more specific data."
}
```

The server auto-populates `authorId`, `authorName`, and `authorRole` from the authenticated user's JWT token.

**Summary response:**
```json
{
  "total": 12,
  "unresolved": 8,
  "bySection": [
    { "standardCode": "1", "specCode": "1A", "count": 3 },
    { "standardCode": "3", "specCode": "3B", "count": 5 }
  ]
}
```

## Client-Side Implementation

### Files Modified

1. **`client/src/features/selfStudy/Editor/NarrativeEditor.tsx`** — TipTap editor selection tracking
2. **`client/src/features/comments/CommentSidebar.tsx`** — Always-visible sidebar with navigation
3. **`client/src/features/selfStudy/Editor/SelfStudyEditor.tsx`** — Orchestration, modal, button, navigation

### 1. NarrativeEditor.tsx — Selection Tracking

**New prop added to the interface:**
```typescript
onSelectionChange?: (selection: { text: string; from: number; to: number } | null) => void;
```

**`onSelectionUpdate` callback in `useEditor()` config:**
```typescript
onSelectionUpdate: ({ editor }) => {
  const { from, to } = editor.state.selection;
  if (from === to) {
    onSelectionChange?.(null);       // Collapsed cursor — no selection
  } else {
    const text = editor.state.doc.textBetween(from, to, ' ');
    onSelectionChange?.({ text, from, to });
  }
},
```

This fires on every selection change, including in `readOnly` mode (which reviewers use).

**BubbleMenu guard:**
The TipTap `<BubbleMenu>` (formatting toolbar) is now wrapped with `{!readOnly && ...}` to prevent it from appearing for reviewers who only have read access.

### 2. CommentSidebar.tsx — Always-Visible Sidebar

**Key changes:**

- Removed the `if (comments.length === 0) return null` early exit that previously hid the sidebar when no comments existed.
- Added an empty state with guidance text: *"No comments on this section yet. Select text in the editor and click 'Add Comment' to get started."*
- Added navigation props:

```typescript
onNavigatePrev?: () => void;
onNavigateNext?: () => void;
hasPrevComment?: boolean;
hasNextComment?: boolean;
```

- Added `ChevronLeft` / `ChevronRight` buttons in the header to navigate between sections that have comments.

**Sidebar features (already existed):**
- Comment list with author name, role badge, and timestamp
- Yellow highlighted text preview (clickable to navigate to the annotated passage)
- Resolve/unresolve toggle (green checkmark)
- Delete button (trash icon)
- Collapsible reply threads
- Inline reply input with textarea

### 3. SelfStudyEditor.tsx — Orchestration

**New state variables:**
```typescript
const [editorSelection, setEditorSelection] = useState<{ text: string; from: number; to: number } | null>(null);
const [showCommentModal, setShowCommentModal] = useState(false);
const [newCommentContent, setNewCommentContent] = useState('');
```

**Global comment summary query** (for Prev/Next navigation):
```typescript
const { data: globalCommentSummary } = useQuery({
  queryKey: ['comments-summary', submissionId],
  queryFn: () => api.get(`/api/submissions/${submissionId}/comments/summary`).then(r => r.data),
  enabled: isReviewer,
});
```

**Navigation logic:**
- `commentSections`: filtered list of sections from `bySection` that have comments
- `currentCommentSectionIdx`: index of the current standard+spec in that list
- `hasPrevComment` / `hasNextComment`: booleans for disabling nav buttons
- `navigateToCommentSection('prev' | 'next')`: changes `selectedStandard` and `selectedSpec` to jump to the previous/next section with comments

**Create comment mutation:**
```typescript
const createCommentMutation = useMutation({
  mutationFn: (data) => api.post(`/api/submissions/${submissionId}/comments`, {
    standardCode: selectedStandard,
    specCode: selectedSpec,
    ...data,
  }),
  onSuccess: () => {
    // Invalidates comment list, section summary, and global summary queries
    setShowCommentModal(false);
    setNewCommentContent('');
    setEditorSelection(null);
  },
});
```

**"Add Comment" button** (in the reviewer header bar):
- Enabled only when `editorSelection` is non-null (text is selected)
- Disabled state: gray background, `cursor-not-allowed`
- Active state: teal background, white text
- Opens the comment creation modal on click

**Comment creation modal:**
- Fixed-position overlay with backdrop (`bg-black/50`)
- Shows the selected text in a yellow preview box (`line-clamp-4`)
- Textarea for the comment body (4 rows, auto-focus)
- Cancel button dismisses and resets state
- "Add Comment" button submits the mutation (shows spinner while pending)
- Submits: `{ selectedText, selectionStart, selectionEnd, content }`

**Props passed to child components:**
```typescript
// To NarrativeEditor
onSelectionChange={isReviewer ? setEditorSelection : undefined}

// To CommentSidebar
onNavigatePrev={() => navigateToCommentSection('prev')}
onNavigateNext={() => navigateToCommentSection('next')}
hasPrevComment={hasPrevComment}
hasNextComment={hasNextComment}
```

## User Workflow

1. **Reviewer opens a submission** — the editor loads in read-only mode with the comment sidebar visible on the right.
2. **Reviewer highlights text** in the narrative editor — the "Comment" button in the header bar becomes active (teal).
3. **Reviewer clicks "Comment"** — a modal opens showing the selected text preview and a text input.
4. **Reviewer types their comment and clicks "Add Comment"** — the comment is saved to the database with the selected text anchored to the document offsets.
5. **Comment appears in the sidebar** — showing the author's real name, role badge, timestamp, and the highlighted text snippet.
6. **Other reviewers or the program coordinator can reply** — replies appear indented under the parent comment.
7. **Reviewers can resolve comments** — resolved comments show a green border and checkmark.
8. **Prev/Next navigation** — buttons in the sidebar header navigate to other sections (standards/specs) that have comments.

## Score System (0-3)

Alongside comments, reviewers can assign a score (0, 1, 2, or 3) to each specification:

| Score | Meaning |
|---|---|
| 0 | Non-compliant |
| 1 | Partially compliant |
| 2 | Largely compliant |
| 3 | Fully compliant |

**Score controls** appear in the reviewer header bar as clickable number buttons. The `-` button clears the score. Scores are stored per-reviewer per-spec and can be averaged across reviewers via the summary endpoint.

### Score API

```
server/src/controllers/scoreController.ts
server/src/models/Score.ts
server/src/routes/scores.ts
```

| Method | Route | Description |
|---|---|---|
| `PUT` | `/api/submissions/:submissionId/scores` | Upsert a score |
| `DELETE` | `/api/submissions/:submissionId/scores` | Clear a score |
| `GET` | `/api/submissions/:submissionId/scores` | Get scores (own for reader, all for lead_reader) |
| `GET` | `/api/submissions/:submissionId/scores/summary` | Get averaged scores by spec, standard, global |

## Technical Notes

- **TipTap readOnly mode**: The editor is set to `readOnly` for all non-program-coordinator roles. The `onSelectionUpdate` callback still fires in readOnly mode, enabling text selection for comments without allowing edits.
- **BubbleMenu suppression**: The formatting toolbar (`<BubbleMenu>`) is conditionally rendered only when `!readOnly`, preventing reviewers from seeing editing controls.
- **Query invalidation**: On comment creation, three query keys are invalidated: the comment list for the current section, the section-level summary, and the global summary (for nav button state).
- **Comment anchoring**: Comments store both the selected text string and the TipTap document offsets (`from`/`to`). The text is displayed in the sidebar; offsets can be used for future scroll-to-highlight functionality.
- **Role detection**: `isReviewer = userRole === 'reader' || userRole === 'lead_reader'` — this gates the entire comment/score UI.
