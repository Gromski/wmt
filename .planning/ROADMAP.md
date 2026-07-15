# Roadmap: Warwick Massive Tunage

## Overview

Four phases take the project from a standing start to a fully-interrogable archive. Phase 1 establishes the authenticated shell — private dashboard for four friends, public read-only URL. Phase 2 builds the import pipeline: Spotify OAuth, attribution parsing, date entry, and enrichment from Last.fm. Phase 3 delivers the browsable archive — sessions, tracks, timeline, and search. Phase 4 surfaces the analytics that are the core value: taste profiles, overlap matrix, wildcard detection, and Wrapped-style cards.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Access & Shell** - Authenticated private dashboard and public read-only URL
- [x] **Phase 2: Import Pipeline** - Spotify/Apple Music import, attribution parsing, enrichment, date entry (completed 2026-07-14)
- [ ] **Phase 3: Archive Browsing** - Session list, track detail, timeline, search and filter
- [ ] **Phase 4: Analytics** - Taste profiles, group overlap, wildcard detection, Wrapped cards

## Phase Details

### Phase 1: Access & Shell

**Goal**: The four friends can log in to a private dashboard and anyone can view a public read-only URL
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04
**Success Criteria** (what must be TRUE):

  1. MW, JG, JS, and IT can each register and log in via email + password (per CONTEXT.md D-AUTH — Spotify OAuth replaced because the app owner does not have Spotify Premium) and reach the private dashboard
  2. Unauthenticated visitors can open a public URL and see the archive without logging in
  3. Import trigger, date editing, and write operations are hidden from unauthenticated users (and from non-admin authenticated users for the import trigger)
  4. Admin can trigger a re-import or sync from within the authenticated dashboard

**Plans:** 4/4 plans executed and human-verified (Phase 1 complete 2026-06-12)
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton scaffold: human prereq (install pnpm globally), scaffold Next.js 16 + Tailwind v4 + Biome, install verified deps at locked versions, install shadcn/ui with new-york/zinc/dark preset + Inter font + violet accent

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-01b-PLAN.md — Walking Skeleton wiring: Drizzle schema with role column, Better Auth config (emailAndPassword plugin + first-user-admin `before` hook), `/api/auth/[...all]` catch-all route, proxy.ts route gate (excludes public routes per D-04), public archive empty-state page, BLOCKING schema push, dev-server boot verify

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-02-PLAN.md — Authenticated vertical slice: GlobalHeader with conditional Sign in / Avatar+Sign out, `/sign-in` page with combined sign-in + sign-up form (Zod-validated email+password) calling `authClient.signIn.email`/`authClient.signUp.email`, dashboard Server Component with signed-in confirmation + Admin badge; proves email/password round trip end-to-end (exercises proxy.ts from 01-01b for the first time)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-03-PLAN.md — Admin import-trigger slice: POST /api/import with 401/403/202 gates, admin-only "Sync sessions" Card on dashboard with running-state button; end-to-end verification of ACCESS-01..04

### Phase 2: Import Pipeline

**Goal**: All 31 sessions are imported from Apple Music (per CONTEXT.md D-01 — Spotify import deferred to Phase 3 because Spotify Feb 2026 Dev Mode changes plus no Spotify Premium prevent owner playlist fetch), tracks correctly attributed to each person, enriched with genre/artist tags from Last.fm, and dates enterable by the admin
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08
**Success Criteria** (what must be TRUE):

  1. Admin can connect their Apple Music account via MusicKit JS authorisation and trigger import of all matching playlists (IMPORT-01 reinterpreted per pivot — Spotify deferred to Phase 3)
  2. Each of the 16 tracks per session is attributed to the correct person based on initials in the description and the 4-track grouping rule
  3. Admin can enter or edit the date for each session via the dashboard
  4. Genre and artist tags are fetched from Last.fm and stored locally for each track's primary artist
  5. Sessions with missing or unparseable initials strings are flagged for manual review rather than silently failing

