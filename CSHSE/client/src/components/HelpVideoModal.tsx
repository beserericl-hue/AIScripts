import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Loader2, MessageCircle, Sparkles, X, PlayCircle } from 'lucide-react';
import { api } from '../services/api';
import { HELP_SCREEN_TITLES } from '../lib/helpScreens';

// The "?" help window: this screen's narrated video, a PDF of the narration
// with screenshots, and the existing chat + guided-tour entry points.

export interface HelpVideoLinks {
  screenId: string;
  title: string;
  summary?: string;
  durationSec?: number;
  updatedAt?: string;
  videoUrl: string;
  pdfUrl: string | null;
}

export interface HelpVideoModalProps {
  open: boolean;
  screenId: string | null;
  onClose: () => void;
  /** Chat entry (null hides it). */
  chat?: { available: boolean; unavailableHint?: string; label: string; onClick: () => void } | null;
  /** Guided tour entry for this screen (null hides it). */
  tour?: { label: string; onClick: () => void } | null;
}

function fmtDuration(s?: number): string {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function HelpVideoModal({ open, screenId, onClose, chat, tour }: HelpVideoModalProps): JSX.Element | null {
  const q = useQuery({
    queryKey: ['help-video-links', screenId],
    enabled: open && !!screenId,
    retry: false,
    staleTime: 30 * 60 * 1000, // links are valid for hours
    queryFn: async () => {
      try {
        return (await api.get(`/api/help-videos/${screenId}/links`)).data as HelpVideoLinks;
      } catch (e: any) {
        if (e?.response?.status === 404) return null;
        throw e;
      }
    },
  });

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const v = q.data;
  const title = v?.title || (screenId ? HELP_SCREEN_TITLES[screenId] : '') || 'Help';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="help-video-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-video-title"
        className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Help for this screen</p>
            <h2 id="help-video-title" className="truncate text-lg font-semibold text-gray-900">
              {title}
            </h2>
            {v?.summary && <p className="mt-0.5 text-sm text-gray-600">{v.summary}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            data-testid="help-video-close"
            className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-gray-950">
          {q.isLoading ? (
            <div className="flex aspect-video items-center justify-center text-gray-300">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading the video…
            </div>
          ) : v ? (
            <video
              key={v.videoUrl}
              data-testid="help-video-player"
              className="block aspect-video w-full bg-black"
              src={v.videoUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-2 px-6 text-center text-gray-200" data-testid="help-video-missing">
              <PlayCircle className="h-10 w-10 text-gray-400" />
              <p className="text-base font-medium">
                {q.isError ? 'The help video could not be loaded right now.' : 'A video for this screen is coming soon.'}
              </p>
              <p className="text-sm text-gray-400">You can still chat with us or take the guided tour below.</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 px-5 py-3">
          {v?.pdfUrl && (
            <>
              <a
                href={`${v.pdfUrl}?download=1`}
                data-testid="help-video-pdf"
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700"
              >
                <Download className="h-4 w-4" /> Download the PDF
              </a>
              <a
                href={v.pdfUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="help-video-pdf-view"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <FileText className="h-4 w-4" /> Open the PDF
              </a>
            </>
          )}
          {v?.durationSec ? <span className="text-xs text-gray-500">Video · {fmtDuration(v.durationSec)}</span> : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {tour && (
              <button
                type="button"
                data-testid="help-menu-tour"
                onClick={tour.onClick}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Sparkles className="h-4 w-4" /> {tour.label}
              </button>
            )}
            {chat && (
              <button
                type="button"
                data-testid="help-menu-chat"
                disabled={!chat.available}
                title={chat.available ? undefined : chat.unavailableHint}
                onClick={chat.onClick}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle className="h-4 w-4" /> {chat.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HelpVideoModal;
