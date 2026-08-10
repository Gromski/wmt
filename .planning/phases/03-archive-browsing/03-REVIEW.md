---
phase: 03-archive-browsing
reviewed: 2026-08-10T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - app/api/import/route.ts
  - app/globals.css
  - app/page.tsx
  - app/sessions/[sessionNumber]/page.tsx
  - app/sessions/page.tsx
  - components/ArchiveClient.tsx
  - components/ContributorChip.tsx
  - components/GlobalHeader.tsx
  - components/SessionCard.tsx
  - components/SessionTimeline.tsx
  - db/schema.ts
  - lib/contributor-colors.ts
  - lib/parse-playlist.test.ts
  - lib/parse-playlist.ts
findings:
  critical: 3
  warning: 4
  info: 1
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-08-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the archive-browsing client (search/filter/view toggle), the two read-only RSC pages, the playlist parser, and the admin-only import route. The UI-facing null-safety is generally solid (dated/undated sessions, missing contributors, missing artwork are all handled without crashes), and outbound Apple Music/YouTube links correctly use `rel="noopener noreferrer"` with `target="_blank"` and never pass through `dangerouslySetInnerHTML`, so there is no direct XSS vector in the reviewed files.

However, three critical correctness/data-integrity defects were found, all in the parsing/import pipeline that feeds this browsing UI: (1) the theme-extraction regex in `parse-playlist.ts` targets a playlist-naming convention ("Session N — Theme") that does not match the convention the importer actually filters on ("Warwick Massive Tunage N"), so real playlist themes will not be stripped of their prefix; (2) contributor initials extracted from playlist descriptions are never validated against the four known contributors, so an unrelated four-token string can be accepted as a "successful" parse while every track silently fails attribution; and (3) the import route deletes all existing archive data before any of the new data is confirmed written, with no transaction wrapping the subsequent inserts, risking total data loss if any insert step fails. These are cross-file findings that affect every session view (`SessionCard`, `SessionTimeline`, `SessionDetailPage`, `ArchiveClient`).

## Critical Issues

### CR-01: Theme-extraction regex does not match the actual playlist naming convention

**File:** `lib/parse-playlist.ts:79-81` (cross-referenced with `lib/parse-playlist.ts:47` and `app/api/import/route.ts:96-102`)

**Issue:** The importer only keeps playlists whose name matches `SESSION_PLAYLIST_RE = /warwick massive tunage\s+(\d+)/i` (e.g. `"Warwick Massive Tunage 22 — Desert Island Discs"`). Every surviving playlist name is then passed to `parsePlaylistDescription`, whose theme-stripping logic is:

```ts
const theme = name.replace(/session\s*\d+\s*[-–—:]?\s*/i, "").trim();
```

This regex only strips a leading token starting with the literal word **"session"** (matching the JSDoc example `"Session 07 — Desert Island Discs"`), not "Warwick Massive Tunage N". For every real, filter-passing playlist name, the replace is a no-op, so `theme` ends up as the *entire original playlist name* (e.g. `"Warwick Massive Tunage 22 — Desert Island Discs"`) instead of `"Desert Island Discs"`. This value is written to `sessions.theme` and rendered as the primary heading on every `SessionCard`, `SessionTimeline` entry, and `SessionDetailPage` — the review surfaces the redundant prefix on all 31 imported sessions.

`lib/parse-playlist.test.ts` does not catch this because every test case passes a `"Session N — Theme"` name directly into `parsePlaylistDescription`, never exercising a name that has actually passed `SESSION_PLAYLIST_RE` first — so the test suite validates a code path that never executes against real data.

**Fix:** Strip the convention that `SESSION_PLAYLIST_RE` actually matches, anchored to the start of the string:

```ts
const theme = name
  .replace(/^\s*warwick massive tunage\s+\d+\s*[-–—:]?\s*/i, "")
  .trim();
```
Add a regression test that pipes a `SESSION_PLAYLIST_RE`-matching name (e.g. `"Warwick Massive Tunage 22 — Desert Island Discs"`) through `parsePlaylistDescription` and asserts `theme === "Desert Island Discs"`.

