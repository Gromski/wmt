// wrapped.test.ts — specification harness for lib/wrapped.ts.
//
// NOTE: No test runner (vitest/jest) is configured in this repo yet (verified
// against package.json devDependencies at time of writing). This file is a
// colocated behavior specification pending a runner — it documents the
// required behaviors from 04-03-PLAN.md Task 1 and can be wired to
// `vitest`/`node --test` once a runner lands. Each case is a plain assertion
// using Node's built-in `assert`, runnable directly via
// `npx tsx lib/wrapped.test.ts`. No DB/import-chain dependencies — this
// module is pure math over the AnalyticsData shape, so (unlike
// parse-playlist.test.ts) no env loading is needed.

import assert from "node:assert/strict";

import type { AnalyticsData, AttributedRow } from "./analytics";
import { computeWrappedStats } from "./wrapped";

function row(
  overrides: Partial<AttributedRow> &
    Pick<AttributedRow, "contributorInitials">,
): AttributedRow {
  return {
    contributorName: overrides.contributorInitials,
    sessionId: 1,
    artistName: "Unknown Artist",
    primaryGenre: null,
    releaseYear: null,
    ...overrides,
  };
}

function run() {
  // Fixture: three contributors across three sessions (1, 2, 3).
  // A is present in all 3 sessions, B is present in sessions 1-2 only,
  // C is present in sessions 1-3.
  //
  // Artist "Shared Band" is chosen by both A and B (NOT exclusive to
  // either). Artist "A Only Band" is chosen only by A (exclusive). B has no
  // exclusive artist but has an exclusive genre "Jazz" (only B chose Jazz).
  // C has neither an exclusive artist nor an exclusive genre.
  const attributedRows: AttributedRow[] = [
    row({
      contributorInitials: "A",
      contributorName: "Alpha",
      sessionId: 1,
      artistName: "Shared Band",
      primaryGenre: "Rock",
      releaseYear: 1995,
    }),
    row({
      contributorInitials: "A",
      contributorName: "Alpha",
      sessionId: 2,
      artistName: "A Only Band",
      primaryGenre: "Rock",
      releaseYear: 2001,
    }),
    row({
      contributorInitials: "A",
      contributorName: "Alpha",
      sessionId: 3,
      artistName: "A Only Band",
      primaryGenre: "Rock",
      releaseYear: null,
    }),
    row({
      contributorInitials: "B",
      contributorName: "Beta",
      sessionId: 1,
      artistName: "Shared Band",
      primaryGenre: "Jazz",
      releaseYear: 1980,
    }),
    row({
      contributorInitials: "B",
      contributorName: "Beta",
      sessionId: 2,
      artistName: "Shared Band",
      primaryGenre: "Jazz",
      releaseYear: 1970,
    }),
    row({
      contributorInitials: "C",
      contributorName: "Charlie",
      sessionId: 1,
      artistName: "Rock Band",
      primaryGenre: "Rock",
      releaseYear: 2010,
    }),
    row({
      contributorInitials: "C",
      contributorName: "Charlie",
      sessionId: 2,
      artistName: "Rock Band",
      primaryGenre: "Rock",
      releaseYear: 2015,
    }),
    row({
      contributorInitials: "C",
      contributorName: "Charlie",
      sessionId: 3,
      artistName: "Rock Band",
      primaryGenre: "Rock",
      releaseYear: 2015,
    }),
  ];

  function buildContributor(
    initials: string,
    name: string,
  ): AnalyticsData["contributors"][number] {
    const rows = attributedRows.filter(
      (r) => r.contributorInitials === initials,
    );
    const artistCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    for (const r of rows) {
      artistCounts.set(r.artistName, (artistCounts.get(r.artistName) ?? 0) + 1);
      const genre = r.primaryGenre ?? "Unspecified";
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([artist, count]) => ({ artist, count }));
    const genreBreakdown = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([genre, count]) => ({ genre, count }));
    return {
      initials,
      name,
      topArtists,
      decadeHistogram: [],
      genreBreakdown,
      artistVector: {},
      genreVector: {},
      genreProportions: {},
      decadeProportions: {},
    };
  }

  const data: AnalyticsData = {
    contributors: [
      buildContributor("A", "Alpha"),
      buildContributor("B", "Beta"),
      buildContributor("C", "Charlie"),
    ],
    attributedRows,
  };

  const stats = computeWrappedStats(data);
  assert.equal(stats.length, 3);

  const a = stats.find((s) => s.initials === "A");
  const b = stats.find((s) => s.initials === "B");
  const c = stats.find((s) => s.initials === "C");
  assert.ok(a && b && c);

  // Exclusive-artist detection: "Shared Band" is chosen by A and B, so it
  // must NOT be returned as either's group-unique pick.
  assert.notEqual(a?.groupUniquePick?.value, "Shared Band");
  assert.notEqual(b?.groupUniquePick?.value, "Shared Band");

  // "A Only Band" is chosen only by A -> A's exclusive artist pick.
  assert.deepEqual(a?.groupUniquePick, {
    kind: "artist",
    value: "A Only Band",
  });

  // B has no exclusive artist ("Shared Band" is shared) but Jazz is chosen
  // only by B -> genre fallback.
  assert.deepEqual(b?.groupUniquePick, { kind: "genre", value: "Jazz" });

  // C has neither an exclusive artist ("Rock Band" is exclusive to C
  // actually — verify that case too: C IS the sole chooser of "Rock Band",
  // so C's pick should be that artist, not null).
  assert.deepEqual(c?.groupUniquePick, { kind: "artist", value: "Rock Band" });

  // Era range: A has years [1995, 2001, null] -> oldest 1995, newest 2001,
  // null excluded from min/max.
  assert.deepEqual(a?.eraRange, { oldest: 1995, newest: 2001 });

  // B has years [1980, 1970] -> oldest 1970, newest 1980.
  assert.deepEqual(b?.eraRange, { oldest: 1970, newest: 1980 });

  // Headline counts: A appears in sessions 1,2,3 (distinct = 3); B appears
  // in sessions 1,2 only (distinct = 2, not hardcoded 31/3).
  assert.equal(a?.headlineCounts.sessions, 3);
  assert.equal(b?.headlineCounts.sessions, 2);
  assert.equal(a?.headlineCounts.tracks, 3);
  assert.equal(a?.headlineCounts.distinctArtists, 2); // Shared Band + A Only Band

  // A contributor with zero dated tracks gets a null/null era range (not
  // tested directly above since all fixtures have at least one dated
  // track); assert the shape explicitly with a synthetic all-null case.
  const noDatesData: AnalyticsData = {
    contributors: [buildContributor("A", "Alpha")],
    attributedRows: attributedRows
      .filter((r) => r.contributorInitials === "A")
      .map((r) => ({ ...r, releaseYear: null })),
  };
  const noDatesStats = computeWrappedStats(noDatesData);
  assert.deepEqual(noDatesStats[0].eraRange, { oldest: null, newest: null });

  console.log("wrapped.test.ts: all assertions passed");
}

run();
