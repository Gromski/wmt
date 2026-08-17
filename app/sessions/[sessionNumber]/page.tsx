import { eq } from "drizzle-orm";
import { ArrowLeft, Music, SquarePlay } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContributorChip } from "@/components/ContributorChip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import { sessionLengthLabel } from "@/lib/duration";
import { buildRepeatIndex, repeatKey } from "@/lib/repeats";

function appleLink(appleId: string | null): string | null {
  if (!appleId) return null;
  return `https://music.apple.com/gb/song/${appleId}`;
}

// Static publish: prerender every session page at build from the baked data
// snapshot so production needs no runtime database. dynamicParams=false means
// any non-prerendered session number 404s statically instead of invoking a
// server function.
export const dynamicParams = false;

export async function generateStaticParams() {
  const rows = await db
    .select({ sessionNumber: schema.sessions.sessionNumber })
    .from(schema.sessions);
  return rows.map((row) => ({ sessionNumber: String(row.sessionNumber) }));
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionNumber: string }>;
}) {
  const { sessionNumber } = await params;
  const num = Number.parseInt(sessionNumber, 10);
  if (Number.isNaN(num)) notFound();

  const rows = await db
    .select({
      sessionNumber: schema.sessions.sessionNumber,
      theme: schema.sessions.theme,
      date: schema.sessions.date,
      description: schema.sessions.description,
      attributionParsed: schema.sessions.attributionParsed,
      position: schema.sessionTracks.position,
      title: schema.tracks.title,
      artistName: schema.tracks.artistName,
      albumName: schema.tracks.albumName,
      releaseYear: schema.tracks.releaseYear,
      appleId: schema.tracks.appleId,
      youtubeUrl: schema.tracks.youtubeUrl,
      durationMs: schema.tracks.durationMs,
      contributorInitials: schema.contributors.initials,
      contributorName: schema.contributors.name,
    })
    .from(schema.sessions)
    .leftJoin(
      schema.sessionTracks,
      eq(schema.sessionTracks.sessionId, schema.sessions.id),
    )
    .leftJoin(schema.tracks, eq(schema.tracks.id, schema.sessionTracks.trackId))
    .leftJoin(
      schema.contributors,
      eq(schema.contributors.id, schema.sessionTracks.attributedContributorId),
    )
    .where(eq(schema.sessions.sessionNumber, num))
    .orderBy(schema.sessionTracks.position);

  if (rows.length === 0) notFound();

  // Second, archive-wide query (~474 rows, build-time only) so the repeat
  // index reflects EVERY session, not just this one — a repeat can only be
  // detected by comparing across sessions (design Feature 2).
  const allTrackRows = await db
    .select({
      sessionNumber: schema.sessions.sessionNumber,
      title: schema.tracks.title,
      artistName: schema.tracks.artistName,
    })
    .from(schema.sessionTracks)
    .innerJoin(
      schema.tracks,
      eq(schema.tracks.id, schema.sessionTracks.trackId),
    )
    .innerJoin(
      schema.sessions,
      eq(schema.sessions.id, schema.sessionTracks.sessionId),
    );
  const repeatIndex = buildRepeatIndex(allTrackRows);

  const first = rows[0];
  const date = first.date instanceof Date ? first.date.getTime() : first.date;
  const dateLabel = date
    ? new Date(date).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date TBD";

  const tracks = rows
    .filter((r) => r.position !== null)
    .map((r) => ({
      position: r.position as number,
      title: r.title ?? "",
      artistName: r.artistName ?? "",
      albumName: r.albumName,
      releaseYear: r.releaseYear,
      appleId: r.appleId,
      youtubeUrl: r.youtubeUrl,
      durationMs: r.durationMs,
      contributorInitials: r.contributorInitials,
      contributorName: r.contributorName,
    }));

  const sessionLength = sessionLengthLabel(tracks.map((t) => t.durationMs));

  const headerContributors = new Map<string, string>();
  for (const t of tracks) {
    if (t.contributorInitials && t.contributorName) {
      headerContributors.set(t.contributorInitials, t.contributorName);
    }
  }

  const isUnattributed = !first.attributionParsed;

  return (
    <TooltipProvider>
      <main className="mx-auto max-w-[880px] px-6 pt-12">
        <Link
          href="/sessions"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All sessions
        </Link>

        <div className="mt-6 rounded-xl bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Session {first.sessionNumber}
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight">
            {first.theme}
          </h1>
          <p
            className={
              date
                ? "mt-2 text-base text-foreground"
                : "mt-2 text-sm text-muted-foreground"
            }
          >
            {dateLabel}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{sessionLength}</p>

          {headerContributors.size > 0 && (
            <div className="mt-3 flex items-center gap-1">
              {Array.from(headerContributors.entries()).map(
                ([initials, name]) => (
                  <ContributorChip
                    key={initials}
                    initials={initials}
                    name={name}
                    size={24}
                  />
                ),
              )}
            </div>
          )}

          {isUnattributed && (
            <div className="mt-3">
              <Badge variant="outline" className="text-muted-foreground">
                Attribution pending
              </Badge>
              <p className="mt-1 text-sm text-muted-foreground">
                Attribution pending — this session&rsquo;s tracks haven&rsquo;t
                been matched to contributors yet.
              </p>
            </div>
          )}

          {first.description && (
            <p className="mt-4 whitespace-pre-line text-sm text-muted-foreground">
              {first.description}
            </p>
          )}
        </div>

        <Separator className="my-8" />

        <ol className="divide-y divide-border">
          {tracks.map((t) => {
            const apple = appleLink(t.appleId);
            const youtube = t.youtubeUrl;
            const hasContributor = t.contributorInitials && t.contributorName;
            const otherSessions = (
              repeatIndex.get(repeatKey(t.title, t.artistName)) ?? []
            ).filter((n) => n !== num);
            return (
              <li key={t.position} className="flex items-center gap-3 py-4">
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {t.position}
                </span>
                {hasContributor && (
                  <ContributorChip
                    initials={t.contributorInitials as string}
                    name={t.contributorName as string}
                    size={20}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-base text-foreground">
                    <span className="truncate">{t.title}</span>
                    {otherSessions.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 font-normal text-muted-foreground"
                      >
                        Repeat: also in{" "}
                        {otherSessions.map((n, i) => (
                          <span key={n} className="contents">
                            {i > 0 ? ", " : ""}
                            <Link
                              href={`/sessions/${n}`}
                              className="underline-offset-2 hover:underline"
                            >
                              S{n}
                            </Link>
                          </span>
                        ))}
                      </Badge>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {t.artistName}
                    {t.albumName ? ` · ${t.albumName}` : ""}
                    {t.releaseYear ? ` · ${t.releaseYear}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {apple && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="min-h-[44px] min-w-[44px]"
                        >
                          <a
                            href={apple}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open in Apple Music"
                          >
                            <Music className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open in Apple Music</TooltipContent>
                    </Tooltip>
                  )}
                  {youtube && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="min-h-[44px] min-w-[44px]"
                        >
                          <a
                            href={youtube}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open on YouTube"
                          >
                            <SquarePlay className="h-4 w-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Open on YouTube</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </main>
    </TooltipProvider>
  );
}
