import type { Step } from 'react-joyride';
import { t, type TFn, type StringKey } from '../../i18n/strings';
import { getWelcomeTourSteps, type Role } from './welcomeTourSteps';

// ---------------------------------------------------------------------------
// CR-052 follow-on — multi-tour registry ("help objects on every screen").
//
// The original system shipped a single `welcome` tour bolted to /dashboard.
// Users expected a guided walk-through on EVERY complex screen, on first
// visit and on demand from the help button. This registry generalizes the
// engine: each tour is a small record that knows
//   - which route(s) it belongs to (`matchRoute`),
//   - how to build its role-aware Joyride steps (`getSteps`),
//   - whether it auto-starts on first visit (`autoStart`),
//   - its help-menu labels.
//
// The TourProvider derives `tourStatus` (per-tour completion) and the
// route→tour resolvers from this list; the generic <TourRunner> renders
// whichever tour is active; <TourAutoStart> fires the first-visit tour;
// and <HelpMenu> offers "Show me around this screen" whenever the current
// route owns a tour.
//
// Step targets are plain CSS selectors. Most reuse the stable `data-testid`
// (or `data-phase`) attributes the screens already carry, so authoring a
// tour needs few or no edits to the screen itself. The runner filters out
// any step whose target isn't in the DOM at start time, so a tour adapts
// to whatever sub-state (queue vs. detail, checklist vs. itinerary) the
// screen is in.
// ---------------------------------------------------------------------------

export type TourName =
  | 'welcome'
  | 'self-study'
  | 'reader-review'
  | 'lead-compilation'
  | 'admin-settings'
  | 'site-visit';

export interface GetStepsOptions {
  role: Role;
  translate?: TFn;
}

export interface TourDefinition {
  name: TourName;
  /** True when this route is "owned" by the tour (help-menu + auto-start). */
  matchRoute: (pathname: string) => boolean;
  /** Build the role-aware Joyride step array. */
  getSteps: (opts: GetStepsOptions) => Step[];
  /** Auto-start the first time the user lands on a matching route. */
  autoStart: boolean;
  /** Help-menu label before the tour has been completed. */
  startLabelKey: StringKey;
  /** Help-menu label after the tour has been completed (replay). */
  restartLabelKey: StringKey;
}

/** A center-screen framing step (intro / outro). Target `body`, no anchor. */
function centerStep(key: StringKey, translate: TFn): Step {
  return {
    target: 'body',
    placement: 'center',
    content: translate(key),
    disableBeacon: true,
  };
}

/** An anchored step pointing at a CSS selector on the current screen. */
function anchorStep(
  target: string,
  key: StringKey,
  translate: TFn,
  placement: Step['placement'] = 'bottom'
): Step {
  return { target, placement, content: translate(key), disableBeacon: true };
}

