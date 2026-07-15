# Phase 3: Archive Browsing - Research

**Researched:** 2026-07-15
**Domain:** Next.js 16 App Router read-only public surface + Drizzle data joins + schema migration
**Confidence:** HIGH (codebase inspected directly; patterns established in Phases 1–2)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Routing & Navigation**
- D-01: Archive lives at `/sessions` (public, no auth). Root `/` redirects to `/sessions`.
- D-02: Individual sessions at `/sessions/[sessionNumber]` (human-facing session number, not DB id).

**Session List / Archive View (`/sessions`)**
- D-03: Three view modes behind a single toggle: (a) card grid (default), (b) sortable table, (c) timeline.
- D-04: Default ordering: newest session first (descending `sessionNumber`).
- D-05: Null dates render as "Date TBD" placeholder; session stays fully browsable.

**Session Detail View (`/sessions/[sessionNumber]`)**
- D-06: 16 tracks as a single play-order list (positions 1–16), each row tagged with contributor chip. Round-robin order preserved (not regrouped into per-person blocks).
- D-07: Each track row shows title, artist, album, release year, and open-in link(s).
- D-08: Detail header: session number, theme, date (or "Date TBD"), four contributors, raw playlist `description` text.
- D-09: Unattributed sessions (`attributionParsed = false`): render play-order list with no contributor chips, plus a subtle "attribution pending" note. Session remains fully viewable.

**Track "Open In" Links (BROWSE-03)**
- D-10a: Apple Music + YouTube links ONLY. No Spotify links (spotifyId null for all tracks). No Spotify search-link fallback.
- D-10b: Apple Music deep-link from catalog `appleId`. Storefront = Claude's discretion.
- D-10c: YouTube links render for fallback tracks (from playlist description) — see Finding 2.
- D-10d: Links render as compact icon buttons, opening in a new tab.
- D-10e: Tracks with neither appleId nor YouTube link: no button rendered (no broken/empty link).

**Timeline View (BROWSE-04)**
- D-11: Timeline is the third mode of the `/sessions` view toggle (not a separate `/timeline` route).
- D-12: Undated sessions in timeline fall back to session-number order (NOT hidden).

**Search / Filter (BROWSE-05)**
- D-13: Single search box matching theme, person name, and artist name simultaneously.
- D-14: Search runs client-side (all 31 sessions and tracks loaded at once; instant, no round-trips).

### Claude's Discretion
- Apple Music storefront segment in deep-link URLs.
- Card grid responsive breakpoints and column counts.
- Data-loading approach for client-side search (server component pre-load vs. API route).
- Contributor chip/avatar visual treatment (reuse existing Avatar/Badge components).
- Empty-state and loading-state copy.

### Deferred Ideas (OUT OF SCOPE)
- Spotify "open in" links — deferred until Spotify data imported.
- Genre/artist tag display on tracks (`artist_tags`) — Phase 4 Analytics.
- Separate `/` landing/intro page — root redirects to `/sessions` for this MVP.
- Authenticated-user extras on browse — out of scope; editing stays on `/dashboard`.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BROWSE-01 | User can see a list of all sessions with session number, theme, date, and the four contributors | Drizzle query: `db.select().from(sessions).orderBy(desc(sessions.sessionNumber))` with contributors joined via `session_tracks` |
| BROWSE-02 | User can open any session and see all 16 tracks clearly grouped under the person who chose them (in play order) | Join: `sessions → session_tracks → tracks + contributors`; attribution via round-robin `(position-1) % 4` |
| BROWSE-03 | Each track has a link that opens it in Apple Music (or YouTube for fallback) | Apple Music: `https://music.apple.com/gb/song/{appleId}`; YouTube: `tracks.youtubeUrl` (new schema column) |
| BROWSE-04 | User can browse a chronological timeline view showing all sessions across time | Third toggle mode on `/sessions`; dated sessions by date desc, undated fall to bottom by sessionNumber desc |
| BROWSE-05 | User can search or filter sessions by theme keyword, person name, or artist name | Client-side filter on pre-loaded payload; search across theme, contributor name, and artistName fields |
</phase_requirements>

---

## Summary

Phase 3 delivers a public read-only browse layer over the data imported in Phase 2. The codebase is already structurally ready: routes, Drizzle schema, and shadcn components are all in place; this phase creates new App Router pages rather than changing core infrastructure. The two non-UI data tasks (attribution fix re-import + YouTube URL capture) must precede final verify/UAT.

