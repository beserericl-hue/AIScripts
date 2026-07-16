import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Check, Loader2, Download, ClipboardCheck, AlertCircle } from 'lucide-react';
import { api } from '../../../services/api';

// ---------------------------------------------------------------------------
// Lead Reader Report to VPA to Request Board Action
//
// A board-facing document, DISTINCT from the reader/compilation reports. The
// server assembles read-only SYSTEM context (institution, courses, the AI's
// non-compliance list, …) and stores the lead reader's editable FIELDS. This
// page seeds its editable state from the saved report when present, else from
// the system defaults, autosaves (debounced) via PUT, and downloads the
// filled Word / PDF from the server's download endpoint.
// Access is gated on the server to lead_reader (assigned) + admin/superuser.
// ---------------------------------------------------------------------------

type AccreditationStatus = 'initial' | 'reaccreditation' | 'interim';
type Recommendation =
  | 'accredit_no_conditions'
  | 'conditional'
  | 'deny'
  | 'hold'
  | '';

interface LeadReaderReportSystem {
  institutionName: string;
  programName: string;
  programLevel: string;
  degreeLabel: string;
  accreditationStatusDefault: AccreditationStatus;
  siteVisitDateDefault: string;
  leadReaderName: string;
  additionalReaders: string[];
  generalEducationCourses: string[];
  programCourses: string[];
  nonCompliance: Array<{ spec: string; comments: string[] }>;
}

interface LeadReaderReportFields {
  vpaRecipients: string;
  contactInfo: string;
  accreditationStatus: AccreditationStatus;
  initialAccreditationDate: string;
  lastReaccreditationDate: string;
  siteVisitDate: string;
  noSiteVisitRequired: boolean;
  programDescription: string;
  strengthsFromSelfStudy: string;
  strengthsFromSiteVisit: string;
  nonComplianceText: string;
  requiredCoursesOverride: string;
  recommendation: Recommendation;
  conditionalRequirements: string;
  holdExplanation: string;
  additionalRecommendations: string;
  nextSelfStudySuggestions: string;
  submittedByName: string;
  submissionDate: string;
}

interface LeadReaderReportResponse {
  system: LeadReaderReportSystem;
  report: Partial<LeadReaderReportFields> | null;
}

const emptyFields = (defaults?: {
  accreditationStatus?: AccreditationStatus;
  siteVisitDate?: string;
}): LeadReaderReportFields => ({
  vpaRecipients: '',
  contactInfo: '',
  accreditationStatus: defaults?.accreditationStatus ?? 'initial',
  initialAccreditationDate: '',
  lastReaccreditationDate: '',
  siteVisitDate: defaults?.siteVisitDate ?? '',
  noSiteVisitRequired: false,
  programDescription: '',
  strengthsFromSelfStudy: '',
  strengthsFromSiteVisit: '',
  nonComplianceText: '',
  requiredCoursesOverride: '',
  recommendation: '',
  conditionalRequirements: '',
  holdExplanation: '',
  additionalRecommendations: '',
  nextSelfStudySuggestions: '',
  submittedByName: '',
  submissionDate: '',
});

// Merge a saved (partial) report over the system-seeded defaults, so any
// field the lead reader hasn't touched still carries its default.
function seedFields(data: LeadReaderReportResponse): LeadReaderReportFields {
  const base = emptyFields({
    accreditationStatus: data.system.accreditationStatusDefault,
    siteVisitDate: data.system.siteVisitDateDefault,
  });
  if (!data.report) return base;
  return { ...base, ...data.report } as LeadReaderReportFields;
}

const ACCREDITATION_OPTIONS: { value: AccreditationStatus; label: string }[] = [
  { value: 'initial', label: 'Initial' },
  { value: 'reaccreditation', label: 'Reaccreditation' },
  { value: 'interim', label: 'Interim Report and Review' },
];

const RECOMMENDATION_OPTIONS: { value: Exclude<Recommendation, ''>; label: string }[] = [
  { value: 'accredit_no_conditions', label: 'Accreditation with no conditions' },
  { value: 'conditional', label: 'Conditional accreditation. List the requirements below.' },
  { value: 'deny', label: 'Deny accreditation due to significant noncompliance' },
  { value: 'hold', label: 'Hold a decision. Please explain.' },
];

// Shared field styling (matches the reader-report editor's inputs).
const inputCls =
  'w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-300';
