# Warwick Massive Tunage

## What This Is

A web app for four friends (Mark Wright, Jack Groves, Jon Slade, Iwan Thomas) who gather every few months over Teams to listen to music together around a shared theme. Each person contributes 4 songs per session; across 31 sessions they've built a rich archive of curated playlists on both Apple Music and Spotify. This app brings that archive to life outside the streaming platforms — making sessions browsable and surfacing patterns about each person's musical taste and the group's collective dynamics.

## Core Value

Interrogate 31 sessions of curated music to surface who each person really is as a music-chooser — and how the group compares.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Connect Apple Music and Spotify accounts via OAuth to import playlists
- [ ] Parse contributor attribution from playlist descriptions (initials like "MW, JG, JS, IT") and 4-track grouping rule
- [ ] Capture session metadata: session number (from playlist name), theme (from description), date (manually entered)
- [ ] Browsable session view: see all 16 tracks per session with each person's 4 songs clearly attributed
- [ ] Per-person analytics: tendencies across genre, era, artists — e.g. Mark's favourite to choose is Daft Punk
- [ ] Group dynamics view: taste overlap and divergence across the four friends
- [ ] Theme-pattern analysis: correlations between themes and what each person chose
- [ ] Track links out to Spotify and Apple Music for playback
- [ ] Private dashboard (authenticated, for the four friends)
- [ ] Public read-only view (shareable URL to show off the archive)

### Out of Scope

- Inline audio playback — linking out to streaming platforms is sufficient
- Adding new sessions directly in the app — data comes from Spotify/Apple Music imports
- Rating or scoring tracks — this is an archive and analytics tool, not a game

## Context

The four participants:
- **MW** — Mark Wright (theme-chooser goes first; otherwise alphabetical by surname: G, S, T, W)
- **JG** — Jack Groves
- **JS** — Jon Slade
- **IT** — Iwan Thomas

Session structure: whoever chose the theme plays their 4 tracks first; remaining three follow in alphabetical surname order. So if Jon's theme: tracks 1–4 = JS, 5–8 = IT, 9–12 = MW, 13–16 = JG.

Playlist encoding: contributor order written in description as initials (e.g. "MW, JG, JS, IT"). Theme is also in the description. Session number is in the playlist name. Dates aren't currently in the playlists — will need manual entry.

31 sessions exist on both Apple Music and Spotify. Both platforms should be connectable, but they're mirrors of the same sessions.

## Constraints

- **Data**: Contributor attribution relies on parsing the initials in playlist descriptions — playlists without a valid initials string can't be auto-attributed
- **Dates**: Session dates aren't in the streaming platform data and require manual input
- **Auth**: Apple Music API (MusicKit) and Spotify API are both needed; Apple's API is more restricted than Spotify's

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Link out rather than embed playback | Simpler integration; users are already on Spotify/Apple Music | — Pending |
| Both public view + private dashboard | Four friends want to share their archive but also have a private space | — Pending |
| Parse contributor order from description initials | That's how playlists are currently encoded; avoids any re-encoding | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-11 after initialization*
