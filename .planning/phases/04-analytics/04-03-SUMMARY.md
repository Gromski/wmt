---
phase: 04-analytics
plan: 03
subsystem: analytics
tags: [wrapped-cards, group-unique-pick, rsc, next16]

# Dependency graph
requires:
  - phase: 04-analytics
    plan: 01
    provides: getAnalyticsData() AnalyticsData contract (contributors[], attributedRows[])
  - phase: 04-analytics
    plan: 02
    provides: app/analytics/page.tsx hub with the Plan-03 insertion point below Taste profiles
  - phase: 03-archive-browsing
    provides: lib/contributor-colors.ts (CONTRIBUTOR_COLORS)
provides:
  - lib/wrapped.ts — computeWrappedStats(): per-contributor signature genre, #1 artist, group-unique pick, era range, headline counts
  - components/analytics/WrappedCard.tsx — bold per-contributor Wrapped card (server component)
  - "Wrapped" section on the /analytics hub (final section, below Taste profiles)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function module with a colocated node:assert/strict spec, runnable via `npx tsx lib/wrapped.test.ts` — matches lib/similarity.ts/.test.ts convention"
    - "Exclusivity computed globally over attributedRows via a value->Set<contributor> map (artist first, genre fallback), reused verbatim from RESEARCH Pattern 6"
    - "headlineCounts.sessions = COUNT(DISTINCT sessionId) over each contributor's own attributedRows — never hardcoded, so 3-person sessions 25/28 read correctly for whoever was absent"

key-files:
  created:
    - lib/wrapped.ts
    - lib/wrapped.test.ts
    - components/analytics/WrappedCard.tsx
  modified:
    - app/analytics/page.tsx

key-decisions:
  - "Genre-exclusivity fallback excludes the 'Unspecified' bucket from eligibility — an artist-tagless majority sharing 'Unspecified' would otherwise falsely register as someone's exclusive genre"
  - "groupUniquePick ranks a contributor's exclusive candidates by their own track count for that value (desc, then alpha) when more than one exclusive artist/genre exists, so the pick is their most-repeated exclusive choice, not an arbitrary one"
  - "WrappedCard uses inline style (backgroundColor/color from CONTRIBUTOR_COLORS) rather than Tailwind classes, matching OverlapHeatmap/WildcardRanking's established pattern for dynamic per-contributor colour"

requirements-completed: [ANALYTICS-04]

# Metrics
duration: ~25min
completed: 2026-08-12
---

# Phase 4 Plan 3: Wrapped Cards Summary

**A pure `lib/wrapped.ts` module computes each friend's Spotify-Wrapped-style standout stats — signature genre, #1 artist, a group-unique artist/genre pick, era range, and headline counts — rendered as four bold, contributor-coloured cards appended to the `/analytics` hub, completing Phase 4.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2/2 completed
- **Files modified:** 4 (2 new lib files, 1 new component, 1 route edit)

## Accomplishments
- Built `lib/wrapped.ts` `computeWrappedStats()`: derives `signatureGenre` (preferring a real genre over "Unspecified") and `topArtist` from Plan 01's per-contributor aggregates; computes `groupUniquePick` via a global `value -> Set<contributorInitials>` exclusivity map over `attributedRows` — artist-exclusivity first, genre-exclusivity fallback (excluding "Unspecified"), `null` if neither exists (RESEARCH Pattern 6 / Open Question 1 resolution); computes `eraRange` as min/max non-null `releaseYear`; computes `headlineCounts` with `sessions` as a real `COUNT(DISTINCT sessionId)` so 3-person sessions 25/28 correctly produce a count below 31 for whoever was absent (Pitfall 3)
- Wrote `lib/wrapped.test.ts` (node:assert/strict, `npx tsx`-runnable): a synthetic 3-contributor/8-row fixture proving an artist shared by two contributors is excluded from both group-unique picks, a contributor with no exclusive artist falls back correctly to their exclusive genre, era range correctly ignores a null year while taking min/max of the rest, and distinct-session counts differ per contributor's actual session presence (3 vs 2, not a hardcoded constant)
- Built `components/analytics/WrappedCard.tsx`, a plain server component (no `"use client"`) rendering one vivid card per contributor coloured via `CONTRIBUTOR_COLORS[initials]` background+foreground, with fun/personal copy ("Only Mark Wright played...") and graceful fallbacks for a null group-unique pick and a null era range
- Appended the final "Wrapped" section to `app/analytics/page.tsx`, below "Taste profiles", completing the locked D-13 page order (group overview → taste profiles → Wrapped) and updating the file's layout comment to reflect all three plans now shipped

