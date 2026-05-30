import { create } from 'zustand';

// ---------------------------------------------------------------------------
// CR-052 / Sprint 7 — tiny store lifting HelpChat's open-state so the new
// HelpMenu dropdown can open the existing chat widget programmatically
// without coupling the two components.
//
// HelpChat's local `useState(isOpen)` is replaced by this store; behavior
// of the chat widget itself is unchanged.
// ---------------------------------------------------------------------------

interface HelpChatState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useHelpChatStore = create<HelpChatState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}));
