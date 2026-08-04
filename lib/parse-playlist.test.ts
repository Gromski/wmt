// parse-playlist.test.ts — specification harness for parsePlaylistDescription.
//
// NOTE: No test runner (vitest/jest) is configured in this repo yet (verified against
// package.json devDependencies at time of writing). This file is a colocated behavior
// specification pending a runner — it documents the required behaviors from
// 03-01-PLAN.md Task 1 and can be wired to `vitest`/`node --test` once a runner lands.
// Each case is expressed as a plain assertion using Node's built-in `assert` so it CAN
// be run directly via `node --experimental-strip-types lib/parse-playlist.test.ts` once
// TypeScript execution is available, but is not currently wired into `npm test`.

import assert from "node:assert/strict";

import {
  parsePlaylistDescription,
  SESSION_PLAYLIST_RE,
  YOUTUBE_RE,
} from "./parse-playlist";

function run() {
  // youtubeUrl = short youtu.be URL when description contains one
  {
    const result = parsePlaylistDescription(
      "Session 07 — Desert Island Discs",
      "MW, JG, JS, IT — https://youtu.be/dQw4w9WgXcQ",
    );
    assert.equal(result.youtubeUrl, "https://youtu.be/dQw4w9WgXcQ");
  }

  // youtubeUrl = long youtube.com/watch?v= URL when description contains one
  {
    const result = parsePlaylistDescription(
      "Session 08 — Road Trip",
      "MW, JG, JS, IT — https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    assert.equal(
      result.youtubeUrl,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
  }

  // youtubeUrl = null when description contains no YouTube URL
  {
    const result = parsePlaylistDescription(
      "Session 09 — No Fallback",
      "MW, JG, JS, IT",
    );
    assert.equal(result.youtubeUrl, null);
  }

  // youtubeUrl = null when description is undefined
  {
    const result = parsePlaylistDescription(
      "Session 10 — Undefined",
      undefined,
    );
    assert.equal(result.youtubeUrl, null);
  }

  // Regression: existing sessionNumber / theme / initials extraction unchanged
  {
    const result = parsePlaylistDescription(
      "Session 07 — Desert Island Discs",
      "MW, JG, JS, IT",
    );
    assert.equal(result.sessionNumber, 7);
    assert.equal(result.theme, "Desert Island Discs");
    assert.deepEqual(result.initials, ["MW", "JG", "JS", "IT"]);
  }
  assert.ok(YOUTUBE_RE.test("https://youtu.be/dQw4w9WgXcQ"));
  assert.ok(YOUTUBE_RE.test("https://www.youtube.com/watch?v=dQw4w9WgXcQ"));
  assert.ok(!YOUTUBE_RE.test("not a url"));

  // SESSION_PLAYLIST_RE matches "Warwick Massive Tunage N" and captures the number
  assert.ok(SESSION_PLAYLIST_RE.test("Warwick Massive Tunage 1"));
  assert.ok(SESSION_PLAYLIST_RE.test("Warwick Massive Tunage 22"));
  assert.ok(SESSION_PLAYLIST_RE.test("Warwick Massive Tunage 32"));
  assert.equal(
    SESSION_PLAYLIST_RE.exec("Warwick Massive Tunage 22")?.[1],
    "22",
  );

  // SESSION_PLAYLIST_RE does NOT match editorial/seasonal playlists (Open Question 1 fix)
  assert.ok(!SESSION_PLAYLIST_RE.test("Autumnal Tracks '22"));
  assert.ok(!SESSION_PLAYLIST_RE.test("Winter Warmers '22"));
  assert.ok(!SESSION_PLAYLIST_RE.test("Ibiza 2026"));
  assert.ok(!SESSION_PLAYLIST_RE.test("Soul 45"));
  assert.ok(!SESSION_PLAYLIST_RE.test("Replay 2021"));
  assert.ok(!SESSION_PLAYLIST_RE.test("Sunday Morning 6 Music"));

  // MIA/AWOL absence handling — attribute over present contributors only
  {
    const result = parsePlaylistDescription(
      "Warwick Massive Tunage 28",
      "One hit wonders from four decades. MW, JG, IT, JS = MIA",
    );
    assert.deepEqual(result.initials, ["MW", "JG", "IT"]);
  }
  {
    const result = parsePlaylistDescription(
      "Warwick Massive Tunage 25",
      "Rainbow, 4 colours. JG, IT, MW. JS MIA.",
    );
    assert.deepEqual(result.initials, ["JG", "IT", "MW"]);
  }
  {
    // AWOL variant
    const result = parsePlaylistDescription("x", "MW, JG, IT, JS = AWOL");
    assert.deepEqual(result.initials, ["MW", "JG", "IT"]);
  }
  {
    // Regression: no absence marker → unchanged four-person list
    const result = parsePlaylistDescription("x", "MW, JG, JS, IT");
    assert.deepEqual(result.initials, ["MW", "JG", "JS", "IT"]);
  }
  {
    // Regression: parenthetical (session-13 shape), no absence marker
    const result = parsePlaylistDescription(
      "x",
      "JG (a), JS (b), IT, MW (c). JG, JS, IT, MW",
    );
    assert.deepEqual(result.initials, ["JG", "JS", "IT", "MW"]);
  }

  console.log("parse-playlist.test.ts: all assertions passed");
}

run();
