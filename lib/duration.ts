// lib/duration.ts — pure helpers for session-length formatting (design:
// docs/superpowers/specs/2026-08-17-session-length-and-repeat-flags-design.md,
// Feature 1). No I/O, no DB access — mirrors lib/similarity.ts's pure-module
// style (PATTERNS.md).

// formatDuration — round to the nearest minute, then render as "1h 12m" for
// totals of an hour or more, else "47m". 0ms -> "0m".
export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

// sumDurations — sum the non-null durations and count how many are null
// (unknown length, e.g. the 7 YouTube fallback tracks — Finding 2).
export function sumDurations(durations: (number | null)[]): {
  totalMs: number;
  unknownCount: number;
} {
  let totalMs = 0;
  let unknownCount = 0;
  for (const d of durations) {
    if (d === null) {
      unknownCount += 1;
    } else {
      totalMs += d;
    }
  }
  return { totalMs, unknownCount };
}

// sessionLengthLabel — formatted total, with a trailing "+" ("at least")
// when one or more tracks have unknown length, so we never imply false
// precision.
export function sessionLengthLabel(durations: (number | null)[]): string {
  const { totalMs, unknownCount } = sumDurations(durations);
  const label = formatDuration(totalMs);
  return unknownCount > 0 ? `${label}+` : label;
}
