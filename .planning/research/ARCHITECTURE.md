# Architecture Research

**Domain:** Music archive and personal analytics web app (small fixed user base, dual streaming platform integration)
**Researched:** 2026-06-11
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         External Platforms                            │
│  ┌──────────────────────┐         ┌──────────────────────────────┐   │
│  │   Spotify Web API    │         │    Apple Music API (MusicKit) │  │
│  │  OAuth 2.0 / PKCE    │         │    JWT developer token +      │  │
│  │  refresh_token flow  │         │    user token (browser-only)  │  │
│  └──────────┬───────────┘         └──────────────┬────────────────┘  │
└─────────────┼───────────────────────────────────┼────────────────────┘
              │ playlist/track fetch (import-time) │ playlist fetch
              ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      Next.js App (full-stack)                         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     App Router (server-first)                   │ │
│  │                                                                 │ │
│  │  /                  Public archive view (no auth required)      │ │
│  │  /sessions/[id]     Public session detail view                  │ │
│  │  /contributors/[id] Public contributor profile                  │ │
│  │  /login             Auth entry point                            │ │
│  │  /dashboard         Private — session management                │ │
│  │  /import            Private — trigger Spotify/Apple import      │ │
│  └───────────────────────────────┬─────────────────────────────────┘ │
│                                  │                                    │
│  ┌───────────────────────────────┼────────────────────────────────┐  │
│  │              Route Handlers / Server Actions                    │  │
│  │                                                                 │  │
│  │  POST /api/import/spotify    Fetch playlists, parse, persist    │  │
│  │  POST /api/import/apple      Fetch playlists, parse, persist    │  │
│  │  GET  /api/sessions          Public data queries                │  │
│  │  POST /api/sessions/[id]     Patch session dates (auth only)    │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                  │                                    │
│  ┌───────────────────────────────┼────────────────────────────────┐  │
│  │                    Service Layer (lib/)                         │  │
│  │                                                                 │  │
│  │  spotify.ts        Spotify API client, token management        │  │
│  │  apple.ts          MusicKit JS bridge (client-side only)       │  │
│  │  importer.ts       Playlist parse + attribution logic           │  │
│  │  analytics.ts      Derived query functions (no raw SQL)         │  │
│  └───────────────────────────────┬────────────────────────────────┘  │
│                                  │                                    │
│  ┌───────────────────────────────┼────────────────────────────────┐  │
│  │                     Data Layer (Prisma)                         │  │
│  │                                                                 │  │
│  │  SQLite (dev/prod for this scale)                               │  │
│  │  Single database file — trivial backup, no infra to manage      │  │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
              │
              ▼ auth (Spotify OAuth via Auth.js)
        User browser (4 people)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| App Router pages | Render views; public routes SSR without auth, private routes server-side session check | Next.js Server Components |
