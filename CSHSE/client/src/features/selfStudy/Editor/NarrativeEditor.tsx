import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link as LinkIcon,
  Unlink,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Highlighter,
  Table as TableIcon,
  Strikethrough,
  ChevronDown,
  ChevronUp,
  FileText,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useValidationStatus } from '../../../hooks/useValidationStatus';

interface NarrativeEditorProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  initialContent: string;
  initialSupportingEvidence?: string;
  standardTitle: string;
  standardDescription: string;
  specTitle: string;
  standardText: string;
  placeholder?: string;
  onSave: (content: string) => Promise<void>;
  onSaveSupportingEvidence?: (content: string) => Promise<void>;
  onContentChange?: (content: string) => void;
  onCancel?: () => void;
  readOnly?: boolean;
  onSelectionChange?: (selection: { text: string; from: number; to: number } | null) => void;
  highlightedComment?: { id: string; selectedText: string } | null;
  // CR-059 — the editor calls this once its TipTap instance is ready, handing
  // back an imperative `insertHtml` so the Import-file panel can paste a
  // selected document section straight into this narrative. Insertion fires
  // onUpdate → autosave, so it persists like any other edit. `flush` forces any
  // pending debounced narrative + supporting-evidence save to the server NOW —
  // used before Final Submit locks the submission so a last edit isn't stranded.
  onEditorReady?: (api: { insertHtml: (html: string) => void; flush: () => Promise<void> }) => void;
}

/**
 * TipTap-based rich text editor for self-study narrative content
 * Features auto-save with 2s debounce, manual save with validation trigger
 */
