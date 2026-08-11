# Phase 4: Analytics - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 10 (1 route, 1 layout edit, 6 components, 3 lib modules — 1 lib module split into 2 files per RESEARCH.md structure)
**Analogs found:** 10 / 10 (all files have at least a role-match analog in this codebase)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `app/analytics/page.tsx` | route (RSC page) | CRUD (aggregation read) | `app/sessions/page.tsx` | exact |
| `lib/analytics.ts` | utility (server aggregation) | transform / batch | `app/sessions/page.tsx` (inline query+grouping logic) | role-match |
| `lib/genre-whitelist.ts` | config (static lookup map) | transform | `lib/contributor-colors.ts` | exact |
| `lib/similarity.ts` | utility (pure math) | transform | `lib/parse-playlist.ts` (pure-function module with a co-located `.test.ts`) | role-match |
| `components/analytics/TasteProfileRadar.tsx` | component (chart, client) | request-response (render props) | `components/ArchiveClient.tsx` (client-boundary pattern) | role-match |
| `components/analytics/EraBarChart.tsx` | component (chart, client) | request-response | `components/ArchiveClient.tsx` | role-match |
| `components/analytics/TopArtistsBarChart.tsx` | component (chart, client) | request-response | `components/ArchiveClient.tsx` | role-match |
| `components/analytics/OverlapHeatmap.tsx` | component (server, presentational grid) | transform (props → markup) | `components/SessionCard.tsx` | role-match |
| `components/analytics/WrappedCard.tsx` | component (server, presentational card) | transform (props → markup) | `components/SessionCard.tsx` + `components/ContributorChip.tsx` (colour usage) | exact (colour pattern), role-match (card shape) |
| `components/GlobalHeader.tsx` (MODIFY) | component (client nav) | request-response | itself — add one `Link`, matching existing logo `Link` | exact (self-analog) |

No file in this phase has zero analog — the codebase already has a public RSC+Drizzle aggregation route (`/sessions`), a colour-keyed lookup map (`contributor-colors.ts`), a pure-function module with tests (`parse-playlist.ts`), and card/chip components to crib layout and per-contributor colouring from. The only genuinely new pattern is the shadcn `ChartContainer`/Recharts wiring, which has no in-repo analog — RESEARCH.md's Code Example 2 (radar chart) is the reference for that piece only.

## Pattern Assignments

### `app/analytics/page.tsx` (route, CRUD aggregation)

**Analog:** `app/sessions/page.tsx` (full file read, 91 lines)

**Imports pattern** (lines 1-7):
```typescript
import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";

import { ArchiveClient } from "@/components/ArchiveClient";
import type { SessionCardPayload } from "@/components/SessionCard";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";
```
For `/analytics`, swap `ArchiveClient`/`SessionCardPayload` for the new `lib/analytics.ts` aggregation call and the analytics section components. Keep `drizzle-orm` import before `@/` aliases (Biome convention confirmed in RESEARCH.md §Project Constraints).

**No-auth public RSC pattern** (line 9-12, comment + signature):
```typescript
// Public RSC — no auth gate (D-01). Loads all sessions plus a per-session
// contributor chip list (two-query merge per PATTERNS.md to avoid a large
// session x track x contributor cross-product).
export default async function SessionsPage() {
```
Copy this shape exactly for `AnalyticsPage`: async Server Component, no `auth.api.getSession()` call, no `redirect()` — contrast with `app/dashboard/page.tsx` which DOES gate (see Shared Patterns → Auth below, to explicitly NOT apply it here).

**Aggregation-then-render pattern** (lines 13-76): two `db.select()` queries → in-memory `Map`-based grouping → a single plain-object array handed to a client component. `lib/analytics.ts` should follow this exact shape (query, group in JS, return plain serialisable data) rather than pushing grouping into SQL — this mirrors RESEARCH.md Pattern 3 exactly and IS the existing codebase convention, not just a research recommendation.