**Finding 1 (attribution fix)** has already been resolved as quick task `260715-mkq` (commit `961a9ad`) — the route now uses `(position-1) % 4`. What remains is: the admin must re-import via MusicKit JS before Phase 3 UAT so the live database reflects the corrected mapping. No code change required here; the plan must include a human checkpoint.

**Finding 2 (YouTube URL capture)** is in-scope data work that requires: (a) extending `lib/parse-playlist.ts` to extract YouTube URLs from playlist descriptions, (b) adding a nullable `youtubeUrl` column to the `tracks` table in `db/schema.ts`, (c) running `npm run db:push` to apply the schema migration, and (d) re-importing so the new field is populated. Browse then surfaces the YouTube icon button for those tracks.

**Primary recommendation:** Structure the phase into three waves — Wave 1: data layer (schema + parser extension + re-import checkpoint), Wave 2: archive page + session detail page, Wave 3: search/filter client island + view toggle persistence. All waves use established App Router patterns: Server Components own Drizzle reads; Client Components own interactivity.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session list data (BROWSE-01) | API / Backend (RSC) | — | Drizzle query in Server Component; no client round-trip needed |
| Session detail data (BROWSE-02) | API / Backend (RSC) | — | Same pattern: Drizzle join in Server Component; pre-rendered HTML |
| Track link construction (BROWSE-03) | API / Backend (RSC) | Browser/Client | URL built server-side from `appleId`/`youtubeUrl`; rendered as `<a>` in RSC; icon button state (hover, tooltip) is client |
| Timeline rendering (BROWSE-04) | Browser/Client | — | Toggle state (grid/table/timeline) lives in Client island; filtered/sorted data passed as prop from RSC |
| Client-side search (BROWSE-05) | Browser/Client | API / Backend (RSC) | RSC pre-loads full payload (sessions + tracks + contributor names) into a serialisable prop; client island filters in-browser |
| View mode persistence in URL (`?view=`) | Browser/Client | — | `useSearchParams` / `useRouter` in client toggle island; no server round-trip |
| `/` → `/sessions` redirect | API / Backend (RSC) | — | `redirect('/sessions')` in `app/page.tsx` — Next.js 16 server redirect |
| Schema migration (`youtubeUrl` column) | Database / Storage | — | `drizzle-kit push` applies the DDL change; admin re-imports to populate |

---

## Standard Stack

All packages are already installed. Phase 3 introduces **zero new npm dependencies**.

### Core (already installed — verified from package.json)

| Library | Installed Version | Purpose |
|---------|------------------|---------|
| `next` | ^16.2.9 | App Router, RSC, `redirect()` |
| `react` | 19.2.4 | Client Component islands |
| `drizzle-orm` | ^0.45.2 | Drizzle read queries and schema |
| `drizzle-kit` | 0.31.10 | `npm run db:push` schema migration |
| `@libsql/client` | 0.17.3 | libSQL connection to Turso/local SQLite |
| `lucide-react` | ^1.18.0 | Icons (LayoutGrid, Table, GanttChartSquare, Search, Music, Youtube, ExternalLink, ArrowLeft, ArrowUpDown) |
| `shadcn` | ^4.11.0 | Card, Table, Badge, Avatar, Separator, Select, Button, Tooltip — all pre-installed |

[VERIFIED: package.json]

### Installation

No new packages. All required components are already installed.

If `tooltip.tsx` is needed in a new context verify it renders inside a `<TooltipProvider>` (established pattern in `SessionDateTable.tsx`).

---

## Package Legitimacy Audit

> Phase 3 installs zero new packages. Audit not applicable.

**Packages removed due to slopcheck verdict:** none (no new packages)
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (public, no auth)
        │
        ▼
┌─────────────────────────────────────┐
│  app/page.tsx                       │
│  redirect('/sessions') ─────────────┼──► /sessions
└─────────────────────────────────────┘
                                │
                    ┌───────────▼──────────────────────┐
                    │  app/sessions/page.tsx (RSC)     │
                    │  ─ Drizzle: all sessions +       │
                    │    contributor names + artists   │
                    │  ─ Serialize to JSON prop        │
                    │  ─ Pass to ArchiveClient island  │
                    └───────────┬──────────────────────┘
                                │ serialisable payload
                    ┌───────────▼──────────────────────┐
                    │  ArchiveClient (Client Component)│
                    │  ─ URL ?view= toggle (grid /     │
                    │    table / timeline)             │
                    │  ─ search input → filter array   │
                    │  ─ renders SessionCard /         │
                    │    SessionTable / Timeline views  │
                    └──────────────────────────────────┘

                                │ click session
                    ┌───────────▼──────────────────────┐
                    │  app/sessions/[sessionNumber]/   │
                    │  page.tsx (RSC)                  │
                    │  ─ Drizzle: single session +     │
                    │    session_tracks + tracks +     │
                    │    contributors                  │
                    │  ─ 404 if not found              │
                    │  ─ Renders static detail HTML    │
                    │    (no client island needed)     │
                    └──────────────────────────────────┘
