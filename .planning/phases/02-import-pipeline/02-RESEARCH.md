# Phase 2: Import Pipeline - Research

**Researched:** 2026-06-12
**Domain:** Apple Music API (MusicKit JS v3), Last.fm API, Drizzle ORM batch operations, Next.js streaming responses
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use MusicKit JS (browser-based) — Mark authorises once via `MusicKit.getInstance().authorize()` in the ImportTriggerCard. The user music token is sent to a server-side API route which calls Apple Music API on his behalf.
- **D-02:** Identify playlists via `GET /v1/me/library/playlists` (user-authenticated, paginated). Filter by naming convention to identify the 31 sessions.
- **D-03:** Session name pattern matching: Claude's discretion — extract session number from playlist name using regex; theme from description.
- **D-04:** Re-import behaviour: replace-all — on each import trigger, truncate `session_tracks`, `tracks`, and `sessions` tables then re-insert. Simple, safe, admin-only.
- **D-05:** Apple Music developer token: JWT signed with ES256, generated server-side from the Apple Developer key (`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` env vars). Short-lived token (max 6 months, generated fresh per import run via `jose`).
- **D-06 (genre):** Use Last.fm `artist.getTopTags` endpoint — free, no auth, returns community folksonomy tags. `LASTFM_API_KEY` env var.
- **D-07:** Enrich per unique artist (deduplicated across all tracks) — one API call per unique artist.
- **D-08:** Store top 5 tags per artist in an `artist_tags` table. Tags reused across all tracks by that artist.
- **D-09:** Enrich during import — after all tracks are inserted, run enrichment in the same request chain. No separate "enrich" button.
- **D-10:** Date entry lives on `/dashboard` as an inline table — all 31 sessions visible with a native `<input type="date">` per row, saved on blur/Enter. No separate page.
- **D-11:** Attribution error display — a warning card section on `/dashboard` lists sessions where the description did not contain a valid initials string. Admin can manually assign contributor order via a slot-based UI.
- **D-12:** The contributor order follows the project rule: theme-chooser first, then alphabetical surname (Groves, Slade, Thomas, Wright). Mark's initials are MW, Jack's JG, Jon's JS, Iwan's IT.

### Claude's Discretion

- Exact regex pattern for matching session playlists from the user's Apple Music library
- Rate limiting strategy for Last.fm API (max 5 req/sec)
- Exact Drizzle schema for `sessions`, `tracks`, `session_tracks`, `contributors`, `artist_tags` tables
- Error handling when individual playlist or track fetches fail
- MusicKit JS version to load (use v3 from `js-cdn.music.apple.com/musickit/v3/musickit.js` per CLAUDE.md)

### Deferred Ideas (OUT OF SCOPE)

- Spotify import — deferred; Spotify Client Credentials broken by Feb 2026 Dev Mode changes; user OAuth requires Premium (Mark has none). Spotify track IDs for Phase 3 links if needed.
- Advanced import scheduling / background jobs — not needed for 31-session one-time import
- CSV export of imported data — out of scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMPORT-01 | Admin user can connect Apple Music via MusicKit JS (pivot from Spotify) | MusicKit JS v3 CDN + `authorize()` flow documented; user music token passed to server route |
| IMPORT-02 | App can import all playlists matching the session naming convention | `GET /v1/me/library/playlists` pagination pattern; regex filter on playlist name |
| IMPORT-03 | App parses contributor order from playlist description initials (e.g. "MW, JG, JS, IT") | Description lives at `attributes.description.standard` (nested object); Zod regex validation pattern |
| IMPORT-04 | App correctly handles the theme-chooser-first ordering rule when assigning attribution | First initials string entry = tracks 1–4; no special API call — pure JS ordering logic |
| IMPORT-05 | Admin user can enter or edit the date for each session via the dashboard | PATCH API route + shadcn Table with native date inputs; inline save pattern |
| IMPORT-06 | App fetches genre/artist tags from Last.fm for each track's primary artist | Last.fm `artist.getTopTags` — free, no auth; 5 req/sec limit; response always 200, check body |
| IMPORT-07 | Admin user can connect Apple Music via MusicKit JS and import the 31 sessions | This IS the primary import; MusicKit JS v3 browser flow + server-side Apple Music API proxy |
| IMPORT-08 | App gracefully flags sessions where description doesn't contain a valid initials string | Sessions stored with `attributionParsed: false`; shown in Attribution Error Card on dashboard |
</phase_requirements>

---

## Summary

Phase 2 builds the data import pipeline that populates the database from Mark's Apple Music library. The flow has three distinct tiers: (1) a browser-side MusicKit JS v3 authorization step where Mark authenticates with Apple Music and obtains a Music User Token; (2) a server-side Next.js API route that receives the user token, generates a developer JWT via `jose`, and calls the Apple Music API to fetch all 31 session playlists and their 16 tracks each; (3) a Last.fm enrichment pass that tags each unique artist with up to 5 community-generated genre tags.

