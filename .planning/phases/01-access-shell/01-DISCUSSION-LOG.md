# Phase 1: Access & Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 1-Access & Shell
**Areas discussed:** Route structure, Admin role detection, Spotify OAuth scope timing, Phase 1 shell shape

---

## Route Structure

| Option | Description | Selected |
|--------|-------------|----------|
| / public, /dashboard private | Root is the public archive. /dashboard is the private space. Clean separation, no route groups needed in the URL. | ✓ |
| Route groups only, same base URL | Use Next.js (public) and (private) route groups. No visible URL difference. | |
| /app for private, /public for public | Explicit path prefixes for both sides. More verbose URLs. | |

**User's choice:** / public, /dashboard private

---

| Option | Description | Selected |
|--------|-------------|----------|
| Landing/welcome page with a login link | Simple intro page with 'Sign in with Spotify' link. Archive pages stubbed. | |
| Redirect to /dashboard if logged in, show login if not | / is purely a routing gate. | |
| Full public archive shell with empty state | / is the real public archive showing 'No sessions yet' empty state. Ready for Phase 2 data. | ✓ |

**User's choice:** Full public archive shell with empty state

---

| Option | Description | Selected |
|--------|-------------|----------|
| /login page, redirect to /dashboard after auth | Dedicated /login route. Standard pattern. | |
| Login button directly on /, redirect to /dashboard | No separate /login page — sign-in button in the public page. Fewer routes. | ✓ |
| You decide | Claude chooses most idiomatic approach. | |

**User's choice:** Login button directly on /, redirect to /dashboard

---

| Option | Description | Selected |
|--------|-------------|----------|
| No — / and all public routes always accessible without auth | Public routes are fully open. Auth state only checked on /dashboard. | ✓ |
| Yes — if logged-in user visits /, redirect to /dashboard | Logged-in users always land in the dashboard. | |

**User's choice:** No — / and all public routes always accessible without auth

---

## Admin Role Detection

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded Spotify ID in env var | ADMIN_SPOTIFY_ID in .env. Simple, no DB schema change needed. | |
| DB role flag on the user row | users table has a role column (admin/member). More flexible. | ✓ |
| All four friends can trigger import | No admin distinction. Social convention enforces the rule. | |

**User's choice:** DB role flag on the user row

---

| Option | Description | Selected |
|--------|-------------|----------|
| Seed DB with Mark's Spotify ID pre-assigned as admin | Seed script sets role=admin for Mark before first login. | |
| First user to log in gets admin role automatically | First OAuth callback sets role=admin. | ✓ |
| Manual DB edit after first run | Everyone starts as member; manual SQL update needed. | |

**User's choice:** First user to log in gets admin role automatically

**Notes:** User asked about Supabase Auth as an alternative here. Redirected to CLAUDE.md stack decision — Supabase is explicitly ruled out in favour of Better Auth + Turso.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Better Auth's users table with a role column | Add role field to Drizzle schema for Better Auth users table. One table, one query. | ✓ |
| Separate contributors table linked by Spotify user ID | roles live in a separate contributors table; Better Auth schema untouched. | |

**User's choice:** Extend Better Auth's users table with a role column

---

## Spotify OAuth Scope Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Request full scopes at login now | Include playlist-read-private + playlist-read-collaborative at Phase 1 login. One auth prompt ever. | ✓ |
| Identity scopes only at login, re-auth in Phase 2 | Minimal scopes at Phase 1 login; second Spotify OAuth in Phase 2 for playlist scopes. | |

**User's choice:** Request full scopes at login now

---

| Option | Description | Selected |
|--------|-------------|----------|
| Use Better Auth's session token directly in the import API route | Import route reads Better Auth session for Spotify token. Better Auth handles refresh. | ✓ |
| Store the Spotify token in the DB alongside the session | Explicit token persistence — would duplicate Better Auth's account table. | |
| You decide | Claude uses most idiomatic approach. | |

**User's choice:** Use Better Auth's session token directly in the import API route

---

## Phase 1 Shell Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: connected confirmation + import button only | 'Connected as [name]', 'Run import' button (stubbed), sign-out link. | ✓ |
| Navigation skeleton with empty states | Full nav: Sessions, Analytics, Settings with empty states. | |
| You decide | Claude builds minimal to satisfy Phase 1 success criteria. | |

**User's choice:** Minimal — connected confirmation + import button only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Import trigger only — date editing is Phase 2 scope | Phase 1 just needs the import button. Date entry ships in Phase 2. | ✓ |
| Both import trigger and date edit stubs | Stub a Sessions section with placeholder rows. | |

**User's choice:** Import trigger only — date editing is Phase 2 scope

---

| Option | Description | Selected |
|--------|-------------|----------|
| Login button in the site header/nav on all pages | Persistent header shows 'Sign in' when logged out, name + 'Dashboard' when logged in. | ✓ |
| Login button only on a dedicated path or section | Login entry point is a separate component or page — not persistently in the header. | |

**User's choice:** Login button in the site header/nav on all pages

---

## Claude's Discretion

None — all areas had explicit user choices.

## Deferred Ideas

- Date editing UI — deferred to Phase 2 (ships alongside actual import pipeline)
- Apple Music / MusicKit JS integration — deferred to Phase 2 (IMPORT-07)
- Navigation skeleton with Sessions/Analytics sections — deferred to Phase 3
