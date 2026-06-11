# Feature Research

**Domain:** Music archive + personal analytics (small private group, curated sessions)
**Researched:** 2026-06-11
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features the four users will assume exist. Missing these = the app isn't usable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session list / archive browser | The whole point — see all 31 sessions at a glance | LOW | Needs session number, theme, date, participant order |
| Session detail view | Must be able to drill into any session and see all 16 tracks with clear per-person attribution | LOW | 4 tracks × 4 people; ordering changes per session based on who set the theme |
| Per-person track attribution | Without this it's just a playlist; attribution is the core data primitive everything else is built on | MEDIUM | Derived from initials in playlist description + 4-track grouping rule; parsing logic is the hard part |
| Track links out to Spotify / Apple Music | Users need to actually play the music; inline playback is out of scope | LOW | Use Spotify track URI and Apple Music URL; both available from import |
| Spotify OAuth import | Primary data source for all 31 sessions | MEDIUM | Spotify API is well-documented; need to read playlist tracks + description |
| Apple Music OAuth import | Secondary data source (mirrors Spotify) | MEDIUM | MusicKit is more restricted; token auth differs from Spotify; likely used as fallback/verification |
| Session metadata display | Theme, date, session number should be visible everywhere sessions appear | LOW | Date requires manual entry; theme and session number are parsed from playlist |
| Private dashboard (auth) | The four friends want a secure space; analytics data is personal | LOW | Simple auth — four fixed users, no public registration needed |
| Public read-only view | Explicitly requested; shareable link to show off the archive | LOW | Read-only variant of session browser without analytics |
| Manual date entry / correction | Dates aren't in the streaming platform data | LOW | Simple admin UI; could be a one-time seeding step |

### Differentiators (What Makes This Special)

Features that go beyond "just a playlist browser" and deliver the core value — understanding each person as a music-chooser.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-person taste profile | Each person gets a "musical identity card" — favourite artists, genres, eras across all their picks | MEDIUM | Aggregate artist/album release years from track metadata; genres from artist metadata via Spotify/Apple Music APIs |
| Era / decade distribution per person | "Mark mostly picks 80s music" — immediately characterises a chooser | LOW | Release year available from track metadata; bucket into decades |
| Most-chosen artists per person | "Iwan has chosen The Beatles 4 times" — the stat everyone will immediately want | LOW | Simple frequency count across all attributed tracks per person |
| Group taste overlap matrix | Who shares taste with whom — a 4×4 similarity grid based on shared artist / genre choices | MEDIUM | Cosine similarity or Jaccard index on artist/genre vectors; well-established pattern from Last.fm "neighbours" and Spotify Blend taste match |
| Taste divergence highlight | Surface the person most likely to pick "something different" from the others — the group's wildcard | MEDIUM | Inverse of overlap; highlight low-similarity scores and the tracks that cause them |
| Theme-pick correlation | Do certain themes unlock certain people's tendencies? e.g. "When the theme is 80s, JS always picks synthpop" | HIGH | Requires tagging themes by category; small dataset (31 sessions) may limit statistical confidence |
| "Wrapped"-style summary per person | A shareable snapshot: top artist, most-picked decade, genre signature — inspired by Spotify Wrapped | MEDIUM | Presentation layer over aggregated stats; high delight value for minimal extra compute |
| Session "mood" snapshot | Aggregate audio features (energy, valence, danceability) across a session's 16 tracks to characterise its vibe | MEDIUM | Spotify Audio Features API (currently v1; note: audio-features endpoint deprecated in some API versions — verify at build time); Apple Music does not expose equivalent features |
| Cross-session timeline view | Browse how the group's collective picks evolved across all 31 sessions over time | MEDIUM | Requires all session dates; shows trends in genre / era choices chronologically |
| "You might have chosen" / taste resonance | Given a session's theme, show which other group member's picks most closely match each person's taste profile | HIGH | Interesting but requires robust profiles first; defer until profiles are solid |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Inline audio playback | "Would be nice to hear tracks without leaving the app" | Spotify/Apple Music embed APIs require premium agreements, iframe restrictions, and add significant auth complexity — for 4 users the friction far exceeds the benefit | Deep-link to the track on the user's preferred streaming platform; one tap opens it |
| Rating / scoring tracks | "Let us rate each other's picks" | Changes the social dynamic from archive/discovery to game/judgement; out of scope per PROJECT.md; adds data model complexity with no analytical payoff for the stated goals | Surface pick-frequency as implicit endorsement signal |
| Adding sessions via the app | "We should be able to log a session directly" | Duplicates Spotify/Apple Music as source of truth; creates sync conflict risk; the 4-track initials encoding already works well | Keep Spotify/Apple Music as the single data entry point; import after each session |
| Real-time collaborative features | "We could have a live session mode" | The group meets asynchronously via Teams; real-time requires WebSockets, presence, conflict resolution — massive complexity for zero marginal value | Static archive with occasional re-imports is the right model |
| Music recommendations | "Based on our taste, here's what we'd all like" | Recommendation engines require large datasets; 31 sessions × 16 tracks = 496 tracks total — statistically thin for ML; and the group already curates their own picks | Focus on surfacing patterns in what they *have* chosen rather than predicting what to choose next |
| Social sharing / posting | "Share your taste card to Twitter/Instagram" | For 4 users, social sharing is noise; the shareable public URL already covers the "show off the archive" use case | Public read-only URL is sufficient |
| User-submitted session themes / voting | "Let everyone vote on the next theme" | Out of scope and solved by existing group process | Not needed |
| Genre auto-tagging via ML | "Automatically tag each track's genre" | Genre taxonomy is messy; Spotify's genre data is artist-level not track-level; Apple Music is similar; building or integrating an ML tagger adds a service dependency for marginal accuracy | Use Spotify artist genres (already available) and group them into macro-genres (rock, pop, electronic, hip-hop, jazz, classical etc.) — good enough for this use case |

