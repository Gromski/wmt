<!-- GSD:project-start source:PROJECT.md -->
## Project

**Warwick Massive Tunage**

A web app for four friends (Mark Wright, Jack Groves, Jon Slade, Iwan Thomas) who gather every few months over Teams to listen to music together around a shared theme. Each person contributes 4 songs per session; across 31 sessions they've built a rich archive of curated playlists on both Apple Music and Spotify. This app brings that archive to life outside the streaming platforms — making sessions browsable and surfacing patterns about each person's musical taste and the group's collective dynamics.

**Core Value:** Interrogate 31 sessions of curated music to surface who each person really is as a music-chooser — and how the group compares.

### Constraints

- **Data**: Contributor attribution relies on parsing the initials in playlist descriptions — playlists without a valid initials string can't be auto-attributed
- **Dates**: Session dates aren't in the streaming platform data and require manual input
- **Auth**: Apple Music API (MusicKit) and Spotify API are both needed; Apple's API is more restricted than Spotify's
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.x (latest: 16.2.9) | Full-stack framework | App Router + React Server Components handle the public/private view split cleanly; API routes handle Spotify PKCE token exchange and MusicKit developer token signing server-side. Turbopack is now the default bundler. Node.js 20.9+ required. |
| React | 19.2 | UI | Ships with Next.js 16. View Transitions useful for session-to-session navigation. |
| TypeScript | 5.x | Type safety | Required minimum for Next.js 16. Spotify's official SDK ships with full types; Drizzle schema produces inferred types end-to-end. |
| Better Auth | latest (1.x) | Authentication | Auth.js v5 moved to security-patch-only mode in Sep 2025; the Better Auth team now maintains it and directs new projects to Better Auth. Better Auth has a first-class Spotify social provider, plugin architecture, full data ownership, and a Drizzle adapter. |
| Drizzle ORM | latest (0.x) | Database ORM | SQL-close, type-safe, tiny bundle (~7KB), excellent SQLite + libSQL support. Pairs with Better Auth's Drizzle adapter. Generates TypeScript types from schema with zero runtime overhead. |
| Turso (libSQL) | free tier | Database host | SQLite-over-HTTP. Free tier: 500M row reads/month, 10M writes/month, 5GB storage — far exceeds needs of a 4-person app. Deploys alongside Vercel with zero ops. Local dev uses a plain SQLite file; production connects to Turso via `@libsql/client`. |
| Tailwind CSS | 4.x | Styling | CSS-first config (no tailwind.config.js needed). Up to 100x faster incremental builds. Works with Next.js via a single `postcss.config.mjs`. shadcn/ui requires Tailwind v4 for latest CLI. |
| shadcn/ui | latest (CLI-based) | UI components | Copy-paste component library built on Radix UI + Tailwind. Built-in chart components (bar, line, area, radar) wrap Recharts — sufficient for the analytics views. Tailwind v4 compatible with `shadcn@latest`. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@spotify/web-api-ts-sdk` | 1.2.0 | Spotify API client | Official Spotify TypeScript SDK. Handles PKCE auth flow, paginated playlist fetch (`GET /playlists/{id}/items`), and track data. Note: published 2 years ago, but Spotify's API is stable for owned-playlist read operations. |
| `better-auth` (Spotify plugin) | bundled | Spotify OAuth | Built into Better Auth social providers. Handles PKCE redirect, token storage, and refresh (Spotify tokens expire in 20 minutes). |
| `@libsql/client` | latest | Turso database driver | Required by Drizzle for libSQL/Turso connections. In local dev, set `DATABASE_URL=file:local.db`; in production, use Turso's HTTPS URL + auth token. |
| `drizzle-kit` | latest | Schema migrations | CLI tool for generating and applying Drizzle migrations. Run `drizzle-kit generate` then `drizzle-kit push` (or `migrate` in production). |
| `jose` | 5.x | Apple JWT signing | Industry-standard JWT library. Use to sign the MusicKit developer token (ES256 algorithm) on the server in a Next.js API route. This token is short-lived (max 6 months) and must never be exposed client-side. |
| Zod | 4.x | Input validation | Validate parsed playlist descriptions (initials string extraction), session metadata forms, and API route inputs. v4 is 14x faster than v3 with a smaller bundle. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm | Package manager | Faster installs, disk-efficient. `pnpm create next-app@latest` now defaults to App Router + TypeScript + Tailwind. |
| Turbopack | Bundler | Default in Next.js 16. 2-5x faster builds, up to 10x faster Fast Refresh. No config needed. |
| drizzle-kit | DB migrations | `pnpm drizzle-kit generate` → `pnpm drizzle-kit push` for dev. Use `migrate()` in production startup. |
| Biome | Linting + formatting | Replaces ESLint + Prettier. Next.js 16 removed `next lint`; Biome is the 2026 standard replacement. Fast, zero-config. |
## Spotify Integration Details
### Authentication Flow (PKCE)
### February 2026 API Changes — CRITICAL
- **User cap**: Dev mode is limited to 5 users. A 4-person app fits within this limit.
- **Premium required**: The app owner must maintain an active Spotify Premium subscription or the app stops working.
- **Batch endpoints removed**: `GET /tracks` (multi-ID batch) is gone in Dev mode. The `@spotify/web-api-ts-sdk` SDK must be used with individual track fetches.
- **Playlist items renamed**: `GET /playlists/{id}/tracks` → `GET /playlists/{id}/items`. Items are only returned for playlists the user owns.
- **Extended Quota Mode is not available to individuals**: Requires a legally registered org with 250,000+ MAUs. Not applicable here.
## Apple Music Integration Details
### Authentication Architecture
### MusicKit JS v3 CDN
### Apple Music Playlist Fetch
### Apple Developer Program Cost
## Database Schema Overview
- `user` / `session` / `account` — Better Auth managed (generated via `betterauth/cli generate`)
- `sessions` — music sessions (session number, theme, date, description)
- `tracks` — track metadata (spotify_id, apple_id, title, artist, album, year)
- `session_tracks` — junction: session + track + position + attributed_user + platform
- `contributors` — the four known participants (MW, JG, JS, IT)
## Installation
# Scaffold
# Auth
# Database
# Spotify
# Apple JWT
# Validation
# UI (shadcn — interactive CLI, run separately)
# Dev tools
## Alternatives Considered
| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Better Auth | Auth.js v5 (NextAuth) | Auth.js v5 is in security-patch-only mode as of Sep 2025. Its own maintainers direct new projects to Better Auth. Spotify custom scopes have a known workaround burden in Auth.js. |
| Turso + Drizzle | Prisma + PostgreSQL | Prisma 7 closed the bundle/cold-start gap but Drizzle remains simpler for a single-developer personal project. PostgreSQL is overkill for 31 sessions and ~500 tracks. Turso's free tier is generous. |
| Turso + Drizzle | Supabase | Supabase adds an auth layer we're replacing with Better Auth, and a dashboard/RLS complexity we don't need. Turso is simpler for this scale. |
| shadcn/ui charts | Recharts directly | shadcn wraps Recharts with Tailwind-themed defaults. No benefit to bypassing it. |
| shadcn/ui charts | D3 | D3 is lower-level than needed for bar/area/radar charts. Recharts via shadcn is sufficient and dramatically faster to build. |
| Next.js | Remix / SvelteKit | Next.js 16 has better Vercel deployment defaults, wider ecosystem, and the team has more likely Next.js familiarity. App Router handles the public/private split cleanly. |
| Turso | PlanetScale | PlanetScale removed its free tier. |
| Zod v4 | Valibot | Zod v4 has comparable performance and size; Zod has broader ecosystem compatibility (React Hook Form, tRPC, etc.). |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Spotify Implicit Grant Flow | Deprecated and removed by Spotify on 27 Nov 2025. Apps using it stopped working. | PKCE flow via Better Auth Spotify provider |
| Auth.js v5 / NextAuth | In security-patch-only mode. Maintainers direct new projects to Better Auth. Spotify scope customisation has documented bugs. | Better Auth |
| `localhost` as Spotify redirect URI | Spotify blocked `localhost` redirects on 27 Nov 2025. | Use `127.0.0.1` in dev (Better Auth docs confirm this) |
| Spotify Extended Quota Mode | Unavailable to individuals — requires a legally registered org with 250K+ MAUs. | Stay in Dev Mode (5-user cap is fine for this app) |
| MusicKit JS v1 CDN | v1 is unmaintained. | Load MusicKit v3 from `js-cdn.music.apple.com/musickit/v3/musickit.js` |
| Inline audio playback | Out of scope per PROJECT.md. Embedding audio requires a different Apple/Spotify licence tier. | Link out to streaming platforms using Spotify URI / Apple Music URL |
| SQLite file on Vercel | Vercel's serverless functions use an ephemeral filesystem. SQLite files written during a request are lost. | Turso (SQLite over HTTP, persistent) |
| `middleware.ts` | Deprecated in Next.js 16 in favour of `proxy.ts`. Still works but will be removed in a future version. | `proxy.ts` with exported `proxy` function |
## Stack Patterns by Variant
- Use Next.js `"use cache"` directive (stable in Next.js 16) on session and analytics page Server Components
- Data is read-only — cache aggressively with `cacheLife: 'days'`
- No auth check needed; route lives outside the authenticated layout segment
- Use Better Auth `auth()` in Server Components or `useSession()` in Client Components
- Gate entire route segment with a layout-level session check
- Spotify tokens (20-min lifetime) are automatically refreshed via Better Auth's token rotation
- Trigger from a private API route; not a background worker
- For 31 sessions with 16 tracks each (~500 tracks total), a sequential fetch with `await` loops is fine — no queue needed
- Spotify: iterate owned playlists, fetch items per playlist individually (batch endpoint removed in Dev Mode)
- Apple Music: call `/v1/me/library/playlists` with pagination, then fetch tracks per playlist
- Compute per-user and group stats server-side in a Server Component using Drizzle queries
- Pass pre-aggregated data to shadcn Chart client components
- No need for a separate analytics service at this scale
## Version Compatibility
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 16.x | Node.js 20.9+ | Node 18 dropped in Next.js 16. Verify local Node version. |
| Next.js 16.x | TypeScript 5.1+ | Auto-installed by `create-next-app`. |
| shadcn/ui latest | Tailwind v4 | If using Tailwind v3 (legacy), pin `shadcn@2.3.0`. |
| Better Auth | Drizzle ORM | Use `drizzleAdapter` from `better-auth/adapters/drizzle` with `provider: "sqlite"`. |
| `@spotify/web-api-ts-sdk` 1.2.0 | Updated `/items` endpoint | SDK uses the renamed `playlists/{id}/items` endpoint naming. Verify no outstanding GitHub issues for Feb 2026 changes before first use. |
## Sources
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — version confirmed 16.2.9 latest stable, breaking changes, `proxy.ts`
- [GitHub next.js releases](https://github.com/vercel/next.js/releases) — version 16.2.9 confirmed as latest stable
- [Better Auth vs Auth.js 2026 — LogRocket](https://blog.logrocket.com/best-auth-library-nextjs-2026/) — Auth.js maintenance mode, Better Auth recommended for new projects
- [Better Auth Spotify provider docs](https://www.better-auth.com/docs/authentication/spotify) — Spotify social provider confirmed, `127.0.0.1` redirect URI requirement
- [Auth.js is now part of Better Auth — GitHub discussion](https://github.com/nextauthjs/next-auth/discussions/13252) — Auth.js handoff confirmed
- [Spotify Feb 2026 migration guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) — Dev Mode 5-user cap, Premium requirement, batch endpoint removal, `/items` rename
- [Spotify quota modes docs](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) — Extended Quota requires org + 250K MAUs, not for individuals
- [Spotify PKCE flow docs](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow) — recommended flow for browser apps
- [Drizzle ORM + Turso docs](https://orm.drizzle.team/docs/tutorials/drizzle-with-turso) — setup pattern confirmed
- [Turso pricing](https://turso.tech/pricing) — free tier: 500M row reads, 10M writes, 5GB
- [Drizzle vs Prisma 2026 — makerkit.dev](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma) — Drizzle preferred for personal/edge apps
- [Apple MusicKit developer docs](https://developer.apple.com/musickit/) — two-token model, Developer Program required
- [Tailwind CSS v4 release](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, Next.js needs `postcss.config.mjs`
- [shadcn/ui installation](https://ui.shadcn.com/docs/installation/next) — `shadcn@latest init`, Tailwind v4 compatible
- [Zod v4 release](https://zod.dev/v4) — stable, 14x faster than v3
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
