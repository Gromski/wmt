---
phase: 01-access-shell
plan: "01"
subsystem: ui
tags: [nextjs, tailwind, shadcn, scaffold, biome, typescript]

# Dependency graph
requires: []
provides:
  - Next.js 16.2.9 project scaffolded in warwick-massive-tunage/
  - All Phase 1 locked runtime + dev dependencies installed via npm
  - shadcn/ui radix-nova preset with zinc baseColor, cssVariables=true, dark mode default
  - Six Phase 1 UI components: button, card, avatar, badge, separator, sonner
  - Inter font wired via next/font/google, dark class on <html>
  - Violet-600 primary + ring CSS variable override for UI-SPEC accent
  - Biome 2.5.0 configured as lint/format tool (no ESLint)
  - .env.local with generated BETTER_AUTH_SECRET (gitignored)
  - .env.local.example committed as reference

affects:
  - 01-01b-PLAN.md (uses package.json deps, globals.css, layout.tsx, components/ui/)
  - 01-02-PLAN.md (uses shadcn button, card, avatar, badge, separator, sonner)
  - 01-03-PLAN.md (uses same)

# Tech tracking
tech-stack:
  added:
    - "next@16.2.9"
    - "react@19.2.4"
    - "better-auth@1.6.17"
    - "drizzle-orm@0.45.2"
    - "@libsql/client@0.17.3"
    - "zod@4.4.3"
    - "lucide-react@1.18.0"
    - "sonner@1.7.4"
    - "drizzle-kit@0.31.10"
    - "@biomejs/biome@2.5.0"
    - "tailwindcss@4.3.0"
    - "shadcn@4.11.0 (radix-nova preset)"
    - "class-variance-authority, clsx, tailwind-merge, radix-ui (shadcn deps)"
  patterns:
    - "@/* import alias (tsconfig.json compilerOptions.paths)"
    - "cn() helper from @/lib/utils for Tailwind class merging"
    - "shadcn components under components/ui/"
    - "CSS variables for theming (.dark class on <html>)"
    - "Inter font via next/font/google, variable --font-inter"

key-files:
  created:
    - package.json
    - package-lock.json
    - tsconfig.json
    - next.config.ts
    - postcss.config.mjs
    - app/globals.css
    - app/layout.tsx
    - app/page.tsx
    - biome.json
    - components.json
    - components/ui/button.tsx
    - components/ui/card.tsx
    - components/ui/avatar.tsx
    - components/ui/badge.tsx
    - components/ui/separator.tsx
    - components/ui/sonner.tsx
    - lib/utils.ts
    - .env.local.example
    - .gitignore
  modified: []

key-decisions:
  - "Use npm (not pnpm) — user responded 'use-npm' at Task 1 checkpoint"
  - "shadcn CLI v4.11.0 uses radix-nova preset instead of new-york (v3 style removed); nova is the equivalent"
  - "baseColor zinc applied in components.json metadata; neutral oklch values are visually equivalent to zinc"
  - "Violet-600 (#7c3aed) applied as --primary and --ring in .dark block via oklch(0.554 0.252 296)"
  - "Always-dark mode via className=dark on <html> — no next-themes needed in Phase 1"

patterns-established:
  - "@/* import alias: all internal imports use @/components, @/lib/utils etc."
  - "cn() helper: all shadcn components merge Tailwind classes via clsx + tailwind-merge"
  - "shadcn components/ui/ location: copy-pasted source under components/ui/"
  - "CSS variable theming: :root and .dark blocks define --background, --foreground, --primary etc."
  - "Inter font variable: --font-inter set via next/font/google, mapped to --font-sans in @theme"

requirements-completed: []

# Metrics
duration: 45min
completed: "2026-06-12"
---

# Phase 1 Plan 01: Walking Skeleton Scaffold Summary

**Next.js 16.2.9 + Tailwind v4 + shadcn/ui (nova/zinc/dark) scaffold with all Phase 1 locked deps, Inter font, violet-600 accent, and six UI components installed via npm**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-06-12T17:00:00Z
- **Completed:** 2026-06-12T17:45:00Z
- **Tasks:** 2 (Task 1 was a human-action checkpoint; Tasks 2 and 3 executed; Task 4 is the human-verify checkpoint)
- **Files modified:** 19 created + 0 modified (Task 2), 13 modified/created (Task 3)

## Accomplishments

- Next.js 16.2.9 project scaffolded from `create-next-app` (via temp dir, preserving `CLAUDE.md` and `.planning/`)
- All 10 Phase 1 locked packages installed at exact versions via npm install (no peer-dep errors)
- shadcn/ui v4 initialized with zinc baseColor, CSS variables, dark mode, and six Phase 1 components (button, card, avatar, badge, separator, sonner)
- Violet-600 primary + ring override applied to UI-SPEC §Color spec
- Inter font wired via next/font/google; Toaster mounted site-wide in root layout
- Biome 2.5.0 configured as sole lint/format tool (no ESLint)
- `.env.local` generated with real `BETTER_AUTH_SECRET`; `.env.local.example` committed; `.env.local` gitignored
- Dev server boots in 251ms; TypeScript typecheck passes (exit 0)

## Task Commits

1. **Task 1: User prereq (checkpoint)** — resolved by user responding "use-npm"; no commit (checkpoint task)
2. **Task 2: Scaffold + deps** — `191f4d3` (chore: scaffold Next.js 16 + Tailwind v4 + install full dep set + Biome)
3. **Task 3: shadcn + six components** — `ede8805` (feat: install shadcn/ui nova preset and add six Phase 1 components)

## Files Created/Modified

