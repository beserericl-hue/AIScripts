import React from 'react';
import {
  FileText,
  Upload,
  Users,
  BookOpen,
  FolderOpen,
  PenLine,
  Grid3x3,
  Paperclip,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';

// ---------------------------------------------------------------------------
// CR-047 — PC dashboard workflow pipeline (IMPORT → DRAFTS → SELF-STUDY →
// SUBMIT). Mirrors the editor toolbar vocabulary CR-045 established so the
// PC sees the same mental model on their landing dashboard.
//
// Pure presentational component: the Dashboard owns the data fetch + the
// navigation, and hands this component the rolled-up summary + a set of
// callbacks. Deep-link "rail keys" mirror SpecRail's synthetic keys so the
// editor can pre-select the matching Review group.
// ---------------------------------------------------------------------------

export interface WorkflowSummaryData {
  import: {
    filename: string;
    importedAt: string;
    aiStatus: string | null;
    fileCount: number;
  } | null;
  drafts: {
    cvs: number;
    syllabi: number;
    papers: number;
    introductions: number;
    specItems: number;
    bySpec: Array<{ std: string; spec: string; count: number }>;
    reviewed?: number;
  };
  selfStudy: {
    specsValidated: number;
    specsTotal: number;
    narrativesWritten: number;
    matrixRows: number;
    evidenceFiles: number;
  };
  submit: {
    deadline: string | null;
    validated: number;
    total: number;
    ready: boolean;
  };
}

// Rail keys consumed by SelfStudyEditor's deep-link effect (CR-047) →
// SpecRail pre-selection. Keep in sync with SpecRail.tsx.
const RAIL_KEY = {
  cvs: '_cvs',
  syllabi: '_evidence-docs:syllabus',
  papers: '_evidence-docs:paper',
  introductions: '_intro:document',
} as const;

interface WorkflowSummaryProps {
  summary: WorkflowSummaryData | null;
  isLoading: boolean;
  /** Open the AI Importer wizard. */
  onOpenImporter: () => void;
  /** Open the Review surface; optional rail key pre-selects a kind/spec. */
  onOpenReview: (specKey?: string) => void;
  /** Open the Self-Study editor (standards view). */
  onOpenSelfStudy: () => void;
  /** Trigger the final-submit flow. */
  onSubmit: () => void;
  /** CR-074 — the submission's lifecycle status. Once submitted the IMPORT +
   *  DRAFTS triage steps are cleared and a "Submitted for review" state shows. */
  submissionStatus?: string;
  submittedAt?: string | null;
}

// CR-074 — statuses at/after submit. The PC dashboard clears the draft-triage
// pipeline and shows a read-only submitted state once the study reaches these.
const SUBMITTED_STATUSES = [
  'submitted', 'under_review', 'readers_assigned', 'review_complete', 'compliant', 'non_compliant',
];
const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted — awaiting reader assignment',
  under_review: 'Under review',
  readers_assigned: 'Readers assigned — review in progress',
  review_complete: 'Reader review complete',
  compliant: 'Found compliant',
  non_compliant: 'Found non-compliant',
};

