---
phase: 04-analytics
plan: 02
subsystem: analytics
tags: [cosine-similarity, css-grid-heatmap, rsc, next16]

# Dependency graph
requires:
  - phase: 04-analytics
    plan: 01
    provides: getAnalyticsData() AnalyticsData contract (artistVector/genreVector, raw genreProportions/decadeProportions), app/analytics/page.tsx hub with a Plan-02 insertion point above "Taste profiles"
  - phase: 03-archive-browsing
    provides: lib/contributor-colors.ts (CONTRIBUTOR_COLORS)
provides:
  - lib/similarity.ts — cosineSimilarity, pairwiseSimilarity, buildOverlapMatrix, buildProfileVector, divergenceRanking + exported tuning constants SIMILARITY_WEIGHTS/PROFILE_WEIGHTS
  - components/analytics/OverlapHeatmap.tsx — 4x4 CSS-grid similarity heatmap
  - components/analytics/WildcardRanking.tsx — ranked divergence list with wildcard highlight
  - "Group overview" section on the /analytics hub, above "Taste profiles"
affects: [04-03-wrapped-cards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function module with a colocated node:assert/strict spec, runnable via `npx tsx lib/similarity.test.ts` — matches lib/parse-playlist.ts/.test.ts convention"
    - "Hand-rolled CSS-grid heatmap (deliberate exception to 'don't hand-roll' — Recharts has no heatmap chart type)"
    - "Weighting applied downstream of aggregation: lib/analytics.ts emits raw proportions, lib/similarity.ts applies the live tuning constants — keeps Plan 01's contract stable while Plan 02 owns all weighting math"

key-files:
  created:
    - lib/similarity.ts
    - lib/similarity.test.ts
    - components/analytics/OverlapHeatmap.tsx
    - components/analytics/WildcardRanking.tsx
  modified:
    - app/analytics/page.tsx

key-decisions:
  - "buildProfileVector is the ONLY place PROFILE_WEIGHTS is applied — divergenceRanking always routes contributors through it (default or explicit weights), so retuning the constant provably changes the wildcard result (proven in the test via two contrasting weight objects producing different wildcards: genre-only isolates one contributor, era-only isolates another)"
  - "OverlapHeatmap resolves cell text colour via CONTRIBUTOR_COLORS[row].fg instead of a hardcoded text-white — JS's amber background pairs with dark text in the colour map, so a fixed white (as in the RESEARCH.md Pattern 7 example) would fail contrast on that row"
  - "Group overview section rendered as a 2-column grid (heatmap left, wildcard ranking right) on md+ screens, stacked on mobile — consistent with the existing Taste-profiles section's grid-cols-1/md:grid-cols-2 pattern"

requirements-completed: [ANALYTICS-02, ANALYTICS-03]

# Metrics
duration: ~35min
completed: 2026-08-12
---

# Phase 4 Plan 2: Group Overview — Overlap Heatmap & Wildcard Ranking Summary

**A 4x4 pairwise-similarity heatmap and a divergence-based "wildcard" ranking, both computed by a new pure-math `lib/similarity.ts` module and prepended above the taste-profile cards on the `/analytics` hub.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified:** 5 (2 new lib files, 2 new components, 1 route edit)

## Accomplishments
- Built `lib/similarity.ts`: `cosineSimilarity`/`pairwiseSimilarity`/`buildOverlapMatrix` over weighted artist+genre vectors (`SIMILARITY_WEIGHTS` 0.7/0.3), plus `buildProfileVector`/`divergenceRanking` that apply the LIVE `PROFILE_WEIGHTS` (0.5/0.5) to Plan 01's raw, unweighted `genreProportions`/`decadeProportions` — proven genuinely wired via a test that shows two contrasting weight objects producing different wildcards
- Wrote `lib/similarity.test.ts` (node:assert/strict, `npx tsx`-runnable, no DB dependency) covering self/disjoint/empty cosine cases, symmetry, blend weighting, matrix symmetry/diagonal, ranking order, and the PROFILE_WEIGHTS-liveness proof
- Built `OverlapHeatmap` (hand-rolled CSS grid, the one sanctioned exception to "don't hand-roll" since Recharts has no heatmap type) and `WildcardRanking` (ordered list, top entry visually boxed and badged "The Wildcard") as plain server components colour-keyed via `CONTRIBUTOR_COLORS`
- Prepended a new "Group overview" section to `app/analytics/page.tsx`, above "Taste profiles", per D-13's locked page order

## Task Commits

1. **Task 1: lib/similarity.ts pure math + colocated test** - `69d1802` (test)
2. **Task 2: Overlap heatmap + wildcard ranking + group-overview section** - `5d98f84` (feat)

## Files Created/Modified
- `lib/similarity.ts` - `cosineSimilarity`, `pairwiseSimilarity`, `buildOverlapMatrix`, `buildProfileVector`, `divergenceRanking`, `SIMILARITY_WEIGHTS`, `PROFILE_WEIGHTS`
- `lib/similarity.test.ts` - colocated `node:assert/strict` spec, all assertions pass via `npx tsx lib/similarity.test.ts`
- `components/analytics/OverlapHeatmap.tsx` - 4x4 CSS-grid heatmap, cell opacity scaled by score, diagonal "—", contributor-fg text colour
- `components/analytics/WildcardRanking.tsx` - all-four ranked list, top entry highlighted + labelled "The Wildcard"
- `app/analytics/page.tsx` - new "Group overview" section (2-column grid: heatmap + ranking) computed from `buildOverlapMatrix(contributors)` / `divergenceRanking(contributors)`, inserted above "Taste profiles"; updated the layout comment to reflect the now-shipped section

## Decisions Made
- Kept `buildProfileVector` as the single weighting seam: it is the only function that multiplies by `PROFILE_WEIGHTS`/`weights`, and `divergenceRanking` always calls it (never reads a pre-baked vector) — this satisfies the plan's explicit requirement that retuning the constant changes real output, not just an internal detail
- Chose a 2-column grid (heatmap | ranking) for the group-overview section rather than stacking both full-width, matching the existing taste-profile card grid's responsive breakpoint (`grid-cols-1 md:grid-cols-2`)
- Used `entry.divergence.toFixed(2)` next to each name in `WildcardRanking` (not just the top entry) so all four scores are visible, satisfying D-07's "ranked, not just one name" requirement without a separate legend

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed low-contrast text colour in the heatmap cells**
- **Found during:** Task 2 implementation
- **Issue:** 04-RESEARCH.md's Pattern 7 code example hardcodes `text-white` on every cell. `CONTRIBUTOR_COLORS.JS` is an amber background paired with dark (`oklch(0.145 0 0)`) foreground text specifically because white-on-amber fails contrast — the research example predates that colour-map detail and would have shipped an unreadable JS row.
- **Fix:** `cellStyle()` now returns `color: color?.fg` alongside `backgroundColor`/`opacity`, and the cell `className` dropped the hardcoded `text-white`. Every row now uses the same fg/bg pairing already established by `ContributorChip`.
- **Files modified:** `components/analytics/OverlapHeatmap.tsx`
- **Verification:** Visual — JS's row now renders dark text on amber, matching `ContributorChip`'s convention; other three rows (violet/blue/emerald bg) already used light fg so no visible change there.
- **Committed in:** `5d98f84`

---

**Total deviations:** 1 auto-fixed (1 bug/correctness)
**Impact on plan:** Minor, contained to one component's inline style — no scope creep, no other files touched.

## Issues Encountered
None beyond the contrast fix above.

## User Setup Required
None — no new dependencies, no external service configuration.

## Verification Performed
- `npx tsx lib/similarity.test.ts` — exits 0, prints "similarity.test.ts: all assertions passed" (self=1 within float tolerance, disjoint=0, empty=0/no-NaN, symmetry, blend-weighting formula equality + [0,1] bound, matrix symmetry + diagonal=1, `buildProfileVector` hand-computed check against both the default and an explicit `weights` arg, `divergenceRanking` sort order + wildcard=index 0, and the PROFILE_WEIGHTS-liveness proof: genre-only weighting isolates one wildcard, era-only weighting isolates a different one, over the identical three-contributor fixture)
- `npm run typecheck` — passes, no errors
- `npm run lint` — passes, 0 errors across 63 files (one Biome auto-format pass applied to `lib/similarity.test.ts` and `app/analytics/page.tsx` for line-wrapping; content unchanged)
- `npm run build` — compiles; `/analytics` still appears as a static (`○`) route, unchanged rendering mode
- Production smoke test: ran `next start -p 3411` against the built output and curled `/analytics` — response HTML contains "Group overview", "Who overlaps most", and "The Wildcard", confirming the new section renders with real server-computed data (not a stub)
- **Deferred to human/browser verification:** visual polish of the heatmap grid (aspect-ratio cell sizing at various viewport widths, opacity gradient legibility) and the wildcard highlight's box-shadow ring — this headless environment confirmed correct markup/data via curl but not pixel-level rendering; eyeball at `/analytics` in a browser to confirm

## Next Phase Readiness
- `lib/similarity.ts`'s exported API (`buildOverlapMatrix`, `divergenceRanking`, `buildProfileVector`, tuning constants) is stable for Plan 04-03 (Wrapped cards) if it needs any divergence/overlap context, though Wrapped cards are expected to consume `getAnalyticsData()`/`attributedRows` directly per the RESEARCH.md Wrapped patterns
- `app/analytics/page.tsx` retains its explicit "Plan 04-03 Wrapped cards section inserts here" comment below "Taste profiles" — no restructuring needed for the next plan
- No blockers identified

---
*Phase: 04-analytics*
*Completed: 2026-08-12*

## Self-Check: PASSED
All 5 created/modified files verified present on disk; both task commit hashes (69d1802, 5d98f84) verified present in git log.
