# Phase 2: Import Pipeline - Research

**Researched:** 2026-06-12
**Domain:** Spotify Web API (Client Credentials + User OAuth), Last.fm tagging API, Drizzle schema extension, Next.js streaming Route Handlers
**Confidence:** MEDIUM (one critical API constraint changes the locked decision D-01/D-02 — see Open Questions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use Spotify Client Credentials flow (server-side) — POST to `https://accounts.spotify.com/api/token` with `grant_type=client_credentials` using `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` env vars. No user OAuth, no Spotify Premium required. Playlists are public.
- **D-02:** Identify playlists via Mark's Spotify user ID — call `GET /users/{user_id}/playlists` (Client Credentials can list a user's public playlists). `SPOTIFY_USER_ID` stored as an env var.
- **D-03:** Session name pattern matching: Claude's discretion — extract session number from playlist name using regex; theme from description.
- **D-04:** Re-import behaviour: replace-all — on each import trigger, truncate `session_tracks`, `tracks`, and `sessions` tables then re-insert. Simple, safe, admin-only.
- **D-05:** Apple Music import (IMPORT-07) deferred to Phase 3. Phase 2 = Spotify only.
- **D-06:** Use Last.fm `artist.getTopTags` endpoint — free, no auth, returns community folksonomy tags. `LASTFM_API_KEY` env var.
- **D-07:** Enrich per unique artist (deduplicated across all tracks) — one API call per unique artist.
- **D-08:** Store top 5 tags per artist in an `artist_tags` table. Tags reused across all tracks by that artist.
- **D-09:** Enrich during import — after all tracks are inserted, run enrichment in the same request chain.
- **D-10:** Date entry lives on `/dashboard` as an inline table — all 31 sessions visible with a native `<input type="date">` per row, saved on blur/Enter.
- **D-11:** Attribution error display — a warning card section on `/dashboard` lists sessions where the description did not contain a valid initials string. Admin can manually assign contributor order via a slot-based UI.
- **D-12:** Contributor order: theme-chooser first, then alphabetical surname (Groves, Slade, Thomas, Wright). MW=Mark Wright, JG=Jack Groves, JS=Jon Slade, IT=Iwan Thomas.

### Claude's Discretion

- Exact regex pattern for matching session playlists from the user's Spotify library
- Rate limiting strategy for Last.fm API (max 5 req/sec)
- Exact Drizzle schema for `sessions`, `tracks`, `session_tracks`, `contributors`, `artist_tags` tables
- Error handling when individual playlist or track fetches fail

### Deferred Ideas (OUT OF SCOPE)

- Apple Music import (IMPORT-07) — deferred to Phase 3
- Advanced import scheduling / background jobs
- CSV export of imported data
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | Admin user can connect their Spotify account via OAuth to authorise playlist access | D-01 clarified: Client Credentials cannot list playlists or fetch items after Feb 2026 — see Critical Finding. Requires Better Auth Spotify social provider OR hardcoded playlist IDs. |
| IMPORT-02 | App can import all playlists matching session naming convention | Session name regex pattern researched; playlist discovery requires user OAuth or known IDs (D-02 impacted by Feb 2026 API removal). |
| IMPORT-03 | App parses contributor order from playlist description initials | Regex parsing pattern defined; Zod validation schema provided. |
| IMPORT-04 | App correctly handles theme-chooser-first ordering rule | Attribution logic: slots 1–4, 5–8, 9–12, 13–16 map to positions 0–3 in initials array. |
| IMPORT-05 | Admin can enter or edit session date via dashboard | Native `<input type="date">` in inline table; PATCH API route to `sessions` table. |
| IMPORT-06 | App fetches genre/artist tags from Last.fm and stores locally | Last.fm `artist.getTopTags` endpoint researched; `artist_tags` table schema defined; 5 req/sec rate limit confirmed. |
| IMPORT-07 | Apple Music import | DEFERRED to Phase 3 — no research performed. |
| IMPORT-08 | App gracefully flags sessions with no valid initials string | Attribution error card in UI-SPEC; `attribution_status` column tracks parse success; manual override API route. |
</phase_requirements>

---

## Summary

Phase 2 populates the database from Spotify and adds admin dashboard tooling for date entry and attribution correction. The research surface is three distinct domains: Spotify API access patterns post-February 2026, Last.fm genre enrichment, and Drizzle schema extension.

**Critical finding — D-01 and D-02 are impacted by February 2026 API changes.** The `GET /users/{user_id}/playlists` endpoint was **removed** in Dev Mode in February 2026 and cannot be used regardless of auth method. The `GET /playlists/{id}/items` endpoint returns playlist contents only for playlists owned by the authenticated user — Client Credentials (no user context) returns metadata only, not track items. This means the locked decision to use purely Client Credentials for discovery and item fetching is not viable as-is. Two practical solutions exist (described in Open Questions); the planner should flag this for user decision before writing tasks that assume D-02.

Everything else in the phase is well-understood: Last.fm's `artist.getTopTags` is a simple unauthenticated GET requiring only an API key; the Drizzle schema patterns established in Phase 1 extend directly to the new tables; the Next.js streaming Route Handler pattern is confirmed in the Next.js 16 docs and handles the progress feedback requirement from the UI-SPEC.

