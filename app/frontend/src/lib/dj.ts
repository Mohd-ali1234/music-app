import { create } from "zustand";

import {
  DJCycle,
  DJConfig,
  DJInsight,
  DJNarration,
  DJSignals,
  TrackReason,
  djClient,
  safeDJCall,
} from "@/src/services/dj/dj-client";

/**
 * Client-side AI DJ state.
 *
 * Deliberately holds no audio and no queue. The player store owns playback;
 * this store owns the DJ *conversation* — the session id, the latest decision,
 * whatever the DJ last said, and the settings. When a cycle returns a rebuilt
 * queue, the player asks for it and applies it; this store never reaches into
 * the player, which keeps the dependency one-directional and avoids a cycle.
 */

/** How long a narration line stays on screen before it is cleared. */
const NARRATION_TTL_MS = 12_000;

export type DJState = {
  config: DJConfig | null;
  sessionId: string | null;
  intent: DJCycle["intent"] | null;
  reason: string | null;
  signals: DJSignals | null;
  notes: string[];
  narration: DJNarration | null;
  insight: DJInsight | null;
  insightLoading: boolean;
  /** Increments on every rebuilt queue; useful as a render key. */
  queueVersion: number;

  loadConfig: () => Promise<DJConfig | null>;
  updateConfig: (patch: Partial<DJConfig>) => Promise<void>;
  startSession: (seedSongId: string) => Promise<DJCycle | null>;
  observe: (input: {
    songId: string;
    listenedSeconds: number;
    durationSeconds: number;
    reason: TrackReason;
    currentSongId?: string;
  }) => Promise<DJCycle | null>;
  advance: (currentSongId: string, forceRefresh?: boolean) => Promise<DJCycle | null>;
  loadInsight: () => Promise<void>;
  dismissNarration: () => void;
  endSession: () => Promise<void>;
  reset: () => void;
};

let narrationTimer: ReturnType<typeof setTimeout> | null = null;

export const useDJ = create<DJState>((set, get) => ({
  config: null,
  sessionId: null,
  intent: null,
  reason: null,
  signals: null,
  notes: [],
  narration: null,
  insight: null,
  insightLoading: false,
  queueVersion: 0,

  loadConfig: async () => {
    const result = await safeDJCall(() => djClient.getConfig());
    if (result) set({ config: result.config });
    return result?.config ?? null;
  },

  updateConfig: async (patch) => {
    // Optimistic: settings UI should feel instant. A failed write is
    // reconciled on the next loadConfig.
    const current = get().config;
    if (current) set({ config: { ...current, ...patch } });
    const result = await safeDJCall(() => djClient.updateConfig(patch));
    if (result) set({ config: result.config });
  },

  startSession: async (seedSongId) => {
    if (get().config?.enabled === false) return null;
    const cycle = await safeDJCall(() => djClient.startSession(seedSongId));
    if (cycle) applyCycle(set, cycle);
    return cycle;
  },

  observe: async (input) => {
    const sessionId = get().sessionId;
    if (!sessionId || get().config?.enabled === false) return null;
    const cycle = await safeDJCall(() => djClient.observe(sessionId, input));
    if (cycle) applyCycle(set, cycle);
    return cycle;
  },

  advance: async (currentSongId, forceRefresh = false) => {
    const sessionId = get().sessionId;
    if (!sessionId || get().config?.enabled === false) return null;
    const cycle = await safeDJCall(() =>
      djClient.advance(sessionId, currentSongId, forceRefresh),
    );
    if (cycle) applyCycle(set, cycle);
    return cycle;
  },

  loadInsight: async () => {
    const sessionId = get().sessionId;
    if (!sessionId) return;
    set({ insightLoading: true });
    const result = await safeDJCall(() => djClient.getInsights(sessionId));
    set({ insight: result?.insight ?? null, insightLoading: false });
  },

  dismissNarration: () => {
    if (narrationTimer) {
      clearTimeout(narrationTimer);
      narrationTimer = null;
    }
    set({ narration: null });
  },

  endSession: async () => {
    const sessionId = get().sessionId;
    if (sessionId) await safeDJCall(() => djClient.endSession(sessionId));
    get().reset();
  },

  reset: () => {
    if (narrationTimer) {
      clearTimeout(narrationTimer);
      narrationTimer = null;
    }
    set({
      sessionId: null,
      intent: null,
      reason: null,
      signals: null,
      notes: [],
      narration: null,
      insight: null,
      queueVersion: 0,
    });
  },
}));

/** Fold one DJ cycle into the store, scheduling narration expiry. */
function applyCycle(
  set: (partial: Partial<DJState>) => void,
  cycle: DJCycle,
): void {
  set({
    sessionId: cycle.session_id,
    intent: cycle.intent,
    reason: cycle.reason,
    signals: cycle.signals,
    notes: cycle.notes ?? [],
    queueVersion: cycle.queue_version,
  });

  if (cycle.narration) {
    if (narrationTimer) clearTimeout(narrationTimer);
    set({ narration: cycle.narration });
    narrationTimer = setTimeout(() => {
      useDJ.setState({ narration: null });
      narrationTimer = null;
    }, NARRATION_TTL_MS);
  }
}

/** Human-readable label for a DJ intent, for compact UI surfaces. */
export const DJ_INTENT_LABELS: Record<DJCycle["intent"], string> = {
  warm_up: "Warming up",
  hold_vibe: "Holding the vibe",
  deepen: "Going deeper",
  pivot: "Changing direction",
  refresh: "Rotating artists",
  lift_energy: "Lifting energy",
  cool_down: "Winding down",
  rediscover: "Resurfacing favourites",
};
