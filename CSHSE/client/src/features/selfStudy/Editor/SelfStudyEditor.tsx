import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  FileUp,
  Home,
  Upload,
  X,
  FileText,
  Check,
  AlertCircle,
  MapPin,
  Trash2,
  RefreshCw,
  Grid3X3,
  BookOpen,
  FolderOpen,
  Maximize2,
  Minimize2,
  Menu,
  ArrowRight,
  PlayCircle,
  MessageSquarePlus,
  Lock,
  Sparkles,
  Download,
  ClipboardList,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { StandardsNavigation } from './StandardsNavigation';
import { NarrativeEditor } from './NarrativeEditor';
import { IntroductionEditor } from './IntroductionEditor';
import { ImportFilePanel } from './ImportFilePanel';
// SpecAIReview removed from the editor — the AI report now renders inline +
// collapsible inside NarrativeEditor (single report per spec).
import { SpecNotApplicable } from './SpecNotApplicable';
import { ReviewSurface } from './Review/ReviewSurface';
import { SurfaceErrorBoundary } from '../../../components/SurfaceErrorBoundary';
import { MatrixSurface } from './Review/MatrixSurface';
import { FinalSubmitModal, type NeedsImprovementItem, type NeedsImprovementNote } from './FinalSubmitModal';
import { CurriculumMatrixEditor } from '../MatrixEditor';
import { FileLibrary } from '../FileLibrary';
import { LeadReaderReportPage } from '../LeadReaderReport/LeadReaderReportPage';
import { CommentSidebar } from '../../comments';
import { DocumentViewer, SectionTagger, TaggedSectionsList, SubExtractionViewerModal, type SectionMetadata, type TaggedSection, type SelectionData, type SavedSectionInfo } from './components';
import { Wizard as AIImportWizard } from './AIImport';
import { useAIImportStore } from '../../../store/aiImportStore';
import { useAuthStore } from '../../../store/authStore';
import { PhaseIndicator } from './PhaseIndicator';

// Use consistent API paths without relying on environment variable

interface SelfStudyEditorProps {
  submissionId: string;
  userRole?: 'program_coordinator' | 'reader' | 'lead_reader' | 'admin';
  userId?: string;
  userName?: string;
}

interface NarrativeContent {
  standardCode: string;
  specCode: string;
  content: string;
  lastModified?: Date;
  supportingEvidenceText?: string;
}

interface SubmissionData {
  _id: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'under_review' | 'readers_assigned' | 'review_complete' | 'compliant' | 'non_compliant';
  narrativeContent: NarrativeContent[];
  standardsStatus: Record<string, {
    status: 'not_started' | 'in_progress' | 'complete' | 'submitted' | 'validated';
    validationStatus?: 'pending' | 'pass' | 'fail';
    // CR-050 — PC can mark a spec not-applicable; excluded specs drop out of
    // the validation denominator and satisfy the submit gate.
    excluded?: boolean;
    excludedReason?: string;
  }>;
  readerLock?: {
    isLocked: boolean;
    lockReason?: string;
  };
  submittedAt?: string;
}

interface StandardDefinition {
  code: string;
  title: string;
  description: string;
  specifications: {
    code: string;
    title: string;
    text: string;
  }[];
}

/**
 * Main Self-Study Editor component
 * Provides a two-panel interface for editing accreditation self-study documents
 */
// Standard names for import display
const STANDARD_NAMES: Record<string, string> = {
  '1': 'Program Identity', '2': 'Program Objectives', '3': 'Organizational Structure',
  '4': 'Budgetary Support', '5': 'Administrative Support', '6': 'Faculty',
  '7': 'Faculty Development', '8': 'Practicum Supervisors', '9': 'Student Services',
  '10': 'Admissions', '11': 'Curriculum', '12': 'Professional Practice',
  '13': 'Program Assessment', '14': 'Student Learning Outcomes', '15': 'Student Portfolio',
  '16': 'Advisory Committee', '17': 'Diversity', '18': 'Ethics',
  '19': 'Supervision', '20': 'Technology', '21': 'Field Experience'
};

interface ParsingDetails {
  tocEntriesFound?: number;
  tocTitles?: string[];
  sectionsCreated?: number;
  sectionTitles?: string[];
  currentSectionIndex?: number;
}

interface ImportProgress {
  step: 'initializing' | 'parsing' | 'analyzing' | 'matching' | 'complete' | 'error' | string;
  stepDescription: string;
  totalSections: number;
  receivedSections: number;
  percentComplete: number;
  elapsedTime?: string;
  elapsedMs?: number;
  n8nSentAt?: string;
  recentMappings: Array<{
    standardCode: string;
    specCode: string;
    mappedBy: string;
  }>;
  parsingDetails?: ParsingDetails;
}

interface ImportStatus {
  id: string;
  status: 'pending' | 'processing' | 'awaiting_selection' | 'completed' | 'failed';
  originalFilename: string;
  mappedCount: number;
  unmappedCount: number;
  error?: string;
  specName?: string;
  progress?: ImportProgress;
  extractedContent?: { pageCount: number; sectionCount: number };
}

// Part 6: Detected section for user selection
interface DetectedSection {
  id: string;
  level: 1 | 2 | 3;
  headerType: 'roman' | 'letter' | 'number' | 'standard' | 'appendix' | 'heading';
  headerText: string;
  previewText: string;
  fullContent: string;
  htmlContent: string;
  startPosition: number;
  endPosition: number;
  isAppendix: boolean;
  isSelected: boolean;
  parentId?: string;
  children: DetectedSection[];
}

interface ExtractedSection {
  id: string;
  pageNumber: number;
  sectionType: string;
  content: string;
  confidence: number;
  mapping?: { standardCode: string; specCode: string; mappedBy: string };
  unmappedReason?: string;
  status: 'mapped' | 'unmapped' | 'pending';
  // AI suggestions for unmapped sections
  suggestedStandardCode?: string;
  suggestedSpecCode?: string;
  suggestedConfidence?: number;
}

// Type for tracking unmapped section assignments
interface UnmappedAssignment {
  standardCode: string;
  specCode: string;
  toSupportingEvidence: boolean;
  toCurriculumMatrix: boolean;
}

// Part 6: Component for rendering section selection items with hierarchy
function SectionSelectionItem({
  section,
  onToggle,
  onViewFull,
  level = 0
}: {
  section: DetectedSection;
  onToggle: (id: string, selected: boolean) => void;
  onViewFull: (section: DetectedSection) => void;
  level?: number;
}) {
  const paddingLeft = level * 20;

  return (
    <>
      <div
        className={`flex items-start gap-3 p-3 hover:bg-gray-50 ${
          section.isAppendix ? 'bg-amber-50' : ''
        }`}
        style={{ paddingLeft: `${12 + paddingLeft}px` }}
      >
        <input
          type="checkbox"
          checked={section.isSelected}
          onChange={(e) => onToggle(section.id, e.target.checked)}
          disabled={section.isAppendix}
          className="mt-1 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {section.isAppendix && (
              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                Appendix
              </span>
            )}
            <span className="font-medium text-gray-900 truncate">
              {section.headerText}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
            {section.previewText}
          </p>
        </div>
        <button
          onClick={() => onViewFull(section)}
          className="text-xs text-teal-600 hover:text-teal-700 font-medium whitespace-nowrap"
        >
          View Full
        </button>
      </div>
      {section.children.map((child) => (
        <SectionSelectionItem
          key={child.id}
          section={child}
          onToggle={onToggle}
          onViewFull={onViewFull}
          level={level + 1}
        />
      ))}
    </>
  );
}

/**
 * AI Import tab button — reads the wizard store's status + tag count so the
 * tab badge tells the Coordinator whether anything needs attention without
 * having to open the wizard. Wired post-2026-05-18 smoke-test feedback.
 */
function AIImportTabButton({
  activeView,
  setActiveView,
  showAiBadge = false
}: {
  activeView: 'standards' | 'curriculum' | 'files' | 'introduction' | 'ai-import' | 'review-surface' | 'matrix-surface' | 'lead-reader-report';
  setActiveView: (v: 'standards' | 'curriculum' | 'files' | 'introduction' | 'ai-import' | 'review-surface' | 'matrix-surface' | 'lead-reader-report') => void;
  // CR-045 — show the purple "AI" badge only when the legacy importer is
  // ALSO visible (so the two need disambiguating). When legacy is hidden
  // this is the only importer and the badge is noise.
  showAiBadge?: boolean;
}) {
  const status = useAIImportStore((s) => s.status);
  const queuePosition = useAIImportStore((s) => s.queuePosition);
  const tagCount = useAIImportStore((s) => s.tags.length);
  const placeholderCount = useAIImportStore((s) => s.placeholderSections.length);
  // CR-043 follow-on bug fix — when the user clicks the Importer Wizard
  // toolbar button while the store still holds a completed import's
  // state (parsed / applied / finished), the wizard would mount on
  // whatever last step the prior run reached (Review, Apply, etc.),
  // hiding the Upload step. Coordinators couldn't import a SECOND file
  // without doing a hard refresh first. Detect that case and call the
  // existing startOver() so the wizard lands on Upload with a clean
  // slate. Persisted Submission.aiReviewState is untouched (CR-043 —
  // it's submission-scoped and survives wizard state resets).
  const startOver = useAIImportStore((s) => s.startOver);

  let badge: { text: string; cls: string } | null = null;
  if (status === 'queued') {
    const pos = queuePosition ?? 1;
    badge = { text: `queued: ${pos}`, cls: 'bg-amber-100 text-amber-800' };
  } else if (status === 'parsing') {
    badge = { text: 'parsing', cls: 'bg-cshse-100 text-cshse-800 animate-pulse' };
  } else if (status === 'parsed') {
    badge = { text: 'ready to review', cls: 'bg-cshse-100 text-cshse-800' };
  } else if (status === 'failed' || status === 'canceled') {
    badge = { text: status, cls: 'bg-red-100 text-red-800' };
  } else if (tagCount > 0) {
    badge = { text: `${tagCount} tag${tagCount === 1 ? '' : 's'}`, cls: 'bg-amber-100 text-amber-800' };
  } else if (placeholderCount > 0) {
    badge = { text: `${placeholderCount} unwritten`, cls: 'bg-yellow-100 text-yellow-800' };
  }

  // A non-impersonating superuser cannot import (they must impersonate a PC —
  // matches the server-side requireCanImport 403). Disable with a clear reason.
  const authUser = useAuthStore((s) => s.user);
  const isImpersonating = useAuthStore((s) => s.impersonation.isImpersonating);
  const canImport = !(authUser?.isSuperuser === true && !isImpersonating);

  return (
    <button
      disabled={!canImport}
      onClick={() => {
        if (!canImport) return;
        // "Upload Files" means "start a NEW import" — always land the
        // coordinator on the Upload step with a clean form, regardless
        // of any prior or in-flight run.
        //
        // Earlier behavior reset only on SETTLED runs (parsed / applied /
        // finished / failed / canceled) so live-progress views stayed
        // visible mid-parse. UX feedback 2026-05-30: clicking Upload
        // Files while a parse is still completing also opens stale
        // "Parsing complete" data, which is confusing — the coordinator
        // clicked Upload Files because they want to upload, not watch a
        // run finish. The Parse step is still reachable via the
        // wizard's sidebar step picker if they want to switch back.
        //
        // startOver() preserves submissionId + programLevel and never
        // touches persisted review items (CR-043 moved Review to its own
        // standalone surface backed by Submission.aiReviewState).
        startOver();
        setActiveView('ai-import');
      }}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
        !canImport
          ? 'text-gray-300 cursor-not-allowed'
          : activeView === 'ai-import' ? 'bg-teal-100 text-teal-700' : 'text-gray-600 hover:bg-gray-100'
      }`}
      title={canImport
        ? 'Upload Files — drag or select your self-study document(s) and let the AI parse, tag, and place the content. This is step 1 of the guided import.'
        : 'A superuser must impersonate a Program Coordinator to import. Use Switch Role to view as a PC, then upload.'}
    >
      <Upload className="w-4 h-4 flex-shrink-0" />
      Upload Files
      {/* CR-045 — the "AI" badge only appears when the legacy importer is
          also visible (the two need disambiguating). When legacy is
          hidden, this is the only importer and the badge is just noise. */}
      {showAiBadge && (
        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
          AI
        </span>
      )}
      {badge && (
        <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>
          {badge.text}
        </span>
      )}
    </button>
  );
}

/**
 * CR-043 — Review toolbar button. Enabled iff aiReviewState has any
 * content (buckets / tags / cvs / evidenceDocs / introductions). The
 * client store mirrors aiReviewState; we check those fields directly
 * so the button updates the moment the parser merge writes new items.
 */
function ReviewSurfaceButton({
  activeView,
  setActiveView
}: {
  activeView: 'standards' | 'curriculum' | 'files' | 'introduction' | 'ai-import' | 'review-surface' | 'matrix-surface' | 'lead-reader-report';
  setActiveView: (v: 'standards' | 'curriculum' | 'files' | 'introduction' | 'ai-import' | 'review-surface' | 'matrix-surface' | 'lead-reader-report') => void;
}) {
  const buckets = useAIImportStore((s) => s.buckets);
  const tags = useAIImportStore((s) => s.tags);
  const cvs = useAIImportStore((s) => s.cvs);
  const evidenceDocs = useAIImportStore((s) => s.evidenceDocs);
  const introductions = useAIImportStore((s) => s.introductions);
  const approvedIds = useAIImportStore((s) => s.approvedIds);

  // Disabled iff every kind is empty (no parser-produced content yet)
  // OR everything has been approved + applied (then disabled until the
  // next parse adds new content).
  const hasContent =
    Object.values(buckets).some(
      (b) => b.narratives.length || b.evidenceText.length || b.evidenceFiles.length
    ) ||
    tags.length > 0 ||
    cvs.length > 0 ||
    evidenceDocs.length > 0 ||
    Object.values(introductions).some((ib) => ib.items?.length);
  const disabled = !hasContent;

  return (
    <button
      onClick={() => !disabled && setActiveView('review-surface')}
      disabled={disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
        disabled
          ? 'text-gray-400 cursor-not-allowed'
          : activeView === 'review-surface'
            ? 'bg-cshse-100 text-cshse-700'
            : 'text-gray-600 hover:bg-gray-100'
      }`}
      title={
        disabled
          ? 'Review enables once the wizard parses content'
          : 'Review — persists across imports; approve to push items into the editor'
      }
    >
      <Sparkles className="w-4 h-4 flex-shrink-0" />
      Review
      {hasContent && (
        <span className="rounded bg-cshse-100 px-1.5 py-0.5 text-[10px] font-semibold text-cshse-700">
          ready
        </span>
      )}
      {approvedIds.length > 0 && (
        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
          {approvedIds.length} approved
        </span>
      )}
    </button>
  );
}

