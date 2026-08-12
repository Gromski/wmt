---
phase: 04-analytics
plan: 01
subsystem: analytics
tags: [recharts, shadcn-chart, drizzle, rsc, genre-whitelist, next16]

# Dependency graph
requires:
  - phase: 03-archive-browsing
    provides: lib/contributor-colors.ts (CONTRIBUTOR_COLORS), public no-auth RSC route pattern (/sessions)
  - phase: 02-import-pipeline
    provides: session_tracks/tracks/contributors/artist_tags data already in local.db
provides:
  - "npx shadcn@latest add chart" install (recharts 3.10.x + components/ui/chart.tsx)
  - lib/genre-whitelist.ts (GENRE_MAP, normalizeTag, resolveGenre)
  - lib/analytics.ts getAnalyticsData() — the stable AnalyticsData contract (contributors[], attributedRows[])
  - Three "use client" Recharts chart components under components/analytics/
  - Public /analytics hub page rendering four taste profiles
  - "Analytics" nav link in GlobalHeader
affects: [04-02-group-overview, 04-03-wrapped-cards]

# Tech tracking
tech-stack:
  added: [recharts@3.10.x, shadcn ui/chart.tsx (ChartContainer/ChartTooltip/ChartConfig)]
  patterns:
    - "Single-pass server aggregation: two Drizzle queries, in-memory Map grouping, plain-object return (no Map/Date) — mirrors app/sessions/page.tsx"
    - "Per-contributor colour resolution via CONTRIBUTOR_COLORS[initials], never shadcn's generic --chart-N vars, for any contributor-identity chart"
    - "Single-label genre per artist: first whitelisted tag by ascending rank wins; none resolve -> Unspecified"
    - "Explicit Unknown/Unspecified buckets kept in every histogram/breakdown so totals stay internally consistent"
    - "No cache directive / no cacheComponents flag — relies on Next's default static rendering for a route with no dynamic Request APIs"

key-files:
  created:
    - lib/genre-whitelist.ts
    - lib/analytics.ts
    - components/analytics/TasteProfileRadar.tsx
    - components/analytics/EraBarChart.tsx
    - components/analytics/TopArtistsBarChart.tsx
    - app/analytics/page.tsx
    - components/ui/chart.tsx (shadcn-generated)
  modified:
    - components/GlobalHeader.tsx
    - package.json / package-lock.json (recharts dependency)

key-decisions:
  - "Genre resolution is single-label per artist (first whitelisted tag by rank), consistent with RESEARCH Pattern 2 — used everywhere genre appears in this phase"
  - "getAnalyticsData() returns RAW, UNWEIGHTED genreProportions/decadeProportions; Plan 02 owns the weighted profile-vector/centroid math on top of these"
  - "Fixed a pre-existing Biome lint violation (noArrayIndexKey x2, noDangerouslySetInnerHtml) in the shadcn-CLI-generated components/ui/chart.tsx so `npm run lint` passes cleanly"

patterns-established:
  - "lib/analytics.ts is the single aggregation entrypoint for Phase 4 — Plans 02/03 must consume its AnalyticsData contract, not add parallel queries"
  - "components/analytics/*.tsx chart components take an `initials` prop and resolve colour the same way ContributorChip does"

requirements-completed: [ANALYTICS-01]

# Metrics
duration: ~65min
completed: 2026-08-12
---

# Phase 4 Plan 1: Analytics Foundation & Taste Profiles Summary

**Public `/analytics` hub with real per-friend taste profiles (genre radar + era bar + top-5 artists bar via shadcn/Recharts) computed by a new single-pass `lib/analytics.ts` aggregation over the existing session/track/tag data.**

## Performance

- **Duration:** ~65 min (commits span 10:00:15–10:05:32 local time, 2026-08-12)
- **Tasks:** 3/3 completed
- **Files modified:** 9 (2 new lib modules, 3 new chart components, 1 new route, 1 shadcn-generated file, 1 header edit, plus package.json/package-lock.json)

## Accomplishments
- Installed `recharts` + shadcn's `ChartContainer`/`ChartTooltip` wrapper via `npx shadcn@latest add chart` — first charting dependency in the project
- Built `lib/genre-whitelist.ts` (curated `GENRE_MAP`, `normalizeTag`, `resolveGenre`) resolving Last.fm tags to canonical genres, verified against the actual tag survey in RESEARCH.md
- Built `lib/analytics.ts` `getAnalyticsData()` — a single-pass, two-query, in-memory-grouped aggregation returning the exact `AnalyticsData`/`ContributorAnalytics`/`AttributedRow` contract Plans 02/03 depend on, with explicit "Unknown"/"Unspecified" buckets and RAW unweighted proportions
- Shipped three client chart components (`TasteProfileRadar`, `EraBarChart`, `TopArtistsBarChart`) and a public `/analytics` RSC hub rendering all four contributors' taste profiles, plus the new "Analytics" header nav link

## Task Commits

1. **Task 1: Install shadcn chart + build the genre whitelist** - `76e5a99` (feat) + `0b79be0` (fix — Biome lint cleanup in generated chart.tsx)
2. **Task 2: Build lib/analytics.ts single-pass aggregation** - `99235ad` (feat)
3. **Task 3: Chart components + /analytics hub + header link** - `c03fa6c` (feat)

_Note: Task 1 produced an extra fix commit for pre-existing lint violations in the shadcn-CLI-generated file — see Deviations below._

