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
      <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
        No genre data yet
      </div>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[320px] w-full max-w-[320px]"
    >
      <RadarChart
        data={data}
        outerRadius="70%"
        margin={{ top: 16, bottom: 16, left: 64, right: 64 }}
      >
        <ChartTooltip content={<ChartTooltipContent />} />
        <PolarAngleAxis
          dataKey="genre"
          tick={{ fontSize: 11 }}
          tickFormatter={truncateLabel}
        />
        <PolarGrid />
        <Radar dataKey="count" fill={color} fillOpacity={0.5} stroke={color} />
      </RadarChart>
    </ChartContainer>
  );
}

// Truncate very long genre labels (e.g. "Singer-Songwriter", "Drum & Bass")
// so the outermost PolarAngleAxis labels don't overflow the card width —
// the shared ~14-genre axis (04-04 UAT gap-closure) leaves less room per
// spoke than the previous 24-28 genre per-person axis did.
const MAX_LABEL_LENGTH = 14;
function truncateLabel(label: string): string {
  if (label.length <= MAX_LABEL_LENGTH) return label;
  return `${label.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}
