// similarity.test.ts — specification harness for lib/similarity.ts.
//
// NOTE: No test runner (vitest/jest) is configured in this repo yet (verified
// against package.json devDependencies at time of writing). This file is a
// colocated behavior specification pending a runner — it documents the
// required behaviors from 04-02-PLAN.md Task 1 and can be wired to
// `vitest`/`node --test` once a runner lands. Each case is a plain assertion
// using Node's built-in `assert`, runnable directly via
// `npx tsx lib/similarity.test.ts`. No DB/import-chain dependencies — this
// module is pure math, so (unlike parse-playlist.test.ts) no env loading is
// needed.

import assert from "node:assert/strict";

import {
  buildOverlapMatrix,
  buildProfileVector,
  cosineSimilarity,
  divergenceRanking,
  PROFILE_WEIGHTS,
  pairwiseSimilarity,
  SIMILARITY_WEIGHTS,
} from "./similarity";

type DivergenceContrib = {
  initials: string;
  name: string;
  genreProportions: Record<string, number>;
  decadeProportions: Record<string, number>;
};

function run() {
  // cosineSimilarity of a vector with itself = 1
  {
    const v = { Beatles: 3, Blur: 1 };
    assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-9);
  }

  // cosineSimilarity with a disjoint vector = 0
  {
    const a = { Beatles: 3 };
    const b = { Blur: 1 };
    assert.equal(cosineSimilarity(a, b), 0);
  }

  // cosineSimilarity with an empty vector = 0 (no divide-by-zero / NaN)
  {
    const a = { Beatles: 3 };
    assert.equal(cosineSimilarity(a, {}), 0);
    assert.equal(cosineSimilarity({}, {}), 0);
    assert.ok(!Number.isNaN(cosineSimilarity(a, {})));
  }

  // cosineSimilarity is symmetric
  {
    const a = { Beatles: 3, Blur: 1, Bowie: 2 };
    const b = { Beatles: 1, Bowie: 5, Oasis: 4 };
    assert.equal(cosineSimilarity(a, b), cosineSimilarity(b, a));
  }

  // pairwiseSimilarity blends artist/genre cosines by SIMILARITY_WEIGHTS and
  // stays within [0,1]
  {
    assert.deepEqual(SIMILARITY_WEIGHTS, { artist: 0.7, genre: 0.3 });

    const aArtist = { Beatles: 2 };
    const aGenre = { Rock: 2 };
    const bArtist = { Beatles: 2 };
    const bGenre = { Jazz: 2 }; // disjoint genre, identical artist

    const score = pairwiseSimilarity(aArtist, aGenre, bArtist, bGenre);
    const expected =
      SIMILARITY_WEIGHTS.artist * cosineSimilarity(aArtist, bArtist) +
      SIMILARITY_WEIGHTS.genre * cosineSimilarity(aGenre, bGenre);
    assert.equal(score, expected);
    assert.equal(score, SIMILARITY_WEIGHTS.artist); // 0.7*1 + 0.3*0
    assert.ok(score >= 0 && score <= 1);
  }

  // buildOverlapMatrix: symmetric NxN, diagonal = 1
  {
    const contribs: {
      artistVector: Record<string, number>;
      genreVector: Record<string, number>;
    }[] = [
      { artistVector: { Beatles: 3 }, genreVector: { Rock: 3 } },
      {
        artistVector: { Beatles: 1, Blur: 2 },
        genreVector: { Rock: 1, Pop: 2 },
      },
      { artistVector: { Bowie: 4 }, genreVector: { Rock: 4 } },
    ];
    const matrix = buildOverlapMatrix(contribs);

    assert.equal(matrix.length, 3);
    for (let i = 0; i < 3; i++) {
      assert.equal(matrix[i][i], 1);
      for (let j = 0; j < 3; j++) {
        assert.equal(matrix[i][j], matrix[j][i]);
        assert.ok(matrix[i][j] >= 0 && matrix[i][j] <= 1);
      }
    }
  }

  // buildProfileVector: hand-computed check with an explicit `weights` arg
  {
    const contrib = {
      genreProportions: { Rock: 1 },
      decadeProportions: { "1990s": 1 },
    };

    const defaultVector = buildProfileVector(contrib);
    assert.deepEqual(defaultVector, {
      "genre:Rock": 1 * PROFILE_WEIGHTS.genre,
      "decade:1990s": 1 * PROFILE_WEIGHTS.era,
    });

    const customVector = buildProfileVector(contrib, { genre: 0.2, era: 0.8 });
    assert.deepEqual(customVector, {
      "genre:Rock": 0.2,
      "decade:1990s": 0.8,
    });

    // Passing a different `weights` yields a different vector — the
    // weighting is genuinely wired, not baked upstream.
    assert.notDeepEqual(defaultVector, customVector);
  }

  // divergenceRanking: sorted divergence-descending, wildcard = index 0
  {
    const contribs: DivergenceContrib[] = [
      {
        initials: "AA",
        name: "Alpha",
        genreProportions: { Rock: 1 },
        decadeProportions: { "1990s": 1 },
      },
      {
        initials: "BB",
        name: "Beta",
        genreProportions: { Rock: 1 },
        decadeProportions: { "1990s": 1 },
      },
      {
        initials: "CC",
        name: "Charlie",
        genreProportions: { Jazz: 1 },
        decadeProportions: { "2000s": 1 },
      },
    ];

    const ranking = divergenceRanking(contribs);
    assert.equal(ranking.length, 3);
    for (let i = 1; i < ranking.length; i++) {
      assert.ok(ranking[i - 1].divergence >= ranking[i].divergence);
    }
    // Charlie diverges most (disjoint genre + decade from Alpha/Beta) — the
    // wildcard is at index 0.
    assert.equal(ranking[0].initials, "CC");
  }

  // PROFILE_WEIGHTS is proven LIVE: two contrasting weight objects yield a
  // different wildcard/order over the SAME contributors.
  {
    const contribs: DivergenceContrib[] = [
      {
        initials: "A",
        name: "A",
        genreProportions: { Rock: 1 },
        decadeProportions: { "1990s": 1 },
      },
      {
        initials: "B",
        name: "B",
        genreProportions: { Rock: 1 },
        decadeProportions: { "2000s": 1 },
      },
      {
        initials: "C",
        name: "C",
        genreProportions: { Jazz: 1 },
        decadeProportions: { "1990s": 1 },
      },
    ];

    // A and B share genre (Rock) but differ in decade; A and C share decade
    // (1990s) but differ in genre. So a genre-only weighting should isolate
    // C as the wildcard, while an era-only weighting should isolate B.
    const genreOnly = divergenceRanking(contribs, { genre: 1, era: 0 });
    const eraOnly = divergenceRanking(contribs, { genre: 0, era: 1 });

    assert.equal(genreOnly[0].initials, "C");
    assert.equal(eraOnly[0].initials, "B");

    // Different weight objects produce different scores for the wildcard.
    const cGenreOnlyScore = genreOnly.find(
      (r) => r.initials === "C",
    )?.divergence;
    const cEraOnlyScore = eraOnly.find((r) => r.initials === "C")?.divergence;
    assert.notEqual(cGenreOnlyScore, cEraOnlyScore);

    // The overall order differs between the two weightings.
    const genreOnlyOrder = genreOnly.map((r) => r.initials);
    const eraOnlyOrder = eraOnly.map((r) => r.initials);
    assert.notDeepEqual(genreOnlyOrder, eraOnlyOrder);
  }

  console.log("similarity.test.ts: all assertions passed");
}

run();
