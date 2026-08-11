# Phase 4: Analytics - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

A **read-only, public (no-auth) analytics surface** that interrogates all 31 sessions to reveal each friend's musical taste and how the group compares. Delivers exactly four capabilities (ANALYTICS-01→04):

1. **Taste profile per friend** — most-chosen artists, era/decade distribution, genre breakdown.
2. **Pairwise overlap matrix** — which pairs share the most similar taste.
3. **Wildcard detection** — the friend who most consistently diverges from the group average.
4. **Wrapped-style summary cards** — headline stats + standout picks per friend.

All computed from data already in the DB (`sessions`, `session_tracks`, `tracks`, `contributors`, `artist_tags`). No new imports, no writes, no auth gating. New capabilities beyond these four (ratings, comments, cross-session recommendations, etc.) are out of scope.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — ANALYTICS-01…04 exact wording (§ Requirements, lines ~26–29) and status table.
- `.planning/ROADMAP.md` §"Phase 4: Analytics" — goal, success criteria, MVP mode, UI hint.
- `.planning/PROJECT.md` — core value ("who each person really is as a music-chooser"), the four contributors, constraints.

### Data model & prior decisions
- `db/schema.ts` — `sessions`, `tracks` (release_year, duration_ms, artist_name), `session_tracks` (position, attributed_contributor_id), `contributors` (MW/JG/JS/IT), `artist_tags` (artist_name, tag, rank) — the entire analytics input surface.
- `.planning/phases/03-archive-browsing/03-CONTEXT.md` — read-only public-surface pattern; contributor colour + chip decisions this phase reuses.
- `.planning/phases/02-import-pipeline/02-CONTEXT.md` — how artist_tags/enrichment and attribution were produced (data provenance for genre/era).

### Design stack
- `CLAUDE.md` §"Recommended Stack" / "shadcn/ui charts" — shadcn + Recharts is the sanctioned charting choice; RSC aggregation + `"use cache"` for read-only analytics pages.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/contributor-colors.ts` + `components/ContributorChip.tsx` (Phase 3) — per-person colour map for colour-coding every chart, heatmap, and Wrapped card.
- `components/GlobalHeader.tsx` — add the new "Analytics" nav link here (currently links Sessions + sign-in).
- shadcn/ui primitives present: `card`, `badge`, `avatar`, `table`, `select`, `separator`, `tooltip`, `progress` — reuse for layout/scaffolding around the new charts.
- Drizzle read patterns from `app/dashboard/page.tsx` and session pages — RSC + `db.select()` aggregation model to follow.

### Established Patterns
- Read-only public routes outside the authenticated segment (Phase 3 `/sessions`) — `/analytics` follows the same no-auth pattern.
- Contributor attribution flows through `session_tracks.attributed_contributor_id` — all per-person analytics group on this (note: some tracks may be unattributed where `attribution_parsed = false`; handle gracefully).

### Integration Points
- New `/analytics` route segment + `GlobalHeader` link.
- New shadcn chart component(s) + Recharts dependency install.
- Read-only Drizzle aggregation queries over the five domain tables.

</code_context>

<specifics>
## Specific Ideas

- The genre whitelist should be curated from the **actual** `artist_tags.tag` values in the DB, not an abstract genre taxonomy — researcher should survey the distinct tags first.
- "Wildcard" language and the Wrapped "group-unique pick" are meant to be fun/personal (this is a 4-friends-for-fun app), not clinical.
- Era rollup should let a decade summary be the headline while preserving the underlying year data (D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Dedicated shareable Wrapped card routes** (`/analytics/wrapped/[contributor]`, screenshot-friendly full-screen) — considered, deferred; hub-inline cards for this phase (D-15). Candidate for a future polish phase.
- **Per-person deep-dive pages** (`/analytics/[contributor]`) — considered, deferred in favour of the single hub (D-13).
- **Artist popularity / obscurity** metrics — not possible with current data (no listener/popularity counts); would require a new enrichment source. Group-unique pick (D-12b) is the stand-in.
- **Spotify-based analytics** — Spotify import remains deferred (no spotifyId data); out of scope.

</deferred>

---

*Phase: 4-Analytics*
*Context gathered: 2026-08-11*