**Suspense + heading pattern** (lines 78-90):
```typescript
return (
  <main className="mx-auto max-w-[1120px] px-6 pt-12">
    <h1 className="text-[20px] font-semibold leading-tight">Sessions</h1>
    <Suspense
      fallback={
        <div className="mt-8 text-muted-foreground">Loading sessions…</div>
      }
    >
      <ArchiveClient sessions={sessions} />
    </Suspense>
  </main>
);
```
Copy the `max-w-[1120px] px-6 pt-12` main wrapper and the `text-[20px] font-semibold leading-tight` h1 exactly for visual consistency with `/sessions`. Analytics has multiple stacked sections (D-13) so wrap each chart-bearing section (radar/bar charts) in its own `Suspense` if needed, but heatmap/Wrapped cards (server components, no client fetch) don't need one.

---

### `lib/analytics.ts` (utility, server aggregation)

**Analog:** query + grouping logic inline in `app/sessions/page.tsx` (lines 13-66) — there is no existing standalone `lib/*.ts` aggregation module to copy from directly; RESEARCH.md's Pattern 3 code example is the concrete template, cross-checked against this codebase's actual Drizzle join style below.

**Drizzle join style used in this codebase** (from `app/sessions/page.tsx` lines 22-42):
```typescript
const contributorRows = await db
  .select({
    sessionNumber: schema.sessions.sessionNumber,
    position: schema.sessionTracks.position,
    initials: schema.contributors.initials,
    name: schema.contributors.name,
    artistName: schema.tracks.artistName,
  })
  .from(schema.sessionTracks)
  .innerJoin(schema.sessions, eq(schema.sessionTracks.sessionId, schema.sessions.id))
  .leftJoin(schema.contributors, eq(schema.sessionTracks.attributedContributorId, schema.contributors.id))
  .leftJoin(schema.tracks, eq(schema.tracks.id, schema.sessionTracks.trackId));
```
Note this codebase uses `leftJoin` for contributors/tracks even where RESEARCH.md's Pattern 3 example uses `innerJoin` (RESEARCH.md's example intentionally drops unattributed rows — confirmed 0 unattributed rows exist, so either join is safe, but `leftJoin` + explicit null-check is the established local style; prefer it for consistency).

**In-memory grouping style** (lines 44-66, `Map`-based accumulation): follow this same `Map<key, T[]>` / `Map<key, Set<T>>` accumulation pattern for building genre/decade/artist counts per contributor in `lib/analytics.ts` — do not introduce a different aggregation utility (e.g., lodash groupBy); the codebase has zero such dependency and this file should match.

**Return shape**: build one plain object per RESEARCH.md's Architecture Diagram (step 9 — "plain object, arrays/numbers/strings only") so it serialises cleanly across the RSC → client component boundary, matching how `sessions: SessionCardPayload[]` is built and passed to `<ArchiveClient sessions={sessions} />`.

---

### `lib/genre-whitelist.ts` (config, static lookup)

**Analog:** `lib/contributor-colors.ts` (full file, 9 lines)

```typescript
// Phase 3 UI-SPEC §Contributor colour map — LOCKED.
// Single source of truth for contributor identity colours, reused by
// ContributorChip, SessionCard, ArchiveClient, and Phase 4 analytics.
export const CONTRIBUTOR_COLORS: Record<string, { bg: string; fg: string }> = {
  MW: { bg: "oklch(0.554 0.252 296)", fg: "oklch(0.985 0 0)" },
  ...
};
```
This is the exact precedent for a flat `Record<string, T>` exported as a single named constant with a comment block explaining provenance/curation. `lib/genre-whitelist.ts`'s `GENRE_MAP: Record<string, string>` (RESEARCH.md Pattern 1) should carry the same comment style — cite the tag survey ("curated from a live survey of all 370 distinct `artist_tags.tag` values") the way `contributor-colors.ts` cites "Phase 3 UI-SPEC §Contributor colour map — LOCKED."

---

### `lib/similarity.ts` (utility, pure math)

**Analog:** `lib/parse-playlist.ts` + co-located `lib/parse-playlist.test.ts` — pure-function module pattern already established in this codebase (no DB, no I/O, exported named functions, colocated Vitest test file).

**Pattern to copy:** small, named, independently-testable pure functions exported individually (not a class, not a default export) — matches RESEARCH.md Pattern 4/5's `cosineSimilarity`, `pairwiseSimilarity`, `groupCentroid` functions exactly. If the project has a test convention for `lib/*.ts` modules (verify `parse-playlist.test.ts` exists alongside `parse-playlist.ts`), add `lib/similarity.test.ts` alongside `lib/similarity.ts` following the same colocation convention.

---

