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

export async function startListeningSession(_songId: string, _duration: number, context: PlaybackContext) {
  const response = await api.post<{ session_id: string }>("/analytics/session/start", {
    device: `${Platform.OS} ${appVersion}`,
    context: context.source ?? "unknown",
  });
  return response.session_id;
}

export function heartbeat(sessionId: string, songId: string, position: number, _listenedSeconds: number) {
  return api.post("/analytics/session/heartbeat", {
    session_id: sessionId,
    song_id: songId,
    position_sec: Math.max(0, position),
  });
}

export function endListeningSession(sessionId: string, _position: number, listenedSeconds: number, _reason: string) {
  return api.post("/analytics/session/end", {
    session_id: sessionId,
    duration_sec: Math.max(0, listenedSeconds),
  });
}

export function trackEvent(eventType: string, songId?: string, sessionId?: string | null,
                           currentPosition = 0, metadata: Record<string, unknown> = {}) {
  return api.post("/analytics/event", {
    type: eventType, song_id: songId,
    context: { session_id: sessionId, current_position: currentPosition, ...metadata },
  });
}