```

### Recommended Project Structure

```
app/
├── page.tsx                     # redirect('/sessions') — replace stub
└── sessions/
    ├── page.tsx                 # RSC: loads all sessions, passes to ArchiveClient
    └── [sessionNumber]/
        └── page.tsx             # RSC: loads one session + tracks + contributors

components/
├── ArchiveClient.tsx            # Client island: view toggle, search, view rendering
├── SessionCard.tsx              # Presentational: grid card (no client state)
├── SessionTimeline.tsx          # Presentational: timeline rail + year groups
└── ContributorChip.tsx          # Presentational: coloured Avatar chip + tooltip
```

Note: `SessionTable` can live inside `ArchiveClient.tsx` rather than a separate file given its size; use judgment at implementation time.

### Pattern 1: RSC Data Load → Client Island

The established pattern (see `app/dashboard/page.tsx`, `SessionDateTable.tsx`) is:
- Server Component queries Drizzle and converts `Date` objects to epoch milliseconds before passing as props to Client Components.
- Client Component receives plain JSON-serialisable data.

```typescript
// app/sessions/page.tsx (RSC — no "use client")
import { db } from "@/lib/db";
import { sessions, contributors, sessionTracks, tracks } from "@/db/schema";
import { desc } from "drizzle-orm";
import { ArchiveClient } from "@/components/ArchiveClient";

export default async function SessionsPage() {
  // See "Drizzle Queries" section for full join patterns
  const rows = await db.query.sessions.findMany({
    orderBy: [desc(sessions.sessionNumber)],
    with: {
      sessionTracks: {
        with: { track: true, attributedContributor: true },
      },
    },
  });

  // Convert Date → number before passing to client
  const payload = rows.map((s) => ({
    ...s,
    date: s.date ? s.date.getTime() : null,
  }));

  return <ArchiveClient sessions={payload} />;
}
```

[ASSUMED] — exact query syntax based on established Drizzle relational query patterns; verify relations config in drizzle.config or add relations export to `db/schema.ts` if not already present. The alternative (explicit `.leftJoin()` chain) is equivalent and avoids needing relations config (see Pattern 2).

### Pattern 2: Explicit Drizzle Join (no relations config needed)

```typescript
import { db } from "@/lib/db";
import { sessions, sessionTracks, tracks, contributors } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Fetch all sessions with track + contributor data for search payload
const rows = await db
  .select({
    sessionId: sessions.id,
    sessionNumber: sessions.sessionNumber,
    theme: sessions.theme,
    date: sessions.date,
    description: sessions.description,
    attributionParsed: sessions.attributionParsed,
    position: sessionTracks.position,
    trackId: tracks.id,
    title: tracks.title,
    artistName: tracks.artistName,
    albumName: tracks.albumName,
    releaseYear: tracks.releaseYear,
    appleId: tracks.appleId,
    youtubeUrl: tracks.youtubeUrl,   // new column from Finding 2
    contributorInitials: contributors.initials,
    contributorName: contributors.name,
  })
  .from(sessions)
  .leftJoin(sessionTracks, eq(sessionTracks.sessionId, sessions.id))
  .leftJoin(tracks, eq(tracks.id, sessionTracks.trackId))
  .leftJoin(contributors, eq(contributors.id, sessionTracks.attributedContributorId))
  .orderBy(desc(sessions.sessionNumber), sessionTracks.position);
```

[ASSUMED] — follows drizzle-orm join pattern; will need grouping in application code to reduce flat rows back to sessions → tracks structure.

### Pattern 3: `redirect()` for Root Redirect

```typescript
// app/page.tsx — replace the entire existing stub
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/sessions");
}
```

[ASSUMED] — standard Next.js 16 App Router server redirect.

### Pattern 4: Client-Side Search (no API route)

Decision D-14 mandates client-side search. The data payload (31 sessions × 16 tracks = ~500 rows, plus contributor names and artist names) is small enough (~50–100 KB serialised) to pass as a prop from the RSC into the Client island.

```typescript
// components/ArchiveClient.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type SessionPayload = { /* typed from RSC query result */ };