### CR-02: Contributor initials are accepted without validation against known contributors

**File:** `lib/parse-playlist.ts:83-87, 96-106` (cross-referenced with `app/api/import/route.ts:301-307`)

**Issue:** `INITIALS_RE` and `INITIALS_TRIO_RE` only validate the *shape* of the initials string (four, or three, comma-separated two-uppercase-letter tokens) — they never check the captured groups against `KNOWN_CONTRIBUTORS` (`MW`/`JG`/`JS`/`IT`). Any description containing an unrelated four-token match (e.g. `"Recommended by NY, LA, SF, DC"`, or two-letter city/label/genre codes) will be accepted as a valid initials list, so `parsed.initials !== null` and `attributionParsed` is set to `true`.

Downstream, in `app/api/import/route.ts:301-307`:
```ts
if (sessionPlan.attributionParsed && sessionPlan.initials) {
  const slot = (position - 1) % sessionPlan.initials.length;
  const contribInitials = sessionPlan.initials[slot];
  attributedContributorId = contribIdByInitials.get(contribInitials) ?? null;
}
```
`contribIdByInitials.get(contribInitials)` silently returns `undefined → null` for any initials not in the `contributors` table. The result is a session that is flagged as **successfully attributed** (`attributionParsed: true`, no "Attribution pending" badge shown per `app/sessions/[sessionNumber]/page.tsx:96,141`) even though every track's `attributedContributorId` is `null` — the exact failure mode the `attributionParsed` flag exists to surface is hidden.

**Fix:** Validate captured initials against `KNOWN_CONTRIBUTORS` before accepting the match, e.g.:
```ts
const isKnown = (s: string) => s.toUpperCase() in KNOWN_CONTRIBUTORS;
let initials: string[] | null = initialsMatch &&
  [initialsMatch[1], initialsMatch[2], initialsMatch[3], initialsMatch[4]].every(isKnown)
    ? [initialsMatch[1], initialsMatch[2], initialsMatch[3], initialsMatch[4]]
    : null;
```
Apply the same check to the `INITIALS_TRIO_RE` fallback branch.

### CR-03: Destructive delete-all with no transaction around subsequent writes (data loss risk)

**File:** `app/api/import/route.ts:213-352`

**Issue:** The import route deletes the entire archive up front:
```ts
await db.batch([
  db.delete(schema.artistTags),
  db.delete(schema.sessionTracks),
  db.delete(schema.tracks),
  db.delete(schema.sessions),
]);
```
…and then performs many more sequential, non-transactional writes: contributor upsert, session insert, track insert, session-track join insert, and a long-running Last.fm enrichment loop (one HTTP call + 250ms sleep per unique artist, potentially minutes for 31 sessions). If any of these subsequent steps throws (network failure, Last.fm timeout, constraint violation, or the route simply exceeding `maxDuration = 300`), execution jumps to the `catch` block, which only does `send({ type: "error", message: String(err) })` — there is no rollback. Because the delete already committed, the archive is left empty (or partially populated) with no way to recover except re-running the entire import. This is a full data-loss risk triggered by any transient failure in a pipeline that make an external network call (Apple Music, Last.fm) per playlist/artist.

**Fix:** Wrap the destructive delete and the full set of inserts in a single `db.transaction(...)` (or build the complete new dataset in a staging table set and swap atomically), so a failure at any point leaves the previously-existing archive intact. At minimum, defer the `delete` calls until immediately before the final insert step that is known to succeed, or perform the deletes and inserts inside one `db.batch`/transaction boundary instead of two separate awaited steps.

## Warnings

### WR-01: Contributor chip ordering relies on unordered SQL result rows

**File:** `app/sessions/page.tsx:22-66`

