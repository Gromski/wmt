# Phase 4: Analytics - Research

**Researched:** 2026-08-11
**Domain:** Server-computed music-taste analytics (genre/era/artist aggregation, similarity math, Recharts visualisation) on a read-only Next.js 16 RSC surface
**Confidence:** HIGH (stack/versions/DB shape all verified live); MEDIUM (similarity/divergence formula — math is standard but exact weights are a judgment call, flagged ASSUMED); LOW (none — no unverifiable claims required)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
### Defining "taste" (ANALYTICS-01)
- **D-01:** **Genre** is derived from `artist_tags` (Last.fm) via a **curated genre whitelist** — map/keep only tags that match a fixed list of real genres (rock, hip-hop, jazz, electronic, soul, folk, etc.) and discard noise tags (`seen live`, `favourite`, geographic tags, etc.). The whitelist itself is to be curated by the researcher/planner from the actual tag values present in the DB (see Deferred/research note).
- **D-02:** **Era** is computed at **individual-year granularity** (from `tracks.release_year`) and **rolled up into decades** for display — a decade-level summary (1960s…2020s + an "Unknown" bucket for null years) with year-level detail available underneath the rollup.
- **D-03:** **Most-chosen artists** = **top 5** per person, by count of tracks attributed to that contributor (via `session_tracks.attributed_contributor_id`), shown with counts.

