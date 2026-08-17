// repeats.test.ts — specification harness for lib/repeats.ts. Pure math, no
// DB/import-chain dependencies — runnable directly via
// `npx tsx lib/repeats.test.ts`, mirroring lib/similarity.test.ts /
// lib/wrapped.test.ts.

import assert from "node:assert/strict";

import { buildRepeatIndex, repeatedPicks, repeatKey } from "./repeats";

function run() {
  // repeatKey: case/whitespace-insensitive.
  assert.equal(
    repeatKey("  Life On Mars  ", " Dexter Wansel "),
    "life on mars :: dexter wansel",
  );

  const rows = [
    { title: "Life on Mars", artistName: "Dexter Wansel", sessionNumber: 3 },
    { title: "life on mars", artistName: "dexter wansel", sessionNumber: 12 },
    { title: "Life on Mars", artistName: "Dexter Wansel", sessionNumber: 25 },
    { title: "Solo Song", artistName: "Only Once", sessionNumber: 5 },
    {
      title: "Chameleon",
      artistName: "Herbie Hancock",
      sessionNumber: 7,
    },
    {
      title: "Chameleon",
      artistName: "Herbie Hancock",
      sessionNumber: 19,
    },
  ];

  const index = buildRepeatIndex(rows);

  // A key present in >=2 distinct sessions is included, with sorted distinct
  // session numbers.
  assert.deepEqual(
    index.get(repeatKey("Life on Mars", "Dexter Wansel")),
    [3, 12, 25],
  );
  assert.deepEqual(
    index.get(repeatKey("Chameleon", "Herbie Hancock")),
    [7, 19],
  );

  // A key present in only 1 session is omitted.
  assert.equal(index.get(repeatKey("Solo Song", "Only Once")), undefined);
  assert.equal(index.size, 2);

  // Duplicate rows within the SAME session count as one distinct session
  // (not a repeat on their own).
  const sameSessionRows = [
    { title: "Track A", artistName: "Artist A", sessionNumber: 1 },
    { title: "Track A", artistName: "Artist A", sessionNumber: 1 },
  ];
  assert.equal(buildRepeatIndex(sameSessionRows).size, 0);

  // repeatedPicks: a person's rows include one repeated song (Life on Mars,
  // sessions 3 and 25) and one non-repeated song. Only the repeated song
  // appears, with the FULL index session list (3, 12, 25) even though this
  // person only picked it in sessions 3 and 25.
  const personRows = [
    { title: "Life on Mars", artistName: "Dexter Wansel", sessionNumber: 3 },
    { title: "Life on Mars", artistName: "Dexter Wansel", sessionNumber: 25 },
    { title: "Solo Song", artistName: "Only Once", sessionNumber: 5 },
  ];
  const picks = repeatedPicks(personRows, index);
  assert.equal(picks.length, 1);
  assert.deepEqual(picks[0], {
    title: "Life on Mars",
    artist: "Dexter Wansel",
    sessions: [3, 12, 25],
  });

  // Sorting: multiple repeated picks are sorted by title.
  const multiPicksRows = [
    { title: "Chameleon", artistName: "Herbie Hancock", sessionNumber: 7 },
    {
      title: "Life on Mars",
      artistName: "Dexter Wansel",
      sessionNumber: 3,
    },
  ];
  const multiPicks = repeatedPicks(multiPicksRows, index);
  assert.deepEqual(
    multiPicks.map((p) => p.title),
    ["Chameleon", "Life on Mars"],
  );

  console.log("repeats.test.ts: all assertions passed");
}

run();
