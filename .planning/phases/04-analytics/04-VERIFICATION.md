---
phase: 04-analytics
verified: 2026-08-12T00:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open /analytics in a real browser and inspect the four taste-profile radar/bar charts (TasteProfileRadar, EraBarChart, TopArtistsBarChart)"
    expected: "Recharts SVG renders correctly (radar polygon shape, bar heights, tooltips on hover, responsive resize), matching D-09"
    why_human: "Recharts requires a real browser DOM (ResizeObserver, SVG layout) that a headless curl/build check cannot exercise; only markup + embedded RSC payload data were confirmed programmatically"
  - test: "Open /analytics and visually inspect the 4x4 overlap heatmap and wildcard ranking box-shadow highlight"
    expected: "Cell colour intensity scales visibly with score, text stays legible against every contributor's background colour (including JS's amber row), and the wildcard ring/badge is visually distinct"
    why_human: "Colour-contrast and opacity-gradient legibility is a visual judgement; the fg/bg pairing and opacity formula were verified in code but pixel-level legibility was not"
  - test: "Open /analytics and inspect the four Wrapped cards for visual boldness/aesthetic quality and copy readability"
    expected: "Cards read as a fun, vivid, Spotify-Wrapped-style summary per D-11/D-12, with the 'Only <name> played <pick>' copy reading naturally for each of the four real picks and layout holding up on mobile widths"
    why_human: "Aesthetic/tone quality ('bold', 'fun/personal', mobile responsiveness) is not verifiable by grep or curl; only the presence of correct real data was confirmed"
---

# Phase 4: Analytics Verification Report

