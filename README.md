# 🎧 Music Player

A self-hosted music streaming app with a **deterministic recommendation engine** and a **session-aware AI DJ** layered on top of it. Search and stream from YouTube, build a personal library, and let the DJ steer the queue based on what you actually skip, replay, and finish.

Two independent apps, one repo:

| | |
|---|---|
| **`app/backend`** | FastAPI + MongoDB. Search, radio/queue recommendations, the AI DJ, auth, library, playlists, analytics. Streams audio via `yt-dlp` / `ytmusicapi`. |
| **`app/frontend`** | Expo (React Native + Web) client — one codebase for iOS, Android, and desktop/web. |

---

## ✨ Highlights

- **Signal-based recommendation engine** — independent candidate sources (same artist, same album, similar artist, YouTube radio, co-occurrence) each emit scored signals; a tunable `ScoringPolicy` combines them into a curated, artist-diversified queue. No black-box ranking, no plain random sampling.
- **AI DJ that never touches playback** — a conductor observes listening behavior, decides a strategy, and *re-tunes the same recommendation engine's scoring policy* to steer the queue. Every "what plays next" decision stays deterministic arithmetic; the one LLM call (session insights/narration) sits behind its own endpoint with a fallback, off the playback path entirely.
- **On-device stream resolution** — the Android client resolves streams locally via a Chaquopy-embedded `yt-dlp` (`modules/native-stream-resolver`), falling back to the backend for iOS or on failure.
- **First-write-wins materialization** — external YouTube search results get promoted into a canonical local catalog row on first play, so plays/queues/analytics all key off stable local IDs instead of ephemeral video IDs.
- **One brutalist design system** — a single dark, high-contrast token set (`src/theme.ts`) drives every screen; a desktop shell swaps chrome only above 1024px, so the exact same navigator and screens power mobile and desktop.

---

## 🏗️ Architecture

```
                         ┌─────────────────────────┐
                         │   Expo Client (RN/Web)   │
                         │  Zustand player + DJ     │
                         └────────────┬─────────────┘
                                      │ REST (/api)
                         ┌────────────▼─────────────┐
                         │       FastAPI backend     │
                         │  routes → services →      │
                         │  repositories → core      │
                         └──┬──────────┬──────────┬──┘
                            │          │          │
                   ┌────────▼──┐ ┌─────▼─────┐ ┌──▼───────────┐
                   │  MongoDB   │ │ AI DJ      │ │ Recommendation│
                   │  catalog / │ │ conductor  │ │ engine        │
                   │  users     │ │ (tuning)   │ │ (candidates + │
                   └────────────┘ └────────────┘ │  scoring)     │
                                                  └──┬────────────┘
                                                     │
                                            ┌────────▼────────┐
                                            │ yt-dlp / ytmusicapi│
                                            │   (YouTube)        │
                                            └─────────────────┘
```

**Backend layering is strict — dependencies point inward:**

```
api/ (routes, DI)  →  services/ (use-cases)  →  repositories/ (Mongo queries)  →  core/ (config, db, security)
providers/  external integrations (YouTube, MusicBrainz) — leaf modules
domain/     song_json — the single, idempotent source of truth for the wire shape
ai/         provider-neutral LLM boundary (Gemini / OpenAI-compatible adapters)
```

**Recommendation engine** (`services/recommendation`): candidate sources emit `Candidate` objects with named signals → `ScoringPolicy` turns signals into a weighted score → `RadioEngine` merges, personalizes, scores, and lays out the queue (same-artist lead, artist-diversified tail, tunable discovery ratio). Adding a new signal is a two-line change: emit it from a source, weight it in the policy.

**AI DJ** (`services/dj`): `observe → build context → decide strategy → generate via QueueService → optimize/reorder → narrate`. It never replaces retrieval or scoring — it hands the engine a different policy. Only signals in `TUNABLE_WEIGHTS` can be re-weighted, and multipliers are clamped so a penalty can never flip positive.

---

## 🧱 Tech stack

**Backend**
- FastAPI + Uvicorn, Pydantic v2
- MongoDB via PyMongo
- JWT auth (`PyJWT` + `bcrypt`)
- `yt-dlp` + `ytmusicapi` for search/streaming, `rapidfuzz` for fuzzy ranking
- Pluggable LLM layer — Gemini or any OpenAI-compatible endpoint (Qwen / Ollama / vLLM)

**Frontend**
- Expo (React Native + Web), Expo Router (file-based routing)
- Zustand for player and DJ state
- `expo-audio` for playback, `expo-secure-store` for token storage
- Custom native module (Chaquopy) for on-device stream resolution on Android

---

## 🚀 Getting started

### Backend

```bash
cd app/backend
pip install -r requirements.txt
cp .env.example .env   # set MONGODB_URL, MONGODB_DB, JWT_SECRET, CORS_ORIGINS...
uvicorn server:app --reload --host 0.0.0.0 --port 8000
# or, on Windows: ./start.ps1
```

No automated test suite yet — validate with `python -m compileall -q app` and by exercising endpoints against a running instance.

### Frontend

```bash
cd app/frontend
npm install
npx expo start          # press w for web, or: npx expo start --web
```

Set `EXPO_PUBLIC_API_URL` if the backend isn't at `http://localhost:8000/api`. On-device stream resolution requires a custom dev client (`npx expo run:android`) — it doesn't work in Expo Go.

---

## 🔀 How data flows across the two apps

- **Materialization** — search returns external YouTube results (`id = external:<videoId>`). First play `POST`s `/songs/materialize`, which first-write-wins-creates a canonical local `songs` row; every later interaction uses that local `id`.
- **Streaming** — client tries the native Android resolver first, then falls back to `GET /songs/stream/{id}` on the backend.
- **Analytics** — one call, `POST /analytics/listen`, fired when a track ends or is left; folds into per-song/artist/album stats that drive personalization.
- **DJ observation** — the same listen event is also reported to `POST /dj/session/{id}/observe`. Most cycles change nothing; when the DJ decides to steer, only the *upcoming* queue is swapped — the currently playing track and history are untouched.

---

## 📁 Project layout

```
app/
  backend/
    app/
      api/            routes + DI wiring
      services/       search, recommendation, dj, ...
      repositories/   one per Mongo collection group
      providers/      youtube.py, musicbrainz.py
      ai/             provider-neutral LLM client
      domain/         song_json
      core/           config, database, security
  frontend/
    src/
      app/            Expo Router screens ((auth), (tabs), player, queue, dj, ...)
      lib/            player.ts (Zustand store), dj.ts, api.ts, token.ts
      services/       queue-manager, dj client services
      components/     layout/ (desktop shell), ui
    modules/
      native-stream-resolver/   on-device yt-dlp via Chaquopy
```

---

## 📌 Notes

- The public API contract (endpoints, params, response shapes) is treated as frozen — internal ranking/recommendation logic is free to evolve, new features arrive as additive routes.
- See `app/backend/ARCHITECTURE.md` and each app's `CLAUDE.md` for deeper implementation notes.