export function NarrativeEditor({
  submissionId,
  standardCode,
  specCode,
  initialContent,
  initialSupportingEvidence = '',
  standardTitle,
  standardDescription,
  specTitle,
  standardText,
  placeholder = 'Enter your narrative response here...',
  onSave,
  onSaveSupportingEvidence,
  onContentChange,
  onCancel,
  readOnly = false,
  onSelectionChange,
  highlightedComment,
  onEditorReady,
}: NarrativeEditorProps) {
  const [content, setContent] = useState(initialContent);
  // Expanded by default when there's evidence to read (readers/PCs must see it
  // without hunting for a toggle); collapsed only when empty.
  const [supportingEvidenceCollapsed, setSupportingEvidenceCollapsed] = useState(!initialSupportingEvidence);
  const [contentChangedSinceValidation, setContentChangedSinceValidation] = useState(false);

  // Auto-save hook with 2s debounce
  const {
    triggerAutoSave,
    saveNow,
    isSaving,
    hasUnsavedChanges,
    lastSavedAt,
    error: saveError,
  } = useAutoSave({
    saveFn: onSave,
    debounceMs: 2000,
    enabled: !readOnly,
  });

  // Auto-save hook for supporting evidence
  const {
    triggerAutoSave: triggerSupportingEvidenceAutoSave,
    saveNow: saveSupportingEvidenceNow,
    isSaving: isSavingSupportingEvidence,
    hasUnsavedChanges: hasSupportingEvidenceUnsavedChanges,
    lastSavedAt: supportingEvidenceLastSavedAt,
    error: supportingEvidenceSaveError,
  } = useAutoSave({
    saveFn: onSaveSupportingEvidence || (async () => {}),
    debounceMs: 2000,
    enabled: !readOnly && !!onSaveSupportingEvidence,
  });

  // Validation status hook
  const {
    status: validationStatus,
    verdict,
    isValidating,
    triggerValidation,
    feedback,
    suggestions,
    missingElements,
    criteriaCoverage,
  } = useValidationStatus({
    submissionId,
    standardCode,
    specCode,
  });

  // State for link dialog
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // State for clear section confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  // AI report is shown in a popup that opens ONLY when the user clicks the
  // verdict pill. Default CLOSED so it never pops up on its own.
  const [aiReportOpen, setAiReportOpen] = useState(false);
  // 3-level verdict drives the pill + report. Fall back to the binary status
  // when an older record has no verdict. "needs_improvement" is its OWN state
  // (amber) — it must NOT read as "Failed".
  const effectiveVerdict: 'pass' | 'needs_improvement' | 'fail' | null =
    verdict ?? (validationStatus === 'pass' ? 'pass' : validationStatus === 'fail' ? 'fail' : null);
  const verdictUI = effectiveVerdict
    ? ({
        pass: { label: 'Passed', pill: 'bg-green-100 text-green-700', Icon: CheckCircle },
        needs_improvement: { label: 'Needs improvement', pill: 'bg-amber-100 text-amber-800', Icon: AlertCircle },
        fail: { label: 'Failed', pill: 'bg-red-100 text-red-700', Icon: AlertCircle },
      } as const)[effectiveVerdict]
    : null;
  const hasAiReport = !!verdictUI && (!!feedback || suggestions.length > 0 || missingElements.length > 0 || criteriaCoverage.length > 0);

  // Open hyperlinks from inside the (editable) narrative on click. The Link
  // extension keeps openOnClick:false so the edit surface never NAVIGATES AWAY
  // and loses unsaved work; instead we open the href in a NEW TAB. Works in
  // both edit and read-only mode. Returns true so the editor doesn't just drop
  // a caret with no feedback when the coordinator clicks a link.
  const openLinkOnClick = useCallback(
    (_view: unknown, _pos: number, event: MouseEvent): boolean => {
      const el = event.target as HTMLElement | null;
      const anchor = el?.closest?.('a[href]') as HTMLAnchorElement | null;
      const href = anchor?.getAttribute('href');
      if (href) {
        window.open(href, '_blank', 'noopener,noreferrer');
        return true;
      }
      return false;
    },
    []
  );

  // Initialize TipTap editor with Word paste support
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      // Text alignment for Word paste support
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      // Text styling for colors
      TextStyle,
      Color,
      // Highlight/background color
      Highlight.configure({
        multicolor: true,
      }),
      // Links
      // CR-015 — explicit hyperlink preservation across all paste/type
      // paths: <a href> from Word/Docs HTML, bare URLs in plain-text
      // paste, and URLs typed inline. defendOnNavigate stops the editor
      // from following the link inside the edit surface.
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: {
          class: 'text-teal-600 underline hover:text-teal-800',
          target: '_blank',
          rel: 'noopener noreferrer'
        },
      }),
      // Subscript and superscript
      Subscript,
      Superscript,
      // Tables for Word paste support
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-100 px-3 py-2 font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-3 py-2',
        },
      }),
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(html);
      onContentChange?.(html);
      triggerAutoSave(html);
      setContentChangedSinceValidation(true);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        onSelectionChange?.(null);
      } else {
        const text = editor.state.doc.textBetween(from, to, ' ');
        onSelectionChange?.({ text, from, to });
      }
    },
    // Handle paste from Word/external sources
    editorProps: {
      handleClick: openLinkOnClick,
      handlePaste: (view, event) => {
        // Let TipTap handle the paste by default
        // The extensions will handle formatting preservation
        return false;
      },
    },
  });

  // CR-059 — hand an imperative HTML insert back to the parent (the Import-file
  // panel pastes a selected section here). We insert AND persist immediately
  // (onSave) rather than leaning on the 2s debounced autosave: an editor remount
  // (key bump) could otherwise cancel the pending save and silently drop the
  // paste. The immediate save mirrors the Introduction editor's behavior.
  useEffect(() => {
    if (!editor || !onEditorReady) return;
    onEditorReady({
      insertHtml: (html: string) => {
        editor.chain().focus().insertContent(html).run();
        const next = editor.getHTML();
        setContent(next);
        void onSave(next);
      },
      // Force-persist any pending narrative + supporting-evidence edit NOW,
      // bypassing the 2s debounce. Called right before Final Submit locks the
      // submission (a post-lock save would 403). supportingEvidenceEditor is
      // referenced via the closure (created once), kept out of the deps array
      // because it is declared below this effect.
      flush: async () => {
        if (readOnly) return;
        try { await saveNow(editor.getHTML()); } catch { /* best-effort */ }
        try {
          if (supportingEvidenceEditor) {
            await saveSupportingEvidenceNow(supportingEvidenceEditor.getHTML());
          }
        } catch { /* best-effort */ }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, onEditorReady, onSave, saveNow, saveSupportingEvidenceNow, readOnly]);

  // Initialize TipTap editor for supporting evidence
  const supportingEvidenceEditor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Enter supporting evidence text here...',
        emptyEditorClass: 'is-editor-empty',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      // CR-015 — explicit hyperlink preservation across all paste/type
      // paths: <a href> from Word/Docs HTML, bare URLs in plain-text
      // paste, and URLs typed inline. defendOnNavigate stops the editor
      // from following the link inside the edit surface.
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
        HTMLAttributes: {
          class: 'text-teal-600 underline hover:text-teal-800',
          target: '_blank',
          rel: 'noopener noreferrer'
        },
      }),
      Subscript,
      Superscript,
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 bg-gray-100 px-3 py-2 font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 px-3 py-2',
        },
      }),
    ],
    content: initialSupportingEvidence,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      triggerSupportingEvidenceAutoSave(html);
      setContentChangedSinceValidation(true);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        onSelectionChange?.(null);
      } else {
        const text = editor.state.doc.textBetween(from, to, ' ');
        onSelectionChange?.({ text, from, to });
      }
    },
    editorProps: {
      handleClick: openLinkOnClick,
    },
  });

  // Handle adding a link
  const handleAddLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    setLinkUrl(previousUrl || '');
    setShowLinkDialog(true);
  }, [editor]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setShowLinkDialog(false);
    setLinkUrl('');
  }, [editor, linkUrl]);

  const handleRemoveLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  // Handle clear section content
  const handleClearSection = useCallback(async () => {
    if (!editor) return;
    // Clear all content
    editor.commands.clearContent();
    // Save the empty content
    await saveNow('');
    setShowClearConfirm(false);
  }, [editor, saveNow]);

  // Handle save only (no validation workflow)
  const handleSaveOnly = useCallback(async () => {
    if (!editor) return;

    const currentContent = editor.getHTML();
    await saveNow(currentContent);
  }, [editor, saveNow]);

  // Handle save and validate (triggers validation workflow)
  const handleSaveAndValidate = useCallback(async () => {
    if (!editor) return;

    const currentContent = editor.getHTML();

    // Save the content first
    await saveNow(currentContent);

    // Get supporting evidence text from the evidence editor
    const currentEvidenceText = supportingEvidenceEditor?.getHTML() || '';

    // Then trigger validation workflow with narrative + evidence text
    await triggerValidation({
      narrativeText: currentContent,
      validationType: 'manual_save',
      evidenceText: currentEvidenceText,
    });
    setContentChangedSinceValidation(false);
  }, [editor, supportingEvidenceEditor, saveNow, triggerValidation]);

  // Update editor content if initial content changes externally
  useEffect(() => {
    if (editor && initialContent !== content && !hasUnsavedChanges) {
      editor.commands.setContent(initialContent);
      setContent(initialContent);
    }
  }, [editor, initialContent, content, hasUnsavedChanges]);

  // Update supporting evidence editor content if initial content changes externally
  useEffect(() => {
    if (supportingEvidenceEditor && !hasSupportingEvidenceUnsavedChanges) {
      const currentHtml = supportingEvidenceEditor.getHTML();
      if (initialSupportingEvidence !== currentHtml) {
        supportingEvidenceEditor.commands.setContent(initialSupportingEvidence);
      }
    }
  }, [supportingEvidenceEditor, initialSupportingEvidence, hasSupportingEvidenceUnsavedChanges]);

  // Utility: find text in a DOM container, highlight it, and return a cleanup function
  const findAndHighlightText = useCallback((container: Element, searchText: string): (() => void) | null => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Text | null;

    while ((node = walker.nextNode() as Text)) {
      const idx = node.textContent?.indexOf(searchText) ?? -1;
      if (idx === -1) continue;

      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + searchText.length);

        const mark = document.createElement('mark');
        mark.className = 'comment-highlight-pulse';
        mark.style.cssText = 'background: #fbbf24; border-radius: 2px; padding: 1px 0; transition: background 1s ease-out;';
        range.surroundContents(mark);
        mark.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Fade out effect before removal
        setTimeout(() => {
          mark.style.background = 'transparent';
        }, 2500);

        return () => {
          const parent = mark.parentNode;
          if (parent) {
            parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
            parent.normalize();
          }
        };
      } catch {
        // range.surroundContents can fail if text spans multiple elements — skip
        continue;
      }
    }
    return null;
  }, []);

  // Highlight comment source text when clicked from sidebar
  useEffect(() => {
    if (!highlightedComment?.selectedText) return;

    const searchText = highlightedComment.selectedText;
    let cleanupFn: (() => void) | null = null;

    const doHighlight = () => {
      // Search narrative editor first, then supporting evidence
      const narrativeContainer = document.querySelector('.narrative-editor .editor-content .ProseMirror');
      if (narrativeContainer) {
        cleanupFn = findAndHighlightText(narrativeContainer, searchText);
        if (cleanupFn) return;
      }

      // Not in narrative — check supporting evidence (expand if collapsed)
      const evidenceContainer = document.querySelector('.narrative-editor .supporting-evidence-editor .ProseMirror');
      if (evidenceContainer) {
        cleanupFn = findAndHighlightText(evidenceContainer, searchText);
        if (cleanupFn) return;
      }

      // Supporting evidence might be collapsed — expand and retry
      if (!evidenceContainer && supportingEvidenceCollapsed) {
        setSupportingEvidenceCollapsed(false);
        requestAnimationFrame(() => {
          const expanded = document.querySelector('.narrative-editor .supporting-evidence-editor .ProseMirror');
          if (expanded) {
            cleanupFn = findAndHighlightText(expanded, searchText);
          }
        });
      }
    };

    // Small delay to ensure editor DOM is ready after navigation
    const timer = setTimeout(doHighlight, 150);

    // Cleanup highlight after 3 seconds
    const cleanupTimer = setTimeout(() => {
      cleanupFn?.();
    }, 3500);

    return () => {
      clearTimeout(timer);
      clearTimeout(cleanupTimer);
      cleanupFn?.();
    };
  }, [highlightedComment, supportingEvidenceCollapsed]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="narrative-editor flex flex-col h-full">
      {/* Standard and Specification Guidance */}
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-4 space-y-3">
        {/* Standard Header */}
        <div>
          <h4 className="text-sm font-bold text-teal-900 mb-1">
            Standard {standardCode}: {standardTitle}
          </h4>
          <p className="text-sm text-teal-800">{standardDescription}</p>
        </div>

        {/* Specification */}
        {specCode && (
          <div className="pt-3 border-t border-teal-200">
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-semibold text-teal-800 mb-1">
                {standardCode}.{specCode} - {specTitle}
              </h5>
              {/* Single AI verdict pill (3-level). Click to show/hide the one
                  inline AI report below — no separate bottom panel or modal. */}
              {verdictUI && (
                <button
                  onClick={() => setAiReportOpen((o) => !o)}
                  data-testid="ai-verdict-pill"
                  data-verdict={effectiveVerdict ?? ''}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors hover:brightness-95 ${verdictUI.pill}`}
                  title={aiReportOpen ? 'Hide AI review' : 'Show AI review'}
                >
                  <verdictUI.Icon className="w-3.5 h-3.5" />
                  {verdictUI.label}
                  {hasAiReport && (aiReportOpen ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />)}
                </button>
              )}
              {isValidating && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Validating...
                </span>
              )}
            </div>
            <p className="text-sm text-teal-700">{standardText}</p>

          </div>
        )}
      </div>

      {/* AI Review opens in a POPUP so it never crowds the editor — the verdict
          pill toggles it. Fully scrollable; click the backdrop or ✕ to close. */}
      {hasAiReport && aiReportOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAiReportOpen(false)}
        >
          <div
            data-testid="ai-report"
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                {verdictUI && <verdictUI.Icon className={`w-5 h-5 ${effectiveVerdict === 'pass' ? 'text-green-600' : effectiveVerdict === 'needs_improvement' ? 'text-amber-600' : 'text-red-600'}`} />}
                <h5 className="text-base font-semibold text-gray-900">AI Review — {verdictUI?.label}</h5>
              </div>
              <button
                onClick={() => setAiReportOpen(false)}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
                title="Close AI review"
                aria-label="Close AI review"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {feedback && <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedback}</p>}
              {suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Suggestions to improve</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {missingElements.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-600 mb-1">Missing elements</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                    {missingElements.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
              {criteriaCoverage.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {criteriaCoverage.map((c: { criterion: string; met: boolean; note?: string }, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      {c.met ? <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                      <span>{c.criterion}{c.note ? <span className="text-gray-500"> — {c.note}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toolbar - Two rows for better organization (hidden in readOnly/reviewer mode) */}
      {!readOnly && <div data-tour="ss-toolbar" className="editor-toolbar bg-gray-100 rounded-t-lg border border-gray-200 border-b-0">
        {/* Primary toolbar row */}
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200">
          {/* Text formatting */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive('strike')}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Subscript/Superscript */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            isActive={editor.isActive('subscript')}
            title="Subscript"
          >
            <SubscriptIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            isActive={editor.isActive('superscript')}
            title="Superscript"
          >
            <SuperscriptIcon className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Highlight */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
            isActive={editor.isActive('highlight')}
            title="Highlight"
          >
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Headings */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive('heading', { level: 1 })}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Lists */}
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Text alignment */}
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            isActive={editor.isActive({ textAlign: 'left' })}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            isActive={editor.isActive({ textAlign: 'center' })}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            isActive={editor.isActive({ textAlign: 'right' })}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            isActive={editor.isActive({ textAlign: 'justify' })}
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Links */}
          <ToolbarButton
            onClick={handleAddLink}
            isActive={editor.isActive('link')}
            title="Add Link"
          >
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          {editor.isActive('link') && (
            <ToolbarButton
              onClick={handleRemoveLink}
              title="Remove Link"
            >
              <Unlink className="w-4 h-4" />
            </ToolbarButton>
          )}

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Table */}
          <ToolbarButton
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            title="Insert Table"
          >
            <TableIcon className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-6 bg-gray-300 mx-1" />

          {/* Undo/Redo */}
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* Secondary toolbar row - Table controls (when table selected) and Status/Actions */}
        <div className="flex items-center gap-2 px-2 py-1.5">
          {/* Table controls - only show when inside a table */}
          {editor.isActive('table') && (
            <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
              <span className="text-xs text-gray-500 mr-1">Table:</span>
              <button
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                title="Add column before"
              >
                + Col
              </button>
              <button
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                title="Add row after"
              >
                + Row
              </button>
              <button
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-red-600"
                title="Delete column"
              >
                - Col
              </button>
              <button
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-red-600"
                title="Delete row"
              >
                - Row
              </button>
              <button
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="px-2 py-1 text-xs bg-red-50 border border-red-300 rounded hover:bg-red-100 text-red-600"
                title="Delete table"
              >
                Delete
              </button>
            </div>
          )}

          {/* Save Button & Status */}
          <div className="ml-auto flex items-center gap-2">
          {/* Save Status Indicator */}
          <SaveStatusIndicator
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            error={saveError}
          />

          {/* Clear, Cancel, Save & Validate Buttons */}
          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                data-tour="ss-clear"
                onClick={() => setShowClearConfirm(true)}
                disabled={isSaving || isValidating}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 bg-red-50 text-red-600 text-sm rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Clear all content from this section"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
              {onCancel && (
                <button
                  onClick={onCancel}
                  disabled={isSaving || isValidating}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                data-tour="ss-save"
                onClick={handleSaveOnly}
                disabled={isSaving || isValidating}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 bg-white text-gray-700 text-sm rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving && !isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
              <button
                data-tour="ss-validate"
                onClick={handleSaveAndValidate}
                disabled={isSaving || isValidating || (validationStatus === 'pass' && !contentChangedSinceValidation)}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : validationStatus === 'pass' && !contentChangedSinceValidation ? (
                  <CheckCircle className="w-4 h-4 text-green-200" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {isValidating ? 'Validating...' : validationStatus === 'pass' && !contentChangedSinceValidation ? 'Validated' : 'Validate'}
              </button>
            </div>
          )}
        </div>
        </div>
      </div>}

      {/* Link Dialog Modal */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Insert Link</h3>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSetLink();
                if (e.key === 'Escape') setShowLinkDialog(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowLinkDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSetLink}
                className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700"
              >
                {linkUrl ? 'Update Link' : 'Remove Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Section Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear Section Content</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to clear all content from this section? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleClearSection}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Clear Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bubble Menu for text selection (hidden in readOnly/reviewer mode) */}
      {!readOnly && <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
        <div className="flex items-center gap-1 p-1 bg-gray-900 rounded-lg shadow-lg">
          <BubbleButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
          >
            <Bold className="w-4 h-4" />
          </BubbleButton>
          <BubbleButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
          >
            <Italic className="w-4 h-4" />
          </BubbleButton>
          <BubbleButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
          >
            <UnderlineIcon className="w-4 h-4" />
          </BubbleButton>
          <div className="w-px h-4 bg-gray-600 mx-1" />
          <BubbleButton
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
            isActive={editor.isActive('highlight')}
          >
            <Highlighter className="w-4 h-4" />
          </BubbleButton>
          <BubbleButton
            onClick={handleAddLink}
            isActive={editor.isActive('link')}
          >
            <LinkIcon className="w-4 h-4" />
          </BubbleButton>
        </div>
      </BubbleMenu>}

      {/* Editor Content */}
      <div className={`editor-content flex-1 border border-gray-200 overflow-auto max-w-full ${readOnly ? 'rounded-lg' : 'rounded-b-lg'}`}>
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_table]:max-w-full [&_.ProseMirror_table]:!table-auto [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:break-words [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:break-words [&_mark]:bg-yellow-200 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:overflow-x-auto"
        />
      </div>

      {/* Supporting Evidence Section - visible to all roles when content exists or when editable */}
      {(onSaveSupportingEvidence || initialSupportingEvidence) && (
        <div data-tour="ss-evidence-text" className="mt-4 border border-blue-200 rounded-lg overflow-hidden">
          {/* Header - Collapsible */}
          <button
            onClick={() => setSupportingEvidenceCollapsed(!supportingEvidenceCollapsed)}
            className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-blue-900">Supporting Evidence Text</span>
              {initialSupportingEvidence && (
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  Has content
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Save status for supporting evidence (hidden in readOnly) */}
              {!readOnly && (
                <SaveStatusIndicator
                  isSaving={isSavingSupportingEvidence}
                  hasUnsavedChanges={hasSupportingEvidenceUnsavedChanges}
                  lastSavedAt={supportingEvidenceLastSavedAt}
                  error={supportingEvidenceSaveError}
                />
              )}
              {supportingEvidenceCollapsed ? (
                <ChevronDown className="w-5 h-5 text-blue-600" />
              ) : (
                <ChevronUp className="w-5 h-5 text-blue-600" />
              )}
            </div>
          </button>

          {/* Editor Content - Collapsible */}
          {!supportingEvidenceCollapsed && (
            <div className="p-4 bg-white">
              <p className="text-sm text-gray-600 mb-3">
                {readOnly
                  ? 'Additional supporting evidence provided by the program. Select text to add comments.'
                  : 'This section contains additional supporting evidence imported from your document. You can edit this content or use it as reference for your narrative.'}
              </p>
              {supportingEvidenceEditor ? (
                <div className="supporting-evidence-editor border border-gray-200 rounded-lg overflow-hidden">
                  {/* Compact Toolbar */}
                  {!readOnly && (
                    <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
                      {/* Basic formatting */}
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().toggleBold().run()}
                        isActive={supportingEvidenceEditor.isActive('bold')}
                        title="Bold (Ctrl+B)"
                      >
                        <Bold className="w-3.5 h-3.5" />
                      </ToolbarButton>
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().toggleItalic().run()}
                        isActive={supportingEvidenceEditor.isActive('italic')}
                        title="Italic (Ctrl+I)"
                      >
                        <Italic className="w-3.5 h-3.5" />
                      </ToolbarButton>
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().toggleUnderline().run()}
                        isActive={supportingEvidenceEditor.isActive('underline')}
                        title="Underline (Ctrl+U)"
                      >
                        <UnderlineIcon className="w-3.5 h-3.5" />
                      </ToolbarButton>
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().toggleStrike().run()}
                        isActive={supportingEvidenceEditor.isActive('strike')}
                        title="Strikethrough"
                      >
                        <Strikethrough className="w-3.5 h-3.5" />
                      </ToolbarButton>

                      <div className="w-px h-5 bg-gray-300 mx-0.5" />

                      {/* Lists */}
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().toggleBulletList().run()}
                        isActive={supportingEvidenceEditor.isActive('bulletList')}
                        title="Bullet List"
                      >
                        <List className="w-3.5 h-3.5" />
                      </ToolbarButton>
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().toggleOrderedList().run()}
                        isActive={supportingEvidenceEditor.isActive('orderedList')}
                        title="Numbered List"
                      >
                        <ListOrdered className="w-3.5 h-3.5" />
                      </ToolbarButton>

                      <div className="w-px h-5 bg-gray-300 mx-0.5" />

                      {/* Undo/Redo */}
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().undo().run()}
                        disabled={!supportingEvidenceEditor.can().undo()}
                        title="Undo (Ctrl+Z)"
                      >
                        <Undo className="w-3.5 h-3.5" />
                      </ToolbarButton>
                      <ToolbarButton
                        onClick={() => supportingEvidenceEditor.chain().focus().redo().run()}
                        disabled={!supportingEvidenceEditor.can().redo()}
                        title="Redo (Ctrl+Y)"
                      >
                        <Redo className="w-3.5 h-3.5" />
                      </ToolbarButton>

                      {/* Table controls - only when cursor is inside a table */}
                      {supportingEvidenceEditor.isActive('table') && (
                        <>
                          <div className="w-px h-5 bg-gray-300 mx-0.5" />
                          <span className="text-xs text-gray-500 mx-1">Table:</span>
                          <button
                            onClick={() => supportingEvidenceEditor.chain().focus().addColumnBefore().run()}
                            className="px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                            title="Add column before"
                          >
                            + Col
                          </button>
                          <button
                            onClick={() => supportingEvidenceEditor.chain().focus().addRowAfter().run()}
                            className="px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50"
                            title="Add row after"
                          >
                            + Row
                          </button>
                          <button
                            onClick={() => supportingEvidenceEditor.chain().focus().deleteColumn().run()}
                            className="px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-red-600"
                            title="Delete column"
                          >
                            - Col
                          </button>
                          <button
                            onClick={() => supportingEvidenceEditor.chain().focus().deleteRow().run()}
                            className="px-1.5 py-0.5 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 text-red-600"
                            title="Delete row"
                          >
                            - Row
                          </button>
                          <button
                            onClick={() => supportingEvidenceEditor.chain().focus().deleteTable().run()}
                            className="px-1.5 py-0.5 text-xs bg-red-50 border border-red-300 rounded hover:bg-red-100 text-red-600"
                            title="Delete table"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  <EditorContent
                    editor={supportingEvidenceEditor}
                    className="prose prose-sm max-w-none p-4 min-h-[150px] max-h-[70vh] overflow-y-auto focus:outline-none [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_table]:max-w-full [&_.ProseMirror_table]:!table-auto [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:break-words [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:break-words [&_mark]:bg-yellow-200 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:overflow-x-auto"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 bg-gray-50 rounded-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* (The old binary "Validation Details" modal was removed — the single AI
          report now renders inline + collapsible under the spec header above.) */}
    </div>
  );
}

// Toolbar Button Component
interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
        isActive ? 'bg-gray-300 text-teal-700' : 'text-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

// Bubble Menu Button
function BubbleButton({
  onClick,
  isActive,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded text-white hover:bg-gray-700 transition-colors ${
        isActive ? 'bg-teal-600' : ''
      }`}
    >
      {children}
    </button>
  );
}

// Save Status Indicator
function SaveStatusIndicator({
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  error,
}: {
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  error: Error | null;
}) {
  if (error) {
    return (
      <span className="flex items-center gap-1 text-sm text-red-600">
        <AlertCircle className="w-4 h-4" />
        Save failed
      </span>
    );
  }

  if (isSaving) {
    return (
      <span className="flex items-center gap-1 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Saving...
      </span>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <span className="flex items-center gap-1 text-sm text-amber-600">
        <div className="w-2 h-2 bg-amber-500 rounded-full" />
        Unsaved changes
      </span>
    );
  }

  if (lastSavedAt) {
    return (
      <span className="flex items-center gap-1 text-sm text-green-600">
        <CheckCircle className="w-4 h-4" />
        Saved
      </span>
    );
  }

  return null;
}


export default NarrativeEditor;