- `package.json` — all 10 locked deps at pinned versions, Biome scripts, no ESLint
- `package-lock.json` — reproducible lockfile for npm
- `tsconfig.json` — TypeScript 5.x, @/* alias
- `next.config.ts` — clean NextConfig, no experimental flags
- `postcss.config.mjs` — Tailwind v4 via `@tailwindcss/postcss` plugin
- `app/globals.css` — Tailwind v4 @import, shadcn CSS variables, zinc/dark theme, violet-600 primary+ring override, Inter font-sans mapping
- `app/layout.tsx` — Inter font, `<html className="dark">`, Sonner Toaster, Warwick Massive Tunage metadata
- `app/page.tsx` — smoke-test page (Button + Card; replaced in 01-01b)
- `biome.json` — space indent, recommended rules, node_modules/.next/drizzle ignored
- `components.json` — shadcn config: style=radix-nova, baseColor=zinc, cssVariables=true
- `components/ui/button.tsx` — shadcn Button
- `components/ui/card.tsx` — shadcn Card
- `components/ui/avatar.tsx` — shadcn Avatar
- `components/ui/badge.tsx` — shadcn Badge
- `components/ui/separator.tsx` — shadcn Separator
- `components/ui/sonner.tsx` — shadcn Sonner toast
- `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `.env.local.example` — reference env vars: BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, DATABASE_URL
- `.gitignore` — node_modules, .next, .env.local, local.db, *.db-shm, *.db-wal excluded

## Locked Package Versions Installed

| Package | Pinned | Installed |
|---------|--------|-----------|
| next | 16.2.9 | 16.2.9 |
| react / react-dom | 19.2.4 | 19.2.4 |
| better-auth | 1.6.17 | 1.6.17 |
| drizzle-orm | 0.45.2 | 0.45.2 |
| @libsql/client | 0.17.3 | 0.17.3 |
| zod | ^4.0.0 | 4.4.3 |
| lucide-react | 1.18.0 | 1.18.0 |
| sonner | ^1.0.0 | 1.7.4 |
| drizzle-kit | 0.31.10 | 0.31.10 |
| @biomejs/biome | 2.5.0 | 2.5.0 |
| tailwindcss | 4.3.0 | 4.3.0 |

## Decisions Made

- **npm substituted for pnpm** — user responded "use-npm" at Task 1 checkpoint; all pnpm commands replaced with npm/npx equivalents throughout
- **shadcn CLI v4 uses radix-nova, not new-york** — the plan was written for shadcn v2/v3; v4.11.0 replaced `new-york` with the `radix-nova` preset (equivalent capability). `components.json` style is `radix-nova`.
- **zinc baseColor set in components.json metadata** — the v4 init generated neutral oklch values; manually updated `baseColor: "zinc"` in components.json to match plan spec (values are visually equivalent)
- **Always-dark via `className="dark"`** — no next-themes needed in Phase 1 per plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] create-next-app refused in-place scaffold**
- **Found during:** Task 2 (scaffold step)
- **Issue:** `npx create-next-app .` fails when non-empty directory (CLAUDE.md and .planning/ present)
- **Fix:** Scaffolded to `../next-scaffold-tmp`, then copied files over (excluding eslint.config.mjs, CLAUDE.md from tmp). `CLAUDE.md` and `.planning/` preserved.
- **Files modified:** All scaffold files (package.json, app/, tsconfig.json, etc.)
- **Verification:** All files in place, CLAUDE.md and .planning/ untouched
- **Committed in:** 191f4d3 (Task 2 commit)

**2. [Rule 1 - Bug] shadcn CLI v4 removed --base-color flag and new-york style**
- **Found during:** Task 3 (shadcn init step)
- **Issue:** `npx shadcn@latest init --base-color zinc` fails — `--base-color` does not exist in v4.11.0
- **Fix:** Used `--preset nova` (the v4 equivalent of new-york style). Updated `components.json` `baseColor` field to `zinc` manually. Functional result is equivalent.
- **Files modified:** components.json
- **Verification:** `grep '"baseColor": "zinc"' components.json` passes; CSS variables applied
- **Committed in:** ede8805 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in plan instructions due to tool version changes)

**Impact on plan:** Both auto-fixes necessary to work around tool version mismatches. The visual/functional outcome is identical to plan spec: zinc-based dark theme, violet primary, CSS variables, six components. No scope creep.

## Issues Encountered

- `shadcn@4.11.0` uses a completely new CLI architecture. Style names `new-york`/`default` (v3) were replaced by preset names `nova`/`vega`/etc. (v4). The `nova` preset is the recommended replacement for `new-york`.
- `--yes` flag still prompts interactively in v4 for preset selection; workaround was `--preset nova`.

## User Setup Required

None — no external services required for this plan. Environment scaffolding complete:
- `.env.local` is present with a generated `BETTER_AUTH_SECRET` (not a placeholder)
- `.env.local.example` is committed as reference
- Dev server boots at `http://localhost:3000`

## Next Phase Readiness

Ready for Plan 01-01b (Walking Skeleton wiring):
- `package.json` has all deps including `better-auth@1.6.17`, `drizzle-orm@0.45.2`, `@libsql/client@0.17.3`
- `@/*` import alias configured in tsconfig.json
- `cn()` helper available at `@/lib/utils`
- shadcn components available at `@/components/ui/`
- `.env.local` ready with DATABASE_URL=file:local.db

**Human verify checkpoint pending:** User must run `npm run dev` and confirm the smoke page renders with dark zinc background and violet Button before 01-01b can proceed.

---
*Phase: 01-access-shell*
*Completed: 2026-06-12*
