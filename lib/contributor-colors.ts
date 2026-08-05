// Phase 3 UI-SPEC §Contributor colour map — LOCKED.
// Single source of truth for contributor identity colours, reused by
// ContributorChip, SessionCard, ArchiveClient, and Phase 4 analytics.
export const CONTRIBUTOR_COLORS: Record<string, { bg: string; fg: string }> = {
  MW: { bg: "oklch(0.554 0.252 296)", fg: "oklch(0.985 0 0)" }, // violet-600, zinc-50
  JG: { bg: "oklch(0.546 0.215 262)", fg: "oklch(0.985 0 0)" }, // blue-600, zinc-50
  JS: { bg: "oklch(0.769 0.156 70)", fg: "oklch(0.145 0 0)" }, // amber-500, zinc-950 (dark text)
  IT: { bg: "oklch(0.596 0.145 163)", fg: "oklch(0.985 0 0)" }, // emerald-600, zinc-50
};
