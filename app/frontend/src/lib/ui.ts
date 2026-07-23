import { create } from "zustand";

/**
 * Desktop-only chrome state.
 *
 * Kept out of the player store on purpose: this is presentation state that
 * exists only in the desktop shell, and the player must stay a pure
 * playback/queue concern shared by every platform.
 */
export type UIState = {
  /** Whether the side queue panel is showing (wide desktop layouts only). */
  queuePanelOpen: boolean;
  toggleQueuePanel: () => void;
  setQueuePanelOpen: (open: boolean) => void;
};

export const useUI = create<UIState>((set, get) => ({
  queuePanelOpen: true,
  toggleQueuePanel: () => set({ queuePanelOpen: !get().queuePanelOpen }),
  setQueuePanelOpen: (open) => set({ queuePanelOpen: open }),
}));