export function ArchiveClient({ sessions }: { sessions: SessionPayload[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get("view") ?? "grid"; // persist in URL
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const q = query.toLowerCase();
    return sessions.filter((s) =>
      s.theme.toLowerCase().includes(q) ||
      s.tracks.some(
        (t) =>
          t.artistName.toLowerCase().includes(q) ||
          (t.contributorName ?? "").toLowerCase().includes(q),
      ),
    );
  }, [sessions, query]);

  // render based on `view` param...
}
```

[ASSUMED] — `useSearchParams` requires wrapping in `<Suspense>` at the layout level per Next.js 16 rules; the RSC page can wrap `<ArchiveClient>` in `<Suspense fallback={<SessionsSkeleton />}>`.

### Pattern 5: Apple Music Deep-Link Construction

Decision D-10b resolved to storefront `gb` (group is UK-based):

```typescript
function appleLink(appleId: string | null): string | null {
  if (!appleId) return null;
  return `https://music.apple.com/gb/song/${appleId}`;
}
```

[CITED: 03-UI-SPEC.md §Track link edge cases — format confirmed as `https://music.apple.com/{storefront}/song/{appleId}`]

### Pattern 6: Contributor Colour Map

Define as CSS variables in `app/globals.css` under `.dark` (per UI-SPEC) and mirror as a TypeScript constant for use in components:

```typescript
// lib/contributor-colors.ts
export const CONTRIBUTOR_COLORS: Record<
  string,
  { bg: string; fg: string; cssVar: string }
> = {
  MW: { bg: "var(--contributor-mw)", fg: "zinc-50", cssVar: "--contributor-mw" },
  JG: { bg: "var(--contributor-jg)", fg: "zinc-50", cssVar: "--contributor-jg" },
  JS: { bg: "var(--contributor-js)", fg: "zinc-950", cssVar: "--contributor-js" }, // amber — dark text
  IT: { bg: "var(--contributor-it)", fg: "zinc-50", cssVar: "--contributor-it" },
};
```

CSS variables (add to `app/globals.css` inside `.dark { }`):
```css
--contributor-mw: oklch(0.554 0.252 296);  /* violet-600 */
--contributor-jg: oklch(0.546 0.215 262);  /* blue-600 */
--contributor-js: oklch(0.769 0.156 70);   /* amber-500 */
--contributor-it: oklch(0.596 0.145 163);  /* emerald-600 */
```

[CITED: 03-UI-SPEC.md §Contributor colour map]

### Pattern 7: Finding 2 — Extending the Parser for YouTube URLs

```typescript
// Additions to lib/parse-playlist.ts

/**
 * Matches a YouTube watch URL in a playlist description.
 * Covers https://www.youtube.com/watch?v=... and https://youtu.be/...
 */
export const YOUTUBE_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;

// Extend parsePlaylistDescription return type + body:
export function parsePlaylistDescription(
  name: string,
  description: string | undefined,
): {
  sessionNumber: number;
  theme: string;
  initials: string[] | null;
  youtubeUrl: string | null;          // NEW
} {
  // ... existing logic ...
  const ytMatch = description?.match(YOUTUBE_RE);
  const youtubeUrl = ytMatch ? ytMatch[0] : null;

  return { sessionNumber, theme, initials, youtubeUrl };
}
```

[ASSUMED] — regex pattern is standard YouTube URL matching; confirm against actual description format in the live data after re-import.

### Pattern 8: Finding 2 — Schema Migration (`youtubeUrl` column)

Add to `tracks` table in `db/schema.ts`:

```typescript
export const tracks = sqliteTable("tracks", {
  // ... existing columns ...
  youtubeUrl: text("youtube_url"),  // nullable — Finding 2; fallback tracks only
});
```

Then run: `npm run db:push`

This is a non-destructive nullable column addition. SQLite `db:push` handles nullable column additions safely (no data loss). The import route must also be updated to write `youtubeUrl` from the parsed description.

[CITED: db/schema.ts — existing column pattern; `npm run db:push` per package.json scripts]

### Pattern 9: View Toggle URL Persistence

Decision D-03 requires view mode to persist in the URL as `?view=` (grid | table | timeline). The Client Component reads this via `useSearchParams()` and writes via `router.replace()` on toggle click. This makes the mode shareable and back-button-safe without a full page navigation.

```typescript
function setView(v: "grid" | "table" | "timeline") {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", v);
  router.replace(`/sessions?${params.toString()}`, { scroll: false });
}
```

