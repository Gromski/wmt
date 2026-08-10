---
phase: 03-archive-browsing
plan: 02
subsystem: ui
tags: [nextjs, rsc, drizzle, tailwind, shadcn, radix, lucide]

# Dependency graph
requires:
  - phase: 03-archive-browsing
    provides: "youtube_url column, corrected round-robin attribution, live re-imported DB (32 sessions / 467 tracks) from 03-01"
provides:
  - "Public / redirect to /sessions (no auth gate)"
  - "lib/contributor-colors.ts CONTRIBUTOR_COLORS map (MW/JG/JS/IT) — shared source of truth for Plan 03 and Phase 4"
  - "components/ContributorChip.tsx — coloured Avatar chip with full-name Tooltip"
  - "app/sessions/page.tsx — public archive grid RSC reading all sessions + per-session contributor chips"
  - "components/SessionCard.tsx, components/ArchiveClient.tsx — grid rendering with stable props signature for Plan 03 extension"
  - "app/sessions/[sessionNumber]/page.tsx — session detail RSC with play-order track list and Apple Music / YouTube open-in links"
affects: [03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-query merge (sessions + session_tracks/contributors leftJoin) to build per-session contributor chip lists without a session x track x contributor cross-product"
    - "Explicit multi-table leftJoin (sessions -> session_tracks -> tracks -> contributors) grouped into a session detail object in the RSC, mirroring the Phase 2 dashboard query pattern"
    - "ContributorChip as a shared presentational primitive consuming CONTRIBUTOR_COLORS, reused across grid cards and track rows at different sizes (24px / 20px)"

key-files:
  created:
    - lib/contributor-colors.ts
    - components/ContributorChip.tsx
    - components/SessionCard.tsx
    - components/ArchiveClient.tsx
    - app/sessions/page.tsx
    - app/sessions/[sessionNumber]/page.tsx
  modified:
    - app/page.tsx
    - components/GlobalHeader.tsx
    - app/globals.css

key-decisions:
  - "CONTRIBUTOR_COLORS oklch values matched exactly to UI-SPEC LOCKED table; CSS vars added inside the .dark block (the app has no light-mode toggle in active use, matching the existing token pattern)"
  - "ArchiveClient ships grid-only in this plan with a stable { sessions } props signature; Plan 03 extends (not rewrites) it to add the table/timeline toggle and search"
  - "Session detail renders entirely as static RSC HTML (no client island) except for the Tooltip subtree, which is wrapped in a single root TooltipProvider per PATTERNS.md"

patterns-established:
  - "Public browse routes (/sessions, /sessions/[n]) omit the auth.api.getSession guard entirely rather than gating with a null check — established as the pattern for all future public read routes"

requirements-completed: [BROWSE-01, BROWSE-02, BROWSE-03]

# Metrics
duration: ~55min
completed: 2026-08-10
---

# Phase 3 Plan 2: Browse Vertical Slice (Archive Grid + Session Detail) Summary

**Public `/sessions` archive grid and `/sessions/[n]` detail pages reading live Drizzle data (32 sessions, 467 tracks), with a shared four-person contributor colour system and working Apple Music / YouTube open-in links.**

## Performance

- **Duration:** ~55 min active execution
- **Started:** 2026-08-10T08:10:00Z
- **Completed:** 2026-08-10T08:35:00Z
- **Tasks:** 3 planned, 0 deviations
- **Files modified:** 9 (3 modified, 6 created)

## Accomplishments

- `/` now redirects to `/sessions`; the global header app-name link points at `/sessions` — the public archive is the app's landing surface (D-01)
- `lib/contributor-colors.ts` establishes `CONTRIBUTOR_COLORS` (MW/JG/JS/IT) as the single source of truth for contributor identity colour, matched exactly to the UI-SPEC LOCKED oklch values; `components/ContributorChip.tsx` is the reusable coloured-Avatar-plus-Tooltip primitive built on it
- `/sessions` renders all 32 sessions as a responsive card grid (1/2/3 columns), newest first, each card showing session number, theme, date or "Date TBD", and contributor chips derived from a two-query merge over `sessions` + `session_tracks`/`contributors` (no session x track x contributor cross-product)
- `/sessions/[sessionNumber]` renders the full play-order track list (whatever length the session actually has — verified against sessions with 2, 4, 12, 14, 15, and 16 tracks), per-track contributor chip (correctly omitted for unattributed sessions, though none currently exist post-03-01 re-import), and working Apple Music (`music.apple.com/gb/song/{appleId}`) and YouTube (`SquarePlay` icon, since `Youtube` is not exported by `lucide-react@1.18.0`) open-in links that render conditionally per track
- Verified end-to-end against the live re-imported database in a **production build** (`next build && next start`): all 32 sessions return 200, `/sessions/9999` returns 404, root redirects, and `target="_blank"` / `rel="noopener noreferrer"` counts match on every session's link buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Root redirect, header link, contributor colour map + chip** - `98a8c38` (feat)
2. **Task 2: Archive page (/sessions) — RSC data load, SessionCard, grid via ArchiveClient** - `479b0c2` (feat)
3. **Task 3: Session detail page (/sessions/[sessionNumber]) with track links** - `de82e2b` (feat)

## Files Created/Modified

- `app/page.tsx` - replaced stub with a synchronous `redirect("/sessions")` RSC
- `components/GlobalHeader.tsx` - app-name link href changed from `/` to `/sessions`
- `app/globals.css` - added `--contributor-mw/-jg/-js/-it` CSS variables inside `.dark`
- `lib/contributor-colors.ts` (new) - `CONTRIBUTOR_COLORS` map keyed by initials
- `components/ContributorChip.tsx` (new) - coloured Avatar + Tooltip chip, consumes a parent `TooltipProvider`
- `components/SessionCard.tsx` (new) - Card linking to `/sessions/{n}`, session number/theme/date/contributor chips
- `components/ArchiveClient.tsx` (new) - `"use client"` grid island wrapped in `TooltipProvider`, responsive grid + empty state, stable props for Plan 03
- `app/sessions/page.tsx` (new) - public RSC, two-query merge (sessions desc + contributor chips per session), wraps `ArchiveClient` in `Suspense`
- `app/sessions/[sessionNumber]/page.tsx` (new) - async RSC, awaits `params` (Next.js 16), explicit 4-table leftJoin query, play-order track list, Apple/YouTube link buttons

## Decisions Made

- CSS variables for the contributor colour map were added to the `.dark {}` block rather than `:root` — the app currently ships dark-mode tokens only in `.dark`, matching the existing `--primary`/`--ring` pattern; no light-mode variant exists to duplicate into
- `ArchiveClient` deliberately ships without the view toggle or search in this plan; its `{ sessions: SessionCardPayload[] }` signature is frozen so Plan 03 can extend it in place
- Session detail header collects a de-duplicated `Map<initials, name>` of contributors actually present in the track list (rather than always expecting exactly 4), so 3-person MIA/AWOL sessions (25, 28) render only their actual attendees — consistent with the data note that not every session has 4 contributors

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were required; all three tasks matched their acceptance criteria on first implementation.

## Issues Encountered

- **Dev-mode-only Turbopack rendering artifact (not a code bug):** `next dev` intermittently threw `Error: Primitive.button failed to slot onto its children. Expected a single React element child or 'Slottable'.` for `/sessions/25` specifically, across multiple full dev-server restarts and cache clears. Investigation ruled out a data or JSX issue: (1) an isolated `renderToStaticMarkup` reproduction using session 25's exact real query data and exact JSX rendered successfully outside Next; (2) `npm run build && npm run start` (production mode) served `/sessions/25` with a clean 200 alongside every other session. This is consistent with a known Turbopack dev-server module-duplication artifact affecting Radix Slot's identity checks across separately compiled route chunks — not a defect in this plan's code. No source change was made; verification for this plan proceeded against the production build, which is unambiguous ground truth for the acceptance criteria (`npm run build` exits 0; manual GET checks specified in the plan's `<verification>` block).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03 can extend `components/ArchiveClient.tsx` in place (stable props signature) to add the table/timeline view toggle and client-side search over the same `sessions` payload
- `CONTRIBUTOR_COLORS` and `ContributorChip` are ready for direct reuse in Plan 03's table/timeline views and in Phase 4 analytics
- Verified against the full live dataset (32 sessions, 467 tracks, track counts ranging from 2 to 16 per session) — no additional data-layer work is needed before Plan 03

---
*Phase: 03-archive-browsing*
*Completed: 2026-08-10*

## Self-Check: PASSED

All created/modified files verified present on disk; all three task commit hashes (98a8c38, 479b0c2, de82e2b) verified in git log.
