---
phase: 02-import-pipeline
plan: "01"
subsystem: foundation
tags:
  - phase-2
  - apple-music
  - schema
  - jwt
  - foundation
dependency_graph:
  requires:
    - 01-access-shell/01-03 (auth gate pattern, db/schema.ts Better Auth tables)
  provides:
    - db/schema.ts (sessions, contributors, tracks, sessionTracks, artistTags exports)
    - lib/apple-dev-token.ts (generateAppleDeveloperToken)
    - app/api/apple-token/route.ts (GET endpoint)
    - types/musickit.d.ts (Window.MusicKit typed global)
    - components/ui/{table,alert,select,progress,tooltip}.tsx (shadcn primitives)
  affects:
    - 02-02 (import handler depends on all of the above)
    - 02-03 (UI components depend on shadcn primitives)
tech_stack:
  added: []
  patterns:
    - ES256 JWT signing via jose SignJWT with APPLE_PRIVATE_KEY PEM from env
    - \n-escape → real newline conversion for PEM stored in .env.local single line
    - Integer PK (autoIncrement) for app tables; text PK reserved for Better Auth tables
    - Function-call-time env var validation (not module load) for clean 500 errors
key_files:
  created:
    - db/schema.ts (extended — Phase 2 tables appended)
    - lib/apple-dev-token.ts
    - app/api/apple-token/route.ts
    - types/musickit.d.ts
    - components/ui/table.tsx
    - components/ui/alert.tsx
    - components/ui/select.tsx
    - components/ui/progress.tsx
    - components/ui/tooltip.tsx
  modified:
    - db/schema.ts (54 lines added; 4 Better Auth tables untouched)
decisions:
  - "Env var validation at function-call time in generateAppleDeveloperToken() so missing credentials produce a clean 500 without crashing the dev server on module load"
  - "biome unsafe fix applied for node: import protocol on crypto import — required by biome v2 lint rules"
  - "shadcn components required one round of format + safe fixes (import type) and one unsafe fix (node: protocol) to reach lint-zero — documented as deviation Rule 1"
metrics:
  duration: "~25 minutes"
  completed: "2026-07-13"
  tasks: 3
  files: 9
---

# Phase 02 Plan 01: Foundation — Schema, Apple Token, MusicKit Types Summary

