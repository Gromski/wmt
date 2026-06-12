# Phase 1: Access & Shell - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the authenticated shell: a Next.js App Router structure with a public read-only archive at `/` (empty state in Phase 1) and a private dashboard at `/dashboard` for the four friends. Spotify OAuth via Better Auth handles login. The dashboard shows a connected confirmation and an import trigger button (implementation stubbed — Phase 2 wires it up). Public routes are fully open with no auth checks; write operations are gated to authenticated users only.

</domain>

<decisions>
## Implementation Decisions

### Route Structure
- **D-01:** Public archive at `/`, private dashboard at `/dashboard`. No route groups in the URL.
- **D-02:** The public `/` renders the full archive shell with empty state (e.g., "No sessions yet") — not a landing page. Ready for Phase 2 data to fill in without rework.
- **D-03:** Login entry point is a persistent header/nav `Sign in with Spotify` button present on all pages. No separate `/login` route. After OAuth callback, redirect to `/dashboard`.
- **D-04:** Public routes (`/` and any sub-routes under the public archive) are always accessible without authentication — no redirect to login or `/dashboard` for unauthenticated visitors.

### Admin Role Detection
- **D-05:** Admin role stored as a `role` column on Better Auth's managed `users` table, extended via the Drizzle adapter. Values: `'admin'` | `'member'`. Default: `'member'`.
- **D-06:** First user to complete Spotify OAuth login is automatically assigned `role = 'admin'`. All subsequent logins receive `role = 'member'`. No seed script, no manual DB edit.
- **D-07:** Import trigger on `/dashboard` is gated to `role === 'admin'` only.

### Spotify OAuth Scope Timing
- **D-08:** Request full Spotify scopes at login time: `user-read-private`, `user-read-email`, `playlist-read-private`, `playlist-read-collaborative`. One Spotify authorization prompt ever — avoids a re-auth round-trip in Phase 2.
- **D-09:** Import API route reads the Better Auth session to get the Spotify access token. Better Auth handles token refresh automatically (20-min expiry). No separate token persistence needed.

### Phase 1 Dashboard Shell
- **D-10:** `/dashboard` in Phase 1 is minimal: connected confirmation (`Signed in as [name]`), import trigger button (stubbed — no import logic yet), and sign-out link. No nav skeleton, no empty-state sections for Sessions/Analytics.
- **D-11:** Date editing UI is Phase 2 scope — not stubbed in Phase 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and requirement IDs (ACCESS-01 through ACCESS-04)
- `.planning/REQUIREMENTS.md` — Full requirement definitions for ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04

### Stack Decisions (in CLAUDE.md)
- `CLAUDE.md` §Technology Stack — full stack decisions: Next.js 16, Better Auth (Spotify provider), Drizzle ORM, Turso (libSQL), Tailwind CSS v4, shadcn/ui
- `CLAUDE.md` §Spotify Integration Details — February 2026 API changes, PKCE flow, Dev Mode 5-user cap
- `CLAUDE.md` §What NOT to Use — Supabase ruled out, Auth.js v5 ruled out, `localhost` redirect URI blocked (use `127.0.0.1`)
- `CLAUDE.md` §Database Schema Overview — Better Auth managed tables (`user`, `session`, `account`), app tables (`sessions`, `tracks`, `session_tracks`, `contributors`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a greenfield project. No existing components or hooks.

### Established Patterns
- None yet — Phase 1 establishes the patterns that subsequent phases follow.

### Integration Points
- Better Auth Drizzle adapter: extend the `user` table schema with `role: text('role').notNull().default('member')` before running `betterauth/cli generate`
- Next.js App Router `proxy.ts` (replaces deprecated `middleware.ts` in Next.js 16): protect `/dashboard` and its children; public routes need no protection
- Spotify OAuth redirect URI: must use `127.0.0.1` in dev (not `localhost`) — Spotify blocked `localhost` on 27 Nov 2025

</code_context>

<specifics>
## Specific Ideas

- The first-user-is-admin rule is acceptable because Mark will always be the first to set up and log in. If the wrong user logs in first in practice, a manual DB update can fix it — the team is 4 people who coordinate.
- The public archive should look like a real page (not a placeholder), but "No sessions yet" empty state is fine for Phase 1.

</specifics>

<deferred>
## Deferred Ideas

- Date editing UI — Phase 2 (ships alongside actual import pipeline)
- Apple Music / MusicKit JS integration — Phase 2 (IMPORT-07)
- Navigation skeleton with Sessions/Analytics sections — Phase 3 (when content exists to fill them)

</deferred>

---

*Phase: 1-Access & Shell*
*Context gathered: 2026-06-12*