| Middleware | Optimistic route guard — redirects unauthenticated to /login for private routes | Next.js middleware.ts + Auth.js session cookie |
| Route Handlers | API surface for import triggers and mutation operations | `app/api/**` with session verification at handler level |
| Server Actions | Inline mutations (e.g. patch session date, mark import complete) | `'use server'` functions co-located with components |
| spotify.ts | Wraps Spotify Web API: OAuth token refresh, playlist fetch, track metadata | Server-side only; never runs in browser |
| apple.ts | Wraps MusicKit JS: developer token generation (server), user auth flow (browser), playlist fetch (browser) | Split: server generates JWT developer token; browser holds user token |
| importer.ts | Parses description field for initials + theme, applies 4-track attribution rule, deduplicates against existing records | Pure TypeScript, no framework dependency |
| analytics.ts | Query functions producing aggregate stats: per-person genre/era/artist tendencies, group overlap | Prisma queries + light computation; results can be cached in Server Components |
| Prisma + SQLite | Persistent store for all imported data | Single `.db` file, Prisma schema + migrations |

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── (public)/               # Route group — no auth required
│   │   ├── page.tsx            # Archive home
│   │   ├── sessions/[id]/      # Session detail
│   │   └── contributors/[id]/  # Contributor profile + analytics
│   ├── (private)/              # Route group — auth required
│   │   ├── dashboard/          # Session management, import status
│   │   └── import/             # Trigger import, review parse results
│   ├── login/
│   │   └── page.tsx
│   └── api/
│       ├── auth/[...nextauth]/  # Auth.js handlers
│       ├── import/
│       │   ├── spotify/route.ts
│       │   └── apple/route.ts
│       └── sessions/route.ts
├── lib/
│   ├── spotify.ts              # Spotify API client
│   ├── apple.ts                # MusicKit JS integration
│   ├── importer.ts             # Parse + attribute logic
│   ├── analytics.ts            # Derived analytics queries
│   ├── auth.ts                 # Auth.js config
│   └── db.ts                   # Prisma client singleton
├── components/
│   ├── sessions/               # SessionCard, TrackList, TrackRow
│   ├── analytics/              # ContributorChart, GroupOverlapChart
│   └── ui/                     # Generic design system atoms
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── middleware.ts               # Route protection
```

### Structure Rationale

- **(public)/ and (private)/ route groups:** Next.js route groups let you express access intent in the folder structure without affecting URL paths. The middleware only guards `(private)/` paths, making the access model obvious at a glance.
- **lib/ service layer:** Keeps all external integration and business logic out of components and route handlers. Components stay dumb; route handlers stay thin. This is testable in isolation.
- **Prisma in lib/db.ts singleton:** Required to avoid connection exhaustion in development hot-reload; standard Next.js + Prisma pattern.

## Architectural Patterns

### Pattern 1: Import-Once, Query-Own-Data

**What:** Fetch from Spotify/Apple Music once during an explicit import operation. Store everything in SQLite. All user-facing queries hit the local database — never the streaming platforms at request time.

**When to use:** Always, for this project. The alternative (proxying every analytics query to live streaming APIs) means: rate limits, latency, API dependency, and you can't enrich data (e.g. manual session dates).

**Trade-offs:** Initial import complexity; playlist changes on streaming platforms require a re-import. For 31 static sessions this is a non-issue — sessions are essentially append-only.

```typescript
// importer.ts — core attribution logic
export function attributeTracks(
  tracks: SpotifyTrack[],
  descriptionInitials: string[] // e.g. ['JS', 'IT', 'MW', 'JG']
): AttributedTrack[] {
  return tracks.map((track, i) => ({
    ...track,
    contributor: descriptionInitials[Math.floor(i / 4)]
  }))
}
```

### Pattern 2: Apple MusicKit JS — Client-Side User Auth, Server-Side Developer Token

**What:** MusicKit JS runs only in the browser. The developer JWT (signed with your Apple private key) must be generated server-side on every request or cached. The user token is stored in browser localStorage by MusicKit JS automatically.

**When to use:** Whenever doing an Apple Music import. The import flow is: browser loads page → server injects fresh developer token → browser calls `MusicKit.authorize()` → user token acquired → browser sends user token to server → server fetches playlists using both tokens.

**Trade-offs:** The user token lifetime is undocumented (believed 6 months, can be as short as 1-2 days). Users may need to re-authenticate. Apple's token cannot be refreshed automatically — unlike Spotify's `refresh_token` flow. This makes Apple Music import less frictionless.

```typescript
// lib/apple.ts (server side — developer token generation)
import jwt from 'jsonwebtoken'

export function generateDeveloperToken(): string {
  return jwt.sign({}, process.env.APPLE_PRIVATE_KEY!, {
    algorithm: 'ES256',
    expiresIn: '6h',
    issuer: process.env.APPLE_TEAM_ID,
    header: { alg: 'ES256', kid: process.env.APPLE_KEY_ID }
  })
}
```

### Pattern 3: Public/Private Route Split via Middleware + Defense in Depth

**What:** Middleware handles the fast redirect for unauthenticated users attempting to access private routes. Server Components and Route Handlers re-verify the session independently. Public routes render without any auth check.

**When to use:** This is the recommended Next.js App Router auth pattern. Middleware alone is insufficient for security — it can be bypassed. Handler-level verification is the real security boundary.

**Trade-offs:** Minor duplication (auth check in middleware AND handlers). This is intentional and correct.

```typescript
// middleware.ts
const privateRoutes = ['/dashboard', '/import']

export default async function middleware(req: NextRequest) {
  const isPrivate = privateRoutes.some(r => req.nextUrl.pathname.startsWith(r))
  if (!isPrivate) return NextResponse.next()
  const session = await auth() // Auth.js
  if (!session) return NextResponse.redirect(new URL('/login', req.url))
  return NextResponse.next()
}
```

## Data Flow

### Import Flow (one-time operation)

```
User clicks "Import from Spotify" (private /import page)
    ↓
Browser → POST /api/import/spotify
    ↓
Route Handler: verify session → call spotify.ts → fetchUserPlaylists()
    ↓
spotify.ts: use stored OAuth refresh_token → get access_token
    ↓
Fetch all playlists matching "Warwick Massive Tunage" naming pattern
    ↓
For each playlist:
  - fetch tracks (paginated, max 100 per request)
  - parse description: extract initials order + theme
  - apply 4-track attribution rule (importer.ts)
    ↓
