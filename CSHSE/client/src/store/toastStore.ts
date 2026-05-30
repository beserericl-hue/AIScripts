import { create } from 'zustand';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — minimal global toast.
//
// The CR-052 spec acceptance criterion #5 ("Persistence failures don't
// strand the UI — show an error toast") requires a tiny notification
// system the app didn't have. This is it: zustand-backed, ~50 LOC,
// matches the Tailwind style of the rest of the app. NOT a new component
// library. Future features can `push(message, 'error' | 'info')` too.
// ---------------------------------------------------------------------------

export type ToastVariant = 'info' | 'error' | 'success';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  /** Auto-dismiss timeout (ms). 0 = sticky. */
  durationMs: number;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, variant?: ToastVariant, durationMs?: number) => string;
  dismiss: (id: string) => void;
}

let _seq = 0;
function nextId(): string {
  _seq += 1;
  return `t-${Date.now().toString(36)}-${_seq}`;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, variant = 'info', durationMs = 5000) => {
    const id = nextId();
    set((s) => ({ items: [...s.items, { id, message, variant, durationMs }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
