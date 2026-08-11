# Phase 4: Analytics - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-11
**Phase:** 4-Analytics
**Areas discussed:** Defining "taste", Similarity & wildcard, Charts & visuals, Page structure, Standout picks

---

## Defining "taste"

| Question | Options | Selected |
|---|---|---|
| Genre source | Curated genre whitelist ✓ / Top-ranked tags as-is / Whitelist + 'Other' bucket | Curated genre whitelist |
| Era buckets | By decade / Individual years ✓(rolled up to decades) / Coarse eras | Individual years, rolled up into decades |
| Top artists | Top 5 ✓ / Top 10 / Top 5 + full on demand | Top 5 |

**Notes:** User wants year-level granularity preserved but decades as the display rollup.

---

## Similarity & wildcard

| Question | Options | Selected |
|---|---|---|
| Overlap basis | Artists + genres blended ✓ / Shared artists only / Shared genres only | Artists + genres blended |
| Metric | Normalised overlap ✓ / Raw shared counts | Normalised (Jaccard/cosine) |
| Wildcard def | Furthest from group average ✓ / Lowest average overlap | Furthest from group average |
| Divergence output | Ranked score for all four ✓ / Only the wildcard | Ranked score for all four, top highlighted |

---

## Charts & visuals

| Question | Options | Selected |
|---|---|---|
| Chart lib | shadcn/ui + Recharts ✓ / Lightweight CSS-SVG | shadcn/ui + Recharts (new dep) |
| Profile viz | Radar (genre) + bars (era/artists) ✓ / All bars / Radar everywhere | Radar for genre + bars for era/artists |
| Matrix viz | Colour heatmap grid ✓ / Ranked pair list / Table of numbers | Colour heatmap grid |
| Wrapped vibe | Bold Spotify-Wrapped ✓ / Understated stat cards | Bold Spotify-Wrapped style |

---

## Page structure

| Question | Options | Selected |
|---|---|---|
| Structure | One /analytics hub ✓ / Hub + per-person pages | Single /analytics hub |
| Nav | Header link ✓ / Link from sessions page | Permanent header link |
| Wrapped presentation | Inline section in hub ✓ / Dedicated shareable card view | Inline section |

---

## Standout picks (Wrapped cards)

| Question | Options | Selected |
|---|---|---|
| Which stats feature | Signature genre + #1 artist ✓ / Group-unique pick ✓ / Era range ✓ / Headline counts ✓ | All four |

**Notes:** "Most obscure" not computable (no popularity data); group-unique pick is the agreed stand-in.

## Claude's Discretion

- Server-side aggregation + caching approach (RSC + Drizzle, `"use cache"`).
- Exact normalisation formula (Jaccard vs cosine) and divergence distance metric.
- Chart styling, responsiveness, and empty/low-data handling.
- Curation of the actual genre whitelist from DB tag values (researcher task).

## Deferred Ideas

- Dedicated shareable Wrapped card routes (screenshot/full-screen).
- Per-person deep-dive `/analytics/[contributor]` pages.
- Artist popularity/obscurity metrics (needs new data source).
- Spotify-based analytics (Spotify import still deferred).
