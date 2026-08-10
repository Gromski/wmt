# Position-aware YouTube fallback tracks — design

**Date:** 2026-08-10
**Status:** Approved (design)
**Requirement:** BROWSE-03 (extends the fallback-track fix from plans 03-04 / 03-05)
**Implementation target:** GSD gap plan `03-06` in `.planning/phases/03-archive-browsing/`

## Problem

A "YouTube fallback track" is a session pick that isn't available on Apple Music, so it lives
only as a URL in the playlist description rather than as a track in the Apple Music playlist.

Plan 03-04 shipped a first fix: parse each fallback from the description and insert it as its own
track attributed to the named contributor — but **appended at the end of the session** with the
Apple tracks left untouched.

Investigating the live data revealed a deeper, previously-hidden bug:

- Apple Music playlists are ordered **person-cycling by round**: the session's contributors take
  turns, one pick per round, for (normally) 4 rounds. The **starting person rotates per session**
  and is encoded by the **order of the initials list** in the description
  (S3 = `IT, MW, JG, JS` → Iwan starts; S24 = `MW, JG, JS, IT` → Mark starts).
- Attribution is `initials[(position - 1) % N]`, which is correct **only when the Apple playlist
  contains every pick**.
- A fallback pick is **missing** from the Apple playlist. That collapses the sequence, so every
  Apple track after the gap is shifted and **misattributed to the wrong person**.

Example — S3 (`IT, MW, JG, JS`; sub-themes love/angry/mum/live), fallbacks are Iwan's *love* pick
(round 1) and Jon's *angry* pick (round 2):

| True position | Who / round | In Apple playlist? |
|---|---|---|
| 1 | Iwan — love (r1) | ❌ fallback (Open Book) |
| 2 | Mark — love (r1) | ✅ but currently mislabelled as Iwan's |
| … | shifted by the gaps | |
| 8 | Jon — angry (r2) | ❌ fallback (Circus 9000) |

Today's import numbers the 14 Apple tracks 1–14 and appends the two fallbacks at 15–16, so the
whole session's attribution is wrong, not just the fallbacks.

## Goal

Reconstruct the true session grid on import so that:

1. Each fallback lands in its correct round-robin slot (right person, right round), and
2. The Apple tracks are re-attributed correctly around the reconstructed gaps.

## Key facts (confirmed with the admin)

- Playlists are person-cycling by round; starting person = first entry in the initials list.
- Every person contributes 4 tracks per session (4 rounds is the norm) → `last` = round 4.
- The admin authors and controls every playlist description, so the description can **declare** each
  fallback's slot rather than the importer inferring it. Descriptor→theme keyword inference was
  considered and **rejected** as too fragile across 31 free-text themes.

## Design

Principle: **the description declares the truth; the parser trusts it; the admin resolves edge
cases by editing descriptions.**

### 1. Parser — `lib/parse-playlist.ts`

`parseFallbackTracks` gains a `round` field per entry:

```ts
{ initials: string; artist: string; title: string; youtubeUrl: string; round: number | null }
```

- Extract an **ordinal** from the descriptor text already captured by `FALLBACK_TRACK_RE`
  (the free text between the possessive and `track:`), case-insensitive:
  - `first` | `1st` → 1
  - `second` | `2nd` → 2
  - `third` | `3rd` → 3
  - `fourth` | `4th` | `last` → 4
- No recognised ordinal → `round: null` (a **bonus** track).
- `FALLBACK_TRACK_RE` is unchanged — this is pure post-processing of the descriptor capture group.
- `parsePlaylistDescription` remains byte-identical (existing regressions must keep passing).

### 2. Import positioning — `app/api/import/route.ts`

Extract the grid math into a small **pure helper** (e.g. `buildSessionTrackPositions`) so it is
unit-testable without the DB or Apple API. Per session, when `attributionParsed === true`
(`N = initials.length`):

1. Split fallbacks into **grid** (`round != null`) and **bonus** (`round == null`).
2. Grid fallback target position: `(round - 1) * N + initials.indexOf(theirInitials) + 1`.
3. **Fill Apple tracks** into positions `1..`, in playlist order, **skipping** positions already
   occupied by grid fallbacks.
