import { create } from "zustand";
import { createAudioPlayer, AudioPlayer, setAudioModeAsync } from "expo-audio";
import { api, Song } from "./api";
import { PlaybackContext, PlaybackSource, endListeningSession, heartbeat, startListeningSession, trackEvent } from "./analytics";
import { playbackQueue } from "../services/queue/queue-manager";

// Identifies the newest playback request. Stream/materialization requests can
// finish out of order, but only the latest request may create an audio player.
let playbackRequestId = 0;
let analyticsSessionId: string | null = null;
let unreportedListeningSeconds = 0;
let lastPlaybackTick = 0;
let activePlaybackContext: PlaybackContext = { source: "unknown" };

function collectListeningTime(playing: boolean) {
  const now = Date.now();
  if (playing && lastPlaybackTick) {
    // Status updates normally arrive every 500ms. The cap prevents background
    // suspension time from being misclassified as listening.
    unreportedListeningSeconds += Math.min((now - lastPlaybackTick) / 1000, 2);
  }
  lastPlaybackTick = playing ? now : 0;
}

function flushHeartbeat(position: number) {
  if (!analyticsSessionId || unreportedListeningSeconds <= 0) return;
  const sessionId = analyticsSessionId;
  const seconds = unreportedListeningSeconds;
  unreportedListeningSeconds = 0;
  heartbeat(sessionId, position, seconds).catch(() => { unreportedListeningSeconds += seconds; });
}

function finishAnalytics(position: number, reason: "skipped" | "completed" | "stopped") {
  collectListeningTime(false);
  if (!analyticsSessionId) return;
  const sessionId = analyticsSessionId;
  const seconds = unreportedListeningSeconds;
  analyticsSessionId = null;
  unreportedListeningSeconds = 0;
  endListeningSession(sessionId, position, seconds, reason).catch(() => {});
}

setAudioModeAsync({
  playsInSilentMode: true,
  shouldPlayInBackground: true,
  interruptionMode: "duckOthers",
}).catch(() => {});