Persist to SQLite via Prisma:
  - upsert Session (by playlist ID / session number)
  - upsert Track (by Spotify track ID)
  - create SessionTrack join records with contributor + position
    ↓
Route Handler returns: { imported: N, skipped: M, errors: [...] }
    ↓
UI shows import summary
```

### Public Read Flow (anonymous user)

```
GET /sessions/[id]
    ↓
Server Component — no auth check required
    ↓
Prisma query: session + tracks + contributors (JOIN)
    ↓
Server-rendered HTML — no client-side data fetching
    ↓
Links to Spotify/Apple Music for playback (external hrefs only)
```

### Analytics Flow

```
GET /contributors/[id] (public) or /dashboard/analytics (private)
    ↓
Server Component calls analytics.ts functions
    ↓
analytics.ts runs Prisma queries:
  - GROUP BY contributor, artist → top artists per person
  - GROUP BY contributor, decade → era preferences
  - Cross-join contributors → co-selection overlap score
    ↓
Results passed as props to chart components (client components)
    ↓
Charts render in browser (Recharts / lightweight charting lib)
```

## Data Model Sketch

```
Session
  id              String  @id  (e.g. "session-31" or Spotify playlist ID)
  sessionNumber   Int     @unique
  theme           String
  date            DateTime?   (manually entered — not from API)
  spotifyPlaylistId String?
  appleMusicPlaylistId String?
  rawDescription  String  (preserve original for re-parsing)
  contributorOrder String  (serialised initials order, e.g. "JS,IT,MW,JG")
  createdAt       DateTime
  tracks          SessionTrack[]

Track
  id              String  @id  (Spotify track ID — stable identifier)
  title           String
  artistName      String  (primary artist, denormalised for query ease)
  albumName       String?
  releaseYear     Int?
  durationMs      Int?
  spotifyUrl      String?
  appleMusicUrl   String?
  previewUrl      String?
  tracks          SessionTrack[]

SessionTrack                    (join table — the unit of analytics)
  id              String  @id
  session         Session @relation(...)
  sessionId       String
  track           Track   @relation(...)
  trackId         String
  contributor     String  (initials: "MW", "JG", "JS", "IT")
  position        Int     (1–16 within session)
  @@unique([sessionId, position])

Contributor                     (small lookup table — 4 rows, seeded)
  initials        String  @id   ("MW", "JG", "JS", "IT")
  fullName        String
  spotifyUserId   String?
  appleMusicUserId String?
```

**Design decisions:**
- `Track.id` uses the Spotify track ID as the natural key. This avoids duplicates when the same track appears in multiple sessions and makes upsert logic straightforward.
- `SessionTrack.contributor` stores initials as a string rather than a foreign key to the 4-row Contributor table — keeps queries simple and avoids joins for the most common analytics patterns.
- `Session.rawDescription` is stored so the parse logic can be re-run without re-importing from Spotify if the attribution algorithm is improved.
- `Session.date` is nullable because it requires manual entry — import can succeed without it.
- Artist is denormalised onto `Track` rather than normalised into a separate Artist table. For 31 sessions × 16 tracks = 496 tracks, a separate Artist table adds complexity with no performance benefit.

## Suggested Build Order

Dependencies between components drive this order:

```
1. Data layer (Prisma schema + SQLite)
   — everything else reads/writes this; must exist first

2. Spotify OAuth + import pipeline
   — Auth.js Spotify provider; fetch playlists; parse descriptions; seed DB
   — Unblocks all other features (no data = nothing to show)

3. Session browsing (public views)
   — Validates the data model and attribution logic are correct
   — Exposes the archive without requiring analytics to be complete

4. Apple Music import (optional second import path)
   — Builds on the import pipeline architecture; Spotify comes first
     because Spotify's OAuth is simpler than Apple's JWT flow
   — Sessions from both platforms are mirrors; Apple import is additive

5. Analytics views
   — Requires rich session data; build last when corpus is validated

6. Auth-gated private dashboard
   — Admin features (date entry, re-import) sit on top of everything else
