"use client";

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CONTRIBUTOR_COLORS } from "@/lib/contributor-colors";

// Per-contributor genre "taste fingerprint" radar (D-09). Colour is resolved
// from CONTRIBUTOR_COLORS — never shadcn's generic --chart-N series vars,
// since this chart represents one specific person, not a generic data series.
export function TasteProfileRadar({
  initials,
  data,
}: {
  initials: string;
  data: { genre: string; count: number }[];
}) {
  const color = CONTRIBUTOR_COLORS[initials]?.bg ?? "var(--chart-1)";
  const chartConfig = {
    count: { label: "Tracks", color },
  } satisfies ChartConfig;

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        No genre data yet
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[280px]"
    >
      <RadarChart data={data}>
        <ChartTooltip content={<ChartTooltipContent />} />
        <PolarAngleAxis dataKey="genre" />
        <PolarGrid />
        <Radar dataKey="count" fill={color} fillOpacity={0.5} stroke={color} />
      </RadarChart>
    </ChartContainer>
  );
}