### Similarity & wildcard (ANALYTICS-02 / 03)
- **D-04:** Pairwise **overlap** is based on a **blend of shared artists AND shared genres** (weighted) — shared specific artists give a strong personal signal, shared genres a broader one.
- **D-05:** Similarity is **normalised** (Jaccard / cosine over each person's artist+genre vectors), producing 0–1 scores so contributors with more/broader tracks aren't unfairly "more similar."
- **D-06:** The **wildcard** (ANALYTICS-03) = the friend **furthest from the group's average profile** — build each person's genre/era profile, compute the group centroid, and measure distance; "consistently diverges" = largest distance.
- **D-07:** Surface a **ranked divergence score for all four** friends and **highlight the top one** as the wildcard (not just a single name).

### Charts & visuals (ANALYTICS-01/02/04, UI)
- **D-08:** Add **shadcn/ui chart components (wrapping Recharts)** — the stack named in CLAUDE.md. This is a new dependency for the project (no charting lib installed today).
- **D-09:** **Taste profile** shape: **radar chart for the genre breakdown** (the "taste fingerprint"), **bar charts for era (decade histogram) and top artists**.
- **D-10:** **Overlap matrix** rendered as a **4×4 colour heatmap grid** — cell colour intensity = similarity, score shown in-cell.
- **D-11:** **Wrapped cards** use a **bold Spotify-Wrapped aesthetic** — one vivid card per person in their contributor colour, big headline stats + standout picks.
- **D-12:** **Wrapped card standout picks/stats** (all four): (a) **signature genre + #1 artist**, (b) a **group-unique pick** — a genre/artist that ONLY they chose across all 31 sessions (the computable stand-in for "most obscure/distinctive", since no artist-popularity data exists), (c) **era range** (oldest & newest track by release_year), (d) **headline counts** (tracks contributed, distinct artists, sessions appeared in).

### Page structure
- **D-13:** A **single `/analytics` hub page** with stacked sections: **group overview** (overlap heatmap + wildcard ranking) at the top, then the **four taste profiles**, then the **Wrapped cards** section inline.
- **D-14:** Navigation via a **permanent header link** ("Analytics" / "Insights") in `GlobalHeader`, alongside Sessions.
- **D-15:** Wrapped cards live **inline as a section on the hub** (no dedicated per-person or shareable card routes in this phase).

### Claude's Discretion
- Server-side aggregation approach (RSC + Drizzle queries, caching with `"use cache"` / `cacheLife`) is Claude's call per the stack guidance — data is read-only and static between imports.
- Exact normalisation formula (Jaccard vs cosine) and the precise divergence distance metric — planner/researcher pick the most defensible; the *definitions* above are locked.
- Radar/bar/heatmap styling details, responsive behaviour, and empty/low-data handling.

### Deferred Ideas (OUT OF SCOPE)
- **Dedicated shareable Wrapped card routes** (`/analytics/wrapped/[contributor]`, screenshot-friendly full-screen) — considered, deferred; hub-inline cards for this phase (D-15). Candidate for a future polish phase.
- **Per-person deep-dive pages** (`/analytics/[contributor]`) — considered, deferred in favour of the single hub (D-13).
- **Artist popularity / obscurity** metrics — not possible with current data (no listener/popularity counts); would require a new enrichment source. Group-unique pick (D-12b) is the stand-in.
- **Spotify-based analytics** — Spotify import remains deferred (no spotifyId data); out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| ANALYTICS-01 | User can view a taste profile for each of the four friends showing their most-chosen artists, era/decade distribution, and genre breakdown across all sessions | Architecture Patterns 1-3 (genre whitelist + single aggregation query); Code Example 1 (decade rollup); Code Example 2 (radar chart); Pitfall 4 (Unknown/Unspecified buckets) |
| ANALYTICS-02 | User can see a pairwise group overlap matrix — which pairs of friends share the most similar taste based on shared artists and genres | Architecture Pattern 4 (cosine similarity over artist+genre vectors); Pattern 7 (heatmap component) |
| ANALYTICS-03 | App identifies and surfaces the friend who most consistently diverges from the group's average choices (the "wildcard") | Architecture Pattern 5 (group centroid + cosine distance ranking) |
| ANALYTICS-04 | Each friend has a Wrapped-style visual summary card: headline stats and standout picks across all sessions | Architecture Pattern 6 (group-unique pick); Pitfall 3 (headline count edge cases); Assumptions Log A1 (Wrapped copy tone) |
</phase_requirements>

## Summary

Phase 4 is pure server-side aggregation + client-side charting over data that already exists in `local.db`. There is no new import, no new schema, no auth. The two genuinely new pieces of engineering are (1) a curated Last.fm-tag → genre whitelist (this research builds and grounds it against the actual 370 distinct tags in the DB) and (2) the similarity/divergence math for the overlap matrix and wildcard score. Charting is shadcn/ui's official Recharts wrapper (`npx shadcn add chart`), which is fully compatible with this project's Next 16 / React 19 / Tailwind v4 / radix-nova stack — verified via Context7 docs and a live `npm view` check.

The single most important finding for planning: **this codebase does not yet use the `"use cache"` directive anywhere**, and Next.js 16's `"use cache"` is a no-op unless `cacheComponents: true` is set in `next.config.ts` (currently absent). Flipping that flag is an app-wide behavioural change (it switches the whole app from "static by default" to "dynamic by default unless cached"), which is a bigger blast radius than this phase needs. **Recommendation: do not enable `cacheComponents` for this phase.** `/analytics` has zero dynamic Request APIs (no cookies, no headers, no searchParams in the MVP hub), so it already qualifies for Next's default automatic static rendering — the same mechanism `/sessions` already relies on with zero caching directives. This delivers the "cache aggressively, read-only data" goal from CLAUDE.md without the platform-wide risk.

**Primary recommendation:** Build one server-only aggregation module (`lib/analytics.ts`) that does a single pass over `session_tracks` + `tracks` + `contributors` + `artist_tags`, resolves genre via a static whitelist lookup object (`lib/genre-whitelist.ts`), and returns a fully-computed, plain-JSON-serialisable result object. `app/analytics/page.tsx` (a plain async Server Component, no `"use cache"`) calls it once and fans the data out to small client chart components (shadcn `ChartContainer` + Recharts) and one hand-rolled CSS-grid heatmap component (Recharts has no heatmap primitive — this is one of the few places a tiny custom component is correct, not hand-rolling something a library should own).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Genre/era/artist aggregation (per-person counts) | API / Backend (RSC + Drizzle) | — | Pure data transform over DB rows; no reason to ship raw rows to the client |
| Genre whitelist/normalisation lookup | API / Backend | — | Static map, evaluated server-side once per request; never needs to run in the browser |
| Pairwise similarity (cosine) + divergence (wildcard) math | API / Backend | — | Deterministic math over aggregated vectors; small enough to inline as pure functions next to the aggregation |
| Radar / bar chart rendering | Browser / Client | — | Recharts/shadcn chart primitives require `"use client"` (SVG measurement, ResizeObserver, tooltips) |
| 4×4 heatmap grid | Browser / Client (styling only) | API / Backend (score computation) | Colour/text rendering is trivial CSS; the *scores* are computed server-side and passed down as plain props — no client-side math |
| Wrapped cards | Browser / Client (presentational) | API / Backend (stat computation) | Cards are static markup once server has computed the stats; no client state needed beyond what shadcn `Card` already provides |
| Navigation entry point | Browser / Client | — | `GlobalHeader` is already a `"use client"` component (uses `authClient.useSession()`) |
| Caching of the aggregation | Frontend Server (Next.js static rendering) | — | No `"use cache"` needed — route has no dynamic APIs, qualifies for default Full Route Cache (see Pitfall 1) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `recharts` | 3.10.1 [VERIFIED: npm registry, Context7 official shadcn docs] | Charting engine underneath shadcn chart components | Official shadcn/ui chart wrapper depends on it directly; peer deps (`react ^16‖17‖18‖19`) confirmed compatible with this project's React 19.2.4 |
| `shadcn` chart registry item (`ui/chart.tsx` + block files, not an npm package) | Installed via `npx shadcn@latest add chart` (project's shadcn CLI is already `^4.11.0`) | `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig` wrapper components | Matches CLAUDE.md's sanctioned stack; themed to the project's existing `--chart-1..5` CSS vars already present in `app/globals.css` [VERIFIED: grep of app/globals.css] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None additional | — | — | No new query/validation/state library is needed — all data flows through existing Drizzle + RSC patterns already established in `app/dashboard/page.tsx` and `app/sessions/[sessionNumber]/page.tsx` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts (via shadcn) | Nivo (has a native heatmap) | Would add a second charting dependency just for one 4×4 grid; a 16-cell CSS grid is trivially hand-rollable and D-10 only asks for colour intensity + a number in each cell — no real heatmap features (zoom, legends, binning) are needed |
| Recharts (via shadcn) | D3 directly | Massive overkill for 4 chart types on 4 data series each; shadcn+Recharts already gives themed, accessible defaults |
| Single-label genre per track | Multi-label genre (store all whitelisted tags per artist) | Multi-label improves the *similarity vector* signal but complicates the genre-breakdown chart (a track would count toward multiple radar axes, breaking "percentage of total tracks" semantics). This research recommends single-label (`primaryGenre` = highest-ranked whitelisted tag) for **all** use cases for consistency — see Architecture Pattern 2 |

**Installation:**
```bash
npx shadcn@latest add chart
```
This one command installs `recharts` as an npm dependency and drops `components/ui/chart.tsx` into the project — no separate `npm install recharts` step is needed (confirmed via Context7 shadcn docs: the CLI path and the manual "install recharts, then copy the block" path are both officially supported; CLI is simpler here since project already runs `shadcn@latest` elsewhere).

**Version verification:** `npm view recharts version` → `3.10.1`, published under `recharts/recharts` on GitHub, MIT licensed, first published 2015 (10+ years), **56.9M weekly downloads** (`npmjs.org` downloads API, week of 2026-08-03). This is about as far from a slopsquat candidate as an npm package can be.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `recharts` | npm | ~10.5 yrs (first published 2015-08-07) | 56.9M/week | `github.com/recharts/recharts` | `[OK]` (ran via `slopcheck install recharts`, then reverted the resulting `package.json`/`package-lock.json`/`node_modules` changes with `git checkout` + `npm prune` — research must not leave install side effects in the tree) | Approved |

**Packages removed due to slopcheck `[SLOP]` verdict:** none
**Packages flagged as suspicious `[SUS]`:** none

`recharts` qualifies for `[VERIFIED: npm registry]` status per the provenance rule: it was discovered via Context7's official shadcn/ui documentation (not WebSearch/training alone), confirmed on the npm registry, and passed slopcheck `[OK]`.

**Note on side effect:** running `slopcheck install <pkg>` actually executes `npm install <pkg>` — it is not a dry-run check. This modified this project's `package.json`/`package-lock.json`/`node_modules` during research. Both were reverted via `git checkout -- package.json package-lock.json && npm prune` before this document was written; `git status` is clean. **The planner's install task must actually run `npx shadcn@latest add chart` (or `npm install recharts`) for real** — it is not already installed.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Request: GET /analytics (no auth, no dynamic params)            │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ app/analytics/page.tsx  (async Server Component, plain — no      │
│ "use cache"; qualifies for Next's default static rendering)      │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ lib/analytics.ts → getAnalyticsData()                            │
│  1. SELECT all attributed session_tracks + tracks + contributors │
│  2. SELECT all artist_tags, group by artistName, sort by rank    │
│  3. Resolve genre per artist via lib/genre-whitelist.ts lookup    │
│  4. Aggregate per contributor: top-5 artists, decade histogram,  │
│     genre breakdown, era range, headline counts                  │
│  5. Build per-contributor artist-count + genre-count vectors      │
│  6. cosineSimilarity() → 4×4 pairwise matrix                      │
│  7. groupCentroid() + cosineDistance() → wildcard ranking         │
│  8. groupUniquePick() → per-contributor exclusive artist/genre    │
│  9. Return one plain object (arrays/numbers/strings only)         │
└───────────────────────────┬───────────────────────────────────────┘
                            ▼
        ┌───────────────────┴────────────────────┐
        ▼                                        ▼
┌─────────────────────────┐          ┌─────────────────────────────┐
│ Client chart components  │          │ Server-rendered sections     │
│ ("use client")            │          │ (Wrapped cards, heatmap grid)│
│ - RadarChart (genre)      │          │ - plain divs, colour via     │
│ - BarChart (era, artists) │          │   CONTRIBUTOR_COLORS + score │
│ via shadcn ChartContainer │          │ - no client JS required      │
└─────────────────────────┘          └─────────────────────────────┘
```
A reader can trace the primary path: request → RSC page → one aggregation function → either a client chart island (radar/bar) or a plain server-rendered block (heatmap/cards). No API route is needed — this mirrors the existing `/sessions` pattern exactly.

### Recommended Project Structure
```
app/analytics/
├── page.tsx                 # RSC hub — calls lib/analytics.ts, renders sections
lib/
├── analytics.ts             # getAnalyticsData(): the one aggregation entrypoint
├── genre-whitelist.ts       # GENRE_MAP: Record<normalizedTag, canonicalGenre>
├── similarity.ts            # cosineSimilarity, cosineDistance, buildVector helpers
components/
├── analytics/
│   ├── TasteProfileRadar.tsx   # "use client" — one radar per contributor
│   ├── EraBarChart.tsx         # "use client" — decade histogram bar chart
│   ├── TopArtistsBarChart.tsx  # "use client" — top-5 horizontal bar chart
│   ├── OverlapHeatmap.tsx      # plain server component — CSS grid, no client JS
│   └── WrappedCard.tsx         # plain server component — per-person stat card
```

### Pattern 1: Genre resolution via static whitelist lookup, not a classifier
**What:** `lib/genre-whitelist.ts` exports one object: `GENRE_MAP: Record<string, string>` mapping a normalised (trimmed, lowercased) Last.fm tag string to a canonical genre name. Everything **not** in the map is implicitly excluded — no separate "exclusion list" of decade/geography/junk tags is needed, because absence from the map already means "not a genre."
**When to use:** Any time you need an artist's canonical genre(s).
**Example:**
```typescript
// lib/genre-whitelist.ts
// Curated from a live survey of all 370 distinct artist_tags.tag values
// in local.db (SELECT tag, COUNT(*) FROM artist_tags GROUP BY tag ORDER BY 2 DESC).
// Only tags with count >= 3 in the current dataset were considered for
// inclusion — the long tail (junk tags like "funk_add_to_lidarr_batch_4",
// geography like "welsh"/"canadian", descriptors like "female vocalists",
// decades like "80s", labels like "4ad"/"stones throw", and one-off artist
// names used as tags like "prince"/"kenny rogers") is deliberately left out.
export const GENRE_MAP: Record<string, string> = {
  // Rock family
  rock: "Rock", "classic rock": "Rock", "progressive rock": "Rock",
  "hard rock": "Rock", "psychedelic rock": "Rock", "blues rock": "Rock",
  "folk rock": "Rock", "punk rock": "Rock", "glam rock": "Rock",
  "soft rock": "Rock",
  // Alternative / Indie
  alternative: "Alternative", "alternative rock": "Alternative",
  indie: "Indie", "indie rock": "Indie", "indie pop": "Indie", britpop: "Indie",
  // Electronic family
  electronic: "Electronic", electronica: "Electronic", idm: "Electronic",
  techno: "Techno", house: "House", "deep house": "House",
  dubstep: "Dubstep", chillout: "Chillout", downtempo: "Chillout",
  "trip-hop": "Trip-Hop",
  // Pop
  pop: "Pop", synthpop: "Synth-Pop", "synth pop": "Synth-Pop",
  // Soul / Funk / Jazz
  soul: "Soul", motown: "Soul", "northern soul": "Soul", "neo-soul": "Soul",
  funk: "Funk", "jazz-funk": "Funk",
  jazz: "Jazz", "acid jazz": "Jazz", "jazz fusion": "Jazz", fusion: "Jazz",
  // Hip-Hop / R&B
  "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", rap: "Hip-Hop", "gangsta rap": "Hip-Hop",
  rnb: "R&B", "rhythm and blues": "R&B",
  // Folk / Singer-Songwriter / New Wave
  folk: "Folk", "singer-songwriter": "Singer-Songwriter", "new wave": "New Wave",
  // Reggae family
  reggae: "Reggae", "roots reggae": "Reggae", roots: "Reggae",
  dancehall: "Reggae", ragga: "Reggae", dub: "Reggae", rasta: "Reggae",
  // DnB
  "drum and bass": "Drum & Bass", jungle: "Drum & Bass",
  "drum n bass": "Drum & Bass", dnb: "Drum & Bass",
  // Punk
  punk: "Punk", "post-punk": "Post-Punk",
  // Misc
  disco: "Disco", blues: "Blues", dance: "Dance",
  psychedelic: "Psychedelic", experimental: "Experimental",
  afrobeat: "Afrobeat", world: "World", ambient: "Ambient",
  metal: "Metal", country: "Country", classical: "Classical",
  latin: "Latin",
};

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function resolveGenre(tag: string): string | null {
  return GENRE_MAP[normalizeTag(tag)] ?? null;
}
```

### Pattern 2: Single-label genre per artist (not multi-label), consistently reused
**What:** For each artist, walk their `artist_tags` rows in ascending `rank` order (rank 1 = top tag per schema comment); the **first** tag that resolves via `resolveGenre()` becomes that artist's `primaryGenre`. If none resolve, `primaryGenre = null` ("Unspecified"). Every downstream calculation — genre breakdown chart, similarity vector, divergence vector, Wrapped "signature genre" — uses this **same** single value. This keeps every percentage/count in the app summing to 100% of tracks, and avoids a second, subtly different "which genres count for similarity" definition.
**When to use:** Everywhere genre is used in this phase.
**Example:**
```typescript
// lib/analytics.ts (excerpt)
import { resolveGenre } from "./genre-whitelist";

type ArtistTagRow = { artistName: string; tag: string; rank: number };

function buildArtistGenreMap(tagRows: ArtistTagRow[]): Map<string, string | null> {
  const byArtist = new Map<string, ArtistTagRow[]>();
  for (const row of tagRows) {
    const list = byArtist.get(row.artistName) ?? [];
    list.push(row);
    byArtist.set(row.artistName, list);
  }
  const result = new Map<string, string | null>();
  for (const [artist, rows] of byArtist) {
    const sorted = [...rows].sort((a, b) => a.rank - b.rank);
    const primary = sorted.map((r) => resolveGenre(r.tag)).find((g) => g !== null) ?? null;
    result.set(artist, primary);
  }
  return result;
}
```

### Pattern 3: One aggregation query, in-memory grouping (not per-metric SQL)
**What:** Fetch all attributed session_tracks joined to tracks/contributors in one query, fetch all `artist_tags` in a second query, then do all grouping (top artists, decades, genres, vectors) in plain JS `Map`/`reduce`. At this scale (474 session_tracks, 413 distinct artists, 1937 tag rows) this is trivially fast and vastly easier to get right than five separate `GROUP BY` queries with `CASE`-statement genre normalisation baked into SQL.
**Example:**
```typescript
// lib/analytics.ts (excerpt)
import { asc, isNotNull, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";

async function fetchAttributedRows() {
  return db
    .select({
      contributorId: schema.sessionTracks.attributedContributorId,
      contributorInitials: schema.contributors.initials,
      contributorName: schema.contributors.name,
      sessionId: schema.sessionTracks.sessionId,
      artistName: schema.tracks.artistName,
      releaseYear: schema.tracks.releaseYear,
      trackId: schema.tracks.id,
    })
    .from(schema.sessionTracks)
    .innerJoin(schema.tracks, eq(schema.tracks.id, schema.sessionTracks.trackId))
    .innerJoin(
      schema.contributors,
      eq(schema.contributors.id, schema.sessionTracks.attributedContributorId),
    ); // inner join already drops unattributed rows (see Edge Case 1)
}

async function fetchArtistTags() {
  return db
    .select({
      artistName: schema.artistTags.artistName,
      tag: schema.artistTags.tag,
      rank: schema.artistTags.rank,
    })
    .from(schema.artistTags)
    .orderBy(asc(schema.artistTags.artistName), asc(schema.artistTags.rank));
}
```
Live counts confirmed against `local.db` (2026-08-11): 474 `session_tracks` rows total, **0** with `attributed_contributor_id IS NULL` (round-robin fallback already assigns everyone — see IMPORT-04/quick-task 260715-mkq), 28 `tracks` rows with `release_year IS NULL`, 413 distinct `artistName` values, 18 artists with zero `artist_tags` rows at all.

### Pattern 4: Cosine similarity over weighted count vectors (the concrete D-05 recommendation)
**What:** Represent each contributor as two sparse vectors — an artist vector (`{artistName: trackCount}`) and a genre vector (`{genre: trackCount}`) — then blend cosine similarity across both, weighted toward artists per D-04's stated rationale ("shared specific artists give a strong personal signal, shared genres a broader one").
**Why cosine over Jaccard:** Jaccard treats vectors as sets (membership only), throwing away *how many* times each person picked an artist/genre. Cosine naturally uses the counts, is bounded in [0, 1] for non-negative vectors (satisfying D-05's "normalised" requirement), and needs no extra scaling step. This is the standard choice for weighted taste/preference vectors.
**Example:**
```typescript
// lib/similarity.ts
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [key, valA] of a) {
    normA += valA * valA;
    const valB = b.get(key);
    if (valB) dot += valA * valB;
  }
  for (const valB of b.values()) normB += valB * valB;
  if (normA === 0 || normB === 0) return 0; // no data → no defined similarity
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// [ASSUMED weights — D-04 locks "blended, weighted toward artists", the
// exact 0.7/0.3 split is this research's recommendation, not a locked number.
// Exported as a named constant so it's a one-line tuning knob post-UAT.]
export const SIMILARITY_WEIGHTS = { artist: 0.7, genre: 0.3 } as const;

export function pairwiseSimilarity(
  artistVecA: Map<string, number>, genreVecA: Map<string, number>,
  artistVecB: Map<string, number>, genreVecB: Map<string, number>,
): number {
  return (
    SIMILARITY_WEIGHTS.artist * cosineSimilarity(artistVecA, artistVecB) +
    SIMILARITY_WEIGHTS.genre * cosineSimilarity(genreVecA, genreVecB)
  );
}
```

### Pattern 5: Group centroid + cosine distance for the wildcard (D-06/D-07)
**What:** Build each contributor's normalised genre-proportion vector and era-proportion (decade) vector, blend them into one profile vector, average all four profile vectors into a group centroid, then rank each contributor by `1 - cosineSimilarity(person, centroid)`.
**Example:**
```typescript
// [ASSUMED blend weight — 0.5 genre / 0.5 era. D-06 locks "genre/era profile"
// as the input; the exact blend ratio is this research's recommendation.]
const PROFILE_WEIGHTS = { genre: 0.5, era: 0.5 } as const;

function toProportions(counts: Map<string, number>): Map<string, number> {
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  return new Map([...counts].map(([k, v]) => [k, v / total]));
}

function buildProfileVector(
  genreCounts: Map<string, number>,
  decadeCounts: Map<string, number>,
): Map<string, number> {
  const genreProp = toProportions(genreCounts);
  const decadeProp = toProportions(decadeCounts);
  const vec = new Map<string, number>();
  for (const [g, p] of genreProp) vec.set(`genre:${g}`, p * PROFILE_WEIGHTS.genre);
  for (const [d, p] of decadeProp) vec.set(`decade:${d}`, p * PROFILE_WEIGHTS.era);
  return vec;
}

function groupCentroid(vectors: Map<string, number>[]): Map<string, number> {
  const centroid = new Map<string, number>();
  for (const vec of vectors) {
    for (const [k, v] of vec) centroid.set(k, (centroid.get(k) ?? 0) + v / vectors.length);
  }
  return centroid;
}

// Wildcard = contributor with the highest divergence:
// divergence = 1 - cosineSimilarity(personVector, centroidVector)
```

### Pattern 6: Group-unique pick (Wrapped D-12b)
**What:** For each artist, count how many distinct contributors have at least one attributed track by them. An artist is "exclusive" to a contributor if that count is exactly 1. Fall back to genre-level exclusivity if a contributor has no exclusive artist.
**Example:**
```typescript
function findExclusiveArtists(
  rows: { contributorInitials: string; artistName: string }[],
): Map<string, string[]> {
  const artistToContributors = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = artistToContributors.get(r.artistName) ?? new Set();
    set.add(r.contributorInitials);
    artistToContributors.set(r.artistName, set);
  }
  const exclusiveByContributor = new Map<string, string[]>();
  for (const [artist, contributors] of artistToContributors) {
    if (contributors.size === 1) {
      const [only] = contributors;
      const list = exclusiveByContributor.get(only) ?? [];
      list.push(artist);
      exclusiveByContributor.set(only, list);
    }
  }
  return exclusiveByContributor; // rank by track count in the caller to pick "the" standout
}
```

### Pattern 7: Hand-rolled heatmap grid (the one deliberate exception to "don't hand-roll")
**What:** Render the 4×4 overlap matrix as a plain CSS grid — no charting library. Recharts has no heatmap chart type; the visual requirement (D-10: colour intensity + a number per cell, 16 cells, no zoom/pan/legend) is simple enough that reaching for a second charting dependency (e.g. Nivo, purely for `ResponsiveHeatMap`) would be over-engineering.
**Example:**
```typescript
// components/analytics/OverlapHeatmap.tsx — plain Server Component, no "use client"
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

function cellStyle(score: number, contributorInitials: string) {
  const color = CONTRIBUTOR_COLORS[contributorInitials];
  // score in [0,1] → opacity in [0.15, 1] so even low-similarity cells are visible
  const opacity = 0.15 + score * 0.85;
  return { backgroundColor: color?.bg, opacity };
}

export function OverlapHeatmap({
  contributors,
  matrix, // matrix[i][j] = similarity score between contributors[i] and contributors[j]
}: {
  contributors: { initials: string; name: string }[];
  matrix: number[][];
}) {
  return (
    <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-1">
      <div />
      {contributors.map((c) => (
        <div key={c.initials} className="text-center text-sm font-medium">
          {c.initials}
        </div>
      ))}
      {contributors.map((rowContributor, i) => (
        <>
          <div key={`label-${rowContributor.initials}`} className="text-sm font-medium">
            {rowContributor.initials}
          </div>
          {contributors.map((colContributor, j) => (
            <div
              key={`${rowContributor.initials}-${colContributor.initials}`}
              className="flex aspect-square items-center justify-center rounded text-sm font-semibold text-white"
              style={cellStyle(matrix[i][j], rowContributor.initials)}
            >
              {i === j ? "—" : matrix[i][j].toFixed(2)}
            </div>
          ))}
        </>
      ))}
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **SQL `CASE`-statement genre normalisation:** Don't try to push the whitelist/synonym mapping into a giant SQL `CASE WHEN tag IN (...)` expression. It's harder to test, harder to read, and Drizzle's typed query builder gives no real benefit for this kind of string-matching logic — do it in TypeScript against data fetched once.
- **Per-metric SQL queries:** Don't write five separate Drizzle queries (one for top-artists, one for era histogram, one for genre breakdown, etc.). One join + in-memory grouping is simpler and, at 474 rows, strictly faster than five round-trips to Turso/libSQL.
- **Enabling `cacheComponents` just for this phase:** See Pitfall 1 below — this is an app-wide flag with app-wide consequences, not a per-route opt-in.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Radar/bar chart rendering, SVG axes, tooltips, responsive sizing | A custom SVG chart renderer | shadcn `ChartContainer` + Recharts `RadarChart`/`BarChart` | Axis scaling, tooltip positioning, and responsive `ResizeObserver` wiring are exactly the kind of code that's easy to get subtly wrong (label overlap, tooltip clipping) and Recharts already handles it |
| Cosine/vector similarity math | A bespoke "taste matching" scoring DSL | The ~15-line `cosineSimilarity()` in Pattern 4 | The math itself is standard and small; resist the temptation to add a generic "similarity engine" abstraction for a 4-person app — a couple of pure functions is the entire solution |

**Key insight:** Nothing in this phase needs a new *library* beyond the chart primitives — the genre whitelist, similarity math, and divergence math are all small, testable, pure-function problems better solved directly than through an abstraction layer or a heavier dependency.

## Common Pitfalls

### Pitfall 1: `"use cache"` does nothing without `cacheComponents: true` — and that flag is app-wide
**What goes wrong:** CLAUDE.md recommends `"use cache"` + `cacheLife('days')` for read-only pages. Adding the directive alone silently does nothing in this codebase today, because `cacheComponents` is not set in `next.config.ts` [VERIFIED via Context7 /vercel/next.js docs + WebSearch cross-check: "The 'use cache' directive does nothing without cacheComponents: true"]. Worse, if a developer enables it later without realising the scope, `cacheComponents: true` changes caching semantics for **every** route in the app (dashboard, sign-in, session pages) — under Cache Components, data fetching is excluded from pre-renders by default unless explicitly cached, which is the opposite of today's implicit-static behaviour.
**Why it happens:** The directive's *syntax* is stable in Next 16 (confirmed), but its *effect* is gated behind an experimental-turned-stable config flag that this project has never enabled — no existing route in the codebase uses `"use cache"` (`grep -rn "use cache" app lib components` returns nothing).
**How to avoid:** For this phase, skip the directive entirely. `/analytics` has no dynamic Request APIs (no `cookies()`, `headers()`, or `searchParams` reads in the MVP hub-only design per D-13/D-15), so it already qualifies for Next's default automatic static rendering — the exact mechanism `/sessions` and `/sessions/[sessionNumber]` already rely on with zero caching code. This satisfies "cache aggressively" without touching a global flag.
**Warning signs:** If a future task adds `"use cache"` to `lib/analytics.ts` or `app/analytics/page.tsx` without also adding `cacheComponents: true` to `next.config.ts`, the directive is a silent no-op — no error, no warning, just no caching benefit. If `cacheComponents` *is* added, every other route needs re-verification (especially the dashboard's `headers()`-based session check and any Server Action mutations).

### Pitfall 2: `artist_tags` is keyed by `artistName` text, not an artist ID — collisions are possible
**What goes wrong:** Two different artists that happen to share an exact string (e.g., a common band name) would incorrectly share the same tag rows.
**Why it happens:** `db/schema.ts` has no `artists` table — `artist_tags.artistName` is a free-text join key against `tracks.artistName`, an existing Phase 2 design choice, not something to "fix" in this phase.
**How to avoid:** Nothing to build differently — just don't be surprised if a rare edge case surfaces during UAT; it's a pre-existing data-model characteristic, out of scope to redesign here.
**Warning signs:** A contributor's "signature genre" looks obviously wrong for one specific artist name.

### Pitfall 3: Sessions with fewer than 4 contributors skew headline counts
**What goes wrong:** Two known sessions (25 and 28, per `.planning/STATE.md` deviation notes) are 3-person "MIA/AWOL" sessions where attribution round-robins over only the present contributors. A Wrapped card's "sessions appeared in" count will legitimately be less than 31 for whoever was absent — this is correct data, not a bug, but could look like an error if not called out in the UI copy.
**Why it happens:** Documented deviation from `03-archive-browsing` UAT resolution (`ABSENCE_RE` / `INITIALS_TRIO_RE` handling).
**How to avoid:** Compute "sessions appeared in" as `COUNT(DISTINCT sessionId)` over each contributor's actually-attributed rows — don't hardcode an assumption of 31 for everyone.
**Warning signs:** A Wrapped card headline count that doesn't match 31 for one person and looks inconsistent next to the other three.

### Pitfall 4: Null `release_year` and tagless artists need an explicit bucket, not silent exclusion
**What goes wrong:** Silently filtering out the 28 tracks with `release_year IS NULL` or the 18 artists with zero `artist_tags` rows would make percentages/totals across charts not sum to each person's actual track count, which will look wrong the moment someone cross-checks a Wrapped card total against a bar chart.
**Why it happens:** It's tempting to `WHERE release_year IS NOT NULL` and move on.
**How to avoid:** Give both an explicit bucket — "Unknown" for era, "Unspecified" for genre — and include them in every chart/count so the numbers are internally consistent (D-02 already locks this for era; extend the same principle to genre for consistency, since D-01 doesn't explicitly address the no-tag case).
**Warning signs:** Sum of a person's genre-breakdown chart segments ≠ their total track count.

## Code Examples

### Decade rollup from `release_year`
```typescript
// Source: derived directly from db/schema.ts tracks.releaseYear (integer, nullable)
function toDecadeBucket(releaseYear: number | null): string {
  if (releaseYear === null) return "Unknown";
  const decade = Math.floor(releaseYear / 10) * 10;
  return `${decade}s`;
}
```

### shadcn radar chart, coloured per contributor (not the default `--chart-N` palette)
```typescript
// Source: Context7 /shadcn-ui/ui chart-radar-default.tsx pattern, adapted to
// use CONTRIBUTOR_COLORS instead of the theme's chart-1..5 vars, since each
// radar represents one specific person, not a generic data series.
"use client";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

export function TasteProfileRadar({
  initials,
  data, // [{ genre: "Rock", count: 12 }, ...]
}: {
  initials: string;
  data: { genre: string; count: number }[];
}) {
  const color = CONTRIBUTOR_COLORS[initials]?.bg ?? "var(--chart-1)";
  const chartConfig = {
    count: { label: "Tracks", color },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[280px]">
      <RadarChart data={data}>
        <ChartTooltip content={<ChartTooltipContent />} />
        <PolarAngleAxis dataKey="genre" />
        <PolarGrid />
        <Radar dataKey="count" fill={color} fillOpacity={0.5} stroke={color} />
      </RadarChart>
    </ChartContainer>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `experimental.ppr` / `experimental.dynamicIO` flags | `cacheComponents: true` in `next.config.ts` | Next.js 16 (per Context7 `version-16.mdx` migration guide) | Not relevant to this phase since we're deliberately not enabling it — noted for the planner's awareness only |
| shadcn `v3.shadcn.com` chart docs (Recharts 2.x era) | shadcn `apps/v4` chart registry (Recharts 3.x, `PolarGrid`/`Radar` API stable since 2.x, unaffected) | Ongoing | No breaking API changes affect the radar/bar patterns used here |

**Deprecated/outdated:** None specific to this phase's scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Genre whitelist and synonym groupings (e.g. "hip-hop"/"hip hop"/"rap" → Hip-Hop) are a reasonable curation of the actual 370 tags | Architecture Pattern 1 | Low — this is explicitly "Claude's discretion" territory per CONTEXT.md; the group can rename/regroup individual genres trivially since it's one flat object literal. Worst case: a genre bucket feels "off" and gets relabeled during UAT. |
| A2 | Similarity weight split 0.7 artist / 0.3 genre | Architecture Pattern 4 | Medium — changes which pairs look "most similar." D-04 locks the *blend* concept but not the ratio; if UAT feedback says two people who share genre-only taste don't feel "similar enough," this constant is the one-line fix. |
| A3 | Divergence profile blend 0.5 genre / 0.5 era | Architecture Pattern 5 | Medium — could shift who ranks as "the wildcard." Same mitigation: single named constant, easy to retune. |
| A4 | No `"use cache"` for this phase; rely on Next's default static rendering instead of enabling `cacheComponents` | Pitfall 1 | Low-Medium — if the planner disagrees and wants explicit cache control immediately, enabling `cacheComponents: true` requires re-verifying `app/dashboard/page.tsx`'s `headers()`-based auth check and any Server Actions still behave correctly under Cache Components' dynamic-by-default model. This is a bigger task than "add a directive," so flag it explicitly if chosen. |
| A5 | Genre resolution uses single highest-ranked whitelisted tag per artist (not multi-label) for all downstream uses | Architecture Pattern 2 | Low — a deliberate simplicity tradeoff; multi-label would need reconciling "genre breakdown sums to 100%" with "similarity vectors benefit from richer tagging," which is unnecessary complexity for 4 users and ~500 tracks. |

## Open Questions

1. **Should the group-unique pick (D-12b) prefer artist-exclusivity or genre-exclusivity when both exist?**
   - What we know: D-12b specifies "a genre/artist that ONLY they chose" as one combined concept.
   - What's unclear: If a contributor has both an exclusive artist and an exclusive genre, which one becomes "the" standout pick on their Wrapped card?
   - Recommendation: Prefer artist-exclusivity first (more personal/specific per D-04's own stated rationale), fall back to genre-exclusivity only if no exclusive artist exists. This is encoded as the fallback order in Pattern 6 — flag to the user during a checkpoint if the resulting picks feel wrong for any of the four.

2. **Exact wording/copy for the "wildcard" and Wrapped cards.**
   - What we know: D-something notes this should be "fun/personal ... not clinical."
   - What's unclear: Actual microcopy is a UI/UX decision, not a research question.
   - Recommendation: Leave copywriting to the planner/UI-spec step; this research only guarantees the underlying numbers are computed correctly.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `local.db` (libSQL/SQLite file) | All aggregation queries | ✓ | — (474 session_tracks, 1937 artist_tags rows confirmed live) | — |
| `recharts` npm package | Radar/bar charts | ✗ (not yet installed — see Package Legitimacy Audit note on reverted side effect) | 3.10.1 available on registry | Install via `npx shadcn@latest add chart` as a phase task |
| Node.js | Build/dev | ✓ | (project already running; `next dev`/`npm view` succeeded) | — |

**Missing dependencies with no fallback:**
- None — `recharts`/shadcn chart install is a normal phase task, not a blocker.

## Project Constraints (from CLAUDE.md)

| Directive | Applies in Phase 4 |
|-----------|--------------------|
| Next.js 16 App Router — `app/` directory, RSC patterns | YES — `app/analytics/page.tsx` is a new RSC route |
| `proxy.ts` not `middleware.ts` | YES — `/analytics` needs no route gating (public), don't touch `proxy.ts` matcher |
| Drizzle ORM via `db/schema.ts` | YES — all queries go through `lib/db.ts`'s `db` export, no raw SQL |
| Biome linting conventions (type imports first, `drizzle-orm` before `next/*`) | YES — all new files must comply |
| shadcn v4 radix-nova preset, existing `--chart-1..5` CSS vars | YES — install chart component via CLI, override per-contributor colours via `CONTRIBUTOR_COLORS` rather than the generic chart palette (Code Example 2) |
| `"use cache"` directive "stable in Next.js 16" | **PARTIALLY CONTRADICTED by live verification** — the directive requires `cacheComponents: true`, which is not set. Recommendation: do not enable it this phase; rely on default static rendering (Pitfall 1). Flag this discrepancy to the user if they want the CLAUDE.md guidance followed literally. |
| No Spotify links (Premium/import deferred) | N/A — analytics has no track links in this phase's scope (Wrapped cards show stats, not clickable tracks per D-15) |
| Atomic commits per task | YES |
| Zod for input validation | N/A — `/analytics` hub has no user input/forms in MVP scope (D-13/D-15 lock a single static hub, no query params) |

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` (default: enabled), included per protocol. Applicability is low — this is a read-only, unauthenticated, no-input page.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Route is intentionally public per D-13/ACCESS-04; no session check needed |
| V3 Session Management | No | No session state created or read on this route |
| V4 Access Control | No | No write operations, no role-gated data — same posture as `/sessions` |
| V5 Input Validation | N/A (no input) | MVP hub has no query params/form inputs; if a future polish phase adds filters, validate with Zod per existing project convention |
| V6 Cryptography | No | No secrets, tokens, or crypto operations touch this route |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| SQL injection via unparameterised queries | Tampering | N/A here — all queries use Drizzle's query builder (parameterised by construction), no raw SQL string interpolation anywhere in the recommended patterns above |
| Information disclosure via overly verbose error pages | Information Disclosure | Next.js default error boundaries already apply; no new exposure surface introduced (no new secrets, no new PII — contributor names are already public per Phase 3) |

## Sources

### Primary (HIGH confidence — directly read/queried)
- `db/schema.ts` — full table shapes for `sessions`, `tracks`, `sessionTracks`, `contributors`, `artistTags`
- Live query against `local.db` — 370 distinct `artist_tags.tag` values with counts; 474 `session_tracks` rows, 0 null attribution, 28 null `release_year`, 413 distinct artists, 18 artists with zero tags, 0 sessions with `attribution_parsed = false`
- `app/dashboard/page.tsx`, `app/sessions/[sessionNumber]/page.tsx` — existing RSC + Drizzle query patterns (no `"use cache"` used anywhere today, confirmed via `grep -rn "use cache" app lib components` → no matches)
- `lib/contributor-colors.ts`, `components/ContributorChip.tsx` — reusable colour/identity assets
- `components/GlobalHeader.tsx` — nav link insertion point
- `package.json`, `components.json` — confirmed shadcn `radix-nova` preset, Tailwind v4, no charting library currently installed
- `app/globals.css` — confirmed `--chart-1..5` CSS vars already exist (greyscale radix-nova defaults)
- Context7 `/shadcn-ui/ui` — chart install command, `chart-radar-default.tsx`, `chart-radar-grid-fill.tsx`, `chart-bar-multiple.tsx`, `chart-bar-horizontal.tsx` source snippets, charts registry listing (14 radar variants, 10 bar variants)
- Context7 `/vercel/next.js` — `"use cache"` directive semantics, `cacheLife` API, `cacheComponents` config flag requirement, version-16 migration guide
- `npm view recharts version` / `.time.created` / `.dist-tags` / `.peerDependencies` — 3.10.1, first published 2015-08-07, React 16-19 peer range confirmed
- `npmjs.org` downloads API — 56.9M weekly downloads for `recharts`
- `slopcheck install recharts` — `[OK]` verdict (side effect reverted via `git checkout` + `npm prune`)
- `.planning/STATE.md` — confirmed 3-person sessions 25/28 deviation, round-robin attribution fix (commit `961a9ad`)
- `.planning/config.json` — `nyquist_validation: false` (Validation Architecture section correctly omitted); no `security_enforcement` key (defaults enabled, minimal Security Domain section included)

### Secondary (MEDIUM confidence)
- WebSearch cross-check confirming "`use cache` does nothing without `cacheComponents: true`" against Context7 findings — consistent across `nextjs.org` docs pages and third-party 2026 migration guides

### Tertiary (LOW confidence)
- None — every claim above was either directly verified against this codebase/database or against Context7/official docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions, peer deps, and install path all verified live against the npm registry and Context7's official shadcn docs
- Architecture: HIGH for aggregation/caching patterns (verified against actual codebase conventions and live DB shape); MEDIUM for the exact similarity/divergence weightings (standard math, but the specific constants are this research's recommendation, not a locked spec — see Assumptions Log)
- Pitfalls: HIGH — the `"use cache"`/`cacheComponents` finding was independently verified via Context7 official docs, a WebSearch cross-check, and a direct `grep` of the codebase confirming zero existing usage

**Research date:** 2026-08-11
**Valid until:** 30 days (stable stack; the only fast-moving risk is Next.js 16.x point releases changing `cacheComponents` defaults, unlikely within 30 days)
