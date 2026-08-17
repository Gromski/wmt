import { asc, eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { resolveGenre } from "@/lib/genre-whitelist";

// Phase 4 ANALYTICS-01 — single-pass server aggregation over session_tracks +
// tracks + contributors + artist_tags. Returns a fully plain-serialisable
// object (no Map, no Date) so it can be handed straight to client chart
// components, mirroring app/sessions/page.tsx's query + in-memory grouping
// style (PATTERNS.md § lib/analytics.ts).

export type ContributorAnalytics = {
  initials: string; // "MW" | "JG" | "JS" | "IT"
  name: string;
  topArtists: { artist: string; count: number }[]; // top 5, count desc — D-03
  decadeHistogram: { decade: string; count: number }[]; // "1960s".."2020s" + "Unknown" — D-02
  genreBreakdown: { genre: string; count: number }[]; // incl "Unspecified" bucket — D-01 + Pitfall 4
  artistVector: Record<string, number>; // artistName -> track count (for Plan 02 similarity)
  genreVector: Record<string, number>; // genre -> track count incl "Unspecified" (Plan 02)
  // RAW, UNWEIGHTED proportions — each sums to ~1. Plan 02 applies the live
  // PROFILE_WEIGHTS blend on top of these; do NOT bake any weighting here.
  genreProportions: Record<string, number>;
  decadeProportions: Record<string, number>;
};

export type AttributedRow = {
  contributorInitials: string;
  contributorName: string;
  sessionId: number;
  artistName: string;
  title: string; // track title — repeat-detection key (lib/repeats.ts)
  sessionNumber: number; // human session number — repeat-detection key + Wrapped links
  primaryGenre: string | null; // null => "Unspecified" bucket
  releaseYear: number | null; // null => "Unknown" decade bucket
};

export type AnalyticsData = {
  contributors: ContributorAnalytics[]; // ordered MW, JG, JS, IT
  attributedRows: AttributedRow[]; // flat rows — Plan 03 wrapped stats consume these
};

// Contributor display order for the hub — MW, JG, JS, IT (D-13/D-14 default order).
const CONTRIBUTOR_ORDER = ["MW", "JG", "JS", "IT"];

function toDecadeBucket(releaseYear: number | null): string {
  if (releaseYear === null) return "Unknown";
  const decade = Math.floor(releaseYear / 10) * 10;
  return `${decade}s`;
}

type ArtistTagRow = { artistName: string; tag: string; rank: number };

function buildArtistGenreMap(
  tagRows: ArtistTagRow[],
): Map<string, string | null> {
  const byArtist = new Map<string, ArtistTagRow[]>();
  for (const row of tagRows) {
    const list = byArtist.get(row.artistName) ?? [];
    list.push(row);
    byArtist.set(row.artistName, list);
  }
  const result = new Map<string, string | null>();
  for (const [artist, rows] of byArtist) {
    const sorted = [...rows].sort((a, b) => a.rank - b.rank);
    const primary =
      sorted.map((r) => resolveGenre(r.tag)).find((g) => g !== null) ?? null;
    result.set(artist, primary);
  }
  return result;
}

function toProportions(counts: Map<string, number>): Record<string, number> {
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  const result: Record<string, number> = {};
  for (const [k, v] of counts) result[k] = v / total;
  return result;
}

function mapToRecord(counts: Map<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of counts) result[k] = v;
  return result;
}

// buildSharedGenreAxis — Phase 4 gap-closure (04-04, ANALYTICS-01 UAT fix).
// Pure helper (no DB/fetch) so all four TasteProfileRadar charts can plot the
// SAME ordered genre axis, making the four fingerprints directly comparable
// instead of each radar independently rendering its own 24-28 genres.
//
// Axis = OVERLAP genres (present for >=2 contributors, ranked by group-total
// desc, capped at `overlapCap`) + each contributor's single top UNIQUE genre
// (present for exactly 1 contributor, capped at `uniquesPerPerson` per
// person). "Unspecified" is always excluded. Deterministic: ties broken by
// genre name (localeCompare).
export function buildSharedGenreAxis(
  contributors: {
    initials: string;
    genreBreakdown: { genre: string; count: number }[];
  }[],
  opts?: { overlapCap?: number; uniquesPerPerson?: number },
): string[] {
  const overlapCap = opts?.overlapCap ?? 10;
  const uniquesPerPerson = opts?.uniquesPerPerson ?? 1;

  // Tally presence (how many contributors have this genre at all) and the
  // group-total count, skipping the "Unspecified" bucket entirely.
  const tally = new Map<string, { presence: number; total: number }>();
  for (const contributor of contributors) {
    for (const { genre, count } of contributor.genreBreakdown) {
      if (genre === "Unspecified" || count <= 0) continue;
      const existing = tally.get(genre);
      if (existing) {
        existing.presence += 1;
        existing.total += count;
      } else {
        tally.set(genre, { presence: 1, total: count });
      }
    }
  }

  const overlap = [...tally.entries()]
    .filter(([, v]) => v.presence >= 2)
    .sort((a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0]))
    .slice(0, overlapCap)
    .map(([genre]) => genre);

  const axis = [...overlap];
  const axisSet = new Set(axis);

  for (const contributor of contributors) {
    const uniques = contributor.genreBreakdown
      .filter(
        ({ genre, count }) =>
          genre !== "Unspecified" &&
          count > 0 &&
          tally.get(genre)?.presence === 1,
      )
      .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));

    let added = 0;
    for (const { genre } of uniques) {
      if (added >= uniquesPerPerson) break;
      if (axisSet.has(genre)) continue;
      axis.push(genre);
      axisSet.add(genre);
      added += 1;
    }
  }

  return axis;
}

