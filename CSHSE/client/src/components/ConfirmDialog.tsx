import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

// Confirmation for actions that take effect immediately and can't be undone
// from the screen (revoking a key, deleting a file). The message says what
// will happen; the confirm button names the action.

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
  testId = 'confirm-dialog',
}: ConfirmDialogProps): JSX.Element | null {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" data-testid={testId}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={`${testId}-title`} className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex gap-3 p-5">
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${danger ? 'text-red-600' : 'text-amber-500'}`} />
          <div className="min-w-0">
            <h3 id={`${testId}-title`} className="text-base font-semibold text-gray-900">{title}</h3>
            <div className="mt-1 text-sm text-gray-600">{message}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            data-testid={`${testId}-cancel`}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            data-testid={`${testId}-confirm`}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-teal-600 hover:bg-teal-700'
            }`}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
