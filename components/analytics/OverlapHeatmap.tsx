import { Card, CardContent } from "@/components/ui/card";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

// Plain server component (no "use client") — presentational grid over a
// pre-computed similarity matrix. Recharts has no heatmap chart type, and
// D-10's requirement (colour intensity + a number per cell, 16 cells, no
// zoom/pan/legend) is simple enough that a hand-rolled CSS grid is the right
// call (04-RESEARCH.md § Pattern 7) — mirrors SessionCard's typed-payload
// server component shape.

export interface OverlapHeatmapContributor {
  initials: string;
  name: string;
}

function cellStyle(score: number, rowInitials: string) {
  const color = CONTRIBUTOR_COLORS[rowInitials];
  // score in [0,1] -> opacity in [0.15, 1] so even low-similarity cells stay
  // visible against the card background.
  const opacity = 0.15 + score * 0.85;
  // Use the contributor's own fg colour (not a hardcoded white) — JS's amber
  // bg pairs with dark text per CONTRIBUTOR_COLORS, so a fixed white would
  // fail contrast on that row (Rule 1 — correctness fix vs. the RESEARCH
  // example, which hardcoded text-white).
  return { backgroundColor: color?.bg, opacity, color: color?.fg };
}

export function OverlapHeatmap({
  contributors,
  matrix,
}: {
  contributors: OverlapHeatmapContributor[];
  matrix: number[][];
}) {
  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-[auto_repeat(4,1fr)] gap-1">
          <div />
          {contributors.map((c) => (
            <div
              key={`col-${c.initials}`}
              className="text-center text-sm font-medium text-muted-foreground"
            >
              {c.initials}
            </div>
          ))}
          {contributors.map((rowContributor, i) => (
            <div key={`row-${rowContributor.initials}`} className="contents">
              <div className="flex items-center text-sm font-medium text-muted-foreground">
                {rowContributor.initials}
              </div>
              {contributors.map((colContributor, j) => (
                <div
                  key={`${rowContributor.initials}-${colContributor.initials}`}
                  className="flex aspect-square items-center justify-center rounded text-sm font-semibold"
                  style={cellStyle(matrix[i][j], rowContributor.initials)}
                >
                  {i === j ? "—" : matrix[i][j].toFixed(2)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
