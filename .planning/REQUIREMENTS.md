# Requirements — Warwick Massive Tunage

## v1 Requirements

### Import

- [x] **IMPORT-01**: Admin user (Mark) can connect their Apple Music account via MusicKit JS authorize flow to authorise playlist access
- [x] **IMPORT-02**: App can import all playlists from the connected Apple Music account that match the session naming convention (session number in name)
- [x] **IMPORT-03**: App parses contributor order from playlist description initials (e.g. "MW, JG, JS, IT") and attributes each group of 4 tracks to the correct person
- [x] **IMPORT-04**: App correctly handles the theme-chooser-first ordering rule when assigning attribution (first person in initials string = tracks 1–4, etc.)
- [x] **IMPORT-05**: Admin user can enter or edit the date for each session via the dashboard
- [x] **IMPORT-06**: App fetches genre/artist tags from Last.fm or MusicBrainz for each track's primary artist and stores them locally for analytics
- [x] **IMPORT-07**: Admin user can connect Apple Music via MusicKit JS and import the 31 sessions from Apple Music as the primary import source (Spotify deferred — no Spotify Premium available)
- [x] **IMPORT-08**: App gracefully flags sessions where the description does not contain a valid initials string, surfacing them for manual review rather than silently failing

### Browsing

- [ ] **BROWSE-01**: User can see a list of all sessions with session number, theme, date, and the four contributors
- [ ] **BROWSE-02**: User can open any session and see all 16 tracks, clearly grouped under the person who chose them (in play order)
- [x] **BROWSE-03**: Each track has a link that opens it in Spotify (or Apple Music if both are imported)
- [ ] **BROWSE-04**: User can browse a chronological timeline view showing all sessions across time
- [ ] **BROWSE-05**: User can search or filter sessions by theme keyword, person name, or artist name

### Analytics

- [ ] **ANALYTICS-01**: User can view a taste profile for each of the four friends showing their most-chosen artists, era/decade distribution, and genre breakdown across all sessions
- [ ] **ANALYTICS-02**: User can see a pairwise group overlap matrix — which pairs of friends share the most similar taste based on shared artists and genres
- [ ] **ANALYTICS-03**: App identifies and surfaces the friend who most consistently diverges from the group's average choices (the "wildcard")
- [ ] **ANALYTICS-04**: Each friend has a Wrapped-style visual summary card: headline stats and standout picks across all sessions

### Access

- [x] **ACCESS-01**: The four friends (MW, JG, JS, IT) can log in via Spotify OAuth to access the private dashboard
- [x] **ACCESS-02**: The private dashboard gates import trigger, date editing, and any write operations behind authentication
- [x] **ACCESS-03**: Admin user can trigger a re-import or sync from Spotify (and Apple Music if connected) from within the dashboard
- [x] **ACCESS-04**: A public read-only URL exposes the session archive and analytics to anyone without login

---

## v2 Requirements

*(Deferred — not in v1 scope)*

- Cross-theme correlation analytics — which themes brought out which musical tendencies (needs 40+ sessions for statistical reliability)
- Session mood/vibe analysis — blocked by Spotify audio features deprecation; revisit if a viable alternative emerges
- Email or push notifications (e.g. reminder before a session)
- Taste resonance predictor — ML/based; disproportionate complexity for a 4-user app

---

## Out of Scope

- **Inline audio playback** — linking out to Spotify/Apple Music is sufficient; embedding audio adds streaming rights complexity
- **Track ratings or scoring** — this is an archive and analytics tool, not a game; ratings would need a UX layer that's out of scope
- **Real-time collaboration features** — sessions are asynchronous; no live sync needed
- **ML/recommendation engine** — 496 data points across 4 users is not a useful ML training set
- **Multi-group support** — this app is for exactly these four friends; generalising to other groups is not a goal

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| ACCESS-01 | Phase 1 — Access & Shell | Complete |
| ACCESS-02 | Phase 1 — Access & Shell | Complete |
| ACCESS-03 | Phase 1 — Access & Shell | Complete |
| ACCESS-04 | Phase 1 — Access & Shell | Complete |
| IMPORT-01 | Phase 2 — Import Pipeline | Complete |
| IMPORT-02 | Phase 2 — Import Pipeline | Complete |
| IMPORT-03 | Phase 2 — Import Pipeline | Complete |
| IMPORT-04 | Phase 2 — Import Pipeline | Complete |
| IMPORT-05 | Phase 2 — Import Pipeline | Complete |
| IMPORT-06 | Phase 2 — Import Pipeline | Complete |
| IMPORT-07 | Phase 2 — Import Pipeline | Complete |
| IMPORT-08 | Phase 2 — Import Pipeline | Complete |
| BROWSE-01 | Phase 3 — Archive Browsing | Pending |
| BROWSE-02 | Phase 3 — Archive Browsing | Pending |
| BROWSE-03 | Phase 3 — Archive Browsing | Complete |
| BROWSE-04 | Phase 3 — Archive Browsing | Pending |
| BROWSE-05 | Phase 3 — Archive Browsing | Pending |
| ANALYTICS-01 | Phase 4 — Analytics | Pending |
| ANALYTICS-02 | Phase 4 — Analytics | Pending |
| ANALYTICS-03 | Phase 4 — Analytics | Pending |
| ANALYTICS-04 | Phase 4 — Analytics | Pending |
