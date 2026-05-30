import React from 'react';
import type { Step } from 'react-joyride';
import { t, type TFn } from '../../i18n/strings';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — Welcome-tour steps + targets.
//
// Each "logical" target gets a CSS selector here and a corresponding
// `data-tour-step="<name>"` attribute on the actual UI element. Steps
// whose targets don't exist at mount time (e.g. the Compilations nav for
// a PC) are filtered out before the array is handed to Joyride, so the
// tour adapts to whatever role the viewer has — same `welcome` tour name
// for everyone, role-aware content.
// ---------------------------------------------------------------------------

export const TOUR_TARGETS = {
  home: '[data-tour-step="home"]',
  selfStudy: '[data-tour-step="self-study"]',
  reviewQueue: '[data-tour-step="review-queue"]',
  compilations: '[data-tour-step="compilations"]',
  settings: '[data-tour-step="settings"]',
  help: '[data-tour-step="help"]',
} as const;

/**
 * DOM ids on elements the hint layer needs to anchor against. The Help
 * trigger gets one of these so the post-completion hint can position
 * itself next to the button.
 */
export const TOUR_TARGET_IDS = {
  help: 'cshse-help-trigger',
} as const;

export type Role = 'program_coordinator' | 'reader' | 'lead_reader' | 'admin' | 'superuser';

export interface WelcomeTourStepsOptions {
  /** Effective role of the viewer; controls which steps are kept. */
  role: Role;
  /** Translator (defaults to the global `t`). Passed in for testability. */
  translate?: TFn;
}

/**
 * Returns the Joyride step array for the welcome tour, filtered for the
 * viewer's role. The "core" steps (intro, home, help, last) are always
 * shown; the role-specific steps drop out when they don't apply.
 */
export function getWelcomeTourSteps(opts: WelcomeTourStepsOptions): Step[] {
  const translate = opts.translate ?? t;
  const all: Array<Step & { _showForRoles?: ReadonlyArray<Role> }> = [
    {
      target: 'body',
      placement: 'center',
      content: translate('tour.welcome.intro'),
      disableBeacon: true,
    },
    {
      target: TOUR_TARGETS.home,
      placement: 'bottom',
      content: translate('tour.welcome.home'),
      disableBeacon: true,
    },
    {
      target: TOUR_TARGETS.selfStudy,
      placement: 'bottom',
      content: translate('tour.welcome.selfStudy'),
      disableBeacon: true,
      _showForRoles: ['program_coordinator', 'admin', 'superuser'],
    },
    {
      target: TOUR_TARGETS.reviewQueue,
      placement: 'bottom',
      content: translate('tour.welcome.reviewQueue'),
      disableBeacon: true,
      _showForRoles: ['reader', 'lead_reader', 'admin', 'superuser'],
    },
    {
      target: TOUR_TARGETS.compilations,
      placement: 'bottom',
      content: translate('tour.welcome.compilations'),
      disableBeacon: true,
      _showForRoles: ['lead_reader', 'admin', 'superuser'],
    },
    {
      target: TOUR_TARGETS.settings,
      placement: 'bottom',
      content: translate('tour.welcome.settings'),
      disableBeacon: true,
      _showForRoles: ['admin', 'superuser'],
    },
    {
      target: TOUR_TARGETS.help,
      placement: 'bottom',
      content: translate('tour.welcome.help'),
      disableBeacon: true,
    },
    {
      target: 'body',
      placement: 'center',
      content: translate('tour.welcome.lastStep'),
      disableBeacon: true,
    },
  ];

  return all
    .filter((step) => !step._showForRoles || step._showForRoles.includes(opts.role))
    .map(({ _showForRoles, ...rest }) => rest);
}
