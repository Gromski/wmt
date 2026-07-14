---
phase: 02-import-pipeline
plan: "02"
subsystem: import-pipeline
tags:
  - phase-2
  - apple-music
  - import
  - sse
  - lastfm
  - vertical-slice
dependency_graph:
  requires:
    - 02-01 (db/schema.ts, lib/apple-dev-token.ts, app/api/apple-token/route.ts, types/musickit.d.ts)
    - 01-03 (auth gate pattern)
  provides:
    - app/api/import/route.ts (SSE streaming POST import handler)
    - components/ImportTriggerCard.tsx (MusicKit JS browser flow + progress UI)
    - lib/apple-music-client.ts (appleGet, fetchAllLibraryPlaylists, fetchPlaylistTracks)
    - lib/parse-playlist.ts (parsePlaylistDescription, INITIALS_RE, KNOWN_CONTRIBUTORS)
    - lib/lastfm-client.ts (fetchArtistTags with rate-limiting by caller)
  affects:
    - 02-03 (session date table + attribution review UI build on populated DB)
    - Phase 4 analytics (artist_tags table populated by this plan)
tech_stack:
  added: []
  patterns:
    - SSE streaming via ReadableStream + ReadableStreamDefaultController in Next.js 16 POST handler
    - Two-header Apple Music API auth (Authorization Bearer devToken + Music-User-Token)
    - MusicKit JS v3 loaded via next/script afterInteractive + onLoad state gate
    - Drizzle db.batch() for replace-all delete (implicit transaction)
    - .returning({ id }) pattern on db.insert for FK wiring between sessions/tracks/session_tracks
    - 250ms rate-limit delay (setTimeout) between Last.fm API calls (4 req/sec)
    - attributionParsed=false flag for IMPORT-08 sessions missing initials string
    - 4-track slot attribution: Math.floor((position - 1) / 4) maps to initials[slot]
key_files:
  created:
    - lib/parse-playlist.ts
    - lib/apple-music-client.ts
    - lib/lastfm-client.ts
  modified:
    - app/api/import/route.ts (replaced 18-line stub with 351-line full implementation)
    - components/ImportTriggerCard.tsx (replaced 72-line stub with 200-line MusicKit+SSE component)
decisions:
  - "Import route implements Tasks 2a+2b as a single file (plan split was organizational; both share the same ReadableStream start() callback and in-memory plan handoff)"
  - "res.body null check added instead of non-null assertion (biome lint/style/noNonNullAssertion rule)"
  - "D-04 warning text split across two JSX lines due to formatter wrapping — content is correct and fully present"
  - "SESSION_NUM_RE used as the session playlist filter (any playlist with a standalone integer in name) — permissive start per Open Question 1 resolution; unmatched names logged to stdout for refinement"
metrics:
  duration: "~35 minutes"
  completed: "2026-07-13"
  tasks: 3
  files: 5
---

# Phase 02 Plan 02: End-to-End Apple Music Import Flow Summary

Full Apple Music import pipeline: MusicKit JS v3 browser authorization, SSE-streamed server-side playlist/track fetch with contributor attribution parsing, Drizzle replace-all batch write, and Last.fm artist tag enrichment — all in one vertical slice.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server-side helper libs — Apple Music client, parser, Last.fm | 557e3a4 | lib/parse-playlist.ts, lib/apple-music-client.ts, lib/lastfm-client.ts |
| 2a+2b | /api/import — SSE skeleton + DB write + enrichment + complete event | e79d407 | app/api/import/route.ts |
| 3 | Replace ImportTriggerCard with MusicKit JS + SSE reader + D-04 warning | 1069514 | components/ImportTriggerCard.tsx |

## What Was Built

### lib/parse-playlist.ts
- `KNOWN_CONTRIBUTORS` — initials → full name mapping (MW/JG/JS/IT per D-12)
- `INITIALS_RE` — regex matching four comma-separated two-uppercase-letter blocks with word-boundary anchors
- `SESSION_NUM_RE` — first standalone integer in playlist name
- `parsePlaylistDescription(name, description)` — returns sessionNumber, theme (strips Session N prefix), initials (null when description missing or no match → IMPORT-08 trigger)

### lib/apple-music-client.ts
- `appleGet<T>` — two-header fetch (Authorization Bearer + Music-User-Token); throws on non-2xx without including token in error message (T-02-02-01 mitigated)
- `fetchAllLibraryPlaylists` — paginated GET /v1/me/library/playlists with phantom-record filter (Pitfall 8)
- `fetchPlaylistTracks` — paginated GET /v1/me/library/playlists/{id}/tracks?include=catalog for ISRC + releaseDate (Pitfall 4)

### lib/lastfm-client.ts
- `fetchArtistTags` — reads LASTFM_API_KEY at call time; one-time warning if unset; returns [] (not throws) for missing key, Last.fm error codes, or network failures (Pitfall 5); top 5 tags lowercased

### app/api/import/route.ts
- `maxDuration = 300` for Vercel Hobby
- Auth gates (401/403) before body parse, preserved verbatim from Phase 1
- ReadableStream SSE with send() helper
- Build phase: list all playlists → filter by SESSION_NUM_RE → per-playlist fetch+parse with per-error continue loop → in-memory ImportPlan
- `ready-to-write` SSE stage marker before DB writes begin
- DB write phase: db.batch() delete (artistTags → sessionTracks → tracks → sessions) → upsert contributors → insert sessions .returning() → insert tracks .returning() → build + insert sessionTracks (4-track slot attribution rule)
- Last.fm enrichment: unique artists deduplicated → fetchArtistTags per artist → 250ms delay → batch insert artistTags
- Final `complete` event with sessions/tracks/errors counts
- Error handling: catch → send error event → finally closes stream

