import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Download, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// CR-074 — Required program documents (VP-for-Accreditation letter,
// institutional support letter, …). The PC/admin can add these even AFTER the
// self-study is locked; readers and lead readers see + download them. Backed by
// GET/POST /api/submissions/:id/required-documents.
interface RequiredDoc {
  id: string;
  requiredDocType: string;
  typeLabel: string;
  note?: string;
  originalName: string;
  uploadedAt?: string;
  downloadUrl: string;
}

// Order + labels for the required-document types (mirrors the server map).
const DOC_TYPES: Array<{ value: string; label: string }> = [
  { value: 'vp-accreditation-letter', label: 'VP for Accreditation Letter' },
  { value: 'institutional-support-letter', label: 'Institutional Support Letter' },
  { value: 'other', label: 'Other Required Document' },
];

export default function RequiredDocuments({
  submissionId,
  canUpload = false,
}: {
  submissionId: string;
  canUpload?: boolean;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['required-documents', submissionId],
    queryFn: async () => {
      const r = await api.get(`${API_BASE}/submissions/${submissionId}/required-documents`);
      return (r.data?.documents || []) as RequiredDoc[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('requiredDocType', docType);
      await api.post(`${API_BASE}/submissions/${submissionId}/required-documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      setError(null);
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['required-documents', submissionId] });
    },
    onError: (e: any) => setError(e.response?.data?.error || 'Upload failed. Please try again.'),
  });

  const download = async (doc: RequiredDoc) => {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const resp = await api.get(doc.downloadUrl, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalName || 'document';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not download the file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const docs = listQuery.data || [];

  return (
    <div data-testid="required-documents" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <FileText className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">Required Program Documents</h3>
        <span className="ml-auto text-xs text-slate-500">{docs.length} on file</span>
      </div>

      <div className="p-4 space-y-3">
        <p className="text-xs text-slate-500">
          Signed letters and other required documents (e.g. the VP-for-Accreditation letter and the
          institutional support letter). These are visible to the assigned readers and lead reader.
        </p>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </div>
        )}

        {listQuery.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
        ) : docs.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">
            No required documents uploaded yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {docs.map((d) => (
              <li key={d.id} data-testid={`req-doc-${d.id}`} className="flex items-center gap-3 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-teal-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">{d.typeLabel}</div>
                  <div className="truncate text-xs text-slate-500">{d.originalName}</div>
                </div>
                <button
                  type="button"
                  onClick={() => download(d)}
                  disabled={downloadingId === d.id}
                  data-testid={`req-doc-download-${d.id}`}
                  className="flex shrink-0 items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {downloadingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  Download
                </button>
              </li>
            ))}
          </ul>
        )}

        {canUpload && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              data-testid="req-doc-type"
              className="rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
            >
              {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <input
              ref={fileRef}
              type="file"
              data-testid="req-doc-file"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMutation.mutate(f); }}
              className="text-xs"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            />
            {uploadMutation.isPending && <span className="flex items-center gap-1 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…</span>}
            {uploadMutation.isSuccess && !uploadMutation.isPending && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Uploaded</span>}
            <span className="w-full text-[11px] text-slate-400">Choose a type, then a PDF or Word file. You can add these even after the self-study is submitted.</span>
          </div>
        )}
      </div>
    </div>
  );
}