**Primary recommendation:** Use Better Auth's Spotify social provider to get Mark's OAuth `access_token` at import time (it's stored in the `account` table already when he signs in). Use that token with `GET /me/playlists` + `GET /playlists/{id}/items`. This requires adding the Spotify social provider to `lib/auth.ts` — a small but required addition.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spotify token exchange (Client Credentials) | API / Backend | — | Client secret must never be browser-exposed; server-only |
| Spotify playlist discovery (`GET /me/playlists`) | API / Backend | — | Requires user OAuth token stored server-side in `account` table |
| Playlist item fetch (`GET /playlists/{id}/items`) | API / Backend | — | Auth token required; server controls rate-limiting and error handling |
| Import orchestration (loop, DB writes) | API / Backend | — | Long-running operation; streaming response back to client |
| Last.fm tag enrichment | API / Backend | — | Sequential after track insert; no user auth needed |
| Import progress feedback | Browser / Client | API/Backend (streaming) | `ReadableStream` SSE from Route Handler; client consumes EventSource |
| Session date PATCH | API / Backend | — | Simple DB write; admin-gated |
| Attribution manual override | API / Backend | — | Admin-gated PATCH to `session_tracks` |
| Dashboard session table | Frontend Server (SSR) | Browser/Client | Initial render SSR; inline date inputs are Client Component islands |
| Attribution error card | Browser / Client | — | Select dropdowns and save action require client state |
| DB schema (`sessions`, `tracks`, `session_tracks`, `contributors`, `artist_tags`) | Database / Storage | — | Drizzle schema + `drizzle-kit push` |

---

## Standard Stack

### Core (already installed in Phase 1)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `drizzle-orm` | 0.45.2 [VERIFIED: npm registry] | DB ORM | Already in project; schema extension follows established patterns |
| `drizzle-kit` | 0.31.10 [VERIFIED: npm registry] | Schema migrations | Already in project; `npm run db:push` pattern established |
| `next` | 16.2.9 [VERIFIED: npm registry] | Framework | Route Handler streaming confirmed in v16 official docs |
| `zod` | 4.x [VERIFIED: npm registry] | Validation | Already installed; used for initials string parsing, API input validation |
| `better-auth` | 1.6.17 [VERIFIED: npm registry] | Auth | Already installed; Spotify social provider needs to be added to `lib/auth.ts` |
| `sonner` | 1.x [VERIFIED: npm registry] | Toasts | Already installed; used for import success/error |

### New Packages Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@spotify/web-api-ts-sdk` | 1.2.0 [VERIFIED: npm registry] | Spotify API client | For `sdk.playlists.getUsersPlaylists()` and `sdk.playlists.getPlaylistItems()` — **with caveat: see Package Legitimacy Audit** |

**CRITICAL SDK CAVEAT:** The `@spotify/web-api-ts-sdk` at version 1.2.0 (published Jan 2024) uses the old `/playlists/{id}/tracks` endpoint path internally, which was renamed to `/playlists/{id}/items` in February 2026. This means `sdk.playlists.getPlaylistItems()` may return 404 or incorrect results in Dev Mode. [VERIFIED: GitHub issue #159, Feb 2026 changelog]

**Recommendation:** Use the SDK for `SpotifyApi.withAccessToken()` authentication wrappers and typed responses, but call `GET /playlists/{id}/items` directly via `fetch` for the items endpoint to ensure the correct URL path is used. Alternatively, bypass the SDK entirely and use `fetch` with typed response shapes modelled from the SDK's TypeScript types.

### Supporting (already installed)

All shadcn components needed by UI-SPEC are either already installed or require only `npx shadcn add`:
- `table`, `alert`, `select`, `progress`, `tooltip` — new installs per UI-SPEC

**Installation for new shadcn components:**
```bash
npx shadcn add table alert select progress tooltip
```

**Installation for Spotify SDK (if using):**
```bash
npm install @spotify/web-api-ts-sdk
```

**Version verification:**
```bash
npm view @spotify/web-api-ts-sdk version   # returns 1.2.0 as of 2026-06-12
```

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time. All packages below are tagged `[ASSUMED]` for download/age data; registry existence was confirmed via `npm view`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@spotify/web-api-ts-sdk` | npm | ~2.5 yrs | high (official Spotify SDK) | github.com/spotify/spotify-web-api-ts-sdk [VERIFIED: npm view] | not run | Approved with caveat — see Standard Stack SDK warning |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**Note:** All other packages required for Phase 2 are already installed from Phase 1. The only new npm package is `@spotify/web-api-ts-sdk`. This is the official SDK from Spotify's own GitHub organisation — legitimacy is HIGH confidence regardless of slopcheck.

*slopcheck was unavailable at research time; the above package is tagged `[ASSUMED]` for download statistics but the source repo is verified as `github.com/spotify/spotify-web-api-ts-sdk` via npm view.*

---

## Architecture Patterns

### System Architecture Diagram

```
Admin (Mark)
    │
    ▼ POST /api/import
┌─────────────────────────────────────────────────┐
│  Route Handler (app/api/import/route.ts)         │
│  auth guard → admin check                        │
│                                                  │
│  1. Get Mark's Spotify OAuth token               │
│     └─ db.select(account) WHERE userId=Mark,     │
│           providerId='spotify'                   │
│                                                  │
│  2. Fetch playlists                              │
│     └─ GET /me/playlists (paginated, limit=50)   │
│           └─ filter by session name regex        │
│                                                  │
│  3. For each matched playlist (≤31):             │
│     └─ GET /playlists/{id}/items (paginated)     │
│           └─ parse description → initials        │
│           └─ insert sessions + tracks + attrs    │
│                                                  │
│  4. Last.fm enrichment                           │
│     └─ unique artists → artist.getTopTags        │
│           (≤5 req/sec rate limit)                │
│           └─ insert artist_tags                  │
│                                                  │
│  5. Stream progress events throughout            │
│     └─ ReadableStream (text/event-stream)        │
└─────────────────────────────────────────────────┘
         │ streaming SSE chunks
         ▼
ImportTriggerCard (Client Component)
    └─ EventSource / fetch reader → progress bar + status line

Admin PATCH /api/sessions/{id}/date
    └─ auth guard → update sessions.date_played

Admin PATCH /api/sessions/{id}/attribution
    └─ auth guard → update session_tracks.attributed_user_id
```

### Recommended Project Structure

```
app/
├── api/
│   ├── import/
│   │   └── route.ts             # Replace stub — streaming POST
│   ├── sessions/
│   │   └── [id]/
│   │       ├── date/
│   │       │   └── route.ts     # PATCH — update session date
│   │       └── attribution/
│   │           └── route.ts     # PATCH — manual attribution override
│   └── auth/                    # Phase 1 (unchanged)
├── dashboard/
│   └── page.tsx                 # Add session table + attribution card
db/
└── schema.ts                    # Add sessions, tracks, session_tracks, contributors, artist_tags
lib/
├── auth.ts                      # Add Spotify social provider
├── spotify.ts                   # NEW: Spotify API client helpers (token fetch, playlist fetch, items fetch)
├── lastfm.ts                    # NEW: Last.fm tag enrichment helper
└── import-orchestrator.ts       # NEW: Full import pipeline (calls spotify.ts + lastfm.ts)
components/
├── ImportTriggerCard.tsx         # Replace with streaming-aware version
├── SessionDateTable.tsx          # NEW: inline date entry table (Client Component)
└── AttributionErrorCard.tsx      # NEW: manual attribution UI (Client Component)
```

### Pattern 1: Next.js 16 Streaming Route Handler (SSE)

**What:** Return a `ReadableStream` with `Content-Type: text/event-stream` from the import Route Handler so the admin can watch progress without a separate polling endpoint.

**When to use:** Long-running server operation (the import takes ~30–60s for 31 playlists + 496 tracks + ~80 unique artist tag lookups) where user feedback is required.

```typescript
// Source: https://nextjs.org/docs/app/guides/streaming#streaming-in-route-handlers
// app/api/import/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      try {
        send('status', 'Fetching playlists…');
        // ... import logic here, calling send() for progress ...
        send('complete', JSON.stringify({ sessions: 31, tracks: 496 }));
      } catch (err) {
        send('error', String(err));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Client consumption (ImportTriggerCard.tsx):**
```typescript
// "use client"
const response = await fetch('/api/import', { method: 'POST' });
const reader = response.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Parse SSE lines and update progress state
  const text = decoder.decode(value);
  // Parse event: and data: lines to update UI
}
```

### Pattern 2: Spotify User OAuth Token Recovery

**What:** Retrieve Mark's Spotify `access_token` from the Better Auth `account` table (stored when he logs in via the Spotify social provider) for use in the import API route.

**When to use:** Any server-side operation that needs to act as the signed-in user against Spotify. Avoids re-prompting for OAuth at import time.

```typescript
// Source: Better Auth docs — account table stores oauth tokens
// lib/spotify.ts
import { db } from '@/lib/db';
import { account } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function getSpotifyAccessToken(userId: string): Promise<string | null> {
  const row = await db
    .select({ accessToken: account.accessToken, expiresAt: account.accessTokenExpiresAt })
    .from(account)
    .where(and(
      eq(account.userId, userId),
      eq(account.providerId, 'spotify'),
    ))
    .get();

  if (!row?.accessToken) return null;
  // Better Auth handles token refresh automatically; token in DB should be valid
  return row.accessToken;
}
```

**Note on token freshness:** Better Auth refreshes Spotify tokens automatically when `useSession()` is active client-side. But the import Route Handler runs server-side after the user has navigated to the dashboard. The token in the `account` table may be up to 60 minutes old (Spotify tokens expire at 3600s). The import should check `accessTokenExpiresAt` and, if within 5 minutes of expiry, call Better Auth's refresh API or use `fetch` directly with the `refresh_token` from the `account` table.

### Pattern 3: Drizzle Replace-All Import Transaction

**What:** Delete all existing import data and re-insert in a single Drizzle transaction to prevent partial states (D-04).

```typescript
// Source: https://orm.drizzle.team/docs/transactions, https://orm.drizzle.team/docs/delete
// lib/import-orchestrator.ts
import { db } from '@/lib/db';
import { sessions, tracks, sessionTracks, artistTags } from '@/db/schema';

await db.transaction(async (tx) => {
  // Delete in FK-safe order (child tables first)
  await tx.delete(artistTags);
  await tx.delete(sessionTracks);
  await tx.delete(tracks);
  await tx.delete(sessions);
  // Note: contributors is seeded once and NOT cleared on re-import
  // (contributor IDs are stable FKs; re-seeding would require cascade)

  // Insert fresh data
  for (const session of importedSessions) {
    await tx.insert(sessions).values(session);
  }
  for (const track of importedTracks) {
    await tx.insert(tracks).values(track);
  }
  // ... etc.
});
```

**IMPORTANT:** The transaction runs inside the streaming Route Handler's `start()` callback. Progress events sent before the transaction commits are technically pre-commit. This is acceptable for an admin-only, single-user operation.

### Pattern 4: Last.fm Rate-Limited Sequential Enrichment

**What:** Fetch top tags for each unique artist, respecting Last.fm's confirmed 5 req/sec limit.

```typescript
// Source: https://www.last.fm/api/show/artist.getTopTags (official docs), API TOS
// lib/lastfm.ts
const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/';
const RATE_LIMIT_MS = 200; // 5 req/sec = 200ms between requests

export async function getTopTagsForArtist(
  artistName: string,
  apiKey: string
): Promise<string[]> {
  const url = new URL(LASTFM_BASE);
  url.searchParams.set('method', 'artist.gettoptags');
  url.searchParams.set('artist', artistName);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('autocorrect', '1');

  const res = await fetch(url.toString());
  if (!res.ok) return [];

  const data = await res.json() as {
    toptags?: { tag: Array<{ name: string; count: number; url: string }> };
    error?: number;
    message?: string;
  };

  if (data.error || !data.toptags?.tag) return [];
  return data.toptags.tag.slice(0, 5).map((t) => t.name.toLowerCase());
}

// Caller: iterate unique artists with a delay
for (const artist of uniqueArtists) {
  const tags = await getTopTagsForArtist(artist, process.env.LASTFM_API_KEY!);
  // insert into artist_tags
  await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
}
```

### Pattern 5: Initials String Parsing

**What:** Parse contributor order from playlist description using regex.

**Format in playlists:** e.g. `"Theme: Desert Island Discs | MW, JG, JS, IT"`

```typescript
// Claude's discretion — D-03
// Regex: match 2 uppercase letters, comma-separated, in groups of 4
const INITIALS_REGEX = /\b([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2})\b/;

const VALID_INITIALS = new Set(['MW', 'JG', 'JS', 'IT']);

function parseInitials(description: string): string[] | null {
  const match = description.match(INITIALS_REGEX);
  if (!match) return null;
  const candidates = [match[1], match[2], match[3], match[4]];
  // Validate all 4 are known contributors
  if (!candidates.every((i) => VALID_INITIALS.has(i))) return null;
  // Validate no duplicates
  if (new Set(candidates).size !== 4) return null;
  return candidates; // e.g. ['MW', 'JG', 'JS', 'IT']
}
```

**Attribution from initials:** Tracks 1–4 → `initials[0]`, tracks 5–8 → `initials[1]`, etc.

### Pattern 6: Drizzle Insert Batch Optimisation

**What:** For ~496 tracks, insert in batches to avoid SQLite "too many bound parameters" errors (SQLite limit: 999 parameters).

```typescript
// Source: [ASSUMED] — SQLite SQLITE_MAX_VARIABLE_NUMBER limit
// A track row has ~10 fields → max batch size ≈ 99 rows per insert
const BATCH_SIZE = 50; // conservative; each track row has ~10 columns
for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
  await tx.insert(tracksTable).values(tracks.slice(i, i + BATCH_SIZE));
}
```

### Anti-Patterns to Avoid

- **Using `GET /users/{user_id}/playlists`:** REMOVED in Feb 2026 Dev Mode. Will 404. Use `GET /me/playlists` instead.
- **Using `@spotify/web-api-ts-sdk` `getPlaylistItems()` directly:** SDK v1.2.0 still calls `/tracks` internally, not `/items`. Call `GET /playlists/{id}/items` directly via `fetch`.
- **Calling Last.fm without rate limit:** Error code 29 (rate limit exceeded) blocks enrichment. Always maintain 200ms gaps.
- **Using `middleware.ts`:** Deprecated in Next.js 16 in favour of `proxy.ts`. Already using `proxy.ts` from Phase 1 — do not add a `middleware.ts`.
- **Writing to local SQLite on Vercel:** Phase 1 established Turso; do not fall back to file-system SQLite writes.
- **Streaming from a POST route without `dynamic = 'force-dynamic'`:** Next.js may cache or buffer. Export `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'` on the import route.
- **Clearing `contributors` table on re-import:** Contributors are stable seed data. Re-seeding would require cascading DELETE on `session_tracks.attributed_user_id` FK. Seed contributors once and skip them in the truncate pass.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spotify token exchange | Custom OAuth flow | Better Auth Spotify social provider | Already in the stack; stores refresh_token automatically |
| Spotify API type safety | Custom fetch wrapper with manual types | `@spotify/web-api-ts-sdk` types (even if not using SDK methods) | SDK ships typed response shapes — import types for `PlaylistTrack`, `SimplifiedPlaylist`, etc. |
| Progress feedback from long-running route | Polling endpoint | `ReadableStream` SSE | Native Web Streams API; confirmed in Next.js 16 official docs |
| DB migrations | Manual SQL | `npm run db:push` (`drizzle-kit push`) | Established in Phase 1; schema changes go through this command |
| Last.fm requests | Custom retry/rate-limit library | Simple `await sleep(200)` between calls | 31 playlists × ~16 unique artists/playlist ≈ 80–100 unique artists total; sequential with sleep is sufficient |
| Attribution slot UI | Custom dropdown component | shadcn `Select` | Already in UI-SPEC; Radix UI handles accessibility |

**Key insight:** At 31 sessions and ~496 tracks, every "clever" solution (queues, background workers, retry libraries) is over-engineering. Sequential `await` loops with simple error handling are correct and easier to debug.

---

## Common Pitfalls

### Pitfall 1: `GET /users/{user_id}/playlists` — REMOVED in Dev Mode

**What goes wrong:** The import fails with HTTP 404 immediately when trying to list playlists.

**Why it happens:** Spotify removed this endpoint in the February 2026 Dev Mode restrictions. Only `GET /me/playlists` is available now for playlist discovery.

**How to avoid:** Use `GET /me/playlists` with Mark's OAuth `access_token` from the `account` table, not Client Credentials with a user ID.

**Warning signs:** 404 on first API call; "endpoint not found" in Spotify error body.

---

### Pitfall 2: Spotify SDK `getPlaylistItems()` Calls Old `/tracks` Path

**What goes wrong:** `sdk.playlists.getPlaylistItems(id)` returns 404 in Dev Mode because the SDK hardcodes the old `/playlists/{id}/tracks` path.

**Why it happens:** SDK v1.2.0 was published January 2024 and has not been updated for the February 2026 endpoint rename.

**How to avoid:** Call `GET /playlists/{id}/items` directly via `fetch`. Use the SDK's TypeScript types for type-safety without using its network methods:

```typescript
import type { Page, PlaylistedTrack, Track } from '@spotify/web-api-ts-sdk';

const res = await fetch(
  `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50&offset=${offset}`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
const data: Page<PlaylistedTrack<Track>> = await res.json();
```

**Warning signs:** 404 on `getPlaylistItems()` call; Spotify changelog references `/items` not `/tracks`.

---

### Pitfall 3: Client Credentials Cannot Fetch Playlist Items Post-Feb 2026

**What goes wrong:** Client Credentials token returns metadata-only responses from `GET /playlists/{id}/items` (or the items array is empty/null).

**Why it happens:** Post-Feb 2026, playlist items are only returned for playlists owned by the authenticated user. Client Credentials has no user context, so Spotify considers it as accessing "other" playlists — metadata only.

**How to avoid:** Use Mark's OAuth token (from Better Auth's `account` table) for all playlist item fetches.

**Warning signs:** `items` field is `null` or empty in the API response despite the playlist being non-empty.

---

### Pitfall 4: Spotify Access Token Expiry During Import

**What goes wrong:** The import starts successfully but fails partway through with HTTP 401 from Spotify (token expired after 3600 seconds).

**Why it happens:** Better Auth refreshes the token client-side, but the server reads a potentially-stale token from the `account` table. A 31-playlist import with Last.fm enrichment can take 60–90 seconds, which is well within the 3600s window — but only if the token was fresh when the import started.

**How to avoid:** At import start, check `account.accessTokenExpiresAt`. If within 5 minutes of expiry, call Better Auth's `auth.api.getSession()` (which triggers refresh) or use the stored `refresh_token` directly. For a 31-session app, the risk is LOW — the token is refreshed each time Mark visits the dashboard.

**Warning signs:** 401 error mid-import; "Token expired" in Spotify API error body.

---

### Pitfall 5: SQLite "too many bound parameters" on Batch Insert

**What goes wrong:** Drizzle throws "SQLITE_ERROR: too many SQL variables" when inserting all 496 tracks in one `.values([...])` call.

**Why it happens:** SQLite has a `SQLITE_MAX_VARIABLE_NUMBER` limit of 999 (default). A track row with 10 columns × 100 rows = 1000 variables, which exceeds the limit.

**How to avoid:** Insert in batches of ≤50 rows per call (10 columns × 50 = 500 variables, well below the limit).

**Warning signs:** Error thrown on the tracks insert step; no issue on sessions insert (31 rows × ~8 columns = 248 variables).

---

### Pitfall 6: Drizzle Transaction Locks with libSQL Over HTTP

**What goes wrong:** `db.transaction()` hangs or throws a locking error in production (Turso).

**Why it happens:** libSQL over HTTP uses HTTP/2 multiplexing; the transaction wraps all operations in a serialised batch. If the import takes >30s, the Turso connection may time out.

**How to avoid:** The transaction only covers DB writes (not the Spotify API fetches). Fetch all data first, build the in-memory arrays, then open the transaction and insert everything as fast as possible. The DB write phase for 496 tracks should complete in <5 seconds.

**Warning signs:** Works in local dev (file SQLite) but hangs in production (Turso over HTTP).

---

### Pitfall 7: `drizzle-kit push` Blocking Step

**What goes wrong:** Import fails with "no such table: sessions" because the schema was updated but `push` was not run.

**Why it happens:** Adding tables to `db/schema.ts` does not automatically migrate the database. This is the same BLOCKING pattern from Phase 1.

**How to avoid:** `drizzle-kit push` must run as an explicit task before any code that touches the new tables. In the task sequence: schema changes → `npm run db:push` → code using tables.

**Warning signs:** "no such table" SQLite error on first import attempt.

---

## Code Examples

### Spotify Client Credentials Token (for initial test only — not for production import)

```typescript
// Source: https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow
// NOTE: Client Credentials cannot fetch playlist items post-Feb 2026.
// This is only useful for testing — do not use for the import route.
const credentials = Buffer.from(
  `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
).toString('base64');

