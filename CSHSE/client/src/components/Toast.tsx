import React from 'react';
import { X, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useToastStore, ToastItem } from '../store/toastStore';
import { t } from '../i18n/strings';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — Toast layer.
//
// Renders the global stack from `useToastStore`. Auto-dismiss per item.
// Pure Tailwind; no component library. Mounted once at the bottom of
// Layout.tsx so every page can `useToastStore.getState().push(...)`.
// ---------------------------------------------------------------------------

function variantClasses(variant: ToastItem['variant']): string {
  switch (variant) {
    case 'error':
      return 'border-red-300 bg-red-50 text-red-900';
    case 'success':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    default:
      return 'border-slate-300 bg-white text-slate-800';
  }
}

function VariantIcon({ variant }: { variant: ToastItem['variant'] }) {
  if (variant === 'error') return <AlertTriangle className="h-4 w-4" aria-hidden />;
  if (variant === 'success') return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  return <Info className="h-4 w-4" aria-hidden />;
}

function ToastEntry({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  React.useEffect(() => {
    if (item.durationMs <= 0) return;
    const id = window.setTimeout(() => dismiss(item.id), item.durationMs);
    return () => window.clearTimeout(id);
  }, [item.id, item.durationMs, dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`toast-${item.variant}`}
      className={[
        'pointer-events-auto flex max-w-md items-start gap-2 rounded-md border px-3 py-2 shadow-md',
        variantClasses(item.variant),
      ].join(' ')}
    >
      <VariantIcon variant={item.variant} />
      <p className="flex-1 text-xs leading-snug">{item.message}</p>
      <button
        type="button"
        data-testid={`toast-dismiss-${item.id}`}
        onClick={() => dismiss(item.id)}
        aria-label={t('toast.dismiss')}
        className="rounded p-0.5 text-slate-500 hover:bg-black/5 hover:text-slate-700"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function Toast(): JSX.Element | null {
  const items = useToastStore((s) => s.items);
  if (items.length === 0) return null;
  return (
    <div
      data-testid="toast-stack"
      className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col gap-2"
    >
      {items.map((item) => (
        <ToastEntry key={item.id} item={item} />
      ))}
    </div>
  );
}
