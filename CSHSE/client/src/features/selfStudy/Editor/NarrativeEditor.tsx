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
}: NarrativeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [supportingEvidenceCollapsed, setSupportingEvidenceCollapsed] = useState(true);
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
    isValidating,
    triggerValidation,
    feedback,
    suggestions,
    missingElements,
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
  const [showValidationModal, setShowValidationModal] = useState(false);

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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-teal-600 underline hover:text-teal-800',
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
      handlePaste: (view, event) => {
        // Let TipTap handle the paste by default
        // The extensions will handle formatting preservation
        return false;
      },
    },
  });

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
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-teal-600 underline hover:text-teal-800',
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
              {/* Validation status badge */}
              {validationStatus !== 'pending' && feedback && (
                <button
                  onClick={() => setShowValidationModal(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    validationStatus === 'pass'
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-red-100 text-red-700 hover:bg-red-200'
                  }`}
                  title="View validation details"
                >
                  {validationStatus === 'pass' ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" />
                  )}
                  {validationStatus === 'pass' ? 'Passed' : 'Failed'}
                  <Eye className="w-3.5 h-3.5 ml-0.5" />
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

      {/* Toolbar - Two rows for better organization (hidden in readOnly/reviewer mode) */}
      {!readOnly && <div className="editor-toolbar bg-gray-100 rounded-t-lg border border-gray-200 border-b-0">
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
        <div className="mt-4 border border-blue-200 rounded-lg overflow-hidden">
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
                <div className="border border-gray-200 rounded-lg overflow-hidden">
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
                    className="prose prose-sm max-w-none p-4 min-h-[150px] max-h-[400px] overflow-y-auto focus:outline-none [&_table]:border-collapse [&_table]:w-full [&_table]:my-4 [&_table]:max-w-full [&_.ProseMirror_table]:!table-auto [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-100 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:break-words [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:break-words [&_mark]:bg-yellow-200 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[150px] [&_.ProseMirror]:overflow-x-auto"
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

      {/* Validation Details Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`relative w-full max-w-lg mx-4 rounded-lg shadow-xl border ${
            validationStatus === 'pass' ? 'bg-teal-100 border-teal-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between p-4 border-b border-inherit">
              <div className="flex items-center gap-2">
                {validationStatus === 'pass' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <h3 className="font-semibold text-gray-900">
                  {validationStatus === 'pass' ? 'Validation Passed' : 'Validation Failed'}
                </h3>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {feedback && (
                <p className="text-sm text-gray-700">{feedback}</p>
              )}
              {suggestions.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-1">Suggestions:</h5>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
              {missingElements.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-red-700 mb-1">Missing Elements:</h5>
                  <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                    {missingElements.map((element, index) => (
                      <li key={index}>{element}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