The technical domain is well-understood but has two specific pitfalls worth highlighting. First, MusicKit JS is strictly browser-only — the CDN script registers `window.MusicKit` and must be loaded in a Client Component; the Music User Token it produces is then forwarded to a server route where all Apple Music API calls happen. Second, the library-songs resource returned by the tracks endpoint does not include ISRC; to get catalog-level metadata (ISRC, release year), the tracks fetch must include `?include=catalog` to pull the related catalog song object alongside each library song.

The import pipeline uses Server-Sent Events (SSE) via a `ReadableStream` response to push progress updates back as each playlist is processed. The Vercel Hobby plan's default function timeout is 300 seconds (confirmed from 2026-05-14 Vercel docs — significantly more than older articles claimed), which is ample for 31 sequential playlist fetches. SSE is still the right pattern for UX responsiveness regardless of the timeout headroom.

**Primary recommendation:** Load MusicKit JS v3 in a `"use client"` component, get the Music User Token via `MusicKit.getInstance().authorize()`, POST it to `/api/import`, then server-side iterate playlists and tracks using the two-header Apple Music API pattern (`Authorization: Bearer <devtoken>` + `Music-User-Token: <usertoken>`). No new npm packages needed — `jose` is already installed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MusicKit JS load + configure | Browser / Client | — | CDN script sets `window.MusicKit`; cannot run server-side |
| Apple Music user authorization | Browser / Client | — | `authorize()` opens Apple's popup; requires user interaction |
| Developer JWT generation (ES256) | API / Backend | — | Private key must never be exposed client-side |
| Apple Music API calls (playlists, tracks) | API / Backend | — | Two-header auth requires developer token which is server-only |
| Last.fm enrichment | API / Backend | — | Server-to-server; no user credential needed |
| Database writes (sessions, tracks, tags) | API / Backend | Database / Storage | Drizzle ORM batch insert via libSQL |
| Import progress feedback | API / Backend | Browser / Client | SSE ReadableStream pushes progress events; client reads via `getReader()` |
| Session date entry | Browser / Client | API / Backend | Client date input triggers PATCH to `/api/sessions/[id]` |
| Attribution error display | Browser / Client | API / Backend | Dashboard reads sessions with `attributionParsed = false` from DB |
| Developer token vending | API / Backend | — | `/api/apple-token` GET returns short-lived JWT to browser for MusicKit.configure |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `jose` | ^6.2.3 (installed) | ES256 JWT signing for Apple developer token | Official panva/jose library [VERIFIED: npm registry] [OK] slopcheck; panva is the de facto JOSE standard for Node.js; already in project |
| MusicKit JS v3 | CDN (no npm pkg) | Browser-based Apple Music authorization + user token | Apple's official web SDK; no npm equivalent — load via script tag |
| `zod` | ^4.0.0 (installed) | Parse and validate playlist description, session metadata | Already in project; v4 is 14x faster than v3; Zod `.safeParse()` essential for untyped API responses |
| `drizzle-orm` | 0.45.2 (installed) | Database ORM — batch insert, delete, select | Already in project; `db.batch()` supports implicit transaction for truncate + re-insert pattern |

### No New Packages Required

All libraries needed for Phase 2 are already installed in the project. The only new integration is the MusicKit JS CDN script (not an npm package).

### Supporting (already installed, no changes needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@libsql/client` | 0.17.3 | libSQL driver for Drizzle | Required for `db.batch()` and all DB operations |
| `lucide-react` | ^1.18.0 | Icons in ImportTriggerCard states | Loader2, Check, AlertCircle icons |
| `sonner` | ^1.7.4 | Toast notifications for import outcomes | Import success/failure toasts |
| `better-auth` | 1.6.17 | Session gate for import route | `auth.api.getSession()` guard already established in Phase 1 |

### Installation

No new packages to install for Phase 2.

---

## Package Legitimacy Audit

No new packages are introduced in Phase 2. All packages carry their Phase 1 legitimacy status.

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| `jose` | npm | [OK] | Approved — already installed |
| `zod` | npm | [OK] | Approved — already installed |
| `drizzle-orm` | npm | [OK] | Approved — already installed |
| `better-auth` | npm | [OK] | Approved — already installed |
| `next` | npm | [OK] | Approved — already installed |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (Client Component: ImportTriggerCard)
  │
  │  1. GET /api/apple-token  →  short-lived developer JWT
  │  2. Load MusicKit JS v3 CDN (next/script, strategy="afterInteractive")
  │  3. window.MusicKit.configure({ developerToken })
  │  4. window.MusicKit.getInstance().authorize()  →  Music User Token
  │
  │  POST /api/import { musicUserToken }
  ▼
