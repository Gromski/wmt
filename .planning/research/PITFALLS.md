# Pitfalls Research

**Domain:** Music archive and analytics web app — Spotify + Apple Music integrations
**Researched:** 2026-06-11
**Confidence:** HIGH (Spotify), MEDIUM (Apple MusicKit JS), MEDIUM (genre data alternatives)

---

## Critical Pitfalls

### Pitfall 1: Spotify Development Mode User Cap Will Block All Four Friends

**What goes wrong:**
Since February 11, 2026, all newly created Spotify Development Mode Client IDs are capped at **5 authorized users**. Each user must be manually added to the allowlist in the app dashboard before they can authenticate. A user not on the allowlist receives a `403 Forbidden` response — even if they hit the correct OAuth flow. There is no path to "Standard Access" or "Extended Quota" for a personal project: as of May 2025, Extended Quota requires a registered legal entity with 250,000+ monthly active users.

**Why it happens:**
Developers build the happy path (their own account works) and don't test with the other users until late. The user cap was also recently reduced from 25 to 5, so older tutorials describe a less restrictive environment.

**How to avoid:**
Immediately add all four Spotify accounts (MW, JG, JS, IT) to the app's User Management allowlist in the Spotify Developer Dashboard before writing a single line of auth code. Verify each one can authenticate in development before proceeding.

**Warning signs:**
- A collaborator reports `403 Forbidden` on the Spotify login callback
- Only the app owner's account successfully completes OAuth

**Phase to address:**
Phase 1 (Spotify auth / import). Do this before any other work. Treat allowlist setup as a prerequisite, not an afterthought.

---

### Pitfall 2: Spotify Audio Features Endpoint Is Gone — Genre/Acoustics Data Unavailable

**What goes wrong:**
On November 27, 2024, Spotify deprecated the `/audio-features` and `/audio-analysis` endpoints, along with `/recommendations` and extended track metadata. Apps without pre-existing Extended Quota access now receive `403` for all audio feature requests. As of June 2026 there is no official replacement, and Extended Quota is unavailable to new applicants who aren't large businesses. Any plan to derive genre, energy, valence, BPM, or danceability directly from Spotify is dead.

**Why it happens:**
Tutorials and Stack Overflow answers from 2020–2023 treat audio features as a standard, available API call. The deprecation happened without advance warning and the community widely built on it.

**How to avoid:**
Do not build analytics on Spotify audio features. Use Last.fm's `artist.getTopTags` for genre tags (free, no auth needed, artist-level granularity). Use MusicBrainz recordings API for release year, ISRC, and additional genre tagging (free, 1 req/sec rate limit). Build a genre-enrichment job that resolves each artist name against Last.fm and MusicBrainz on first import and stores the results.

**Warning signs:**
- Any code calling `/v1/audio-features` or `/v1/audio-analysis`
- Planning docs that reference "danceability", "valence", or "energy" as data the app will show

**Phase to address:**
Phase 1 (data model design). Decide the genre strategy before writing the import pipeline, not after.

---

### Pitfall 3: Apple MusicKit JS Developer Token Must Never Touch the Browser

**What goes wrong:**
The Apple Music developer token is a JWT signed with a private `.p8` key from the Apple Developer portal. If this key is embedded in frontend code, environment variables that ship to the browser, or committed to version control, it is permanently compromised (Apple cannot rotate the key association — you must revoke and create a new key/identifier). The developer token itself has a 6-month max lifetime and must be regenerated server-side before expiry.

**Why it happens:**
MusicKit JS is a client-side library that requires the developer token to be passed to `MusicKit.configure()`. Developers assume the token must be in the frontend JS. The correct pattern is to have a server endpoint that serves a freshly-signed JWT, and the frontend fetches that token at startup.

**How to avoid:**
Create a backend route (e.g., `GET /api/apple-music-token`) that generates and returns a signed JWT. The `.p8` key stays in a server-side secret. Pass the fetched token to `MusicKit.configure({ developerToken: fetchedToken })`. Set a conservative token lifetime (3 months) and re-generate before expiry.

**Warning signs:**
- Developer token string appears in any `.js`, `.ts`, `.env.local`, or git history
- `MusicKit.configure()` called with a hardcoded string literal
- The `.p8` key file is in the project directory

**Phase to address:**
Phase 2 (Apple Music auth). Architecture decision before any MusicKit code is written.

---

