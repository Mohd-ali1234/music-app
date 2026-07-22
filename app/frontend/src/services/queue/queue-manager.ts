import { api, Song } from "../../lib/api";

export class QueueManager {
  private songs: Song[] = [];
  private currentIndex = -1;

  async createSession(
    seed: Song,
    sourceSongs: Song[] = [],
    startIndex = 0,
    preserveSourceOrder = false,
  ): Promise<Song[]> {
    // Only playlists own their queue. Search, home, artist and album result
    // lists are discovery surfaces, not playback queues: selecting one starts
    // radio based on the selected song and the user's listening signals.
    let playableSeed = seed;
    if (seed.id?.startsWith("external:") && seed.yt_video_id) {
      const materialized = await api.post<{ song: Song }>("/songs/materialize", {
        yt_video_id: seed.yt_video_id, title: seed.title, artist: seed.artist,
        album: seed.album, duration_sec: seed.duration, artwork_url: seed.artwork,
      });
      playableSeed = materialized.song;
    }

    if (!preserveSourceOrder) {
      try {
        const generated = await api.post<{ songs?: Song[] }>("/queue/generate", {
          seed_song_id: playableSeed.id,
          size: 25,
        });
        this.songs = generated.songs?.length ? generated.songs : [playableSeed];
      } catch {
        // Playback should still work offline or when recommendation sources fail.
        this.songs = [playableSeed];
      }
    } else {
      this.songs = [...sourceSongs];
    }
    const selectedIndex = this.songs.findIndex(
      (song) => song.id === seed.id || song.yt_video_id === seed.yt_video_id,
    );
    this.currentIndex = selectedIndex >= 0 ? selectedIndex : startIndex;
    if (this.currentIndex < 0 || this.currentIndex >= this.songs.length) {
      this.songs = [playableSeed];
      this.currentIndex = 0;
    } else {
      // Replace an external selected song with its local catalog version. The
      // remaining songs are materialized only if/when the user reaches them.
      this.songs[this.currentIndex] = playableSeed;
    }
    return this.queue;
  }

  setIndex(index: number) {
    if (index >= 0 && index < this.songs.length) this.currentIndex = index;
  }

  select(index: number): Song | null {
    this.setIndex(index);
    return this.current;
  }

  next(repeatAll = false, shuffled = false): Song | null {
    if (!this.songs.length) return null;
    if (shuffled && this.songs.length > 1) {
      let nextIndex = this.currentIndex;
      while (nextIndex === this.currentIndex) {
        nextIndex = Math.floor(Math.random() * this.songs.length);
      }
      this.currentIndex = nextIndex;
      return this.current;
    }
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

  move(from: number, to: number): boolean {
    if (
      from < 0 || from >= this.songs.length ||
      to < 0 || to >= this.songs.length || from === to
    ) return false;
    const [song] = this.songs.splice(from, 1);
    this.songs.splice(to, 0, song);
    if (this.currentIndex === from) this.currentIndex = to;
    else if (from < this.currentIndex && to >= this.currentIndex) this.currentIndex--;
    else if (from > this.currentIndex && to <= this.currentIndex) this.currentIndex++;
    return true;
  }

  remove(index: number): Song | null {
    // The UI only exposes this for upcoming songs, keeping the active player
    // intact while still allowing the rest of the queue to be edited.
    if (index < 0 || index >= this.songs.length || index === this.currentIndex) {
      return null;
    }
    const [removed] = this.songs.splice(index, 1);
    if (index < this.currentIndex) this.currentIndex--;
    return removed ?? null;
  }

  get queue() { return [...this.songs]; }
  get index() { return this.currentIndex; }
  get current() { return this.songs[this.currentIndex] ?? null; }
}

export const playbackQueue = new QueueManager();