Apple Music import foundation laid: five Drizzle tables pushed to local.db, ES256 developer token signing via jose, admin-gated GET /api/apple-token, MusicKit JS global type declaration, and five shadcn UI primitives.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Wave 0 — Apple Developer credentials verified | (pre-verified by orchestrator) | .env.local (untouched) |
| 1 | Install shadcn primitives (Table, Alert, Select, Progress, Tooltip) | 3e0be25 | 5 new components/ui/*.tsx |
| 2 | Extend Drizzle schema + BLOCKING schema push | 48e75f0 | db/schema.ts (+54 lines) |
| 3 | Apple dev token utility + GET route + MusicKit types | 1cd0149 | lib/apple-dev-token.ts, app/api/apple-token/route.ts, types/musickit.d.ts |

## Schema Delta (Phase 1 → Phase 2)

**Before:** 4 Better Auth tables (user, session, account, verification)

**After:** 9 tables total. Five new:

| Table | Key Columns | Notes |
|-------|-------------|-------|
| `sessions` | id (int PK), session_number (UNIQUE NOT NULL), theme, date (nullable timestamp_ms), attribution_parsed (bool, default true), apple_music_playlist_id | Manual date entry per D-10; false flag for IMPORT-08 review queue |
| `contributors` | id (int PK), initials (UNIQUE NOT NULL), name, user_id (FK→user.id, nullable) | MW/JG/JS/IT per D-12 |
| `tracks` | id (int PK), apple_id, spotify_id, isrc, title, artist_name, album_name, release_year, duration_ms | spotify_id null until Phase 3 |
| `session_tracks` | id (int PK), session_id (FK→sessions.id CASCADE), track_id (FK→tracks.id CASCADE), position, attributed_contributor_id (FK→contributors.id, nullable) | position 1–16; nullable contributor for IMPORT-08 |
| `artist_tags` | id (int PK), artist_name, tag, rank | top 5 per artist; rank 1 = top |

`npm run db:push` confirmed — all five tables present in local.db.

## API Behaviour (verified by code review)

| Endpoint | Unauthenticated | Member | Admin |
|----------|-----------------|--------|-------|
| GET /api/apple-token | 401 Unauthorized | 403 Forbidden | 200 + `{token: "<jwt>"}` |

JWT structure: header `{alg:"ES256",kid:APPLE_KEY_ID}`, payload `{iss:APPLE_TEAM_ID,iat,exp:+1h}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] shadcn-generated components had lint errors**
- **Found during:** Task 1 post-install verification
- **Issue:** shadcn@4.13.0 generated components used `import * as React` without `import type`, and some files had formatting mismatches vs biome v2 config (missing semicolons)
- **Fix:** Ran `npm run format` then `npx @biomejs/biome check --write .` to apply safe fixes (import type conversion, semicolons)
- **Files modified:** components/ui/alert.tsx, components/ui/progress.tsx, components/ui/select.tsx, components/ui/table.tsx, components/ui/tooltip.tsx
- **Commit:** included in 3e0be25

**2. [Rule 1 - Bug] lib/apple-dev-token.ts required node: import protocol**
- **Found during:** Task 3 lint verification
- **Issue:** biome v2 enforces `node:crypto` instead of bare `"crypto"` import — flagged as `lint/style/useNodejsImportProtocol`
- **Fix:** Applied `npx @biomejs/biome check --write --unsafe` for the node: protocol fix (marked unsafe by biome but is a safe and correct change)
- **Files modified:** lib/apple-dev-token.ts
- **Commit:** included in 1cd0149

**3. [Rule 1 - Bug] app/api/apple-token/route.ts had tab indentation mismatch**
- **Found during:** Task 3 lint verification
- **Issue:** File written with tab indentation; biome config uses spaces (formatter would have printed different content)
- **Fix:** `npx @biomejs/biome check --write` reformatted to 2-space indentation
- **Files modified:** app/api/apple-token/route.ts
- **Commit:** included in 1cd0149

## Known Stubs

None — all files created in this plan are complete implementations with no placeholder values or TODO comments. The `generateAppleDeveloperToken` function reads real env vars and calls real jose APIs.

## Threat Surface Scan

No new threat surface beyond what is documented in the plan's threat model. All mitigations applied:

- T-02-01-00: `.env.local` gitignored (verified Task 0)
- T-02-01-01: lib/apple-dev-token.ts is server-only (uses node:crypto + jose)
- T-02-01-02: /api/apple-token enforces 401→403 gate (same pattern as Phase 1 /api/import)
- T-02-01-04: Schema push confirmed via sqlite3 verification

## Self-Check: PASSED

**Files exist:**
- FOUND: db/schema.ts
- FOUND: lib/apple-dev-token.ts
- FOUND: app/api/apple-token/route.ts
- FOUND: types/musickit.d.ts
- FOUND: components/ui/table.tsx
- FOUND: components/ui/alert.tsx
- FOUND: components/ui/select.tsx
- FOUND: components/ui/progress.tsx
- FOUND: components/ui/tooltip.tsx

**Commits exist:**
- 3e0be25 — Task 1: shadcn primitives
- 48e75f0 — Task 2: Drizzle schema + db:push
- 1cd0149 — Task 3: apple-dev-token + route + MusicKit types

**Database tables:** account, artist_tags, contributors, session, session_tracks, sessions, tracks, user, verification — all 9 confirmed.

**Lint and typecheck:** Both pass (0 errors, 0 warnings).
