import Link from "next/link";

import { ContributorChip } from "@/components/ContributorChip";
import { Card, CardContent } from "@/components/ui/card";

export interface SessionCardContributor {
  initials: string;
  name: string;
}

export interface SessionCardPayload {
  sessionNumber: number;
  theme: string;
  date: number | null;
  contributors: SessionCardContributor[];
  artistNames: string[];
}

export function SessionCard({ session }: { session: SessionCardPayload }) {
  const dateLabel = session.date
    ? new Date(session.date).toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Date TBD";

  return (
    <Link
      href={`/sessions/${session.sessionNumber}`}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card className="h-full border border-border ring-0 transition-colors group-hover:border-primary group-focus-visible:border-primary">
        <CardContent className="flex flex-col gap-2 p-4">
          <p className="text-sm text-muted-foreground">
            Session {session.sessionNumber}
          </p>
          <h2 className="text-[20px] font-semibold leading-tight">
            {session.theme}
          </h2>
          <p
            className={
              session.date
                ? "text-base text-foreground"
                : "text-sm text-muted-foreground"
            }
          >
            {dateLabel}
          </p>
          {session.contributors.length > 0 && (
            <div className="mt-1 flex items-center gap-1">
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
        </CardContent>
      </Card>
    </Link>
  );
}