## Feature Dependencies

```
[Spotify OAuth import]
    └──requires──> [Track data + description parsing]
                       └──requires──> [Per-person track attribution]
                                          └──requires──> [Session detail view]
                                          └──requires──> [Per-person taste profile]
                                                             └──requires──> [Most-chosen artists]
                                                             └──requires──> [Era/decade distribution]
                                                             └──requires──> [Group taste overlap matrix]
                                                                                └──requires──> [Taste divergence highlight]

[Manual date entry]
    └──requires──> [Cross-session timeline view]

[Session detail view] ──enables──> [Public read-only view]

[Per-person taste profile] ──enables──> ["Wrapped"-style summary]

[Track data from Spotify API] ──enables──> [Session mood snapshot]
    (audio features endpoint — verify availability at build time)

[Theme-pick correlation] ──requires──> [Per-person taste profile]
                          ──requires──> [All sessions with dates and themes]
```

### Dependency Notes

- **Attribution parsing is the foundational primitive:** Every analytics feature depends on knowing who picked which track. If the initials parser fails on a session, that session falls out of all analytics. Robustness here is critical.
- **Spotify import must precede Apple Music import in implementation:** Spotify's API is better documented, more permissive, and audio features data is only available via Spotify. Build and validate the full import pipeline on Spotify first, then layer in Apple Music as a sync/verification path.
- **Dates gate the timeline:** Cross-session timeline and theme-correlation features only become useful once dates are entered for all (or most) sessions. These are natural v1.x additions.
- **Group overlap requires individual profiles:** Can't compare unless individual profiles are solid. Profile accuracy improves with session count — 31 sessions is actually a decent corpus for 4 people (each person has ~124 attributed picks).
- **Audio features endpoint:** Spotify's `get-audio-features` endpoint has been subject to deprecation discussions. Verify availability against the current API version before building mood snapshots.

## MVP Definition

### Launch With (v1)

Minimum viable — what validates the concept and delivers immediate value.

- [ ] Spotify OAuth import + playlist parsing — without data, nothing else works
- [ ] Contributor attribution engine (initials + 4-track grouping) — the core data primitive
- [ ] Session list / archive browser — the home screen
- [ ] Session detail view with per-person track attribution — the main content page
- [ ] Track links out to Spotify and Apple Music — makes it usable
- [ ] Manual date entry for sessions — unlocks chronological ordering
- [ ] Private dashboard with simple auth — required before sharing with the four users
- [ ] Per-person taste profile (most-chosen artists + era distribution) — the first "aha" moment

### Add After Validation (v1.x)

Add once core is working and the four users have explored it.

