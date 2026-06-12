---
phase: 01-access-shell
plan: 03
subsystem: api + admin-ui
tags: [api-route, admin-only, better-auth, next-js, shadcn, sonner, lucide-react, vertical-slice-complete]

requires:
  - phase: 01-01b
    provides: lib/auth.ts (auth.api.getSession, role column), proxy.ts route gate
  - phase: 01-02
    provides: app/dashboard/page.tsx with isAdmin, DashboardSignOut, session read pattern

provides:
  - POST /api/import with 401/403/202 gate contract (ACCESS-03 stub)
  - ImportTriggerCard Client Component (admin-only, loading state, Sonner toast)
  - Dashboard admin gate rendering ImportTriggerCard only when role='admin'
  - All four ACCESS-* requirements (ACCESS-01..04) end-to-end satisfiable

affects:
  - Phase 2 (replace 202 stub body with real import orchestration; gates must be preserved)
  - Phase 2 onwards (admin-gated API route pattern established)

tech-stack:
  added: []
  patterns:
    - Admin API route guard — session-first (401) then role (403) order prevents account-existence leak
    - Client Component island with useState(false) running toggle, fetch, and Sonner toast
    - Server Component conditional render ({isAdmin && ...}) for admin-only UI sections

key-files:
  created:
    - app/api/import/route.ts
    - components/ImportTriggerCard.tsx
  modified:
    - app/dashboard/page.tsx

key-decisions:
  - "POST only — no GET export on /api/import prevents accidental side-effect triggers"
  - "Session check before role check — 401 before 403 prevents leaking whether a probe is authenticated"
  - "ImportTriggerCard has no role check internally — defence-in-depth lives in the API route; UI gate is the Server Component isAdmin guard"
  - "Phase 2 pattern: preserve 401/403 gates in route.ts; only replace the 202 return statement with real orchestration"

requirements:
  - ACCESS-02
  - ACCESS-03

duration: ~20min
completed: 2026-06-12
---

# Phase 1 Plan 03: Admin Import Trigger Summary

**POST /api/import with 401/403/202 gate contract plus admin-only ImportTriggerCard; completes Phase 1 — all four ACCESS-* requirements end-to-end provable**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-12T17:00:00Z
- **Completed:** 2026-06-12T17:20:00Z
- **Tasks:** 2 auto (+ 1 human-verify checkpoint — awaiting approval)
- **Files modified:** 3

## Accomplishments

- `app/api/import/route.ts` — POST-only handler with full ACCESS-03 + ACCESS-02 gate contract:
  - 401 Unauthorized when no session (session checked before role — no account-existence leak)
  - 403 Forbidden when session.user.role !== 'admin'
  - 202 with `{"message":"Import queued"}` when admin (Phase 1 stub)
- `components/ImportTriggerCard.tsx` — Client Component admin-only import trigger:
  - "Sync sessions" heading, "Fetch all sessions and tracks from the streaming platforms." description
  - "Start import" button (Play icon, violet primary) — exact UI-SPEC copy
  - "Importing…" running state (Loader2 animate-spin, button disabled, aria-busy=true)
  - Sonner success toast: "Import queued" on 202; specific error toasts for 401/403/other
- `app/dashboard/page.tsx` — placeholder comment replaced with `{isAdmin && <section><ImportTriggerCard /></section>}` — non-admin dashboards receive no import Card markup server-side

## Human Verify (Awaiting Approval)

Verification steps A/B/C/D from Task 3 checkpoint are pending human approval. Expected outcomes:

- **A (401):** `curl -i -X POST http://localhost:3000/api/import` → `HTTP/1.1 401` + `{"error":"Unauthorized"}`
- **B (403 + no Card for Jack):** Signed in as Jack (member) → no "Sync sessions" Card on dashboard; curl with Jack's cookie → `HTTP/1.1 403` + `{"error":"Forbidden"}`
- **C (202 + UI happy path for Mark):** Signed in as Mark (admin) → "Sync sessions" Card with violet "Start import" button; click → "Importing…" spinner → Sonner toast "Import queued" → button returns to default
- **D (spot checks):** `/` accessible without auth; `/dashboard` without auth → 307 redirect to `/sign-in`

## Task Commits

1. **Task 1: POST /api/import** — `a6fa829` (feat)
2. **Task 2: ImportTriggerCard + dashboard update** — `86bb97c` (feat — includes Biome import-order fix on route.ts)