**Phase Goal:** Any user can interrogate each friend's musical taste and see how the group compares across 31 (currently 32) sessions.
**Verified:** 2026-08-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Taste profile per friend — most-chosen artists, decade distribution, genre breakdown (ANALYTICS-01) | VERIFIED | `lib/analytics.ts` `getAnalyticsData()` performs 2 real Drizzle queries over `sessionTracks`/`tracks`/`contributors`/`artistTags`, builds `topArtists` (top 5), `decadeHistogram` (incl. "Unknown"), `genreBreakdown` (incl. "Unspecified"). `app/analytics/page.tsx` renders `TasteProfileRadar`/`EraBarChart`/`TopArtistsBarChart` per contributor. Curled production build HTML embeds real genre counts (e.g. `{"genre":"Electronic","count":12}`) and real headline counts (120/111/32 tracks/artists/sessions for MW) — no noise tags ("welsh", "seen live", decade tags) appear anywhere in the rendered genre data. |
| 2 | Pairwise overlap matrix showing which pairs share the most similar taste (ANALYTICS-02) | VERIFIED | `lib/similarity.ts` `buildOverlapMatrix`/`pairwiseSimilarity`/`cosineSimilarity` blend artist (0.7) + genre (0.3) cosine similarity into a symmetric 4x4 matrix, diagonal forced to 1. `OverlapHeatmap.tsx` renders it as a CSS-grid heatmap with `CONTRIBUTOR_COLORS`-based opacity scaling. Curled production HTML shows real varying scores (0.03, 0.05, 0.06, 0.27, 0.28, 0.32) — not a stub/static matrix. `npx tsx lib/similarity.test.ts` passes, proving symmetry/diagonal/blend behavior. |
| 3 | The friend who most consistently diverges from the group average is identified/surfaced (ANALYTICS-03) | VERIFIED | `divergenceRanking()` builds each contributor's weighted profile vector via `buildProfileVector(contrib, weights)` (LIVE `PROFILE_WEIGHTS`), computes the group centroid, ranks by `1 - cosineSimilarity(vector, centroid)` descending. `WildcardRanking.tsx` renders all four ranked with the top one badged "The Wildcard". Curled HTML confirms "The Wildcard" renders twice (label + section heading) with real per-person divergence scores. Test suite explicitly proves `PROFILE_WEIGHTS` is genuinely wired (not baked upstream): two contrasting weight objects (`{genre:1,era:0}` vs `{genre:0,era:1}`) over the same fixture contributors produce different wildcards (C vs B) — this closes the specific blocker called out in the phase brief. |
| 4 | Each friend has a Wrapped-style summary card with headline stats + standout picks (ANALYTICS-04) | VERIFIED | `lib/wrapped.ts` `computeWrappedStats()` computes `signatureGenre`, `topArtist`, `groupUniquePick` (global exclusivity map, artist-first/genre-fallback), `eraRange` (min/max non-null year), `headlineCounts` (`tracks`/`distinctArtists`/`sessions`, `sessions` = `COUNT(DISTINCT sessionId)`, never hardcoded). `WrappedCard.tsx` renders one bold card per contributor coloured via `CONTRIBUTOR_COLORS`. Curled production HTML shows four real, distinct picks ("Only Mark Wright played Daft Punk", "Only Jack Groves played Jimi Tenor", "Only Jon Slade played Dexter Wansel", "Only Iwan Thomas played Peter Gabriel") and real, *varying* session counts (32/32/29/31 — not a hardcoded 31), confirming Pitfall 3 is genuinely closed against production data (JS and IT are correctly shown as absent from some sessions). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/genre-whitelist.ts` | `GENRE_MAP`, `normalizeTag`, `resolveGenre` | VERIFIED | All three exported; curated map present; absence-is-exclusion documented and confirmed live (no noise tags in rendered output) |
| `lib/analytics.ts` | `getAnalyticsData()` returning stable `AnalyticsData` contract | VERIFIED | Matches `<interfaces>` contract exactly (contributors[], attributedRows[], raw unweighted `genreProportions`/`decadeProportions`, no pre-baked profileVector) |
| `lib/similarity.ts` | Cosine/blend/matrix/profile-vector/divergence math + tuning constants | VERIFIED | All 7 named exports present (`cosineSimilarity`, `pairwiseSimilarity`, `buildOverlapMatrix`, `buildProfileVector`, `divergenceRanking`, `SIMILARITY_WEIGHTS`, `PROFILE_WEIGHTS`); `divergenceRanking` routes every contributor through `buildProfileVector` (no shortcut reading a pre-baked vector) |
| `lib/similarity.test.ts` | node:assert spec | VERIFIED | `npx tsx lib/similarity.test.ts` exits 0, all assertions pass (confirmed by direct execution, not SUMMARY claim) |
| `lib/wrapped.ts` | `computeWrappedStats()` | VERIFIED | Matches `WrappedStats` contract; exclusivity computed globally over `attributedRows`; genre fallback excludes "Unspecified" |
| `lib/wrapped.test.ts` | node:assert spec | VERIFIED | `npx tsx lib/wrapped.test.ts` exits 0, all assertions pass (confirmed by direct execution) |
| `components/analytics/TasteProfileRadar.tsx` / `EraBarChart.tsx` / `TopArtistsBarChart.tsx` | Client Recharts components, `CONTRIBUTOR_COLORS`-coloured | VERIFIED | All three `"use client"`, import `recharts` + `@/components/ui/chart` + `CONTRIBUTOR_COLORS`, empty-state guard present |
| `components/analytics/OverlapHeatmap.tsx` / `WildcardRanking.tsx` | Server components, CSS-grid heatmap + ranked list | VERIFIED | Plain server components (no `"use client"`), colour via `CONTRIBUTOR_COLORS`, diagonal "—", top-entry highlight |
| `components/analytics/WrappedCard.tsx` | Bold per-contributor card | VERIFIED | Plain server component, inline `backgroundColor`/`color` from `CONTRIBUTOR_COLORS`, graceful null handling for era range and group-unique pick |
| `app/analytics/page.tsx` | Public RSC hub, D-13 order | VERIFIED | No auth/redirect/`"use cache"`; renders Group overview → Taste profiles → Wrapped, exactly matching the locked page order |
| `components/GlobalHeader.tsx` | Analytics nav link | VERIFIED | `<Link href="/analytics">Analytics</Link>` present as first child of `<nav>`, renders on every page (header is global) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/analytics/page.tsx` | `lib/analytics.ts` | `await getAnalyticsData()` | WIRED | Called once, result used across all three sections |
| `lib/analytics.ts` | `lib/genre-whitelist.ts` | `resolveGenre()` | WIRED | Used inside `buildArtistGenreMap` |
| `components/GlobalHeader.tsx` | `/analytics` | nav Link | WIRED | Confirmed rendered in curled `/sessions` HTML (per Plan 01 SUMMARY) and present in source |
| `app/analytics/page.tsx` | `lib/similarity.ts` | `buildOverlapMatrix` + `divergenceRanking` | WIRED | Both called with `contributors`, output passed to `OverlapHeatmap`/`WildcardRanking` |
| `lib/similarity.ts` `buildProfileVector` | `divergenceRanking` | live `PROFILE_WEIGHTS` | WIRED | `divergenceRanking` calls `buildProfileVector(contrib, weights)` for every contributor — no pre-baked vector shortcut. Proven live by test with two contrasting weight objects producing different wildcards. |
| `app/analytics/page.tsx` | `lib/wrapped.ts` | `computeWrappedStats(data)` | WIRED | Called once, output mapped to `WrappedCard` components |
| `components/analytics/*.tsx` | `lib/contributor-colors.ts` | `CONTRIBUTOR_COLORS[initials]` | WIRED | Every analytics component resolves colour through this single source; no second palette introduced |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `TasteProfileRadar`/`EraBarChart`/`TopArtistsBarChart` | `contributor.genreBreakdown`/`decadeHistogram`/`topArtists` | `getAnalyticsData()` → 2 real Drizzle queries over `local.db` | Yes — curled production HTML shows real genre counts, real decade buckets, real top-5 artist names | FLOWING |
| `OverlapHeatmap`/`WildcardRanking` | `matrix`/`ranking` | `buildOverlapMatrix`/`divergenceRanking` over `contributors[].artistVector/genreVector/genreProportions/decadeProportions` | Yes — curled HTML shows varying, non-trivial similarity scores (0.03–0.32) | FLOWING |
| `WrappedCard` | `wrapped` (per-contributor `WrappedStats`) | `computeWrappedStats(data)` over `attributedRows` | Yes — curled HTML shows real distinct group-unique picks and real, varying session counts (32/32/29/31, not hardcoded 31) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| similarity math test suite | `npx tsx lib/similarity.test.ts` | `similarity.test.ts: all assertions passed` | PASS |
| wrapped stats test suite | `npx tsx lib/wrapped.test.ts` | `wrapped.test.ts: all assertions passed` | PASS |
| typecheck | `npm run typecheck` | exits 0, no errors | PASS |
| lint | `npm run lint` | "Checked 66 files in 48ms. No fixes applied." | PASS |
| build | `npm run build` | Compiles; `/analytics` listed as static (`○`) route | PASS |
| production render (real data) | `next start` + `curl /analytics` | Real per-contributor genre/artist/session data, real varying similarity scores, real distinct group-unique picks, session counts 32/32/29/31 (not hardcoded 31) | PASS |
| commit integrity | `git cat-file -e <hash>` for all 8 SUMMARY-referenced commits | All 8 present in repo history | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention or explicit probe declarations exist for this phase — the phase uses colocated `node:assert` spec files (`lib/similarity.test.ts`, `lib/wrapped.test.ts`) as its runnable verification, which were executed directly above (Behavioral Spot-Checks). Step 7c: SKIPPED (no probe-script convention used by this phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| ANALYTICS-01 | 04-01-PLAN.md | Taste profile per friend | SATISFIED | `lib/analytics.ts` + 3 chart components + hub section, verified against real DB data |
| ANALYTICS-02 | 04-02-PLAN.md | Pairwise overlap matrix | SATISFIED | `lib/similarity.ts` + `OverlapHeatmap`, verified real varying scores |
| ANALYTICS-03 | 04-02-PLAN.md | Wildcard divergence identification | SATISFIED | `divergenceRanking` + `WildcardRanking`, PROFILE_WEIGHTS liveness proven in test |
| ANALYTICS-04 | 04-03-PLAN.md | Wrapped-style summary card | SATISFIED | `lib/wrapped.ts` + `WrappedCard`, real distinct picks and non-hardcoded session counts confirmed against production build |

No orphaned requirements found for Phase 4 in REQUIREMENTS.md.

### Anti-Patterns Found

None. Grepped all phase-shipped files (`lib/genre-whitelist.ts`, `lib/analytics.ts`, `lib/similarity.ts`, `lib/wrapped.ts`, `components/analytics/*.tsx`, `app/analytics/page.tsx`, `components/GlobalHeader.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and casual placeholder language — zero matches.

### Human Verification Required

### 1. Interactive chart rendering (Recharts)

**Test:** Open `/analytics` in a real browser and interact with the four taste-profile charts (radar, era bar, top-artists bar) for each contributor — hover for tooltips, check responsive resize.
**Expected:** SVG renders correctly with legible axes, tooltips on hover, and no layout breakage at common viewport widths.
**Why human:** Recharts requires a real browser DOM (ResizeObserver, SVG measurement) a headless environment cannot exercise. Only the underlying data/markup was confirmed programmatically (curl + build), not visual/interactive rendering, per both 04-01 and 04-02 SUMMARY.md's own "Deferred to human/browser verification" notes.

### 2. Heatmap and wildcard visual legibility

**Test:** Open `/analytics` and visually inspect the 4x4 overlap heatmap's colour-opacity gradient and the wildcard ranking's highlight box-shadow, across all four contributor colours (including JS's amber row, which was specifically fixed for text contrast).
**Expected:** All cells stay legible at their computed opacity; the wildcard highlight is visually obvious.
**Why human:** Colour contrast/opacity legibility is a visual judgement call not verifiable via grep or curl.

### 3. Wrapped card aesthetic and copy quality

**Test:** Open `/analytics` and read all four Wrapped cards for tone/aesthetic quality ("bold Spotify-Wrapped aesthetic", fun/personal copy per D-11/D-12) and mobile-width layout.
**Expected:** Cards feel vivid/fun (not clinical), copy reads naturally for each real pick, and the layout holds up responsively.
**Why human:** Subjective aesthetic/tone assessment and responsive layout at real viewport widths cannot be verified headlessly.

## Gaps Summary

No functional gaps found. All four ANALYTICS success criteria are backed by real, wired, tested code that was independently executed against the actual `local.db` (32 sessions currently — the app correctly reflects live session counts rather than a hardcoded 31, e.g. JS shows 29 and IT shows 31 sessions appeared-in, both less than the 32 total sessions in the DB). The one previously-flagged risk area — whether `PROFILE_WEIGHTS` is genuinely wired through `buildProfileVector` → `divergenceRanking` rather than being a decorative constant — was independently re-derived by reading the code (not the SUMMARY) and confirmed: `divergenceRanking` has no code path that bypasses `buildProfileVector`, and the colocated test proves two different weight objects produce two different wildcards over an identical fixture.

Status is `human_needed` rather than `passed` solely because visual/interactive polish (chart rendering, colour legibility, card aesthetics) cannot be verified without a browser — this is explicitly out of scope for headless verification and was honestly flagged as deferred in the phase's own SUMMARY.md files, not glossed over.

---

*Verified: 2026-08-12*
*Verifier: Claude (gsd-verifier)*
