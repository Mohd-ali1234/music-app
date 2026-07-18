# Music Backend — Architecture

A layered FastAPI service designed to scale toward millions of songs and users.
The API contract (endpoints, request params, response schemas) is unchanged from
the previous version; only ranking quality, recommendation quality, and internal
structure/performance improved.

## Layers

```
app/
  main.py            FastAPI app factory + lifespan (index setup)
  api/
    deps.py          Dependency injection: auth + service/repository wiring
    router.py        Mounts every route module under /api
    routes/          Thin controllers, one file per resource area
  schemas/           Pydantic request models — the public wire contract
  services/          Use-cases (orchestration only, no direct DB access)
    search/          Retrieval + relevance ranking
    recommendation/  Radio/queue engine (candidate sources + scoring + layout)
  repositories/      Data access over MongoDB collections
  providers/         External integrations (YouTube / YouTube Music, MusicBrainz)
  domain/            Song serialization + document builders
  core/              Config, database, security, logging
  utils/             Pure helpers (text normalization, filtering)
```

**Dependency rule:** dependencies point inward. Routes → services → repositories
→ core. Providers and domain are leaf modules. Nothing in `services` imports
FastAPI except where it raises `HTTPException` (to preserve exact status codes).

`server.py` at the backend root is a compatibility shim (`from app.main import app`)
so `uvicorn server:app` and `start.ps1` keep working unchanged.

## Search ranking (`services/search`)

`SearchRanker` scores each candidate as a transparent weighted sum of independent,
normalized signals: exact-title match (highest), title prefix, fuzzy + partial
title/artist/album similarity, whole-word token bonuses, global popularity,
artist popularity, and the provider's own ordering as a prior + stable tie-break.
Popularity is attached via two bulk queries (local catalog join + one play-count
aggregation) — no per-result round trips. Displayed identity is untouched, so ids
are byte-compatible with before.

## Recommendation / radio (`services/recommendation`)

A seed track fans out to independent **candidate sources**, each emitting
`Candidate` objects carrying named **signals**:

| Source              | Signal(s)                     | Intent                          |
|---------------------|-------------------------------|---------------------------------|
| `SameArtistSource`  | `same_artist`                 | same artist first               |
| `SameAlbumSource`   | `same_album`                  | album continuity                |
| `SimilarArtistSource`| `similar_artist`             | nearby artists                  |
| `CoOccurrenceSource`| `co_occurrence`               | "listened together"             |
| `YouTubeRadioSource`| `yt_related`, `similar_artist`| genre/mood/discovery (YT mix)   |
| (engine enrichment) | `user_affinity`               | personalization                 |

`ScoringPolicy` turns signals into a score (weighted sum). The `RadioEngine`
merges/dedupes candidates, personalizes, scores, then lays out a curated flow:
same-artist tracks lead, the tail is artist-diversified for smoothness, and a
tunable `discovery_ratio` interleaves discovery so familiarity and discovery are
balanced. Pure random `$sample` discovery was removed — every track is tied to
the seed by an explicit signal. **Adding a new signal is a two-line change:** emit
it from a source and give it a weight.

Robustness: a failing source never breaks queue generation; the seed is always
first and never duplicated; the queue is padded from YouTube if the local catalog
is thin.

## "Heartbeat"

The client's progress endpoint (`/analytics/session/heartbeat`) is **not** a
keep-alive poll — the app flushes accumulated listened-seconds only when it has
~10s to report, on pause, and on seek. The endpoint is kept for backwards
compatibility but is now a single atomic `$addToSet` write; the previous
read-modify-write plus a no-op `$inc: {play_count: 0}` upsert are gone. Play
counting happens exactly once, on the `play` interaction event, and co-occurrence
data is captured from both sessions and play events, so the progress endpoint can
be dropped entirely in the future with no loss of recommendation signal.

## Performance notes

- N+1 `find_one` fan-outs (home feed, recently played, playlist songs) replaced
  with bulk `$in` queries.
- YouTube search + stream resolution stay behind in-process TTL caches.
- Added indexes: `plays.song_id`, `listening_sessions.song_yt_ids`.
- Repositories/services are constructed per-request over memoized DB singletons.
