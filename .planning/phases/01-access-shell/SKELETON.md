# Walking Skeleton — Warwick Massive Tunage

**Phase:** 1 — Access & Shell
**Generated:** 2026-06-12 (updated to reflect CONTEXT.md D-AUTH — email/password replaces Spotify OAuth)

## Capability Proven End-to-End

The first user (Mark) can register on `/sign-in` with email + password, land on `/dashboard` showing "Signed in as Mark" with an **Admin** badge, click "Start import" to fire a POST `/api/import` that returns 202, while any unauthenticated visitor can open `/` and see the public archive empty state — proving Next.js 16 routing, Drizzle/libSQL persistence with the `role` column on `user`, Better Auth email/password (with first-user-auto-admin hook), `proxy.ts` route protection, and the dev environment all work together end-to-end.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack default) | CLAUDE.md §Technology Stack; App Router cleanly splits public `/` from private `/dashboard`; `proxy.ts` (replaces deprecated `middleware.ts`) is the v16 standard for route protection |
| Language / Runtime | TypeScript 5.x on Node.js 20.9+ | Required minimum for Next.js 16; confirmed Node 20.20.1 present |
| Package manager | pnpm 11.6.0 (installed globally via `npm install -g pnpm@latest`) | CLAUDE.md convention; pnpm absent on this machine — installed as first prerequisite |
| Data layer | Drizzle ORM 0.45.2 + `@libsql/client` 0.17.3, local file (`file:local.db`) in dev; Turso (libSQL HTTPS) in prod later | CLAUDE.md §Recommended Stack; Phase 1 ships against local SQLite to avoid Turso account dependency; same driver swaps via env-driven `DATABASE_URL` |
| Auth | Better Auth 1.6.17 with `emailAndPassword: { enabled: true }` + Drizzle adapter (`provider: "sqlite"`); `additionalFields.role` adds `role: 'admin' \| 'member'` to the `user` table | CONTEXT.md D-AUTH (Spotify Premium unavailable → OAuth ruled out); D-05 (additionalFields, not the Better Auth admin plugin which uses 'user'/'admin' enum); Better Auth handles bcrypt, sessions, and CSRF |
| Role assignment | First user to register is promoted to `admin` via Better Auth `databaseHooks.user.create.before` (returns `{ data: { ...user, role: 'admin' } }`); everyone else inherits the default `'member'` | CONTEXT.md D-06; RESEARCH.md Pitfall 1 mandates `before` (atomic) over `after` (race window) |
| Route protection | `proxy.ts` (Next.js 16 file convention) at project root with `matcher: ["/dashboard", "/dashboard/:path*"]`; full session+role validation re-runs in the dashboard Server Component and the import API route | CONTEXT.md D-04 (public routes never redirect — matcher excludes `/` and `/sign-in`); RESEARCH.md Pitfall 3 (use `await headers()` from `next/headers`, NOT `request.headers`) |
| Sign-in surface | Dedicated `/sign-in` page with email + password form; persistent header "Sign in" link on all public pages; redirect to `/dashboard` on success | CONTEXT.md D-03; no public self-registration UI gate — admin creates accounts for the other 3 friends post-Phase-1 |
| Styling | Tailwind CSS v4.3.0 (CSS-first config) + shadcn/ui (new-york style, zinc base, dark mode default) | UI-SPEC; shadcn requires Tailwind v4; dark mode is the default UI |
| Font | Inter via `next/font/google` | UI-SPEC §Typography |
| Lint / format | Biome 2.5.0 (`@biomejs/biome`) | CLAUDE.md §Development Tools — replaces ESLint + Prettier; `next lint` was removed in Next.js 16 |
| Deployment target | Local dev only in Phase 1 (`pnpm dev` on `http://localhost:3000`); Turso + Vercel wired in a later phase | Phase 1 capability does not require a hosted env; env-driven `DATABASE_URL` lets prod swap with no code change |
| Directory layout | App Router at `app/`, server libs at `lib/{auth.ts,auth-client.ts,db.ts}`, schema at `db/schema.ts`, components at `components/{GlobalHeader.tsx,ui/}`, `proxy.ts` at project root, `drizzle/` for generated migrations, `drizzle.config.ts` at root | RESEARCH.md §Recommended Project Structure; `proxy.ts` MUST be at project root for Next.js 16 to detect it |

## Stack Touched in Phase 1

- [x] Project scaffold — `pnpm create next-app@latest` with TypeScript, Tailwind v4, App Router, no src dir, `@/*` import alias
- [x] Routing — `/` (public archive shell), `/sign-in` (email + password form), `/dashboard` (private), `/api/auth/[...all]` (Better Auth catch-all), `/api/import` (admin-only 202 stub)
- [x] Database — real read AND write: Better Auth writes `user`, `session`, `account` rows on register/sign-in; first-user `before` hook reads `count(*)` from `user` and rewrites the incoming record with `role='admin'`
- [x] UI — interactive `Sign in` link in header, email+password form, sign-out button, admin-only `Start import` button (admin badge visible when `role === 'admin'`); Sonner toast for sign-in errors
- [x] Deployment — `pnpm dev` exercises the full stack against local SQLite; no hosted deployment in Phase 1

## Out of Scope (Deferred to Later Slices)

- Date editing UI for sessions (Phase 2, CONTEXT.md D-11)
- Apple Music / MusicKit JS integration (Phase 2, IMPORT-07)
- Real import logic — `/api/import` returns 202 stub in Phase 1 (ACCESS-03 satisfied by trigger + admin gate, not by actual fetch work)
- Spotify API access for the importer (Phase 2, CONTEXT.md D-12 deferred)
- Nav skeleton with Sessions / Analytics sections (Phase 3)
- Turso production database + Vercel deployment (env-driven; no rewrite needed when wired)
- Last.fm / MusicBrainz enrichment (Phase 2, IMPORT-06)
- `disableSignUp: true` (deferred — leave open until all 4 friends register, then optionally lock)

## Subsequent Slice Plan

Each later phase adds a vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Import Pipeline:** Real `/api/import` implementation; Spotify OAuth as a second auth provider (gated to whichever friend holds Premium); attribution parsing; date entry UI; Last.fm enrichment.
- **Phase 3 — Archive Browsing:** Session list / detail / timeline / search at `/` and `/sessions/[id]`. Adds `"use cache"` and `cacheLife('days')` to public Server Components.
- **Phase 4 — Analytics:** Taste profiles, overlap matrix, wildcard detection, Wrapped cards over the Phase 2 data.
