import Link from "next/link";

import { ContributorChip } from "@/components/ContributorChip";
import type { SessionCardPayload } from "@/components/SessionCard";
import { Separator } from "@/components/ui/separator";

/**
 * Presentational chronological rail. Receives already-filtered sessions from
 * ArchiveClient and sorts them for display: dated sessions newest-first, then
 * undated sessions after them ordered by sessionNumber descending (D-12 —
 * undated sessions are never hidden). No client state of its own.
 */
export function SessionTimeline({
  sessions,
}: {
  sessions: SessionCardPayload[];
}) {
  const dated = sessions
    .filter((s) => s.date !== null)
    .sort((a, b) => (b.date as number) - (a.date as number));
  const undated = sessions
    .filter((s) => s.date === null)
    .sort((a, b) => b.sessionNumber - a.sessionNumber);
  const ordered = [...dated, ...undated];

  let lastYear: number | null = null;

  return (
    <ul className="mt-8 border-l border-border pl-6">
      {ordered.map((session) => {
        const year = session.date ? new Date(session.date).getFullYear() : null;
        const showYearSeparator = year !== null && year !== lastYear;
        if (year !== null) lastYear = year;

        const dateLabel = session.date
          ? new Date(session.date).toLocaleDateString("en-GB", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "Date TBD";

        return (
          <li
            key={session.sessionNumber}
            className="group relative pb-6 last:pb-0"
          >
            {showYearSeparator && (
              <div className="mb-4 -ml-6">
                <Separator className="mb-2" />
                <p className="text-sm text-muted-foreground">{year}</p>
              </div>
            )}
            <span
              className="absolute top-2 -left-[29px] flex h-11 w-11 -translate-x-1/2 items-center justify-center"
              aria-hidden="true"
            >
              <span className="h-2.5 w-2.5 rounded-full border border-border bg-background transition-colors group-hover:bg-primary group-focus-within:bg-primary" />
            </span>
            <Link
              href={`/sessions/${session.sessionNumber}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="rounded-lg border border-border bg-card p-4 transition-colors group-hover:border-primary group-focus-within:border-primary">
                <p className="text-sm text-muted-foreground">
                  Session {session.sessionNumber}
                </p>
                <h3 className="text-[20px] font-semibold leading-tight">
                  {session.theme}
                </h3>
                <p
                  className={
                    session.date
                      ? "mt-1 text-base text-foreground"
                      : "mt-1 text-sm text-muted-foreground"
                  }
                >
                  {dateLabel}
                </p>
                {session.contributors.length > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    {session.contributors.map((c) => (
                      <ContributorChip
                        key={c.initials}
                        initials={c.initials}
                        name={c.name}
                        size={24}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
