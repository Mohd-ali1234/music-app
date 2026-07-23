# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

A monorepo with two independent apps under `app/`:

- **`app/backend`** — FastAPI + MongoDB service. Search, radio/queue recommendations, the AI DJ, auth, library, playlists, analytics. Streams audio from YouTube via `yt-dlp` / `ytmusicapi`.
- **`app/frontend`** — Expo (React Native + web) client using Expo Router and a Zustand player store.

There is **no root `package.json`** and no workspace root — run every command inside the relevant app directory. The repo root holds only Expo/EAS build config (`app.json`, `eas.json`, `tsconfig.json`).

## Backend (`app/backend`)

### Commands
```bash
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000   # or ./start.ps1
python -m compileall -q app                               # syntax check (no DB needed)
```
`server.py` is a compatibility shim — the real app is `app.main:app`. There is **no automated test suite**. Validate changes by compiling, then exercising endpoints against a running instance.

Requires a `.env` (see `.env.example`): `MONGODB_URL`, `MONGODB_DB` (legacy `MONGO_URL`/`DB_NAME` also accepted), `JWT_SECRET` (mandatory when `APP_ENV=production`), `CORS_ORIGINS`, plus optional AI keys (`AI_PROVIDER`, `GEMINI_API_KEY`, `QWEN_BASE_URL`).

### Architecture
Strictly layered; dependencies point inward. Routes → services → repositories → core. See `ARCHITECTURE.md` for the full map — **but note its "Heartbeat" section is stale** (see Analytics below).

- **`api/`** — thin controllers (`routes/`), DI wiring (`deps.py`), aggregate router mounting everything under `/api`.
- **`services/`** — use-cases; never touch PyMongo directly. Contains `search/`, `recommendation/` (radio engine) and `dj/` (AI DJ).
- **`repositories/`** — the only place MongoDB queries live, one per collection group.
- **`providers/`** — external integrations (`youtube.py`, `musicbrainz.py`).
- **`ai/`** — provider-neutral LLM boundary. `AIProvider.complete()` with Gemini and OpenAI-compatible (Qwen/Ollama/vLLM) adapters; application code imports only `get_ai_client()`.
- **`domain/song.py`** — `song_json` is the single source of truth for the song wire shape and is **idempotent** (safe to re-serialize).
- **`core/`** — `config` (all env parsing), `database` (lazy memoized Mongo client + index setup), `security` (JWT/bcrypt).

### Recommendation engine (`services/recommendation`)
Signal-based: independent **candidate sources** emit `Candidate` objects carrying named **signals**; `ScoringPolicy` turns signals into a weighted-sum score; `RadioEngine` merges, personalizes, scores, and lays out a curated queue. **To add a recommendation signal, add a source (or enrichment) and a weight in `ScoringPolicy` — nothing else.**

Both `RadioEngine(sources=, policy=, discovery_ratio=)` and `QueueService(engine=)` are constructor-injectable. Callers that need different ranking behaviour should supply a tuned policy rather than forking engine logic — this is exactly how the AI DJ steers it.

`candidates/co_occurrence.py` exists but is **not** in `DEFAULT_SOURCES`, and nothing writes `listening_sessions` any more, so that signal is currently dormant.

### AI DJ (`services/dj`)
A session-aware conductor layered *over* the recommendation engine — it never replaces retrieval or scoring. Loop: observe → build context → decide strategy → generate via `QueueService` → optimize/reorder → narrate.

