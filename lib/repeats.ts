// lib/repeats.ts — pure helpers for repeated-track detection (design:
// docs/superpowers/specs/2026-08-17-session-length-and-repeat-flags-design.md,
// Feature 2). No I/O, no DB access — mirrors lib/similarity.ts's pure-module
// style (PATTERNS.md).

export function repeatKey(title: string, artist: string): string {
  return `${title.trim().toLowerCase()} :: ${artist.trim().toLowerCase()}`;
}

// buildRepeatIndex — group rows by repeatKey and return only the keys that
// appear in >=2 DISTINCT session numbers, mapped to those sorted distinct
// session numbers. Keys in a single session are omitted entirely.
export function buildRepeatIndex(
  rows: { title: string; artistName: string; sessionNumber: number }[],
): Map<string, number[]> {
  const sessionsByKey = new Map<string, Set<number>>();
  for (const row of rows) {
    const key = repeatKey(row.title, row.artistName);
    const existing = sessionsByKey.get(key) ?? new Set<number>();
    existing.add(row.sessionNumber);
    sessionsByKey.set(key, existing);
  }

  const index = new Map<string, number[]>();
  for (const [key, sessionSet] of sessionsByKey) {
    if (sessionSet.size >= 2) {
      index.set(
        key,
        [...sessionSet].sort((a, b) => a - b),
      );
    }
  }
  return index;
}

// repeatedPicks — for the given rows, return one entry per distinct
// repeated key present in the rows (title/artist taken from the first
// occurrence), with `sessions` = the FULL index list for that key (not
// limited to the given rows). Sorted by title.
export function repeatedPicks(
  rows: { title: string; artistName: string; sessionNumber: number }[],
  index: Map<string, number[]>,
): { title: string; artist: string; sessions: number[] }[] {
  const seen = new Map<string, { title: string; artist: string }>();
  for (const row of rows) {
    const key = repeatKey(row.title, row.artistName);
    const sessions = index.get(key);
    if (!sessions) continue;
    if (!seen.has(key)) {
      seen.set(key, { title: row.title, artist: row.artistName });
    }
  }

  const result = [...seen.entries()].map(([key, { title, artist }]) => ({
    title,
    artist,
    sessions: index.get(key) ?? [],
  }));

  return result.sort((a, b) => a.title.localeCompare(b.title));
}