Next.js API Route (/api/import) — ReadableStream SSE
  │
  ├── Auth gate: session check → 401 / role check → 403
  ├── Generate developer JWT (jose ES256, server-side env vars)
  │
  ├── GET /v1/me/library/playlists (paginate limit=100)
  │   Filter: name matches session naming convention
  │   → 31 matched playlists
  │
  ├── For each playlist (31 iterations):
  │   ├── GET /v1/me/library/playlists/{id}/tracks?include=catalog&limit=100
  │   ├── Extract: name, artistName, albumName, durationMs, trackNumber
  │   ├── Extract: catalog.attributes.isrc, catalog.attributes.releaseDate
  │   ├── Parse: attributes.description?.standard  →  initials regex
  │   └── SSE event: { type: "progress", stage: "tracks", current: N, total: 31 }
  │
  ├── db.batch([delete artistTags, sessionTracks, tracks, sessions])
  ├── db.insert(sessions).values([...31])
  ├── db.insert(contributors).values([...4]) onConflictDoNothing
  ├── db.insert(tracks).values([...~496])
  ├── db.insert(sessionTracks).values([...~496])
  │
  ├── Deduplicate artists (~50–150 unique)
  └── For each unique artist:
      ├── GET last.fm artist.gettoptags (4 req/sec, 250ms delay)
      ├── db.insert(artistTags).values([top 5 tags])
      └── SSE event: { type: "progress", stage: "enriching", current: N, total: M }
  
  SSE event: { type: "complete", sessions: 31, tracks: N }
  Stream closes
  ▼
Browser: updates progress bar, status line, shows completion summary
```

### Recommended Project Structure (Phase 2 additions)

```
app/
├── api/
│   ├── import/
│   │   └── route.ts           # Replace Phase 1 stub — SSE streaming import handler
│   ├── apple-token/
│   │   └── route.ts           # GET — returns short-lived developer JWT (admin only)
│   └── sessions/
│       └── [id]/
│           └── route.ts       # PATCH — save date for a session (inline date entry)
├── dashboard/
│   └── page.tsx               # Extended: session date table + attribution error card
components/
├── ImportTriggerCard.tsx       # Replace: add progress bar, SSE stream reader, status line
├── AttributionErrorCard.tsx   # New: sessions with attributionParsed=false
└── SessionDateTable.tsx       # New: 31-row table with inline date inputs
db/
└── schema.ts                  # Extend: sessions, tracks, session_tracks, contributors, artist_tags
lib/
└── apple-dev-token.ts         # New: jose ES256 token generation (server-only)
```

### Pattern 1: Developer Token Generation (server-side only)

**Source:** [panva/jose discussions #158](https://github.com/panva/jose/discussions/158) [VERIFIED: confirmed via WebFetch]

```typescript
// lib/apple-dev-token.ts
import { SignJWT } from "jose";
import { createPrivateKey } from "crypto";

export async function generateAppleDeveloperToken(): Promise<string> {
  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!rawKey) throw new Error("APPLE_PRIVATE_KEY env var is not set");

  // .replace(/\\n/g, "\n") is critical: env vars store \n as literal two chars
  const privateKey = createPrivateKey(rawKey.replace(/\\n/g, "\n"));

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}
```

### Pattern 2: Apple Music API Two-Header Fetch (server-side)

**Source:** [Apple Developer Documentation — Apple Music API](https://developer.apple.com/documentation/applemusicapi/) [CITED: developer.apple.com/documentation/applemusicapi]

```typescript
const AM_BASE = "https://api.music.apple.com/v1";

async function appleGet(path: string, devToken: string, userToken: string) {
  const res = await fetch(`${AM_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${devToken}`,
      "Music-User-Token": userToken,
    },
  });
  if (!res.ok) throw new Error(`Apple Music API ${res.status} on ${path}`);
  return res.json();
}
```

### Pattern 3: Paginate All Library Playlists

**Source:** [Apple Developer Forums thread/704994](https://developer.apple.com/forums/thread/704994) [CITED: developer.apple.com/forums]

```typescript
async function fetchAllLibraryPlaylists(devToken: string, userToken: string) {
  const all: ApplePlaylist[] = [];
  let offset = 0;
  const limit = 100; // [ASSUMED] max per request per forum reports

  while (true) {
    const page = await appleGet(
      `/me/library/playlists?limit=${limit}&offset=${offset}`,
      devToken,
      userToken
    ) as { data: ApplePlaylist[]; next?: string };

    all.push(...page.data.filter((p) => p.attributes?.name)); // filter phantom records
    if (!page.next || page.data.length < limit) break;
    offset += limit;
  }

  return all;
}
```

### Pattern 4: Fetch Playlist Tracks with Catalog Relationship

**Source:** [Apple Developer Forums thread/688774](https://developer.apple.com/forums/thread/688774) [CITED: developer.apple.com/forums] — catalog include for ISRC
**Source:** [Apple Developer Forums thread/132606](https://developer.apple.com/forums/thread/132606) [CITED: developer.apple.com/forums] — ISRC not on library-songs directly

```typescript
async function fetchPlaylistTracks(
  playlistId: string,
  devToken: string,
  userToken: string
) {
  const all: AppleLibrarySong[] = [];
  let offset = 0;

  while (true) {
    const page = await appleGet(
      `/me/library/playlists/${playlistId}/tracks?include=catalog&limit=100&offset=${offset}`,
      devToken,
      userToken
    ) as { data: AppleLibrarySong[]; next?: string };

    all.push(...page.data);
    if (!page.next || page.data.length < 100) break;
    offset += 100;
  }

  return all;
}
```

**Key insight on `include=catalog`:**
- `library-songs` do NOT have ISRC directly [VERIFIED: Apple Staff confirmed in forums thread/132606]
- `include=catalog` returns the related catalog song nested in `relationships.catalog.data[0]`
- Catalog song has `attributes.isrc`, `attributes.releaseDate`, `attributes.genreNames`
- Library song has `attributes.name`, `attributes.artistName`, `attributes.albumName`, `attributes.trackNumber`, `attributes.durationInMillis`

### Pattern 5: MusicKit JS v3 Browser Initialization

**Source:** [gutta.medium.com](https://gutta.medium.com/using-musickitjs-to-integrate-your-web-application-with-apple-music-35740723221e) [CITED]; [CLAUDE.md CDN URL]; [nextjs.org/docs Script component](https://nextjs.org/docs/app/api-reference/components/script) [CITED]

```typescript
// Inside ImportTriggerCard ("use client")
// Step 1: Fetch developer token from server (admin-only GET route)
const { token: devToken } = await fetch("/api/apple-token").then((r) => r.json());

