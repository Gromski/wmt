# Phase 3: Archive Browsing - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 8 new/modified files
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `app/sessions/page.tsx` | page (RSC) | request-response | `app/dashboard/page.tsx` | role-match |
| `app/sessions/[sessionNumber]/page.tsx` | page (RSC) | request-response | `app/dashboard/page.tsx` | role-match |
| `components/ArchiveClient.tsx` | component (Client island) | event-driven | `components/SessionDateTable.tsx` | role-match |
| `components/SessionCard.tsx` | component (presentational) | request-response | `components/AttributionErrorCard.tsx` | partial |
| `components/SessionTimeline.tsx` | component (presentational) | request-response | `components/SessionDateTable.tsx` | partial |
| `components/ContributorChip.tsx` | component (presentational) | request-response | `app/dashboard/page.tsx` (Avatar usage) | partial |
| `app/page.tsx` | page (RSC) | request-response | `app/dashboard/page.tsx` (redirect pattern) | exact |
| `db/schema.ts` | schema | — | `db/schema.ts` (existing `tracks` table) | exact |
| `lib/parse-playlist.ts` | utility | transform | `lib/parse-playlist.ts` (existing file) | exact |
| `app/api/import/route.ts` | API route | request-response | `app/api/import/route.ts` (existing file) | exact |

---

## Pattern Assignments

### `app/sessions/page.tsx` (RSC, request-response)

**Analog:** `app/dashboard/page.tsx`

**Imports pattern** (`app/dashboard/page.tsx` lines 1–18):
```typescript
import { asc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AttributionErrorCard, type ContributorOption } from "@/components/AttributionErrorCard";
import { SessionDateTable } from "@/components/SessionDateTable";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
```

Biome import ordering rule observed here: type imports grouped, drizzle-orm before next/*, project aliases after.

**No auth gate** — this page is public. Omit the `auth.api.getSession` + `redirect` guard entirely. The pattern for a public RSC is simply `async function` with a direct Drizzle query.

**Drizzle query pattern** (`app/dashboard/page.tsx` lines 31–41):
```typescript
const rows = isAdmin
  ? await db
      .select({
        id: schema.sessions.id,
        sessionNumber: schema.sessions.sessionNumber,
        theme: schema.sessions.theme,
        date: schema.sessions.date,
        attributionParsed: schema.sessions.attributionParsed,
      })
      .from(schema.sessions)
      .orderBy(asc(schema.sessions.sessionNumber))
  : [];
```

For the archive page use `desc(schema.sessions.sessionNumber)` (D-04, newest first). The explicit `.select({ ... }).from(schema.sessions)` style is the established pattern — do not use `db.query.sessions.findMany()` unless relations config has been verified.

**Date serialisation pattern** (`app/dashboard/page.tsx` lines 44–49) — CRITICAL:
```typescript
// Drizzle returns Date | null for timestamp_ms columns; convert to number | null for props
const dateRows = rows.map((r) => ({
  id: r.id,
  sessionNumber: r.sessionNumber,
  theme: r.theme,
  date: r.date instanceof Date ? r.date.getTime() : r.date,
}));
```

Always call `.getTime()` (or the `instanceof Date` guard) before passing `date` as a prop to any Client Component. Passing a `Date` object directly causes a Next.js serialisation error.

**RSC page layout pattern** (`app/dashboard/page.tsx` lines 64–116):
```typescript
return (
  <main className="mx-auto max-w-[640px] px-6 pt-12">
    <h1 className="text-[28px] font-semibold leading-tight">…</h1>
    {/* sections rendered directly or passed to client islands */}
  </main>
);
```

For `app/sessions/page.tsx` use `max-w-[1120px]` (per UI-SPEC) and `pt-12` / `px-6`. Wrap `<ArchiveClient>` in `<Suspense fallback={<SessionsSkeleton />}>` because `ArchiveClient` calls `useSearchParams()`.

---

### `app/sessions/[sessionNumber]/page.tsx` (RSC, request-response)

**Analog:** `app/dashboard/page.tsx` (closest RSC with Drizzle query + data transform before render)

**Dynamic params pattern** (Next.js 16 — `params` must be awaited):
```typescript
export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionNumber: string }>;
}) {
  const { sessionNumber } = await params;
  const num = Number.parseInt(sessionNumber, 10);
  if (Number.isNaN(num)) notFound();
  // …
}
```

`params` is typed as `Promise<…>` in Next.js 16 App Router. Always `await params` before accessing fields.

**Drizzle join pattern with `notFound()`** — multi-table explicit join (established pattern in the codebase; no relations config needed):
```typescript
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { sessions, sessionTracks, tracks, contributors } from "@/db/schema";

