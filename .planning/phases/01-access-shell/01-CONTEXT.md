# Phase 1: Access & Shell - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the authenticated shell: a Next.js App Router structure with a public read-only archive at `/` (empty state in Phase 1) and a private dashboard at `/dashboard` for the four friends. Email/password auth via Better Auth handles login. The dashboard shows a connected confirmation and an import trigger button (implementation stubbed — Phase 2 wires it up). Public routes are fully open with no auth checks; write operations are gated to authenticated users only.

**Auth change (2026-06-12):** Spotify OAuth was originally planned but the app owner does not have Spotify Premium, which is required by Spotify's February 2026 Dev Mode rules. Email/password auth replaces it. Spotify API access for the import pipeline (Phase 2) will be revisited separately.

</domain>

<decisions>
## Implementation Decisions

### Route Structure
- **D-01:** Public archive at `/`, private dashboard at `/dashboard`. No route groups in the URL.
- **D-02:** The public `/` renders the full archive shell with empty state (e.g., "No sessions yet") — not a landing page. Ready for Phase 2 data to fill in without rework.
- **D-03:** Sign-in entry point is a dedicated `/sign-in` page with email + password form. A persistent header "Sign in" link is present on all public pages. After sign-in, redirect to `/dashboard`. No OAuth callbacks or redirects.
- **D-04:** Public routes (`/` and any sub-routes under the public archive) are always accessible without authentication — no redirect to `/sign-in` or `/dashboard` for unauthenticated visitors.

### Auth Method
- **D-AUTH:** Better Auth email/password plugin (not a social OAuth provider). Users register with email + password. The admin creates accounts for the other 3 friends — no public self-registration UI needed.

### Admin Role Detection
- **D-05:** Admin role stored as a `role` column on Better Auth's managed `users` table, extended via the Drizzle adapter. Values: `'admin'` | `'member'`. Default: `'member'`.
- **D-06:** First user to register is automatically assigned `role = 'admin'` via a `databaseHooks.user.create.after` hook. All subsequent sign-ups receive `role = 'member'`. Mark will always register first during setup.
- **D-07:** Import trigger on `/dashboard` is gated to `role === 'admin'` only.

### Phase 1 Dashboard Shell
- **D-10:** `/dashboard` in Phase 1 is minimal: connected confirmation (`Signed in as [name]`), import trigger button (stubbed — no import logic yet), and sign-out link. No nav skeleton, no empty-state sections for Sessions/Analytics.
- **D-11:** Date editing UI is Phase 2 scope — not stubbed in Phase 1.

### Deferred: Platform API Auth
- **D-12 [DEFERRED]:** Spotify API access for import (requires Spotify user who has Premium to authorize) — Phase 2 decision.
- **D-13 [DEFERRED]:** Apple Music API access via MusicKit JS (requires Apple Developer Program, ~$99/yr) — Phase 2 decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and requirement IDs (ACCESS-01 through ACCESS-04)
- `.planning/REQUIREMENTS.md` — Full requirement definitions for ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04

### Stack Decisions (in CLAUDE.md)
- `CLAUDE.md` §Technology Stack — full stack decisions: Next.js 16, Better Auth (now using email/password plugin, NOT Spotify provider), Drizzle ORM, Turso (libSQL), Tailwind CSS v4, shadcn/ui
- `CLAUDE.md` §What NOT to Use — Auth.js v5 ruled out; Spotify OAuth for auth ruled out (no Premium)
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
- Better Auth email/password plugin: `emailAndPassword: { enabled: true }` in the Better Auth config; sign-in/sign-up forms use `authClient.signIn.email()` / `authClient.signUp.email()` from Better Auth's React client

</code_context>

<specifics>
## Specific Ideas

- The first-user-is-admin rule is acceptable because Mark will always be the first to register during setup. If the wrong user registers first in practice, a manual DB update can fix it — the team is 4 people who coordinate.
- The other 3 friends (Jack, Jon, Iwan) sign up after Mark creates the app — self-registration is fine since the app will only be shared with them.
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
