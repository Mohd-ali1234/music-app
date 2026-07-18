import { getToken } from "./token";

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/$/, "");

export type User = {
  id: string;
  email: string;
  name?: string | null;
};

export type Song = {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  duration: number;
  artwork?: string | null;
  yt_video_id?: string;
  statistics?: {
    play_count: number;
    skip_count: number;
    repeat_count: number;
    completion_percentage: number;
    total_listening_time: number;
    average_listening_time: number;
    first_played: string;
    last_played: string;
  } | null;
};

export type ArtistResult = {
  name: string;
  artwork?: string | null;
  songs: Song[];
};

export type AlbumResult = {
  title: string;
  artist: string;
  artwork?: string | null;
  songs: Song[];
};

export type Playlist = {
  id: string;
  name: string;
  cover?: string | null;
  song_count: number;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      payload?.detail ??
        payload?.message ??
        `Request failed (${response.status})`,
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  del: <T = unknown>(path: string) => request<T>(path, { method: "DELETE" }),
};
