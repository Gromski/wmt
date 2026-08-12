import type { AnalyticsData } from "./analytics";

// Phase 4 ANALYTICS-04 — Wrapped-card standout stats (D-12). Pure functions
// over the already-aggregated AnalyticsData contract from lib/analytics.ts
// (Plan 01); no I/O, no DB access. Matches lib/similarity.ts's pure-module
// style (PATTERNS.md).

export type WrappedStats = {
  initials: string;
  name: string;
  signatureGenre: string; // top genreBreakdown entry (excl "Unspecified" if a real genre exists)
  topArtist: string; // #1 topArtists entry
  groupUniquePick: { kind: "artist" | "genre"; value: string } | null; // artist-first, genre fallback (D-12b)
  eraRange: { oldest: number | null; newest: number | null }; // by release_year (D-12c)
  headlineCounts: { tracks: number; distinctArtists: number; sessions: number }; // D-12d
};

// Given rows keyed by contributorInitials -> keyed value (artistName or
// primaryGenre), return the value(s) chosen by exactly one contributor,
// ranked by that contributor's count for the value (descending). Used for
// both artist-exclusivity and the genre-exclusivity fallback (RESEARCH
// Pattern 6 / Open Question 1: artist-exclusivity first, genre fallback).
function findExclusivePicks(
  rows: { contributorInitials: string; value: string | null }[],
): Map<string, string> {
  const valueToContributors = new Map<string, Set<string>>();
  const valueCounts = new Map<string, Map<string, number>>(); // value -> (contributor -> count)

  for (const row of rows) {
    if (row.value === null) continue;
    const contribSet = valueToContributors.get(row.value) ?? new Set();
    contribSet.add(row.contributorInitials);
    valueToContributors.set(row.value, contribSet);

    const counts = valueCounts.get(row.value) ?? new Map<string, number>();
    counts.set(
      row.contributorInitials,
      (counts.get(row.contributorInitials) ?? 0) + 1,
    );
    valueCounts.set(row.value, counts);
  }

  // exclusiveByContributor: contributor -> list of {value, count}
  const exclusiveByContributor = new Map<
    string,
    { value: string; count: number }[]
  >();
  for (const [value, contribSet] of valueToContributors) {
    if (contribSet.size !== 1) continue;
    const [only] = contribSet;
    const counts = valueCounts.get(value);
    const count = counts?.get(only) ?? 0;
    const list = exclusiveByContributor.get(only) ?? [];
    list.push({ value, count });
    exclusiveByContributor.set(only, list);
  }

  const result = new Map<string, string>();
  for (const [contributor, picks] of exclusiveByContributor) {
    const sorted = [...picks].sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value),
    );
    result.set(contributor, sorted[0].value);
  }
  return result;
}

export function computeWrappedStats(data: AnalyticsData): WrappedStats[] {
  const exclusiveArtists = findExclusivePicks(
    data.attributedRows.map((r) => ({
      contributorInitials: r.contributorInitials,
      value: r.artistName,
    })),
  );
  const exclusiveGenres = findExclusivePicks(
    data.attributedRows.map((r) => ({
      contributorInitials: r.contributorInitials,
      value: r.primaryGenre !== "Unspecified" ? r.primaryGenre : null,
    })),
  );

  return data.contributors.map((contributor) => {
    // signatureGenre: highest-count genre, preferring a real genre over
    // "Unspecified" when the person has any real-genre tracks (D-12a).
    const realGenre = contributor.genreBreakdown.find(
      (g) => g.genre !== "Unspecified",
    );
    const signatureGenre = realGenre
      ? realGenre.genre
      : (contributor.genreBreakdown[0]?.genre ?? "Unspecified");

    const topArtist = contributor.topArtists[0]?.artist ?? "";

    const exclusiveArtist = exclusiveArtists.get(contributor.initials);
    const exclusiveGenre = exclusiveGenres.get(contributor.initials);
    const groupUniquePick: WrappedStats["groupUniquePick"] = exclusiveArtist
      ? { kind: "artist", value: exclusiveArtist }
      : exclusiveGenre
        ? { kind: "genre", value: exclusiveGenre }
        : null;

    const rows = data.attributedRows.filter(
      (r) => r.contributorInitials === contributor.initials,
    );

    const years = rows
      .map((r) => r.releaseYear)
      .filter((y): y is number => y !== null);
    const eraRange = {
      oldest: years.length > 0 ? Math.min(...years) : null,
      newest: years.length > 0 ? Math.max(...years) : null,
    };

    const distinctArtists = new Set(rows.map((r) => r.artistName)).size;
    const distinctSessions = new Set(rows.map((r) => r.sessionId)).size;

    return {
      initials: contributor.initials,
      name: contributor.name,
      signatureGenre,
      topArtist,
      groupUniquePick,
      eraRange,
      headlineCounts: {
        tracks: rows.length,
        distinctArtists,
        sessions: distinctSessions,
      },
    };
  });
}