const rows = await db
  .select({
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
```

After the join, group flat rows into a session object and serialise dates:
```typescript
const session = {
  sessionNumber: rows[0].sessionNumber,
  theme: rows[0].theme,
  date: rows[0].date instanceof Date ? rows[0].date.getTime() : rows[0].date,
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
```

**Layout pattern** — single centered column, back link at top:
```typescript
return (
  <main className="mx-auto max-w-[880px] px-6 pt-12">
    <Link href="/sessions" className="…">
      <ArrowLeft className="h-4 w-4 mr-1" /> All sessions
    </Link>
    {/* header card + separator + track list — all static HTML, no client island */}
  </main>
);
```

Session detail renders entirely as static RSC HTML — no client island needed (no interactive state).

---

### `components/ArchiveClient.tsx` (Client island, event-driven)

**Analog:** `components/SessionDateTable.tsx`

**"use client" + imports pattern** (`SessionDateTable.tsx` lines 1–20):
```typescript
"use client";

import { AlertCircle, Check } from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

Follow the same ordering: Lucide icons first, then React hooks, then shadcn component imports, then internal utilities.

**Props interface pattern** (`SessionDateTable.tsx` lines 22–27):
```typescript
export interface SessionDateRow {
  id: number;
  sessionNumber: number;
  theme: string;
  date: number | null; // timestamp_ms stored as number from DB
}
```

Define a named exported interface for props at the top of the file. `date` is always `number | null` (never `Date`) when received as a prop from an RSC.

**URL-param-driven view state** — `ArchiveClient` uses `useSearchParams` + `useRouter` (Next.js 16 built-ins). This component MUST be wrapped in `<Suspense>` at the RSC page level:
```typescript
"use client";
import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ArchiveClient({ sessions }: { sessions: SessionPayload[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = (searchParams.get("view") ?? "grid") as "grid" | "table" | "timeline";
  const [query, setQuery] = useState("");

  function setView(v: "grid" | "table" | "timeline") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`/sessions?${params.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return sessions;
    const q = query.toLowerCase();
    return sessions.filter(
      (s) =>
        s.theme.toLowerCase().includes(q) ||
        s.tracks.some(
          (t) =>
            t.artistName.toLowerCase().includes(q) ||
            (t.contributorName ?? "").toLowerCase().includes(q),
        ),
    );
  }, [sessions, query]);
  // …
}
```

**TooltipProvider wrapping pattern** (`SessionDateTable.tsx` lines 79 and 146):
```typescript
return (
  <TooltipProvider>
    {/* all Tooltip-using children here */}
  </TooltipProvider>
);
```

Wrap `ArchiveClient`'s root return in `<TooltipProvider>` since contributor chips use `<Tooltip>`.

**Empty-state pattern** (`SessionDateTable.tsx` lines 63–76):
```typescript
if (rows.length === 0) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Session dates</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          No sessions yet. Run &lsquo;Start import&rsquo; above to populate.
        </p>
      </CardContent>
    </Card>
  );
}
```

For the archive: check `sessions.length === 0` and render the "No sessions yet" empty state from the copywriting contract. Also check `filtered.length === 0` (with a non-empty query) for the "No matching sessions" state.

---

### `components/SessionCard.tsx` (presentational component, request-response)

**Analog:** `app/dashboard/page.tsx` (Avatar + Badge usage) and `components/AttributionErrorCard.tsx` (Card structure)

**Card component pattern** (`AttributionErrorCard.tsx` lines 126–130):
```typescript
<div
  key={e.id}
  className="rounded-md border p-4"
  style={{ borderColor: "rgba(180, 83, 9, 0.4)" }}
