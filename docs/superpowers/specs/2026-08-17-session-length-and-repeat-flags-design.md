# Session length + repeated-track flags — design

**Date:** 2026-08-17
**Status:** Approved (design)

Two additive, presentation-only features over existing data (no schema/data change;
computed at build, republished by a rebuild).

## Feature 1 — Session total length

- `formatDuration(ms: number): string` (pure) → `"1h 12m"`, `"47m"`, `"0m"`.
- Session total = sum of the session's tracks' `duration_ms` (nulls skipped).
- **Detail page:** shown in the session header alongside theme/date.
- **Archive:** a `totalDurationMs` (+ `hasUnknownLength`) added to the archive payload
  in `app/sessions/page.tsx`, rendered on `SessionCard` and the table/timeline views.
- **Edge case:** 7 YouTube fallback tracks have `duration_ms = null`. A session that
  contains one shows `1h 12m+` (the `+` = "at least"; tooltip: "excludes N track(s) of
  unknown length"). Never imply false precision.

## Feature 2 — Repeated tracks

- Repeat key = `lower(trim(title)) :: lower(trim(artist))`.
- A **repeat** = a key present in **≥2 distinct sessions**.
- `buildRepeatIndex(rows: { key, sessionNumber }[]): Map<key, number[]>` (pure) — returns,
  per repeated key, the sorted distinct session numbers it appears in. Keys in <2 sessions
  are omitted.
- **Session detail:** a small **"Repeat"** badge on any track whose key recurs, reading
  "also in S5, S18" with links to those sessions (excluding the current one).
- **Wrapped card (per person):** a **"Repeated picks"** note listing the songs *that person
  chose* whose key recurs, each with the other session number(s). Omitted if none.
  - Attribution: a person's pick counts if that person is the `attributed_contributor` of a
    track whose key is a repeat; "other sessions" = the repeat's sessions minus the one(s)
    this person picked it in.

Current data: 4 repeats — Life on Mars (Dexter Wansel) ×3; All Along the Watchtower, Hunger
of the Pine, Chameleon ×2.

## Architecture

- New pure modules: `lib/duration.ts`, `lib/repeats.ts` (+ colocated `*.test.ts` run via
  `npx tsx`, matching the repo convention).
- Touched UI: `app/sessions/page.tsx` + `SessionCard`/archive views; the session detail page;
  `lib/wrapped.ts` (+ `WrappedStats.repeatedPicks`) and `components/analytics/WrappedCard.tsx`.
- No schema/data change; contributor colours unchanged; static-publish model unchanged.

## Verification

- Unit tests: `formatDuration` (h/m rounding, 0, sub-minute) and `buildRepeatIndex`
  (≥2-session detection, single-session omission, per-person attribution).
- typecheck + lint + production build; spot-check `/sessions/5` shows the Life on Mars repeat
  badge and the picker's Wrapped card lists it.
