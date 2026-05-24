/**
 * IntroductionEditor — CR-039 Phase 2c part 2.
 *
 * Renders the document-level OR a standard-level Introduction body
 * as an editable TipTap surface. Lighter chrome than NarrativeEditor
 * (no per-spec metadata, no supporting-evidence pane) — this is just
 * narrative prose with the same StarterKit so paste-formatting,
 * lists, and basic typography all work.
 *
 * Auto-saves on blur via PATCH /api/submissions/:id/introduction.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { Save, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { api } from '../../../services/api';

export interface IntroductionEditorProps {
  submissionId: string;
  scope: 'document' | 'standard';
  standardCode?: string;
  initialContent: string;
  readOnly?: boolean;
}

export function IntroductionEditor({
  submissionId,
  scope,
  standardCode,
  initialContent,
  readOnly = false
}: IntroductionEditorProps): JSX.Element {
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const placeholder =
    scope === 'document'
      ? 'Document Introduction — overview of the institution, mission, glossary, or other context that spans every standard.'
      : `Standard ${standardCode} Introduction — context, terminology, departmental structure, or background for this standard.`;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder })
    ],
    content: initialContent || '',
    editable: !readOnly
  });

  // Re-sync when initialContent changes (e.g. after a refetch or when
  // the user switches between standards).
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === initialContent) return;
    editor.commands.setContent(initialContent || '', false);
  }, [editor, initialContent]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    const content = editor.getHTML();
    setSaveState('saving');
    setErrorMsg(null);
    try {
      await api.patch(`/api/submissions/${submissionId}/introduction`, {
        scope,
        standardCode: scope === 'standard' ? standardCode : undefined,
        content
      });
      setSaveState('saved');
      // Brief "Saved" then back to idle so the badge doesn't loiter.
      setTimeout(() => setSaveState('idle'), 1500);
    } catch (err: any) {
      setSaveState('error');
      setErrorMsg(err?.response?.data?.error || err?.message || 'Save failed');
    }
  }, [editor, submissionId, scope, standardCode]);

  if (!editor) return <div className="p-4 text-sm text-gray-500">Loading…</div>;

  return (
    <section className="rounded-lg border border-cshse-200 bg-cshse-50/50 p-4">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-cshse-800">
          <BookOpen className="h-4 w-4" aria-hidden />
          {scope === 'document'
            ? 'Document Introduction'
            : `Standard ${standardCode} — Introduction`}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            {saveState === 'saving' && (
              <span className="text-xs text-gray-500">Saving…</span>
            )}
            {saveState === 'saved' && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                <CheckCircle className="h-3.5 w-3.5" aria-hidden /> Saved
              </span>
            )}
            {saveState === 'error' && (
              <span className="inline-flex items-center gap-1 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {errorMsg}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="inline-flex items-center gap-1 rounded border border-cshse-300 bg-white px-2 py-1 text-xs font-medium text-cshse-800 hover:bg-cshse-100 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" aria-hidden /> Save
            </button>
          </div>
        )}
      </header>
      <div className="rounded border border-gray-200 bg-white px-3 py-2">
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none focus:outline-none"
          onBlur={() => {
            // Auto-save when the editor loses focus, mirroring the
            // narrative editor's flow so coordinators don't have to
            // remember to click Save.
            if (!readOnly) handleSave();
          }}
        />
      </div>
    </section>
  );
}