function MatrixSurfaceButton({
  activeView,
  setActiveView
}: {
  activeView: 'standards' | 'curriculum' | 'files' | 'introduction' | 'ai-import' | 'review-surface' | 'matrix-surface' | 'lead-reader-report';
  setActiveView: (v: 'standards' | 'curriculum' | 'files' | 'introduction' | 'ai-import' | 'review-surface' | 'matrix-surface' | 'lead-reader-report') => void;
}) {
  const matrices = useAIImportStore((s) => s.matrices);
  const hasContent = matrices.length > 0;
  return (
    <button
      onClick={() => hasContent && setActiveView('matrix-surface')}
      disabled={!hasContent}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
        !hasContent
          ? 'text-gray-400 cursor-not-allowed'
          : activeView === 'matrix-surface'
            ? 'bg-cshse-100 text-cshse-700'
            : 'text-gray-600 hover:bg-gray-100'
      }`}
      title={
        !hasContent
          ? 'Matrix enables once a parsed import produces curriculum matrices'
          : 'Matrix — edit row mappings; survives wizard close'
      }
    >
      <Grid3X3 className="w-4 h-4 flex-shrink-0" />
      Matrix
      {hasContent && (
        <span className="rounded bg-cshse-100 px-1.5 py-0.5 text-[10px] font-semibold text-cshse-700">
          {matrices.length}
        </span>
      )}
    </button>
  );
}

// Count the UN-TRIAGED items waiting in Review (drafts) for a given
// AI-import store snapshot — buckets (narratives + evidence text +
// evidence files) plus tags, CVs, evidence docs and introduction items.
// CR-048: an item is "pending" until it's approved (→ applied, leaves the
// state) or discarded (→ explicitly excluded, incl. via "Finish review").
// So the count excludes anything in approvedIds or discardedIds. Shared by
// the DRAFTS badge (reactive) and the initial-view decision (synchronous).
function computeDraftsCount(s: {
  buckets?: Record<string, any> | null;
  tags?: any[] | null;
  cvs?: any[] | null;
  evidenceDocs?: any[] | null;
  introductions?: Record<string, any> | null;
  approvedIds?: string[] | null;
  discardedIds?: string[] | null;
}): number {
  const approved = new Set(s.approvedIds || []);
  const discarded = new Set(s.discardedIds || []);
  const isUnresolved = (it: any): boolean =>
    !!it?.sectionId && !approved.has(it.sectionId) && !discarded.has(it.sectionId);
  let n = 0;
  for (const b of Object.values(s.buckets || {}) as any[]) {
    n += (b?.narratives || []).filter(isUnresolved).length;
    n += (b?.evidenceText || []).filter(isUnresolved).length;
    n += (b?.evidenceFiles || []).filter(isUnresolved).length;
  }
  n += (s.tags || []).filter(isUnresolved).length;
  n += (s.cvs || []).filter(isUnresolved).length;
  n += (s.evidenceDocs || []).filter(isUnresolved).length;
  for (const ib of Object.values(s.introductions || {}) as any[]) {
    n += (ib?.items || []).filter(isUnresolved).length;
  }
  return n;
}

export function SelfStudyEditor({ submissionId, userRole = 'program_coordinator', userId, userName }: SelfStudyEditorProps) {
  const isProgramCoordinator = userRole === 'program_coordinator';
  const isReviewer = userRole === 'reader' || userRole === 'lead_reader';
  const isReadOnly = !isProgramCoordinator;
  // A non-impersonating superuser cannot import (server enforces requireCanImport).
  const _authUser = useAuthStore((s) => s.user);
  // CR-073 Parser Train — the review panel is a SUPERUSER verification surface for
  // training runs. A superuser opens the SAME ReviewSurface/ReviewStep the PC uses
  // (parsed cards per section + Compare) WITHOUT assuming the PC role. Everything
  // that gates the review/import surfaces on the PC role also allows the SU here.
  const _isSuperuser = _authUser?.isSuperuser === true;
  const canReviewSurface = isProgramCoordinator || _isSuperuser;
  const _isImpersonating = useAuthStore((s) => s.impersonation.isImpersonating);
  const canImport = !(_authUser?.isSuperuser === true && !_isImpersonating);
  // Lead Reader Report — a board-facing document distinct from the reader
  // report. Visible only to the assigned lead reader, admins and superusers.
  // (The server also enforces this; the nav gate just hides the entry point.)
  const canViewLeadReaderReport =
    userRole === 'lead_reader' || userRole === 'admin' || _authUser?.isSuperuser === true;

  // CR-045 — per-PC preference: hide the legacy paste-and-tag importer.
  // Defaults true (clean single-importer toolbar) when the user has no
  // saved preference.
  // CR-059 — the legacy per-standard "Import Document" importer is replaced by
  // the standalone Import-file drawer (showImportFile). Its toolbar button and
  // the "Hide legacy importer" settings toggle are removed.
  const [showImportFile, setShowImportFile] = useState(false);
  // The mounted narrative / introduction editors register their imperative
  // insert here (CR-059) so the Import-file panel can paste a selected section
  // into whichever surface is active. Refs (not state) — set on editor mount.
  const narrativeInsertRef = useRef<((html: string) => void) | null>(null);
  const docIntroInsertRef = useRef<((html: string) => void) | null>(null);
  // Force-save handles for the currently-mounted editors, flushed before Final
  // Submit locks the submission so a last unsaved edit isn't lost to the lock.
  const narrativeFlushRef = useRef<(() => Promise<void>) | null>(null);
  const docIntroFlushRef = useRef<(() => Promise<void>) | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedStandard, setSelectedStandard] = useState('1');
  const [selectedSpec, setSelectedSpec] = useState<string | null>('a');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<'standards' | 'curriculum' | 'files' | 'introduction' | 'ai-import' | 'review-surface' | 'matrix-surface' | 'lead-reader-report'>(() => {
    // Open the editor on the step that matches where the PC is in the
    // IMPORT → DRAFTS → SELF-STUDY → SUBMIT workflow. When un-applied
    // drafts are still waiting in Review (an import has parsed but its
    // items haven't been applied to the self-study yet), land on the
    // Review surface (phase 2 DRAFTS) rather than Standards (phase 3) so
    // the PC follows the workflow order instead of being dropped past it.
    //
    // The AI-import store is hydrated synchronously from localStorage on
    // app boot, so this read is reliable in the common (same-session)
    // case with no view flicker. A CR-047 deep-link (?view=...) takes
    // precedence and is handled by the deepLink effect below, so we defer
    // to 'standards' whenever a view param is present.
    try {
      const viewParam =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('view')
          : null;
      const hasViewParam = !!viewParam;
      // A view param in the URL (a deep-link OR a reload that preserved the
      // last view — see the sync effect below) RESTORES that surface, so a hard
      // refresh keeps the user where they were instead of dropping them on
      // Standards.
      if (viewParam === 'standards') return 'standards';
      if (viewParam === 'curriculum' || viewParam === 'matrix') return 'curriculum';
      if (viewParam === 'matrix-surface') return 'matrix-surface';
      if (viewParam === 'files') return 'files';
      if (viewParam === 'introduction') return 'introduction';
      if (canViewLeadReaderReport && viewParam === 'lead-reader-report') return 'lead-reader-report';
      if (canReviewSurface && viewParam === 'review') return 'review-surface';
      if (isProgramCoordinator && viewParam === 'import') return 'ai-import';
      if (isProgramCoordinator && submissionId && !hasViewParam) {
        const s = useAIImportStore.getState();
        // CR-048 — open on Review only when UN-TRIAGED drafts remain.
        // Once the PC has approved/discarded everything (incl. via "Finish
        // review"), the count is 0 and we drop them on Standards.
        if (s.submissionId === submissionId && computeDraftsCount(s) > 0) {
          return 'review-surface';
        }
      }
    } catch {
      /* no window / SSR — fall through to standards */
    }
    return 'standards';
  });

  // CR-043 — wizard's Parse step dispatches `cr-043-open-review-surface`
  // when the PC clicks "Next: Review" so the wizard hands off to the
  // persisted Review surface (instead of routing to the wizard's
  // internal Review tab). Listener lives on the editor since it owns
  // activeView.
  useEffect(() => {
    const handler = () => setActiveView('review-surface');
    window.addEventListener('cr-043-open-review-surface', handler);
    return () => window.removeEventListener('cr-043-open-review-surface', handler);
  }, []);

  // Focus mode — the work area (spec rail + editor/review) takes over the whole
  // viewport, hiding the editor chrome (wizard + toolbar) AND the app nav, to
  // recover vertical space on small / low-resolution laptop screens. Esc exits.
  const [focusMode, setFocusMode] = useState(false);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusMode(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode]);
  // A compact toolbar menu (hamburger) at narrow widths so the button rows stop
  // stacking into tall chrome. Open/close state for the dropdown.
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);

  // 2026-06-06 — review state lives on the server now (not localStorage), so
  // hydrate the store from Submission.aiReviewState on editor mount. Without
  // this the toolbar Review button + draft counts would read an empty store on
  // a fresh load/reload (localStorage no longer carries buckets/tags/etc.).
  // Idempotent with ReviewSurface's own load; both read the same server state.
  useEffect(() => {
    if (!canReviewSurface || !submissionId) return;
    const store = useAIImportStore.getState();
    store.setSubmissionId(submissionId);
    void store.loadPersistedReviewState();
  }, [isProgramCoordinator, submissionId]);

  // 2026-06-07 (user-reported: "approved items not moved into the spec editor")
  // — Approving an item POSTs set-approved, which materializes the approved
  // text into Submission.narratives server-side. But approval flows entirely
  // through the Zustand store, which can't touch the react-query ['submission']
  // cache that this editor reads `narrativeContent` from. So without this
  // bridge, an approval landed on the server but the spec editor kept showing
  // its stale cached copy until a hard reload. We subscribe to the store's
  // `reviewMaterializedAt` counter (bumped once set-approved confirms) and
  // invalidate + refetch the submission, then bump editorRefreshKey so the
  // mounted NarrativeEditor remounts with the freshly-materialized content.
  useEffect(() => {
    if (!submissionId) return;
    let last = useAIImportStore.getState().reviewMaterializedAt;
    const unsub = useAIImportStore.subscribe((state) => {
      if (state.reviewMaterializedAt === last) return;
      last = state.reviewMaterializedAt;
      void queryClient
        .invalidateQueries({ queryKey: ['submission', submissionId] })
        .then(() => {
          // Remount the editor(s) so the currently-viewed spec picks up the
          // new narrative content even if the user is already on it.
          setEditorRefreshKey((prev) => prev + 1);
        });
      // The dashboard DRAFTS / workflow-summary also reflect approvals.
      queryClient.invalidateQueries({ queryKey: ['workflow-summary', submissionId] });
      // Approving now also applies curriculum matrices (server-side) — refresh
      // the Curriculum Matrix view so they appear without a manual reload.
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });
    });
    return unsub;
  }, [submissionId, queryClient]);

  // CR-047 — deep-link from the PC dashboard's DRAFTS tiles. A tile/row
  // navigates here with `?view=review[&specKey=<rail key>]`; on mount we
  // open the Review surface and pre-select the matching rail entry
  // (synthetic kinds like `_cvs` / `_evidence-docs:syllabus`, or a real
  // spec key like `1.a`). selectSpec persists in the store, so it survives
  // ReviewSurface's loadPersistedReviewState() call.
  const [deepLinkParams, setDeepLinkParams] = useSearchParams();
  useEffect(() => {
    if (!submissionId) return;
    const view = deepLinkParams.get('view');
    // Section deep-links work for EVERY role (readers/lead-readers navigate
    // here from the Reader Report screen's top menu — see ReaderReportEditor).
    // Optional spec target for deep-links into the file library / matrix
    // (the Reader Report screen links "Open files for 1.a" etc.).
    const dlStd = deepLinkParams.get('std');
    const dlSpec = deepLinkParams.get('spec');
    if (view === 'introduction') {
      setActiveView('introduction');
    } else if (view === 'standards') {
      setActiveView('standards');
    } else if (view === 'curriculum' || view === 'matrix') {
      setActiveView('curriculum');
      if (dlStd && dlSpec) setMatrixScrollTarget({ std: dlStd, spec: dlSpec });
    } else if (view === 'files') {
      setActiveView('files');
      if (dlStd && dlSpec) setFileScrollTarget({ std: dlStd, spec: dlSpec });
    } else if (canViewLeadReaderReport && view === 'lead-reader-report') {
      setActiveView('lead-reader-report');
    } else if (canReviewSurface && view === 'review') {
      setActiveView('review-surface');
      const specKey = deepLinkParams.get('specKey');
      if (specKey) {
        useAIImportStore.getState().selectSpec(specKey);
      }
    } else if (isProgramCoordinator && view === 'import') {
      setActiveView('ai-import');
    } else {
      return;
    }
    // Strip the ONE-TIME targets (specKey + scroll anchors) so they don't
    // re-fire on refresh/Back, but KEEP `view` so a hard reload restores the
    // surface the user was on (the sync effect below keeps it current).
    const next = new URLSearchParams(deepLinkParams);
    next.delete('specKey');
    next.delete('std');
    next.delete('spec');
    setDeepLinkParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL's `?view=` in sync with the active surface so a hard reload
  // (incl. the ErrorBoundary's "Reload this view") lands back on the SAME view
  // instead of the Standards default. Uses replaceState so it doesn't churn the
  // router or add history entries.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const param =
      activeView === 'review-surface'
        ? 'review'
        : activeView === 'ai-import'
        ? 'import'
        : activeView === 'matrix-surface'
        ? 'matrix-surface'
        : activeView;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('view') !== param) {
      sp.set('view', param);
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}?${sp.toString()}`
      );
    }
  }, [activeView]);
  // When the user clicks "View in matrix" from a spec, we stash the target
  // (std, spec) here and switch to the curriculum view. CurriculumMatrixEditor
  // consumes the target via `scrollToSpec` and clears the state after it has
  // scrolled+highlighted the row.
  const [matrixScrollTarget, setMatrixScrollTarget] = useState<
    { std: string; spec: string } | null
  >(null);
  // Same idea for the Supporting File Library — a reader can jump from a spec on
  // the Reader Report straight to that spec's files/links in the library.
  const [fileScrollTarget, setFileScrollTarget] = useState<
    { std: string; spec: string } | null
  >(null);

  // Reviewer comment state
  const [highlightedComment, setHighlightedComment] = useState<{ id: string; selectedText: string } | null>(null);
  const [editorSelection, setEditorSelection] = useState<{ text: string; from: number; to: number } | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [newCommentContent, setNewCommentContent] = useState('');

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [importStep, setImportStep] = useState<'upload' | 'processing' | 'manual_tagging' | 'section_selection' | 'review' | 'applying'>('upload');

  // Session persistence - resume existing import
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [existingImportInfo, setExistingImportInfo] = useState<{
    id: string;
    status: string;
    originalFilename: string;
    uploadedAt: string;
    taggedSectionsCount: number;
  } | null>(null);
  const [isCheckingExistingImport, setIsCheckingExistingImport] = useState(false);
  const [isDiscardingImport, setIsDiscardingImport] = useState(false);
  const [extractedSections, setExtractedSections] = useState<ExtractedSection[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  // State for managing unmapped section assignments
  const [unmappedAssignments, setUnmappedAssignments] = useState<Record<string, UnmappedAssignment>>({});
  const [movingSection, setMovingSection] = useState<string | null>(null);

  // Batch assignment state for sections (both mapped and unmapped)
  const [selectedSectionIds, setSelectedSectionIds] = useState<Set<string>>(new Set());
  const [batchAssignment, setBatchAssignment] = useState<UnmappedAssignment>({
    standardCode: '',
    specCode: '',
    toSupportingEvidence: false,
    toCurriculumMatrix: false
  });
  const [isBatchMoving, setIsBatchMoving] = useState(false);

  // State for viewing full section content
  const [expandedSection, setExpandedSection] = useState<ExtractedSection | null>(null);
  const [loadingFullContent, setLoadingFullContent] = useState(false);

  // Part 6: State for section selection before AI processing
  const [detectedSections, setDetectedSections] = useState<DetectedSection[]>([]);
  const [appendixSection, setAppendixSection] = useState<DetectedSection | null>(null);
  const [isConfirmingSelections, setIsConfirmingSelections] = useState(false);
  const [viewingFullSection, setViewingFullSection] = useState<DetectedSection | null>(null);

  // Manual Tagging Workflow State
  const [documentHtml, setDocumentHtml] = useState<string>('');
  const [isLoadingDocument, setIsLoadingDocument] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [taggedSections, setTaggedSections] = useState<TaggedSection[]>([]);
  const [showTaggedSections, setShowTaggedSections] = useState(false);
  const [sectionTaggerCollapsed, setSectionTaggerCollapsed] = useState(false);

  // Mutually exclusive accordion toggles
  const toggleSectionTagger = () => {
    const willOpen = sectionTaggerCollapsed;
    setSectionTaggerCollapsed(!sectionTaggerCollapsed);
    if (willOpen) setShowTaggedSections(false); // close tagged when tagger opens
  };
  const toggleTaggedSections = () => {
    const willOpen = !showTaggedSections;
    setShowTaggedSections(willOpen);
    if (willOpen) setSectionTaggerCollapsed(true); // close tagger when tagged opens
  };
  const [isLoadingTaggedSections, setIsLoadingTaggedSections] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<SelectionData | null>(null);
  const documentViewerRef = useRef<HTMLDivElement>(null);
  const [isSavingSection, setIsSavingSection] = useState(false);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [deletingSectionId, setDeletingSectionId] = useState<string | null>(null);
  const [applyingSectionId, setApplyingSectionId] = useState<string | null>(null);
  const [viewingTaggedSection, setViewingTaggedSection] = useState<TaggedSection | null>(null);
  const [viewingFullContent, setViewingFullContent] = useState<string | null>(null);
  const [viewingHtmlContent, setViewingHtmlContent] = useState<string | null>(null); // HTML content for formatting
  const [isLoadingFullContent, setIsLoadingFullContent] = useState(false);
  // Repair document state
  const repairFileInputRef = useRef<HTMLInputElement>(null);
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairMessage, setRepairMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  // Track last saved section to trigger placeholder insertion in DocumentViewer
  const [lastSavedSection, setLastSavedSection] = useState<SavedSectionInfo | null>(null);
  // Version counter to force NarrativeEditor remount when content is externally applied
  const [editorRefreshKey, setEditorRefreshKey] = useState(0);

  // Fetch submission data
  const { data: submission, isLoading: loadingSubmission, isError: submissionError, error: submissionErrorDetails } = useQuery<SubmissionData>({
    queryKey: ['submission', submissionId],
    queryFn: async () => {
      const response = await api.get(`/api/submissions/${submissionId}`);
      return response.data;
    },
    // 2026-06-09 — the editor reads `narrativeContent` from this query. The
    // global 5-minute staleTime meant that after approved items were
    // materialized server-side (e.g. via Apply / a heal), an already-open
    // editor tab kept serving the STALE (pre-materialize) submission and the
    // spec editors looked empty until a hard reload. Force this specific query
    // to always refetch on mount and treat its data as immediately stale so the
    // editor reliably reflects the latest materialized narratives.
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Mirror the submission's Parser-Train flag into the AI-import store so the
  // Compare pane can show the "Flag out-of-sync" control on sandbox runs.
  useEffect(() => {
    useAIImportStore.getState().setTrainingRun(!!(submission as any)?.trainingRun);
  }, [submission]);

  // 2026-06-09 — "Validate All": background AI-evaluation queue. The button
  // enqueues every spec-with-content server-side; this query polls progress
  // while a job runs so the UI shows "Validating X/Y" without blocking.
  const { data: evalProgress } = useQuery<{ total: number; remaining: number; done: number; running: boolean }>({
    queryKey: ['eval-progress', submissionId],
    queryFn: async () => (await api.get(`/api/submissions/${submissionId}/review/eval-progress`)).data,
    enabled: !!submissionId && isProgramCoordinator,
    refetchInterval: (q: any) => (q?.state?.data?.running ? 3000 : false),
    refetchOnWindowFocus: false,
  });
  const validateAllMutation = useMutation({
    mutationFn: async () => (await api.post(`/api/submissions/${submissionId}/review/evaluate-all`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eval-progress', submissionId] }),
  });
  // When the queue finishes, refresh verdicts + the Validated counter.
  const prevEvalRunningRef = useRef(false);
  useEffect(() => {
    const running = !!evalProgress?.running;
    if (prevEvalRunningRef.current && !running) {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['validation', submissionId] });
      setEditorRefreshKey((prev) => prev + 1);
    }
    prevEvalRunningRef.current = running;
  }, [evalProgress?.running, queryClient, submissionId]);

  // Fetch standards definitions for THIS submission's degree level (associate /
  // baccalaureate / masters). The official CSHSE standards differ by level, so
  // titles + criteria must match the institution's declared programLevel; the
  // server resolves the level from the submission.
  const { data: standards, isLoading: loadingStandards, isError: standardsError } = useQuery<StandardDefinition[]>({
    queryKey: ['standards', submissionId],
    queryFn: async () => {
      const response = await api.get(`/api/standards`, { params: { submissionId } });
      return response.data;
    },
  });

  // Reader Report files (PDF + editable DOCX) from the Supporting File Library,
  // so readers/PCs can view/download the compiled report from the toolbar.
  const reportFilesQuery = useQuery({
    queryKey: ['ss-reader-report-files', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/evidence`);
      const items: any[] = r.data?.evidence || r.data?.items || (Array.isArray(r.data) ? r.data : []);
      const pick = (tag: string) => {
        const it = items.find((i) => (i.tags || []).includes(tag));
        return it ? { id: it._id as string, name: (it.file?.originalName as string) || 'Reader-Report' } : undefined;
      };
      return { pdf: pick('reader-report:pdf'), docx: pick('reader-report:docx') };
    },
    enabled: !!submissionId,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const reportFiles = reportFilesQuery.data;
  const downloadReport = useCallback(async (evidenceId: string, fileName: string) => {
    try {
      const resp = await api.get(`/api/submissions/${submissionId}/evidence/${evidenceId}/download`, { responseType: 'blob' });
      const blob = new Blob([resp.data], { type: resp.headers['content-type'] || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName || 'Reader-Report';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch { /* file not ready — button no-ops */ }
  }, [submissionId]);

  // Fetch reviewer's scores for this submission (reviewers only)
  const { data: scoresData } = useQuery<{ scores: { standardCode: string; specCode: string; score: number }[] }>({
    queryKey: ['scores', submissionId],
    queryFn: async () => {
      const response = await api.get(`/api/submissions/${submissionId}/scores`);
      return response.data;
    },
    enabled: isReviewer,
  });

  // Fetch comment summary for this submission (reviewers only)
  const { data: commentSummary } = useQuery<{ total: number; unresolved: number }>({
    queryKey: ['comment-summary', submissionId, selectedStandard, selectedSpec],
    queryFn: async () => {
      const params = new URLSearchParams({ standardCode: selectedStandard });
      if (selectedSpec) params.append('specCode', selectedSpec);
      const response = await api.get(`/api/submissions/${submissionId}/comments/summary?${params}`);
      return response.data;
    },
    enabled: isReviewer,
  });

  // Score mutation (upsert)
  const scoreMutation = useMutation({
    mutationFn: async ({ standardCode, specCode, score }: { standardCode: string; specCode: string; score: number }) => {
      await api.put(`/api/submissions/${submissionId}/scores`, { standardCode, specCode, score });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores', submissionId] });
    },
  });

  // Score delete mutation (clear score = "-")
  const scoreDeleteMutation = useMutation({
    mutationFn: async ({ standardCode, specCode }: { standardCode: string; specCode: string }) => {
      await api.delete(`/api/submissions/${submissionId}/scores`, { data: { standardCode, specCode } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scores', submissionId] });
    },
  });

  // Get current score for active substandard
  const currentScore = scoresData?.scores?.find(
    (s) => s.standardCode === selectedStandard && s.specCode === selectedSpec
  );

  // Fetch global comment summary for Prev/Next navigation (reviewers only)
  const { data: globalCommentSummary } = useQuery<{
    total: number;
    unresolved: number;
    bySection: { standardCode: string; specCode: string; count: number }[];
  }>({
    queryKey: ['comments-summary', submissionId],
    queryFn: async () => {
      const response = await api.get(`/api/submissions/${submissionId}/comments/summary`);
      return response.data;
    },
    enabled: isReviewer,
  });

  // Compute Prev/Next comment navigation
  const commentSections = globalCommentSummary?.bySection || [];
  const currentCommentSectionIdx = commentSections.findIndex(
    (s) => s.standardCode === selectedStandard && s.specCode === selectedSpec
  );
  const hasPrevComment = currentCommentSectionIdx > 0;
  const hasNextComment = currentCommentSectionIdx !== -1
    ? currentCommentSectionIdx < commentSections.length - 1
    : commentSections.length > 0;

  const navigateToCommentSection = useCallback((direction: 'prev' | 'next') => {
    if (commentSections.length === 0) return;
    let targetIdx: number;
    if (currentCommentSectionIdx === -1) {
      targetIdx = direction === 'next' ? 0 : commentSections.length - 1;
    } else {
      targetIdx = direction === 'prev' ? currentCommentSectionIdx - 1 : currentCommentSectionIdx + 1;
    }
    if (targetIdx >= 0 && targetIdx < commentSections.length) {
      const target = commentSections[targetIdx];
      setSelectedStandard(target.standardCode);
      setSelectedSpec(target.specCode || null);
    }
  }, [commentSections, currentCommentSectionIdx]);

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async (data: {
      selectedText: string;
      selectionStart: number;
      selectionEnd: number;
      content: string;
    }) => {
      const response = await api.post(
        `/api/submissions/${submissionId}/comments`,
        {
          standardCode: selectedStandard,
          specCode: selectedSpec,
          ...data,
        }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', submissionId, selectedStandard, selectedSpec] });
      queryClient.invalidateQueries({ queryKey: ['comment-summary', submissionId, selectedStandard, selectedSpec] });
      queryClient.invalidateQueries({ queryKey: ['comments-summary', submissionId] });
      setShowCommentModal(false);
      setNewCommentContent('');
      setEditorSelection(null);
    },
  });

  // Save narrative mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      standardCode,
      specCode,
      content,
    }: {
      standardCode: string;
      specCode: string;
      content: string;
    }) => {
      await api.patch(`/api/submissions/${submissionId}/narrative`, {
        standardCode,
        specCode,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Save supporting evidence mutation
  const saveSupportingEvidenceMutation = useMutation({
    mutationFn: async ({
      standardCode,
      specCode,
      supportingEvidenceText,
    }: {
      standardCode: string;
      specCode: string;
      supportingEvidenceText: string;
    }) => {
      await api.patch(`/api/submissions/${submissionId}/narrative`, {
        standardCode,
        specCode,
        supportingEvidenceText,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Submit standard mutation (for individual standard validation)
  const submitStandardMutation = useMutation({
    mutationFn: async (standardCode: string) => {
      const response = await api.post(
        `/api/submissions/${submissionId}/standards/${standardCode}/submit`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Submit entire self-study mutation (locks submission for review).
  // Accepts an optional submissionNote — the PC's confirm-modal message.
  // Persisted on the final-submit audit-log entry.
  const submitSelfStudyMutation = useMutation({
    mutationFn: async (args?: { submissionNote?: string; override?: { reason: string }; needsImprovementNotes?: NeedsImprovementNote[] }) => {
      const response = await api.post(`/api/submissions/${submissionId}/submit`, {
        submissionNote: args?.submissionNote ?? '',
        // AACC (Nicole) — the PC's per-spec notes on each "Needs Improvement"
        // finding; the server writes them as Program-Coordinator comments.
        needsImprovementNotes: args?.needsImprovementNotes ?? [],
        // CR-008 / S10.3 — override-with-reason. Only sent when the PC chose to
        // submit despite blocking preflight errors; the server records a
        // dedicated `submission.final_submit_override` audit event.
        ...(args?.override
          ? { override: true, overrideReason: args.override.reason }
          : {})
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    },
  });

  // Poll import status
  useEffect(() => {
    if (!importId || importStep !== 'processing') return;

    console.log('[Import Poll] Starting polling for import:', importId);

    const pollInterval = setInterval(async () => {
      try {
        const response = await api.get(`/api/imports/${importId}`);
        const status = response.data as ImportStatus;
        console.log('[Import Poll] Status received:', status.status, {
          progress: status.progress,
          mappedCount: status.mappedCount,
          unmappedCount: status.unmappedCount
        });
        setImportStatus(status);

        if (status.status === 'awaiting_selection') {
          // Manual Tagging Workflow: Load document for visual tagging
          console.log('[Import Poll] Status is awaiting_selection - loading document for manual tagging');
          clearInterval(pollInterval);
          try {
            // Load document HTML content from temp file
            const contentResponse = await api.get(`/api/imports/${importId}/content`);
            console.log('[Import Poll] Document content loaded:', {
              htmlLength: contentResponse.data.htmlContent?.length || 0
            });
            setDocumentHtml(contentResponse.data.htmlContent || '');

            // Load any already tagged sections
            const taggedResponse = await api.get(`/api/imports/${importId}/tagged-sections`);
            console.log('[Import Poll] Tagged sections loaded:', {
              count: taggedResponse.data.sections?.length || 0
            });
            setTaggedSections(taggedResponse.data.sections || []);

            setImportStep('manual_tagging');
            console.log('[Import Poll] Transitioned to manual_tagging step');
          } catch (loadErr: any) {
            console.error('[Import Poll] Failed to load document for manual tagging:', loadErr);
            setUploadError(loadErr.response?.data?.error || 'Failed to load document content');
          }
        } else if (status.status === 'completed') {
          console.log('[Import Poll] Status is completed - fetching extracted sections');
          clearInterval(pollInterval);
          const sectionsResponse = await api.get(`/api/imports/${importId}/sections`);
          setExtractedSections(sectionsResponse.data.sections);
          setImportStep('review');
        } else if (status.status === 'failed') {
          console.log('[Import Poll] Status is failed:', status.error);
          clearInterval(pollInterval);
          setUploadError(status.error || 'Document processing failed');
          setImportStep('upload');
        } else {
          console.log('[Import Poll] Status is still:', status.status);
        }
      } catch (err) {
        console.error('[Import Poll] Failed to poll import status:', err);
      }
    }, 2000);

    return () => {
      console.log('[Import Poll] Stopping polling');
      clearInterval(pollInterval);
    };
  }, [importId, importStep]);

  // Auto-load document content and tagged sections when resuming a manual_tagging session
  // This handles the case where the user resumes an import (importStep set directly to manual_tagging)
  useEffect(() => {
    if (importStep === 'manual_tagging' && importId && !documentHtml && !isLoadingDocument && !documentError) {
      console.log('[SelfStudyEditor] Auto-loading document content for resumed import');
      loadDocumentContent();
      loadTaggedSections();
    }
  }, [importStep, importId, documentHtml, isLoadingDocument, documentError]);

  // Import handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUploadImport = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('submissionId', submissionId);

      const response = await api.post('/api/imports/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setImportId(response.data.importId);
      setImportStep('processing');
      setSelectedFile(null);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyMappings = async () => {
    if (!importId) return;

    setIsApplying(true);
    try {
      await api.post(`/api/imports/${importId}/apply`);
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
      resetImportModal();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to apply mappings');
    } finally {
      setIsApplying(false);
    }
  };

  const handleCancelImport = async () => {
    if (!importId) return;
    if (!window.confirm('Are you sure you want to cancel this import? All progress will be lost.')) return;

    setIsCancelling(true);
    try {
      await api.post(`/api/imports/${importId}/cancel`);
      resetImportModal();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to cancel import');
    } finally {
      setIsCancelling(false);
    }
  };

  const resetImportModal = () => {
    setShowImportModal(false);
    setSelectedFile(null);
    setUploadError(null);
    setImportId(null);
    setImportStatus(null);
    setImportStep('upload');
    setExtractedSections([]);
    setUnmappedAssignments({});
    setMovingSection(null);
    // Reset batch assignment state
    setSelectedSectionIds(new Set());
    setBatchAssignment({ standardCode: '', specCode: '', toSupportingEvidence: false, toCurriculumMatrix: false });
    setIsBatchMoving(false);
    // Reset Part 6 section selection state
    setDetectedSections([]);
    setAppendixSection(null);
    setViewingFullSection(null);
    // Reset manual tagging state
    setDocumentHtml('');
    setDocumentError(null);
    setTaggedSections([]);
    setCurrentSelection(null);
    setSectionError(null);
    setViewingTaggedSection(null);
    // Reset resume dialog state
    setShowResumeDialog(false);
    setExistingImportInfo(null);
  };

  // Check for existing in-progress import when user clicks Import Document
  // Auto-resumes if found - no dialog needed
  const handleImportButtonClick = async () => {
    setIsCheckingExistingImport(true);
    setUploadError(null);

    try {
      const response = await api.get(`/api/imports/check/${submissionId}`);

      if (response.data.hasExistingImport) {
        // Found an existing import - auto-resume directly (no dialog)
        const existingImport = response.data.import;
        setExistingImportInfo(existingImport);
        setImportId(existingImport.id);
        setShowImportModal(true);
        setImportStep('manual_tagging');
        // Document content and tagged sections will be loaded by useEffect
      } else {
        // No existing import - show fresh upload modal
        setShowImportModal(true);
        setImportStep('upload');
      }
    } catch (err: any) {
      // If check fails, just show the upload modal
      console.error('Failed to check for existing import:', err);
      setShowImportModal(true);
      setImportStep('upload');
    } finally {
      setIsCheckingExistingImport(false);
    }
  };

  // Save progress and exit - closes the import panel
  // All progress is already persisted:
  //   - Tagged sections → saved to MongoDB during each extraction
  //   - HTML comment markers → inserted into GridFS during each extraction
  //   - Document HTML → in GridFS with markers embedded
  const handleSaveProgressAndExit = () => {
    console.log(`[SelfStudyEditor] Save & Exit — All data already persisted. ` +
      `Tagged sections: ${taggedSections.length}, importId: ${importId}`);
    setShowImportModal(false);
    // Don't reset importId or other state - preserve for next time
    // Just close the modal
  };

  // Start over - discard existing import and show upload screen
  const handleStartOver = async () => {
    const idToDiscard = importId || existingImportInfo?.id;
    if (!idToDiscard) return;

    setIsDiscardingImport(true);

    try {
      await api.delete(`/api/imports/${idToDiscard}/discard`);

      // Reset all import state and show upload screen
      setImportId(null);
      setExistingImportInfo(null);
      setImportStep('upload');
      setDocumentHtml('');
      setTaggedSections([]);
      setCurrentSelection(null);
      setSectionError(null);
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to discard import');
    } finally {
      setIsDiscardingImport(false);
    }
  };

  // Manual Tagging: Load document content from temp file
  const loadDocumentContent = async () => {
    if (!importId) return;

    setIsLoadingDocument(true);
    setDocumentError(null);

    try {
      const response = await api.get(`/api/imports/${importId}/content`);
      setDocumentHtml(response.data.htmlContent);
    } catch (err: any) {
      setDocumentError(err.response?.data?.error || 'Failed to load document content');
    } finally {
      setIsLoadingDocument(false);
    }
  };

  // Repair document: re-upload original file, re-insert markers, keep tags
  const handleRepairDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importId) return;

    // Reset file input so re-selecting the same file triggers onChange
    e.target.value = '';

    setIsRepairing(true);
    setRepairMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/api/imports/${importId}/repair`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { markersInserted, totalSections } = response.data;
      setRepairMessage({
        type: 'success',
        text: `Document repaired. ${markersInserted}/${totalSections} section markers restored.`,
      });

      // Reload document content to reflect repaired HTML
      await loadDocumentContent();
    } catch (err: any) {
      setRepairMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to repair document',
      });
    } finally {
      setIsRepairing(false);
    }
  };

  // Manual Tagging: Load tagged sections
  const loadTaggedSections = async () => {
    if (!importId) return;

    setIsLoadingTaggedSections(true);

    try {
      const response = await api.get(`/api/imports/${importId}/tagged-sections`);
      setTaggedSections(response.data.sections || []);
    } catch (err: any) {
      console.error('Failed to load tagged sections:', err);
    } finally {
      setIsLoadingTaggedSections(false);
    }
  };

  // Manual Tagging: Handle selection capture from DocumentViewer
  // User selects text by dragging, clicks "Capture Selection" button
  const handleSelectionCapture = useCallback((selection: SelectionData | null) => {
    setCurrentSelection(selection);
    setSectionError(null);
  }, []);

  // Manual Tagging: Clear selection - resets everything
  const handleClearSelection = useCallback(() => {
    setCurrentSelection(null);
    setSectionError(null);
    // Also clear browser selection
    window.getSelection()?.removeAllRanges();
  }, []);

  // Manual Tagging: Handle placeholder insertion
  // After placeholder is visually inserted in the DOM, update local state.
  // The actual GridFS marker insertion is handled by handleSaveSection after the
  // extract-section API call, using the server-side insert-marker endpoint.
  const handlePlaceholderInserted = useCallback(async (updatedHtml: string) => {
    console.log(`[SelfStudyEditor] handlePlaceholderInserted — updating local HTML state (${(updatedHtml.length / 1024 / 1024).toFixed(1)}MB)`);

    // Clear the lastSavedSection state so the placeholder isn't inserted again
    setLastSavedSection(null);

    // Update local state so the current session shows placeholders
    setDocumentHtml(updatedHtml);
  }, []);

  // Manual Tagging: Save section
  // Uses HTML content already captured in SelectionData
  // If applyDirectly is true, saves directly to the submission's narrative (skips N8N)
  const handleSaveSection = async (metadata: SectionMetadata) => {
    if (!importId || !currentSelection) return;

    setIsSavingSection(true);
    setSectionError(null);

    console.log(`[SelfStudyEditor] handleSaveSection START — type=${metadata.sectionType}, title="${metadata.title}", ` +
      `applyDirectly=${metadata.applyDirectly}, textOffset=${currentSelection.textStartOffset}, textLength=${currentSelection.textLength}`);

    try {
      // Selection already contains the HTML - send directly to backend
      const extractedHtml = currentSelection.html;
      const extractedText = currentSelection.text;

      if (!extractedHtml.trim()) {
        throw new Error('No content selected');
      }

      // If applyDirectly is true and we have standard/spec, save directly to submission
      if (metadata.applyDirectly && metadata.standardCode && metadata.specCode) {
        if (metadata.toSupportingEvidence) {
          // Save to supporting evidence text
          await saveSupportingEvidenceMutation.mutateAsync({
            standardCode: metadata.standardCode,
            specCode: metadata.specCode,
            supportingEvidenceText: extractedHtml,
          });
        } else {
          // Save to narrative content
          await saveMutation.mutateAsync({
            standardCode: metadata.standardCode,
            specCode: metadata.specCode,
            content: extractedHtml,
          });
        }

        // Also save to tagged sections for tracking (marked as applied)
        const response = await api.post(`/api/imports/${importId}/extract-section`, {
          htmlContent: extractedHtml,
          sectionType: metadata.toSupportingEvidence ? 'appendix' : 'standard',
          standardCode: metadata.standardCode,
          specCode: metadata.specCode,
          title: metadata.title,
          appliedDirectly: true, // Flag to indicate it was already applied
          textStartOffset: currentSelection.textStartOffset,
          textLength: currentSelection.textLength
        });

        const sectionId = response.data.sectionId || Date.now().toString();
        const sectionTitle = `${metadata.standardCode}.${metadata.specCode} - ${metadata.title}`;
        console.log(`[SelfStudyEditor] Direct apply: section saved to MongoDB, id=${sectionId}`);

        // Insert HTML comment marker into GridFS document (server-side, no size limit)
        if (currentSelection.textStartOffset != null && currentSelection.textLength != null) {
          try {
            console.log(`[SelfStudyEditor] Calling insert-marker API: offset=${currentSelection.textStartOffset}, length=${currentSelection.textLength}`);
            const markerResponse = await api.post(`/api/imports/${importId}/insert-marker`, {
              sectionId,
              title: sectionTitle,
              sectionType: 'standard',
              contentLength: extractedText.length,
              textStartOffset: currentSelection.textStartOffset,
              textLength: currentSelection.textLength
            });
            console.log(`[SelfStudyEditor] insert-marker response:`, markerResponse.data);
          } catch (err: any) {
            console.error('[SelfStudyEditor] Failed to insert marker in GridFS:', err?.response?.data || err.message);
          }
        } else {
          console.warn(`[SelfStudyEditor] No textStartOffset/textLength — cannot insert marker. offset=${currentSelection.textStartOffset}, length=${currentSelection.textLength}`);
        }

        // Set lastSavedSection to trigger visual placeholder insertion in DocumentViewer
        console.log(`[SelfStudyEditor] Setting lastSavedSection to trigger DOM placeholder`);
        setLastSavedSection({
          id: sectionId,
          title: sectionTitle,
          sectionType: 'standard',
          contentLength: extractedText.length
        });

        // Refresh tagged sections list (for sidebar)
        console.log(`[SelfStudyEditor] Refreshing tagged sections list...`);
        await loadTaggedSections();

        // Clear selection state
        setCurrentSelection(null);

        // Refresh submission data FIRST and WAIT for it to complete
        console.log(`[SelfStudyEditor] Refreshing submission data...`);
        await queryClient.refetchQueries({ queryKey: ['submission', submissionId] });

        // Navigate to the applied spec so the editor shows the correct content.
        // This must happen AFTER refetchQueries so the NarrativeEditor mounts with fresh data.
        setSelectedStandard(metadata.standardCode!);
        setSelectedSpec(metadata.specCode!);

        // Defer editor remount to next tick so React processes the navigation state change
        // and useQuery reflects the updated cache before the NarrativeEditor remounts
        await new Promise(resolve => setTimeout(resolve, 0));
        setEditorRefreshKey(prev => prev + 1);

        console.log(`[SelfStudyEditor] handleSaveSection COMPLETE (direct apply) for "${sectionTitle}"`);
        return;
      }

      // Normal flow: Send extracted HTML to backend for N8N processing later
      console.log(`[SelfStudyEditor] Normal flow: saving section to MongoDB via extract-section API`);
      const response = await api.post(`/api/imports/${importId}/extract-section`, {
        htmlContent: extractedHtml,
        sectionType: metadata.sectionType,
        standardCode: metadata.standardCode,
        specCode: metadata.specCode,
        title: metadata.title,
        textStartOffset: currentSelection.textStartOffset,
        textLength: currentSelection.textLength
      });

      const sectionId = response.data.sectionId || Date.now().toString();
      console.log(`[SelfStudyEditor] Section saved to MongoDB, id=${sectionId}`);

      // Insert HTML comment marker into GridFS document (server-side, no size limit)
      // This embeds the marker directly in the stored HTML so on resume
      // the document already has markers — no client-side offset traversal needed.
      if (currentSelection.textStartOffset != null && currentSelection.textLength != null) {
        try {
          console.log(`[SelfStudyEditor] Calling insert-marker API: offset=${currentSelection.textStartOffset}, length=${currentSelection.textLength}`);
          const markerResponse = await api.post(`/api/imports/${importId}/insert-marker`, {
            sectionId,
            title: metadata.title,
            sectionType: metadata.sectionType,
            contentLength: extractedText.length,
            textStartOffset: currentSelection.textStartOffset,
            textLength: currentSelection.textLength
          });
          console.log(`[SelfStudyEditor] insert-marker response:`, markerResponse.data);
        } catch (err: any) {
          console.error('[SelfStudyEditor] Failed to insert marker in GridFS:', err?.response?.data || err.message);
        }
      } else {
        console.warn(`[SelfStudyEditor] No textStartOffset/textLength — cannot insert marker. offset=${currentSelection.textStartOffset}, length=${currentSelection.textLength}`);
      }

      // Set lastSavedSection to trigger visual placeholder insertion in DocumentViewer
      console.log(`[SelfStudyEditor] Setting lastSavedSection to trigger DOM placeholder`);
      setLastSavedSection({
        id: sectionId,
        title: metadata.title,
        sectionType: metadata.sectionType,
        contentLength: extractedText.length
      });

      // Refresh tagged sections list (for sidebar)
      console.log(`[SelfStudyEditor] Refreshing tagged sections list...`);
      await loadTaggedSections();

      // Clear the selection state (but the Range was already used by DocumentViewer)
      setCurrentSelection(null);

      console.log(`[SelfStudyEditor] handleSaveSection COMPLETE for "${metadata.title}"`);

    } catch (err: any) {
      console.error(`[SelfStudyEditor] handleSaveSection ERROR:`, err?.response?.data || err.message);
      setSectionError(err.response?.data?.error || err.message || 'Failed to save section');
    } finally {
      console.log(`[SelfStudyEditor] handleSaveSection FINALLY — isSavingSection set to false`);
      setIsSavingSection(false);
    }
  };

  // Manual Tagging: Delete tagged section
  const handleDeleteTaggedSection = async (sectionId: string) => {
    if (!importId) return;

    setDeletingSectionId(sectionId);

    try {
      const response = await api.delete(`/api/imports/${importId}/tagged-sections/${sectionId}`);

      // Refresh tagged sections list
      await loadTaggedSections();

      // Always reload document from GridFS after section deletion.
      // If the marker existed, restoreMarker replaced it with original content.
      // If no marker existed (e.g., tagged before marker system, or insert-marker failed),
      // the original content is still in GridFS and reloading removes the DOM placeholder.
      await loadDocumentContent();
    } catch (err: any) {
      setSectionError(err.response?.data?.error || 'Failed to delete section');
    } finally {
      setDeletingSectionId(null);
    }
  };

  // Manual Tagging: Apply tagged section to a specific standard/spec
  const handleApplyTaggedSection = async (section: TaggedSection, targetStandardCode: string, targetSpecCode: string, toSupportingEvidence = false) => {
    if (!importId) return;

    setApplyingSectionId(section.id);
    setSectionError(null);

    try {
      // First, fetch the full content of the section
      const contentResponse = await api.get(`/api/imports/${importId}/tagged-sections/${section.id}`);
      // Use HTML content for rich text editor (preserves formatting: tables, lists, bold, etc.)
      const htmlContent = contentResponse.data.htmlContent || '';
      const fullContent = contentResponse.data.fullContent || '';

      if (!fullContent.trim() && !htmlContent.trim()) {
        throw new Error('Section has no content to apply');
      }

      // Use HTML content if available (better for the rich text editor), fall back to plain text
      const contentToApply = htmlContent || fullContent;

      if (toSupportingEvidence) {
        // Save to supporting evidence text instead of narrative
        await saveSupportingEvidenceMutation.mutateAsync({
          standardCode: targetStandardCode,
          specCode: targetSpecCode,
          supportingEvidenceText: contentToApply,
        });
      } else {
        // Save the content to the submission's narrative
        await saveMutation.mutateAsync({
          standardCode: targetStandardCode,
          specCode: targetSpecCode,
          content: contentToApply,
        });
      }

      // Update the tagged section to mark it as applied
      // We do this by re-extracting with the appliedDirectly flag
      await api.post(`/api/imports/${importId}/extract-section`, {
        htmlContent: contentResponse.data.htmlContent || fullContent,
        sectionType: 'standard',
        standardCode: targetStandardCode,
        specCode: targetSpecCode,
        title: section.title,
        appliedDirectly: true
      });

      // Delete the old tagged section (since we just created a new one with applied flag)
      await api.delete(`/api/imports/${importId}/tagged-sections/${section.id}`);

      // Refresh tagged sections list
      await loadTaggedSections();

      // Refresh submission data FIRST and WAIT for it to complete
      await queryClient.refetchQueries({ queryKey: ['submission', submissionId] });

      // Navigate to the applied spec so the editor shows the correct content.
      // This must happen AFTER refetchQueries so the NarrativeEditor mounts with fresh data.
      setSelectedStandard(targetStandardCode);
      setSelectedSpec(targetSpecCode);

      // Defer editor remount to next tick so React processes the navigation state change
      // and useQuery reflects the updated cache before the NarrativeEditor remounts
      await new Promise(resolve => setTimeout(resolve, 0));
      setEditorRefreshKey(prev => prev + 1);

      console.log(`[SelfStudyEditor] Applied section "${section.title}" to ${targetStandardCode}.${targetSpecCode}${toSupportingEvidence ? ' (supporting evidence)' : ''}`);

    } catch (err: any) {
      console.error('[SelfStudyEditor] Failed to apply section:', err);
      setSectionError(err.response?.data?.error || err.message || 'Failed to apply section');
    } finally {
      setApplyingSectionId(null);
    }
  };

  // Manual Tagging: Apply tagged section to curriculum matrix (store as rich content)
  const handleApplyToMatrix = async (section: TaggedSection, standardCode: string) => {
    if (!importId) return;

    setApplyingSectionId(section.id);
    setSectionError(null);

    try {
      // Fetch the full content of the section
      const contentResponse = await api.get(`/api/imports/${importId}/tagged-sections/${section.id}`);
      const htmlContent = contentResponse.data.htmlContent || '';

      if (!htmlContent.trim()) {
        throw new Error('Section has no content to import');
      }

      // Get the matrix for this submission
      const matrixResponse = await api.get(`/api/submissions/${submissionId}/matrix`);
      const matrixId = matrixResponse.data._id;
      const existingRaw = matrixResponse.data.rawContent || [];

      if (!matrixId) {
        throw new Error('No curriculum matrix found for this submission');
      }

      // Check for duplicate: same section already imported
      const isDuplicate = existingRaw.some((r: any) =>
        r.sourceImportId === importId && r.standardCode === standardCode &&
        r.title === (section.title || `Matrix - Standard ${standardCode}`)
      );

      if (isDuplicate) {
        throw new Error(`This section has already been imported to Standard ${standardCode}`);
      }

      // Store the HTML content directly in the matrix (rich text approach)
      await api.post(`/api/submissions/${submissionId}/matrix/${matrixId}/raw-content`, {
        content: htmlContent,
        title: section.title || `Matrix - Standard ${standardCode}`,
        standardCode,
        sourceImportId: importId
      });

      // Mark the tagged section as applied
      await api.patch(`/api/imports/${importId}/tagged-sections/${section.id}`, {
        appliedDirectly: true
      });

      // Refresh tagged sections and matrix data
      await loadTaggedSections();
      queryClient.invalidateQueries({ queryKey: ['matrix', submissionId] });

    } catch (err: any) {
      setSectionError(err.response?.data?.error || err.message || 'Failed to import matrix content');
    } finally {
      setApplyingSectionId(null);
    }
  };

  // Manual Tagging: View tagged section content (fetch full content from API)
  const handleViewTaggedSection = async (section: TaggedSection) => {
    setViewingTaggedSection(section);
    setViewingFullContent(null);
    setViewingHtmlContent(null);
    setIsLoadingFullContent(true);

    try {
      const response = await api.get(`/api/imports/${importId}/tagged-sections/${section.id}`);
      setViewingFullContent(response.data.fullContent || 'No content available');
      // Store HTML content separately for formatted display
      setViewingHtmlContent(response.data.htmlContent || null);
    } catch (err: any) {
      console.error('Failed to load full section content:', err);
      setViewingFullContent(section.previewText || 'Failed to load content');
    } finally {
      setIsLoadingFullContent(false);
    }
  };

  // Manual Tagging: Finish tagging and proceed
  const handleFinishTagging = async () => {
    if (!importId) return;

    setIsConfirmingSelections(true);
    setSectionError(null);

    try {
      const response = await api.post(`/api/imports/${importId}/finish-tagging`, {
        skipAiProcessing: true // For now, skip AI and go directly to review
      });

      // Transition to review step or completed
      if (response.data.status === 'completed') {
        setImportStatus(prev => prev ? { ...prev, status: 'completed' } : null);
        setImportStep('review');
        // Reload extracted sections for review
        const sectionsResponse = await api.get(`/api/imports/${importId}/sections`);
        setExtractedSections(sectionsResponse.data.sections || []);
      } else {
        // Proceed to AI processing (if enabled)
        setImportStep('processing');
      }
    } catch (err: any) {
      setSectionError(err.response?.data?.error || 'Failed to finish tagging');
    } finally {
      setIsConfirmingSelections(false);
    }
  };

  // Part 6: Toggle section selection
  const handleToggleSectionSelection = (sectionId: string, isSelected: boolean) => {
    const updateSelection = (sections: DetectedSection[]): DetectedSection[] => {
      return sections.map(section => {
        if (section.id === sectionId) {
          return { ...section, isSelected };
        }
        if (section.children.length > 0) {
          return { ...section, children: updateSelection(section.children) };
        }
        return section;
      });
    };
    setDetectedSections(prev => updateSelection(prev));
  };

  // Part 6: Select/deselect all sections
  const handleSelectAllSections = (selectAll: boolean) => {
    const updateAll = (sections: DetectedSection[]): DetectedSection[] => {
      return sections.map(section => ({
        ...section,
        isSelected: section.isAppendix ? false : selectAll,
        children: updateAll(section.children)
      }));
    };
    setDetectedSections(prev => updateAll(prev));
  };

  // Part 6: Count selected sections
  const countSelectedSections = (sections: DetectedSection[]): number => {
    let count = 0;
    for (const section of sections) {
      if (section.isSelected && !section.isAppendix) count++;
      count += countSelectedSections(section.children);
    }
    return count;
  };

  // Part 6: Confirm section selections and proceed to AI processing
  const handleConfirmSectionSelections = async () => {
    if (!importId) return;

    const selectedCount = countSelectedSections(detectedSections);
    if (selectedCount === 0) {
      setUploadError('Please select at least one section to process');
      return;
    }

    setIsConfirmingSelections(true);
    setUploadError(null);

    try {
      // First, save the section selections
      const getSelections = (sections: DetectedSection[]): Array<{ id: string; isSelected: boolean }> => {
        const result: Array<{ id: string; isSelected: boolean }> = [];
        for (const section of sections) {
          result.push({ id: section.id, isSelected: section.isSelected });
          result.push(...getSelections(section.children));
        }
        return result;
      };

      await api.post(`/api/imports/${importId}/select-sections`, {
        selections: getSelections(detectedSections)
      });

      // Then confirm and start AI processing
      await api.post(`/api/imports/${importId}/confirm-selections`);

      // Move to processing step (will poll for completion)
      setImportStep('processing');
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to confirm section selections');
    } finally {
      setIsConfirmingSelections(false);
    }
  };

  // Part 6: View full section content
  const handleViewDetectedSectionContent = async (section: DetectedSection) => {
    setViewingFullSection(section);
  };

  // Fetch full section content and open modal
  const handleViewFullContent = async (section: ExtractedSection) => {
    if (!importId) {
      // If no importId, just show the truncated content we have
      setExpandedSection(section);
      return;
    }

    setLoadingFullContent(true);
    setExpandedSection(section); // Show modal immediately with loading state

    try {
      const response = await api.get(`/api/imports/${importId}/sections/${section.id}`);
      // Update expandedSection with full content
      setExpandedSection({
        ...section,
        content: response.data.content,
        unmappedReason: response.data.unmappedReason,
        suggestedStandardCode: response.data.suggestedStandardCode,
        suggestedSpecCode: response.data.suggestedSpecCode,
        suggestedConfidence: response.data.suggestedConfidence,
      });
    } catch (err) {
      console.error('Failed to fetch full section content:', err);
      // Keep showing the truncated content if fetch fails
    } finally {
      setLoadingFullContent(false);
    }
  };

  // Handle moving an unmapped section to a spec or curriculum matrix
  const handleMoveUnmapped = async (sectionId: string) => {
    if (!importId) return;

    // Get the section to access AI suggestions
    const section = extractedSections.find(s => s.id === sectionId);
    const assignment = unmappedAssignments[sectionId];

    // Check if moving to curriculum matrix
    const toCurriculumMatrix = assignment?.toCurriculumMatrix || false;

    // Use user assignment if available, otherwise fall back to AI suggestions
    const standardCode = assignment?.standardCode || section?.suggestedStandardCode || '';
    const specCode = assignment?.specCode || section?.suggestedSpecCode || '';
    const toSupportingEvidence = assignment?.toSupportingEvidence || false;

    // Require standard/spec selection unless moving to curriculum matrix
    if (!toCurriculumMatrix && (!standardCode || !specCode)) {
      setUploadError('Please select a standard and specification');
      return;
    }

    setMovingSection(sectionId);
    setUploadError(null);

    try {
      if (toCurriculumMatrix) {
        // Move to curriculum matrix
        await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
          action: 'move_to_matrix',
          toCurriculumMatrix: true,
          matrixType: 'non_human_services_courses'
        });
      } else {
        // Move to standard/spec
        await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
          action: 'assign',
          standardCode,
          specCode,
          toSupportingEvidence
        });
      }

      // Remove from extracted sections list
      setExtractedSections(prev => prev.filter(s => s.id !== sectionId));

      // Clear the assignment
      setUnmappedAssignments(prev => {
        const newAssignments = { ...prev };
        delete newAssignments[sectionId];
        return newAssignments;
      });

      // Refresh submission data
      queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to move content');
    } finally {
      setMovingSection(null);
    }
  };

  // Handle discarding an unmapped section
  const handleDiscardUnmapped = async (sectionId: string) => {
    if (!importId) return;

    if (!window.confirm('Discard this content? It will not be imported.')) {
      return;
    }

    setMovingSection(sectionId);
    try {
      await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
        action: 'discard'
      });

      // Remove from extracted sections list
      setExtractedSections(prev => prev.filter(s => s.id !== sectionId));
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Failed to discard content');
    } finally {
      setMovingSection(null);
    }
  };

  // Update unmapped assignment
  const updateUnmappedAssignment = (sectionId: string, update: Partial<UnmappedAssignment>) => {
    setUnmappedAssignments(prev => ({
      ...prev,
      [sectionId]: {
        standardCode: prev[sectionId]?.standardCode || '',
        specCode: prev[sectionId]?.specCode || '',
        toSupportingEvidence: prev[sectionId]?.toSupportingEvidence || false,
        toCurriculumMatrix: prev[sectionId]?.toCurriculumMatrix || false,
        ...update
      }
    }));
  };

  // Batch selection handlers
  const toggleSectionSelection = (sectionId: string) => {
    setSelectedSectionIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const selectAllSections = () => {
    const allIds = extractedSections.map(s => s.id);
    setSelectedSectionIds(new Set(allIds));
  };

  const selectNoneSections = () => {
    setSelectedSectionIds(new Set());
  };

  // Batch move handler
  const handleBatchMoveSections = async () => {
    if (!importId || selectedSectionIds.size === 0) return;

    // Require standard/spec selection unless moving to curriculum matrix
    if (!batchAssignment.toCurriculumMatrix && (!batchAssignment.standardCode || !batchAssignment.specCode)) {
      setUploadError('Please select a standard and specification');
      return;
    }

    setIsBatchMoving(true);
    setUploadError(null);

    let successCount = 0;
    let failCount = 0;

    for (const sectionId of selectedSectionIds) {
      try {
        if (batchAssignment.toCurriculumMatrix) {
          // Move to curriculum matrix
          await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
            action: 'move_to_matrix',
            toCurriculumMatrix: true,
            matrixType: 'non_human_services_courses'
          });
        } else {
          // Move to standard/spec
          await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
            action: 'assign',
            standardCode: batchAssignment.standardCode,
            specCode: batchAssignment.specCode,
            toSupportingEvidence: batchAssignment.toSupportingEvidence
          });
        }
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Failed to move section ${sectionId}:`, err);
      }
    }

    // Remove successfully moved sections from list
    setExtractedSections(prev =>
      prev.filter(s => !selectedSectionIds.has(s.id) || failCount > 0)
    );
    setSelectedSectionIds(new Set());

    // Refresh submission data
    queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });

    if (failCount > 0) {
      setUploadError(`Moved ${successCount} section(s), ${failCount} failed`);
    }

    setIsBatchMoving(false);
  };

  // Batch discard handler
  const handleBatchDiscardSections = async () => {
    if (!importId || selectedSectionIds.size === 0) return;

    if (!window.confirm(`Discard ${selectedSectionIds.size} selected section(s)? This content will not be imported.`)) {
      return;
    }

    setIsBatchMoving(true);
    setUploadError(null);

    let successCount = 0;
    let failCount = 0;

    for (const sectionId of selectedSectionIds) {
      try {
        await api.put(`/api/imports/${importId}/unmapped/${sectionId}`, {
          action: 'discard'
        });
        successCount++;
      } catch (err) {
        failCount++;
        console.error(`Failed to discard section ${sectionId}:`, err);
      }
    }

    // Remove successfully discarded sections from list
    if (successCount > 0) {
      setExtractedSections(prev =>
        prev.filter(s => !selectedSectionIds.has(s.id))
      );
    }
    setSelectedSectionIds(new Set());

    if (failCount > 0) {
      setUploadError(`Discarded ${successCount} section(s), ${failCount} failed`);
    }

    setIsBatchMoving(false);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get current content for selected standard/spec
  const getCurrentContent = useCallback(() => {
    if (!submission || !selectedSpec) return '';
    const narrative = (submission.narrativeContent || []).find(
      (n) => n.standardCode === selectedStandard && n.specCode === selectedSpec
    );
    return narrative?.content || '';
  }, [submission, selectedStandard, selectedSpec]);

  // Get current supporting evidence text for selected standard/spec
  const getCurrentSupportingEvidence = useCallback(() => {
    if (!submission || !selectedSpec) return '';
    const narrative = (submission.narrativeContent || []).find(
      (n) => n.standardCode === selectedStandard && n.specCode === selectedSpec
    );
    return narrative?.supportingEvidenceText || '';
  }, [submission, selectedStandard, selectedSpec]);

  // Get current standard data for the editor
  const getCurrentStandardData = useCallback(() => {
    if (!standards) return {
      standardTitle: '',
      standardDescription: '',
      specTitle: '',
      specText: ''
    };

    const standard = standards.find((s) => s.code === selectedStandard);
    if (!standard) return {
      standardTitle: '',
      standardDescription: '',
      specTitle: '',
      specText: ''
    };

    const spec = selectedSpec
      ? (standard.specifications || []).find((sp) => sp.code === selectedSpec)
      : null;

    return {
      standardTitle: standard.title,
      standardDescription: standard.description,
      specTitle: spec?.title || '',
      specText: spec?.text || ''
    };
  }, [standards, selectedStandard, selectedSpec]);

  // Get current standard text (for backwards compatibility)
  const getCurrentStandardText = useCallback(() => {
    const data = getCurrentStandardData();
    return data.specText || data.standardDescription;
  }, [getCurrentStandardData]);

  // Build navigation data from standards
  const navigationData = React.useMemo(() => {
    if (!standards) return [];
    // Which specs actually have STORED content (narrative or supporting
    // evidence)? The sidebar count reflects this — not validation status — so a
    // spec with materialized/imported content always counts even if it hasn't
    // been validated or marked complete yet.
    const plain = (s?: string) => (s || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim();
    const contentKeys = new Set<string>();
    for (const nc of submission?.narrativeContent || []) {
      if (plain(nc.content).length > 0 || plain(nc.supportingEvidenceText).length > 0) {
        contentKeys.add(`${nc.standardCode}_${nc.specCode}`);
      }
    }
    return standards.map((standard) => ({
      standardCode: standard.code,
      standardTitle: standard.title,
      status:
        submission?.standardsStatus[standard.code]?.status || 'not_started',
      specifications: (standard.specifications || []).map((spec) => ({
        specCode: spec.code,
        specTitle: spec.title,
        status:
          submission?.standardsStatus?.[`${standard.code}_${spec.code}`]?.status ||
          'not_started',
        validationStatus:
          submission?.standardsStatus?.[`${standard.code}_${spec.code}`]?.validationStatus,
        hasContent: contentKeys.has(`${standard.code}_${spec.code}`),
      })),
    }));
  }, [standards, submission]);

  // Handle save
  const handleSave = useCallback(
    async (content: string) => {
      if (!selectedSpec) return;
      await saveMutation.mutateAsync({
        standardCode: selectedStandard,
        specCode: selectedSpec,
        content,
      });
    },
    [saveMutation, selectedStandard, selectedSpec]
  );

  // Handle save supporting evidence
  const handleSaveSupportingEvidence = useCallback(
    async (supportingEvidenceText: string) => {
      if (!selectedSpec) return;
      await saveSupportingEvidenceMutation.mutateAsync({
        standardCode: selectedStandard,
        specCode: selectedSpec,
        supportingEvidenceText,
      });
    },
    [saveSupportingEvidenceMutation, selectedStandard, selectedSpec]
  );

  // CR-006 / S2A.5: final-submit gate. The actual mutation runs from
  // the FinalSubmitModal's onConfirm; the button just opens the modal.
  const [finalSubmitOpen, setFinalSubmitOpen] = useState(false);
  const handleSubmitSelfStudy = useCallback(() => {
    setFinalSubmitOpen(true);
  }, []);

  // CR-008 / S2A.2 — pre-submission preflight. Fetched only while the
  // modal is open so we don't poll the server on every dashboard render,
  // and refetched on each open so the PC sees the latest gaps.
  const preflightQuery = useQuery({
    queryKey: ['submission-preflight', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/preflight`);
      return r.data as {
        submitDisabled: boolean;
        errors: Array<{ code: string; message: string; standardCode?: string; specCode?: string }>;
        warnings: Array<{ code: string; message: string; standardCode?: string; specCode?: string }>;
        counts: { totalSpecs: number; passed: number; excluded: number; satisfied: number; missing: number };
      };
    },
    enabled: !!submissionId && finalSubmitOpen,
    refetchOnWindowFocus: false,
  });

  // AACC (Nicole) — the AI "Needs Improvement" findings, fetched with the
  // modal so the PC can annotate each before submitting.
  const needsImprovementQuery = useQuery({
    queryKey: ['submission-needs-improvement', submissionId],
    queryFn: async () => {
      const r = await api.get(`/api/submissions/${submissionId}/needs-improvement`);
      return (r.data?.items ?? []) as NeedsImprovementItem[];
    },
    enabled: !!submissionId && finalSubmitOpen,
    refetchOnWindowFocus: false,
  });

  // CR-008 — "Go to" from a preflight error row navigates to the spec in
  // the editor and closes the modal so the PC lands on the fix surface.
  const handleGoToSpec = useCallback(
    (standardCode: string, specCode: string) => {
      setSelectedStandard(standardCode);
      setSelectedSpec(specCode);
      setActiveView(null);
      setFinalSubmitOpen(false);
    },
    []
  );
  const handleFinalSubmitConfirm = useCallback(
    async (submissionNote: string, override?: { reason: string }, needsImprovementNotes?: NeedsImprovementNote[]) => {
      try {
        // Flush any pending debounced editor save BEFORE the submit locks the
        // submission — a save that lands after the lock would be rejected (403)
        // and the edit lost. Best-effort: a flush failure must not block submit.
        try { await narrativeFlushRef.current?.(); } catch { /* ignore */ }
        try { await docIntroFlushRef.current?.(); } catch { /* ignore */ }
        await submitSelfStudyMutation.mutateAsync({ submissionNote, override, needsImprovementNotes });
        setFinalSubmitOpen(false);
      } catch (err) {
        // Leave the modal open so the PC can read the error + retry.
        console.error('[handleFinalSubmitConfirm] submission failed', err);
      }
    },
    [submitSelfStudyMutation]
  );

  // Calculate validated specs count for progress display
  const validationProgress = React.useMemo(() => {
    if (!standards || !submission?.standardsStatus) {
      return { validated: 0, total: 0 };
    }

    let validated = 0;   // specs that PASSED (gates the all-pass submit readiness)
    let evaluated = 0;   // specs the AI has reviewed at all (pass OR fail)
    let total = 0;

    for (const standard of standards) {
      for (const spec of standard.specifications || []) {
        const status = submission.standardsStatus?.[`${standard.code}_${spec.code}`];
        // CR-050 — excluded specs drop out of the denominator entirely;
        // they're not "validated" but also not part of the work that needs
        // doing. Keeps the X/Y counter honest.
        if (status?.excluded === true) continue;
        total++;
        if (status?.validationStatus === 'pass') validated++;
        // A spec with any verdict (pass or fail) has been run through validation —
        // this is what the header "Validated" counter reflects (rises with
        // Validate-All), distinct from the all-pass submit gate.
        if (status?.validationStatus === 'pass' || status?.validationStatus === 'fail') evaluated++;
      }
    }

    return { validated, evaluated, total };
  }, [standards, submission?.standardsStatus]);

  // CR-045 — count of items waiting in the Drafts (Review) queue, for the
  // PhaseIndicator's "2. Drafts (N)" badge. Mirrors the ReviewSurfaceButton
  // content check but produces a count rather than a boolean.
  const draftsBuckets = useAIImportStore((s) => s.buckets);
  const draftsTags = useAIImportStore((s) => s.tags);
  const draftsCvs = useAIImportStore((s) => s.cvs);
  const draftsEvidenceDocs = useAIImportStore((s) => s.evidenceDocs);
  const draftsIntroductions = useAIImportStore((s) => s.introductions);
  const draftsApprovedIds = useAIImportStore((s) => s.approvedIds);
  const draftsDiscardedIds = useAIImportStore((s) => s.discardedIds);
  const draftsCount = React.useMemo(
    () =>
      computeDraftsCount({
        buckets: draftsBuckets,
        tags: draftsTags,
        cvs: draftsCvs,
        evidenceDocs: draftsEvidenceDocs,
        introductions: draftsIntroductions,
        approvedIds: draftsApprovedIds,
        discardedIds: draftsDiscardedIds,
      }),
    [draftsBuckets, draftsTags, draftsCvs, draftsEvidenceDocs, draftsIntroductions, draftsApprovedIds, draftsDiscardedIds]
  );

  // Check if entire self-study is ready for submission.
  // CR-050 — a spec is satisfied when validationStatus === 'pass' OR
  // excluded === true (PC has explicitly marked it not applicable).
  // Mirrors the server's submitSelfStudy gate so the CTA's enabled state
  // matches what the server will actually accept.
  const isSelfStudyReadyForSubmit = React.useMemo(() => {
    if (!standards || !submission?.standardsStatus) return false;

    return standards.every(standard =>
      (standard.specifications || []).every(spec => {
        const status: any = submission.standardsStatus?.[`${standard.code}_${spec.code}`];
        // Ready when the spec is substantively addressed (pass OR needs_improvement
        // — a reader-facing verdict, not a hard fail) or marked Not Applicable.
        // Only a hard 'fail' or an unassessed spec blocks submit. Legacy rows have
        // only the binary validationStatus.
        const v = status?.verdict;
        return (
          v === 'pass' ||
          v === 'needs_improvement' ||
          (v == null && status?.validationStatus === 'pass') ||
          status?.excluded === true
        );
      })
    );
  }, [standards, submission?.standardsStatus]);

  // Check if submission is already submitted or locked.
  // Status list mirrors server/src/middleware/submissionLockout.ts so the
  // client disables inputs from the same source of truth the server enforces.
  const isSubmissionLocked = React.useMemo(() => {
    // Sent back for correction: a reader / lead reader explicitly handed the
    // submission back to the PC to add or fix items. The status stays in the
    // review band, but the PC IS allowed to edit (mirrors the server's
    // submissionLockout carve-out). Editability follows the lockReason here.
    if (
      submission?.readerLock?.lockReason === 'sent_back_for_correction' &&
      !submission?.readerLock?.isLocked
    ) {
      return false;
    }
    return submission?.status === 'submitted' ||
           submission?.status === 'under_review' ||
           submission?.status === 'readers_assigned' ||
           submission?.status === 'review_complete' ||
           !!submission?.readerLock?.isLocked;
  }, [submission?.status, submission?.readerLock?.isLocked, submission?.readerLock?.lockReason]);

  // CR-005 — a program coordinator whose submission is locked must be unable to
  // edit, not merely shown a banner. Fold the lock into the read-only flag so
  // every editor input below is actually disabled (the server still rejects
  // writes with 403 LOCKED, but the UI should never let them try).
  const isEditingDisabled = isReadOnly || (isProgramCoordinator && isSubmissionLocked);

  // Navigate to next/prev spec
  // One linear sequence through the self-study: for each Standard (in order) its
  // Introduction panel (spec = null → shows the document + standard introduction)
  // then each specification. Down = next panel, Up = previous — wraps standard→
  // standard and, at the top of Standard 1, into its introduction.
  const navigateSpec = useCallback(
    (direction: 'next' | 'prev') => {
      if (!standards) return;
      const panels: Array<{ std: string; spec: string | null }> = [];
      for (const s of standards) {
        panels.push({ std: s.code, spec: null }); // the Standard's Introduction panel
        for (const sp of s.specifications || []) panels.push({ std: s.code, spec: sp.code });
      }
      if (panels.length === 0) return;
      const cur = panels.findIndex((p) => p.std === selectedStandard && p.spec === (selectedSpec ?? null));
      const base = cur < 0 ? (direction === 'next' ? -1 : panels.length) : cur;
      const next = base + (direction === 'next' ? 1 : -1);
      if (next >= 0 && next < panels.length) {
        setSelectedStandard(panels[next].std);
        setSelectedSpec(panels[next].spec);
      }
    },
    [standards, selectedStandard, selectedSpec]
  );

  // Debug: Log render state
  console.log('SelfStudyEditor render:', {
    loadingSubmission,
    loadingStandards,
    submissionError,
    standardsError,
    hasSubmission: !!submission,
    hasStandards: !!standards,
    submissionId
  });

  if (loadingSubmission || loadingStandards) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading self-study editor...</p>
        </div>
      </div>
    );
  }

  // Handle errors
  if (submissionError || standardsError) {
    const errorMessage = (submissionErrorDetails as any)?.response?.data?.error || 'Failed to load submission data';
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Self-Study</h2>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => navigate('/self-study')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Self-Study List
          </button>
        </div>
      </div>
    );
  }

  // Handle case where data is missing (shouldn't happen but safety check)
  if (!submission || !standards) {
    console.error('SelfStudyEditor: Data missing after loading completed', { submission, standards });
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-gray-50">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Data Not Available</h2>
          <p className="text-gray-600 mb-4">The submission data could not be loaded. Please try again.</p>
          <button
            onClick={() => navigate('/self-study')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Self-Study List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`self-study-editor flex flex-1 min-h-0 flex-col overflow-hidden bg-gray-50${focusMode ? ' fixed inset-0 z-40' : ''}`}>
      {/* Focus mode — a floating exit control (the chrome is hidden below). */}
      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          data-testid="focus-exit"
          className="fixed top-2 right-3 z-50 inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow hover:bg-gray-50"
          title="Exit full screen (Esc)"
        >
          <Minimize2 className="w-3.5 h-3.5" /> Exit full screen
        </button>
      )}
      {/* CR-073 — Parser Train mode banner. When an SU opens a sandbox training
          run, this IS the verification surface: run Compare on every card,
          confirm placement, then approve on the Parser Train page (approval
          activates the parser rule that produced the spec). */}
      {(submission as any)?.trainingRun && (
        <div className="flex-shrink-0 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-900">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <span className="font-semibold">Parser Train mode</span>
            <span className="text-indigo-700">— verification sandbox. Run Compare on each card to confirm placement &amp; anchoring; approving a spec in Parser Train activates the rule that parsed it. This run is isolated and never affects real submissions.</span>
          </div>
        </div>
      )}
      {/* CR-005 / S2A.2 — read-only lockout banner. Shown when the PC's
          submission has progressed past draft (final-submitted, under
          review, etc.) so they understand why the editor is read-only
          rather than hitting blocked-write errors per save.            */}
      {isProgramCoordinator && isSubmissionLocked && (
        <div className="flex-shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <Lock className="h-4 w-4 flex-shrink-0 text-amber-700" aria-hidden />
            <span>
              <strong>Submitted for review</strong>
              {submission?.submittedAt && (
                <> on {new Date(submission.submittedAt).toLocaleDateString()}</>
              )}
              {' — '}this self-study is now read-only. You can view + print, but cannot edit. Contact the administrator to make changes.
            </span>
          </div>
        </div>
      )}
      {/* Header — wraps cleanly to multiple rows at narrow widths so the
          tab row, progress, and Submit button never overlap. At ≥1400px
          they sit on one line; below that the right cluster (progress +
          Submit) wraps below the tabs without losing any controls. */}
      <header className={`flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2${focusMode ? ' hidden' : ''}`}>
        {/* CR-045 — wizard phase indicator strip. Shows the PC where they
            are in the 4-step guided workflow. PC-only (the wizard
            workflow doesn't apply to readers). Hidden on the full-screen
            Review/Matrix draft surfaces to reclaim vertical work area. */}
        {isProgramCoordinator && activeView !== 'review-surface' && activeView !== 'matrix-surface' && (
          <PhaseIndicator
            activeView={activeView}
            setActiveView={setActiveView}
            draftsCount={draftsCount}
            validated={validationProgress.validated}
            totalSpecs={validationProgress.total}
            onSubmitClick={() => {
              setActiveView('standards');
              // Focus the standalone Submit CTA; it lives in the header's
              // right cluster. data-testid lets the click land precisely.
              requestAnimationFrame(() => {
                document
                  .querySelector<HTMLButtonElement>('[data-testid="submit-self-study-cta"]')
                  ?.focus();
              });
            }}
          />
        )}
        <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={() => navigate('/self-study')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to Self-Study"
            >
              <Home className="w-5 h-5 text-gray-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 truncate">
                Self-Study Editor
              </h1>
              <p className="text-sm text-gray-500 truncate max-w-[24rem]">
                {submission?.institutionName} - {submission?.programName}
              </p>
            </div>
          </div>

          {/* Compact controls: a full-screen toggle (give the work area the whole
              viewport) + a hamburger that collapses the toolbar on narrow screens
              so the button rows stop stacking into tall chrome. */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setFocusMode(true)}
              data-testid="focus-enter"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              title="Full screen — give the work area the whole screen"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Full screen
            </button>
            <div className="relative 2xl:hidden">
              <button
                onClick={() => setToolbarMenuOpen((o) => !o)}
                data-testid="toolbar-menu"
                aria-label="Menu"
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                title="Menu"
              >
                <Menu className="w-4 h-4" /> Menu
              </button>
              {toolbarMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setToolbarMenuOpen(false)} />
                  <div className="absolute left-0 mt-1 z-40 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg text-sm" role="menu">
                    {([
                      isProgramCoordinator && canImport && { label: 'Import file', fn: () => setShowImportFile(true) },
                      isProgramCoordinator && { label: 'Review drafts', fn: () => setActiveView('review-surface') },
                      isProgramCoordinator && { label: 'Curriculum Matrix drafts', fn: () => setActiveView('matrix-surface') },
                      { label: 'Introduction', fn: () => setActiveView('introduction') },
                      { label: 'Standards', fn: () => setActiveView('standards') },
                      { label: 'Curriculum Matrix', fn: () => setActiveView('curriculum') },
                      { label: 'Supporting File Library', fn: () => setActiveView('files') },
                    ].filter(Boolean) as { label: string; fn: () => void }[]).map((it) => (
                      <button
                        key={it.label}
                        role="menuitem"
                        onClick={() => { it.fn(); setToolbarMenuOpen(false); }}
                        className="block w-full text-left px-3 py-2 hover:bg-gray-100 text-gray-700"
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 min-w-0">
            {/* CR-045 — toolbar grouped by workflow phase. Left-to-right
                matches the data flow: IMPORT → DRAFTS → SELF-STUDY. Each
                group carries a plain-English label so a teacher reads the
                row as a pipeline, not seven equal options. The phase
                indicator strip above (PhaseIndicator) is the wizard. */}
            {/* The grouped nav buttons show at wide widths; below 2xl (~1536px,
                i.e. a maximized laptop) they collapse into the "Menu" hamburger
                above so the header stays a single compact row. */}
            <div className="hidden 2xl:flex flex-wrap items-end gap-x-4 gap-y-2 border-l pl-3 border-gray-200">
              {/* GROUP: IMPORT (PC only) — bring content in. */}
              {isProgramCoordinator && (
                <div className="flex flex-col gap-0.5">
                  <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Import
                  </span>
                  <div className="flex items-center gap-1">
                    <AIImportTabButton
                      activeView={activeView}
                      setActiveView={setActiveView}
                      showAiBadge={false}
                    />
                    {/* CR-059 — "Import file": a standalone single-file import
                        drawer (drag/drop or browse → preview → paste into the
                        narrative or as a file summary). Replaces the legacy
                        per-standard "Import Document" editor. */}
                    <button
                      onClick={() => { if (canImport) setShowImportFile((v) => !v); }}
                      disabled={!canImport}
                      data-testid="import-file-button"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        !canImport
                          ? 'text-gray-300 cursor-not-allowed'
                          : showImportFile
                          ? 'bg-teal-100 text-teal-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      title={canImport
                        ? 'Import file — bring in one CV, syllabus, project, or section draft and paste its content into a standard or as supporting evidence.'
                        : 'A superuser must impersonate a Program Coordinator to import. Use Switch Role to view as a PC.'}
                    >
                      <FileUp className="w-4 h-4 flex-shrink-0" />
                      Import file
                    </button>
                  </div>
                </div>
              )}

              {/* GROUP: DRAFTS (PC only) — triage what the import produced. */}
              {isProgramCoordinator && (
                <div className="flex flex-col gap-0.5">
                  <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Drafts
                  </span>
                  <div className="flex items-center gap-1">
                    <ReviewSurfaceButton activeView={activeView} setActiveView={setActiveView} />
                    <MatrixSurfaceButton activeView={activeView} setActiveView={setActiveView} />
                  </div>
                </div>
              )}

              {/* GROUP: SELF-STUDY — the published deliverable. Visible to
                  every role (readers author nothing but still navigate it). */}
              <div className="flex flex-col gap-0.5">
                <span className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Self-Study
                </span>
                <div className="flex items-center gap-1">
                  {/* CR-046 — Introduction surface, first in document order.
                      Reuses the existing IntroductionEditor (CR-039) — this
                      button just makes the document-level introduction
                      discoverable instead of buried in the no-spec sub-state. */}
                  <button
                    data-tour="ss-tab-introduction"
                    onClick={() => setActiveView('introduction')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'introduction'
                        ? 'bg-teal-100 text-teal-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Introduction — the opening narrative of your self-study (mission, program description, terms). Imported intro content lands here."
                  >
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    Introduction
                  </button>
                  <button
                    data-tour="ss-tab-standards"
                    onClick={() => setActiveView('standards')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'standards'
                        ? 'bg-teal-100 text-teal-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 flex-shrink-0" />
                    Standards
                  </button>
                  <button
                    data-tour="ss-tab-curriculum"
                    onClick={() => setActiveView('curriculum')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'curriculum'
                        ? 'bg-teal-100 text-teal-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4 flex-shrink-0" />
                    Curriculum Matrix
                  </button>
                  <button
                    data-tour="ss-tab-files"
                    onClick={() => setActiveView('files')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      activeView === 'files'
                        ? 'bg-teal-100 text-teal-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                    Supporting File Library
                  </button>
                  {/* Lead Reader Report — the board-facing "Report to VPA to
                      Request Board Action". Lead reader (assigned) + admin /
                      superuser only. Renders in-place as its own ?view. */}
                  {canViewLeadReaderReport && (
                    <button
                      data-testid="nav-lead-reader-report"
                      onClick={() => setActiveView('lead-reader-report')}
                      title="Lead Reader Report to VPA to Request Board Action — the board-facing recommendation document"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        activeView === 'lead-reader-report'
                          ? 'bg-teal-100 text-teal-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <ClipboardList className="w-4 h-4 flex-shrink-0" />
                      Lead Reader Report
                    </button>
                  )}
                  {/* Reader Report — reader/lead-reader ONLY. Opens the dedicated
                      Reader Report screen to view, edit and save the compliance
                      checklist; from there they return here to comment. */}
                  {isReviewer && (
                    <button
                      data-testid="reader-report-open"
                      data-tour="ss-reader-report"
                      onClick={() => navigate(`/reader-report/${submissionId}`)}
                      title="Open the Reader Report — view, edit and save your assessment"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    >
                      <ClipboardList className="w-4 h-4 flex-shrink-0" />
                      Reader Report
                    </button>
                  )}
                  {/* PC/admin keep a quick download of the generated report. */}
                  {!isReviewer && reportFiles?.pdf && (
                    <button
                      data-testid="reader-report-pdf-toolbar"
                      onClick={() => downloadReport(reportFiles.pdf!.id, reportFiles.pdf!.name)}
                      title="Download the Reader Report (PDF)"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
                    >
                      <Download className="w-4 h-4 flex-shrink-0" />
                      Reader Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Right cluster: progress + submit. ml-auto pushes it right when
              there's room on the line; wraps to its own row when not. */}
          <div className="flex flex-wrap items-center gap-3 ml-auto shrink-0">
            {/* CR-064 — the self-study chrome (overall progress, Validate All,
                the Validated counter, Submit Self-Study) is NOISE on the Review
                surface (Monica: "just give me buttons for the editor"). Hide it
                on the Review/Matrix surfaces; it belongs to the self-study phase. */}
            {activeView !== 'review-surface' && activeView !== 'matrix-surface' && (
              <ProgressIndicator submission={submission} />
            )}

            {isProgramCoordinator && activeView !== 'review-surface' && activeView !== 'matrix-surface' && (
              <>
                {/* CR-001 / S2A.4 — Both importers ship side-by-side.
                    "Import Document" tab above triggers the legacy
                    per-standard paste-and-tag modal (showImportModal).
                    "AI Import" tab opens the full wizard. Both write to
                    the same Submission record; PCs can mix and match. */}

                {/* Validate All — runs the AI evaluation against EVERY spec with
                    content, queued in the background (non-blocking). */}
                {!isEditingDisabled && (
                  <button
                    data-testid="validate-all-cta"
                    onClick={() => validateAllMutation.mutate()}
                    disabled={validateAllMutation.isPending || !!evalProgress?.running}
                    title="Run the AI review against every specification (runs in the background)"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-primary-300 text-primary-700 hover:bg-primary-50 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {evalProgress?.running ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Validating {evalProgress.done}/{evalProgress.total}…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Validate All
                      </>
                    )}
                  </button>
                )}

                {/* Validation Progress — specs the AI has reviewed (pass OR fail),
                    so it reflects Validate-All progress. Submit still requires all
                    to PASS (see the disabled-button tooltip). */}
                <span
                  className="text-sm text-gray-500"
                  title={`${validationProgress.evaluated} of ${validationProgress.total} specifications reviewed by AI · ${validationProgress.validated} passed`}
                >
                  {validationProgress.evaluated}/{validationProgress.total} Validated
                </span>

                {/* Submit Self-Study Button */}
                <button
                  data-testid="submit-self-study-cta"
                  onClick={handleSubmitSelfStudy}
                  disabled={submitSelfStudyMutation.isPending || !isSelfStudyReadyForSubmit || isSubmissionLocked}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors whitespace-nowrap ${
                    isSubmissionLocked
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                  title={
                    isSubmissionLocked
                      ? "Self-study has been submitted for review"
                      : isSelfStudyReadyForSubmit
                      ? "Submit self-study for review - this will lock the document"
                      : `All specifications must PASS validation before submitting (${validationProgress.validated} of ${validationProgress.total} passed; ${validationProgress.evaluated} reviewed)`
                  }
                >
                  {submitSelfStudyMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isSubmissionLocked ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSubmissionLocked ? 'Submitted' : 'Submit Self-Study for Review'}
                </button>
              </>
            )}

            {isReviewer && (
              <>
                {/* Standard Navigator */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">Standard</span>
                  <button
                    onClick={() => {
                      const currentIdx = standards?.findIndex((s: any) => s.code === selectedStandard) ?? 0;
                      if (currentIdx > 0 && standards) {
                        setSelectedStandard(standards[currentIdx - 1].code);
                        setSelectedSpec(standards[currentIdx - 1].specifications?.[0]?.code || 'a');
                      }
                    }}
                    disabled={!standards || standards.findIndex((s: any) => s.code === selectedStandard) === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold">
                    {standards ? (standards.findIndex((s: any) => s.code === selectedStandard) + 1) : '?'} of {standards?.length || 21}
                  </span>
                  <button
                    onClick={() => {
                      const currentIdx = standards?.findIndex((s: any) => s.code === selectedStandard) ?? 0;
                      if (standards && currentIdx < standards.length - 1) {
                        setSelectedStandard(standards[currentIdx + 1].code);
                        setSelectedSpec(standards[currentIdx + 1].specifications?.[0]?.code || 'a');
                      }
                    }}
                    disabled={!standards || standards.findIndex((s: any) => s.code === selectedStandard) === (standards?.length || 21) - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Comments Counter */}
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <span className="font-medium">Comments</span>
                  <span className="bg-gray-100 px-2 py-0.5 rounded font-semibold">
                    {commentSummary?.total ?? 0}
                  </span>
                </div>

                {/* Add Comment Button */}
                <button
                  onClick={() => setShowCommentModal(true)}
                  disabled={!editorSelection}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    editorSelection
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                  title={editorSelection ? 'Add comment on selected text' : 'Select text in the editor first'}
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  Comment
                </button>

                {/* Score Control */}
                <div data-tour="ss-score" className="flex items-center gap-1 text-sm text-gray-600">
                  <span className="font-medium">Score</span>
                  {['-', '0', '1', '2', '3'].map((val) => {
                    const isActive = val === '-'
                      ? currentScore === undefined
                      : currentScore?.score === Number(val);
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          if (!selectedSpec) return;
                          if (val === '-') {
                            scoreDeleteMutation.mutate({ standardCode: selectedStandard, specCode: selectedSpec });
                          } else {
                            scoreMutation.mutate({ standardCode: selectedStandard, specCode: selectedSpec, score: Number(val) });
                          }
                        }}
                        className={`w-7 h-7 rounded text-xs font-semibold border transition-colors ${
                          isActive
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {val}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content - flex container that includes import panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Editor/Content Area - shrinks when import panel is open */}
        <div className="flex-1 flex min-w-0 min-h-0">
          {/* Standards Editor View */}
          {activeView === 'standards' && (
            <>
              {/* Sidebar Navigation */}
              <aside
                data-tour="ss-rail"
                className={`flex-shrink-0 transition-all duration-300 ${
                  sidebarCollapsed ? 'w-0' : 'w-72'
                }`}
              >
                {!sidebarCollapsed && (
                  <StandardsNavigation
                    standards={navigationData as any}
                    selectedStandard={selectedStandard}
                    selectedSpec={selectedSpec}
                    onSelectStandard={(code) => {
                      setSelectedStandard(code);
                      const standard = standards?.find((s) => s.code === code);
                      setSelectedSpec((standard?.specifications || [])[0]?.code || null);
                    }}
                    onSelectSpec={(standardCode, specCode) => {
                      setSelectedStandard(standardCode);
                      setSelectedSpec(specCode);
                    }}
                  />
                )}
              </aside>

              {/* Sidebar Toggle */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="flex-shrink-0 w-6 bg-gray-100 hover:bg-gray-200 flex items-center justify-center border-l border-r border-gray-200 transition-colors"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                )}
              </button>

              {/* Editor Area */}
              <main className="flex-1 flex flex-col p-2 min-w-0">
              {/* Navigation Breadcrumb */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>Standard {selectedStandard}</span>
                  {selectedSpec && (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      <span className="text-gray-900 font-medium">
                        Specification {selectedSpec}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* CR-024 (post-apply) — Jump to matrix row from the spec
                      breadcrumb. Visible for Standards 11–21 which are the
                      only ones the CSHSE curriculum matrices cover. Now
                      ALSO appears at the standard level (no spec selected)
                      so the coordinator can jump to the matrix from a
                      standard header rather than having to pick a spec
                      first. Without-spec → scrolls to the first spec row
                      of that standard in the matrix. */}
                  {/^(1[1-9]|2[01])$/.test(selectedStandard) && (
                    <button
                      onClick={() => {
                        setMatrixScrollTarget({
                          std: selectedStandard,
                          // Without a spec we anchor to "a" — the first sub-spec
                          // is always row 1 of that standard in the matrix.
                          spec: selectedSpec || 'a'
                        });
                        setActiveView('curriculum');
                      }}
                      className="inline-flex items-center gap-1 rounded border border-cshse-400 bg-cshse-50 px-2.5 py-1 text-xs font-medium text-cshse-800 hover:bg-cshse-100"
                      title={
                        selectedSpec
                          ? `Jump to ${selectedStandard}.${selectedSpec} in the curriculum matrix`
                          : `Jump to Standard ${selectedStandard} in the curriculum matrix`
                      }
                    >
                      <Grid3X3 className="w-3.5 h-3.5" aria-hidden />
                      {selectedSpec
                        ? `Matrix · ${selectedStandard}.${selectedSpec}`
                        : `Matrix · Standard ${selectedStandard}`}
                    </button>
                  )}
                  {/* Panel Navigation — previous / next panel in document order
                      (each Standard's Introduction then its specs, wrapping
                      between standards). Up/down and the ‹ › pair do the same. */}
                  <div className="flex items-center rounded border border-gray-300 divide-x divide-gray-300">
                    <button
                      data-testid="standards-nav-up"
                      onClick={() => navigateSpec('prev')}
                      className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-l transition-colors"
                      title="Previous panel"
                      aria-label="Previous panel"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      data-testid="standards-nav-down"
                      onClick={() => navigateSpec('next')}
                      className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-r transition-colors"
                      title="Next panel"
                      aria-label="Next panel"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Spec Navigation (‹ ›) — kept for horizontal parity. */}
                  <button
                    onClick={() => navigateSpec('prev')}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Previous specification"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigateSpec('next')}
                    className="p-2 hover:bg-gray-200 rounded transition-colors"
                    title="Next specification"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Editor Content */}
              <div data-tour="ss-editor" className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-auto p-4">
                {/* CR-071 — empty-state hint. An un-populated spec is empty BY
                    DESIGN until Approve in Review materializes content; say so
                    explicitly so a blank editor doesn't read as a broken screen
                    (Monica: "this should be empty … that looks like a mess"). */}
                {selectedSpec &&
                  getCurrentContent().trim().length === 0 &&
                  getCurrentSupportingEvidence().trim().length === 0 && (
                    <div
                      data-testid="spec-empty-hint"
                      className="mb-3 rounded border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-500"
                    >
                      This specification has no content yet. Approve its items in{' '}
                      <strong>Review</strong> to populate it here, or write directly below.
                    </div>
                  )}
                {selectedSpec ? (
                  <NarrativeEditor
                    // CR-071 — remount when the freshly-refetched submission
                    // changes the materialized content, so Open-Self-Study lands
                    // clean on the FIRST click (no stale "already-transferred"
                    // content needing a manual refresh). The signature folds in
                    // content + evidence length so empty↔populated both remount.
                    key={`${selectedStandard}-${selectedSpec}-${editorRefreshKey}-${getCurrentContent().length}:${getCurrentSupportingEvidence().length}`}
                    submissionId={submissionId}
                    standardCode={selectedStandard}
                    specCode={selectedSpec}
                    initialContent={getCurrentContent()}
                    initialSupportingEvidence={getCurrentSupportingEvidence()}
                    standardTitle={getCurrentStandardData().standardTitle}
                    standardDescription={getCurrentStandardData().standardDescription}
                    specTitle={getCurrentStandardData().specTitle}
                    standardText={getCurrentStandardData().specText}
                    onSave={handleSave}
                    onSaveSupportingEvidence={isProgramCoordinator && !isEditingDisabled ? handleSaveSupportingEvidence : undefined}
                    onCancel={isProgramCoordinator ? () => navigate('/self-study') : undefined}
                    readOnly={isEditingDisabled}
                    onSelectionChange={isReviewer ? setEditorSelection : undefined}
                    highlightedComment={highlightedComment}
                    onEditorReady={(apiObj) => {
                      narrativeInsertRef.current = apiObj.insertHtml;
                      narrativeFlushRef.current = apiObj.flush;
                    }}
                  />
                ) : null}
                {/* CR-049 Phase 3 — the AI Review now renders as ONE inline,
                    collapsible report inside NarrativeEditor (under the spec
                    header), driven by the same evaluation. The separate bottom
                    panel was removed so there is a single, non-contradictory
                    AI report per spec (2026-06-08). */}
                {selectedSpec && (
                  /* CR-050 — PC may mark this spec Not Applicable so it
                     does not block Final Submit. */
                  <SpecNotApplicable
                    submissionId={submissionId}
                    standardCode={selectedStandard}
                    specCode={selectedSpec}
                    excluded={
                      ((submission as any)?.standardsStatus?.[`${selectedStandard}_${selectedSpec}`]?.excluded) === true
                    }
                    excludedReason={
                      (submission as any)?.standardsStatus?.[`${selectedStandard}_${selectedSpec}`]?.excludedReason
                    }
                    canToggle={isProgramCoordinator}
                    disabled={isEditingDisabled}
                  />
                )}
                {!selectedSpec && (
                  // CR-039 Phase 2c part 2 — when only a standard is
                  // selected (no spec yet), surface the document-level +
                  // standard-level Introductions so coordinators can
                  // edit the post-Apply intros. Persistence is the
                  // saveIntroduction endpoint on the server.
                  <div className="flex flex-col gap-4 h-full">
                    <IntroductionEditor
                      key={`doc-intro-${editorRefreshKey}`}
                      submissionId={submissionId}
                      scope="document"
                      initialContent={(submission as any)?.documentIntroduction ?? ''}
                      readOnly={isEditingDisabled}
                    />
                    <IntroductionEditor
                      key={`std-intro-${selectedStandard}-${editorRefreshKey}`}
                      submissionId={submissionId}
                      scope="standard"
                      standardCode={selectedStandard}
                      initialContent={
                        ((submission as any)?.standardIntroductions instanceof Map
                          ? ((submission as any).standardIntroductions as Map<string, string>).get(selectedStandard)
                          : (submission as any)?.standardIntroductions?.[selectedStandard]) ?? ''
                      }
                      readOnly={isEditingDisabled}
                    />
                    <div className="mt-2 flex flex-col items-center justify-center text-gray-500">
                      <FileUp className="w-10 h-10 mb-2" />
                      <p className="text-sm">Select a specification on the left to edit narrative content.</p>
                    </div>
                  </div>
                )}
              </div>

            </main>

              {/* Comment Sidebar - shown for reviewers only */}
              {isReviewer && selectedSpec && userId && (
                <aside data-tour="ss-comments" className="w-80 flex-shrink-0 border-l border-gray-200 overflow-y-auto bg-white">
                  <CommentSidebar
                    submissionId={submissionId}
                    standardCode={selectedStandard}
                    specCode={selectedSpec}
                    currentUserId={userId}
                    currentUserRole={userRole as 'reader' | 'lead_reader'}
                    onCommentClick={(comment) => {
                      const needsNavigation = comment.standardCode !== selectedStandard || comment.specCode !== selectedSpec;
                      if (needsNavigation) {
                        setSelectedStandard(comment.standardCode);
                        setSelectedSpec(comment.specCode || null);
                      }
                      // Clear any existing highlight, then set new one
                      // Use timeout for cross-section nav to let editor remount
                      setHighlightedComment(null);
                      setTimeout(() => {
                        setHighlightedComment({ id: comment._id, selectedText: comment.selectedText });
                      }, needsNavigation ? 300 : 50);
                      // Auto-clear highlight after 4 seconds
                      setTimeout(() => setHighlightedComment(null), 4000);
                    }}
                    onNavigatePrev={() => navigateToCommentSection('prev')}
                    onNavigateNext={() => navigateToCommentSection('next')}
                    hasPrevComment={hasPrevComment}
                    hasNextComment={hasNextComment}
                  />
                </aside>
              )}
          </>
        )}

          {/* Curriculum Matrix View */}
          {activeView === 'curriculum' && (
            <main className="flex-1 min-h-0 overflow-hidden p-2">
              <CurriculumMatrixEditor
                submissionId={submissionId}
                scrollToSpec={matrixScrollTarget}
                onScrollConsumed={() => setMatrixScrollTarget(null)}
              />
            </main>
          )}

          {/* Supporting File Library View */}
          {activeView === 'files' && (
            <main className="flex-1 min-h-0 overflow-hidden">
              <FileLibrary
                submissionId={submissionId}
                readOnly={isEditingDisabled}
                scrollToSpec={fileScrollTarget}
                onScrollConsumed={() => setFileScrollTarget(null)}
              />
            </main>
          )}

          {/* CR-046 — Document Introduction surface. Reuses the existing
              IntroductionEditor (CR-039) with document scope; this branch
              just makes it reachable from the SELF-STUDY toolbar group
              instead of only the buried no-spec sub-state. Visible to all
              roles (readers navigate it read-only). */}
          {activeView === 'introduction' && submissionId && (
            <main className="flex-1 overflow-auto p-4">
              <div className="mx-auto max-w-4xl">
                <h2 className="mb-1 text-lg font-semibold text-gray-900">
                  Document Introduction
                </h2>
                <p className="mb-4 text-sm text-gray-500">
                  The opening narrative of your self-study — mission, program
                  description, and terms. Content imported via the Drafts
                  pipeline lands here; edit it freely before submitting.
                </p>
                <IntroductionEditor
                  key={`doc-intro-view-${editorRefreshKey}`}
                  submissionId={submissionId}
                  scope="document"
                  initialContent={(submission as any)?.documentIntroduction ?? ''}
                  readOnly={isEditingDisabled}
                  onEditorReady={(apiObj) => {
                    docIntroInsertRef.current = apiObj.insertHtml;
                    docIntroFlushRef.current = apiObj.flush;
                  }}
                />
              </div>
            </main>
          )}

          {/* AI Import Wizard View (Sprint 1). CR-043 follow-on:
              pass setActiveView down so the wizard's Open-Review CTA
              flips us to the toolbar Review surface directly (no more
              wizard-internal Review/Matrix/Apply steps). */}
          {activeView === 'ai-import' && isProgramCoordinator && submissionId && (
            <main className="flex-1 min-h-0 overflow-hidden p-2">
              <AIImportWizard submissionId={submissionId} setActiveView={setActiveView} />
            </main>
          )}

          {/* CR-043 — Review surface, decoupled from the wizard.
              State comes from Submission.aiReviewState. */}
          {activeView === 'review-surface' && canReviewSurface && submissionId && (
            <main className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <SurfaceErrorBoundary label="Review" onReset={() => window.location.reload()}>
                <ReviewSurface
                  submissionId={submissionId}
                  onClose={() => setActiveView('standards')}
                  onOpenFileLibrary={() => setActiveView('files')}
                />
              </SurfaceErrorBoundary>
            </main>
          )}

          {/* CR-043 — Matrix surface, decoupled from the wizard. */}
          {activeView === 'matrix-surface' && isProgramCoordinator && submissionId && (
            <main className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <MatrixSurface
                submissionId={submissionId}
                onClose={() => setActiveView('standards')}
              />
            </main>
          )}

          {/* Lead Reader Report — board-facing "Report to VPA to Request Board
              Action". Lead reader (assigned) + admin / superuser only. */}
          {activeView === 'lead-reader-report' && canViewLeadReaderReport && submissionId && (
            <main className="flex-1 min-h-0 overflow-auto">
              <SurfaceErrorBoundary label="Lead Reader Report" onReset={() => window.location.reload()}>
                <LeadReaderReportPage submissionId={submissionId} />
              </SurfaceErrorBoundary>
            </main>
          )}
        </div>

        {/* CR-059 — Import file drawer (replaces the legacy importer). Renders
            alongside whatever editor view is active so a selected section can be
            pasted into the visible narrative or the file's evidence summary. */}
        {showImportFile && isProgramCoordinator && submissionId && (() => {
          const canPasteNarrative =
            (activeView === 'standards' && !!selectedSpec) ||
            activeView === 'introduction';
          const narrativeTargetLabel =
            activeView === 'introduction'
              ? 'Introduction'
              : selectedSpec
              ? `Standard ${selectedStandard}.${selectedSpec}`
              : '';
          const onPasteNarrative = (html: string) => {
            if (activeView === 'standards' && selectedSpec && narrativeInsertRef.current) {
              narrativeInsertRef.current(html);
            } else if (activeView === 'introduction' && docIntroInsertRef.current) {
              docIntroInsertRef.current(html);
            }
          };
          return (
            <ImportFilePanel
              submissionId={submissionId}
              standardCode={selectedStandard}
              specCode={selectedSpec}
              canPasteNarrative={canPasteNarrative}
              narrativeTargetLabel={narrativeTargetLabel}
              onPasteNarrative={onPasteNarrative}
              onClose={() => setShowImportFile(false)}
              readOnly={isEditingDisabled}
            />
          );
        })()}

        {/* Import Document Side Panel - Part of layout, not overlay */}
        {showImportModal && (
          <div className={`${importStep === 'manual_tagging' ? 'w-[85vw] max-w-[1400px]' : 'w-[420px]'} h-full max-h-full flex-shrink-0 border-l border-gray-200 bg-white shadow-lg flex flex-col transition-all duration-300 overflow-hidden`}>
            {/* Panel Header */}
            <div className={`flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 ${
              importStep === 'review' ? 'bg-teal-50' : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-3">
                <Upload className="w-5 h-5 text-teal-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {importStep === 'review' ? 'Import Review' : 'Import Document'}
                </h2>
                {/* Show resuming indicator if we have existing import info */}
                {importStep === 'manual_tagging' && existingImportInfo && (
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                    Resuming
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Save Progress & Exit - shown during manual tagging */}
                {importStep === 'manual_tagging' && (
                  <button
                    onClick={handleSaveProgressAndExit}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    title="Save your progress and exit - you can resume later"
                  >
                    <Check className="w-4 h-4" />
                    Save & Exit
                  </button>
                )}
                <button
                  onClick={importStep === 'manual_tagging' ? handleSaveProgressAndExit : resetImportModal}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title={importStep === 'manual_tagging' ? "Save progress and close" : "Close"}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {/* Upload Step */}
              {importStep === 'upload' && (
                <div className="space-y-6">
                  <div className="text-center">
                    <p className="text-gray-600 mb-2">
                      Upload a PDF, Word, or PowerPoint document to import content into your self-study.
                    </p>
                    <p className="text-sm text-gray-500">
                      The document will be analyzed and content will be mapped to the appropriate standards.
                    </p>
                  </div>

                  {/* File Input */}
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      selectedFile
                        ? 'border-teal-400 bg-teal-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {selectedFile ? (
                      <div className="space-y-3">
                        <FileText className="w-12 h-12 mx-auto text-teal-600" />
                        <div>
                          <p className="font-medium text-gray-900">
                            {selectedFile.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatFileSize(selectedFile.size)}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div
                        className="cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                        <p className="font-medium text-gray-700">
                          Click to select a file
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          PDF, Word (.doc, .docx), or PowerPoint (.ppt, .pptx)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Error Message */}
                  {uploadError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{uploadError}</span>
                    </div>
                  )}

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2">
                      How it works:
                    </h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>1. Upload your existing self-study document</li>
                      <li>2. Our AI analyzes and extracts content sections</li>
                      <li>3. Content is mapped to CSHSE standards automatically</li>
                      <li>4. Review mappings and apply them to your current submission</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Processing Step - Detailed Progress */}
              {importStep === 'processing' && (
                <div className="space-y-6">
                  {/* Header with filename and elapsed time */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Processing Document
                    </h3>
                    <p className="text-sm text-gray-500">
                      {importStatus?.originalFilename || 'Your document'}
                    </p>
                    {importStatus?.progress?.elapsedTime && (
                      <p className="text-xs text-gray-400 mt-1">
                        Elapsed: {importStatus.progress.elapsedTime}
                      </p>
                    )}
                  </div>

                  {/* Progress Steps */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    {/* Step indicators */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                      {['parsing', 'analyzing', 'matching'].map((step, index) => {
                        const currentStepIndex = ['initializing', 'parsing', 'analyzing', 'matching'].indexOf(
                          importStatus?.progress?.step || 'initializing'
                        );
                        const stepIndex = index + 1;
                        const isActive = stepIndex === currentStepIndex;
                        const isComplete = stepIndex < currentStepIndex;
                        return (
                          <React.Fragment key={step}>
                            {index > 0 && (
                              <div className={`w-8 h-0.5 ${isComplete ? 'bg-teal-500' : 'bg-gray-300'}`} />
                            )}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isComplete
                                  ? 'bg-teal-500 text-white'
                                  : isActive
                                  ? 'bg-teal-100 text-teal-700 border-2 border-teal-500'
                                  : 'bg-gray-200 text-gray-500'
                              }`}
                            >
                              {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Step labels */}
                    <div className="flex justify-between text-xs text-gray-500 mb-6 px-2">
                      <span>Parsing</span>
                      <span>Analyzing</span>
                      <span>Matching</span>
                    </div>

                    {/* Current action with spinner */}
                    <div className="flex flex-col items-center justify-center gap-2 mb-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                        <span className="text-gray-700 font-medium">
                          {importStatus?.progress?.stepDescription || 'Initializing...'}
                        </span>
                      </div>
                      {/* Show helpful message when waiting for AI analysis */}
                      {importStatus?.progress?.step === 'analyzing' &&
                       importStatus?.progress?.elapsedMs &&
                       importStatus.progress.elapsedMs > 60000 && (
                        <p className="text-xs text-gray-500 text-center mt-2 max-w-xs">
                          AI analysis is in progress. Large documents may take several minutes to process.
                        </p>
                      )}
                    </div>

                    {/* Show discovered sections during parsing - show tocTitles first, then sectionTitles when available */}
                    {((importStatus?.progress?.parsingDetails?.tocEntriesFound && importStatus.progress.parsingDetails.tocEntriesFound > 0) ||
                      (importStatus?.progress?.parsingDetails?.sectionsCreated && importStatus.progress.parsingDetails.sectionsCreated > 0)) && (
                      <div className="mt-4 bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="px-3 py-2 bg-teal-50 border-b border-gray-200 flex items-center justify-between">
                          <span className="text-sm font-medium text-teal-800">
                            {importStatus?.progress?.parsingDetails?.sectionsCreated
                              ? 'Sections to Process'
                              : 'TOC Entries Found'}
                          </span>
                          <span className="text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">
                            {importStatus?.progress?.parsingDetails?.sectionsCreated || importStatus?.progress?.parsingDetails?.tocEntriesFound} found
                          </span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {/* Show sectionTitles if available, otherwise show tocTitles */}
                          {(importStatus?.progress?.parsingDetails?.sectionTitles && importStatus.progress.parsingDetails.sectionTitles.length > 0
                            ? importStatus.progress.parsingDetails.sectionTitles
                            : importStatus?.progress?.parsingDetails?.tocTitles || []
                          ).map((title, idx) => (
                            <div
                              key={idx}
                              className="px-3 py-1.5 text-xs text-gray-600 border-b border-gray-100 last:border-b-0 flex items-center gap-2"
                            >
                              <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center bg-gray-100 rounded text-gray-500 text-xs">
                                {idx + 1}
                              </span>
                              <span className="truncate">{title}</span>
                            </div>
                          ))}
                          {/* Show "and X more" for sections */}
                          {importStatus?.progress?.parsingDetails?.sectionsCreated &&
                           importStatus.progress.parsingDetails.sectionsCreated > (importStatus.progress.parsingDetails.sectionTitles?.length || 0) && (
                            <div className="px-3 py-1.5 text-xs text-gray-400 italic">
                              ... and {importStatus.progress.parsingDetails.sectionsCreated - (importStatus.progress.parsingDetails.sectionTitles?.length || 0)} more
                            </div>
                          )}
                          {/* Show "and X more" for TOC entries (when sections not yet created) */}
                          {!importStatus?.progress?.parsingDetails?.sectionsCreated &&
                           importStatus?.progress?.parsingDetails?.tocEntriesFound &&
                           importStatus.progress.parsingDetails.tocEntriesFound > (importStatus.progress.parsingDetails.tocTitles?.length || 0) && (
                            <div className="px-3 py-1.5 text-xs text-gray-400 italic">
                              ... and {importStatus.progress.parsingDetails.tocEntriesFound - (importStatus.progress.parsingDetails.tocTitles?.length || 0)} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Progress bar (when matching) */}
                    {importStatus?.progress?.step === 'matching' && importStatus.progress.totalSections > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Sections processed</span>
                          <span>{importStatus.progress.receivedSections} / {importStatus.progress.totalSections}</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-500 transition-all duration-500"
                            style={{ width: `${importStatus.progress.percentComplete}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stats summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {importStatus?.extractedContent?.pageCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Pages</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-teal-600">
                        {importStatus?.mappedCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Mapped</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">
                        {importStatus?.unmappedCount || 0}
                      </div>
                      <div className="text-xs text-gray-500">Unmapped</div>
                    </div>
                  </div>

                  {/* Recent mappings */}
                  {importStatus?.progress?.recentMappings && importStatus.progress.recentMappings.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h4 className="text-sm font-medium text-gray-700">Recent Mappings</h4>
                        <span className="text-xs text-gray-500">{importStatus.progress.recentMappings.length} mappings</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                        {importStatus.progress.recentMappings.map((mapping, index) => (
                          <div key={index} className="px-4 py-2 flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
                            <span className="font-medium text-gray-900">
                              Standard {mapping.standardCode}.{mapping.specCode}
                            </span>
                            <span className="text-gray-500">-</span>
                            <span className="text-gray-600 truncate">
                              {STANDARD_NAMES[mapping.standardCode] || 'Unknown Standard'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual Tagging Step - Horizontal Split Layout */}
              {importStep === 'manual_tagging' && (
                <div className="flex flex-col h-full -m-4">
                  {/* Main Content - Horizontal Split */}
                  <div className="flex-1 flex min-h-0">
                    {/* Left: Document Viewer (takes most space) */}
                    <div className="flex-1 flex flex-col min-h-0 min-w-0">
                      {/* Document Header */}
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                        <h3 className="text-lg font-semibold text-gray-900">Document Content</h3>
                        <p className="text-sm text-gray-500">Select text by dragging, then click "Capture Selection"</p>
                      </div>
                      {/* Document Viewer - Full Height with scroll */}
                      <div className="flex-1 min-h-0 h-full">
                        <DocumentViewer
                          importId={importId || ''}
                          htmlContent={documentHtml}
                          isLoading={isLoadingDocument}
                          error={documentError}
                          onSelectionCapture={handleSelectionCapture}
                          onRefresh={loadDocumentContent}
                          onRepairDocument={() => repairFileInputRef.current?.click()}
                          isRepairing={isRepairing}
                          hasSelection={currentSelection !== null}
                          lastSavedSection={lastSavedSection}
                          onPlaceholderInserted={handlePlaceholderInserted}
                          taggedSections={taggedSections}
                        />
                      </div>
                    </div>

                    {/* Right: Controls Panel (fixed width) */}
                    <div className="w-80 flex-shrink-0 border-l border-gray-200 flex flex-col overflow-hidden bg-gray-50">
                      {/* Section Tagger - Collapsible, open by default */}
                      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
                        <SectionTagger
                          selection={currentSelection}
                          onClearSelection={handleClearSelection}
                          onSaveSection={handleSaveSection}
                          isSaving={isSavingSection}
                          error={sectionError}
                          collapsed={sectionTaggerCollapsed}
                          onToggleCollapsed={toggleSectionTagger}
                        />
                      </div>

                      {/* Bottom Section: Tagged Sections + Footer Actions */}
                      <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Tagged Sections Header - Always visible */}
                        <button
                          onClick={toggleTaggedSections}
                          className="flex-shrink-0 px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between hover:bg-gray-200 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronDown className={`w-4 h-4 transition-transform ${showTaggedSections ? '' : '-rotate-90'}`} />
                            <h4 className="font-medium text-gray-700">Tagged Sections</h4>
                          </div>
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                            {taggedSections.length}
                          </span>
                        </button>

                        {/* Tagged Sections List - Scrollable when open */}
                        {showTaggedSections && (
                          <div className="flex-1 overflow-y-auto bg-white">
                            <TaggedSectionsList
                              sections={taggedSections}
                              isLoading={isLoadingTaggedSections}
                              onDelete={handleDeleteTaggedSection}
                              onView={handleViewTaggedSection}
                              onApply={handleApplyTaggedSection}
                              onApplyToMatrix={handleApplyToMatrix}
                              deletingId={deletingSectionId}
                              applyingId={applyingSectionId}
                            />
                          </div>
                        )}

                        {/* Footer Actions - Always at bottom */}
                        <div className="flex-shrink-0 p-3 bg-gray-50 border-t border-gray-200 flex flex-col gap-2 mt-auto">
                          <button
                            onClick={handleFinishTagging}
                            disabled={isConfirmingSelections || taggedSections.length === 0}
                            className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                          >
                            {isConfirmingSelections ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                Finish Tagging ({taggedSections.length})
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                          <button
                            onClick={handleCancelImport}
                            disabled={isConfirmingSelections}
                            className="w-full px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
                          >
                            Cancel Import
                          </button>

                          {/* Repair Document */}
                          <input
                            ref={repairFileInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.ppt,.pptx"
                            onChange={handleRepairDocument}
                            className="hidden"
                          />
                          <button
                            onClick={() => repairFileInputRef.current?.click()}
                            disabled={isRepairing || isConfirmingSelections}
                            className="w-full px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                            title="Re-upload the original document to fix display issues while keeping all tagged sections"
                          >
                            {isRepairing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Repairing...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                Repair Document
                              </>
                            )}
                          </button>
                          {repairMessage && (
                            <div className={`text-xs px-3 py-2 rounded-lg ${
                              repairMessage.type === 'success'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {repairMessage.text}
                            </div>
                          )}

                          {/* Start Over link */}
                          <div className="text-center pt-1">
                            <button
                              onClick={handleStartOver}
                              disabled={isDiscardingImport || isConfirmingSelections}
                              className="text-xs text-gray-400 hover:text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isDiscardingImport ? 'Discarding...' : 'Start Over (discard all progress)'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* View Tagged Section Modal - with sub-extraction capability */}
                  {viewingTaggedSection && (
                    <SubExtractionViewerModal
                      section={viewingTaggedSection}
                      importId={importId!}
                      submissionId={submissionId}
                      htmlContent={viewingHtmlContent}
                      textContent={viewingFullContent}
                      isLoading={isLoadingFullContent}
                      onClose={() => {
                        setViewingTaggedSection(null);
                        setViewingFullContent(null);
                        setViewingHtmlContent(null);
                      }}
                      onExtractionApplied={() => {
                        // Refresh submission data after extraction
                        queryClient.invalidateQueries({ queryKey: ['submission', submissionId] });
                      }}
                    />
                  )}

                </div>
              )}

              {/* Part 6: Section Selection Step (Legacy - kept for backwards compatibility) */}
              {importStep === 'section_selection' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      Select Sections to Process
                    </h3>
                    <p className="text-sm text-gray-500">
                      {detectedSections.length > 0 ? (
                        <>
                          {countSelectedSections(detectedSections)} of {detectedSections.reduce((acc, s) => acc + 1 + countSelectedSections(s.children), 0)} sections selected
                        </>
                      ) : (
                        'Loading sections...'
                      )}
                    </p>
                  </div>

                  {/* Select All / None */}
                  <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <button
                      onClick={() => handleSelectAllSections(true)}
                      className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => handleSelectAllSections(false)}
                      className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Select None
                    </button>
                  </div>

                  {/* Section List */}
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                    {detectedSections.map((section) => (
                      <SectionSelectionItem
                        key={section.id}
                        section={section}
                        onToggle={handleToggleSectionSelection}
                        onViewFull={handleViewDetectedSectionContent}
                        level={0}
                      />
                    ))}
                    {detectedSections.length === 0 && (
                      <div className="p-4 text-center text-gray-500">
                        No sections detected in the document
                      </div>
                    )}
                  </div>

                  {/* Error message */}
                  {uploadError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {uploadError}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleCancelImport}
                      disabled={isConfirmingSelections}
                      className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmSectionSelections}
                      disabled={isConfirmingSelections || countSelectedSections(detectedSections) === 0}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
                    >
                      {isConfirmingSelections ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Process {countSelectedSections(detectedSections)} Sections
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Full Section Content Modal */}
              {viewingFullSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {viewingFullSection.headerText}
                      </h3>
                      <button
                        onClick={() => setViewingFullSection(null)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      <div
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: viewingFullSection.htmlContent }}
                      />
                    </div>
                    <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={viewingFullSection.isSelected}
                          onChange={(e) => {
                            handleToggleSectionSelection(viewingFullSection.id, e.target.checked);
                            setViewingFullSection({ ...viewingFullSection, isSelected: e.target.checked });
                          }}
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                        />
                        Include this section for processing
                      </label>
                      <button
                        onClick={() => setViewingFullSection(null)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Review Step */}
              {importStep === 'review' && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Analysis Complete
                      </h3>
                      <p className="text-sm text-gray-600">
                        {importStatus?.mappedCount || 0} sections mapped,{' '}
                        {importStatus?.unmappedCount || 0} unmapped
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        <Check className="w-4 h-4" />
                        {importStatus?.mappedCount || 0} Mapped
                      </span>
                      {(importStatus?.unmappedCount || 0) > 0 && (
                        <span className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                          <AlertCircle className="w-4 h-4" />
                          {importStatus?.unmappedCount || 0} Unmapped
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Batch Assignment UI for All Sections */}
                  {extractedSections.length > 0 && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-800">
                          Assign Sections
                        </h4>
                        <div className="flex items-center gap-2 text-sm">
                          <button
                            onClick={selectAllSections}
                            className="text-teal-600 hover:text-teal-700 underline"
                          >
                            Select All
                          </button>
                          <span className="text-gray-400">|</span>
                          <button
                            onClick={selectNoneSections}
                            className="text-teal-600 hover:text-teal-700 underline"
                          >
                            Select None
                          </button>
                          <span className="text-gray-500 ml-2">
                            ({selectedSectionIds.size} selected)
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={batchAssignment.standardCode}
                          onChange={(e) => setBatchAssignment(prev => ({
                            ...prev,
                            standardCode: e.target.value,
                            specCode: '' // Reset spec when standard changes
                          }))}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                          disabled={batchAssignment.toCurriculumMatrix}
                        >
                          <option value="">Select Standard...</option>
                          {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                            <option key={code} value={code}>
                              Std {code}: {name}
                            </option>
                          ))}
                        </select>

                        <select
                          value={batchAssignment.specCode}
                          onChange={(e) => setBatchAssignment(prev => ({
                            ...prev,
                            specCode: e.target.value
                          }))}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                          disabled={!batchAssignment.standardCode || batchAssignment.toCurriculumMatrix}
                        >
                          <option value="">Select Spec...</option>
                          {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((spec) => (
                            <option key={spec} value={spec}>
                              Spec {spec}
                            </option>
                          ))}
                        </select>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={batchAssignment.toSupportingEvidence}
                            onChange={(e) => setBatchAssignment(prev => ({
                              ...prev,
                              toSupportingEvidence: e.target.checked,
                              toCurriculumMatrix: e.target.checked ? false : prev.toCurriculumMatrix
                            }))}
                            disabled={batchAssignment.toCurriculumMatrix}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                          />
                          Supporting Evidence
                        </label>

                        <label className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={batchAssignment.toCurriculumMatrix}
                            onChange={(e) => setBatchAssignment(prev => ({
                              ...prev,
                              toCurriculumMatrix: e.target.checked,
                              // Clear standard/spec when moving to matrix
                              standardCode: e.target.checked ? '' : prev.standardCode,
                              specCode: e.target.checked ? '' : prev.specCode,
                              toSupportingEvidence: e.target.checked ? false : prev.toSupportingEvidence
                            }))}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          To Curriculum Matrix
                        </label>

                        <button
                          onClick={handleBatchMoveSections}
                          disabled={
                            isBatchMoving ||
                            selectedSectionIds.size === 0 ||
                            (!batchAssignment.toCurriculumMatrix && (!batchAssignment.standardCode || !batchAssignment.specCode))
                          }
                          className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium ${
                            batchAssignment.toCurriculumMatrix
                              ? 'bg-purple-600 hover:bg-purple-700'
                              : 'bg-teal-600 hover:bg-teal-700'
                          }`}
                        >
                          {isBatchMoving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          {batchAssignment.toCurriculumMatrix ? 'Move to Matrix' : 'Move Selected'} ({selectedSectionIds.size})
                        </button>

                        <button
                          onClick={handleBatchDiscardSections}
                          disabled={isBatchMoving || selectedSectionIds.size === 0}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                        >
                          {isBatchMoving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Discard Selected
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sections List */}
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {extractedSections.map((section) => (
                      <div
                        key={section.id}
                        className={`border rounded-lg p-4 ${
                          section.status === 'mapped'
                            ? 'border-green-200 bg-green-50'
                            : 'border-amber-200 bg-amber-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {/* Checkbox for batch selection (all sections) */}
                            <input
                              type="checkbox"
                              checked={selectedSectionIds.has(section.id)}
                              onChange={() => toggleSectionSelection(section.id)}
                              className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            />
                            {section.status === 'mapped' ? (
                              <MapPin className="w-4 h-4 text-green-600" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                            )}
                            <span className="font-medium text-gray-900">
                              {section.mapping
                                ? `Standard ${section.mapping.standardCode}${
                                    section.mapping.specCode
                                      ? `.${section.mapping.specCode}`
                                      : ''
                                  } - ${
                                    STANDARD_NAMES[section.mapping.standardCode] ||
                                    'Unknown'
                                  }`
                                : 'Unmapped Section'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Page {section.pageNumber} |{' '}
                              {Math.round(section.confidence * 100)}% confidence
                            </span>
                            <button
                              onClick={() => handleViewFullContent(section)}
                              className="p-1 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded transition-colors"
                              title="View full content"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Content preview */}
                        <div
                          className="text-sm text-gray-700 mb-3 max-h-32 overflow-y-auto border border-gray-200 bg-white rounded p-2 cursor-pointer hover:border-teal-300"
                          onClick={() => handleViewFullContent(section)}
                          dangerouslySetInnerHTML={{
                            __html: section.content.substring(0, 500) + (section.content.length > 500 ? '...' : '')
                          }}
                          title="Click to view full content"
                        />

                        {section.unmappedReason && (
                          <p className="text-xs text-amber-600 mb-3">
                            {section.unmappedReason}
                          </p>
                        )}

                        {/* Unmapped section controls */}
                        {section.status === 'unmapped' && (
                          <div className="border-t border-amber-200 pt-3 mt-3 space-y-3">
                            {/* AI suggestion if available */}
                            {section.suggestedStandardCode && (
                              <p className="text-xs text-blue-600">
                                💡 AI suggests: Standard {section.suggestedStandardCode}
                                {section.suggestedSpecCode && `.${section.suggestedSpecCode}`}
                                {section.suggestedConfidence && ` (${section.suggestedConfidence}% confidence)`}
                              </p>
                            )}

                            {/* Standard/Spec dropdowns */}
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={unmappedAssignments[section.id]?.standardCode || section.suggestedStandardCode || ''}
                                onChange={(e) => {
                                  updateUnmappedAssignment(section.id, {
                                    standardCode: e.target.value,
                                    specCode: '' // Reset spec when standard changes
                                  });
                                }}
                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                                disabled={unmappedAssignments[section.id]?.toCurriculumMatrix}
                              >
                                <option value="">Select Standard...</option>
                                {Object.entries(STANDARD_NAMES).map(([code, name]) => (
                                  <option key={code} value={code}>
                                    Std {code}: {name}
                                  </option>
                                ))}
                              </select>

                              <select
                                value={unmappedAssignments[section.id]?.specCode || section.suggestedSpecCode || ''}
                                onChange={(e) => {
                                  updateUnmappedAssignment(section.id, { specCode: e.target.value });
                                }}
                                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:opacity-50 disabled:bg-gray-100"
                                disabled={(!unmappedAssignments[section.id]?.standardCode && !section.suggestedStandardCode) || unmappedAssignments[section.id]?.toCurriculumMatrix}
                              >
                                <option value="">Select Spec...</option>
                                {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((spec) => (
                                  <option key={spec} value={spec}>
                                    Spec {spec}
                                  </option>
                                ))}
                              </select>

                              <label className="flex items-center gap-1 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={unmappedAssignments[section.id]?.toSupportingEvidence || false}
                                  onChange={(e) => {
                                    updateUnmappedAssignment(section.id, {
                                      toSupportingEvidence: e.target.checked,
                                      toCurriculumMatrix: e.target.checked ? false : unmappedAssignments[section.id]?.toCurriculumMatrix
                                    });
                                  }}
                                  disabled={unmappedAssignments[section.id]?.toCurriculumMatrix}
                                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                                />
                                Evidence
                              </label>

                              <label className="flex items-center gap-1 text-xs text-purple-700">
                                <input
                                  type="checkbox"
                                  checked={unmappedAssignments[section.id]?.toCurriculumMatrix || false}
                                  onChange={(e) => {
                                    updateUnmappedAssignment(section.id, {
                                      toCurriculumMatrix: e.target.checked,
                                      // Clear standard/spec when moving to matrix
                                      standardCode: e.target.checked ? '' : unmappedAssignments[section.id]?.standardCode,
                                      specCode: e.target.checked ? '' : unmappedAssignments[section.id]?.specCode,
                                      toSupportingEvidence: e.target.checked ? false : unmappedAssignments[section.id]?.toSupportingEvidence
                                    });
                                  }}
                                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                />
                                Matrix
                              </label>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleMoveUnmapped(section.id)}
                                disabled={
                                  movingSection === section.id ||
                                  (!unmappedAssignments[section.id]?.toCurriculumMatrix &&
                                    ((!unmappedAssignments[section.id]?.standardCode && !section.suggestedStandardCode) ||
                                    (!unmappedAssignments[section.id]?.specCode && !section.suggestedSpecCode)))
                                }
                                className={`flex items-center gap-1 px-3 py-1 text-xs text-white rounded disabled:opacity-50 disabled:cursor-not-allowed ${
                                  unmappedAssignments[section.id]?.toCurriculumMatrix
                                    ? 'bg-purple-600 hover:bg-purple-700'
                                    : 'bg-teal-600 hover:bg-teal-700'
                                }`}
                              >
                                {movingSection === section.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                {unmappedAssignments[section.id]?.toCurriculumMatrix ? 'Move to Matrix' : 'Move to Spec'}
                              </button>
                              <button
                                onClick={() => handleDiscardUnmapped(section.id)}
                                disabled={movingSection === section.id}
                                className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Discard
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Error Message */}
                  {uploadError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm">{uploadError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer - flex-shrink-0 ensures buttons are always visible */}
            <div className="flex-shrink-0 flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50">
              {/* Close/Cancel button - different behavior based on step */}
              {importStep === 'processing' ? (
                <button
                  onClick={handleCancelImport}
                  disabled={isCancelling}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isCancelling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Cancel Import
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={resetImportModal}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {importStep === 'review' ? 'Close' : 'Cancel'}
                </button>
              )}

              {importStep === 'upload' && (
                <button
                  onClick={handleUploadImport}
                  disabled={!selectedFile || isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload & Process
                    </>
                  )}
                </button>
              )}

              {importStep === 'review' && (
                <button
                  onClick={handleApplyMappings}
                  disabled={isApplying || (importStatus?.mappedCount || 0) === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Apply {importStatus?.mappedCount || 0} Mappings
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full Content Viewer Modal */}
      {expandedSection && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-teal-600" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Section Content
                  </h2>
                  <p className="text-sm text-gray-500">
                    Page {expandedSection.pageNumber} | {Math.round(expandedSection.confidence * 100)}% confidence
                  </p>
                </div>
              </div>
              <button
                onClick={() => setExpandedSection(null)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Unmapped reason if available */}
              {expandedSection.unmappedReason && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700">
                    <strong>AI Analysis:</strong> {expandedSection.unmappedReason}
                  </p>
                </div>
              )}

              {/* AI suggestion if available */}
              {expandedSection.suggestedStandardCode && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    💡 <strong>AI Suggestion:</strong> Standard {expandedSection.suggestedStandardCode}
                    {expandedSection.suggestedSpecCode && `.${expandedSection.suggestedSpecCode}`}
                    {expandedSection.suggestedConfidence && ` (${expandedSection.suggestedConfidence}% confidence)`}
                  </p>
                </div>
              )}

              {/* Full content */}
              <div className="prose prose-sm max-w-none">
                {loadingFullContent ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                    <span className="ml-2 text-gray-500">Loading full content...</span>
                  </div>
                ) : (
                  <div
                    className="text-gray-700 leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: expandedSection.content }}
                  />
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
              <button
                onClick={() => setExpandedSection(null)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Creation Modal */}
      {showCommentModal && editorSelection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Comment</h3>
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setNewCommentContent('');
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Selected text preview */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Selected Text</label>
                <div className="px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                  <p className="text-sm text-yellow-800 italic line-clamp-4">
                    "{editorSelection.text}"
                  </p>
                </div>
              </div>

              {/* Comment textarea */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Your Comment</label>
                <textarea
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  placeholder="Write your comment..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  rows={4}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setNewCommentContent('');
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newCommentContent.trim() && editorSelection) {
                    createCommentMutation.mutate({
                      selectedText: editorSelection.text,
                      selectionStart: editorSelection.from,
                      selectionEnd: editorSelection.to,
                      content: newCommentContent.trim(),
                    });
                  }
                }}
                disabled={!newCommentContent.trim() || createCommentMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {createCommentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquarePlus className="w-4 h-4" />
                )}
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CR-006 / S2A.5 — final-submit confirm modal.
          CR-008 / S2A.2 — wired with preflight errors + warnings + "Go to". */}
      <FinalSubmitModal
        open={finalSubmitOpen}
        onClose={() => setFinalSubmitOpen(false)}
        onConfirm={handleFinalSubmitConfirm}
        validated={validationProgress.validated}
        total={validationProgress.total}
        busy={submitSelfStudyMutation.isPending}
        preflight={preflightQuery.data ?? null}
        preflightLoading={preflightQuery.isLoading}
        onGoToSpec={handleGoToSpec}
        needsImprovement={needsImprovementQuery.data ?? []}
        needsImprovementLoading={needsImprovementQuery.isLoading}
      />

          </div>
  );
}

// Progress Indicator Component
function ProgressIndicator({ submission }: { submission?: SubmissionData }) {
  const progress = React.useMemo(() => {
    const ss: any = submission?.standardsStatus || {};
    // standardsStatus is keyed by BOTH standard-level ("1") and spec-level
    // ("1_a") entries. The "Standards" stat must count STANDARDS only — the
    // old code counted every key (specs + standards), so it showed e.g. 86.
    const standardKeys = Object.keys(ss).filter((k) => !k.includes('_'));
    const total = standardKeys.length || 21;
    const hasText = (s?: string) => (s || '').replace(/<[^>]*>/g, '').trim().length > 0;
    // A standard counts as addressed when any of its specs has stored content,
    // or the standard is explicitly marked complete.
    const addressed = new Set<string>();
    for (const n of submission?.narrativeContent || []) {
      if (hasText(n.content) || hasText(n.supportingEvidenceText)) addressed.add(n.standardCode);
    }
    for (const k of standardKeys) {
      const st = ss[k]?.status;
      if (st === 'complete' || st === 'submitted' || st === 'validated') addressed.add(k);
    }
    const completed = [...addressed].filter((c) => standardKeys.includes(c)).length;
    return { completed, total };
  }, [submission]);

  const percent = Math.round((progress.completed / progress.total) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-sm text-gray-600">
        {progress.completed}/{progress.total} Standards
      </span>
    </div>
  );
}

export default SelfStudyEditor;
