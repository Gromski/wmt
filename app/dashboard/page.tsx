import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardSignOut } from "@/components/DashboardSignOut";
import { ImportTriggerCard } from "@/components/ImportTriggerCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth";
import { getInitials } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  // Defence in depth — proxy.ts already gates this, but session may rarely be transient
  if (!session) redirect("/sign-in");

  const isAdmin = session.user.role === "admin";
  const initials = getInitials(session.user.name);

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
        <section className="mt-8">
          <ImportTriggerCard />
        </section>
      )}

      <div className="mt-8">
        <DashboardSignOut />
      </div>
    </main>
  );
}
