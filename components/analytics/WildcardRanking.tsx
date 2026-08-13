import { Card, CardContent } from "@/components/ui/card";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";
import { firstName } from "@/lib/utils";

// Plain server component (no "use client") — renders the divergenceRanking
// output as an ordered list. D-07: all four are shown, ranked, with the top
// entry ([0]) highlighted as the "wildcard" using fun/personal copy (per
// CONTEXT specifics note), not clinical language.

export interface WildcardRankingEntry {
  initials: string;
  name: string;
  divergence: number;
}

export function WildcardRanking({
  ranking,
}: {
  ranking: WildcardRankingEntry[];
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        {ranking.map((entry, index) => {
          const color = CONTRIBUTOR_COLORS[entry.initials];
          const isWildcard = index === 0;

          return (
            <div
              key={entry.initials}
              className="flex items-center justify-between rounded-lg p-3"
              style={
                isWildcard
                  ? { boxShadow: `inset 0 0 0 2px ${color?.bg}` }
                  : undefined
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-sm font-semibold"
                  style={{ color: color?.bg }}
                >
                  {firstName(entry.name)}
                </span>
                {isWildcard && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    The Wildcard
                  </span>
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {entry.divergence.toFixed(2)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
