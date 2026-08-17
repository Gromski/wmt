import { Card, CardContent } from "@/components/ui/card";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";
import { firstName } from "@/lib/utils";
import type { WrappedStats } from "@/lib/wrapped";

// Plain server component (no "use client") — bold, vivid, one card per
// contributor in their own colour (D-11 Spotify-Wrapped aesthetic). Only
// colour source is CONTRIBUTOR_COLORS — never a second palette. Copy is
// fun/personal per CONTEXT specifics note, not clinical.

function formatEraRange(eraRange: WrappedStats["eraRange"]): string {
  const { oldest, newest } = eraRange;
  if (oldest === null || newest === null) return "No dated tracks yet";
  if (oldest === newest) return `${oldest}`;
  return `${oldest}–${newest}`;
}

function formatGroupUniquePick(
  name: string,
  pick: WrappedStats["groupUniquePick"],
): string {
  if (!pick)
    return "Nothing exclusive yet — great taste overlaps with everyone";
  const label = pick.kind === "artist" ? pick.value : `${pick.value} tracks`;
  return `Only ${name} played ${label}`;
}

export function WrappedCard({ stats }: { stats: WrappedStats }) {
  const color = CONTRIBUTOR_COLORS[stats.initials];

  return (
    <Card
      className="ring-0"
      style={{ backgroundColor: color?.bg, color: color?.fg }}
    >
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Wrapped
          </p>
          <h3 className="text-2xl font-bold leading-tight">
            {firstName(stats.name)}
          </h3>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Signature sound
          </p>
          <p className="text-lg font-semibold">{stats.signatureGenre}</p>
          <p className="text-sm opacity-90">Top artist: {stats.topArtist}</p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Standout pick
          </p>
          <p className="text-sm font-semibold">
            {formatGroupUniquePick(
              firstName(stats.name),
              stats.groupUniquePick,
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Era range
          </p>
          <p className="text-sm font-semibold">
            {formatEraRange(stats.eraRange)}
          </p>
        </div>

        <div className="flex justify-between border-t border-current/20 pt-3">
          <div>
            <p className="text-lg font-bold">{stats.headlineCounts.tracks}</p>
            <p className="text-xs opacity-80">tracks</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {stats.headlineCounts.distinctArtists}
            </p>
            <p className="text-xs opacity-80">artists</p>
          </div>
          <div>
            <p className="text-lg font-bold">{stats.headlineCounts.sessions}</p>
            <p className="text-xs opacity-80">sessions</p>
          </div>
        </div>

        {stats.repeatedPicks.length > 0 && (
          <div className="border-t border-current/20 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide opacity-80">
              Repeated picks
            </p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {stats.repeatedPicks.map((pick) => (
                <li
                  key={`${pick.title}::${pick.artist}`}
                  className="truncate text-sm font-semibold"
                >
                  {pick.title} — {pick.sessions.map((n) => `S${n}`).join(", ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
