# Desktop packaging

Wraps the backend and the exported web frontend into one installable Windows
app (Electron + electron-builder/NSIS). The backend connects to your existing
**MongoDB Atlas** cluster — nothing is bundled or run locally for the
database. See `../../CLAUDE.md` for the overall repo layout — this folder
only orchestrates processes and packaging; it contains no application logic.

> This build bakes your Atlas connection string (with credentials) into the
> packaged app via `resources/backend-env.json`. That's fine for your own
> personal install pointed at your own cluster — **do not distribute the
> resulting installer to other people**, since every copy would share your
> Atlas cluster and credentials. If you want to give this app to others,
> come back and we'll revisit (e.g. bundling a local database again, or
> making the Mongo URL a per-install setting).

## Build (Windows, from this folder or via the scripts directly)

```powershell
./scripts/build-all.ps1
```

Runs, in order: `build-backend.ps1` (PyInstaller build of `app/backend`),
`build-frontend.ps1` (`expo export --platform web`),
`prepare-backend-env.ps1` (copies `MONGODB_URL`/`MONGODB_DB` out of
`app/backend/.env` into `resources/backend-env.json`), icon generation, then
`electron-builder`. Output installer lands in `dist/`.

Each step can also be run individually while iterating. `resources/` and
`dist/` are gitignored — they're machine-generated (and, in
`backend-env.json`'s case, contain your Atlas credentials), not source.

## Dev run (without building an installer)

Populate `resources/backend`, `resources/frontend`, and
`resources/backend-env.json` via the scripts above at least once, then:

```powershell
npm install
npm start
```

## How it fits together

`src/main.js` is the only entrypoint: on launch it starts the backend exe
(env vars point it at your Atlas cluster, read from
`resources/backend-env.json`, plus a generated `JWT_SECRET`), then a small
static file server for the exported frontend, then opens a window pointed at
that local server. The Gemini API key is never touched by Electron or by
`backend-env.json` — it's entered in the app's Settings screen and persisted
by the backend through the OS credential store (see
`app/backend/app/core/settings_store.py`).
