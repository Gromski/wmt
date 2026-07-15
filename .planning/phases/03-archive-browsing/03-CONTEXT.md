# Phase 3: Archive Browsing - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the public-facing **read layer** over the data imported in Phase 2. Any user (public or authenticated, no login required) can:

- Browse all 31 sessions in a card grid, a sortable table, or a chronological timeline (a shared view toggle)
- Open an individual session and see its 16 tracks in play order, each tagged with the contributor who chose it
- Deep-link each track out to Apple Music (or YouTube for fallback tracks)
- Search/filter sessions by theme keyword, person name, or artist name

Requirements covered: **BROWSE-01 → BROWSE-05**. Mode: **MVP** (vertical slice).

This is a read-only surface — no write operations, no auth gating (admin editing already lives on `/dashboard` from Phases 1–2). New capabilities (ratings, comments, analytics) are out of scope and belong in Phase 4 or v2.

</domain>

<decisions>
## Implementation Decisions

### Routing & Navigation
- **D-01:** The session archive lives at **`/sessions`** (a public route, no auth). The root `/` **redirects to `/sessions`** — no separate landing/intro page for this MVP slice.
- **D-02:** Individual sessions live at **`/sessions/[sessionNumber]`** (use the human-facing `sessionNumber`, not the DB id, in the URL).

### Session List / Archive View (`/sessions`)
- **D-03:** Provide **three view modes behind a single toggle**: (a) **card grid** — each card shows session number, theme, date, and the four contributors; (b) **sortable table** — columns for No / Theme / Date / Contributors; (c) **timeline** (see D-11). Card grid is the default.
- **D-04:** Default ordering: **newest session first** (descending `sessionNumber`).
- **D-05:** Null dates (dates are manually entered in Phase 2 and may be incomplete): render a **"Date TBD"** placeholder; the session stays fully browsable.

### Session Detail View (`/sessions/[sessionNumber]`)
- **D-06:** Lay out the 16 tracks as a **single play-order list (positions 1–16)**, each row tagged with a **contributor chip/avatar**. This preserves the true round-robin listening order (see Finding 1) rather than regrouping into per-person blocks.
- **D-07:** Each track row shows **title, artist, album, release year, and open-in link(s)**.
- **D-08:** Session-detail header shows **session number, theme, date (or "Date TBD"), the four contributors, and the raw playlist `description` text**.
- **D-09:** **Unattributed sessions** (`attributionParsed = false`, null contributor per track): render the play-order list with **no contributor chips**, plus a subtle **"attribution pending"** note. Session remains fully viewable. (Note: the Finding-1 fix should resolve most/all of these.)