4. **Bonus** fallbacks are appended after the last grid position (today's behaviour).
5. **Attribution**:
   - Every *grid* track (Apple + grid-fallback): `initials[(position - 1) % N]`.
   - *Bonus* tracks: keep explicit named-contributor attribution.
6. **Safety guard** — a grid fallback is **demoted to a bonus (appended) and logged** if any of:
   - its computed position collides with another grid fallback's,
   - its contributor is not present in the session's initials list, or
   - its position overflows the session's total track count (Apple + grid fallbacks).
   The importer must never silently corrupt attribution.
7. When `attributionParsed === false` (initials unparsed): **no** grid reconstruction — fall back to
   today's append-at-end + explicit attribution. No regression for unparsed sessions.

This supersedes 03-04's "append + explicit attribution" for **grid** fallbacks; the append path
survives for bonus and unparsed cases.

### 3. Description convention (admin editing checklist)

Canonical grid form: `"<Name>'s <ordinal> track: <Artist> - <Title> <url>"`.
Bonus form: any descriptor without an ordinal, e.g. `"<Name>'s bonus track: <Artist> - <Title> <url>"`.

| Session | Change |
|---|---|
| 3  | `Iwan's first track: Prince - Open Book <url> / Jonny's second track: Chrome Hoof - Circus 9000 <url>` (love→first, angry→second) |
| 9  | `Jack's third track: Snuff - Words of Wisdom <url>` — already "third", confirm only |
| 15 | `Jonny's bonus track: Fred Schneider & The Superions - Fruit Cake <url>` (Christmas = bonus → append) |
| 19 | `Iwan's second track: MA2 - Rollers Music <url>` — **OPEN**: S19 already has 16 Apple tracks; if the YouTube track is a genuine extra, use `bonus` instead. Admin to confirm with Iwan. Guard demotes to bonus if it doesn't fit. |
| 24 | `Jonny's last track: Rahzel - Iron Man <url>` — fix `by` → ` - ` and swap artist/title (currently "Iron Man by Rahzel", no ` - `, so it fails to parse today) |
| 31 | `Jonny's second track: DND - Diamond Rings <url>` — already "second", confirm only |

### 4. Testing

- Parser unit tests: ordinal extraction (word forms, numeric forms, `last`, and none→null),
  alongside the existing S3/S31/nickname/empty cases. Keep the file's plain `node:assert/strict`
  style and the final "all assertions passed" log.
- Pure positioning-helper tests (no DB/API):
  - S3 two grid fallbacks → positions 1 and 8; Apple tracks fill 2–7, 9–16.
  - S24 `last` → position 15 in a 16-track session.
  - A bonus fallback → appended at end, explicit attribution.
  - A collision / not-in-initials / overflow case → demoted to bonus + logged.

### 5. Verification (human, live)

Re-import via MusicKit after the descriptions are updated, then spot-check:

- S3: two fallbacks at positions 1 and 8; the Apple tracks re-attributed to the correct people.
- S24: `Rahzel - Iron Man` appears as Jon's last track (position 15), YouTube link, no Apple link.
- S31: Jon's diamond track under JS.
- S15 (and S19 if kept as bonus): the extra renders appended at the end.

Build/typecheck/lint passing is **not** proof of data correctness — the live re-import + spot-check
is the acceptance gate (same pattern as 03-01 / 03-05).

## Open questions

- **S19**: is `Iwan's second track` a real grid pick (replacing one of his Apple picks) or a genuine
  bonus? Admin to confirm with Iwan. Until then the safety guard treats it as a bonus (appended),
  which is safe.

## Out of scope

- No schema/migration changes (columns already nullable).
- No UI changes to the session detail page (it already renders a flat list by position with a
  per-track contributor chip, and shows the Apple link only when `appleId` is set).
- No change to `parsePlaylistDescription`, the `SESSION_PLAYLIST_RE` filter, Last.fm enrichment
  ordering, or the `db.transaction` replace-all wrapping.