## Task Commits

1. **Task 1: lib/wrapped.ts stat computation + colocated test** - `fc72512` (test)
2. **Task 2: WrappedCard component + inline Wrapped section** - `782a69c` (feat)

## Files Created/Modified
- `lib/wrapped.ts` - `computeWrappedStats(data)` and the `WrappedStats` type; `findExclusivePicks()` internal helper shared by the artist-first/genre-fallback exclusivity logic
- `lib/wrapped.test.ts` - colocated `node:assert/strict` spec, all assertions pass via `npx tsx lib/wrapped.test.ts`
- `components/analytics/WrappedCard.tsx` - bold per-contributor card, `CONTRIBUTOR_COLORS`-coloured, renders all four D-12 standout stats
- `app/analytics/page.tsx` - computes `wrapped = computeWrappedStats(data)`, renders the new "Wrapped" section (responsive 2-column grid of four `WrappedCard`s) as the final section; layout comment updated to note the hub is now feature-complete

## Decisions Made
- Genre-exclusivity fallback explicitly excludes the "Unspecified" bucket from consideration — without this exclusion, a group of contributors who all happen to share only "Unspecified" tags for a given artist could wrongly register as an exclusive genre pick for whoever has the fewest "Unspecified" rows
- When a contributor has more than one exclusive artist/genre candidate, `findExclusivePicks` ranks by their own track count for that value (desc, then alphabetical tiebreak) so the surfaced pick is their most-repeated exclusive choice rather than an arbitrary first match
- `WrappedCard` uses inline `style` for background/foreground colour (not Tailwind utility classes) — consistent with `OverlapHeatmap`/`WildcardRanking`'s established pattern for dynamic per-contributor colouring from `CONTRIBUTOR_COLORS`

## Deviations from Plan

None — plan executed as written. The only change beyond the plan's literal file list was a Biome auto-format pass (`biome check --write`) on `lib/wrapped.ts`/`lib/wrapped.test.ts` (line-wrapping only, no logic change) needed to satisfy Task 2's `npm run lint` verification gate; this is not a deviation in behavior, just formatting.

## Issues Encountered
None.

## User Setup Required
None — no new dependencies, no external service configuration.

## Verification Performed
- `npx tsx lib/wrapped.test.ts` — exits 0, prints "wrapped.test.ts: all assertions passed" (exclusive-artist-shared-by-two-excluded, artist-exclusivity resolved correctly for two different contributors, genre fallback when no exclusive artist exists, era-range min/max with a null year present, distinct-session counts of 3 vs 2 over the same fixture, and a synthetic all-null-year case yielding `{oldest: null, newest: null}`)
- `npm run typecheck` — passes, no errors
- `npm run lint` — passes, 0 errors across 66 files
- `npm run build` — compiles; `/analytics` remains a static (`○`) route, no dynamic-rendering warnings introduced
- Production smoke test: ran `next start -p 3412` against the built output and curled `/analytics` — response HTML contains "Wrapped", "Signature sound", "Standout pick", "Era range", and all four real per-contributor exclusive-pick lines ("Only Mark Wright played...", "Only Jack Groves played...", "Only Jon Slade played...", "Only Iwan Thomas played..."), confirming the section renders with real server-computed data, not stubs
- **Deferred to human/browser verification:** visual polish of the four Wrapped cards (colour contrast at a glance, card sizing/spacing on mobile, whether the group-unique-pick copy reads naturally for each of the four real picks) — this headless environment confirmed correct markup/data via curl but not pixel-level rendering; eyeball at `/analytics` in a browser to confirm

## Next Phase Readiness
- Phase 4 (Analytics) is now feature-complete: taste profiles (Plan 01), group overview (Plan 02), Wrapped cards (Plan 03) all live on the single `/analytics` hub in the locked D-13 order
- No blockers identified; no further plans scheduled for this phase

---
*Phase: 04-analytics*
*Completed: 2026-08-12*

## Self-Check: PASSED
All 4 created/modified files verified present on disk; both task commit hashes (fc72512, 782a69c) verified present in git log.