### components/ImportTriggerCard.tsx
- MusicKit JS v3 via `<Script strategy="afterInteractive" onLoad={() => setMusicKitReady(true)}>`
- Button disabled until musicKitReady=true and not running
- onClick flow: GET /api/apple-token → configure → authorize() [user gesture path] → POST /api/import → SSE read loop
- SSE parsing: chunk accumulation with double-newline splitting; JSON.parse each data: event
- D-04 replace-all warning (amber AlertTriangle paragraph) always visible under button
- Progress bar (shadcn Progress) + status line while running
- Completion summary line after complete event
- Error line after error event
- 401/403/generic toast error mapping on both fetch calls

## Live Import Run
No live end-to-end import was run during this execution (browser-only MusicKit authorization cannot be automated). Code paths are verified to compile and the auth gate is correct (401 for unauthed, 403 for non-admin). The admin (Mark) can run the first live import as the UAT step.

## Open Question 1 Status
The session playlist filter uses `SESSION_NUM_RE` (`/\b(\d+)\b/`) which matches any playlist name containing a standalone integer. All unmatched playlist names are logged via `console.log("[import] skipped playlist:", name)`. After the first live import, Mark can review the server logs to see which (if any) playlists were skipped and refine the regex in lib/parse-playlist.ts if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome import ordering required type imports first within a group**
- **Found during:** Task 2a+2b lint verification
- **Issue:** `import { fetchAllLibraryPlaylists, fetchPlaylistTracks, type AppleLibrarySong }` — biome v2 requires type imports before value imports within the same import group
- **Fix:** Reordered to `type AppleLibrarySong` first, then `fetchAllLibraryPlaylists`, `fetchPlaylistTracks`
- **Files modified:** app/api/import/route.ts
- **Commit:** included in e79d407

**2. [Rule 1 - Bug] Biome formatting: multiline arrow function bodies must be collapsed when short**
- **Found during:** Task 1 lint verification
- **Issue:** `page.data.filter((p) =>\n  Boolean(p.attributes?.name),\n)` — biome formatted as one-liner
- **Fix:** Collapsed to `page.data.filter((p) => Boolean(p.attributes?.name))`
- **Files modified:** lib/apple-music-client.ts
- **Commit:** included in 557e3a4

**3. [Rule 1 - Bug] Biome lint: noNonNullAssertion on res.body!.getReader()**
- **Found during:** Task 3 lint verification
- **Issue:** `res.body!.getReader()` flagged as forbidden non-null assertion
- **Fix:** Added explicit null check `if (!res.body) { toast.error(...); return; }` before calling getReader()
- **Files modified:** components/ImportTriggerCard.tsx
- **Commit:** included in 1069514

**4. [Rule 1 - Bug] Biome lint: noImplicitAnyLet on untyped let declaration**
- **Found during:** Task 2a lint verification
- **Issue:** `let items;` inside try block had implicit `any` type
- **Fix:** Changed to `let items: AppleLibrarySong[]` with explicit type annotation
- **Files modified:** app/api/import/route.ts
- **Commit:** included in e79d407

## Known Stubs

None — all five files are complete implementations with real logic. The import route performs actual Apple Music API calls, DB writes, and Last.fm enrichment. The only thing that cannot be verified without a live browser session is the MusicKit JS authorization popup itself.

## Threat Surface Scan

All threats documented in the plan's threat model, all mitigations applied:

- **T-02-02-01** (Music User Token in transit/log): appleGet() error message uses `${res.status} on ${path}` — no token in message. Token is POST body over HTTPS only.
- **T-02-02-03** (admin gate): 401/403 before body parse, verbatim from Phase 1.
- **T-02-02-04** (musicUserToken substitution): Apple Music API validates token server-side; forged tokens return 401/403 from Apple.
- **T-02-02-07** (stack traces in SSE error): catch block uses `String(err)` — no stack trace.
- **T-02-02-SC** (no new packages): Zero new npm packages. All three lib files use built-in fetch only.

No new threat surface beyond what the plan's threat model covers.

## Self-Check: PASSED

**Files exist:**
- FOUND: app/api/import/route.ts
- FOUND: components/ImportTriggerCard.tsx
- FOUND: lib/apple-music-client.ts
- FOUND: lib/parse-playlist.ts
- FOUND: lib/lastfm-client.ts

**Commits exist:**
- FOUND: 557e3a4 — Task 1: server-side helper libs
- FOUND: e79d407 — Task 2a+2b: SSE import route
- FOUND: 1069514 — Task 3: ImportTriggerCard

**Build:** `npm run build` exits 0 — no type errors, no missing imports. All 5 routes (/, /api/apple-token, /api/auth/[...all], /api/import, /dashboard, /sign-in) compiled cleanly.

**Lint + typecheck:** Both pass with 0 errors.

**Code patterns verified:**
- ReadableStream in app/api/import/route.ts
- db.batch() in app/api/import/route.ts
- attributionParsed in app/api/import/route.ts
- window.MusicKit in components/ImportTriggerCard.tsx
- D-04 warning copy present in components/ImportTriggerCard.tsx
