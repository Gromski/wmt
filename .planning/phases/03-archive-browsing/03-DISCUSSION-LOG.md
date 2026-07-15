# Phase 3: Archive Browsing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 3-Archive Browsing
**Areas discussed:** List layout & routing, Session detail layout, Track "open in" links, Search & timeline

---

## List Layout & Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid | Responsive grid of session cards | |
| Sortable table | Dense sortable table | |
| Card grid + table toggle | Both, view switcher | ✓ |

**User's choice:** Card grid + table toggle (timeline added as a third mode later)

| Option | Description | Selected |
|--------|-------------|----------|
| At `/` (replace stub) | Landing becomes the archive | |
| At `/sessions` | Archive at `/sessions`, `/` separate | ✓ |

**Follow-up (root page):** `/` redirects to `/sessions` (rejected a separate landing page).

| Option | Description | Selected |
|--------|-------------|----------|
| Newest session first | Descending session number | ✓ |
| Oldest first | Ascending | |
| By date | Order by manual date | |

| Option | Description | Selected |
|--------|-------------|----------|
| Show "Date TBD" | Placeholder for null dates | ✓ |
| Hide date field | Omit date line | |
| Sort to end | Push undated to bottom | |

---

## Session Detail Layout

> First batch of this area was interrupted so the user could clarify the meaning of "attribution" (= the person who chose the track). Round-robin ordering was then confirmed (see Findings), which invalidated the initial "grouped visually" lean and the questions were re-asked.

| Option | Description | Selected |
|--------|-------------|----------|
| Play-order list + chips | 1–16 list, contributor chip per row | ✓ |
| 4 sections by contributor | Regroup into per-person blocks | |
| Play-order + toggle | List + "group by person" toggle | |

**User's choice:** Play-order list + contributor chips (fits round-robin order).

| Option | Description | Selected |
|--------|-------------|----------|
| Title, artist, album, year, links | Full row | ✓ |
| Title, artist, links only | Leaner row | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full header + description | Number/theme/date/contributors + raw description | ✓ |
| Header without description | No raw description | |

| Option | Description | Selected |
|--------|-------------|----------|
| Play-order list, no chips | + "attribution pending" note | ✓ |
| "Unattributed" section | Single grouped heading | |
| Assume none remain | Don't design for it | |

---

## Track "Open In" Links

| Option | Description | Selected |
|--------|-------------|----------|
| Apple Music + YouTube | Apple deep-link + YouTube fallback | ✓ |
| + Spotify search link | Add a Spotify search convenience link | |
| Apple Music only | Ignore YouTube fallback | |

| Option | Description | Selected |
|--------|-------------|----------|
| Deep-link via appleId | Direct song URL | ✓ |
| Search fallback | Always search | |
| Deep-link, search if missing | Hybrid | |

| Option | Description | Selected |
|--------|-------------|----------|
| Icon buttons | Compact platform icons, new tab | ✓ |
| Text links | Explicit text links | |

---

## Search & Timeline

| Option | Description | Selected |
|--------|-------------|----------|
| Single search box | Matches theme/person/artist at once | ✓ |
| Faceted filters | Separate controls | |
| Search box + person filter | Middle ground | |

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side | Filter in-browser over all 31 | ✓ |
| Server-side | Query DB per search | |

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle on /sessions | Third view mode | ✓ |
| Separate /timeline route | Dedicated page | |

| Option | Description | Selected |
|--------|-------------|----------|
| Group at end as "Undated" | Undated collected at bottom | |
| Omit from timeline | Hide undated | |
| Fall back to session number | Slot by session number | ✓ |

---

## Claude's Discretion

- Apple Music storefront segment in deep-link URLs
- Card grid responsive breakpoints / column counts
- Client-side search data-loading approach (server pre-load vs API route)
- Contributor chip/avatar visual treatment
- Empty-state and loading-state copy

## Deferred Ideas

- Spotify "open in" links (until Spotify data imported; no search fallback meanwhile)
- Genre/artist tag display on tracks (Phase 4 Analytics)
- Separate `/` landing/intro page (root redirects to `/sessions` instead)
- Authenticated-user extras on browse (editing stays on `/dashboard`)

## Findings surfaced (captured in CONTEXT.md, must reach planner)

- **Finding 1 — attribution bug:** Phase 2 uses blocks-of-4 (`Math.floor((position-1)/4)`); real order is round-robin → should be `(position-1) % 4`. Noted as blocker; fix + re-import before Phase 3 verify/UAT.
- **Finding 2 — YouTube fallback data gap:** Phase 2 never captured YouTube links from descriptions; tracks off Apple Music may be missing. User chose "in scope — capture + link"; requires parser + schema change + re-import.
