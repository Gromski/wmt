---
phase: 03-archive-browsing
plan: 06
subsystem: import
tags: [regex, parsing, drizzle, apple-music, youtube, round-robin]

# Dependency graph
requires:
  - phase: 03-archive-browsing
    provides: parseFallbackTracks, NAME_TO_INITIALS, FALLBACK_TRACK_RE, and the append-at-end import pipeline (03-04)
provides:
  - parseFallbackTracks entries carrying a `round: number | null` (ordinal extraction from the descriptor)
  - Pure, exported buildSessionTrackPositions helper (app/api/import/route.ts) that reconstructs a session's true round-robin grid
  - Import route wired to place grid fallbacks at their true position, re-attribute Apple tracks around the gap, and demote unsafe grid fallbacks to logged bonuses
affects: [03-05-human-reimport, session-detail-page, analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ordinal-from-free-text extraction re-derived from the full regex match (match[0]) rather than adding a new capture group, to keep FALLBACK_TRACK_RE byte-identical per plan constraint"
    - "Pure positioning helper (no db/fetch/module state) unit-tested via a standalone tsx run that dynamic-imports the API route module after process.loadEnvFile('.env.local'), since Next.js's automatic .env.local loading isn't available outside next dev/build"
    - "Safety-first demotion: a grid fallback that collides, isn't in the session initials, has an out-of-range round, or overflows the track count is demoted to an appended bonus and console-logged — never silently misplaced"

key-files:
  created: []
  modified:
    - lib/parse-playlist.ts
    - lib/parse-playlist.test.ts
    - app/api/import/route.ts

key-decisions:
  - "Descriptor text for ordinal extraction is re-derived from match[0] via a small local regex mirroring FALLBACK_TRACK_RE's own possessive/track: shape, rather than adding a 5th capture group to FALLBACK_TRACK_RE itself — the plan explicitly forbids modifying that regex, and this keeps 03-04's byte-identical guarantee intact"
  - "The test harness loads .env.local via process.loadEnvFile() before dynamically importing app/api/import/route.ts, because that module's import chain (lib/auth -> lib/db) throws on missing BETTER_AUTH_SECRET outside a Next.js server context; this is a test-harness-only concern — buildSessionTrackPositions itself remains pure with no env/db/fetch dependency"
  - "Grid fallback tracks are inserted with attributionInitials: null so they ride the same position-based round-robin as Apple tracks (initials[(position-1)%N]) — only bonus (declared or demoted) fallbacks keep the explicit named-contributor override"

requirements-completed: [BROWSE-03]

# Metrics
duration: 45min
completed: 2026-08-11
---

# Phase 03 Plan 06: Position-Aware YouTube Fallback Tracks Summary

**Fallback tracks now carry a `round` derived from their description's ordinal, and a new pure `buildSessionTrackPositions` helper reconstructs each session's true round-robin grid on import — placing grid fallbacks at their correct slot and re-attributing every Apple track shifted by the gap, with unsafe placements demoted to logged bonuses instead of silently misattributed.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-08-11T15:10:00Z (approx)
- **Completed:** 2026-08-11T15:55:25Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `ordinalToRound()` + `descriptorFromMatch()` added to `lib/parse-playlist.ts`; every `parseFallbackTracks` entry now carries `round: number | null` (first/1st→1, second/2nd→2, third/3rd→3, fourth/4th/last→4, anything else → null/bonus) without touching `FALLBACK_TRACK_RE`'s capture groups or `parsePlaylistDescription`
- New pure, exported `buildSessionTrackPositions` in `app/api/import/route.ts`: computes grid-fallback target positions `(round-1)*N + initials.indexOf(theirInitials) + 1`, fills Apple tracks into the remaining slots in playlist order, appends bonus fallbacks after the grid, and demotes (never corrupts) any grid fallback that collides, isn't present in the session initials, has an out-of-range round, or overflows the track count
- Import route rewired: Apple track positions come from `applePositions` (not `idx+1`); grid fallback tracks are placed at their computed position with `attributionInitials: null` (attributed by the same position-based round-robin as Apple tracks); bonus/demoted fallbacks keep explicit named-contributor attribution; each demotion is `console.log`'d with playlist name, fallback, and reason
- Full regression + new-case coverage in `lib/parse-playlist.test.ts`: ordinal extraction (word/numeric/last/bonus/theme-word), S3 two-grid-fallback reconstruction (positions 1 & 8, Apple tracks filling the gaps), S24 `last`→position 15, bonus-append, collision demotion, overflow demotion, not-present-contributor demotion, and the unparsed-session no-op path — all passing alongside every pre-existing 03-01/03-04 assertion

## Task Commits

Each task was committed atomically (Task 1 combined RED+GREEN in one commit — see Deviations; Task 2 followed the full RED→GREEN split):

1. **Task 1: round field via ordinal extraction (+ tests)** - `f2a2e8b` (feat)
2. **Task 2 (RED): failing tests for buildSessionTrackPositions** - `7a9b08e` (test)
3. **Task 2 (GREEN): implement buildSessionTrackPositions** - `bfe81b9` (feat)
4. **Task 3: wire grid reconstruction into import build phase** - `95591c9` (fix)

**Plan metadata:** committed alongside this summary (docs: complete plan)

## Files Created/Modified
- `lib/parse-playlist.ts` - Added `ordinalToRound()` and `descriptorFromMatch()`; `parseFallbackTracks` entries now carry `round: number | null`; `parsePlaylistDescription` left byte-identical
- `lib/parse-playlist.test.ts` - Added `process.loadEnvFile(".env.local")` + async `run()` with a dynamic import of `buildSessionTrackPositions` from `@/app/api/import/route`; updated all pre-existing `parseFallbackTracks` deepEqual assertions to include the new `round` field; added ordinal-extraction and positioning-helper test cases per the plan's exact specification
- `app/api/import/route.ts` - Added exported, pure `buildSessionTrackPositions`; rewrote the per-playlist build block to call it and assign Apple/fallback track positions from its result instead of `idx+1`/append-at-end; added demotion console logging

## Decisions Made
- Descriptor text for ordinal extraction is re-derived from the full match text (`match[0]`) with a small local regex, rather than adding a new capture group to `FALLBACK_TRACK_RE` — required to satisfy the plan's explicit "do not change FALLBACK_TRACK_RE" constraint while the plan's own interface note (which described a 5-group regex including a descriptor capture) turned out to be stale against the actual 4-group shipped regex.
- The test file now needs `process.loadEnvFile(".env.local")` before dynamically importing the API route module, because `app/api/import/route.ts`'s import chain (`lib/auth` → `lib/db`) throws on a missing `BETTER_AUTH_SECRET` outside a Next.js server context (Next.js auto-loads `.env.local`; a standalone `tsx` run does not). This is a test-harness-only accommodation — `buildSessionTrackPositions` itself has no env/db/fetch dependency.
- Grid fallback tracks are inserted with `attributionInitials: null` so the existing DB-write attribution formula (`initials[(position-1) % N]`, unchanged since 03-04) naturally attributes them correctly now that they occupy their true position — no change was needed to the DB write phase itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FALLBACK_TRACK_RE has no descriptor capture group despite the plan's interface note**
- **Found during:** Task 1
- **Issue:** The plan's `<interfaces>` block said `FALLBACK_TRACK_RE` "captures name, descriptor, artist, title, url" (5 groups), but the actual shipped regex (03-04) only captures name/artist/title/url (4 groups) — there is no descriptor capture group to read the ordinal from.
- **Fix:** Added a local, non-global helper (`descriptorFromMatch`) that re-derives the descriptor substring from each match's full matched text (`match[0]`), mirroring `FALLBACK_TRACK_RE`'s own `['’]s\s+[^:]+?track:` shape. `FALLBACK_TRACK_RE` itself was left completely untouched, satisfying the plan's explicit "Do NOT change ... FALLBACK_TRACK_RE" constraint.
- **Files modified:** `lib/parse-playlist.ts`
- **Verification:** All ordinal-extraction test cases pass; `FALLBACK_TRACK_RE`'s source is unchanged in the diff.
- **Committed in:** `f2a2e8b`

**2. [Rule 3 - Blocking] app/api/import/route.ts import chain crashes in a standalone tsx test run**
- **Found during:** Task 2 (writing the failing test)
- **Issue:** The plan directs the test file to `import` `buildSessionTrackPositions` from `"@/app/api/import/route"`. That module transitively imports `lib/auth.ts`, which throws `BETTER_AUTH_SECRET is not configured` at module-load time when run outside Next.js (which auto-loads `.env.local`). A plain static import would crash the entire test file before any assertion runs.
- **Fix:** Converted `run()` to `async`, added `process.loadEnvFile(".env.local")` (wrapped in try/catch for CI environments without the file) before an `await import("@/app/api/import/route")` inside `run()`. `buildSessionTrackPositions` itself remains pure with zero env/db/fetch dependency — this is purely a test-harness accommodation for the surrounding module's unrelated side effects.
- **Files modified:** `lib/parse-playlist.test.ts`
- **Verification:** `npx tsx lib/parse-playlist.test.ts` runs clean end-to-end and prints "all assertions passed".
- **Committed in:** `7a9b08e`

### Process Note (not a Rule 1-4 deviation)

Task 1 is marked `tdd="true"` and the workflow specifies separate `test(...)` (RED) then `feat(...)` (GREEN) commits. I confirmed RED (ran the round-field assertions against the unmodified parser and saw them fail) before implementing, but committed the RED test additions and the GREEN implementation together in a single `feat` commit (`f2a2e8b`) rather than splitting them. Task 2 followed the correct RED→GREEN commit split (`7a9b08e` then `bfe81b9`). No functional impact — both RED and GREEN were verified in the correct order before any commit — but flagging for completeness since the plan's TDD gate expects the split for every `tdd="true"` task.

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking), plus 1 process note (commit-split for Task 1).
**Impact on plan:** Both auto-fixes were necessary to complete the plan as specified without changing its scope; neither altered the algorithm, the regex's public shape, or any production runtime behavior.