## Files Created/Modified
- `lib/genre-whitelist.ts` - `GENRE_MAP` (curated Last.fm tag → canonical genre), `normalizeTag`, `resolveGenre`
- `lib/analytics.ts` - `getAnalyticsData()`: two Drizzle queries + in-memory grouping → per-contributor `topArtists`/`decadeHistogram`/`genreBreakdown`/vectors/proportions + flat `attributedRows`
- `components/ui/chart.tsx` - shadcn-generated `ChartContainer`/`ChartTooltip`/`ChartTooltipContent`/`ChartConfig` (Biome-cleaned)
- `components/analytics/TasteProfileRadar.tsx` - genre radar chart, `"use client"`, `CONTRIBUTOR_COLORS`-coloured
- `components/analytics/EraBarChart.tsx` - decade histogram bar chart
- `components/analytics/TopArtistsBarChart.tsx` - horizontal top-5-artist bar chart
- `app/analytics/page.tsx` - public async RSC hub, calls `getAnalyticsData()` once, renders one `Card` per contributor with all three charts; layout comments mark insertion points for Plan 02 (group overview, above) and Plan 03 (Wrapped cards, below)
- `components/GlobalHeader.tsx` - added `<Link href="/analytics">Analytics</Link>` as the first child of `<nav>`
- `package.json` / `package-lock.json` - added `recharts` dependency

## Decisions Made
- Single-label genre resolution (first whitelisted tag by ascending `rank`) applied uniformly — matches RESEARCH Pattern 2, avoids a second "which genres count" definition
- `genreProportions`/`decadeProportions` are intentionally RAW and unweighted in this plan; Plan 02 applies `PROFILE_WEIGHTS` on top — no combined `profileVector` field was added here
- Kept `leftJoin` + explicit null-checks (not `innerJoin`) for the contributor/track joins in `lib/analytics.ts`, matching the established local style in `app/sessions/page.tsx` even though 0 unattributed rows exist today — degrades gracefully if that changes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing Biome lint violations in shadcn-generated `components/ui/chart.tsx`**
- **Found during:** Task 1 (`npm run lint` verification step)
- **Issue:** The shadcn CLI's generated `chart.tsx` used array-index React keys (`lint/suspicious/noArrayIndexKey`, 2 instances) and an unguarded `dangerouslySetInnerHTML` (`lint/security/noDangerouslySetInnerHtml`) plus Biome formatting drift — all of which fail `npm run lint`, a required verification gate for this plan
- **Fix:** Replaced index keys with the already-computed stable `key` variable in both `ChartTooltipContent` and `ChartLegendContent`; added a scoped `biome-ignore` comment on the `dangerouslySetInnerHTML` usage (content is static theme CSS built from a hardcoded `THEMES` map + this app's own `ChartConfig` colors — never user-controlled input); ran `biome check --write` for formatting
- **Files modified:** `components/ui/chart.tsx`
- **Verification:** `npm run lint` passes with zero errors/warnings across all 59 files
- **Committed in:** `0b79be0`

---

**Total deviations:** 1 auto-fixed (1 blocking/lint)
**Impact on plan:** Necessary to satisfy the plan's own `npm run lint` verification gate on generated (not hand-written) code. No scope creep — no other files touched.

## Issues Encountered
None beyond the lint fix above.

## User Setup Required
None - no external service configuration required. `npx shadcn@latest add chart` ran as a real, verified install (recharts appears in `package.json`/`package-lock.json`; no separate `npm install` step needed).

## Verification Performed
- `npm run typecheck` — passes, no errors
- `npm run lint` — passes, 0 errors/warnings (59 files)
- `npm run build` — compiles; `/analytics` appears as a static (`○`) route alongside `/sessions`, no dynamic-rendering warnings
- `npx tsx` smoke test of `getAnalyticsData()` against `local.db`: 4 contributors returned (MW/JG/JS/IT), 474 total `attributedRows`, every contributor's `genreProportions` and `decadeProportions` sum to 1.000, `topArtists` capped at 5 and sorted count-desc, decade buckets include "Unknown" for null-release-year tracks
- `resolveGenre` unit-style spot check: `"Hip-Hop"`/`"rap"`/`"hip hop"` all resolve to `"Hip-Hop"`; `"seen live"`/`"welsh"` resolve to `null`
- Grepped the full repo for `"use cache"`/`cacheComponents` post-implementation — zero matches, confirming Pitfall 1 was avoided
- Ran a production build (`next start`) briefly and curled `/analytics` and `/sessions`: page HTML contains "Analytics", "Taste profiles", and all four contributor names (Mark Wright, Jack Groves, Jon Slade, Iwan Thomas); `/sessions` HTML contains `href="/analytics"` confirming the header link renders on every page
- **Deferred to human/browser verification:** interactive chart rendering (SVG tooltips, radar/bar hover states, responsive resize) — Recharts requires a real browser DOM (ResizeObserver, SVG measurement) that this headless environment cannot fully exercise; the curl-based content check confirms the correct data and markup ship, but visual/interactive polish should be eyeballed in a browser at `/analytics`

## Next Phase Readiness
- `lib/analytics.ts`'s `AnalyticsData` contract (contributors[], attributedRows[], including raw `artistVector`/`genreVector`/`genreProportions`/`decadeProportions`) is stable and ready for Plan 04-02 (group overview: overlap heatmap + wildcard ranking) and Plan 04-03 (Wrapped cards) to consume directly — no changes to this contract should be needed
- `app/analytics/page.tsx` has explicit layout comments marking where Plan 02's group-overview section (above Taste profiles) and Plan 03's Wrapped-cards section (below) slot in
- No blockers identified

---
*Phase: 04-analytics*
*Completed: 2026-08-12*

## Self-Check: PASSED
All 8 created/modified files verified present on disk; all 4 task commit hashes (76e5a99, 0b79be0, 99235ad, c03fa6c) verified present in git log.
