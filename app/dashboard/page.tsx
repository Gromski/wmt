import { asc } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AttributionErrorCard,
  type ContributorOption,
} from "@/components/AttributionErrorCard";
import { DashboardSignOut } from "@/components/DashboardSignOut";
import { ImportTriggerCard } from "@/components/ImportTriggerCard";
import { SessionDateTable } from "@/components/SessionDateTable";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import * as schema from "@/db/schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getInitials } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Defence in depth — proxy.ts already gates this, but session may rarely be transient
  if (!session) redirect("/sign-in");

  const isAdmin = session.user.role === "admin";
  const initials = getInitials(session.user.name);

  // Fetch session rows for admin only — skip DB hit for member dashboards
  const rows = isAdmin
    ? await db
        .select({
          id: schema.sessions.id,
          sessionNumber: schema.sessions.sessionNumber,
          theme: schema.sessions.theme,
          date: schema.sessions.date,
          attributionParsed: schema.sessions.attributionParsed,
        })
        .from(schema.sessions)
        .orderBy(asc(schema.sessions.sessionNumber))
    : [];

  // Drizzle returns Date | null for timestamp_ms columns; convert to number | null for props
  const dateRows = rows.map((r) => ({
    id: r.id,
    sessionNumber: r.sessionNumber,
    theme: r.theme,
    date: r.date instanceof Date ? r.date.getTime() : r.date,
  }));

  const attributionErrors = rows
    .filter((r) => !r.attributionParsed)
    .map((r) => ({ id: r.id, sessionNumber: r.sessionNumber, theme: r.theme }));

  const contributorList: ContributorOption[] = isAdmin
    ? await db
        .select({
          initials: schema.contributors.initials,
          name: schema.contributors.name,
        })
        .from(schema.contributors)
    : [];

  return (
    <main className="mx-auto max-w-[640px] px-6 pt-12">
      <h1 className="text-[28px] font-semibold leading-tight">
        Warwick Massive Tunage
      </h1>

      <div className="mt-6 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm">
            Signed in as{" "}
            <span className="font-medium">{session.user.name}</span>
          </p>
          {isAdmin && (
            <Badge variant="default" className="mt-1">
              Admin
            </Badge>
          )}
        </div>
      </div>

      <Separator className="my-8" />

      {isAdmin && (
        <>
          <section className="mt-8">
            <ImportTriggerCard />
          </section>
          {attributionErrors.length > 0 && (
            <>
              <Separator className="my-8" />
              <section>
                <AttributionErrorCard
                  errors={attributionErrors}
                  contributors={contributorList}
                />
              </section>
            </>
          )}
          <Separator className="my-8" />
          <section>
            <SessionDateTable rows={dateRows} />
          </section>
        </>
      )}

      <div className="mt-8">
        <DashboardSignOut />
      </div>
    </main>
  );
}