[ASSUMED] — standard Next.js 16 App Router pattern.

### Anti-Patterns to Avoid

- **Passing `Date` objects to Client Components:** Always call `.getTime()` on `timestamp_ms` columns before serialising to client props. `Date` objects are not JSON-serialisable and will throw a Next.js serialisation error. (Established in Phase 2 — `SessionDateTable.tsx` uses `new Date(r.date).toISOString()`.)
- **Using `middleware.ts`:** Deprecated in Next.js 16. This phase needs no middleware (public routes, no auth gate), so this is not an issue — but don't create one.
- **API route for search data:** The ~500-track payload is small. An API route adds a network round-trip and complicates caching. Pass the full payload from the RSC instead (D-14).
- **`Math.floor((position-1)/4)` attribution:** The bug is fixed in `app/api/import/route.ts` (commit `961a9ad`). Do not introduce this formula anywhere else. The correct formula is `(position-1) % 4`.
- **Rendering Tooltip outside TooltipProvider:** `tooltip.tsx` requires `<TooltipProvider>` in the tree. Established pattern: wrap at the component or page level (see `SessionDateTable.tsx`).
- **Skipping the `<Suspense>` boundary for `useSearchParams`:** In Next.js 16, any component calling `useSearchParams()` must be wrapped in `<Suspense>`. Omitting this causes a build error.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contributor avatars | Custom coloured div | `Avatar` + `AvatarFallback` from `components/ui/avatar` (already installed) | shadcn Avatar handles accessible fallback initials with consistent sizing |
| Sortable table columns | Custom sort state | shadcn `Table` + local `useState` sort key/direction in the Client island | Simple enough for 31 rows; no virtual scroll needed |
| Tooltips on icon buttons | `title` attribute | `Tooltip` + `TooltipContent` from `components/ui/tooltip` (already installed) | `title` is inaccessible and unstyled; shadcn Tooltip matches the design system |
| Toast/error states | Custom error component | `sonner` is already installed | Established in Phase 1 dashboard |
| Date formatting | Custom formatter | `new Date(ms).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })` | Native Intl API, no import needed |
| URL search param state | External state library | `useSearchParams` + `useRouter` (built into Next.js) | No extra package needed |

**Key insight:** Every UI primitive this phase needs is already installed. The implementation work is wiring, not provisioning.

---

## Runtime State Inventory

