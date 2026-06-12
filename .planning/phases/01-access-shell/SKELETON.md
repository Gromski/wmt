# Walking Skeleton — Warwick Massive Tunage

**Phase:** 1 — Access & Shell
**Generated:** 2026-06-12

## Capability Proven End-to-End

One of the four friends can click "Sign in with Spotify" in the header, complete the OAuth flow, land on `/dashboard` showing "Signed in as [their Spotify display name]", while any unauthenticated visitor can open `/` and see the public archive shell — proving Next.js routing, Drizzle/libSQL persistence, Better Auth Spotify OAuth (including the real `account` row write), proxy.ts route protection, and the dev environment all work together end-to-end.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack default) | CLAUDE.md §Technology Stack; App Router cleanly splits public `/` from private `/dashboard`; `proxy.ts` (replaces deprecated `middleware.ts`) is the v16 standard for route protection |
| Language / Runtime | TypeScript 5.x on Node.js 20.9+ | Required minimum for Next.js 16; environment confirmed at Node 20.20.1 |
| Data layer | Drizzle ORM 0.45.2 + `@libsql/client` 0.17.3, local file (`file:local.db`) in dev, Turso (libSQL HTTPS) in prod | CLAUDE.md §Recommended Stack; Phase 1 ships against local SQLite to avoid Turso account dependency; same driver used in prod via env-driven `TURSO_CONNECTION_URL` |
| Auth | Better Auth 1.6.17 with Spotify social provider + Drizzle adapter (`provider: "sqlite"`); `additionalFields` adds custom `role: 'admin' \| 'member'` column on `user` table | D-05 forbids the admin plugin (its fixed roles are admin/user not admin/member); Better Auth handles PKCE, HTTP-only cookies, and the 20-minute Spotify token refresh automatically (D-08, D-09) |
| Role assignment | First user to complete OAuth is promoted to `admin` via Better Auth `databaseHooks.user.create.after`; everyone else stays `member` | D-06 — no seed script, no manual SQL; admin gate (D-07) reads from session |
| Route protection | `proxy.ts` (Next.js 16 file convention) at project root with `matcher: ["/dashboard/:path*"]`; cookie-presence check only — full session+role validation re-runs in the dashboard Server Component and import API route | D-04 (public routes never redirect); RESEARCH Pitfall 5 (matcher must not catch static assets); Anti-pattern lines 419-421 (never rely solely on proxy.ts for role) |
| Styling | Tailwind CSS v4.3.0 (CSS-first config) + shadcn/ui (new-york style, zinc base, dark mode default) | UI-SPEC; shadcn requires Tailwind v4; `next-themes` provider with `defaultTheme="dark"` and `enableSystem={false}` |
| Deployment target | Local dev only in Phase 1 (`npm run dev` on `http://127.0.0.1:3000`); Vercel + Turso wired in a later phase | Spotify blocks `localhost` redirects since 27 Nov 2025 — dev URL MUST be `127.0.0.1` (RESEARCH Pitfall 1); shipping to Vercel is not required to prove the end-to-end capability |
| Directory layout | `src/app/`, `src/lib/{auth.ts,auth-client.ts,db/}`, `src/components/{header.tsx,ui/}`, `proxy.ts` at project root, `drizzle/` for generated migrations, `drizzle.config.ts` at root | RESEARCH Recommended Project Structure (lines 213-235); `proxy.ts` MUST be at project root (or src/) — Next.js 16 file convention |

## Stack Touched in Phase 1

- [x] Project scaffold — `npx create-next-app@latest` with TypeScript, Tailwind v4, App Router, `src/` directory; Biome optional (CLAUDE.md mentions it; not required for skeleton to run)
- [x] Routing — `/` (public archive shell), `/dashboard` (private), `/api/auth/[...all]` (Better Auth catch-all), `/api/import` (admin-only stub)
- [x] Database — real read AND write: Better Auth writes `user`, `session`, `account` rows on OAuth callback; first-user hook reads `count(*)` from `user` and writes `role='admin'` back
- [x] UI — interactive `Sign in with Spotify` button in header invokes `authClient.signIn.social({ provider: "spotify", callbackURL: "/dashboard" })`; sign-out invokes `authClient.signOut`; `Start import` button POSTs to `/api/import`
- [x] Deployment — `npm run dev` exercises the full stack against local SQLite + Spotify Developer app; documented in PLAN 01

## Out of Scope (Deferred to Later Slices)

- Date editing UI for sessions (Phase 2, D-11)
- Apple Music / MusicKit JS integration (Phase 2, IMPORT-07)
- Real Spotify playlist import logic — `/api/import` returns a 202 stub in Phase 1 (D-10, ACCESS-03 is satisfied by trigger + admin gate, not by actual import work)
- Nav skeleton with Sessions / Analytics sections (Phase 3)
- Turso production database + Vercel deployment (a later phase — env-driven so no rewrite needed)
- `"use cache"` directive usage on `/` (Phase 3 — but `cacheComponents: true` IS enabled in `next.config.ts` in Phase 1 so future use needs no rework, per RESEARCH Pitfall 4)
- Last.fm / MusicBrainz enrichment (Phase 2, IMPORT-06)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Import Pipeline:** Real `/api/import` implementation (Spotify playlist fetch, attribution parsing, date entry UI), Last.fm enrichment, manual-review flag for unparseable sessions. Reuses Phase 1 auth, DB connection, admin gate.
- **Phase 3 — Archive Browsing:** Session list / detail / timeline / search at `/` and `/sessions/[id]`. Adds `"use cache"` to public pages (flag already enabled).
- **Phase 4 — Analytics:** Taste profiles, overlap matrix, wildcard detection, Wrapped cards. Pure read-side over the data created in Phase 2.
