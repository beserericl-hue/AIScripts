import React from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { HelpVideoModal } from './HelpVideoModal';
import { resolveHelpScreen, useHelpScreenStore } from '../lib/helpScreens';
import { useAuthStore } from '../store/authStore';
import { t } from '../i18n/strings';
import { useTour } from '../features/tour/TourProvider';
import { useHint } from '../features/tour/HintProvider';
import { TOUR_TARGET_IDS } from '../features/tour/welcomeTourSteps';
import { getTourDefinition } from '../features/tour/tourRegistry';
import { useHelpChatStore } from '../store/helpChatStore';
import { useHelpChatAvailable } from './HelpChat';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 (+ per-screen follow-on) — HelpMenu.
//
// The "?" in the top-right corner. Clicking it opens the help window for the
// screen on view (HelpVideoModal): that screen's narrated video + a PDF of the
// narration with screenshots, plus the two older entry points:
//   - "Chat with us"       — opens the existing HelpChat widget via store.
//   - "(Re)start the tour" — shown whenever the CURRENT route owns a tour
//                             (welcome on /dashboard, the screen's own tour
//                             elsewhere); label + replay flip on whether the
//                             viewer has already completed THAT tour.
// The screen id comes from the route + role (resolveHelpScreen), refined by
// multi-view pages through useHelpScreen().
//
// The trigger element carries `id={TOUR_TARGET_IDS.help}` + the
// `data-tour-step="help"` attribute so the welcome tour can spotlight
// it as its final step, AND the hint balloon can anchor to it after the
// tour finishes.
//
// Opening the help window dismisses any anchored hint (so the user isn't
// nagged twice).
// ---------------------------------------------------------------------------

const POST_TOUR_HINT_ID = 'welcome-tour-completed';

export interface HelpMenuProps {
  /** Optional className extension for the trigger. */
  className?: string;
}

export function HelpMenu({ className }: HelpMenuProps): JSX.Element {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const location = useLocation();

  const { tourStatus, startTour, resolveTourForRoute } = useTour();
  const { dismissHint } = useHint();
  const openHelpChat = useHelpChatStore((s) => s.open);
  const chatAvailable = useHelpChatAvailable();
  const role = useAuthStore((s) => s.getEffectiveRole());
  const override = useHelpScreenStore((s) => s.override);
  // The video for the screen on view: a multi-view page's own view wins.
  const screenId = override || resolveHelpScreen(location.pathname, role);

  // Opening the menu dismisses any anchored post-tour hint.
  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) dismissHint(POST_TOUR_HINT_ID);
      return next;
    });
  };

  const onChat = () => {
    if (!chatAvailable) return;
    openHelpChat();
    setOpen(false);
  };

  // Which tour (if any) belongs to the screen the user is currently on.
  const routeTour = resolveTourForRoute(location.pathname);
  const routeTourDef = routeTour ? getTourDefinition(routeTour) : undefined;

  const onTour = () => {
    if (!routeTour) return;
    startTour(routeTour, { autoStarted: false });
    setOpen(false);
  };

  const tourLabel = routeTourDef
    ? tourStatus[routeTourDef.name]
      ? t(routeTourDef.restartLabelKey)
      : t(routeTourDef.startLabelKey)
    : '';

  return (
    <div ref={triggerRef} className={['relative', className ?? ''].join(' ')}>
      <button
        type="button"
        id={TOUR_TARGET_IDS.help}
        data-tour-step="help"
        data-testid="help-menu-trigger"
        data-help-screen={screenId ?? ''}
        onClick={handleToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('help.trigger.label')}
        title={t('help.trigger.label')}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </button>
      <HelpVideoModal
        open={open}
        screenId={screenId}
        onClose={() => setOpen(false)}
        chat={{
          available: chatAvailable,
          unavailableHint: t('help.menu.chatUnavailable'),
          label: t('help.menu.chat'),
          onClick: onChat,
        }}
        tour={routeTour ? { label: tourLabel, onClick: onTour } : null}
      />
    </div>
  );
}
