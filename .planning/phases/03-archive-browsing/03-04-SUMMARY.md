---
phase: 03-archive-browsing
plan: 04
subsystem: import
tags: [regex, parsing, drizzle, apple-music, youtube]

# Dependency graph
requires:
  - phase: 03-archive-browsing
    provides: parsePlaylistDescription, KNOWN_CONTRIBUTORS, YOUTUBE_RE, and the import route's build/write pipeline (03-01)
provides:
  - parseFallbackTracks extractor + NAME_TO_INITIALS map + FALLBACK_TRACK_RE (lib/parse-playlist.ts)
  - Import route that inserts each YouTube fallback track as its own tracks + session_tracks row, attributed to the named contributor
affects: [03-05-gap-closure, session-detail-page, analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit per-track attribution override (attributionInitials) threaded through ImportPlan -> trackMeta -> session_tracks write, bypassing round-robin only when non-null"
    - "Text-only regex extraction of embedded track sentences (no external fetch) — same lastIndex-state discipline as the existing ABSENCE_RE (matchAll only, never .test()/.exec() on a /g regex)"

key-files:
  created: []
  modified:
    - lib/parse-playlist.ts
    - lib/parse-playlist.test.ts
    - app/api/import/route.ts

key-decisions:
  - "Jon and Jonny both resolve to JS per the authoritative 03-UAT.md resolution — Jonny listed before Jon in the regex alternation so the longer name wins"
  - "Fallback tracks are appended at session END (after all Apple tracks), not inlined at their original conversational position — the session detail page renders a flat position-ordered list with per-track contributor chips, so this keeps Apple round-robin positions stable while attribution stays correct"
  - "attributionInitials: null on every Apple Music track preserves the existing round-robin verbatim; a non-null value on fallback tracks bypasses round-robin entirely via a direct contribIdByInitials lookup"

requirements-completed: [BROWSE-03]

# Metrics
duration: 25min
completed: 2026-08-10
---

# Phase 03 Plan 04: YouTube Fallback Track Modelling Summary

**Added a `parseFallbackTracks` text extractor and rewired the import route so each YouTube fallback track becomes its own track row attributed to the named contributor, replacing the old position-1/first-no-appleId heuristic.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-10T12:03:00Z (approx)
- **Completed:** 2026-08-10T12:28:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `parseFallbackTracks` (TDD: RED then GREEN) extracts an ordered list of `{ initials, artist, title, youtubeUrl }` entirely from playlist description text, supporting multiple " / "-separated fallback tracks per description
- `NAME_TO_INITIALS` map resolves Mark→MW, Jack→JG, Jon→JS, Jonny→JS, Iwan→IT (Jonny listed before Jon in the regex so the longer name wins)
- Import route no longer attaches a YouTube URL to whichever Apple Music track happens to sit at position 1; every Apple track's `youtubeUrl` is now `null`
- Each parsed fallback track is inserted as its own `tracks` row (`appleId: null`, `youtubeUrl` set, artist/title parsed from text) and its own `session_tracks` row, appended at session end and explicitly attributed to the named contributor via `contribIdByInitials` — bypassing round-robin entirely for that row
- `db.transaction` replace-all wrapping, Last.fm enrichment ordering (before the transaction), and Apple Music round-robin attribution (including the `attributionParsed`/absence-marker guards) are preserved verbatim

## Task Commits

Each task was committed atomically (TDD task produced two commits: RED then GREEN):

1. **Task 1 (RED): failing tests for parseFallbackTracks** - `07b036a` (test)
2. **Task 1 (GREEN): parseFallbackTracks + NAME_TO_INITIALS + FALLBACK_TRACK_RE** - `62d130f` (feat)
3. **Task 2: insert fallback tracks as own rows in import route** - `4553e66` (fix)

**Plan metadata:** committed alongside this summary (docs: complete plan)

## Files Created/Modified
- `lib/parse-playlist.ts` - Added `NAME_TO_INITIALS`, `FALLBACK_TRACK_RE`, `parseFallbackTracks`; `parsePlaylistDescription` left byte-identical
- `lib/parse-playlist.test.ts` - Added S3 (two fallbacks), S31 (Jonny→JS), nickname mapping (Jon/Mark/Jack/Iwan), ordinal descriptor, empty-list, and undefined-description cases; existing assertions untouched
- `app/api/import/route.ts` - Removed `fallbackIdx`/`youtubeUrlTargetIdx` heuristic; added `attributionInitials` to the `ImportPlan` track shape and `TrackMeta`; calls `parseFallbackTracks` per playlist and appends fallback tracks after Apple tracks; DB write phase checks `attributionInitials` first (explicit lookup) before falling back to the existing round-robin

## Decisions Made
- Fallback tracks are appended at session end rather than inserted at their conversational position in the description, because the session detail page renders a flat, position-ordered list with per-track contributor chips (no section headers) — this keeps the existing Apple round-robin position math untouched while still surfacing correct attribution via the explicit override.
- `attributionInitials` is threaded as a plain nullable string through the plan/build/write pipeline rather than introducing a new attribution enum — smallest change consistent with the existing `attributedContributorId` resolution shape.

## Deviations from Plan

None - plan executed exactly as written. Task 1 followed the TDD directive (failing test committed first, then implementation); Task 2 matched the action block precisely, including preserving the `attributionParsed`/initials guards verbatim for the round-robin branch.

One incidental fix applied automatically during Task 1: Biome's formatter reformatted the multi-line return-type annotation on `parseFallbackTracks` (wrapped an inline object-type onto multiple lines) — a formatting-only, non-behavioral change applied by `npx biome check --write` as part of satisfying the plan's own `npm run lint` verification gate, not a separate deviation requiring Rule tracking.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — this plan modifies parser/import-route logic only, no UI stubs introduced.

## Threat Flags
None — no new network endpoints, auth paths, or trust-boundary changes. `parseFallbackTracks` operates on the same trusted description-text input already covered by T-03-04-01 in this plan's own threat model; the import route's admin+role gate is unchanged.

## Next Phase Readiness
- Build/typecheck/lint and the parser test harness all pass; the parser and import-route logic are ready for the human step in plan 03-05.
- **IMPORTANT — live data correctness is NOT yet proven.** This plan only proves the code builds and the parser's unit behavior is correct against hand-written fixture strings. It does NOT prove that S3 shows two fallback tracks, that S31's diamond track lands under JS, or that no fallback link attaches to the wrong track in the actual database — those require plan 03-05: the human editing the real Apple Music playlist descriptions into the canonical `"<Name>'s <descriptor> track: <Artist> - <Title> <url>"` format, followed by a live re-import and spot-check against the running app, per the pattern established in 03-01-SUMMARY.

---
*Phase: 03-archive-browsing*
*Completed: 2026-08-10*

## Self-Check: PASSED

All files created/modified exist on disk (lib/parse-playlist.ts, lib/parse-playlist.test.ts, app/api/import/route.ts, this SUMMARY.md). All commit hashes (07b036a, 62d130f, 4553e66) verified present in git log.
