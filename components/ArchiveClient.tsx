"use client";

import { SessionCard, type SessionCardPayload } from "@/components/SessionCard";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client island for the /sessions archive. This plan ships only the default
 * grid view; Plan 03 extends this component with useSearchParams-driven view
 * state (table/timeline) and the search box. Keep the exported signature
 * stable so Plan 03 extends rather than rewrites.
 */
export function ArchiveClient({
  sessions,
}: {
  sessions: SessionCardPayload[];
}) {
  if (sessions.length === 0) {
    return (
      <TooltipProvider>
        <div className="mt-12 text-center">
          <h2 className="text-[20px] font-semibold leading-tight">
            No sessions yet
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sessions will appear here once the archive has been imported.
          </p>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((session) => (
          <SessionCard key={session.sessionNumber} session={session} />
        ))}
      </div>
    </TooltipProvider>
  );
}