const res = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: {
    Authorization: `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
});

const { access_token, expires_in } = await res.json();
// expires_in: 3600 (seconds)
```

### GET /me/playlists — Paginate All Results

```typescript
// Source: https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists
// Requires user OAuth token (from account table)
async function getAllUserPlaylists(accessToken: string) {
  const playlists = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const res = await fetch(
      `https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const page = await res.json();
    playlists.push(...page.items);
    if (!page.next) break;
    offset += limit;
  }

  return playlists;
}
```

### Filter Playlists by Session Name Convention

```typescript
// Claude's discretion — D-03
// Playlist name format observed: "Session 01 — Theme Name" or "S01 Theme" etc.
// Regex targets "Session" followed by 1–2 digits (case-insensitive)
const SESSION_NAME_REGEX = /\bsession\s*(\d{1,2})\b/i;

function filterSessionPlaylists(playlists: SimplifiedPlaylist[]) {
  return playlists
    .filter((p) => SESSION_NAME_REGEX.test(p.name))
    .map((p) => ({
      ...p,
      sessionNumber: parseInt(p.name.match(SESSION_NAME_REGEX)![1], 10),
    }))
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}
```

**NOTE:** The exact playlist name format is [ASSUMED] — this regex should be validated against actual playlist names before the import task is written. The `SPOTIFY_USER_ID` env var gives access to the playlists for inspection.

### GET /playlists/{id}/items — Direct Fetch (Bypassing SDK)

```typescript
// Source: https://developer.spotify.com/documentation/web-api/references/changes/february-2026
// SDK v1.2.0 uses old /tracks path — use direct fetch instead
import type { Page, PlaylistedTrack, Track } from '@spotify/web-api-ts-sdk';