Module boundaries (one responsibility each): `config` (clamped dials) · `energy` (metadata-only heuristic proxy — the catalog has no audio features) · `session` (lifecycle + observation log) · `context` (observations → behaviour signals) · `strategy` (ordered deterministic rules → intent) · `tuning` (DJ intent → the engine's own `ScoringPolicy`/`discovery_ratio`) · `queue_optimizer` · `transition` (ordering + energy arc) · `feedback` (session-scoped learning) · `narration` · `insights` · `controller`.

Two invariants worth preserving:
- **No LLM on the playback path.** Every "what plays next" decision is deterministic arithmetic. `insights.py` is the only LLM surface and sits behind its own endpoint, with a deterministic fallback when no provider is configured.
- **Only signals in `TUNABLE_WEIGHTS` may be re-weighted**, and multipliers are clamped so amplifying a penalty (`user_avoidance`) can never flip it positive.

Collections `dj_sessions` and `dj_settings` are additive; queue filtering degrades to "keep it anyway" rather than ever returning an empty queue.

### Conventions that matter
- Route handlers are plain `def` (not `async`) — blocking PyMongo/`yt-dlp` calls run in FastAPI's threadpool. Keep them `def`. Services needing an async AI provider use `asyncio.run(...)` inside the sync method (see `ai_playlist_service.py`).
- The public API contract (endpoints, request params, response envelopes) is treated as frozen. Internal ranking/recommendation improvements are fine; changing response shapes is not. New features should be additive routes.
- Text normalization (`utils/text.py`) drives `*_norm` fields and dedup — use `normalize_title`/`normalize_artist`, don't hand-roll.

## Frontend (`app/frontend`)

### Commands
```bash
npm install
npx expo start          # dev server; press w for web, or: npx expo start --web
npm run lint            # expo lint
npx tsc --noEmit        # typecheck
npx expo run:android    # native build (needed for on-device stream resolution)
```
**Read `app/frontend/AGENTS.md` before writing Expo code** — it pins the versioned Expo docs to consult. API base URL comes from `EXPO_PUBLIC_API_URL` (defaults to `http://localhost:8000/api`).

Import alias `@/*` resolves against **both** `./src/*` and `./*`; existing code consistently writes `@/src/...` — match that.

**Baseline: `npx tsc --noEmit` reports 21 pre-existing errors**, all in unused Expo starter scaffolding (`components/app-tabs*.tsx`, `app/explore.tsx`, `components/animated-icon*`, `components/ui/collapsible.tsx`, `components/ui/Input.tsx`, `hooks/use-theme.ts`). These files are **not reachable from the real routes** — don't mistake them for the live app, and check new errors against this baseline rather than assuming a clean tree.

### Architecture
- **Expo Router** file-based routing in `src/app/` (`(auth)`, `(tabs)`, `player`, `queue`, `dj`, `playlist/[id]`, `collection`).
- **Player** (`src/lib/player.ts`) is a Zustand store owning the audio player, queue, and analytics lifecycle. The queue is built server-side via `/queue/generate` (`src/services/queue/queue-manager.ts`), with a local fallback if that call fails.
- **AI DJ client** (`src/lib/dj.ts` + `src/services/dj/`) is a separate store holding session/decision/narration state. Dependency direction is one-way: `player.ts` imports `dj.ts`, never the reverse. Every DJ call goes through `safeDJCall` and resolves to `null` on failure — the DJ must never be able to break playback.
- **Desktop shell** (`src/components/layout/`) activates at ≥1024px via `useBreakpoint()`. It swaps *chrome only* — the same `<Tabs>` navigator and screen components render inside it, with the tab bar suppressed in favour of a sidebar. Below 1024px the shell never mounts, so mobile rendering is unchanged. Keep that switch the single gate for desktop behaviour.
- **Auth** — JWT bearer stored via `expo-secure-store` on native and `localStorage` on web (`src/lib/token.ts`); attached by `src/lib/api.ts`.
- **Styling** — a single brutalist dark design token set in `src/theme.ts` (near-zero radii, hard shadows, uppercase micro-labels). `src/constants/theme.ts` is unrelated starter scaffolding; don't import it.

## Cross-app flows (span both apps)

- **Materialization**: search returns external YouTube results (`id` = `external:<videoId>`). On first play the client POSTs `/songs/materialize`, which first-write-wins-creates a canonical local `songs` row; later plays reuse it. Play/queue/stream all key off the resulting local `id`.
- **Stream resolution is dual-path**: the client first tries the **native Android resolver** (`modules/native-stream-resolver`, Chaquopy + on-device `yt-dlp`); iOS and failures fall back to the backend `GET /songs/stream/{id}`. The native module requires a **custom dev client** (not Expo Go) and an Android rebuild after changes.
- **Analytics**: a single endpoint, `POST /analytics/listen`, sent once when the user leaves or finishes a track (`song_id`, `listened_seconds`, `duration_seconds`, `reason: skipped|completed|stopped`). It writes one listen record and folds the result into `user_song_stats` / `user_artist_stats` / `user_album_stats`, which feed personalization and the profile screen. `AnalyticsRepository` still exposes session/event methods, but **no route calls them** — the older `/analytics/session/*` and `/analytics/event` endpoints described in `ARCHITECTURE.md` no longer exist.
- **DJ observation** reuses that same shape: the client reports each finished track to `POST /dj/session/{id}/observe` alongside the analytics call. Most cycles return `refreshed: false` and change nothing; when `refreshed` is true the client swaps only the *upcoming* tracks via `QueueManager.replaceUpcoming()`, leaving the playing track and history intact.
