# Roadmap: Warwick Massive Tunage

## Overview

Four phases take the project from a standing start to a fully-interrogable archive. Phase 1 establishes the authenticated shell — private dashboard for four friends, public read-only URL. Phase 2 builds the import pipeline: Spotify OAuth, attribution parsing, date entry, and enrichment from Last.fm. Phase 3 delivers the browsable archive — sessions, tracks, timeline, and search. Phase 4 surfaces the analytics that are the core value: taste profiles, overlap matrix, wildcard detection, and Wrapped-style cards.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Access & Shell** - Authenticated private dashboard and public read-only URL
- [ ] **Phase 2: Import Pipeline** - Spotify/Apple Music import, attribution parsing, enrichment, date entry
- [ ] **Phase 3: Archive Browsing** - Session list, track detail, timeline, search and filter
- [ ] **Phase 4: Analytics** - Taste profiles, group overlap, wildcard detection, Wrapped cards

## Phase Details

### Phase 1: Access & Shell
**Goal**: The four friends can log in to a private dashboard and anyone can view a public read-only URL
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: ACCESS-01, ACCESS-02, ACCESS-03, ACCESS-04
**Success Criteria** (what must be TRUE):
  1. MW, JG, JS, and IT can each log in via Spotify OAuth and reach the private dashboard
  2. Unauthenticated visitors can open a public URL and see the archive without logging in
  3. Import trigger, date editing, and write operations are hidden from unauthenticated users
  4. Admin can trigger a re-import or sync from within the authenticated dashboard
**Plans**: TBD

### Phase 2: Import Pipeline
**Goal**: All 31 sessions are imported from Spotify, tracks correctly attributed to each person, enriched with genre/artist tags, and dates enterable by the admin
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: IMPORT-01, IMPORT-02, IMPORT-03, IMPORT-04, IMPORT-05, IMPORT-06, IMPORT-07, IMPORT-08
**Success Criteria** (what must be TRUE):
  1. Admin can connect their Spotify account via OAuth and trigger import of all matching playlists
  2. Each of the 16 tracks per session is attributed to the correct person based on initials in the description and the 4-track grouping rule
  3. Admin can enter or edit the date for each session via the dashboard
  4. Genre and artist tags are fetched from Last.fm or MusicBrainz and stored locally for each track's primary artist
  5. Sessions with missing or unparseable initials strings are flagged for manual review rather than silently failing
**Plans**: TBD
**UI hint**: yes

### Phase 3: Archive Browsing
**Goal**: Any user (public or authenticated) can browse the full session archive, open individual sessions, and jump directly to tracks on Spotify or Apple Music
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BROWSE-01, BROWSE-02, BROWSE-03, BROWSE-04, BROWSE-05
**Success Criteria** (what must be TRUE):
  1. User can see a list of all 31 sessions showing session number, theme, date, and the four contributors
  2. User can open any session and see all 16 tracks grouped under the person who chose them in play order
  3. Each track has a working link that opens it in Spotify (or Apple Music if connected)
  4. User can view a chronological timeline of all sessions
  5. User can search or filter sessions by theme keyword, person name, or artist name
**Plans**: TBD
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
| 1. Access & Shell | 0/TBD | Not started | - |
| 2. Import Pipeline | 0/TBD | Not started | - |
| 3. Archive Browsing | 0/TBD | Not started | - |
| 4. Analytics | 0/TBD | Not started | - |
