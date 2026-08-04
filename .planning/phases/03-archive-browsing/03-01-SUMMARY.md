---
phase: 03-archive-browsing
plan: 01
subsystem: database
tags: [drizzle, sqlite, regex, apple-music, import-pipeline]

# Dependency graph
requires:
  - phase: 02-import-pipeline
    provides: Apple Music import route, INITIALS_RE/SESSION_NUM_RE parser, round-robin attribution fix (commit 961a9ad)
provides:
  - youtube_url nullable column live on the tracks table
  - YOUTUBE_RE extraction of YouTube fallback URLs from playlist descriptions
  - Import route filter restricted to real "Warwick Massive Tunage N" playlists (SESSION_PLAYLIST_RE)
  - MIA/AWOL absence handling so 3-person sessions attribute over present contributors only
  - Re-imported live database with corrected attribution and populated youtube_url values
affects: [03-02, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Absence marker extraction via global regex + matchAll (never .test()/.exec() on a /g regex, to avoid lastIndex state bugs)"
    - "Playlist-name filter narrowed from a permissive digit-match regex to an exact naming-convention regex when the permissive version causes DB-level collisions"

key-files:
  created:
    - lib/parse-playlist.test.ts
  modified:
    - db/schema.ts
    - lib/parse-playlist.ts
    - app/api/import/route.ts

key-decisions:
  - "youtubeUrl written onto the fallback track (first track without an appleId, else position 1) — session-level parsed value threaded per-track in import route"
  - "Restricted playlist import filter to SESSION_PLAYLIST_RE (Warwick Massive Tunage N) after re-import failed with UNIQUE constraint on session_number — permissive SESSION_NUM_RE swept in editorial/seasonal playlists (OQ1)"
  - "MIA/AWOL absence handling — attribute round-robin over present contributors only (sessions 25, 28 are 3-person); ABSENCE_RE + INITIALS_TRIO_RE added, attribution slot modulus now uses initials.length"

patterns-established:
  - "Data-layer changes that only take effect after a destructive re-import must be explicitly sequenced with a checkpoint:human-action task — build/typecheck passing is not sufficient proof of correctness for live-DB-dependent features"

requirements-completed: [BROWSE-03]

# Metrics
duration: ~7h (across 3 human-checkpoint round-trips; active execution time ~35min)
completed: 2026-08-04
---

# Phase 3 Plan 1: Data Layer (YouTube URLs + Attribution Fixes) Summary

**Added a nullable `youtube_url` column and parser extraction for YouTube fallback links, then fixed two import-pipeline bugs discovered only during the live re-import: a playlist-filter collision (Open Question 1) and MIA/AWOL 3-person session mis-attribution — re-import now produces a correct 32-session, 467-track database.**

## Performance

- **Duration:** ~35 min active execution across 3 checkpoint round-trips (human re-import happened between each)
- **Started:** 2026-08-04T09:04:00Z
- **Completed:** 2026-08-04T17:11:42Z (wall-clock spans human checkpoint waits)
- **Tasks:** 3 planned + 2 deviation fixes
- **Files modified:** 4 (db/schema.ts, lib/parse-playlist.ts, app/api/import/route.ts, lib/parse-playlist.test.ts)

## Accomplishments

- `tracks.youtube_url` (nullable) is live in the database; `lib/parse-playlist.ts` extracts YouTube URLs from playlist descriptions via `YOUTUBE_RE` (both `youtu.be/` and `youtube.com/watch?v=` forms) and the import route threads the value onto the fallback track
- Fixed a playlist-import collision (Open Question 1 from RESEARCH.md): the permissive `SESSION_NUM_RE` filter admitted editorial/seasonal playlists whose first number collided with real session numbers on the unique `sessions.session_number` column, causing a `UNIQUE constraint` failure on re-import. Replaced with `SESSION_PLAYLIST_RE`, matching only "Warwick Massive Tunage N"
- Fixed MIA/AWOL attribution: two sessions (25, 28) have a contributor marked absent in the description. Added `ABSENCE_RE` + `INITIALS_TRIO_RE` to `lib/parse-playlist.ts` so attribution round-robins over present contributors only; the import route's attribution slot modulus now uses `sessionPlan.initials.length` instead of a hardcoded 4
- Human re-import completed successfully; live database verified: 32 sessions, 467 tracks, 0 sessions flagged unattributed, 5 tracks carry a `youtube_url` (matching the 5 descriptions containing a YouTube URL). Session 25 (JG→IT→MW, no JS) and session 28 (MW→JG→IT, no JS) both round-robin correctly over 3 attendees; session 1 retains normal 4-person round-robin (JG→JS→IT→MW)

## Task Commits

Each task/deviation was committed atomically:

1. **Task 1: Add youtubeUrl column to tracks and extend the parser** - `18a28a8` (feat)
2. **Task 2: Thread youtubeUrl through the import route into the tracks insert** - `6229648` (feat)
3. **Task 3: [BLOCKING] Apply schema migration (`npm run db:push`)** - no source commit (DB-only; verified via `PRAGMA table_info(tracks)`)
4. **Deviation 1: Restrict import filter to Warwick Massive Tunage playlists (OQ1)** - `3f3371c` (fix)
5. **Deviation 2: Attribute MIA/AWOL sessions over present contributors only** - `374f27e` (fix)

**STATE.md tracking commits (interleaved with checkpoint round-trips):** `588b211`, `70f05cb`, `acebbd8`

_Note: no separate refactor commit was needed; each fix landed clean on first attempt with typecheck/lint/test verification passing before commit._

## Files Created/Modified

- `db/schema.ts` - added nullable `youtubeUrl: text("youtube_url")` column to the `tracks` table
- `lib/parse-playlist.ts` - added `YOUTUBE_RE` (YouTube URL extraction), `SESSION_PLAYLIST_RE` (exact playlist-name filter), `ABSENCE_RE` + `INITIALS_TRIO_RE` (MIA/AWOL handling); `parsePlaylistDescription` now returns `youtubeUrl` and applies absence-aware initials filtering
- `app/api/import/route.ts` - `ImportPlan` track/session shapes gained `youtubeUrl: string | null` and widened `initials` from a fixed 4-tuple to `string[]`; playlist filter switched from `SESSION_NUM_RE` to `SESSION_PLAYLIST_RE`; attribution slot modulus switched from hardcoded `% 4` to `% sessionPlan.initials.length`; trackRows insert now persists `youtubeUrl`
- `lib/parse-playlist.test.ts` (new) - spec harness (no test runner configured yet in this repo; run via `npx tsx lib/parse-playlist.test.ts`) covering YouTube URL extraction, session-playlist-name filtering, and MIA/AWOL absence handling, plus regressions for the standard four-person and parenthetical (session-13-shaped) description formats

## Decisions Made

- youtubeUrl is written onto the fallback track (first track without an `appleId`, else position 1) rather than duplicated across all tracks in a session — simplest safe rule per PATTERNS.md, avoids ambiguity about which track the fallback link applies to
- Import playlist filter narrowed to an exact naming-convention regex (`SESSION_PLAYLIST_RE`) rather than trying to make the permissive `SESSION_NUM_RE` filter smarter — the exact-match approach is unambiguous and was verified against all 32 real playlist names with zero false negatives
- MIA/AWOL absence is detected via a dedicated regex consumed only through `matchAll` (never `.test()`/`.exec()`) to avoid stateful `lastIndex` bugs with the `/g` flag; the trio-initials fallback (`INITIALS_TRIO_RE`) is only consulted when an absence marker is present and the strict four-person match fails, preserving byte-identical behavior for every other session

## Deviations from Plan

### Auto-fixed Issues (discovered at the human checkpoint, both approved and specified by the coordinator)

**1. [Rule 1 - Bug] Import playlist filter admitted non-session playlists, causing a UNIQUE constraint failure**
- **Found during:** Task 4 (human re-import checkpoint, first attempt)
- **Issue:** `SESSION_NUM_RE` (`/\b(\d+)\b/`) matched any playlist name containing a number, sweeping in editorial/seasonal playlists (e.g. "Ibiza 2026", "Replay 2021", "Autumnal Tracks '22") whose first integer collided with a real session number, causing `db.insert(schema.sessions)` to violate the unique `session_number` constraint mid-batch
- **Fix:** Added `SESSION_PLAYLIST_RE` (`/warwick massive tunage\s+(\d+)/i`) and switched the import route's playlist filter to it — verified byte-identical results against all 32 real playlist descriptions except the two sessions the next deviation addresses
- **Files modified:** `lib/parse-playlist.ts`, `app/api/import/route.ts`, `lib/parse-playlist.test.ts`
- **Verification:** `npm run typecheck` / `npm run lint` / `npx tsx lib/parse-playlist.test.ts` all passing; re-import retried and did not hit the constraint again
- **Committed in:** `3f3371c`

**2. [Rule 1 - Bug] MIA/AWOL sessions mis-attributed tracks to an absent contributor**
- **Found during:** Task 4 (human re-import checkpoint, second attempt)
- **Issue:** Session 28's description ("MW, JG, IT, JS = MIA") greedily matched `INITIALS_RE` as four attendees, crediting JS with tracks he never chose. Session 25's description ("JG, IT, MW. JS MIA.") only listed three comma-separated initials, so `INITIALS_RE` failed to match and the session was incorrectly flagged as unattributed
- **Fix:** Added `ABSENCE_RE` to detect "MIA"/"AWOL" markers and exclude the named contributor from the initials list before attribution; added `INITIALS_TRIO_RE` as a fallback for descriptions listing only three attendees. Import route's attribution slot calculation changed from `(position - 1) % 4` to `(position - 1) % sessionPlan.initials.length` so 3-person sessions round-robin correctly
- **Files modified:** `lib/parse-playlist.ts`, `app/api/import/route.ts`, `lib/parse-playlist.test.ts`
- **Verification:** `npm run typecheck` / `npm run lint` / `npx tsx lib/parse-playlist.test.ts` all passing; orchestrator verified live DB post-re-import: session 25 = JG→IT→MW (no JS), session 28 = MW→JG→IT (no JS), session 1 (normal) = JG→JS→IT→MW unchanged
- **Committed in:** `374f27e`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs discovered only once the live database was actually re-imported; build/typecheck could not have caught either, since both depend on real playlist description content)
**Impact on plan:** Both fixes were necessary for BROWSE-02/BROWSE-03 correctness (Plans 02/03 render attribution and track links directly from this data). No scope creep — both fixes were scoped exactly to the files already in this plan's `files_modified` list.

