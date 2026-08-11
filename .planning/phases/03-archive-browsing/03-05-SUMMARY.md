---
phase: 03-archive-browsing
plan: 05
subsystem: database
tags: [apple-music, musickit, import, attribution, data-migration]

requires:
  - phase: 03-04
    provides: parseFallbackTracks + fallback rows in import route
  - phase: 03-06
    provides: buildSessionTrackPositions grid reconstruction + position-based attribution
provides:
  - Corrected live archive — YouTube fallback tracks land in their true round-robin position with correct contributor attribution
  - Verified closure of UAT test-4 gap (BROWSE-03)
affects: [verify-work, archive-browsing]

tech-stack:
  added: []
  patterns:
    - "Position-aware fallback verification via direct SQLite spot-check of local.db (positions + attribution + platform), not visual-only"

key-files:
  created: []
  modified: []

key-decisions:
  - "Description convention finalised: grid picks use an explicit ordinal (first/second/third/fourth/last); genuine extras use a non-ordinal descriptor (bonus) and append at session end"
  - "S19 left as an open item — placed at Iwan's round-2 slot (position 5) pending confirmation with Iwan whether it is a real pick or a bonus"

patterns-established:
  - "Human-checkpoint plans verified objectively against the live DB by the orchestrator rather than relying solely on the admin's visual spot-check"

requirements-completed: [BROWSE-03]

duration: ~30min
completed: 2026-08-11
---

# Phase 3: Fallback-track live re-import & verification (03-05)

**The live archive now places every YouTube fallback track in its correct session position with the right contributor, closing the UAT test-4 attribution gap.**

## Performance

- **Duration:** ~30 min (interactive, multi-round)
- **Completed:** 2026-08-11
- **Tasks:** 2/2 (both blocking human checkpoints)
- **Files modified:** 0 (data-only; descriptions edited in Apple Music, DB repopulated by re-import)

## Accomplishments

- Admin updated the Apple Music playlist descriptions for the fallback sessions to the ordinal/bonus convention and re-imported via MusicKit (destructive replace-all).
- Objective DB spot-checks confirmed correct placement + attribution:
  - **S3** — Open Book (Prince, IT) @ pos 1; Circus 9000 (Chrome Hoof, JS) @ pos 8; 14 Apple tracks fill 2–7 / 9–16, re-attributed correctly (e.g. "I Will Possess Your Heart" now Mark's, not Iwan's).
  - **S9** — Words of Wisdom (Snuff, JG) @ pos 9 (Jack's 3rd slot).
  - **S15** — Fruit Cake (JS) @ pos 17 (bonus, appended); 16 Apple tracks unaffected.
  - **S24** — Rahzel - Iron Man (JS) @ pos 15 (Jonny's last); required a description fix (`by` → ` - ` + artist/title swap + URL).
  - **S31** — Diamond Rings (DND, JS) @ pos 8; Iwan's position-1 Grace Jones track is Apple-only (mislabelled link gone).

## Verification

- Positions and `attributed_contributor_id` verified via direct `sqlite3 local.db` queries after re-import.
- Grid math also proven pre-import against the real descriptions using the shipped `parseFallbackTracks` + `buildSessionTrackPositions`.
- Two edits were caught and corrected mid-verification (S3's second fallback missing its ordinal; S24 not yet reformatted), then re-imported and re-confirmed.

## Deviations / notes

- Took multiple re-import rounds because the first pass missed the S3 ordinal and the S24 reformat. Resolved.
- Replace-all import wipes manually entered session dates and manual attribution overrides — expected per D-04; re-entry is a separate admin task.

## Open items

- **S19** — "Iwan's second track: MA2 - Rollers Music" placed at position 5 (Iwan's round-2 slot), making S19 a 17-track session. Pending confirmation with Iwan whether this is a genuine pick (keep ordinal) or an extra (switch to `bonus`). The importer auto-demotes to a bonus if it ever fails to fit, so no incorrect data is stored.
