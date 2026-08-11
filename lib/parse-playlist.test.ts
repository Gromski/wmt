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
  parseFallbackTracks,
  parsePlaylistDescription,
  SESSION_PLAYLIST_RE,
  YOUTUBE_RE,
} from "./parse-playlist";

// app/api/import/route.ts's import chain (lib/auth -> lib/db) throws at module-load time
// if BETTER_AUTH_SECRET etc. are unset — Next.js loads .env.local automatically but this
// standalone `tsx` run does not. buildSessionTrackPositions itself is pure (no env/db/fetch
// — T-03-06-01/02), so this is a test-harness-only concern, not a production behavior
// change. Load .env.local before the dynamic import below (dynamic, not static, so this
// statement — not ESM's hoisted static-import evaluation order — runs first).
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local absent (e.g. CI) — rely on already-set process.env vars instead.
}

async function run() {
  const { buildSessionTrackPositions } = await import(
    "@/app/api/import/route"
  );
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

  // Regression: sessionNumber / initials extraction unchanged; theme now derives from the
  // description — since this description is only an initials list, theme falls back to name.
  {
    const result = parsePlaylistDescription(
      "Session 07 — Desert Island Discs",
      "MW, JG, JS, IT",
    );
    assert.equal(result.sessionNumber, 7);
    assert.equal(result.theme, "Session 07 — Desert Island Discs");
    assert.deepEqual(result.initials, ["MW", "JG", "JS", "IT"]);
  }

  // theme derives from the description's challenge text (short lead sentence)
  {
    const result = parsePlaylistDescription(
      "Warwick Massive Tunage 24",
      "Gods and monster. MW, JG, JS, IT.",
    );
    assert.equal(result.theme, "Gods and monster");
  }

  // theme derives from description with parenthetical noise after the lead sentence
  {
    const result = parsePlaylistDescription(
      "Warwick Massive Tunage 13",
      "Pick your own theme. JG (a), JS (b), IT, MW (c). JG, JS, IT, MW",
    );
    assert.equal(result.theme, "Pick your own theme");
  }

  // theme keeps a full numbered-list challenge text intact
  {
    const result = parsePlaylistDescription(
      "Warwick Massive Tunage 18",
      "1. Mammal 2. Bird 3. Reptile/Amphibian 4. Insect/Arachnid. JS, IT, MW, JG",
    );
    assert.equal(
      result.theme,
      "1. Mammal 2. Bird 3. Reptile/Amphibian 4. Insect/Arachnid",
    );
  }

  // theme falls back to name when description is undefined
  {
    const result = parsePlaylistDescription(
      "Warwick Massive Tunage 1",
      undefined,
    );
    assert.equal(result.theme, "Warwick Massive Tunage 1");
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

  // C2: initials matching is restricted to known contributors — unrelated 4-token
  // matches are no longer accepted as parsed attribution
  {
    const result = parsePlaylistDescription("x", "AB, CD, EF, GH");
    assert.equal(result.initials, null);
  }

  // parseFallbackTracks — S3: two fallback tracks separated by " / "
  // "love" / "angry" are theme words, not ordinals → round: null
  {
    const result = parseFallbackTracks(
      "Iwan's love track: Prince - Open Book https://youtu.be/aaaaaaaaaaa / Jonny's angry track: Rage Against the Machine - Killing in the Name https://youtu.be/bbbbbbbbbbb",
    );
    assert.deepEqual(result, [
      {
        initials: "IT",
        artist: "Prince",
        title: "Open Book",
        youtubeUrl: "https://youtu.be/aaaaaaaaaaa",
        round: null,
      },
      {
        initials: "JS",
        artist: "Rage Against the Machine",
        title: "Killing in the Name",
        youtubeUrl: "https://youtu.be/bbbbbbbbbbb",
        round: null,
      },
    ]);
  }

  // parseFallbackTracks — S31: Jonny → JS (longer name must win over "Jon")
  // "diamond" is a theme word, not an ordinal → round: null
  {
    const result = parseFallbackTracks(
      "Jonny's diamond track: DND - Diamond Rings https://www.youtube.com/watch?v=dVXvm5HpCi8",
    );
    assert.deepEqual(result, [
      {
        initials: "JS",
        artist: "DND",
        title: "Diamond Rings",
        youtubeUrl: "https://www.youtube.com/watch?v=dVXvm5HpCi8",
        round: null,
      },
    ]);
  }

  // parseFallbackTracks — nickname/name mapping: Jon, Mark, Jack, Iwan
  // ("chill", "hype", "sad", "calm" are theme words, not ordinals → round: null)
  {
    const result = parseFallbackTracks(
      "Jon's chill track: Boards of Canada - Roygbiv https://youtu.be/ccccccccccc",
    );
    assert.deepEqual(result, [
      {
        initials: "JS",
        artist: "Boards of Canada",
        title: "Roygbiv",
        youtubeUrl: "https://youtu.be/ccccccccccc",
        round: null,
      },
    ]);
  }
  {
    const result = parseFallbackTracks(
      "Mark's hype track: Daft Punk - One More Time https://youtu.be/ddddddddddd",
    );
    assert.deepEqual(result, [
      {
        initials: "MW",
        artist: "Daft Punk",
        title: "One More Time",
        youtubeUrl: "https://youtu.be/ddddddddddd",
        round: null,
      },
    ]);
  }
  {
    const result = parseFallbackTracks(
      "Jack's sad track: Bon Iver - Skinny Love https://youtu.be/eeeeeeeeeee",
    );
    assert.deepEqual(result, [
      {
        initials: "JG",
        artist: "Bon Iver",
        title: "Skinny Love",
        youtubeUrl: "https://youtu.be/eeeeeeeeeee",
        round: null,
      },
    ]);
  }
  {
    const result = parseFallbackTracks(
      "Iwan's calm track: Boards of Canada - Aquarius https://youtu.be/fffffffffff",
    );
    assert.deepEqual(result, [
      {
        initials: "IT",
        artist: "Boards of Canada",
        title: "Aquarius",
        youtubeUrl: "https://youtu.be/fffffffffff",
        round: null,
      },
    ]);
  }

  // parseFallbackTracks — ordinal descriptor is free text ("second" → round: 2)
  {
    const result = parseFallbackTracks(
      "Iwan's second track: Foo - Bar https://youtu.be/ccccccccccc",
    );
    assert.deepEqual(result, [
      {
        initials: "IT",
        artist: "Foo",
        title: "Bar",
        youtubeUrl: "https://youtu.be/ccccccccccc",
        round: 2,
      },
    ]);
  }

  // parseFallbackTracks — no fallback tracks (plain initials list) → []
  assert.deepEqual(parseFallbackTracks("MW, JG, JS, IT"), []);

  // parseFallbackTracks — undefined description → []
  assert.deepEqual(parseFallbackTracks(undefined), []);

  // parseFallbackTracks — ordinal extraction: round derivation from the descriptor
  // Word forms
  {
    const result = parseFallbackTracks(
      "Iwan's first track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, 1);
  }
  {
    const result = parseFallbackTracks(
      "Jack's third track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, 3);
  }
  {
    const result = parseFallbackTracks(
      "Jonny's last track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, 4);
  }
  // Numeric forms
  {
    const result = parseFallbackTracks(
      "Iwan's 2nd track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, 2);
  }
  {
    const result = parseFallbackTracks(
      "Mark's 1st track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, 1);
  }
  {
    const result = parseFallbackTracks(
      "Jack's 3rd track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, 3);
  }
  {
    const result = parseFallbackTracks(
      "Jonny's 4th track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, 4);
  }
  // No ordinal → bonus (round: null)
  {
    const result = parseFallbackTracks(
      "Jonny's bonus track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, null);
  }
  // Theme word, not an ordinal → round: null
  {
    const result = parseFallbackTracks(
      "Iwan's love track: A - B https://youtu.be/x",
    );
    assert.equal(result[0].round, null);
  }

  // buildSessionTrackPositions — S3: two grid fallbacks, no demotions
  // initials = [IT, MW, JG, JS]; IT round 1 -> (1-1)*4 + 0 + 1 = 1; JS round 2 -> (2-1)*4 + 3 + 1 = 8
  {
    const result = buildSessionTrackPositions({
      appleCount: 14,
      fallbacks: [
        { initials: "IT", round: 1 },
        { initials: "JS", round: 2 },
      ],
      initials: ["IT", "MW", "JG", "JS"],
    });
    assert.deepEqual(result.applePositions, [
      2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);
    assert.deepEqual(result.fallbackPlacements, [
      { index: 0, position: 1, kind: "grid" },
      { index: 1, position: 8, kind: "grid" },
    ]);
    assert.deepEqual(result.demotions, []);
  }

  // buildSessionTrackPositions — S24: single "last" (round 4) grid fallback -> position 15
  // initials = [MW, JG, JS, IT]; JS round 4 -> (4-1)*4 + 2 + 1 = 15
  {
    const result = buildSessionTrackPositions({
      appleCount: 15,
      fallbacks: [{ initials: "JS", round: 4 }],
      initials: ["MW", "JG", "JS", "IT"],
    });
    const expectedApple = Array.from({ length: 16 }, (_, i) => i + 1).filter(
      (p) => p !== 15,
    );
    assert.deepEqual(result.applePositions, expectedApple);
    assert.deepEqual(result.fallbackPlacements, [
      { index: 0, position: 15, kind: "grid" },
    ]);
    assert.deepEqual(result.demotions, []);
  }

  // buildSessionTrackPositions — bonus fallback (round null) appended after the grid
  {
    const result = buildSessionTrackPositions({
      appleCount: 16,
      fallbacks: [{ initials: "JS", round: null }],
      initials: ["IT", "MW", "JG", "JS"],
    });
    assert.deepEqual(
      result.applePositions,
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    assert.deepEqual(result.fallbackPlacements, [
      { index: 0, position: 17, kind: "bonus" },
    ]);
    assert.deepEqual(result.demotions, []);
  }

  // buildSessionTrackPositions — collision: two grid fallbacks resolve to the same slot ->
  // the second one is demoted to bonus and logged.
  {
    const result = buildSessionTrackPositions({
      appleCount: 14,
      fallbacks: [
        { initials: "IT", round: 1 },
        { initials: "IT", round: 1 },
      ],
      initials: ["IT", "MW", "JG", "JS"],
    });
    const grid = result.fallbackPlacements.filter((p) => p.kind === "grid");
    const bonus = result.fallbackPlacements.filter((p) => p.kind === "bonus");
    assert.equal(grid.length, 1);
    assert.equal(bonus.length, 1);
    assert.equal(result.demotions.length, 1);
    assert.equal(result.demotions[0].index, 1);
  }

  // buildSessionTrackPositions — overflow: round 4 target exceeds appleCount + gridCount ->
  // demoted to bonus and logged.
  {
    const result = buildSessionTrackPositions({
      appleCount: 2,
      fallbacks: [{ initials: "JS", round: 4 }],
      initials: ["MW", "JG", "JS", "IT"],
    });
    assert.equal(result.fallbackPlacements[0].kind, "bonus");
    assert.equal(result.demotions.length, 1);
    assert.equal(result.demotions[0].index, 0);
  }

  // buildSessionTrackPositions — not-present contributor -> demoted to bonus and logged.
  {
    const result = buildSessionTrackPositions({
      appleCount: 12,
      fallbacks: [{ initials: "IT", round: 1 }],
      initials: ["MW", "JG", "JS"], // IT absent (MIA session)
    });
    assert.equal(result.fallbackPlacements[0].kind, "bonus");
    assert.equal(result.demotions.length, 1);
  }

  // buildSessionTrackPositions — unparsed session (initials null): no grid reconstruction;
  // Apple tracks keep 1..appleCount, fallback appended, no demotions.
  {
    const result = buildSessionTrackPositions({
      appleCount: 10,
      fallbacks: [{ initials: "JS", round: 2 }],
      initials: null,
    });
    assert.deepEqual(
      result.applePositions,
      Array.from({ length: 10 }, (_, i) => i + 1),
    );
    assert.deepEqual(result.fallbackPlacements, [
      { index: 0, position: 11, kind: "bonus" },
    ]);
    assert.deepEqual(result.demotions, []);
  }

  console.log("parse-playlist.test.ts: all assertions passed");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