## Issues Encountered

- Import trigger shows a transient "could not reach the import endpoint" toast on the very first click in dev mode (Next.js on-demand route compilation delay for `/api/import`). Confirmed harmless and dev-only — retrying the click succeeds. No code change made; not applicable in production where routes are pre-built.

## Verified Re-import Outcome (orchestrator-confirmed)

- 32 sessions, 467 tracks total, 0 sessions flagged as unattributed
- 5 tracks carry a `youtube_url` value, matching the 5 playlist descriptions that actually contain a YouTube URL
- Session 25: 12 tracks, JG→IT→MW round-robin, no JS, `attribution_parsed=1`
- Session 28: 12 tracks, MW→JG→IT round-robin, no JS, `attribution_parsed=1`
- Session 1 (normal 4-person): JG→JS→IT→MW round-robin intact

### Follow-up to eyeball once browse pages exist (NOT fixed in this plan — flagged only)

Several sessions have fewer than 16 tracks in the DB: some are 15/14/12 tracks, session 5 has 4 tracks, and session 32 has 2 tracks. Some of this is legitimate (a MIA/AWOL session lands at 12 tracks by design; session 32 appears to be an in-progress/not-yet-fully-curated playlist). However, a few of the 14/15-track counts may indicate tracks that failed to fetch during import (the import route already tolerates per-playlist fetch errors and continues — see `plan.fetchErrors` — but does not currently surface *per-track* fetch failures within a playlist), which could shift round-robin attribution for any session missing tracks from the middle of its 1–16 position sequence rather than the end. Recommend spot-checking session track counts against the source Apple Music playlists once Plan 02/03 browse pages make this visible, rather than guessing at additional parser logic now.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `youtube_url` is live and populated; Plans 02/03 can safely render the YouTube icon button (D-10c) using `tracks.youtubeUrl`
- Round-robin attribution (including the 3-person MIA/AWOL sessions) is corrected in the live database; Plans 02/03 can render contributor chips directly from `session_tracks.attributedContributorId` without additional client-side correction logic
- Track-count-per-session follow-up (see above) is a data-quality note, not a blocker — sessions remain fully browsable at whatever track count they have, consistent with D-05/D-09's "always browsable" principle

---
*Phase: 03-archive-browsing*
*Completed: 2026-08-04*
