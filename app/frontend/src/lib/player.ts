import { create } from "zustand";
import { createAudioPlayer, AudioPlayer, setAudioModeAsync } from "expo-audio";
import { api, Song } from "./api";
import {
  PlaybackContext,
  PlaybackSource,
  recordListen,
} from "./analytics";
import { playbackQueue } from "../services/queue/queue-manager";
import { resolveStreamUrl } from "@/modules/native-stream-resolver/src";

// Identifies the newest playback request. Stream/materialization requests can
// finish out of order, but only the latest request may create an audio player.
let playbackRequestId = 0;
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

function finishListening(
  song: Song | null,
  duration: number,
  reason: "skipped" | "completed" | "stopped",
) {
  collectListeningTime(false);
  const seconds = unreportedListeningSeconds;
  unreportedListeningSeconds = 0;
  if (!song?.id || seconds <= 0) return;
  recordListen(song.id, seconds, duration || song.duration || 1, reason).catch(() => {});
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
  playQueue: (
    songs: Song[],
    startIndex?: number,
    context?: PlaybackContext | PlaybackSource,
  ) => Promise<void>;
  playFromQueue: (index: number) => Promise<void>;
  moveQueueItem: (from: number, to: number) => void;
  removeQueueItem: (index: number) => void;
  playSong: (
    song: Song,
    context?: PlaybackContext | PlaybackSource,
  ) => Promise<void>;
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
      const { songs } = await api.get<{ songs?: Song[] }>("/library/likes");
      set({ likedIds: new Set((songs ?? []).map((song) => song.id)) });
    } catch {}
  },

  toggleLike: async (songId: string) => {
    const has = get().likedIds.has(songId);
    const next = new Set(get().likedIds);
    if (has) {
      next.delete(songId);
      set({ likedIds: next });
      try {
        await api.del(`/library/likes/${songId}`);
      } catch {}
    } else {
      next.add(songId);
      set({ likedIds: next });
      try {
        await api.post("/library/likes", { song_id: songId });
      } catch {}
    }
  },

  playQueue: async (songs, startIndex = 0, context = "queue") => {
    activePlaybackContext =
      typeof context === "string" ? { source: context } : context;
    const song = songs[startIndex];
    if (!song) return;
    set({ isLoading: true });
    try {
      const queue = await playbackQueue.createSession(
        song,
        songs,
        startIndex,
        activePlaybackContext.source === "playlist",
      );
      const queueIndex = playbackQueue.index;
      set({ queue, index: queueIndex });
      await get().playSong(queue[queueIndex], context);
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

  moveQueueItem: (from, to) => {
    if (playbackQueue.move(from, to)) {
      set({ queue: playbackQueue.queue, index: playbackQueue.index });
    }
  },

  removeQueueItem: (index) => {
    if (playbackQueue.remove(index)) {
      set({ queue: playbackQueue.queue, index: playbackQueue.index });
    }
  },

  playSong: async (song, context = "unknown") => {
    const playbackContext =
      typeof context === "string" ? { source: context } : context;
    if (playbackContext.source !== "unknown")
      activePlaybackContext = playbackContext;
    const requestId = ++playbackRequestId;
    const existing = get().player;
    if (existing) finishListening(get().current, get().duration, "skipped");
    if (existing) {
      try {
        existing.pause();
        existing.remove();
      } catch {}
    }
    set({ player: null, isPlaying: false });
    let playableSong = song;
    try {
      if (song.id?.startsWith("external:") && song.yt_video_id) {
        const materialized = await api.post<{ song: Song }>(
          "/songs/materialize",
          {
            yt_video_id: song.yt_video_id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            duration_sec: song.duration,
            artwork_url: song.artwork,
          },
        );
        playableSong = materialized.song;
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
      let source: { streamUrl: string; headers?: Record<string, string> };
      try {
        if (!playableSong.yt_video_id) throw new Error("missing_yt_video_id");
        source = await resolveStreamUrl(playableSong.yt_video_id);
      } catch (nativeError) {
        console.warn("native stream resolution failed; using backend fallback", nativeError);
        const fallback = await api.get<{
          stream_url: string;
          headers?: Record<string, string>;
        }>(`/songs/stream/${playableSong.id}`);
        source = { streamUrl: fallback.stream_url, headers: fallback.headers };
      }
      if (requestId !== playbackRequestId) return;
      const p = createAudioPlayer({
        uri: source.streamUrl,
        headers: source.headers,
      });
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
        if (status.didJustFinish) {
          const { repeat } = get();
          if (repeat === "one") {
            try {
              p.seekTo(0);
              p.play();
              set({ position: 0, isPlaying: true });
            } catch {}
          } else {
            finishListening(playableSong, dur || playableSong.duration || 1, "completed");
            get().next();
          }
        }
      });
      if (requestId !== playbackRequestId) {
        try {
          p.remove();
        } catch {}
        return;
      }
      p.play();
      set({ player: p, isLoading: false, isPlaying: true });
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
    } else {
      p.play();
      set({ isPlaying: true });
      lastPlaybackTick = Date.now();
    }
  },

  next: async () => {
    const song = playbackQueue.next(get().repeat === "all", get().shuffle);
    if (!song) {
      finishListening(get().current, get().duration, "stopped");
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
    if (p) p.seekTo(sec);
    set({ position: sec });
    if (get().isPlaying) lastPlaybackTick = Date.now();
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
