import { api, Song } from "../../lib/api";

export class QueueManager {
  private songs: Song[] = [];
  private currentIndex = -1;

  async createSession(seed: Song, fallback: Song[] = []): Promise<Song[]> {
    let playableSeed = seed;
    if (seed.id.startsWith("external:") && seed.yt_video_id) {
      playableSeed = await api.post<Song>("/songs/materialize", {
        yt_video_id: seed.yt_video_id, title: seed.title, artist: seed.artist,
        album: seed.album, duration: seed.duration, artwork: seed.artwork,
      });
    }
    try {
      this.songs = await api.post<Song[]>(`/queue/generate?song_id=${encodeURIComponent(playableSeed.id)}&size=25`);
    } catch {
      // Playback remains usable if queue generation is temporarily unavailable.
      this.songs = [playableSeed, ...fallback.filter(song => song.id !== seed.id && song.id !== playableSeed.id)];
    }
    if (!this.songs.length) this.songs = [playableSeed];
    this.currentIndex = 0;
    return this.queue;
  }

  setIndex(index: number) {
    if (index >= 0 && index < this.songs.length) this.currentIndex = index;
  }

  select(index: number): Song | null {
    this.setIndex(index);
    return this.current;
  }

  next(repeatAll = false): Song | null {
    if (!this.songs.length) return null;
    if (this.currentIndex + 1 >= this.songs.length) {
      if (!repeatAll) return null;
      this.currentIndex = 0;
    } else this.currentIndex++;
    return this.current;
  }

  previous(): Song | null {
    if (!this.songs.length) return null;
    this.currentIndex = this.currentIndex <= 0 ? this.songs.length - 1 : this.currentIndex - 1;
    return this.current;
  }

  get queue() { return [...this.songs]; }
  get index() { return this.currentIndex; }
  get current() { return this.songs[this.currentIndex] ?? null; }
}

export const playbackQueue = new QueueManager();