>
  <p className="text-sm font-semibold">
    Session {e.sessionNumber} &mdash; &ldquo;{e.theme}&rdquo;
  </p>
```

For `SessionCard` use shadcn `<Card>` (not a plain div), with `border` token border and hover class for violet border shift:
```typescript
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export function SessionCard({ session }: { session: SessionCardProps }) {
  return (
    <Link href={`/sessions/${session.sessionNumber}`} className="block group">
      <Card className="h-full border border-border group-hover:border-primary transition-colors">
        <CardContent className="p-4">
          {/* session number, theme, date/Date TBD, contributor chips */}
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Avatar pattern** (`app/dashboard/page.tsx` lines 71–73):
```typescript
<Avatar className="h-10 w-10">
  <AvatarFallback>{initials}</AvatarFallback>
</Avatar>
```

For contributor chips use `h-6 w-6` (24px) with inline style for background from `CONTRIBUTOR_COLORS`:
```typescript
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

<Avatar className="h-6 w-6" style={{ backgroundColor: color.bg }}>
  <AvatarFallback style={{ color: color.fg, backgroundColor: color.bg, fontSize: "10px" }}>
    {initials}
  </AvatarFallback>
</Avatar>
```

**Date formatting pattern** — no library, native Intl:
```typescript
// date is number | null from RSC props
const dateLabel = date
  ? new Date(date).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  : "Date TBD";
```

---

### `components/SessionTimeline.tsx` (presentational component, request-response)

**Analog:** `components/SessionDateTable.tsx` (table/list rendering of session rows)

This is a presentational component receiving pre-filtered/sorted session data as props from `ArchiveClient`. No client state of its own — pure render.

**Table row pattern reference** (`SessionDateTable.tsx` lines 94–139) — adapt to a vertical rail layout:
```typescript
{rows.map((r) => (
  <TableRow key={r.id}>
    <TableCell className="text-right text-muted-foreground">
      {r.sessionNumber}
    </TableCell>
    <TableCell className="truncate max-w-0">{r.theme}</TableCell>
  </TableRow>
))}
```

For timeline: a vertical `<ul>` with a left border acting as the rail, each `<li>` positioned with a dot and a session card. Separator between calendar years:
```typescript
import { Separator } from "@/components/ui/separator";

// Year-group separator
<Separator className="my-4" />
<p className="text-sm text-muted-foreground mb-2">{year}</p>
```

---

### `components/ContributorChip.tsx` (presentational, request-response)

**Analog:** `app/dashboard/page.tsx` lines 71–84 (Avatar + Badge composition) and `components/SessionDateTable.tsx` lines 128–136 (Tooltip usage)

**Tooltip pattern** (`SessionDateTable.tsx` lines 128–136):
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
  </TooltipTrigger>
  <TooltipContent>
    Could not save date — try again
  </TooltipContent>
</Tooltip>
```

For `ContributorChip` — Avatar inside TooltipTrigger with full name in TooltipContent:
```typescript
"use client"; // needed only if TooltipProvider is not a parent — prefer wrapping in parent

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function ContributorChip({
  initials,
  name,
  size = 24,
}: {
  initials: string;
  name: string;
  size?: number;
}) {
  const color = CONTRIBUTOR_COLORS[initials];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar style={{ width: size, height: size, backgroundColor: color?.bg }}>
          <AvatarFallback
            style={{
              backgroundColor: color?.bg,
              color: color?.fg,
              fontSize: size <= 20 ? "9px" : "11px",
            }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
```

Must be rendered inside `<TooltipProvider>` — already established in `ArchiveClient` root.

---

### `app/page.tsx` (RSC redirect, request-response) — MODIFY

**Analog:** `app/dashboard/page.tsx` lines 23–24 (redirect pattern):
```typescript
if (!session) redirect("/sign-in");
```

**Full replacement pattern** (`app/page.tsx` — current stub is 11 lines):
```typescript
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/sessions");
}
```

Import from `"next/navigation"` (App Router). No `async` needed — `redirect()` is synchronous and throws internally. No JSX returned.

Also update `components/GlobalHeader.tsx` line 31: change `href="/"` to `href="/sessions"` on the app-name link.

---

### `db/schema.ts` (schema migration) — MODIFY

**Analog:** `db/schema.ts` lines 108–118 (existing `tracks` table column pattern):
```typescript
export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  appleId: text("apple_id"), // catalog song ID (from catalog relationship)
  spotifyId: text("spotify_id"), // null until Phase 3
  isrc: text("isrc"),
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  albumName: text("album_name"),
  releaseYear: integer("release_year"),
  durationMs: integer("duration_ms"),
});
```

**Addition pattern** — add nullable `youtubeUrl` column after `durationMs`:
```typescript
youtubeUrl: text("youtube_url"), // nullable — Finding 2; fallback tracks only
```

Column naming convention: camelCase TypeScript name, snake_case SQL column name (consistent with `appleId` → `apple_id`, `artistName` → `artist_name`). No `.notNull()` — nullable by default in Drizzle SQLite.

After editing, run: `npm run db:push`

---

### `lib/parse-playlist.ts` (utility, transform) — MODIFY

**Analog:** `lib/parse-playlist.ts` (the file itself — extend, not replace)

**Existing regex constant pattern** (`lib/parse-playlist.ts` lines 17–24):
```typescript
export const INITIALS_RE =
  /\b([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2}),\s*([A-Z]{2})\b/;

export const SESSION_NUM_RE = /\b(\d+)\b/;
```

**New regex to add** — same style, exported constant:
```typescript
export const YOUTUBE_RE =
  /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
```

**Return type extension** (`lib/parse-playlist.ts` lines 33–39 — current return type):
```typescript
export function parsePlaylistDescription(
  name: string,
  description: string | undefined,
): {
  sessionNumber: number;
  theme: string;
  initials: string[] | null;
}
```

Extend to:
```typescript
): {
  sessionNumber: number;
  theme: string;
  initials: string[] | null;
  youtubeUrl: string | null;  // NEW — Finding 2
}
```

**Body addition** — after existing `initialsMatch` logic (line 53), extract YouTube URL:
```typescript
const ytMatch = description?.match(YOUTUBE_RE);
const youtubeUrl = ytMatch ? ytMatch[0] : null;

