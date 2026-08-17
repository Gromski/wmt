// duration.test.ts — specification harness for lib/duration.ts. Pure math,
// no DB/import-chain dependencies — runnable directly via
// `npx tsx lib/duration.test.ts`, mirroring lib/similarity.test.ts /
// lib/wrapped.test.ts.

import assert from "node:assert/strict";

import { formatDuration, sessionLengthLabel, sumDurations } from "./duration";

function run() {
  // formatDuration: minutes only, below the hour threshold.
  assert.equal(formatDuration(47 * 60000), "47m");

  // formatDuration: hours + minutes.
  assert.equal(formatDuration(72 * 60000), "1h 12m");

  // formatDuration: exactly one hour.
  assert.equal(formatDuration(60 * 60000), "1h 0m");

  // formatDuration: zero.
  assert.equal(formatDuration(0), "0m");

  // formatDuration: sub-minute duration rounds down to 0m.
  assert.equal(formatDuration(20_000), "0m");

  // formatDuration: rounds to the nearest minute (29.6s over -> rounds up).
  assert.equal(formatDuration(3 * 60000 + 40_000), "4m"); // 3m40s -> rounds to 4m
  assert.equal(formatDuration(3 * 60000 + 20_000), "3m"); // 3m20s -> rounds to 3m

  // sumDurations: sums non-null, counts nulls.
  assert.deepEqual(sumDurations([60000, null, 120000, null]), {
    totalMs: 180000,
    unknownCount: 2,
  });

  // sumDurations: all null -> 0 total, full unknown count.
  assert.deepEqual(sumDurations([null, null]), {
    totalMs: 0,
    unknownCount: 2,
  });

  // sumDurations: empty array.
  assert.deepEqual(sumDurations([]), { totalMs: 0, unknownCount: 0 });

  // sessionLengthLabel: no unknowns -> no "+" suffix.
  assert.equal(sessionLengthLabel([60 * 60000, 12 * 60000]), "1h 12m");

  // sessionLengthLabel: one or more unknowns -> trailing "+".
  assert.equal(sessionLengthLabel([60 * 60000, 12 * 60000, null]), "1h 12m+");

  // sessionLengthLabel: all unknown -> "0m+".
  assert.equal(sessionLengthLabel([null, null]), "0m+");

  console.log("duration.test.ts: all assertions passed");
}

run();
