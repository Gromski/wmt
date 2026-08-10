---
phase: 03-archive-browsing
verified: 2026-08-10T12:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 3: Archive Browsing Verification Report

**Phase Goal:** Any user (public or authenticated) can browse the full session archive, open
individual sessions, and jump directly to tracks on Apple Music (or YouTube for fallback tracks —
Spotify deferred per D-10a, no Spotify data imported).

**Verified:** 2026-08-10T12:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can see a grid of all sessions with number/theme/date/contributors (BROWSE-01) | VERIFIED | `app/page.tsx` redirects `/` → `/sessions`; `app/sessions/page.tsx` selects all sessions `orderBy(desc(sessionNumber))` and builds a `SessionCardPayload[]`; `components/SessionCard.tsx` renders session number, theme, date-or-"Date TBD", and `ContributorChip` row. Orchestrator confirmed 32 cards render at HTTP 200 in production. |
| 2 | User can open a session and see all tracks in play order grouped by chooser (BROWSE-02) | VERIFIED | `app/sessions/[sessionNumber]/page.tsx` runs an explicit 4-table leftJoin `orderBy(sessionTracks.position)`, renders one `<li>` per track with position, `ContributorChip` (chooser), title, artist/album/year. Unattributed sessions correctly omit chips and show an "Attribution pending" note. Orchestrator confirmed sessions 1/25/28/32 (incl. 3-person MIA/AWOL round-robin) render correctly in production. |
| 3 | Each track links out to Apple Music or YouTube in a new tab; no dead/placeholder buttons (BROWSE-03) | VERIFIED | `appleLink()` builds `https://music.apple.com/gb/song/{appleId}`, rendered only when `appleId` present; YouTube button rendered only when `youtubeUrl` present (`SquarePlay` icon — confirmed `Youtube` is not imported); both anchors carry `target="_blank" rel="noopener noreferrer"`. Orchestrator confirmed 5 tracks carry `youtube_url` matching the 5 descriptions containing a YouTube URL, and Apple links present on all tracks with correct rel/target. Per D-10a, Spotify links are explicitly out of scope for this phase (documented decision, not a gap). |
| 4 | User can switch grid/table/timeline views, persisted via `?view=` (BROWSE-04) | VERIFIED | `components/ArchiveClient.tsx` reads `searchParams.get("view")` narrowed via `isView()` type guard (fallback "grid"), writes via `router.replace`. `components/SessionTimeline.tsx` sorts dated sessions newest-first then undated by `sessionNumber` descending (never hidden, matches D-12). Table view has sortable No/Theme/Date/Contributors columns defaulting to `sortKey="sessionNumber", sortDirection="desc"` (No descending). `npm run build` exits 0, confirming the Suspense boundary around the `useSearchParams` island is valid. |
| 5 | Single search box filters instantly across theme/person/artist, with a no-results state (BROWSE-05) | VERIFIED | `useMemo` filter in `ArchiveClient.tsx` checks `theme`, each contributor `name`, and each `artistNames` entry case-insensitively; `app/sessions/page.tsx` extends the contributor query with a `leftJoin` to `tracks` to populate `artistNames` per session (no new API route — D-14 preserved). Distinct "No matching sessions" state with "Clear search" button renders when `filtered.length === 0` and query is non-empty. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/schema.ts` | nullable `youtube_url` column on tracks | VERIFIED | `youtubeUrl: text("youtube_url")` present; live column confirmed via orchestrator's PRAGMA check and populated youtube_url values |
| `lib/parse-playlist.ts` | `YOUTUBE_RE`, `youtubeUrl` in parse result, theme derivation, initials validation | VERIFIED | `YOUTUBE_RE` present; `deriveThemeFromDescription()` (C1 fix) strips challenge text from before the initials/absence marker; `INITIALS_RE`/`INITIALS_TRIO_RE` restricted to `(MW|JG|JS|IT)` alternations (C2 fix, commit 363280f) rather than generic `[A-Z]{2}`; `npx tsx lib/parse-playlist.test.ts` exits 0 ("all assertions passed") |
| `app/api/import/route.ts` | youtubeUrl threaded to insert; transactional writes | VERIFIED | `trackRows` includes `youtubeUrl: track.youtubeUrl ?? undefined`; all delete+insert DB writes wrapped in `db.transaction(async (tx) => {...})` (C3 fix, commit f2fa48e), with Last.fm enrichment (network I/O) explicitly run *before* the transaction opens |
| `app/page.tsx` | server redirect to `/sessions` | VERIFIED | Synchronous RSC, `redirect("/sessions")`, no JSX |
| `lib/contributor-colors.ts` | `CONTRIBUTOR_COLORS` map | VERIFIED | Exports map keyed by MW/JG/JS/IT with `{bg, fg}` |
| `components/ContributorChip.tsx` | coloured Avatar + tooltip | VERIFIED | Renders `Avatar`/`AvatarFallback` + `Tooltip`, relies on parent `TooltipProvider` |
| `components/SessionCard.tsx` | grid card linking to detail | VERIFIED | Links to `/sessions/{n}`, shows number/theme/date/contributors/artistNames typed |
| `app/sessions/page.tsx` | archive RSC, grid via ArchiveClient | VERIFIED | Public (no auth guard), two-query merge, `Suspense` wraps `ArchiveClient` |
| `app/sessions/[sessionNumber]/page.tsx` | session detail RSC with links | VERIFIED | `Promise<{sessionNumber}>` awaited, `notFound()` on NaN/empty, ordered by position |
| `components/ArchiveClient.tsx` | view toggle + search (`useSearchParams`) | VERIFIED | Contains `useSearchParams`, `useRouter`, `useMemo` filter, sortable table, timeline branch |
| `components/SessionTimeline.tsx` | chronological rail | VERIFIED | Sorts by `sessionNumber` for undated fallback, links each node to detail |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/parse-playlist.ts` | `app/api/import/route.ts` | `youtubeUrl` threaded into trackRows insert | WIRED | `trackRows.push({..., youtubeUrl: track.youtubeUrl ?? undefined})` |
| `app/sessions/page.tsx` | db (sessions + session_tracks + contributors + tracks) | Drizzle select + leftJoin | WIRED | Two-query merge confirmed; `artistNames` leftJoin to `tracks` added in Plan 03 |
| `app/sessions/[sessionNumber]/page.tsx` | db (session + tracks + contributors) | leftJoin, `orderBy(position)` | WIRED | Confirmed explicit 4-table join, ordered by position |
| `app/sessions/[sessionNumber]/page.tsx` | Apple Music / YouTube | `appleLink()` + `youtubeUrl` href, `target="_blank"`, `rel="noopener noreferrer"` | WIRED | Confirmed both conditionally rendered, correct href construction, orchestrator verified rel/target counts match |
| `components/ArchiveClient.tsx` | URL `?view=` | `useSearchParams` read + `router.replace` write | WIRED | Confirmed `isView()` guard + `router.replace` call |
| `components/ArchiveClient.tsx` | `SessionTimeline` / `SessionCard` / table | view-mode switch (`view === ...`) | WIRED | All three branches present and render over `filtered`/`sortedForTable` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BROWSE-01 | 03-02 | List all sessions w/ number, theme, date, contributors | SATISFIED | `app/sessions/page.tsx` + `SessionCard.tsx` |
| BROWSE-02 | 03-02 | Open a session, see tracks grouped by chooser in play order | SATISFIED | `app/sessions/[sessionNumber]/page.tsx` |
| BROWSE-03 | 03-01, 03-02 | Track link opens in Apple Music (Spotify deferred per D-10a, documented decision — this phase's actual contract per the phase goal statement is Apple Music + YouTube fallback) | SATISFIED | `appleLink()` + `youtubeUrl` button rendering, both link-safe |
| BROWSE-04 | 03-03 | Chronological timeline view | SATISFIED | `SessionTimeline.tsx` + toggle in `ArchiveClient.tsx` |
| BROWSE-05 | 03-03 | Search/filter by theme, person, artist | SATISFIED | `useMemo` filter in `ArchiveClient.tsx` |

No orphaned requirements — all five BROWSE-* IDs declared in REQUIREMENTS.md are claimed across the three plans' frontmatter (`requirements: [BROWSE-03]`, `[BROWSE-01, BROWSE-02, BROWSE-03]`, `[BROWSE-04, BROWSE-05]`) and traced to concrete evidence above.

Note: REQUIREMENTS.md's literal BROWSE-03 wording ("opens it in Spotify (or Apple Music if both are imported)") predates the phase-level decision D-10a (Spotify deferred, no Spotify data imported this phase) and the phase goal statement handed to this verification explicitly supersedes it with "Apple Music (or YouTube for fallback tracks)". This is a pre-existing, already-approved decision documented in `03-CONTEXT.md`, not a new gap — flagged here for traceability only, not as a deviation requiring an override.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/sessions/page.tsx` | contributorRows query | No `.orderBy()` on the contributor/artist merge query (WR-01 from 03-REVIEW.md, not yet fixed) | Warning | "First occurrence wins" position tracking for contributor-chip ordering is incidentally correct today (SQLite tends to return rows in insertion/rowid order for this simple query) but not guaranteed by the SQL standard. Does not currently produce incorrect output; flagged as a latent risk, not a phase-goal blocker. |
| `app/api/import/route.ts` | catch block | Raw `String(err)` streamed to client on import failure (WR-03 from 03-REVIEW.md, not yet fixed) | Warning | Admin-gated route; leaks internal error detail to an already-trusted user. Not part of the public browse surface and does not affect BROWSE-01..05. |
| `app/globals.css` + `lib/contributor-colors.ts` | `.dark` block / module | Duplicate, currently-dead CSS custom properties (`--contributor-*`) alongside the JS `CONTRIBUTOR_COLORS` source of truth (WR-04) | Info | Confirmed dead code (no component references the CSS vars); no functional impact, drift risk only. |

None of these warnings block any BROWSE-01..05 truth — they are pre-existing review findings (WR-01, WR-03, WR-04) that are lower severity than the three CRITICAL issues (C1/C2/C3), which were confirmed fixed in commits `1d3a3d7`, `363280f`, and `f2fa48e` respectively (theme-derivation bug, unvalidated-initials attribution bug, and destructive-delete-without-transaction bug — all three directly affected browse-page correctness and are now resolved and typecheck/lint/test-clean).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck clean | `npm run typecheck` | exit 0 | PASS |
| Lint clean | `npm run lint` | "Checked 52 files in 33ms. No fixes applied." exit 0 | PASS |
| Parser regression suite | `npx tsx lib/parse-playlist.test.ts` | "all assertions passed" exit 0 | PASS |
| Production HTTP checks | orchestrator: `npm run build && next start`, curl `/sessions`, `/sessions/1`, `/sessions/25`, `/sessions/28`, `/sessions/32` | all 200 with correct content | PASS (pre-verified by orchestrator, not re-run here per instructions) |

### Human Verification Required

None. All truths are verifiable via static code inspection, typecheck/lint/test tooling, and the orchestrator's already-completed production build + live-DB checks (32 sessions / 467 tracks, correct MIA/AWOL round-robin, correct youtube_url population, backfilled themes, working outbound links). No visual/UX-only judgment calls remain outstanding for this phase's goal.

### Gaps Summary

No gaps. All three CRITICAL code-review findings (C1 theme-extraction mismatch, C2 unvalidated-initials attribution, C3 destructive delete without transaction) that were open at the time of 03-REVIEW.md have confirmed fix commits on the current branch (`1d3a3d7`, `363280f`, `f2fa48e`) with matching source-code evidence, and a follow-up backfill (`3c07361`) corrected the 32 already-imported session theme rows without requiring a further human re-import. The four SUMMARY.md-adjacent WARNING/INFO findings (WR-01, WR-02, WR-03, WR-04) remain open but do not block any BROWSE-01 through BROWSE-05 observable truth — they are pre-existing lower-severity code-quality notes, not phase-goal blockers.

---

_Verified: 2026-08-10T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