return { sessionNumber, theme, initials, youtubeUrl };
```

---

### `app/api/import/route.ts` (API route, streaming) — MODIFY

**Analog:** `app/api/import/route.ts` (the file itself — targeted addition only)

**Track record construction pattern** (`app/api/import/route.ts` lines 154–173):
```typescript
const tracks: ImportPlan["sessionPlans"][0]["tracks"] = items
  .slice(0, 16)
  .map((item, idx) => {
    const catalogItem = item.relationships?.catalog?.data?.[0];
    const releaseDate = catalogItem?.attributes?.releaseDate;
    const releaseYear = releaseDate
      ? Number(releaseDate.slice(0, 4)) || null
      : null;

    return {
      position: idx + 1,
      title: item.attributes.name,
      artistName: item.attributes.artistName,
      albumName: item.attributes.albumName ?? null,
      durationMs: item.attributes.durationInMillis ?? null,
      appleId: catalogItem?.id ?? null,
      isrc: catalogItem?.attributes?.isrc ?? null,
      releaseYear,
    };
  });
```

**Two changes required:**

1. Add `youtubeUrl` to the `ImportPlan` track shape (inside the `interface ImportPlan` block, lines 25–46):
```typescript
tracks: Array<{
  // ...existing fields...
  youtubeUrl: string | null;  // NEW
}>;
```

2. Add `youtubeUrl` to the `parsePlaylistDescription` call result (line 148) — the parser now returns it. Thread it into the track map and then into the Drizzle insert for the `tracks` table. The `youtubeUrl` field attaches at the session level (from description), not per-track; apply it to the fallback track position only if the session has one track (or store it on all tracks and leave non-fallback tracks with null — the simpler approach):
```typescript
const parsed = parsePlaylistDescription(
  name,
  p.attributes?.description?.standard,
);
// parsed.youtubeUrl is now available
```

Store `youtubeUrl` on the track record (apply it to position 1, or to whichever track is the fallback — the simplest safe approach is to store it on the session plan and write it to the first track without an `appleId`, or to all tracks if the session has exactly one track):
```typescript
// In the trackRows insert (around line ~240), add youtubeUrl:
youtubeUrl: trackPlan.youtubeUrl ?? null,
```

The exact insertion point is the `trackRows` array build — match the pattern of how `appleId` and `isrc` are already written.

---

## Shared Patterns

### Date Serialisation (all RSC pages → Client Components)

**Source:** `app/dashboard/page.tsx` lines 44–49
**Apply to:** `app/sessions/page.tsx`, `app/sessions/[sessionNumber]/page.tsx`

```typescript
// Always convert before passing to client:
date: r.date instanceof Date ? r.date.getTime() : r.date,
// Receive in client as: date: number | null
// Format for display: new Date(date).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })
// Null date: render "Date TBD" (label text from copywriting contract)
```

### shadcn Table Structure

**Source:** `components/SessionDateTable.tsx` lines 85–115
**Apply to:** `components/ArchiveClient.tsx` (table view mode)

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[40px] text-right">No.</TableHead>
      <TableHead>Theme</TableHead>
      <TableHead className="w-[160px]">Date</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {rows.map((r) => (
      <TableRow key={r.id}>
        <TableCell className="text-right text-muted-foreground">
          {r.sessionNumber}
        </TableCell>
        <TableCell className="truncate max-w-0">{r.theme}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### TooltipProvider Wrapping

**Source:** `components/SessionDateTable.tsx` lines 79, 146
**Apply to:** `components/ArchiveClient.tsx` (root return), or whichever component is the tree root for all Tooltip usages

```typescript
return (
  <TooltipProvider>
    {/* all content — Tooltip components work anywhere inside */}
  </TooltipProvider>
);
```

### Drizzle `db.select().from().leftJoin()` Chain

**Source:** `app/dashboard/page.tsx` lines 31–41 (simple select), `app/api/import/route.ts` lines 281–305 (multi-table joins illustrated in app logic)
**Apply to:** `app/sessions/page.tsx`, `app/sessions/[sessionNumber]/page.tsx`

```typescript
import { db } from "@/lib/db";
import * as schema from "@/db/schema";
import { desc, eq } from "drizzle-orm";

