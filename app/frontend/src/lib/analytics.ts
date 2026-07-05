import Constants from "expo-constants";
import { Platform } from "react-native";

import { api } from "./api";

export type PlaybackSource =
  | "search" | "home" | "playlist" | "queue" | "album" | "artist"
  | "recently_played" | "recommendation" | "unknown";

export type PlaybackContext = {
  source?: PlaybackSource;
  searchId?: string;
  selectedPosition?: number;
};

const appVersion = Constants.expoConfig?.version ?? "development";

export async function startListeningSession(songId: string, duration: number, context: PlaybackContext) {
  const response = await api.post<{ session_id: string }>("/analytics/sessions", {
    song_id: songId,
    song_duration: duration,
    playback_source: context.source ?? "unknown",
    device_platform: Platform.OS,
    app_version: appVersion,
    start_position: 0,
  });
  if (context.searchId && context.selectedPosition !== undefined) {
    api.post(`/analytics/searches/${context.searchId}/select`, {
      song_id: songId, selected_position: context.selectedPosition,
    }).catch(() => {});
  }
  return response.session_id;
}

export function heartbeat(sessionId: string, position: number, listenedSeconds: number) {
  return api.post(`/analytics/sessions/${sessionId}/heartbeat`, {
    position, listened_seconds: Math.max(0, listenedSeconds),
  });
}

export function endListeningSession(sessionId: string, position: number, listenedSeconds: number, reason: string) {
  return api.post(`/analytics/sessions/${sessionId}/end`, {
    position, listened_seconds: Math.max(0, listenedSeconds), reason,
  });
}

export function trackEvent(eventType: string, songId?: string, sessionId?: string | null,
                           currentPosition = 0, metadata: Record<string, unknown> = {}) {
  return api.post("/analytics/events", {
    event_type: eventType, song_id: songId, session_id: sessionId,
    current_position: currentPosition, metadata,
  });
}
