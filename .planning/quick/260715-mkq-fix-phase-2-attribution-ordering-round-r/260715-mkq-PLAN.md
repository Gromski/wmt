---
quick_id: 260715-mkq
description: "Fix Phase 2 attribution ordering: round-robin not blocks of four"
created: 2026-07-15
mode: quick
---

# Quick Task 260715-mkq: Fix Phase 2 attribution ordering (round-robin)

## Objective

Phase 2's import attributes tracks to contributors assuming the 16 tracks are
ordered in **blocks of four** (tracks 1–4 → chooser 0, 5–8 → chooser 1, …).
The real Warwick Massive Tunage playlists are ordered **round-robin** — one
track per chooser, cycling (pos 1 → chooser 0, 2 → chooser 1, 3 → chooser 2,
4 → chooser 3, 5 → chooser 0, …). The current logic mis-attributes every track.

This is **Finding 1** in `.planning/phases/03-archive-browsing/03-CONTEXT.md`.

## Task 1 — Correct the slot formula + comment in the import route

**Files:** `app/api/import/route.ts`

**Action:**
1. Line ~292: change the block-of-four slot calculation
   `const slot = Math.floor((position - 1) / 4);`
   to the round-robin calculation
   `const slot = (position - 1) % 4;`
2. Line ~175: update the stale comment that currently reads
   `// Determine attribution: initials[0..3] → positions 1-4, 5-8, 9-12, 13-16`
   to describe round-robin: `initials[0..3] map to positions by round-robin —
   pos 1→initials[0], 2→initials[1], 3→initials[2], 4→initials[3], 5→initials[0], …`
   (i.e. `initials[(position - 1) % 4]`).

**Verify:**
- `grep -n "(position - 1) % 4" app/api/import/route.ts` returns the slot line.
- `grep -n "Math.floor((position - 1) / 4)" app/api/import/route.ts` returns nothing.
- Biome check passes on the file (`npx biome check app/api/import/route.ts` or project lint).
- TypeScript still compiles (no type change — `slot` remains a 0–3 number).

**Done when:** the slot index is computed with `% 4`, the comment matches, lint/format clean, committed atomically.

## must_haves

- **truths:** track attribution follows round-robin (`initials[(position-1) % 4]`), not blocks of four.
- **artifacts:** `app/api/import/route.ts` slot formula uses `(position - 1) % 4`; comment updated.
- **key_links:** `.planning/phases/03-archive-browsing/03-CONTEXT.md` (Finding 1).

## Notes / Out of scope

- **Re-import required:** the corrected attribution only takes effect after a
  fresh import (replace-all per Phase 2 D-04). Re-import is a manual admin action
  (MusicKit JS authorize in the dashboard) and is **NOT** part of this task.
- No schema change. No test infra exists yet in the repo; verification is via
  grep + lint + typecheck.
