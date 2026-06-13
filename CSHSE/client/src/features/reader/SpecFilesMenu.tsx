import React, { useEffect, useRef, useState } from 'react';
import { FolderOpen, FileText, ChevronDown, Eye, Link2, ExternalLink } from 'lucide-react';
import { FilePreviewModal } from '../selfStudy/FileLibrary/FilePreviewModal';

export interface SpecEvidence {
  _id: string;
  standardCode?: string;
  specCode?: string;
  tags?: string[];
  evidenceType?: string;
  url?: { href?: string; title?: string };
  file?: { originalName?: string; mimeType?: string; size?: number };
}

// Group the import "kind:" tag into the reader-facing buckets. The reader asked
// for CV / Syllabi / Projects sections; web links get their own; everything
// else falls under Documents.
const KIND_BUCKET: { key: string; label: string; tags: string[] }[] = [
  { key: 'syllabus', label: 'Syllabi', tags: ['syllabus'] },
  { key: 'cv', label: 'CVs', tags: ['cv'] },
  { key: 'project', label: 'Projects', tags: ['project'] },
  { key: 'paper', label: 'Papers', tags: ['paper'] },
  { key: 'other', label: 'Documents', tags: [] },
  { key: 'link', label: 'Links', tags: [] },
];

function kindOf(item: SpecEvidence): string {
  if (item.evidenceType === 'url') return 'link';
  const t = (item.tags || []).find((x) => x.startsWith('kind:'));
  const k = t ? t.slice(5) : '';
  return ['syllabus', 'cv', 'project', 'paper'].includes(k) ? k : 'other';
}

/** Readable name; falls back to "<Kind> — <std>.<spec>" for junk import labels. */
function fileLabel(item: SpecEvidence): string {
  if (item.evidenceType === 'url') return item.url?.title || item.url?.href || 'Link';
  const raw = item.file?.originalName || '';
  const dot = raw.lastIndexOf('.');
  const base = (dot > 0 ? raw.slice(0, dot) : raw).trim();
  if (base.replace(/[^a-z0-9]/gi, '').length > 2) return raw;
  const kind = KIND_BUCKET.find((b) => b.key === kindOf(item))?.label || 'Document';
  const ext = dot > 0 ? raw.slice(dot) : '';
  const where = item.standardCode ? ` — ${item.standardCode}${item.specCode ? `.${item.specCode}` : ''}` : '';
  return `${kind.replace(/s$/, '')}${where}${ext}`;
}

interface SpecFilesMenuProps {
  submissionId: string;
  files: SpecEvidence[];
  standardCode: string;
  specCode: string;
}

/**
 * The per-spec "Files" control on the Reader Report. Instead of navigating away
 * to the File Library, it drops a menu of the files LINKED TO THIS spec, grouped
 * by kind (Syllabi / CVs / Projects / …). Clicking a file VIEWS its contents in
 * place (a preview modal) — the reader never leaves the Reader Report.
 */
export function SpecFilesMenu({ submissionId, files, standardCode, specCode }: SpecFilesMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<SpecEvidence | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Items tagged to THIS spec float to the top of their kind group, so the
  // reader sees what's specific first, then the rest of the program library.
  const here = (f: SpecEvidence) => (f.standardCode === standardCode && (f.specCode || '') === specCode ? 0 : 1);
  const buckets = KIND_BUCKET
    .map((b) => ({ ...b, items: files.filter((f) => kindOf(f) === b.key).sort((a, c) => here(a) - here(c)) }))
    .filter((b) => b.items.length > 0);

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid={`rr-files-${standardCode}-${specCode}`}
        onClick={() => setOpen((v) => !v)}
        disabled={files.length === 0}
        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        title={files.length ? 'View the imported supporting files — CVs, syllabi, projects, documents — and open any to read it' : 'No supporting files imported'}
      >
        <FolderOpen className="h-3.5 w-3.5" />Files ({files.length})
        {files.length > 0 && <ChevronDown className="h-3 w-3" />}
      </button>

      {open && files.length > 0 && (
        <div
          data-testid={`rr-files-menu-${standardCode}-${specCode}`}
          className="absolute right-0 z-30 mt-1 max-h-96 w-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {buckets.map((b) => (
            <div key={b.key} className="mb-1">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{b.label} ({b.items.length})</div>
              {b.items.map((f) => (
                f.evidenceType === 'url' ? (
                  <a
                    key={f._id}
                    data-testid={`rr-file-${f._id}`}
                    href={f.url?.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-teal-50"
                    title="Open the link in a new tab"
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-blue-400 group-hover:text-blue-600" />
                    <span className="min-w-0 flex-1 truncate">{fileLabel(f)}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-blue-600" />
                  </a>
                ) : (
                  <button
                    key={f._id}
                    data-testid={`rr-file-${f._id}`}
                    onClick={() => { setPreview(f); setOpen(false); }}
                    className="group flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-teal-50"
                    title="View the file contents"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-teal-600" />
                    <span className="min-w-0 flex-1 truncate">{fileLabel(f)}</span>
                    <Eye className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-teal-600" />
                  </button>
                )
              ))}
            </div>
          ))}
        </div>
      )}

      {preview && (
        <FilePreviewModal
          submissionId={submissionId}
          evidenceId={preview._id}
          fileName={fileLabel(preview)}
          mimeType={preview.file?.mimeType}
          fileSize={preview.file?.size}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

export default SpecFilesMenu;
