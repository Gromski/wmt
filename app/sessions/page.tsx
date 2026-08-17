import { desc, eq } from "drizzle-orm";
import { Suspense } from "react";

import { ArchiveClient } from "@/components/ArchiveClient";
import type { SessionCardPayload } from "@/components/SessionCard";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { sumDurations } from "@/lib/duration";

// Public RSC — no auth gate (D-01). Loads all sessions plus a per-session
// contributor chip list (two-query merge per PATTERNS.md to avoid a large
// session x track x contributor cross-product).
export default async function SessionsPage() {
  const sessionRows = await db
    .select({
      sessionNumber: schema.sessions.sessionNumber,
      theme: schema.sessions.theme,
      date: schema.sessions.date,
    })
    .from(schema.sessions)
    .orderBy(desc(schema.sessions.sessionNumber));

  const contributorRows = await db
    .select({
      sessionNumber: schema.sessions.sessionNumber,
      position: schema.sessionTracks.position,
      initials: schema.contributors.initials,
      name: schema.contributors.name,
      artistName: schema.tracks.artistName,
      durationMs: schema.tracks.durationMs,
    })
    .from(schema.sessionTracks)
    .innerJoin(
      schema.sessions,
      eq(schema.sessionTracks.sessionId, schema.sessions.id),
    )
    .leftJoin(
      schema.contributors,
      eq(schema.sessionTracks.attributedContributorId, schema.contributors.id),
    )
    .leftJoin(
      schema.tracks,
      eq(schema.tracks.id, schema.sessionTracks.trackId),
    );

  const contributorsBySession = new Map<
    number,
    { initials: string; name: string; position: number }[]
  >();
  const artistsBySession = new Map<number, Set<string>>();
  const durationsBySession = new Map<number, (number | null)[]>();
  for (const row of contributorRows) {
    if (row.initials && row.name) {
      const existing = contributorsBySession.get(row.sessionNumber) ?? [];
      if (!existing.some((c) => c.initials === row.initials)) {
        existing.push({
          initials: row.initials,
          name: row.name,
          position: row.position,
        });
      }
      contributorsBySession.set(row.sessionNumber, existing);
    }
    if (row.artistName) {
      const existing = artistsBySession.get(row.sessionNumber) ?? new Set();
      existing.add(row.artistName);
      artistsBySession.set(row.sessionNumber, existing);
    }
    const durations = durationsBySession.get(row.sessionNumber) ?? [];
    durations.push(row.durationMs);
    durationsBySession.set(row.sessionNumber, durations);
  }

  const sessions: SessionCardPayload[] = sessionRows.map((r) => {
    const { totalMs, unknownCount } = sumDurations(
      durationsBySession.get(r.sessionNumber) ?? [],
    );
    return {
      sessionNumber: r.sessionNumber,
      theme: r.theme,
      date: r.date instanceof Date ? r.date.getTime() : r.date,
      contributors: (contributorsBySession.get(r.sessionNumber) ?? [])
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ initials: c.initials, name: c.name })),
      artistNames: Array.from(artistsBySession.get(r.sessionNumber) ?? []),
      totalDurationMs: totalMs,
      hasUnknownLength: unknownCount > 0,
    };
  });

  return (
    <main className="mx-auto max-w-[1120px] px-6 pt-12">
      <h1 className="text-[20px] font-semibold leading-tight">Sessions</h1>
      <Suspense
        fallback={
          <div className="mt-8 text-muted-foreground">Loading sessions…</div>
        }
      >
        <ArchiveClient sessions={sessions} />
      </Suspense>
    </main>
  );
}