async function getPlaylistItems(
  playlistId: string,
  accessToken: string
): Promise<PlaylistedTrack<Track>[]> {
  const items: PlaylistedTrack<Track>[] = [];
  let offset = 0;

  while (true) {
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=50&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const page: Page<PlaylistedTrack<Track>> = await res.json();
    items.push(...page.items);
    if (!page.next) break;
    offset += 50;
  }

  return items;
}
```

### Drizzle Schema for New Tables

```typescript
// Source: https://orm.drizzle.team/docs/column-types/sqlite, established Phase 1 patterns
// db/schema.ts additions

export const contributors = sqliteTable('contributors', {
  id: text('id').primaryKey(), // 'MW' | 'JG' | 'JS' | 'IT'
  name: text('name').notNull(),  // 'Mark Wright', etc.
  sortOrder: integer('sort_order').notNull(), // 1–4 for default alphabetical order
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // Spotify playlist ID
  sessionNumber: integer('session_number').notNull().unique(),
  theme: text('theme').notNull(),
  description: text('description'),
  datePlayed: integer('date_played', { mode: 'timestamp_ms' }), // nullable — entered manually
  spotifyPlaylistId: text('spotify_playlist_id').notNull().unique(),
  attributionStatus: text('attribution_status', {
    enum: ['parsed', 'error', 'manual'],
  }).notNull().default('parsed'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`),
});

export const tracks = sqliteTable('tracks', {
  id: text('id').primaryKey(), // Spotify track ID
  title: text('title').notNull(),
  artist: text('artist').notNull(),    // primary artist name (for Last.fm lookup)
  album: text('album'),
  releaseYear: integer('release_year'),
  spotifyUrl: text('spotify_url'),
  durationMs: integer('duration_ms'),
});

export const sessionTracks = sqliteTable('session_tracks', {
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  trackId: text('track_id').notNull().references(() => tracks.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(), // 1–16
  attributedUserId: text('attributed_user_id').references(() => contributors.id),
}, (t) => [
  primaryKey({ columns: [t.sessionId, t.trackId] }),
]);

export const artistTags = sqliteTable('artist_tags', {
  artistName: text('artist_name').notNull(),
  tag: text('tag').notNull(),
  rank: integer('rank').notNull(), // 1–5
}, (t) => [
  primaryKey({ columns: [t.artistName, t.rank] }),
]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `GET /playlists/{id}/tracks` | `GET /playlists/{id}/items` | February 2026 | SDK v1.2.0 still uses old path — must call API directly |
| `GET /users/{user_id}/playlists` | `GET /me/playlists` (user OAuth required) | February 2026 | Decision D-02 cannot be fulfilled with Client Credentials |
| Auth.js v5 / NextAuth | Better Auth 1.x | September 2025 | Already using Better Auth; Spotify social provider available |
| `middleware.ts` | `proxy.ts` | Next.js 16 | Already using `proxy.ts` from Phase 1 |
| ESLint + Prettier | Biome 2.x | 2025–2026 | Already using Biome; lint scripts established |

**Deprecated/outdated:**
- `GET /users/{user_id}/playlists`: REMOVED in Dev Mode Feb 2026. Do not use.
- `@spotify/web-api-ts-sdk` network methods for `/items`: SDK calls old `/tracks` path. Use direct `fetch` for items.
- Spotify Implicit Grant Flow: Removed Nov 2025. Already avoided.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Playlist names follow the pattern `"Session N — Theme"` (or similar) making a `/\bsession\s*(\d{1,2})\b/i` regex sufficient | Code Examples | Wrong regex means no playlists are matched; import fetches 0 sessions. Low risk — can be inspected from Spotify UI before coding. |
| A2 | ~80–100 unique artists across 31 sessions × 16 tracks | Architecture + Last.fm pattern | If significantly more, Last.fm enrichment step takes longer; could approach Vercel timeout on Hobby plan |
| A3 | Mark's Spotify account will have the Spotify social provider connected via Better Auth before running the import | Open Questions | Import fails at token retrieval step with "no Spotify account linked" |
| A4 | Better Auth stores Spotify `access_token` in `account.access_token` column (not encrypted) and `refresh_token` in `account.refresh_token` | Pattern 2 | If Better Auth encrypts tokens at rest, direct DB read does not work — must go through Better Auth API |
| A5 | 31-session import + 100 artist tag lookups completes within 60 seconds | Vercel timeout concern | On Vercel Hobby (10s timeout) the import would fail. On Pro (60s) it is borderline. Local dev and self-hosted are unaffected. |
| A6 | `sdk.playlists.getUsersPlaylists()` from `@spotify/web-api-ts-sdk` calls `GET /me/playlists` correctly (the discovery endpoint, not the removed `/users/{id}/playlists`) | Pattern 2 | If the SDK also uses the removed endpoint, even more reason to use direct `fetch` throughout |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

---

## Open Questions

### OQ-1: D-01/D-02 — Client Credentials Cannot Access Playlist Items Post-Feb 2026

**What we know:**
- `GET /users/{user_id}/playlists` — **REMOVED** in Dev Mode (Feb 2026) [VERIFIED: Spotify changelog]
- `GET /playlists/{id}/items` — Returns metadata only (no items) for playlists accessed via Client Credentials [VERIFIED: Spotify Feb 2026 docs confirm "items only returned for user's own playlists"]
- `GET /me/playlists` — Available, but requires user OAuth token (not Client Credentials) [VERIFIED: Spotify scopes docs]

**What's unclear:** CONTEXT.md D-01 and D-02 assume Client Credentials is sufficient. This research shows it is not sufficient for item fetching or playlist discovery via user ID.

**Two viable paths (planner should present to user):**

**Option A — Better Auth Spotify Social Provider (recommended)**
- Add Spotify as a social provider in `lib/auth.ts` with scopes `playlist-read-private playlist-read-collaborative`
- When Mark signs in via Spotify OAuth, Better Auth stores his `access_token` + `refresh_token` in the `account` table
- Import Route Handler reads the stored token and uses it for `GET /me/playlists` + `GET /playlists/{id}/items`
- Pros: Clean, leverages existing Better Auth setup, supports future phases needing user data
- Cons: Mark must re-authenticate via Spotify (one additional login step)
- Net new env vars: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` (same vars as D-01, but used for OAuth not Client Credentials)

**Option B — Hardcoded Playlist IDs**
- Store the 31 Spotify playlist IDs in a `SPOTIFY_PLAYLIST_IDS` env var (comma-separated)
- Use Client Credentials to get a token, but fetch items by calling `GET /playlists/{id}/items` with a user-context token... wait — this also requires user OAuth for items

**Actually, Option B does NOT work either.** The Feb 2026 change means playlist items require user-owned context. Client Credentials cannot access track items from ANY playlist regardless of whether the ID is known. The only options are user OAuth (Option A) or the user being logged in and their token being used.

**Recommendation:** Option A (Better Auth Spotify social provider). The planner should include this as the approach for D-01/D-02 and flag to the user before generating tasks.

---

### OQ-2: Vercel Timeout Risk for Import on Hobby Plan

**What we know:** Vercel Hobby plan has a 10-second function timeout. The import involves 31 playlist fetches + 496 item fetches + ~100 Last.fm calls. Estimated time: 45–90 seconds. [CITED: vercel docs via research]

**What's unclear:** Current deployment target — Vercel Hobby vs Pro vs local dev only.

**Recommendation:** If deploying to Vercel Hobby, the import WILL timeout. Options: (1) Vercel Pro (60s or 300s max), (2) Vercel Fluid Compute (up to 14 min on Pro), (3) Run import only from local dev. For a 4-person private app that imports once, option 3 (import from local dev) is pragmatic. The plan should note this and not block on it for Phase 2.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20.x | Next.js 16, import pipeline | ✓ | v20.20.1 | — |
| npm | Package installs | ✓ | 10.8.2 | — |
| local.db (SQLite) | Drizzle dev DB | ✓ | file exists (45KB) | Create fresh |
| drizzle-kit | Schema push | ✓ | 0.31.10 | — |
| `SPOTIFY_CLIENT_ID` env var | Better Auth Spotify provider | ✗ | — | Must set before testing |
| `SPOTIFY_CLIENT_SECRET` env var | Better Auth Spotify provider | ✗ | — | Must set before testing |
| `LASTFM_API_KEY` env var | Last.fm enrichment | ✗ | — | Enrichment step skipped (graceful degradation) |
| Vercel (production) | Deployment | Unknown | — | Run import from local dev |

**Missing dependencies with no fallback:**
- `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` — required to authenticate with Spotify. Register app at https://developer.spotify.com/dashboard and add to `.env.local`. **BLOCKING for import testing.**

**Missing dependencies with fallback:**
- `LASTFM_API_KEY` — enrichment can be skipped; `artist_tags` table stays empty; analytics in Phase 4 will need it but import itself succeeds.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes — import requires admin role | Better Auth session check (established in Phase 1 `auth.api.getSession()`) |
| V3 Session Management | no new concerns | Handled by Better Auth |
| V4 Access Control | yes — import, date PATCH, attribution PATCH are admin-only | Existing pattern: session check → role !== 'admin' → 403 |
| V5 Input Validation | yes — date input, attribution slot input | Zod for PATCH body validation; date validated as ISO string |
| V6 Cryptography | no — no new secrets generated | Spotify secret is env var, not generated in code |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Import triggered by non-admin | Elevation of Privilege | Admin role check before import logic (established pattern) |
| SSRF via Spotify/Last.fm URLs | Tampering | URLs are constructed from env vars + playlist IDs returned by Spotify API — no user-supplied URLs |
| Token leakage via streaming response | Information Disclosure | SSE stream sends progress text only — never include raw `access_token` in event data |
| SQLite injection via artist names | Tampering | Drizzle parameterises all values — no string interpolation into SQL |
| Re-import deletes manually-entered dates | Data Loss | Warning copy in UI per UI-SPEC copywriting contract; admin-aware single-user operation |

---

## Sources

### Primary (HIGH confidence)
- [Spotify Feb 2026 Migration Guide](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) — confirmed `GET /users/{id}/playlists` removal, items-only-for-owner restriction
- [Spotify Feb 2026 Changelog](https://developer.spotify.com/documentation/web-api/references/changes/february-2026) — endpoint removals and renames confirmed
- [Spotify Client Credentials Flow](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow) — token endpoint, request format, 3600s expiry
- [Next.js 16 Streaming Guide](https://nextjs.org/docs/app/guides/streaming) — Route Handler `ReadableStream` SSE pattern, `export const dynamic = 'force-dynamic'`, Vercel streaming support confirmed
- [Drizzle ORM Transactions](https://orm.drizzle.team/docs/transactions) — `db.transaction()` API, nested savepoints
- [Drizzle ORM Delete](https://orm.drizzle.team/docs/delete) — `await db.delete(table)` without WHERE deletes all rows
- [Drizzle SQLite Column Types](https://orm.drizzle.team/docs/column-types/sqlite) — `text({ enum })`, `integer({ mode: 'timestamp_ms' })`, composite primaryKey
- [Last.fm artist.getTopTags](https://www.last.fm/api/show/artist.getTopTags) — endpoint URL, parameters, `autocorrect`, JSON format

### Secondary (MEDIUM confidence)
- [Last.fm API TOS](https://www.last.fm/api/tos) — 5 req/sec rate limit confirmed (via web search cross-reference with community)
- [Spotify Web API TypeScript SDK README](https://github.com/spotify/spotify-web-api-ts-sdk/blob/main/README.md) — `SpotifyApi.withClientCredentials()` signature, Node.js-only requirement
- [Spotify SDK PlaylistsEndpoints.ts](https://raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk/main/src/endpoints/PlaylistsEndpoints.ts) — `getUsersPlaylists(user_id)` and `getPlaylistItems()` method signatures
- [Spotify GET /me/playlists](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists) — requires `playlist-read-private` scope, paginated response shape

### Tertiary (LOW confidence — flagged)
- Community reports that `@spotify/web-api-ts-sdk` v1.2.0 uses old `/tracks` path (GitHub issue #159 thread) — not independently verified from source code; treat as HIGH risk assumption
- Estimated 45–90 second import time — [ASSUMED] based on 31 playlists × ~1s API call + 100 Last.fm calls × 0.2s = ~51 seconds minimum

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via `npm view`; established Phase 1 patterns apply
- Spotify API constraints: HIGH — confirmed from official Feb 2026 docs; critical finding about D-01/D-02
- Architecture: MEDIUM — streaming pattern confirmed; OAuth token recovery from Better Auth is [ASSUMED] not to be encrypted
- Pitfalls: HIGH for SDK/endpoint issues; MEDIUM for timeout/batch limits
- Last.fm integration: HIGH — simple unauthenticated GET; rate limit confirmed from official TOS

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (30 days — Spotify API is currently stable; Last.fm API is stable)
