import React from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, MessageCircle, Sparkles } from 'lucide-react';
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
// Dropdown trigger living next to the Layout's user menu. Two items:
//   1. "Chat with us"       — opens the existing HelpChat widget via store.
//   2. "(Re)start the tour" — shown whenever the CURRENT route owns a tour
//                             (welcome on /dashboard, the screen's own tour
//                             elsewhere); label + replay flip on whether the
//                             viewer has already completed THAT tour.
//
// The trigger element carries `id={TOUR_TARGET_IDS.help}` + the
// `data-tour-step="help"` attribute so the welcome tour can spotlight
// it as its final step, AND the hint balloon can anchor to it after the
// tour finishes.
//
// Opening the dropdown dismisses any anchored hint (so the user isn't
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

  // Close on outside click — mirrors the cog dropdown pattern in
  // Layout.tsx:66-73.
  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

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
        onClick={handleToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('help.trigger.label')}
        title={t('help.trigger.label')}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
      </button>
      {open && (
        <div
          data-testid="help-menu-dropdown"
          role="menu"
          className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="help-menu-chat"
            disabled={!chatAvailable}
            title={
              chatAvailable ? undefined : t('help.menu.chatUnavailable')
            }
            onClick={onChat}
            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            <span>{t('help.menu.chat')}</span>
          </button>

          {routeTour && (
            <button
              type="button"
              role="menuitem"
              data-testid="help-menu-tour"
              onClick={onTour}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              <span>{tourLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