### Track "Open In" Links (BROWSE-03)
- **D-10a:** Offer **Apple Music + YouTube** links only. **No Spotify** links yet — `tracks.spotifyId` is null for all tracks (Spotify import deferred in Phase 2). Do NOT add a Spotify search-link fallback (would mislead — it's a search, not a verified match).
- **D-10b:** Apple Music link is a **deep-link constructed from the catalog `appleId`** (e.g. `https://music.apple.com/{storefront}/song/{appleId}`). Storefront choice is Claude's discretion (default a sensible storefront, e.g. `gb`/`us`).
- **D-10c:** YouTube links render for **fallback tracks** (tracks not on Apple Music, where a YouTube URL was noted in the playlist description) — see Finding 2 for the data dependency.
- **D-10d:** Links render as **compact icon buttons** (Apple / YouTube) at the end of each row, opening in a **new tab**.
- **D-10e:** Edge case: a track with **neither an `appleId` nor a YouTube link** has no clickable target — render gracefully (no broken/empty link button).

### Timeline View (BROWSE-04)
- **D-11:** The timeline is the **third mode of the `/sessions` view toggle** (not a separate `/timeline` route) — a chronological vertical list ordered by session date.
- **D-12:** Undated sessions in the timeline **fall back to session-number order** as a time proxy (they are NOT hidden).

### Search / Filter (BROWSE-05)
- **D-13:** A **single search box** that matches across **theme, person name, and artist name** simultaneously.
- **D-14:** Search runs **client-side** — load all 31 sessions (and their tracks/artists) and filter in-browser. Instant, no round-trips. Justified by the tiny dataset (31 sessions, ~500 tracks).

### Claude's Discretion
- Apple Music storefront segment in deep-link URLs.
- Card grid responsive breakpoints and column counts.
- Data-loading approach for the client-side search (server component pre-loads vs. API route) — pick what fits the Next.js 16 App Router patterns already established.
- Contributor chip/avatar visual treatment (reuse existing Avatar/Badge components).
- Empty-state and loading-state copy.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — BROWSE-01 through BROWSE-05 (the phase's requirement definitions)
- `.planning/ROADMAP.md` §"Phase 3: Archive Browsing" — goal + 5 success criteria + MVP mode
- `.planning/PROJECT.md` — core value, the four contributors, project constraints

### Prior-phase context (data model this phase reads)
- `.planning/phases/02-import-pipeline/02-CONTEXT.md` — import decisions, contributor mapping (D-12), Spotify-deferred rationale
- `db/schema.ts` — `sessions`, `tracks`, `session_tracks`, `contributors`, `artist_tags` table shapes (what data is available to display)

### Code this phase builds on / must fix
- `app/api/import/route.ts` §line ~292 — **attribution mapping bug** (see Finding 1 below), `slot = Math.floor((position-1)/4)` must become `(position-1) % 4`
- `lib/parse-playlist.ts` — description parser; needs to also extract YouTube fallback links (see Finding 2)
- `app/page.tsx` — current public landing stub, to be replaced by the `/` → `/sessions` redirect

### Design system
- `.planning/phases/01-access-shell/01-UI-SPEC.md` — dark-zinc background + violet primary tokens, shadcn v4 radix-nova preset (browse UI must match)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/ui/`: `card`, `table`, `badge`, `avatar`, `separator`, `select`, `button`, `tooltip` already installed — cover the grid/table/timeline toggle, contributor chips, and link buttons.
- `lib/db.ts` — `db` Drizzle instance, reused for all read queries.
- `lib/auth.ts` — session read pattern (not needed to gate `/sessions`, but available if authed users get extras).
- `components/SessionDateTable.tsx`, `components/AttributionErrorCard.tsx` — Phase 2 admin surfaces; reference for how session/track/contributor data is shaped and queried.

### Established Patterns
- Server Components read data via Drizzle queries; Client Components handle interactivity (the view toggle and search box will be client islands).
- Drizzle schema conventions: integer PKs, `timestamp_ms` mode dates return `Date` objects (convert with `.getTime()` when passing to client components — established in Phase 2).
- Atomic commits per task; Biome lint (import ordering: type imports first, drizzle-orm before next/*).

### Integration Points
- New route group under `app/sessions/` — `page.tsx` (archive) + `[sessionNumber]/page.tsx` (detail).
- `app/page.tsx` — replace stub with a redirect to `/sessions`.
- Read-only joins across `sessions` → `session_tracks` → `tracks` + `contributors` to build the detail view; `artist_tags` available but genre display is a Phase 4 concern.

</code_context>

<specifics>
## Specific Ideas

- **Round-robin play order (confirmed by user):** within a session the 16 tracks cycle one-per-chooser — e.g. chooserA, chooserB, chooserC, chooserD, chooserA, chooserB… So contributor for a track = `initials[(position - 1) % 4]`, NOT blocks of four. The contributor order per session comes from the description initials string (theme-chooser first).
- **YouTube fallback:** when a track wasn't available on Apple Music/Spotify, the group fell back to a YouTube link recorded in the **playlist description**. Those links must be surfaced as the track's open-in link.
- Contributors: MW=Mark Wright, JG=Jack Groves, JS=Jon Slade, IT=Iwan Thomas.

</specifics>

<deferred>
## Deferred Ideas

- **Spotify "open in" links** — deferred until Spotify data is imported (`spotifyId` null across all tracks). No search-link fallback in the meantime.
- **Genre/artist tag display** on tracks (`artist_tags`) — belongs in Phase 4 Analytics, not browsing.
- **Separate `/` landing/intro page** — considered, rejected for this MVP slice (root redirects to `/sessions`). Revisit if the project wants a marketing/intro surface.
- **Authenticated-user extras on browse** (e.g. edit shortcuts) — out of scope; editing stays on `/dashboard`.

</deferred>

---

## ⚠ Findings surfaced during discussion (must reach the planner)

### Finding 1 — Phase 2 attribution mapping bug (BLOCKER for correct browse data)
Phase 2's import (`app/api/import/route.ts` ~line 292) assigns attribution in **blocks of four** (`Math.floor((position-1)/4)`), but the real playlists are ordered **round-robin**. The correct mapping is **`(position - 1) % 4`**. Until fixed and re-imported, every track's displayed contributor is wrong.
- **Decision:** Note as a blocker; Phase 3 planning proceeds, but the fix + re-import **must land before Phase 3 verify/UAT**. The planner should include (or explicitly sequence) this Phase 2 correction as a dependency.

### Finding 2 — YouTube-fallback links not captured in Phase 2 (data dependency, IN SCOPE)
Phase 2's parser extracted only initials + theme from the playlist description; it never captured the YouTube fallback links, and tracks absent from Apple Music may be missing from the import entirely (which would also skew round-robin position counting).
- **Decision:** **In scope for Phase 3** — capture + link. Requires a Phase 2-style change: extend `lib/parse-playlist.ts` to extract YouTube URLs from descriptions, add a schema field to store a track's YouTube URL (and/or a "source"/missing-track marker), and re-import/backfill. Browse then renders the YouTube icon button (D-10c) for those tracks. The planner must scope this data work, not just the UI.

---

*Phase: 3-Archive Browsing*
*Context gathered: 2026-07-15*
