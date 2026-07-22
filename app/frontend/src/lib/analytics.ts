import { api } from "./api";

export type PlaybackSource =
  | "search" | "home" | "playlist" | "queue" | "album" | "artist"
  | "recently_played" | "recommendation" | "unknown";

export type PlaybackContext = { source?: PlaybackSource; searchId?: string; selectedPosition?: number };

/** Send one compact record when a user leaves or completes a song. */
export function recordListen(
  songId: string,
  listenedSeconds: number,
  durationSeconds: number,
  reason: "skipped" | "completed" | "stopped",
) {
  return api.post("/analytics/listen", {
    song_id: songId,
    listened_seconds: Math.max(0, listenedSeconds),
    duration_seconds: Math.max(1, durationSeconds),
    reason,
  });
}