**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Foundation: extend Drizzle schema with sessions/contributors/tracks/session_tracks/artist_tags + BLOCKING `npm run db:push`; build `lib/apple-dev-token.ts` (ES256 JWT) and `GET /api/apple-token` admin-only token vendor; declare `types/musickit.d.ts` global; install Table/Alert/Select/Progress/Tooltip shadcn primitives

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — Apple Music import vertical slice: replace `/api/import` stub with SSE streaming handler (paginate library playlists → fetch tracks with `?include=catalog` → parse initials → batch replace-all → Last.fm enrichment); replace ImportTriggerCard with MusicKit JS v3 browser flow + Progress bar + status line; closes IMPORT-01..04, IMPORT-06..08 data-level

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Admin editor slice + end-to-end human verify: `PATCH /api/sessions/[id]` for date entry and `PATCH /api/sessions/[id]/attribution` for manual contributor assignment; SessionDateTable (inline 31-row date inputs, blur-to-save) and AttributionErrorCard (4-slot Select dropdowns per errored session); dashboard wiring; closes IMPORT-05 + IMPORT-08 UI; blocking human-verify of full Phase 2 happy path

**UI hint**: yes

### Phase 3: Archive Browsing

**Goal**: Any user (public or authenticated) can browse the full session archive, open individual sessions, and jump directly to tracks on Apple Music (or YouTube for fallback tracks — Spotify links deferred per CONTEXT.md D-10a, no Spotify data imported)
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-05
**Success Criteria** (what must be TRUE):

  1. User can see a list of all 31 sessions showing session number, theme, date, and the four contributors
  2. User can open any session and see all 16 tracks grouped under the person who chose them in play order
  3. Each track has a working link that opens it in Apple Music (or YouTube for fallback tracks) — Spotify deferred per D-10a
  4. User can view a chronological timeline of all sessions
  5. User can search or filter sessions by theme keyword, person name, or artist name

**Plans:** 3 plans
Plans:
**Wave 1**

- [ ] 03-01-PLAN.md — Data layer (Findings 1 & 2): add nullable `youtube_url` to `tracks`, extend `lib/parse-playlist.ts` to extract YouTube URLs, thread youtubeUrl through `app/api/import/route.ts`; BLOCKING `npm run db:push`; human re-import checkpoint (corrects round-robin attribution + populates youtubeUrl) — BROWSE-03 data

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 03-02-PLAN.md — Browse vertical slice: `/` → `/sessions` redirect, contributor colour map + ContributorChip, SessionCard, archive `/sessions` RSC (card grid via ArchiveClient), session detail `/sessions/[sessionNumber]` RSC with Apple Music + YouTube new-tab links — BROWSE-01, BROWSE-02, BROWSE-03

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-03-PLAN.md — Interactive slice: extend ArchiveClient with grid/table/timeline view toggle (URL `?view=` persistence) and client-side search across theme/person/artist; SessionTimeline component — BROWSE-04, BROWSE-05

**UI hint**: yes

### Phase 4: Analytics

**Goal**: Any user can interrogate each friend's musical taste and see how the group compares across 31 sessions
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ANALYTICS-01, ANALYTICS-02, ANALYTICS-03, ANALYTICS-04
**Success Criteria** (what must be TRUE):

  1. User can view a taste profile for each friend showing most-chosen artists, decade distribution, and genre breakdown across all sessions
  2. User can see a pairwise overlap matrix showing which pairs of friends share the most similar taste
  3. The friend who most consistently diverges from the group's average choices is identified and surfaced
  4. Each friend has a Wrapped-style summary card with headline stats and standout picks

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Access & Shell | 4/4 | Complete | 2026-06-12 |
| 2. Import Pipeline | 3/3 | Complete   | 2026-07-14 |
| 3. Archive Browsing | 0/3 | Not started | - |
| 4. Analytics | 0/TBD | Not started | - |
