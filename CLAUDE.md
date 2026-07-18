# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

A monorepo with two independent apps under `app/`:

- **`app/backend`** — FastAPI + MongoDB service. Search, radio/queue recommendations, auth, library, playlists, analytics. Streams audio from YouTube via `yt-dlp` / `ytmusicapi`.
- **`app/frontend`** — Expo (React Native + web) client using Expo Router and a Zustand player store.

The root `package.json` is not a workspace root; run commands inside each app's directory.

## Backend (`app/backend`)

### Commands
```bash
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000   # or ./start.ps1
python -m compileall app                                  # syntax check (no DB needed)
```
`server.py` is a compatibility shim — the real app is `app.main:app`. There is **no automated test suite** configured; validate changes by importing/compiling and exercising endpoints against a running instance.

Requires a `.env` (see `.env.example`): `MONGODB_URL`, `MONGODB_DB` (legacy `MONGO_URL`/`DB_NAME` also accepted), `JWT_SECRET` (mandatory when `APP_ENV=production`), `CORS_ORIGINS`.

### Architecture
Strictly layered; dependencies point inward. Routes → services → repositories → core. See `ARCHITECTURE.md` for the full map.
- **`api/`** — thin controllers (`routes/`), DI wiring (`deps.py`), aggregate router mounting everything under `/api`.
- **`services/`** — use-cases; never touch PyMongo directly. Contains `search/` (retrieval + `SearchRanker`) and `recommendation/` (the radio engine).
- **`repositories/`** — the only place MongoDB queries live, one per collection group.
- **`providers/`** — external integrations (`youtube.py`, `musicbrainz.py`).
- **`domain/song.py`** — `song_json` is the single source of truth for the song wire shape and is **idempotent** (safe to re-serialize).
- **`core/`** — `config` (all env parsing), `database` (lazy memoized Mongo client + index setup), `security` (JWT/bcrypt).

The recommendation engine (`services/recommendation`) is signal-based: independent **candidate sources** emit `Candidate` objects with named **signals**; `ScoringPolicy` weights them; `RadioEngine` merges, personalizes, scores, and lays out a curated queue. **To add a recommendation signal, add a source (or enrichment) and a weight in `ScoringPolicy` — nothing else.**

### Conventions that matter
- Route handlers are plain `def` (not `async`) — blocking PyMongo/`yt-dlp` calls run in FastAPI's threadpool. Keep them `def`.
- The public API contract (endpoints, request params, response envelopes) is treated as frozen. Internal ranking/recommendation improvements are fine; changing response shapes is not.
- Text normalization (`utils/text.py`) drives `*_norm` fields and dedup — use `normalize_title`/`normalize_artist`, don't hand-roll.

## Frontend (`app/frontend`)

### Commands
```bash
npm install
npx expo start          # dev server; press w for web, or: npx expo start --web
npm run lint            # expo lint
npx expo run:android    # native build (needed for on-device stream resolution)
```
**Read `app/frontend/AGENTS.md` before writing Expo code** — it pins the versioned Expo docs to consult. Import alias `@/*` maps to `./src/*`. API base URL comes from `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:8000/api`).

### Architecture
- **Expo Router** file-based routing in `src/app/` (`(auth)`, `(tabs)`, `player`, `playlist/[id]`, etc.).
- **Player** (`src/lib/player.ts`) is a Zustand store owning the audio player, queue, and analytics lifecycle. The queue is built server-side via `/queue/generate` (`src/services/queue/queue-manager.ts`), with a local fallback if that call fails.
- **Auth** — JWT bearer stored via `expo-secure-store` on native and `localStorage` on web (`src/lib/token.ts`); attached by `src/lib/api.ts`.

## Cross-app flows (span both apps)

- **Materialization**: search returns external YouTube results (`id` = `external:<videoId>`). On first play the client POSTs `/songs/materialize`, which first-write-wins-creates a canonical local `songs` row; later plays reuse it. Play/queue/stream all key off the resulting local `id`.
- **Stream resolution is dual-path**: the client first tries the **native Android resolver** (`modules/native-stream-resolver`, Chaquopy + on-device `yt-dlp`); iOS and failures fall back to the backend `GET /songs/stream/{id}`. The native module requires a **custom dev client** (not Expo Go) and an Android rebuild after changes.
- **Analytics**: `/analytics/session/*` + `/analytics/event`. The "heartbeat" is event-driven progress flushing (not a poll); play *counting* happens once on the `play` event, which feeds recommendation and profile stats.