### `components/analytics/TasteProfileRadar.tsx` / `EraBarChart.tsx` / `TopArtistsBarChart.tsx` (client chart components)

**Analog:** `components/ArchiveClient.tsx` (client-boundary + import ordering pattern, lines 1-26)

**Imports pattern** (lines 1-26):
```typescript
"use client";

import {
  ArrowUpDown,
  ...
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ContributorChip } from "@/components/ContributorChip";
import { SessionCard, type SessionCardPayload } from "@/components/SessionCard";
...
```
Copy the `"use client";` directive as the first line, then external-package imports (alphabetised, `lucide-react`/`next/*`/`react` before `@/` aliases), then a blank line, then `@/` aliased imports — this is the established Biome-sorted import convention (confirmed in RESEARCH.md §Project Constraints: "type imports first, drizzle-orm before next/*"). For chart components this becomes: `"use client";` → `recharts` imports → `@/components/ui/chart` imports → `@/lib/contributor-colors` import.

**No exact chart analog exists in-repo** — no charting library is installed yet (confirmed via RESEARCH.md's `grep`/`npm view`). Use RESEARCH.md's Code Example 2 (`TasteProfileRadar`, lines 506-539) verbatim as the template; it already substitutes `CONTRIBUTOR_COLORS` for the generic `--chart-N` palette to match this project's per-person colour convention rather than shadcn's generic multi-series default.

**Colour-per-contributor pattern to reuse** (from `components/ContributorChip.tsx` lines 22-30):
```typescript
const color = CONTRIBUTOR_COLORS[initials];
...
style={{ backgroundColor: color?.bg, ... }}
```
Every chart component takes an `initials: string` prop and resolves `CONTRIBUTOR_COLORS[initials]` the same way `ContributorChip` does — do not invent a second colour-resolution helper.

---

### `components/analytics/OverlapHeatmap.tsx` (server, presentational grid)

**Analog:** `components/SessionCard.tsx` (presentational server component consuming a plain-data prop, full file 66 lines) + RESEARCH.md's own Pattern 7 code (already written against this exact colour convention).

**Server-component-with-typed-payload-prop pattern** (from `SessionCard.tsx` lines 6-19):
```typescript
export interface SessionCardContributor {
  initials: string;
  name: string;
}

export interface SessionCardPayload {
  sessionNumber: number;
  theme: string;
  ...
}

export function SessionCard({ session }: { session: SessionCardPayload }) {
```
`OverlapHeatmap` should export its own `interface`/`type` for `matrix: number[][]` + `contributors: {initials, name}[]` the same way, and remain a plain function component with NO `"use client"` directive — SessionCard has none, confirming plain server components (not client) are the norm for presentational grid/card pieces that need no interactivity.

**Card wrapper primitive** (from `components/ui/card.tsx` lines 5-21): if the heatmap or Wrapped cards need a bordered container, use `Card`/`CardContent` from `components/ui/card.tsx` rather than a raw styled `div`, matching `SessionCard.tsx` lines 33-34 (`<Card className="h-full border border-border ...">`).

---

### `components/analytics/WrappedCard.tsx` (server, presentational card)

**Analog:** `components/SessionCard.tsx` (Card/CardContent structure) + `components/ContributorChip.tsx` (colour resolution, lines 22-30, quoted above).

**Pattern:** a plain server component, `Card`/`CardContent` wrapper (see `SessionCard.tsx` lines 33-34), background/accent colour resolved via `CONTRIBUTOR_COLORS[initials]` exactly as `ContributorChip` does, headline stats rendered as plain text nodes (no client state) — matches RESEARCH.md's Architectural Responsibility Map row: "Wrapped cards … presentational, no client state needed beyond what shadcn Card already provides."

---

### `components/GlobalHeader.tsx` (MODIFY — add nav link)

**Analog:** itself, lines 27-47 (self-analog — extend existing `<nav>`)

```typescript
<header className="sticky top-0 z-50 w-full bg-card border-b border-border h-14">
  <div className="mx-auto flex h-full max-w-[1080px] items-center justify-between px-6">
    <Link href="/sessions" className="text-xl font-semibold">
      Warwick Massive Tunage
    </Link>

    <nav className="flex items-center gap-3">
      {!isPending && !session && (
        <Button asChild variant="default" size="sm" className="min-h-[44px]">
          <Link href="/sign-in">
            <LogIn className="h-4 w-4 mr-2" />
            Sign in
          </Link>
        </Button>
      )}
      ...
```
**Important finding:** the current `<nav>` has NO visible "Sessions" text link — only the logo `<Link href="/sessions">` and the sign-in/sign-out controls. CONTEXT.md's claim that GlobalHeader "currently links Sessions + sign-in" refers to the logo-as-sessions-link, not a separate nav item. Add the new "Analytics" link as a plain `<Link>` inside `<nav>`, placed before the conditional sign-in/sign-out block, e.g.:
```typescript
<nav className="flex items-center gap-3">
  <Link href="/analytics" className="text-sm font-medium text-muted-foreground hover:text-foreground">
    Analytics
  </Link>
  {!isPending && !session && ( ... )}
```
This is a small, additive, low-risk edit to an existing `"use client"` file — no new client boundary needed since `GlobalHeader` is already client-side (uses `authClient.useSession()`).

## Shared Patterns

### Public no-auth RSC route
**Source:** `app/sessions/page.tsx` (entire file — no `auth.api.getSession()`, no `headers()` import, no `redirect()`)
**Contrast source (what NOT to copy):** `app/dashboard/page.tsx` lines 20-24 — gated route pattern, explicitly NOT applicable to `/analytics`.
**Apply to:** `app/analytics/page.tsx`

### Per-contributor colour resolution
**Source:** `lib/contributor-colors.ts` (the `CONTRIBUTOR_COLORS` map) + `components/ContributorChip.tsx` lines 22-30 (`const color = CONTRIBUTOR_COLORS[initials]`)
**Apply to:** All chart components, `OverlapHeatmap.tsx`, `WrappedCard.tsx` — every place a per-person colour is needed. Never introduce a second colour source (e.g., shadcn's generic `--chart-1..5` vars) for contributor-specific visuals — those vars exist in `app/globals.css` but are reserved for generic/non-identity chart series only, per RESEARCH.md's explicit guidance.

### Plain-object payload across the RSC → client boundary
**Source:** `app/sessions/page.tsx` lines 68-76 (`sessions: SessionCardPayload[]` built as arrays/numbers/strings, then passed to `<ArchiveClient sessions={sessions} />`)
**Apply to:** `lib/analytics.ts`'s return value and its consumption in `app/analytics/page.tsx` — all data crossing into chart client components must already be plain-serialisable (no `Map`, no `Date` objects — convert `Date` to `number` the way `page.tsx` line 71 does: `r.date instanceof Date ? r.date.getTime() : r.date`).

### Card/Container primitives
**Source:** `components/ui/card.tsx` (`Card`, `CardContent`, `CardHeader`, `CardTitle`)
**Apply to:** `OverlapHeatmap.tsx`, `WrappedCard.tsx`, and any chart-wrapping section markup on the hub page — reuse rather than hand-rolling bordered `div`s.

### Import ordering / Biome convention
**Source:** `app/sessions/page.tsx` lines 1-7, `components/ArchiveClient.tsx` lines 1-26
**Apply to:** All new files — external packages first (alphabetised within groups: icons/next/react), blank line, then `@/`-aliased imports, `type` imports called out explicitly where used (see `import type { SessionCardPayload } from "@/components/SessionCard"`).

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|---------------|------|-----------|--------|
| shadcn `ChartContainer`/`ChartTooltip` wiring (Recharts `RadarChart`/`BarChart`) | component (client) | request-response | No charting library installed anywhere in this codebase yet (confirmed via RESEARCH.md's `grep`/`npm view` checks) — planner must follow RESEARCH.md's Code Example 2 and the `npx shadcn@latest add chart` install step rather than an in-repo analog. |

## Metadata

**Analog search scope:** `app/`, `components/`, `components/ui/`, `lib/`, `db/schema.ts`
**Files scanned:** `app/dashboard/page.tsx`, `app/sessions/page.tsx`, `app/sessions/[sessionNumber]/page.tsx`, `app/layout.tsx`, `components/SessionCard.tsx`, `components/ArchiveClient.tsx`, `components/ContributorChip.tsx`, `components/GlobalHeader.tsx`, `components/ui/card.tsx`, `lib/contributor-colors.ts`, `lib/db.ts`, `db/schema.ts`
**Pattern extraction date:** 2026-08-11
