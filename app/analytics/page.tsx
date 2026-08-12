import { Suspense } from "react";

import { EraBarChart } from "@/components/analytics/EraBarChart";
import { OverlapHeatmap } from "@/components/analytics/OverlapHeatmap";
import { TasteProfileRadar } from "@/components/analytics/TasteProfileRadar";
import { TopArtistsBarChart } from "@/components/analytics/TopArtistsBarChart";
import { WildcardRanking } from "@/components/analytics/WildcardRanking";
import { WrappedCard } from "@/components/analytics/WrappedCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsData } from "@/lib/analytics";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";
import { buildOverlapMatrix, divergenceRanking } from "@/lib/similarity";
import { computeWrappedStats } from "@/lib/wrapped";

// Public RSC — no auth gate (ANALYTICS-01/ACCESS-04/D-13), no cache directive
// (RESEARCH Pitfall 1 — the Cache Components flag is not enabled app-wide;
// this route has no dynamic Request APIs so it already qualifies for Next's
// default automatic static rendering, exactly like /sessions).
//
// Layout is a stacked hub (D-13), now complete: "Group overview" (overlap
// heatmap + wildcard ranking, 04-02) -> "Taste profiles" (04-01) -> "Wrapped"
// (04-03, this file's final section) — no per-person routes (D-15).
export default async function AnalyticsPage() {
  const data = await getAnalyticsData();
  const { contributors } = data;

  const overviewContributors = contributors.map((c) => ({
    initials: c.initials,
    name: c.name,
  }));
  const matrix = buildOverlapMatrix(contributors);
  const ranking = divergenceRanking(contributors);
  const wrapped = computeWrappedStats(data);

  return (
    <main className="mx-auto max-w-[1120px] px-6 pt-12 pb-16">
      <h1 className="text-[20px] font-semibold leading-tight">Analytics</h1>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Group overview</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Who overlaps most (pairwise taste similarity)
            </p>
            <OverlapHeatmap
              contributors={overviewContributors}
              matrix={matrix}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              The wildcard (furthest from the group average)
            </p>
            <WildcardRanking ranking={ranking} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Taste profiles</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          {contributors.map((contributor) => {
            const color = CONTRIBUTOR_COLORS[contributor.initials];
            return (
              <Card key={contributor.initials}>
                <CardHeader>
                  <CardTitle style={{ color: color?.bg }}>
                    {contributor.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-6">
                  <Suspense
                    fallback={
                      <div className="text-sm text-muted-foreground">
                        Loading taste profile…
                      </div>
                    }
                  >
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Genre breakdown
                      </p>
                      <TasteProfileRadar
                        initials={contributor.initials}
                        data={contributor.genreBreakdown}
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Era
                      </p>
                      <EraBarChart
                        initials={contributor.initials}
                        data={contributor.decadeHistogram}
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Top artists
                      </p>
                      <TopArtistsBarChart
                        initials={contributor.initials}
                        data={contributor.topArtists}
                      />
                    </div>
                  </Suspense>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Wrapped</h2>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Headline stats and standout picks for each friend, across all sessions
        </p>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          {wrapped.map((stats) => (
            <WrappedCard key={stats.initials} stats={stats} />
          ))}
        </div>
      </section>
    </main>
  );
}
