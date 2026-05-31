import React from 'react';
import { Bug, X, Loader2 } from 'lucide-react';
import { api } from '../services/api';

// ---------------------------------------------------------------------------
// CR-016 / Sprint 7.2 — In-app bug reporter.
//
// Floating bottom-right "Report issue" button. Click opens a modal where
// the user types a free-text description; the client auto-attaches:
//   - route (window.location.pathname + search)
//   - userAgent
//   - buildSha from VITE_BUILD_SHA (if set; else "dev")
//   - recentConsoleErrors: last 10 entries captured by the global console
//     interceptor in `installConsoleErrorCapture()` (called once at app boot)
//
// Sensitive-token scrub happens server-side as defence-in-depth; the
// client doesn't try to be clever about it — it just sends what it has,
// and the server-side allowlist + regex strips known secret shapes
// (Bearer / JWT / AWS keys / password|secret|api[_-]?key tokens).
//
// Auto-screenshot (html2canvas) intentionally deferred — left as a
// follow-on CR to keep the bundle slim.
// ---------------------------------------------------------------------------

const BUFFER_LIMIT = 10;
const recentConsoleErrors: { message: string; ts: string }[] = [];

let _installed = false;
export function installConsoleErrorCapture() {
  if (_installed || typeof window === 'undefined') return;
  _installed = true;
  const origError = window.console.error.bind(window.console);
  window.console.error = (...args: unknown[]) => {
    try {
      const msg = args
        .map((a) => {
          if (a instanceof Error) return `${a.name}: ${a.message}`;
          if (typeof a === 'string') return a;
          try {
            return JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(' ');
      recentConsoleErrors.push({ message: msg.slice(0, 1024), ts: new Date().toISOString() });
      while (recentConsoleErrors.length > BUFFER_LIMIT) recentConsoleErrors.shift();
    } catch {
      /* never let our capture break console.error */
    }
    return origError(...args);
  };
  window.addEventListener('error', (e) => {
    recentConsoleErrors.push({
      message: `window.error: ${e.message} @ ${e.filename}:${e.lineno}`.slice(0, 1024),
      ts: new Date().toISOString()
    });
    while (recentConsoleErrors.length > BUFFER_LIMIT) recentConsoleErrors.shift();
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason;
    recentConsoleErrors.push({
      message: `unhandledrejection: ${reason instanceof Error ? reason.message : String(reason)}`.slice(0, 1024),
      ts: new Date().toISOString()
    });
    while (recentConsoleErrors.length > BUFFER_LIMIT) recentConsoleErrors.shift();
  });
}

/** Exposed for tests. */
export function _getCapturedConsoleErrorsForTest() {
  return recentConsoleErrors.slice();
}
/** Exposed for tests. */
export function _clearCapturedConsoleErrorsForTest() {
  recentConsoleErrors.length = 0;
}

export interface BugReporterViewProps {
  isOpen: boolean;
  description: string;
  onChangeDescription: (next: string) => void;
  onOpen: () => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting?: boolean;
  reference?: string | null;
  error?: string | null;
}

export function BugReporterView({
  isOpen,
  description,
  onChangeDescription,
  onOpen,
  onClose,
  onSubmit,
  submitting,
  reference,
  error,
}: BugReporterViewProps): JSX.Element {
  return (
    <>
      <button
        type="button"
        data-testid="bug-reporter-trigger"
        onClick={onOpen}
        title="Report an issue"
        className="fixed bottom-4 right-4 z-50 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-md hover:bg-amber-100"
      >
        <Bug className="h-4 w-4" aria-hidden />
        <span>Report issue</span>
      </button>
      {isOpen && (
        <div
          data-testid="bug-reporter-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bug-reporter-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => {
            // backdrop click closes; clicks inside the panel don't bubble out.
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <header className="mb-2 flex items-center justify-between">
              <h2 id="bug-reporter-title" className="text-base font-semibold text-slate-900">
                Tell us what went wrong
              </h2>
              <button
                type="button"
                data-testid="bug-reporter-close"
                onClick={onClose}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            {reference ? (
              <div data-testid="bug-reporter-thanks" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Thanks! Your report was sent. Reference: <span className="font-mono">{reference}</span>
              </div>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-600">
                  Describe what you were doing and what you expected to see.
                  We automatically include the page you are on, your browser, and the last few errors.
                </p>
                {error && (
                  <p data-testid="bug-reporter-error" className="mb-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-900">
                    {error}
                  </p>
                )}
                <label className="block text-xs text-slate-700">
                  What happened?
                  <textarea
                    data-testid="bug-reporter-description"
                    value={description}
                    onChange={(e) => onChangeDescription(e.target.value)}
                    rows={5}
                    placeholder="Example: I clicked Save and nothing happened."
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    data-testid="bug-reporter-submit"
                    onClick={onSubmit}
                    disabled={submitting || !description.trim()}
                    className="inline-flex items-center gap-1 rounded bg-slate-800 px-3 py-1 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    <span>Send report</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function BugReporter(): JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [reference, setReference] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Install the console-error capture once.
  React.useEffect(() => {
    installConsoleErrorCapture();
  }, []);

  const onOpen = () => {
    setError(null);
    setReference(null);
    setIsOpen(true);
  };
  const onClose = () => {
    setIsOpen(false);
    // Defer clearing the description so a "thanks" view doesn't lose context
    // before the user reads it; reset on the NEXT open.
    setTimeout(() => {
      setDescription('');
      setReference(null);
      setError(null);
    }, 300);
  };

  const onSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || 'dev';
      const res = await api.post('/api/bug-reports', {
        description,
        route: window.location.pathname + window.location.search,
        userAgent: navigator.userAgent,
        buildSha,
        recentConsoleErrors: recentConsoleErrors.slice(-BUFFER_LIMIT)
      });
      setReference(res.data?.reference || null);
    } catch (err) {
      const msg = (err as any)?.response?.data?.error || (err as Error).message || 'Failed to send report';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BugReporterView
      isOpen={isOpen}
      description={description}
      onChangeDescription={setDescription}
      onOpen={onOpen}
      onClose={onClose}
      onSubmit={onSubmit}
      submitting={submitting}
      reference={reference}
      error={error}
    />
  );
}
