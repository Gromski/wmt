// analytics.test.ts — specification harness for buildSharedGenreAxis in
// lib/analytics.ts (Phase 4 gap-closure, 04-04-PLAN.md Task 1).
//
// No test runner (vitest/jest) configured in this repo yet — this is a
// colocated behavior specification, runnable directly via
// `npx tsx lib/analytics.test.ts`, mirroring lib/similarity.test.ts /
// lib/wrapped.test.ts. Pure math over plain objects — no DB/import-chain
// dependencies.

import assert from "node:assert/strict";

import { buildSharedGenreAxis } from "./analytics";

type Contributor = {
  initials: string;
  genreBreakdown: { genre: string; count: number }[];
};

function run() {
  // Fixture: 4 contributors, Rock/Soul shared by all, each with one distinct
  // unique genre, plus an "Unspecified" bucket that must never appear.
  const contributors: Contributor[] = [
    {
      initials: "MW",
      genreBreakdown: [
        { genre: "Rock", count: 10 },
        { genre: "Soul", count: 5 },
        { genre: "Synth-Pop", count: 3 },
        { genre: "Unspecified", count: 2 },
      ],
    },
    {
      initials: "JG",
      genreBreakdown: [
        { genre: "Rock", count: 8 },
        { genre: "Soul", count: 6 },
        { genre: "Post-Punk", count: 4 },
        { genre: "Unspecified", count: 1 },
      ],
    },
    {
      initials: "JS",
      genreBreakdown: [
        { genre: "Rock", count: 6 },
        { genre: "Soul", count: 4 },
        { genre: "Dubstep", count: 2 },
      ],
    },
    {
      initials: "IT",
      genreBreakdown: [
        { genre: "Rock", count: 4 },
        { genre: "Soul", count: 2 },
        { genre: "Psychedelic", count: 1 },
      ],
    },
  ];

  // Overlap ranking: Rock (total 28) ranks above Soul (total 17), both
  // present >=2 contributors -> both in overlap, Rock first.
  {
    const axis = buildSharedGenreAxis(contributors);
    const rockIdx = axis.indexOf("Rock");
    const soulIdx = axis.indexOf("Soul");
    assert.ok(rockIdx !== -1 && soulIdx !== -1, "Rock and Soul both present");
    assert.ok(rockIdx < soulIdx, "Rock (higher group total) ranks before Soul");
  }

  // Per-person unique inclusion: each contributor's distinct unique genre is
  // present in the axis.
  {
    const axis = buildSharedGenreAxis(contributors);
    assert.ok(axis.includes("Synth-Pop"), "MW's unique genre included");
    assert.ok(axis.includes("Post-Punk"), "JG's unique genre included");
    assert.ok(axis.includes("Dubstep"), "JS's unique genre included");
    assert.ok(axis.includes("Psychedelic"), "IT's unique genre included");
  }

  // Unspecified exclusion: never appears in the axis even though it has
  // presence >= 2 across MW/JG.
  {
    const axis = buildSharedGenreAxis(contributors);
    assert.ok(
      !axis.includes("Unspecified"),
      "Unspecified excluded even with presence >= 2",
    );
  }

  // Overall axis shape: 2 overlap genres + 4 unique genres = 6, in the
  // documented order (overlap first, then per-person uniques in contributor
  // order).
  {
    const axis = buildSharedGenreAxis(contributors);
    assert.deepEqual(axis, [
      "Rock",
      "Soul",
      "Synth-Pop",
      "Post-Punk",
      "Dubstep",
      "Psychedelic",
    ]);
  }

  // overlapCap: capping overlap to 1 keeps only Rock (top by group total),
  // still appends all four uniques.
  {
    const axis = buildSharedGenreAxis(contributors, { overlapCap: 1 });
    assert.equal(axis.filter((g) => g === "Rock" || g === "Soul").length, 1);
    assert.ok(axis.includes("Rock"));
    assert.ok(!axis.includes("Soul"));
    assert.equal(axis.length, 5); // Rock + 4 uniques
  }

  // uniquesPerPerson: capping to 0 means no per-person uniques are appended,
  // axis is overlap-only.
  {
    const axis = buildSharedGenreAxis(contributors, { uniquesPerPerson: 0 });
    assert.deepEqual(axis, ["Rock", "Soul"]);
  }

  // No-uniques contributor: a contributor whose every genre is also shared
  // by someone else contributes nothing extra, and the function doesn't
  // throw or pad with duplicates.
  {
    const noUniqueContributors: Contributor[] = [
      { initials: "A", genreBreakdown: [{ genre: "Jazz", count: 5 }] },
      { initials: "B", genreBreakdown: [{ genre: "Jazz", count: 3 }] },
    ];
    const axis = buildSharedGenreAxis(noUniqueContributors);
    assert.deepEqual(axis, ["Jazz"]);
  }

  // Deterministic tie-breaking: equal group totals fall back to genre name
  // localeCompare ordering.
  {
    const tiedContributors: Contributor[] = [
      {
        initials: "A",
        genreBreakdown: [
          { genre: "Zydeco", count: 5 },
          { genre: "Ambient", count: 5 },
        ],
      },
      {
        initials: "B",
        genreBreakdown: [
          { genre: "Zydeco", count: 5 },
          { genre: "Ambient", count: 5 },
        ],
      },
    ];
    const axis = buildSharedGenreAxis(tiedContributors);
    assert.deepEqual(axis, ["Ambient", "Zydeco"]);
  }

  // De-duplication: if a contributor's top unique happens to already be in
  // the axis (edge case with a tiny overlapCap forcing overlap genres out),
  // it must not be duplicated — verified implicitly by the deepEqual checks
  // above never containing repeats.
  {
    const axis = buildSharedGenreAxis(contributors);
    assert.equal(new Set(axis).size, axis.length, "no duplicate entries");
  }

  console.log("all assertions passed");
}

run();
