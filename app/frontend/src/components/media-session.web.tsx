import { useEffect } from "react";

import { usePlayer } from "@/src/lib/player";

type MediaSessionActionDetails = {
  action: string;
  seekOffset?: number;
  seekTime?: number;
  fastSeek?: boolean;
};

function hasMediaSession() {
  return (
    typeof navigator !== "undefined" &&
    "mediaSession" in navigator &&
    typeof MediaMetadata !== "undefined"
  );
}

function absoluteArtworkUrl(url?: string | null) {
  if (!url) return undefined;
  try {
    return new URL(url, window.location.href).href;
  } catch {
    return url;
  }
}

export function MediaSession() {
  const current = usePlayer((state) => state.current);
  const isPlaying = usePlayer((state) => state.isPlaying);
  const position = usePlayer((state) => state.position);
  const duration = usePlayer((state) => state.duration);

  // Action handlers are installed once. Reading Zustand directly inside each
  // handler prevents stale queue/player values after the track changes.
  useEffect(() => {
    if (!hasMediaSession()) return;

    const session = navigator.mediaSession;
    const register = (
      action: MediaSessionAction,
      handler: (details: MediaSessionActionDetails) => void,
    ) => {
      try {
        session.setActionHandler(action, handler as MediaSessionActionHandler);
      } catch {
        // Safari versions differ in which optional actions they support.
      }
    };

    register("play", () => {
      const state = usePlayer.getState();
      if (!state.isPlaying) state.togglePlay();
    });
    register("pause", () => {
      const state = usePlayer.getState();
      if (state.isPlaying) state.togglePlay();
    });
    register("nexttrack", () => {
      void usePlayer.getState().next();
    });
    register("previoustrack", () => {
      void usePlayer.getState().prev();
    });
    register("seekto", ({ seekTime }) => {
      if (typeof seekTime === "number") usePlayer.getState().seek(seekTime);
    });
    register("seekbackward", ({ seekOffset }) => {
      const state = usePlayer.getState();
      state.seek(Math.max(0, state.position - (seekOffset ?? 10)));
    });
    register("seekforward", ({ seekOffset }) => {
      const state = usePlayer.getState();
      const target = state.position + (seekOffset ?? 10);
      state.seek(state.duration > 0 ? Math.min(target, state.duration) : target);
    });

    return () => {
      const actions: MediaSessionAction[] = [
        "play",
        "pause",
        "nexttrack",
        "previoustrack",
        "seekto",
        "seekbackward",
        "seekforward",
      ];
      for (const action of actions) {
        try {
          session.setActionHandler(action, null);
        } catch {}
      }
    };
  }, []);

  useEffect(() => {
    if (!hasMediaSession()) return;

    if (!current) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = "none";
      return;
    }

    const artwork = absoluteArtworkUrl(current.artwork);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title || "Unknown title",
      artist: current.artist || "Unknown artist",
      album: current.album || "",
      artwork: artwork ? [{ src: artwork, sizes: "512x512" }] : [],
    });
  }, [current]);

  useEffect(() => {
    if (!hasMediaSession() || !current) return;

    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";

    if (Number.isFinite(duration) && duration > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: Math.min(Math.max(position, 0), duration),
        });
      } catch {
        // Duration can change while a remote stream is loading.
      }
    }
  }, [current, duration, isPlaying, position]);

  return null;
}