### Pitfall 4: Apple Music User Token Expiry Has No Refresh Mechanism

**What goes wrong:**
Apple Music User Tokens (MUT) expire after approximately 6 months. Unlike Spotify's OAuth 2.0 with refresh tokens, MusicKit provides **no refresh token**. When the MUT expires, the user must re-authenticate via a popup. The token is stored in browser localStorage tied to the origin URL — switching the app domain, clearing storage, or using a different browser forces re-authentication. If the app is primarily used for import (not ongoing auth), this is tolerable, but if users need to re-import periodically, silent expiry will cause silent failures.

**Why it happens:**
Developers test authentication once, it works, and they don't model the 6-month expiry path. The localStorage behaviour also means cross-browser and cross-device use breaks the session.

**How to avoid:**
Store the MUT in the database with a `created_at` timestamp. On each app load, check if the stored MUT is older than 5 months. If so, prompt the user to re-authenticate via MusicKit before attempting any Apple Music API calls. Do not rely on localStorage alone as the token store.

**Warning signs:**
- Apple Music API calls failing with `401` for users who authenticated months ago
- No `music_user_token_created_at` or expiry tracking in the data model

**Phase to address:**
Phase 2 (Apple Music auth / import). Model the expiry from the start.

---

### Pitfall 5: Playlist Ownership Model Does Not Match the App's Multi-User Read Requirement

