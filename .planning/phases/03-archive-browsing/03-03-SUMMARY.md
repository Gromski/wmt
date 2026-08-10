---
phase: 03-archive-browsing
plan: 03
subsystem: ui
tags: [nextjs, rsc, drizzle, tailwind, shadcn, radix, lucide]

# Dependency graph
requires:
  - phase: 03-archive-browsing
    provides: "grid-only ArchiveClient with stable { sessions } props signature, CONTRIBUTOR_COLORS, ContributorChip, SessionCard from 03-02"
provides:
  - "Grid/table/timeline view toggle on /sessions, persisted via ?view= URL param"
  - "components/SessionTimeline.tsx — presentational chronological rail"
  - "Client-side search across theme, contributor name, and artist name (no API route, D-14)"
  - "No-matching-sessions empty state with Clear search affordance"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useSearchParams + router.replace for URL-persisted view state (grid/table/timeline), narrowed to a fixed union with a safe fallback to grid for any invalid ?view= value"
    - "useMemo-based client-side filter + local sort state over the RSC-preloaded sessions payload — no round-trips for search or table sort"
    - "Presentational SessionTimeline receives pre-filtered sessions and re-sorts only for display (dated desc, undated appended by sessionNumber desc)"

key-files:
  created:
    - components/SessionTimeline.tsx
  modified:
    - components/ArchiveClient.tsx
    - components/SessionCard.tsx
    - app/sessions/page.tsx

key-decisions:
  - "Added artistNames: string[] to SessionCardPayload rather than introducing a new payload type; app/sessions/page.tsx's existing contributor two-query merge was extended with a leftJoin to tracks to collect a de-duplicated set of artist names per session, avoiding a new query"
  - "Table view whole-row-links-to-detail requirement satisfied by wrapping each cell's content in a Link rather than the <tr> itself (native <tr> cannot be an anchor); row hover background still comes from the existing TableRow shadcn styles"
  - "?view= narrowing uses a type guard (isView) with fallback to \"grid\" for any non-matching value — satisfies threat T-03-09 (tampering via query param) with no attacker-controlled code path"
  - "Timeline dot hover/focus styling uses group/group-focus-within on the <li> (not the <Link>) since the dot span is a sibling of the Link, not a descendant of it"

patterns-established:
  - "Client-side search/filter/sort over an RSC-preloaded payload as the default pattern for future small-dataset interactive lists (reusable for Phase 4 analytics table views if needed)"

requirements-completed: [BROWSE-04, BROWSE-05]

# Metrics
duration: ~35min
completed: 2026-08-10
---

# Phase 3 Plan 3: Interactive Browse Layer (View Toggle + Search) Summary

**Grid/table/timeline view toggle with `?view=` URL persistence and instant client-side search across theme, person, and artist, extending the Plan 02 ArchiveClient island in place.**

## Performance

- **Duration:** ~35 min active execution
- **Started:** 2026-08-10T09:00:00Z
- **Completed:** 2026-08-10T09:35:00Z
- **Tasks:** 2 planned, 0 deviations
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments

- `components/SessionTimeline.tsx` renders a single vertical rail: dated sessions ordered newest-first, undated sessions appended afterward ordered by `sessionNumber` descending (D-12 — never hidden), with optional year-group `Separator` labels and a violet-on-hover node dot per session
- `components/ArchiveClient.tsx` extended (not rewritten) with a controls bar: a search input (`Search` icon inset, placeholder "Search by theme, person, or artist") and a three-segment view toggle (`LayoutGrid`/`Rows3`/`CalendarClock`, labels Grid/Table/Timeline); active view read from `?view=` via `useSearchParams`, written via `router.replace` (narrowed to the `"grid"|"table"|"timeline"` union with a safe fallback to `"grid"` for any other value — mitigates T-03-09)
- Table view renders shadcn `Table` with sortable No/Theme/Date/Contributors columns (click header toggles asc/desc, `ArrowUpDown` indicator highlights the active sort column), default sort No descending; every cell links to `/sessions/{n}`
- Client-side search (`useMemo` filter, D-14) matches case-insensitively across `session.theme`, each contributor's full name, and each session's artist names; empty query returns all sessions
- No-results state ("No matching sessions" heading + interpolated body + "Clear search" ghost button) renders distinctly from the pre-existing "No sessions yet" empty state
- `app/sessions/page.tsx`'s existing contributor two-query merge was extended with a `leftJoin` to `tracks` to collect a de-duplicated `artistNames: string[]` per session, threaded into `SessionCardPayload` — no new query, no API route added
- Verified end-to-end against the live re-imported database (32 sessions, 467 tracks) via `npm run build` (production build, exits 0) and manual `curl` checks of `/sessions?view=table` and `/sessions?view=timeline` (both 200) plus RSC payload inspection confirming `artistNames` is present per session in the flight data

## Task Commits

Each task was committed atomically:

1. **Task 1: SessionTimeline presentational component** - `795b50d` (feat)
2. **Task 2: Extend ArchiveClient with view toggle, table view, and client-side search** - `0d61307` (feat)

## Files Created/Modified

- `components/SessionTimeline.tsx` (new) - presentational chronological rail; sorts dated sessions desc then undated by sessionNumber desc; links each node to `/sessions/{n}`; renders `ContributorChip` per session (relies on parent `TooltipProvider`)
- `components/ArchiveClient.tsx` - added `useSearchParams`/`useRouter` view state, search input + `useMemo` filter, sortable table view, `SessionTimeline` render branch, and the distinct no-results empty state; kept the exported `{ sessions }` signature and root `TooltipProvider` from Plan 02
- `components/SessionCard.tsx` - added `artistNames: string[]` to `SessionCardPayload`
- `app/sessions/page.tsx` - extended the contributor query with a `leftJoin` to `schema.tracks`, collected a de-duplicated `artistsBySession` map, and included `artistNames` in the `SessionCardPayload` mapping

## Decisions Made

- `artistNames` was added to the existing `SessionCardPayload` type instead of introducing a separate props extension, keeping ArchiveClient's single props parameter intact
- Table rows use per-cell `Link` wrapping (native `<tr>` cannot be an anchor) rather than a row-level `onClick` handler, preserving keyboard/middle-click/right-click semantics for "click the row to open the session"
- `?view=` is validated with a type-guard (`isView`) falling back to `"grid"` for any unrecognized value, directly satisfying threat T-03-09 in the plan's threat model — no attacker-controlled string ever reaches a code branch
- Timeline node dot hover styling required moving the `group` class from the `Link` to the parent `<li>` (the dot span is a layout sibling of the Link, not a descendant), using `group-focus-within` for keyboard-focus parity with hover

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were required.

## Issues Encountered

None. `npm run typecheck`, `npm run lint`, and `npm run build` all exited 0 on the first attempt after Biome's `organizeImports`/formatter auto-fixes were applied (import ordering and line-wrapping only, no logic changes).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BROWSE-01 through BROWSE-05 are now all complete; Phase 3 (Archive Browsing) delivers the full public read-only browse surface described in `.planning/phases/03-archive-browsing/03-CONTEXT.md`
- `components/ArchiveClient.tsx`, `components/SessionTimeline.tsx`, `components/SessionCard.tsx`, `components/ContributorChip.tsx`, and `lib/contributor-colors.ts` are all reusable primitives available to Phase 4 (Analytics) without modification
- The client-side search/filter/sort-over-RSC-payload pattern established here is a candidate reusable pattern if Phase 4 needs similarly small-dataset interactive tables

---
*Phase: 03-archive-browsing*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created/modified files verified present on disk; both task commit hashes (795b50d, 0d61307) verified in git log.
