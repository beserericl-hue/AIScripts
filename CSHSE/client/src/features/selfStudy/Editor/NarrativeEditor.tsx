import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
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
} from 'lucide-react';
import { useAutoSave } from '../../../hooks/useAutoSave';
import { useValidationStatus } from '../../../hooks/useValidationStatus';

interface NarrativeEditorProps {
  submissionId: string;
  standardCode: string;
  specCode: string;
  initialContent: string;
  standardTitle: string;
  standardDescription: string;
  specTitle: string;
  standardText: string;
  placeholder?: string;
  onSave: (content: string) => Promise<void>;
  onContentChange?: (content: string) => void;
  onCancel?: () => void;
  readOnly?: boolean;
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
  standardTitle,
  standardDescription,
  specTitle,
  standardText,
  placeholder = 'Enter your narrative response here...',
  onSave,
  onContentChange,
  onCancel,
  readOnly = false,
}: NarrativeEditorProps) {
  const [content, setContent] = useState(initialContent);

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

  // Initialize TipTap editor
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
    ],
    content: initialContent,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(html);
      onContentChange?.(html);
      triggerAutoSave(html);
    },
  });

  // Handle manual save with validation
  const handleManualSave = useCallback(async () => {
    if (!editor) return;

    const currentContent = editor.getHTML();

    // Save the content
    await saveNow(currentContent);

    // Trigger validation
    await triggerValidation({
      narrativeText: currentContent,
      validationType: 'manual_save',
    });
  }, [editor, saveNow, triggerValidation]);

  // Update editor content if initial content changes externally
  useEffect(() => {
    if (editor && initialContent !== content && !hasUnsavedChanges) {
      editor.commands.setContent(initialContent);
      setContent(initialContent);
    }
  }, [editor, initialContent, content, hasUnsavedChanges]);

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
            <h5 className="text-sm font-semibold text-teal-800 mb-1">
              {standardCode}.{specCode} - {specTitle}
            </h5>
            <p className="text-sm text-teal-700">{standardText}</p>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar flex items-center gap-1 p-2 bg-gray-100 rounded-t-lg border border-gray-200 border-b-0">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

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

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        {/* Save Button & Status */}
        <div className="ml-auto flex items-center gap-2">
          {/* Save Status Indicator */}
          <SaveStatusIndicator
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            error={saveError}
          />

          {/* Cancel & Save Buttons */}
          {!readOnly && (
            <div className="flex items-center gap-2">
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
                onClick={handleManualSave}
                disabled={isSaving || isValidating}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving || isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save & Validate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bubble Menu for text selection */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
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
        </div>
      </BubbleMenu>

      {/* Editor Content */}
      <div className="editor-content flex-1 border border-gray-200 rounded-b-lg overflow-hidden">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none"
        />
      </div>

      {/* Validation Panel */}
      <ValidationPanel
        status={validationStatus}
        isValidating={isValidating}
        feedback={feedback}
        suggestions={suggestions}
        missingElements={missingElements}
      />
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

// Validation Panel Component
function ValidationPanel({
  status,
  isValidating,
  feedback,
  suggestions,
  missingElements,
}: {
  status: 'pass' | 'fail' | 'pending';
  isValidating: boolean;
  feedback: string | null;
  suggestions: string[];
  missingElements: string[];
}) {
  if (isValidating) {
    return (
      <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Validating content...</span>
        </div>
      </div>
    );
  }

  if (status === 'pending' && !feedback) {
    return null;
  }

  const statusColors = {
    pass: 'bg-green-50 border-green-200',
    fail: 'bg-red-50 border-red-200',
    pending: 'bg-gray-50 border-gray-200',
  };

  const statusIcons = {
    pass: <CheckCircle className="w-5 h-5 text-green-600" />,
    fail: <AlertCircle className="w-5 h-5 text-red-600" />,
    pending: null,
  };

  const statusText = {
    pass: 'Validation Passed',
    fail: 'Validation Failed',
    pending: 'Pending Validation',
  };

  return (
    <div className={`mt-4 p-4 border rounded-lg ${statusColors[status]}`}>
      <div className="flex items-center gap-2 mb-3">
        {statusIcons[status]}
        <h4 className="font-semibold">{statusText[status]}</h4>
      </div>

      {feedback && (
        <p className="text-sm text-gray-700 mb-3">{feedback}</p>
      )}

      {suggestions.length > 0 && (
        <div className="mb-3">
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
  );
}

export default NarrativeEditor;