// Shared decade axis so every contributor's era bar chart has the SAME bars
// in the same order (comparable shapes, matching the shared genre radar).
// Returns the chronological union of all decades any contributor has, with
// the "Unknown" bucket forced last. Each chart 0-fills decades it lacks.
export function buildSharedDecadeAxis(
  contributors: {
    decadeHistogram: { decade: string; count: number }[];
  }[],
): string[] {
  const present = new Set<string>();
  for (const contributor of contributors) {
    for (const { decade, count } of contributor.decadeHistogram) {
      if (count > 0) present.add(decade);
    }
  }

  return [...present].sort((a, b) => {
    if (a === "Unknown") return 1; // Unknown always last
    if (b === "Unknown") return -1;
    return a.localeCompare(b); // "1940s" < "1950s" < … < "2020s"
  });
}

export async function getAnalyticsData(): Promise<AnalyticsData> {
  // Query 1: attributed session_tracks joined to tracks/contributors.
  // leftJoin + explicit null-check mirrors the established local style
  // (app/sessions/page.tsx) even though 0 unattributed rows exist today —
  // a future null attribution degrades gracefully instead of crashing.
  const attributedRowsRaw = await db
    .select({
      contributorInitials: schema.contributors.initials,
      contributorName: schema.contributors.name,
      sessionId: schema.sessionTracks.sessionId,
      artistName: schema.tracks.artistName,
      title: schema.tracks.title,
      releaseYear: schema.tracks.releaseYear,
      sessionNumber: schema.sessions.sessionNumber,
    })
    .from(schema.sessionTracks)
    .leftJoin(
      schema.contributors,
      eq(schema.sessionTracks.attributedContributorId, schema.contributors.id),
    )
    .leftJoin(schema.tracks, eq(schema.tracks.id, schema.sessionTracks.trackId))
    .leftJoin(
      schema.sessions,
      eq(schema.sessions.id, schema.sessionTracks.sessionId),
    );

  // Query 2: all artist_tags ordered by artistName asc, rank asc.
  const tagRows = await db
    .select({
      artistName: schema.artistTags.artistName,
      tag: schema.artistTags.tag,
      rank: schema.artistTags.rank,
    })
    .from(schema.artistTags)
    .orderBy(asc(schema.artistTags.artistName), asc(schema.artistTags.rank));

  const artistGenreMap = buildArtistGenreMap(tagRows);

  // Drop rows missing a contributor or track — graceful degradation for a
  // future null attribution / dangling track reference (D-01/CONTEXT).
  const attributedRows: AttributedRow[] = [];
  for (const row of attributedRowsRaw) {
    if (
      !row.contributorInitials ||
      !row.contributorName ||
      !row.artistName ||
      !row.title ||
      row.sessionNumber === null
    ) {
      continue;
    }
    attributedRows.push({
      contributorInitials: row.contributorInitials,
      contributorName: row.contributorName,
      sessionId: row.sessionId,
      artistName: row.artistName,
      title: row.title,
      sessionNumber: row.sessionNumber,
      primaryGenre: artistGenreMap.get(row.artistName) ?? null,
      releaseYear: row.releaseYear ?? null,
    });
  }

  // Group attributed rows per contributor.
  const rowsByContributor = new Map<
    string,
    { name: string; rows: AttributedRow[] }
  >();
  for (const row of attributedRows) {
    const existing = rowsByContributor.get(row.contributorInitials);
    if (existing) {
      existing.rows.push(row);
    } else {
      rowsByContributor.set(row.contributorInitials, {
        name: row.contributorName,
        rows: [row],
      });
    }
  }

  const contributors: ContributorAnalytics[] = [];
  for (const initials of CONTRIBUTOR_ORDER) {
    const entry = rowsByContributor.get(initials);
    if (!entry) continue;

    const artistCounts = new Map<string, number>();
    const decadeCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();

    for (const row of entry.rows) {
      artistCounts.set(
        row.artistName,
        (artistCounts.get(row.artistName) ?? 0) + 1,
      );

      const decade = toDecadeBucket(row.releaseYear);
      decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + 1);

      const genre = row.primaryGenre ?? "Unspecified";
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }

    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([artist, count]) => ({ artist, count }));

    const decadeHistogram = [...decadeCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([decade, count]) => ({ decade, count }));

    const genreBreakdown = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([genre, count]) => ({ genre, count }));

    contributors.push({
      initials,
      name: entry.name,
      topArtists,
      decadeHistogram,
      genreBreakdown,
      artistVector: mapToRecord(artistCounts),
      genreVector: mapToRecord(genreCounts),
      genreProportions: toProportions(genreCounts),
      decadeProportions: toProportions(decadeCounts),
    });
  }

  return { contributors, attributedRows };
}
