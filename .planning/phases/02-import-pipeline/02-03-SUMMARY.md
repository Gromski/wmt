---
phase: 02-import-pipeline
plan: "03"
subsystem: admin-ui
tags:
  - phase-2
  - admin-ui
  - date-entry
  - attribution-review
  - human-verify
dependency_graph:
  requires:
    - 02-01 (db/schema.ts sessions/contributors/sessionTracks tables, shadcn primitives)
    - 02-02 (import pipeline, KNOWN_CONTRIBUTORS from lib/parse-playlist.ts)
    - 01-03 (auth gate pattern, role column)
  provides:
    - app/api/sessions/[id]/route.ts (PATCH date entry)
    - app/api/sessions/[id]/attribution/route.ts (PATCH attribution rescue)
    - components/SessionDateTable.tsx (inline date editor)
    - components/AttributionErrorCard.tsx (4-slot attribution rescue UI)
    - app/dashboard/page.tsx (extended — admin editor sections)
  affects:
    - Phase 3 (Spotify enrichment will read sessions.date, session_tracks.attributed_contributor_id)
    - Phase 4 analytics (attribution data required for per-contributor stats)
tech_stack:
  added: []
  patterns:
    - PATCH route handler pattern with 401→403 auth gate (Date|null for timestamp_ms columns)
    - Per-row state machine in Client Component (default/saving/saved/error with setTimeout reset)
    - Position-range UPDATE using and(eq, gte, lte) from drizzle-orm
    - Date | null DB column returned as Date object — convert to number|null before passing as prop
    - Admin-conditional DB read in Server Component (skip DB hit for non-admin renders)
key_files:
  created:
    - app/api/sessions/[id]/route.ts
    - app/api/sessions/[id]/attribution/route.ts
    - components/SessionDateTable.tsx
    - components/AttributionErrorCard.tsx
  modified:
    - app/dashboard/page.tsx (added admin DB reads + two new editor sections, Phase 1 layout preserved)
decisions:
  - "Drizzle timestamp_ms columns return Date objects (not numbers) from select queries — dashboard converts with r.date instanceof Date ? r.date.getTime() : r.date before passing as SessionDateRow.date prop"
  - "date PATCH route stores Date object (new Date(parsed)) not raw ms — Drizzle ORM typing requires Date|null for timestamp_ms set()"
  - "Biome formatter splits long method chains across lines — db.select().from() becomes db\n  .select()\n  .from() — functionally identical, plan verify grep adapted accordingly"
metrics:
  duration: "~14 minutes"
  completed: "2026-07-14"
  tasks: 2
  files: 5
---

# Phase 02 Plan 03: Admin Editor Surfaces — Session Dates + Attribution Rescue Summary

Two admin PATCH routes and two admin Client Components completing the Phase 2 MVP: inline session-date entry (IMPORT-05) and manual attribution rescue for sessions with unparseable initials strings (IMPORT-08).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PATCH /api/sessions/[id] + PATCH /api/sessions/[id]/attribution | 03a4d8e | app/api/sessions/[id]/route.ts, app/api/sessions/[id]/attribution/route.ts |
| 2 | SessionDateTable + AttributionErrorCard + dashboard wiring | b275887 | components/SessionDateTable.tsx, components/AttributionErrorCard.tsx, app/dashboard/page.tsx |
| 3 | End-to-end Phase 2 verification | (checkpoint — awaiting human) | — |

## What Was Built

### app/api/sessions/[id]/route.ts (PATCH)

- 401→403 auth gate verbatim from Phase 1 pattern
- Validates `id` param as positive integer (400 + "Invalid session id")
- Parses `{ date: ISOString | null }` body — null/undefined clears the date
- `new Date(body.date).getTime()` parse; NaN → 400 + "Invalid date"
- Stores as `Date | null` (Drizzle timestamp_ms requires Date object, not raw ms)
- Drizzle bound parameter UPDATE — no SQLi surface (T-02-03-02)

### app/api/sessions/[id]/attribution/route.ts (PATCH)

