import { Suspense } from "react";

import { EraBarChart } from "@/components/analytics/EraBarChart";
import { TasteProfileRadar } from "@/components/analytics/TasteProfileRadar";
import { TopArtistsBarChart } from "@/components/analytics/TopArtistsBarChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAnalyticsData } from "@/lib/analytics";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

// Public RSC — no auth gate (ANALYTICS-01/ACCESS-04/D-13), no cache directive
// (RESEARCH Pitfall 1 — the Cache Components flag is not enabled app-wide;
// this route has no dynamic Request APIs so it already qualifies for Next's
// default automatic static rendering, exactly like /sessions).
//
// Layout is a stacked hub (D-13): this plan (04-01) ships only the "Taste
// profiles" section. Plan 04-02 (group overview: overlap heatmap + wildcard
// ranking) slots in ABOVE this section; Plan 04-03 (Wrapped cards) slots in
// BELOW it — both insert new <section>s here without restructuring this file.
export default async function AnalyticsPage() {
  const { contributors } = await getAnalyticsData();

  return (
    <main className="mx-auto max-w-[1120px] px-6 pt-12 pb-16">
      <h1 className="text-[20px] font-semibold leading-tight">Analytics</h1>

      {/* Plan 04-02 group overview (overlap heatmap + wildcard ranking) inserts here. */}

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

      {/* Plan 04-03 Wrapped cards section inserts here. */}
    </main>
  );
}