## Files Created/Modified

- `app/api/import/route.ts` — POST-only API route; session check (401) then role check (403) then 202 stub; no GET export; `await headers()` from `next/headers`
- `components/ImportTriggerCard.tsx` — `"use client"` Card component; `useState(false)` running toggle; `fetch("/api/import", { method: "POST" })`; Sonner toasts per status code; Loader2 + Play icons from lucide-react
- `app/dashboard/page.tsx` — Added `ImportTriggerCard` import; replaced `{/* Plan 01-03 will render... */}` comment with `{isAdmin && <section className="mt-8"><ImportTriggerCard /></section>}` block

## Phase 1 Success Criteria Closed Out

This plan closes the following items from ROADMAP.md Phase 1 Success Criteria:

- **ACCESS-02** — proxy.ts gate + 307 redirect when unauthenticated (proven in Plan 01-02, final spot-check D.10)
- **ACCESS-03** — Admin import trigger: 401/403/202 gate contract + "Sync sessions" Card visible only to admin
- **ACCESS-01** (proven in Plan 01-02, reaffirmed) — four friends can register and log in
- **ACCESS-04** (proven in Plan 01-01/01-02, reaffirmed) — public archive `/` accessible without auth

All four ACCESS-* requirements (ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04) are end-to-end satisfiable after this plan.

## Pattern Established for Phase 2

The 202 stub in `app/api/import/route.ts` establishes the Phase 2 author's task:

> **Preserve the 401/403 gates exactly as written. Replace only the final `return Response.json({ message: "Import queued" }, { status: 202 })` line with real import orchestration.**

The session-first, role-second gate order is intentional (no account-existence leak) — do not invert.

## Note: Post-Setup `disableSignUp` Option

Once Mark, Jack, Jon, and Iwan have all registered, Mark may optionally set `disableSignUp: true` in `lib/auth.ts` to prevent additional registrations. This is noted in SKELETON.md as "Out of Scope" for Phase 1 but is safe to apply at any time after the four members are onboarded. No code change is required now.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome import ordering in app/api/import/route.ts**
- **Found during:** Task 2 verification (`npm run lint`)
- **Issue:** Biome v2 requires `next/headers` (Node built-in group) before `@/lib/auth` (alias/local group) — same pattern encountered in Plan 01-02
- **Fix:** Swapped import order to `next/headers` first, `@/lib/auth` second
- **Files modified:** `app/api/import/route.ts`
- **Verification:** `npm run lint` exits 0; `npm run typecheck` exits 0
- **Committed in:** `86bb97c` (included in Task 2 commit as same-task fix)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Biome import ordering, recurrent pattern)

## Threat Surface Scan

No new threat surface beyond the plan's threat model. All seven STRIDE threats (T-03-01 through T-03-07) addressed as specified:

- T-03-01 (Elevation of Privilege) — mitigated: two-layer enforcement, 403 from API + Server Component hides Card
- T-03-02 (Spoofing) — mitigated: 401 returned if no session; session checked before role
- T-03-03 (Tampering/forged cookie) — mitigated: Better Auth validates session token against DB on every `getSession()` call
- T-03-04 (CSRF) — mitigated: Better Auth SameSite=Lax cookie; same-origin POST only in Phase 1
- T-03-05 (Repudiation) — accepted: Phase 1 stub is no-op; Phase 2 must add request logging
- T-03-06 (DoS — repeated 403) — accepted: 4-user app; 403 returns quickly; no rate limiting in Phase 1
- T-03-07 (Information Disclosure — 401 vs 403) — accepted: conventional HTTP semantics, acceptable for internal 4-user app

## Known Stubs

- `app/api/import/route.ts` — the 202 return is an intentional stub. It returns `{"message":"Import queued"}` with no actual import work. Phase 2 will replace the return statement with real Spotify + Apple Music import orchestration. This stub is required by design (Phase 1 scope boundary) and is not a data-rendering stub.

## Self-Check: PASSED

Files verified present:
- FOUND: app/api/import/route.ts
- FOUND: components/ImportTriggerCard.tsx
- FOUND: app/dashboard/page.tsx (modified)

Commits verified present:
- FOUND: a6fa829 (feat(01-03): POST /api/import)
- FOUND: 86bb97c (feat(01-03): ImportTriggerCard + dashboard gate)