- [ ] Group taste overlap matrix — add when individual profiles are confirmed accurate
- [ ] Taste divergence highlight — extends the overlap matrix with minimal extra work
- [ ] "Wrapped"-style shareable summary per person — high delight, presentation layer only
- [ ] Public read-only view — add when the group wants to share externally
- [ ] Cross-session timeline view — add once dates are entered for all sessions
- [ ] Apple Music OAuth (verification / second source) — add if Spotify data is ever incomplete

### Future Consideration (v2+)

Defer until there's evidence of demand.

- [ ] Session mood snapshot (audio features) — interesting but depends on API availability; defer until API status is clear
- [ ] Theme-pick correlation analysis — small dataset may not yield reliable patterns; needs at least ~50 sessions to be statistically interesting
- [ ] "You might have chosen" taste resonance — fun but complex; requires mature profiles

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Spotify import + parsing | HIGH | MEDIUM | P1 |
| Contributor attribution | HIGH | MEDIUM | P1 |
| Session archive browser | HIGH | LOW | P1 |
| Session detail view | HIGH | LOW | P1 |
| Track links out | HIGH | LOW | P1 |
| Manual date entry | MEDIUM | LOW | P1 |
| Private auth | HIGH | LOW | P1 |
| Per-person taste profile | HIGH | LOW | P1 |
| Most-chosen artists per person | HIGH | LOW | P1 |
| Era/decade distribution | HIGH | LOW | P1 |
| Group taste overlap matrix | HIGH | MEDIUM | P2 |
| Taste divergence highlight | HIGH | LOW | P2 |
| "Wrapped"-style summary | HIGH | MEDIUM | P2 |
| Public read-only view | MEDIUM | LOW | P2 |
| Cross-session timeline | MEDIUM | MEDIUM | P2 |
| Apple Music import | MEDIUM | MEDIUM | P2 |
| Session mood snapshot | LOW | MEDIUM | P3 |
| Theme-pick correlation | MEDIUM | HIGH | P3 |
| Taste resonance predictor | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

Reference products surveyed: Last.fm, Spotify Wrapped / Blend, stats.fm, musictaste.space, Receiptify, RateYourMusic, Chosic.

| Feature | How Reference Products Do It | Our Approach |
|---------|------------------------------|--------------|
| Personal taste profile | Last.fm: scrobble history → top artists/tags. stats.fm: streaming history aggregation | Aggregate from attributed session picks (not streaming history); smaller but curated dataset |
| Era/decade breakdown | Chosic: decade distribution chart from listening history | Same approach but sourced from release years of *chosen* tracks across sessions |
| Group taste comparison | Spotify Blend: pairwise playlist + taste match score. musictaste.space: % compatibility | 4-person matrix (pairwise for all 6 combinations); based on artist/genre vectors from session picks |
| Shareable summary | Spotify Wrapped: annual visual story. Receiptify: receipt-format image | Per-person "season recap" card; all-time summary; no time window required given fixed corpus |
| Archive/session browser | RateYourMusic: collection browser with filtering | Session-centric archive with theme and date as primary navigation axes |
| Social features | Last.fm: follows, neighbours, shoutboxes | None — four-person private group; social layer is unnecessary complexity |

## Sources

- Last.fm analytics overview: [bijou.fm/tools/analytics/last-fm-stats](https://www.bijou.fm/tools/analytics/last-fm-stats)
- Spotify Wrapped methodology: [Spotify Newsroom](https://newsroom.spotify.com/2025-12-05/wrapped-methodology-explained/)
- Spotify Blend taste match: [Spotify Newsroom](https://newsroom.spotify.com/2021-08-31/how-spotifys-newest-personalized-experience-blend-creates-a-playlist-for-you-and-your-bestie/)
- musictaste.space pairwise compatibility: [altpress.com](https://www.altpress.com/spotify-compatibility-web-app-musictaste-space/)
- stats.fm feature set: [stats.fm](https://stats.fm/)
- Chosic decade + genre breakdown: [chosic.com/spotify-listening-stats](https://www.chosic.com/spotify-listening-stats/)
- Spotify Audio Features API: [developer.spotify.com](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)
- RateYourMusic collection features: [Wikipedia](https://en.wikipedia.org/wiki/RateYourMusic)

---
*Feature research for: Warwick Massive Tunage — music archive and personal analytics*
*Researched: 2026-06-11*