export const TOUR_REGISTRY: ReadonlyArray<TourDefinition> = [
  {
    name: 'welcome',
    matchRoute: (p) => p === '/dashboard' || p === '/',
    getSteps: (opts) => getWelcomeTourSteps(opts),
    autoStart: true,
    startLabelKey: 'help.menu.startTour',
    restartLabelKey: 'help.menu.restartTour',
  },
  {
    name: 'self-study',
    matchRoute: (p) => p.startsWith('/self-study'),
    getSteps: ({ translate = t }) => [
      centerStep('tour.selfStudy.intro', translate),
      anchorStep('[data-testid="phase-indicator"]', 'tour.selfStudy.phases', translate),
      anchorStep('[data-phase="import"]', 'tour.selfStudy.import', translate),
      anchorStep('[data-phase="drafts"]', 'tour.selfStudy.drafts', translate),
      anchorStep('[data-phase="self-study"]', 'tour.selfStudy.write', translate),
      anchorStep('[data-phase="submit"]', 'tour.selfStudy.submit', translate),
      // Drafts → Review surface. These anchors only exist while the Review
      // screen is open, so the DOM-presence filter drops every one of them on
      // the writing screen and keeps them on the Review screen — one tour that
      // adapts to whichever sub-screen the coordinator is looking at. Authored
      // top-left → middle → right → top toolbar, matching how the eye reads it.
      anchorStep('[data-tour="review-summary"]', 'tour.review.summary', translate),
      anchorStep('[data-tour="review-rail"]', 'tour.review.rail', translate, 'right'),
      anchorStep('[data-tour="review-doc-intro"]', 'tour.review.docIntro', translate, 'right'),
      anchorStep('[data-tour="review-matrices"]', 'tour.review.matrices', translate, 'right'),
      anchorStep('[data-tour="review-supporting-evidence"]', 'tour.review.supportingEvidence', translate, 'right'),
      anchorStep('[data-tour="review-standards"]', 'tour.review.standards', translate, 'right'),
      anchorStep('[data-tour="review-cards"]', 'tour.review.cards', translate),
      anchorStep('[data-tour="review-bulk-toolbar"]', 'tour.review.bulkToolbar', translate),
      anchorStep('[data-tour="review-assign"]', 'tour.review.assign', translate),
      anchorStep('[aria-label^="AI evaluation"]', 'tour.review.aiEval', translate, 'left'),
      anchorStep('[data-tour="review-place-as"]', 'tour.review.placeAs', translate, 'left'),
      anchorStep('[data-tour="review-apply"]', 'tour.review.apply', translate),
      anchorStep('[data-tour="review-next"]', 'tour.review.next', translate),
      anchorStep('[data-tour="review-redetect"]', 'tour.review.redetect', translate),
      anchorStep('[data-testid="finish-review-cta"]', 'tour.review.finish', translate),
      anchorStep('[data-tour="review-back-to-editor"]', 'tour.review.backToEditor', translate),
      centerStep('tour.selfStudy.lastStep', translate),
    ],
    autoStart: true,
    startLabelKey: 'help.menu.tourScreen',
    restartLabelKey: 'help.menu.tourScreenAgain',
  },
  {
    name: 'reader-review',
    matchRoute: (p) => p === '/reader' || p.startsWith('/reader/'),
    getSteps: ({ translate = t }) => [
      centerStep('tour.readerReview.intro', translate),
      anchorStep('[data-testid="reader-dashboard"]', 'tour.readerReview.queue', translate),
      anchorStep('[data-testid="reader-review-screen"]', 'tour.readerReview.screen', translate),
      anchorStep('[data-testid="reader-messages-link"]', 'tour.readerReview.messages', translate),
      centerStep('tour.readerReview.lastStep', translate),
    ],
    autoStart: true,
    startLabelKey: 'help.menu.tourScreen',
    restartLabelKey: 'help.menu.tourScreenAgain',
  },
  {
    name: 'lead-compilation',
    matchRoute: (p) => p.startsWith('/lead-reader'),
    getSteps: ({ translate = t }) => [
      centerStep('tour.leadCompilation.intro', translate),
      anchorStep('[data-testid="compilation-toolbar"]', 'tour.leadCompilation.toolbar', translate),
      anchorStep('[data-testid="suggestions-export-btn"]', 'tour.leadCompilation.export', translate),
      anchorStep('[data-testid="send-to-board-open"]', 'tour.leadCompilation.sendBoard', translate),
      centerStep('tour.leadCompilation.lastStep', translate),
    ],
    autoStart: true,
    startLabelKey: 'help.menu.tourScreen',
    restartLabelKey: 'help.menu.tourScreenAgain',
  },
  {
    name: 'admin-settings',
    matchRoute: (p) => p === '/admin' || p.startsWith('/admin/settings'),
    getSteps: ({ translate = t }) => [
      centerStep('tour.adminSettings.intro', translate),
      anchorStep('[data-tour-step="admin-settings-nav"]', 'tour.adminSettings.nav', translate, 'right'),
      centerStep('tour.adminSettings.lastStep', translate),
    ],
    autoStart: true,
    startLabelKey: 'help.menu.tourScreen',
    restartLabelKey: 'help.menu.tourScreenAgain',
  },
  {
    name: 'site-visit',
    matchRoute: (p) => p.startsWith('/site-visit'),
    getSteps: ({ translate = t }) => [
      centerStep('tour.siteVisit.intro', translate),
      // Checklist sub-page anchors.
      anchorStep('[data-testid="checklist"]', 'tour.siteVisit.checklist', translate),
      anchorStep('[data-testid="checklist-toolbar"]', 'tour.siteVisit.toolbar', translate),
      // Itinerary sub-page anchors (only one set is present at a time; the
      // runner drops whichever isn't in the DOM).
      anchorStep('[data-testid="itinerary"]', 'tour.siteVisit.itinerary', translate),
      anchorStep('[data-testid="itin-toolbar"]', 'tour.siteVisit.toolbar', translate),
      centerStep('tour.siteVisit.lastStep', translate),
    ],
    autoStart: true,
    startLabelKey: 'help.menu.tourScreen',
    restartLabelKey: 'help.menu.tourScreenAgain',
  },
];

/** Every tour name (handy for building the tourStatus record). */
export const TOUR_NAMES: ReadonlyArray<TourName> = TOUR_REGISTRY.map((t2) => t2.name);

/** Look up a tour definition by name. */
export function getTourDefinition(name: TourName): TourDefinition | undefined {
  return TOUR_REGISTRY.find((d) => d.name === name);
}

/**
 * The tour that "owns" a pathname (for the help-menu "tour this screen"
 * affordance). Welcome owns /dashboard; each screen owns its own route.
 * Returns null when no tour matches.
 */
export function resolveTourForRoute(pathname: string): TourName | null {
  return TOUR_REGISTRY.find((d) => d.matchRoute(pathname))?.name ?? null;
}
