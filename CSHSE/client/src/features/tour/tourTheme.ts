// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — Tour visual theme.
//
// Single source of truth for the colors / z-index / button look that the
// tour-engine tooltip + the HintBalloon both consume. Keeps the visual
// language centralized so a future palette change is one file. Reads
// directly from Tailwind palette hex values so we don't depend on a
// resolved-config helper.
// ---------------------------------------------------------------------------

export const TOUR_THEME = {
  // teal-600 matches the .nav-tab-active background in index.css. Used
  // for the progress-bar fill, the primary Next/Finish button, and the
  // Joyride spotlight padding accent.
  primary: '#0d9488',
  // slate-900 for tooltip body text + headings.
  text: '#0f172a',
  // slate-200 for the progress-bar track + soft borders.
  border: '#e2e8f0',
  // The Joyride overlay scrim.
  overlay: 'rgba(15, 23, 42, 0.55)',
  // z-index of every tour-related element. Above modals (50) but below
  // the toast layer (70) so error toasts surface above the tour.
  zIndex: 60,
} as const;

export type TourTheme = typeof TOUR_THEME;