```

## Integration Points

### External Services

| Service | Integration Pattern | Key Constraints |
|---------|---------------------|-----------------|
| Spotify Web API | OAuth 2.0 Authorization Code + refresh_token. Store refresh_token in DB against user. Server-side only. | Rate limit: rolling 30-second window (count undocumented). Use `snapshot_id` to avoid re-fetching unchanged playlists. Batch track fetches (100 per call). |
| Apple Music API | MusicKit JS (browser). Developer token signed ES256 JWT, generated server-side. User token acquired via browser `authorize()` pop-up. Pass user token to server for playlist fetch. | User token cannot be refreshed programmatically — user must re-auth on expiry. Token stored in browser localStorage tied to origin. No standard OAuth flow. |
| Auth.js (NextAuth v5) | Handles Spotify OAuth for app login. Stores session in signed cookie. Access + refresh tokens available in session callbacks. | Configure `jwt` callback to persist Spotify `refresh_token` for import use. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| App Router page ↔ Prisma | Direct in Server Components | Only for reads. Mutations go through Server Actions or Route Handlers. |
| Route Handler ↔ service lib | Direct function call | Handlers stay thin — validate input, call lib, return response. |
| Apple import ↔ browser | Browser initiates MusicKit auth; sends user token to server via POST | User token must not be stored server-side beyond the import transaction (Apple TOS). |
| analytics.ts ↔ chart components | Server passes serialised data as props | Charts are Client Components. All computation happens server-side. |

## Anti-Patterns

### Anti-Pattern 1: Querying Streaming APIs at Request Time

**What people do:** Skip local storage; proxy every analytics page view through Spotify/Apple Music API calls.

**Why it's wrong:** Rate limits hit immediately at analytics scale (aggregating 500+ tracks). Latency is terrible. You can't add your own data (manual session dates). The app breaks if APIs change or rate-limit you.

**Do this instead:** Import once, store locally, query your own data. Streaming platform API calls happen only during explicit import operations.

### Anti-Pattern 2: Relying on Middleware Alone for Auth

**What people do:** Put auth only in middleware.ts, assuming it protects all private routes.

**Why it's wrong:** Next.js middleware can be bypassed in edge cases. Route Handlers and Server Actions must independently verify session. Middleware is a UX convenience (fast redirect), not a security boundary.

**Do this instead:** Middleware for fast redirect + handler-level `verifySession()` call as the real security gate.

### Anti-Pattern 3: Normalising Artist into a Separate Table

**What people do:** Create Artist, Album, Track tables mirroring the Spotify data model.

**Why it's wrong:** 496 tracks across 31 sessions. Full normalisation adds join complexity to every analytics query with zero performance benefit at this scale. Spotify track IDs already deduplicate tracks.

**Do this instead:** Denormalise `artistName` and `albumName` directly on Track. If the data model needs to evolve, Prisma migrations make that change cheap later.

### Anti-Pattern 4: Full Live Sync with Streaming Platforms

**What people do:** Build a sync job that periodically polls Spotify to detect changes and update the local database.

**Why it's wrong:** The sessions are a historical archive — they don't change. A sync job adds operational complexity (cron, error handling, conflict resolution) with zero benefit.

**Do this instead:** Manual re-import triggered from the dashboard when needed. Simple and correct.

## Scaling Considerations

This is explicitly a 4-person side project. Scaling is not a concern. The table below exists only to confirm the chosen stack is not over-engineered.

| Scale | Architecture Notes |
|-------|-------------------|
| 4 users (this project) | SQLite + Next.js monolith on a $5 VPS or Vercel free tier. No queues, no CDN, no caching layer needed. |
| ~100 users | Same stack. SQLite handles thousands of reads/second. Add connection pooling if needed. |
| 1k+ users | Migrate Prisma datasource to PostgreSQL (schema unchanged). Consider ISR for public routes. |

The first real bottleneck would be concurrent writes during import — irrelevant here since only 4 users exist and imports are infrequent.

## Sources

- [Spotify Web API Rate Limits](https://developer.spotify.com/documentation/web-api/concepts/rate-limits)
- [Spotify Web API Reference — Get Playlist Tracks](https://developer.spotify.com/documentation/web-api/reference/get-track)
- [User Authentication for MusicKit](https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit)
- [MusicKit JS session expiry — Apple Developer Forums](https://developer.apple.com/forums/thread/116535)
- [Storing the Apple Music User Token with MusicKit JS](https://medium.com/@gavinkasdorf/apples-musickit-js-allows-you-to-access-an-apple-music-user-s-playlists-and-library-listen-to-32f77ff54d48)
- [Auth.js Spotify Provider](https://authjs.dev/getting-started/providers/spotify)
- [Next.js Authentication Guide — Route Protection](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/authentication.mdx)
- [Next.js + Prisma + SQLite](https://www.robinwieruch.de/next-prisma-sqlite/)
- [Prisma ORM — Data Modeling](https://www.prisma.io/docs/orm/core-concepts/data-modeling)
- [Building a Next.js Full-Stack App with Prisma](https://www.prisma.io/nextjs)

---
*Architecture research for: Warwick Massive Tunage — music archive and analytics*
*Researched: 2026-06-11*