const textareaCls = `${inputCls} resize-y`;
const labelCls = 'mb-1 block text-sm font-semibold text-slate-700';

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={`lrr-section-${n}`}
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-slate-900">
        <span className="rounded bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">{n}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function LeadReaderReportPage({ submissionId }: { submissionId: string }): JSX.Element {
  const [fields, setFields] = useState<LeadReaderReportFields>(() => emptyFields());
  const [system, setSystem] = useState<LeadReaderReportSystem | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const seededRef = useRef(false);

  const query = useQuery({
    queryKey: ['lead-reader-report', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/lead-reader-report`);
      return r.data as LeadReaderReportResponse;
    },
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  // Seed editable state ONCE from the server (report ?? defaults). Guarded so a
  // background refetch never clobbers in-flight edits.
  useEffect(() => {
    if (!query.data || seededRef.current) return;
    setSystem(query.data.system);
    setFields(seedFields(query.data));
    seededRef.current = true;
  }, [query.data]);

  const save = useMutation({
    mutationFn: async (payload: Partial<LeadReaderReportFields>) => {
      const r = await api.put(`/api/submissions/${submissionId}/lead-reader-report`, payload);
      return r.data as { ok: boolean; report: Partial<LeadReaderReportFields> };
    },
    onSuccess: () => {
      setSavedAt(new Date().toISOString());
    },
  });

  const setField = useCallback(<K extends keyof LeadReaderReportFields>(
    key: K,
    value: LeadReaderReportFields[K]
  ) => {
    dirtyRef.current = true;
    setFields((f) => ({ ...f, [key]: value }));
  }, []);

  // Debounced autosave (2s) — mirrors the reader-report editor's dirty-flag
  // autosave. The explicit Save button below flushes immediately.
  useEffect(() => {
    if (!seededRef.current || !dirtyRef.current) return;
    const t = setTimeout(() => {
      if (dirtyRef.current && !save.isPending) {
        dirtyRef.current = false;
        save.mutate(fields);
      }
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const saveNow = useCallback(() => {
    dirtyRef.current = false;
    save.mutate(fields);
  }, [fields, save]);

  const download = useCallback(
    async (format: 'docx' | 'pdf') => {
      setDlError(null);
      try {
        // Flush the latest edits first so the download reflects them.
        if (dirtyRef.current) {
          dirtyRef.current = false;
          await save.mutateAsync(fields).catch(() => {});
        }
        const resp = await api.get(
          `/api/submissions/${submissionId}/lead-reader-report/download?format=${format}`,
          { responseType: 'blob' }
        );
        const blob = new Blob([resp.data], {
          type:
            resp.headers['content-type'] ||
            (format === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Lead-Reader-Report.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (e: any) {
        setDlError(`Download failed${e?.response?.status ? ` (${e.response.status})` : ''}.`);
      }
    },
    [fields, save, submissionId]
  );

  const compileNonCompliance = useCallback(() => {
    if (!system) return;
    const text = system.nonCompliance
      .map((nc) => [nc.spec, ...(nc.comments || [])].filter(Boolean).join('\n'))
      .join('\n\n');
    setField('nonComplianceText', text);
  }, [system, setField]);

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading Lead Reader Report…</span>
      </div>
    );
  }
  if (query.error) {
    const status = (query.error as any)?.response?.status;
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {status === 403
            ? 'Only the assigned lead reader, an admin, or a superuser can open this report.'
            : 'Could not load the Lead Reader Report.'}
        </div>
      </div>
    );
  }

  const sys = system!;

  return (
    <div
      data-testid="lead-reader-report-page"
      className="mx-auto w-full max-w-4xl px-4 py-6"
    >
      {/* Top action bar */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Lead Reader Report to VPA to Request Board Action
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {sys.institutionName} · {sys.programName}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Lead reader / admin only — this board-facing report autosaves as you type.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {save.isPending ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          ) : savedAt ? (
            <span
              data-testid="lrr-save-status"
              className="inline-flex items-center gap-1 text-xs text-emerald-600"
            >
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          ) : (
            <span data-testid="lrr-save-status" className="text-xs text-slate-400">
              Not yet saved
            </span>
          )}
          <button
            data-testid="lrr-download-docx"
            onClick={() => download('docx')}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            title="Download the Lead Reader Report as a Word document"
          >
            <Download className="h-4 w-4" />
            Download Word
          </button>
          <button
            data-testid="lrr-download-pdf"
            onClick={() => download('pdf')}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            title="Download the Lead Reader Report as a PDF"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          <button
            data-testid="lrr-save"
            onClick={saveNow}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {dlError && (
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {dlError}
        </p>
      )}

      <div className="space-y-5">
        {/* 1. Program Information */}
        <Section n={1} title="Program Information">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {sys.institutionName}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {sys.programName}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {sys.degreeLabel}
            </span>
          </div>
          <div>
            <label className={labelCls} htmlFor="lrr-vpaRecipients">
              To (Vice President for Accreditation and named recipients)
            </label>
            <textarea
              id="lrr-vpaRecipients"
              data-testid="lrr-vpaRecipients"
              value={fields.vpaRecipients}
              onChange={(e) => setField('vpaRecipients', e.target.value)}
              placeholder="Names and titles from the Certificate Page"
              rows={3}
              className={textareaCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="lrr-contactInfo">
              Contact information
            </label>
            <textarea
              id="lrr-contactInfo"
              data-testid="lrr-contactInfo"
              value={fields.contactInfo}
              onChange={(e) => setField('contactInfo', e.target.value)}
              rows={2}
              className={textareaCls}
            />
          </div>
          <div>
            <span className={labelCls}>Accreditation status</span>
            <div className="flex flex-wrap gap-4">
              {ACCREDITATION_OPTIONS.map((o) => (
                <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="lrr-accreditationStatus"
                    data-testid={`lrr-accreditationStatus-${o.value}`}
                    checked={fields.accreditationStatus === o.value}
                    onChange={() => setField('accreditationStatus', o.value)}
                    className="h-4 w-4 text-teal-600"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="lrr-initialAccreditationDate">
                Date of initial accreditation
              </label>
              <input
                id="lrr-initialAccreditationDate"
                data-testid="lrr-initialAccreditationDate"
                type="text"
                value={fields.initialAccreditationDate}
                onChange={(e) => setField('initialAccreditationDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lrr-lastReaccreditationDate">
                Date of last reaccreditation
              </label>
              <input
                id="lrr-lastReaccreditationDate"
                data-testid="lrr-lastReaccreditationDate"
                type="text"
                value={fields.lastReaccreditationDate}
                onChange={(e) => setField('lastReaccreditationDate', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="lrr-siteVisitDate">
                Site visit date
              </label>
              <input
                id="lrr-siteVisitDate"
                data-testid="lrr-siteVisitDate"
                type="text"
                value={fields.siteVisitDate}
                onChange={(e) => setField('siteVisitDate', e.target.value)}
                className={inputCls}
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                data-testid="lrr-noSiteVisitRequired"
                checked={fields.noSiteVisitRequired}
                onChange={(e) => setField('noSiteVisitRequired', e.target.checked)}
                className="h-4 w-4 rounded text-teal-600"
              />
              No site visit required
            </label>
          </div>
          <div>
            <label className={labelCls} htmlFor="lrr-programDescription">
              Program description
            </label>
            <textarea
              id="lrr-programDescription"
              data-testid="lrr-programDescription"
              value={fields.programDescription}
              onChange={(e) => setField('programDescription', e.target.value)}
              rows={4}
              className={textareaCls}
            />
          </div>
        </Section>

        {/* 2. Reader Information */}
        <Section n={2} title="Reader Information">
          <div>
            <span className={labelCls}>Lead Reader / SV1</span>
            <p className="text-sm text-slate-800">{sys.leadReaderName || '—'}</p>
          </div>
          <div>
            <span className={labelCls}>Additional readers</span>
            {sys.additionalReaders.length > 0 ? (
              <ul className="list-disc pl-5 text-sm text-slate-800">
                {sys.additionalReaders.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-slate-400">None</p>
            )}
          </div>
        </Section>

        {/* 3. List of Required Courses used to meet compliance of Standards */}
        <Section n={3} title="List of Required Courses used to meet compliance of Standards">
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">General Education Courses</h3>
            {sys.generalEducationCourses.length > 0 ? (
              <ul className="list-disc pl-5 text-sm text-slate-800">
                {sys.generalEducationCourses.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-slate-400">None listed</p>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">Program Courses</h3>
            {sys.programCourses.length > 0 ? (
              <ul className="list-disc pl-5 text-sm text-slate-800">
                {sys.programCourses.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-slate-400">None listed</p>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="lrr-requiredCoursesOverride">
              Override course list
            </label>
            <textarea
              id="lrr-requiredCoursesOverride"
              data-testid="lrr-requiredCoursesOverride"
              value={fields.requiredCoursesOverride}
              onChange={(e) => setField('requiredCoursesOverride', e.target.value)}
              placeholder="Leave blank to use the list above"
              rows={4}
              className={textareaCls}
            />
            <p className="mt-1 text-xs text-slate-400">Leave blank to use the list above.</p>
          </div>
        </Section>

        {/* 4. Identify Standards and Strengths */}
        <Section n={4} title="Identify Standards and Strengths">
          <div>
            <label className={labelCls} htmlFor="lrr-strengthsFromSelfStudy">
              From Self-Study
            </label>
            <textarea
              id="lrr-strengthsFromSelfStudy"
              data-testid="lrr-strengthsFromSelfStudy"
              value={fields.strengthsFromSelfStudy}
              onChange={(e) => setField('strengthsFromSelfStudy', e.target.value)}
              rows={4}
              className={textareaCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="lrr-strengthsFromSiteVisit">
              From Site Visit
            </label>
            <textarea
              id="lrr-strengthsFromSiteVisit"
              data-testid="lrr-strengthsFromSiteVisit"
              value={fields.strengthsFromSiteVisit}
              onChange={(e) => setField('strengthsFromSiteVisit', e.target.value)}
              rows={4}
              className={textareaCls}
            />
          </div>
        </Section>

        {/* 5. Standards/Specs in non-compliance */}
        <Section n={5} title="Standards / Specifications in non-compliance">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Reference — from the review
              </span>
              <button
                data-testid="lrr-copy-noncompliance"
                onClick={compileNonCompliance}
                disabled={sys.nonCompliance.length === 0}
                className="inline-flex items-center gap-1 rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                Copy compiled comments into the field below
              </button>
            </div>
            {sys.nonCompliance.length > 0 ? (
              <ul className="space-y-2">
                {sys.nonCompliance.map((nc, i) => (
                  <li key={i} className="text-sm text-amber-900">
                    <span className="font-semibold">{nc.spec}</span>
                    {nc.comments.length > 0 && (
                      <ul className="mt-0.5 list-disc pl-5 text-amber-800">
                        {nc.comments.map((cmt, j) => (
                          <li key={j}>{cmt}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm italic text-amber-700">No non-compliant specifications recorded.</p>
            )}
          </div>
          <div>
            <label className={labelCls} htmlFor="lrr-nonComplianceText">
              Non-compliance (as it will appear in the report)
            </label>
            <textarea
              id="lrr-nonComplianceText"
              data-testid="lrr-nonComplianceText"
              value={fields.nonComplianceText}
              onChange={(e) => setField('nonComplianceText', e.target.value)}
              rows={6}
              className={textareaCls}
            />
          </div>
        </Section>

        {/* 6. Recommendations */}
        <Section n={6} title="Recommendations">
          <div className="space-y-3">
            {RECOMMENDATION_OPTIONS.map((o) => (
              <div key={o.value}>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="lrr-recommendation"
                    data-testid={`lrr-recommendation-${o.value}`}
                    checked={fields.recommendation === o.value}
                    onChange={() => setField('recommendation', o.value)}
                    className="h-4 w-4 text-teal-600"
                  />
                  {o.label}
                </label>
                {o.value === 'conditional' && fields.recommendation === 'conditional' && (
                  <textarea
                    data-testid="lrr-conditionalRequirements"
                    value={fields.conditionalRequirements}
                    onChange={(e) => setField('conditionalRequirements', e.target.value)}
                    placeholder="List the requirements for conditional accreditation."
                    rows={4}
                    className={`${textareaCls} mt-2`}
                  />
                )}
                {o.value === 'hold' && fields.recommendation === 'hold' && (
                  <textarea
                    data-testid="lrr-holdExplanation"
                    value={fields.holdExplanation}
                    onChange={(e) => setField('holdExplanation', e.target.value)}
                    placeholder="Explain the reason for holding a decision."
                    rows={4}
                    className={`${textareaCls} mt-2`}
                  />
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* 7. Additional Reader Recommendations not required by the Standards */}
        <Section n={7} title="Additional Reader Recommendations not required by the Standards">
          <textarea
            data-testid="lrr-additionalRecommendations"
            value={fields.additionalRecommendations}
            onChange={(e) => setField('additionalRecommendations', e.target.value)}
            rows={4}
            className={textareaCls}
          />
        </Section>

        {/* 8. Suggestions for developing the next Self-Study */}
        <Section n={8} title="Suggestions for developing the next Self-Study">
          <textarea
            data-testid="lrr-nextSelfStudySuggestions"
            value={fields.nextSelfStudySuggestions}
            onChange={(e) => setField('nextSelfStudySuggestions', e.target.value)}
            rows={4}
            className={textareaCls}
          />
        </Section>

        {/* 9. Submission */}
        <Section n={9} title="Submission">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="lrr-submittedByName">
                Submitted by
              </label>
              <input
                id="lrr-submittedByName"
                data-testid="lrr-submittedByName"
                type="text"
                value={fields.submittedByName}
                onChange={(e) => setField('submittedByName', e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="lrr-submissionDate">
                Date
              </label>
              <input
                id="lrr-submissionDate"
                data-testid="lrr-submissionDate"
                type="text"
                value={fields.submissionDate}
                onChange={(e) => setField('submissionDate', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        </Section>

        <div className="flex items-center justify-end gap-2 pb-4">
          <button
            data-testid="lrr-save-2"
            onClick={saveNow}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Lead Reader Report
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeadReaderReportPage;
