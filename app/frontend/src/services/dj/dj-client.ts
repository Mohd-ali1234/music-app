import { api, Song } from "@/src/lib/api";

/**
 * Typed transport for the AI DJ endpoints.
 *
 * Every call is written to be safe to lose: the DJ enhances playback but must
 * never be able to break it. Callers use {@link safeDJCall} so a failed or
 * slow DJ request degrades to "no DJ input this cycle" rather than an error
 * surfacing in the player.
 */

export type DJIntent =
  | "warm_up"
  | "hold_vibe"
  | "deepen"
  | "pivot"
  | "refresh"
  | "lift_energy"
  | "cool_down"
  | "rediscover";

export type DJConfig = {
  enabled: boolean;
  narration_frequency: number;
  discovery_level: number;
  energy_control: boolean;
  mood_consistency: number;
  artist_diversity: number;
  learning_aggressiveness: number;
};

export type DJNarration = {
  kind: string;
  text: string;
  source: "template" | "ai";
};

export type DJSignals = {
  skip_rate: number;
  completion_rate: number;
  replay_rate: number;
  skip_streak: number;
  energy: number;
  energy_trend: number;
  energy_bias?: number;
  discovery_bias?: number;
  artist_saturation: number;
  dominant_artist: string | null;
  tracks_played: number;
  elapsed_minutes: number;
  time_of_day: "night" | "morning" | "afternoon" | "evening";
  suppressed_artists?: string[];
};

export type DJCycle = {
  session_id: string;
  intent: DJIntent;
  reason: string;
  /** True when `songs` carries a rebuilt queue. Most cycles do not. */
  refreshed: boolean;
  songs: Song[] | null;
  narration: DJNarration | null;
  queue_version: number;
  signals: DJSignals;
  notes: string[];
};

export type DJInsight = {
  summary: string;
  line: string | null;
  tags: string[];
  source: string;
};

export type TrackReason = "skipped" | "completed" | "stopped";

/** The listener's local hour, which the backend uses for time-of-day rules. */
function localHour(): number {
  return new Date().getHours();
}

export const djClient = {
  getConfig: () => api.get<{ config: DJConfig }>("/dj/config"),

  updateConfig: (patch: Partial<DJConfig>) =>
    api.put<{ config: DJConfig }>("/dj/config", patch),

  startSession: (seedSongId: string) =>
    api.post<DJCycle>("/dj/session/start", {
      seed_song_id: seedSongId,
      local_hour: localHour(),
    }),

  observe: (
    sessionId: string,
    input: {
      songId: string;
      listenedSeconds: number;
      durationSeconds: number;
      reason: TrackReason;
      currentSongId?: string;
    },
  ) =>
    api.post<DJCycle>(`/dj/session/${sessionId}/observe`, {
      song_id: input.songId,
      listened_seconds: Math.max(0, input.listenedSeconds),
      duration_seconds: Math.max(1, input.durationSeconds),
      reason: input.reason,
      current_song_id: input.currentSongId ?? input.songId,
      local_hour: localHour(),
    }),

  advance: (sessionId: string, currentSongId: string, forceRefresh = false) =>
    api.post<DJCycle>(`/dj/session/${sessionId}/advance`, {
      current_song_id: currentSongId,
      local_hour: localHour(),
      force_refresh: forceRefresh,
    }),

  getSession: (sessionId: string) =>
    api.get<{ session: unknown; signals: DJSignals }>(
      `/dj/session/${sessionId}?local_hour=${localHour()}`,
    ),

  getInsights: (sessionId: string) =>
    api.get<{ insight: DJInsight }>(
      `/dj/session/${sessionId}/insights?local_hour=${localHour()}`,
    ),

  endSession: (sessionId: string) =>
    api.post<{ ok: boolean }>(`/dj/session/${sessionId}/end`),
};

/**
 * Run a DJ request, swallowing any failure.
 *
 * The DJ is strictly additive to playback. A network error, a 404 on an
 * expired session, or a slow backend must all resolve to `null` so the caller
 * simply keeps the queue it already has.
 */
export async function safeDJCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}
