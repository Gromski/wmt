"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

// Top-5 most-chosen artists (D-03/D-09), rendered as a horizontal bar chart
// so full artist names stay readable. Colour resolved via CONTRIBUTOR_COLORS.
export function TopArtistsBarChart({
  initials,
  data,
}: {
  initials: string;
  data: { artist: string; count: number }[];
}) {
  const color = CONTRIBUTOR_COLORS[initials]?.bg ?? "var(--chart-1)";
  const chartConfig = {
    count: { label: "Tracks", color },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        No artist data yet
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="max-h-[220px] w-full">
      <BarChart data={data} layout="vertical">
        <CartesianGrid horizontal={false} />
        <XAxis type="number" dataKey="count" hide />
        <YAxis
          type="category"
          dataKey="artist"
          tickLine={false}
          axisLine={false}
          width={120}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill={color} radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