**Issue:** The `contributorRows` query has no `.orderBy(...)`. The code stores, per contributor, the `position` value from the *first row encountered* for that `sessionNumber`/`initials` pair, then later sorts contributors by that stored position (line 73). SQL does not guarantee row order without an explicit `ORDER BY`; if the driver ever returns rows in a different order than insertion order (e.g. after a future index, `VACUUM`, or driver change), a contributor's stored "position" could reflect their second or third track rather than their true first appearance, silently reordering the contributor chips shown on `SessionCard`/`SessionTimeline`/table view.

**Fix:** Add `.orderBy(schema.sessionTracks.position)` to the `contributorRows` query so the "first occurrence wins" logic is guaranteed correct rather than incidentally correct.

### WR-02: Parser test file is never executed by any tooling

**File:** `lib/parse-playlist.test.ts:1-127`

**Issue:** `package.json` has no `"test"` script and no `vitest`/`jest`/test-runner dependency. The file's own header comment acknowledges this ("not currently wired into `npm test`"). This means the parser's attribution/theme logic — the most correctness-sensitive code in this phase — has zero automated verification in CI, and (as demonstrated by CR-01) can silently regress without any signal. `assert.ok`/`assert.equal` calls will throw on failure only if a developer manually runs the file with `node --experimental-strip-types`.

**Fix:** Either wire an actual runner (`vitest` is already implied by the stack's supporting-library conventions) and add a `"test"` script, or, at minimum, add this file to a pre-commit/CI step that shells out to `node --experimental-strip-types lib/parse-playlist.test.ts` so failures are caught automatically instead of relying on manual execution.

### WR-03: Raw error strings streamed to the client on import failure

**File:** `app/api/import/route.ts:361-363`

**Issue:** `catch (err) { send({ type: "error", message: String(err) }); }` forwards the raw error message (which may include stack fragments, internal URLs, or API response bodies from the Apple Music/Last.fm clients) directly to the client over the SSE stream. The route is admin-gated, which limits exposure, but this is still an unnecessary internal-detail leak to the browser console/network tab and makes it easy to accidentally regress the gate later without noticing this dependency.

**Fix:** Log the full error server-side (`console.error(err)`) and send a generic, sanitized message to the client (e.g. `"Import failed — check server logs"`), optionally including a short error code.

### WR-04: Contradictory "single source of truth" contributor colour definitions

**File:** `app/globals.css:119-123` and `lib/contributor-colors.ts:1-9`

**Issue:** `lib/contributor-colors.ts` is commented as "Single source of truth for contributor identity colours". `app/globals.css` independently defines `--contributor-mw`, `--contributor-jg`, `--contributor-js`, `--contributor-it` under `.dark` with the comment "fixed four-person contributor colour map (LOCKED)" — a second, competing "source of truth" with duplicated OKLCH values. A `grep` across the codebase confirms these CSS custom properties are never referenced by any component (`ContributorChip` uses the JS map via inline `style`), so they are dead code today, but the duplication is a latent drift risk: a future colour change applied to one location silently diverges from the other.

**Fix:** Remove the unused CSS custom properties from `globals.css`, or have `ContributorChip` actually consume them via `var(--contributor-...)` and delete the JS map — pick one source and delete the other.

## Info

### IN-01: Epoch-zero session date would incorrectly render as "Date TBD"

**File:** `components/SessionCard.tsx:20`, `components/SessionTimeline.tsx:35,71`, `app/sessions/[sessionNumber]/page.tsx:67-73,117-121`, `components/ArchiveClient.tsx:229-235,257-260`

**Issue:** All of these use a truthy check on the numeric timestamp (`session.date ? ... : "Date TBD"`). If a session's `date` were ever legitimately `1970-01-01T00:00:00.000Z` (`getTime() === 0`), it would incorrectly render as "Date TBD" instead of the actual date, because `0` is falsy in JavaScript. This is very unlikely to occur for real session dates but is a latent correctness gap that would be silent and hard to diagnose.

**Fix:** Use explicit null checks (`session.date !== null`) rather than truthiness when branching on the date value.

---

_Reviewed: 2026-08-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