- 401→403 auth gate
- Validates `id` param as positive integer
- Array shape validation: must be 4-element string array
- KNOWN_CONTRIBUTORS allowlist check: unknown initials → 400 + "Unknown initials: {X}" (T-02-03-03)
- Distinctness check: duplicate initials → 400 + "Duplicate initials" (D-12 four-slot rule)
- Resolves contributor ids from DB; missing row → 500 (defensive, shouldn't happen post-import)
- Position-range UPDATE loop: slots 0..3 → positions (slot×4+1)..(slot×4+4) using `and(eq, gte, lte)`
- Flips `sessions.attribution_parsed = true` after all four slot updates

### components/SessionDateTable.tsx

- `"use client"` Client Component; accepts `SessionDateRow[]` prop
- State: `values` (Record<id, string>) initialised from `r.date` ms → ISO slice(0,10)
- `states` per-row RowState machine: default → saving → saved → error
- Native `<input type="date">` with `onBlur` and `Enter` keydown trigger
- Saving: opacity-50 + cursor-wait + disabled
- Saved: Lucide `Check` in green-500 for 1.5s then clears
- Error: destructive border + `AlertCircle` inside `Tooltip` with "Could not save date — try again"
- Empty state: Card with "No sessions yet. Run 'Start import' above to populate."

### components/AttributionErrorCard.tsx

- `"use client"` Client Component; accepts `AttributionErrorRow[]` + `ContributorOption[]` props
- Renders null when all sessions are hidden (returns null after hiddenIds filtering)
- shadcn Alert with amber left-border + amber-950 background tint (T-02-03-SC: inline style, no new package)
- Four `SLOT_LABELS` per session ("Tracks 1–4" etc.), each a shadcn Select
- Save button disabled until `p.every(s => s !== "")` AND `new Set(p).size === 4` (D-12)
- On save: PATCH → toast success → 2s timeout → session row hidden
- 401/403/generic error toasts

### app/dashboard/page.tsx (extended)

- Phase 1 layout fully preserved (h1, avatar, badge, Separator, DashboardSignOut)
- Admin-only DB reads: `db.select({...}).from(schema.sessions).orderBy(asc(...))` + contributors
- `Date | null → number | null` conversion for `SessionDateRow.date` prop
- `attributionErrors` filtered from rows where `!r.attributionParsed`
- JSX layout order: ImportTriggerCard → (conditional) attribution error section → date table
- Non-admin: no DB queries run, no editor sections rendered

## IMPORT-01..08 Satisfaction Grid (Pre-Verification)

| Requirement | Status | Evidence |
|-------------|--------|---------|
| IMPORT-01: MusicKit JS authorisation popup | Implemented | components/ImportTriggerCard.tsx Task 02-02 |
| IMPORT-02: Multiple sessions imported | Implemented | app/api/import/route.ts Task 02-02 |
| IMPORT-03: Tracks stored with positions | Implemented | sessionTracks insert with position 1..16 Task 02-02 |
| IMPORT-04: Attribution parsed from description | Implemented | parsePlaylistDescription + slot attribution Task 02-02 |
| IMPORT-05: Session date entry + persistence | Implemented | SessionDateTable + PATCH /api/sessions/[id] Task 02-03 |
| IMPORT-06: Last.fm artist tag enrichment | Implemented | fetchArtistTags + artistTags insert Task 02-02 |
| IMPORT-07: Apple Music as data source | Implemented | apple-music-client.ts Task 02-02 |
| IMPORT-08: Manual attribution rescue | Implemented | AttributionErrorCard + PATCH /api/sessions/[id]/attribution Task 02-03 |

**Status:** All 8 requirements implemented. Human verification checkpoint pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome import ordering required drizzle-orm before next/headers**
- **Found during:** Task 1 and Task 2 lint verification
- **Issue:** Plan specified `next/headers` first, then drizzle-orm; biome v2 organizeImports requires drizzle-orm (third-party) before next/* (framework)
- **Fix:** Swapped import order in both route files and dashboard page
- **Files modified:** app/api/sessions/[id]/route.ts, app/api/sessions/[id]/attribution/route.ts, app/dashboard/page.tsx
- **Commits:** 03a4d8e, b275887

**2. [Rule 1 - Bug] TypeScript rejected `number | null` for timestamp_ms column set()**
- **Found during:** Task 1 typecheck
- **Issue:** Plan specified storing `ts: number | null` directly. Drizzle 0.45.x types `timestamp_ms` columns as `Date | SQL | SQLiteColumn | null | undefined` for set() — raw number is rejected
- **Fix:** Changed to `dateValue = new Date(parsed)` before the update call; added `Date | null` type annotation
- **Files modified:** app/api/sessions/[id]/route.ts
- **Commit:** 03a4d8e

**3. [Rule 1 - Bug] Biome detected unused `toast` import in SessionDateTable**
- **Found during:** Task 2 lint verification
- **Issue:** Plan template included `import { toast } from "sonner"` in SessionDateTable but the component intentionally uses inline error state (not toasts) per UI-SPEC §"No toast per row — UI-SPEC says inline error only to avoid noise". Import was unused.
- **Fix:** Removed the unused toast import
- **Files modified:** components/SessionDateTable.tsx
- **Commit:** b275887

**4. [Rule 1 - Bug] Biome import type order in AttributionErrorCard import block**
- **Found during:** Task 2 lint verification
- **Issue:** `type ContributorOption` must appear before value import `AttributionErrorCard` in the same import block per biome v2 organizeImports
- **Fix:** Swapped to `AttributionErrorCard, type ContributorOption` order
- **Files modified:** app/dashboard/page.tsx
- **Commit:** b275887

**5. [Rule 1 - Bug] Biome formatter split db.select() chain across lines**
- **Found during:** Task 2 — plan verify check `grep -q "db.select"` failed
- **Issue:** Biome formatter line-wraps long method chains; `db.select({...}).from(...)` became `db\n  .select({...})\n  .from(...)`. The plan verification grep pattern expected single-line form.
- **Fix:** No code fix needed — the implementation is functionally correct. Noted as false-negative in verify check; both `db` and `.select` are present in the file.
- **Committed as-is.**

## Known Stubs

None — both routes, both components, and the dashboard extension are complete implementations. All five files wire to real DB calls and real API endpoints.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers. All five mitigations applied:

- **T-02-03-01**: 401→403 gate in both PATCH routes (verified by grep)
- **T-02-03-02**: Date parse + NaN check + Drizzle bound parameter in sessions/[id] PATCH
- **T-02-03-03**: Array type check + KNOWN_CONTRIBUTORS allowlist + distinctness in attribution PATCH
- **T-02-03-04**: `Number.isInteger(sessionId) && sessionId > 0` in both routes
- **T-02-03-SC**: No new npm packages introduced — all five files use existing approved packages only

## Self-Check: PASSED

**Files exist:**
- FOUND: app/api/sessions/[id]/route.ts
- FOUND: app/api/sessions/[id]/attribution/route.ts
- FOUND: components/SessionDateTable.tsx
- FOUND: components/AttributionErrorCard.tsx
- FOUND: app/dashboard/page.tsx (modified)

**Commits exist:**
- FOUND: 03a4d8e — Task 1: PATCH /api/sessions/[id] + attribution route
- FOUND: b275887 — Task 2: SessionDateTable + AttributionErrorCard + dashboard

**Build:** `npm run build` exits 0 — all 8 routes compile cleanly including both new PATCH routes.

**Lint + typecheck:** Both pass with 0 errors.

**Verification checks passed:**
- Both route files: PATCH export, Unauthorized, Forbidden, KNOWN_CONTRIBUTORS (attribution), attributionParsed flip, gte/lte imports
- Both components: "use client", correct API path patterns
- Dashboard: SessionDateTable import, AttributionErrorCard import, isAdmin gate, db import