function SectionShell({
  step,
  label,
  hint,
  children,
}: {
  step: number;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-600 text-white text-sm font-semibold">
          {step}
        </span>
        <h2 className="font-semibold text-gray-900 uppercase tracking-wide text-sm">
          {label}
        </h2>
        {hint && <span className="text-xs text-gray-400">{hint}</span>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function CountTile({
  icon,
  label,
  count,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  onClick?: () => void;
}) {
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`flex flex-col items-center justify-center rounded-lg border p-4 text-center transition-colors ${
        clickable
          ? 'border-gray-200 hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
          : 'border-gray-100 cursor-default'
      }`}
    >
      <div className="text-primary-500 mb-1">{icon}</div>
      <span className="text-2xl font-bold text-gray-900">{count}</span>
      <span className="text-xs text-gray-500 mt-0.5">{label}</span>
    </button>
  );
}

export function WorkflowSummary({
  summary,
  isLoading,
  onOpenImporter,
  onOpenReview,
  onOpenSelfStudy,
  onSubmit,
  submissionStatus,
  submittedAt,
}: WorkflowSummaryProps): JSX.Element {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="workflow-summary-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const drafts = summary?.drafts;
  const selfStudy = summary?.selfStudy;
  const submit = summary?.submit;
  const imp = summary?.import ?? null;
  const isSubmitted = !!submissionStatus && SUBMITTED_STATUSES.includes(submissionStatus);

  const validated = selfStudy?.specsValidated ?? 0;
  const total = selfStudy?.specsTotal ?? 0;
  const pct = total > 0 ? Math.round((validated / total) * 100) : 0;

  return (
    <div className="space-y-6" data-testid="workflow-summary">
      {/* CR-074 — once submitted, the PC's landing page leads with the
          submitted state (not the draft-triage pipeline). */}
      {isSubmitted && (
        <div
          data-testid="workflow-submitted-banner"
          className="rounded-xl border border-green-200 bg-green-50 p-5"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-600" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-green-900">
                Submitted for review
              </p>
              <p className="mt-0.5 text-sm text-green-800">
                {STATUS_LABEL[submissionStatus!] || 'Submitted'}
                {submittedAt ? ` · ${format(new Date(submittedAt), 'MMM d, yyyy')}` : ''}
              </p>
              <p className="mt-2 text-sm text-green-800">
                Your self-study is now read-only. You can view and print it, and
                the reader report as it develops. Contact the administrator if you
                need to make changes.
              </p>
              <button
                type="button"
                onClick={onOpenSelfStudy}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
              >
                View self-study
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. IMPORT — draft-triage step; cleared once submitted. */}
      {!isSubmitted && (
      <SectionShell step={1} label="Import" hint="Your uploaded self-study">
        {imp ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="w-8 h-8 text-primary-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{imp.filename}</p>
                <p className="text-xs text-gray-500">
                  imported {format(new Date(imp.importedAt), 'MMM d, yyyy')}
                  {imp.aiStatus ? ` · ${imp.aiStatus}` : ''}
                  {imp.fileCount > 1 ? ` · ${imp.fileCount} files` : ''}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenImporter}
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50"
            >
              <Upload className="w-4 h-4" />
              Open Importer
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <FileText className="w-10 h-10 text-gray-300 mb-2" />
            <p className="text-gray-500 mb-3">No document imported yet</p>
            <button
              type="button"
              onClick={onOpenImporter}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-primary-600 rounded-lg hover:bg-primary-700"
            >
              <Upload className="w-4 h-4" />
              Open Importer
            </button>
          </div>
        )}
      </SectionShell>
      )}

      {/* 2. DRAFTS — the draft-review panel; cleared for the PC once submitted. */}
      {!isSubmitted && (
      <SectionShell
        step={2}
        label="Drafts"
        hint={
          drafts && drafts.reviewed != null
            ? `In review (totals) · ${drafts.reviewed} reviewed`
            : 'In review (totals)'
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <CountTile
            icon={<Users className="w-6 h-6" />}
            label="CVs"
            count={drafts?.cvs ?? 0}
            onClick={() => onOpenReview(RAIL_KEY.cvs)}
          />
          <CountTile
            icon={<BookOpen className="w-6 h-6" />}
            label="Syllabi"
            count={drafts?.syllabi ?? 0}
            onClick={() => onOpenReview(RAIL_KEY.syllabi)}
          />
          <CountTile
            icon={<FolderOpen className="w-6 h-6" />}
            label="Projects"
            count={drafts?.papers ?? 0}
            onClick={() => onOpenReview(RAIL_KEY.papers)}
          />
          <CountTile
            icon={<PenLine className="w-6 h-6" />}
            label="Introductions"
            count={drafts?.introductions ?? 0}
            onClick={() => onOpenReview(RAIL_KEY.introductions)}
          />
          <CountTile
            icon={<FileCheckIcon />}
            label="Spec items"
            count={drafts?.specItems ?? 0}
            onClick={() => onOpenReview()}
          />
        </div>

        {drafts && drafts.bySpec.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Items in review, by spec
            </p>
            <div className="flex flex-wrap gap-2">
              {drafts.bySpec.map((row) => {
                const specKey = `${row.std}.${row.spec}`;
                return (
                  <button
                    key={specKey}
                    type="button"
                    onClick={() => onOpenReview(specKey)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md border border-gray-200 hover:border-primary-300 hover:bg-primary-50"
                  >
                    <span className="font-medium text-gray-700">
                      {row.std}
                      {row.spec ? `.${row.spec}` : ''}
                    </span>
                    <span className="text-xs text-gray-500">{row.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Explicit entry to the Review surface — mirrors "Open Self-Study"
            below. The tiles/chips above also open Review, but a coordinator
            with review data and no self-study yet needs an obvious button. */}
        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={() => onOpenReview()}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50"
          >
            Open Review
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </SectionShell>
      )}

      {/* 3. SELF-STUDY ---------------------------------------------------- */}
      <SectionShell step={3} label="Self-Study" hint="Committed content">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <CountTile
            icon={<CheckCircle2 className="w-6 h-6" />}
            label="Specs validated"
            count={validated}
          />
          <CountTile
            icon={<PenLine className="w-6 h-6" />}
            label="Narratives"
            count={selfStudy?.narrativesWritten ?? 0}
          />
          <CountTile
            icon={<Grid3x3 className="w-6 h-6" />}
            label="Matrix rows"
            count={selfStudy?.matrixRows ?? 0}
          />
          <CountTile
            icon={<Paperclip className="w-6 h-6" />}
            label="Evidence files"
            count={selfStudy?.evidenceFiles ?? 0}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>{validated} of {total} specs validated</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenSelfStudy}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-sm text-primary-700 border border-primary-300 rounded-lg hover:bg-primary-50"
          >
            Open Self-Study
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </SectionShell>

      {/* 4. SUBMIT -------------------------------------------------------- */}
      <SectionShell step={4} label="Submit">
        {isSubmitted ? (
          <div className="flex items-center gap-3 text-sm" data-testid="dashboard-submit-done">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="text-gray-700">
              {STATUS_LABEL[submissionStatus!] || 'Submitted'}
              {submittedAt ? ` · ${format(new Date(submittedAt), 'MMM d, yyyy')}` : ''}
            </span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Clock className="w-5 h-5 text-gray-400" />
              <span>
                {submit?.deadline
                  ? `Deadline ${format(new Date(submit.deadline), 'MMM d, yyyy')}`
                  : 'No deadline set'}
                {' · '}
                {validated}/{total} validated
                {' · '}
                <span className={submit?.ready ? 'text-green-600 font-medium' : 'text-amber-600'}>
                  {submit?.ready ? 'Ready to submit' : 'Not ready to submit'}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={onSubmit}
              disabled={!submit?.ready}
              data-testid="dashboard-submit-cta"
              className={`flex-shrink-0 flex items-center gap-2 px-5 py-2 text-sm rounded-lg font-medium ${
                submit?.ready
                  ? 'text-white bg-primary-600 hover:bg-primary-700'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
              Submit Self-Study for Review
            </button>
          </div>
        )}
      </SectionShell>
    </div>
  );
}

// Small inline icon so the "Spec items" tile reads as a checklist without
// pulling another lucide import into the tile grid.
function FileCheckIcon() {
  return <FileText className="w-6 h-6" />;
}

export default WorkflowSummary;
