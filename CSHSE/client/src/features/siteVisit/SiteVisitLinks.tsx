import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, CalendarClock } from 'lucide-react';

// Entry points to a submission's site-visit pages. Before these, the
// checklist (/site-visit/:id/checklist) and itinerary (/site-visit/:id/itinerary)
// were reachable only by typing the address.
//
// Access mirrors the server: the checklist is for readers, lead readers and
// admins (program coordinators are refused — it is the readers' list of
// non-compliant items); the itinerary is shared with the PC as well.

export function canOpenChecklist(role: string | null | undefined): boolean {
  return role === 'reader' || role === 'lead_reader' || role === 'admin';
}

export function siteVisitSubmissionId(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const o = v as { _id?: unknown };
  return o._id ? String(o._id) : String(v);
}

export interface SiteVisitLinksProps {
  submissionId: string;
  role: string | null | undefined;
  /** compact = small text links (dashboard rows); default = buttons (page headers). */
  compact?: boolean;
  className?: string;
}

export function SiteVisitLinks({ submissionId, role, compact, className }: SiteVisitLinksProps): JSX.Element | null {
  if (!submissionId) return null;
  const cls = compact
    ? 'inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50';
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ''}`} data-testid={`site-visit-links-${submissionId}`}>
      {canOpenChecklist(role) && (
        <Link to={`/site-visit/${submissionId}/checklist`} className={cls} data-testid={`site-visit-checklist-link-${submissionId}`}>
          <ClipboardList className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden /> Site-visit checklist
        </Link>
      )}
      <Link to={`/site-visit/${submissionId}/itinerary`} className={cls} data-testid={`site-visit-itinerary-link-${submissionId}`}>
        <CalendarClock className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden /> Itinerary
      </Link>
    </div>
  );
}

export default SiteVisitLinks;
