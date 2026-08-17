"use client";

import {
  ArrowUpDown,
  CalendarClock,
  LayoutGrid,
  Rows3,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { ContributorChip } from "@/components/ContributorChip";
import {
  lengthLabel,
  SessionCard,
  type SessionCardPayload,
} from "@/components/SessionCard";
import { SessionTimeline } from "@/components/SessionTimeline";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";

type View = "grid" | "table" | "timeline";
type SortKey = "sessionNumber" | "theme" | "date";
type SortDirection = "asc" | "desc";

const VIEW_OPTIONS: { value: View; label: string; icon: typeof LayoutGrid }[] =
  [
    { value: "grid", label: "Grid", icon: LayoutGrid },
    { value: "table", label: "Table", icon: Rows3 },
    { value: "timeline", label: "Timeline", icon: CalendarClock },
  ];

function isView(value: string | null): value is View {
  return value === "grid" || value === "table" || value === "timeline";
}

/**
 * Client island for the /sessions archive. Extends the Plan 02 grid-only
 * island with a grid/table/timeline view toggle (URL-persisted via ?view=)
 * and client-side search across theme, contributor name, and artist name
 * (D-14 — no API route).
 */
export function ArchiveClient({
  sessions,
}: {
  sessions: SessionCardPayload[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const view: View = isView(rawView) ? rawView : "grid";

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("sessionNumber");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function setView(v: View) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`/sessions?${params.toString()}`, { scroll: false });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      if (s.theme.toLowerCase().includes(q)) return true;
      if (s.contributors.some((c) => c.name.toLowerCase().includes(q)))
        return true;
      if (s.artistNames.some((a) => a.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [sessions, query]);

  const sortedForTable = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "sessionNumber") {
        cmp = a.sessionNumber - b.sessionNumber;
      } else if (sortKey === "theme") {
        cmp = a.theme.localeCompare(b.theme);
      } else {
        const aDate = a.date ?? -Infinity;
        const bDate = b.date ?? -Infinity;
        cmp = aDate - bDate;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDirection]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  }

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
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:min-w-[280px] sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by theme, person, or artist"
            className="h-10 w-full rounded-md border border-border bg-card py-2 pr-3 pl-9 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
        <div className="flex items-center gap-1 self-start sm:self-auto">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = view === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                variant={active ? "default" : "ghost"}
                size="sm"
                onClick={() => setView(option.value)}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </Button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <h2 className="text-[20px] font-semibold leading-tight">
            No matching sessions
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            No sessions match &ldquo;{query}&rdquo;. Try a different theme,
            person, or artist.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-4"
            onClick={() => setQuery("")}
          >
            Clear search
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((session) => (
            <SessionCard key={session.sessionNumber} session={session} />
          ))}
        </div>
      ) : view === "timeline" ? (
        <SessionTimeline sessions={filtered} />
      ) : (
        <div className="mt-8 rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] text-right">
                  <button
                    type="button"
                    onClick={() => toggleSort("sessionNumber")}
                    className="inline-flex items-center gap-1 text-foreground"
                  >
                    No
                    <ArrowUpDown
                      className={`h-3.5 w-3.5 ${sortKey === "sessionNumber" ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("theme")}
                    className="inline-flex items-center gap-1 text-foreground"
                  >
                    Theme
                    <ArrowUpDown
                      className={`h-3.5 w-3.5 ${sortKey === "theme" ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                </TableHead>
                <TableHead className="w-[180px]">
                  <button
                    type="button"
                    onClick={() => toggleSort("date")}
                    className="inline-flex items-center gap-1 text-foreground"
                  >
                    Date
                    <ArrowUpDown
                      className={`h-3.5 w-3.5 ${sortKey === "date" ? "text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                </TableHead>
                <TableHead>Contributors</TableHead>
                <TableHead className="w-[90px]">Length</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedForTable.map((session) => {
                const dateLabel = session.date
                  ? new Date(session.date).toLocaleDateString("en-GB", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Date TBD";
                return (
                  <TableRow key={session.sessionNumber} className="group">
                    <TableCell className="text-right text-muted-foreground">
                      <Link
                        href={`/sessions/${session.sessionNumber}`}
                        className="block focus-visible:outline-none"
                      >
                        {session.sessionNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sessions/${session.sessionNumber}`}
                        className="block truncate text-foreground focus-visible:outline-none"
                      >
                        {session.theme}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sessions/${session.sessionNumber}`}
                        className={
                          session.date
                            ? "block text-foreground focus-visible:outline-none"
                            : "block text-muted-foreground focus-visible:outline-none"
                        }
                      >
                        {dateLabel}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sessions/${session.sessionNumber}`}
                        className="flex items-center gap-1 focus-visible:outline-none"
                      >
                        {session.contributors.map((c) => (
                          <ContributorChip
                            key={c.initials}
                            initials={c.initials}
                            name={c.name}
                            size={20}
                          />
                        ))}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <Link
                        href={`/sessions/${session.sessionNumber}`}
                        className="block focus-visible:outline-none"
                      >
                        {lengthLabel(
                          session.totalDurationMs,
                          session.hasUnknownLength,
                        )}
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </TooltipProvider>
  );
}
