# Phase 2: Import Pipeline - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the admin-only import pipeline that populates the database from Spotify and enables session metadata editing. The import reads Mark's public Spotify playlists using the Client Credentials flow (no user OAuth, no Spotify Premium required), parses contributor attribution from playlist descriptions, stores all 31 sessions with their 16 tracks each, enriches each unique artist with genre tags from Last.fm, and provides inline date entry and attribution error review on the dashboard.

Apple Music import (IMPORT-07) is explicitly deferred to Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Spotify Import Method
- **D-01:** Use Spotify Client Credentials flow (server-side) — POST to `https://accounts.spotify.com/api/token` with `grant_type=client_credentials` using `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET` env vars. No user OAuth, no Spotify Premium required. Playlists are public.
- **D-02:** Identify playlists via Mark's Spotify user ID — call `GET /users/{user_id}/playlists` (Client Credentials can list a user's public playlists). `SPOTIFY_USER_ID` stored as an env var.
- **D-03:** Session name pattern matching: Claude's discretion — extract session number from playlist name using regex; theme from description.
- **D-04:** Re-import behaviour: replace-all — on each import trigger, truncate `session_tracks`, `tracks`, and `sessions` tables then re-insert. Simple, safe, admin-only.

### Apple Music
- **D-05:** Apple Music import (IMPORT-07) deferred to Phase 3. Phase 2 = Spotify only. No MusicKit JS in this phase.

### Genre / Tag Enrichment
- **D-06:** Use Last.fm `artist.getTopTags` endpoint — free, no auth, returns community folksonomy tags. `LASTFM_API_KEY` env var.
- **D-07:** Enrich per unique artist (deduplicated across all tracks) — one API call per unique artist, not per track.
- **D-08:** Store top 5 tags per artist in an `artist_tags` table. Tags reused across all tracks by that artist.
- **D-09:** Enrich during import — after all tracks are inserted, run enrichment in the same request chain. No separate "enrich" button.

### Date Entry & Attribution Validation UI
- **D-10:** Date entry lives on `/dashboard` as an inline table — all 31 sessions visible with a native `<input type="date">` per row, saved on blur/Enter. No separate page.
- **D-11:** Attribution error display — a warning card section on `/dashboard` lists sessions where the description did not contain a valid initials string. Admin can manually assign contributor order via a slot-based UI (dropdown of 4 names for each group of 4 tracks: slots 1-4, 5-8, 9-12, 13-16).
- **D-12:** The contributor order follows the project rule: theme-chooser first, then alphabetical surname (Groves, Slade, Thomas, Wright). Mark's initials are MW, Jack's JG, Jon's JS, Iwan's IT.

### Claude's Discretion
- Exact regex pattern for matching session playlists from the user's Spotify library
- Rate limiting strategy for Last.fm API (max 5 req/sec)
- Exact Drizzle schema for `sessions`, `tracks`, `session_tracks`, `contributors`, `artist_tags` tables
- Error handling when individual playlist or track fetches fail

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/auth.ts` — `auth.api.getSession()` pattern for admin-gate check in new API routes
- `app/api/import/route.ts` — existing POST handler stub; Phase 2 replaces the 202 stub with real import logic
- `db/schema.ts` — existing Better Auth tables; Phase 2 adds app-specific tables
- `lib/db.ts` — `db` Drizzle instance, reused in all new DB operations
- `components/ui/` — button, card, badge, separator, sonner already installed

### Established Patterns
- API routes: session check → 401 if no session → role check → 403 if not admin → business logic
- Drizzle schema: `sqliteTable`, `text().primaryKey()`, `integer("...", { mode: "timestamp_ms" })`, `.notNull().default(...)`
- Server Components read session via `auth.api.getSession({ headers: await headers() })`
- Client Components use `authClient.useSession()`
- Committed with atomic commits per task

### Integration Points
- `app/api/import/route.ts` — replace stub with real Spotify import logic
- `app/dashboard/page.tsx` — add session list with inline date inputs + attribution error card
- `db/schema.ts` — add `sessions`, `tracks`, `session_tracks`, `contributors`, `artist_tags` tables
- `drizzle-kit push` required after schema changes (BLOCKING step per Phase 1 pattern)

</code_context>

<specifics>
## Specific Ideas

- The four contributors with fixed initials mapping: MW=Mark Wright, JG=Jack Groves, JS=Jon Slade, IT=Iwan Thomas. Seed these into a `contributors` table on import.
- Session number is in the playlist name; theme and initials are in the playlist description.
- The import should run against Mark's Spotify user ID (stored as `SPOTIFY_USER_ID` env var), not hard-coded.
- Last.fm base URL: `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist={name}&api_key={key}&format=json`

</specifics>

<deferred>
## Deferred Ideas

- Apple Music import (IMPORT-07) — deferred to Phase 3 (MusicKit JS browser auth flow, apple_music_id per track)
- Advanced import scheduling / background jobs — not needed for 31-session one-time import
- CSV export of imported data — out of scope

</deferred>

---

*Phase: 2-Import Pipeline*
*Context gathered: 2026-06-12 via smart discuss (autonomous mode)*