> This section is relevant only for the re-import dependency (Finding 1 + Finding 2). Phase 3 is otherwise greenfield.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `session_tracks` rows have incorrect contributor attribution (blocks-of-four formula) stored from the Phase 2 import. Live data is wrong. | Admin re-import via MusicKit JS authorize flow after schema migration lands. |
| Stored data | `tracks` rows have no `youtube_url` column yet (schema doesn't exist until Finding 2 migration) | Schema migration + re-import to populate the new column |
| Live service config | None — no external service config stores state about this app | None |
| OS-registered state | None | None |
| Secrets/env vars | None new — existing `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` are unchanged | None |
| Build artifacts | None | None |

**Re-import sequencing:** Schema migration (`db:push`) must complete before re-import; re-import must complete before Phase 3 verify/UAT. The planner should include a `checkpoint:human-action` task for the admin re-import.

---

## Common Pitfalls

### Pitfall 1: Date Serialisation to Client Components

**What goes wrong:** Passing a `Date` object returned by Drizzle `timestamp_ms` columns directly as a prop to a Client Component triggers a Next.js serialisation error: "Only plain objects, and a few built-ins, can be passed to Client Components from Server Components."

**Why it happens:** `Date` is not a plain JSON-serialisable type. Drizzle returns `Date | null` for `integer({ mode: "timestamp_ms" })` columns.

**How to avoid:** Convert in the RSC before passing to the client:
```typescript
date: s.date ? s.date.getTime() : null, // number | null, always safe to serialise
```
Established in Phase 2 (`SessionDateTable.tsx` receives `date: number | null`).

**Warning signs:** Build error mentioning "cannot pass Date objects"; "Only plain objects" in the Next.js error overlay.

### Pitfall 2: `useSearchParams` Without `<Suspense>`

**What goes wrong:** Next.js 16 requires any component that calls `useSearchParams()` to be wrapped in `<Suspense>`. Without it, the page throws during static analysis or produces a runtime error.

**Why it happens:** `useSearchParams` reads from the dynamic request URL which cannot be statically determined at build time without the boundary.

**How to avoid:** Wrap `<ArchiveClient>` (the island that reads `?view=`) in `<Suspense fallback={<SessionsSkeleton />}>` inside the RSC page.

**Warning signs:** Build warning "useSearchParams() should be wrapped in a suspense boundary" or 500 at runtime.

### Pitfall 3: Missing `rel="noopener noreferrer"` on External Links

**What goes wrong:** External links (`target="_blank"`) without `rel="noopener noreferrer"` create a security vulnerability (the opened page can access `window.opener`).

**How to avoid:** All Apple Music and YouTube icon links must include both `target="_blank"` and `rel="noopener noreferrer"`. The UI-SPEC already specifies this (D-10d).

### Pitfall 4: Drizzle `db:push` on a Column Addition

**What goes wrong:** Developers sometimes assume `db:push` is destructive. For nullable column additions on SQLite it is not — it runs `ALTER TABLE tracks ADD COLUMN youtube_url TEXT` which is always safe.

**Why it matters:** Confidence to push without data loss anxiety. The re-import will overwrite all track rows anyway (replace-all pattern from Phase 2 D-04).

**Warning signs:** None expected. If `db:push` asks for confirmation on a destructive change (e.g., column rename), abort and use `db:generate` + manual migration instead.

### Pitfall 5: Apple Music `appleId` vs Library Song ID Confusion

**What goes wrong:** Apple Music API returns two different IDs per track: the library song ID (user-specific, from `GET /v1/me/library/playlists/{id}/tracks`) and the catalog song ID (`appleId` stored in the schema, from the `catalog` relationship). Deep-links require the **catalog ID**.

**How to avoid:** Use `tracks.appleId` exclusively for URL construction. The schema comment confirms this is the catalog ID: `appleId: text("apple_id") // catalog song ID (from catalog relationship)`.

**Warning signs:** Deep-link opens to a "song not found" page — indicates a library ID was used instead of catalog ID.

### Pitfall 6: Search Payload Size and Performance

**What goes wrong:** Passing all 31 sessions with all their tracks and artist names from RSC to the client is correct for this dataset size but the serialised payload should be monitored. If sessions grow substantially in future, this pattern would need revisiting.

**Why it's fine now:** 31 sessions × 16 tracks = 496 tracks. Each track payload (title, artist, album, year, appleId, youtubeUrl, contributorName) is ~200 bytes JSON. Total: ~100KB — well within comfortable props payload size.

**Warning signs (future):** Client hydration time increases noticeably; React DevTools shows large serialised props.

---

## Code Examples

### Drizzle Join: Session Detail Query

```typescript
// app/sessions/[sessionNumber]/page.tsx
import { db } from "@/lib/db";
import { sessions, sessionTracks, tracks, contributors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionNumber: string }>;
}) {
  const { sessionNumber } = await params;
  const num = Number.parseInt(sessionNumber, 10);
  if (Number.isNaN(num)) notFound();

  const rows = await db
    .select({
      sessionId: sessions.id,
      sessionNumber: sessions.sessionNumber,
      theme: sessions.theme,
      date: sessions.date,
      description: sessions.description,
      attributionParsed: sessions.attributionParsed,
      position: sessionTracks.position,
      title: tracks.title,
      artistName: tracks.artistName,
      albumName: tracks.albumName,
      releaseYear: tracks.releaseYear,
      appleId: tracks.appleId,
      youtubeUrl: tracks.youtubeUrl,
      contributorInitials: contributors.initials,
      contributorName: contributors.name,
    })
    .from(sessions)
    .leftJoin(sessionTracks, eq(sessionTracks.sessionId, sessions.id))
    .leftJoin(tracks, eq(tracks.id, sessionTracks.trackId))
    .leftJoin(contributors, eq(contributors.id, sessionTracks.attributedContributorId))
    .where(eq(sessions.sessionNumber, num))
    .orderBy(sessionTracks.position);

  if (rows.length === 0) notFound();

  // Convert Date → number for client serialisation (established pattern)
  const session = {
    sessionNumber: rows[0].sessionNumber,
    theme: rows[0].theme,
    date: rows[0].date ? rows[0].date.getTime() : null,
    description: rows[0].description,
    attributionParsed: rows[0].attributionParsed,
    tracks: rows
      .filter((r) => r.position !== null)
      .map((r) => ({
        position: r.position!,
        title: r.title ?? "",
        artistName: r.artistName ?? "",
        albumName: r.albumName,
        releaseYear: r.releaseYear,
        appleId: r.appleId,
        youtubeUrl: r.youtubeUrl,
        contributorInitials: r.contributorInitials,
        contributorName: r.contributorName,
      })),
  };

  return <SessionDetail session={session} />;
}
```

[ASSUMED] — `params` as `Promise<>` is the Next.js 16 App Router convention; query structure derived from schema.ts.

### Drizzle Join: Archive List (All Sessions + Contributor Summary)

The archive page needs sessions plus the set of contributors per session. The most straightforward approach for 31 sessions is two queries: one for sessions, one for the session_tracks+contributors join, then merge in application code. This avoids a large cross-product for the list view.

```typescript
// Two-query approach for the archive list
const allSessions = await db
  .select()
  .from(sessions)
  .orderBy(desc(sessions.sessionNumber));

// Get all attribution rows for contributor chips on cards
const allAttribs = await db
  .select({
    sessionId: sessionTracks.sessionId,
    position: sessionTracks.position,
    initials: contributors.initials,
    name: contributors.name,
  })
  .from(sessionTracks)
  .leftJoin(contributors, eq(contributors.id, sessionTracks.attributedContributorId));
```

[ASSUMED] — two-query merge pattern is common for avoiding large cross-products; validated against established Drizzle usage in codebase.

### `app/page.tsx` Replacement

```typescript
// app/page.tsx — replaces existing stub entirely
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/sessions");
}
```

[ASSUMED] — standard Next.js 16 `next/navigation` redirect in an RSC.

---

## State of the Art

| Old Approach | Current Approach | Impact for Phase 3 |
|--------------|------------------|-------------------|
| `middleware.ts` | `proxy.ts` with exported `proxy` | No middleware needed in this phase (public routes); don't create `middleware.ts` |
| `params.sessionNumber` (sync) | `await params` (async, Next.js 16) | `params` must be awaited in dynamic route Server Components |
| `pages/` Router | App Router (`app/`) | All Phase 3 routes live under `app/sessions/` |
| `getServerSideProps` | Drizzle queries inside `async` Server Components | Phase 3 RSC pages fetch directly, no `getServerSideProps` |

**Deprecated/outdated:**
- `Math.floor((position-1)/4)` for contributor slot: replaced by `(position-1) % 4` (quick task `260715-mkq`, commit `961a9ad`)

---

## Data-Loading Strategy Decision

This section resolves the "Claude's Discretion" item on data-loading approach for the client-side search.

**Chosen approach: RSC pre-load → single client prop**

All session data (including tracks and contributor names needed for search) is fetched in the RSC page, converted to plain JSON, and passed as a single `sessions` prop to `<ArchiveClient>`. No API route is used for initial page load.

**Rationale:**
1. Dataset is tiny (~100KB serialised). No pagination needed.
2. Avoids a second network round-trip on page load.
3. Consistent with Next.js 16 App Router patterns already established in this codebase.
4. Simple caching story: RSC output can be cached at the Next.js layer with `"use cache"` if desired (Phase 4 concern, not Phase 3).

**Alternative considered and rejected:** Fetch data via an API route from the client on mount (`useEffect` + `fetch('/api/sessions')`). Rejected because it adds latency, creates a loading state on the critical path, and requires an extra API route that isn't otherwise needed.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drizzle relational query API (`db.query.sessions.findMany`) is available; `relations` are defined in schema | Pattern 1 | If relations aren't configured, use the explicit `.leftJoin()` pattern (Pattern 2) which definitely works |
| A2 | `params` must be `await`ed in Next.js 16 dynamic route pages | Code Examples | If wrong (Next.js 15 behaviour), remove `await` — both work during the transition period |
| A3 | YouTube URLs in playlist descriptions match the standard `youtube.com/watch?v=` or `youtu.be/` format | Pattern 7 | If descriptions use different URL formats, the regex needs adjusting — verify against actual description text post-import |
| A4 | `useSearchParams` still requires `<Suspense>` wrapping in Next.js 16 | Pattern 4 | If the requirement changed in 16.x, the Suspense boundary is harmless to include regardless |
| A5 | `db:push` handles nullable column addition non-destructively in SQLite | Pitfall 4 | SQLite `ALTER TABLE ADD COLUMN` is always safe for nullable columns — this is a SQLite spec guarantee, not drizzle-specific |

---

## Open Questions

1. **Do playlist descriptions actually contain YouTube URLs?**
   - What we know: CONTEXT.md Finding 2 asserts YouTube fallback links appear in playlist descriptions.
   - What's unclear: The exact format of those URLs in the real data (short `youtu.be/` vs long `youtube.com/watch?v=`).
   - Recommendation: Admin should check one or two playlist descriptions in Apple Music before implementing the parser extension, to confirm the URL format. The YOUTUBE_RE regex covers both common formats.

2. **Are all 31 sessions currently in the DB with correct round-robin attribution?**
   - What we know: The code fix landed (commit `961a9ad`). The DB still has old data (blocks-of-four attribution).
   - What's unclear: Whether the admin has re-imported since the fix.
   - Recommendation: Include a `checkpoint:human-action` task in Wave 1 after schema migration: "Trigger re-import from the dashboard to refresh attribution and populate `youtubeUrl` fields."

3. **Does `lucide-react@1.18.0` include the `Youtube` icon?**
   - What we know: The UI-SPEC specifies a `Youtube` icon from Lucide; lucide-react 1.18.0 is installed.
   - What's unclear: Whether this specific version includes the `Youtube` named export (Lucide icon set is large and frequently updated).
   - Recommendation: Planner should include a one-line verification task: `node -e "require('lucide-react').Youtube && console.log('ok')"` before the task that uses it.

---

## Environment Availability

All dependencies are installed and confirmed from `package.json`. No external services beyond existing `DATABASE_URL` + Turso are needed for this phase.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 | ✓ | (project already running) | — |
| `drizzle-kit` | `npm run db:push` | ✓ | 0.31.10 | — |
| `@libsql/client` | DB connection | ✓ | 0.17.3 | — |
| `lucide-react` | Icons | ✓ | ^1.18.0 | — |
| Local SQLite / Turso | DB reads | ✓ | per `.env` `DATABASE_URL` | — |

**Missing dependencies with no fallback:** None.

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies in Phase 3 |
|-----------|-------------------|
| Next.js 16 App Router — use `app/` directory, RSC patterns | YES — all new routes under `app/sessions/` |
| `proxy.ts` not `middleware.ts` | YES — don't create `middleware.ts`; this phase needs no route gating |
| Drizzle ORM with `db/schema.ts` | YES — all queries via `db` from `lib/db.ts` |
| Biome linting — type imports first, `drizzle-orm` before `next/*` | YES — all new files must comply |
| shadcn v4 radix-nova preset, dark-zinc + violet tokens | YES — established in `app/globals.css`; new CSS vars go in `.dark {}` |
| No Spotify links (no Premium, import deferred) | YES — D-10a locks this; no Spotify anywhere in Phase 3 |
| Atomic commits per task | YES |
| No inline audio playback | N/A — not applicable to browse |
| `"use cache"` directive available in Next.js 16 | Available but not required for Phase 3 MVP |

---

## Sources

### Primary (HIGH confidence — directly read)
- `db/schema.ts` — table shapes, column types, mode conventions
- `app/api/import/route.ts` — attribution fix at line ~292 (commit `961a9ad`); established Drizzle insert patterns
- `lib/parse-playlist.ts` — parser structure; Finding 2 extension point identified
- `app/page.tsx` — existing stub to replace
- `components/ui/` — full list of installed shadcn components
- `package.json` — all installed versions verified
- `.planning/config.json` — `nyquist_validation: false` confirmed (Validation Architecture section omitted)
- `.planning/phases/03-archive-browsing/03-CONTEXT.md` — all locked decisions
- `.planning/phases/03-archive-browsing/03-UI-SPEC.md` — visual/interaction contract
- `.planning/phases/02-import-pipeline/02-CONTEXT.md` — prior phase data model decisions
- `components/SessionDateTable.tsx` — Date serialisation pattern, TooltipProvider pattern
- `components/GlobalHeader.tsx` — header link target (points to `/`, will need updating to `/sessions`)

### Secondary (MEDIUM confidence)
- CONTEXT.md Finding 1 note + STATE.md quick task log — confirms `961a9ad` fix landed; re-import still pending
- CONTEXT.md Finding 2 — YouTube URL extraction requirement; exact description format [ASSUMED pending inspection]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json; no new packages
- Architecture: HIGH — patterns read directly from existing Phase 2 code
- Data queries: MEDIUM — Drizzle join patterns are well-established but exact relational query syntax depends on whether `relations` are configured in schema (fallback join pattern always works)
- Finding 2 regex: LOW — YouTube URL format in real description data not directly verified

**Research date:** 2026-07-15
**Valid until:** 2026-08-15 (stable stack; only risk is lucide-react icon availability at exact version)