type PlayerState = {
  player: AudioPlayer | null;
  queue: Song[];
  index: number;
  current: Song | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: "off" | "one" | "all";
  likedIds: Set<string>;
  // actions
  loadLiked: () => Promise<void>;
  toggleLike: (songId: string) => Promise<void>;
  playQueue: (songs: Song[], startIndex?: number, context?: PlaybackContext | PlaybackSource) => Promise<void>;
  playFromQueue: (index: number) => Promise<void>;
  playSong: (song: Song, context?: PlaybackContext | PlaybackSource) => Promise<void>;
  togglePlay: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (sec: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setPosition: (sec: number) => void;
  setDuration: (sec: number) => void;
  setPlaying: (b: boolean) => void;
};

export const usePlayer = create<PlayerState>((set, get) => ({
  player: null,
  queue: [],
  index: -1,
  current: null,
  isPlaying: false,
  isLoading: false,
  position: 0,
  duration: 0,
  shuffle: false,
  repeat: "off",
  likedIds: new Set(),

  loadLiked: async () => {
    try {
      const ids = await api.get<string[]>("/library/liked/ids");
      set({ likedIds: new Set(ids) });
    } catch {}
  },

  toggleLike: async (songId: string) => {
    const has = get().likedIds.has(songId);
    const next = new Set(get().likedIds);
    if (has) {
      next.delete(songId);
      set({ likedIds: next });
      try {
        await api.del(`/library/like/${songId}`);
        trackEvent("unliked", songId, analyticsSessionId, get().position).catch(() => {});
      } catch {}
    } else {
      next.add(songId);
      set({ likedIds: next });
      try {
        await api.post(`/library/like/${songId}`);
        trackEvent("liked", songId, analyticsSessionId, get().position).catch(() => {});
      } catch {}
    }
  },

  playQueue: async (songs, startIndex = 0, context = "queue") => {
    activePlaybackContext = typeof context === "string" ? { source: context } : context;
    const song = songs[startIndex];
    if (!song) return;
    set({ isLoading: true });
    try {
      const queue = await playbackQueue.createSession(song, songs);
      set({ queue, index: 0 });
      await get().playSong(queue[0], context);
    } catch (error) {
      console.warn("unable to create playback queue", error);
      set({ isLoading: false });
    }
  },

  playFromQueue: async (index) => {
    const song = playbackQueue.select(index);
    if (!song) return;
    set({ index: playbackQueue.index });
    await get().playSong(song, activePlaybackContext);
  },

  playSong: async (song, context = "unknown") => {
    const playbackContext = typeof context === "string" ? { source: context } : context;
    if (playbackContext.source !== "unknown") activePlaybackContext = playbackContext;
    const requestId = ++playbackRequestId;
    const existing = get().player;
    if (existing) finishAnalytics(get().position, "skipped");
    if (existing) {
      try {
        existing.pause();
        existing.remove();
      } catch {}
    }
    set({ player: null, isPlaying: false });
    let playableSong = song;
    try {
      if (song.id.startsWith("external:") && song.yt_video_id) {
        playableSong = await api.post<Song>("/songs/materialize", {
          yt_video_id: song.yt_video_id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          artwork: song.artwork,
        });
      }
      if (requestId !== playbackRequestId) return;
    } catch (e) {
      if (requestId !== playbackRequestId) return;
      console.warn("unable to prepare song", e);
      set({ isLoading: false, isPlaying: false });
      return;
    }
    set({
      current: playableSong,
      isLoading: true,
      position: 0,
      duration: playableSong.duration || 0,
      isPlaying: false,
    });
    try {
      const res = await api.get<{ url: string; headers?: Record<string, string> }>(`/songs/${playableSong.id}/stream`);
      if (requestId !== playbackRequestId) return;
      const p = createAudioPlayer({ uri: res.url, headers: res.headers });
      p.addListener("playbackStatusUpdate", (status: any) => {
        if (requestId !== playbackRequestId) return;
        if (!status) return;
        if (status.error) {
          console.warn("audio playback failed", status.error);
          set({ isLoading: false, isPlaying: false });
          return;
        }
        collectListeningTime(!!status.playing);
        const dur = status.duration ?? 0;
        const pos = status.currentTime ?? 0;
        set({
          duration: dur || get().duration,
          position: pos,
          isPlaying: !!status.playing,
        });
        if (unreportedListeningSeconds >= 10) flushHeartbeat(pos);
        if (status.didJustFinish) {
          const { repeat } = get();
          if (repeat === "one") {
            trackEvent("song_replayed", get().current?.id, analyticsSessionId, pos).catch(() => {});
            try {
              p.seekTo(0);
              p.play();
            } catch {}
          } else {
            finishAnalytics(pos, "completed");
            get().next();
          }
        }
      });
      if (requestId !== playbackRequestId) {
        try { p.remove(); } catch {}
        return;
      }
      p.play();
      set({ player: p, isLoading: false, isPlaying: true });
      startListeningSession(playableSong.id, playableSong.duration || 0, playbackContext)
        .then((id) => {
          if (requestId === playbackRequestId) analyticsSessionId = id;
          else endListeningSession(id, 0, 0, "skipped").catch(() => {});
        }).catch(() => {});
    } catch (e) {
      if (requestId !== playbackRequestId) return;
      console.warn("stream failed", e);
      set({ isLoading: false, isPlaying: false });
    }
  },

  togglePlay: () => {
    const p = get().player;
    if (!p) return;
    if (get().isPlaying) {
      collectListeningTime(false);
      p.pause();
      set({ isPlaying: false });
      flushHeartbeat(get().position);
      trackEvent("song_paused", get().current?.id, analyticsSessionId, get().position).catch(() => {});
    } else {
      p.play();
      set({ isPlaying: true });
      lastPlaybackTick = Date.now();
      trackEvent("song_resumed", get().current?.id, analyticsSessionId, get().position).catch(() => {});
    }
  },

  next: async () => {
    const song = playbackQueue.next(get().repeat === "all");
    if (!song) {
      finishAnalytics(get().position, "stopped");
      set({ isPlaying: false });
      return;
    }
    set({ index: playbackQueue.index });
    await get().playSong(song, activePlaybackContext);
  },

  prev: async () => {
    const { position } = get();
    if (position > 3 && get().player) {
      get().player!.seekTo(0);
      set({ position: 0 });
      return;
    }
    const song = playbackQueue.previous();
    if (!song) return;
    set({ index: playbackQueue.index });
    await get().playSong(song, activePlaybackContext);
  },

  seek: (sec) => {
    const p = get().player;
    const from = get().position;
    collectListeningTime(false);
    flushHeartbeat(from);
    if (p) p.seekTo(sec);
    set({ position: sec });
    if (get().isPlaying) lastPlaybackTick = Date.now();
    trackEvent("song_seeked", get().current?.id, analyticsSessionId, sec, { from_position: from, to_position: sec }).catch(() => {});
  },

  toggleShuffle: () => set({ shuffle: !get().shuffle }),
  cycleRepeat: () => {
    const r = get().repeat;
    set({ repeat: r === "off" ? "all" : r === "all" ? "one" : "off" });
  },
  setPosition: (sec) => set({ position: sec }),
  setDuration: (sec) => set({ duration: sec }),
  setPlaying: (b) => set({ isPlaying: b }),
}));

export function formatTime(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
