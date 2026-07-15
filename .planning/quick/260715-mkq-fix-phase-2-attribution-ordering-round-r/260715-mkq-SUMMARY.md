---
quick_id: 260715-mkq
description: "Fix Phase 2 attribution ordering: round-robin not blocks of four"
completed: 2026-07-15
commit: 961a9ad
files_modified:
  - app/api/import/route.ts
---

# Quick Task 260715-mkq Summary: Fix attribution slot formula (round-robin)

## One-liner

Replaced block-of-four slot calculation `Math.floor((position-1)/4)` with round-robin `(position-1)%4` in the Apple Music import route so track attribution matches the actual playlist ordering.

## What Changed

**File:** `app/api/import/route.ts`

1. **Line 293 (slot formula):** `Math.floor((position - 1) / 4)` → `(position - 1) % 4`
2. **Line 175 (comment):** Replaced stale block-of-four description with accurate round-robin mapping:
   `initials[(position - 1) % 4]` — pos 1→initials[0], 2→initials[1], 3→initials[2], 4→initials[3], 5→initials[0], …

## Verification Results

| Check | Result |
|-------|--------|
| `grep "(position - 1) % 4"` present at line 293 | PASS |
| `grep "Math.floor((position - 1) / 4)"` absent | PASS |
| `npx biome check app/api/import/route.ts` | PASS — no issues |
| `npx tsc --noEmit` | PASS — no type errors |

## Commit

`961a9ad` — `fix(02): attribution uses round-robin ((position-1) % 4) not blocks of four`

## Deviations

None — plan executed exactly as written.

## Notes

A fresh re-import (MusicKit JS authorize in the admin dashboard) is required before the corrected attribution takes effect in the database. This is a manual admin action outside the scope of this task.