// Step 2: Load MusicKit via next/script in JSX:
// <Script
//   src="https://js-cdn.music.apple.com/musickit/v3/musickit.js"
//   strategy="afterInteractive"
//   onLoad={() => setMusicKitReady(true)}
// />

// Step 3: On button click (user gesture required for popup)
async function handleConnectAppleMusic() {
  await window.MusicKit.configure({
    developerToken: devToken,
    app: { name: "Warwick Massive Tunage", build: "1.0" },
  });
  const musicUserToken = await window.MusicKit.getInstance().authorize();
  // Step 4: POST to /api/import with the user token
  await startImport(musicUserToken);
}
```

### Pattern 6: SSE Streaming Import Response

**Source:** [nextjs.org/docs/app/guides/streaming](https://nextjs.org/docs/app/guides/streaming) [CITED]; [vercel.com/docs/functions/configuring-functions/duration](https://vercel.com/docs/functions/configuring-functions/duration) [VERIFIED: confirmed from 2026-05-14 Vercel docs]

```typescript
// app/api/import/route.ts
export const maxDuration = 300; // Explicit — matches Vercel Hobby default

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

  const { musicUserToken } = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        // ... import logic calling send() for each progress event
        send({ type: "complete", sessions: 31, tracks: 496 });
      } catch (err) {
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Client-side SSE reader pattern:**
```typescript
const res = await fetch("/api/import", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ musicUserToken }),
});
const reader = res.body!.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  for (const line of decoder.decode(value).split("\n")) {
    if (line.startsWith("data: ")) {
      const event = JSON.parse(line.slice(6));
      // Update React state: progress, status text, completion summary
    }
  }
}
```

### Pattern 7: Drizzle Batch Replace-All

**Source:** [orm.drizzle.team/docs/batch-api](https://orm.drizzle.team/docs/batch-api) [VERIFIED: confirmed via WebFetch]; [orm.drizzle.team/docs/delete](https://orm.drizzle.team/docs/delete) [VERIFIED]

```typescript
// Delete in reverse FK dependency order (child rows first)
await db.batch([
  db.delete(schema.artistTags),
  db.delete(schema.sessionTracks),
  db.delete(schema.tracks),
  db.delete(schema.sessions),
  // contributors NOT deleted — seeded once, never re-deleted
]);

// Insert in FK dependency order; guard empty arrays
if (sessions.length > 0) await db.insert(schema.sessions).values(sessions);
await db.insert(schema.contributors).values(contributors).onConflictDoNothing();
if (tracks.length > 0) await db.insert(schema.tracks).values(tracks);
if (sessionTracks.length > 0) await db.insert(schema.sessionTracks).values(sessionTracks);
if (artistTags.length > 0) await db.insert(schema.artistTags).values(artistTags);
```

### Pattern 8: Last.fm Rate-Limited Enrichment

**Source:** [lastfm-docs.github.io/api-docs/artist/getTopTags](https://lastfm-docs.github.io/api-docs/artist/getTopTags/) [CITED]

```typescript
const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";
const RATE_DELAY_MS = 250; // 4 req/sec — safely under 5/sec ToS limit

async function fetchArtistTags(artistName: string): Promise<string[]> {
  const url = new URL(LASTFM_BASE);
  url.searchParams.set("method", "artist.gettoptags");
  url.searchParams.set("artist", artistName);
  url.searchParams.set("api_key", process.env.LASTFM_API_KEY!);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");

  const res = await fetch(url.toString());
  const data = await res.json() as {
    toptags?: { tag: { name: string; count: number }[] };
    error?: number;
  };

  // Last.fm returns HTTP 200 even for errors — always check body
  if (data.error || !data.toptags) return [];
  return data.toptags.tag.slice(0, 5).map((t) => t.name.toLowerCase());
}
```

### Pattern 9: Description Parsing (Zod + Regex)

**Source:** Description field path confirmed from Apple forums; Zod v4 [VERIFIED: npm registry]

```typescript
// Apple Music description lives at: attributes.description?.standard
// Example: "Session 07 — Desert Island Discs — MW, JG, JS, IT"
// The initials pattern matches: two uppercase letters × 4, comma-separated

const INITIALS_RE = /\b([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2})\b/;
const SESSION_NUM_RE = /\b(\d+)\b/;

const KNOWN_CONTRIBUTORS: Record<string, string> = {
  MW: "Mark Wright",
  JG: "Jack Groves",
  JS: "Jon Slade",
  IT: "Iwan Thomas",
};

function parsePlaylistDescription(
  name: string,
  description: string | undefined
): { sessionNumber: number; theme: string; initials: string[] | null } {
  const numMatch = name.match(SESSION_NUM_RE);
  const sessionNumber = numMatch ? parseInt(numMatch[1], 10) : 0;
  const theme = name.replace(/session\s*\d+\s*[-—]?\s*/i, "").trim();

  const initialsMatch = description?.match(INITIALS_RE);
  const initials = initialsMatch
    ? [initialsMatch[1], initialsMatch[2], initialsMatch[3], initialsMatch[4]]
    : null; // null → attributionParsed = false (IMPORT-08)

  return { sessionNumber, theme, initials };
}
```

### Anti-Patterns to Avoid

- **Calling Apple Music API from the browser**: MusicKit JS `authorize()` must run browser-side, but all subsequent API calls go through the Next.js server route — never expose the developer token to the client
- **Using `middleware.ts`**: Deprecated in Next.js 16; use `proxy.ts` (established in Phase 1)
- **Synchronous import response**: Fetching 31 playlists + 496 tracks + Last.fm enrichment in a non-streaming POST response blocks the UI and risks UX degradation; use SSE
- **Re-using Music User Token across imports**: Call `authorize()` fresh each time; do not store the user token in the DB
- **`db.insert().values([])`**: Drizzle may throw on empty arrays — always guard with `if (arr.length > 0)`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT signing | Custom HMAC/ECDSA code | `jose` SignJWT (already installed) | ES256 key parsing, header encoding, and claim serialization have subtle correctness requirements |
| Apple Music API HTTP client | Full SDK wrapper | Thin `appleGet()` function around `fetch` | At 31 playlists × 16 tracks, a simple fetch loop is sufficient; no retry library needed |
| SSE client parsing | Custom EventSource | `ReadableStream.getReader()` | EventSource doesn't support POST requests; manual reader is the correct pattern for POST-triggered SSE |
| Rate limiting | Token bucket / queue library | `await new Promise((r) => setTimeout(r, 250))` in loop | ~50–150 unique artists at 4 req/sec = under 40 seconds; setTimeout loop is correct at this scale |
| API response validation | Manual `if` type-narrowing | Zod `z.object().safeParse()` (already installed) | Apple Music API has no TypeScript SDK; Zod gives type-safe partial parsing with graceful failures |

**Key insight:** This is a one-time admin operation for ~500 tracks. Sophisticated infrastructure (job queues, retry libraries, SDK wrappers) is engineering overhead that adds no value at this scale.

---

## Common Pitfalls

### Pitfall 1: Apple Private Key Newline Handling

**What goes wrong:** `createPrivateKey()` throws "PEM routines: bad end line" or "no start line".
**Why it happens:** The `.p8` file has literal newlines. When stored in `.env.local`, they become escaped `\n` sequences. Node's `crypto.createPrivateKey()` requires actual newline characters.
**How to avoid:** Call `.replace(/\\n/g, "\n")` on `process.env.APPLE_PRIVATE_KEY` before passing to `createPrivateKey()`.
**Warning signs:** `error:0909006C:PEM routines:get_name:no start line`

### Pitfall 2: MusicKit JS `window` Access During SSR

**What goes wrong:** `ReferenceError: window is not defined` when Next.js server-renders the component.
**Why it happens:** MusicKit JS v3 is browser-only; `window` doesn't exist in Node.js.
**How to avoid:** (a) Mark the component `"use client"`, (b) guard `window.MusicKit` access inside `useEffect` or after `onLoad` fires, (c) use `next/script` with `strategy="afterInteractive"`.
**Warning signs:** Server render error referencing `window` or `MusicKit`

### Pitfall 3: No TypeScript Types for MusicKit JS v3

**What goes wrong:** TypeScript errors when calling `window.MusicKit.*`.
**Why it happens:** There is no `@types/musickit-js` or official TypeScript package for MusicKit JS v3.
**How to avoid:** Add a minimal declaration in a `.d.ts` file:
```typescript
// types/musickit.d.ts
declare global {
  interface Window {
    MusicKit: {
      configure(config: { developerToken: string; app: { name: string; build: string } }): void;
      getInstance(): { authorize(): Promise<string>; isAuthorized: boolean };
    };
  }
}
export {};
```
**Warning signs:** `Property 'MusicKit' does not exist on type 'Window & typeof globalThis'`

### Pitfall 4: ISRC Not on library-songs

**What goes wrong:** Parsing Apple Music track responses and finding no ISRC field.
**Why it happens:** Library song resources (`library-songs` type) do not include ISRC — confirmed by Apple Staff in forums. [VERIFIED: thread/132606]
**How to avoid:** Always fetch tracks with `?include=catalog`. Access ISRC via `track.relationships?.catalog?.data?.[0]?.attributes?.isrc`.
**Warning signs:** `attributes.isrc` is `undefined` on all tracks

### Pitfall 5: Last.fm Returns HTTP 200 for All Responses

**What goes wrong:** An enrichment call returns 200 OK but tag data is missing.
**Why it happens:** Last.fm uses HTTP 200 for all responses including errors; the error is signalled by an `error` field in the JSON body. [CITED: lastfm-docs.github.io]
**How to avoid:** Always check `if (data.error)` before accessing `data.toptags`. If `error === 29` (rate limit), wait and retry.
**Warning signs:** `data.toptags` is undefined despite successful HTTP status

### Pitfall 6: Drizzle Insert with Empty Array

**What goes wrong:** `db.insert(table).values([])` throws a runtime error.
**Why it happens:** Drizzle ORM does not accept an empty array for `.values()`.
**How to avoid:** Guard every insert: `if (rows.length > 0) await db.insert(table).values(rows);`
**Warning signs:** `TypeError: Cannot read properties of undefined` during import

### Pitfall 7: `authorize()` Must Be Triggered by User Gesture

**What goes wrong:** Apple's authorization popup is silently blocked.
**Why it happens:** Modern browsers block popups unless triggered by a direct user interaction (click event).
**How to avoid:** Call `MusicKit.getInstance().authorize()` inside the `onClick` handler of the import button — never on mount or in `useEffect`.
**Warning signs:** No popup appears; no error thrown

### Pitfall 8: Phantom Playlists in Paginated Results

**What goes wrong:** Extra playlist entries with empty names appear in the paginated results.
**Why it happens:** Apple Music API may return "phantom" records to maintain pagination offset stability when playlists are deleted between paginated requests. [CITED: developer.apple.com/forums/thread/704994]
**How to avoid:** Filter out playlist records where `attributes?.name` is falsy before session number matching.
**Warning signs:** More than 31 playlists matching the session pattern; some with null names

---

## Code Examples

### Full Developer Token + Drizzle Schema

```typescript
// db/schema.ts — append to existing Better Auth tables
// Source: orm.drizzle.team/docs/column-types/sqlite [CITED]

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionNumber: integer("session_number").notNull().unique(),
  theme: text("theme").notNull(),
  date: integer("date", { mode: "timestamp_ms" }), // nullable — manual input
  description: text("description"),
  attributionParsed: integer("attribution_parsed", { mode: "boolean" })
    .notNull()
    .default(true), // false → shown in Attribution Error Card
  appleMusicPlaylistId: text("apple_music_playlist_id"),
});

export const contributors = sqliteTable("contributors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  initials: text("initials").notNull().unique(), // MW, JG, JS, IT
  name: text("name").notNull(),
  userId: text("user_id").references(() => user.id),
});

export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appleId: text("apple_id"), // catalog song ID (from catalog relationship)
  spotifyId: text("spotify_id"), // null until Phase 3
  isrc: text("isrc"), // from catalog relationship; nullable
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  albumName: text("album_name"),
  releaseYear: integer("release_year"),
  durationMs: integer("duration_ms"),
});

export const sessionTracks = sqliteTable("session_tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  trackId: integer("track_id")
    .notNull()
    .references(() => tracks.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // 1–16
  attributedContributorId: integer("attributed_contributor_id")
    .references(() => contributors.id),
});

export const artistTags = sqliteTable("artist_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  artistName: text("artist_name").notNull(),
  tag: text("tag").notNull(),
  rank: integer("rank").notNull(), // 1 = top tag
});
```

### env.local additions

```bash
# Apple Music Developer Token — from Apple Developer portal
APPLE_TEAM_ID=YOUR_TEAM_ID           # 10-character string
APPLE_KEY_ID=YOUR_KEY_ID             # Key identifier from MusicKit key
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIGH...\n-----END PRIVATE KEY-----"
# Store the .p8 file content with \n in place of real newlines

# Last.fm API
LASTFM_API_KEY=your_lastfm_api_key
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spotify as primary import source | Apple Music via MusicKit JS v3 | 2026-06-12 (phase pivot) | All import logic targets Apple Music; Spotify deferred to Phase 3 |
| Vercel Hobby 10s timeout (older articles) | Vercel Hobby 300s default [VERIFIED: 2026-05-14 docs] | 2025 Vercel fluid compute update | Import can complete synchronously for 31 sessions; SSE is for UX not survival |
| MusicKit JS v1/v2 `musickitloaded` event | v3 `next/script` `onLoad` callback | MusicKit v3 release | Cleaner integration with Next.js Script component |
| `middleware.ts` | `proxy.ts` (Next.js 16) | Next.js 16 | Phase 1 already migrated |

**Deprecated/outdated:**

- Spotify import via Client Credentials: No longer works post-Feb 2026 for playlist items in Dev Mode
- `musicKit.api.library.playlists(null)` (v1/v2 API): v3 preferred pattern is passthrough `musicKit.api.music('/v1/me/library/playlists', { limit: 100 })` — both may work, passthrough is canonical for v3

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Max limit per paginated request is 100 items for library playlists and tracks | Patterns 3, 4 | If actual limit is lower (e.g. 25), more requests needed; pagination loop still correct |
| A2 | `musicKit.api.library.playlists({ limit: 100, offset: N })` or passthrough API method signature works in MusicKit JS v3 | Pattern 3 | If method signature differs, use raw `appleGet('/me/library/playlists?limit=100&offset=N', ...)` from the server — no client-side MusicKit call needed for the data fetch |
| A3 | Last.fm returns empty tag array (not an error code) for completely unknown artists | Pattern 8 | If error code 6 is returned for unknown artists, add `data.error === 6` check and return empty array |
| A4 | Description field is at `attributes.description?.standard` for library playlists | Pattern 9 | If structure differs (e.g. plain string), adjust the accessor; regex parse itself is robust |
| A5 | `jose` `SignJWT` API is stable at v6.2.3 with `.setProtectedHeader / .setIssuer / .setIssuedAt / .setExpirationTime / .sign` chain | Pattern 1 | Already installed at ^6.2.3; jose v6 API is stable; no risk within the installed range |
| A6 | Vercel Hobby plan default maxDuration is 300s (confirmed from 2026-05-14 Vercel docs) | Pattern 6 | If actual production limit is lower, SSE heartbeat keeps connection alive regardless |

---

## Open Questions

1. **Exact playlist naming convention used by Mark**
   - What we know: Session number is in the playlist name; theme and initials are in description; regex is Claude's discretion (D-03)
   - What's unclear: The exact format of Mark's playlist names (e.g. "Session 01 – Road Trip" vs "Warwick Massive #01")
   - Recommendation: The import route should log all fetched playlist names on first run so the regex can be refined. Start permissive: `/\b(\d+)\b/` on name to extract session number.

2. **Number of unique artists**
   - What we know: ~496 tracks total; Last.fm enrichment at 4 req/sec
   - What's unclear: Actual unique artist count (affects Last.fm enrichment duration)
   - Recommendation: 50 artists = ~12s; 200 artists = ~50s; both well within 300s. No special handling needed.

3. **Apple Developer Program credentials**
   - What we know: Apple Developer Program ($99/year) is required for a MusicKit identifier and `.p8` key
   - What's unclear: Whether Mark has an active membership with a MusicKit key already created
   - Recommendation: Wave 0 prerequisite task — verify `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and `APPLE_PRIVATE_KEY` are set in `.env.local` and the developer token can be generated before any import code runs

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server-side code | ✓ | v20.20.1 | — |
| `jose` npm package | Developer token generation | ✓ | ^6.2.3 (installed) | — |
| `zod` npm package | Description parsing | ✓ | ^4.0.0 (installed) | — |
| `drizzle-orm` | Database writes | ✓ | 0.45.2 (installed) | — |
| `@libsql/client` | libSQL driver | ✓ | 0.17.3 (installed) | — |
| Apple Developer account credentials | APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY | ? | — | None — blocking |
| LASTFM_API_KEY | Last.fm enrichment | ? | — | Skip enrichment (graceful degrade — tracks stored without genre tags) |
| MusicKit JS v3 CDN | Browser authorization | External CDN | v3 | None — required for IMPORT-01/07 |

**Missing dependencies with no fallback:**
- Apple Developer Program credentials — Wave 0 must verify these exist in `.env.local` before any import code runs. Without them, the developer token cannot be generated and the Apple Music API is inaccessible.

**Missing dependencies with fallback:**
- `LASTFM_API_KEY` — if unset, log a warning and skip the enrichment step; `artistTags` table remains empty; Phase 4 analytics gracefully handles empty tag data

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | Impact on Phase 2 |
|-----------|--------|-------------------|
| Use `npm` (not `pnpm`) | Phase 1 decision | No new deps needed; `npm install` if any are added |
| Use `proxy.ts` not `middleware.ts` | CLAUDE.md "What NOT to Use" | No new proxy changes needed; existing proxy covers `/dashboard` |
| Never expose developer token client-side | CLAUDE.md Apple Music section | `lib/apple-dev-token.ts` is server-only; `/api/apple-token` route returns it only to authenticated admins |
| MusicKit JS v3 CDN URL | CLAUDE.md §Apple Music Integration | Use `https://js-cdn.music.apple.com/musickit/v3/musickit.js` exactly |
| `jose` for JWT signing, ES256 algorithm | CLAUDE.md §Supporting Libraries | Already installed; use `SignJWT` from `jose` |
| Drizzle schema conventions: `sqliteTable`, `integer({ mode: "timestamp_ms" })` | Phase 1 PATTERNS.md | Phase 2 tables must follow the same column type patterns |
| API route guard: session check → 401, role check → 403 | Phase 1 PATTERNS.md | Import route, apple-token route, and session PATCH route must all use this pattern |
| Biome for lint/format | CLAUDE.md §Development Tools | Run `npm run lint` after each implementation task |
| No inline audio playback | CLAUDE.md "Out of Scope" | Track data stored for linking only (Apple Music URL via `playParams`) |

---

## Sources

### Primary (HIGH confidence)

- [panva/jose discussions #158](https://github.com/panva/jose/discussions/158) — ES256 SignJWT pattern with `crypto.createPrivateKey()`, confirmed via WebFetch
- [Apple Developer Forums thread/688774](https://developer.apple.com/forums/thread/688774) — `GET /v1/me/library/playlists/{id}/tracks` + `include=catalog`, confirmed via WebFetch
- [Apple Developer Forums thread/132606](https://developer.apple.com/forums/thread/132606) — ISRC not on library-songs; Apple Staff confirmation, confirmed via WebFetch
- [Apple Developer Forums thread/704994](https://developer.apple.com/forums/thread/704994) — pagination with limit/offset; phantom records behaviour, confirmed via WebFetch
- [Vercel docs: Configuring Maximum Duration](https://vercel.com/docs/functions/configuring-functions/duration) — Hobby plan 300s default, updated 2026-05-14, confirmed via WebFetch
- [Drizzle ORM docs: batch-api](https://orm.drizzle.team/docs/batch-api) — `db.batch()` implicit transaction, confirmed via WebFetch
- [Drizzle ORM docs: delete](https://orm.drizzle.team/docs/delete) — `await db.delete(table)` syntax, confirmed via WebFetch
- [Last.fm unofficial API docs: artist.getTopTags](https://lastfm-docs.github.io/api-docs/artist/getTopTags/) — response structure and parameters, confirmed via WebFetch
- [Next.js docs: Script component](https://nextjs.org/docs/app/api-reference/components/script) — `strategy="afterInteractive"` + `onLoad`
- [npm: jose v6.2.3](https://www.npmjs.com/package/jose) — [VERIFIED: npm registry] [OK] slopcheck

### Secondary (MEDIUM confidence)

- [gutta.medium.com: Using MusicKit JS](https://gutta.medium.com/using-musickitjs-to-integrate-your-web-application-with-apple-music-35740723221e) — `authorize()` flow, Music User Token handling
- [areknawo.com: Apple Music JavaScript integration guide](https://areknawo.com/apple-music-javascript-integration-guide/) — `musickitloaded` event, `MusicKit.configure()` pattern
- [w3tutorials.net: Apple Music API with Node.js](https://www.w3tutorials.net/blog/apple-music-api-nodejs/) — two-header auth pattern
- Description field structure (`attributes.description.standard`) — confirmed from Apple forums response examples and community sources

### Tertiary (LOW confidence — marked [ASSUMED])

- Max 100 items per paginated request [ASSUMED] — from developer forums discussion, not official Apple docs
- `musicKit.api.library.playlists()` method signature in MusicKit JS v3 [ASSUMED] — consistent across multiple community sources; official MusicKit v3 docs inaccessible (Webpack SPA, not crawlable)

---

## Metadata

**Confidence breakdown:**
- Developer token (jose ES256): HIGH — confirmed via GitHub discussions + npm registry
- Two-header Apple Music API auth: HIGH — confirmed via Apple Developer Forums + multiple community sources
- ISRC via catalog relationship: HIGH — Apple Staff confirmed in forums
- Library playlists pagination: MEDIUM — forums-confirmed; official docs inaccessible
- SSE streaming: HIGH — confirmed via official Next.js + Vercel docs
- Drizzle batch delete + insert: HIGH — confirmed via official Drizzle docs
- Last.fm integration: HIGH — confirmed via unofficial but community-maintained API docs
- MusicKit JS v3 browser pattern: MEDIUM — multiple consistent community sources; official docs not crawlable

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (30 days — MusicKit JS v3 is stable; Vercel limits confirmed from 2026-05-14 docs)