**What goes wrong:**
The 31 playlists are owned by a single Spotify account (Mark's, presumably). Reading the track contents of a private playlist via the API requires the authenticated user to be the owner or a collaborator. If the other three friends connect their Spotify accounts, their tokens cannot read the playlist tracks — they can follow the playlist but `GET /playlists/{id}/tracks` returns empty or forbidden.

**Why it happens:**
Developers assume "I can see this playlist in the Spotify app" translates to "I can read it via API with any user token". The API ownership model is stricter.

**How to avoid:**
Two options, choose one:
1. **Single-account import**: Only the playlist owner (Mark) performs the Spotify import. The other three users never need Spotify OAuth. This is simpler and correct for this app's model — data is stored in the app database, not re-read from Spotify by each user.
2. **Make playlists public or collaborative**: The playlist owner changes playlists to public or collaborative on Spotify, enabling all user tokens to read them.

For this project, Option 1 is the right answer. The app stores imported data; re-reading from Spotify per-user is unnecessary.

**Warning signs:**
- Design assumes all 4 users will connect Spotify and independently import data
- Schema has `spotify_user_id` per user tied to import ownership without a clear "who owns the source data" model

**Phase to address:**
Phase 1 (data architecture / auth design). Decide before building multi-user auth.

---

### Pitfall 6: Spotify Token Refresh Race Conditions in Server-Side Contexts

**What goes wrong:**
Spotify access tokens expire after 1 hour. In a server-side context (Next.js API routes or background import jobs), if multiple requests fire simultaneously, a race condition causes multiple simultaneous refresh attempts. Spotify may accept only one and invalidate the others, causing some requests to fail with `401` even after a "successful" refresh.

**Why it happens:**
Token refresh is treated as a simple "if expired, refresh" check without a mutex or lock. Concurrent API calls each independently detect expiry and each tries to refresh.

**How to avoid:**
Implement token refresh with a database lock or in-memory mutex. When refreshing, set a `is_refreshing: true` flag atomically; other requests that detect expiry should wait (or queue) rather than each issuing their own refresh. Use `Authorization Code Flow` (server-side, with client secret) rather than PKCE for the import-only Spotify connection, since the secret stays server-side and the token refresh is more reliable.

**Warning signs:**
- Intermittent `401` errors during bulk playlist imports that succeed on retry
- No `token_refresh_lock` or similar concurrency control in auth code

**Phase to address:**
Phase 1 (Spotify import pipeline). Model this before building the import job.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store Spotify access tokens in browser cookies only | Simpler auth flow | Token unavailable for server-side import jobs; forces client-initiated imports | Never — use server-side token store from the start |
| Skip genre enrichment on import; add later | Faster initial build | Requires backfilling all 31x16=496 tracks later; MusicBrainz lookup is sequential and rate-limited | Acceptable in Phase 1 if the enrichment job is designed as part of the schema from day one |
| Use Spotify as the sole data source and skip Apple Music import | Avoids MusicKit complexity | Apple Music playlists may have different tracks or ordering; dual-source validation catches data quality issues | Acceptable for MVP if acknowledged as an explicit limitation |
| Hard-code contributor parsing regex for known initials | Works for 31 existing sessions | Breaks on any session where description format deviates; no error visibility | Acceptable in Phase 1 only if unknown-format sessions are flagged explicitly rather than silently failing |
| Derive track ordering purely from playlist position | Correct for most sessions | Assumes nobody reordered tracks on Spotify/Apple Music after the session; no way to verify | Acceptable given the archive is historical and unlikely to change |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Spotify OAuth | Using Implicit Grant flow (deprecated November 2025) | Use Authorization Code with PKCE for client-side or Authorization Code Flow (server-side with client secret) for import jobs |
| Spotify API | Fetching full playlist on every page load to check for changes | Store `snapshot_id`; only re-fetch if snapshot has changed |
| Spotify API | Calling audio features endpoint expecting genre/mood data | That endpoint returns `403` for new apps; use Last.fm + MusicBrainz instead |
| Apple MusicKit JS | Calling `MusicKit.configure()` with a static developer token string | Fetch the token from a backend endpoint; never embed it in frontend code |
| Apple MusicKit JS | Assuming authorization popup works the same on all browsers | The authorize() popup can hang if the referrer doesn't respond; test Safari, Chrome, Firefox explicitly |
| Apple Music API | Assuming playlist description field is always populated | Description is returned as `{ standard: "..." }` object; field may be null or absent — guard on access |
| Last.fm tags | Treating tags as authoritative genre classifications | Tags are community-curated and include non-genre labels ("seen live", "favourite"); filter by known genre taxonomy |
| MusicBrainz | Assuming ISRC-to-track lookup always finds a match | Spotify tracks and MusicBrainz recordings have different ISRCs for re-releases; match on artist + title as fallback |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Enriching all 496 tracks synchronously on import | Import hangs for 5-10 minutes; request timeout | Run enrichment as a background job with progress tracking; return import ID immediately | Immediately on first full import |
| N+1 Last.fm lookups (one per track) | 496 sequential HTTP calls at 1-2 req/sec; enrichment takes 8+ minutes | Deduplicate by artist first (~50 unique artists), then batch with delay | On any full import |
| Fetching full playlist data on every analytics page render | Slow page loads; Spotify rate limit hit | Store all track data in the app database after import; analytics read from DB, not Spotify API | At any usage level |
| MusicBrainz rate limit (1 req/sec per IP) | 503 errors mid-enrichment; partial genre data | Implement exponential backoff and a queue with `setTimeout` delay between calls | After ~10 rapid requests |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Apple Music `.p8` private key in frontend code or environment variables that ship to the browser | Key compromise requires revocation and rotation; any token signed with it is invalidated | Store `.p8` key in server-side environment variable only; generate tokens in a backend route |
| Storing Spotify refresh tokens unencrypted in the database | Refresh tokens grant long-lived API access; a DB leak exposes all user music data | Encrypt refresh tokens at rest using the app's server-side encryption key |
| Building the public read-only view without rate-limiting it | Bot traffic or scraping hammers the DB and potentially re-triggers Spotify API calls | Public view reads only from the app database (no API calls); add basic rate limiting if hosted publicly |
| Not scoping Spotify OAuth minimally | Over-permissive scopes increase blast radius if tokens leak | Request only `playlist-read-private` + `playlist-read-collaborative`; never request write scopes unless needed |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Silent Apple Music token expiry | User tries to trigger a re-import 6 months later; fails with no explanation | Check MUT age on app load; show "Apple Music re-authentication needed" banner if token is >5 months old |
| No import progress feedback | Full import of 31 playlists takes time; user thinks app is broken | Show per-playlist progress during import; display count of tracks imported so far |
| Playlist description parse failure silently drops sessions | Sessions without valid initials string appear with no contributor attribution; user doesn't know why | Mark sessions with failed description parsing explicitly ("Attribution unknown — manual entry needed") rather than skipping silently |
| Date entry friction for all 31 sessions | Manually entering dates for 31 sessions in one go is tedious | Import what can be auto-detected; present a "sessions needing dates" queue with the session name and theme pre-filled; allow bulk entry |
| Deep-linking into Apple Music vs Spotify produces wrong platform links | Users on Apple Music click Spotify links and vice versa | Detect user's connected platform on load; prioritise their platform's links |

---

## "Looks Done But Isn't" Checklist

- [ ] **Spotify import:** `snapshot_id` stored per playlist so re-imports detect no-change efficiently
- [ ] **Contributor attribution:** sessions with unparseable descriptions are flagged in the UI, not silently omitted
- [ ] **Genre data:** enrichment job runs against Last.fm + MusicBrainz, not Spotify audio features
- [ ] **Apple Music auth:** developer token served from a backend route, not embedded in frontend
- [ ] **Apple Music auth:** MUT stored in DB with `created_at`; expiry check on app load
- [ ] **Spotify auth:** all 4 users added to Spotify Developer Dashboard allowlist before testing
- [ ] **Playlist ownership:** import runs under the playlist owner's token, not each user's token independently
- [ ] **Token refresh:** server-side Spotify token refresh has concurrency protection (no race on simultaneous requests)
- [ ] **Public view:** reads from app DB only — no Spotify/Apple Music API calls triggered by public page views
- [ ] **Metadata storage:** no audio feature data is stored (it was never retrieved); only track name, artist, album, IDs

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Apple Music `.p8` key exposed | HIGH | Revoke key in Apple Developer portal immediately; create new Media Identifier + key; regenerate all developer tokens; redeploy |
| Spotify user cap hit (6th user added) | LOW | Add the user to the Developer Dashboard allowlist; no code changes needed |
| Audio features data gap discovered late | MEDIUM | Implement Last.fm + MusicBrainz enrichment job; backfill all 496 tracks sequentially |
| Apple Music MUT silent expiry | LOW | Add MUT age check to app startup; prompt re-auth; existing stored data is unaffected |
| Playlist description parsing fails on edge cases | LOW | Add a manual override UI for contributor order per session; no re-import needed |
| Spotify token refresh race condition found in production | MEDIUM | Add database-level refresh lock; rotate affected refresh tokens via re-auth |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Spotify 5-user allowlist cap | Phase 1 (Spotify auth setup) | All 4 collaborators can complete OAuth flow before proceeding |
| Spotify audio features gone | Phase 1 (data model + import design) | No code references `/v1/audio-features`; genre enrichment uses Last.fm/MusicBrainz |
| Apple developer token in frontend | Phase 2 (Apple Music auth) | `grep -r "developerToken" src/` finds only a fetch call to a backend route, not a hardcoded string |
| Apple MUT expiry not modelled | Phase 2 (Apple Music auth) | DB schema includes `music_user_token_created_at`; app load checks age |
| Playlist ownership + multi-user read | Phase 1 (data architecture) | Only the playlist owner's account performs imports; other users read from app DB |
| Spotify token refresh race | Phase 1 (import pipeline) | Import job has mutex/lock; stress test with concurrent requests |

---

## Sources

- Spotify: "Introducing some changes to our Web API" (Nov 2024) — https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
- Spotify: "Updating the Criteria for Web API Extended Access" (Apr 2025) — https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access
- Spotify: "Update on Developer Access and Platform Security" (Feb 2026) — https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
- Spotify: Quota modes documentation — https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- Spotify: Playlists concepts — https://developer.spotify.com/documentation/web-api/concepts/playlists
- Spotify: Compliance tips — https://developer.spotify.com/compliance-tips
- Spotify: Audio Features 403 error community thread — https://community.spotify.com/t5/Spotify-for-Developers/Web-API-Get-Track-s-Audio-Features-403-error/td-p/6654507
- Apple: Generating Developer Tokens — https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens
- Apple: User Authentication for MusicKit — https://developer.apple.com/documentation/applemusicapi/user-authentication-for-musickit
- Apple Developer Forums: MusicKit User Token Issues — https://developer.apple.com/forums/thread/703942
- Apple Developer Forums: When does a Music User token expire — https://developer.apple.com/forums/thread/654814
- Apple Developer Forums: CORS issue with MusicKit JS — https://developer.apple.com/forums/thread/114196
- FreqBlog: "Spotify Audio Features Is Dead. Here's What to Use Instead in 2026" — https://freqblog.com/blog/spotify-audio-features-replacement-2026/
- MusicBrainz API rate limiting — https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- Last.fm API documentation — https://www.last.fm/api
- TechCrunch: "Spotify changes developer mode API to require premium accounts, limits test users" — https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/

---
*Pitfalls research for: music archive and analytics web app (Spotify + Apple Music integrations)*
*Researched: 2026-06-11*
