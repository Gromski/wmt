---
status: diagnosed
phase: 03-archive-browsing
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: "2026-08-10T10:47:02Z"
updated: "2026-08-10T10:47:02Z"
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Start the app fresh (production build recommended). It boots with no errors and the homepage loads.
result: pass

### 2. Landing → Archive list (BROWSE-01)
expected: Opening `/` redirects to `/sessions`. You see all 32 sessions as a card grid; each card shows the session number, a meaningful theme (e.g. "Rainbow, 4 colours" — NOT "Warwick Massive Tunage 25"), the date (or a "date TBD" style placeholder where unset), and the contributors.
result: pass

### 3. Open a session — tracks by chooser in play order (BROWSE-02)
expected: Clicking a session card opens `/sessions/<n>`. You see the session's tracks in play order, each labelled/grouped by the person who chose it (contributor chip/colour). A normal session cycles all four choosers; track/title/artist are readable.
result: pass

### 4. Track outbound links (BROWSE-03)
expected: Each track has a working "open in Apple Music" link that opens in a new tab. Tracks whose description carried a YouTube fallback (sessions 3, 9, 15, 19, 31) also show a working YouTube link. No Spotify links (deferred by design).
result: issue
reported: "Session 31 first track (Iwan's IT, Grace Jones - I've Seen That Face Before) has both an Apple Music link (correct) and a YouTube link. The YT link (https://www.youtube.com/watch?v=dVXvm5HpCi8, DND - Diamond Rings) is actually Jonny's (JS) diamond track, mislabelled. YouTube tracks need a description format to determine placement/person, and the title+artist need to be fetched from YouTube."
severity: major
diagnosis: |
  The 03-01 Task 2 heuristic writes only the FIRST YOUTUBE_RE match onto the first track lacking
  an appleId (or position 1) — as an extra link on an existing Apple Music track. Verified in DB:
  - S31 has 15 tracks; round-robin leaves JS with only 3 (pos 4,8,12). His missing 4th pick IS the
    YouTube-only "diamond track" (DND - Diamond Rings). The URL was wrongly attached to pos-1 (IT).
  - YOUTUBE_RE is non-global → S3 (2 YouTube tracks: Iwan's love track + Jonny's angry track) loses
    its 2nd entirely.
  - Title/artist not parsed: S3/9/15/19 embed "Artist - Title" / "Title by Artist" before the URL;
    S31 has no title/artist (needs YouTube fetch, e.g. oEmbed); S24 says "Iron Man by Rahzel" with
    NO url.
  Correct model: each YouTube fallback is its OWN track, attributed to the named person, occupying
  that person's missing play-order slot, with title/artist from the description or fetched from
  YouTube, and a YouTube link (no Apple Music link).
  NOTE: fix needs a description-format decision (user indicated they will standardise it) + a
  YouTube metadata fetch capability + a re-import. Recommend a short design step before planning.

### 5. Timeline view (BROWSE-04)
expected: A view toggle lets you switch to a timeline; sessions appear in chronological order.
result: pass

### 6. Search / filter (BROWSE-05)
expected: A single search box filters the archive instantly (no page reload) by theme keyword, a person's name, or an artist name. Clearing the box restores the full list; a no-match query shows a "no results" state.
result: pass

### 7. View toggle + URL persistence
expected: Grid / table / timeline toggle works; the chosen view is reflected in the URL (`?view=table` / `?view=timeline`) and survives a page refresh (and is shareable).
result: pass

### 8. Absent-contributor sessions attribute correctly (data spot-check)
expected: Open session 25 ("Rainbow, 4 colours") and session 28 ("One hit wonders from four decades"). Each shows only THREE contributors (Jon Slade absent) across 12 tracks — no tracks attributed to Jon.
result: pass

### 9. Themes read well across the archive (data spot-check)
expected: Browsing the grid, session themes are meaningful challenge phrases derived from the descriptions (e.g. "Gods and monster", "One hit wonders from four decades", "Pick your own theme") rather than the raw "Warwick Massive Tunage N" playlist name.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Each YouTube fallback track appears as its own track, attributed to the person who chose it, in that person's play-order slot, with title/artist (from the description or fetched from YouTube) and a working YouTube link."
  status: failed
  reason: "User reported (test 4): S31 YouTube link mislabelled onto Iwan's pos-1 Apple Music track; it is actually Jonny's diamond track. Format needed to place YT tracks + fetch title/artist from YT."
  severity: major
  test: 4
  artifacts: [lib/parse-playlist.ts, app/api/import/route.ts]
  missing: [youtube-fallback-track-parser, multi-youtube-per-session-support, fallback-track-insertion]
  resolution: |
    User decision (2026-08-10) — locks the fix scope; NO YouTube metadata fetch required:
    - Canonical description format for fallback tracks: "<Name>'s <descriptor> track: <Artist> - <Title> <url>"
      e.g. "Iwan's love track: Prince - Open Book https://youtu.be/...". Descriptor is free text; use an
      ordinal ("Iwan's second track: ...") to disambiguate. User will edit the playlist descriptions to
      this format (incl. adding a url to the S24 "Iron Man by Rahzel" case) BEFORE re-import.
    - Multiple fallback tracks per session supported (S3 has two, separated by " / ").
    - Name → contributor initials: Mark→MW, Jack→JG, Jon/Jonny→JS, Iwan→IT.
    - Parser: add a fallback-track extractor returning [{ initials, artist, title, youtubeUrl }] (all
      fields from the description text — no external fetch). Keep the existing initials/theme/attribution
      logic intact.
    - Import route: remove the old "attach first url to position 1 / first no-appleId track" heuristic.
      Insert each fallback track as its OWN track (appleId null, youtubeUrl set), attributed to the named
      contributor, appended in that contributor's play-order group (planner to confirm exact position vs
      the detail page's grouping).
    - Requires a human step (user updates descriptions) then a re-import checkpoint.