// Single table
const rows = await db
  .select({ id: schema.sessions.id, sessionNumber: schema.sessions.sessionNumber, … })
  .from(schema.sessions)
  .orderBy(desc(schema.sessions.sessionNumber));

// Multi-table join
const rows = await db
  .select({ … })
  .from(schema.sessions)
  .leftJoin(schema.sessionTracks, eq(schema.sessionTracks.sessionId, schema.sessions.id))
  .leftJoin(schema.tracks, eq(schema.tracks.id, schema.sessionTracks.trackId))
  .leftJoin(schema.contributors, eq(schema.contributors.id, schema.sessionTracks.attributedContributorId))
  .orderBy(desc(schema.sessions.sessionNumber), schema.sessionTracks.position);
```

### External Link Safety

**Source:** `components/AttributionErrorCard.tsx` (Button with asChild)
**Apply to:** All Apple Music and YouTube icon link buttons in `app/sessions/[sessionNumber]/page.tsx`

```typescript
<Button variant="ghost" size="icon" asChild>
  <a
    href={appleLink}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Open in Apple Music"
  >
    <Music className="h-4 w-4" />
  </a>
</Button>
```

Both `target="_blank"` and `rel="noopener noreferrer"` are required on all external links (security: prevents opener access). Never render the button if both `appleId` and `youtubeUrl` are null (D-10e).

### Apple Music Deep-Link Construction

**Apply to:** `app/sessions/[sessionNumber]/page.tsx` (track link construction)

```typescript
function appleLink(appleId: string | null): string | null {
  if (!appleId) return null;
  return `https://music.apple.com/gb/song/${appleId}`;
}
```

Storefront: `gb` (UK-based group, per D-10b). Built server-side in the RSC — no client-side URL assembly needed.

### Contributor Colour Map (new shared constant)

**Apply to:** `components/ContributorChip.tsx`, `components/SessionCard.tsx`, `components/ArchiveClient.tsx`

Create `lib/contributor-colors.ts` as a new shared constant (no analog exists yet — this is a new pattern):
```typescript
export const CONTRIBUTOR_COLORS: Record<string, { bg: string; fg: string }> = {
  MW: { bg: "oklch(0.554 0.252 296)", fg: "oklch(0.985 0 0)" },   // violet-600, zinc-50
  JG: { bg: "oklch(0.546 0.215 262)", fg: "oklch(0.985 0 0)" },   // blue-600, zinc-50
  JS: { bg: "oklch(0.769 0.156 70)",  fg: "oklch(0.145 0 0)" },   // amber-500, zinc-950 (dark text)
  IT: { bg: "oklch(0.596 0.145 163)", fg: "oklch(0.985 0 0)" },   // emerald-600, zinc-50
};
```

CSS variables to add to `app/globals.css` inside `.dark { }` (after the existing block at line 118):
```css
--contributor-mw: oklch(0.554 0.252 296);
--contributor-jg: oklch(0.546 0.215 262);
--contributor-js: oklch(0.769 0.156 70);
--contributor-it: oklch(0.596 0.145 163);
```

### Biome Import Ordering

**Source:** All existing files — consistent pattern throughout
**Apply to:** All new files

Order: (1) type-only imports, (2) drizzle-orm, (3) next/* imports, (4) react, (5) lucide-react, (6) shadcn `@/components/ui/*`, (7) internal `@/components/*`, (8) internal `@/lib/*`, (9) internal `@/db/*`.

Example from `app/dashboard/page.tsx` lines 1–18:
```typescript
import { asc } from "drizzle-orm";           // drizzle-orm first
import { headers } from "next/headers";      // next/* second
import { redirect } from "next/navigation";

import { AttributionErrorCard, type ContributorOption } from "@/components/…"; // project aliases
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
```

---

## No Analog Found

All files have analogs. No files require falling back to RESEARCH.md patterns exclusively — but two files are new with no direct structural analog:

| File | Role | Data Flow | Note |
|------|------|-----------|------|
| `lib/contributor-colors.ts` | utility/constant | — | No existing color-map constant; create fresh following the TypeScript constant pattern (`export const X: Record<…> = { … }`) |
| `components/SessionTimeline.tsx` | presentational | request-response | No existing timeline component; use `SessionDateTable.tsx` list-render pattern as structural guide; vertical rail layout is new |

---

## Metadata

**Analog search scope:** `app/`, `components/`, `lib/`, `db/`
**Files read:** `app/dashboard/page.tsx`, `app/page.tsx`, `app/sign-in/page.tsx`, `app/api/import/route.ts` (two ranges), `app/globals.css` (two ranges), `components/SessionDateTable.tsx`, `components/AttributionErrorCard.tsx`, `components/GlobalHeader.tsx`, `db/schema.ts`, `lib/parse-playlist.ts`
**Pattern extraction date:** 2026-07-15