## Issues Encountered
None beyond the two Rule 3 items above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None — this plan modifies parser/import-route logic only, no UI stubs introduced.

## Threat Flags
None — no new network endpoints, auth paths, or trust-boundary changes. `buildSessionTrackPositions` and the ordinal extractor operate on the same trusted, admin-authored description text already covered by T-03-06-01/T-03-06-02 in this plan's own threat model. The import route's admin+role gate is unchanged.

## Next Phase Readiness
- Build/typecheck/lint and the full parser+positioning test harness all pass (`npx tsx lib/parse-playlist.test.ts`, `npm run typecheck`, `npm run lint`).
- **IMPORTANT — live data correctness is NOT yet proven.** This plan only proves the code builds and the parser/positioning helper's unit behavior is correct against hand-written fixture data (S3 two-fallback grid, S24 `last`→pos 15, bonus append, collision/overflow/not-present demotion, unparsed no-op). It does NOT prove that the real S3 playlist now shows two fallbacks at positions 1 and 8 with the surrounding Apple tracks re-attributed to the correct people, that S24's `Rahzel - Iron Man` lands at position 15 under Jon, or that S31/S15/S19 render as expected in the running app. Those require plan 03-05: the human editing the real Apple Music playlist descriptions into the new ordinal/bonus convention documented in `docs/superpowers/specs/2026-08-10-position-aware-fallback-tracks-design.md`, followed by a live MusicKit re-import and spot-check against the running app.

---
*Phase: 03-archive-browsing*
*Completed: 2026-08-11*

## Self-Check: PASSED

All files created/modified exist on disk (lib/parse-playlist.ts, lib/parse-playlist.test.ts, app/api/import/route.ts, this SUMMARY.md). All commit hashes (f2a2e8b, 7a9b08e, bfe81b9, 95591c9) verified present in git log.
