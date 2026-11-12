// Which help video belongs to the screen the user is looking at.
//
// A screen is a route, refined by the viewer's role (the dashboard and the
// Reader Report look different per role) and, inside multi-view pages (the
// Self-Study editor, Admin Settings), by the view the page reports through
// useHelpScreen(). The ids are the S3 object names under help-videos/.

import { create } from 'zustand';
import { useEffect } from 'react';

export type HelpRole =
  | 'program_coordinator'
  | 'reader'
  | 'lead_reader'
  | 'admin'
  | 'board'
  | string
  | null
  | undefined;

/** Human titles, used when a screen has no video yet. */
export const HELP_SCREEN_TITLES: Record<string, string> = {
  'pc-dashboard': 'Program Coordinator dashboard',
  'self-study-home': 'Self-Study',
  'editor-import': 'Import (Upload Files)',
  'editor-import-file': 'Import file',
  'editor-review': 'Review drafts',
  'editor-introduction': 'Introduction',
  'editor-standards': 'Standards editor',
  'editor-files': 'Supporting File Library',
  'editor-submit': 'Submit for review',
  'editor-lead-reader-report': 'Lead Reader Report',
  'reader-dashboard': 'Reader dashboard',
  'reader-queue': 'Review queue',
  'reader-review': 'Reviewing a self-study',
  'reader-report': 'Reader Report',
  'reader-report-lead': 'Reader Report (lead reader)',
  messages: 'Messages',
  'lead-dashboard': 'Lead Reader dashboard',
  'lead-compilations': 'Compilations',
  'lead-compilation': 'Compilation',
  'site-visit-checklist': 'Site-visit checklist',
  'site-visit-itinerary': 'Site-visit itinerary',
  relay: 'Relay console',
  'board-dashboard': 'Board: completed Lead Reader Reports',
  'board-report': 'Board: Lead Reader Report',
  'admin-dashboard': 'Administrator dashboard',
  'admin-board-console': 'Board console',
  'admin-audit-trail': 'Audit trail',
  'admin-joint-ventures': 'Joint Ventures',
  'settings-users': 'Settings: Users',
  'settings-institutions': 'Settings: Institutions',
  'settings-joint-ventures': 'Settings: Joint Ventures',
  'settings-specs': 'Settings: Spec Documents',
  'settings-dashboard-files': 'Settings: Dashboard Files',
  'settings-help-docs': 'Settings: Help Documents',
  'settings-webhook': 'Settings: N8N Webhook',
  'settings-api-keys': 'Settings: API Keys',
  'settings-data-management': 'Settings: Data Management',
  'parser-train': 'Parser Train',
};

/** Route (+ role) → screen id. Multi-view pages override via useHelpScreen. */
export function resolveHelpScreen(pathname: string, role: HelpRole): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  const seg = p.split('/').filter(Boolean);
  const [a, b, c] = seg;
  switch (a) {
    case undefined:
    case 'dashboard':
      if (role === 'board') return 'board-dashboard';
      if (role === 'admin') return 'admin-dashboard';
      if (role === 'lead_reader') return 'lead-dashboard';
      if (role === 'reader') return 'reader-dashboard';
      return 'pc-dashboard';
    case 'board':
      return 'board-report';
    case 'self-study':
      // The editor reports its own view; this is the landing / list page.
      return 'self-study-home';
    case 'reader':
      return b ? 'reader-review' : 'reader-queue';
    case 'reader-report':
      return role === 'lead_reader' ? 'reader-report-lead' : 'reader-report';
    case 'lead-reader':
      return b ? 'lead-compilation' : 'lead-compilations';
    case 'site-visit':
      return c === 'itinerary' ? 'site-visit-itinerary' : 'site-visit-checklist';
    case 'relay':
      return 'relay';
    case 'messages':
      return 'messages';
    case 'parser-train':
      return 'parser-train';
    case 'admin':
      if (b === 'board') return 'admin-board-console';
      if (b === 'audit-trail') return 'admin-audit-trail';
      if (b === 'joint-ventures') return 'admin-joint-ventures';
      return 'settings-users';
    default:
      return null;
  }
}

interface HelpScreenState {
  /** Set by a mounted multi-view page (editor view, settings tab). */
  override: string | null;
  setOverride: (id: string | null) => void;
}

export const useHelpScreenStore = create<HelpScreenState>((set) => ({
  override: null,
  setOverride: (id) => set({ override: id }),
}));

/**
 * A page with several views calls this with the id of the view on screen;
 * the "?" then opens that view's video. Cleared when the page unmounts.
 */
export function useHelpScreen(id: string | null | undefined): void {
  const setOverride = useHelpScreenStore((s) => s.setOverride);
  useEffect(() => {
    setOverride(id || null);
    return () => setOverride(null);
  }, [id, setOverride]);
}
