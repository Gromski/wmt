"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

// Decade histogram bar chart (D-02/D-09) — includes an "Unknown" bucket for
// null release_year tracks. Colour resolved via CONTRIBUTOR_COLORS, matching
// the per-person identity convention used everywhere else in this phase.
export function EraBarChart({
  initials,
  data,
}: {
  initials: string;
  data: { decade: string; count: number }[];
}) {
  const color = CONTRIBUTOR_COLORS[initials]?.bg ?? "var(--chart-1)";
  const chartConfig = {
    count: { label: "Tracks", color },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        No era data yet
      </div>
    );
  }

  return (
    // Explicit height (aspect-auto overrides ChartContainer's default
    // aspect-video) so the ResponsiveContainer gets a definite box and the
    // chart can't overflow into the section below it.
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-[200px] w-full"
    >
      <BarChart data={data} margin={{ top: 4, bottom: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="decade"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill={color} radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
