import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { downloadBoardReport, RECOMMENDATION_LABEL, STATUS_LABEL } from './boardApi';

// READ-ONLY rendering of a completed Lead Reader Report for the CSHSE Board.
// Deliberately separate from the lead reader's editable LeadReaderReportPage:
// there are no inputs, no autosave and no PUT anywhere on this page.

const ACCREDITATION_LABEL: Record<string, string> = {
  initial: 'Initial',
  reaccreditation: 'Reaccreditation',
  interim: 'Interim Report and Review',
};

interface BoardReportResponse {
  system: {
    institutionName: string;
    programName: string;
    degreeLabel: string;
    accreditationStatusDefault: string;
    siteVisitDateDefault: string;
    leadReaderName: string;
    additionalReaders: string[];
    generalEducationCourses: string[];
    programCourses: string[];
  };
  report: Record<string, any> | null;
  status: string;
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4" data-testid={`board-lrr-section-${n}`}>
      <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-slate-900">
        <span className="rounded bg-teal-600 px-2 py-0.5 text-xs font-bold text-white">{n}</span>
        <span>{title}</span>
      </h2>
      <dl className="space-y-3">{children}</dl>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const v = (value ?? '').toString().trim();
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-700">{label}</dt>
      <dd className={`mt-0.5 whitespace-pre-wrap text-sm ${v ? 'text-slate-800' : 'italic text-slate-400'}`}>
        {v || 'Not provided'}
      </dd>
    </div>
  );
}

export function BoardLeadReaderReportView(): JSX.Element {
  const { submissionId = '' } = useParams();
  const [dlError, setDlError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['board-lead-reader-report', submissionId],
    queryFn: async () => (await api.get(`/api/board/lead-reader-reports/${submissionId}`)).data as BoardReportResponse,
    enabled: !!submissionId,
    refetchOnWindowFocus: false,
  });

  const back = (
    <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
      <ArrowLeft className="h-4 w-4" /> All completed reports
    </Link>
  );

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Lead Reader Report…
      </div>
    );
  }
  if (query.error || !query.data) {
    const status = (query.error as any)?.response?.status;
    return (
      <div className="mx-auto max-w-3xl space-y-3 p-6">
        {back}
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {status === 404
            ? 'This Lead Reader Report is not completed yet, so it is not available to the board.'
            : status === 403
              ? 'Only CSHSE Board members can open completed Lead Reader Reports.'
              : 'Could not load the Lead Reader Report.'}
        </div>
      </div>
    );
  }

  const { system: sys, report } = query.data;
  const f = report || {};
  const dl = async (format: 'docx' | 'pdf') => {
    setDlError(null);
    try {
      await downloadBoardReport(submissionId, format, sys.institutionName);
    } catch (e: any) {
      setDlError(`Download failed${e?.response?.status ? ` (${e.response.status})` : ''}.`);
    }
  };
  const courses = (f.requiredCoursesOverride || '').trim()
    ? f.requiredCoursesOverride
    : [
        sys.generalEducationCourses.length ? `General Education:\n${sys.generalEducationCourses.join('\n')}` : '',
        sys.programCourses.length ? `Program courses:\n${sys.programCourses.join('\n')}` : '',
      ].filter(Boolean).join('\n\n');
  const rec = f.recommendation as string | undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6" data-testid="board-lrr-view">
      <div className="mb-3">{back}</div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lead Reader Report to VPA to Request Board Action</h1>
          <p className="mt-1 text-sm text-slate-600">
            {sys.institutionName} · {sys.programName} · {sys.degreeLabel}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Read-only · {STATUS_LABEL[query.data.status] || query.data.status}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="board-lrr-download-docx"
            onClick={() => dl('docx')}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> Word
          </button>
          <button
            type="button"
            data-testid="board-lrr-download-pdf"
            onClick={() => dl('pdf')}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" /> PDF
          </button>
        </div>
      </div>
      {dlError && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{dlError}</p>}

      <div className="space-y-4">
        <Section n={1} title="Program Information">
          <Field label="VPA recipients" value={f.vpaRecipients} />
          <Field label="Contact information" value={f.contactInfo} />
          <Field
            label="Accreditation status"
            value={ACCREDITATION_LABEL[f.accreditationStatus || sys.accreditationStatusDefault] || f.accreditationStatus}
          />
          <Field label="Initial accreditation date" value={f.initialAccreditationDate} />
          <Field label="Last reaccreditation date" value={f.lastReaccreditationDate} />
          <Field
            label="Site visit date"
            value={f.noSiteVisitRequired ? 'No site visit required' : f.siteVisitDate || sys.siteVisitDateDefault}
          />
          <Field label="Program description" value={f.programDescription} />
        </Section>
        <Section n={2} title="Reader Information">
          <Field label="Lead Reader / Site Visitor (SV1)" value={sys.leadReaderName} />
          <Field label="Second Site Visitor (SV2)" value={f.secondSiteVisitorName} />
          <Field label="Additional readers" value={(sys.additionalReaders || []).join('\n')} />
        </Section>
        <Section n={3} title="List of Required Courses used to meet compliance of Standards">
          <Field label="Required courses" value={courses} />
        </Section>
        <Section n={4} title="Identify Standards and Strengths">
          <Field label="Strengths from the self-study" value={f.strengthsFromSelfStudy} />
          <Field label="Strengths from the site visit" value={f.strengthsFromSiteVisit} />
        </Section>
        <Section n={5} title="Standards / Specifications in non-compliance">
          <Field label="Non-compliance" value={f.nonComplianceText} />
        </Section>
        <Section n={6} title="Recommendations">
          <Field label="Recommendation" value={rec ? RECOMMENDATION_LABEL[rec] || rec : ''} />
          {rec === 'hold' && <Field label="Explanation" value={f.holdExplanation} />}
        </Section>
        <Section n={7} title="Additional Reader Recommendations not required by the Standards">
          <Field label="Additional recommendations" value={f.additionalRecommendations} />
        </Section>
        <Section n={8} title="Suggestions for developing the next Self-Study">
          <Field label="Suggestions" value={f.nextSelfStudySuggestions} />
        </Section>
        <Section n={9} title="Submission">
          <Field label="Submitted by" value={f.submittedByName} />
          <Field label="Submission date" value={f.submissionDate} />
        </Section>
      </div>
    </div>
  );
}

export default BoardLeadReaderReportView;
